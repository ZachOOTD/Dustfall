# Session ACAJ — Mega-wreck rebuild + procgen-wreck/panel overhaul + WebGL wreck perf pass

## Context

Wrecks are the most-seen objects in Dustfall (salvage is a core loop; ~80 per seed) and the
weakest-reading: the hand-modeled **mega-wreck** (`megaWreck.ts`, 1542 LOC) is "120m of
perpendicular walls + parallel roof" with ABL-era tapered-shell/rust-band mitigations layered
over boxes — it reads boxy. Wrecks also now **dominate the frame cost** (~1,200–1,400 meshes /
most remaining draw calls after the ACAH pickup-merge halved the rest). This is the user-chosen
direction deferred through ACAH+ACAI. **Scope (user, mega-wreck-only):** rebuild the mega-wreck
as the hero centerpiece, level up the SHARED procgen part-vocabulary (improves all ~80 procgen
wrecks at once), bed wrecks into the sand, and fold in the WebGL wreck perf pass — quality +
frames in one coherent theme. Other hand-modeled flagships (mega-ship, satellite-dish,
opening-wreck) are left as-is this session.

**Key finding (Explore survey):** the procgen system is ALREADY a mature parts-vocabulary —
`procgenWreck.ts` (recipes corvette/gunship/freighter/… + `assembleWreck` + `findPanelMount`
raycast panel sampler + `HULL_SEGMENT_BIOME_WEIGHTS`) and `wrecks.ts` (cockpit/hull/engine/tail
part builders + `addHullGreebles`/`addBreachPatches`/`makeEngineBellMesh`/`addAccessPanel`).
So the overhaul = **level up the shared building blocks**, not rebuild the system.

**Research touchstones (game-researcher):** dominant-feature silhouette (avoid boxy symmetry;
read at 100m); LatheGeometry for tapered fuselage/nose/bells; exposed formers/ribs at breaks;
breach via **vertex-displacement, NOT boolean** + jagged-edge spikes; greeble-by-face-normal
with negative space (not every surface); **functional** asymmetry (impact-side damage);
half-burial via terrain height-sample + a windward sand-drift mound (visual-only, ~20° slope).

All geometry/material only → **no `SAVE_VERSION` bump expected** (surface it if a wreck-state
field turns out necessary — unlikely; colliders/panels rebuild from seed).

---

## Tier 1 — Shared procedural-hull toolkit (NEW `src/world/wreckForms.ts`)

The reusable foundation the hero + the fleet both consume. Small, isolated, screenshot-verified
primitives:
- `makeLatheHull(profile: Vector2[], opts)` — tapered/bowed fuselage/nose section via
  `LatheGeometry` (smooth taper, broken-off ends), FrontSide so interior boxes stay visible
  (mega-wreck pattern). Replaces box-section + the ABL `CylinderGeometry` shell.
- `makeFormerRings(len, radius, n)` — exposed internal rib/former rings (thin tori / extruded
  rects) shown at hull breaks + breach mouths so structure reads.
- `makeBreach(geo, centerLocal, size, rand)` — torn hole by **displacing edge vertices** out/in
  with simplex noise (`simplex-noise` already a dep) + a few jagged-edge spikes (thin cones).
  NO boolean/CSG. Tag spikes `userData.isWreckDecoration`.
- `makeSandMound(terrain, pos, windDir, size)` — windward sand-drift mound (cone/quad-strip,
  ~20° slope, blends to terrain; visual-only, no collider) for half-burial.
- **Verify**: a NEW `wreck-form` rig-shot scenario renders each primitive in isolation (mirror the
  `item-studio` pattern). Iterate each 3-5 rounds (rule 8). tsc clean.

## Tier 2 — Mega-wreck rebuild (HERO centerpiece)

Rebuild `makeMegaWreck(rand)` (`megaWreck.ts:216`) with the toolkit: a **dominant downed-hull
silhouette** — Lathe nosedive fuselage spine + a large broken aft section + bridge tower +
engine bells/nacelles — with exposed former rings at the mid-hull break + breaches, real
`makeBreach` holes, **functional asymmetry** (impact-side damage/torn flank), half-buried with a
windward mound. **PRESERVE the gameplay shell** (`placeMegaWreck` at `poi.ts:585`): the
walk-through cavity (bow entrance → bow chamber → mid-break → aft bay), the cuboid colliders on
the single fixed body (rebuild to match the new shell so the player can't clip through + the
cavity stays enterable), the 2 salvage panels (re-anchor by position or `findPanelMount`), the
shelter-zone AABB, the journal.
- **Verify (rule 8, 5-8 rounds)**: NEW `megawreck` rig-shot — exterior orbit (≥3 angles) + an
  interior walkability shot; assert the 2 panels + shelter + journal still register
  (`panelBuryAudit` includes them). Iterate the silhouette until it reads as a crashed ship, not
  a building.

## Tier 3 — Procgen fleet vocabulary level-up (improves all ~80 wrecks)

Upgrade the SHARED part builders (`wrecks.ts` hull/cockpit variants + `procgenWreck.ts`
`HULL_SEGMENT_VARIANTS`) to use the toolkit: tapered/ribbed hull variants get Lathe profiles +
exposed former rings; the flat `addBreachPatches` becomes a real `makeBreach` hole; cockpits get
a cleaner dominant nose. Keep the recipe/`assembleWreck`/biome-weight system + the `panelAnchor`
fallbacks intact. This is the breadth win — every procgen wreck levels up from the shared change.
- **Fan-out opportunity**: the independent hull/cockpit/engine/tail variant rewrites can be
  authored by parallel agents (then reconciled + visually triaged) — see Parallelization.
- **Verify**: `panels` bury-audit PASS across several seeds (no regression); a `wreck-visual`
  strip of several procgen kinds (corvette/freighter/gunship). Iterate.

## Tier 4 — Half-burial + sand integration (all wrecks)

Apply terrain-height sinking + `makeSandMound` to procgen wrecks (in `placeProcgenComposite` /
`heroLandmarks.placeHeroLandmarks`) + the mega-wreck, so wrecks sit **bedded in the dunes**
(partial sink + windward drift mound) instead of perched/floating on the surface. Deterministic
from seed. Confirm colliders + panels stay reachable (not buried below the new sink depth).
- **Verify**: a render showing wrecks bedded in sand at a grazing angle; `panelBuryAudit` PASS.

## Tier 5 — Greeble + functional-asymmetry pass

Expand `addHullGreebles` vocabulary (place-by-face-normal: vents/antenna/ports/fins; **negative
space** — large clean panels with one prominent detail beat uniform clutter) + add **functional**
asymmetry (one-sided struts/damage on the impact flank). All greebles tagged
`isWreckDecoration` so `findPanelMount` rejects panels on top of them.
- **Verify**: `panelBuryAudit` PASS (greebles don't bury panels); a close wreck-detail render.

## Tier 6 — WebGL wreck perf pass (the frames win) — NEVER CUT

Merge each assembled wreck's STATIC, non-interactive meshes **by material** into one geometry
(`mergeGeometries`, the `deadTree.ts:136` pattern), keeping the salvage PANELS (interactive) +
the colliders separate. This collapses the dominant draw-call cost. Thread through
`assembleWreck` (procgen) + `makeMegaWreck` (post-build merge of the static shell).
- **Verify**: `perf-probe` scenario before/after — report `renderer.info` drawCalls/triangles +
  `window.__bootT`; assert a meaningful draw-call drop. `panels` bury-audit + interaction
  unchanged (panels NOT merged). Visual unchanged.

## Tier 7 — InstancedMesh / LOD (stretch / budget)

If budget remains: `InstancedMesh` the repeated NON-interactive props across the fleet (engine
bells, common greebles) and/or a distance-LOD swapping far wrecks to a merged low-detail shell.
Keep panels as regular meshes (no interaction-raycast `instanceId` rework — that's the risk).
Measure via `perf-probe`.

---

## Critical files
- `src/world/wreckForms.ts` — NEW shared toolkit (T1). Foundation for T2/T3/T4/T5.
- `src/world/megaWreck.ts` — `makeMegaWreck` (T2 rebuild) + post-build static merge (T6);
  preserve `placeMegaWreck` colliders/panels/shelter/journal wiring.
- `src/world/wrecks.ts` + `src/world/procgenWreck.ts` — part vocabulary + `assembleWreck` +
  `findPanelMount` (T3 level-up, T5 greebles, T6 merge). `addAccessPanel`/`addHullGreebles`/
  `addBreachPatches`/`makeEngineBellMesh` reused.
- `src/world/heroLandmarks.ts` + `src/world/poi.ts` — placement (T4 sand integration).
- `src/world/salvage.ts` (`registerSalvageable`) + `src/debug/debugPanel.ts` (`panelBuryAudit`)
  + `src/world/panelUtils.ts` (`panelWithHole`) — READ-ONLY: panels/verification (don't break).
- `src/config/tuning.ts` — new `WRECK_*` form/breach/mound consts (rule 2).
- `scripts/rig-shot.mjs` — NEW `wreck-form` + `megawreck` + `wreck-visual` scenarios; existing
  `panels`/`perf-probe` (lines 1908/890) for verification.

## Verification
`npm run verify` (tsc) clean throughout. **Logic**: `panels` bury-audit PASS across seeds (panels
reachable, not buried); mega-wreck still registers 2 panels + shelter + journal. **Perf**:
`perf-probe` before/after draw-call + triangle delta (the T6 success metric). **Visual (rule 8)**:
screenshot-iterate the mega-wreck (multi-angle exterior + interior), the leveled-up procgen kinds,
and the sand integration — `wreck-form`/`megawreck`/`wreck-visual` scenarios. Static models →
no in-motion feel owed.

## Parallelization (sub-agent policy)
- **Sequential**: T1 toolkit (foundation) → T2 mega-wreck (single hero, observation-dependent
  iteration) → T6 perf merge (depends on final geometry).
- **Fan-out candidates**: T3 procgen variant rewrites (independent hull/cockpit/engine/tail
  builders — author concurrently via parallel agents, then reconcile + `/visual-triage`); T5
  greeble vocabulary authoring; the multi-angle visual critique of the mega-wreck (`/visual-triage`
  fan-out of camera angles). Govern cost with per-agent effort, not by avoiding fan-out.

## Scope-cut order (pre-committed)
1. **T7 InstancedMesh/LOD** (stretch) — cut first.
2. **T5 greeble depth** → keep the existing `addHullGreebles` basics, skip the vocabulary expansion.
3. **T4 sand mound** → keep the simple terrain-height SINK, drop the windward drift-mound geometry.
**Never cut**: the mega-wreck interior walkability + colliders + panels/shelter/journal (gameplay
integrity); **T6 the perf merge** (the frames win, the user's explicit want); finishing any visual
element mid-iteration to a shippable state (no half-built shells).

## Autonomy + stop conditions
Ambiguous → GDD pillars + decisions.md realism dial, append a D-entry, continue. Research-backed
modelling (the touchstones above) before authoring new geometry. Screenshot-iterate every visual
element (rule 8 — 5-8 rounds new, 3-5 tuning); NEVER mark a visual tier done on `tsc` alone.
Stop on: 3 fix-walls on one element (log + move on) · a `SAVE_VERSION` bump turning out necessary
(surface it) · destructive-git attempt · wall-clock/budget ceiling. No D150 feel items expected
(static models).

## On stop
Run gamedev-framework `/session-end` (verify → changelog → CLAUDE last-shipped → roadmap →
D-entries → backlog → report → next-prompt → post-mortem → commit + tag `session-ACAJ` + push).
