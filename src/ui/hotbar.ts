// 4-slot hotbar UI. DOM lives at #hotbar (created here). Re-renders only when
// state changes (cheaper than every frame).

import type { GameContext } from '../GameContext.ts';
import { getItemDef } from '../inventory/items.ts';
import type { Slot } from '../inventory/types.ts';

interface SlotRefs {
  root: HTMLDivElement;
  glyph: HTMLDivElement;
  count: HTMLDivElement;
}

let _slotRefs: SlotRefs[] = [];
let _lastSelected = -1;
const _lastSlotState: Array<{ item: string | null; count: number }> = [];

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

    bar.appendChild(slot);
    _slotRefs.push({ root: slot, glyph, count });
    _lastSlotState.push({ item: null, count: 0 });
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

  // Slot contents (diff-render to avoid layout thrash)
  for (let i = 0; i < inv.slots.length; i++) {
    const slot = inv.slots[i];
    const last = _lastSlotState[i];
    if (slot.item === last.item && slot.count === last.count) continue;
    renderSlot(_slotRefs[i], slot);
    last.item = slot.item;
    last.count = slot.count;
  }
}

function renderSlot(refs: SlotRefs, slot: Slot): void {
  if (!slot.item) {
    refs.root.classList.add('empty');
    refs.glyph.textContent = '';
    refs.count.textContent = '';
    return;
  }
  refs.root.classList.remove('empty');
  const def = getItemDef(slot.item);
  refs.glyph.textContent = def.glyph;
  refs.count.textContent = def.stackable && slot.count > 1 ? `×${slot.count}` : '';
}
