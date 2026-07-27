// verify-cave-void — THE SEE-THROUGH GATE (DEEPER cycle 1, 2026-07-24).
//
// WHY IT EXISTS
//   Zach's cave walk-test (docs/campaign/cave-walktest-2026-07-24.md, D-2): "many of the
//   interior walls and floors of the cave were invisible, i could see right through under the
//   world which is not right." The existing `cave-walk` gate was GREEN on that exact cave — it
//   proves REACHABILITY (11/11 chambers reached) and is therefore structurally blind to a hole
//   in the shell. That blindness is the whole reason this gate exists: the project's driving
//   lesson is that every failure given a machine gate stopped recurring, and every failure given
//   only a prose rule came back.
//
// WHAT IT MEASURES
//   The `cave-void` rig scenario casts a Fibonacci sphere of 96 rays from ~100 sample points
//   spread across every chamber and every corridor, at player eye height, with THREE.Raycaster
//   against the real cave mesh set. Raycaster honours `material.side`, so a BackSide shell only
//   registers back-face hits — renderer-faithful. A ray that hits nothing is an ESCAPE: the
//   player, standing there, looking that way, sees the void.
//
//   Rays leaving through the cave's DECLARED entrance (`userData.intendedOpening`, caveTest.ts)
//   are EXCUSED — the leviathan lesson (verify-solid.mjs:268): `open-end` once flagged that
//   asset's front door and a later pass bricked up its interior. The allowance is an explicit
//   declaration, never a loosened threshold.
//
// PASS CRITERION
//   ZERO unexcused escapes, on every seed. Nothing softer: any escape is a see-through.
//
// STATUS — GREEN AND PERMANENT since DEEPER cycle 2 (2026-07-24).
//   It was RED BY DESIGN on the shipped shell cave (seed 1337: 4373/8160 = 53.59% escapes, 84/85
//   points leaky, excused=0). Cycle 2 replaced the shell kit with ONE watertight SDF surface and
//   this gate went to 0 escapes on a 6-seed net; it is now a leg of `verify:chunks`, i.e. it runs
//   in `verify:all` on every session.
//
// THIS GATE HAS TEETH — two proofs, because a gate that can only pass is worse than none:
//   1. VACUOUS-PASS GUARD (both sides): a sweep reporting < 40 sample points / < 3840 rays FAILS
//      instead of passing. "Green because it measured nothing" is the failure mode this cycle was
//      explicitly told to make impossible.
//   2. THE PUNCTURE PROOF: `npm run rig -- --scenario=cave-void --port=52xx --puncture=25` deletes
//      ~25% of the cave surface's triangles in-page before the sweep. The gate goes RED (thousands
//      of escapes). Re-run it any time you doubt the gate is live.
//
// WHERE IT RUNS NOW (2026-07-27, the gate-runner parallelization)
//   The seeds-1337/7 pair is a LEG of scripts/verify-chunks.mjs (`--legs=cave-void`), not a
//   `&&` chain after it. The chain silently SKIPPED this gate whenever anything upstream in
//   verify:chunks went red — i.e. exactly when you most want to know whether the cave shell is
//   watertight. This script stays as the WIDE-NET / puncture-proof standalone: extend the seed
//   net here, and keep the two files' parse + vacuous guards in step if either changes.
//
// Run: npm run verify:cave:void            (seeds 1337,7 — same pair verify:chunks runs)
//      npm run verify:cave:void -- --seeds=1337,7,42,99,2024,555

import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const argv = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, v] = a.replace(/^--/, '').split('=');
  return [k, v ?? true];
}));
const SEEDS = String(argv.seeds ?? '1337,7').split(',').map((s) => Number(s.trim())).filter(Number.isFinite);
let port = Number(argv.port ?? 5230);

const rows = [];
let allPass = true;

for (const seed of SEEDS) {
  const args = ['scripts/rig-shot.mjs', `--scenario=cave-void`, `--port=${port}`, `--seed=${seed}`];
  port += 2;
  const p = spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8', timeout: 600000 });
  const out = `${p.stdout || ''}\n${p.stderr || ''}`;
  const line = out.split('\n').find((l) => l.startsWith('CAVE-VOID '));
  if (!line) {
    rows.push(`cave-void seed ${seed}: NO PROBE LINE (boot failed)  *** FAIL ***`);
    allPass = false;
    continue;
  }
  const f = Object.fromEntries(line.trim().split(/\s+/).slice(1).map((kv) => kv.split('=')));
  // VACUOUS-PASS GUARD (harness side, mirroring the in-page one): a pass reported off a tiny or
  // empty sample set is the worst possible outcome of this gate — it would launder a see-through
  // cave as verified. A cave has ≥8 chambers ⇒ ≥40 chamber points ⇒ ≥3840 rays.
  const points = Number(f.points), rays = Number(f.totalRays ?? f.rays);
  if (!(points >= 40) || !(rays >= 3840)) {
    rows.push(`cave-void seed ${seed}: VACUOUS SWEEP — points=${f.points} rays=${rays} (expected ≥40 / ≥3840)  *** FAIL ***`);
    allPass = false;
    continue;
  }
  const ok = f.pass === '1';
  if (!ok) allPass = false;
  // Echo the worst offenders so a failure names the rooms, not just a number.
  const worst = out.split('\n').filter((l) => l.startsWith('[cave-void] ') && l.includes('esc=')).slice(0, 8);
  rows.push(
    `cave-void seed ${seed}: escapes ${f.escapes}/${f.totalRays ?? f.rays} (${f.rate}) across ${f.leakyPoints} leaky sample points` +
    `, culled=${f.culled} holes=${f.holes} excused=${f.excused}, chamber=${f.chamberEsc} corridor=${f.corridorEsc}` +
    `  ${ok ? 'OK' : '*** FAIL ***'}\n` + worst.map((l) => `    ${l.replace('[cave-void] ', '')}`).join('\n'),
  );
}

console.log('\n=== CAVE-VOID (see-through gate) ===');
for (const r of rows) console.log(r);
console.log(allPass
  ? 'cave-void: PASS — every ray terminates on cave geometry or a declared opening.'
  : 'cave-void: FAIL — rays escape the cave shell into the void (see-through defect).');
process.exit(allPass ? 0 : 1);
