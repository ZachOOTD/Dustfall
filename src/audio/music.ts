// AAP — procedural atmospheric music. Three continuous Web Audio tracks
// crossfaded by world state. Per D3 (no .ogg files): every track is
// synthesized at boot via oscillators + filters. The pre-AAP
// soundscape.ts music-calm/music-tense stems were sample-based and
// silent in production (no .ogg pack ever shipped); this module fills
// the actual music slot independently.
//
// Three tracks:
//   day    — warm C-minor drone bed + sparse rising-fifth motif every
//            ~12-18s. Continuous, low volume.
//   storm  — chromatic dissonance (C + Db tritone-adjacent drone),
//            filtered noise pulses, low rumble. Builds on storm peak.
//   night  — sparse low pad in C-minor + soft high chime tone every
//            ~20-30s.
//
// Crossfade weights derive from sun height + perceivedIntensity (D79):
//   storm peak  → storm dominates
//   day (sunHeight > 0.2, low storm) → day track
//   night (sunHeight < 0.0)           → night track
//   dawn/dusk crossfade smoothly between them
//
// The motifs are scheduled as one-shot oscillators bound to the track's
// gain — when the track fades out they go silent without artifacts.
// Master gain (MUSIC_BUS_TARGET) is low so SFX still dominates.

import type { GameContext } from '../GameContext.ts';
import { getAudioInternals } from './audio.ts';

const MUSIC_BUS_TARGET = 0.45;       // peak master gain when one track is fully blended in
const RAMP_TIME = 0.6;

// Per-track per-frame target gains, blended from world state.
const DAY_TARGET   = 1.00;
const STORM_TARGET = 1.10;
const NIGHT_TARGET = 0.90;

interface TrackNodes {
  /** Per-track gain bus. Sum of all oscillators + noise sources for
   *  this track route through here. */
  gain: GainNode;
  /** Most recently-requested gain target (for snapshot/debug). */
  target: number;
  /** Wall-clock at which the next motif (arpeggio / chime) should fire.
   *  Module-managed; some tracks have no motif and leave this at 0. */
  nextMotifAt: number;
}

interface MusicState {
  ctx: AudioContext;
  bus: GainNode;
  day:   TrackNodes;
  storm: TrackNodes;
  night: TrackNodes;
  startTime: number;
  driftPhase: number;
}

let _state: MusicState | null = null;

// Escape-pod intro (C2, 2026-07-02) — the intro/ship/space beats have their OWN audio
// (cockpit hum, klaxon, its music cues), so the normal game MUSIC must go SILENT while
// the intro owns the scene (gameplay music over the ship-in-orbit read is wrong). We
// duck the master `bus` to 0 while suppressed and restore it when the intro hands off —
// a smooth ramp (no pop) via the bus gain, orthogonal to the per-track crossfade. The
// tracks keep synthesizing (cheap oscillators) behind a silent bus; nothing is torn
// down, so there's no muted-forever state — clearing suppression ramps the bus back up.
let _musicSuppressed = false;

/** Suppress (duck to silent) or restore the game music bus — called by the escape-pod
 *  intro so the ship/space beats play only the intro's own audio. Idempotent; ramps the
 *  master bus so there's no pop. Safe before startMusic (the flag is honored at start). */
export function setMusicSuppressed(suppressed: boolean): void {
  _musicSuppressed = suppressed;
  if (!_state) return;
  const target = suppressed ? 0 : MUSIC_BUS_TARGET;
  rampParam(_state.bus.gain, target, _state.ctx, 0.6);
}

function clamp01(x: number): number { return x < 0 ? 0 : x > 1 ? 1 : x; }
function smoothstep(e0: number, e1: number, x: number): number {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
}

function rampParam(p: AudioParam, target: number, ctx: AudioContext, t = RAMP_TIME): void {
  const now = ctx.currentTime;
  p.cancelScheduledValues(now);
  p.setValueAtTime(p.value, now);
  p.linearRampToValueAtTime(target, now + t);
}

// ─────────────────────────────────────────────────────────────
// Track construction
// ─────────────────────────────────────────────────────────────

/** Day track — slow C-minor harmonic drone (root C2 + fifth G2 +
 *  minor third Eb3). Triangle waves through lowpass for warmth.
 *  Soft amplitude wobble per oscillator at incommensurable rates so
 *  the bed never settles into a phase pattern. */
function buildDayTrack(ctx: AudioContext, busDst: GainNode): TrackNodes {
  const gain = ctx.createGain();
  gain.gain.value = 0;
  gain.connect(busDst);
  // Three triangle drones, slightly detuned for movement.
  const notes = [
    { freq: 65.41,  detune: -8, gainAmt: 0.30, wobbleHz: 0.07 },  // C2
    { freq: 98.00,  detune: +6, gainAmt: 0.18, wobbleHz: 0.11 },  // G2
    { freq: 155.56, detune: -4, gainAmt: 0.12, wobbleHz: 0.13 },  // Eb3
  ];
  for (const n of notes) {
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = n.freq;
    osc.detune.value = n.detune;
    const oscGain = ctx.createGain();
    oscGain.gain.value = n.gainAmt;
    // LFO on the oscillator's gain — slow tremolo, ±30% amplitude.
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = n.wobbleHz;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = n.gainAmt * 0.30;
    lfo.connect(lfoGain).connect(oscGain.gain);
    // Routing: osc → lowpass → oscGain → trackGain
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 800;
    lp.Q.value = 0.6;
    osc.connect(lp).connect(oscGain).connect(gain);
    osc.start();
    lfo.start();
  }
  return { gain, target: 0, nextMotifAt: 0 };
}

/** Storm track — dissonant drone (C + Db, semitone clash) + low
 *  rumble noise + occasional filtered noise sweeps. Bandpass-Q
 *  cranked higher than day track for tension. */
function buildStormTrack(ctx: AudioContext, busDst: GainNode, noiseBuf: AudioBuffer): TrackNodes {
  const gain = ctx.createGain();
  gain.gain.value = 0;
  gain.connect(busDst);
  // Two dissonant drones — sawtooth for harmonic edge.
  for (const { freq, detune, gainAmt } of [
    { freq: 65.41,  detune: 0,    gainAmt: 0.20 },   // C2
    { freq: 69.30,  detune: +14,  gainAmt: 0.18 },   // Db2 (semitone clash)
  ]) {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = freq;
    osc.detune.value = detune;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 300;
    lp.Q.value = 0.7;
    const oscGain = ctx.createGain();
    oscGain.gain.value = gainAmt;
    osc.connect(lp).connect(oscGain).connect(gain);
    osc.start();
  }
  // Low rumble — looped pink-ish noise, lowpass.
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuf;
  noise.loop = true;
  noise.playbackRate.value = 0.45;
  const noiseLp = ctx.createBiquadFilter();
  noiseLp.type = 'lowpass';
  noiseLp.frequency.value = 180;
  noiseLp.Q.value = 0.9;
  const noiseGain = ctx.createGain();
  noiseGain.gain.value = 0.20;
  noise.connect(noiseLp).connect(noiseGain).connect(gain);
  noise.start();
  return { gain, target: 0, nextMotifAt: 0 };
}

/** Night track — sparse low sine pad in C minor + occasional faint
 *  high chime. Almost no rhythm, just held tones. */
function buildNightTrack(ctx: AudioContext, busDst: GainNode): TrackNodes {
  const gain = ctx.createGain();
  gain.gain.value = 0;
  gain.connect(busDst);
  // Two soft sine pads — root + minor third octave up.
  for (const { freq, detune, gainAmt, wobbleHz } of [
    { freq: 130.81, detune: 0,   gainAmt: 0.22, wobbleHz: 0.05 },  // C3
    { freq: 311.13, detune: +3,  gainAmt: 0.10, wobbleHz: 0.08 },  // Eb4
  ]) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    osc.detune.value = detune;
    const oscGain = ctx.createGain();
    oscGain.gain.value = gainAmt;
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = wobbleHz;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = gainAmt * 0.40;
    lfo.connect(lfoGain).connect(oscGain.gain);
    osc.connect(oscGain).connect(gain);
    osc.start();
    lfo.start();
  }
  return { gain, target: 0, nextMotifAt: 12 + Math.random() * 10 };
}

/** One-shot rising-fifth motif for the day track — quick sine pulses
 *  C5 → G5, slight chorus, fades over ~1.8s. Routed through the day
 *  track's gain so it dampens when the track fades out. */
function fireDayMotif(state: MusicState): void {
  const ctx = state.ctx;
  const t = ctx.currentTime;
  const dst = state.day.gain;
  for (const [freq, startOffset] of [[523.25, 0], [783.99, 0.35]] as const) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0, t + startOffset);
    env.gain.linearRampToValueAtTime(0.12, t + startOffset + 0.08);
    env.gain.exponentialRampToValueAtTime(0.001, t + startOffset + 1.5);
    osc.connect(env).connect(dst);
    osc.start(t + startOffset);
    osc.stop(t + startOffset + 1.6);
  }
}

/** One-shot night chime — slow high-tone tone with long decay. */
function fireNightChime(state: MusicState): void {
  const ctx = state.ctx;
  const t = ctx.currentTime;
  const dst = state.night.gain;
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = 1046.50; // C6
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0, t);
  env.gain.linearRampToValueAtTime(0.08, t + 0.4);
  env.gain.exponentialRampToValueAtTime(0.001, t + 3.5);
  osc.connect(env).connect(dst);
  osc.start(t);
  osc.stop(t + 3.6);
}

// ─────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────

/** Idempotent. Builds all three tracks immediately (no preload needed
 *  — pure synth). Master bus fades in over ~5s so the score doesn't
 *  slam on instantly. */
export function startMusic(): void {
  if (_state) return;
  const a = getAudioInternals();
  if (!a) return;

  const bus = a.ctx.createGain();
  bus.gain.value = 0;
  bus.connect(a.ambient);
  const now = a.ctx.currentTime;
  bus.gain.setValueAtTime(0, now);
  // C2 — if the escape-pod intro is already suppressing (music started while the intro
  //   owns the scene), stay silent; else the normal fade-in. setMusicSuppressed(false)
  //   at the desert handoff ramps it up.
  if (!_musicSuppressed) bus.gain.linearRampToValueAtTime(MUSIC_BUS_TARGET, now + 5.0);

  _state = {
    ctx: a.ctx,
    bus,
    day:   buildDayTrack(a.ctx, bus),
    storm: buildStormTrack(a.ctx, bus, a.noiseBuffer),
    night: buildNightTrack(a.ctx, bus),
    startTime: now,
    driftPhase: 0,
  };
}

export function updateMusic(ctx: GameContext, dt: number): void {
  if (!_state) return;
  const s = _state;
  // C2 — while the escape-pod intro owns the scene, the bus is ducked to 0 (setMusicSuppressed).
  //   Skip the per-track crossfade + motif scheduling so we don't spin oscillators/fire motifs
  //   under a silent bus, and so nothing fights the duck. The bus ramp is owned by
  //   setMusicSuppressed; restored at the desert handoff. (No teardown → no muted-forever state.)
  if (_musicSuppressed) return;
  s.driftPhase += dt;

  // Signals (mirror soundscape.ts conventions). Storm reads perceived
  // (D79) so inside a large tent the storm track dampens; day/night
  // read sun height (world-truth).
  const storm = clamp01(ctx.weather.perceivedIntensity);
  const sy = ctx.time.sunHeight;
  const dayBase   = clamp01(sy * 1.5 + 0.1);
  const nightBase = clamp01(-sy * 1.5 + 0.1);

  // Storm dominates: as storm rises, the storm track ramps in and the
  // day/night tracks dip toward 0 to avoid muddy stacking.
  const stormW = smoothstep(0.30, 0.65, storm);
  const dayW   = dayBase   * (1 - stormW);
  const nightW = nightBase * (1 - stormW);
  setTrack(s.day,   dayW   * DAY_TARGET,   s.ctx);
  setTrack(s.storm, stormW * STORM_TARGET, s.ctx);
  setTrack(s.night, nightW * NIGHT_TARGET, s.ctx);

  // Motif scheduling. Only fire if the relevant track is meaningfully
  // audible — no point playing a day motif when the day track is at 0.
  const elapsed = s.ctx.currentTime - s.startTime;
  if (s.day.target > 0.08 && elapsed > s.day.nextMotifAt) {
    fireDayMotif(s);
    // Schedule next ~12-18s out.
    s.day.nextMotifAt = elapsed + 12 + Math.random() * 6;
  } else if (s.day.target <= 0.08) {
    // Push the schedule forward so a track ramping in doesn't immediately
    // fire a motif (graceful fade-in).
    s.day.nextMotifAt = Math.max(s.day.nextMotifAt, elapsed + 4);
  }
  if (s.night.target > 0.06 && elapsed > s.night.nextMotifAt) {
    fireNightChime(s);
    s.night.nextMotifAt = elapsed + 20 + Math.random() * 12;
  } else if (s.night.target <= 0.06) {
    s.night.nextMotifAt = Math.max(s.night.nextMotifAt, elapsed + 5);
  }
}

function setTrack(track: TrackNodes, target: number, ctx: AudioContext): void {
  if (Math.abs(track.target - target) < 0.005) return;
  track.target = target;
  rampParam(track.gain.gain, target, ctx, 1.5);  // slower crossfades than soundscape stems
}

// ─────────────────────────────────────────────────────────────
// Debug snapshot — exposed via __game.musicState()
// ─────────────────────────────────────────────────────────────

export interface MusicStateSnapshot {
  running: boolean;
  busGain: number;
  dayGain: number;
  stormGain: number;
  nightGain: number;
}

export function getMusicStateSnapshot(): MusicStateSnapshot | null {
  if (!_state) return null;
  const s = _state;
  return {
    running: true,
    busGain: s.bus.gain.value,
    dayGain: s.day.gain.gain.value,
    stormGain: s.storm.gain.gain.value,
    nightGain: s.night.gain.gain.value,
  };
}
