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

import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const r = spawnSync('node', ['scripts/rig-shot.mjs', '--scenario=collider-audit', '--port=5455'], {
  cwd: ROOT, encoding: 'utf8', shell: false, timeout: 180000,
});
const out = `${r.stdout || ''}${r.stderr || ''}`;
const lines = out.split('\n').filter((l) => l.includes('COLLIDER-AUDIT'));

let totalFails = 0, totalAudits = 0;
const failRows = [];
for (const l of lines) {
  const m = l.match(/COLLIDER-AUDIT archetype=(\S+) seed=(\S+) pass=(\d+)\/(\d+) fails=(\d+)(.*)/);
  if (!m) continue;
  totalAudits++;
  const fails = Number(m[5]);
  totalFails += fails;
  if (fails > 0) failRows.push(`  ${m[1]} seed=${m[2]}: ${m[3]}/${m[4]} covered, ${fails} FAIL${m[6] ? m[6].replace(/^ ::/, ' ::') : ''}`);
}

console.log('\n=== verify:colliders (POI declared-collider coverage gate) ===');
if (totalAudits === 0) {
  console.log('  NO AUDIT LINES — boot/scenario failed (see output above).');
  process.exit(1);
}
if (totalFails === 0) {
  console.log(`  ${totalAudits} archetype×seed audits — every collidable-scale mesh covered.`);
  console.log('\nCOLLIDER GATE: PASS — 0 coverage fails.');
  process.exit(0);
}
for (const row of failRows) console.log(row);
console.log(`\nCOLLIDER GATE: FAIL — ${totalFails} un-covered collidable mesh(es); a POI has geometry the player can walk through.`);
process.exit(1);
