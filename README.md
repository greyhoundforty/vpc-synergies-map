# IBM Cloud VPC Synergies Map

Seller-facing map of IBM Cloud VPC services, integrations, and discovery guidance. Zero-dependency static SPA, deployed on [Vercel](https://vpc-synergies-map.vercel.app).

## Views

| Tab | URL | What it shows |
|-----|-----|----------------|
| **Map** (default) | `/` | Radial map: VPC Core hub, six lane arcs (Compute, Networking, Storage, Security & Compliance, Connectivity, IBM Cloud Platform), and service labels on spokes. Click a hub or service for the sidebar. |
| **Architecture** | `/#architecture` | Reference architecture diagram with selectable nodes and the same product sidebar. |
| **Network** | `/#network` | Network topology / path view for tracing VPC networking relationships. |

Search filters the Map. Selecting a service dims everything except connected nodes and opens the sidebar (value prop, discovery questions, differentiators, competitors, integrations, docs).

## Run locally

Must be served over HTTP (not `file://`) so JSON fetches succeed:

```bash
mise run dev          # validates data/vpc/*.json, then serves at http://localhost:4173
# or:
node scripts/validate-feed.mjs data/vpc && python3 -m http.server 4173
```

```bash
mise run validate     # data check only — expect 0 errors, 0 warnings before committing
```

## Project layout

```
index.html      app shell (view tabs)
css/app.css     Carbon tokens, themes, map / architecture / network styles
js/app.js       all app logic (vanilla ES modules)
data/vpc/       plays.json, products.json, connections.json (+ optional live feeds)
scripts/        validate-feed.mjs, fetch-profiles.py
```

## Live data (optional)

`data/vpc/profiles.json` and `data/vpc/images.json` can be refreshed from the IBM VPC API; they are not used by the current UI tabs:

```bash
mise run fetch-profiles   # requires IBMCLOUD_API_KEY; uses .venv/bin/python3
```
