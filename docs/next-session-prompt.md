# Next session — RESUME the escape-pod REBUILD v2 (⏸ user-paused at R5a, 2026-06-30)

The campaign `campaign/escape-pod-intro` is **PAUSED** (`docs/campaign/campaign-state.json`
status=paused, awaiting_approval=true). The user said "pause where we are now, pick it back up
later." Resume with **`/campaign-approve`** (releases the loop) or drop notes in
`docs/campaign/steering.md`. Everything is committed + pushed (preview refreshes).

## Where REBUILD v2 stands (R1→R5)
The v1 intro (offset + faked shaders + 3 teleport-stitched pods) was re-architected into the
REAL world. **Done + pushed:**
- **R1** — real orbit sky (space mode) + the pod physically falling through the real desert; the 2 walk-test bugs fixed (planet-on-camera, dust-in-space).
- **R2** — the space scene at hero quality (milky-way band + a planet that reads as a world + atmosphere).
- **R3a** — ONE consistent pod: wake in + climb out of the SAME cabin you rode down; matching exterior (~2.9m); deleted the separate wake-shell.
- **R4** — parachute gag MID-fall (was on the ground) + real ~2s blackouts (was a 0.35s flash).
- **R5a** — the COCKPIT redesigned box → worn fuselage (commit `07fa124`) via a 4-round adversarial-gate loop (beauty 4→6.75). Box/wine-barrel/grinning-face/floating-seat/placeholder-doorway all killed.

## RESUME HERE — R5a residuals (the user is art-directing these) + R5b/R5c
The user PAUSED at R5a specifically because the ship look is their domain + they gave material
feedback. On resume, FIRST confirm direction with the user (they wanted to review), then:

1. **Finish the rugged/matte HULL material pass** (user steering, archived in `steering-archive.md`):
   the cockpit metal reads "too pristine and shiny"; the user wants the OLDER rugged/matte worn feel.
   A material round was LAUNCHED then interrupted by the pause (partial edits are in `07fa124`, tsc/smoke
   green). Direction: raise roughness (~0.7-0.8), lower metalness (~0.4-0.5), cut envMapIntensity (stop
   the planet-mirror sheen), KEEP the cool neutral (non-brown) color, layer grime/edge-wear. Aligns with
   the gate's own "too clean for the Mad-Max tone" finding. (`src/world/escapePodIntro/shipScene.ts` —
   grep `_metal(`/`metalness`/`envMap`.)
2. **The FP "strapped-in" SEAT read** — plateaued after 4 rounds. The geometry is all there (crash-seat +
   central buckle + slim converging straps + bolsters); the exact first-person "buckled in" read in the
   opening forward frame is the gap (the straps kept foreshortening into "tan wedges"). This may want the
   user's eye / a hand-tuned camera-frustum placement rather than more blind gate rounds.
3. **The planet frames the windscreen too large/flat at the cockpit beat** — an R2/sky FRAMING fix (the
   user's queued "planet size/placement" item): the planet fills the canopy as a flat tan wash instead of
   a gorgeous disc + limb + stars. Pull the planet smaller-in-frame / adjust the cockpit-beat camera pitch
   so the opening view reads as a beautiful orbit vista. (`src/world/sky.ts` `buildSpacePlanet` + the
   `cockpit` beat framing in `sequence.ts`.)
4. **R5b — the CORRIDOR** fully modelled/detailed (currently greybox). Build in the SAME rugged idiom.
5. **R5c — the pod-bay + physical ENTER/EJECT** (folded from R3b): the pod docked in the ship the player
   physically walks into + that detaches — no teleport into the pod.

After R5 the feature rework is complete → the user's final walk-test/listen.

## How to walk-test / shoot
- Walk-test: `FEATURES.escapePodIntro = true` + new game, OR console `__game.startIntro()`
  (`__game.jumpToBeat('cockpit'|'descent'|'parachute'|'wake'|…)`, `__game.smokeIntro()`).
- Cockpit rig (the modeler's gate tool, since preview hangs on the desert):
  `node scripts/rig-shot.mjs --scenario=cockpit --angle=forward|wide|door --stand --space=1 [--alert=2]`.
- Adversarial visual gate for hero visuals: 5 harsh-lens critics + a code-auditor read the REAL in-game
  rig shots (see the R5a saga — it caught a 5.2 under a self-graded 8). Worth reusing for R5b/c.

## Cost note
R5a burned ~1.8M tokens (4 modeler rounds + 3 gates). The adversarial gate is worth it for hero visuals
but is expensive — scope the gate width to stakes.
