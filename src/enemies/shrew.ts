// Desert shrew wildlife — small skittish ambient critter (a muad'dib-ish
// kangaroo-rat / desert-mouse). ACL DESERT SHREW.
//
// Mirrors the lizard pipeline (src/enemies/lizard.ts): a procedural low-poly
// model (Lathe/box body + ears + tail, skinMaterial), a Rapier kinematic
// body, an interface Shrew, and the spawn/update entry points.
//
// States: idle | wander | flee.
//   - idle:   sits still with a tiny breathing bob; occasionally rolls into
//             a short wander to a nearby spot.
//   - wander: ambles slowly to a randomly-chosen nearby target, then idles.
//   - flee:   on player proximity (< SPOT_DISTANCE) bolts away fast for a
//             few seconds, then settles back to idle.
//
// Self-contained: the module owns the live shrew array. `spawnShrewsProcgen`
// populates + returns it; `updateShrews` iterates the module-owned list so
// the file compiles standalone WITHOUT a `ctx.shrews` slot (the integrator
// wires `ctx.shrews = { list }` to the same array — see manifest). The only
// GameContext use is as a *type* for the fields update reads (camera, terrain,
// biomes, time, isPlaying).

import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { GameContext } from '../GameContext.ts';
import { isPlaying } from '../GameContext.ts';
import { createSkinMaterial } from '../world/skinMaterial.ts';
import type { Terrain } from '../world/terrain.ts';
import { Tuning } from '../config/tuning.ts';

export type ShrewState = 'idle' | 'wander' | 'flee';

export interface Shrew {
  id: number;
  state: ShrewState;
  mesh: THREE.Group;
  body: RAPIER.RigidBody;
  collider: RAPIER.Collider;
  pos: THREE.Vector3;
  velocity: THREE.Vector3;
  /** elapsed-time stamp the current flee burst ends. */
  fleeUntil: number;
  /** Unit horizontal direction the shrew is currently bolting. */
  fleeDir: THREE.Vector3;
  /** elapsed-time stamp the current idle rest ends (then it picks a wander). */
  idleUntil: number;
  /** Wander destination (world XZ; y ignored). */
  wanderTarget: THREE.Vector3;
  hovered: boolean;
}

// ── Tuning — promoted to Tuning (integration). ──
const SPOT_DISTANCE = Tuning.SHREW_SPOT_DISTANCE;
const FLEE_SPEED = Tuning.SHREW_FLEE_SPEED;
const FLEE_DURATION = Tuning.SHREW_FLEE_DURATION;
const WANDER_SPEED = Tuning.SHREW_WANDER_SPEED;
const WANDER_RADIUS = Tuning.SHREW_WANDER_RADIUS;
const IDLE_MIN = Tuning.SHREW_IDLE_MIN;
const IDLE_MAX = Tuning.SHREW_IDLE_MAX;
const ARRIVE_EPS = Tuning.SHREW_ARRIVE_EPS;
const TERRAIN_OFFSET = Tuning.SHREW_TERRAIN_OFFSET;
const SHREW_TARGET_COUNT = Tuning.SHREW_TARGET_COUNT;
const SHREW_SPAWN_BUFFER_FROM_ORIGIN = Tuning.SHREW_SPAWN_BUFFER_FROM_ORIGIN;
const SHREW_CLUSTER_RADIUS_MIN = Tuning.SHREW_CLUSTER_RADIUS_MIN;
const SHREW_CLUSTER_RADIUS_MAX = Tuning.SHREW_CLUSTER_RADIUS_MAX;
const SHREW_SCATTER_RADIUS_MAX = Tuning.SHREW_SCATTER_RADIUS_MAX;
const SHREW_PER_POI_AVG = Tuning.SHREW_PER_POI_AVG;

let _nextId = 1;
const _colliderToShrew = new Map<number, Shrew>();
// ACL DESERT SHREW — module-owned live list. spawn populates, update iterates.
const _shrews: Shrew[] = [];

export function getShrewForCollider(handle: number): Shrew | undefined {
  return _colliderToShrew.get(handle);
}

/** Build a fresh shrew mesh group. ACL DESERT SHREW.
 *
 *  Procedural low-poly desert critter, ~9cm body. Local forward is +X
 *  (head/nose at +X) to match the lizard convention so the flee-yaw math is
 *  identical. Lathe-based body (rump → ribcage → neck → snout) + a separate
 *  little head sphere, two big upright ears (BoxGeometry, >=1cm deep per the
 *  thin-decoration rule), bead eyes, four stubby legs, and a long tapered
 *  Lathe tail. All skin materials use localSpace=true (D109/ABN — the shrew
 *  moves, so world-space sampling would crawl). */
export function makeShrewVisual(): THREE.Group {
  const g = new THREE.Group();

  // Sandy fur tones. Small scaleSize (50) because the shrew is tiny; lower
  // sheen than the lizard (fur, not scales).
  const furMat = createSkinMaterial(0xc4a878, {
    accentColor: 0x8a6f48,
    scaleSize: 50.0,
    sheen: 0.25,
    localSpace: true,
  });
  const bellyMat = createSkinMaterial(0xd8c8a4, {
    accentColor: 0xb09870,
    scaleSize: 50.0,
    sheen: 0.2,
    localSpace: true,
  });
  const darkMat = createSkinMaterial(0x9a7e54, {
    accentColor: 0x60492c,
    scaleSize: 50.0,
    sheen: 0.2,
    localSpace: true,
  });

  // ── Body — Lathe profile rotated so its axis runs along +X (nose forward).
  // Plump rodent torso: narrow rump → wide ribcage → pinched neck.
  const bodyProfile = [
    new THREE.Vector2(0.012, 0.000), // rump joint (tail attaches)
    new THREE.Vector2(0.024, 0.018), // haunch
    new THREE.Vector2(0.030, 0.040), // ribcage peak (widest)
    new THREE.Vector2(0.028, 0.060), // front ribcage
    new THREE.Vector2(0.020, 0.078), // shoulder
    new THREE.Vector2(0.015, 0.090), // neck joint
  ];
  const body = new THREE.Mesh(new THREE.LatheGeometry(bodyProfile, 12), furMat);
  body.rotation.z = -Math.PI / 2; // axis → +X
  body.position.set(-0.04, 0.034, 0);
  // Slight Y-squash for a grounded belly + wider-than-tall cross-section.
  body.scale.set(1.0, 0.92, 0.96);
  g.add(body);

  // Belly underside — a flattened sphere tucked under the ribcage, paler.
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.028, 10, 8), bellyMat);
  belly.position.set(0.0, 0.024, 0);
  belly.scale.set(1.4, 0.6, 0.95);
  g.add(belly);

  // ── Head — sphere just forward of the body's neck joint.
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.024, 12, 10), furMat);
  head.position.set(0.062, 0.040, 0);
  head.scale.set(1.05, 0.95, 0.95);
  g.add(head);

  // Snout — small tapered cone poking forward (rodent muzzle).
  const snout = new THREE.Mesh(new THREE.ConeGeometry(0.011, 0.024, 8), furMat);
  snout.rotation.z = -Math.PI / 2; // tip toward +X
  snout.position.set(0.086, 0.036, 0);
  g.add(snout);

  // Nose bead.
  const noseMat = new THREE.MeshLambertMaterial({ color: 0x2a1810 });
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.004, 6, 5), noseMat);
  nose.position.set(0.099, 0.036, 0);
  g.add(nose);

  // ── Ears — big upright rounded "spoons". BoxGeometry would read paper-thin
  // edge-on, so use a flattened SphereGeometry scaled into an ear paddle
  // (inherently rounded volume, no <10cm thin-box concern). Tilted outward.
  for (const sz of [-1, 1] as const) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 8), furMat);
    ear.scale.set(0.35, 1.25, 0.85); // thin front-to-back, tall, medium wide
    ear.position.set(0.052, 0.066, sz * 0.014);
    ear.rotation.x = sz * 0.35; // splay outward
    ear.rotation.z = -0.15; // lean slightly forward
    g.add(ear);
  }

  // ── Eyes — dark beads on the sides of the head.
  const eyeMat = new THREE.MeshLambertMaterial({ color: 0x0a0a0a });
  for (const sz of [-1, 1] as const) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.005, 6, 5), eyeMat);
    eye.position.set(0.072, 0.044, sz * 0.016);
    g.add(eye);
  }

  // ── Legs — four stubby cylinders + tiny foot pads. Rear pair a touch
  // longer (kangaroo-rat hop posture). Tucked under the body.
  function buildLeg(sideX: 1 | -1, pair: 'front' | 'rear'): THREE.Group {
    const leg = new THREE.Group();
    const isFront = pair === 'front';
    const len = isFront ? 0.020 : 0.026;
    const r = isFront ? 0.006 : 0.007;
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.85, r, len, 6), darkMat);
    seg.position.y = -len / 2;
    seg.rotation.x = sideX * 0.2; // slight outward splay
    leg.add(seg);
    // Foot pad — small box. Kept >=1cm in its smallest meaningful dimension
    // (height 0.005 is fine: it's a horizontal pad viewed from above, not a
    // thin outer-hull decoration the camera sees edge-on).
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.005, 0.010), darkMat);
    foot.position.set(0, -len + 0.0025, sideX * 0.002);
    leg.add(foot);
    return leg;
  }
  const legAttach: Array<{ x: number; sz: 1 | -1; pair: 'front' | 'rear' }> = [
    { x: 0.034, sz: 1, pair: 'front' },
    { x: 0.034, sz: -1, pair: 'front' },
    { x: -0.026, sz: 1, pair: 'rear' },
    { x: -0.026, sz: -1, pair: 'rear' },
  ];
  for (const att of legAttach) {
    const leg = buildLeg(att.sz, att.pair);
    leg.position.set(att.x, 0.028, att.sz * 0.018);
    g.add(leg);
  }

  // ── Tail — long tapered Lathe extending in -X, with a darker tip tuft via
  // the dark material. Kangaroo-rat tails are nearly body-length.
  const tailProfile = [
    new THREE.Vector2(0.008, 0.000),
    new THREE.Vector2(0.006, 0.040),
    new THREE.Vector2(0.004, 0.090),
    new THREE.Vector2(0.003, 0.130),
    new THREE.Vector2(0.000, 0.160), // tip
  ];
  const tail = new THREE.Mesh(new THREE.LatheGeometry(tailProfile, 8), darkMat);
  tail.rotation.z = Math.PI / 2; // extends toward -X
  tail.position.set(-0.04, 0.044, 0);
  // Curve the tail upward a touch by tilting it.
  tail.rotation.y = 0;
  tail.scale.set(1.0, 0.95, 0.95);
  g.add(tail);

  return g;
}

export function spawnShrew(
  scene: THREE.Scene,
  physicsWorld: RAPIER.World,
  terrain: Terrain,
  pos: { x: number; z: number },
): Shrew {
  const groundY = terrain.heightAt(pos.x, pos.z);
  const mesh = makeShrewVisual();
  mesh.position.set(pos.x, groundY + TERRAIN_OFFSET, pos.z);
  mesh.rotation.y = Math.random() * Math.PI * 2;
  scene.add(mesh);

  // Kinematic body, driven by our own AI (matches the lizard).
  const bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(
    pos.x,
    groundY + 0.04,
    pos.z,
  );
  const body = physicsWorld.createRigidBody(bodyDesc);
  // Small capsule around the body.
  const colliderDesc = RAPIER.ColliderDesc.capsule(0.03, 0.04);
  const collider = physicsWorld.createCollider(colliderDesc, body);

  const id = _nextId++;
  const shrew: Shrew = {
    id,
    state: 'idle',
    mesh,
    body,
    collider,
    pos: new THREE.Vector3(pos.x, groundY + TERRAIN_OFFSET, pos.z),
    velocity: new THREE.Vector3(),
    fleeUntil: 0,
    fleeDir: new THREE.Vector3(),
    idleUntil: 0,
    wanderTarget: new THREE.Vector3(pos.x, 0, pos.z),
    hovered: false,
  };
  _colliderToShrew.set(collider.handle, shrew);
  _shrews.push(shrew);
  return shrew;
}

/** ACL DESERT SHREW — biome-aware procgen scatter, mirroring
 *  `spawnLizardsProcgen`. Clusters ~SHREW_PER_POI_AVG shrews near each POI,
 *  fills the remainder with sparse global density. Salt biome rejected
 *  (nothing to forage on the flats). Buffer around the player spawn so the
 *  opening scene is calm. Deterministic from the passed `scatterRand` stream,
 *  so ids are stable across reloads. Populates + returns the module-owned
 *  live list (also accessible via the update loop). */
export function spawnShrewsProcgen(
  scene: THREE.Scene,
  world: RAPIER.World,
  terrain: Terrain,
  biomes: { biomeAt: (x: number, z: number) => 'dune' | 'rocky' | 'salt' },
  scatterRand: () => number,
  poiPositions: ReadonlyArray<THREE.Vector3>,
): Shrew[] {
  const out: Shrew[] = [];
  const target = SHREW_TARGET_COUNT;
  const buffer = SHREW_SPAWN_BUFFER_FROM_ORIGIN;
  const bufferSq = buffer * buffer;
  const clusterMin = SHREW_CLUSTER_RADIUS_MIN;
  const clusterSpan = SHREW_CLUSTER_RADIUS_MAX - clusterMin;
  const scatterMax = SHREW_SCATTER_RADIUS_MAX;
  const perPoi = SHREW_PER_POI_AVG;

  // Cluster pass — 1 or 2 shrews per POI averaging perPoi.
  for (const p of poiPositions) {
    if (out.length >= target) break;
    const n = scatterRand() < perPoi - 1 ? 2 : 1;
    for (let i = 0; i < n; i++) {
      if (out.length >= target) break;
      for (let tries = 0; tries < 5; tries++) {
        const a = scatterRand() * Math.PI * 2;
        const r = clusterMin + scatterRand() * clusterSpan;
        const x = p.x + Math.cos(a) * r;
        const z = p.z + Math.sin(a) * r;
        if (biomes.biomeAt(x, z) === 'salt') continue;
        if (x * x + z * z < bufferSq) continue;
        out.push(spawnShrew(scene, world, terrain, { x, z }));
        break;
      }
    }
  }

  // Global pass — top up to target with sparse scatter across the world.
  const MAX_GLOBAL_TRIES = (target - out.length) * 20;
  let tries = 0;
  while (out.length < target && tries < MAX_GLOBAL_TRIES) {
    tries++;
    const r = buffer + scatterRand() * (scatterMax - buffer);
    const a = scatterRand() * Math.PI * 2;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (biomes.biomeAt(x, z) === 'salt') continue;
    out.push(spawnShrew(scene, world, terrain, { x, z }));
  }

  return out;
}

/** Bump the module-level id counter past `n` so future spawns don't collide
 *  with restored ids. Used by save/load. ACL DESERT SHREW. */
export function setNextShrewId(n: number): void {
  if (n > _nextId) _nextId = n;
}

/** Remove a shrew from the world + module registry. ACL DESERT SHREW. */
export function removeShrew(shrew: Shrew, scene: THREE.Scene, world: RAPIER.World): void {
  scene.remove(shrew.mesh);
  _colliderToShrew.delete(shrew.collider.handle);
  world.removeRigidBody(shrew.body);
  const idx = _shrews.indexOf(shrew);
  if (idx >= 0) _shrews.splice(idx, 1);
}

export function findShrewById(list: Shrew[], id: number | undefined): Shrew | undefined {
  if (id === undefined) return undefined;
  return list.find((s) => s.id === id);
}

const _toPlayer = new THREE.Vector3();
const _toTarget = new THREE.Vector3();

/** Per-frame AI. ACL DESERT SHREW. Iterates the module-owned live list so it
 *  compiles standalone WITHOUT a `ctx.shrews` slot. The integrator wires
 *  `ctx.shrews = { list }` to the SAME array `spawnShrewsProcgen` returns, so
 *  both views stay in sync; this loop does not read `ctx.shrews`. */
export function updateShrews(ctx: GameContext, dt: number): void {
  if (!isPlaying(ctx)) return;
  const camera = ctx.three.camera;
  const elapsed = ctx.time.elapsed;

  for (const s of _shrews) {
    _toPlayer.copy(camera.position).sub(s.pos);
    _toPlayer.y = 0;
    const distSq = _toPlayer.lengthSq();

    // Player proximity always pre-empts into flee (from any non-flee state).
    if (s.state !== 'flee' && distSq < SPOT_DISTANCE * SPOT_DISTANCE) {
      s.fleeDir.copy(_toPlayer).normalize().multiplyScalar(-1);
      const jitter = (Math.random() - 0.5) * 0.7;
      const c = Math.cos(jitter);
      const sn = Math.sin(jitter);
      const dx = s.fleeDir.x * c - s.fleeDir.z * sn;
      const dz = s.fleeDir.x * sn + s.fleeDir.z * c;
      s.fleeDir.set(dx, 0, dz).normalize();
      s.state = 'flee';
      s.fleeUntil = elapsed + FLEE_DURATION;
    }

    if (s.state === 'idle') {
      // Tiny breathing bob — mesh only, not AI position.
      s.mesh.position.y = s.pos.y + Math.sin(elapsed * 3 + s.id) * 0.004;
      if (s.idleUntil === 0) {
        s.idleUntil = elapsed + IDLE_MIN + Math.random() * (IDLE_MAX - IDLE_MIN);
      }
      if (elapsed > s.idleUntil) {
        // Pick a nearby wander target.
        const a = Math.random() * Math.PI * 2;
        const r = 0.8 + Math.random() * (WANDER_RADIUS - 0.8);
        s.wanderTarget.set(s.pos.x + Math.cos(a) * r, 0, s.pos.z + Math.sin(a) * r);
        s.state = 'wander';
        s.idleUntil = 0;
      }
    } else if (s.state === 'wander') {
      _toTarget.set(s.wanderTarget.x - s.pos.x, 0, s.wanderTarget.z - s.pos.z);
      const distTarget = _toTarget.length();
      if (distTarget < ARRIVE_EPS) {
        s.state = 'idle';
      } else {
        _toTarget.divideScalar(distTarget); // normalize
        const step = Math.min(WANDER_SPEED * dt, distTarget);
        s.pos.x += _toTarget.x * step;
        s.pos.z += _toTarget.z * step;
        const groundY = ctx.terrain.heightAt(s.pos.x, s.pos.z);
        s.pos.y = groundY + TERRAIN_OFFSET;
        s.mesh.position.copy(s.pos);
        // Local forward is +X → yaw = atan2(-z, x) (same as the lizard).
        s.mesh.rotation.y = Math.atan2(-_toTarget.z, _toTarget.x);
        s.body.setNextKinematicTranslation({ x: s.pos.x, y: s.pos.y + 0.04, z: s.pos.z });
      }
    } else if (s.state === 'flee') {
      const stepX = s.fleeDir.x * FLEE_SPEED * dt;
      const stepZ = s.fleeDir.z * FLEE_SPEED * dt;
      s.pos.x += stepX;
      s.pos.z += stepZ;
      const groundY = ctx.terrain.heightAt(s.pos.x, s.pos.z);
      s.pos.y = groundY + TERRAIN_OFFSET;
      // Skittery vertical hop while bolting.
      s.mesh.position.set(
        s.pos.x,
        s.pos.y + Math.abs(Math.sin(elapsed * 18 + s.id)) * 0.02,
        s.pos.z,
      );
      s.mesh.rotation.y = Math.atan2(-s.fleeDir.z, s.fleeDir.x);
      s.body.setNextKinematicTranslation({ x: s.pos.x, y: s.pos.y + 0.04, z: s.pos.z });
      // Settle back to idle after the burst OR if the player is far away.
      if (elapsed > s.fleeUntil || distSq > SPOT_DISTANCE * 2 * (SPOT_DISTANCE * 2)) {
        s.state = 'idle';
        s.idleUntil = 0;
      }
    }
  }
}
