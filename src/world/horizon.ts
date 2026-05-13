// Perimeter mountain ring (Session P). 20+ tall irregular spires placed at a
// distance well outside the playable area but inside the sky-sphere radius,
// so they read as a bounding horizon silhouette. Single InstancedMesh; flagged
// as far-from-origin + no-shadow so the main.ts shadow traversal skips them.

import * as THREE from 'three';
import type { Rng } from '../core/rng.ts';
import type { Terrain } from './terrain.ts';
import { Tuning } from '../config/tuning.ts';
import { perturbOutward, tintByHeight } from './sculpt.ts';
import { makeRng } from '../core/rng.ts';

const _tmpPos = new THREE.Vector3();
const _tmpQuat = new THREE.Quaternion();
const _tmpScale = new THREE.Vector3();
const _tmpEuler = new THREE.Euler();
const _tmpMat4 = new THREE.Matrix4();

export function createPerimeterMountains(
  scene: THREE.Scene,
  terrain: Terrain,
  rand: Rng,
): void {
  const count = Tuning.PERIMETER_MOUNTAIN_COUNT;

  // One bumpy icosahedron template, vertex-tinted dark.
  const geo = new THREE.IcosahedronGeometry(1.0, 1);
  perturbOutward(geo, 0.28, 13);
  const tintBase = new THREE.Color().setHSL(0.07, 0.10, 0.18);
  tintByHeight(geo, tintBase, makeRng(91));

  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.count = count;
  mesh.frustumCulled = false; // union AABB spans the world
  // Far + noShadow: existing main.ts traversal honors these flags (Session H/K).
  mesh.userData.farFromOrigin = true;
  mesh.userData.noShadow = true;
  mesh.castShadow = false;
  mesh.receiveShadow = false;

  for (let i = 0; i < count; i++) {
    // Roughly evenly spaced angles with jitter so the ring doesn't look gridded.
    const angle = (i / count) * Math.PI * 2 + (rand() - 0.5) * (Math.PI / count) * 0.7;
    const radius = Tuning.PERIMETER_MOUNTAIN_RADIUS_MIN +
      rand() * (Tuning.PERIMETER_MOUNTAIN_RADIUS_MAX - Tuning.PERIMETER_MOUNTAIN_RADIUS_MIN);
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;

    const w = Tuning.PERIMETER_MOUNTAIN_WIDTH_MIN +
      rand() * (Tuning.PERIMETER_MOUNTAIN_WIDTH_MAX - Tuning.PERIMETER_MOUNTAIN_WIDTH_MIN);
    const h = Tuning.PERIMETER_MOUNTAIN_HEIGHT_MIN +
      rand() * (Tuning.PERIMETER_MOUNTAIN_HEIGHT_MAX - Tuning.PERIMETER_MOUNTAIN_HEIGHT_MIN);

    // Embed slightly into the ground so the base disappears behind nearer terrain.
    const groundY = terrain.heightAt(x, z) - 4;

    _tmpPos.set(x, groundY + h * 0.5, z);
    _tmpEuler.set(
      (rand() - 0.5) * 0.18,       // slight pitch jitter
      rand() * Math.PI * 2,        // free yaw
      (rand() - 0.5) * 0.18,
    );
    _tmpQuat.setFromEuler(_tmpEuler);
    _tmpScale.set(w, h, w * (0.85 + rand() * 0.3));
    _tmpMat4.compose(_tmpPos, _tmpQuat, _tmpScale);
    mesh.setMatrixAt(i, _tmpMat4);
  }
  mesh.instanceMatrix.needsUpdate = true;
  scene.add(mesh);
}
