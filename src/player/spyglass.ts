// Salvaged-spyglass zoom (M5a, C29).
//
// Hold RMB while the `spyglass` item is equipped to narrow the camera FOV and scan
// the horizon — read the C28 distant landmark silhouettes, spot wrecks/water to
// steer toward. A scope vignette (a dark tunnel with a clear central circle) fades
// in with the zoom, so it reads as looking THROUGH the glass even though the view-
// model stays at the hip (no dedicated aim-down pose — that's the queued polish).
//
// The zoom is driven here (not via wieldLmb) so LMB stays inert on the spyglass and
// the verb is purely hold-RMB. FOV restores to the player's settings FOV on release
// / unequip. This module owns its one overlay div (created at boot, mutated/frame).

import type { GameContext } from '../GameContext.ts';
import { Tuning } from '../config/tuning.ts';
import { getSettings } from '../ui/menus.ts';

let _scope: HTMLDivElement | null = null;

/** Create the scope vignette overlay (once, at boot). */
export function initSpyglass(): void {
  if (_scope) return;
  const d = document.createElement('div');
  d.id = 'spyglass-scope';   // C29 — lets the rig-shot spyglass-view scenario drive it
  d.style.cssText = [
    'position:fixed',
    'inset:0',
    'pointer-events:none',
    'z-index:35',
    'opacity:0',
    'will-change:opacity',
    // A scope tunnel: clear central circle → darkening ring → black corners.
    'background:radial-gradient(circle at 50% 50%,' +
      ' rgba(0,0,0,0) 0%, rgba(0,0,0,0) 25%,' +
      ' rgba(0,0,0,0.5) 38%, rgba(0,0,0,0.95) 54%, #000 70%)',
  ].join(';');
  document.body.appendChild(d);
  _scope = d;
}

/** Per-frame: ease the camera FOV toward the zoom target + drive the vignette.
 *  Runs after the camera is positioned for the frame and inside the pause gate. */
export function updateSpyglass(ctx: GameContext, dt: number): void {
  const cam = ctx.three.camera;
  let base = getSettings().fov;
  // Deep-Desert cycle 6 — RIDE FOV rush. FOV is centrally eased here every frame,
  // so a speed-based widen must route through this `base` (setting it elsewhere is
  // undone next frame). When riding a sled (flag-gated: ridingSledId is only ever
  // set when FEATURES.rideableSled is on → zero change to the OFF path), widen the
  // base toward SLED_RIDE_FOV_BUMP° at top speed. The existing lerp eases in/out +
  // restores on dismount (ridingSledId → null → base). Suppressed while aiming the
  // spyglass (you can't do both meaningfully).
  const ridingSledId = ctx.player.ridingSledId;
  const slot = ctx.inventory.slots[ctx.inventory.selectedIdx];
  const aiming = slot?.item === 'spyglass' && ctx.input.mouseHeld.has(2) && !ctx.speeder?.mounted;
  if (ridingSledId !== null && !aiming) {
    const sled = ctx.sleds.list.find((s) => s.id === ridingSledId);
    const sp = sled ? Math.hypot(sled._slideVx ?? 0, sled._slideVz ?? 0) : 0;
    const speed01 = Math.min(1, sp / Tuning.SLED_RIDE_MAX_SPEED);
    base += speed01 * Tuning.SLED_RIDE_FOV_BUMP;
  }
  const target = aiming ? Tuning.SPYGLASS_FOV : base;

  if (Math.abs(cam.fov - target) > 0.02) {
    const k = Math.min(1, dt * Tuning.SPYGLASS_ZOOM_LERP);
    cam.fov += (target - cam.fov) * k;
    cam.updateProjectionMatrix();
  } else if (cam.fov !== target) {
    cam.fov = target;
    cam.updateProjectionMatrix();
  }

  if (_scope) {
    const denom = Math.max(1, base - Tuning.SPYGLASS_FOV);
    const prog = Math.max(0, Math.min(1, (base - cam.fov) / denom));
    _scope.style.opacity = (prog * Tuning.SPYGLASS_VIGNETTE_MAX).toFixed(3);
  }
}
