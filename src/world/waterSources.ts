// World water sources — abandoned wells, scattered with a salt-biome quota.
// The player aims at one and presses E with a non-full canteen to refill.
//
// Registered in `ctx.waterSources.list`. Tagged via userData.interactType/Id
// so the interaction raycast finds them.

import * as THREE from 'three';
import type { Rng } from '../core/rng.ts';
import type { Terrain } from '../world/terrain.ts';
import type { BiomeSampler } from './biomes.ts';

export type WaterSourceKind = 'well';

export interface WaterSource {
  id: number;
  kind: WaterSourceKind;
  mesh: THREE.Object3D;
  pos: THREE.Vector3;
  hovered: boolean;
}

let _nextId = 1;

function tag(root: THREE.Object3D, id: number): void {
  root.traverse((o) => {
    o.userData.interactType = 'refill';
    o.userData.interactId = id;
    o.userData.interactRegistry = 'waterSources';
  });
}

function makeWell(_rand: Rng): THREE.Group {
  const g = new THREE.Group();
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x5a4a3a, roughness: 0.95 });
  // Ring (TorusGeometry flat) + inner dark hole disc.
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.75, 0.18, 6, 16),
    stoneMat,
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.4;
  g.add(ring);

  // Stone wall blocks — 6 small box rings making it look constructed
  const blockMat = new THREE.MeshStandardMaterial({ color: 0x6a5a48, roughness: 0.95 });
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * Math.PI * 2;
    const block = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.14, 0.20), blockMat);
    block.position.set(Math.cos(ang) * 0.72, 0.27, Math.sin(ang) * 0.72);
    block.rotation.y = -ang;
    g.add(block);
  }

  // Dark hole
  const hole = new THREE.Mesh(
    new THREE.CircleGeometry(0.55, 18),
    new THREE.MeshBasicMaterial({ color: 0x05080a }),
  );
  hole.rotation.x = -Math.PI / 2;
  hole.position.y = 0.46;
  g.add(hole);
  return g;
}

export function spawnWaterSources(
  scene: THREE.Scene,
  terrain: Terrain,
  rand: Rng,
  biomes: BiomeSampler,
): WaterSource[] {
  const list: WaterSource[] = [];
  // Wells only — oases and barrels have been retired (they didn't fit the
  // barren-desert tone). At least one well is forced into a salt-flat biome
  // so the player has a survival landmark in the otherwise water-less salt.
  const TOTAL_WELLS = 5;
  const SALT_QUOTA = 2;          // at least this many wells must land in salt

  let saltPlaced = 0;
  for (let i = 0; i < TOTAL_WELLS; i++) {
    const requireSalt = saltPlaced < SALT_QUOTA;
    // Retry sampling until biome constraint is satisfied or we give up.
    let x = 0, z = 0;
    for (let attempt = 0; attempt < 40; attempt++) {
      const radius = 35 + rand() * 200;
      const angle = rand() * Math.PI * 2;
      x = Math.cos(angle) * radius;
      z = Math.sin(angle) * radius;
      if (!requireSalt || biomes.biomeAt(x, z) === 'salt') break;
    }
    if (biomes.biomeAt(x, z) === 'salt') saltPlaced++;

    const groundY = terrain.heightAt(x, z);
    const mesh = makeWell(rand);
    // Sink the well slightly so its stone base sits flush even on a slope.
    mesh.position.set(x, groundY - 0.25, z);
    mesh.rotation.y = rand() * Math.PI * 2;
    mesh.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; }
    });

    const id = _nextId++;
    tag(mesh, id);
    scene.add(mesh);
    list.push({
      id,
      kind: 'well',
      mesh,
      pos: new THREE.Vector3(x, groundY, z),
      hovered: false,
    });
  }
  return list;
}

export function findWaterSourceById(list: WaterSource[], id: number | undefined): WaterSource | null {
  if (id === undefined) return null;
  for (const w of list) if (w.id === id) return w;
  return null;
}

