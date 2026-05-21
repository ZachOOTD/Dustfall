// Session XX — larger enterable tent. Walk-in shelter the player
// physically enters (in contrast to tent.ts's smaller "sleep next to
// it" pyramid). Geometry: 3-walled cabin with open front, cloth-draped
// frame, walk-in interior cavity. Player capsule fits inside; shelter
// zone covers the interior so being inside grants the warmth bubble.
//
// Architecture (D80 — distinct module vs. parameterized): kept as a
// separate file from tent.ts because the collider geometry diverges
// (3-wall walk-in vs. simple pyramid). Two modules is cheaper than
// one parameterized for this scope.
//
// Pack-up (UU-2 pattern): RMB on the large tent → packUpLargeTent
// via wieldAction.ts's handleContextAction.

import * as THREE from 'three';
import type { GameContext } from '../GameContext.ts';
import { Tuning } from '../config/tuning.ts';
import {
  addShelterZone,
  removeShelterZone,
  type ShelterZone,
} from '../shelter/shelterZones.ts';
import { addItem } from '../inventory/inventory.ts';

export interface LargeTent {
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
    o.userData.interactType = 'sleep';   // reuse 'sleep' verb (same as small tent)
    o.userData.interactId = id;
    o.userData.interactRegistry = 'largeTents';
  });
}

function makeLargeTentVisual(): THREE.Group {
  const g = new THREE.Group();
  const W = Tuning.LARGE_TENT_WIDTH_M;
  const D = Tuning.LARGE_TENT_DEPTH_M;
  const H = Tuning.LARGE_TENT_HEIGHT_M;

  // AAL — fabric materials are now FrontSide (was DoubleSide which made
  // the walls look paper-thin from inside the walk-in cavity). Wall +
  // roof geometry switched from PlaneGeometry to thin BoxGeometry so
  // the canvas reads as real fabric thickness at oblique angles.
  const canvasMat = new THREE.MeshLambertMaterial({ color: 0xa89878 });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x6a5a48 });
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x3a2a1a });
  const FABRIC_THICK = 0.04;

  // Floor (dark fabric) — stays a plane (one-sided, viewed from above).
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), darkMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.02;
  g.add(floor);

  // Back wall (faces -Z if tent's front is +Z; we'll rotate the whole
  // group at deploy time so "+Z is forward" = "+Z is the open entrance").
  // AAL — thin box so the canvas has real thickness.
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(W, H, FABRIC_THICK), canvasMat);
  backWall.position.set(0, H * 0.5, -D * 0.5 - FABRIC_THICK * 0.5);
  g.add(backWall);

  // Side walls (left/right) — face +/-X. Cloth draped from corner posts.
  for (const sx of [-1, 1]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(FABRIC_THICK, H, D), canvasMat);
    wall.position.set(sx * (W * 0.5 + FABRIC_THICK * 0.5), H * 0.5, 0);
    g.add(wall);
  }

  // Roof (slightly pitched). Single piece since the tent is short.
  // AAL — thin box so roof reads as fabric not a paper plane.
  const roof = new THREE.Mesh(new THREE.BoxGeometry(W, FABRIC_THICK, D + 0.1), darkMat);
  roof.position.set(0, H + FABRIC_THICK * 0.5, 0);
  g.add(roof);

  // Four corner posts (visible wood)
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, H + 0.05, 6),
      poleMat,
    );
    post.position.set(sx * (W * 0.5 - 0.05), H * 0.5, sz * (D * 0.5 - 0.05));
    g.add(post);
  }

  // Front lintel (top beam across the open front)
  const lintel = new THREE.Mesh(
    new THREE.BoxGeometry(W, 0.08, 0.08),
    poleMat,
  );
  lintel.position.set(0, H, D * 0.5);
  g.add(lintel);

  return g;
}

/** Attempt to deploy a large tent in front of the camera. Returns null
 *  if too close to an existing large tent. Mirrors deployTent + the
 *  D75 PLACEMENT_DISTANCE_M pattern. */
export function deployLargeTent(ctx: GameContext): LargeTent | null {
  const cam = ctx.three.camera;
  const dir = new THREE.Vector3();
  cam.getWorldDirection(dir);
  dir.y = 0;
  if (dir.lengthSq() < 1e-4) dir.set(0, 0, -1);
  dir.normalize();
  // Push out a bit further than the small tent so the player isn't
  // standing on top of it after deploy.
  const distance = Tuning.PLACEMENT_DISTANCE_M + Tuning.LARGE_TENT_DEPTH_M * 0.5;
  const pos = new THREE.Vector3()
    .copy(cam.position)
    .addScaledVector(dir, distance);
  pos.y = ctx.terrain.heightAt(pos.x, pos.z);

  // Reject if too close to another large tent
  for (const existing of ctx.largeTents.list) {
    if (existing.pos.distanceToSquared(pos) < Tuning.LARGE_TENT_NEAR_DISTANCE_SQ) {
      return null;
    }
  }

  // Rotation: front of tent (open face = +Z in local space) points back
  // toward the player so they walk in from where they're standing.
  // Camera-forward is `dir` (pointing AWAY from player into the world).
  // We want tent's +Z = -dir (back toward camera), so yaw = atan2(-dir.x, -dir.z) = atan2(dir.x, dir.z) + π.
  const rotationY = Math.atan2(-dir.x, -dir.z);
  return spawnLargeTentAt(ctx, pos, rotationY);
}

/** Materialise a large tent at a world position + Y rotation. Used by
 *  both deployLargeTent (player action) and save/load (restored pose). */
export function spawnLargeTentAt(
  ctx: GameContext,
  pos: THREE.Vector3,
  rotationY: number,
): LargeTent {
  const mesh = makeLargeTentVisual();
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

  // Shelter zone covers the interior cavity only (player must be inside).
  // Centered just above the floor at half-height. YY — flagged
  // isLargeTent=true so updateShelter routes a dampened perceived
  // storm intensity (not the full kill the small tent / fire get).
  const shelterZone = addShelterZone(
    ctx.shelter,
    { x: pos.x, y: pos.y + Tuning.LARGE_TENT_SHELTER_HALF_Y, z: pos.z },
    {
      x: Tuning.LARGE_TENT_SHELTER_HALF_X,
      y: Tuning.LARGE_TENT_SHELTER_HALF_Y,
      z: Tuning.LARGE_TENT_SHELTER_HALF_Z,
    },
    { isLargeTent: true },
  );

  const tent: LargeTent = {
    id,
    mesh,
    shelterZone,
    pos: pos.clone(),
    rotationY,
    hovered: false,
  };
  ctx.largeTents.list.push(tent);
  return tent;
}

/** Save/load bumps the id counter past restored ids. */
export function setNextLargeTentId(n: number): void {
  if (n > _nextId) _nextId = n;
}

export function findLargeTentById(list: LargeTent[], id: number | undefined): LargeTent | undefined {
  if (id === undefined) return undefined;
  return list.find((t) => t.id === id);
}

/** Pack the tent into inventory. Atomic: tries `addItem` first;
 *  if inventory full, refuses + tent stays placed. Symmetric to
 *  packUpTent in tent.ts (UU-2). */
export function packUpLargeTent(ctx: GameContext, tent: LargeTent): boolean {
  // Check: is the player currently INSIDE this tent? If so, refuse —
  // don't yank shelter out from under the player.
  const tr = ctx.player.body.body.translation();
  const zone = tent.shelterZone;
  const insideThisTent =
    Math.abs(tr.x - zone.cx) <= zone.hx &&
    Math.abs(tr.y - zone.cy) <= zone.hy &&
    Math.abs(tr.z - zone.cz) <= zone.hz;
  if (insideThisTent) {
    ctx.ui.showToast("can't pack — you're inside the tent");
    return false;
  }
  // Try to give the kit back first.
  const slotIdx = addItem(ctx.inventory, 'large_tent_kit', undefined, ctx);
  if (slotIdx < 0) {
    ctx.ui.showToast('no room in your bag');
    return false;
  }
  removeShelterZone(ctx.shelter, tent.shelterZone);
  ctx.three.scene.remove(tent.mesh);
  const i = ctx.largeTents.list.indexOf(tent);
  if (i >= 0) ctx.largeTents.list.splice(i, 1);
  ctx.ui.showToast('shelter packed');
  return true;
}
