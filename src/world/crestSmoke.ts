// The Deep Desert cycle 7 — CREST SMOKE (the signature erg image).
//
// Wind-blown sand streaming off the mega-dune crests. A pooled sprite system
// (like ambientDust / the storm layers), but this one only lives inside an erg:
// each puff seeks the nearest RIDGE LINE along the erg's own wind axis, is born
// at the lip, then streams downwind + lifts + thins over its short life before
// re-seeding at a fresh crest. Calm days = thin wisps; a rising wind = full
// streaming spindrift (intensity tracks the SAME weather the storm system reads).
//
// Cheap: a small pool, ~3 pure-height samples per puff only on RESPAWN (a
// gradient walk to the ridge), a drift step per frame. Pause-gated (only ticked
// on the live path) and distance-culled: the whole layer hides the instant the
// player leaves an erg. Lighting-invariant — the puff colour is scaled by sun
// height so it NEVER glows at night (NormalBlending, not additive).
//
// This module ALSO owns the FIRST-CREST DISCOVERY beat (piece 4): the one-time
// "the deep desert" line + a warm swell when the player first tops a mega-dune
// crest inside an erg. It piggybacks here because it needs the same erg + terrain
// samples; persistence is the tutorial flag store (maybeShowEventHint), so it
// fires once ever per save.

import * as THREE from 'three';
import type { GameContext } from '../GameContext.ts';
import { Tuning } from '../config/tuning.ts';
import { getPlayerWorldPos } from '../player/effectivePos.ts';
import { maybeShowEventHint } from '../ui/tutorial.ts';
import { playVistaReveal } from '../audio/audio.ts';

export interface CrestSmoke {
  particles: THREE.Points;
  mat: THREE.ShaderMaterial;
  /** Per-puff scratch state: age + a spawn phase for lateral ridge jitter. */
  age: Float32Array;
  seeded: Uint8Array;      // 0 = needs (re)seed to a crest this frame
  cameraRef: THREE.PerspectiveCamera;
}

const VERT = /* glsl */`
  attribute float aAlpha;
  varying float vAlpha;
  uniform float uSize;
  uniform float uScale;   // drawingBufferHeight * 0.5 (three's size-attenuation convention)
  void main() {
    vAlpha = aAlpha;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = uSize * (uScale / max(1.0, -mv.z));
    gl_PointSize = clamp(gl_PointSize, 0.0, 128.0);
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAG = /* glsl */`
  precision mediump float;
  varying float vAlpha;
  uniform vec3 uColor;
  uniform float uOpacity;
  void main() {
    // Soft round spindrift puff — feathered radial falloff.
    vec2 d = gl_PointCoord - vec2(0.5);
    float r = length(d);
    float a = smoothstep(0.5, 0.06, r);
    float alpha = a * vAlpha * uOpacity;
    if (alpha < 0.003) discard;
    gl_FragColor = vec4(uColor, alpha);
  }
`;

export function createCrestSmoke(
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
): CrestSmoke {
  const count = Tuning.ERG_SMOKE_COUNT;
  const positions = new Float32Array(count * 3);
  const alpha = new Float32Array(count);
  // Seed everything below the world so nothing shows until the first update
  // places it on a real crest (respawn on frame 1).
  for (let i = 0; i < count; i++) {
    positions[i * 3 + 1] = -9999;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1));

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uSize: { value: Tuning.ERG_SMOKE_SIZE },
      uScale: { value: 400 },
      uColor: { value: new THREE.Color(0xcbb290) },
      uOpacity: { value: Tuning.ERG_SMOKE_OPACITY },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    depthTest: true,          // terrain occludes puffs behind/below the sand — free spatial cull
    blending: THREE.NormalBlending,   // NOT additive → no night glow
  });

  const particles = new THREE.Points(geo, mat);
  particles.frustumCulled = false;
  particles.visible = false;
  scene.add(particles);

  return {
    particles,
    mat,
    age: new Float32Array(count),
    seeded: new Uint8Array(count),   // 0 → needs seed
    cameraRef: camera,
  };
}

const _camPos = new THREE.Vector3();

// ── First-crest discovery beat state (piece 4). Transient sampling throttle;
//    persistence is the tutorial flag store, so this only gates the sampling. ──
let _discoAccum = 0;

/** Reset on world rebuild (Continue / new game). Only the sampling throttle is
 *  runtime state; the once-ever fired flag lives in localStorage. */
export function resetCrestSmoke(): void {
  _discoAccum = 0;
}

export function updateCrestSmoke(ctx: GameContext, dt: number): void {
  const cs = ctx.crestSmoke;
  if (!cs) return;

  const p = getPlayerWorldPos(ctx);
  const erg = ctx.biomes.ergInfoAt(p.x, p.z);

  // ── Distance cull: no erg here → hide the whole layer, do nothing. ──
  if (!erg || erg.mask <= 0.001) {
    if (cs.particles.visible) cs.particles.visible = false;
    return;
  }

  // ── First-crest discovery (piece 4). Throttled prominence check; fires once
  //    ever (maybeShowEventHint persists it). Suppressed in a storm (the awe
  //    beat wants the clear sweeping vista, not a whiteout). ──
  _discoAccum += dt;
  if (_discoAccum >= 0.5) {
    _discoAccum = 0;
    if (erg.mask > 0.5 && ctx.weather.intensity < 0.4) {
      const ph = ctx.terrain.heightAt(p.x, p.z);
      let sum = 0;
      const R = 60;
      for (let d = 0; d < 6; d++) {
        const a = (d / 6) * Math.PI * 2;
        sum += ctx.terrain.heightAt(p.x + Math.cos(a) * R, p.z + Math.sin(a) * R);
      }
      const prominence = ph - sum / 6;
      if (prominence > Tuning.ERG_DISCOVERY_PROMINENCE_M) {
        // Once ever per save — the tutorial flag store guards re-firing (persists
        // across save/load). fireDiscovery returns true ONLY on the call that
        // actually flips the flag absent→present, so the warm reveal swell pairs
        // with the laconic line exactly once (no camera theft, no double-fire).
        if (fireDiscovery(ctx)) playVistaReveal(1);
      }
    }
  }

  if (!cs.particles.visible) cs.particles.visible = true;

  // ── Brightness: lighting-invariant. Scale the puff colour by sun height so
  //    smoke reads bright by day and goes dark (never glows) at night. ──
  const lo = Tuning.ERG_SMOKE_NIGHT_FADE_LO;
  const hi = Tuning.ERG_SMOKE_NIGHT_FADE_HI;
  const dayF = Math.max(0.06, Math.min(1, (ctx.time.sunHeight - lo) / (hi - lo)));
  (cs.mat.uniforms.uColor.value as THREE.Color).setRGB(0.80 * dayF, 0.70 * dayF, 0.56 * dayF);
  // Size-attenuation scale = drawingBufferHeight * 0.5 (three's convention).
  cs.mat.uniforms.uScale.value = (typeof window !== 'undefined' ? window.innerHeight : 800) * 0.5;

  // ── Wind: the drift speed scales with the SAME weather the storm exposes,
  //    plus a slow always-on breeze so calm days still wisp. Mask by erg core so
  //    smoke thins toward the border. ──
  const windRad = erg.windRad;
  const wdx = Math.cos(windRad), wdz = Math.sin(windRad);
  // perpendicular (ridge) axis
  const rdx = -wdz, rdz = wdx;
  const breeze = 0.22 + 0.12 * Math.sin(ctx.time.elapsed * 0.13);
  const windK = Math.max(breeze, ctx.weather.intensity);     // 0..1
  const drift = Tuning.ERG_SMOKE_DRIFT_BASE + (Tuning.ERG_SMOKE_DRIFT_STORM - Tuning.ERG_SMOKE_DRIFT_BASE) * windK;
  const lift = Tuning.ERG_SMOKE_LIFT * (0.5 + 0.5 * windK);
  // Overall layer opacity: a legible wisp on calm, full stream at wind; ·erg mask.
  cs.mat.uniforms.uOpacity.value = Tuning.ERG_SMOKE_OPACITY * (0.45 + 0.55 * windK) * erg.mask;

  _camPos.copy(cs.cameraRef.position);
  const spread = Tuning.ERG_SMOKE_SPREAD;
  const half = spread / 2;
  const life = Tuning.ERG_SMOKE_LIFE_S;
  const posAttr = cs.particles.geometry.attributes.position;
  const arr = posAttr.array as Float32Array;
  const aAttr = cs.particles.geometry.attributes.aAlpha;
  const aArr = aAttr.array as Float32Array;
  const age = cs.age;
  const count = Tuning.ERG_SMOKE_COUNT;
  const terrain = ctx.terrain;

  for (let i = 0; i < count; i++) {
    const ix = i * 3;
    age[i] += dt;

    // (Re)seed to a fresh crest when the puff is spent, or the first time.
    if (age[i] >= life || cs.seeded[i] === 0) {
      // Random XZ in the camera box.
      let sx = _camPos.x + (Math.random() - 0.5) * spread;
      let sz = _camPos.z + (Math.random() - 0.5) * spread;
      // Walk UPHILL along the wind axis to the ridge line (gradient ascent).
      // The windward face is the gentle rise; stepping +wind climbs to the crest.
      const step = Tuning.ERG_SMOKE_WIND_M;
      let hHere = terrain.heightAt(sx, sz);
      for (let k = 0; k < 7; k++) {
        const fx = sx + wdx * step, fz = sz + wdz * step;
        const bx = sx - wdx * step, bz = sz - wdz * step;
        const hF = terrain.heightAt(fx, fz);
        const hB = terrain.heightAt(bx, bz);
        if (hF > hHere && hF >= hB) { sx = fx; sz = fz; hHere = hF; }
        else if (hB > hHere) { sx = bx; sz = bz; hHere = hB; }
        else break;   // local max along wind → the ridge
      }
      // Spread laterally along the ridge line so it's a plume, not a seam.
      const j = (Math.random() - 0.5) * Tuning.ERG_SMOKE_RIDGE_SPREAD;
      sx += rdx * j; sz += rdz * j;
      arr[ix] = sx;
      arr[ix + 1] = terrain.heightAt(sx, sz) + 0.3;    // right on the lip
      arr[ix + 2] = sz;
      age[i] = Math.random() * 0.4;                    // desync so they don't pulse together
      cs.seeded[i] = 1;
    } else {
      // Stream downwind, HUGGING the dune surface (spindrift skims the sand — it
      // doesn't balloon), peeling up only gently over its life. A touch of lateral
      // ridge wander breaks the streaks apart into a veil.
      arr[ix] += (wdx * drift + rdx * 0.6 * Math.sin(ctx.time.elapsed * 0.7 + i)) * dt;
      arr[ix + 2] += (wdz * drift + rdz * 0.6 * Math.sin(ctx.time.elapsed * 0.7 + i)) * dt;
      const surf = terrain.heightAt(arr[ix], arr[ix + 2]);
      arr[ix + 1] = surf + 0.3 + lift * (age[i] / life);   // hug the surface + a gentle peel-up
    }

    // Fade envelope over life: quick attack off the lip, long thinning tail.
    const t = age[i] / life;
    aArr[i] = t < 0.15 ? (t / 0.15) : (1 - (t - 0.15) / 0.85);

    // If a puff strays outside the wrap box (player moved), force a reseed next
    // frame by marking it spent.
    if (Math.abs(arr[ix] - _camPos.x) > half || Math.abs(arr[ix + 2] - _camPos.z) > half) {
      age[i] = life;
    }
  }
  posAttr.needsUpdate = true;
  aAttr.needsUpdate = true;
}

// ── Discovery one-shot plumbing. maybeShowEventHint returns void + no-ops on
//    repeat, and persists its flag (`_evt_erg_first_crest`) in the tutorial
//    store. We read that flag BEFORE calling so we can report whether THIS call
//    is the one that fired (→ pairs the swell). No module session-flag: the
//    persisted store is the single source of truth, so a resetTutorial (or a
//    genuinely fresh save) correctly re-arms the beat. ──
function fireDiscovery(ctx: GameContext): boolean {
  let already = false;
  try {
    const raw = localStorage.getItem('dustfall.tutorial.v1');
    if (raw) {
      const parsed = JSON.parse(raw) as { usedItems?: string[] };
      already = Array.isArray(parsed.usedItems) && parsed.usedItems.includes('_evt_erg_first_crest');
    }
  } catch { /* no storage → treat as not-yet-fired */ }
  maybeShowEventHint(ctx, 'erg_first_crest', 'the deep desert');   // sets the flag; no-op if already present
  return !already;
}
