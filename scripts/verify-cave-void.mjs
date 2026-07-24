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
// STATUS — RED BY DESIGN as of 2026-07-24.
//   Today's cave is built as N interpenetrating zero-thickness shells (one ellipsoid per chamber,
//   one tube per corridor, all `side: BackSide`), with chamber walls CARVED open at every corridor
//   mouth. From inside chamber A the corridor tube's faces are back-face-culled and there is no
//   second surface behind them → void. This gate is deliberately NOT wired into `verify:all` /
//   `verify:chunks` yet, because it would break the green baseline before the fix lands.
//
//   *** DEEPER CYCLE 2 TODO — WIRE ME IN. *** Once the watertight SDF remesh lands and this gate
//   goes green on seeds 1337 + 7, append ` && npm run verify:cave:void` to the `verify:chunks`
//   script in package.json (or add the leg inline in verify-chunks.mjs next to the cave-walk leg
//   at ~line 178). Do NOT wire it in while it is red.
//
// Run: npm run verify:cave:void            (seeds 1337,7)
//      npm run verify:cave:void -- --seeds=1337,7,42

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
