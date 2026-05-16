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

**Last shipped**: Session CC-3 — animated main menu (title screen).
Dedicated `src/world/titleScene.ts` (own THREE.Scene + camera, decoupled
from game world) — camera atop a Gaussian-hero-dune perched on an 800m
displaced-plane dune field, sky 2/3 / desert 1/3 composition. Tiny pod
streaks in like a shooting star (additive Line trail + glow sprite) and a
procedural **pyre** (nested cones + tongues + coal bed + ember/smoke
pools, `fog: false` to punch through 200m haze) engulfs it on impact. Day/
night cycle uses the **real in-game sky** (shader-sphere gradient + sun
sprite + moon sprite + 800 stars + planet + shooter pool) — `sky.ts`
exports its helpers so the title can build its own bundle without
disturbing the game's singleton. Sun arc rebuilt around the camera-forward
axis so it actually crosses the fixed view; left-shifted via
`LEFT_SHIFT=0.50`. Boot starts in pre-dawn (`cycleOffset=0.19`, sun 18°
below horizon, red glow building). **Moon now crescent + larger** in
`sky.ts` (canvas `destination-out` carve, `MOON_DISC_SIZE` 16 → 32,
`depthTest: true` so terrain occludes it — affects in-game too). NEW
`src/ui/titleOverlay.ts` — DUSTFALL wordmark + subtitle + CONTINUE
(when save exists) + NEW GAME. `startLoop` accepts an optional render-
target getter that swaps title/game scenes by `ctx.flags.titleActive`.
**Save/load round-trips speeder pose** (pos + rotationQuat + mounted +
headlamp); `setupOpeningScene` now runs on every boot (was gated on
`!hasSave`) so the starter wreck + speeder always exist, and
`loadGameState` patches over the default placement on Continue. NEW GAME
from a save wipes save + reloads (clean slate). Decisions D41–D44. Prior
milestones: CC-2 (speeder polish), CC (hover speeder shell), BB-4 (storm +
fog rework), BB-2/BB-3 (Jakku-scale mega-wreck), BB (small mega-ship), AA
(torch + flashlight, opening-scene rebuild), Z (stone-well + salvage
panels), Y (footprints + lizard tracks), X (audio sample-stem
architecture, .ogg files pending in `public/audio/`), W (opening scene),
V (atmosphere), U (UX + empty world), N (rigged raider infra). See
[docs/changelog.md](docs/changelog.md) for full history;
[docs/roadmap.md](docs/roadmap.md) for what's next.

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
