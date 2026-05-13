// Seeded scatter of rocks, dead trees, wreckage, and distant mesas.
// Each kind tries to use a loaded GLTF variant from the asset registry,
// falling back silently to primitive geometry when the registry is empty.

import * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';
import type { Rng } from '../core/rng.ts';
import type { Terrain } from './terrain.ts';
import type { AssetRegistry } from '../assets/loader.ts';
import type { LandmarkKind, LoadedAsset } from '../assets/manifest.ts';
import { cloneAsset } from '../assets/loader.ts';
import { Tuning } from '../config/tuning.ts';
import {
  makeStaticBox,
  makeStaticCylinder,
  makeStaticConvexHull,
  attachBoundsCollider,
} from '../physics/bodies.ts';
import { perturbOutward, tintByHeight } from './sculpt.ts';
import { makeRng } from '../core/rng.ts';

const _quat = new THREE.Quaternion();
const _tmpMat4 = new THREE.Matrix4();
const _tmpPos = new THREE.Vector3();
const _tmpQuat = new THREE.Quaternion();
const _tmpScale = new THREE.Vector3();
const _tmpEuler = new THREE.Euler();

// ──────────────────────────────────────────────────────────────
// Pre-baked instance templates (rocks + trunks)
// ──────────────────────────────────────────────────────────────

const ROCK_TEMPLATE_COUNT = 4;
const TRUNK_BASE_HEIGHTS = { stump: 1.0, medium: 3.0, tall: 5.0 } as const;
type TrunkKey = keyof typeof TRUNK_BASE_HEIGHTS;
const TRUNK_KEYS: ReadonlyArray<TrunkKey> = ['stump', 'medium', 'tall'];

function buildRockTemplates(): THREE.BufferGeometry[] {
  const templates: THREE.BufferGeometry[] = [];
  for (let t = 0; t < ROCK_TEMPLATE_COUNT; t++) {
    const detail = t < 3 ? 1 : 2; // 3 low-poly, 1 higher detail
    const geo = new THREE.IcosahedronGeometry(1.0, detail);
    perturbOutward(geo, 0.22, t * 31 + 7);
    const baseColor = new THREE.Color().setHSL(
      0.05 + t * 0.012,
      0.16 + t * 0.04,
      0.22 + t * 0.04,
    );
    // Deterministic per-template jitter for tintByHeight (don't pollute the
    // game's scatter RNG)
    tintByHeight(geo, baseColor, makeRng(t * 97 + 3));
    templates.push(geo);
  }
  return templates;
}

function buildTrunkTemplates(): Record<TrunkKey, THREE.BufferGeometry> {
  return {
    stump:  new THREE.CylinderGeometry(0.10, 0.22, TRUNK_BASE_HEIGHTS.stump, 6),
    medium: new THREE.CylinderGeometry(0.10, 0.22, TRUNK_BASE_HEIGHTS.medium, 6),
    tall:   new THREE.CylinderGeometry(0.10, 0.22, TRUNK_BASE_HEIGHTS.tall, 6),
  };
}

function getQuat(m: THREE.Object3D): { x: number; y: number; z: number; w: number } {
  m.getWorldQuaternion(_quat);
  return { x: _quat.x, y: _quat.y, z: _quat.z, w: _quat.w };
}

function pick<T>(rand: Rng, arr: T[]): T | undefined {
  if (arr.length === 0) return undefined;
  return arr[Math.floor(rand() * arr.length)];
}

/** Place a GLTF clone if a variant exists for this kind. Returns true if placed. */
function tryPlaceAsset(
  scene: THREE.Scene,
  world: RAPIER.World,
  assets: AssetRegistry,
  kind: LandmarkKind,
  x: number,
  groundY: number,
  z: number,
  rand: Rng,
): boolean {
  const variant = pick(rand, assets.pool(kind));
  if (!variant) return false;
  const clone = cloneAsset(variant);
  if (!clone) return false;
  const scaleJitter = 0.85 + rand() * 0.3;
  clone.scale.multiplyScalar(scaleJitter);
  clone.position.set(x, groundY, z);
  clone.rotation.y = rand() * Math.PI * 2;
  clone.updateMatrixWorld(true);
  scene.add(clone);
  attachBoundsCollider(world, clone, clone.position, getQuat(clone));
  return true;
}

export function scatterLandmarks(
  scene: THREE.Scene,
  world: RAPIER.World,
  terrain: Terrain,
  assets: AssetRegistry,
  rand: Rng,
): void {
  // ────────────────────────────────────────────────────────────
  // Set up instanced pools FIRST. Each pool is split near/far so
  // shadow casting can be disabled on the far one.
  // ────────────────────────────────────────────────────────────
  const rockTemplates = buildRockTemplates();
  const trunkTemplates = buildTrunkTemplates();

  const rockMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const trunkMat = new THREE.MeshLambertMaterial({ flatShading: true });

  const MAX_ROCKS_PER_POOL = 64;
  const MAX_TRUNKS_PER_POOL = 30;

  type InstPool = { near: THREE.InstancedMesh; far: THREE.InstancedMesh; nearCount: number; farCount: number };

  function makePool(geo: THREE.BufferGeometry, mat: THREE.Material, max: number): InstPool {
    const near = new THREE.InstancedMesh(geo, mat, max);
    const far = new THREE.InstancedMesh(geo, mat, max);
    near.count = 0;
    far.count = 0;
    near.castShadow = true; near.receiveShadow = true;
    far.castShadow = false; far.receiveShadow = true;
    near.frustumCulled = false; far.frustumCulled = false; // huge union AABB defeats culling anyway
    scene.add(near);
    scene.add(far);
    return { near, far, nearCount: 0, farCount: 0 };
  }

  const rockPools: InstPool[] = rockTemplates.map((g) => makePool(g, rockMat, MAX_ROCKS_PER_POOL));
  const trunkPools: Record<TrunkKey, InstPool> = {
    stump:  makePool(trunkTemplates.stump,  trunkMat, MAX_TRUNKS_PER_POOL),
    medium: makePool(trunkTemplates.medium, trunkMat, MAX_TRUNKS_PER_POOL),
    tall:   makePool(trunkTemplates.tall,   trunkMat, MAX_TRUNKS_PER_POOL),
  };

  function addToPool(p: InstPool, isFar: boolean, mat: THREE.Matrix4): void {
    const m = isFar ? p.far : p.near;
    const idx = isFar ? p.farCount : p.nearCount;
    if (idx >= m.count) m.count = idx + 1;
    m.setMatrixAt(idx, mat);
    if (isFar) p.farCount++; else p.nearCount++;
  }

  for (let i = 0; i < Tuning.LANDMARK_COUNT; i++) {
    const radius = 6 + rand() * Tuning.WORLD_RADIUS;
    const angle = rand() * Math.PI * 2;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const groundY = terrain.heightAt(x, z);
    const roll = rand();
    const isFar = radius > Tuning.SHADOW_CULL_DISTANCE;

    if (roll < 0.55) {
      // Rock — pick a template, compute per-instance matrix, add to pool.
      if (tryPlaceAsset(scene, world, assets, 'rock', x, groundY, z, rand)) continue;
      const templateIdx = Math.floor(rand() * ROCK_TEMPLATE_COUNT);

      const size = 0.6 + rand() * 2.4;
      const propRoll = rand();
      let scaleY = 0.7 + rand() * 0.5;
      if (propRoll < 0.14)       scaleY = 0.25 + rand() * 0.2;  // flat boulder
      else if (propRoll > 0.92)  scaleY = 1.8 + rand() * 1.4;   // spire

      _tmpPos.set(x, groundY + size * scaleY * 0.45, z);
      _tmpEuler.set(
        (rand() - 0.5) * 0.35,
        rand() * Math.PI * 2,
        (rand() - 0.5) * 0.35,
      );
      _tmpQuat.setFromEuler(_tmpEuler);
      _tmpScale.set(size, size * scaleY, size);
      _tmpMat4.compose(_tmpPos, _tmpQuat, _tmpScale);

      addToPool(rockPools[templateIdx], isFar, _tmpMat4);
      // Collider — template verts scaled per-instance, body at pos/rot.
      makeStaticConvexHull(
        world,
        rockTemplates[templateIdx],
        _tmpPos,
        { x: _tmpQuat.x, y: _tmpQuat.y, z: _tmpQuat.z, w: _tmpQuat.w },
        _tmpScale,
      );
    } else if (roll < 0.78) {
      // Dead tree trunk — pick a template by height bucket.
      if (tryPlaceAsset(scene, world, assets, 'dead_tree', x, groundY, z, rand)) continue;

      const variant = rand();
      let template: TrunkKey;
      let h: number;
      if (variant < 0.18) {
        template = 'stump';
        h = 0.8 + rand() * 0.8;
      } else if (variant < 0.65) {
        template = 'medium';
        h = 2.4 + rand() * 1.4;
      } else {
        template = 'tall';
        h = 3.8 + rand() * 1.8;
      }
      const yScale = h / TRUNK_BASE_HEIGHTS[template];
      const radiusScale = 0.85 + rand() * 0.3;

      _tmpPos.set(x, groundY + h / 2, z);
      _tmpEuler.set(0, rand() * Math.PI * 2, (rand() - 0.5) * 0.5);
      _tmpQuat.setFromEuler(_tmpEuler);
      _tmpScale.set(radiusScale, yScale, radiusScale);
      _tmpMat4.compose(_tmpPos, _tmpQuat, _tmpScale);

      addToPool(trunkPools[template], isFar, _tmpMat4);
      makeStaticCylinder(
        world,
        h / 2,
        0.22 * radiusScale,
        _tmpPos,
        { x: _tmpQuat.x, y: _tmpQuat.y, z: _tmpQuat.z, w: _tmpQuat.w },
      );

      // Branches stay non-instanced (variable shape, few in count).
      if (variant > 0.18) {
        const branchMat = trunkMat;
        const branchCount = 1 + Math.floor(rand() * 3);
        for (let b = 0; b < branchCount; b++) {
          const branchLen = 0.6 + rand() * 1.4;
          const branchY = groundY + h * (0.55 + rand() * 0.4);
          const branchR = 0.04 + rand() * 0.04;
          const branch = new THREE.Mesh(
            new THREE.CylinderGeometry(branchR * 0.6, branchR, branchLen, 5),
            branchMat,
          );
          branch.position.set(x, branchY, z);
          const tilt = 0.6 + rand() * 0.8;
          const yaw = rand() * Math.PI * 2;
          branch.rotation.z = (rand() < 0.5 ? -1 : 1) * tilt;
          branch.rotation.y = yaw;
          const off = 0.12;
          branch.position.x += Math.cos(yaw) * off;
          branch.position.z += Math.sin(yaw) * off;
          if (isFar) branch.userData.farFromOrigin = true;
          scene.add(branch);
        }
      }
    } else if (roll < 0.92) {
      // Wreckage — pick one of 3 hand-coded variants.
      if (tryPlaceAsset(scene, world, assets, 'wreckage', x, groundY, z, rand)) continue;
      placeWreckage(scene, world, x, groundY, z, rand, isFar);
    } else {
      // Distant mesa silhouette — pick one of 3 variants.
      const wx = x * 1.4;
      const wz = z * 1.4;
      const baseY = terrain.heightAt(wx, wz);
      // Mesas are placed at 1.4× radius so apply the cull threshold on the
      // actual world position.
      const mesaFar = Math.hypot(wx, wz) > Tuning.SHADOW_CULL_DISTANCE;
      if (tryPlaceAsset(scene, world, assets, 'mesa', wx, baseY, wz, rand)) continue;
      placeMesa(scene, world, wx, baseY, wz, rand, mesaFar);
    }
  }

  // Finalize: flush instance matrices to GPU.
  for (const p of rockPools) {
    p.near.instanceMatrix.needsUpdate = true;
    p.far.instanceMatrix.needsUpdate = true;
  }
  for (const key of TRUNK_KEYS) {
    const p = trunkPools[key];
    p.near.instanceMatrix.needsUpdate = true;
    p.far.instanceMatrix.needsUpdate = true;
  }
}

// ──────────────────────────────────────────────────────────────────
// Wreckage variants — multi-piece groups, single bounding-box collider.
// ──────────────────────────────────────────────────────────────────
function placeWreckage(
  scene: THREE.Scene,
  world: RAPIER.World,
  x: number,
  groundY: number,
  z: number,
  rand: Rng,
  isFar: boolean,
): void {
  const variant = rand();
  const group = new THREE.Group();
  const rust = new THREE.Color().setHSL(0.04, 0.32, 0.16 + rand() * 0.06);
  const dark = new THREE.Color().setHSL(0.06, 0.10, 0.10);
  const rustMat = new THREE.MeshLambertMaterial({ color: rust, flatShading: true });
  const darkMat = new THREE.MeshLambertMaterial({ color: dark, flatShading: true });
  const woodMat = new THREE.MeshLambertMaterial({
    color: new THREE.Color().setHSL(0.07, 0.18, 0.16 + rand() * 0.06),
    flatShading: true,
  });

  let halfW = 1.5, halfH = 0.6, halfD = 1.2;

  if (variant < 0.40) {
    // Crashed cart — small cab box + slanted plate + 2 wheel cylinders, partly buried
    const cabW = 1.0 + rand() * 0.5;
    const cabH = 0.6 + rand() * 0.3;
    const cabD = 1.0 + rand() * 0.4;
    const cab = new THREE.Mesh(new THREE.BoxGeometry(cabW, cabH, cabD), rustMat);
    cab.position.set(0, cabH / 2, 0);
    group.add(cab);

    const plate = new THREE.Mesh(new THREE.BoxGeometry(cabW * 0.9, 0.06, cabD * 0.7), darkMat);
    plate.position.set(0.3, cabH * 0.95, 0);
    plate.rotation.z = -0.3 - rand() * 0.2;
    group.add(plate);

    for (let i = -1; i <= 1; i += 2) {
      const wheel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.32, 0.32, 0.18, 10),
        darkMat,
      );
      wheel.position.set(i * cabW * 0.45, 0.18, cabD * 0.42);
      wheel.rotation.z = Math.PI / 2;
      group.add(wheel);
    }

    halfW = cabW * 0.6; halfH = cabH * 0.6; halfD = cabD * 0.6;
  } else if (variant < 0.75) {
    // Crate stack — 2-3 weathered boxes at offset angles
    const stackCount = 2 + Math.floor(rand() * 2);
    let yCursor = 0;
    for (let s = 0; s < stackCount; s++) {
      const w = 0.7 + rand() * 0.4;
      const h = 0.6 + rand() * 0.25;
      const d = 0.7 + rand() * 0.4;
      const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), woodMat);
      box.position.set((rand() - 0.5) * 0.25, yCursor + h / 2, (rand() - 0.5) * 0.25);
      box.rotation.y = (rand() - 0.5) * 0.6;
      box.rotation.z = (rand() - 0.5) * 0.12;
      group.add(box);
      yCursor += h;
    }
    halfW = 0.6; halfH = yCursor / 2; halfD = 0.6;
  } else {
    // Pipe + drum — horizontal pipe + small upright drum
    const pipeLen = 2.2 + rand() * 1.5;
    const pipeR = 0.22 + rand() * 0.08;
    const pipe = new THREE.Mesh(
      new THREE.CylinderGeometry(pipeR, pipeR, pipeLen, 10),
      rustMat,
    );
    pipe.rotation.z = Math.PI / 2;
    pipe.rotation.y = (rand() - 0.5) * 0.4;
    pipe.position.set(0, pipeR, 0);
    group.add(pipe);

    if (rand() < 0.7) {
      const drumR = 0.30 + rand() * 0.10;
      const drumH = 0.7 + rand() * 0.3;
      const drum = new THREE.Mesh(
        new THREE.CylinderGeometry(drumR, drumR, drumH, 10),
        darkMat,
      );
      const off = pipeLen / 2 + drumR + 0.05;
      drum.position.set(off * (rand() < 0.5 ? -1 : 1), drumH / 2, (rand() - 0.5) * 0.6);
      drum.rotation.z = (rand() - 0.5) * 0.15;
      group.add(drum);
    }

    halfW = pipeLen / 2 + 0.4; halfH = 0.4; halfD = 0.5;
  }

  group.position.set(x, groundY, z);
  group.rotation.y = rand() * Math.PI * 2;
  group.rotation.z = (rand() - 0.5) * 0.10;
  if (isFar) group.userData.farFromOrigin = true;
  scene.add(group);

  // Apply shadows on every sub-mesh (added after main.ts's bulk pass).
  group.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = !isFar;
      m.receiveShadow = true;
    }
  });

  makeStaticBox(
    world,
    { x: halfW, y: halfH, z: halfD },
    { x: group.position.x, y: group.position.y + halfH, z: group.position.z },
    getQuat(group),
  );
}

// ──────────────────────────────────────────────────────────────────
// Mesa variants — distant silhouettes, fog-veiled.
// ──────────────────────────────────────────────────────────────────
function placeMesa(
  scene: THREE.Scene,
  world: RAPIER.World,
  x: number,
  groundY: number,
  z: number,
  rand: Rng,
  isFar: boolean,
): void {
  const variant = rand();
  const color = new THREE.Color().setHSL(0.05, 0.18, 0.18 + rand() * 0.06);
  const mat = new THREE.MeshLambertMaterial({ color, flatShading: true });
  const group = new THREE.Group();
  let halfW = 4, halfH = 4, halfD = 4;

  if (variant < 0.4) {
    // Stepped plateau — 2-3 stacked flat boxes of decreasing size
    const layers = 2 + Math.floor(rand() * 2);
    let yCursor = 0;
    let baseW = 6 + rand() * 6;
    let baseD = 6 + rand() * 6;
    for (let i = 0; i < layers; i++) {
      const layerH = 1.6 + rand() * 1.2;
      const w = baseW * (1 - i * 0.18);
      const d = baseD * (1 - i * 0.18);
      const box = new THREE.Mesh(new THREE.BoxGeometry(w, layerH, d), mat);
      box.position.set((rand() - 0.5) * 0.6, yCursor + layerH / 2, (rand() - 0.5) * 0.6);
      box.rotation.y = (rand() - 0.5) * 0.18;
      group.add(box);
      yCursor += layerH;
    }
    halfW = baseW / 2; halfH = yCursor / 2; halfD = baseD / 2;
  } else if (variant < 0.75) {
    // Tall spire — tapered cone (cylinder with top radius < bottom)
    const baseR = 2.5 + rand() * 1.8;
    const topR = 0.4 + rand() * 0.8;
    const h = 8 + rand() * 5;
    const cone = new THREE.Mesh(
      new THREE.CylinderGeometry(topR, baseR, h, 7),
      mat,
    );
    cone.position.set(0, h / 2, 0);
    cone.rotation.y = rand() * Math.PI;
    group.add(cone);
    halfW = baseR; halfH = h / 2; halfD = baseR;
  } else {
    // Layered ridge — 2 dodecahedrons offset and merged
    const sA = 4 + rand() * 4;
    const a = new THREE.Mesh(new THREE.DodecahedronGeometry(sA, 0), mat);
    a.position.set(0, sA * 0.4, 0);
    a.scale.set(1, 0.55 + rand() * 0.25, 1);
    a.rotation.y = rand() * Math.PI;
    group.add(a);

    const sB = 3 + rand() * 3;
    const b = new THREE.Mesh(new THREE.DodecahedronGeometry(sB, 0), mat);
    b.position.set(sA * 0.7 * (rand() < 0.5 ? -1 : 1), sB * 0.35, sA * 0.4 * (rand() < 0.5 ? -1 : 1));
    b.scale.set(1, 0.5 + rand() * 0.2, 1);
    b.rotation.y = rand() * Math.PI;
    group.add(b);

    halfW = sA + sB * 0.5; halfH = sA * 0.5; halfD = sA + sB * 0.5;
  }

  group.position.set(x, groundY, z);
  group.rotation.y = rand() * Math.PI * 2;
  if (isFar) group.userData.farFromOrigin = true;
  scene.add(group);

  group.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = !isFar;
      m.receiveShadow = true;
    }
  });

  makeStaticBox(
    world,
    { x: halfW, y: halfH, z: halfD },
    { x: group.position.x, y: group.position.y + halfH, z: group.position.z },
    getQuat(group),
  );
}

// Re-export so consumers can type the kind argument
export type { LandmarkKind, LoadedAsset };
