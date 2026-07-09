// M5 diurnal-cycle (campaign 2026-07-09) — per-profile creature ACTIVITY from sun
// height. One tiny pure function so every creature reads the same clock; all knobs
// in tuning.ts. Transient (no save state); deterministic (sunHeight only, no rand).
//
// Profiles (iteration-plan M5b):
//   'diurnal'     — lizards: full activity by early morning, a low floor at night
//                   (a sleeping lizard still exists — it just barely reacts).
//   'crepuscular' — shrews: activity peaks in the dawn/dusk bands (|sunHeight| near
//                   the horizon), quiet at midday AND midnight.
//   'dayflier'    — vultures: airborne behavior by day only; below the roost line
//                   they sit their perch and don't launch (0 = roosting).
// The sandworm already has its own twilight system (ACC twilightActivityMultiplier
// + ambient breach, D121) — NOT routed through this; verified, not duplicated.

import type { GameContext } from '../GameContext.ts';
import { Tuning } from '../config/tuning.ts';

export type DiurnalProfile = 'diurnal' | 'crepuscular' | 'dayflier';

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

/** Activity level 0..1 for a creature profile at the current sun height. */
export function diurnalActivity01(ctx: GameContext, profile: DiurnalProfile): number {
  const sy = ctx.time.sunHeight;
  switch (profile) {
    case 'diurnal': {
      const act = clamp01(sy * 3);                       // full by early morning
      return Math.max(Tuning.DIURNAL_NIGHT_FLOOR, act);
    }
    case 'crepuscular': {
      // A bell around the twilight sun height — sunrise AND sunset both pass
      // through it; midday (sy≈1) and midnight (sy≈-1) sit in the tails.
      const d = sy - Tuning.CREPUSCULAR_PEAK_SY;
      const bell = Math.exp(-(d * d) / (2 * Tuning.CREPUSCULAR_SIGMA * Tuning.CREPUSCULAR_SIGMA));
      return Tuning.CREPUSCULAR_FLOOR + (1 - Tuning.CREPUSCULAR_FLOOR) * bell;
    }
    case 'dayflier':
      // 0 below the roost line (perched, asleep), ramping to 1 by mid-morning.
      return clamp01((sy - Tuning.VULTURE_ROOST_BELOW_SY) * 4);
  }
}
