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

**Last shipped**: Session GG — World rework #2: biome rescale + scatter
retune. `BIOME_NOISE_FREQ 1/220 → 1/900` so biome regions are vast
(~2.67 per 2400m axis instead of ~10) — salt / rocky / dune now form
recognisable broad swaths instead of speckling. New
`findBiomeCentroid(biomes, target, options)` in biomes.ts generalises
the old `findSaltCentroid`; `waterSources.ts` uses greedy
`excludeCenters` to plant 3 wells across separate salt regions
(verified pairwise 1112-1413m apart). Cactus / dead-tree / hero-
landmark counts + radius bounds promoted to tuning constants and
rescaled for the 2400m world: 10 cacti (was 3), 30 dead trees (was
12), 15-20 hero landmarks (was 7-9), scatter radii out to ~1100m.
`SAVE_VERSION 2 → 3` (pure marker; loader accepts v1/v2/v3; id-based
scatter persistence needs no migration code — count growth is
absorbed by the existing find-by-id semantics). Dropped dead
`LANDMARK_COUNT: 180` from tuning. Sandworm home (60,0) still
resolves to dune. Decisions D53-D55.

**Prior milestone**: Session FF — World rework #1: chunked terrain +
bigger map. Replaced the single 800m heightfield with a 3×3 grid of
800m heightfield chunks (2400m world span), all sharing one
`createNoise2D` instance + world-space sampling so chunk-boundary
heights are bit-identical. Added `src/world/terrainLod.ts` (coarse
80×80 LOD plane to ±2000m, biased to y=-0.15 so chunks always win the
z-fight). `FAR_PLANE 600→1800`, `WORLD_RADIUS 280→900`,
`FOG_DENSITY_CLEAR 0.0035→0.0018`. `SAVE_VERSION` 1 → 2. Decisions
D50–D52.

**Prior milestone**: Session EE — scoping pass for the world rework.
Split the 10-15h "world + biome rework" roadmap item into three
sub-sessions; roadmap updated, session-1 plan authored, sessions FF
and GG then executed against it.

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
