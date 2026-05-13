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

  const ambient = new THREE.AmbientLight(0x4a3a2a, Tuning.AMBIENT_BASE);
  scene.add(ambient);

  return { sun, moon, ambient };
}

const _sunDir = new THREE.Vector3();
const _playerPos = new THREE.Vector3();

/** Runs every frame. Mutates ctx.time.sunHeight + ctx.time.sunDir + sky/light state. */
export function updateLighting(ctx: GameContext, _dt: number): void {
  const { sun, moon, ambient } = ctx.lights;
  const { scene } = ctx.three;

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
  const aboveHorizon = Math.max(0, sy);
  sun.intensity = aboveHorizon * Tuning.SUN_INTENSITY_MAX;
  moon.intensity = Math.max(0, -sy) * Tuning.MOON_INTENSITY_MAX;
  // Moon should also follow player so its lighting is consistent (no shadow on it).
  moon.position.copy(_playerPos).addScaledVector(_sunDir, -Tuning.SUN_DISTANCE);

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
  (scene.background as THREE.Color).copy(target);
  (scene.fog as THREE.Fog).color.copy(target);

  ambient.intensity =
    Tuning.AMBIENT_BASE
    + aboveHorizon * Tuning.AMBIENT_DAY_GAIN
    + Math.max(0, -sy) * Tuning.AMBIENT_NIGHT_GAIN;
}
