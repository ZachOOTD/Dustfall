# Dustfall — Session-end report

Cumulative state. Rewritten end-to-end at each `/session-end`.

**Current state**: Session ACM shipped (2026-06-01 — visual-triage of the ACL features, PARTIAL + a debug storm-hook fix). 94 sessions post-MVP. `npm run verify` (tsc) PASS. **SAVE_VERSION 14** (unchanged). ACM visually verified — via STATIC screenshots + runtime state inspection — the ACL visuals: night-sky stars, the sweeping storm wall, the desert-shrew MODEL, the amban-rifle viewmodel, and the aim-twist rig plumbing (all read correctly). It **fixed the stale debug `triggerStorm` hook** (set `weather.state` inline without arming the wall → 0 intensity; now delegates to `weather.triggerStorm`/`armWall`). **⚠ Live FEEL could NOT be verified** — shrew flee motion, the aim-twist sweep, and rifle fire/reload — because the headless preview tab is `document.visibilityState:"hidden"`, so the browser throttles rAF to zero and the **game tick is frozen** (the documented hidden-tab gotcha; **D146**). Those three are structurally sound but need a foreground `npm run dev` playtest or an extended Playwright harness. The player-model arc remains complete (ACK ceiling = believable stylized human). **Next session (ACN) = finish the live-feel triage in a TICKING environment**, then more breadth or a player-model follow-up.

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

1. **Finish the ACL live-feel triage in a TICKING environment** (TOP, Session ACN). ACM verified the STATIC layer (geometry/wiring/viewmodels) but the rAF-frozen headless preview blocked live behavior (D146). Drive — via a foreground `npm run dev` browser tab OR an extended Playwright `rig-shot` harness (its page is `visible` so rAF runs) — the shrew flee MOTION (SHREW_FLEE_SPEED/DURATION), the 3P aim-twist SWEEP (AIM_TWIST_BIAS/LERP), rifle FIRE/RELOAD through the ranged path, and the in-motion feel of star twinkle/drift + storm-wall sweep timing. Iterate the ACL `tuning.ts` constants (AIM/STAR/STORM/SHREW). **Do NOT use the preview MCP for this — it's hidden-tab throttled.**
2. **More backlog breadth** — another fanned-out overnight (the D143 file-ownership-lane + integrator pattern worked). Plenty remains (more procgen/POI/biome, creatures, audio, polish).
3. **Player-model follow-ups** (optional) — PM-D cloth physics; or the game **lighting mood** (D142, biggest in-game realism lever, whole-game aesthetic — surface first); or the D107 asset fork (photoreal, user's call).

---

## Time spent

94 sessions shipped (A through ACM). Approx ~300-369h cumulative human-facing dev time. ACM was a short verification + bug-fix session (visual-triage of ACL's output; ~1 code file touched). (Tail of the same very long conversation: ACJ skinned rig → ACK realism → ACL overnight breadth → ACM triage.)

---

## State at session end

- **Git status**: ACL committed + tagged + pushed at its session-end. ACM dirty: `src/debug/debugPanel.ts` (storm-hook fix) + `docs/` updates (changelog/CLAUDE/roadmap/decisions/backlog/this report/next-session-prompt) + untracked `docs/plans-archive/session-ACM-prompt.md`. Commit handoff below.
- **Branch**: `master`. **Save state**: localStorage **v14** (unchanged this session).
- **Ports bound**: a dev server lingers from the preview-MCP (5180); dev-only and currently hidden-tab throttled (D146).
- **Rule-8 status**: ACL's static visual layer now triaged clean (ACM); the live-FEEL remainder (shrew-flee / aim-twist-sweep / rifle-fire) is the ACN top item — blocked here by the hidden-tab rAF freeze, not by effort (D146).

---

## Token spend this session (estimated)

ACM was a light verification + single-bug-fix session on the main loop (no fan-out).

- Input: moderate (resumed a compacted session; read shrew/combat/items source + docs for session-end).
- Output: small — one code fix (`debugPanel.ts`, applied earlier) + the session-end doc updates.
- Cost (Opus 4.8 rates): well under the project baseline; nowhere near 2× — a normal tight session.

Notable: ACM's real finding was the **D146** verification ceiling — the headless preview MCP can't exercise per-frame behavior because the hidden tab freezes rAF. This is now canon so future sessions don't re-discover it; live-feel work routes to a foreground tab or the Playwright harness.

---

## Commit handoff

Per CLAUDE.md (session-end auto-runs commit + tag + push). ACM is a tight verification + fix session:
- Code: `src/debug/debugPanel.ts` (debug `triggerStorm` now delegates to `weather.triggerStorm`/`armWall`).
- Docs: changelog ACM, CLAUDE.md (Last shipped + ACN-next), roadmap (ACM shipped + ACN-next pointer), decisions **D146** (headless-preview rAF freeze blocks live-feel verification; debug-hooks-must-delegate corollary), backlog (visual-triage now 🟡 partial + live-feel remainder), this report, next-session-prompt ACN.
