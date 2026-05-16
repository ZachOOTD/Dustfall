// Dead grey desert trees (Session W). Replaces the random ground-scatter
// branch spawn pattern — branches now spawn as 2-4 cluster around each
// tree's base, which reads as natural ("the tree shed these") instead of
// the previous "branches randomly strewn nowhere near any source".
//
// The trees themselves are non-interactable static props. They don't have
// physics colliders — they're visual cues for where branches live. Players
// can walk through them; the silhouette is what matters.

import * as THREE from 'three';
import type { Rng } from '../core/rng.ts';
import type { Terrain } from './terrain.ts';
import type { BiomeSampler } from './biomes.ts';
import type { Pickup } from '../pickups/pickups.ts';
import { spawnBranchAt } from '../pickups/pickups.ts';

const _trunkMat = new THREE.MeshLambertMaterial({
  color: 0x8a8278,
  flatShading: true,
});
const _branchMat = new THREE.MeshLambertMaterial({
  color: 0x6e685f,
  flatShading: true,
});

function makeDeadTree(rand: Rng): THREE.Group {
  const g = new THREE.Group();

  const trunkH = 2.4 + rand() * 1.2;
  const trunkR = 0.13 + rand() * 0.05;
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(trunkR * 0.55, trunkR, trunkH, 6),
    _trunkMat,
  );
  trunk.position.y = trunkH / 2;
  // Slight lean — old, weathered.
  trunk.rotation.z = (rand() - 0.5) * 0.18;
  trunk.rotation.x = (rand() - 0.5) * 0.12;
  g.add(trunk);

  // 3-5 diagonal stub branches off the upper trunk
  const branchCount = 3 + Math.floor(rand() * 3);
  for (let i = 0; i < branchCount; i++) {
    const len = 0.5 + rand() * 0.7;
    const r = trunkR * (0.4 + rand() * 0.25);
    const stub = new THREE.Mesh(
      new THREE.CylinderGeometry(r * 0.5, r, len, 5),
      _branchMat,
    );
    // Position part-way up the trunk (upper half), point diagonally outward
    const heightUp = trunkH * (0.45 + rand() * 0.5);
    const angle = rand() * Math.PI * 2;
    // Translate the geometry so the stub pivots at its base
    stub.geometry.translate(0, len / 2, 0);
    stub.position.set(
      Math.cos(angle) * trunkR * 0.6,
      heightUp,
      Math.sin(angle) * trunkR * 0.6,
    );
    // Rotate outward + slightly down (drooping)
    stub.rotation.z = -Math.cos(angle) * (Math.PI / 2.8 + rand() * 0.3);
    stub.rotation.x = Math.sin(angle) * (Math.PI / 2.8 + rand() * 0.3);
    g.add(stub);
  }

  return g;
}

/** Max |dY| across a 4-sample cross at radius `r`. Higher = steeper. */
function terrainFlatnessAt(terrain: Terrain, cx: number, cz: number, r = 1.5): number {
  const c = terrain.heightAt(cx, cz);
  return Math.max(
    Math.abs(terrain.heightAt(cx + r, cz) - c),
    Math.abs(terrain.heightAt(cx - r, cz) - c),
    Math.abs(terrain.heightAt(cx, cz + r) - c),
    Math.abs(terrain.heightAt(cx, cz - r) - c),
  );
}

/** Spawn dead trees scattered across the SALT-FLATS biome only, on
 *  roughly-flat ground. Each tree drops 2-4 branch pickups within a
 *  1.5-3m ring at its base. Branches are appended to `branchList` so the
 *  caller (main.ts) folds them into ctx.pickups. CC-4 restricted trees
 *  from any-biome to salt-only so the lake-bed reads as the only place
 *  where stuff used to live (and died). */
export function spawnDeadTrees(
  scene: THREE.Scene,
  terrain: Terrain,
  rand: Rng,
  branchList: Pickup[],
  biomes: BiomeSampler,
  count = 12,
): THREE.Group[] {
  const trees: THREE.Group[] = [];
  const MAX_ATTEMPTS = count * 25;
  const FLATNESS_THRESHOLD = 0.7;
  let attempts = 0;
  while (trees.length < count && attempts < MAX_ATTEMPTS) {
    attempts++;
    const radius = 20 + rand() * 200;
    const angle = rand() * Math.PI * 2;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    if (biomes.biomeAt(x, z) !== 'salt') continue;
    if (terrainFlatnessAt(terrain, x, z) > FLATNESS_THRESHOLD) continue;
    const groundY = terrain.heightAt(x, z);

    const tree = makeDeadTree(rand);
    tree.position.set(x, groundY - 0.05, z);
    tree.rotation.y = rand() * Math.PI * 2;
    tree.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });
    scene.add(tree);
    trees.push(tree);

    // Drop 2-4 branches in a ring at the base.
    const branchN = 2 + Math.floor(rand() * 3);
    for (let b = 0; b < branchN; b++) {
      const a = rand() * Math.PI * 2;
      const r = 1.5 + rand() * 1.5;
      const bx = x + Math.cos(a) * r;
      const bz = z + Math.sin(a) * r;
      spawnBranchAt(scene, terrain, bx, bz, rand, branchList);
    }
  }
  return trees;
}
