# Session ACAO — Kickoff Brief

## Read these now (in order)
1. `CLAUDE.md` (auto-loaded) — "Where we are now" (ACAN: flagship merge done, panels clean).
2. `docs/session-end-report.md` — cumulative state (ACAN at top).
3. `docs/backlog.md` + `docs/decisions.md` (D195 name-assets-for-verification, D196 panel-outward-normal).
4. `docs/roadmap.md` + `docs/architecture.md`.

## What's already built
The wreck perf story is COMPLETE: `mergeStaticByMaterial` now covers every big wreck/flagship (procgen fleet + small hand
wrecks + the mega-wreck 491→79 + megaShip 160→67 + satelliteDish 148→47 + crashedHull 51→44). Procgen hulls are faceted
ship sections (D194); wrecks are half-buried (T4); panels are bury-audit-clean 68/68 (D196). The toolkit (`wreckForms.ts`)
has `makeLoftedHull(…,thickness)`, `makeFormerRings(…,{arc})`, `makeBreach`, `makeSandMound`, `mergeStaticByMaterial`. NEW
`flagship` rig-shot frames any NAMED hand-modeled flagship. tsc clean, no save bump.

## Session ACAO focus — unblock + finish the procgen VISUAL level-up (T5), then T7, then the walk-test
The blocker is verification: procgen wrecks can't be framed by a rig-shot. Build that first, then the visual work is unblocked.

## Priority items (in order)
1. **Build a procgen-wreck rig-shot framer (the BLOCKER).** Procgen wrecks are unnamed + random-positioned, so no rig-shot
   can frame one → procgen visual work can't be screenshot-verified (rule 8 killed the ACAN T5 attempt). Options: (a) a
   `procgen-wreck` scenario that spawns a chosen class at a fixed spot via `placeProcgenComposite` (mirror how the
   `megawreck` scenario relies on a known POI) + frames it (reuse the `flagship` scenario's find/frame/mesh-count logic);
   or (b) name procgen wreck groups + find-the-nearest-to-a-fixed-anchor. Acceptance: `npm run rig-shot --scenario=procgen-wreck
   --class=corvette` renders a framed procgen wreck. `scripts/rig-shot.mjs`, `src/world/procgenWreck.ts`.
2. **T5 — real breaches + greeble + asymmetry on the faceted procgen hulls (screenshot-iterate).** A ready breach swap was
   WRITTEN + reverted in ACAN (`procgenWreck.ts` RIBBED_CYLINDER, ~line 390): `makeBreach(r*~0.35, rand)` + `tagWreckDecoration`
   on ~55% of ribbed hulls instead of the flat `addBreachPatches`. Re-apply it + verify with the new framer (does the torn
   hole read on the small hull?). Then extend `addHullGreebles` vocabulary (vents/ports/fins — negative-space) + one-sided
   impact-flank asymmetry. All `isWreckDecoration` (panels avoid + the merge folds them). Keep `panelBuryAudit` PASS; iterate
   3-5 rounds per element (rule 8).
3. **T7 — InstancedMesh / LOD (stretch).** Distance-LOD far wrecks (>300m) to a merged low-detail shell; InstancedMesh the
   repeated non-interactive props. Keep panels as regular meshes. Measure via `perf-probe`.
4. **The still-owed mega-wreck interior WALK-TEST (ACAL).** `npm run dev` — collision holds / fracture-ramp entrance walks /
   panels reachable (now audit-clean + face out) / interior brightness. The one thing screenshots can't verify.

## Verification protocol
`npm run verify` (= `tsc --noEmit`) clean. **Procgen visual:** the NEW procgen-wreck framer (item 1) + `panels` bury-audit
PASS (procgen all pass). **Perf:** `perf-probe` biggest-objects breakdown + the `flagship` rig-shot mesh-count. **Visual
(rule 8):** screenshot-iterate every new breach/greeble — DON'T ship procgen visual work on tsc + audit alone (that's why
ACAN reverted the breach swap).

## Footguns (this arc)
- **A salvage panel's local +Z is its outward normal AND recess axis AND the bury-audit's raycast axis (D196)** — orient
  faceYaw so +Z points AWAY from the hull (a −X flank → faceYaw −π/2; a sign error faces it into the hull → "buried").
- **Name hero assets so verification can find them (D195)** — the `flagship`/procgen framers find-by-name; an unnamed asset
  can't be framed → can't be verified → shouldn't be visually changed (rule 8).
- **Merge order / subgroup (D192)** — colliders per-part before merge; merge the tilted subgroup if a camera frames it.
- **Axis (D194)** — `makeLoftedHull` lofts along Z (hero); procgen is +X → loft then `rotation.y = π/2`.

## Save discipline (D81)
Geometry/material/collider only → no `SAVE_VERSION` bump. Surface if a save field turns out necessary (unlikely).

## Autonomy contract
Ambiguous → GDD pillars + `decisions.md` realism dial; append a D-entry; continue (don't ask). Screenshot-iterate every
visual element (rule 8); NEVER mark a visual element done on tsc alone — and DON'T ship a visual change you can't frame.

## Stop conditions
3 fix-walls on one element (log + move on) · a `SAVE_VERSION` bump turning out necessary (surface it) · destructive-git
attempt · wall-clock/budget ceiling.

## On stop
Run `/session-end` (verify → changelog → CLAUDE last-shipped → roadmap → D-entries → backlog → report → next-prompt →
post-mortem → commit + tag `session-ACAO` + push).
