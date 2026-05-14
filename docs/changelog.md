# Changelog

2–4 lines per shipped session. Latest at top. Full plans archived at
`.claude/plans/archive/`.

## Session W — 2026-05-14 — Opening scene + world detail
Cinematic intro on fresh worlds (gated by `!hasSave()`): 30-s sandstorm,
hand-authored crashed-shelter wreck (rectangular box-walls — NOT the broken
half-cylinder first cut), skeleton slumped against back wall with journal at
fingertips opening a modal lore panel. Skylight hole in roof + emissive sun-
patch on floor. Bundled: 12 dead trees clustering branch pickups (replaces
random scatter), alien-cactus variant yielding new `alien_fruit`. Storm
aggression rebuilt: dust particles use a circular gradient map (no more
pixel squares), velocities 6 m/s, sky lerps 95% to dust, fog `near`+`far`
BOTH move with intensity (math inversion bug — `fog.far < fog.near`
painted everything fog color — fixed). Wreck oriented so entrance faces
spawn, sits on flattest 5×5 patch within 20 m. `partially verified` (DOM
+ scene checks via preview_eval; screenshots timed out).

## Session V — 2026-05-13 — Atmosphere + audio placeholder
Night sky: moon sprite opposite the sun, 800-point star field, 4-line
shooting-star pool, distant reddish-planet sprite anchored on the eastern
horizon. New ambient-dust system (toned-down storm cousin) suppressed when
storm > 0.15 or `player.inShelter`. Built a procedural music module (drone
pad + pentatonic plucks + feedback-delay reverb + storm sub-bass) then
DISABLED IT entirely — vibe wasn't right and a full audio overhaul is
deferred (D14). Wind layer also disabled. `partially verified` (scene +
audio-context unlock confirmed; screenshot timed out).

## Session U — 2026-05-13 — UX & tuning pass + empty the world
Removed spawned raider at boot (code path stays — D13). Window-listener
Ctrl+W/A/S/D/Q `preventDefault` so the browser doesn't intercept (Ctrl-W
was closing the tab mid-playtest). `I`/`C` now TOGGLE (open AND close)
inventory + crafting overlays via a new window-keydown handler in input.ts
— the polling in updateInventoryInput early-returned while paused. Hover
tooltips via `root.title` on hotbar + inventory tiles. Lizard `FLEE_SPEED`
3.0→2.5; `DAY_LENGTH_SECONDS` 360→480. `verified` via synthetic keydown +
DOM inspection.

## Session N — 2026-05-13 — Rigged raider visual + animation infra
Per-instance `AnimationMixer`, fuzzy clip resolver (Quaternius packs name
clips wildly — substring match against `idle/walk/run/attack/die`),
crossfade helper. New `Raider.rig` field; bladeArm tween becomes
primitive-only. Primitive fallback path exercised end-to-end. The rigged
GLB at `public/models/quaternius/raider.glb` is intentionally NOT shipped
— user deferred asset work; code activates the rigged path automatically
when the file lands. `partially verified` (primitive path; rigged path
unverified pending asset).

## Session M — 2026-05-14 — Save / load
NEW `src/persistence/save.ts`. Single-slot `localStorage['dustfall.save.v1']`,
seed-stamped (mismatch refused with toast). Sleep autosave + manual pause-menu
Save. **No death autosave**: Continue from last save on death overlay only
when a save exists, else Main Menu. New-game-while-save confirm prompt.

## Session Q — 2026-05-13 — Camera bob + footsteps + ease curves
Viewmodel Y-bob phase-locked to footfall cadence; idle breath fades in below
0.5 m/s. 4 procedural footstep variants (sand/rock/salt/wet) dispatched via
`biomeAt()` + 2m water proximity. New `src/core/ease.ts` (`easeOutBack`,
`easeInOutCubic`, `easeOutQuad`); canteen/bandage/machete use-anims swapped.

## Session T — 2026-05-13 — Salvage gameplay
Every wreck (hero landmarks + massive POIs) becomes a finite salvage source.
NEW `src/world/salvage.ts`: registry, loot tables per `WreckKind`,
1.5s salvage timer mirroring the cooking pattern, `markSalvageStripped()`
desaturation walk on depletion. 14 salvageables registered.

## Session S — 2026-05-13 — Sci-fi pivot + ship wrecks
Tonal pivot to Jakku-flavored scavenger desert. NEW `src/world/wrecks.ts`
(6 wreck-type registry: engine cluster / fuselage / escape pod / cargo /
antenna / engine bell). Massive POI hulls + debris fields. Hero landmarks
+ POIs rerouted to wreck registry; monolith dropped.

## Session P — 2026-05-13 — Barren-desert pass
Realistic ridged + wind-warped dunes; biome map (dune / rocky / salt);
per-vertex terrain tinting; ring of 22 perimeter mountains as horizon
silhouettes; 4 hand-placed POIs (monolith, abandoned camp, watchtower,
ribcage cluster). Scattered rocks/logs/crates/truck-wreck removed.

## Session L — v1.5 — Tutorial & first-time UX
NEW `src/ui/tutorial.ts`. First-boot controls panel (14 keybind rows) +
H-key reopen. Per-item pickup hints fire once across sessions via
`localStorage['dustfall.tutorial.v1']`. Debug: `__game.resetTutorial()`,
`__game.showControls()`.

## Session K — v1.5 — FPS diagnostics + shadow toggle
F1 HUD: GPU ms / CPU ms / frame ms via `EXT_disjoint_timer_query_webgl2`.
SW-render warning (WARP / SwiftShader / MS Basic). Shadow on/off setting
live-applies. Pickups + branches no longer cast shadows. Sandstorm Points
hidden when intensity ≤ 0.01.

## Session J — v1.5 — Performance + graphics quality preset
F1 HUD shows GPU name (`WEBGL_debug_renderer_info`), framebuffer res, render
scale. New `renderQuality: 'low' | 'medium' | 'high'` setting (persists to
localStorage) live-applies pixel ratio + shadow map size with no reload.

## Session I — v1.5 — Inventory & feel polish
Space jumps; G drops selected slot as a Pickup (meta preserved); 10-slot
backpack + I-key overlay (click-then-click swap); pickups auto-overflow into
backpack; canteen fillLevel as hotbar/backpack bar; raider hits trigger red
damage vignette + hurt sfx; dead fires relight with a branch; 1s craft
progress bar; death screen "you survived N days".

## Session H — v1.5 — Performance pass
InstancedMesh for 134 rocks/trunks (14 pools). Distant-shadow culling: 76
landmarks marked `userData.farFromOrigin`. Raider sight raycast cached
(0.5s). F1 perf HUD overlay (FPS / draws / tris).

## Session G — v1.5 — Fire / tents / sleep / crafting / day counter
4 new items: branch / cloth / fire_kit / tent_kit. Placeable fire
(`deployFire`, fuel + flicker + shelter zone + cooking + add_fuel),
placeable tent + sleep overlay (4h/8h advances dayTime + stat scale).
Crafting menu (C key, 3 recipes). Day counter. 5 new procedural sounds.

## Session F — v1.5 — Realism overhaul
Stats expanded to 5 (added hunger + stamina + two-way temperature replacing
heat). Canteen refillable via `Slot.meta.fillLevel`; `onUse(ctx, slot)`.
4 new world systems (water sources / cacti / lizards / loot containers).
Multi-type hover dispatch (`take` / `refill` / `search` / `harvest` / `kill`).

## Session E — v1.5 — First-person viewmodel
Hands + held item as a camera-tracking Group with `depthTest=false`.
Per-item use animations: canteen 1.2s drink-tilt, machete 0.4s thrust,
bandage 0.8s rise. SVG hotbar icons replace single-char glyphs. 5 new
procedural UI sounds.

## Session D — v1 — Raider + sandstorm + menus + persistence
Raider enemy (primitive hooded wanderer + 6-state AI). LMB combat via
swept-capsule `castShape` → `damageRaider`. Sandstorm weather. Main menu
+ pause + settings panel. `localStorage` persistence for settings.

## Session C — v1 — Inventory + look-at + shelter + audio
Inventory + look-at raycast + hotbar UI + interact prompt. Shelter zones
(AABB registry). Procedural Web Audio (wind / footsteps / pickup / drink).

## Session B.5 — v1 — Lighting + shadows + sky
PCFSoft shadows + follow-player shadow camera. Visible sun disc. Gradient
sky shader. Mid-day brighter. Wreckage / mesa / canteen polish.

## Session B — v1 — Terrain + hero landmarks
Simplex heightmap + heightfield collider. Improved primitives. 4 hero
landmark types: ribcage / truck / tower / obelisk (truck removed in P).

## Session A — v1 — Module refactor + Rapier
Single-file prototype split into systems. Rapier physics + collisions.
Kinematic character controller capsule.

## Session v0 — 1-hour prototype
Flat sand, primitive landmarks, click-to-play.
