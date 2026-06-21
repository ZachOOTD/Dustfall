# ▶ CAMPAIGN cycle 62 — Kickoff Brief — `campaign/2026-06-18`

**Phase-B review-fix pass, M11 (wreck/panel fixes) in progress.** ⓐ not-openable panels FIXED (C61). Now ⓑ floating panels + ⓒⓓⓔ wrecked_tank.
**Execution: autonomous, PAUSE after M11 completes for the user's batch walk-test** (then M12 worm, M13 audio). Boot from `docs/campaign/campaign-state.json` + `docs/roadmap.md`.

## Read these now (in order)
1. `CLAUDE.md` (auto-loaded).
2. `docs/decisions.md` tail — **D264 (the not-openable fix + the panel structure: wrapper Group + body Mesh with `userData.panelShape`)**, D226 (phash determinism — NO new world-rand).
3. `docs/backlog.md` "Fresh triage 2026-06-20" (the verbatim feedback) + §A (the 3 hand/hero-wreck straggler panels).
4. `src/world/poiComponents.ts` (the component `panelMounts` + the `wreckedTank` component ~285-385) + `src/world/wrecks.ts` (`addAccessPanelOriented` — how a panel mesh seats at a mount) + `src/world/poiAssembler.ts` (`placeProcgenPOI` panel placement).

## What ⓐ landed (C61)
`pruneBuriedPanels`' `cull()` now hides culled panels (was leaving them visible = the "not openable" teases). 21 hidden / 79 openable, verified. D264.

## Cycle 62 focus — **M11 ⓑ floating panels + ⓒⓓⓔ wrecked_tank**
**Use the isolated rig to SEE + iterate** (it renders where the heavy field scene times out):
`node scripts/rig-shot.mjs --scenario=procgen-wreck --archetype=<x> --seed=42 --angles=side --zoom=0.4` → `verification/scen-procgen-<x>-side-s42.png`.

### Priority items
1. **ⓑ floating panels — seat the mounts flush.** A panel is FLOATING when its `panelMount` (component-declared `pos`/`quat`, `poiComponents.ts`) sits off the hull surface, OR a flat panel rides a CURVED hull and lifts at the corners. Per archetype with a panel (satellite/derelict/well/debris/husk/wreckedTank): render → check the panel sits flush → fix the mount `pos` (onto the surface) and/or sink the panel slightly into the curve / add a small mounting frame so the corners don't lift. **Determinism: reuse the rolled values — NO new world-rand draws (phash only, D226), or `verify:placement` desyncs.**
2. **ⓒⓓⓔ wrecked_tank** (`wreckedTank` in `poiComponents.ts` ~285-385): ⓒ interior ribbing reads floating — the `makeFormerRings(r*0.9, …)` ribs sit 0.1r inside the hull with no longitudinal tie; connect them to the hull edge / add stringers so they don't float. ⓓ overall reads disconnected — seat the decoration pieces (dents/flaps/plates/buckle) on the hull surface; ensure the dome + hoops meet the body. ⓔ the salvage panel mount (`pos:(−len*0.36, r*2, 0)` = the curved top crest, FACE.posY) — a flat panel on the curved crest lifts at the edges → seat it onto a flatter shoulder or sink it into the curve. Render the tank (`--archetype=wrecked_tank --angles=side,3q --zoom=0.4`) → iterate 3-5 rounds until it reads connected + the panel seated.
3. **The 3 hand/hero-wreck straggler panels** (backlog §A) — if time: register-or-hide the unregistered `addAccessPanel` meshes on crashedHull/megaShip/megaWreck/heroLandmarks (the ACAS A4 "above-ground only" remainder).
4. **Verify** — `npm run verify:all` (placement + colliders MUST stay green; any mount change is phash-only). Render each fixed archetype to confirm flush/seated.

### After M11 (all of ⓐⓑⓒⓓⓔ + stragglers)
**PAUSE at the "M11 wreck/panel fixes — USER BATCH-VALIDATE" milestone** (`status: paused`, `stop_reasons: ["milestone-review"]`, don't schedule). The user walk-tests the wreck looks + that panels open + sit flush, then `/campaign-approve` → M12 (sand worm).

## Notable footguns
- **NO new world-rand** in panel mounts/placement (phash only — D226) or `verify:placement` desyncs across seeds.
- **Flat panel on a curved hull** lifts at the corners → sink it / frame it / pick a flatter spot. (The likely ⓔ + general ⓑ cause.)
- **Render via the ISOLATED rig** (`procgen-wreck` scenario) — the heavy full-world preview screenshot times out (documented gotcha), the isolated one renders.
- `verify:placement` buffers output to the END + is slow; don't kill it early.

## Verification protocol
`npm run verify:all` + a rig render of each fixed archetype (panel flush + structure connected). Pry FEEL + close-up reads → the user's M11 batch walk-test.

## Begin
Read the order → render the floating-panel archetypes + the wrecked_tank → fix mounts/seating (phash-only) → re-render to verify → `verify:all` → if all of M11 done, set the M11 batch-pause verdict; else `/session-end` CONTINUE. Boot fresh from FILES.
