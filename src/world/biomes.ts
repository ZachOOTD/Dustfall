// Biome sampler (Session P). Independent of terrain heights — driven by a
// second simplex channel at low frequency. Three regions per the user pivot:
// dune (warm sand), rocky (cooler darker brown), salt (near-white flats).
//
// Used by:
//   - world/terrain.ts → per-vertex color tinting
//   - (future Q) player footstep dispatch by surface
//   - (future) cactus/POI placement biasing

import { createNoise2D } from 'simplex-noise';
import type { Rng } from '../core/rng.ts';
import { Tuning } from '../config/tuning.ts';

// Cycle 8 (ACAQ) — 'wreck_yard' is a rare DESTINATION biome, not a noise region:
// a single distance-override disc around a seed-derived anchor far from spawn.
export type BiomeId = 'dune' | 'rocky' | 'salt' | 'wreck_yard' | 'ash_barren';

export interface BiomeSampler {
  biomeAt: (x: number, z: number) => BiomeId;
  /** Raw noise value at (x, z) in [-1, 1]. Useful for soft color blends. */
  rawAt: (x: number, z: number) => number;
  /** Wreck-yard region strength 0..1 (1 in the core, smooth-fading to 0 at the
   *  radius edge). Drives terrain ground-tint + flatten blends. Cycle 8. */
  wreckYardAt: (x: number, z: number) => number;
  /** M12 — ash-barren region strength 0..1 (regional scorched-flats zone). */
  ashBarrenAt: (x: number, z: number) => number;
  /** The seed-derived wreck-yard region center (the rare destination). */
  wreckYardAnchor: { x: number; z: number };
  /** Wreck-yard region radius (m). */
  wreckYardRadius: number;
  /** ACAR — the Sarlacc pit's own seed-derived anchor (a SEPARATE dune-desert
   *  hazard, not the wreck-yard). */
  sarlaccPitAnchor: { x: number; z: number };
  /** Sarlacc-pit terrain-clearing strength 0..1 (a flattened sand bowl). */
  sarlaccPitAt: (x: number, z: number) => number;
  /** M8 ⑨ — the deep cave's own seed-derived anchor (a far descent funnel; the
   *  enclosed interior is a separate module placed at this funnel's floor). */
  caveAnchor: { x: number; z: number };
  /** Deep-cave terrain-clearing strength 0..1 (the recessed descent funnel). */
  caveAt: (x: number, z: number) => number;
}

export function createBiomeSampler(rand: Rng): BiomeSampler {
  const noise = createNoise2D(rand);
  const freq = Tuning.BIOME_NOISE_FREQ;

  const rawAt = (x: number, z: number): number => noise(x * freq, z * freq);

  // Pick the wreck-yard anchor: a seed-derived polar position far from spawn
  // (one per seed). Computed AFTER createNoise2D so the rng state is stable.
  const wyDist = Tuning.WRECK_YARD_DIST_MIN + rand() * (Tuning.WRECK_YARD_DIST_MAX - Tuning.WRECK_YARD_DIST_MIN);
  const wyAng = rand() * Math.PI * 2;
  const wreckYardAnchor = {
    x: Tuning.OPENING_SCENE_ANCHOR_X + Math.cos(wyAng) * wyDist,
    z: Tuning.OPENING_SCENE_ANCHOR_Z + Math.sin(wyAng) * wyDist,
  };
  const wreckYardRadius = Tuning.WRECK_YARD_RADIUS;

  const wreckYardAt = (x: number, z: number): number => {
    const dx = x - wreckYardAnchor.x, dz = z - wreckYardAnchor.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d >= wreckYardRadius) return 0;
    if (d <= wreckYardRadius * 0.6) return 1;
    const t = (wreckYardRadius - d) / (wreckYardRadius * 0.4);
    return t * t * (3 - 2 * t);   // smoothstep core→edge
  };

  // ACAR — the Sarlacc pit is a SEPARATE dune-desert hazard, not the wreck-yard
  // centerpiece. Pick its own anchor: a seed-derived DUNE spot away from spawn +
  // the graveyard. (rng consumed after the wreck-yard anchor → deterministic.)
  let sarlaccPitAnchor: { x: number; z: number } = {
    x: Tuning.OPENING_SCENE_ANCHOR_X + Tuning.SARLACC_PIT_DIST_MIN,
    z: Tuning.OPENING_SCENE_ANCHOR_Z,
  };
  for (let i = 0; i < 60; i++) {
    const d = Tuning.SARLACC_PIT_DIST_MIN + rand() * (Tuning.SARLACC_PIT_DIST_MAX - Tuning.SARLACC_PIT_DIST_MIN);
    const a = rand() * Math.PI * 2;
    const x = Tuning.OPENING_SCENE_ANCHOR_X + Math.cos(a) * d;
    const z = Tuning.OPENING_SCENE_ANCHOR_Z + Math.sin(a) * d;
    if (wreckYardAt(x, z) > 0) continue;                  // not in/near the graveyard
    const n = rawAt(x, z);
    if (n >= Tuning.BIOME_THRESHOLD_ROCKY && n <= Tuning.BIOME_THRESHOLD_SALT) {  // a dune cell
      sarlaccPitAnchor = { x, z };
      break;
    }
  }
  const pitClearing = Tuning.SARLACC_PIT_CLEARING;
  const sarlaccPitAt = (x: number, z: number): number => {
    const dx = x - sarlaccPitAnchor.x, dz = z - sarlaccPitAnchor.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d >= pitClearing) return 0;
    if (d <= pitClearing * 0.55) return 1;
    const t = (pitClearing - d) / (pitClearing * 0.45);
    return t * t * (3 - 2 * t);
  };

  // M8 ⑨ (C47) — the DEEP CAVE's own seed-derived anchor: a FAR dune spot, away from spawn,
  // the graveyard, AND the Sarlacc pit (both carve terrain — they must not overlap). rng is
  // consumed after the Sarlacc anchor → the prior draws stay stable (deterministic append).
  let caveAnchor: { x: number; z: number } = {
    x: Tuning.OPENING_SCENE_ANCHOR_X - Tuning.CAVE_PIT_DIST_MIN,
    z: Tuning.OPENING_SCENE_ANCHOR_Z,
  };
  for (let i = 0; i < 80; i++) {
    const d = Tuning.CAVE_PIT_DIST_MIN + rand() * (Tuning.CAVE_PIT_DIST_MAX - Tuning.CAVE_PIT_DIST_MIN);
    const a = rand() * Math.PI * 2;
    const x = Tuning.OPENING_SCENE_ANCHOR_X + Math.cos(a) * d;
    const z = Tuning.OPENING_SCENE_ANCHOR_Z + Math.sin(a) * d;
    if (wreckYardAt(x, z) > 0) continue;                  // not in/near the graveyard
    const sdx = x - sarlaccPitAnchor.x, sdz = z - sarlaccPitAnchor.z;
    if (Math.sqrt(sdx * sdx + sdz * sdz) < Tuning.CAVE_PIT_SARLACC_CLEAR) continue;   // clear of the Sarlacc pit
    const n = rawAt(x, z);
    if (n >= Tuning.BIOME_THRESHOLD_ROCKY && n <= Tuning.BIOME_THRESHOLD_SALT) {  // a dune cell
      caveAnchor = { x, z };
      break;
    }
  }
  const caveClearing = Tuning.CAVE_PIT_CLEARING;
  const caveAt = (x: number, z: number): number => {
    const dx = x - caveAnchor.x, dz = z - caveAnchor.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d >= caveClearing) return 0;
    if (d <= caveClearing * 0.5) return 1;
    const t = (caveClearing - d) / (caveClearing * 0.5);
    return t * t * (3 - 2 * t);
  };

  // ── Infinite Sands S4 — REGIONAL wreck-yard anchors. The infinite field
  // rolls a rare wreck-yard per REGION (a pure hash of a per-world seed +
  // region coords — no rng draws per query), feeding the SAME falloff the
  // origin yard uses, so far graveyards get the ground tint/flatten, the
  // 'wreck_yard' biome id (→ POI archetype weights), and the dead-place
  // read for free. The extra rand() draw below is APPENDED after all
  // existing anchor draws — every prior anchor stays byte-identical (the
  // deterministic-append precedent from the cave anchor). Anchors keep
  // WRECK_YARD_REGION_MIN_DIST from the origin so the initial ±1200m
  // terrain ring (corner radius ≈1697m) + all boot placement never sample
  // a regional yard — the origin world bakes byte-identically. ──
  const regionSeed = Math.floor(rand() * 0x100000000) >>> 0;
  const ashRegionSeed = Math.floor(rand() * 0x100000000) >>> 0;   // M12 — appended after the yard seed (yard stays byte-identical)
  const REGION_M = Tuning.CHUNK_REGION_CHUNKS * Tuning.CHUNK_SIZE;
  const regionMix = (rx: number, rz: number): number => {
    let h = regionSeed >>> 0;
    h = Math.imul(h ^ (rx | 0), 0x85ebca6b) >>> 0;
    h = ((h << 13) | (h >>> 19)) >>> 0;
    h = Math.imul(h ^ (rz | 0), 0xc2b2ae35) >>> 0;
    h ^= h >>> 16;
    h = Math.imul(h, 0x45d9f3b) >>> 0;
    h ^= h >>> 15;
    return h >>> 0;
  };
  const _regionYards = new Map<string, { x: number; z: number } | null>();
  const regionalYardAnchor = (rx: number, rz: number): { x: number; z: number } | null => {
    const k = `${rx},${rz}`;
    const memo = _regionYards.get(k);
    if (memo !== undefined) return memo;
    const h = regionMix(rx, rz);
    // Two derived 0..1 values from one hash (hi/lo halves) + a presence roll.
    const roll = (h & 0xffff) / 0x10000;
    let out: { x: number; z: number } | null = null;
    if (roll < Tuning.WRECK_YARD_REGION_CHANCE) {
      const u = ((h >>> 16) & 0xff) / 256;
      const v = ((h >>> 24) & 0xff) / 256;
      // Keep the anchor a full radius inside its region so the falloff
      // stays local-ish; neighbors are still scanned 3×3.
      const margin = wreckYardRadius;
      const ax = rx * REGION_M + margin + u * (REGION_M - 2 * margin);
      const az = rz * REGION_M + margin + v * (REGION_M - 2 * margin);
      if (ax * ax + az * az >= Tuning.WRECK_YARD_REGION_MIN_DIST * Tuning.WRECK_YARD_REGION_MIN_DIST) {
        out = { x: ax, z: az };
      }
    }
    _regionYards.set(k, out);
    return out;
  };
  const yardFalloff = (d: number): number => {
    if (d >= wreckYardRadius) return 0;
    if (d <= wreckYardRadius * 0.6) return 1;
    const t = (wreckYardRadius - d) / (wreckYardRadius * 0.4);
    return t * t * (3 - 2 * t);
  };
  // The public wreckYardAt: max of the origin anchor + any regional anchor
  // in the 3×3 region neighborhood of the query point.
  const wreckYardAtFull = (x: number, z: number): number => {
    let best = wreckYardAt(x, z);
    if (best >= 1) return 1;
    const rx0 = Math.floor(x / REGION_M);
    const rz0 = Math.floor(z / REGION_M);
    for (let rx = rx0 - 1; rx <= rx0 + 1; rx++) {
      for (let rz = rz0 - 1; rz <= rz0 + 1; rz++) {
        const a = regionalYardAnchor(rx, rz);
        if (!a) continue;
        const dx = x - a.x, dz = z - a.z;
        const f = yardFalloff(Math.sqrt(dx * dx + dz * dz));
        if (f > best) { best = f; if (best >= 1) return 1; }
      }
    }
    return best;
  };

  // ── M12 — ASH-BARREN regional anchors. A rare scorched-flats zone in the
  //    far field (a "something burned through here" read), mirroring the
  //    wreck-yard regional pattern with its OWN appended seed (so the yard
  //    stays byte-identical) and NO origin anchor (purely far-field). Keeps
  //    ASH_BARREN_REGION_MIN_DIST from origin. ──
  const ashRadius = Tuning.ASH_BARREN_RADIUS;
  const ashMix = (rx: number, rz: number): number => {
    let h = ashRegionSeed >>> 0;
    h = Math.imul(h ^ (rx | 0), 0x85ebca6b) >>> 0;
    h = ((h << 13) | (h >>> 19)) >>> 0;
    h = Math.imul(h ^ (rz | 0), 0xc2b2ae35) >>> 0;
    h ^= h >>> 16;
    h = Math.imul(h, 0x45d9f3b) >>> 0;
    h ^= h >>> 15;
    return h >>> 0;
  };
  const _regionAsh = new Map<string, { x: number; z: number } | null>();
  const regionalAshAnchor = (rx: number, rz: number): { x: number; z: number } | null => {
    const k = `${rx},${rz}`;
    const memo = _regionAsh.get(k);
    if (memo !== undefined) return memo;
    const h = ashMix(rx, rz);
    const roll = (h & 0xffff) / 0x10000;
    let out: { x: number; z: number } | null = null;
    if (roll < Tuning.ASH_BARREN_REGION_CHANCE) {
      const u = ((h >>> 16) & 0xff) / 256;
      const v = ((h >>> 24) & 0xff) / 256;
      const margin = ashRadius;
      const ax = rx * REGION_M + margin + u * (REGION_M - 2 * margin);
      const az = rz * REGION_M + margin + v * (REGION_M - 2 * margin);
      if (ax * ax + az * az >= Tuning.ASH_BARREN_REGION_MIN_DIST * Tuning.ASH_BARREN_REGION_MIN_DIST) {
        out = { x: ax, z: az };
      }
    }
    _regionAsh.set(k, out);
    return out;
  };
  const ashFalloff = (d: number): number => {
    if (d >= ashRadius) return 0;
    if (d <= ashRadius * 0.6) return 1;
    const t = (ashRadius - d) / (ashRadius * 0.4);
    return t * t * (3 - 2 * t);
  };
  const ashBarrenAtFull = (x: number, z: number): number => {
    let best = 0;
    const rx0 = Math.floor(x / REGION_M);
    const rz0 = Math.floor(z / REGION_M);
    for (let rx = rx0 - 1; rx <= rx0 + 1; rx++) {
      for (let rz = rz0 - 1; rz <= rz0 + 1; rz++) {
        const a = regionalAshAnchor(rx, rz);
        if (!a) continue;
        const dx = x - a.x, dz = z - a.z;
        const f = ashFalloff(Math.sqrt(dx * dx + dz * dz));
        if (f > best) { best = f; if (best >= 1) return 1; }
      }
    }
    return best;
  };

  const biomeAt = (x: number, z: number): BiomeId => {
    if (wreckYardAtFull(x, z) > 0.5) return 'wreck_yard';
    if (ashBarrenAtFull(x, z) > 0.5) return 'ash_barren';   // M12
    const n = rawAt(x, z);
    if (n < Tuning.BIOME_THRESHOLD_ROCKY) return 'rocky';
    if (n > Tuning.BIOME_THRESHOLD_SALT) return 'salt';
    return 'dune';
  };

  return { biomeAt, rawAt, wreckYardAt: wreckYardAtFull, ashBarrenAt: ashBarrenAtFull, wreckYardAnchor, wreckYardRadius, sarlaccPitAnchor, sarlaccPitAt, caveAnchor, caveAt };
}

// GG — find the cell deepest into `target` biome via a grid sweep over a
// disc around the origin. Generalises the original `findSaltCentroid` so
// session #3 (procgen POIs) can reuse the same scoring for any biome.
// `excludeCenters` enables greedy multi-pass placement: the next call
// returns the best remaining cell outside all listed circles, so wells /
// POIs naturally distribute across separate regions of the same biome.
export interface BiomeCentroidOptions {
  searchRadius?: number;
  gridStep?: number;
  excludeCenters?: ReadonlyArray<{ x: number; z: number; radius: number }>;
}

export function findBiomeCentroid(
  biomes: BiomeSampler,
  target: BiomeId,
  options?: BiomeCentroidOptions,
): { x: number; z: number } | null {
  const range = options?.searchRadius ?? Tuning.BIOME_CENTROID_SEARCH_RADIUS;
  const step = options?.gridStep ?? Tuning.BIOME_CENTROID_GRID_STEP;
  const exclude = options?.excludeCenters;

  let best: { x: number; z: number; score: number } | null = null;
  for (let z = -range; z <= range; z += step) {
    for (let x = -range; x <= range; x += step) {
      if (biomes.biomeAt(x, z) !== target) continue;
      // Reject cells inside any exclusion circle so greedy multi-pass
      // placement spreads picks across separate biome regions.
      if (exclude) {
        let blocked = false;
        for (const c of exclude) {
          const dx = x - c.x;
          const dz = z - c.z;
          if (dx * dx + dz * dz < c.radius * c.radius) { blocked = true; break; }
        }
        if (blocked) continue;
      }
      // Higher raw noise = deeper into target territory. No origin bias —
      // the pre-EE single-well bias overweighted the centroid toward
      // spawn, which doesn't generalise to the 1100m search radius.
      const score = biomes.rawAt(x, z);
      if (!best || score > best.score) best = { x, z, score };
    }
  }
  return best ? { x: best.x, z: best.z } : null;
}
