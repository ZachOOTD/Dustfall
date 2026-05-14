// Sandstorm weather system. State machine: clear → building → storm → settling.
// One particle cloud follows the camera and fades in/out via material opacity.

import * as THREE from 'three';
import type { GameContext } from '../GameContext.ts';
import { Tuning } from '../config/tuning.ts';

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

const PARTICLE_COUNT = 2500;
const PARTICLE_SPREAD = 90;   // bounding box around the camera

// Soft circular dust mote — radial gradient. Without this, PointsMaterial
// renders each particle as an opaque square, which reads as pixelated
// noise instead of dust.
function makeDustTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d');
  if (!g) throw new Error('canvas 2d unavailable');
  const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.45, 'rgba(255,255,255,0.65)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 32, 32);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
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
    // Per-particle drift bias. Fast horizontal sweep (~6 m/s) sells the
    // "violent wind" feel; tiny vertical jitter keeps the cloud lively.
    vels[i * 3]     = 6.0 + (Math.random() - 0.5) * 1.6;
    vels[i * 3 + 1] = (Math.random() - 0.5) * 0.5;
    vels[i * 3 + 2] = -2.8 + (Math.random() - 0.5) * 1.4;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const mat = new THREE.PointsMaterial({
    color: 0xc8a070,
    map: makeDustTexture(),
    size: 0.32,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    alphaTest: 0.01,         // discard nearly-transparent edges → cleaner sort
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

  // Visuals — fog modulated by intensity. We move BOTH `near` and `far`
  // so the fog feels close during a storm without the math inverting
  // (near must stay strictly < far).
  //   intensity 0.0 → near 25,  far 170  (no fog within 25m; clear-day default)
  //   intensity 1.0 → near 15,  far 30   (fog starts close, fully opaque by 30m)
  // 12-m wreck stays largely un-tinted; anything past 30m disappears.
  const fog = ctx.three.scene.fog as THREE.Fog;
  fog.near = Math.max(15, Tuning.FOG_NEAR - 10 * w.intensity);
  fog.far = Math.max(30, Tuning.FOG_FAR - 140 * w.intensity);

  // Particles: opacity rides intensity; positions drift around the camera.
  // Visibility gate: skip the entire Points draw call when the storm is calm
  // OR when the player is inside a shelter (storm shouldn't visually be
  // inside a roofed area). Session V/W: AND with !inShelter.
  const particlesVisible = w.intensity > 0.01 && !ctx.player.inShelter;
  if (w.particles.visible !== particlesVisible) {
    w.particles.visible = particlesVisible;
  }
  w.particleMat.opacity = w.intensity * 0.55;
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

/**
 * Seed a sandstorm at boot for the opening scene (Session W). Drops
 * straight into the 'storm' state (intensity = 1.0 — the per-tick
 * `case 'storm'` clause forces this regardless of what we set here), with
 * the state timer pre-advanced so the storm transitions to 'settling'
 * after ~18 s and is fully clear ~30 s after spawn (12 s of settling).
 *
 * Call from main.ts only when hasSave() returns false (fresh world).
 */
export function seedOpeningStorm(weather: Weather): void {
  weather.state = 'storm';
  weather.intensity = 1.0;
  // 18s of full storm + 12s of settling = 30s total opening sandstorm.
  weather.stateTimer = STORM_DURATION - 18;
}
