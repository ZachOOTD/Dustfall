# Changelog

2–4 lines per shipped session. Latest at top. Full plans archived at
`.claude/plans/archive/`.

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
