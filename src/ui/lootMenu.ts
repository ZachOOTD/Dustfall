// Loot menu — overlay shown when the player opens a searchable wreckage.
// Lists the contents as clickable rows; clicking transfers to inventory.
// Pauses the game while open. Close re-locks pointer and resumes.

import type { GameContext } from '../GameContext.ts';
import type { LootEntry } from '../world/lootContainers.ts';
import type { Slot, ItemId, ItemMeta } from '../inventory/types.ts';
import { getItemDef } from '../inventory/items.ts';
import { addItem } from '../inventory/inventory.ts';
import { playPickup, playUiClick, playUiHover } from '../audio/audio.ts';
import { resumeFromPause } from './menus.ts';

/** Structural type — both LootContainer (wreckage) and Sled (Session QQ)
 *  satisfy this, so the menu can render either without knowing which is
 *  open. Optional `title` lets the sled show "SLED CARGO" while loot
 *  containers default to "WRECKAGE". `allowDeposit` enables the
 *  bidirectional sled mode — adds a second column listing the
 *  player's inventory; clicks deposit items into `contents`. */
export interface OpenContainer {
  id: number;
  contents: LootEntry[];
  opened: boolean;
  title?: string;
  allowDeposit?: boolean;
}

let _root: HTMLDivElement | null = null;
let _titleEl: HTMLDivElement | null = null;
let _cargoHeader: HTMLDivElement | null = null;
let _rowsContainer: HTMLDivElement | null = null;
let _emptyLabel: HTMLDivElement | null = null;
let _bagColumn: HTMLDivElement | null = null;
let _bagRowsContainer: HTMLDivElement | null = null;
let _ctx: GameContext | null = null;
let _current: OpenContainer | null = null;

function makeCloseBtn(label: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.className = 'menu-btn';
  b.textContent = label;
  b.addEventListener('mouseenter', playUiHover);
  b.addEventListener('click', () => { playUiClick(); onClick(); });
  return b;
}

export function createLootMenu(ctx: GameContext): void {
  _ctx = ctx;
  const root = document.createElement('div');
  root.id = 'loot-menu';
  root.className = 'overlay hidden';

  const title = document.createElement('div');
  title.className = 'title small';
  title.textContent = 'WRECKAGE';
  root.appendChild(title);
  _titleEl = title;

  // Two-column wrapper. Single-column (default) loot containers only
  // populate the cargo column; sleds (allowDeposit=true) also populate
  // the bag column.
  const columns = document.createElement('div');
  columns.className = 'loot-columns';
  root.appendChild(columns);

  // ── Cargo column (left) ──
  const cargoCol = document.createElement('div');
  cargoCol.className = 'loot-column';
  columns.appendChild(cargoCol);

  const cargoHeader = document.createElement('div');
  cargoHeader.className = 'loot-col-header';
  cargoHeader.textContent = 'CARGO';
  cargoHeader.style.display = 'none';
  cargoCol.appendChild(cargoHeader);
  _cargoHeader = cargoHeader;

  const rows = document.createElement('div');
  rows.className = 'loot-rows';
  cargoCol.appendChild(rows);
  _rowsContainer = rows;

  const empty = document.createElement('div');
  empty.className = 'subtitle';
  empty.style.opacity = '0.6';
  empty.textContent = 'nothing left';
  empty.style.display = 'none';
  cargoCol.appendChild(empty);
  _emptyLabel = empty;

  // ── Player-inventory column (right, only shown when allowDeposit) ──
  const bagCol = document.createElement('div');
  bagCol.className = 'loot-column';
  bagCol.style.display = 'none';
  columns.appendChild(bagCol);
  _bagColumn = bagCol;

  const bagHeader = document.createElement('div');
  bagHeader.className = 'loot-col-header';
  bagHeader.textContent = 'YOU';
  bagCol.appendChild(bagHeader);

  const bagRows = document.createElement('div');
  bagRows.className = 'loot-rows';
  bagCol.appendChild(bagRows);
  _bagRowsContainer = bagRows;

  root.appendChild(makeCloseBtn('close', closeLootMenu));

  document.body.appendChild(root);
  _root = root;
}

/** Build a single row matching the visual style: icon + name (with count
 *  suffix) + optional meta. Returns the button so the caller can attach
 *  its own click handler. */
function makeRow(itemId: ItemId, count: number, meta: ItemMeta | undefined): HTMLButtonElement {
  const def = getItemDef(itemId);
  const row = document.createElement('button');
  row.className = 'loot-row';
  row.addEventListener('mouseenter', playUiHover);

  const iconBox = document.createElement('div');
  iconBox.className = 'loot-icon';
  if (def.makeIcon) iconBox.appendChild(def.makeIcon());
  else iconBox.textContent = def.glyph;
  row.appendChild(iconBox);

  const name = document.createElement('div');
  name.className = 'loot-name';
  name.textContent = def.name + (count > 1 ? ` ×${count}` : '');
  row.appendChild(name);

  if (meta?.fillLevel !== undefined) {
    const metaEl = document.createElement('div');
    metaEl.className = 'loot-meta';
    metaEl.textContent = `${Math.round(meta.fillLevel * 100)}% full`;
    row.appendChild(metaEl);
  }
  return row;
}

function renderRows(): void {
  if (!_rowsContainer || !_current || !_emptyLabel) return;
  // ── Cargo column ──
  while (_rowsContainer.firstChild) _rowsContainer.removeChild(_rowsContainer.firstChild);
  if (_current.contents.length === 0) {
    _emptyLabel.style.display = '';
  } else {
    _emptyLabel.style.display = 'none';
    for (let i = 0; i < _current.contents.length; i++) {
      const entry = _current.contents[i];
      const row = makeRow(entry.itemId, entry.count, entry.meta);
      row.addEventListener('click', () => takeRow(i, entry));
      _rowsContainer.appendChild(row);
    }
  }
  // ── Player-inventory column (only in deposit mode) ──
  if (_current.allowDeposit) renderInventoryColumn();
}

/** Render the player's hotbar + backpack as deposit-clickable rows.
 *  Only invoked when `_current.allowDeposit` is true. */
function renderInventoryColumn(): void {
  if (!_bagRowsContainer || !_ctx) return;
  while (_bagRowsContainer.firstChild) _bagRowsContainer.removeChild(_bagRowsContainer.firstChild);

  const inv = _ctx.inventory;
  // Iterate hotbar then backpack — pass each slot's ref so the click
  // handler can clear the slot when it deposits.
  const allSlots: Slot[] = [...inv.slots, ...inv.backpack];
  let any = false;
  for (const slot of allSlots) {
    if (!slot.item || slot.count <= 0) continue;
    any = true;
    const row = makeRow(slot.item, slot.count, slot.meta);
    row.addEventListener('click', () => depositSlot(slot));
    _bagRowsContainer.appendChild(row);
  }
  if (!any) {
    const empty = document.createElement('div');
    empty.className = 'subtitle';
    empty.style.opacity = '0.6';
    empty.textContent = 'your bag is empty';
    _bagRowsContainer.appendChild(empty);
  }
}

/** Move the contents of `slot` into `_current.contents`. For stackable
 *  meta-less items, merges with an existing matching entry; otherwise
 *  pushes a new entry. Whole stack moves at once. */
function depositSlot(slot: Slot): void {
  if (!_ctx || !_current) return;
  if (!slot.item || slot.count <= 0) return;
  const itemId = slot.item;
  const count = slot.count;
  const meta = slot.meta;
  if (meta === undefined) {
    // Meta-less stackable — merge with any existing entry of the same id
    // that's also meta-less.
    const existing = _current.contents.find((e) => e.itemId === itemId && !e.meta);
    if (existing) existing.count += count;
    else _current.contents.push({ itemId, count });
  } else {
    // Has meta (canteen fill, ammo, attached sled id, etc.) — never merge;
    // preserve the per-stack state.
    _current.contents.push({ itemId, count, meta: { ...meta } });
  }
  // Clear the source slot. (Slot is a reference into ctx.inventory.* — the
  // hotbar / backpack UIs read these refs each frame and will re-render.)
  slot.item = null;
  slot.count = 0;
  slot.meta = undefined;
  playUiClick();
  playPickup();
  renderRows();
}

function takeRow(idx: number, entry: LootEntry): void {
  if (!_ctx || !_current) return;
  const inv = _ctx.inventory;
  // For multi-count non-stackable items (machete), this is a single take.
  // For stackable items, take the whole count.
  let takenCount = 0;
  for (let i = 0; i < entry.count; i++) {
    const slotIdx = addItem(inv, entry.itemId, entry.meta, _ctx);
    if (slotIdx < 0) break;
    takenCount++;
  }
  if (takenCount === 0) {
    _ctx.ui.showToast('your bag is full');
    return;
  }
  playUiClick();
  playPickup();
  // Remove or decrement the entry
  if (takenCount >= entry.count) {
    _current.contents.splice(idx, 1);
  } else {
    entry.count -= takenCount;
  }
  renderRows();
}

export function openLootMenu(ctx: GameContext, container: OpenContainer): void {
  if (!_root) return;
  _current = container;
  container.opened = true;
  if (_titleEl) _titleEl.textContent = container.title ?? 'WRECKAGE';
  // Toggle the bag column + cargo header based on deposit mode. Loot
  // containers (no allowDeposit) keep the original single-column look.
  const showBag = !!container.allowDeposit;
  if (_bagColumn) _bagColumn.style.display = showBag ? '' : 'none';
  if (_cargoHeader) _cargoHeader.style.display = showBag ? '' : 'none';
  // Releasing pointer lock triggers the unlock handler → showPauseOverlay
  // → paused=true. The loot menu sits on top of the pause overlay (higher
  // z-index in CSS). closeLootMenu hides both and re-locks.
  ctx.input.controls.unlock();
  renderRows();
  _root.classList.remove('hidden');
}

export function closeLootMenu(): void {
  if (!_root || !_ctx) return;
  _root.classList.add('hidden');
  _current = null;
  // Hide pause overlay + re-lock pointer + paused=false
  resumeFromPause();
}

export function isLootMenuOpen(): boolean {
  return !!_root && !_root.classList.contains('hidden');
}
