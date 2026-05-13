// Keyboard + mouse state + PointerLockControls + start/death overlay wiring.

import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import type { GameContext } from '../GameContext.ts';
import { ensureAudioStarted } from '../audio/audio.ts';
import { startSoundscape } from '../audio/soundscape.ts';
import { showPauseOverlay } from '../ui/menus.ts';

export interface InputBundle {
  /** True while the key is held. Updated on every keydown/keyup. */
  keys: Record<string, boolean>;
  /** Codes that fired their initial keydown this frame (no autorepeat). */
  pressed: Set<string>;
  /** Accumulated mouse wheel deltaY since last endFrame(). */
  wheel: number;
  /** Mouse buttons that were just pressed this frame (0=left, 1=middle, 2=right). */
  mousePressed: Set<number>;
  controls: PointerLockControls;
}

export function createInput(
  camera: import('three').PerspectiveCamera,
  domElement: HTMLElement,
): InputBundle {
  const controls = new PointerLockControls(camera, domElement);
  const keys: Record<string, boolean> = {};
  const pressed = new Set<string>();
  const mousePressed = new Set<number>();
  const bundle: InputBundle = { keys, pressed, wheel: 0, mousePressed, controls };

  window.addEventListener('keydown', (e) => {
    if (!e.repeat) pressed.add(e.code);
    keys[e.code] = true;
  });
  window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
  });

  window.addEventListener('wheel', (e) => {
    bundle.wheel += e.deltaY;
  }, { passive: true });

  window.addEventListener('mousedown', (e) => {
    if (controls.isLocked) mousePressed.add(e.button);
  });

  return bundle;
}

/** Clear per-frame state. Call at the END of each loop tick. */
export function endInputFrame(input: InputBundle): void {
  input.pressed.clear();
  input.mousePressed.clear();
  input.wheel = 0;
}

/** Wire DOM overlays (start, death) to controls. Called once at boot. */
export function wireOverlays(ctx: GameContext): void {
  const startOverlay = document.getElementById('start-overlay');
  if (!startOverlay) throw new Error('#start-overlay missing');

  startOverlay.addEventListener('click', () => {
    // Browser autoplay policy: audio context must start under a user gesture.
    ensureAudioStarted();
    startSoundscape();
    ctx.input.controls.lock();
  });
  ctx.input.controls.addEventListener('lock', () => {
    startOverlay.classList.add('hidden');
    ctx.flags.started = true;
    ctx.flags.paused = false;
  });
  ctx.input.controls.addEventListener('unlock', () => {
    if (ctx.stats.dead) return;
    if (!ctx.flags.started) {
      // First load — show the start overlay
      startOverlay.classList.remove('hidden');
      return;
    }
    // Subsequent unlock = the player pressed Esc → pause
    showPauseOverlay();
  });

  const restartBtn = document.getElementById('restart-btn');
  restartBtn?.addEventListener('click', () => location.reload());

  ctx.three.scene.add(ctx.input.controls.object);
}
