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
//
// HARDENING (2026-07-02): a pre-existing flake — the headless swiftshader/WebGL boot
// races and a single seed's rig-shot times out before printing its BURY-AUDIT line
// ("seed 1337: NO AUDIT LINE"). Because verify:all runs this on every campaign cycle
// a transient false-FAIL wastes cycles. Two guards:
//   (1) STRICT COUNT — the gate already needs one line PER SEED (each seed is its own
//       boot), and a missing line ALREADY fails the gate (allPass=false). That's the
//       correct behaviour — a missing seed must NEVER pass — but the FAIL now names
//       exactly which seed(s) failed to audit, and asserts EVERY requested seed produced
//       a line before declaring PASS.
//   (2) BOUNDED RETRY — a seed whose boot yields NO audit line (the boot-race signature)
//       re-spawns THAT seed's child ONCE before giving up. A seed that produced its line
//       WITH fails>0 is a REAL failure and is NEVER retried (a real bury must not be
//       retried away).

import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const seeds = (process.argv[2] || '1,2,42,1337,2024').split(',').map((s) => s.trim()).filter(Boolean);

/**
 * Boot one seed's `panels` scenario and parse its audit lines.
 * Returns { audited, ok, note } — `audited` is false ONLY on a boot/render failure
 * (no BURY-AUDIT line), which is the retryable transient signature.
 */
function runSeed(seed, port) {
  const r = spawnSync('node', ['scripts/rig-shot.mjs', '--scenario=panels', `--seed=${seed}`, `--port=${port}`], {
    cwd: ROOT, encoding: 'utf8', shell: false, timeout: 180000,
  });
  const out = `${r.stdout || ''}${r.stderr || ''}`;
  const m = out.match(/BURY-AUDIT seed=\S+ pass=(\d+)\/(\d+) fails=(\d+)/);
  if (!m) return { audited: false, ok: false, note: `seed ${seed}: NO AUDIT LINE (boot/render failed)` };
  const [, pass, tested, fails] = m;
  // ACBA — also parse the surface-scoped TERRAIN-AUDIT (corner-aware burial); a panel
  // dipping its lower half below the sand fails the gate just like an occlusion bury.
  const tm = out.match(/TERRAIN-AUDIT seed=\S+ pass=(\d+)\/(\d+) fails=(\d+)/);
  const tFails = tm ? Number(tm[3]) : 0;
  const ok = Number(fails) === 0 && tFails === 0;
  const tNote = tm ? `, terrain ${tm[1]}/${tm[2]} pass ${tFails} fails` : '';
  return { audited: true, ok, note: `seed ${seed}: ${pass}/${tested} pass, ${fails} occ-fails${tNote}  ${ok ? 'OK' : '*** FAIL ***'}` };
}

let port = 5400;
let allPass = true;
const rows = [];
const unaudited = []; // seeds that never produced an audit line (even after retry)

for (const seed of seeds) {
  let res = runSeed(seed, port++);
  // (2) BOUNDED RETRY — only on the boot-race signature (NO audit line), never on a
  // real fails>0 result. Use a distinct port for the retry so a still-bound orphan
  // from the failed child can't block the strictPort bind.
  if (!res.audited) {
    console.log(`  transient boot failure on seed ${seed} — retrying (1/1)…`);
    res = runSeed(seed, port++);
  }
  if (!res.audited) unaudited.push(seed);
  if (!res.ok) allPass = false;
  rows.push(res.note);
}

console.log('\n=== verify:placement (salvage-panel scalability gate) ===');
for (const row of rows) console.log('  ' + row);

// (1) STRICT COUNT — every requested seed must have produced an audit line. A missing
// seed can NEVER pass (it would be a silent under-audit — the exact masking gap the
// hardening closes).
if (unaudited.length) {
  console.log(`\nPLACEMENT GATE: FAIL — ${unaudited.length} seed(s) never audited (boot/render failed even after 1 retry): ${unaudited.join(', ')}. NOT proven clean.`);
  process.exit(1);
}
console.log(allPass
  ? `\nPLACEMENT GATE: PASS — 0 bury-audit fails across all ${seeds.length} seeds.`
  : '\nPLACEMENT GATE: FAIL — a panel is buried/occluded; a wreck model or the placer regressed.');
process.exit(allPass ? 0 : 1);
