// "Hero" landmarks — rare, hand-placed silhouettes that punctuate the desert.
// Stable seed positions so the player can learn the map. Most are sci-fi
// wrecks (Session S theme); a few are ribcage skeletons sprinkled in for
// atmospheric variety (the player liked them).

import * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';
import type { Rng } from '../core/rng.ts';
import type { Terrain } from './terrain.ts';
import { placeWreck, type WreckKind } from './wrecks.ts';
import { makeStaticBox } from '../physics/bodies.ts';
import { registerSalvageable, type SalvageableRegistry } from './salvage.ts';
import { addHorizonSilhouette } from './horizonSilhouettes.ts';   // M5a (C28) — skyline nav silhouettes
import { Tuning } from '../config/tuning.ts';

const _q = new THREE.Quaternion();
function getQuat(o: THREE.Object3D): { x: number; y: number; z: number; w: number } {
  o.getWorldQuaternion(_q);
  return { x: _q.x, y: _q.y, z: _q.z, w: _q.w };
}

// ────────────────────────────────────────────────────────────────
// Ribcage — large skeletal remains lying in the sand. Re-introduced
// because the silhouette reads great as ambient "something died here."
// ────────────────────────────────────────────────────────────────
export function placeRibcage(
  scene: THREE.Scene,
  world: RAPIER.World,
  pos: THREE.Vector3,
  rand: Rng,
  // ACAS A1 — re-parent the ribcage group into this object instead of the scene
  // (default: scene), so a dense field can collect + static-merge it.
  parent?: THREE.Object3D,
): void {
  const group = new THREE.Group();
  const boneColor = new THREE.Color().setHSL(0.10, 0.18, 0.55 + rand() * 0.12);
  const mat = new THREE.MeshLambertMaterial({ color: boneColor, flatShading: true });

  const spineLen = 3.5 + rand() * 2.0;
  const spine = new THREE.Mesh(
    new THREE.CylinderGeometry(0.10, 0.16, spineLen, 7),
    mat,
  );
  spine.rotation.z = Math.PI / 2; // along X
  spine.position.set(0, 0.18, 0);
  group.add(spine);

  // Ribs — half-torus arcs perpendicular to the spine.
  const ribCount = 6 + Math.floor(rand() * 3);
  for (let i = 0; i < ribCount; i++) {
    const t = (i + 0.5) / ribCount - 0.5;
    const ribX = t * spineLen;
    const ribR = (0.55 + rand() * 0.25) * (1 - Math.abs(t) * 0.5);
    const rib = new THREE.Mesh(
      new THREE.TorusGeometry(ribR, 0.05, 4, 14, Math.PI),
      mat,
    );
    rib.rotation.y = Math.PI / 2;
    rib.rotation.z = rand() * 0.1;
    rib.position.set(ribX, 0.05, 0);
    group.add(rib);
  }

  // Skull at one end — elongated icosahedron.
  const skull = new THREE.Mesh(new THREE.IcosahedronGeometry(0.32, 1), mat);
  skull.position.set(spineLen / 2 + 0.45, 0.3, 0);
  skull.scale.set(1.3, 0.85, 0.85);
  group.add(skull);

  group.position.copy(pos);
  group.position.y -= 0.2;
  group.rotation.y = rand() * Math.PI * 2;
  group.rotation.z = (rand() - 0.5) * 0.08;
  group.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; }
  });
  (parent ?? scene).add(group);

  makeStaticBox(
    world,
    { x: spineLen / 2 + 0.4, y: 0.4, z: 0.7 },
    { x: group.position.x, y: group.position.y + 0.3, z: group.position.z },
    getQuat(group),
  );
}

// ────────────────────────────────────────────────────────────────
// Public entry — mix of wrecks + ribcages around the ring
// ────────────────────────────────────────────────────────────────
// JJ — 'antenna_spire' dropped from hero-landmark rotation (per backlog
// "remove antenna tower landmarks"). The hand-placed `antenna_outpost`
// anchor POI in poi.ts still uses the spire mesh — that single one stays.
// 2026-07-09 (user request) — 'engine_bell' (a lone thruster) + 'engine_cluster'
// (a thruster + box) DROPPED from the scatter rotation: they're the earliest,
// weakest wreck reads and read as isolated engine props. Meshes + the WreckKind
// type stay (still valid salvage-panel flavors + deliberate structural uses); they
// just no longer spawn as standalone landmark wrecks. (Same pattern as the
// antenna_spire drop above.)
const HERO_WRECK_TYPES: ReadonlyArray<WreckKind> = [
  'fuselage',
  'cargo_container',
];
const RIBCAGE_PROBABILITY = 0.15;  // ribcages sprinkled in; most spots are wrecks

/** Returns the world positions of the bone carcasses (ribcages) placed — used
 *  by the ecology systems (vultures circle them; lizards/shrews gather at them). */
export function placeHeroLandmarks(
  scene: THREE.Scene,
  world: RAPIER.World,
  terrain: Terrain,
  rand: Rng,
  salvageables?: SalvageableRegistry,
): THREE.Vector3[] {
  const carcasses: THREE.Vector3[] = [];
  const minCount = Tuning.HERO_LANDMARK_COUNT_MIN;
  const maxCount = Tuning.HERO_LANDMARK_COUNT_MAX;
  const count = minCount + Math.floor(rand() * (maxCount - minCount + 1));
  const radiusMin = Tuning.HERO_LANDMARK_RADIUS_MIN;
  const radiusSpan = Tuning.HERO_LANDMARK_RADIUS_MAX - radiusMin;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + (rand() - 0.5) * 0.8;
    const radius = radiusMin + rand() * radiusSpan;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const y = terrain.heightAt(x, z);
    if (rand() < RIBCAGE_PROBABILITY) {
      placeRibcage(scene, world, new THREE.Vector3(x, y, z), rand);
      carcasses.push(new THREE.Vector3(x, y, z));
    } else {
      const kind = HERO_WRECK_TYPES[Math.floor(rand() * HERO_WRECK_TYPES.length)];
      const pos = new THREE.Vector3(x, y, z);
      const group = placeWreck(scene, world, terrain, pos, kind, rand, {
        // KK — antenna_spire retired; was the only kind needing a fixed
        // 1.0× scale. All current hero-landmark wreck kinds use the
        // randomised 0.9-1.2× range.
        scale: 0.9 + rand() * 0.3,
      });
      if (salvageables) registerSalvageable(salvageables, group, kind, pos, rand);
      // M5a (C28) — a fog-resistant skyline silhouette for this landmark (tall ones
      // only; addHorizonSilhouette filters by height). No rand draw → determinism-safe.
      addHorizonSilhouette(scene, new THREE.Box3().setFromObject(group));
    }
  }
  return carcasses;
}
