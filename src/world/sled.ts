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
import { createWoodGrainMaterial } from './woodGrainMaterial.ts';

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
  /** QQ-2 — Tube-mesh rope from anchor to sled front-yoke, rebuilt each
   *  frame in updateSleds via a 5-point CatmullRomCurve3 with mid-point
   *  sag. Allocated on attach, disposed on detach. */
  ropeMesh: THREE.Mesh | null;
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

// ABJ — Tier 2 C3: apply wood-grain procedural shader to sled deck +
// rails + runners. Pre-ABJ these were plain Lambert (one flat tone per
// plank). World-space sampling means each sled gets free per-instance
// variation. Runners get tighter ring density + stronger weathering to
// read as "dragged through sand for years".
const _plankMat = createWoodGrainMaterial(0x6b4a2c, {
  grainAxis: 0,                  // grain along +X (sled long axis)
  ringDensity: 6.0,
  weatherLevel: 0.35,
});
const _plankDarkMat = createWoodGrainMaterial(0x4a3220, {
  grainAxis: 0,
  ringDensity: 7.0,
  weatherLevel: 0.45,
});
const _runnerMat = createWoodGrainMaterial(0x3a2a1a, {
  grainAxis: 0,
  ringDensity: 9.0,
  weatherLevel: 0.6,
});
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
    ropeMesh: null,
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

  if (!sled.ropeMesh) {
    sled.ropeMesh = makeRopeMesh();
    ctx.three.scene.add(sled.ropeMesh);
  }
  ctx.ui.showToast(endpoint === 'speeder' ? 'rope attached to speeder' : 'rope attached');
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

    if (sled.tether.kind === 'none') continue;

    // Auto-detach guard: rope dropped / overwritten while tethered.
    if (!ropeIsStillHeld(ctx, sled.id)) {
      detachRope(ctx, sled, 'rope dropped — sled untied');
      continue;
    }

    // Resolve the world anchor (where the rope ties on the puller).
    if (sled.tether.kind === 'speeder') {
      const s = ctx.speeder;
      if (!s) {
        detachRope(ctx, sled, 'speeder gone — sled untied');
        continue;
      }
      // QQ-2 — anchor = world position of the bar mesh behind the seat.
      // We use the mesh's matrixWorld so the position reflects the
      // current frame's body translation + visual quaternion (the
      // group is sync'd inside updateSpeeder, which runs before us).
      s.towBar.getWorldPosition(_towBarTmp);
      _anchor.copy(_towBarTmp);
    } else {
      // Player endpoint — anchor at hip height behind capsule. Use the
      // capsule's center (-0.2 down so the rope drops naturally to
      // belt height, not the eye-level the camera lives at).
      const ppos = ctx.player.body.body.translation();
      _anchor.set(ppos.x, ppos.y - 0.2, ppos.z);
    }

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
