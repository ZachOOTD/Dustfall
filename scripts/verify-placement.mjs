// verify:placement — the salvage-panel SCALABILITY GATE (ACAV Tier 5).
//
// Salvage panels are a core mechanic, and the placement system (terrain cull +
// shape-agnostic flush mount + bury prune) must keep working when the wreck MODELS
// change. This gate runs the `panels` bury-audit across a seed sweep — each seed
// builds a full world (every procgen class probabilistically + the hand-modeled
// flagships + the wreck-yard cluster) and asserts ZERO occlusion fails. A future
// wreck-geometry change re-runs THIS one command; if a new model buries a panel,
// the gate trips.
//
//   npm run verify:placement            # default seeds 1,2,42,1337,2024
//   node scripts/verify-placement.mjs 7,99,2024
//
// (rig-shot's post-scenario teardown can exit non-zero AFTER the audit prints, so
//  we parse stdout, not the exit code.)

import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const seeds = (process.argv[2] || '1,2,42,1337,2024').split(',').map((s) => s.trim()).filter(Boolean);

let port = 5400;
let allPass = true;
const rows = [];

for (const seed of seeds) {
  const r = spawnSync('node', ['scripts/rig-shot.mjs', '--scenario=panels', `--seed=${seed}`, `--port=${port++}`], {
    cwd: ROOT, encoding: 'utf8', shell: false, timeout: 180000,
  });
  const out = `${r.stdout || ''}${r.stderr || ''}`;
  const m = out.match(/BURY-AUDIT seed=\S+ pass=(\d+)\/(\d+) fails=(\d+)/);
  if (!m) { rows.push(`seed ${seed}: NO AUDIT LINE (boot/render failed)`); allPass = false; continue; }
  const [, pass, tested, fails] = m;
  // ACBA — also parse the surface-scoped TERRAIN-AUDIT (corner-aware burial); a panel
  // dipping its lower half below the sand fails the gate just like an occlusion bury.
  const tm = out.match(/TERRAIN-AUDIT seed=\S+ pass=(\d+)\/(\d+) fails=(\d+)/);
  const tFails = tm ? Number(tm[3]) : 0;
  const ok = Number(fails) === 0 && tFails === 0;
  if (!ok) { allPass = false; }
  const tNote = tm ? `, terrain ${tm[1]}/${tm[2]} pass ${tFails} fails` : '';
  rows.push(`seed ${seed}: ${pass}/${tested} pass, ${fails} occ-fails${tNote}  ${ok ? 'OK' : '*** FAIL ***'}`);
}

console.log('\n=== verify:placement (salvage-panel scalability gate) ===');
for (const row of rows) console.log('  ' + row);
console.log(allPass
  ? '\nPLACEMENT GATE: PASS — 0 bury-audit fails across all seeds.'
  : '\nPLACEMENT GATE: FAIL — a panel is buried/occluded; a wreck model or the placer regressed.');
process.exit(allPass ? 0 : 1);
