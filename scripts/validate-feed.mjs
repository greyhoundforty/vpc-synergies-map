#!/usr/bin/env node
// scripts/validate-feed.mjs
// Usage: node scripts/validate-feed.mjs [data/vpc]
import { readFileSync } from 'fs';
import { resolve } from 'path';

const VALID_STATUS  = new Set(['ga', 'partner', 'restricted', 'deprecated', 'coming_soon']);
const VALID_KIND    = new Set(['native', 'platform', 'optional']);

const dir  = process.argv[2] ?? 'data/vpc';
const base = resolve(dir);

function load(file) {
  const path = `${base}/${file}`;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    fatal(`Cannot read ${path}: ${e.message}`);
  }
}

let errors = 0;
let warnings = 0;

function err(msg)  { console.error(`  ✗ ERROR   ${msg}`);   errors++; }
function warn(msg) { console.warn (`  ⚠ WARNING ${msg}`);   warnings++; }
function ok(msg)   { console.log  (`  ✓ ${msg}`); }
function fatal(msg){ console.error(`FATAL: ${msg}`); process.exit(1); }

// ── Load files ────────────────────────────────────────────────────────────────
console.log(`\nValidating: ${base}\n`);

const plays    = load('plays.json');
const products = load('products.json');
const conns    = load('connections.json');

// ── plays.json ────────────────────────────────────────────────────────────────
console.log('── plays.json ──');

const catIds  = new Set(plays.categories.map(c => c.id));
const playIds = new Set(Object.values(plays.plays).map(p => p.id));

for (const [key, play] of Object.entries(plays.plays)) {
  if (play.id !== Number(key)) err(`plays["${key}"].id mismatch (expected ${key}, got ${play.id})`);
  if (!play.name)    err(`plays["${key}"] missing name`);
  if (!play.cat)     err(`plays["${key}"] missing cat`);
  if (!play.varName) err(`plays["${key}"] missing varName`);
  if (!catIds.has(play.cat)) err(`plays["${key}"].cat "${play.cat}" not found in categories`);
}

for (const cat of plays.categories) {
  if (!playIds.has(cat.playId)) err(`categories id="${cat.id}" references unknown playId ${cat.playId}`);
}

ok(`${catIds.size} lanes, ${playIds.size} plays`);

// ── products.json ─────────────────────────────────────────────────────────────
console.log('\n── products.json ──');

const productIds = new Set();
const REQUIRED_PRODUCT = ['id','label','cat','plays','hub','status','docsUrl','desc','value'];

for (const p of products) {
  // Required fields
  for (const f of REQUIRED_PRODUCT) {
    if (p[f] === undefined || p[f] === null || p[f] === '')
      err(`product "${p.id ?? '?'}" missing required field: ${f}`);
  }

  // Unique id
  if (productIds.has(p.id)) err(`duplicate product id: "${p.id}"`);
  productIds.add(p.id);

  // cat must be known
  if (!catIds.has(p.cat)) err(`product "${p.id}" cat "${p.cat}" not found in plays.json categories`);

  // plays must be known
  for (const pid of (p.plays ?? [])) {
    if (!playIds.has(pid)) err(`product "${p.id}" references unknown play id: ${pid}`);
  }

  // status
  if (!VALID_STATUS.has(p.status)) err(`product "${p.id}" invalid status: "${p.status}"`);

  // docsUrl
  if (p.docsUrl && !p.docsUrl.startsWith('https://'))
    err(`product "${p.id}" docsUrl must start with https://`);

  // questions warning
  if (!p.questions || p.questions.length < 2)
    warn(`product "${p.id}" has fewer than 2 discovery questions`);
}

ok(`${products.length} products, ${productIds.size} unique ids`);

// ── connections.json ──────────────────────────────────────────────────────────
console.log('\n── connections.json ──');

const edgeSet = new Set();
const REQUIRED_CONN = ['from','to','kind','mechanism','lane','status','summary','docsUrl'];

for (const c of conns) {
  // Required fields
  for (const f of REQUIRED_CONN) {
    if (c[f] === undefined || c[f] === null || c[f] === '')
      err(`connection ${c.from}→${c.to} missing required field: ${f}`);
  }

  // from/to must be known product ids
  if (!productIds.has(c.from)) err(`connection from="${c.from}" is not a known product id`);
  if (!productIds.has(c.to))   err(`connection to="${c.to}" is not a known product id`);

  // no self-loops
  if (c.from === c.to) err(`self-loop on product "${c.from}"`);

  // no duplicate undirected edges
  const key = [c.from, c.to].sort().join('|');
  if (edgeSet.has(key)) err(`duplicate undirected edge: ${c.from} ↔ ${c.to}`);
  edgeSet.add(key);

  // kind
  if (!VALID_KIND.has(c.kind)) err(`connection ${c.from}→${c.to} invalid kind: "${c.kind}"`);

  // status
  if (!VALID_STATUS.has(c.status)) err(`connection ${c.from}→${c.to} invalid status: "${c.status}"`);

  // lane
  if (!catIds.has(c.lane)) err(`connection ${c.from}→${c.to} lane "${c.lane}" not found in plays.json categories`);

  // docsUrl
  if (c.docsUrl && !c.docsUrl.startsWith('https://'))
    err(`connection ${c.from}→${c.to} docsUrl must start with https://`);
}

ok(`${conns.length} connections, ${edgeSet.size} unique undirected edges`);

// ── Summary ───────────────────────────────────────────────────────────────────
console.log('');
if (errors === 0 && warnings === 0) {
  console.log('✅  Feed valid — no errors, no warnings.\n');
  process.exit(0);
} else if (errors === 0) {
  console.log(`✅  Feed valid — 0 errors, ${warnings} warning(s).\n`);
  process.exit(0);
} else {
  console.log(`❌  Feed invalid — ${errors} error(s), ${warnings} warning(s).\n`);
  process.exit(1);
}
