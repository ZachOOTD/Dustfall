// ACBE (D1) — SKYFALL: the crashing-wreck hero event. A burning wreck streaks across
// the sky on a descending arc, then CRASHES into the desert — flash, shockwave, dust
// plume, ejecta, camera shake, and a flash-then-delayed sonic boom — leaving a fire +
// smoke column. (Replaces the C34 sky-only fireball.)
//
// Tier 1 = the SPECTACLE (this file): flight → impact FX → a placeholder fire/smoke at
// the landing. Tier 2 swaps the placeholder for the full crater + enterable wreck + a
// persistent beacon + loot; Tier 4 persists it. The wreck-model + role drive later tiers
// (the role is rolled + stored now so save/replay is deterministic).
//
// Reuses: particleTrail.ts (fire/smoke/ejecta pools), fx/cameraShake + fx/screenFlash,
// fire.ts spawnFireAt, player/effectivePos getPlayerWorldPos, audio.ts crash synth.

import * as THREE from 'three';
import type { GameContext } from '../GameContext.ts';
import { Tuning } from '../config/tuning.ts';
import { getPlayerWorldPos } from '../player/effectivePos.ts';
import { spawnFireAt } from './fire.ts';
import { addTrauma } from '../fx/cameraShake.ts';
import { flashScreen, updateScreenFlash } from '../fx/screenFlash.ts';
import { playCrashImpact } from '../audio/audio.ts';
import {
  createParticleTrail, emitParticle, emitBurst, updateParticleTrail,
  type ParticleTrail,
} from './particleTrail.ts';

export type CrashRole = 'freighter' | 'liner' | 'military' | 'science' | 'mining';
const ROLES: CrashRole[] = ['freighter', 'liner', 'military', 'science', 'mining'];

interface ActiveCrash {
  seed: number;
  role: CrashRole;
  origin: THREE.Vector3;
  impact: THREE.Vector3;
  t: number;             // 0..1 flight progress
  flightS: number;
  impacted: boolean;
  boomDelay: number;     // s after impact the sound arrives (dist / speed-of-sound)
  boomTimer: number;
  ringT: number;         // shockwave ring progress (>=0 once impacted)
  finished: boolean;     // FSM fully done (FX faded) — ready to clear
}

let _scene: THREE.Scene | null = null;
let _crash: ActiveCrash | null = null;
let _nextAt: number = Tuning.CRASH_MIN_INTERVAL;

// Visual assets (built once, reused).
let _glowTex: THREE.Texture | null = null;
let _headGroup: THREE.Group | null = null;
let _headCore: THREE.Sprite | null = null;
let _headHalo: THREE.Sprite | null = null;
let _chunk: THREE.Mesh | null = null;         // the dark burning wreck silhouette at the head
let _ring: THREE.Mesh | null = null;          // ground shockwave ring
let _fireTrail: ParticleTrail | null = null;  // additive orange fire
let _smokeTrail: ParticleTrail | null = null; // alpha dark smoke (rises)
let _ejecta: ParticleTrail | null = null;     // debris/dust thrown at impact (falls)

function glowTexture(): THREE.Texture {
  if (_glowTex) return _glowTex;
  const W = 64;
  const c = document.createElement('canvas');
  c.width = W; c.height = W;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(W / 2, W / 2, 0, W / 2, W / 2, W / 2);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.35, 'rgba(255,238,205,0.92)');
  grd.addColorStop(0.7, 'rgba(255,150,70,0.4)');
  grd.addColorStop(1, 'rgba(255,120,40,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, W, W);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return (_glowTex = tex);
}

export function initMeteorCrash(scene: THREE.Scene): void {
  _scene = scene;
  const tex = glowTexture();

  _headHalo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: tex, color: 0xffae6a, blending: THREE.AdditiveBlending,
    transparent: true, depthWrite: false, fog: false,
  }));
  _headCore = new THREE.Sprite(new THREE.SpriteMaterial({
    map: tex, color: 0xfff4e6, blending: THREE.AdditiveBlending,
    transparent: true, depthWrite: false, fog: false,
  }));
  // The burning wreck silhouette — a small dark chunk inside the glow that tumbles, so
  // the head reads as a falling WRECK, not just a meteor.
  _chunk = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1, 0),
    new THREE.MeshBasicMaterial({ color: 0x140d08, fog: false }),
  );
  _chunk.scale.set(2.0, 1.3, 2.6);
  _headGroup = new THREE.Group();
  _headGroup.add(_headHalo, _headCore, _chunk);
  _headGroup.visible = false;
  _headGroup.renderOrder = 4;
  scene.add(_headGroup);

  // Ground shockwave ring — flat, expands + fades at impact.
  _ring = new THREE.Mesh(
    new THREE.RingGeometry(0.7, 1.0, 48),
    new THREE.MeshBasicMaterial({
      color: 0xbfa37a, transparent: true, opacity: 0, depthWrite: false,
      side: THREE.DoubleSide, fog: false,
    }),
  );
  _ring.rotation.x = -Math.PI / 2;
  _ring.visible = false;
  _ring.renderOrder = 2;
  scene.add(_ring);

  _fireTrail = createParticleTrail(scene, { count: 220, color: 0xff8c1a, opacity: 0.95, gravity: 0, renderOrder: 3 });
  (_fireTrail.points.material as THREE.ShaderMaterial).blending = THREE.AdditiveBlending;
  _smokeTrail = createParticleTrail(scene, { count: 340, color: 0x35302b, opacity: 0.5, gravity: -0.35, renderOrder: 2 });
  _ejecta = createParticleTrail(scene, { count: 90, color: 0x6a5a46, opacity: 0.7, gravity: 9.0, renderOrder: 2 });
}

/** Roll an impact point in the band around the player + a high-sky origin behind it. */
function planArc(ctx: GameContext, x?: number, z?: number): ActiveCrash {
  const p = getPlayerWorldPos(ctx);
  const ang = Math.random() * Math.PI * 2;
  const dist = Tuning.CRASH_IMPACT_DIST_MIN + Math.random() * (Tuning.CRASH_IMPACT_DIST_MAX - Tuning.CRASH_IMPACT_DIST_MIN);
  const ix = x ?? p.x + Math.cos(ang) * dist;
  const iz = z ?? p.z + Math.sin(ang) * dist;
  const iy = ctx.terrain.heightAt(ix, iz);
  const impact = new THREE.Vector3(ix, iy, iz);
  // The wreck enters from a random heading, descending ~34° (horizRun ≈ 1.5×alt).
  const heading = Math.random() * Math.PI * 2;
  const alt = Tuning.CRASH_START_ALT;
  const horizRun = alt * 1.5;
  const origin = new THREE.Vector3(
    ix - Math.cos(heading) * horizRun,
    iy + alt,
    iz - Math.sin(heading) * horizRun,
  );
  const seed = Math.floor(Math.random() * 1e9);
  return {
    seed, role: ROLES[seed % ROLES.length],
    origin, impact, t: 0, flightS: Tuning.CRASH_FLIGHT_S,
    impacted: false, boomDelay: 0, boomTimer: 0, ringT: -1, finished: false,
  };
}

/** Begin an ambient crash (random impact near the player). */
export function spawnCrash(ctx: GameContext): { x: number; z: number; role: CrashRole } | null {
  if (!_scene || _crash) return null;
  _crash = planArc(ctx);
  if (_headGroup) _headGroup.visible = true;
  return { x: _crash.impact.x, z: _crash.impact.z, role: _crash.role };
}

/** DEV — force a crash, optionally at (x,z). */
export function triggerCrash(ctx: GameContext, x?: number, z?: number): { x: number; z: number; role: CrashRole } | null {
  if (!_scene) return null;
  _crash = planArc(ctx, x, z);
  if (_headGroup) _headGroup.visible = true;
  return { x: _crash.impact.x, z: _crash.impact.z, role: _crash.role };
}

/** DEV/headless — step the active crash FSM deterministically by `seconds` (in `substeps`
 *  sub-steps so the trail builds + ages like the live sim, which runs slow headless). Pair
 *  with ctx.flags.paused = true so the main tick doesn't ALSO advance it. Decays the screen
 *  flash alongside so a captured post-impact frame isn't washed white. */
export function advanceCrash(ctx: GameContext, seconds: number, substeps = 40): void {
  if (!_crash) return;
  const dt = seconds / Math.max(1, substeps);
  for (let i = 0; i < substeps && _crash; i++) {
    updateMeteorCrash(ctx, dt);
    updateScreenFlash(ctx, dt);
  }
}

export function crashState(): { active: boolean; t: number; impacted: boolean; role: CrashRole | null; headPos: [number, number, number] | null } {
  const hp = (_crash && !_crash.impacted && _headGroup) ? _headGroup.position : null;
  return {
    active: !!_crash, t: _crash?.t ?? 0, impacted: _crash?.impacted ?? false,
    role: _crash?.role ?? null,
    headPos: hp ? [hp.x, hp.y, hp.z] : null,
  };
}

export function resetMeteorCrash(): void {
  _crash = null;
  _nextAt = Tuning.CRASH_MIN_INTERVAL;
  if (_headGroup) _headGroup.visible = false;
  if (_ring) { _ring.visible = false; (_ring.material as THREE.MeshBasicMaterial).opacity = 0; }
}

const _v = new THREE.Vector3();

function onImpact(ctx: GameContext, c: ActiveCrash): void {
  c.impacted = true;
  c.ringT = 0;
  const p = getPlayerWorldPos(ctx);
  const dist = Math.hypot(c.impact.x - p.x, c.impact.z - p.z);
  // Proximity 1 at the near edge of the band → ~0.25 at the far edge.
  const prox = THREE.MathUtils.clamp(1 - (dist - Tuning.CRASH_IMPACT_DIST_MIN) /
    (Tuning.CRASH_IMPACT_DIST_MAX - Tuning.CRASH_IMPACT_DIST_MIN), 0.2, 1);

  flashScreen(0xfff0dc, Tuning.CRASH_FLASH_STRENGTH * prox);
  addTrauma(Tuning.CRASH_SHAKE_TRAUMA * prox);

  // Dust mushroom plume (slow, rises) + debris ejecta (fast, radial, falls).
  if (_smokeTrail) emitBurst(_smokeTrail, c.impact.x, c.impact.y + 1, c.impact.z, Tuning.CRASH_PLUME_COUNT,
    { speed: 4, up: 6, life: 3.0, size: 6, posJitter: 3 });
  if (_ejecta) emitBurst(_ejecta, c.impact.x, c.impact.y + 0.5, c.impact.z, Tuning.CRASH_EJECTA_COUNT,
    { speed: 16, up: 9, life: 1.6, size: 1.2, posJitter: 1.5 });

  // Light a fire at the impact (Tier 1 placeholder — Tier 2 builds the full site). The
  // fire system carries its own smoke column.
  spawnFireAt(ctx, c.impact.clone(), Tuning.CRASH_FIRE_FUEL_S, true);

  // Flash-then-boom: the sound arrives after dist / speed-of-sound.
  c.boomDelay = dist / Tuning.CRASH_SOUND_SPEED;
  c.boomTimer = 0;
}

/** Per-frame FSM. Cheap no-op when idle (just the ambient timer). */
export function updateMeteorCrash(ctx: GameContext, dt: number): void {
  if (!_scene) return;

  // Ambient cadence — arm a rare crash when none is active.
  if (!_crash) {
    if (ctx.time.elapsed >= _nextAt) {
      spawnCrash(ctx);
      _nextAt = ctx.time.elapsed + Tuning.CRASH_MIN_INTERVAL +
        Math.random() * (Tuning.CRASH_MAX_INTERVAL - Tuning.CRASH_MIN_INTERVAL);
    }
    return;
  }
  const c = _crash;
  const dayCore = (ctx.time.sunHeight ?? 0) > 0;

  // ── Flight ──
  if (!c.impacted) {
    c.t = Math.min(1, c.t + dt / c.flightS);
    const e = c.t * c.t;   // ease-in: accelerates toward the ground (gravity feel)
    _v.lerpVectors(c.origin, c.impact, e);
    if (_headGroup) {
      _headGroup.position.copy(_v);
      // Brighten as it nears + a fast flicker.
      const flick = 0.85 + 0.15 * Math.sin(ctx.time.elapsed * 47);
      const near = 0.6 + 0.4 * c.t;
      const hs = Tuning.CRASH_HEAD_SCALE;
      if (_headCore) {
        _headCore.scale.setScalar(hs * 0.5 * near);
        (_headCore.material as THREE.SpriteMaterial).color.setHex(dayCore ? 0xfffceb : 0xffe6cc);
        (_headCore.material as THREE.SpriteMaterial).opacity = flick;
      }
      if (_headHalo) {
        _headHalo.scale.setScalar(hs * near);
        (_headHalo.material as THREE.SpriteMaterial).opacity = 0.8 * flick;
      }
      if (_chunk) {
        _chunk.rotation.x += dt * 5; _chunk.rotation.z += dt * 3.3;
        _chunk.scale.setScalar(hs * 0.06 * near);
      }
    }
    // Emit the 3-layer trail at the head along the arc.
    const n = Math.max(1, Math.round(Tuning.CRASH_TRAIL_EMIT_HZ * dt));
    for (let i = 0; i < n; i++) {
      if (_fireTrail) emitParticle(_fireTrail, {
        x: _v.x, y: _v.y, z: _v.z,
        vx: (Math.random() - 0.5) * 5, vy: (Math.random() - 0.5) * 5, vz: (Math.random() - 0.5) * 5,
        life: Tuning.CRASH_TRAIL_FIRE_LIFE * (0.6 + Math.random() * 0.6), size: 8 + Math.random() * 10,
      });
      if (_smokeTrail) emitParticle(_smokeTrail, {
        x: _v.x, y: _v.y, z: _v.z,
        vx: (Math.random() - 0.5) * 2.5, vy: 0.5 + Math.random(), vz: (Math.random() - 0.5) * 2.5,
        life: Tuning.CRASH_TRAIL_SMOKE_LIFE * (0.6 + Math.random() * 0.7), size: 11 + Math.random() * 12,
      });
    }
    if (c.t >= 1) onImpact(ctx, c);
  } else {
    // ── Settling: boom timer + shockwave ring; hide the head. ──
    if (_headGroup) _headGroup.visible = false;
    c.boomTimer += dt;
    if (c.boomTimer >= c.boomDelay && c.boomDelay >= 0) {
      const p = getPlayerWorldPos(ctx);
      playCrashImpact(Math.hypot(c.impact.x - p.x, c.impact.z - p.z));
      c.boomDelay = -1;   // fired
    }
    if (c.ringT >= 0 && _ring) {
      c.ringT += dt / Tuning.CRASH_SHOCKWAVE_S;
      if (c.ringT >= 1) {
        _ring.visible = false;
        (_ring.material as THREE.MeshBasicMaterial).opacity = 0;
        if (c.boomDelay < 0) c.finished = true;
      } else {
        const r = 1 + c.ringT * Tuning.CRASH_SHOCKWAVE_R;
        _ring.position.set(c.impact.x, c.impact.y + 0.1, c.impact.z);
        _ring.scale.set(r, r, r);
        _ring.visible = true;
        (_ring.material as THREE.MeshBasicMaterial).opacity = 0.6 * (1 - c.ringT);
      }
    } else if (c.boomDelay < 0) {
      c.finished = true;
    }
  }

  if (_fireTrail) updateParticleTrail(_fireTrail, dt);
  if (_smokeTrail) updateParticleTrail(_smokeTrail, dt);
  if (_ejecta) updateParticleTrail(_ejecta, dt);

  if (c.finished) {
    _crash = null;
    _nextAt = Math.max(_nextAt, ctx.time.elapsed + Tuning.CRASH_MIN_INTERVAL);
  }
}
