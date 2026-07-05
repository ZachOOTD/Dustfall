// verify:colliders — the POI COLLIDER-AUDIT gate (ACBB Tier 3).
//
// Every declared-collider POI archetype must have all its collidable-scale meshes covered
// by a declared collider — no un-collided structural mass the player walks through. The
// ACBA adversarial critique caught three such author errors BY EYE (an un-collided tank
// dome, a mis-axis strut capsule, a float-seated debris chunk); this gate catches that class
// HEADLESSLY. It runs the `collider-audit` rig-shot scenario (one boot, all archetypes × a
// seed sweep) and asserts ZERO coverage fails. A future geometry/collider change re-runs
// THIS one command; if a new mesh is added without a matching collider, the gate trips.
//
//   npm run verify:colliders
//
// (rig-shot's post-scenario teardown can exit non-zero AFTER the audit prints, so we parse
//  stdout, not the exit code — same convention as verify:placement.)
//
// HARDENING (2026-07-02): two QA agents independently hit a pre-existing flake where the
// headless swiftshader/WebGL boot races and rig-shot times out before printing any line
// ("NO AUDIT LINES — boot/scenario failed"). Because verify:all runs this on every campaign
// cycle, a transient false-FAIL wastes cycles. Two guards close that:
//   (1) STRICT COUNT — the gate KNOWS it expects ARCHES×SEEDS rows and FAILs loudly listing
//       the missing (archetype,seed) combos rather than passing under-counted. (The scenario
//       emits all rows atomically from one page.evaluate, so a partial harvest shouldn't
//       happen — but if a future change makes it non-atomic, or an upstream flag trims the
//       set, this catches it instead of silently under-auditing.)
//   (2) BOUNDED RETRY — a run that harvests ZERO or FEWER-than-expected rows (the boot-race
//       signature) re-spawns the child ONCE before failing. A run that produced the full row
//       set WITH fails>0 is a REAL failure and is NEVER retried (matches the campaign policy:
//       re-run a failing gate once; a real fail must not be retried away).

import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// The scenario's own defaults (rig-shot.mjs `collider-audit`): keep in lockstep so the
// EXPECTED-count assertion matches what the child actually sweeps.
const ARCHES = ['satellite', 'wrecked_tank', 'debris_field', 'hollow_husk', 'derelict', 'well', 'debris_trail', 'enterable_wreck'];
const SEEDS = [1, 2, 42, 1337, 2024];
const EXPECTED = ARCHES.length * SEEDS.length; // 8 × 5 = 40

/** Spawn the collider-audit child once and harvest its parsed audit rows. */
function runOnce() {
  const r = spawnSync('node', ['scripts/rig-shot.mjs', '--scenario=collider-audit', '--port=5455'], {
    cwd: ROOT, encoding: 'utf8', shell: false, timeout: 180000,
  });
  const out = `${r.stdout || ''}${r.stderr || ''}`;
  const rows = new Map(); // "archetype|seed" → { archetype, seed, pass, total, fails, detail }
  let totalFails = 0;
  for (const l of out.split('\n')) {
    if (!l.includes('COLLIDER-AUDIT')) continue;
    const m = l.match(/COLLIDER-AUDIT archetype=(\S+) seed=(\S+) pass=(\d+)\/(\d+) fails=(\d+)(.*)/);
    if (!m) continue;
    const fails = Number(m[5]);
    totalFails += fails;
    rows.set(`${m[1]}|${m[2]}`, {
      archetype: m[1], seed: m[2], pass: m[3], total: m[4], fails,
      detail: m[6] ? m[6].replace(/^ ::/, ' ::') : '',
    });
  }
  return { rows, totalFails, out };
}

/** The set of expected (archetype,seed) keys, for the missing-combo report. */
function missingCombos(rows) {
  const missing = [];
  for (const a of ARCHES) for (const s of SEEDS) {
    if (!rows.has(`${a}|${s}`)) missing.push(`${a} seed=${s}`);
  }
  return missing;
}

// ── Run, with a single bounded retry on a partial/zero harvest (the boot-race signature). ──
let res = runOnce();
if (res.rows.size < EXPECTED) {
  console.log(`  transient boot failure — harvested ${res.rows.size}/${EXPECTED} audit rows; retrying (1/1)…`);
  res = runOnce();
}

const { rows, totalFails } = res;
const missing = missingCombos(rows);

console.log('\n=== verify:colliders (POI declared-collider coverage gate) ===');

// (1) STRICT COUNT — never pass under-counted. A missing combo after the retry is a hard fail.
if (rows.size < EXPECTED) {
  if (rows.size === 0) {
    console.log('  NO AUDIT LINES — boot/scenario failed (see output above), even after 1 retry.');
  } else {
    console.log(`  UNDER-COUNTED — harvested ${rows.size}/${EXPECTED} audit rows (even after 1 retry). Missing:`);
    for (const c of missing) console.log(`    ${c}`);
  }
  console.log('\nCOLLIDER GATE: FAIL — audit incomplete; NOT proven clean (under-count would mask a real coverage fail).');
  process.exit(1);
}

// (2) COVERAGE — with the full expected set present, assert zero coverage fails.
if (totalFails === 0) {
  console.log(`  ${rows.size} archetype×seed audits — every collidable-scale mesh covered.`);
  console.log('\nCOLLIDER GATE: PASS — 0 coverage fails.');
  process.exit(0);
}
for (const r of rows.values()) {
  if (r.fails > 0) console.log(`  ${r.archetype} seed=${r.seed}: ${r.pass}/${r.total} covered, ${r.fails} FAIL${r.detail}`);
}
console.log(`\nCOLLIDER GATE: FAIL — ${totalFails} un-covered collidable mesh(es); a POI has geometry the player can walk through.`);
process.exit(1);
