// DEEPER cycle 8 — CAVES AS ROCKY-TERRAIN DENSITY. The seed-pure placement layer.
//
//   "Caves are a regular feature of ROCKY TERRAIN, not a rare landmark. You meet several in an
//    hour's travel; the underground is part of routine survival, not an event. The egg cave stays
//    unique and findable near origin — it must remain legible as *the* one that matters."
//                                                        — Zach, campaign kickoff 2026-07-24
//
// This module answers exactly one question, purely: WHERE are the caves? It knows nothing about
// building them (caveStream/caveGen/caveEntrance) and nothing about the terrain hole (terrain.ts).
// That separation is deliberate — the site list is the single source of truth that the streamer,
// the terrain hole registry and the gates all read, so they can never disagree about where a cave is.
//
// ── PURITY (D290) ───────────────────────────────────────────────────────────────────────────────
// A site is a pure function of (worldSeed, grid cell). It NEVER draws from the shared procgen rand
// stream (D208 — that would move every scatter object in the world), never samples live state, and
// gates on `terrain.pureHeightAt` rather than the baked bilinear `heightAt` (the D299 rule: a
// bilinear-vs-formula difference must never be able to flip a descriptor). Every cell spends the
// SAME 4 rand draws whether or not it produces a site (the D226 fixed-budget discipline), so adding
// a rejection rule later cannot shift any other cell's stream.
//
// ── WHY A GRID AND NOT A PER-CHUNK ROLL ─────────────────────────────────────────────────────────
// POIs roll per 112m content chunk, which is fine for a wreck: two neighbours 30m apart is clutter,
// not a bug. A cave is a ~200m-wide underground VOLUME plus a carved hole in the terrain sheet, so
// two nearby sites is a correctness problem (interpenetrating SDF bodies, overlapping holes), not a
// taste problem. The region-grid pattern the S4 hero landmarks use gives MINIMUM SPACING BY
// CONSTRUCTION: one candidate per CAVE_SITE_CELL_M cell, jittered inside a central sub-square, so
// two sites in adjacent cells are at least CELL - 2*JITTER apart no matter what the seed does. No
// rejection loop, no neighbour scan, no order dependence.

import { Tuning } from '../config/tuning.ts';
import { caveEntranceHoleFitsTile, creviceClearProfile } from './caveEntrance.ts';   // cycle 8 — the tile-seam rejection; cycle 9 — the headroom invariant
import { makeRng } from '../core/rng.ts';
import { pickCaveKind, type CaveKind } from './caveKinds.ts';   // DEEPER cycle 9 — the kind mix
import type { BiomeSampler } from './biomes.ts';
import type { Terrain } from './terrain.ts';

/** One cave site. `x`/`z` are SNAPPED to a terrain grid vertex, exactly as `caveEntranceSite` snaps
 *  the origin cave's: the carved hole is then always an exact CREVICE_HOLE_CELLS_X × _Z block of
 *  cells instead of varying by up to a cell per side, which is what lets the tor's cover footprint
 *  be a constant. `seed` is the cave's own generation seed (feeds caveGen + caveEntrance). */
export interface CaveSiteDesc {
  /** Stable descriptor-derived id: `cave:<gx>,<gz>`. Never a runtime registry id (the D292 trap). */
  key: string;
  gx: number;
  gz: number;
  x: number;
  z: number;
  seed: number;
  /** DEEPER cycle 9 — which CAVE KIND stands here (a warren / a fungal cavern / a flooded cave / a
   *  collapsed shaft / the canonical one). Rolled from this cell's own stream AFTER `seed`, so
   *  adding it moved no site and the cycle-8 placement digests are byte-stable. */
  kind: CaveKind;
}

/** Optional conflict test injected by the caller (main.ts wires it to the chunk descriptors). Kept
 *  as an injection rather than an import because chunkManager imports terrain, terrain imports this
 *  module's types, and a direct import would close that cycle. MUST be pure — it is consulted
 *  inside the site derivation and its answer is part of the placement digest. */
export type CaveSiteConflictFn = (x: number, z: number, radius: number) => boolean;

/** The grid cell containing a world point. */
export function caveSiteCellOf(x: number, z: number): { gx: number; gz: number } {
  const C = Tuning.CAVE_SITE_CELL_M;
  return { gx: Math.floor(x / C), gz: Math.floor(z / C) };
}

/** Per-cell seed — its own hash space, so it can never alias a chunk seed or a region seed. */
function siteSeed(worldSeed: number, gx: number, gz: number): number {
  let h = (worldSeed ^ 0xca7e51e5) >>> 0;
  h = Math.imul(h ^ (gx + 0x9e3779b9), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (gz + 0x7f4a7c15), 0xc2b2ae35) >>> 0;
  h ^= h >>> 15;
  return h >>> 0;
}

/** Worst local relief over a ring of radius `r` — the same shape as chunkManager's `pureFlat`, on
 *  the PURE closed-form height. The tor welds a 12.5 × 8.3m carved hole plus an apron into the
 *  sheet; on a steep dune flank the apron's downhill side floats and the uphill side buries. */
function relief(terrain: Terrain, x: number, z: number, r: number): number {
  const c = terrain.pureHeightAt(x, z);
  let worst = 0;
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    const d = Math.abs(terrain.pureHeightAt(x + Math.cos(a) * r, z + Math.sin(a) * r) - c);
    if (d > worst) worst = d;
  }
  return worst;
}

/**
 * The cave site for one grid cell, or null. Pure in (worldSeed, gx, gz).
 *
 * The rejection ladder, in the order it runs (cheapest first, and every rule is a REASON):
 *  1. the per-cell presence roll (density),
 *  2. ORIGIN PROTECTION — nothing inside CAVE_SITE_ORIGIN_CLEAR_M, so the egg cave is the only
 *     cave in the world you can reach from spawn without a journey,
 *  3. ROCKY BIOME — the whole point of the cycle; caves belong to rock, not to sand or salt,
 *  4. the regional biomes that OWN their ground and/or carve the terrain height themselves
 *     (erg dune-sea, wreck-yard, bone-field, the Sarlacc pit): a crevice tor welded into a
 *     heightfield that another system is also displacing is a seam bug waiting to happen,
 *  5. TILE SEAM — the carved hole must fit wholly inside one terrain tile (see the rule body),
 *  6. LOCAL RELIEF — the apron + carved hole need ground that doesn't fall away underneath it,
 *  7. CONTENT CONFLICT — a POI/landmark already owns this ground (injected, see CaveSiteConflictFn),
 *  8. ENTRANCE HEADROOM — the descent's modelled clear height must clear the capsule everywhere, or
 *     the cave is visible and unenterable (cycle 9; see CREVICE_MIN_CLEAR_M).
 */
export function caveSiteInCell(
  worldSeed: number,
  gx: number,
  gz: number,
  terrain: Terrain,
  biomes: BiomeSampler,
  conflict?: CaveSiteConflictFn,
): CaveSiteDesc | null {
  const T = Tuning;
  const rand = makeRng(siteSeed(worldSeed, gx, gz));
  // FIXED DRAW BUDGET — all FIVE draws happen unconditionally, before any rejection.
  // DEEPER cycle 9 added the kind roll and added it LAST, after `genSeed`: the four cycle-8 draws
  // keep their exact values, so every site's position and generation seed are unmoved and the
  // committed placement digests (f180c0fc / f95e4986) stay byte-stable. Appending rather than
  // inserting is the whole discipline here — a draw inserted mid-stream would silently relocate
  // every cave in the world.
  const roll = rand();
  const jx = (rand() - 0.5) * 2 * T.CAVE_SITE_JITTER_M;
  const jz = (rand() - 0.5) * 2 * T.CAVE_SITE_JITTER_M;
  const genSeed = Math.floor(rand() * 0x100000000) >>> 0;
  const kind = pickCaveKind(rand());

  if (roll >= T.CAVE_SITE_CHANCE) return null;

  // Snap to a terrain grid vertex (see CaveSiteDesc).
  const VCELL = T.TERRAIN_CHUNK_SIZE / T.TERRAIN_CHUNK_CELLS;
  const C = T.CAVE_SITE_CELL_M;
  const x = Math.round(((gx + 0.5) * C + jx) / VCELL) * VCELL;
  const z = Math.round(((gz + 0.5) * C + jz) / VCELL) * VCELL;

  // 2 — origin protection. Matches CHUNK_POI_ORIGIN_EXCLUSION_M on purpose: streamed caves begin
  //     exactly where the boot-placed field ends, so a streamed tor can never land on top of a
  //     hand-placed POI, and the egg cave keeps a clear 1.15km of world to itself.
  const clr = T.CAVE_SITE_ORIGIN_CLEAR_M;
  if (x * x + z * z <= clr * clr) return null;

  // 3 — the biome rule.
  if (biomes.biomeAt(x, z) !== 'rocky') return null;

  // 4 — regional biomes / terrain carvers keep their ground.
  if (biomes.ergAt(x, z) > 0) return null;
  if (biomes.wreckYardAt(x, z) > 0) return null;
  if (biomes.boneFieldAt(x, z) > 0) return null;
  if (biomes.sarlaccPitAt(x, z) > 0) return null;

  // 5 — TILE-SEAM REJECTION (DEEPER cycle 8, closing agent). The carved hole is a block of terrain
  //     cells belonging to exactly ONE tile, and `caveEntranceHoleBlock` clamps it to that tile. A
  //     site landing on a tile seam therefore gets a hole TRUNCATED or SHIFTED by a cell — the sheet
  //     stays solid over part of the descent slot and the cave is unreachable, while every other
  //     signal (tor built, interior built, hole registered) reads normal. 1.56% of snapped positions
  //     hit it, i.e. about one cave in 64: rare enough to survive a small gate net, common enough
  //     that a player meeting several caves an hour would find one. Rejected by construction rather
  //     than papered over — see `caveEntranceHoleFitsTile` for why a cross-tile hole is not the fix.
  if (!caveEntranceHoleFitsTile({ x, z })) return null;

  // 6 — local relief.
  if (relief(terrain, x, z, T.CAVE_SITE_RELIEF_RING_M) > T.CAVE_SITE_RELIEF_MAX_M) return null;

  // 7 — content conflict (POI / hero landmark already here).
  if (conflict && conflict(x, z, T.CAVE_SITE_CONTENT_CLEAR_M)) return null;

  // 8 — ENTRANCE HEADROOM (DEEPER cycle 9). Rule 6 asks whether the ground under the TOR is flat
  //     enough; this asks whether the ground over the DESCENT stays high enough. They are different
  //     questions and rule 6 cannot answer this one: its ring is 9m and the pinch lands at 12-14m,
  //     past the carved hole's far edge, where the fissure ceiling stops being the slot's own and
  //     starts following the terrain. See CREVICE_HOLE_CELLS_X / CREVICE_MIN_CLEAR_M and the header
  //     of `creviceClearProfile` for the mechanism and for why no local geometry lever can guarantee
  //     this. Last in the ladder because it is by far the most expensive rule (it builds the station
  //     polyline and samples ~100 columns of pure height) and because everything above it rejects
  //     more cheaply.
  if (creviceClearProfile({ x, z }, terrain, genSeed).minH < T.CREVICE_MIN_CLEAR_M) return null;

  return { key: `cave:${gx},${gz}`, gx, gz, x, z, seed: genSeed, kind };
}

/** Every site whose cell centre lies within `radius` of (x, z), nearest first. Pure. */
export function caveSitesNear(
  worldSeed: number,
  x: number,
  z: number,
  radius: number,
  terrain: Terrain,
  biomes: BiomeSampler,
  conflict?: CaveSiteConflictFn,
): CaveSiteDesc[] {
  const C = Tuning.CAVE_SITE_CELL_M;
  const g0x = Math.floor((x - radius) / C);
  const g1x = Math.floor((x + radius) / C);
  const g0z = Math.floor((z - radius) / C);
  const g1z = Math.floor((z + radius) / C);
  const out: Array<CaveSiteDesc & { d: number }> = [];
  const r2 = radius * radius;
  for (let gx = g0x; gx <= g1x; gx++) {
    for (let gz = g0z; gz <= g1z; gz++) {
      const s = caveSiteInCell(worldSeed, gx, gz, terrain, biomes, conflict);
      if (!s) continue;
      const d = (s.x - x) * (s.x - x) + (s.z - z) * (s.z - z);
      if (d > r2) continue;
      out.push({ ...s, d });
    }
  }
  out.sort((a, b) => a.d - b.d);
  return out.map(({ d: _d, ...s }) => s);
}

/** The minimum centre-to-centre spacing the grid guarantees, in metres. Exported so the gate can
 *  assert it against the cave's MEASURED horizontal extent rather than a hand-waved constant. */
export function caveSiteMinSpacingM(): number {
  return Tuning.CAVE_SITE_CELL_M - 2 * Tuning.CAVE_SITE_JITTER_M;
}
