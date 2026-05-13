// Persistent ambient layer: a constant wind whoosh that crossfades by time of day.
// Optional cricket layer at night (sparse pulses, not implemented here yet —
// hook is in place).

import type { GameContext } from '../GameContext.ts';
import { getAudioInternals } from './audio.ts';

let _windSrc: AudioBufferSourceNode | null = null;
let _windGain: GainNode | null = null;

/** Idempotent: starts the wind loop once audio is unlocked. */
export function startSoundscape(): void {
  const a = getAudioInternals();
  if (!a || _windSrc) return;

  const src = a.ctx.createBufferSource();
  src.buffer = a.noiseBuffer;
  src.loop = true;

  // Bandpass for "wind through cracks" character.
  const filter = a.ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 380;
  filter.Q.value = 0.55;

  // Slight low-frequency gain wobble so it doesn't sound flat.
  const wobbleLFO = a.ctx.createOscillator();
  wobbleLFO.frequency.value = 0.18;
  const wobbleGain = a.ctx.createGain();
  wobbleGain.gain.value = 0.06; // wobble amplitude

  const gain = a.ctx.createGain();
  gain.gain.value = 0.18;

  wobbleLFO.connect(wobbleGain).connect(gain.gain);
  src.connect(filter).connect(gain).connect(a.ambient);

  src.start();
  wobbleLFO.start();

  _windSrc = src;
  _windGain = gain;
}

export function updateSoundscape(ctx: GameContext, _dt: number): void {
  const a = getAudioInternals();
  if (!a || !_windGain) return;
  // Wind picks up at night and dusk, and roars during a sandstorm.
  const nightMix = Math.max(0, -ctx.time.sunHeight);
  const stormBoost = ctx.weather.intensity * 0.45; // up to ~+6dB
  const target = 0.13 + nightMix * 0.12 + stormBoost;
  _windGain.gain.linearRampToValueAtTime(target, a.ctx.currentTime + 0.4);
}
