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
    waterSources.ts       — oasis / well / barrel scatter; refill canteens via E
    cactus.ts             — saguaro scatter; harvest E → cactus_pulp
    lootContainers.ts     — standalone crates with rolled contents; spawn + tag
    fire.ts               — placeable fire (deployFire); flicker + fuelSeconds + shelter zone + cook/add_fuel interactions
    tent.ts               — placeable tent (deployTent); shelter zone + sleep interactable
  assets/
    loader.ts             — GLTFLoader wrapper + SkeletonUtils.clone (for future rigged assets)
    manifest.ts           — typed list of asset URLs (empty registry tolerated; primitive fallback)
  player/
    controller.ts         — Rapier kinematic capsule + WASD + sprint + footstep cadence
    interaction.ts        — raycast 2.5m forward against ctx.pickups.list, E to take
    combat.ts             — LMB → swept-capsule castShape → damageRaider
    viewModel.ts          — first-person hands + held item; copies camera pose each frame; observes selectedIdx + equipped item for swap + UI sounds
  stats/
    survival.ts           — thirst/two-way-temperature/hunger/health drain, shelter modifier, storm modifier, die() (stamina ticks in controller.ts)
  inventory/
    types.ts              — ItemId/ItemDef/Slot+meta/InventoryState{slots,backpack,selectedIdx,hover}/HoverState{type,promptNoun}/InteractType (cook/add_fuel/sleep/relight added)/ItemMeta{fillLevel,cookState}
    items.ts              — 12 items: canteen, scrap, bandage, machete, cactus_pulp, cooked_cactus_pulp, raw_lizard_meat, cooked_lizard_meat, branch, cloth, fire_kit, tent_kit. onUse(ctx, slot). fire_kit/tent_kit onUse spawns the entity.
    inventory.ts          — addItem (auto-overflows to backpack; returns 100+i for backpack slots), countItems / removeItems (walk both arrays; skip slots w/ meta), useSelected → onUse(ctx,slot), dropSelected (G), don't auto-stack with meta, hotbar 1-4/wheel/Q + C (craft) + I (inv overlay) + G (drop)
  pickups/
    pickups.ts            — spawnCanteens, spawnBranches, spawnDroppedPickup (generic — reuses item makeViewModel scaled 1.5×), bobPickups (sin Y), findPickupById, despawnPickup
  enemies/
    raider.ts             — hooded primitive + AI state machine + sight raycast cache (0.5s)
    lizard.ts             — small primitive critter; 3-state AI (idle/flee/dead); kill with machete → raw_lizard_meat
  shelter/
    shelterZones.ts       — AABB registry + per-frame point-in-box check → ctx.player.inShelter; addShelterZone returns zone ref; removeShelterZone splices by identity (used by fires on burnout)
  audio/
    audio.ts              — Web Audio context, master/sfx/ambient gains, playFootstep/Pickup/Drink/Swing/Hit/Death/UiHover/UiClick/InventorySelect/Equip/Pour/Refill/Harvest/LizardSquish/FireIgnite/FireCrackle/CookSizzle/SleepThud/Craft/Drop/PlayerHurt
    soundscape.ts         — wind loop (filtered noise + LFO wobble) modulated by night + storm
  ui/
    hud.ts                — 5 stat bars (thirst/hunger/two-way-temperature/stamina/health) + clock + day counter + toast + death screen + days-survived summary + damage vignette + shelter indicator
    hotbar.ts             — 4 slots bottom-center, keybind/SVG icon/count/canteen-fill-bar, diff-render (tracks fillLevel too)
    interactPrompt.ts     — "[E] <verb> <noun>" under crosshair — verb table indexed by HoverState.type
    menus.ts              — start overlay extras + pause overlay + settings panel + localStorage; exports resumeFromPause for lootMenu / sleepOverlay / craftingMenu / inventoryOverlay
    lootMenu.ts           — overlay shown when player searches a loot container; clickable item rows; pauses game while open
    sleepOverlay.ts       — choose 4h/8h sleep; advances dayTime + applies stat scale + wraps day counter
    craftingMenu.ts       — C key; 3 recipes (bandage / fire_kit / tent_kit); 1s rAF progress bar; ingredients consumed only on completion
    inventoryOverlay.ts   — I key; hotbar + 10-slot backpack grids; click-then-click swap between any two slots
    perfHud.ts            — dev-only F1 overlay (FPS / draws / tris)
    tutorial.ts           — first-boot controls panel + H-key reopen + per-item pickup hints (localStorage `dustfall.tutorial.v1`)
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
   updateLizards → updateFires → updateInteraction → updateInventoryInput →
   updateCombat → updateViewModel → updateHud → updateHotbar →
   updateInteractPrompt → updatePhysicsDebug → updatePerfHud → endInputFrame
   ```
   `updateViewModel` runs after `updateCombat` so a fresh LMB swing can be picked up the same frame. `updateLizards` runs before `updateInteraction` so the dead-lizard tag transitions are visible to the hover raycast that same frame. `updateFires` runs before `updateInteraction` so burnout-driven untag is observed by the raycast that frame.
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

### Perf testing

For final-release FPS testing, use `npm run build && npm run preview` instead of `npm run dev`. Dev mode is unminified + serves uncompressed ES modules, which can add JS overhead. For a low-poly WebGL scene the GPU usually dominates (rendering is the bottleneck, not JS), but the production build rules out dev-mode overhead. The F1 perf HUD (dev-only) shows GPU name, framebuffer resolution, render scale, and a GPU/CPU/frame-time breakdown.

### Diagnosing low FPS

**CRITICAL — software-rendering fallback.** If the F1 HUD's `GPU` row says `ANGLE (Microsoft, Microsoft Basic Render Driver)`, `WARP`, or `SwiftShader` (the perf HUD will color it red automatically), **Chrome is rendering on the CPU** — every pixel is being drawn in software, not by your GPU. Even an RTX 3080 will look like a potato at 4K. Fix path:

1. Open `chrome://gpu`. Look for **"WebGL: Hardware accelerated"** at the top of "Graphics Feature Status". If it says "Software only" or "Disabled", that's the issue.
2. **Chrome's GPU process** may have crashed and fallen back to WARP. Restart Chrome **fully** (close all windows; in Task Manager confirm no `chrome.exe` processes remain; reopen).
3. If still software-only: Chrome settings → "System" → toggle **"Use hardware acceleration when available"** off → restart → toggle on → restart.
4. **Windows Settings → System → Display → Graphics** → "Browse", find the browser `.exe`, "Options" → set **"High performance"**. Forces discrete GPU on Optimus laptops.
5. **NVIDIA Control Panel → Manage 3D settings → Program Settings** → add the browser → "Preferred graphics processor" = "High-performance NVIDIA processor".
6. **Update GPU drivers.** Clean-install from nvidia.com (not GeForce Experience) — recent driver releases have broken Chrome WebGL multiple times.
7. **Try Edge.** Same Chromium engine but a separate GPU process; reveals whether the bug is Chrome-specific.

Once hardware acceleration is confirmed (GPU row shows your actual card), FPS should jump dramatically (often 10–30×). After that, finer tuning:

1. **`npm run build && npm run preview`** — rules out Vite dev-mode JS overhead.
2. **F1 perf HUD `GPU ms` row** — if >12ms you're GPU-bound (turn shadows off, drop render quality). If `GPU ms` is low but `CPU ms` is high, you're JS-bound (Chrome DevTools → Performance tab → record 5s → find the heaviest function in the flame graph).
3. **Settings panel → shadows OFF** — typically doubles FPS at low cost to atmosphere. Try this first if GPU-bound.
4. **Render quality → Low** — drops pixel ratio + shadow map. Most useful on 4K monitors at devicePixelRatio=2.

**About engine migration**: Three.js with hardware acceleration is comfortably capable of this game's complexity at 60+ FPS. If FPS is bad with HW accel on, the bottleneck is in the scene (shadow casters, draw calls, fillrate) — not the engine. Don't migrate to a native engine (Godot, Bevy, Unity) on FPS evidence until HW acceleration is verified and the in-game perf tools (shadow toggle, render scale) have been tried. Electron/Tauri use the same Chromium → ANGLE → D3D11 pipeline as the browser — no FPS gain.

### Tutorial flags (Session L)

`localStorage['dustfall.tutorial.v1']` stores `{seenIntro, usedItems}`. Wipe via the console with `__game.resetTutorial()` (or delete the key + refresh) to see the first-boot panel + all pickup hints again. `__game.showControls()` opens the controls panel without changing flags.

## Sessions complete

- **v0** — 1-hour prototype (flat sand, primitive landmarks, click-to-play)
- **A** — Module refactor + Rapier physics + collisions
- **B** — Terrain dunes (simplex heightmap + heightfield collider) + improved primitives + 4 hero landmark types (ribcage, truck, tower, obelisk)
- **B.5** — Lighting + shadows (PCFSoft, follow-player shadow camera) + visible sun disc + gradient sky shader + brighter mid-day + wreckage / mesa / canteen polish
- **C** — Inventory + look-at raycast + hotbar UI + interact prompt + shelter zones + procedural audio (wind / footsteps / pickup / drink)
- **D** — Raider enemy (primitive hooded wanderer + 6-state AI) + LMB combat (swept-capsule castShape) + sandstorm weather + main menu + pause + settings panel + localStorage persistence
- **H** — Performance pass: InstancedMesh for 134 rocks/trunks (14 pools), distant-shadow culling (76 landmarks marked far), raider sight raycast cached (0.5s), F1 perf HUD overlay (FPS/draws/tris)
- **E** — First-person viewmodel (hands + held item, camera-tracking Group, depthTest=false so walls don't clip), procedural per-item use animations (canteen 1.2s drink-tilt, machete 0.4s thrust, bandage 0.8s rise), SVG hotbar icons replacing single-char glyphs, 5 new procedural UI sounds (UiHover/UiClick/InventorySelect/Equip/Pour) wired to menus + viewmodel observer
- **F** — Realism overhaul: stats expanded to 5 (added hunger + stamina + two-way temperature replacing heat); canteen became a refillable container via `Slot.meta.fillLevel` + `onUse(ctx, slot)` signature change; 4 new world systems (water sources / cacti / lizards / loot containers); interaction system rewritten for multi-type hover dispatch (`take`/`refill`/`search`/`harvest`/`kill`); loot menu UI; 4 new items (cactus_pulp, raw_lizard_meat + cooked variants for Session G); 3 new procedural sounds (refill/harvest/lizard squish)
- **G** — Fire / tents / sleep / crafting / day counter: 4 new items (branch / cloth / fire_kit / tent_kit); 30 branches scatter as pickups + cloth in loot tables; placeable fire (deployFire) with fuel + flicker + shelter zone + cooking interaction (raw → cooked via 0.6s timer) + add_fuel; placeable tent (deployTent) + sleep overlay (4h/8h advance dayTime + scaled stat changes); crafting menu (C key, 3 recipes: bandage / fire_kit / tent_kit); day counter ("day N") wraps on midnight; 5 new procedural sounds (fire ignite/crackle, cook sizzle, sleep thud, craft)
- **I** — Inventory & feel polish: Space jumps (Tuning.JUMP_VELOCITY=7); G drops the selected slot as a Pickup (meta preserved); 10-slot backpack + I-key overlay (click-then-click swap); pickups auto-overflow into backpack; canteen fillLevel rendered as thin bar on hotbar + backpack tiles; raider hits trigger red damage vignette + playPlayerHurt sfx; dead fires can be relit with a branch (`'relight'` InteractType + relightFire()); crafting has a 1s progress bar (rAF-driven); death screen shows "you survived N days"
- **J** — Performance investigation + graphics quality: F1 perf HUD now shows GPU name (via `WEBGL_debug_renderer_info`), framebuffer resolution, and live render scale; new `renderQuality: 'low' | 'medium' | 'high'` setting persists to localStorage; preset live-applies pixel ratio (0.75 / 1.0 / min(devicePR, 2.0)) + shadow map size (1024 / 2048 / 2048) with no reload; settings panel adds a "render quality" dropdown row
- **K** — FPS diagnostics + shadow toggle + sandstorm gate. Triggered by 17-30 FPS reports where Chrome had fallen back to WARP software rendering. F1 HUD gains `GPU ms` / `CPU ms` / `frame` ms rows via `EXT_disjoint_timer_query_webgl2`; SW-render warning automatically flags WARP/SwiftShader/Microsoft Basic Render. Shadow on/off setting (`sun.castShadow`) live-applies — typically 1.5-2× FPS gain when GPU-bound. Pickups + branches no longer cast shadows. Sandstorm Points hidden when intensity ≤ 0.01. CLAUDE.md gains a "Diagnosing low FPS" section that leads with the WARP fallback fix.
- **L** — Tutorial & first-time UX. New `src/ui/tutorial.ts` owns: a first-boot controls panel (14 keybind rows incl. WASD/SHIFT/SPACE/MOUSE/LMB/Q/E/G/1-4/WHEEL/C/I/ESC/H/F1) shown above the start overlay until the player clicks to begin; an H-key shortcut to reopen it in-game (which unlocks pointer → pauses → panel renders above the pause overlay at z-index 200); per-item pickup hints fired by `inventory.addItem(...,ctx)` (canteen/branch/cloth/scrap/bandage/machete/fire_kit/tent_kit/cactus_pulp/raw_lizard_meat — each toast fires once across sessions). State persists in localStorage key `dustfall.tutorial.v1`; debug helpers `__game.resetTutorial()` + `__game.showControls()` for testing/screenshotting.

## Where we are now

**Last completed**: Session L (tutorial + first-time UX). `tsc --noEmit` clean. Verified: first-boot panel renders above start overlay (z=200, all 14 control rows present); H key toggles open↔hidden; `noteIntroSeen()` hides panel + writes `{seenIntro:true,usedItems:[]}` to localStorage on first pointer lock; `maybeShowItemHint(ctx,'cloth')` fires a 900ms-delayed toast "press C to open the crafting menu" and persists the item id; second call is a no-op; `resetTutorial()` wipes the localStorage key; `__game.showControls()` reopens the panel. Interaction raycasts suppressed when `isControlsPanelOpen()` is true.

**Next**: Roadmap (sessions M–R) lives in `~/.claude/plans/in-the-dustfall-folder-elegant-cray.md`. Near-term candidates: M save/load (localStorage snapshot), N rigged Quaternius raider, O enemy variety + warlord-camp win condition. Larger: P world design pass (sub-biomes + POIs), Q models/animations upgrade, R additional loops (trading / base-building / vehicle / 7-day countdown / bounties).

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
