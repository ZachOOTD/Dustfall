// ACAD — dev item spawner. A DOM panel (DEV MODE only) listing every item in
// the game; click one to add it to your inventory. Toggled by clicking the
// [ DEV MODE ] badge. Built once at boot; gated to devMode by the badge handler.
//
// Mirrors the inventoryOverlay lifecycle: unlock the pointer on open so the
// cursor is free to click, resumeFromPause() on close to re-lock. Per CLAUDE
// rule 6, the DOM is built with createElement + textContent (no innerHTML).

import type { GameContext } from '../GameContext.ts';
import type { ItemId } from '../inventory/types.ts';
import { getItemDef, ALL_REGISTERED_ITEM_IDS } from '../inventory/items.ts';
import { addItem } from '../inventory/inventory.ts';
import { playUiHover, playUiClick } from '../audio/audio.ts';
import { resumeFromPause } from './menus.ts';

let _root: HTMLDivElement | null = null;
let _ctx: GameContext | null = null;
let _open = false;
let _searchInput: HTMLInputElement | null = null;
const _rows: Array<{ el: HTMLButtonElement; label: string }> = [];

export function createDevItemPanel(ctx: GameContext): void {
  _ctx = ctx;
  const root = document.createElement('div');
  root.id = 'dev-item-panel';
  root.className = 'overlay hidden';

  const title = document.createElement('div');
  title.className = 'title small';
  title.textContent = 'DEV · SPAWN ITEM';
  root.appendChild(title);

  const search = document.createElement('input');
  search.type = 'text';
  search.placeholder = 'filter items…';
  search.className = 'dev-item-search';
  search.addEventListener('input', () => applyFilter(search.value));
  // Don't let the game's key handlers see typing (WASD etc.).
  search.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Escape') closeDevItemPanel();
  });
  root.appendChild(search);
  _searchInput = search;

  const list = document.createElement('div');
  list.className = 'dev-item-list';
  for (const id of ALL_REGISTERED_ITEM_IDS) {
    const def = getItemDef(id);
    const btn = document.createElement('button');
    btn.className = 'dev-item-btn';

    const glyph = document.createElement('span');
    glyph.className = 'dev-item-glyph';
    glyph.textContent = def.glyph ?? '?';

    const name = document.createElement('span');
    name.className = 'dev-item-name';
    name.textContent = def.name ?? id;

    const idLabel = document.createElement('span');
    idLabel.className = 'dev-item-id';
    idLabel.textContent = id;

    btn.append(glyph, name, idLabel);
    btn.addEventListener('mouseenter', playUiHover);
    btn.addEventListener('click', () => spawn(id));
    list.appendChild(btn);
    _rows.push({ el: btn, label: `${def.name ?? ''} ${id}`.toLowerCase() });
  }
  root.appendChild(list);

  const closeBtn = document.createElement('button');
  closeBtn.className = 'menu-btn';
  closeBtn.textContent = 'close';
  closeBtn.addEventListener('mouseenter', playUiHover);
  closeBtn.addEventListener('click', () => { playUiClick(); closeDevItemPanel(); });
  root.appendChild(closeBtn);

  document.body.appendChild(root);
  _root = root;
}

function applyFilter(q: string): void {
  const f = q.trim().toLowerCase();
  for (const r of _rows) r.el.style.display = !f || r.label.includes(f) ? '' : 'none';
}

function spawn(id: ItemId): void {
  if (!_ctx) return;
  playUiClick();
  const added = addItem(_ctx.inventory, id, undefined, _ctx);
  _ctx.ui.showToast(added > 0 ? `spawned ${id}` : `inventory full — couldn't add ${id}`);
}

export function openDevItemPanel(ctx: GameContext): void {
  if (!_root || _open) return;
  _open = true;
  ctx.input.controls.unlock();
  if (_searchInput) { _searchInput.value = ''; applyFilter(''); }
  _root.classList.remove('hidden');
}

export function closeDevItemPanel(): void {
  if (!_root || !_open) return;
  _root.classList.add('hidden');
  _open = false;
  resumeFromPause();
}

export function toggleDevItemPanel(ctx: GameContext): void {
  if (_open) closeDevItemPanel();
  else openDevItemPanel(ctx);
}

export function isDevItemPanelOpen(): boolean {
  return _open;
}
