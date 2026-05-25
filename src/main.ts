// Dustfall — orchestrator. Each system lives in its own module.

import './style.css';
import * as THREE from 'three';
import type { GameContext } from './GameContext.ts';
import { Tuning } from './config/tuning.ts';
import { makeRng } from './core/rng.ts';
import { createScene } from './core/scene.ts';
import { createLights, updateLighting } from './core/lighting.ts';
import { createLightPool } from './core/lightPool.ts';
import { createInput, wireOverlays, endInputFrame } from './core/input.ts';
import { startLoop } from './core/loop.ts';
import { createPhysicsWorld } from './physics/world.ts';
import { makePlayer } from './physics/bodies.ts';
import { installPhysicsDebug, updatePhysicsDebug } from './physics/debug.ts';
import { preloadAssets } from './assets/loader.ts';
import { createTerrain } from './world/terrain.ts';
import { createBiomeSampler } from './world/biomes.ts';
import { placePOIs, getAnchorPOIPositions } from './world/poi.ts';
import { placeProcgenPOIs } from './world/procgenPoi.ts';
import { placeHeroLandmarks } from './world/heroLandmarks.ts';
import { createSalvageableRegistry, setSalvageBiomesContext } from './world/salvage.ts';
import { createSky, updateSky } from './world/sky.ts';
import { updateStats } from './stats/survival.ts';
import { createHud, updateHud } from './ui/hud.ts';
import { createHotbar, updateHotbar } from './ui/hotbar.ts';
import { createInteractPrompt, updateInteractPrompt } from './ui/interactPrompt.ts';
import { spawnBranches, updatePickups } from './pickups/pickups.ts';
import { spawnDeadTrees } from './world/deadTree.ts';
import { spawnRockScatter } from './world/rockScatter.ts';
import { setupOpeningScene } from './world/openingScene.ts';
import { updateOpeningWreckGodRay } from './world/openingWreck.ts';
import { updateLanterns } from './world/lantern.ts';
import { updateLargeTents } from './world/largeTent.ts';
import { updateCompanion, spawnCompanionAt } from './enemies/companion.ts';
import { createFootprintPuffs, updateFootprintPuffs } from './world/footprintPuffs.ts';
import { hasSave } from './persistence/save.ts';
import { createJournalPanel } from './ui/journalPanel.ts';
import { createRecipeBookPanel } from './ui/recipeBookPanel.ts';
import type { Journal } from './world/journal.ts';
import { createInventory, updateInventoryInput } from './inventory/inventory.ts';
import { updateInteraction } from './player/interaction.ts';
import { updatePlayer } from './player/controller.ts';
import { createShelterRegistry, updateShelter } from './shelter/shelterZones.ts';
import { updateSoundscape } from './audio/soundscape.ts';
import { startMusic, updateMusic } from './audio/music.ts';
import { updateRaiders, type Raider } from './enemies/raider.ts';
import { spawnLizardsProcgen, updateLizards } from './enemies/lizard.ts';
import { spawnSandWorm, sampleSandwormHome, updateSandWorm } from './enemies/sandWorm.ts';
import { updateWieldAction } from './player/wieldAction.ts';
import { updateReload } from './player/combat.ts';
import { createGhostPreview, updateGhostPreview } from './player/ghostPreview.ts';
import { createViewModel, updateViewModel } from './player/viewModel.ts';
import { buildPlayerRig, updatePlayerRig } from './player/playerRig.ts';
import { createWeather, updateWeather } from './world/weather.ts';
import { createAmbientDust, updateAmbientDust } from './world/ambientDust.ts';
import { createDustMotes, updateDustMotes } from './world/dustMotes.ts';
import { updateTerrainShaderUniforms } from './world/terrainMaterial.ts';
import { updateFabricShaderUniforms } from './world/fabricMaterial.ts';
import { createStormVignette, updateStormVignette } from './world/stormVignette.ts';
import { createStatVignette, updateStatVignette } from './ui/statVignette.ts';
import { updateStaminaWobble } from './player/staminaWobble.ts';
import { updateSpeeder } from './world/speeder.ts';
import { updateSleds } from './world/sled.ts';
import { spawnWaterSources } from './world/waterSources.ts';
import { spawnCacti, updateCacti } from './world/cactus.ts';
import { updateFires } from './world/fire.ts';
import { createFootprintRegistry, updateFootprints } from './world/footprints.ts';
import { addItem } from './inventory/inventory.ts';
import { createMenus } from './ui/menus.ts';
import { createLootMenu } from './ui/lootMenu.ts';
import { createCraftingMenu } from './ui/craftingMenu.ts';
import { createSleepOverlay } from './ui/sleepOverlay.ts';
import { createInventoryOverlay } from './ui/inventoryOverlay.ts';
import { createPerfHud, updatePerfHud } from './ui/perfHud.ts';
import { createTutorial } from './ui/tutorial.ts';
import { installDebugPanel } from './debug/debugPanel.ts';
import { createTitleScene } from './world/titleScene.ts';
import { createTitleOverlay } from './ui/titleOverlay.ts';
import { ensureAudioStarted } from './audio/audio.ts';
import { startSoundscape } from './audio/soundscape.ts';
// AAP — startMusic imported above (alongside updateMusic).
import { clearSave, loadGameState, peekSavedSeed } from './persistence/save.ts';
import { ALL_RECIPE_IDS } from './inventory/recipeDiscovery.ts';

// --- Bootstrap (async — Rapier WASM + asset preload before world build) ---
const [physics, assets] = await Promise.all([
  createPhysicsWorld(),
  preloadAssets(),
]);

const three = createScene();
const lights = createLights(three.scene);
// AAY-fix — pre-allocated PointLight pool. MUST be created BEFORE any
// world entity that uses a light (salvage panels, fires, lanterns), so
// the pool lights are part of the initial scene state and don't bump
// the renderer's lightsHash at runtime (which would force a multi-
// hundred-ms shader recompile across every lit material). See
// src/core/lightPool.ts. Size 24 covers worst-case simultaneous use.
// ABL — perf: bumped 24 → 30 to absorb salvage-panel cavity glows
// (previously each of ~68 panels had its own per-panel PointLight,
// driving scene PointLight count to ~96 and inflating per-fragment
// shader cost for every lit material). Salvage glows now claim/
// release from the pool like fires + lanterns.
const lightPool = createLightPool(three.scene, 30);
const input = createInput(three.camera, three.renderer.domElement);
const hud = createHud();
createHotbar();
createInteractPrompt();

// AAI — resolve the world seed BEFORE building any procgen system. Three
// sources, in priority order:
//   1. localStorage['dustfall.pendingSeed'] — set by titleOverlay's
//      Advanced seed entry OR by the NEW GAME button auto-roll. Consumed
//      (removed) here so a refresh after gameplay re-uses the saved seed.
//   2. peekSavedSeed() — the seed of the existing save (Continue path).
//   3. Tuning.RNG_SEED — dev/test fallback (effectively only when both
//      localStorage and save are empty, i.e., first-ever boot).
function resolveSeed(): number {
  const PENDING_KEY = 'dustfall.pendingSeed';
  const pending = localStorage.getItem(PENDING_KEY);
  if (pending !== null) {
    localStorage.removeItem(PENDING_KEY);
    const n = parseInt(pending, 10);
    if (!Number.isNaN(n) && Number.isFinite(n) && n >= 0) {
      return n >>> 0;
    }
  }
  const saved = peekSavedSeed();
  if (saved !== null) return saved;
  // No pending seed + no save — fresh-first-boot. Inline-roll so the
  // first-ever NEW GAME plays a random world (not the dev-fallback 1337).
  // Tuning.RNG_SEED is retained for dev/test paths that explicitly set
  // pendingSeed to that value, but it's not the production default.
  return Math.floor(Math.random() * 0x100000000) >>> 0;
}
const worldSeed = resolveSeed();
// Reference Tuning.RNG_SEED to silence unused-import; it's the documented
// dev/test fallback (per D85) used when localStorage is pre-seeded to it.
void Tuning.RNG_SEED;

// Three RNG streams: terrain shape, prop scatter, biome noise. All
// derived from worldSeed so the same seed regenerates the same world.
const terrainRand = makeRng(worldSeed);
const scatterRand = makeRng(worldSeed + 1);

const shelter = createShelterRegistry();
// Biome sampler is independent of terrain heights but derived from the
// same root seed so the world is fully deterministic.
const biomes = createBiomeSampler(makeRng(worldSeed + 17));
// AAT — salvage condition picker needs biome lookups at registerSalvageable
// time. Wire it once here so the salvage module has access without a
// signature change to every registerSalvageable caller.
setSalvageBiomesContext(biomes);
const terrain = createTerrain(three.scene, physics.world, terrainRand, biomes);
// HH — the FF LOD ring was removed: its coarse 50m interpolation poked above
// the chunks' fine detail in dune valleys (D52 superseded). Fog at the
// chunk-band edge (1200m, density 0.0018 ≈ 99% opaque) is the visible
// horizon now.
// Session T — salvage registry. Built up-front so hero landmarks + POIs
// can register their wrecks as they're placed.
const salvageables = createSalvageableRegistry();
placeHeroLandmarks(three.scene, physics.world, terrain, scatterRand, salvageables);
// Scattered canteens were removed — the player starts with one (see below).
// Session W — branches no longer spawn as a random ground scatter. They're
// dropped in 2-4 clusters at the base of dead trees (see spawnDeadTrees
// below) so they have a visible source.
const pickupList = spawnBranches(three.scene, terrain, scatterRand, 0);
spawnDeadTrees(three.scene, terrain, scatterRand, pickupList, biomes);
const waterSources = spawnWaterSources(three.scene, terrain, scatterRand, biomes);
const cacti = spawnCacti(three.scene, physics.world, terrain, scatterRand, biomes);
// OO-4 — rocky biome rocks. Replaces the cracked-rock procedural
// shader with actual scatter geometry (read too similarly to salt
// flats as a shader pattern). No colliders — visual props only.
spawnRockScatter(three.scene, terrain, biomes, scatterRand);

// Hand-placed distant POIs (Session P). Adds a bandage pickup at the
// abandoned camp. Massive POI wrecks register as salvageables too.
// Session ABF — flagship modules also drop narrative-beat journals into
// `journalsList`. The registry is created here, threaded through
// placePOIs, then attached to ctx.journals below so the interaction
// system can resolve hits to it.
const journalsList: Journal[] = [];
placePOIs(three.scene, physics.world, terrain, scatterRand, pickupList, salvageables, shelter, { list: journalsList }, biomes);

// HH (world rework #3) — procgen POI layer scattered across the chunk band.
// ~15 wrecks via rejection sampling. Reject against anchor POI coords AND
// any already-registered salvageable position (hero landmarks placed
// earlier in the boot) so procgen POIs don't land on existing wrecks.
const anchorPois = getAnchorPOIPositions();
const existingObstacles: Array<{ x: number; z: number }> = [
  ...anchorPois,
  ...salvageables.list.map((s) => ({ x: s.pos.x, z: s.pos.z })),
];
const procgenPoiPositions = placeProcgenPOIs(
  three.scene, physics.world, terrain, scatterRand, salvageables, existingObstacles, biomes,
);

// Session U — raiders deprioritized (world is sandbox / "only survivor").
// Code path stays so we can revisit later; just don't spawn one at boot.
const raiders: Raider[] = [];

// HH — procgen lizard scatter: clusters 1-2 per POI + sparse global density
// up to LIZARD_TARGET_COUNT. Salt biome rejected, 25m buffer from spawn.
const allPoiPositions: THREE.Vector3[] = [
  ...anchorPois.map((p) => new THREE.Vector3(p.x, terrain.heightAt(p.x, p.z), p.z)),
  ...procgenPoiPositions,
];
const lizards = spawnLizardsProcgen(
  three.scene, physics.world, terrain, biomes, scatterRand, allPoiPositions,
);

// AAP — sandworm home is now sampled per-seed from the dune biome via
// sampleSandwormHome (mirrors wells-in-salt). Falls back to
// Tuning.SANDWORM_HOME_POS if no dune centroid is reachable (rare —
// world is mostly dunes). Player-spawn exclusion = 350m so the worm
// isn't in the initial viewshed.
const sandWormHome = sampleSandwormHome(scatterRand, biomes, terrain);
{
  const biome = biomes.biomeAt(sandWormHome.x, sandWormHome.z);
  if (biome !== 'dune') {
    console.warn(
      `[sandWorm] home pos (${sandWormHome.x.toFixed(0)}, ${sandWormHome.z.toFixed(0)}) is in biome '${biome}', not 'dune'. Encounter may feel wrong.`,
    );
  }
}
const sandWorm = spawnSandWorm(three.scene, physics.world, terrain, sandWormHome);

const weather = createWeather(three.scene, three.camera);
const ambientDust = createAmbientDust(three.scene, three.camera);
const dustMotes = createDustMotes(three.scene, three.camera);
const stormVignette = createStormVignette(three.scene);
const footprints = createFootprintRegistry(three.scene, terrain);

// Player capsule. For a fresh game, setupOpeningScene below will teleport
// the player to a spot in front of the wreck entrance once the wreck's
// final position is known (findFlattestSpot drifts up to 16m from the
// search center). The initial position is a placeholder near origin —
// it's also where the player lands on a save-load (save.ts restores the
// real position) and where they end up if the opening cinematic is
// skipped for any reason. Y is sampled from the terrain so the capsule
// doesn't spawn underground.
const spawnGround = terrain.heightAt(0, 0);
const spawnY =
  spawnGround + Tuning.PLAYER_CAPSULE_HALF_HEIGHT + Tuning.PLAYER_CAPSULE_RADIUS;
const playerBody = makePlayer(
  physics.world,
  Tuning.PLAYER_CAPSULE_HALF_HEIGHT,
  Tuning.PLAYER_CAPSULE_RADIUS,
  { x: 0, y: spawnY, z: 0 },
);

// Single shadow pass: every Mesh in the scene casts + receives, UNLESS the
// mesh (or any ancestor) is marked `userData.farFromOrigin` (distant landmarks
// fog-hidden anyway) OR `userData.noShadow` (Session K — pickups + branches,
// whose tiny shadows aren't visually meaningful but add a lot of casters).
function walkUserData(obj: THREE.Object3D, flag: string): boolean {
  let cur: THREE.Object3D | null = obj;
  while (cur) {
    if (cur.userData[flag]) return true;
    cur = cur.parent;
  }
  return false;
}
three.scene.traverse((obj) => {
  const m = obj as THREE.Mesh;
  if (m.isMesh) {
    const skip = walkUserData(m, 'farFromOrigin') || walkUserData(m, 'noShadow');
    m.castShadow = !skip;
    m.receiveShadow = true;
  }
});
for (const m of terrain.meshes) {
  m.castShadow = false;
  m.receiveShadow = true;
}

createSky(three.scene);

const ctx: GameContext = {
  seed: worldSeed,    // AAI — single source of truth for world seed
  three,
  lights,
  input,
  time: {
    dayTime: Tuning.START_DAY_TIME,
    sunHeight: 0,
    sunDir: new THREE.Vector3(0, 1, 0),
    elapsed: 0,
    daysSurvived: 0,
  },
  stats: { thirst: 1, temperature: 0, hunger: 1, stamina: 1, health: 1, dead: false },
  player: {
    eyeOffset: Tuning.PLAYER_EYE_OFFSET,
    body: playerBody,
    velocityY: 0,
    onGround: false,
    crouching: false,
    inShelter: false,
    viewModel: null,
    rig: null,                       // ABO A3 — built post-context construction
  },
  pickups: { list: pickupList },
  inventory: createInventory(),
  ui: hud,
  physics,
  terrain,
  biomes,
  assets,
  shelter,
  raiders,
  lizards,
  sandWorm,
  waterSources: { list: waterSources },
  cacti: { list: cacti },
  lootContainers: { list: [], open: null },
  fires: { list: [] },
  tents: { list: [] },
  sleds: { list: [], open: null },   // Session QQ
  largeTents: { list: [] },          // Session XX
  bedrolls: { list: [] },            // Session AAC
  lanterns: { list: [] },            // Session AAC
  lockers: { list: [], open: null }, // Session AAC
  companion: null,                   // Session AAE

  salvageables,
  weather,
  ambientDust,
  dustMotes,
  stormVignette,
  speeder: null,                 // populated by setupOpeningScene on fresh worlds
  footprints,
  lightPool,
  journals: { list: journalsList },
  flags: {
    started: false,
    paused: false,
    damageFlashUntil: 0,
    titleActive: true,
    // AAX — devMode is set true by the title DEV MODE button OR by the
    // Tuning.DEBUG_STARTER_LOADOUT code-level flag. Drives the HUD badge.
    devMode: Tuning.DEBUG_STARTER_LOADOUT,
    // ABO A3 — third-person camera mode. Default false (FP at boot).
    // Toggled by F-key (pause-gated).
    thirdPerson: false,
  },
};

// First-person viewmodel — must come after scene is built; consumes ctx.
ctx.player.viewModel = createViewModel(ctx);
// ABO A3 — third-person rigged body. Built invisible (FP at boot);
// becomes visible when F-key toggles ctx.flags.thirdPerson.
ctx.player.rig = buildPlayerRig(ctx);

// Player starts with a scrap_bar (slot 0) and a full canteen (slot 1).
// ABL — swapped machete → scrap_bar because the only source of scrap
// in the world is behind salvage panels (AAR pry flow), and scrap_bar
// is the gating tool to pry. Without it as starter loot the player
// has no way to bootstrap any crafting (scrap is a near-universal
// recipe input). Machete is now found-only (could be added as wreck
// loot or quest reward in a future session).
addItem(ctx.inventory, 'scrap_bar');
addItem(ctx.inventory, 'canteen', { fillLevel: 1 });
ctx.inventory.selectedIdx = 0;

// AAX — dev loadout extracted into a helper so it can be invoked from
// both the code-level Tuning.DEBUG_STARTER_LOADOUT path (boot-time) AND
// the DEV MODE title button (inside the user-click gesture so audio +
// pointer-lock work). Pre-AAX this lived inline at boot and was gated on
// `localStorage['dustfall.devMode']`; that gate is removed in AAX in
// favor of an in-memory `ctx.flags.devMode` driven by the title click.
function applyDevLoadout(c: GameContext): void {
  // Crafting materials — enough for every recipe in craftingMenu.ts plus extra.
  for (let i = 0; i < 6; i++) addItem(c.inventory, 'branch');
  for (let i = 0; i < 6; i++) addItem(c.inventory, 'cloth');
  for (let i = 0; i < 6; i++) addItem(c.inventory, 'scrap');
  // Cookable food — drives the cook-over-fire + lizard-on-a-stick paths.
  for (let i = 0; i < 3; i++) addItem(c.inventory, 'raw_lizard_meat');
  for (let i = 0; i < 2; i++) addItem(c.inventory, 'raw_worm_meat');
  for (let i = 0; i < 2; i++) addItem(c.inventory, 'cactus_pulp');
  // Pre-made deployables — skip the craft step when iterating on fire
  // mechanics directly.
  for (let i = 0; i < 2; i++) addItem(c.inventory, 'fire_kit');
  // Light sources for night testing.
  addItem(c.inventory, 'flashlight');
  // Combat testing — gun starts with a full magazine (ammo in meta).
  addItem(c.inventory, 'scrap_gun', { ammoRemaining: Tuning.WEAPON_SCRAP_GUN_MAX_AMMO });
  for (let i = 0; i < 6; i++) addItem(c.inventory, 'scrap_bullet');
  // Sled mechanic — kit deploys the world entity; rope ties it.
  addItem(c.inventory, 'sled_kit');
  addItem(c.inventory, 'rope');
  // Salvage tool (AAR pry flow) — without this the panels stay sealed.
  addItem(c.inventory, 'scrap_bar');
  // AAZ — pre-discover every recipe. The right-side crafting panel
  // (AAW) groups recipes into CRAFTABLE / MISSING — without this every
  // dev-mode boot would start with an empty list until the player ran
  // through each combination. Skip duplicates if a save load already
  // seeded them.
  const known = c.inventory.discoveredRecipes;
  for (const id of ALL_RECIPE_IDS) {
    if (!known.includes(id)) known.push(id);
  }
}

// Tuning-level dev override (code-level, on by default false). When true,
// every boot starts with the dev loadout AND the badge — useful for the
// developer's iteration loop without clicking through the title menu each
// reload. The runtime DEV MODE button on the title is the player-facing
// equivalent (set in the onDevMode callback below).
if (Tuning.DEBUG_STARTER_LOADOUT) {
  applyDevLoadout(ctx);
}

// Opening scene runs on EVERY boot — the wreck + skeleton + journal +
// speeder are deterministic-from-seed props and would be missing from a
// save-loaded world otherwise (the user would land in a Continue with no
// starter bike or wreck). On Continue, loadGameState() then patches the
// player position + speeder pose OVER this default placement, so the
// player resumes where they saved rather than at the opening cinematic.
const openingResult = setupOpeningScene(
  three.scene, physics.world, terrain, shelter, weather, three.camera, scatterRand,
  playerBody, salvageables,
);
ctx.journals.list.push(openingResult.journal);
ctx.speeder = openingResult.speeder;
// AAE — spawn the creature companion at the position computed by
// setupOpeningScene. Singleton; loadGameState may despawn this if the
// save says the player had the pod in inventory.
spawnCompanionAt(ctx, openingResult.companionSpawnPos, 'idle');

// IMPORTANT: createMenus must run BEFORE wireOverlays — the unlock handler
// in input.ts calls showPauseOverlay which needs the menu DOM in place.
createMenus(ctx);
createLootMenu(ctx);
createCraftingMenu(ctx);
createSleepOverlay(ctx);
createInventoryOverlay(ctx);
createJournalPanel(ctx);
createRecipeBookPanel(ctx);  // AAA — TAB-key modal listing discovered recipes
createPerfHud(ctx);
createStatVignette();  // WW — must come after HUD creation so it overlays correctly
createGhostPreview(ctx); // AAA — kit-placement preview ring + marker
createFootprintPuffs(three.scene); // AAG — upward dust burst on each footstep
// Tutorial panel must exist before wireOverlays so the lock handler can call
// noteIntroSeen() — and before installDebugPanel so __game.showControls works.
createTutorial(ctx);
wireOverlays(ctx);
installDebugPanel(ctx);
installPhysicsDebug(ctx);

// --- Session CC-3: animated title screen ---
// Freeze the game world (paused=true) and stack a dedicated title scene on
// top. NEW GAME on the title is now the SOLE gesture into gameplay — it
// starts audio, locks the pointer, and unpauses the world. The legacy
// #start-overlay stays hidden permanently from boot.
ctx.flags.paused = true;
// ABL — defensive: if a prior preview-tool session left a stale
// pointer lock on this document (cursor stuck in 0×0 hidden canvas
// top-left), release it on boot. No-op when no lock is active.
if (typeof document !== 'undefined' && document.exitPointerLock) {
  try { document.exitPointerLock(); } catch { /* ignore */ }
}
const startOverlayEl = document.getElementById('start-overlay');
const controlsPanelEl = document.getElementById('controls-panel');
startOverlayEl?.classList.add('hidden');
controlsPanelEl?.classList.add('hidden');
// Hide in-game HUD elements (stats bars + clock + crosshair + hotbar) while
// the title is up — they read as game furniture and don't belong on the
// menu. Each becomes visible again on NEW GAME.
const inGameElIds = ['hud', 'hotbar', 'crosshair'];
const inGameEls = inGameElIds
  .map((id) => document.getElementById(id))
  .filter((el): el is HTMLElement => el !== null);
inGameEls.forEach((el) => { el.style.visibility = 'hidden'; });

// AAW — persistent DEV MODE badge. Built once at boot; only made visible
// on handoff if the devMode flag is set. The earlier dev-mode UX shipped
// in AAV had no in-game indicator, so the player couldn't tell which
// branch (vanilla vs dev) they were on after the reload + title cycle.
const devModeBadge = document.createElement('div');
devModeBadge.id = 'dev-mode-badge';
devModeBadge.textContent = '[ DEV MODE ]';
document.body.appendChild(devModeBadge);

// ABL — perf: pre-warm shader compilation against the game scene
// BEFORE the title is shown. Three.js compiles shader programs lazily
// on first render; without this, the FIRST frame after the player
// clicks NEW GAME stalls for 100ms-2s while ~16 programs compile cold.
// `renderer.compile(scene, camera)` walks all visible materials and
// submits them for compile against the current light/material setup.
// Cost: adds ~200-500ms to boot (invisible — title comes up after);
// payoff: click→first-game-frame is near-instant.
three.renderer.compile(three.scene, three.camera);

// ABL — perf: pre-warm the Rapier physics broadphase. The first
// physics.step() of a session is significantly more expensive than
// subsequent steps because Rapier builds collision acceleration
// structures (BVH, broadphase pair cache) on the first tick against
// the ~68 wreck colliders + terrain. Pre-walking one step here while
// the title is shown means the first GAME tick steps fast.
physics.world.step();

// ABL — perf: also prime one shadow map render so the first GAME
// frame doesn't pay the shadow-pass cold cost on top of the regular
// game render. needsUpdate is set true so the throttled cadence in
// updateLighting doesn't matter for this warmup pass.
three.renderer.shadowMap.needsUpdate = true;

const title = createTitleScene();
// Expose the title scene for debug/preview tools (read-only handles).
(window as unknown as { __title?: { scene: unknown; camera: unknown; update: (dt: number) => void } }).__title = {
  scene: title.scene,
  camera: title.camera,
  update: title.update,
};

// Whether a save existed when this boot started. setupOpeningScene now
// runs on EVERY boot so the wreck + speeder always exist; this flag only
// drives the menu (show CONTINUE button + treat NEW GAME as "wipe + restart"
// so the player's previously-saved progress, inventory, etc. doesn't leak
// into a "new" run).
const hadSaveAtBoot = hasSave();

function handoffToGame(): void {
  titleOverlay.hide();
  ctx.flags.titleActive = false;
  inGameEls.forEach((el) => { el.style.visibility = ''; });
  // AAX — surface the DEV MODE badge from the in-memory flag (set by the
  // DEV MODE button's onDevMode callback or by Tuning.DEBUG_STARTER_LOADOUT
  // at boot). Replaces the AAW localStorage-driven check, which got out of
  // sync with the actual loadout state (onNewGame clears the flag → badge
  // hides → but the boot loadout was already applied).
  if (ctx.flags.devMode) devModeBadge.classList.add('visible');
  else devModeBadge.classList.remove('visible');
  ensureAudioStarted();
  startSoundscape();
  // AAP — atmospheric music tracks. Three procedural Web Audio tracks
  // (day/storm/night) crossfaded by sun height + perceivedIntensity.
  // Independent of soundscape's sample-stem music layer (which has been
  // silent since X-era — no .ogg pack ever shipped). Per D3.
  startMusic();
  // ABL/ABN — guard pointer-lock acquisition against agent-automated
  // clicks in preview/dev windows. When `preview_eval` (Claude Preview
  // MCP, Playwright, etc.) programmatically clicks NEW GAME in a
  // preview window that's visible-but-unfocused (user is working in
  // Claude Code chat, preview window sits to the side), acquiring
  // PointerLock there confines the OS cursor to the canvas region —
  // even though the user is interacting with a different app — until
  // they alt-tab to force release.
  //
  // Original ABL guard checked `document.hidden || canvas.width === 0`
  // but missed the visible-but-unfocused case (which is the COMMON
  // one — Claude Preview windows are usually visible). The right
  // signal is `document.hasFocus()`: true only when this window owns
  // OS focus. A real user clicking NEW GAME has focus by definition
  // (the click itself focuses the window first); an agent's
  // synthesized click in a side-window doesn't.
  const canvas = three.renderer.domElement;
  const isPreviewLike = import.meta.env.DEV && (
    document.hidden ||
    canvas.width === 0 || canvas.height === 0 ||
    !document.hasFocus()
  );
  if (!isPreviewLike) {
    ctx.input.controls.lock();
  }
  setTimeout(() => {
    title.dispose();
    (window as unknown as { __title?: unknown }).__title = undefined;
  }, 0);
}

const titleOverlay = createTitleOverlay(ctx, {
  onNewGame: (seedOverride?: number) => {
    // AAI — per-game seed handling. Three paths:
    //   1. Advanced seed entered + different from current → store pending
    //      seed + wipe save + reload (boot will use the new seed).
    //   2. Save existed at boot → user wants a fresh world; roll a random
    //      seed (or use override) + wipe + reload.
    //   3. No save at boot, no seed override → world was auto-rolled this
    //      boot already; just hand off (no reload).
    //
    // AAX — devMode is an in-memory flag (ctx.flags.devMode) that does NOT
    // need clearing here. NEW GAME → fresh boot → ctx.flags.devMode = false
    // by default. Reload paths drop in-memory state automatically.
    const wantOverride = seedOverride !== undefined && (seedOverride >>> 0) !== ctx.seed;
    if (wantOverride) {
      localStorage.setItem('dustfall.pendingSeed', String(seedOverride! >>> 0));
      if (hadSaveAtBoot) clearSave();
      location.reload();
      return;
    }
    if (hadSaveAtBoot) {
      const rolled = Math.floor(Math.random() * 0x100000000) >>> 0;
      localStorage.setItem('dustfall.pendingSeed', String(rolled));
      clearSave();
      location.reload();
      return;
    }
    // Fresh-boot, no override: this world was auto-rolled; play it.
    handoffToGame();
  },
  onContinue: hadSaveAtBoot ? () => {
    // Patch the already-built world (wreck + speeder placed by
    // setupOpeningScene above) with saved player pos + speeder pose +
    // inventory + etc. If load fails we toast the error and leave the
    // title up so the player can fall back to NEW GAME.
    const result = loadGameState(ctx);
    if (!result.ok) {
      ctx.ui.showToast(result.error ?? 'load failed');
      return;
    }
    // AAX — Continue overwrites the boot inventory with the save's
    // contents. If Tuning.DEBUG_STARTER_LOADOUT pre-set flags.devMode at
    // boot, the dev items are gone now (replaced by save) — clear the
    // flag so the badge doesn't lie about the run's state. (The save
    // itself doesn't track dev-mode by design — a dev-saved session
    // becomes a regular saved game.)
    ctx.flags.devMode = false;
    handoffToGame();
  } : undefined,
  // AAX — DEV MODE button. Pre-AAX this set a localStorage flag + cleared
  // the save + reloaded; the boot-time loadout block then fired from the
  // flag. AAW tried to bypass the post-reload title (no user gesture →
  // pointer-lock fails silently → flags.paused stays true → frozen game).
  //
  // AAX: apply the loadout in-memory RIGHT HERE inside the click gesture
  // and hand off directly. No reload, no localStorage, no save wipe (the
  // existing save survives until the player saves again in dev mode). One
  // click → enter dev session. Seed override is intentionally not honored
  // by this button — for "DEV MODE with custom seed", use NEW GAME with
  // the seed first (reloads to that seed), then click DEV MODE on the new
  // title.
  onDevMode: () => {
    applyDevLoadout(ctx);
    ctx.flags.devMode = true;
    handoffToGame();
  },
});

// --- Per-frame tick: order matters ---
startLoop(ctx, (c, dt) => {
  // Title screen owns the frame until NEW GAME is pressed. Game systems
  // stay frozen behind the title — `paused` is set true during title — and
  // the render-target getter below routes to the title scene + camera.
  if (c.flags.titleActive) {
    title.update(dt);
    endInputFrame(c.input);
    return;
  }
  // Skip ALL game logic while paused. Render still runs (after this callback).
  if (c.flags.paused) {
    endInputFrame(c.input);
    return;
  }
  c.time.elapsed += dt;
  c.physics.step(dt);            // physics first
  updateWeather(c, dt);          // sandstorm intensity (drives sky + audio + thirst)
  updateAmbientDust(c, dt);      // toned-down drift, suppressed by sandstorm
  updateDustMotes(c);            // AAG — bone-white motes layer, persists through light storms
  // AAG — salt-flat mirage shader uniforms.
  updateTerrainShaderUniforms(
    c.time.elapsed,
    c.three.camera.position.x,
    c.three.camera.position.z,
    c.time.sunHeight,
  );
  // Session ABE — fabric wind shimmer. Calm baseline 0.10 keeps a
  // gentle breathing motion even on still days; weather.intensity
  // pushes amplitude up to the 0.04m shader cap at peak storm.
  updateFabricShaderUniforms(
    c.time.elapsed,
    0.10 + 0.90 * c.weather.intensity,
  );
  updateStormVignette(c);        // screen-edge tint at peak storm (BB-4)
  updateStatVignette(c);         // WW — cold/thirst tint when stats low
  updateLighting(c, dt);         // sun + lights + sunDir/sunHeight
  updateSky(c, dt);              // sky sphere + sun disc (reads weather)
  updateOpeningWreckGodRay(c);   // AAB — skylight beam opacity tracks sun height + storm intensity
  updateSpeeder(c, dt);          // hover speeder forces + mount/dismount (CC) — must run BEFORE updatePlayer so the player capsule is teleported to the rider seat before camera-sync
  updatePlayer(c, dt);           // movement + camera + advance dayTime
  updateStaminaWobble(c);        // WW — sin-driven camera jitter when stamina low (must run AFTER updatePlayer's camera-anchor)
  updateShelter(c, dt);          // before stats so heat path sees inShelter
  updateStats(c, dt);            // thirst/heat/health drain + death
  updateSoundscape(c, dt);       // wind volume tracks day/night
  updateMusic(c, dt);            // AAP — procedural music tracks crossfade by sun + storm
  // ABM (B7) — per-frame sync of dynamic-body pickups (dropped items
  // roll/fall/settle). Cheap walk; skips pickups without a body.
  // Runs AFTER physics.step (above) so the body transform reflects
  // this tick's integration result.
  updatePickups(c);
  updateRaiders(c, dt);          // AI state machine + raider movement
  updateLizards(c, dt);          // small flee-AI wildlife
  updateCompanion(c, dt);        // AAE — Rocky-inspired creature follows player
  updateSandWorm(c, dt);         // DD — buried boss; breaches when player enters territory
  updateFootprints(c.footprints, c.time.elapsed); // age + fade pooled decals
  updateFootprintPuffs(c, dt);   // AAG — particle puffs from each footstep
  updateFires(c, dt);            // flicker + fuel decrement + burnout
  updateLanterns(c);             // AAC — sin-driven flicker on placed lanterns
  updateLargeTents(c, dt);       // AAZ — doorway open/close lerp on placed shelter tents
  updateCacti(c);                // CC-4 — regrow harvested alien-cactus fruit after a day cycle
  updateSleds(c, dt);            // QQ — per-sled tow spring + rope visual; must run AFTER updateSpeeder + updatePlayer
  updateInteraction(c, dt);      // raycast hover + E to open/refill/harvest/cook/sleep/etc (UU — pickup-take moved to LMB)
  updateInventoryInput(c, dt);   // 1-4, wheel, Q to use (Q still drives def.onUse as backup)
  updateWieldAction(c, dt);      // UU — sole LMB dispatcher: attack/place/hold_use. Calls updateCombat internally for 'attack' items.
  updateReload(c);               // ABE — R-key scrap_gun reload (drains scrap_bullet → slot.meta.ammoRemaining)
  updateGhostPreview(c);         // AAA — preview ring + marker at kit deploy position
  updateViewModel(c, dt);        // first-person hands + held item (after camera + combat)
  updatePlayerRig(c, dt);        // ABO A3 — third-person rigged body (no-op in FP mode)
  updateHud(c, dt);              // HUD bars + clock
  updateHotbar(c, dt);           // hotbar slots
  updateInteractPrompt(c, dt);   // [E] prompt visibility
  updatePhysicsDebug(c, dt);     // wireframe overlay if toggled
  updatePerfHud(c, dt);          // F1 dev overlay
  endInputFrame(c.input);        // clear per-frame input state LAST
}, () =>
  ctx.flags.titleActive
    ? { scene: title.scene, camera: title.camera }
    : { scene: ctx.three.scene, camera: ctx.three.camera },
);
