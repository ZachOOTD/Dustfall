// World-spawned pickups. Generic over item type — canteens are just one
// kind. Each pickup links a mesh in the scene to an itemId; the player's
// interaction module raycasts against this list to figure out what's hovered.

import * as THREE from 'three';
import type { Rng } from '../core/rng.ts';
import type { Terrain } from '../world/terrain.ts';
import type { AssetRegistry } from '../assets/loader.ts';
import { cloneAsset } from '../assets/loader.ts';
import { Tuning } from '../config/tuning.ts';
import type { ItemId } from '../inventory/types.ts';

export interface Pickup {
  id: number;                 // unique handle for hover/take
  itemId: ItemId;
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

    mesh.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });

    const pickupId = _nextId++;
    tagPickupMeshes(mesh, pickupId);
    scene.add(mesh);

    list.push({
      id: pickupId,
      itemId: 'canteen',
      mesh,
      pos: new THREE.Vector3(x, restY, z),
      bobPhase: rand() * Math.PI * 2,
      hovered: false,
    });
  }
  return list;
}

/**
 * Per-frame visual update: gentle bob + slow Y rotation. Hover state is
 * separate (set by interaction) and applied as an emissive boost on the
 * primary mesh material.
 */
export function bobPickups(ctx: import('../GameContext.ts').GameContext, dt: number): void {
  const t = ctx.time.elapsed;
  for (const p of ctx.pickups.list) {
    const bob = Math.sin(t * 1.4 + p.bobPhase) * 0.06;
    p.mesh.position.x = p.pos.x;
    p.mesh.position.z = p.pos.z;
    p.mesh.position.y = p.pos.y + bob + (p.hovered ? 0.04 : 0);
    p.mesh.rotation.y += 0.4 * dt;
  }
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
