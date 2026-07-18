// verify:loot — the LOOT-REFACTOR DIGEST GATE (Scavenger's Economy, build 1).
//
// Proves the loot-registry unification is byte-for-byte behavior-preserving. For
// every loot source kind across all three systems it runs N seeded rolls, digests
// the sorted item×count (+ canteen-fill) multiset per roll, and compares the hash
// to a committed baseline (scripts/loot-digest-baseline.json). Any drift in an
// item id, chance, count, threshold, or RNG call sequence changes a digest → FAIL.
//
// Runs headlessly under plain `node` (Node ≥22 type-stripping): the registry is a
// PURE module (type-only imports), so no browser / three.js is pulled.
//
//   node scripts/verify-loot-digest.mjs            # compare to baseline (the gate)
//   node scripts/verify-loot-digest.mjs --update   # (re)write the baseline
//
// The gate ALSO cross-checks the registry salvage roller against the live
// salvage.ts rollWreckLoot export, so the two can never silently diverge.

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE = resolve(ROOT, 'scripts/loot-digest-baseline.json');
const N = 1000;
const SEED_BASE = 0xC0FFEE;

const imp = (rel) => import(pathToFileURL(resolve(ROOT, rel)).href);

function hash(str) {
  return createHash('sha256').update(str).digest('hex').slice(0, 16);
}

// Canonical, order-independent serialization of one roll's result multiset.
function serializeRoll(entries) {
  const parts = entries.map((e) => {
    const id = e.id ?? e.itemId;
    const count = e.count ?? 1;
    let s = `${id}x${count}`;
    if (e.meta && typeof e.meta.fillLevel === 'number') s += `@${e.meta.fillLevel.toFixed(8)}`;
    return s;
  });
  parts.sort();
  return parts.join(',');
}

// Digest N seeded rolls of a roller into a single hash + a small sample.
function digestRolls(label, roll, makeRng, seed) {
  const lines = [];
  const rng = makeRng(seed);
  for (let i = 0; i < N; i++) lines.push(serializeRoll(roll(rng)));
  return { label, digest: hash(lines.join('\n')), sample: lines.slice(0, 3) };
}

// Structural digest of a deterministic (no-RNG) loot map.
function digestMap(label, map) {
  const keys = Object.keys(map).sort();
  const canon = keys.map((k) => `${k}=>${map[k].id}x${map[k].count ?? 1}`).join('|');
  return { label, digest: hash(canon), sample: [canon] };
}

const reg = await imp('src/config/lootRegistry.ts');
const rngMod = await imp('src/core/rng.ts');
const makeRng = rngMod.makeRng;

const results = {};

// ── System 1: salvage panels (independent weighted rolls), per kind ──
const salvageKinds = Object.keys(reg.SALVAGE_TABLES).sort();
salvageKinds.forEach((kind, i) => {
  const r = digestRolls(`salvage:${kind}`, (rng) => reg.rollSalvageTable(kind, rng), makeRng, SEED_BASE + i);
  results[r.label] = r.digest;
});

// ── System 2: loot containers (weighted-pick cascade) ──
{
  const r = digestRolls('container', (rng) => reg.rollContainerLoot(rng), makeRng, SEED_BASE + 100);
  results[r.label] = r.digest;
}

// ── System 3: component (panel) loot — deterministic maps ──
for (const [label, map] of [
  ['component:standard', reg.COMPONENT_LOOT],
  ['component:corroded', reg.COMPONENT_LOOT_CORRODED],
  ['component:pristine_bonus', { _: reg.COMPONENT_LOOT_PRISTINE_BONUS }],
]) {
  const r = digestMap(label, map);
  results[r.label] = r.digest;
}

// ── Cross-check: registry salvage roller must equal the live salvage.ts export ──
let crossOk = true;
const crossRows = [];
try {
  const salv = await imp('src/world/salvage.ts');
  for (let i = 0; i < salvageKinds.length; i++) {
    const kind = salvageKinds[i];
    const seed = SEED_BASE + i;
    const a = digestRolls(kind, (rng) => reg.rollSalvageTable(kind, rng), makeRng, seed).digest;
    const b = digestRolls(kind, (rng) => salv.rollWreckLoot(kind, rng), makeRng, seed).digest;
    const ok = a === b;
    if (!ok) crossOk = false;
    crossRows.push(`  cross salvage:${kind.padEnd(16)} registry=${a} salvage.ts=${b}  ${ok ? 'OK' : '*** MISMATCH ***'}`);
  }
} catch (e) {
  crossOk = false;
  crossRows.push(`  cross-check FAILED to import salvage.ts: ${String(e).split('\n')[0]}`);
}

const isUpdate = process.argv.includes('--update');

console.log('\n=== verify:loot (loot-registry digest gate) ===');

if (isUpdate) {
  writeFileSync(BASELINE, JSON.stringify(results, null, 2) + '\n');
  for (const k of Object.keys(results)) console.log(`  ${k.padEnd(26)} ${results[k]}`);
  console.log('\nBASELINE WRITTEN →', BASELINE.replace(ROOT + '\\', '').replace(ROOT + '/', ''));
  console.log(crossRows.join('\n'));
  console.log(crossOk ? 'CROSS-CHECK: PASS' : 'CROSS-CHECK: FAIL');
  process.exit(crossOk ? 0 : 1);
}

if (!existsSync(BASELINE)) {
  console.error('  no baseline found — run:  node scripts/verify-loot-digest.mjs --update');
  process.exit(1);
}
const baseline = JSON.parse(readFileSync(BASELINE, 'utf8'));

let allPass = crossOk;
const keys = [...new Set([...Object.keys(baseline), ...Object.keys(results)])].sort();
console.log(`  ${'source-kind'.padEnd(26)} ${'baseline'.padEnd(16)} ${'current'.padEnd(16)} status`);
for (const k of keys) {
  const b = baseline[k] ?? '(missing)';
  const c = results[k] ?? '(missing)';
  const ok = b === c;
  if (!ok) allPass = false;
  console.log(`  ${k.padEnd(26)} ${String(b).padEnd(16)} ${String(c).padEnd(16)} ${ok ? 'OK' : '*** FAIL ***'}`);
}
console.log('');
console.log(crossRows.join('\n'));
console.log('');
console.log(allPass
  ? 'LOOT GATE: PASS — every digest matches baseline; registry == salvage.ts.'
  : 'LOOT GATE: FAIL — a loot digest drifted from baseline (see rows above).');
process.exit(allPass ? 0 : 1);
