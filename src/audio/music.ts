// Procedural atmospheric music (Session V, rewritten).
//
// Goal: lonely sci-fi desert soundtrack — Dune-flavored. Three layers:
//   1) drone pad   — sustained sine pair (A1 + E2) for warmth, slow filter LFO
//   2) sparse plucks — A-minor-pentatonic notes, fired at randomized intervals
//                      that compress at night and during storms; long decay
//                      + sent through a feedback-delay reverb for spaciousness
//   3) storm sub   — sub-bass sine that ramps in with sandstorm intensity for
//                      tension; near-subsonic, more felt than heard
//
// All three share a single fade-in bus so the music doesn't slam on at boot.
// Reverb is a cheap 2-tap parallel-feedback-delay network with a lowpass on
// the wet — convolution would sound nicer but needs an IR asset and we're
// procedural-only.
//
// Public API matches the previous module so soundscape.ts wiring is the same:
//   startMusic()  — idempotent; builds the graph once the audio context is up
//   updateMusic(ctx) — call each frame from updateSoundscape

import type { GameContext } from '../GameContext.ts';
import { getAudioInternals } from './audio.ts';

// A minor pentatonic, three octaves. Notes get picked weighted by world state:
// upper octave dominates during the day; mid/lower at night; storm pulls down
// further and occasionally substitutes a tritone for dissonance.
const SCALE_A_MINOR_PENT = [
  // A1 octave (mostly unused — too rumbly)
  // 55.00, 65.41, 73.42, 82.41, 98.00,
  // A2 octave
  110.00, 130.81, 146.83, 164.81, 196.00,
  // A3 octave
  220.00, 261.63, 293.66, 329.63, 392.00,
  // A4 octave
  440.00, 523.25, 587.33, 659.25, 783.99,
];

interface DroneNodes {
  out: GainNode;
}

interface StormSubNodes {
  out: GainNode;
}

interface ReverbBus {
  send: GainNode;     // dry signal -> here
  // (wet output goes straight to the music bus internally)
}

interface MusicState {
  ctx: AudioContext;
  bus: GainNode;             // master music output, fades in 0→1 over ~4s
  pluckDry: GainNode;        // dry mix for plucks
  reverb: ReverbBus;
  drone: DroneNodes;
  stormSub: StormSubNodes;
  nextNoteAt: number;        // audioContext.currentTime when next note fires
}

let _state: MusicState | null = null;

const FADE_IN_S = 4.0;
const RAMP_TIME = 0.5;
const DRONE_TARGET = 0.05;
const STORM_SUB_TARGET = 0.18;

// ─────────────────────────────────────────────────────────────
// Graph builders
// ─────────────────────────────────────────────────────────────

function buildReverb(ctx: AudioContext, out: AudioNode): ReverbBus {
  // Two parallel feedback delays + a lowpass on the wet path. Cheap, dirty,
  // and good enough to put the plucks in a cavern.
  const send = ctx.createGain();
  send.gain.value = 1.0;

  const d1 = ctx.createDelay(1.0);
  d1.delayTime.value = 0.137;
  const fb1 = ctx.createGain();
  fb1.gain.value = 0.42;
  d1.connect(fb1).connect(d1);

  const d2 = ctx.createDelay(1.0);
  d2.delayTime.value = 0.211;
  const fb2 = ctx.createGain();
  fb2.gain.value = 0.38;
  d2.connect(fb2).connect(d2);

  send.connect(d1);
  send.connect(d2);

  const wetFilter = ctx.createBiquadFilter();
  wetFilter.type = 'lowpass';
  wetFilter.frequency.value = 2400;
  wetFilter.Q.value = 0.6;
  d1.connect(wetFilter);
  d2.connect(wetFilter);

  const wetGain = ctx.createGain();
  wetGain.gain.value = 0.55;
  wetFilter.connect(wetGain).connect(out);

  return { send };
}

function buildDrone(ctx: AudioContext, dst: AudioNode): DroneNodes {
  const out = ctx.createGain();
  out.gain.value = 0;     // ramps in updateMusic
  out.connect(dst);

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 650;
  filter.Q.value = 0.55;
  filter.connect(out);

  // Slow filter sweep — barely perceptible but keeps the drone from feeling
  // static. ±220 Hz around 650 base, period ~25s.
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.04;
  const lfoG = ctx.createGain();
  lfoG.gain.value = 220;
  lfo.connect(lfoG).connect(filter.frequency);
  lfo.start();

  // A1 root + E2 fifth — open, lonely interval.
  const o1 = ctx.createOscillator();
  o1.type = 'sine';
  o1.frequency.value = 55.00;
  const o1g = ctx.createGain();
  o1g.gain.value = 0.55;
  o1.connect(o1g).connect(filter);

  const o2 = ctx.createOscillator();
  o2.type = 'sine';
  o2.frequency.value = 82.41;
  const o2g = ctx.createGain();
  o2g.gain.value = 0.40;
  o2.connect(o2g).connect(filter);

  // A touch of detuning on a third voice gives the drone a slow beating.
  const o3 = ctx.createOscillator();
  o3.type = 'sine';
  o3.frequency.value = 55.00 * 1.006;
  const o3g = ctx.createGain();
  o3g.gain.value = 0.30;
  o3.connect(o3g).connect(filter);

  o1.start(); o2.start(); o3.start();
  return { out };
}

function buildStormSub(ctx: AudioContext, dst: AudioNode): StormSubNodes {
  const out = ctx.createGain();
  out.gain.value = 0;
  out.connect(dst);

  // 36 Hz — borderline subaudible but pushes air on full-range speakers and
  // headphones. Reads as "something's coming" tension during sandstorms.
  const sub = ctx.createOscillator();
  sub.type = 'sine';
  sub.frequency.value = 36;
  sub.connect(out);
  sub.start();

  // A slow tremolo so the sub isn't a perfectly steady tone.
  const trem = ctx.createOscillator();
  trem.frequency.value = 0.18;
  const tremG = ctx.createGain();
  tremG.gain.value = 0.35;
  trem.connect(tremG).connect(out.gain);
  trem.start();

  return { out };
}

// ─────────────────────────────────────────────────────────────
// Pluck synth — fired once per scheduled note
// ─────────────────────────────────────────────────────────────

function triggerPluck(
  state: MusicState,
  freq: number,
  velocity: number,
): void {
  const ctx = state.ctx;
  const t = ctx.currentTime;
  const decay = 2.6 + Math.random() * 0.8;

  const osc = ctx.createOscillator();
  osc.type = 'sine';
  // Slight upward pitch on attack adds a "plucked-string" snap.
  osc.frequency.setValueAtTime(freq * 1.008, t);
  osc.frequency.exponentialRampToValueAtTime(freq, t + 0.18);

  // Subtle harmonic — a second sine an octave up at low gain for body.
  const harm = ctx.createOscillator();
  harm.type = 'sine';
  harm.frequency.value = freq * 2;

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(freq * 7, t);
  filter.frequency.exponentialRampToValueAtTime(
    Math.max(180, freq * 1.8),
    t + 1.5,
  );
  filter.Q.value = 0.6;

  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0, t);
  env.gain.linearRampToValueAtTime(velocity, t + 0.012);   // 12ms attack
  env.gain.exponentialRampToValueAtTime(0.001, t + decay);

  // A second envelope for the harmonic so it decays faster than the fundamental.
  const harmEnv = ctx.createGain();
  harmEnv.gain.setValueAtTime(0.0, t);
  harmEnv.gain.linearRampToValueAtTime(velocity * 0.35, t + 0.012);
  harmEnv.gain.exponentialRampToValueAtTime(0.001, t + decay * 0.55);

  osc.connect(filter).connect(env);
  harm.connect(harmEnv).connect(filter);

  // Dry + reverb send
  env.connect(state.pluckDry);
  env.connect(state.reverb.send);

  osc.start(t);
  harm.start(t);
  osc.stop(t + decay + 0.1);
  harm.stop(t + decay + 0.1);
}

// ─────────────────────────────────────────────────────────────
// Note scheduling — picks a pitch + schedules the next event
// ─────────────────────────────────────────────────────────────

function scheduleNextNote(
  state: MusicState,
  day: number, night: number, storm: number,
): void {
  // Base interval shrinks with night + storm intensity.
  //   day-only:    7..14s (sparse, contemplative)
  //   full night:  4..9s
  //   full storm:  2..5s  (urgent, more notes)
  const compress = night * 0.55 + storm * 0.85;
  const base = 7 - compress * 4;
  const jitter = 7 - compress * 3;
  state.nextNoteAt = state.ctx.currentTime + Math.max(1.5, base + Math.random() * jitter);
  // Suppress unused warning — day reserved for future weighting.
  void day;
}

function tickPlucks(
  state: MusicState,
  day: number, night: number, storm: number,
): void {
  // Session V placeholder — plucks only fire during sandstorms. Calm weather
  // and night plucks were disabled pending an audio overhaul.
  if (storm < 0.15) {
    // Hold the timer ahead of "now" so a fresh storm doesn't slam a note out
    // instantly the moment it crosses the threshold.
    state.nextNoteAt = state.ctx.currentTime + 4;
    return;
  }
  if (state.ctx.currentTime < state.nextNoteAt) return;

  // Pick a note from the lower half of the scale — storm music sits low.
  const len = SCALE_A_MINOR_PENT.length;
  const r1 = Math.random(), r2 = Math.random();
  const center = (len - 1) * 0.35;          // bias toward lower octaves
  const offset = ((r1 + r2) / 2 - 0.5) * len * 0.4;
  const idx = Math.max(0, Math.min(len - 1, Math.round(center + offset)));
  let freq = SCALE_A_MINOR_PENT[idx];

  // Storm dissonance: occasional tritone substitution at higher intensities.
  if (storm > 0.35 && Math.random() < storm * 0.4) {
    freq *= 1.4142;
  }

  const velocity = 0.18 + storm * 0.22 + Math.random() * 0.10;
  triggerPluck(state, freq, velocity);
  scheduleNextNote(state, day, night, storm);
}

// ─────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────

export function startMusic(): void {
  if (_state) return;
  const a = getAudioInternals();
  if (!a) return;

  // Master music bus: starts at 0, fades to 1 over FADE_IN_S so we don't slam
  // on the moment the player clicks "begin".
  const bus = a.ctx.createGain();
  bus.gain.value = 0;
  bus.connect(a.ambient);
  const now = a.ctx.currentTime;
  bus.gain.setValueAtTime(0, now);
  bus.gain.linearRampToValueAtTime(1.0, now + FADE_IN_S);

  // Reverb path lives on the bus — feeds wet directly into bus alongside dry.
  const reverb = buildReverb(a.ctx, bus);

  // Dry pluck mix
  const pluckDry = a.ctx.createGain();
  pluckDry.gain.value = 0.7;     // slightly dry-heavy so notes don't smear
  pluckDry.connect(bus);

  const drone = buildDrone(a.ctx, bus);
  const stormSub = buildStormSub(a.ctx, bus);

  _state = {
    ctx: a.ctx,
    bus, pluckDry, reverb, drone, stormSub,
    // First note ~2s after start so it lands after fade-in begins.
    nextNoteAt: a.ctx.currentTime + 2.0,
  };
}

function rampParam(p: AudioParam, target: number, ctx: AudioContext, t = RAMP_TIME): void {
  const now = ctx.currentTime;
  p.cancelScheduledValues(now);
  p.setValueAtTime(p.value, now);
  p.linearRampToValueAtTime(target, now + t);
}

export function updateMusic(ctx: GameContext): void {
  if (!_state) return;
  const a = getAudioInternals();
  if (!a) return;

  const sy = ctx.time.sunHeight;
  const storm = ctx.weather.intensity;
  const day = Math.max(0, Math.min(1, sy * 1.5 + 0.1));
  const night = Math.max(0, Math.min(1, -sy * 1.5 + 0.1));

  // Session V placeholder — drone gated to storm-only; the day/night ambient
  // pad wasn't the right vibe and is silent until the audio overhaul.
  rampParam(_state.drone.out.gain, DRONE_TARGET * storm, a.ctx);

  // Storm sub ramps in with intensity.
  rampParam(_state.stormSub.out.gain, storm * STORM_SUB_TARGET, a.ctx);

  // Note scheduler — fires plucks on its own cadence (storm-gated inside).
  tickPlucks(_state, day, night, storm);
}
