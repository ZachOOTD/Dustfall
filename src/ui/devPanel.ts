// ACAD — dev item spawner. A DOM panel (DEV MODE only) listing every item in
// the game; click one to add it to your inventory. Toggled by clicking the
// [ DEV MODE ] badge. Built once at boot; gated to devMode by the badge handler.
//
// Mirrors the inventoryOverlay lifecycle: unlock the pointer on open so the
// cursor is free to click, resumeFromPause() on close to re-lock. Per CLAUDE
// rule 6, the DOM is built with createElement + textContent (no innerHTML).

import * as THREE from 'three';
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

const _scratchDir = new THREE.Vector3();

function toast(msg: string): void {
  _ctx?.ui.showToast(msg);
}

/** Spawn a raider ~20m ahead of where the camera looks (so you see it engage). */
function spawnRaiderAhead(): void {
  if (!_ctx) return;
  const tr = _ctx.player.body.body.translation();
  _ctx.three.camera.getWorldDirection(_scratchDir);
  const x = tr.x + _scratchDir.x * 20, z = tr.z + _scratchDir.z * 20;
  window.__game?.spawnRaider(x, z);
  toast('raider spawned ahead');
}

/** A row of grouped action buttons wired to the window.__game dev hooks. */
function makeActionsSection(): HTMLDivElement {
  const sec = document.createElement('div');
  sec.style.cssText =
    'display:flex;flex-direction:column;gap:5px;margin:4px 0;padding:7px;' +
    'border:1px solid rgba(255,255,255,0.14);border-radius:4px;';
  const hdr = document.createElement('div');
  hdr.textContent = 'ACTIONS · TEST';
  hdr.style.cssText = 'font-size:10px;letter-spacing:1px;opacity:0.6;';
  sec.appendChild(hdr);

  const group = (label: string, btns: Array<[string, () => void]>): void => {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:5px;flex-wrap:wrap;';
    const l = document.createElement('span');
    l.textContent = label;
    l.style.cssText = 'font-size:10px;opacity:0.55;width:58px;flex:none;';
    row.appendChild(l);
    for (const [text, fn] of btns) {
      const b = document.createElement('button');
      b.textContent = text;
      b.style.cssText =
        'font-size:11px;padding:3px 8px;cursor:pointer;color:inherit;' +
        'background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.2);border-radius:3px;';
      b.addEventListener('mouseenter', playUiHover);
      b.addEventListener('click', () => { playUiClick(); fn(); });
      row.appendChild(b);
    }
    sec.appendChild(row);
  };
  const g = () => window.__game;

  group('time', [
    ['dawn', () => { g()?.setTime(0.24); toast('time → dawn'); }],
    ['noon', () => { g()?.setTime(0.5); toast('time → noon'); }],
    ['dusk', () => { g()?.setTime(0.7); toast('time → dusk'); }],
    ['night', () => { g()?.setTime(0.0); toast('time → night'); }],
  ]);
  group('weather', [
    ['storm', () => { g()?.triggerStorm(); toast('sandstorm incoming'); }],
    ['cloudy', () => { g()?.setCloudiness(0.85); toast('clouding over'); }],
    ['clear', () => { g()?.setCloudiness(0.04); toast('skies clear'); }],
  ]);
  group('events', [
    ['crash', () => { g()?.triggerCrash(); toast('incoming — a wreck is falling!'); }],
    ['worm sweep', () => { g()?.triggerWormCrossing(); toast('worm crossing — scan the horizon'); }],
  ]);
  group('spawn', [
    ['fire', () => { g()?.spawnFire(); toast('fire lit ahead'); }],
    ['raider', () => spawnRaiderAhead()],
  ]);
  // Review (2026-07-14) — one-click reach for the overnight batch + the new biome.
  group('review', [
    ['skyfall', () => { g()?.spawnSkyfall(); }],
    ['new POIs', () => { g()?.spawnNewPois(); }],
    ['boneyard', () => { g()?.gotoBoneField(); }],
    // Deep Desert review (2026-07-19) — one-click reach for the mega-dune erg.
    ['dune sea', () => { g()?.gotoErg(); }],
    ['spawn sled', () => { g()?.spawnSled(); toast('sled dropped ahead'); }],
  ]);
  group('stats', [
    ['full', () => { g()?.setStats({ thirst: 1, hunger: 1, stamina: 1, health: 1, temperature: 0 }); toast('stats restored'); }],
    ['hurt', () => { g()?.setStats({ health: 0.25 }); toast('health → 25%'); }],
    ['thirsty', () => { g()?.setStats({ thirst: 0.12 }); toast('thirst low'); }],
    ['overheat', () => { g()?.setStats({ temperature: 0.92 }); toast('overheating'); }],
  ]);
  return sec;
}

export function createDevItemPanel(ctx: GameContext): void {
  _ctx = ctx;
  const root = document.createElement('div');
  root.id = 'dev-item-panel';
  root.className = 'overlay hidden';

  const title = document.createElement('div');
  title.className = 'title small';
  title.textContent = 'DEV PANEL · F8 / `';
  root.appendChild(title);

  // C36 f/u — clickable action hooks (was console-only) so the walk-test can poke
  // the world from the panel. Buttons call window.__game.* (the same dev hooks).
  root.appendChild(makeActionsSection());

  const itemHdr = document.createElement('div');
  itemHdr.textContent = 'SPAWN ITEM';
  itemHdr.style.cssText = 'font-size:10px;letter-spacing:1px;opacity:0.6;margin:8px 0 2px;';
  root.appendChild(itemHdr);

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
  // Flag BEFORE unlock() — the input.ts 'unlock' handler reads it synchronously
  // to skip the pause overlay, so the cursor frees over the LIVE game instead of
  // behind the pause menu (which used to sit on top and eat the dev clicks).
  ctx.flags.devPanelOpen = true;
  ctx.input.controls.unlock();
  if (_searchInput) { _searchInput.value = ''; applyFilter(''); }
  _root.classList.remove('hidden');
}

export function closeDevItemPanel(): void {
  if (!_root || !_open) return;
  _root.classList.add('hidden');
  _open = false;
  if (_ctx) _ctx.flags.devPanelOpen = false;
  // resumeFromPause() re-locks the pointer (cursor away, back to gameplay) — the
  // "F8-again / Close hides the cursor" behaviour. Pause was suppressed on open,
  // so this just re-locks.
  resumeFromPause();
}

export function toggleDevItemPanel(ctx: GameContext): void {
  if (_open) closeDevItemPanel();
  else openDevItemPanel(ctx);
}

export function isDevItemPanelOpen(): boolean {
  return _open;
}
