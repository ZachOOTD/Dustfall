// Inventory overlay — opens on I. Shows the hotbar (4 slots) + backpack (10 slots).
// Click-then-click swap: click a slot to "select" (gold outline); click another to
// swap contents. Click the selected slot again to deselect.
// Esc / close button → close (resumes game via resumeFromPause).

import type { GameContext } from '../GameContext.ts';
import type { Slot, InventoryState } from '../inventory/types.ts';
import { getItemDef } from '../inventory/items.ts';
import { playUiHover, playUiClick, playInventorySelect } from '../audio/audio.ts';
import { resumeFromPause } from './menus.ts';

interface TileRefs {
  root: HTMLDivElement;
  glyph: HTMLDivElement;
  count: HTMLDivElement;
  fill: HTMLDivElement;
}

let _root: HTMLDivElement | null = null;
let _hotbarTiles: TileRefs[] = [];
let _backpackTiles: TileRefs[] = [];
let _ctx: GameContext | null = null;
let _open = false;
// "selected" for swap — either { area: 'hotbar' | 'backpack', idx: number } or null
let _swapSel: { area: 'hotbar' | 'backpack'; idx: number } | null = null;

function clearChildren(el: HTMLElement): void {
  while (el.firstChild) el.removeChild(el.firstChild);
}

function buildTile(area: 'hotbar' | 'backpack', idx: number): TileRefs {
  const root = document.createElement('div');
  root.className = 'inv-tile empty';
  root.dataset.area = area;
  root.dataset.idx = String(idx);

  const glyph = document.createElement('div');
  glyph.className = 'glyph';
  root.appendChild(glyph);

  const count = document.createElement('div');
  count.className = 'count';
  root.appendChild(count);

  const fill = document.createElement('div');
  fill.className = 'fill-bar';
  fill.style.display = 'none';
  root.appendChild(fill);

  root.addEventListener('mouseenter', playUiHover);
  root.addEventListener('click', () => onTileClick(area, idx));

  return { root, glyph, count, fill };
}

function onTileClick(area: 'hotbar' | 'backpack', idx: number): void {
  if (!_ctx) return;
  if (!_swapSel) {
    // First click — select if non-empty.
    const inv = _ctx.inventory;
    const slot = area === 'hotbar' ? inv.slots[idx] : inv.backpack[idx];
    if (!slot.item) return;
    _swapSel = { area, idx };
    playUiClick();
    renderAll();
    return;
  }
  // Second click — same target = deselect; otherwise swap.
  if (_swapSel.area === area && _swapSel.idx === idx) {
    _swapSel = null;
    playUiClick();
    renderAll();
    return;
  }
  swapSlots(_swapSel, { area, idx });
  _swapSel = null;
  playInventorySelect();
  renderAll();
}

function getSlot(inv: InventoryState, ref: { area: 'hotbar' | 'backpack'; idx: number }): Slot {
  return ref.area === 'hotbar' ? inv.slots[ref.idx] : inv.backpack[ref.idx];
}

function swapSlots(
  a: { area: 'hotbar' | 'backpack'; idx: number },
  b: { area: 'hotbar' | 'backpack'; idx: number },
): void {
  if (!_ctx) return;
  const inv = _ctx.inventory;
  const sa = getSlot(inv, a);
  const sb = getSlot(inv, b);
  // Swap contents in place — we keep the slot object identity for outside refs.
  const tmpItem = sa.item;
  const tmpCount = sa.count;
  const tmpMeta = sa.meta;
  sa.item = sb.item; sa.count = sb.count;
  if (sb.meta) sa.meta = sb.meta; else delete sa.meta;
  sb.item = tmpItem; sb.count = tmpCount;
  if (tmpMeta) sb.meta = tmpMeta; else delete sb.meta;
}

function renderTile(refs: TileRefs, slot: Slot, isSwapSel: boolean): void {
  clearChildren(refs.glyph);
  refs.count.textContent = '';
  refs.fill.style.display = 'none';
  refs.root.classList.toggle('swap-selected', isSwapSel);
  if (!slot.item) {
    refs.root.classList.add('empty');
    return;
  }
  refs.root.classList.remove('empty');
  const def = getItemDef(slot.item);
  if (def.makeIcon) refs.glyph.appendChild(def.makeIcon());
  else refs.glyph.textContent = def.glyph;
  if (def.stackable && slot.count > 1) refs.count.textContent = `×${slot.count}`;
  // Canteen fill bar
  if (slot.item === 'canteen') {
    const fill = slot.meta?.fillLevel ?? 1;
    refs.fill.style.display = '';
    refs.fill.style.width = `${fill * 100}%`;
  }
}

function renderAll(): void {
  if (!_ctx) return;
  const inv = _ctx.inventory;
  for (let i = 0; i < _hotbarTiles.length; i++) {
    const isSel = !!_swapSel && _swapSel.area === 'hotbar' && _swapSel.idx === i;
    renderTile(_hotbarTiles[i], inv.slots[i], isSel);
  }
  for (let i = 0; i < _backpackTiles.length; i++) {
    const isSel = !!_swapSel && _swapSel.area === 'backpack' && _swapSel.idx === i;
    renderTile(_backpackTiles[i], inv.backpack[i], isSel);
  }
}

export function createInventoryOverlay(ctx: GameContext): void {
  _ctx = ctx;
  const root = document.createElement('div');
  root.id = 'inventory-overlay';
  root.className = 'overlay hidden';

  const title = document.createElement('div');
  title.className = 'title small';
  title.textContent = 'INVENTORY';
  root.appendChild(title);

  // Hotbar section
  const hotbarLabel = document.createElement('div');
  hotbarLabel.className = 'inv-section-label';
  hotbarLabel.textContent = 'hotbar';
  root.appendChild(hotbarLabel);

  const hotbarGrid = document.createElement('div');
  hotbarGrid.className = 'inv-grid inv-grid-hotbar';
  for (let i = 0; i < ctx.inventory.slots.length; i++) {
    const tile = buildTile('hotbar', i);
    _hotbarTiles.push(tile);
    hotbarGrid.appendChild(tile.root);
  }
  root.appendChild(hotbarGrid);

  // Backpack section
  const backpackLabel = document.createElement('div');
  backpackLabel.className = 'inv-section-label';
  backpackLabel.textContent = 'backpack';
  root.appendChild(backpackLabel);

  const backpackGrid = document.createElement('div');
  backpackGrid.className = 'inv-grid inv-grid-backpack';
  for (let i = 0; i < ctx.inventory.backpack.length; i++) {
    const tile = buildTile('backpack', i);
    _backpackTiles.push(tile);
    backpackGrid.appendChild(tile.root);
  }
  root.appendChild(backpackGrid);

  const closeBtn = document.createElement('button');
  closeBtn.className = 'menu-btn';
  closeBtn.textContent = 'close';
  closeBtn.addEventListener('mouseenter', playUiHover);
  closeBtn.addEventListener('click', () => { playUiClick(); closeInventoryOverlay(); });
  root.appendChild(closeBtn);

  document.body.appendChild(root);
  _root = root;
}

export function openInventoryOverlay(ctx: GameContext): void {
  if (!_root || _open) return;
  _open = true;
  _swapSel = null;
  ctx.input.controls.unlock();
  renderAll();
  _root.classList.remove('hidden');
}

export function closeInventoryOverlay(): void {
  if (!_root) return;
  _root.classList.add('hidden');
  _open = false;
  _swapSel = null;
  resumeFromPause();
}

export function isInventoryOverlayOpen(): boolean {
  return _open;
}
