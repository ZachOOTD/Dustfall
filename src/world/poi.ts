// Distant POIs (Session S re-theme). Four hand-placed silhouettes ~60-130m
// from spawn, each a single legible focal point in the otherwise barren
// scavenger desert.
//
//   - Engine Block       — massive 5-bell engine module tipped into a dune
//   - Scavenger Camp     — fire ring + small fuselage lean-to + bandage
//   - Antenna Outpost    — comm spire on buried wreckage base
//   - Crashed Hull       — long fuselage with engine bell + debris field

import * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';
import type { Rng } from '../core/rng.ts';
import type { Terrain } from './terrain.ts';
import type { Pickup } from '../pickups/pickups.ts';
import { spawnDroppedPickup } from '../pickups/pickups.ts';
import {
  makeEngineCluster,
  makeFuselage,
  placeWreck,
  placeDebrisField,
} from './wrecks.ts';
import { makeStaticBox } from '../physics/bodies.ts';

const _q = new THREE.Quaternion();
function getQuat(o: THREE.Object3D): { x: number; y: number; z: number; w: number } {
  o.getWorldQuaternion(_q);
  return { x: _q.x, y: _q.y, z: _q.z, w: _q.w };
}

// ────────────────────────────────────────────────────────────────
// The Engine Block — massive engine cluster tipped at ~30° into a dune.
// Iconic Jakku-Star-Destroyer silhouette: nozzles pointing skyward.
// ────────────────────────────────────────────────────────────────
function placeEngineBlock(
  scene: THREE.Scene,
  world: RAPIER.World,
  terrain: Terrain,
  pos: THREE.Vector3,
  rand: Rng,
): void {
  const cluster = makeEngineCluster(rand, 4.2);   // hero scale
  // Compose into a parent group so we can rotate cleanly.
  const parent = new THREE.Group();
  parent.add(cluster);
  parent.position.copy(pos);
  parent.position.y -= 1.4;                       // deep bury on one side
  parent.rotation.y = -0.6;
  // Tip leeward — pitch around X so the nozzles point up-and-out.
  parent.rotation.x = -0.55;
  parent.rotation.z = -0.18;
  parent.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; }
  });
  scene.add(parent);
  // Coarse collider — large box around the central mass.
  makeStaticBox(
    world,
    { x: 4.5, y: 3.5, z: 4.5 },
    { x: parent.position.x, y: parent.position.y + 3.0, z: parent.position.z },
    getQuat(parent),
  );
  // Debris field around the impact site.
  placeDebrisField(scene, terrain, pos, 14, rand, 10);
}

// ────────────────────────────────────────────────────────────────
// Scavenger camp — small fuselage chunk + lean-to fire ring + bandage.
// Returns the bandage pickup so the caller can register it.
// ────────────────────────────────────────────────────────────────
function placeScavengerCamp(
  scene: THREE.Scene,
  world: RAPIER.World,
  terrain: Terrain,
  rand: Rng,
  center: THREE.Vector3,
): { pickup: Pickup } {
  // Small fuselage section as the windbreak the camp is built against.
  const fuselage = makeFuselage(rand, 0.9);
  fuselage.position.copy(center);
  fuselage.position.x -= 1.4;
  fuselage.position.y -= 0.35;
  fuselage.rotation.y = 0.4;
  fuselage.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; }
  });
  scene.add(fuselage);
  makeStaticBox(
    world,
    { x: 1.8, y: 0.9, z: 1.0 },
    { x: fuselage.position.x, y: fuselage.position.y + 0.8, z: fuselage.position.z },
    getQuat(fuselage),
  );

  // Fire ring — 8 small dark stones in a 1m circle, on the lee side.
  const stoneMat = new THREE.MeshLambertMaterial({
    color: new THREE.Color().setHSL(0.07, 0.05, 0.12),
    flatShading: true,
  });
  const ringR = 0.55;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + rand() * 0.2;
    const r = ringR + (rand() - 0.5) * 0.06;
    const sx = center.x + Math.cos(a) * r;
    const sz = center.z + Math.sin(a) * r;
    const stone = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.10 + rand() * 0.04, 0),
      stoneMat,
    );
    stone.position.set(sx, terrain.heightAt(sx, sz) - 0.02, sz);
    stone.rotation.y = rand() * Math.PI;
    stone.castShadow = false;
    stone.receiveShadow = true;
    scene.add(stone);
  }
  // Ash patch — small dark disc, terrain-aligned.
  const ash = new THREE.Mesh(
    new THREE.CircleGeometry(ringR * 0.85, 16),
    new THREE.MeshBasicMaterial({ color: 0x14100c }),
  );
  ash.position.set(center.x, terrain.heightAt(center.x, center.z) + 0.015, center.z);
  ash.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 0, 1),
    terrain.normalAt(center.x, center.z).clone(),
  );
  scene.add(ash);

  // Bandage pickup on the far side of the fire.
  const bandageX = center.x + 1.0 + rand() * 0.4;
  const bandageZ = center.z + 0.8 + rand() * 0.6;
  const pickup = spawnDroppedPickup(scene, terrain, { x: bandageX, z: bandageZ }, 'bandage');
  return { pickup };
}

// ────────────────────────────────────────────────────────────────
// Crashed Hull — long fuselage with engine bell on the tail.
// Two wrecks paired so the silhouette reads as "one big ship."
// ────────────────────────────────────────────────────────────────
function placeCrashedHull(
  scene: THREE.Scene,
  world: RAPIER.World,
  terrain: Terrain,
  pos: THREE.Vector3,
  rand: Rng,
): void {
  // Main fuselage — hero scale, partly buried + tilted.
  const fuselage = makeFuselage(rand, 3.2);
  const parent = new THREE.Group();
  parent.add(fuselage);
  parent.position.copy(pos);
  parent.position.y -= 1.6;
  parent.rotation.y = 0.9;
  parent.rotation.z = -0.18;
  parent.rotation.x = 0.08;
  parent.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; }
  });
  scene.add(parent);
  makeStaticBox(
    world,
    { x: 6.0, y: 1.8, z: 2.6 },
    { x: parent.position.x, y: parent.position.y + 1.6, z: parent.position.z },
    getQuat(parent),
  );

  // Engine bell off the "tail," angled.
  const bellPos = new THREE.Vector3(
    pos.x + Math.cos(parent.rotation.y) * 8.0,
    terrain.heightAt(pos.x + Math.cos(parent.rotation.y) * 8.0, pos.z + Math.sin(parent.rotation.y) * 8.0),
    pos.z + Math.sin(parent.rotation.y) * 8.0,
  );
  placeWreck(scene, world, terrain, bellPos, 'engine_bell', rand, {
    scale: 2.4,
    buryY: 1.0,
    tiltZ: 0.4,
  });

  // Debris field stretching from the impact site.
  placeDebrisField(scene, terrain, pos, 16, rand, 12);
}

// ────────────────────────────────────────────────────────────────
// Public entry — hand-picked positions + dispatch
// ────────────────────────────────────────────────────────────────
interface POISpec {
  kind: 'engine_block' | 'camp' | 'antenna_outpost' | 'crashed_hull';
  x: number;
  z: number;
}

// Hand-picked: 4 POIs at ~60-130m from spawn, spread across the compass.
const POI_LAYOUT: ReadonlyArray<POISpec> = [
  { kind: 'engine_block',     x:  95, z:  -8 },
  { kind: 'camp',             x: -42, z:  78 },
  { kind: 'antenna_outpost',  x: -88, z: -50 },
  { kind: 'crashed_hull',     x:  18, z: -110 },
];

export function placePOIs(
  scene: THREE.Scene,
  world: RAPIER.World,
  terrain: Terrain,
  rand: Rng,
  pickupList: Pickup[],
): void {
  for (const p of POI_LAYOUT) {
    const y = terrain.heightAt(p.x, p.z);
    const pos = new THREE.Vector3(p.x, y, p.z);
    switch (p.kind) {
      case 'engine_block':
        placeEngineBlock(scene, world, terrain, pos, rand);
        break;
      case 'camp': {
        const { pickup } = placeScavengerCamp(scene, world, terrain, rand, pos);
        pickupList.push(pickup);
        break;
      }
      case 'antenna_outpost':
        placeWreck(scene, world, terrain, pos, 'antenna_spire', rand, {
          scale: 1.4,
          buryY: 0.5,
          tiltZ: 0.08,
          collider: { halfW: 1.6, halfH: 5, halfD: 1.6 },
        });
        placeDebrisField(scene, terrain, pos, 8, rand, 5);
        break;
      case 'crashed_hull':
        placeCrashedHull(scene, world, terrain, pos, rand);
        break;
    }
  }
}
