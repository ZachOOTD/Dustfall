// Distant POIs (Session P). Four hand-placed silhouettes ~60–150m from spawn,
// each a single legible focal point in the otherwise barren-desert world.
//
//   - Monolith (12m dark spire) — pure atmosphere
//   - Abandoned camp (fire ring + barrel + bandage pickup) — modest reward
//   - Watchtower remnant (6m wooden silhouette) — pure atmosphere
//   - Ribcage cluster (3 grouped ribcage primitives) — pure atmosphere

import * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';
import type { Rng } from '../core/rng.ts';
import type { Terrain } from './terrain.ts';
import type { WaterSource } from './waterSources.ts';
import type { Pickup } from '../pickups/pickups.ts';
import { spawnWaterSourceAt } from './waterSources.ts';
import { spawnDroppedPickup } from '../pickups/pickups.ts';
import { placeRibcage } from './heroLandmarks.ts';
import { perturbOutward } from './sculpt.ts';
import { makeStaticBox } from '../physics/bodies.ts';

const _q = new THREE.Quaternion();
function getQuat(o: THREE.Object3D): { x: number; y: number; z: number; w: number } {
  o.getWorldQuaternion(_q);
  return { x: _q.x, y: _q.y, z: _q.z, w: _q.w };
}

// ────────────────────────────────────────────────────────────────
// Monolith — 12m dark basalt spire
// ────────────────────────────────────────────────────────────────
function placeMonolith(
  scene: THREE.Scene,
  world: RAPIER.World,
  pos: THREE.Vector3,
  rand: Rng,
): void {
  const geo = new THREE.IcosahedronGeometry(1.0, 1);
  perturbOutward(geo, 0.18, 41);
  const mat = new THREE.MeshLambertMaterial({
    color: new THREE.Color().setHSL(0.62, 0.02, 0.06),
    flatShading: true,
  });
  const spire = new THREE.Mesh(geo, mat);
  const h = 11 + rand() * 3;
  const w = 1.3 + rand() * 0.5;
  spire.scale.set(w, h, w * 0.85);
  spire.position.copy(pos);
  spire.position.y += h * 0.5 - 0.6;       // embed base slightly
  spire.rotation.y = rand() * Math.PI * 2;
  spire.rotation.z = (rand() - 0.5) * 0.08;
  scene.add(spire);

  makeStaticBox(
    world,
    { x: w * 0.6, y: h * 0.5, z: w * 0.5 },
    { x: spire.position.x, y: spire.position.y, z: spire.position.z },
    getQuat(spire),
  );
}

// ────────────────────────────────────────────────────────────────
// Abandoned camp — fire ring + barrel + bandage pickup
// Returns the WaterSource + Pickup so the caller can register them.
// ────────────────────────────────────────────────────────────────
function placeAbandonedCamp(
  scene: THREE.Scene,
  terrain: Terrain,
  rand: Rng,
  center: THREE.Vector3,
): { waterSource: WaterSource; pickup: Pickup } {
  // Fire ring — 8 small dark stones in a 1m circle
  const stoneMat = new THREE.MeshLambertMaterial({
    color: new THREE.Color().setHSL(0.07, 0.05, 0.12),
    flatShading: true,
  });
  const ringR = 0.55;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + rand() * 0.2;
    const r = ringR + (rand() - 0.5) * 0.06;
    const stone = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.10 + rand() * 0.04, 0),
      stoneMat,
    );
    stone.position.set(
      center.x + Math.cos(a) * r,
      terrain.heightAt(center.x + Math.cos(a) * r, center.z + Math.sin(a) * r) + 0.04,
      center.z + Math.sin(a) * r,
    );
    stone.rotation.y = rand() * Math.PI;
    stone.castShadow = false;
    stone.receiveShadow = true;
    scene.add(stone);
  }
  // Ash patch — flat dark disc in the center
  const ash = new THREE.Mesh(
    new THREE.CircleGeometry(ringR * 0.85, 16),
    new THREE.MeshBasicMaterial({ color: 0x14100c }),
  );
  ash.rotation.x = -Math.PI / 2;
  ash.position.set(center.x, terrain.heightAt(center.x, center.z) + 0.015, center.z);
  scene.add(ash);

  // Barrel offset from the fire ring; tagged as a refillable water source.
  const barrelX = center.x + 2.0 + rand() * 0.6;
  const barrelZ = center.z - 0.6 + rand() * 1.2;
  const waterSource = spawnWaterSourceAt(scene, terrain, rand, 'barrel', barrelX, barrelZ);
  // Tilt it slightly so it reads as "abandoned, half-fallen."
  waterSource.mesh.rotation.z = 0.18 + rand() * 0.1;

  // Bandage pickup on the other side of the fire.
  const bandageX = center.x - 1.4 + rand() * 0.6;
  const bandageZ = center.z + 1.1 + rand() * 0.6;
  const pickup = spawnDroppedPickup(
    scene,
    terrain,
    { x: bandageX, z: bandageZ },
    'bandage',
  );

  return { waterSource, pickup };
}

// ────────────────────────────────────────────────────────────────
// Watchtower remnant — 6m wooden lean silhouette
// ────────────────────────────────────────────────────────────────
function placeWatchtower(
  scene: THREE.Scene,
  world: RAPIER.World,
  pos: THREE.Vector3,
  rand: Rng,
): void {
  const group = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({
    color: new THREE.Color().setHSL(0.07, 0.18, 0.16 + rand() * 0.04),
    flatShading: true,
  });

  const height = 6.5 + rand() * 1.5;
  const baseSpread = 0.85;
  const topSpread = 0.32;
  const upAxis = new THREE.Vector3(0, 1, 0);

  // 4 legs forming a tapered pyramid (same pattern as radio tower, smaller).
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const bx = Math.cos(a) * baseSpread, bz = Math.sin(a) * baseSpread;
    const tx = Math.cos(a) * topSpread, tz = Math.sin(a) * topSpread;
    const dx = tx - bx, dy = height, dz = tz - bz;
    const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, len, 5), mat);
    leg.position.set((bx + tx) / 2, height / 2, (bz + tz) / 2);
    const dir = new THREE.Vector3(dx, dy, dz).normalize();
    leg.quaternion.setFromUnitVectors(upAxis, dir);
    group.add(leg);
  }
  // 2 cross-bracing levels.
  for (const level of [0.35, 0.7]) {
    const y = level * height;
    const spread = baseSpread + (topSpread - baseSpread) * level;
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const b = ((i + 1) / 4) * Math.PI * 2 + Math.PI / 4;
      const x1 = Math.cos(a) * spread, z1 = Math.sin(a) * spread;
      const x2 = Math.cos(b) * spread, z2 = Math.sin(b) * spread;
      const dx = x2 - x1, dz = z2 - z1;
      const len = Math.sqrt(dx * dx + dz * dz);
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, len, 4), mat);
      beam.position.set((x1 + x2) / 2, y, (z1 + z2) / 2);
      beam.quaternion.setFromUnitVectors(upAxis, new THREE.Vector3(dx, 0, dz).normalize());
      group.add(beam);
    }
  }
  // Bare scaffold platform on top — three crossing slats, no roof.
  for (let i = 0; i < 3; i++) {
    const slat = new THREE.Mesh(
      new THREE.BoxGeometry(topSpread * 2.2, 0.06, 0.10),
      mat,
    );
    slat.position.set(0, height + 0.02, (i - 1) * topSpread * 0.7);
    slat.rotation.y = i * 0.15;
    group.add(slat);
  }

  group.position.copy(pos);
  group.rotation.y = rand() * Math.PI * 2;
  group.rotation.z = (rand() - 0.5) * 0.22;   // pronounced lean
  group.rotation.x = (rand() - 0.5) * 0.12;
  scene.add(group);

  makeStaticBox(
    world,
    { x: baseSpread * 1.1, y: height / 2, z: baseSpread * 1.1 },
    { x: group.position.x, y: group.position.y + height / 2, z: group.position.z },
    getQuat(group),
  );
}

// ────────────────────────────────────────────────────────────────
// Ribcage cluster — 3 grouped ribcage primitives
// ────────────────────────────────────────────────────────────────
function placeRibcageCluster(
  scene: THREE.Scene,
  world: RAPIER.World,
  terrain: Terrain,
  center: THREE.Vector3,
  rand: Rng,
): void {
  for (let i = 0; i < 3; i++) {
    const ang = (i / 3) * Math.PI * 2 + rand() * 0.5;
    const r = 1.8 + rand() * 1.4;
    const x = center.x + Math.cos(ang) * r;
    const z = center.z + Math.sin(ang) * r;
    const y = terrain.heightAt(x, z);
    placeRibcage(scene, world, new THREE.Vector3(x, y, z), rand);
  }
}

// ────────────────────────────────────────────────────────────────
// Public entry — hand-picked positions + dispatch
// ────────────────────────────────────────────────────────────────
interface POISpec {
  kind: 'monolith' | 'camp' | 'watchtower' | 'ribcage_cluster';
  x: number;
  z: number;
}

// Hand-picked: 4 POIs at ~60–130m from spawn, spread across the compass.
const POI_LAYOUT: ReadonlyArray<POISpec> = [
  { kind: 'monolith',         x:  95, z:  -8 },
  { kind: 'camp',             x: -42, z:  78 },
  { kind: 'watchtower',       x: -88, z: -50 },
  { kind: 'ribcage_cluster',  x:  18, z: -110 },
];

export function placePOIs(
  scene: THREE.Scene,
  world: RAPIER.World,
  terrain: Terrain,
  rand: Rng,
  waterSourceList: WaterSource[],
  pickupList: Pickup[],
): void {
  for (const p of POI_LAYOUT) {
    const y = terrain.heightAt(p.x, p.z);
    const pos = new THREE.Vector3(p.x, y, p.z);
    switch (p.kind) {
      case 'monolith':
        placeMonolith(scene, world, pos, rand);
        break;
      case 'camp': {
        const { waterSource, pickup } = placeAbandonedCamp(scene, terrain, rand, pos);
        waterSourceList.push(waterSource);
        pickupList.push(pickup);
        break;
      }
      case 'watchtower':
        placeWatchtower(scene, world, pos, rand);
        break;
      case 'ribcage_cluster':
        placeRibcageCluster(scene, world, terrain, pos, rand);
        break;
    }
  }
}
