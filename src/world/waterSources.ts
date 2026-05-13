// World water sources — oasis pools, abandoned wells, salvageable barrels.
// The player aims at one and presses E with a non-full canteen to refill.
//
// Registered in `ctx.waterSources.list`. Tagged via userData.interactType/Id
// so the interaction raycast finds them.

import * as THREE from 'three';
import type { Rng } from '../core/rng.ts';
import type { Terrain } from '../world/terrain.ts';

export type WaterSourceKind = 'oasis' | 'well' | 'barrel';

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

function makeOasis(rand: Rng): THREE.Group {
  const g = new THREE.Group();
  // Shallow water disc (CircleGeometry rotated to XZ).
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x3a6678,
    emissive: 0x081820,
    emissiveIntensity: 0.4,
    roughness: 0.3,
    metalness: 0.1,
    transparent: true,
    opacity: 0.85,
  });
  const radius = 1.2 + rand() * 0.8;
  const disc = new THREE.Mesh(new THREE.CircleGeometry(radius, 20), waterMat);
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = 0.02;
  g.add(disc);

  // Stone rim — small dark torus
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(radius + 0.05, 0.08, 5, 24),
    new THREE.MeshStandardMaterial({ color: 0x3a3026, roughness: 0.9 }),
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.04;
  g.add(rim);

  // 3-5 vegetation tufts (small green cylinders) around the rim
  const tuftMat = new THREE.MeshStandardMaterial({ color: 0x4a6a3a, roughness: 0.9 });
  const tuftCount = 3 + Math.floor(rand() * 3);
  for (let i = 0; i < tuftCount; i++) {
    const ang = (i / tuftCount) * Math.PI * 2 + rand() * 0.5;
    const r = radius + 0.15 + rand() * 0.3;
    const tuft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.06, 0.25 + rand() * 0.15, 5),
      tuftMat,
    );
    tuft.position.set(Math.cos(ang) * r, 0.12, Math.sin(ang) * r);
    g.add(tuft);
  }
  return g;
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

function makeBarrel(_rand: Rng): THREE.Group {
  const g = new THREE.Group();
  const metalMat = new THREE.MeshStandardMaterial({
    color: 0x6a4a30,
    roughness: 0.85,
    metalness: 0.3,
  });
  const lidMat = new THREE.MeshStandardMaterial({ color: 0x3a2820, roughness: 0.95 });
  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 0.32, 0.7, 12),
    metalMat,
  );
  barrel.position.y = 0.35;
  g.add(barrel);

  // Rust bands
  const bandMat = new THREE.MeshStandardMaterial({ color: 0x3a2a18, roughness: 1 });
  for (const y of [0.15, 0.55]) {
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(0.325, 0.325, 0.04, 12),
      bandMat,
    );
    band.position.y = y;
    g.add(band);
  }

  // Lid
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.30, 0.04, 12), lidMat);
  lid.position.y = 0.71;
  g.add(lid);
  return g;
}

export function spawnWaterSources(
  scene: THREE.Scene,
  terrain: Terrain,
  rand: Rng,
): WaterSource[] {
  const list: WaterSource[] = [];
  const total = 10;        // 3 oases + 4 wells + 3 barrels
  const kinds: WaterSourceKind[] = [
    'oasis', 'oasis', 'oasis',
    'well', 'well', 'well', 'well',
    'barrel', 'barrel', 'barrel',
  ];
  for (let i = 0; i < total; i++) {
    const kind = kinds[i];
    const radius = 30 + rand() * 200;
    const angle = rand() * Math.PI * 2;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const y = terrain.heightAt(x, z);

    let mesh: THREE.Group;
    if (kind === 'oasis') mesh = makeOasis(rand);
    else if (kind === 'well') mesh = makeWell(rand);
    else mesh = makeBarrel(rand);

    mesh.position.set(x, y, z);
    mesh.rotation.y = rand() * Math.PI * 2;
    mesh.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });

    const id = _nextId++;
    tag(mesh, id);
    scene.add(mesh);

    list.push({
      id,
      kind,
      mesh,
      pos: new THREE.Vector3(x, y, z),
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
