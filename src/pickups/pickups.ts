// World-spawned pickups. Generic over item type — canteens are just one
// kind. Each pickup links a mesh in the scene to an itemId; the player's
// interaction module raycasts against this list to figure out what's hovered.

import * as THREE from 'three';
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
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x6f3622,
    emissive: 0x281106,
    emissiveIntensity: 0.55,
    roughness: 0.85,
    metalness: 0.15,
    flatShading: true,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0x1a1208,
    roughness: 0.95,
    flatShading: true,
  });
  const strapMat = new THREE.MeshStandardMaterial({
    color: 0x2e1a0e,
    roughness: 1,
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
  const mat = new THREE.MeshStandardMaterial({
    color: 0x6e685f, roughness: 0.95, flatShading: true,
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
 *  player drops. Reuses the item's viewmodel mesh (scaled up) as the world
 *  visual; falls back to a primitive cube if no makeViewModel is defined. */
export function spawnDroppedPickup(
  scene: THREE.Scene,
  terrain: Terrain,
  pos: { x: number; z: number },
  itemId: ItemId,
  meta?: ItemMeta,
): Pickup {
  const def = getItemDef(itemId);
  let mesh: THREE.Object3D;
  if (def.makeViewModel) {
    mesh = def.makeViewModel();
    mesh.scale.set(1.5, 1.5, 1.5);
  } else {
    const fallback = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.08, 0.10),
      new THREE.MeshStandardMaterial({ color: 0x8a7a5e, roughness: 0.9 }),
    );
    mesh = fallback;
  }
  const groundY = terrain.heightAt(pos.x, pos.z);
  const restY = groundY + 0.04;
  mesh.position.set(pos.x, restY, pos.z);
  mesh.rotation.y = Math.random() * Math.PI * 2;
  alignToTerrainNormal(mesh, terrain, pos.x, pos.z);
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

  return {
    id: pickupId,
    itemId,
    meta: meta ? { ...meta } : undefined,
    mesh,
    pos: new THREE.Vector3(pos.x, restY, pos.z),
    bobPhase: Math.random() * Math.PI * 2,
    hovered: false,
  };
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

/** Remove a pickup from the world + the list. Used when E-take fires. */
export function despawnPickup(
  ctx: import('../GameContext.ts').GameContext,
  pickup: Pickup,
): void {
  ctx.three.scene.remove(pickup.mesh);
  const idx = ctx.pickups.list.indexOf(pickup);
  if (idx >= 0) ctx.pickups.list.splice(idx, 1);
}
