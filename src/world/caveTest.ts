// UNDERWORLD cycle 1 (2026-07-19, D307) — the cave ENABLING TECH: a chunk-local
// heightfield→trimesh collider swap with a REAL carved opening, proven by a greybox
// TEST bore. Behind FEATURES.caveTest / VITE_CAVE_TEST=1 (default OFF → the surface
// world is byte-identical; this whole module is dormant).
//
// THE PROBLEM (D307): the terrain heightfield is a TWO-SIDED sheet for the KCC — you
// can't pass through it from either face. So a cave mouth cannot be a mere hole in the
// VISUAL mesh; the COLLIDER must have a real opening too. A heightfield stores one
// height per cell and can't have a hole, so the entrance chunk swaps its heightfield
// collider for an equivalent TRIMESH (derived from the SAME height samples) with the
// hole triangles omitted (see terrain.ts). This module builds the bore that welds into
// that hole: a walkable ramp descending through the opening to a roofed chamber that
// sits UNDER the intact terrain sheet (proving D307's under-sheet trimesh interior).
//
// SEAM DISCIPLINE (the hab_dome / leviathan lesson): the hole is a GRID-ALIGNED block
// of terrain cells, so its boundary is exact terrain grid vertices. The bore is built
// to those exact snapped edges, with the trench walls rising to (terrain max + KERB) so
// there is never a gap between the terrain lip and the bore. `caveTestHoleBlock` is the
// SINGLE source of truth for the block — terrain.ts removes those cells; this module
// welds to the same edges.
//
// RULE 7 (thickness) / RULE 9 (collision matches visual): every bore surface is a real
// box volume (thickness CAVE_TEST_WALL_T); each box mesh declares a matching box
// collider via attachDeclaredColliders — collider == visual, exactly.
//
// This is cycle-1 ENABLING TECH only — greybox geometry. Real cave GENERATION is cycle 2.

import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { Terrain } from './terrain.ts';
import type { ColliderSpec } from '../physics/bodies.ts';
import { attachDeclaredColliders } from '../physics/bodies.ts';
import type { CaveJunction } from './caveGen.ts';
import { createStoneMaterial } from './stoneMaterial.ts';
import { makeRng } from '../core/rng.ts';
import { Tuning } from '../config/tuning.ts';

/** Deterministic near-origin TEST site — a PURE hash of the world seed (never
 *  consumes the shared procgen rand stream, so the seeded world is byte-identical:
 *  D208). Kept inside tile (0,0) with the whole bore extending +X so it never
 *  straddles a tile boundary (it streams with the boot ring). */
export function caveTestSite(seed: number): { x: number; z: number } {
  let h = (seed ^ 0xca7e5117) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0x45d9f3b) >>> 0;
  h ^= h >>> 16;
  const u = (h & 0xffff) / 0x10000;
  const v = ((h >>> 16) & 0xffff) / 0x10000;
  return {
    x: Tuning.CAVE_TEST_SITE_BOX_X0 + u * Tuning.CAVE_TEST_SITE_SPAN_X,   // [X0, X0+SPAN]
    z: -Tuning.CAVE_TEST_SITE_BOX_Z + v * (2 * Tuning.CAVE_TEST_SITE_BOX_Z), // [-Z, +Z]
  };
}

/** The grid-aligned hole = the cells the ENTRANCE CHUNK removes (the open trench,
 *  worldX ∈ [site.x, site.x+RAMP_RUN], worldZ ∈ [site.z ± WIDTH/2]). Snapped to the
 *  terrain grid so the boundary is exact grid vertices. Returned in BOTH cell indices
 *  (for terrain removal) and the exact snapped WORLD edges (for the bore weld). */
export interface CaveTestBlock {
  tileTx: number; tileTz: number;      // the entrance chunk (tile) coords
  iMin: number; iMax: number;          // removed cell index range (inclusive), i-axis (X)
  jMin: number; jMax: number;          // removed cell index range (inclusive), j-axis (Z)
  xMin: number; xMax: number;          // snapped world X edges of the hole (mouth / trench far)
  zMin: number; zMax: number;          // snapped world Z edges of the hole
}

export function caveTestHoleBlock(site: { x: number; z: number }): CaveTestBlock {
  const SIZE = Tuning.TERRAIN_CHUNK_SIZE;
  const CELLS = Tuning.TERRAIN_CHUNK_CELLS;
  const HW = Tuning.CAVE_TEST_WIDTH * 0.5;
  const tileTx = Math.round(site.x / SIZE);
  const tileTz = Math.round(site.z / SIZE);
  const centerX = tileTx * SIZE;
  const centerZ = tileTz * SIZE;
  const clampCell = (n: number): number => Math.max(0, Math.min(CELLS - 1, n));
  // Vertex i sits at localX = (i/CELLS - 0.5)*SIZE → worldX = centerX + localX.
  const iOf = (wx: number): number => ((wx - centerX) / SIZE + 0.5) * CELLS;
  const jOf = (wz: number): number => ((wz - centerZ) / SIZE + 0.5) * CELLS;
  const iMin = clampCell(Math.floor(iOf(site.x)));
  const iMax = clampCell(Math.ceil(iOf(site.x + Tuning.CAVE_TEST_RAMP_RUN)) - 1);
  const jMin = clampCell(Math.floor(jOf(site.z - HW)));
  const jMax = clampCell(Math.ceil(jOf(site.z + HW)) - 1);
  const vX = (i: number): number => centerX + (i / CELLS - 0.5) * SIZE;
  const vZ = (j: number): number => centerZ + (j / CELLS - 0.5) * SIZE;
  return {
    tileTx, tileTz, iMin, iMax, jMin, jMax,
    xMin: vX(iMin), xMax: vX(iMax + 1),
    zMin: vZ(jMin), zMax: vZ(jMax + 1),
  };
}

// Bore rock — natural cave stone (procedural grain + cracks + sand dust on up-faces so the ramp
// floor reads as sediment-dusted rock that ties to the desert above). Two tones: a lighter walkable
// ramp/floor, a darker cool wall/roof. Boulders (below) use the same palette. The mouth is dressed
// with tumbled rubble to read as a natural wind-exposed sinkhole, not a mine adit.
const _rock = createStoneMaterial(0x4d4238, { dustColor: 0xb89870, dustStrength: 0.8, crackDensity: 0.5 });
const _rockDark = createStoneMaterial(0x342c25, { dustColor: 0x9c855e, dustStrength: 0.45, crackDensity: 0.6 });
const _boulder = createStoneMaterial(0x413730, { dustColor: 0xb89870, dustStrength: 0.7, crackDensity: 0.55 });

export interface CaveTestBore {
  group: THREE.Group;
  body: RAPIER.RigidBody;
  probe: CaveTestProbe;
  /** The hand-off to the cave generator: the throat's open far end (cave node 0 sits just past). */
  junction: CaveJunction;
}

export interface CaveTestProbe {
  site: { x: number; z: number };
  gy: number;                 // surface height at the mouth
  chamberFloorY: number;      // world Y of the throat / ramp-bottom floor
  roofUnderY: number;         // world Y of the throat roof underside
  width: number;              // clear width between the side walls
  mouthX: number;             // world X of the mouth lip (snapped hole near edge)
  trenchFarX: number;         // world X where the trench ends / roofed throat begins
  chamberFarX: number;        // world X where the throat ends / the generated cave begins
  rampAngleDeg: number;       // the ramp's slope
  centerZ: number;            // world Z centreline
  /** Ordered world-space march waypoints: outside → mouth → ramp mid → throat. */
  waypoints: Array<{ name: string; x: number; y: number; z: number }>;
}

/** Build + place the greybox test bore, welded into the entrance-chunk hole. */
export function spawnCaveTestBore(
  scene: THREE.Scene,
  world: RAPIER.World,
  terrain: Terrain,
  site: { x: number; z: number },
): CaveTestBore {
  const block = caveTestHoleBlock(site);
  const HW = Tuning.CAVE_TEST_WIDTH * 0.5;
  const DEPTH = Tuning.CAVE_TEST_DEPTH;
  const THROAT = Tuning.CAVE_TEST_THROAT_LEN;
  const CEIL = Tuning.CAVE_TEST_THROAT_H;
  const T = Tuning.CAVE_TEST_WALL_T;
  const KERB = Tuning.CAVE_TEST_KERB;
  const OVER = 0.6;   // small overlap so welds/joints never leave a hairline gap

  // Surface height at the mouth centre — the ramp's near top. Use the PURE closed-form
  // height (the exact samples the tile bakes its heightfield/trimesh from), so the ramp
  // lip lands on the real ground.
  const gy = terrain.pureHeightAt(site.x, site.z);
  const chamberFloorY = gy - DEPTH;
  const roofUnderY = chamberFloorY + CEIL;

  // World X of the snapped hole edges + the throat extent.
  const mouthX = block.xMin;
  const trenchFarX = block.xMax;
  const throatFarX = trenchFarX + THROAT;       // roofed throat end → the generated cave begins here
  const cz = (block.zMin + block.zMax) * 0.5;   // Z centreline (≈ site.z)
  const runLocal = trenchFarX - mouthX;         // horizontal ramp run (snapped)
  const theta = Math.atan2(DEPTH, runLocal);    // ramp slope

  // Group at the mouth lip on the centreline; all children in LOCAL coords (localY = worldY).
  const g = new THREE.Group();
  g.name = 'caveTestBore';
  g.position.set(mouthX, 0, cz);

  const colliders: ColliderSpec[] = [];
  const addBox = (
    mat: THREE.Material,
    half: { x: number; y: number; z: number },
    pos: { x: number; y: number; z: number },
    quat?: { x: number; y: number; z: number; w: number },
  ): void => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(half.x * 2, half.y * 2, half.z * 2), mat);
    m.position.set(pos.x, pos.y, pos.z);
    if (quat) m.quaternion.set(quat.x, quat.y, quat.z, quat.w);
    m.castShadow = true; m.receiveShadow = true;
    g.add(m);
    colliders.push(quat ? { kind: 'box', half: { ...half }, pos: { ...pos }, quat } : { kind: 'box', half: { ...half }, pos: { ...pos } });
  };

  // Local X of the key stations (group is at mouthX).
  const lTrench = trenchFarX - mouthX;   // trench far / roofed throat near
  const lThroat = throatFarX - mouthX;   // throat far (open into the generated cave)

  // ── Ramp floor — a thin slab tilted at `theta`. Its top surface runs from the
  //    mouth lip (sunk a touch below the terrain edge so the transition is a gentle
  //    step DOWN, never a step-up wall) down to the chamber floor. CRITICAL: the slab
  //    is extended ONLY along the down-ramp direction (a symmetric box extended
  //    BACKWARD would tilt its back end UP above the terrain and wall off the mouth —
  //    the descent-blocker bug). Near end gets a tiny underlap; far end overlaps the
  //    chamber floor. ──
  {
    const NEAR_SINK = 0.2;                          // mouth lip sits this far below the terrain edge
    const NEAR_OVER = 0.3, FAR_OVER = OVER;         // slab extension past each top corner (along the ramp)
    const dx = runLocal, dy = chamberFloorY - (gy - NEAR_SINK);
    const L = Math.hypot(dx, dy);
    const ux = dx / L, uy = dy / L;                 // unit down-ramp direction
    const nx = -uy, ny = ux;                        // ramp up-normal (rotate dir +90°)
    // Top-surface corners (local: x from the group at mouthX, y = world y).
    const nearTopX = 0 - ux * NEAR_OVER, nearTopY = (gy - NEAR_SINK) - uy * NEAR_OVER;
    const farTopX = lTrench + ux * FAR_OVER, farTopY = chamberFloorY + uy * FAR_OVER;
    const topMidX = (nearTopX + farTopX) * 0.5, topMidY = (nearTopY + farTopY) * 0.5;
    const rampTheta = Math.atan2(dy, dx);           // slab tilt: local +X → down-ramp dir (dy<0 → negative)
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, rampTheta));
    addBox(_rock,
      { x: (L + NEAR_OVER + FAR_OVER) * 0.5, y: T * 0.5, z: HW },
      { x: topMidX - nx * (T * 0.5), y: topMidY - ny * (T * 0.5), z: 0 },
      { x: q.x, y: q.y, z: q.z, w: q.w });
  }

  // ── Throat floor — flat slab from the ramp bottom to the throat far end (the generated
  //    cave's floor picks up from here at the same Y). ──
  addBox(_rock,
    { x: THROAT * 0.5 + OVER, y: T * 0.5, z: HW },
    { x: (lTrench + lThroat) * 0.5, y: chamberFloorY - T * 0.5, z: 0 });

  // ── Trench side walls — from below the ramp up to (terrain max + KERB) so they weld
  //    to the terrain lip with no gap. Sampled along each wall line over the trench. ──
  let terrMax = gy;
  for (let s = 0; s <= 8; s++) {
    const wx = mouthX + (runLocal * s) / 8;
    terrMax = Math.max(terrMax, terrain.pureHeightAt(wx, block.zMin), terrain.pureHeightAt(wx, block.zMax));
  }
  const trenchTopY = terrMax + KERB;
  const trenchBotY = chamberFloorY - T - 0.3;
  for (const sgn of [-1, 1] as const) {
    addBox(_rockDark,
      { x: lTrench * 0.5 + T, y: (trenchTopY - trenchBotY) * 0.5, z: T * 0.5 },
      { x: lTrench * 0.5, y: (trenchTopY + trenchBotY) * 0.5, z: sgn * (HW + T * 0.5) });
  }

  // ── Throat side walls — floor to roof, under the intact terrain sheet. ──
  const chamHalfY = (roofUnderY + T - (chamberFloorY - T)) * 0.5;
  const chamCenY = (roofUnderY + T + (chamberFloorY - T)) * 0.5;
  for (const sgn of [-1, 1] as const) {
    addBox(_rockDark,
      { x: THROAT * 0.5 + OVER, y: chamHalfY, z: T * 0.5 },
      { x: (lTrench + lThroat) * 0.5, y: chamCenY, z: sgn * (HW + T * 0.5) });
  }

  // ── Throat roof — the lintel/ceiling under the intact terrain sheet (proves the D307
  //    under-sheet interior). Extends past the side walls so there's no top-corner gap.
  //    NO far wall: the throat's far end is OPEN — the generated cave (caveGen) welds on. ──
  addBox(_rockDark,
    { x: THROAT * 0.5 + OVER, y: T * 0.5, z: HW + T },
    { x: (lTrench + lThroat) * 0.5, y: roofUnderY + T * 0.5, z: 0 });

  // ── Natural mouth dressing: tumbled boulders + rubble around the rim, so the opening reads as a
  //    wind-exposed SINKHOLE (collapse-tapered, broken collar) rather than an engineered adit. All
  //    NON-colliding decoration (like rock scatter) — the proven box collision + terrain weld are
  //    untouched, and boulders sit OUTSIDE the clear walk width so they never trip the walk gate. ──
  {
    const brand = makeRng(((Math.round(site.x) * 73856093) ^ (Math.round(site.z) * 19349663)) >>> 0);
    const addBoulder = (wx: number, wz: number, baseR: number, sink: number, y?: number): void => {
      const yy = y ?? terrain.pureHeightAt(wx, wz);
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(baseR, 0), _boulder);
      m.position.set(wx - mouthX, yy - sink, wz - cz);
      m.rotation.set(brand() * 0.8, brand() * Math.PI * 2, brand() * 0.8);
      m.scale.set(1, 0.55 + brand() * 0.4, 1);
      m.castShadow = true; m.receiveShadow = true;
      g.add(m);
    };
    const RIM = HW + 0.5;
    // Rim boulders crowding the two long trench edges (gappy → irregular, breaks the straight lip).
    for (let s = 0; s <= 15; s++) {
      const wx = mouthX - 2.6 + (runLocal + 4.5) * (s / 15);
      for (const sgn of [-1, 1] as const) {
        if (brand() < 0.18) continue;
        addBoulder(wx, cz + sgn * (RIM + brand() * 2.0), 0.5 + brand() * 1.1, 0.25 + brand() * 0.45);
      }
    }
    // Broken collar of bigger chunks crowding the wind-exposed near lip (the sinkhole read).
    for (let s = 0; s <= 8; s++) {
      if (brand() < 0.18) continue;
      const wz = cz - HW - 0.8 + (2 * HW + 1.6) * (s / 8);
      addBoulder(mouthX - 1.6 - brand() * 1.6, wz, 0.65 + brand() * 1.2, 0.3 + brand() * 0.5);
    }
    // A few collapse boulders tumbled onto the ramp (biased to the trench SIDES, off the walk line).
    for (let i = 0; i < 4; i++) {
      const t = 0.18 + brand() * 0.5;
      const wx = mouthX + runLocal * t;
      const wz = cz + (brand() < 0.5 ? -1 : 1) * (HW * 0.55 + brand() * 0.4);
      const rampY = (gy - 0.2) + (chamberFloorY - (gy - 0.2)) * t;
      addBoulder(wx, wz, 0.35 + brand() * 0.5, -0.15, rampY);
    }
  }

  scene.add(g);
  const body = attachDeclaredColliders(world, g, colliders);

  // Declare the entrance (the leviathan lesson): excuses the mouth from open-end / walkin
  // sealing checks and gives a walk probe its true target. Mesh-LOCAL, on the group.
  g.userData.intendedOpening = {
    center: { x: 0, y: gy - 1.2, z: 0 },
    radius: Math.max(HW, 2.0) + 0.5,
  };

  const probe: CaveTestProbe = {
    site,
    gy, chamberFloorY, roofUnderY,
    width: Tuning.CAVE_TEST_WIDTH,
    mouthX, trenchFarX, chamberFarX: throatFarX,
    rampAngleDeg: (theta * 180) / Math.PI,
    centerZ: cz,
    waypoints: [
      { name: 'outside', x: mouthX - 6, y: terrain.pureHeightAt(mouthX - 6, cz), z: cz },
      { name: 'mouth', x: mouthX + 1.0, y: gy, z: cz },
      { name: 'rampMid', x: (mouthX + trenchFarX) * 0.5, y: (gy + chamberFloorY) * 0.5, z: cz },
      { name: 'throat', x: (trenchFarX + throatFarX) * 0.5, y: chamberFloorY, z: cz },
    ],
  };
  g.userData.caveTestProbe = probe;

  // Hand-off to the cave generator: the throat's open far end, on the centreline, at floor level.
  const junction: CaveJunction = {
    x: throatFarX, y: chamberFloorY, z: cz,
    gy, width: Tuning.CAVE_TEST_WIDTH,
    heading: { x: 1, z: 0 },
  };

  return { group: g, body, probe, junction };
}
