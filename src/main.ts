// Dustfall — orchestrator. Each system lives in its own module.

import './style.css';
import * as THREE from 'three';
import type { GameContext } from './GameContext.ts';
import { Tuning } from './config/tuning.ts';
import { makeRng } from './core/rng.ts';
import { createScene } from './core/scene.ts';
import { createLights, updateLighting } from './core/lighting.ts';
import { createInput, wireOverlays, endInputFrame } from './core/input.ts';
import { startLoop } from './core/loop.ts';
import { createPhysicsWorld } from './physics/world.ts';
import { makePlayer } from './physics/bodies.ts';
import { installPhysicsDebug, updatePhysicsDebug } from './physics/debug.ts';
import { preloadAssets } from './assets/loader.ts';
import { createTerrain } from './world/terrain.ts';
import { createBiomeSampler } from './world/biomes.ts';
import { placePOIs } from './world/poi.ts';
import { placeHeroLandmarks } from './world/heroLandmarks.ts';
import { createSky, updateSky } from './world/sky.ts';
import { updateStats } from './stats/survival.ts';
import { createHud, updateHud } from './ui/hud.ts';
import { createHotbar, updateHotbar } from './ui/hotbar.ts';
import { createInteractPrompt, updateInteractPrompt } from './ui/interactPrompt.ts';
import { spawnBranches } from './pickups/pickups.ts';
import { createInventory, updateInventoryInput } from './inventory/inventory.ts';
import { updateInteraction } from './player/interaction.ts';
import { updatePlayer } from './player/controller.ts';
import { createShelterRegistry, updateShelter } from './shelter/shelterZones.ts';
import { updateSoundscape } from './audio/soundscape.ts';
import { spawnRaider, updateRaiders } from './enemies/raider.ts';
import { spawnLizard, updateLizards } from './enemies/lizard.ts';
import { updateCombat } from './player/combat.ts';
import { createViewModel, updateViewModel } from './player/viewModel.ts';
import { createWeather, updateWeather } from './world/weather.ts';
import { spawnWaterSources } from './world/waterSources.ts';
import { spawnCacti } from './world/cactus.ts';
import { updateFires } from './world/fire.ts';
import { addItem } from './inventory/inventory.ts';
import { createMenus } from './ui/menus.ts';
import { createLootMenu } from './ui/lootMenu.ts';
import { createCraftingMenu } from './ui/craftingMenu.ts';
import { createSleepOverlay } from './ui/sleepOverlay.ts';
import { createInventoryOverlay } from './ui/inventoryOverlay.ts';
import { createPerfHud, updatePerfHud } from './ui/perfHud.ts';
import { createTutorial } from './ui/tutorial.ts';
import { installDebugPanel } from './debug/debugPanel.ts';

// --- Bootstrap (async — Rapier WASM + asset preload before world build) ---
const [physics, assets] = await Promise.all([
  createPhysicsWorld(),
  preloadAssets(),
]);

const three = createScene();
const lights = createLights(three.scene);
const input = createInput(three.camera, three.renderer.domElement);
const hud = createHud();
createHotbar();
createInteractPrompt();

// Two RNG streams: terrain shape vs prop scatter. Stable across reloads.
const terrainRand = makeRng(Tuning.RNG_SEED);
const scatterRand = makeRng(Tuning.RNG_SEED + 1);

const shelter = createShelterRegistry();
// Biome sampler is independent of terrain heights but seeded from the same
// scatter stream so the world is fully deterministic from RNG_SEED.
const biomes = createBiomeSampler(makeRng(Tuning.RNG_SEED + 17));
const terrain = createTerrain(three.scene, physics.world, terrainRand, biomes);
placeHeroLandmarks(three.scene, physics.world, terrain, scatterRand);
// Scattered canteens were removed — the player starts with one (see below).
const pickupList = spawnBranches(three.scene, terrain, scatterRand);
const waterSources = spawnWaterSources(three.scene, terrain, scatterRand, biomes);
const cacti = spawnCacti(three.scene, physics.world, terrain, scatterRand);

// Hand-placed distant POIs (Session P). Adds a bandage pickup at the
// abandoned camp.
placePOIs(three.scene, physics.world, terrain, scatterRand, pickupList);

// Spawn one raider somewhere visible-but-not-immediate (~30m from spawn).
const raiders = [
  spawnRaider(three.scene, physics.world, terrain, new THREE.Vector3(22, 0, -25)),
];

// Spawn 4 lizards at distributed positions ~20-60m from origin.
const lizards = [
  spawnLizard(three.scene, physics.world, terrain, { x: 18, z: 12 }),
  spawnLizard(three.scene, physics.world, terrain, { x: -28, z: 8 }),
  spawnLizard(three.scene, physics.world, terrain, { x: -14, z: -34 }),
  spawnLizard(three.scene, physics.world, terrain, { x: 36, z: -22 }),
];

const weather = createWeather(three.scene, three.camera);

// Player capsule: feet at terrain height under spawn point.
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
terrain.mesh.castShadow = false;
terrain.mesh.receiveShadow = true;

createSky(three.scene);

const ctx: GameContext = {
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
    inShelter: false,
    viewModel: null,
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
  waterSources: { list: waterSources },
  cacti: { list: cacti },
  lootContainers: { list: [], open: null },
  fires: { list: [] },
  tents: { list: [] },
  weather,
  flags: { started: false, paused: false, damageFlashUntil: 0 },
};

// First-person viewmodel — must come after scene is built; consumes ctx.
ctx.player.viewModel = createViewModel(ctx);

// Player starts with a machete (slot 0) and a full canteen (slot 1). Scattered
// canteens were removed from the world — the starter canteen + wells are the
// player's only water sources at boot.
addItem(ctx.inventory, 'machete');
addItem(ctx.inventory, 'canteen', { fillLevel: 1 });
ctx.inventory.selectedIdx = 0;

// IMPORTANT: createMenus must run BEFORE wireOverlays — the unlock handler
// in input.ts calls showPauseOverlay which needs the menu DOM in place.
createMenus(ctx);
createLootMenu(ctx);
createCraftingMenu(ctx);
createSleepOverlay(ctx);
createInventoryOverlay(ctx);
createPerfHud(ctx);
// Tutorial panel must exist before wireOverlays so the lock handler can call
// noteIntroSeen() — and before installDebugPanel so __game.showControls works.
createTutorial(ctx);
wireOverlays(ctx);
installDebugPanel(ctx);
installPhysicsDebug(ctx);

// --- Per-frame tick: order matters ---
startLoop(ctx, (c, dt) => {
  // Skip ALL game logic while paused. Render still runs (after this callback).
  if (c.flags.paused) {
    endInputFrame(c.input);
    return;
  }
  c.time.elapsed += dt;
  c.physics.step(dt);            // physics first
  updateWeather(c, dt);          // sandstorm intensity (drives sky + audio + thirst)
  updateLighting(c, dt);         // sun + lights + sunDir/sunHeight
  updateSky(c, dt);              // sky sphere + sun disc (reads weather)
  updatePlayer(c, dt);           // movement + camera + advance dayTime
  updateShelter(c, dt);          // before stats so heat path sees inShelter
  updateStats(c, dt);            // thirst/heat/health drain + death
  updateSoundscape(c, dt);       // wind volume tracks day/night
  // (bobPickups removed — items now rest flat on the ground; no float/spin)
  updateRaiders(c, dt);          // AI state machine + raider movement
  updateLizards(c, dt);          // small flee-AI wildlife
  updateFires(c, dt);            // flicker + fuel decrement + burnout
  updateInteraction(c, dt);      // raycast hover + E to take/refill/search/harvest/cook/sleep
  updateInventoryInput(c, dt);   // 1-4, wheel, Q to use
  updateCombat(c, dt);           // LMB swing → damage raider
  updateViewModel(c, dt);        // first-person hands + held item (after camera + combat)
  updateHud(c, dt);              // HUD bars + clock
  updateHotbar(c, dt);           // hotbar slots
  updateInteractPrompt(c, dt);   // [E] prompt visibility
  updatePhysicsDebug(c, dt);     // wireframe overlay if toggled
  updatePerfHud(c, dt);          // F1 dev overlay
  endInputFrame(c.input);        // clear per-frame input state LAST
});
