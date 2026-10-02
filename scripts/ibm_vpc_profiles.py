#!/usr/bin/env python3
"""
ibm_vpc_profiles.py

Lists every available IBM Cloud VPC profile -- both virtual server
instances and bare metal servers -- across every VPC region, using
nothing but the official `ibm-vpc` Python SDK. No web scraping, no
Playwright, no browser, and no pricing: just the hardware/capacity facts
that come straight from IBM's REST API.

This is a companion to ibm_vpc_pricing_scraper.py, which additionally
scrapes *price* (not available from any API, only the catalog UI) for
both server types. If you don't need price, this script is simpler,
faster, and more robust, because it's talking to a real documented API
contract instead of reading a web page's DOM.

WHAT IT PULLS, AND HOW
-----------------------
1. Regions: `GET /v1/regions`. This one endpoint is answered by *any*
   regional API host and returns every VPC region IBM Cloud has, each
   with its own API endpoint. So we bootstrap against one region (default
   us-south, override with --bootstrap-region) just to get this list --
   no hardcoded region list to go stale.

2. Virtual server instance profiles, per region:
   `GET /v1/instance/profiles` (paged automatically via the SDK's
   `InstanceProfilesPager`). Each profile describes vCPU count/family,
   memory, bandwidth, disks, and (for GPU profiles) accelerator specs.
   There's no separate "capacity" concept for VSI profiles in this API --
   a profile listed for a region is assumed provisionable there.

3. Bare metal server profiles, per region:
   `GET /v1/bare_metal_server/profiles` (hardware specs, per profile),
   paged via `BareMetalServerProfilesPager`. Each profile also lists which
   zones it's *offered* in (its `zones` field) -- that's included here as
   a `zone` column (one row per profile+zone).

4. Bare metal live capacity, per region:
   `GET /v1/bare_metal_server/capacities` -- reports whether a
   profile+zone combo has capacity *right now* (confirmed from IBM's
   docs: a presence/absence list of {profile, zone} pairs, not a numeric
   quantity). As of this writing this endpoint isn't implemented in the
   published `ibm-vpc` Python SDK (checked against the latest release on
   PyPI -- `list_regions`, `list_instance_profiles`, and
   `list_bare_metal_server_profiles` are all there as real SDK methods,
   but there's no `list_bare_metal_server_capacities` method or Pager).
   So this one call is the deliberate exception to "pure SDK calls" in
   this script: everything else goes through the SDK, but capacity goes
   through a direct HTTP call with `httpx`, reusing the same
   `IAMAuthenticator` credentials the SDK client already has (via
   `authenticator.token_manager.get_token()`) rather than re-implementing
   IAM token exchange from scratch. It's on by default; turn it off with
   --skip-bare-metal-capacity if you'd rather stay 100% SDK-only and treat
   `zone` as "offered here" without a live-availability flag.

Most numeric/enum-ish profile attributes (vcpu_count, memory, bandwidth,
etc.) aren't plain values in the API -- they're one of a few shapes
describing how the attribute *varies*:
    {"type": "fixed", "value": 8}                 -> always 8
    {"type": "range", "min": 1, "max": 128}        -> pick 1-128
    {"type": "enum", "values": ["amd64"]}          -> pick one of these
`describe_field()` below turns any of those into one readable string for
a spreadsheet cell.

AUTH
----
Needs an IBM Cloud IAM API key in the environment variable named by
--api-key-env (default: IBMCLOUD_API_KEY). Wire it up with fnox rather
than exporting it yourself:

    fnox run -- python ibm_vpc_profiles.py --output-dir ./data

(Check `fnox --help` / your fnox config for the exact subcommand your
installed version uses -- `run`/`exec` are common names but this varies.)

USAGE
-----
    pip install --break-system-packages ibm-vpc ibm-cloud-sdk-core httpx
    fnox run -- python ibm_vpc_profiles.py --output-dir ./data
"""

import argparse
import csv
import datetime as dt
import json
import os
import sys
from pathlib import Path

import httpx
from ibm_cloud_sdk_core.authenticators import IAMAuthenticator
from ibm_vpc import VpcV1

# The Pager helper classes aren't re-exported from the top-level `ibm_vpc`
# package (only `VpcV1` is) -- they live in the `ibm_vpc.vpc_v1` submodule.
# Confirmed by inspecting the installed package; `from ibm_vpc import
# InstanceProfilesPager` (as IBM's own docs snippets imply) raises
# ImportError against the current PyPI release.
from ibm_vpc.vpc_v1 import InstanceProfilesPager, BareMetalServerProfilesPager

SERVER_TYPE_VS = "virtual_server_instance"
SERVER_TYPE_BM = "bare_metal_server"


def log(msg: str) -> None:
    """Small helper so progress is visible when run from cron with output
    redirected to a log file (timestamps make it easy to tell runs apart)."""
    ts = dt.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{ts}] {msg}", flush=True)


def describe_field(field) -> str:
    """Turn one of the VPC API's {"type": "fixed"/"range"/"enum", ...}
    attribute shapes into a single readable string. See the module
    docstring for why these aren't plain values."""
    if not isinstance(field, dict):
        return str(field) if field is not None else ""
    field_type = field.get("type")
    if field_type == "fixed":
        return str(field.get("value", ""))
    if field_type == "range":
        return f"{field.get('min', '')}-{field.get('max', '')}"
    if field_type == "enum":
        return ",".join(str(v) for v in field.get("values", []))
    # Unrecognized shape (API added something new) -- keep the raw JSON
    # rather than silently dropping data.
    return json.dumps(field)


def describe_disks(disks: list) -> str:
    """Turn a profile's `disks` list into a short human-readable summary,
    e.g. '4 x 100 GB'. A profile can have more than one disk grouping,
    semicolon-joined."""
    parts = []
    for d in disks or []:
        qty = describe_field(d.get("quantity", {}))
        size = describe_field(d.get("size", {}))
        parts.append(f"{qty} x {size} GB")
    return "; ".join(parts)


def build_authenticator(api_key: str) -> IAMAuthenticator:
    """One IAMAuthenticator, reused across every region. It caches and
    auto-refreshes the underlying IAM access token itself, so building it
    once per run (rather than once per region) avoids needless repeat
    token exchanges."""
    return IAMAuthenticator(api_key)


def _ensure_v1(endpoint: str) -> str:
    endpoint = endpoint.rstrip("/")
    return endpoint if endpoint.endswith("/v1") else f"{endpoint}/v1"


def service_url_for_region(region: str, region_info: dict | None = None) -> str:
    """Resolve the VPC API base URL for a region.

    `ibm-vpc`'s REGIONAL_ENDPOINTS map lags new regions — Mumbai
    (`in-mum`, https://in-mum.iaas.cloud.ibm.com/v1) is a documented
    public endpoint that still isn't in the installed SDK, so
    `VpcV1.get_service_url_for_region("in-mum")` returns None and
    `set_service_url(None)` blows up. Prefer the region's own href /
    endpoint from GET /v1/regions, then the SDK map, then the documented
    `https://{region}.iaas.cloud.ibm.com/v1` pattern.
    """
    if region_info:
        explicit = region_info.get("endpoint")
        if isinstance(explicit, str) and explicit.strip():
            return _ensure_v1(explicit.strip())
        href = region_info.get("href")
        if isinstance(href, str) and "://" in href:
            if "/v1/" in href:
                return href.split("/v1/", 1)[0] + "/v1"
            after_scheme = href.split("://", 1)[1]
            host = after_scheme.split("/", 1)[0]
            scheme = href.split("://", 1)[0]
            return f"{scheme}://{host}/v1"

    url = VpcV1.get_service_url_for_region(region)
    if url:
        return url
    return f"https://{region}.iaas.cloud.ibm.com/v1"


def build_client(authenticator: IAMAuthenticator, service_url: str) -> VpcV1:
    """Construct a VpcV1 SDK client pointed at one region's API endpoint,
    using the shared authenticator. The VPC API is regional -- every
    list/get call only sees that region's resources -- so we build a
    fresh client per region rather than one global client."""
    service = VpcV1(authenticator=authenticator)
    service.set_service_url(service_url)
    return service


def list_all_regions(bootstrap_client: VpcV1) -> list[dict]:
    """GET /v1/regions -- answered by any regional endpoint, returns
    every VPC region IBM Cloud has. This is how we avoid hardcoding a
    region list that could drift out of date."""
    response = bootstrap_client.list_regions()
    return response.get_result().get("regions", [])


def list_instance_profiles_for_region(client: VpcV1) -> list[dict]:
    """All virtual server instance profiles for whichever region `client`
    is pointed at, auto-paged via the SDK's Pager helper."""
    pager = InstanceProfilesPager(client=client, limit=100)
    results: list[dict] = []
    while pager.has_next():
        results.extend(pager.get_next())
    return results


def list_bare_metal_profiles_for_region(client: VpcV1) -> list[dict]:
    """All bare metal server profiles for whichever region `client` is
    pointed at, auto-paged."""
    pager = BareMetalServerProfilesPager(client=client, limit=100)
    results: list[dict] = []
    while pager.has_next():
        results.extend(pager.get_next())
    return results


def default_api_version() -> str:
    """The VPC API is versioned by date (?version=YYYY-MM-DD): you're
    asking for "the API's behavior as documented on this date". Instead
    of hardcoding a date that will eventually fall outside IBM's
    documented rolling window, just ask for "a few days ago" every time
    this runs."""
    return (dt.date.today() - dt.timedelta(days=3)).isoformat()


def list_bare_metal_capacities_for_region(
    http_client: httpx.Client,
    authenticator: IAMAuthenticator,
    service_url: str,
    api_version: str,
) -> list[dict]:
    """GET /v1/bare_metal_server/capacities for one region -- the one
    call in this script that isn't going through the `ibm-vpc` SDK,
    because the SDK doesn't implement it yet (see module docstring).
    Reuses the same IAM credentials as the SDK client via
    `authenticator.token_manager.get_token()` rather than re-implementing
    the IAM token exchange, and follows the API's `next.href` pagination
    links until exhausted -- the same pattern the SDK's own Pager classes
    use internally, just written out by hand for this one endpoint."""
    token = authenticator.token_manager.get_token()
    headers = {"Authorization": f"Bearer {token}", "Accept": "application/json"}
    url = f"{service_url}/bare_metal_server/capacities?version={api_version}&generation=2&limit=100"

    items: list[dict] = []
    while url:
        resp = http_client.get(url, headers=headers, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        items.extend(data.get("capacities", []))
        next_info = data.get("next")
        url = next_info["href"] if next_info else None
    return items


def build_vsi_rows(profiles: list[dict], region: str) -> list[dict]:
    """Flatten virtual server instance profiles into one row per
    profile. VSI profiles aren't zone-scoped in this API (no `zones`
    field, unlike bare metal), so this is one row per profile per
    region -- no zone/capacity dimension to join against."""
    rows = []
    for p in profiles:
        rows.append(
            {
                "row_type": "profile",
                "server_type": SERVER_TYPE_VS,
                "region": region,
                "profile_name": p.get("name", ""),
                "family": p.get("family", ""),
                "status": p.get("status", ""),
                "vcpu_architecture": describe_field(p.get("vcpu_architecture", {})),
                "vcpu_manufacturer": describe_field(p.get("vcpu_manufacturer", {})),
                "vcpu_count": describe_field(p.get("vcpu_count", {})),
                "memory_gib": describe_field(p.get("memory", {})),
                "bandwidth_mbps": describe_field(p.get("bandwidth", {})),
                "total_volume_bandwidth_mbps": describe_field(p.get("total_volume_bandwidth", {})),
                "gpu_count": describe_field(p.get("gpu_count", {})),
                "gpu_manufacturer": describe_field(p.get("gpu_manufacturer", {})),
                "gpu_memory_gib": describe_field(p.get("gpu_memory", {})),
                "gpu_model": describe_field(p.get("gpu_model", {})),
                "disks": describe_disks(p.get("disks", [])),
                "os_architecture": describe_field(p.get("os_architecture", {})),
            }
        )
    return rows


def build_bare_metal_rows(
    profiles: list[dict], capacities: list[dict] | None, region: str
) -> list[dict]:
    """Flatten bare metal profiles into one row per (profile, zone) using
    each profile's own `zones` field -- the zones it's *offered* in.

    `capacities` is the raw response list from
    `list_bare_metal_capacities_for_region()`, or None if that call was
    skipped (--skip-bare-metal-capacity). When provided, each row gets a
    `capacity_available` True/False flag from joining on (profile name,
    zone name). When None, `capacity_available` is left as "" (unknown)
    rather than False, so "not checked" is never mistaken for "confirmed
    unavailable"."""
    capacity_set = None
    if capacities is not None:
        capacity_set = {
            (c["profile"]["name"], c["zone"]["name"])
            for c in capacities
            if c.get("profile") and c.get("zone")
        }

    rows = []
    for p in profiles:
        profile_name = p.get("name", "")
        zones = p.get("zones", [])
        zone_names = [z.get("name", "") for z in zones] or [""]
        for zone_name in zone_names:
            if capacity_set is None:
                capacity_available = ""
            else:
                capacity_available = (profile_name, zone_name) in capacity_set
            rows.append(
                {
                    "row_type": "profile",
                    "server_type": SERVER_TYPE_BM,
                    "region": region,
                    "zone": zone_name,
                    "profile_name": profile_name,
                    "family": p.get("family", ""),
                    "cpu_architecture": describe_field(p.get("cpu_architecture", {})),
                    "cpu_core_count": describe_field(p.get("cpu_core_count", {})),
                    "cpu_socket_count": describe_field(p.get("cpu_socket_count", {})),
                    "memory_gib": describe_field(p.get("memory", {})),
                    "bandwidth_mbps": describe_field(p.get("bandwidth", {})),
                    "disks": describe_disks(p.get("disks", [])),
                    "capacity_available": capacity_available,
                }
            )
    return rows


def write_output(
    all_rows: list[dict],
    output_dir: Path,
    timestamp: str,
    file_prefix: str = "ibm_vpc_profiles",
    current_filename: str = "current-profiles.json",
) -> Path:
    """Write the combined (possibly heterogeneous-schema) rows to CSV and
    JSON. VSI profile rows and bare metal profile rows don't share every
    column (e.g. only bare metal rows have `zone`), so we collect the
    *union* of all column names across every row and let DictWriter fill
    in "" for whatever a given row doesn't have.

    `file_prefix` and `current_filename` let the bare-metal-only report
    script write `ibm_vpc_bm_profiles_*.json` / `current-bm-profiles.json`
    without a second copy of this writer."""
    output_dir.mkdir(parents=True, exist_ok=True)
    csv_path = output_dir / f"{file_prefix}_{timestamp}.csv"
    json_path = output_dir / f"{file_prefix}_{timestamp}.json"

    if all_rows:
        fieldnames: list[str] = []
        seen = set()
        for row in all_rows:
            for key in row.keys():
                if key not in seen:
                    seen.add(key)
                    fieldnames.append(key)

        # "utf-8-sig" writes a UTF-8 byte-order-mark so Excel/Numbers
        # read the file as UTF-8 instead of guessing a legacy codepage
        # (which is what previously mangled an em dash into "Äî" in the
        # sibling pricing script -- same fix, applied up front here).
        with csv_path.open("w", newline="", encoding="utf-8-sig") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames, restval="")
            writer.writeheader()
            writer.writerows(all_rows)
        log(f"Wrote {len(all_rows)} rows to {csv_path}")
    else:
        log("No rows collected -- nothing written. Check auth / region filters.")

    with json_path.open("w", encoding="utf-8") as f:
        json.dump(all_rows, f, indent=2)
    log(f"Wrote raw JSON snapshot to {json_path}")

    # Also write a stable, non-timestamped copy: report.html's default
    # auto-load looks for exactly this filename, so every run "just
    # updates the dashboard" without you having to repoint it at the
    # latest timestamped file by hand. The timestamped file above is
    # still kept too, for history/diffing runs over time. Only refresh it
    # on a run that actually produced rows -- a failed/empty run
    # shouldn't clobber the dashboard with nothing.
    if all_rows:
        current_path = output_dir / current_filename
        with current_path.open("w", encoding="utf-8") as f:
            json.dump(all_rows, f, indent=2)
        log(f"Updated {current_path}")

    return csv_path


def run(
    output_dir: Path,
    api_key_env: str,
    bootstrap_region: str,
    regions_filter: set[str] | None,
    include_vsi: bool,
    include_bare_metal: bool,
    include_bare_metal_capacity: bool,
    api_version: str | None = None,
    file_prefix: str = "ibm_vpc_profiles",
    current_filename: str = "current-profiles.json",
    available_only: bool = False,
) -> Path:
    api_key = os.environ.get(api_key_env)
    if not api_key:
        log(
            f"Environment variable {api_key_env} is not set -- can't authenticate "
            "to the VPC API. Set it (typically via `fnox run -- ...`) and try "
            "again. See the module docstring's AUTH section."
        )
        raise SystemExit(1)

    timestamp = dt.datetime.now().strftime("%Y%m%dT%H%M%S")
    version = api_version or default_api_version()
    authenticator = build_authenticator(api_key)

    bootstrap_url = service_url_for_region(bootstrap_region)
    bootstrap_client = build_client(authenticator, bootstrap_url)
    log(
        f"Discovering regions via /v1/regions "
        f"(bootstrapped from {bootstrap_region} at {bootstrap_url}) ..."
    )
    regions = list_all_regions(bootstrap_client)
    region_names = [r["name"] for r in regions]
    log(f"Found {len(region_names)} regions: {region_names}")

    all_rows: list[dict] = []
    # One httpx.Client, reused across every region's capacity call --
    # gets connection pooling/keep-alive for free instead of opening a
    # fresh connection per request.
    with httpx.Client() as http_client:
        for region_info in regions:
            region_name = region_info.get("name", "")
            if regions_filter and region_name not in regions_filter:
                continue

            service_url = service_url_for_region(region_name, region_info)
            log(f"Region {region_name} ({service_url}) ...")
            client = build_client(authenticator, service_url)

            if include_vsi:
                try:
                    profiles = list_instance_profiles_for_region(client)
                    rows = build_vsi_rows(profiles, region_name)
                    log(f"  virtual server instance profiles: {len(rows)}")
                    all_rows.extend(rows)
                except Exception as exc:  # noqa: BLE001 - log and keep going
                    log(f"  !! virtual server instance profiles failed for {region_name}: {exc}")

            if include_bare_metal:
                try:
                    bm_profiles = list_bare_metal_profiles_for_region(client)
                    bm_capacities = None
                    if include_bare_metal_capacity:
                        try:
                            bm_capacities = list_bare_metal_capacities_for_region(
                                http_client, authenticator, service_url, version
                            )
                        except httpx.HTTPError as exc:
                            # Capacity is a bonus signal -- if just this
                            # one call fails (e.g. region has no bare
                            # metal at all), still keep the profile rows,
                            # just without capacity_available filled in.
                            log(f"  !! bare metal capacity check failed for {region_name}: {exc}")
                    rows = build_bare_metal_rows(bm_profiles, bm_capacities, region_name)
                    available = sum(1 for r in rows if r.get("capacity_available") is True)
                    log(
                        f"  bare metal profile/zone rows: {len(rows)}"
                        + (f" ({available} with capacity now)" if bm_capacities is not None else "")
                    )
                    all_rows.extend(rows)
                except Exception as exc:  # noqa: BLE001 - log and keep going
                    log(f"  !! bare metal profiles failed for {region_name}: {exc}")

    if available_only:
        kept = [r for r in all_rows if r.get("capacity_available") is True]
        log(f"Filtered to {len(kept)} rows with capacity now (from {len(all_rows)}).")
        all_rows = kept

    return write_output(
        all_rows,
        output_dir,
        timestamp,
        file_prefix=file_prefix,
        current_filename=current_filename,
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("./data"),
        help="Directory to write timestamped CSV/JSON output into (default: ./data)",
    )
    parser.add_argument(
        "--api-key-env",
        type=str,
        default="IBMCLOUD_API_KEY",
        help="Name of the environment variable holding your IBM Cloud IAM API key (default: IBMCLOUD_API_KEY).",
    )
    parser.add_argument(
        "--bootstrap-region",
        type=str,
        default="us-south",
        help="Region used only to call /v1/regions and discover every other region (default: us-south).",
    )
    parser.add_argument(
        "--regions",
        type=str,
        default="",
        help="Comma-separated list of region names to include (e.g. us-south,eu-de). Default: all regions.",
    )
    parser.add_argument(
        "--skip-virtual-servers",
        action="store_true",
        help="Don't list virtual server instance profiles.",
    )
    parser.add_argument(
        "--skip-bare-metal",
        action="store_true",
        help="Don't list bare metal server profiles (also skips the capacity check).",
    )
    parser.add_argument(
        "--skip-bare-metal-capacity",
        action="store_true",
        help=(
            "List bare metal profiles, but skip the live /capacities check -- stays "
            "100%% SDK-only, capacity_available will be blank instead of True/False."
        ),
    )
    parser.add_argument(
        "--api-version",
        type=str,
        default=None,
        help=(
            "VPC API version date (YYYY-MM-DD) for the capacity REST call. "
            "Default: a few days before today, which IBM's API accepts as "
            "'current' behavior."
        ),
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    regions_filter = set(r.strip() for r in args.regions.split(",") if r.strip()) or None
    run(
        args.output_dir,
        api_key_env=args.api_key_env,
        bootstrap_region=args.bootstrap_region,
        regions_filter=regions_filter,
        include_vsi=not args.skip_virtual_servers,
        include_bare_metal=not args.skip_bare_metal,
        include_bare_metal_capacity=not args.skip_bare_metal_capacity,
        api_version=args.api_version,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
