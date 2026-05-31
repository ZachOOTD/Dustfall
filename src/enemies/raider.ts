// Raider — a hostile hooded wanderer.
//
// Session N: visual is a rigged Quaternius GLB driven by a per-instance
// AnimationMixer (idle / walk / run / attack / die). If the GLB is missing
// from /public/models/quaternius/raider.glb, falls back to the original
// stylized primitive (cloak cylinder + head sphere + machete arm) with
// transform-tween "swing" animation. AI / collider / hit detection are
// identical in both paths.

import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { GameContext } from '../GameContext.ts';
import { isPlaying } from '../GameContext.ts';
import type { Terrain } from '../world/terrain.ts';
import { die } from '../stats/survival.ts';
import { playFootstep, playHit, playPlayerHurt } from '../audio/audio.ts';
import { cloneAsset, type AssetRegistry } from '../assets/loader.ts';
import type { RopeEndpoint } from '../world/rope.ts';

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

export type RaiderAnim = 'idle' | 'walk' | 'run' | 'attack' | 'die';

export interface RaiderRig {
  mixer: THREE.AnimationMixer;
  actions: Partial<Record<RaiderAnim, THREE.AnimationAction>>;
  current: RaiderAnim | null;
}

export interface Raider {
  id: number;
  group: THREE.Group;
  body: RAPIER.RigidBody;
  collider: RAPIER.Collider;
  // Primitive-only — null when the rigged GLB is in use.
  bladeArm: THREE.Object3D | null;
  // Rigged GLB animation state — null when falling back to primitive.
  rig: RaiderRig | null;
  bb: RaiderBlackboard;
  health: number;
  /** ACF — B1 Phase 3 follow-up: when this corpse is being dragged, the
   *  rope's anchor end (player on foot, or a player-tethered sled). The
   *  corpse is the TOWED body; updateKillDrag enforces the rope constraint.
   *  { kind: 'none' } / undefined = not being dragged. Only meaningful when
   *  bb.state === 'dead'. */
  dragAnchor?: RopeEndpoint;
}

// Resolve a Three.js AnimationClip by lowercase-substring match across a
// candidate list. Quaternius packs use varied names ("Idle", "Idle_Loop",
// "Sword_Slash", "Death", etc.) — first matching clip wins. Returns
// undefined if no candidate matches.
const CLIP_CANDIDATES: Record<RaiderAnim, string[]> = {
  idle: ['idle'],
  walk: ['walk'],
  run: ['run'],
  attack: ['sword', 'attack', 'slash', 'punch'],
  die: ['death', 'die'],
};

function resolveClip(
  clips: THREE.AnimationClip[],
  candidates: string[],
): THREE.AnimationClip | undefined {
  for (const clip of clips) {
    const lc = clip.name.toLowerCase();
    if (candidates.some((c) => lc.includes(c))) return clip;
  }
  return undefined;
}

function buildRig(
  root: THREE.Object3D,
  clips: THREE.AnimationClip[],
): RaiderRig {
  const mixer = new THREE.AnimationMixer(root);
  const actions: Partial<Record<RaiderAnim, THREE.AnimationAction>> = {};
  (Object.keys(CLIP_CANDIDATES) as RaiderAnim[]).forEach((key) => {
    const clip = resolveClip(clips, CLIP_CANDIDATES[key]);
    if (clip) actions[key] = mixer.clipAction(clip);
  });
  return { mixer, actions, current: null };
}

function playAnim(rig: RaiderRig, next: RaiderAnim, fade = 0.18): void {
  if (rig.current === next) return;
  const nextAction = rig.actions[next];
  if (!nextAction) return; // missing clip — hold previous
  const prevAction = rig.current ? rig.actions[rig.current] : undefined;
  prevAction?.fadeOut(fade);
  nextAction.reset();
  if (next === 'die') {
    nextAction.setLoop(THREE.LoopOnce, 1);
    nextAction.clampWhenFinished = true;
  } else {
    nextAction.setLoop(THREE.LoopRepeat, Infinity);
    nextAction.clampWhenFinished = false;
  }
  nextAction.fadeIn(fade).play();
  rig.current = next;
}

let _nextRaiderId = 1;

/** Bump the module-level id counter past `n` so future spawns don't collide
 *  with restored ids. Used by save/load. */
export function setNextRaiderId(n: number): void {
  if (n > _nextRaiderId) _nextRaiderId = n;
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
  assets: AssetRegistry,
  spawnPos: THREE.Vector3,
): Raider {
  // Prefer the rigged GLB. If it failed to load (or wasn't shipped yet),
  // cloneAsset returns null and we fall back to the primitive visual so
  // gameplay still works without the asset on disk.
  let group: THREE.Group;
  let bladeArm: THREE.Object3D | null = null;
  let rig: RaiderRig | null = null;

  const asset = assets.get('raider');
  const cloned = asset ? cloneAsset(asset) : null;
  if (cloned) {
    group = cloned;
    rig = buildRig(group, asset!.animations);
    // Cast shadow on every mesh in the rigged hierarchy.
    group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; }
    });
    playAnim(rig, 'idle', 0); // settle into idle without fade on first frame
  } else {
    const primitive = makeRaiderVisual();
    group = primitive.group;
    bladeArm = primitive.bladeArm;
  }

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

  const raider: Raider = {
    id: _nextRaiderId++,
    group, body, collider, bladeArm, rig, bb, health: 1.0,
  };
  _colliderToRaider.set(collider.handle, raider);
  return raider;
}

/** Apply the dead-raider visual + remove the collider. Used by both
 *  damageRaider (on kill) and load (when restoring a state='dead' raider).
 *  Caller is responsible for any position adjustments — this only mutates
 *  rotation + physics state.
 *
 *  Rigged path: trigger the die clip and seek it to its final frame so the
 *  load path lands on the dead pose immediately. The kill path also calls
 *  this — for them the seek-to-end is harmless because performAttack runs
 *  before death and the mixer's first .update(dt) will already be past 0.
 *  If the GLB has no die clip we fall back to the primitive flop so dead
 *  raiders still visually read as dead. */
export function applyRaiderDeadPose(raider: Raider, ctx: GameContext): void {
  if (raider.rig) {
    const dieAction = raider.rig.actions.die;
    if (dieAction) {
      playAnim(raider.rig, 'die');
      dieAction.time = dieAction.getClip().duration;
      raider.rig.mixer.update(0);
    } else {
      raider.group.rotation.x = -Math.PI / 2 + 0.1;
    }
  } else {
    raider.group.rotation.x = -Math.PI / 2 + 0.1;
  }
  // Disable collider so a dead raider can be walked through.
  if (_colliderToRaider.has(raider.collider.handle)) {
    ctx.physics.world.removeCollider(raider.collider, false);
    _colliderToRaider.delete(raider.collider.handle);
  }
  // ACF — B1 Phase 3 follow-up: tag the corpse so interaction.ts can route
  // a rope-drag (registry 'raiders'). Applied on death + on load (both call
  // this), so a restored dead raider is draggable too. Idempotent.
  raider.group.traverse((o) => {
    o.userData.interactType = 'attach_rope';
    o.userData.interactId = raider.id;
    o.userData.interactRegistry = 'raiders';
  });
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
    r.group.position.y -= 0.2;
    applyRaiderDeadPose(r, ctx);
    ctx.ui.showToast('it falls — the desert reclaims it');
    return;
  }
  transitionTo(r, 'stagger');
}

/** Session PP — pipe-staff knockback. Shoves the raider `distance` meters
 *  along the horizontal projection of `dir`. Translates body + group together.
 *  Live raiders get knocked back AND staggered; dead ones still get visually
 *  flung (mirrors knockbackLizard). */
export function knockbackRaider(
  r: Raider,
  dir: THREE.Vector3,
  distance: number,
  _ctx: GameContext,
): void {
  const horizLen = Math.hypot(dir.x, dir.z) || 1;
  const dx = (dir.x / horizLen) * distance;
  const dz = (dir.z / horizLen) * distance;
  const cur = r.body.translation();
  r.body.setTranslation({ x: cur.x + dx, y: cur.y, z: cur.z + dz }, true);
  r.group.position.x += dx;
  r.group.position.z += dz;
}

// ─────────────────────────────────────────────────────────────
// Per-frame raider update
// ─────────────────────────────────────────────────────────────
export function updateRaiders(ctx: GameContext, dt: number): void {
  if (!isPlaying(ctx)) return;
  const playerTr = ctx.player.body.body.translation();

  for (const r of ctx.raiders) {
    // Mixer ticks even when dead so the die clip finishes playing through.
    r.rig?.mixer.update(dt);

    if (r.bb.state === 'dead') continue;
    r.bb.stateTimer += dt;
    if (!r.rig && r.bladeArm) {
      r.bb.bladeSwing = Math.max(0, r.bb.bladeSwing - dt * 4); // decay
      r.bladeArm.rotation.x = -r.bb.bladeSwing * 1.2;
    }

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
        if (r.rig) playAnim(r.rig, 'walk');
        if (playerVisible || playerHeard) {
          r.bb.lastSeenPlayer = new THREE.Vector3(playerTr.x, playerTr.y, playerTr.z);
          transitionTo(r, 'spotted');
        }
        break;
      }
      case 'spotted': {
        faceTarget(r, playerTr);
        if (r.rig) playAnim(r.rig, 'idle');
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
        if (r.rig) playAnim(r.rig, 'run');
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
        } else if (r.rig) {
          // Between swings — hold idle so we're not stuck in a half-swing.
          const attackAction = r.rig.actions.attack;
          const swingDone =
            !attackAction || attackAction.time >= attackAction.getClip().duration;
          if (swingDone) playAnim(r.rig, 'idle');
        }
        break;
      }
      case 'stagger': {
        if (r.rig) playAnim(r.rig, 'idle');
        if (r.bb.stateTimer >= 0.45) {
          transitionTo(r, 'chase');
        }
        break;
      }
    }
  }
}

function performAttack(r: Raider, ctx: GameContext, distToPlayer: number): void {
  if (r.rig) {
    // Force-restart so each swing replays from frame 0 even if the previous
    // swing's clip hadn't finished decaying.
    r.rig.current = null;
    playAnim(r.rig, 'attack', 0.08);
  } else {
    r.bb.bladeSwing = 1.0; // primitive: animate the arm forward briefly
  }
  if (distToPlayer <= ATTACK_RANGE) {
    ctx.stats.health = Math.max(0, ctx.stats.health - ATTACK_DAMAGE);
    playHit(0.85);
    playPlayerHurt();
    ctx.flags.damageFlashUntil = ctx.time.elapsed + 0.33;
    ctx.ui.showToast('the blade catches you');
    if (ctx.stats.health <= 0) die(ctx, 'the raider took you');
  }
}
