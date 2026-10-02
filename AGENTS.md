# IBM Cloud VPC Synergies Map — Agent Onboarding

This file is written for a new agent session picking up this project. Read it fully before writing any code.

---

## What this project is

A **zero-dependency, zero-build static SPA** deployed on Vercel. No npm, no bundler, no framework.

```
index.html              ← app shell (tab buttons only, no logic)
css/app.css             ← all styles: IBM Carbon tokens, dark/light, lane colours,
                           profile tables, OS catalogue, region/family chips, BMS legend
js/app.js               ← all app logic (~800 lines, vanilla JS ES modules)
data/vpc/               ← all content as plain JSON (fetched at runtime)
fonts/                  ← self-hosted IBM Plex Sans + IBM Plex Mono woff2
scripts/                ← data validator (node) + IBM VPC API fetcher (python)
```

**To run locally:**
```bash
mise run dev            # validates data/vpc/*.json then serves at http://localhost:4173
# or directly:
node scripts/validate-feed.mjs data/vpc && python3 -m http.server 4173
```

Must be served (not `file://`) — JSON fetches fail on file:// due to CORS.

**To validate data only:**
```bash
mise run validate       # must report 0 errors, 0 warnings before every commit
```

**To refresh live API data (profiles + images):**
```bash
mise run fetch-profiles      # uses .venv/bin/python3 — NOT mise-managed Python
# Requires:  IBMCLOUD_API_KEY env var
# Outputs:   data/vpc/profiles.json  and  data/vpc/images.json
```

---

## File map

```
/Users/ryan/vpc-synergies-map/
├── AGENTS.md                       ← this file
├── onboarding-new-synergy-map.md   ← original spec (read-only reference)
├── index.html                      ← shell: Grid / OS Matrix / Profiles / BM Availability tab buttons
├── mise.toml                       ← tasks: validate, dev, open, fetch-profiles
├── vercel.json                     ← security headers + cache rules
├── requirements.txt                ← python deps (ibm-vpc, ibm-cloud-sdk-core, httpx)
│
├── css/app.css                     ← Carbon design tokens, dark/light theme,
│                                      --play-0..--play-6 lane colours,
│                                      profile table, OS catalogue, BMS legend & availability view styles
│
├── js/app.js                       ← full app logic
│   Key state fields:
│     viewMode       'grid' | 'matrix' | 'profiles' | 'availability'
│     activeId       currently selected product id (sidebar)
│     osFilter       active OS chip filter
│     query          search box text
│     profilesTab    'vsi' | 'bms'
│     profileFamily  active family chip in profiles view
│     bmsRegion      active region chip in BMS tab ('all' or e.g. 'us-east')
│     availProfileFilter active profile filter in BM Availability view
│     availRegionFilter  active region filter in BM Availability view
│
│   Key functions:
│     load()                 fetches all 5 data files, calls buildOsFilters()
│     buildOsFilters()       derives OS filter chips from images.json families
│     renderGrid()           7-lane card grid with OS filter bar + sidebar
│     renderMatrix()         OS image catalogue table (rows=family, cols=version chips)
│     renderProfiles()       VSI + BMS profile tabs with family/region filter bars
│     renderVsiProfiles()    sortable VSI table (260 profiles, 12 family chips)
│     renderBmsProfiles()    BMS table with region filter bar + zone capacity columns
│     renderAvailability()   BM Availability view with regional/zonal cards & count panel
│     renderSidebar()        integrations / value / discovery Qs / differentiators
│     render()               top-level re-render dispatcher
│     bindHeader()           tab switching, search, theme toggle
│     boot()                 load() → render() → bindHeader()
│
├── data/
│   ├── views.json                  ← view registry (vpc is default)
│   └── vpc/
│       ├── plays.json              ← 7 lanes + category definitions
│       ├── products.json           ← 33 products (nodes)
│       ├── connections.json        ← 73 edges
│       ├── profiles.json           ← LIVE DATA: 260 VSI + 31 BMS profiles
│       │                              BMS shape: { name, family, cpu_socket_count,
│       │                                cpu_core_count, cpu_speed, memory_gb,
│       │                                network_bandwidth, zones[], capacity_by_region }
│       │                              capacity_by_region: { "us-east": [{zone, available}] }
│       └── images.json             ← LIVE DATA: 55 public x86-64 images
│                                      Shape: { fetched_at, region, images[] }
│                                      Per image: { id, name, os_name, os_family,
│                                        os_vendor, os_version, architecture, created_at }
│
└── scripts/
    ├── validate-feed.mjs           ← data validator (node) — 0 errors/warnings = green
    ├── fetch-profiles.py           ← IBM VPC API fetcher:
    │                                  - discovers regions via GET /v1/regions
    │                                  - VSI profiles via InstanceProfilesPager
    │                                  - BMS profiles via BareMetalServerProfilesPager
    │                                  - BMS capacity via direct httpx REST
    │                                    (ibm-vpc SDK unreliable for this endpoint)
    │                                  - images via ImagesPager(status=['available'])
    │                                    + client-side filter: os.architecture == 'amd64'
    │                                  - API version: max(today-3days, "2026-08-04")
    │                                    (zones[] field requires ≥ 2026-08-04)
    │                                  - IAM token re-used from SDK authenticator for httpx
    ├── ibm_vpc_profiles.py         ← reference only, not used directly
    └── ibm_vpc_profiles_report.py  ← reference only, not used directly
```

---

## Lane structure (plays.json)

| Play # | `cat` id     | Display name      | CSS var     |
|--------|--------------|-------------------|-------------|
| 0      | `vpc`        | VPC Core (hub)    | `--play-0`  |
| 1      | `compute`    | Compute           | `--play-1`  |
| 2      | `networking` | Networking        | `--play-2`  |
| 3      | `storage`    | Storage           | `--play-3`  |
| 4      | `security`   | Security          | `--play-4`  |
| 5      | `connectivity` | Connectivity    | `--play-5`  |
| 6      | `platform`   | IBM Cloud Platform | `--play-6` |

Hub node id: `vpc_core` (hub: true, cat: "vpc")

---

## Data schemas (quick reference)

**products.json** — each node:
```jsonc
{
  "id": "vpc_vsi",           // unique snake_case — referenced by connections
  "label": "Virtual Server Instance",
  "cat": "compute",          // must match a categories[].id in plays.json
  "plays": [1],              // array of play ids
  "hub": false,
  "status": "ga",            // ga | partner | restricted | deprecated | coming_soon
  "docsUrl": "https://...",
  "desc": "...",
  "value": "...",            // seller value proposition
  "questions": ["...", "..."],   // 2–5 discovery questions
  "differentiators": ["..."],
  "competitors": ["..."],
  "os": ["linux", "windows"] // optional — drives OS filter chip highlighting
}
```

**connections.json** — each edge:
```jsonc
{
  "from": "vpc_core",
  "to": "vpc_vsi",
  "kind": "native",          // native | platform | optional
  "mechanism": "some_slug",  // internal, not displayed
  "lane": "compute",         // must match a category id
  "status": "ga",
  "summary": "One sentence.",
  "docsUrl": "https://...",
  "sellerNote": "..."        // optional
}
```

**Validation rules** (enforced by `validate-feed.mjs`):
- `from`/`to` must be known product IDs
- No self-loops, no duplicate undirected edges
- `kind` ∈ `native | platform | optional`
- `lane` must match a known category ID
- `docsUrl` must start with `https://`

---

## Known gotchas

| Gotcha | Detail |
|--------|--------|
| **Python environment** | `mise run fetch-profiles` uses `.venv/bin/python3` explicitly. The mise-managed Python (`mise run python`) does NOT have the ibm-vpc packages. Always use `.venv/bin/python3 scripts/fetch-profiles.py` directly if mise task fails. |
| **BMS capacity 409** | `GET /v1/bare_metal_server/capacities` returns 409 if no VPC resources exist in the region ("zone map not assigned"). User has created `cap-probe-*` VPCs in all 13 regions to fix this. |
| **BMS zones[] field** | Only present in API responses when using API version ≥ `2026-08-04`. Fetcher sets version to `max(today-3days, "2026-08-04")`. |
| **Capacity endpoint + SDK** | The ibm-vpc Python SDK is unreliable for the capacity endpoint — use direct `httpx` REST call with the IAM token from `authenticator.token_manager.get_token()`. |
| **images.json pager** | Use `ImagesPager(status=['available'])` — passing `status='available'` (string) returns 0 results in some SDK versions. |
| **images.json architecture** | `image.architecture` is NOT a top-level field — it lives at `image.operating_system.architecture`. Filter to `'amd64'` in the fetcher. |
| **BMS region filter bug (fixed)** | `renderBmsProfiles()` — zone columns are derived via `visibleZones = allZones.filter(z => z.startsWith(activeRegion + '-'))`. Do NOT rebuild zone list from `capacity_by_region` entries (only zones with data would appear). Always collect from `p.zones[]` first, then filter by prefix. |
| **File serving** | Must be served via HTTP (`python3 -m http.server 4173`). Opening `index.html` as `file://` breaks all `fetch()` calls. |
| **IBM Cloud Logs** | IBM Log Analysis and Activity Tracker are deprecated — the current unified service is **IBM Cloud Logs**. `platform` lane reflects this. |

---

## Current state (as of last session)

- All 7 lanes fully populated: 33 products, 73 connections
- Profiles tab: VSI sub-tab (260 profiles, sortable, family filter) + BMS sub-tab (31 profiles, region filter bar + zone capacity columns) — all working
- OS Matrix tab: image catalogue table (55 images, 10 families, version chips)
- Grid view: search, OS filter, sidebar (value/questions/differentiators/competitors/docs), URL hash permalinks
- Live data last fetched: Oct 1 2026, 5:03 PM — all 13 regions in `capacity_by_region`
- BMS region filter bug (zone columns not scoping to selected region) — **fixed in last session**
- Deployed on Vercel: auto-deploys on push to `main`

## Next likely tasks

- Re-run `mise run fetch-profiles` periodically to refresh capacity / profile data
- Clean up `cap-probe-*` VPCs if no longer needed (or keep for periodic re-fetches)
- Add new products/connections as VPC services evolve
- Any data change: run `mise run validate` (must be 0 errors, 0 warnings) before committing
