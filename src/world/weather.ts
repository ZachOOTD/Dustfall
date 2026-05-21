// Sandstorm weather system. State machine: clear → building → storm → settling.
// Session BB-4 rework: replaces the single uniform-color dust cloud with 3
// stacked layers (near/mid/far) at different sizes, speeds, and colors so
// the storm reads as volumetric instead of a flat color wash. Fog drives
// the mid-distance falloff via FogExp2 density; layers stage in
// intensity-staggered ramps so far dust appears first and near dust last
// (the storm "closes in").

import * as THREE from 'three';
import type { GameContext } from '../GameContext.ts';
import { Tuning } from '../config/tuning.ts';

export type WeatherState = 'clear' | 'building' | 'storm' | 'settling';

interface DustLayer {
  particles: THREE.Points;
  mat: THREE.PointsMaterial;
  vels: Float32Array;
  count: number;
  spread: number;
  // Wrap range along Y is fixed per-layer (small for near, bigger for far).
  yWrapHalf: number;
}

export interface Weather {
  state: WeatherState;
  intensity: number;     // 0..1, drives fog/sky/thirst/audio (world truth)
  /** Session YY — player-context-aware storm intensity. Equals
   *  `intensity` outside any shelter. Inside a fully-enclosed shelter
   *  (small tent / fire) = 0 (legacy binary suppression). Inside a
   *  large tent (open front) = `intensity * LARGE_TENT_STORM_DAMPEN`
   *  (partial — storm visible but dampened). Read by dust layers +
   *  stormVignette; NOT read by fog / stats / AI (those stay on
   *  authoritative `intensity`). D79. */
  perceivedIntensity: number;
  stateTimer: number;
  nextStormAt: number;   // ctx.time.elapsed when next storm should start
  layers: { near: DustLayer; mid: DustLayer; far: DustLayer };
  cameraRef: THREE.PerspectiveCamera;
  /** AAF — current storm's duration in seconds. Set when entering the
   *  'building' state from `stormCurveAt(daysSurvived).duration`.
   *  Captured at storm-start so a day-rollover mid-storm doesn't
   *  shorten the current storm. */
  currentStormDuration: number;
  /** AAF — has the "the long storm has come" toast fired this session?
   *  Transient (not persisted) — on save+reload after day 7 the toast
   *  re-fires once, which is fine for an atmospheric beat. */
  longStormAnnounced: boolean;
}

/** AAF — storm-curve values at a given daysSurvived. Lerps linearly
 *  from day-0 to day-LONG_STORM_DAY-1, then plateaus at long-storm
 *  values from LONG_STORM_DAY onward. Returns durations in seconds. */
export function stormCurveAt(daysSurvived: number): {
  intervalMin: number;
  intervalMax: number;
  duration: number;
} {
  const longDay = Tuning.LONG_STORM_DAY;
  if (daysSurvived >= longDay) {
    return {
      intervalMin: Tuning.LONG_STORM_INTERVAL_MIN,
      intervalMax: Tuning.LONG_STORM_INTERVAL_MAX,
      duration: Tuning.LONG_STORM_DURATION_S,
    };
  }
  // Lerp from day 0 to day LONG_STORM_DAY-1 (so day 6 = nearly the
  // worst pre-doom state; day 7 = the plateau).
  const t = daysSurvived / (longDay - 1);
  const lerp = (a: number, b: number) => a + (b - a) * Math.min(1, Math.max(0, t));
  return {
    intervalMin: lerp(Tuning.STORM_INTERVAL_DAY0_MIN, Tuning.STORM_INTERVAL_DAY7_MIN),
    intervalMax: lerp(Tuning.STORM_INTERVAL_DAY0_MAX, Tuning.STORM_INTERVAL_DAY7_MAX),
    duration: lerp(Tuning.STORM_DURATION_DAY0_S, Tuning.STORM_DURATION_DAY7_S),
  };
}

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

// One shared texture across all 3 layers.
const _sharedDustTex = (() => {
  // Defer creation to runtime (document available).
  let cached: THREE.CanvasTexture | null = null;
  return () => {
    if (!cached) cached = makeDustTexture();
    return cached;
  };
})();

const BUILD_DURATION = 8;
const SETTLE_DURATION = 12;
// AAF — storm duration + interval are now per-day-curve-driven via
// `stormCurveAt(daysSurvived)`. Helpers below compute values from
// Tuning.STORM_*_DAY0/DAY7/LONG_STORM_* constants.

interface LayerConfig {
  count: number;
  spread: number;
  yWrapHalf: number;          // vertical wrap range
  size: number;
  color: number;
  velMean: [number, number, number];
  velSpread: [number, number, number];
}

function buildLayer(
  scene: THREE.Scene,
  cfg: LayerConfig,
): DustLayer {
  const positions = new Float32Array(cfg.count * 3);
  const vels = new Float32Array(cfg.count * 3);
  for (let i = 0; i < cfg.count; i++) {
    positions[i * 3]     = (Math.random() - 0.5) * cfg.spread;
    positions[i * 3 + 1] = (Math.random() * 2 - 1) * cfg.yWrapHalf;
    positions[i * 3 + 2] = (Math.random() - 0.5) * cfg.spread;
    vels[i * 3]     = cfg.velMean[0] + (Math.random() - 0.5) * cfg.velSpread[0];
    vels[i * 3 + 1] = cfg.velMean[1] + (Math.random() - 0.5) * cfg.velSpread[1];
    vels[i * 3 + 2] = cfg.velMean[2] + (Math.random() - 0.5) * cfg.velSpread[2];
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    color: cfg.color,
    map: _sharedDustTex(),
    size: cfg.size,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    alphaTest: 0.01,
    fog: false,                 // dust is its own layer, not affected by FogExp2
    toneMapped: false,
    sizeAttenuation: true,
  });
  const particles = new THREE.Points(geo, mat);
  particles.frustumCulled = false;
  particles.visible = false;
  scene.add(particles);
  return { particles, mat, vels, count: cfg.count, spread: cfg.spread, yWrapHalf: cfg.yWrapHalf };
}

export function createWeather(
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
): Weather {
  // NEAR layer: small + fast + warm gold; close to player, parallax cue.
  const near = buildLayer(scene, {
    count: Tuning.STORM_DUST_NEAR_COUNT,
    spread: Tuning.STORM_DUST_NEAR_SPREAD,
    yWrapHalf: 6,
    size: 0.18,
    color: 0xd8b888,
    velMean: [7.5, 0, -3.0],
    velSpread: [2.0, 0.6, 1.8],
  });
  // MID layer: existing storm cloud. Mid-range size + speed + the old rust tint.
  const mid = buildLayer(scene, {
    count: Tuning.STORM_DUST_MID_COUNT,
    spread: Tuning.STORM_DUST_MID_SPREAD,
    yWrapHalf: 10,
    size: 0.32,
    color: 0xc8a070,
    velMean: [6.0, 0, -2.8],
    velSpread: [1.6, 0.5, 1.4],
  });
  // FAR layer: large + slow + muted; reads as distant haze haze, fades in
  // early so the storm "starts on the horizon."
  const far = buildLayer(scene, {
    count: Tuning.STORM_DUST_FAR_COUNT,
    spread: Tuning.STORM_DUST_FAR_SPREAD,
    yWrapHalf: 18,
    size: 0.60,
    color: 0x8c6850,
    velMean: [2.5, 0, -1.2],
    velSpread: [0.8, 0.3, 0.7],
  });

  // Initial nextStormAt uses day-0 curve (the player just started).
  const initCurve = stormCurveAt(0);
  return {
    state: 'clear',
    intensity: 0,
    perceivedIntensity: 0,
    stateTimer: 0,
    nextStormAt:
      initCurve.intervalMin + Math.random() * (initCurve.intervalMax - initCurve.intervalMin),
    layers: { near, mid, far },
    cameraRef: camera,
    currentStormDuration: initCurve.duration,
    longStormAnnounced: false,
  };
}

const _camPos = new THREE.Vector3();

function stepLayer(layer: DustLayer, opacity: number, visible: boolean, dt: number): void {
  layer.mat.opacity = opacity;
  if (layer.particles.visible !== visible) layer.particles.visible = visible;
  if (!visible) return;
  const half = layer.spread / 2;
  const yHalf = layer.yWrapHalf;
  const arr = layer.particles.geometry.attributes.position.array as Float32Array;
  const vels = layer.vels;
  for (let i = 0; i < layer.count; i++) {
    const ix = i * 3;
    arr[ix]     += vels[ix]     * dt;
    arr[ix + 1] += vels[ix + 1] * dt;
    arr[ix + 2] += vels[ix + 2] * dt;
    let lx = arr[ix]     - _camPos.x;
    let ly = arr[ix + 1] - _camPos.y;
    let lz = arr[ix + 2] - _camPos.z;
    if (lx >  half)  lx -= layer.spread;
    if (lx < -half)  lx += layer.spread;
    if (ly >  yHalf) ly -= yHalf * 2;
    if (ly < -yHalf) ly += yHalf * 2;
    if (lz >  half)  lz -= layer.spread;
    if (lz < -half)  lz += layer.spread;
    arr[ix]     = _camPos.x + lx;
    arr[ix + 1] = _camPos.y + ly;
    arr[ix + 2] = _camPos.z + lz;
  }
  layer.particles.geometry.attributes.position.needsUpdate = true;
}

/** Smoothstep clamp 0..1 between lo and hi. */
function ramp(x: number, lo: number, hi: number): number {
  if (x <= lo) return 0;
  if (x >= hi) return 1;
  const t = (x - lo) / (hi - lo);
  return t * t * (3 - 2 * t);
}

export function updateWeather(ctx: GameContext, dt: number): void {
  const w = ctx.weather;
  w.stateTimer += dt;

  // AAF — fire the one-shot "long storm has come" toast on first
  // day-7 tick. Persists for the rest of the session via longStormAnnounced.
  if (!w.longStormAnnounced && ctx.time.daysSurvived >= Tuning.LONG_STORM_DAY) {
    w.longStormAnnounced = true;
    ctx.ui.showToast('the long storm has come — find shelter');
  }

  // AAF — current-day storm curve. Recomputed each tick so the calm-
  // gap interval shrinks as days pass even if we're already in 'clear'.
  const curve = stormCurveAt(ctx.time.daysSurvived);

  switch (w.state) {
    case 'clear':
      w.intensity = 0;
      if (ctx.time.elapsed >= w.nextStormAt) {
        w.state = 'building';
        w.stateTimer = 0;
        // Capture this storm's duration at start so a day-rollover
        // mid-storm doesn't shorten what the player's already enduring.
        w.currentStormDuration = curve.duration;
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
      if (w.stateTimer >= w.currentStormDuration) {
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
          curve.intervalMin +
          Math.random() * (curve.intervalMax - curve.intervalMin);
      }
      break;
  }

  // FogExp2 density curve. Smoothstep from CLEAR→STORM density so the
  // start of a building storm rolls in gently instead of immediately
  // dropping visibility off a cliff. Color is set in updateLighting.
  const fog = ctx.three.scene.fog as THREE.FogExp2;
  const densityT = ramp(w.intensity, 0, 1);
  fog.density =
    Tuning.FOG_DENSITY_CLEAR +
    (Tuning.FOG_DENSITY_STORM - Tuning.FOG_DENSITY_CLEAR) * densityT;

  // Per-layer opacity ramps. Far comes in first (provides distant haze
  // before the player is "inside" the storm); near comes in last (the
  // wind reaching you signals the storm's arrival). Session YY — reads
  // `perceivedIntensity` (not `intensity`) so fully-enclosed shelters
  // suppress dust (perceivedIntensity=0) and large tents partially
  // dampen it (perceivedIntensity = intensity * 0.4).
  _camPos.copy(w.cameraRef.position);
  const pi = w.perceivedIntensity;

  const farOp =
    ramp(pi, Tuning.STORM_FAR_RAMP_LO, Tuning.STORM_FAR_RAMP_HI) *
    Tuning.STORM_DUST_FAR_OPACITY;
  const midOp = pi * Tuning.STORM_DUST_MID_OPACITY;
  const nearOp =
    ramp(pi, Tuning.STORM_NEAR_RAMP_LO, Tuning.STORM_NEAR_RAMP_HI) *
    Tuning.STORM_DUST_NEAR_OPACITY;

  stepLayer(w.layers.far, farOp, farOp > 0.001, dt);
  stepLayer(w.layers.mid, midOp, midOp > 0.001, dt);
  stepLayer(w.layers.near, nearOp, nearOp > 0.001, dt);
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
  // AAF — day-0 storm duration; opening cinematic uses the gentlest curve.
  weather.currentStormDuration = Tuning.STORM_DURATION_DAY0_S;
  weather.stateTimer = Tuning.STORM_DURATION_DAY0_S - 18;
}
