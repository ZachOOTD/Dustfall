# Dustfall — Session-end report

Cumulative state. Rewritten end-to-end at each `/session-end`.

**Current state**: Session ACH shipped (2026-05-31 — Phase 2 **Cycle 2: Rig to Rey-tier** + the headless self-verify tooling that unblocked it). 89 sessions post-MVP. tsc clean + self-verified via headless screenshots. **SAVE_VERSION still v13** (no schema changes). Phase 2 (9-cycle plan, `docs/iteration-plan.md`): Cycles 1+2 shipped. Next: finish the model with a skin/cloth TEXTURE pass + rig-debt, then the plan resumes at Cycle 3 (sled riding).

## ACH scope (this session) — Cycle 2: Rig to Rey-tier + self-verify tooling

The session's biggest outcome is a **headless self-verification loop**: `__game.enterGame(dev?)` (`debugPanel.ts` + `main.ts`) enters gameplay without the title button/pointer-lock so the rAF loop ticks + renders (the title handoff only clears `paused` via the pointer-lock event, which never fires for an agent click). Combined with `renderer.setSize` + `flags.thirdPerson` + posing `ctx.player.rig` joints, the agent can now edit → enter → pose → screenshot → critique → iterate with NO human in the loop (D134). This unblocks all future visual cycles.

On that loop, the rig was pushed to the Rey-Jakku bar (`playerRig.ts`, each element screenshot-iterated per rule 8): forearm wraps (2→7 tapered bands) + fingerless glove; unified headscarf (dark bandana + tan crown + drape → one folded scarf); cinched belt + hip pouches; scavenger backpack + lashed bedroll (mounted outside the poncho drape so it isn't occluded); cloth-wrapped boots. Also fixed a latent ABU bug — finger knuckle-bumps floated off the fingertips (wrong-sign forward vector + 3×-oversized offsets), fixed by parenting them to the finger axis. Glove contrast reads subtly at 3P + the backpack is a plain box — both flagged for the texture cycle. Deferred: skin/cloth texture pass (own material cycle), 3P-rig-on-speeder bug, foot-IK slope-snap.

## ACG scope (prior session) — Cycle 1: drag verification

Closes ACF's rule-8 visual-triage debt (ACF shipped the corpse/carcass drag functionally but never iterated the *feel* or ran the raider path). First session under the Phase 2 iteration plan.

- **DEV test affordances** (`src/debug/debugPanel.ts`): `__game.spawnRaider(x,z)` + `__game.killRaider(id)`. Raiders stay dormant by design (D13 / Pillar 1) — these only let the ACF corpse-drag path be exercised (0 raiders spawn normally). The kill hook drives the real death path (`damageRaider` → dead pose + corpse interaction tag).
- **Head-first drag orientation** (`src/world/killDrag.ts`): dragged raider corpse (`group.rotation.y`) + worm carcass (`yaw` + `mesh.rotation.y`) yaw to trail head-first toward the anchor. Dead-pose-safe (D133) — drives the entity's existing yaw channel, not a fresh transform.
- **Human playtest closed the cycle**: corpse drag (on-foot + sled), worm speeder-tow, orientation sign (no ±π flip), and in-progress-drag save round-trip all confirmed correct.
- **Process**: `--mode=overnight` requested but correctly fell back to gated (GDD §12 opt-out + no token budget + human-in-loop visual work). The headless preview couldn't drive the game loop (pointer-lock handoff gating — `dustfall_preview_gotchas`), so the aesthetic sign-off went to a human rather than being self-certified on tsc.

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

- **Player model — texture pass owed** (the model's GEOMETRY is Rey-tier as of ACH; surface richness is the gap the user wants next). Plus: glove contrast reads subtly at 3P; backpack is a plain box. See backlog Rey item.
- **Speeder bugs (from ACG playtest, still open)** — E mounts the speeder without looking at the seat; 3P rig broken on the speeder (needs a seated stance pose). Both in backlog; bundle with the next (texture/rig-debt) session.
- **Foot-IK slope-snap + 3P camera real-playtest** — rig-debt deferred from Cycle 2; bundle with next session.
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

Cycles 1+2 shipped (ACG, ACH). Next:

1. **Finish the player model — skin/cloth TEXTURE pass** (~1 session). TOP. The geometry is Rey-tier (ACH); this is the procedural-shader surface pass (skin weathering, cloth weave/dye) per D107 zero-asset — the user explicitly wants "more realistic skin and cloth textures." Bundle the cheap rig-debt: glove-contrast tone, backpack detail, **3P-rig-on-speeder seated stance + the E-mount bug** (both ACG playtest finds), foot-IK slope-snap, 3P-camera real-playtest. Use the `__game.enterGame` headless screenshot loop (D134). Completes the player-model arc.
2. **Cycle 3 — Ride the sled** (~1-2 sessions, architectural-risk). The D125-tabled riding mechanic; spike Option-C-parenting vs ride-peg in parallel branches. (Plan resumes here.)
3. **Cycle 4 — Real rope physics** (~1-2 sessions, architectural-risk). Verlet/segmented sim superseding D126, behind a `FEATURES.realRope` gate-and-wait. Precedes any new rope feature.

---

## Time spent

89 sessions shipped (A through ACH). Approx ~290-352h cumulative dev time. ACH was a substantial visual-iteration session: built the headless self-verify tooling, then 6 rig elements + a bug fix, each screenshot-iterated. (It rode the tail of one very long conversational session that also produced ACF + the Phase 2 plan + Cycle 1.)

---

## State at session end

- **Git status**: ACH code committed across 8 commits `12f2a36`..`7fd3076` (enterGame tooling + 6 rig elements + knuckle-bump fix). This session-end's docs updates uncommitted (commit handoff below).
- **Last commit before session-end**: `7fd3076` (boot wraps). All ACH code pushed to origin.
- **Last tag**: (Dustfall's git policy doesn't establish a session-tag convention; user may tag manually if desired).
- **Ports bound**: none (preview stopped).
- **Save state**: localStorage v13. ACH made zero save changes (pure rig geometry + dev tooling).

---

## Token spend this session (estimated)

ACH was the visual-iteration tail of a marathon conversation. The rig work itself was screenshot-heavy (each element: edit → enter → pose → shoot → critique → iterate).

- Output (ACH slice): substantial — 8 commits of rig geometry + the tooling + many screenshot-critique rounds + these docs.
- Cost (Opus 4.8 rates): above a normal session for the visual-iteration volume, justified — it both built the reusable self-verify tooling AND shipped 6 iterated rig elements.

Notable: the `enterGame` tooling (D134) is the high-leverage artifact — it makes every future visual cycle self-verifiable, paying back its cost immediately (it caught + verified the knuckle-bump fix this session).

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
