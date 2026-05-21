// Session WW — low-stamina screen wobble. Mirrors the sandworm-tremor
// shape: per-frame additive camera-position jitter, scaled by how
// deep into the danger zone the stat is. Sin-driven (deterministic
// rhythm) rather than Math.random — feels like physical breathing
// strain rather than digital noise.
//
// The additive jitter relies on `updatePlayer` re-anchoring the
// camera to the player capsule each frame (it does — see
// `src/player/controller.ts` camera-sync). The wobble adds noise
// AFTER the anchor reset, so it doesn't drift cumulatively.
//
// Suppressed when paused (no shaking a frozen camera) or mounted
// (the speeder ride has its own motion vocabulary; stamina wobble
// while on the bike would feel wrong).

import type { GameContext } from '../GameContext.ts';
import { isPlaying } from '../GameContext.ts';
import { Tuning } from '../config/tuning.ts';

export function updateStaminaWobble(ctx: GameContext): void {
  if (!isPlaying(ctx)) return;
  if (ctx.speeder?.mounted) return;

  const stamina = ctx.stats.stamina;
  if (stamina >= Tuning.STAMINA_WOBBLE_THRESHOLD) return;

  const depth = (Tuning.STAMINA_WOBBLE_THRESHOLD - stamina) / Tuning.STAMINA_WOBBLE_THRESHOLD;
  const amp = Math.min(1, depth) * Tuning.STAMINA_WOBBLE_MAX_M;

  // Two desynced sines so the motion reads as "ragged breathing"
  // rather than a pure pendulum. Y wobble is half the X amplitude
  // (matches how exhausted people sway more side-to-side than up-down).
  const t = ctx.time.elapsed;
  const omega = 2 * Math.PI * Tuning.STAMINA_WOBBLE_FREQ_HZ;
  const dx = Math.sin(t * omega) * amp;
  const dy = Math.sin(t * omega * 1.37 + 1.3) * amp * 0.5;
  const cam = ctx.three.camera;
  cam.position.x += dx;
  cam.position.y += dy;
}
