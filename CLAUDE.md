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

**Last completed**: Session P + iteration (barren-desert pass + bigger dunes + biome-modulated flatness). `tsc --noEmit` clean. Removed the scattered rocks/logs/wreckage/loot crates + the truck-wreck hero landmark (deleted `src/world/landmarks.ts`; trimmed `heroLandmarks.ts`). New ridged + wind-warped dune terrain in `src/world/terrain.ts` — primary wavelength 145m, peak amplitude 16.5m, plus a secondary scale and asymmetric crest bias. New `src/world/biomes.ts` samples `'dune' | 'rocky' | 'salt'` from a 220m-wavelength noise channel; `terrain.ts` writes per-vertex colors AND multiplies each vertex's height by a smoothly-blended biome scale (salt = 0.08× → near-flat playas; rocky = 1.15× → slightly rugged; dune = 1.0×). New `src/world/poi.ts` hand-places 4 distant POIs (monolith / abandoned camp w/ barrel + bandage / watchtower remnant / ribcage cluster). Perimeter mountains were tried and removed at user's request — `src/world/horizon.ts` deleted.

**Next**: Session Q (camera bob, idle breathing, surface-aware footsteps, smoother use-anim curves). Plan at `C:\Users\Zach\.claude\plans\in-the-dustfall-folder-elegant-cray.md` → "Next session — Q" section. Then M (save/load), N (rigged Quaternius raider), O (enemy variety + win condition).

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
