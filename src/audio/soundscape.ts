// Persistent ambient + music orchestration.
//
// Session V placeholder: ambient wind is DISABLED pending a full audio
// overhaul (the bandpassed-noise loop felt abrasive and the procedural
// music drone+pluck system wasn't the right vibe for calm weather). For
// now only the storm music layer plays, and only when a sandstorm is
// active. The wind code below is kept commented so it's a one-paste
// restore when the overhaul happens.

import type { GameContext } from '../GameContext.ts';
import { getAudioInternals } from './audio.ts';
import { updateMusic } from './music.ts';
// startMusic kept available — re-import when re-enabling music.

let _started = false;

/** Idempotent: kicks off music voices once the audio context is unlocked. */
export function startSoundscape(): void {
  if (_started) return;
  const a = getAudioInternals();
  if (!a) return;
  _started = true;

  // ── Wind layer (disabled) ─────────────────────────────────────────────
  // Restore by un-commenting and re-adding the _windGain runtime ramp in
  // updateSoundscape. See git history for the previous tuning.
  //
  // const src = a.ctx.createBufferSource();
  // src.buffer = a.noiseBuffer;
  // src.loop = true;
  // const filter = a.ctx.createBiquadFilter();
  // filter.type = 'bandpass';
  // filter.frequency.value = 380;
  // filter.Q.value = 0.55;
  // const gain = a.ctx.createGain();
  // gain.gain.value = 0.06;
  // src.connect(filter).connect(gain).connect(a.ambient);
  // src.start();

  // Session V/W placeholder — ALL music disabled (was storm-only). Procedural
  // drones + plucks didn't land; audio overhaul pending. Restore by
  // un-commenting startMusic() below.
  //
  // try {
  //   startMusic();
  // } catch (e) {
  //   // eslint-disable-next-line no-console
  //   console.error('[soundscape] startMusic failed:', e);
  // }
}

export function updateSoundscape(ctx: GameContext, _dt: number): void {
  const a = getAudioInternals();
  if (!a) return;
  updateMusic(ctx);
}
