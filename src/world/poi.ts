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
import { attachCompoundCollider } from '../physics/bodies.ts';
import { registerSalvageable, type SalvageableRegistry } from './salvage.ts';
import { placeMegaShip } from './megaShip.ts';
import type { ShelterRegistry } from '../shelter/shelterZones.ts';

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
): THREE.Group {
  const cluster = makeEngineCluster(rand, 4.2);   // hero scale
  // Compose into a parent group so we can rotate cleanly.
  const parent = new THREE.Group();
  parent.add(cluster);
  // Forward the cluster's access panel up to the parent so registerSalvageable
  // can find it (Session Z — `salvageables` reads `group.userData.accessPanel`).
  parent.userData.accessPanel = cluster.userData.accessPanel;
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
  // AABB collider auto-fits the tilted engine cluster.
  attachCompoundCollider(world, parent);
  // Debris field around the impact site.
  placeDebrisField(scene, terrain, pos, 14, rand, 10);
  return parent;
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
): { pickup: Pickup; fuselage: THREE.Group } {
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
  attachCompoundCollider(world, fuselage);

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
  return { pickup, fuselage };
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
): { hull: THREE.Group; bell: THREE.Group } {
  // Main fuselage — hero scale, partly buried + tilted.
  const fuselage = makeFuselage(rand, 3.2);
  const parent = new THREE.Group();
  parent.add(fuselage);
  // Forward the fuselage's access panel up to the parent for registerSalvageable.
  parent.userData.accessPanel = fuselage.userData.accessPanel;
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
  attachCompoundCollider(world, parent);

  // Engine bell off the "tail," angled.
  const bellPos = new THREE.Vector3(
    pos.x + Math.cos(parent.rotation.y) * 8.0,
    terrain.heightAt(pos.x + Math.cos(parent.rotation.y) * 8.0, pos.z + Math.sin(parent.rotation.y) * 8.0),
    pos.z + Math.sin(parent.rotation.y) * 8.0,
  );
  const bell = placeWreck(scene, world, terrain, bellPos, 'engine_bell', rand, {
    scale: 2.4,
    buryY: 1.0,
    tiltZ: 0.4,
  });

  // Debris field stretching from the impact site.
  placeDebrisField(scene, terrain, pos, 16, rand, 12);
  return { hull: parent, bell };
}

// ────────────────────────────────────────────────────────────────
// Public entry — hand-picked positions + dispatch
// ────────────────────────────────────────────────────────────────
/** Variance of terrain heights in a small patch (3×3 samples at 2.5m spacing).
 *  Lower = flatter spot. Used to pick a flat landing for the mega-ship. */
function terrainVarAt(terrain: Terrain, cx: number, cz: number): number {
  const samples: number[] = [];
  for (const dx of [-2.5, 0, 2.5]) {
    for (const dz of [-2.5, 0, 2.5]) {
      samples.push(terrain.heightAt(cx + dx, cz + dz));
    }
  }
  const mean = samples.reduce((s, v) => s + v, 0) / samples.length;
  return samples.reduce((s, v) => s + (v - mean) ** 2, 0) / samples.length;
}

interface POISpec {
  kind: 'engine_block' | 'camp' | 'antenna_outpost' | 'crashed_hull' | 'mega_ship';
  x: number;
  z: number;
}

// Hand-picked POIs spread across the compass. mega_ship (Session BB) sits
// in the western dunes, ~79m from the nearest other POI and chosen
// empirically so all 8 probes within 10m sample as dune biome.
const POI_LAYOUT: ReadonlyArray<POISpec> = [
  { kind: 'engine_block',     x:  95, z:  -8 },
  { kind: 'camp',             x: -42, z:  78 },
  { kind: 'antenna_outpost',  x: -88, z: -50 },
  { kind: 'crashed_hull',     x:  18, z: -110 },
  { kind: 'mega_ship',        x:-120, z:  30 },
];

export function placePOIs(
  scene: THREE.Scene,
  world: RAPIER.World,
  terrain: Terrain,
  rand: Rng,
  pickupList: Pickup[],
  salvageables?: SalvageableRegistry,
  shelter?: ShelterRegistry,
): void {
  for (const p of POI_LAYOUT) {
    const y = terrain.heightAt(p.x, p.z);
    const pos = new THREE.Vector3(p.x, y, p.z);
    switch (p.kind) {
      case 'engine_block': {
        const group = placeEngineBlock(scene, world, terrain, pos, rand);
        if (salvageables) registerSalvageable(salvageables, group, 'massive', pos, rand);
        break;
      }
      case 'camp': {
        const { pickup, fuselage } = placeScavengerCamp(scene, world, terrain, rand, pos);
        pickupList.push(pickup);
        // The camp fuselage is small (0.9× scale) — register as a regular
        // fuselage salvageable rather than 'massive'.
        if (salvageables) registerSalvageable(salvageables, fuselage, 'fuselage', pos, rand);
        break;
      }
      case 'antenna_outpost': {
        const group = placeWreck(scene, world, terrain, pos, 'antenna_spire', rand, {
          scale: 1.4,
          buryY: 0.5,
          tiltZ: 0.08,
        });
        placeDebrisField(scene, terrain, pos, 8, rand, 5);
        if (salvageables) registerSalvageable(salvageables, group, 'massive', pos, rand);
        break;
      }
      case 'crashed_hull': {
        const { hull, bell } = placeCrashedHull(scene, world, terrain, pos, rand);
        if (salvageables) {
          registerSalvageable(salvageables, hull, 'massive', pos, rand);
          // Also register the engine bell tail as its own salvageable so
          // both halves of the wreck are interactable.
          const bellPos = new THREE.Vector3().setFromMatrixPosition(bell.matrixWorld);
          registerSalvageable(salvageables, bell, 'engine_bell', bellPos, rand);
        }
        break;
      }
      case 'mega_ship': {
        if (!salvageables || !shelter) break;
        // Find a flatter spot near the nominal position so the wreck has
        // less terrain variation under its footprint. Sample 8 angular
        // candidates × 2 radii within 5m.
        let bestX = p.x, bestZ = p.z;
        let bestVar = terrainVarAt(terrain, p.x, p.z);
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          for (const r of [3, 5]) {
            const x = p.x + Math.cos(a) * r;
            const z = p.z + Math.sin(a) * r;
            const v = terrainVarAt(terrain, x, z);
            if (v < bestVar) { bestVar = v; bestX = x; bestZ = z; }
          }
        }
        // Use mean footprint terrain as the origin so terrain rises into
        // the cavity for the "sand-reclaimed" look. Walls extend WALL_BURY
        // below this to avoid any floating gap on sloped dunes.
        let sumY = 0, countY = 0;
        for (const dx of [-5, -2, 0, 2, 5]) {
          for (const dz of [-6, -3, 0, 3, 6]) {
            sumY += terrain.heightAt(bestX + dx, bestZ + dz);
            countY++;
          }
        }
        const meanY = sumY / countY;
        const buryPos = new THREE.Vector3(bestX, meanY, bestZ);
        // Tilt the wreck so its up-axis matches the terrain normal at the
        // wreck position — gives a natural "crashed and settled" angle on
        // sloped dunes. Cap the tilt angle so the wreck doesn't tip too far.
        const normal = terrain.normalAt(bestX, bestZ).clone();
        const upVec = new THREE.Vector3(0, 1, 0);
        const angle = Math.min(upVec.angleTo(normal), 0.25);  // cap ~14°
        const axis = new THREE.Vector3().crossVectors(upVec, normal);
        let tilt = new THREE.Quaternion();
        if (axis.lengthSq() > 1e-6) {
          axis.normalize();
          tilt = new THREE.Quaternion().setFromAxisAngle(axis, angle);
        }
        // Yaw chosen so the entrance (-X side) faces toward player spawn.
        const yaw = Math.PI;
        placeMegaShip(scene, world, terrain, buryPos, yaw, tilt, rand, shelter, salvageables);
        break;
      }
    }
  }
}
