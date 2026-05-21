# Dustfall — Session-end report

Cumulative state. Rewritten end-to-end at each `/session-end`. A
reviewer who's never seen the project should be able to read this +
`CLAUDE.md` + `docs/GDD.md` and understand where Dustfall is.

**Current state**: Session AAK shipped (2026-05-21). 38 sessions
post-MVP. tsc clean. SAVE_VERSION v9 (unchanged).
Post-overnight: UU/VV/UU-2/WW/XX/YY/ZZ + AAA (polish) + AAB (world
depth) + AAC (craftable home) + AAD (kit playtest polish) + AAE
(creature companion + v9) + AAF (7-day storm countdown) + AAG
(atmospheric polish + inventory swap-on-full) + AAH (playtest
polish for AAG) + AAI (procedural world generation). Working tree
dirty pending the user's commit.

---

## Tier progress table

Dustfall opts out of the gamedev-framework v0.3.x tier-ladder structure
(see `docs/roadmap.md` framework note). The project is post-MVP and
operates on a per-session "Big-ticket bucket + Polish" model.
Retroactive tier mapping for orientation only:

| Era | Sessions | Status | What it proved |
|---|---|---|---|
| Tier 0 — Foundations | A–H | ✓ shipped | Browser runtime, Rapier, GameContext spine, procedural world |
| Tier 1 — Vertical slice | I–W | ✓ shipped | Inventory, crafting, interactions, opening scene, journal |
| Tier 2 — Target | X–CC | ✓ shipped | Audio architecture, atmosphere, speeder, animated title |
| Tier 3 — Expected | DD–PP | ✓ shipped | Sand worm boss, weapon variants, procgen POIs, biome rework |
| Tier 4 — Stretch / polish | QQ–XX | ✓ in progress | Sled, sandworm rescale, opening wreck redo, crafting rework, control scheme overhaul, hygiene/crosshair, RMB context verbs, HUD micro-polish, larger enterable tent + save v7 |

**Verify status**: `npm run verify` = `tsc --noEmit`. Single check
(no tier breakdown). Currently PASS.

---

## What works end-to-end (singleplayer flow)

Fresh-game start (the de-facto Tier 1 — Session W shipped):

1. **Boot title**: animated 3D title scene (Session CC-3) with a pod
   shooting-star + landing on a hero dune. NEW GAME / CONTINUE
   buttons.
2. **Opening cinematic**: player spawns ~4.5m in front of the
   redesigned opening wreck (Session RR + SS DoubleSide fix). Tapered
   cockpit + tail-stub silhouette, 30° stress-fracture skylight
   running the upper hull. Inside: skeleton + journal at cockpit
   front, tally marks on the curved interior wall, ash pile + branch
   stubs + empty canteen.
3. **First interactions**: pickup LMB (UU), journal E, salvage panel E.
4. **Speeder**: parked ~12m from the wreck entrance. Mountable via E
   (Session CC-2). Has a `speederTowBar` mesh for rope attachment
   (Session QQ-2).
5. **Survival loop**: thirst/heat/hunger/stamina/health all decaying.
   Canteen drinks **hold-LMB continuously** (UU) — one gulp per
   0.7s of hold. Wells in salt-flats refill the canteen via E (D45).
   Fire + tent placement via **LMB-click** (UU) — 2.2m forward
   ghost would help here (deferred, see backlog). Sleep skips
   dayTime + cools temperature.
6. **Combat**: 5 weapons (Session PP — machete, pipe_staff, scrap_gun,
   energy_pistol, plus scrap_bullet ammo). LMB swings/fires; combat
   is now invoked FROM `wieldAction.ts` (UU) when the equipped item's
   `wieldLmb === 'attack'`. Lizards 1-shot from any weapon. Sand worm
   boss (Session DD + MM rescale + QQ-2 halving) takes 12 hits;
   sensor collider (D48); 120m body / 10m radius.
7. **Sled mechanic** (Session QQ + QQ-2): craft rope + sled_kit
   (now via the combine-to-discover UI, D70). Wield rope, click
   sled rope-stub to tie — wieldAction.ts marks rope as `wieldLmb:
   'none'` so this code path stays in `interaction.ts` (it needs
   hover-state to dispatch). Inextensible rope constraint (D67) —
   slack = no force, taut = position-snap + velocity project.
   Locked rotation + manual yaw. Bidirectional cargo via the loot
   menu's `allowDeposit` mode.
8. **Crafting** (Session TT rework): open the menu (C). 4 input
   slots — click bag rows to add items, click input slots to remove.
   Output preview shows `?` for unknown-valid combinations, the
   actual output icon for discovered ones, "nothing happens" for
   invalid. CRAFT button is a DOM-LMB (overlay-gated by UU's
   wieldAction so it doesn't double-fire any in-world action).
9. **Save / load**: single-slot localStorage (`dustfall.save.v1`),
   `SAVE_VERSION = 6`. Death does not auto-save (D10). Continue
   restores player + speeder pose, journal state, sled tethers +
   cargo, salvage progress, harvested cacti, dead lizards, sand worm
   state, AND `inventory.discoveredRecipes`. New in UU:
   `slot.meta.holdProgress` is STRIPPED on serialize so a save
   captured mid-drink doesn't resume drinking on reload.

---

## What's freshly shipped (Session AAK deltas)

AAI multi-seed playtest pass. Built a snapshot harness (boots N seeds
sequentially via pendingSeed + reload, captures per-seed flagship
positions / distances / roughness). Ran 5 fixed seeds. Three classes
of issue surfaced + fixed.

- **Flagship-specific scatter band** — new `FLAGSHIP_SCATTER_RADIUS_MIN/MAX`
  Tuning constants (200m / 800m). Procgen wrecks keep their wider
  120-1100m band; flagships now stay discoverable in normal exploration.
- **Larger flagship spawn-exclusion** — new `FLAGSHIP_SPAWN_EXCLUSION_RADIUS = 200`
  (vs `PLAYER_SPAWN_EXCLUSION_RADIUS = 80` for procgen wrecks). Big
  hero-tier landmarks (mega_ship at 60m, mega_wreck at 120m) no longer
  dominate the opening cinematic.
- **Terrain-roughness gate** — new `FLAGSHIP_MAX_ROUGHNESS = 0.7` +
  `localRoughness(terrain, x, z)` helper. Samples a 5m patch around
  each candidate; rejects positions on steep dune slopes that the
  per-spawn flat-spot drift can't fully compensate for.
- **`sampleFlagshipPositions` signature** changed `(rand)` → `(rand, terrain)`.
  Call site in `placePOIs` updated.

Verification ran the same 5-seed harness post-fix. Max distance dropped
1077m → 786m, min distance from spawn 108m → 307m, max roughness 1.27 →
0.68. No save schema change. 2 files touched (tuning.ts + poi.ts).

## What's freshly shipped (Session AAJ deltas)

Opening wreck bugfix pass. Four fixes flagged from a playtest screenshot.
No new modules, no schema bump, no D-entries (small visual + collider
adjustments to an existing system).

- **AAB godray cone removed** (`src/world/openingWreck.ts`). Read as
  theatrical/unrealistic; natural skylight-gap lighting is sufficient.
  `updateOpeningWreckGodRay` stubbed to no-op preserving the main.ts
  import. 6 OPENING_WRECK_GODRAY_* Tuning constants retained as
  commented baseline.
- **Entrance enterable** — `R_TAIL_RIM 1.4 → 1.6m`,
  `R_TAIL_BODY 1.5 → 1.65m`; entrance fragments reduced 4 → 2 with
  smaller dims; floor collider half-Z bumped to reach the rim
  (eliminates the 0.2m terrain gap pre-AAJ).
- **Hull thickness** — outer materials switched DoubleSide →
  FrontSide; new `_hullInteriorMat` (BackSide, darker tone); inner
  shell built as a second set of LatheGeometry slices at radii
  reduced by `HULL_WALL_THICKNESS = 0.04`; new entrance rim torus
  closes the cross-section gap. 2 new Tuning constants.
- **Tally marks repositioned** to LEFT cockpit interior side wall
  with per-cluster X computed from local profile radius (pre-AAJ
  they floated centered at z=2.85 where hull radius was only ~0.45m).

## What's freshly shipped (Session AAI deltas)

Procedural world generation (standard 2400m world). Per-seed worlds
within the existing 3×3 chunk grid; no schema bump. 4 decisions logged
(D82-D85).

- **`ctx.seed` + boot seed-derivation** (`src/main.ts`). New
  `resolveSeed()` reads localStorage pendingSeed → save seed → inline-
  roll. New `peekSavedSeed()` in save.ts reads the seed field without
  doing a full load (so the procgen world can be built at boot from
  the saved seed, not after Continue patches state). `saveGameState`
  now writes `ctx.seed` instead of `Tuning.RNG_SEED`.
- **Flagship POI rejection sampler** (`src/world/poi.ts`, D82). 6
  flagship coords were hardcoded; now they go through
  `sampleFlagshipPositions(rand)` with the same min-separation (250m)
  + Poisson-disk character as the procgen wreck sampler. Player-spawn
  exclusion (80m around `-50, 0`) keeps the opening cinematic clear.
- **`procgenPoi.ts` extended** with the same spawn-exclusion check
  (per-candidate rejection if within 80m of `OPENING_SCENE_ANCHOR_X/Z`).
- **Opening scene seed-stable** (D83). New Tuning
  `OPENING_SCENE_ANCHOR_X/Z = -50, 0` + `PLAYER_SPAWN_EXCLUSION_RADIUS = 80`.
  Player spawn, opening wreck, companion pod, speeder all preserved
  across seeds. Existing `findFlattestSpot` drift (16m) untouched.
- **Title Advanced seed entry** (`src/ui/titleOverlay.ts`, D84).
  Collapsed disclosure under NEW GAME with a uint32 text input
  (placeholder = current seed). Valid + different from `ctx.seed`
  triggers pendingSeed + clearSave + reload. Auto-roll when blank
  + save exists. Handoff when blank + no save (world was inline-rolled
  at boot). 6 new CSS classes for the disclosure styling.
- **World seed in controls panel** (`src/ui/tutorial.ts`). New
  `#controls-seed-line` shown at bottom of the H-key panel, refreshed
  on each open. `user-select: text` for sharing.
- **Density bumps**. `POI_PROCGEN_COUNT: 15 → 22`,
  `CACTUS_TARGET_COUNT: 10 → 14`, `DEAD_TREE_TARGET_COUNT: 30 → 45`.
- **`Tuning.RNG_SEED` retained as fallback only** (D85). Documented
  via `void Tuning.RNG_SEED` in main.ts; reproduces pre-AAI world if
  pendingSeed is manually set to 1337.

No save schema change — v9 stays. tsc clean. 9 files touched.

## What's freshly shipped (Session AAH deltas)

Playtest polish pass for AAG. Quick post-ship tuning session — no new
features, no schema bumps. Two CLAUDE.md rule-2 violations cleaned up
+ five feel adjustments based on math analysis.

- **footprintPuffs.ts constants lifted to Tuning**. 6 module-local
  consts (PARTICLE_COUNT, PARTICLES_PER_PUFF, PUFF_LIFE_S,
  PUFF_VERTICAL_VEL, PUFF_LATERAL_VEL, PUFF_GRAVITY) → 6 new
  `Tuning.FOOTPRINT_PUFF_*` entries. Module reads them per-call so
  future iterations don't need module edits.
- **interaction.ts swap duration lifted**. `PICKUP_SWAP_DURATION = 1.5`
  was hardcoded module-local in AAG. Lifted to
  `Tuning.PICKUP_SWAP_DURATION_S`. New `Tuning` import on the file.
- **FOOTPRINT_PUFF_VERTICAL_VEL: 0.6 → 0.9** — peak height
  v²/(2g) goes from 15cm to 34cm; original was barely above the foot
  mesh, new value reads as a clear "kicked dust" beat.
- **DUST_MOTES_OPACITY: 0.18 → 0.22** — 0.18 was too easily missed in
  bright daylight; 0.22 reads in lit interiors (lantern, fire,
  skylight beams) while still subtle outdoors.
- **PICKUP_SWAP_DURATION_S: 1.5 → 1.2** — snappier hold-and-move-on
  rhythm; longer than salvage (1.0s) but shorter than the original
  1.5 which felt like a deliberation pause.
- **MIRAGE_NEAR_M: 15 → 10** — wobble engages on the immediate
  horizon when walking salt-flats, instead of only in the far field.
- **Dust motes storm cross-fade softened** — hard cut at `storm > 0.8`
  (AAG) replaced with smoothstep `[0.7, 0.9]`. New Tuning constants
  `DUST_MOTES_STORM_FADE_START/END`. Cleaner transition into
  ambientDust's storm-peak dominance.

No save schema change. tsc clean. 4 files touched: tuning.ts,
footprintPuffs.ts, dustMotes.ts, interaction.ts.

## What's freshly shipped (Session AAG deltas)

Atmospheric polish + UX QoL bundle — four items from the continuous-
polish list plus the swap-on-pickup-full from the post-AAC kickoff
brief. Cooking multi-per-fire deferred per user direction.

- **Footprint puffs** (`src/world/footprintPuffs.ts`, new ~120 LOC).
  Particle pool of 60; 5 particles per footstep burst; 0.6s life;
  gravity-affected upward dust. Spawned from `controller.ts`'s
  footstep block when `!wet` (salt-flat wet conditions don't kick
  dust). Lives alongside the existing footprint-decal (decal =
  persistent print, puff = transient burst).
- **Ambient dust motes** (`src/world/dustMotes.ts`, new ~85 LOC).
  Complementary atmospheric layer to existing ambientDust.ts. 120
  bone-warm particles (0xe8dcc0), 0.04m size, opacity 0.18, slower
  vertical drift. Suppresses when storm intensity > 0.8 (ambientDust
  takes the lead at storm peak; dust motes fade so the two layers
  cross-fade rather than double up). Re-centers around the camera
  each frame within a 25m cube. Clone-not-abstract — two layers with
  different palettes and storm-response curves stay separate rather
  than parameterizing one.
- **Mirage shader on salt-flat biome** (`src/world/terrainMaterial.ts`).
  Vertex shader heat-wobble Y displacement. Module-level
  `_shaderRefs: Set<ShaderRef>` captures `onBeforeCompile` shader
  instances; exported `updateTerrainShaderUniforms(time, cameraX,
  cameraZ, sunHeight)` ticked each frame from main.ts. Four
  multiplicative masks: distance (15→80m smoothstep), saltness
  (`aBiomeRaw` 0.10→0.54), sun height (0.3→0.9), and a sin×cos
  spatial+temporal wobble. Peak amp 0.18m. Activates only on hot
  salt-flats under high sun — your dunes stay solid.
- **Inventory swap on pickup-full** (`src/player/interaction.ts`).
  When `addItem` returns -1 (bag full) AND the currently selected
  hotbar slot is non-empty, the old "your bag is full" toast is
  replaced with a 1.5s hold-E timer. New module state `_pickupSwap`
  + `tickPickupSwap` + `cancelPickupSwap` + `completePickupSwap`,
  mirroring the existing `_salvaging` pattern. On completion:
  drops the selected slot's items at the player's feet via
  `spawnDroppedPickup` (one drop per stack unit), clears the slot,
  then addItems the world pickup into the now-empty slot. Cancels
  cleanly on E-release.
- **Cooking multi-per-fire deferred**: user direction — "hold off on
  cooking multi per fire. maybe we can make a grill attachment to the
  fire in the future to cook multiple at once." Added
  `[feat] fire grill attachment` to backlog as the future vision.

No save schema change. 5 new Tuning constants (MIRAGE_NEAR_M/FAR_M/
AMP_M, DUST_MOTES_COUNT/SPREAD/OPACITY, PICKUP_SWAP_DURATION_S).
Pattern reused: ambientDust's particle pool + _salvaging's
module-singleton hold-progress + fire's ember-pool architecture.

## What's freshly shipped (Session AAF deltas)

7-day storm countdown ("THE LONG STORM") shipped — first real
endgame pressure mechanic. New `stormCurveAt(daysSurvived)` exported
from `src/world/weather.ts` returns `{intervalMin, intervalMax,
duration}` lerping day-0 baseline → day-7-endpoint over days 0-6,
plateauing onto LONG_STORM values from day 7+. 9 new Tuning
constants. State machine captures `currentStormDuration` at
storm-start. New `#long-storm-indicator` HUD DOM. One-shot toast on
day-7 transition via `weather.longStormAnnounced` transient flag.
No save schema change (uses existing `time.daysSurvived`).

## What's freshly shipped (Session AAE deltas)

Creature companion (Rocky-inspired) shipped + SAVE_VERSION v9.
Small (~0.4m) red exoskeleton creature, 5 radially-symmetric legs.
Dual locomotion state machine: rolling (≥6m, ~5.5 m/s) → walking
(2-6m, ~1.8 m/s, gait sin-wave) → idle (<2m, breathing bob). New
ItemId `companion_pod` (recipe id 14 — cloth×2 + scrap×2 +
branch×1). New `src/enemies/companion.ts` (~290 LOC). RMB on
companion → packs to `companion_pod`. v9 schema additive
companion field. Spawned at boot in opening scene 3m camera-right
of player.

## What's freshly shipped (Session AAD deltas)

Polish playtest for AAC kits. Bedroll ghost-ring 0.55→0.65m;
lantern ghost-ring opacity 0.85→0.5 (lantern itself is tall enough
to read); bedroll mesh height 0.06→0.10m. No save schema change.

## What's freshly shipped (Session AAC deltas)

Three new craftable+placeable+packable kits. Player builds their own home.

- **`bedroll_kit`** — id 11 (`cloth×3 + branch×1`). New
  `src/world/bedroll.ts` (~145 LOC). Cloth pad + pillow + fold lines.
  Small shelter zone, E to sleep, RMB to pack.
- **`lantern_kit`** — id 12 (`cloth×2 + scrap×2 + branch×1`). New
  `src/world/lantern.ts` (~175 LOC). Standing post + glass globe +
  warm PointLight + sin-driven flicker. Never burns out. RMB to pack.
- **`locker_kit`** — id 13 (`scrap×4 + branch×2`). New
  `src/world/locker.ts` (~160 LOC). Wooden chest + metal banding +
  latch. New `InteractType: 'open_locker'`. Bidirectional cargo via
  lootMenu allowDeposit:true. Pack-up refuses if non-empty.
- **SAVE_VERSION 7 → 8** (D81 additive). New optional bedrolls/
  lanterns/lockers fields. Pre-v8 saves load with empty arrays.
- Plumbing: GameContext, main.ts ctx init, interaction.ts cases,
  wieldAction.ts RMB extension, tutorial.ts HINTS.

## What's freshly shipped (Session AAB deltas)

World depth pass — two complementary improvements:

- **Salvage yield differentiation** (`src/world/salvage.ts`).
  TABLES rebalanced so each wreck kind has a distinct profile:
  engines = scrap-pure (+ rope/bullet rare), fuselage = cloth-heavy
  (+ rope), escape_pod = medical (bandage), cargo = lottery (+ rope),
  massive = rich mix (+ rope/fire_kit/flashlight). Adds `rope` to
  the salvage pool — previously craft-only. Drives real player
  choice on which wrecks to strip based on what they need.
- **Skylight god-rays for the opening wreck** (`src/world/openingWreck.ts`).
  Additive cone inside the wreck, tip at the stress-fracture gap,
  base near the floor. Module-level mesh + per-frame
  `updateOpeningWreckGodRay(ctx)` scales opacity by sunHeight × (1 -
  storm.intensity). 6 new Tuning constants. Visible at high sun on
  clear days; invisible at night or peak storm.

## What's freshly shipped (Session AAA deltas)

Five-item first-impression polish bundle, closing loose ends from the overnight era:

- **UU pickup migration reverted**: E is the canonical take button again.
  LMB narrows to "use the wielded item" (attack/place/hold_use).
  UU's wieldAction.ts + wieldLmb dispatcher stays intact.
- **Ghost preview** (`src/player/ghostPreview.ts`, new): gold ring +
  vertical pole at camera-forward 2.2m, sized per kit. Closes UU's
  deferred scope-cut #1.
- **Vignette ramp lowered** 0.4 → 0.3 (`Tuning.STORM_VIGNETTE_RAMP_START`):
  inside-large-tent perceived=0.4 now produces non-zero vignette
  opacity. Closes D79's visual gap.
- **Recipe book panel** (`src/ui/recipeBookPanel.ts`, new): TAB-key
  modal listing discoveredRecipes. Closes TT's deferred stretch.
- **Crosshair `.dead` state**: distinguishes corpse-loot from
  ground-pickup hover.

## What's freshly shipped (Session YY deltas)

The scope-cut #1 from XX, realized. Storm visual dampening
distinguishes large tent (open-front, partial dampening) from small
tent / fire (legacy fully-enclosed kill):

- **`weather.perceivedIntensity`** field added to the Weather
  interface. Player-context-aware storm intensity (vs.
  `intensity` which stays the world-truth).
- **`ShelterZone.isLargeTent?`** flag added. `addShelterZone`
  accepts new `opts?: { isLargeTent }` parameter. `largeTent.ts`
  passes `{ isLargeTent: true }` when registering its zone.
- **`updateShelter`** walks zones once via new `classifyShelter`
  helper, writes perceivedIntensity per the routing rule.
- **`weather.ts` dust layers + `stormVignette.ts`** read
  `perceivedIntensity` instead of `intensity` (and drop the binary
  `inShelter` override — it's baked into perceivedIntensity now).
- **Fog + stats + AI stay on `intensity`** (world-truth).

Decision D79 (placeholder reserved in plan; now realized; friction-2).
New Tuning constant `LARGE_TENT_STORM_DAMPEN = 0.4`. Backlog now
notes the audio extension as a future polish item.

## What's freshly shipped (Session XX deltas)

Final session of the overnight queue. New ItemId, new world entity,
save schema bump:

- **`large_tent_kit`** ItemId + ItemDef (wieldLmb='place', LMB to
  deploy). Recipe id 10 (cloth×4 + branch×3 + rope×1).
- **`src/world/largeTent.ts`** (new ~250 LOC) — mirrors tent.ts but
  with a walk-in 3-walled cabin (back + 2 sides + roof + 4 corner
  posts + front lintel; front face open). Shelter zone covers
  interior cavity only — player must be inside to get the warmth
  bubble. D80 documents the "two modules vs. parameterized" call.
- **`packUpLargeTent(ctx, tent)`** mirrors UU-2's `packUpTent`:
  atomic, inventory-full refuse, **plus** refuses if player is
  currently inside the tent (toast "can't pack — you're inside the
  tent" — don't yank shelter out from under the player).
- **`ctx.largeTents.list`** added to GameContext; initialized in
  main.ts.
- **`interaction.ts`** gains a `'largeTents'` registry case — same
  'sleep' hover verb so E opens the sleep overlay identically.
- **`wieldAction.ts` `handleContextAction`** extended to iterate
  `ctx.largeTents.list` when `hover.type === 'sleep'`. RMB pack-up
  works for both small + large tents.
- **`SAVE_VERSION 6 → 7`** (D81 — additive only). New optional
  `largeTents?: Array<{id, pos, rotationY}>` on SaveV1. Loader
  accepts v1-v7; pre-v7 saves load with empty large-tents array.

**Scope-cut #1 taken**: `weather.perceivedIntensity` split deferred.
Large tents already shelter via the ShelterZone mechanism (cold
drain etc.) but storm visuals inside the tent stay at full
intensity. Backlogged as a future polish item.

Decisions D80 (clone-not-parameterize, friction-2) + D81 (save
migration additive discipline, friction-3) logged.

## What's freshly shipped (Session WW deltas)

HUD micro-polish — three visible-at-first-boot wins:

- **`src/ui/statVignette.ts` (new)** — CSS-overlay vignettes (D78
  vs. clone-not-abstract). Two divs: `#stat-vignette-cold` blue,
  `#stat-vignette-thirst` brown. Linear opacity ramp to 0.35 as
  the stat worsens past threshold. Suppressed during peak storm
  (intensity > 0.7) so the stormVignette has the screen.
- **`src/player/staminaWobble.ts` (new)** — sin-driven camera
  jitter when stamina < 0.2. Two desynced sines (X base, Y at
  1.37× freq + phase offset, half amp). Caps at 0.04m at 6Hz.
  Mounted-suppressed. Ticks AFTER `updatePlayer` so the
  camera-anchor runs first.
- **`#interact-prompt` CSS** — opacity transition bumped 0.15s →
  0.12s ease-out (snappier feedback per brief spec).

Decision D78 logged (CSS overlay vs. in-scene shader; friction-1).

## What's freshly shipped (Session UU-2 deltas)

RMB layer on top of UU's LMB scheme. Power-user verbs:

- **`handleContextAction(ctx)`** in `src/player/wieldAction.ts` — runs
  between mount-gate and the LMB switch. Reads `mousePressed.has(2)`
  + `ctx.inventory.hover`. RMB on tent (`hover.type === 'sleep'`) →
  `packUpTent`. RMB on sled (`'open_sled' | 'attach_rope'`) with
  `sled.tether.kind === 'speeder'` → `detachRope(ctx, sled,
  'rope released')`. All overlay/mount/isPlaying gates inherited.
- **`packUpTent(ctx, tent)`** in `src/world/tent.ts` symmetric to
  `deployTent`. Atomic: tries `addItem('tent_kit')` FIRST; if -1
  (inventory full), aborts BEFORE touching scene/shelter/list +
  toasts "no room in your bag". On success: removeShelterZone,
  scene.remove, splice list, toast "tent packed".
- **Sled rope release via RMB**: reuses existing `detachRope`. No
  new function; just dispatch wiring.
- **CONTROLS table refresh** in `src/ui/tutorial.ts:44-59`. Captures
  the new LMB scheme + RMB additions + Q-as-backup. HINTS table
  also updated: canteen "hold LMB to drink", kits reference
  LMB-click + RMB pack-up.

Decision D77 logged (RMB as additive power-user verb, friction-2).

## What's freshly shipped (Session VV deltas)

Palette-cleanser between UU and UU-2. Three discrete improvements:

- **fire.ts constants → `Tuning.FIRE_*`**: 5 constants lifted
  (`FIRE_INITIAL_FUEL_S`, `FIRE_FUEL_PER_BRANCH_S`,
  `FIRE_SHELTER_RADIUS_M`, `FIRE_SHELTER_HEIGHT_M`,
  `FIRE_NEAR_DISTANCE_SQ`). Values unchanged.
- **tent.ts constants → `Tuning.TENT_*`**: 2 constants lifted
  (`TENT_SHELTER_HALF_X/Y/Z`, `TENT_NEAR_DISTANCE_SQ`). The
  `TENT_SHELTER_HALF` object remains as a local readability helper
  composing the Tuning fields.
- **Crosshair feedback** (`src/style.css` + `src/ui/interactPrompt.ts`):
  `#crosshair` gains `.interactable` (brighter + larger middle-dot)
  and `.kill` (red + larger) modifier classes. `updateInteractPrompt`
  now ALSO toggles these classes from `ctx.inventory.hover`. Cached
  DOM ref + last-state guard for cheap per-frame transitions.
- **`as any` cleanup**: lone cast in `src/world/wrecks.ts:137`
  replaced with direct property assignment. `eslint-disable` line
  dropped. **`Grep "as any" src` returns 0 matches** as of VV.

Decision D76 logged (friction-0 — pure CLAUDE.md rule compliance).

## What's freshly shipped (Session UU deltas)

**Control scheme overhaul — LMB-leaning** replaces "E for everything"
with a click-driven scheme. Detailed breakdown:

- **New module**: `src/player/wieldAction.ts` (~125 LOC) is the SOLE
  LMB-while-wielded dispatcher (D73). All gates (overlay-open,
  speeder-mounted, isPlaying) live in one file. `updateCombat` is
  invoked from here when the equipped item's `wieldLmb === 'attack'`;
  removed from `main.ts`'s direct tick.
- **Schema change**: optional `wieldLmb?: 'attack' | 'place' |
  'hold_use' | 'click_use' | 'none'` field on `ItemDef` (D74).
  Default `'click_use'`. Per-item overrides: weapons `'attack'`;
  canteen `'hold_use'`; kits `'place'`; torch/flashlight/rope
  `'none'`.
- **Hold-LMB sustained drinking**: new `ItemDef.onHoldTick` hook
  (canteen only); state lives in `slot.meta.holdProgress` (D58
  pattern, HMR-safe). One gulp per `Tuning.CANTEEN_DRINK_INTERVAL_S =
  0.7`s. Each gulp drains `CANTEEN_DRINK_DELTA` (0.25), restores
  thirst proportionally, plays drink+pour audio, fires the existing
  tip-to-lips viewmodel anim.
- **LMB-click placement** for fire_kit / tent_kit / sled_kit. Reuses
  each kit's existing `onUse` (deployFire/deployTent/deploySled);
  wieldAction just routes the LMB event. Q-key still triggers
  `onUse` via inventory.ts (backward compat).
- **LMB-take a hovered ground pickup** when wielding a non-attack
  item. E-press take logic removed from `interaction.ts`'s case
  `'pickups'`. The hover-state setup (p.hovered=true, hover.type=
  'take') stays in interaction.ts so wieldAction can find the
  hovered pickup.
- **`[E]` chip auto-hides** for `hover.type === 'take'`:
  `VERBS['take'] = ''` makes the existing "hide chip when verb is
  empty" path fire. Player sees just the noun ("branch") with no
  key chip — the UU-2 controls panel refresh communicates the
  LMB-to-take rule.
- **Placement distance unified**: `Tuning.PLACEMENT_DISTANCE_M = 2.2`
  (D75) lifts fire.ts's previously-1.5m + tent.ts/sled.ts's 2.2m to
  a single constant. Fire deploys 0.7m further out than before — a
  perceptible feel change.
- **Verb table tightening** (UU.5): `VERBS['search'] = 'open'` for
  loot containers (was "search"; loot containers OPEN, not search).
- **Save schema preserved**: `SAVE_VERSION` stays at 6.
  `slot.meta.holdProgress` stripped in `cloneSlot()` so transient
  input state never persists.
- **Decisions D73-D75** logged: (D73) wieldAction.ts dispatcher
  architecture, friction-4. (D74) wieldLmb field on ItemDef,
  friction-3. (D75) PLACEMENT_DISTANCE_M unification, friction-1.

**Verification (eval-driven preview)** confirmed every UU surface:

- ✓ Hold-LMB drinking: 2 gulps over 2.1s, thirst restored 0.3 → 0.94,
  fill drained 1.0 → 0.5, holdProgress cleared on release.
- ✓ LMB-place fire_kit: 1 fire deployed at the player's forward 2.2m,
  kit consumed.
- ✓ LMB-take pickup (branch): pickup despawned, count +1.
- ✓ Weapon LMB doesn't take pickups (machete equipped → combat path).
- ✓ Overlay gate: controls panel open → hold-LMB does NOT drink
  (thirst stayed 0.3 across 1s of mock-held).
- ✓ Mounted gate: speeder.mounted=true → hold-LMB does NOT drink
  (combat owns LMB).
- ✓ Save round-trip: localStorage save lacks `holdProgress` key,
  fillLevel preserved, version still 6.
- ✓ Rope wieldLmb='none' static check confirms QQ-2 path intact.

---

## Known issues / partials

- **No ghost-preview mesh on LMB-place** (UU scope-cut #1 in plan;
  not cut — just deferred for tighter scope). Players see "fire lit"
  toast as feedback, no pre-place visual indicator of where the
  kit will land. Backlog.
- **Pickup prompt copy is sparse**: post-UU, looking at a ground
  pickup shows just the noun ("branch") with no verb or key chip.
  The UU-2 controls-panel refresh will document LMB-to-take. A
  refined "[click] take noun" prompt was a scope-cut candidate in
  UU; deferred. Backlog candidate.
- **No source audio files yet** (`public/audio/*.ogg`). Soundscape
  has procedural fallbacks; full atmospheric experience pending CC0
  sourcing.
- **Skylight god-rays subtle**: opening wreck's 30° gap admits real
  sunlight, but without atmospheric dust scattering the interior beam
  isn't visually dramatic at midday. Possible polish via volumetric
  fog pass — deferred.
- **No "recipe book" panel yet**: combine-mode UI is discover-only;
  no list view of discovered recipes. Deferred TT stretch.
- **Opening wreck pointer-locked walk-in not yet playtested by a
  human**: eval-driven verification passed, but the actual "walk
  through the torn entrance" experience still hasn't been tried.
  Worth a quick boot before the next polish session.

---

## Constants worth tuning

Recent ones (session-tagged):

| Constant | Session | Default | Notes |
|---|---|---|---|
| `PLACEMENT_DISTANCE_M` | UU | 2.2 | All kit deploys (fire/tent/sled) — D75 |
| `CANTEEN_DRINK_INTERVAL_S` | UU | 0.7 | Time between hold-LMB gulps |
| `OPENING_WRECK_HULL_LEN` | RR | 6.0 | Tapered fuselage length |
| `OPENING_WRECK_SLICE_COUNT` | RR | 24 | Angular slices (15°/slice) |
| `OPENING_WRECK_SKYLIGHT_SLICE` | RR | 17 | First slice to omit; SS skips 17+18 |
| `SLED_TOW_DISTANCE` | QQ-2 | 5.0 | Inextensible rope length |
| `SLED_TOW_MAX_DIST` | QQ-2 | 10.0 | Hard snap-detach threshold |
| `SLED_YAW_LERP` | QQ-2 | 0.12 | Visual yaw lerp |
| `STAMINA_TOW_FACTOR` | QQ | 2.0 | Stamina drain × this while tethered on foot |
| `SANDWORM_LENGTH` | QQ-2 | 120 | Halved from MM's 240 |
| `RECIPES` array | TT | 9 entries | Stable numeric ids 1-9; new recipes append at id ≥ 10 |

---

## Suggested next session (1-3 directions in priority order)

User-prioritized lineup (post-AAB):

1. **Session AAC — Craftable home (~4-6h, may split)**. Bedroll,
   lantern, locker as placeable kits mirroring tent/sled/fire
   patterns. New recipes id 11/12/13. Save schema v7→v8 additive.
   Bedroll = portable sleep affordance; lantern = standing light
   source; locker = additional storage chest (extends inventory).
   Player gets to customize their temporary home anywhere.
2. Big-ticket bucket items remain available (creature companion,
   7-day countdown, trading, etc.).

Top pick: AAC. Bigger scope — may want to split into sub-sessions
(bedroll first, then lantern, then locker) so each ships independently
verifiable. Each kit follows the same pattern (item def + new world
module + deploy/pack + recipe + save migration).

---

## Time spent

26 sessions shipped (A–YY). Approx ~93-148h elapsed dev time across
roughly 3 weeks of calendar time. Overnight queue (UU through XX)
ran in one continuous push of ~8-10h, landing 5 sessions clean.
YY was a tight ~45min follow-on session realizing XX's deferred
scope-cut #1 (perceivedIntensity split). Total overnight-era haul:
6 sessions, 9 D-entries (D73-D81 from overnight + D79-realization
in YY).

---

## State at session end

- **Git status**: working tree dirty (uncommitted). Branch: `master`.
- **Last commit**: `01b4eb5` (Session TT) on origin/master.
- **Tags on origin**: `session-A` through `session-TT`. `session-UU`
  not yet tagged.
- **Ports bound**: none (preview server stopped at end of UU verify).
- **Save state**: localStorage has a v6 save written during UU
  verification (canteen partially depleted, one fire deployed near
  spawn, one branch pickup-taken).

---

## Token spend this session (estimated)

Rough estimate (Claude doesn't expose live counts to the agent):

- Input: ~180K-220K tokens (plan-mode exploration with 3 Explore +
  1 Plan agent, then session-start state reads, items.ts in chunks,
  combat.ts, types.ts, main.ts, interaction.ts, tuning.ts, save.ts,
  inventory.ts, input.ts, fire.ts, tent.ts, multiple preview-eval
  rounds, session-end doc reads)
- Output: ~35K-50K tokens (5 multi-paragraph plan-file edits, 11
  items.ts edits, new wieldAction.ts module, multiple .md docs
  rewrites, D-entries D73-D75, changelog, next-session-prompt)
- Cached input: substantial (CLAUDE.md, decisions.md, items.ts
  re-read across turns)
- Cost (Opus 4.7 rates, rough): $2-$5

Flagged as **above baseline** — the plan-mode exploration phase
front-loaded most of the cost; the implementation phase was tight.
For the overnight queue (VV → UU-2 → WW → XX), expect lower per-
session token costs since the architecture is now established and
the file map is mostly familiar.

---

## Commit handoff

User pre-authorized per-session commit + tag + push for this
overnight run (plan file: `.claude/plans/i-want-to-set-floating-dusk.md`,
"Commit cadence: per-session commit + tag (Recommended)"). Skill
will execute commit + `git tag session-UU` + push to origin in the
final step.
