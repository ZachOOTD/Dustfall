// Session WW — low-stat warning vignettes. Two screen-edge tints:
// cold (blue) when temperature < COLD_VIGNETTE_THRESHOLD, thirst
// (brown/sepia) when thirst < THIRST_VIGNETTE_THRESHOLD. Intensity
// ramps linearly as the stat worsens from threshold → 0.
//
// Architecture note: stormVignette uses an in-scene ShaderMaterial
// because it composites with the rendered world + tone maps with
// the renderer (atmosphere-tier). Stat vignettes are HUD-tier —
// they're a UI overlay, not part of the world. CSS divs are
// cheaper here: two radial-gradient backgrounds, opacity tweaked
// per frame, no draw-call cost. (D78 — vignette pattern clone vs.
// reuse: clone is cheaper for 3 callers than abstracting.)

import type { GameContext } from '../GameContext.ts';
import { Tuning } from '../config/tuning.ts';

let _coldEl: HTMLDivElement | null = null;
let _thirstEl: HTMLDivElement | null = null;

export function createStatVignette(): void {
  _coldEl = document.createElement('div');
  _coldEl.id = 'stat-vignette-cold';
  _coldEl.style.opacity = '0';
  document.body.appendChild(_coldEl);

  _thirstEl = document.createElement('div');
  _thirstEl.id = 'stat-vignette-thirst';
  _thirstEl.style.opacity = '0';
  document.body.appendChild(_thirstEl);
}

export function updateStatVignette(ctx: GameContext): void {
  if (!_coldEl || !_thirstEl) return;

  // Cold (negative temperature half — bipolar bar; we treat
  // temperature 0 = neutral, negative = cold, positive = heat).
  // For now we tint on cold side only.
  const temp = ctx.stats.temperature;
  // Map: 0 (neutral) → 0 opacity. -1 (deathly cold) → max opacity.
  // Linear ramp once temp drops below the negative threshold.
  // COLD_VIGNETTE_THRESHOLD is the magnitude where ramp starts (e.g. 0.3 → starts at temp = -0.3).
  let coldOpacity = 0;
  if (temp < -Tuning.COLD_VIGNETTE_THRESHOLD) {
    const depth = (-temp - Tuning.COLD_VIGNETTE_THRESHOLD) / (1 - Tuning.COLD_VIGNETTE_THRESHOLD);
    coldOpacity = Math.min(1, depth) * Tuning.STAT_VIGNETTE_MAX_OPACITY;
  }

  // Thirst is in [0,1] where 1 = sated, 0 = dying of thirst.
  const thirst = ctx.stats.thirst;
  let thirstOpacity = 0;
  if (thirst < Tuning.THIRST_VIGNETTE_THRESHOLD) {
    const depth = (Tuning.THIRST_VIGNETTE_THRESHOLD - thirst) / Tuning.THIRST_VIGNETTE_THRESHOLD;
    thirstOpacity = Math.min(1, depth) * Tuning.STAT_VIGNETTE_MAX_OPACITY;
  }

  // Suppress both during peak storm so the stormVignette dominates
  // (no triple-tinting the screen).
  const stormPeak = ctx.weather.intensity > 0.7;
  if (stormPeak) {
    coldOpacity = 0;
    thirstOpacity = 0;
  }

  _coldEl.style.opacity = coldOpacity.toFixed(3);
  _thirstEl.style.opacity = thirstOpacity.toFixed(3);
}
