// 4-slot hotbar UI. DOM lives at #hotbar (created here). Re-renders only when
// state changes (cheaper than every frame).
//
// Each slot also has an optional fill bar (for canteen fillLevel) which
// re-renders when the meta changes.

import type { GameContext } from '../GameContext.ts';
import { getItemDef } from '../inventory/items.ts';
import type { Slot } from '../inventory/types.ts';

interface SlotRefs {
  root: HTMLDivElement;
  glyph: HTMLDivElement;
  count: HTMLDivElement;
  fill: HTMLDivElement;
}

let _slotRefs: SlotRefs[] = [];
let _lastSelected = -1;
const _lastSlotState: Array<{ item: string | null; count: number; fillLevel: number | null }> = [];

export function createHotbar(): void {
  const bar = document.createElement('div');
  bar.id = 'hotbar';
  document.body.appendChild(bar);

  _slotRefs = [];
  for (let i = 0; i < 4; i++) {
    const slot = document.createElement('div');
    slot.className = 'hotbar-slot empty';
    slot.dataset.slot = String(i);

    const keybind = document.createElement('div');
    keybind.className = 'keybind';
    keybind.textContent = String(i + 1);
    slot.appendChild(keybind);

    const glyph = document.createElement('div');
    glyph.className = 'glyph';
    slot.appendChild(glyph);

    const count = document.createElement('div');
    count.className = 'count';
    slot.appendChild(count);

    const fill = document.createElement('div');
    fill.className = 'fill-bar';
    fill.style.display = 'none';
    slot.appendChild(fill);

    bar.appendChild(slot);
    _slotRefs.push({ root: slot, glyph, count, fill });
    _lastSlotState.push({ item: null, count: 0, fillLevel: null });
  }
}

export function updateHotbar(ctx: GameContext, _dt: number): void {
  const inv = ctx.inventory;

  // Selection ring
  if (inv.selectedIdx !== _lastSelected) {
    for (let i = 0; i < _slotRefs.length; i++) {
      _slotRefs[i].root.classList.toggle('selected', i === inv.selectedIdx);
    }
    _lastSelected = inv.selectedIdx;
  }

  // Slot contents (diff-render to avoid layout thrash).
  // Also detect fillLevel changes so the canteen bar updates as you drink.
  for (let i = 0; i < inv.slots.length; i++) {
    const slot = inv.slots[i];
    const last = _lastSlotState[i];
    const currentFill = slot.meta?.fillLevel ?? null;
    if (
      slot.item === last.item &&
      slot.count === last.count &&
      currentFill === last.fillLevel
    ) continue;
    renderSlot(_slotRefs[i], slot);
    last.item = slot.item;
    last.count = slot.count;
    last.fillLevel = currentFill;
  }
}

function clearChildren(el: HTMLElement): void {
  while (el.firstChild) el.removeChild(el.firstChild);
}

function renderSlot(refs: SlotRefs, slot: Slot): void {
  clearChildren(refs.glyph);
  refs.fill.style.display = 'none';
  if (!slot.item) {
    refs.root.classList.add('empty');
    refs.count.textContent = '';
    refs.root.title = '';
    return;
  }
  refs.root.classList.remove('empty');
  const def = getItemDef(slot.item);
  refs.root.title = def.name.toLowerCase();
  if (def.makeIcon) {
    refs.glyph.appendChild(def.makeIcon());
  } else {
    refs.glyph.textContent = def.glyph;
  }
  refs.count.textContent = def.stackable && slot.count > 1 ? `×${slot.count}` : '';

  // Canteen fill bar — shows how full the canteen is.
  if (slot.item === 'canteen') {
    const fill = slot.meta?.fillLevel ?? 1;
    refs.fill.style.display = '';
    refs.fill.style.width = `${Math.max(0, Math.min(1, fill)) * 100}%`;
  }
}
