// Tiny procedural Web Audio system. No sample files — everything is
// synthesized at play time from oscillators + filtered noise.
//
// Browsers require a user gesture to start audio. We expose
// `ensureAudioStarted()` from the "click to begin" overlay handler.

let _ctx: AudioContext | null = null;
let _master: GainNode | null = null;
let _sfx: GainNode | null = null;
let _ambient: GainNode | null = null;
let _noiseBuffer: AudioBuffer | null = null;

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

/** Set master volume, 0..1. Settings panel calls this. */
export function setMasterVolume(v: number): void {
  if (_master) _master.gain.value = v;
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
  _master.gain.value = 0.55;
  _master.connect(_ctx.destination);

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
