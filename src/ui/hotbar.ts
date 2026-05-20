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
// QQ-2 — custom hover tooltip (shared singleton). Anchored above whichever
// hotbar slot is currently hovered. `_hoveredSlotIdx` tracks the active
// slot so updateHotbar can refresh tooltip content when its item changes.
// `_latestCtx` is the most recent ctx passed to updateHotbar — used by
// the hover handlers since createHotbar runs before ctx exists in main.ts.
let _tooltipRoot: HTMLDivElement | null = null;
let _tooltipName: HTMLDivElement | null = null;
let _tooltipDesc: HTMLDivElement | null = null;
let _hoveredSlotIdx = -1;
let _latestCtx: GameContext | null = null;

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

    // QQ-2 — hover tooltip handlers (captured `i` for the slot index).
    // Reads ctx from _latestCtx (set by updateHotbar each frame) since
    // createHotbar runs before ctx is constructed in main.ts.
    slot.addEventListener('mouseenter', () => showTooltipForSlot(i));
    slot.addEventListener('mouseleave', () => hideTooltip());

    bar.appendChild(slot);
    _slotRefs.push({ root: slot, glyph, count, fill });
    _lastSlotState.push({ item: null, count: 0, fillLevel: null });
  }

  // QQ-2 — singleton tooltip element. Lives on body so it can float above
  // the hotbar without being clipped. CSS positions it via `bottom`/`left`
  // computed at hover time.
  const tip = document.createElement('div');
  tip.id = 'hotbar-tooltip';
  tip.className = 'hidden';
  const tipName = document.createElement('div');
  tipName.className = 'hotbar-tooltip-name';
  tip.appendChild(tipName);
  const tipDesc = document.createElement('div');
  tipDesc.className = 'hotbar-tooltip-desc';
  tip.appendChild(tipDesc);
  document.body.appendChild(tip);
  _tooltipRoot = tip;
  _tooltipName = tipName;
  _tooltipDesc = tipDesc;
}

/** Show the tooltip for the given slot index. Reads the slot's current
 *  item from `_latestCtx` (refreshed each updateHotbar tick) so the
 *  tooltip stays correct as the slot content changes. Empty slots → hide. */
function showTooltipForSlot(idx: number): void {
  _hoveredSlotIdx = idx;
  refreshTooltipContent();
}

function refreshTooltipContent(): void {
  if (_hoveredSlotIdx < 0 || !_latestCtx) return;
  if (!_tooltipRoot || !_tooltipName || !_tooltipDesc) return;
  const slot = _latestCtx.inventory.slots[_hoveredSlotIdx];
  if (!slot || !slot.item) {
    _tooltipRoot.classList.add('hidden');
    return;
  }
  const def = getItemDef(slot.item);
  _tooltipName.textContent = def.name;
  _tooltipDesc.textContent = def.description;
  // Position above the hovered slot. Slot's getBoundingClientRect gives
  // its current screen position; the tooltip's transform centers it
  // horizontally and pulls it up via CSS.
  const slotEl = _slotRefs[_hoveredSlotIdx]?.root;
  if (slotEl) {
    const rect = slotEl.getBoundingClientRect();
    _tooltipRoot.style.left = `${rect.left + rect.width / 2}px`;
    _tooltipRoot.style.bottom = `${window.innerHeight - rect.top + 8}px`;
  }
  _tooltipRoot.classList.remove('hidden');
}

function hideTooltip(): void {
  _hoveredSlotIdx = -1;
  _tooltipRoot?.classList.add('hidden');
}

export function updateHotbar(ctx: GameContext, _dt: number): void {
  _latestCtx = ctx;       // QQ-2 — keep a ref so hover handlers can read inventory.
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
  let hoveredSlotChanged = false;
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
    if (i === _hoveredSlotIdx) hoveredSlotChanged = true;
  }
  // QQ-2 — keep the tooltip in sync if the hovered slot's content
  // changed (e.g., crafted a new item directly into the slot).
  if (hoveredSlotChanged) refreshTooltipContent();
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
    return;
  }
  refs.root.classList.remove('empty');
  const def = getItemDef(slot.item);
  // (Native browser `title` removed — replaced by the custom hover
  // tooltip wired in createHotbar — QQ-2.)
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
