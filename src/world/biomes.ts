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
