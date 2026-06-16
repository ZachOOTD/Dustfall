# Dustfall — architecture reference

Detailed file map, footguns, FPS-debug path, and full session history. CLAUDE.md links here so the auto-loaded summary stays small. Read this on demand.

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
    gpuTimer.ts           — EXT_disjoint_timer_query_webgl2 wrapper; lastMs (-1 if unsupported)
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
    waterSources.ts       — stone-ring + wooden-hatch wells; salt-flats biome ONLY (Session Z); refill canteens via E
    cactus.ts             — saguaro scatter; harvest E → cactus_pulp
    lootContainers.ts     — standalone crates with rolled contents; spawn + tag
    fire.ts               — placeable fire (deployFire); flicker + fuelSeconds + shelter zone + cook/add_fuel interactions
    tent.ts               — placeable tent (deployTent); shelter zone + sleep interactable
    footprints.ts         — InstancedMesh decal pools (player + lizard). Canvas-drawn textures; per-instance opacity via onBeforeCompile shader patch; smoothstep fade over FOOTPRINT_LIFETIME_S.
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
    soundscape.ts         — sample-stem orchestrator: 3-way wind (calm/mid/storm), day/night ambient beds, calm+tense music. Crossfaded by weather.intensity + sunHeight. Procedural drift for breeze variation.
    samples.ts            — tolerant loader. Fetches OGG stems from `/public/audio/` + decodeAudioData; missing files degrade to silence.
  ui/
    hud.ts                — 5 stat bars (thirst/hunger/two-way-temperature/stamina/health) + clock + day counter + toast + death screen + days-survived summary + damage vignette + shelter indicator
    hotbar.ts             — 4 slots bottom-center, keybind/SVG icon/count/canteen-fill-bar, diff-render (tracks fillLevel too)
    interactPrompt.ts     — "[E] <verb> <noun>" under crosshair — verb table indexed by HoverState.type
    menus.ts              — start overlay extras + pause overlay + settings panel + localStorage; exports resumeFromPause for lootMenu / sleepOverlay / craftingMenu / inventoryOverlay
    lootMenu.ts           — overlay shown when player searches a loot container; clickable item rows; pauses game while open
    sleepOverlay.ts       — choose 4h/8h sleep; advances dayTime + applies stat scale + wraps day counter
    craftingMenu.ts       — C key; 3 recipes (bandage / fire_kit / tent_kit); 1s rAF progress bar; ingredients consumed only on completion
    inventoryOverlay.ts   — I key; hotbar + 10-slot backpack grids; click-then-click swap between any two slots
    perfHud.ts            — dev-only F1 overlay (FPS / draws / tris / GPU ms / CPU ms / frame)
    tutorial.ts           — first-boot controls panel + H-key reopen + per-item pickup hints (localStorage `dustfall.tutorial.v1`)
  debug/
    debugPanel.ts         — window.__game = { setTime, setStats, state, castDown, RAPIER, triggerStorm, resetTutorial, showControls }
```

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
- **Salvage-panel placement (ACAV).** Panels mount via `world/panelPlacement.ts` `findSurfaceMounts` (bounding-sphere inward rays read the REAL hull surface — any shape — + a full quaternion → flush) and are validated/culled by the ONE `validatePanels` (occlusion + surface-terrain). `world/panelGreeble.ts` builds the scrappy interior. Footguns: (1) any per-panel placement search must keep a FIXED `rand` budget — the procgen world runs off one seeded stream (D208/D213). (2) terrain-cull is SURFACE-scoped, never global (interior panels — mega-wreck/rockyEntrance/flagship bells — are legitimately below terrain, D212). (3) the circle lift-off cover + the door-swing reuse the SAME `-panelDoorAngle` hinge math; name any new cover pivot `panelDoor` so the bury-audit/prune door-exclusion + `completePry` apply. (4) **CONTRACT — any new wreck CLASS or hand-modeled flagship must pass `npm run verify:placement` (0 bury-audit fails across the seed sweep) before shipping**; that one gate is the scalability guarantee that a future wreck-model change didn't bury panels. (5) **Stencil-portal interior (ACAX, `world/panelPortal.ts`).** A recessed cavity can clip into the hull and be occluded; the interior is rendered as a "window into the hull" instead — a per-panel MASK mesh at the opening writes `stencil=REF`, and the interior materials (the `_panel*` extractables in `wrecks.ts` + ALL of `panelGreeble.ts`) draw with `stencilFunc EQUAL` + `depthTest:false` + `transparent:true` so they show THROUGH a clipping hull but stay confined to the mouth. **The renderer MUST be built with `{ stencil: true }`** (`core/scene.ts`) or there's no stencil buffer. The mask `.visible` is toggled by `updatePanelDoors` once the door swings >45% clear. Making those interior materials transparent is a DELIBERATE, bounded +5 shader programs (67→72) — accepted because the alternative (a separate masked clear-depth pass) costs a per-frame full-scene re-traversal; keep interior materials SHARED singletons so it stays +5, not per-panel. renderOrder bands (backplate < greeble < extractables) order the depth layers since depthTest is off. (6) **Archetype fallback (ACAX).** The V2 scrappy interior triggers on `opts.archetype`; 14 of 16 hand-modeled/POI callsites omit it, so `addAccessPanel` now DERIVES one from `kind` via `archetypeForKind()` (procgen's explicit archetype still wins). Don't gate interior logic on `opts.archetype` directly — use the resolved `archetype` local. The greeble `rand` falls back to a position-seeded stream (hand-modeled wrecks aren't in the procgen rand stream → D208-safe). (7) **Interior visibility gating (ACAX, perf).** The cavity interior group is `.visible=false` by default; `updatePanelDoors` shows it only when the door is >45% open (the only time it reads through the portal). This SKIPS every closed panel's ~10 greeble draw calls — the common case — so the rich interiors are nearly free at rest (the transparent portal programs also only compile on first open, so the probe reads 70 closed / 72 with one open). Any new panel-open path must set `panelInterior.visible` (the studio force-open does). (8) **Panel exterior is DOUBLE-SIDED (ACAX).** The body box is `DoubleSide` (was BackSide) so its outer side walls render — a BackSide body culled them, making the recess look like it floated unconnected to the hull. The portal handles the front face no longer occluding the open cavity. Door/body/rim use `createMetalMaterial` (rusted, `localSpace` so weathering doesn't crawl as the door swings).

## Perf testing

For final-release FPS testing, use `npm run build && npm run preview` instead of `npm run dev`. Dev mode is unminified + serves uncompressed ES modules, which can add JS overhead. For a low-poly WebGL scene the GPU usually dominates (rendering is the bottleneck, not JS), but the production build rules out dev-mode overhead. The F1 perf HUD (dev-only) shows GPU name, framebuffer resolution, render scale, and a GPU/CPU/frame-time breakdown.

## Diagnosing low FPS

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

## Sessions complete

For full session history see [changelog.md](changelog.md).
