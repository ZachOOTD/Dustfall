// Session AAC — placeable bedroll. Portable sleep affordance, smaller
// and quicker to deploy than a tent. Provides a small shelter zone
// (partial cold-drain protection while sleeping) but no enclosure.
// Player can craft + place + pack up + carry, just like tent_kit.
//
// Architecture (D80 — clone-not-parameterize): mirrors tent.ts shape;
// separate module since the geometry is different and the future may
// add bedroll-specific behaviors (faster sleep cycles, etc.).
//
// RMB pack-up dispatch lives in wieldAction.ts/handleContextAction
// (same pattern as small tent + large tent). Unlike largeTent, bedroll
// has no "inside the shelter" refuse — it's a ground-level pad, the
// player isn't enclosed by it.

import * as THREE from 'three';
import type { GameContext } from '../GameContext.ts';
import { Tuning } from '../config/tuning.ts';
import {
  addShelterZone,
  removeShelterZone,
  type ShelterZone,
} from '../shelter/shelterZones.ts';
import { addItem } from '../inventory/inventory.ts';

export interface Bedroll {
  id: number;
  mesh: THREE.Group;
  shelterZone: ShelterZone;
  pos: THREE.Vector3;
  rotationY: number;
  hovered: boolean;
}

let _nextId = 1;

function tag(root: THREE.Object3D, id: number): void {
  root.traverse((o) => {
    o.userData.interactType = 'sleep';
    o.userData.interactId = id;
    o.userData.interactRegistry = 'bedrolls';
  });
}

function makeBedrollVisual(): THREE.Group {
  const g = new THREE.Group();
  const W = Tuning.BEDROLL_WIDTH_M;
  const D = Tuning.BEDROLL_DEPTH_M;

  // Main pad — flat, dusty-canvas brown.
  const padMat = new THREE.MeshLambertMaterial({ color: 0x9a7b5a });
  const pad = new THREE.Mesh(
    new THREE.BoxGeometry(W, 0.06, D),
    padMat,
  );
  pad.position.y = 0.03;     // flush to ground top
  g.add(pad);

  // Pillow — smaller cloth roll at one end (head).
  const pillowMat = new THREE.MeshLambertMaterial({ color: 0xb89878 });
  const pillow = new THREE.Mesh(
    new THREE.BoxGeometry(W * 0.30, 0.10, D * 0.85),
    pillowMat,
  );
  pillow.position.set(-W * 0.30, 0.10, 0);   // head-end is -X locally; spawn aligns this
  g.add(pillow);

  // Subtle blanket fold lines — two thin darker strips across the pad.
  const foldMat = new THREE.MeshLambertMaterial({ color: 0x7a5f44 });
  for (let i = 0; i < 2; i++) {
    const fold = new THREE.Mesh(
      new THREE.BoxGeometry(W * 0.95, 0.005, 0.04),
      foldMat,
    );
    fold.position.set(0, 0.062, (i - 0.5) * D * 0.4);
    g.add(fold);
  }

  return g;
}

/** Deploy a bedroll PLACEMENT_DISTANCE_M in front of the player. Returns
 *  null if too close to an existing bedroll. Mirrors deployTent. */
export function deployBedroll(ctx: GameContext): Bedroll | null {
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

  for (const existing of ctx.bedrolls.list) {
    if (existing.pos.distanceToSquared(pos) < Tuning.BEDROLL_NEAR_DISTANCE_SQ) {
      return null;
    }
  }

  // Rotate so the long axis runs perpendicular to the player's facing
  // direction (player sleeps with head away from where they were
  // standing — feels natural to drop and lie down).
  const rotationY = Math.atan2(dir.x, dir.z) + Math.PI / 2;
  return spawnBedrollAt(ctx, pos, rotationY);
}

/** Materialize a bedroll. Used by deployBedroll + save/load replay. */
export function spawnBedrollAt(
  ctx: GameContext,
  pos: THREE.Vector3,
  rotationY: number,
): Bedroll {
  const mesh = makeBedrollVisual();
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

  const shelterZone = addShelterZone(
    ctx.shelter,
    { x: pos.x, y: pos.y + Tuning.BEDROLL_SHELTER_HALF_Y, z: pos.z },
    {
      x: Tuning.BEDROLL_SHELTER_HALF_X,
      y: Tuning.BEDROLL_SHELTER_HALF_Y,
      z: Tuning.BEDROLL_SHELTER_HALF_Z,
    },
    // No isLargeTent flag — bedroll is a flat pad, not an enclosure;
    // it gives a small shelter zone but the storm-dampening behavior
    // matches small tents (full kill when standing in it).
  );

  const bedroll: Bedroll = {
    id,
    mesh,
    shelterZone,
    pos: pos.clone(),
    rotationY,
    hovered: false,
  };
  ctx.bedrolls.list.push(bedroll);
  return bedroll;
}

export function setNextBedrollId(n: number): void {
  if (n > _nextId) _nextId = n;
}

export function findBedrollById(list: Bedroll[], id: number | undefined): Bedroll | undefined {
  if (id === undefined) return undefined;
  return list.find((b) => b.id === id);
}

/** Pack the bedroll back into inventory. Atomic: tries addItem first;
 *  if inventory full, refuses + bedroll stays placed. */
export function packUpBedroll(ctx: GameContext, bedroll: Bedroll): boolean {
  const slotIdx = addItem(ctx.inventory, 'bedroll_kit', undefined, ctx);
  if (slotIdx < 0) {
    ctx.ui.showToast('no room in your bag');
    return false;
  }
  removeShelterZone(ctx.shelter, bedroll.shelterZone);
  ctx.three.scene.remove(bedroll.mesh);
  const i = ctx.bedrolls.list.indexOf(bedroll);
  if (i >= 0) ctx.bedrolls.list.splice(i, 1);
  ctx.ui.showToast('bedroll rolled up');
  return true;
}
