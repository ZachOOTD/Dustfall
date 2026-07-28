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
//   THE NON-LEAK INVARIANT: the tor's fissure is always CREVICE_SDF_MARGIN narrower (and, since
//   cycle 7, CREVICE_ROOF_DROP + CREVICE_SDF_MARGIN·0.6 lower) than the SDF slot around it. So every
//   scrap of air the player can reach is inside the SDF cavity, and the tor's rock is the NEARER
//   surface — a backface void is impossible by construction. (Get this backwards and you stand in
//   air that the SDF calls rock, looking at a culled face: the exact D-2 see-through.)
//   ⚠ The two margins are NOT interchangeable and must be tuned separately. The LATERAL one is a
//   traversal constraint: past the tor's far face the SDF slot is the only surface, so every extra
//   centimetre of lateral margin is an alcove beside the walkway with the tor's wall end as a lip,
//   and the KCC wedges in it on the climb out (cycle-7 R8: 1.30m failed cave-walk seed 2024's
//   ascent). The VERTICAL one is free — nobody walks on a ceiling — and it has to exceed the SDF's
//   own inward ceiling push (CAVE_GEN_DISP_IN + CAVE_SDF_MICRO_AMP ≈ 0.375m) or the two ceilings
//   interpenetrate and shed sliver shrapnel into the roofed slot.
//
// CYCLE 7 (2026-07-26) — the adversarial-critique fix round. Six defects, and only one of them was
// the thing it looked like:
//   · the "roof lamina" (a floating paper-thin sunlit blade over the crack) was NOT a roof at all —
//     it was the INTACT TERRAIN SHEET, poking edge-on into the open fissure because the closure
//     landed 7cm past the carved hole's far edge. Moved inboard + clamped by CREVICE_ROOF_UNDER.
//   · the SAWTOOTH COMB along both walls at the floor line was 0.03m of relief against a 0.32m grid.
//     Cured with amplitude (CREVICE_WALL_NOISE, asymmetric) not with fillets.
//   · the THIN-BLADE THICKET around the lintel was `projectSlot` being discontinuous on the inside
//     of a bend — see the note on that function. It is the oldest bug of the three.
//   · 78m findability: ONE horn (an asymmetric skyline break) + fin shoulders so the fissure survives
//     as a NOTCH in the silhouette. 1.93° → 4.12° of arc on seed 1337, 2.71° → 5.02° on seed 7.
//
// D307 IS UNCHANGED. The entrance chunk still swaps its heightfield collider for a trimesh with a
// genuinely carved hole; the hole just got much smaller (cycle 4: 3×2 cells; cycle 9: 4×2 cells =
// 16.7 × 8.33m, all of it under the tor). No portals, no teleports. The site hash is SNAPPED to a
// terrain grid vertex so the hole is the same size on every seed and the tor can be sized to cover
// it exactly.
//
// CYCLE 9 (2026-07-27) — THE ENTRANCE-HEADROOM FIX. The carved hole is not only a hole: it is also
// the region where the fissure roof is exempt from the `terrH − CREVICE_ROOF_UNDER` clamp, so its far
// edge is where the ceiling stops being the slot's own and starts following a terrain surface that
// has been dropping since the mouth. At 3 cells that handover happened 8.3m in, over a floor only
// 4.25m down, and one cave in nine pinched under the 1.70m capsule. Four cells + a placement
// invariant (CREVICE_MIN_CLEAR_M, `creviceClearProfile` below) closed it. See both tuning entries.
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
 *  terrain lip) and CREVICE_HOLE_CELLS_X-1 cells ahead — far enough past the sky-open run that the
 *  roof-clamp handover lands over a floor that is already deep (cycle 9; it used to end at the
 *  closure and that was the headroom defect). Every cell of it is covered by the tor. */
export interface CaveHoleBlock {
  tileTx: number; tileTz: number;
  iMin: number; iMax: number;
  jMin: number; jMax: number;
  xMin: number; xMax: number;
  zMin: number; zMax: number;
}

/** The UNCLAMPED cell indices the hole wants, plus the owning tile. Split out of
 *  `caveEntranceHoleBlock` (DEEPER cycle 8) so the fit test and the block itself derive the SAME
 *  numbers from one piece of arithmetic — the alternative is two copies of an index convention that
 *  is already easy to get backwards. */
function rawHoleCells(site: { x: number; z: number }, cellsX?: number): {
  tileTx: number; tileTz: number; centerX: number; centerZ: number;
  iMin: number; iMax: number; jMin: number; jMax: number;
} {
  const SIZE = Tuning.TERRAIN_CHUNK_SIZE;
  const CELLS = Tuning.TERRAIN_CHUNK_CELLS;
  const tileTx = Math.round(site.x / SIZE);
  const tileTz = Math.round(site.z / SIZE);
  const centerX = tileTx * SIZE;
  const centerZ = tileTz * SIZE;
  const iOf = (wx: number): number => ((wx - centerX) / SIZE + 0.5) * CELLS;
  const jOf = (wz: number): number => ((wz - centerZ) / SIZE + 0.5) * CELLS;
  const i0 = Math.round(iOf(site.x));            // site is snapped → this IS a vertex index
  const j0 = Math.round(jOf(site.z));
  const nz = Tuning.CREVICE_HOLE_CELLS_Z;
  const nx = cellsX ?? Tuning.CREVICE_HOLE_CELLS_X;
  const jMin = j0 - Math.floor(nz / 2);
  return {
    tileTx, tileTz, centerX, centerZ,
    iMin: i0 - 1, iMax: i0 - 1 + nx - 1,
    jMin, jMax: jMin + nz - 1,
  };
}

/**
 * DEEPER cycle 8 — DOES THE CARVED HOLE FIT WHOLLY INSIDE ONE TERRAIN TILE?
 *
 * `caveEntranceHoleBlock` CLAMPS its cell range to the owning tile, because a `CaveHoleBlock` names
 * exactly one tile and the terrain's hole registry opens it on exactly one tile. For the origin cave
 * that clamp never fires — `caveEntranceSite` puts the mouth in open ground mid-tile. For a STREAMED
 * site it can: the placement grid (`caveSites.ts`) is on its own 460m pitch with ±80m jitter and
 * knows nothing about the 800m terrain tiling, so a site can land on a tile seam.
 *
 * When it fires, the carved hole is TRUNCATED or SHIFTED by a cell (4.17m), measured over the whole
 * snapped-vertex space: 1.56% of possible site positions — about one cave in 64. The sheet then
 * stays SOLID over part of the descent slot, which is a cave you can see the tor of and cannot get
 * into. Nothing else in the pipeline notices: the tor still builds, the interior still builds, the
 * hole registry still reports a hole, and every existing gate stays green.
 *
 * WHY REJECT THE SITE RATHER THAN TEACH THE HOLE TO SPAN TILES. A cross-tile hole would have to be
 * opened and closed on two tiles whose load/unload lifetimes are INDEPENDENT — and the invariant the
 * whole cycle rests on is that a hole exists if and only if the cave under it is resident. Half a
 * hole surviving on a tile that stayed loaded is precisely the "opening onto nothing" that invariant
 * exists to forbid. Losing ~1.6% of candidate sites costs nothing (the grid has no shortage of
 * cells); breaking the invariant would cost the safety of the entire feature.
 */
export function caveEntranceHoleFitsTile(site: { x: number; z: number }, cellsX?: number): boolean {
  const CELLS = Tuning.TERRAIN_CHUNK_CELLS;
  const r = rawHoleCells(site, cellsX);
  return r.iMin >= 0 && r.iMax <= CELLS - 1 && r.jMin >= 0 && r.jMax <= CELLS - 1;
}

export function caveEntranceHoleBlock(site: { x: number; z: number }, cellsX?: number): CaveHoleBlock {
  const SIZE = Tuning.TERRAIN_CHUNK_SIZE;
  const CELLS = Tuning.TERRAIN_CHUNK_CELLS;
  const r = rawHoleCells(site, cellsX);
  // The clamp is kept — it is what makes a `CaveHoleBlock` always a legal cell range for its tile,
  // and the ORIGIN cave's block (D307, baked at createTerrain time) must stay byte-identical. What
  // changed in cycle 8 is that streamed sites which would ACTUALLY hit it are rejected upstream by
  // `caveEntranceHoleFitsTile`, so the clamp is now unreachable rather than silently destructive.
  const clampCell = (n: number): number => Math.max(0, Math.min(CELLS - 1, n));
  const iMin = clampCell(r.iMin);
  const iMax = clampCell(r.iMax);
  const jMin = clampCell(r.jMin);
  const jMax = clampCell(jMin + Tuning.CREVICE_HOLE_CELLS_Z - 1);
  const vX = (i: number): number => r.centerX + (i / CELLS - 0.5) * SIZE;
  const vZ = (j: number): number => r.centerZ + (j / CELLS - 0.5) * SIZE;
  return {
    tileTx: r.tileTx, tileTz: r.tileTz, iMin, iMax, jMin, jMax,
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
    const maxFloor = terrH - T.CREVICE_HEIGHT - T.CREVICE_COVER_CLEAR;
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

// ── THE HEADROOM PROFILE (DEEPER cycle 9) ───────────────────────────────────
//
// WHY THIS EXISTS. The descent's clear height is NOT a constant, and cycle 8's density work is what
// exposed it: past the sky run the tor's fissure ceiling is clamped to `terrH − CREVICE_ROOF_UNDER`
// per COLUMN (it follows the terrain), while the cover guard that protects floor depth samples only
// at the six stations plus a 2.5m ring — stations up to 7.7m apart. So a terrain dip BETWEEN two
// guarded stations pinches the slot, and at some streamed sites it pinched to 1.17-1.44m against a
// 1.70m capsule: a cave you can see the tor of and cannot enter. Measured by `crevice-profile`
// (physics rays against the shipped colliders) at seed 1337 (675,1113) and seed 7 (-1100,-1146).
//
// The pinch lands within a metre of the carved hole's far edge, because that is exactly where the
// clamp switches on — inside the hole the ceiling comes from the SDF slot (tall, terrain-independent)
// and outside it follows a terrain that has been falling away since the mouth.
//
// WHY IT IS A PLACEMENT RULE AND NOT A GEOMETRY TWEAK. Every local lever is BOUNDED and none of them
// guarantees anything:
//   · the tor's floor can only be pushed down 12cm — below that it passes through the SDF slot's own
//     floor plane (`primDist`: `max(d, fy − y)`, no downward margin) and you get the cycle-4 gutter,
//   · lifting the roof means shrinking CREVICE_ROOF_UNDER, which is the entire non-leak safety net
//     for the roof-lamina bug and buys 0.9m at absolute most,
//   · steepening the descent moves the junction, and the junction is the origin of the room graph —
//     every chamber moves with it and every cave digest in the project re-baselines,
//   · lengthening the carved hole helps (the clamp switches on further down the ramp, where the floor
//     is deeper) but it is still only a shift: terrain can always fall away faster than 27°.
// A rejection rule is the one answer that is true BY CONSTRUCTION, and it has direct precedent one
// rule above it — cycle 8's tile-seam rejection, taken for the same reason (an invariant the rest of
// the pipeline cannot see is worth more than the ~2% of candidate cells it costs).
//
// The arithmetic below is a NOISE-FREE MODEL of `colRoof`/`colFloor` sampled along the real station
// polyline. It has to stay in this file, next to the loop it mirrors, or the two drift silently. It
// is validated against the ray instrument, not trusted: `crevice-profile` prints predicted-vs-measured
// at every station, and the `cave-kinds` min-clear sweep asserts the RAY number at real built sites.

export interface CreviceClearRow { s: number; x: number; z: number; floorY: number; terrH: number; h: number; tor: number; }
export interface CreviceClearProfile {
  /** Worst modelled clear height anywhere on the descent, in metres. */
  minH: number;
  atS: number; atX: number; atZ: number;
  rows: CreviceClearRow[];
}

/** Model the clear height along the whole descent. PURE in (site, terrain, seed) — same inputs and
 *  same purity class as the placement rules that call it (D290, `terrain.pureHeightAt` only).
 *
 *  `opts.cellsX` / `opts.roofUnder` exist so a lever can be evaluated over hundreds of real sites
 *  WITHOUT building one, which is how the lever for this cycle was chosen. Default = the shipped
 *  tuning. `opts.rows` fills the per-sample table (the diagnostic path only). */
export function creviceClearProfile(
  site: { x: number; z: number },
  terrain: Terrain,
  seed: number,
  opts?: { line?: CreviceLine; step?: number; rows?: boolean; cellsX?: number; roofUnder?: number },
): CreviceClearProfile {
  const T = Tuning;
  const line = opts?.line ?? buildCreviceLine(site, terrain, seed);
  const block = caveEntranceHoleBlock(site, opts?.cellsX);
  const roofUnder = opts?.roofUnder ?? T.CREVICE_ROOF_UNDER;
  const step = opts?.step ?? 0.25;
  const SKY = T.CREVICE_SKY_RUN, TAPER = T.CREVICE_SKY_TAPER;
  const sClose = SKY + TAPER * 0.5;                       // roof wobble is zero-mean — see the header
  const smoothstep = (a: number, b: number, x: number): number => {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  // The two hole distances the tor's column loop uses, noise-free and drift-free.
  const AMARG = T.CREVICE_APRON_MARGIN;
  const holeSigned = (x: number, z: number): number => {
    const dx = Math.max(block.xMin - x, x - block.xMax);
    const dz = Math.max(block.zMin - z, z - block.zMax);
    const ox = Math.max(dx, 0), oz = Math.max(dz, 0);
    return ox > 0 || oz > 0 ? Math.hypot(ox, oz) : Math.max(dx, dz);
  };
  const holeDist = (x: number, z: number): number => {
    const dx = Math.max(block.xMin - AMARG - x, 0, x - (block.xMax + AMARG));
    const dz = Math.max(block.zMin - AMARG - z, 0, z - (block.zMax + AMARG));
    return Math.hypot(dx, dz);
  };
  // Where the tor's rock ENDS: `colBound = AFALL + 1.0 − max(0, d0 − 0.25)` must stay positive.
  const torReach = T.CREVICE_APRON_FALL + 1.0 + 0.25;
  // The SDF slot's own ceiling, which is what bounds the space once the tor is behind you.
  const sdfCeilOver = T.CREVICE_HEIGHT + T.CREVICE_SDF_MARGIN * 0.6;
  const torCeilOver = T.CREVICE_HEIGHT - T.CREVICE_ROOF_DROP;

  const rows: CreviceClearRow[] = [];
  let minH = Infinity, atS = 0, atX = site.x, atZ = site.z;
  for (let s = 0; s <= line.totalS + 1e-6; s += step) {
    const p = pointAt(line, s);
    const terrH = terrain.pureHeightAt(p.x, p.z);
    const tor = holeDist(p.x, p.z) < torReach ? 1 : 0;
    // `openFree` lifts the roof clamp inside the carved hole and over the sky-open run — the same
    // two terms, with the ±0.55m hole-edge noise at its zero.
    const openFree = Math.max(1 - smoothstep(-0.9, 0.3, holeSigned(p.x, p.z)), 1 - smoothstep(SKY * 0.5, SKY, s));
    const taperRoof = p.y + torCeilOver + Math.max(0, sClose - s) * T.CREVICE_SKY_SLOPE;
    // Under the tor the ceiling is the tor's clamped fissure roof and the floor is 12cm above the
    // slot's; past the tor's far face the SDF slot's ceiling takes over, capped by the terrain sheet
    // (D307 — the heightfield is a two-sided collider, so an intact sheet IS a ceiling).
    const ceil = tor
      ? Math.min(taperRoof, terrH - roofUnder + openFree * 120)
      : Math.min(p.y + sdfCeilOver, terrH + openFree * 120);
    const h = ceil - p.y - (tor ? 0.12 : 0);
    if (h < minH) { minH = h; atS = s; atX = p.x; atZ = p.z; }
    if (opts?.rows) {
      rows.push({ s: +s.toFixed(2), x: +p.x.toFixed(2), z: +p.z.toFixed(2), floorY: +p.y.toFixed(2), terrH: +terrH.toFixed(2), h: +h.toFixed(2), tor });
    }
  }
  return { minH, atS, atX, atZ, rows };
}

// ── Smooth CSG (cycle 7) ────────────────────────────────────────────────────
//
// Surface nets places ONE vertex per sign-changing cell, so it can represent a smooth surface and a
// sharp EDGE only badly: a sharp convex edge (min of two solids) comes out as a row of thin blades,
// and a sharp concave crease (max) that crosses the grid at a shallow angle comes out as a regular
// staircase that `computeVertexNormals` lights as a comb of triangular teeth. Both were shipping
// (cycle-7 adversarial critique, sev1). The cure is constructional, not a tuning value: round every
// edge of the tor's field by more than a voxel, so nothing the polygonizer sees is ever sharp.
//
// `smin` is IQ's polynomial smooth-min (the same one caveSdf.ts uses on corridor mouths), so the two
// surfaces of the entrance are built with the same operator.

function smin(a: number, b: number, k: number): number {
  const h = Math.max(0, k - Math.abs(a - b)) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}
/** …and its dual: rounds a CONCAVE crease by ADDING material (a fillet in the corner). */
function smax(a: number, b: number, k: number): number {
  const h = Math.max(0, k - Math.abs(a - b)) / k;
  return Math.max(a, b) + h * h * k * 0.25;
}

/** Projection of an XZ point onto the slot polyline — SOFT, not nearest-wins.
 *
 *  ⚠ THE CYCLE-7 SLIVER BUG LIVED HERE, and it had been shipping since cycle 4. A hard
 *  nearest-segment projection is DISCONTINUOUS on the inside of a bend: along the angle bisector the
 *  two adjacent segments are equidistant, so `s` (and with it `floorY`, `halfW`, `perp`) jumps by
 *  ~2·d·sin(θ/2) between neighbouring grid columns. At the first knee that is 0.45m of arc per metre
 *  of offset — which the roof term multiplies by CREVICE_SKY_SLOPE into a ~1m STEP in the ceiling
 *  between adjacent columns, and the polygonizer answers a step with a fan of sub-voxel triangles.
 *  The first knee sits at s≈6.8 and the roof closes at s≈7.2, so the fan landed exactly on the
 *  lintel: the "thicket of thin blades" flanking the aperture in every threshold frame. Four earlier
 *  hypotheses (crease fillets, edge rounding, ceiling relief, the SDF slot interpenetrating) each
 *  fixed something real and none of them touched this.
 *
 *  So the segments are combined with an exponential SOFTMIN instead. Every field the tor reads is now
 *  continuous across a knee, and the blended value is always BETWEEN the two segments' values — which
 *  is what keeps the non-leak invariant safe for free: the cave SDF unions its slot primitives, so
 *  its floor at a knee is the LOWER of the two and its ceiling the HIGHER, and a value in between is
 *  by definition inside that envelope. */
interface SlotProj { s: number; perp: number; floorY: number; halfW: number; }
const _pjS: number[] = [], _pjP: number[] = [], _pjF: number[] = [], _pjD: number[] = [];
function projectSlot(line: CreviceLine, x: number, z: number): SlotProj {
  const st = line.stations;
  const n = st.length - 1;
  let best = Infinity;
  for (let i = 1; i <= n; i++) {
    const ax = st[i - 1].x, az = st[i - 1].z;
    const dx = st[i].x - ax, dz = st[i].z - az;
    const len2 = dx * dx + dz * dz || 1;
    let t = ((x - ax) * dx + (z - az) * dz) / len2;
    // Extend past the ends so the projection is defined outside the polyline too (the mouth
    // approach lives at s < 0, and the fissure runs on past the tor's far face).
    if (i === 1) t = Math.min(t, 1); else if (i === n) t = Math.max(t, 0); else t = Math.min(1, Math.max(0, t));
    const px = ax + dx * t, pz = az + dz * t;
    const d = Math.hypot(x - px, z - pz);
    const segLen = Math.sqrt(len2);
    const s = line.cumS[i - 1] + segLen * t;
    _pjD[i - 1] = d;
    _pjS[i - 1] = s;
    // signed side (left/right of the segment) — used for per-side asymmetry
    _pjP[i - 1] = ((x - ax) * dz - (z - az) * dx) / segLen;
    // Before the mouth (s<0) the floor is FLAT at the mouth level, never extrapolated up the ramp:
    // extrapolating raised the approach channel ~2m above the sand, so the KCC met a wall where
    // the doorway should be and climbed over the tor instead (round-7 cave-walk, slot1 X).
    _pjF[i - 1] = s <= 0 ? st[0].floorY : st[i - 1].floorY + (st[i].floorY - st[i - 1].floorY) * t;
    if (d < best) best = d;
  }
  const SOFT = Tuning.CREVICE_PROJ_SOFT;
  let wsum = 0, bs = 0, bperp = 0, bfloor = 0;
  for (let i = 0; i < n; i++) {
    const w = Math.exp(-(_pjD[i] - best) / SOFT);
    wsum += w; bs += w * _pjS[i]; bperp += w * _pjP[i]; bfloor += w * _pjF[i];
  }
  bs /= wsum; bperp /= wsum; bfloor /= wsum;
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
  // R5 — a WIND-DRIFT stretch: the apron's falloff runs further on its lee side, so the sand does not
  // meet the rock along a symmetric outline. The bearing is seed-picked (site rand) but fixed per
  // site, exactly like the fin's side bias.
  const arand = makeRng((seed ^ 0x0a9d01) >>> 0);
  const driftAng = arand() * Math.PI * 2;
  const driftX = Math.cos(driftAng), driftZ = Math.sin(driftAng);
  const holeDist = (x: number, z: number): number => {
    const dx = Math.max(block.xMin - AMARG - x, 0, x - (block.xMax + AMARG));
    const dz = Math.max(block.zMin - AMARG - z, 0, z - (block.zMax + AMARG));
    const d = Math.hypot(dx, dz);
    if (d <= 0) return 0;
    // Lee-side stretch: shorten the effective distance downwind so the ramp reaches further out.
    const nx = dx / d, nz = dz / d;
    const lee = Math.max(0, nx * driftX + nz * driftZ);
    return Math.max(0, d - lee * lee * T.CREVICE_APRON_DRIFT);
  };
  /** SIGNED distance to the CARVED TERRAIN HOLE rect (negative inside). The intact one-sided terrain
   *  sheet exists everywhere this is positive, so the fissure may only be open ABOVE the surface
   *  where it is negative — see CREVICE_ROOF_UNDER. */
  const holeSigned = (x: number, z: number): number => {
    const dx = Math.max(block.xMin - x, x - block.xMax);
    const dz = Math.max(block.zMin - z, z - block.zMax);
    const ox = Math.max(dx, 0), oz = Math.max(dz, 0);
    return ox > 0 || oz > 0 ? Math.hypot(ox, oz) : Math.max(dx, dz);
  };

  // ── THE HORN (cycle-7 sev1: 78m findability). One narrow splinter of the same rock, standing a
  //    few metres off the crack — an ASYMMETRIC skyline break. Everything about it is a pure function
  //    of the world seed (its own rand stream, never the shared procgen one), and its side is the
  //    same parity that mirrors the descent's first knee.
  const hrand = makeRng((seed ^ 0x40217e) >>> 0);
  const hornSide = (seed & 1) === 0 ? 1 : -1;
  const hornS = T.CREVICE_HORN_S_MIN + hrand() * (T.CREVICE_HORN_S_MAX - T.CREVICE_HORN_S_MIN);
  const hornOff = hornSide * (T.CREVICE_HORN_OFF_MIN + hrand() * (T.CREVICE_HORN_OFF_MAX - T.CREVICE_HORN_OFF_MIN));
  const hornAng = hrand() * Math.PI;
  const hornH = T.CREVICE_TOR_FIN_H + T.CREVICE_HORN_RISE * (0.86 + hrand() * 0.28);
  const hornCos = Math.cos(hornAng), hornSin = Math.sin(hornAng);
  const hornP = pointAt(line, hornS), hornP2 = pointAt(line, hornS + 0.6);
  let hux = hornP2.x - hornP.x, huz = hornP2.z - hornP.z;
  const hul = Math.hypot(hux, huz) || 1; hux /= hul; huz /= hul;
  const hornX = hornP.x + -huz * hornOff, hornZ = hornP.z + hux * hornOff;

  // Grid AABB: the hole + apron + fall, unioned with the slot's own extent (the fissure has to run
  // out of the tor's far face into the SDF slot, so the grid must contain that face).
  // The grid must contain the apron's FULL reach, drift tail included. R4 sized it as
  // AMARG+AFALL+1.4 = 4.6m while `colBound` stays positive out to ~4.8m, so the solid was already
  // truncated at the grid face — harmlessly, because out there the slab is 1.5-2.7m underground.
  // The cycle-7 lee-side drift moved that truncation OUT to where the slab surfaces, and the open
  // face showed on the sand as a row of angular fins with a black void behind them (seed 1337,
  // app15, apron tip). Sized from the actual terms now, not by eye.
  const R = AMARG + AFALL + T.CREVICE_APRON_DRIFT + 1.8;
  // The whaleback swell's ellipse: the carved hole's own footprint, grown a little.
  const swCx = (block.xMin + block.xMax) * 0.5, swCz = (block.zMin + block.zMax) * 0.5;
  const swRx = (block.xMax - block.xMin) * 0.5 + 3.0, swRz = (block.zMax - block.zMin) * 0.5 + 3.0;
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
  const colRoof = new Float32Array(cw * cd);       // fissure roof Y (far above the rock top where open to the sky)
  const colPerp = new Float32Array(cw * cd);       // signed distance from the slot axis
  const colBound = new Float32Array(cw * cd);      // horizontal closure term
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
      // R5 — THREE octaves of outline wobble, not one. R4's single 16m-wavelength term could not
      // break a 13m straight edge, so the apron kept the carve rect's straight polygonal boundary
      // and read as terraced plates (cycle-7 sev2). The 6m and 2.5m octaves are what actually
      // dissolve a straight run into lobes and scallops.
      const d0 = holeDist(wx, wz);
      const edgeWob = (noise3(wx * 0.06 + 91, 5.5, wz * 0.06 + 37) * 0.46
                     + noise3(wx * 0.17 + 12, 2.9, wz * 0.17 + 64) * 0.34
                     + noise3(wx * 0.40 + 55, 8.2, wz * 0.40 + 19) * 0.20) * 0.5 + 0.5;
      // R6 — the wobble is SIGNED now. R3 made it expand-only on the grounds that covering every
      // carved cell is a correctness invariant — true, but that invariant is already enforced
      // outright by the `d0 <= 0.001` clamp below, so expand-only bought nothing and cost 1.5m of
      // extra skirt on every side.
      const dbWob = d0 - 0.25 - T.CREVICE_APRON_EDGE * (edgeWob * 2 - 1) * 0.5;
      // …and the profile is TWO-STAGE: a walkable ramp off the rock (the KCC has to be able to step
      // up onto the apron from the sand — a hard rim here means you cannot reach the mouth), then a
      // fast dive well under the sheet. R4's single 2.3m ramp to −2.1 spent its whole length near
      // terrain level, which is what made the outcrop read as a 26m lily pad lying on the desert.
      const ramp = Math.min(1, Math.max(0, dbWob) / T.CREVICE_APRON_RAMP);
      const dive = Math.min(1, Math.max(0, dbWob - T.CREVICE_APRON_RAMP) / AFALL);
      // R7 — THE WHALEBACK SWELL. The rock that covers the carved hole was a geometrically FLAT
      // 0.55m-proud table ~19 × 15m across; at 15-40m that is a lily pad lying on the sand no matter
      // what its outline does, which is why three rounds of edge work never fixed the "terraced
      // plates" read. A broad low dome over the hole is what the file header claimed the tor was in
      // the first place ("a whaleback tor"), and it costs one term.
      const swU = (wx - swCx) / swRx, swV = (wz - swCz) / swRz;
      const swD = Math.hypot(swU, swV);
      const swell = swD >= 1 ? 0 : T.CREVICE_TOR_SWELL * Math.pow(1 - swD, 1.2);
      let apron = (APRON + swell) - ramp * (APRON + swell + 0.30) - dive * 3.1;
      // R6 — the apron's RELIEF fades out with the apron itself. Without this the ledge noise and the
      // tor's general relief (±1.3m between them) are the same size as the whole falloff, so the
      // buried outer skirt keeps breaking back through the sand: a 26m flat shelf with a ragged rim
      // lying on the desert — the "lily pad" R3 named and R4/R5 never actually killed, because they
      // reshaped the OUTLINE and left the amplitude alone.
      const aFade = 1 - Math.min(1, Math.max(0, dbWob) / AFALL);
      // R4 — break the apron out of a flat plateau into low bedrock LEDGES. R3's apron read as a
      // poured concrete platform: 23m across and geometrically flat, because the only relief it got
      // was the 0.30-weighted tail of the fin's noise term.
      apron += (noise3(wx * 0.13 + 5, 9.1, wz * 0.13 + 44) * 0.34 + noise3(wx * 0.36 + 23, 4.4, wz * 0.36 + 2) * 0.16
              + noise3(wx * 0.72 + 63, 1.7, wz * 0.72 + 88) * 0.07) * 1.25 * aFade;
      if (d0 <= 0.001) apron = APRON + swell;         // inside hole+margin: full cover, always
      // The fin. R1 used perpFade² and got a pair of sharp CONES ("Mount Fuji with a notch"). Real
      // fissured bedrock is blocky: a PLATEAU beside the crack with steep flanks. So the profile is
      // a plateau out to FIN_PLATEAU then a hard shoulder, and the top is clamped flat-ish.
      const ap0 = Math.abs(pr.perp);
      const along = smoothstep(-5.2, -1.6, pr.s) * (1 - smoothstep(block.xMax - site.x + 0.5, block.xMax - site.x + 6.2, pr.s));
      const plateau = 1 - smoothstep(T.CREVICE_TOR_FIN_PLATEAU, T.CREVICE_TOR_FIN_SPREAD, ap0);
      // Per-side asymmetry — one wall of a fissure is always the taller one.
      const sideBias = pr.perp > 0 ? 1.0 : 0.78;
      // R5 — SHOULDERS. The fin used to hold full height straight across the crack, so at silhouette
      // scale the split was a hairline scratch on a smooth dome and the tor read as one lump at 78m.
      // Dropping the fin toward the crack turns the fissure into a real NOTCH in the outline.
      const notch = 1 - T.CREVICE_TOR_FIN_NOTCH * (1 - smoothstep(0.2, T.CREVICE_TOR_FIN_SHOULDER, ap0));
      const fin = T.CREVICE_TOR_FIN_H * along * plateau * sideBias * notch;
      // R5 — THE HORN. A near-vertical splinter with a ragged plan outline, rising out of the fin.
      // `max` (not sum) means it emerges from the fin rather than sitting on it like a hat.
      const hnx = wx - hornX, hnz = wz - hornZ;
      const hnu = (hnx * hornCos + hnz * hornSin) / T.CREVICE_HORN_LEN;
      const hnv = (-hnx * hornSin + hnz * hornCos) / T.CREVICE_HORN_WID;
      const hnd = Math.max(0, Math.hypot(hnu, hnv)
        + noise3(wx * 0.38 + 77, 3.9, wz * 0.38 + 12) * T.CREVICE_HORN_RAG);
      const horn = hnd >= 1 ? 0 : hornH * along * Math.pow(1 - hnd, 0.9);
      // Heightfields are combined with a SMOOTH max: a hard `max` leaves a gradient crease along the
      // curve where two of them cross, and a crease in a heightfield is a crease in the 3D field —
      // the polygonizer answers those with blades and stair-steps, same failure family as the rims.
      const prom = smax(fin, horn, 0.75);
      let top = terrH + smax(apron, prom, 0.6);
      // Relief: strong on the fin, gentle on the apron. Three octaves, the coarsest wide enough to
      // break the plateau into distinct blocks rather than dimple it.
      const relief = noise3(wx * 0.055, 3.1, wz * 0.055) * 0.60
                   + noise3(wx * 0.16 + 11, 7.3, wz * 0.16 + 5) * 0.28
                   + noise3(wx * 0.44 + 29, 2.2, wz * 0.44 + 17) * 0.12;
      top += relief * T.CREVICE_TOR_NOISE
           * (0.12 + 0.43 * aFade + 0.45 * Math.min(1, prom / Math.max(0.5, T.CREVICE_TOR_FIN_H * 0.45)));
      colTop[o] = top;
      colBot[o] = Math.min(terrH - 3.0, pr.floorY - 1.8);
      // The tor's fissure floor sits 12cm ABOVE the SDF slot floor, not below it. Carving below
      // left a 45cm GUTTER along both walls (the SDF slot is 0.62m wider than the fissure, so its
      // floor ran on past the tor's wall base and then dropped to the tor's carve floor) — deeper
      // than the KCC's 0.3m autostep, so a capsule that drifted into it on the climb out was wedged.
      // That was the `ascent=FAIL` on half the seed net. Above, the tor owns the walking surface.
      // R5 — a little relief on the walking surface too. Kept strictly POSITIVE-biased so the tor's
      // floor never dips below the SDF slot floor it sits 12cm above (the 45cm gutter that wedged the
      // capsule on the climb out in cycle 4, round 7).
      colFloor[o] = pr.floorY + 0.12
        + (noise3(wx * 0.33 + 5, 1.9, wz * 0.33 + 91) * 0.5 + 0.5) * T.CREVICE_FLOOR_RELIEF;
      colHW[o] = pr.halfW;
      colPerp[o] = pr.perp;
      // Roof: open to the sky over the first SKY metres, then closes to the slot ceiling.
      // R5 — the closure line WANDERS (CREVICE_ROOF_WOBBLE). Round 4's lip was a mathematical
      // smoothstep of arc length, i.e. a dead-straight line across the slot: from inside, the sky
      // opening ended in a hard-edged bright quad that read as a glowing card (cycle-7 sev2).
      const roofWob = (noise3(wx * 0.105 + 13, 2.2, wz * 0.105 + 71) * 0.68
                     + noise3(wx * 0.330 + 5, 6.4, wz * 0.330 + 9) * 0.32) * T.CREVICE_ROOF_WOBBLE;
      const sClose = SKY + TAPER * 0.5 - roofWob;
      // …and the ceiling itself carries rock relief, for exactly the reason the walls do: a bare
      // plane tilted 27° to the voxel grid quantizes into a fringe of thin triangles. `smax` on the
      // lintel's leading kink for the same reason — a gradient crease is a sharp edge to the
      // polygonizer even when the surfaces either side of it are smooth.
      const roofRel = (noise3(wx * 0.34 + 8, 5.1, wz * 0.34 + 66) * 0.66
                     + noise3(wx * 0.83 + 44, 9.7, wz * 0.83 + 22) * 0.34) * T.CREVICE_ROOF_RELIEF;
      const taperRoof = pr.floorY + T.CREVICE_HEIGHT - T.CREVICE_ROOF_DROP + roofRel
        + smax(0, sClose - pr.s, 0.9) * T.CREVICE_SKY_SLOPE;
      // …and the SAFETY NET behind the whole lamina fix: outside the carved terrain hole the roof is
      // clamped under the surface, so the intact one-sided sheet can never poke into the open crack
      // again on any seed, whatever the cover guard did to this station's floor. The clamp is lifted
      // (a) inside the hole and (b) anywhere before the taper starts — otherwise it would roof over
      // the approach ramp behind the mouth, where `pr.s` is negative and there is no hole either.
      const hrw = holeSigned(wx, wz) + noise3(wx * 0.19 + 31, 4.7, wz * 0.19 + 63) * 0.55;
      const openFree = Math.max(1 - smoothstep(-0.9, 0.3, hrw), 1 - smoothstep(SKY * 0.5, SKY, pr.s));
      colRoof[o] = Math.min(taperRoof, terrH - T.CREVICE_ROOF_UNDER + openFree * 120);
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
  const WN = T.CREVICE_WALL_NOISE, WNO = T.CREVICE_WALL_NOISE_OUT, WNF = T.CREVICE_WALL_NOISE_FLOOR;
  const WWOB = T.CREVICE_WALL_WOBBLE, WWF = T.CREVICE_WALL_WOBBLE_FREQ;
  const KE = T.CREVICE_EDGE_ROUND * VOX;      // convex-edge rounding (rims)
  const KC = T.CREVICE_CREASE_FILL * VOX;     // concave-crease fillet (floor/wall corner)
  for (let k = 0; k <= nz; k++) {
    for (let i = 0; i <= nx; i++) {
      const c = k * cw + i;
      const top = colTop[c], bot = colBot[c], fl = colFloor[c], hw = colHW[c], roof = colRoof[c];
      const perp = colPerp[c], bound = colBound[c];
      const ap = Math.abs(perp);
      const wx = gx0 + i * VOX, wz = gz0 + k * VOX;
      // The wall plane's LOW-FREQUENCY lateral wander (see CREVICE_WALL_WOBBLE). Per column, so a
      // whole vertical band of wall shifts together — that is what stops the wall running
      // near-parallel to a grid axis, which is the other half of the sawtooth fix.
      const wob = noise3(wx * WWF + 211, 1.3, wz * WWF + 47) * WWOB;
      // THE SLIVER FIX (cycle-7 R6, and the last of the aperture shrapnel). The fissure rim is a
      // CONVEX edge and wants a fat smooth-min — except in ONE place: the lintel's leading edge,
      // where the rock between the ceiling (`roof`) and the rock top (`top`) is thinner than the
      // rounding radius. There `smin` blends "below the top" (∇ = −y) against "above the ceiling"
      // (∇ = +y), the two gradients CANCEL, and surface nets — which places its vertex by walking
      // that gradient — emits a fringe of sub-voxel triangles. Everywhere else the two surfaces meet
      // at ~90° and the same radius is exactly right, so the radius is capped by the LOCAL rock
      // thickness rather than lowered globally (which would put the rim blades back).
      const kEdge = roof >= top ? KE : Math.min(KE, Math.max(0.12, (top - roof) * 0.45));
      for (let j = 0; j <= ny; j++) {
        const wy = gy0 + j * VOX;
        // Convex edges (slab top/bottom against the footprint boundary) rounded, not mitred.
        let f = smin(smin(top - wy, wy - bot, KE), bound, KE);
        if (f > -1.2 && ap < hw + 2.2) {
          // Fissure walls get 3D rock noise. Cycle-7: the attenuation toward the floor used to run
          // to 0.10 (0.03m of relief against a 0.32m grid) and THAT is what quantized into the
          // sawtooth comb. It now bottoms out at CREVICE_WALL_NOISE_FLOOR ≈ half a voxel, and part
          // of the budget is spent on the per-column wobble above rather than on fine grain.
          const att = WNF + (1 - WNF) * Math.min(1, Math.max(0, (wy - fl - 0.9) / 2.4));
          const raw = wob + (noise3(wx * 0.33 + 61, wy * 0.26, wz * 0.33 + 13) * 0.68
                           + noise3(wx * 0.78 + 7, wy * 0.61, wz * 0.78 + 41) * 0.32) * (1 - WWOB) * att;
          // ASYMMETRIC: gouges bite deep, bulges stay inside the SDF slot (CREVICE_WALL_NOISE_OUT).
          const wn = raw >= 0 ? raw * WNO : raw * WN;
          // The floor/wall crease gets a FILLET (smooth-max adds rock in the corner): a sharp
          // concave line crossing the grid at ~27° is exactly what stair-steps.
          const dFis = smax(smax(ap - (hw + wn), fl - wy, KC), wy - roof, KC);
          f = smin(f, dFis, kEdge);
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
