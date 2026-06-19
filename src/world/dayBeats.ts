// Diurnal beats (M5b, C35).
//
// The day/night cycle is fully simulated (the sun arcs, the sky + light shift, days
// count toward the long storm), but crossing a day boundary was SILENT. This marks
// the felt moments: a warm hopeful swell as the sun CRESTS (you survived the night)
// and a cooler settling swell as it SETS (the cold night comes) — giving the survival
// rhythm emotional weight. Pure tone cues (audio); the visuals/pacing are unchanged.
//
// Detection: a threshold crossing of `ctx.time.sunHeight` (deterministic, from
// dayTime). Fires once per crossing (the next frame is already past the threshold).
// Transient — no save state.

import type { GameContext } from '../GameContext.ts';
import { playDawnTone, playDuskTone } from '../audio/audio.ts';

const D = 0.04;        // sun-height threshold for the sunrise/sunset crossing
let _prevSy = NaN;     // NaN = uninitialised (first frame / after a reset → no beat)

/** Reset on world rebuild (new game / load) so a sun-position jump can't fire a
 *  spurious beat. */
export function resetDayBeats(): void {
  _prevSy = NaN;
}

export function updateDayBeats(ctx: GameContext): void {
  const sy = ctx.time.sunHeight;
  if (Number.isNaN(_prevSy)) { _prevSy = sy; return; }   // first frame — seed, no beat
  // Suppress under a real storm — a beat would be lost in the roar anyway.
  if (ctx.weather.intensity < 0.5) {
    if (_prevSy <= D && sy > D) playDawnTone();           // sun crests the horizon → dawn
    else if (_prevSy >= -D && sy < -D) playDuskTone();    // sun drops below → dusk
  }
  _prevSy = sy;
}
