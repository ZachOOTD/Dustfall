// Dune buried cockpit POI (Session ABJ — Tier 4 A4).
//
// Hand-modeled flagship-scale POI placed in dune-biome centroids — a
// half-buried cockpit module tilted forward, with an exposed canopy
// section showing a cracked glass window. Reads as "this pod made it
// down but the pilot didn't get out." First of the planned biome-
// specific POI family (salt outpost + rocky entrance deferred to
// future sessions per scope-cut tier).
//
// Composition:
//   - Cockpit hull: IcosahedronGeometry (BULBOUS template from
//     procgenWreck.ts cockpit variant 3). Hand-coded, not via that
//     module, because we want fixed orientation + bury depth + glass
//     window detail that don't fit the procgen part-assembly contract.
//   - Tilted 28° forward + buried 60% Y into the sand.
//   - Cracked canopy: small glass dome with createGlassMaterial
//     (frost + dust layer + edge highlights).
//   - Salvage panel: 'escape_pod' kind (medical loot palette — pilot
//     had a med kit) attached to the exposed flank.
//   - Debris ring: 3-5 small hull fragments at 3-8m radius via
//     placeDebrisField.
//
// Placement: 1 per dune-biome region via findBiomeCentroid. Player-
// spawn exclusion preserved. Reads alongside existing flagships, not
// counted toward Tuning.FLAGSHIP_COUNT.

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
import { createGlassMaterial } from './glassMaterial.ts';
import { addAccessPanel, placeDebrisField } from './wrecks.ts';

const _hullMat = createMetalMaterial(0x5a4f44, { wornScale: 5.0, scratchStrength: 0.04 });
const _frameMat = new THREE.MeshLambertMaterial({ color: 0x282420, flatShading: true });
const _glassMat = createGlassMaterial(0x4a6068, {
  frostLevel: 0.85,        // heavy frost — old, sand-blasted
  edgeHighlight: 0.5,
  dustLayer: 0.7,
  opacity: 0.45,
});

/** Place a dune buried cockpit at the given world position. Returns
 *  the placed group root. */
export function placeBuriedCockpit(
  scene: THREE.Scene,
  world: RAPIER.World,
  terrain: Terrain,
  pos: THREE.Vector3,
  rand: Rng,
  salvageables: SalvageableRegistry | undefined,
): THREE.Group {
  const root = new THREE.Group();
  root.position.copy(pos);

  // Cockpit hull — icosahedron at ~1.2m radius (matches procgenWreck
  // BULBOUS variant range). Slightly perturbed for "torn-impact" feel.
  const r = 1.2;
  const hullGeom = new THREE.IcosahedronGeometry(r, 1);
  // Hand-perturb a few vertices outward for a "battered" silhouette
  // without importing perturbOutward (would add dep). Small displacements.
  const pos3 = hullGeom.attributes.position;
  for (let i = 0; i < pos3.count; i++) {
    const x = pos3.getX(i), y = pos3.getY(i), z = pos3.getZ(i);
    const len = Math.hypot(x, y, z);
    const factor = 1 + (rand() - 0.5) * 0.08;
    pos3.setXYZ(i, x / len * (len * factor), y / len * (len * factor), z / len * (len * factor));
  }
  hullGeom.computeVertexNormals();
  const hull = new THREE.Mesh(hullGeom, _hullMat);
  hull.castShadow = true;
  hull.receiveShadow = true;
  root.add(hull);

  // Cracked canopy — a small dome on the +X+Y side (the "windshield"
  // facing forward-up). Two layers: a hull frame ring (dark metal) +
  // the glass dome inside.
  const canopyGroup = new THREE.Group();
  canopyGroup.position.set(r * 0.55, r * 0.55, 0);
  canopyGroup.rotation.z = -0.5;       // angle the glass forward + up
  root.add(canopyGroup);

  // Frame ring around the canopy opening
  const frameTorus = new THREE.Mesh(
    new THREE.TorusGeometry(r * 0.42, 0.05, 6, 16),
    _frameMat,
  );
  frameTorus.rotation.x = Math.PI / 2;
  canopyGroup.add(frameTorus);

  // Glass dome — Lathe sweep of a curved cross-section (top half of an
  // ellipse). Frost + dust + edge-highlight gives the "old window" feel.
  const domePts: THREE.Vector2[] = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    const x = Math.sin(t * Math.PI / 2) * r * 0.40;
    const y = Math.cos(t * Math.PI / 2) * r * 0.25;
    domePts.push(new THREE.Vector2(x, y));
  }
  const domeGeom = new THREE.LatheGeometry(domePts, 12);
  const dome = new THREE.Mesh(domeGeom, _glassMat);
  dome.castShadow = false;
  canopyGroup.add(dome);

  // "Crack" detail — 2-3 thin dark lines across the glass face, suggesting
  // the canopy fractured on impact. Use thin TubeGeometry along catmull
  // curves on the dome surface.
  const crackMat = new THREE.MeshLambertMaterial({
    color: 0x14110e, transparent: true, opacity: 0.85, flatShading: true,
  });
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + rand() * 0.5;
    const start = new THREE.Vector3(0, r * 0.24, 0);
    const end = new THREE.Vector3(
      Math.cos(a) * r * 0.38,
      r * 0.08,
      Math.sin(a) * r * 0.38,
    );
    const mid = new THREE.Vector3(
      (start.x + end.x) * 0.5 + (rand() - 0.5) * 0.08,
      (start.y + end.y) * 0.5 + 0.02,
      (start.z + end.z) * 0.5 + (rand() - 0.5) * 0.08,
    );
    const curve = new THREE.CatmullRomCurve3([start, mid, end]);
    const crack = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 6, 0.007, 3, false),
      crackMat,
    );
    canopyGroup.add(crack);
  }

  // Antenna stub — broken, sticking up at an angle from the top.
  if (rand() < 0.7) {
    const stub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.06, 0.9 + rand() * 0.4, 6),
      _frameMat,
    );
    stub.position.set(-r * 0.2, r * 1.05, r * 0.4);
    stub.rotation.z = 0.6 + (rand() - 0.5) * 0.3;
    stub.castShadow = true;
    root.add(stub);
  }

  // Tilt forward 28° + slight roll for crash-landing feel. Order matters
  // since we compose multiple rotations; use a single Euler.
  root.rotation.set(
    -0.10,                       // slight back-pitch
    rand() * Math.PI * 2,        // random yaw
    0.49,                        // ~28° forward tilt (positive Z rotation = nose down)
  );

  // Bury 60% of the hull into the sand. Hull center is at root.position;
  // pull down by r * 1.2 so most of the body sits below terrain.
  root.position.y -= r * 1.2;

  // Salvage panel — escape_pod palette (medical loot) on the -X flank
  // (opposite side from the canopy, easier to approach on foot).
  addAccessPanel(
    root,
    -r * 1.05, r * 0.40, 0,
    1,
    // ACP bugfix — faceYaw maps local +Z → (sin yaw, 0, cos yaw); for the
    // panel to face -X (outward from this -X flank) that is -π/2, NOT π.
    // π made the door face -Z and the cavity recess PARALLEL to the flank →
    // interior clipped through the hull. (cf. saltOutpost's +X flank = +π/2.)
    -Math.PI / 2,    // facing -X
    'escape_pod',
  );

  // Shadow flags for the whole group.
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && m.material !== _glassMat) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });

  scene.add(root);
  attachCompoundCollider(world, root);

  // Register the salvage panel.
  if (salvageables) {
    const wp = new THREE.Vector3();
    root.updateWorldMatrix(true, false);
    root.traverse((o) => {
      const panel = o.userData.accessPanel;
      if (panel) {
        o.updateWorldMatrix(true, false);
        wp.setFromMatrixPosition(o.matrixWorld);
        registerSalvageable(salvageables, o, 'escape_pod', wp, rand);
      }
    });
  }

  // Debris ring — 4-6 small hull fragments at 3-8m. Reuses
  // placeDebrisField (existing utility).
  placeDebrisField(scene, terrain, pos, 6.0, rand, 4 + Math.floor(rand() * 3));

  return root;
}

/** Sample dune-biome centroid positions for buried cockpits. Excludes
 *  player spawn + existing flagships. Returns up to `count` positions.
 *  Uses findBiomeCentroid with greedy excludeCenters for multi-instance
 *  spread across separate dune regions. */
export function sampleBuriedCockpitPositions(
  biomes: BiomeSampler,
  excludeCenters: ReadonlyArray<{ x: number; z: number; radius: number }>,
  count = 1,
): Array<{ x: number; z: number }> {
  const results: Array<{ x: number; z: number }> = [];
  // Excluding self + existing flagships at radius matching the standard
  // POI_MIN_SEPARATION so we don't crowd a flagship.
  const excludes: Array<{ x: number; z: number; radius: number }> = [...excludeCenters];
  // Player spawn exclusion uses the existing FLAGSHIP_SPAWN_EXCLUSION_RADIUS.
  excludes.push({
    x: Tuning.OPENING_SCENE_ANCHOR_X,
    z: Tuning.OPENING_SCENE_ANCHOR_Z,
    radius: Tuning.FLAGSHIP_SPAWN_EXCLUSION_RADIUS,
  });
  for (let i = 0; i < count; i++) {
    const c = findBiomeCentroid(biomes, 'dune', { excludeCenters: excludes });
    if (!c) break;
    results.push(c);
    excludes.push({ x: c.x, z: c.z, radius: Tuning.POI_MIN_SEPARATION });
  }
  return results;
}
