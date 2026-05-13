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
import { scatterLandmarks } from './world/landmarks.ts';
import { placeHeroLandmarks } from './world/heroLandmarks.ts';
import { createSky, updateSky } from './world/sky.ts';
import { updateStats } from './stats/survival.ts';
import { createHud, updateHud } from './ui/hud.ts';
import { createHotbar, updateHotbar } from './ui/hotbar.ts';
import { createInteractPrompt, updateInteractPrompt } from './ui/interactPrompt.ts';
import { spawnCanteens, bobPickups } from './pickups/pickups.ts';
import { createInventory, updateInventoryInput } from './inventory/inventory.ts';
import { updateInteraction } from './player/interaction.ts';
import { updatePlayer } from './player/controller.ts';
import { createShelterRegistry, updateShelter } from './shelter/shelterZones.ts';
import { updateSoundscape } from './audio/soundscape.ts';
import { spawnRaider, updateRaiders } from './enemies/raider.ts';
import { updateCombat } from './player/combat.ts';
import { createWeather, updateWeather } from './world/weather.ts';
import { addItem } from './inventory/inventory.ts';
import { createMenus } from './ui/menus.ts';
import { createPerfHud, updatePerfHud } from './ui/perfHud.ts';
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
const terrain = createTerrain(three.scene, physics.world, terrainRand);
placeHeroLandmarks(three.scene, physics.world, terrain, shelter, scatterRand);
scatterLandmarks(three.scene, physics.world, terrain, assets, scatterRand);
const pickupList = spawnCanteens(three.scene, terrain, assets, scatterRand);

// Spawn one raider somewhere visible-but-not-immediate (~30m from spawn).
const raiders = [
  spawnRaider(three.scene, physics.world, terrain, new THREE.Vector3(22, 0, -25)),
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
// mesh (or any ancestor) is marked `userData.farFromOrigin` — distant landmarks
// don't cast shadows because fog hides them anyway and they're the bulk of
// the shadow-map cost.
function isFar(obj: THREE.Object3D): boolean {
  let cur: THREE.Object3D | null = obj;
  while (cur) {
    if (cur.userData.farFromOrigin) return true;
    cur = cur.parent;
  }
  return false;
}
three.scene.traverse((obj) => {
  const m = obj as THREE.Mesh;
  if (m.isMesh) {
    m.castShadow = !isFar(m);
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
  },
  stats: { thirst: 1, heat: 0, health: 1, dead: false },
  player: {
    eyeOffset: Tuning.PLAYER_EYE_OFFSET,
    body: playerBody,
    velocityY: 0,
    onGround: false,
    inShelter: false,
  },
  pickups: { list: pickupList },
  inventory: createInventory(),
  ui: hud,
  physics,
  terrain,
  assets,
  shelter,
  raiders,
  weather,
  flags: { started: false, paused: false },
};

// Player starts with a machete in slot 1 so combat is immediately accessible.
// (Without this they'd need a machete pickup, which v1 doesn't spawn.)
addItem(ctx.inventory, 'machete');
ctx.inventory.selectedIdx = 0;

// IMPORTANT: createMenus must run BEFORE wireOverlays — the unlock handler
// in input.ts calls showPauseOverlay which needs the menu DOM in place.
createMenus(ctx);
createPerfHud();
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
  bobPickups(c, dt);             // bob anim
  updateRaiders(c, dt);          // AI state machine + raider movement
  updateInteraction(c, dt);      // raycast hover + E to take
  updateInventoryInput(c, dt);   // 1-4, wheel, Q to use
  updateCombat(c, dt);           // LMB swing → damage raider
  updateHud(c, dt);              // HUD bars + clock
  updateHotbar(c, dt);           // hotbar slots
  updateInteractPrompt(c, dt);   // [E] prompt visibility
  updatePhysicsDebug(c, dt);     // wireframe overlay if toggled
  updatePerfHud(c, dt);          // F1 dev overlay
  endInputFrame(c.input);        // clear per-frame input state LAST
});
