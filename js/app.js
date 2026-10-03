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
  viewMode:          'grid', // 'grid' | 'matrix' | 'profiles' | 'availability' | 'integration'
  activeId:          null,
  integrationFilter: null,   // null = all dimmed; one of: 'compute'|'networking'|'storage'|'security'|'platform'
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

// ── Integration view ──────────────────────────────────────────────────────────
const PILLARS = [
  { id: 'compute',    label: 'Compute',     playVar: '--play-1' },
  { id: 'networking', label: 'Networking',  playVar: '--play-2' },
  { id: 'storage',    label: 'Storage',     playVar: '--play-3' },
  { id: 'security',   label: 'Security',    playVar: '--play-4' },
  { id: 'platform',   label: 'Platform',    playVar: '--play-6' },
];

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
  const isIntegration = state.viewMode === 'integration';

  if (state.viewMode === 'grid') {
    main.innerHTML = renderGrid();
  } else if (state.viewMode === 'integration') {
    main.innerHTML = renderIntegration();
  } else if (state.viewMode === 'matrix') {
    main.innerHTML = renderMatrix();
  } else if (state.viewMode === 'profiles') {
    main.innerHTML = renderProfiles();
  } else {
    main.innerHTML = renderAvailability();
  }

  // Sidebar — hidden in profiles, availability, and integration views
  const sidebar        = document.getElementById('sidebar');
  const sidebarContent = document.getElementById('sidebarContent');
  if (isProfiles || isAvail || isIntegration) {
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

  // ── Card click handlers (grid / matrix) ──
  main.querySelectorAll('[data-id]').forEach(el => {
    el.addEventListener('click', e => {
      e.stopPropagation();
      const id = el.dataset.id;
      state.activeId = state.activeId === id ? null : id;
      render();
    });
  });

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
      state.activeId = el.dataset.id;
      render();
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
    if (state.viewMode !== 'integration') state.integrationFilter = null;
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
