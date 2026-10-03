/**
 * IBM Cloud VPC Synergies Map — app.js
 * Zero-dependency vanilla ES module. All rendering driven by data/vpc/*.json.
 */

// Category IDs that appear as integration columns in Grid view
// (everything except the hub lane "vpc")
const GRID_INTEGRATION_CATS = [
  'compute',
  'networking',
  'storage',
  'security',
  'connectivity',
  'platform',
];

// ── State ─────────────────────────────────────────────────────────────────────
const state = {
  plays:        null,
  products:     null,
  connections:  null,
  profiles:     null,   // { vsi_profiles, bms_profiles, regions, fetched_at }
  images:       null,   // { images, region, fetched_at }
  viewMode:          'grid', // 'grid' | 'matrix' | 'profiles' | 'availability' | 'network'
  activeId:          null,
  netSelected:       null,   // selected node id in network view
  integrationFilter: null,   // unused but kept for compat
  osFilter:     'all',
  query:        '',
  profilesTab:  'vsi',  // 'vsi' | 'bms'
  profileFamily:'all',  // active family filter in profiles view
  vsiGenFilter: 'all',  // active generation filter in VSI tab ('all'|'2'|'3'|'4'|'flex')
  vsiProfileFilter: 'all', // active specific profile filter in VSI tab
  vsiFlexOnly:  false,  // kept for compat but replaced by vsiGenFilter
  expandedVsiGens: new Set(), // gen keys explicitly expanded/collapsed in VSI table
  bmsRegion:   'all',  // active region filter in BMS tab
  availFamilyFilter: 'all',  // active family filter in Bare Metal Availability view
  availProfileFilter: 'all', // active profile filter in Bare Metal Availability view
  availRegionFilter: 'all',  // active region filter in Bare Metal Availability view ('all' or e.g. 'eu-de')
  expandedRegions: new Set(), // set of expanded region IDs in Bare Metal view
};

// ── Colour helpers ────────────────────────────────────────────────────────────
function laneColor(playId) {
  return `var(--play-${playId})`;
}
function laneMuted(playId) {
  return `var(--play-${playId}-muted)`;
}
function catToPlayId(cat) {
  const cats = state.plays?.categories ?? [];
  const entry = cats.find(c => c.id === cat);
  return entry ? entry.playId : 0;
}

// ── Data loading ──────────────────────────────────────────────────────────────
async function load() {
  const base = 'data/vpc';
  const [playsRes, productsRes, connsRes, profilesRes, imagesRes] = await Promise.all([
    fetch(`${base}/plays.json`),
    fetch(`${base}/products.json`),
    fetch(`${base}/connections.json`),
    fetch(`${base}/profiles.json`),
    fetch(`${base}/images.json`),
  ]);
  if (!playsRes.ok || !productsRes.ok || !connsRes.ok) {
    throw new Error('Failed to load one or more data files.');
  }
  state.plays       = await playsRes.json();
  state.products    = await productsRes.json();
  state.connections = await connsRes.json();

  // Profiles and images are optional — degrade gracefully if absent
  if (profilesRes.ok) state.profiles = await profilesRes.json();
  if (imagesRes.ok)   state.images   = await imagesRes.json();
}


// ── Search ────────────────────────────────────────────────────────────────────
function matchesQuery(p, q) {
  if (!q) return false;
  const s = q.toLowerCase();
  const fields = [
    p.label, p.desc, p.value,
    ...(p.questions       ?? []),
    ...(p.differentiators ?? []),
    ...(p.competitors     ?? []),
  ];
  return fields.some(f => f && f.toLowerCase().includes(s));
}

// ── OS filter ─────────────────────────────────────────────────────────────────
// In the matrix the OS key is the image family key (ubuntu, rhel, windows, …)
// Products still use broad os:["linux","windows"] tags — map accordingly
const OS_FAMILY_TO_TAG = {
  ubuntu:  'linux', debian: 'linux', rhel:    'linux',
  rocky:   'linux', centos: 'linux', fedora:  'linux',
  other:   'linux', windows: 'windows',
};

function matchesOs(p) {
  if (state.osFilter === 'all') return true;
  if (!p.os || p.os.length === 0) return true; // OS-agnostic stays visible
  const tag = OS_FAMILY_TO_TAG[state.osFilter] ?? state.osFilter;
  return p.os.includes(tag);
}

// ── Integration view pillar → category mapping ────────────────────────────────
const PILLAR_CATS = {
  compute:     ['compute'],
  networking:  ['networking', 'connectivity'],
  storage:     ['storage'],
  security:    ['security'],
  platform:    ['platform'],
};

// ── Card state classes ────────────────────────────────────────────────────────
function cardClasses(p) {
  const classes = ['card'];
  if (p.hub) classes.push('is-hub');
  if (state.activeId && state.activeId === p.id) classes.push('is-active');

  if (state.viewMode === 'integration') {
    if (state.integrationFilter === null) {
      // Nothing selected — hub stays full, everything else dimmed
      classes.push(p.hub ? 'is-highlighted' : 'is-dimmed');
    } else {
      const allowedCats = PILLAR_CATS[state.integrationFilter] ?? [];
      if (p.hub || allowedCats.includes(p.cat)) {
        classes.push('is-highlighted');
      } else {
        classes.push('is-dimmed');
      }
    }
    return classes.join(' ');
  }

  if (state.query) {
    classes.push(matchesQuery(p, state.query) ? 'is-query-hit' : 'is-dimmed');
  } else if (state.activeId && state.activeId !== p.id) {
    // Dim cards not connected to the active node
    const connected = getConnectedIds(state.activeId);
    classes.push(connected.has(p.id) ? 'is-highlighted' : 'is-dimmed');
  } else if (state.osFilter !== 'all') {
    classes.push(matchesOs(p) ? 'is-highlighted' : 'is-dimmed');
  }

  return classes.join(' ');
}

function getConnectedIds(id) {
  const set = new Set();
  for (const c of state.connections) {
    if (c.from === id) set.add(c.to);
    if (c.to   === id) set.add(c.from);
  }
  return set;
}

// ── Badge HTML ────────────────────────────────────────────────────────────────
function badgeHtml(status) {
  if (status === 'partner')     return '<span class="badge badge-partner">Partner</span>';
  if (status === 'restricted')  return '<span class="badge badge-restricted">Existing clients</span>';
  if (status === 'coming_soon') return '<span class="badge badge-coming-soon">Coming soon</span>';
  if (status === 'deprecated')  return '<span class="badge badge-deprecated">Deprecated</span>';
  return '';
}

// ── Card HTML ─────────────────────────────────────────────────────────────────
function cardHtml(p) {
  const playId = catToPlayId(p.cat);
  const color  = laneColor(playId);
  const muted  = laneMuted(playId);
  return `
    <div class="${cardClasses(p)}"
         data-id="${p.id}"
         style="--lane-color:${color}; --lane-color-muted:${muted}">
      <div class="card-label">${p.label}</div>
      ${badgeHtml(p.status)}
    </div>`;
}

// ── Carbon icon SVG paths (32px) for network nodes ────────────────────────────
// Source: @carbon/icons@11.89.0 (Apache 2.0)
const NET_ICONS = {
  // IBM Cloud service-specific icons
  vpc_core:             '<path d="m23.4141,22-13.4141-13.4141V2H2v8h6.5859l13.4141,13.4141v6.5859h8v-8h-6.5859ZM8,8H4V4h4v4Zm20,20h-4v-4h4v4Z"/><path d="m30,6c0-2.2056-1.7944-4-4-4-1.8584,0-3.4106,1.2798-3.8579,3h-9.1421v2h9.1421c.3638,1.3989,1.4592,2.4941,2.8579,2.8579v9.1421h2v-9.1421c1.7202-.4473,3-1.9995,3-3.8579Zm-4,2c-1.103,0-2-.8975-2-2s.897-2,2-2,2,.8975,2,2-.897,2-2,2Z"/>',
  transit_gateway:      '<path d="m12.5,7.5-1.4-1.4,3.5-3.5c.8-.8,2.1-.8,2.8,0l3.5,3.5-1.4,1.4-3.5-3.5-3.5,3.5Z"/><path d="m19.5,24.5,1.4,1.4-3.5,3.5c-.8.8-2.1.8-2.8,0l-3.5-3.5,1.4-1.4,3.5,3.5,3.5-3.5Z"/><path d="M16,11a5,5,0,1,0,5,5A5,5,0,0,0,16,11Zm0,8a3,3,0,1,1,3-3A3,3,0,0,1,16,19Z"/><path d="M4,13H6V15H4zM26,13H28V15H26zM4,17H6V19H4zM26,17H28V19H26zM13,4H15V6H13zM17,4H19V6H17zM13,26H15V28H13zM17,26H19V28H17z"/>',
  subnets:              '<path d="M26,22a3.6069,3.6069,0,0,0-2,.6L19.4143,18,18,19.4141,22.6,24a4.1755,4.1755,0,0,0-.4,1H9.8583A3.5525,3.5525,0,0,0,9.4,24L24,9.4a3.6069,3.6069,0,0,0,2,.6,4,4,0,1,0-3.8569-5H9.9A4.0785,4.0785,0,0,0,6,2a4,4,0,0,0,0,8,3.6066,3.6066,0,0,0,2-.6L12.5858,14,14,12.5859,9.4,8a4.175,4.175,0,0,0,.4-1H22.1418A3.5553,3.5553,0,0,0,22.6,8L8,22.6A3.6066,3.6066,0,0,0,6,22a4,4,0,1,0,3.8569,5H22.1A4.0118,4.0118,0,1,0,26,22ZM26,4a2,2,0,1,1-2,2A2.0058,2.0058,0,0,1,26,4ZM6,8A2,2,0,1,1,8,6,2.0058,2.0058,0,0,1,6,8ZM6,28a2,2,0,1,1,2-2A2.0058,2.0058,0,0,1,6,28Zm20,0a2,2,0,1,1,2-2A2.0058,2.0058,0,0,1,26,28Z"/>',
  security_groups:      '<path d="M22.86,25.86c-.72.75-1.54,1.42-2.46,1.94l-5.4,3.2-5.5-3.2c-3.4-2-5.5-5.6-5.5-9.5V4c0-1.1.9-2,2-2h18c1.1,0,2,.9,2,2v5h-2v-5H6v14.3c0,3.2,1.7,6.2,4.5,7.8l4.5,2.7,4.5-2.7c.73-.47,1.41-.99,2-1.6ZM28,12H18v2h10v-2ZM28,20H18v2h10v-2ZM30,16H20v2h10v-2Z"/>',
  network_acls:         '<path d="M18,28H14a2,2,0,0,1-2-2V18.41L4.59,11A2,2,0,0,1,4,9.59V6A2,2,0,0,1,6,4H26a2,2,0,0,1,2,2V9.59A2,2,0,0,1,27.41,11L20,18.41V26A2,2,0,0,1,18,28ZM6,6V9.59l8,8V26h4V17.59l8-8V6Z"/>',
  flow_logs:            '<path d="M18 19H30V21H18z"/><path d="M18 23H30V25H18z"/><path d="M2,28H4V26H2V6H4V4H2A2,2,0,0,0,0,6V26A2,2,0,0,0,2,28Z"/><path d="M6,4H8V6H6zM6,10H8V12H6zM6,16H8V18H6zM6,22H8V24H6z"/><path d="M10 4H30V6H10z"/><path d="M10 10H16V12H10z"/><path d="M10 16H16V18H10z"/><path d="M10 22H16V24H10z"/>',
  vpe:                  '<path d="M20,27H7a2.0059,2.0059,0,0,1-2-2V12H7V25H20Z"/><path d="M23.4,22l-4-4a3.6057,3.6057,0,0,0,.6-2,4.0118,4.0118,0,0,0-4-4,3.6057,3.6057,0,0,0-2,.6l-4-4V2H2v8H8.6l4,4a3.6057,3.6057,0,0,0-.6,2,4.0118,4.0118,0,0,0,4,4,3.6057,3.6057,0,0,0,2-.6l4,4V30h8V22ZM8,8H4V4H8Zm8,10a2,2,0,1,1,2-2A2.0059,2.0059,0,0,1,16,18ZM28,28H24V24h4Z"/>',
  cis:                  '<path d="M27,22c-.7,0-1.4.3-1.9.7l-5.2-3.1c0-.2.1-.4.1-.6s0-.4-.1-.6l5.2-3.1c.5.4,1.2.7,1.9.7,1.7,0,3-1.3,3-3s-1.3-3-3-3-3,1.3-3,3c0,.2,0,.4.1.6l-5.2,3.1C18.4,16.3,17.7,16,17,16c-1.7,0-3,1.3-3,3s1.3,3,3,3c.7,0,1.4-.3,1.9-.7l5.2,3.1c0,.2-.1.4-.1.6,0,1.7,1.3,3,3,3s3-1.3,3-3-1.3-3-3-3ZM27,12c.6,0,1,.4,1,1s-.4,1-1,1-1-.4-1-1,.4-1,1-1Zm-10,8c-.6,0-1-.4-1-1s.4-1,1-1,1,.4,1,1-.4,1-1,1Zm10,6c-.6,0-1-.4-1-1s.4-1,1-1,1,.4,1,1-.4,1-1,1Z"/><path d="M19,25H8.5c-3,0-5.5-2.5-5.5-5.5,0-2.7,1.9-4.9,4.5-5.4l1.3-.2.3-1.3C9.9,8.7,13.2,6,17,6c.5,0,1,0,1.5.1,1.6.3,3,1.1,4.2,2.2l1.4-1.4C22.7,5.5,20.9,4.5,18.9,4.2,18.3,4.1,17.6,4,17,4c-4.7,0-8.9,3.3-9.8,8.1C3.6,12.8,1,15.9,1,19.5,1,23.6,4.3,27,8.5,27H19V25Z"/>',
  direct_link:          '<path d="M32,11h-3V5c0-1.1-.9-2-2-2H13c-1.1,0-2,.9-2,2v4h2V5h14v14H13v-4h-2v4c0,1.1.9,2,2,2h14c1.1,0,2-.9,2-2v-6h3V11Z"/><path d="M21,17v-4c0-1.1-.9-2-2-2H5c-1.1,0-2,.9-2,2v6H0v2h3v6c0,1.1.9,2,2,2h14c1.1,0,2-.9,2-2v-4h-2v4H5V13h14v4h2Z"/>',
  vpn_s2s:              '<path d="M16,29c-.373,0-.7151-.2076-.8872-.5386l-2.0801-4,1.7744-.9229,1.1929,2.2939,4.3127-8.2938,1.7744.9226-5.2,10c-.1721.3311-.5142.5387-.8872.5387Z"/><path d="M11,15.2783v-2.2783c0-2.2056-1.7944-4-4-4s-4,1.7944-4,4v2.2783c-.595.3467-1,.9849-1,1.7217v5c0,1.1025.897,2,2,2h6c1.103,0,2-.8975,2-2v-5c0-.7368-.405-1.375-1-1.7217Zm-4-4.2783c1.103,0,2,.8975,2,2v2H5v-2c0-1.1025.897-2,2-2Zm3,11H4v-5h6v5Z"/><path d="M29,5h-4c-1.654,0-3,1.346-3,3v2h-1v8h9V10h-1v-2c0-.552.449-1,1-1h4V5Zm-5,5v-2c0-.552.449-1,1-1s1,.449,1,1v2h-2Zm3,5h-5v-3h5v3Z"/>',
  vpn_c2s:              '<path d="M16,2C8.3,2,2,8.3,2,16s6.3,14,14,14h1V2h-1ZM15,4v11h-5c.2-4.2,1.9-8.1,4.8-10.9h.2v-.1ZM15,17v11h-.2c-2.9-2.8-4.6-6.7-4.8-10.9h5v-.1ZM11.5,4.9c-2.1,2.9-3.3,6.4-3.5,10.1h-4c.4-4.6,3.4-8.5,7.5-10.1ZM4,17h4c.2,3.7,1.4,7.2,3.5,10.1-4.1-1.7-7.1-5.5-7.5-10.1ZM29,23h-1v-2c0-1.7-1.3-3-3-3s-3,1.3-3,3v2h-1c-.6,0-1,.4-1,1v5c0,.6.4,1,1,1h8c.6,0,1-.4,1-1v-5c0-.6-.4-1-1-1ZM24,21c0-.6.4-1,1-1s1,.4,1,1v2h-2v-2ZM28,28h-6v-3h6v3ZM25,8c1.7,0,3-1.3,3-3s-1.3-3-3-3-3,1.3-3,3,1.3,3,3,3ZM25,4c.6,0,1,.4,1,1s-.4,1-1,1-1-.4-1-1,.4-1,1-1ZM25,14c.6,0,1,.4,1,1s-.4,1-1,1-1-.4-1-1,.4-1,1-1ZM25,10c.6,0,1,.4,1,1s-.4,1-1,1-1-.4-1-1,.4-1,1-1Z"/>',
  vpc_peering:          '<path d="M23.4141,22,10,8.5859V2H2v8H8.5859L22,23.4141V30h8V22ZM8,8H4V4H8ZM28,28H24V24h4Z"/><path d="M30,6a3.9915,3.9915,0,0,0-7.8579-1H13V7h9.1421A3.9945,3.9945,0,0,0,25,9.8579V19h2V9.8579A3.9962,3.9962,0,0,0,30,6ZM26,8a2,2,0,1,1,2-2A2.0023,2.0023,0,0,1,26,8Z"/>',
  floating_ip:          '<path d="M25,11a5.0083,5.0083,0,0,0-4.8989,4H11.8989a5,5,0,1,0,0,2h8.2022A5,5,0,1,0,25,11Zm0,8a3,3,0,1,1,3-3A3.0033,3.0033,0,0,1,25,19Z"/><circle cx="7" cy="16" r="3"/>',
  public_address_ranges:'<path d="M22.5,13c-4.7,0-8.5,3.8-8.5,8.5s3.8,8.5,8.5,8.5,8.5-3.8,8.5-8.5-3.8-8.5-8.5-8.5Zm6.5,8H26c0-2-.3-4-.9-5.5,2.1,1.5,3.7,3.5,3.9,5.5Zm-6.5,7c0,0,0,0,0,0-.4-.2-1.3-1.8-1.5-5h2.9c-.2,3.2-1,4.8-1.4,5Zm-1.5-7c.1-3.8,1.1-5.8,1.4-6,0,0,0,0,0,0,.4.2,1.4,2.2,1.5,6h-2.9Zm-1.1-5.5c-.6,1.5-.8,3.5-.9,5.5h-3c.2-2.5,1.8-4.5,3.9-5.5Zm-3.9,7.5h3c.1,1.6.4,3.2.9,4.5-2-.8-3.4-2.5-3.9-4.5Zm8.5,4.5c.5-1.3.8-2.8.9-4.5h2.9c-.6,2-2,3.7-3.8,4.5Z"/><path d="M25.8,10c-.9-4.6-5-8-9.8-8-4.8,0-8.9,3.4-9.8,8.1-3.5.7-6.2,3.7-6.2,7.4,0,4.1,3.4,7.5,7.5,7.5H11v-2h-3.5c-3,0-5.5-2.5-5.5-5.5,0-2.9,2.2-5.3,5.1-5.5l.9-.1.1-.9c.5-4,3.9-7.1,8-7.1,3.7,0,6.8,2.6,7.7,6h2.1Z"/>',
  nlb:                  '<path d="M8,30H2V24H8ZM4,28H6V26H4Z"/><path d="M19,30H13V24h6Zm-4-2h2V26H15Z"/><path d="M30,30H24V24h6Zm-4-2h2V26H26Z"/><path d="M25,22H7v-4H9V20h14V18h2v4Z"/><path d="M17,18H15V8H7V6H25V8H17Z"/><path d="M4,8H2V2H8V4H4Z"/><path d="M30,8H26V6H28V4H24V2H30Z"/><path d="M8,4H16V6H8z"/>',
  alb:                  '<path d="M4,26H8V30H4Zm10,0h4v4H14Zm10,0h4v4H24Z"/><path d="M25,22H7v-4H9V20H23V18h2v4Z"/><path d="M17,18H15V8H7V6H25V8H17Z"/><path d="M4,2H8V6H4Zm20,0h4V6H24Z"/>',
  // Secure/Public intent icons
  _intent_secure:       '<path d="M24,14H22V8A6,6,0,0,0,10,8v6H8a2,2,0,0,0-2,2V28a2,2,0,0,0,2,2H24a2,2,0,0,0,2-2V16A2,2,0,0,0,24,14ZM12,8a4,4,0,0,1,8,0v6H12ZM24,28H8V16H24Z"/>',
  _intent_public:       '<path d="M28,11a13.9563,13.9563,0,0,0-4.1051-9.8949L22.4813,2.5187A11.9944,11.9944,0,0,1,5.5568,19.5194l-.0381-.0381L4.1051,20.8949A13.9563,13.9563,0,0,0,14,25v3H10v2H20V28H16V24.84A14.0094,14.0094,0,0,0,28,11Z"/><path d="M14,4a7,7,0,1,1-7,7,7,7,0,0,1,7-7m0-2a9,9,0,1,0,9,9A9,9,0,0,0,14,2Z"/>',
  cbr:                  '<path d="M18,28H14a2,2,0,0,1-2-2V18.41L4.59,11A2,2,0,0,1,4,9.59V6A2,2,0,0,1,6,4H26a2,2,0,0,1,2,2V9.59A2,2,0,0,1,27.41,11L20,18.41V26A2,2,0,0,1,18,28ZM6,6V9.59l8,8V26h4V17.59l8-8V6Z"/>',
};

function netIconSvg(id) {
  const paths = NET_ICONS[id];
  if (!paths) return '';
  return `<svg class="net-card-icon" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" fill="currentColor">${paths}</svg>`;
}

// ── Network view — curated VPC connection-flow layout ─────────────────────────
// Structure mirrors the PVS Synergy Map network tab exactly:
//   Row 0  VPC Workload      — the hub anchor
//   Row 1  Connection Intent — "Secure Connections" toggle vs. "Public Connections" toggle
//   Row 2  Entry Mechanism   — entry services, coloured by which intent(s) they belong to
//   Row 3  Routing & Gateway — Transit Gateway · Subnets · VPE
//   Row 4  Security Controls — Network ACLs · Security Groups · Flow Logs · CBR
//
// Row 1 intent nodes are synthetic (no products.json match); all other nodes
// map to real product IDs.  NET_EDGES drives highlight propagation.

const NET_NODES = [
  // ── Row 0 — VPC Workload anchor ──────────────────────────────────────────
  {
    id: 'vpc_core', row: 0,
    sub: 'Your IBM Cloud VPC environment',
    color: 'var(--play-0)',
  },

  // ── Row 1 — Connection Intent (synthetic toggle nodes) ───────────────────
  {
    id: '_intent_secure', row: 1,
    label: 'Secure Connections',
    sub: 'Private / dedicated path',
    color: 'var(--play-3)',   // teal — matches PVS
  },
  {
    id: '_intent_public', row: 1,
    label: 'Public Connections',
    sub: 'Internet-facing path',
    color: 'var(--play-8)',   // orange — matches PVS
  },

  // ── Row 2 — Entry Mechanism (secure side) ────────────────────────────────
  {
    id: 'direct_link', row: 2,
    sub: 'Dedicated private WAN · bypasses public Internet',
    color: 'var(--play-3)',
  },
  {
    id: 'vpn_s2s', row: 2,
    sub: 'IPsec site-to-site · on-prem or another VPC',
    color: 'var(--play-3)',
  },
  {
    id: 'vpn_c2s', row: 2,
    sub: 'OpenVPN client-to-site · remote users / branch',
    color: 'var(--play-3)',
  },
  {
    id: 'vpc_peering', row: 2,
    sub: 'Direct VPC-to-VPC · no Transit Gateway required',
    color: 'var(--play-3)',
  },

  // ── Row 2 — Entry Mechanism (public side) ────────────────────────────────
  {
    id: 'floating_ip', row: 2,
    sub: 'Native VPC · portable public IPv4 · direct inbound',
    color: 'var(--play-8)',
  },
  {
    id: 'public_address_ranges', row: 2,
    sub: 'Native VPC · contiguous public block · ingress routing',
    color: 'var(--play-8)',
  },
  {
    id: 'nlb', row: 2,
    sub: 'Native VPC · Layer-4 TCP/UDP · static IP',
    color: 'var(--play-8)',
  },
  {
    id: 'alb', row: 2,
    sub: 'Native VPC · Layer-7 HTTP/HTTPS · TLS termination',
    color: 'var(--play-8)',
  },
  {
    id: 'cis', row: 2,
    sub: 'External IBM Cloud service · WAF / DDoS / CDN edge',
    color: 'var(--play-8)',
  },

  // ── Row 3 — Routing & Gateway ─────────────────────────────────────────────
  {
    id: 'transit_gateway', row: 3,
    sub: 'Hub-and-spoke · connects VPCs, Direct Link, VPN',
    color: 'var(--play-5)',
  },
  {
    id: 'subnets', row: 3,
    sub: 'Zone-scoped CIDRs · implicit intra-VPC routing',
    color: 'var(--play-2)',
  },
  {
    id: 'vpe', row: 3,
    sub: 'Private access to IBM Cloud services · no public egress',
    color: 'var(--play-2)',
  },

  // ── Row 4 — Security Controls ─────────────────────────────────────────────
  {
    id: 'network_acls', row: 4,
    sub: 'Subnet-level · stateless · ordered rules',
    color: 'var(--play-4)',
  },
  {
    id: 'security_groups', row: 4,
    sub: 'Instance-level · stateful · VNI-attached',
    color: 'var(--play-4)',
  },
  {
    id: 'flow_logs', row: 4,
    sub: 'Traffic metadata · COS storage · forensics',
    color: 'var(--play-4)',
  },
  {
    id: 'cbr', row: 4,
    sub: 'API access control · network-context rules',
    color: 'var(--play-4)',
  },
];

// Logical data-path edges — drives ancestor/descendant highlight propagation.
// Intent nodes (_intent_secure / _intent_public) fan out to their entry mechanisms.
const NET_EDGES = [
  // hub → intent
  { from: 'vpc_core',        to: '_intent_secure'       },
  { from: 'vpc_core',        to: '_intent_public'       },

  // secure intent → entry mechanisms
  { from: '_intent_secure',  to: 'direct_link'          },
  { from: '_intent_secure',  to: 'vpn_s2s'              },
  { from: '_intent_secure',  to: 'vpn_c2s'              },
  { from: '_intent_secure',  to: 'vpc_peering'          },

  // public intent → entry mechanisms
  { from: '_intent_public',  to: 'floating_ip'          },
  { from: '_intent_public',  to: 'public_address_ranges'},
  { from: '_intent_public',  to: 'nlb'                  },
  { from: '_intent_public',  to: 'alb'                  },
  { from: '_intent_public',  to: 'cis'                  },

  // entry mechanisms → routing layer
  { from: 'direct_link',          to: 'transit_gateway' },
  { from: 'vpn_s2s',              to: 'transit_gateway' },
  { from: 'vpn_c2s',              to: 'transit_gateway' },
  { from: 'vpc_peering',          to: 'subnets'         },
  { from: 'floating_ip',          to: 'subnets'         },
  { from: 'public_address_ranges',to: 'subnets'         },
  { from: 'nlb',                  to: 'subnets'         },
  { from: 'alb',                  to: 'subnets'         },
  { from: 'cis',                  to: 'alb'             }, // CIS sits in front of ALB
  { from: 'transit_gateway',      to: 'subnets'         },

  // routing → security controls
  { from: 'subnets',         to: 'network_acls'         },
  { from: 'subnets',         to: 'security_groups'      },
  { from: 'subnets',         to: 'flow_logs'            },
  { from: 'subnets',         to: 'vpe'                  },
  { from: 'vpe',             to: 'security_groups'      },
  { from: 'vpc_core',        to: 'cbr'                  },
];

const NET_ROW_LABELS = [
  'VPC Workload',
  'Connection Intent',
  'Entry Mechanism',
  'Routing & Gateway',
  'Security Controls',
];

// Given a clicked node, collect all nodes that should light up
// (ancestors + descendants via NET_EDGES).
function netReachable(clickedId) {
  const reachable = new Set([clickedId]);

  // Walk descendants
  const queue = [clickedId];
  while (queue.length) {
    const cur = queue.shift();
    for (const e of NET_EDGES) {
      if (e.from === cur && !reachable.has(e.to)) {
        reachable.add(e.to);
        queue.push(e.to);
      }
    }
  }

  // Walk ancestors
  const aQueue = [clickedId];
  const visited = new Set([clickedId]);
  while (aQueue.length) {
    const cur = aQueue.shift();
    for (const e of NET_EDGES) {
      if (e.to === cur && !visited.has(e.from)) {
        visited.add(e.from);
        reachable.add(e.from);
        aQueue.push(e.from);
      }
    }
  }

  return reachable;
}

function applyNetworkHighlights() {
  const area = document.getElementById('net-area');
  if (!area) return;
  const sel = state.netSelected;
  const reachable = sel ? netReachable(sel) : null;
  area.querySelectorAll('.net-card').forEach(card => {
    const id = card.dataset.id;
    const isSelected  = id === sel;
    const isReachable = reachable ? reachable.has(id) : false;
    card.classList.toggle('is-selected', isSelected);
    card.classList.toggle('is-reachable', !isSelected && isReachable);
    card.classList.toggle('is-dimmed', Boolean(reachable && !isReachable));
  });
}

function renderNetwork() {
  // Build a product lookup by id for label/status/desc
  const productById = new Map((state.products ?? []).map(p => [p.id, p]));

  // Group NET_NODES by row
  const rows = {};
  for (const n of NET_NODES) {
    if (!rows[n.row]) rows[n.row] = [];
    rows[n.row].push(n);
  }
  const maxRow = Math.max(...NET_NODES.map(n => n.row));

  let html = `<div class="net-area" id="net-area">`;
  html += `<p class="net-hint">Click any node to trace its connection path</p>`;

  const sel = state.netSelected;
  const reachable = sel ? netReachable(sel) : null;

  for (let r = 0; r <= maxRow; r++) {
    const rowNodes = rows[r] ?? [];
    if (!rowNodes.length) continue;

    html += `<div class="net-row" data-row="${r}">`;
    html += `<div class="net-row-label">${NET_ROW_LABELS[r] ?? `Row ${r}`}</div>`;
    html += `<div class="net-row-cards">`;

    for (const n of rowNodes) {
      const isIntent = n.id.startsWith('_intent_');
      const p        = productById.get(n.id);
      const label    = n.label ?? p?.label ?? n.id;
      const status   = p?.status ?? 'ga';
      const isSel    = sel === n.id;
      const isDimmed  = reachable && !reachable.has(n.id);
      const isReach   = reachable && !isSel && reachable.has(n.id);

      const classes = ['net-card',
        isIntent ? 'net-card--intent' : '',
        isSel    ? 'is-selected'      : '',
        isReach  ? 'is-reachable'     : '',
        isDimmed ? 'is-dimmed'        : '',
      ].filter(Boolean).join(' ');

      html += `
        <div class="${classes}" data-id="${n.id}" style="--net-color:${n.color}">
          ${netIconSvg(n.id)}
          <div class="net-card-body">
            <div class="net-card-label">${label}</div>
            <div class="net-card-sub">${n.sub}</div>
          </div>
          ${isIntent ? '' : badgeHtml(status)}
        </div>`;
    }

    html += `</div></div>`;
  }

  html += `<div class="net-stats">${NET_NODES.length} nodes · ${NET_EDGES.length} path edges · click to trace</div>`;
  html += `</div>`;
  return html;
}


function renderIntegration() {
  const cats    = state.plays?.categories ?? [];
  const active  = state.integrationFilter;

  // Hub products
  const hubProducts = state.products.filter(p => p.cat === 'vpc');

  // ── Pillar buttons ──
  let pillarsHtml = '';
  for (const pillar of PILLARS) {
    const isActive = active === pillar.id;
    pillarsHtml += `
      <button class="int-pillar ${isActive ? 'is-active' : ''}"
              style="--pillar-color:var(${pillar.playVar})"
              data-pillar="${pillar.id}">
        ${pillar.label}
      </button>`;
  }

  // ── Service cards grouped per pillar ──
  // Show all pillars' cards stacked under each pillar header
  let columnsHtml = '';
  for (const pillar of PILLARS) {
    const pillarCats  = PILLAR_CATS[pillar.id];
    const products    = state.products.filter(p => pillarCats.includes(p.cat));
    const isActive    = active === pillar.id;

    let cardsHtml = '';
    for (const p of products) {
      const playId = catToPlayId(p.cat);
      const color  = laneColor(playId);
      const muted  = laneMuted(playId);
      cardsHtml += `
        <div class="${cardClasses(p)}"
             data-id="${p.id}"
             style="--lane-color:${color}; --lane-color-muted:${muted}">
          <div class="card-label">${p.label}</div>
          ${badgeHtml(p.status)}
        </div>`;
    }

    columnsHtml += `
      <div class="int-column ${isActive ? 'is-active' : ''}"
           style="--pillar-color:var(${pillar.playVar})">
        <div class="int-column-header">${pillar.label}</div>
        <div class="int-column-cards">${cardsHtml}</div>
      </div>`;
  }

  // ── Hub cards ──
  let hubHtml = '';
  for (const p of hubProducts) {
    const playId = catToPlayId(p.cat);
    const color  = laneColor(playId);
    const muted  = laneMuted(playId);
    hubHtml += `
      <div class="${cardClasses(p)}"
           data-id="${p.id}"
           style="--lane-color:${color}; --lane-color-muted:${muted}">
        <div class="card-label">${p.label}</div>
        ${badgeHtml(p.status)}
      </div>`;
  }

  const hint = active === null
    ? 'Select a pillar to highlight its services'
    : `Showing ${PILLARS.find(p => p.id === active)?.label ?? ''} services`;

  return `
    <div class="int-layout">
      <div class="int-hub-row">
        <div class="int-hub-block">
          <div class="int-hub-label">VPC Core</div>
          <div class="int-hub-cards">${hubHtml}</div>
          <div class="int-pillars">${pillarsHtml}</div>
          <div class="int-hint">${hint}</div>
        </div>
      </div>
      <div class="int-columns">${columnsHtml}</div>
    </div>`;
}

// ── Grid view ─────────────────────────────────────────────────────────────────
function renderGrid() {
  const cats     = state.plays.categories;
  const intCats  = GRID_INTEGRATION_CATS.filter(id => cats.find(c => c.id === id));
  const laneCount = intCats.length;

  // Hub products (vpc lane)
  const hubProducts = state.products.filter(p => p.cat === 'vpc');

  let html = `<div class="grid-layout" style="--lane-count:${laneCount}">`;

  // ── Column headers ──
  // Hub column header
  const hubCat   = cats.find(c => c.id === 'vpc');
  const hubPlay  = hubCat ? state.plays.plays[hubCat.playId] : null;
  const hubColor = hubPlay ? laneColor(hubPlay.id) : 'var(--accent)';
  const hubMuted = hubPlay ? laneMuted(hubPlay.id) : 'var(--play-0-muted)';
  html += `<div class="lane-header" style="--lane-color:${hubColor}; --lane-color-muted:${hubMuted}">${hubCat?.label ?? 'Core'}</div>`;

  for (const catId of intCats) {
    const cat   = cats.find(c => c.id === catId);
    const play  = cat ? state.plays.plays[cat.playId] : null;
    const color = play ? laneColor(play.id) : 'var(--border)';
    const muted = play ? laneMuted(play.id) : 'transparent';
    html += `<div class="lane-header" style="--lane-color:${color}; --lane-color-muted:${muted}">${cat?.label ?? catId}</div>`;
  }

  // ── Hub column ──
  html += `<div class="os-hub-column">`;
  for (const p of hubProducts) {
    html += cardHtml(p);
  }
  html += `</div>`;

  // ── Integration columns ──
  for (const catId of intCats) {
    const products = state.products.filter(p => p.cat === catId);
    html += `<div class="lane-column">`;
    for (const p of products) {
      html += cardHtml(p);
    }
    html += `</div>`;
  }

  html += `</div>`;
  return html;
}

// ── Matrix view ───────────────────────────────────────────────────────────────
const MATRIX_OS = [
  { id: 'linux',      label: 'Linux'   },
  { id: 'windows',    label: 'Windows' },
  { id: 'all',        label: 'All Services' },
];

function renderMatrix() {
  // OS Image Catalogue — rows per OS family, version chips per row
  const images = state.images?.images ?? [];

  if (!images.length) {
    return `<div class="loading-state"><p>No image data — run <code>mise run fetch-profiles</code> with <code>IBMCLOUD_API_KEY</code> set.</p></div>`;
  }

  // Group images by family, then by version within each family
  const byFamily = new Map();
  for (const img of images) {
    const family = img.os_family || 'Other';
    if (!byFamily.has(family)) byFamily.set(family, new Map());
    const ver = img.os_version || img.os_name || img.name || '—';
    if (!byFamily.get(family).has(ver)) byFamily.get(family).set(ver, []);
    byFamily.get(family).get(ver).push(img);
  }
  // Sort families: Windows last, rest alphabetical
  const families = [...byFamily.keys()].sort((a, b) => {
    if (/windows/i.test(a)) return 1;
    if (/windows/i.test(b)) return -1;
    return a.localeCompare(b);
  });

  const fetchedStr = state.images?.fetched_at
    ? new Date(state.images.fetched_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    : null;

  let html = `<div class="os-catalogue-wrap">`;
  if (fetchedStr) {
    html += `<div class="profiles-meta"><span>Catalogue fetched: <strong>${fetchedStr}</strong></span>
      <span>· ${images.length} public x86-64 images · ${families.length} OS families</span>
      <a href="https://cloud.ibm.com/docs/vpc?topic=vpc-about-images" target="_blank" rel="noopener" class="profiles-docs-link">IBM Docs ↗</a>
    </div>`;
  }

  html += `<table class="os-catalogue-table">
    <thead><tr>
      <th class="os-family-col">OS Family</th>
      <th>Available Versions</th>
      <th class="os-count-col">Images</th>
    </tr></thead>
    <tbody>`;

  for (const family of families) {
    const versionMap = byFamily.get(family);
    const versions   = [...versionMap.keys()].sort();
    const totalImgs  = [...versionMap.values()].reduce((s, a) => s + a.length, 0);

    // Decide accent colour: windows = purple, rhel/rocky/suse = red, ubuntu = orange, else teal
    let accentVar = '--play-2'; // teal (networking) as default
    if (/windows/i.test(family))                         accentVar = '--play-4'; // purple (security)
    else if (/red hat|rhel/i.test(family))               accentVar = '--play-3'; // red (storage)
    else if (/rocky|centos|suse/i.test(family))          accentVar = '--play-3';
    else if (/ubuntu/i.test(family))                     accentVar = '--play-5'; // amber (connectivity)
    else if (/debian/i.test(family))                     accentVar = '--play-1'; // compute blue

    html += `<tr class="os-family-row">
      <td class="os-family-name" style="border-left:3px solid var(${accentVar})">${family}</td>
      <td class="os-versions-cell">${
        versions.map(ver => {
          const imgs = versionMap.get(ver);
          const names = imgs.map(i => i.name).join('\n');
          return `<span class="os-version-chip" title="${names}" style="--chip-color:var(${accentVar})">${ver}</span>`;
        }).join('')
      }</td>
      <td class="os-count-cell">${totalImgs}</td>
    </tr>`;
  }

  html += `</tbody></table></div>`;
  return html;
}

// ── Profiles view ─────────────────────────────────────────────────────────────
function renderProfiles() {
  if (!state.profiles) {
    return `<div class="loading-state">
      <p>No profiles data — run <code>mise run fetch-profiles</code> with <code>IBMCLOUD_API_KEY</code> set.</p>
    </div>`;
  }

  const { vsi_profiles, fetched_at } = state.profiles;
  const fetchedStr = fetched_at
    ? new Date(fetched_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    : 'unknown';

  let html = `<div class="profiles-wrap">`;
  html += renderVsiProfiles(vsi_profiles ?? []);
  html += `<div class="profiles-footer">
    <span>Data fetched: <strong>${fetchedStr}</strong></span>
    <a href="https://cloud.ibm.com/docs/vpc?topic=vpc-profiles" target="_blank" rel="noopener" class="profiles-docs-link">
      <span>IBM Docs</span>
      <svg width="12" height="12" viewBox="0 0 32 32" fill="currentColor" aria-hidden="true" style="vertical-align: -1px; margin-left: 2px;">
        <path d="M26 26H6V6h10V4H6c-1.1 0-2 .9-2 2v20c0 1.1.9 2 2 2h20c1.1 0 2-.9 2-2V16h-2v10z"/><path d="M20 4v2h4.6L14.3 16.3l1.4 1.4L26 7.4V12h2V4h-8z"/>
      </svg>
    </a>
  </div>`;
  html += `</div>`;
  return html;
}

function getGpuDescription(p) {
  if (!p.gpu_count) return '—';
  // Check profile name or family for GPU model
  const name = p.name || '';
  if (name.includes('gaudi3')) return `${p.gpu_count}x Gaudi 3`;
  if (name.includes('h100')) return `${p.gpu_count}x H100`;
  if (name.includes('l40s')) return `${p.gpu_count}x L40S`;
  if (name.includes('l4')) return `${p.gpu_count}x L4`;
  if (name.includes('v100')) return `${p.gpu_count}x V100`;
  if (name.includes('a100')) return `${p.gpu_count}x A100`;
  return `${p.gpu_count}x GPU`;
}

function getNormalizedVsiFamily(family) {
  if (!family) return '—';
  if (family.startsWith('gpu-') || family === 'gpu') return 'gpu';
  return family;
}

// Extract generation token from a VSI profile name.
// Returns 'flex', '2', '3', '4', or null.
function getVsiGen(name) {
  const m = (name || '').match(/^[a-z]+(\d+|f)[a-z]*-/);
  if (!m) return null;
  return m[1] === 'f' ? 'flex' : m[1];
}

function renderVsiProfiles(profiles) {
  // Normalized families for the filter dropdown (gpu-* merged → 'gpu')
  const rawFamilies = [...new Set(profiles.map(p => getNormalizedVsiFamily(p.family)).filter(Boolean))];

  // Display names for each normalized family
  const FAMILY_LABELS = {
    'balanced':        'Balanced',
    'compute':         'Compute',
    'memory':          'Memory',
    'gpu':             'GPU',
    'high-frequency':  'High Frequency',
    'high-memory':     'High Memory',
    'very-high-memory':'Very High Memory',
    'storage-optimized':'Storage Optimized',
    'nano':            'Nano',
  };
  const familyLabel = f => FAMILY_LABELS[f] ?? f;

  // Preferred display order for families
  const FAMILY_ORDER = [
    'balanced','compute','memory','gpu',
    'high-frequency','high-memory','very-high-memory','storage-optimized','nano',
  ];

  const activeFamily  = state.profileFamily;
  const activeGen     = state.vsiGenFilter;
  const activeProfile = state.vsiProfileFilter;

  // Derive available generations from the full profile list
  const allGens = [...new Set(profiles.map(p => getVsiGen(p.name)).filter(Boolean))].sort();

  // Profiles eligible for the profile dropdown given the current family selection
  const familyFiltered = activeFamily === 'all'
    ? profiles
    : profiles.filter(p => getNormalizedVsiFamily(p.family) === activeFamily);

  // Apply generation filter, then specific profile filter
  const genFiltered = activeGen === 'all'
    ? familyFiltered
    : familyFiltered.filter(p => getVsiGen(p.name) === activeGen);

  const filtered = activeProfile === 'all'
    ? genFiltered
    : genFiltered.filter(p => p.name === activeProfile);

  const preFiltered = genFiltered; // alias used for profile dropdown count

  // Does any visible profile have region data (gen4 select-availability)?
  const hasRegions = filtered.some(p => Array.isArray(p.regions));
  // Only show GPU column when at least one visible profile has GPU data
  const hasGpu = filtered.some(p => p.gpu_count);

  // Generation display labels
  const GEN_LABELS = { '2': 'Gen 2', '3': 'Gen 3', '4': 'Gen 4', 'flex': 'Flex' };
  const genLabel = g => GEN_LABELS[g] ?? `Gen ${g}`;
  const genCounts = {};
  for (const p of familyFiltered) {
    const g = getVsiGen(p.name);
    if (g) genCounts[g] = (genCounts[g] || 0) + 1;
  }

  // ── Header bar ───────────────────────────────────────────────────────────────
  const anyFilterActive = activeFamily !== 'all' || activeGen !== 'all' || activeProfile !== 'all';
  let html = `<div class="avail-header">
    <div class="avail-title">
      <strong>${rawFamilies.length} families</strong> &nbsp;·&nbsp;
      <strong>${profiles.length} total profiles</strong> &nbsp;·&nbsp;
      <strong>${filtered.length} shown</strong>
    </div>
    <div class="avail-filter-controls">
      <div class="avail-select-group">
        <label for="vsiFamilySelect" class="avail-select-label">Family</label>
        <select id="vsiFamilySelect" class="avail-select" data-vsi-family-select>
          <option value="all" ${activeFamily === 'all' ? 'selected' : ''}>All Families (${rawFamilies.length})</option>`;
  for (const f of rawFamilies) {
    html += `<option value="${f}" ${activeFamily === f ? 'selected' : ''}>${familyLabel(f)}</option>`;
  }
  html += `
        </select>
      </div>
      <div class="avail-select-group">
        <label for="vsiGenSelect" class="avail-select-label">Generation</label>
        <select id="vsiGenSelect" class="avail-select" data-vsi-gen-select>
          <option value="all" ${activeGen === 'all' ? 'selected' : ''}>All Generations (${allGens.length})</option>`;
  for (const g of allGens) {
    const cnt = genCounts[g] || 0;
    html += `<option value="${g}" ${activeGen === g ? 'selected' : ''}>${genLabel(g)} (${cnt})</option>`;
  }
  html += `
        </select>
      </div>
      <div class="avail-select-group">
        <label for="vsiProfileSelect" class="avail-select-label">Profile</label>
        <select id="vsiProfileSelect" class="avail-select" data-vsi-profile-select>
          <option value="all" ${activeProfile === 'all' ? 'selected' : ''}>All Profiles (${preFiltered.length})</option>`;
  for (const p of preFiltered) {
    const vcpu = p.vcpu ? `${p.vcpu}vCPU` : '';
    const mem  = p.memory_gb ? `${p.memory_gb}G` : '';
    const extra = [vcpu, mem].filter(Boolean).join(' / ');
    const desc = extra ? ` (${extra})` : '';
    html += `<option value="${p.name}" ${activeProfile === p.name ? 'selected' : ''}>${p.name}${desc}</option>`;
  }
  html += `
        </select>
      </div>
      ${anyFilterActive ? `
        <button type="button" class="avail-reset-btn" id="vsiResetBtn">Reset filters</button>
      ` : ''}
    </div>
  </div>`;

  // ── Table grouped by family ──────────────────────────────────────────────────
  // Group filtered profiles by normalized family
  const byFamily = {};
  for (const p of filtered) {
    const f = getNormalizedVsiFamily(p.family);
    (byFamily[f] = byFamily[f] || []).push(p);
  }

  // Bandwidth cap helper
  const getBwCap = p => {
    if (p.bandwidth_gbps != null) return p.bandwidth_gbps;
    if (p.bandwidth != null) return +(p.bandwidth / 1000).toFixed(1);
    return null;
  };
  const hasBw = filtered.some(p => getBwCap(p) != null);

  // Accordion: auto-expand when a filter is active
  const isFamilyExpanded = fam => {
    if (anyFilterActive) return true;
    return state.expandedVsiGens.has(fam);   // reuse same Set, keyed by family now
  };

  const colCount = 3 + (hasBw ? 1 : 0) + (hasGpu ? 1 : 0) + (hasRegions ? 1 : 0);

  html += `<div class="profile-table-wrap"><table class="profile-table">
    <thead><tr>
      <th>Name</th>
      <th>vCPU</th>
      <th>Memory (GiB)</th>
      ${hasBw ? '<th>Max BW (Gbps)</th>' : ''}
      ${hasGpu ? '<th>GPU</th>' : ''}
      ${hasRegions ? '<th>Regions</th>' : ''}
    </tr></thead>
    <tbody>`;

  const orderedFamilies = [
    ...FAMILY_ORDER.filter(f => byFamily[f]),
    ...Object.keys(byFamily).filter(f => !FAMILY_ORDER.includes(f)),
  ];

  for (const fam of orderedFamilies) {
    const group = byFamily[fam];
    if (!group || group.length === 0) continue;

    const expanded = isFamilyExpanded(fam);
    const label = familyLabel(fam);

    html += `<tr class="gen-separator-row ${expanded ? 'is-expanded' : 'is-collapsed'}"
        data-toggle-vsi-gen="${fam}" role="button" tabindex="0" aria-expanded="${expanded}">
      <td colspan="${colCount}" class="gen-separator-cell">
        <svg class="gen-expand-icon" width="14" height="14" viewBox="0 0 32 32" fill="currentColor" aria-hidden="true">
          <path d="M16 22L6 12l1.4-1.4 8.6 8.6 8.6-8.6L26 12z"/>
        </svg>
        <span class="gen-separator-label">${label}</span>
        <span class="gen-separator-count">${group.length} profile${group.length !== 1 ? 's' : ''}</span>
      </td>
    </tr>`;

    for (const p of group) {
      const gpuDesc = getGpuDescription(p);
      const gen = getVsiGen(p.name);
      const isFlex = gen === 'flex';
      const isGen4 = gen === '4';
      const isSelectAvail = isGen4 && Array.isArray(p.regions) && p.regions.length > 0
                            && p.regions.length < 13; // not all 13 regions
      const bwCap = getBwCap(p);

      // Gen badge shown inline on name (replaces the Family column)
      const genBadge = isFlex
        ? ' <span class="vsi-flex-badge">flex</span>'
        : isSelectAvail
          ? ' <span class="vsi-gen-badge vsi-gen-badge--select">gen4 · select</span>'
          : gen
            ? ` <span class="vsi-gen-badge">gen${gen}</span>`
            : '';

      // Region chips — only shown for gen4 select-availability profiles
      let regionsCell = '';
      if (hasRegions) {
        if (isGen4 && Array.isArray(p.regions)) {
          const chips = p.regions.length > 0
            ? p.regions.map(r => `<span class="vsi-region-chip">${r}</span>`).join('')
            : `<span class="vsi-region-chip vsi-region-chip--none">—</span>`;
          regionsCell = `<td class="vsi-regions-cell">${chips}</td>`;
        } else {
          regionsCell = `<td class="vsi-regions-cell vsi-regions-all" title="Available in all regions">All regions</td>`;
        }
      }

      html += `<tr class="vsi-body-row ${isFlex ? 'vsi-flex-row' : ''} ${expanded ? '' : 'vsi-row-hidden'}">
        <td class="profile-name">${p.name}${genBadge}</td>
        <td>${p.vcpu ?? '—'}</td>
        <td>${p.memory_gb ?? '—'}</td>
        ${hasBw ? `<td>${bwCap != null ? bwCap + ' Gbps' : '—'}</td>` : ''}
        ${hasGpu ? `<td>${gpuDesc}</td>` : ''}
        ${regionsCell}
      </tr>`;
    }
  }

  html += `</tbody></table></div>`;
  return html;
}

function renderBmsProfiles(profiles, regions) {
  const activeRegion = state.bmsRegion;
  const activeFamily = state.profileFamily;

  // ── Region filter bar ──────────────────────────────────────────────────────
  // Only show if we have multi-region capacity data
  const hasCapacity = profiles.some(p => p.capacity_by_region && Object.keys(p.capacity_by_region).length > 0);
  const capRegions  = hasCapacity
    ? [...new Set(profiles.flatMap(p => Object.keys(p.capacity_by_region ?? {})))].sort()
    : [];

  let html = '';
  if (capRegions.length > 0) {
    html += `<div class="profile-region-bar">`;
    for (const r of ['all', ...capRegions]) {
      const label = r === 'all' ? 'All Regions' : r;
      html += `<button class="profile-region-chip ${activeRegion === r ? 'is-active' : ''}" data-region="${r}">${label}</button>`;
    }
    html += `</div>`;
  }

  // ── Family filter bar ──────────────────────────────────────────────────────
  const families = ['all', ...new Set(profiles.map(p => p.family).filter(Boolean))];
  html += `<div class="profile-family-bar">`;
  for (const f of families) {
    const label = f === 'all' ? 'All Families' : f.charAt(0).toUpperCase() + f.slice(1);
    html += `<button class="profile-family-chip ${activeFamily === f ? 'is-active' : ''}" data-family="${f}">${label}</button>`;
  }
  html += `</div>`;

  // ── Filter profiles by family ──────────────────────────────────────────────
  const filtered = activeFamily === 'all' ? profiles : profiles.filter(p => p.family === activeFamily);
  html += `<div class="profile-count">${filtered.length} profile${filtered.length !== 1 ? 's' : ''}</div>`;

  // ── Determine visible zones ────────────────────────────────────────────────
  // When a region is selected: keep only zones that belong to that region
  // (zone names are prefixed by region, e.g. "us-east-1" for region "us-east").
  // When "All Regions": show all offered zones across all profiles.
  const allZones = [];
  for (const p of filtered) {
    for (const z of p.zones ?? []) {
      if (!allZones.includes(z)) allZones.push(z);
    }
  }
  allZones.sort();
  const visibleZones = (activeRegion === 'all')
    ? allZones
    : allZones.filter(z => z.startsWith(activeRegion + '-'));

  // ── Legend ─────────────────────────────────────────────────────────────────
  const legendHtml = hasCapacity
    ? `<div class="bms-legend">
        <span class="cap-available">✓</span> Capacity available &nbsp;
        <span class="cap-zero">✗</span> No capacity &nbsp;
        <span class="cap-unknown">—</span> Not offered in this zone
       </div>`
    : `<div class="bms-legend">
        <span class="cap-available">✓</span> Offered in this zone &nbsp;
        <span class="cap-unknown">—</span> Not offered
       </div>`;

  html += legendHtml;

  // ── Table ──────────────────────────────────────────────────────────────────
  html += `<div class="profile-table-wrap"><table class="profile-table">
    <thead><tr>
      <th>Name</th>
      <th>Family</th>
      <th>Sockets</th>
      <th>Cores</th>
      <th>Memory (GiB)</th>
      <th>Bandwidth</th>
      ${visibleZones.map(z => `<th class="zone-col">${z.toUpperCase()}</th>`).join('')}
    </tr></thead>
    <tbody>`;

  for (const p of filtered) {
    const bw = p.network_bandwidth ? (p.network_bandwidth / 1000).toFixed(0) + ' Gbps' : '—';
    const offeredSet = new Set(p.zones ?? []);

    // Build zone → availability for this profile
    // When a region is selected: use that region's capacity entries
    // When "All Regions": any region having availability counts as available
    let capAvail = null;
    if (hasCapacity && p.capacity_by_region) {
      capAvail = new Set();
      const regionsToCheck = activeRegion === 'all'
        ? Object.values(p.capacity_by_region)
        : [p.capacity_by_region[activeRegion] ?? []];
      for (const entries of regionsToCheck) {
        for (const e of entries) {
          if (e.available === true) capAvail.add(e.zone);
        }
      }
    }

    html += `<tr>
      <td class="profile-name">${p.name}</td>
      <td><span class="profile-family-tag">${p.family ?? '—'}</span></td>
      <td>${p.cpu_socket_count ?? '—'}</td>
      <td>${p.cpu_core_count ?? '—'}</td>
      <td>${p.memory_gb ?? '—'}</td>
      <td>${bw}</td>
      ${visibleZones.map(z => {
        if (!offeredSet.has(z)) return `<td class="cap-cell cap-unknown">—</td>`;
        if (capAvail === null)  return `<td class="cap-cell cap-available" title="Offered in this zone">✓</td>`;
        return capAvail.has(z)
          ? `<td class="cap-cell cap-available" title="Capacity available">✓</td>`
          : `<td class="cap-cell cap-zero" title="No capacity right now">✗</td>`;
      }).join('')}
    </tr>`;
  }

  html += `</tbody></table></div>`;
  return html;
}

// ── BM Availability View (Regional & Zonal Box Layout) ──────────────────────────
const REGION_GEO_MAP = {
  'us-east': { geo: 'North America', name: 'Washington DC', code: 'us-east', zones: ['us-east-1', 'us-east-2', 'us-east-3'] },
  'us-south': { geo: 'North America', name: 'Dallas', code: 'us-south', zones: ['us-south-1', 'us-south-2', 'us-south-3'] },
  'ca-tor': { geo: 'North America', name: 'Toronto', code: 'ca-tor', zones: ['ca-tor-1', 'ca-tor-2', 'ca-tor-3'] },
  'ca-mon': { geo: 'North America', name: 'Montreal', code: 'ca-mon', zones: ['ca-mon-1', 'ca-mon-2', 'ca-mon-3'] },
  'br-sao': { geo: 'Latin America', name: 'São Paulo', code: 'br-sao', zones: ['br-sao-1', 'br-sao-2', 'br-sao-3'] },
  'eu-de': { geo: 'Europe', name: 'Frankfurt', code: 'eu-de', zones: ['eu-de-1', 'eu-de-2', 'eu-de-3'] },
  'eu-es': { geo: 'Europe', name: 'Madrid', code: 'eu-es', zones: ['eu-es-1', 'eu-es-2', 'eu-es-3'] },
  'eu-gb': { geo: 'Europe', name: 'London', code: 'eu-gb', zones: ['eu-gb-1', 'eu-gb-2', 'eu-gb-3'] },
  'in-che': { geo: 'Asia Pacific', name: 'Chennai', code: 'in-che', zones: ['in-che-1', 'in-che-2', 'in-che-3'] },
  'in-mum': { geo: 'Asia Pacific', name: 'Mumbai', code: 'in-mum', zones: ['in-mum-1', 'in-mum-2', 'in-mum-3'] },
  'jp-osa': { geo: 'Asia Pacific', name: 'Osaka', code: 'jp-osa', zones: ['jp-osa-1', 'jp-osa-2', 'jp-osa-3'] },
  'jp-tok': { geo: 'Asia Pacific', name: 'Tokyo', code: 'jp-tok', zones: ['jp-tok-1', 'jp-tok-2', 'jp-tok-3'] },
  'au-syd': { geo: 'Asia Pacific', name: 'Sydney', code: 'au-syd', zones: ['au-syd-1', 'au-syd-2', 'au-syd-3'] },
};

function renderAvailability() {
  if (!state.profiles) {
    return `<div class="loading-state">
      <p>No profiles data — run <code>mise run fetch-profiles</code> with <code>IBMCLOUD_API_KEY</code> set.</p>
    </div>`;
  }

  const { bms_profiles, regions, fetched_at } = state.profiles;
  const fetchedStr = fetched_at
    ? new Date(fetched_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    : 'unknown';

  const bmsList = bms_profiles ?? [];

  // Group available profiles per region and per zone:
  // regionZones[r][z] = [ profileObjects ... ]
  const regionZones = {};
  const allAvailableProfiles = new Map(); // profileName -> { name, family, cpu_core_count, memory_gb }
  let totalAvailableCount = 0;

  for (const p of bmsList) {
    if (!p.capacity_by_region) continue;
    for (const [r, entries] of Object.entries(p.capacity_by_region)) {
      for (const e of entries) {
        if (e.available === true) {
          if (!regionZones[r]) regionZones[r] = {};
          if (!regionZones[r][e.zone]) regionZones[r][e.zone] = [];
          regionZones[r][e.zone].push(p);
          if (!allAvailableProfiles.has(p.name)) {
            allAvailableProfiles.set(p.name, p);
          }
          totalAvailableCount++;
        }
      }
    }
  }

  // List of unique profile names that have availability anywhere
  const availableProfileNames = Array.from(allAvailableProfiles.keys()).sort();

  // Active filters & search query
  const activeProfile = state.availProfileFilter;
  const activeRegion = state.availRegionFilter;
  const q = (state.query || '').toLowerCase().trim();

  // Filter available profile list by search query if any
  const filteredProfileNames = availableProfileNames.filter(name => {
    if (!q) return true;
    return name.toLowerCase().includes(q) || (allAvailableProfiles.get(name)?.family || '').toLowerCase().includes(q);
  });

  // Let's compute unique available profile counts per region
  // (how many distinct profiles have capacity in at least one zone of that region)
  const allRegionKeys = regions?.length ? regions : Object.keys(REGION_GEO_MAP);
  const regionProfileCounts = {};
  for (const r of allRegionKeys) {
    const rZones = regionZones[r] || {};
    const uniqueProfs = new Set();
    for (const zk of Object.keys(rZones)) {
      for (const p of rZones[zk]) {
        uniqueProfs.add(p.name);
      }
    }
    regionProfileCounts[r] = uniqueProfs.size;
  }

  // Sorted regions by profile count descending
  const sortedRegionEntries = allRegionKeys.map(r => {
    const meta = REGION_GEO_MAP[r] || { geo: 'Other', name: r, code: r };
    return {
      id: r,
      displayName: meta.name,
      code: meta.code || r,
      count: regionProfileCounts[r] || 0
    };
  }).sort((a, b) => b.count - a.count || a.displayName.localeCompare(b.displayName));

  const maxRegionCount = Math.max(1, ...sortedRegionEntries.map(e => e.count));

  // Let's build the Geo groups
  const geoOrder = ['North America', 'Latin America', 'Europe', 'Asia Pacific'];

  // Group regions by Geo (maintaining ordered regional order within geo)
  const geoGroups = {};
  for (const g of geoOrder) geoGroups[g] = [];

  // Use Object.keys(REGION_GEO_MAP) order to preserve nice regional presentation
  const orderedRegionKeys = Object.keys(REGION_GEO_MAP).filter(r => allRegionKeys.includes(r));
  for (const r of allRegionKeys) {
    if (!orderedRegionKeys.includes(r)) orderedRegionKeys.push(r);
  }

  for (const r of orderedRegionKeys) {
    const meta = REGION_GEO_MAP[r] || { geo: 'Other', name: r, code: r };
    const geo = meta.geo || 'Other';
    if (!geoGroups[geo]) geoGroups[geo] = [];
    geoGroups[geo].push({
      id: r,
      displayName: meta.name,
      code: meta.code || r,
      zones: regionZones[r] || {}
    });
  }

  // Count total active zones with profiles
  let totalActiveZones = 0;
  for (const r of Object.keys(regionZones)) {
    totalActiveZones += Object.keys(regionZones[r]).length;
  }

  // Collect available families from all available profiles
  const availableFamiliesSet = new Set();
  for (const p of allAvailableProfiles.values()) {
    if (p.family) availableFamiliesSet.add(p.family);
  }
  const availableFamilies = Array.from(availableFamiliesSet).sort();

  // Profiles matching selected family
  const activeFamily = state.availFamilyFilter;
  const eligibleProfilesForDropdown = availableProfileNames.filter(pname => {
    if (activeFamily === 'all') return true;
    const p = allAvailableProfiles.get(pname);
    return p?.family === activeFamily;
  });

  let html = `<div class="avail-area">`;

  // Regions sorted by available profile count (desc) for the region dropdown
  const regionsByCount = [...allRegionKeys].sort(
    (a, b) => (regionProfileCounts[b] || 0) - (regionProfileCounts[a] || 0)
  );

  // Header bar with total stats and Family / Region / Profile Select Dropdowns
  html += `
    <div class="avail-header">
      <div class="avail-title">
        <strong>${allRegionKeys.length} regions</strong> &nbsp;·&nbsp;
        <strong>${totalActiveZones} active zones</strong> &nbsp;·&nbsp;
        <strong>${availableProfileNames.length} available profiles</strong> &nbsp;·&nbsp;
        <span class="avail-gen-date">Refreshed ${fetchedStr}</span>
      </div>
      <div class="avail-filter-controls">
        <div class="avail-select-group">
          <label for="availFamilySelect" class="avail-select-label">Family</label>
          <select id="availFamilySelect" class="avail-select" data-avail-family-select>
            <option value="all" ${activeFamily === 'all' ? 'selected' : ''}>All Families (${availableFamilies.length})</option>`;
  for (const fam of availableFamilies) {
    const formattedFam = fam.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    html += `<option value="${fam}" ${activeFamily === fam ? 'selected' : ''}>${formattedFam}</option>`;
  }
  html += `
          </select>
        </div>
        <div class="avail-select-group">
          <label for="availRegionSelect" class="avail-select-label">Region</label>
          <select id="availRegionSelect" class="avail-select" data-avail-region-select>
            <option value="all" ${activeRegion === 'all' ? 'selected' : ''}>All Regions (${allRegionKeys.length})</option>`;
  for (const r of regionsByCount) {
    const meta = REGION_GEO_MAP[r] || {};
    const cnt = regionProfileCounts[r] || 0;
    const label = meta.name ? `${meta.name} (${r}) — ${cnt}` : `${r} — ${cnt}`;
    html += `<option value="${r}" ${activeRegion === r ? 'selected' : ''}>${label}</option>`;
  }
  html += `
          </select>
        </div>
        <div class="avail-select-group">
          <label for="availProfileSelect" class="avail-select-label">Profile</label>
          <select id="availProfileSelect" class="avail-select" data-avail-profile-select>
            <option value="all" ${activeProfile === 'all' ? 'selected' : ''}>All Profiles (${eligibleProfilesForDropdown.length})</option>`;
  for (const pname of eligibleProfilesForDropdown) {
    const p = allAvailableProfiles.get(pname);
    const cores = p?.cpu_core_count ? `${p.cpu_core_count}c` : '';
    const mem = p?.memory_gb ? `${p.memory_gb}G` : '';
    const extra = [cores, mem].filter(Boolean).join(' / ');
    const desc = extra ? ` (${extra})` : '';
    html += `<option value="${pname}" ${activeProfile === pname ? 'selected' : ''}>${pname}${desc}</option>`;
  }
  html += `
          </select>
        </div>
        ${(activeFamily !== 'all' || activeRegion !== 'all' || activeProfile !== 'all') ? `
          <button type="button" class="avail-reset-btn" id="availResetBtn">Reset filters</button>
        ` : ''}
      </div>
    </div>`;

  // Main content layout: Stage containing the main Geo/Zonal grid + Side Regional Count panel
  html += `
    <div class="avail-stage">
      <div class="avail-main-content">
        <div class="avail-grid">`;

  for (const geo of Object.keys(geoGroups)) {
    const regList = geoGroups[geo];
    if (!regList.length) continue;

    // Check if geo has any matching regions
    let geoHasMatch = false;

    let geoHtml = `
      <div class="avail-geo-group">
        <div class="avail-geo-label">${geo}</div>
        <div class="avail-regions-row">`;

    for (const reg of regList) {
      const meta = REGION_GEO_MAP[reg.id] || {};
      const configuredZones = meta.zones || [`${reg.id}-1`, `${reg.id}-2`, `${reg.id}-3`];
      const activeZoneKeys = Object.keys(reg.zones);
      const hasAnyInRegion = activeZoneKeys.length > 0;

      // Check if this region matches the active family filter, profile filter, region filter, or search query
      const isFilterActive = activeFamily !== 'all' || activeProfile !== 'all';
      let regionHasMatchingProfiles = false;
      for (const zk of activeZoneKeys) {
        const matching = (reg.zones[zk] || []).filter(p => {
          if (activeFamily !== 'all' && p.family !== activeFamily) return false;
          if (activeProfile !== 'all' && p.name !== activeProfile) return false;
          if (activeRegion !== 'all' && reg.id !== activeRegion) return false;
          if (q && !p.name.toLowerCase().includes(q) && !(p.family || '').toLowerCase().includes(q) && !reg.displayName.toLowerCase().includes(q) && !reg.code.toLowerCase().includes(q) && !zk.toLowerCase().includes(q)) return false;
          return true;
        });
        if (matching.length > 0) regionHasMatchingProfiles = true;
      }

      if (hasAnyInRegion && (!isFilterActive || regionHasMatchingProfiles)) {
        geoHasMatch = true;
      }

      const isRegionSelected = activeRegion === reg.id;
      const isRegionHighlighted = isRegionSelected || (isFilterActive && regionHasMatchingProfiles);
      const isRegionDimmed = (activeRegion !== 'all' && !isRegionSelected) || (isFilterActive && !regionHasMatchingProfiles);
      // Automatically expand if a specific profile/family/region filter is active or search query is present, or if explicitly expanded by user
      const isExplicitlyExpanded = state.expandedRegions.has(reg.id);
      const isAutoExpanded = isFilterActive || activeRegion !== 'all' || Boolean(q);
      const isExpanded = isExplicitlyExpanded || isAutoExpanded;

      const profileCountInRegion = regionProfileCounts[reg.id] || 0;

      geoHtml += `
        <div class="avail-region-card ${!hasAnyInRegion ? 'is-empty-region' : ''} ${isRegionHighlighted ? 'is-highlighted' : ''} ${isRegionDimmed ? 'is-dimmed' : ''} ${isExpanded ? 'is-expanded' : 'is-collapsed'}" data-region-card-id="${reg.id}">
          <div class="avail-region-header" data-toggle-region="${reg.id}" role="button" tabindex="0" aria-expanded="${isExpanded}">
            <div class="avail-region-title-wrap">
              <svg class="avail-expand-icon" width="16" height="16" viewBox="0 0 32 32" fill="currentColor" aria-hidden="true">
                <path d="M16 22L6 12l1.4-1.4 8.6 8.6 8.6-8.6L26 12z"/>
              </svg>
              <span class="avail-region-title">${reg.displayName}</span>
              <span class="avail-region-code">${reg.code}</span>
            </div>
            <div class="avail-region-meta">
              <span class="avail-profile-badge ${profileCountInRegion > 0 ? 'is-profile-badge' : 'is-zero-badge'}">
                ${profileCountInRegion} Profile${profileCountInRegion !== 1 ? 's' : ''}
              </span>
              <span class="avail-region-badge ${hasAnyInRegion ? 'is-active-badge' : 'is-none-badge'}">
                ${hasAnyInRegion ? `${activeZoneKeys.length} active zone${activeZoneKeys.length !== 1 ? 's' : ''}` : 'No capacity'}
              </span>
            </div>
          </div>
          <div class="avail-zones-grid ${!isExpanded ? 'is-collapsed-body' : ''}">`;

      for (const zk of configuredZones) {
        const profilesInZone = reg.zones[zk] || [];
        const hasProfiles = profilesInZone.length > 0;
        const hasMatchingZoneProfiles = profilesInZone.some(p => {
          if (activeFamily !== 'all' && p.family !== activeFamily) return false;
          if (activeProfile !== 'all' && p.name !== activeProfile) return false;
          return true;
        });

        const isZoneDimmed = isFilterActive ? !hasMatchingZoneProfiles : !hasProfiles;

        geoHtml += `
          <div class="avail-zone-box ${!hasProfiles ? 'is-zone-empty' : ''} ${isZoneDimmed ? 'is-dimmed' : ''}" data-zone="${zk}">
            <div class="avail-zone-header">
              <span class="avail-zone-title">${zk}</span>
              <span class="avail-zone-count ${!hasProfiles ? 'is-zero-count' : ''}">${profilesInZone.length}</span>
            </div>
            <div class="avail-zone-profiles">`;

        if (!hasProfiles) {
          geoHtml += `<div class="avail-zone-none-text">None available</div>`;
        } else {
          for (const p of profilesInZone) {
            const matchesFamily = activeFamily === 'all' || p.family === activeFamily;
            const matchesProfile = activeProfile === 'all' || p.name === activeProfile;
            const isMatch = matchesFamily && matchesProfile;

            const isRowFocused = isMatch && (activeProfile === p.name || activeFamily === p.family);
            const isRowDimmed = isFilterActive && !isMatch;
            const fam = p.family || 'general';

            geoHtml += `
              <div class="avail-profile-item ${isRowFocused ? 'is-focused' : ''} ${isRowDimmed ? 'is-dimmed' : ''}" data-profile="${p.name}">
                <span class="avail-profile-name avail-fam-text--${fam}">${p.name}</span>
              </div>`;
          }
        }

        geoHtml += `
            </div>
          </div>`;
      }

      geoHtml += `
          </div>
        </div>`;
    }

    geoHtml += `
        </div>
      </div>`;

    html += geoHtml;
  }

  html += `</div></div>`; // close avail-grid and avail-main-content

  // ── Regional Count View (Side Card Panel) ──────────────────────────────────
  html += `
    <aside class="avail-sidebar-legend">
      <div class="avail-legend-header">
        <h2 class="avail-legend-title">Regions</h2>
        <p class="avail-legend-desc">Sorted by available profile count. Click a region to filter.</p>
      </div>
      <div class="avail-legend-list">`;

  for (const rEntry of sortedRegionEntries) {
    const isSelected = activeRegion === rEntry.id;
    const isZero = rEntry.count === 0;

    // 12-segment meter bar relative to max region count
    const totalSegments = 12;
    const activeSegments = isZero ? 0 : Math.max(1, Math.round((rEntry.count / maxRegionCount) * totalSegments));
    let meterBarsHtml = '';
    for (let i = 0; i < totalSegments; i++) {
      meterBarsHtml += `<i class="${i < activeSegments ? 'on' : ''}"></i>`;
    }

    html += `
      <button type="button" class="avail-legend-row ${isSelected ? 'is-selected' : ''} ${isZero ? 'is-zero' : ''}" data-region-filter="${rEntry.id}">
        <div class="avail-legend-info">
          <div class="avail-legend-names">
            <span class="avail-legend-code">${rEntry.code}</span>
            <span class="avail-legend-city">${rEntry.displayName}</span>
          </div>
          <div class="avail-swatch" aria-hidden="true">
            ${meterBarsHtml}
          </div>
        </div>
        <span class="avail-legend-count">${rEntry.count}</span>
      </button>`;
  }

  html += `
      </div>
    </aside>
  </div></div>`; // close avail-sidebar-legend and avail-stage and avail-area

  return html;
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
function renderSidebar(productId) {
  if (!productId) {
    return `
      <div class="sidebar-empty">
        <h3>IBM Cloud VPC Synergies Map</h3>
        <p>Click any service card to explore integrations, discovery questions, differentiators, and documentation links.</p>
      </div>`;
  }

  const p = state.products.find(pr => pr.id === productId);
  if (!p) return '';

  const playId = catToPlayId(p.cat);
  const color  = laneColor(playId);
  const cat    = state.plays.categories.find(c => c.id === p.cat);
  const play   = state.plays.plays[playId];

  // Connections involving this product
  const conns = state.connections.filter(c => c.from === productId || c.to === productId);

  let html = ``;

  // Lane tag
  html += `<div class="sb-lane-tag" style="background:${color}">${cat?.label ?? p.cat}</div>`;

  // Title + status
  html += `<div class="sb-title">${p.label}</div>`;
  const statusLabel = p.status === 'ga' ? 'Generally Available'
    : p.status === 'partner'     ? 'Partner'
    : p.status === 'restricted'  ? 'Existing Clients Only'
    : p.status === 'coming_soon' ? 'Coming Soon'
    : p.status === 'deprecated'  ? 'Deprecated'
    : p.status;
  const statusClass = p.status === 'restricted' ? 'restricted'
    : p.status === 'partner' ? 'partner' : '';
  html += `<div class="sb-status ${statusClass}">${statusLabel}</div>`;

  // Description
  if (p.desc) {
    html += `<div class="sb-section">
      <div class="sb-section-title">Overview</div>
      <p class="sb-desc">${p.desc}</p>
    </div>`;
  }

  // Value proposition
  if (p.value) {
    html += `<div class="sb-section">
      <div class="sb-section-title">Seller Value</div>
      <p class="sb-value">${p.value}</p>
    </div>`;
  }

  // Discovery questions
  if (p.questions?.length) {
    html += `<div class="sb-section">
      <div class="sb-section-title">Discovery Questions</div>
      <ul class="sb-list sb-questions">
        ${p.questions.map(q => `<li>${q}</li>`).join('')}
      </ul>
    </div>`;
  }

  // Differentiators
  if (p.differentiators?.length) {
    html += `<div class="sb-section">
      <div class="sb-section-title">Differentiators</div>
      <ul class="sb-list">
        ${p.differentiators.map(d => `<li>${d}</li>`).join('')}
      </ul>
    </div>`;
  }

  // Competitors
  if (p.competitors?.length) {
    html += `<div class="sb-section">
      <div class="sb-section-title">Competitive Alternatives</div>
      <ul class="sb-list">
        ${p.competitors.map(c => `<li>${c}</li>`).join('')}
      </ul>
    </div>`;
  }

  // Connections
  if (conns.length) {
    html += `<div class="sb-section">
      <div class="sb-section-title">Integrations (${conns.length})</div>
      <div class="conn-list">`;

    for (const c of conns) {
      const otherId = c.from === productId ? c.to : c.from;
      const other   = state.products.find(pr => pr.id === otherId);
      if (!other) continue;
      const otherPlayId = catToPlayId(other.cat);
      const otherColor  = laneColor(otherPlayId);
      const direction   = c.from === productId ? '→' : '←';

      html += `
        <div class="conn-card" style="--conn-color:${otherColor}" data-id="${otherId}">
          <div class="conn-card-label">${direction} ${other.label}</div>
          <div class="conn-card-summary">${c.summary}</div>
          ${c.sellerNote ? `<div class="conn-card-note">${c.sellerNote}</div>` : ''}
          <div class="conn-card-kind ${c.kind}">${c.kind}</div>
        </div>`;
    }

    html += `</div></div>`;
  }

  // Docs link
  if (p.docsUrl) {
    html += `<div class="sb-section">
      <a class="sb-docs-link" href="${p.docsUrl}" target="_blank" rel="noopener">
        <span>IBM Cloud Documentation</span>
        <svg width="14" height="14" viewBox="0 0 32 32" fill="currentColor" aria-hidden="true" style="vertical-align: -2px; margin-left: 4px;">
          <path d="M26 26H6V6h10V4H6c-1.1 0-2 .9-2 2v20c0 1.1.9 2 2 2h20c1.1 0 2-.9 2-2V16h-2v10z"/><path d="M20 4v2h4.6L14.3 16.3l1.4 1.4L26 7.4V12h2V4h-8z"/>
        </svg>
      </a>
    </div>`;
  }

  return html;
}

// ── Render dispatch ───────────────────────────────────────────────────────────
function render() {
  const main = document.getElementById('appMain');
  const loading = document.getElementById('loadingState');
  if (loading) loading.remove();

  const isProfiles    = state.viewMode === 'profiles';
  const isAvail       = state.viewMode === 'availability';
  const isNetwork     = state.viewMode === 'network';

  if (state.viewMode === 'grid') {
    main.innerHTML = renderGrid();
  } else if (state.viewMode === 'network') {
    main.innerHTML = renderNetwork();
  } else if (state.viewMode === 'matrix') {
    main.innerHTML = renderMatrix();
  } else if (state.viewMode === 'profiles') {
    main.innerHTML = renderProfiles();
  } else {
    main.innerHTML = renderAvailability();
  }

  // Sidebar — hidden in profiles, availability, and network views
  const sidebar        = document.getElementById('sidebar');
  const sidebarContent = document.getElementById('sidebarContent');
  if (isProfiles || isAvail || isNetwork) {
    sidebar.classList.remove('is-open');
    main.classList.remove('sidebar-open');
    sidebarContent.innerHTML = '';
  } else {
    sidebarContent.innerHTML = renderSidebar(state.activeId);
    if (state.activeId) {
      sidebar.classList.add('is-open');
      main.classList.add('sidebar-open');
    } else {
      sidebar.classList.remove('is-open');
      main.classList.remove('sidebar-open');
    }
  }

  // Sync view tab active state
  document.querySelectorAll('.view-tab').forEach(btn => {
    btn.classList.toggle('is-active', btn.dataset.view === state.viewMode);
  });

  // ── Network card click handlers ──
  if (isNetwork) {
    main.querySelectorAll('.net-card[data-id]').forEach(el => {
      el.addEventListener('click', e => {
        e.stopPropagation();
        const id = el.dataset.id;
        state.netSelected = state.netSelected === id ? null : id;
        applyNetworkHighlights();
        // Intent nodes are synthetic — no sidebar entry
        const isIntent = id.startsWith('_intent_');
        if (state.netSelected && !isIntent) {
          sidebarContent.innerHTML = renderSidebar(state.netSelected);
          sidebar.classList.add('is-open');
          main.classList.add('sidebar-open');
        } else {
          sidebar.classList.remove('is-open');
          main.classList.remove('sidebar-open');
          sidebarContent.innerHTML = '';
        }
      });
    });
  }

  // ── Card click handlers (grid / matrix) ──
  if (!isNetwork) {
    main.querySelectorAll('[data-id]').forEach(el => {
      el.addEventListener('click', e => {
        e.stopPropagation();
        const id = el.dataset.id;
        state.activeId = state.activeId === id ? null : id;
        render();
      });
    });
  }

  // ── Integration pillar buttons ──
  main.querySelectorAll('[data-pillar]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const p = btn.dataset.pillar;
      state.integrationFilter = state.integrationFilter === p ? null : p;
      render();
    });
  });

  // Matrix OS chips
  main.querySelectorAll('[data-os]').forEach(el => {
    el.addEventListener('click', () => {
      state.osFilter = el.dataset.os;
      render();
    });
  });

  // Connection card clicks in sidebar navigate to that product
  sidebarContent.querySelectorAll('.conn-card[data-id]').forEach(el => {
    el.style.cursor = 'pointer';
    el.addEventListener('click', () => {
      if (isNetwork) {
        // In network view: update selection + highlights without full re-render
        state.netSelected = el.dataset.id;
        applyNetworkHighlights();
        sidebarContent.innerHTML = renderSidebar(state.netSelected);
        // Re-bind conn cards in the freshly rendered sidebar
        sidebarContent.querySelectorAll('.conn-card[data-id]').forEach(inner => {
          inner.style.cursor = 'pointer';
          inner.addEventListener('click', () => {
            state.netSelected = inner.dataset.id;
            applyNetworkHighlights();
            sidebarContent.innerHTML = renderSidebar(state.netSelected);
          });
        });
      } else {
        state.activeId = el.dataset.id;
        render();
      }
    });
  });

  // ── VSI gen accordion toggles ──
  main.querySelectorAll('[data-toggle-vsi-gen]').forEach(row => {
    const toggle = () => {
      const gen = row.dataset.toggleVsiGen;
      if (state.expandedVsiGens.has(gen)) {
        state.expandedVsiGens.delete(gen);
      } else {
        state.expandedVsiGens.add(gen);
      }
      render();
    };
    row.addEventListener('click', e => { e.stopPropagation(); toggle(); });
    row.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); toggle(); }
    });
  });

  // ── VSI Profile Dropdown Selects ──
  const vsiFamilySelect = main.querySelector('[data-vsi-family-select]');
  if (vsiFamilySelect) {
    vsiFamilySelect.addEventListener('change', e => {
      state.profileFamily = e.target.value;
      state.vsiGenFilter = 'all';   // reset gen on family change
      state.vsiProfileFilter = 'all';
      render();
    });
  }

  const vsiGenSelect = main.querySelector('[data-vsi-gen-select]');
  if (vsiGenSelect) {
    vsiGenSelect.addEventListener('change', e => {
      state.vsiGenFilter = e.target.value;
      state.vsiProfileFilter = 'all'; // reset specific profile on gen change
      render();
    });
  }

  const vsiProfileSelect = main.querySelector('[data-vsi-profile-select]');
  if (vsiProfileSelect) {
    vsiProfileSelect.addEventListener('change', e => {
      state.vsiProfileFilter = e.target.value;
      render();
    });
  }

  const vsiResetBtn = main.querySelector('#vsiResetBtn');
  if (vsiResetBtn) {
    vsiResetBtn.addEventListener('click', () => {
      state.profileFamily = 'all';
      state.vsiGenFilter = 'all';
      state.vsiProfileFilter = 'all';
      render();
    });
  }

  // ── Profiles sub-tab, region chips, and family chips ──
  main.querySelectorAll('[data-ptab]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.profilesTab      = btn.dataset.ptab;
      state.profileFamily    = 'all';
      state.vsiGenFilter     = 'all';
      state.vsiProfileFilter = 'all';
      state.expandedVsiGens  = new Set();
      state.bmsRegion        = 'all';
      render();
    });
  });
  main.querySelectorAll('[data-region]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.bmsRegion = btn.dataset.region;
      render();
    });
  });
  main.querySelectorAll('[data-family]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.profileFamily = btn.dataset.family;
      render();
    });
  });

  // ── BM Availability Dropdown Selects & Region Legend clicks ──
  const familySelect = main.querySelector('[data-avail-family-select]');
  if (familySelect) {
    familySelect.addEventListener('change', e => {
      state.availFamilyFilter = e.target.value;
      state.availProfileFilter = 'all'; // reset specific profile on family change
      render();
    });
  }

  const profileSelect = main.querySelector('[data-avail-profile-select]');
  if (profileSelect) {
    profileSelect.addEventListener('change', e => {
      state.availProfileFilter = e.target.value;
      render();
    });
  }

  const resetBtn = main.querySelector('#availResetBtn');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      state.availFamilyFilter = 'all';
      state.availRegionFilter = 'all';
      state.availProfileFilter = 'all';
      render();
    });
  }

  const availRegionSelect = main.querySelector('[data-avail-region-select]');
  if (availRegionSelect) {
    availRegionSelect.addEventListener('change', e => {
      state.availRegionFilter = e.target.value;
      render();
    });
  }

  main.querySelectorAll('[data-region-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      const r = btn.dataset.regionFilter;
      state.availRegionFilter = state.availRegionFilter === r ? 'all' : r;
      render();
    });
  });

  // Accordion toggle click & keydown for region cards in availability view
  main.querySelectorAll('[data-toggle-region]').forEach(hdr => {
    const toggle = () => {
      const regId = hdr.dataset.toggleRegion;
      if (state.expandedRegions.has(regId)) {
        state.expandedRegions.delete(regId);
      } else {
        state.expandedRegions.add(regId);
      }
      render();
    };

    hdr.addEventListener('click', e => {
      e.stopPropagation();
      toggle();
    });

    hdr.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        toggle();
      }
    });
  });

  // Sync URL hash
  const hash = state.viewMode === 'grid' ? '' : `#${state.viewMode}`;
  if (window.location.hash !== hash) {
    history.replaceState(null, '', hash || window.location.pathname);
  }
}

// ── Header interactions ───────────────────────────────────────────────────────
function bindHeader() {
  // View tabs
  document.getElementById('viewTabs').addEventListener('click', e => {
    const tab = e.target.closest('.view-tab');
    if (!tab) return;
    state.viewMode = tab.dataset.view;
    state.activeId = null;
    if (state.viewMode !== 'network') state.netSelected = null;
    render();
  });

  // Search
  const searchInput = document.getElementById('searchInput');
  let debounce;
  searchInput.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      state.query    = searchInput.value.trim();
      state.activeId = null;
      render();
    }, 180);
  });

  // Sidebar close
  document.getElementById('sidebarClose').addEventListener('click', () => {
    state.activeId = null;
    render();
  });

  // Click outside sidebar to close
  document.getElementById('appMain').addEventListener('click', e => {
    if (!e.target.closest('[data-id]') && state.activeId) {
      state.activeId = null;
      render();
    }
  });

  // Theme toggle
  document.getElementById('themeToggle').addEventListener('click', () => {
    const html  = document.documentElement;
    const theme = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', theme);
  });

  // Keyboard: Escape closes sidebar
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && state.activeId) {
      state.activeId = null;
      render();
    }
  });
}

// ── URL hash on load ──────────────────────────────────────────────────────────
function readHash() {
  const hash = window.location.hash.replace('#', '');
  if (hash === 'network')      state.viewMode = 'network';
  if (hash === 'matrix')       state.viewMode = 'matrix';
  if (hash === 'profiles')     state.viewMode = 'profiles';
  if (hash === 'availability') state.viewMode = 'availability';
}

// ── Boot ──────────────────────────────────────────────────────────────────────
async function boot() {
  readHash();
  bindHeader();

  try {
    await load();
  } catch (err) {
    document.getElementById('loadingState').textContent =
      `Error loading data: ${err.message}`;
    return;
  }

  render();
}

boot();
