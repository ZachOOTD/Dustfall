# Dustfall — project manual

Browser first-person desert survival game. Long Dark / Mad Max / Dune tone. Built across Sessions A → H over many days.

## Tech stack

Three.js + TypeScript + Vite + `@dimforge/rapier3d-compat` + `simplex-noise` + procedural Web Audio (no sample files).

## Project location

`C:\Users\Zach\projects\dustfall`

Run with `npm run dev` (port 5173). Type-check with `npx tsc --noEmit`.

## File map

```
src/
  main.ts                 — orchestrator. ~130 lines. Builds ctx, registers per-frame tick.
  GameContext.ts          — the shared `ctx` type passed to every system.
  config/
    tuning.ts             — EVERY magic number. Don't sprinkle constants elsewhere.
  core/
    scene.ts              — renderer, camera, scene, resize, shadow + tone-mapping setup
    lighting.ts           — sun + moon + ambient + shadow camera follow + sky color lerp
    input.ts              — keys, pressed, wheel, mousePressed; PointerLockControls; pause unlock
    loop.ts               — RAF + delta-time + tick callback
    rng.ts                — seeded LCG
    settings.ts           — Settings type + load/save to localStorage
  physics/
    world.ts              — RAPIER.init() + World.step() fixed-step accumulator
    bodies.ts             — makeStaticBox/Cylinder/ConvexHull, makePlayer (capsule+character controller), attachBoundsCollider
    debug.ts              — backtick toggles green wireframe overlay
  world/
    terrain.ts            — simplex-noise heightmap mesh + Rapier heightfield collider, heightAt/normalAt
    sculpt.ts             — perturbOutward, tintByHeight (helpers for rocks)
    landmarks.ts          — scatter loop. Rocks + trunks INSTANCED (4 + 3 templates × near/far). Wreckage + mesa are groups.
    heroLandmarks.ts      — placeRibcage/TruckWreck/RadioTower/Obelisk + placeHeroLandmarks
    sky.ts                — sky-sphere shader + sun-disc sprite + horizon/top color blend
    weather.ts            — sandstorm state machine + Points particles
  assets/
    loader.ts             — GLTFLoader wrapper + SkeletonUtils.clone (for future rigged assets)
    manifest.ts           — typed list of asset URLs (empty registry tolerated; primitive fallback)
  player/
    controller.ts         — Rapier kinematic capsule + WASD + sprint + footstep cadence
    interaction.ts        — raycast 2.5m forward against ctx.pickups.list, E to take
    combat.ts             — LMB → swept-capsule castShape → damageRaider
  stats/
    survival.ts           — thirst/heat/health drain, shelter modifier, storm modifier, die()
  inventory/
    types.ts              — ItemId/ItemDef/Slot/InventoryState
    items.ts              — registry: canteen, scrap, bandage, machete + onUse impls
    inventory.ts          — addItem, useSelected, hotbar 1-4/wheel/Q input
  pickups/
    pickups.ts            — spawnCanteens, bobPickups (sin Y), findPickupById, despawnPickup
  enemies/
    raider.ts             — hooded primitive + AI state machine + sight raycast cache (0.5s)
  shelter/
    shelterZones.ts       — AABB registry + per-frame point-in-box check → ctx.player.inShelter
  audio/
    audio.ts              — Web Audio context, master/sfx/ambient gains, playFootstep/Pickup/Drink/Swing/Hit/Death
    soundscape.ts         — wind loop (filtered noise + LFO wobble) modulated by night + storm
  ui/
    hud.ts                — bars + clock + toast + death screen + shelter indicator
    hotbar.ts             — 4 slots bottom-center, keybind/glyph/count, diff-render
    interactPrompt.ts     — "[E] take X" under crosshair when looking at pickup
    menus.ts              — start overlay extras + pause overlay + settings panel + localStorage
    perfHud.ts            — dev-only F1 overlay (FPS / draws / tris)
  debug/
    debugPanel.ts         — window.__game = { setTime, setStats, state, castDown, RAPIER, triggerStorm }
```

## Architecture rules

1. **`GameContext` is the spine.** Every system reads/writes `ctx`. Don't pass random params around.
2. **Magic numbers → `src/config/tuning.ts` ONLY.** Don't sprinkle them.
3. **Per-frame tick order in `main.ts` matters.** Current order:
   ```
   physics.step → updateWeather → updateLighting → updateSky → updatePlayer →
   updateShelter → updateStats → updateSoundscape → bobPickups → updateRaiders →
   updateInteraction → updateInventoryInput → updateCombat → updateHud →
   updateHotbar → updateInteractPrompt → updatePhysicsDebug → updatePerfHud →
   endInputFrame
   ```
4. **Pause gates everything.** `if (ctx.flags.paused) { endInputFrame(); return; }` — physics, AI, weather all freeze.
5. **DOM ownership.** Each UI module owns its DOM refs; created at boot, mutated each frame.
6. **No `innerHTML` with concatenated strings** — the pre-tool hook flags it as XSS risk. Use `createElement` + `textContent`.

## Footguns (cumulative pain)

- `await RAPIER.init()` before any world ops. `main.ts` is async from line 1.
- `vite.config.ts` must include `optimizeDeps.exclude: ['@dimforge/rapier3d-compat']` or dev server hangs.
- `verbatimModuleSyntax: true` in tsconfig — use `import type` for type-only imports.
- `noUnusedParameters: true` — prefix unused params with `_`.
- Shadow camera **must** follow the player each frame (in `core/lighting.ts`) or shadows disappear past spawn.
- Terrain mesh triangle winding **must** be `(a, b, c, b, d, c)` — reversed = see-through ground.
- Rapier raycasts return null until `world.step()` runs at least once (broadphase build).
- `PointerLockControls` is kept for mouse-look only; Rapier's `KinematicCharacterController` owns position.
- `SkeletonUtils.clone()` for rigged GLTFs (when added) — plain `.clone()` shares bones across instances.
- `InstancedMesh` for landmarks has `frustumCulled = false` — the union AABB across all instances spans the world.
- MCP preview screenshot tool can time out on this page once Rapier is loaded — verify with `gl.readPixels()` instead.

## How to change the game

- **Game feel** (movement speed, drain rates, etc.) → `src/config/tuning.ts`.
- **Look** (sky colors, shadow map, exposure) → `src/config/tuning.ts` + `src/world/sky.ts` shader.
- **Add an item** → add to `inventory/types.ts` ItemId union + register in `inventory/items.ts`.
- **Add a sound** → new function in `src/audio/audio.ts` synthesizing via Web Audio nodes.
- **Add a system** → new file, hook into `main.ts` tick at the right order.

## Sessions complete

- **v0** — 1-hour prototype (flat sand, primitive landmarks, click-to-play)
- **A** — Module refactor + Rapier physics + collisions
- **B** — Terrain dunes (simplex heightmap + heightfield collider) + improved primitives + 4 hero landmark types (ribcage, truck, tower, obelisk)
- **B.5** — Lighting + shadows (PCFSoft, follow-player shadow camera) + visible sun disc + gradient sky shader + brighter mid-day + wreckage / mesa / canteen polish
- **C** — Inventory + look-at raycast + hotbar UI + interact prompt + shelter zones + procedural audio (wind / footsteps / pickup / drink)
- **D** — Raider enemy (primitive hooded wanderer + 6-state AI) + LMB combat (swept-capsule castShape) + sandstorm weather + main menu + pause + settings panel + localStorage persistence
- **H** — Performance pass: InstancedMesh for 134 rocks/trunks (14 pools), distant-shadow culling (76 landmarks marked far), raider sight raycast cached (0.5s), F1 perf HUD overlay (FPS/draws/tris)

## Where we are now

**Last completed**: Session H (performance pass). Draw calls dropped from ~400+ → ~140. Visual fidelity preserved. `tsc --noEmit` clean.

**Next**: Session E — first-person viewmodel (hands holding equipped item) + use animations (swing, drink) + SVG hotbar icons + UI sound polish. See `~/.claude/plans/ok-i-want-to-elegant-waffle.md` v1.5 section for detail.

After E: F (realism overhaul — water sources, hunger, cold nights, stamina, wildlife, mixed loot), then G (fire + cooking + tents + sleep + crafting + day counter).

## Session workflow (read each start)

1. Auto-loaded: this file.
2. Read the plan's next-session section: `C:\Users\Zach\.claude\plans\ok-i-want-to-elegant-waffle.md`.
3. Read the 3–5 critical files for that session.
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

## Claude Code features worth using

`/compact` (auto-summarize older turns when nearing limit). Background bash + Monitor. Explore agents (separate context). Memory files at `~/.claude/projects/.../memory/`.
