// Lights + day/night sky color/sun position.
// Kept in one module since both move together with dayTime.

import * as THREE from 'three';
import type { GameContext } from '../GameContext.ts';
import { SkyColors, Tuning } from '../config/tuning.ts';

export interface LightsBundle {
  sun: THREE.DirectionalLight;
  moon: THREE.DirectionalLight;
  ambient: THREE.AmbientLight;
}

export function createLights(scene: THREE.Scene): LightsBundle {
  const sun = new THREE.DirectionalLight(0xffe2ad, 0.0);
  sun.position.set(50, 80, 30);

  // Real-time shadow setup. The shadow camera is an ortho box following the
  // player; updateLighting moves it each frame.
  sun.castShadow = true;
  sun.shadow.mapSize.set(Tuning.SHADOW_MAP_SIZE, Tuning.SHADOW_MAP_SIZE);
  sun.shadow.camera.left = -Tuning.SHADOW_CAM_HALF;
  sun.shadow.camera.right = Tuning.SHADOW_CAM_HALF;
  sun.shadow.camera.top = Tuning.SHADOW_CAM_HALF;
  sun.shadow.camera.bottom = -Tuning.SHADOW_CAM_HALF;
  sun.shadow.camera.near = Tuning.SHADOW_CAM_NEAR;
  sun.shadow.camera.far = Tuning.SHADOW_CAM_FAR;
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.06;
  sun.shadow.camera.updateProjectionMatrix();

  scene.add(sun);
  scene.add(sun.target); // important — without this the target's matrix never updates

  const moon = new THREE.DirectionalLight(0x6a7ea0, 0.0);
  moon.position.set(-30, 50, -20);
  scene.add(moon);
  // Moon's target needs to be in the scene graph so its matrixWorld updates
  // when we mutate target.position each frame (CC-4 fix). Without this,
  // target.position changes don't propagate to the light's direction
  // calculation, leaving moonlight always pointing toward world origin.
  scene.add(moon.target);

  const ambient = new THREE.AmbientLight(0x4a3a2a, Tuning.AMBIENT_BASE);
  scene.add(ambient);

  return { sun, moon, ambient };
}

const _sunDir = new THREE.Vector3();
const _playerPos = new THREE.Vector3();
// ABL — perf: throttled shadow map updates. autoUpdate is OFF in
// scene.ts; we set needsUpdate=true every N frames so the shadow pass
// runs at ~10Hz instead of ~144Hz. The sun moves slowly enough that
// stale shadows for ~6 frames are imperceptible.
let _shadowUpdateCounter = 0;
// ACU — shadow-swim-on-moving-player fix. The shadow camera FOLLOWS the player
// every frame (updateLighting below), but a throttled shadow map leaves the
// shadow PROJECTION matrix (light.shadow.matrix — only recomputed on the frames
// the map regenerates) stale in between. While the player TRANSLATES, their
// fragments get projected by the stale matrix into the stale map → the rig's
// self-shadow drifts a little each frame and snaps back on every regen, reading
// as flicker ON the moving player (static scenery doesn't move, so it's fine).
// The ABL comment accounted for the sun's slow ROTATION but not the camera's
// per-frame TRANSLATION with the player. Fix: force a regen on any frame the
// player actually moved (the only time the staleness is visible); keep the
// ~10Hz throttle when idle (ABL's perf win — imperceptible when nothing moves).
let _lastShadowPx = Infinity, _lastShadowPy = Infinity, _lastShadowPz = Infinity;

/** Runs every frame. Mutates ctx.time.sunHeight + ctx.time.sunDir + sky/light state. */
export function updateLighting(ctx: GameContext, _dt: number): void {
  const { sun, moon, ambient } = ctx.lights;
  const { scene, renderer } = ctx.three;

  // ABL — perf: throttle shadow-map regen. Tag the renderer's
  // shadowMap.needsUpdate every N frames; in-between frames reuse the
  // already-rendered depth map. Invisible at the sun's angular speed.
  // ACU — but ALSO force a regen on any frame the player MOVED, so the shadow
  // projection matrix never goes stale relative to the following shadow camera
  // (else the rig's self-shadow swims/flickers while walking — see note above).
  _shadowUpdateCounter++;
  const _shTr = ctx.player.body.body.translation();
  const _playerMovedForShadow =
    Math.abs(_shTr.x - _lastShadowPx) > 1e-3 ||
    Math.abs(_shTr.y - _lastShadowPy) > 1e-3 ||
    Math.abs(_shTr.z - _lastShadowPz) > 1e-3;
  if (_playerMovedForShadow || _shadowUpdateCounter >= Tuning.SHADOW_UPDATE_EVERY_N_FRAMES) {
    renderer.shadowMap.needsUpdate = true;
    _shadowUpdateCounter = 0;
    _lastShadowPx = _shTr.x; _lastShadowPy = _shTr.y; _lastShadowPz = _shTr.z;
  }

  // Sun rises at dayTime=0.25 (06:00), peaks at 0.5 (noon), sets at 0.75 (18:00).
  // The sun moves in the X-Y plane (slight Z bias for visual depth).
  const sunAngle = (ctx.time.dayTime - 0.25) * Math.PI * 2;
  const sx = Math.cos(sunAngle);
  const sy = Math.sin(sunAngle);
  const sz = 0.18; // slight tilt so the path isn't a pure overhead line

  _sunDir.set(sx, sy, sz).normalize();
  ctx.time.sunDir.copy(_sunDir);
  ctx.time.sunHeight = sy;

  // Player position drives the shadow camera so shadows follow you.
  const tr = ctx.player.body.body.translation();
  _playerPos.set(tr.x, tr.y, tr.z);

  sun.target.position.copy(_playerPos);
  sun.target.updateMatrixWorld();
  sun.position.copy(_playerPos).addScaledVector(_sunDir, Tuning.SUN_DISTANCE);

  // Light intensity tracks sun height (clamped at 0 below horizon).
  // BB-4 — storm dims the sun aggressively (sun is "behind" the dust)
  // and dims the ambient gently (ambient picks up dust-scattered light).
  const aboveHorizon = Math.max(0, sy);
  const storm = ctx.weather.intensity;
  const sunStormDim = 1 - storm * Tuning.STORM_SUN_DIM;
  sun.intensity = aboveHorizon * Tuning.SUN_INTENSITY_MAX * sunStormDim;
  moon.intensity = Math.max(0, -sy) * Tuning.MOON_INTENSITY_MAX * sunStormDim;
  // Moon should also follow player so its lighting is consistent. We must
  // update BOTH position and target — DirectionalLight direction is
  // (target.position - light.position).normalize(), so leaving target at
  // its default (world origin) would invert moonlight direction whenever
  // the player position moves far from origin (e.g., mounted on the
  // speeder, the player capsule parks at y=-2000, making moonlight shine
  // UPWARD and dramatically darkening the world at night).
  moon.position.copy(_playerPos).addScaledVector(_sunDir, -Tuning.SUN_DISTANCE);
  moon.target.position.copy(_playerPos);
  moon.target.updateMatrixWorld();

  // Sky background + fog colors blend through the times of day.
  let target: THREE.Color;
  if (sy > 0.25) {
    target = SkyColors.HORIZON_DAY;
  } else if (sy > -0.1) {
    const t = (sy + 0.1) / 0.35;
    target = SkyColors.HORIZON_DUSK.clone().lerp(SkyColors.HORIZON_DAY, t);
  } else if (sy > -0.3) {
    const t = (sy + 0.3) / 0.2;
    target = SkyColors.HORIZON_NIGHT.clone().lerp(SkyColors.HORIZON_DUSK, t);
  } else {
    target = SkyColors.HORIZON_NIGHT;
  }
  // Sandstorm: pull the scene background HARD toward the storm-sky dust
  // color (the dome behind the player), and the FOG color about 70% of
  // the way (BB-4 — bumped from 0.45 since FogExp2's denser falloff makes
  // every surface read the fog color near the visibility limit, so the
  // fog needs to match the sky tint or the world reads bichromatic).
  const dust = new THREE.Color(0x6e3a22);
  const bgTarget = storm > 0.001 ? target.clone().lerp(dust, storm * 0.95) : target;
  const fogTarget = storm > 0.001 ? target.clone().lerp(dust, storm * 0.70) : target;
  (scene.background as THREE.Color).copy(bgTarget);
  // scene.fog is FogExp2 (BB-4); FogBase has .color, same API as THREE.Fog.
  (scene.fog as THREE.FogExp2).color.copy(fogTarget);

  // BB-4 — ambient also dims slightly during storm and shifts toward
  // dust color (the sky is one giant orange dome, so ambient light
  // arriving from above is dust-colored, not neutral).
  const ambientStormDim = 1 - storm * Tuning.STORM_AMBIENT_DIM;
  ambient.intensity = (
    Tuning.AMBIENT_BASE
    + aboveHorizon * Tuning.AMBIENT_DAY_GAIN
    + Math.max(0, -sy) * Tuning.AMBIENT_NIGHT_GAIN
  ) * ambientStormDim;
  if (storm > 0.001) {
    ambient.color.copy(new THREE.Color(0x4a3a2a)).lerp(new THREE.Color(0x8a5840), storm * 0.7);
  } else {
    ambient.color.setHex(0x4a3a2a);
  }
}
