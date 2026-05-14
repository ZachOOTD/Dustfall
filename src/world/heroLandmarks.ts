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
  scene.add(group);

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
const HERO_WRECK_TYPES: ReadonlyArray<WreckKind> = [
  'engine_cluster',
  'fuselage',
  'escape_pod',
  'cargo_container',
  'antenna_spire',
  'engine_bell',
];
const RIBCAGE_PROBABILITY = 0.15;  // ribcages sprinkled in; most spots are wrecks

export function placeHeroLandmarks(
  scene: THREE.Scene,
  world: RAPIER.World,
  terrain: Terrain,
  rand: Rng,
): void {
  const count = 7 + Math.floor(rand() * 3); // 7-9
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + (rand() - 0.5) * 0.8;
    const radius = 70 + rand() * 180;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const y = terrain.heightAt(x, z);
    if (rand() < RIBCAGE_PROBABILITY) {
      placeRibcage(scene, world, new THREE.Vector3(x, y, z), rand);
    } else {
      const kind = HERO_WRECK_TYPES[Math.floor(rand() * HERO_WRECK_TYPES.length)];
      placeWreck(scene, world, terrain, new THREE.Vector3(x, y, z), kind, rand, {
        scale: kind === 'antenna_spire' ? 1.0 : 0.9 + rand() * 0.3,
      });
    }
  }
}
