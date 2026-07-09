// Persistent ambient + music orchestration (Session X).
//
// Sample-based stems crossfaded by world state. Three layers:
//   1) Wind         — calm / mid / storm, driven by max(weather.intensity, slow drift)
//   2) Ambient life — day bird / night insects, suppressed under sandstorm
//   3) Music        — calm pad always present; tense variant swells with storms
//
// Files preload from /public/audio/ via samples.ts. Missing stems degrade to
// silence so the build keeps running before the CC0 pack lands. SFX still
// live in audio.ts and are untouched.

import type { GameContext } from '../GameContext.ts';
import { getAudioInternals, setStormMuffle } from './audio.ts';
import { preloadSamples, getSample, type SampleId } from './samples.ts';
import { Tuning } from '../config/tuning.ts';

interface StemNodes {
  src: AudioBufferSourceNode | null;
  gain: GainNode;
  target: number;   // most recently requested gain — exposed via audioState()
}

// M5b (C33) — procedural wind. The sample-based stems below preload from
// /public/audio/, which is EMPTY (the CC0 pack never landed), so the wind/ambient/
// music all degrade to silence. This synthesizes the wind bed live (filtered looping
// noise + a moaning whistle band) so the world actually breathes, and shifts its
// TIMBRE with mood — a bright crisp day hiss, a dull lonely night moan, a resonant
// dusk threshold — driven by sun height + storm. Procedural-only (no sample files).
interface ProceduralWind {
  body: BiquadFilterNode;       // lowpass — the wind's tone (cutoff = mood)
  bodyGain: GainNode;           // level (windLvl × gusts)
  whistle: BiquadFilterNode;    // bandpass — the lonely moan
  whistleGain: GainNode;
}

interface SoundscapeState {
  ctx: AudioContext;
  wind: { calm: StemNodes; mid: StemNodes; storm: StemNodes };
  ambient: { day: StemNodes; night: StemNodes };
  music: { calm: StemNodes; tense: StemNodes };
  musicBus: GainNode;
  pwind: ProceduralWind | null; // C33 — procedural wind graph
  startTime: number;            // ctx.currentTime when startSoundscape ran
  driftPhase: number;           // monotonically increases; used for breeze sin sum
  lastUpdate: number;
}

/** A loopable noise buffer (white, lightly low-passed toward pink so it's airy, not
 *  hissy). Reused as the wind source. */
function makeWindNoiseBuffer(ctx: AudioContext, seconds = 5): AudioBuffer {
  const n = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < n; i++) {
    const white = Math.random() * 2 - 1;
    last = last * 0.86 + white * 0.14;   // one-pole low-pass → pink-ish, airy
    d[i] = last * 3.2;
  }
  return buf;
}

// ─────────────────────────────────────────────────────────────
// M4 (campaign 2026-07-09) — PROCEDURAL ambient life beds. /public/audio/ is
// empty (the CC0 pack never landed), so the day-bed/night-bed stems have been
// silent since Session X. Following the C33 procedural-wind precedent, these
// synthesize the two beds as looping buffers and attach them to the EXISTING
// ambient stems when the sample is missing — reusing the whole mixer (day/night
// crossfade, storm lifeMask, AMBIENT_LIFE_MASTER, pause/master gating, the
// audioState snapshot) unchanged. Zero-asset (D3). Tone: melancholy + SPARSE —
// long silences, a lone insect, a distant cry — "audible loneliness", not a
// nature-documentary chorus. (The procedural WIND stays muted per the user:
// WIND_BODY_MASTER/WIND_WHISTLE_MASTER are 0 in tuning.ts — untouched here.)
// Math.random is fine: audio buffers are outside the seeded worldgen stream
// (same as makeWindNoiseBuffer).
// ─────────────────────────────────────────────────────────────

/** NIGHT bed — sparse desert insects. A ~22s loop: 5-7 lone cricket chirp-trains
 *  (a few 4.1-4.6kHz pulses with a soft attack), long silences between. */
function makeNightBedBuffer(ctx: AudioContext, seconds = 22): AudioBuffer {
  const sr = ctx.sampleRate;
  const n = Math.floor(sr * seconds);
  const buf = ctx.createBuffer(1, n, sr);
  const d = buf.getChannelData(0);
  const chirps = 5 + Math.floor(Math.random() * 3);
  for (let c = 0; c < chirps; c++) {
    const at = Math.floor(Math.random() * (n - sr));            // chirp-train start
    const pulses = 3 + Math.floor(Math.random() * 4);           // pulses per train
    const f = 4100 + Math.random() * 500;                        // carrier Hz (per train)
    const pulseLen = Math.floor(sr * 0.055);
    const gap = Math.floor(sr * (0.06 + Math.random() * 0.03));
    for (let p = 0; p < pulses; p++) {
      const start = at + p * (pulseLen + gap);
      if (start + pulseLen >= n) break;
      for (let i = 0; i < pulseLen; i++) {
        const t = i / sr;
        const env = Math.sin((i / pulseLen) * Math.PI);          // soft in/out per pulse
        // AM at ~26Hz gives the stridulation texture; amplitude kept LOW (sparse, distant).
        d[start + i] += Math.sin(2 * Math.PI * f * t) * (0.5 + 0.5 * Math.sin(2 * Math.PI * 26 * t)) * env * 0.16;
      }
    }
  }
  return buf;
}

/** DAY bed — near-silence with life at the edges: a faint heat-shimmer breath
 *  (very quiet high-band noise, slow AM) + 1-2 distant lonely bird cries per
 *  ~26s loop (a thin downward glide with vibrato + a fading echo). */
function makeDayBedBuffer(ctx: AudioContext, seconds = 26): AudioBuffer {
  const sr = ctx.sampleRate;
  const n = Math.floor(sr * seconds);
  const buf = ctx.createBuffer(1, n, sr);
  const d = buf.getChannelData(0);
  // (1) heat-shimmer: band-ish noise via differenced one-pole (crude high-pass),
  //     breathing on a ~9s cycle. Peak ~0.02 — felt more than heard.
  let last = 0;
  for (let i = 0; i < n; i++) {
    const white = Math.random() * 2 - 1;
    const hp = white - last * 0.97;                              // high-tilted
    last = last * 0.97 + white * 0.03;
    const breathe = 0.5 + 0.5 * Math.sin((i / sr) * (2 * Math.PI / 9));
    d[i] += hp * 0.02 * breathe;
  }
  // (2) distant cries: 1-2 per loop, never near the loop seam.
  const cries = 1 + Math.floor(Math.random() * 2);
  for (let c = 0; c < cries; c++) {
    const at = Math.floor((0.12 + 0.7 * Math.random()) * n);
    const len = Math.floor(sr * (0.7 + Math.random() * 0.4));
    const f0 = 1350 + Math.random() * 250;                       // glide start Hz
    const f1 = f0 * 0.62;                                        // glide end (a falling cry)
    for (let e = 0; e < 3; e++) {                                // dry + two fading echoes
      const eAt = at + Math.floor(e * sr * 0.42);
      const eAmp = 0.11 * Math.pow(0.42, e);
      if (eAt + len >= n) break;
      let ph = 0;
      for (let i = 0; i < len; i++) {
        const t = i / len;
        const f = f0 + (f1 - f0) * t + Math.sin(2 * Math.PI * 5.5 * (i / sr)) * 28;   // vibrato
        ph += (2 * Math.PI * f) / sr;
        const env = Math.sin(t * Math.PI) * (1 - t * 0.35);      // swell then fade
        d[eAt + i] += Math.sin(ph) * env * eAmp;
      }
    }
  }
  return buf;
}

/** Attach a procedural looping buffer to an existing (silent) stem — the sample
 *  fallback path. The stem's gain/mixing stays exactly as-is. */
function attachProceduralBed(stem: StemNodes, buf: AudioBuffer, ctx: AudioContext): void {
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  src.connect(stem.gain);
  src.start(0, Math.random() * Math.min(buf.duration, 5));   // stagger (matches makeStem)
  stem.src = src;
}

let _state: SoundscapeState | null = null;

// Escape-pod intro (C2, 2026-07-02) — the intro's ship/space beats supply their OWN
// ambience (cockpit hum, klaxon, etc.); the normal DESERT soundscape (the procedural
// wind bed + ambient life + the sample-music bus) must go SILENT while the intro owns
// the scene — desert wind layered over an orbiting-ship view is wrong. While suppressed,
// updateSoundscape ducks the audible wind (pwind body/whistle) + the music bus to 0 and
// skips the per-frame modulation so nothing fights the duck. The graph keeps running
// (looping noise source) behind silent gains — no teardown, so clearing suppression
// resumes the live bed seamlessly (no muted-forever state, no pop). The intro's own
// desert-wind cue (startDesertWind) hands off to this real bed at the desert handoff.
let _soundscapeSuppressed = false;

/** Suppress (silence) or restore the normal desert soundscape — called by the escape-pod
 *  intro so the ship/space beats don't layer desert wind over orbit. Idempotent; the duck
 *  is applied per-frame in updateSoundscape via smooth setTargetAtTime ramps (no pop). Safe
 *  before startSoundscape (the flag is honored on the next update). */
export function setSoundscapeSuppressed(suppressed: boolean): void {
  _soundscapeSuppressed = suppressed;
  if (!_state) return;
  const s = _state;
  const t0 = s.ctx.currentTime;
  if (suppressed) {
    // Duck the audible wind bed + the (silent) music bus to 0 immediately (smooth ramp).
    if (s.pwind) {
      s.pwind.bodyGain.gain.setTargetAtTime(0, t0, 0.2);
      s.pwind.whistleGain.gain.setTargetAtTime(0, t0, 0.2);
    }
    rampParam(s.musicBus.gain, 0, s.ctx);
  } else {
    // Restore the music bus; the wind bed re-derives its live level on the next update tick.
    rampParam(s.musicBus.gain, 1.0, s.ctx);
  }
}

const MUSIC_FADE_IN_S = 4.0;
const RAMP_TIME = 0.5;

// Per-layer master gains. Tuned conservatively — calm should be quieter than
// silence-feels-rude; the v1 bar is "clearly better than the V/W silence,"
// not "loud."
const WIND_MASTER = 0.55;
const AMBIENT_LIFE_MASTER = 0.35;
const MUSIC_CALM_TARGET = 0.20;
const MUSIC_TENSE_TARGET = 0.45;

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function rampParam(p: AudioParam, target: number, ctx: AudioContext, t = RAMP_TIME): void {
  const now = ctx.currentTime;
  p.cancelScheduledValues(now);
  p.setValueAtTime(p.value, now);
  p.linearRampToValueAtTime(target, now + t);
}

// ─────────────────────────────────────────────────────────────
// Stem construction
// ─────────────────────────────────────────────────────────────

function makeStem(ctx: AudioContext, dst: AudioNode, id: SampleId): StemNodes {
  const gain = ctx.createGain();
  gain.gain.value = 0;
  gain.connect(dst);

  const buf = getSample(id);
  let src: AudioBufferSourceNode | null = null;
  if (buf) {
    src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.connect(gain);
    // Stagger start phases slightly so multiple stems aren't all aligned to t=0,
    // which can cause synchronous loop seams stacking.
    const offset = Math.random() * Math.min(buf.duration, 5);
    src.start(0, offset);
  }
  return { src, gain, target: 0 };
}

// ─────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────

/** Idempotent. Kicks off sample preload and builds the stem graph. */
export function startSoundscape(): void {
  if (_state) return;
  const a = getAudioInternals();
  if (!a) return;

  // Music bus fades in over MUSIC_FADE_IN_S so the score doesn't slam on the
  // instant the player clicks "begin".
  const musicBus = a.ctx.createGain();
  musicBus.gain.value = 0;
  musicBus.connect(a.ambient);
  const now = a.ctx.currentTime;
  musicBus.gain.setValueAtTime(0, now);
  musicBus.gain.linearRampToValueAtTime(1.0, now + MUSIC_FADE_IN_S);

  // C33 — the procedural wind graph: a looping noise source fanned into a low-pass
  // BODY (the wind's tone) + a band-pass WHISTLE (the lonely moan), each with its own
  // gain → the ambient bus. Cutoffs/levels are modulated per-frame in updateSoundscape.
  const noise = a.ctx.createBufferSource();
  noise.buffer = makeWindNoiseBuffer(a.ctx);
  noise.loop = true;
  const body = a.ctx.createBiquadFilter();
  body.type = 'lowpass';
  body.frequency.value = 1400;
  body.Q.value = 0.7;
  const bodyGain = a.ctx.createGain();
  bodyGain.gain.value = 0;
  const whistle = a.ctx.createBiquadFilter();
  whistle.type = 'bandpass';
  whistle.frequency.value = 820;
  whistle.Q.value = 4.5;
  const whistleGain = a.ctx.createGain();
  whistleGain.gain.value = 0;
  noise.connect(body).connect(bodyGain).connect(a.ambient);
  noise.connect(whistle).connect(whistleGain).connect(a.ambient);
  noise.start(0);
  const pwind: ProceduralWind = { body, bodyGain, whistle, whistleGain };

  // Build placeholder state first (silent stems) — buffers attach once decode
  // resolves below. This keeps updateSoundscape simple: it never touches null.
  const dummy = (): StemNodes => ({ src: null, gain: a.ctx.createGain(), target: 0 });
  _state = {
    ctx: a.ctx,
    wind:    { calm:  dummy(), mid:  dummy(), storm: dummy() },
    ambient: { day:   dummy(), night: dummy() },
    music:   { calm:  dummy(), tense: dummy() },
    musicBus,
    pwind,
    startTime: now,
    driftPhase: 0,
    lastUpdate: now,
  };
  // Wire the dummy gains into the right destinations so we can swap source
  // nodes in later without rewiring the graph.
  _state.wind.calm.gain.connect(a.ambient);
  _state.wind.mid.gain.connect(a.ambient);
  _state.wind.storm.gain.connect(a.ambient);
  _state.ambient.day.gain.connect(a.ambient);
  _state.ambient.night.gain.connect(a.ambient);
  _state.music.calm.gain.connect(musicBus);
  _state.music.tense.gain.connect(musicBus);

  void preloadSamples(a.ctx).then(() => {
    if (!_state) return;
    // Buffers are in. Rebuild the proper stems and splice them into the existing
    // gain destinations. Old dummy gains become unreferenced and GC away.
    _state.wind.calm  = makeStem(a.ctx, a.ambient, 'wind-calm');
    _state.wind.mid   = makeStem(a.ctx, a.ambient, 'wind-mid');
    _state.wind.storm = makeStem(a.ctx, a.ambient, 'wind-storm');
    _state.ambient.day   = makeStem(a.ctx, a.ambient, 'day-bed');
    _state.ambient.night = makeStem(a.ctx, a.ambient, 'night-bed');
    _state.music.calm  = makeStem(a.ctx, musicBus, 'music-calm');
    _state.music.tense = makeStem(a.ctx, musicBus, 'music-tense');
    // M4 — the sample pack never landed (/public/audio/ empty) so the life-bed stems
    // come back srcless → attach the PROCEDURAL beds instead. If real samples ever
    // land, they win (src non-null) and the procedural path never runs.
    if (!_state.ambient.day.src)   attachProceduralBed(_state.ambient.day,   makeDayBedBuffer(a.ctx),   a.ctx);
    if (!_state.ambient.night.src) attachProceduralBed(_state.ambient.night, makeNightBedBuffer(a.ctx), a.ctx);
  });
}

export function updateSoundscape(ctx: GameContext, dt: number): void {
  if (!_state) return;
  const s = _state;

  // C2 — while the escape-pod intro owns the scene, hold the desert bed SILENT: duck the
  //   audible procedural wind (body + whistle) toward 0 each frame + leave the sample stems
  //   at 0 (they're silent anyway), and skip the mood modulation below so nothing lifts the
  //   wind back up. The intro supplies its own ambience; setSoundscapeSuppressed(false) at
  //   the desert handoff resumes the live bed on the next tick.
  if (_soundscapeSuppressed) {
    if (s.pwind) {
      const t0 = s.ctx.currentTime;
      s.pwind.bodyGain.gain.setTargetAtTime(0, t0, 0.2);
      s.pwind.whistleGain.gain.setTargetAtTime(0, t0, 0.2);
    }
    return;
  }

  // Signals. Session ZZ — soundscape reads `perceivedIntensity` (D79),
  // so inside a large tent the wind + ambient-life suppression + tense
  // music all dampen together. The visual storm (dust + vignette,
  // wired in YY) already does the same. Fog + stats + AI stay on
  // authoritative intensity — those represent the world's state, not
  // the player's perception of it.
  const storm = clamp01(ctx.weather.perceivedIntensity);
  // ACW E (#134) — muffle the whole mix as the storm engulfs the player.
  setStormMuffle(storm);
  const sy = ctx.time.sunHeight;
  const day = clamp01(sy * 1.5 + 0.1);
  const night = clamp01(-sy * 1.5 + 0.1);

  // Slow breeze drift in 0..0.25 — gives clear weather a sense of breathing
  // without ever feeling "windy". Two incommensurable frequencies so the
  // pattern doesn't visibly cycle.
  s.driftPhase += dt;
  const drift =
    0.125 * (Math.sin(s.driftPhase * 0.05) + Math.sin(s.driftPhase * 0.013))
    + 0.125;
  const windLvl = Math.max(storm, drift);

  // Wind layer gains
  const tCalm  = (1 - smoothstep(0.0, 0.35, windLvl)) * WIND_MASTER;
  const tMid   = smoothstep(0.0, 0.35, windLvl) * (1 - smoothstep(0.45, 0.85, windLvl)) * WIND_MASTER;
  const tStorm = smoothstep(0.45, 0.85, windLvl) * WIND_MASTER;
  setStem(s.wind.calm,  tCalm,  s.ctx);
  setStem(s.wind.mid,   tMid,   s.ctx);
  setStem(s.wind.storm, tStorm, s.ctx);

  // C33 — the procedural wind bed: TIMBRE by mood (time of day), LEVEL by windLvl.
  // A bright airy day hiss → a dull lonely night moan; a storm opens it to full roar.
  // setTargetAtTime gives a smooth (zipper-free) approach every frame.
  if (s.pwind) {
    const dayness = clamp01(sy * 0.5 + 0.5);            // 0 deep night → 1 noon
    let cutoff = Tuning.WIND_CUTOFF_NIGHT + dayness * (Tuning.WIND_CUTOFF_DAY - Tuning.WIND_CUTOFF_NIGHT);
    cutoff += storm * (Tuning.WIND_CUTOFF_STORM - cutoff);            // storm opens the wind up
    const gust = 0.82 + 0.18 * (0.5 + 0.5 * Math.sin(s.driftPhase * 0.7));
    const bodyLvl = Tuning.WIND_BODY_MASTER * windLvl * gust;
    const whistleLvl = Tuning.WIND_WHISTLE_MASTER * windLvl * (0.25 + 0.75 * (1 - dayness));
    const whistleFreq = 760 + windLvl * 220;
    const t0 = s.ctx.currentTime, tc = 0.3;
    s.pwind.body.frequency.setTargetAtTime(cutoff, t0, tc);
    s.pwind.bodyGain.gain.setTargetAtTime(bodyLvl, t0, tc);
    s.pwind.whistle.frequency.setTargetAtTime(whistleFreq, t0, tc);
    s.pwind.whistleGain.gain.setTargetAtTime(whistleLvl, t0, tc);
  }

  // Ambient life — suppressed under sandstorm
  const lifeMask = 1 - smoothstep(0.15, 0.35, storm);
  setStem(s.ambient.day,   day   * lifeMask * AMBIENT_LIFE_MASTER, s.ctx);
  setStem(s.ambient.night, night * lifeMask * AMBIENT_LIFE_MASTER, s.ctx);

  // Music — calm continuous, tense swells with storm
  const tenseW = smoothstep(0.30, 0.55, storm);
  setStem(s.music.calm,  (1 - tenseW) * MUSIC_CALM_TARGET,  s.ctx);
  setStem(s.music.tense, tenseW * MUSIC_TENSE_TARGET,        s.ctx);
}

function setStem(stem: StemNodes, target: number, ctx: AudioContext): void {
  if (Math.abs(stem.target - target) < 0.001) return;
  stem.target = target;
  rampParam(stem.gain.gain, target, ctx);
}

// ─────────────────────────────────────────────────────────────
// Debug helper — surfaced via __game.audioState()
// ─────────────────────────────────────────────────────────────

export interface AudioStateSnapshot {
  running: boolean;
  windLevel: number;
  day: number;
  night: number;
  storm: number;
  gains: {
    windCalm: number; windMid: number; windStorm: number;
    ambientDay: number; ambientNight: number;
    musicCalm: number; musicTense: number;
    musicBus: number;
  };
  // C33 — procedural wind (the audible bed; the sample stems above are silent).
  pwind: { bodyCutoff: number; bodyGain: number; whistleFreq: number; whistleGain: number } | null;
  // M4 — whether the ambient life-bed stems have a live SOURCE attached (procedural
  // fallback or a real sample). false = that bed is structurally silent.
  bedSrc: { day: boolean; night: boolean };
  // M4 — the mixer's requested per-stem targets (gain.value lags by the ramp; targets
  // assert the mixing logic instantly in headless probes).
  bedTargets: { day: number; night: number };
  loaded: Record<SampleId, boolean>;
}

export function getAudioStateSnapshot(ctx: GameContext): AudioStateSnapshot | null {
  if (!_state) return null;
  const s = _state;
  // ZZ — match the live tick path: snapshot reflects what the player
  // is actually hearing (perceived), not world-truth intensity.
  const storm = clamp01(ctx.weather.perceivedIntensity);
  const sy = ctx.time.sunHeight;
  const day = clamp01(sy * 1.5 + 0.1);
  const night = clamp01(-sy * 1.5 + 0.1);
  const drift =
    0.125 * (Math.sin(s.driftPhase * 0.05) + Math.sin(s.driftPhase * 0.013))
    + 0.125;
  return {
    running: true,
    windLevel: Math.max(storm, drift),
    day, night, storm,
    gains: {
      windCalm:    s.wind.calm.gain.gain.value,
      windMid:     s.wind.mid.gain.gain.value,
      windStorm:   s.wind.storm.gain.gain.value,
      ambientDay:  s.ambient.day.gain.gain.value,
      ambientNight: s.ambient.night.gain.gain.value,
      musicCalm:   s.music.calm.gain.gain.value,
      musicTense:  s.music.tense.gain.gain.value,
      musicBus:    s.musicBus.gain.value,
    },
    pwind: s.pwind ? {
      bodyCutoff: s.pwind.body.frequency.value,
      bodyGain: s.pwind.bodyGain.gain.value,
      whistleFreq: s.pwind.whistle.frequency.value,
      whistleGain: s.pwind.whistleGain.gain.value,
    } : null,
    bedSrc: { day: s.ambient.day.src !== null, night: s.ambient.night.src !== null },
    bedTargets: { day: s.ambient.day.target, night: s.ambient.night.target },
    loaded: {
      'wind-calm':   getSample('wind-calm')   !== null,
      'wind-mid':    getSample('wind-mid')    !== null,
      'wind-storm':  getSample('wind-storm')  !== null,
      'day-bed':     getSample('day-bed')     !== null,
      'night-bed':   getSample('night-bed')   !== null,
      'music-calm':  getSample('music-calm')  !== null,
      'music-tense': getSample('music-tense') !== null,
    },
  };
}
