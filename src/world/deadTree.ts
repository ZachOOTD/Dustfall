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
import { BRANCH_WOOD_COLOR, BRANCH_WEATHER_LEVEL, buildBranchMesh } from './branchMesh.ts';

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

// Module scratch (avoid per-tree allocation in the orientation math).
const _LIMB_X = new THREE.Vector3(1, 0, 0);
const _limbDir = new THREE.Vector3();
const _limbInward = new THREE.Vector3();

// ACAF f/u 5 — proper dead-desert-tree model. The trunk is a tapered, gently
// bowed cylinder with a root flare; the limbs reuse the detailed branch model
// (buildBranchMesh — same taper + emergent twigs as the held/ground branches),
// each EMERGING FROM the trunk surface (base embedded, collar-blended) so
// nothing floats. Replaces the old "straight cylinders" read.
function makeDeadTree(rand: Rng): THREE.Group {
  const g = new THREE.Group();

  const trunkH = 1.8 + rand() * 0.9;     // shorter overall (was 2.6+)
  const baseR = 0.085 + rand() * 0.03;   // slimmer trunk (was 0.15+) — desert deadwood is lean
  const topR = baseR * 0.16;             // taper the trunk to a thin POINT at the tip (like a branch)

  // Trunk centerline lean (a parabolic bow in a random azimuth) + per-height
  // radius — shared by the trunk geometry AND the limb attach math so limbs sit
  // exactly on the (bowed, tapered) surface.
  const leanDir = rand() * Math.PI * 2;
  const lbx = Math.cos(leanDir), lbz = Math.sin(leanDir);
  const bowMag = trunkH * (0.05 + rand() * 0.06);
  const leanAt = (h: number) => bowMag * Math.pow(h / trunkH, 2);   // 0 at base → bowMag at top
  const radiusAt = (h: number) => baseR + (topR - baseR) * (h / trunkH);

  // Tapered trunk, 10 radial segments (round, not faceted), bow baked in.
  const trunkGeo = new THREE.CylinderGeometry(topR, baseR, trunkH, 10, 10);
  trunkGeo.translate(0, trunkH / 2, 0);   // base at y=0
  const tp = trunkGeo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < tp.count; i++) {
    const y = tp.getY(i);
    const lean = leanAt(y);
    tp.setX(i, tp.getX(i) + lbx * lean);
    tp.setZ(i, tp.getZ(i) + lbz * lean);
  }
  trunkGeo.computeVertexNormals();
  const trunk = new THREE.Mesh(trunkGeo, _trunkMat);
  g.add(trunk);

  // Root flare — a short, subtle widening at the base so the trunk doesn't read
  // as a pole stuck in the ground (kept modest — a big skirt reads as a trumpet).
  const flareH = trunkH * 0.06;
  const flare = new THREE.Mesh(
    new THREE.CylinderGeometry(baseR, baseR * 1.32, flareH, 10),
    _trunkMat,
  );
  flare.position.y = flareH / 2;
  g.add(flare);

  // 3-4 main limbs, DISTRIBUTED so they don't pile up: each limb gets its own
  // height band (staggered up the trunk) AND its own azimuth sector (even split
  // + jitter) so no two cluster on the same side at the same height.
  const limbCount = 3 + Math.floor(rand() * 2);   // 3-4 (was 4-6, too crowded)
  const azStart = rand() * Math.PI * 2;
  const hLo = 0.45, hHi = 0.78;                    // limbs in the upper trunk but BELOW the thin tapered tip
  for (let i = 0; i < limbCount; i++) {
    // Staggered height: i-th band + a little jitter within the band.
    const frac = (i + 0.5 + (rand() - 0.5) * 0.6) / limbCount;
    const h = trunkH * (hLo + frac * (hHi - hLo));
    // Even azimuth sector + jitter (golden-ish offset so consecutive limbs face
    // away from each other rather than bunching).
    const az = azStart + i * (Math.PI * 2 / limbCount) + (rand() - 0.5) * 0.7;
    const pitch = 0.5 + rand() * 0.5;      // upward tilt (rad above horizontal)
    const cp = Math.cos(pitch);
    _limbDir.set(Math.cos(az) * cp, Math.sin(pitch), Math.sin(az) * cp).normalize();

    const limbLen = 0.4 + rand() * 0.45;   // shorter limbs (was 0.6+0.7)
    const rScale = 0.7 + rand() * 0.3;     // thinner limbs (was 1.2+, too chunky)
    const limb = buildBranchMesh(_branchMat, {
      len: limbLen, twigs: 1 + Math.floor(rand() * 2), rand,
      radiusScale: rScale, tipRatio: 0.32,
    });
    // buildBranchMesh puts the THICK base at +X and the THIN tip at −X. So orient
    // the limb's +X axis INWARD (toward the trunk) — then the thin tip points
    // OUTWARD and the limb tapers trunk→tip the CORRECT way. (Orienting +X
    // outward, as before, made the limbs fatten toward the tip — backwards.)
    const limbBaseR = limbLen * 0.05 * rScale;
    const rH = radiusAt(h);
    _limbInward.copy(_limbDir).multiplyScalar(-1);
    // Shift so the thick base sits just inside the trunk surface (buried ~0.6·rH)
    // and the tapering limb emerges outward; the flat base cap never shows.
    limb.position.x = -limbLen * 0.5 + rH * 0.6;

    const wrap = new THREE.Group();
    wrap.add(limb);
    wrap.quaternion.setFromUnitVectors(_LIMB_X, _limbInward);
    // Origin on the trunk surface (outward radial); the buried base spans inward
    // from here, so the limb grows OUT of solid wood.
    wrap.position.set(
      lbx * leanAt(h) + Math.cos(az) * rH * 0.85,
      h,
      lbz * leanAt(h) + Math.sin(az) * rH * 0.85,
    );
    g.add(wrap);

    // Collar — a small ELLIPSOID (flattened sphere) hugging the trunk surface to
    // blend the junction as a natural branch swelling, not a round ball.
    const collar = new THREE.Mesh(new THREE.SphereGeometry(limbBaseR * 1.05, 8, 6), _trunkMat);
    collar.scale.set(1, 1, 0.6);
    collar.position.copy(wrap.position);
    g.add(collar);
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
