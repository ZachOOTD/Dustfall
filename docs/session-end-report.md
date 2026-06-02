# Dustfall — Session-end report

Cumulative state. Rewritten end-to-end at each `/session-end`.

**Current state**: Session ACT shipped (2026-06-01 — 3P/FP parity fixes + world-space texture-swim sweep). 100+ sessions post-MVP. `npm run verify` (tsc) PASS. **SAVE_VERSION 14** (unchanged). ACT folded in live-playtest findings: (1) footprints + footstep audio were dead in first person — `updatePlayerRig` early-returned on the 3P visibility gate before advancing `rig.stepCount` (which `controller.ts` drives footsteps + decals off); hoisted the gait bookkeeping above the gate (D151). (2) Interact hints never appeared in 3P — the `far=2.5` interaction ray cast from `cam.position`, ~1.8m behind the player → ~0.7m reach; now originates from the player eye along camera-forward (D152). (3) D109 texture-swim sweep across all moving entities — added `localSpace` to woodGrain/bone/glass factories, decoupled fabric `localSpace` from `disableShimmer`, routed all viewmodel item materials through `vm*` local-space wrappers, fixed speeder antenna + rig metal/paint (D153). Geometric/material — no save change; footprints/hints owed a foreground confirm (D150-class). **Next session (ACU) = the still-open foreground item (random speed spike #40), then the feature-sized backlog (sled-POI collision #42, rope-leaves-inventory #50) — plus the queued ACT art/animation idea wave.**

## ACT scope (this session) — 3P/FP parity fixes + world-space texture-swim sweep

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
4. **Combat**: machete (melee), scrap_gun (ranged + magazine reload), energy_pistol (charged), pipe_staff (knockback). Hostile sandworm boss with bait-and-strike + ambush states. Hostile raiders, fleeing lizards. Companion creature follows.
5. **Salvage**: scrap_bar pry + per-component extract on wreck panels; condition tiers (corroded / standard / pristine).
6. **Crafting**: 4-slot combine-to-discover (no recipe grid), 15+ recipes, partial-match suggestions.
7. **Placement**: fire / tent / large_tent / bedroll / lantern / locker / sled kits; ghost-preview ring at place position.
8. **Mounts + tow**: hover speeder (CC), companion (AAE); both can tow a sled via rope (ACC B1 Phase 2 RopeEndpoint).
9. **Sled mechanic** (ACA-ACD): scrap-metal-sheet visual, attachable locker for mobile storage, kinematic-rider promotion for items resting on the deck, aimable throw arc to lob items onto the deck, items roll/fall via Rapier dynamic bodies (Tarkov-style settle). **ACD adds**: slope-slide downhill via managed scalars (sled actually slides on dunes), body tilts to terrain (deck conforms), no item-push drift, no rope tunneling through terrain.
10. **Player rig** (ABP-ABY): 10-session procedural-character pipeline. Lathe-based torso + tapered Lathe limbs, asymmetric scavenger clothing (hood + poncho + bandolier + pauldron + bandana + forearm wraps), foot IK, sub-pivot rigging (D118), cloth drape (D117), over-shoulder 3P camera (D116), dual-mesh held items (D113).
11. **Audio**: Web Audio procedural soundscape + 3 music tracks crossfaded by sun + perceived storm intensity.
12. **Save/load**: localStorage v13. Seed-stable across reloads. Additive-schema discipline (D81) preserves backwards compat.
13. **Rope vocabulary** (ACC-ACF): generalized `RopeEndpoint` union + shared inextensible-rope constraint. Anchor kinds (player/speeder/companion/sled/static-pos/stake) + towed-body kinds (raider_corpse, sandworm_carcass). Drag a slain raider corpse on foot or behind a sled; tow a worm carcass behind the speeder. Sagged rope visual per tether.

**ACF delta** (this session):
- Kill a raider → wield rope → LMB-on-corpse → drag it on foot, or tie it to a player-tethered sled so it trails along.
- Slay a worm → mount the speeder → wield rope → LMB-on-carcass → tow the 24m carcass behind the bike (speeder-only — too heavy on foot).
- Sagged rope tube renders between anchor and dragged kill; in-progress drags persist across save/load (no version bump).
- **Caveat**: drag-feel/sag aesthetic NOT visually iterated (rule 8); raider path tsc-clean but not runtime-exercised (no raider spawns by default). Worm path runtime-verified.

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

1. **Foreground confirm the ACT fixes + chase the random speed spike** (TOP, Session ACU). The FP-footprints/audio + 3P-interact-hint fixes are tsc-clean + logic-traced but owed a real-rate confirm (D150-class): in `npm run dev`, walk in FP (prints + footstep SFX appear) and in 3P walk up to interactables (hints appear at normal range). Then localize the **random speed spike** (#40) — play on-foot vs on-bike, suspect the dynamic speeder body (collision-penetration velocity / dismount state-leak).
2. **The feature-sized backlog** — sled-vs-POI collision (#42, kinematic-vs-static shapecast) + rope-leaves-inventory-while-deployed (#50, save-touching state-model change).
3. **The ACT art/animation idea wave** (big, multi-session) — higher-detail item models + correct 3P hand placement + 3P use-animations; lizard/shrew walk gait + shrew burrow; speeder dust trail + engine ignition FX; seated 3P speeder rig + camera; dynamic salvage-panel placement on procgen POIs (clip-safe surface-finding). Plus the standing optional levers: game **lighting mood** (D142) + PM-D cloth-physics robe.

---

## Time spent

100+ sessions shipped (A through ACT). Approx ~305-378h cumulative human-facing dev time. ACT was a playtest-driven bug-fix session: 2 parity fixes (FP gait gate, 3P interaction reach) + a project-wide world-space-swim audit across 6 material factories + every moving entity (9 files, no save change). (Tail of the same very long conversation: ACJ→…→ACS→ACT.)

---

## State at session end

- **Git status**: ACT code already committed + pushed mid-session (`2899847`, `master`) — the FP/3P fixes + swim sweep + backlog triage. The session-end doc edits (changelog/CLAUDE/roadmap/decisions/backlog/report/next-prompt) are dirty; commit handoff below. No session tag yet (ACS was the last tag).
- **Branch**: `master`. **Save state**: localStorage **v14** (unchanged — ACT is logic/material only).
- **Ports bound**: dev servers may linger from the preview-MCP (5180) / rig-shot harness (5191); both dev-only.
- **Rule-8 / verification status**: ACT is material/geometry + logic (no new rig/camera/animation surface to screenshot-iterate). The two parity fixes are tsc-clean + root-cause-traced; owed a foreground confirm (D150-class for the gait one — kinematic `linvel` reads 0 headlessly). The swim sweep is verifiable foreground (drive speeder, walk 3P, equip held items).

---

## Token spend this session (estimated)

ACT was a foreground-playtest-driven bug-fix session (no fan-out; reads across the material factories + viewModel/interaction/playerRig).

- Input: moderate-high (6 material factories + items.ts + playerRig/interaction/controller/viewModel reads + the D109 audit + docs).
- Output: moderate — 2 logic fixes + 4 factory edits + items wrapper refactor + the session-end docs.
- Cost (Opus 4.8 rates): around baseline. Not flagged.

Notable: the user's "footprints only in 3P" report turned out to share a root with the older ACN "dismount kills footprints" bug (the FP visibility-gate, D151), and the "texture swims on the speeder" report generalized into a full D109 sweep that found held viewmodel items (wood/bone/glass/metal) were the largest un-localSpace'd swim surface.

---

## Commit handoff

Per CLAUDE.md (session-end auto-runs commit + tag + push). ACS is a single bug-fix session:
- Code: `sandWorm.ts` (`lootSandWorm` keeps the tag while towed), `interaction.ts` (towed branch carves on E + cuts loose on LMB; target-push includes looted-but-towed carcasses; shared `harvestWorm` helper).
- Docs: changelog ACS, CLAUDE.md (Last shipped + ACT-next), roadmap (ACS shipped), backlog (ACF carcass-tow → FIXED), this report, next-session-prompt. No new D-entry (a bounded interaction-logic bug fix; no novel decision).
