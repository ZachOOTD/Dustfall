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
import { Tuning } from '../config/tuning.ts';
import { findBiomeCentroid } from './biomes.ts';
import { createWoodGrainMaterial } from './woodGrainMaterial.ts';
import { BRANCH_WOOD_COLOR, BRANCH_WEATHER_LEVEL } from './branchMesh.ts';

// ACAE — aged-wood grain so trunk + tree-branches match the ground branches +
// the held branch (all one deadwood family). Shared instances. ACAF follow-up —
// the tree BRANCHES use the SHARED BRANCH_WOOD_COLOR so they're the exact same
// color as the held + ground branches; the vm scene now mirrors the world
// lighting (viewModel.ts) so held + dropped + tree all read identical. The trunk
// is a thicker, slightly lighter wood (its own member, not a "branch").
const _trunkMat = createWoodGrainMaterial(0xa39c91, {
  ringDensity: 6.0, weatherLevel: 0.72,
});
const _branchMat = createWoodGrainMaterial(BRANCH_WOOD_COLOR, {
  ringDensity: 9.0, weatherLevel: BRANCH_WEATHER_LEVEL,
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
  count = Tuning.DEAD_TREE_TARGET_COUNT,
): THREE.Group[] {
  const trees: THREE.Group[] = [];
  // AAO — was module-local const; lifted to Tuning.DEAD_TREE_FLATNESS_THRESHOLD
  // per CLAUDE.md rule 2.
  const FLATNESS_THRESHOLD = Tuning.DEAD_TREE_FLATNESS_THRESHOLD;
  const groveCount = Tuning.TREE_GROVE_COUNT;
  const perGrove = Tuning.TREE_PER_GROVE;
  const clusterRadius = Tuning.TREE_GROVE_CLUSTER_RADIUS;
  const minSep = Tuning.TREE_GROVE_MIN_SEPARATION;

  // Place a single dead tree at world (x, z) — shared between the two
  // passes below. Returns true if the placement attempt was accepted.
  const placeTreeAt = (x: number, z: number): boolean => {
    if (biomes.biomeAt(x, z) !== 'salt') return false;
    if (terrainFlatnessAt(terrain, x, z) > FLATNESS_THRESHOLD) return false;
    const groundY = terrain.heightAt(x, z);
    const tree = makeDeadTree(rand);
    tree.position.set(x, groundY - 0.05, z);
    tree.rotation.y = rand() * Math.PI * 2;
    tree.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; }
    });
    scene.add(tree);
    trees.push(tree);
    // AAO — branch count + ring radius lifted to Tuning. Span is
    // inclusive of MIN..MAX so the original 2..4 (3-value range) is
    // preserved when MIN=2, MAX=4.
    const minN = Tuning.DEAD_TREE_BRANCH_COUNT_MIN;
    const maxN = Tuning.DEAD_TREE_BRANCH_COUNT_MAX;
    const branchN = minN + Math.floor(rand() * (maxN - minN + 1));
    const ringMin = Tuning.DEAD_TREE_BRANCH_RING_RADIUS_MIN;
    const ringSpan = Tuning.DEAD_TREE_BRANCH_RING_RADIUS_MAX - ringMin;
    for (let b = 0; b < branchN; b++) {
      const a = rand() * Math.PI * 2;
      const r = ringMin + rand() * ringSpan;
      spawnBranchAt(scene, terrain, x + Math.cos(a) * r, z + Math.sin(a) * r, rand, branchList);
    }
    return true;
  };

  // JJ-2 — two-pass spawn so the dead-tree distribution reads as
  // organic (some trees clustered as groves around salt centroids,
  // others scattered uniformly across salt regions as lone trees).
  // Pass 1: dense groves at greedily-spaced salt centroids.
  const centroids: Array<{ x: number; z: number; radius: number }> = [];
  for (let g = 0; g < groveCount; g++) {
    const c = findBiomeCentroid(biomes, 'salt', { excludeCenters: centroids });
    if (!c) break;
    centroids.push({ x: c.x, z: c.z, radius: minSep });
    let placedHere = 0;
    const triesPerGrove = perGrove * 30;
    let attempts = 0;
    while (placedHere < perGrove && attempts < triesPerGrove && trees.length < count) {
      attempts++;
      const ang = rand() * Math.PI * 2;
      const r = Math.sqrt(rand()) * clusterRadius;  // sqrt → uniform area
      const x = c.x + Math.cos(ang) * r;
      const z = c.z + Math.sin(ang) * r;
      if (placeTreeAt(x, z)) placedHere++;
    }
  }

  // Pass 2: sporadic lone trees scattered uniformly across all salt
  // regions until we hit the target count. Reaches into salt regions
  // that didn't get a grove + adds randomness around the groves
  // themselves so the world doesn't read as "groves + nothing else".
  const RADIUS_MIN = Tuning.DEAD_TREE_SCATTER_RADIUS_MIN;
  const RADIUS_SPAN = Tuning.DEAD_TREE_SCATTER_RADIUS_MAX - RADIUS_MIN;
  const sporadicTries = (count - trees.length) * 30;
  let sporadicAttempts = 0;
  while (trees.length < count && sporadicAttempts < sporadicTries) {
    sporadicAttempts++;
    const radius = RADIUS_MIN + rand() * RADIUS_SPAN;
    const angle = rand() * Math.PI * 2;
    placeTreeAt(Math.cos(angle) * radius, Math.sin(angle) * radius);
  }
  return trees;
}
