// Crosshair-anchored "[E] <verb> <noun>" prompt that fades in when looking
// at any interactable entity. The verb is determined by hover.type, the
// noun by hover.promptNoun (set by the interaction system).

import type { GameContext } from '../GameContext.ts';
import type { InteractType } from '../inventory/types.ts';

const VERBS: Record<InteractType, string> = {
  take: 'take',
  refill: 'refill',
  search: 'search',
  harvest: 'harvest',
  kill: '',     // living lizard — no prompt action (LMB does it); we show just the noun
  cook: 'cook at',
  add_fuel: 'add fuel to',
  sleep: 'sleep in',
  relight: 'relight',
  salvage: 'salvage',
  read: 'read',
  mount: 'mount',
  open_sled: 'open',    // QQ — E opens the sled cargo (sled inventory menu)
  attach_rope: '',      // QQ — LMB-driven; verb is empty so the [E] chip is hidden. promptNoun carries the click-to-attach copy.
};

let _root: HTMLDivElement | null = null;
let _label: HTMLSpanElement | null = null;
let _keyEl: HTMLSpanElement | null = null;
let _progressBar: HTMLDivElement | null = null;
let _lastShown = false;
let _lastLabel = '';

export function createInteractPrompt(): void {
  const root = document.createElement('div');
  root.id = 'interact-prompt';

  const key = document.createElement('span');
  key.className = 'key';
  key.textContent = 'E';
  root.appendChild(key);

  const label = document.createElement('span');
  label.className = 'label';
  label.textContent = '';
  root.appendChild(label);

  // Salvage progress bar — sits under the verb text, hidden by default.
  const bar = document.createElement('div');
  bar.className = 'salvage-progress';
  bar.style.display = 'none';
  root.appendChild(bar);

  document.body.appendChild(root);
  _root = root;
  _label = label;
  _keyEl = key;
  _progressBar = bar;
}

/** Show the salvage progress bar with a 0..1 fill. Driven per-frame from
 *  the interaction system while a salvage is in progress. */
export function showSalvageProgress(t01: number): void {
  if (!_progressBar) return;
  _progressBar.style.display = '';
  _progressBar.style.width = `${Math.max(0, Math.min(1, t01)) * 100}%`;
}

/** Hide the salvage progress bar. */
export function hideSalvageProgress(): void {
  if (!_progressBar) return;
  _progressBar.style.display = 'none';
  _progressBar.style.width = '0%';
}

export function updateInteractPrompt(ctx: GameContext, _dt: number): void {
  if (!_root || !_label || !_keyEl) return;
  const hover = ctx.inventory.hover;
  const show = hover !== null;

  if (show !== _lastShown) {
    _root.classList.toggle('show', show);
    _lastShown = show;
  }

  if (show && hover) {
    const verb = hover.passive ? '' : VERBS[hover.type];
    const label = verb ? `${verb} ${hover.promptNoun}` : hover.promptNoun;
    // Hide the key chip for passive prompts (kill = no E action; stripped wrecks)
    _keyEl.style.display = verb ? '' : 'none';
    if (label !== _lastLabel) {
      _label.textContent = label;
      _lastLabel = label;
    }
  }
}
