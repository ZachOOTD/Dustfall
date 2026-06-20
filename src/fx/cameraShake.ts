// ACBE — trauma-based camera shake. No shake system existed before the crash event
// (D1); built here as a reusable FX primitive (impacts, future weapon recoil, the
// sandworm breach could all addTrauma).
//
// Classic GDC "trauma" model (Squirrel Eiserloh): callers add TRAUMA (0..1) on an
// event; the felt shake is trauma² (so it falls off fast + reads punchy), driven by
// smooth multi-frequency noise (NOT per-frame random — that jitters). Applied to the
// camera AFTER updatePlayer has re-anchored it each frame (mirrors updateStaminaWobble),
// so the offset is transient: next frame the controls/anchor overwrite it cleanly. No
// store/restore needed.

import type { GameContext } from '../GameContext.ts';
import { Tuning } from '../config/tuning.ts';

let _trauma = 0;

/** Add trauma (0..1). Stacks, clamped. amount ~0.3 = a knock, ~0.8 = a near impact. */
export function addTrauma(amount: number): void {
  _trauma = Math.min(1, _trauma + amount);
}

/** Clear on world rebuild / new game so a stale impact doesn't shake the fresh world. */
export function resetCameraShake(): void {
  _trauma = 0;
}

// Smooth pseudo-noise in [-1,1]: two incommensurate sines per axis (cheap, no random).
function noise(t: number, phase: number): number {
  return (Math.sin(t * 1.0 + phase) * 0.6 + Math.sin(t * 2.37 + phase * 3.1) * 0.4);
}

/** Per-frame: decay trauma + offset the camera by trauma²·noise. Call AFTER the camera
 *  is anchored (after updatePlayer / updateStaminaWobble) and before render. */
export function updateCameraShake(ctx: GameContext, dt: number): void {
  if (_trauma <= 0) return;
  _trauma = Math.max(0, _trauma - dt / Tuning.CAMERA_SHAKE_DECAY_S);
  const shake = _trauma * _trauma;
  const cam = ctx.three.camera;
  const t = ctx.time.elapsed * Tuning.CAMERA_SHAKE_FREQ;

  // Rotational shake (the dominant felt component) — pitch/yaw/roll offsets.
  const ang = Tuning.CAMERA_SHAKE_MAX_ANGLE * shake;
  cam.rotation.x += ang * noise(t, 0.0);
  cam.rotation.y += ang * noise(t, 11.3);
  cam.rotation.z += ang * noise(t, 23.7) * 0.7;   // roll a touch less

  // A small positional kick so close impacts have weight.
  const pos = Tuning.CAMERA_SHAKE_MAX_POS * shake;
  cam.position.x += pos * noise(t, 5.0);
  cam.position.y += pos * noise(t, 17.0);
}
