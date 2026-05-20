// Keyboard + mouse state + PointerLockControls + start/death overlay wiring.

import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import type { GameContext } from '../GameContext.ts';
import { ensureAudioStarted } from '../audio/audio.ts';
import { startSoundscape } from '../audio/soundscape.ts';
import { showPauseOverlay } from '../ui/menus.ts';
import { showControlsPanel, hideControlsPanel, noteIntroSeen, isControlsPanelOpen } from '../ui/tutorial.ts';

export interface InputBundle {
  /** True while the key is held. Updated on every keydown/keyup. */
  keys: Record<string, boolean>;
  /** Codes that fired their initial keydown this frame (no autorepeat). */
  pressed: Set<string>;
  /** Accumulated mouse wheel deltaY since last endFrame(). */
  wheel: number;
  /** Mouse buttons that were just pressed this frame (0=left, 1=middle, 2=right). */
  mousePressed: Set<number>;
  /** Mouse buttons currently held DOWN (Session PP — charged weapons
   *  need this since mousePressed clears each frame). Set on mousedown,
   *  cleared on mouseup. NOT cleared by endInputFrame. */
  mouseHeld: Set<number>;
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
  const mouseHeld = new Set<number>();
  const bundle: InputBundle = { keys, pressed, wheel: 0, mousePressed, mouseHeld, controls };

  window.addEventListener('keydown', (e) => {
    if (!e.repeat) pressed.add(e.code);
    keys[e.code] = true;
  });
  window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
  });

  // Block browser shortcuts that conflict with Ctrl-as-crouch. Without this,
  // Ctrl+W (forward) closes the tab, Ctrl+S (back) opens "save page", etc.
  // We swallow Ctrl/⌘ + WASD/Q (movement + use-selected) — leaves devtools
  // and refresh accessible.
  const CTRL_BLOCK = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ']);
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && CTRL_BLOCK.has(e.code)) {
      e.preventDefault();
    }
  });

  window.addEventListener('wheel', (e) => {
    bundle.wheel += e.deltaY;
  }, { passive: true });

  window.addEventListener('mousedown', (e) => {
    if (controls.isLocked) {
      mousePressed.add(e.button);
      mouseHeld.add(e.button);
    }
  });
  // PP — track release for charged-weapon hold/release. Always listen
  // (don't gate on isLocked) so a release that happens just after a
  // lock-loss still clears the held state.
  window.addEventListener('mouseup', (e) => {
    mouseHeld.delete(e.button);
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
    // First-boot controls panel (if showing) dismisses on first lock.
    noteIntroSeen();
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

  // H — toggle controls/help panel (Session L). Works anytime: pre-game it
  // re-opens the first-boot list; in-game it pauses + overlays above pause.
  // Suppressed while the death screen is up (the dead get no help).
  window.addEventListener('keydown', (e) => {
    if (e.code !== 'KeyH' || e.repeat) return;
    if (ctx.stats.dead) return;
    e.preventDefault();
    if (isControlsPanelOpen()) hideControlsPanel(ctx);
    else showControlsPanel(ctx);
  });

  // I / C — toggle inventory overlay and crafting menu (Session U). Lives on
  // window so it fires even when the game is paused by another overlay.
  // Lazy-imported to avoid a boot-time cycle with the overlay modules.
  // Pressing the partner key while one overlay is open is a no-op (avoids
  // stacking two overlays on top of each other).
  window.addEventListener('keydown', (e) => {
    if (e.repeat || ctx.stats.dead || !ctx.flags.started) return;
    if (e.code !== 'KeyI' && e.code !== 'KeyC') return;
    e.preventDefault();
    void (async () => {
      const [inv, craft] = await Promise.all([
        import('../ui/inventoryOverlay.ts'),
        import('../ui/craftingMenu.ts'),
      ]);
      if (e.code === 'KeyI') {
        if (inv.isInventoryOverlayOpen()) inv.closeInventoryOverlay();
        else if (!craft.isCraftingMenuOpen()) inv.openInventoryOverlay(ctx);
      } else {
        if (craft.isCraftingMenuOpen()) craft.closeCraftingMenu();
        else if (!inv.isInventoryOverlayOpen()) craft.openCraftingMenu(ctx);
      }
    })();
  });

  ctx.three.scene.add(ctx.input.controls.object);
}
