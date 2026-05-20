// Loot menu — overlay shown when the player opens a searchable wreckage.
// Lists the contents as clickable rows; clicking transfers to inventory.
// Pauses the game while open. Close re-locks pointer and resumes.

import type { GameContext } from '../GameContext.ts';
import type { LootEntry } from '../world/lootContainers.ts';
import { getItemDef } from '../inventory/items.ts';
import { addItem } from '../inventory/inventory.ts';
import { playPickup, playUiClick, playUiHover } from '../audio/audio.ts';
import { resumeFromPause } from './menus.ts';

/** Structural type — both LootContainer (wreckage) and Sled (Session QQ)
 *  satisfy this, so the menu can render either without knowing which is
 *  open. Optional `title` lets the sled show "SLED CARGO" while loot
 *  containers default to "WRECKAGE". */
export interface OpenContainer {
  id: number;
  contents: LootEntry[];
  opened: boolean;
  title?: string;
}

let _root: HTMLDivElement | null = null;
let _titleEl: HTMLDivElement | null = null;
let _rowsContainer: HTMLDivElement | null = null;
let _emptyLabel: HTMLDivElement | null = null;
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

  const rows = document.createElement('div');
  rows.className = 'loot-rows';
  root.appendChild(rows);
  _rowsContainer = rows;

  const empty = document.createElement('div');
  empty.className = 'subtitle';
  empty.style.opacity = '0.6';
  empty.textContent = 'nothing left';
  empty.style.display = 'none';
  root.appendChild(empty);
  _emptyLabel = empty;

  root.appendChild(makeCloseBtn('close', closeLootMenu));

  document.body.appendChild(root);
  _root = root;
}

function renderRows(): void {
  if (!_rowsContainer || !_current || !_emptyLabel) return;
  while (_rowsContainer.firstChild) _rowsContainer.removeChild(_rowsContainer.firstChild);

  if (_current.contents.length === 0) {
    _emptyLabel.style.display = '';
    return;
  }
  _emptyLabel.style.display = 'none';

  for (let i = 0; i < _current.contents.length; i++) {
    const entry = _current.contents[i];
    const def = getItemDef(entry.itemId);
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
    name.textContent = def.name + (entry.count > 1 ? ` ×${entry.count}` : '');
    row.appendChild(name);

    // Optional: show meta (e.g., canteen fill)
    if (entry.meta?.fillLevel !== undefined) {
      const meta = document.createElement('div');
      meta.className = 'loot-meta';
      meta.textContent = `${Math.round(entry.meta.fillLevel * 100)}% full`;
      row.appendChild(meta);
    }

    row.addEventListener('click', () => takeRow(i, entry));
    _rowsContainer.appendChild(row);
  }
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
