// Placeable tent — created when a tent_kit is used.
// Provides: a shelter zone + a 'sleep' interactable.

import * as THREE from 'three';
import type { GameContext } from '../GameContext.ts';
import { Tuning } from '../config/tuning.ts';
import {
  addShelterZone,
  type ShelterZone,
} from '../shelter/shelterZones.ts';

export interface Tent {
  id: number;
  mesh: THREE.Group;
  shelterZone: ShelterZone;
  pos: THREE.Vector3;
  hovered: boolean;
}

let _nextId = 1;

const TENT_SHELTER_HALF = { x: 1.8, y: 1.4, z: 1.8 };
const NEAR_TENT_DISTANCE_SQ = 2.0 * 2.0;

function tag(root: THREE.Object3D, id: number): void {
  root.traverse((o) => {
    o.userData.interactType = 'sleep';
    o.userData.interactId = id;
    o.userData.interactRegistry = 'tents';
  });
}

function makeTentVisual(): THREE.Group {
  const g = new THREE.Group();
  const canvasMat = new THREE.MeshLambertMaterial({ color: 0xa89878 });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x6a5a48 });
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x3a2a1a });

  // Two sloped wall panels forming a triangular profile
  const wallW = 2.0;
  const wallH = 1.6;
  const wallTilt = 0.6; // radians from vertical
  for (const sx of [-1, 1]) {
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(wallW, wallH), canvasMat);
    wall.rotation.y = -Math.PI / 2;
    wall.rotation.x = 0;
    wall.position.set(0, wallH / 2 * Math.cos(wallTilt), sx * (wallH / 2) * Math.sin(wallTilt));
    wall.rotation.z = sx * wallTilt;
    wall.material.side = THREE.DoubleSide;
    g.add(wall);
  }

  // Ground footprint — darker fabric
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(wallW, wallH * Math.sin(wallTilt) * 2), darkMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.02;
  g.add(floor);

  // Two end triangles (entrance + back)
  for (const sz of [-1, 1]) {
    const triShape = new THREE.Shape();
    const halfW = wallH * Math.sin(wallTilt);
    const peakY = wallH * Math.cos(wallTilt);
    triShape.moveTo(-halfW, 0);
    triShape.lineTo(halfW, 0);
    triShape.lineTo(0, peakY);
    triShape.closePath();
    const tri = new THREE.Mesh(
      new THREE.ShapeGeometry(triShape),
      sz === 1 ? canvasMat : darkMat,  // entrance brighter, back darker
    );
    tri.position.set(0, 0, sz * (wallW / 2));
    if (sz === -1) tri.rotation.y = Math.PI;
    tri.material.side = THREE.DoubleSide;
    g.add(tri);
  }

  // Center pole
  const peakY = wallH * Math.cos(wallTilt);
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.02, peakY + 0.05, 6),
    poleMat,
  );
  pole.position.y = (peakY + 0.05) / 2;
  g.add(pole);

  return g;
}

export function deployTent(ctx: GameContext): Tent | null {
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

  // Reject if too close to existing tent
  for (const existing of ctx.tents.list) {
    if (existing.pos.distanceToSquared(pos) < NEAR_TENT_DISTANCE_SQ) {
      return null;
    }
  }

  return spawnTentAt(ctx, pos, Math.random() * Math.PI * 2);
}

/** Materialise a tent at the given world position + Y rotation. Used by
 *  both deployTent (random rotation) and save/load (saved rotation). */
export function spawnTentAt(
  ctx: GameContext,
  pos: THREE.Vector3,
  rotationY: number,
): Tent {
  const mesh = makeTentVisual();
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
    { x: pos.x, y: pos.y + TENT_SHELTER_HALF.y, z: pos.z },
    TENT_SHELTER_HALF,
  );

  const tent: Tent = {
    id,
    mesh,
    shelterZone,
    pos: pos.clone(),
    hovered: false,
  };
  ctx.tents.list.push(tent);
  return tent;
}

/** Bump the module-level id counter past `n` so future spawns don't collide
 *  with restored ids. Used by save/load. */
export function setNextTentId(n: number): void {
  if (n > _nextId) _nextId = n;
}

export function findTentById(list: Tent[], id: number | undefined): Tent | undefined {
  if (id === undefined) return undefined;
  return list.find((t) => t.id === id);
}
