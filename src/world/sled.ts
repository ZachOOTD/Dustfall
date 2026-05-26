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
// ACA — sled visual reworked from wood planks to scrap metal sheet.
// woodGrainMaterial import retired (no callers in this module now).
import { createMetalMaterial } from './metalMaterial.ts';
import { createPaintedMetalMaterial } from './paintMaterial.ts';
// ACB P1 — locker-on-sled needs to spawn + attach lockers to a sled.
import { spawnLockerAt, findLockerById } from './locker.ts';
import { removeItems } from '../inventory/inventory.ts';
// ACC P2 — sled-rider promotion needs to read Pickup state.
import type { Pickup } from '../pickups/pickups.ts';

// ACC B1 Phase 2 — Tether now uses the shared RopeEndpoint vocabulary
// from world/rope.ts. The sled holds a SINGLE endpoint (the "other"
// end — the puller / anchor); the sled itself is the implicit second
// endpoint. For non-sled tethers (future kinds: corpse-to-stake,
// pickup-to-pickup), see the Tether{a,b} type in rope.ts.
//
// SledTether is kept as a legacy alias to RopeEndpoint so old call sites
// + save format keep compiling; new code should reference RopeEndpoint.
// 'sled' kind is logically impossible for a sled's own tether (can't
// tow yourself) but is allowed type-wise; defensive code paths handle
// the impossible case as a no-op.
import type { RopeEndpoint } from './rope.ts';
import { resolveEndpointWorldPos } from './rope.ts';
export type SledTether = RopeEndpoint;

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
  /** QQ-2 — Tube-mesh rope from anchor to sled front-yoke, rebuilt each
   *  frame in updateSleds via a 5-point CatmullRomCurve3 with mid-point
   *  sag. Allocated on attach, disposed on detach. */
  ropeMesh: THREE.Mesh | null;
  /** ACB P1 — locker attached on top of the sled deck for mobile
   *  storage. When set, the locker's mesh is parented to sled.group
   *  (visual follows automatically) and locker.pos is synced each
   *  frame to sled.pos so interactions still work. null = no locker. */
  attachedLockerId: number | null;
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

// ACA — Sled visual rework. User feedback: "currently it actually looks
// like a sled but I don't want it to actually look like a sled. I'd
// rather it look like an old sheet of scrap metal with a handle and
// maybe turned up and warped on the sides a bit". Replaced wood-plank
// look with warped scrap metal sheet + welded handle yoke.
//
// Pre-ACA materials retired:
//   _plankMat (wood deck), _plankDarkMat (slats), _runnerMat (rails).
// New material is a single scrap-metal shader.
const _sheetMat = createPaintedMetalMaterial(0x6e5e48, { wearLevel: 0.85 });
const _sheetUnderMat = createMetalMaterial(0x4a3a28, { wornScale: 10.0, scratchStrength: 0.15 });
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

  // ACA — Warped scrap-metal sheet sled. PlaneGeometry subdivided +
  // per-vertex displacements at the LATERAL edges to curl them up
  // (like a sheet that's been dented + warped). Top face is the deck.
  // Below the sheet: a thin underside metal mesh for thickness +
  // shadow casting.
  //
  // Geometry: PlaneGeometry rotated to be horizontal (XZ plane). Width
  // segments give the resolution for the edge-curl displacement.
  const SHEET_SEGS = 16;          // lateral subdivisions for smooth curl
  const sheetGeom = new THREE.PlaneGeometry(hx * 2, hz * 2, SHEET_SEGS, 4);
  sheetGeom.rotateX(-Math.PI / 2); // make horizontal (was vertical XY)
  // Warp the lateral edges UP. Edge curl amount peaks at |x| = hx and
  // falls off toward the center. Vary slightly by z so the warp isn't
  // perfectly uniform (procedural noise look).
  {
    const pos = sheetGeom.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      // Normalized distance from center along X, raised to power for
      // sharper edge curl.
      const nx = Math.abs(x) / hx;
      const curl = Math.pow(nx, 2.3);
      // Slight variation along z so the edges aren't perfectly straight
      const variation = Math.sin(z * 8.0) * 0.04 + Math.cos(z * 11.0) * 0.02;
      const yOffset = curl * (hy * 2.2 + variation);
      // Also nudge the X slightly inward at the curl to suggest cloth-like fold
      const xPinch = Math.sign(x) * curl * 0.02;
      pos.setY(i, pos.getY(i) + yOffset);
      pos.setX(i, x - xPinch);
    }
    pos.needsUpdate = true;
    sheetGeom.computeVertexNormals();
  }
  const deck = new THREE.Mesh(sheetGeom, _sheetMat);
  // The deck "floats" slightly above ground (hy = thickness reference)
  deck.position.set(0, 0.06 + hy, 0);
  g.add(deck);

  // Under-side mesh — duplicate of the sheet, flipped so its top faces
  // DOWN, slightly lower in Y. Gives the metal sheet visible thickness
  // from below + side angles.
  const underGeom = sheetGeom.clone();
  underGeom.rotateZ(Math.PI);   // flip upside down
  const underside = new THREE.Mesh(underGeom, _sheetUnderMat);
  underside.position.set(0, 0.06 + hy - 0.018, 0); // ~1.8cm thickness
  g.add(underside);

  // Rivets along the sheet edges — 4 along each lateral edge + 3 along
  // front/back. Small dark metal hemispheres simulating bolts.
  const rivetMat = _sheetUnderMat;
  const RIVET_R = 0.012;
  // Lateral edges (curled-up sides)
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const t = -hz + (hz * 2 / 4) * (i + 0.5);
      // Approximate Y at the curled edge — match the displacement formula
      const yEdge = (hy * 2.2 + Math.sin(t * 8.0) * 0.04 + Math.cos(t * 11.0) * 0.02);
      const rivet = new THREE.Mesh(new THREE.SphereGeometry(RIVET_R, 6, 4), rivetMat);
      rivet.position.set(sx * (hx - 0.03), 0.06 + hy + yEdge * 0.9, t);
      g.add(rivet);
    }
  }
  // Front + back edge rivets (flat top)
  for (const sz of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const x = -hx * 0.5 + (hx * 0.5) * i;
      const rivet = new THREE.Mesh(new THREE.SphereGeometry(RIVET_R, 6, 4), rivetMat);
      rivet.position.set(x, 0.06 + hy + 0.018, sz * (hz - 0.04));
      g.add(rivet);
    }
  }

  // ACA — Welded handle yoke. Simple bent-pipe handle: 2 vertical posts
  // welded to the FRONT edge of the sheet (local -Z), joined by a
  // horizontal cross-bar (the rope tie point). Metal not wood now.
  const yokeBase = new THREE.Group();
  yokeBase.position.set(0, 0.06 + hy, -(hz - 0.05));
  g.add(yokeBase);
  for (const sx of [-1, 1]) {
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.022, 0.022, 0.40, 8),
      _sheetUnderMat,
    );
    post.position.set(sx * 0.18, 0.18, 0);
    post.rotation.z = sx * 0.30;       // angled outward at top
    yokeBase.add(post);
    // Weld-bead at base (small flattened sphere)
    const weld = new THREE.Mesh(
      new THREE.SphereGeometry(0.025, 6, 4),
      _sheetUnderMat,
    );
    weld.position.set(sx * 0.16, 0.01, 0);
    weld.scale.set(1.3, 0.5, 1.0);
    yokeBase.add(weld);
  }
  // Horizontal cross-bar — rope ties here. Thicker than the posts.
  const ropeStub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.04, 0.46, 8),
    _ropeStubMat,
  );
  ropeStub.position.set(0, 0.37, 0);
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
    .addScaledVector(dir, Tuning.PLACEMENT_DISTANCE_M);
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

  // Dynamic body — center at the cargo-deck center so position correction
  // applies through the right point. QQ-2: ROTATIONS LOCKED so the sled
  // can't spin around the player as the rope yanks it from off-center.
  // Yaw is driven manually each frame via group.rotation.y in updateSleds.
  const hx = Tuning.SLED_HALF_EXTENTS_X;
  const hy = Tuning.SLED_HALF_EXTENTS_Y;
  const hz = Tuning.SLED_HALF_EXTENTS_Z;
  const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
    .setTranslation(pos.x, pos.y + 0.08 + hy, pos.z)
    .setLinearDamping(Tuning.SLED_LINEAR_DAMP)
    .setAngularDamping(Tuning.SLED_ANGULAR_DAMP)
    .setCcdEnabled(true); // sled can be yanked at speeder speeds → CCD on
  const body = ctx.physics.world.createRigidBody(bodyDesc);
  // Lock all rotation axes. Body translates only; visual yaw is managed
  // separately by updateSleds so it always faces the rope anchor.
  body.setEnabledRotations(false, false, false, true);
  const colDesc = RAPIER.ColliderDesc.cuboid(hx, hy, hz)
    .setDensity(Tuning.SLED_DENSITY)
    // QQ-2 — friction back up to 0.6: metal sled on sand. With locked
    // rotations + inextensible-rope constraint replacing the spring,
    // we no longer need to fight static friction at small errors —
    // the rope only pulls when stretched past `SLED_TOW_DISTANCE`.
    .setFriction(0.6);
  const collider = ctx.physics.world.createCollider(colDesc, body);

  // ACC P1 — top deck collider. Items dropped on the sled physically
  // rest here. Sits just above the main cuboid's top face (body-local
  // Y = +hy + topHy + epsilon) so it's the highest surface; pickups
  // settle on it. High friction so items grip the sled when it
  // accelerates/turns. Slightly inset on X (inside the visual curled
  // rim) + Z (avoid the welded yoke area at the front).
  const topHy = Tuning.SLED_TOP_DECK_HALF_THICKNESS;
  const topHx = hx * Tuning.SLED_TOP_DECK_INSET_X_FRAC;
  const topHz = hz * Tuning.SLED_TOP_DECK_INSET_Z_FRAC;
  const topColDesc = RAPIER.ColliderDesc.cuboid(topHx, topHy, topHz)
    // Translation is in body-local space — body center is at body.y;
    // bottom of top deck sits flush on top of the main cuboid.
    .setTranslation(0, hy + topHy + 0.001, 0)
    .setFriction(Tuning.SLED_TOP_DECK_FRICTION)
    // Density 0 keeps the top deck inertially neutral — it's a
    // "shelf" property of the sled, not a separate mass. The main
    // cuboid already accounts for the sled's mass via SLED_DENSITY.
    .setDensity(0);
  ctx.physics.world.createCollider(topColDesc, body);

  const sled: Sled = {
    id,
    group,
    body,
    collider,
    pos: pos.clone(),
    contents: contents.slice(),
    opened: false,
    hovered: false,
    tether: tether,   // ACA — preserve full tether object (static-pos has x/z payload)
    ropeMesh: null,
    attachedLockerId: null,   // ACB P1 — populated when player attaches a locker
  };
  ctx.sleds.list.push(sled);

  // If save restored a sled in the tethered state, allocate the rope mesh
  // so it'll be visible on the very first frame after load.
  if (tether.kind !== 'none') {
    sled.ropeMesh = makeRopeMesh();
    ctx.three.scene.add(sled.ropeMesh);
  }

  return sled;
}

// ─────────────────────────────────────────────────────────────
// Rope visual (QQ-2 — thick tube along a sagging curve)
// ─────────────────────────────────────────────────────────────

const _ropeMaterial = new THREE.MeshLambertMaterial({
  color: Tuning.SLED_ROPE_COLOR_HEX,
  flatShading: true,
});

function makeRopeMesh(): THREE.Mesh {
  // Placeholder geometry — rebuilt each frame in rebuildRopeMesh.
  // Tiny 2-point curve so we can construct a valid TubeGeometry up
  // front; first updateSleds tick replaces it with the real thing.
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, 0.01),
  ]);
  const geo = new THREE.TubeGeometry(curve, 1, Tuning.SLED_ROPE_RADIUS, 6, false);
  const mesh = new THREE.Mesh(geo, _ropeMaterial);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false; // rope endpoints can sit just outside the frustum
  return mesh;
}

function disposeRopeMesh(ctx: GameContext, mesh: THREE.Mesh): void {
  ctx.three.scene.remove(mesh);
  mesh.geometry.dispose();
  // Material is shared (_ropeMaterial) — don't dispose.
}

// ─────────────────────────────────────────────────────────────
// Rope attach / detach
// ─────────────────────────────────────────────────────────────

/** Tie the rope from the wielded slot to this sled. Caller is responsible
 *  for verifying the wielded slot is `rope`. `endpoint` is the OTHER end
 *  of the rope (the puller / anchor); the sled itself is the implicit
 *  second endpoint. */
export function attachRopeToSled(
  ctx: GameContext,
  sled: Sled,
  endpoint: RopeEndpoint,
): void {
  if (sled.tether.kind !== 'none') return;
  if (endpoint.kind === 'none') return;  // defensive: never attach to nothing
  sled.tether = endpoint;

  // Stamp the wielded rope slot so save/reload + auto-detach guards work.
  const slot = ctx.inventory.slots[ctx.inventory.selectedIdx];
  if (slot.item === 'rope') {
    if (!slot.meta) slot.meta = {};
    slot.meta.attachedSledId = sled.id;
  }

  if (!sled.ropeMesh) {
    sled.ropeMesh = makeRopeMesh();
    ctx.three.scene.add(sled.ropeMesh);
  }
  // ABZ + ACC — per-endpoint attach toast.
  const toastMsg =
    endpoint.kind === 'speeder' ? 'rope attached to speeder' :
    endpoint.kind === 'companion' ? 'rope attached to companion' :
    endpoint.kind === 'static-pos' ? 'rope staked' :
    'rope attached';
  ctx.ui.showToast(toastMsg);
}

// ─────────────────────────────────────────────────────────────
// Locker attachment (ACB P1)
// ─────────────────────────────────────────────────────────────

/** Spawn a locker on top of the sled. Consumes one locker_kit from the
 *  player's inventory. The locker mesh becomes a child of the sled's
 *  group so it travels with the sled. The locker stays in
 *  ctx.lockers.list so interactions still find it. */
export function attachLockerToSled(ctx: GameContext, sled: Sled): boolean {
  if (sled.attachedLockerId !== null) {
    ctx.ui.showToast('sled already has a locker');
    return false;
  }
  // Consume one locker_kit from inventory.
  if (!removeItems(ctx.inventory, 'locker_kit', 1)) {
    return false;
  }
  // Spawn locker at sled's world position. We compute the world pos
  // before re-parenting so the visual lands at the correct spot.
  const sledWorldPos = new THREE.Vector3();
  sled.group.getWorldPosition(sledWorldPos);
  // Locker rotation matches sled's group yaw (locker stays oriented
  // with the sled).
  const locker = spawnLockerAt(ctx, sledWorldPos, sled.group.rotation.y, []);
  // Re-parent locker mesh from scene → sled.group. THREE preserves
  // world transforms by default during .add(), but we want LOCAL pos
  // = (0, deckHeight, 0) so the locker rides on top of the sled. So
  // we set local pos AFTER parenting.
  ctx.three.scene.remove(locker.mesh);
  sled.group.add(locker.mesh);
  // Local position on the sled deck top. Sled group origin sits at
  // the bottom-center, so deck-top is ~0.08 + hy*2.
  const deckTopLocal = 0.06 + Tuning.SLED_HALF_EXTENTS_Y * 2 + 0.04;
  locker.mesh.position.set(0, deckTopLocal, 0);
  locker.mesh.rotation.y = 0;        // local rotation (group already rotated)
  sled.attachedLockerId = locker.id;
  ctx.ui.showToast('locker placed on sled');
  return true;
}

/** Untie the rope. Clears tether + ropeMesh + the wielded rope slot's
 *  meta.attachedSledId. */
export function detachRope(ctx: GameContext, sled: Sled, reason?: string): void {
  if (sled.tether.kind === 'none') return;
  sled.tether = { kind: 'none' };
  if (sled.ropeMesh) {
    disposeRopeMesh(ctx, sled.ropeMesh);
    sled.ropeMesh = null;
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
const _sledAttach = new THREE.Vector3();
const _towBarTmp = new THREE.Vector3();

function ropeIsStillHeld(ctx: GameContext, sledId: number): boolean {
  for (const s of ctx.inventory.slots) {
    if (s.meta && s.meta.attachedSledId === sledId) return true;
  }
  for (const s of ctx.inventory.backpack) {
    if (s.meta && s.meta.attachedSledId === sledId) return true;
  }
  return false;
}

/** Shortest signed wrap of an angle delta into (-π, π]. */
function wrapAngle(a: number): number {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

/** Sled's local-forward direction in world space, derived from the
 *  manually-controlled group yaw (body rotation is locked). Sled's
 *  local front (where the rope ties on) is +Z in the makeSledVisual
 *  layout (yokeBase at z = -hz, so the FRONT is local -Z). We treat
 *  group.rotation.y as the yaw of the local -Z forward axis around
 *  world Y. */
function sledForward(yaw: number): { x: number; z: number } {
  return { x: -Math.sin(yaw), z: -Math.cos(yaw) };
}

/** Per-frame: enforce the inextensible-rope constraint on every
 *  tethered sled and rebuild its rope mesh.
 *
 *  Insertion point in main.ts is AFTER updateSpeeder + updatePlayer
 *  so both possible anchor endpoints have finalized this-frame pose.
 *
 *  Constraint model (replaces the previous spring-damper — QQ-2):
 *  - If `dist(anchor, sled_front) <= SLED_TOW_DISTANCE`: rope is
 *    slack, no force applied. Sled stays put on the sand (friction
 *    holds it).
 *  - If `dist > SLED_TOW_DISTANCE`: position-snap the sled body
 *    inward by the stretch amount + zero out any velocity component
 *    pointing AWAY from the anchor.
 *  - If `dist > SLED_TOW_MAX_DIST`: rope tears free, auto-detach.
 *
 *  Visual yaw: each frame, the sled's group is lerped toward "face
 *  the anchor" so the bow of the sled tracks the pull direction. */
export function updateSleds(ctx: GameContext, _dt: number): void {
  for (const sled of ctx.sleds.list) {
    const tr = sled.body.translation();
    const hy = Tuning.SLED_HALF_EXTENTS_Y;
    // Sync group position to body each frame. group.rotation.y is
    // managed manually below (body rotation is locked).
    sled.group.position.set(tr.x, tr.y - 0.08 - hy, tr.z);
    sled.pos.set(tr.x, sled.group.position.y, tr.z);

    // ACB P1 — sync attached locker's world-pos for distance checks.
    // The mesh is parented to sled.group so the visual auto-follows,
    // but locker.pos (used by interaction.ts for hover-distance math)
    // needs explicit per-frame update.
    if (sled.attachedLockerId !== null) {
      const lk = findLockerById(ctx.lockers.list, sled.attachedLockerId);
      if (lk) {
        lk.mesh.getWorldPosition(lk.pos);
      } else {
        sled.attachedLockerId = null;  // locker gone (corrupt state); clear
      }
    }

    if (sled.tether.kind === 'none') continue;

    // Auto-detach guard: rope dropped / overwritten while tethered.
    if (!ropeIsStillHeld(ctx, sled.id)) {
      detachRope(ctx, sled, 'rope dropped — sled untied');
      continue;
    }

    // ACC B1 Phase 2 — resolve via the shared rope endpoint resolver.
    // Returns null when the endpoint's backing resource is gone (e.g.,
    // companion picked back into a pod, speeder somehow despawned).
    const resolved = resolveEndpointWorldPos(ctx, sled.tether);
    if (!resolved) {
      const reason =
        sled.tether.kind === 'speeder' ? 'speeder gone — sled untied' :
        sled.tether.kind === 'companion' ? 'companion gone — sled untied' :
        'rope endpoint gone — sled untied';
      detachRope(ctx, sled, reason);
      continue;
    }
    _anchor.set(resolved.x, resolved.y, resolved.z);
    // `_towBarTmp` retained for backward-compat with any other code that
    // may have read it as a side effect; not needed by this branch any
    // more. (Module-local; safe to leave allocated.)
    void _towBarTmp;

    // Sled attach point in world space — front of the sled. Uses the
    // manually-tracked group yaw (body rotation is locked at identity).
    const yaw = sled.group.rotation.y;
    const fwd = sledForward(yaw);
    _sledAttach.set(
      tr.x + fwd.x * Tuning.SLED_HALF_EXTENTS_Z,
      tr.y + 0.20,
      tr.z + fwd.z * Tuning.SLED_HALF_EXTENTS_Z,
    );

    // Horizontal distance from anchor to sled attach point.
    const dx = _sledAttach.x - _anchor.x;
    const dz = _sledAttach.z - _anchor.z;
    const dist = Math.hypot(dx, dz);

    // Hard snap — rope tears free if we're way past the constraint
    // (anchor teleported / speeder boosted through a wreck).
    if (dist > Tuning.SLED_TOW_MAX_DIST) {
      detachRope(ctx, sled, 'rope snapped');
      continue;
    }

    // Inextensible-rope constraint. Slack rope = no force.
    if (dist > Tuning.SLED_TOW_DISTANCE && dist > 1e-4) {
      const stretch = dist - Tuning.SLED_TOW_DISTANCE;
      // Unit vector FROM sled-attach TOWARD anchor.
      const ux = -dx / dist;
      const uz = -dz / dist;

      // 1) Position correction: translate the sled body inward by the
      //    full stretch. The body has locked rotations + CCD so this
      //    teleport is well-behaved.
      sled.body.setTranslation(
        { x: tr.x + ux * stretch, y: tr.y, z: tr.z + uz * stretch },
        true,
      );

      // 2) Velocity correction: project out the outward radial
      //    component. Positive `vRadial` = sled moving TOWARD anchor;
      //    negative = away. We only remove the negative part — the
      //    sled is free to drift toward the anchor on its own
      //    momentum (rare in practice).
      const lv = sled.body.linvel();
      const vRadial = lv.x * ux + lv.z * uz;
      if (vRadial < 0) {
        sled.body.setLinvel(
          { x: lv.x - vRadial * ux, y: lv.y, z: lv.z - vRadial * uz },
          true,
        );
      }
    }

    // Visual yaw — lerp the sled to face the anchor so its bow tracks
    // the rope. Reads the post-correction body position so the orient
    // is consistent with the rope direction we'll draw this frame.
    {
      const trAfter = sled.body.translation();
      const adx = _anchor.x - trAfter.x;
      const adz = _anchor.z - trAfter.z;
      if (adx * adx + adz * adz > 1e-4) {
        // Sled's local -Z should point toward the anchor → yaw =
        // atan2(adx, adz). (For "-Z forward" model: world fwd =
        // (-sin yaw, -cos yaw), so to point at (adx, adz) we want
        // -sin yaw = adx/|d|, -cos yaw = adz/|d| → yaw = atan2(-adx, -adz).)
        const targetYaw = Math.atan2(-adx, -adz);
        const err = wrapAngle(targetYaw - sled.group.rotation.y);
        sled.group.rotation.y += err * Tuning.SLED_YAW_LERP;
      }
    }

    rebuildRopeMesh(sled, _anchor);
  }
}

/** Rebuild the sled's rope tube along a sagging Catmull-Rom curve
 *  between the anchor and the sled's front attach point. Mid-points
 *  sag downward proportional to the slack in the rope (taut = max
 *  sag, fully stretched = zero sag). */
const _ropeCurvePoints: THREE.Vector3[] = [
  new THREE.Vector3(), new THREE.Vector3(),
  new THREE.Vector3(), new THREE.Vector3(),
  new THREE.Vector3(),
];

function rebuildRopeMesh(sled: Sled, anchor: THREE.Vector3): void {
  if (!sled.ropeMesh) return;
  const tr = sled.body.translation();
  const yaw = sled.group.rotation.y;
  const fwd = sledForward(yaw);
  const attachX = tr.x + fwd.x * Tuning.SLED_HALF_EXTENTS_Z;
  const attachY = tr.y + 0.20;
  const attachZ = tr.z + fwd.z * Tuning.SLED_HALF_EXTENTS_Z;

  const dx = attachX - anchor.x;
  const dz = attachZ - anchor.z;
  const horizDist = Math.hypot(dx, dz);
  // Sag is 0 at fully-stretched (rope is straight + horizontal), max
  // at slack. Use the rope's normalized slack as the sag factor.
  const slack = Math.max(0, Tuning.SLED_TOW_DISTANCE - horizDist);
  const sagFrac = Math.min(1, slack / Tuning.SLED_TOW_DISTANCE);
  const sag = Tuning.SLED_ROPE_SAG * sagFrac;

  // 5-point Catmull-Rom: endpoints + 3 evenly spaced midpoints with
  // a parabolic sag profile (max at the middle).
  _ropeCurvePoints[0].set(anchor.x, anchor.y, anchor.z);
  _ropeCurvePoints[4].set(attachX, attachY, attachZ);
  for (let i = 1; i <= 3; i++) {
    const t = i / 4;
    const px = anchor.x + (attachX - anchor.x) * t;
    const py = anchor.y + (attachY - anchor.y) * t;
    const pz = anchor.z + (attachZ - anchor.z) * t;
    // Parabolic drop — sin(π·t) peaks at t=0.5.
    _ropeCurvePoints[i].set(px, py - Math.sin(Math.PI * t) * sag, pz);
  }
  const curve = new THREE.CatmullRomCurve3(_ropeCurvePoints, false, 'catmullrom', 0.5);

  // Dispose previous geometry + replace with a fresh tube.
  sled.ropeMesh.geometry.dispose();
  sled.ropeMesh.geometry = new THREE.TubeGeometry(
    curve,
    /* tubularSegments */ 16,
    Tuning.SLED_ROPE_RADIUS,
    /* radialSegments */ 6,
    /* closed */ false,
  );
}

// ─────────────────────────────────────────────────────────────
// Riding pickups (ACC P2 — items physically rest on the sled deck
// and travel with it)
// ─────────────────────────────────────────────────────────────
//
// Friction alone can't keep items on the sled at sprint speeds: the
// inextensible-rope position-snap teleports the sled body forward by
// ~0.1m/frame, faster than Coulomb friction can drag a Newtonian body
// along. Solution: when an ABM dropped pickup's body comes to rest on
// the sled's top deck collider, "promote" it to a kinematic-rider:
//
//   1. Body type → KinematicPositionBased.
//   2. Capture the pickup's world pose, map to sled.group local coords,
//      store on pickup.ridingLocalPos + ridingLocalQuat.
//   3. Each frame, recompute world pose from sled.group.matrixWorld
//      applied to the captured local pose. Drive the body via
//      setNextKinematicTranslation + setNextKinematicRotation; mirror
//      onto mesh + pickup.pos so raycast / save / take all read correct.
//
// Player takes the pickup → existing despawn flow removes the body
// (works for any body type). Sled gets garbage-collected → release rider
// back to dynamic so it falls + settles on the ground.

const _riderTmpVec = new THREE.Vector3();
const _riderTmpQuat = new THREE.Quaternion();
const _riderSledInvMat = new THREE.Matrix4();
const _riderSledInvQuat = new THREE.Quaternion();

/** Vertical band (relative to sled top face) within which a settled pickup
 *  counts as "on the sled" for promotion. */
const RIDE_ABOVE_MIN = -0.05;
const RIDE_ABOVE_MAX = 0.6;

/** Per-frame: drive any riding pickup's body + mesh from its sled's
 *  current transform, and promote settled-on-sled pickups to riders.
 *  Insertion point in main.ts is AFTER updateSleds so the sled.group
 *  transforms reflect this-frame's tow correction. */
export function updateSledRiders(ctx: GameContext): void {
  for (const p of ctx.pickups.list) {
    if (!p.body) continue;

    // Existing rider: drive transform from sled.
    if (p.ridingSledId !== null) {
      const sled = findSledById(ctx.sleds.list, p.ridingSledId);
      if (!sled || !p.ridingLocalPos || !p.ridingLocalQuat) {
        releaseSledRider(p);
        continue;
      }
      sled.group.updateMatrixWorld();
      _riderTmpVec.copy(p.ridingLocalPos).applyMatrix4(sled.group.matrixWorld);
      _riderTmpQuat.copy(sled.group.quaternion).multiply(p.ridingLocalQuat);
      p.body.setNextKinematicTranslation({
        x: _riderTmpVec.x, y: _riderTmpVec.y, z: _riderTmpVec.z,
      });
      p.body.setNextKinematicRotation({
        x: _riderTmpQuat.x, y: _riderTmpQuat.y, z: _riderTmpQuat.z, w: _riderTmpQuat.w,
      });
      // Mirror onto mesh + pos so raycast hover / save read the right
      // world position. (updatePickups was gated to skip riders, so
      // we own the mesh sync here.)
      p.mesh.position.copy(_riderTmpVec);
      p.mesh.quaternion.copy(_riderTmpQuat);
      p.pos.copy(_riderTmpVec);
      continue;
    }

    // Non-rider: check if it has settled on a sled and should promote.
    // Only inspect sleeping bodies — that's Rapier's signal that the
    // pickup has come to rest from a drop / settle. Avoids promoting
    // a body that's still in flight from a throw arc.
    if (!p.body.isSleeping()) continue;
    for (const sled of ctx.sleds.list) {
      if (pickupIsOnSledTop(p, sled)) {
        promoteSledRider(p, sled);
        break;
      }
    }
  }
}

/** XZ-and-Y range gate: pickup body translation lies above the sled's
 *  top deck (in sled-local coordinates, within the top collider's
 *  X/Z footprint + vertical band). */
function pickupIsOnSledTop(p: Pickup, sled: Sled): boolean {
  if (!p.body) return false;
  const t = p.body.translation();
  // Sled-local XZ. group.rotation.y is the sled's yaw; inverse-rotate
  // the world-space offset to test against the axis-aligned top deck.
  const dx = t.x - sled.pos.x;
  const dz = t.z - sled.pos.z;
  const yaw = sled.group.rotation.y;
  const cosY = Math.cos(-yaw);
  const sinY = Math.sin(-yaw);
  const localX = dx * cosY - dz * sinY;
  const localZ = dx * sinY + dz * cosY;
  const limX = Tuning.SLED_HALF_EXTENTS_X * Tuning.SLED_TOP_DECK_INSET_X_FRAC + 0.05;
  const limZ = Tuning.SLED_HALF_EXTENTS_Z * Tuning.SLED_TOP_DECK_INSET_Z_FRAC + 0.05;
  if (Math.abs(localX) > limX) return false;
  if (Math.abs(localZ) > limZ) return false;
  // Vertical band relative to the sled body's top + top-deck thickness.
  const sledBody = sled.body.translation();
  const topY = sledBody.y
    + Tuning.SLED_HALF_EXTENTS_Y
    + Tuning.SLED_TOP_DECK_HALF_THICKNESS * 2;
  const yDelta = t.y - topY;
  return yDelta >= RIDE_ABOVE_MIN && yDelta <= RIDE_ABOVE_MAX;
}

function promoteSledRider(p: Pickup, sled: Sled): void {
  if (!p.body) return;
  // Capture current world pose; map into sled-local space.
  sled.group.updateMatrixWorld();
  _riderSledInvMat.copy(sled.group.matrixWorld).invert();
  const localPos = new THREE.Vector3(p.pos.x, p.pos.y, p.pos.z)
    .applyMatrix4(_riderSledInvMat);
  _riderSledInvQuat.copy(sled.group.quaternion).invert();
  const localQuat = _riderSledInvQuat.clone().multiply(p.mesh.quaternion);
  // Switch body type to kinematic. From now on, position is driven by
  // setNextKinematicTranslation each frame; gravity + collisions no
  // longer move the body.
  p.body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true);
  p.ridingSledId = sled.id;
  p.ridingLocalPos = localPos;
  p.ridingLocalQuat = localQuat;
}

/** Release a pickup back to a free-falling dynamic body. Called when the
 *  sled it was riding is gone (defensive — sleds don't despawn in normal
 *  play but the auto-detach paths could conceivably get into a state
 *  where ridingSledId points at a removed sled). */
function releaseSledRider(p: Pickup): void {
  if (!p.body) return;
  p.body.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
  p.ridingSledId = null;
  p.ridingLocalPos = undefined;
  p.ridingLocalQuat = undefined;
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
