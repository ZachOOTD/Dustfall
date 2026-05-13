// Raider — a hostile hooded wanderer.
//
// v1 uses a stylized primitive (cloak cylinder + head sphere + machete arm)
// in lieu of a rigged Quaternius character. The mesh is animated via simple
// transform tweens (idle sway, walk bob, attack lunge) — no AnimationMixer.

import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { GameContext } from '../GameContext.ts';
import { isPlaying } from '../GameContext.ts';
import type { Terrain } from '../world/terrain.ts';
import { die } from '../stats/survival.ts';
import { playFootstep, playHit } from '../audio/audio.ts';

export type RaiderState =
  | 'patrol'
  | 'spotted'
  | 'chase'
  | 'attack'
  | 'stagger'
  | 'dead';

export interface RaiderBlackboard {
  state: RaiderState;
  stateTimer: number;
  patrolCenter: THREE.Vector3;
  patrolTarget: THREE.Vector3;
  lastSeenPlayer: THREE.Vector3 | null;
  nextAttackAt: number;
  yaw: number;
  stepAccum: number;
  // Visual transient: animates the arm during attack/stagger
  bladeSwing: number;
  // Sight cache: raycast is expensive — refresh at most every SIGHT_REFRESH s
  sightTimer: number;
  lastSightResult: boolean;
}

const SIGHT_REFRESH = 0.5; // seconds between sight raycasts per raider

export interface Raider {
  group: THREE.Group;
  body: RAPIER.RigidBody;
  collider: RAPIER.Collider;
  bladeArm: THREE.Object3D;
  bb: RaiderBlackboard;
  health: number;
}

const RAIDER_HEIGHT = 1.85;
const CAPSULE_RADIUS = 0.30;
const CAPSULE_HALF = (RAIDER_HEIGHT - 2 * CAPSULE_RADIUS) / 2; // ~0.625

const WALK_SPEED = 1.8;
const RUN_SPEED = 4.0;
const SIGHT_DISTANCE = 28;
const SIGHT_ANGLE = Math.cos(Math.PI / 3); // ±60° cone
const HEARING_RADIUS_WALK = 8;
const HEARING_RADIUS_SPRINT = 18;
const ATTACK_RANGE = 2.0;
const ATTACK_BREAK_RANGE = 2.8;
const ATTACK_COOLDOWN = 1.2;
const ATTACK_DAMAGE = 0.15;
const CHASE_GIVEUP_DURATION = 3.0;

// Map collider handles → Raider so a raycast/shapecast can resolve to enemy.
const _colliderToRaider = new Map<number, Raider>();

export function getRaiderForCollider(handle: number): Raider | undefined {
  return _colliderToRaider.get(handle);
}

// ─────────────────────────────────────────────────────────────
// Visual
// ─────────────────────────────────────────────────────────────
function makeRaiderVisual(): { group: THREE.Group; bladeArm: THREE.Object3D } {
  const g = new THREE.Group();

  const cloakMat = new THREE.MeshLambertMaterial({ color: 0x12100c, flatShading: true });
  const hoodMat = new THREE.MeshLambertMaterial({ color: 0x1c1813, flatShading: true });
  const skinMat = new THREE.MeshLambertMaterial({ color: 0x2a1f15, flatShading: true });
  const bladeMat = new THREE.MeshStandardMaterial({
    color: 0x4a4a48, metalness: 0.6, roughness: 0.35, flatShading: true,
  });

  // Cloak: tapered cylinder (wider at base) — visually the "body"
  const cloak = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.55, 1.45, 8, 1),
    cloakMat,
  );
  cloak.position.y = 0.72; // base at feet (y=0)
  g.add(cloak);

  // Hood: rounded shape on top
  const hood = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.26, 1),
    hoodMat,
  );
  hood.position.y = 1.62;
  hood.scale.set(1, 1.05, 1);
  g.add(hood);

  // Hint of a face under the hood (darker than hood)
  const face = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.13, 0),
    skinMat,
  );
  face.position.set(0, 1.55, 0.18);
  g.add(face);

  // Machete arm — pivot at shoulder, blade extends forward
  const armPivot = new THREE.Group();
  armPivot.position.set(0.27, 1.18, 0.06);
  g.add(armPivot);

  const armBone = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.05, 0.45, 6),
    skinMat,
  );
  armBone.position.y = -0.22;
  armPivot.add(armBone);

  const handle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.045, 0.18, 6),
    skinMat,
  );
  handle.position.set(0, -0.50, 0);
  handle.rotation.x = Math.PI / 2;
  armPivot.add(handle);

  const blade = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, 0.5, 0.10),
    bladeMat,
  );
  blade.position.set(0, -0.50, 0.35);
  blade.rotation.x = Math.PI / 2;
  armPivot.add(blade);

  // Cast shadow on all meshes
  g.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; }
  });

  return { group: g, bladeArm: armPivot };
}

// ─────────────────────────────────────────────────────────────
// Spawn
// ─────────────────────────────────────────────────────────────
export function spawnRaider(
  scene: THREE.Scene,
  world: RAPIER.World,
  terrain: Terrain,
  spawnPos: THREE.Vector3,
): Raider {
  const { group, bladeArm } = makeRaiderVisual();
  const groundY = terrain.heightAt(spawnPos.x, spawnPos.z);
  group.position.set(spawnPos.x, groundY, spawnPos.z);
  scene.add(group);

  const bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased()
    .setTranslation(spawnPos.x, groundY + CAPSULE_HALF + CAPSULE_RADIUS, spawnPos.z);
  const body = world.createRigidBody(bodyDesc);
  const colliderDesc = RAPIER.ColliderDesc.capsule(CAPSULE_HALF, CAPSULE_RADIUS);
  const collider = world.createCollider(colliderDesc, body);

  const bb: RaiderBlackboard = {
    state: 'patrol',
    stateTimer: 0,
    patrolCenter: new THREE.Vector3(spawnPos.x, groundY, spawnPos.z),
    patrolTarget: pickPatrolTarget(spawnPos, 6),
    lastSeenPlayer: null,
    nextAttackAt: 0,
    yaw: 0,
    stepAccum: 0,
    bladeSwing: 0,
    sightTimer: 0,           // refresh on first frame
    lastSightResult: false,
  };

  const raider: Raider = { group, body, collider, bladeArm, bb, health: 1.0 };
  _colliderToRaider.set(collider.handle, raider);
  return raider;
}

function pickPatrolTarget(center: { x: number; z: number }, radius: number): THREE.Vector3 {
  const angle = Math.random() * Math.PI * 2;
  const r = radius * (0.4 + Math.random() * 0.6);
  return new THREE.Vector3(center.x + Math.cos(angle) * r, 0, center.z + Math.sin(angle) * r);
}

// ─────────────────────────────────────────────────────────────
// Sensors
// ─────────────────────────────────────────────────────────────
const _toPlayer = new THREE.Vector3();
const _forward = new THREE.Vector3();
const _rayPool = { origin: { x: 0, y: 0, z: 0 }, dir: { x: 0, y: 0, z: 0 } };

function distanceTo(a: { x: number; z: number }, b: { x: number; z: number }): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function canSeePlayer(r: Raider, playerPos: { x: number; y: number; z: number }, ctx: GameContext): boolean {
  const dx = playerPos.x - r.group.position.x;
  const dz = playerPos.z - r.group.position.z;
  const dist = Math.hypot(dx, dz);
  if (dist > SIGHT_DISTANCE) return false;

  // Cone test (raider's forward derived from yaw)
  _forward.set(Math.sin(r.bb.yaw), 0, Math.cos(r.bb.yaw)).normalize();
  _toPlayer.set(dx, 0, dz).normalize();
  if (_forward.dot(_toPlayer) < SIGHT_ANGLE) return false;

  // Line of sight raycast — eye height to player chest
  const eyeY = r.body.translation().y + 0.5;
  const playerEyeY = playerPos.y + 0.4;
  _rayPool.origin = { x: r.group.position.x, y: eyeY, z: r.group.position.z };
  const dirX = playerPos.x - _rayPool.origin.x;
  const dirY = playerEyeY - _rayPool.origin.y;
  const dirZ = playerPos.z - _rayPool.origin.z;
  const len = Math.hypot(dirX, dirY, dirZ);
  if (len < 0.1) return true;
  _rayPool.dir = { x: dirX / len, y: dirY / len, z: dirZ / len };
  const ray = new RAPIER.Ray(_rayPool.origin, _rayPool.dir);
  const hit = ctx.physics.world.castRay(ray, len, true, undefined, undefined, r.collider);
  if (!hit) return true;
  // Hit found before player → blocked
  // We only count as "seeing player" if the hit IS the player collider
  return hit.collider.handle === ctx.player.body.collider.handle;
}

function canHearPlayer(r: Raider, playerPos: { x: number; z: number }, ctx: GameContext): boolean {
  const dist = distanceTo(r.group.position, playerPos);
  const isSprinting =
    (ctx.input.keys['ShiftLeft'] || ctx.input.keys['ShiftRight']) && ctx.stats.thirst > 0.02;
  const radius = isSprinting ? HEARING_RADIUS_SPRINT : HEARING_RADIUS_WALK;
  // Hearing only when player is on ground + moving
  const moving =
    !!ctx.input.keys['KeyW'] || !!ctx.input.keys['KeyA'] ||
    !!ctx.input.keys['KeyS'] || !!ctx.input.keys['KeyD'];
  return ctx.player.onGround && moving && dist <= radius;
}

// ─────────────────────────────────────────────────────────────
// Movement
// ─────────────────────────────────────────────────────────────
function moveToward(
  r: Raider,
  target: { x: number; z: number },
  speed: number,
  dt: number,
  ctx: GameContext,
): void {
  const dx = target.x - r.group.position.x;
  const dz = target.z - r.group.position.z;
  const len = Math.hypot(dx, dz);
  if (len < 0.05) return;
  const step = Math.min(speed * dt, len);
  const ux = dx / len, uz = dz / len;
  const nx = r.group.position.x + ux * step;
  const nz = r.group.position.z + uz * step;
  const ny = ctx.terrain.heightAt(nx, nz);
  r.group.position.set(nx, ny, nz);
  r.body.setNextKinematicTranslation({
    x: nx, y: ny + CAPSULE_HALF + CAPSULE_RADIUS, z: nz,
  });
  // Face direction
  r.bb.yaw = Math.atan2(ux, uz);
  r.group.rotation.y = r.bb.yaw;

  // Footstep cadence
  r.bb.stepAccum += step;
  const stepThresh = speed > 3 ? 1.4 : 1.8;
  if (r.bb.stepAccum >= stepThresh) {
    r.bb.stepAccum = 0;
    playFootstep();
  }
}

function faceTarget(r: Raider, target: { x: number; z: number }): void {
  const dx = target.x - r.group.position.x;
  const dz = target.z - r.group.position.z;
  r.bb.yaw = Math.atan2(dx, dz);
  r.group.rotation.y = r.bb.yaw;
}

// ─────────────────────────────────────────────────────────────
// State transitions
// ─────────────────────────────────────────────────────────────
function transitionTo(r: Raider, next: RaiderState): void {
  r.bb.state = next;
  r.bb.stateTimer = 0;
  r.bb.sightTimer = 0; // force fresh sight check next tick for responsiveness
}

/** Cached sight check: actually raycasts at most every SIGHT_REFRESH seconds. */
function checkSightCached(
  r: Raider,
  playerPos: { x: number; y: number; z: number },
  ctx: GameContext,
  dt: number,
): boolean {
  r.bb.sightTimer -= dt;
  if (r.bb.sightTimer <= 0) {
    r.bb.lastSightResult = canSeePlayer(r, playerPos, ctx);
    r.bb.sightTimer = SIGHT_REFRESH;
  }
  return r.bb.lastSightResult;
}

// ─────────────────────────────────────────────────────────────
// Damage from player
// ─────────────────────────────────────────────────────────────
export function damageRaider(r: Raider, dmg: number, ctx: GameContext): void {
  if (r.bb.state === 'dead') return;
  r.health -= dmg;
  if (r.health <= 0) {
    r.health = 0;
    transitionTo(r, 'dead');
    // Collapse the visual: drop to ground, rotate forward
    r.group.rotation.x = -Math.PI / 2 + 0.1;
    r.group.position.y -= 0.2;
    // Disable collider
    ctx.physics.world.removeCollider(r.collider, false);
    _colliderToRaider.delete(r.collider.handle);
    ctx.ui.showToast('it falls — the desert reclaims it');
    return;
  }
  transitionTo(r, 'stagger');
}

// ─────────────────────────────────────────────────────────────
// Per-frame raider update
// ─────────────────────────────────────────────────────────────
export function updateRaiders(ctx: GameContext, dt: number): void {
  if (!isPlaying(ctx)) return;
  const playerTr = ctx.player.body.body.translation();

  for (const r of ctx.raiders) {
    if (r.bb.state === 'dead') continue;
    r.bb.stateTimer += dt;
    r.bb.bladeSwing = Math.max(0, r.bb.bladeSwing - dt * 4); // decay
    r.bladeArm.rotation.x = -r.bb.bladeSwing * 1.2;

    const distToPlayer = Math.hypot(
      playerTr.x - r.group.position.x,
      playerTr.z - r.group.position.z,
    );
    const playerVisible = checkSightCached(r, playerTr, ctx, dt);
    const playerHeard = canHearPlayer(r, playerTr, ctx);

    switch (r.bb.state) {
      case 'patrol': {
        // Patrol between waypoints; pick new target when reached or after 6s
        const reached = distanceTo(r.group.position, r.bb.patrolTarget) < 0.6;
        if (reached || r.bb.stateTimer > 6) {
          r.bb.patrolTarget = pickPatrolTarget(r.bb.patrolCenter, 7);
          r.bb.stateTimer = 0;
        }
        moveToward(r, r.bb.patrolTarget, WALK_SPEED, dt, ctx);
        if (playerVisible || playerHeard) {
          r.bb.lastSeenPlayer = new THREE.Vector3(playerTr.x, playerTr.y, playerTr.z);
          transitionTo(r, 'spotted');
        }
        break;
      }
      case 'spotted': {
        faceTarget(r, playerTr);
        if (r.bb.stateTimer >= 0.8) transitionTo(r, 'chase');
        break;
      }
      case 'chase': {
        if (playerVisible) {
          r.bb.lastSeenPlayer = new THREE.Vector3(playerTr.x, playerTr.y, playerTr.z);
          r.bb.stateTimer = 0; // reset give-up timer while visible
        }
        if (distToPlayer < ATTACK_RANGE) {
          transitionTo(r, 'attack');
          break;
        }
        const chaseTarget = r.bb.lastSeenPlayer ?? playerTr;
        moveToward(r, chaseTarget, RUN_SPEED, dt, ctx);
        // Give up if we haven't seen the player in too long
        if (!playerVisible && r.bb.stateTimer > CHASE_GIVEUP_DURATION) {
          r.bb.patrolCenter.set(r.group.position.x, r.group.position.y, r.group.position.z);
          r.bb.patrolTarget = pickPatrolTarget(r.bb.patrolCenter, 6);
          transitionTo(r, 'patrol');
        }
        break;
      }
      case 'attack': {
        faceTarget(r, playerTr);
        if (distToPlayer > ATTACK_BREAK_RANGE) {
          transitionTo(r, 'chase');
          break;
        }
        if (ctx.time.elapsed >= r.bb.nextAttackAt) {
          performAttack(r, ctx, distToPlayer);
          r.bb.nextAttackAt = ctx.time.elapsed + ATTACK_COOLDOWN;
        }
        break;
      }
      case 'stagger': {
        if (r.bb.stateTimer >= 0.45) {
          transitionTo(r, 'chase');
        }
        break;
      }
    }
  }
}

function performAttack(r: Raider, ctx: GameContext, distToPlayer: number): void {
  r.bb.bladeSwing = 1.0; // animate the arm forward briefly
  if (distToPlayer <= ATTACK_RANGE) {
    ctx.stats.health = Math.max(0, ctx.stats.health - ATTACK_DAMAGE);
    playHit(0.85);
    ctx.ui.showToast('the blade catches you');
    if (ctx.stats.health <= 0) die(ctx, 'the raider took you');
  }
}
