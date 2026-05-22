// Pause overlay + settings panel + glue. Main menu for v1 just adds a small
// "settings" link to the existing start overlay (which already has the title
// art); a real multi-button main menu can come later.

import * as THREE from 'three';
import type { GameContext } from '../GameContext.ts';
import {
  loadSettings,
  saveSettings,
  presetValues,
  type Settings,
  type RenderQuality,
} from '../core/settings.ts';
import { setMasterVolume, playUiHover, playUiClick } from '../audio/audio.ts';
import { hasSave, saveGameState, loadGameState, clearSave } from '../persistence/save.ts';

let _settings: Settings = loadSettings();

interface SettingsRefs {
  sensitivity: HTMLInputElement;
  sensitivityVal: HTMLSpanElement;
  volume: HTMLInputElement;
  volumeVal: HTMLSpanElement;
  fov: HTMLInputElement;
  fovVal: HTMLSpanElement;
  renderQuality: HTMLSelectElement;
  shadows: HTMLInputElement;
}

let _ctx: GameContext | null = null;
let _pauseOverlay: HTMLDivElement | null = null;
let _settingsPanel: HTMLDivElement | null = null;
let _settingsRefs: SettingsRefs | null = null;
let _settingsOpen = false;

export function getSettings(): Settings {
  return _settings;
}

// ─────────────────────────────────────────────────────────────
// DOM builders (no innerHTML — avoids XSS hook complaints)
// ─────────────────────────────────────────────────────────────
function makeButton(label: string, action: string): HTMLButtonElement {
  const b = document.createElement('button');
  b.className = 'menu-btn';
  b.dataset.action = action;
  b.textContent = label;
  b.addEventListener('mouseenter', playUiHover);
  return b;
}

function makeTitle(text: string, extraClass = ''): HTMLDivElement {
  const t = document.createElement('div');
  t.className = `title small${extraClass ? ' ' + extraClass : ''}`;
  t.textContent = text;
  return t;
}

function makeSettingsRow(
  labelText: string,
  inputId: string,
  valueId: string,
  attrs: Record<string, string>,
): HTMLDivElement {
  const row = document.createElement('div');
  row.className = 'settings-row';

  const label = document.createElement('label');
  label.textContent = labelText;
  row.appendChild(label);

  const input = document.createElement('input');
  input.type = 'range';
  input.id = inputId;
  for (const [k, v] of Object.entries(attrs)) input.setAttribute(k, v);
  row.appendChild(input);

  const val = document.createElement('span');
  val.className = 'settings-val';
  val.id = valueId;
  row.appendChild(val);

  return row;
}

function makeSettingsDropdown(
  labelText: string,
  selectId: string,
  options: ReadonlyArray<readonly [string, string]>,    // [value, label]
): HTMLDivElement {
  const row = document.createElement('div');
  row.className = 'settings-row';

  const label = document.createElement('label');
  label.textContent = labelText;
  row.appendChild(label);

  const select = document.createElement('select');
  select.id = selectId;
  for (const [value, optLabel] of options) {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = optLabel;
    select.appendChild(opt);
  }
  row.appendChild(select);

  // Empty value cell to align with the slider rows' grid.
  const val = document.createElement('span');
  val.className = 'settings-val';
  row.appendChild(val);

  return row;
}

function makeSettingsToggle(labelText: string, inputId: string): HTMLDivElement {
  const row = document.createElement('div');
  row.className = 'settings-row';

  const label = document.createElement('label');
  label.textContent = labelText;
  row.appendChild(label);

  const input = document.createElement('input');
  input.type = 'checkbox';
  input.id = inputId;
  row.appendChild(input);

  const filler = document.createElement('span');
  filler.className = 'settings-val';
  row.appendChild(filler);

  return row;
}

// ─────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────
export function createMenus(ctx: GameContext): void {
  _ctx = ctx;
  applySettings(_settings);

  // ── Start overlay tweak: add a small "settings" link above the CTA ──
  const startOverlay = document.getElementById('start-overlay');
  if (startOverlay) {
    const link = document.createElement('div');
    link.className = 'menu-link';
    link.textContent = 'settings';
    link.addEventListener('mouseenter', playUiHover);
    link.addEventListener('click', (e) => {
      e.stopPropagation();
      playUiClick();
      openSettings();
    });
    const cta = startOverlay.querySelector<HTMLElement>('.cta');
    if (cta) startOverlay.insertBefore(link, cta);
    else startOverlay.appendChild(link);

    // Continue button — only when a save exists. Clicking loads the save
    // before the overlay-wide click handler locks pointer + starts the game.
    if (hasSave()) {
      const cont = document.createElement('div');
      cont.className = 'cta continue-cta';
      cont.textContent = 'continue';
      cont.addEventListener('mouseenter', playUiHover);
      cont.addEventListener('click', (e) => {
        e.stopPropagation();
        playUiClick();
        const result = loadGameState(ctx);
        if (!result.ok) {
          ctx.ui.showToast(result.error ?? 'load failed');
          return;
        }
        // Same lock-pointer flow as the new-game CTA. The pointer-lock
        // 'lock' handler in input.ts hides the start overlay + sets
        // flags.started.
        ctx.input.controls.lock();
      });
      if (cta) startOverlay.insertBefore(cont, cta);
      else startOverlay.appendChild(cont);

      // Rephrase the existing CTA so the two paths read distinctly.
      if (cta) cta.textContent = 'new game';

      // Intercept New Game clicks: with an existing save in localStorage,
      // proceeding silently would overwrite it on the first sleep / pause-
      // Save. Capture-phase listener fires before the start-overlay's
      // bubble-phase pointer-lock handler in input.ts.
      if (cta) {
        cta.addEventListener('click', (e) => {
          if (!hasSave()) return; // user cleared between mount and click
          e.stopPropagation();
          e.preventDefault();
          playUiClick();
          showNewGameConfirm(ctx, startOverlay, cta, cont);
        }, { capture: true });
      }
    }
  }

  // ── Pause overlay ──
  const pause = document.createElement('div');
  pause.id = 'pause-overlay';
  pause.className = 'overlay hidden';
  pause.appendChild(makeTitle('PAUSED'));
  const pauseBtns = document.createElement('div');
  pauseBtns.className = 'menu-buttons';
  for (const [label, action] of [
    ['resume', 'resume'],
    ['save', 'save'],
    ['controls', 'controls'],
    ['settings', 'settings'],
    ['quit to menu', 'quit'],
  ] as const) {
    const b = makeButton(label, action);
    b.addEventListener('click', () => {
      playUiClick();
      if (action === 'resume') resumeFromPause();
      else if (action === 'save') {
        if (!_ctx) return;
        const result = saveGameState(_ctx);
        // Toast is z:20, pause overlay is z:100 — flip the button text in
        // place so the feedback is visible WITH the pause menu still up.
        // Also fire the toast for the brief moment after unpause.
        const msg = result.ok ? 'game saved' : (result.error ?? 'save failed');
        _ctx.ui.showToast(msg);
        b.textContent = msg;
        window.setTimeout(() => { b.textContent = 'save'; }, 1600);
      } else if (action === 'settings') openSettings();
      else if (action === 'controls') {
        // AAW — open the controls panel as an overlay on top of the
        // pause menu. The panel's close handler reads `returnToPause`
        // and skips resumeFromPause so the player lands back on the
        // pause menu instead of unpausing.
        if (!_ctx) return;
        void import('./tutorial.ts').then((t) => t.showControlsPanel(_ctx!, { returnToPause: true }));
      }
      else if (action === 'quit') {
        // AAX — ctx.flags.devMode is in-memory; a reload drops it
        // automatically and the next title is vanilla by default. No
        // localStorage cleanup needed here. (The AAW localStorage flag
        // was removed in AAX — see main.ts onDevMode.)
        location.reload();
      }
    });
    pauseBtns.appendChild(b);
  }
  pause.appendChild(pauseBtns);
  document.body.appendChild(pause);
  _pauseOverlay = pause;

  // ── Death overlay: rebrand the existing #restart-btn as "main menu" and
  //    inject a "continue from last save" button next to it. The existing
  //    restart-btn click handler in input.ts already reloads the page, which
  //    is the desired "main menu" behaviour. ──
  const deathScreen = document.getElementById('death-screen');
  const restartBtn = document.getElementById('restart-btn');
  if (deathScreen && restartBtn) {
    restartBtn.textContent = 'main menu';
    const cont = document.createElement('button');
    cont.id = 'death-continue-btn';
    cont.textContent = 'continue from last save';
    cont.style.marginRight = '8px';
    cont.addEventListener('mouseenter', playUiHover);
    cont.addEventListener('click', () => {
      playUiClick();
      const result = loadGameState(ctx);
      if (!result.ok) {
        ctx.ui.showToast(result.error ?? 'load failed');
        return;
      }
      // Restore: hide death screen, re-lock pointer, resume play.
      deathScreen.classList.add('hidden');
      ctx.input.controls.lock();
    });
    restartBtn.parentElement?.insertBefore(cont, restartBtn);
    updateDeathScreenButtons();
  }

  // ── Settings panel ──
  const sp = document.createElement('div');
  sp.id = 'settings-panel';
  sp.className = 'overlay hidden';
  sp.appendChild(makeTitle('SETTINGS'));

  const rows = document.createElement('div');
  rows.className = 'settings-rows';
  rows.appendChild(makeSettingsRow('mouse sensitivity', 'set-sens', 'set-sens-val', {
    min: '0.2', max: '3.0', step: '0.05',
  }));
  rows.appendChild(makeSettingsRow('master volume', 'set-vol', 'set-vol-val', {
    min: '0', max: '1', step: '0.01',
  }));
  rows.appendChild(makeSettingsRow('field of view', 'set-fov', 'set-fov-val', {
    min: '60', max: '100', step: '1',
  }));
  rows.appendChild(makeSettingsDropdown('render quality', 'set-quality', [
    ['low', 'low'],
    ['medium', 'medium'],
    ['high', 'high'],
  ]));
  rows.appendChild(makeSettingsToggle('shadows', 'set-shadows'));
  sp.appendChild(rows);

  const closeBtn = makeButton('close', 'close');
  closeBtn.addEventListener('click', () => {
    playUiClick();
    closeSettings();
  });
  sp.appendChild(closeBtn);

  document.body.appendChild(sp);
  _settingsPanel = sp;

  _settingsRefs = {
    sensitivity:    sp.querySelector<HTMLInputElement>('#set-sens')!,
    sensitivityVal: sp.querySelector<HTMLSpanElement>('#set-sens-val')!,
    volume:         sp.querySelector<HTMLInputElement>('#set-vol')!,
    volumeVal:      sp.querySelector<HTMLSpanElement>('#set-vol-val')!,
    fov:            sp.querySelector<HTMLInputElement>('#set-fov')!,
    fovVal:         sp.querySelector<HTMLSpanElement>('#set-fov-val')!,
    renderQuality:  sp.querySelector<HTMLSelectElement>('#set-quality')!,
    shadows:        sp.querySelector<HTMLInputElement>('#set-shadows')!,
  };

  // Reflect saved settings into sliders
  _settingsRefs.sensitivity.value = String(_settings.sensitivity);
  _settingsRefs.sensitivityVal.textContent = _settings.sensitivity.toFixed(2);
  _settingsRefs.volume.value = String(_settings.masterVolume);
  _settingsRefs.volumeVal.textContent = _settings.masterVolume.toFixed(2);
  _settingsRefs.fov.value = String(_settings.fov);
  _settingsRefs.fovVal.textContent = String(_settings.fov);
  _settingsRefs.renderQuality.value = _settings.renderQuality;
  _settingsRefs.shadows.checked = _settings.shadowsEnabled;

  // Live-apply on drag, save on release.
  _settingsRefs.sensitivity.addEventListener('input', () => {
    _settings.sensitivity = parseFloat(_settingsRefs!.sensitivity.value);
    _settingsRefs!.sensitivityVal.textContent = _settings.sensitivity.toFixed(2);
    applySettings(_settings);
  });
  _settingsRefs.sensitivity.addEventListener('mouseenter', playUiHover);
  _settingsRefs.sensitivity.addEventListener('change', () => {
    playUiClick();
    saveSettings(_settings);
  });

  _settingsRefs.volume.addEventListener('input', () => {
    _settings.masterVolume = parseFloat(_settingsRefs!.volume.value);
    _settingsRefs!.volumeVal.textContent = _settings.masterVolume.toFixed(2);
    applySettings(_settings);
  });
  _settingsRefs.volume.addEventListener('mouseenter', playUiHover);
  _settingsRefs.volume.addEventListener('change', () => {
    playUiClick();
    saveSettings(_settings);
  });

  _settingsRefs.fov.addEventListener('input', () => {
    _settings.fov = parseInt(_settingsRefs!.fov.value, 10);
    _settingsRefs!.fovVal.textContent = String(_settings.fov);
    applySettings(_settings);
  });
  _settingsRefs.fov.addEventListener('mouseenter', playUiHover);
  _settingsRefs.fov.addEventListener('change', () => {
    playUiClick();
    saveSettings(_settings);
  });

  // Render quality: applies + persists on change. No live "input" event for
  // <select> — change fires once per selection.
  _settingsRefs.renderQuality.addEventListener('mouseenter', playUiHover);
  _settingsRefs.renderQuality.addEventListener('change', () => {
    _settings.renderQuality = _settingsRefs!.renderQuality.value as RenderQuality;
    playUiClick();
    applySettings(_settings);
    saveSettings(_settings);
  });

  // Shadows on/off — biggest single GPU lever.
  _settingsRefs.shadows.addEventListener('mouseenter', playUiHover);
  _settingsRefs.shadows.addEventListener('change', () => {
    _settings.shadowsEnabled = _settingsRefs!.shadows.checked;
    playUiClick();
    applySettings(_settings);
    saveSettings(_settings);
  });
}

function applySettings(s: Settings): void {
  if (!_ctx) return;
  // PointerLockControls.pointerSpeed isn't typed but exists at runtime.
  (_ctx.input.controls as unknown as { pointerSpeed: number }).pointerSpeed =
    s.sensitivity;
  if (_ctx.three.camera.fov !== s.fov) {
    _ctx.three.camera.fov = s.fov;
    _ctx.three.camera.updateProjectionMatrix();
  }
  setMasterVolume(s.masterVolume);
  applyRenderQuality(_ctx, s.renderQuality);
  applyShadows(_ctx, s.shadowsEnabled);
}

/** Toggle sun shadow casting. Off = scene renders once per frame (vs twice).
 *  Biggest single GPU lever in the game. Regenerates shadow map on re-enable. */
function applyShadows(ctx: GameContext, enabled: boolean): void {
  const sun = ctx.lights.sun;
  if (sun.castShadow === enabled) return;
  sun.castShadow = enabled;
  // Re-enabling: dispose the existing (possibly stale) map and let Three.js
  // regenerate it. Disabling: leave it alone — costs nothing while unused.
  if (enabled) {
    const sm = sun.shadow.map;
    if (sm) {
      sm.dispose();
      (sun.shadow as unknown as { map: THREE.WebGLRenderTarget | null }).map = null;
    }
  }
}

/** Live-apply a graphics quality preset: pixel ratio + shadow map size.
 *  Both are dynamic; no renderer recreation needed. */
function applyRenderQuality(ctx: GameContext, q: RenderQuality): void {
  const values = presetValues(q, window.devicePixelRatio);
  const renderer = ctx.three.renderer;
  // Order: setPixelRatio BEFORE setSize so the framebuffer adopts the new ratio.
  renderer.setPixelRatio(values.pixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);

  // Shadow map: change size + force Three.js to regenerate by disposing the
  // current map and clearing the ref. Cast to nullable because Three's types
  // say `.map` is non-null after init, but null-assignment forces regen.
  const sun = ctx.lights.sun;
  if (sun.shadow.mapSize.x !== values.shadowMapSize) {
    sun.shadow.mapSize.set(values.shadowMapSize, values.shadowMapSize);
    const sm = sun.shadow.map;
    if (sm) {
      sm.dispose();
      (sun.shadow as unknown as { map: THREE.WebGLRenderTarget | null }).map = null;
    }
  }
}

export function openSettings(): void {
  if (!_settingsPanel) return;
  _settingsPanel.classList.remove('hidden');
  _settingsOpen = true;
}

export function closeSettings(): void {
  if (!_settingsPanel) return;
  _settingsPanel.classList.add('hidden');
  _settingsOpen = false;
  saveSettings(_settings);
}

export function resumeFromPause(): void {
  if (!_ctx) return;
  if (_pauseOverlay) _pauseOverlay.classList.add('hidden');
  if (_settingsPanel) _settingsPanel.classList.add('hidden');
  _settingsOpen = false;
  _ctx.flags.paused = false;
  _ctx.input.controls.lock();
}

/** Called from input.ts unlock handler: open pause if game has started + alive. */
export function showPauseOverlay(): void {
  if (!_ctx || !_pauseOverlay) return;
  if (_ctx.stats.dead) return;
  if (!_ctx.flags.started) return;
  _ctx.flags.paused = true;
  _pauseOverlay.classList.remove('hidden');
}

export function isSettingsOpen(): boolean {
  return _settingsOpen;
}

/** Toggle the "continue from last save" button on the death screen based
 *  on whether a save currently exists in localStorage. Called from
 *  createMenus on boot and from survival.die() right before the death
 *  overlay is shown. */
export function updateDeathScreenButtons(): void {
  const cont = document.getElementById('death-continue-btn');
  if (cont) cont.style.display = hasSave() ? '' : 'none';
}

/** Inline confirm for New Game when a save would be overwritten. Hides the
 *  CTAs + shows a small confirm row. Yes → clearSave + lock pointer.
 *  Cancel → restore the CTAs. */
function showNewGameConfirm(
  ctx: GameContext,
  startOverlay: HTMLElement,
  newGameCta: HTMLElement,
  continueCta: HTMLElement,
): void {
  // If a confirm is already open, do nothing.
  if (startOverlay.querySelector('.new-game-confirm')) return;

  const wrap = document.createElement('div');
  wrap.className = 'new-game-confirm';

  const msg = document.createElement('div');
  msg.className = 'subtitle';
  msg.textContent = 'starting a new game will overwrite your existing save.';
  wrap.appendChild(msg);

  const row = document.createElement('div');
  row.className = 'menu-buttons';

  const yes = document.createElement('button');
  yes.className = 'menu-btn';
  yes.textContent = 'yes, new game';
  yes.addEventListener('mouseenter', playUiHover);
  yes.addEventListener('click', (e) => {
    e.stopPropagation();
    playUiClick();
    clearSave();
    // Tear down the confirm + the now-stale Continue button; the new run
    // has no save until the player sleeps or hits Save.
    wrap.remove();
    continueCta.remove();
    newGameCta.style.display = '';
    newGameCta.textContent = 'click to begin';
    ctx.input.controls.lock();
  });
  row.appendChild(yes);

  const cancel = document.createElement('button');
  cancel.className = 'menu-btn';
  cancel.textContent = 'cancel';
  cancel.addEventListener('mouseenter', playUiHover);
  cancel.addEventListener('click', (e) => {
    e.stopPropagation();
    playUiClick();
    wrap.remove();
    newGameCta.style.display = '';
    continueCta.style.display = '';
  });
  row.appendChild(cancel);

  wrap.appendChild(row);

  // Hide the CTAs while the confirm is up so the user can only Yes/Cancel.
  newGameCta.style.display = 'none';
  continueCta.style.display = 'none';

  startOverlay.appendChild(wrap);
}
