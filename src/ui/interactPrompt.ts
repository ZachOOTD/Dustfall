// Crosshair-anchored "[E] take" prompt that fades in when looking at a pickup.

import type { GameContext } from '../GameContext.ts';
import { getItemDef } from '../inventory/items.ts';

let _root: HTMLDivElement | null = null;
let _label: HTMLSpanElement | null = null;
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
  label.textContent = 'take';
  root.appendChild(label);

  document.body.appendChild(root);
  _root = root;
  _label = label;
}

export function updateInteractPrompt(ctx: GameContext, _dt: number): void {
  if (!_root || !_label) return;
  const hover = ctx.inventory.hover;
  const show = hover !== null;

  if (show !== _lastShown) {
    _root.classList.toggle('show', show);
    _lastShown = show;
  }

  if (show && hover) {
    const def = getItemDef(hover.itemId);
    const label = `take ${def.name.toLowerCase()}`;
    if (label !== _lastLabel) {
      _label.textContent = label;
      _lastLabel = label;
    }
  }
}
