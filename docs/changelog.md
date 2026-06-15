# Changelog

2–4 lines per shipped session. Latest at top. Full plans archived at
`.claude/plans/archive/`.

## Session ACAQ — 2026-06-14 — Marathon overnight: Wreck-yard biome (Cycle 8) — graveyard + Sarlacc pit ✓ verify pass (tsc clean)

`verified` — `npm run verify` (tsc) PASS; **no save bump** (geometry/material/additive-item only). A long marathon
overnight building a whole new rare DESTINATION biome end-to-end (6 tiers Y1-Y6). 5 commits (`b2417e5`,`aa50056`,
`5f49444`,`0978f6d`,`8c75493`); D201-D203. Planned via 4 parallel read-only investigations (biome/POI/loot/sandworm).

**Y1 — Wreck-yard biome (D201).** A rare DESTINATION biome (1 per seed), placed as a DISTANCE-OVERRIDE disc around a
seed-derived anchor 620-1000m from spawn — NOT a noise region. `biomes.ts`: BiomeId += 'wreck_yard'; the sampler exposes
`wreckYardAnchor`/`wreckYardRadius` + a `wreckYardAt(x,z)` strength field (smoothstep core→edge); `biomeAt` returns
'wreck_yard' within. `terrain.ts` blends the ground toward an ashen oxidized grey-brown + flattens to a basin by
wreckYardAt. NEW `wreck-yard` rig-shot framer (`--angle=aerial|approach|ground|pit`) — the framer for the whole build.

**Y2 — Dense graveyard POI.** NEW `wreckYard.ts` → placeWreckYard(): ~26-38 deeply-buried corroded procgen wrecks
(packed toward center, biome-weighted to corroded+skeletal hulls) + 3-5 big tilted hand-wreck silhouettes + 5-9 ribcage
bone-fields (carcass anchors) + heavy debris, with a central 24m CLEARING reserved for the pit. Wired into poi.ts.

**Y3 — Exclusive loot.** NEW additive ItemId `relic_core` (a glowing alien-tech artifact, near-full-restore on use);
NEW `relicMesh.ts` (glowing MeshBasic core + dark housing, shared held+world); `pickups.ts` spawnRelicAt; 4-7 relics
scattered across the graveyard biased toward the dangerous center. (Chose scattered glowing pickups over the deep
panel-component loot surgery.)

**Y4 — Sarlacc pit (the hero centerpiece).** NEW `enemies/sarlaccPit.ts`: a raised sand-maw (4 screenshot-iterated
rounds — mound + dark glowing throat + inward-curving teeth + feelers). **[ACAR: relocated to its OWN seed-derived
dune-desert anchor + sand-bowl clearing — separate from the graveyard, which now fills its center + spreads relics.]**
FSM: idle (buried) →
gapes when the player nears → PULLS the player toward the throat (`ctx.player.externalPull` injected into the KCC
`desired` vector) + BITES (damage ticks) in the inner radius. Reuses the sandworm's damage/die/pause patterns. Smoke
test: maw opens → pulls player 5.6m→0.3m → bites (health 1→0.86). **Pull FEEL flagged for attended tune.** (D202.)

**Y5 — Ecology.** The graveyard ribcages join the vulture ecology (vultures wheel over it — the approach telegraph) +
prey gathers. main.ts threads `getWreckYardCarcasses()` into the carcass list before the ecology spawn.

**Y6 — Perf merge (D203).** The dense field measured 2055 draw calls in-view; placeWreckYard now re-parents every
wreck group into one `yardGroup` (`group.attach`) + `mergeStaticByMaterial` → **2055→1664** (the D198 cluster-merge
applied; panels stay live, per-part colliders survive). Remaining draw calls: sand mounds/debris/bones unmerged
(flagged follow-up) + the world. Bury-audit ~96-98% (the pre-existing curved-hull-panel flake rate; the graveyard just
adds ~70 panels — not a regression).

**Deferred/flagged:** route mounds/debris/bones into the yard merge (a `parent` opt); the pull-feel tune; the
muddy-bare wreck-yard ground color; the big hand-wreck panels aren't registered as salvageable (relics carry the loot).

## Session ACAP — 2026-06-14 — Overnight: finish the wreck arc (hand-POI merge + shared-material depth + crash debris) ✓ verify pass (tsc clean)

`verified` — `npm run verify` (tsc) PASS; **no save bump** (geometry/material/tooling only). A measure-first long
overnight that closed the wreck arc's perf + visual gaps. 3 commits (`584d1b0`,`c5f2d2b`,`a33435d`); D198-D200. Shipped
3 fully-iterated tiers; W2 (flagship greebles) + W5 (lighting) deliberately deprioritized after measurement.

**W1 — hand-POI static-merge (the perf win, measure-first).** A NEW `perf-probe` deep-dump (`topGroupsDeep` child-kind
histogram) showed the remaining draw-call hogs were the hand-modeled POIs that never got the ACAM/ACAN static-merge —
NOT the procgen fleet (already merged) and NOT a need for LOD. Merged them, render-identical: **opening wreck ~80-130→13
meshes, rockyEntrance →37, saltOutpost →28.** Hardened `mergeStaticByMaterial` to skip any `userData.interactType`
subtree (journals/loot/triggers), not just `accessPanel`/`noMerge` — so merging arbitrary hand POIs can't fold a live
interaction into a static mesh. **Heavy distance-LOD CUT** (measure-first): the merge already won the budget; the
remaining big groups are mesh-heavy already-merged procgen wrecks + the speeder (animated → unsafe unattended) + pickups
(interaction-raycast risk). (D198.)

**W3 — shared hull-material depth (highest-leverage).** `createRustedHullMaterial` read flat-grey. Added 3 weathering
layers on the existing wear/streak/bleach: **(4) form-AO** (undersides darken → volumetric), **(5) bare-metal scuff
flecks** (sparse chipped-paint), **(6) oxidation zones** (low-freq warm rust-brown patches = COLOR depth, the main
flat-grey fix); bumped `wearAmplitude` 0.15→0.20. ONE shared-material change lifted EVERY wreck — verified across procgen
corvette + bulk_hauler + the mega-wreck hero + the megaShip flagship, all weathered-with-depth, none over-rusted. (D199.)

**W4 — crash-debris fans.** A 2-4 fragment fan (plates/pipes/struts) shed onto a random impact flank of ~60% of procgen
wrecks. NEW `addDebrisFan` adds them to the wreck GROUP before the merge so they fold into the static merge (~0 draw
cost); placed at **local-y = buryY** so they rest on the sand AFTER the half-burial sink (not buried, not floating). All
`isWreckDecoration`; bury-audit ALL CLEAR (53/53). Skipped biome-greeble-weighting (low payoff + hard to verify). (D200.)

**Findings flagged (not done unattended):** speeder static-merge (86 meshes, but animated/interactive parts → needs an
attended pass to tag `noMerge`), pickup InstancedMesh (340 branch+scrap meshes, but breaks per-item interaction raycast).
**Deferred:** W2 flagship greebles (W3 lifted them), W5 brighter lighting (global/risky/hard-to-verify headlessly), the
ACAL mega-wreck interior WALK-TEST (needs a human).

## Session ACAO — 2026-06-13 — Procgen-wreck rig-shot framer (the BLOCKER) + T5 greebles & impact asymmetry ✓ verify pass (tsc clean)

`verified` — `npm run verify` (tsc) PASS; **no save bump** (geometry/material/tooling only). Built the verification
unblock the ACAN T5 attempt was missing, then shipped the procgen visual level-up it enables. D197.

**Procgen-wreck rig-shot framer (the BLOCKER).** Procgen wrecks are unnamed + random-positioned, so no rig-shot could
frame one → procgen visual work couldn't be screenshot-verified (rule 8 killed the ACAN breach attempt). NEW
`__game.spawnProcgenWreckRig(cls, seed)` debug hook spawns a chosen wreck CLASS at a fixed clear anchor with a
DETERMINISTIC seeded rng, **pins it to a known orientation** (kills `placeProcgenComposite`'s random placement yaw so
the +Z detail flank — breaches + panels — faces the camera; "pin ambiguous world axes"), and names it
`procgenWreckRig`. NEW `procgen-wreck` rig-shot scenario reuses the `flagship` find/frame/mesh-count logic + is
**ground-aware** (frames the EXPOSED hull above the sand line, not the buried bbox). Bonus: `--seeds=1,2,3` sweep
(N screenshots per dev-server boot — the fast iteration path) + `--zoom`. Also fixed a **Windows vite-orphan teardown
hang** (the harness wedged after the screenshot was already written — `dev.kill()` only signalled the npm wrapper,
leaving vite holding the port + stdio pipes open; now `taskkill /T /F` on win32 + `process.exit(0)`).

**T5 — greeble vocabulary + impact-flank asymmetry.** `addHullGreebles` vocabulary 3→7 types: added louvered vents
(dark frame + angled slats), circular ports/portholes (rim ring + recessed dark inner), fins/strakes (outward blade),
antenna stubs (whip + base) — on top of the existing seams/rivets/vent-boxes. **Impact asymmetry**: each hull picks a
side that "took the hit"; ~78% of greebles + the damage patch cluster there, the lee flank stays cleaner (negative-
space contrast) — wired into RIBBED_CYLINDER + PLATED_RECTANGULAR (`addBreachPatches` gained a `side` param). Verified
across corvette (small) + bulk_hauler (large); **bury-audit 56/56 ALL CLEAR** (greebles tagged `isWreckDecoration` so
`findPanelMount` rejects them + the T6 merge folds them in).

**Attempted + reverted (D197):** real `makeBreach` holes on the procgen hulls — `makeBreach` does NO boolean cut, so
on a small intact procgen hull (~1m radius) the recessed void is OCCLUDED by the skin in front of it (no hole reads)
and pushing it proud reads as a crusty bump, not a hole. Only the 136m hero has the scale to sell it. Kept the flat
dark battle-damage patch (reads reliably at this scale). 3 iterations (recessed → big-proud → revert) per rule 8.

**Deferred:** T7 InstancedMesh/LOD (stretch); the ACAL mega-wreck interior WALK-TEST (needs a human in `npm run dev`).

## Session ACAN — 2026-06-08 — Flagship perf merge (finishes T6) + mega-wreck panel fix ✓ verify pass (tsc clean)

`verified` — `npm run verify` (tsc) PASS; **no save bump** (geometry/material only). Finished the ACAM-deferred
flagship merges (the biggest remaining frames win) + fixed the lingering mega-wreck salvage-panel bury-audit fails.
2 commits (`2d6127d`, `d907893`); D195-D196.

**Flagship static-merge (D195).** ACAM merged the procgen fleet + the mega-wreck, but the 3 hand-modeled FLAGSHIPS
were the actual mesh hogs (D193) + were deferred (no verification rig-shot). Wired `mergeStaticByMaterial` into
`placeMegaShip`/`placeSatelliteDish`/`placeCrashedHull` (merge the root before return; panels stay live via the
accessPanel-subtree skip; their collision is hand-built static boxes, independent of the visual meshes). **megaShip
160→67 · satelliteDish 148→47 · crashedHull 51→44 (~201 meshes saved).** NEW generic `flagship` rig-shot
(`--name=<group.name>`) finds-by-name + frames + reports mesh count — each flagship NAMED so it's findable; all 3
render structurally identical (panels/dish-struts/fuselage-bands intact). **The static-merge now covers every big
wreck/flagship in the game.**

**Mega-wreck panels (D196).** The 2 persistent "massive" bury-audit fails (+ the ACAL panel-reachability concern):
the lee-flank panels used `faceYaw = +π/2`, which rotates the panel's local +Z (its outward normal + recess axis)
to +X — i.e. INTO the hull. So they faced inward, recessed outward, and the audit (which raycasts along the panel's
+Z) started inside the hull → instant occlusion. One-line sign fix → `-π/2` (face -X / outward). **Panel bury-audit
68/68 ALL CLEAR** (was 61/63).

**Attempted + reverted:** T5 real-`makeBreach` holes on the procgen hulls — couldn't verify visually (procgen wrecks
are unnamed + random-positioned, so no rig-shot frames them) → reverted per rule 8 (don't ship visual work verified
only by tsc + audit). Owed first: a procgen-wreck rig-shot framer, then T5.

## Session ACAM — 2026-06-08 — Wreck-fleet level-up: WebGL static-merge perf + faceted procgen hulls + half-burial ✓ verify pass (tsc clean)

`verified` — `npm run verify` (tsc) PASS; **no save bump** (geometry/material/collider only). Finished the
deferred ACAJ **T3/T4/T6** (the wreck-fleet level-up + the never-cut perf merge) from the planned overnight.
2 commits (`6eb925f`, `84cda18`); D192-D194. Shipped the 3 core tiers fully-verified; T5 (greeble) / T7
(LOD) + the flagship-merge extension are noted stretch/follow-ups.

**T6 — WebGL static-mesh MERGE (the perf win, NEVER-CUT).** NEW `mergeStaticByMaterial(root)` (wreckForms):
collapses a wreck's many static, non-interactive meshes into ONE mesh per (material, attribute-sig,
shadow-flags), baked to root-local. Salvage PANELS stay live (skips the `accessPanel` subtree); transparent
meshes left unmerged (depth-sort safety). **Critical order (D192):** colliders are built per-part FIRST
(`attachCompoundCollider`) so per-part collision survives — Rapier colliders are independent of the meshes.
Wired into `placeProcgenComposite` + `placeWreck` + the mega-wreck (merged into its `shell` sub-group so
the tilt applies once + the interior stays framable). **Measured: mega-wreck 491→79 meshes (84%); the
procgen + hand-modeled fleet ~254→52 across ~42 wrecks (~80%).** Exterior + interior render identical
(side/3q/int-aft confirmed). **Measurement finding (D193):** the prior "wrecks dominate ~4900 meshes" claim
was WRONG — wrecks are ~250; the mesh hogs are the hand-modeled FLAGSHIPS (mega-wreck was 491 alone). NEW
`perf-probe` biggest-objects breakdown surfaced it.

**T3 — procgen hull vocabulary level-up (D194).** The two SMOOTH-cylinder hull variants (RIBBED_CYLINDER,
PANELED_TAPERED) now use `makeLoftedHull` (faceted SHIP_SECTION: flat keel + hard chines + flat dorsal deck,
~0.1m plate) instead of `CylinderGeometry`, lofted along Z then rotated to the procgen +X long-axis. So the
~80 procgen wrecks read like the hero, not smooth pipes. Boxy/truss/barrel/antenna variants stay (read
intentionally different). `findPanelMount` raycasts the new surface fine — panel bury-audit 61/63 (all
procgen panels pass).

**T4 — half-burial.** A windward `makeSandMound` drift bedding each procgen wreck into the dune (visual-only).

**Also:** mega-wreck lee-flank salvage panels were inset behind the now-thick hull → nudged proud (the 2
remaining bury-audit fails are these hand-placed panels on the busy tilted flank — an ACAL carryover, owed a
`findPanelMount` pass; NOT a regression).

## Session ACAL — 2026-06-07 — Mega-wreck walkthrough fixes: exact collision, natural light, entrance, no floaters ✓ verify pass (tsc clean)

`verified` — `npm run verify` (tsc) PASS throughout; **no save bump** (geometry/material/collider
only). The user WALK-TESTED the ACAK wreck and reported issues across two passes; fixed each + ran
an adversarial **floater-hunt** (4 agents read the interior PNGs + geometry code → ranked floaters)
to convergence over 3 rounds. 6 commits (`2ed662b`→`0aae9f9`). **D189-D191.**

**Collision — 100% EXACT trimesh (D189).** The coarse hand-authored cuboid proxy (player clipped
through everything) is replaced by ONE Rapier **trimesh built from EVERY solid mesh** in the wreck
(hull, decks, ribs, beams, debris, cables, props, island, engine bells…), each baked into the
body-local frame so it inherits the ~17° shell tilt from the mesh hierarchy. Collision matches the
rendered model triangle-for-triangle (only flat fake-AO/scorch CircleGeometry decals skipped). Kept
the invisible deck curbs + entrance ramp; panels/journal built AFTER the trimesh → stay interactive.

**Lighting — natural-only (D190).** Removed ALL custom wreck lighting (the artificial god-ray cones
+ fracture flood + every fill/rim/emergency PointLight + console glow + ember). The wreck is lit
only by the world sun/ambient. Also removed the (A9) rust-streak decal planes — they used an UNLIT
`MeshBasicMaterial`, so under natural light they glowed flat-pink while everything darkened ("floating
pink light rectangles"); the lit hull-shader streaking stays. Dead campfire (charred logs + ash, no glow).

**Entrance + open fracture.** `makeLoftedHull` builds open-ended tubes → the mid-hull FRACTURE gap
is genuinely open in the trimesh = the walkable entrance; added a sand/debris RAMP up into it on
the lee flank. Removed the (A3) `aBack`/`bBack` backboard walls that sealed the split → it now opens
straight to the interior (the user flagged the gray wall as unrealistic).

**Panels.** The 2 salvage panels were hardcoded to the buried +X flank (one floated on the sand);
reseated ON the real exposed lee (-X) hull surface via `hullAt` sampling + a terrain-height guard,
facing outward. (`findPanelMount` already exists for procgen wrecks; the mega-wreck now surface-snaps.)

**Thicker hull (D191).** `makeLoftedHull` gains a `thickness` param — a second inner skin + rim caps
at the open ends, so torn edges read as ~0.4m plating, not a paper surface (mega-wreck uses 0.4).

**Floater-hunt → convergence (D191).** 3 rounds fixed ~16 distinct floaters, almost all from one bug
class (a fixed Y at a cluster-center, never sampling the curved surface at the piece's own X/Z on
the canted deck). Added shared `ceilingY(x)`/`hullHalfWAt(y)` samplers. Fixes: frame ribs + fracture
formers FULL hoops (lower arc 5m into the belly) → partial **top-arcs** (NEW `arc` option on
`makeFormerRings`) springing from the deck + leg-stubs; overhead beams span the full hull (both ends
embed); ducts strapped to the ceiling; cable brackets bedded into the curved ceiling; bridge
console/chair per-Z seated; props out of the empty gap; spine stubs embedded; bulkhead flap parented;
tarp grounded; stanchions sized; interior ceiling cap occludes the island's exterior gear (was seen
through the hull). No gross floaters remain; residual sub-0.6m nits + the in-app walk-test owed.

## Session ACAK — 2026-06-07 — Mega-wreck FROM-SCRATCH rebuild: sleek dagger + aligned wreck interior ✓ verify pass (tsc clean)

`verified` — `npm run verify` (tsc) PASS throughout; **no save bump** (geometry/material/collider only; rebuilds from
seed). The user flagged the ACAJ mega-wreck as shipped-too-early / low quality ("reads boxy", a "smoother box"). Reworked
the hero centerpiece **ground-up across the whole session**, driven by research + adversarial self-critique. ~18 commits
(`6c3fe99`→`bcff628`). **D186-D188.** Reusable research + critique + defect-hunt **workflow harness** built (agents read
the actual rig-shot PNGs + the geometry code). The exterior dagger reads as a real crashed warship; the interior is
rebuilt + dressed + collision-correct but **owes an in-app walk-test + a deeper lighting/material pass** (honestly flagged).

**Research (3 specs).** `docs/research/megawreck-anatomy.md` (exterior build spec + 12-pt rubric, 6-facet web research),
`megawreck-concept.md` (the dagger + interior concept), `megawreck-interior-v2.md` (the from-scratch wreck-interior concept
after the user rejected corridors).

**Exterior — sleek crashed DAGGER (replaces the wide hauler).** NEW `makeLoftedHull` (wreckForms) — a FACETED ship-hull
cross-section (flat dorsal deck + hard chines + flat sides) lofted along Z, replacing the smooth lathe "dome" that read as
a lump. The whole exterior lives in a `shell` group **tilted into a ~17° list + sunk** (pivot-compensated `shellQuat()`/
`shellPos()` so the hull KISSES the ground, doesn't lever the aft up). A `hullAt(z)` sampler interpolates the cross-section
so flank detail sits ON the hull (no floating/clipping). ~5:1 dagger, sharp bow driven into the dune, mid-hull FRACTURE
notch with a cut-open cross-section (former rings + staggered deck slabs + spine stub + cables), a tapered angular command
island (windows + leaned sensor mast + dish array), 2 projecting hollow engine bells on a transom plate + cage, asymmetric
breaches, hull plating strakes + frame ribs, directional rust streaks, asymmetric half-burial (tilt-aware sand drifts +
nose scorch + debris). Coarse exterior collision proxy (flank slabs + caps + island + engines, transformed to the tilt).
Critique trajectory 2.75 → 3.75/10 on the wide hull; the dagger then read as a sleek crashed blade.

**Interior v2 — the broken GUTS of the dagger (scrapped the corridors).** The clean spinal-corridor interior was a LEVEL
box-cavity under a tilted shell (inside + outside didn't agree). Rebuilt: `interiorDecks()` descriptors built in the SAME
tilted `shell` frame (one rigid listed object), the floor carrying the full ~17° list (user's call: max authenticity); the
DoubleSide hull is the walls + ceiling (literal inside of the skin, derived from `hullAt` → no poke-through). Wreckage:
exposed rib skeleton, peeled bulkheads, varied debris (plates/drums/pipes, flowed down the +X flank), collapsed overhead
beams + hanging ducts, cables to ceiling brackets, wall consoles, a bow-breach sand-fan. Set dressing: framed cargo crates
+ barrels + fallen doors (grounded by contact-AO discs), a survivor camp (crate-table + tarp + fire) in the shelter nook,
a dressed bridge (captain's console + chair + viewport), scorch decals. **Lighting:** the open fracture is the HERO
daylight flood (rim-lit formers) + breach pools + bounded fill so the canted upper hull reads (removed a global-
HemisphereLight bug that washed the whole desert). **Collision:** deck colliders + curbs + prop colliders + a STEPPED
fracture crossing fixing a ~2m unclimbable step that had made the bridge payoff unreachable.

**Verification harness (reusable workflows).** `megawreck-research` / `megawreck-interior-research` (web→spec),
`megawreck-critique` (4 adversarial critics read the renders + score a rubric), `megawreck-interior-defects` (4 lenses read
renders + code, ranked fixes). Interior ran 4 defect-hunt→fix rounds. The `megawreck` rig-shot gained front-lit framing +
5 interior camera angles (shell-frame). NEW wreckForms: `makeLoftedHull`, `dentGeometry`, `makeCable` (+ DoubleSide voids).

**Still owed (honest):** interior in-app WALK-TEST (a ~17° canted floor + the 9-step fracture crossing can't be verified
from screenshots); a deeper interior lighting/material pass (rust/grime, contact AO, rib arcs). The deferred ACAJ T3-T7
(procgen fleet level-up, perf merge) now ride on the bigger `wreckForms` toolkit.

## Session ACAJ (partial) — 2026-06-06 — Wreck toolkit + mega-wreck rebuild (T1+T2 of 7; T3-T7 deferred) ✓ verify pass (tsc clean)

`verified` — `npm run verify` (tsc) PASS; **no save bump** (geometry/material only). The "wrecks + perf" overnight
(user-chosen): rebuild the boxy mega-wreck + level up the procgen fleet + WebGL perf pass. **Shipped the foundation + hero
centerpiece (T1+T2), deliberately deferred T3-T7** rather than rush the visual breadth + the panel-interaction-touching
perf merge shallowly (rule 8 / the ABP lesson). 3 commits (`0f3d718`→`5262f0e`). **D185.**

**T1 — shared procedural-hull toolkit (NEW `world/wreckForms.ts`).** The reusable building blocks for believable
crashed-ship wrecks (used by the hero + the fleet so leveling a block improves every wreck): `makeLatheHull(profile, opts)`
+ `fuselageProfile()` (tapered/bowed hull sections via LatheGeometry, generalizing the `openingWreck.ts` profile pattern;
`axis: 'x'|'y'|'z'`; partial-arc `phiLength` for torn-open ends); `makeFormerRings()` (exposed internal rib skeleton shown
at breaks); `makeBreach()` (torn hole = recessed dark void + ragged bent torn-metal flaps, NO boolean/CSG) +
`tagWreckDecoration()`; `makeSandMound()` (windward sand-drift for half-burial, visual-only). NEW `__game.wreckFormStudio`
dev hook + `wreck-form` rig-shot — each primitive screenshot-verified in isolation (lathe = clean tapered fuselage,
formers = torn-open hull showing its rib skeleton, breach = torn hole).

**T2 — mega-wreck exterior rebuild (D185).** `makeMegaWreck` read as a cluster of dark boxes. Replaced the ABL
straight-cylinder shell + rust bands + rib bumps with a toolkit-built **curved hull** — a tapered fuselage aft section +
nose + **exposed former rings at the mid-hull fracture** (the ship's rib skeleton where bow + aft tore apart) + **3
asymmetric impact breaches** (functional asymmetry) + a tapered/raked **bridge superstructure** cap. All FrontSide +
`noCollider` so the entire interior architecture (walk-through cavity, ~25 colliders, 2 salvage panels, shelter zone,
journal, catwalks, skylights, doorways) is UNTOUCHED — the hull envelops the wide box so the box reads as inner structure,
not the silhouette. NEW `megawreck` rig-shot (orbit/interior); ~5 screenshot-iterated rounds → reads as a downed ship.

**Deferred to the ACAJ continuation:** T3 procgen-fleet vocabulary level-up (apply the toolkit to the shared part
builders), T4 half-burial + sand integration, T5 greeble + asymmetry pass, **T6 WebGL wreck perf merge** (never-cut), T7
InstancedMesh/LOD. The toolkit (T1) makes T3-T5 efficient; the perf merge (T6) is the frames win.

## Session ACAI — 2026-06-06 — Vulture: rigged animations + branch-perch + death physics + tree collision ✓ verify pass (tsc clean)

`verified` — `npm run verify` (tsc) PASS; **no save bump** (all additive/transient, v14). Turned the ACAH static-mesh
vulture into a believable living creature + fixed dead-tree pass-through. 4 commits (`9fb9dbf`→`d05eebf`, after T1+T2 at
`ca277fb`). Every pose screenshot-iterated (rule 8); in-motion flight/tumble cadence is foreground-owed (D150). **D181-D182.**

**T1 — vulture rig (joint pivots).** `makeVultureVisual` restructured from a flat ~20-mesh group into animatable sub-`Group`
pivots (mirrors the lizard/shrew leg-pivot convention): `wingL/wingR` (shoulders), `neck` (carries head/beak/eyes), `tail`,
`legL/legR` — children offset so rest pose reads identical to the ACAH silhouette. Stored on `mesh.userData.rig`.

**T2 — animation driver.** NEW `animateVulture(v, elapsed)` poses the rig per state: perched (slow neck-bob + wing settle),
flying (wings spread + flap at `VULTURE_FLAP_HZ`, legs tucked, neck extended, tail trail), landing (cupped flare + reaching
legs + fanned tail), dead (limp splay). New `VULTURE_*` anim consts (rule 2). `vulture-pose --state=` rig-shot per state.

**T3 — branch-accurate perch (D181).** Dead trees merge to ONE geometry so branch meshes don't survive — `deadTree.grow()`
now records perch points (~60% along depth-2 limbs + the limb direction) into `userData.branchPerches` BEFORE the merge;
`spawnDeadTrees` transforms them to world (`tree.rotation.y` + position) and returns `TreePerch[]` (pos+dir). The spawner
seats the bird's feet on the limb (+0.03 seat bias) and yaws it ACROSS the branch. Verified feet-on-branch across seeds.

**T4 — relocate-and-land FSM (D181).** A disturbed vulture now flies to a DIFFERENT salt-flat tree and re-perches (stays
alive + re-disturbable) instead of fleeing into a despawn. States `perched|flying|landing|dead`. `pickRelocateTarget`
chooses a perch on another tree (≥ `VULTURE_RELOCATE_MIN_DIST`, clear of the player; falls back to flee+despawn when none
qualifies); flying steers + climbs to a cruise altitude then drops into a landing flare; landing descends onto the perch +
yaws across the limb; re-launches if the player closes in. Kinematic body follows throughout (shootable mid-air).
`vulture-flight` eval asserts the full cycle perched→flying→landing→perched with the target on another tree.

**T5 — death = dynamic-body tumble (D181).** `damageVulture` tears down the kinematic body and spawns a DYNAMIC one at the
posed mesh transform (mirrors dropped-item physics: cuboid from the AABB, CCD, linDamp 0.6 / angDamp 0.8 / friction 0.85 /
restitution 0.15), seeds flee/fall momentum + a tumble angvel, bakes the limp pose once. The collider is offset to the body
centre so it spins about its CoM while `body.translation()` maps onto `mesh.position`. Settles on LOW LINEAR velocity (0.3s)
/ body-sleep / a 2.5s hard-cap age — angular jitter from heightfield contact is ignored (it would otherwise never rest).
New DEV handle `__game.killVulture(id)`; `vulture-kill` rig-shot drives the real death + asserts the corpse rests on the dune.

**T6 — dead-tree trunk collision (D182).** Trees were visual-only (you walked through trunks). `makeDeadTree` exposes trunk
dims (`trunkRadius = baseR*1.35`, `trunkColliderH = bole+0.6`); `spawnDeadTrees` gains a `world` param (threaded from
`main.ts`) and adds one `makeStaticCylinder` per trunk over the bole. Fine crown twigs stay non-colliding. `tree` rig-shot
asserts `trunkCol=1` per tree.

**Constants tuned/added** (`tuning.ts` VULTURE block): `VULTURE_IDLE_BOB_HZ/AMP`, `FLAP_HZ 3.2`, `FLAP_AMP 0.55`,
`WING_EXTEND 0.35`, `LEG_TUCK`, `NECK_EXTEND`, `LAND_DURATION`, `CRUISE_HEIGHT 7`, `LAND_DESCENT 2.2`, `LAND_SPEED_FACTOR`,
`RELOCATE_MIN_DIST 40`, `LAND_ARRIVE_DIST 2.5`, `DEATH_SPIN 7`, `SETTLE_VEL 0.7`, `SETTLE_MAX_AGE 2.5`.

**Follow-up (same-day, post-playtest):** addressed user feedback on the vulture. (1) **Big wingspan** — wings rebuilt
from single short slabs into TWO-segment articulated wings (shoulder→arm→elbow→forearm + 4 slotted primaries, ~3× body
width when spread); `VultureRig` gains `elbowL/R`; `animateVulture` poses shoulder + elbow per state and folds the long
wings cleanly along the flank for perching. (2) **No more dune clipping** — flight altitude is clamped to
`terrain.heightAt + VULTURE_MIN_FLIGHT_CLEARANCE (3m)` every frame in flying/flee (the cruise target was relative to the
DESTINATION tree, so the path sank into dunes between trees); `vulture-flight` now asserts `minClear≥2`. (3) **Flap/glide
variation** — the flight flap is gated by a slow `VULTURE_GLIDE_CYCLE_HZ` envelope (flap a few beats, then glide with the
wings held in a shallow dihedral). (4) **Extras** — the bird now casts a shadow; banks into flight turns
(`applyFlightOrientation` rolls the inside wing down). New consts: `DIHEDRAL`, `GLIDE_CYCLE_HZ`, `PERCH_WING_DROOP`,
`ELBOW_FOLD`, `BANK_ANGLE`, `MIN_FLIGHT_CLEARANCE`.

**Follow-up 2 (same-day) — carcass ecology (D183).** A living-world layer around the bone carcasses (ribcage hero
landmarks). (1) **Circling:** `placeHeroLandmarks` now returns carcass positions; `spawnCirclingVultures` puts a vulture
(≤ `VULTURE_CIRCLE_COUNT`) in a NEW `circling` state wheeling in a banked soaring orbit over each carcass (the "something
died here" signal, visible from afar; shootable for meat). (2) **Prey clusters:** carcass positions are folded into the
lizard/shrew `allPoiPositions`, so prey gathers at the bones. (3) **Swoop predation:** a circling vulture off-cooldown
locks the nearest live lizard/shrew within `VULTURE_HUNT_RADIUS`, enters `swooping` (tracks the fleeing prey + dives at
`VULTURE_SWOOP_SPEED`), `grabPrey` removes the creature (`lootLizard`/`lootShrew` via `ctx`) + clutches a prey silhouette
in the talons, then `carrying` climbs away before the prey despawns + it resumes circling. A shot mid-carry drops the prey.
NEW rig-shots `vulture-circle` (soaring still) + `vulture-hunt` (swoop→grab→carry PASS, lizard removed). New consts
`VULTURE_CIRCLE_*` + `VULTURE_HUNT_*`/`SWOOP_SPEED`/`GRAB_DIST`/`CARRY_DURATION`. No save bump (circling/swoop/carry are
transient → re-derive to perched on load).

**Follow-up 3 (same-day) — shrew burrow-escape + meat scavenging (D183 extended).** (1) **Shrew dives for cover:** a
swooped shrew within `VULTURE_SHADOW_WARN_DIST` gets one `SHREW_BURROW_ESCAPE_CHANCE` roll to bolt underground
(`alertShrewToSwoop` → `burrow` state + a player-independent `burrowHold` so it stays under); the vulture's target-finder
keeps it grabbable only until it's half-buried (`burrowT < 0.5`), so it's a genuine race — escape and the vulture pulls up.
(2) **Scavenge dropped meat:** a circling vulture off-cooldown now prefers CARRION — any `raw_*_meat`/carcass pickup within
the generous `VULTURE_SCAVENGE_RADIUS` (probability-gated, `VULTURE_SCAVENGE_CHANCE`) — and will travel to swoop, grab it
off the ground (`despawnPickup`), and carry it off. Cross-module via `ctx.pickups`/`despawnPickup` + `alertShrewToSwoop`
(no new circular deps). NEW rig-shots `vulture-escape` + `vulture-scavenge` (both PASS); hunt/flight/kill regressions PASS.

**Follow-up 4 (same-day) — gaunt/mangy model pass.** Per user feedback the vulture read too plump. Reworked
`makeVultureVisual` from a round ovoid into a STARVED silhouette: a small slim upright trunk raised off the legs (the two
thin bare shanks now show beneath = scrawny stance), a deep narrow breast keel + pinched lower belly (no fat gut), bony
hunched shoulders, ragged uneven feather tufts on the back/rump, and worn bare-skin patches showing through where feathers
fell out. 3 screenshot-iterated rounds (rule 8). Also fixed the `vulture-pose` rig-shot to frame a true side/front-quarter
profile (was showing a rear view). Geometry-only — no FSM/physics/save impact.

**Follow-up 5 (same-day) — flight head-direction fix + realistic feed loop.** (1) **Head was backwards in flight:**
`applyFlightOrientation` set the mesh yaw to `heading + π/2`, which (model faces +X) points the head OPPOSITE the travel
direction; corrected to `heading − π/2`. `vulture-flight` asserts `minFacing > 0.7` (measured 1.0 — head dead-on along
travel). (2) **Carried prey no longer teleport-despawns:** the old `carrying` snapped straight back to the orbit (a visible
vanish). Now the loop is **carry (fly off low with the meat a real distance — `VULTURE_CARRY_DIST` ≈ 38m — from the carcass) →
feeding (land + tear at it, consume partway) → returning (fly back to the carcass) → circling** (rejoins the orbit
seamlessly at the current angle — no snap). NEW states `feeding`/`returning` + poses; new consts `VULTURE_CARRY_DIST`/
`VULTURE_FEED_DURATION` (carry is distance-gated with a time-cap safety net). `vulture-hunt` asserts the full
swoop→carry→feed→return cycle + that it fed ≥30m from the carcass. tsc clean; all vulture evals PASS.

## Session ACAH — 2026-06-05 — Big overnight: bug sweep + loot bootstrap + vulture + cloud shadows ✓ verify pass (tsc clean)

`verified` — `npm run verify` (tsc) PASS; **no save bump** (all additive, v14). A large multi-tier session: cleared the
autonomous-verifiable backlog (bugs + the early-game loot deadlock), added a researched new creature + an atmosphere
effect, and fixed a game-wide latent shader bug. 7 commits (`39af9d7`→`ae3f030`). Every visual element screenshot-iterated
(rule 8).

**Tier 0 — bug + quick-win sweep (5).** (1) **Mounted-vs-on-foot lighting (D180):** `lighting.ts` followed the player
body for the sun/moon/shadow camera, but the player capsule is parked at **y=-2000 while mounted** (`speeder.ts:935`) →
the whole world's lighting shifted (moonlight even inverted). Now follows the speeder body while mounted. (2) **DEV MODE
keybind:** the badge can't be clicked during play (pointer locked to the canvas), so added a **Backquote (`)** toggle that
turns dev mode on + opens the spawn panel. (3) **Speeder tow-bar reseat** (was floating ~6cm; posts lengthened to embed
in the deck). (4) **Antenna slow-blink beacon** (parented PointLight + tip-color pulse) so a parked bike is findable at
night. (5) **Night-dust ground-clamp** — the `dustMotes` upper vertical-wrap drops at night so motes don't drift over the
stars (`night-sky` rig-shot confirms a clean star field).

**Material program-cache collision — fixed GAME-WIDE (D177, extends D175).** Wood got `customProgramCacheKey` in ACAG,
but **metal/fabric/glass/bone/skin/paint/stone ALL** bake per-instance constants into their `onBeforeCompile` GLSL via
`toFixed` with no cache key → Three shared ONE compiled program per factory and silently ignored per-instance effect
params (rust/scratch/grain/frost/…). Base `color` still varied (real uniform) — why it went unnoticed. Added the guard to
all 7 (metal hand-encoded; the rest `JSON.stringify(opts)`). terrain excluded (bakes only global consts). Verified
no regressions across items + the player rig.

**Tier 1+2 — loot bootstrap + scrap model (D178).** The early game DEADLOCKED: salvage panels need a `scrap_bar`, the
recipe needs **2 scrap**, and scrap only dropped from panels. Fix: **scatter 2-4 scrap in a ring around every wreck**
(massive wrecks get a larger ring), deterministic from `scatterRand` — mirrors branches-around-trees. NEW
`world/scrapMesh.ts buildScrapMesh` (shared detailed salvage-debris model: torn/bent plate + folded flap + crumpled plate
+ angle bracket + rivets + bent rebar + wire coil) used by BOTH the held item AND the world pickups; the flat box+2-bolts
scrap is gone. `scrap-loot` rig-shot: 223 scrap, all within 12m of a wreck across 78 parts.

**Tier 3 — sandworm shelter-immunity.** The worm can't sense a sheltered player. `tickPatrol` skips ambush+alert
acquisition while `ctx.player.inShelter`; `tickAlert`/`tickCharging` disengage if the player reaches cover mid-approach.
`worm-shelter` rig-shot eval: PASS (sheltered=patrol, exposed=alert).

**Tier 4 — rare desert vulture (D179).** NEW `enemies/vulture.ts` — a researched perched scavenger (Deadvlei
lappet-faced refs: hunched body, bald pink head on an S-neck, hooked beak, dark folded wings, neck ruff, gripping
talons). Mirrors the shrew pipeline: perches on salt-flat dead-tree crowns (`spawnDeadTrees` now returns crown perch
points), flees + climbs away when the player closes (the kill window — needs a gun), a hit drops it (gravity fall → land
→ flop → `raw_vulture_meat` → cooks). Full combat/interaction/items/save (additive) wiring. ~3 spawn world-wide. Model
iterated 4 rounds (`vulture` rig-shot); `vulture-kill` eval PASS. In-flight flee FEEL is foreground-owed (D150).

**Tier 5 — moving cloud shadows.** Dapple the terrain under the overcast cloud field — `terrainMaterial` samples low-freq
noise at world XZ drifting over `uTime` (gated by a new `uCloudiness` uniform from `ctx.weather.cloudiness`), darkening
diffuse under cover. Subtle at gameplay angle (a top-down crank confirmed the patches). `tuning: CLOUD_SHADOW_*`.

**NEW rig-shot scenarios:** `scrap-loot`, `worm-shelter`, `vulture`, `vulture-kill`, `cloud-shadows`, `perf-probe`.

**Follow-up — perf pass (user-reported startup freeze + lower FPS).** Diagnosed via the NEW `perf-probe` scenario
(renderer.info + scene counts). Two regressions from this session's work, both fixed: (1) **startup freeze** — the boot
`renderer.compile()` pre-warm was sized for ~16 programs (ABL) but D175/D177 un-shared per-material programs to **~120**,
so the SYNCHRONOUS compile became a multi-second freeze before the title appeared → switched to **`compileAsync()`**
(parallel, off-main-thread, fire-and-forget; title shows immediately). (2) **lower FPS** — the scrap scatter added 233
pickups × ~12 meshes = ~2800 meshes (34% of the scene) + ~140 branches × ~6 → **merge each world pickup into ONE
geometry+material** (the dead-tree trick): scrap 2796→230 meshes, branch 772→140; **draw calls 2386→~1150 (halved)**,
scene meshes 8313→5267. Held items keep the detailed multi-material version. **Round 2** (boot-phase timing via a NEW
`window.__bootT` instrumentation): (3) **metal → uniforms** — the metal shader now passes scratch/worn/rust/localSpace as
UNIFORMS instead of baking them into the GLSL, so all metal shares ONE program (cuts compile + per-frame state-switching;
superseded the metal cache key). (4) **shared pickup geometry** — `buildScrapMesh` is deterministic, so all ~220 scrap
were rebuilding identical geometry; now ONE shared geo (+ per-spawn yaw) + a 5-variant branch pool → boot scrap phase
**108ms→3ms**, trees+branches 143→63ms, **bootTotal 876→619ms (−30%)** + a big GPU-memory drop. No gameplay change.

## Session ACAF — 2026-06-04 — Branch model: dark wood-grain + side twigs + dead-tree color match ✓ verify pass (tsc clean)

`verified` — `npm run verify` (tsc) PASS; no save change. User feedback on the world branch: too light/grey, twigs
pierced straight through, needs detail/texture + should match the dark dead trees. 5 files: `world/branchMesh.ts`,
`inventory/items.ts`, `pickups/pickups.ts`, `world/deadTree.ts`, `scripts/rig-shot.mjs` (+NEW `branches` scenario).

**Twigs from the side** (`branchMesh.ts`) — the twigs were centered on the shaft axis so they crossed straight through.
Rebuilt: each twig is a per-subgroup cylinder whose BASE sits on the shaft surface and angles outward + a bit down the
branch (radial dir + forward lean, oriented via `setFromUnitVectors`), with a base collar hiding the joint and a tiny
secondary fork near the tip of the longer twigs. The main shaft now has a slight mid-length BEND (two segments + a
knuckle) so it reads as deadwood, not a dowel.

**Dark wood-grain + matching colors** — the branch (item + ground) is now dark aged-wood grain (`0x3a2e20`,
weatherLevel 0.7) instead of flat grey: the held item uses `vmWood`; the ~200 world pickups share ONE
`createWoodGrainMaterial` instance (`_worldBranchMat`, world-space — cheap, grain varies per branch). The dead trees
(`deadTree.ts`) switched from flat-grey Lambert to the SAME dark wood-grain family (trunk `0x463827`, branches
`0x3a2e20`), so the held branch, the ground branches, and the trees are now one coherent dark deadwood look (verified
in-context via the `branches` scenario — ground branch + dead tree match).

## Session ACAG — 2026-06-05 — Branch realism + full dead-tree rework + bark grain ✓ verify pass (tsc clean)

`verified` — `npm run verify` (tsc) PASS; no save change. A long iterative polish session (15 screenshot-verified
follow-ups) on the deadwood family + a viewmodel-lighting architecture change + a latent shader bug fix. Files:
`world/deadTree.ts` (rewritten), `world/branchMesh.ts`, `world/woodGrainMaterial.ts`, `player/viewModel.ts`,
`inventory/items.ts`, `pickups/pickups.ts`, `scripts/rig-shot.mjs` (+NEW `tree`, `branch-match` scenarios).

**Highlights:** (1) **Held == world lighting (D174)** — the FP viewmodel scene now MIRRORS the world sun/moon/ambient
each frame (was fixed studio lights), so every held item is lit identically to its dropped/world copy. (2) **Recursive
dead tree (D176)** — the single-pole model is gone; trees are a recursive forking generator (Deadvlei camelthorn refs)
merged into ONE geometry per tree (1 draw call ×45). (3) **Bark grain + a latent shader-cache collision fix (D175)** —
wood materials were silently sharing one compiled program (Three keys the program cache on material PROPERTIES, not the
onBeforeCompile source); `customProgramCacheKey` fixes it, and a new gated `bark` shader layer gives the trunk vertical
grain. (4) Deadwood color unified to ONE shared constant (`BRANCH_WOOD_COLOR`), shifted to light grey. Blow-by-blow below.

**Follow-up — seamless mid-branch taper.** The two shaft segments had a thickness STEP at the joint (thick end `r` met
thin start `0.58r`, plus a knuckle bulge). Reworked into a single CONTINUOUS gentle taper: the segment radii now MATCH
at the joint (`Rmid`), the knuckle shrank to a faint `Rmid`-sized smoothing sphere over the bend, and twigs/collars now
size + attach on the LOCAL shaft radius (`localR(f)`) so they sit on the tapered surface. Reads as one smooth taper now,
no middle seam.

**Follow-up 2 — single-mesh seamless shaft + viewmodel lit by the WORLD.** Two issues from the in-game screenshot.
(1) The two-cylinder shaft still showed a facet where the segments met at the bend angle. Replaced with ONE continuous
tapered `CylinderGeometry` (`Rbase`→`Rtip`, 8 height segments) with a gentle organic bow BAKED into the vertices
(parabolic Z displacement, 0 at the ends → max at mid) — a single mesh has no seam anywhere. Twigs offset by `bowAt(f)`
to follow the bowed centerline. (2) **The held branch and world branches looked like different colors even at the same
hex** — because the FP viewmodel renders in its OWN scene (D170) which had FIXED studio lights (ambient 0.9 + key 1.7 +
fill 0.45), while world props are lit by the day/night sun+moon+ambient. Root-cause fix (user's call — "everything needs
to be consistent; no model should look different in-hand vs in-world"): the vm scene's lights now **MIRROR the world
sun/moon/ambient every frame** (`updateViewModel` copies color+intensity+direction from `ctx.lights`; lights live in
`vm.scene` so directions are world-space and the camera-tracked item is lit exactly as a world object at that orientation
would be). So a held item now darkens at dusk, warms at noon, flattens under overcast — identical to its dropped copy,
for EVERY item, not just the branch. Trade-off vs the old studio rig: held items are no longer artificially bright at
night (realistic; the torch flame stays emissive). Reverted the follow-up-1 color-lift; the deadwood color is now ONE
shared constant (`BRANCH_WOOD_COLOR`/`BRANCH_WEATHER_LEVEL` exported from `branchMesh.ts`, imported by the held item,
ground pickups, and tree branches) so they can never drift. New `branch-match` rig-shot scenario (FP held branch + world
branch in one frame) confirms identical read at noon AND dusk. tsc clean.

**Follow-up 4 — light grey sun-bleached deadwood.** `BRANCH_WOOD_COLOR` 0x3a2e20 (dark brown) → 0x9b948a (pale grey),
dead-tree trunk → 0xa39c91. One shared constant moves held + ground + tree branches together.

**Follow-up 5 — dead-tree model rebuilt to match the branch detail.** The tree was straight 6-sided cylinders (trunk +
stub limbs) — read as primitive, nothing like a real dead desert tree. Rebuilt `deadTree.ts:makeDeadTree`: (1) the trunk
is now a 10-sided tapered cylinder with a parabolic bow (random azimuth) baked into the vertices + a subtle root flare at
the base; (2) the 4-6 limbs REUSE `buildBranchMesh` (the same tapered-shaft + emergent-twig model as the held/ground
branches) — `buildBranchMesh` gained `radiusScale` (chunkier limbs without lengthening) + `tipRatio` opts. Each limb's
thick base is BURIED into the trunk (offset by the per-height trunk radius — shared `leanAt`/`radiusAt` helpers keep
limbs exactly on the bowed/tapered surface) and a small flattened collar blends the junction, so nothing floats and no
flat base-caps show. Limbs spread along the upper ~60% and angle outward+up. Iterated 4 passes via a NEW `tree` rig-shot
scenario (trees tagged `name='deadTree'` so the harness can locate one): fixed ball-like collars → buried bases, and a
trumpet-like root flare → subtle. tsc clean.

**Follow-up 6 — limb taper direction fix.** The limbs fattened toward the TIP (backwards). `buildBranchMesh` puts the
thick base at +X / thin tip at −X, but `makeDeadTree` oriented the limb's +X OUTWARD — so the thick end pointed away from
the trunk. Fixed by orienting +X INWARD (`_limbInward = −_limbDir`) so the thin tip points outward and the limb tapers
trunk→tip correctly; base re-buried inside the surface accordingly. `tree` rig-shot confirms. tsc clean.

**Follow-up 7 — slimmer + de-cluttered dead tree.** The tree read too thick and the limbs piled up. Slimmed the trunk
(`baseR` 0.15+ → 0.085+) and the limbs (`radiusScale` 1.2+ → 0.7+), dropped the count 4-6 → 3-4, and DISTRIBUTED them:
each limb now gets its own staggered height band (upper 50-94%) AND its own even azimuth sector (+jitter) so no two bunch
on the same side at the same height. Iterated across 4 seeds via the `tree` rig-shot (slim lean deadwood, clean
junctions, correct taper, no overlap). tsc clean.

**Follow-up 8 — height + pointed tip + shorter limbs.** Lowered overall height (`trunkH` 2.6+ → 1.8+) and tapered the trunk to a
thin POINT at the top (`topR` ratio 0.45 → 0.16) so it ends like a branch instead of a blunt flat cut; pulled the limb
band down to `hHi` 0.78 so limbs stay below the thin tip (no limb out-thicking the trunk there). `tree` rig-shot
confirms across seeds. tsc clean.

**Follow-up 11 — realistic bark grain + a latent shader-cache bug fix.** The trunk read as ONE flat color. Two causes:
(1) the wood shader's grain/ring layers sample in the HORIZONTAL plane and ignore Y, so a vertical trunk got no variation
— added a gated `bark` option (`woodGrainMaterial.ts`): fibrous striations FINE around the surface (XZ) + SLOW along Y →
vertical fibers, plus thresholded ridge-noise grooves (bark-plate cracks). Applied to the dead-tree trunk (`bark:0.34`) +
limbs (`bark:0.14`) with `localSpace:true` (fibers run along the trunk's own vertical axis + avoids world-space noise
precision loss for trees far from origin). (2) **The bark — and every per-material grain tweak — was being SILENTLY
IGNORED.** Every wood material is a `MeshLambertMaterial` with identical standard params; only the onBeforeCompile-
injected SOURCE differs. Three.js keys its compiled-program cache on material PROPERTIES, not injected source, so ALL
wood materials reused whichever program compiled FIRST — the trunk was literally rendering another material's shader (a
debug fill confirmed: it didn't show until fixed). Added `mat.customProgramCacheKey` encoding every baked constant, so
each wood variant compiles its own program. This also (correctly) un-shares grain across all wood props. Iterated
close-up + at distance via the `tree` rig-shot. tsc clean.

**Follow-up 12 — recursive branching dead tree (camelthorn references).** The single-pole-with-twigs model read
straight + inorganic. Rebuilt `makeDeadTree` as a RECURSIVE branch generator modelled on Deadvlei camelthorn photos: a
trunk bole FORKS into 2-3 limbs, each forking again 5 levels deep into a spreading crown of fine, gnarled,
upward-reaching branches, plus buttress roots flaring at the base. Each segment is a tapered cylinder with a parabolic
bow baked in (the gnarl); children attach at the parent's curved tip with matching radii (seamless forks, connected by
construction — no floaters). All segments of a tree MERGE into ONE geometry (`mergeGeometries`) → 1 draw call/tree (×45).
One shared `_treeMat` (BRANCH_WOOD_COLOR + bark). Iterated 4× via the `tree` rig-shot: (1) base recursion, (2) widen
framing + crown spread, (3) +1 depth level + stronger bow for finer/gnarlier tips, (4) close-up joint/bark verification.
tsc clean.

## Session ACAE — 2026-06-04 — Dev item-spawner panel ✓ verify pass (tsc clean)

`verified` — `npm run verify` (tsc) PASS; no save change. Dev tooling — a DOM panel (DEV MODE only) to add any item to
the inventory. 4 files: NEW `ui/devPanel.ts`, `main.ts`, `style.css`, `inventory/items.ts`.

**Panel** (`ui/devPanel.ts`) — click the `[ DEV MODE ]` badge to toggle a centered panel listing **every registered
item** (glyph + name + id), with a live **filter** box; clicking a row `addItem`s it to inventory + toasts. Mirrors the
inventory-overlay lifecycle (unlock the pointer on open so the cursor is free, `resumeFromPause()` on close) + Escape to
close. DOM built via createElement + textContent (rule 6). Gated to `ctx.flags.devMode` by the badge handler; the badge
got `pointer-events: auto` + a hover (it was `pointer-events: none`). Verified via NEW `dev-panel` rig-shot scenario
(panel renders, clicking a row grows the inventory total).

**Robustness fix** — the panel derives its list from a NEW `ALL_REGISTERED_ITEM_IDS` (= `Object.keys(_DEFS)`) instead of
the hand-maintained `ALL_ITEM_IDS`, which had silently gone stale — it was **missing 4 real items** (scrap_bar (!),
grill_kit, raw/cooked_shrew_meat). Added those to `ALL_ITEM_IDS` too (it's now the only other place that list is
referenced, and it should be complete). The registry-derived list can't go stale as items are added.

## Session ACAD — 2026-06-04 — Rust/weathering pass: scrappy pulse rifle + corroded metal across all gear ✓ verify pass (tsc clean)

`verified` — `npm run verify` (tsc) PASS; no save change. User direction: "everything in the desert has been weathered
by time — all models should reflect that." The metal shader had scratches/dirt but no actual RUST. 6 files: `world/
metalMaterial.ts`, `inventory/items.ts`, `world/{sled,stake,lantern,speeder}.ts`. D173.

**Rust shader layer** (`metalMaterial.ts`) — NEW `rustLevel` (0..1) option on `createMetalMaterial`: FBM oxidation
patches + downward drip streaks tinted rust-orange (two-tone core→halo), mixed INTO the metal color (oxidation eats it).
Default 0 (safe — existing world-prop callers unchanged unless opted in).

**All held gear weathered at once** — the item `vmMetal` wrapper now defaults `rustLevel: 0.34`, so every held metal
item reads aged in one change (verified across scrap_gun, machete (blade stays bright, grip weathers), canteen, amban
(steel rusts, wood stays wood), energy_pistol). Per-item override still works.

**Pulse rifle → salvaged/scrappy rebuild** — rusted-iron base colors + heavy `rustLevel` (0.5–0.72) + scavenger
geometry: a mismatched riveted scrap patch, a grimy cable coil around the emitter shroud, exposed wiring from the cell,
a hose-clamp band, taped grip. The glowing cyan cell is the lone pristine tech amid the junk. Reads as scavenged
desert-tech now (was too clean/sci-fi).

**World props** — added rust to the iron/scrap metal materials: sled scrap-sheet underside (0.45), iron stake (0.55–0.6
— driven into sand, corrodes heavily), lantern body (0.42), speeder antenna (0.4). (Wrecks already use the heavy
`createRustedHullMaterial`; the sled top + speeder body use painted-metal `wearLevel` — already weathered. Remaining
gap: painted-metal surfaces don't have a rust layer — a follow-up if wanted.) D173.

## Session ACAC — 2026-06-04 — Pulse rifle: rapid-fire energy carbine (Cycle 5 weapon half) ✓ verify pass (tsc clean)

`verified` — `npm run verify` (tsc) PASS; no save change (reuses additive `ammoRemaining`). Focused feature — the weapon
half of Cycle 5. NEW `pulse_rifle`: a salvaged rapid-fire energy carbine, distinct from the other 3 guns (scrap_gun =
crude single-shot, amban = slow marksman, energy_pistol = charge-release). 6 files: `inventory/types.ts`,
`inventory/items.ts`, `player/combat.ts`, `config/tuning.ts`, `world/salvage.ts`, `scripts/rig-shot.mjs` (+NEW
`pulse-test` scenario). D172.

**Mechanic** — auto-fire energy weapon with a **self-recharging cell** (no ammo item). `combat.ts` WeaponSpec gains an
`auto` flag: auto weapons fire while LMB is HELD (gated by `cooldown`) instead of one shot per click, and empty
silently (no toast spam). The pulse_rifle drains 1 cell-pulse per shot (`WEAPON_PULSE_RIFLE_CELL_MAX` = 28, fast 0.13s
cadence, low 1.3 dmg — DPS from cadence) and the cell **recharges** (7/s, after a 0.6s idle delay) via the item's
`updateHeld` — so sustained fire empties it and forces a brief cool-down. Verified via the `pulse-test` scenario:
the cell drains while LMB held (28→24) + returns to full after release.

**Model** (hero-quality, iterated vs item-studio + fp-item): a chunky alloy carbine — receiver + top rail/sight + side
heat vents, a glowing segmented **energy cell** up top (the signature element, with clamps), an emitter barrel with
glowing coil rings + muzzle, a skeleton stock (twin rails + cheek + recoil pad), and a grooved grip + trigger loop. The
cell + coils GLOW cyan-green by charge level + flash on each pulse (`updateHeld` drives a shared MeshBasic, like the
energy_pistol). New `WEAPON_PULSE_RIFLE_*` + `VIEWMODEL_PULSE_RIFLE_ANIM_S` tuning.

**Acquisition** — added to the `massive` wreck loot table at 0.015 (the rarest hero find; its cell self-recharges so
it's immediately usable, no ammo needed).

**Verification footgun (D172)**: the headless rig-shot harness runs the game clock in SLOW-MOTION (low fps + dt clamped
to 0.1), so a cadence/recharge test must wait in GAME-time, not wall-clock (game-time passed ~5× slower here) — the first
test read "1 shot, no recharge" until the waits were lengthened.

## Session ACAB — 2026-06-04 — Cycle 6 atmosphere: procedural clouds + clear↔overcast days + storm sky telegraph ✓ verify pass (tsc clean)

`verified` — `npm run verify` (tsc) PASS; no save change (cloudiness is transient — re-derives on load). Overnight,
lane = Cycle 6 (atmosphere). The sweeping storm wall + in-storm penalty + star drift were already shipped (ACL/ACW/ACO),
so the new work is the **clouds** (didn't exist) + the weather/lighting coupling that makes days vary. 6 files: `sky.ts`,
`weather.ts`, `core/lighting.ts`, `tuning.ts`, `debug/debugPanel.ts`, `scripts/rig-shot.mjs` (+NEW `sky` scenario). D171.

**Tier 1 — procedural cloud layer** (`sky.ts` SKY_FRAGMENT). FBM value-noise clouds (zero-asset) projected onto a virtual
horizontal plane (`d.xz/d.y`, so they recede + compress toward the horizon), with a domain warp to break the radial
streaks into organic billows, drifted by `uTime`, thresholded by `uCloudiness` (0 clear → 1 overcast). Lit tops + shaded
undersides + a sun-tinted edge. New `CLOUD_*` tuning + uniforms wired in createSky/updateSky. Iterated ~5 rounds
(scale, warp, soften, day/night color, dusk warmth).

**Tier 2 — clear↔overcast weather state** (`weather.ts`). NEW `cloudiness` (0..1) on the Weather model, eased each frame
toward a slow deterministic wander (two desynced sines, gamma-biased so clear days are more common) — daytime skies now
vary INDEPENDENT of the storm cycle. `cloudinessHold` is a dev/test pin (`__game.setCloudiness`). Transient (not
persisted), additive, no save bump.

**Tier 3 — cloud lighting + celestial coupling.** Overcast flattens the world light (`lighting.ts`: sun dimmed
`CLOUD_SUN_DIM`, daytime ambient lifted + cooled toward neutral grey `CLOUD_AMBIENT_LIFT` — distinct from the orange
storm dim). Clouds veil the sun disc, moon, and stars (`sky.ts` opacity factors) — a clear night shows the full
starfield, an overcast night hides it.

**Tier 4 — storm sky telegraph.** Storms force the sky overcast the moment they start BUILDING (before the dust wall
arrives), and the clouds darken to an ominous dusty hue (`_stormCloudCol`) as the storm deepens — verified
`state=building, intensity=0, cloudiness=0.9` (gathering dark clouds, no dust yet) = the GDD "see it coming, prep" beat,
now carried by the sky. (Pivoted here from the planned static storm-wall refinement — the wall is already built + its
in-motion feel is foreground-owed, D150; the telegraph is the higher-value, headless-verifiable storm-atmosphere win.)

**Verification**: NEW `sky` rig-shot scenario sweeps cloud cover × time-of-day (clear/partly/overcast × noon/dusk/night
+ ground-level lighting + the storm-build telegraph). D171.

## Session ACAA — 2026-06-03 — FP-viewmodel fixes from playtest: see-through rings, branch cleanup, real torch fire ✓ verify pass (tsc clean)

`verified` — `npm run verify` (tsc) PASS; no save change. Three user-reported issues from testing the ACY/ACZ item
models. 6 files: `core/loop.ts`, `player/viewModel.ts`, `inventory/items.ts`, `pickups/pickups.ts`, NEW
`world/branchMesh.ts`, `scripts/rig-shot.mjs` (+NEW `fp-item` scenario).

**See-through rings → two-pass FP viewmodel render (D170).** The FP viewmodel materials had `depthTest`/`depthWrite`
OFF (so world walls can't clip the held item), which also disabled depth-sorting WITHIN the item — the far side of
closed shapes (grip-rings/toruses/coils on the new detailed models) drew over the near side, reading as "see-through."
Fix: the viewmodel now lives in its OWN `THREE.Scene` (with its own ambient+key+fill lights) rendered in a SECOND pass
over a CLEARED depth buffer (`core/loop.ts`): world → `clearDepth()` → viewmodel. depthTest is back ON, so the item
self-sorts correctly; the depth clear is what keeps walls from clipping it. Also fixed `configureViewModelMaterial`
force-setting `transparent=false` on every viewmodel material — it had silently broken the torch flame's alpha fade;
now it preserves authored transparency (+ `depthWrite=false` for transparent). Verified with the new `fp-item` rig-shot
scenario (renders the REAL first-person viewmodel — the `item-studio` can't reproduce the bug since its meshes already
depth-sort). Trade-off: the held item no longer dims at night (fixed vm-scene lights) — a readability win.

**Branch cleanup + world unification.** Dropped the ACZ branch's splinter "bristles" + knot bumps (read as weird
clutter). Extracted a shared `buildBranchMesh(material)` (NEW `world/branchMesh.ts`) used by BOTH the held item
(`vmWood`) and the world pickups under dead trees (`makePrimitiveBranch`, plain Lambert grey — ~200 instances, so the
shader stays off there) — so a branch on the ground now matches the one you hold. Clean tapered shaft + a couple of
natural twig stubs.

**Real torch fire.** Replaced the static single emissive cone ("yellow triangle") with a layered additive flame (deep
orange → hot white-yellow core, 4 nested cones) + 7 rising/fading ember sparks, all flickering (vertical stretch +
lateral lick + per-cone opacity shimmer + ember rise-and-recycle) in `updateHeld`. Lives in a group named `torchFlame`
shown ONLY when `slot.meta.lit` (hidden otherwise). The transparent-material fix above is what lets it blend/glow.

**Follow-up fix (held lights cast on the world).** Moving the viewmodel into its own scene (D170) also moved the torch
PointLight + flashlight SpotLight there — so they stopped illuminating the WORLD (only the in-vm-scene item). Fixed:
two reusable held-lights (point + spot) now live in the WORLD scene (`createViewModel`), zeroed each frame by
`updateViewModel`, and re-armed + positioned by the torch/flashlight `updateHeld` (point at the flame world-pos; spot
at the lens, aimed along camera-forward). Verified at night — the torch lights the terrain around it + the flashlight
casts its beam. No new D-entries beyond D170 (folded into it).

## Session ACZ — 2026-06-03 — Item-model detail pass, part 2: the remaining ~22 models (every item now detailed) ✓ verify pass (tsc clean)

`verified` — `npm run verify` (tsc) PASS; no save change; 1 file (`items.ts`). Finishes the ACY item-model thread —
**every item in the game now has a deep-detailed or verified-at-parity mesh.** All iterated against the ACY `item-studio`
view (`npm run rig-shot --scenario=item-studio --items=… --angles=…`).

**Deep-polished primitives (7)**: **tent_kit** (plain cylinder → rolled canvas bundle: fabric roll + rolled-end spiral +
cord straps + draping flap + bundled poles + iron stakes), **sled_kit** (plank stack → folded warped scrap-metal sheet +
rivets + lashing strap + skid runners + tow-yoke stub), **grill_kit** (flat bar-stack → framed cooking grate + grate bars
+ 4 folding legs + attach chain), **companion_pod** (faceted egg → smoother carved-stone egg + glowing crack-vein network
+ speckle nubs + chipped base), **cactus_pulp** (green box → cut cactus chunk: pale flesh + waxy skin cap + fiber ribs +
spines), **alien_fruit** (flat ellipsoid → organic bioluminescent fruit: glowing MeshBasic pods + mottle spots + stem &
sepal calyx), **raw_worm_meat** (single slab → lumpy flesh slab + raw membrane + fiber striations + wet ooze patches).

**Light touch (1)**: **branch** (rounder 8-sided shaft + splintered broken end + knot bumps + a 3rd twig stub).

**Verified at parity (no change)**: scrap, cloth, stake_kit, fire_kit, locker_kit, lantern_kit, bedroll_kit,
large_tent_kit, all cooked foods, lizard/shrew raw+cooked + lizard-on-a-stick (these use the actual creature mesh or were
upgraded in ABO/ACL — confirmed still reading well in the studio).

**Process (honest)**: a breadth pass — primitives got 1-2 studio rounds each, not the full 5-8 (12 hero items already
took ACY); they read clearly as their objects. No new D-entries (reused the ACY itemStudio harness + D169 pattern).
**Owed (unchanged):** the ACW/ACX in-motion feel pile (D150, foreground-only).

## Session ACY — 2026-06-03 — Item-model detail pass (12 held items) + dynamic salvage-panel placement + POI greebles ✓ verify pass (tsc clean)

`verified` — `npm run verify` (tsc) PASS throughout; no save-schema change. Long overnight. Item meshes are
headless-verifiable (unlike the owed ACW/ACX feel work), so this session leaned into the visual centerpiece. 6 files:
`items.ts`, `debug/debugPanel.ts`, `scripts/rig-shot.mjs`, `world/procgenWreck.ts`, `world/salvage.ts`, `config/tuning.ts`.

**Lane 1 — deep-polished all 12 high-visibility held item models** (each iterated build→shot→critique vs a new
isolated studio view, not tsc-only): **machete** (flat box → extruded parang blade w/ bevel edge, spine, fuller, guard
+ quillon + bolster, leather-wrapped grip w/ bands/pommel/rivets), **pipe_staff** (plain cylinder → jointed plumbing:
union coupling, threads, bolted flange head, hose-clamp, taped grip), **scrap_bar** (square bar → double-ended crowbar:
faceted shaft, curved nail-puller claw + slot, chisel pry-blade), **scrap_gun** (welded receiver + seam + ejection port,
breech, wire-wrapped barrel + muzzle, hammer, wrapped canted grip, trigger loop), **energy_pistol** (sleek alloy: vent
fins, glowing barrel coils + emitter lens + energy cells via the preserved `updateHeld` charge-pulse, grooved grip),
**amban_rifle** (added a **scope** w/ glass lenses + ring mounts, box magazine, trigger loop, recoil pad, bolt ball —
now unmistakably a marksman rifle), **scrap_bullet** (cylinder+cone → bottlenecked cartridge: rim/primer/shoulder/neck/
copper ogive), **torch** (branch + knot/nub, layered rag wrap + charred head + binding cords), **flashlight** (rebuilt as
a forward-pointing tube: knurled body, bezel head + reflector, lens, tail button), **rope** (wound coil hank + lashing +
fraying tail), **canteen** (tin flask + felt cover + band + knurled cap + chain), **bandage** (rolled gauze + wrap rings +
draping frayed end + tie + cross). Ground pickups reuse `makeViewModel` (×1.5) so dropped items inherit the upgrades.

**Tooling** — NEW `__game.itemStudio(id, angle)` debug hook (builds an item's `makeViewModel` mesh in ISOLATION,
suspended high vs the sky, lit for form, rig hidden) + a NEW `item-studio` rig-shot scenario (`--items=a,b,c --angles=…`,
multi-item one boot). The held-item scenario buried small items behind the rig torso; the studio is the legible iteration
view (D169).

**Lane 2 — dynamic salvage-panel placement + variety.** NEW `findPanelMount` raycast surface-sampler in
`procgenWreck.ts` replaces the single hardcoded per-part `panelAnchor` (kept as a fallback): a jittered grid of
outside-in rays on both ±Z flanks, a 4-ray flatness probe ring, decoration-tag + same-part overlap rejection, and a
cardinal `faceYaw` quantized from the hit normal (no `addAccessPanel` signature change). Decorations tagged
`isWreckDecoration` (breach patches + welded plates) so panels never weld on top of them. Panel **size variants**
(small/standard/large via the existing `scale` arg). NEW tuning: `SALVAGE_PANEL_SAMPLE_*` + `SALVAGE_PANEL_SCALE_*`.
D168.

**Lane 2 verify** — hardened the `panels` rig-shot scenario: shoot all kinds + a NEW `__game.panelBuryAudit` numeric
bury/occlusion assertion (raycast inward along each panel's outward axis; PASS iff the panel surface is reached before
any hull). **75/77, 75/78, 66/68 pass across 3 random seeds** — every procgen-composite panel the sampler places passes;
the only fails are pre-existing hand-modeled curved `engine_bell`/`escape_pod` panels the sampler doesn't touch.

**Lane 3 — POI detail + small win.** NEW `addHullGreebles` (panel-line seams / rivet strips / vent boxes, ≥10cm deep
per rule 7, tagged so the sampler avoids them) on ribbed-cylinder + plated-rectangular hull variants. **amban_rifle**
added to the `massive` wreck loot table (chance 0.02 — rarest hero find; was dev-loadout-only orphan).

**Out of scope (carried):** 3P per-item use-animations (deferred per user — a rigged-model import may obsolete them);
the owed ACW/ACX foreground feel-tune playtest (foreground-only, D150); remaining ~22 item models (kits/foods/
materials); the hand-modeled curved-bell/pod panel cases. D168-D169.

## Session ACX — 2026-06-03 — 3P fix pass: held-item hand/orientation, speeder cam, footstep depth, seated rig pose (numeric-IK) ✓ verify pass (tsc clean)

`verified` — `npm run verify` (tsc) PASS. A foreground-feedback fix pass on the ACW 3P work + a from-scratch
re-solve of the seated speeder rig pose. Commits `e4d223f` (gun/rifle 3P grips), `af039cf` (wrong-hand + item-forward
+ speeder 3P cam), `04e99d9` (footstep depth), `5146078`/`45ea390`/`6e5b7bb` (early seated-pose attempts — superseded);
final seated-pose + harness changes uncommitted at entry time (committed under this session's tag). No save-schema change.

**3P held items** (`af039cf`): items were equipped to the LEFT hand + faced backward — moved `rightHandAttach` to
the real right hand (`side===-1`, shoulders/elbows/wrists index 0), baked a `makeBasis` corrective onto the attach so
attach-local −Z = world-forward; visible hand meshes wrapped in a `handVisual` sub-group rolled inward (palms toward
the body) WITHOUT disturbing the item grip. Per-item `handAttachTransform` for machete/scrap_bar/pipe_staff/guns/rifle.

**Speeder 3P camera** (`af039cf`): added a real chase cam (behind the rider along the look dir, looking forward) +
`SPEEDER_3P_CAM_BACK/ANCHOR_UP/ABOVE` — pre-fix the mounted cam sat at the 1P rider seat (ahead/wrong-facing in 3P).

**Footsteps-through-items** (`04e99d9`): the footprint decal's `polygonOffsetFactor:-1` scaled with the polygon's
huge depth slope at grazing angles, pulling the decal depth toward the camera enough to render OVER the hip-held item.
Fix: drop polygonOffset; the 4cm `FOOTPRINT_OFFSET_Y` lift alone prevents terrain z-fight.

**Seated speeder rig pose** (this turn): re-solved from scratch. The prior harness LIED — its `speeder-seated` scenario
OVERRODE the camera with a hand-placed behind-cam, so it never rendered the real chase-cam view, and it assumed +Z=face;
it reported "facing forward / pose fine" for multiple rounds while the live view was visibly wrong. New `bike-truth`
harness scenario renders the REAL game chase-cam + 5 fixed world angles (bike yaw pinned to 0) + an in-page **pose SWEEP**
that minimizes wrist→grip and ankle→peg WORLD distances (the trustworthy numeric gate vs eyeballing low-res frames).
Findings: facing was already correct (the "backwards" read was a stiff upright figure, not a heading bug); the real bug
was that the ~0.65m arm can't reach the grips (~0.80m away) without a forward torso lean. Solved pose: forward lean 0.60
(pivoted at the WAIST — `spineBend` is parented at the rig origin y=0, so a bare rotation slid the whole torso ~0.4m off
the pelvis = the "torso disconnected from body" gap; compensating `spineBend.position` pivots it at the waist), arms hang
vertical onto the bars (hands land ~4–5cm off the grips), legs splayed astride. Moved the rig back on the seat
(`SPEEDER_RIG_SEAT_Z` 0.28→0.36 — capped there; further back puts the bars out of arm's reach). Feet land ~22cm from the
pegs (splayed astride; the 3-DOF leg can't hit the pads dead-on). `spineBend.position` reset on the non-seated path.

**Foreground-owed:** live in-motion riding feel; exact feet-on-pegs contact (22cm residual reads astride, not pad-perfect).

## Session ACW — 2026-06-02 — Overnight: full art/animation + storm-feel pass (the deferred ACV pile, executed) ✓ verify pass (tsc clean)

`verified` — `npm run verify` (tsc) PASS. Executed the WHOLE deferred ACV visual/feel pile (recalibration:
stop pre-emptively scope-cutting; plan deeply then execute fully with real rule-8 screenshot iteration).
Six per-phase commits (`2b7830a` A → `8b9bdc7` F). No save-schema change (additive ItemDef fields + visual/feel).
Reusable static-pose screenshot scenarios added to `rig-shot.mjs` (lizard-gait/shrew-gait/shrew-burrow/
companion/speeder-fx/held-item/prompt-3p) — the live FP/3P camera fights the body sync, so paused
free-camera shots are the reliable verification path.

**Phase A — infra hooks** (`2b7830a`): `ItemDef.handAttachTransform {pos,rot}` (per-item 3P hand placement,
applied in `viewModel.swapEquippedMesh`) + `ItemDef.playUseAnim3P(rig,t)` (drives the rig's right arm during
a use-anim in 3P, since the FP viewmodel item is hidden) + reusable `enemies/creatureGait.ts` (sin-phase gait
helper) + `world/particleTrail.ts` (pooled soft-fading ShaderMaterial particle system).

**Phase B — creatures** (`f8b08c1`): lizard sprawl-gait (4 legs step in diagonal pairs while fleeing — was a
static slide); shrew walk gait; shrew **burrow-on-approach** (new FSM state — dives nose-down into the sand,
vanishes below the terrain plane, bursts a pooled sand puff, re-emerges when the player leaves); companion
mid-leg knuckles (jointed-leg polish — it was already a full proc-character). New SHREW_BURROW_*/SHREW_GAIT_* tuning.

**Phase C — speeder FX** (`a042351`): speed-gated dust trail (pooled sandy particles behind/under the bike,
≈2× on boost) + engine-ignition glow (nozzle emissive lerps base→hot-orange + a warm PointLight at the
primary nozzle, ramping with speed, dying when parked). Verified: hot nozzles + dust plume. Fixed the
particleTrail `size`-is-world-diameter convention (earlier values rendered screen-filling).

**Phase D — items + 3P hands + use-anims** (`701779b`): fixed `raw_shrew_meat` + `cooked_shrew_meat` which had
NO makeViewModel (rendered nothing — a real bug); 3P grip transforms for machete/scrap_bar/pipe_staff (were
gripped at their middle — handle now seats in the fist); machete `playUseAnim3P` diagonal overhead chop.
(Canteen seats fine as-is; Z-oriented guns/rifle were ACM-verified — exhaustive per-item grip/use-anim pass owed.)

**Phase E — storm feel** (`e439e7e`): #146 storm wind pushes loose bodies (`stormWindAccel` helper → impulse on
dynamic dropped pickups, velocity nudge on the parked speeder, slide-velocity nudge on the sled); #134 in-storm
sensory — camera pitch/roll sway (controller, scaled by perceivedIntensity, undo-then-apply) + master audio
low-pass that muffles the mix as the storm engulfs the player. New STORM_WIND/CAM/AUDIO tuning. All foreground-feel.

**Phase F — 3P interact-prompt** (`8b9bdc7`, #149): the prompt now projects the hovered object's world hit point
to screen and pins there in 3P (was crosshair-centered → read detached); FP unchanged. `getHoverWorldPos` getter
on interaction.ts records the raycast hit point.

**Foreground-owed (D150 — feel/kinematic, built fully but verify live):** shrew burrow dive/puff timing + in-motion
creature gaits; speeder dust/engine in motion; storm wind push + camera sway + audio muffle feel; machete 3P
chop read; per-item 3P grip fit + the guns/rifle/consumables grip+use-anim pass; 3P interact-prompt on-object placement.

## Session ACV — 2026-06-02 — Overnight (partial): backlog clear + bug fixes + companion egg-cave ✓ verify pass (tsc clean)

`verified` — `npm run verify` (tsc) PASS. A planned long overnight (bugs + easy features + one bigger
feature). Budget-managed: shipped the bug/quick-win waves + the bigger feature (companion egg-cave),
and pre-committed the visual/feel-tuning pile as scope-cuts deferred to ACW (per the approved plan).
Three commits: `c9c71a6` (Wave 0-1), `2d4035b` (Wave 2 egg-cave).

**Wave 0 — backlog reconciliation:** the three remaining "open bugs" were all already FIXED — speeder
mount-without-seat (ACQ `SPEEDER_MOUNT_LOOK_DOT`), iron-stake model (ACQ+ACU), speeder angular-tilt
(X/Z rotation-locked, non-issue). Closed in backlog.

**Wave 1 — quick wins** (`c9c71a6`):
- **#148 seated 3P rig on the speeder**: while mounted, the player capsule is parked at y=-2000, so
  the rig dropped to the origin/underground ("3P rig broken on speeder"). Now seated at the rider
  seat (bike body + yaw-rotated offset), facing bike-forward, with a seated pose. `SPEEDER_RIG_SEAT_Y/Z`
  foreground-tunable; dedicated speeder 3P camera still deferred.
- **#187 sled drag marks lightened** (`FOOTPRINT_SLED_COLOR_HEX` 0x3d2918 → 0x6e5236).
- **#41 aim-twist turn-gain** 0.10 → 0.18.

**Wave 2 — BIGGER FEATURE: companion egg-cave acquisition** (`2d4035b`, iteration-plan Cycle 7 core,
D158): a NEW game no longer spawns the companion at the player's side — Pebble is acquired by finding
the rock-biome cave and hatching an egg at its floor.
- `rockyEntrance.ts` builds a glowing ovoid egg in the existing descent chamber; exported as
  `placedCaveEgg` (placePOIs is void; egg is a singleton prop). New `CaveEgg` type.
- `GameContext`: `egg: CaveEgg|null` + `flags.companionAcquired` (default false = new game).
- `interaction.ts`: new `'eggs'` registry + target-push (only while `!companionAcquired`) + hatch
  dispatch (E → `spawnCompanionAt(egg.pos)` + set acquired + remove egg). New `'hatch'` InteractType.
- `companion.ts`: `despawnCompanion` (remove without granting a pod).
- `save.ts`: additive `companionAcquired?: boolean` — **NO version bump** (D81); pre-feature saves
  default TRUE so existing players keep Pebble. The egg needs no save field — it exists iff
  `!companionAcquired`, re-derived at boot.
- `main.ts`: boot spawns companion + builds egg (so Continue can patch); `handoffToGame` reconciles
  per the flag — acquired → remove egg; not acquired → despawn the boot companion. DEV MODE keeps
  the companion. Save/load traced across new-game / legacy-continue / not-yet-hatched / pod-in-bag.

**Deferred to ACW** (pre-committed scope-cut — visual/feel-tuning, better with real iteration):
speeder dust+engine FX (#183/#184), sandstorm wind pushes bodies (#146), 3P control-prompt
positioning (#149), in-storm sensory degradation (#134), the egg/cave VISUAL polish (the egg is a
placeholder emissive ovoid; chamber lighting), and the art/animation pile (item models, POI detail,
creature gaits + shrew burrow, held-item 3P placement, 3P use-anims).

**Owed a foreground confirm:** seated speeder pose (tune `SPEEDER_RIG_SEAT_Y/Z`), aim-twist feel,
egg-cave boot spawn-then-despawn timing + save round-trip.

## Session ACU — 2026-06-02 — Playtest pass: rig look fixes, speeder/sled/rope features, slide tune ✓ verify pass (tsc clean)

`verified` — `npm run verify` (tsc) PASS. A long interactive playtest session driven by live findings. All
geometric/material/logic — no save-schema change. Most items are FOREGROUND-confirmed by the user in-play.

**Player rig look:**
- **Reverted the PM-E PBR lighting** on the rig's skin + cloth (D154). The `pbr` path's derivative-based
  (`dFdx/dFdy`) micro-bump perturbed the view-space normal from screen-space derivatives → it sparkled/
  shimmered as the model moved ("glitchy when moving"). Dropped `pbr` (+roughness/bump) from the 3 skin
  + 4 cloth mats → Lambert (no derivative term); procedural surface COLOR unaffected. Goggle lens left.
- **Shadow swim/flicker fix** (D155, `lighting.ts`): the shadow camera follows the player every frame but
  the shadow map (+ its projection matrix) was throttled to ~10Hz (ABL perf), so while walking the rig's
  self-shadow drifted + snapped each regen. Now force a regen on any frame the player moved; keep the
  throttle when idle.
- **Rey off-white outfit + full-body cloth + head-shape** (committed `4f3d4e9`, 3 screenshot-iterated rounds):
  tunic/hood/wraps/pack → pale cream (leather belt/goggles kept dark); arms/shoulders/legs/neck were bare
  dark skin → now clothed (linen sleeves, grey-tan leggings, cloth collar); hood crown lobing smoothed
  (`CROWN_AMP` 0.013→0.003) to kill the segmented "melon".

**Bugs + features:**
- **#40 speed-spike clamp** (`controller.ts`): clamp the player KCC horizontal corrected delta to 1.5× the
  fastest legit on-foot frame — bounds the Rapier penetration-recovery lurch (capsule ejected from an
  overlapped static collider) read as a "random dramatic speed increase".
- **#42 sled-vs-POI collision** (`sled.ts`, D156): the sled shapecasts its footprint before each move (slide
  + rope-tow snap) and clamps short of any FIXED, non-heightfield collider (POI/wreck/rock). Terrain +
  dynamic bodies filtered out. Gated by `Tuning.SLED_POI_COLLISION`.
- **#50 rope-leaves-inventory** (D157): the rope is "deployed" (leaves the hotbar) only when BOTH ends are
  anchored (sled + stake/Pebble/speeder/static-pos); while none/player it stays carried so you can walk it
  to a 2nd anchor. Centralized through `applyTether` (remove on entering-deployed, return on leaving). Plus
  tuning: **drop rope with G while towing → sled releases** (player-tethered + no rope in inventory →
  detach); **removed the LMB-on-ground floor-drop** (replaced by tying to a stake). No save bump (tether
  already persists; `attachedSledId` now dead).
- **Footstep-puff FP fix** (`controller.ts`): the puff emit point read the rig ankle world pos whenever a rig
  existed, but the rig bones are 3P-gated (D151) → in FP the ankle was stale (frozen at the camera-switch
  spot). Now use the rig ankle only in 3P; FP falls back to body-center.

**Sled tow handle:** smaller + lower + rusted-metal (was a tall yoke w/ a rope-coloured bar); the rope now
attaches to the cross-bar via shared `SLED_YOKE_*` constants and **wraps over it** (2 wrap control points).

**Tuned:** `SLED_SLOPE_SLIDE_GAIN` 6.0→2.5 + `SLED_KINETIC_FRICTION` 0.15→0.20 — slight slopes (<~4.6°) now
decelerate to a stop instead of sliding fast; moderate dunes still slide (slower terminals).

**Still open:** the ACT art/animation idea wave (item models, 3P hand placement + use anims, creature gait +
shrew burrow, speeder dust/engine FX, seated 3P speeder cam, dynamic salvage-panel placement).

## Session ACT — 2026-06-01 — 3P/FP parity fixes + world-space texture-swim sweep (D109) ✓ verify pass (tsc clean)

`verified` — `npm run verify` (tsc) PASS. Folded in live-playtest findings: two 3P/FP parity bugs +
a procedural-material "texture swims on moving models" sweep. All geometric/material — no save change.

**Fixed — footprints + footstep audio dead in first person** (`playerRig.ts`): `updatePlayerRig`
early-returned on the visibility gate (`if (!rig.group.visible) return`) BEFORE advancing
`rig.speedMag` / state / `rig.stepCount`. But `controller.ts` drives footstep audio AND footprint
decals off `rig.stepCount`, so in FP both silently died (only worked in 3P). Hoisted the gait
bookkeeping (speedMag, state classification, gait-phase, stepCount) ABOVE the gate; only the visual
transform work (position/heading/bone posing/IK) stays 3P-gated. The `delta < 5` burst-clamp +
controller `_lastSeenStepCount` resync still prevent catch-up spikes on FP↔3P toggle.

**Fixed — interact hints never appeared in third person** (`interaction.ts`): the interaction raycast
cast from `cam.position` with `far = 2.5`, but in 3P the camera sits ~1.8m behind the player
(`_3P_BACK_DIST`), leaving ~0.7m effective reach — you'd have to clip into a target. Now the ray
originates from the player's eye along camera-forward (the reticle) so reach is identical in both
modes (no-op in FP, where `cam.position` already IS the eye).

**Shipped — world-space texture-swim sweep (D109).** Procedural materials sample noise in world space
by default (free per-instance weathering on static objects), which makes the pattern crawl across a
MOVING surface. Audited every factory + every moving entity:
- Added a `localSpace` option to `woodGrainMaterial` / `boneMaterial` / `glassMaterial` (were
  always-world-space; glass also flips its dust-normal to object space).
- Decoupled `fabricMaterial` `localSpace` from `disableShimmer` (legacy coupling did both jobs at once;
  now a moving fabric can keep wind shimmer AND not swim).
- `items.ts`: routed ALL viewmodel item materials through `vmMetal/vmWood/vmBone/vmGlass` wrappers that
  force `localSpace: true` — every held item is a camera/hand-tracked viewmodel, so it always moves.
- Fixed `speeder.ts` antenna (the reported case) + `playerRig.ts` metal/paint (pauldron, pouches,
  goggle rim). Already-safe (verified): sled mats, all creature skin (lizard/shrew/worm/companion),
  rig skin + rig fabric (via disableShimmer). Raiders use plain flat materials (N/A). Static
  hull/concrete/stone/terrain intentionally left world-space.

**Backlog:** triaged the ACT idea dump (7 [feat] / 4 [polish] / 1 [idea]) — item-model quality pass,
3P hand placement + use anims, lizard/shrew gait + shrew burrow, speeder dust/engine FX, seated 3P
speeder cam, cloth-physics robe, lighter sled marks, POI detail + dynamic salvage-panel placement.

**Still open:** random speed spike (#40, foreground), sled-vs-POI collision (#42),
rope-leaves-inventory (#50). Footprints/hints fixes owed a foreground confirm (D150-class for the
gait one).

## Session ACS — 2026-06-01 — Carcass tow/harvest flow fix (ACF bug) ✓ verify pass (tsc clean)

`verified` — `npm run verify` (tsc) PASS. A focused fix for the ACF "carcass tow blocked after
harvest" bug (worked in parallel while the user playtested the foreground/feel items).

**Fixed — sandworm carcass tow/harvest flow** (`sandWorm.ts` + `interaction.ts`): the investigation
found the real gap — harvest was BLOCKED while towing (the `towed` interaction branch returned before
the loot branch), so a towed carcass couldn't be carved, and a carved (looted) carcass went fully
inert (`lootSandWorm` untagged it + the raycast filtered out `looted` worms → no tie/cut-loose). Now:
- the towed branch lets you **carve meat with `E` while towing** (LMB still cuts the rope loose) via a
  shared `harvestWorm` helper (de-dups the on-foot loot path);
- `lootSandWorm` KEEPS the interact tag while the carcass is towed (only untags an untowed carcass);
- the interaction raycast still targets a dead worm that's looted-BUT-towed.
Net: tow → carve → cut-loose work in any order; a carved-while-towed carcass stays cut-loose-able.
Logic-traced + tsc-clean; owed a foreground confirm (in the user's current playtest).

**Still open:** footprint/speed/aim-twist + shrew take/cook loop (foreground — the user is on it);
sled-vs-POI collision + rope-leaves-inventory (feature-sized).

## Session ACR — 2026-06-01 — Backlog archive (round 2) + desert shrew CATCH/COOK feature ✓ verify pass (tsc clean)

`verified` — `npm run verify` (tsc) PASS; harness confirmed the shrew KILL (deadState + 'take' tag).
Continued clearing the backlog: more archive hygiene + the headline remaining feature.

**Backlog archive (round 2):** confirmed the "megaWreck catwalk panel reachability" item was ALREADY
done (ACL added the 2 ground panels #9/#10 — archived the stale entry). Earlier in the session also
pruned 10 ACL-shipped duplicates + the procedural-character-arc followup pile + the obsolete
FP-forearm-wraps entry (carried from the ACQ-tail cleanup). The active backlog now reflects only
genuinely-open work.

**Shipped — desert shrew CATCH/COOK** (the headline remaining backlog feature; a 1:1 mirror of the
lizard kill→loot pipeline):
- `shrew.ts`: `'dead'` ShrewState + `looted` field + `damageShrew()` (kill → flop + retag) +
  `applyDeadShrewPose()` + `lootShrew()` (remove body + yield slot) + dead-skip in `updateShrews`.
- `combat.ts`: `dispatchHit` branch — `getShrewForCollider → damageShrew` (the ACL shrew already had
  the collider-lookup map, so the combat half was scaffolded).
- `interaction.ts`: `'shrews'` registry + dead-shrew raycast target + the `'take'` case → adds
  `raw_shrew_meat` + `lootShrew`; `COOK_MAP` `raw_shrew_meat → cooked_shrew_meat`.
- `items.ts` + `types.ts`: new `raw_shrew_meat` / `cooked_shrew_meat` items (mirror the lizard meat).
- `save.ts`: persist + restore shrew `dead`/`looted` state (widened state type; absent-→-loot +
  dead-→-applyDeadShrewPose on load — mirror the lizard restore). Additive, no version bump.
- **Verification**: tsc clean; the `--scenario=shrew-kill` harness confirmed the kill path
  (deadState='dead' + 'take' tag applied). The full take+cook loop is **owed a foreground confirm** —
  the combat/interaction raycast-aim on a small fleeing AI critter isn't reliably scriptable headlessly
  (the take CASE is a verbatim lizard-copy, so real play should be fine). "Burrows into sand" flavor
  NOT added (the shrew flees) — separate polish.

**Harness (`scripts/rig-shot.mjs`):** added `--scenario=shrew-kill`.

**Still open:** footprint/speed/aim-twist (foreground-only, D150); sled-vs-POI collision + carcass-tow
cut-loose + rope-leaves-inventory (feature-sized).

## Session ACQ — 2026-06-01 — Backlog archive sweep + quick wins (Pebble rename, stake model, mount-look gate) ✓ verify pass (tsc clean)

`verified` — `npm run verify` (tsc) PASS; stake fix screenshot-verified via a new `stake` harness scenario.

**Backlog archive (cleanup):** removed 10 ACL-shipped duplicates never pruned (sweeping storm, in-storm
penalty, stars drift+twinkle, aim-twist-IK, footstep-dust, 3P-snap, amban rifle, worm-audio, shrew →
all superseded by the line-38 shipped record), collapsed the procedural-character-arc followup pile
(ABT/ABU/ABV/ABW/ABX/ABY + ABS-deferred + ABP-Tier-5) into a tombstone (arc complete, model at ceiling
per ACK), and tombstoned the obsolete FP-forearm-wraps entry (viewModelHands.ts deleted in ACJ/ACK).
Kept genuinely-open items (sled tuning, sandworm encounter, biome/POI, real rope, etc.).

**Quick wins shipped:**
- **Companion → "Pebble" rename** (`companion.ts`/`interaction.ts`/`items.ts`/`tutorial.ts`): all
  player-facing copy now says "Pebble" (was "Rocky" in one toast + "the creature"/"(your companion)"
  elsewhere). Internal identifiers (`companion_pod`, `ctx.companion`) unchanged.
- **Iron stake model fixes** (`stake.ts` + `rope.ts` + `tuning.ts`): removed the sand-mound disc;
  reseated the rope-loop ring near the top, touching the shaft (was a 4cm-floating side hoop mid-
  shaft); aligned `rope.ts` resolveEndpointWorldPos to the ACTUAL ring world pos (offset + stake yaw,
  shared via `STAKE_LOOP_OFFSET_X/Y`) so the rope connects to the ring. Screenshot-verified.
- **Speeder mount gated on looking at the bike** (`speeder.ts` + `tuning.ts`): E near the speeder no
  longer mounts on proximity alone — `dot(camForwardXZ, dirToBikeXZ) ≥ SPEEDER_MOUNT_LOOK_DOT` (0.5)
  required, so E while facing away doesn't fire an unexpected mount.

**Harness (`scripts/rig-shot.mjs`):** added `--scenario=stake` (equip + place a stake, frame it).

**Deferred:** carcass-tow cut-loose-after-harvest (ACF bug — interaction logic in the drag system,
hard to verify headlessly; smaller follow-up). Footprint/speed/aim-twist still foreground-only (D150);
sled-vs-POI collision still larger.

## Session ACP — 2026-06-01 — Salvage-panel clipping: built panels-sweep harness, audited all call sites, fixed buriedCockpit faceYaw ✓ verify pass (tsc clean)

`verified` — `npm run verify` (tsc) PASS. Focused work on the user-reported "salvage panel interiors
clip through POI walls" bug. Built a `panels` harness scenario, confirmed the common case is fine,
audited every call site, and fixed the lone offender.

**Investigation (harness `--scenario=panels`):** enumerates `ctx.salvageables.list`, force-opens
every door (`panelDoorTarget`), then frames + screenshots ONE panel per unique kind from the front.
Result: the 6 procgen kinds present (fuselage, escape_pod, cargo_container, engine_bell,
engine_cluster, massive) all render their interiors CORRECTLY when open — the bug is NOT systemic.

**Fixed — buriedCockpit panel faceYaw** (`buriedCockpit.ts`): the panel sits on the -X flank
(`localX=-r*1.05`) but passed `faceYaw=Math.PI`, which faces -Z. `addAccessPanel` maps
`local +Z → (sin yaw, 0, cos yaw)`, so -X needs `-π/2` (cf. `saltOutpost`'s +X flank = `+π/2`). With
`π` the door faced the wrong way and the cavity recessed PARALLEL to the flank → interior clipped
through the hull. Audited all 15 `addAccessPanel` call sites; this was the only faceYaw mismatch (the
rest use the correct wrapper-Group pattern or correct flank yaw). Fix is geometrically certain;
screenshot-confirmation owed (buriedCockpit registers its salvageable as `escape_pod` kind + is
seed-gated, so it wasn't isolable in the per-kind sweep — which is exactly why it slipped past).

**Harness (`scripts/rig-shot.mjs`):** added `--scenario=panels` (per-unique-kind open-panel sweep).

**Still open (per ACO/D150):** footprint + speed-spike + aim-twist feel-tune are FOREGROUND-only
(kinematic-velocity / continuous-turn feel can't be exercised in the throttled headless harness).
Sled-vs-POI collision deferred (larger — kinematic-vs-static shapecast). If other panels clip, the
user can point at the POI; the sweep tool + call-site audit found only buriedCockpit.

## Session ACO — 2026-06-01 — Night ambient-dust gate (calm starry night) + 5 user-bugs logged + harness scenarios ✓ verify pass (tsc clean)

`verified` — `npm run verify` (tsc) PASS + night-sky scenario confirms dust hidden at night (state +
screenshot). A bug-intake + targeted-fix session: the user reported 5 bugs; one was a clean,
verifiable fix (shipped), two need a foreground repro (the headless harness can't exercise them —
D150), two are larger (deferred).

**Logged (5 user-reported bugs → backlog):** speeder-dismount footprints, random speed spike,
sled-vs-POI collision, ambient dust at night, salvage-panel interiors clipping through POI walls.

**Shipped + verified:**
- **Night ambient-dust gate** (`ambientDust.ts` + `tuning.ts`): the always-on tan drift now fades to
  0 across dusk by `ctx.time.sunHeight` (new `AMBIENT_DUST_NIGHT_FADE_LO/HI` = 0.02/0.20) and the
  layer hides entirely at night. Stars now read on a clean dark sky + the night feels calm. Verified
  via the new `night-sky` scenario: at `sunHeight:-1`, `dustVisible:false` + a clean starfield shot.
  (The near-white chest-height `dustMotes` — a deliberate firelight-air detail — were left on.)

**Harness (`scripts/rig-shot.mjs`):** added `--scenario=night-sky` (sets midnight, confirms dust
gated off, frames the stars) + `--scenario=footprints` (walk → mount → dismount → walk, samples
`rig.stepCount`).

**Investigated, NOT fixed (need a foreground repro — D150):**
- **Speeder-dismount footprints** + **random speed spike**: both depend on the player body's KINEMATIC
  `linvel()` (rig gait reads `speedMag` from it; movement is `speed*dt`). In the throttled headless
  harness the kinematic `linvel` reads 0 (`speedMag=0`/`state=idle` even while the body moves), so the
  gait/footstep path can't be exercised at all — even pre-mount. Static analysis: the footstep block
  resyncs `_lastSeenStepCount` every frame + dt is clamped (loop.ts 0.1), so neither has an obvious
  code fault; both need real-rate foreground observation. Carried to ACP.

**Deferred (larger):** sled-vs-POI collision (kinematic-vs-static shapecast — non-trivial), salvage-
panel interior clipping (a visual sweep across all POI × panel kinds).

## Session ACN — 2026-06-01 — Playwright cursor-trap fix + live-scenario harness + ACL live-feel triage (dynamic aim-twist) ✓ verify pass (tsc clean)

`verified` — `npm run verify` (tsc) PASS + all three live-feel items exercised in a TICKING Playwright
env (the ACM rAF-block is closed: the harness page ticks; the hidden preview MCP does not — D146). The
session began with a user-reported bug (cursor trapped in an invisible top-left box during Playwright
verification) and grew into finishing the ACL live-feel triage ACM couldn't reach.

**Fixed:**
- **Playwright cursor-trap** (`input.ts` + `main.ts`): `npm run rig-shot` enters via the DEV
  `enterGame()` hook → `handoffToGame()` → `controls.lock()`. The lock guard
  (`document.hidden || canvas 0×0 || !hasFocus()`) does NOT detect headless Playwright (its page
  reports visible + sized + focused), so PointerLock fired and confined the OS cursor to the harness's
  offscreen window. Now `enterGame` calls `handoffToGame({ skipLock: true })` — automated entry
  **deterministically never locks** (it drives input via evals). Extracted a shared
  `pointerLockSuppressed()` helper; also guarded the start-overlay click (D147).

**Shipped:**
- **Dynamic aim-twist** (`playerRig.ts` + `tuning.ts`, D148): the ACL "aim twist-IK" was a CONSTANT
  0.35-rad shoulder bias in 3P (the author's own comment admits the static heading-delta was ~0). Now
  derives the camera TURN RATE (Δheading/dt) and leads the lead shoulder INTO turns, relaxing to a
  resting bias when steady. New `AIM_TWIST_TURN_GAIN` (0.10), `AIM_TWIST_BIAS` 0.35→0.18, new
  `rig._aimPrevHeading`. Verified: steady 0.167 → turn-left 0.207 → turn-right 0.052 (responds to turn
  direction + rate, both ways).
- **Live `--scenario` harness mode** (`scripts/rig-shot.mjs`): enters the game TICKING (pointer-lock
  gate forced open, unpaused) and captures time-sequence strips / numeric samples. Three scenarios:
  `shrew-flee`, `aim-twist`, `rifle`. Drives + samples from NODE (page.waitForTimeout) — NOT in-page
  rAF (throttled in the hidden Playwright tab; the game survives via its setTimeout fallback — D149).
  Pre-sets the tutorial `seenIntro` flag so the first-boot controls panel never opens (it gates LMB).

**ACL live-feel triage (all PASS, in a ticking env):**
- **Shrew flee** — bolts ~8m at ~3.2 m/s (matches FLEE_SPEED), settles after ~2.4s (FLEE_DURATION),
  resumes wander. ACM's "didn't flee" was the frozen-tick false alarm, NOT a bug.
- **Aim-twist sweep** — see Dynamic aim-twist above.
- **Rifle fire/reload** — fire decrements ammo (3→2), R-reload refills from scrap_bullet (2→8, bullets
  12→6). Fully functional through the ranged combat path.

**Findings (verification footguns, now canon):** (1) headless `enterGame` leaves the first-boot
tutorial controls panel OPEN → `updateWieldAction.overlayOpen()` gates ALL LMB actions → silently
blocked rifle-fire until the harness pre-dismissed it (reload uses a separate no-overlay path, so it
worked — the asymmetry that exposed it). (2) in-page `requestAnimationFrame` is throttled in the
hidden Playwright tab; drive ticking work from Node-side waits + shrink the canvas for tick-only
sampling.

## Session ACM — 2026-06-01 — Visual-triage of the ACL features (partial: rAF-block ceiling) + debug storm-hook fix ✓ verify pass (tsc clean)

`verified` — `npm run verify` (tsc) PASS. A visual-triage pass on the ACL-shipped visual features to
close the rule-8 debt. **Verified clean** (static screenshots + state inspection): night-sky stars,
the sweeping sandstorm wall, the desert-shrew model (reads as a recognizable small critter in-world),
the amban-rifle viewmodel (well-proportioned procedural rifle — receiver/barrel/muzzle/fore-grip/
sights/stock/grip/guard/bolt via the metal+wood material factories), and the aim-twist rig plumbing
(`_aimTwist` + `shoulders[1]` present, resting at the bias value).

**Fixed:**
- **Debug `triggerStorm` hook was stale** (`debugPanel.ts`): post-ACL it set `weather.state` inline
  WITHOUT arming the storm wall, so a debug-triggered storm produced 0 intensity (the wall is the
  intensity producer per D145). Now delegates to the exported `weather.triggerStorm(ctx)`, which calls
  `armWall()`. (rigStudio's D135-negate removal also confirmed in place.)

**⚠ Could NOT live-verify (environment block, not effort — D146):** shrew flee *motion/feel*, the
aim-twist *sweep*, and rifle *fire/reload* + on-screen viewmodel. The headless preview tab is
`document.visibilityState:"hidden"` → the browser throttles `requestAnimationFrame` to zero, so the
game tick is frozen (`elapsed` stuck; an rAF callback never fired in 30s). Worked around the
`isPlaying` pointer-lock gate, but the rAF freeze is a hard block. These three are structurally sound
(correct wiring + sound geometry, shrew flee mirrors the proven lizard) but their live FEEL needs a
foreground `npm run dev` playtest or an extended Playwright harness — carried forward to ACN.

## Session ACL — 2026-06-01 — Overnight breadth: 8 backlog features via fanned-out agents ✓ verify pass (tsc clean) + boot-clean

`verified` — full `npm run verify` (tsc) PASS + runtime boot smoke-test clean (harness booted +
rendered, zero page/console errors). A **long unattended overnight** (~2M budget) that shipped a
broad mixed batch via **8 parallel file-ownership lanes + a single integrator** (see orchestration
note D143). 9 agents, ~573k subagent tokens, ~12min wall. **SAVE_VERSION 13→14** (additive — D144).

**Shipped (8 features):**
- **Aim twist-IK** (`playerRig.ts`): in 3P, the right shoulder leads toward the camera (additive
  yaw `rig._aimTwist`, lerped, clamped ±0.5; never clobbers the swing X-rotation).
- **Speeder angular damping** (`speeder.ts`): passive Y-yaw exp-decay on the mounted body so
  post-collision spin settles without sluggish steering (composes before the steering lerp).
- **Worm twilight-breach audio attenuation** (`sandWorm.ts` + `audio.ts`): `playWormRoar(vol)` +
  new `playWormRoarAttenuated(dist)` (full ≤180m → ~0.2 @400m → silent @650m); twilight breaches
  use distance, combat breaches stay full-volume.
- **megaWreck ground-level salvage panels** (`megaWreck.ts`): 2 new chest-height exterior panels so
  the wreck is fully salvageable without the catwalk stairs.
- **Night-sky stars** (`sky.ts`): PointsMaterial → custom ShaderMaterial with per-star twinkle
  (phase attr + `uTime`), slow deterministic celestial drift, and stronger cloud occlusion during
  storm states.
- **Dune sweeping sandstorm** (`weather.ts`): the uniform intensity-ramp is now a directional storm
  WALL (position/dir/width/speed) that sweeps across the player; `weather.intensity` is DERIVED from
  signed distance to the wall (ramp-up → peak inside the core → ramp-down) so all downstream readers
  (sky/fog/dust/vignette/penalty) are unchanged. Anisotropic dust bias along travel dir. Wall state
  persisted (D144/D145).
- **In-storm movement penalty** (`controller.ts`): unsheltered + high intensity → sprint disabled +
  walk slowed up to 30%, smooth ramp.
- **Amban rifle** (new ranged weapon: `types.ts` + `items.ts` + `combat.ts`) — procedural wood/metal
  viewmodel, fires via the existing ranged combat path, scrap_bullet-fed; **+ viewmodel fidelity** on
  `large_tent_kit`/`bedroll_kit`/`lantern_kit` (Lambert primitives → procedural material factories).
- **Desert shrew** (NEW `enemies/shrew.ts`): skittish ambient critter mirroring the lizard pipeline
  (procedural model + idle/wander/flee AI); `ctx.shrews`, tick after `updateLizards`, save roster.

**Integration** (`main.ts` tick, `save.ts` v14 + additive `shrews`/`weatherWall` + back-compat,
`GameContext.ts` `ctx.shrews`, `tuning.ts` ~40 promoted consts): single integrator agent applied
all 8 lane manifests; full tsc PASS. New constants live in a tuning.ts "ACL" block.

**⚠ Rule-8 debt (honest):** the new VISUAL features (star twinkle/drift, sweeping storm wall, shrew
model, aim-twist in motion) shipped **tsc-clean + boot-clean but NOT visually-iterated** — the
overnight-breadth tradeoff. A `/visual-triage` pass on these is the next session's top item.

## Session ACK — 2026-05-31 — PM-C outfit + realism pass (PBR materials, proportions, baked occlusion) ✓ verify pass (tsc clean)

`verified` — tsc clean + verified via the Playwright `rig-shot` harness. PM-C (re-dress
the stripped torso) + a goal-driven **realism arc** (9 rounds) taking the figure from a
cartoon mannequin to a believable, solid, dressed human. Within the zero-asset procedural
pipeline this is the realism ceiling (photoreal needs the D107 asset fork — surfaced, user
chose to stay procedural).

**PM-C — torso tunic** (`playerRig.ts`, D140): re-dressed the torso (bare since the ACJ
poncho cut) with a fitted wrapped tunic that HUGS the body lathe (not a flared poncho) —
neckline → upper-hip hem, cloth folds + broken hem + a diagonal wrap seam. Shoulder/belt/
pouch/pack legibility re-verified.

**Realism arc** (`playerRig.ts` + `skinMaterial.ts` + `fabricMaterial.ts`):
- **Proportions** (D142): `HEAD_R` 0.135→0.115 (ACI's 0.135 read ~1:6.7 cartoon big-head;
  now ~1:7.7 realistic adult) + longer/slimmer neck (`NECK_H` 0.10→0.135, `NECK_R`→0.050).
- **Natural stance**: contrapposto verification pose (killed the stiff mannequin read).
- **Player materials → PBR** (D141): skin + cloth opt into `MeshStandardMaterial` (per-FRAGMENT
  lighting + roughness) with a derivative-based procedural **micro-bump** (skin pores / cloth
  weave+folds catch light) + **baked occlusion** (downward-facing surfaces darkened so
  undersides/recesses self-shadow even under the game's flat ambient — solidity without a
  scene-lighting change). Opt-in `pbr` flag; creatures stay cheap Lambert.
- **Goggles**: flat black discs → glossy convex lenses (low-roughness MeshStandard) that catch
  a specular glint = real glass read.
- **Hands**: slimmer + relaxed-CURLED fingers (was blocky splay). **Boots**: sole + rounded toe
  + heel (was 2 lego boxes). **Head**: fuller cranium dome + cleaner jaw (was pointy ovoid).
- **Harness** (`scripts/rig-shot.mjs`): added `--lit=form` (key + rim + low ambient — flat
  studio light hid all form) + `full`/`full3q`/`torso` framings + a `relaxed` contrapposto pose.

**Removed**: dead `src/player/viewModelHands.ts` (FP hands cut in ACJ; broke on the new material
union type).

**Honest ceiling**: believable *stylized* human, not photoreal. The remaining realism levers
are the user's calls — the game's lighting MOOD (lower ambient/higher contrast = solid in-game,
but changes the whole look) or the D107 asset fork. D140-D142.

## Session ACJ — 2026-05-31 — SkinnedMesh rig foundation + face (goggles/scarf) + poncho cut + Playwright harness ✓ verify pass (tsc clean)

`verified` — tsc clean + self-verified via a NEW Playwright capture harness (the
preview-MCP screenshotter wedged twice mid-session; Playwright is the reliable path
now). Continues the player-model arc; the headline is a **foundation rebuild** the
earlier polish cycles structurally couldn't reach.

**Why a foundation rebuild** — the rig was rigid Lathe/Box primitives parented at
joint Groups, so every joint (elbow/knee/wrist) was a hard SEAM and the hand jutted
off the wrist as a disconnected block. ~13 sessions of polish couldn't break that
ceiling. User chose the procedural-SkinnedMesh path (keeps D107 zero-asset).

**PM-S — procedural skinned limbs** (NEW `src/player/skinnedLimb.ts` ~115 LOC +
`playerRig.ts`): `buildSkinnedLimb` lathes a radius profile into ONE continuous tube,
generates skinIndex/skinWeight per vertex blending across the mid joint, and binds a
3-bone chain. **Arms** (shoulder→elbow→wrist) + **legs** (hip→knee→ankle) converted —
elbow + knee bend SMOOTHLY, no seam. Bones REPLACE the old pivot Groups (Bone extends
Object3D) so animation / foot-IK / held-item / stepCount code is unchanged; PlayerRig
limb fields retyped `Group[]`→`Object3D[]`. Legs keep HIP_Y on the hip BONE (foot IK
rewrites `.position.y`); arms carry it on the mesh. D136.

**Hands** — fixed "rotated weirdly / not connecting": the hand now CONTINUES the arm
(fingers hang down-forward, `handGroup.rotation.x=-1.15`) instead of jutting forward
off a vertical forearm; thumb MIRRORED per side (the left hand was a second right
hand). FP viewmodel hands REMOVED (camera-anchored wraps that read as floating geometry).

**PM-B.2 face — goggles + brow + nose** (`playerRig.ts`): the blank ovoid gets the
scavenger signature — two smoked-glass lenses in brass rims + bridge + temple stubs on
the +Z face, a brow ridge, and a nose-bridge wedge. Reads as a goggled face head-on + 3q.

**PM-B.3 face — lower-face scarf** (`playerRig.ts`): a pale dusty cloth sphere-section
over nose/mouth/chin (distinct tone from skin — the old same-tone bandana was invisible),
standing proud of the skin so the cloth edge reads, wrapping the cheeks toward the hood.
Face complete: goggles + nose + wrap.

**Poncho REMOVED** — the folded-cylinder poncho read as stiff boxy panels (no real
drape); cut pending PM-D cloth physics. Removed dead `ponchoMat`/`PONCHO_COLOR`. D139.

**Junction fillers** — exposed by the poncho cut: legs stuck out beyond a too-narrow
pelvis ("bolted on"). Widened the torso hip-line (×1.35→×1.62) + added hip-cap filler
spheres on each hip bone (mirrors the deltoid trick) + enlarged the deltoid. Hips→legs
now read as one continuous mass. (Full blend = torso skinning, deferred PM-S.3.)

**rigStudio framing fix (D137)** — PM-B.1 (ACI) moved the face to +Z, which silently
INVERTED D135's negate, so every `'head'`/`'front'` shot since ACI showed the BACK
(undetected — the head is front/back-symmetric; the exact D135 trap the canon warns of).
Removed the negate; verified empirically with a markered two-sided test.

**NEW Playwright harness** (`scripts/rig-shot.mjs` + `npm run rig-shot`) — spins its own
dev server, drives `__game.rigStudio`, writes PNGs to `verification/` (gitignored).
`--pose`/`--angles`/`--closeup` (heading-relative joint close-ups). Mirrors Highwind's
verify-rigs pattern; the reliable verification path now the preview-MCP wedges. D138.
Added `playwright` devDep.

**Deferred**: PM-C layered outfit (re-dress the now-stripped torso + fix shoulder
bunching), PM-D cloth physics (real cloth + the proper torso-skin junction blend),
PM-S.3 torso/neck-head skinning. D136-D139.

## Session ACI — 2026-05-31 — Player-model arc: re-plan + PM-Cycle A (silhouette) + PM-B.1 (hood) ✓ verify pass (tsc clean)

`verified` — tsc clean + self-verified via the headless `rigStudio` loop. After an
honest full-body audit found the ACH model **far from the Rey/real-human bar** (a
rigid barrel/sandwich-board on stick-legs, blank ovoid face, floating mushroom-disc
scarf), the single "Rig to Rey-tier" cycle was **re-planned into a 5-cycle arc**.

**Re-plan** — NEW [docs/feature-player-model.md](feature-player-model.md): 5 cycles
(A proportion/silhouette → B head/face/scarf → C layered outfit → D cloth physics →
E texture), each with a repeatable **Model Verification Protocol** (6 canonical
frames + critique vs real-human + the Rey reference + an adversarial pass-bar),
5–8 rounds/element. iteration-plan Cycle 2 marked re-scoped.

**PM-A.0 — `__game.rigStudio(angle?)`** (`debugPanel.ts`): the verification engine.
One call → headless, evenly-lit (studio ambient/key + exposure ~2 — in-game dusk
hid all detail), framed full-body shot at a canonical angle. Used every round.

**PM-Cycle A — proportion + silhouette (pass-bar MET)** (`playerRig.ts`): slimmed +
tapered the torso (`TORSO_CHEST_R` 0.22→0.185, `WAIST_R` 0.16→0.115) — killed the
barrel, real shoulder→waist taper. Poncho narrowed + lengthened (H 0.85→1.05) +
deeper folds (8 waves, 7.5cm hem) + scalloped/broken hem → drapes off the shoulders
instead of a 0.58m tube. Head bigger/rounder (`HEAD_R` 0.12→0.135). Net: reads as a
**slim draped human**, not a barrel. (Rig consumers unaffected — only mesh radii
changed, skeletal constants untouched.)

**PM-B.1 — hood wraps the skull** (`playerRig.ts`): rebuilt the headscarf crown from
a flat floating mushroom-disc into a sphere section that WRAPS the skull (top/back/
sides, phi→0.92π, hugging radius, centered) with a front theta-wedge open for the
face. Floating disc killed; face sits in the opening.

**Bug fix** — `rigStudio` framed `'front'`/`'head'` via `getWorldDirection` (the
head's +Z, AWAY from the face) → every studio shot had shown the BACK. Negated it.
D135.

**Iteration-discipline note (rule 8)**: every element here was build → `rigStudio`
screenshot → honest critique → iterate, with deferrals stated (poncho stiffness →
PM-D cloth physics, face features → PM-B.2, neck-wrap → PM-B.3, shoulder bunching →
PM-C) instead of false "done" claims — the correction for the ACH over-claim.
**Deferred**: PM-B.2 face planes/goggles, B.3 face-wrap/neck, PM-C/D/E.

## Session ACH — 2026-05-31 — Cycle 2: Rig to Rey-tier + headless self-verify tooling ✓ verify pass (tsc clean)

`verified` — tsc clean + **self-verified via headless screenshots** (the new
loop, below). Phase 2 Cycle 2. 8 commits (12f2a36..7fd3076); `playerRig.ts` +
`debugPanel.ts` + `main.ts`.

**Headless self-verification tooling (the session's biggest unlock)** —
`__game.enterGame(dev?)` (`debugPanel.ts` + `main.ts`). The title handoff only
clears `flags.paused` via the pointer-lock `'lock'` event (`input.ts`), which
never fires for an agent/preview click → preview entries rendered the
title-gone scene but never ticked. enterGame bypasses the button + pointer-lock
and sets paused=false directly, so the rAF loop ticks + renders headlessly.
Combined with `renderer.setSize` + `flags.thirdPerson` + posing joints via
`ctx.player.rig`, this gives a full edit → enter → pose → screenshot → critique
→ iterate loop with NO human-in-the-loop needed. D134. (Caveat: the preview-MCP
screenshot itself wedged earlier in the session; a Claude Code restart cleared
it.)

**Rig to Rey-tier** (`playerRig.ts`, all self-verified, 1-3 iteration rounds each):
- **Forearm wraps + fingerless glove**: 2 sparse tori → 7 tapered tight bands
  (alternating thickness + tilt = hand-wrapped read); palm + knuckle ridge → wrap
  cloth, fingers bare (fingerless glove, exposed tips).
- **Unified headscarf**: merged the separate dark bandana + tan crown + back
  drape into ONE tan cloth — face-wrap uses hoodMat, crown gets D117-style
  fold displacement + squash so it reads as a wrapped cap not a helmet dome.
  Retired BANDANA_COLOR/bandanaMat.
- **Belt + hip pouches**: leather belt + buckle + 2 splayed pouches at the waist.
- **Backpack + bedroll**: visible scavenger pack mounted OUTSIDE the poncho drape
  (else occluded) + lashed bedroll clearing the shoulders + shoulder straps.
- **Cloth-wrapped boots**: tapered band stack around each lower shin/ankle.

**Bug fix** — `fix(rig)`: finger knuckle-bump spheres were floating off the
fingertips (latent ABU bug: wrong-sign forward vector + offsets ~3× the finger
length). Fixed by parenting bumps to the finger's local axis. Surfaced from a
user visual report, diagnosed + fixed via the headless loop.

**Iteration-discipline note (rule 8)**: every rig element was build → screenshot
→ critique → iterate (the loop the tooling enabled), NOT shipped on tsc alone.
Glove contrast reads subtly at 3P (warm light), and the backpack is a plain box
— both flagged for the texture cycle. **Deferred**: skin/cloth texture pass
(separate material cycle), 3P-rig-on-speeder bug, foot-IK slope-snap.

## Session ACG — 2026-05-31 — Cycle 1: drag verification (close ACF's rule-8 gap) ✓ verify pass (tsc clean)

`verified` — tsc clean + **human playtest**. First session of the Phase 2
iteration plan (`docs/iteration-plan.md`). Closes ACF's deferred visual-triage
debt. 3 files (2 modified + 1 archived brief); committed `8a72e12`.

**DEV test affordances** (`src/debug/debugPanel.ts`) — `__game.spawnRaider(x,z)`
+ `__game.killRaider(id)`. Raiders stay dormant by design (D13 / Pillar 1);
these only exercise the ACF corpse-drag path (0 raiders spawn normally, so the
drag's raider path had never been runtime-exercised). The kill hook drives the
real death path (`damageRaider` → dead pose + corpse interaction tag).

**Head-first drag orientation** (`src/world/killDrag.ts`) — dragged raider
corpse (`group.rotation.y`) + worm carcass (`yaw` + `mesh.rotation.y`) now yaw
to trail head-first toward the anchor. Dead-pose-safe: `applySandWormDeadPose`
is yaw-only; the raider rig-path leaves group rotation identity. D133.

**Verified by human playtest** (the rule-8 gate ACF skipped): raider-corpse
drag on-foot + tied-to-sled reads correct, head-first orientation sign confirmed
right (no ±π flip), worm-carcass speeder-tow reads correct, in-progress-drag
save round-trip resumes on reload. Cycle 1 **closed**.

**Process note**: the agentic path behaved correctly — `--mode=overnight` was
requested but the agent detected failed preconditions (GDD §12 opts out of
overnight; no token budget set; Cycle 1 is human-in-loop visual work) and fell
back to gated. The headless preview couldn't drive the game loop (pointer-lock
handoff gating — `dustfall_preview_gotchas`), so the aesthetic sign-off was
correctly handed to a human rather than self-certified on tsc.

## Session ACF — 2026-05-31 — B1 Phase 3 follow-up: corpse/carcass rope-drag ✓ verify pass (tsc clean)

`verified` — tsc clean. 9 files (7 modified + 1 new module + 1 archived brief).
Closes ACE's deferred **Cut #3** (raider_corpse + sandworm_carcass endpoint
kinds). **NB**: this session began as a gamedev-framework smoke-test (Opus 4.8 +
optimized CLAUDE.md) and grew into a real feature — see "process notes" below.

**Towed-body rope kinds + drag system**. `RopeEndpoint` union
([src/world/rope.ts](../src/world/rope.ts)) gains `raider_corpse` (raiderId) +
`sandworm_carcass` (wormId) — the first kinds that are *towed bodies*, not
anchors (the rope drags them). NEW [src/world/killDrag.ts](../src/world/killDrag.ts):
kind-agnostic `updateKillDrag` — first non-sled caller of the ACE
`ropeConstraint` helper. Drag state lives on the entity as `dragAnchor:
RopeEndpoint` (NOT on `sled.tether`); hooked into `main.ts` after
`updateSandWorm` (which skips dead entities) + before `updateSledRiders`. Each
dragged kill gets a sagged rope tube (reuses the sled rope look, keyed by entity
id, disposed on detach). D131.

**Raider corpse** — `applyRaiderDeadPose` tags the corpse for interaction
(registry `raiders`, type `attach_rope`); `interaction.ts` routes rope-wielded
LMB-on-corpse → tie to a player-tethered sled (trails it) or to the player
(drag on foot); LMB again drops it. **Sandworm carcass** — towable ONLY behind
the speeder (a 24m carcass is too massive to drag on foot); `interaction.ts`
extends the `sandWorms` case for rope+mounted LMB-on-carcass → tow / cut loose.
D132.

**Save** — additive, **no SAVE_VERSION bump** (D81): serialized sled tether
union + payloads extended; `raider.dragAnchor` + `worm.dragAnchor` round-trip so
an in-progress drag survives reload.

**Tuning** — `KILL_DRAG_*` block (raider/worm max+tear dist, body half-extents,
shared snap-perp-damp + ground clearance).

**Verification** — runtime-verified the worm path in the live game via forced
state: rope mesh spawns (correct geom/color), the inextensible constraint snaps
a 20m-yanked carcass back to the 14m leash, rope disposed on detach, no runtime
errors. **NOT verified**: (1) the aesthetic drag-feel/rope-sag from gameplay POV
— pointer-lock gating + opening-wreck spawn occlusion block automated framing
(per `dustfall_preview_gotchas`); (2) the raider-corpse path at runtime (0
raiders spawn by default, no spawn hook) — code is tsc-clean + structurally
identical to the verified worm path.

**Process notes (iteration-discipline self-check, rule 8)**: the rope-mesh
visual + corpse-drag shipped with FUNCTIONAL verification only — NOT the
build→screenshot→critique→iterate aesthetic loop. Drag-feel quality is unproven;
a follow-up visual-triage (kill a raider, tow a carcass, judge sag/orientation)
is owed. Body-trails-head-first orientation was deliberately deferred (unverified
against the dead-pose rotation). Known edge: `lootSandWorm` untags the carcass,
so towing works only BEFORE harvesting (tow-then-harvest flow).

## Session ACE — 2026-05-27 — Overnight: rope vocab + multi-worm + lizard pipeline + rig polish + procgen ✓ verify pass

`verified` — tsc clean. 17 files (15 modified + 2 new modules). Comprehensive
overnight bundle across 5 tiers; 4 fully shipped, 1 with one item deferred per
pre-committed scope cuts. Sled riding mechanic remains tabled per user direction.

**Tier 1 — B1 Phase 3 generalised rope** (~5h with iteration). NEW
[src/world/ropeConstraint.ts](../src/world/ropeConstraint.ts) — inextensible-rope
constraint extracted from `updateSleds` as a reusable helper (callers supply
attach point + managed velocity scalars; helper handles position-snap +
radial/perpendicular damping). NEW [src/world/stake.ts](../src/world/stake.ts) —
craftable iron-stake world-anchor (recipe 16: scrap×3 + branch×1). New `stake`
kind on `RopeEndpoint` union. Save schema additive (no version bump): new
`stakes?` array + `tether` discriminator extended with `'stake'` + optional
`tetherStakeId`. Interaction: LMB-on-stake with rope wielded + player-tethered
sled ties the sled to the stake; RMB-on-stake pulls the stake up. Stake mesh
iterated 3 rounds — chunky shaft, gunmetal-weathered hammered cap, rope-loop
welded to side, sand-dome mound at base. End-to-end save/load verified.
**Cut #3 applied**: 1C raider_corpse + 1D sandworm_carcass endpoint kinds
deferred (foundation in place via the shared constraint helper). D126.

**Tier 2 — Multi-worm population** (~3h). **SAVE_VERSION v12 → v13** —
`ctx.sandWorm: SandWorm | null` → `ctx.sandWorms: { list: SandWorm[] }`. New
`SandWorm.id` + `_nextWormId` allocator + `findSandWormById`. `_colliderToWorm`
singleton → `Map<handle, SandWorm>`. `updateSandWorm` iterates the list;
`applyClosestTremorEffect` picks the closest threat-state worm so the player's
experience tracks immediate danger. `sampleSandwormHome` accepts
`excludeOtherWorms` for multi-worm rejection sampling (`SANDWORM_MIN_SEPARATION`
= 400m). New `Tuning.SANDWORM_COUNT = 2`. Per-worm rejection at boot; verified
across seeds (worms land ~1500m apart in distinct dune-biome centroids).
Save round-trip verified; pre-v13 backward compat verified (singleton →
`sandWorms[0]`). Also fixed a latent version-check bug rejecting v12 saves.
D127.

**Tier 3 — Lizard procedural-character pipeline lift** (~3-4h with full
iteration discipline). 5 iteration rounds on `makeLizardVisual`. R1 baseline
Lathe body + head + tail (head orientation bug + body too ball-shaped). R2
fixed head orientation, stretched body, longer snout. R3 body raised so feet
make ground contact. R4 Y-squash for flatter belly-on-ground reptile
silhouette. R5 overlapped head into body for smooth neck transition. New
mesh: 8-point Lathe body profile (ribcage swell) + 6-point Lathe head
(snout → eye area → neck-joint) + 5-point tapered Lathe tail + asymmetric
legs (front shorter than rear, knee bumps, sprawl posture). Reads as
anatomical reptile vs the pre-ACE Box+Sphere+Box brick. Per the iteration
discipline (shared-memory/iterative-polish-discipline.md): screenshot/critique
loop honored — agent can summarize round-1-vs-round-N before/after for each
element. D128.

**Tier 4 — Player rig polish wrap-ups** (~2-3h). **4A walk-cycle to footstep
cadence sync** — controller.ts now drives footstep audio + decal + dust from
`rig.stepCount` (phase-locked to visible heel-strikes) when rig is present;
legacy `_stepAccum` kept as fallback. Audio always fires on the visible foot
contact, not a parallel distance accumulator. **4B 3P viewmodel readability**
— tagged 9 remaining items with `thirdPersonScale` (fire_kit 1.35, grill_kit
1.30, torch 1.30, flashlight 1.30, tent_kit 1.25, large_tent_kit 1.20,
bedroll_kit 1.35, lantern_kit 1.30, stake_kit 1.35). **4D footstep dust at
foot terrain contact** — when rig present, `spawnFootprintPuff` emits at
`rig.ankles[parity]` world position (terrain-clamped) instead of body-center
+ lateral-offset. **Cut #2 applied**: 4C aim twist-IK on right shoulder
deferred (smallest impact, scope-cut to focus remaining budget).

**Tier 5 — Procgen POI expansion** (~2h). **5A orbital_pod_cluster** (6th
wreck class) — 1 cockpit + 1-2 hull + tail, no engine, escape_pod
salvage palette ("rescue pods crashed together" silhouette vs the linear
fuselage classes). Added to 6-way roulette at 12% share; class
distribution re-balanced (30/18/16/11/13/12). **5B BRISTLE_ANTENNA** (6th
hullSegment variant ~80 LOC) — hull cylinder with 3-5 antennas (alternating
sides with bulb tips + 50%-chance crossbar) + 1-2 dish stubs on the -Z
face. Reads as scout / science vessel surveillance module. Biome weight
table extended to 6 entries (no biome bias on the new variant). **Cut #1
applied**: 5C dune_drill_site biome-specific POI deferred (would need new
module + iteration).

**D-entries**: D126 (ropeConstraint extracted as shared helper),
D127 (sandWorms array migration v13 — array-keyed wandering entities
prepare future streaming work), D128 (procedural-character pipeline applied
to lizard via D115 Lathe + asymmetric leg pattern), D129 (footstep
audio driven from rig.stepCount), D130 (stake = craftable persistent
RopeEndpoint alongside ad-hoc static-pos).

## Session ACD — 2026-05-26 — Sled physics polish + riding mechanic (tabled) ✓ verify pass

`verified` — tsc clean. 10 files modified. Long playtest follow-up
session iterating on the ACC sled mechanic from user-reported
gameplay bugs. Major physics rework lands; the player-rides-sled
mechanic was attempted across multiple architectures and tabled in
backlog.md for a future session.

**Sled physics rework** (`src/world/sled.ts`, `src/config/tuning.ts`):
- **Managed-scalar slope-slide**. Pre-ACD slope-slide used `setLinvel`
  to push the sled downhill each frame; with body friction 0.6
  against the heightfield, Rapier's contact solver zeroed the
  tangential velocity each step (static-friction angle atan(0.6)≈31°
  swallowed every dune). New design: `_slideVx/_slideVz` managed
  scalars driven by slope-gravity + Coulomb friction + linear
  damping, applied via direct `setNextKinematicTranslation` each
  frame. Bypasses Rapier's velocity integration entirely. Sled
  actually slides now. D122.
- **Coulomb friction model** for the slope-slide (`SLED_KINETIC_FRICTION
  = 0.15`). Static-friction-threshold behavior emerges naturally:
  below sin(θ)×GAIN < FRICTION, sled stays put / coasts to a stop.
  Above, sled accelerates toward terminal velocity. Critical slope
  for sliding ≈ atan(0.15/6.0) ≈ 1.4° with current gain.
- **Body type → KinematicPositionBased**. Pre-ACD sled was Dynamic
  with Y-locked translation + all rotations locked. Dynamic items
  resting on the deck transferred lateral friction impulses to the
  body via Newton's 3rd law; impulses accumulated in body.linvel and
  the physics step integrated position BEFORE updateSleds re-set it,
  compounding into wild downhill drift with multiple items on the
  sled. Kinematic body can't be pushed by dynamic items (one-way
  interaction); items still rest on the deck via friction with the
  kinematic body's implicit velocity. Player KCC also can't push the
  sled now. D123.
- **Body tilts to match terrain slope (Option B)**. Pre-ACD the sled
  body was axis-aligned with Y sampled at the sled's center; on a
  slope, uphill terrain inside the sled's XZ footprint poked up
  ABOVE the sled's flat top deck — player walking onto the sled
  landed on terrain, not on the deck. Body now slerps its rotation
  toward terrain normal each frame via `setNextKinematicRotation`;
  the bottom face conforms to the terrain plane, top face uniformly
  above terrain across the footprint. Visual group rotation mirrors
  body directly (no separate slerp). D123.
- **`SLED_GROUND_CLEARANCE = 0.06m`** — uniform Y lift above terrain.
  Handles small terrain undulations across the 2.2m×1.2m footprint
  so corners/yoke don't clip into sand.
- **Back wall collider → sensor**. The 12cm-thick back-wall lip was
  catching the player capsule when they jumped onto the sled — they
  perched on the wall instead of landing flat on the deck. Items
  still stay on the deck via top-deck friction (0.85) + the
  kinematic-rider promotion.
- **`_frameDeltaX/Y/Z` tracking on Sled**. Per-frame XYZ motion delta
  computed at end of each updateSleds iteration. Currently unused
  (the consuming player-ride logic was scrapped, see below) but
  preserved as foundation for future ride attempts. Zero runtime cost.

**Pickup tunneling fix** (`src/pickups/pickups.ts`): rope (and other
flat-bbox items: cloth, bandage) dropped via G fell through terrain
because the cuboid collider's bbox.y was small (rope coil is flat,
~6.6cm tall after 1.5× scale) → collider half-height hit the 4cm
`Math.max` floor → 8cm-thick collider + 60cm spawn height + downward
throw velocity = per-frame travel exceeded collider thickness =
discrete collision missed the heightfield. Enabled CCD on dynamic
pickup bodies (`setCcdEnabled(true)`); Rapier's swept-shape test now
catches any high-velocity crossing. D124.

**Sled riding mechanic — tabled** (`src/player/controller.ts`,
`docs/backlog.md`): user goal was "stand on sled, sled moves, player
rides with it" (like standing on a moving platform). Attempted
multiple architectures:
- Manual platform-ride detection (raycast + AABB+Y fallback) +
  delta-add to KCC `desired` — KCC's slope-projection ate ~20% of
  horizontal motion when standing on the tilted body.
- Apply delta AFTER `computeColliderMovement` (bypass slope-
  projection) — drift dropped to ~10% but player's Y still followed
  gravity instead of the sled's Y change; gap built until detection
  dropped.
- Sticky ride state + full 3D delta (XYZ) + `_frameDeltaY` tracking
  — player still slid off after 5-10 frames.
Root cause: Rapier's KinematicCharacterController has no built-in
moving-platform tracking. KCC's slope projection, autostep, and
contact resolution interact with a tilted moving kinematic body in
ways that no amount of detection + delta application could fully
counter. Mechanic removed from controller.ts; data preserved on
Sled for next-attempt foundation; backlog entry documents tried
approaches + next-attempt ideas (full Option C parenting, or
synthetic "ride peg" dynamic body mirroring the branch-on-sled
trick). D125.

**Cleanup**: removed the platform-ride code from `controller.ts`
(raycast buffers, AABB fallback, sticky state, debug logging,
post-KCC delta application). Tabled feature documented in backlog.

**Tuning constants added/lifted**:
- `SLED_SLOPE_SLIDE_GAIN: 2.0 → 6.0` (user wanted faster slide)
- `SLED_KINETIC_FRICTION = 0.15` (NEW — Coulomb friction model)
- `SLED_SLACK_DECAY_PER_FRAME = 0.82` (NEW — lifted from inline magic)
- `SLED_SNAP_PERP_DAMP = 0.55` (NEW — lifted from inline magic)
- `SLED_GROUND_CLEARANCE = 0.06` (NEW)
- `SLED_ANGULAR_DAMP` REMOVED (unused after kinematic switch)

**D-entries added**: D122 (managed-scalar slope-slide bypass), D123
(sled body kinematic + tilts to match terrain), D124 (pickup CCD to
prevent thin-collider tunneling), D125 (riding mechanic tabled —
documenting what was tried so the next attempt has direction).

**Files touched**: `src/world/sled.ts` (~+560 LOC mostly the slope-
slide + tilt rewrite), `src/config/tuning.ts` (NEW constants),
`src/pickups/pickups.ts` (CCD), `src/player/controller.ts` (riding
attempts then cleanup), `src/main.ts` (updateSleds reorder),
`src/world/footprints.ts` (sled trail decals, earlier portion),
`src/persistence/save.ts` (minor), `src/player/interaction.ts`
(maybeStakeSledAtFloor drop-at-feet), `src/world/metalMaterial.ts`
(D109 localSpace option), `docs/backlog.md` (tabled-feature entry).

## Session ACC — 2026-05-26 — Throw items on sled + sandworm twilight breach + B1 Phase 2 RopeEndpoint refactor ✓ verify pass

`verified` — tsc clean. 10 files modified + 2 new files (`src/util/playerPos.ts`,
`src/world/rope.ts`). **Long overnight session.** Both ACC + B1 Phase 2
tiers shipped per the long-overnight plan; B1-P6 RMB UX cut per
pre-committed scope-cut #1 (RMB metaphor conflict with the existing
D77 "release/pack-up" convention).

**Pre-ACC quick wins** (kicked off the session before the main work):
- **Sandworm twilight breach** (`src/enemies/sandWorm.ts`,
  `src/config/tuning.ts`). Ambient threat-display fires during the
  ABO dawn/dusk windows (`dayTime ∈ [0.18, 0.22]` or `[0.78, 0.82]`)
  when player is in the 180-400m visibility band (outside detection,
  inside fog/draw range). Per-frame 1.2%/s probability + 8min
  cooldown → roughly one ambient breach per in-game day or two.
  Reuses `enterStationaryBreach` (full 5.5s cobra rear + roar +
  85-particle sand burst); new `_isTwilightBreach` flag routes the
  exit straight back to patrol instead of the retreat→alert combat
  loop. Pure cosmetic — no engagement, no `attackCount` increment.
  4 new Tuning constants (SANDWORM_TWILIGHT_BREACH_*).
- **Sandworm debug spawn reverted** — `DEBUG_SANDWORM_NEAR_SPAWN: true → false`
  after the testing session.

**ACC P1 — Sled top-deck collider** (`src/world/sled.ts`,
`src/config/tuning.ts`). Friction alone can't keep items on the sled
at sprint speeds — the inextensible-rope position-snap teleports the
sled ~0.1m/frame, faster than Coulomb friction can drag a Newtonian
body along. New design: a 2nd cuboid collider attached to the same
sled body, sitting just above the main cuboid's top face, with
friction 0.95. Slightly inset on X/Z so the visual curled rim of
the scrap-metal sheet appears to "hold items in the bed". Main
collider keeps its existing 0.6 friction for sled-on-sand tow feel.
4 new Tuning constants (SLED_TOP_DECK_*).

**ACC P2 — Kinematic-rider promotion** (`src/world/sled.ts`,
`src/pickups/pickups.ts`, `src/main.ts`). When a dropped pickup's body
comes to rest on the sled top, "promote" it to kinematic: body type
→ KinematicPositionBased, capture sled-local pose, drive world
transform each frame from `sled.group.matrixWorld × ridingLocalPos`.
New `updateSledRiders(ctx)` ticks AFTER updateSleds; `Pickup` gains
`ridingSledId/Pos/Quat` fields. `updatePickups` gated to skip riders
(updateSledRiders fully owns mesh + body sync for them). Player picks
up a riding pickup → existing despawn flow handles kinematic body
removal correctly. Sled gone → `releaseSledRider` switches body back
to dynamic.

**ACC P3 — Save items-on-sled** (`src/persistence/save.ts`). Additive
schema (per D81): `droppedPickups[].ridingSledId/Pos/Quat` optional
fields. Save serializes when a pickup is riding. Load: stash riding
info on the spawned pickup, then a SECOND pass after the sleds load
block converts the body to kinematic. Pre-ACC saves omit the fields
and load as regular dynamic bodies. Dangling sled references on load
cleared + pickup falls back to dynamic naturally.

**ACC Stretch — Aimable throw arc** (`src/inventory/inventory.ts`,
`src/player/interaction.ts`, `src/config/tuning.ts`). Drop velocity
uses the FULL camera direction (Y preserved) so the player can AIM
their throw: look down → item lands at feet; look at sled deck →
item arcs onto it. Was 1.5 m/s horizontal-only push; now 3.2 m/s
along cam direction + 1.0 m/s base upward kick. Pickup-swap drops
match. 2 new Tuning constants (ITEM_TOSS_SPEED, ITEM_TOSS_BASE_UP).

**B1 Phase 2 — RopeEndpoint refactor** (`src/world/rope.ts` NEW,
`src/util/playerPos.ts` NEW, `src/world/sled.ts`,
`src/enemies/sandWorm.ts`, `src/enemies/companion.ts`,
`src/player/interaction.ts`, `src/persistence/save.ts`). The
architectural lift of QQ's sled-specific tether vocabulary into a
generalized rope endpoint vocabulary.
- **NEW `src/world/rope.ts`** — `RopeEndpoint` union (`none | player |
  speeder | companion | sled | static-pos`), `Tether {a, b}` shape
  for future non-sled tethers, `resolveEndpointWorldPos(ctx, endpoint)`
  helper centralising the per-kind world-position math.
- **NEW `src/util/playerPos.ts`** — speeder-aware player position
  helper. 3rd consumer (rope resolver) triggered the lift; old
  copies in `companion.ts` + `sandWorm.ts` deleted, both now import
  from the shared util.
- **`Sled.tether: SledTether` is now an alias for `RopeEndpoint`**
  (sled is implicit second endpoint). `attachRopeToSled` accepts a
  `RopeEndpoint` instead of the old string union. `updateSleds`
  resolves the anchor via `resolveEndpointWorldPos` — the old manual
  switch on `sled.tether.kind` replaced with one resolver call.
- **Save schema additive** — `sleds[].tether` discriminator extended
  with 'sled' kind (logically impossible for sled's own tether but
  needed for type-compat); new optional `tetherSledId` field.
  Per D81 additive discipline, no version bump (SAVE_VERSION stays
  at 12).

**D-entries added**: D119 (kinematic-rider promotion pattern for
moving-platform items), D120 (RopeEndpoint vocabulary — sled-as-
implicit-second-endpoint convention), D121 (twilight-breach as
ambient threat-display routes back to patrol via _isTwilightBreach
flag bypass).

**Cut from this session per pre-committed scope-cut #1**:
- B1-P6 RMB-on-rope raycast-pick UX (conflicts with D77 RMB =
  release/pack-up verb; LMB-on-hover already covers the attach
  path; deferred to follow-up if needed).
- Bigger Tier 3 STRETCH endpoint kinds (raider corpse, sandworm
  carcass — would require additional constraint physics on the
  towed-end body, not just the sled).

## Session ACB — 2026-05-26 — Locker-on-sled (mobile storage) + static-pos UX ✓ verify pass
`verified` — tsc clean. 3 files modified (`src/world/sled.ts` +
`src/player/interaction.ts` + `src/persistence/save.ts`).
**Thirteenth session under iteration discipline**. 2 of 3 P-items
shipped; throw-items-on-sled deferred to ACC.

**P1 — Locker-on-sled (mobile storage)**. User direction: "place a
locker on the sled and pull that around, kinda making the mobile
storage more tactile".
- New `Sled.attachedLockerId?: number | null` field on Sled.
- `attachLockerToSled()` helper in sled.ts: consumes 1 locker_kit
  from inventory, spawnLockerAt at sled world-pos, re-parents
  locker.mesh from scene → sled.group with local pos on deck top.
- New interaction case: hovering sled cargo deck (not the rope
  stub) while wielding locker_kit + LMB → triggers
  attachLockerToSled. Toast: "locker placed on sled".
- updateSleds: per-frame sync locker.pos to mesh.worldPos (via
  getWorldPosition) so distance-based hover interactions still work.
  The mesh visually travels with the sled automatically because it's
  parented to sled.group.
- Save schema additive: `sleds[].attachedLockerId?: number` field.
  Save write conditional. Load: 2-pass — sleds + lockers spawn at
  saved positions first, then second pass re-parents each attached
  locker under its host sled.group at deckTopLocal.

**P2 — LMB-on-empty-ground UX for static-pos tether**. ACA shipped
the static-pos tether kind but no interaction created one.
- Added `maybeStakeSledAtFloor()` helper in interaction.ts. Triggers
  on LMB + rope wielded + player-tethered sled exists + no other
  interactable hit (fired from the `hits.length === 0` fallthrough).
- Stake position = player.pos + camera-horizontal-forward × 2.5m.
- Sets sled.tether to `{ kind: 'static-pos', x, z }`. Toast: "sled
  staked". Completes the ACA gap.

**Deferred to ACC**:
- P3 throw items on sled deck — needs collider redesign (top-
  friction friendly; current box is friction-OK bottom but items
  would slide off the warped lateral curls) + items-resting-on-sled
  save schema + parenting dropped pickups to sled.group while
  keeping their Rapier bodies sane.

## Session ACA — 2026-05-25 — Sled visual rework (scrap metal sheet) + B1 Phase 2 lite (static-pos endpoint) ✓ verify pass
`verified` — tsc clean. 2 files modified (`src/world/sled.ts` +
`src/persistence/save.ts`). **Twelfth session under iteration
discipline**. 2 of 3 P-items shipped; locker-on-sled deferred to ACB.

**P1 — Sled visual rework**. User feedback: "currently it actually
looks like a sled but I don't want it to look like a sled. I'd rather
look like an old sheet of scrap metal with a handle and maybe turned
up and warped on the sides a bit". Replaced wood-plank look entirely:
- Retired `_plankMat`/`_plankDarkMat`/`_runnerMat` (woodGrainMaterial).
- New deck: `PlaneGeometry(hx*2, hz*2, 16, 4)` rotated horizontal,
  per-vertex Y-displacement at lateral edges via curl formula
  `pow(|x|/hx, 2.3) * (hy*2.2 + sin/cos variation)`. Edges curl up to
  ~25cm, varying along z for natural warp.
- Slight X-pinch at curl for fold suggestion.
- Underside mesh (flipped + 1.8cm offset) for visible thickness.
- 14 rivets total: 8 on lateral curled edges + 6 on front/back.
- Welded handle yoke: 2 angled posts (cylinder, with weld-bead
  spheres at bases) + horizontal cross-bar rope-stub.
- Materials: `createPaintedMetalMaterial(0x6e5e48, wearLevel 0.85)`
  for top sheet + `createMetalMaterial(0x4a3a28)` for underside,
  rivets, and handle.

**P3 — B1 Phase 2 lite: static-pos endpoint kind**. Foundation for
more endpoint kinds without the full RopeEndpoint refactor.
- Extended `SledTether` union with `{ kind: 'static-pos'; x: number;
  z: number }`. Tether sled to a fixed world XZ point (stake-out).
- updateSleds anchor resolution: at static-pos x/z, terrain Y + 0.4m
  vertical offset.
- Save schema additive: `sleds[].tether` union includes 'static-pos'
  + new `tetherX?`/`tetherZ?` optional fields (written only when
  kind=static-pos, read on load to reconstruct full SledTether).
- `spawnSledAt` accepts the full tether object (was wrapping into
  `{ kind }` losing x/z payload).
- `SledTether` type imported into save.ts.
- ACB candidate: wire LMB-on-empty-ground UX to create static-pos
  tether (currently no interaction creates one — it's data-only).

**Deferred to ACB**:
- P2 locker-on-sled (mobile storage) — needs Sled.attachedLocker
  field + per-frame visual sync + save link + new interaction case
- Throw items onto sled deck (per ABM physics) — needs collider
  redesign + items-resting-on-sled save schema
- Full RopeEndpoint refactor (replaces SledTether with abstract
  Tether {a,b} so non-sled things can be tethered)

## Session ABZ — 2026-05-25 — B1 generalized rope (Phase 1: companion tether kind) + SAVE_VERSION v12 ✓ verify pass
`verified` — tsc clean. 3 files modified (`src/world/sled.ts` +
`src/player/interaction.ts` + `src/persistence/save.ts`). **Eleventh
session under iteration discipline**. Pivot to big-ticket feature
work. Re-scoped B1 generalized rope from ABO/ABP cuts; ABZ delivers
Phase 1 (minimal architectural increment + first new endpoint kind);
future endpoint kinds queued for ABZ+1.

**P1 — `companion` SledTether kind**. Extended `SledTether` union
with `{ kind: 'companion' }`. Updated `updateSleds` anchor resolution
to read `ctx.companion.pos` with +0.3y offset (back-top height).
Auto-detach if companion gone. `attachRopeToSled` signature accepts
new endpoint. Per-endpoint attach toast extended.

**P2 — Interaction wire: rope → companion**. interaction.ts
'companion' case extended: when player wields rope + has a player-
tethered sled + hovers companion + LMB → transfers the tether to
companion. Sled now follows the companion creature instead of the
player. Toast: "rope transferred to companion". Falls back to
existing passive pet_companion hover otherwise.

**P3 — SAVE_VERSION v11 → v12**. Schema extended: `sleds[].tether`
union now includes `'companion'`. SaveV1.version literal type
extended `| 12`. Pre-v12 saves load unchanged (their tether stays
among the old kinds). New v12 saves with companion tether persist +
restore correctly. Migration: additive only per D81.

**Phase 1 net result**: player can now tether sled to companion via
the rope + click flow. Companion drags sled when it walks. Save
round-trip preserves the new tether kind.

**Deferred to ABZ+1 / future sessions**: full `RopeEndpoint` union
refactor with abstract `Tether {a, b}` shape; new endpoint kinds
(static-pos, raider corpse, sandworm carcass); RMB-on-wielded-rope
raycast-pick UX; rope physics tuning for creature-puller (companion
walks slower than player so tow constraint may behave differently).

## Session ABY — 2026-05-25 — Road A polish wrap-ups (footstep cadence sync + limb R2 + 3P item readability) ✓ verify pass
`verified` — tsc clean. 5 files modified. **Tenth session under
iteration discipline**. 3 elements iterated, all minor-polish per
Road A direction (cadence sync, limb tuning, viewmodel readability).

**P1 — Walk-cycle to footstep cadence sync**. Two changes: (1)
`STEP_DISTANCE 3.0→1.875m` + `STEP_DISTANCE_SPRINT 4.5→2.75m` in
controller.ts. Calibrated to match the rig walk-cycle visual gait
math: walking gait freq 1.6 Hz × 2 heel-strikes per cycle = 3.2
steps/sec; at WALK_SPEED=6.0 m/s → 1.875m per step. Sprint gait 2.4
× 2 = 4.8 steps/sec at SPRINT 13.2 m/s → 2.75m per step. Pre-ABY
values made audio fire ~60% as often as the visible foot motion.
(2) Added `rig.stepCount` + `rig._lastStepPhase` infrastructure to
PlayerRig type. Phase-locked step counter increments per heel-strike
when 3P visible. Reserved for future precision use (footstep-dust-
at-feet, gait-locked breathing audio).

**P2 — Limb R2 refinements**. Calf profile: peak radius 0.075 →
0.082 (was reading too straight) + 2 intermediate points (0.078
upper, 0.072 post-peak) for smoother bulge curve. Bicep profile:
peak 0.075 → 0.082 + 2 intermediates (0.080 upper, 0.072 post-peak).
Deltoid top 0.070 → 0.072. Both limbs now have more pronounced
muscle definition.

**P3 — Per-item viewmodel 3P readability**. Added optional
`thirdPersonScale?: number` field to ItemDef (default 1.0).
viewModel.ts `swapEquippedMesh` applies `tpMesh.scale.multiplyScalar
(def.thirdPersonScale)` to the 3P hand-attach mesh ONLY — FP
viewmodel stays at original scale. Tagged 5 commonly-equipped items
that were reading too small at 3P distance: scrap_bar 1.4, canteen
1.3, machete 1.35, scrap_gun 1.35, bandage 1.5 (smallest/lightest
needed biggest boost).

**Cross-session count**: 10 sessions of iteration discipline running.
9-session procedural-character pipeline (ABP→ABX) + ABY Road A
wrap-ups = full visual polish stack landed.

## Session ABX — 2026-05-25 — Player model texture pass (poncho dye stripes + skin weathering + pauldron rivets + leather bandolier) ✓ verify pass
`verified` — tsc clean. 1 file modified (`src/player/playerRig.ts`).
**Ninth session under iteration discipline**. 4 elements iterated.
User direction: "texture pass" applying procedural shader vocabulary
to rig elements for material variation + weathering. D107 zero-asset
preserved throughout.

**P1 — Poncho dye stripes (1 round)**. Added per-vertex color
attribute to poncho geometry: 5 alternating tonal bands bucketed by
theta (even=warm-darker 0.93/0.91/0.86, odd=cool-lighter 1.05/1.02/
0.97). Wear gradient per-vertex (+5% hem, -3% top). Cloned ponchoMat
with `vertexColors=true` so doesn't affect other fabric users
(bandana, hood, wraps). Reads as hand-dyed scavenger cloth.

**P2 — Skin tone weathering (1 round, 2 sub-fixes)**. Face skinMat
accent bumped `0x8a7048 → 0x6e4a26` (deeper sun-aged brown), sheen
`0.5 → 0.22` (matte/dry not oily). NEW `handSkinMat` separate
instance with grimier accent `0x4a3520` + slightly larger calluses
(`scaleSize 22.0`). All hand parts converted to handSkinMat: palm,
knuckle ridge, 4 fingers × 2 sides, knuckle bumps × 2 per finger,
thumbs. Face stays on original skinMat. Retired `SKIN_ACCENT` const
(replaced with per-region inline values).

**P3 — Pauldron weathering + rivets (1 round)**. Bumped
`pauldronPaintMat wearLevel 0.7 → 0.88` for more visible rust + paint
chipping. Added 4 rivets per plate (12 total): small
`SphereGeometry(0.006)` at plate corners, positioned via the plate's
z-tilt rotation transform so they sit on the outward face. Uses
`pauldronMetalMat`. Reads as scrap-bolted-together armor.

**P4 — Bandolier leather swap (1 round)**. `STRAP_COLOR 0x505050 →
0x4a3220` (dark metal grey → brown leather). `strapMat` switched from
`createMetalMaterial` → `createFabricMaterial(STRAP_COLOR, undefined,
{ disableShimmer: true })`. Matte leather look (no metal sheen).
Bandolier + odd-index pouches (which share strapMat) all now read
as worn brown leather. Reads as scavenger leather strap, not
industrial metal harness.

**Cross-session arc (9 sessions complete)**: ABP→ABW shipped the
procedural-character geometry + rigging + animation pipeline within
D107 zero-asset. ABX closes out the **material/texture variation**
side without breaking the zero-asset policy — all texture work was
shader-parameter tuning + procedural vertex colors, no GLB/PBR/UV
texture files. Full D-entry stack: D107 + D109 + D111 + D113 + D114
+ D115 + D116 + D117 + D118 + [implicit ABX patterns].

## Session ABW — 2026-05-25 — Multi-angle polish audit + cape clipping fix ✓ verify pass
`verified` — tsc clean. 1 file modified (`src/player/playerRig.ts`).
**Eighth session under iteration discipline**. User direction:
"another round of polish, screenshots from multiple angles, check for
weird/unrealistic — cape clipping through back. Texture pass deferred
to its own session." Focused single-bug fix per discipline.

**P1 — Multi-angle audit (verification only)**. Captured rig from
front, side, back angles in 3P over-shoulder camera. Confirmed user-
reported cape clipping. Verified other prior-session polish (ABS Lathe
body geometry, ABU deltoid bridges + knuckles + cloth folds, ABV sub-
pivot rigging) all reading correctly across angles — no secondary
issues surfaced.

**P2 — Cape clipping fix (1 round)**. Root cause: poncho top radius
was `TORSO_CHEST_R * 1.08 = 0.238m` but the ABS Lathe torso pectoral
swell is `TORSO_CHEST_R * 1.18 = 0.260m`. Chest geometry was wider
than poncho top — body poked through the cloth at the front V cut +
shoulder area. Fix: bumped `ponchoR_top * 1.08 → 1.32` (0.238 →
0.290m, gives 3cm clearance over pectoral swell). Hem flare `1.6 →
1.75` proportionally so the drape shape stays natural. Verified
across front, side, back: body fully contained inside poncho, cape
silhouette reads as proper draped cloth.

**Deferred to ABX (per user direction)**: player model texture pass.
This is its own substantial focused session — the procedural shader
vocabulary (ABH metalMaterial/paintMaterial/skinMaterial + ABJ
woodGrainMaterial/boneMaterial/glassMaterial + ABU fabricMaterial
with disableShimmer + cloth-drape D117) gives texture tools; ABX
applies them to specific rig elements (poncho weave, skin tone
variation, metal pauldron weathering, leather strap detail).

## Session ABV — 2026-05-25 — Rig sub-pivots (wrist + ankle + spine bend) + hood drape D117 ✓ verify pass
`verified` — tsc clean. 1 file modified (`src/player/playerRig.ts`).
**Seventh session under iteration discipline**. 2 elements iterated.
**Major rigging milestone**: the procedural character now has full
sub-pivot rig hierarchy on par with low-poly stylized 3rd-person-game
character rigging. D118.

**P1 — Rig sub-pivots + animation (1 round + verification)**.
**Hierarchy additions** to `PlayerRig` type: `wrists[2]` (between
elbow and hand), `ankles[2]` (between knee and foot), `spineBend`
(between body and upper-body children). Re-parented upper-body
visuals (torso, headGroup, poncho, bandolier+pouches, pauldron,
shoulders) onto spineBend; legs stay on body so leg pivots aren't
affected by spine sway. Moved the 0.04-rad forward-lean from
`body.rotation.x` to `spineBend.rotation.x` so legs stay vertical.
**Animation tick wiring**:
- Ankle heel-toe roll: `cos(legPhase) > 0 ? × 0.30 : × 0.45` —
  toes UP (dorsiflexion) at heel-strike, toes DOWN (plantarflexion)
  at toe-off. More aggressive on push-off (real gait).
- Wrist hang + roll: `-0.10 + swing × 0.15` — base relaxed hang,
  subtle roll opposite arm swing.
- Spine sway: Z-axis `-sin(phase) × 0.05` — gentle lateral sway
  opposite hip lift.
- Spine lean: X-axis 0.16 running / 0.05 walking — replaces old
  whole-body lean (now upper-body only).
Verified at phase=π: left ankle -0.45 (toe-off plantarflexed),
right ankle +0.30 (heel-strike dorsiflexed). Idle pose: feet flat,
arms hang naturally with wrist-hang, spine lean preserved.

**P2 — Hood drape D117 cloth folds (1 round)**. Applied the D117
cloth-drape pattern to hood-back-cylinder. Subdivided 14×1 → 18×8.
HOOD_FOLD_WAVES=4 (fewer than poncho's 6 for smaller mesh),
HOOD_AMP_HEM=1.2cm, HOOD_AMP_TOP=0.3cm (scaled for head dimensions).
Folds subtle but consistent with poncho fold pattern across outfit.

**D118 added** — Procedural rigging sub-pivot architecture. Codifies
the wrist/ankle/spineBend hierarchy + the animation drive formulas
(ankle plantarflexion-asymmetric, wrist swing-lerp, spine sway
opposite hip-lift). Pattern composes with any humanoid procedural
rig that wants animation parity with low-poly stylized 3P games.

**Achievement unlocked**: 7 sessions of continuous iteration
discipline (ABP→ABQ→ABR→ABS→ABT→ABU→ABV) have taken the procedural
rig from "blocky scavenger figure" to "low-poly stylized 3rd-person-
game character with organic body geometry + draped cloth + sub-pivot
rig hierarchy + animation cycles" — all within D107 zero-asset.

**Deferred to ABW (queued lower-priority polish)**:
- Bandolier strap detail (leather wear)
- Walk-cycle to footstep cadence sync (ABR backlog)
- Per-item viewmodel readability at 3P (ABR backlog)

## Session ABU — 2026-05-25 — Realistic cloth drape + body polish (deltoid bridge + neck cap + finger knuckles) ✓ verify pass
`verified` — tsc clean. 1 file modified (`src/player/playerRig.ts`).
**Sixth session under iteration discipline**. 2 elements fully iterated;
P3 rig sub-pivots deferred to ABV (different kind of work — code +
animation tick, deserves own session).

**P1 — Realistic cloth drape (2 rounds)**. Poncho `CylinderGeometry`
subdivided from 16×1 segments to 24 radial × 10 height (240 verts
before open-side cut). Walked the position attribute and applied
per-vertex sine-wave radial offsets:
`foldOffset = sin(WAVES × θ) × amplitude(t)` where amplitude
attenuates from hem (deepest) to top (gentle). R1: WAVES=5, hem 2.2cm
top 0.5cm — too subtle. R2: WAVES=6, hem 4.5cm top 0.8cm — clear
vertical fold ridges + scalloped wavy hem. `computeVertexNormals()`
after displacement so lighting catches ridge highlights + valley
shadows. Poncho went from "plastic tube" to "wrapped fabric with
drape folds". D117.

**P2 — Body polish refinements (1 round, 3 fixes)**. (a) Neck cap
blend: added 3 intermediate points to torsoProfile (0.025 / 0.055 /
0.085) so the lathe rolls smoothly from cap (r=0) to neck-base
(r=0.110). Eliminates the visible lip at the very top. (b) Deltoid
bridge spheres: NEW `SphereGeometry(0.085)` per shoulder, scaled
(1.0, 0.75, 1.0), positioned at shoulderPivot. Bridges the visible
arm-to-torso gap that the bare upper-arm cap-cylinder created. (c)
Finger knuckle bumps: 2 small `SphereGeometry(0.011)` per finger at
1/3 and 2/3 marks along the finger forward direction (computed from
the cylinder's rotation). Reads as joint articulation, not smooth
tubes.

**D117 added** — Procedural cloth drape via subdivided geometry +
per-vertex sine-wave radial offsets. Codifies the per-vertex
displacement pattern (walk position attribute, compute polar coords
from XZ, apply sin-wave offset modulated by height, recompute normals).
Pattern composes with any roughly-cylindrical procedural mesh that
should read as cloth (banner, flag, curtain, sail, robe).

**Deferred to ABV (P3 sub-pivots)**: wrist + ankle + spine bend
hierarchy + animation tick wiring. Code-heavier than geometry
iteration; merits its own focused session.

## Session ABT — 2026-05-25 — Over-shoulder camera + feet-on-ground bug fix + head Lathe geometry ✓ verify pass
`verified` — tsc clean. 2 files modified (`src/player/controller.ts` +
`src/player/playerRig.ts`). **Fifth session under iteration
discipline**. User flagged 3 issues post-ABS: "model still needs much
more polish", "camera in weird position way above the player, should be
closer behind over-the-shoulder like most 3p games", "legs/feet are
under the sand". 3 substantive fixes shipped. D116.

**P1 — Over-the-shoulder camera (1 round)**. Pre-ABT: 3.2m back +
1.8m above + no lateral offset. Read as "way above player". Rewrote
`syncCameraToBody` in controller.ts: new constants `_3P_BACK_DIST=1.8`
(was 3.2), `_3P_ABOVE_DIST=0.30` (was 1.8), NEW `_3P_LATERAL_OFFSET=
0.40` (over right shoulder), NEW `_3P_SHOULDER_DROP=0.25` (shoulder
is below eye). Camera now targets a `shoulderAnchor` (eye - drop +
lateral) rather than head, and pulls back from there. Reads as
modern TLOU/GoW over-the-shoulder cam — player fills right side of
frame, camera at shoulder height, tight 1.8m distance. Spring-arm
collision raycasts updated to fire from shoulderAnchor not headPos.

**P2 — Feet on ground bug fix (1 round)**. `rig.group.position.y` was
`tr.y - eyeOffset - 0.5` — a magic number (`0.5`) that didn't match
actual capsule halfHeight + radius. Result: feet ended up under the
sand. Fixed by querying `terrain.heightAt(tr.x, tr.z)` directly and
planting `rig.group.position.y = terrainY` so the feet sit ON the
sand exactly. Foot IK helper still does per-foot variation on top.
Verified visually — feet/toes clearly on terrain surface, not buried.

**P5 — Real head geometry (1 round)**. Pre-ABT: `SphereGeometry`
scaled (1.0, 1.15, 0.95) + `BoxGeometry` flat plane for jaw. Read as
"egg with cartoon mouth board". Replaced with `LatheGeometry` from
11-point profile: crown cap → cranium top → cranium widest (temple)
→ brow ridge → cheek mid → cheek taper → jaw line → CHIN POINT →
under-chin → cap bottom. 18 radial segments. DoubleSide per D115.
Ears repositioned slightly forward + raised. Reads as real human
skull silhouette with cheekbones + jaw + chin contours.

**Deferred to ABU**:
- More body model polish — shoulder-arm transition smoothness, neck
  cap blend, hand-wrist joint, finger knuckle inflections.
- Realistic cloth drape (subdivided poncho with weight folds) — own
  substantial focused element.
- Rig sub-pivots (wrist, ankle, spine bend + animation tick wiring).

**D116 added** — Over-the-shoulder camera convention (close behind +
shoulder-anchor target + lateral offset). Codifies the constants +
the shoulder-anchor pattern for future camera modes (debug-cam,
photo-mode, replay-cam).

## Session ABS — 2026-05-25 — Body geometry realism push (Lathe torso + Lathe limbs + tapered fingers) ✓ verify pass
`verified` — tsc clean. 1 file modified (`src/player/playerRig.ts`).
**Fourth session under iteration discipline**. User direction: "push
toward real video game quality model + rigging, not just blocky figures
and cylinders". 3 elements fully iterated per discipline; 3 elements
explicitly deferred to ABT to preserve depth-over-breadth. Major
quality threshold crossed — rig now reads as a recognizable human
figure within D107 zero-asset policy. D115.

**P1 — Torso: organic Lathe profile (4 rounds)**. Replaced 4-piece
composite (2 cylinders + 2 sphere caps = "cans stacked" silhouette)
with single LatheGeometry from a hand-crafted profile curve. R1: 9
profile points, found open top/bottom + interior-visible-through-
poncho. R2: added radius=0 endpoints to close mesh. R3: switched to
DoubleSide material so back-interior renders when seen through poncho
V cut. R4: refined contours to 14 points — pectoral swell 1.18×
chest-r (was 1.08), sharper ribcage taper, flared hip 1.35× waist-r,
smoother neck-base transition. 24 radial segments. Front view: real
body (chest swell + narrow waist + rounded hip dome through poncho V).
Back view: strong shoulder-narrow-waist-hip silhouette.

**P2 — Limbs: tapered Lathe profiles (1 round, shipped clean)**. All
4 limb meshes converted from uniform CylinderGeometry to tapered
LatheGeometry. Upper leg: cap → hip 0.095 → quad peak 0.105 → mid
0.088 → lower 0.068 → knee 0.058 → cap (7 points). Lower leg: cap →
knee 0.058 → upper calf 0.068 → CALF MUSCLE PEAK 0.075 → mid 0.06 →
lower 0.045 → ankle 0.04 → cap (8 points). Upper arm: deltoid 0.07 →
bicep peak 0.075 → taper 0.06 → elbow 0.046 (6 points). Forearm:
elbow 0.046 → forearm bulk 0.054 → wrist 0.034 (6 points). 14-16
radial segments. DoubleSide cloned materials. Reads as muscle
silhouette vs uniform tubes.

**P3 — Hands: tapered cylinder fingers (1 round)**. Palm: 0.07x0.06x
0.04 BoxGeometry → 0.078x0.028x0.062 (wider, thinner, deeper proper
hand proportions) + 0.075x0.022x0.022 knuckle ridge box at finger-
attach line. 4 fingers: single boxes → tapered CylinderGeometry
(0.0075 tip → 0.010 base, 8 segments, lengths 0.050-0.062 with
middle finger longest). Thumb: tapered cylinder, angled outward
(-0.7 z-rot) + forward tilt (PI/2 - 0.5 x-rot). All skinMat. Hands
now read as hands at FP/close-3P range, not box stacks.

**Deferred to ABT (per discipline — better as own focused sessions)**:
- P4 Real head geometry (face contours + jaw line; currently scaled
  sphere + flat box jaw)
- P5 Realistic cloth drape (subdivided poncho with weight folds)
- P6 Rig sub-pivots (wrist, ankle, spine bend — requires hierarchy +
  animation tick updates)

**D115 added** — LatheGeometry as the canonical organic-body-shape
primitive (vs BoxGeometry/CylinderGeometry). Friction-1: documents
the pattern for future creatures, NPCs, etc.

## Session ABR — 2026-05-25 — ABP+ABQ verification pass + 3P camera teleport snap wiring ✓ verify pass
`verified` — tsc clean. 2 files modified (`src/world/speeder.ts` +
`src/persistence/save.ts`). **Second session under the iteration
discipline** — verification-focused rather than new-feature. 5 P-items
shipped, all verified per discipline cadence (build/screenshot/
critique/iterate as needed).

**P1 — Walk cycle in real motion (verified, no code change)**. 3
phases screenshotted: running phase=π/4 (mid-stride bent knee + opposite
arm swing + forward lean 0.16rad), running phase=π/2 (heel-strike: both
legs max-spread, both knees straight, max arm spread), walking phase=π/4
(gentler version, less lean/amplitude). ABQ D114 knee-bend fix landed
visually as intended; walk cycle reads correctly across phases for both
walking + running states. Kinematic body blocks continuous-motion
simulation through the eval harness, so paused-pose verification at
multiple phases substitutes — equally rigorous, given any single moment
must read correctly.

**P2 — 3P camera teleport snap wiring (3 callsites, code change)**.
ABP shipped `ctx.player.cameraSnapNextFrame` flag but only set it true
at boot. ABR wires it at 3 teleport callsites: `speeder.ts` mount
block (player parked at y=-2000), `speeder.ts` dismount block
(setTranslation to right-side spawn), `save.ts` load (setTranslation
to saved pos). Camera now snaps instantly across teleports instead of
lerping visibly across the world. Visual playtest of the 3P collision
itself deferred — already mechanically verified in ABP (Rapier
`world.castRay` returns hit; pushback applied), and live-walk-into-
wall test needs continuous motion the kinematic body blocks.

**P3 — Held items in 3P swap verification (verified, no code change)**.
Confirmed `swapEquippedMesh` (D113 dual-mesh) operates correctly:
scrap_bar slot (5 BoxGeometry meshes attached to `rightHandAttach`) →
slot 2 branch (3 meshes incl CylinderGeometry). Attach group has
correct world position (-20.06, 12.32, 0.21 on the rig's right hand).
NOTE: held items can be small/dark at 3P distance and blend with rig
from a few meters away — that's per-item viewmodel-readability polish
(scale + brightness for 3P context), not a swap-mechanism bug.

**P4 — FP viewmodel forearm wraps positioning (verified, no code change)**.
ABP's `viewModelHands.createForearmWraps()` already positions wraps
correctly: stacked grey/charcoal rings sit at the base of held items
(branch tested), READ as wrapping the wrist/forearm where the hand
grips, NOT floating in space. Continuity with the 3P rig outfit
(same fabricMaterial + disableShimmer) reads cohesively. No offset
tuning needed.

**P5 — Pauldron polish R1 (verified baseline, no code change)**. 3-plate
stack (0.16/0.14/0.12m widths cascading down + outward tilted -0.3 to
-0.4rad) reads correctly as asymmetric scavenged scrap armor on right
shoulder. Already-reading-well baseline from ABP, MORE visible now
that ABQ shrank the poncho (was previously partially hidden by the
barrel poncho). Per discipline: don't iterate for the sake of iterating.

**Discipline net result**: 5 items verified in ~45 minutes. 2 items
required code changes (P2 snap wiring + the held-items NOTE which is
deferred). 3 items required only screenshot critique to certify
shipping-quality. Compare to the old failure mode (ABP) where all 5
items would have been shipped untested.

**Deferred to ABS (queued, lower priority)**:
- Per-item viewmodel readability at 3P distance (canteen / machete /
  scrap_gun / bandage all need 3P-context scale or brightness review)
- 3P camera collision real-playtest in actual moving game
- Walk-cycle to footstep audio cadence sync
- ABP Tier 5 cut items (aim twist-IK + footstep-dust-at-feet)

## Session ABQ — 2026-05-25 — ABP iterative polish (poncho geometry + bandolier wrap + walk cycle knee bug) ✓ verify pass
`verified` — tsc clean. 1 file modified (`src/player/playerRig.ts`).
**FIRST session run under the new iteration discipline** baked into the
framework after ABP playtest revealed shipped-but-shallow visual work.
Per `shared-memory/iterative-polish-discipline.md`: 3 elements fully
iterated > 6 shallowly. Per-element build → screenshot → critique →
iterate, NOT `tsc clean` as success gate.

**P3 — Poncho geometry (2 rounds, was the worst element from baseline)**.
Baseline read: a barrel covering 90% of body — arms, legs, bandolier,
pauldron all smothered. R1 shrunk to a shawl: top radius
`TORSO_CHEST_R * 1.25 → 1.08` (arms hang OUTSIDE the silhouette), hem
flare `TORSO_WAIST_R * 2.0 → 1.4`, height `TORSO_H * 1.4 → 0.85`
(shoulder to upper-hip, not mid-thigh), centered up 0.08m. R2: hem flare
`1.4 → 1.6` for visible drape. Verified front, back, side, 3/4 angles —
all read as wrapped-scavenger. Color `0xd9a85a` (pre-existing) reads
warm sun-bleached ochre in midday light now that geometry is right.

**P4 — Bandolier wrap (1 round)**. Pre-fix the strap was front-only
(3 waypoints all +Z) — invisible from back, half the wrap missing.
Converted to a 6-waypoint CLOSED Catmull-Rom loop wrapping over the
left shoulder + diagonal across chest + right hip + around right flank
+ diagonal across back + over back of left shoulder. TubeGeometry
`closed=true`, 36 segments × 8 radial, strap radius `0.018 → 0.020`.
Pouches respaced for front-half cluster. Back half is hidden BY THE
PONCHO at runtime (realistic — cross-body strap worn under cloth).

**P6 — Walk cycle knee bend (CRITICAL BUG, 1 round)**. Pre-fix formula
`max(0, sin(legPhase - π/3)) * 0.6` peaked knee bend at MID-STANCE
(weight-bearing leg — wrong; should be straight). New formula
`max(0, cos(legPhase)) * 0.65` peaks at legPhase=0/2π (mid-swing — foot
in air recovering forward). Verified at phase=π/4 + mirror phase=5π/4.
Amplitudes bumped for readability at 3P distance: hipAmp `0.40→0.48`
walking + `0.55→0.62` running; armAmp ratio `0.85→0.95`; hip sway
`0.012→0.020m`; body bob `0.035→0.045m` walking / `0.060→0.075m`
running. D114.

**Iteration discipline framework encoded (cross-session impact)**. Prior
session's deferred commit hint surfaced for user: shared-memory/
iterative-polish-discipline.md + README index + 3 SKILL.md updates
(session-start Step 7 / feature-slice plan template / session-end self-
check). Framework repo follows print-hints discipline always; commit
ran by user out-of-band.

**Deferred (queued for ABR)**:
- Pauldron polish — already reads well; not touched
- 3P camera collision in actual playtest (vs paused-screenshot harness)
- Held items in 3P (verify dual-mesh swap)
- FP viewmodel forearm-wraps positioning
- Walk-cycle to footstep cadence sync
- ABP Tier 5 cut (aim twist-IK + footstep-dust-at-feet)

## Session ABP — 2026-05-25 — 3P + player rig polish (research + rig overhaul + camera collision + held items in 3P + FP continuity) ✓ verify pass
`verified` — tsc clean. 5 files modified + 2 new + 2 research docs. 4 of
5 tiers shipped (Tier 5 stretch CUT per pre-committed cut order). The
dedicated polish session user requested after ABO playtest feedback.

**Tier 0 — Research (~1.5h)** — Two formal research docs via game-
researcher in parallel. NEW `docs/research/3p-cameras-in-games.md`
(6 sections, 8 sources): center-behind 3.2m/1.8m offsets, Rapier raycast
collision + 0.3m pushback, center-screen crosshair + camera direction,
dual-mesh held items, instant F-key snap preserving yaw, hard-follow
rig. NEW `docs/research/sci-fi-desert-scavenger-aesthetic.md` (5
sections, 7 sources): 10-layer geometry table with hex colors;
asymmetric pauldron as design rule; Cobb Vanth / Rey / Kay Vess refs.

**Tier 1 — Rig silhouette overhaul (~3-4h)** — Major rewrite of
`src/player/playerRig.ts` (~270 → ~470 LOC).
- **Better proportions**: tapered torso (chest 0.22r + waist 0.16r via
  2-cylinder composite + shoulder cap + hip dome), elongated head
  (sphere scaled 1.0/1.15/0.95) + flat jaw box + tiny ear bumps + real
  10cm neck cylinder, hands rewritten as palm + 4 finger boxes +
  thumb, feet as foot box + toe box, slight forward lean (0.04 rad).
- **Clothing layers** (mismatched-scavenger per research):
  - **Hood**: ConeGeometry + half-cylinder back drape; fabricMaterial
    desert tan 0xd2b48c
  - **Poncho**: tapered CylinderGeometry with thetaLength=1.7π for
    open side; fabricMaterial sun-bleached ochre 0xb8860b; flares
    at hem
  - **Bandolier strap**: TubeGeometry along Catmull-Rom curve from
    left shoulder → mid-chest sag → right hip; metalMaterial dark
  - **Bandolier pouches**: 4 BoxGeometry pieces along strap path;
    alternating paintMaterial rust + metal
  - **Right shoulder pauldron** (ASYMMETRIC per D111): 3 curved
    BoxGeometry plates layered + tilted outward
  - **Face bandana**: TorusGeometry around lower face
  - **Forearm wraps**: 2 fabric tori per elbow group
- **Knee + elbow sub-pivots** (NEW hierarchy) enable Tier 2 walk-
  cycle realism.
- All cloth uses `disableShimmer: true` per ABN; all skin uses
  `localSpace: true` per D109.

**Tier 2 — Animation realism (~2-3h, shipped inline with Tier 1)**
- **3-phase walk cycle**: 2 sin curves (hip + knee phase-shifted
  π/3). Knee flexes during forward swing, straightens for heel-
  strike. ±0.40 rad walking, ±0.55 rad running.
- **Arm + elbow bend**: opposite-phase to legs + elbow groups bend
  during forward swing.
- **Hip sway** (±1.2cm lateral) + **run lean** (0.16 rad torso) +
  **3.5cm walking / 6cm running body bob**.
- **Head counter-bob** — head Y inverse of body Y (×0.7) so head
  stays stable while body moves.
- **Crouching**: proper bent knees (0.85 rad) + lowered body.
- **FOOT IK to terrain** (user-prioritized): per-frame, each hip Y
  adjusted by `terrain.heightAt(footX, footZ) - rootY`, clamped to
  ±15cm. Only in walking/running states.

**Tier 3 — 3P camera polish (~2-3h)** —
`src/player/controller.ts:syncCameraToBody` rewritten.
- Offsets bumped to research recommendation: 3.2m back / 1.8m above.
- **Rapier raycast collision**: `world.castRay` from player head
  along inverse camera direction, filtered to exclude player body.
  Clamps camera to `hit.toi - 0.3m` pushback on collision.
- **Smoothed follow**: frame-rate-independent damp via
  `1 - exp(-10 * (1/60))` ≈ 0.155/frame lerp.
- **Snap-on-teleport** via new `ctx.player.cameraSnapNextFrame`
  flag (default true at boot, auto-clears).
- **3P-specific pitch clamp**: post-rotation guard limits Euler.x to
  [-π/4, π/3]. Prevents flip-overhead + stare-into-terrain.
- **Rig rotation: hard-follow** per research (rig rotation lag was
  CUT per scope-cut #6).

**Tier 4 — Held items in 3P + FP continuity (~2-3h)**
- `PlayerRig.rightHandAttach: THREE.Group` parented inside right
  elbow → hand chain.
- **Dual-mesh held items**: `swapEquippedMesh` now instances the
  item's `makeViewModel()` TWICE — once for FP viewmodel (camera-
  relative, depthTest off, no shadows) + once for 3P rig hand attach
  (world-space, shadows on). Both swap in lockstep on item change.
- **Visibility gate** in `updateViewModel`: `vm.group.visible =
  started && !dead && !thirdPerson`;
  `rig.rightHandAttach.visible = thirdPerson`.
- **NEW `src/player/viewModelHands.ts`**: `createForearmWraps` exports
  a forearm stub + 3 fabric wrap tori + palm bulge at viewmodel
  scale. Added to `vm.hands` group (now visible when item equipped).
  Color matches Tier 1 rig outfit. fabricMaterial with disableShimmer.

**Tier 5 — STRETCH: CUT** per pre-committed scope-cut #1.
Upper-body aim twist-IK + footstep-dust-at-feet deferred to ABQ.

**D-entries**: D111 (procedural clothing layering as primitive
composite, friction-2), D112 (3P camera = single-camera-with-offset
+ Rapier raycast collision per research, friction-2), D113 (dual-
mesh held items with mode-gated visibility, friction-2).

Verified: `npm run verify` clean. No save-schema changes — rig is
purely visual. Playtest deferred to user.

## Session ABO — 2026-05-25 — A3 rigged player + 3P camera + sandworm ambush + B6 engineBlock POC + 4 polish items ✓ verify pass
`verified` — tsc clean. 12 files (11 modified + 1 new) across 4 tiers
of 5 planned. Tier 5 (B1 generalized rope) CUT per pre-committed
scope-cut #1 — deferred to ABP. Long-overnight scope-cut-from-bottom
plan; 7 of 8 selected items shipped.

**Tier 1 — Polish foundation (4 items)**

- **C1 — Scavenger camp strip** (`src/world/poi.ts:placeScavengerCamp`):
  removed 8-stone fire ring + ash patch + bandage pickup (legacy
  iteration content per ABN triage); kept fuselage windbreak.
  `placeScavengerCamp` signature now returns `THREE.Group` (was
  `{ pickup, fuselage }`). 2 callers updated (refugee_caravan cluster
  + standalone 'camp' flagship dispatch). 9 stale SCAVENGER_CAMP_*
  Tuning constants struck (RING/STONE/ASH/BANDAGE families);
  FUSELAGE_* kept. Drops `spawnDroppedPickup` import.
- **C5 — Engine heat-shield back panel** (`src/world/engineBlock.ts:makeHeatShield`):
  `makeHeatShield` returns `THREE.Group` (was `THREE.Mesh`) with paired
  FRONT + BACK lathe shields offset 0.10m (rule 7). Back uses
  `_heatShieldBackMat` — BackSide clone of `_heatShieldMat` darkened
  to 0x3a1d10. Reads as real double-wall plate from oblique angles
  (was paper-thin in AAL).
- **C4 — Satellite dish framework + collision** (`src/world/satelliteDish.ts`):
  added 6 radial backing struts on the convex back side via
  `createMetalMaterial` (worn-iron) + central back hub cylinder.
  4 dish panel materials switched DoubleSide → FrontSide (the legacy
  AAL cheat is closed by the new struts covering the convex read).
  Compound collider on `dishPivot` via `attachAabbCollider` blocks
  walk-through-the-dish from the climbed-up tripod path.
- **C3 — Item viewmodel fidelity pass** (`src/inventory/items.ts`, 6 viewmodels
  rewritten): **cooked_cactus_pulp** (charred metalMaterial crust +
  pulp pocket + fiber strand); **cooked_lizard_meat** (3 stacked
  sliced-meat layers char/interior alternating + bone shard via
  `createBoneMaterial`); **cooked_worm_meat** (char-crusted slab +
  rendered fat exposed + 3 char-blister bumps); **fire_kit** (wood-grain
  sticks + flint chip OctahedronGeometry + metal-shader striker shard);
  **grill_kit** (metal-shader bars + cooked-residue rust bar + 3-link
  dangling chain); **locker_kit** (wood-grain body + metal band + 2
  hinges + latch + torus handle). Hard 1.5h cap respected; 8 worst
  viewmodels flagged in exploration, 6 shipped, 2 deferred. New
  `createBoneMaterial` import.

**Tier 2 — A3: rigged third-person player (full)**

- NEW `src/player/playerRig.ts` (~270 LOC) — procedural primitive rig
  (no GLB per D107). Hierarchy follows companion.ts AAE/AAZ pattern:
  root (yaw) → body (bob) → torso (capsule via cylinder + 2 sphere
  caps) + head (sphere + neck stub) + 2 hipPivots + 2 shoulderPivots.
  `createSkinMaterial` with `localSpace: true` (per D109 — moving entity).
- Hand-coded walk cycle: ±0.4 rad hip rotation @ 1.6 Hz (walking) or
  ±0.55 rad @ 2.4 Hz (running); arms swing opposite phase; ±3.5cm body
  bob at 2× gait freq. Idle: gentle breathing bob + arms hang slightly
  forward. Crouching: legs bent forward + body lowered 35cm.
- State machine (`'idle' | 'walking' | 'running' | 'crouching'`)
  derived per-frame from `ctx.player.body.linvel` magnitude +
  `ctx.player.crouching`.
- `GameContext.player.rig: PlayerRig | null` + `GameContext.flags.thirdPerson: boolean`.
  Rig built post-context-construction in `main.ts`; ticked AFTER
  `updateViewModel` so camera anchor is final.
- **F-key toggle** in `src/core/input.ts` (pause-gated, dead/!started
  ignored). Hides first-person viewmodel group on 3P, shows on FP.
- **3P camera** in `src/player/controller.ts:syncCameraToBody`: FP
  unchanged. 3P offsets camera 2.5m behind + 1.5m above the player
  head position using `cam.getWorldDirection` as the spring-arm
  direction. No spring-arm collision yet (camera can clip dunes —
  flagged as polish debt for ABP).
- Rig invisible at boot (FP default). Casts ground shadow when visible.

**Tier 3 — B3: sandworm ambush + dawn/dusk modifier**

- New `'ambush'` state in `SandWormState` union (now 9 values). New
  `enterAmbush(worm, ctx)` + `tickAmbush(worm, ctx, distToPlayer, playerTr)`.
- Ambush trigger from `tickPatrol`: when player within `ambushTriggerR=25m`
  + `noiseMult < 0.7` (still/walking; sprinting/mounted players don't
  trigger) + cooldown elapsed + 5% per-second probability fires,
  worm enters ambush instead of alert.
- Ambush behavior: worm freezes at current basePos, stays submerged
  + invisible, no audio cue, no telegraph. If player closes to within
  `AMBUSH_LUNGE_RADIUS=12m`, snap directly to `enterLunge` (skips
  alert + charging). If player retreats past `AMBUSH_CANCEL_RADIUS=40m`,
  return to patrol. Either path sets `_ambushCooldownUntil =
  ctx.time.elapsed + 90s`.
- `_ambushCooldownUntil` field added to `SandWorm` interface;
  initialized in `spawnSandWorm`.
- **Dawn/dusk surfacing modifier** via new `twilightActivityMultiplier(ctx)`
  helper. When `ctx.time.dayTime` in `[0.18, 0.22]` (dawn) or
  `[0.78, 0.82]` (dusk) windows, returns 1.30; else 1.0. Applied to
  `tickPatrol`'s effective detection radius (`SANDWORM_DETECTION_RADIUS *
  playerNoiseMultiplier(ctx) * twilightMult`). Outside windows: no-op.
- Retreat-and-stalk loop deferred per pre-committed scope-cut #3
  (was a stretch within Tier 3; ambush + dawn/dusk are the
  high-value pieces).

**Tier 4 — B6: engineBlock POC migration to composite system**

- New `'flagship_engineBlock'` ProcgenWreckClass with FIXED recipe
  in `recipeFor`: cockpit + 2 hullSegment + engineModule + tailStub
  = 5 parts, ~9-13m, 3 panels.
- `panelKindPool` dispatch: `flagship_engineBlock` → `['engine_cluster']`
  only (preserves engineBlock's original engine_cluster loot palette).
- `salvageKind` dispatch: `flagship_engineBlock` → `'massive'` (rich-loot
  table, matches engineBlock's pre-ABO behavior).
- NEW exported `placeProcgenCompositeForFlagship(...)` wrapper. Calls
  `placeProcgenComposite` with `cls: 'flagship_engineBlock'` + `buryY:
  1.0` for the tipped-into-dune feel + attaches the `'engine_block'`
  journal at a wreck-local offset post-assembly.
- `src/world/poi.ts` engine_block dispatch case: replaces
  `placeEngineBlock(...)` call with `placeProcgenCompositeForFlagship(...)`.
  `placeEngineBlock` import commented out (one-line revert path
  preserved); `engineBlock.ts` module kept on disk.
- POC validates the migration shape WITHOUT committing to migrate all
  5 flagships. If silhouette reads wrong in playtest: revert one
  import + one dispatch line to restore hand-modeled engineBlock.

**Tier 5 — B1 generalized rope: CUT per scope-cut #1 (top of cut list)**

Deferred to session ABP. B7 (ABM dropped-item physics) already
shipped the data-side dependency; B1's UX path + Tether→Endpoint
refactor + save migration is the remaining ~4-5h. Pre-committed in
the plan as the first cut so an overnight overrun doesn't risk
shipping a half-finished save-schema change.

**Item viewmodel pass remainder**: 2 of 8 worst-flagged items
deferred (cactus_pulp raw, raw_lizard_meat — already shipped or
mid-tier complexity). Future viewmodel sessions can sweep ~19
remaining ItemDefs.

Verified: tsc clean across all tiers. No save-schema changes; v11
saves load unchanged. Boot tested via tsc only — playtest validation
deferred to user (multi-seed boot + F-key 3P toggle + force-ambush
console eval + engine_block POI inspection).
**D110** captures the 3P camera architecture decision.

## Session ABN — 2026-05-24 — Procgen wreck family + megaWreck bow shell + shader-crawl bug fixes ✓ verify pass
`verified` — tsc clean. 10 files touched across 3 thematic commits.
Picked smaller-than-overnight scope post-context-compaction; shipped 3
contained items + 1 triage pass instead of a single big-ticket. D109
captures the procedural-shader localSpace pattern.

**B6 — 5th procgen wreck class (`bulk_hauler`)** (`src/world/procgenWreck.ts`)
- New `ProcgenWreckClass = 'bulk_hauler'`. Recipe: 1 cockpit + 4-5
  hullSegment + 1 engineModule + 1 tailStub = 7-8 parts, ~14-21m
  (longest silhouette in the procgen pool — reads as freight train /
  cargo hauler with extra hull where freighter would have engines).
- 3-4 salvage panels (richest loot density of any procgen class).
- Salvage palette: `'cargo_container'` (lottery loot mix).
- Class roulette 4-way → 5-way: 35/20/18/12/15 (corvette / gunship /
  freighter / science_vessel / bulk_hauler). Pre-ABN split was
  40/25/20/15 (ABJ).
- Cargo-heavy flavor lands naturally via existing biome bias (salt →
  PLATED, dune → FUEL_BARRELS) given the high hullSegment count;
  didn't need to thread a per-class variant bias.

**megaWreck bow hull-shell** (`src/world/megaWreck.ts`)
- Closes the ABL deferred item (aft-only shell). Half-cylinder
  (CylinderGeometry with `thetaStart=0, thetaLength=π`) caps the
  upper portion of the bow's box silhouette; OPEN UNDERSIDE preserves
  visual access to the -X side entrance (entrance top at Y=4m sits at
  the shell's open bottom edge, so the player still walks into a
  clean doorway).
- Same ellipsoidal flatten (1.0, 0.62, 1.0) as the aft shell so bow +
  aft read as one continuous silhouette family despite the very
  different scales (BOW_HALF_W ~9m vs AFT_HALF_W ~20m).
- Attached to `bowGroup` so it tracks the bow's terrain Y-offset (the
  bow rides several meters lower than aft on tilted seeds).
- No collider (`userData.noCollider = true` matches aft pattern).

**3 bug fixes shipped from `/triage-ideas` user dump**

**(1) Companion stale-target on speeder mount** (`src/enemies/companion.ts`)
- Companion's `updateCompanion` was reading
  `ctx.player.body.body.translation()` directly. When player mounts
  the speeder the capsule parks at Y=-2000 (CC-4) but X/Z freeze at
  the mount position → companion follows the mount-position stale
  target, not the moving speeder.
- New `getPlayerPos(ctx)` helper local to companion.ts mirrors
  sandWorm.ts's pattern (`if (ctx.speeder?.mounted) tr =
  ctx.speeder.body.translation()`). Companion now follows the speeder
  in real time.
- Helper duplicated rather than lifted to util (only 2 consumers; if
  a 3rd arrives, lift to `src/util/playerPos.ts`).

**(2) Procedural shaders crawl on moving entities** (`src/world/skinMaterial.ts`, `paintMaterial.ts`)
- D109. ABH's shader vocabulary samples noise in WORLD coords via
  `(modelMatrix * vec4(position, 1.0)).xyz`. Static surfaces benefit
  (adjacent walls get coherent world-aligned weathering). MOVING
  entities (creatures, vehicle) see the texture detail crawl across
  the surface as the body translates.
- Added `opts.localSpace?: boolean` to both factories. When true,
  varying is set to `position` (object-local). Branch is at the
  shader-string assembly level; zero runtime cost.
- Applied to companion (skin × 2), speeder hull (paint × 2), sandworm
  body (skin × 2), lizard body (skin × 2). All callers cite ABN +
  D109 in comments.
- Static callers (locker, rock scatter, well rim, megaWreck panels)
  unchanged — keep coherent world-space weathering.

**(3) Cloth + bandage viewmodels expand during movement** (`src/world/fabricMaterial.ts`, `src/inventory/items.ts`)
- ABE's wind-shimmer vertex displacement keys off
  `(modelMatrix * vec4(position, 1.0)).xyz`. For viewmodel meshes
  (camera-relative) the "world" position is the CAMERA's path, so the
  shimmer animates against player movement → cloth/bandage appear to
  breathe.
- Added `opts.disableShimmer?: boolean` (3rd positional arg —
  preserves the existing `side?` second arg for tent + largeTent
  callers). When true: skips the vertex displacement AND the
  `_shaderRefs.add()` registration (no per-frame uniform-tick cost),
  and switches the fragment-shader noise to object-local sampling
  (`vWorldFabric = position`).
- Applied to bandage viewmodel (2 fabric materials) + cloth
  viewmodel (3 fabric materials). World fabric (tents, tarps) keeps
  shimmer on — the storm-intensity-keyed billow is the point.

**Triage** (`docs/backlog.md`): 4 entries from `/triage-ideas` dump.
3 of 4 shipped this session; 1 deferred (stale fire+cloth POI — code-
only inspection couldn't pinpoint; needs user identification).

**Procgen / shader stats**:
- `bulk_hauler` adds a 5th class to the procgen pool; combined with
  ABJ's `science_vessel` the pool is now ~2× the ABC-era 3-class set.
- `localSpace` opt now in 2 of the 7 procedural shader factories
  (skin + paint). When future factories add MOVING-entity surfaces
  (creature variants, more vehicles), follow the same pattern.

Commits: `efab6df` (3 bug fixes) → `353f69b` (B6 + bow shell) →
`ab86e0d` (triage + brief archive). Plus this session-end commit.

## Session ABM — 2026-05-24 — B7 dropped-item rigid-body physics ✓ verify pass
`verified` — tsc clean. 6 files touched. Closes the B7 backlog item;
B8 (generalized rope) cut per pre-committed scope-cut tier 3 — UX
needs more thought; carry-forward to ABN.

- **Pickup gains optional Rapier dynamic body** — cuboid collider sized
  to mesh AABB, linear damping 0.6 / angular 0.8 / friction 0.85 /
  restitution 0.15 / density 0.6. Settles cleanly on dunes without
  jitter; Rapier auto-sleeps once at rest.
- **spawnDroppedPickup gains opts arg** — `{ world?, initialVel?,
  yOverride? }`. When `world` is provided, body is created + spawn
  Y bumped +0.6m so items fall + settle (tossed-from-inventory
  feel). When omitted, original static-mesh behavior preserved.
- **Callers updated**: player drop (inventory.ts), craft overflow
  drops (craftingMenu.ts × 2), pickup-swap drop (interaction.ts) all
  thread `world`. Seed-spawn callers (spawnBranches, scavenger-camp
  bandage) stay static (140+ branches at boot would burn Rapier
  step budget; deterministic placement doesn't need physics).
- **Per-frame sync** via `updatePickups(ctx)` in main.ts tick after
  physics.step. Copies body.translation + rotation → mesh.position +
  quaternion. Skips pickups without a body (cheap branch).
- **despawnPickup** removes the body from Rapier world when present
  (no leak on take).
- **Save schema v11 additive** (no version bump per D108):
  `droppedPickups?: Array<{ itemId, pos, quat, meta? }>` serializes
  only physics-bodied pickups. On load, respawn each with body +
  override rotation/velocity to settled state. Pre-ABM saves arrive
  without the field → empty list (acceptable migration limit).

Verified: tsc clean, seed 7777 boot (75 panels, 5 shelter zones, no
regression), drop+save+reload round-trip preserves position exactly
(verified -67.31, 8.81, 11.31 before save = same after reload).

**B8 carry-forward**: generalized rope attachment needs new UX path
(no rope-stub mesh on pickups), gameplay decisions (can a piece of
cloth pull a sled?), and bigger data-model refactor than ABL's 3h
estimate captured. Re-scoped in backlog for ABN.

## Session ABL — 2026-05-24 — megaWreck visual rebuild ✓ verify pass
`verified` — tsc clean. 1 file (megaWreck.ts, +166/-22). Closes the
"megaWreck rebuild" backlog item (BB-2/BB-3 era model was visually
behind the rest of the world post-OO procedural shaders). Edit-in-
place refactor — preserved existing collider layout + all 8 salvage
panels + shelter zone + journal location for zero gameplay impact;
pure visual lift.

- **Procedural shader vocab applied to all hull materials**:
  _hullMat + _hullDarkMat → createRustedHullMaterial (drip streaks
  + worn highlights); _rustMat → createPaintedMetalMaterial (paint
  chips reveal rust); _rustDarkMat / _pipeMat / _nozzleRimMat /
  _antennaMat → createMetalMaterial (brushed scratches + grain).
  Same WRECK_* color palette so faction reads stay identical.
- **Tapered aft-section hull shell** (CylinderGeometry rotated
  axis=Z, ellipsoidally scaled to fit wider-than-tall aft body).
  Drapes OVER the existing box-wall structure — breaks up the
  stack-of-boxes silhouette. Slightly flared at rear for crash
  deformation feel. No collider.
- **6 rust band wraps** (TorusGeometry, ellipsoidally scaled to
  match hull cross-section): 4 around aft + 2 around bow.
- **Hull-break decoration**: 3 exposed vertical ribs + 5 torn
  hull-plate fragments at random tilts in the mid-hull break zone
  (Z=-25 to -10). Reads as "internal beams exposed where the skin
  peeled away on impact."

Verified: tsc clean. Multi-seed boot + visual screenshots confirm
curved shell + tower + spire + engine bells + ribs all read cleanly
from multiple angles. No collider changes — gameplay path unchanged.

## Session ABK-tail — 2026-05-24 — Post-ship perf pass + bugfixes ✓ verify pass
`verified` — tsc clean. 4 commits between ABK session-end and ABL
session-start, all direct-paste (no /session-end between). Catch-up
documented per the doc-drift guardrail (D2 from ABJ).

- **`76413b6` perf: pre-warm shaders + pool panel glows + Lambert downgrade.**
  Three quick wins eliminating the click-NEW-GAME freeze.
  `renderer.compile(scene, camera)` at boot pre-compiles 38 game-
  scene shader programs (was 5 at title; first game frame would
  cold-compile 16 programs → multi-second stall). Salvage panel
  cavity glows refactored to claim/release from the shared
  lightPool (pool bumped 24 → 30); scene PointLight count drops
  96 → 31 (-65 always-evaluated lights → ~3× cheaper fragment
  shader for every lit material). MeshStandardMaterial → Lambert
  on pickups.ts (215 instances; PBR overhead eliminated; visually
  identical at our flat-shaded scale).
- **`7f2cbc1` perf: throttled shadow updates + smaller shadow map + Rapier pre-warm.**
  `renderer.shadowMap.autoUpdate=false` + manual needsUpdate every
  6 frames (~10Hz instead of 144Hz; sun moves 0.5°/sec so stale
  shadows are imperceptible). Settings preset 2048 → 1024 for
  medium (default), 1024 → 512 for low; high preserves 2048 for
  opt-in. Rapier pre-warm with one synchronous physics.step() at
  boot eliminates first-tick collision-acceleration-structure
  stutter. Combined with ABK-tail commit above: scene PointLights
  96 → 31, StandardMaterials 215 → 0, shadow fill ~24× cheaper
  (4× map size × 6× cadence), click→game frame seconds → 14ms.
- **`52dcb7d` fix: starter inventory machete → scrap_bar.** Player
  starts with scrap_bar (slot 0) + canteen (slot 1) instead of
  machete + canteen. After AAR's salvage-pry overhaul, scrap is
  gated behind salvage panels and panels require a scrap_bar to
  pry — making a new game unable to acquire scrap (= unable to
  craft anything that needs scrap). Trade-off: player starts
  unarmed for melee, must craft pipe_staff for combat (early-
  game survival pressure).
- **`f1a8bba` fix: don't acquire pointer lock in hidden/0-size preview tabs.**
  Developer-cursor-stuck-in-invisible-top-left-box bug. When
  `preview_eval` programmatically clicked NEW GAME, `handoffToGame()`
  acquired PointerLock on the hidden 0×0 game canvas at screen
  (0, 0), pinning the OS cursor there until alt-tab. Fix: in DEV
  mode skip `controls.lock()` when `document.hidden` OR canvas
  size is 0×0. Defensive `document.exitPointerLock()` at boot to
  release any stale lock leaked from prior preview-tool sessions.
  Real-user gameplay unchanged.

## Session ABK — 2026-05-24 — Complete biome-specific POI family (salt + rocky) ✓ verify pass
`verified` — tsc clean. 5 files (2 new modules). Closes the biome-POI
family ABJ A4 started (dune buried cockpit shipped ABJ; ABK adds the
remaining 2). Multi-seed boot verified.

- **`src/world/saltOutpost.ts`** (new, ~165 LOC) — `placeSaltOutpost`
  + `sampleSaltOutpostPositions`. Half-buried concrete base
  (createStoneMaterial weathered) + 4.5m antenna spire
  (createMetalMaterial rust-mottled) + angled dish + 2-3 corroded
  sample crates (createPaintedMetal wearLevel 0.75) + 1
  `cargo_container` salvage panel + 2-3 debris fragments. Placement
  via findBiomeCentroid('salt') with greedy multi-region exclusion.
- **`src/world/rockyEntrance.ts`** (new, ~210 LOC) — `placeRockyEntrance`
  + `sampleRockyEntrancePositions`. Surface: 6-8 lumpy stone
  boulders forming a hill. Cave-mouth arch (verticals + lintel) on
  +Z face. 4 descending stairs (~0.5m drop each) into a sunken
  4×2.5×3m interior chamber. BackSide stone walls per ABG cavity-
  pattern so player INSIDE sees the cavity. Solid floor. 1
  `escape_pod` salvage panel on the back wall. addShelterZone for
  the chamber interior (full enclosure — third sheltered POI
  alongside tents + flagship interiors).
- **Wire-up**: `Tuning.SALT_OUTPOST_COUNT=1`,
  `Tuning.ROCKY_ENTRANCE_COUNT=1`. Dispatch in `poi.ts` goes
  dune→salt→rocky so earlier POIs join the exclusion list, spreading
  across separate biome regions.

Verified: multi-seed boot at 12345 (69 panels, 5 shelter zones) + 7777
(70 panels, 5 shelter zones). 22-23 shader programs compile cleanly.

## Session ABJ — 2026-05-24 — Aggressive overnight bundle (14 items across 4 tiers) ✓ verify pass
`verified` — tsc clean across all 4 tier boundaries + save round-trip
verified (v10 → v11). 19 selected items, 14 shipped within 6h budget;
5 stretch items pre-committed and deferred per scope-cut tier.

**Tier 1 (foundation + low-risk wins, ~1.5h, 6 items)** — D108:

- **C1+C2+C12 combined v10→v11 schema bump** (D81 additive-only): adds
  3 optional fields in ONE migration. `bornInDevMode?: boolean` (DEV
  badge survives Continue), `inventory.journalReadKinds?:
  JournalKind[]` (per-kind read set; openJournalPanel marks the kind
  read, interaction.ts dims hover to "journal (read)" for read kinds),
  `companion.huddleState?: boolean` (storm-saved companion reloads
  into 'huddle' state; weather logic re-validates next tick). Pre-v11
  saves load with defaults.
- **B4 biome-bias on recipe pick** — `placeProcgenComposite` queries
  `biomes.biomeAt(pos.x, pos.z)` and threads to assembleWreck →
  pickPart → pickVariantBiased. HULL_SEGMENT_BIOME_WEIGHTS: salt →
  +30% PLATED_RECTANGULAR (corrosion plates), rocky → +20% OPEN_TRUSS,
  dune → +20% FUEL_BARRELS.
- **C13 RMB tutorial hint** — locker_kit + large_tent_kit HINTS extended.
- **C6 stamina tow factor tune** — STAMINA_TOW_FACTOR 2.0→1.5 (sprint
  duration when towing 3s→4s).
- **D1 scavenger-camp magic-number lift** — 12 hardcoded numbers in
  placeScavengerCamp lifted to Tuning.SCAVENGER_CAMP_*.
- **D2 doc-drift guardrail** — CLAUDE.md note: pause for /session-end
  after 3+ direct-paste commits.

**Tier 2 (shader vocabulary, ~2h, 3 new factories)**:

- **`src/world/woodGrainMaterial.ts`** (~165 LOC) — `createWoodGrainMaterial(color, opts)`. Anisotropic grain stripes along configurable axis + concentric growth rings (FBM-warped radial modulation) + micro-grain + sun-bleach weathering. Applied to sled deck/rails/runners + locker body+lid (4 callsites; pre-ABJ flat Lambert).
- **`src/world/boneMaterial.ts`** (~155 LOC) — `createBoneMaterial(color, opts)`. Cracked hairline network (dual-FBM AND threshold) + mineralization spots + age-bleach (world-Y gradient + FBM patchiness) + micro-grain. Applied to opening-wreck skeleton.
- **`src/world/glassMaterial.ts`** (~150 LOC) — `createGlassMaterial(color, opts)`. Frosted distortion (small-scale FBM brightness mod) + edge-rim highlights (fresnel via dot(world-normal, cameraPosition - fragPos)) + dust-layer on horizontal facets. Transparent + double-sided. Applied to dune cockpit's cracked window in Tier 4 (canteen + lantern globe deferred — no actual glass surface).

**Tier 3 (medium features, ~2h, 3 items)**:

- **B6 science_vessel wreck class** — 4th ProcgenWreckClass. Recipe: 1 cockpit + 2-3 hullSegment + 1 engine + 1 tail (5-7 parts, ~10-16m). Salvage palette 'fuselage'. Class roulette 40/25/20/15 (corvette/gunship/freighter/science_vessel).
- **B12 sandworm feeding behavior** — adds 'feeding' state (8th SandWormState). While patrolling, worm scans for meat pickups within FEED_DETECT_RADIUS=30m (raw/cooked lizard meat + raw/cooked worm meat + lizard-on-a-stick raw/cooked) and surfaces to feed. 3-phase animation (rise 20% → hold 60% → descend 20% of FEED_DURATION_S=4.5s); slow sway during hold; consume bait at t=0.85. `damageSandWorm` allows hits during 'feeding' at 2× damage. New _feedBaitPickupId field; new SFX playWormChomp.
- **B13 item viewmodel fidelity pass** (5 items within 1.5h cap): cloth (3 folds + tag via fabricMaterial), scrap (metalMaterial + 2 bolts + bent edge), branch (woodGrainMaterial + 2 offshoots), bandage (fabricMaterial × 3 + red cross), rope (woodGrainMaterial + concentric coil + fraying tail).

**Tier 4 (procgen world expansion, ~2h, 2 items)**:

- **B3 comm-relay cluster** — 3rd ClusterKind. Half-buried concrete base + 6m antenna spire + crossbar + red beacon + 3 guy-wires (TubeGeometry catmull) + 1 'engine_cluster' salvage panel + 2-3 radial dish reflectors at 8-12m + debris field.
- **A4 dune buried cockpit POI** — NEW `src/world/buriedCockpit.ts` (~225 LOC). 1 per dune-biome centroid via findBiomeCentroid + greedy multi-region exclusion. IcosahedronGeometry hull + canopy with cracked glass dome (createGlassMaterial) + 2-3 crack lines (TubeGeometry) + optional broken antenna + 28° forward tilt + 60% Y buried + 'escape_pod' salvage panel + 4-6 debris fragments. First biome-specific POI.

**Tier 5 stretch (DEFERRED per pre-committed cut order)**: A4 salt outpost, A4 rocky entrance, A5 megaWreck rebuild, B7 dropped-item rigid-body physics, B8 generalized rope attachment.

**Files**: 12 modified + 4 new modules (woodGrainMaterial, boneMaterial, glassMaterial, buriedCockpit). D108. SAVE_VERSION 10→11.

## Session ABI — 2026-05-24 — Salvage panel rim fix + 3 wreck relocations ✓ verify pass
`verified` — tsc clean. 1 file touched (`src/world/wrecks.ts`, +66/-16).
Two interconnected bugs surfaced by ABG's BackSide body fix:
- **Rim was opaque plate, not frame**: single solid BoxGeometry covering
  the full panel face area was occluding the cavity once ABG made the
  body's front face invisible. Rebuilt as 4 thin bars (top/bottom span
  full width, left/right inset). Outer silhouette unchanged.
- **3 procgen panels misplaced**: cargo_container z=d*0.30 overlapped
  the wreck's own "door decoration" (centered z=0, depth d*0.7). Moved
  to clear +Z face. Fuselage panel buried inside the cylinder volume —
  moved to flush side at midline. Escape pod panel inside icosahedron
  hull (dist 0.77r) — pushed out to ~1.05r. Verified visually via
  preview screenshots for all affected kinds.

## Session ABH — 2026-05-23 — Texture overhaul via procedural shader vocabulary ✓ verify pass
`verified` — tsc clean + `npx vite build` clean. 14 files touched, 4
new modules. Bundle impact +11KB (4 shader source files; zero asset
bytes — preserves D3 + extends it as D107). Adds 4 new procedural
material factories then applies them across the game's surfaces.

- **`src/world/metalMaterial.ts`** (new, ~159 LOC) — `createMetalMaterial(color, opts)`.
  Brushed scratches along configurable angle + worn-FBM highlights +
  per-pixel grain + sparse edge-dirt patches. Drop-in replacement for
  MeshLambertMaterial. Mirrors terrainMaterial.ts / fabricMaterial.ts
  onBeforeCompile pattern.
- **`src/world/paintMaterial.ts`** (new, ~143 LOC) — `createPaintedMetalMaterial(color, opts)`.
  Paint chips reveal rust substrate, faded paint gradient, vertical
  drip-streaks from chip locations.
- **`src/world/stoneMaterial.ts`** (new, ~156 LOC) — `createStoneMaterial(color, opts)`.
  Aggregate noise + 2-axis crack noise + dust accumulation gated on
  world-up normal (top-facing surfaces only) + sun-bleach.
- **`src/world/skinMaterial.ts`** (new, ~151 LOC) — `createSkinMaterial(color, opts)`.
  Scale-cell FBM threshold + pigment blotches + thin vein lines +
  sheen highlights.

**Applications**: weapons (scrap_bar, machete, pipe_staff, scrap_gun,
energy_pistol, scrap_bullet) → metal. Placeables (lantern iron, locker
bands, grill bars, speeder hull) → metal + painted. World (rockScatter
both tiers, well stones) → stone. Creatures (sandworm body, lizard,
companion carapace) → skin. All shaders sample world-space so different
instances get visibly different surface variation for free. D107.

## Session ABG — 2026-05-23 — Fix panel interior visibility + remove opening-wreck panels ✓ verify pass
`verified` — tsc clean. 2 files touched (`src/world/wrecks.ts`,
`src/world/openingWreck.ts`). Net -24 lines.

- **Panel interior bug**: salvage panels rendered as blank boxes when
  pried — body `BoxGeometry` was solid `FrontSide`, its front face
  occluded the 5 interior components + backplate that AAS shipped.
  Fix: render body's material with `side: BackSide` (front face
  invisible from outside, interior walls visible). `shadowSide:
  FrontSide` preserves normal shadow casting. Module-cached BackSide
  clone so all panels share one material. Verified in preview: red_wire
  + yellow_wire + scrap_chunk now visible inside opened procgen panel.
  D105.
- **Opening-wreck salvage panels removed**: D15 originally established
  the opening wreck as a non-salvageable story prop; Session RR + ABA
  P3 added 2 access panels there as part of the unified addAccessPanel
  migration. With the panel-interior bug fixed (panels visibly stripped
  on extract), they conflicted with the "this was someone's last
  shelter" tone. Reverted to D15. Other flagships keep their panels.

## Session ABF — 2026-05-23 — Overnight: POI narrative beats — 5 flagship journals ✓ verify pass
`verified` — tsc clean + production build clean. 11 files touched, 0
new modules. No save schema bump (journals re-spawn from flagship
placement, same as opening journal).

- **Journal system**: extended W-era Journal type with `kind: JournalKind`
  discriminator (`opening` | `mega_ship` | `mega_wreck` | `satellite_dish`
  | `crashed_hull` | `engine_block`). `placeJournal(scene, pos, yaw, kind?)`
  tags `mesh.userData.interactSubKind` so the interaction system routes
  by tag. `journalPanel.ts` rewritten to support `Map<JournalKind,
  JournalContent>` + `renderContent()` rebuilds on each open. D106.
- **5 flagship journals**, each with a distinct narrator voice + 4-6
  short entries. megaShip: cargo handler ("logged the manifest anyway").
  megaWreck: ship's captain Cmdr. K. Selene ("good crew. wrong orders").
  satelliteDish: radio operator WREN ("they are not coming"). crashedHull:
  veteran pilot ("a fine place to stop"). engineBlock: chief engineer
  ("two minutes from chamber breach").
- Each flagship module gained an optional `journals?: { list: Journal[] }`
  arg mirroring the `salvageables?` convention. `poi.ts` + `main.ts`
  thread `ctx.journals` through `placePOIs`.
- Anchors picked for thematic interiors: megaShip aft bay, megaWreck
  aft bay (dodged bowYOffset complexity), satelliteDish base chamber,
  crashedHull upper hull seam, engineBlock thrust frame top.

## Session ABE — 2026-05-23 — Overnight: 5-item polish bundle ✓ verify pass
`verified` — tsc clean. 11 files touched, +429/-18 lines. Scope-cut
list pre-populated in roadmap; all 5 P items shipped without cuts firing.

- **P1 — Tutorial HINTS** for `rope` + `sled_kit`. Closes the sled
  affordance gap (QQ-era stub vs deck distinction).
- **P2 — Wind shimmer shader on fabric** (`fabricMaterial.ts`,
  `main.ts`). Sin-driven normal displacement keyed to `weather.intensity`
  (0.5cm calm → 4cm storm peak). Mirrors terrainMaterial.ts _shaderRefs
  pattern. Ticked from main.ts each frame.
- **P3 — Scrap_gun R-key reload** (`combat.ts`, `audio.ts`, `main.ts`,
  `tutorial.ts`). Drains scrap_bullet stacks across the bag, refills
  `slot.meta.ammoRemaining` up to max. New `playReloadGun` SFX (clack
  + chamber tick). Closes AAN's `.no_ammo` crosshair loop.
- **P4 — Crafting recipe categorization** (`recipeDiscovery.ts`,
  `craftingMenu.ts`, `style.css`). New `Recipe.category: 'tool' | 'ammo'
  | 'shelter' | 'consumable'` field; sub-headers within CRAFTABLE /
  MISSING buckets. `CATEGORY_ORDER` + `CATEGORY_LABEL` exports. Display-
  only — no save persistence.
- **P5 — megaWreck ground-level panel** (`megaWreck.ts`). New panel
  between the engine bells on the back exterior at ~1.5m chest height.
  First-cut reachability fix; catwalk panels 3 + 4 (at ~11.5m) still
  need ground alternatives in a follow-on.

## Session ABD — 2026-05-23 — Procgen breach-patch frequency bump ✓ verify pass
`verified` — tsc clean. 1 file touched (`src/world/procgenWreck.ts`,
+8/-4). Data-driven playtest of ABC composite wrecks across 2 seeds
(12345, 7777) showed only 15% of hull parts had breach patches — too
low to sell "battle damage" feel. Bumped per-variant chances:
ribbed_cylinder 0.50 → 0.70, plated_rectangular 0.40 → 0.60. Post-tweak
sweep verified ~41% of eligible hulls now show breaches. Visual playtest
via preview_screenshot blocked (canvas 0×0 in hidden tab); pivoted to
mesh-signature inspection (open_truss + fuel_barrels variants confirmed
active across multiple seeds, class roulette splits to all 3 classes).
Memory note `dustfall_preview_gotchas.md` updated.

## Session ABC — 2026-05-23 — Procgen wreck expansion — variants + gunship + breach patches ✓ verify pass
`verified` — tsc clean. 3 files touched (procgenWreck.ts +226,
tuning.ts +5, no new modules). ABA P7 follow-on.

- **2 new hullSegment variants**: `OPEN_TRUSS` (gutted skeletal frame:
  4 longitudinal struts + 3 transverse beam rings + 1 diagonal
  cross-brace), `FUEL_BARRELS` (2-3 vertical tanks on a base plate,
  one with an open hatch). HullSegment variants: 3 → 5.
- **Breach-patch decoration helper** (`addBreachPatches`). Adds 1-2
  ragged dark-box patches on the +Z flank with slight random rotation.
  ≥10cm depth per CLAUDE.md rule 7. Wired into RIBBED_CYLINDER (50%
  chance) and PLATED_RECTANGULAR (40% chance, 1-2 patches). Tuned up
  in ABD.
- **Gunship recipe**: new `ProcgenWreckClass = 'gunship'`. 4-6 parts,
  GUARANTEED engine cluster (corvette is 70%). Maps to `engine_cluster`
  salvageKind (cabling+chip+bullet interior).
- **3-way class roulette**: 45% corvette / 30% gunship / 25% freighter.
- **Composite share bumped** `PROCGEN_COMPOSITE_SHARE: 0.35 → 0.50`
  now that the part vocabulary has variety.

## Session ABB — 2026-05-23 — ABA visual audit — fix 3 migrated panel positions ✓ verify pass
`verified` — tsc clean. 3 files touched (satelliteDish, crashedHull,
engineBlock), +28 lines. ABA P3 visual audit. The 4 migrated wrapper-
Group panels had wrapper positions that used arbitrary constants
(e.g. `BELL_RIM_R * 0.70`) instead of the actual hull/wall surface
radius at that lathe depth. Panels were floating in cavities or off the
dish back. Recomputed each panel position from the underlying lathe
profile so the body front face sits flush with the hull.

- **satelliteDish back-of-dish**: y=0 → `t²·DISH_DEPTH` (~0.65m for
  radius 4). Verified via preview screenshot — panel now flush with
  dish back.
- **crashedHull bell-throat**: r=THROAT*0.45 (~0.47m) → THROAT*1.37
  (~1.44m). ~1m correction; panel was floating inside the bell cavity.
- **engineBlock bell-wall**: r=RIM*0.70 (~1.31m) → RIM*0.85 (~1.59m).
  ~0.27m correction. openingWreck panels used `lookAt` against actual
  `profileRadiusAt` — already correct, no change needed.

## Session ABA — 2026-05-23 — Overnight: salvage cleanup + procgen wreck system ✓ verify pass
`verified` — tsc clean + production build clean. 7-item overnight bundle:
4 bug fixes + 2 architecture cleanups + 1 new system. 14 files touched, 2
new modules (`src/core/lightPool.ts`, `src/util/terrainAlign.ts`,
`src/world/procgenWreck.ts`). No save schema bump.

**P1 — Light-pool refactor** (`src/core/lightPool.ts`, new ~95 LOC). The
lantern-placement freeze (multi-hundred-ms hitch on every fire / lantern
deploy) traced to Three.js bumping its renderer's `lightsHash` whenever
the scene's light count changed → every lit material (terrain shader,
fabric shader, hulls, sand, tents, sand worm — ~30 unique materials in
view) recompiled. Fix: pre-allocate 24 PointLights at boot, parked
invisible (intensity=0, y=-10000). `claimLight` / `releaseLight` hand
out + return slots; scene light count never changes after boot. Fires +
lanterns guard the nullable light field (graceful pool-exhaustion
fallback). save.ts releases on the "clear before re-spawn" path so
Continue doesn't leak slots. lantern.ts also trimmed a blanket
`castShadow=true` traversal to receiveShadow-only on the rivets / cage
bars / hook torus.

**P2 — Salvage panel door open-direction bug**. The hinge in
addAccessPanel is at the panel's LEFT edge (body-local -X) following
real fuse-box convention; the door extends to body's +X with the
handle on the right. With Three.js's right-hand rule on +Y, a POSITIVE
Y rotation around that hinge axis swings the door's free edge from +X
toward -Z — INTO the hull. `updatePanelDoors` now applies the NEGATIVE
of `panelDoorAngle` to `hinge.rotation.y` so positive open-magnitude =
outward swing. State fields stay positive; convention documented at
both the application site and the geometry-definition site. D101.

**P3 — Legacy panel migration**. The 4 modules
satelliteDish / crashedHull / engineBlock / openingWreck each had
their own inline `make*AccessPanel` helper that built a simple
Box body + horizontal rim — WITHOUT the AAR hinged door + interior
detail components + AAU recess + AAS glow. Result: 8 legacy panels
(2 per module) were pry-able but the extract path found NO
`panelComponents` → force-stripped with no loot (latent bug,
confirmed via code-trace). All 8 callsites migrated to addAccessPanel
via a **wrapper-Group pattern**: the wrapper's local +Z encodes the
panel's outward direction, the wrapper's position is the hull surface,
addAccessPanel recesses the body INTO -Z. Each PanelKind picked
thematically (control-room 'fuselage', engine-bay 'engine_cluster',
bell interior 'engine_bell'). Inherited fixes: P2's door direction,
AAU recess, AAS electrical glow, AAS+AAT condition tiers + per-
component loot. D102.

**P4 — Speeder damping when unmounted**. Body-friction-free hover bike
+ no ground contact + no input override when not riding → a player-
capsule collision gives the bike one-way velocity it never sheds.
Frame-rate-independent exponential decay applied only while
`!s.mounted`: `SPEEDER_UNMOUNTED_LINEAR_DAMP_RATE_PER_S = 1.8` (~0.4
m/s after 1s from a 3 m/s nudge) + `SPEEDER_UNMOUNTED_ANGULAR_DAMP_RATE_PER_S
= 2.5` (spinning damps faster — a spinning parked hover bike reads
extra wrong). Mounted state's input-driven `setLinvel` / `setAngvel`
fully override these.

**P5 — Tutorial coverage refresh**. Added HINTS entries for
`large_tent_kit` (walk-in doorway), `grill_kit` (multi-parallel
cooking), `scrap_bar` (two-stage pry+extract). These were ItemIds that
shipped after the original HINTS table set and had been collecting
playtest "wait, what does this do?" moments.

**P6 — alignMeshToTerrain lift to shared util** (`src/util/terrainAlign.ts`,
new ~70 LOC). D98 triggered the extraction: the 4th caller would be
P7's procgen wreck system. Extracted from 3 duplicates (`tent.ts` /
`largeTent.ts` / `companion.ts`). Module-level scratch vectors inside
the util (Vector3 × 4 + Matrix4 × 1) preserve the no-allocation
per-frame behavior the companion's local copy had. API: `alignToTerrain(obj,
terrain, x, z, yaw, sampleRadius)` — dropped the Vector3 `pos` param
in favor of (x, z) scalars to match companion's existing signature +
let scattered-positioning callers avoid Vector3 allocation. D103.

**P7 — Procgen wreck-POI modelling system, first cut**
(`src/world/procgenWreck.ts`, new ~430 LOC). Composable part-vocabulary
approach unlocks ~100s of unique wreck silhouettes per seed. Part
kinds: cockpit (3 variants: tapered_nose, blocky_pilot_bubble,
bulbous_escape_capsule), hullSegment (3: ribbed_cylinder,
plated_rectangular, paneled_tapered), engineModule (2: single_bell,
twin_bell), tailStub (2: torn_ragged, sealed_cap). Each variant
returns `BuiltPart { mesh, partLength, radius, panelAnchor? }`.
Assembler lays parts along +X, centers the wreck around its position,
welds salvage panels onto parts that offered a panelAnchor. Two
recipes (wreck classes): **corvette** (3-5 parts, 6-12m, ~50% mix)
and **freighter** (5-9 parts, 14-22m). Each panel-bearing part becomes
its own Salvageable via post-assembly `userData.accessPanel`
traversal. `procgenPoi.ts` splits each procgen slot 35/65 between
composite (new) and legacy hand-modeled palette — `Tuning.PROCGEN_COMPOSITE_SHARE
= 0.35`. New constant lets the share ramp in future sessions. D102 +
D104.

**P8 — Verify + session-end**. tsc clean, vite build clean, all 7
items committed across 6 commits (P1, P2+P3, P4+P5, P6, P7).

## Session AAY — 2026-05-23 — Visual overhaul: tents + fabric shader + lantern + companion fix + grill bug ✓ verify pass
`verified` — tsc clean + production build clean. Multi-iteration polish pass
covering both tent kinds, a new procedural fabric shader, the lantern
rebuild, companion animation fixes, and the long-standing grill-attach
bug. 12 files modified, 1 new module (`fabricMaterial.ts`). No schema bump.

**Bedouin large-tent visual** (research-driven redesign): replaces the
pre-AAY featureless box with a beit-al-sha'ar silhouette — peaked ridge
along the long axis, off-white canvas color (was deep goat-hair brown),
subdivided BoxGeometry roof panels with catenary sag (`ROOF_SAG = 0.32m`,
bumped from initial 0.07-0.13 after playtest), visible ridge poles
protruding above the apex, interior horizontal beam, low side walls with
slight outward bow, five guy ropes to ground stakes (front-ridge guy
omitted so the entry stays clear), interior rug, terrain-slope tilt so
the tent sits flush + stakes contact the ground. 11 new
`LARGE_TENT_*` Tuning constants.

**Operational doorway on large tent**: hover the entry → prompt shows
"open"/"close doorway"; E toggles. Rolled-up canvas flap at the gable
apex (full width, no longer floating) animates open ↔ closed via lerp
(`DOOR_ANIM_SPEED = 2.4 /s`, ~0.4s transition). Door panel hangs from
the top + bows OUTWARD when closed (corrected from initial inward
bow). Shelter zone's `isLargeTent` flag toggled dynamically — closed
door drops storm dampening to 0 (full enclosure); open door restores
the 0.4 dampening (open-fronted, perceived intensity visible). New
`HoverState.verb` field lets the same InteractType carry a state-
dependent verb. New `InteractHit.subKind` lets the same registry
dispatch differently per sub-mesh.

**Procedural fabric shader** (`src/world/fabricMaterial.ts`, new ~120
LOC): mirrors `terrainMaterial.ts` pattern (onBeforeCompile patches
MeshLambertMaterial, IQ-style noise hash, value-noise FBM, world-space
varyings). 4 layered effects on every cloth surface:
- Weave cross-hatch (~2.5cm cycle, ±4% brightness)
- Mid-scale color variation (FBM picks between sun-bleached cream + warm
  tan at ~1.5m features)
- Stain patches (sparse darker brown on ~15% of surface)
- Per-pixel micro-grain sparkle (±2%)
Applied to both fabric + patch materials. Sampled in world-space coords
so different tents at different positions get visibly different surface
patterns for free. Wrinkle-displacement on geometry was tried + cut
(read as noise, not texture); shader-only texture works better.

**Small tent rewrite** (`src/world/tent.ts`): same off-white canvas +
fabric shader + sagged subdivided side walls + ridge poles + interior
beam + four guy ropes + terrain tilt. Ridge runs along X with two end
gables; +X gable is OPEN (entry) + -X gable closed. Deploy rotation
shifted -π/2 so the open end faces the player when placed. Fixed a
panel-rotation bug where the original `(π/2 - SLANT_ANGLE)` only
tilted ~34° instead of the needed ~56° — both panels hovered in the
middle of the tent crossing each other near the apex. Replaced with
`Quaternion.setFromUnitVectors` aligning each panel's local +Z to the
ridge-to-base slope direction (asymmetric rotation per side, handled
by the quaternion). Sag amplitude multiplied by `side` to compensate
for the asymmetric Y-axis flip between the two sides. `Tent.rotationY`
added to the interface so save/load uses the pure yaw input (the live
`mesh.quaternion` now also carries terrain-tilt, so the Euler-decomposed
Y no longer round-trips cleanly).

**Lantern salvaged-tech redesign** (`src/world/lantern.ts`): replaces
the wooden-post-with-bulb design that read as "garden lamp" with a
salvaged-tech power-cell on a hand-forged metal tripod. Three iron
legs splay outward to a junction node with rivet detail, vertical
post with red + yellow conduit cables alongside (carried over from
AAR salvage panel wires for material consistency), metal cage (torus
rings + 4 vertical bars) holding a glowing crystalline core (MeshBasic
amber capsule with hemispherical end caps), top cap + carry hook ring.
Same `PointLight` + flicker tick as before — only the geometry +
materials changed. Reads as both rustic + sci-fi.

**Companion legs + rolling + slope alignment fix**: three bugs found by
playtest.
- *Legs not visibly attached*: pre-AAY pivots sat at `(R*0.7, R*0.4)` —
  INSIDE the body sphere — and leg segments were horizontal. Tips
  floated ~10cm above ground.
- *Rolling looked like bobbing*: `c.body.rotation.x` was the roll
  rotation, but the body group's origin is at the creature's GROUND
  position; the sphere (positioned at `body.position.y = R`) orbited
  the ground point during roll, dipping below + rising above the sand.
- *Body didn't align to slope*: `c.group.rotation.y = c.heading` kept
  the body vertical regardless of terrain — creature looked like it
  was floating on dune ramps.

Fixes:
- New `bodyShell` sub-group at `y=R` inside body; all body meshes
  parent to it at y=0 (their centers coincide with shell origin); roll
  rotation moved to `bodyShell.rotation.x` so the sphere pivots around
  its own center.
- New `hipGroup` inside each leg pivot. Pivots positioned at
  `(R*sin(φ)*cos(θ), R(1-cos(φ)), R*sin(φ)*sin(θ))` — below the
  equator (latitude φ ≈ 60° from top) — so short legs (`LL=0.14`)
  can angle outward + downward and the tips actually touch the ground
  at the resting `0.795rad` down-angle. Walk gait rotates the hip
  around its Z axis (the tangential axis at the attachment) — leg
  hinges UP from the body, not slides under it. Pivots also recessed
  3cm INTO the body sphere so the leg's inner end visibly embeds
  into the carapace instead of meeting the curved surface at a
  tangent point.
- New `alignCompanionToTerrain` helper samples 4 cardinal heights at
  body-radius scale, builds a basis (up = terrain normal, forward =
  heading projected onto tilted plane), sets `c.group.quaternion`
  every frame. Pre-allocated scratch vectors. Third call site for
  this pattern (tent, large tent, companion) — lift to shared util is
  a backlog item.

**Grill kit attach bug** (`items.ts` + `interaction.ts` + `types.ts`):
two compounding bugs. (1) `grill_kit.onUse` required `hover.type ===
'add_fuel'`, which only fires when the player has a BRANCH selected
— with grill_kit selected, the fire's hover fell into the "no usable
item" branch (type=`'cook'`), so the check rejected. (2) The handler
read `(hover as { id?: number }).id ?? -1` — a TypeScript cast onto a
property that didn't exist on `HoverState`. Even if the type check had
passed, the fire lookup would have returned undefined.

Fix:
- Added `entityId?: number` to `HoverState`. Set it on every fire
  hover branch (cook / add_fuel / relight / passive).
- New grill_kit branch in `interaction.ts` case 'fires': prompt
  reads "attach grill to fire" (verb override), E attaches +
  consumes one slot.
- Fixed `grill_kit.onUse` (LMB path) to accept any live-fire hover
  type and use `hover.entityId`. Gated on `fire.alive` + `!fire.hasGrill`.

**Dev mode crafting upgrades**: (1) `applyDevLoadout` pre-discovers all
recipes (`ALL_RECIPE_IDS` push) so the right-side recipe panel is
populated from the first crafting menu open. (2) New `directCraft`
path in `craftingMenu.ts` — in dev mode, clicking any recipe row
(CRAFTABLE *or* MISSING) produces the output directly with no input
consumption. Toast suffixed `(dev craft)`. MISSING rows are still
visually muted but no longer disabled. Vanilla play unchanged.

## Session AAX — 2026-05-23 — Fix DEV MODE freeze + redesign as in-memory flag ✓ verify pass
`verified` — tsc + production build clean. Critical fix + small
architectural cleanup. 4 files, +94/-78. Save schema unchanged.

AAW shipped an auto-bypass of the title overlay when
`localStorage.devMode` was set, but called `handoffToGame()` at module
init — outside any user gesture. Browsers reject pointer-lock + audio-
context-start without a gesture, so the `'lock'` event never fired,
`flags.paused` stayed true, and the game looked frozen.

Fix: remove the auto-bypass entirely. Kill `localStorage.devMode` in
favor of in-memory `ctx.flags.devMode: boolean`. DEV MODE button now
applies the dev loadout INSIDE its click handler (gesture intact), sets
the flag, and hands off directly — one click, no reload, no save wipe.
NEW GAME and CONTINUE no longer touch any devMode state. CONTINUE
explicitly clears the flag so a save load doesn't show a stale boot
badge. Dev loadout extracted to `applyDevLoadout(ctx)` helper, reused
by both `Tuning.DEBUG_STARTER_LOADOUT` boot path and the runtime title
click.

## Session AAW — 2026-05-23 — DEV MODE clarity + crafting recipe list + controls in pause menu ✓ verify pass
`verified` — tsc clean. Three playtest-driven UX items. 5 files,
+384/-23. No schema bump. (Note: AAW's "auto-bypass title on devMode"
introduced the freeze fixed in AAX.)

**DEV MODE clarity**: persistent amber `[ DEV MODE ]` badge in HUD
top-left when the localStorage flag is set. Title auto-bypasses on
dev-mode boot (one click → in game, no NEW-GAME-after-DEV-MODE
confusion). Pause-menu quit-to-menu clears the flag so quit returns
to a vanilla title.

**Right-side recipe list in crafting menu**: new column shows every
discovered recipe categorized CRAFTABLE (N) / MISSING INGREDIENTS (N).
Per-row have/need per ingredient with missing ones tinted red. Click a
CRAFTABLE row to auto-fill the input slots, then hit CRAFT. Sister to
the TAB-key recipe book panel which still exists for full-screen view.
New helpers `addToInputCore` + `autoFillFromRecipe` extracted so the
auto-fill skips per-item playUiClick + renderAll churn.

**Controls in pause menu**: new "controls" button between save and
settings. Opens the existing controls panel on top of pause; close
returns to pause instead of unpausing. `tutorial.showControlsPanel`
gained a `{ returnToPause }` opt.

## Session AAV — 2026-05-22 — Inventory + crafting overhaul + dev mode ✓ verify pass
`verified` — tsc clean. Four playtest-driven features. 7 files touched;
no new modules; no schema bump.

**Bigger backpack** (AAV.1): `BACKPACK_SLOT_COUNT 10 → 20` lifted to
`Tuning.BACKPACK_SLOT_COUNT`. Hotbar stays at 4 (UI laid out for 4
across the screen bottom). Total inventory 14 → 24. 5-column × 4-row
grid in the inventory overlay. Save format unchanged — existing v10
saves load with whatever slot count they were saved at; new boots use
the larger inventory.

**Craft drops output on full bag** (AAV.2): pre-AAV behavior was
"output won't fit → refund inputs + abort with 'no room' toast." New
behavior: inputs are already consumed at this point in performCraft;
if some/all of the output can't fit, the overflow spawns as
`spawnDroppedPickup` at the player's feet (~0.8m forward from camera,
projected to terrain). Toast varies: "crafted X — dropped at your
feet (bag full)" if NONE fit; "crafted X — partial drop at your feet"
if some fit. Player keeps craft progress + recipe discovery; the
output just lands on the ground.

**Crafting partial-match suggestions** (AAV.3, `recipeDiscovery.ts` +
`craftingMenu.ts`):
- New `partialMatchRecipes(inputs)` — returns recipes where the
  player's current inputs are a SUB-MULTISET of the recipe's inputs
  (every player item appears in the recipe with count ≥ player's
  count; player has no items not in the recipe). Excludes exact
  matches (handled by `matchRecipes`).
- New `missingForRecipe(inputs, recipe)` — diff helper returning
  the list of (itemId, needed-more-count) the player needs to
  complete a recipe.
- `renderOutputPreview` now extends the "no match" branch with
  partial-match hints:
  - **Discovered partial match**: name the recipe + show diff
    explicitly. Example: "tent kit: need 2 branch + 1 cloth (+ 1
    other possible)".
  - **Undiscovered partial matches only**: show count, not names —
    preserves the discovery beat. Example: "3 possible recipes —
    add more ingredients".
  - **No partial matches**: original "nothing happens" stays.
- Net effect: multi-of-same-item recipes (branch×3+cloth×2 → tent)
  are no longer pure trial-and-error. Once a recipe is discovered,
  partial-progress states get a clear "you need X more Y" hint.
  Undiscovered partials get a "you're on the right track" signal
  without spoiling the recipe.

**DEV MODE title button** (AAV.4, `titleOverlay.ts` + `main.ts` +
`style.css` + tuning):
- New "DEV MODE" button on the title screen, styled with a dashed
  border + muted color so it reads as a debug affordance (not a
  primary action).
- Click DEV MODE → sets `localStorage['dustfall.devMode'] = 'true'`
  → clears save + reloads → boot path detects the flag + applies
  the starter loadout (scrap_bar + materials + weapons + kits).
- Regular NEW GAME explicitly clears the flag → starts EMPTY (the
  pre-AAV `DEBUG_STARTER_LOADOUT` was hardcoded true; now flipped
  to false default per `Tuning.DEBUG_STARTER_LOADOUT`).
- Three paths total now: NEW GAME (empty start, real progression),
  CONTINUE (resume save), DEV MODE (debug loadout for system
  testing). Maps directly to the user's "I want to test gameplay
  loop from scratch vs systems test" workflow split.

## Session AAU — 2026-05-22 — Salvage panel polish: shape + recess + testability + flow visibility ✓ verify pass
`verified` — tsc clean. Four playtest-feedback fixes on top of the
AAR/AAS/AAT salvage stack. 4 files touched; no new modules; no schema
bump.

**User complaints addressed**:
1. *"Panels need to be larger and more of a rectangle, like a house access panel"*
2. *"Panels need to be incorporated into the wrecks so they don't float or clip on the side — integrated seamlessly"*
3. *"I tried salvaging but it was just using the old mechanic of only pressing E"* (likely: no scrap_bar equipped; secondary: pry-to-extract was too subtle to notice the two-stage flow)
4. *"Some panels are too high to reach"* (audited; catwalk-mounted panels at 7-11m in megaWreck reachable via stairs; flagged for future per-panel height review)

**Shipped**:
- **Taller rectangular panel proportions** (`Tuning.SALVAGE_PANEL_SIZE_*`):
  0.55×0.55×0.18 → 0.45×0.70×0.20. Vertical access-panel shape like
  a house breaker box.
- **Body recessed into hull** (`addAccessPanel`): body.position.z
  shifted back by sz/2 (in panel-local Z, rotated by faceYaw so the
  shift respects panel orientation). Body's FRONT face now sits flush
  with the hull surface; rim + closed door read as the panel face,
  body cavity recesses INTO the hull. Reads as "integrated, not stuck
  on." `Tuning.SALVAGE_PANEL_RECESS_DEPTH` documents the depth though
  it derives from sz/2.
- **scrap_bar in DEBUG_STARTER_LOADOUT**: the AAR salvage flow gates
  on scrap_bar equipped; without it the player saw "need a scrap bar"
  passive prompt + no salvage. Starter loadout now ships scrap_bar so
  the new flow is testable from boot.
- **Door swing lerp slowed** (`SALVAGE_PANEL_DOOR_OPEN_LERP`):
  4.5/s → 3.0/s. Door reaches open in ~1.5s instead of ~0.7s. The
  swing now reads as a deliberate animation rather than an instant
  pop.
- **Pry-complete toast** (`completePry` in interaction.ts): explicit
  "the panel pries open — search inside" toast on pry completion.
  Makes the two-stage flow (pry → search) unmissable to first-time
  players who otherwise mistook the sequence for "just press E."

**Out of scope** (future sessions):
- Per-panel height review for unreachable catwalk-only panels in
  megaWreck (engine bell panels at 7.7m, catwalk-stub panels at 11.5m).
  Reachable from catwalks; ground-level secondary panels could be a
  follow-on if catwalk navigation feels too gated.
- New panel materials (deeper rust streaks, brushed metal pristine
  variant) — current solid-color materials read clearly enough.

## Session AAT — 2026-05-22 — Salvage condition tiers (corroded / standard / pristine) ✓ verify pass
`verified` — tsc clean. Per-panel condition tier added on top of the
AAR pry-and-extract foundation. Each panel rolls one of 3 conditions
deterministically at boot (per id + biome + scatterRand). Conditions
affect pry duration, max-extract count, loot quality, and visual
appearance. 4 files touched; no new modules; no schema bump. One new
D-entry (D96).

**Condition assignment** (D96): `pickCondition(rand, pos)` in
salvage.ts. Base distribution: 35% corroded / 50% standard / 15%
pristine. Biome biases (salt corrodes, dune preserves):
- Salt biome: 55% corroded / 40% standard / 5% pristine
- Dune biome: 25% corroded / 50% standard / 25% pristine
- Rocky biome: base (35/50/15)

Module-level `_biomes: BiomeSampler | null` singleton, set via new
`setSalvageBiomesContext(biomes)` called once at boot from main.ts.
No registerSalvageable signature change — every existing caller (15+
across wrecks/poi/megaShip/megaWreck/crashedHull/etc.) still compiles
unchanged. Condition derives from save-stable inputs (id + biome +
scatterRand) so it persists across save/load with no schema field
needed — same pattern as AAR's "derive cosmetic state from existing
counters" (D94).

**Tunables per condition**:
- Corroded: pry × 0.6 (0.51s), max extracts = 1-2, loot DOWNGRADED
- Standard: pry × 1.0 (0.85s, AAR baseline), full extracts, AAR loot
- Pristine: pry × 1.4 (1.19s), full 5 extracts, last component has
  bonus loot

**Per-condition loot tables** (`interaction.ts`):
- `COMPONENT_LOOT` — standard (AAS baseline): red_wire→rope,
  yellow_wire→cloth×2, chip→scrap_bullet, etc.
- `COMPONENT_LOOT_CORRODED` — degraded: red_wire→cloth (insulation
  rotted), chip→scrap (silicon shot), bandage_pack→cloth (gauze
  rotted), every entry tier-down.
- `COMPONENT_LOOT_PRISTINE_BONUS` — last extract on a pristine panel
  upgrades to scrap_bullet×3 (premium ammo bundle).

**Visual differentiation** (`salvage.ts:applyConditionVisuals`):
- Corroded: door material → heavy rust orange-brown (0x8a4a28)
- Standard: door material unchanged (AAR weathered iron 0x5a4a3a)
- Pristine: door material → cooler grey steel (0x7a7a82) + faint
  emissive (0x080a0e) for "this thing still has power" sheen

**Player-readable prompt annotation**: hover prompt now includes
condition adjective. "fuselage (rusted) — pry open" / "fuselage —
pry open" (standard, no decoration) / "fuselage (pristine) — pry
open". Lets the player judge the pry cost vs reward at a glance
before committing.

**Progress bar correctness**: tickSalvage scales the displayed
duration by `pryDurationMultiplier(s.condition)` so the bar still
fills 0→100% across the actual pry duration regardless of
condition.

10 new Tuning constants under `SALVAGE_CONDITION_*` (3 pry mults +
2 extract caps + 6 distribution thresholds).

**Player-visible result**: every wreck in the world now has a
visible condition. Player can spot "ooh, that's a pristine cargo
container in the dunes — worth the longer pry for the premium drop"
or "skip that rusted escape pod in the salt-flats, only cloth in
there." Wreck-shopping becomes a real activity.

## Session AAS — 2026-05-22 — Salvage polish bundle: variant interiors + per-component loot + electrical glow ✓ verify pass
`verified` — tsc clean. Three salvage-polish items closed in one
session, building on AAR's tactile pry-and-extract foundation. 5 files
touched; no new modules; no schema bump (D94 still applies).

**Per-component loot mapping** (AAS.1). Replaces AAR's
`rollWreckLoot(kind, Math.random)`-per-extract path (random + opaque
to the player) with deterministic per-component lookup. New
`COMPONENT_LOOT` map in `interaction.ts`:
- `red_wire` → rope
- `yellow_wire` → cloth × 2
- `chip` → scrap_bullet
- `fuse` → scrap_bullet
- `scrap_chunk` → scrap × 2
- `cloth_scrap` → cloth × 2
- `bandage_pack` → bandage

Player can now read the cavity at a glance — "I see a red wire and a
bandage pack, I'll get rope and a bandage." Fallback path preserved
for any panel without a kind tag (defensive): rolls
`rollWreckLoot(kind)` once and uses the first entry.

**Variant interiors per wreck kind** (AAS.2). `addAccessPanel` gained
a `kind: PanelKind` parameter (defaults to 'fuselage'). New
`PANEL_COMPONENT_PALETTES` table maps each kind to a 5-entry component
roster:
- `engine_cluster`: 2 red_wire + yellow_wire + fuse + scrap_chunk
  (cabling-heavy, electrical)
- `engine_bell`: red_wire + yellow_wire + 2 fuse + scrap_chunk (more
  ammo)
- `fuselage`: red_wire + yellow_wire + chip + cloth_scrap + scrap_chunk
  (interior cabling + textiles)
- `escape_pod`: 2 bandage_pack + cloth_scrap + chip + fuse (medical)
- `cargo_container`: chip + cloth_scrap + fuse + scrap_chunk + red_wire
  (lottery mix)
- `massive` (flagships): red_wire + yellow_wire + chip + fuse +
  bandage_pack (full diversity)

All call sites updated to pass kind: `wrecks.ts` (5 makeXxx
functions), `megaShip.ts` (3 panels = 'massive'), `megaWreck.ts`
(aft + bow + nested registerNested = 'massive' / 'engine_bell').
New `makePanelComponent(kind, slot, sx, sy, sz)` helper builds the
mesh; 5 slot positions inside the cavity stay fixed so the layout
reads consistently across kinds (top-left wire-bay, top-right chip-
bay, etc.). Two new component meshes: `cloth_scrap` (folded fabric
square) + `bandage_pack` (white box with red cross stripes).

**Electrical-flicker glow on pry-complete** (AAS.3). New
`THREE.PointLight` per panel, attached inside the cavity. Ignites on
`completePry`: peak intensity `SALVAGE_PANEL_GLOW_PEAK_INTENSITY = 0.55`,
amber color (`0xff9a40`, fire-palette), range 1.2m. Fades over
`SALVAGE_PANEL_GLOW_FADE_DURATION_S = 3.2s` with a 2-sine flicker
(23Hz + 7.3Hz detuned) modulating the envelope. `castShadow: false`
for perf — 50+ panels with shadow-casting lights would be expensive.
Animation lives in the existing `updatePanelDoors` per-frame walk;
when `panelGlowStartedAt` hits the fade window it self-marks `-1` to
stop ticking. 4 new Tuning constants
(`SALVAGE_PANEL_GLOW_PEAK_INTENSITY/FADE_DURATION_S/RANGE_M/COLOR_HEX`).

**Player-visible result**: panel pries open → 3s of "this fuse-box has
residual juice" amber flicker fading to dark, while the player picks
through a kind-specific component spread and watches each piece
disappear with a clear loot outcome. The previous "open box, get random
soup of items" reads as "this is a specific thing I'm taking apart."

## Session AAR — 2026-05-22 — Salvage mechanics overhaul: tactile pry + extract ✓ verify pass
`verified` — tsc clean. Salvage flow rewritten from "press E → roll
loot table → done" into a tactile two-stage interaction: pry the door
open with a scrap_bar, then search inside for individual components
that visibly disappear as you extract them. 8 files touched; no new
modules. Two new D-entries (D94, D95). Save schema stays v10.

**New item + recipe**:
- **`scrap_bar` ItemId** (id 16 in the recipe ladder). Recipe id 15:
  `scrap×2 + branch×1`. `wieldLmb='click_use'` so LMB triggers the pry
  attempt when hovering a salvage panel. Viewmodel: bent iron lever
  with forked claws + leather grip. Per D71 next id is 16.

**New panel model** (`src/world/wrecks.ts` — `addAccessPanel` rewrite):
- Panel body bumped from 0.32×0.24×0.15m to 0.55×0.55×0.18m (larger,
  square-ish fuse-box silhouette).
- **Hinged door** on the left edge — full-cover plate with 4 rivets +
  a recessed handle on the right edge. Door is its own Group rotating
  around a hinge offset to the panel's left edge; per-frame angle lerp
  in interaction.ts drives the open animation.
- **Visible cavity** behind the door — deep black backplate + 5
  interior detail components: 2 wire bundles (red + yellow), a PCB
  chip with faint emissive, a ceramic fuse cylinder, and a scrap
  chunk. Each tagged with `panelComponentIndex` so interaction.ts
  can hide them as extracted.
- `body.userData` extended: `panelDoor`, `panelInterior`,
  `panelComponents[]`, `panelDoorAngle`, `panelDoorTarget`,
  `panelOpened`. Contract for the per-frame lerp.

**Two-stage interaction** (`src/player/interaction.ts` rewrite —
salvageables case + new helpers):
- **Stage 1 (pry)**: scrap_bar must be equipped to pry. Without it,
  the hover prompt reads `(name) (need a scrap bar)` and E is inert.
  With scrap_bar: E starts a 0.85s hold (`SALVAGE_PANEL_PRY_DURATION_S`);
  progress bar fills; pry creak SFX plays. On completion, `panelOpened`
  flips and `panelDoorTarget` → `SALVAGE_PANEL_DOOR_OPEN_ANGLE = 2.1
  rad` (~120°). Door lerps open over ~1s via per-frame exponential
  decay (`SALVAGE_PANEL_DOOR_OPEN_LERP = 4.5/s`). Mid-pry slot-switch
  cancels (you can't pry without the lever).
- **Stage 2 (extract)**: once door is open, E-press extracts ONE
  component per press. New `extractOneComponent` finds the next
  visible component in index order, hides it, rolls a single loot
  entry from the existing kind table (`rollWreckLoot`), adds to
  inventory. Inventory-full path keeps the component visible and
  toasts "your bag is full" so the player can drop and retry.
- **Visible depletion**: components hide in index order (0 → 4) as
  the player extracts. Kinds with fewer max-extracts than 5 leave
  some components visible at strip time — reads as "the rest is too
  damaged to bother with" rather than a clean empty cavity. Per D94
  this is intentional.

**Polish**:
- **`playPryCreak`** (new in audio.ts) — 2-layer SFX: bandpassed
  noise scrape sweeping 420 → 1400 → 380 Hz over 0.85s + low triangle
  thump (160 → 60 Hz) at the END for the door-pops-free moment.
  Aligns exactly with the pry duration.
- **`playComponentExtract`** (new) — short highpass click + ringing
  sine clink (~1400 Hz with ±200Hz jitter). ~0.18s per extract.
- **Risk/reward**: prying multiplies the sandworm's detection radius
  by `SALVAGE_NOISE_MULTIPLIER_DURING_PRY = 1.3` for the duration of
  the pry (composes with movement multipliers). New
  `isPryingActive()` exported from interaction.ts; sandWorm.ts's
  `playerNoiseMultiplier` reads it. Standing still while prying ≈
  walking detection range; mounted while prying ≈ 360m detection. D95.

**Save schema**: stays v10. Acceptable migration: pre-AAR partially-
salvaged panels (`salvageRemaining < initialMax`) reload with all 5
component meshes visible but capped extract count. Visible-vs-extract
inconsistency only on partial saves. Open-door state doesn't persist
(panels close on load); player re-prys to reopen (no resource cost).

**Out of scope** (future sessions): electrical-flicker PointLight on
panel open; variant interiors per wreck kind (fuselage gets different
components than cargo); condition tiers (corroded panel: easier pry,
fewer components / pristine: harder pry, premium loot); thermal-cut
tier with fire-starter for sealed panels; rare key-card panels.

## Session AAQ — 2026-05-22 — POI overhaul: themed clusters (military convoy + refugee caravan) ✓ verify pass
`verified` — tsc clean. POI overhaul slice — first of three angles from
the long-standing backlog item (clusters, narrative beats, biome-specific
kinds). 2 files touched; no new modules. One new D-entry (D93).

**Themed POI clusters** are coordinated layouts of existing wreck/camp
primitives that read as narrative beats — a convoy that crashed
together, a caravan that camped together — rather than the previous
all-scatter-no-context placement. Layouts use the rejection-sampler
infrastructure (D82/AAI/AAK) extended with cluster-specific exclusion
radii.

- **`ClusterKind` union** + 2 cluster builders in `src/world/poi.ts`.
  `military_convoy`: 4-6 wrecks aligned along a 28-48m "crash trajectory"
  line — lead `engine_cluster` (the truck), 2-4 `cargo_container`
  middles (the freight), `fuselage` tail (comms vehicle). All wrecks
  share the trajectory yaw (with ±0.5rad per-wreck jitter) and ±2m
  lateral skid. Closes with a 12m debris field at the impact end.
  `refugee_caravan`: `placeScavengerCamp` at center (which already
  bundles a fuselage windbreak + fire ring + bandage pickup), ringed
  by 2-3 `cargo_container`s at 6-12m, each pointed INWARD toward the
  camp center for "stowed around the fire" coherence.
- **`sampleClusterPositions(rand, terrain, flagshipPositions)`** —
  rejection sampler with cluster-specific exclusion radii:
  `CLUSTER_SCATTER_RADIUS 250-800m` (same band as flagships),
  `CLUSTER_MIN_SEPARATION = 320m` (wider than POI_MIN_SEPARATION since
  clusters span 30-50m of layout), `CLUSTER_SPAWN_EXCLUSION = 250m`
  (same as flagships), `CLUSTER_FLAGSHIP_MIN_SEPARATION = 200m`
  (clusters slightly smaller than flagships, can sit closer),
  `CLUSTER_MAX_ROUGHNESS = 0.7` (same terrain-flatness gate). Post-
  sampler kind rotation is shuffled per-seed so a 3-cluster world
  doesn't always alternate military / caravan / military.
- **Integration** in `placePOIs()`: cluster pass runs AFTER flagships,
  BEFORE procgenPoi. Cluster anchor XZ pushed onto
  `_placedFlagshipPositions` so the procgenPoi rejection sampler
  excludes them via the existing `POI_MIN_SEPARATION` mechanism —
  procgen wrecks won't intrude on a convoy crash site or scatter
  inside a caravan radius. No procgenPoi change needed.
- **`CLUSTER_COUNT_PER_WORLD = 3`** — a 3-cluster world adds ~12-18
  extra wrecks (across the convoys) + reuses 1-2 scavenger camps as
  caravan centers. Density on top of the existing 22 procgen wrecks +
  6 flagships feels appropriate; can dial down to 2 if playtest reveals
  crowding.
- **D93** (composition-over-creation): themed clusters reuse the
  existing wreck/camp vocabulary rather than introducing new POI
  modules. Layout shape + kind selection IS the theme.
- **Save schema**: no change. Clusters are deterministically
  re-rolled from `ctx.seed` on every boot, same as flagships and
  procgen wrecks. Save format stays v10.

**Out of scope** (other POI-overhaul angles, future sessions):
narrative beats (lone-survivor journal entries, hostile holdouts,
hermit NPCs); biome-specific POI kinds (salt = corroded scientific
outpost, rocky = subterranean entrance); a third cluster kind
(comm-relay).

## Session AAP — 2026-05-22 — Sandworm overhaul + atmospheric music tracks ✓ verify pass
`verified` — tsc clean. Overnight session pairing two long-deferred
big-ticket items. 5 files modified + 1 new module (`src/audio/music.ts`,
~240 LOC). Two new D-entries (D91, D92).

**Sandworm overhaul** (deferred from AAL/AAM/AAN/AAO). Replaces the
world-edge test-fix (`SANDWORM_HOME_POS = (900, 0)` from AAL) with a
real procgen biome-seeded spawn + noise-scaled detection.

- **Procgen biome-seeded spawn** (D91, `src/enemies/sandWorm.ts`). New
  `sampleSandwormHome(rand, biomes, terrain)` — mirrors the wells-in-
  salt rejection-sampler pattern (D55). Uses `findBiomeCentroid` on
  the dune biome with a player-spawn-exclusion ring
  (`SANDWORM_SPAWN_EXCLUSION_RADIUS = 350m` — wider than flagship
  POIs at 200m, since detection range alone is 150m). Per-seed jitter
  (±30m) so different seeds with the same centroid cell still get
  visibly-distinct positions. Falls back to `Tuning.SANDWORM_HOME_POS`
  if no dune centroid is reachable (rare).
- **`spawnSandWorm` signature** gained optional `homeXZ` param. main.ts
  computes it via `sampleSandwormHome(scatterRand, biomes, terrain)`
  and passes it through. Backward-compatible — pre-AAP callers
  without the arg fall through to the Tuning fallback.
- **Noise-scaled detection** (`src/enemies/sandWorm.ts`,
  `src/config/tuning.ts`). New `playerNoiseMultiplier(ctx)` helper
  reads player movement state (mounted / sprinting / walking / still)
  and returns a detection-radius multiplier. tickPatrol's detection
  check now reads `SANDWORM_DETECTION_RADIUS × multiplier` instead of
  the raw radius. Four new Tuning constants
  (`SANDWORM_DETECTION_MULT_*`): still=0.55, walking=1.0,
  sprinting=1.45, mounted=1.85. Standing still ~80m from a worm
  no longer triggers alert; mounted players are heard from ~280m.
- **Multi-worm + per-seed N**: cut from scope (overnight tier-3
  scope-cut). Single-worm baseline is the right ship — multi-worm
  needs playtesting + save-schema bump. Backlogged.

**Atmospheric music tracks** (long-standing backlog from at least AAG-
era, surfaced repeatedly in AAN/AAO audits). 3 procedural Web Audio
tracks per D3 (no .ogg files); fills the actual music slot for the
first time since X-era's sample stems went silent for lack of an .ogg
pack.

- **New module `src/audio/music.ts`** (~240 LOC). Builds 3 always-
  running tracks at boot via `startMusic()`. Each track = a set of
  oscillators + filters routed through a per-track gain bus + a
  shared master `MUSIC_BUS_TARGET = 0.45` bus. Master fades in over
  5s on first audio gesture.
- **Day track**: warm C-minor harmonic drone (C2 + G2 + Eb3 triangles
  through 800Hz lowpass), each with a slow LFO tremolo (~0.07-0.13Hz
  incommensurable rates so it never feels metronomic). Sparse rising-
  fifth motif (C5 → G5 sines, ~1.5s decay) fires every 12-18s when
  the track is meaningfully audible.
- **Storm track**: chromatic dissonance (C2 + Db2 sawtooths — semitone
  clash) through 300Hz lowpass + low rumble (lowpassed noise loop at
  0.45 playback rate, 180Hz cutoff). Builds tension; ramps in at
  perceivedIntensity > 0.30, dominates at > 0.65.
- **Night track**: sparse sine pads (C3 + Eb4) with very slow LFO.
  Soft high-tone chime (C6, 3.5s decay) fires every 20-30s.
- **Crossfade logic**: weight = (sunHeight, perceivedIntensity).
  Storm wins on intensity; day/night blend on sun height at low
  intensity. 1.5s crossfade ramps (slower than soundscape's stem
  ramps so musical transitions feel held, not jumpy).
- **Soundscape independence** (D92). The existing soundscape.ts
  sample-stem music layer (music-calm/music-tense via .ogg files) is
  preserved unchanged but stays silent in production (no .ogg pack
  ever shipped — getSample returns null). AAP's music module runs
  alongside; it doesn't replace the stem layer. If a future session
  adds .ogg music files the stems will activate; AAP will need a
  toggle then.
- **Debug snapshot**: `__game.musicState()` returns per-track gain
  values for tuning. Mirrors `__game.audioState()` shape.

## Session AAO — 2026-05-21 — Flagship paper-thin sweep + grill HUD + companion huddle ✓ verify pass
`verified` — tsc clean. Four quick wins from the AAN audit backlog,
all shipped in one session. 10 files touched, no new modules.

- **Flagship paper-thin sweep** (CLAUDE.md rule 7). AAN closed wrecks.ts;
  AAO closes the remaining flagships. Five files audited; 15 fixes
  across 4 of them. **megaShip.ts** (8 fixes): hull seams (5cm → 10cm)
  on right + left walls + horizontals, rust streaks (5cm → 10cm),
  rust patches (4cm → 10cm), entrance fragments (5cm → 10cm),
  bridge side-fins (8cm → 10cm), viewport (5cm → 10cm). **megaWreck.ts**
  (6 fixes): hull seams on aft +Z/-X walls (6cm → 10cm), horizontal
  seams (6cm → 10cm), rust streaks (6cm → 10cm), roof rust patches
  (4cm → 10cm), aft doorway fragments (8cm → 10cm). Offsets bumped
  proportionally so seams still sit proud of the wall by the same
  margin. **crashedHull.ts** + **engineBlock.ts**: bell-throat
  backstop `CircleGeometry` → `CylinderGeometry(r, r, 0.10)` (the
  canonical AAN fuselage-cap pattern). **satelliteDish.ts**: clean
  (audit agent flagged a false positive at L312; no CircleGeometry
  found via grep — was actually in crashedHull at L312).
- **Cook-progress-per-fire HUD** (AAM-deferred polish). New
  `showCookProgresses(progresses: readonly number[])` /
  `hideCookProgresses()` in `interactPrompt.ts`. Pre-builds 4 mini-bars
  in a row above the [E] prompt; per-frame width updates only (no DOM
  churn). Wired into `interaction.ts` 'fires' case — when hovering a
  fire, filters `_cooks` by `fireId === f.id` and surfaces each cook's
  `slot.meta.cookProgress`. Bars hide by default each frame; show only
  when ≥1 cook active on the hovered fire. Warm amber gradient
  (#c8783a → #f4b35e) reads as "cooking heat." Closes the AAM gap
  where multi-cook grilled fires showed only one cook's progress.
- **Companion storm-peak huddle** (D90). New `'huddle'` state on the
  `CompanionState` union, gated by `weather.intensity >
  Tuning.COMPANION_HUDDLE_THRESHOLD = 0.80` with ±0.05 hysteresis.
  Overrides all other states. Animation: legs tucked beneath body
  (y near 0, light shimmer ~10% gait amplitude), body pressed down
  to `-COMPANION_BODY_RADIUS * 0.35` with very slow breathing bob
  (35% of idle rate). One-shot toast "Rocky huddles down" on first
  transition per deploy (`_huddleToastShown` module flag, reset on
  pack-up). Uses raw `weather.intensity` not `perceivedIntensity`
  per state-split shared-memory: companion is outdoors regardless of
  player shelter (D90).
- **Rule-2 magic-number sweep** (deadTree.ts). Lifted 5 module-local
  constants to Tuning: `DEAD_TREE_FLATNESS_THRESHOLD` (0.7),
  `DEAD_TREE_BRANCH_COUNT_MIN/MAX` (2/4),
  `DEAD_TREE_BRANCH_RING_RADIUS_MIN/MAX` (1.5/3.0). poi.ts
  scavenger-camp constants assessed and deferred — the hand-coded
  one-off camp's values aren't really feel-tunable and would bloat
  Tuning without aiding future iteration. Backlogged as "true
  magic-number sweep when scavenger camp is reworked."

## Session AAN — 2026-05-21 — Systems review + quick-win polish bundle ✓ verify pass
`verified` — tsc clean. Four quick wins from a fresh three-agent systems
audit. No new modules; 8 files touched.

**Session shape**: user asked for a comprehensive review (bugs / model +
texture issues / quick wins / gameplay loop). Three parallel Explore
agents covered (a) gameplay loop + systems, (b) models/materials, (c)
UX/audio/save quick-wins. Audit surfaced: paper-thin decorations on
procgen wrecks (CLAUDE.md rule 7 violations) + 5 quick wins. Shipped
the top 4.

- **Paper-thin wrecks.ts fixes** (CLAUDE.md rule 7 audit). Five
  violations on procgen wrecks bumped to ≥0.10m depth + the fuselage
  end cap rewritten from CircleGeometry (zero depth — 2D disc) to a
  0.10m-thick CylinderGeometry. Affected: engine_cluster rusty panel
  (0.06 → 0.15), escape pod hatch (0.04 → 0.12), escape pod rust
  patch (0.05 → 0.12), cargo container door (0.04 → 0.10 width),
  debris hull plate (0.04 → 0.10 Y), fuselage end cap (Circle → 0.10m
  Cylinder). All read as real metal at oblique angles now.
- **Scrap gun empty-state crosshair** (`src/ui/interactPrompt.ts` +
  `style.css`). New `.no_ammo` crosshair state. Fires when there's no
  hover AND the equipped slot is `scrap_gun` with
  `ammoRemaining <= 0`. Visually: dim warning-red, slightly smaller
  than baseline. Hover state always wins (kill/dead/interactable is
  the more actionable signal). Player now reads "this won't fire"
  before mashing LMB on a dry magazine.
- **Bandage SFX** (`src/audio/audio.ts`, `src/inventory/items.ts`).
  New `playBandageUse()` — two-layer cloth-tear noise burst (highpass
  900 → 1800 Hz) + soft pad triangle blip (220 → 110 Hz). Wired into
  bandage onUse. Closes a long-standing silent-use gap (bandage was
  crafted early + used repeatedly with no audio feedback).
- **First-recipe-discovery fanfare** (`src/ui/craftingMenu.ts`,
  `src/audio/audio.ts`, `src/ui/hud.ts`, `src/GameContext.ts`,
  `src/style.css`). On first-time discovery of a recipe: distinct
  rising-arpeggio chime (C5 → G5 → C6 sines + C4 triangle pad,
  ~0.6s) replaces the routine playCraft tick; toast renders in
  warm-gold with glow + larger font, held 3.2s instead of 1.6s.
  HudApi.showToast extended with optional `{ kind?: 'discovery' }`
  options arg; standard call sites unchanged. Closes the AAM
  next-session-prompt "Add icon scale-up + screen flash on first
  craft" stretch.

## Session AAM — 2026-05-21 — Fire grill attachment (multi-cook) + SAVE_VERSION v10 ✓ verify pass
`verified` — tsc clean; preview-eval confirmed grill_kit ItemDef registered,
recipe id 14 added to ALL_RECIPE_IDS, Fire.hasGrill persists in v10
save format (savedFireHasGrill=true), save+reload restores hasGrill +
re-attaches grill mesh on load, grill mesh has 6 children (4 bars + 2
rails). Loader seed-check bug from AAI also fixed.

**Feature** (backlog item from AAG): a craftable iron grate that attaches
to a fire and lets the player cook multiple raw items in parallel
instead of one at a time.

- **`grill_kit` ItemId + ItemDef** (`src/inventory/items.ts`). Recipe
  id 14 (`scrap×2 + branch×2`). `wieldLmb: 'click_use'`; onUse checks
  for a hovered fire (`hover.type === 'add_fuel'`), refuses if no
  fire or already has grill. Custom viewModel (4 stacked bars) +
  SVG icon (grate motif).
- **`Fire.hasGrill: boolean` + `grillMesh: THREE.Group | null`**
  fields. `attachGrillToFire(ctx, fire)` builds the grate via new
  `makeGrillMesh()` helper (4 horizontal iron cross-bars + 2 side
  rails forming a 0.55×0.45m grate at Y=0.45 above fire base), parents
  it to the fire group so it inherits the fire's world position, and
  flips `hasGrill = true`. 5 new Tuning constants
  (`FIRE_GRILL_WIDTH_M`, `_DEPTH_M`, `_HEIGHT_M`, `_BAR_RADIUS_M`,
  `_MAX_PARALLEL_COOKS = 4`).
- **`_cooking` singleton → `_cooks: CookState[]` list**
  (`src/player/interaction.ts`). Each cook tracks its own slot +
  fireId + completeAt. `tickCooking` iterates the list; per-cook
  cancel = slot.item changes (consumed/swapped) OR fire dies. Pre-AAM
  the slot-switch cancel was a single-cook UX limitation; with the
  grill running 4 parallel cooks the player must be able to switch
  slots to add more raw items, so that cancel was dropped.
- **Cook-start gate**: per-fire cap = 1 without grill,
  `FIRE_GRILL_MAX_PARALLEL_COOKS` (4) with grill. Also reject if the
  exact slot is already cooking (no double-stack). Toast variants:
  "cooking...", "added to grill", "grill is full", "this item is
  already cooking", "a cook is already running here".
- **SAVE_VERSION 9 → 10** (additive only per D81). Optional
  `hasGrill?: boolean` on each saved fire. Pre-v10 saves omit the
  field; loader defaults to false. Loader re-calls `attachGrillToFire`
  on restored fires that had `hasGrill: true`. Loader's version-list
  union accepts 1-10.
- **Bug fix (incidental, AAI debt)**: loader's seed-validity check
  was comparing `save.seed !== Tuning.RNG_SEED` (legacy from pre-AAI
  when there was only ever one world seed). Post-AAI, `ctx.seed` is
  the per-game source of truth. Check now reads `save.seed !== ctx.seed`.
  Pre-AAM this almost always failed for any non-1337 world (saves were
  effectively non-loadable after the AAI per-seed work).

**No new modules**. 7 files touched.

## Session AAL — 2026-05-21 — Project-wide audit pass (visual + bugs + quick wins + tuning lift) ✓ verify pass
`verified` — tsc clean. Three Explore agents ran in parallel at session
start (gameplay loop / visuals / quick-wins-debt-sweep); user picked
"do everything above". 13 files touched across 4 bundles.

**Bundle 1 — Quick wins (hygiene)**:
- Deleted 6 unused `OPENING_WRECK_GODRAY_*` Tuning constants (AAB cone
  was removed in AAJ; "kept for documentation" turned into permanent
  debt).
- Deleted 2 unused legacy speeder constants (`SPEEDER_HOVER_K_D`,
  `SPEEDER_HOP_IMPULSE` — orphaned since BB-CC and CC-2 respectively).
- Companion `receiveShadow = false → true` for proper ground contact.
- Footprint puffs gained an `import.meta.hot.dispose` HMR guard so the
  `_system` singleton clears on Vite hot-reload (previously stale
  particle pool survived Tuning tweaks).
- `samples.ts` console.warn → silent fallback (was flooding preview
  tab when .ogg samples not shipped); soundscape already handles null
  buffers gracefully.

**Bundle 2 — Gameplay bugfixes**:
- **energy_pistol wired into salvage** (was orphaned ItemDef + combat
  spec from PP). Added to `massive` wreck table at 3% drop (rare
  hero-tier weapon).
- **scrap_bullet drops bumped** on engine_cluster (0.05 → 0.12) and
  added to `massive` (0.15) so ammo isn't gated entirely on the
  scrap recipe pipeline.
- **Sleep temperature now respects shelter state**
  (`src/ui/sleepOverlay.ts`). Pre-AAL `temperature *= 0.3` at 8h
  regardless of location — sleeping in the open desert recovered as
  well as a tent. Now: sheltered recovers fast (factor 0.7), open-air
  recovers slow (factor 0.25). Reads `ctx.player.inShelter` set by
  `updateShelter` each frame.
- **Pipe-staff knockback on raiders**: audit was a false positive —
  `knockbackRaider` IS exported from `raider.ts:470` and the dynamic
  import in `combat.ts:253` works correctly. No fix needed.

**Bundle 3 — DoubleSide sweep**:
- `crashedHull.ts` bell outer: DoubleSide → FrontSide (inner shell +
  backstop already covered interior visibility, so DoubleSide was
  redundant + made the outer read paper-thin from oblique angles).
- `engineBlock.ts` heat shield: DoubleSide → FrontSide (shield is
  occluded from behind by other engine geometry; FrontSide alone reads
  correctly).
- `sandWorm.ts` body material **split** — closed segments use new
  FrontSide-only `bodyMat`, the 2 openEnded head segments use new
  `bodyMatOpen` (DoubleSide) so the maw cavity stays visible. Pre-AAL
  the whole body was DoubleSide (12-segment overkill).
- `tent.ts` walls + end triangles converted from PlaneGeometry +
  DoubleSide to BoxGeometry + ExtrudeGeometry (4cm fabric thickness).
  Reads as real canvas at oblique angles instead of paper.
- `largeTent.ts` back/side walls + roof converted from
  PlaneGeometry + DoubleSide to thin BoxGeometry (4cm). Same fix.
- `satelliteDish.ts` 4 panel materials: kept DoubleSide with comment
  documenting the legitimate use case (parabolic dish is approached
  from both sides — convex back from above, concave reflector from
  below). Backlogged: structural framework geometry for the back face.
- `wrecks.ts:136` + `titleScene.ts` + `ghostPreview.ts`: DoubleSide
  retained (legacy small-wreck path with open-faced pieces; title
  scene is transient; ghost ring needs both sides visible).

**Bundle 4 — Magic-number lift (rule-2 compliance, focused on
gameplay-impactful)**:
- `lootContainers.ts:38-57` loot drop balance lifted to Tuning:
  `LOOT_CONTAINER_ENTRIES_MIN/MAX` (1, 3), 4 drop thresholds
  (`BANDAGE_THRESHOLD = 0.25`, etc.), 2 count maxes, 2 canteen-fill
  constants. Loot drop balance is now Tuning-tunable.
- Cosmetic dimensional constants (deadTree.ts, fire.ts, megaWreck.ts,
  poi.ts decorative pieces) left in their modules — the tuning surface
  benefit doesn't justify the Tuning bloat. Backlogged note: revisit
  if a "rebalance world density" session ships.

**Audit follow-ups deferred** (in backlog):
- Stamina tow factor 2x: dialog-only decision (would change sled
  travel feel; needs playtest signal first).
- Satellite dish structural-framework backing (~1h refactor for cosmetic
  win).
- Engine block heat-shield back-panel modeling (similar scope).

No save schema change. tsc clean. 13 files touched (12 src + 1 docs
archive).

## Session AAK — 2026-05-21 — AAI multi-seed playtest + flagship placement tightening ✓ verify pass
`verified` — tsc clean; multi-seed snapshot harness ran 5 seeds
(100/200/300/4242/99999) before + after the fixes. All three issues
resolved on every test seed.

**AAI procgen playtest pass.** Booted 5 seeds via the localStorage
pendingSeed handshake, captured flagship positions + distance from
spawn + local terrain roughness for each. Three classes of issue
surfaced + fixed:

1. **Flagships landing past 1km from origin** (seed 200 engine_block
   at 1077m, seed 300 satellite_dish at 1033m, seed 4242 crashed_hull
   at 950m). Undiscoverable in normal play. **Fix**: separated
   flagship scatter bounds from procgen-wreck bounds. New Tuning
   constants `FLAGSHIP_SCATTER_RADIUS_MIN = 200`,
   `FLAGSHIP_SCATTER_RADIUS_MAX = 800`. Procgen wrecks still use the
   wider 120-1100m band.

2. **Mega-ship landing too close to spawn** (seed 99999: 60m-long
   mega_ship at distance 130m from origin, ~108m from player spawn —
   would dominate the opening cinematic view). **Fix**: new Tuning
   `FLAGSHIP_SPAWN_EXCLUSION_RADIUS = 200` (vs procgen-wreck's 80m).
   The 200m exclusion keeps large hero-tier landmarks outside the
   player's immediate ~150m sight zone so the opening reads as
   intentional.

3. **Flagships on steep dune slopes** (seed 100 camp at roughness
   1.27, seed 300 crashed_hull at 0.99, seed 99999 engine_block at
   1.11). Per-spawn flat-spot drift (mega_ship/mega_wreck only)
   couldn't compensate for the worst cases. **Fix**: new Tuning
   `FLAGSHIP_MAX_ROUGHNESS = 0.7` + a `localRoughness(terrain, x, z)`
   helper in `poi.ts` that samples a 5m patch around each candidate
   and rejects positions exceeding the threshold. After fix, max
   roughness across all 5 test seeds is 0.68 (was 1.27).

**Verification across all 5 seeds (before → after)**:
- Max distance from origin: 1077 → 786m (all under 800m cap)
- Min distance from spawn: 108 → 307m (all over 200m exclusion)
- Max local roughness: 1.27 → 0.68 (all under 0.7 gate)

`sampleFlagshipPositions` signature changed to take `terrain` (was
just `rand`); placePOIs call site updated. No save schema change.
2 files touched (tuning.ts + poi.ts).

## Session AAJ — 2026-05-21 — Opening wreck bugfix pass ✓ verify pass
`verified` — tsc clean; preview-eval confirmed (1) godrayCount=0 in
scene (was 1), (2) latheCount=44 (22 outer + 22 inner shells; was 22),
(3) torusCount=2 (rust band + entrance rim; was 1), (4) doubleSideHulls=0
(was 22), (5) tallyBars=14 all with leftSideTallyBars=14 (all marks
on the left wall; pre-AAJ they were centered floating in midair).

Four bugfixes on the opening wreck flagged from a playtest screenshot.

- **AAB godray cone removed**. The additive light beam from the
  skylight gap to the floor read as theatrical / unrealistic.
  `updateOpeningWreckGodRay` stubbed to no-op (preserves main.ts
  import without coupled change). The 6 OPENING_WRECK_GODRAY_*
  Tuning constants retained as commented baseline for any future
  re-introduction. Natural lighting through the skylight slice gap
  is now the only interior illumination.
- **Entrance enterable**. Three changes together: `R_TAIL_RIM 1.4 →
  1.6m` (player capsule diameter 0.7m now has comfortable clearance);
  `R_TAIL_BODY 1.5 → 1.65m` (matches the wider rim); entrance
  fragments reduced 4 → 2 with smaller dims (was 0.55+0.55w / 0.40+0.45h,
  now 0.40+0.35w / 0.30+0.30h) — they were reading as "wings/fins"
  obscuring the entrance from a head-on view; floor collider half-Z
  bumped `HULL_LEN/2 - 0.2 → HULL_LEN/2 - 0.05` so the floor reaches
  the entrance rim (was a 0.2m terrain gap where the player briefly
  stepped onto bumpy terrain).
- **Hull thickness (drop DoubleSide trick)**. Outer hull materials
  switched from `DoubleSide` → `FrontSide`. New `_hullInteriorMat`
  (BackSide, color 0x2a2218 darker interior tone). New inner shell
  built as a SECOND set of LatheGeometry slices at reduced radii
  (`PROFILE.x - HULL_WALL_THICKNESS`, default 0.04m). From outside
  you see the rusted exterior; from inside the cavity you see the
  darker interior wall; the 4cm gap between them shows as visible
  wall thickness at the entrance + skylight openings. New entrance
  rim torus closes the cross-section gap so looking into the
  entrance from outside reads as a clean torn-metal ring rather
  than a void to the sky. 2 new Tuning constants:
  `OPENING_WRECK_HULL_WALL_THICKNESS` + `OPENING_WRECK_HULL_INTERIOR_HEX`.
- **Tally marks repositioned**. Pre-AAJ they sat on a flat tangent
  plane at z=2.85 (just inside the nose) — but after the RR redesign
  + AAJ thickening, the hull radius there is only ~0.45m and the
  marks (spanning X up to 0.78) floated past the wall surface. Now
  placed on the LEFT cockpit interior side wall just behind the
  skeleton (z=1.55-2.55), with per-cluster X computed from the local
  profile radius at chest-height. Marks remain vertical 0.20m bars;
  cluster runs fore-aft along Z; crossing slash now tilts on the X
  axis instead of Z.

No save schema change. No new modules. tsc clean. 2 files touched
(openingWreck.ts, tuning.ts).

## Session AAI — 2026-05-21 — Procedural world generation (standard 2400m world) ✓ verify pass
`verified` — tsc clean; preview-eval confirmed (1) two fresh boots produce
two different random seeds, (2) custom seed via localStorage produces an
identical world across reloads (flagship + lizard positions match exactly
when re-seeded), (3) save+reload restores seed correctly, (4) all 6
flagship POI types present per seed, (5) speeder/opening scene at the
seed-stable anchor.

**Per-seed worlds within the existing 2400m grid.** No save schema bump
(v9 already had `seed: number`; AAI finally uses it).

**Seed flow** (`src/main.ts:91-126`). New `resolveSeed()` reads:
(1) `localStorage['dustfall.pendingSeed']` if set by titleOverlay's
Advanced entry; (2) existing save's `seed` field via new
`peekSavedSeed()`; (3) inline-rolls a random uint32 if neither. All
3 RNG streams (terrain=seed, scatter=seed+1, biome=seed+17) derive
from this. `ctx.seed` is set at boot; `saveGameState` writes
`ctx.seed` instead of `Tuning.RNG_SEED`. D85 retains
`Tuning.RNG_SEED = 1337` as dev/test fallback (set
`localStorage['dustfall.pendingSeed'] = '1337'` to reproduce pre-AAI
world).

**Flagship POI rejection sampler** (`src/world/poi.ts`, D82). Hardcoded
`POI_LAYOUT` array (6 flagships at fixed coords pre-AAI) replaced with
`FLAGSHIP_KINDS` array + `sampleFlagshipPositions(rand)`. Positions
rejection-sampled in scatterRand stream with
`Tuning.POI_MIN_SEPARATION = 250m` between flagships +
`Tuning.PLAYER_SPAWN_EXCLUSION_RADIUS = 80m` from the opening anchor.
Procgen wrecks (`procgenPoi.ts`) extended to honor the same spawn
exclusion. `_placedFlagshipPositions` cached at module level so
`getAnchorPOIPositions()` returns the rejection-sampled positions for
procgen wrecks + lizard clustering.

**Opening scene seed-stable anchor** (D83). New Tuning constants
`OPENING_SCENE_ANCHOR_X/Z = -50, 0` document the narrative anchor.
Existing `findFlattestSpot` drift (up to 16m) preserved; small enough
to keep the opening recognizable while letting the wreck settle on
non-clipping terrain per seed.

**Title screen Advanced section + seed entry** (`src/ui/titleOverlay.ts`,
D84). Collapsed disclosure under NEW GAME with a uint32 text input
(placeholder = current world's seed). Reveals on click. NEW GAME with
valid input + different from current seed → `localStorage.setItem('dustfall.pendingSeed', ...)`
+ wipe save + page-reload. NEW GAME blank input + save exists → auto-roll
random seed + reload. NEW GAME blank input + no save → handoff (world
was auto-rolled at boot). 6 new CSS classes for the disclosure styling.

**World seed display in controls panel** (`src/ui/tutorial.ts`). New
`#controls-seed-line` div at the bottom of the controls panel; refreshed
on each `showControlsPanel` call to read current `ctx.seed`.
`user-select: text` so players can copy + share. Pure read-only.

**Density bumps** (per user direction; world stays 2400m²).
`POI_PROCGEN_COUNT: 15 → 22`, `CACTUS_TARGET_COUNT: 10 → 14`,
`DEAD_TREE_TARGET_COUNT: 30 → 45`. Procgen worlds now feel denser per
seed without expanding the chunk grid.

**Decisions D82-D85 logged** (4 entries: rejection-sampler unification
friction-2, opening anchor friction-1, seed source flow friction-1,
Tuning.RNG_SEED retained as fallback friction-0).

**Out of scope** (deferred): infinite chunk streaming (Minecraft-style),
seed UI on first-boot reload friction (acceptable trade for randomness),
biome-specific flagship placement constraints (existing per-kind
flat-spot drift handles the worst cases).

## Session AAH — 2026-05-21 — Playtest polish for AAG (Tuning lift + feel tweaks) ✓ verify pass
`verified` — tsc clean; preview confirmed Tuning lift took effect at
runtime (dust motes opacity reads 0.22 in `__game.ctx.dustMotes.
particleMat.opacity`) + salt-flat terrain renders correctly with the
new MIRAGE_NEAR_M ramp + tutorial controls panel correctly intercepts
NEW GAME first-boot.

**Polish pass for AAG.** No new features, no schema bumps. Two CLAUDE.md
rule-2 violations cleaned up + five feel adjustments based on math
analysis of the AAG values.

**Rule 2 lifts (compliance fixes)**:
- **footprintPuffs.ts** — 6 hardcoded constants (PARTICLE_COUNT,
  PARTICLES_PER_PUFF, PUFF_LIFE_S, PUFF_VERTICAL_VEL, PUFF_LATERAL_VEL,
  PUFF_GRAVITY) lifted to `Tuning.FOOTPRINT_PUFF_*`. The module now
  reads them per-call so future tuning iterations land via tuning.ts.
- **interaction.ts** — module-local `PICKUP_SWAP_DURATION = 1.5`
  lifted to `Tuning.PICKUP_SWAP_DURATION_S`. New Tuning import.

**Feel tweaks**:
- **FOOTPRINT_PUFF_VERTICAL_VEL: 0.6 → 0.9**. Original peak height
  v²/(2g) = 0.6²/(2·1.2) = 15cm — barely above the foot mesh. 0.9
  lands ~34cm peak which reads clearly while still feeling like
  "kicked dust" rather than "an explosion."
- **DUST_MOTES_OPACITY: 0.18 → 0.22**. AAG default was too easily
  missed in plain daylight; 0.22 reads in lit interiors (lantern,
  fire, skylight beams) and still stays subtle outdoors.
- **PICKUP_SWAP_DURATION_S: 1.5 → 1.2**. Snappier "hold and move on"
  rhythm; longer than salvage (1.0s, the comparison anchor), shorter
  than the original 1.5 which felt like a deliberation pause.
- **MIRAGE_NEAR_M: 15 → 10**. Closer ramp-in so the wobble registers
  on the immediate horizon when walking the salt pan, instead of
  only at the far field.
- **Dust motes storm cross-fade softened** — hard cut at `storm > 0.8`
  (AAG) replaced with smoothstep `[0.7, 0.9]`. New Tuning constants
  DUST_MOTES_STORM_FADE_START/END. Dust motes now cross-fade into
  ambientDust's storm-peak dominance instead of popping out at the
  hard threshold.

**No save schema change**. No new modules. tsc clean.

## Session AAG — 2026-05-21 — Atmospheric polish + inventory swap-on-full ✓ verify pass
`verified` — tsc clean; preview-eval confirmed footprint puff pool
spawns + dust mote layer particle count + mirage shader uniform
update + swap-on-pickup-full code path (test-mock raycast pollution
is a known eval-methodology limitation, not a real defect).

**Four-item interim polish bundle** — atmosphere + UX QoL. Continuous-
polish items from the roadmap, plus the swap-on-pickup-full feature
called out in the post-AAC kickoff brief.

**Footprint puffs** (`src/world/footprintPuffs.ts`, new ~120 LOC).
Upward dust burst on each player footstep. 60-particle pool, 5
particles per burst, 0.6s life, gravity-affected. Spawned from
`src/player/controller.ts` footstep block when `!wet` (so wet salt-
flats don't kick dust). Sits next to the existing footprint-decal
spawn — same trigger, different visual layer (decal = persistent
print on ground, puff = transient upward burst). Mirrors fire's
ember-particle architecture (pool + reuse + per-frame integration).

**Ambient dust motes** (`src/world/dustMotes.ts`, new ~85 LOC).
Complementary atmospheric layer to existing `ambientDust.ts`. 120
bone-warm-white particles (0xe8dcc0, vs ambientDust's orange-tan),
0.04m size (finer), 0.18 opacity (subtler), slower vertical drift,
persists through storms until intensity > 0.8 (where ambientDust
goes full-opacity and dust motes step back to avoid double-up).
Sits at camera height + 25m spread cube re-centered around the
player each frame. Clone-not-abstract — two atmospheric layers
with different palettes and storm-response curves stay separate
rather than parameterizing one.

**Mirage shader on salt-flat biome** (`src/world/terrainMaterial.ts`).
Vertex shader gains a heat-wobble Y displacement that activates only
on hot salt-flats during high sun. New module-level
`_shaderRefs: Set<ShaderRef>` captures `onBeforeCompile` shader
instances; new `updateTerrainShaderUniforms(time, cameraX, cameraZ,
sunHeight)` exported and ticked from main.ts each frame. Displacement
formula multiplies four masks: distance-from-camera (smoothstep 15→80m
so near-field stays solid), saltness (smoothstep 0.10→0.54 on
`aBiomeRaw`), sun height (smoothstep 0.3→0.9 so only high sun shimmers),
and a sin×cos space-frequency wobble (0.30 + 0.22 spatial freqs, 3.0
+ 2.3 temporal freqs). Peak amplitude 0.18m. 3 new Tuning constants
(MIRAGE_NEAR_M/FAR_M/AMP_M).

**Inventory swap on pickup-full** (`src/player/interaction.ts`). When
the player presses E on a ground pickup but `addItem` returns -1 AND
the currently selected hotbar slot is non-empty, the old behavior
was a "your bag is full" toast — now starts a 1.5s hold-E swap
timer (mirrors the existing `_salvaging` module-singleton pattern).
On completion: drops N copies of the selected slot's item at the
player's feet via `spawnDroppedPickup` (one per stack unit), clears
the slot, then `addItem`s the world pickup into the now-empty slot.
Cancels on key-release. New `_pickupSwap` module state + 4 helper
functions + 1 Tuning constant (PICKUP_SWAP_DURATION_S = 1.5). Closes
a UX rough edge during exploration — full bag now offers a clear
escalation rather than a hard refusal.

**Cooking multi-per-fire deferred**: the user's direction was "hold
off on cooking multi per fire. maybe we can make a grill attachment
to the fire in the future". Added `[feat] fire grill attachment` to
backlog.md as the future vision — craftable add-on that fires accept
to enable parallel cooking (multi-slot cook state on fire instead
of the current single `_cooking` module var).

**No save schema change**. All four items are runtime-only / module-
state / transient.

## Session AAF — 2026-05-21 — 7-day storm countdown ("THE LONG STORM") ✓ verify pass
`verified` — tsc clean; preview-eval confirmed storm curve at multiple
days + HUD text/color states + one-shot toast at day-7 transition.

**Bucket-tier feature**: an escalating-storm endgame that gives
Dustfall a narrative arc. Days 0-6 see storms grow gradually more
frequent and longer; day 7+ enters a permanent dust-choked "long
storm" state where leaving shelter is genuine danger.

**Storm curve** in `src/world/weather.ts`. New exported
`stormCurveAt(daysSurvived)` returns `{intervalMin, intervalMax,
duration}` based on the day. Linear lerp from day-0 values to
day-7-endpoint values across days 0-6 (so day 6 ≈ day-7-endpoint
of the lerp), then plateau onto LONG_STORM values from day 7+. 9
new Tuning constants centralize the curve: LONG_STORM_DAY=7,
STORM_INTERVAL_DAY0_MIN/MAX=360/600, STORM_INTERVAL_DAY7_MIN/MAX=
60/180, STORM_DURATION_DAY0_S=90, STORM_DURATION_DAY7_S=300,
LONG_STORM_INTERVAL_MIN/MAX=30/90, LONG_STORM_DURATION_S=480.

**Storm state machine updated**: `case 'clear' → building`
transition captures `w.currentStormDuration = curve.duration` at
storm-start (so a day-rollover mid-storm doesn't shorten what the
player's already enduring). `case 'storm'` uses
`currentStormDuration` instead of the old fixed `STORM_DURATION`
constant. `case 'settling' → clear` transition computes nextStormAt
from the current-day curve. `seedOpeningStorm` updated to use
`Tuning.STORM_DURATION_DAY0_S` (the gentlest curve) for the opening
cinematic.

**HUD countdown indicator**: new `#long-storm-indicator` DOM in
`src/ui/hud.ts` (created at boot, positioned below the day counter,
top-right of the screen). Pre-day-7: reads "the long storm in N
days" with color lerping from muted brown (far away) to warning
red-orange (imminent) as days dwindle. On/after day 7: reads
"THE LONG STORM" in warning red with a 2.4s slow-pulse animation
(`.imminent` class). Updated each frame in updateHud from
`ctx.time.daysSurvived`. New CSS rules in `src/style.css`.

**One-shot atmospheric beat**: new `weather.longStormAnnounced:
boolean` transient flag. When `updateWeather` sees daysSurvived ≥
LONG_STORM_DAY for the first time, fires `ctx.ui.showToast('the
long storm has come — find shelter')` then sets the flag. Not
persisted across save/load (re-fires once on load if the player is
already in the long storm — acceptable for an atmospheric beat).

**No save schema change** — uses existing `time.daysSurvived` (saved
since A-era) for the day reference.

**Design dial chosen**: escalation via frequency + duration, NOT
raising the peak intensity cap (fog at intensity=1 already chokes
visibility to ~30m). The long-storm phase is about "the storms
never really end" rather than "the storms hit harder." Preserves
player agency — survivors can still play, but life is much harder.

**Verification**: tsc clean. `stormCurveAt(0)` returns baseline
day-0 values (90s storms, 360-600s intervals). `stormCurveAt(3)`
returns mid-curve (195s, 210-390s). `stormCurveAt(7)` returns
long-storm plateau (480s, 30-90s). HUD reads "the long storm in 7
days" with muted brown color at day 0; "the long storm in 1 day"
with warning orange at day 6; "THE LONG STORM" warning banner with
.imminent class from day 7. One-shot toast: NOT announced at day 6
(correctly); announced at day 7 transition (correctly).

## Session AAE — 2026-05-21 — Creature companion (Rocky-inspired) + SAVE_VERSION v9 ✓ verify pass
`verified` — tsc clean; preview-eval confirmed AI state transitions
(rolling at distance / walking mid / idle close), pack-up + redeploy,
save v9 round-trip with companion field.

**Bucket item — pocketable creature companion** modeled on Rocky from
Project Hail Mary. A small (~0.4m) red exoskeleton creature with
5 radially-symmetric legs that follows the player around. **Dual
locomotion state machine**: ROLLING (legs retracted, body rolls
around lateral axis, ~5.5 m/s, kicks in at ≥6m from player) →
WALKING (legs extended + gait sin-wave animation, ~1.8 m/s,
2-6m band) → IDLE (breathing-style body bob, leg-twitch idle
animation, <2m). Hysteresis on transitions so the creature
doesn't oscillate at thresholds.

**New module `src/enemies/companion.ts`** (~290 LOC) — Companion
interface + makeCompanionVisual + spawnCompanionAt + deployCompanion
+ packUpCompanion + updateCompanion. Visual is an IcosahedronGeometry
body with flat-shading (rocky carapace), darker inner shell, single
black eye + white glint near the "front" (+Z local), 5 leg pivots
arranged pentagonally with cylinder+tip geometry. Each leg is its
own Group so it can be lifted/hidden per state. Body uses world
heading rotation; rolling animates `body.rotation.x` accumulating by
`speed / radius` rad/sec; walking animates each leg's local Y
via `sin(t·ω + phase)` with 72° phase offset between legs; idle
uses a slower bob frequency for breathing and quarter-amplitude
leg-twitch.

**Lifecycle**: pre-deployed on every boot at a position computed by
`setupOpeningScene` (3m camera-right of the player's spawn, on the
opening-scene flat ground). Player encounters the creature on first
look-around. New `companion_pod` ItemId + ItemDef in items.ts
(wieldLmb='place', viewmodel = stone-egg shape with warm-red veining
suggesting something alive inside). Player RMBs the deployed
companion to convert it to a pod in inventory; LMBs the wielded
pod to redeploy. Singleton — only one companion per save.

**New `InteractType 'pet_companion'`** in types.ts (passive hover,
no E action, just a noun-only prompt). interaction.ts gains a
`case 'companion'` block + raycast-targets + hover-reset wiring.
wieldAction.ts `handleContextAction` extended: RMB on
hover.type==='pet_companion' AND ctx.companion.hovered →
packUpCompanion. tutorial.ts HINTS entry explains the pod.

**SAVE_VERSION 8 → 9** (D81 additive). New optional `companion?: {
pos, state }` field on `SaveV1`. Serialize iff ctx.companion is
non-null. Loader logic: setupOpeningScene's default spawn runs on
every boot (placing the creature). On v9+ save with companion field
→ teleport the default-spawned creature to the saved pos + state.
On v9+ save WITHOUT companion field + companion_pod in inventory →
despawn the default creature (player carried it before saving).
Pre-v9 saves → keep the default-spawned creature; player meets the
creature for the first time on this load (graceful introduction).

**Plumbing**: ctx.companion: Companion | null on GameContext;
initialized null in main.ts ctx; `spawnCompanionAt(ctx, ...)` called
right after `setupOpeningScene` using the returned
`companionSpawnPos`; `updateCompanion(c, dt)` in tick after
`updateLizards`. New Tuning constants: COMPANION_BODY_RADIUS=0.20,
LEG_LENGTH=0.14, COLOR_HEX=0xb04030, DARK_COLOR_HEX=0x6e2818,
ROLLING_SPEED=5.5, WALKING_SPEED=1.8, CLOSE_DISTANCE=2.0,
FAR_DISTANCE=6.0, FOLLOW_OFFSET=1.5, IDLE_BOB_AMP=0.04,
IDLE_BOB_FREQ_HZ=1.2, LEG_GAIT_FREQ_HZ=4.0, LEG_GAIT_AMP=0.06.

**Verification**: tsc clean. Spawned at boot in 'idle'. Player
teleported 20m away → state switched to 'rolling', creature rolled
5.50m in 1.0s (matches spec speed exactly). Player back within
2m → state switched to 'idle'. Pack-up: companion → null, pod
added to inventory. Redeploy: new Companion object created. Save
written at v9 with companion field populated. (Screenshot capture
hit the known preview-tool timeout from
`memory/dustfall_preview_gotchas.md`; mesh is conventionally-
constructed so visual is trusted.)

## Session AAD — 2026-05-21 — Polish playtest pass for AAC kits ✓ verify pass
`verified` — tsc clean; screenshot-driven inspection confirmed both fixes
visually + ghost preview ring sizes now per-kit.

Polish playtest of the AAC home-building loop surfaced two real
issues. Both fixed inline.

**Issue 1 — Ghost preview rings sized 0.80m for all 3 new kits.**
`KIT_PREVIEW_RADIUS` in `src/player/ghostPreview.ts` only had entries
for the pre-AAC kits (fire/tent/largeTent/sled), so the new
bedroll/lantern/locker fell through to the default radius — too big
for lantern, too small for bedroll's long axis, sort-of-right for
locker. Added three entries: `bedroll_kit: 0.95` (covers the 1.6m
pad's half-length + pillow), `lantern_kit: 0.30` (small footprint
matching just the base disc), `locker_kit: 0.65` (chest footprint
~1.0 × 0.6).

**Issue 2 — Bedroll was nearly invisible against sand terrain.**
Top-down screenshot revealed the 6cm-thick pad in tan `0x9a7b5a`
blended into the salt-flat / dune terrain colors. From oblique
gameplay angles the pad essentially disappeared. **Fixes in
`src/world/bedroll.ts`**: (1) pad color darkened to `0x4a3a26`
(deep brown), reads against any biome's ground. (2) pad thickness
bumped 0.06 → 0.12m so the silhouette holds at oblique angles.
(3) pillow taller (0.10 → 0.16m) for a clearer head-end marker.
(4) added a folded-blanket mesh at the foot end (`0x5e4830`, slightly
shorter than the pillow) so the bedroll now reads as a clear
"head + body + foot" sleeping spot rather than a blob.
(5) cross-fold strips on the pad darkened to `0x3a2c1a` for visible
texture against the new pad color.

Screenshot before-and-after: pre-fix top-down showed only the
lantern light pool + locker box, no bedroll silhouette. Post-fix
top-down shows three distinct objects; eye-level oblique view
shows the bedroll with clear pillow / pad / folded-blanket
structure at the foot.

No save schema changes, no new modules, no new D-entries — purely
visible polish on existing AAC work.

## Session AAC — 2026-05-21 — Craftable home (bedroll + lantern + locker) + SAVE_VERSION v8 ✓ verify pass
`verified` — tsc clean; preview-eval confirmed recipes 11/12/13 +
deploy/pack of all 3 kits + lantern flicker + locker pack-refuse-
when-non-empty + save round-trip at v8 with all new fields.

**Three new craftable+placeable+packable kits.** Player builds their
own customized temporary home anywhere — lay a bedroll, set a
lantern, place a locker — and packs them up when moving on.

**`bedroll_kit`** (ItemId + ItemDef wieldLmb='place'; recipe id 11
= cloth×3 + branch×1). New `src/world/bedroll.ts` (~145 LOC) — flat
cloth pad + pillow + subtle fold lines. ShelterZone covers the pad
(small zone, full-kill storm dampening like small tent). Tagged
'sleep' so E opens the sleep overlay (reuses existing UX). Deploy
at `Tuning.PLACEMENT_DISTANCE_M = 2.2` with rotation 90° to the
player's facing (head-end perpendicular to approach direction).

**`lantern_kit`** (id 12 = cloth×2 + scrap×2 + branch×1). New
`src/world/lantern.ts` (~175 LOC) — vertical wood post with glass
globe, warm PointLight (intensity 1.6, distance 14m, color
`0xffc080`). Never burns out. New per-frame
`updateLanterns(ctx)` in main.ts tick — sin-driven flicker on
intensity + globe opacity (two desynced sines per-instance via
random `flickerSeed`, ±10% amplitude). NO shelter zone — lantern
illuminates but doesn't shelter. Hover is passive (no E-action; RMB
to pack).

**`locker_kit`** (id 13 = scrap×4 + branch×2). New
`src/world/locker.ts` (~160 LOC) — wooden chest + 3 metal banding
strips + latch. New `InteractType: 'open_locker'`. E opens the
existing loot menu with `allowDeposit: true` (same pattern as sled
cargo from QQ-2; bidirectional). `Locker.contents: LootEntry[]`
persists in save. **Pack-up refuses if non-empty** (toast: "empty
it first — the chest still has things in it") — prevents
unrecoverable cargo-in-packed-kit state.

**SAVE_VERSION 7 → 8** (D81 — additive only). New optional fields
on `SaveV1`: `bedrolls?`, `lanterns?`, `lockers?` (with contents).
Loader accepts v1-v8. Pre-v8 saves load with empty arrays for all
three. Each kit follows the same save/load shape as small/large
tent: clear current → replay `spawnXAt` per saved entry →
`setNextXId(maxId)`.

**Plumbing**: `ctx.bedrolls`, `ctx.lanterns`, `ctx.lockers` (with
`open` reference) added to GameContext; initialized in `main.ts`.
`interaction.ts` gains three new registry cases (bedrolls, lanterns,
lockers) + hover-reset + raycast-target additions. Lanterns use a
passive 'sleep' hover (promptNoun only, no [E] chip). Lockers use
new 'open_locker' verb (added to `VERBS` table = "open").
`wieldAction.ts` `handleContextAction` extended: RMB on
'sleep'-hover iterates bedrolls + lanterns (alongside tents);
RMB on 'open_locker'-hover iterates lockers. Tutorial HINTS gain
three entries explaining how to use each new kit. Save loader at
end of file replays all three in order after large tents.

**Verification**: tsc clean. Recipe matches confirmed (id 11/12/13
present, inputs correct). All three kits deploy + occupy correct
lists + spawn shelter zone (bedroll only). Lantern flicker
intensity changed from 1.6 → 1.698 after 0.5s simulated tick.
Locker pack-up refused when contents=[scrap×3]; succeeded when
emptied; kit returned to inventory. Save written at v8 with
bedrolls.length=1 + lanterns.length=1 + lockers.length=0 (locker
was test-packed before save).

## Session AAB — 2026-05-21 — World depth (salvage yield diff + skylight god-rays) ✓ verify pass
`verified` — tsc clean; preview-eval confirmed salvage distribution
profiles + god-ray visibility states.

**Salvage yield differentiation** (`src/world/salvage.ts` TABLES
rebalanced). Each wreck kind now has a clear thematic signature
that drives real exploration choice:
- `engine_cluster` / `engine_bell` — scrap-pure metal. 90-100% scrap×2
  + 50-60% extra scrap + occasional rope (cabling/hoses) + rare
  scrap_bullet (ammo stowed near the engine).
- `fuselage` — cloth-heavy interior textiles. 70% cloth + 30% extra
  cloth + 35% scrap + 25% bandage + 15% rope + 4% flashlight.
- `escape_pod` — medical/survival. 80% bandage + 30% extra bandage
  + 35% cloth + 20% scrap + 8% branch (rare wood scrap).
- `cargo_container` — varied lottery + rope. 45% scrap + 35% cloth
  + 20% bandage + 25% branch + 15% rope + 4% tent_kit.
- `massive` — rich mix including rope (20%) and the rare fire_kit
  (5%) / flashlight (8%) drops.
- **Adds `rope` to the salvage pool** (previously craft-only). Players
  seeking rope can now target fuselages, cargo, or massive POIs.

Distribution verified via 200-roll sampling: engine_bell yields 510
scrap + 11 rope + 0 cloth (essentially pure metal); fuselage yields
199 cloth + 77 scrap + 50 bandage + 32 rope (cloth dominant);
escape_pod yields 221 bandage + 74 cloth + 56 scrap (medical bias);
each kind's profile is now distinct enough that players will notice
"I need rope → these wrecks have it" instead of strip-anything-
nearby.

**Skylight god-rays for the opening wreck** (`src/world/openingWreck.ts`).
Additive cone geometry inside the wreck — narrow tip at the upper
hull surface (where slices 17+18 are omitted = the 30° stress-
fracture from SS), broad base near the floor. Default-down
orientation; warm gold tint (`OPENING_WRECK_GODRAY_COLOR_HEX =
0xffd9a0`). Module-level `_godRayMesh` + `_godRayMat` refs;
exported `updateOpeningWreckGodRay(ctx)` runs each frame after
`updateSky`, computes opacity from `ctx.time.sunHeight` (linear ramp
above `OPENING_WRECK_GODRAY_SUN_THRESHOLD = 0.1`) × `(1 - storm
intensity)` × `OPENING_WRECK_GODRAY_MAX_OPACITY = 0.22`. Beam is
hidden at night and dampened by peak storm (dust blocks the light).
6 new Tuning constants centralize the feel: BEAM_RADIUS_TOP=0.15,
BEAM_RADIUS_BOTTOM=1.2, BEAM_LENGTH_M=5.5, COLOR_HEX, MAX_OPACITY,
SUN_THRESHOLD. Opacity dynamics verified: 0.171 at sunHeight=0.8 clear,
0 at sunHeight=0.05 night, 0 at intensity=1.0 storm peak (regardless
of sun).

## Session AAA — 2026-05-21 — First-impression polish bundle (E-take revert + ghost preview + vignette threshold + recipe book + crosshair .dead) ✓ verify pass
`verified` — tsc clean; preview confirmed 4/5 surfaces (E-take static-
verified, raycast-driven path not eval-testable without camera-pointing
gymnastics; code path canonical pre-UU shape). Five discrete polish
items bundled, closing loose ends from the overnight era.

**UU pickup migration reverted**: E is the canonical take/pickup
button again. `interaction.ts` case 'pickups' restores the addItem +
despawnPickup E-press handler. `VERBS['take'] = 'take'` so the [E]
chip shows. `wieldAction.ts` `handlePickupTake()` removed; LMB's role
narrows to "use the wielded item" (attack/place/hold_use). `tutorial.ts`
CONTROLS table reflects: LMB "attack / place kit"; E "take / open /
sleep / mount / read / refill / harvest / cook / salvage". The UU
architecture (wieldAction.ts dispatcher + wieldLmb field on ItemDef)
stays — only the pickup-take piece reverts.

**Ghost preview for LMB-place** (`src/player/ghostPreview.ts`, new
~135 LOC). A single reusable Group on the scene (RingGeometry + small
vertical pole, additive gold tint). Per-frame: positioned at camera
+ forward × PLACEMENT_DISTANCE_M, Y projected via terrain.heightAt.
Ring scaled per kit via `KIT_PREVIEW_RADIUS` table (fire_kit 0.35m,
tent_kit 1.0m, large_tent_kit 1.6m, sled_kit 0.9m). Hidden when no
kit wielded / overlay open / mounted / not isPlaying. Closes UU's
deferred scope-cut #1 — players now SEE where the kit will land.

**Storm vignette ramp lowered** (D79 follow-up): `STORM_VIGNETTE_RAMP_START`
new Tuning constant = 0.3 (was hardcoded 0.4 inline). At perceived
0.4 (large-tent shelter peak), vignette opacity now ≈ 0.03 (was
exactly 0). Closes D79's last visual gap — players inside the
open-front cabin during a peak storm now see SOME tint.

**Recipe book panel** (`src/ui/recipeBookPanel.ts`, new ~145 LOC).
TAB-key modal listing `ctx.inventory.discoveredRecipes` as rows with
output icon + name + ← + input icons. Sorted by recipe id. Closes
on TAB / Esc / close button. Empty state: "(no recipes discovered
yet — try combining items via C)". Reuses existing `.craft-*` CSS
classes for consistency. Closes TT's deferred stretch. New CONTROLS
row added in tutorial.ts. Overlay-open gates extended across
interaction.ts + wieldAction.ts + ghostPreview.ts.

**Crosshair .dead state**: distinguishes corpse-loot from
ground-pickup hover. New `_lastCrosshairState` enum extended:
'interactable' (ground pickup) | 'kill' (live enemy, red) | 'dead'
(corpse, muted brown). Hover dispatch checks `hover.type === 'take'
AND hover.itemId ∈ CORPSE_ITEM_IDS` (raw_lizard_meat / raw_worm_meat)
to fire .dead. CSS rule in style.css.

**Verification**: tsc clean across all 5 items. Preview-eval
confirmed ghost preview shows/hides correctly per wielded item;
vignette opacity at perceived=0.4 = 0.03 (>0); recipe book opens
with 3 rows from discoveredRecipes=[1,3,10] + closes properly;
crosshair fires 'dead' on raw_lizard_meat hover and 'interactable'
on branch hover. First-impression polish bundle shipped.

## Session ZZ — 2026-05-21 — Soundscape reads perceivedIntensity (audio half of YY's split) ✓ verify pass
`verified` — tsc clean. Tiny follow-on session: completes YY's audio
side. `src/audio/soundscape.ts`'s `storm` local variable (used by
the wind layer + ambient-life suppression + tense music ramp) now
reads `ctx.weather.perceivedIntensity` instead of `intensity`. Two
lines changed (live tick at line 151 + debug snapshot at line 212).
**Effect**: inside a large tent during a peak storm, the wind layer
crossfades down toward the calm/breeze baseline, ambient life
suppression eases (you might hear distant birds again at lower
storm levels), and tense music doesn't swell as hard — the entire
soundscape relaxes coherently with the visual dampening shipped in
YY. Inside a small tent / fire shelter (legacy fully-enclosed →
perceivedIntensity = 0), wind/music both go to the calm baseline
immediately. Outside any shelter, unchanged. **Note**: the
`AudioStateSnapshot.storm` field (exposed via `__game.audioState()`)
now reports perceived rather than world-truth — keeps the debug
view aligned with what the player is actually hearing. **Backlog**:
the audio-extension item closed. Sixth (and final?) session of the
overnight era.

## Session YY — 2026-05-21 — Storm visual dampening inside large tent (perceivedIntensity split) ✓ verify pass
`verified` — tsc clean; eval-driven preview confirmed routing: outside any
shelter → perceivedIntensity = intensity (full storm); inside small
tent / fire (legacy fully-enclosed) → 0 (current behavior preserved);
inside large tent (open-front cabin) → intensity × 0.4 (40% dampened).
**Completes XX's vision** — the scope-cut #1 from XX (storm visual
dampening when inside the new walk-in tent). The pre-YY system used
a binary `player.inShelter` check to suppress dust + vignette
entirely when in any shelter. Now the system distinguishes by
"openness" of the shelter. **`weather.perceivedIntensity: number`**
added to the Weather interface. Computed by `updateShelter` each
frame (after the existing inShelter check). **`isLargeTent?: boolean`**
flag added to `ShelterZone`; `addShelterZone` accepts new `opts?:
{ isLargeTent?: boolean }` parameter. `largeTent.ts` passes
`{ isLargeTent: true }` when registering its zone; small tent + fire
zones leave the flag default-undefined (= fully enclosed).
**`updateShelter` extended**: walks zones once via new
`classifyShelter` helper returning `{ inShelter, inLargeTent }`. The
write order: `inLargeTent → perceived = intensity × LARGE_TENT_STORM_DAMPEN
= 0.4`; `inShelter → perceived = 0`; otherwise `perceived = intensity`.
**`weather.ts` updateWeather** now reads `perceivedIntensity` for
the 3 dust-layer opacity ramps (replacing the prior `inShelter ? 0
: ...` binary). **`stormVignette.ts`** also reads `perceivedIntensity`
instead of `intensity` and drops the `inShelter` override — both
checks are now baked into perceivedIntensity itself. **Fog stays on
`intensity`** (world-truth state — outside the tent the air IS
still that thick; the tent doesn't change the world, just what the
player perceives from inside). Stats + AI also still on intensity.
**Decision D79** logged. New Tuning constant
`LARGE_TENT_STORM_DAMPEN = 0.4`. Continuation work after the
overnight queue closed; one polish session realizing the deferred
XX item.

## Session XX — 2026-05-21 — Larger enterable tent + SAVE_VERSION v7 ✓ verify pass
`verified` — tsc clean; eval-driven preview confirmed deploy + pack-up +
inventory-full refuse + inside-tent refuse path + save round-trip with
v7 written. Final session of the 5-session overnight queue. **New
ItemId `large_tent_kit`** — wieldLmb='place', LMB-click deploys via
`deployLargeTent`. **Recipe id 10** in `recipeDiscovery.ts` (cloth×4
+ branch×3 + rope×1 → large_tent_kit). D71 contract preserved: ids
1-9 untouched, new recipe gets next-highest unused id. **New module
`src/world/largeTent.ts`** (~250 LOC) mirrors `tent.ts` but with
walk-in interior: 3.5×2.5×2.2m frame, 4 corner posts, cloth-draped
walls (back + 2 sides + roof), open front face. `deployLargeTent`,
`spawnLargeTentAt`, `packUpLargeTent`, `findLargeTentById` exported.
Shelter zone covers interior cavity only (smaller than external
footprint — player must actually be inside). `packUpLargeTent`
**refuses if player is currently inside** the tent's shelter zone
(toast: "can't pack — you're inside the tent"). **D80** logged: two
modules cheaper than one parameterized tent.ts (the collider
geometry diverges). **GameContext extended**: `largeTents: { list:
LargeTent[] }`. `main.ts` initializes empty list on boot.
**`interaction.ts`** gains a `'largeTents'` registry case — same
'sleep' hover verb so E opens the sleep overlay identically; UU-2's
RMB pack-up dispatch in `wieldAction.ts` extended to also iterate
ctx.largeTents.list when hover.type='sleep'. **Save schema v6→v7**
(D81): new optional `largeTents?: Array<{id, pos, rotationY}>` field.
Loader accepts v1-v7. Pre-v7 saves arrive with `largeTents===
undefined` → loader treats as empty array. Save: serialize
`ctx.largeTents.list`; Load: clear current, replay `spawnLargeTentAt`
+ `setNextLargeTentId` for each entry. Additive-only migration —
no existing fields touched. **Pre-committed scope-cut #1 taken**:
`weather.perceivedIntensity` split (storm visual dampening when
inside the tent) DEFERRED — large tents shelter via the existing
ShelterZone mechanism (cold drain etc. handled), but storm visuals
inside the tent stay at full intensity. Documented as a future
polish item. **Verification**: recipe match correct; ItemDef shape
correct (name SHELTER TENT, wieldLmb=place); deploy adds 1 tent + 1
shelter zone; pack-up removes both + returns kit; save writes v7 +
1 largeTents entry. **Fifth and final** of the 5-session overnight
queue. Decisions D80 + D81 logged.

## Session WW — 2026-05-21 — HUD micro-polish (stat vignettes + stamina wobble + prompt fade) ✓ verify pass
`verified` — tsc clean; eval-driven preview confirmed all 3 polish items
ramp + suppress correctly. Three visible-at-first-boot wins. **Stat
warning vignettes** — new `src/ui/statVignette.ts` (CSS-overlay, not
in-scene shader since stat warnings are HUD-tier not atmosphere; D78).
Two `<div>` overlays (`#stat-vignette-cold` blue, `#stat-vignette-thirst`
brown/sepia) with radial-gradient backgrounds; opacity tweaked per
frame from `ctx.stats`. Cold triggers when `ctx.stats.temperature <
-Tuning.COLD_VIGNETTE_THRESHOLD` (i.e. `< -0.3`); thirst triggers when
`ctx.stats.thirst < Tuning.THIRST_VIGNETTE_THRESHOLD` (0.25). Linear
ramp to `STAT_VIGNETTE_MAX_OPACITY = 0.35` at the extreme.
**Suppressed when `ctx.weather.intensity > 0.7`** so peak storm tint
isn't triple-stacked. Hooked into main.ts tick after
`updateStormVignette`. **Stamina screen wobble** — new
`src/player/staminaWobble.ts`. Sin-driven camera-position jitter when
`stamina < Tuning.STAMINA_WOBBLE_THRESHOLD = 0.2`. Two desynced sines
(X at base freq, Y at 1.37× with +1.3 phase offset, half amplitude)
read as "ragged breathing" rather than digital noise. Magnitude
scales with depth into the danger zone, capped at
`STAMINA_WOBBLE_MAX_M = 0.04`. Frequency `STAMINA_WOBBLE_FREQ_HZ = 6`.
Hooked AFTER `updatePlayer` so the player-controller's camera-anchor
runs first; additive jitter is fresh each frame (no cumulative
drift). Suppressed when paused or mounted. **Interact-prompt fade**:
`#interact-prompt` CSS transition bumped from `0.15s` → `0.12s
ease-out` (matches brief spec). **Verification**: cold vignette
0→0.35 across temp 0→-1; thirst vignette 0→0.35 across thirst 1→0;
storm peak forces both to 0; wobble produces non-zero Δ when stamina
low; wobble suppressed by mount-gate; prompt CSS transition reads
`opacity 0.12s ease-out`. Decision D78 logged (vignette pattern
clone vs. unify). Fourth of 5 overnight sessions; XX (larger
enterable tent) next.

## Session UU-2 — 2026-05-21 — RMB context actions + controls panel refresh ✓ verify pass
`verified` — tsc clean; eval-driven preview confirmed RMB pack-up + full-
inventory refuse + mounted gate. **RMB dispatch** added to
`src/player/wieldAction.ts` via new `handleContextAction(ctx)` helper —
runs between mount-gate and the LMB wieldLmb switch, reads
`mousePressed.has(2)`, dispatches off `ctx.inventory.hover`. All
existing gates (overlay-open, mounted, isPlaying) inherit from
`updateWieldAction`'s early-returns — RMB respects them automatically.
**`packUpTent(ctx, tent)`** in `src/world/tent.ts` mirrors `deployTent`:
try `addItem('tent_kit')` FIRST — if inventory full (-1), refuse with
toast "no room in your bag" + tent stays placed (no silent
destruction). On success: `removeShelterZone`, `scene.remove(mesh)`,
`splice` from tents.list, toast "tent packed". **RMB-on-sled (speeder
tether only)**: reuses existing `detachRope(ctx, sled, 'rope released')`
when `hover.type === 'open_sled' || 'attach_rope'` AND `sled.tether.kind
=== 'speeder'`. **Controls panel refresh** (`src/ui/tutorial.ts`):
CONTROLS table updated — LMB row "attack / place kit / take pickup",
new HOLD LMB row "drink canteen continuously", new RMB row "pack tent /
release sled rope", E row tightened to "open / sleep / mount / read /
refill / harvest / cook / salvage". Q demoted to "use selected item
(backup)". HINTS table: canteen hint references hold-LMB; fire_kit /
tent_kit hints reference LMB-click + RMB pack-up. **Verification
PASS**: tents 1→0 on RMB pack-up, scene -1 child, tent_kit back in
inventory; full-inventory refuse leaves tent intact; mounted=true
blocks RMB. Third of 5 overnight sessions; WW (HUD micro-polish) next.

## Session VV — 2026-05-21 — Tuning lift + crosshair feedback + as-any fix ✓ verify pass
`verified` — tsc clean; eval-driven preview confirmed crosshair class
toggling across hover states (interactable / kill / cleared).
Palette-cleanser session between UU and UU-2 (both interaction-
dispatch refactors) — different files, different mental model.
Three discrete shippable wins bundled. **Fire constants lifted**:
src/world/fire.ts's 5 local constants (`FIRE_INITIAL_FUEL=90`,
`FIRE_FUEL_PER_BRANCH=30`, `SHELTER_RADIUS=2.2`, `SHELTER_HEIGHT=1.5`,
`NEAR_FIRE_DISTANCE_SQ=1.5²`) → `Tuning.FIRE_INITIAL_FUEL_S` /
`FUEL_PER_BRANCH_S` / `SHELTER_RADIUS_M` / `SHELTER_HEIGHT_M` /
`NEAR_DISTANCE_SQ`. Values unchanged. **Tent constants lifted**:
src/world/tent.ts's 2 local constants
(`TENT_SHELTER_HALF={x:1.8,y:1.4,z:1.8}`, `NEAR_TENT_DISTANCE_SQ=2²`)
→ `Tuning.TENT_SHELTER_HALF_X/Y/Z` + `TENT_NEAR_DISTANCE_SQ`. The
`TENT_SHELTER_HALF` object kept locally for readability — it now
just composes Tuning values. **Crosshair feedback**: `#crosshair`
in `src/style.css` extended with `.interactable` and `.kill`
modifier classes (brighter+larger / red+larger). New `updateCrosshair`
logic appended to `updateInteractPrompt` in `src/ui/interactPrompt.ts`
— same per-frame cadence, derives state from `ctx.inventory.hover`
(null → default; type='kill' → kill; otherwise → interactable).
Cached DOM ref + last-state guard so we only flip classes on
transitions, not every frame. **`as any` fix**: lone cast in
`src/world/wrecks.ts:137` (`(cached as any).side = THREE.DoubleSide`)
replaced with direct `cached.side = THREE.DoubleSide` — three.js's
`Material.side` exists in the typedef; the cast was a leftover from
a stricter ambient type. `eslint-disable-next-line` comment also
dropped. **Codebase status**: `Grep "as any" src` returns 0 matches.
**Decision D76** logged: fire+tent constants migrated to tuning.ts
(CLAUDE.md rule compliance).
Plan called out 4 pre-committed scope-cuts; none triggered. Session
shipped on the fast-path. Second of 5 overnight sessions; UU-2 next.

## Session UU — 2026-05-21 — Control scheme overhaul — LMB-leaning ✓ verify pass
`verified` — tsc clean; eval-driven preview verification exercised every
LMB scenario (hold-drinking trajectory, kit placement, pickup-take,
overlay gate, mounted gate, save round-trip with holdProgress strip,
weapon-LMB-doesn't-take, rope-wieldLmb-none preserves QQ-2 attach path).
Migrates the "E for every interaction" model to a click-driven scheme
closer to The Long Dark / Rust / Subnautica. **Architecture (D73)**:
new `src/player/wieldAction.ts` is the SOLE LMB-while-wielded
dispatcher. All gates (overlay-open, mounted, isPlaying) live in one
file. `updateCombat` is invoked FROM wieldAction when the equipped
item's `wieldLmb === 'attack'` — removed from `main.ts`'s direct tick.
**Schema (D74)**: new optional `wieldLmb?: 'attack' | 'place' |
'hold_use' | 'click_use' | 'none'` field on `ItemDef`. Default
`'click_use'`. Per-item overrides: weapons (machete/pipe_staff/
scrap_gun/energy_pistol) = `'attack'`; canteen = `'hold_use'`; kits
(fire_kit/tent_kit/sled_kit) = `'place'`; torch/flashlight/rope =
`'none'`. **Behaviors shipped**: (1) hold-LMB sustained drinking via
`slot.meta.holdProgress` + new `ItemDef.onHoldTick` hook — mirrors
D58 cook-progress pattern, NOT module singletons (HMR-safe). New
Tuning constant `CANTEEN_DRINK_INTERVAL_S = 0.7` — one gulp per
0.7s of hold. (2) LMB-click placement for kits — reuses each kit's
existing `onUse` (deployFire/deployTent/deploySled) routed via
wieldAction. (3) LMB-take a hovered ground pickup when wielding a
non-attack item — replaces the E-press take in `interaction.ts`'s
case `'pickups'` (E removed from that block). (4) `[E]` chip
auto-hides for `hover.type === 'take'` since `VERBS['take']` is now
empty. **Placement distance unified (D75)**: new
`Tuning.PLACEMENT_DISTANCE_M = 2.2` lifted to fire.ts/tent.ts/sled.ts;
fire.ts previously placed at 1.5m, which felt closer than the other
kits — now all three deploy at 2.2m (just past arm's reach, at the
edge of the fire's shelter zone). **Verb table tightened**:
`VERBS['search'] = 'open'` (loot containers OPEN, not search).
**Save schema preserved**: `SAVE_VERSION` stays at 6;
`slot.meta.holdProgress` is stripped in `cloneSlot()` so transient
input state never persists (a save during a hold doesn't resume
mid-drink). **Footguns pre-empted**: crafting menu CRAFT button's
DOM-LMB is gated by overlay-check; mounted speeder routes LMB to
combat unconditionally (kits don't deploy from the speeder); rope's
LMB-on-sled-stub stays in `interaction.ts` (needs hover-state to
dispatch, can't move to wieldAction). Q-key path (`updateInventoryInput`)
preserved as backward-compat — Q + canteen = one gulp, Q + kit =
deploy, same as pre-UU. Decisions D73-D75. First of 5 overnight
sessions queued (VV → UU-2 → WW → XX next).

## Session TT — 2026-05-21 — Crafting rework — combine-to-discover ✓ verify pass
`verified` — tsc clean; eval-driven playtest exercised the full
discovery flow + save/load roundtrip + v5→v6 migration path.
Replaces the explicit `RECIPES` list UI with a **Minecraft-style
combine-to-discover** model: 4 input slots (multiset, order-
insensitive), 1 output preview slot, CRAFT button. Player clicks
inventory rows to add items; clicks input slot to remove. Output
preview shows `?` for valid-but-undiscovered combos, the actual
output icon for discovered, "nothing happens" for invalid. On first
successful craft of an unknown recipe, the recipe id is added to
`inventory.discoveredRecipes` with a toast ("you've figured out how
to make X"). **Data model**: new `src/inventory/recipeDiscovery.ts`
(~170 LOC) — `Recipe` shape with stable numeric ids (1-9 for the
existing recipes), `canonicalInputKey()` sorts + serializes the
input multiset, `matchRecipes()` returns array (zero / one / many)
so the chooser UI handles future recipe overlaps. None of the 9
current recipes overlap; the chooser path is architectural-only.
**Save schema**: `SAVE_VERSION 5 → 6`. `inventory.discoveredRecipes:
number[]` persists. Pre-v6 saves get `ALL_RECIPE_IDS` seeded on
load so existing playtesters keep their accumulated knowledge.
**UI rewrite**: `src/ui/craftingMenu.ts` end-to-end (319 → ~330 LOC);
new CSS classes (`.craft-combine-row`, `.craft-input-slot`,
`.craft-output-slot`, `.craft-output-unknown`, `.craft-chooser`,
`.craft-bag-row`). Close-button flushes remaining inputs back to
the player's bag. **Edge case verified**: inventory-full refund —
if `addItem` returns -1 on output, the consumed inputs are returned
to inventory AND discovery is NOT recorded (gated on successful
output). The original DEBUG_STARTER_LOADOUT fills all 14 slots, so
the first playtest run hit this path; behavior was correct
(toast "no room for the result", inventory restored). Decisions
D70-D72.

## Session SS — 2026-05-20 — Opening wreck playtest + polish ✓ verify pass
`verified` — tsc clean; first framework-managed session post-retrofit;
eval-driven playtest from interior camera positions caught a latent
RR bug (interior was invisible). **Critical fix**:
`createRustedHullMaterial` returns `MeshLambertMaterial` with default
`side: FrontSide`. The 22 lathe slices of the opening wreck were
back-face-culled from inside the cockpit — players walking in would
have seen "open desert + floating debris" instead of the enclosed
hull. Patched `openingWreck.ts` to set `_hullMat.side =
THREE.DoubleSide` + `shadowSide: FrontSide` on both `_hullMat` and
`_hullDarkMat` (shadowSide prevents the interior surface from casting
shadows back into the cavity). RR was eval-verified from outside
positions only; never rendered from an interior camera. **Polish**:
entrance fragments reduced 7 → 4 with upper-half bias — was a
"saw-blade crown" around the rim, now reads as asymmetric torn metal
on one flank. Plate size slightly bumped (`w 0.55+rand*0.55` was
`0.35+rand*0.45`) so fragments read as hull plates not confetti.
**Verified**: tsc clean; interior renders with curved ceiling +
ribbed slice seams + tally marks + salvage panel B + entrance
opening visible from inside; spawn-toward-entrance silhouette reads
as torn-open wreck; save/load roundtrip preserves player + speeder
+ 22 wreck slices + 51 salvageables. **Backlog cleanup**: struck 2
shipped entries ("opening wreck more holes", "opening wreck full
redo"). Decision D69.

## Session RR — 2026-05-20 — Opening wreck full redo (cockpit + tail stub)
`partially verified` — tsc clean; eval-driven structural verification
(wreck spawns at (-53.5, 15.2, -2) with yaw=π/2; 22 of 24 lathe
slices present, the two top slices intentionally omitted for the
skylight; 50+ supporting meshes; save/load roundtrip preserves
player + speeder positions; 51 salvageables registered including 2
new opening-wreck panels) + side-angle + top-down screenshots
confirming the new silhouette. Pointer-locked walk-in test deferred
to the user. Full rewrite of `src/world/openingWreck.ts` (~440 LOC,
replaces the 534-LOC W-era box-walled module) following the
KK/LL/NN/MM modelling vocabulary. **Silhouette**: tapered fuselage
cockpit dome at +Z transitioning through a neck pinch to a tail-
stub body at -Z, with the tail-stub torn open as the entrance.
Hull built as **24 angular LatheGeometry slices** (15° each); the
two slices straddling true vertical are omitted, leaving a genuine
30° stress-fracture skylight running the full length of the upper
hull — real god-rays pass through this gap into the interior.
**Procedural rust shader** (`createRustedHullMaterial` from OO)
applied; alternating slice materials read as panel joints. **3
cockpit window boxes** wrapping the upper-front cockpit shoulder.
**Lateral breach patches** on side flanks at world ±X (initial
implementation had a lathe-local/world-Y axis confusion that
buried half of them — fixed by parametrizing in flank-centric
phi ranges around 0 and π). **7 torn hull-plate fragments**
around the rear entrance rim, with a bottom-110° arc skipped
(`sin(ang) < -0.3`) so the player has an unobstructed walk-in
path. **Antenna stub + crossbar** on the upper cockpit hull;
**rust-band torus** wrapping the tail body. **Per-piece tilted
colliders**: floor slab + cockpit front cap + 2 tilted boxes per
side (lower wall + roof-angled upper wall) + ceiling plate; rear
opening uncollided so the player walks in. **2 salvage panels**
registered as `'fuselage'` salvage kind (upper-rear hull + side
flank) — story-prop opening wreck is now also salvageable per the
session direction; narrative read: "the previous occupant
cannibalized panels for parts before they died". `OPENING_WRECK_EXTENTS`
preserved as the orchestrator contract with new dimensions
(halfX=1.7 / halfY=1.35 / halfZ=3.0 / backZ=2.4). 11 new
OPENING_WRECK_* Tuning constants. `openingScene.ts` + `main.ts`
updated to thread `salvageables` through and use the new
OPENING_WRECK_PLAYER_SPAWN_OFFSET=4.5 constant. Decision D68.

## Session QQ-2 — 2026-05-20 — Sled feel pass + sandworm rescale + hotbar tooltips
`partially verified` — tsc clean; eval-driven verification of the new
rope physics (lockedRotations + inextensible constraint) and HMR
playtest by the user for the visual + UI changes. Follow-up to QQ
addressing the "rope too elastic, sled spins around character" feel
problems. **Rope physics rewritten** (supersedes D65): one-way spring-
damper replaced with an **inextensible-rope constraint**. If `dist <=
SLED_TOW_DISTANCE` the rope is slack and applies no force; if `>`,
position-snap the sled body inward by the stretch + project out the
outward radial velocity component. Sled body rotations LOCKED via
`setEnabledRotations(false, false, false, true)` — verified
applyTorqueImpulse(50) → angvel stays (0,0,0). Visual yaw lerped
each frame toward "face the anchor" via `SLED_YAW_LERP = 0.12` so
the bow tracks the pull direction without physics-driven spin.
Friction back to **0.6** (metal-on-sand) since static friction now
correctly holds slack-rope sleds in place. Rope length 3 → 5m.
**Visual upgrade**: 2-vertex `THREE.Line` replaced with
`Mesh(TubeGeometry, MeshLambertMaterial)` along a 5-point
`CatmullRomCurve3` with parabolic mid-point sag scaled by rope
slack. Radius 0.04m, rebuilt each frame. **New speeder back-bar**:
two short uprights + horizontal crossbar at (0, 0.38, 0.95), named
`speederTowBar`, ref exposed on `SpeederState.towBar`. `updateSleds`
speeder-tether branch now reads `s.towBar.getWorldPosition()` so the
rope visually attaches to the bar mesh. **Sandworm halved**
(MM 240m → QQ-2 120m). All ranges scaled with body size halved
proportionally (BITE_RANGE 25→12.5, LUNGE_RANGE 30→15,
BREACH_ARC_PEAK 40→20, STATIONARY_BREACH_HEIGHT 50→25,
PATROL/DETECTION/DISENGAGE_RADIUS halved). Speeds + durations + HP
unchanged per D49. **Sled cargo bidirectional**: lootMenu widened
with optional `allowDeposit` flag → two-column layout (CARGO + YOU).
Click left = take from sled, click right = deposit from player
inventory. Stackable meta-less items merge with existing entries;
meta-bearing items (canteen fill, ammo, attached-sled-id) push as
new entries to preserve per-stack state. Empty sleds now open
(so the player can stash into them — previously refused). New CSS
classes `.loot-columns`, `.loot-column`, `.loot-col-header`.
**Hotbar tooltips**: hover any non-empty slot → custom-styled
tooltip floats above the slot showing item name (large, beige)
+ description (small, muted). Replaces the native browser `title`.
Position computed via `getBoundingClientRect()` at hover time;
content refreshes if the hovered slot's item changes. **Backlog
cleanup**: struck 4 shipped entries (sand worm, weapon variants,
world+biome rework, satellite dish POI). Replaced generic
"wreck POI rework" with specific "opening wreck full redo" feat
per user direction. Decision D67.

## Session QQ — 2026-05-19 — Sled mechanic — rope-tow flatbed cargo
`partially verified` — tsc clean; eval-driven verification confirmed
all critical paths (deploy / attachRopeToSled / detachRope / spring tow
velocity / snap-distance auto-detach at 8m / transferTetherOnMount +
Dismount / save v5 / load roundtrip restoring tether + cargo + ropeLine
+ rope's `meta.attachedSledId`). Pointer-locked input chain wasn't
exercised — document.hidden throttling + Vite dynamic-import module
isolation are the same gaps NN/OO hit. **New module
`src/world/sled.ts`** (~395 LOC) mirrors tent/fire placement + loot-
container cargo + speeder velocity-follow idiom. Two new ItemIds:
`rope` (wieldable, ties to a sled's rope stub via LMB) and `sled_kit`
(deploys a flatbed entity). Three tagged sub-meshes: cargo deck +
front yoke + rope stub. **Tow physics: one-way spring-damper impulse**
on a dynamic Rapier body with CCD enabled. Mid-impl tuning fix: K=90
+ friction=0.8 caused static-friction stiction (μmg ≈ 78N >
spring 60N at 0.7m err) → bumped to K=220, damp=28, friction=0.25 so
sleds glide on dunes. Lootmenu widened to `OpenContainer` structural
type so both `LootContainer` and `Sled` satisfy. Mount/dismount auto-
promotes a `player` tether to `speeder` and vice versa. Save format
`SAVE_VERSION 4 → 5` — `sleds?` field is optional so v1-v4 saves load.
Recipes: rope = 2 cloth + 1 branch; sled_kit = 2 scrap + 1 branch + 1
rope. Trimmed pipe_staff + energy_pistol from DEBUG_STARTER_LOADOUT to
fit (14/14 cap). Decisions D65-D66.

## Session PP — 2026-05-19 — Weapon variants + combat generalization + dev rAF fallback
`verified` — tsc clean; rAF fallback enables hidden-tab combat
verification for the first time (`ctx.time.elapsed` advances at ~60Hz
even with `document.hidden = true`); confirmed scrap_gun ammo
decrements 6→5 on single LMB press; energy_pistol chargeProgress hits
expected 0.594 at 700ms hold (charge_time 1.2s), clears to 0 on
release; all 5 weapons load with correct meta. **Combat refactor**:
old machete-only `combat.ts` (100 LOC) replaced with a generalized
`_WEAPON_SPECS` lookup table dispatching by `WeaponKind` (`'melee'` |
`'ranged'` | `'charged'`). Shared `fireMelee()` / `fireRanged()` /
`dispatchHit()` helpers. Machete numbers lifted into Tuning constants
(`WEAPON_MACHETE_RANGE/DAMAGE/COOLDOWN`) — no behavior change for the
existing weapon. **3 new weapons** (PP = first combat content since
the machete shipped):
- `pipe_staff` — melee, 2.6m reach (+44%), 0.85s cooldown, 0.55
  damage, **3m knockback** via new `knockbackLizard()` +
  `knockbackRaider()` (sandworm exempt — 240m body doesn't budge).
- `scrap_gun` — ranged raycast, 30m, 1.5 damage, 1.2s cooldown,
  6-round magazine via `slot.meta.ammoRemaining`. Empty-click toast
  + half-cooldown. New `scrap_bullet` item: hold the gun + use
  bullet to reload. Crafting recipe 1 scrap → 2 bullets.
- `energy_pistol` — charged ranged, 18m, 0.50→2.00 damage scaled
  over 1.2s charge time, 0.3s post-fire cooldown. Hold LMB to
  charge (tracked via new `mouseHeld: Set<number>` on InputBundle
  since `mousePressed` clears each frame). Release fires. Chamber
  glow shader interpolates dark→warm-orange→hot-blue-white via
  `updateHeld` hook reading `window.__chargeProgress` (exposed by
  combat.ts to avoid import cycle).
**Dev-mode rAF fallback** (D64) in `core/loop.ts`: when
`document.hidden && import.meta.env.DEV`, `setTimeout(16)` replaces
`requestAnimationFrame` so the game tick runs at full speed in
hidden preview tabs. Production keeps rAF (no CPU burn when user
isn't looking). Unblocks the verification gap that plagued NN+OO
combat work. **Inventory housekeeping**: bumped to 14/14 slots
used (max capacity); trimmed `torch` + `tent_kit` + `alien_fruit`
from DEBUG_STARTER_LOADOUT to fit the new weapons. Player starts
with all 5 weapons + 8 bullets + full magazine in the gun. Decisions
D64.

## Session OO — 2026-05-19 — Procedural shader expansion: hull rust + concrete weathering + dune wind streaks + rocky biome via scatter
`verified` — tsc clean; multi-angle browser screenshots via a new
toDataURL workflow (preview_screenshot tool stalls in hidden tabs;
fallback documented in
`memory/dustfall_preview_screenshot_workaround.md` so future sessions
don't re-investigate). Major procedural-shader pass building on MM's
pattern. **Three new shared material helpers + four terrain/biome
upgrades + a screenshot workflow fix.** New
`src/world/hullMaterial.ts` (~190 LOC) — `createRustedHullMaterial
({baseColor, rustHex?, bleachHex?, streakIntensity?, wearAmplitude?})`
patches MeshLambertMaterial via onBeforeCompile with vertical rust
streaks attenuated by `(1 - vWorldNormal.y)` (drips run DOWN only),
low-freq panel wear, sun bleach via `smoothstep(0.60, 0.95,
vWorldNormal.y)`. D62 baked in. Applied to all 3 flagship wreck
modules (satelliteDish.ts, engineBlock.ts, crashedHull.ts) AND to
shared wrecks.ts hull/rust materials — every procgen wreck inherits
the weathering. Flat-shaded primitives produce per-triangle effect
bands (intentional: reads as per-panel wear states on a riveted plated
hull). New `src/world/concreteMaterial.ts` (~165 LOC) —
`createWeatheredConcreteMaterial({baseColor, leachHex?, stainHex?,
leachIntensity?, aggregateAmplitude?})`. Aggregate noise + mineral
mottling + salt-leach efflorescence (paler streaks, low-Y biased —
salt wicks up from groundwater) + edge grime. Applied to dish
`_concreteMat` + `_concreteDarkMat`. `terrainMaterial.ts` extended:
**wind-streak overlay** on dunes — `(u, v) = world XZ in along-wind /
perpendicular-wind frame`, long primary streaks (`u*0.03, v*0.45`) +
secondary (`u*0.13, v*1.20`) blended at 0.35, brightness ±11% plus a
directional tint shift (warmer on streak ridges, cooler in troughs).
**Rocky biome shader REVERTED** (D63) — first pass at Voronoi
fissures + strata bands + boulder mottling read too similarly to the
salt-flat desiccation pattern. Replaced with the dune-effect path
(gated on `1 - saltness`, which is 1 in rocky) so rocky inherits sand
grain + ripples + wind streaks, with natural dark-brown rocky vertex
color carrying the differentiation. New `src/world/rockScatter.ts`
(~90 LOC) places 520 small IcosahedronGeometry rocks across rocky
biome regions (two tiers: pebbles 0.15-0.4m + medium 0.5-1.2m, random
rotation + Y-flatten, no colliders — deadTree pattern). Rocky biome
now reads as "sand-like ground with rocks strewn across it" — visually
distinct from salt ("crackled flat with wells") and dune ("smooth
dunes with ripples"). Wired into `main.ts` after `spawnCacti`.
**Screenshot workflow fix**: `mcp__Claude_Preview__preview_screenshot`
stalls (hidden-tab issue, reproduced across NN + OO with fresh server
restarts + visibility-API spoofing). `mcp__Claude_in_Chrome` returned
no connected browsers. Pivoted to render → `canvas.toDataURL` →
auto-saved tool-results file → python base64 decode → Read PNG. ~7
captures this session via the new flow. Memory note added with the
full incantation. Decisions D63. Memory:
`dustfall_preview_screenshot_workaround.md` added.

## Session NN — 2026-05-18 — Crashed_hull dedicated module (Wreck POI rework arc complete)
`partially verified` — tsc clean; 49 salvageables total (matches MM
baseline, net zero — old crashed_hull registered 1 'massive' + 1
'engine_bell' = 2, new module registers 2 'massive' panels = 2);
`gl.readPixels` grid sampling confirms renderer drawing terrain +
geometry; **browser screenshot tool stalled** every attempt this
session (two fresh server restarts, visibility-API override,
manual renderer.setSize all failed to unblock) — preview-environment
regression vs. MM, NOT a code issue. Architecture identical to the
proven LL engineBlock.ts pattern. New module
`src/world/crashedHull.ts` (~430 LOC) replaces the 41-LOC inline
`placeCrashedHull` in `poi.ts`. **LatheGeometry-tapered fuselage**
— 14-point profile sweeping tail seal → HULL_R_TAIL 1.2m neck →
HULL_R_MID 2.6m mid-body waist → pinch → cockpit bulge HULL_R_FRONT
1.4m → nose tip; lathe rotated Z=-π/2 so the Y-length axis aligns
with world +X. **Hull detail**: rust band torus + 4 structural rib
torus rings (radius-matched to local profile via interpolation) +
3 cockpit window strips wrapping the upper-front + darkened hull
breach + 2 broken antenna stubs (D60 anchored — `geometry.translate
(0, halfL, 0)` so the foot stays planted when the stub leans).
**Custom tail engine bell** local to the module (NOT reusing the
shared `placeWreck(engine_bell)`): LatheGeometry mirroring
engineBlock.ts (throat → bulged shoulder → pinch → flared rim) +
BackSide inner cylinder + dark backstop disc + rim torus + scar
ring (D48 sandworm-maw trick). Bell rotated Z=+π/2 so mouth opens
in world -X (away from hull). **2 salvage panels**: Panel A on
upper-mid hull (visible from dune approach), Panel B recessed
inside the bell throat (hidden loot — climb the hull, peer into
the bell). **4 per-piece tilted box colliders** via composed-
quaternion `addCHCollider` helper (mirrors engineBlock's pattern):
main fuselage cuboid + walkable upper-hull strip + bell cuboid +
underside wedge. Drops the prior single `attachCompoundCollider`
AABB. No interior + no shelter zone — open landmark (dish stays the
lone shelter POI). `placeDebrisField` preserved (16m, 12 pieces).
`makeFuselage` import kept in poi.ts — still used by
`placeScavengerCamp`. Wreck POI rework arc (LL engine_block + NN
crashed_hull) is now complete; camp deferred as intentionally lean.

## Session MM — 2026-05-18 — Sandworm boss-tier rescale + procedural terrain shader (dunes + salt cracks)
`verified` — tsc clean; multi-angle browser screenshots confirm
sandworm body 240m rearing 50m above the dunes in stationaryBreach,
patrol orbit 140m around (60, 0), detection transitions to alert at
the new 150m range; terrain shader shows dune sand with subtle grain
+ slope coloring at all camera pitches and salt flats with textbook
polygonal desiccation crack pattern (multi-resolution: ~0.67m primary
+ ~0.22m secondary), wet-zone patches, polygon edge-curl rim
brightening. **Thread 1 — Sandworm 10× boss rescale** (D49-preserving):
all SANDWORM_* tuning constants rescaled per a sheet (body 24→240m,
max radius 2→20m, patrol 60→200m, detection 50→150m, lunge range
7→30m, breach arc 5→40m, stationary breach height 8→50m, bite range
4→25m, HP 6→12, bite damage 0.35→0.50). Speeds DELIBERATELY unchanged
(D49: combat must stay dodgeable — player sprint 13.2 m/s vs charge
8 m/s preserves the perpendicular-sidestep dodge window). Hardcoded
sandWorm.ts values that don't belong in tuning also scaled: TREMOR_FAR
35→150 + TREMOR_NEAR 4→25 (match new detection+bite), camera shake
0.06→0.10, particle pool 56→140, burst counts 24-30 → 60-85.
**Thread 2 — Procedural terrain shader** in new
`src/world/terrainMaterial.ts` (~280 LOC): patches stock
`MeshLambertMaterial` via `onBeforeCompile` to inject world-space
noise on top of biome vertex colors. Zero bundle cost (no textures
shipped) — matches the project's procedural-everything ethos (Web
Audio already procedural). Dune effects: domain-warped multi-scale
FBM grain, macro mineral zones, asymmetric scallop ripples (`pow`-
skewed), warm-amber/cool-pale tint shift, slip-face vs stoss-face
slope coloring, heterogeneous grain specks (magnetite/iron/quartz).
Salt effects: multi-resolution Voronoi cracks (primary + secondary
suppressed inside primary), per-cell crack-width variation, polygon
edge-curl brightening (raised crust rim), wet-zone darker patches,
salt-crystal sparkle. **Critical bug fix mid-session** (D62, memory
note): first shader iteration silently MASKED OFF all effects at
extreme camera pitches because `vNormal` in Three.js fragment
shaders is in VIEW space, not world space — looking straight down,
world-up (0,1,0) projects to vNormal.y ≈ 0, killing
flatness-gated effects. Also discovered that
`saltness = smoothstep(0.6, 0.82, diffuseColor.b)` was unreliable
deep in salt biome because vertex color interpolation dragged B
below threshold near biome edges. Fix: terrain.ts now writes a
per-vertex `aBiomeRaw` Float32 attribute (biome noise value); the
shader injects `vWorldNormal = normalize(mat3(modelMatrix) * normal)`
+ `vBiomeRaw` varying and uses both for slope/flatness/biome
detection. Decisions D61 done in LL — this session D62. Memory:
`dustfall_shader_gotchas.md` added with the 4-step shader-debug
stack (vWorldPos → hash → noise primitive → each mask) so the
6-round diagnosis loop doesn't repeat.

## Session LL — 2026-05-17 — Satellite dish polish + engine_block POI rework
`verified` — tsc clean; multi-angle browser screenshots confirm
doorway accessible (lintel mostly above grade, sill 0.4m below
terrain), interior lantern glow visible on walls, dish-back panel
reachable via new exterior ladder, cable B properly anchored to
broken arm tip, 4-tone rust variation visible around dish rim,
engine_block reads as curved 5-bell cluster with recessed emissive
throats + cooling-shroud rings (was boxy 5-cylinder cluster). 49
salvageables register (was 48 → +1 from engine_block going 1→2
panels). **Thread A — dish polish** in `satelliteDish.ts`: exterior
45° ladder on +X wall (rails + auto-spaced rungs) + tilted ramp
collider via composed quaternion (climb to roof, reach the dish-back
salvage panel KK left unreachable); warm interior PointLight
(`0xffa844` × 0.6) + emissive lantern body + steel ceiling hanger;
2 droopy `TubeGeometry`-over-`CatmullRomCurve3` cables on the feed
assembly (cable B anchor bug fixed — was missing focalDist offset);
rust variation `i % 2 → i % 4` (added `_dishPanelRustLight` +
`_dishPanelRustEdge`). `BURY_Y` 2.5 → 1.0 (D61) so the 2.2m doorway
opening sits mostly above grade — KK had it trapped 1.9m
underground; ladder dimensions auto-rescale to the new exterior
height (rise 2.5 → 4.5m). Removed a wrapping `SphereGeometry` burial
dune on user feedback (read as fake — defer for refinement on other
POIs). **Thread B — engine_block rework**: new
`src/world/engineBlock.ts` (~370 LOC) replaces the 31-LOC inline
`placeEngineBlock` in `poi.ts`. `LatheGeometry`-tapered nozzle bells
(throat → bulged shoulder → pinch → flared rim) with `BackSide`
emissive throats + dark backstop disc (D48 sandworm-maw trick) +
char/scar rings; cooling-shroud `TorusGeometry` rings + 4 lengthwise
ribs sleeving the box thrust frame; `LatheGeometry` ablative
heat-shield; 2 `TubeGeometry` fuel hoses; 4 per-piece tilted box
colliders via composed-quat helper (was single
`attachCompoundCollider` AABB that overshot ~1.5m at tilted
corners); 2 salvage panels (frame face + recessed inside center
bell throat). `placeDebrisField` preserved. Decisions D61.

## Session KK — 2026-05-17 — Wrecked satellite dish flagship POI
`verified` — tsc clean; multi-angle browser screenshots confirm the
dish silhouette reads as a Rust-style monumental wreck, no floating
pieces remain across 5 verified angles, walkable interior strip ~3.8m
× 6.8m, all expected colliders + shelter zone + 2 salvage panels
register. Antenna spire retired entirely (zero `'antenna_spire'`
salvageables in the world). Swapped the anchor `antenna_outpost` POI
at (-88, -50) for a new flagship-scale wrecked satellite dish in a
dedicated module `src/world/satelliteDish.ts`: 8×8×5m concrete base
(half-buried) with hollow interior + entrance + sand pile + slope
wedge + shelter zone, 4 corner buttress columns, raised roof rim,
collapsed roof corner chunks, recessed door frame, 3 exterior side
pipes with valve handles; 14m steel tripod (3 legs + cross-bracing +
1 bent broken strut anchored to a leg foot); 16m-diameter parabolic
dish (12 radial panels, 3 missing exposing radial framework + 3
concentric rings underneath, patchwork rust shades); feed horn +
2 feed arms + 1 broken arm anchored at the focal point; interior
props (broken console + monitor + ladder rungs + ceiling pipes);
9 terrain-snapped sand mounds in an apron around the base. Static
colliders for roof + 6 walls + sand pile so player can climb on top
and shelter inside. `'satellite_dish'` removed from `WreckKind` since
this POI is bespoke (matches `placeMegaShip` / `placeMegaWreck`
pattern). Decision D60 (anchor angled cylinders via geometry.translate
instead of manual rotation math — bit me twice).

## Session JJ-2 — 2026-05-16 — Spawn teleport fix + level opening camera
`verified` — tsc clean; preview confirms player teleports to wreck
entrance immediately at boot (was stuck at placeholder origin), and
the opening camera now looks level/forward instead of tilting up at
the entrance arch. **Bug**: `setupOpeningScene` called
`playerBody.body.setNextKinematicTranslation(...)` to teleport the
player, but the game boots PAUSED (title screen up), so no physics
step ever applied the scheduled translation. On NEW GAME the
character controller takes over and overwrites the scheduled
translation with its own (computed from the still-placeholder body
position at origin). Result: player permanently spawned at world
origin, ~52m from the opening wreck. Fix: use `setTranslation(pos,
true)` — immediate, synchronous write — so the body's current
translation is already at the wreck entrance when the controller
first ticks. Also: `PLAYER_SPAWN_OFFSET_FROM_ENTRANCE 1 → 4` so the
wreck reads at a comfortable framing distance, and
`camera.lookAt(entrance.x, spawnY, entrance.z)` (held at camera-Y)
so the opening view is level, no upward tilt onto the arch.
Decision D59.

## Session JJ — 2026-05-16 — UI overlap fixes + scatter clustering + movement-feel tuning + spawn polish
`verified` — tsc clean; preview confirms toast and shelter indicator
both clear the hotbar / stat bars respectively (numerically and
visually); cluster verification numbers show 30 trees across 13
sub-clusters with density mix 0→5 (groves + lone trees), 10 cacti
across 4 patches with 2-3 each; exactly 1 antenna_spire salvageable
remains (the hand-placed `antenna_outpost`); spawn ~5.3m from wreck
entrance with the wreck dominating the opening view. **UI**: toast
bottom `32 → 100px` (clears the hotbar at top ~80px); shelter
indicator bottom `100 → 200px` (clears the stat-bar column at top
~185px). **Clustering**: dead trees now spawn in a two-pass scheme —
3 dense groves (6 trees each = 18) at greedy salt centroids via
`findBiomeCentroid` + a sporadic uniform pass for the remaining 12 so
the world reads as "thickets + lone trees" instead of either
"uniform scatter" or "all-in-one-spot"; cacti spread across 4
patches × 2-3 each (was 1 patch × 10). **Antenna cleanup**: removed
`'antenna_spire'` from `HERO_WRECK_TYPES` and `PROCGEN_WRECK_KINDS`;
hand-placed `antenna_outpost` POI stays as the single antenna in the
world (per backlog "remove antenna tower landmarks"). **Movement**:
`WALK_SPEED 4.2 → 6.0`, `SPRINT_MULTIPLIER 1.7 → 2.2` (sprint 13.2
m/s), new `DEBUG_UNLIMITED_STAMINA` flag pins `stats.stamina = 1`
when set so the sprint gate always passes (for testing); footstep
cadence `1.7 / 1.4m → 3.0 / 4.5m` so step audio at the new speeds
lands at natural 2 / 2.9 steps-per-sec rather than 3.5 / 9.4. **Spawn
polish**: `PLAYER_SPAWN_OFFSET_FROM_ENTRANCE 6 → 3m` so the opening
wreck dominates the player's first view. Cleared the 5 backlog items
that landed.

## Session II — 2026-05-16 — Lizard-on-a-stick cooking + dead-lizard model + held-cook animation + debug starter loadout
`verified` — tsc clean; preview screenshots confirm DEAD LIZARD held as
the lizard mesh, vertical skewer with lizard impaled belly-to-back, cook
animation centered over the fire with twist envelope (still while
extending/retracting, spinning only while held over flames), lizard
hovering above flames not phasing through; numeric craft + eat-recover-
branch verified. Two new items: `lizard_on_a_stick_raw` +
`lizard_on_a_stick_cooked`. `raw_lizard_meat` renamed to DEAD LIZARD
with the actual lizard mesh as viewmodel (no longer an abstract meat
slab); `makeLizardVisual` exported from `enemies/lizard.ts` to share
the geometry. New `buildSkewerMesh(cooked)` helper in items.ts: vertical
0.55m stick (grey grey to match dead-tree palette), lizard impaled at
73% up the stick, slight 3-axis slump tilt + Y=π so the head faces
left. Cooked variant clones the lizard materials and tints them to
charred brown. **Cook architecture** (D58): cook duration bumped 0.6s
→ 3.5s, `lizard_on_a_stick_raw` added to `COOK_MAP`, `tickCooking`
writes `slot.meta.cookProgress` each frame, `viewModel.ts` reads it
and drives a new `playCookAnim` hook on the item def. Skewer
animation: extend forward + pitch down, shifted left to cancel
`VIEWMODEL_OFFSET_X` so the tip lands on the crosshair; twist gated
to t∈[~0.25, 0.75]; lifted Y so lizard hovers above flames. Worm meat
+ cactus pulp got matching extend-and-twist cook anims. Branch
viewmodel + world pickup recolored grey (`0x6e685f`) to match the dead
trees they shed from; branch model + skewer stick both lengthened.
Crafting recipe: 1 branch + 1 raw_lizard_meat → 1 raw skewer.
Eat cooked skewer → +0.35 hunger + 1 branch returned via `addItem`.
**Debug starter loadout** behind `Tuning.DEBUG_STARTER_LOADOUT = true`:
spawn with branches/cloth/scrap/meat/cactus/fruit/fire_kit/tent_kit/
torch/flashlight stocked for crafting iteration without scavenging.
Decisions D58.

## Session HH — 2026-05-16 — World rework #3: procgen POIs + biome-aware AI spawns (+ FF LOD removed)
`partially verified` — tsc clean; numeric checks confirm 28 lizards (was
4 hardcoded), 0 in salt, min radius from origin 74m (above 25m buffer);
48 salvageables (was 33) with procgen-vs-anchor min separation 265m
(above 250m); 9 terrain chunks present, no LOD mesh; visual screenshot
in a 13m dune valley shows single continuous terrain surface, no
floating second-ground / pop-through. New `src/world/procgenPoi.ts`:
rejection-sample placement of ~15 procgen POIs across the chunk band,
min-separation 250m against all already-registered salvageables
(anchors + hero landmarks). `placeProcgenPOIs` reuses the FF/EE
`placeWreck` API + the GG `findBiomeCentroid`-style exclusion pattern.
New `spawnLizardsProcgen` in `src/enemies/lizard.ts`: clusters 1-2
lizards per POI (any biome != salt), tops up via global scatter with
25m spawn buffer, deterministic from the shared scatter RNG. Replaced
4 hardcoded lizards in main.ts. **Also removed the FF LOD ring**
(`src/world/terrainLod.ts` deleted) — its coarse 50m linear interp
poked 10m+ above the chunks' fine detail in dune valleys, causing a
visible "second terrain" with no collider; fog at the chunk-band edge
(density 0.0018 → ~99% opaque at 1200m) serves as the visible horizon.
D52 superseded by D56. `SAVE_VERSION 3 → 4` (pure marker, loader
accepts v1/v2/v3/v4 — id-based scatter persistence handles lizards
4→28 without migration per D55). Decisions D56-D57.

## Session GG — 2026-05-16 — World rework #2: biome rescale + scatter retune
`partially verified` — tsc clean; numeric checks confirm 10 cacti (was 3),
30 dead trees (was 12), 3 wells (was 1) pairwise-separated 1112-1413m (min
400m), all wells + cacti in salt, sandworm home still in dune; visual
screenshot shows vast bone-white salt regions interleaving with dune
sections; save round-trip not exercised but loader accepts v1/v2/v3.
`BIOME_NOISE_FREQ 1/220 → 1/900` (vast ~2.67-region-per-axis biomes in
the 2400m world). New `findBiomeCentroid(biomes, target, options)` in
biomes.ts generalises the old `findSaltCentroid` with greedy
`excludeCenters` for multi-pass placement; waterSources uses it to plant
3 wells across separate salt regions (≥400m apart). Cactus / dead-tree /
hero-landmark counts + radius bounds promoted to tuning constants and
rescaled for the 2400m world (`CACTUS_TARGET_COUNT: 10`,
`DEAD_TREE_TARGET_COUNT: 30`, `HERO_LANDMARK_COUNT_MIN/MAX: 15-20`,
radii out to ~1100m). `SAVE_VERSION 2 → 3` (pure marker bump, loader
accepts v1/v2/v3, no migration code — id-based scatter persistence
handles count growth automatically). Dropped dead `LANDMARK_COUNT: 180`
from tuning (verified unused). Decisions D53-D55.

## Session FF — 2026-05-16 — World rework #1: chunked terrain + bigger map
`partially verified` — tsc clean; seam check passed numerically (Δ <
0.0004m across all four chunk boundaries x=±400, z=±400, and the corner);
preview screenshots confirm continuous horizon out to the LOD ring + no
seam artifacts; full v1-save round-trip not exercised but loader accepts
both versions. Replaced the single 800m heightfield with a 3×3 grid of
TERRAIN_CHUNK_SIZE-meter chunks (default 800m × 3 = 2400m world span) all
sharing one `createNoise2D` instance + world-space sampling for bit-
identical heights at boundaries. New `Terrain.meshes: THREE.Mesh[]` +
`Terrain.noise` (exposed so the far-LOD ring + future procgen can sample
the same noise). New `src/world/terrainLod.ts`: coarse 80×80 square plane
spanning [-2000, +2000], sits at `y=-0.15` to slot under the chunks (no
donut carving needed — chunks always win the depth fight in the band).
`SAVE_VERSION` 1 → 2 as a pure marker bump; loader accepts both versions
(no schema change). Tuning bumps: `FAR_PLANE 600→1800`, `WORLD_RADIUS
280→900`, `FOG_DENSITY_CLEAR 0.0035→0.0018`, `SHADOW_CULL_DISTANCE
80→120`. Biome wavelength + POI placements + AI spawns intentionally
unchanged (sessions #2 + #3). Decisions D50–D52.

## Session EE — 2026-05-16 — Scoping: world rework split into 3 sub-sessions
No code shipped — planning-only session. Split the 10-15h "world + biome
rework" roadmap item into three shippable sub-sessions: #1 chunked
terrain + bigger map (5-6h, 800m → 2400m via 3×3 heightfield chunks +
far-LOD ring), #2 biome rescale + scatter retune (4-5h, `BIOME_NOISE_FREQ`
1/220 → 1/900, count/bounds rescale), #3 procgen POIs + biome-aware AI
spawns (4-6h, Poisson-disk POIs + ~28 lizards salt-excluded). Updated
`docs/roadmap.md` to replace the single world-rework entry with the
three ordered sub-entries. Authored
`.claude/plans/world-rework-1-chunked-terrain.md` ready to execute next
session (full files-to-touch list, tuning constants, seam-invisibility
note, acceptance criteria, save-compat plan). Scoping rationale archived
in `.claude/plans/archive/session-pick-from-soft-lobster.md`.

## Session DD — 2026-05-16 — Roaming Dune-style sand worm boss
First boss-tier enemy. NEW `src/enemies/sandWorm.ts` (~750 lines):
24m long lamprey-style mesh built along local +X with continuously
tapered cylinder segments + embedded torus ridge rings (major radius
0.94× body so ribs read as connected, not floating). Recessed maw —
no external protrusion: last 2 head segments are `openEnded`, an
inward-narrowing `BackSide` cylinder forms the throat (rim flush
with body diameter, emissive `#4a1808`), with concentric inward-
pointing tooth rings (14 outer at the rim, 10 smaller deeper inside)
and a dark back-cap disc. Body cylinder is `DoubleSide` so the open
segments don't reveal daylight through the worm. 7-state behavior
loop: `patrol → alert → charging → lunge → retreat → stationaryBreach
→ dead`. Worm orbits a home anchor (`SANDWORM_HOME_POS = (60, 0)`,
verified dune-biome at boot) at radius 42m on a 60m patrol disc.
Detection radius 50m → alert (2s windup + roar) → charging at 8 m/s
underground with **half-body riding above the sand** (basePos.y =
groundY puts top half exposed). Charge commits to the player's
position **snapshotted at enterCharging** — no leading, no per-tick
refresh — so dodging sideways before the worm arrives causes the
lunge to miss into empty sand. Lunge: 2.6s arc with `BREACH_ARC_PEAK
= 5m`, pitch following `cos(t·π)·0.6` for tangent-aligned head pose,
and a parabolic body bend (`sin(t·π) * 2.5m`, peak shifted 0.15
toward head) applied per-child via `applyBodyBend` so the worm looks
curved through the air, not a rigid stick. Bite damage 0.35 at
arc midpoint within `BITE_RANGE = 4m`. Every 3rd retreat triggers
stationaryBreach instead: rises vertical (pitch = π/2) for 5.5s
with layered-sine sway around the world-horizontal lateral axis
(eased in/out, peak ±0.3 rad) — reads as a cobra rearing. 6 HP, hits
gated to lunge + stationaryBreach states only (uniform 1.0 dmg per
swing — DD-1's three-zone weak-point system was scrapped after the
glowing-ring weak point read as unrealistic UI). **Sensor collider**:
worm cuboid is `setSensor(true)` so it never applies contact forces;
otherwise the kinematic worm body shoves the kinematic player capsule
skyward and ragdolls the dynamic speeder. Bite damage uses an
explicit distance check, not physics contact. Machete `castShape`
passes `0` for filter flags to include sensors. **Speeder mount fix**:
`getPlayerPos(ctx)` returns `ctx.speeder.body.translation()` when
`ctx.speeder.mounted` is true, since the capsule body is parked at
`(0,-2000,0)` while mounted — without this the worm targets origin.
**Tremor warning**: during alert/charging/retreat AND within 35m,
camera position jitter ±0.06m × proximity-scaled intensity + dust
puffs at the player's feet on a 0.35→0.10s cadence. Drops `[take]`
worm corpse loot — `raw_worm_meat` + `cooked_worm_meat` items added
to `ItemId` union with `inventory/items.ts` registrations; cook map
in `interaction.ts` extends to worm meat over a fire. `playWormRoar`
+ `playWormChomp` synthesized in `audio.ts` (layered sawtooth/noise/
sub-bass for the roar; tri+lowpass-noise impact for the chomp). 22
new `SANDWORM_*` tuning constants. Save/load: optional
`SaveV1.sandWorm = { state, health, looted, pos }` — mid-encounter
states collapse to `patrol` at the saved XZ on load; dead state
restores corpse at exact death position. New `GameContext.sandWorm`
slot. Decisions D48–D49. `verified` (tsc clean, state-machine
transitions hand-ticked through full cycle, dual-zone damage logic
confirmed via `damageSandWorm` direct calls, charge commitment
confirmed by player-move test, save/load round-trip verified for
dead + mid-encounter states, sensor + castShape interaction
confirmed via direct Rapier API call, screenshots of stationary
breach + lunge body bend + recessed maw + charging half-body).

## Session CC-4 — 2026-05-16 — Biome polish + crescent moon fix + GH Pages deploy
Multi-thread polish session. **World/biome**: green saguaro cacti
retired (`makeCactus` deleted, `CactusKind = 'alien'` only); alien
cactus rare (TARGET 12 → 3), restricted to salt-flats + flat ground
via new `terrainFlatnessAt` helper, base recolored to warm grey
(`#7a7268`) so the teal fruit pops as the only saturated element.
Dead trees same salt+flat restriction (new `biomes` param in
`spawnDeadTrees`). Wells: 3 stacked rock rings (`WELL_STONE_RINGS=3`)
with tighter spacing (`baseSize * 0.85`, was *1.75) so layers
interlock instead of leaving gaps; hatch lowered to `stoneMinHalfHeight`
+ widened tilt randomization (±6° pitch + ±5° roll) so all four corners
sit on stones instead of floating. Single well at the salt-flats
centroid via new `findSaltCentroid` grid sweep (`WELL_TARGET_COUNT` 5
→ 1). **Alien fruit lifecycle** (`updateCacti` tick): fruit + stems
hide on harvest, regrow after a full `DAY_LENGTH_SECONDS` cycle, retag
as harvestable; save/load re-arms the regrow clock on restore so
save-scumming can't shortcut it. **Day cycle**: `DAY_LENGTH_SECONDS`
480 → 720 (12 real-min, was 8). **Lizards**: `FLEE_SPEED` 2.5 → 1.8
(catchable while sprinting now) + fixed head-rotation formula —
mesh's local forward is +X (head at +X=0.11), but the old yaw used
`atan2(x, z)` which assumes Three.js's -Z-forward default, leaving
the head 90° perpendicular to motion. New formula `atan2(-fleeDir.z,
fleeDir.x)` applied every frame during flee (was one-shot at flee
transition). **Moon-direction bug fix** in `lighting.ts`: moon's
`target` was never added to scene or updated, so its `target.position`
stayed at world origin. When the player capsule parks at `(0,-2000,0)`
while mounted on the speeder, moon position dropped below world, target
stayed at origin → light direction inverted → night went pitch-dark
when mounted. Fix: `scene.add(moon.target)` + `target.position.copy(
playerPos)` + `target.updateMatrixWorld()` each frame, matching the
sun's setup. Subtle side benefit: moonlight direction is now correct
anywhere the player walks, not just near origin. **Save round-trips
correctly**: removed the `!hasSave()` guard around `setupOpeningScene`
(wreck/skeleton/journal/speeder always exist after boot;
`loadGameState` patches the speeder pose over the default placement
on Continue). NEW GAME with an existing save wipes + reloads for a
clean slate. Title overlay gained `CONTINUE` button (via
`titleOverlay.ts` `onContinue` option) plus tighter button spacing.
Title subtitle: "a desert is patient" → "the desert is patient". CSS
specificity fix so `#title-overlay.hidden` actually hides
(`display:flex` at id-spec was beating `.overlay.hidden` at class-
spec). **Infra**: NEW `.github/workflows/deploy.yml` builds + ships
`dist/` to GitHub Pages on every push to master; `vite.config.ts`
gains mode-based `base: '/Dustfall/'` for production. Phantom-dep
landmine fixed — `simplex-noise@4.0.3` was being resolved from a
parent directory's node_modules locally and never declared in
`package.json`; CI's `npm ci` couldn't see it. Now declared properly
(D46). Decisions D45–D47. `partially verified` (tsc clean; state
checks confirmed cactus rarity + grey palette + fruit harvest/regrow
round-trip + well 3-ring stack + hatch flat-bottom-on-min-stone +
moon-target equal direction in mounted vs unmounted + lizard
rotation across all 4 cardinal directions + save round-trip restored
speeder pose to (123,5,-45) exactly + first GH Pages deploy
succeeded after the simplex-noise fix; screenshot tool flaked
intermittently — visual checks via pixel sampling).

## Session CC-3 — 2026-05-15 — Animated main menu (title screen)
NEW `src/world/titleScene.ts` — dedicated THREE.Scene + camera, decoupled
from the game world. Camera atop a Gaussian-bump hero dune on a 800m
displaced-plane dune field looking out across the basin, tilted up so the
horizon falls at the bottom-third of frame (sky 2/3 / desert 1/3). Tiny
escape-pod streaks in like a shooting star (scale 0.04, 9s cubic-ease
descent from 280m out) with a 28-segment additive Line trail + glow
sprite, impacts far out, and a procedural **pyre** engulfs it (4 nested
cones + 5 random tongues + glowing coal-bed + 16-ember pool + 14-smoke
pool + warm PointLight, all `fog: false` so it punches through atmospheric
haze at 200m). Day/night cycle uses the **real in-game sky package**
(sphere-shader gradient + sun sprite + moon sprite + 800-star points +
planet + 4-shooter pool) ported into the title via exported helpers from
`sky.ts`. Sun arc rebuilt (`dawnAxis * cos + upPerp * sin` instead of
`(cos, sin, 0.18)`) so the sun crosses the fixed camera view; both bodies
left-shifted via `LEFT_SHIFT=0.50`. Boot starts at `cycleOffset=0.19`
(astronomical twilight, sun 18° below horizon → user watches sunrise ~15s
in). **Moon overhauled** in `sky.ts` (affects in-game too): canvas
`destination-out` carves a crescent from the disc + halo, `MOON_DISC_SIZE`
16 → 32, `depthTest: false → true` so terrain properly occludes the moon.
Title-only night-brightness boosts (3× moon directional + 4× ambient
night gain + ground multiplier 0.30 → 0.55) keep dunes legible under
moonlight. NEW `src/ui/titleOverlay.ts` — DOM overlay (z=250) with
DUSTFALL wordmark + "a desert is patient" subtitle + CONTINUE (only
when save exists) + NEW GAME. Render-loop change: `startLoop` accepts an
optional render-target getter that swaps between title and game scenes
based on `ctx.flags.titleActive`. **Save/load round-trips speeder pose**:
added `speeder?` field to SaveV1 (pos + rotationQuat + mounted +
headlampOn); `setupOpeningScene` now runs on EVERY boot (was gated on
`!hasSave`), and `loadGameState` patches over the default placement on
Continue. NEW GAME with an existing save calls `clearSave() + reload()`
for a clean slate. Two glitch fixes: `#title-overlay { display: flex }`
was id-specificity beating `.overlay.hidden { display: none }` so the
title never actually hid after NEW GAME — added matching id-specificity
`#title-overlay.hidden { display: none }` rule; HUD/hotbar/crosshair
hidden via `style.visibility` while the title is up so they don't bleed
through the gradient. Decisions D41–D44. `verified` (tsc clean, screenshots
confirmed pre-dawn red glow + sun visible morning + crescent moon + night
brightness + button layout, save→reload→Continue round-trip restored
speeder to (123,5,-45) exactly).

## Session CC-2 — 2026-05-15 — Hover speeder polish (model, tilt, jump, bells, colliders)
Long iteration pass on the speeder. **Tilt**: visual-only pitch/roll
quaternion composed on top of the body's yaw (the X+Z rotation locks
from D34 stay in place), lerped toward W/S pitch + A/D roll targets.
Camera roll applied via tracked-undo on `camera.quaternion` (naive
multiply accumulated to 720°/s spin). **Jump**: 2-phase pulse →
recover with linearly-decaying upward floor + softer recover lerp
(0.08), so the peak arcs smoothly instead of capping hard. **Camera**
height tuned to 1.0m (between original 0.55 and prior 1.45).
**Headlight**: toggleable on L — SpotLight child of bike + emissive
disc material swap (intensity 0/8, materials `_headlampOff/OnMat`).
**Model**: full rusty-scoutbike redesign — extended fuselage, 2-stage
forward arm + tip + headlamp housing, sunken cockpit + windshield cowl
+ backrest, angled handlebar stem, fuel canister with bands + cap,
foot pegs (moved forward to Z=0.15 to clear canister), exposed cables
underneath, vent louvers + patched rust panels, antenna whip with
attached red tip light. **Saddlebag**: single chunky bag on +X engine
face with **9-piece contour-hugging strap rings** (×2 rings) that step
pod-height→bag-height at the junction, plus a small buckle on top of
the bag-top strap. **Engine bell mesh overhaul**: NEW `makeEngineBellMesh`
helper in `wrecks.ts` — flared open-ended cone + recessed solid interior
cylinder + rim torus, with WeakMap-cached DoubleSide material clone.
Replaces the flat-`CircleGeometry`-disc pattern across speeder (2 bells),
megaShip (1), megaWreck (2), and reused inside `makeEngineBell`
(standalone wreck) + `makeEngineCluster` (engine_block POI nozzles).
**Mount prompt**: NEW `'mount'` InteractType + `'speeder'` registry;
seat mesh tagged + raycast-targeted in `interaction.ts` so looking at
the seat shows `[E] mount speeder` via the existing prompt system.
**Colliders**: speeder body gains a nose cuboid + 2 bell cylinders so
the front + bells are solid; megaShip + megaWreck bells also get
cylinder colliders. Decisions D37-D40. `partially verified` (tsc clean
+ state checks all confirmed; preview screenshot tool flaked
mid-session — visuals deferred to live play).

## Session CC — 2026-05-15 — Hover speeder bike (dynamic-body, 1P, velocity-controlled)
NEW `src/world/speeder.ts` — bike that spawns next to the opening
wreck on fresh worlds. Iterated from force-based thrust + torque
steering (unstable, spun out, NaN'd) to **velocity-controlled** X/Z
(target vel from input × bike forward/right, lerp 0.07), velocity-
controlled yaw (lerp toward camera yaw, 0.30 response), velocity-
controlled hover (already established BB-style PD-but-as-velocity-
control). Camera written directly from rider seat at +1.45m above
bike body (above handlebars); player capsule parked at (0,-2000,0)
while mounted so it can't collide with the dynamic bike. Bike-body
gravity scaled to 0 (we own Y entirely). Input scheme: **mouse turns
the bike, A/D strafe, W/S throttle, Shift boost, Space hop, E
mount/dismount**. Top speed 14 m/s forward / 23.8 m/s boosted /
7 m/s strafe. Decisions D34 (velocity over force), D35 (mouse-turns
+ strafe over A/D-turns), D36 (camera-from-rider-seat / player-body-
parked). `verified` (tsc + state checks for accel curve, yaw lerp,
strafe direction; screenshot of rider POV with mega-wreck dead-
ahead).

## Session BB-4 — 2026-05-15 — Storm + fog visual rework
`THREE.Fog` → `THREE.FogExp2` with smoothstep density curve (`0.0035` →
`0.055`). Single 2500-particle dust cloud → 3 stacked layers
(`near` 800 / `mid` 2500 / `far` 600) with staged opacity ramps (far
appears first as "storm on horizon", near appears last when wind reaches
player). NEW `src/world/stormVignette.ts` — clip-space full-screen
quad with aspect-corrected radial alpha gradient, only engages above
intensity 0.4. `lighting.ts` adds storm dimming: sun × (1 - 0.65×storm),
ambient × (1 - 0.20×storm) with color shifting toward warm dust. Fog
color lerp to dust bumped 0.45 → 0.70 (FogExp2's denser falloff makes
fog repaint every surface — needed stronger sky-color match). All storm
visuals die in shelter (3 layers + vignette); skylights then read as
"dark portals to the storm outside" with dust-tinted ambient leaking
in. FPS 143 clear → 91 peak (target ≥60). `verified` (tsc + screenshots
of clear/building/peak/inside-shelter states + state checks).

## Session BB-3 — 2026-05-15 — Mega-wreck verticality + detail pass
3 catwalks (Y=3/7/11m) + 3 ramps inside aft bay. NEW dark side room
(Chamber 3) off aft +X wall via doorway in refactored aft right wall.
3 skylights via roof-strip `panelWithHole` replacement (3 strip panels,
each with one hole). Bow gets a small ragged +X side opening for side-
light. 6 more salvage panels (catwalks + side room + 2 engine bells +
antenna spire requiring tower climb via debris-pile steps). Interior
detail pass (ceiling pipes, wall conduits, broken consoles, hull-plate
fragments). Exterior detail pass (seams, rust streaks/patches, exterior
pipes, vents, broken antenna stubs). `placeDebrisField` (50m radius ×
40 pieces) + 3 companion wrecks (fuselage + engine_cluster + escape_pod)
at 30-60m offsets. 1049 total scene meshes, FPS 143. `verified` (tsc +
preview screenshots of skylight-lit bay, dark side room, engine bells
silhouetted against moon, antenna spire visible from spawn).

## Session BB-2 — 2026-05-15 — Mega-wreck shell (Jakku-scale, 120m)
NEW `src/world/megaWreck.ts` — TRULY mega-scale crashed ship at
(-180, -130) in SW quadrant (drifted to (-180, -190) by flat-spot
search). 3 hull sections (bow 35m + open mid-hull break + aft 60m) + 12m
bridge tower + 2 ten-meter engine bells. Bow lives in a named 'bow'
sub-group with runtime Y-offset anchored to terrain at the ENTRANCE
position — needed because at 120m length terrain varies 12m+ across
the footprint, so a static `BOW_ORIGIN_Y` like the archived plan
suggested would push the entrance below terrain (D29). Widened
flat-spot search to 9×9 at 15m spacing × radii up to 60m, tilt cap
0.10 rad, `BOW_ENTRANCE_H` bumped to 4m for slack. 2 salvage panels
(aft + bow), shelter zone over aft bay. POI registered in
[src/world/poi.ts](src/world/poi.ts) with a new `terrainVarAtWide`
helper. `verified` (tsc + screenshots + state checks for biome,
clearance, salvageables, inShelter).

## Session BB — 2026-05-15 — Mega-ship POI (enterable wreck v1) + mega-wreck plan
NEW `src/world/megaShip.ts` — a ~12m enterable wreck in central dunes
(-120, 30). Extracted `panelWithHole` to shared `src/world/panelUtils.ts`.
Multi-iteration session: started boxy, ended as a detailed rusty sci-fi
crashed cargo hauler — 111 meshes incl. 2 chambers split by bulkhead, side
entrance, **sand-reclaimed floor** (no floor mesh; terrain serves), walls
extending 2m below origin (no slope gaps), terrain-normal tilt for crashed
feel, segmented bridge cone w/ viewport, engine bell + antenna masts +
wing fins + exterior pipes/vents/seams/rust + interior ceiling pipes +
wall conduits + broken hull plates around entrance. 3 salvage panels
(massive×2 + engine_bell). Also authored a detailed BB-2/BB-3 plan for a
TRULY mega-scale crashed ship (120m, Force Awakens Jakku scale) — see
archived plan. `verified` (tsc + multiple screenshots).

## Session AA — 2026-05-14 — Torch/flashlight + opening-scene rebuild
NEW `torch` (consumable, 3-min burn, warm PointLight + flicker) and
`flashlight` (rechargeable, drains while lit, cool SpotLight) items + craft
recipes + salvage drops + `ItemDef.updateHeld` per-frame hook. Opening
wreck rebuilt: removed floor sun-patch + rust patches, brightened tally
marks (Y=1.30), pierced REAL geometry holes in side walls + roof + back
wall via new `panelWithHole` helper, replaced back roof with a translucent
canvas TARP (emissive + `noShadow`), fixed pre-existing roof rotation
inversion that had the apex BELOW the wall tops (Session W bug). Opening
scene: no boot storm, wreck moved to central dunes (-50,0,0) via empirical
biome+POI scan, yaw forced to π/2 (back wall faces east), player
teleported relative to wreck post-placement. First-frame view is now the
wreck silhouetted against the rising sun with the back-wall window
glowing. `verified` (tsc + multiple screenshots).

## Session Z — 2026-05-14 — Stone-well rework + tactile salvage panels
Two threads. (1) `makeWell` rewritten: ring of 9 perturbed icosahedron stones
(alternating light/dark palette) + askew 5-plank wooden hatch with cross-brace.
`spawnWaterSources` now hard-requires salt biome (no quota fallback; unplaceable
wells silently drop). 5/5 wells land in salt. (2) New `addAccessPanel` helper
in `wrecks.ts` adds a small dark plate + brass rim + stub handle to every wreck
at a kind-specific local offset. `Salvageable` gains a `panel` field; salvage
interact tag moves from the wreck root to the panel mesh only, so players aim
at the panel directly. POI custom hulls (engine_block, crashed_hull) forward
the inner wreck's panel ref to the parent group. `partially verified` (tsc +
state checks + well screenshot; panel-on-wreck screenshot blocked by paused-tick
lighting).

## Session Y — 2026-05-14 — Footprints + lizard tracks
NEW `src/world/footprints.ts` — InstancedMesh pools per kind (player ×200,
lizard ×240). Canvas-drawn alpha-mask textures (toe+heel double oval for
player, three-streak claw mark for lizard) — zero asset files. Per-instance
opacity via `onBeforeCompile` shader patch on MeshBasicMaterial: 1 draw
call per kind yet independent fades. Player decals hook the existing
`_stepAccum` cadence in `controller.ts` with L/R parity offset (±0.16m
perpendicular, ±6° toe-out); lizard decals fire every 0.30m of flee-state
travel in `lizard.ts`. Both skip rocky biome. 12s smoothstep tail; 45s
total lifetime. Round-robin pool recycling. `partially verified` (tsc +
spawn writes + fade math + decal screenshots; controller cadence path
unexercised due to preview pointer-lock + rAF throttling).

## Session X — 2026-05-14 — Audio overhaul (sample-stem architecture)
Replaced V/W procedural drone+pluck+bandpass-wind with sample-stem orchestrator.
NEW `src/audio/samples.ts` (tolerant fetch+decodeAudioData; missing files log
warning + null). REWRITE `src/audio/soundscape.ts`: 7 stems (calm/mid/storm
wind, day/night ambient beds, calm/tense music) crossfaded via smoothstep on
weather.intensity + sunHeight + slow procedural breeze drift. Music bus 4s
fade-in. DELETED `src/audio/music.ts`. New `__game.audioState()` debug hook.
Files intentionally NOT shipped — `public/audio/` empty, code activates as
each .ogg lands (Session N precedent). `partially verified` (tsc + signal
math + graceful-degradation path confirmed via preview_eval; audible test
deferred to when files arrive).

## Session W — 2026-05-14 — Opening scene + world detail
Cinematic intro on fresh worlds (gated by `!hasSave()`): 30-s sandstorm,
hand-authored crashed-shelter wreck (rectangular box-walls — NOT the broken
half-cylinder first cut), skeleton slumped against back wall with journal at
fingertips opening a modal lore panel. Skylight hole in roof + emissive sun-
patch on floor. Bundled: 12 dead trees clustering branch pickups (replaces
random scatter), alien-cactus variant yielding new `alien_fruit`. Storm
aggression rebuilt: dust particles use a circular gradient map (no more
pixel squares), velocities 6 m/s, sky lerps 95% to dust, fog `near`+`far`
BOTH move with intensity (math inversion bug — `fog.far < fog.near`
painted everything fog color — fixed). Wreck oriented so entrance faces
spawn, sits on flattest 5×5 patch within 20 m. `partially verified` (DOM
+ scene checks via preview_eval; screenshots timed out).

## Session V — 2026-05-13 — Atmosphere + audio placeholder
Night sky: moon sprite opposite the sun, 800-point star field, 4-line
shooting-star pool, distant reddish-planet sprite anchored on the eastern
horizon. New ambient-dust system (toned-down storm cousin) suppressed when
storm > 0.15 or `player.inShelter`. Built a procedural music module (drone
pad + pentatonic plucks + feedback-delay reverb + storm sub-bass) then
DISABLED IT entirely — vibe wasn't right and a full audio overhaul is
deferred (D14). Wind layer also disabled. `partially verified` (scene +
audio-context unlock confirmed; screenshot timed out).

## Session U — 2026-05-13 — UX & tuning pass + empty the world
Removed spawned raider at boot (code path stays — D13). Window-listener
Ctrl+W/A/S/D/Q `preventDefault` so the browser doesn't intercept (Ctrl-W
was closing the tab mid-playtest). `I`/`C` now TOGGLE (open AND close)
inventory + crafting overlays via a new window-keydown handler in input.ts
— the polling in updateInventoryInput early-returned while paused. Hover
tooltips via `root.title` on hotbar + inventory tiles. Lizard `FLEE_SPEED`
3.0→2.5; `DAY_LENGTH_SECONDS` 360→480. `verified` via synthetic keydown +
DOM inspection.

## Session N — 2026-05-13 — Rigged raider visual + animation infra
Per-instance `AnimationMixer`, fuzzy clip resolver (Quaternius packs name
clips wildly — substring match against `idle/walk/run/attack/die`),
crossfade helper. New `Raider.rig` field; bladeArm tween becomes
primitive-only. Primitive fallback path exercised end-to-end. The rigged
GLB at `public/models/quaternius/raider.glb` is intentionally NOT shipped
— user deferred asset work; code activates the rigged path automatically
when the file lands. `partially verified` (primitive path; rigged path
unverified pending asset).

## Session M — 2026-05-14 — Save / load
NEW `src/persistence/save.ts`. Single-slot `localStorage['dustfall.save.v1']`,
seed-stamped (mismatch refused with toast). Sleep autosave + manual pause-menu
Save. **No death autosave**: Continue from last save on death overlay only
when a save exists, else Main Menu. New-game-while-save confirm prompt.

## Session Q — 2026-05-13 — Camera bob + footsteps + ease curves
Viewmodel Y-bob phase-locked to footfall cadence; idle breath fades in below
0.5 m/s. 4 procedural footstep variants (sand/rock/salt/wet) dispatched via
`biomeAt()` + 2m water proximity. New `src/core/ease.ts` (`easeOutBack`,
`easeInOutCubic`, `easeOutQuad`); canteen/bandage/machete use-anims swapped.

## Session T — 2026-05-13 — Salvage gameplay
Every wreck (hero landmarks + massive POIs) becomes a finite salvage source.
NEW `src/world/salvage.ts`: registry, loot tables per `WreckKind`,
1.5s salvage timer mirroring the cooking pattern, `markSalvageStripped()`
desaturation walk on depletion. 14 salvageables registered.

## Session S — 2026-05-13 — Sci-fi pivot + ship wrecks
Tonal pivot to Jakku-flavored scavenger desert. NEW `src/world/wrecks.ts`
(6 wreck-type registry: engine cluster / fuselage / escape pod / cargo /
antenna / engine bell). Massive POI hulls + debris fields. Hero landmarks
+ POIs rerouted to wreck registry; monolith dropped.

## Session P — 2026-05-13 — Barren-desert pass
Realistic ridged + wind-warped dunes; biome map (dune / rocky / salt);
per-vertex terrain tinting; ring of 22 perimeter mountains as horizon
silhouettes; 4 hand-placed POIs (monolith, abandoned camp, watchtower,
ribcage cluster). Scattered rocks/logs/crates/truck-wreck removed.

## Session L — v1.5 — Tutorial & first-time UX
NEW `src/ui/tutorial.ts`. First-boot controls panel (14 keybind rows) +
H-key reopen. Per-item pickup hints fire once across sessions via
`localStorage['dustfall.tutorial.v1']`. Debug: `__game.resetTutorial()`,
`__game.showControls()`.

## Session K — v1.5 — FPS diagnostics + shadow toggle
F1 HUD: GPU ms / CPU ms / frame ms via `EXT_disjoint_timer_query_webgl2`.
SW-render warning (WARP / SwiftShader / MS Basic). Shadow on/off setting
live-applies. Pickups + branches no longer cast shadows. Sandstorm Points
hidden when intensity ≤ 0.01.

## Session J — v1.5 — Performance + graphics quality preset
F1 HUD shows GPU name (`WEBGL_debug_renderer_info`), framebuffer res, render
scale. New `renderQuality: 'low' | 'medium' | 'high'` setting (persists to
localStorage) live-applies pixel ratio + shadow map size with no reload.

## Session I — v1.5 — Inventory & feel polish
Space jumps; G drops selected slot as a Pickup (meta preserved); 10-slot
backpack + I-key overlay (click-then-click swap); pickups auto-overflow into
backpack; canteen fillLevel as hotbar/backpack bar; raider hits trigger red
damage vignette + hurt sfx; dead fires relight with a branch; 1s craft
progress bar; death screen "you survived N days".

## Session H — v1.5 — Performance pass
InstancedMesh for 134 rocks/trunks (14 pools). Distant-shadow culling: 76
landmarks marked `userData.farFromOrigin`. Raider sight raycast cached
(0.5s). F1 perf HUD overlay (FPS / draws / tris).

## Session G — v1.5 — Fire / tents / sleep / crafting / day counter
4 new items: branch / cloth / fire_kit / tent_kit. Placeable fire
(`deployFire`, fuel + flicker + shelter zone + cooking + add_fuel),
placeable tent + sleep overlay (4h/8h advances dayTime + stat scale).
Crafting menu (C key, 3 recipes). Day counter. 5 new procedural sounds.

## Session F — v1.5 — Realism overhaul
Stats expanded to 5 (added hunger + stamina + two-way temperature replacing
heat). Canteen refillable via `Slot.meta.fillLevel`; `onUse(ctx, slot)`.
4 new world systems (water sources / cacti / lizards / loot containers).
Multi-type hover dispatch (`take` / `refill` / `search` / `harvest` / `kill`).

## Session E — v1.5 — First-person viewmodel
Hands + held item as a camera-tracking Group with `depthTest=false`.
Per-item use animations: canteen 1.2s drink-tilt, machete 0.4s thrust,
bandage 0.8s rise. SVG hotbar icons replace single-char glyphs. 5 new
procedural UI sounds.

## Session D — v1 — Raider + sandstorm + menus + persistence
Raider enemy (primitive hooded wanderer + 6-state AI). LMB combat via
swept-capsule `castShape` → `damageRaider`. Sandstorm weather. Main menu
+ pause + settings panel. `localStorage` persistence for settings.

## Session C — v1 — Inventory + look-at + shelter + audio
Inventory + look-at raycast + hotbar UI + interact prompt. Shelter zones
(AABB registry). Procedural Web Audio (wind / footsteps / pickup / drink).

## Session B.5 — v1 — Lighting + shadows + sky
PCFSoft shadows + follow-player shadow camera. Visible sun disc. Gradient
sky shader. Mid-day brighter. Wreckage / mesa / canteen polish.

## Session B — v1 — Terrain + hero landmarks
Simplex heightmap + heightfield collider. Improved primitives. 4 hero
landmark types: ribcage / truck / tower / obelisk (truck removed in P).

## Session A — v1 — Module refactor + Rapier
Single-file prototype split into systems. Rapier physics + collisions.
Kinematic character controller capsule.

## Session v0 — 1-hour prototype
Flat sand, primitive landmarks, click-to-play.
