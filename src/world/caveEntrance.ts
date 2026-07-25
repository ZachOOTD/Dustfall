// DEEPER cycle 4 (2026-07-25) — THE CREVICE ENTRANCE. Replaces `caveTest.ts`, the UNDERWORLD
// cycle-1 greybox bore, which never got replaced and shipped: an 8.34m-wide × 29.2m-long snapped
// rectangular trench with a slab ramp. Zach's walk-test, D-1:
//
//   "i didn't like the entrance, it still had the greybox and was more like a massive ramp. i want
//    the entrance to the cave to be more like a small opening like a crevice in a rock that leads
//    you down. not a wide open ramp."
//
// WHAT SHIPS NOW
//   A rock OUTCROP — a whaleback tor rising ~6m out of the sand, ~19 × 13m, split end-to-end by a
//   FISSURE ~2.5m clear at the mouth. You spot the tor from a distance; the opening itself is a
//   crack. The fissure floor drops away at ~30° from the moment you step in; the rock closes over
//   your head CREVICE_SKY_RUN metres in (the committing beat), and the slot then bends twice as it
//   descends under the intact terrain sheet to the cave hand-off 12m down.
//
// HOW IT IS BUILT — two surfaces, and the seam between them cannot leak (rule 7 / D-2):
//   1. THE DESCENT SLOT is a chain of primitives in the SAME SDF field as the cave itself
//      (`CaveJunction.slot` → `buildCaveSdf`), so there is no weld between entrance and cave at
//      all — one watertight surface from the sky down to the egg chamber. It is CUT against the
//      terrain surface (triangles above `pureHeightAt` are dropped) instead of cycle 1's
//      placeholder junction-plane cut.
//   2. THE TOR is its own watertight surface-nets solid (same polygonizer, `surfaceNets`): a slab
//      between a rock-top height field (terrain + apron + fin + relief) and a buried underside,
//      with the fissure carved out of it. Its footprint COVERS the whole carved terrain hole, so
//      the one-sided terrain sheet is never seen from underneath — the job cycle 1's trench walls
//      did with boxes.
//   THE NON-LEAK INVARIANT: the tor's fissure is always CREVICE_SDF_MARGIN narrower and lower than
//   the SDF slot around it. So every scrap of air the player can reach is inside the SDF cavity,
//   and the tor's rock is the NEARER surface — a backface void is impossible by construction. (Get
//   this backwards and you stand in air that the SDF calls rock, looking at a culled face: the
//   exact D-2 see-through.)
//
// D307 IS UNCHANGED. The entrance chunk still swaps its heightfield collider for a trimesh with a
// genuinely carved hole; the hole just got much smaller (3×2 cells = 12.5 × 8.33m, all of it under
// the tor). No portals, no teleports. The site hash is SNAPPED to a terrain grid vertex so the hole
// is the same size on every seed and the tor can be sized to cover it exactly.
//
// RULE 9: the tor's collider is a Rapier trimesh baked from the EXACT triangles that are drawn.

import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { createNoise3D } from 'simplex-noise';
import type { Terrain } from './terrain.ts';
import { makeStaticTrimesh } from '../physics/bodies.ts';
import { makeRng } from '../core/rng.ts';
import { Tuning } from '../config/tuning.ts';
import type { CaveJunction, CreviceStation } from './caveGen.ts';
import { makeCaveRockMaterial } from './caveGen.ts';
import { caveVertexColor, surfaceNets } from './caveSdf.ts';

/** The tor's rock: the cave-surface material with its own (much weaker) bump uniform — same
 *  compiled program. See the round-1 note in caveGen.ts: the interior's 1.15 reads as camouflage
 *  mottle on a sunlit exterior. */
const _torRock = makeCaveRockMaterial(Tuning.CREVICE_TOR_BUMP);

/** Deterministic near-origin site — a PURE hash of the world seed (never consumes the shared
 *  procgen rand stream, so the seeded surface world is byte-identical: D208). SNAPPED to a terrain
 *  grid vertex (cycle 4): the carved hole is then always exactly CREVICE_HOLE_CELLS_X × _Z cells,
 *  so the tor's cover footprint is a constant instead of varying by up to a cell per side. */
export function caveEntranceSite(seed: number): { x: number; z: number } {
  let h = (seed ^ 0xca7e5117) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0x45d9f3b) >>> 0;
  h ^= h >>> 16;
  const u = (h & 0xffff) / 0x10000;
  const v = ((h >>> 16) & 0xffff) / 0x10000;
  const CELL = Tuning.TERRAIN_CHUNK_SIZE / Tuning.TERRAIN_CHUNK_CELLS;
  const rawX = Tuning.CAVE_SITE_BOX_X0 + u * Tuning.CAVE_SITE_SPAN_X;
  const rawZ = -Tuning.CAVE_SITE_BOX_Z + v * (2 * Tuning.CAVE_SITE_BOX_Z);
  return { x: Math.round(rawX / CELL) * CELL, z: Math.round(rawZ / CELL) * CELL };
}

/** The grid-aligned block of terrain cells the entrance chunk removes. The mouth sits on the
 *  vertex at `site`; the block reaches one cell BEHIND it (so you walk in over rock, not over a
 *  terrain lip) and CREVICE_HOLE_CELLS_X-1 cells ahead — long enough to contain the whole
 *  sky-open run, and no longer. Every cell of it is covered by the tor. */
export interface CaveHoleBlock {
  tileTx: number; tileTz: number;
  iMin: number; iMax: number;
  jMin: number; jMax: number;
  xMin: number; xMax: number;
  zMin: number; zMax: number;
}

export function caveEntranceHoleBlock(site: { x: number; z: number }): CaveHoleBlock {
  const SIZE = Tuning.TERRAIN_CHUNK_SIZE;
  const CELLS = Tuning.TERRAIN_CHUNK_CELLS;
  const tileTx = Math.round(site.x / SIZE);
  const tileTz = Math.round(site.z / SIZE);
  const centerX = tileTx * SIZE;
  const centerZ = tileTz * SIZE;
  const clampCell = (n: number): number => Math.max(0, Math.min(CELLS - 1, n));
  const iOf = (wx: number): number => ((wx - centerX) / SIZE + 0.5) * CELLS;
  const jOf = (wz: number): number => ((wz - centerZ) / SIZE + 0.5) * CELLS;
  const i0 = Math.round(iOf(site.x));            // site is snapped → this IS a vertex index
  const j0 = Math.round(jOf(site.z));
  const nz = Tuning.CREVICE_HOLE_CELLS_Z;
  const iMin = clampCell(i0 - 1);
  const iMax = clampCell(i0 - 1 + Tuning.CREVICE_HOLE_CELLS_X - 1);
  const jMin = clampCell(j0 - Math.floor(nz / 2));
  const jMax = clampCell(jMin + nz - 1);
  const vX = (i: number): number => centerX + (i / CELLS - 0.5) * SIZE;
  const vZ = (j: number): number => centerZ + (j / CELLS - 0.5) * SIZE;
  return {
    tileTx, tileTz, iMin, iMax, jMin, jMax,
    xMin: vX(iMin), xMax: vX(iMax + 1), zMin: vZ(jMin), zMax: vZ(jMax + 1),
  };
}

// ── The slot centreline ─────────────────────────────────────────────────────
//
// Three legs, each sized run = drop / tan(CREVICE_SLOPE_DEG), with two knees. A straight ramp was
// the thing that read as a driveway; the knees are what make the descent feel like following a
// joint in the rock. The first leg runs straight so the sky-open section stays inside the carved
// hole's Z span; the bends happen after the rock has closed overhead.
//
// The cover guard only ever DEEPENS a station (never raises it): the slot's roof must stay
// CREVICE_HEIGHT + 1.4m below the real terrain once it is roofed, or a dune valley ahead of the
// mouth would slice the ceiling open.

export interface CreviceLine {
  stations: CreviceStation[];      // mouth (s=0) … junction, world space
  cumS: number[];                  // arc length at each station
  totalS: number;
  gy: number;                      // terrain height at the mouth
  maxSlopeDeg: number;
}

/** Half-width at arc length `s` — mouth → pinch → widening into the cave. */
function halfWAt(s: number, totalS: number): number {
  const T = Tuning;
  const sm = (a: number, b: number, x: number): number => {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  const pinchAt = T.CREVICE_SKY_RUN + T.CREVICE_SKY_TAPER * 0.5;
  if (s <= pinchAt) return T.CREVICE_HALF_W_MOUTH + (T.CREVICE_HALF_W_PINCH - T.CREVICE_HALF_W_MOUTH) * sm(0, pinchAt, s);
  return T.CREVICE_HALF_W_PINCH + (T.CREVICE_HALF_W_DEEP - T.CREVICE_HALF_W_PINCH) * sm(pinchAt, totalS, s);
}

export function buildCreviceLine(site: { x: number; z: number }, terrain: Terrain, seed: number): CreviceLine {
  const T = Tuning;
  const gy = terrain.pureHeightAt(site.x, site.z);
  const tanS = Math.tan((T.CREVICE_SLOPE_DEG * Math.PI) / 180);
  const mirror = (seed & 1) === 0 ? 1 : -1;            // which way the first knee swings
  const legs: Array<{ ang: number; drop: number }> = [
    { ang: 0, drop: T.CREVICE_DEPTH * 0.29 },
    { ang: mirror * T.CREVICE_BEND_DEG, drop: T.CREVICE_DEPTH * 0.33 },
    { ang: mirror * (T.CREVICE_BEND_DEG - T.CREVICE_BEND2_DEG), drop: T.CREVICE_DEPTH * 0.38 },
  ];

  const stations: CreviceStation[] = [];
  const cumS: number[] = [];
  // R2 — the slot floor starts level with the APRON top, not with the raw terrain: round 1 put a
  // 0.5m drop right at the lip, so stepping in read as falling into a notch cut in a slab. The rise
  // is bled off over the first couple of metres, after which the nominal descent takes over.
  let x = site.x, z = site.z, y = gy + T.CREVICE_APRON_RISE, s = 0;
  stations.push({ x, z, floorY: y, halfW: 0, height: T.CREVICE_HEIGHT });
  cumS.push(0);
  let dropped = 0;
  for (const leg of legs) {
    const run = leg.drop / tanS;
    const a = (leg.ang * Math.PI) / 180;
    // Split each leg in two so the SDF's per-segment linear floor tracks the cover guard.
    for (let k = 0; k < 2; k++) {
      x += Math.cos(a) * run * 0.5;
      z += Math.sin(a) * run * 0.5;
      s += run * 0.5;
      dropped += leg.drop * 0.5;
      y = gy + T.CREVICE_APRON_RISE * Math.max(0, 1 - s / 3.0) - dropped;
      stations.push({ x, z, floorY: y, halfW: 0, height: T.CREVICE_HEIGHT });
      cumS.push(s);
    }
  }
  // (arc lengths are recomputed after the run re-sizing below)

  // COVER GUARD — deepen (never raise) any roofed station whose ceiling would breach the sheet.
  for (let i = 1; i < stations.length; i++) {
    const st = stations[i];
    if (cumS[i] < T.CREVICE_SKY_RUN) continue;
    let terrH = terrain.pureHeightAt(st.x, st.z);
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2;
      terrH = Math.min(terrH, terrain.pureHeightAt(st.x + Math.cos(a) * 2.5, st.z + Math.sin(a) * 2.5));
    }
    const maxFloor = terrH - T.CREVICE_HEIGHT - 1.0;
    if (st.floorY > maxFloor) st.floorY = maxFloor;
    if (st.floorY > stations[i - 1].floorY) st.floorY = stations[i - 1].floorY;   // monotone descent
  }

  // RUN RE-SIZING — the same trick the room-graph uses on its corridors, and for the same reason.
  // The cover guard only knows how to DEEPEN a station, which silently steepens the leg into it
  // (round 7: a nominal 27° descent came out at 33.8° and the KCC could descend but not climb back,
  // so `ascent=FAIL`). So after the guard, any leg that is too steep is LENGTHENED — the station and
  // everything past it slide further along that leg's heading until the slope is back at target.
  // Slope ≤ CREVICE_SLOPE_DEG is then true by construction, not by hope.
  for (let i = 1; i < stations.length; i++) {
    const a = stations[i - 1], b = stations[i];
    const dx = b.x - a.x, dz = b.z - a.z;
    const d = Math.hypot(dx, dz) || 1;
    const drop = a.floorY - b.floorY;
    if (drop <= 0) continue;
    const need = drop / tanS;
    if (need <= d + 0.01) continue;
    const push = need - d;
    const ux = dx / d, uz = dz / d;
    for (let k = i; k < stations.length; k++) { stations[k].x += ux * push; stations[k].z += uz * push; }
  }
  // arc lengths changed with the re-sizing
  { let acc = 0; cumS[0] = 0;
    for (let i = 1; i < stations.length; i++) {
      acc += Math.hypot(stations[i].x - stations[i - 1].x, stations[i].z - stations[i - 1].z);
      cumS[i] = acc;
    } }
  const totalS2 = cumS[cumS.length - 1];

  let maxSlopeDeg = 0;
  for (let i = 1; i < stations.length; i++) {
    const dx = Math.hypot(stations[i].x - stations[i - 1].x, stations[i].z - stations[i - 1].z);
    const dy = Math.abs(stations[i].floorY - stations[i - 1].floorY);
    if (dx > 0.2) maxSlopeDeg = Math.max(maxSlopeDeg, (Math.atan2(dy, dx) * 180) / Math.PI);
    stations[i].halfW = halfWAt(cumS[i], totalS2);
  }
  stations[0].halfW = halfWAt(0, totalS2);
  return { stations, cumS, totalS: totalS2, gy, maxSlopeDeg };
}

/** Nearest-point projection of an XZ point onto the slot polyline. */
interface SlotProj { s: number; perp: number; floorY: number; halfW: number; }
function projectSlot(line: CreviceLine, x: number, z: number): SlotProj {
  let best = Infinity, bs = 0, bperp = 0, bfloor = line.gy;
  const st = line.stations;
  for (let i = 1; i < st.length; i++) {
    const ax = st[i - 1].x, az = st[i - 1].z;
    const dx = st[i].x - ax, dz = st[i].z - az;
    const len2 = dx * dx + dz * dz || 1;
    let t = ((x - ax) * dx + (z - az) * dz) / len2;
    // Extend past the ends so the projection is defined outside the polyline too (the mouth
    // approach lives at s < 0, and the fissure runs on past the tor's far face).
    if (i === 1) t = Math.min(t, 1); else if (i === st.length - 1) t = Math.max(t, 0); else t = Math.min(1, Math.max(0, t));
    const px = ax + dx * t, pz = az + dz * t;
    const d = Math.hypot(x - px, z - pz);
    if (d < best) {
      best = d;
      const segLen = Math.sqrt(len2);
      bs = line.cumS[i - 1] + segLen * t;
      // signed side (left/right of the segment) — used for per-side asymmetry
      bperp = ((x - ax) * dz - (z - az) * dx) / segLen;
      // Before the mouth (s<0) the floor is FLAT at the mouth level, never extrapolated up the ramp:
      // extrapolating raised the approach channel ~2m above the sand, so the KCC met a wall where
      // the doorway should be and climbed over the tor instead (round-7 cave-walk, slot1 X).
      bfloor = bs <= 0 ? st[0].floorY : st[i - 1].floorY + (st[i].floorY - st[i - 1].floorY) * t;
    }
  }
  return { s: bs, perp: bperp, floorY: bfloor, halfW: halfWAt(Math.max(0, bs), line.totalS) };
}

// ── The tor ────────────────────────────────────────────────────────────────

export interface CaveEntranceProbe {
  site: { x: number; z: number };
  gy: number;                 // surface height at the mouth
  chamberFloorY: number;      // world Y of the junction floor (the cave hand-off)
  roofUnderY: number;         // world Y of the slot roof underside at the junction
  width: number;              // clear width at the junction (the cave's throat width)
  mouthX: number;             // world X of the mouth
  trenchFarX: number;         // world X where the rock closes overhead (the "committing" beat)
  chamberFarX: number;        // world X of the junction
  descentAngleDeg: number;    // the crevice's own floor slope (reported separately from corridors)
  mouthClearW: number;        // clear width at the mouth (the crevice read, in metres)
  pinchClearW: number;        // clear width at the tightest point
  torHeight: number;          // m the tor's fin stands above local terrain
  centerZ: number;
  torTris: number;
  msTor: number;
  /** Ordered world-space march waypoints: outside → mouth → each slot station → junction. */
  waypoints: Array<{ name: string; x: number; y: number; z: number }>;
}

export interface CaveEntrance {
  group: THREE.Group;
  body: RAPIER.RigidBody | null;
  probe: CaveEntranceProbe;
  junction: CaveJunction;
  line: CreviceLine;
}

/** Build + place the crevice: the tor solid (visual + trimesh collider) and the hand-off that
 *  carries the descent slot into the cave's own SDF field. */
export function spawnCaveEntrance(
  scene: THREE.Scene,
  world: RAPIER.World,
  terrain: Terrain,
  site: { x: number; z: number },
  seed: number,
): CaveEntrance {
  const T = Tuning;
  const t0 = performance.now();
  const block = caveEntranceHoleBlock(site);
  const line = buildCreviceLine(site, terrain, seed);
  const st = line.stations;
  const last = st[st.length - 1];
  const gy = line.gy;

  const noise3 = createNoise3D(makeRng((seed ^ 0x70120c) >>> 0));
  const cnoise = createNoise3D(makeRng((seed ^ 0x7011c0) >>> 0));

  // ── The rock-top height field. terrain + apron (covers the carved hole) + fin (the landmark)
  //    + multi-octave relief. Evaluated ONCE per grid column — the whole field is 2.5D apart from
  //    the fissure walls, which is what keeps a 0.32m grid affordable. ──
  const APRON = T.CREVICE_APRON_RISE, AMARG = T.CREVICE_APRON_MARGIN, AFALL = T.CREVICE_APRON_FALL;
  const holeDist = (x: number, z: number): number => {
    const dx = Math.max(block.xMin - AMARG - x, 0, x - (block.xMax + AMARG));
    const dz = Math.max(block.zMin - AMARG - z, 0, z - (block.zMax + AMARG));
    return Math.hypot(dx, dz);
  };

  // Grid AABB: the hole + apron + fall, unioned with the slot's own extent (the fissure has to run
  // out of the tor's far face into the SDF slot, so the grid must contain that face).
  const R = AMARG + AFALL + 1.4;
  let gx0 = block.xMin - R, gx1 = block.xMax + R, gz0 = block.zMin - R, gz1 = block.zMax + R;
  for (const s of st) {
    if (s.x < gx0 + 3 || s.x > gx1 - 3) { /* the slot leaves the tor — that is expected */ }
    gz0 = Math.min(gz0, s.z - 3.0); gz1 = Math.max(gz1, s.z + 3.0);
  }
  gz0 = Math.max(gz0, block.zMin - R); gz1 = Math.min(gz1, block.zMax + R);
  const VOX = T.CREVICE_TOR_VOXEL;
  const nx = Math.ceil((gx1 - gx0) / VOX), nz = Math.ceil((gz1 - gz0) / VOX);
  const cw = nx + 1, cd = nz + 1;

  // Per-column precompute.
  const colTop = new Float32Array(cw * cd);        // rock-top Y
  const colBot = new Float32Array(cw * cd);        // underside Y
  const colFloor = new Float32Array(cw * cd);      // fissure floor Y at this column
  const colHW = new Float32Array(cw * cd);         // fissure half-width
  const colRoof = new Float32Array(cw * cd);       // fissure roof Y (BIG where open to the sky)
  const colPerp = new Float32Array(cw * cd);       // signed distance from the slot axis
  const colBound = new Float32Array(cw * cd);      // horizontal closure term
  const BIG = 1e4;
  let yLo = Infinity, yHi = -Infinity;
  const SKY = T.CREVICE_SKY_RUN, TAPER = T.CREVICE_SKY_TAPER;
  const smoothstep = (a: number, b: number, x: number): number => {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  for (let k = 0; k <= nz; k++) {
    const wz = gz0 + k * VOX;
    for (let i = 0; i <= nx; i++) {
      const wx = gx0 + i * VOX;
      const o = k * cw + i;
      const terrH = terrain.pureHeightAt(wx, wz);
      const pr = projectSlot(line, wx, wz);
      // R2 — the apron's outline is NOISE-WOBBLED and its falloff is long, because R1's clean
      // rounded-rectangle plateau read as a flat pancake / lily pad lying on the sand rather than
      // as bedrock emerging from it. Same job (cover every carved cell), no hard rim.
      // R3 — the wobble may only ever EXPAND the apron. R2 let it subtract in both directions, so
      // over part of the carved hole the apron fell BELOW the terrain and the one-sided sheet's
      // absence showed as black void wedges on the sand (scen-cave-look-r2-threshold.png). Coverage
      // of every carved cell is a correctness invariant, not a look choice — so it is also clamped
      // outright inside the hole rect below, independent of any noise value.
      const d0 = holeDist(wx, wz);
      const dbWob = d0 - (0.55 + 0.95 * (noise3(wx * 0.06 + 91, 5.5, wz * 0.06 + 37) * 0.5 + 0.5));
      let apron = APRON - Math.min(1, Math.max(0, dbWob) / AFALL) * (APRON + 2.1);
      // R4 — break the apron out of a flat plateau into low bedrock LEDGES. R3's apron read as a
      // poured concrete platform: 23m across and geometrically flat, because the only relief it got
      // was the 0.30-weighted tail of the fin's noise term.
      apron += (noise3(wx * 0.13 + 5, 9.1, wz * 0.13 + 44) * 0.34 + noise3(wx * 0.36 + 23, 4.4, wz * 0.36 + 2) * 0.16) * 0.9;
      if (d0 <= 0.001) apron = APRON;                 // inside hole+margin: full cover, always
      // The fin. R1 used perpFade² and got a pair of sharp CONES ("Mount Fuji with a notch"). Real
      // fissured bedrock is blocky: a PLATEAU beside the crack with steep flanks. So the profile is
      // a plateau out to FIN_PLATEAU then a hard shoulder, and the top is clamped flat-ish.
      const ap0 = Math.abs(pr.perp);
      const along = smoothstep(-5.2, -1.6, pr.s) * (1 - smoothstep(block.xMax - site.x + 0.5, block.xMax - site.x + 6.2, pr.s));
      const plateau = 1 - smoothstep(T.CREVICE_TOR_FIN_PLATEAU, T.CREVICE_TOR_FIN_SPREAD, ap0);
      // Per-side asymmetry — one wall of a fissure is always the taller one.
      const sideBias = pr.perp > 0 ? 1.0 : 0.78;
      const fin = T.CREVICE_TOR_FIN_H * along * plateau * sideBias;
      let top = terrH + Math.max(apron, fin);
      // Relief: strong on the fin, gentle on the apron. Three octaves, the coarsest wide enough to
      // break the plateau into distinct blocks rather than dimple it.
      const relief = noise3(wx * 0.055, 3.1, wz * 0.055) * 0.60
                   + noise3(wx * 0.16 + 11, 7.3, wz * 0.16 + 5) * 0.28
                   + noise3(wx * 0.44 + 29, 2.2, wz * 0.44 + 17) * 0.12;
      top += relief * T.CREVICE_TOR_NOISE * (0.55 + 0.45 * Math.min(1, fin / Math.max(0.5, T.CREVICE_TOR_FIN_H * 0.45)));
      colTop[o] = top;
      colBot[o] = Math.min(terrH - 3.0, pr.floorY - 1.8);
      // The tor's fissure floor sits 12cm ABOVE the SDF slot floor, not below it. Carving below
      // left a 45cm GUTTER along both walls (the SDF slot is 0.62m wider than the fissure, so its
      // floor ran on past the tor's wall base and then dropped to the tor's carve floor) — deeper
      // than the KCC's 0.3m autostep, so a capsule that drifted into it on the climb out was wedged.
      // That was the `ascent=FAIL` on half the seed net. Above, the tor owns the walking surface.
      colFloor[o] = pr.floorY + 0.12;
      colHW[o] = pr.halfW;
      colPerp[o] = pr.perp;
      // Roof: open to the sky over the first SKY metres, then closes to the slot ceiling.
      const closed = smoothstep(SKY, SKY + TAPER, pr.s);
      colRoof[o] = closed <= 0 ? BIG : (closed >= 1 ? pr.floorY + T.CREVICE_HEIGHT
        : pr.floorY + T.CREVICE_HEIGHT + (1 - closed) * 60);
      colBound[o] = AFALL + 1.0 - Math.max(0, dbWob);  // >0 inside the tor's footprint, <0 outside
      if (colBot[o] < yLo) yLo = colBot[o];
      if (top > yHi) yHi = top;
    }
  }
  const gy0 = yLo - VOX * 2, gy1 = yHi + VOX * 2;
  const ny = Math.ceil((gy1 - gy0) / VOX);
  const ch = ny + 1;

  // ── Field: solid slab (bot..top) ∩ footprint, minus the fissure. Positive = rock. ──
  const field = new Float32Array(cw * ch * cd);
  const WN = T.CREVICE_WALL_NOISE, WNF = T.CREVICE_WALL_NOISE_FLOOR;
  for (let k = 0; k <= nz; k++) {
    for (let i = 0; i <= nx; i++) {
      const c = k * cw + i;
      const top = colTop[c], bot = colBot[c], fl = colFloor[c], hw = colHW[c], roof = colRoof[c];
      const perp = colPerp[c], bound = colBound[c];
      const ap = Math.abs(perp);
      const wx = gx0 + i * VOX, wz = gz0 + k * VOX;
      for (let j = 0; j <= ny; j++) {
        const wy = gy0 + j * VOX;
        let f = Math.min(top - wy, wy - bot, bound);
        if (f > -1.2 && ap < hw + 2.2) {
          // Fissure walls get 3D rock noise, attenuated toward the floor so the WALKABLE width
          // stays honest (the crevice character lives above head height, where you look).
          const att = WNF + (1 - WNF) * Math.min(1, Math.max(0, (wy - fl - 0.9) / 2.4));
          const wn = (noise3(wx * 0.33 + 61, wy * 0.26, wz * 0.33 + 13) * 0.68
                    + noise3(wx * 0.78 + 7, wy * 0.61, wz * 0.78 + 41) * 0.32) * WN * att;
          const dFis = Math.max(ap - (hw + wn), fl - wy, wy - roof);
          f = Math.min(f, dFis);
        }
        field[(k * ch + j) * cw + i] = f;
      }
    }
  }

  const nets = surfaceNets(field, cw, ch, cd, gx0, gy0, gz0, VOX);
  const nv = nets.vx.length;
  const pos = new Float32Array(nv * 3);
  for (let v = 0; v < nv; v++) { pos[v * 3] = nets.vx[v]; pos[v * 3 + 1] = nets.vy[v]; pos[v * 3 + 2] = nets.vz[v]; }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setIndex(nets.idx);
  geo.computeVertexNormals();

  // ── Vertex colour: sun-bleached desert rock outside, blending to the cave palette as the
  //    surface drops into the fissure. Same palette function as the cave body (one copy). ──
  const nrm = geo.attributes.normal as THREE.BufferAttribute;
  const col = new Float32Array(nv * 3);
  const c = new THREE.Color();
  for (let v = 0; v < nv; v++) {
    const wx = nets.vx[v], wy = nets.vy[v], wz = nets.vz[v];
    caveVertexColor('wall', wx, wy, wz, 0, cnoise, c, nrm.getY(v));
    // depth below the local terrain → 0 at/above the surface, 1 by 3.5m down
    const tH = terrain.pureHeightAt(wx, wz);
    const dEx = 1 - Math.min(1, Math.max(0, (tH - wy) / 3.5));
    if (dEx > 0) {
      // Sun-baked exterior tone. R2: R1's tone was as dark as the cave palette, so from 34m the
      // outcrop read as a black lump against sunlit sand — a landmark you notice but can't identify
      // as rock. Lifted to real desert-rock value, with only a gentle bleach variation (the cave
      // palette's ±0.55 mineral staining is an INTERIOR read and gets blended out up here).
      const bleach = 0.5 + 0.5 * cnoise(wx * 0.05 + 3, 1.7, wz * 0.05 + 8);
      const strat = 0.04 * Math.sin(wy * 1.35 + cnoise(wx * 0.03, 0, wz * 0.03) * 2.2);
      const ex = new THREE.Color(
        0.635 + bleach * 0.11 + strat, 0.560 + bleach * 0.097 + strat, 0.455 + bleach * 0.078 + strat,
      ).convertSRGBToLinear();
      c.lerp(ex, dEx * 0.95);
    }
    col[v * 3] = c.r; col[v * 3 + 1] = c.g; col[v * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));

  const group = new THREE.Group();
  group.name = 'caveEntrance';
  const mesh = new THREE.Mesh(geo, _torRock);
  mesh.name = 'caveCreviceTor';
  // R5/R6 — the dark camouflage blobs that covered the outcrop in rounds 1-5 were NOT shadow acne
  // (R5 turned receiveShadow off and the frame was byte-identical): they were the cave surface
  // shader's normal perturbation, whose strength is tuned for torch-lit interior rock at 2m. R6 at
  // CREVICE_TOR_BUMP 0 was clean, so the tor keeps a token 0.05 to break the 0.32m facets and no
  // more. Shadows stay ON: the tor's cast shadow into its own fissure is what makes the slot dark.
  mesh.castShadow = true; mesh.receiveShadow = true;
  mesh.userData.caveSdf = true;
  group.add(mesh);
  scene.add(group);

  // Rule 9 — the collider IS the drawn geometry.
  const body = makeStaticTrimesh(world, [mesh], { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0, w: 1 }, new THREE.Matrix4());

  // THE DECLARED OPENING (the leviathan lesson): the sky-open slot is the cave's front door, not a
  // defect. `cave-void` excuses rays through it by this explicit declaration — never by a loosened
  // threshold. Sized to the open run, not larger.
  const openMidS = SKY * 0.45;
  const openPt = pointAt(line, openMidS);
  group.userData.intendedOpening = {
    center: { x: openPt.x, y: gy + 1.1, z: openPt.z },
    radius: SKY * 0.62,
  };

  const tris = nets.idx.length / 3;
  const msTor = +(performance.now() - t0).toFixed(1);

  const waypoints: Array<{ name: string; x: number; y: number; z: number }> = [
    { name: 'outside', x: site.x - 11, y: terrain.pureHeightAt(site.x - 11, site.z), z: site.z },
    { name: 'approach', x: site.x - 5.6, y: terrain.pureHeightAt(site.x - 5.6, site.z) + 0.3, z: site.z },
    { name: 'mouth', x: site.x, y: gy + T.CREVICE_APRON_RISE, z: site.z },
  ];
  for (let i = 1; i < st.length; i++) {
    waypoints.push({ name: `slot${i}`, x: st[i].x, y: st[i].floorY, z: st[i].z });
  }

  const probe: CaveEntranceProbe = {
    site, gy,
    chamberFloorY: last.floorY,
    roofUnderY: last.floorY + T.CREVICE_HEIGHT,
    width: last.halfW * 2,
    mouthX: site.x,
    trenchFarX: pointAt(line, SKY).x,
    chamberFarX: last.x,
    descentAngleDeg: +line.maxSlopeDeg.toFixed(1),
    mouthClearW: +(halfWAt(0, line.totalS) * 2).toFixed(2),
    pinchClearW: +(halfWAt(SKY + TAPER * 0.5, line.totalS) * 2).toFixed(2),
    torHeight: T.CREVICE_TOR_FIN_H,
    centerZ: site.z,
    torTris: tris,
    msTor,
    waypoints,
  };
  group.userData.caveEntranceProbe = probe;

  // Hand-off: the junction + the WHOLE slot polyline, so the cave's SDF field builds the descent
  // as part of its own watertight surface (no weld seam between entrance and cave at all).
  const prev = st[st.length - 2];
  const hdx = last.x - prev.x, hdz = last.z - prev.z;
  const hl = Math.hypot(hdx, hdz) || 1;
  const junction: CaveJunction = {
    x: last.x, y: last.floorY, z: last.z,
    gy, width: last.halfW * 2,
    heading: { x: hdx / hl, z: hdz / hl },
    slot: st,
    slotMargin: T.CREVICE_SDF_MARGIN,
  };

  return { group, body, probe, junction, line };
}

/** World point on the slot centreline at arc length `s` (clamped). */
function pointAt(line: CreviceLine, s: number): { x: number; z: number; y: number } {
  const st = line.stations;
  const t = Math.min(line.totalS, Math.max(0, s));
  for (let i = 1; i < st.length; i++) {
    if (t <= line.cumS[i] || i === st.length - 1) {
      const seg = line.cumS[i] - line.cumS[i - 1] || 1;
      const u = Math.min(1, Math.max(0, (t - line.cumS[i - 1]) / seg));
      return {
        x: st[i - 1].x + (st[i].x - st[i - 1].x) * u,
        z: st[i - 1].z + (st[i].z - st[i - 1].z) * u,
        y: st[i - 1].floorY + (st[i].floorY - st[i - 1].floorY) * u,
      };
    }
  }
  return { x: st[0].x, z: st[0].z, y: st[0].floorY };
}
