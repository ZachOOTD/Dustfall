// World-spawned pickups. Generic over item type — canteens are just one
// kind. Each pickup links a mesh in the scene to an itemId; the player's
// interaction module raycasts against this list to figure out what's hovered.

import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { Rng } from '../core/rng.ts';
import type { Terrain } from '../world/terrain.ts';
import type { AssetRegistry } from '../assets/loader.ts';
import { cloneAsset } from '../assets/loader.ts';
import { Tuning } from '../config/tuning.ts';
import type { ItemId, ItemMeta } from '../inventory/types.ts';
import { getItemDef } from '../inventory/items.ts';

export interface Pickup {
  id: number;                 // unique handle for hover/take
  itemId: ItemId;
  /** Optional meta attached on world-spawn (e.g. canteen fillLevel). Passes
   *  through to addItem on take. */
  meta?: ItemMeta;
  mesh: THREE.Object3D;
  pos: THREE.Vector3;         // resting position; bob is added each frame
  bobPhase: number;
  hovered: boolean;           // updated by player/interaction each frame
  /** ABM (B7) — optional Rapier dynamic body for dropped items that roll/
   *  fall/settle. Null for seed-spawned pickups (branches, scavenger-camp
   *  bandage) which sit statically at deterministic positions. When non-
   *  null, the per-frame `updatePickups` tick syncs mesh.position +
   *  quaternion from the body. The body uses a cuboid collider sized to
   *  the item's bounding box, and starts awake to settle into rest;
   *  Rapier auto-sleeps it once stopped. */
  body: RAPIER.RigidBody | null;
}

let _nextId = 1;

/** Recursively tag every Mesh under `root` with userData.pickupId so the
 *  raycast can map a hit back to its Pickup record. */
function tagPickupMeshes(root: THREE.Object3D, pickupId: number): void {
  root.traverse((o) => {
    o.userData.pickupId = pickupId;
  });
}

const _UP = new THREE.Vector3(0, 1, 0);
const _alignQuat = new THREE.Quaternion();
const _alignAxis = new THREE.Vector3();

/** Tilt `mesh` so its local +Y points along the terrain normal at (x, z).
 *  Preserves any existing rotation by composing the alignment quaternion
 *  with whatever was already on the mesh. */
function alignToTerrainNormal(mesh: THREE.Object3D, terrain: Terrain, x: number, z: number): void {
  _alignAxis.copy(terrain.normalAt(x, z));
  // Skip a no-op rotation when ground is flat (normal === +Y).
  if (Math.abs(_alignAxis.y - 1) < 1e-4) return;
  _alignQuat.setFromUnitVectors(_UP, _alignAxis);
  mesh.quaternion.premultiply(_alignQuat);
}

// ────────────────────────────────────────────────────────────────
// Canteen visual (improved primitive)
// ────────────────────────────────────────────────────────────────
function makePrimitiveCanteen(): THREE.Group {
  const g = new THREE.Group();
  // ABL — perf: downgraded from MeshStandardMaterial (PBR) to
  // MeshLambertMaterial. Visual diff is negligible for matte-canvas
  // canteens at world scale; Lambert is significantly cheaper in the
  // fragment shader (no metallic/roughness sampling). Emissive
  // preserved via .emissive + .emissiveIntensity (Lambert supports
  // both). flatShading equivalent.
  const bodyMat = new THREE.MeshLambertMaterial({
    color: 0x6f3622,
    emissive: 0x281106,
    emissiveIntensity: 0.55,
    flatShading: true,
  });
  const trimMat = new THREE.MeshLambertMaterial({
    color: 0x1a1208,
    flatShading: true,
  });
  const strapMat = new THREE.MeshLambertMaterial({
    color: 0x2e1a0e,
    flatShading: true,
  });

  const body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 1), bodyMat);
  body.scale.set(1.0, 1.05, 0.55);
  g.add(body);

  const neck = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.08, 0.12, 8),
    trimMat,
  );
  neck.position.y = 0.22;
  g.add(neck);

  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.075, 0.075, 0.06, 8),
    trimMat,
  );
  cap.position.y = 0.31;
  g.add(cap);

  const strap = new THREE.Mesh(
    new THREE.TorusGeometry(0.085, 0.012, 4, 12),
    strapMat,
  );
  strap.position.y = 0.18;
  strap.rotation.x = Math.PI / 2;
  g.add(strap);

  return g;
}

export function spawnCanteens(
  scene: THREE.Scene,
  terrain: Terrain,
  assets: AssetRegistry,
  rand: Rng,
): Pickup[] {
  const canteenPool = assets.pool('pickup_canteen');
  const list: Pickup[] = [];
  for (let i = 0; i < Tuning.CANTEEN_COUNT; i++) {
    const radius = 8 + rand() * (Tuning.WORLD_RADIUS - 30);
    const angle = rand() * Math.PI * 2;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const groundY = terrain.heightAt(x, z);

    let mesh: THREE.Object3D | null = null;
    if (canteenPool.length > 0) {
      const variant = canteenPool[Math.floor(rand() * canteenPool.length)];
      mesh = cloneAsset(variant);
    }
    if (!mesh) mesh = makePrimitiveCanteen();

    const restY = groundY + 0.32;
    mesh.position.set(x, restY, z);
    mesh.rotation.y = rand() * Math.PI * 2;

    // Pickups are small (~10cm) — their shadows are invisible against the
    // dune and add to the shadow caster count for no visual gain.
    mesh.userData.noShadow = true;
    mesh.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = false;
        m.receiveShadow = true;
      }
    });

    const pickupId = _nextId++;
    tagPickupMeshes(mesh, pickupId);
    scene.add(mesh);

    list.push({
      id: pickupId,
      itemId: 'canteen',
      meta: { fillLevel: 1 },  // fresh canteens start full
      mesh,
      pos: new THREE.Vector3(x, restY, z),
      bobPhase: rand() * Math.PI * 2,
      hovered: false,
      body: null,  // ABM (B7) — seed-spawned canteens stay static
    });
  }
  return list;
}

// ────────────────────────────────────────────────────────────────
// Branch pickup — small brown stick scattered across the world.
// Used as fire fuel (aim at fire + E with branch selected adds 30s).
// ────────────────────────────────────────────────────────────────
function makePrimitiveBranch(rand: Rng): THREE.Group {
  const g = new THREE.Group();
  // II — grey to match the dead trees branches actually come from
  // (deadTree.ts _branchMat = 0x6e685f). Reads as "this branch fell off
  // that tree" instead of "random brown stick."
  // ABL — perf: PBR Standard → Lambert. Matte grey branches look
  // identical; ~200 in-world instances drove a measurable fragment cost.
  const mat = new THREE.MeshLambertMaterial({
    color: 0x6e685f, flatShading: true,
  });
  // II — longer sticks so branches read as real fuel + craftable material
  // rather than tiny twigs.
  const len = 0.40 + rand() * 0.15;
  const stick = new THREE.Mesh(
    new THREE.CylinderGeometry(0.018, 0.022, len, 6),
    mat,
  );
  stick.rotation.z = Math.PI / 2;
  g.add(stick);
  // Small offshoot twig
  if (rand() < 0.6) {
    const twig = new THREE.Mesh(
      new THREE.CylinderGeometry(0.008, 0.012, 0.08, 4),
      mat,
    );
    twig.position.set((rand() - 0.5) * len * 0.6, 0, 0);
    twig.rotation.z = Math.PI / 2 + (rand() - 0.5) * 0.7;
    g.add(twig);
  }
  return g;
}

/** Spawn a single branch pickup at a specific (x, z) world position.
 *  Aligns to terrain normal, applies the same no-shadow + pickup tagging.
 *  Appends to `list` and returns the new Pickup. Used by dead-tree clusters
 *  (Session W) and the legacy random scatter. */
export function spawnBranchAt(
  scene: THREE.Scene,
  terrain: Terrain,
  x: number,
  z: number,
  rand: Rng,
  list: Pickup[],
): Pickup {
  const groundY = terrain.heightAt(x, z);
  const mesh = makePrimitiveBranch(rand);
  const restY = groundY + 0.012;
  mesh.position.set(x, restY, z);
  mesh.rotation.y = rand() * Math.PI * 2;
  alignToTerrainNormal(mesh, terrain, x, z);

  mesh.userData.noShadow = true;
  mesh.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = false;
      m.receiveShadow = true;
    }
  });

  const pickupId = _nextId++;
  tagPickupMeshes(mesh, pickupId);
  scene.add(mesh);

  const pickup: Pickup = {
    id: pickupId,
    itemId: 'branch',
    mesh,
    pos: new THREE.Vector3(x, restY, z),
    bobPhase: rand() * Math.PI * 2,
    hovered: false,
    body: null,  // ABM (B7) — seed-spawned branches stay static
  };
  list.push(pickup);
  return pickup;
}

export function spawnBranches(
  scene: THREE.Scene,
  terrain: Terrain,
  rand: Rng,
  count: number = 30,
): Pickup[] {
  const list: Pickup[] = [];
  for (let i = 0; i < count; i++) {
    const radius = 6 + rand() * 200;
    const angle = rand() * Math.PI * 2;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    spawnBranchAt(scene, terrain, x, z, rand, list);
  }
  return list;
}

/** Retained for source compatibility — pickups no longer bob or spin.
 *  Removed from the per-frame tick; callers may still reference the symbol. */
export function bobPickups(
  _ctx: import('../GameContext.ts').GameContext,
  _dt: number,
): void {
  /* intentionally empty */
}

/** Spawn a Pickup at a given world position from any ItemId — used for
 *  player drops, crafting drops, and inventory-full pickup swaps. Reuses
 *  the item's viewmodel mesh (scaled up) as the world visual; falls back
 *  to a primitive cube if no makeViewModel is defined.
 *
 *  ABM (B7) — when `opts.world` is provided, a Rapier DYNAMIC body is
 *  attached so the item rolls/falls/settles naturally (e.g., dropped on
 *  a slope rolls downhill). When omitted, original behavior preserved
 *  (static mesh at the snapped-to-terrain position). Most player-facing
 *  drops should pass opts.world; deterministic seed-spawn callers (poi.ts
 *  scavenger camp) can leave it null for the static placement. */
export function spawnDroppedPickup(
  scene: THREE.Scene,
  terrain: Terrain,
  pos: { x: number; z: number },
  itemId: ItemId,
  meta?: ItemMeta,
  opts?: {
    world?: RAPIER.World;
    /** Optional initial linear velocity for the dynamic body (player
     *  drops use a small forward + up impulse for "tossed" feel). */
    initialVel?: { x: number; y: number; z: number };
    /** Override the spawn Y (default: terrain height + 0.04 for static,
     *  terrain + 0.6 for physics so items fall a bit). */
    yOverride?: number;
  },
): Pickup {
  const def = getItemDef(itemId);
  let mesh: THREE.Object3D;
  if (def.makeViewModel) {
    mesh = def.makeViewModel();
    mesh.scale.set(1.5, 1.5, 1.5);
  } else {
    // ABL — perf: PBR Standard → Lambert for the no-viewmodel fallback
    // pickup. Matte tan box; identical visually.
    const fallback = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.08, 0.10),
      new THREE.MeshLambertMaterial({ color: 0x8a7a5e }),
    );
    mesh = fallback;
  }
  const groundY = terrain.heightAt(pos.x, pos.z);
  // For physics-attached pickups, spawn slightly higher so they fall +
  // settle — gives the "tossed onto the ground" reading. Static pickups
  // sit flush at +4cm (original behavior).
  const defaultY = opts?.world ? groundY + 0.6 : groundY + 0.04;
  const restY = opts?.yOverride ?? defaultY;
  mesh.position.set(pos.x, restY, pos.z);
  mesh.rotation.y = Math.random() * Math.PI * 2;
  // Terrain-normal align only for static pickups; physics bodies derive
  // rotation from the body each frame so an initial mesh rotation gets
  // immediately overwritten.
  if (!opts?.world) {
    alignToTerrainNormal(mesh, terrain, pos.x, pos.z);
  }
  // Dropped items inherit the pickup no-shadow rule.
  mesh.userData.noShadow = true;
  mesh.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = false;
      m.receiveShadow = true;
    }
  });

  const pickupId = _nextId++;
  tagPickupMeshes(mesh, pickupId);
  scene.add(mesh);

  // ABM (B7) — attach a Rapier dynamic body when world is provided.
  // Cuboid collider sized to the mesh's bounding box (snug; pickups are
  // small so the AABB approximation reads fine). Damping prevents
  // jittery rolling on dunes; friction high so they grip slopes after
  // settling rather than slowly creeping forever.
  let body: RAPIER.RigidBody | null = null;
  if (opts?.world) {
    mesh.updateMatrixWorld(true);
    const bbox = new THREE.Box3().setFromObject(mesh);
    const size = new THREE.Vector3();
    bbox.getSize(size);
    const hx = Math.max(0.04, size.x * 0.5);
    const hy = Math.max(0.04, size.y * 0.5);
    const hz = Math.max(0.04, size.z * 0.5);
    const bd = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(pos.x, restY, pos.z)
      .setLinearDamping(0.6)
      .setAngularDamping(0.8);
    if (opts.initialVel) {
      bd.setLinvel(opts.initialVel.x, opts.initialVel.y, opts.initialVel.z);
    }
    body = opts.world.createRigidBody(bd);
    opts.world.createCollider(
      RAPIER.ColliderDesc.cuboid(hx, hy, hz)
        .setFriction(0.85)
        .setRestitution(0.15)
        .setDensity(0.6),
      body,
    );
  }

  return {
    id: pickupId,
    itemId,
    meta: meta ? { ...meta } : undefined,
    mesh,
    pos: new THREE.Vector3(pos.x, restY, pos.z),
    bobPhase: Math.random() * Math.PI * 2,
    hovered: false,
    body,
  };
}

/** ABM (B7) — per-frame sync: copy each physics-bodied pickup's body
 *  transform onto its mesh. Cheap walk; skips pickups without a body.
 *  Also updates the persisted `pos` field so other systems (raycast
 *  pickup detection, save serialization) read the live position. */
const _pickupSyncPos = new THREE.Vector3();
const _pickupSyncQuat = new THREE.Quaternion();
export function updatePickups(ctx: import('../GameContext.ts').GameContext): void {
  for (const p of ctx.pickups.list) {
    if (!p.body) continue;
    const t = p.body.translation();
    const r = p.body.rotation();
    _pickupSyncPos.set(t.x, t.y, t.z);
    _pickupSyncQuat.set(r.x, r.y, r.z, r.w);
    p.mesh.position.copy(_pickupSyncPos);
    p.mesh.quaternion.copy(_pickupSyncQuat);
    p.pos.copy(_pickupSyncPos);
  }
}

/** Bump the module-level id counter past `n` so future spawns don't collide
 *  with restored ids. Used by save/load. */
export function setNextPickupId(n: number): void {
  if (n > _nextId) _nextId = n;
}

/** Find a pickup by its userData.pickupId. */
export function findPickupById(
  list: Pickup[],
  id: number | undefined,
): Pickup | null {
  if (id === undefined) return null;
  for (const p of list) if (p.id === id) return p;
  return null;
}

/** Remove a pickup from the world + the list. Used when E-take fires.
 *  ABM (B7) — also removes the Rapier body when present so dropped-item
 *  bodies don't leak (Rapier doesn't GC removed scene objects). */
export function despawnPickup(
  ctx: import('../GameContext.ts').GameContext,
  pickup: Pickup,
): void {
  ctx.three.scene.remove(pickup.mesh);
  if (pickup.body) {
    ctx.physics.world.removeRigidBody(pickup.body);
    pickup.body = null;
  }
  const idx = ctx.pickups.list.indexOf(pickup);
  if (idx >= 0) ctx.pickups.list.splice(idx, 1);
}
