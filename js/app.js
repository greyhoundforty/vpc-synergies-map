/**
 * IBM Cloud VPC Synergies Map — app.js
 * Zero-dependency vanilla ES module. All rendering driven by data/vpc/*.json.
 */

// Category IDs that appear as lane arcs in the Map view
// (everything except the hub lane "vpc")
const GRID_INTEGRATION_CATS = [
  'compute',
  'networking',
  'storage',
  'security',
  'connectivity',
  'platform',
];

function escHtml(s) {
  return String(s).replace(/[&<>"']/g, m => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]
  ));
}

// ── State ─────────────────────────────────────────────────────────────────────
const state = {
  plays:        null,
  products:     null,
  connections:  null,
  viewMode:          'grid', // 'grid' | 'architecture' | 'network'
  activeId:          null,
  netSelected:       null,   // selected node id in network view
  archSelected:      null,   // selected node id in architecture view
  integrationFilter: null,   // unused but kept for compat
  query:        '',
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
  const [playsRes, productsRes, connsRes] = await Promise.all([
    fetch(`${base}/plays.json`),
    fetch(`${base}/products.json`),
    fetch(`${base}/connections.json`),
  ]);
  if (!playsRes.ok || !productsRes.ok || !connsRes.ok) {
    throw new Error('Failed to load one or more data files.');
  }
  state.plays       = await playsRes.json();
  state.products    = await productsRes.json();
  state.connections = await connsRes.json();
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
  // Reference Architecture diagram icons
  vsi:                  '<path d="M26,14H6a2,2,0,0,0-2,2V26a2,2,0,0,0,2,2H26a2,2,0,0,0,2-2V16A2,2,0,0,0,26,14Zm0,12H6V16H26ZM10,20H8V18h2Zm4,0H12V18h2Zm12,0H20V18h6ZM24,4H8A2,2,0,0,0,6,6V8H8V6H24V12h2V6A2,2,0,0,0,24,4Z"/>',
  bastion:              '<path d="M27,4H23V8H19V4H13V8H9V4H5A2,2,0,0,0,3,6V12a4,4,0,0,0,2,3.46V28a2,2,0,0,0,2,2H25a2,2,0,0,0,2-2V15.46A4,4,0,0,0,29,12V6A2,2,0,0,0,27,4ZM7,6H9V10H13V6H19V10H23V6h2v6a2,2,0,0,1-2,2H9a2,2,0,0,1-2-2ZM25,28H7V16H25Zm-7-2H14V20a2,2,0,0,1,4,0Z"/>',
  roks:                 '<path d="M16 2L3 9.5v13L16 30l13-7.5v-13L16 2zm0 2.31l10.5 6.06L16 16.43 5.5 10.37 16 4.31zM5 12.1l10 5.77v10.39L5 22.49V12.1zm12 16.16V17.87l10-5.77v10.39L17 28.26z"/>',
  block_storage:        '<path d="M26,4H6A2,2,0,0,0,4,6V26a2,2,0,0,0,2,2H26a2,2,0,0,0,2-2V6A2,2,0,0,0,26,4Zm0,22H6V6H26ZM10,10H8V8h2Zm4,0H12V8h2Zm-4,6H8V14h2Zm4,0H12V14h2Zm-4,6H8V20h2Zm4,0H12V20h2Zm12,0H18V8h8Z"/>',
  cloud_object_storage: '<path d="M26 14a6 6 0 0 0-5.69-4.08A8 8 0 0 0 5 15a6 6 0 0 0 1 11.92h20A5 5 0 0 0 26 14zm0 10H6a4 4 0 0 1-.6-7.95l1-.16.2-.95A6 6 0 0 1 18 11.83l.8.63.8-.57A4 4 0 0 1 26 14a3 3 0 0 1 0 6 1 1 0 0 0 0 2 3 3 0 0 1 0 2z"/>',
  cloud_logs:           '<path d="M26,4H6A2,2,0,0,0,4,6V26a2,2,0,0,0,2,2H26a2,2,0,0,0,2-2V6A2,2,0,0,0,26,4ZM6,6H26V10H6ZM26,26H6V12H26ZM10,16H8V14h2Zm0,4H8V18h2Zm0,4H8V22h2Zm12-8H14V14h8Zm0,4H14V18h8Zm0,4H14V22h8Z"/>',
  cloud_monitoring:     '<path d="M28,4H4A2,2,0,0,0,2,6V22a2,2,0,0,0,2,2h8v2H8v2H24V26H20V24h8a2,2,0,0,0,2-2V6A2,2,0,0,0,28,4Zm0,18H4V6H28ZM8,18l4-5,4,3,6-7,1.4,1.4-7.4,8.6-4-3-2.6,3.4Z"/>',
  container_registry:   '<path d="M28,6H20V2H4A2,2,0,0,0,2,4V26a2,2,0,0,0,2,2H28a2,2,0,0,0,2-2V8A2,2,0,0,0,28,6ZM4,4H18V6H4ZM28,26H4V8H28ZM8,12h4v4H8Zm6,0h4v4H14Zm6,0h4v4H20ZM8,18h4v4H8Zm6,0h4v4H14Zm6,0h4v4H20Z"/>',
  event_streams:        '<path d="M26,18a4,4,0,0,0-3.86,3H15a4,4,0,0,0-3.86-3H4V16H11.14A4,4,0,0,0,15,13h7.14A4,4,0,1,0,26,6a4,4,0,0,0-3.86,3H15a6,6,0,0,0-5.29,3.17A4,4,0,0,0,4,14v4a2,2,0,0,0,2,2h5.14A6,6,0,0,0,15,23h7.14A4,4,0,1,0,26,18ZM26,8a2,2,0,1,1-2,2A2,2,0,0,1,26,8Zm0,14a2,2,0,1,1,2-2A2,2,0,0,1,26,22Z"/>',
  backup_recovery:      '<path d="M28,4H18L16,2H4A2,2,0,0,0,2,4V26a2,2,0,0,0,2,2H28a2,2,0,0,0,2-2V6A2,2,0,0,0,28,4ZM4,4H15.17l2,2H28V8H4ZM28,26H4V10H28ZM16,13a5,5,0,1,0,5,5A5,5,0,0,0,16,13Zm0,8a3,3,0,1,1,3-3A3,3,0,0,1,16,21Zm1-5H15v3h3V17Z"/>',
  app_id:               '<path d="M16,2A14,14,0,1,0,30,16,14.016,14.016,0,0,0,16,2Zm0,4a4,4,0,1,1-4,4A4,4,0,0,1,16,6Zm0,20a9.98,9.98,0,0,1-7.07-2.93,8.02,8.02,0,0,1,14.14,0A9.98,9.98,0,0,1,16,26Z"/>',
  iam:                  '<path d="M26,16a4,4,0,0,0-3.86,3H17.83a6,6,0,1,0,0-2H22.14A4,4,0,1,0,26,16ZM12,20a4,4,0,1,1,4-4A4,4,0,0,1,12,20ZM26,22a2,2,0,1,1,2-2A2,2,0,0,1,26,22ZM16,4a4,4,0,1,0-4,4A4,4,0,0,0,16,4Zm-2,6H10A6,6,0,0,0,4,16v1H6V16a4,4,0,0,1,4-4h4a4,4,0,0,1,4,4v1h2V16A6,6,0,0,0,14,10Z"/>',
  key_protect:          '<path d="M26,10H17.86A4.98,4.98,0,0,0,9,7a5,5,0,0,0-5,5,4.98,4.98,0,0,0,4.14,4.92V25H14V21h2V19h2V15h8a2,2,0,0,0,2-2V12A2,2,0,0,0,26,10ZM9,15a3,3,0,1,1,3-3A3,3,0,0,1,9,15Zm17-3h-2v2H22v2H20v2H18v2H16v-6.14A4.98,4.98,0,0,0,19,12h7Z"/>',
  hpcs:                 '<path d="M16 2L4 7v6c0 8.5 5.1 16.4 12 19 6.9-2.6 12-10.5 12-19V7L16 2zm0 2.2L26 8.4V13c0 7.4-4.4 14.3-10 16.7-5.6-2.4-10-9.3-10-16.7V8.4L16 4.2zM15 10v6h2v-6h-2zm0 8v2h2v-2h-2z"/>',
  secrets_manager:      '<path d="M24,14H22V8A6,6,0,0,0,10,8v6H8a2,2,0,0,0-2,2V28a2,2,0,0,0,2,2H24a2,2,0,0,0,2-2V16A2,2,0,0,0,24,14ZM12,8a4,4,0,0,1,8,0v6H12ZM24,28H8V16H24Z"/>',
  scc:                  '<path d="M26,14a6,6,0,0,0-5.69-4.08A8,8,0,0,0,5,15a6,6,0,0,0,1,11.92h20A5,5,0,0,0,26,14ZM26,24H6a4,4,0,0,1-.6-7.95l1-.16.2-.95A6,6,0,0,1,18,11.83l.8.63.8-.57A4,4,0,0,1,26,14a3,3,0,0,1,0,6A1,1,0,0,0,26,22a3,3,0,0,1,0,2Z"/><path d="M16,14l-4,4,1.4,1.4,2.6-2.6,4.6,4.6,1.4-1.4Z"/>',
  event_notifications:  '<path d="M16,2A10,10,0,0,0,6,12v7L3,22v1H29V22l-3-3V12A10,10,0,0,0,16,2ZM8,12a8,8,0,0,1,16,0v8H8ZM13,26a3,3,0,0,0,6,0Z"/>',
  continuous_delivery:  '<path d="M16,4A12,12,0,1,0,28,16,12,12,0,0,0,16,4Zm0,22A10,10,0,1,1,26,16,10,10,0,0,1,16,26ZM11,10H9v12h2Zm12,0H21v12h2ZM15,12H13v8h2Zm4,0H17v8h2Z"/>',
  schematics:           '<path d="M28,6H4A2,2,0,0,0,2,8V24a2,2,0,0,0,2,2H28a2,2,0,0,0,2-2V8A2,2,0,0,0,28,6ZM4,8H28V12H4ZM4,24V14H28V24Z"/><path d="M8,17H6V19H8Zm4,0H10V19h2Z"/>',
  toolchain:            '<path d="M26,18.4V14.6l-2.1-.5a8.9,8.9,0,0,0-.9-2.1l1.2-1.8L21.5,7.5l-1.8,1.2a8.9,8.9,0,0,0-2.1-.9L17.1,5.7H14.9l-.5,2.1a8.9,8.9,0,0,0-2.1.9L10.5,7.5,7.8,10.2l1.2,1.8a8.9,8.9,0,0,0-.9,2.1L6,14.6v3.8l2.1.5a8.9,8.9,0,0,0,.9,2.1l-1.2,1.8,2.7,2.7,1.8-1.2a8.9,8.9,0,0,0,2.1.9l.5,2.1h2.2l.5-2.1a8.9,8.9,0,0,0,2.1-.9l1.8,1.2,2.7-2.7-1.2-1.8a8.9,8.9,0,0,0,.9-2.1ZM16,19a3,3,0,1,1,3-3A3,3,0,0,1,16,19Z"/>',
  user:                 '<path d="M16,4a6,6,0,1,0,6,6A6,6,0,0,0,16,4Zm0,10a4,4,0,1,1,4-4A4,4,0,0,1,16,14Zm10,14H6V26a6,6,0,0,1,6-6h8a6,6,0,0,1,6,6Zm-18-2H24a4,4,0,0,0-4-4H12A4,4,0,0,0,8,26Z"/>',
  internet:             '<path d="M16,2A14,14,0,1,0,30,16,14,14,0,0,0,16,2Zm8.9,13H19.9a17.2,17.2,0,0,0-1.2-6.5A12.1,12.1,0,0,1,24.9,15ZM16,4a15.4,15.4,0,0,1,1.9,4.5H14.1A15.4,15.4,0,0,1,16,4ZM13.8,10.5h4.4A15.1,15.1,0,0,1,19,15H13A15.1,15.1,0,0,1,13.8,10.5ZM7.1,17H12.1a17.2,17.2,0,0,0,1.2,6.5A12.1,12.1,0,0,1,7.1,17Zm5-2A12.1,12.1,0,0,1,7.1,8.5,17.2,17.2,0,0,0,12.1,15Zm1.7,2H18.2A15.1,15.1,0,0,1,17,21.5H15A15.1,15.1,0,0,1,13.8,17ZM16,28a15.4,15.4,0,0,1-1.9-4.5h3.8A15.4,15.4,0,0,1,16,28Zm2.7-4.5a17.2,17.2,0,0,0,1.2-6.5h5A12.1,12.1,0,0,1,18.7,23.5Z"/>',
  enterprise_directory: '<path d="M16,2A14,14,0,1,0,30,16,14,14,0,0,0,16,2Zm0,4a4,4,0,1,1-4,4A4,4,0,0,1,16,6Zm0,20a9.98,9.98,0,0,1-7.07-2.93,8.02,8.02,0,0,1,14.14,0A9.98,9.98,0,0,1,16,26Z"/>',
  enterprise_users:     '<path d="M12,4a4,4,0,1,0,4,4A4,4,0,0,0,12,4Zm0,6a2,2,0,1,1,2-2A2,2,0,0,1,12,10Zm8,4a4,4,0,1,0,4-4A4,4,0,0,0,20,14Zm4,6a6,6,0,0,0-4.4-1.9A6,6,0,0,0,12,16H6a6,6,0,0,0-6,6v4H18V26h2v2H30V22A2,2,0,0,0,28,20ZM6,18h6a4,4,0,0,1,4,4v2H2V22A4,4,0,0,1,6,18Zm22,8H22V22a4,4,0,0,1,4-4h2Z"/>',
  enterprise_apps:      '<path d="M26,14H20a2,2,0,0,1-2-2V6a2,2,0,0,1,2-2h6a2,2,0,0,1,2,2v6A2,2,0,0,1,26,14ZM20,6v6h6V6ZM12,14H6a2,2,0,0,1-2-2V6A2,2,0,0,1,6,4h6a2,2,0,0,1,2,2v6A2,2,0,0,1,12,14ZM6,6v6h6V6ZM26,28H20a2,2,0,0,1-2-2V20a2,2,0,0,1,2-2h6a2,2,0,0,1,2,2v6A2,2,0,0,1,26,28ZM20,20v6h6V20ZM12,28H6a2,2,0,0,1-2-2V20a2,2,0,0,1,2-2h6a2,2,0,0,1,2,2v6A2,2,0,0,1,12,28ZM6,20v6h6V20Z"/>',
  enterprise_data:      '<path d="M26,4H6A2,2,0,0,0,4,6V26a2,2,0,0,0,2,2H26a2,2,0,0,0,2-2V6A2,2,0,0,0,26,4ZM6,6H26V11H6ZM6,13H26v6H6ZM6,26V21H26v5ZM9,8h2v2H9Zm0,7h2v2H9Zm0,8h2v2H9Z"/>',
};

function netIconSvg(id) {
  const paths = NET_ICONS[id];
  if (!paths) return '';
  return `<svg class="net-card-icon" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" fill="currentColor">${paths}</svg>`;
}

// ── Architecture diagram reference data ───────────────────────────────────────
// Defines the high-level VPC reference architecture for Financial Services / Enterprise VPCs
// Management VPC has secure connection options; Workload VPC has public connection options.

const ARCH_REGISTRY = {
  // Public Network column (left)
  public_network: {
    title: 'Public Network (Consumer)',
    items: [
      { id: 'public_user', icon: 'user', label: 'User', color: '#0f62fe', category: 'Consumer', desc: 'End users and external clients accessing services over the Internet' },
      { id: 'public_internet', icon: 'internet', label: 'Internet', color: '#0043ce', category: 'Public Network', desc: 'Public Internet transport network' }
    ]
  },
  // Enterprise Network column (right)
  enterprise_network: {
    title: 'Enterprise Network (Provider)',
    items: [
      { id: 'ent_dir', icon: 'enterprise_directory', label: 'Enterprise User Directory', color: '#161616', category: 'Enterprise', desc: 'Corporate Active Directory / LDAP identity store' },
      { id: 'ent_users', icon: 'enterprise_users', label: 'Enterprise Users', color: '#161616', category: 'Enterprise', desc: 'Internal enterprise employees, operators, and administrators' },
      { id: 'ent_apps', icon: 'enterprise_apps', label: 'Enterprise Applications', color: '#8a3ffc', category: 'Enterprise', desc: 'On-premises enterprise applications and systems of record' },
      { id: 'ent_data', icon: 'enterprise_data', label: 'Enterprise Data', color: '#0f62fe', category: 'Enterprise', desc: 'On-premises enterprise databases and storage mainframes' }
    ]
  },
  // Management VPC (Hub / Operations / Ingress) - Secure Connection focus
  mgmt_vpc: {
    title: 'Management VPC',
    tag: 'Hub & Management',
    desc: 'Central management and operations hub with secure connectivity endpoints, bastion hosts, and admin services.',
    connOptionsTitle: 'Secure Connection Options',
    connOptions: [
      { id: 'direct_link', icon: 'direct_link', label: 'Direct Link 2.0', color: '#0072c3', type: 'Private Dedicated', desc: 'Dedicated 50 Mbps–100 Gbps private connection bypassing public Internet' },
      { id: 'vpn_s2s', icon: 'vpn_s2s', label: 'Site-to-Site VPN', color: '#da1e28', type: 'IPsec / Secure', desc: 'Encrypted IPsec tunnels over Internet or Direct Link backup' },
      { id: 'vpn_c2s', icon: 'vpn_c2s', label: 'Client-to-Site VPN', color: '#da1e28', type: 'TLS / OpenVPN', desc: 'High-availability OpenVPN gateway for enterprise operators and admins' },
      { id: 'vpc_peering', icon: 'vpc_peering', label: 'VPC Peering', color: '#007d79', type: 'Backbone Peering', desc: 'Direct non-transitive VPC routing on IBM Cloud global backbone' }
    ],
    zone: {
      name: 'Zone 1',
      acls: [
        {
          name: 'ACL1',
          purpose: 'VPN Subnet',
          items: [
            { id: 'vpn_s2s', icon: 'vpn_s2s', label: 'VPN Gateway', color: '#da1e28', desc: 'Site-to-site & client-to-site VPN gateway for secure operator ingress' }
          ]
        },
        {
          name: 'ACL2',
          purpose: 'Bastion Subnet',
          items: [
            { id: 'bastion', icon: 'bastion', label: 'Bastion Host', color: '#da1e28', desc: 'Hardened jump host for secure administrative shell access' }
          ]
        },
        {
          name: 'ACL3',
          purpose: 'Compute & Storage Subnet',
          items: [
            { id: 'vsi', icon: 'vsi', label: 'VSI', color: '#007d79', desc: 'Virtual Server Instance for management and monitoring tooling' },
            { id: 'vsi', icon: 'vsi', label: 'VSI', color: '#007d79', desc: 'Secondary VSI for high-availability management cluster' },
            { id: 'block_storage', icon: 'block_storage', label: 'Block Storage', color: '#0f62fe', desc: 'Encrypted high-IOPS persistent storage volume for VSIs' }
          ]
        },
        {
          name: 'ACL4',
          purpose: 'ROKS Container Subnet',
          items: [
            { id: 'roks', icon: 'roks', label: 'ROKS', color: '#007d79', desc: 'Red Hat OpenShift on IBM Cloud management cluster node' },
            { id: 'roks', icon: 'roks', label: 'ROKS', color: '#007d79', desc: 'Red Hat OpenShift on IBM Cloud secondary worker node' },
            { id: 'block_storage', icon: 'block_storage', label: 'Block Storage', color: '#0f62fe', desc: 'Encrypted volume for OpenShift stateful storage' }
          ]
        },
        {
          name: 'ACL5',
          purpose: 'Private Endpoint Subnet',
          items: [
            { id: 'vpe', icon: 'vpe', label: 'VPE', color: '#0072c3', desc: 'Virtual Private Endpoint gateway for Cloud Logs & Monitoring' },
            { id: 'vpe', icon: 'vpe', label: 'VPE', color: '#0072c3', desc: 'Virtual Private Endpoint gateway for Key Protect / COS' }
          ]
        }
      ]
    }
  },
  // Workload VPC (Spoke / Production Applications) - Public Connection focus
  workload_vpc: {
    title: 'Workload VPC',
    tag: 'Production Workloads',
    desc: 'Production application VPC hosting business logic, microservices, databases, and public/private ingress load balancers.',
    connOptionsTitle: 'Public Connection Options',
    connOptions: [
      { id: 'cis', icon: 'cis', label: 'Cloud Internet Services', color: '#ba4e00', type: 'Edge WAF / DDoS / CDN', desc: 'Global Cloudflare edge protection, WAF, DDoS mitigation & GLB' },
      { id: 'alb', icon: 'alb', label: 'Application Load Balancer (Public)', color: '#ba4e00', type: 'Layer-7 Public Ingress', desc: 'Public-facing HTTP/HTTPS TLS-terminating load balancer' },
      { id: 'nlb', icon: 'nlb', label: 'Network Load Balancer (Public)', color: '#ba4e00', type: 'Layer-4 Public Ingress', desc: 'Public high-throughput TCP/UDP load balancer with static IPs' },
      { id: 'floating_ip', icon: 'floating_ip', label: 'Floating IP', color: '#ba4e00', type: 'Direct Public IP', desc: 'Directly addressable public IPv4 address attached to instance VNIs' },
      { id: 'public_address_ranges', icon: 'public_address_ranges', label: 'Public Address Ranges', color: '#ba4e00', type: 'BYOIP / Ingress Routing', desc: 'Contiguous public CIDR allocation with custom ingress routing' }
    ],
    zone: {
      name: 'Zone 1',
      acls: [
        {
          name: 'ACL1',
          purpose: 'Compute & App Subnet',
          items: [
            { id: 'vsi', icon: 'vsi', label: 'VSI', color: '#007d79', desc: 'Virtual Server Instance running core production microservices' },
            { id: 'vsi', icon: 'vsi', label: 'VSI', color: '#007d79', desc: 'Virtual Server Instance for multi-zone resilience' },
            { id: 'block_storage', icon: 'block_storage', label: 'Block Storage', color: '#0f62fe', desc: 'Dedicated block storage volume for application workloads' }
          ]
        },
        {
          name: 'ACL2',
          purpose: 'ROKS Cluster Subnet',
          items: [
            { id: 'roks', icon: 'roks', label: 'ROKS', color: '#007d79', desc: 'Production Red Hat OpenShift container worker instance' },
            { id: 'roks', icon: 'roks', label: 'ROKS', color: '#007d79', desc: 'Production Red Hat OpenShift container worker instance' },
            { id: 'block_storage', icon: 'block_storage', label: 'Block Storage', color: '#0f62fe', desc: 'Container storage volume for stateful OpenShift pods' }
          ]
        },
        {
          name: 'ACL3',
          purpose: 'VPE Gateway Subnet',
          items: [
            { id: 'vpe', icon: 'vpe', label: 'VPE', color: '#0072c3', desc: 'Virtual Private Endpoint gateway for Cloud Object Storage' },
            { id: 'vpe', icon: 'vpe', label: 'VPE', color: '#0072c3', desc: 'Virtual Private Endpoint gateway for Secrets Manager' }
          ]
        }
      ]
    }
  },
  // Cloud Services (Bottom panel)
  cloud_services: [
    {
      group: 'Logging & Monitoring',
      items: [
        { id: 'cloud_logs', icon: 'cloud_logs', label: 'Cloud Logs', color: '#007d79', desc: 'Centralised log analytics and long-term archival' },
        { id: 'cloud_monitoring', icon: 'cloud_monitoring', label: 'Cloud Monitoring', color: '#007d79', desc: 'Infrastructure metrics, dashboards, and alerting' }
      ]
    },
    {
      group: 'Container',
      items: [
        { id: 'container_registry', icon: 'container_registry', label: 'Container Registry', color: '#007d79', desc: 'Secure, private multi-tenant Docker container image registry' }
      ]
    },
    {
      group: 'Integration',
      items: [
        { id: 'event_streams', icon: 'event_streams', label: 'Event Streams', color: '#0f62fe', desc: 'Enterprise-grade Apache Kafka event streaming platform' }
      ]
    },
    {
      group: 'Networking',
      items: [
        { id: 'flow_logs', icon: 'flow_logs', label: 'Flow Logs', color: '#007d79', desc: 'VPC network traffic metadata collectors writing to COS' }
      ]
    },
    {
      group: 'Storage',
      items: [
        { id: 'backup_recovery', icon: 'backup_recovery', label: 'Backup for VPC', color: '#0f62fe', desc: 'Policy-based automated snapshots for Block & File storage' },
        { id: 'cloud_object_storage', icon: 'cloud_object_storage', label: 'Object Storage', color: '#0f62fe', desc: 'Durable S3-compatible cloud object storage' }
      ]
    },
    {
      group: 'Security',
      items: [
        { id: 'app_id', icon: 'app_id', label: 'App ID', color: '#da1e28', desc: 'User authentication and authorization for web & mobile apps' },
        { id: 'iam', icon: 'iam', label: 'IAM', color: '#da1e28', desc: 'Identity & Access Management, access policies and trusted profiles' },
        { id: 'hpcs', icon: 'hpcs', label: 'HPCS / Key Protect', color: '#da1e28', desc: 'Hardware security module (FIPS 140-2 Level 4) & key management' },
        { id: 'secrets_manager', icon: 'secrets_manager', label: 'Secrets Manager', color: '#da1e28', desc: 'Centralised vault for API keys, TLS certificates, and secrets' },
        { id: 'scc', icon: 'scc', label: 'SCC WP', color: '#da1e28', desc: 'Security and Compliance Center Workload Protection' }
      ]
    },
    {
      group: 'Developer Tools',
      items: [
        { id: 'event_notifications', icon: 'event_notifications', label: 'Event Notifications', color: '#007d79', desc: 'Routing critical events to email, SMS, webhooks, and Slack' },
        { id: 'continuous_delivery', icon: 'continuous_delivery', label: 'Continuous Delivery', color: '#ee5396', desc: 'Automated CI/CD toolchains with Tekton pipelines' },
        { id: 'schematics', icon: 'schematics', label: 'Schematics', color: '#ee5396', desc: 'Managed Terraform automation for infrastructure deployment' },
        { id: 'toolchain', icon: 'toolchain', label: 'Toolchain', color: '#ee5396', desc: 'Integrated DevOps toolchains for agile delivery' }
      ]
    }
  ]
};

// Helper to render an architecture node card (clickable icon block)
function renderArchNode(node, extraClasses = '') {
  const p = (state.products ?? []).find(x => x.id === node.id);
  const isSelected = state.archSelected === node.id;
  const isDimmed = state.query && p && !matchesQuery(p, state.query);
  const isQueryHit = state.query && p && matchesQuery(p, state.query);

  const classes = [
    'arch-node',
    extraClasses,
    isSelected ? 'is-selected' : '',
    isDimmed ? 'is-dimmed' : '',
    isQueryHit ? 'is-query-hit' : ''
  ].filter(Boolean).join(' ');

  const iconSvg = NET_ICONS[node.icon] ?? NET_ICONS[node.id] ?? NET_ICONS.vpc_core;

  return `
    <div class="${classes}"
         data-id="${node.id}"
         data-arch-label="${node.label}"
         data-arch-desc="${node.desc || ''}"
         tabindex="0"
         role="button"
         aria-label="${node.label}"
         title="${node.label}: ${node.desc || ''}"
         style="--arch-color:${node.color || '#0f62fe'}">
      <div class="arch-node-icon-box" style="background-color:${node.color || '#0f62fe'}">
        <svg class="arch-icon-svg" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" fill="currentColor">
          ${iconSvg}
        </svg>
      </div>
      <div class="arch-node-label">${node.label}</div>
      ${node.type ? `<div class="arch-node-type">${node.type}</div>` : ''}
    </div>`;
}

// ── Render Architecture View ──────────────────────────────────────────────────
function renderArchitecture() {
  const reg = ARCH_REGISTRY;

  let html = `<div class="arch-view-wrapper">`;

  // Top header banner
  html += `
    <div class="arch-top-bar">
      <div class="arch-top-title">
        <svg class="arch-title-icon" viewBox="0 0 32 32" width="20" height="20" fill="currentColor">
          <path d="M23.4141,22-13.4141-13.4141V2H2v8h6.5859l13.4141,13.4141v6.5859h8v-8h-6.5859ZM8,8H4V4h4v4Zm20,20h-4v-4h4v4Z"/>
        </svg>
        <span>High-Level VPC Reference Architecture for Enterprise & Financial Services</span>
      </div>
      <div class="arch-traffic-legend">
        <span class="arch-legend-note">Network Traffic (All TLS 1.2+):</span>
        <span class="arch-traffic-pill pill-public"><span class="pill-dot"></span>Public</span>
        <span class="arch-traffic-pill pill-private"><span class="pill-dot"></span>Private</span>
        <span class="arch-traffic-pill pill-secure"><span class="pill-dot"></span>Secure / VPN</span>
      </div>
    </div>`;

  // Main 3-column architecture container
  html += `<div class="arch-diagram-grid">`;

  // ── LEFT: Public Network (Consumer) ──
  html += `
    <div class="arch-col arch-col-consumer">
      <div class="arch-col-header">
        <div class="arch-col-title">
          <svg viewBox="0 0 32 32" width="16" height="16" fill="currentColor"><path d="M16 2L3 9.5v13L16 30l13-7.5v-13L16 2z"/></svg>
          ${reg.public_network.title}
        </div>
      </div>
      <div class="arch-col-body arch-col-consumer-body">
        <div class="arch-consumer-flow">
          ${renderArchNode(reg.public_network.items[0], 'arch-consumer-node')}
          <div class="arch-v-line"></div>
          ${renderArchNode(reg.public_network.items[1], 'arch-consumer-node')}
        </div>
      </div>
    </div>`;

  // ── CENTER: IBM Cloud Region A ──
  html += `
    <div class="arch-col arch-col-cloud">
      <div class="arch-region-box">
        <div class="arch-region-header">
          <span class="arch-cloud-brand">
            <svg viewBox="0 0 32 32" width="16" height="16" fill="currentColor"><path d="M26 14a6 6 0 0 0-5.69-4.08A8 8 0 0 0 5 15a6 6 0 0 0 1 11.92h20A5 5 0 0 0 26 14z"/></svg>
            IBM Cloud
          </span>
          <span class="arch-region-label">
            <svg viewBox="0 0 32 32" width="14" height="14" fill="currentColor"><path d="M16,2A10,10,0,0,0,6,12c0,7.5,10,18,10,18s10-10.5,10-18A10,10,0,0,0,16,2Zm0,14a4,4,0,1,1,4-4A4,4,0,0,1,16,16Z"/></svg>
            Region A (Multi-Zone)
          </span>
        </div>

        <div class="arch-vpcs-wrapper">

          <!-- ── MANAGEMENT VPC (Secure Connection Options) ── -->
          <div class="arch-vpc-card arch-vpc-mgmt">
            <div class="arch-vpc-header">
              <div class="arch-vpc-title-row">
                <span class="arch-vpc-icon">
                  <svg viewBox="0 0 32 32" width="16" height="16" fill="currentColor"><path d="M23.4141,22,10,8.5859V2H2v8H8.5859L22,23.4141V30h8V22ZM8,8H4V4H8ZM28,28H24V24h4Z"/></svg>
                </span>
                <span class="arch-vpc-title">${reg.mgmt_vpc.title}</span>
                <span class="arch-vpc-badge mgmt-badge">${reg.mgmt_vpc.tag}</span>
              </div>
              <div class="arch-vpc-desc">${reg.mgmt_vpc.desc}</div>
            </div>

            <!-- Ingress Options Toolbar (Management VPC = Secure Connection Options) -->
            <div class="arch-conn-options-bar secure-options-bar">
              <div class="arch-conn-options-title">
                <svg viewBox="0 0 32 32" width="14" height="14" fill="currentColor"><path d="M24,14H22V8A6,6,0,0,0,10,8v6H8a2,2,0,0,0-2,2V28a2,2,0,0,0,2,2H24a2,2,0,0,0,2-2V16A2,2,0,0,0,24,14ZM12,8a4,4,0,0,1,8,0v6H12ZM24,28H8V16H24Z"/></svg>
                ${reg.mgmt_vpc.connOptionsTitle}
              </div>
              <div class="arch-conn-options-grid">
                ${reg.mgmt_vpc.connOptions.map(opt => renderArchNode(opt, 'arch-conn-node')).join('')}
              </div>
            </div>

            <!-- Zone 1 Box -->
            <div class="arch-zone-box">
              <div class="arch-zone-title">
                <svg viewBox="0 0 32 32" width="14" height="14" fill="currentColor"><path d="M26,4H6A2,2,0,0,0,4,6V26a2,2,0,0,0,2,2H26a2,2,0,0,0,2-2V6A2,2,0,0,0,26,4Zm0,22H6V6H26Z"/></svg>
                ${reg.mgmt_vpc.zone.name}
              </div>
              <div class="arch-zone-content">
                <!-- Ingress LB -->
                <div class="arch-ingress-node-col">
                  ${renderArchNode({ id: 'nlb', icon: 'nlb', label: 'Private LB', color: '#0072c3', desc: 'Private load balancer for internal administrative ingress' }, 'arch-gateway-node')}
                </div>
                <!-- ACL Subnets Grid -->
                <div class="arch-acls-grid">
                  ${reg.mgmt_vpc.zone.acls.map(acl => `
                    <div class="arch-acl-block">
                      <div class="arch-acl-header">
                        <svg viewBox="0 0 32 32" width="12" height="12" fill="currentColor"><path d="M18,28H14a2,2,0,0,1-2-2V18.41L4.59,11A2,2,0,0,1,4,9.59V6A2,2,0,0,1,6,4H26a2,2,0,0,1,2,2V9.59A2,2,0,0,1,27.41,11L20,18.41V26A2,2,0,0,1,18,28Z"/></svg>
                        <span class="arch-acl-name">${acl.name}</span>
                      </div>
                      <div class="arch-acl-items">
                        ${acl.items.map(item => renderArchNode(item)).join('')}
                      </div>
                    </div>
                  `).join('')}
                </div>
              </div>
            </div>
          </div>

          <!-- ── WORKLOAD VPC (Public Connection Options) ── -->
          <div class="arch-vpc-card arch-vpc-workload">
            <div class="arch-vpc-header">
              <div class="arch-vpc-title-row">
                <span class="arch-vpc-icon">
                  <svg viewBox="0 0 32 32" width="16" height="16" fill="currentColor"><path d="M23.4141,22,10,8.5859V2H2v8H8.5859L22,23.4141V30h8V22ZM8,8H4V4H8ZM28,28H24V24h4Z"/></svg>
                </span>
                <span class="arch-vpc-title">${reg.workload_vpc.title}</span>
                <span class="arch-vpc-badge workload-badge">${reg.workload_vpc.tag}</span>
              </div>
              <div class="arch-vpc-desc">${reg.workload_vpc.desc}</div>
            </div>

            <!-- Ingress Options Toolbar (Workload VPC = Public Connection Options) -->
            <div class="arch-conn-options-bar public-options-bar">
              <div class="arch-conn-options-title">
                <svg viewBox="0 0 32 32" width="14" height="14" fill="currentColor"><path d="M28,11a13.9563,13.9563,0,0,0-4.1051-9.8949L22.4813,2.5187A11.9944,11.9944,0,0,1,5.5568,19.5194l-.0381-.0381L4.1051,20.8949A13.9563,13.9563,0,0,0,14,25v3H10v2H20V28H16V24.84A14.0094,14.0094,0,0,0,28,11Z"/></svg>
                ${reg.workload_vpc.connOptionsTitle}
              </div>
              <div class="arch-conn-options-grid">
                ${reg.workload_vpc.connOptions.map(opt => renderArchNode(opt, 'arch-conn-node')).join('')}
              </div>
            </div>

            <!-- Zone 1 Box -->
            <div class="arch-zone-box">
              <div class="arch-zone-title">
                <svg viewBox="0 0 32 32" width="14" height="14" fill="currentColor"><path d="M26,4H6A2,2,0,0,0,4,6V26a2,2,0,0,0,2,2H26a2,2,0,0,0,2-2V6A2,2,0,0,0,26,4Zm0,22H6V6H26Z"/></svg>
                ${reg.workload_vpc.zone.name}
              </div>
              <div class="arch-zone-content">
                <!-- Ingress LB -->
                <div class="arch-ingress-node-col">
                  ${renderArchNode({ id: 'alb', icon: 'alb', label: 'Private / Public LB', color: '#0072c3', desc: 'Layer-7 Application Load Balancer with TLS termination' }, 'arch-gateway-node')}
                </div>
                <!-- ACL Subnets Grid -->
                <div class="arch-acls-grid">
                  ${reg.workload_vpc.zone.acls.map(acl => `
                    <div class="arch-acl-block">
                      <div class="arch-acl-header">
                        <svg viewBox="0 0 32 32" width="12" height="12" fill="currentColor"><path d="M18,28H14a2,2,0,0,1-2-2V18.41L4.59,11A2,2,0,0,1,4,9.59V6A2,2,0,0,1,6,4H26a2,2,0,0,1,2,2V9.59A2,2,0,0,1,27.41,11L20,18.41V26A2,2,0,0,1,18,28Z"/></svg>
                        <span class="arch-acl-name">${acl.name}</span>
                      </div>
                      <div class="arch-acl-items">
                        ${acl.items.map(item => renderArchNode(item)).join('')}
                      </div>
                    </div>
                  `).join('')}
                </div>
              </div>
            </div>
          </div>

          <!-- ── TRANSIT GATEWAY HUB INTERCONNECT ── -->
          <div class="arch-tgw-banner">
            <div class="arch-tgw-badge">
              ${renderArchNode({ id: 'transit_gateway', icon: 'transit_gateway', label: 'Transit Gateway', color: '#0072c3', desc: 'Interconnects Management VPC, Workload VPC, Direct Link, and VPN with BGP routing' }, 'arch-tgw-node')}
            </div>
            <div class="arch-tgw-text">
              <span class="arch-tgw-title">Global Backbone Interconnect</span>
              <span class="arch-tgw-desc">Cross-VPC private routing, Direct Link aggregation, and on-premise hub connection</span>
            </div>
          </div>

          <!-- ── CLOUD SERVICES PANEL (Bottom Box) ── -->
          <div class="arch-cloud-services-box">
            <div class="arch-cloud-services-header">
              <svg viewBox="0 0 32 32" width="16" height="16" fill="currentColor"><path d="M26 14a6 6 0 0 0-5.69-4.08A8 8 0 0 0 5 15a6 6 0 0 0 1 11.92h20A5 5 0 0 0 26 14z"/></svg>
              <span>Cloud Services (Integrated via Private Endpoints / VPE)</span>
            </div>
            <div class="arch-services-grid">
              ${reg.cloud_services.map(group => `
                <div class="arch-service-group">
                  <div class="arch-service-group-title">${group.group}</div>
                  <div class="arch-service-group-items">
                    ${group.items.map(item => renderArchNode(item, 'arch-service-node')).join('')}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>

        </div>
      </div>
    </div>`;

  // ── RIGHT: Enterprise Network (Provider) ──
  html += `
    <div class="arch-col arch-col-provider">
      <div class="arch-col-header">
        <div class="arch-col-title">
          <svg viewBox="0 0 32 32" width="16" height="16" fill="currentColor"><path d="M26 4H6A2 2 0 0 0 4 6v20a2 2 0 0 0 2 2h20a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"/></svg>
          ${reg.enterprise_network.title}
        </div>
      </div>
      <div class="arch-col-body arch-col-provider-body">
        <div class="arch-provider-flow">
          ${reg.enterprise_network.items.map((item, idx) => `
            ${renderArchNode(item, 'arch-provider-node')}
            ${idx < reg.enterprise_network.items.length - 1 ? '<div class="arch-v-line"></div>' : ''}
          `).join('')}
        </div>
      </div>
    </div>`;

  html += `</div>`; // .arch-diagram-grid
  html += `</div>`; // .arch-view-wrapper

  return html;
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

// ── Map view (radial) ─────────────────────────────────────────────────────────
function inodeClasses(p) {
  const classes = ['inode'];
  if (p.hub) classes.push('is-hub');
  if (state.activeId && state.activeId === p.id) classes.push('is-active');

  if (state.query) {
    classes.push(matchesQuery(p, state.query) ? 'is-query-hit' : 'is-dimmed');
  } else if (state.activeId && state.activeId !== p.id) {
    const connected = getConnectedIds(state.activeId);
    classes.push(connected.has(p.id) ? 'is-highlighted' : 'is-dimmed');
  }
  return classes.join(' ');
}

function renderGrid() {
  const cats    = state.plays.categories;
  const intCats = GRID_INTEGRATION_CATS.filter(id => cats.find(c => c.id === id));
  const hub     = state.products.find(p => p.hub) || state.products.find(p => p.cat === 'vpc');
  const hubPlay = cats.find(c => c.id === 'vpc');
  const hubPlayId = hubPlay?.playId ?? 0;
  const hubColor  = laneColor(hubPlayId);

  const lanes = intCats.map(catId => {
    const cat  = cats.find(c => c.id === catId);
    const products = state.products.filter(p => p.cat === catId);
    return {
      catId,
      label: cat?.label ?? catId,
      playId: cat?.playId ?? 0,
      color: laneColor(cat?.playId ?? 0),
      products,
    };
  });

  const allItems = [];
  for (const lane of lanes) {
    for (const p of lane.products) allItems.push({ p, lane });
  }
  const total = allItems.length || 1;

  // Canvas geometry — single hub filling the stage
  const CX = 500, CY = 500;
  const R_HUB = 92;
  const ITEM_R = 218;
  const SPOKE_START = R_HUB + 8;
  const LABEL_BAND_IN  = 308;
  const LABEL_BAND_OUT = 358;
  const LABEL_R1 = LABEL_BAND_IN + 16;
  const LABEL_R2 = LABEL_BAND_IN + 38;
  const VIEW = 1000;
  const PAD  = 28;

  const angStep = (2 * Math.PI) / total;
  const startAngle = -Math.PI / 2;

  let itemIdx = 0;
  for (const lane of lanes) {
    lane._startIdx = itemIdx;
    lane._endIdx   = itemIdx + lane.products.length - 1;
    itemIdx += lane.products.length;
  }
  allItems.forEach((obj, idx) => {
    obj.angle = startAngle + idx * angStep;
  });

  function wedgeD(ri, ro, a0, a1, laf) {
    const x00 = CX + ri * Math.cos(a0), y00 = CY + ri * Math.sin(a0);
    const x01 = CX + ri * Math.cos(a1), y01 = CY + ri * Math.sin(a1);
    const x10 = CX + ro * Math.cos(a0), y10 = CY + ro * Math.sin(a0);
    const x11 = CX + ro * Math.cos(a1), y11 = CY + ro * Math.sin(a1);
    return `M ${x00} ${y00} A ${ri} ${ri} 0 ${laf} 1 ${x01} ${y01} L ${x11} ${y11} A ${ro} ${ro} 0 ${laf} 0 ${x10} ${y10} Z`;
  }

  function arcPathAt(r, a0, a1, laf, onBottom) {
    if (onBottom) {
      const tx0 = CX + r * Math.cos(a1), ty0 = CY + r * Math.sin(a1);
      const tx1 = CX + r * Math.cos(a0), ty1 = CY + r * Math.sin(a0);
      return `M ${tx0} ${ty0} A ${r} ${r} 0 ${laf} 0 ${tx1} ${ty1}`;
    }
    const tx0 = CX + r * Math.cos(a0), ty0 = CY + r * Math.sin(a0);
    const tx1 = CX + r * Math.cos(a1), ty1 = CY + r * Math.sin(a1);
    return `M ${tx0} ${ty0} A ${r} ${r} 0 ${laf} 1 ${tx1} ${ty1}`;
  }

  let defs = '';
  let wedges = '';
  let bands = '';
  let spokes = '';
  let items = '';

  lanes.forEach((lane, gi) => {
    if (!lane.products.length) return;
    const ia0 = allItems[lane._startIdx].angle;
    const ia1 = allItems[lane._endIdx].angle;
    const arcPad = angStep * 0.45;
    const a0 = ia0 - arcPad;
    const a1 = ia1 + arcPad;
    const da = a1 - a0;
    const laf = da > Math.PI ? 1 : 0;
    const fillOpacity = gi % 2 === 0 ? 0.16 : 0.09;
    const bandOpacity = gi % 2 === 0 ? '1' : '0.7';

    wedges += `<g class="garc" style="--gc:${lane.color}">
      <path d="${wedgeD(R_HUB + 6, LABEL_BAND_OUT, a0, a1, laf)}"
            fill="${lane.color}" opacity="${fillOpacity}" />
    </g>`;

    const pid = `ap-${lane.catId}`;
    const arcMid = (a0 + a1) / 2;
    const onBottom = Math.sin(arcMid) > 0;
    const labelMidR = (LABEL_R1 + LABEL_R2) / 2;
    const words = lane.label.split(' ');
    // Prefer a single arc line when the lane name is short enough to fit
    const useTwoLines = lane.label.length > 22;

    if (useTwoLines) {
      defs += `<path id="${pid}a" d="${arcPathAt(LABEL_R1, a0, a1, laf, onBottom)}" fill="none"/>`;
      defs += `<path id="${pid}b" d="${arcPathAt(LABEL_R2, a0, a1, laf, onBottom)}" fill="none"/>`;
    } else {
      defs += `<path id="${pid}a" d="${arcPathAt(labelMidR, a0, a1, laf, onBottom)}" fill="none"/>`;
    }

    let lineA = '';
    let lineB = '';
    if (useTwoLines) {
      let mid = Math.ceil(words.length / 2);
      if (words[mid - 1] === '&') mid += 1;
      else if (words[mid] === '&') mid += 1;
      lineA = words.slice(0, mid).join(' ').toUpperCase();
      lineB = words.slice(mid).join(' ').toUpperCase();
      if (onBottom) { const tmp = lineA; lineA = lineB; lineB = tmp; }
    } else {
      lineA = lane.label.toUpperCase();
    }

    bands += `<g class="arc-lbl" style="--gc:${lane.color}">
      <path d="${wedgeD(LABEL_BAND_IN, LABEL_BAND_OUT, a0, a1, laf)}"
            fill="${lane.color}" opacity="${bandOpacity}" />
      <text class="arc-lbl-text"><textPath href="#${pid}a" startOffset="50%" text-anchor="middle">${escHtml(lineA)}</textPath></text>
      ${lineB ? `<text class="arc-lbl-text"><textPath href="#${pid}b" startOffset="50%" text-anchor="middle">${escHtml(lineB)}</textPath></text>` : ''}
      <title>${escHtml(lane.label)} (${lane.products.length})</title>
    </g>`;
  });

  for (const obj of allItems) {
    const { p, lane, angle } = obj;
    const ix = CX + ITEM_R * Math.cos(angle);
    const iy = CY + ITEM_R * Math.sin(angle);
    const rotDeg = angle * 180 / Math.PI;
    const textFlip = Math.cos(angle) < -0.08;
    const maxChars = 28;
    const label = p.label.length > maxChars ? p.label.slice(0, maxChars - 1) + '…' : p.label;
    const cls = inodeClasses(p);

    spokes += `<line class="spoke ${cls.includes('is-dimmed') ? 'is-dimmed' : ''} ${cls.includes('is-active') || cls.includes('is-highlighted') || cls.includes('is-query-hit') ? 'is-lit' : ''}"
      x1="${CX + SPOKE_START * Math.cos(angle)}"
      y1="${CY + SPOKE_START * Math.sin(angle)}"
      x2="${ix - 14 * Math.cos(angle)}"
      y2="${iy - 14 * Math.sin(angle)}"
      stroke="${lane.color}" />`;

    items += `<g class="${cls}" data-id="${escHtml(p.id)}" style="--ic:${lane.color}"
      transform="translate(${ix},${iy}) rotate(${textFlip ? rotDeg + 180 : rotDeg})"
      role="button" tabindex="0" aria-label="${escHtml(p.label)}">
      <rect x="-110" y="-12" width="220" height="24" fill="transparent" />
      <text class="fg" y="4">${escHtml(label)}</text>
      <title>${escHtml(p.label)}${p.status && p.status !== 'ga' ? ` · ${p.status}` : ''}</title>
    </g>`;
  }

  const hubCls = hub ? inodeClasses(hub).replace('inode', 'hub') : 'hub';
  const productCount = allItems.length;
  const laneCount = lanes.filter(l => l.products.length).length;

  const hubNode = hub ? `
    <g class="${hubCls}" data-id="${escHtml(hub.id)}" style="--hc:${hubColor}"
       transform="translate(${CX},${CY})" role="button" tabindex="0"
       aria-label="${escHtml(hub.label)}">
      <circle class="hc" r="${R_HUB}" />
      <text class="hub-ibm" y="-28">IBM Cloud</text>
      <text class="hub-nm" y="8">VPC</text>
      <text class="hub-st" y="36">${laneCount} lanes · ${productCount} services</text>
      <title>${escHtml(hub.label)}</title>
    </g>` : '';

  return `<div class="map-stage">
    <svg class="synergy-map" viewBox="${-PAD} ${-PAD} ${VIEW + PAD * 2} ${VIEW + PAD * 2}"
         role="img" aria-label="IBM Cloud VPC Synergies Map — radial service map">
      <defs>${defs}</defs>
      <g class="g-wedges">${wedges}</g>
      <g class="g-spokes">${spokes}</g>
      <g class="g-items">${items}</g>
      <g class="g-bands">${bands}</g>
      <g class="g-hubs">${hubNode}</g>
    </svg>
  </div>`;
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

  const isNetwork     = state.viewMode === 'network';
  const isArch        = state.viewMode === 'architecture';

  main.classList.toggle('is-map', state.viewMode === 'grid');

  if (state.viewMode === 'grid') {
    main.innerHTML = renderGrid();
  } else if (state.viewMode === 'architecture') {
    main.innerHTML = renderArchitecture();
  } else if (state.viewMode === 'network') {
    main.innerHTML = renderNetwork();
  } else {
    main.innerHTML = renderGrid();
  }

  // Sidebar — shown in map, architecture, and network views
  const sidebar        = document.getElementById('sidebar');
  const sidebarContent = document.getElementById('sidebarContent');
  if (isNetwork) {
    // Network handles sidebar on node click
    if (!state.netSelected) {
      sidebar.classList.remove('is-open');
      main.classList.remove('sidebar-open');
      sidebarContent.innerHTML = '';
    }
  } else if (isArch) {
    if (state.archSelected) {
      const p = (state.products ?? []).find(x => x.id === state.archSelected);
      if (p) {
        sidebarContent.innerHTML = renderSidebar(state.archSelected);
        sidebar.classList.add('is-open');
        main.classList.add('sidebar-open');
      } else {
        sidebar.classList.remove('is-open');
        main.classList.remove('sidebar-open');
        sidebarContent.innerHTML = '';
      }
    } else {
      sidebar.classList.remove('is-open');
      main.classList.remove('sidebar-open');
      sidebarContent.innerHTML = '';
    }
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

  // ── Architecture card click handlers ──
  if (isArch) {
    main.querySelectorAll('.arch-node[data-id]').forEach(el => {
      const handleSelect = (e) => {
        e.stopPropagation();
        const id = el.dataset.id;
        state.archSelected = state.archSelected === id ? null : id;
        render();
      };
      el.addEventListener('click', handleSelect);
      el.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleSelect(e);
        }
      });
    });
  }

  // ── Card / map node click handlers ──
  if (!isNetwork && !isArch) {
    main.querySelectorAll('[data-id]').forEach(el => {
      const select = e => {
        e.stopPropagation();
        const id = el.dataset.id;
        state.activeId = state.activeId === id ? null : id;
        render();
      };
      el.addEventListener('click', select);
      el.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          select(e);
        }
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
  if (hash === 'architecture') state.viewMode = 'architecture';
  if (hash === 'network')      state.viewMode = 'network';
  // Legacy hashes for removed tabs fall back to map
  if (hash === 'matrix' || hash === 'profiles' || hash === 'availability') {
    state.viewMode = 'grid';
  }
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
