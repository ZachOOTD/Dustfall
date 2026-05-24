// Salt corroded scientific outpost POI (Session ABK — A4 continuation).
//
// Second of the planned biome-specific POI family (ABJ shipped the
// dune buried cockpit; ABK adds salt outpost + rocky entrance). Placed
// at salt-biome centroids via findBiomeCentroid + greedy multi-region
// exclusion. Reads as "abandoned scientific research outpost — the
// salt flats ate the equipment but left enough to salvage."
//
// Composition:
//   - Concrete base slab (half-buried, weathered) using ABH stoneMaterial.
//   - Corroded antenna spire (with crossbar) using ABH metalMaterial.
//   - 2-3 sample crates around the base (painted-metal shader; rust
//     bleeds through chipped paint per ABH paintMaterial).
//   - 1 salvage panel ('cargo_container' kind — lottery loot fits
//     research-outpost mixed cargo).
//   - Small debris ring (2-3 fragments at 2-5m).
//
// Placement: 1 per salt-biome region via findBiomeCentroid + 200m
// FLAGSHIP_SPAWN_EXCLUSION_RADIUS from spawn + POI_MIN_SEPARATION
// from existing flagships.

import * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';
import type { Rng } from '../core/rng.ts';
import type { Terrain } from './terrain.ts';
import type { BiomeSampler } from './biomes.ts';
import { findBiomeCentroid } from './biomes.ts';
import type { SalvageableRegistry } from './salvage.ts';
import { registerSalvageable } from './salvage.ts';
import { attachCompoundCollider } from '../physics/bodies.ts';
import { Tuning } from '../config/tuning.ts';
import { createMetalMaterial } from './metalMaterial.ts';
import { createStoneMaterial } from './stoneMaterial.ts';
import { createPaintedMetalMaterial } from './paintMaterial.ts';
import { addAccessPanel, placeDebrisField } from './wrecks.ts';

// Concrete base — light grey, heavy weathering (salt-corroded). Crack
// density high to read as "old, hot-cold cycled". Dust strength low
// (salt-flat surface is windswept clean, not desert-dusty).
const _baseMat = createStoneMaterial(0x9a9388, {
  crackDensity: 0.75,
  dustStrength: 0.25,
});
// Antenna spire — rust-mottled metal.
const _spireMat = createMetalMaterial(0x6e5a4c, {
  wornScale: 6.0,
  scratchStrength: 0.05,
});
// Corroded paint on the sample crates — heavy chipping reveals rust
// substrate. High wearLevel (≥0.7) gives the "long-exposed" reading.
const _crateMat = createPaintedMetalMaterial(0x8a5538, {
  wearLevel: 0.75,
});
// Dark frame / brackets — flat-shaded metal for joinery accents.
const _frameMat = new THREE.MeshLambertMaterial({
  color: 0x2e2820, flatShading: true,
});

/** Place a salt scientific outpost at the given world position. */
export function placeSaltOutpost(
  scene: THREE.Scene,
  world: RAPIER.World,
  terrain: Terrain,
  pos: THREE.Vector3,
  rand: Rng,
  salvageables: SalvageableRegistry | undefined,
): THREE.Group {
  const root = new THREE.Group();
  root.position.copy(pos);

  // ── 1. Concrete base slab — half-buried, weathered. ────────────────
  const baseW = 3.2;     // outpost footprint
  const baseD = 2.4;
  const baseH = 1.0;
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(baseW, baseH, baseD),
    _baseMat,
  );
  base.position.y = baseH * 0.35;   // half-buried
  base.castShadow = true;
  base.receiveShadow = true;
  root.add(base);

  // Step lip on the +Z side — small ledge suggesting an entrance pad.
  const lip = new THREE.Mesh(
    new THREE.BoxGeometry(baseW * 0.6, 0.10, 0.5),
    _baseMat,
  );
  lip.position.set(0, baseH * 0.85, baseD * 0.5 - 0.05);
  root.add(lip);

  // ── 2. Antenna spire — tall slim cylinder atop the base. ───────────
  const spireH = 4.5;
  const spireBaseY = baseH * 0.85;       // top of base
  const spire = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.10, spireH, 8),
    _spireMat,
  );
  spire.position.set(-baseW * 0.3, spireBaseY + spireH / 2, 0);
  spire.castShadow = true;
  root.add(spire);
  // Spire crossbar
  const crossbar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.04, 1.1, 6),
    _spireMat,
  );
  crossbar.rotation.z = Math.PI / 2;
  crossbar.position.set(-baseW * 0.3, spireBaseY + spireH * 0.78, 0);
  root.add(crossbar);
  // Small dish at top of spire — angled down at 30° (broken-pointing
  // posture). Lathe a shallow parabolic profile.
  const dishR = 0.45;
  const dishPts: THREE.Vector2[] = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    dishPts.push(new THREE.Vector2(t * dishR, -t * t * 0.15));
  }
  const dishGeom = new THREE.LatheGeometry(dishPts, 12);
  const dish = new THREE.Mesh(
    dishGeom,
    new THREE.MeshLambertMaterial({
      color: 0x7a6e60, side: THREE.DoubleSide, flatShading: true,
    }),
  );
  dish.position.set(-baseW * 0.3, spireBaseY + spireH * 0.98, 0);
  dish.rotation.z = -0.5;       // angled down + sideways
  root.add(dish);

  // ── 3. 2-3 sample crates around the base. ──────────────────────────
  const crateCount = 2 + Math.floor(rand() * 2);   // 2-3
  for (let i = 0; i < crateCount; i++) {
    // Position crates in a loose arc on the +Z side of the base.
    const a = (i / crateCount) * Math.PI - Math.PI / 2 + (rand() - 0.5) * 0.4;
    const r = 1.6 + rand() * 0.6;
    const cx = Math.cos(a) * r;
    const cz = Math.sin(a) * r + baseD * 0.4;     // bias outward
    const cy = terrain.heightAt(pos.x + cx, pos.z + cz) - pos.y;
    const crateW = 0.50 + rand() * 0.20;
    const crateH = 0.40 + rand() * 0.15;
    const crateD = 0.45 + rand() * 0.18;
    const crate = new THREE.Mesh(
      new THREE.BoxGeometry(crateW, crateH, crateD),
      _crateMat,
    );
    crate.position.set(cx, cy + crateH * 0.5 - 0.05, cz);
    crate.rotation.y = rand() * Math.PI * 2;
    crate.rotation.z = (rand() - 0.5) * 0.15;
    crate.castShadow = true;
    crate.receiveShadow = true;
    root.add(crate);
    // Metal banding on top (across the lid)
    const band = new THREE.Mesh(
      new THREE.BoxGeometry(crateW * 0.18, 0.04, crateD * 0.95),
      _frameMat,
    );
    band.position.copy(crate.position);
    band.position.y = crate.position.y + crateH * 0.50;
    band.rotation.y = crate.rotation.y;
    root.add(band);
  }

  // ── 4. Salvage panel on the base's +X face. ────────────────────────
  addAccessPanel(
    root,
    baseW / 2, baseH * 0.55, baseD * 0.20,
    1,
    Math.PI / 2,           // facing +X
    'cargo_container',
  );

  // ── 5. Shadow flags + scene + collider. ────────────────────────────
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });
  scene.add(root);
  attachCompoundCollider(world, root);

  // ── 6. Register salvageable (walk for the panel). ──────────────────
  if (salvageables) {
    const wp = new THREE.Vector3();
    root.updateWorldMatrix(true, false);
    root.traverse((o) => {
      const panel = o.userData.accessPanel;
      if (panel) {
        o.updateWorldMatrix(true, false);
        wp.setFromMatrixPosition(o.matrixWorld);
        registerSalvageable(salvageables, o, 'cargo_container', wp, rand);
      }
    });
  }

  // ── 7. Debris scatter — small 2-3 fragments at 3-5m. ───────────────
  placeDebrisField(scene, terrain, pos, 4.0, rand, 2 + Math.floor(rand() * 2));

  return root;
}

/** Sample salt-biome centroid positions for salt outposts. Excludes
 *  player spawn + existing flagships. Same greedy multi-region pattern
 *  as sampleBuriedCockpitPositions (ABJ A4). */
export function sampleSaltOutpostPositions(
  biomes: BiomeSampler,
  excludeCenters: ReadonlyArray<{ x: number; z: number; radius: number }>,
  count = 1,
): Array<{ x: number; z: number }> {
  const results: Array<{ x: number; z: number }> = [];
  const excludes: Array<{ x: number; z: number; radius: number }> = [...excludeCenters];
  excludes.push({
    x: Tuning.OPENING_SCENE_ANCHOR_X,
    z: Tuning.OPENING_SCENE_ANCHOR_Z,
    radius: Tuning.FLAGSHIP_SPAWN_EXCLUSION_RADIUS,
  });
  for (let i = 0; i < count; i++) {
    const c = findBiomeCentroid(biomes, 'salt', { excludeCenters: excludes });
    if (!c) break;
    results.push(c);
    excludes.push({ x: c.x, z: c.z, radius: Tuning.POI_MIN_SEPARATION });
  }
  return results;
}
