// Placeable sled (Session QQ) — Mad-Max-style flatbed cargo trailer.
//
// Lifecycle:
//   sled_kit.onUse(ctx) → deploySled(ctx) → spawnSledAt(ctx, pos, rotY, contents, tether)
//   Save/load replays spawnSledAt to rebuild meshes + body.
//
// Three sub-systems coexist:
//   1. Placement — mirrors tent/fire (2.2m in front of camera, terrain-snap,
//      reject if within NEAR_SLED_DISTANCE_SQ of another sled).
//   2. Cargo inventory — `contents: LootEntry[]`, opened via the existing
//      loot menu (lootMenu.ts widened to accept Sled or LootContainer).
//   3. Tow physics — when a wielded `rope` item ties it to player or
//      speeder, a one-way spring-damper impulse pulls the dynamic body
//      toward a target pos behind the tether. No Rapier joints (none
//      used elsewhere in the codebase — see plan).
//
// Two interactable sub-meshes are tagged inside the group:
//   - cargo deck → interactType: 'open_sled'
//   - front-yoke rope stub → interactType: 'attach_rope'

import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { GameContext } from '../GameContext.ts';
import { Tuning } from '../config/tuning.ts';
import type { LootEntry } from './lootContainers.ts';

export type SledTether =
  | { kind: 'none' }
  | { kind: 'player' }
  | { kind: 'speeder' };

export interface Sled {
  id: number;
  group: THREE.Group;
  body: RAPIER.RigidBody;
  collider: RAPIER.Collider;
  pos: THREE.Vector3;
  contents: LootEntry[];
  opened: boolean;
  hovered: boolean;
  tether: SledTether;
  /** Straight Line from tether anchor to sled front-yoke. Allocated on
   *  attach, disposed on detach. */
  ropeLine: THREE.Line | null;
}

let _nextId = 1;

/** Bump the module-level id counter past `n` so save/load restored sleds
 *  don't collide with new ones. */
export function setNextSledId(n: number): void {
  if (n >= _nextId) _nextId = n + 1;
}

export function findSledById(list: Sled[], id: number | undefined): Sled | undefined {
  if (id === undefined) return undefined;
  return list.find((s) => s.id === id);
}

// ─────────────────────────────────────────────────────────────
// Visual
// ─────────────────────────────────────────────────────────────

const _plankMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2c, flatShading: true });
const _plankDarkMat = new THREE.MeshLambertMaterial({ color: 0x4a3220, flatShading: true });
const _runnerMat = new THREE.MeshLambertMaterial({ color: 0x3a2a1a, flatShading: true });
const _scrapMat = new THREE.MeshLambertMaterial({
  color: 0x8a7050, metalness: 0.2, roughness: 0.85, flatShading: true,
} as THREE.MeshLambertMaterialParameters);
const _ropeStubMat = new THREE.MeshLambertMaterial({
  color: Tuning.SLED_ROPE_COLOR_HEX, flatShading: true,
});

/** Build the sled visual. The `group` origin sits at the **center of the
 *  bottom face** so `group.position.y = terrainY` plants the runners on the
 *  ground naturally. Cargo deck is centered, rope stub sticks out the front
 *  (local -Z). Returns refs the caller needs for interaction tagging. */
function makeSledVisual(): {
  group: THREE.Group;
  deck: THREE.Mesh;
  ropeStub: THREE.Mesh;
} {
  const g = new THREE.Group();

  const hx = Tuning.SLED_HALF_EXTENTS_X;
  const hy = Tuning.SLED_HALF_EXTENTS_Y;
  const hz = Tuning.SLED_HALF_EXTENTS_Z;

  // Two parallel runners along Z — slightly raise the deck above them.
  const runnerLen = hz * 2 + 0.1;
  for (const sx of [-1, 1]) {
    const runner = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.08, runnerLen),
      _runnerMat,
    );
    runner.position.set(sx * (hx - 0.07), 0.04, 0);
    g.add(runner);
    // Runner curls up at the front — small tilted nose block.
    const nose = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.10, 0.18),
      _runnerMat,
    );
    nose.position.set(sx * (hx - 0.07), 0.09, -(hz + 0.05));
    nose.rotation.x = -0.55;
    g.add(nose);
  }

  // Cargo deck — flat planked surface above the runners. Tagged
  // 'open_sled' for the interaction system.
  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(hx * 2, hy * 2, hz * 2),
    _plankMat,
  );
  deck.position.set(0, 0.08 + hy, 0);
  g.add(deck);

  // Plank slats — alternating dark planks across the deck for texture.
  const slatCount = 4;
  for (let i = 0; i < slatCount; i++) {
    const slat = new THREE.Mesh(
      new THREE.BoxGeometry(hx * 1.95, 0.012, (hz * 2) / slatCount * 0.8),
      i % 2 === 0 ? _plankDarkMat : _plankMat,
    );
    const t = -hz + ((i + 0.5) * (hz * 2)) / slatCount;
    slat.position.set(0, 0.08 + hy * 2 + 0.006, t);
    g.add(slat);
  }

  // Scrap-metal trim around the deck rim (just the front + rear ends, low cost).
  for (const sz of [-1, 1]) {
    const trim = new THREE.Mesh(
      new THREE.BoxGeometry(hx * 2 + 0.04, 0.06, 0.04),
      _scrapMat,
    );
    trim.position.set(0, 0.08 + hy * 2 + 0.02, sz * hz);
    g.add(trim);
  }

  // Front yoke — small angled bracket where the rope ties on. Two short
  // posts angled together with a horizontal cross-bar at the top. The
  // cross-bar IS the raycast target (tagged 'attach_rope').
  const yokeBase = new THREE.Group();
  yokeBase.position.set(0, 0.08, -(hz - 0.05));
  g.add(yokeBase);
  for (const sx of [-1, 1]) {
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.025, 0.36, 6),
      _runnerMat,
    );
    post.position.set(sx * 0.18, 0.16, 0);
    post.rotation.z = sx * 0.35;
    yokeBase.add(post);
  }
  // The cross-bar — rope ties here. Slightly bulged ends suggest a knot.
  const ropeStub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.05, 0.42, 8),
    _ropeStubMat,
  );
  ropeStub.position.set(0, 0.33, 0);
  ropeStub.rotation.z = Math.PI / 2;
  yokeBase.add(ropeStub);

  // Cast + receive shadows on every mesh.
  g.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; }
  });

  return { group: g, deck, ropeStub };
}

/** Stamp userData on the meshes so the interaction system can raycast
 *  against them. Cargo deck → 'open_sled', rope stub → 'attach_rope'.
 *  Other meshes inherit 'open_sled' so looking at any part of the sled
 *  body (besides the rope stub) opens the cargo. */
function tag(
  group: THREE.Group,
  deck: THREE.Mesh,
  ropeStub: THREE.Mesh,
  id: number,
): void {
  group.traverse((o) => {
    o.userData.interactType = 'open_sled';
    o.userData.interactId = id;
    o.userData.interactRegistry = 'sleds';
  });
  // Override the rope stub specifically — its interactType is different.
  ropeStub.userData.interactType = 'attach_rope';
  ropeStub.userData.interactId = id;
  ropeStub.userData.interactRegistry = 'sleds';
  // Silence the unused-param lint by referencing deck — clarifies intent.
  void deck;
}

// ─────────────────────────────────────────────────────────────
// Spawn / placement
// ─────────────────────────────────────────────────────────────

/** Attempt to place a new sled in front of the camera. Returns null if
 *  too close to an existing sled. Mirrors deployTent. */
export function deploySled(ctx: GameContext): Sled | null {
  const cam = ctx.three.camera;
  const dir = new THREE.Vector3();
  cam.getWorldDirection(dir);
  dir.y = 0;
  if (dir.lengthSq() < 1e-4) dir.set(0, 0, -1);
  dir.normalize();
  const pos = new THREE.Vector3()
    .copy(cam.position)
    .addScaledVector(dir, 2.2);
  pos.y = ctx.terrain.heightAt(pos.x, pos.z);

  for (const existing of ctx.sleds.list) {
    if (existing.pos.distanceToSquared(pos) < Tuning.NEAR_SLED_DISTANCE_SQ) {
      return null;
    }
  }

  const rotationY = Math.atan2(dir.x, dir.z); // sled forward = where the player was facing
  return spawnSledAt(ctx, pos, rotationY, [], { kind: 'none' });
}

/** Materialize a sled. Used by deploySled (player action) AND save/load
 *  (with saved pose + contents + tether). */
export function spawnSledAt(
  ctx: GameContext,
  pos: THREE.Vector3,
  rotationY: number,
  contents: LootEntry[],
  tether: SledTether,
  idOverride?: number,
): Sled {
  const { group, deck, ropeStub } = makeSledVisual();
  group.position.copy(pos);
  group.rotation.y = rotationY;
  ctx.three.scene.add(group);

  const id = idOverride !== undefined ? idOverride : _nextId++;
  if (idOverride !== undefined) setNextSledId(idOverride);
  tag(group, deck, ropeStub, id);

  // Dynamic body — center at the cargo-deck center so the spring force
  // applies through a sensible point. Body y = pos.y + hy + bottomClearance.
  const hx = Tuning.SLED_HALF_EXTENTS_X;
  const hy = Tuning.SLED_HALF_EXTENTS_Y;
  const hz = Tuning.SLED_HALF_EXTENTS_Z;
  const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
    .setTranslation(pos.x, pos.y + 0.08 + hy, pos.z)
    .setRotation({
      // Rotation around Y only — quaternion (0, sin(y/2), 0, cos(y/2)).
      x: 0, y: Math.sin(rotationY * 0.5), z: 0, w: Math.cos(rotationY * 0.5),
    })
    .setLinearDamping(Tuning.SLED_LINEAR_DAMP)
    .setAngularDamping(Tuning.SLED_ANGULAR_DAMP)
    .setCcdEnabled(true); // sled can be yanked at speeder speeds → CCD on
  const body = ctx.physics.world.createRigidBody(bodyDesc);
  const colDesc = RAPIER.ColliderDesc.cuboid(hx, hy, hz)
    .setDensity(Tuning.SLED_DENSITY)
    // Low friction — sleds glide on dunes. 0.8 caused static-friction
    // stiction that the spring couldn't overcome at small errors.
    .setFriction(0.25);
  const collider = ctx.physics.world.createCollider(colDesc, body);

  const sled: Sled = {
    id,
    group,
    body,
    collider,
    pos: pos.clone(),
    contents: contents.slice(),
    opened: false,
    hovered: false,
    tether: { kind: tether.kind },
    ropeLine: null,
  };
  ctx.sleds.list.push(sled);

  // If save restored a sled in the tethered state, allocate the rope line
  // so it'll be visible on the very first frame after load.
  if (tether.kind !== 'none') {
    sled.ropeLine = makeRopeLine();
    ctx.three.scene.add(sled.ropeLine);
  }

  return sled;
}

// ─────────────────────────────────────────────────────────────
// Rope visual
// ─────────────────────────────────────────────────────────────

function makeRopeLine(): THREE.Line {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  const mat = new THREE.LineBasicMaterial({ color: Tuning.SLED_ROPE_COLOR_HEX });
  const line = new THREE.Line(geo, mat);
  line.frustumCulled = false; // rope endpoints can be near camera → keep on screen
  return line;
}

function disposeRopeLine(ctx: GameContext, line: THREE.Line): void {
  ctx.three.scene.remove(line);
  line.geometry.dispose();
  (line.material as THREE.Material).dispose();
}

// ─────────────────────────────────────────────────────────────
// Rope attach / detach
// ─────────────────────────────────────────────────────────────

/** Tie the rope from the wielded slot to this sled. Caller is responsible
 *  for verifying the wielded slot is `rope`. */
export function attachRopeToSled(
  ctx: GameContext,
  sled: Sled,
  endpoint: 'player' | 'speeder',
): void {
  if (sled.tether.kind !== 'none') return;
  sled.tether = { kind: endpoint };

  // Stamp the wielded rope slot so save/reload + auto-detach guards work.
  const slot = ctx.inventory.slots[ctx.inventory.selectedIdx];
  if (slot.item === 'rope') {
    if (!slot.meta) slot.meta = {};
    slot.meta.attachedSledId = sled.id;
  }

  if (!sled.ropeLine) {
    sled.ropeLine = makeRopeLine();
    ctx.three.scene.add(sled.ropeLine);
  }
  ctx.ui.showToast(endpoint === 'speeder' ? 'rope attached to speeder' : 'rope attached');
}

/** Untie the rope. Clears tether + ropeLine + the wielded rope slot's
 *  meta.attachedSledId. */
export function detachRope(ctx: GameContext, sled: Sled, reason?: string): void {
  if (sled.tether.kind === 'none') return;
  sled.tether = { kind: 'none' };
  if (sled.ropeLine) {
    disposeRopeLine(ctx, sled.ropeLine);
    sled.ropeLine = null;
  }

  // Clear meta.attachedSledId on any slot still pointing at this sled.
  // (Usually the wielded slot, but defensively scan all.)
  for (const s of ctx.inventory.slots) {
    if (s.meta && s.meta.attachedSledId === sled.id) {
      s.meta.attachedSledId = undefined;
    }
  }
  for (const s of ctx.inventory.backpack) {
    if (s.meta && s.meta.attachedSledId === sled.id) {
      s.meta.attachedSledId = undefined;
    }
  }

  if (reason) ctx.ui.showToast(reason);
}

// ─────────────────────────────────────────────────────────────
// Per-frame tow update
// ─────────────────────────────────────────────────────────────

const _anchor = new THREE.Vector3();
const _tetherForward = new THREE.Vector3();
const _target = new THREE.Vector3();
const _err = new THREE.Vector3();
const _camFwd = new THREE.Vector3();
const _ropePts = new Float32Array(6);

function ropeIsStillHeld(ctx: GameContext, sledId: number): boolean {
  for (const s of ctx.inventory.slots) {
    if (s.meta && s.meta.attachedSledId === sledId) return true;
  }
  for (const s of ctx.inventory.backpack) {
    if (s.meta && s.meta.attachedSledId === sledId) return true;
  }
  return false;
}

/** Per-frame: apply spring-damper impulse on every tethered sled and
 *  rebuild its rope Line. Insertion point in main.ts is AFTER
 *  updateSpeeder + updatePlayer so the tether endpoint positions are
 *  finalized for this frame. */
export function updateSleds(ctx: GameContext, dt: number): void {
  for (const sled of ctx.sleds.list) {
    // Cheap sync: visuals follow the body each frame (incl. detached sleds
    // that may have been bumped by raiders or settled on a slope).
    const tr = sled.body.translation();
    const hy = Tuning.SLED_HALF_EXTENTS_Y;
    sled.group.position.set(tr.x, tr.y - 0.08 - hy, tr.z);
    // Y-only yaw from quaternion.
    const rot = sled.body.rotation();
    const sy = 2 * (rot.w * rot.y);
    const cy = 1 - 2 * (rot.y * rot.y);
    sled.group.rotation.y = Math.atan2(sy, cy);
    sled.pos.set(tr.x, sled.group.position.y, tr.z);

    if (sled.tether.kind === 'none') continue;

    // Auto-detach guard: rope dropped / overwritten while tethered.
    if (!ropeIsStillHeld(ctx, sled.id)) {
      detachRope(ctx, sled, 'rope dropped — sled untied');
      continue;
    }

    // Compute anchor + forward of the current tether endpoint.
    if (sled.tether.kind === 'speeder') {
      const s = ctx.speeder;
      if (!s) {
        detachRope(ctx, sled, 'speeder gone — sled untied');
        continue;
      }
      const bikePos = s.body.translation();
      // Bike forward = (-sin(yaw), 0, -cos(yaw)). Anchor 1m BEHIND seat.
      const bfx = -Math.sin(s.yaw);
      const bfz = -Math.cos(s.yaw);
      _anchor.set(bikePos.x - bfx * 1.0, bikePos.y, bikePos.z - bfz * 1.0);
      _tetherForward.set(bfx, 0, bfz);
      // Speeder reverse guard: zero spring force when bike is moving
      // backward along its own forward axis. Sled just drifts under damping.
      const lv = s.body.linvel();
      const fwdDot = lv.x * bfx + lv.z * bfz;
      if (fwdDot < -0.2) {
        // skip spring impulse this frame — still rebuild rope visual below
        rebuildRopeLine(sled, _anchor, tr);
        continue;
      }
    } else {
      // Player endpoint — anchor at hip height behind capsule.
      const ppos = ctx.player.body.body.translation();
      ctx.three.camera.getWorldDirection(_camFwd);
      _camFwd.y = 0;
      if (_camFwd.lengthSq() < 1e-6) _camFwd.set(0, 0, -1);
      _camFwd.normalize();
      _anchor.set(ppos.x, ppos.y - 0.2, ppos.z);
      _tetherForward.copy(_camFwd);
    }

    _target.set(
      _anchor.x - _tetherForward.x * Tuning.SLED_TOW_DISTANCE,
      _anchor.y,
      _anchor.z - _tetherForward.z * Tuning.SLED_TOW_DISTANCE,
    );

    // Snap-distance check (anchor → sled).
    const dx = tr.x - _anchor.x;
    const dz = tr.z - _anchor.z;
    const dist = Math.hypot(dx, dz);
    if (dist > Tuning.SLED_TOW_MAX_DIST) {
      detachRope(ctx, sled, 'rope snapped');
      continue;
    }

    // Spring-damper impulse on the sled body.
    _err.set(_target.x - tr.x, 0, _target.z - tr.z);
    const lv = sled.body.linvel();
    const fx = _err.x * Tuning.SLED_TOW_SPRING_K - lv.x * Tuning.SLED_TOW_SPRING_DAMP;
    const fz = _err.z * Tuning.SLED_TOW_SPRING_K - lv.z * Tuning.SLED_TOW_SPRING_DAMP;
    sled.body.applyImpulse({ x: fx * dt, y: 0, z: fz * dt }, true);

    rebuildRopeLine(sled, _anchor, tr);
  }
}

function rebuildRopeLine(
  sled: Sled,
  anchor: THREE.Vector3,
  sledBodyTr: { x: number; y: number; z: number },
): void {
  if (!sled.ropeLine) return;
  // Sled attach point ≈ ropeStub world position. Approximated via body
  // pose: forward of body = (-sin(yaw), 0, -cos(yaw)) where yaw is from
  // the group's already-synced rotation.y; stub is 0.33m up and HZ
  // forward of center.
  const yaw = sled.group.rotation.y;
  const fx = -Math.sin(yaw);
  const fz = -Math.cos(yaw);
  const ax = sledBodyTr.x + fx * Tuning.SLED_HALF_EXTENTS_Z;
  const ay = sledBodyTr.y + 0.25;
  const az = sledBodyTr.z + fz * Tuning.SLED_HALF_EXTENTS_Z;

  _ropePts[0] = anchor.x;
  _ropePts[1] = anchor.y;
  _ropePts[2] = anchor.z;
  _ropePts[3] = ax;
  _ropePts[4] = ay;
  _ropePts[5] = az;
  const attr = sled.ropeLine.geometry.getAttribute('position') as THREE.BufferAttribute;
  attr.array = _ropePts;
  attr.needsUpdate = true;
  sled.ropeLine.geometry.computeBoundingSphere();
}

/** Speeder mount hook — promote any 'player'-tethered sleds to 'speeder'.
 *  Called from speeder.ts at the moment the player mounts. */
export function transferTetherOnMount(ctx: GameContext): void {
  for (const sled of ctx.sleds.list) {
    if (sled.tether.kind === 'player') {
      sled.tether = { kind: 'speeder' };
      ctx.ui.showToast('rope transferred to speeder');
      return; // only one sled can be tethered at a time per current scope
    }
  }
}

/** Speeder dismount hook — demote any 'speeder'-tethered sleds back to
 *  'player'. Called from speeder.ts at dismount. */
export function transferTetherOnDismount(ctx: GameContext): void {
  for (const sled of ctx.sleds.list) {
    if (sled.tether.kind === 'speeder') {
      sled.tether = { kind: 'player' };
      ctx.ui.showToast('rope back in hand');
      return;
    }
  }
}
