// "Hero" landmarks — rare, hand-coded shapes that punctuate the desert.
// Roughly 1 every 100m of world radius. Stable seed positions so the player
// can learn the map.

import * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';
import type { Rng } from '../core/rng.ts';
import type { Terrain } from './terrain.ts';
import type { ShelterRegistry } from '../shelter/shelterZones.ts';
import { addShelterZone } from '../shelter/shelterZones.ts';
import { makeStaticBox } from '../physics/bodies.ts';

const _q = new THREE.Quaternion();
function getQuat(o: THREE.Object3D): { x: number; y: number; z: number; w: number } {
  o.getWorldQuaternion(_q);
  return { x: _q.x, y: _q.y, z: _q.z, w: _q.w };
}

// ────────────────────────────────────────────────────────────────
// 1. Animal ribcage — whale/dinosaur skeleton lying in the sand
// ────────────────────────────────────────────────────────────────
function placeRibcage(
  scene: THREE.Scene,
  world: RAPIER.World,
  pos: THREE.Vector3,
  rand: Rng,
): void {
  const group = new THREE.Group();
  const boneColor = new THREE.Color().setHSL(0.10, 0.18, 0.55 + rand() * 0.12);
  const mat = new THREE.MeshLambertMaterial({ color: boneColor, flatShading: true });

  const spineLen = 3.5 + rand() * 2.0;
  const spineGeo = new THREE.CylinderGeometry(0.10, 0.16, spineLen, 7);
  const spine = new THREE.Mesh(spineGeo, mat);
  spine.rotation.z = Math.PI / 2; // along X
  spine.position.set(0, 0.18, 0);
  group.add(spine);

  // Ribs — half-torus arcs perpendicular to the spine, opening downward.
  const ribCount = 6 + Math.floor(rand() * 3);
  for (let i = 0; i < ribCount; i++) {
    const t = (i + 0.5) / ribCount - 0.5;
    const ribX = t * spineLen;
    const ribR = (0.55 + rand() * 0.25) * (1 - Math.abs(t) * 0.5); // taper toward ends
    const ribGeo = new THREE.TorusGeometry(ribR, 0.05, 4, 14, Math.PI);
    const rib = new THREE.Mesh(ribGeo, mat);
    rib.rotation.y = Math.PI / 2;     // torus plane goes from XY → YZ
    rib.rotation.z = rand() * 0.1;     // slight individual variation
    rib.position.set(ribX, 0.05, 0);
    group.add(rib);
  }

  // Skull at one end — slightly elongated icosahedron.
  const skullGeo = new THREE.IcosahedronGeometry(0.32, 1);
  const skull = new THREE.Mesh(skullGeo, mat);
  skull.position.set(spineLen / 2 + 0.45, 0.3, 0);
  skull.scale.set(1.3, 0.85, 0.85);
  group.add(skull);

  group.position.copy(pos);
  group.position.y -= 0.05; // press into sand a touch
  group.rotation.y = rand() * Math.PI * 2;
  group.rotation.z = (rand() - 0.5) * 0.08;
  scene.add(group);

  makeStaticBox(
    world,
    { x: spineLen / 2 + 0.4, y: 0.4, z: 0.7 },
    { x: group.position.x, y: group.position.y + 0.3, z: group.position.z },
    getQuat(group),
  );
}

// ────────────────────────────────────────────────────────────────
// 2. Half-buried truck wreck
// ────────────────────────────────────────────────────────────────
function placeTruckWreck(
  scene: THREE.Scene,
  world: RAPIER.World,
  shelter: ShelterRegistry,
  pos: THREE.Vector3,
  rand: Rng,
): void {
  const group = new THREE.Group();
  const rustColor = new THREE.Color().setHSL(0.04, 0.4, 0.18 + rand() * 0.06);
  const metalColor = new THREE.Color().setHSL(0.06, 0.10, 0.10);
  const rustMat = new THREE.MeshLambertMaterial({ color: rustColor, flatShading: true });
  const metalMat = new THREE.MeshLambertMaterial({ color: metalColor, flatShading: true });

  // Cab (front)
  const cab = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.3, 1.7), rustMat);
  cab.position.set(0.95, 0.55, 0);
  group.add(cab);

  // Cargo bed (rear, lower)
  const bed = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.9, 1.6), rustMat);
  bed.position.set(-0.7, 0.25, 0);
  group.add(bed);

  // Windshield slope — a thin tilted block in front
  const ws = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.9, 1.55), metalMat);
  ws.position.set(0.18, 0.95, 0);
  ws.rotation.z = -0.45;
  group.add(ws);

  // Crumpled roof — small flat slab
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.1, 1.5), metalMat);
  roof.position.set(0.95, 1.18, 0);
  roof.rotation.z = (rand() - 0.5) * 0.2;
  group.add(roof);

  // Tilt + partial bury
  group.position.copy(pos);
  group.position.y -= 0.5 + rand() * 0.3;
  group.rotation.y = rand() * Math.PI * 2;
  group.rotation.z = (rand() - 0.5) * 0.18;
  group.rotation.x = (rand() - 0.5) * 0.1;
  scene.add(group);

  makeStaticBox(
    world,
    { x: 2.2, y: 0.9, z: 0.9 },
    { x: group.position.x, y: group.position.y + 0.6, z: group.position.z },
    getQuat(group),
  );

  // Shelter zone: a slightly-larger box around the truck, just tall enough
  // for the player to fit inside (capsule is ~1.7m tall, body center at +0.85
  // above feet). We center the zone at chest height above the wreck.
  addShelterZone(
    shelter,
    { x: group.position.x, y: group.position.y + 1.2, z: group.position.z },
    { x: 2.6, y: 1.2, z: 1.6 },
  );
}

// ────────────────────────────────────────────────────────────────
// 3. Leaning radio tower — visible from far away
// ────────────────────────────────────────────────────────────────
function placeRadioTower(
  scene: THREE.Scene,
  world: RAPIER.World,
  pos: THREE.Vector3,
  rand: Rng,
): void {
  const group = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: 0x1c1612, flatShading: true });

  const height = 14 + rand() * 6;
  const baseSpread = 1.1;
  const topSpread = 0.22;
  const upAxis = new THREE.Vector3(0, 1, 0);

  // 4 legs forming a tapered pyramid
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const bx = Math.cos(a) * baseSpread, bz = Math.sin(a) * baseSpread;
    const tx = Math.cos(a) * topSpread, tz = Math.sin(a) * topSpread;
    const dx = tx - bx, dy = height, dz = tz - bz;
    const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, len, 5), mat);
    leg.position.set((bx + tx) / 2, height / 2, (bz + tz) / 2);
    const dir = new THREE.Vector3(dx, dy, dz).normalize();
    leg.quaternion.setFromUnitVectors(upAxis, dir);
    group.add(leg);
  }

  // Cross-bracing at three levels
  for (const level of [0.22, 0.5, 0.78]) {
    const y = level * height;
    const spread = baseSpread + (topSpread - baseSpread) * level;
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const b = ((i + 1) / 4) * Math.PI * 2 + Math.PI / 4;
      const x1 = Math.cos(a) * spread, z1 = Math.sin(a) * spread;
      const x2 = Math.cos(b) * spread, z2 = Math.sin(b) * spread;
      const dx = x2 - x1, dz = z2 - z1;
      const len = Math.sqrt(dx * dx + dz * dz);
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, len, 4), mat);
      beam.position.set((x1 + x2) / 2, y, (z1 + z2) / 2);
      beam.quaternion.setFromUnitVectors(upAxis, new THREE.Vector3(dx, 0, dz).normalize());
      group.add(beam);
    }
  }

  // Top antenna
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 2.2, 5), mat);
  antenna.position.set(0, height + 1.1, 0);
  group.add(antenna);

  // Slight permanent lean
  group.position.copy(pos);
  group.rotation.y = rand() * Math.PI * 2;
  group.rotation.z = (rand() - 0.5) * 0.10;
  scene.add(group);

  // Collider — single tall box around the base footprint.
  makeStaticBox(
    world,
    { x: baseSpread * 1.1, y: height / 2, z: baseSpread * 1.1 },
    { x: group.position.x, y: group.position.y + height / 2, z: group.position.z },
    getQuat(group),
  );
}

// ────────────────────────────────────────────────────────────────
// 4. Cracked stone obelisk — broken pillar leaning into the wind
// ────────────────────────────────────────────────────────────────
function placeObelisk(
  scene: THREE.Scene,
  world: RAPIER.World,
  pos: THREE.Vector3,
  rand: Rng,
): void {
  const group = new THREE.Group();
  const stoneColor = new THREE.Color().setHSL(0.07, 0.06, 0.28 + rand() * 0.08);
  const mat = new THREE.MeshLambertMaterial({ color: stoneColor, flatShading: true });

  const totalH = 6 + rand() * 3;
  const w = 0.55 + rand() * 0.3;

  // Bottom piece — main stump
  const botH = totalH * (0.55 + rand() * 0.18);
  const bot = new THREE.Mesh(new THREE.BoxGeometry(w, botH, w), mat);
  bot.position.set(0, botH / 2, 0);
  bot.rotation.y = (rand() - 0.5) * 0.2;
  group.add(bot);

  // Top piece — broken off, offset & tilted
  const topH = totalH * (0.22 + rand() * 0.12);
  const top = new THREE.Mesh(new THREE.BoxGeometry(w * 0.88, topH, w * 0.88), mat);
  top.position.set(
    (rand() - 0.5) * 0.35,
    botH + 0.35 + topH / 2,
    (rand() - 0.5) * 0.35,
  );
  top.rotation.set(
    (rand() - 0.5) * 0.3,
    rand() * Math.PI * 2,
    (rand() - 0.5) * 0.3,
  );
  group.add(top);

  // Optional fallen chunk on the ground
  if (rand() < 0.6) {
    const chunkH = topH * 0.5;
    const chunk = new THREE.Mesh(new THREE.BoxGeometry(w * 0.9, chunkH, w * 0.8), mat);
    const dist = 1.0 + rand() * 0.8;
    const ang = rand() * Math.PI * 2;
    chunk.position.set(Math.cos(ang) * dist, chunkH / 2, Math.sin(ang) * dist);
    chunk.rotation.set((rand() - 0.5) * 1.3, rand() * Math.PI * 2, (rand() - 0.5) * 1.3);
    group.add(chunk);
  }

  group.position.copy(pos);
  group.rotation.y = rand() * Math.PI * 2;
  scene.add(group);

  makeStaticBox(
    world,
    { x: w / 2 * 1.1, y: botH / 2, z: w / 2 * 1.1 },
    { x: group.position.x, y: group.position.y + botH / 2, z: group.position.z },
    getQuat(group),
  );
}

// ────────────────────────────────────────────────────────────────
// Public entry: scatter ~6-9 hero landmarks around the world
// ────────────────────────────────────────────────────────────────
type HeroType = 'ribcage' | 'truck' | 'tower' | 'obelisk';

const HERO_TYPES: HeroType[] = ['ribcage', 'truck', 'tower', 'obelisk'];

export function placeHeroLandmarks(
  scene: THREE.Scene,
  world: RAPIER.World,
  terrain: Terrain,
  shelter: ShelterRegistry,
  rand: Rng,
): void {
  const count = 7 + Math.floor(rand() * 3); // 7-9
  for (let i = 0; i < count; i++) {
    // Spread around a ring; jitter angle + radius for variety.
    const angle = (i / count) * Math.PI * 2 + (rand() - 0.5) * 0.8;
    const radius = 70 + rand() * 180;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const y = terrain.heightAt(x, z);
    const type = HERO_TYPES[Math.floor(rand() * HERO_TYPES.length)];
    const pos = new THREE.Vector3(x, y, z);
    switch (type) {
      case 'ribcage':  placeRibcage(scene, world, pos, rand); break;
      case 'truck':    placeTruckWreck(scene, world, shelter, pos, rand); break;
      case 'tower':    placeRadioTower(scene, world, pos, rand); break;
      case 'obelisk':  placeObelisk(scene, world, pos, rand); break;
    }
  }
}
