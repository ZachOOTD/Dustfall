# Dustfall — project manual

Browser first-person desert survival game. Long Dark / Mad Max / Dune tone.

## Tech stack

Three.js + TypeScript + Vite + `@dimforge/rapier3d-compat` + `simplex-noise` + procedural Web Audio (no sample files).

## Project location

`C:\Users\Zach\projects\dustfall`

Run with `npm run dev` (port 5173). Type-check with `npx tsc --noEmit`.

**Reference docs**: detailed file map, footguns, FPS-debug path, and full session history live in [docs/architecture.md](docs/architecture.md). Read on demand.

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

**Last completed**: Session S (sci-fi pivot — scavenger desert + ship wrecks) + several iterations on world feel:
- **S shipped** the wreck primitive registry (`src/world/wrecks.ts`: engine cluster / fuselage / escape pod / cargo container / antenna spire / engine bell + `placeDebrisField` helper). Hero landmarks + 4 hand-placed POIs re-themed to wrecks.
- **Dune iteration** — replaced the sharp `1 - |simplex|` ridge with `cos(n · π/2)` smooth-ridge function, organic noise warp, and 192-cell mesh resolution. Salt-flat biomes scale heights by 0.08× for near-flat playas; wider biome blend (0.22 noise units).
- **Realism pass** — wells-only water (5 wells with a salt-biome quota of 2), player starts with a full canteen, scattered canteens removed, pickups stop bobbing/spinning + align to terrain normal, tall objects (cactus / antenna / obelisk / watchtower / wells) buried into the sand.
- **Debug + crouch** — `Tuning.GOD_MODE = true` makes `die()` floor stats instead of killing. Hold LeftCtrl to crouch (eye 0.85→0.40m, walk × 0.5, sprint disabled). Ribcage hero landmark restored at ~15% probability.
- **Compound colliders** — new `attachCompoundCollider` in `physics/bodies.ts` walks each child mesh and creates a shape-accurate Rapier collider (cuboid → BoxGeometry, cylinder → CylinderGeometry, ball → IcosahedronGeometry, cone → ConeGeometry; torus/buffer fallback to per-mesh AABB; circles skipped). Collider count 46 → 112; wrecks now collide along their actual silhouettes.

Earlier sessions: A–L (foundation through tutorial UX) + P (barren-desert pass: dune terrain, biome map + per-vertex tints, wells with salt quota, prop cleanup). See `docs/architecture.md` for full history.

**Next**: Session T (salvage gameplay — make wrecks salvageable for loot). Plan at `C:\Users\Zach\.claude\plans\in-the-dustfall-folder-elegant-cray.md` → "Session T" section. Then Q (camera bob + footsteps + ease curves), M (save/load), N (rigged Quaternius raider), O (enemy variety + win condition).

### Tutorial flags (Session L)

`localStorage['dustfall.tutorial.v1']` stores `{seenIntro, usedItems}`. Wipe via the console with `__game.resetTutorial()` (or delete the key + refresh) to see the first-boot panel + all pickup hints again. `__game.showControls()` opens the controls panel without changing flags.

## Session workflow (read each start)

1. Auto-loaded: this file.
2. Read the plan's next-session section.
3. Read 3–5 critical files for that session. Need the broader file map or session history? → [docs/architecture.md](docs/architecture.md).
4. Either start or ask clarifying questions — don't assume.

End of each session:
1. Append completion notes to the plan file.
2. Update this file's "Where we are now" line.
3. Output `Next session prompt: <text>` for the user to paste.
4. Commit.

## Sub-agent policy

- **Aggressive Explore** agents for "where is X" / "map Y" — they have separate context budget.
- **Conservative Plan** agents — only for genuinely novel design.
- Skip both when a targeted Grep + Read does the job.

## Don't burn context on

Re-reading files. `git status -uall`. Pasting full eval results when one value answers. Wide screenshots when `gl.readPixels` is enough. Multiple Explore agents when one Grep suffices.
