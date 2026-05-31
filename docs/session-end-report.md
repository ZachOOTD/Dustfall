# Dustfall — Session-end report

Cumulative state. Rewritten end-to-end at each `/session-end`.

**Current state**: Session ACG shipped (2026-05-31 — Phase 2 **Cycle 1: drag verification**). 88 sessions post-MVP. tsc clean + human-playtest verified. **SAVE_VERSION still v13** (no schema changes). Post-MVP work is now sequenced by the 9-cycle Phase 2 iteration plan (`docs/iteration-plan.md`); Cycle 1 is the first shipped, Cycle 2 (Rig to Rey-tier) is next.

## ACG scope (this session) — Cycle 1: drag verification

Closes ACF's rule-8 visual-triage debt (ACF shipped the corpse/carcass drag functionally but never iterated the *feel* or ran the raider path). First session under the Phase 2 iteration plan.

- **DEV test affordances** (`src/debug/debugPanel.ts`): `__game.spawnRaider(x,z)` + `__game.killRaider(id)`. Raiders stay dormant by design (D13 / Pillar 1) — these only let the ACF corpse-drag path be exercised (0 raiders spawn normally). The kill hook drives the real death path (`damageRaider` → dead pose + corpse interaction tag).
- **Head-first drag orientation** (`src/world/killDrag.ts`): dragged raider corpse (`group.rotation.y`) + worm carcass (`yaw` + `mesh.rotation.y`) yaw to trail head-first toward the anchor. Dead-pose-safe (D133) — drives the entity's existing yaw channel, not a fresh transform.
- **Human playtest closed the cycle**: corpse drag (on-foot + sled), worm speeder-tow, orientation sign (no ±π flip), and in-progress-drag save round-trip all confirmed correct.
- **Process**: `--mode=overnight` requested but correctly fell back to gated (GDD §12 opt-out + no token budget + human-in-loop visual work). The headless preview couldn't drive the game loop (pointer-lock handoff gating — `dustfall_preview_gotchas`), so the aesthetic sign-off went to a human rather than being self-certified on tsc.

## ACF scope (prior session)

Closes ACE's deferred **Cut #3** — the `raider_corpse` + `sandworm_carcass` rope endpoint kinds. The interesting architectural call is that these are the first *towed-body* endpoint kinds (the rope drags them) rather than anchors.

**Towed-body rope-drag** (`src/world/rope.ts`, NEW `src/world/killDrag.ts`, `main.ts`):
- `RopeEndpoint` union gains `raider_corpse` (raiderId) + `sandworm_carcass` (wormId); `resolveEndpointWorldPos` resolves both (raider via `ctx.raiders[]`, worm via `ctx.sandWorms.list`, null→auto-detach if gone).
- Drag state lives on the entity as `dragAnchor: RopeEndpoint` (the ANCHOR end), NOT on `sled.tether` — because the kill is towed *toward* the anchor, the opposite role from every prior endpoint kind (D131).
- NEW `updateKillDrag` is the first non-sled caller of ACE's `applyInextensibleConstraint`. Runs after `updateRaiders`/`updateSandWorm` (both `continue` past dead entities → drag-movement is free to own) and before `updateSledRiders`. Syncs each kill's visual to the post-snap XZ. Draws a sagged rope tube per dragged kill (keyed by entity id, disposed on detach).

**Interaction** (`src/player/interaction.ts`): new `raiders` registry; `applyRaiderDeadPose` tags the corpse (`attach_rope`). Rope-wielded LMB-on-corpse ties to a player-tethered sled (trails it) or to the player (drag on foot); LMB again drops it. The `sandWorms` case gains a rope+mounted LMB-on-carcass → tow / cut-loose branch (speeder-only — D132).

**Save** (`src/persistence/save.ts`): additive, no version bump (D81). Serialized sled-tether union + payloads extended; `raider.dragAnchor` + `worm.dragAnchor` round-trip so an in-progress drag survives reload.

**Tuning**: `KILL_DRAG_*` block (per-kind max/tear distance, body half-extents, shared snap-perp-damp + ground clearance).

**Verification**: worm path runtime-verified in the live game via forced state (rope mesh spawns with correct geom/color; constraint snaps a 20m-yanked carcass back to the 14m leash; rope disposed on detach; no runtime errors). **NOT verified**: (1) aesthetic drag-feel/rope-sag from gameplay POV (pointer-lock gating + opening-wreck spawn occlusion block automated framing — `dustfall_preview_gotchas`); (2) raider corpse path at runtime (0 raiders spawn by default; no spawn hook) — code is tsc-clean + structurally identical to the verified worm path.

**Iteration-discipline self-check (rule 8)**: the rope-mesh visual + corpse drag shipped with FUNCTIONAL verification only, NOT the build→screenshot→critique→iterate aesthetic loop. Drag-feel quality is unproven; a follow-up visual-triage is owed (see backlog + ACG brief).

**D-entries**: D131 (towed-body kinds + entity-owned dragAnchor + killDrag system), D132 (worm carcass speeder-tow-only + tow-before-harvest edge).

## ACE + ACD condensed

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

- **ACF carcass tow blocked after harvest** — `lootSandWorm` untags the carcass, so towing works only before harvesting. Low severity. See backlog. (NOTE: ACF's drag visual-triage debt was CLOSED in ACG/Cycle 1.)
- **Speeder bugs (from ACG playtest)** — E mounts the speeder without looking at the seat; 3P rig broken on the speeder (needs a seated stance). Both in backlog; the 3P one folds into Cycle 2.
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

Sequenced by the Phase 2 iteration plan (`docs/iteration-plan.md`). Cycle 1 shipped (ACG); next is:

1. **Cycle 2 — Rig to Rey-tier** (~1-2 sessions). TOP. Push the ABP→ABY rig to the explicit Rey-Jakku bar (band-spaced wraps, unified headscarf, tunic/belt/pouches, backpack) + clear residual rig debt (3P camera real-playtest, foot-IK transition). Highest-leverage cycle: it's the gate for Cycle 5 (raider proc-character), Cycle 7 (companion), and Cycle 9 (sleep anims). The ACG-found 3P-rig-on-speeder bug folds in here. **Heavy visual-iteration cycle — honor rule 8 (1-2 fully-iterated elements/session, not 5 shallow).**

2. **Cycle 3 — Ride the sled** (~1-2 sessions, architectural-risk). The D125-tabled riding mechanic; spike Option-C-parenting vs ride-peg in parallel branches.

3. **Cycle 4 — Real rope physics** (~1-2 sessions, architectural-risk). Verlet/segmented sim superseding D126, behind a `FEATURES.realRope` gate-and-wait. Precedes any new rope feature.

Optionally interleave the two ACG-found speeder bugs (E-mount; 3P-on-speeder) as a quick pass — both small, don't need the rig work (the E-mount one is fully standalone).

---

## Time spent

88 sessions shipped (A through ACG). Approx ~287-348h cumulative dev time. ACG was a small cycle (~1-2h equiv): the autonomous code slice (2 dev hooks + orientation) plus a human playtest to close the rule-8 gap.

---

## State at session end

- **Git status**: ACG code committed `8a72e12` (debugPanel hooks + killDrag orientation + archived ACG brief); backlog batch `9020dff`. This session-end's docs updates uncommitted (commit handoff below).
- **Last commit before session-end**: `9020dff` (backlog: 7 playtest finds). Tip of the ACF→ACG chain: `eb011a3` (decisions split) → `6d6775c` (iteration plan) → `8a72e12` (ACG code) → `9020dff` (backlog). All pushed to origin.
- **Last tag**: (Dustfall's git policy doesn't establish a session-tag convention; user may tag manually if desired).
- **Ports bound**: none (preview stopped).
- **Save state**: localStorage v13. ACG made zero save changes (the `dragAnchor` fields landed in ACF).

---

## Token spend this session (estimated)

ACG was a long *conversational* session (framework smoke-test → ACF feature → backlog triage burst → iteration-plan → Cycle 1) rather than a single focused build. Cycle 1 itself was cheap; the surrounding planning + triage dominated.

- Output (Cycle 1 slice only): ~15-25K tokens (2 dev hooks + orientation + the docs).
- The broader session (ACF + planning + ~17 backlog triages + iteration plan) was the bulk — see those commits.
- Cost (Opus 4.8 rates): within baseline for the Cycle 1 portion.

At/near baseline. Notable: this run doubled as a framework efficiency test — findings logged to backlog (`[debt] gamedev-framework feedback from ACF smoke-test`).

---

## Commit handoff

Print-hints mode. ACF ships:
- NEW `src/world/killDrag.ts` (~210 LOC) — kind-agnostic kill-drag system + self-contained rope visual.
- `src/world/rope.ts` — 2 towed-body endpoint kinds + resolver cases.
- `src/player/interaction.ts` — `raiders` registry + corpse case + worm speeder-tow branch.
- `src/persistence/save.ts` — additive tether-union extension + `dragAnchor` round-trip on raider + worm.
- `src/enemies/raider.ts` + `src/enemies/sandWorm.ts` — `dragAnchor` field; raider corpse interaction tag on death.
- `src/config/tuning.ts` — `KILL_DRAG_*` block.
- `src/main.ts` — `updateKillDrag` hooked into the tick.
- Docs: changelog ACF entry, CLAUDE.md Last shipped, roadmap.md Up next (ACG), decisions.md D131-D132, backlog.md (3 new items), session-end-report.md (this file), next-session-prompt.md ACG brief, docs/plans-archive/session-ACF-prompt.md.
