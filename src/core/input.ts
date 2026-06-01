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

/** True when PointerLock acquisition should be SUPPRESSED — a DEV/preview/
 *  automation context where grabbing PointerLock would confine the real OS
 *  cursor to an offscreen/unfocused window (the "cursor stuck in the top-left
 *  invisible box" bug). Shared by every `controls.lock()` call site so the
 *  guard logic lives in ONE place (ABL/ABN history; ACN hardening).
 *
 *  ⚠ This heuristic is NOT sufficient on its own for HEADLESS PLAYWRIGHT — its
 *  page reports `visibilityState:"visible"`, a sized canvas, AND
 *  `document.hasFocus() === true`, so all three signals read "real user" and
 *  the guard does NOT fire. The deterministic fix for the automated-entry path
 *  is `handoffToGame({ skipLock: true })` (the `enterGame` DEV hook passes it);
 *  this heuristic remains as defense-in-depth for stray preview CLICKS on the
 *  start overlay (which the hidden Claude-Preview tab path does catch). */
export function pointerLockSuppressed(canvas: HTMLCanvasElement): boolean {
  return import.meta.env.DEV && (
    document.hidden ||
    canvas.width === 0 || canvas.height === 0 ||
    !document.hasFocus()
  );
}

/** Wire DOM overlays (start, death) to controls. Called once at boot. */
export function wireOverlays(ctx: GameContext): void {
  const startOverlay = document.getElementById('start-overlay');
  if (!startOverlay) throw new Error('#start-overlay missing');

  startOverlay.addEventListener('click', () => {
    // Browser autoplay policy: audio context must start under a user gesture.
    ensureAudioStarted();
    startSoundscape();
    // ACN — guard against an automated/preview click trapping the OS cursor
    // (a real user clicking "begin" has focus → suppressed=false → locks fine).
    if (!pointerLockSuppressed(ctx.three.renderer.domElement)) {
      ctx.input.controls.lock();
    }
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

  // AAA — TAB toggles the recipe book panel. Suppressed while death
  // screen is up or game not yet started. e.preventDefault() so TAB
  // doesn't escape pointer-lock or shift browser focus.
  window.addEventListener('keydown', (e) => {
    if (e.code !== 'Tab' || e.repeat) return;
    if (ctx.stats.dead || !ctx.flags.started) return;
    e.preventDefault();
    void import('../ui/recipeBookPanel.ts').then((m) => {
      if (m.isRecipeBookPanelOpen()) m.closeRecipeBookPanel(ctx);
      else m.openRecipeBookPanel(ctx);
    });
  });

  // ABO A3 — F toggles 3rd-person camera. Pause-gated (no toggle while
// menu/overlay open). Pre-game / dead / paused = ignore.
  window.addEventListener('keydown', (e) => {
    if (e.code !== 'KeyF' || e.repeat) return;
    if (ctx.stats.dead || !ctx.flags.started || ctx.flags.paused) return;
    e.preventDefault();
    ctx.flags.thirdPerson = !ctx.flags.thirdPerson;
    // Hide first-person hands in 3P; show in FP.
    if (ctx.player.viewModel) {
      ctx.player.viewModel.group.visible = !ctx.flags.thirdPerson;
    }
  });

  ctx.three.scene.add(ctx.input.controls.object);
}
