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
    const cta = startOverlay.querySelector('.cta');
    if (cta) startOverlay.insertBefore(link, cta);
    else startOverlay.appendChild(link);
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
    ['settings', 'settings'],
    ['quit to menu', 'quit'],
  ] as const) {
    const b = makeButton(label, action);
    b.addEventListener('click', () => {
      playUiClick();
      if (action === 'resume') resumeFromPause();
      else if (action === 'settings') openSettings();
      else if (action === 'quit') location.reload();
    });
    pauseBtns.appendChild(b);
  }
  pause.appendChild(pauseBtns);
  document.body.appendChild(pause);
  _pauseOverlay = pause;

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
