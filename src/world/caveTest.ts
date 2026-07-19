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

// Greybox test-bore materials — deliberately mid-grey (NOT the dark cave rock of the
// real deepCave), so the enabling-tech geometry reads clearly under review lighting.
// Two tones separate the walkable ramp/floor from the walls/roof. Real cave dressing
// (dark rock + torch dark-nav) is cycle 4+; this is the cycle-1 blockout.
const _rock = new THREE.MeshLambertMaterial({ color: 0x9c948a, flatShading: true });
const _rockDark = new THREE.MeshLambertMaterial({ color: 0x6f685f, flatShading: true });

export interface CaveTestBore {
  group: THREE.Group;
  body: RAPIER.RigidBody;
  probe: CaveTestProbe;
}

export interface CaveTestProbe {
  site: { x: number; z: number };
  gy: number;                 // surface height at the mouth
  chamberFloorY: number;      // world Y of the chamber / ramp-bottom floor
  roofUnderY: number;         // world Y of the chamber roof underside
  width: number;              // clear width between the side walls
  mouthX: number;             // world X of the mouth lip (snapped hole near edge)
  trenchFarX: number;         // world X where the trench ends / chamber begins
  chamberFarX: number;        // world X of the chamber far wall
  rampAngleDeg: number;       // the ramp's slope
  centerZ: number;            // world Z centreline
  /** Ordered world-space march waypoints: outside → mouth → ramp mid → chamber. */
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
  const CLEN = Tuning.CAVE_TEST_CHAMBER_LEN;
  const CEIL = Tuning.CAVE_TEST_CEIL_H;
  const T = Tuning.CAVE_TEST_WALL_T;
  const KERB = Tuning.CAVE_TEST_KERB;
  const OVER = 0.6;   // small overlap so welds/joints never leave a hairline gap

  // Surface height at the mouth centre — the ramp's near top. Use the PURE closed-form
  // height (the exact samples the tile bakes its heightfield/trimesh from), so the ramp
  // lip lands on the real ground.
  const gy = terrain.pureHeightAt(site.x, site.z);
  const chamberFloorY = gy - DEPTH;
  const roofUnderY = chamberFloorY + CEIL;

  // World X of the snapped hole edges + the chamber extent.
  const mouthX = block.xMin;
  const trenchFarX = block.xMax;
  const chamberFarX = trenchFarX + CLEN;
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
  const lTrench = trenchFarX - mouthX;   // trench far / chamber near
  const lCham = chamberFarX - mouthX;    // chamber far wall

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

  // ── Chamber floor — flat slab from the ramp bottom to the far wall. ──
  addBox(_rock,
    { x: CLEN * 0.5 + OVER, y: T * 0.5, z: HW },
    { x: (lTrench + lCham) * 0.5, y: chamberFloorY - T * 0.5, z: 0 });

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

  // ── Chamber side walls — floor to roof, entirely under the intact terrain sheet. ──
  const chamHalfY = (roofUnderY + T - (chamberFloorY - T)) * 0.5;
  const chamCenY = (roofUnderY + T + (chamberFloorY - T)) * 0.5;
  for (const sgn of [-1, 1] as const) {
    addBox(_rockDark,
      { x: CLEN * 0.5, y: chamHalfY, z: T * 0.5 },
      { x: (lTrench + lCham) * 0.5, y: chamCenY, z: sgn * (HW + T * 0.5) });
  }

  // ── Chamber roof — the ceiling under the intact terrain sheet (proves the D307
  //    under-sheet interior). Extends past the side walls so there's no top-corner gap. ──
  addBox(_rockDark,
    { x: CLEN * 0.5, y: T * 0.5, z: HW + T },
    { x: (lTrench + lCham) * 0.5, y: roofUnderY + T * 0.5, z: 0 });

  // ── Chamber far wall. ──
  addBox(_rock,
    { x: T * 0.5, y: (CEIL + 2 * T) * 0.5, z: HW + T },
    { x: lCham + T * 0.5, y: (chamberFloorY + roofUnderY) * 0.5, z: 0 });

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
    mouthX, trenchFarX, chamberFarX,
    rampAngleDeg: (theta * 180) / Math.PI,
    centerZ: cz,
    waypoints: [
      { name: 'outside', x: mouthX - 6, y: terrain.pureHeightAt(mouthX - 6, cz), z: cz },
      { name: 'mouth', x: mouthX + 1.0, y: gy, z: cz },
      { name: 'rampMid', x: (mouthX + trenchFarX) * 0.5, y: (gy + chamberFloorY) * 0.5, z: cz },
      { name: 'chamber', x: (trenchFarX + chamberFarX) * 0.5, y: chamberFloorY, z: cz },
    ],
  };
  g.userData.caveTestProbe = probe;

  return { group: g, body, probe };
}
