#!/usr/bin/env python3
"""
scripts/fetch-profiles.py
Fetches IBM Cloud VPC instance profiles, bare metal profiles + zone coverage
+ live capacity, and available public x86 images — then writes static JSON
files consumed by the VPC Synergies Map frontend.

Requirements:
    pip install ibm-vpc ibm-cloud-sdk-core httpx

Environment variables (required):
    IBMCLOUD_API_KEY   — IBM Cloud IAM API key

Usage:
    .venv/bin/python3 scripts/fetch-profiles.py
    .venv/bin/python3 scripts/fetch-profiles.py --regions us-south,eu-de
    .venv/bin/python3 scripts/fetch-profiles.py --out data/vpc

NOTES
-----
BMS profile zones come from the profile's own `zones` field (API 2026-08-04+).
Live capacity per zone comes from GET /v1/bare_metal_server/capacities via
httpx (same approach as github.com/ryan/vpc-bm-profile-report). The capacity
endpoint requires the account to have at least one VPC resource in the region
("zone map assigned"). If the region has no resources the call returns 409 and
capacity_by_region is omitted for that region — the UI falls back to showing
offered zones only.
"""

import argparse
import datetime as dt
import json
import os
import sys
from pathlib import Path

try:
    import httpx
    from ibm_cloud_sdk_core.authenticators import IAMAuthenticator
    from ibm_vpc import VpcV1
    from ibm_vpc.vpc_v1 import BareMetalServerProfilesPager, ImagesPager, InstanceProfilesPager
except ImportError as e:
    print(f"ERROR: missing dependency — {e}", file=sys.stderr)
    print("Run: pip install ibm-vpc ibm-cloud-sdk-core httpx", file=sys.stderr)
    sys.exit(1)


# ── Helpers ───────────────────────────────────────────────────────────────────

def log(msg: str) -> None:
    ts = dt.datetime.now().strftime("%H:%M:%S")
    print(f"[{ts}] {msg}", flush=True)


# BMS profile `zones` field requires API version 2026-08-04 or later.
# Use that as the minimum so zones always appear in the BMS profiles response.
_VPC_API_VERSION_MIN = "2026-08-04"

def api_version_date() -> str:
    """Return a VPC API version date: a few days ago, but no earlier than
    2026-08-04 (when BMS profile zones were added)."""
    candidate = (dt.date.today() - dt.timedelta(days=3)).isoformat()
    return max(candidate, _VPC_API_VERSION_MIN)


def service_url(region: str, region_info: dict | None = None) -> str:
    """Resolve the VPC API base URL for a region.
    Prefers the endpoint from the /v1/regions response, then SDK map, then
    the documented https://{region}.iaas.cloud.ibm.com/v1 pattern.
    """
    if region_info:
        ep = region_info.get("endpoint", "")
        if ep:
            return ep.rstrip("/") if ep.endswith("/v1") else f"{ep.rstrip('/')}/v1"
        href = region_info.get("href", "")
        if href and "://" in href:
            host = href.split("://", 1)[1].split("/", 1)[0]
            scheme = href.split("://", 1)[0]
            return f"{scheme}://{host}/v1"
    sdk_url = VpcV1.get_service_url_for_region(region)
    return sdk_url or f"https://{region}.iaas.cloud.ibm.com/v1"


def build_client(authenticator: IAMAuthenticator, url: str) -> VpcV1:
    svc = VpcV1(authenticator=authenticator)
    svc.set_service_url(url)
    return svc


def val(obj) -> object:
    """Unwrap IBM VPC API attribute shapes (fixed/range/enum/dependent/plain)."""
    if not isinstance(obj, dict):
        return obj
    t = obj.get("type")
    if t == "fixed":
        return obj.get("value")
    if t == "range":
        return f"{obj.get('min', '')}–{obj.get('max', '')}"
    if t == "enum":
        # For enum bandwidth, prefer the default value if present
        default = obj.get("default")
        if default is not None:
            return default
        return ",".join(str(v) for v in obj.get("values", []))
    if t == "dependent":
        # Value depends on instance config (e.g. bandwidth scales with vCPU count)
        return None
    # fallback: try common plain-value keys
    return obj.get("value") or obj.get("default") or obj


# ── Region discovery ──────────────────────────────────────────────────────────

def list_all_regions(bootstrap_client: VpcV1) -> list[dict]:
    """GET /v1/regions — returns every VPC region with its endpoint."""
    return bootstrap_client.list_regions().get_result().get("regions", [])


# ── VSI profiles ──────────────────────────────────────────────────────────────

_GEN_RE = __import__("re").compile(r"^[a-z]+(\d+|f)[a-z]*-")

def _vsi_gen(name: str) -> str | None:
    """Extract the generation token from a VSI profile name.
    Returns '2', '3', '4', 'flex', or None if unknown.
    """
    m = _GEN_RE.match(name or "")
    if not m:
        return None
    g = m.group(1)
    return "flex" if g == "f" else g


def fetch_vsi_profiles(client: VpcV1) -> list[dict]:
    pager = InstanceProfilesPager(client=client, limit=100)
    rows = []
    while pager.has_next():
        rows.extend(pager.get_next())
    return rows


def fetch_vsi_profiles_for_region(client: VpcV1) -> set[str]:
    """Return the set of VSI profile names available in this region's client."""
    pager = InstanceProfilesPager(client=client, limit=100)
    names: set[str] = set()
    while pager.has_next():
        for p in pager.get_next():
            n = p.get("name")
            if n:
                names.add(n)
    return names


def bw_max_gbps(bw_field: dict | None) -> float | None:
    """Extract the bandwidth cap in Gbps from an InstanceProfileBandwidth field.
    The API key is 'bandwidth' (not 'network_bandwidth'). Observed types:
      - {"type":"fixed","value":4000}                → value / 1000
      - {"type":"range","min":2000,"max":200000,...}  → max / 1000
      - {"type":"enum","default":4000,"values":[...]} → max(values) / 1000
      - {"type":"dependent"}                         → None
    Values are in Mbps; we return Gbps.
    """
    if not isinstance(bw_field, dict):
        return None
    t = bw_field.get("type")
    if t == "fixed":
        v = bw_field.get("value")
        return round(v / 1000, 1) if v else None
    if t == "range":
        m = bw_field.get("max")
        return round(m / 1000, 1) if m else None
    if t == "enum":
        vals = bw_field.get("values", [])
        if vals:
            return round(max(vals) / 1000, 1)
    # dependent or unknown → None
    return None


def summarise_vsi(p: dict) -> dict:
    return {
        "name":           p.get("name"),
        "family":         p.get("family"),
        "vcpu":           val(p.get("vcpu_count")),
        "memory_gb":      val(p.get("memory")),
        "bandwidth_gbps": bw_max_gbps(p.get("bandwidth")),  # 'bandwidth', not 'network_bandwidth'
        "gpu_count":      val(p.get("gpu_count")) if "gpu_count" in p else None,
        "numa_count":     val(p.get("numa_count")) if "numa_count" in p else None,
        # regions populated later for gen4+ profiles; None = all regions
        "regions":        None,
    }


# ── BMS profiles ──────────────────────────────────────────────────────────────

def fetch_bms_profiles(client: VpcV1) -> list[dict]:
    pager = BareMetalServerProfilesPager(client=client, limit=100)
    rows = []
    while pager.has_next():
        rows.extend(pager.get_next())
    return rows


def summarise_bms(p: dict) -> dict:
    """Flatten a BMS profile. zones come from the profile's own `zones` field
    (available in API version 2026-08-04+). Each zone entry becomes a row in
    `zones` with `available: true` — meaning the profile is *offered* there.
    The capacity endpoint requires account resources in each region and is
    not usable as a public catalogue call, so we use offered zones instead.
    """
    offered = [z.get("name") for z in p.get("zones", []) if z.get("name")]
    return {
        "name":              p.get("name"),
        "family":            p.get("family"),
        "cpu_socket_count":  val(p.get("cpu_socket_count")),
        "cpu_core_count":    val(p.get("cpu_core_count")),
        "cpu_speed":         val(p.get("cpu_speed")),
        "memory_gb":         val(p.get("memory")),
        "network_bandwidth": val(p.get("network_bandwidth")),
        # zones where this profile is offered, as a flat sorted list
        "zones": sorted(offered),
    }


# ── BMS capacity (direct httpx — one call per region) ────────────────────────

def fetch_bms_capacity_for_region(
    http_client: httpx.Client,
    authenticator: IAMAuthenticator,
    svc_url: str,
    version: str,
) -> set[tuple[str, str]]:
    """GET /v1/bare_metal_server/capacities for one region.
    Returns a set of (profile_name, zone_name) tuples that currently have
    capacity. Raises httpx.HTTPStatusError on failure (caller handles 409).
    Follows next.href pagination until exhausted.
    """
    token = authenticator.token_manager.get_token()
    headers = {"Authorization": f"Bearer {token}", "Accept": "application/json"}
    url = f"{svc_url}/bare_metal_server/capacities?version={version}&generation=2&limit=100"
    cap_set: set[tuple[str, str]] = set()
    while url:
        resp = http_client.get(url, headers=headers, timeout=30)
        if not resp.is_success:
            raise httpx.HTTPStatusError(
                f"HTTP {resp.status_code}: {resp.text[:300]}",
                request=resp.request,
                response=resp,
            )
        data = resp.json()
        for c in data.get("capacities", []):
            pname = c.get("profile", {}).get("name")
            zname = c.get("zone", {}).get("name")
            if pname and zname:
                cap_set.add((pname, zname))
        nxt = data.get("next")
        url = nxt["href"] if nxt else None
    return cap_set


# ── Images ────────────────────────────────────────────────────────────────────

def fetch_images(client: VpcV1) -> list[dict]:
    """Public available x86_64 stock images via ImagesPager.
    Uses status=['available'] server-side to skip deprecated/obsolete pages.
    Filters client-side to amd64 architecture via operating_system.architecture.
    """
    pager = ImagesPager(
        client=client,
        limit=100,
        visibility="public",
        status=["available"],
    )
    items = []
    while pager.has_next():
        items.extend(pager.get_next())
    # Keep only x86_64 (amd64) — architecture lives on the operating_system object
    return [
        i for i in items
        if (i.get("operating_system") or {}).get("architecture") == "amd64"
    ]


def summarise_image(img: dict) -> dict:
    os_info = img.get("operating_system", {})
    return {
        "id":           img.get("id"),
        "name":         img.get("name"),
        "os_name":      os_info.get("name"),
        "os_family":    os_info.get("family"),
        "os_vendor":    os_info.get("vendor"),
        "os_version":   os_info.get("version"),
        "architecture": os_info.get("architecture"),  # lives on operating_system, not top-level
        "created_at":   img.get("created_at"),
    }


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Fetch IBM VPC profiles and images.")
    parser.add_argument("--regions", default="",
                        help="Comma-separated regions (default: all discovered)")
    parser.add_argument("--bootstrap-region", default="us-south",
                        help="Region used to call /v1/regions (default: us-south)")
    parser.add_argument("--out", default="data/vpc",
                        help="Output directory (default: data/vpc)")
    parser.add_argument("--skip-capacity", action="store_true",
                        help="Skip BMS capacity check (faster, no live availability)")
    args = parser.parse_args()

    api_key = os.environ.get("IBMCLOUD_API_KEY")
    if not api_key:
        print("ERROR: IBMCLOUD_API_KEY not set.", file=sys.stderr)
        sys.exit(1)

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    fetched_at = dt.datetime.now(dt.timezone.utc).isoformat()
    version = api_version_date()

    regions_filter = set(r.strip() for r in args.regions.split(",") if r.strip()) or None

    # ── Bootstrap: discover all regions ───────────────────────────────────────
    authenticator = IAMAuthenticator(api_key)
    bootstrap_url = service_url(args.bootstrap_region)
    bootstrap_client = build_client(authenticator, bootstrap_url)

    log(f"Discovering regions via {bootstrap_url} …")
    all_region_infos = list_all_regions(bootstrap_client)
    region_infos = [
        r for r in all_region_infos
        if not regions_filter or r.get("name") in regions_filter
    ]
    region_names = [r["name"] for r in region_infos]
    log(f"Using {len(region_names)} regions: {region_names}")

    # ── VSI profiles (from bootstrap region — global catalogue) ───────────────
    log("Fetching VSI instance profiles …")
    raw_vsi = fetch_vsi_profiles(bootstrap_client)
    vsi_profiles = [summarise_vsi(p) for p in raw_vsi]
    log(f"  ✓ {len(vsi_profiles)} VSI profiles")

    # ── VSI per-region availability (for gen4 select-availability profiles) ───
    # Gen4 profiles have "Select Availability" — not all regions carry them.
    # We call list_instance_profiles per region and record which regions return
    # each gen4 profile. gen2/gen3/flex get regions=null (= everywhere).
    log("Fetching per-region VSI profile availability …")
    gen4_names = {p["name"] for p in vsi_profiles if _vsi_gen(p["name"]) == "4"}
    if gen4_names:
        # profile_name → set of region names where it appears
        regions_by_profile: dict[str, set[str]] = {n: set() for n in gen4_names}
        for region_info in region_infos:
            rname = region_info["name"]
            rurl  = service_url(rname, region_info)
            rclient = build_client(authenticator, rurl)
            try:
                region_names_here = fetch_vsi_profiles_for_region(rclient)
                for pname in gen4_names:
                    if pname in region_names_here:
                        regions_by_profile[pname].add(rname)
                log(f"  {rname}: {len(region_names_here & gen4_names)} gen4 profiles")
            except Exception as exc:
                log(f"  ⚠ skipped {rname}: {exc}")
        # Write back into vsi_profiles
        vsi_index = {p["name"]: p for p in vsi_profiles}
        for pname, rset in regions_by_profile.items():
            if pname in vsi_index:
                vsi_index[pname]["regions"] = sorted(rset) if rset else []
        log(f"  ✓ per-region check complete for {len(gen4_names)} gen4 profiles")
    else:
        log("  (no gen4 profiles found — skipping per-region check)")

    # ── BMS profiles (from bootstrap region — global catalogue) ───────────────
    log("Fetching BMS profiles …")
    raw_bms = fetch_bms_profiles(bootstrap_client)
    bms_profiles = [summarise_bms(p) for p in raw_bms]
    log(f"  ✓ {len(bms_profiles)} BMS profiles")

    log(f"Using API version date: {version}")
    zone_counts = sum(len(b["zones"]) for b in bms_profiles)
    log(f"  ✓ {zone_counts} total profile/zone combinations across {len(bms_profiles)} BMS profiles")

    # ── BMS capacity per region (best-effort — requires VPC resources exist) ──
    if not args.skip_capacity:
        # Build a lookup: profile_name → index in bms_profiles list
        bms_index = {b["name"]: b for b in bms_profiles}
        with httpx.Client() as http_client:
            for region_info in region_infos:
                rname = region_info["name"]
                svc_url = service_url(rname, region_info)
                log(f"Fetching BMS capacity for {rname} …")
                try:
                    cap_set = fetch_bms_capacity_for_region(
                        http_client, authenticator, svc_url, version
                    )
                    log(f"  ✓ {len(cap_set)} capacity entries")
                    # Group by profile name, attach to each profile
                    region_caps: dict[str, list[dict]] = {}
                    for (pname, zname) in sorted(cap_set):
                        region_caps.setdefault(pname, []).append(
                            {"zone": zname, "available": True}
                        )
                    for bp in bms_profiles:
                        offered = set(bp["zones"])
                        caps = region_caps.get(bp["name"], [])
                        # Also include offered-but-no-capacity zones as available:false
                        capped_zones = {e["zone"] for e in caps}
                        for z in sorted(offered - capped_zones):
                            caps.append({"zone": z, "available": False})
                        caps.sort(key=lambda e: e["zone"])
                        bp.setdefault("capacity_by_region", {})[rname] = caps
                except httpx.HTTPError as exc:
                    log(f"  ⚠ skipped {rname} (no zone map — create a VPC resource there first):\n    {exc}")
    else:
        log("Skipping BMS capacity check (--skip-capacity)")

    # ── Images (from bootstrap region) ────────────────────────────────────────
    log(f"Fetching public x86 images from {args.bootstrap_region} …")
    raw_images = fetch_images(bootstrap_client)
    images = [summarise_image(i) for i in raw_images]
    log(f"  ✓ {len(images)} images")

    # ── Write output ──────────────────────────────────────────────────────────
    profiles_out = {
        "fetched_at":   fetched_at,
        "regions":      region_names,
        "vsi_profiles": vsi_profiles,
        "bms_profiles": bms_profiles,
    }
    images_out = {
        "fetched_at": fetched_at,
        "region":     args.bootstrap_region,
        "images":     images,
    }

    (out_dir / "profiles.json").write_text(json.dumps(profiles_out, indent=2))
    (out_dir / "images.json").write_text(json.dumps(images_out, indent=2))

    log(f"✅  Written to {out_dir}/")
    log(f"   profiles.json — {len(vsi_profiles)} VSI, {len(bms_profiles)} BMS profiles")
    log(f"   images.json   — {len(images)} images")


if __name__ == "__main__":
    main()
