# Dustfall — Session-end report

Cumulative state. Rewritten end-to-end at each `/session-end`.

**Current state**: Session ACI shipped (2026-05-31 — player-model re-plan + PM-Cycle A silhouette + PM-B.1 hood). 90 sessions post-MVP. tsc clean + self-verified via `rigStudio`. **SAVE_VERSION still v13**. The player model is mid-rework: an honest audit found the ACH "Rey-tier" result was a wrong silhouette (rigid barrel on stick-legs, blank face), so it's now a **5-cycle arc** (`docs/feature-player-model.md`): PM-A silhouette ✓, PM-B head/face/scarf (B.1 hood ✓; B.2 face next), PM-C outfit, PM-D cloth physics, PM-E texture. The broader Phase 2 plan (`docs/iteration-plan.md`) resumes at Cycle 3 (sled) after the model arc.

## ACI scope (this session) — player-model re-plan + PM-A + PM-B.1

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

- **Player model — mid-rework (5-cycle arc, `docs/feature-player-model.md`)**. ACI fixed the silhouette (PM-A) + hood (PM-B.1). REMAINING: PM-B.2 **blank ovoid face** (no features) + goggles, PM-B.3 face-wrap/neck, PM-C layered outfit (poncho still stiff panels + shoulder bunching + arms occluded), PM-D cloth physics, PM-E texture. Glove contrast subtle at 3P; backpack a plain box.
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

Player-model arc in progress (`docs/feature-player-model.md`). Next:

1. **PM-B.2 — face planes + goggles** (~1 session). TOP. The face is a blank ovoid; give the head lathe brow/nose/cheek/jaw definition so it reads as a face, + goggles on the forehead (Rey detail). Then PM-B.3 (face-wrap covers nose/mouth + connects to the scarf, neck covered). Use `rigStudio('head')` (D134/D135) + the Model Verification Protocol, 5–8 rounds. Honor rule 8 — faces are unforgiving; iterate honestly.
2. **PM-C — layered outfit** (~1-2 sessions). Tunic layers, visible gloved arms (now that the torso is slim), legible belt/pouches, integrated backpack, fix the shoulder bunching.
3. **PM-D — cloth physics** then **PM-E — texture**. (Then the Phase 2 plan resumes at Cycle 3 — sled riding.)

---

## Time spent

90 sessions shipped (A through ACI). Approx ~292-355h cumulative dev time. ACI: an audit-driven re-plan + the `rigStudio` verification tool + PM-Cycle A (silhouette) + PM-B.1 (hood), screenshot-iterated. (Tail of one extraordinarily long conversation spanning the framework smoke-test → ACF → the Phase 2 plan → Cycles 1-2 → the audit → this re-plan → PM-A/B.1.)

---

## State at session end

- **Git status**: ACI code committed across the PM commits `ea1b85c` (rigStudio) → `54d8b18` (silhouette R1) → `591ae8c` (silhouette R2 + head) → `9263523` (hood + rigStudio fix); re-plan docs `6ec442a`. This session-end's docs updates uncommitted (commit handoff below).
- **Last commit before session-end**: `9263523`. All ACI code pushed to origin.
- **Last tag**: (Dustfall's git policy doesn't establish a session-tag convention; user may tag manually if desired).
- **Ports bound**: none (preview stopped).
- **Save state**: localStorage v13. ACI made zero save changes (pure rig geometry + dev tooling).

---

## Token spend this session (estimated)

ACI was a visual-iteration session on the tail of a marathon conversation: audit → re-plan → rigStudio tool → PM-A + PM-B.1, each element `rigStudio`-screenshot-iterated.

- Output (ACI slice): substantial — the re-plan doc + rigStudio + ~5 silhouette/head iteration commits + many screenshot-critique rounds + these docs.
- Cost (Opus 4.8 rates): above a normal session for the visual-iteration + planning volume.

Notable: the honest **audit → re-plan** was the key move — it caught the ACH "Rey-tier" over-claim and reset the model work onto a verifiable multi-cycle footing with `rigStudio` (D134/D135) as the engine. Quality-over-speed correction.

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
