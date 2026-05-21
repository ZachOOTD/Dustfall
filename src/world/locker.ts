// Session AAC — placeable locker. Wooden chest extends the player's
// effective inventory. Bidirectional cargo (deposit + take) via the
// existing loot menu's allowDeposit:true mode — same pattern as sled
// cargo from QQ-2.
//
// Architecture (D80 — clone-not-parameterize): mirrors tent.ts shape
// but with a contents array (like Sled). Separate module since the
// pack-up refuse-if-non-empty logic + new InteractType 'open_locker'
// don't generalize to the other placeables.
//
// Pack-up rule: refuses if `contents` is non-empty (toast "empty it
// first — the chest is full"). Player must transfer items out before
// packing. Prevents losing items to a packed-with-cargo state which
// would be unrecoverable.

import * as THREE from 'three';
import type { GameContext } from '../GameContext.ts';
import { Tuning } from '../config/tuning.ts';
import type { LootEntry } from './lootContainers.ts';
import { addItem } from '../inventory/inventory.ts';

export interface Locker {
  id: number;
  mesh: THREE.Group;
  contents: LootEntry[];
  pos: THREE.Vector3;
  rotationY: number;
  hovered: boolean;
}

let _nextId = 1;

function tag(root: THREE.Object3D, id: number): void {
  root.traverse((o) => {
    o.userData.interactType = 'open_locker';
    o.userData.interactId = id;
    o.userData.interactRegistry = 'lockers';
  });
}

function makeLockerVisual(): THREE.Group {
  const g = new THREE.Group();
  const W = Tuning.LOCKER_WIDTH_M;
  const D = Tuning.LOCKER_DEPTH_M;
  const H = Tuning.LOCKER_HEIGHT_M;

  // Main wooden box
  const woodMat = new THREE.MeshLambertMaterial({ color: 0x6a4a2c });
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(W, H, D),
    woodMat,
  );
  body.position.y = H * 0.5;
  g.add(body);

  // Lid — slightly raised, darker, suggesting a separable cover
  const lidMat = new THREE.MeshLambertMaterial({ color: 0x5a3a22 });
  const lid = new THREE.Mesh(
    new THREE.BoxGeometry(W + 0.03, 0.05, D + 0.03),
    lidMat,
  );
  lid.position.y = H + 0.025;
  g.add(lid);

  // Metal banding strips around the body (3 horizontal)
  const metalMat = new THREE.MeshLambertMaterial({ color: 0x3a3a3a });
  for (let i = 0; i < 3; i++) {
    const band = new THREE.Mesh(
      new THREE.BoxGeometry(W + 0.02, 0.03, D + 0.02),
      metalMat,
    );
    band.position.y = H * (0.20 + i * 0.30);
    g.add(band);
  }

  // Latch — small metal cylinder centered on the front face
  const latch = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.04, 0.05, 8),
    metalMat,
  );
  latch.rotation.x = Math.PI / 2;
  latch.position.set(0, H * 0.50, D * 0.5 + 0.025);
  g.add(latch);

  return g;
}

/** Deploy a locker PLACEMENT_DISTANCE_M ahead. */
export function deployLocker(ctx: GameContext): Locker | null {
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

  for (const existing of ctx.lockers.list) {
    if (existing.pos.distanceToSquared(pos) < Tuning.LOCKER_NEAR_DISTANCE_SQ) {
      return null;
    }
  }

  // Rotation: face the player (so the latch is on the player's side).
  const rotationY = Math.atan2(-dir.x, -dir.z);
  return spawnLockerAt(ctx, pos, rotationY, []);
}

export function spawnLockerAt(
  ctx: GameContext,
  pos: THREE.Vector3,
  rotationY: number,
  contents: LootEntry[],
): Locker {
  const mesh = makeLockerVisual();
  mesh.position.copy(pos);
  mesh.rotation.y = rotationY;
  mesh.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });
  ctx.three.scene.add(mesh);

  const id = _nextId++;
  tag(mesh, id);

  const locker: Locker = {
    id,
    mesh,
    contents: contents.map((e) => ({ ...e })),  // copy to detach from caller
    pos: pos.clone(),
    rotationY,
    hovered: false,
  };
  ctx.lockers.list.push(locker);
  return locker;
}

export function setNextLockerId(n: number): void {
  if (n > _nextId) _nextId = n;
}

export function findLockerById(list: Locker[], id: number | undefined): Locker | undefined {
  if (id === undefined) return undefined;
  return list.find((l) => l.id === id);
}

/** Pack the locker. REFUSES if contents are non-empty — player must
 *  transfer items out first. Prevents an unrecoverable "kit holds
 *  cargo" state. */
export function packUpLocker(ctx: GameContext, locker: Locker): boolean {
  if (locker.contents.length > 0) {
    ctx.ui.showToast("empty it first — the chest still has things in it");
    return false;
  }
  const slotIdx = addItem(ctx.inventory, 'locker_kit', undefined, ctx);
  if (slotIdx < 0) {
    ctx.ui.showToast('no room in your bag');
    return false;
  }
  ctx.three.scene.remove(locker.mesh);
  const i = ctx.lockers.list.indexOf(locker);
  if (i >= 0) ctx.lockers.list.splice(i, 1);
  ctx.ui.showToast('locker packed');
  return true;
}
