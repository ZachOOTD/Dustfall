// Lizard wildlife — small flee-AI critter.
//
// States: idle | flee | dead.
// On player proximity (< 8m, line-of-sight not enforced — they have wide eyes),
// transitions to flee. Runs away from the player for 3s, then back to idle.
// Hit with the machete → dies (one-hit, it's a lizard).
// Once dead, the body becomes a 'take' interactable yielding raw_lizard_meat.

import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { GameContext } from '../GameContext.ts';
import { isPlaying } from '../GameContext.ts';
import { Tuning } from '../config/tuning.ts';
import type { Terrain } from '../world/terrain.ts';

export type LizardState = 'idle' | 'flee' | 'dead';

export interface Lizard {
  id: number;
  state: LizardState;
  mesh: THREE.Group;
  body: RAPIER.RigidBody;
  collider: RAPIER.Collider;
  pos: THREE.Vector3;
  velocity: THREE.Vector3;
  fleeUntil: number;
  fleeDir: THREE.Vector3;
  hovered: boolean;
  /** True once the player has taken the meat from the corpse. */
  looted: boolean;
  /** Distance accumulator (m) for footprint cadence — flee state only. */
  trackAccum: number;
}

let _nextId = 1;
const _colliderToLizard = new Map<number, Lizard>();

export function getLizardForCollider(handle: number): Lizard | undefined {
  return _colliderToLizard.get(handle);
}

const SPOT_DISTANCE = 8;
// Session U — was 3.0; lowered so a sprinting player can actually catch one.
// CC-4 — bumped down again (2.5 → 1.8) per playtest feedback: 2.5 m/s
// was still too fast vs sprint 7.1 m/s once you factor in initial distance
// + lizard's first-step rotation. Walk 4.2 / sprint 7.1 / lizard 1.8.
const FLEE_SPEED = 1.8;
const FLEE_DURATION = 3.0;
const TERRAIN_OFFSET = 0.06;

function tag(root: THREE.Object3D, id: number, type: 'kill' | 'take'): void {
  root.traverse((o) => {
    o.userData.interactType = type;
    o.userData.interactId = id;
    o.userData.interactRegistry = 'lizards';
  });
}

function untag(root: THREE.Object3D): void {
  root.traverse((o) => {
    delete o.userData.interactType;
    delete o.userData.interactId;
    delete o.userData.interactRegistry;
  });
}

/** Build a fresh lizard mesh group. Exported (Session II) so the
 *  inventory pickup item + lizard-on-a-stick viewmodel can show the
 *  actual lizard model instead of an abstract meat slab. */
export function makeLizardVisual(): THREE.Group {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0xa89878 });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x7a6a4a });

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.05, 0.10), bodyMat);
  body.position.y = 0.04;
  g.add(body);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 4), bodyMat);
  head.position.set(0.11, 0.05, 0);
  head.scale.set(1.2, 0.85, 0.9);
  g.add(head);

  // Tail
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.025, 0.04), darkMat);
  tail.position.set(-0.13, 0.04, 0);
  g.add(tail);

  // Legs — 4 small cylinders
  const legGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.05, 4);
  const legPositions: Array<[number, number]> = [
    [0.06, 0.04], [0.06, -0.04], [-0.04, 0.04], [-0.04, -0.04],
  ];
  for (const [x, z] of legPositions) {
    const leg = new THREE.Mesh(legGeo, darkMat);
    leg.position.set(x, 0.015, z);
    g.add(leg);
  }
  return g;
}

export function spawnLizard(
  scene: THREE.Scene,
  physicsWorld: RAPIER.World,
  terrain: Terrain,
  pos: { x: number; z: number },
): Lizard {
  const groundY = terrain.heightAt(pos.x, pos.z);
  const mesh = makeLizardVisual();
  mesh.position.set(pos.x, groundY + TERRAIN_OFFSET, pos.z);
  mesh.rotation.y = Math.random() * Math.PI * 2;
  scene.add(mesh);

  // Kinematic body so we can translate via our own AI.
  const bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased()
    .setTranslation(pos.x, groundY + 0.05, pos.z);
  const body = physicsWorld.createRigidBody(bodyDesc);
  const colliderDesc = RAPIER.ColliderDesc.capsule(0.05, 0.06);
  const collider = physicsWorld.createCollider(colliderDesc, body);

  const id = _nextId++;
  tag(mesh, id, 'kill');

  const lizard: Lizard = {
    id,
    state: 'idle',
    mesh,
    body,
    collider,
    pos: new THREE.Vector3(pos.x, groundY + TERRAIN_OFFSET, pos.z),
    velocity: new THREE.Vector3(),
    fleeUntil: 0,
    fleeDir: new THREE.Vector3(),
    hovered: false,
    looted: false,
    trackAccum: 0,
  };
  _colliderToLizard.set(collider.handle, lizard);
  return lizard;
}

/** HH (world rework #3) — replaces the 4 hard-coded lizard spawns with
 *  biome-aware procgen scatter. Clusters 1-2 lizards near each POI, fills
 *  the remainder with sparse global density. Salt biome rejected (lizards
 *  don't live on featureless flats). 25m buffer around player spawn so
 *  the opening scene isn't ambushy. Deterministic from the passed `rand`
 *  stream, so ids are stable across reloads. */
export function spawnLizardsProcgen(
  scene: THREE.Scene,
  physicsWorld: RAPIER.World,
  terrain: Terrain,
  biomes: { biomeAt: (x: number, z: number) => 'dune' | 'rocky' | 'salt' },
  rand: () => number,
  poiPositions: ReadonlyArray<THREE.Vector3>,
): Lizard[] {
  const lizards: Lizard[] = [];
  const target = Tuning.LIZARD_TARGET_COUNT;
  const buffer = Tuning.LIZARD_SPAWN_BUFFER_FROM_ORIGIN;
  const bufferSq = buffer * buffer;
  const clusterMin = Tuning.LIZARD_CLUSTER_RADIUS_MIN;
  const clusterSpan = Tuning.LIZARD_CLUSTER_RADIUS_MAX - clusterMin;
  const scatterMax = Tuning.LIZARD_SCATTER_RADIUS_MAX;
  const perPoi = Tuning.LIZARD_PER_POI_AVG;

  // Cluster pass — 1 or 2 lizards per POI averaging perPoi.
  for (const p of poiPositions) {
    if (lizards.length >= target) break;
    const n = rand() < (perPoi - 1) ? 2 : 1;
    for (let i = 0; i < n; i++) {
      if (lizards.length >= target) break;
      let placed = false;
      for (let tries = 0; tries < 5; tries++) {
        const a = rand() * Math.PI * 2;
        const r = clusterMin + rand() * clusterSpan;
        const x = p.x + Math.cos(a) * r;
        const z = p.z + Math.sin(a) * r;
        if (biomes.biomeAt(x, z) === 'salt') continue;
        if (x * x + z * z < bufferSq) continue;
        lizards.push(spawnLizard(scene, physicsWorld, terrain, { x, z }));
        placed = true;
        break;
      }
      // If we couldn't place near this POI, skip — the global pass will
      // top up the count.
      if (!placed) continue;
    }
  }

  // Global pass — top up to target with sparse scatter across the world.
  const MAX_GLOBAL_TRIES = (target - lizards.length) * 20;
  let tries = 0;
  while (lizards.length < target && tries < MAX_GLOBAL_TRIES) {
    tries++;
    const r = buffer + rand() * (scatterMax - buffer);
    const a = rand() * Math.PI * 2;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (biomes.biomeAt(x, z) === 'salt') continue;
    lizards.push(spawnLizard(scene, physicsWorld, terrain, { x, z }));
  }

  return lizards;
}

export function damageLizard(lizard: Lizard, _dmg: number, _ctx: GameContext): void {
  if (lizard.state === 'dead') return;
  lizard.state = 'dead';
  lizard.mesh.position.y += 0.02;
  applyDeadPose(lizard);
}

/** Session PP — pipe-staff knockback. Shoves the lizard `distance` meters
 *  along the horizontal projection of `dir`. Applied alongside damageLizard.
 *  Works on both live + dead lizards; dead ones get visually flung when
 *  struck. */
export function knockbackLizard(
  lizard: Lizard,
  dir: THREE.Vector3,
  distance: number,
  _ctx: GameContext,
): void {
  const horizLen = Math.hypot(dir.x, dir.z) || 1;
  const dx = (dir.x / horizLen) * distance;
  const dz = (dir.z / horizLen) * distance;
  const cur = lizard.body.translation();
  // Translate body + mesh together. setTranslation(true) wakes any
  // sleeping body so the new position takes effect immediately.
  lizard.body.setTranslation({ x: cur.x + dx, y: cur.y, z: cur.z + dz }, true);
  lizard.mesh.position.x += dx;
  lizard.mesh.position.z += dz;
}

/** Apply the dead-lizard visual + interaction retag. Safe to call from a
 *  fresh restore where state is already 'dead' — does not bump position.y. */
export function applyDeadPose(lizard: Lizard): void {
  lizard.mesh.rotation.z = Math.PI / 2;
  untag(lizard.mesh);
  tag(lizard.mesh, lizard.id, 'take');
}

/** Bump the module-level id counter past `n` so future spawns don't collide
 *  with restored ids. Used by save/load. */
export function setNextLizardId(n: number): void {
  if (n > _nextId) _nextId = n;
}

/** Called when the player takes the meat — removes from world + registry. */
export function lootLizard(lizard: Lizard, ctx: GameContext): void {
  lizard.looted = true;
  ctx.three.scene.remove(lizard.mesh);
  _colliderToLizard.delete(lizard.collider.handle);
  // Remove physics body
  ctx.physics.world.removeRigidBody(lizard.body);
  const idx = ctx.lizards.indexOf(lizard);
  if (idx >= 0) ctx.lizards.splice(idx, 1);
}

export function findLizardById(list: Lizard[], id: number | undefined): Lizard | undefined {
  if (id === undefined) return undefined;
  return list.find((l) => l.id === id);
}

const _toPlayer = new THREE.Vector3();

export function updateLizards(ctx: GameContext, dt: number): void {
  if (!isPlaying(ctx)) return;
  const camera = ctx.three.camera;
  const elapsed = ctx.time.elapsed;
  for (const l of ctx.lizards) {
    if (l.state === 'dead') {
      // Idle on the ground — clamp to terrain.
      const groundY = ctx.terrain.heightAt(l.pos.x, l.pos.z);
      l.pos.y = groundY + TERRAIN_OFFSET;
      l.mesh.position.copy(l.pos);
      continue;
    }
    _toPlayer.copy(camera.position).sub(l.pos);
    _toPlayer.y = 0;
    const distSq = _toPlayer.lengthSq();

    if (l.state === 'idle') {
      // Idle bob — vertical sin wave on mesh only, not on AI position.
      l.mesh.position.y = l.pos.y + Math.sin(elapsed * 2 + l.id) * 0.005;
      if (distSq < SPOT_DISTANCE * SPOT_DISTANCE) {
        // Flee — pick a direction opposite the player + small jitter.
        l.fleeDir.copy(_toPlayer).normalize().multiplyScalar(-1);
        const jitter = (Math.random() - 0.5) * 0.6;
        const c = Math.cos(jitter); const s = Math.sin(jitter);
        const dx = l.fleeDir.x * c - l.fleeDir.z * s;
        const dz = l.fleeDir.x * s + l.fleeDir.z * c;
        l.fleeDir.set(dx, 0, dz);
        l.state = 'flee';
        l.fleeUntil = elapsed + FLEE_DURATION;
        // (mesh.rotation.y is updated each frame in the flee branch below)
      }
    } else if (l.state === 'flee') {
      // Move
      const stepX = l.fleeDir.x * FLEE_SPEED * dt;
      const stepZ = l.fleeDir.z * FLEE_SPEED * dt;
      l.pos.x += stepX;
      l.pos.z += stepZ;
      const groundY = ctx.terrain.heightAt(l.pos.x, l.pos.z);
      l.pos.y = groundY + TERRAIN_OFFSET;
      l.mesh.position.copy(l.pos);
      // Always orient the head toward the direction of motion. The lizard
      // mesh's local "forward" is +X (head at +X=0.11), so the correct yaw
      // to map local +X onto world (fleeDir.x, _, fleeDir.z) is
      // atan2(-z, x) — NOT atan2(x, z) (that's the -Z-forward convention
      // and was leaving the head 90° off the direction of travel).
      l.mesh.rotation.y = Math.atan2(-l.fleeDir.z, l.fleeDir.x);
      // Update kinematic body so the collider follows.
      l.body.setNextKinematicTranslation({ x: l.pos.x, y: l.pos.y + 0.05, z: l.pos.z });
      // Track decals — only during flee. Skip on rocky biome (no impression).
      l.trackAccum += Math.hypot(stepX, stepZ);
      if (l.trackAccum >= Tuning.FOOTPRINT_LIZARD_CADENCE_M) {
        l.trackAccum = 0;
        const biome = ctx.biomes.biomeAt(l.pos.x, l.pos.z);
        if (biome !== 'rocky') {
          const yaw = Math.atan2(l.fleeDir.x, l.fleeDir.z);
          ctx.footprints.spawn('lizard', l.pos.x, l.pos.z, yaw, elapsed);
        }
      }
      // Return to idle after duration OR if player far away
      if (elapsed > l.fleeUntil || distSq > (SPOT_DISTANCE * 2) * (SPOT_DISTANCE * 2)) {
        l.state = 'idle';
        l.trackAccum = 0;
      }
    }
  }
}
