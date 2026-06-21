// Deep cave (M8 ⑨) — the enclosed, walkable INTERIOR at the cave funnel floor.
//
// The funnel DESCENT is carved into the terrain (terrain.ts / CAVE_PIT_*, C47) at
// biomes.caveAnchor; the player walks down it. This module places a ROOFED CHAMBER at
// the funnel floor: a self-contained box room (its OWN flat floor + walls + a roof
// collider) with a DOORWAY gap, so the player steps off the funnel floor INTO an
// enclosed dark space. A long-DEAD place (D252): no powered/maintained dressing.
//
// Design notes:
//  - The player walks the CONTINUOUS funnel TERRAIN floor (no separate floor slab):
//    a flat slab at the funnel's deepest center would sit BELOW the bowl-shaped terrain
//    at the room's edges, making an unclimbable step at the doorway (> the 0.3 m
//    autostep). Walls instead extend ~1 m BELOW the centre floor so they seal into the
//    rising bowl as it climbs toward the room edges (no gap under a wall). The whole
//    room sits inside the carved funnel, below the dune rim — no "under the un-carved
//    terrain sheet" KCC risk.
//  - Ceiling is kept tall (~3.8 m at centre, >= ~2.3 m at the edges where the bowl
//    floor rises) so the roof collider doesn't fight the KCC's 0.3 m snap-to-ground
//    (the roof is above the capsule; snap fires downward).
//  - Reuses attachDeclaredColliders (the POI collider API). This is NOT an
//    ARCH_WEIGHTS archetype — it's a FIXED feature spawned once from main.ts, so
//    verify:colliders (which sweeps archetypes) does NOT auto-audit it; the colliders
//    are declared explicitly here (every wall/roof/floor mesh has a matching spec).
//  - [partial, C48]: ONE chamber + the doorway. Multi-chamber depth, the dark-nav
//    (ambient-darken-below-Y + torch glow), decayed dressing, and the M8 ⑩ companion
//    egg at the deepest chamber continue next cycle. The walk-IN FEEL -> walk-test.

import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import type { Terrain } from './terrain.ts';
import type { ColliderSpec } from '../physics/bodies.ts';
import { attachDeclaredColliders } from '../physics/bodies.ts';
import { Tuning } from '../config/tuning.ts';

// A dark, dead cave rock — flat-shaded, unlit-feeling (no emissive). Reads as shadowed
// stone/scrap, not maintained structure (D252).
const _caveRockMat = new THREE.MeshLambertMaterial({ color: 0x2c2620, flatShading: true });
const _caveRockDark = new THREE.MeshLambertMaterial({ color: 0x1c1813, flatShading: true });

export interface DeepCave {
  group: THREE.Group;
  body: RAPIER.RigidBody;
  basePos: THREE.Vector3;
}

/** Build + place the deep-cave interior chamber at the carved funnel floor. */
export function spawnDeepCave(
  scene: THREE.Scene,
  world: RAPIER.World,
  terrain: Terrain,
  anchor: { x: number; z: number },
): DeepCave {
  const floorY = terrain.heightAt(anchor.x, anchor.z);   // the carved funnel floor (deepest, ~flat)
  const g = new THREE.Group();
  g.name = 'deepCave';
  g.position.set(anchor.x, floorY, anchor.z);

  const hx = Tuning.CAVE_ROOM_HALF_X;     // room half-width (X)
  const hz = Tuning.CAVE_ROOM_HALF_Z;     // room half-depth (Z)
  const H = Tuning.CAVE_ROOM_HEIGHT;      // interior clear height
  const t = 0.3;                          // wall/floor/roof thickness
  const doorHalf = Tuning.CAVE_DOOR_HALF; // doorway half-width (gap in the -X wall)
  const colliders: ColliderSpec[] = [];

  const addBox = (mat: THREE.Material, half: { x: number; y: number; z: number }, pos: { x: number; y: number; z: number }) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(half.x * 2, half.y * 2, half.z * 2), mat);
    m.position.set(pos.x, pos.y, pos.z);
    m.castShadow = true; m.receiveShadow = true;
    g.add(m);
    colliders.push({ kind: 'box', half: { ...half }, pos: { ...pos } });
    return m;
  };

  // Walls span from BELOW the centre floor (y = -wallSink) up to the roof (y = H), so
  // they seal into the bowl floor as it rises toward the room edges (no under-wall gap).
  const wallSink = 1.0;
  const wallCY = (H - wallSink) / 2;      // wall centre Y
  const wallHY = (H + wallSink) / 2;      // wall half-height
  // ── roof slab (bottom at y=H), the ENCLOSING ceiling ──
  addBox(_caveRockDark, { x: hx + t, y: t, z: hz + t }, { x: 0, y: H + t, z: 0 });
  // ── +X / -Z / +Z solid walls ──
  addBox(_caveRockMat, { x: t, y: wallHY, z: hz + t }, { x: hx, y: wallCY, z: 0 });          // +X back wall
  addBox(_caveRockMat, { x: hx + t, y: wallHY, z: t }, { x: 0, y: wallCY, z: -hz });         // -Z wall
  addBox(_caveRockMat, { x: hx + t, y: wallHY, z: t }, { x: 0, y: wallCY, z: hz });          // +Z wall
  // ── -X entrance wall, SPLIT to leave a central DOORWAY gap (the player walks in) ──
  const segZ = (hz - doorHalf) / 2;       // each side segment's half-depth
  for (const sz of [-1, 1]) {
    addBox(_caveRockMat, { x: t, y: wallHY, z: segZ }, { x: -hx, y: wallCY, z: sz * (doorHalf + segZ) });
  }
  // a lintel over the doorway (its underside above head height so the gap reads as a portal)
  const lintelH = (H - Tuning.CAVE_DOOR_HEIGHT) / 2;
  addBox(_caveRockMat, { x: t, y: lintelH, z: doorHalf }, { x: -hx, y: Tuning.CAVE_DOOR_HEIGHT + lintelH, z: 0 });

  scene.add(g);
  const body = attachDeclaredColliders(world, g, colliders);
  return { group: g, body, basePos: new THREE.Vector3(anchor.x, floorY, anchor.z) };
}
