// M6 (C37) — signal_kit's transient skyward flare ("call out"). The player fires
// a bright magnesium-style flare that streaks up out of their hand, arcs forward,
// peaks, and burns out over ~2.8s, trailing fading embers behind it.
//
// Design constraints:
//   - Self-luminous ADDITIVE sprites ONLY — no dynamic PointLight. Adding/removing
//     a light would change the scene light count and force a Three.js shader
//     recompile (a frame hitch), per the fire.ts AAY-fix note. The bright sprites
//     ARE the visible light; surroundings stay un-lit (a deeper "flare illuminates
//     the dunes" pass is backlog).
//   - Fully transient — flares live only in this module's array, never in
//     ctx.fires, never serialized. No save-schema interaction whatsoever.
//   - Determinism-safe — fired by an explicit player action; Math.random only
//     jitters the trail sparkle (a runtime visual, not the seeded scatter stream).

import * as THREE from 'three';
import type { GameContext } from '../GameContext.ts';
import { Tuning } from '../config/tuning.ts';

/** A single fading ember left along the flare's arc (pooled per flare, reused). */
interface TrailPuff {
  sprite: THREE.Sprite;
  age: number;
  ttl: number;
  active: boolean;
  size: number;       // per-ember base width (jittered so the ribbon isn't a uniform bead string)
}

// Cooling-gradient endpoints — a fresh ember is hot orange, an aged one a dark
// cooling red. Lerped per-ember per-frame into the (additive) sprite colour so
// the trail reads as a single burning object cooling as it falls behind.
const _HOT = new THREE.Color(Tuning.SIGNAL_FLARE_TRAIL_COLOR_HOT);
const _COOL = new THREE.Color(Tuning.SIGNAL_FLARE_TRAIL_COLOR_COOL);
const _tmpCol = new THREE.Color();

interface ActiveFlare {
  head: THREE.Sprite;        // white-hot burning core
  glow: THREE.Sprite;        // soft warm halo around the core
  pos: THREE.Vector3;        // current head position (world)
  vel: THREE.Vector3;        // current velocity (m/s); gravity decays the +Y
  age: number;
  trail: TrailPuff[];        // per-flare ember pool
  nextTrailAt: number;       // age at which to emit the next trail puff
}

const _flares: ActiveFlare[] = [];

// ── Shared additive radial sprite texture (one across all flares/puffs) ──
let _tex: THREE.CanvasTexture | null = null;
function flareTexture(): THREE.CanvasTexture {
  if (_tex) return _tex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  if (!g) throw new Error('canvas 2d unavailable');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  // A hot white centre falling to a soft transparent edge — additive blending
  // turns this into a bright bloom over whatever sky/terrain is behind it.
  grad.addColorStop(0.0, 'rgba(255,255,255,1.0)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.7)');
  grad.addColorStop(0.7, 'rgba(255,255,255,0.22)');
  grad.addColorStop(1.0, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return (_tex = tex);
}

function makeFlareSprite(color: number, size: number, opacity: number): THREE.Sprite {
  const mat = new THREE.SpriteMaterial({
    map: flareTexture(),
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,          // a flare punches through haze — don't let storm-fog tint it
    toneMapped: false,   // stay bright regardless of exposure
  });
  const s = new THREE.Sprite(mat);
  s.scale.setScalar(size);
  s.raycast = () => {};   // decorative — never an interaction target
  return s;
}

/** Fire a signal flare from the player's hand, arcing forward + skyward. Transient. */
export function fireSignalFlare(ctx: GameContext): void {
  const cam = ctx.three.camera;
  const fwd = new THREE.Vector3();
  cam.getWorldDirection(fwd);
  const fwdFlat = new THREE.Vector3(fwd.x, 0, fwd.z);
  if (fwdFlat.lengthSq() < 1e-4) fwdFlat.set(0, 0, -1);
  fwdFlat.normalize();

  // Launch from just in front of + below the camera (out of the hand).
  const pos = new THREE.Vector3(
    cam.position.x + fwdFlat.x * 0.6,
    cam.position.y - 0.15,
    cam.position.z + fwdFlat.z * 0.6,
  );
  const vel = new THREE.Vector3(
    fwdFlat.x * Tuning.SIGNAL_FLARE_FORWARD,
    Tuning.SIGNAL_FLARE_RISE_SPEED,
    fwdFlat.z * Tuning.SIGNAL_FLARE_FORWARD,
  );

  const head = makeFlareSprite(Tuning.SIGNAL_FLARE_HEAD_COLOR, Tuning.SIGNAL_FLARE_HEAD_SIZE, 1.0);
  const glow = makeFlareSprite(Tuning.SIGNAL_FLARE_GLOW_COLOR, Tuning.SIGNAL_FLARE_GLOW_SIZE, Tuning.SIGNAL_FLARE_GLOW_OPACITY);
  head.position.copy(pos);
  glow.position.copy(pos);
  ctx.three.scene.add(glow);   // glow first so the head draws on top
  ctx.three.scene.add(head);

  // Per-flare ember pool — created hidden, reused as the flare climbs.
  const trail: TrailPuff[] = [];
  for (let i = 0; i < Tuning.SIGNAL_FLARE_TRAIL_POOL; i++) {
    const sprite = makeFlareSprite(Tuning.SIGNAL_FLARE_TRAIL_COLOR_HOT, Tuning.SIGNAL_FLARE_TRAIL_SIZE, 0);
    sprite.visible = false;
    ctx.three.scene.add(sprite);
    trail.push({ sprite, age: 0, ttl: 0, active: false, size: Tuning.SIGNAL_FLARE_TRAIL_SIZE });
  }

  _flares.push({ head, glow, pos, vel, age: 0, trail, nextTrailAt: 0 });
}

function disposeFlare(ctx: GameContext, f: ActiveFlare): void {
  const scene = ctx.three.scene;
  scene.remove(f.head);
  scene.remove(f.glow);
  (f.head.material as THREE.SpriteMaterial).dispose();
  (f.glow.material as THREE.SpriteMaterial).dispose();
  for (const p of f.trail) {
    scene.remove(p.sprite);
    (p.sprite.material as THREE.SpriteMaterial).dispose();
  }
}

/** Advance every live flare. Ticked once per frame from main.ts (after updateFires),
 *  inside the pause gate. Disposes a flare once its head has guttered out AND its
 *  trail embers have all faded. */
export function updateSignalFlares(ctx: GameContext, dt: number): void {
  if (_flares.length === 0) return;
  const ttl = Tuning.SIGNAL_FLARE_TTL_S;

  for (let i = _flares.length - 1; i >= 0; i--) {
    const f = _flares[i];
    f.age += dt;

    // Integrate the head (gravity arc).
    f.vel.y -= Tuning.SIGNAL_FLARE_GRAVITY * dt;
    f.pos.addScaledVector(f.vel, dt);
    f.head.position.copy(f.pos);
    f.glow.position.copy(f.pos);

    // Head life: a fast ramp-in, a flickering burn, then a gutter-out over the tail.
    const life = f.age / ttl;                       // 0..1 over the burn
    const flicker = 0.85 + 0.15 * Math.sin(f.age * 47) * Math.sin(f.age * 19);
    const burnOut = life < 0.8 ? 1 : Math.max(0, (1 - life) / 0.2);
    const headOp = burnOut * flicker;
    (f.head.material as THREE.SpriteMaterial).opacity = headOp;
    (f.glow.material as THREE.SpriteMaterial).opacity = Tuning.SIGNAL_FLARE_GLOW_OPACITY * burnOut * flicker;
    // The head swells slightly as it climbs (more visible at altitude), the glow more so.
    const grow = 1 + 0.35 * Math.min(1, life * 1.5);
    f.head.scale.setScalar(Tuning.SIGNAL_FLARE_HEAD_SIZE * grow);
    f.glow.scale.setScalar(Tuning.SIGNAL_FLARE_GLOW_SIZE * grow);

    // Emit trail embers along the arc while the head is still burning.
    if (f.age < ttl * 0.85 && f.age >= f.nextTrailAt) {
      f.nextTrailAt = f.age + Tuning.SIGNAL_FLARE_TRAIL_INTERVAL_S;
      const p = f.trail.find((q) => !q.active);
      if (p) {
        p.active = true;
        p.age = 0;
        p.ttl = Tuning.SIGNAL_FLARE_TRAIL_TTL_S;
        // Per-ember size jitter so the dense ribbon has body + variety (not a uniform bead string).
        p.size = Tuning.SIGNAL_FLARE_TRAIL_SIZE * (0.8 + Math.random() * 0.5);
        p.sprite.visible = true;
        // Drop slightly behind the head with a touch of scatter so the trail has body.
        p.sprite.position.set(
          f.pos.x + (Math.random() - 0.5) * 0.18,
          f.pos.y - 0.08 + (Math.random() - 0.5) * 0.18,
          f.pos.z + (Math.random() - 0.5) * 0.18,
        );
        p.sprite.scale.setScalar(p.size);
        (p.sprite.material as THREE.SpriteMaterial).color.copy(_HOT);
      }
    }

    // Age the trail embers — cool hot→dark, taper, loft + drift downwind, fade out.
    const wx = Math.cos(Tuning.DUNE_WIND_DIR_RAD) * Tuning.SIGNAL_FLARE_TRAIL_DRIFT;
    const wz = Math.sin(Tuning.DUNE_WIND_DIR_RAD) * Tuning.SIGNAL_FLARE_TRAIL_DRIFT;
    let anyTrail = false;
    for (const p of f.trail) {
      if (!p.active) continue;
      p.age += dt;
      if (p.age >= p.ttl) { p.active = false; p.sprite.visible = false; continue; }
      anyTrail = true;
      const tf = p.age / p.ttl;
      p.sprite.position.y += 0.35 * dt;        // embers loft gently
      p.sprite.position.x += wx * tf * dt;     // drift downwind, ramping as they cool
      p.sprite.position.z += wz * tf * dt;
      p.sprite.scale.setScalar(p.size * (1 - 0.65 * tf));   // taper to a small ember
      // Cool from hot orange → dark red as it ages (additive, so cooling also dims).
      _tmpCol.copy(_HOT).lerp(_COOL, tf);
      (p.sprite.material as THREE.SpriteMaterial).color.copy(_tmpCol);
      (p.sprite.material as THREE.SpriteMaterial).opacity = (1 - tf * 0.85) * 0.95;
    }

    // Retire once the head is spent and the last ember has faded.
    if (f.age >= ttl && !anyTrail) {
      disposeFlare(ctx, f);
      _flares.splice(i, 1);
    }
  }
}

/** Number of live flares — for the headless rig-shot / tests. */
export function activeSignalFlareCount(): number {
  return _flares.length;
}

/** TEST/render helper — fast-forward every live flare by `seconds` of deterministic
 *  simulation so the rig-shot can frame the arc mid-burn despite rAF throttling. */
export function advanceSignalFlares(ctx: GameContext, seconds: number): void {
  const dt = 1 / 60;
  for (let s = 0; s < seconds; s += dt) updateSignalFlares(ctx, dt);
}
