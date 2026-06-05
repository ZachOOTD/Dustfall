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
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// ACAF f/u 12 — ONE shared material for the whole tree (trunk + every branch are
// one continuous merged mesh now). Same BRANCH_WOOD_COLOR as the held/ground
// branches so the deadwood family stays unified. localSpace so the bark samples
// in the tree's OWN frame (Y = vertical) — clean vertical fibers + avoids the
// world-space noise precision loss for trees far from the origin.
const _treeMat = createWoodGrainMaterial(BRANCH_WOOD_COLOR, {
  ringDensity: 7.0, weatherLevel: BRANCH_WEATHER_LEVEL, bark: 0.34, grainStrength: 0.12, localSpace: true,
});

const _UP = new THREE.Vector3(0, 1, 0);
const _SIDE_REF = new THREE.Vector3(1, 0, 0);

/** One tapered branch segment as a geometry: a cylinder along +Y (base at y=0,
 *  tip at y=len), with a parabolic bow baked in so it sweeps to one side — the
 *  source of the gnarled/organic curve. */
function makeSegmentGeo(len: number, rBase: number, rTip: number, bow: number, bowAng: number): THREE.BufferGeometry {
  const geo = new THREE.CylinderGeometry(Math.max(rTip, 0.004), rBase, len, 6, 3);
  geo.translate(0, len / 2, 0);
  const ca = Math.cos(bowAng), sa = Math.sin(bowAng);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const t = pos.getY(i) / len;              // 0 at base → 1 at tip
    const off = bow * t * t;                  // parabola: straight at base, sweeps near tip
    pos.setX(i, pos.getX(i) + ca * off);
    pos.setZ(i, pos.getZ(i) + sa * off);
  }
  geo.computeVertexNormals();
  return geo;
}

/** Tilt a unit direction by `angle`, around an axis perpendicular to it chosen
 *  by `azimuth` — used to fork child branches away from the parent. */
function tiltDir(dir: THREE.Vector3, angle: number, azimuth: number): THREE.Vector3 {
  const ref = Math.abs(dir.y) < 0.95 ? _UP : _SIDE_REF;
  const axis = new THREE.Vector3().crossVectors(dir, ref).normalize().applyAxisAngle(dir, azimuth);
  return dir.clone().applyAxisAngle(axis, angle).normalize();
}

// ACAF f/u 12 — RECURSIVE branching dead tree (modelled on Deadvlei camelthorn
// references): a bole that FORKS into 2-3 limbs, each forking again 3-4 levels
// deep into a spreading crown of fine, gnarled, upward-reaching branches, plus
// buttress roots flaring at the base. Every segment is a tapered, bowed cylinder;
// all segments merge into ONE geometry per tree (1 draw call) for perf (45 trees).
function makeDeadTree(rand: Rng): THREE.Group {
  const g = new THREE.Group();
  const segs: THREE.BufferGeometry[] = [];

  const baseR = 0.095 + rand() * 0.035;
  const boleLen = (2.2 + rand() * 1.0) * 0.52;     // first trunk segment before the fork

  const _q = new THREE.Quaternion();
  const _m = new THREE.Matrix4();
  const _s = new THREE.Vector3(1, 1, 1);

  // Recursively grow a branch from `base` along `dir`, forking at its tip.
  const grow = (base: THREE.Vector3, dir: THREE.Vector3, len: number, rBase: number, depth: number): void => {
    const rTip = rBase * (0.64 + rand() * 0.1);
    const bow = len * (0.11 + rand() * 0.16);       // stronger sweep = more gnarl
    const bowAng = rand() * Math.PI * 2;
    const geo = makeSegmentGeo(len, rBase, rTip, bow, bowAng);
    _q.setFromUnitVectors(_UP, dir);
    _m.compose(base, _q, _s);
    geo.applyMatrix4(_m);
    segs.push(geo);

    // Curved tip (local (bow·cos, len, bow·sin) through the same transform).
    const tip = new THREE.Vector3(Math.cos(bowAng) * bow, len, Math.sin(bowAng) * bow).applyMatrix4(_m);
    if (depth <= 0 || rTip < 0.011) return;

    // Main structure (high depth) forks 2-3 ways; fine twigs (low depth) fork
    // sparingly (mostly 1, sometimes 2) so the tips stay sparse like the refs.
    const childCount = depth >= 3
      ? 2 + (rand() < 0.3 ? 1 : 0)
      : 1 + (rand() < 0.18 ? 1 : 0);
    for (let c = 0; c < childCount; c++) {
      // Wider divergence at the main fork (high depth), tighter toward the tips.
      const spread = 0.4 + rand() * 0.5 + (depth >= 3 ? 0.25 : 0);
      const azimuth = (c / childCount) * Math.PI * 2 + rand() * 1.1;
      const cd = tiltDir(dir, spread, azimuth);
      cd.lerp(_UP, 0.08 + rand() * 0.14).normalize();  // gentle upward reach (less = wider crown)
      grow(tip, cd, len * (0.6 + rand() * 0.16), rTip, depth - 1);
    }
  };

  // Trunk bole — straight-ish, slight lean — then the recursion forks it.
  const startDir = tiltDir(_UP, 0.05 + rand() * 0.12, rand() * Math.PI * 2);
  grow(new THREE.Vector3(0, 0, 0), startDir, boleLen, baseR, 5);   // 5 levels → finer twig tips

  // Buttress roots — short curved segments flaring outward (+ slightly down) from
  // the base, like the wide camelthorn root structures.
  const rootN = 4 + Math.floor(rand() * 3);
  for (let i = 0; i < rootN; i++) {
    const az = (i / rootN) * Math.PI * 2 + (rand() - 0.5) * 0.6;
    const dir = new THREE.Vector3(Math.cos(az), -0.45 - rand() * 0.3, Math.sin(az)).normalize();
    const len = baseR * (3.0 + rand() * 2.0);
    const rb = baseR * (0.55 + rand() * 0.25);
    const geo = makeSegmentGeo(len, rb, rb * 0.35, len * (0.4 + rand() * 0.3), rand() * Math.PI * 2);
    _q.setFromUnitVectors(_UP, dir);
    _m.compose(new THREE.Vector3(0, baseR * 1.1, 0), _q, _s);
    geo.applyMatrix4(_m);
    segs.push(geo);
  }

  const merged = mergeGeometries(segs, false);
  segs.forEach((s) => s.dispose());
  g.add(new THREE.Mesh(merged, _treeMat));
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
    tree.name = 'deadTree';   // so the rig-shot `tree` scenario can locate one
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
