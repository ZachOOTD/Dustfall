// Session AAG — footprint puffs. Small upward dust burst on each
// footstep, sized and tinted by biome. Quiet "the world is alive"
// detail; not visible in storms or under heavy fog.
//
// Particle pool architecture: ~60 pre-allocated particles, recycled
// in a round-robin from the next-available slot. Each puff spawns
// 5 particles. At a brisk walk cadence (~1.5 steps/sec at
// STEP_DISTANCE=3 with WALK_SPEED=6) particles live ~0.6s so pool
// capacity ~5 puffs in flight at peak is fine.

import * as THREE from 'three';
import type { GameContext } from '../GameContext.ts';
import { isPlaying } from '../GameContext.ts';
import { Tuning } from '../config/tuning.ts';

interface Particle {
  active: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;        // remaining seconds
  initialLife: number; // for alpha falloff calculation
}

interface FootprintPuffSystem {
  points: THREE.Points;
  geo: THREE.BufferGeometry;
  positions: Float32Array;
  particles: Particle[];
  nextIdx: number;
}

let _system: FootprintPuffSystem | null = null;

// AAL — HMR guard. When tuning.ts hot-reloads (changing PUFF_VERTICAL_VEL
// etc.), Vite re-runs this module but `_system` still holds a stale
// FootprintPuffSystem with its old Tuning-baked particle pool. The
// dispose hook clears the singleton so the next createFootprintPuffs
// call rebuilds with current Tuning values. No-op in production builds.
if ((import.meta as { hot?: { dispose: (cb: () => void) => void } }).hot) {
  (import.meta as { hot: { dispose: (cb: () => void) => void } }).hot.dispose(() => {
    _system = null;
  });
}

export function createFootprintPuffs(scene: THREE.Scene): void {
  if (_system) return;
  const count = Tuning.FOOTPRINT_PUFF_COUNT;
  const positions = new Float32Array(count * 3);
  // Init all particles offscreen (large negative Y) so the initial frame
  // doesn't show a cluster at origin.
  for (let i = 0; i < count; i++) {
    positions[i * 3]     = 0;
    positions[i * 3 + 1] = -10000;
    positions[i * 3 + 2] = 0;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    color: 0xb89878,         // sand-tone dust
    size: 0.10,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    sizeAttenuation: true,
    fog: true,               // gets occluded by fog at distance (consistent with storm dust)
    toneMapped: false,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  scene.add(points);

  const particles: Particle[] = [];
  const lifeS = Tuning.FOOTPRINT_PUFF_LIFE_S;
  for (let i = 0; i < count; i++) {
    particles.push({
      active: false,
      pos: new THREE.Vector3(),
      vel: new THREE.Vector3(),
      life: 0,
      initialLife: lifeS,
    });
  }

  _system = { points, geo, positions, particles, nextIdx: 0 };
}

/** Spawn a single puff at a footstep position. Called from
 *  src/player/controller.ts on each footstep beat. Emits
 *  Tuning.FOOTPRINT_PUFF_PER_PUFF particles. */
export function spawnFootprintPuff(x: number, y: number, z: number): void {
  if (!_system) return;
  const s = _system;
  const count = Tuning.FOOTPRINT_PUFF_COUNT;
  const perPuff = Tuning.FOOTPRINT_PUFF_PER_PUFF;
  const lifeS = Tuning.FOOTPRINT_PUFF_LIFE_S;
  const verticalVel = Tuning.FOOTPRINT_PUFF_VERTICAL_VEL;
  const lateralVel = Tuning.FOOTPRINT_PUFF_LATERAL_VEL;
  for (let i = 0; i < perPuff; i++) {
    const idx = s.nextIdx;
    s.nextIdx = (s.nextIdx + 1) % count;
    const p = s.particles[idx];
    p.active = true;
    p.life = lifeS;
    p.initialLife = lifeS;
    // Spawn at the ground point with a small random offset.
    p.pos.set(
      x + (Math.random() - 0.5) * 0.08,
      y + 0.02,
      z + (Math.random() - 0.5) * 0.08,
    );
    p.vel.set(
      (Math.random() - 0.5) * 2 * lateralVel,
      verticalVel + (Math.random() - 0.5) * 0.2,
      (Math.random() - 0.5) * 2 * lateralVel,
    );
  }
}

/** Per-frame particle update. */
export function updateFootprintPuffs(ctx: GameContext, dt: number): void {
  if (!_system) return;
  if (!isPlaying(ctx)) return;
  const s = _system;
  const count = Tuning.FOOTPRINT_PUFF_COUNT;
  const gravity = Tuning.FOOTPRINT_PUFF_GRAVITY;

  let anyActive = false;
  for (let i = 0; i < count; i++) {
    const p = s.particles[i];
    if (!p.active) continue;
    p.life -= dt;
    if (p.life <= 0) {
      p.active = false;
      // Park offscreen so the GPU buffer doesn't render a stale position.
      s.positions[i * 3]     = 0;
      s.positions[i * 3 + 1] = -10000;
      s.positions[i * 3 + 2] = 0;
      continue;
    }
    // Integrate position + apply gravity to velocity.
    p.pos.x += p.vel.x * dt;
    p.pos.y += p.vel.y * dt;
    p.pos.z += p.vel.z * dt;
    p.vel.y -= gravity * dt;
    s.positions[i * 3]     = p.pos.x;
    s.positions[i * 3 + 1] = p.pos.y;
    s.positions[i * 3 + 2] = p.pos.z;
    anyActive = true;
  }
  s.geo.attributes.position.needsUpdate = true;
  // Hide the entire Points object when no particles are alive (skip its
  // draw call entirely) for a tiny perf win during idle moments.
  s.points.visible = anyActive;
}
