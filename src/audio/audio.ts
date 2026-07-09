// Tiny procedural Web Audio system. No sample files — everything is
// synthesized at play time from oscillators + filtered noise.
//
// Browsers require a user gesture to start audio. We expose
// `ensureAudioStarted()` from the "click to begin" overlay handler.

import { Tuning } from '../config/tuning.ts'; // ACL WORM-ROAR-ATTENUATION integration
import { loadSettings } from '../core/settings.ts';   // master volume persisted setting

let _ctx: AudioContext | null = null;
let _master: GainNode | null = null;
let _sfx: GainNode | null = null;
let _ambient: GainNode | null = null;
let _noiseBuffer: AudioBuffer | null = null;
// ACW E (#134) — master storm low-pass. Sits between _master and the
// destination; its cutoff ramps down during a storm so the whole mix muffles
// (sand-deadened hearing), opening back to ~20kHz (transparent) when clear.
let _stormLP: BiquadFilterNode | null = null;
const _STORM_LP_OPEN_HZ = 20000;

export interface AudioInternals {
  ctx: AudioContext;
  ambient: GainNode;
  sfx: GainNode;
  noiseBuffer: AudioBuffer;
}

/** Returns internals only once the audio has been started by user gesture. */
export function getAudioInternals(): AudioInternals | null {
  if (!_ctx || !_ambient || !_sfx || !_noiseBuffer) return null;
  return { ctx: _ctx, ambient: _ambient, sfx: _sfx, noiseBuffer: _noiseBuffer };
}

/** ACBE (D1) — the crashing-wreck IMPACT: a dull, distant SONIC BOOM (filtered brown
 *  noise, slow attack), a deep sub-bass IMPACT rumble, and a leading low crack. Distance-
 *  attenuated AND low-passed harder the farther it is (far crashes read as a soft, rolling
 *  boom). Call when the SOUND arrives — the caller delays it by dist / speed-of-sound. */
export function playCrashImpact(distance: number): void {
  const a = getAudioInternals();
  if (!a) return;
  const t = a.ctx.currentTime;
  const NEAR = 120, FAR = 500, CUT = 950;
  if (distance >= CUT) return;
  let vol: number;
  if (distance <= NEAR) vol = 1;
  else if (distance >= FAR) vol = Math.max(0, 0.28 * (CUT - distance) / (CUT - FAR));
  else vol = 1 - (1 - 0.28) * ((distance - NEAR) / (FAR - NEAR));
  const farFrac = Math.min(1, distance / FAR);
  const cutoff = 2400 - farFrac * 1700;   // 2400Hz near → 700Hz far (duller with distance)

  // 1. BOOM — slow brown-noise burst through a distance-dulled lowpass.
  const src = a.ctx.createBufferSource();
  src.buffer = a.noiseBuffer;
  src.playbackRate.value = 0.35;          // slow playback → browner, heavier noise
  const lp = a.ctx.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.setValueAtTime(cutoff, t); lp.Q.value = 0.7;
  const bEnv = a.ctx.createGain();
  bEnv.gain.setValueAtTime(0, t);
  bEnv.gain.linearRampToValueAtTime(0.5 * vol, t + 0.03 + farFrac * 0.06);  // softer attack when far
  bEnv.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
  src.connect(lp).connect(bEnv).connect(a.sfx);
  src.start(t); src.stop(t + 0.75);

  // 2. SUB-BASS RUMBLE — 70→38Hz sine, slow swell + long tail.
  const sub = a.ctx.createOscillator();
  sub.type = 'sine';
  sub.frequency.setValueAtTime(70, t);
  sub.frequency.exponentialRampToValueAtTime(38, t + 1.2);
  const sEnv = a.ctx.createGain();
  sEnv.gain.setValueAtTime(0, t);
  sEnv.gain.linearRampToValueAtTime(0.22 * vol, t + 0.06);
  sEnv.gain.exponentialRampToValueAtTime(0.001, t + 1.9);
  sub.connect(sEnv).connect(a.sfx);
  sub.start(t); sub.stop(t + 1.95);

  // 3. Leading low CRACK transient (only reads near; gone far).
  const thud = a.ctx.createOscillator();
  thud.type = 'triangle';
  thud.frequency.setValueAtTime(130, t);
  thud.frequency.exponentialRampToValueAtTime(48, t + 0.18);
  const tEnv = a.ctx.createGain();
  tEnv.gain.setValueAtTime(0, t);
  tEnv.gain.linearRampToValueAtTime(0.16 * vol * (1 - farFrac * 0.7), t + 0.005);
  tEnv.gain.exponentialRampToValueAtTime(0.001, t + 0.26);
  thud.connect(tEnv).connect(a.sfx);
  thud.start(t); thud.stop(t + 0.3);
}

// ── Escape-pod intro SFX (Phase 5 T5.1) — procedural one-shots wired to the intro beats
//    (sequence.ts). Web Audio synthesis, no samples — the game's idiom. The intro starts the
//    audio context (ensureAudioStarted, on the new-game click) so these fire. Sustained ambient
//    loops (cockpit hum, wind) + music are a follow-up (T5.1b/T5.2).

/** Eject — a heavy pneumatic THUNK + a launch whoosh as the pod fires clear. */
export function playEjectThunk(): void {
  const a = getAudioInternals();
  if (!a) return;
  const t = a.ctx.currentTime;
  const thud = a.ctx.createOscillator();
  thud.type = 'triangle';
  thud.frequency.setValueAtTime(180, t);
  thud.frequency.exponentialRampToValueAtTime(44, t + 0.14);
  const te = a.ctx.createGain();
  te.gain.setValueAtTime(0.0001, t);
  te.gain.exponentialRampToValueAtTime(0.5, t + 0.006);
  te.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
  thud.connect(te).connect(a.sfx);
  thud.start(t); thud.stop(t + 0.32);
  const src = a.ctx.createBufferSource();
  src.buffer = a.noiseBuffer; src.playbackRate.value = 0.8;
  const bp = a.ctx.createBiquadFilter();
  bp.type = 'bandpass'; bp.frequency.setValueAtTime(300, t);
  bp.frequency.exponentialRampToValueAtTime(1400, t + 0.5); bp.Q.value = 0.8;
  const we = a.ctx.createGain();
  we.gain.setValueAtTime(0.0001, t);
  we.gain.linearRampToValueAtTime(0.32, t + 0.08);
  we.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
  src.connect(bp).connect(we).connect(a.sfx);
  src.start(t); src.stop(t + 0.65);
}

/** Ship explosion — a big concussive boom (noise burst + deep sub + a bright crack). */
export function playExplosionBoom(): void {
  const a = getAudioInternals();
  if (!a) return;
  const t = a.ctx.currentTime;
  const src = a.ctx.createBufferSource();
  src.buffer = a.noiseBuffer; src.playbackRate.value = 0.5;
  const lp = a.ctx.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.setValueAtTime(1800, t);
  lp.frequency.exponentialRampToValueAtTime(300, t + 0.6); lp.Q.value = 0.6;
  const be = a.ctx.createGain();
  be.gain.setValueAtTime(0.0001, t);
  be.gain.exponentialRampToValueAtTime(0.6, t + 0.02);
  be.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
  src.connect(lp).connect(be).connect(a.sfx);
  src.start(t); src.stop(t + 0.95);
  const sub = a.ctx.createOscillator();
  sub.type = 'sine';
  sub.frequency.setValueAtTime(64, t);
  sub.frequency.exponentialRampToValueAtTime(32, t + 1.4);
  const se = a.ctx.createGain();
  se.gain.setValueAtTime(0.0001, t);
  se.gain.exponentialRampToValueAtTime(0.32, t + 0.05);
  se.gain.exponentialRampToValueAtTime(0.001, t + 2.0);
  sub.connect(se).connect(a.sfx);
  sub.start(t); sub.stop(t + 2.05);
  const cr = a.ctx.createOscillator();
  cr.type = 'square';
  cr.frequency.setValueAtTime(420, t);
  cr.frequency.exponentialRampToValueAtTime(120, t + 0.12);
  const ce = a.ctx.createGain();
  ce.gain.setValueAtTime(0.0001, t);
  ce.gain.exponentialRampToValueAtTime(0.18, t + 0.004);
  ce.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
  cr.connect(ce).connect(a.sfx);
  cr.start(t); cr.stop(t + 0.2);
}

/** Klaxon — a 3-pulse two-tone alarm (the disaster). */
export function playKlaxon(): void {
  const a = getAudioInternals();
  if (!a) return;
  const t0 = a.ctx.currentTime;
  for (let i = 0; i < 3; i++) {
    const t = t0 + i * 0.42;
    const o = a.ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(620, t);
    o.frequency.setValueAtTime(440, t + 0.18);
    const lp = a.ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 1400; lp.Q.value = 1.0;
    const e = a.ctx.createGain();
    e.gain.setValueAtTime(0.0001, t);
    e.gain.linearRampToValueAtTime(0.2, t + 0.02);
    e.gain.setValueAtTime(0.2, t + 0.32);
    e.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    o.connect(lp).connect(e).connect(a.sfx);
    o.start(t); o.stop(t + 0.42);
  }
}

/** Hull groan — a low metallic stress groan (the dying ship). */
export function playHullGroan(): void {
  const a = getAudioInternals();
  if (!a) return;
  const t = a.ctx.currentTime;
  const o = a.ctx.createOscillator();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(70, t);
  o.frequency.linearRampToValueAtTime(54, t + 1.4);
  const bp = a.ctx.createBiquadFilter();
  bp.type = 'bandpass'; bp.frequency.value = 160; bp.Q.value = 3.0;
  const e = a.ctx.createGain();
  e.gain.setValueAtTime(0.0001, t);
  e.gain.linearRampToValueAtTime(0.16, t + 0.3);
  e.gain.linearRampToValueAtTime(0.11, t + 1.0);
  e.gain.exponentialRampToValueAtTime(0.001, t + 1.8);
  o.connect(bp).connect(e).connect(a.sfx);
  o.start(t); o.stop(t + 1.85);
}

/** Re-entry rumble — a swelling roar as the pod punches into the atmosphere, then passes. */
export function playReentryRumble(): void {
  const a = getAudioInternals();
  if (!a) return;
  const t = a.ctx.currentTime;
  const src = a.ctx.createBufferSource();
  src.buffer = a.noiseBuffer; src.playbackRate.value = 0.6; src.loop = true;
  const lp = a.ctx.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.setValueAtTime(280, t);
  lp.frequency.linearRampToValueAtTime(900, t + 1.5);
  lp.frequency.linearRampToValueAtTime(300, t + 4.0); lp.Q.value = 0.8;
  const e = a.ctx.createGain();
  e.gain.setValueAtTime(0.0001, t);
  e.gain.linearRampToValueAtTime(0.32, t + 1.2);
  e.gain.setValueAtTime(0.32, t + 2.2);
  e.gain.exponentialRampToValueAtTime(0.001, t + 4.5);
  src.connect(lp).connect(e).connect(a.sfx);
  src.start(t); src.stop(t + 4.6);
}

/** Parachute lever YANK — a stiff mechanical click-clunk. */
export function playLeverClick(): void {
  const a = getAudioInternals();
  if (!a) return;
  const t = a.ctx.currentTime;
  const o = a.ctx.createOscillator();
  o.type = 'square';
  o.frequency.setValueAtTime(220, t);
  o.frequency.exponentialRampToValueAtTime(90, t + 0.05);
  const e = a.ctx.createGain();
  e.gain.setValueAtTime(0.0001, t);
  e.gain.exponentialRampToValueAtTime(0.24, t + 0.003);
  e.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
  o.connect(e).connect(a.sfx);
  o.start(t); o.stop(t + 0.1);
}

/** Lever SNAP — the parachute lever breaks off (a sharp metal snap). */
export function playLeverSnap(): void {
  const a = getAudioInternals();
  if (!a) return;
  const t = a.ctx.currentTime;
  const o = a.ctx.createOscillator();
  o.type = 'square';
  o.frequency.setValueAtTime(900, t);
  o.frequency.exponentialRampToValueAtTime(180, t + 0.08);
  const e = a.ctx.createGain();
  e.gain.setValueAtTime(0.0001, t);
  e.gain.exponentialRampToValueAtTime(0.3, t + 0.002);
  e.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
  o.connect(e).connect(a.sfx);
  o.start(t); o.stop(t + 0.18);
}

/** Hatch BLOW — the wake hatch kicks off (a metal bang + debris scatter). */
export function playDoorBlow(): void {
  const a = getAudioInternals();
  if (!a) return;
  const t = a.ctx.currentTime;
  const o = a.ctx.createOscillator();
  o.type = 'triangle';
  o.frequency.setValueAtTime(300, t);
  o.frequency.exponentialRampToValueAtTime(70, t + 0.2);
  const e = a.ctx.createGain();
  e.gain.setValueAtTime(0.0001, t);
  e.gain.exponentialRampToValueAtTime(0.4, t + 0.004);
  e.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
  o.connect(e).connect(a.sfx);
  o.start(t); o.stop(t + 0.42);
  const src = a.ctx.createBufferSource();
  src.buffer = a.noiseBuffer; src.playbackRate.value = 1.1;
  const bp = a.ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1600; bp.Q.value = 0.7;
  const ne = a.ctx.createGain();
  ne.gain.setValueAtTime(0.0001, t);
  ne.gain.linearRampToValueAtTime(0.2, t + 0.01);
  ne.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
  src.connect(bp).connect(ne).connect(a.sfx);
  src.start(t); src.stop(t + 0.4);
}

/** Chute POP (T4.3) — the comic parachute FWOOMP as the failed chute finally deploys, uselessly,
 *  on the ground. A soft airy WHOOSH (band-passed noise swelling as the canopy inflates) + a low
 *  springy BOING that wobbles up then settles (the "sproing" of the spring-loaded chute mortar).
 *  Deliberately a bit goofy — it's the comedy button on the whole opening. */
export function playChutePop(): void {
  const a = getAudioInternals();
  if (!a) return;
  const t = a.ctx.currentTime;
  // 1. the airy canopy WHOOSH — band-passed noise that swells (fabric filling) then trails off.
  const src = a.ctx.createBufferSource();
  src.buffer = a.noiseBuffer; src.playbackRate.value = 0.85;
  const bp = a.ctx.createBiquadFilter();
  bp.type = 'bandpass'; bp.Q.value = 0.6;
  bp.frequency.setValueAtTime(500, t);
  bp.frequency.linearRampToValueAtTime(1400, t + 0.18);   // the canopy fills — brightens
  bp.frequency.exponentialRampToValueAtTime(400, t + 0.9); // then the flap settles
  const ne = a.ctx.createGain();
  ne.gain.setValueAtTime(0.0001, t);
  ne.gain.linearRampToValueAtTime(0.26, t + 0.09);         // fast swell (the pop)
  ne.gain.exponentialRampToValueAtTime(0.001, t + 0.95);   // airy trail
  src.connect(bp).connect(ne).connect(a.sfx);
  src.start(t); src.stop(t + 1.0);
  // 2. the springy BOING — a mortar "sproing": a wobbling sine that jumps up, overshoots, settles.
  const o = a.ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(90, t);
  o.frequency.exponentialRampToValueAtTime(230, t + 0.06);   // the spring launches
  o.frequency.exponentialRampToValueAtTime(150, t + 0.16);   // overshoot back down
  o.frequency.exponentialRampToValueAtTime(180, t + 0.28);   // wobble up (the comic sproing)
  o.frequency.exponentialRampToValueAtTime(120, t + 0.5);    // settle
  const oe = a.ctx.createGain();
  oe.gain.setValueAtTime(0.0001, t);
  oe.gain.exponentialRampToValueAtTime(0.3, t + 0.02);
  oe.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
  o.connect(oe).connect(a.sfx);
  o.start(t); o.stop(t + 0.62);
}

/** Explosive-BOLT release (T5.3 gap-fill) — the sharp pyrotechnic SHEAR as the docked pod tears
 *  from its bay cradle (R5c physical detach), layered BEFORE the pneumatic playEjectThunk. A
 *  hard metallic CRACK (highpassed noise burst — the bolts firing) + a brief screech of tearing
 *  metal (a resonant bandpass swept down as the cradle rips). Distinct from the low eject thunk:
 *  this is bright + violent (the bolts blow), the thunk is the launch heave under it. */
export function playBoltShear(): void {
  const a = getAudioInternals();
  if (!a) return;
  const t = a.ctx.currentTime;
  // 1. the BOLT CRACK — a sharp bright transient (highpassed noise), the pyros firing.
  const crack = a.ctx.createBufferSource();
  crack.buffer = a.noiseBuffer; crack.playbackRate.value = 1.5;
  const hp = a.ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2200;
  const ce = a.ctx.createGain();
  ce.gain.setValueAtTime(0.0001, t);
  ce.gain.exponentialRampToValueAtTime(0.34, t + 0.003);
  ce.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
  crack.connect(hp).connect(ce).connect(a.sfx);
  crack.start(t); crack.stop(t + 0.13);
  // 2. the tearing-METAL SCREECH — a resonant bandpass on noise, swept DOWN as the cradle rips.
  const tear = a.ctx.createBufferSource();
  tear.buffer = a.noiseBuffer; tear.playbackRate.value = 1.0;
  const bp = a.ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 6;
  bp.frequency.setValueAtTime(2000, t);
  bp.frequency.exponentialRampToValueAtTime(600, t + 0.3);   // the shear rips downward
  const te = a.ctx.createGain();
  te.gain.setValueAtTime(0.0001, t);
  te.gain.linearRampToValueAtTime(0.20, t + 0.02);
  te.gain.exponentialRampToValueAtTime(0.001, t + 0.34);
  tear.connect(bp).connect(te).connect(a.sfx);
  tear.start(t); tear.stop(t + 0.36);
}

/** Hatch pressure SEAL (T5.3 gap-fill) — the hiss + pressurisation as the escape-pod hatch seals
 *  behind the player (enterPod 'seal' phase), layered UNDER the metallic playDoorBlow clunk. A
 *  band-passed noise HISS that fades in then chokes off (the seal closing + the air equalising) +
 *  a soft low pressurise THUMP tail (the cabin going airtight). The clunk is the door; this is the
 *  air. */
export function playHatchSeal(): void {
  const a = getAudioInternals();
  if (!a) return;
  const t = a.ctx.currentTime;
  // pressure HISS — band-passed noise swelling then choking as the seal bites.
  const src = a.ctx.createBufferSource();
  src.buffer = a.noiseBuffer; src.playbackRate.value = 1.2;
  const bp = a.ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.4;
  bp.frequency.setValueAtTime(1600, t);
  bp.frequency.exponentialRampToValueAtTime(700, t + 0.5);   // the hiss darkens as it seals
  const he = a.ctx.createGain();
  he.gain.setValueAtTime(0.0001, t);
  he.gain.linearRampToValueAtTime(0.16, t + 0.08);
  he.gain.setValueAtTime(0.14, t + 0.30);
  he.gain.exponentialRampToValueAtTime(0.001, t + 0.6);      // chokes off (airtight)
  src.connect(bp).connect(he).connect(a.sfx);
  src.start(t); src.stop(t + 0.62);
  // pressurise THUMP — a soft low body as the cabin goes airtight (the ears-pop).
  const o = a.ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(150, t + 0.34);
  o.frequency.exponentialRampToValueAtTime(70, t + 0.5);
  const oe = a.ctx.createGain();
  oe.gain.setValueAtTime(0.0001, t + 0.34);
  oe.gain.exponentialRampToValueAtTime(0.12, t + 0.37);
  oe.gain.exponentialRampToValueAtTime(0.001, t + 0.56);
  o.connect(oe).connect(a.sfx);
  o.start(t + 0.34); o.stop(t + 0.58);
}

/** Ship-death ROAR + tail (T5.3 gap-fill) — the sustained SPECTACLE layer under the ship
 *  explosion (shipExplode 'blast' phase), started at the detonation to run beneath the
 *  playExplosionBoom one-shots for the ~2.3s the fireball/breakup unfolds. A deep rolling roar
 *  (very-slow lowpassed noise, swelling then decaying over ~3.6s) + a groaning sub that bends
 *  down (the hull tearing itself apart) + a metallic debris-GROAN tail (a detuned sawtooth pair
 *  through a resonant bandpass, sweeping down late — the husk buckling as it recedes). One long
 *  self-terminating voice (no loop registry — it has a finite life; ~3.6s), so it can't leak. */
export function playShipDeathRoar(): void {
  const a = getAudioInternals();
  if (!a) return;
  const t = a.ctx.currentTime;
  // 1. the rolling ROAR — heavy lowpassed noise, a big slow swell then a long decay.
  const roar = a.ctx.createBufferSource();
  roar.buffer = a.noiseBuffer; roar.playbackRate.value = 0.28;
  const rlp = a.ctx.createBiquadFilter(); rlp.type = 'lowpass';
  rlp.frequency.setValueAtTime(500, t);
  rlp.frequency.exponentialRampToValueAtTime(140, t + 3.4); rlp.Q.value = 0.7;
  const re = a.ctx.createGain();
  re.gain.setValueAtTime(0.0001, t);
  re.gain.linearRampToValueAtTime(0.34, t + 0.35);   // the blast wave swells
  re.gain.setValueAtTime(0.30, t + 1.2);
  re.gain.exponentialRampToValueAtTime(0.001, t + 3.5);
  roar.connect(rlp).connect(re).connect(a.sfx);
  roar.start(t); roar.stop(t + 3.6);
  // 2. the tearing SUB — a low sine bending down (the hull rupturing under the fireball).
  const sub = a.ctx.createOscillator();
  sub.type = 'sine';
  sub.frequency.setValueAtTime(58, t);
  sub.frequency.exponentialRampToValueAtTime(26, t + 2.4);
  const se = a.ctx.createGain();
  se.gain.setValueAtTime(0.0001, t + 0.08);
  se.gain.exponentialRampToValueAtTime(0.26, t + 0.3);
  se.gain.exponentialRampToValueAtTime(0.001, t + 2.6);
  sub.connect(se).connect(a.sfx);
  sub.start(t + 0.08); sub.stop(t + 2.65);
  // 3. the metallic debris-GROAN tail — a detuned saw pair through a resonant bandpass swept down
  //    late in the beat (the burning husk buckling + debris shearing as it recedes).
  const gt = t + 1.1;   // the groan enters mid-explosion (the breakup phase)
  const bp = a.ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 3.5;
  bp.frequency.setValueAtTime(240, gt);
  bp.frequency.exponentialRampToValueAtTime(90, gt + 2.2);
  const ge = a.ctx.createGain();
  ge.gain.setValueAtTime(0.0001, gt);
  ge.gain.linearRampToValueAtTime(0.14, gt + 0.4);
  ge.gain.exponentialRampToValueAtTime(0.001, gt + 2.3);
  ge.connect(bp).connect(a.sfx);   // NOTE: bp → sfx; the saws feed ge
  for (const f of [82, 84.5]) {
    const o = a.ctx.createOscillator();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(f, gt);
    o.frequency.linearRampToValueAtTime(f * 0.7, gt + 2.2);   // groans downward as it dies
    o.connect(ge);
    o.start(gt); o.stop(gt + 2.35);
  }
}

/** Vista / awe SWELL (T5.3 gap-fill) — the low, wide awe-drone for the desert step-out reveal
 *  (the horizon-hook moment, layered UNDER startMusicDesert). A slowly-swelling open-fifth drone
 *  (a warm sine cluster) through a filter that opens as it swells + a very long release, so it
 *  reads as a held breath of awe as the vista opens — NOT a fanfare. Self-terminating (~9s life,
 *  not in the loop registry), routed to the ambient bus so it sits UNDER the mix. */
export function playAweSwell(): void {
  const a = getAudioInternals();
  if (!a) return;
  const t = a.ctx.currentTime;
  const lp = a.ctx.createBiquadFilter();
  lp.type = 'lowpass'; lp.Q.value = 0.6;
  lp.frequency.setValueAtTime(300, t);
  lp.frequency.linearRampToValueAtTime(900, t + 4.0);   // opens as the vista opens
  const bus = a.ctx.createGain();
  bus.gain.setValueAtTime(0.0001, t);
  bus.gain.linearRampToValueAtTime(0.10, t + 3.5);      // a slow, held swell
  bus.gain.setValueAtTime(0.10, t + 5.0);
  bus.gain.exponentialRampToValueAtTime(0.0008, t + 9.0);   // a long, awed release
  lp.connect(bus).connect(a.ambient);
  // A low open-fifth drone (C2 / G2 / C3) — spacious + hollow, the scale of the horizon.
  for (const f of [65.41, 98.0, 130.81]) {
    const o = a.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = f;
    o.detune.value = (Math.random() * 2 - 1) * 4;   // a hair of chorus for width
    const g = a.ctx.createGain(); g.gain.value = 0.5;
    o.connect(g).connect(lp);
    o.start(t); o.stop(t + 9.3);
  }
}

// ── Looping ambient beds (Phase 5 T5.1b) — sustained intro loops with explicit start/stop
//    lifecycle (C16 lesson: stop on beat exit so nothing dangles). Keyed by name; idempotent
//    start, safe fade-out stop, stopAllIntroLoops() on intro teardown. They feed a.ambient.
interface LoopVoice { nodes: AudioScheduledSourceNode[]; gain: GainNode; }
const _introLoops = new Map<string, LoopVoice>();

function _stopLoop(name: string, fade = 0.4): void {
  const v = _introLoops.get(name);
  if (!v) return;
  _introLoops.delete(name);
  const a = getAudioInternals();
  if (!a) return;
  const now = a.ctx.currentTime;
  try {
    v.gain.gain.cancelScheduledValues(now);
    v.gain.gain.setValueAtTime(Math.max(0.0001, v.gain.gain.value), now);
    v.gain.gain.exponentialRampToValueAtTime(0.0001, now + fade);
  } catch { /* ctx torn down */ }
  for (const n of v.nodes) { try { n.stop(now + fade + 0.05); } catch { /* already stopped */ } }
  // the stopped sources auto-disconnect; the now-unreferenced gain GCs.
}

/** Stop every intro ambient loop (called on intro teardown — any exit path). */
export function stopAllIntroLoops(): void {
  for (const name of Array.from(_introLoops.keys())) _stopLoop(name, 0.25);
}

/** Cockpit hum — the calm low ambient bed aboard the ship in orbit (Beat 0): a steady detuned
 *  drone + a soft air-handling noise bed + a faint electronics tone. Loops until stopped at
 *  eject. Idempotent. */
export function startCockpitHum(): void {
  const a = getAudioInternals();
  if (!a || _introLoops.has('cockpitHum')) return;
  const t = a.ctx.currentTime;
  const gain = a.ctx.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.16, t + 1.2);   // fade in
  gain.connect(a.ambient);
  const nodes: AudioScheduledSourceNode[] = [];
  for (const f of [58, 58.4]) {   // two slightly detuned saws → a thick steady hum
    const o = a.ctx.createOscillator();
    o.type = 'sawtooth'; o.frequency.value = f;
    const lp = a.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 220; lp.Q.value = 0.6;
    const og = a.ctx.createGain(); og.gain.value = 0.5;
    o.connect(lp).connect(og).connect(gain);
    o.start(t); nodes.push(o);
  }
  const src = a.ctx.createBufferSource();   // air-handling noise bed
  src.buffer = a.noiseBuffer; src.loop = true; src.playbackRate.value = 0.4;
  const nlp = a.ctx.createBiquadFilter(); nlp.type = 'bandpass'; nlp.frequency.value = 340; nlp.Q.value = 0.5;
  const ng = a.ctx.createGain(); ng.gain.value = 0.25;
  src.connect(nlp).connect(ng).connect(gain);
  src.start(t); nodes.push(src);
  const el = a.ctx.createOscillator();   // a faint high electronics tone
  el.type = 'sine'; el.frequency.value = 1180;
  const eg = a.ctx.createGain(); eg.gain.value = 0.015;
  el.connect(eg).connect(gain);
  el.start(t); nodes.push(el);
  _introLoops.set('cockpitHum', { nodes, gain });
}
export function stopCockpitHum(): void { _stopLoop('cockpitHum', 0.5); }

/** Descent rush — the sustained wind/air-rush of the pod falling through the atmosphere (the
 *  descent beat); filtered looping noise that swells as you fall faster. Stopped at impact. */
export function startDescentRush(): void {
  const a = getAudioInternals();
  if (!a || _introLoops.has('descentRush')) return;
  const t = a.ctx.currentTime;
  const gain = a.ctx.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.linearRampToValueAtTime(0.22, t + 3.0);   // swell as the fall accelerates
  gain.connect(a.ambient);
  const src = a.ctx.createBufferSource();
  src.buffer = a.noiseBuffer; src.loop = true; src.playbackRate.value = 0.7;
  const lp = a.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520; lp.Q.value = 0.7;
  src.connect(lp).connect(gain);
  src.start(t);
  _introLoops.set('descentRush', { nodes: [src], gain });
}
export function stopDescentRush(): void { _stopLoop('descentRush', 0.6); }

/** Engine FIRE roar (T5.3 gap-fill) — the sustained crackling blaze at the corridor dead-end
 *  once the engine bay erupts (setEngineFire). A low roaring bed (lowpassed looping noise) + a
 *  brighter band-passed crackle layer flickering via a fast tremolo LFO on its own gain, so it
 *  reads as an out-of-control fire, not flat noise. Feeds the ambient bus (a bed under the klaxon
 *  + hull-groan one-shots). Loops until stopped on eject (stopEngineFire) / any intro teardown.
 *  Idempotent. */
export function startEngineFire(): void {
  const a = getAudioInternals();
  if (!a || _introLoops.has('engineFire')) return;
  const t = a.ctx.currentTime;
  const gain = a.ctx.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.linearRampToValueAtTime(0.20, t + 0.5);   // the blaze catches fast
  gain.connect(a.ambient);
  const nodes: AudioScheduledSourceNode[] = [];
  // ROAR bed — slow, heavy lowpassed noise (the body of the fire).
  const roar = a.ctx.createBufferSource();
  roar.buffer = a.noiseBuffer; roar.loop = true; roar.playbackRate.value = 0.32;
  const rlp = a.ctx.createBiquadFilter(); rlp.type = 'lowpass'; rlp.frequency.value = 420; rlp.Q.value = 0.6;
  const rg = a.ctx.createGain(); rg.gain.value = 0.75;
  roar.connect(rlp).connect(rg).connect(gain);
  roar.start(t); nodes.push(roar);
  // CRACKLE layer — brighter band-passed noise, amplitude-flickered by a fast LFO so the fire
  //   spits + snaps (the licking-flame read). The LFO modulates the crackle gain around a bias.
  const crk = a.ctx.createBufferSource();
  crk.buffer = a.noiseBuffer; crk.loop = true; crk.playbackRate.value = 0.9;
  const cbp = a.ctx.createBiquadFilter(); cbp.type = 'bandpass'; cbp.frequency.value = 1500; cbp.Q.value = 0.9;
  const cg = a.ctx.createGain(); cg.gain.value = 0.14;   // bias level (the LFO wobbles around it)
  crk.connect(cbp).connect(cg).connect(gain);
  crk.start(t); nodes.push(crk);
  const lfo = a.ctx.createOscillator(); lfo.type = 'sawtooth'; lfo.frequency.value = 9;
  const lg = a.ctx.createGain(); lg.gain.value = 0.10;   // crackle flicker depth
  lfo.connect(lg).connect(cg.gain);
  lfo.start(t); nodes.push(lfo);
  _introLoops.set('engineFire', { nodes, gain });
}
export function stopEngineFire(): void { _stopLoop('engineFire', 0.5); }

/** Desert WIND ambience (T5.3 gap-fill) — the held dawn-desert bed for the wake come-to + the
 *  step-out vista reveal: a soft, breathy, slowly-undulating wind (band-passed looping noise with
 *  a slow filter LFO so it swells + sighs like gusting air over dunes). Deliberately QUIET (E7
 *  aftermath-silence) so it's a presence, not a sound effect. Feeds the ambient bus; loops until
 *  the intro hands off. The real game's own wind/soundscape takes over after endEscapePodIntro
 *  (stopAllIntroLoops stops this). Idempotent. */
export function startDesertWind(): void {
  const a = getAudioInternals();
  if (!a || _introLoops.has('desertWind')) return;
  const t = a.ctx.currentTime;
  const gain = a.ctx.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.linearRampToValueAtTime(0.09, t + 2.5);   // a slow, gentle fade-in (the quiet dawn)
  gain.connect(a.ambient);
  const nodes: AudioScheduledSourceNode[] = [];
  const src = a.ctx.createBufferSource();
  src.buffer = a.noiseBuffer; src.loop = true; src.playbackRate.value = 0.5;
  const bp = a.ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 620; bp.Q.value = 0.7;
  src.connect(bp).connect(gain);
  src.start(t); nodes.push(src);
  // a slow filter LFO — the wind gusts + sighs (the band centre drifts).
  const lfo = a.ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 0.08;
  const lg = a.ctx.createGain(); lg.gain.value = 260;
  lfo.connect(lg).connect(bp.frequency);
  lfo.start(t); nodes.push(lfo);
  _introLoops.set('desertWind', { nodes, gain });
}
export function stopDesertWind(): void { _stopLoop('desertWind', 1.5); }

// ── Music cues (Phase 5 T5.2) — procedural synthesized PADS (no samples), arcing the intro's
//    emotion: a tense ESCAPE sting (disaster→eject) → a beautiful DESCENT swell (the calm fall)
//    → a gentle DESERT easing (the dawn reveal). They feed the ambient bus + reuse the
//    _introLoops lifecycle (stopAllIntroLoops cleans them on teardown). The user LISTENS to balance.
interface PadOpts {
  type: OscillatorType; cutoff: number; peak: number; attack: number;
  voiceGain: number; detune?: number; lfo?: number; lfoDepth?: number;
}
function _startPad(name: string, freqs: number[], opts: PadOpts): void {
  const a = getAudioInternals();
  if (!a || _introLoops.has(name)) return;
  const t = a.ctx.currentTime;
  const gain = a.ctx.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.linearRampToValueAtTime(opts.peak, t + opts.attack);   // swell in
  gain.connect(a.ambient);
  const lp = a.ctx.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = opts.cutoff; lp.Q.value = 0.6;
  lp.connect(gain);
  const nodes: AudioScheduledSourceNode[] = [];
  for (const f of freqs) {
    const o = a.ctx.createOscillator();
    o.type = opts.type; o.frequency.value = f;
    if (opts.detune) o.detune.value = (Math.random() * 2 - 1) * opts.detune;
    const og = a.ctx.createGain(); og.gain.value = opts.voiceGain;
    o.connect(og).connect(lp);
    o.start(t); nodes.push(o);
  }
  if (opts.lfo) {   // a slow filter LFO for movement
    const lfo = a.ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = opts.lfo;
    const lg = a.ctx.createGain(); lg.gain.value = opts.lfoDepth ?? 200;
    lfo.connect(lg).connect(lp.frequency);
    lfo.start(t); nodes.push(lfo);
  }
  _introLoops.set(name, { nodes, gain });
}

/** ESCAPE sting — a tense low minor cluster with a dissonant tension note (disaster→eject). */
export function startMusicEscape(): void {
  _startPad('musicEscape', [110, 130.81, 155.56, 233.08], {   // A2, C3, Eb3 (dim), Bb3 — unease
    type: 'sawtooth', cutoff: 900, peak: 0.10, attack: 0.8, voiceGain: 0.22, detune: 6,
  });
}
export function stopMusicEscape(): void { _stopLoop('musicEscape', 1.0); }

/** DESCENT swell — a warm, spacious, slowly-swelling open chord (the beautiful fall). */
export function startMusicDescent(): void {
  _startPad('musicDescent', [98, 146.83, 196, 246.94, 392], {   // G2, D3, G3, B3, G4 — open major
    type: 'triangle', cutoff: 1600, peak: 0.13, attack: 4.0, voiceGain: 0.16, detune: 4, lfo: 0.05, lfoDepth: 500,
  });
}
export function stopMusicDescent(): void { _stopLoop('musicDescent', 2.0); }

/** DESERT easing — a soft, warm, resolving chord that fades itself out over a long tail so the
 *  cue bridges gently into gameplay as the game takes over (the dawn calm). Self-managed (a
 *  finite life, removed from the loop registry) so it isn't cut short by the intro teardown. */
export function startMusicDesert(): void {
  const a = getAudioInternals();
  if (!a || _introLoops.has('musicDesert')) return;
  _startPad('musicDesert', [130.81, 196, 261.63, 392], {   // C3, G3, C4, G4 — open + warm
    type: 'sine', cutoff: 1400, peak: 0.11, attack: 2.5, voiceGain: 0.18, detune: 3, lfo: 0.04, lfoDepth: 300,
  });
  const v = _introLoops.get('musicDesert');
  if (!v) return;
  const t = a.ctx.currentTime;
  v.gain.gain.cancelScheduledValues(t);
  v.gain.gain.setValueAtTime(0.0001, t);
  v.gain.gain.linearRampToValueAtTime(0.11, t + 2.5);
  v.gain.gain.setValueAtTime(0.11, t + 6.0);
  v.gain.gain.exponentialRampToValueAtTime(0.0001, t + 11.0);   // a long, gentle resolve into gameplay
  for (const n of v.nodes) { try { n.stop(t + 11.3); } catch { /* noop */ } }
  _introLoops.delete('musicDesert');   // self-managed from here (finite) — not cut by stopAllIntroLoops
}

/** Set master volume, 0..1. Settings panel calls this. */
export function setMasterVolume(v: number): void {
  if (_master) _master.gain.value = v;
}

/** ACW E (#134) — ramp the master storm low-pass from `storm01` (0 = clear /
 *  fully open, 1 = peak storm / muffled). Called per-frame from updateSoundscape
 *  with the player's perceivedIntensity. Cutoff lerps log-ish toward
 *  STORM_AUDIO_LP_MIN_HZ as the storm engulfs the player. */
export function setStormMuffle(storm01: number): void {
  if (!_stormLP || !_ctx) return;
  const s = Math.max(0, Math.min(1, storm01));
  const minHz = Tuning.STORM_AUDIO_LP_MIN_HZ;
  // Geometric interpolation between open + muffled reads more natural than
  // linear for filter cutoff.
  const cutoff = _STORM_LP_OPEN_HZ * Math.pow(minHz / _STORM_LP_OPEN_HZ, s);
  _stormLP.frequency.setTargetAtTime(cutoff, _ctx.currentTime, 0.08);
}

export function ensureAudioStarted(): void {
  if (_ctx) {
    if (_ctx.state === 'suspended') void _ctx.resume();
    return;
  }
  try {
    _ctx = new AudioContext();
  } catch {
    return; // browser doesn't support
  }

  _master = _ctx.createGain();
  // Init from the PERSISTED master-volume setting (not a hardcoded 0.55). createMenus runs
  // applySettings at boot BEFORE audio exists, so setMasterVolume no-ops there; without this
  // the saved volume (e.g. a user's 0 = muted) was lost and master defaulted to 0.55 → "volume
  // 0 doesn't mute". Live drags still work via setMasterVolume once _master exists.
  _master.gain.value = loadSettings().masterVolume;
  // ACW E (#134) — master → storm low-pass → destination. Cutoff defaults
  // fully open (transparent) and is ramped down by setStormMuffle during a storm.
  _stormLP = _ctx.createBiquadFilter();
  _stormLP.type = 'lowpass';
  _stormLP.frequency.value = _STORM_LP_OPEN_HZ;
  _stormLP.Q.value = 0.7;
  _master.connect(_stormLP);
  _stormLP.connect(_ctx.destination);

  _sfx = _ctx.createGain();
  _sfx.gain.value = 0.9;
  _sfx.connect(_master);

  _ambient = _ctx.createGain();
  _ambient.gain.value = 0.7;
  _ambient.connect(_master);

  // 2-second white-noise buffer reused for footsteps + wind loop.
  const sr = _ctx.sampleRate;
  _noiseBuffer = _ctx.createBuffer(1, sr * 2, sr);
  const data = _noiseBuffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
}

/** Sand footstep — soft low thud. Default for the dune biome. */
export function playFootstepSand(): void {
  const a = getAudioInternals();
  if (!a) return;
  const t = a.ctx.currentTime;
  const src = a.ctx.createBufferSource();
  src.buffer = a.noiseBuffer;
  src.playbackRate.value = 0.45 + Math.random() * 0.20;

  const filter = a.ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 220 + Math.random() * 180;
  filter.Q.value = 1.2;

  const env = a.ctx.createGain();
  env.gain.setValueAtTime(0.0, t);
  env.gain.linearRampToValueAtTime(0.22, t + 0.005);
  env.gain.exponentialRampToValueAtTime(0.001, t + 0.16);

  src.connect(filter).connect(env).connect(a.sfx);
  src.start(t);
  src.stop(t + 0.20);
}

/** Rock footstep — shorter, brighter, with a small bandpass tap on top. */
export function playFootstepRock(): void {
  const a = getAudioInternals();
  if (!a) return;
  const t = a.ctx.currentTime;
  // Base thump — higher cutoff than sand, shorter envelope.
  const src = a.ctx.createBufferSource();
  src.buffer = a.noiseBuffer;
  src.playbackRate.value = 0.55 + Math.random() * 0.20;
  const lo = a.ctx.createBiquadFilter();
  lo.type = 'lowpass';
  lo.frequency.value = 380 + Math.random() * 160;
  lo.Q.value = 1.0;
  const env = a.ctx.createGain();
  env.gain.setValueAtTime(0.0, t);
  env.gain.linearRampToValueAtTime(0.18, t + 0.004);
  env.gain.exponentialRampToValueAtTime(0.001, t + 0.10);
  src.connect(lo).connect(env).connect(a.sfx);
  src.start(t);
  src.stop(t + 0.14);
  // Bandpass tap — slight stone-on-stone click.
  const src2 = a.ctx.createBufferSource();
  src2.buffer = a.noiseBuffer;
  src2.playbackRate.value = 1.4 + Math.random() * 0.3;
  const bp = a.ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 1200 + Math.random() * 300;
  bp.Q.value = 2.0;
  const env2 = a.ctx.createGain();
  env2.gain.setValueAtTime(0.0, t);
  env2.gain.linearRampToValueAtTime(0.08, t + 0.003);
  env2.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
  src2.connect(bp).connect(env2).connect(a.sfx);
  src2.start(t);
  src2.stop(t + 0.09);
}

/** Salt footstep — brittle crust snap; brighter, very short, almost no sub. */
export function playFootstepSalt(): void {
  const a = getAudioInternals();
  if (!a) return;
  const t = a.ctx.currentTime;
  const src = a.ctx.createBufferSource();
  src.buffer = a.noiseBuffer;
  src.playbackRate.value = 0.9 + Math.random() * 0.25;
  // Highpass to suppress sub thud, leave just the crust-crunch upper band.
  const hp = a.ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 600;
  const lo = a.ctx.createBiquadFilter();
  lo.type = 'lowpass';
  lo.frequency.value = 2400;
  lo.Q.value = 0.8;
  const env = a.ctx.createGain();
  env.gain.setValueAtTime(0.0, t);
  env.gain.linearRampToValueAtTime(0.14, t + 0.003);
  env.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
  src.connect(hp).connect(lo).connect(env).connect(a.sfx);
  src.start(t);
  src.stop(t + 0.10);
}

/** Wet footstep (near a water source) — splash + faint pitched tail. */
export function playFootstepWet(): void {
  const a = getAudioInternals();
  if (!a) return;
  const t = a.ctx.currentTime;
  // Splash noise — short, lowpassed, quick decay.
  const src = a.ctx.createBufferSource();
  src.buffer = a.noiseBuffer;
  src.playbackRate.value = 0.7 + Math.random() * 0.3;
  const lo = a.ctx.createBiquadFilter();
  lo.type = 'lowpass';
  lo.frequency.value = 800 + Math.random() * 200;
  lo.Q.value = 0.9;
  const env = a.ctx.createGain();
  env.gain.setValueAtTime(0.0, t);
  env.gain.linearRampToValueAtTime(0.20, t + 0.005);
  env.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
  src.connect(lo).connect(env).connect(a.sfx);
  src.start(t);
  src.stop(t + 0.15);
  // Pitched tail — small "plop" body resonance.
  const osc = a.ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(640, t);
  osc.frequency.exponentialRampToValueAtTime(320, t + 0.10);
  const oscEnv = a.ctx.createGain();
  oscEnv.gain.setValueAtTime(0.0, t);
  oscEnv.gain.linearRampToValueAtTime(0.06, t + 0.005);
  oscEnv.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
  osc.connect(oscEnv).connect(a.sfx);
  osc.start(t);
  osc.stop(t + 0.14);
}

/** Legacy alias — defaults to the sand variant. Kept so older callers keep
 *  working; new code should call the per-surface function directly. */
export function playFootstep(): void {
  playFootstepSand();
}

/** Pickup — quick high chime, pitches up. */
export function playPickup(): void {
  const a = getAudioInternals();
  if (!a) return;
  const t = a.ctx.currentTime;
  const osc = a.ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(880, t);
  osc.frequency.exponentialRampToValueAtTime(1320, t + 0.08);

  const env = a.ctx.createGain();
  env.gain.setValueAtTime(0.0, t);
  env.gain.linearRampToValueAtTime(0.18, t + 0.005);
  env.gain.exponentialRampToValueAtTime(0.001, t + 0.20);

  osc.connect(env).connect(a.sfx);
  osc.start(t);
  osc.stop(t + 0.22);
}

/** Drink — three quick low gulps. */
export function playDrink(): void {
  const a = getAudioInternals();
  if (!a) return;
  const t0 = a.ctx.currentTime;
  for (let i = 0; i < 3; i++) {
    const t = t0 + i * 0.13;
    const osc = a.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(170 + Math.random() * 30, t);
    osc.frequency.exponentialRampToValueAtTime(120, t + 0.07);
    const env = a.ctx.createGain();
    env.gain.setValueAtTime(0.0, t);
    env.gain.linearRampToValueAtTime(0.18, t + 0.005);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
    osc.connect(env).connect(a.sfx);
    osc.start(t);
    osc.stop(t + 0.13);
  }
}

/** Swing whoosh — quick high-band noise sweep. */
export function playSwing(): void {
  const a = getAudioInternals();
  if (!a) return;
  const t = a.ctx.currentTime;
  const src = a.ctx.createBufferSource();
  src.buffer = a.noiseBuffer;
  src.playbackRate.value = 1.4;
  const filter = a.ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(900, t);
  filter.frequency.exponentialRampToValueAtTime(400, t + 0.18);
  filter.Q.value = 4;
  const env = a.ctx.createGain();
  env.gain.setValueAtTime(0.0, t);
  env.gain.linearRampToValueAtTime(0.16, t + 0.01);
  env.gain.exponentialRampToValueAtTime(0.001, t + 0.20);
  src.connect(filter).connect(env).connect(a.sfx);
  src.start(t);
  src.stop(t + 0.22);
}

/** Hit thud — mid-low cracked impact. Used for both player→enemy and enemy→player. */
export function playHit(intensity: number = 1.0): void {
  const a = getAudioInternals();
  if (!a) return;
  const t = a.ctx.currentTime;
  // Tone component
  const osc = a.ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(160, t);
  osc.frequency.exponentialRampToValueAtTime(70, t + 0.18);
  const oscEnv = a.ctx.createGain();
  oscEnv.gain.setValueAtTime(0.0, t);
  oscEnv.gain.linearRampToValueAtTime(0.22 * intensity, t + 0.005);
  oscEnv.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
  osc.connect(oscEnv).connect(a.sfx);
  osc.start(t);
  osc.stop(t + 0.25);
  // Noise crack
  const src = a.ctx.createBufferSource();
  src.buffer = a.noiseBuffer;
  src.playbackRate.value = 0.8;
  const filter = a.ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 700;
  const env = a.ctx.createGain();
  env.gain.setValueAtTime(0.0, t);
  env.gain.linearRampToValueAtTime(0.18 * intensity, t + 0.003);
  env.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
  src.connect(filter).connect(env).connect(a.sfx);
  src.start(t);
  src.stop(t + 0.15);
}

/** Drop — soft thud as item lands. Used when player drops an inventory slot. */
export function playDrop(): void {
  const a = getAudioInternals();
  if (!a) return;
  const t = a.ctx.currentTime;
  const osc = a.ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(180, t);
  osc.frequency.exponentialRampToValueAtTime(80, t + 0.18);
  const env = a.ctx.createGain();
  env.gain.setValueAtTime(0.0, t);
  env.gain.linearRampToValueAtTime(0.10, t + 0.005);
  env.gain.exponentialRampToValueAtTime(0.001, t + 0.20);
  osc.connect(env).connect(a.sfx);
  osc.start(t);
  osc.stop(t + 0.22);
}

/** ACAX — metallic clang for a salvage-panel door popping off + tumbling free.
 *  A low impact thud + a ring of inharmonic metal partials, fast decay. */
export function playMetalClang(): void {
  const a = getAudioInternals();
  if (!a) return;
  const t = a.ctx.currentTime;
  // Low impact thud (the door breaking loose).
  const thud = a.ctx.createOscillator();
  thud.type = 'triangle';
  thud.frequency.setValueAtTime(150, t);
  thud.frequency.exponentialRampToValueAtTime(64, t + 0.16);
  const thudEnv = a.ctx.createGain();
  thudEnv.gain.setValueAtTime(0, t);
  thudEnv.gain.linearRampToValueAtTime(0.11, t + 0.004);
  thudEnv.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
  thud.connect(thudEnv).connect(a.sfx);
  thud.start(t); thud.stop(t + 0.24);
  // Inharmonic metal partials → the "clang" ring.
  const partials = [328, 547, 781, 1190];
  for (let i = 0; i < partials.length; i++) {
    const f = partials[i] * (0.98 + Math.random() * 0.04);
    const osc = a.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(f, t);
    osc.frequency.exponentialRampToValueAtTime(f * 0.72, t + 0.26);
    const env = a.ctx.createGain();
    const peak = 0.06 / (i + 1);
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(peak, t + 0.004);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.30 - i * 0.05);
    osc.connect(env).connect(a.sfx);
    osc.start(t); osc.stop(t + 0.32);
  }
}

/** Player hurt — short low groan when raider hits the player. */
export function playPlayerHurt(): void {
  const a = getAudioInternals();
  if (!a) return;
  const t = a.ctx.currentTime;
  // Low groan
  const osc = a.ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(120, t);
  osc.frequency.exponentialRampToValueAtTime(80, t + 0.22);
  const env = a.ctx.createGain();
  env.gain.setValueAtTime(0.0, t);
  env.gain.linearRampToValueAtTime(0.16, t + 0.02);
  env.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
  osc.connect(env).connect(a.sfx);
  osc.start(t);
  osc.stop(t + 0.27);
  // Breath noise overlay
  const src = a.ctx.createBufferSource();
  src.buffer = a.noiseBuffer;
  src.playbackRate.value = 0.6;
  const filter = a.ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 320;
  const nEnv = a.ctx.createGain();
  nEnv.gain.setValueAtTime(0.0, t);
  nEnv.gain.linearRampToValueAtTime(0.08, t + 0.02);
  nEnv.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
  src.connect(filter).connect(nEnv).connect(a.sfx);
  src.start(t);
  src.stop(t + 0.26);
}

/** Fire ignite — short whoosh + crackle when a fire is first lit. */
export function playFireIgnite(): void {
  const a = getAudioInternals();
  if (!a) return;
  const t = a.ctx.currentTime;
  // Whoosh: filtered noise sweep, low-to-mid
  const src = a.ctx.createBufferSource();
  src.buffer = a.noiseBuffer;
  src.playbackRate.value = 0.6;
  const filter = a.ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(200, t);
  filter.frequency.exponentialRampToValueAtTime(1200, t + 0.35);
  filter.Q.value = 3;
  const env = a.ctx.createGain();
  env.gain.setValueAtTime(0.0, t);
  env.gain.linearRampToValueAtTime(0.16, t + 0.03);
  env.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
  src.connect(filter).connect(env).connect(a.sfx);
  src.start(t);
  src.stop(t + 0.42);
  // A small crackle at the end
  const c = a.ctx.createBufferSource();
  c.buffer = a.noiseBuffer;
  c.playbackRate.value = 1.4;
  const cf = a.ctx.createBiquadFilter();
  cf.type = 'highpass';
  cf.frequency.value = 1800;
  const cEnv = a.ctx.createGain();
  cEnv.gain.setValueAtTime(0.0, t + 0.32);
  cEnv.gain.linearRampToValueAtTime(0.10, t + 0.34);
  cEnv.gain.exponentialRampToValueAtTime(0.001, t + 0.48);
  c.connect(cf).connect(cEnv).connect(a.sfx);
  c.start(t + 0.32);
  c.stop(t + 0.5);
}

/** Fire crackle — single short pop. Fired as the fire burns over time. */
export function playFireCrackle(): void {
  const a = getAudioInternals();
  if (!a) return;
  const t = a.ctx.currentTime;
  const src = a.ctx.createBufferSource();
  src.buffer = a.noiseBuffer;
  src.playbackRate.value = 1.6 + Math.random() * 0.4;
  const filter = a.ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 1600 + Math.random() * 800;
  filter.Q.value = 5;
  const env = a.ctx.createGain();
  env.gain.setValueAtTime(0.0, t);
  env.gain.linearRampToValueAtTime(0.06, t + 0.002);
  env.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
  src.connect(filter).connect(env).connect(a.sfx);
  src.start(t);
  src.stop(t + 0.08);
}

/** M6 (C37) — signal flare launch: a sharp launch HISS (noise sweep) + a rising
 *  whistle as the flare climbs + a soft sustained burn tail. The "call out" beat
 *  for signal_kit. On the sfx bus (a deliberate, audible event the player triggers). */
export function playSignalFlare(): void {
  const a = getAudioInternals();
  if (!a) return;
  const t = a.ctx.currentTime;
  // Launch hiss — high-passed noise punching up fast, then tailing into the burn.
  const hiss = a.ctx.createBufferSource();
  hiss.buffer = a.noiseBuffer;
  hiss.playbackRate.value = 1.1;
  const hp = a.ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.setValueAtTime(900, t);
  hp.frequency.exponentialRampToValueAtTime(3200, t + 0.25);
  const hissEnv = a.ctx.createGain();
  hissEnv.gain.setValueAtTime(0.0, t);
  hissEnv.gain.linearRampToValueAtTime(0.14, t + 0.02);
  hissEnv.gain.exponentialRampToValueAtTime(0.02, t + 0.5);
  hissEnv.gain.exponentialRampToValueAtTime(0.001, t + 1.6);   // burn tail
  hiss.connect(hp).connect(hissEnv).connect(a.sfx);
  hiss.start(t);
  hiss.stop(t + 1.7);
  // Rising whistle — a thin tone sweeping up as the flare climbs, then fading.
  const w = a.ctx.createOscillator();
  w.type = 'sine';
  w.frequency.setValueAtTime(620, t);
  w.frequency.exponentialRampToValueAtTime(1500, t + 0.6);
  w.frequency.exponentialRampToValueAtTime(820, t + 1.4);     // settles as it peaks + falls
  const wEnv = a.ctx.createGain();
  wEnv.gain.setValueAtTime(0.0, t);
  wEnv.gain.linearRampToValueAtTime(0.07, t + 0.08);
  wEnv.gain.exponentialRampToValueAtTime(0.001, t + 1.5);
  w.connect(wEnv).connect(a.sfx);
  w.start(t);
  w.stop(t + 1.6);
}

/** M6 ④ (C40) — diegetic low-health HEARTBEAT: a soft "lub-dub" of two low thuds.
 *  `intensity` (0..1, how close to death) scales the volume + tightens the second beat
 *  so it reads more urgent near death. On the sfx bus; called on a cadence by statVignette. */
export function playHeartbeat(intensity = 0.5): void {
  const a = getAudioInternals();
  if (!a) return;
  const t = a.ctx.currentTime;
  const vol = 0.10 + 0.16 * Math.max(0, Math.min(1, intensity));
  const gap = 0.22 - 0.06 * intensity;   // lub→dub gap tightens near death
  const thud = (at: number, freq: number, gain: number) => {
    const o = a.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(freq, at);
    o.frequency.exponentialRampToValueAtTime(freq * 0.6, at + 0.14);   // a downward "thump"
    const lp = a.ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 220;
    const env = a.ctx.createGain();
    env.gain.setValueAtTime(0.0001, at);
    env.gain.linearRampToValueAtTime(gain, at + 0.012);
    env.gain.exponentialRampToValueAtTime(0.0008, at + 0.18);
    o.connect(lp).connect(env).connect(a.sfx);
    o.start(at);
    o.stop(at + 0.2);
  };
  thud(t, 62, vol);                 // lub
  thud(t + gap, 52, vol * 0.78);    // dub (lower + softer)
}

/** M6 ④ (C40) — diegetic STOMACH GROWL while starving: a low gurgling rumble (filtered
 *  noise through a slow wobbling band-pass). On the sfx bus; called periodically by statVignette. */
export function playStomachGrowl(): void {
  const a = getAudioInternals();
  if (!a) return;
  const t = a.ctx.currentTime;
  const src = a.ctx.createBufferSource();
  src.buffer = a.noiseBuffer;
  src.playbackRate.value = 0.35;          // slow → low rumble
  const bp = a.ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = 4;
  bp.frequency.setValueAtTime(90, t);
  bp.frequency.linearRampToValueAtTime(160, t + 0.4);   // a gurgle that rises then settles
  bp.frequency.linearRampToValueAtTime(70, t + 0.9);
  const env = a.ctx.createGain();
  env.gain.setValueAtTime(0.0001, t);
  env.gain.linearRampToValueAtTime(0.07, t + 0.12);
  env.gain.linearRampToValueAtTime(0.05, t + 0.6);
  env.gain.exponentialRampToValueAtTime(0.001, t + 1.1);
  src.connect(bp).connect(env).connect(a.sfx);
  src.start(t);
  src.stop(t + 1.2);
}

/** Cook sizzle — ~0.6s filtered noise sweep with low rumble undertone. */
export function playCookSizzle(): void {
  const a = getAudioInternals();
  if (!a) return;
  const t = a.ctx.currentTime;
  // Sizzle layer
  const src = a.ctx.createBufferSource();
  src.buffer = a.noiseBuffer;
  src.playbackRate.value = 1.1;
  const filter = a.ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(2200, t);
  filter.frequency.exponentialRampToValueAtTime(900, t + 0.55);
  filter.Q.value = 2.5;
  const env = a.ctx.createGain();
  env.gain.setValueAtTime(0.0, t);
  env.gain.linearRampToValueAtTime(0.10, t + 0.05);
  env.gain.setValueAtTime(0.10, t + 0.40);
  env.gain.exponentialRampToValueAtTime(0.001, t + 0.60);
  src.connect(filter).connect(env).connect(a.sfx);
  src.start(t);
  src.stop(t + 0.62);
  // Low rumble undertone (heat)
  const osc = a.ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(120, t);
  const oEnv = a.ctx.createGain();
  oEnv.gain.setValueAtTime(0.0, t);
  oEnv.gain.linearRampToValueAtTime(0.04, t + 0.05);
  oEnv.gain.exponentialRampToValueAtTime(0.001, t + 0.60);
  osc.connect(oEnv).connect(a.sfx);
  osc.start(t);
  osc.stop(t + 0.62);
}

/** Sleep thud — slow low descending tone as the player lies down. */
export function playSleepThud(): void {
  const a = getAudioInternals();
  if (!a) return;
  const t = a.ctx.currentTime;
  const osc = a.ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(120, t);
  osc.frequency.exponentialRampToValueAtTime(50, t + 0.5);
  const env = a.ctx.createGain();
  env.gain.setValueAtTime(0.0, t);
  env.gain.linearRampToValueAtTime(0.16, t + 0.04);
  env.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
  osc.connect(env).connect(a.sfx);
  osc.start(t);
  osc.stop(t + 0.58);
}

/** Sand worm roar — layered low rumble + sandy noise burst + sub-bass thud.
 *  Used on breach and on the worm's death. ~0.9s total.
 *  `vol` (0..1) scales all three layers — full-volume call passes 1. */
export function playWormRoar(vol = 1): void {
  const a = getAudioInternals();
  if (!a) return;
  if (vol <= 0) return;
  const t = a.ctx.currentTime;
  // Intestinal rumble — sawtooth sweeping down
  const rumble = a.ctx.createOscillator();
  rumble.type = 'sawtooth';
  rumble.frequency.setValueAtTime(80, t);
  rumble.frequency.exponentialRampToValueAtTime(40, t + 0.8);
  const rEnv = a.ctx.createGain();
  rEnv.gain.setValueAtTime(0.0, t);
  rEnv.gain.linearRampToValueAtTime(0.18 * vol, t + 0.06);
  rEnv.gain.setValueAtTime(0.18 * vol, t + 0.55);
  rEnv.gain.exponentialRampToValueAtTime(0.001, t + 0.85);
  rumble.connect(rEnv).connect(a.sfx);
  rumble.start(t);
  rumble.stop(t + 0.88);
  // Sandy noise burst — bandpassed white noise
  const src = a.ctx.createBufferSource();
  src.buffer = a.noiseBuffer;
  src.playbackRate.value = 0.5;
  const filter = a.ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(600, t);
  filter.frequency.exponentialRampToValueAtTime(220, t + 0.7);
  filter.Q.value = 2.5;
  const nEnv = a.ctx.createGain();
  nEnv.gain.setValueAtTime(0.0, t);
  nEnv.gain.linearRampToValueAtTime(0.16 * vol, t + 0.04);
  nEnv.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
  src.connect(filter).connect(nEnv).connect(a.sfx);
  src.start(t);
  src.stop(t + 0.82);
  // Sub-bass weight — steady square at 60Hz
  const sub = a.ctx.createOscillator();
  sub.type = 'square';
  sub.frequency.setValueAtTime(60, t);
  const sEnv = a.ctx.createGain();
  sEnv.gain.setValueAtTime(0.0, t);
  sEnv.gain.linearRampToValueAtTime(0.06 * vol, t + 0.08);
  sEnv.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
  sub.connect(sEnv).connect(a.sfx);
  sub.start(t);
  sub.stop(t + 0.92);
}

// ── Sustained worm APPROACH RUMBLE (C16) ──────────────────────────────────
// A held sub-bass tremor under the worm's underground CHARGE (vs the one-shot
// roar): two detuned low sines (beating organic weight) + lowpassed looping
// noise (grinding earth), throbbing under a slow tremolo LFO. start/level/stop
// are driven by the worm's charge state (sandWorm.ts). Single global rumble —
// idempotent start; the multi-worm case is handled when that unit lands.
let _wormRumble: {
  sub: OscillatorNode; sub2: OscillatorNode; noise: AudioBufferSourceNode;
  lfo: OscillatorNode; lfoGain: GainNode; level: GainNode;
} | null = null;
const _WORM_RUMBLE_MAX = 0.5;

/** Start the sustained charge rumble (no-op if already playing or audio not started). */
export function startWormRumble(): void {
  const a = getAudioInternals();
  if (!a || _wormRumble) return;
  const t = a.ctx.currentTime;
  const level = a.ctx.createGain();
  level.gain.setValueAtTime(0.0001, t);          // near-silent until setWormRumbleLevel ramps it
  level.connect(a.sfx);
  // Sub-bass weight — two slightly-detuned low sines beat for an organic throb.
  const sub = a.ctx.createOscillator(); sub.type = 'sine'; sub.frequency.value = 34;
  const sub2 = a.ctx.createOscillator(); sub2.type = 'sine'; sub2.frequency.value = 41;
  const subGain = a.ctx.createGain(); subGain.gain.value = 0.7;
  sub.connect(subGain); sub2.connect(subGain); subGain.connect(level);
  // Grinding earth — lowpassed looping noise.
  const noise = a.ctx.createBufferSource();
  noise.buffer = a.noiseBuffer; noise.loop = true; noise.playbackRate.value = 0.35;
  const lp = a.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 95; lp.Q.value = 0.8;
  const noiseGain = a.ctx.createGain(); noiseGain.gain.value = 0.5;
  noise.connect(lp); lp.connect(noiseGain); noiseGain.connect(level);
  // Tremolo LFO — modulates the level so the rumble throbs (the felt vibration).
  const lfo = a.ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 5;
  const lfoGain = a.ctx.createGain(); lfoGain.gain.value = 0;   // depth set by setWormRumbleLevel
  lfo.connect(lfoGain); lfoGain.connect(level.gain);
  sub.start(t); sub2.start(t); noise.start(t); lfo.start(t);
  _wormRumble = { sub, sub2, noise, lfo, lfoGain, level };
  setWormRumbleLevel(0.2);
}

/** Set the rumble intensity 0..1 (charge proximity) — louder, deeper-throbbing, faster as it nears. */
export function setWormRumbleLevel(level01: number): void {
  if (!_wormRumble || !_ctx) return;
  const v = Math.max(0, Math.min(1, level01));
  const t = _ctx.currentTime;
  _wormRumble.level.gain.setTargetAtTime(0.0001 + v * _WORM_RUMBLE_MAX, t, 0.15);
  _wormRumble.lfoGain.gain.setTargetAtTime(v * _WORM_RUMBLE_MAX * 0.3, t, 0.15);
  _wormRumble.lfo.frequency.setTargetAtTime(4 + v * 3.5, t, 0.2);
}

/** Stop the rumble — ramps down (no click) then frees the nodes. Idempotent. */
export function stopWormRumble(): void {
  if (!_wormRumble || !_ctx) return;
  const r = _wormRumble; _wormRumble = null;     // null first so a re-start can't collide
  const t = _ctx.currentTime;
  // Detach the tremolo BEFORE the fade so its oscillation can't bump/click the ramp tail (audit fix).
  r.lfoGain.disconnect();
  r.level.gain.cancelScheduledValues(t);
  r.level.gain.setTargetAtTime(0.0001, t, 0.1);
  const stopT = t + 0.45;
  r.sub.stop(stopT); r.sub2.stop(stopT); r.noise.stop(stopT); r.lfo.stop(stopT);
  // Free the graph once the sources stop — no stale branches accumulate across repeated charges (audit fix).
  r.noise.onended = () => {
    r.sub.disconnect(); r.sub2.disconnect(); r.noise.disconnect();
    r.lfo.disconnect(); r.level.disconnect();
  };
}

// ACL WORM TWILIGHT-BREACH AUDIO ATTENUATION — distance falloff for ambient
// twilight breaches (180-400m away). Soft inverse-distance curve:
//   <= 180m -> ~1.0 (full),  ~400m -> ~0.2,  beyond -> fades to ~0.
const WORM_ROAR_NEAR_DIST = Tuning.WORM_ROAR_NEAR_DIST;   // full volume at/under this range (m)
const WORM_ROAR_FAR_DIST = Tuning.WORM_ROAR_FAR_DIST;    // ~0.2 volume at this range (m)
const WORM_ROAR_FAR_VOL = Tuning.WORM_ROAR_FAR_VOL;     // target volume at FAR_DIST
const WORM_ROAR_CUTOFF_DIST = Tuning.WORM_ROAR_CUTOFF_DIST; // effectively silent beyond this (m)

/** Distance-attenuated worm roar for ambient twilight breaches. Reuses the
 *  roar synth + sfx bus via playWormRoar(vol). Soft inverse-distance falloff:
 *  full at NEAR, ~0.2 at FAR, silent past CUTOFF. */
export function playWormRoarAttenuated(distance: number): void {
  if (distance >= WORM_ROAR_CUTOFF_DIST) return;
  let vol: number;
  if (distance <= WORM_ROAR_NEAR_DIST) {
    vol = 1;
  } else {
    // Inverse-distance: vol = NEAR/dist, normalized so FAR maps to FAR_VOL.
    // raw(NEAR)=1, raw(FAR)=NEAR/FAR; remap that raw range onto [FAR_VOL, 1].
    const raw = WORM_ROAR_NEAR_DIST / distance;
    const rawFar = WORM_ROAR_NEAR_DIST / WORM_ROAR_FAR_DIST;
    const norm = (raw - rawFar) / (1 - rawFar); // 1 at NEAR, 0 at FAR
    vol = WORM_ROAR_FAR_VOL + norm * (1 - WORM_ROAR_FAR_VOL);
    // Past FAR, keep decaying toward the cutoff instead of clamping at FAR_VOL.
    if (distance > WORM_ROAR_FAR_DIST) {
      const tail = (WORM_ROAR_CUTOFF_DIST - distance) / (WORM_ROAR_CUTOFF_DIST - WORM_ROAR_FAR_DIST);
      vol = WORM_ROAR_FAR_VOL * Math.max(0, tail);
    }
  }
  playWormRoar(vol);
}

/** Sand worm chomp — short low impact when a bite lands on the player. */
export function playWormChomp(): void {
  const a = getAudioInternals();
  if (!a) return;
  const t = a.ctx.currentTime;
  // Mid-low tone — triangle 140 → 50Hz
  const osc = a.ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(140, t);
  osc.frequency.exponentialRampToValueAtTime(50, t + 0.18);
  const env = a.ctx.createGain();
  env.gain.setValueAtTime(0.0, t);
  env.gain.linearRampToValueAtTime(0.24, t + 0.005);
  env.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
  osc.connect(env).connect(a.sfx);
  osc.start(t);
  osc.stop(t + 0.25);
  // Low-frequency noise crack — wet impact
  const src = a.ctx.createBufferSource();
  src.buffer = a.noiseBuffer;
  src.playbackRate.value = 0.5;
  const filter = a.ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 320;
  const nEnv = a.ctx.createGain();
  nEnv.gain.setValueAtTime(0.0, t);
  nEnv.gain.linearRampToValueAtTime(0.20, t + 0.003);
  nEnv.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
  src.connect(filter).connect(nEnv).connect(a.sfx);
  src.start(t);
  src.stop(t + 0.16);
}

/** Craft — quick metal tick + low thump (forging / clipping). */
export function playCraft(): void {
  const a = getAudioInternals();
  if (!a) return;
  const t = a.ctx.currentTime;
  // High tick
  const o1 = a.ctx.createOscillator();
  o1.type = 'square';
  o1.frequency.setValueAtTime(2400, t);
  o1.frequency.exponentialRampToValueAtTime(1200, t + 0.04);
  const e1 = a.ctx.createGain();
  e1.gain.setValueAtTime(0.0, t);
  e1.gain.linearRampToValueAtTime(0.07, t + 0.002);
  e1.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
  o1.connect(e1).connect(a.sfx);
  o1.start(t);
  o1.stop(t + 0.09);
  // Low thump
  const o2 = a.ctx.createOscillator();
  o2.type = 'triangle';
  o2.frequency.setValueAtTime(160, t + 0.04);
  o2.frequency.exponentialRampToValueAtTime(70, t + 0.18);
  const e2 = a.ctx.createGain();
  e2.gain.setValueAtTime(0.0, t + 0.04);
  e2.gain.linearRampToValueAtTime(0.12, t + 0.05);
  e2.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
  o2.connect(e2).connect(a.sfx);
  o2.start(t + 0.04);
  o2.stop(t + 0.24);
}

/** Vista reveal (C30) — a soft warm swell when cresting a ridge onto an open view.
 *  A gentle open-fifth/octave pad, slow attack + long release, low-passed warm and
 *  routed to the ambient bus so it sits UNDER the mix (a reward, not a fanfare). */
export function playVistaReveal(strength = 1): void {
  const a = getAudioInternals();
  if (!a) return;
  const t = a.ctx.currentTime;
  const s = Math.max(0.3, Math.min(1, strength));
  // Warm low-pass that opens slightly as the pad swells in.
  const lp = a.ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(650, t);
  lp.frequency.linearRampToValueAtTime(1500, t + 0.9);
  lp.Q.value = 0.6;
  const bus = a.ctx.createGain();
  bus.gain.setValueAtTime(0.0001, t);
  bus.gain.linearRampToValueAtTime(0.11 * s, t + 0.5);   // slow swell-in
  bus.gain.setValueAtTime(0.11 * s, t + 1.2);
  bus.gain.exponentialRampToValueAtTime(0.0008, t + 2.6); // long release
  lp.connect(bus).connect(a.ambient);
  // Open warm chord (D3 / A3 / D4 / A4 — fifths + octaves, hopeful + airy), each
  // voice slightly detuned + the upper voices quieter.
  const freqs = [146.83, 220.0, 293.66, 440.0];
  for (let i = 0; i < freqs.length; i++) {
    const o = a.ctx.createOscillator();
    o.type = i === 0 ? 'triangle' : 'sine';
    o.frequency.setValueAtTime(freqs[i] * (1 + (i - 1.5) * 0.0016), t);
    const g = a.ctx.createGain();
    const w = 1 / (1 + i * 0.5);   // upper voices softer
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.5 * w, t + 0.5);
    g.gain.exponentialRampToValueAtTime(0.001, t + 2.6);
    o.connect(g).connect(lp);
    o.start(t);
    o.stop(t + 2.7);
  }
}

/** Diurnal beats (C35) — a warm/cool tonal swell at the day boundaries so each
 *  sunrise/sunset is a FELT moment (the survival rhythm). `warm` = a hopeful rising
 *  MAJOR chord for dawn; `!warm` = a cooler, settling, lower chord for dusk. On the
 *  ambient bus (sits under the mix). */
function playDayBeat(warm: boolean): void {
  const a = getAudioInternals();
  if (!a) return;
  const t = a.ctx.currentTime;
  const lp = a.ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(warm ? 700 : 520, t);
  lp.frequency.linearRampToValueAtTime(warm ? 2100 : 1050, t + (warm ? 1.0 : 1.6));
  lp.Q.value = 0.6;
  const bus = a.ctx.createGain();
  bus.gain.setValueAtTime(0.0001, t);
  bus.gain.linearRampToValueAtTime(warm ? 0.1 : 0.085, t + (warm ? 0.45 : 0.7));
  bus.gain.setValueAtTime(warm ? 0.1 : 0.085, t + (warm ? 1.1 : 1.4));
  bus.gain.exponentialRampToValueAtTime(0.0007, t + (warm ? 2.8 : 3.4));
  lp.connect(bus).connect(a.ambient);
  // Dawn: a major chord, gently rising (hopeful). Dusk: an open chord a 5th lower,
  // slightly sinking (settling, the night closing in).
  const freqs = warm
    ? [196.0, 246.94, 293.66, 392.0]   // G3 B3 D4 G4 — major, hopeful
    : [130.81, 196.0, 261.63, 392.0];  // C3 G3 C4 G4 — open + low, settling
  const bend = warm ? 1.02 : 0.985;    // rise (dawn) / sink (dusk) over the swell
  for (let i = 0; i < freqs.length; i++) {
    const o = a.ctx.createOscillator();
    o.type = i === 0 ? 'triangle' : 'sine';
    const f0 = freqs[i] * (1 + (i - 1.5) * 0.0016);
    o.frequency.setValueAtTime(f0, t);
    o.frequency.linearRampToValueAtTime(f0 * bend, t + (warm ? 2.4 : 3.0));
    const g = a.ctx.createGain();
    const w = 1 / (1 + i * 0.5);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.5 * w, t + (warm ? 0.45 : 0.7));
    g.gain.exponentialRampToValueAtTime(0.001, t + (warm ? 2.8 : 3.4));
    o.connect(g).connect(lp);
    o.start(t);
    o.stop(t + (warm ? 2.9 : 3.5));
  }
}

/** Dawn — a warm hopeful swell as the sun crests (you survived the night). */
export function playDawnTone(): void { playDayBeat(true); }
/** Dusk — a cooler settling swell as the sun sets (the cold night comes). */
export function playDuskTone(): void { playDayBeat(false); }

/** Refill (water source → canteen) — water filling a vessel, rising pitch. */
export function playRefill(): void {
  const a = getAudioInternals();
  if (!a) return;
  const t = a.ctx.currentTime;
  const src = a.ctx.createBufferSource();
  src.buffer = a.noiseBuffer;
  src.playbackRate.value = 0.7;
  const filter = a.ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(400, t);
  filter.frequency.exponentialRampToValueAtTime(900, t + 0.65);
  filter.Q.value = 4;
  const env = a.ctx.createGain();
  env.gain.setValueAtTime(0.0, t);
  env.gain.linearRampToValueAtTime(0.12, t + 0.05);
  env.gain.setValueAtTime(0.12, t + 0.5);
  env.gain.exponentialRampToValueAtTime(0.001, t + 0.75);
  src.connect(filter).connect(env).connect(a.sfx);
  src.start(t);
  src.stop(t + 0.78);
}

/** Salvage — metal scrape: filtered noise burst + low oscillator thump.
 *  Brighter than footsteps, ~0.4s envelope. Played at salvage start and
 *  completion. */
export function playSalvage(): void {
  const a = getAudioInternals();
  if (!a) return;
  const t = a.ctx.currentTime;
  // Noise scrape — bandpass around ~2.5kHz for a metal-on-metal grind.
  const src = a.ctx.createBufferSource();
  src.buffer = a.noiseBuffer;
  src.playbackRate.value = 0.7 + Math.random() * 0.2;
  const filter = a.ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 2400;
  filter.Q.value = 1.6;
  const env = a.ctx.createGain();
  env.gain.setValueAtTime(0.0, t);
  env.gain.linearRampToValueAtTime(0.14, t + 0.02);
  env.gain.linearRampToValueAtTime(0.10, t + 0.30);
  env.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
  src.connect(filter).connect(env).connect(a.sfx);
  src.start(t);
  src.stop(t + 0.44);
  // Low thump under the scrape — gives it weight.
  const osc = a.ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(110, t);
  osc.frequency.exponentialRampToValueAtTime(70, t + 0.28);
  const oscEnv = a.ctx.createGain();
  oscEnv.gain.setValueAtTime(0.0, t);
  oscEnv.gain.linearRampToValueAtTime(0.08, t + 0.01);
  oscEnv.gain.exponentialRampToValueAtTime(0.001, t + 0.30);
  osc.connect(oscEnv).connect(a.sfx);
  osc.start(t);
  osc.stop(t + 0.32);
}

/** Pry creak — heavy metal-on-metal scrape with a low thump tail. AAR.
 *  Triggered when scrap_bar levers a salvage panel open. ~0.85s total
 *  to align with SALVAGE_PANEL_PRY_DURATION_S — the audio matches the
 *  hold duration. */
export function playPryCreak(): void {
  const a = getAudioInternals();
  if (!a) return;
  const t = a.ctx.currentTime;
  // Layer 1 — metal scrape: bandpassed noise sweeping low→high then back.
  const src = a.ctx.createBufferSource();
  src.buffer = a.noiseBuffer;
  src.playbackRate.value = 0.55;
  const bp = a.ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.setValueAtTime(420, t);
  bp.frequency.linearRampToValueAtTime(1400, t + 0.30);
  bp.frequency.linearRampToValueAtTime(380, t + 0.85);
  bp.Q.value = 4.5;
  const scrapeEnv = a.ctx.createGain();
  scrapeEnv.gain.setValueAtTime(0.0, t);
  scrapeEnv.gain.linearRampToValueAtTime(0.18, t + 0.05);
  scrapeEnv.gain.linearRampToValueAtTime(0.20, t + 0.55);
  scrapeEnv.gain.exponentialRampToValueAtTime(0.001, t + 0.90);
  src.connect(bp).connect(scrapeEnv).connect(a.sfx);
  src.start(t);
  src.stop(t + 0.92);
  // Layer 2 — low thump at the END (door pops free). Triangle 120 → 60Hz.
  const osc = a.ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(160, t + 0.70);
  osc.frequency.exponentialRampToValueAtTime(60, t + 0.92);
  const thumpEnv = a.ctx.createGain();
  thumpEnv.gain.setValueAtTime(0.0, t + 0.70);
  thumpEnv.gain.linearRampToValueAtTime(0.18, t + 0.75);
  thumpEnv.gain.exponentialRampToValueAtTime(0.001, t + 0.95);
  osc.connect(thumpEnv).connect(a.sfx);
  osc.start(t + 0.70);
  osc.stop(t + 0.97);
}

/** Component extract — short clink + tiny click as a part is removed
 *  from the panel. AAR. Fired per-component when the player E-presses
 *  on an open panel. ~0.18s. */
export function playComponentExtract(): void {
  const a = getAudioInternals();
  if (!a) return;
  const t = a.ctx.currentTime;
  // Quick metal click — highpassed noise burst.
  const src = a.ctx.createBufferSource();
  src.buffer = a.noiseBuffer;
  src.playbackRate.value = 1.4 + Math.random() * 0.2;
  const hp = a.ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 2200;
  const clickEnv = a.ctx.createGain();
  clickEnv.gain.setValueAtTime(0.0, t);
  clickEnv.gain.linearRampToValueAtTime(0.10, t + 0.003);
  clickEnv.gain.exponentialRampToValueAtTime(0.001, t + 0.10);
  src.connect(hp).connect(clickEnv).connect(a.sfx);
  src.start(t);
  src.stop(t + 0.12);
  // Pitched clink — small bell-like tone for the metal-ringing-after-disconnect.
  const osc = a.ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(1320 + Math.random() * 200, t + 0.02);
  const oscEnv = a.ctx.createGain();
  oscEnv.gain.setValueAtTime(0.0, t + 0.02);
  oscEnv.gain.linearRampToValueAtTime(0.06, t + 0.025);
  oscEnv.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
  osc.connect(oscEnv).connect(a.sfx);
  osc.start(t + 0.02);
  osc.stop(t + 0.20);
}

/** Recipe discovery chime — bright triadic arpeggio (root → fifth →
 *  octave) that pulses for ~0.6s. Distinct from playCraft's single tick.
 *  Use ONLY on first-time discovery of a recipe; re-crafts get playCraft.
 *  AAN. */
export function playRecipeDiscovery(): void {
  const a = getAudioInternals();
  if (!a) return;
  const t = a.ctx.currentTime;
  // Three sine notes forming a rising arpeggio. Tuned bright + clean.
  const notes = [523.25, 783.99, 1046.50]; // C5, G5, C6
  notes.forEach((freq, i) => {
    const noteT = t + i * 0.10;
    const osc = a.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, noteT);
    const env = a.ctx.createGain();
    env.gain.setValueAtTime(0.0, noteT);
    env.gain.linearRampToValueAtTime(0.12, noteT + 0.008);
    env.gain.exponentialRampToValueAtTime(0.001, noteT + 0.30);
    osc.connect(env).connect(a.sfx);
    osc.start(noteT);
    osc.stop(noteT + 0.34);
  });
  // Faint harmonic glow underneath — square at the root one octave down,
  // very quiet, gives the chime a warm pad bed.
  const pad = a.ctx.createOscillator();
  pad.type = 'triangle';
  pad.frequency.setValueAtTime(261.63, t); // C4
  const padEnv = a.ctx.createGain();
  padEnv.gain.setValueAtTime(0.0, t);
  padEnv.gain.linearRampToValueAtTime(0.04, t + 0.05);
  padEnv.gain.linearRampToValueAtTime(0.04, t + 0.35);
  padEnv.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
  pad.connect(padEnv).connect(a.sfx);
  pad.start(t);
  pad.stop(t + 0.58);
}

/** Bandage — cloth-tear burst + soft pad pat. AAN. Used when the player
 *  uses a bandage to restore health. Two layers: a short highpassed
 *  noise burst (the cloth ripping) followed by a low triangle blip
 *  (the pad pressing down). */
export function playBandageUse(): void {
  const a = getAudioInternals();
  if (!a) return;
  const t = a.ctx.currentTime;
  // Cloth-tear layer: highpass noise burst, brief rising sweep.
  const src = a.ctx.createBufferSource();
  src.buffer = a.noiseBuffer;
  src.playbackRate.value = 1.1 + Math.random() * 0.2;
  const hp = a.ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.setValueAtTime(900, t);
  hp.frequency.exponentialRampToValueAtTime(1800, t + 0.18);
  const tearEnv = a.ctx.createGain();
  tearEnv.gain.setValueAtTime(0.0, t);
  tearEnv.gain.linearRampToValueAtTime(0.13, t + 0.02);
  tearEnv.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
  src.connect(hp).connect(tearEnv).connect(a.sfx);
  src.start(t);
  src.stop(t + 0.24);
  // Soft pad pat — low triangle blip after the tear.
  const osc = a.ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(220, t + 0.20);
  osc.frequency.exponentialRampToValueAtTime(110, t + 0.34);
  const padEnv = a.ctx.createGain();
  padEnv.gain.setValueAtTime(0.0, t + 0.20);
  padEnv.gain.linearRampToValueAtTime(0.09, t + 0.22);
  padEnv.gain.exponentialRampToValueAtTime(0.001, t + 0.36);
  osc.connect(padEnv).connect(a.sfx);
  osc.start(t + 0.20);
  osc.stop(t + 0.38);
}

/** Session ABE — scrap_gun reload. Mechanical clack + chamber click.
 *  Two-stage envelope: hard metal-on-metal clack (highpass noise burst)
 *  followed by a soft bullet-in-chamber tick (low-pitched click). ~0.45s
 *  total. */
/** Gun reload — slide-clack then a chamber tick. `heavy` (the amban rifle) is
 *  lower-pitched + chunkier with an added magazine-seat thunk. */
export function playReloadGun(heavy = false): void {
  const a = getAudioInternals();
  if (!a) return;
  const t = a.ctx.currentTime;
  // Clack — metal slide hitting frame. Highpass noise burst (lower/chunkier for the heavy rifle).
  const clackSrc = a.ctx.createBufferSource();
  clackSrc.buffer = a.noiseBuffer;
  clackSrc.playbackRate.value = heavy ? 1.15 : 1.6;
  const clackHp = a.ctx.createBiquadFilter();
  clackHp.type = 'highpass';
  clackHp.frequency.value = heavy ? 1050 : 1600;
  const clackEnv = a.ctx.createGain();
  clackEnv.gain.setValueAtTime(0.0, t);
  clackEnv.gain.linearRampToValueAtTime(heavy ? 0.22 : 0.18, t + 0.003);
  clackEnv.gain.exponentialRampToValueAtTime(0.001, t + (heavy ? 0.11 : 0.08));
  clackSrc.connect(clackHp).connect(clackEnv).connect(a.sfx);
  clackSrc.start(t);
  clackSrc.stop(t + (heavy ? 0.13 : 0.10));
  // Heavy only — a low magazine-seat THUNK up front (the big mag slapping home).
  if (heavy) {
    const mag = a.ctx.createOscillator();
    mag.type = 'triangle';
    mag.frequency.setValueAtTime(130, t + 0.02);
    mag.frequency.exponentialRampToValueAtTime(55, t + 0.12);
    const magEnv = a.ctx.createGain();
    magEnv.gain.setValueAtTime(0.0, t + 0.02);
    magEnv.gain.linearRampToValueAtTime(0.2, t + 0.03);
    magEnv.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    mag.connect(magEnv).connect(a.sfx);
    mag.start(t + 0.02);
    mag.stop(t + 0.18);
  }
  // Chamber tick — short low percussive blip (the bolt/slide closing).
  const tickT = heavy ? 0.34 : 0.30;
  const tickOsc = a.ctx.createOscillator();
  tickOsc.type = 'square';
  tickOsc.frequency.setValueAtTime(heavy ? 150 : 180, t + tickT);
  tickOsc.frequency.exponentialRampToValueAtTime(heavy ? 72 : 90, t + tickT + 0.08);
  const tickEnv = a.ctx.createGain();
  tickEnv.gain.setValueAtTime(0.0, t + tickT);
  tickEnv.gain.linearRampToValueAtTime(heavy ? 0.13 : 0.10, t + tickT + 0.01);
  tickEnv.gain.exponentialRampToValueAtTime(0.001, t + tickT + 0.12);
  tickOsc.connect(tickEnv).connect(a.sfx);
  tickOsc.start(t + tickT);
  tickOsc.stop(t + tickT + 0.14);
}

// ── M13 ⓘ (C68) — GUNSHOT SFX (the muzzle report on fire, per weapon) ──────────
// preFire() previously played the melee whoosh (playSwing) for ALL weapons; now the
// ranged/charged paths call playWeaponShot(id). Ballistic guns (scrap_gun/amban_rifle)
// get a noise crack + a low report boom; energy guns (pulse_rifle/energy_pistol) get a
// zappy descending pew. All one-shots (start/stop, GC after stop — the established
// one-shot pattern; only sustained voices need explicit disconnect).

/** Ballistic muzzle report. `heavy` = the amban marksman rifle (deeper, louder, longer,
 *  + a sub thump); else the scrap gun (sharper, smaller). */
function ballisticShot(a: AudioInternals, heavy: boolean): void {
  const t = a.ctx.currentTime;
  // Crack — the sharp transient (highpassed noise burst).
  const crack = a.ctx.createBufferSource();
  crack.buffer = a.noiseBuffer;
  crack.playbackRate.value = heavy ? 0.9 : 1.25;
  const hp = a.ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = heavy ? 1400 : 2200;
  const cEnv = a.ctx.createGain();
  cEnv.gain.setValueAtTime(0.0, t);
  cEnv.gain.linearRampToValueAtTime(heavy ? 0.30 : 0.24, t + 0.002);
  cEnv.gain.exponentialRampToValueAtTime(0.001, t + (heavy ? 0.10 : 0.06));
  crack.connect(hp).connect(cEnv).connect(a.sfx);
  crack.start(t);
  crack.stop(t + (heavy ? 0.13 : 0.09));
  // Report body — the gunpowder thump (triangle pitch-drop).
  const boom = a.ctx.createOscillator();
  boom.type = 'triangle';
  boom.frequency.setValueAtTime(heavy ? 175 : 240, t);
  boom.frequency.exponentialRampToValueAtTime(heavy ? 48 : 72, t + (heavy ? 0.22 : 0.13));
  const bEnv = a.ctx.createGain();
  bEnv.gain.setValueAtTime(0.0, t);
  bEnv.gain.linearRampToValueAtTime(heavy ? 0.34 : 0.24, t + 0.004);
  bEnv.gain.exponentialRampToValueAtTime(0.001, t + (heavy ? 0.30 : 0.17));
  boom.connect(bEnv).connect(a.sfx);
  boom.start(t);
  boom.stop(t + (heavy ? 0.32 : 0.19));
  // Sub thump (weight) — heavy rifle only.
  if (heavy) {
    const sub = a.ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(72, t);
    sub.frequency.exponentialRampToValueAtTime(38, t + 0.18);
    const sEnv = a.ctx.createGain();
    sEnv.gain.setValueAtTime(0.0, t);
    sEnv.gain.linearRampToValueAtTime(0.22, t + 0.006);
    sEnv.gain.exponentialRampToValueAtTime(0.001, t + 0.26);
    sub.connect(sEnv).connect(a.sfx);
    sub.start(t);
    sub.stop(t + 0.28);
  }
}

/** Energy muzzle "pew". `big` = the energy pistol's charged release (deeper, longer,
 *  + a sub thump); else the pulse rifle's rapid SHORT zap (kept ~0.1s so the 0.13s
 *  auto-cadence doesn't muddy). */
function energyShot(a: AudioInternals, big: boolean): void {
  const t = a.ctx.currentTime;
  // Zap — a fast descending saw through a resonant lowpass.
  const osc = a.ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(big ? 900 : 1300, t);
  osc.frequency.exponentialRampToValueAtTime(big ? 120 : 300, t + (big ? 0.18 : 0.07));
  const lp = a.ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.Q.value = 6;
  lp.frequency.setValueAtTime(big ? 2600 : 3200, t);
  lp.frequency.exponentialRampToValueAtTime(big ? 500 : 900, t + (big ? 0.18 : 0.07));
  const env = a.ctx.createGain();
  env.gain.setValueAtTime(0.0, t);
  env.gain.linearRampToValueAtTime(big ? 0.26 : 0.18, t + 0.003);
  env.gain.exponentialRampToValueAtTime(0.001, t + (big ? 0.20 : 0.09));
  osc.connect(lp).connect(env).connect(a.sfx);
  osc.start(t);
  osc.stop(t + (big ? 0.22 : 0.10));
  // Sizzle — a brief bandpassed noise tick for the electric edge.
  const nz = a.ctx.createBufferSource();
  nz.buffer = a.noiseBuffer;
  nz.playbackRate.value = 1.5;
  const bp = a.ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = big ? 1800 : 2600;
  bp.Q.value = 1.5;
  const nEnv = a.ctx.createGain();
  nEnv.gain.setValueAtTime(0.0, t);
  nEnv.gain.linearRampToValueAtTime(big ? 0.10 : 0.07, t + 0.002);
  nEnv.gain.exponentialRampToValueAtTime(0.001, t + (big ? 0.08 : 0.05));
  nz.connect(bp).connect(nEnv).connect(a.sfx);
  nz.start(t);
  nz.stop(t + (big ? 0.10 : 0.06));
  // Sub thump — the charged release's weight (energy pistol only).
  if (big) {
    const sub = a.ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(110, t);
    sub.frequency.exponentialRampToValueAtTime(45, t + 0.16);
    const sEnv = a.ctx.createGain();
    sEnv.gain.setValueAtTime(0.0, t);
    sEnv.gain.linearRampToValueAtTime(0.18, t + 0.006);
    sEnv.gain.exponentialRampToValueAtTime(0.001, t + 0.20);
    sub.connect(sEnv).connect(a.sfx);
    sub.start(t);
    sub.stop(t + 0.22);
  }
}

/** Dispatch the muzzle report for the firing weapon (called from combat.ts preFire).
 *  Non-gun ids are a no-op (melee uses playSwing). */
export function playWeaponShot(weaponId: string): void {
  const a = getAudioInternals();
  if (!a) return;
  switch (weaponId) {
    case 'scrap_gun': ballisticShot(a, false); break;
    case 'amban_rifle': ballisticShot(a, true); break;
    case 'pulse_rifle': energyShot(a, false); break;
    case 'energy_pistol': energyShot(a, true); break;
    default: break;
  }
}

/** Harvest (cactus snap) — short crackly snap. */
export function playHarvest(): void {
  const a = getAudioInternals();
  if (!a) return;
  const t = a.ctx.currentTime;
  // Noise snap
  const src = a.ctx.createBufferSource();
  src.buffer = a.noiseBuffer;
  src.playbackRate.value = 1.3;
  const filter = a.ctx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 1200;
  const env = a.ctx.createGain();
  env.gain.setValueAtTime(0.0, t);
  env.gain.linearRampToValueAtTime(0.18, t + 0.005);
  env.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
  src.connect(filter).connect(env).connect(a.sfx);
  src.start(t);
  src.stop(t + 0.18);
  // Sub-crackle: low-freq thump from the cut
  const osc = a.ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(280, t);
  osc.frequency.exponentialRampToValueAtTime(120, t + 0.12);
  const oscEnv = a.ctx.createGain();
  oscEnv.gain.setValueAtTime(0.0, t);
  oscEnv.gain.linearRampToValueAtTime(0.10, t + 0.005);
  oscEnv.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
  osc.connect(oscEnv).connect(a.sfx);
  osc.start(t);
  osc.stop(t + 0.16);
}

/** Lizard squish — high chirp descending into a small crackle. */
export function playLizardSquish(): void {
  const a = getAudioInternals();
  if (!a) return;
  const t = a.ctx.currentTime;
  // Chirp
  const osc = a.ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(1800, t);
  osc.frequency.exponentialRampToValueAtTime(420, t + 0.20);
  const env = a.ctx.createGain();
  env.gain.setValueAtTime(0.0, t);
  env.gain.linearRampToValueAtTime(0.10, t + 0.008);
  env.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
  osc.connect(env).connect(a.sfx);
  osc.start(t);
  osc.stop(t + 0.25);
  // Small crackle tail
  const src = a.ctx.createBufferSource();
  src.buffer = a.noiseBuffer;
  src.playbackRate.value = 0.9;
  const filter = a.ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 600;
  filter.Q.value = 3;
  const sEnv = a.ctx.createGain();
  sEnv.gain.setValueAtTime(0.0, t + 0.06);
  sEnv.gain.linearRampToValueAtTime(0.10, t + 0.07);
  sEnv.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
  src.connect(filter).connect(sEnv).connect(a.sfx);
  src.start(t + 0.06);
  src.stop(t + 0.24);
}

/** UI hover — very short soft tick. Use for menu button mouseenter. */
export function playUiHover(): void {
  const a = getAudioInternals();
  if (!a) return;
  const t = a.ctx.currentTime;
  const osc = a.ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(900, t);
  const env = a.ctx.createGain();
  env.gain.setValueAtTime(0.0, t);
  env.gain.linearRampToValueAtTime(0.06, t + 0.003);
  env.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
  osc.connect(env).connect(a.sfx);
  osc.start(t);
  osc.stop(t + 0.08);
}

/** UI click — snappy two-stage tick. Menu button click / slider change. */
export function playUiClick(): void {
  const a = getAudioInternals();
  if (!a) return;
  const t = a.ctx.currentTime;
  // High tick
  const o1 = a.ctx.createOscillator();
  o1.type = 'square';
  o1.frequency.setValueAtTime(1400, t);
  o1.frequency.exponentialRampToValueAtTime(900, t + 0.04);
  const e1 = a.ctx.createGain();
  e1.gain.setValueAtTime(0.0, t);
  e1.gain.linearRampToValueAtTime(0.10, t + 0.003);
  e1.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
  o1.connect(e1).connect(a.sfx);
  o1.start(t);
  o1.stop(t + 0.07);
  // Low tail
  const o2 = a.ctx.createOscillator();
  o2.type = 'sine';
  o2.frequency.setValueAtTime(700, t);
  const e2 = a.ctx.createGain();
  e2.gain.setValueAtTime(0.0, t);
  e2.gain.linearRampToValueAtTime(0.06, t + 0.005);
  e2.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
  o2.connect(e2).connect(a.sfx);
  o2.start(t);
  o2.stop(t + 0.10);
}

/** Inventory select — brief two-tone (low → higher). Slot switch. */
export function playInventorySelect(): void {
  const a = getAudioInternals();
  if (!a) return;
  const t = a.ctx.currentTime;
  const o1 = a.ctx.createOscillator();
  o1.type = 'sine';
  o1.frequency.setValueAtTime(440, t);
  const e1 = a.ctx.createGain();
  e1.gain.setValueAtTime(0.0, t);
  e1.gain.linearRampToValueAtTime(0.08, t + 0.005);
  e1.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
  o1.connect(e1).connect(a.sfx);
  o1.start(t);
  o1.stop(t + 0.08);

  const o2 = a.ctx.createOscillator();
  o2.type = 'sine';
  o2.frequency.setValueAtTime(660, t + 0.04);
  const e2 = a.ctx.createGain();
  e2.gain.setValueAtTime(0.0, t + 0.04);
  e2.gain.linearRampToValueAtTime(0.10, t + 0.045);
  e2.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
  o2.connect(e2).connect(a.sfx);
  o2.start(t + 0.04);
  o2.stop(t + 0.14);
}

/** Equip — soft cloth-rustle (bandpass noise burst). Equipped item changes. */
export function playEquip(): void {
  const a = getAudioInternals();
  if (!a) return;
  const t = a.ctx.currentTime;
  const src = a.ctx.createBufferSource();
  src.buffer = a.noiseBuffer;
  src.playbackRate.value = 0.9 + Math.random() * 0.2;
  const filter = a.ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(800, t);
  filter.frequency.exponentialRampToValueAtTime(420, t + 0.18);
  filter.Q.value = 2;
  const env = a.ctx.createGain();
  env.gain.setValueAtTime(0.0, t);
  env.gain.linearRampToValueAtTime(0.13, t + 0.012);
  env.gain.exponentialRampToValueAtTime(0.001, t + 0.20);
  src.connect(filter).connect(env).connect(a.sfx);
  src.start(t);
  src.stop(t + 0.22);
}

/** Pour — filtered noise with downward pitch sweep (water sloshing). */
export function playPour(): void {
  const a = getAudioInternals();
  if (!a) return;
  const t = a.ctx.currentTime;
  const src = a.ctx.createBufferSource();
  src.buffer = a.noiseBuffer;
  src.playbackRate.value = 0.75;
  const filter = a.ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(800, t);
  filter.frequency.exponentialRampToValueAtTime(380, t + 0.50);
  filter.Q.value = 3.5;
  const env = a.ctx.createGain();
  env.gain.setValueAtTime(0.0, t);
  env.gain.linearRampToValueAtTime(0.10, t + 0.04);
  env.gain.setValueAtTime(0.10, t + 0.36);
  env.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
  src.connect(filter).connect(env).connect(a.sfx);
  src.start(t);
  src.stop(t + 0.58);
}

/** Death — slow low descending tone with rumble. */
export function playDeath(): void {
  const a = getAudioInternals();
  if (!a) return;
  const t = a.ctx.currentTime;

  const osc = a.ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(90, t);
  osc.frequency.exponentialRampToValueAtTime(28, t + 1.6);

  const filter = a.ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 280;

  const env = a.ctx.createGain();
  env.gain.setValueAtTime(0.0, t);
  env.gain.linearRampToValueAtTime(0.24, t + 0.05);
  env.gain.exponentialRampToValueAtTime(0.001, t + 1.7);

  osc.connect(filter).connect(env).connect(a.sfx);
  osc.start(t);
  osc.stop(t + 1.8);

  // Layer in some filtered noise for rumble
  const src = a.ctx.createBufferSource();
  src.buffer = a.noiseBuffer;
  src.playbackRate.value = 0.35;
  const nf = a.ctx.createBiquadFilter();
  nf.type = 'lowpass';
  nf.frequency.value = 180;
  const ne = a.ctx.createGain();
  ne.gain.setValueAtTime(0.0, t);
  ne.gain.linearRampToValueAtTime(0.12, t + 0.1);
  ne.gain.exponentialRampToValueAtTime(0.001, t + 1.6);
  src.connect(nf).connect(ne).connect(a.sfx);
  src.start(t);
  src.stop(t + 1.7);
}

// ─────────────────────────────────────────────────────────────────────
// Speeder thrust loop (Session CC-polish). A sustained low-rumble +
// filtered noise pad; both pitch + noise level modulate with current
// horizontal speed. Idle thrum at low speed, urgent rumble at top
// speed.
// ─────────────────────────────────────────────────────────────────────
interface SpeederThrustNodes {
  osc: OscillatorNode;
  oscGain: GainNode;
  noise: AudioBufferSourceNode;
  noiseFilter: BiquadFilterNode;
  noiseGain: GainNode;
  master: GainNode;
}
let _speederThrust: SpeederThrustNodes | null = null;

export function startSpeederThrust(): void {
  if (_speederThrust) return;   // already running
  const a = getAudioInternals();
  if (!a) return;
  const t = a.ctx.currentTime;
  const master = a.ctx.createGain();
  master.gain.setValueAtTime(0, t);
  master.gain.linearRampToValueAtTime(1, t + 0.35);
  master.connect(a.ambient);

  // Low oscillator — base engine pitch. M13 ⓙ (C69): a TRIANGLE (was a buzzy sawtooth) +
  // a warm lowpass → a smooth low hum, not a harsh whine; pitched lower (46 Hz idle).
  const osc = a.ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(46, t);
  const oscFilter = a.ctx.createBiquadFilter();   // round off the top so it's a smooth thrum
  oscFilter.type = 'lowpass';
  oscFilter.frequency.value = 280;
  oscFilter.Q.value = 0.7;
  const oscGain = a.ctx.createGain();
  oscGain.gain.value = 0.04;        // quiet at idle, modulated up
  osc.connect(oscFilter).connect(oscGain).connect(master);
  osc.start(t);

  // Filtered noise — rumble layer (deeper + lower for the smoother engine).
  const noise = a.ctx.createBufferSource();
  noise.buffer = a.noiseBuffer;
  noise.loop = true;
  noise.playbackRate.value = 0.5;
  const noiseFilter = a.ctx.createBiquadFilter();
  noiseFilter.type = 'lowpass';
  noiseFilter.frequency.value = 180;
  noiseFilter.Q.value = 1.0;
  const noiseGain = a.ctx.createGain();
  noiseGain.gain.value = 0.05;
  noise.connect(noiseFilter).connect(noiseGain).connect(master);
  noise.start(t);

  _speederThrust = { osc, oscGain, noise, noiseFilter, noiseGain, master };
}

/** Update thrust loop from current bike speed (m/s). Call each frame. */
export function setSpeederThrustSpeed(speed: number, maxSpeed: number): void {
  if (!_speederThrust) return;
  const a = getAudioInternals();
  if (!a) return;
  const t = a.ctx.currentTime;
  const u = Math.min(1, Math.max(0, speed / maxSpeed));   // 0..1
  // M13 ⓙ (C69) — lower, smoother: pitch climbs 46 Hz idle → 90 Hz top (was 70→140 — harsher).
  _speederThrust.osc.frequency.setTargetAtTime(46 + u * 44, t, 0.05);
  // Oscillator gain quiet at idle (0.04), louder under throttle (0.10).
  _speederThrust.oscGain.gain.setTargetAtTime(0.04 + u * 0.06, t, 0.08);
  // Noise rumble opens up with speed (deeper range than before).
  _speederThrust.noiseGain.gain.setTargetAtTime(0.05 + u * 0.12, t, 0.08);
  _speederThrust.noiseFilter.frequency.setTargetAtTime(180 + u * 220, t, 0.08);
}

export function stopSpeederThrust(): void {
  if (!_speederThrust) return;
  const a = getAudioInternals();
  if (!a) return;
  const nodes = _speederThrust;
  _speederThrust = null;
  const t = a.ctx.currentTime;
  // Fade out then stop the sources.
  nodes.master.gain.cancelScheduledValues(t);
  nodes.master.gain.setValueAtTime(nodes.master.gain.value, t);
  nodes.master.gain.linearRampToValueAtTime(0, t + 0.25);
  try { nodes.osc.stop(t + 0.30); } catch { /* may already be stopped */ }
  try { nodes.noise.stop(t + 0.30); } catch { /* may already be stopped */ }
}
