# Changelog

2–4 lines per shipped session. Latest at top. Full plans archived at
`.claude/plans/archive/`.

## Session BB-3 — 2026-05-15 — Mega-wreck verticality + detail pass
3 catwalks (Y=3/7/11m) + 3 ramps inside aft bay. NEW dark side room
(Chamber 3) off aft +X wall via doorway in refactored aft right wall.
3 skylights via roof-strip `panelWithHole` replacement (3 strip panels,
each with one hole). Bow gets a small ragged +X side opening for side-
light. 6 more salvage panels (catwalks + side room + 2 engine bells +
antenna spire requiring tower climb via debris-pile steps). Interior
detail pass (ceiling pipes, wall conduits, broken consoles, hull-plate
fragments). Exterior detail pass (seams, rust streaks/patches, exterior
pipes, vents, broken antenna stubs). `placeDebrisField` (50m radius ×
40 pieces) + 3 companion wrecks (fuselage + engine_cluster + escape_pod)
at 30-60m offsets. 1049 total scene meshes, FPS 143. `verified` (tsc +
preview screenshots of skylight-lit bay, dark side room, engine bells
silhouetted against moon, antenna spire visible from spawn).

## Session BB-2 — 2026-05-15 — Mega-wreck shell (Jakku-scale, 120m)
NEW `src/world/megaWreck.ts` — TRULY mega-scale crashed ship at
(-180, -130) in SW quadrant (drifted to (-180, -190) by flat-spot
search). 3 hull sections (bow 35m + open mid-hull break + aft 60m) + 12m
bridge tower + 2 ten-meter engine bells. Bow lives in a named 'bow'
sub-group with runtime Y-offset anchored to terrain at the ENTRANCE
position — needed because at 120m length terrain varies 12m+ across
the footprint, so a static `BOW_ORIGIN_Y` like the archived plan
suggested would push the entrance below terrain (D29). Widened
flat-spot search to 9×9 at 15m spacing × radii up to 60m, tilt cap
0.10 rad, `BOW_ENTRANCE_H` bumped to 4m for slack. 2 salvage panels
(aft + bow), shelter zone over aft bay. POI registered in
[src/world/poi.ts](src/world/poi.ts) with a new `terrainVarAtWide`
helper. `verified` (tsc + screenshots + state checks for biome,
clearance, salvageables, inShelter).

## Session BB — 2026-05-15 — Mega-ship POI (enterable wreck v1) + mega-wreck plan
NEW `src/world/megaShip.ts` — a ~12m enterable wreck in central dunes
(-120, 30). Extracted `panelWithHole` to shared `src/world/panelUtils.ts`.
Multi-iteration session: started boxy, ended as a detailed rusty sci-fi
crashed cargo hauler — 111 meshes incl. 2 chambers split by bulkhead, side
entrance, **sand-reclaimed floor** (no floor mesh; terrain serves), walls
extending 2m below origin (no slope gaps), terrain-normal tilt for crashed
feel, segmented bridge cone w/ viewport, engine bell + antenna masts +
wing fins + exterior pipes/vents/seams/rust + interior ceiling pipes +
wall conduits + broken hull plates around entrance. 3 salvage panels
(massive×2 + engine_bell). Also authored a detailed BB-2/BB-3 plan for a
TRULY mega-scale crashed ship (120m, Force Awakens Jakku scale) — see
archived plan. `verified` (tsc + multiple screenshots).

## Session AA — 2026-05-14 — Torch/flashlight + opening-scene rebuild
NEW `torch` (consumable, 3-min burn, warm PointLight + flicker) and
`flashlight` (rechargeable, drains while lit, cool SpotLight) items + craft
recipes + salvage drops + `ItemDef.updateHeld` per-frame hook. Opening
wreck rebuilt: removed floor sun-patch + rust patches, brightened tally
marks (Y=1.30), pierced REAL geometry holes in side walls + roof + back
wall via new `panelWithHole` helper, replaced back roof with a translucent
canvas TARP (emissive + `noShadow`), fixed pre-existing roof rotation
inversion that had the apex BELOW the wall tops (Session W bug). Opening
scene: no boot storm, wreck moved to central dunes (-50,0,0) via empirical
biome+POI scan, yaw forced to π/2 (back wall faces east), player
teleported relative to wreck post-placement. First-frame view is now the
wreck silhouetted against the rising sun with the back-wall window
glowing. `verified` (tsc + multiple screenshots).

## Session Z — 2026-05-14 — Stone-well rework + tactile salvage panels
Two threads. (1) `makeWell` rewritten: ring of 9 perturbed icosahedron stones
(alternating light/dark palette) + askew 5-plank wooden hatch with cross-brace.
`spawnWaterSources` now hard-requires salt biome (no quota fallback; unplaceable
wells silently drop). 5/5 wells land in salt. (2) New `addAccessPanel` helper
in `wrecks.ts` adds a small dark plate + brass rim + stub handle to every wreck
at a kind-specific local offset. `Salvageable` gains a `panel` field; salvage
interact tag moves from the wreck root to the panel mesh only, so players aim
at the panel directly. POI custom hulls (engine_block, crashed_hull) forward
the inner wreck's panel ref to the parent group. `partially verified` (tsc +
state checks + well screenshot; panel-on-wreck screenshot blocked by paused-tick
lighting).

## Session Y — 2026-05-14 — Footprints + lizard tracks
NEW `src/world/footprints.ts` — InstancedMesh pools per kind (player ×200,
lizard ×240). Canvas-drawn alpha-mask textures (toe+heel double oval for
player, three-streak claw mark for lizard) — zero asset files. Per-instance
opacity via `onBeforeCompile` shader patch on MeshBasicMaterial: 1 draw
call per kind yet independent fades. Player decals hook the existing
`_stepAccum` cadence in `controller.ts` with L/R parity offset (±0.16m
perpendicular, ±6° toe-out); lizard decals fire every 0.30m of flee-state
travel in `lizard.ts`. Both skip rocky biome. 12s smoothstep tail; 45s
total lifetime. Round-robin pool recycling. `partially verified` (tsc +
spawn writes + fade math + decal screenshots; controller cadence path
unexercised due to preview pointer-lock + rAF throttling).

## Session X — 2026-05-14 — Audio overhaul (sample-stem architecture)
Replaced V/W procedural drone+pluck+bandpass-wind with sample-stem orchestrator.
NEW `src/audio/samples.ts` (tolerant fetch+decodeAudioData; missing files log
warning + null). REWRITE `src/audio/soundscape.ts`: 7 stems (calm/mid/storm
wind, day/night ambient beds, calm/tense music) crossfaded via smoothstep on
weather.intensity + sunHeight + slow procedural breeze drift. Music bus 4s
fade-in. DELETED `src/audio/music.ts`. New `__game.audioState()` debug hook.
Files intentionally NOT shipped — `public/audio/` empty, code activates as
each .ogg lands (Session N precedent). `partially verified` (tsc + signal
math + graceful-degradation path confirmed via preview_eval; audible test
deferred to when files arrive).

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
