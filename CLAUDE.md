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

**Last completed**: Session Q (game feel polish):
- `ctx.player.speed` (horizontal m/s) populated each frame in `controller.ts` from the Rapier-corrected delta. Read by viewmodel for bob amplitude.
- Viewmodel Y-bob phase-locked to footfall cadence (`BOB_FREQUENCY` cycles per meter walked, amplitude scales with `speed/WALK_SPEED` capped at 1.6× for sprint, halved on crouch). Bob applies to the viewmodel group only — never to the camera (motion sickness).
- Idle breath: separate sine at `BREATH_FREQUENCY` Hz, faded in when `speed < BREATH_IDLE_THRESHOLD`. Sums with bob on viewmodel Y.
- Footsteps split into 4 procedural variants in `audio.ts`: `playFootstepSand` / `Rock` / `Salt` / `Wet`. `playFootstep` retained as a legacy alias → sand. Dispatch in `controller.ts` step-fire uses `biomeAt(body.x, body.z)` + a 2m proximity check to any `waterSources.list[].pos` (wet wins over biome).
- New `src/core/ease.ts` exports `easeOutBack`, `easeInOutCubic`, `easeOutQuad`. `items.ts` `playUseAnim` swapped: canteen = back-overshoot rise + quad release; bandage = cubic both ways; machete = back-strike (0..0.4) + cubic recovery (0.4..1). Old `smoothPulse` removed.
- Browser-verified: walk-speed bob amp 0.018m, sprint amp 0.029m (capped at 1.6×), idle breath amp 0.01m over 3.3s; all 4 footstep functions present; canteen peaks at y=0.22 (back-overshoot past nominal 0.20), machete strikes to z=-0.242 in 0.1s with smooth cubic recovery.

Earlier: A–L (foundation through tutorial UX), P (barren-desert pass), S (sci-fi pivot + ship wrecks), T (salvage gameplay). See `docs/architecture.md` for full history.

**Next**: M (save/load — persist player state, placed entities, world flags including stripped wrecks). Then N (rigged Quaternius raider), O (enemy variety + win condition).

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
