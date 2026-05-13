// Sandstorm weather system. State machine: clear → building → storm → settling.
// One particle cloud follows the camera and fades in/out via material opacity.

import * as THREE from 'three';
import type { GameContext } from '../GameContext.ts';

export type WeatherState = 'clear' | 'building' | 'storm' | 'settling';

export interface Weather {
  state: WeatherState;
  intensity: number;     // 0..1, drives fog/sky/thirst/audio everywhere
  stateTimer: number;
  nextStormAt: number;   // ctx.time.elapsed when next storm should start
  particles: THREE.Points;
  particleMat: THREE.PointsMaterial;
  particleVels: Float32Array; // per-particle drift velocity
  cameraRef: THREE.PerspectiveCamera;
}

const PARTICLE_COUNT = 2000;
const PARTICLE_SPREAD = 80;   // bounding box around the camera
const BUILD_DURATION = 8;
const STORM_DURATION = 90;
const SETTLE_DURATION = 12;
const STORM_INTERVAL_MIN = 360;  // earliest restart (6 min)
const STORM_INTERVAL_MAX = 600;  // latest (10 min)

export function createWeather(
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
): Weather {
  // Particle positions seeded near origin; they'll be re-centered on camera
  // each frame so they always feel "around the player".
  const positions = new Float32Array(PARTICLE_COUNT * 3);
  const vels = new Float32Array(PARTICLE_COUNT * 3);
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    positions[i * 3]     = (Math.random() - 0.5) * PARTICLE_SPREAD;
    positions[i * 3 + 1] = Math.random() * 20 - 2;
    positions[i * 3 + 2] = (Math.random() - 0.5) * PARTICLE_SPREAD;
    // Per-particle drift bias so they swirl rather than march in unison
    vels[i * 3]     = 1.5 + (Math.random() - 0.5) * 0.7;
    vels[i * 3 + 1] = (Math.random() - 0.5) * 0.3;
    vels[i * 3 + 2] = -0.8 + (Math.random() - 0.5) * 0.5;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const mat = new THREE.PointsMaterial({
    color: 0xc8a070,
    size: 0.18,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    fog: false,
    toneMapped: false,
    sizeAttenuation: true,
  });

  const particles = new THREE.Points(geo, mat);
  particles.frustumCulled = false;
  scene.add(particles);

  return {
    state: 'clear',
    intensity: 0,
    stateTimer: 0,
    nextStormAt:
      STORM_INTERVAL_MIN + Math.random() * (STORM_INTERVAL_MAX - STORM_INTERVAL_MIN),
    particles,
    particleMat: mat,
    particleVels: vels,
    cameraRef: camera,
  };
}

const _camPos = new THREE.Vector3();

export function updateWeather(ctx: GameContext, dt: number): void {
  const w = ctx.weather;
  w.stateTimer += dt;

  switch (w.state) {
    case 'clear':
      w.intensity = 0;
      if (ctx.time.elapsed >= w.nextStormAt) {
        w.state = 'building';
        w.stateTimer = 0;
      }
      break;
    case 'building':
      w.intensity = Math.min(1, w.stateTimer / BUILD_DURATION);
      if (w.stateTimer >= BUILD_DURATION) {
        w.state = 'storm';
        w.stateTimer = 0;
      }
      break;
    case 'storm':
      w.intensity = 1;
      if (w.stateTimer >= STORM_DURATION) {
        w.state = 'settling';
        w.stateTimer = 0;
      }
      break;
    case 'settling':
      w.intensity = Math.max(0, 1 - w.stateTimer / SETTLE_DURATION);
      if (w.stateTimer >= SETTLE_DURATION) {
        w.state = 'clear';
        w.stateTimer = 0;
        w.nextStormAt =
          ctx.time.elapsed +
          STORM_INTERVAL_MIN +
          Math.random() * (STORM_INTERVAL_MAX - STORM_INTERVAL_MIN);
      }
      break;
  }

  // Visuals — fog and particles modulated by intensity.
  // Fog: lerp far from 170 → 35.
  const fog = ctx.three.scene.fog as THREE.Fog;
  fog.far = 170 - 135 * w.intensity;

  // Particles: opacity rides intensity; positions drift around the camera.
  w.particleMat.opacity = w.intensity * 0.6;
  if (w.intensity > 0.01) {
    _camPos.copy(w.cameraRef.position);
    const posAttr = w.particles.geometry.attributes.position;
    const arr = posAttr.array as Float32Array;
    const vels = w.particleVels;
    const half = PARTICLE_SPREAD / 2;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const ix = i * 3;
      arr[ix]     += vels[ix]     * dt;
      arr[ix + 1] += vels[ix + 1] * dt;
      arr[ix + 2] += vels[ix + 2] * dt;

      // Wrap relative to camera so the cloud always surrounds us.
      let lx = arr[ix]     - _camPos.x;
      let ly = arr[ix + 1] - _camPos.y;
      let lz = arr[ix + 2] - _camPos.z;
      if (lx >  half) lx -= PARTICLE_SPREAD;
      if (lx < -half) lx += PARTICLE_SPREAD;
      if (ly >  10)   ly -= 20;
      if (ly < -10)   ly += 20;
      if (lz >  half) lz -= PARTICLE_SPREAD;
      if (lz < -half) lz += PARTICLE_SPREAD;
      arr[ix]     = _camPos.x + lx;
      arr[ix + 1] = _camPos.y + ly;
      arr[ix + 2] = _camPos.z + lz;
    }
    posAttr.needsUpdate = true;
  }
}

/** Convenience: trigger a storm immediately. Used by debug panel. */
export function triggerStorm(ctx: GameContext): void {
  ctx.weather.state = 'building';
  ctx.weather.stateTimer = 0;
}
