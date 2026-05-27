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
import { spawnFootprintPuff } from './footprintPuffs.ts';
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
  /** ACC playtest — sled yaw (radians, around world Y). Managed
   *  directly (lerped toward anchor each frame); body rotations are
   *  fully locked so the body itself never rotates. Visual quaternion
   *  is composed as (terrain-tilt × yaw) so the deck tilts on slopes
   *  but the yaw is stable + predictable. */
  yaw: number;
  /** ACC playtest — accumulated horizontal travel distance since last
   *  sand-puff. Emit one puff every ~0.45m of motion. Optional so
   *  pre-ACC saves load cleanly. */
  _sandPuffAccum?: number;
  /** ACC playtest — accumulated horizontal travel distance since last
   *  drag-track decal. Same shape as _sandPuffAccum, separate counter. */
  _trackAccum?: number;
  /** ACC playtest — last decal position. Used to compute segment
   *  direction for the next decal (more stable than reading sled.yaw
   *  which lerps frame-to-frame). */
  _lastTrackX?: number;
  _lastTrackZ?: number;
  /** ACC playtest follow-up — managed-scalar slope-slide velocity (XZ).
   *  We bypass Rapier's velocity integration for slope-slide because the
   *  contact solver was zeroing the tangential velocity each step due to
   *  the 0.6 friction against the heightfield (static friction angle ~31°
   *  swallowed all gentle/moderate dune slopes). The body remains dynamic
   *  for KCC/item contacts and rope-snap correction, but XZ motion comes
   *  from these managed scalars + direct setTranslation each frame.
   *  Damping applied each frame; gravity slide-acceleration added when
   *  on a slope > threshold. Optional so pre-fix saves load cleanly. */
  _slideVx?: number;
  _slideVz?: number;
  /** ACC playtest follow-up — per-frame XZ displacement applied to the
   *  body via setNextKinematicTranslation. Written at the end of each
   *  updateSleds iteration; READ by updatePlayer on the FOLLOWING frame
   *  to drag the player along when they're standing on the sled deck
   *  (moving-platform-ride). One frame stale by design — physics.step
   *  at the start of the next frame commits the sled to this delta,
   *  and the player's KCC desired-vector adds the same delta in the
   *  same frame, keeping them aligned. Optional so pre-fix saves load
   *  cleanly + first-frame readers get 0. */
  _frameDeltaX?: number;
  _frameDeltaZ?: number;
  /** ACC playtest follow-up (Option C) — sled's Y motion per frame.
   *  Tracked alongside _frameDeltaX/Z so the player-ride logic can
   *  apply the FULL 3D motion of the sled to the riding player, not
   *  just XZ. Without this, the player's Y stays still while the sled
   *  drops downhill, the player ends up too high relative to the
   *  deck, detection eventually drops, and they fall off. */
  _frameDeltaY?: number;
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
// ACC playtest — both materials pass localSpace:true per D109 (sled is
// a MOVING entity — world-space noise sampling would cause the paint
// chips + scratches to crawl across the deck as it moves). DoubleSide
// on the top sheet so the bottom face renders without needing a
// separate underside mesh (the previous underside-mesh approach
// produced inverted flapped corners visible from below after the
// back-curl was added).
const _sheetMat = createPaintedMetalMaterial(0x6e5e48, { wearLevel: 0.85, localSpace: true });
const _sheetUnderMat = createMetalMaterial(0x4a3a28, { wornScale: 10.0, scratchStrength: 0.15, localSpace: true });
_sheetMat.side = THREE.DoubleSide;
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
  const hz = Tuning.SLED_HALF_EXTENTS_Z;
  // ACD playtest follow-up — visual rim heights are now Tuning constants
  // (SLED_VISUAL_LATERAL_CURL + _BACK_CURL), decoupled from body's hy
  // which is much smaller post-fix.

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

  // ACC playtest — sheet surface Y at any (x, z) is the max of the
  // lateral curl + back curl displacements (no variation included
  // since that's just procedural noise — fine to approximate flat for
  // rivet placement). Used for placing rivets ON the surface
  // (was: rivets used wrong Y formula → floated above the sheet).
  const sheetYAt = (x: number, z: number): number => {
    const nx = Math.abs(x) / hx;
    const lateralCurl = Math.pow(nx, 2.3);
    const lateralY = lateralCurl * Tuning.SLED_VISUAL_LATERAL_CURL;
    const nz_back = Math.max(0, z / hz);
    const backCurl = Math.pow(nz_back, 2.6);
    const backY = backCurl * Tuning.SLED_VISUAL_BACK_CURL;
    return Math.max(lateralY, backY);
  };
  // Warp the lateral edges UP. Edge curl amount peaks at |x| = hx and
  // falls off toward the center. Vary slightly by z so the warp isn't
  // perfectly uniform (procedural noise look).
  // ACC playtest — added back-edge curl (only +Z direction; front-edge
  // stays flat for the yoke transition) per user feedback "items fell
  // off the back of the sled". Back curl + lateral curls combined via
  // max() so corners don't double-stack height.
  {
    const pos = sheetGeom.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      // LATERAL curl (existing): peaks at |x| = hx, falls off toward center.
      const nx = Math.abs(x) / hx;
      const lateralCurl = Math.pow(nx, 2.3);
      const lateralVar = Math.sin(z * 8.0) * 0.04 + Math.cos(z * 11.0) * 0.02;
      // ACC playtest — rim multiplier bumped 2.2 → 2.6 so the rim is
      // tall enough to contain items now that the visual deck is
      // lowered to terrain level (was 16cm above).
      const lateralY = lateralCurl * (Tuning.SLED_VISUAL_LATERAL_CURL + lateralVar);
      // BACK curl (new): ramps from 0 in front half to peak at z = +hz.
      // Sharper exponent (2.6) localises the rise to the rear edge so
      // the cargo area stays flat. Slightly lower amplitude than the
      // lateral curls so the back rim reads as a containment lip, not
      // a wall.
      const nz_back = Math.max(0, z / hz);
      const backCurl = Math.pow(nz_back, 2.6);
      const backVar = Math.sin(x * 8.0) * 0.03 + Math.cos(x * 11.0) * 0.02;
      const backY = backCurl * (Tuning.SLED_VISUAL_BACK_CURL + backVar);
      // Combine via max so corners don't stack to ~40cm. Smooth meet.
      const yOffset = Math.max(lateralY, backY);
      // Slight X-pinch at lateral edges (cloth-fold suggestion).
      const xPinch = Math.sign(x) * lateralCurl * 0.02;
      // Slight Z-pinch at back edge (matching cloth-fold suggestion).
      const zPinch = Math.sign(z) * backCurl * 0.015;
      pos.setY(i, pos.getY(i) + yOffset);
      pos.setX(i, x - xPinch);
      pos.setZ(i, z - zPinch);
    }
    pos.needsUpdate = true;
    sheetGeom.computeVertexNormals();
  }
  const deck = new THREE.Mesh(sheetGeom, _sheetMat);
  // ACC playtest — deck mesh at group origin (= terrain level after
  // body offset change below). The flat deck plane is what the player
  // sees as the bottom of the sled, so it should touch the sand.
  deck.position.set(0, 0, 0);
  g.add(deck);

  // ACC playtest — previous "underside mesh" (cloned + rotateZ(π))
  // produced inverted flapped corners on the bottom view after the
  // back-curl was added (the rotation flipped the up-curls into
  // down-curls). Now the top sheet's DoubleSide bottom face is the
  // entire bottom of the deck; the paint material reads the same
  // from both sides, which is acceptable for the scrap-metal aesthetic.

  // Rivets along the sheet edges — 4 along each lateral edge + 3 along
  // front/back. Small dark metal hemispheres simulating bolts.
  const rivetMat = _sheetUnderMat;
  const RIVET_R = 0.012;
  // ACC playtest — all rivets snap to the actual sheet surface via
  // sheetYAt(x, z) + a tiny visible-above-surface bump. Previously the
  // lateral rivets used a Y formula evaluated at x=hx (the rim peak)
  // but were positioned at x=hx-0.03 (slightly inside) — small
  // mismatch + the float was visible as "floating bolts". Front/back
  // rivets used a fixed Y=0.018 ignoring the new back-curl entirely.
  const SURFACE_BUMP = 0.006;  // 6mm head pokes above the sheet
  // Lateral edges (along the curled-up sides).
  for (const sx of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const t = -hz + (hz * 2 / 4) * (i + 0.5);
      const rivetX = sx * (hx - 0.03);
      const yAtRivet = sheetYAt(rivetX, t);
      const rivet = new THREE.Mesh(new THREE.SphereGeometry(RIVET_R, 6, 4), rivetMat);
      rivet.position.set(rivetX, yAtRivet + SURFACE_BUMP, t);
      g.add(rivet);
    }
  }
  // Front + back edge rivets — Y now follows the back-curl displacement
  // on the rear edge, stays low (deck plane) on the front edge.
  for (const sz of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const x = -hx * 0.5 + (hx * 0.5) * i;
      const z = sz * (hz - 0.04);
      const yAtRivet = sheetYAt(x, z);
      const rivet = new THREE.Mesh(new THREE.SphereGeometry(RIVET_R, 6, 4), rivetMat);
      rivet.position.set(x, yAtRivet + SURFACE_BUMP, z);
      g.add(rivet);
    }
  }

  // ACA — Welded handle yoke. Simple bent-pipe handle: 2 vertical posts
  // welded to the FRONT edge of the sheet (local -Z), joined by a
  // horizontal cross-bar (the rope tie point). Metal not wood now.
  const yokeBase = new THREE.Group();
  // Yoke sits on the deck plane (now at group origin = terrain level).
  yokeBase.position.set(0, 0, -(hz - 0.05));
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

  // KinematicPositionBased body — driven entirely by setNextKinematicTranslation
  // + setNextKinematicRotation each frame from updateSleds.
  //
  // ACC playtest follow-up — body now ROTATES to match terrain slope
  // (Option B). Pre-fix the body was axis-aligned (rotations locked)
  // with only the visual mesh tilting via group.quaternion. That created
  // a critical bug on slopes: the body's flat top face sat at terrain Y
  // at the SLED'S CENTER, but the uphill corner of the sled's XZ
  // footprint had terrain HIGHER than that flat top face. The player
  // walking onto the sled actually landed on the uphill terrain poking
  // up through the sled's footprint — they were never physically on
  // the sled even though they appeared to be, so the sled "slid out
  // from under" them as it moved.
  //
  // Now: body rotation slerps to (terrain-tilt × yaw) each frame. The
  // body's bottom face conforms to the terrain plane, so the top face
  // is uniformly 2*hy above terrain across the entire footprint —
  // player standing anywhere on the deck IS standing on the deck, no
  // terrain interference.
  //
  // Other notes:
  //  - Items on the now-tilted deck stay put via high friction (0.85);
  //    atan(0.85)=40° static threshold beats any slope a sled would
  //    actually traverse.
  //  - Player KCC walks the tilted deck as a regular slope (max climb
  //    angle 50°); deck tilt is well under that.
  //  - Kinematic body type means dynamic items can't push it; no body
  //    linvel accumulation; no linearDamping/angularDamping/translation
  //    or rotation locks needed.
  const hx = Tuning.SLED_HALF_EXTENTS_X;
  const hy = Tuning.SLED_HALF_EXTENTS_Y;
  const hz = Tuning.SLED_HALF_EXTENTS_Z;
  const bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased()
    .setTranslation(pos.x, pos.y + hy + Tuning.SLED_GROUND_CLEARANCE, pos.z);
  const body = ctx.physics.world.createRigidBody(bodyDesc);
  const colDesc = RAPIER.ColliderDesc.cuboid(hx, hy, hz)
    .setDensity(Tuning.SLED_DENSITY)
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

  // ACC playtest — back-wall lip. Vertical thin box just inside the
  // rear edge of the top deck. Items sliding rearward (due to inertia
  // when sled is towed forward) bump into this and stay on the deck.
  // ACC playtest follow-up — SENSOR mode. Previously a solid collider,
  // which the player capsule landed on when jumping onto the sled (the
  // capsule perched on the 12cm-thick lip instead of landing flat on
  // the top deck). The lip-perch caused the player to wobble off the
  // narrow surface as the sled moved underneath, defeating the moving-
  // platform-ride mechanism. Sensor mode keeps the collider for any
  // future item-overlap detection (currently unused — items are
  // promoted to kinematic-rider on settle via the relSpeed check in
  // updateSledRiders, which doesn't need the back wall to be solid)
  // but removes the physical block. Items still stay on the deck via:
  //   (1) high top-deck friction (0.85),
  //   (2) the curled rim visual + collider on the sides,
  //   (3) kinematic-rider promotion once they settle.
  // Body-local placement (unchanged):
  //   X half-width: matches top deck (full deck width)
  //   Y: sits on TOP of the top deck (local Y = top-deck-top + wallHy)
  //   Z: at the back edge (positive-Z end), inset by the wall's own
  //      half-thickness so the wall's INSIDE face aligns with the
  //      top-deck back edge.
  const wallHy = Tuning.SLED_BACK_WALL_HALF_HEIGHT;
  const wallHz = Tuning.SLED_BACK_WALL_HALF_THICKNESS;
  const topDeckTopLocalY = hy + topHy * 2 + 0.001;
  const backWallDesc = RAPIER.ColliderDesc.cuboid(topHx, wallHy, wallHz)
    .setTranslation(0, topDeckTopLocalY + wallHy, topHz - wallHz)
    .setFriction(Tuning.SLED_TOP_DECK_FRICTION)
    .setDensity(0)
    .setSensor(true);
  ctx.physics.world.createCollider(backWallDesc, body);

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
    yaw: rotationY,            // ACC playtest — managed scalar, lerped toward anchor
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
  // ACC playtest — sled.yaw is the source of truth (group quat is composed)
  const locker = spawnLockerAt(ctx, sledWorldPos, sled.yaw, []);
  // Re-parent locker mesh from scene → sled.group. THREE preserves
  // world transforms by default during .add(), but we want LOCAL pos
  // = (0, deckHeight, 0) so the locker rides on top of the sled. So
  // we set local pos AFTER parenting.
  ctx.three.scene.remove(locker.mesh);
  sled.group.add(locker.mesh);
  // ACC playtest — locker sits on the deck plane (now at group origin).
  locker.mesh.position.set(0, 0, 0);
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

/** Sled's local-forward direction (local -Z, where the yoke is) in
 *  world XZ. With unlocked physics rotations (ACC playtest), we read
 *  the body's full 3D quaternion + project onto XZ.
 *  yokeBase at z = -hz, so the FRONT is local -Z. */
const _sledFwdTmp = new THREE.Vector3();
const _sledFwdLocal = new THREE.Vector3(0, 0, -1);
// ACC playtest — module-scope temps for the visual tilt computation
// (re-used each frame across sleds; avoid per-frame allocation).
const _sledWorldUp = new THREE.Vector3(0, 1, 0);
const _sledYawQuat = new THREE.Quaternion();
const _sledTiltQuat = new THREE.Quaternion();
const _sledTargetQuat = new THREE.Quaternion();
// ACC playtest follow-up (Option B) — scratch buffers for body-tilt math.
const _sledCurQuat = new THREE.Quaternion();
const _sledLocalDown = new THREE.Vector3();
function sledForwardFromQuat(quat: THREE.Quaternion): { x: number; z: number } {
  _sledFwdTmp.copy(_sledFwdLocal).applyQuaternion(quat);
  _sledFwdTmp.y = 0;
  const len = _sledFwdTmp.length();
  if (len < 1e-4) return { x: 0, z: -1 };
  return { x: _sledFwdTmp.x / len, z: _sledFwdTmp.z / len };
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
export function updateSleds(ctx: GameContext, dt: number): void {
  for (const sled of ctx.sleds.list) {
    // Body is KinematicPositionBased — no sleep/wakeUp semantics, no
    // physics integration of XZ from forces. Position is driven entirely
    // by setNextKinematicTranslation each frame from the slope-slide +
    // rope-snap logic below.
    let tr = sled.body.translation();
    // Capture pre-frame XZ for the moving-platform-ride delta written
    // at the end of the iteration. sled.pos held the last frame's final
    // XZ; the delta is consumed by updatePlayer on the FOLLOWING frame
    // to carry a player standing on the deck.
    const prevPosX = sled.pos.x;
    const prevPosY = sled.pos.y;
    const prevPosZ = sled.pos.z;
    const hy = Tuning.SLED_HALF_EXTENTS_Y;

    // ACC playtest follow-up — slope-slide via MANAGED SCALAR velocity
    // + direct setTranslation, bypassing Rapier's velocity integrator.
    //
    // Why bypass physics? The previous setLinvel-based slope-slide was
    // visibly inert: each frame we added `slideAccel * dt` to body.linvel,
    // but the contact solver between sled.collider (friction 0.6) and
    // the heightfield zeroed the tangential velocity each physics step.
    // Static friction angle = atan(0.6) ≈ 31°, swallowing every dune
    // slope. Even Mt-Everest-tier dunes barely cross that threshold;
    // sled never moved on its own.
    //
    // The body remains DYNAMIC (so KCC item-contact + rope-snap path
    // still work), but XZ motion now comes from `_slideVx/_slideVz`
    // managed scalars driven directly each frame. Damping is folded
    // into the scalar via Math.exp(-damp*dt) so flat-ground decay is
    // unchanged. setTranslation overwrites the integrator's position;
    // it preserves linvel but linvel no longer represents motion since
    // we drive XZ directly. Rope-snap setTranslation (line ~921)
    // composes with this — both writers in the same frame is fine.
    const sledNormal = ctx.terrain.normalAt(tr.x, tr.z);
    const slopeHorizMag = Math.hypot(sledNormal.x, sledNormal.z);
    const onSlope = slopeHorizMag > Tuning.SLED_SLOPE_SLIDE_THRESHOLD;

    let svx = sled._slideVx ?? 0;
    let svz = sled._slideVz ?? 0;
    if (onSlope) {
      // DOWNHILL SIGN FIX (retained). terrain.normalAt computes normal
      // via `(hL - hR, 2e, hD - hU).normalize()` (see terrain.ts). For
      // terrain rising toward +X (hR > hL), normal.x = hL - hR < 0 —
      // i.e. normal.xz points DOWNHILL directly (steepest descent).
      const downhillX = sledNormal.x / slopeHorizMag;
      const downhillZ = sledNormal.z / slopeHorizMag;
      const slideAccel = 9.81 * slopeHorizMag * Tuning.SLED_SLOPE_SLIDE_GAIN;
      svx += downhillX * slideAccel * dt;
      svz += downhillZ * slideAccel * dt;
    }
    // ACC playtest follow-up — Coulomb-style ground friction (independent
    // of speed). Opposes motion at a fixed deceleration; clamped via
    // `min(speed, frictionDeltaV)` so friction can stop the sled but
    // never reverse it. With gravity slope component above:
    //   sled is on slight slope (sin(θ) × GAIN < KINETIC_FRICTION):
    //     gravity adds less per frame than friction removes
    //     → stationary sled stays put, moving sled decelerates to stop.
    //   sled is on steep slope (sin(θ) × GAIN > KINETIC_FRICTION):
    //     gravity exceeds friction → sled accelerates toward terminal v.
    //   sled transitions steep → flat (leveling out at bottom of dune):
    //     slope component → 0, friction continues → sled coasts then stops.
    // This is the curve the player wants: slight slopes hold the sled,
    // steep slopes accelerate it, leveling out brakes it.
    {
      const speed = Math.hypot(svx, svz);
      if (speed > 1e-4) {
        const frictionDecel = 9.81 * Tuning.SLED_KINETIC_FRICTION;
        const frictionDeltaV = Math.min(speed, frictionDecel * dt);
        svx -= (svx / speed) * frictionDeltaV;
        svz -= (svz / speed) * frictionDeltaV;
      }
    }
    // Exponential damping toward zero (light air-resistance / sand-drag
    // on top of the Coulomb friction). Keeps terminal velocity finite at
    // steep slopes; Coulomb friction does the bulk of the deceleration
    // work on slight slopes + flat ground.
    const _slideDamp = Math.exp(-Tuning.SLED_LINEAR_DAMP * dt);
    svx *= _slideDamp;
    svz *= _slideDamp;
    sled._slideVx = svx;
    sled._slideVz = svz;

    // Apply XZ translation from slide velocity. Y is sampled at the
    // NEW XZ position so the sled hugs terrain even when sliding.
    // Single setNextKinematicTranslation per frame; Rapier uses
    // (next - current) / dt as the implicit velocity for friction with
    // dynamic items on the deck (so they get dragged along).
    const newX = tr.x + svx * dt;
    const newZ = tr.z + svz * dt;
    const groundY = ctx.terrain.heightAt(newX, newZ);
    const targetBodyY = groundY + hy + Tuning.SLED_GROUND_CLEARANCE;
    sled.body.setNextKinematicTranslation({ x: newX, y: targetBodyY, z: newZ });
    // Keep `tr` reflecting the target position for downstream code that
    // reads it (rope-snap, group sync, etc.) — the physics step won't
    // commit it until the next tick, but our logic treats it as truth.
    tr = { x: newX, y: targetBodyY, z: newZ } as ReturnType<typeof sled.body.translation>;

    // ACC playtest follow-up (Option B) — drive BODY rotation to match
    // terrain slope, not just the visual. Compute target quat from
    // terrain normal at sled position × yaw scalar; slerp the body's
    // current rotation toward target; commit via
    // setNextKinematicRotation. The body collider now tilts with the
    // terrain, so its top face is uniformly above all terrain in the
    // footprint — player standing on the deck IS on the deck (no more
    // uphill terrain poking through). Visual mirrors body rotation
    // exactly (group.quaternion = body.rotation()), no separate slerp.
    _sledYawQuat.setFromAxisAngle(_sledWorldUp, sled.yaw);
    const normal = ctx.terrain.normalAt(tr.x, tr.z);
    _sledTiltQuat.setFromUnitVectors(_sledWorldUp, normal);
    _sledTargetQuat.multiplyQuaternions(_sledTiltQuat, _sledYawQuat);
    // Read current body rotation, slerp toward target, commit.
    const curRot = sled.body.rotation();
    _sledCurQuat.set(curRot.x, curRot.y, curRot.z, curRot.w);
    _sledCurQuat.slerp(_sledTargetQuat, Tuning.SLED_VISUAL_TILT_LERP);
    sled.body.setNextKinematicRotation({
      x: _sledCurQuat.x, y: _sledCurQuat.y, z: _sledCurQuat.z, w: _sledCurQuat.w,
    });

    // Visual group: position at body.tr offset DOWN by hy in BODY-LOCAL
    // frame (so the visual deck mesh's y=0 plane sits at the body's
    // bottom face, same convention as pre-Option-B). Rotation mirrors
    // body. With body now tilted to terrain, the visual also tilts —
    // and the body+visual stay in lockstep, no slerp lag.
    _sledLocalDown.set(0, -hy, 0).applyQuaternion(_sledCurQuat);
    sled.group.position.set(tr.x + _sledLocalDown.x, tr.y + _sledLocalDown.y, tr.z + _sledLocalDown.z);
    sled.group.quaternion.copy(_sledCurQuat);
    sled.pos.set(tr.x, sled.group.position.y, tr.z);
    sled._frameDeltaX = sled.pos.x - prevPosX;
    sled._frameDeltaY = sled.pos.y - prevPosY;
    sled._frameDeltaZ = sled.pos.z - prevPosZ;

    // ACC playtest — sand kick-up dust + drag track decals. Use actual
    // POSITION DELTA per frame (sled moves via setTranslation teleports
    // for the rope constraint, so body.linvel() can stay near zero even
    // when the sled is visibly moving). Tracks spawn regardless of
    // cargo contents (was implicitly gated on velocity which only
    // appeared with heavy items applying drag).
    if (sled.tether.kind !== 'none') {
      const lastX = sled._lastTrackX;
      const lastZ = sled._lastTrackZ;
      let frameMoveDist = 0;
      let frameDx = 0;
      let frameDz = 0;
      if (lastX !== undefined && lastZ !== undefined) {
        frameDx = tr.x - lastX;
        frameDz = tr.z - lastZ;
        frameMoveDist = Math.hypot(frameDx, frameDz);
      }
      if (frameMoveDist > 0.001) {
        // Dust puff cadence
        sled._sandPuffAccum = (sled._sandPuffAccum ?? 0) + frameMoveDist;
        const PUFF_INTERVAL_M = 0.45;
        if (sled._sandPuffAccum >= PUFF_INTERVAL_M) {
          sled._sandPuffAccum = 0;
          // Back direction = opposite of segment motion direction.
          const segLen = Math.hypot(frameDx, frameDz);
          const backDirX = -frameDx / segLen;
          const backDirZ = -frameDz / segLen;
          const backX = tr.x + backDirX * Tuning.SLED_HALF_EXTENTS_Z;
          const backZ = tr.z + backDirZ * Tuning.SLED_HALF_EXTENTS_Z;
          spawnFootprintPuff(backX, ctx.terrain.heightAt(backX, backZ), backZ);
        }

        // Track decal cadence
        sled._trackAccum = (sled._trackAccum ?? 0) + frameMoveDist;
        if (sled._trackAccum >= Tuning.FOOTPRINT_SLED_CADENCE_M) {
          sled._trackAccum = 0;
          // Decal yaw = segment direction (stable along the actual
          // trail path; doesn't lerp like sled.yaw does).
          const decalYaw = Math.atan2(frameDx, frameDz);
          // Small lateral jitter perpendicular to motion for organic
          // variation — real drag marks don't trace a perfect line.
          const perpX = Math.cos(decalYaw);
          const perpZ = -Math.sin(decalYaw);
          const jitter = (Math.random() - 0.5) * 0.05;
          const spawnX = tr.x + perpX * jitter;
          const spawnZ = tr.z + perpZ * jitter;
          ctx.footprints.spawn('sled', spawnX, spawnZ, decalYaw, ctx.time.elapsed);
        }
      }
      // Always update last-pos tracker so segments are accurate even
      // when sub-threshold movements accumulate across multiple frames.
      sled._lastTrackX = tr.x;
      sled._lastTrackZ = tr.z;
    } else {
      // Reset tracker when untethered so detach + re-attach starts a
      // fresh segment.
      sled._lastTrackX = undefined;
      sled._lastTrackZ = undefined;
    }

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

    // Sled attach point in world space — front of the sled.
    // ACC playtest — derive forward from the body's YAW quat (physics
    // truth), NOT sled.group.quaternion (which is the smoothed
    // visual-tilt-composed quat). Constraint math should respond to
    // actual sled orientation, not the lagging visual.
    const fwd = sledForwardFromQuat(_sledYawQuat);
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

    // ACC playtest follow-up — slack-decay now operates on the managed
    // slide-velocity scalars (not body.linvel — body.linvel is no longer
    // the source of XZ motion; see the managed-scalar block above).
    // On slack rope + flat ground, snap the slide velocity to zero so a
    // stationary sled stops quickly. On a slope, the SLED_LINEAR_DAMP
    // exponential decay (folded into the scalar each frame) handles
    // terminal velocity — overriding it here would fight gravity.
    if (dist <= Tuning.SLED_TOW_DISTANCE && !onSlope) {
      sled._slideVx = (sled._slideVx ?? 0) * Tuning.SLED_SLACK_DECAY_PER_FRAME;
      sled._slideVz = (sled._slideVz ?? 0) * Tuning.SLED_SLACK_DECAY_PER_FRAME;
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
      // ACC playtest — clamp the post-snap Y to be above terrain. Pre-
      //    fix bug: when sled was towed UPHILL, the snap preserved the
      //    pre-snap Y while moving XZ to a higher-terrain spot — sled
      //    ended up BELOW the heightfield and fell through. Sampling
      //    terrain.heightAt(newXZ) and clamping resolves it without
      //    breaking downhill behavior (gravity drops the sled).
      const newX = tr.x + ux * stretch;
      const newZ = tr.z + uz * stretch;
      const groundY = ctx.terrain.heightAt(newX, newZ);
      // Body Y target = groundY + hy + clearance (consistent with the
      // slope-slide block). Pre-fix bug: when towed uphill, the snap
      // preserved pre-snap Y while moving XZ to a higher-terrain spot —
      // sled ended up below terrain. Sampling at the destination resolves
      // it cleanly.
      const targetBodyY = groundY + hy + Tuning.SLED_GROUND_CLEARANCE;
      sled.body.setNextKinematicTranslation({ x: newX, y: targetBodyY, z: newZ });
      // Reflect the snap target onto `tr` so the yaw-track block below
      // reads the corrected position.
      tr = { x: newX, y: targetBodyY, z: newZ } as ReturnType<typeof sled.body.translation>;

      // 2) Velocity correction — operates on the managed slide-velocity
      //    scalars (body.linvel is no longer the source of XZ motion).
      //    Snap fires when the sled is past the rope's max length AND
      //    moving AWAY from the anchor.
      //    Sequence:
      //      a) Zero the radial-away component (rope is inextensible —
      //         the sled physically cannot move further away each frame,
      //         and we don't want stored "outward energy" to keep firing
      //         the snap every frame).
      //      b) Damp the perpendicular component (rope holds sled at
      //         end-of-line; perpendicular velocity from a sideways
      //         slope made the sled "fly out to the side" downhill).
      const svxNow = sled._slideVx ?? 0;
      const svzNow = sled._slideVz ?? 0;
      const vRadial = svxNow * ux + svzNow * uz;
      if (vRadial < 0) {
        const afterRadialX = svxNow - vRadial * ux;
        const afterRadialZ = svzNow - vRadial * uz;
        sled._slideVx = afterRadialX * Tuning.SLED_SNAP_PERP_DAMP;
        sled._slideVz = afterRadialZ * Tuning.SLED_SNAP_PERP_DAMP;
      }
    }

    // Direct yaw lerp toward anchor. Body rotations are locked so
    // `sled.yaw` is the truth; lerp this scalar each frame so the
    // bow tracks the rope. Stable + predictable (QQ-2 behavior).
    // ACC playtest — only lerp when the rope is TAUT (or approaching
    // taut). When slack, the sled stays facing wherever it's facing.
    // This lets the player walk around their sled freely without the
    // sled spinning to track them. It also makes orientation more
    // predictable during tow (sled tracks the puller, then locks
    // when slack).
    {
      const trAfter = sled.body.translation();
      const adx = _anchor.x - trAfter.x;
      const adz = _anchor.z - trAfter.z;
      // Track when anchor is within ~80% of tow distance to taut —
      // smooth ramp-in as rope tightens, no thrash at idle.
      const trackThreshold = Tuning.SLED_TOW_DISTANCE * 0.8;
      const adDist = Math.hypot(adx, adz);
      if (adDist > trackThreshold) {
        const targetYaw = Math.atan2(-adx, -adz);
        const err = wrapAngle(targetYaw - sled.yaw);
        sled.yaw += err * Tuning.SLED_YAW_LERP;
      }
    }

    rebuildRopeMesh(sled, _anchor);

    // Refinalize group/pos + frame delta in case the rope-snap above
    // updated `tr`. For non-tethered sleds we already finalized earlier
    // and `continue`d past this; for tethered sleds we want the visual
    // + delta to reflect the post-snap position.
    _sledLocalDown.set(0, -hy, 0).applyQuaternion(_sledCurQuat);
    sled.group.position.set(tr.x + _sledLocalDown.x, tr.y + _sledLocalDown.y, tr.z + _sledLocalDown.z);
    sled.pos.set(tr.x, sled.group.position.y, tr.z);
    sled._frameDeltaX = sled.pos.x - prevPosX;
    sled._frameDeltaY = sled.pos.y - prevPosY;
    sled._frameDeltaZ = sled.pos.z - prevPosZ;
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
  // ACC playtest — derive forward from full body quaternion (was: yaw-only).
  const fwd = sledForwardFromQuat(sled.group.quaternion);
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

/** Vertical band (relative to sled top face) within which a pickup
 *  counts as "on the sled" for PROMOTION. Tight enough that mid-arc
 *  throws don't qualify, generous enough that any normally-landed
 *  item does. */
const RIDE_ABOVE_MIN = -0.05;
const RIDE_ABOVE_MAX = 0.20;

/** Velocity relative to the sled (m/s) below which we consider a
 *  pickup "settled enough to promote". Was previously `isSleeping()`
 *  which never fires when the sled itself is moving — items on a
 *  towed sled never sleep in world space so they never promoted, so
 *  they slid off. Rel-velocity check works while sled is in motion.
 *  ACC playtest — bumped from 1.5 → 2.8 so items in their first
 *  landing-bounce get promoted, before they have a chance to push
 *  the sled around with their bounce impulses. */
const RIDE_PROMOTE_REL_SPEED = 2.8;

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
    // ACC playtest — old criterion `isSleeping()` never fires while
    // the sled is moving (items on the deck are moving in world space
    // so they never sleep), so items stayed dynamic forever and slid
    // off. New criterion: position is within the (tight) Y range above
    // the top deck AND velocity relative to the sled is low. Catches
    // items that have landed + been pulled along by friction to match
    // the sled's velocity, before they have a chance to slide off.
    const itemLv = p.body.linvel();
    for (const sled of ctx.sleds.list) {
      if (!pickupIsOnSledTop(p, sled)) continue;
      const sledLv = sled.body.linvel();
      const relVx = itemLv.x - sledLv.x;
      const relVy = itemLv.y - sledLv.y;
      const relVz = itemLv.z - sledLv.z;
      const relSpeedSq = relVx * relVx + relVy * relVy + relVz * relVz;
      const limitSq = RIDE_PROMOTE_REL_SPEED * RIDE_PROMOTE_REL_SPEED;
      if (relSpeedSq > limitSq) continue;
      promoteSledRider(p, sled);
      break;
    }
  }
}

/** Sled-local-frame range gate: pickup body translation lies within the
 *  top deck's XZ footprint AND within the vertical band above its top
 *  face. ACC playtest — uses full 3D worldToLocal so the test stays
 *  correct when the sled tilts on a slope (pitch + roll). Group origin
 *  is at the sled's BOTTOM-CENTER; top-deck top face in sled-local Y
 *  is hy + 2*topHy + ~0.008. */
const _localCheckTmp = new THREE.Vector3();
function pickupIsOnSledTop(p: Pickup, sled: Sled): boolean {
  if (!p.body) return false;
  const t = p.body.translation();
  // Pickup in sled-local coords (handles pitch/roll/yaw).
  _localCheckTmp.set(t.x, t.y, t.z);
  sled.group.updateMatrixWorld();
  sled.group.worldToLocal(_localCheckTmp);
  const limX = Tuning.SLED_HALF_EXTENTS_X * Tuning.SLED_TOP_DECK_INSET_X_FRAC + 0.05;
  const limZ = Tuning.SLED_HALF_EXTENTS_Z * Tuning.SLED_TOP_DECK_INSET_Z_FRAC + 0.05;
  if (Math.abs(_localCheckTmp.x) > limX) return false;
  if (Math.abs(_localCheckTmp.z) > limZ) return false;
  // Y band: top deck top face is at sled-local Y =
  // hy (body center, no ground clearance) + hy (top of body)
  //   + topHy*2 (thickness) + tiny eps. Total ≈ 2*hy + 2*topHy + eps.
  // Pickup must be within RIDE_ABOVE_MIN..RIDE_ABOVE_MAX of that.
  const topYLocal =
    Tuning.SLED_HALF_EXTENTS_Y * 2 +
    Tuning.SLED_TOP_DECK_HALF_THICKNESS * 2 +
    0.001;
  const yDelta = _localCheckTmp.y - topYLocal;
  return yDelta >= RIDE_ABOVE_MIN && yDelta <= RIDE_ABOVE_MAX;
}

function promoteSledRider(p: Pickup, sled: Sled): void {
  if (!p.body) return;
  // Capture current world pose; map into sled-local space.
  sled.group.updateMatrixWorld();
  _riderSledInvMat.copy(sled.group.matrixWorld).invert();
  const localPos = new THREE.Vector3(p.pos.x, p.pos.y, p.pos.z)
    .applyMatrix4(_riderSledInvMat);
  // ACC playtest — CLAMP localPos.y so the rider's body sits ABOVE the
  // top deck collider with a small clearance. Without this clamp, a
  // pickup settling slightly INSIDE the top deck (Rapier contact
  // tolerance) gets promoted with persistent overlap; the kinematic
  // rider drives the body to that overlapping position every frame,
  // and the dynamic sled gets a perpetual push from the contact
  // resolver → sled drifts away on its own + bobs against terrain.
  const topYLocal =
    Tuning.SLED_HALF_EXTENTS_Y * 2 +
    Tuning.SLED_TOP_DECK_HALF_THICKNESS * 2 +
    0.001;
  // Fixed 5cm clearance above the deck face — items "float" 5cm above
  // the deck plane, which reads as a small natural gap rather than a
  // bug. Critical for avoiding kinematic-vs-dynamic contact pushing.
  const RIDER_CLEARANCE = 0.05;
  if (localPos.y < topYLocal + RIDER_CLEARANCE) {
    localPos.y = topYLocal + RIDER_CLEARANCE;
  }
  _riderSledInvQuat.copy(sled.group.quaternion).invert();
  const localQuat = _riderSledInvQuat.clone().multiply(p.mesh.quaternion);
  // Switch body type to kinematic. From now on, position is driven by
  // setNextKinematicTranslation each frame; gravity + collisions no
  // longer move the body.
  p.body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true);
  // ACC playtest — also switch the collider to SENSOR mode. Sensors
  // detect overlap but don't push other bodies. Without this, the
  // rider's collider (driven each frame to a position above the sled
  // top deck) generates contact pairs with the sled collider; the
  // solver applies tiny separation impulses to the dynamic sled →
  // sled bobs + drifts on its own. Sensor mode kills the impulses
  // entirely. Trade-off: new items dropped onto an existing rider
  // pass through the rider's collider (they bounce off the sled top
  // deck below, settling at the same Y as the rider — visually they
  // stack at the same level, acceptable for the scrap-sled aesthetic.
  const riderCol = p.body.collider(0);
  if (riderCol) riderCol.setSensor(true);
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
  // ACC playtest — clear sensor mode so the freed pickup collides
  // normally with terrain + items + sleds (it'll likely fall + settle).
  const riderCol = p.body.collider(0);
  if (riderCol) riderCol.setSensor(false);
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
