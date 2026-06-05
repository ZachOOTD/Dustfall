# Dustfall — Session-end report

Cumulative state. Rewritten end-to-end at each `/session-end`.

**Current state**: Session ACAI shipped (2026-06-06 — vulture: rigged animations + branch-perch + death physics + tree collision). `npm run verify` (tsc) PASS. SAVE_VERSION 14 (unchanged — all additive/transient). 4 commits + a pre-tier perf/cleanup pass; every pose screenshot-iterated (rule 8). **Headlines**: (1) **Vulture is now a living creature** — the ACAH static mesh got a joint-pivot RIG (T1, `userData.rig`), a per-state ANIMATION driver (T2: idle neck-bob / wing flap / landing flare / death limp), and a full **relocate-and-land FSM** (T4: a disturbed bird flies to ANOTHER salt-flat tree + re-perches instead of despawning; kinematic body follows so it's shootable mid-air). (2) **Branch-accurate perch (T3, D181)** — `deadTree.grow()` captures real branch points (~60% along depth-2 limbs + dir) into `userData.branchPerches` BEFORE the merge-to-one-geometry; `spawnDeadTrees` returns `TreePerch[]`; the bird's feet seat ON the limb + yaw across it. (3) **Death = dynamic-body tumble (T5, D181)** — `damageVulture` swaps kinematic→DYNAMIC (mirrors dropped-item physics: cuboid + CCD + tumble angvel), bakes the limp pose, and settles on LINEAR velocity (heightfield angular jitter is ignored, else it never rests) → lootable corpse on the dune. (4) **Dead-tree trunk collision (T6, D182)** — one `makeStaticCylinder` per bole; you can no longer walk through trunks. (5) **Pre-tier: perf + cleanup** — `compileAsync` boot pre-warm (fixed the un-shared-shader startup freeze), pickup geometry-merge (draw calls 2386→~1150), metal material→uniforms; removed the buried-cockpit POI (read as a sphere with clipping panels). NEW `__game.killVulture`; rig-shots `vulture-flight`/`vulture-pose --state=`; extended `vulture-kill`/`tree`. **Owed**: the vulture in-MOTION feel (flap/flight-arc/landing/tumble cadence, foreground-owed D150) + the standing ACW/ACX in-motion feel pile + cloud-shadow strength tune. **Next session (ACAJ)** = the deferred **mega-wreck rebuild + procgen-wreck/panel overhaul**.

**Recent sessions (condensed — full detail in changelog.md):**
- **ACAH** (2026-06-05): big overnight — bug sweep + loot bootstrap (D178) + game-wide shader-cache fix (D177) + NEW vulture creature (D179, static mesh — rigged this session) + cloud shadows + mounted-lighting fix (D180).
- **ACAG** (2026-06-05): branch realism + full dead-tree rework + bark grain. Held==world viewmodel lighting (D174); recursive camelthorn dead tree merged to one geometry/tree (D176); bark grain + the FIRST half of the shader-cache fix (wood only, D175).
- **ACAD-ACAF** (2026-06-04): rust/weathering pass (D173) + dev item-spawner panel + branch model rework (superseded by ACAG).

## ACAC scope (this session) — pulse rifle: rapid-fire energy carbine (Cycle 5 weapon half) 100+ sessions post-MVP. `npm run verify` (tsc) PASS. **SAVE_VERSION 14** (unchanged — reuses additive `ammoRemaining`). ACAC added a NEW `pulse_rifle` weapon, distinct from the 3 existing guns: auto-fire (fires while LMB held via a new `auto` WeaponSpec flag) from a self-recharging energy cell (no ammo item; drains 1/pulse, recharges 7/s after a 0.6s idle via the item's updateHeld). Hero-quality glowing-cell model; rare `massive`-wreck loot. D172 (+ a headless slow-game-clock verification footgun). **Next session (ACAD)** = pick a lane: (a) Cycle 5 raider proc-character (the other half), (b) DEEP CAVE SYSTEM, or (c) foreground feel-tune.

## ACAC scope (this session) — pulse rifle: rapid-fire energy carbine (Cycle 5 weapon half)

- **Trigger**: user asked for "just the pulse rifle" (the weapon half of Cycle 5).
- **Mechanic** (`combat.ts` + `tuning.ts`): WeaponSpec gains `auto?:boolean` — auto weapons fire while LMB is HELD (gated by cooldown) + empty silently. The pulse_rifle is a fast (0.13s), low-damage (1.3) ranged weapon whose "ammo" is a `maxAmmo`=28 energy CELL (slot.meta.ammoRemaining, fractional internally) that drains 1/shot + recharges 7/s after a 0.6s idle delay (item updateHeld; combat stamps slot.meta.lastFireAt). No ammo item, no R-reload.
- **Model** (`items.ts`, iterated vs item-studio + fp-item): chunky energy carbine — receiver, glowing segmented energy cell + clamps, emitter coils + muzzle, skeleton stock, grooved grip + trigger loop. Cell/coils glow cyan-green by charge + flash on pulse (shared MeshBasic, energy_pistol pattern).
- **Acquisition** (`salvage.ts`): rarest hero find on massive wrecks (0.015); self-recharging cell = immediately usable.
- **Verification**: NEW `pulse-test` rig-shot scenario — confirmed the cell drains while held + recharges after release. Footgun (D172): the headless harness runs the game clock ~5× slow, so cadence/recharge tests must wait long in wall-clock.

## ACAB scope (this session) — Cycle 6 atmosphere: procedural clouds + clear↔overcast days + storm sky telegraph 100+ sessions post-MVP. `npm run verify` (tsc) PASS. **SAVE_VERSION 14** (unchanged — cloudiness is transient). ACAB delivered the cloud half of Cycle 6 (the storm wall + in-storm penalty + star drift were already shipped): an FBM-noise cloud layer in the sky-dome fragment shader driven by a NEW `weather.cloudiness` (0..1) field that wanders clear↔overcast independent of the storm cycle; overcast flattens the world lighting (sun down, ambient up + cooled) + veils the sun/moon/stars; storms force the sky overcast the moment they start building (ominous telegraph before the dust wall). NEW `sky` rig-shot scenario. D171. **Cycle 6 substantially complete** — only the in-motion storm FEEL tune remains (foreground-owed, D150). **Next session (ACAC)** = pick a lane: (a) DEEP CAVE SYSTEM, (b) Cycle 5 raider proc-character + pulse rifle, or (c) the foreground feel-tune playtest.

## ACAB scope (this session) — Cycle 6 atmosphere: procedural clouds + clear↔overcast days + storm sky telegraph

- **Trigger**: Cycle 6 (atmosphere) overnight. Sub-tasks 1-3 (storm wall, in-storm penalty, star drift) were already shipped, so the new work is sub-task 4 (clouds — didn't exist) + the weather/lighting coupling.
- **Cloud shader** (`sky.ts` SKY_FRAGMENT): FBM value-noise on the `d.xz/d.y` plane (horizon recession), domain-warped to billows, drifted by uTime, thresholded by `uCloudiness`, lit-top/dark-underside + sun-tinted. ~5 iteration rounds.
- **Cloudiness weather state** (`weather.ts`): NEW `cloudiness` eased toward a slow deterministic wander (gamma-biased toward clear); `cloudinessHold` dev pin (`__game.setCloudiness`). Transient, additive, no save bump.
- **Lighting + celestial coupling** (`lighting.ts` + `sky.ts`): overcast dims sun + lifts/cools ambient (`CLOUD_SUN_DIM`/`CLOUD_AMBIENT_LIFT`); clouds veil sun disc/moon/stars (clear night = full stars, overcast = veiled).
- **Storm telegraph**: storms force overcast at BUILDING start (before dust) + darken clouds to an ominous dusty hue. Verified state=building, intensity=0, cloudiness=0.9.
- **Verification**: NEW `sky` rig-shot scenario (cloud cover × time-of-day + ground lighting + storm-build telegraph).
- **Scope note**: pivoted Tier 4 from the planned static storm-wall refinement (low-ROI — wall built + FG-owed) to the storm telegraph (higher-value, headless-verifiable).

## ACAA scope (this session) — FP-viewmodel fixes from playtest 100+ sessions post-MVP. `npm run verify` (tsc) PASS. **SAVE_VERSION 14** (unchanged). ACAA fixed three user-reported issues with the new item models: (1) see-through grip-rings/coils — the FP viewmodel now renders in its OWN scene in a **second depth-cleared pass** (depthTest back ON so it self-sorts; the depth clear keeps walls from clipping it) — `core/loop.ts` + `player/viewModel.ts`, D170; also un-broke the long-standing `transparent=false` viewmodel override that killed the torch flame alpha; (2) the held branch + the ~200 world-pickup branches now share one model (`buildBranchMesh`), and the ACZ splinter-bristles/knots are gone; (3) a real layered torch fire (additive flame + ember sparks) shown only when lit. NEW `fp-item` rig-shot scenario renders the real first-person viewmodel. **Next session (ACAB)** = pick a lane: (a) DEEP CAVE SYSTEM design+build (default) or (b) foreground feel-tune of the owed ACW/ACX in-motion pile (needs a human).

## ACAA scope (this session) — FP-viewmodel fixes from playtest

- **Trigger**: user testing the ACY/ACZ item models flagged three issues.
- **See-through rings (D170)**: FP viewmodel materials had depthTest/Write OFF (anti-wall-clip), which disabled self-sorting → the far side of closed shapes (grip-rings/coils on the new detailed items) drew over the near side. Fix: the viewmodel lives in its own `THREE.Scene` (own ambient+key+fill lights) rendered in a SECOND pass over a cleared depth buffer (`loop.ts`: world → `clearDepth()` → viewmodel); depthTest back ON. Two gotchas: `getRenderTarget()` always returns a target so the vm pass must run AFTER the main render unconditionally (not in an `else`, or the vm vanishes); and `configureViewModelMaterial` was force-setting `transparent=false`, silently breaking the torch flame fade — now preserves authored transparency. Trade-off: held items no longer dim at night (fixed vm-scene lights).
- **Branch**: dropped the ACZ splinter-bristles + knots; extracted shared `buildBranchMesh` (NEW `world/branchMesh.ts`) used by the held item (vmWood) AND world pickups under dead trees (Lambert grey, ~200 instances) so they match.
- **Torch fire**: static emissive cone → layered additive flame (4 nested cones, orange→hot-white) + 7 rising/fading ember sparks, flickering in `updateHeld`, shown only when `slot.meta.lit`.
- **Verification**: NEW `fp-item` rig-shot scenario renders the REAL first-person viewmodel (the `item-studio` can't reproduce viewmodel depth/material bugs — its meshes use default materials). Confirmed rings solid (scrap_bar/rope/canteen) + torch flame glowing.
- **Known gaps**: 3P torch flame doesn't animate (FP-only); held-item night brightness (both in backlog).

## ACZ scope — item-model detail pass part 2: the remaining ~22 models

- **Trigger**: finish the ACY item-model thread — bring the kits/foods/materials up to parity with the 12 ACY hero items.
- **Deep-polished primitives (7)** (`items.ts`, iterated vs the `item-studio` view): tent_kit (plain cylinder → rolled canvas bundle: roll + end-spiral + cord straps + flap + bundled poles + iron stakes), sled_kit (plank stack → folded warped scrap-metal sheet + rivets + strap + runners + yoke stub), grill_kit (flat bar-stack → framed cooking grate + grate bars + 4 folding legs + chain), companion_pod (faceted egg → smoother carved-stone egg + glowing crack-vein network + speckle nubs + base), cactus_pulp (green box → cut cactus chunk: flesh + waxy skin cap + fiber ribs + spines), alien_fruit (flat ellipsoid → bioluminescent fruit: glowing MeshBasic pods + mottle spots + stem/sepal calyx), raw_worm_meat (single slab → lumpy flesh + raw membrane + fiber striations + wet ooze).
- **Light touch (1)**: branch (rounder 8-sided shaft + splintered broken end + knot bumps + 3rd twig).
- **Verified at parity (no change)**: scrap, cloth, stake_kit, fire_kit, locker_kit, lantern_kit, bedroll_kit, large_tent_kit, all cooked foods, lizard/shrew raw+cooked + lizard-on-a-stick (creature meshes / ABO-ACL upgrades — confirmed still reading well).
- **Process (honest)**: breadth pass — primitives got 1-2 studio rounds each (not the full 5-8; the 12 hero items already consumed ACY). They read clearly as their objects. No new D-entries (reused the ACY itemStudio harness + D169). `createStoneMaterial` has no `localSpace` → kept Lambert + geometry detail on companion_pod (procedural noise crawls on a moving viewmodel — D109).
- **Owed (unchanged)**: the ACW/ACX in-motion feel pile (D150, foreground-only).

## ACY scope — item-model detail pass (12 held items) + dynamic salvage-panel placement + POI greebles

- **Trigger**: user direction for a long overnight — a big detail pass on every item model (3P animations explicitly deferred — a rigged model may be imported later), plus salvage-panel variety/dynamic-placement + POI art detail + small wins.
- **Lane 1 — 12 hero item models** (`items.ts`, each iterated build→shot→critique vs the new studio): machete (extruded parang blade + bevel/spine/fuller/guard/quillon/bolster/wrapped grip), pipe_staff (jointed plumbing: coupling/threads/flange/clamp/taped grip), scrap_bar (double-ended crowbar), scrap_gun (welded zip-gun: seam/port/breech/wire-wrap barrel/hammer/wrapped grip/trigger loop), energy_pistol (alloy sci-fi: vent fins + glowing coils/emitter/cells via the preserved `updateHeld` charge-pulse), amban_rifle (+scope w/ glass lenses & mounts, mag, recoil pad, bolt ball), scrap_bullet (bottlenecked cartridge), torch (rag-wrapped branch + cords + charred head), flashlight (forward tube + knurled body + bezel/reflector/lens/tail button), rope (wound coil hank + lashing + fray), canteen (tin flask + felt cover + band + knurled cap + chain), bandage (rolled gauze + wrap rings + draping end + tie + cross). Ground pickups reuse `makeViewModel` so they inherit the upgrades.
- **Tooling** (D169): NEW `__game.itemStudio(id,angle)` (mesh in isolation, suspended vs the sky, rig hidden, lit for form) + `item-studio` rig-shot scenario (`--items=a,b,c --angles=…`). The `held-item` shot buried small items behind the rig torso.
- **Lane 2 — dynamic panel placement** (`procgenWreck.ts`, D168): NEW `findPanelMount` raycasts a jittered ±Z-flank grid → first hit that's outward + flat (4-ray probe ring) + not on a tagged decoration + clear of placed panels; returns part-local coords + cardinal `faceYaw` (no `addAccessPanel` change). Replaces the single hardcoded `panelAnchor` (kept as fallback); breach patches + welded plates tagged `isWreckDecoration`. Panel **size variants** (`SALVAGE_PANEL_SCALE_*`). Verify: hardened `panels` scenario + `__game.panelBuryAudit` (raycast inward; pass iff panel reached before hull) → 75/77, 75/78, 66/68 across 3 seeds; only pre-existing hand-modeled curved bell/pod panels flag.
- **Lane 3 — POI detail + small win**: `addHullGreebles` (panel-lines/rivets/vents, rule-7, tagged) on ribbed-cylinder + plated-rectangular hulls; amban_rifle → `massive` loot table (0.02, was dev-only).
- **Foreground-owed (unchanged, D150)**: the whole ACW/ACX in-motion feel pile — not overnight-doable.

## ACX scope — 3P fix pass: held-item hand/orientation, speeder cam, footstep depth, seated rig pose (numeric-IK)

- **Trigger**: user foreground feedback on ACW's 3P work — items in the wrong hand + facing backward, hands palm-out, speeder 3P cam in front, footsteps showing through held items, and the seated speeder rig "totally wrong."
- **3P held items** (`af039cf`): `rightHandAttach` moved to the real RIGHT hand (`side===-1`, index 0); `makeBasis` corrective baked onto the attach so attach-local −Z = world-forward; visible hand meshes wrapped in a `handVisual` sub-group rolled inward (palms toward body) WITHOUT disturbing the item grip; per-item `handAttachTransform` for machete/scrap_bar/pipe_staff/guns/rifle.
- **Speeder 3P chase cam** (`af039cf`): behind the rider along the look dir, looking forward; `SPEEDER_3P_CAM_BACK/ANCHOR_UP/ABOVE`. Pre-fix sat at the 1P rider seat.
- **Footsteps-through-items** (`04e99d9`): footprint decal `polygonOffsetFactor:-1` punched through at grazing angles; removed polygonOffset (the 4cm `FOOTPRINT_OFFSET_Y` lift alone prevents terrain z-fight).
- **Seated speeder rig re-solve** (this turn, uncommitted at report time): the OLD harness lied (overrode the camera + assumed +Z=face → reported "fine" for 3 rounds while the live view was wrong — D165). New `bike-truth` scenario renders the real chase-cam + 5 fixed world angles + a numeric-IK **sweep** minimizing wrist→grip / ankle→peg world distances (D166). Solved: facing was already correct; the real bug was the ~0.65m arm can't reach the ~0.80m grips without a forward lean. Pose = lean 0.60 **pivoted at the waist** (D167 — `spineBend` is parented at rig origin y=0, so a bare lean slid the torso ~0.4m off the pelvis = the disconnect; compensating `spineBend.position` pivots at the waist), arms vertical onto the bars (~5cm), legs splayed astride, seat back `SPEEDER_RIG_SEAT_Z` 0.28→0.36 (capped — further back puts the bars out of arm reach). Feet ~22cm from pegs (astride; 3-DOF leg can't hit pads dead-on). `spineBend.position` reset on the non-seated path.
- **Foreground-owed**: live in-motion riding feel; exact feet-on-pegs contact; plus the carried ACW D150 pile.

## ACW scope — overnight: full art/animation + storm-feel pass (the deferred ACV pile, executed)

- **Recalibration**: prior overnight (ACV) pre-emptively scope-cut the visual pile + checkpointed mid-build citing budget/turn-length when neither was the real constraint. ACW operating mode = plan deeply → execute the whole plan with real rule-8 screenshot iteration; no pre-emptive cuts; genuine D150 feel/kinematic items built fully + batched for the user's playtest.
- **Phase A** (`2b7830a`): `ItemDef.handAttachTransform {pos,rot}` (3P hand placement, applied in `viewModel.swapEquippedMesh`) + `ItemDef.playUseAnim3P(rig,t)` (drives the rig's right arm during a use-anim in 3P) + `enemies/creatureGait.ts` (shared sin-phase gait) + `world/particleTrail.ts` (pooled soft-fade ShaderMaterial particles).
- **Phase B** (`f8b08c1`): lizard sprawl-gait + shrew walk-gait (diagonal leg pairs via the gait helper) + shrew **burrow** FSM state (dives into the sand within SHREW_BURROW_RADIUS, sand puff, re-emerges) + companion mid-leg knuckles (polish — it was already a full proc-character).
- **Phase C** (`a042351`): speeder dust trail (speed-gated pooled particles) + engine-ignition glow (nozzle emissive + PointLight ramp with speed). Fixed the particleTrail size=world-diameter convention (D161).
- **Phase D** (`701779b`): fixed `raw_shrew_meat`+`cooked_shrew_meat` (had NO makeViewModel — rendered nothing) + 3P grip transforms for machete/scrap_bar/pipe_staff + machete `playUseAnim3P` chop (D160). Guns/rifle/consumables grip+use-anim pass deferred.
- **Phase E** (`e439e7e`): #146 storm wind on loose bodies (`stormWindAccel` → pickups/speeder/sled; world-intensity per D163) + #134 in-storm camera sway + master audio low-pass.
- **Phase F** (`8b9bdc7`): #149 3P interact-prompt projects the hovered object's world hit point to screen.
- **Foreground-owed (D150, built fully — verify live in ACX)**: in-motion gaits, burrow dive/puff timing, speeder FX in motion, storm wind+sway+muffle feel, machete 3P chop read, per-item 3P grip fit, 3P prompt on-object placement.

## ACV scope — overnight (partial): backlog clear + bugs + companion egg-cave

- **Wave 0** — closed the 3 verified-fixed backlog "bugs" (#147 speeder mount-seat = ACQ look-gate, #150 iron-stake = ACQ+ACU, #100 speeder angular = X/Z rotation-locked).
- **Wave 1** (`c9c71a6`): #148 seated 3P rig pose on the speeder (reposition to rider seat + seated pose; `SPEEDER_RIG_SEAT_Y/Z` foreground-tunable; D159); #187 sled drag marks lightened; #41 aim-twist turn-gain 0.10→0.18.
- **Wave 2 — companion egg-cave** (`2d4035b`, D158): `rockyEntrance.ts` builds a glowing ovoid egg in the descent chamber (exists iff `!companionAcquired`); new `'eggs'` interaction registry + `'hatch'` type → E spawns the companion + sets acquired + removes the egg; `companion.ts` `despawnCompanion`; `save.ts` additive `companionAcquired?` (legacy default true, NO version bump); `main.ts` boot reconcile in `handoffToGame`. New-game → no companion → egg is the path.
- **Deferred to ACW** (pre-committed scope-cut, visual/feel-tuning): speeder dust+engine FX (#183/#184), sandstorm wind (#146), 3P prompts (#149), in-storm sensory (#134), egg/cave visual polish, companion proc-character, + the art/animation pile.

## ACU scope — playtest pass: rig look + speeder/sled/rope features + slide tune

- **PM-E PBR revert** (`playerRig.ts` + skin/fabric factories, D154): the `pbr` path's derivative-based (`dFdx/dFdy`) micro-bump shimmered on the moving rig. Dropped `pbr` from 3 skin + 4 cloth mats → Lambert; procedural COLOR unaffected.
- **Shadow swim/flicker fix** (`lighting.ts`, D155): force a shadow-map regen on any frame the player moved (was a fixed ~10Hz throttle while the shadow camera follows the player every frame → stale projection matrix → self-shadow drift/snap).
- **Rey outfit + full-body cloth + head** (`playerRig.ts`, committed `4f3d4e9`, 3 screenshot rounds): off-white tunic/hood/wraps/pack; arms/shoulders/legs/neck clothed (were bare skin); hood crown lobing smoothed.
- **#40 speed-spike clamp** (`controller.ts`): horizontal KCC corrected delta capped at 1.5× the fastest legit on-foot frame.
- **#42 sled-vs-POI collision** (`sled.ts`, D156): `clampSledMoveAgainstPOIs` shapecast at both move commits; `Tuning.SLED_POI_COLLISION`.
- **#50 rope-leaves-inventory** (`sled.ts` + `interaction.ts`, D157): `applyTether` centralizes deploy/return; drop-with-G releases; LMB floor-drop removed. No save bump.
- **Footstep-puff FP fix** (`controller.ts`): rig-ankle emit point only in 3P; FP uses body-center (the rig bones are 3P-gated, so the ankle was stale in FP).
- **Sled tow-handle** (`sled.ts`): smaller/lower/rusted; rope attaches to + wraps the cross-bar via shared `SLED_YOKE_*` constants.
- **Slope-slide tune** (`tuning.ts`): `SLED_SLOPE_SLIDE_GAIN` 6→2.5 + `SLED_KINETIC_FRICTION` .15→.20 (critical angle ~1.4°→~4.6°).

## ACT scope — 3P/FP parity fixes + world-space texture-swim sweep

- **FP footprints + footstep audio fix** (`playerRig.ts`, D151): hoisted the gait bookkeeping (`speedMag`/state/gait-phase/`stepCount`) ABOVE the visibility early-return so it runs in both camera modes; only the visual transform work (position/heading/bone posing/IK) stays 3P-gated. `controller.ts` reads `stepCount` for both footstep SFX + footprint decals, so FP was silently dead before.
- **3P interact-hint reach fix** (`interaction.ts`, D152): the hover ray now originates from the player eye along camera-forward in 3P (was `cam.position`, ~1.8m behind → ~0.7m effective reach); no-op in FP.
- **D109 texture-swim sweep** (D153): added `localSpace` to `woodGrainMaterial`/`boneMaterial`/`glassMaterial`; decoupled `fabricMaterial` `localSpace` from `disableShimmer`; `items.ts` routes all viewmodel materials through `vmMetal/vmWood/vmBone/vmGlass` local-space wrappers; fixed `speeder.ts` antenna + `playerRig.ts` metal/paint. Audit confirmed sled/creature-skin/rig-skin/rig-fabric already safe; raiders use plain materials; static world objects left world-space.
- **Backlog**: triaged the ACT idea dump (7 [feat] / 4 [polish] / 1 [idea]) — item-model quality, 3P hand placement + use anims, creature gait + shrew burrow, speeder FX, seated 3P speeder cam, cloth-physics robe, lighter sled marks, POI detail + dynamic salvage-panel placement.

## ACS scope (this session) — carcass tow/harvest flow fix

Fixed the ACF "carcass tow blocked after harvest" bug. Investigation: harvest was BLOCKED while towing (the `towed` interaction branch returned before the loot branch), so the dramatic "towed-then-harvested can't cut loose" was unreachable and a carved carcass went fully inert. Fix: the towed branch carves meat on `E` (LMB still cuts loose) via a shared `harvestWorm` helper; `lootSandWorm` keeps the tag while towed; the raycast targets a looted-but-towed carcass. tsc-clean + logic-traced; foreground-confirm owed (the user's current playtest covers it).

## ACR scope (this session) — backlog archive round 2 + shrew catch/cook

- **Archive**: megaWreck catwalk panels confirmed already-shipped (ACL #9/#10) → archived; the ACL-duplicate + procedural-arc-followup cruft pruned. Active backlog now reflects only genuinely-open work.
- **Shrew catch/cook** (SHIPPED): `shrew.ts` (`'dead'` state + `damageShrew`/`applyDeadShrewPose`/`lootShrew` + dead-skip), `combat.ts` (`getShrewForCollider→damageShrew` dispatch), `interaction.ts` (`'shrews'` registry + dead-shrew target + `'take'`→`raw_shrew_meat`), `items.ts`/`types.ts` (`raw_/cooked_shrew_meat`) + COOK_MAP, `save.ts` (persist/restore dead+looted, mirror lizard). Verified the kill via `--scenario=shrew-kill`; take+cook loop foreground-confirm owed.

## ACQ scope (this session) — backlog archive + quick wins

- **Backlog archive**: removed 10 ACL-shipped duplicates (superseded by the line-38 shipped record), collapsed the ABT→ABY procedural-character-arc followup pile + ABS-deferred + ABP-Tier-5 into a tombstone (arc complete; model at ceiling per ACK), tombstoned the obsolete FP-forearm-wraps entry (viewModelHands.ts deleted ACJ/ACK).
- **Pebble rename** (`companion.ts`/`interaction.ts`/`items.ts`/`tutorial.ts`): player-facing copy only; internal identifiers unchanged.
- **Iron stake fixes** (`stake.ts`/`rope.ts`/`tuning.ts`): sand mound removed; rope-loop reseated near the top touching the shaft; `resolveEndpointWorldPos` stake case now resolves the real ring world pos (offset + yaw). `STAKE_LOOP_OFFSET_X/Y` in Tuning shared by both. Verified via `--scenario=stake`.
- **Speeder mount look-gate** (`speeder.ts`/`tuning.ts`): mount requires the camera to face the bike (`dot ≥ SPEEDER_MOUNT_LOOK_DOT`), not proximity alone.
- **Deferred**: carcass-tow cut-loose (ACF — interaction-logic in the drag system, hard to verify headlessly).

## ACP scope (this session) — salvage-panel clipping investigation + buriedCockpit faceYaw fix

- **`panels` harness scenario** (`rig-shot.mjs`): enumerates `ctx.salvageables.list`, force-opens every door, screenshots one panel per unique kind. The 6 procgen kinds present (fuselage/escape_pod/cargo_container/engine_bell/engine_cluster/massive) all render interiors correctly when open → bug not systemic.
- **buriedCockpit faceYaw fix** (`buriedCockpit.ts`): `Math.PI` → `-Math.PI/2`. `addAccessPanel` maps `local+Z → (sin yaw, 0, cos yaw)`; a -X flank panel needs `-π/2`. Audited all 15 call sites — only this one was wrong (others use the wrapper-Group pattern or correct flank yaw). Geometrically verified; visual confirmation owed.

## ACO scope (this session) — night ambient-dust gate + bug intake

The user reported 5 bugs; all logged to `backlog.md`. One was a clean headless-verifiable fix (shipped); two need a foreground repro; two are larger (deferred).
- **Night ambient-dust gate** (`ambientDust.ts` + `tuning.ts`, SHIPPED): the always-on tan drift now multiplies opacity by a daylight factor from `ctx.time.sunHeight` (new `AMBIENT_DUST_NIGHT_FADE_LO/HI` = 0.02/0.20) and hides the layer entirely at night. Verified via the `night-sky` scenario (`sunHeight:-1` → `dustVisible:false` + a clean starfield shot). The near-white chest-height `dustMotes` (a deliberate firelight-air detail) were left on.
- **Harness** (`rig-shot.mjs`): added `night-sky` + `footprints` scenarios.
- **Footprints + speed-spike (D150, NOT fixed)**: both read the kinematic body's `linvel()`; the throttled headless tick makes `linvel` read 0 (`speedMag=0`/idle even while moving) so the gait/footstep path can't run there — even pre-mount. No obvious code fault on static read. Need foreground repro.
- **Sled-POI collision + panel-clipping (deferred, larger)**: kinematic-vs-static shapecast / a visual sweep across all POIs.

## ACN scope — cursor-trap fix + live-scenario harness + ACL live-feel triage ACN fixed the OS-cursor trap during `npm run rig-shot` (DEV `enterGame` acquired PointerLock because the focus heuristic misses headless Playwright → now `handoffToGame({skipLock:true})` deterministically — D147), extended `rig-shot.mjs` with a live `--scenario` mode that ticks the game + samples from Node (D149), made aim-twist **dynamic** (camera turn-rate lead, was a constant bias — D148), and verified all 3 ACL live-feel items in the ticking env (shrew flee, aim-twist sweep, rifle fire/reload — all PASS; ACM's frozen-tick concerns resolved). The ACM→ACN arc fully closes the ACL rule-8 visual-triage debt. **Next session (ACO) = foreground feel-tune of dynamic aim-twist**, then breadth or a player-model follow-up.

## ACN scope (this session) — cursor-trap fix + live-scenario harness + ACL live-feel triage

Began with a user-reported bug (cursor trapped in an invisible top-left box during Playwright verification) and grew into finishing the live-feel triage ACM couldn't reach (the preview-MCP rAF freeze, D146).

- **Cursor-trap fix** (`input.ts` + `main.ts`, D147): `enterGame()` → `handoffToGame({skipLock:true})`; automated entry never acquires PointerLock (the `document.hidden||canvas0||!hasFocus()` guard can't detect headless Playwright, which reports visible+sized+focused). Shared `pointerLockSuppressed()` helper; start-overlay click also guarded.
- **Dynamic aim-twist** (`playerRig.ts` + `tuning.ts`, D148): the ACL feature was a constant 0.35-rad 3P shoulder bias; now derives camera turn-rate (Δheading/dt) and leads the lead shoulder into turns, relaxing to a 0.18 resting bias. New `AIM_TWIST_TURN_GAIN`=0.10, `rig._aimPrevHeading`. Harness-verified directional response (steady 0.167 → turn+ 0.207 → turn− 0.052).
- **Live `--scenario` harness** (`scripts/rig-shot.mjs`, D149): enters the game ticking, drives + samples from Node (not in-page rAF — throttled in the hidden Playwright tab; game survives via its setTimeout fallback), pre-dismisses the tutorial overlay (else `updateWieldAction.overlayOpen()` gates all LMB). Scenarios: `shrew-flee`, `aim-twist`, `rifle`.
- **ACL live-feel triage** (all PASS): shrew flee bolts ~8m @ ~3.2 m/s + settles + resumes wander; aim-twist sweep (dynamic); rifle fire decrements ammo (3→2) + R-reload refills from scrap_bullet (2→8). The rifle "didn't fire" mid-session was the tutorial-overlay LMB gate, NOT a combat bug.

## ACM scope (this session) — visual-triage of the ACL features (partial) + debug storm-hook fix **SAVE_VERSION 14** (unchanged). ACM visually verified — via STATIC screenshots + runtime state inspection — the ACL visuals: night-sky stars, the sweeping storm wall, the desert-shrew MODEL, the amban-rifle viewmodel, and the aim-twist rig plumbing (all read correctly). It **fixed the stale debug `triggerStorm` hook** (set `weather.state` inline without arming the wall → 0 intensity; now delegates to `weather.triggerStorm`/`armWall`). **⚠ Live FEEL could NOT be verified** — shrew flee motion, the aim-twist sweep, and rifle fire/reload — because the headless preview tab is `document.visibilityState:"hidden"`, so the browser throttles rAF to zero and the **game tick is frozen** (the documented hidden-tab gotcha; **D146**). Those three are structurally sound but need a foreground `npm run dev` playtest or an extended Playwright harness. The player-model arc remains complete (ACK ceiling = believable stylized human). **Next session (ACN) = finish the live-feel triage in a TICKING environment**, then more breadth or a player-model follow-up.

## ACM scope (this session) — visual-triage of the ACL features (partial) + debug storm-hook fix

A `/visual-triage` pass to close ACL's rule-8 debt. **Verified clean** via static screenshots + sync state-evals (the only verification the environment allowed): night-sky stars, the sweeping sandstorm wall, the desert-shrew procedural model (renders as a recognizable small critter in-world, not broken/inside-out), the amban-rifle viewmodel (detailed, well-proportioned procedural rifle built from the metal/wood material factories), and the aim-twist rig plumbing (`_aimTwist` + `shoulders[1]` present). **Fixed**: the debug `triggerStorm` hook (`debugPanel.ts`) was stale post-ACL — it set state inline without arming the storm wall, so a debug storm produced 0 intensity; now delegates to the exported `weather.triggerStorm(ctx)` (which calls `armWall`). **Blocked (D146)**: live FEEL of shrew-flee / aim-twist-sweep / rifle-fire could not be exercised — the preview tab is `visibilityState:"hidden"` → rAF throttled to zero → tick frozen (`elapsed` stuck; an rAF callback never fired in 30s). Worked around the `isPlaying` pointer-lock gate but the rAF freeze is a hard browser-level block. Carried to ACN.

## ACL scope — overnight breadth: 8 features via fanned-out agents

Ran a long unattended overnight (~2M budget) as **8 disjoint file-ownership lanes in parallel + a single integrator** (D143): each lane edited only its own files + tsc + returned an integration manifest; the integrator applied all manifests to the shared seams (`main.ts` tick, `save.ts` v13→14, `GameContext.ts` `ctx.shrews`, `tuning.ts` ~40 promoted consts) and ran the authoritative full tsc (PASS). 9 agents, ~573k subagent tokens, ~12min wall.

- **aim twist-IK** (`playerRig.ts`): 3P right-shoulder leads toward camera (`_aimTwist`, additive yaw, ±0.5).
- **speeder angular damping** (`speeder.ts`): passive Y-yaw decay so post-collision spin settles.
- **worm twilight-breach audio attenuation** (`sandWorm.ts`+`audio.ts`): distance-scaled roar for ambient breaches.
- **megaWreck ground panels** (`megaWreck.ts`): 2 chest-height salvage panels (no stairs needed).
- **night-sky stars** (`sky.ts`): ShaderMaterial twinkle + deterministic drift + cloud occlusion.
- **Dune sweeping sandstorm** (`weather.ts`, D145): directional storm WALL deriving `weather.intensity` (downstream readers unchanged); anisotropic dust; wall state persisted.
- **in-storm movement penalty** (`controller.ts`): unsheltered + high intensity → no sprint + slowed walk.
- **amban rifle** (`types.ts`/`items.ts`/`combat.ts`): new ranged weapon + procedural viewmodel; **+ viewmodel fidelity** on 3 kits.
- **desert shrew** (NEW `enemies/shrew.ts`): ambient flee-AI critter; `ctx.shrews`, tick after `updateLizards`, save roster.
- **Verification**: full tsc PASS + boot smoke-test clean. **Rule-8 debt**: the new visuals (stars/storm/shrew/aim-twist) NOT visually-iterated → `/visual-triage` owed.

## ACK scope — PM-C outfit + realism pass

PM-C re-dressed the torso (bare since the ACJ poncho cut) with a fitted wrapped **tunic** hugging the body lathe (D140). Then a goal-driven **9-round realism arc** took the figure from a cartoon mannequin → a believable solid dressed human:
- **Proportions** (D142): `HEAD_R` 0.135→0.115 (≈ 1:7.7 adult; ACI's 0.135 read as a 1:6.7 cartoon big-head) + longer/slimmer neck.
- **Stance**: contrapposto verification pose (vs stiff mannequin).
- **Player materials → PBR** (D141): skin + cloth opt into `MeshStandardMaterial` (per-fragment lighting) + derivative procedural **micro-bump** + **baked occlusion** (downward faces darkened → undersides self-shadow under flat ambient = solidity without a scene-lighting change). Opt-in `pbr` flag; creatures stay Lambert.
- **Goggles** → glossy convex glass lenses (specular glint). **Hands** → slim curled. **Boots** → sole+toe+heel. **Head** → fuller cranium.
- **Harness**: `--lit=form` (key+rim), `full/full3q/torso` framings, `relaxed` pose.
- **Honest ceiling**: believable *stylized* human, not photoreal. Removed dead `viewModelHands.ts`.

## ACJ scope — SkinnedMesh rig foundation + face + poncho cut + Playwright harness

The headline is a **foundation rebuild**: after ~13 sessions polishing a rig of rigid Lathe/Box primitives parented at joint Groups, the quality ceiling was diagnosed as the foundation (rigid parts can't deform across a joint → hard elbow/knee/wrist seams + a hand that jutted off the wrist as a disconnected block). User chose procedural skinning over an imported rig.

- **PM-S — procedural skinned limbs** (NEW `src/player/skinnedLimb.ts` ~115 LOC + `playerRig.ts`, D136): `buildSkinnedLimb` lathes a radius profile into one continuous tube + generates skinIndex/skinWeight blending across the mid joint + binds a 3-bone chain. Arms (shoulder→elbow→wrist) + legs (hip→knee→ankle) converted — joints bend smoothly, no seam. Bones replace the pivot Groups 1:1 (Bone extends Object3D); animation / foot-IK / held-items / stepCount unchanged. PlayerRig limb fields retyped `Group[]`→`Object3D[]`.
- **Hands** fixed: continue the arm (fingers down-forward) instead of jutting forward; thumb mirrored per side. FP viewmodel hands removed (floating camera-anchored wraps).
- **Face complete**: PM-B.2 goggles (smoked lenses + brass rims + bridge + temple stubs) + brow + nose-bridge; PM-B.3 pale lower-face scarf wrap (distinct tone, stands proud so the cloth edge reads).
- **Poncho removed** (D139 — stiff fake, pending PM-D cloth) → exposed the torso↔limb junctions; fixed with hip-cap filler spheres + widened pelvis + bigger deltoid (hips→legs read continuous).
- **rigStudio framing fix** (D137): PM-B.1 moved the face to +Z, inverting D135's negate, so every `'head'`/`'front'` shot since ACI showed the BACK. Removed the negate; verified empirically.
- **NEW Playwright harness** (`scripts/rig-shot.mjs`, D138): self-contained capture (own dev server + headless chromium), `--pose/--angles/--closeup`. The reliable path now the preview-MCP wedges (it wedged twice this session).

## ACI scope — player-model re-plan + PM-A + PM-B.1

After ACH, a full-body audit (via `rigStudio`) honestly found the model far from the Rey/real-human bar: a rigid barrel/sandwich-board on stick-legs, blank ovoid face, floating mushroom-disc scarf. The single "Rig to Rey-tier" cycle was re-planned into a 5-cycle arc (`docs/feature-player-model.md`) with a repeatable **Model Verification Protocol** (6 canonical frames + critique vs real-human + Rey reference + adversarial pass-bar), 5–8 rounds/element.

- **PM-A.0 `__game.rigStudio(angle?)`** (`debugPanel.ts`): the verification engine — one call gives a headless, evenly studio-lit, framed full-body shot at a canonical angle. Used every round.
- **PM-Cycle A — silhouette (pass-bar MET)** (`playerRig.ts`): `TORSO_CHEST_R` 0.22→0.185, `WAIST_R` 0.16→0.115 (killed the barrel, real taper); poncho narrowed + lengthened (H 0.85→1.05) + deeper folds (8 waves) + scalloped hem; `HEAD_R` 0.12→0.135. Reads as a slim draped human. Rig consumers unaffected (only mesh radii changed; skeletal constants untouched).
- **PM-B.1 — hood wraps the skull** (`playerRig.ts`): crown rebuilt from a floating mushroom-disc → a sphere section wrapping top/back/sides (phi→0.92π) with a front face opening. Floating disc killed.
- **Bug fix**: `rigStudio` framed via `getWorldDirection` (head's +Z, away from the face) → showed the BACK; negated (D135).
- **Rule-8**: every element screenshot-iterated with honest deferrals (poncho stiffness → PM-D, face → PM-B.2, neck-wrap → PM-B.3, shoulder bunching → PM-C) — the correction for the ACH over-claim. **Deferred**: PM-B.2/B.3/C/D/E.

## ACH + ACG condensed

- **ACH** (2026-05-31): "Rig to Rey-tier" detail + the `enterGame` headless self-verify tooling (D134). Shipped band-wraps/fingerless-glove/unified-scarf/belt-pouches/backpack/boots + a floating-knuckle-bump fix. NB: the audit (ACI) found the underlying silhouette wrong → re-planned. The `enterGame` loop (D134) is the lasting win.
- **ACG** (2026-05-31): Cycle 1 drag verification — DEV `spawnRaider`/`killRaider` hooks (raiders dormant per D13), head-first drag orientation (D133), human-playtest-closed. Overnight correctly fell back to gated.

## ACF + ACE + ACD condensed

- **ACF** (2026-05-31): B1 Phase 3 follow-up — corpse/carcass rope-drag (ACE Cut #3). `RopeEndpoint` gains `raider_corpse` + `sandworm_carcass`, the first *towed-body* kinds; drag state lives on the entity (`dragAnchor`), not `sled.tether` (D131). NEW `killDrag.ts` = first non-sled caller of ACE's `applyInextensibleConstraint`; sagged rope per kill. Worm carcass speeder-tow-only (D132). Save additive. Functionally verified; the drag *feel* + raider path were the rule-8 debt ACG/Cycle-1 closed.
- **ACE** (2026-05-27, overnight): rope vocab Phase 3 (`ropeConstraint.ts` extraction + craftable `stake`) + multi-worm v12→v13 (ctx.sandWorms array, 2 worms) + lizard procedural-character pipeline lift + rig polish (footstep audio from `rig.stepCount`) + procgen POI (orbital_pod_cluster + BRISTLE_ANTENNA). D126-D130. ACF builds directly on ACE's `ropeConstraint` helper + the deferred Cut #3.
- **ACD** (2026-05-26): sled physics polish — managed-scalar slope-slide (D122), KinematicPositionBased body + body-tilts-to-terrain (D123), pickup CCD anti-tunnel (D124), sled riding mechanic TABLED (D125, Rapier KCC has no moving-platform support; next-attempt ideas in backlog).

---

## Tier progress table

Dustfall opts out of the gamedev-framework v0.3.x tier-ladder structure.

| Era | Sessions | Status | What it proved |
|---|---|---|---|
| Tier 0 — Foundations | A–H | ✓ shipped | Browser runtime, Rapier, GameContext spine, procedural world |
| Tier 1 — Vertical slice | I–W | ✓ shipped | Inventory, crafting, interactions, opening scene, journal |
| Tier 2 — Target | X–CC | ✓ shipped | Audio architecture, atmosphere, speeder, animated title |
| Tier 3 — Expected | DD–PP | ✓ shipped | Sand worm boss, weapon variants, procgen POIs, biome rework |
| Tier 4 — Polish + breadth | QQ–ACD | ✓ ongoing | Plus ABP→ABY 10-session procedural-character pipeline + ACA-ACD sled-mechanic arc (visual + locker + throw items + physics polish; riding tabled) |

**Verify status**: `npm run verify` = `tsc --noEmit`. PASS.

---

## What works end-to-end (singleplayer flow)

The full Dustfall gameplay loop:

1. **Boot → title → new game / continue**. Procedural world seeded; opening scene wakeup; companion at side.
2. **Survival systems**: thirst / hunger / temperature / stamina / health with day-night curves, shelter system, weather (storm escalating over 7-day countdown).
3. **Exploration**: 2400m procedurally-seeded world, 6 flagship POIs + 22 procgen wrecks + biome-specific POIs (salt outpost, rocky entrance, dune buried cockpit) + themed clusters (military convoy, refugee caravan, comm-relay).
4. **Combat**: machete (melee), scrap_gun (ranged + magazine reload), energy_pistol (charged), pulse_rifle (auto-fire energy carbine, D172), pipe_staff (knockback). Hostile sandworm boss with bait-and-strike + ambush states (shelter-immune, D-ACAH). Hostile raiders, fleeing lizards + burrowing shrews. **Rare perched vulture** (D179/D181) — a fully-rigged salt-flat scavenger: idle on a branch, flies to another tree + re-perches when disturbed, shot out of the air for meat (dynamic-body death tumble). Companion creature follows.
5. **Salvage**: scrap_bar pry + per-component extract on wreck panels; condition tiers (corroded / standard / pristine).
6. **Crafting**: 4-slot combine-to-discover (no recipe grid), 15+ recipes, partial-match suggestions.
7. **Placement**: fire / tent / large_tent / bedroll / lantern / locker / sled kits; ghost-preview ring at place position.
8. **Mounts + tow**: hover speeder (CC), companion (AAE); both can tow a sled via rope (ACC B1 Phase 2 RopeEndpoint).
9. **Sled mechanic** (ACA-ACD): scrap-metal-sheet visual, attachable locker for mobile storage, kinematic-rider promotion for items resting on the deck, aimable throw arc to lob items onto the deck, items roll/fall via Rapier dynamic bodies (Tarkov-style settle). **ACD adds**: slope-slide downhill via managed scalars (sled actually slides on dunes), body tilts to terrain (deck conforms), no item-push drift, no rope tunneling through terrain.
10. **Player rig** (ABP-ABY): 10-session procedural-character pipeline. Lathe-based torso + tapered Lathe limbs, asymmetric scavenger clothing (hood + poncho + bandolier + pauldron + bandana + forearm wraps), foot IK, sub-pivot rigging (D118), cloth drape (D117), over-shoulder 3P camera (D116), dual-mesh held items (D113).
11. **Audio**: Web Audio procedural soundscape + 3 music tracks crossfaded by sun + perceived storm intensity.
12. **Save/load**: localStorage v14. Seed-stable across reloads. Additive-schema discipline (D81) preserves backwards compat (vultures persist by id+pos+state; flight/land are transient → re-derive to perched).
13. **Rope vocabulary** (ACC-ACF): generalized `RopeEndpoint` union + shared inextensible-rope constraint. Anchor kinds (player/speeder/companion/sled/static-pos/stake) + towed-body kinds (raider_corpse, sandworm_carcass). Drag a slain raider corpse on foot or behind a sled; tow a worm carcass behind the speeder. Sagged rope visual per tether.

**ACAI delta** (this session):
- The rare vulture is now a believable living creature: perches ON a real branch (idle neck-bob), and when the player closes within `VULTURE_SPOT_RADIUS` it launches, flaps, flies an arc to ANOTHER salt-flat tree, flares, and re-perches — staying alive + re-disturbable (no more flee-into-despawn).
- Shoot a vulture → it swaps to a Rapier dynamic body, tumbles to the dunes (CCD, real physics), settles, flops limp, and becomes a 'take' yielding `raw_vulture_meat` (cooks to food). DEV: `__game.killVulture(id)`.
- Dead trees now have trunk colliders (can't walk through), and the buried-cockpit POI is removed.
- **Caveat (rule 8)**: the static POSES (perched/flap/landing/dead) are screenshot-verified + the FSM cycle is eval-asserted, but the in-MOTION cadence (flap speed, flight arc, landing flare timing, tumble feel) is foreground-owed (D150 — the headless slow clock can't judge it). Tune in a playtest before calling it final.

---

## ACC-ACA condensed deltas

- **ACC** (2026-05-26, long overnight): throw-items-on-sled + ambient sandworm twilight breach + B1 Phase 2 RopeEndpoint refactor (D119-D121). ACC P1 top-deck collider; P2 kinematic-rider promotion; P3 save items-on-sled; Stretch aimable throw arc. B1 Phase 2: NEW rope.ts + playerPos.ts; sled tether is now `RopeEndpoint`; save additive.
- **ACB** (2026-05-26): locker-on-sled (mobile storage) + LMB-on-empty-ground UX for static-pos tether. Throw-items deferred to ACC.
- **ACA** (2026-05-26): sled visual rework (warped scrap metal sheet + welded yoke) + B1 Phase 2 lite (static-pos endpoint kind).

## ABZ-ABP condensed deltas (10-session procedural-character arc)

- **ABZ**: B1 Phase 1 (companion tether kind), SAVE_VERSION v12.
- **ABY**: walk-cycle to footstep cadence sync + limb R2 + per-item viewmodel 3P readability.
- **ABX**: player model texture pass (poncho dye stripes + skin weathering + pauldron rivets + leather bandolier) within D107 zero-asset.
- **ABW**: multi-angle audit + cape clipping fix.
- **ABV**: rig sub-pivots (wrists + ankles + spineBend + animation — D118) + hood D117 drape.
- **ABU**: cloth drape (D117) + body polish (deltoid bridges + neck cap + finger knuckles).
- **ABT**: over-shoulder camera (D116) + feet plant fix + head Lathe geometry.
- **ABS**: Lathe torso + tapered Lathe limbs + tapered cylinder fingers (D115).
- **ABR**: motion verification + 3P teleport snap callsites.
- **ABQ**: iterative polish under new framework discipline; D114 walk-cycle knee bug fix.
- **ABP** (long overnight): 3P + rig polish; primitive rig + 7 clothing layers; D111-D113.

## Older sessions (condensed — see changelog for detail)

- **ABO-ABK**: long-overnight bundles (procgen + ABM dropped-item physics + biome POIs + megaWreck rebuild + texture overhaul). D101-D110.
- **AAR-AAY**: salvage stack + visual overhaul. D93-D100.
- **AAA-AAQ**: polish + atmosphere arc.
- **QQ-ZZ**: control overhaul, RMB context verbs, larger tent, sled introduction.
- **DD-PP**: sandworm boss, weapon variants, procgen POIs, biome rework.
- **A-CC-4**: foundations + atmosphere + speeder + animated title.

---

## Known issues / partials

- **Player model — mid-rework (arc, `docs/feature-player-model.md`)**. Done: PM-A silhouette, PM-S SkinnedMesh foundation (arms+legs skinned), PM-B face (goggles + scarf), poncho cut + junction fillers. REMAINING: **PM-C layered outfit** — the torso is now STRIPPED (undercloth + belt + bandolier + pack + goggles only) since the poncho was cut; re-dress with tunic/wrap layers + fix shoulder bunching. PM-D cloth physics (real cloth layer). **PM-S.3** torso/neck-head skinning = the TRUE torso↔limb junction blend (currently filler-bridged via deltoid/hip-cap spheres — reads connected but isn't a real skin blend). PM-E texture. Glove contrast subtle at 3P; pack a plain box.
- **Vulture in-MOTION feel (ACAI, foreground-owed D150)** — the rig + anims + relocate-and-land FSM + death tumble are logic-verified + pose-screenshotted, but the flap cadence / flight arc / landing flare / tumble feel need a human playtest (headless slow clock can't judge motion). Tunables in `tuning.ts` VULTURE block.
- **Speeder bugs (ACG playtest, still open)** — E mounts the speeder without looking at the seat; 3P rig broken on the speeder (needs a seated stance). In backlog; fold into a PM cycle.
- **Foot-IK slope-snap + 3P camera real-playtest** — rig-debt; fold into a PM cycle.
- **ACF carcass tow blocked after harvest** — `lootSandWorm` untags the carcass, so towing works only before harvesting. Low severity. See backlog.
- **Sled riding mechanic tabled** (D125) — player can't ride the sled when it slides downhill or is towed. See backlog.md for tried approaches + next-attempt ideas.
- **Walk-cycle to footstep cadence sync** (ABR backlog, polish wrap-up remaining).
- **Per-item viewmodel readability at 3P distance** (ABR backlog).
- **3P camera collision real-playtest** still owed.
- **Foot IK mid-state transition** — idle→walking on slope shows brief reset to flat. Cosmetic.

See `docs/backlog.md` for full open list (riding mechanic entry at top with detailed tried-approaches + next-attempt directions).

---

## Constants worth tuning

**New from ACAI (`VULTURE_*` — all foreground-feel-owed, D150):**

| Constant | Default | Notes |
|---|---|---|
| `VULTURE_FLAP_HZ` / `FLAP_AMP` / `WING_EXTEND` | 3.2 / 0.55 / 0.35 | Wingbeat cadence + swing + spread in flight. The flap is the headline motion to tune. |
| `VULTURE_IDLE_BOB_HZ` / `IDLE_BOB_AMP` | 0.5 / 0.10 | Perched head-bob. |
| `VULTURE_CRUISE_HEIGHT` | 7.0 | m above the target perch the bird climbs to before descending. |
| `VULTURE_LAND_DESCENT` / `LAND_SPEED_FACTOR` / `LAND_ARRIVE_DIST` | 2.2 / 0.45 / 2.5 | Landing flare descent rate, final-approach speed fraction, arrival radius. |
| `VULTURE_RELOCATE_MIN_DIST` | 40 | A relocation target perch must be ≥ this from the current tree. |
| `VULTURE_FLEE_SPEED` / `CLIMB_RATE` / `SPOT_RADIUS` | 9.0 / 4.5 / 16 | Horizontal flight speed, launch climb, player-proximity trigger. |
| `VULTURE_DEATH_SPIN` | 7.0 | rad/s tumble kick on death. |
| `VULTURE_SETTLE_VEL` / `SETTLE_MAX_AGE` | 0.7 / 2.5 | Corpse settle: linear-velocity threshold + hard-cap age (heightfield jitter dodge — D181). |

New from ACF (`KILL_DRAG_*`):

| Constant | Default | Notes |
|---|---|---|
| `KILL_DRAG_RAIDER_MAX_DIST` | 3.2 | Leash length (m) for a dragged corpse — short so it trails close. |
| `KILL_DRAG_RAIDER_TEAR_DIST` | 7.0 | Rope slips off the corpse beyond this. |
| `KILL_DRAG_WORM_MAX_DIST` | 14.0 | Leash for a worm carcass towed behind the speeder (carcass is huge). |
| `KILL_DRAG_WORM_TEAR_DIST` | 26.0 | Speeder can yank hard; tear only on extreme overstretch. |
| `KILL_DRAG_SNAP_PERP_DAMP` | 0.6 | Perpendicular-swing damping at snap (both kinds). Higher = settles behind anchor faster. |
| `KILL_DRAG_GROUND_CLEARANCE` | 0.05 | Visual lift above terrain for the dragged body. |
| `KILL_DRAG_RAIDER_HY` / `KILL_DRAG_WORM_HY` | 0.25 / 1.5 | Body Y half-extents for the post-snap terrain clamp. |

From ACD (sled):

| Constant | Default | Notes |
|---|---|---|
| `SLED_SLOPE_SLIDE_GAIN` | 6.0 | Was 2.0. Raise for faster slide; ~3-4 is more conservative. |
| `SLED_KINETIC_FRICTION` | 0.15 | Coulomb friction coefficient. Higher = stickier slopes. Critical slope ≈ atan(K/GAIN) ≈ 1.4° at current. |
| `SLED_SLACK_DECAY_PER_FRAME` | 0.82 | When rope slack on flat ground, multiply `_slideVx/Vz` by this each frame. |
| `SLED_SNAP_PERP_DAMP` | 0.55 | Perpendicular damping at rope-snap event. |
| `SLED_GROUND_CLEARANCE` | 0.06 | Body Y lift above terrain to clear undulations. |

Existing tunables of interest:

| Constant | Default | Notes |
|---|---|---|
| `SLED_LINEAR_DAMP` | 1.8 | Now applies to managed-scalar slide velocity (not body.linvel). |
| `SLED_VISUAL_TILT_LERP` | 0.18 | Slerp rate for body rotation toward terrain normal. |
| `SLED_HALF_EXTENTS_Y` | 0.10 | Body Y half-extent. Affects deck height above terrain (= 2*Y + clearance). |
| `SLED_TOP_DECK_HALF_THICKNESS` | 0.015 | Top deck collider thickness. |
| `SLED_TOP_DECK_FRICTION` | 0.85 | Items + back wall sensor friction. Holds items on tilted decks up to 40°. |

---

## Suggested next session (1-3 directions in priority order)

1. **Mega-wreck rebuild from scratch + procgen-wreck/panel overhaul** (the user-chosen direction deferred through ACAH+ACAI). The hand-modeled mega-wreck reads too boxy; rebuild with references + the leveled-up modelling proved by the camelthorn tree (D176) + the vulture (D181), preserving colliders/panels/shelter/journal, then level up the procgen wreck fleet + panel placement. **Fold the WebGL perf wreck-instancing pass into this** (the wrecks now dominate draw calls — backlog §207 — and you're rebuilding that geometry anyway). Raider proc-character + all rig-dependent work stays DEFERRED (user undecided on an external rigged import).
2. **Foreground feel-tune playtest** (needs a human): the owed ACW/ACX in-motion pile (D150) + the NEW vulture in-motion feel (flap/flight-arc/landing/tumble — `VULTURE_FLAP_*`/`CRUISE_HEIGHT`/`LAND_*`/`DEATH_SPIN`) + the cloud-shadow strength (`CLOUD_SHADOW_SCALE`/`DARKEN`).
3. **Remaining smaller breadth**: WebGL perf pass (if not folded into #1), desktop packaging (Electron) + WebGPU exploration, procedural-repairable speeder bikes, ODST drop-pod opening cutscene, painted-metal rust gap — all in backlog.

---

## Time spent

100+ sessions shipped (A through ACAI). ACAI was a focused 6-tier vulture session (continued through a context compaction): rig (T1), anim driver (T2), branch-accurate perch (T3), relocate-and-land FSM (T4), dynamic-body death tumble (T5), dead-tree trunk collision (T6) — 4 commits (`9fb9dbf`→`d05eebf`, after T1+T2 at `ca277fb`), plus a pre-tier perf/cleanup pass (compileAsync boot, pickup geometry-merge, metal→uniforms, buried-cockpit removal). Touched `vulture.ts` (the bulk), `deadTree.ts`, `tuning.ts`, `debugPanel.ts`, `main.ts`, `rig-shot.mjs`. No save change.

---

## State at session end

- **Git status**: ACAI feature work committed in 4 tier commits (`9fb9dbf` T3+T6, `ef3f338` T5, `d05eebf` T4; T1+T2 at `ca277fb`) on `master`; the perf/cleanup pass committed earlier in the session; the session-end doc set committed + tagged `session-ACAI`.
- **Branch**: `master`. **Save state**: localStorage **v14** (unchanged — vulture flight/land/target fields are transient; dead persists via the existing additive `vultures[]`, D81 — no bump; tree colliders rebuild from seed).
- **Ports bound**: a `npm run dev` server may still be running on **5173/5174**; the rig-shot harness used **5191** (transient — Windows `dev.kill()` can orphan the vite child; kill leftover listeners on a strict-port conflict).
- **Verification status**: tsc clean throughout. Poses screenshot-iterated; logic verified via headless evals (`vulture-flight` PASS — full perched→flying→landing→perched cycle, target on another tree; `vulture-kill` PASS — tumble→settle→lootable, corpse rests on the dune; `tree` PASS — `trunkCol=1`; perched-on-branch regression PASS). **Owed (foreground)**: vulture in-motion cadence + ACW/ACX in-motion pile (D150) + cloud-shadow strength tune.

---

## Iteration-discipline self-check (rule 8)

ACAI is mostly LOGIC + RIG work, but it shipped visual surface (poses, perch seating, death corpse) — each was build → screenshot → critique → iterate, NOT shipped on `tsc` alone: the **perched-on-branch seating** (T3 — `vulture --angle=side`/`3q`, confirmed feet grip a real limb across seeds), the **flap pose** (`vulture-pose --state=flying` — wings read spread), the **death corpse** (T5 — iterated the `vulture-kill` framing through ~4 rounds: too-close→trunk-occluded→relocated to open ground → reads as a flopped bird at `bottomGap 0`), and the **flight FSM** was iterated until the eval went green (settle-on-linear-velocity discovery, slow-clock wait calibration). HONEST gap: the in-MOTION cadence (flap speed, flight arc, landing flare, tumble feel) is FEEL the headless slow clock can't judge (D150) — flagged foreground-owed, not faked. Static poses + logic hit the bar.

---

## Token spend this session (estimated)

Focused 6-tier session continued across a context compaction. Tool-heavy on the death-physics + flight-FSM verification loops (each rig-shot boots its own Vite+Playwright ~35s; the death-settle + flight evals needed several timing-calibration re-runs against the slow sim clock).

- Input: high — the compaction summary + repeated doc/source reads (`vulture.ts`, `deadTree.ts`, `save.ts`, `debugPanel.ts`, `rig-shot.mjs`) + image reads across the verification loops.
- Output: moderate-high — ~`vulture.ts` rewrite (rig + anim + FSM + death, ~180 net new lines), `deadTree.ts` perch/collider edits, 3 new rig-shot scenarios/extensions, 2 D-entries, the session-end doc set.
- Cost (Opus 4.8 rates): at/near the project baseline for a focused single-feature session — well under the ACAH big-overnight burn.

---

## Commit handoff

Per CLAUDE.md (session-end auto-runs commit + tag + push). The ACAI feature work is committed + pushed (4 tier commits + the perf/cleanup pass on `master`). The session-end doc edits (changelog/CLAUDE/roadmap/decisions/backlog/report/next-prompt) are committed at session-end + tagged `session-ACAI`.
