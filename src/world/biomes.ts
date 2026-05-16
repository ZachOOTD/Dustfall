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

export type BiomeId = 'dune' | 'rocky' | 'salt';

export interface BiomeSampler {
  biomeAt: (x: number, z: number) => BiomeId;
  /** Raw noise value at (x, z) in [-1, 1]. Useful for soft color blends. */
  rawAt: (x: number, z: number) => number;
}

export function createBiomeSampler(rand: Rng): BiomeSampler {
  const noise = createNoise2D(rand);
  const freq = Tuning.BIOME_NOISE_FREQ;

  const rawAt = (x: number, z: number): number => noise(x * freq, z * freq);

  const biomeAt = (x: number, z: number): BiomeId => {
    const n = rawAt(x, z);
    if (n < Tuning.BIOME_THRESHOLD_ROCKY) return 'rocky';
    if (n > Tuning.BIOME_THRESHOLD_SALT) return 'salt';
    return 'dune';
  };

  return { biomeAt, rawAt };
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
