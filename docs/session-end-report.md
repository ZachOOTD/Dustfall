# Dustfall — Session-end report

Cumulative state. Rewritten end-to-end at each `/session-end`.

**Current state**: Session ACD shipped (2026-05-26 — sled physics polish + riding mechanic tabled). 85 sessions post-MVP. tsc clean. **SAVE_VERSION still v12** (ACD additive only — no schema changes). 10 files modified, no new modules.

## ACD scope (this session)

Long playtest follow-up session focused on iterating sled mechanics from user-reported gameplay bugs. Major physics rework lands; the player-rides-sled mechanic was attempted across 3+ architectures and tabled in backlog.md for a future session.

**Sled physics rework** (`src/world/sled.ts`):

- **Managed-scalar slope-slide (D122)**. Pre-ACD slope-slide used `setLinvel` to push the sled downhill each frame; with body friction 0.6 against the heightfield, Rapier's contact solver zeroed the tangential velocity each step (atan(0.6)≈31° static friction angle swallowed every dune). New design: `_slideVx/_slideVz` managed scalars driven by slope-gravity + Coulomb friction + linear damping, applied via direct `setNextKinematicTranslation` each frame. Bypasses Rapier's velocity-integration + contact-resolution path entirely. Sled actually slides now.

- **Body type → KinematicPositionBased (D123)**. Pre-ACD sled was Dynamic with Y-locked translation + all rotations locked. Dynamic items resting on the deck transferred lateral friction impulses to the body via Newton's 3rd law; impulses accumulated in body.linvel and the physics step integrated position BEFORE updateSleds re-set it, compounding into wild downhill drift with multiple items on the sled. Kinematic body type means dynamic items can't push it (one-way kinematic-vs-dynamic interaction); items still rest on the deck via friction with the kinematic body's implicit velocity (`(next - current) / dt`). Player KCC also can't push the sled now.

- **Body tilts to match terrain slope — "Option B" (D123)**. Pre-ACD the sled body was axis-aligned with Y sampled at the sled's center; on a slope, uphill terrain inside the sled's XZ footprint poked up ABOVE the sled's flat top deck — player walking onto the sled landed on terrain, not on the deck. Body now slerps its rotation toward terrain normal each frame via `setNextKinematicRotation`; the bottom face conforms to the terrain plane, top face uniformly above terrain across the footprint. Visual group rotation mirrors body directly (no separate slerp).

- **`SLED_GROUND_CLEARANCE = 0.06m`** — uniform Y lift above terrain. Handles small terrain undulations across the 2.2m×1.2m footprint so corners/yoke don't clip into sand.

- **Back wall collider → sensor**. The 12cm-thick back-wall lip was catching the player capsule when they jumped onto the sled — they perched on the wall instead of landing flat on the deck. Items still stay on the deck via top-deck friction (0.85).

- **`_frameDeltaX/Y/Z` tracking on Sled**. Per-frame XYZ motion delta computed at end of each updateSleds iteration. Currently unused (the consuming player-ride logic was scrapped) but preserved as foundation for future ride attempts. Zero runtime cost.

**Pickup tunneling fix (D124)** (`src/pickups/pickups.ts`): rope (and other flat-bbox items: cloth, bandage) dropped via G fell through terrain because the cuboid collider's bbox.y was small (~6.6cm) → collider half-height hit the 4cm `Math.max` floor → 8cm-thick collider + 60cm spawn height + downward throw velocity = per-frame travel exceeded collider thickness = discrete collision missed the heightfield. Enabled CCD on dynamic pickup bodies; Rapier's swept-shape test now catches any high-velocity crossing.

**Sled riding mechanic — TABLED (D125)** (`src/player/controller.ts`, `docs/backlog.md`): user goal was "stand on sled, sled moves, player rides with it". Attempted multiple architectures:
1. Manual platform-ride detection (raycast + AABB+Y fallback) + delta-add to KCC `desired` BEFORE compute — KCC's slope-projection ate ~20% of horizontal motion when standing on the tilted body.
2. Apply delta AFTER `computeColliderMovement` (bypass slope-projection) — drift dropped to ~10% but the player's Y still followed gravity instead of the sled's Y change; gap built until detection dropped.
3. Sticky ride state + full 3D delta (XYZ) + `_frameDeltaY` tracking — player still slid off after 5-10 frames.

Root cause: Rapier's KinematicCharacterController has no built-in moving-platform tracking. KCC's slope projection, autostep, and contact resolution interact with a tilted moving kinematic body in ways that no amount of detection + delta application could fully counter. Mechanic removed from controller.ts; data preserved on Sled for next-attempt foundation; backlog entry documents tried approaches + next-attempt ideas (full Option C parenting, or synthetic "ride peg" dynamic body mirroring the branch-on-sled trick the user discovered as an accidental working case).

**Tuning constants added/lifted**:
- `SLED_SLOPE_SLIDE_GAIN: 2.0 → 6.0` (user wanted faster slide)
- `SLED_KINETIC_FRICTION = 0.15` (NEW — Coulomb friction model)
- `SLED_SLACK_DECAY_PER_FRAME = 0.82` (NEW — lifted from inline magic)
- `SLED_SNAP_PERP_DAMP = 0.55` (NEW — lifted from inline magic)
- `SLED_GROUND_CLEARANCE = 0.06` (NEW)
- `SLED_ANGULAR_DAMP` REMOVED (unused after kinematic switch)

**D-entries**: D122 (managed-scalar slope-slide), D123 (kinematic body + body-tilts-to-terrain), D124 (pickup CCD), D125 (riding mechanic tabled with next-attempt directions).

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
12. **Save/load**: localStorage v12. Seed-stable across reloads. Additive-schema discipline (D81) preserves backwards compat.

**ACD delta** (this session):
- Sled now actually slides downhill on slopes (was inert pre-ACD).
- Sled body tilts to match terrain slope (geometric improvement).
- Rope no longer tunnels through terrain when dropped.
- Sled-as-a-platform: items rest stably on tilted deck; player CAN'T currently ride the sled (mechanic tabled — see D125 + backlog).

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

- **Sled riding mechanic tabled** (D125) — player can't ride the sled when it slides downhill or is towed. See backlog.md for tried approaches + next-attempt ideas. THIS IS THE TOP CANDIDATE FOR ACE.
- **Walk-cycle to footstep cadence sync** (ABR backlog, polish wrap-up remaining).
- **Per-item viewmodel readability at 3P distance** (ABR backlog).
- **3P camera collision real-playtest** still owed.
- **Foot IK mid-state transition** — idle→walking on slope shows brief reset to flat. Cosmetic.

See `docs/backlog.md` for full open list (riding mechanic entry at top with detailed tried-approaches + next-attempt directions).

---

## Constants worth tuning

New from ACD:

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

1. **ACE — Sled riding mechanic, second attempt** (~3-5h). Top priority. The user explicitly wants to come back to this. Take D125's next-attempt directions: full Option C parenting (override player setNext entirely while riding), OR synthetic "ride peg" dynamic body. The slope-slide and tilted body are now solid foundations.

2. **B1 Phase 3 generalised rope** (~4-6h). Lift the inextensible-rope constraint out of `updateSleds` into a shared system so NON-sled tethers work. Then add new endpoint kinds (raider_corpse, sandworm_carcass, world_anchor stake) + gameplay around each. Big-ticket follow-up to ACC's Phase 2 architectural lift.

3. **Visual-polish wrap-ups + 3P camera real-playtest** (~2-3h). Remaining polish items from the ABP-ABX arc.

Top pick: **ACE = sled riding, attempt 2.** User repeatedly asked for this; tabled with explicit "come back to it later" — best to deliver before context fades.

---

## Time spent

85 sessions shipped (A through ACD). Approx ~280-340h cumulative dev time. ACD itself was ~5-7h wall clock (long playtest follow-up session with extensive iteration).

---

## State at session end

- **Git status**: working tree dirty (this session-end's docs updates + 10 source/Tuning files from ACD changes). Through `8ed92ef` pushed to origin (ACC).
- **Last commit**: `8ed92ef` (ACC: throw items on sled + sandworm twilight breach + B1 Phase 2 rope refactor).
- **Last tag**: (Dustfall's git policy doesn't establish a session-tag convention; user may tag manually if desired).
- **Ports bound**: none (preview stopped).
- **Save state**: localStorage v12. ACD made zero save-schema changes (D81 additive discipline — no new fields needed).

---

## Token spend this session (estimated)

ACD was a long playtest-driven iteration session with many rounds of "user reports bug → diagnose → fix → user tests → next bug". Plus extensive analysis of the riding mechanic attempts.

- Input: ~250-350K tokens (heavy reads on sled.ts + controller.ts iterations + multi-round playtest feedback)
- Output: ~80-120K tokens (substantial code changes + multi-option discussions + extensive comments)
- Cached input: substantial (sled.ts + controller.ts reads repeated across iterations)
- Cost (Sonnet 4.5 rates): rough estimate $15-25 for ACD itself.

Above the project baseline (typical session: ~$5-10). Justifiable for the depth of physics rework + the architectural exploration of the riding mechanic, even though the riding feature didn't ship.

---

## Commit handoff

Print-hints mode. ACD ships:
- 1 backlog.md entry (sled riding tabled with next-attempt directions)
- ~700 LOC net change in sled.ts (slope-slide rewrite + Option B body tilt + kinematic body switch + various cleanups)
- ~155 LOC change in tuning.ts (new constants + comments + removals)
- ~50 LOC in controller.ts (riding attempts then removal)
- Smaller diffs in main.ts, pickups.ts, save.ts, interaction.ts, footprints.ts, metalMaterial.ts
- Docs updates: changelog ACD entry, CLAUDE.md Last shipped, roadmap.md Up next, decisions.md D122-D125, backlog.md, session-end-report.md (this file), next-session-prompt.md ACE brief.
