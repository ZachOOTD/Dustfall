// Worm far-horizon crossing (M5b, C36).
//
// The sandworm is a near THREAT (the full AI in enemies/sandWorm.ts), but it should
// also be a distant, majestic PRESENCE — proof the world is bigger than you. Rarely,
// a worm's dorsal ridge surfaces FAR away (well beyond detection) and sweeps across
// the horizon, its serpentine back cresting the dunes and throwing a low rumble, then
// submerges. "That thing is out there." Decoupled from the threat AI: pure spectacle —
// no collider, no detection, no save state, no interaction with the close-encounter
// worm. Determinism-safe (Math.random is runtime-visual, like the sky shooters/fireball
// — it never touches the seeded scatter stream that the placement audit checks).

import * as THREE from 'three';
import type { GameContext } from '../GameContext.ts';
import type { Terrain } from './terrain.ts';
import { Tuning } from '../config/tuning.ts';
import { getPlayerWorldPos } from '../player/effectivePos.ts';   // ACBD — effective player pos (speeder seat while mounted)
import { playWormRoarAttenuated } from '../audio/audio.ts';

const N = Tuning.WORM_CROSSING_SEGMENTS;

interface Crossing {
  group: THREE.Group;
  humps: THREE.Mesh[];
  active: boolean;
  elapsed: number;
  lifetime: number;
  start: THREE.Vector3;   // head start (x,z; y from terrain)
  dir: THREE.Vector3;     // traverse direction (unit, XZ)
  perp: THREE.Vector3;    // perpendicular (lateral undulation)
  roared: boolean;
  nextAt: number;         // seconds until the next crossing (when inactive)
}
let _c: Crossing | null = null;

// C36 r2 — a flat, UNLIT, fog-resistant dark silhouette (was a lit MeshStandard whose
// sun-catching facets read as crystalline rock + only ~20 lum below the sand). MeshBasic
// = no light response → no bright facets, a clean dark shape that pops vs the warm sand
// at ANY distance (fog:false so it doesn't haze away at the in-play 430-850m range).
const HIDE = new THREE.MeshBasicMaterial({ color: 0x231b11, fog: false, toneMapped: false });

/** Build the (hidden) dorsal-ridge humps once, at boot. */
export function initWormHorizonCrossing(scene: THREE.Scene): void {
  if (_c) return;
  const group = new THREE.Group();
  const humps: THREE.Mesh[] = [];
  for (let i = 0; i < N; i++) {
    // Middle-thick taper (thin at BOTH ends where the body dives under) → no fat
    // "head", reads as an anonymous dorsal ridge surfacing, not a tadpole with a face.
    const mid = (N - 1) / 2;
    const taper = 1 - 0.62 * (Math.abs(i - mid) / mid);
    const r = 2.8 + 3.9 * taper;
    // Overlap only ~partway (spacing ≈ 0.85·r) so each hump POKES above the previous —
    // the top edge scallops into a rolled-ridge HUMP RHYTHM rather than one smooth slug.
    const hump = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), HIDE);
    hump.scale.set(1.1, 0.86, 1.1);                  // a little taller → proud distinct crests
    hump.castShadow = false; hump.receiveShadow = false;
    hump.frustumCulled = false; hump.visible = false;
    group.add(hump);
    humps.push(hump);
  }
  scene.add(group);
  _c = {
    group, humps, active: false, elapsed: 0, lifetime: 0,
    start: new THREE.Vector3(), dir: new THREE.Vector3(), perp: new THREE.Vector3(),
    roared: false, nextAt: Tuning.WORM_CROSSING_MIN_INTERVAL,
  };
}

/** Reset on world rebuild (new game / load). */
export function resetWormHorizonCrossing(): void {
  if (!_c) return;
  _c.active = false;
  for (const h of _c.humps) h.visible = false;
  _c.nextAt = Tuning.WORM_CROSSING_MIN_INTERVAL;
}

/** Arm a crossing: surface a far ridge whose traverse sweeps ACROSS the player's view.
 *  Returns the crossing's centre point (for a rig-shot to aim at), or null. */
export function spawnWormCrossing(ctx: GameContext): { cx: number; cz: number } | null {
  const c = _c;
  if (!c || c.active) return null;
  const tr = getPlayerWorldPos(ctx);
  const ang = Math.random() * Math.PI * 2;
  const D = Tuning.WORM_CROSSING_DIST_MIN
    + Math.random() * (Tuning.WORM_CROSSING_DIST_MAX - Tuning.WORM_CROSSING_DIST_MIN);
  const cx = tr.x + Math.cos(ang) * D;     // the crossing's centre point
  const cz = tr.z + Math.sin(ang) * D;
  // Traverse along the TANGENT (perpendicular to the radial) so it sweeps across.
  const sign = Math.random() < 0.5 ? 1 : -1;
  c.dir.set(-Math.sin(ang) * sign, 0, Math.cos(ang) * sign);
  c.perp.set(c.dir.z, 0, -c.dir.x);
  // Start the head half a sweep back so it crosses through the centre.
  const halfSweep = Tuning.WORM_CROSSING_SPEED * Tuning.WORM_CROSSING_LIFETIME * 0.5;
  c.start.set(cx - c.dir.x * halfSweep, 0, cz - c.dir.z * halfSweep);
  c.lifetime = Tuning.WORM_CROSSING_LIFETIME;
  c.elapsed = 0;
  c.active = true;
  c.roared = false;
  return { cx, cz };
}

export function updateWormHorizonCrossing(ctx: GameContext, terrain: Terrain, dt: number): void {
  const c = _c;
  if (!c) return;
  if (!c.active) {
    c.nextAt -= dt;
    if (c.nextAt <= 0) spawnWormCrossing(ctx);
    return;
  }
  c.elapsed += dt;
  const t = c.elapsed / c.lifetime;
  if (t >= 1) {
    c.active = false;
    for (const h of c.humps) h.visible = false;
    c.nextAt = Tuning.WORM_CROSSING_MIN_INTERVAL
      + Math.random() * (Tuning.WORM_CROSSING_MAX_INTERVAL - Tuning.WORM_CROSSING_MIN_INTERVAL);
    return;
  }
  const headDist = Tuning.WORM_CROSSING_SPEED * c.elapsed;
  // A low attenuated rumble once it has surfaced (distance-faded).
  if (!c.roared && t > 0.08) {
    const tr = getPlayerWorldPos(ctx);
    const hx = c.start.x + c.dir.x * headDist, hz = c.start.z + c.dir.z * headDist;
    playWormRoarAttenuated(Math.hypot(hx - tr.x, hz - tr.z));
    c.roared = true;
  }
  // Surface envelope: rise over the first 15%, hold, sink over the last 15%.
  const surfaceEnv = Math.min(1, Math.min(t / 0.15, (1 - t) / 0.15));
  const spacing = Tuning.WORM_CROSSING_SPACING;
  const phase = c.elapsed * Tuning.WORM_CROSSING_UNDULATE_SPEED;
  for (let i = 0; i < N; i++) {
    const along = headDist - i * spacing;
    // 0.34 rad/hump → ~1 wavelength over the body = one clean serpentine S (was 0.6 = a busy wiggle).
    const lateral = Math.sin(phase - i * 0.34) * Tuning.WORM_CROSSING_WAVE_AMP * (1 - 0.25 * (i / N));
    const x = c.start.x + c.dir.x * along + c.perp.x * lateral;
    const z = c.start.z + c.dir.z * along + c.perp.z * lateral;
    const ground = terrain.heightAt(x, z);
    // Dorsal crest ripples GENTLY with the body wave but stays PROUD + continuous
    // (the r1 deep dip pinched the body into separate lumps + a detached fleck).
    const crest = Tuning.WORM_CROSSING_CREST * surfaceEnv * (0.82 + 0.18 * Math.sin(phase - i * 0.34 + 1.2));
    const h = c.humps[i];
    h.position.set(x, ground + crest - Tuning.WORM_CROSSING_BURY, z);
    // Orient the hump to face along the body (so the keel points up + forward).
    h.visible = surfaceEnv > 0.02;
  }
}
