# Session ACAN — Kickoff Brief

## Read these now (in order)
1. `CLAUDE.md` (auto-loaded) — "Where we are now" (ACAM: wreck-fleet merge + faceted procgen hulls).
2. `docs/session-end-report.md` — cumulative state (ACAM at top).
3. `docs/backlog.md` + `docs/decisions.md` (D192 merge architecture, D193 measure-first, D194 procgen faceted hulls).
4. `docs/roadmap.md` + `docs/architecture.md`.

## What's already built
The wreck system is leveled up: the ~80 procgen wrecks use faceted `makeLoftedHull` ship sections (not smooth pipes,
D194), are half-buried by a windward `makeSandMound` (T4), and have their static meshes merged by material via NEW
`mergeStaticByMaterial` (T6/D192 — mega-wreck 491→79, fleet ~254→52). The hero mega-wreck (ACAK-ACAL) has exact trimesh
collision, natural-only lighting, an open-fracture entrance. The toolkit (`wreckForms.ts`) has `makeLoftedHull(…,
thickness)`, `makeFormerRings(…,{arc})`, `makeBreach`, `makeSandMound`, `mergeStaticByMaterial`. tsc clean, no save bump.

## Session ACAN focus — finish the perf win (flagships) + the panel fix, then the visual stretch
The biggest remaining perf win is merging the 3 hand-modeled FLAGSHIPS; the most-owed correctness fix is the mega-wreck panels.

## Priority items (in order)
1. **Extend the merge to the 3 flagships (the biggest remaining hogs — D193).** megaShip (~160m), satelliteDish, crashedHull
   are the largest UNMERGED objects (the procgen fleet was only ~250 meshes; flagships dominate). They were deferred in ACAM
   because they have NO verification rig-shot (don't merge unverifiable stable assets). So: (a) add a rig-shot per flagship
   (or a generic `poi` wide framing) — `scripts/rig-shot.mjs`; (b) tag each flagship's panel groups `userData.noMerge = true`
   (megaShip.ts:623-638 bridgePanel/cargoPanel/bellPanel + satelliteDish/crashedHull equivalents) as belt-and-suspenders;
   (c) call `mergeStaticByMaterial(<root, or the tilted subgroup if one is framed by a camera — see the mega-wreck `shell`
   pattern, D192>)` after `attachCompoundCollider`; (d) verify each renders IDENTICAL (before/after rig-shot) + the merge
   mesh-count drop. Expect ~130-160m → ~30 each.
2. **Mega-wreck salvage panels — wire `findPanelMount` (the deferred ACAL "Path A").** The 2 lee-flank panels are hand-placed
   on the busy ~17°-tilted flank → fail the bury-audit ("hull@0.22<panel@0.73"), nudging proud didn't fix it. Export +
   adapt `findPanelMount` (`procgenWreck.ts:1037`) to raycast the mega-wreck's lofted hull for a clean flat mount (raycast
   the un-tilted hull, then run the mount through `shellToG`/`addPanel`). Target: bury-audit clean on the mega-wreck panels.
3. **T5 — greeble + real breaches on the now-faceted procgen hulls (visual stretch).** Extend `addHullGreebles` vocabulary
   (vents/ports/fins, negative-space) + swap flat `addBreachPatches` for real `makeBreach` holes + one-sided impact-flank
   asymmetry. All `isWreckDecoration` (panels avoid + the merge folds them). Screenshot-iterate; keep the bury-audit PASS.
4. **T7 — InstancedMesh / LOD (stretch).** Distance-LOD far wrecks (>300m) to a merged low-detail shell; InstancedMesh the
   repeated non-interactive props. Keep panels as regular meshes. Measure via `perf-probe`.
5. **The still-owed mega-wreck interior WALK-TEST (ACAL).** `npm run dev` — collision holds / fracture-ramp entrance walks /
   panels reachable / interior brightness. The one thing screenshots can't verify.

## Verification protocol
`npm run verify` (= `tsc --noEmit`) clean. **Perf (T6 flagships):** `npm run rig-shot -- --scenario=perf-probe` — read the
biggest-objects breakdown (`topGroups`) + the merge mesh-count drop; rig-shot each flagship before/after for render-identity.
**Panels:** `npm run rig-shot -- --scenario=panels` → `panelBuryAudit` PASS (procgen all pass; target the 2 mega-wreck fails
to 0). **Visual (rule 8):** screenshot-iterate any new greeble/breach element.

## Footguns (this arc)
- **Merge order (D192):** colliders per-part FIRST (`attachCompoundCollider`), THEN `mergeStaticByMaterial` — else the wreck
  collapses to one giant AABB. For a wreck with a tilted SUBGROUP framed by a camera (mega-wreck `shell`), merge the
  SUBGROUP, not the root (else you empty it + break the interior camera; the geometry is still correct in-world).
- **Measure first (D193):** a perf claim is a hypothesis. Use the `perf-probe` biggest-objects breakdown; the rig-shot uses
  a RANDOM seed per boot so cross-boot numbers aren't comparable — measure the optimization's DIRECT before→after counts.
- **Axis (D194):** `makeLoftedHull` lofts along Z (hero convention); procgen is +X → loft then `rotation.y = π/2`.
  `makeFormerRings` is already +X-oriented (no extra rotation in the procgen path).

## Save discipline (D81)
Geometry/material/collider only → no `SAVE_VERSION` bump. Surface if a save field turns out necessary (unlikely).

## Autonomy contract
Ambiguous → GDD pillars + `decisions.md` realism dial; append a D-entry; continue (don't ask). Screenshot-iterate every
visual element (rule 8); NEVER mark a visual element done on tsc alone. Don't merge a stable asset you can't visually verify.

## Stop conditions
3 fix-walls on one element (log + move on) · a `SAVE_VERSION` bump turning out necessary (surface it) · destructive-git
attempt · wall-clock/budget ceiling.

## On stop
Run `/session-end` (verify → changelog → CLAUDE last-shipped → roadmap → D-entries → backlog → report → next-prompt →
post-mortem → commit + tag `session-ACAN` + push).
