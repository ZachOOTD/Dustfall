# Dustfall — project manual

Browser first-person desert survival game. Long Dark / Mad Max / Dune tone.

This project uses **gamedev-framework v0.3.x** (retrofitted 2026-05-20).
The framework provides session-lifecycle skills (`/session-start`,
`/session-end`, `/triage-ideas`, `/audit-debt`, …), an autonomy
convention for agentic sessions, and shared design patterns. See
`~/.claude/plugins/.../gamedev-framework/` for plugin source and
`~/projects/gamedev-framework/docs/` for framework docs. Dustfall
**opts out** of the framework's tier-ladder verification model — see
[docs/roadmap.md](docs/roadmap.md) for the rationale (post-MVP, the
per-session "Next + Big-ticket bucket" structure stays in use).

## Tech stack

Three.js + TypeScript + Vite + `@dimforge/rapier3d-compat` + `simplex-noise` + procedural Web Audio (no sample files).

## Project location

`C:\Users\Zach\projects\dustfall`

Run with `npm run dev` (port 5173). Type-check / verify with
`npm run typecheck` or `npm run verify` (both = `tsc --noEmit`).

**Reference docs** (read on demand):
- [docs/GDD.md](docs/GDD.md) — game design truth document (hydrated at retrofit).
- [docs/architecture.md](docs/architecture.md) — file map, footguns, FPS-debug path.
- [docs/changelog.md](docs/changelog.md) — what shipped per session.
- [docs/roadmap.md](docs/roadmap.md) — what's next.
- [docs/decisions.md](docs/decisions.md) — why we made key calls (with friction-scores).
- [docs/backlog.md](docs/backlog.md) — unprioritized ideas / bugs / polish / debt.
- [docs/next-session-prompt.md](docs/next-session-prompt.md) — queued direction for the upcoming session.

## Architecture rules

1. **`GameContext` is the spine.** Every system reads/writes `ctx`. Don't pass random params around.
2. **Magic numbers → `src/config/tuning.ts` ONLY.** Don't sprinkle them.
3. **Per-frame tick order in `main.ts` matters.** Current order:
   ```
   physics.step → updateWeather → updateLighting → updateSky → updatePlayer →
   updateShelter → updateStats → updateSoundscape → bobPickups → updateRaiders →
   updateLizards → updateFires → updateInteraction → updateInventoryInput →
   updateCombat → updateViewModel → updateHud → updateHotbar →
   updateInteractPrompt → updatePhysicsDebug → updatePerfHud → endInputFrame
   ```
4. **Pause gates everything.** `if (ctx.flags.paused) { endInputFrame(); return; }` — physics, AI, weather all freeze.
5. **DOM ownership.** Each UI module owns its DOM refs; created at boot, mutated each frame.
6. **No `innerHTML` with concatenated strings** — the pre-tool hook flags it as XSS risk. Use `createElement` + `textContent`.
7. **Exterior model decorations need real depth.** When adding boxy decorations to world entities (windows, panels, fragments, hull patches), use a depth of at least ~10cm for "thin" features and 15cm (matching `OPENING_WRECK_HULL_WALL_THICKNESS`) for hull-substantial features. 5cm reads paper-thin at oblique angles and breaks immersion. Cylinders, lathes, and torus-based geometry are inherently thick — this rule only applies to BoxGeometry-based decorations on the OUTSIDE of a hull/wall surface where the camera can view edge-on.
8. **Iteration discipline for visual/feel work** (post-ABP — `shared-memory/iterative-polish-discipline.md`). `npm run verify` clean is NOT the success gate when shipping rig geometry, camera behavior, animation, material colors, UI layout, or anything visual. Per substantive element: build → screenshot → critique → iterate, **5-8 rounds for new visual elements, 3-5 for tuning**. A real long-overnight ships 1-2 fully-iterated tiers, not 4-5 shallow ones. ABP triggered this rule: a 41-minute "long overnight" shipped 4 tiers of visibly-rough work that required follow-up polish. **Never** mark a visual tier complete with `npm run verify` as the only verification. **Never** write >150 LOC of visual code in a single Edit without screenshotting in between. If a tier describes its outcome as "shipped, no save-schema changes, deferred polish to a follow-up" — that's the anti-pattern; loop back and iterate.

## How to change the game

- **Game feel** (movement speed, drain rates, etc.) → `src/config/tuning.ts`.
- **Look** (sky colors, shadow map, exposure) → `src/config/tuning.ts` + `src/world/sky.ts` shader.
- **Add an item** → add to `inventory/types.ts` ItemId union + register in `inventory/items.ts`.
- **Add a sound** → new function in `src/audio/audio.ts` synthesizing via Web Audio nodes.
- **Add a system** → new file, hook into `main.ts` tick at the right order.

## Where we are now

**Last shipped**: Session ABX — Player model texture pass within D107
zero-asset. **Ninth session under iteration discipline**. 4 elements
iterated. **P1 poncho dye stripes**: per-vertex color attribute on
poncho geometry (5 alternating warm/cool bands × wear gradient), cloned
ponchoMat with vertexColors=true. Hand-dyed scavenger look. **P2 skin
weathering**: face skinMat accent 0x8a7048 → 0x6e4a26 (deeper sun-aged
brown), sheen 0.5 → 0.22 (matte). NEW handSkinMat (accent 0x4a3520
grimy + scaleSize 22.0) applied to palm/knuckle ridge/fingers/thumbs.
**P3 pauldron**: paintMat wearLevel 0.7 → 0.88 + 4 rivets per plate
(12 total small SphereGeometry corner studs in metalMat). **P4
bandolier leather**: STRAP_COLOR 0x505050 → 0x4a3220 + strapMat
factory switched metalMaterial → fabricMaterial+disableShimmer.
Matte brown leather strap + pouches. tsc clean. 1 file modified
(playerRig.ts). All within D107 zero-asset (no GLB/PBR/UV files).

**9-session arc summary**: ABP baseline blocky → ABV+ABW geometry+
rigging+cloth+fit → **ABX material/texture variation**. Full procedural-
character pipeline complete within zero-asset. Character now reads as
lived-in scavenger, not mannequin.

**Prior milestone**: Session ABW — Multi-angle polish audit + cape clipping
fix. **Eighth session under iteration discipline**. User-reported bug:
cape (poncho) clipping through the back of the body. Root cause: poncho
top radius (TORSO_CHEST_R × 1.08 = 0.238m) was smaller than ABS Lathe
torso pectoral swell (TORSO_CHEST_R × 1.18 = 0.260m). Fix: bumped
ponchoR_top × 1.08 → 1.32 (0.290m, 3cm clearance over pectoral) +
hem flare 1.6 → 1.75 for proportional drape. Verified front/side/back:
body contained inside poncho, no breakthrough. Multi-angle audit also
confirmed prior ABS+ABU+ABV polish reads correctly across angles.
**Texture pass deferred to ABX** per user direction — its own focused
session applying the existing procedural shader vocab (D107 zero-asset
preserved). 1 file modified (playerRig.ts). tsc clean.

**Prior milestone**: Session ABV — Rig sub-pivots (wrist + ankle + spine
bend) + hood drape D117. **Seventh session under iteration discipline**.
2 elements iterated. **Major rigging milestone**: procedural character
now has full sub-pivot rig hierarchy on par with low-poly stylized
3rd-person-game character rigging. 1 file modified (playerRig.ts). tsc
clean. D118 added. **P1 sub-pivots (1 round)**: added wrists[2] (between
elbow + hand), ankles[2] (between knee + foot), spineBend (between body
+ upper-body children: torso/headGroup/poncho/bandolier/pauldron/
shoulders). Legs stay on body. Lean moved from body.rotation.x to
spineBend.rotation.x so legs stay vertical. Animation tick: ankle
asymmetric (heel-strike +0.30 dorsi vs toe-off -0.45 plantar — push-
off more aggressive); wrist hang (-0.10 + swing*0.15); spine sway
(-sin(phase)*0.05) + lean (0.16 running / 0.05 walking). Verified at
phase=π: ankles correctly mirror plantar/dorsi. Idle pose: feet flat,
arms hang naturally, spine lean preserved. **P2 hood drape D117 (1
round)**: subdivided hood-back-cylinder 14×1 → 18×8, applied D117
cloth-fold formula at HOOD_FOLD_WAVES=4 + scaled amplitudes for head
size. Folds subtle but consistent with poncho across outfit. **D118
added**: procedural rigging sub-pivot architecture codifies the
wrist/ankle/spineBend insertion pattern + asymmetric ankle drive +
spine sway formula. **7-session arc summary**: ABP baseline blocky →
ABQ poncho shawl + walk bug fix → ABR motion verify + snap → ABS
Lathe body geometry → ABT over-shoulder cam + feet plant + head Lathe
→ ABU cloth drape + body polish → ABV sub-pivot rigging. Procedural
character now at low-poly stylized 3P game quality within D107.

**Prior milestone**: Session ABU — Realistic cloth drape + body polish.
**Sixth session under iteration discipline**. 2 elements fully iterated;
P3 sub-pivots deferred to ABV. 1 file modified (playerRig.ts). tsc
clean. **P1 cloth drape (2 rounds, D117)**: Poncho CylinderGeometry
subdivided 16×1 → 24×10 (240 verts). Per-vertex sine-wave radial
offsets: `foldOffset = sin(WAVES × θ) × amp(t)` where amp attenuates
hem→top. R2 final: WAVES=6, hem 4.5cm, top 0.8cm. computeVertexNormals
after displacement. Poncho went from "plastic tube" to "wrapped fabric
with drape folds + scalloped hem". **P2 body polish (1 round, 3 fixes)**:
(a) Neck cap blend — 3 intermediate torsoProfile points (0.025/0.055/
0.085) eliminate visible cap lip. (b) Deltoid bridge spheres — new
SphereGeometry(0.085) per shoulder scaled (1.0, 0.75, 1.0) bridges
arm-to-torso gap. (c) Finger knuckle bumps — 2 SphereGeometry(0.011)
per finger at 1/3 + 2/3 marks. **D117 added** — procedural cloth drape
via subdivided geometry + per-vertex sin-wave offsets. Pattern composes
with any cylindrical mesh that should read as cloth (robe, banner,
flag, sail). **Deferred to ABV**: rig sub-pivots (wrist + ankle + spine
bend + animation tick wiring) — different KIND of work (code-heavy +
animation), deserves own focused session.

**Prior milestone**: Session ABT — Over-shoulder camera + feet-on-ground
bug fix + head Lathe geometry. **Fifth session under iteration
discipline**. 3 substantive fixes shipped from user feedback ("model
needs more polish", "camera weird position way above player", "feet
under sand"). 2 files modified. tsc clean. **P1 over-shoulder camera
(controller.ts)**: 3.2m/1.8m + no lateral → 1.8m back + 0.30m above
+ 0.40m lateral offset (right shoulder) + 0.25m shoulder drop.
Reads as modern TLOU/GoW over-shoulder cam. Spring-arm raycast
collision rays now fire from shoulderAnchor not playerHead. D116.
**P2 feet on ground (playerRig.ts)**: was `tr.y - eyeOffset - 0.5`
(magic number didn't match actual capsule geometry → feet under
sand). Now `terrain.heightAt(tr.x, tr.z)` direct query plants feet
on sand exactly. Foot IK still does per-foot variation. **P5 head
Lathe geometry**: scaled-sphere + flat-box-jaw → 11-point Lathe
profile (crown cap → cranium widest → brow → cheek → jaw → chin →
under-chin → cap) + 18 radial segments + DoubleSide per D115. Reads
as real human skull silhouette with cheekbones + jaw + chin.
**Deferred to ABU**: more body polish (shoulder-arm transition,
neck cap blend, hand-wrist joint, finger knuckle inflections),
realistic cloth drape, rig sub-pivots (wrist/ankle/spine bend).

**Prior milestone**: Session ABS — Body geometry realism push. **Fourth
session under iteration discipline**. User direction: "push toward real
video game quality model + rigging, not blocky figures and cylinders".
3 elements fully iterated per discipline; 3 deferred to ABT.
**P1 Lathe torso (4 rounds)**: 4-piece composite (2 cyl + 2 sphere
caps = "cans stacked") → single LatheGeometry from 14-point profile
curve (cap → neck → shoulders → pectoral swell → ribcage taper → waist
narrow → hip flare → crotch → cap). 24 radial segments. DoubleSide
material so back-interior renders through poncho V cut. Front view:
real body silhouette. **P2 tapered Lathe limbs (1 round)**: all 4 limb
meshes (upper/lower leg × upper/lower arm) replaced uniform cylinders
with Lathe profiles — thigh/quad swell, calf-muscle peak, deltoid/
bicep bulk, forearm + wrist taper. 14-16 radial segs. **P3 tapered
cylinder fingers (1 round)**: palm box widened + thinned to real-hand
proportions + knuckle ridge box. 4 fingers + thumb: single boxes →
tapered CylinderGeometry (0.0075 tip → 0.010 base, 8 segs, variable
lengths). Reads as hands at FP/close-3P. **D115 added** — LatheGeometry
as canonical organic-body-shape primitive within D107 zero-asset.
1 file modified (playerRig.ts). tsc clean. **Deferred to ABT**:
P4 real head geometry, P5 realistic cloth drape with weight folds,
P6 rig sub-pivots (wrist/ankle/spine bend).

**Prior milestone**: Session ABR — ABP+ABQ verification pass under the
iteration discipline + 3P camera teleport snap wiring at 3 callsites.
**Second session under the discipline**, verification-focused. 5 P-items
shipped, all verified via screenshot critique cadence (build/screenshot/
critique/iterate as needed). 2 files modified (`src/world/speeder.ts` +
`src/persistence/save.ts`). tsc clean. **P1 walk cycle in motion**:
verified at 3 phases — running π/4 + running π/2 (heel-strike) + walking
π/4 — ABQ D114 knee-bend fix lands visually. **P2 snap wiring**:
`ctx.player.cameraSnapNextFrame=true` now set at speeder mount + speeder
dismount + save-load. Camera snaps instantly across teleports instead
of lerping visibly. **P3 held items dual-mesh swap**: verified
swap operates correctly (scrap_bar 5 meshes → branch 3 meshes incl
CylinderGeometry). NOTE held items can be small/dark at 3P distance —
per-item viewmodel readability is deferred polish. **P4 FP forearm
wraps**: already-correct positioning from ABP, no offset tuning needed.
**P5 pauldron**: baseline reading well + MORE visible after ABQ poncho
shrink. **Discipline net**: 5 items verified in ~45min; 2 required
code changes (P2 snap wiring + held-items NOTE); 3 required only
screenshot critique. The old failure mode would have shipped all 5
untested. **Deferred to ABS**: per-item viewmodel readability at 3P
distance, real-playtest 3P collision, walk-to-footstep cadence sync,
ABP Tier 5 cut items.

**Prior milestone**: Session ABQ — ABP iterative polish under the new
iteration discipline. **FIRST session run under the discipline** baked
into the framework after ABP playtest revealed shipped-but-shallow
visual work. 3 elements fully iterated per discipline (>6 shallow). 1
file modified (`src/player/playerRig.ts`). tsc clean. **Poncho
geometry**: shrank from a barrel (1.25×chest top / 2.0×waist hem /
1.4×torso height, mid-thigh) to a shawl (1.08 / 1.6 / 0.85,
shoulder-to-hip) so arms hang OUTSIDE the silhouette + legs visible
below the hem. **Bandolier wrap**: pre-fix the strap was front-only
(3 waypoints all +Z) → invisible from back. Converted to a 6-waypoint
CLOSED Catmull-Rom loop wrapping over left shoulder + diagonal chest +
right hip + around right flank + diagonal back + over back of left
shoulder closing the loop. TubeGeometry closed=true. **Walk cycle knee
bend (CRITICAL BUG fix, D114)**: pre-fix formula `max(0, sin(legPhase
- π/3))` peaked knee bend at MID-STANCE (weight-bearing leg — wrong;
should be straight). New formula `max(0, cos(legPhase)) * 0.65` peaks
at mid-swing (foot in air, leg recovering forward). Amplitudes bumped:
hipAmp 0.40→0.48 walking, armAmp ratio 0.85→0.95, hip sway 0.012→0.020m,
body bob 0.035→0.045m. Verified at phase=π/4 + mirror phase=5π/4. The
discipline encoding (shared-memory + 3 SKILL updates) was committed by
user out-of-band before this session. **Deferred to ABR**: pauldron
polish (already reads well), 3P camera in actual playtest, held items
in 3P verification, FP forearm wraps positioning, walk-cycle-to-
footstep cadence sync, ABP Tier 5 cut items (aim twist-IK + footstep-
dust-at-feet).

**Prior milestone**: Session ABP — Dedicated 3P + player rig polish
session (long-overnight, stay-procedural). 4 of 5 tiers shipped
(Tier 5 stretch CUT). **Tier 0 research**: 2 new docs/research/ docs
written by game-researcher agents in parallel (3p-cameras-in-games.md
+ sci-fi-desert-scavenger-aesthetic.md). **Tier 1 rig overhaul**:
src/player/playerRig.ts rewrite (~270 → ~470 LOC) — tapered torso
(2-cylinder + shoulder cap + hip dome), elongated head + flat jaw +
ear bumps + real neck, hands as palm + 4 fingers + thumb, feet as
foot+toe boxes, slight forward lean. Mismatched-scavenger clothing
layers: hood (ConeGeometry + back drape) + poncho (open-side
CylinderGeometry, ochre) + bandolier (TubeGeometry along Catmull-Rom
curve with 4 pouches) + ASYMMETRIC right pauldron (3 plates) +
face bandana + forearm wraps per arm. All cloth uses
disableShimmer per ABN; all skin uses localSpace per D109. **Tier 2
animation**: knee + elbow sub-pivots added; 3-phase walk cycle with
phase-shifted knee bend; hip sway + run lean + body bob; head
counter-bob; proper bent-knee crouch; FOOT IK to terrain (clamped
±15cm) — biggest realism boost on uneven dunes. **Tier 3 3P camera**:
offsets bumped 3.2m/1.8m per research; Rapier raycast collision
with 0.3m pushback; frame-rate-independent smoothed follow at ~10/s;
snap-on-teleport via new ctx.player.cameraSnapNextFrame flag; 3P
pitch clamp [-π/4, π/3] via post-rotation guard. **Tier 4 held
items**: PlayerRig.rightHandAttach Group; swapEquippedMesh
dual-instances each item (FP viewmodel + 3P hand attach); per-frame
visibility gate; NEW src/player/viewModelHands.ts adds forearm
wraps + palm bulge to FP viewmodel (continuity with rig outfit).
**D-entries**: D111 (procedural clothing layering), D112 (Rapier
raycast collision arch), D113 (dual-mesh held items). 5 files
modified + 2 new + 2 research docs. **Tier 5 stretch CUT** per
pre-committed scope-cut #1 (aim twist-IK + footstep-at-feet
deferred to ABQ).

**Prior milestone**: Session ABO — Long-overnight 7-item bundle across 4
tiers (~10h budget, scope-cut-from-bottom). **Tier 1 polish (4 items)**:
C1 scavenger camp strip (fire ring + bandage removed; fuselage kept) +
C5 engine heat-shield back panel (paired BackSide-cloned lathe, rule 7
double-wall) + C4 satellite dish backing framework + collision (6
radial back struts via createMetalMaterial + `attachAabbCollider` on
dishPivot; dish panels FrontSide now) + C3 viewmodel pass (6 worst:
cooked_cactus/lizard/worm, fire_kit, grill_kit, locker_kit upgraded
with metal+bone+wood-grain+fabric shaders). **Tier 2 A3 rigged player
+ 3P camera (full)**: NEW src/player/playerRig.ts (~270 LOC, procedural
primitive rig — capsule torso + sphere head + 2 hip pivots + 2 shoulder
pivots, hand-coded walk cycle at 1.6/2.4 Hz, idle breathing bob, crouch
state); `ctx.player.rig` + `ctx.flags.thirdPerson`; F-key toggles 3P
(pause-gated, hides viewmodel); `syncCameraToBody` branches 3P with
2.5m-behind + 1.5m-above offset using camera direction as spring-arm.
D110 captures the single-camera-with-offset architecture call. **Tier 3
B3 sandworm encounter**: new 'ambush' state in SandWormState union (9
values total); enterAmbush + tickAmbush — submerged invisible, snaps
to lunge within 12m, returns to patrol past 40m, 90s cooldown; dawn/dusk
modifier (×1.30 detection radius in [0.18,0.22] dawn + [0.78,0.82]
dusk windows). Retreat-stalk loop deferred per cut #3. **Tier 4 B6
engineBlock POC migration**: new 'flagship_engineBlock' procgen class
with fixed 5-part recipe + 'engine_cluster' palette + 'massive'
salvageKind; placeProcgenCompositeForFlagship wrapper attaches journal
post-assembly; poi.ts dispatch swaps placeEngineBlock → composite call
(engineBlock.ts kept on disk for one-line revert). **Tier 5 B1
generalized rope CUT** per pre-committed scope-cut #1 (deferred to
ABP). 12 files (11 modified + 1 new). D110 added.

**Prior milestone**: Session ABN — Procgen wreck family + megaWreck bow
shell + shader-crawl fixes. **B6**: `bulk_hauler` 5th procgen wreck
class (1 cockpit + 4-5 hullSegment + 1 engine + 1 tail = 7-8 parts,
~14-21m — longest silhouette; 3-4 panels with `cargo_container` loot
palette); class roulette 4-way → 5-way (35/20/18/12/15). **megaWreck
bow hull-shell**: half-cylinder (`thetaStart=0..π`) caps the upper
bow box; open underside preserves -X side entrance visibility; matches
aft shell's ellipsoidal scale for one continuous silhouette family;
closes the ABL deferred item. **3 bug fixes from /triage-ideas**:
(1) companion mount target — new `getPlayerPos(ctx)` helper in
companion.ts mirrors sandWorm.ts pattern, fixes companion chasing
pre-mount position when player rides speeder. (2) Procedural shader
crawl — D109: added `opts.localSpace?: boolean` to skinMaterial +
paintMaterial; default false preserves coherent world-aligned
weathering for static surfaces; applied to companion + sandworm +
lizard + speeder so texture detail stays anchored to the body as it
moves. (3) Viewmodel fabric expand — added `opts.disableShimmer?` to
fabricMaterial; skips wind displacement + uniform-tick registration
+ switches noise sampling to object-local; applied to cloth + bandage
viewmodels. 10 files, 4 commits. **Deferred**: 1 of 4 triage entries
— stale fire+cloth POI — needs user to identify which POI.

**Prior milestone**: Session ABM — B7 dropped-item rigid-body physics.
Player drops + crafting overflow + pickup-swap now spawn pickups with
Rapier dynamic bodies — items roll, fall, settle naturally on dunes
+ wreck floors. Save schema v11 additive: `droppedPickups?: [...]`
preserves transforms across save/load. Seed-spawn (140+ branches)
stays static. B8 cut + re-scoped for future session.

**Prior milestone**: Session ABL — megaWreck visual rebuild. Closes the
"megaWreck rebuild" backlog item (BB-2/BB-3 era model was visually
behind the rest of the world post-OO procedural shaders). Edit-in-
place refactor preserving the existing collider layout + all 8 salvage
panels + shelter zone + journal — pure visual lift via (1) ABH
procedural shaders applied to all hull/rust/pipe/antenna materials,
(2) tapered aft-section hull shell (ellipsoidally scaled cylinder)
draping over the box-wall structure to break up the silhouette,
(3) 6 rust band wraps around aft + bow, (4) exposed vertical ribs +
torn hull-plate fragments at the mid-hull break zone. 1 file, +166/-22.

**Prior milestone**: Session ABK-tail — Post-ship perf pass + bugfixes.
4 direct-paste commits between ABK session-end and ABL session-start.
**Perf pass** (`76413b6` + `7f2cbc1`): scene PointLights 96 → 31 (panel
glows pooled), StandardMaterials 215 → 0 (Lambert downgrade), shadow
fill ~24× cheaper (1024 map + 6-frame cadence), `renderer.compile()`
pre-warm at boot, Rapier pre-warm at boot. Click→game-frame seconds
→ 14ms. **Starter swap** (`52dcb7d`): machete → scrap_bar in slot 0
(scrap is panel-gated; player needs scrap_bar to bootstrap crafting).
**Dev-cursor fix** (`f1a8bba`): `handoffToGame()` skips pointer-lock
in hidden/0×0 preview tabs (the cursor-stuck-in-invisible-top-left-
box symptom during preview_eval testing).

**Prior milestone**: Session ABK — Complete biome-specific POI family.
ABJ A4 shipped the dune buried cockpit (first biome POI); ABK closes
the family with **salt corroded scientific outpost** (concrete base +
corroded antenna spire + 2-3 sample crates + 1 cargo_container salvage
panel — `src/world/saltOutpost.ts`) and **rocky subterranean entrance**
(boulder outcrop + cave-mouth arch + 4 descending stairs + sunken
interior chamber with BackSide stone walls + shelter zone + escape_pod
panel on back wall — `src/world/rockyEntrance.ts`). Dispatch in
`poi.ts` goes dune→salt→rocky so earlier POIs naturally exclude later
ones from overlapping their biome regions. Multi-seed verified at
12345 + 7777: both 5 shelter zones (+1 from rocky entrance) and
consistent salvage distribution. 5 files, 2 new modules.

**Prior milestone**: Session ABJ — Aggressive overnight bundle (14 items
shipped across 4 tiers; ~6h budget). **Tier 1**: v10→v11 schema bump
combining huddleState + journalReadKinds + bornInDevMode (D108) +
biome-bias on procgen recipe pick (salt→corroded plates / rocky→open
truss / dune→fuel barrels) + tutorial RMB hints + stamina tow tune
2.0×→1.5× + scavenger-camp magic-number lift + CLAUDE.md doc-drift
guardrail. **Tier 2**: 3 new procedural shader factories extending
ABH's vocabulary — woodGrainMaterial (sled+locker), boneMaterial
(skeleton), glassMaterial (used in Tier 4 cockpit window). **Tier 3**:
science_vessel wreck class (4th in roulette 40/25/20/15) + sandworm
bait-and-strike loop (new 'feeding' state; 2× damage vulnerability
window when feeding on meat pickups) + 5 item viewmodel upgrades
(cloth/scrap/branch/bandage/rope all upgraded with shader vocab + more
detail). **Tier 4**: comm-relay cluster (3rd ClusterKind alongside
military_convoy + refugee_caravan) + NEW dune buried cockpit POI
(`src/world/buriedCockpit.ts` — first biome-specific POI; icosahedron
hull half-buried 28° forward, cracked-glass canopy via glassMaterial,
escape_pod salvage palette). **Tier 5 stretch DEFERRED** per pre-
committed cut order: salt outpost, rocky entrance, megaWreck rebuild,
dropped-item rigid bodies, generalized rope attachment.

**Prior milestone**: Session ABI — Salvage panel rim fix + 3 wreck
relocations. Two bugs surfaced by ABG's BackSide body fix: (1) the
"brass rim" was a single solid BoxGeometry covering the full panel
face — when ABG made the body's front face invisible the rim stayed
in front of the cavity as an opaque tan plate. Rebuilt as 4 thin bars
(top/bottom span full width, left/right inset). (2) Three procgen
panels were either overlapping with sibling decorations or buried
inside their wreck volume: cargo_container moved from +X face (door
overlap) to clear +Z face; fuselage moved from inside-the-cylinder to
flush side; escape pod pushed from 0.77r to 1.05r so it sits on the
hull surface. Verified visually for all 4 wreck kinds.

**Prior milestone**: Session ABH — Texture overhaul via procedural shader
vocabulary. Adds 4 new procedural material factories then applies them
across the game's surfaces. Zero new texture files (preserves D3 and
formalizes the no-asset extension to materials per D107). New shaders:
**`metalMaterial.ts`** (`createMetalMaterial(color, opts)` — brushed
scratches + worn highlights + grain + edge dirt; for weapons / tools /
grill / lantern iron / antenna). **`paintMaterial.ts`**
(`createPaintedMetalMaterial` — paint chips reveal rust + faded
gradient + vertical drip-streaks; for speeder hull / locker bands).
**`stoneMaterial.ts`** (`createStoneMaterial` — aggregate + cracks +
dust-on-top-facing-surfaces via world-up normal + sun-bleach; for rock
scatter / well stones / future scavenger-camp stones).
**`skinMaterial.ts`** (`createSkinMaterial` — scale-cell FBM + pigment
blotches + vein lines + sheen; for sandworm body / lizard / companion
carapace). All 4 follow terrainMaterial.ts / fabricMaterial.ts
onBeforeCompile pattern (D62) and sample world-space coords so different
instances get visibly different surface variation for free. Bundle
impact +11KB (4 shader source files; zero asset bytes). 14 files
touched, 4 new modules. D107.

**Prior milestone**: Session ABG — Fix panel interior visibility +
remove opening-wreck salvage panels. Two related panel changes. (1)
salvage panels rendered as blank boxes when pried — body BoxGeometry
front face occluded the 5 interior components AAS shipped. Fixed by
rendering body's material with `side: BackSide` + `shadowSide:
FrontSide` (front invisible from outside, interior walls visible).
Module-cached BackSide clone shared across all panels. D105. (2)
opening-wreck salvage panels removed (restored D15 — opening wreck is
a story prop, not a salvage site). Net -24 lines.

**Prior milestone**: Session ABF — Overnight: POI narrative beats.
5 lone-survivor journals at the hand-modeled flagships (megaShip /
megaWreck / satelliteDish / crashedHull / engineBlock), each with a
distinct narrator voice (cargo handler / captain / radio op / pilot /
engineer). Extended W-era Journal type with `kind: JournalKind`
discriminator; `placeJournal` tags `mesh.userData.interactSubKind` so
interaction.ts routes by tag; `journalPanel.ts` rewritten to support
per-kind `JournalContent` lookup. Each flagship module accepts an
optional `journals?: { list: Journal[] }` arg. No schema bump. D106.

**Prior milestone**: Session ABE — Overnight: 5-item polish bundle.
**P1** tutorial HINTS for rope + sled_kit. **P2** wind shimmer shader
on fabric (sin-driven normal displacement keyed to weather.intensity,
0.5cm calm → 4cm storm peak). **P3** scrap_gun R-key reload — drains
scrap_bullet stacks, refills `slot.meta.ammoRemaining`. New
`playReloadGun` SFX. Closes AAN's `.no_ammo` crosshair loop. **P4**
crafting recipe categorization — tool/ammo/shelter/consumable sub-
headers within CRAFTABLE/MISSING buckets via new `Recipe.category`
field. **P5** megaWreck ground-level secondary panel between engine
bells (~1.5m chest height). All 5 P items shipped without scope-cuts
firing.

**Prior milestone**: Session ABD — Procgen breach-patch frequency
bump. Data-driven playtest of ABC composites across seeds 12345 +
7777 showed only 15% of hull parts had breach patches. Bumped
ribbed_cylinder 0.50 → 0.70 + plated_rectangular 0.40 → 0.60.
Post-tweak ~41% of eligible hulls show breaches.

**Prior milestone**: Session ABC — Procgen wreck expansion. ABA P7
follow-on. 2 new hullSegment variants (`OPEN_TRUSS` skeletal frame,
`FUEL_BARRELS` tank cluster); new wreck class `gunship` (engine-heavy
short hull); new `addBreachPatches` decoration helper; 3-way class
roulette 45/30/25; `PROCGEN_COMPOSITE_SHARE: 0.35 → 0.50`.

**Prior milestone**: Session ABB — ABA P3 visual audit. 3 migrated
flagship panels had wrapper positions using arbitrary constants
instead of the actual hull/wall surface radius at that lathe depth —
panels floating in cavities or off the dish back. Recomputed each
position from the underlying lathe profile so the body front face
sits flush. satelliteDish back-of-dish y=0 → 0.65; crashedHull bell-
throat r=0.47 → 1.44; engineBlock bell-wall r=1.31 → 1.59. openingWreck
panels used `lookAt` against actual `profileRadiusAt` — already correct.

**Prior milestone**: Session ABA — Overnight: salvage cleanup + procgen
wreck system. 7-item overnight bundle. **P1 light-pool refactor**:
pre-allocate 24 PointLights at boot, parked invisible; fires + lanterns
claim/release from the pool. Eliminates the multi-hundred-ms freeze on
each fire / lantern deploy (Three.js's `lightsHash` bump was forcing
every lit material to recompile). **P2 salvage door direction bugfix**
(D101). **P3 legacy panel migration**: 4 modules
(satelliteDish / crashedHull / engineBlock / openingWreck) migrated
to addAccessPanel via wrapper-Group pattern (D102). **P4 speeder
unmount damping**. **P5 tutorial coverage** for grill_kit, scrap_bar,
large_tent_kit. **P6 alignToTerrain lift** to `src/util/terrainAlign.ts`
(D103). **P7 procgen wreck-POI modelling system, first cut**: new
`src/world/procgenWreck.ts` (~430 LOC) — composable part vocabulary
(cockpit / hullSegment / engineModule / tailStub × 2-3 variants each),
2 recipes (corvette + freighter), seeded assembly along +X axis.
`Tuning.PROCGEN_COMPOSITE_SHARE = 0.35` mixes composite vs legacy
35/65 (later bumped to 0.50 in ABC). D104.

**Prior milestone**: Session AAU — Salvage panel polish from playtest
feedback. Four user-reported issues fixed: (1) panels too small +
square → 0.45×0.70×0.20 taller-rectangular access-panel shape per
new Tuning.SALVAGE_PANEL_SIZE_*; (2) panels stuck on hulls clipping
forward → body recessed INTO hull via panel-local Z shift in
addAccessPanel (body.position.z = localZ - sz/2, rotated by faceYaw
so the shift respects panel orientation); front face flush with hull,
only rim + closed door read proud; (3) scrap_bar not testable (no
crafted instance to equip) → added to DEBUG_STARTER_LOADOUT so the
AAR pry flow is reachable from boot; (4) two-stage flow read as
"old mechanic" → door swing lerp slowed (4.5→3.0/s) so the ~1.5s
swing is visibly readable + new completePry toast "the panel pries
open — search inside" makes the pry→extract transition explicit.
Panel-height audit deferred — most panels at body-height (~1m); the
megaWreck catwalk-mounted ones at 7-11m are reachable via interior
stairs. 4 files touched (tuning + main + interaction + wrecks); no
schema bump. No new D-entries.

**Prior milestone**: Session AAT — Salvage condition tiers (corroded /
standard / pristine). Each panel rolls one of 3 conditions
deterministically at boot via `pickCondition(rand, pos)` in
salvage.ts (per D96 — derive from save-stable inputs, no schema
bump). Base distribution 35/50/15; salt biome biases corroded (55%);
dune biases pristine (25%). Module-level `_biomes` singleton wired
via `setSalvageBiomesContext(biomes)` at boot — no
registerSalvageable signature changes. Per-condition effects: **pry
duration** scales ×0.6 / ×1.0 / ×1.4 (corroded easier, pristine
harder); **max extracts** 1-2 / kind-default / 5; **loot tables**
shift — corroded `COMPONENT_LOOT_CORRODED` downgrades each entry
(red_wire→cloth, chip→scrap, bandage_pack→cloth, every tier-down),
pristine last-extract triggers `COMPONENT_LOOT_PRISTINE_BONUS`
(scrap_bullet×3 premium ammo bundle); **visual** door material
variants — corroded heavy rust orange-brown (0x8a4a28), pristine
cooler steel with faint emissive sheen (0x7a7a82 + 0x080a0e),
applied in `applyConditionVisuals(panel, condition)` after
registerSalvageable. Hover prompt annotated — "fuselage (rusted)
— pry open" / "fuselage — pry open" / "fuselage (pristine) — pry
open". Progress bar scales correctly via
`pryDurationMultiplier(condition)`. 10 new Tuning constants
(SALVAGE_CONDITION_*). D96. 4 files touched; no schema bump (D94/D96
pattern).

**Prior milestone**: Session AAS — Salvage polish bundle. Three AAR follow-on
items shipped in one session. **Per-component loot mapping**: new
`COMPONENT_LOOT` map in interaction.ts replaces AAR's
`rollWreckLoot`-per-extract (random + opaque) with deterministic lookup
keyed by `panelComponentKind`: red_wire→rope, yellow_wire→cloth×2,
chip→scrap_bullet, fuse→scrap_bullet, scrap_chunk→scrap×2,
cloth_scrap→cloth×2, bandage_pack→bandage. Player can read the cavity
at a glance and know what they'll get. Fallback to AAR's roll path
for any pre-AAS panels missing the kind tag. **Variant interiors per
wreck kind**: `addAccessPanel` gained `kind: PanelKind` parameter (now
8th arg, defaults to 'fuselage'); new `PANEL_COMPONENT_PALETTES` table
defines 5-component spreads per kind — engine_cluster gets cabling-
heavy (2 red_wire + yellow_wire + fuse + scrap_chunk), escape_pod
gets medical (2 bandage_pack + cloth_scrap + chip + fuse), cargo a
lottery mix, massive a full diversity. New `makePanelComponent(kind,
slot, sx, sy, sz)` helper; 5 slot positions stay fixed across kinds
so the layout reads consistent. 2 new component meshes: cloth_scrap
(folded fabric) + bandage_pack (white box with red cross stripes). All
callers updated (wrecks.ts × 5, megaShip.ts × 3, megaWreck.ts × 3).
**Electrical-flicker glow on pry**: amber PointLight (`0xff9a40`,
range 1.2m, shadows OFF for perf) ignites in the cavity on
`completePry`, fades over `SALVAGE_PANEL_GLOW_FADE_DURATION_S = 3.2s`
with a 2-sine flicker (23Hz + 7.3Hz detuned). Self-marks `-1` to
stop ticking after fade. Animation in existing `updatePanelDoors`
walk. 4 new SALVAGE_PANEL_GLOW_* Tuning constants. No schema bump
(D94 still applies). 5 files touched.

**Prior milestone**: Session AAR — Salvage mechanics overhaul: tactile pry
+ extract. Salvage flow rewritten from one-press-roll into two-stage
interaction. New `scrap_bar` ItemId (recipe id 15: scrap×2 + branch×1,
wieldLmb='click_use') gates panel-prying — without it equipped,
panels stay sealed. **New panel model**: rusted fuse-box (0.55×0.55×
0.18m, larger than pre-AAR 0.32×0.24×0.15) with a HINGED DOOR on the
left edge (rivets + handle on right) covering a deep cavity. Interior
holds 5 detail components: 2 wire bundles (red + yellow), PCB chip
with faint emissive, ceramic fuse cylinder, scrap chunk. Each tagged
with `panelComponentIndex` for index-order hiding on extract.
**Pry stage**: E-hold for `SALVAGE_PANEL_PRY_DURATION_S = 0.85s` while
scrap_bar equipped. Progress bar fills; `playPryCreak` 2-layer SFX
(420→1400→380Hz scrape + 160→60Hz thump at the door-pops-free moment).
Per-frame door angle lerp (`SALVAGE_PANEL_DOOR_OPEN_LERP = 4.5/s`)
swings door to `SALVAGE_PANEL_DOOR_OPEN_ANGLE = 2.1 rad` (~120°).
Mid-pry slot-switch cancels. **Extract stage**: once open, E-press
extracts the next visible interior component, rolls a single loot
entry from the existing kind-table, hides the mesh. Visible
depletion derived from `salvageRemaining` (no schema bump per D94).
Inventory-full path keeps component visible + toasts so player can
retry. **Risk/reward** (D95): pry composes with AAP's noise system —
`SALVAGE_NOISE_MULTIPLIER_DURING_PRY = 1.3` multiplies the existing
movement multiplier (mounted+pry = 2.4× detection, still+pry = 0.72×).
**New SFX**: `playPryCreak`, `playComponentExtract`. Save schema
stays v10. Acceptable migration: pre-AAR partial saves show all 5
components visible but extracts capped; open-door state doesn't
persist. D94/D95. 8 files touched.

**Prior milestone**: Session AAQ — POI overhaul slice: themed clusters.
Two cluster kinds shipped. **military_convoy**: 4-6 wrecks aligned
along a 28-48m crash trajectory — lead `engine_cluster` (truck), 2-4
`cargo_container` middles (freight), `fuselage` tail (comms); shared
trajectory yaw with ±0.5rad per-wreck jitter + ±2m lateral skid;
12m debris field at impact end. **refugee_caravan**: `placeScavengerCamp`
at center (includes fuselage windbreak + fire ring + bandage pickup),
ringed by 2-3 `cargo_container`s at 6-12m radius pointed inward
toward the camp center. New `sampleClusterPositions(rand, terrain,
flagshipPositions)` rejection sampler with cluster-specific exclusion
radii (CLUSTER_MIN_SEPARATION=320m, CLUSTER_SPAWN_EXCLUSION=250m,
CLUSTER_FLAGSHIP_MIN_SEPARATION=200m, CLUSTER_MAX_ROUGHNESS=0.7).
3 clusters per world (CLUSTER_COUNT_PER_WORLD=3) with shuffled kind
rotation. Cluster anchors push onto _placedFlagshipPositions so
procgenPoi naturally excludes them via existing POI_MIN_SEPARATION
mechanism — no procgenPoi changes. Composition-over-creation per D93:
no new POI modules, just coordinated layouts of existing primitives.
Out of scope (POI overhaul follow-on sessions): narrative beats
(lone-survivor journals, hostile holdouts), biome-specific kinds,
comm-relay cluster. Save schema unchanged; 2 files touched.

**Prior milestone**: Session AAP — Sandworm overhaul + atmospheric music
tracks (overnight). **Sandworm**: replaces AAL's world-edge test-fix
with real procgen placement. New `sampleSandwormHome(rand, biomes,
terrain)` uses `findBiomeCentroid` on the dune biome with a 350m
player-spawn-exclusion ring (wider than flagship POIs since
detection range = 150m). Per-seed ±30m jitter so same-centroid
seeds still get distinct positions (D91). Noise-scaled detection
via `playerNoiseMultiplier(ctx)` — still=0.55, walking=1.0,
sprinting=1.45, mounted=1.85 multiplier on the 150m radius. Standing
still ~80m from a worm no longer triggers alert; mounted player
heard from ~280m. Multi-worm cut per scope-cut tier 3, backlogged.
**Music**: new `src/audio/music.ts` (~240 LOC). 3 procedural Web
Audio tracks per D3 — day (C-minor drone + rising-fifth motif every
~15s), storm (C+Db dissonance + lowpassed rumble noise), night
(sparse sine pads + soft C6 chime every ~25s). Crossfaded by sun
height × perceivedIntensity, 1.5s ramps. Soundscape's sample-stem
music layer stays silent + intact per D92 — procedural runs alongside.
`__game.musicState()` debug snapshot added. 5 files + 1 new module.

**Prior milestone**: Session AAO — Another quick-wins bundle (flagship
paper-thin sweep + grill HUD + companion huddle + deadTree rule-2).
**Flagship paper-thin sweep** (CLAUDE.md rule 7 follow-on to AAN's
wrecks.ts): 15 fixes — megaShip.ts hull seams + streaks + rust patches
+ fragments + bridge fins + viewport (8 fixes, 4-8cm → 10cm),
megaWreck.ts aft seams + horizontals + streaks + roof patches +
doorway fragments (6 fixes, 4-8cm → 10cm), crashedHull.ts +
engineBlock.ts bell-throat backstop CircleGeometry → 0.10m Cylinder.
satelliteDish clean (audit false positive). **Cook-progress-per-fire
HUD** (`src/ui/interactPrompt.ts` + style.css + interaction.ts) — new
`showCookProgresses(progresses[])` pre-builds 4 mini-bars above the
[E] prompt; per-frame width updates only. Wired into 'fires' case —
filters `_cooks` by fireId and surfaces each cook's progress. Closes
the AAM grilled-fire visibility gap (previously only one cook showed).
**Companion storm-peak huddle** (`src/enemies/companion.ts` + tuning) —
new `'huddle'` state at `weather.intensity > COMPANION_HUDDLE_THRESHOLD
= 0.80` (±0.05 hysteresis). Overrides all other states; legs tuck,
body presses to ground with slow breathing bob (35% of idle rate).
One-shot toast "Rocky huddles down" on first transition per deploy.
Reads world-truth `weather.intensity`, not perceivedIntensity, per
state-split (D90) — companion is outdoors regardless of player
shelter. **Rule-2 magic-number sweep on deadTree.ts**: lifted
FLATNESS_THRESHOLD + branch-count + ring-radius (5 constants total)
to `Tuning.DEAD_TREE_*`. poi.ts scavenger-camp constants assessed +
deferred (one-off aesthetic numbers, not feel-tunable). 10 files
touched. D90.

**Prior milestone**: Session AAN — Systems review + quick-win polish
bundle. User asked for a comprehensive review. Three parallel Explore
agents (gameplay loop / models+materials / UX-audio-quick-wins)
surfaced 4 quick wins, all shipped. Paper-thin wrecks.ts fixes
(engine_cluster panel 0.06→0.15, escape pod hatch 0.04→0.12, escape
pod rust 0.05→0.12, cargo door 0.04→0.10, debris hull plate 0.04→0.10);
fuselage end cap rewritten from `CircleGeometry` (zero depth) to a
0.10m-thick `CylinderGeometry`. Scrap gun empty-state crosshair
(`.no_ammo` state when no hover + scrap_gun ammoRemaining ≤ 0,
hover always wins per D88). Bandage SFX (cloth-tear + pad pat).
First-recipe-discovery fanfare (rising-arp chime + warm-gold toast
variant with `{ kind: 'discovery' }` opts arg per D89, held 3.2s).
8 files; no new modules.

**Prior milestone**: Session AAM — Fire grill attachment (multi-cook) +
SAVE_VERSION v10. Backlog item from AAG. New `grill_kit` ItemId
(recipe id 14: scrap×2 + branch×2, wieldLmb='click_use'); onUse
attaches to a hovered fire via new `attachGrillToFire()`. `Fire`
gained `hasGrill: boolean` + `grillMesh: THREE.Group | null`. Grill
mesh = 4 horizontal iron cross-bars + 2 side rails (0.55×0.45m grate
at Y=0.45 above fire base). 5 new `FIRE_GRILL_*` Tuning constants
including `MAX_PARALLEL_COOKS = 4`. **`_cooking` singleton lifted to
`_cooks: CookState[]` list** — each cook tracks its own slot/fireId/
completeAt, tickCooking iterates and removes completed/cancelled.
Cook-start cap: 1 without grill, 4 with grill. Pre-AAM slot-switch
cancel was dropped (would break multi-cook UX). **SAVE_VERSION 9 →
10** additive — optional `hasGrill?: boolean` per fire; loader
re-attaches grill on restored fires that had it. **Bug fix
(AAI debt)**: loader's seed check used `Tuning.RNG_SEED` instead of
`ctx.seed`, breaking save/load for any non-1337 world. Now reads
ctx.seed. 7 files touched.

**Prior milestone**: Session AAL — Project-wide audit pass (visual +
bugs + quick wins + tuning lift). Three Explore agents ran in parallel at
boot (gameplay loop / visuals / debt sweep); user picked "do everything
above". 13 files touched across 4 bundles. **Quick wins**: deleted 8
unused Tuning constants (6 godray + 2 legacy speeder), companion
receiveShadow=true, footprint-puffs HMR guard, silenced samples.ts
console.warn. **Gameplay bugfixes**: energy_pistol wired into salvage
(was orphaned PP-era ItemDef + combat spec); scrap_bullet drops bumped
on engine_cluster + added to massive; sleep temperature now respects
shelter state (open-air recovery factor 0.25 vs sheltered 0.7).
**DoubleSide sweep**: crashedHull bell outer + engineBlock heat shield
flipped to FrontSide (inner shells / occlusion cover the back faces);
sandWorm body material SPLIT (closed segments FrontSide, openEnded head
segments DoubleSide for maw visibility); tent + largeTent walls + roof
converted from PlaneGeometry + DoubleSide to thin BoxGeometry +
ExtrudeGeometry (4cm fabric thickness) — no longer paper-thin from
oblique angles. Satellite dish kept DoubleSide (parabolic — legitimate
both-sides view). **Magic-number lift**: lootContainers.ts loot drop
balance (entries-per-container, 4 drop thresholds, count maxes, canteen
fill range) lifted to Tuning.LOOT_CONTAINER_*. Pipe-staff knockback
audit was a false positive (knockbackRaider IS exported). No schema
change. tsc clean.

**Prior milestone**: Session AAK — AAI multi-seed playtest + flagship
placement tightening. Booted 5 seeds (100/200/300/4242/99999) via the
localStorage `pendingSeed` handshake from the AAI snapshot harness;
captured flagship positions + distance-from-spawn + local terrain
roughness per seed. Three issues surfaced + fixed: (1) flagships
landing past 1km from origin (seed 200 engine_block at 1077m, undiscoverable
in normal play), (2) mega_ship landing 108m from player spawn (seed
99999 — would dominate the opening view), (3) flagships on steep dune
slopes (roughness up to 1.27, awkward tilts). Fixes: new Tuning
`FLAGSHIP_SCATTER_RADIUS_MIN = 200` / `_MAX = 800` (separates flagship
scatter band from procgen-wreck's wider 120-1100m), `FLAGSHIP_SPAWN_EXCLUSION_RADIUS = 200`
(vs procgen 80m — keeps big landmarks outside immediate viewshed),
`FLAGSHIP_MAX_ROUGHNESS = 0.7` with new `localRoughness()` helper in
poi.ts that samples a 5m patch around each candidate. Post-fix
verification across all 5 seeds: max distance 786m (was 1077), min
distance from spawn 307m (was 108), max roughness 0.68 (was 1.27).
`sampleFlagshipPositions(rand, terrain)` signature gained terrain.
No schema change. 2 files touched.

**Prior milestone**: Session AAJ — Opening wreck bugfix pass. Four fixes
flagged from a playtest screenshot. **AAB godray cone removed** —
read as theatrical; `updateOpeningWreckGodRay` stubbed to no-op
(preserves main.ts import); 6 godray Tuning constants retained as
commented baseline. **Entrance enterable** — `R_TAIL_RIM 1.4 → 1.6m`,
`R_TAIL_BODY 1.5 → 1.65m`, entrance fragments reduced 4 → 2 with
smaller dims (they read as "wings/fins" obscuring the entrance from
head-on); floor collider half-Z bumped `HULL_LEN/2 - 0.2 →
HULL_LEN/2 - 0.05` so it reaches the rim (was a 0.2m terrain gap).
**Hull thickness** — outer hull materials switched DoubleSide →
FrontSide; new `_hullInteriorMat` (BackSide, darker interior tone);
new inner shell built as a SECOND set of LatheGeometry slices at
reduced radii (`PROFILE.x - HULL_WALL_THICKNESS`, 0.04m). From
outside: rusted exterior; from inside: darker interior wall; the
4cm gap reads as visible wall thickness at the entrance + skylight
openings. Entrance rim torus closes the cross-section ring. 2 new
Tuning constants. **Tally marks repositioned** — pre-AAJ at z=2.85
where hull radius was only ~0.45m (marks floated past wall); now on
LEFT cockpit interior side wall just behind the skeleton (z=1.55-2.55),
per-cluster X computed from local hull profile at chest-height.
Cluster runs fore-aft along Z. No save schema change. 2 files
touched.

**Prior milestone**: Session AAI — Procedural world generation (standard
2400m world). Per-seed worlds within the existing 3×3 chunk grid; no
save schema bump (v9 already had the `seed` field, AAI finally uses
it). New `resolveSeed()` in main.ts reads
`localStorage['dustfall.pendingSeed']` (from titleOverlay's Advanced
entry) → existing save's `seed` via new `peekSavedSeed()` → inline-
rolls a random uint32 if neither. All 3 RNG streams (terrain=seed,
scatter=seed+1, biome=seed+17) derive from this; `ctx.seed` is the
single source of truth. **Flagship POI rejection sampler** (D82):
hardcoded `POI_LAYOUT` (6 flagships pre-AAI: engine_block, camp,
satellite_dish, crashed_hull, mega_ship, mega_wreck) replaced with
`FLAGSHIP_KINDS` + `sampleFlagshipPositions(rand)` that
rejection-samples per seed with `POI_MIN_SEPARATION = 250m` between
flagships + `PLAYER_SPAWN_EXCLUSION_RADIUS = 80m` from the opening
anchor. Procgen wrecks honor the same exclusion. **Opening scene
seed-stable** (D83): `OPENING_SCENE_ANCHOR_X/Z = -50, 0` Tuning
constants document the narrative anchor; opening wreck, speeder,
companion pod, player spawn all preserved across seeds. **Title
Advanced section + seed entry UI** (D84): collapsed disclosure under
NEW GAME with a uint32 input; valid+different seed → pendingSeed +
reload. **World seed in controls panel** (H key) for share/debug.
**Density bumps**: POI_PROCGEN_COUNT 15→22, CACTUS_TARGET_COUNT 10→14,
DEAD_TREE_TARGET_COUNT 30→45. D85: Tuning.RNG_SEED retained as
dev/test fallback only. Verified across multiple boots — random
seeds differ, same seed = identical world, save+reload preserves
seed, all 6 flagship kinds present per seed.

**Prior milestone**: Session AAH — Playtest polish for AAG. Quick post-
ship tuning pass. Two CLAUDE.md rule-2 violations fixed:
**footprintPuffs.ts** had 6 hardcoded constants (PARTICLE_COUNT,
PARTICLES_PER_PUFF, PUFF_LIFE_S, PUFF_VERTICAL_VEL, PUFF_LATERAL_VEL,
PUFF_GRAVITY) lifted to `Tuning.FOOTPRINT_PUFF_*`. **interaction.ts**
module-local `PICKUP_SWAP_DURATION = 1.5` lifted to
`Tuning.PICKUP_SWAP_DURATION_S` (with new Tuning import on the file).
Five feel tweaks: **FOOTPRINT_PUFF_VERTICAL_VEL 0.6 → 0.9** (peak
height 15cm → 34cm — original was barely above foot);
**DUST_MOTES_OPACITY 0.18 → 0.22** (more present in lit interiors);
**PICKUP_SWAP_DURATION_S 1.5 → 1.2** (snappier hold-and-move-on
rhythm); **MIRAGE_NEAR_M 15 → 10** (wobble engages on immediate
horizon rather than only far field); **dust-motes storm cross-fade
hard-cut at 0.8 replaced with smoothstep [0.7, 0.9]** (new Tuning
constants DUST_MOTES_STORM_FADE_START/END). No save schema change,
no new modules. tsc clean.

**Prior milestone**: Session AAG — Atmospheric polish + inventory swap-
on-full. Four-item interim bundle. **Footprint puffs**
(`src/world/footprintPuffs.ts`, new ~120 LOC) — 60-particle pool, 5
per burst, 0.6s life, gravity-affected upward dust; spawned from
controller.ts's footstep block when `!wet`. **Ambient dust motes**
(`src/world/dustMotes.ts`, new ~85 LOC) — bone-warm particles
(0xe8dcc0) finer than ambientDust. **Mirage shader on salt-flat biome**
(`src/world/terrainMaterial.ts`) — vertex shader gains a heat-wobble
Y displacement that activates only on hot salt-flats at high sun.
Module-level `_shaderRefs: Set<ShaderRef>` captures onBeforeCompile
shader instances; new `updateTerrainShaderUniforms(time, cameraX,
cameraZ, sunHeight)` ticked from main.ts each frame. **Inventory swap
on pickup-full** (`src/player/interaction.ts`) — E on a ground pickup
with full bag + non-empty selected slot starts a hold-E swap timer;
on completion drops the selected slot's items at player's feet and
adds the new pickup into the now-empty slot. **Cooking multi-per-fire
deferred** per user direction — added to backlog as future "grill
attachment to the fire" feature. No save schema change.

**Prior milestone**: Session AAF — 7-day storm countdown ("THE LONG
STORM"). Escalating-storm endgame in `src/world/weather.ts`. New
exported `stormCurveAt(daysSurvived)` returns interval/duration
that lerps from day-0 baseline (90s storms, 360-600s intervals) to
day-7-endpoint (300s storms, 60-180s intervals) over days 0-6, then
plateaus onto LONG_STORM values (480s storms, 30-90s intervals)
from day 7+. Storm state machine captures `currentStormDuration` at
storm-start so day-rollover doesn't shorten ongoing storms. 9 new
Tuning constants centralize the curve. New `#long-storm-indicator`
HUD DOM (below day counter, top-right) shows "the long storm in N
days" pre-doom with color lerping muted-brown → warning-red as days
dwindle; reads "THE LONG STORM" in red with slow-pulse animation
from day 7+. One-shot toast at day-7 transition. No save schema
change.

**Prior milestone**: Session AAE — Creature companion (Rocky-inspired)
+ SAVE_VERSION v9. New `src/enemies/companion.ts` (~290 LOC) — small
red exoskeleton creature with 5 radially-symmetric legs. **Dual
locomotion state machine**: rolling (legs retracted, body rolls,
~5.5 m/s, ≥6m from player), walking (legs extended + gait, ~1.8 m/s,
2-6m), idle (breathing bob, leg twitch, <2m). Hysteresis on
thresholds. Pre-deployed at boot via `setupOpeningScene`'s new
`companionSpawnPos` (3m camera-right of player spawn). New
`companion_pod` ItemId (wieldLmb='place'; stone-egg viewmodel with
warm-red veining) — RMB on deployed companion converts to pod;
LMB on wielded pod redeploys. Singleton per save. New
`InteractType 'pet_companion'` (passive hover). **SAVE_VERSION v9**
adds optional `companion?: { pos, state }` field. Loader: v9+
with field → teleport default-spawned creature to saved
pos+state; v9+ without field but companion_pod in inventory →
despawn default (player carried it); pre-v9 → keep default (graceful
introduction). 13 new Tuning constants centralize feel. Verified
mechanically: rolling at distance, walking close, idle at <2m,
pack/redeploy cycle, save round-trip clean. Bucket item shipped.

**Prior milestone**: Session AAD — Polish playtest pass for AAC kits.
Screenshot-driven inspection of the new bedroll/lantern/locker
surfaced two visible issues, both fixed inline. (1) Ghost preview
ring sizes were all defaulting to 0.80m; added per-kit entries to
`KIT_PREVIEW_RADIUS` in `ghostPreview.ts` (bedroll 0.95, lantern
0.30, locker 0.65). (2) Bedroll was nearly invisible against sand
terrain — pad too thin (6cm) + too light (`0x9a7b5a` tan-on-tan).
Fixed in `bedroll.ts`: pad darkened to `0x4a3a26` deep brown,
thickness 0.06→0.12m, pillow taller, new foot-end folded-blanket
mesh so bedroll reads as a clear "head + pad + foot" silhouette.
No schema bump, no new modules.

**Prior milestone**: Session AAC — Craftable home (bedroll + lantern
+ locker) + SAVE_VERSION v8. Three new placeable kits — bedroll
(`cloth×3 + branch×1` → recipe id 11), lantern (`cloth×2 + scrap×2
+ branch×1` → id 12), locker (`scrap×4 + branch×2` → id 13). Each
follows the tent_kit/sled_kit pattern: wieldLmb='place', LMB-click
deploys, RMB packs up. Bedroll = portable cloth pad w/ small
shelter zone + sleep affordance. Lantern = standing post + glass
globe + warm PointLight + sin-driven flicker (never burns out).
Locker = wooden chest with bidirectional cargo via lootMenu
allowDeposit:true (mirrors sled cargo from QQ-2); pack-up refuses
if non-empty. SAVE_VERSION 7→8 additive (D81): new optional
bedrolls/lanterns/lockers fields. Pre-v8 saves load cleanly with
empty arrays. New module count: 3 (bedroll.ts/lantern.ts/locker.ts)
mirroring the established placeable pattern. Player builds their
own customized temporary home anywhere.

**Prior milestone**: Session AAB — World depth (salvage yield diff +
skylight god-rays). Salvage TABLES in `src/world/salvage.ts`
rebalanced to give each wreck kind a clear thematic identity:
engine_cluster/engine_bell = scrap-pure metal w/ rope (cabling) +
rare bullet; fuselage = cloth-heavy w/ rope + bandage; escape_pod =
medical (bandage-heavy); cargo_container = varied lottery + rope;
massive = rich mix. `rope` added to salvage pool (previously
craft-only). 200-roll verification confirmed strong identity per
kind. Skylight god-rays: new additive cone geometry inside opening
wreck, tip at the 30° stress-fracture gap (slices 17+18), base at
floor. 6 new Tuning constants (BEAM_RADIUS_TOP/BOTTOM/LENGTH_M +
COLOR_HEX + MAX_OPACITY=0.22 + SUN_THRESHOLD=0.1). Module-level
`_godRayMesh/_godRayMat` refs; exported
`updateOpeningWreckGodRay(ctx)` runs in main.ts tick after
updateSky. Opacity = sunHeight × (1 - storm.intensity) × maxOpacity.
Beam invisible at night and at peak storm.

**Prior milestone**: Session AAA — First-impression polish bundle. Five
items: (1) UU pickup migration REVERTED — E is the canonical take
button again; LMB's role narrows to "use the wielded item"
(attack/place/hold_use); UU's wieldAction.ts dispatcher + wieldLmb
field stay intact. (2) Ghost preview for LMB-place — new
src/player/ghostPreview.ts (~135 LOC), gold ring + vertical pole at
camera-forward 2.2m, scaled per kit (fire_kit 0.35m, tent_kit 1.0m,
large_tent_kit 1.6m, sled_kit 0.9m). Closes UU's deferred scope-cut.
(3) Storm vignette ramp start lowered 0.4→0.3 (new
Tuning.STORM_VIGNETTE_RAMP_START) so partial-shelter (perceived
capped at 0.4 inside large tent) still shows ~0.03 opacity. Closes
D79's last visual gap. (4) Recipe book panel — new
src/ui/recipeBookPanel.ts (~145 LOC), TAB-key modal listing
discoveredRecipes with output ← inputs row format. Closes TT's
deferred stretch. (5) Crosshair `.dead` state — distinguishes
corpse-loot (muted brown) from ground-pickup (gold) from live enemy
(red). Closes ZZ-era polish gap. tsc clean; preview-verified.

**Prior milestone**: Session ZZ — Soundscape reads perceivedIntensity
(audio half of YY's split). Tiny follow-on: `src/audio/soundscape.ts`'s
`storm` local variable (drives wind + ambient-life + tense music)
now reads `ctx.weather.perceivedIntensity` instead of intensity. Two
lines (live tick + debug snapshot). Inside large tent during peak
storm: wind layer crossfades toward calm baseline, ambient life
suppression eases, tense music doesn't swell as hard — the entire
soundscape relaxes coherently with YY's visual dampening. Inside
small tent / fire: perceived = 0 → calm baseline immediately. Closes
the audio side of the perceivedIntensity split. Backlog audio item
closed.

**Prior milestone**: Session YY — Storm visual dampening inside large
tent (perceivedIntensity split). Continuation work after the overnight
queue closed; completes XX's vision by realizing the scope-cut #1
item. New `weather.perceivedIntensity: number` field — player-context-
aware storm intensity. New `isLargeTent?: boolean` flag on
`ShelterZone`; `addShelterZone` accepts `opts?: { isLargeTent }`.
`updateShelter` walks zones once via `classifyShelter` helper +
writes perceivedIntensity: outside any shelter = intensity (full);
inside fully-enclosed shelter (small tent / fire) = 0; inside large
tent (open-front) = `intensity × LARGE_TENT_STORM_DAMPEN = 0.4`.
`weather.ts` dust-layer ramps + `stormVignette.ts` both read
perceivedIntensity (was inShelter binary). Fog + stats + AI stay on
authoritative intensity. New Tuning constant
`LARGE_TENT_STORM_DAMPEN = 0.4`. Decision D79 (now realized;
friction-2).

**Prior milestone**: Session XX — Larger enterable tent + SAVE_VERSION
v7. Final session of the 5-session overnight queue. New ItemId
`large_tent_kit` + recipe id 10 (cloth×4+branch×3+rope×1). New
module `src/world/largeTent.ts` (~250 LOC) mirrors tent.ts with
walk-in 3.5×2.5×2.2m frame, shelter zone covers interior cavity
only. `packUpLargeTent` refuses if player inside (toast: "can't pack
— you're inside the tent"). `ctx.largeTents` added to GameContext.
interaction.ts gains `'largeTents'` case (reuses 'sleep' verb); UU-2's
RMB pack-up dispatch extended to iterate large tents.
**SAVE_VERSION 6→7** (D81 — additive only): new optional
`largeTents?` field; pre-v7 saves load with empty array. D80 (two
modules vs. parameterized, friction-2) + D81 (save migration
discipline, friction-3) logged. **Scope-cut #1 taken**:
`weather.perceivedIntensity` split deferred — large tents shelter
via ShelterZone (cold drain etc.), but storm visuals inside stay
at full intensity. Backlog item for future polish.

**Prior milestone**: Session WW — HUD micro-polish (stat vignettes +
stamina wobble + prompt fade). New `src/ui/statVignette.ts` — two
CSS-overlay `<div>`s (`#stat-vignette-cold` blue, `#stat-vignette-thirst`
brown). Linear opacity ramp to `STAT_VIGNETTE_MAX_OPACITY = 0.35` as
temperature dips below `-COLD_VIGNETTE_THRESHOLD = -0.3` or thirst
drops below `THIRST_VIGNETTE_THRESHOLD = 0.25`. Suppressed when
`weather.intensity > 0.7` (storm peak owns the screen). New
`src/player/staminaWobble.ts` — sin-driven camera-position jitter
when stamina < 0.2, two desynced sines for "ragged breathing" feel,
peak amp 0.04m at 6Hz; mounted-suppressed. Ticks AFTER updatePlayer
so the camera-anchor runs first (additive jitter, no drift).
`#interact-prompt` CSS transition bumped 0.15s → 0.12s ease-out.
Decision D78 (CSS overlay vs in-scene shader: clone-not-abstract for
3 callers, friction-1). Fourth of 5 overnight sessions (XX next).

**Prior milestone**: Session UU-2 — RMB context actions + controls
panel refresh. New `handleContextAction()` in `src/player/wieldAction.ts`
dispatches RMB (mousePressed.has(2)) off `ctx.inventory.hover` —
inherits all UU gates (overlay, mounted, isPlaying). New
`packUpTent(ctx, tent)` in tent.ts symmetric to deployTent: addItem
'tent_kit' first → if full, refuse + toast "no room" + tent stays;
else removeShelterZone, scene.remove, splice list, toast "tent
packed". RMB-on-sled with `tether.kind === 'speeder'` reuses
existing detachRope. CONTROLS table in tutorial.ts updated for the
new scheme (LMB / HOLD LMB / RMB / E rows). Decision D77 (RMB as
power-user verb, friction-2). Third of 5 overnight sessions (WW next).

**Prior milestone**: Session VV — Tuning lift + crosshair feedback +
as-any fix. Palette-cleanser between UU and UU-2 (both interaction-
dispatch sessions). **fire.ts constants lifted** to Tuning: 5
constants (initial fuel, fuel per branch, shelter radius/height,
near-distance reject sq) → `Tuning.FIRE_*`. **tent.ts constants
lifted**: 2 (shelter half-extents object, near-distance reject sq) →
`Tuning.TENT_*`. Values preserved. **Crosshair feedback**:
`#crosshair` gains `.interactable` (brighter + larger) and `.kill`
(red + larger) classes; toggled by new `updateCrosshair` logic
inside `updateInteractPrompt` (same per-frame cadence, derives from
`ctx.inventory.hover`). **`as any` fix**: `src/world/wrecks.ts:137`
cleaned up — `(cached as any).side = THREE.DoubleSide` → direct
`cached.side = THREE.DoubleSide` (three.js's Material.side is in the
typedef; cast was unnecessary). `eslint-disable` comment dropped.
**Codebase**: `Grep "as any" src` now returns 0 matches. Decision
D76 logged. Second of 5 overnight sessions (UU-2 next).

**Prior milestone**: Session UU — Control scheme overhaul (LMB-leaning).
Migrates "E for every interaction" → click-driven scheme closer to
Long Dark / Rust / Subnautica. **Architecture (D73)**: new
`src/player/wieldAction.ts` is the SOLE LMB-while-wielded dispatcher
— all gates (overlay-open, mounted, isPlaying) in one file;
`updateCombat` invoked FROM wieldAction (removed from main.ts tick).
**Schema (D74)**: optional `wieldLmb?: 'attack' | 'place' | 'hold_use'
| 'click_use' | 'none'` field on ItemDef, default `'click_use'`.
**Shipped behaviors**: (1) Hold-LMB sustained drinking on canteen via
`slot.meta.holdProgress` + new `ItemDef.onHoldTick` hook (D58 cook-
progress pattern, NOT module singletons — HMR-safe). One gulp per
`Tuning.CANTEEN_DRINK_INTERVAL_S = 0.7`s. (2) LMB-click placement for
fire_kit/tent_kit/sled_kit, routed via wieldAction → existing onUse.
(3) LMB-take on hovered ground pickup when wielding a non-attack
item; E-press take removed from `interaction.ts:case 'pickups'`.
(4) `[E]` chip hides for `hover.type === 'take'`. **Unified
placement distance (D75)**: `Tuning.PLACEMENT_DISTANCE_M = 2.2` lifts
fire.ts's previously-1.5m + tent.ts/sled.ts's 2.2m to one constant —
all kits now deploy at 2.2m. **Save format preserved**:
`SAVE_VERSION` stays at 6; `slot.meta.holdProgress` stripped in
`cloneSlot()` (transient input state, never persists). Verb table
tightened — `VERBS['search'] = 'open'` for loot containers. Q-key
path preserved as backward-compat. Decisions D73-D75. First of 5
overnight sessions (VV → UU-2 → WW → XX queued).

**Prior milestone**: Session TT — Crafting rework (combine-to-discover).
Replaces the explicit `RECIPES` list UI with a 4-slot multiset combine
model: throw items in, see "?" for unknown-but-valid combinations,
click CRAFT to consume inputs + produce output + add the recipe to
`inventory.discoveredRecipes` (persisted across save/load). New
module `src/inventory/recipeDiscovery.ts` defines `Recipe` shape with
stable numeric ids 1-9 (current 9 recipes) + `matchRecipes()` returning
array so overlap-chooser UI works for future recipes that share input
multisets. Save format `SAVE_VERSION 5 → 6` — pre-v6 saves get
`ALL_RECIPE_IDS` seeded on load so existing playtesters don't lose
their recipe knowledge. UI rewritten end-to-end (`craftingMenu.ts` +
new CSS classes). Inventory-full refund path verified (DEBUG starter
loadout fills 14/14 slots; first craft hit it; behavior correct —
inputs returned, discovery NOT marked, toast "no room"). Decisions
D70-D72.

**Prior milestone**: Session SS — Opening wreck playtest + polish.
Caught a latent RR bug (the procedural rust shader defaults to
`side: FrontSide`, so the 22 lathe slices were back-face-culled from
inside the cockpit — the interior rendered as "open desert + floating
debris" when viewed from a player-eye position). Patched
`openingWreck.ts` `_hullMat`/`_hullDarkMat` to `side: DoubleSide` +
`shadowSide: FrontSide` (shadowSide prevents interior surface from
casting shadows back into the cavity). Also tightened the entrance
torn-fragments: reduced 7→4, biased to upper half + one side, larger
plates — was reading as a "saw-blade crown around rim", now reads
as asymmetric torn metal. RR's verification was eval-driven from
external camera positions only; this session's interior camera
shots caught both issues. Save/load roundtrip + 51 salvageables +
22 wreck slices verified post-fix. Decision D69. First session
running on the gamedev-framework v0.3.x workflow post-retrofit.

**Prior milestone**: Session RR — Opening wreck full redo (cockpit +
tail stub). Replaces the 534-LOC W-era box-walled wreck with a
~440 LOC rewrite using the KK/LL/NN modelling vocabulary
(LatheGeometry hull, procedural rust shader, per-piece tilted
colliders, salvage panels). **Silhouette**: tapered fuselage with
cockpit dome at +Z and torn-open tail stub at -Z (entrance).
**Skylight**: hull built as **24 angular LatheGeometry slices**;
the two top slices straddling true vertical are omitted, leaving a
genuine 30° stress-fracture gap running the full length of the
upper hull — real god-rays pass into the interior. **Detail**:
`createRustedHullMaterial` weathering on alternating slice
materials (panel-joint read), 3 cockpit window boxes, lateral
breach patches on world ±X flanks (initial impl had a
lathe-local/world-Y axis confusion that buried half of them —
fixed), 7 torn hull-plate fragments around the rear rim with a
bottom-110° walk-in gap, antenna stub + crossbar on the cockpit,
rust-band torus wrapping the tail body. **Colliders**: floor +
cockpit front cap + 2 tilted boxes per side (lower wall + roof-
angled upper wall) + ceiling; rear opening uncollided. **Salvage**:
2 panels registered as `'fuselage'` kind — story-prop opening
wreck is now also salvageable per the session direction (narrative:
"the previous occupant cannibalized panels before they died").
`OPENING_WRECK_EXTENTS` preserved as orchestrator contract;
11 new OPENING_WRECK_* Tuning constants. `openingScene.ts` +
`main.ts` updated to thread `salvageables` through. Save/load
roundtrip verified. Decision D68.

**Prior milestone**: Session QQ-2 — Sled feel pass + sandworm rescale +
hotbar tooltips. Follow-up to QQ addressing the "rope too elastic,
sled spins around character" feel problems. **Rope physics rewritten
(supersedes D65)**: one-way spring-damper replaced with an
**inextensible-rope constraint** — slack rope = no force; taut rope =
position-snap inward by the stretch + project out outward radial
velocity. Sled body rotations LOCKED via `setEnabledRotations(false,
false, false, true)`. Visual yaw lerped each frame toward "face the
anchor" via `SLED_YAW_LERP = 0.12`. Friction back to **0.6**
(metal-on-sand) since static friction correctly holds slack-rope
sleds. Rope length 3 → 5m. **Rope visual**: 2-vertex `THREE.Line`
replaced with `Mesh(TubeGeometry)` along a 5-point
`CatmullRomCurve3` with parabolic mid-point sag scaled by slack.
New **speeder back-bar** (`speederTowBar`) — `updateSleds`
speeder-tether branch reads `towBar.getWorldPosition()` so the rope
visually attaches to the bar mesh. **Sandworm halved** (240m →
120m); all size-scaled ranges halved (BITE 25→12.5, LUNGE_RANGE
30→15, BREACH_ARC_PEAK 40→20, STATIONARY_BREACH_HEIGHT 50→25,
PATROL/DETECTION/DISENGAGE halved). Speeds + durations + HP
unchanged per D49. **Sled cargo bidirectional**: `lootMenu`
widened with `allowDeposit` flag → two-column layout (CARGO + YOU).
Click left = take, click right = deposit. Empty sleds now open
(so the player can stash). **Hotbar tooltips**: hover any non-empty
slot → custom-styled tooltip above the slot showing item name +
description. **Backlog cleanup**: struck 4 shipped entries.
Decision D67.

**Prior milestone**: Session QQ — Sled mechanic — rope-tow flatbed
cargo. New world entity `src/world/sled.ts` (~395 LOC) mirrors
tent/fire placement, loot-container cargo, and speeder velocity-
follow idiom. Two ItemIds shipped: `rope` (wieldable; LMB on a
sled's rope stub ties/unties one end) and `sled_kit` (deploys a
flatbed sled in front of the player). Two interactable sub-meshes:
cargo deck (`interactType: 'open_sled'`, E opens the existing loot
menu via a new `OpenContainer` structural type) + front rope stub
(`interactType: 'attach_rope'`, LMB w/ rope wielded). Tow physics
v1 used a one-way spring-damper impulse — replaced by the
inextensible constraint in QQ-2. `SAVE_VERSION 4 → 5` — `sleds?`
array (id/pos/rotationY/contents/tether) is optional so v1-v4 saves
still load. Recipes: `rope = 2 cloth + 1 branch`;
`sled_kit = 2 scrap + 1 branch + 1 rope`. Decisions D65-D66 (D65
since superseded by D67).

**Prior milestone**: Session PP — Weapon variants + combat
generalization + dev rAF fallback. **3 new weapons** (first combat
content since the machete originally shipped): `pipe_staff` (melee,
2.6m reach + 3m knockback on lizards/raiders), `scrap_gun` (30m
ranged, 6-round magazine via `slot.meta.ammoRemaining` + craftable
bullets), `energy_pistol` (charged 0.5→2.0 damage over 1.2s hold,
glowing chamber via shader `updateHeld` hook). **Combat refactor**:
old machete-only `combat.ts` (100 LOC) replaced with generalized
`_WEAPON_SPECS` dispatch by `WeaponKind` ('melee' | 'ranged' |
'charged'). Shared `fireMelee()` / `fireRanged()` / `dispatchHit()`
helpers. **Dev-mode rAF fallback** (D64) in `core/loop.ts`:
`setTimeout(16)` replaces `requestAnimationFrame` when
`document.hidden && import.meta.env.DEV`, so hidden preview tabs
tick at 60Hz — unblocks combat verification that plagued NN+OO.
New `mouseHeld: Set<number>` on InputBundle (mousePressed clears
each frame so couldn't track held-state for charged weapons). New
`knockbackLizard()` + `knockbackRaider()` (sandworm exempt — 240m
body doesn't budge). 16 new Tuning constants centralize weapon
specs. Inventory bumped to 14/14; trimmed torch + tent_kit +
alien_fruit from DEBUG_STARTER_LOADOUT to fit weapons.

**Prior milestone**: Session OO — Procedural shader expansion: hull
rust + concrete weathering + dune wind streaks + rocky biome via
scatter. 3 new shared material helpers (hullMaterial, concreteMaterial,
extended terrainMaterial), zero-bundle-cost weathering on every
flagship + procgen wreck. Rocky biome REVERTED from shader fissures
(D63 — read too similarly to salt cracks) to actual scatter geometry
(`rockScatter.ts`, 520 rocks). Screenshot workflow fix via toDataURL
documented in `memory/dustfall_preview_screenshot_workaround.md`.

**Prior milestone**: Session NN — Crashed_hull dedicated module
(Wreck POI rework arc complete). New `src/world/crashedHull.ts`
(~430 LOC) replaces inline `placeCrashedHull` in `poi.ts` with
LatheGeometry-tapered fuselage + custom tail bell + per-piece tilted
colliders + 2 salvage panels. No interior (dish stays lone shelter
POI). `partially verified` — tsc clean + 49 salvageables register
correctly + gl.readPixels confirms renderer working, but
preview_screenshot tool stalled (later fixed in OO).

**Prior milestone**: Session MM — Sandworm boss-tier rescale +
procedural terrain shader. Sandworm body 24→240m, ranges rescaled
3-8× per D49 dodgeability rules (speeds unchanged). New
`src/world/terrainMaterial.ts` patches MeshLambertMaterial via
onBeforeCompile for dune sand grain + ripples + slope tint +
salt-flat multi-resolution Voronoi cracks. Mid-session bug fix
(D62): Three.js `vNormal` is VIEW space — silently killed
flatness-gated effects looking down. Fix: per-vertex `aBiomeRaw`
attribute + `vWorldNormal` varying. Memory:
`dustfall_shader_gotchas.md` with 4-step shader-debug stack.

**Prior milestone**: Session LL — Satellite dish polish + engine_block
POI rework. Thread A polished KK's satellite dish (exterior ladder,
interior lantern, droopy cables, rust variation, BURY_Y 2.5→1.0 so
doorway is reachable). Thread B `src/world/engineBlock.ts` replaces
boxy inline cluster with LatheGeometry bells + cooling shroud +
heat shield + fuel hoses + per-piece tilted colliders + 2 panels.
Decisions D61.

**Prior milestone**: Session KK — Wrecked satellite dish flagship POI.
Swapped the hand-placed `antenna_outpost` at (-88, -50) for a
Rust-inspired wrecked satellite dish in a dedicated module
`src/world/satelliteDish.ts`. ~20m tall structure: 8×8×5m half-buried
concrete base, 14m steel tripod, 16m parabolic dish (12 panels w/ 3
missing), feed horn + 2 arms + 1 broken arm, 9 terrain-snapped sand
mounds. Walkable roof + interior colliders + 2 salvage panels. D60.

**Prior milestone**: Session JJ-2 — Spawn teleport bug fix + level
opening camera. `setupOpeningScene` was using
`setNextKinematicTranslation` (scheduled translation, never applied
because game boots paused). Fix: `setTranslation(pos, true)`.
`PLAYER_SPAWN_OFFSET_FROM_ENTRANCE 3 → 4`. Decision D59.

**Prior milestone**: Session JJ — UI overlap fixes + scatter
clustering + movement-feel tuning + spawn polish. Toast (`bottom 32
→ 100px`) and shelter indicator (`bottom 100 → 200px`) lifted clear
of the hotbar / stat-bar column respectively. Dead trees: two-pass
scheme (3 dense groves × 6 trees + 12 sporadic for organic mix).
Cacti: 4 patches × 2-3 each. `'antenna_spire'` removed from
`HERO_WRECK_TYPES` + `PROCGEN_WRECK_KINDS` (anchor `antenna_outpost`
stays). Movement: `WALK_SPEED 4.2 → 6.0`, `SPRINT_MULTIPLIER 1.7 →
2.2` (sprint 13.2 m/s); new `DEBUG_UNLIMITED_STAMINA`. Footstep
cadence retuned for the new speeds.

**Prior milestone**: Session II — Lizard-on-a-stick cooking system +
dead-lizard model + animated held cooking. New `lizard_on_a_stick_raw`
/ `_cooked` items with vertical-stick + impaled-lizard viewmodel
(`buildSkewerMesh` helper, reuses the shared `makeLizardVisual`).
`raw_lizard_meat` renamed DEAD LIZARD and viewmodel swapped to the
actual lizard mesh. Cook duration 0.6s → 3.5s; `tickCooking` writes
`slot.meta.cookProgress` each frame; `viewModel.ts` reads it and
drives a new `ItemDef.playCookAnim` hook (D58). Decisions D58.

**Prior milestone**: Session HH — World rework #3: procgen POIs +
biome-aware AI spawns. ~15 procgen wrecks across the chunk band via
rejection sampling, lizards 4 hardcoded → 28 procgen (salt-excluded,
25m spawn buffer). FF's LOD ring deleted (it poked above chunks in
dune valleys; D52 superseded by D56). `SAVE_VERSION 3 → 4`. Decisions
D56–D57. World-rework arc (EE scoping → FF chunks → GG biomes → HH
procgen) is complete.

**Prior milestone**: Session GG — World rework #2: biome rescale +
scatter retune. `BIOME_NOISE_FREQ 1/220 → 1/900` so biome regions are
vast (~2.67 per 2400m axis) — salt / rocky / dune now form
recognisable broad swaths. New `findBiomeCentroid` in biomes.ts;
waterSources uses greedy `excludeCenters` to plant 3 wells across
separate salt regions. 10 cacti / 30 dead trees / 15-20 hero
landmarks / scatter radii out to ~1100m. `SAVE_VERSION 2 → 3`.
Decisions D53-D55.

**Prior milestone**: Session FF — World rework #1: chunked terrain +
bigger map. Replaced the single 800m heightfield with a 3×3 grid of
800m heightfield chunks (2400m world span). `FAR_PLANE 600→1800`,
`WORLD_RADIUS 280→900`, `FOG_DENSITY_CLEAR 0.0035→0.0018`.
`SAVE_VERSION 1 → 2`. Decisions D50–D52 (D52 superseded by D56 in HH).

**Prior milestone**: Session EE — scoping pass for the world rework.
Split the 10-15h "world + biome rework" roadmap item into three
sub-sessions, which then shipped as FF/GG/HH.

**Prior milestone**: Session DD — roaming Dune-style sand worm boss.
First boss-tier enemy: 24m segmented worm with continuously-tapered
body + embedded torus ridge rings, lamprey-style **recessed maw**
(BackSide-rendered throat carved into the head with two concentric
inward-pointing tooth rings + emissive backstop). 7-state behavior
loop: `patrol → alert → charging → lunge → retreat → stationaryBreach
→ dead`. Patrols a 60m orbit around `SANDWORM_HOME_POS = (60, 0)` in
the open dunes; detection radius 50m → alert (2s + roar) → charging
at 8 m/s underground **with half the body above sand**. Charge
**commits to the player's position snapshotted at enterCharging** —
no leading, no refresh — so sidestep dodges work. Lunge: 2.6s arc
with `BREACH_ARC_PEAK = 5m`, pitch follows tangent (`cos(t·π)·0.6`),
plus per-child **body bend** via `applyBodyBend` so the worm looks
curved through the air. Every 3rd retreat → stationaryBreach (5.5s
vertical hold with layered-sine **side-to-side sway** around the
world-horizontal lateral axis, ±0.3 rad). 6 HP, hits only register
during lunge + stationaryBreach (`damageSandWorm` state-gated). **Sensor
collider** — `setSensor(true)` so the worm doesn't physically shove
the player or ragdoll the speeder; bite damage is an explicit
distance check, not contact. Machete `castShape` passes filter `0`
to include sensors. **Speeder mount fix**: `getPlayerPos(ctx)`
returns `ctx.speeder.body.translation()` when mounted (capsule body
is parked at `(0,-2000,0)` during mount — bug fixed where worm was
attacking origin while player rode away). **Tremor warning** during
alert/charging/retreat within 35m: ±0.06m camera-position jitter +
dust puffs at player feet on a proximity-scaled 0.35→0.10s cadence.
Drops `raw_worm_meat` (+`cooked_worm_meat` via fire). New
`SandWorm` slot on GameContext; save schema gained optional
`sandWorm: { state, health, looted, pos }` — mid-encounter states
collapse to `patrol` at saved XZ on load, dead state restores
corpse at exact death position. Decisions D48–D49. Prior milestone:
CC-4 — biome polish + crescent moon fix + GH Pages deploy. Green
cacti retired; alien cactus rare (3 in salt flats, base grey, fruit
teal), restricted to salt + flat ground via a new `terrainFlatnessAt`
helper. Fruit hide on harvest + regrow after one `DAY_LENGTH_SECONDS`
cycle. Dead trees same salt+flat restriction. Wells now 3 stacked
rock rings with tighter spacing + tilted hatch sitting on min-stone
height; single well placed at the salt-flats centroid
(`findSaltCentroid` grid sweep). `DAY_LENGTH_SECONDS` 480 → 720
(12 real-min day). Lizards 2.5 → 1.8 m/s + head-rotation formula
fixed (mesh forward is local +X, was using -Z-forward yaw → 90° off).
**Moon-light-when-mounted bug fix** in `lighting.ts`: moon's `target`
never updated, so moon position parking at y=-1930 (player capsule at
y=-2000 when mounted) inverted the light direction. `scene.add(moon
.target)` + per-frame `target.position.copy(playerPos)` mirrors sun's
setup; night-while-mounted now matches night-while-unmounted. Title
gained CONTINUE button + tighter button spacing + corrected subtitle;
`#title-overlay.hidden` CSS specificity fixed. **Infra**: GitHub
Pages auto-deploy via `.github/workflows/deploy.yml` (mode-based Vite
base path `/Dustfall/`). Phantom-dep fixed — `simplex-noise@4.0.3`
was resolving from a parent dir's `node_modules` locally and missing
from `package.json` — D46 + D47. Decisions D45–D47. Prior milestones:
CC-3 (animated title screen), CC-2 (speeder polish), CC (hover speeder),
BB-4 (storm + fog rework), BB-2/BB-3 (Jakku-scale mega-wreck), BB
(small mega-ship), AA (torch + flashlight + opening rebuild), Z
(stone-well + salvage panels), Y (footprints + lizard tracks), X
(audio sample-stem architecture, .ogg files pending in
`public/audio/`), W (opening scene), V (atmosphere), U (UX + empty
world), N (rigged raider infra). See [docs/changelog.md](docs/changelog.md)
for full history; [docs/roadmap.md](docs/roadmap.md) for what's next.

### Tutorial flags (Session L)

`localStorage['dustfall.tutorial.v1']` stores `{seenIntro, usedItems}`. Wipe via the console with `__game.resetTutorial()` (or delete the key + refresh) to see the first-boot panel + all pickup hints again. `__game.showControls()` opens the controls panel without changing flags.

## Session workflow

Skills come from the **gamedev-framework plugin**, not local
`.claude/skills/`. Local copies of session-start, session-end, and
triage-ideas were removed at retrofit — invoke the framework versions:

- **Start of session**: `/session-start`. Reads
  [docs/next-session-prompt.md](docs/next-session-prompt.md) if
  present (written by the previous session-end), else falls back to
  [roadmap.md](docs/roadmap.md). Surfaces the last 2 changelog
  entries + 3-5 critical files for the active session.
- **End of session**: `/session-end`. Verifies (`npm run verify`),
  writes changelog entry, updates roadmap, archives plan, prints +
  auto-runs commit + `git tag session-<X>` + push.
- **Idea dumping**: `/triage-ideas` — paste free-form text;
  classifies + appends to [backlog.md](docs/backlog.md).
- **Audit debt**: `/audit-debt` — surfaces high-friction unresolved
  decisions from [decisions.md](docs/decisions.md).
- Memory upkeep: every ~5 shipped sessions, run
  `consolidate-shared-memory`.

Framework skills that DON'T apply to Dustfall (post-MVP, opt-out from
the tier-ladder): `/plan-vertical-slice`, `/verify-tier`,
`/scope-cutter` (until the Scope-cut section in roadmap is populated
per-session).

**Doc-drift guardrail** — print-hints commits (the default per
Dustfall's git policy) can drift from the docs when `/session-end` is
skipped between commits. Precedent: AAW+AAX backfilled in AAY; ABB-ABH
7-session bundle backfilled before ABI. **If the agent finds itself
with 3+ direct-paste commits since the last `/session-end` invocation,
it should pause and surface to the user that a docs catch-up is due
before continuing further code commits.**

## Sub-agent policy

- **Aggressive Explore** agents for "where is X" / "map Y" — separate context budget.
- **Conservative Plan** agents — only for genuinely novel design.
- Skip both when a targeted Grep + Read does the job.

## Don't burn context on

Re-reading files. `git status -uall`. Pasting full eval results when one value answers. Wide screenshots when `gl.readPixels` is enough. Multiple Explore agents when one Grep suffices.
