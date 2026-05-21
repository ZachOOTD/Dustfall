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

## How to change the game

- **Game feel** (movement speed, drain rates, etc.) → `src/config/tuning.ts`.
- **Look** (sky colors, shadow map, exposure) → `src/config/tuning.ts` + `src/world/sky.ts` shader.
- **Add an item** → add to `inventory/types.ts` ItemId union + register in `inventory/items.ts`.
- **Add a sound** → new function in `src/audio/audio.ts` synthesizing via Web Audio nodes.
- **Add a system** → new file, hook into `main.ts` tick at the right order.

## Where we are now

**Last shipped**: Session VV — Tuning lift + crosshair feedback +
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

## Sub-agent policy

- **Aggressive Explore** agents for "where is X" / "map Y" — separate context budget.
- **Conservative Plan** agents — only for genuinely novel design.
- Skip both when a targeted Grep + Read does the job.

## Don't burn context on

Re-reading files. `git status -uall`. Pasting full eval results when one value answers. Wide screenshots when `gl.readPixels` is enough. Multiple Explore agents when one Grep suffices.
