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

/** Footstep — short low-frequency thud. Slight random variation per call. */
export function playFootstep(): void {
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
