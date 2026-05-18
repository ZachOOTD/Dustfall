# Dustfall — project manual

Browser first-person desert survival game. Long Dark / Mad Max / Dune tone.

## Tech stack

Three.js + TypeScript + Vite + `@dimforge/rapier3d-compat` + `simplex-noise` + procedural Web Audio (no sample files).

## Project location

`C:\Users\Zach\projects\dustfall`

Run with `npm run dev` (port 5173). Type-check with `npx tsc --noEmit`.

**Reference docs** (read on demand):
- [docs/architecture.md](docs/architecture.md) — file map, footguns, FPS-debug path.
- [docs/changelog.md](docs/changelog.md) — what shipped per session.
- [docs/roadmap.md](docs/roadmap.md) — what's next.
- [docs/decisions.md](docs/decisions.md) — why we made key calls.
- [docs/backlog.md](docs/backlog.md) — unprioritized ideas / bugs / polish / debt.

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

**Last shipped**: Session LL — Satellite dish polish + engine_block
POI rework. Thread A polished KK's satellite dish in `satelliteDish
.ts`: exterior 45° ladder + composed-quat ramp collider (climb to
roof to reach the dish-back salvage panel KK left unreachable),
warm interior `PointLight(0xffa844, 0.6, 6)` + emissive lantern
prop, 2 droopy `TubeGeometry`/`CatmullRomCurve3` cables on the feed
assembly (cable B anchor bug fixed — was missing focalDist offset),
rust variation expanded from `i % 2` to `i % 4` with 2 new shades.
`BURY_Y` 2.5 → 1.0 (D61) so the 2.2m doorway opening sits mostly
above grade — KK had it trapped 1.9m underground; ladder auto-
rescales. Thread B engine_block rework: new `src/world/engineBlock.
ts` (~370 LOC) replaces the 31-LOC inline `placeEngineBlock` in
`poi.ts` with `LatheGeometry`-tapered bells (throat → bulged shoulder
→ pinch → flared rim) + `BackSide` emissive throats + backstop disc
(D48 maw trick) + char/scar rings, cooling-shroud tori + 4
lengthwise ribs sleeving the box thrust frame, ablative heat-shield,
2 `TubeGeometry` fuel hoses, 4 per-piece tilted box colliders (was
single AABB), 2 salvage panels (frame face + recessed inside center
bell throat). Decisions D61.

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

- **Start of session**: invoke `/session-start` skill. It reads [roadmap.md](docs/roadmap.md) top entry + last 2 [changelog.md](docs/changelog.md) entries + 3-5 critical files for the active session.
- **End of session**: invoke `/session-end` skill. Verifies, writes changelog entry, updates roadmap, archives plan, prints commit + `git tag session-<X>` commands.
- **Idea dumping**: invoke `/triage-ideas` and paste free-form text. Classifies + appends to [backlog.md](docs/backlog.md).
- Memory upkeep: every ~5 shipped sessions, run `consolidate-memory` (built-in).

## Sub-agent policy

- **Aggressive Explore** agents for "where is X" / "map Y" — separate context budget.
- **Conservative Plan** agents — only for genuinely novel design.
- Skip both when a targeted Grep + Read does the job.

## Don't burn context on

Re-reading files. `git status -uall`. Pasting full eval results when one value answers. Wide screenshots when `gl.readPixels` is enough. Multiple Explore agents when one Grep suffices.
