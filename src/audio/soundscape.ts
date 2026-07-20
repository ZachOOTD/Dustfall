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
import { getPlayerWorldPos } from '../player/effectivePos.ts';   // Deep Desert cycle 7 — erg hush reads the effective player pos

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
  whistle: BiquadFilterNode;    // bandpass — the lonely moan / driven-sand shriek
  whistleGain: GainNode;
  // review 2026-07-14 — a deep low HOWL layer, only audible during a storm (the mass
  // of moving air under the body hiss). Fed by the same noise, its own low lowpass.
  howl: BiquadFilterNode;
  howlGain: GainNode;
}

// UNDERWORLD cycle 2 — the CAVE BED. Inside the generated cave the desert wind/ambience/music duck
// OUT and this fades in: a low stone-hush air tone (a lowpass tap off the same noise) + sparse
// echoing DRIPS (one-shot blips scheduled at a randomized interval, fed through a feedback DELAY for
// a cheap cave echo — not a reverb engine). Crossfades smoothly at the mouth (via the smoothed inside
// factor on ctx.caveAtmosphere). Storm-independent — you're sealed in rock.
interface CaveBed {
  hushGain: GainNode;      // the low air-tone level (× inside)
  dripBus: GainNode;       // dry drips + the delay feed
  dripDelay: DelayNode;    // echo delay line
  dripFeedback: GainNode;  // delay feedback (decaying repeats)
  nextDrip: number;        // ctx.currentTime the next drip fires
}

interface SoundscapeState {
  ctx: AudioContext;
  wind: { calm: StemNodes; mid: StemNodes; storm: StemNodes };
  ambient: { day: StemNodes; night: StemNodes };
  music: { calm: StemNodes; tense: StemNodes };
  musicBus: GainNode;
  pwind: ProceduralWind | null; // C33 — procedural wind graph
  cave: CaveBed | null;         // UNDERWORLD cycle 2 — the cave audio bed
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

// M4 (campaign 2026-07-09) — procedural ambient life beds (crickets/heat-shimmer/
// bird cries) were REMOVED per user feel-veto 2026-07-09 (the hiss + high-pitched
// tones read as unpleasant, not "audible loneliness"). The day-bed/night-bed sample
// stems below stay SILENT (as they were pre-M4: /public/audio/ is empty) — ready to
// carry real CC0 samples if they ever land, no procedural synthesis in between.

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

// Deep Desert cycle 7 — the ERG HUSH. Smoothed 0..1 erg-core factor: inside a
// dune sea the calm desert wind/ambience ducks toward a deep hush (the awe
// register) + a low sand-sigh comes up. Lerped toward the live erg mask each
// frame so the border crossfades (no pop). Storm audio is UNAFFECTED — only the
// calm bed ducks. Exposed on the snapshot for the probe.
let _ergHush = 0;

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
      s.pwind.howlGain.gain.setTargetAtTime(0, t0, 0.2);
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
  // review 2026-07-14 — deep storm HOWL: a low lowpass off the same noise.
  const howl = a.ctx.createBiquadFilter();
  howl.type = 'lowpass';
  howl.frequency.value = Tuning.STORM_WIND_HOWL_CUTOFF;
  howl.Q.value = 1.1;
  const howlGain = a.ctx.createGain();
  howlGain.gain.value = 0;
  noise.connect(body).connect(bodyGain).connect(a.ambient);
  noise.connect(whistle).connect(whistleGain).connect(a.ambient);
  noise.connect(howl).connect(howlGain).connect(a.ambient);
  noise.start(0);
  const pwind: ProceduralWind = { body, bodyGain, whistle, whistleGain, howl, howlGain };

  // UNDERWORLD cycle 2 — the CAVE BED graph. The HUSH is a very-low lowpass tap off the same wind
  // noise (a felt airless breath). The DRIPS feed a bus that goes dry to the ambient bus AND into a
  // feedback delay line (a couple of decaying repeats = a cheap cave echo). Gains start at 0 → the
  // per-frame update lifts them by the smoothed cave-inside factor.
  const caveHushFilter = a.ctx.createBiquadFilter();
  caveHushFilter.type = 'lowpass';
  caveHushFilter.frequency.value = Tuning.CAVE_BED_HUSH_CUTOFF;
  caveHushFilter.Q.value = 0.6;
  const caveHushGain = a.ctx.createGain();
  caveHushGain.gain.value = 0;
  noise.connect(caveHushFilter).connect(caveHushGain).connect(a.ambient);
  const dripBus = a.ctx.createGain();
  dripBus.gain.value = 1;
  const dripDelay = a.ctx.createDelay(1.0);
  dripDelay.delayTime.value = Tuning.CAVE_BED_DRIP_ECHO_S;
  const dripFeedback = a.ctx.createGain();
  dripFeedback.gain.value = Tuning.CAVE_BED_DRIP_ECHO_FEEDBACK;
  dripBus.connect(a.ambient);
  dripBus.connect(dripDelay);
  dripDelay.connect(dripFeedback).connect(dripDelay);   // feedback loop → decaying echo
  dripDelay.connect(a.ambient);
  const cave: CaveBed = { hushGain: caveHushGain, dripBus, dripDelay, dripFeedback, nextDrip: 0 };

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
    cave,
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
    // (M4 procedural life beds removed per user feel-veto — day/night stems stay silent.)
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
      s.pwind.howlGain.gain.setTargetAtTime(0, t0, 0.2);
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

  // UNDERWORLD cycle 2 — inside the generated cave the whole DESERT bed (wind + ambient + music)
  // ducks OUT and the cave bed rises. `caveInside` is the smoothed 0..1 containment factor from the
  // light model (ctx.caveAtmosphere), so the crossfade tracks the mouth. `caveDuck` multiplies every
  // desert layer below. null (flag off / not built) → 0 → the desert bed is untouched.
  const caveInside = clamp01(ctx.caveAtmosphere?.inside ?? 0);
  const caveDuck = 1 - caveInside * Tuning.CAVE_BED_DESERT_DUCK;

  // Deep Desert cycle 7 — the ERG HUSH. Ease the smoothed hush factor toward the
  // erg-core mask at the player, then derive: (a) a CALM duck (the base wind +
  // ambient bed goes quieter inside the dune sea — the awe register), and (b) a
  // low sand-sigh floor tone. Both are gated OFF by the storm so a sandstorm
  // overrides the hush entirely (the calm-only rule). Smooth lerp = no border pop.
  const pp = getPlayerWorldPos(ctx);
  const ergMask = ctx.biomes.ergAt(pp.x, pp.z);
  _ergHush += (ergMask - _ergHush) * Math.min(1, Tuning.ERG_HUSH_LERP_RATE * dt);
  const calmGate = 1 - smoothstep(0.1, 0.45, storm);      // 1 in calm → 0 in a real blow
  const hushDuck = 1 - _ergHush * Tuning.ERG_HUSH_DUCK * calmGate;   // multiply the CALM wind/ambience by this

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
  const tCalm  = (1 - smoothstep(0.0, 0.35, windLvl)) * WIND_MASTER * caveDuck;
  const tMid   = smoothstep(0.0, 0.35, windLvl) * (1 - smoothstep(0.45, 0.85, windLvl)) * WIND_MASTER * caveDuck;
  const tStorm = smoothstep(0.45, 0.85, windLvl) * WIND_MASTER * caveDuck;
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
    // review 2026-07-14 — GUSTING: two incommensurable LFOs surge the level; the gusts
    // dig deeper during a storm (STORM_WIND_GUST_DEPTH) so the wind heaves + snaps.
    const g1 = Math.sin(s.driftPhase * 0.7);
    const g2 = Math.sin(s.driftPhase * 1.7 + 1.1);
    const gustWave = clamp01(0.5 + 0.5 * (0.6 * g1 + 0.4 * g2));      // 0..1
    const gustDepth = 0.18 + Tuning.STORM_WIND_GUST_DEPTH * storm;
    const gust = 1 - gustDepth * (1 - gustWave);                     // dips at the troughs
    // Calm wind stays muted (WIND_BODY_MASTER=0); the STORM masters bring the roar in,
    // wired to perceivedIntensity (`storm`) so it SWELLS as the wall approaches + peaks
    // as it engulfs, then fades as it passes. This is the "hear it coming" wind.
    // Deep Desert cycle 7 — the CALM wind components (body + whistle) duck by
    // hushDuck inside an erg; the STORM components are untouched (storm overrides).
    const bodyLvl = (Tuning.WIND_BODY_MASTER * windLvl * hushDuck + Tuning.STORM_WIND_BODY_MASTER * storm) * gust * caveDuck;
    const stormRamp = smoothstep(0.12, 0.9, storm);
    // The howl carries the deep storm roar AND the erg's low sand-sigh floor tone
    // (the hush's presence — a felt low breath inside the dune sea, calm-gated).
    const sighLvl = Tuning.ERG_HUSH_SIGH_MASTER * _ergHush * calmGate;
    const howlLvl = (Tuning.STORM_WIND_HOWL_MASTER * stormRamp * gust + sighLvl) * caveDuck;
    const whistleLvl =
      (Tuning.WIND_WHISTLE_MASTER * windLvl * (0.25 + 0.75 * (1 - dayness)) * hushDuck
        + Tuning.STORM_WIND_WHISTLE_MASTER * Math.pow(storm, 1.3) * gust) * caveDuck;
    const whistleFreq = 760 + windLvl * 220 + storm * 340;
    const t0 = s.ctx.currentTime, tc = 0.3;
    s.pwind.body.frequency.setTargetAtTime(cutoff, t0, tc);
    s.pwind.bodyGain.gain.setTargetAtTime(bodyLvl, t0, tc);
    s.pwind.whistle.frequency.setTargetAtTime(whistleFreq, t0, tc);
    s.pwind.whistleGain.gain.setTargetAtTime(whistleLvl, t0, tc);
    s.pwind.howlGain.gain.setTargetAtTime(howlLvl, t0, tc);
  }

  // Ambient life — suppressed under sandstorm
  const lifeMask = (1 - smoothstep(0.15, 0.35, storm)) * hushDuck * caveDuck;   // erg hush + cave duck the ambient life bed too
  setStem(s.ambient.day,   day   * lifeMask * AMBIENT_LIFE_MASTER, s.ctx);
  setStem(s.ambient.night, night * lifeMask * AMBIENT_LIFE_MASTER, s.ctx);

  // Music — calm continuous, tense swells with storm. Deep Desert cycle 7: the
  // calm pad DUCKS inside the erg (the hush's audible "quieter/awe" shift, since
  // the wind bed is muted → the pad is the only audible ambience). Storm-gated
  // (calmGate→0 in a blow) and only the CALM pad — the tense storm swell is
  // untouched, so a sandstorm overrides the hush.
  const tenseW = smoothstep(0.30, 0.55, storm);
  const musicHush = 1 - _ergHush * Tuning.ERG_HUSH_MUSIC_DUCK * calmGate;
  setStem(s.music.calm,  (1 - tenseW) * MUSIC_CALM_TARGET * musicHush * caveDuck,  s.ctx);
  setStem(s.music.tense, tenseW * MUSIC_TENSE_TARGET * caveDuck,        s.ctx);

  // UNDERWORLD cycle 2 — drive the CAVE BED: the low hush air tone rises with caveInside, and sparse
  // drips are scheduled at a randomized interval (each fed through the feedback delay for a cave echo).
  if (s.cave) {
    const t0 = s.ctx.currentTime;
    s.cave.hushGain.gain.setTargetAtTime(Tuning.CAVE_BED_HUSH_MASTER * caveInside, t0, 0.4);
    if (caveInside > 0.15) {
      if (s.cave.nextDrip === 0) s.cave.nextDrip = t0 + Tuning.CAVE_BED_DRIP_MIN_S;
      if (t0 >= s.cave.nextDrip) {
        scheduleDrip(s.cave, s.ctx, Tuning.CAVE_BED_DRIP_MASTER * caveInside);
        s.cave.nextDrip = t0 + Tuning.CAVE_BED_DRIP_MIN_S
          + Math.random() * (Tuning.CAVE_BED_DRIP_MAX_S - Tuning.CAVE_BED_DRIP_MIN_S);
      }
    } else {
      s.cave.nextDrip = 0;   // reset so the first drip after re-entering isn't immediate
    }
  }
}

/** One water DRIP — a short pitched blip (fast attack, exponential decay) through a bandpass, into
 *  the drip bus (which feeds the feedback delay → a couple of decaying echoes). Cheap one-shots. */
function scheduleDrip(cave: CaveBed, ctx: AudioContext, level: number): void {
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  const f0 = 720 + Math.random() * 900;          // varied pitch per drip
  osc.frequency.setValueAtTime(f0, t);
  osc.frequency.exponentialRampToValueAtTime(f0 * 0.55, t + 0.09);   // a quick downward "plink"
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = f0;
  bp.Q.value = 3.0;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, level), t + 0.005);   // sharp attack
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);                     // fast decay
  osc.connect(bp).connect(g).connect(cave.dripBus);
  osc.start(t);
  osc.stop(t + 0.22);
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
  /** Deep Desert cycle 7 — smoothed erg-core hush factor (0 open desert → ~1 dune-sea core). */
  ergHush: number;
  gains: {
    windCalm: number; windMid: number; windStorm: number;
    ambientDay: number; ambientNight: number;
    musicCalm: number; musicTense: number;
    musicBus: number;
  };
  // C33 — procedural wind (the audible bed; the sample stems above are silent).
  pwind: { bodyCutoff: number; bodyGain: number; whistleFreq: number; whistleGain: number; howlGain: number } | null;
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
    ergHush: _ergHush,
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
      howlGain: s.pwind.howlGain.gain.value,
    } : null,
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
