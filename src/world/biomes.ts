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
export type BiomeId = 'dune' | 'rocky' | 'salt' | 'wreck_yard';

export interface BiomeSampler {
  biomeAt: (x: number, z: number) => BiomeId;
  /** Raw noise value at (x, z) in [-1, 1]. Useful for soft color blends. */
  rawAt: (x: number, z: number) => number;
  /** Wreck-yard region strength 0..1 (1 in the core, smooth-fading to 0 at the
   *  radius edge). Drives terrain ground-tint + flatten blends. Cycle 8. */
  wreckYardAt: (x: number, z: number) => number;
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

  const biomeAt = (x: number, z: number): BiomeId => {
    if (wreckYardAt(x, z) > 0.5) return 'wreck_yard';
    const n = rawAt(x, z);
    if (n < Tuning.BIOME_THRESHOLD_ROCKY) return 'rocky';
    if (n > Tuning.BIOME_THRESHOLD_SALT) return 'salt';
    return 'dune';
  };

  return { biomeAt, rawAt, wreckYardAt, wreckYardAnchor, wreckYardRadius, sarlaccPitAnchor, sarlaccPitAt, caveAnchor, caveAt };
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
