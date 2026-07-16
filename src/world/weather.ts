// Sandstorm weather system. State machine: clear → building → storm → settling.
// Session BB-4 rework: replaces the single uniform-color dust cloud with 3
// stacked layers (near/mid/far) at different sizes, speeds, and colors so
// the storm reads as volumetric instead of a flat color wash. Fog drives
// the mid-distance falloff via FogExp2 density; layers stage in
// intensity-staggered ramps so far dust appears first and near dust last
// (the storm "closes in").

import * as THREE from 'three';
import type { GameContext } from '../GameContext.ts';
import { getPlayerWorldPos } from '../player/effectivePos.ts';   // ACBD — effective player pos (speeder seat while mounted)
import { Tuning } from '../config/tuning.ts';
import { createDustWall, updateDustWall, type DustWall } from './dustWall.ts';   // review 2026-07-14 — the visible approaching dust front

export type WeatherState = 'clear' | 'building' | 'storm' | 'settling';

// ACL SKY+WEATHER — Dune-style sweeping sandstorm WALL. Rather than a uniform
// intensity ramp tied only to a timer, a storm is now a directional wall that
// travels across the world along a fixed heading. The player's *effective*
// storm intensity is derived from their signed distance to the wall: ramps up
// as the wall approaches, peaks while the player is inside the wall's width,
// ramps down as it passes. This wall STATE must persist across save/load —
// reported to the integrator as a saveField (see manifest). The carrier value
// `Weather.intensity` (0..1) is still what sky/fog/dust/vignette read, so
// nothing downstream needs to know about the wall.
export interface StormWall {
  /** Wall is "armed" (a storm is in progress and the wall is sweeping). When
   *  false the wall is dormant and intensity stays 0. */
  active: boolean;
  /** XZ position of the wall's CENTER line (world units). The wall is a slab
   *  perpendicular to `dir`, centered here, `width` units thick. */
  posX: number;
  posZ: number;
  /** Unit travel direction in XZ (the wall sweeps along +dir). */
  dirX: number;
  dirZ: number;
  /** Half-thickness of the full-intensity core (world units). */
  width: number;
  /** Travel speed (world units / sec). */
  speed: number;
  /** Seconds since this wall armed — lets the state machine know when to
   *  retire it independently of where the player happens to stand. */
  age: number;
  /** True while the wall is still travelling toward / over the player's
   *  region; flips false once it has swept well past, so the settling phase
   *  can wind down even if the player chased it. */
  approaching: boolean;
}

interface DustLayer {
  particles: THREE.Points;
  mat: THREE.PointsMaterial;
  /** C20 — the layer's un-dimmed albedo. The dust is unlit + toneMapped:false, so
   *  it ignored the storm's sun/ambient dimming and popped as bright specks vs the
   *  darkened sky; updateWeather scales mat.color = baseColor · (1 − sunDim·intensity)
   *  so the dust dims in lockstep with the scene instead of out-luminancing it. */
  baseColor: THREE.Color;
  vels: Float32Array;
  count: number;
  spread: number;
  // Wrap range along Y is fixed per-layer (small for near, bigger for far).
  yWrapHalf: number;
}

export interface Weather {
  state: WeatherState;
  intensity: number;     // 0..1, drives fog/sky/thirst/audio (world truth)
  /** ACAB (Cycle 6) — daytime cloud cover 0..1, INDEPENDENT of the storm cycle
   *  (clear↔overcast days), eased toward a slow deterministic target each
   *  frame; storms force it high. Drives the sky cloud shader + (Tier 3) the
   *  overcast lighting flatten + star occlusion. Derived/transient — not
   *  persisted (re-seeds from elapsed time on load), so additive, no save bump. */
  cloudiness: number;
  /** ACAB — dev/test override: when non-null, cloudiness is pinned here
   *  (the `sky` rig-shot scenario + `__game.setCloudiness`) instead of easing
   *  toward the auto cover target. null = automatic. */
  cloudinessHold: number | null;
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
  // review 2026-07-14 — `streak` is a fast, elongated near-field layer (sand DRIVEN
  // past you); ramps in above STORM_STREAK_RAMP_LO so it only reads in a real blow.
  layers: { near: DustLayer; mid: DustLayer; far: DustLayer; streak: DustLayer };
  /** review 2026-07-14 — the visible approaching dust WALL (Dune/Mad-Max front). */
  dustWall: DustWall;
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
  /** ACL SKY+WEATHER — sweeping sandstorm wall. PERSISTED (saveField). The
   *  active wall's position/dir/age drive `intensity` each tick; persisting it
   *  means a storm mid-sweep resumes correctly across save/load. */
  wall: StormWall;
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
  // C20 — softer, feathered falloff (lower peak alpha) so a mote reads as an
  // out-of-focus dust smudge, not a crisp bright point (the snow/flake tell).
  grad.addColorStop(0, 'rgba(255,255,255,0.78)');
  grad.addColorStop(0.4, 'rgba(255,255,255,0.38)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 32, 32);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// One shared texture across the round-mote layers.
const _sharedDustTex = (() => {
  // Defer creation to runtime (document available).
  let cached: THREE.CanvasTexture | null = null;
  return () => {
    if (!cached) cached = makeDustTexture();
    return cached;
  };
})();

// review 2026-07-14 — an elongated, horizontally-smeared streak sprite for the driven-
// sand layer. Drawn as a wide, thin soft ellipse so each mote reads as a wind streak
// (a motion-blur smudge) rather than a round dot.
function makeStreakTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d');
  if (!g) throw new Error('canvas 2d unavailable');
  g.clearRect(0, 0, 32, 32);
  g.save();
  g.translate(16, 16);
  g.scale(1.0, 0.24);          // squash vertically → a horizontal streak
  const grad = g.createRadialGradient(0, 0, 0, 0, 0, 16);
  grad.addColorStop(0, 'rgba(255,255,255,0.72)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.30)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.beginPath();
  g.arc(0, 0, 16, 0, Math.PI * 2);
  g.fill();
  g.restore();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
const _sharedStreakTex = (() => {
  let cached: THREE.CanvasTexture | null = null;
  return () => {
    if (!cached) cached = makeStreakTexture();
    return cached;
  };
})();

const BUILD_DURATION = 8;
const SETTLE_DURATION = 12;

// ACL SKY+WEATHER — sweeping sandstorm wall tuning. Promoted to Tuning (integration).
const STORM_WALL_WIDTH = Tuning.STORM_WALL_WIDTH;          // half-thickness (world u) of the full-intensity core
const STORM_WALL_SPEED = Tuning.STORM_WALL_SPEED;          // wall travel speed (world u / sec)
const STORM_WALL_SPAWN_DIST = Tuning.STORM_WALL_SPAWN_DIST;     // distance upwind the wall spawns ahead of the player
const STORM_WALL_APPROACH_FALLOFF = Tuning.STORM_WALL_APPROACH_FALLOFF; // ramp distance (u) over which intensity rises as wall nears
const STORM_WALL_DEPART_FALLOFF = Tuning.STORM_WALL_DEPART_FALLOFF; // ramp distance (u) over which intensity falls as wall departs
// The wall retires (storm ends) once it has swept this far past the player
// region, OR the legacy duration elapses — whichever first. Keeps storms
// bounded even if the player walks alongside the wall.
const STORM_WALL_RETIRE_DIST = Tuning.STORM_WALL_RETIRE_DIST;    // signed-distance past player at which the wall is spent
const STORM_WALL_WIND_BIAS = Tuning.STORM_WALL_WIND_BIAS;      // extra wind (u/s) along wall dir at full intensity (mid-layer base)

/** ACL SKY+WEATHER — signed distance from the wall's center plane to the
 *  player, measured along the travel direction. Negative = wall hasn't
 *  reached the player yet (approaching); 0 = player at the wall core;
 *  positive = wall has passed the player (departing). */
function wallSignedDistance(wall: StormWall, px: number, pz: number): number {
  // Vector from wall center to player, projected onto travel dir. As the wall
  // moves along +dir, this projection grows — so > 0 means the wall front is
  // at/past the player.
  const dx = px - wall.posX;
  const dz = pz - wall.posZ;
  return dx * wall.dirX + dz * wall.dirZ;
}

/** ACL SKY+WEATHER — derive the carrier intensity (0..1) from the player's
 *  position relative to the wall. Approaching ramps up over
 *  APPROACH_FALLOFF, peaks (=1) while within ±width of the core, then ramps
 *  down over DEPART_FALLOFF as it passes. */
function wallIntensityAt(wall: StormWall, px: number, pz: number): number {
  if (!wall.active) return 0;
  const signed = wallSignedDistance(wall, px, pz);
  if (signed < -wall.width) {
    // Wall front still approaching. signed in [-(width+falloff), -width] → 0..1.
    const d = -signed - wall.width; // 0 at the leading edge, grows as wall is farther
    return Math.max(0, 1 - d / STORM_WALL_APPROACH_FALLOFF);
  }
  if (signed > wall.width) {
    // Wall has passed; departing trailing edge.
    const d = signed - wall.width;
    return Math.max(0, 1 - d / STORM_WALL_DEPART_FALLOFF);
  }
  // Inside the core slab — peak.
  return 1;
}

/** ACL SKY+WEATHER — arm a fresh wall upwind of the player, heading toward and
 *  across them. Direction is randomized; the wall is placed STORM_WALL_SPAWN_DIST
 *  back along -dir so it sweeps over the player as it travels +dir. */
/** review 2026-07-16 — bias the arming heading toward the player's VIEW direction so the
 *  front is seen COMING AT you instead of tracking across the horizon.
 *
 *  The wall spawns at `-dir * SPAWN_DIST` and travels along `+dir`, so it arrives FROM the
 *  `-dir` side. For a head-on approach we therefore want `dir ≈ -view`. A fully random
 *  heading (the old behaviour) armed the front off-screen most of the time — by the time
 *  the player noticed it, it was already abeam, and all that remained to perceive was
 *  lateral drift. We keep a ±STORM_WALL_HEADING_BIAS_DEG spread so it is a bias, not a
 *  lock: the wall still arrives off-axis and crosses obliquely, it just starts in view.
 *
 *  `viewX/viewZ` = the camera's forward XZ (need not be normalised). Omit/zero → uniform
 *  random (the opening-storm + save-restore paths, where there is no meaningful view yet).
 *  Uses Math.random, NOT the seeded chunk/scatter stream — no procgen seed-stability impact. */
function armWall(
  wall: StormWall, px: number, pz: number, rand: () => number,
  viewX = 0, viewZ = 0,
): void {
  let heading: number;
  const viewLen2 = viewX * viewX + viewZ * viewZ;
  if (viewLen2 > 1e-6) {
    // dir = -view ⇒ heading = atan2(-viewZ, -viewX) (dirX=cos, dirZ=sin).
    const headOn = Math.atan2(-viewZ, -viewX);
    const spread = (Tuning.STORM_WALL_HEADING_BIAS_DEG * Math.PI) / 180;
    heading = headOn + (rand() * 2 - 1) * spread;
  } else {
    heading = rand() * Math.PI * 2;
  }
  const dirX = Math.cos(heading);
  const dirZ = Math.sin(heading);
  wall.active = true;
  wall.dirX = dirX;
  wall.dirZ = dirZ;
  // Place the wall center upwind: back along -dir from the player so it's
  // still approaching at storm start.
  wall.posX = px - dirX * STORM_WALL_SPAWN_DIST;
  wall.posZ = pz - dirZ * STORM_WALL_SPAWN_DIST;
  wall.width = STORM_WALL_WIDTH;
  wall.speed = STORM_WALL_SPEED;
  wall.age = 0;
  wall.approaching = true;
}
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
  tex?: THREE.CanvasTexture;  // review 2026-07-14 — per-layer sprite (default = round mote)
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
    map: cfg.tex ?? _sharedDustTex(),
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
  return { particles, mat, baseColor: mat.color.clone(), vels, count: cfg.count, spread: cfg.spread, yWrapHalf: cfg.yWrapHalf };
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
    color: 0xae8658,   // C20 — dimmed from 0xd8b888: toneMapped:false dust ignored the storm exposure-dim → bright specks popped (snow-read) vs the darkened sky. Still the brightest (warm-gold) layer.
    velMean: [7.5, 0, -3.0],
    velSpread: [2.0, 0.6, 1.8],
  });
  // MID layer: existing storm cloud. Mid-range size + speed + the old rust tint.
  const mid = buildLayer(scene, {
    count: Tuning.STORM_DUST_MID_COUNT,
    spread: Tuning.STORM_DUST_MID_SPREAD,
    yWrapHalf: 10,
    size: 0.32,
    color: 0x947048,   // C20 — dimmed from 0xc8a070 toward the dimmed storm tone (was popping bright vs the dark sky)
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
    color: 0x60492f,   // C20 — far layer biased MOST toward the fog/sky murk so it recedes into haze instead of sparkling (dimmed from 0x8c6850)
    velMean: [2.5, 0, -1.2],
    velSpread: [0.8, 0.3, 0.7],
  });
  // STREAK layer (review 2026-07-14): fast, elongated near-field motes — the air
  // reads as thick with sand DRIVEN past you. High horizontal velocity + the
  // horizontal streak sprite; ramps in only once the storm is a real blow.
  const streak = buildLayer(scene, {
    count: Tuning.STORM_DUST_STREAK_COUNT,
    spread: Tuning.STORM_DUST_STREAK_SPREAD,
    yWrapHalf: 8,
    size: 0.55,
    color: 0xa07a52,
    velMean: [16.0, 0, -5.0],
    velSpread: [4.0, 0.8, 3.0],
    tex: _sharedStreakTex(),
  });

  // Initial nextStormAt uses day-0 curve (the player just started).
  const initCurve = stormCurveAt(0);
  return {
    state: 'clear',
    intensity: 0,
    cloudiness: 0,         // ACAB — eased toward the slow cover target in updateWeather
    cloudinessHold: null,
    perceivedIntensity: 0,
    stateTimer: 0,
    nextStormAt:
      initCurve.intervalMin + Math.random() * (initCurve.intervalMax - initCurve.intervalMin),
    layers: { near, mid, far, streak },
    dustWall: createDustWall(scene),
    cameraRef: camera,
    currentStormDuration: initCurve.duration,
    longStormAnnounced: false,
    // ACL SKY+WEATHER — wall dormant until a storm arms it.
    wall: {
      active: false,
      posX: 0, posZ: 0,
      dirX: 1, dirZ: 0,
      width: STORM_WALL_WIDTH,
      speed: STORM_WALL_SPEED,
      age: 0,
      approaching: true,
    },
  };
}

const _camPos = new THREE.Vector3();
// review 2026-07-16 — scratch for the arming heading bias (camera forward XZ). Shared, no
// per-call alloc; only read during the rare clear→building transition.
const _viewFwd = new THREE.Vector3();

// ACL SKY+WEATHER — extra wind bias (world u/s) applied on top of each
// particle's baked velocity, aligned with the sweeping wall's travel dir.
// `windScale` per-layer lets far dust drift more anisotropically than near.
function stepLayer(
  layer: DustLayer,
  opacity: number,
  visible: boolean,
  dt: number,
  windX: number,
  windZ: number,
): void {
  layer.mat.opacity = opacity;
  if (layer.particles.visible !== visible) layer.particles.visible = visible;
  if (!visible) return;
  const half = layer.spread / 2;
  const yHalf = layer.yWrapHalf;
  const arr = layer.particles.geometry.attributes.position.array as Float32Array;
  const vels = layer.vels;
  for (let i = 0; i < layer.count; i++) {
    const ix = i * 3;
    arr[ix]     += (vels[ix]     + windX) * dt;
    arr[ix + 1] += vels[ix + 1] * dt;
    arr[ix + 2] += (vels[ix + 2] + windZ) * dt;
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

  // ACL SKY+WEATHER — player XZ drives both wall spawning and the
  // distance-derived intensity. Read once per tick.
  const ptr = getPlayerWorldPos(ctx);   // ACBD — speeder seat while mounted, else player body (was reading the off-world-parked body → storm desync)
  const px = ptr.x;
  const pz = ptr.z;
  const wall = w.wall;

  // Advance the sweeping wall whenever it's armed (any non-clear state).
  if (wall.active) {
    wall.posX += wall.dirX * wall.speed * dt;
    wall.posZ += wall.dirZ * wall.speed * dt;
    wall.age += dt;
    // Has the wall core swept well past the player? Then it's departing.
    const signed = wallSignedDistance(wall, px, pz);
    wall.approaching = signed < wall.width;
  }

  switch (w.state) {
    case 'clear':
      w.intensity = 0;
      wall.active = false;
      if (ctx.time.elapsed >= w.nextStormAt) {
        w.state = 'building';
        w.stateTimer = 0;
        // Capture this storm's duration at start so a day-rollover
        // mid-storm doesn't shorten what the player's already enduring.
        w.currentStormDuration = curve.duration;
        // ACL SKY+WEATHER — arm a fresh wall upwind of the player. It sweeps
        // across them; intensity now derives from distance to the wall.
        // review 2026-07-16 — biased toward the player's view so the front arrives
        // head-on-ish and reads as approaching, not sliding past.
        w.cameraRef.getWorldDirection(_viewFwd);
        armWall(wall, px, pz, Math.random, _viewFwd.x, _viewFwd.z);
      }
      break;
    case 'building':
      // ACL SKY+WEATHER — intensity is wall-derived, but gated by a short
      // build envelope so even a wall that spawns close still eases in.
      w.intensity = wallIntensityAt(wall, px, pz) * Math.min(1, w.stateTimer / BUILD_DURATION);
      if (w.stateTimer >= BUILD_DURATION) {
        w.state = 'storm';
        w.stateTimer = 0;
      }
      break;
    case 'storm':
      // Pure wall-derived intensity: peaks while the player is inside the
      // wall slab, ramps as it approaches/departs.
      w.intensity = wallIntensityAt(wall, px, pz);
      // End the storm once the legacy duration elapses OR the wall has swept
      // STORM_WALL_RETIRE_DIST past the player (whichever first) — keeps the
      // storm bounded even if the player chased or fled the wall.
      if (
        w.stateTimer >= w.currentStormDuration ||
        wallSignedDistance(wall, px, pz) > wall.width + STORM_WALL_RETIRE_DIST
      ) {
        w.state = 'settling';
        w.stateTimer = 0;
      }
      break;
    case 'settling':
      // Let the wall keep departing (its own falloff lowers intensity), but
      // also floor it down over SETTLE_DURATION so we always reach 0.
      w.intensity =
        wallIntensityAt(wall, px, pz) * Math.max(0, 1 - w.stateTimer / SETTLE_DURATION);
      if (w.stateTimer >= SETTLE_DURATION) {
        w.state = 'clear';
        w.stateTimer = 0;
        wall.active = false;
        w.nextStormAt =
          ctx.time.elapsed +
          curve.intervalMin +
          Math.random() * (curve.intervalMax - curve.intervalMin);
      }
      break;
  }

  // ── ACAB (Cycle 6) — daytime cloud cover (clear↔overcast days). ──
  // A slow deterministic wander (two desynced sines, gamma-biased toward clear
  // so clear days are more common than overcast) gives the daytime sky its
  // variation INDEPENDENT of the storm cycle. Storms force it toward overcast.
  // Eased so the cover changes gradually. `cloudinessHold` (dev/test) pins it.
  if (w.cloudinessHold !== null) {
    w.cloudiness = w.cloudinessHold;
  } else {
    const tt = (ctx.time.elapsed / Tuning.CLOUD_COVER_NOISE_PERIOD_S) * Math.PI * 2;
    const a = Math.sin(tt) * 0.5 + 0.5;
    const b = Math.sin(tt * 0.37 + 1.3) * 0.5 + 0.5;
    let target = Math.pow(a * 0.6 + b * 0.4, 1.6);          // 0..1, biased toward clear
    if (w.state !== 'clear') {
      // Telegraph: the sky goes clearly overcast the moment a storm starts
      // BUILDING (low dust), then deepens toward full as the dust intensifies.
      target = Math.max(target, 0.6 + (Tuning.CLOUD_STORM_FLOOR - 0.6) * w.intensity);
    }
    w.cloudiness += (target - w.cloudiness) * Math.min(1, Tuning.CLOUD_COVER_LERP_RATE * dt);
  }

  // FogExp2 density curve. Smoothstep from CLEAR→STORM density. review 2026-07-15
  // (TOTAL whiteout) — the fog now collapses visibility EARLIER in the ramp: full
  // storm density is reached by intensity STORM_FOG_RAMP_HI (~0.6), not at the very
  // peak, so distant wrecks + the terrain horizon fog out well before the wall engulfs
  // you. The approach (low intensity) still holds the near wreck clear. Color set in
  // updateLighting.
  const fog = ctx.three.scene.fog as THREE.FogExp2;
  const densityT = ramp(w.intensity, 0, Tuning.STORM_FOG_RAMP_HI);
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

  // Far dust fades back down at PEAK (review 2026-07-14) — once the whiteout fog
  // fills the distance, distant specks would pop against the luminous brownout, so
  // recede the far layer as the near air thickens.
  const farOp =
    ramp(pi, Tuning.STORM_FAR_RAMP_LO, Tuning.STORM_FAR_RAMP_HI) *
    Tuning.STORM_DUST_FAR_OPACITY * (1 - 0.6 * ramp(pi, 0.6, 1.0));
  const midOp = pi * Tuning.STORM_DUST_MID_OPACITY;
  const nearOp =
    ramp(pi, Tuning.STORM_NEAR_RAMP_LO, Tuning.STORM_NEAR_RAMP_HI) *
    Tuning.STORM_DUST_NEAR_OPACITY;
  const streakOp =
    ramp(pi, Tuning.STORM_STREAK_RAMP_LO, Tuning.STORM_STREAK_RAMP_HI) *
    Tuning.STORM_DUST_STREAK_OPACITY;

  // ACL SKY+WEATHER — anisotropic wind: while the wall is active, bias the
  // dust drift along the wall's travel direction (scaled by perceived
  // intensity so it eases in/out). Far dust gets the strongest bias (it
  // reads as the leading edge streaming across the horizon); near dust the
  // least so the close parallax cue stays legible.
  let windX = 0;
  let windZ = 0;
  if (wall.active) {
    const k = pi * STORM_WALL_WIND_BIAS;
    windX = wall.dirX * k;
    windZ = wall.dirZ * k;
  }

  // C20 — couple the (unlit, toneMapped:false) dust brightness to the storm's
  // scene-dimming. The storm dims sun/ambient by STORM_SUN_DIM·intensity, but the
  // dust ignored that and popped as bright specks against the darkened sky (a
  // snow/flurry read). Scale each layer's albedo down in lockstep so the dust sits
  // IN the murk at peak, while staying bright in a light/early storm.
  const dustDim = 1 - Tuning.STORM_SUN_DIM * pi;
  w.layers.far.mat.color.copy(w.layers.far.baseColor).multiplyScalar(dustDim);
  w.layers.mid.mat.color.copy(w.layers.mid.baseColor).multiplyScalar(dustDim);
  w.layers.near.mat.color.copy(w.layers.near.baseColor).multiplyScalar(dustDim);
  w.layers.streak.mat.color.copy(w.layers.streak.baseColor).multiplyScalar(dustDim);

  stepLayer(w.layers.far, farOp, farOp > 0.001, dt, windX * 1.4, windZ * 1.4);
  stepLayer(w.layers.mid, midOp, midOp > 0.001, dt, windX, windZ);
  stepLayer(w.layers.near, nearOp, nearOp > 0.001, dt, windX * 0.6, windZ * 0.6);
  // Streaks get the STRONGEST wind bias so they rip past along the wall's travel dir.
  stepLayer(w.layers.streak, streakOp, streakOp > 0.001, dt, windX * 1.7, windZ * 1.7);

  // ── The approaching DUSTWALL (review 2026-07-14). Seat it at the storm wall's
  //    leading edge, facing the player, opacity ramped by how far ahead of the player
  //    that edge is — fades IN on the far horizon, looms at full, then dissolves into
  //    the whiteout fog as it engulfs. Uses WORLD intensity (the front is a world
  //    object, visible regardless of the player's shelter). ──
  {
    const dw = w.dustWall;
    // Signed distance of the player from the wall core along travel dir. The leading
    // (player-facing) edge is at signed = +width from the core; approachDist = how far
    // ahead of the player that edge still is (only meaningful while approaching).
    const signed = wallSignedDistance(wall, px, pz);
    const approachDist = signed - wall.width;   // >0 while the front hasn't reached the player
    // World leading-edge XZ = wall center + dir * width.
    const edgeX = wall.posX + wall.dirX * wall.width;
    const edgeZ = wall.posZ + wall.dirZ * wall.width;
    // Distance-driven opacity: fade in FAR→FULL, hold, fade out NEAR→GONE.
    let op = 0;
    if (wall.active && approachDist > Tuning.STORM_DUSTWALL_FADE_GONE) {
      // inT: rises 0→1 as the edge closes FADE_FAR→FADE_FULL. outT: falls 1→0 as the
      // edge passes FADE_NEAR→FADE_GONE (engulfing — the whiteout fog takes over).
      const inT = 1 - ramp(approachDist, Tuning.STORM_DUSTWALL_FADE_FULL, Tuning.STORM_DUSTWALL_FADE_FAR);
      const outT = ramp(approachDist, Tuning.STORM_DUSTWALL_FADE_GONE, Tuning.STORM_DUSTWALL_FADE_NEAR);
      op = inT * outT;
    }
    // Ground the base a touch below terrain so there's no floating gap at its foot.
    const edgeGroundY = ctx.terrain.heightAt(edgeX, edgeZ);
    const baseY = Math.min(edgeGroundY, ctx.terrain.heightAt(px, pz)) - Tuning.STORM_DUSTWALL_LIFT - 25;
    updateDustWall(dw, {
      visible: wall.active && op > 0.002,
      edgeX, edgeZ, baseY,
      // Wind-locked orientation: pass the wall's fixed travel heading (NOT the player
      // position) so the wall never re-yaws to face the player → no spin/wrap.
      dirX: wall.dirX, dirZ: wall.dirZ,
      opacity: op,
      elapsed: ctx.time.elapsed,
      wind: Math.min(1.5, w.intensity * 1.2),
    });
  }
}

/** Convenience: trigger a storm immediately. Used by debug panel. */
export function triggerStorm(ctx: GameContext): void {
  ctx.weather.state = 'building';
  ctx.weather.stateTimer = 0;
  // ACL SKY+WEATHER — arm the sweeping wall upwind of the player so the
  // debug-triggered storm actually ramps in (intensity is wall-derived).
  const tr = getPlayerWorldPos(ctx);
  // review 2026-07-16 — same view bias as the natural storm path, so a debug-triggered
  // storm reproduces what the player actually sees.
  ctx.weather.cameraRef.getWorldDirection(_viewFwd);
  armWall(ctx.weather.wall, tr.x, tr.z, Math.random, _viewFwd.x, _viewFwd.z);
}

/**
 * Seed a sandstorm at boot for the opening scene (Session W). Drops
 * straight into the 'storm' state with the state timer pre-advanced so the
 * storm transitions to 'settling' after ~18 s and is fully clear ~30 s
 * after spawn (12 s of settling).
 *
 * ACL SKY+WEATHER — intensity is now WALL-derived, so we must arm a wall
 * for the opening beat too. The player spawns near origin; we center the
 * wall ON the origin (player inside the core ⇒ peak intensity = 1) and give
 * it a heading so it sweeps off over the following seconds.
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
  // ACL — arm a wall centered on origin so the freshly-spawned player (near
  // 0,0) sits inside the full-intensity core from the first frame.
  weather.wall.active = true;
  weather.wall.posX = 0;
  weather.wall.posZ = 0;
  weather.wall.dirX = 1;
  weather.wall.dirZ = 0;
  weather.wall.width = STORM_WALL_WIDTH;
  weather.wall.speed = STORM_WALL_SPEED;
  weather.wall.age = 0;
  weather.wall.approaching = false;
}

// ACW E (#146) — horizontal wind acceleration (world u/s²) from the active
// storm wall, directed along the wall's travel direction and scaled by the
// WORLD intensity (loose objects are pushed regardless of where the player
// shelters — perceivedIntensity is a player-felt quantity, not a world force).
// Returns a shared scratch (no per-frame alloc); callers read .x/.z at once.
const _windAccel = { x: 0, z: 0 };
export function stormWindAccel(weather: Weather): { x: number; z: number } {
  const w = weather.wall;
  if (!w.active || weather.intensity <= 0.02) {
    _windAccel.x = 0; _windAccel.z = 0;
    return _windAccel;
  }
  const mag = weather.intensity * Tuning.STORM_WIND_PUSH_ACCEL;
  _windAccel.x = w.dirX * mag;
  _windAccel.z = w.dirZ * mag;
  return _windAccel;
}
