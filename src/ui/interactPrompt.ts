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
};

let _root: HTMLDivElement | null = null;
let _label: HTMLSpanElement | null = null;
let _keyEl: HTMLSpanElement | null = null;
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

  document.body.appendChild(root);
  _root = root;
  _label = label;
  _keyEl = key;
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
    const verb = VERBS[hover.type];
    const label = verb ? `${verb} ${hover.promptNoun}` : hover.promptNoun;
    // Hide the key chip for passive prompts (kill = no E action)
    _keyEl.style.display = verb ? '' : 'none';
    if (label !== _lastLabel) {
      _label.textContent = label;
      _lastLabel = label;
    }
  }
}
