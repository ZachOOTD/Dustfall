// Crafting menu — opens on C. Lists recipes; each row shows the result
// + the ingredients with current counts. Insufficient recipes are grayed.
// Click → consume ingredients + add result + play craft sound.

import type { GameContext } from '../GameContext.ts';
import type { ItemId } from '../inventory/types.ts';
import { addItem, countItems, removeItems } from '../inventory/inventory.ts';
import { getItemDef } from '../inventory/items.ts';
import { playCraft, playUiClick, playUiHover } from '../audio/audio.ts';
import { resumeFromPause } from './menus.ts';

interface Recipe {
  result: ItemId;
  resultCount: number;
  ingredients: Array<{ id: ItemId; count: number }>;
}

const RECIPES: Recipe[] = [
  {
    result: 'bandage',
    resultCount: 1,
    ingredients: [
      { id: 'cloth', count: 1 },
      { id: 'scrap', count: 1 },
    ],
  },
  {
    result: 'fire_kit',
    resultCount: 1,
    ingredients: [
      { id: 'branch', count: 3 },
      { id: 'scrap', count: 1 },
    ],
  },
  {
    result: 'tent_kit',
    resultCount: 1,
    ingredients: [
      { id: 'cloth', count: 3 },
      { id: 'branch', count: 2 },
    ],
  },
  // Session AA — light sources for night exploration.
  {
    result: 'torch',
    resultCount: 1,
    ingredients: [
      { id: 'branch', count: 1 },
      { id: 'cloth', count: 1 },
    ],
  },
  {
    result: 'flashlight',
    resultCount: 1,
    ingredients: [
      { id: 'scrap', count: 2 },
      { id: 'cloth', count: 1 },
    ],
  },
  // II — combine a branch + raw meat into a wielded skewer; held near a
  // fire it auto-cooks (updateHeld hook on the raw skewer).
  {
    result: 'lizard_on_a_stick_raw',
    resultCount: 1,
    ingredients: [
      { id: 'branch', count: 1 },
      { id: 'raw_lizard_meat', count: 1 },
    ],
  },
  // PP — ammo crafting. 1 scrap → 2 scrap_bullets so the scrap_gun
  // stays viable through extended play. Bullets are loaded into the
  // gun by holding the gun + pressing E on a scrap_bullet stack
  // (handled by scrap_bullet's onUse hook).
  {
    result: 'scrap_bullet',
    resultCount: 2,
    ingredients: [
      { id: 'scrap', count: 1 },
    ],
  },
  // QQ — rope: wielded item used to tow a sled.
  {
    result: 'rope',
    resultCount: 1,
    ingredients: [
      { id: 'cloth', count: 2 },
      { id: 'branch', count: 1 },
    ],
  },
  // QQ — sled kit: deploys a flatbed cargo sled. One rope is consumed
  // in the kit; player still needs a separate rope to tow.
  {
    result: 'sled_kit',
    resultCount: 1,
    ingredients: [
      { id: 'scrap', count: 2 },
      { id: 'branch', count: 1 },
      { id: 'rope', count: 1 },
    ],
  },
];

let _root: HTMLDivElement | null = null;
let _rowsContainer: HTMLDivElement | null = null;
let _ctx: GameContext | null = null;
let _open = false;
const CRAFT_DURATION = 1.0;
let _crafting: {
  recipeIdx: number;
  startedAt: number;       // performance.now() / 1000
  progressEl: HTMLDivElement | null;
  rafId: number;
} | null = null;

function makeBtn(label: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.className = 'menu-btn';
  b.textContent = label;
  b.addEventListener('mouseenter', playUiHover);
  b.addEventListener('click', () => { playUiClick(); onClick(); });
  return b;
}

export function createCraftingMenu(ctx: GameContext): void {
  _ctx = ctx;
  const root = document.createElement('div');
  root.id = 'crafting-menu';
  root.className = 'overlay hidden';

  const title = document.createElement('div');
  title.className = 'title small';
  title.textContent = 'CRAFT';
  root.appendChild(title);

  const rows = document.createElement('div');
  rows.className = 'craft-rows';
  root.appendChild(rows);
  _rowsContainer = rows;

  root.appendChild(makeBtn('close', closeCraftingMenu));
  document.body.appendChild(root);
  _root = root;
}

function renderRows(): void {
  if (!_rowsContainer || !_ctx) return;
  while (_rowsContainer.firstChild) _rowsContainer.removeChild(_rowsContainer.firstChild);

  const ctx = _ctx;
  for (let i = 0; i < RECIPES.length; i++) {
    const r = RECIPES[i];
    const resultDef = getItemDef(r.result);

    // Check ingredient availability
    let canCraft = true;
    for (const ing of r.ingredients) {
      if (countItems(ctx.inventory, ing.id) < ing.count) {
        canCraft = false;
        break;
      }
    }
    // While crafting, all rows are temporarily uninteractable.
    const blockedByCraft = _crafting !== null && _crafting.recipeIdx !== i;
    const isThisCrafting = _crafting !== null && _crafting.recipeIdx === i;
    const interactable = canCraft && !blockedByCraft && !isThisCrafting;

    const row = document.createElement('button');
    row.className = 'craft-row' + (interactable ? '' : ' insufficient');
    row.disabled = !interactable;
    row.addEventListener('mouseenter', playUiHover);

    // Result icon
    const iconBox = document.createElement('div');
    iconBox.className = 'craft-result-icon';
    if (resultDef.makeIcon) iconBox.appendChild(resultDef.makeIcon());
    row.appendChild(iconBox);

    // Result name
    const name = document.createElement('div');
    name.className = 'craft-result-name';
    name.textContent = resultDef.name + (r.resultCount > 1 ? ` ×${r.resultCount}` : '');
    row.appendChild(name);

    // Arrow
    const arrow = document.createElement('div');
    arrow.className = 'craft-arrow';
    arrow.textContent = '←';
    row.appendChild(arrow);

    // Ingredient list
    const ingBox = document.createElement('div');
    ingBox.className = 'craft-ingredients';
    for (const ing of r.ingredients) {
      const ingDef = getItemDef(ing.id);
      const have = countItems(ctx.inventory, ing.id);
      const ingRow = document.createElement('div');
      ingRow.className = 'craft-ing' + (have >= ing.count ? '' : ' missing');
      const ingIcon = document.createElement('div');
      ingIcon.className = 'craft-ing-icon';
      if (ingDef.makeIcon) ingIcon.appendChild(ingDef.makeIcon());
      ingRow.appendChild(ingIcon);
      const ingLabel = document.createElement('div');
      ingLabel.className = 'craft-ing-label';
      ingLabel.textContent = `${have}/${ing.count}`;
      ingRow.appendChild(ingLabel);
      ingBox.appendChild(ingRow);
    }
    row.appendChild(ingBox);

    // Progress fill — only the in-progress row has it; others have a placeholder.
    if (isThisCrafting) {
      const prog = document.createElement('div');
      prog.className = 'craft-progress';
      prog.style.width = '0%';
      row.appendChild(prog);
      // Reattach the live element reference so the rAF loop can write into it.
      if (_crafting) _crafting.progressEl = prog;
    }

    if (interactable) {
      row.addEventListener('click', () => startCraft(i));
    }
    _rowsContainer.appendChild(row);
  }
}

function startCraft(recipeIdx: number): void {
  if (!_ctx || _crafting) return;
  const ctx = _ctx;
  const recipe = RECIPES[recipeIdx];
  // Re-check ingredients up front (state may have changed since render).
  for (const ing of recipe.ingredients) {
    if (countItems(ctx.inventory, ing.id) < ing.count) {
      ctx.ui.showToast('not enough materials');
      renderRows();
      return;
    }
  }
  playUiClick();
  _crafting = {
    recipeIdx,
    startedAt: performance.now() / 1000,
    progressEl: null,
    rafId: 0,
  };
  renderRows();
  // Drive the bar via rAF until done; cancel on close.
  const tick = (): void => {
    if (!_crafting) return;
    const elapsed = performance.now() / 1000 - _crafting.startedAt;
    const p = Math.min(1, elapsed / CRAFT_DURATION);
    if (_crafting.progressEl) _crafting.progressEl.style.width = `${p * 100}%`;
    if (p >= 1) {
      completeCraft();
      return;
    }
    _crafting.rafId = requestAnimationFrame(tick);
  };
  _crafting.rafId = requestAnimationFrame(tick);
}

function completeCraft(): void {
  if (!_ctx || !_crafting) return;
  const ctx = _ctx;
  const recipe = RECIPES[_crafting.recipeIdx];
  _crafting = null;

  // Final re-check (ingredients could have been dropped or used mid-craft).
  for (const ing of recipe.ingredients) {
    if (countItems(ctx.inventory, ing.id) < ing.count) {
      ctx.ui.showToast('materials are gone');
      renderRows();
      return;
    }
  }
  for (const ing of recipe.ingredients) removeItems(ctx.inventory, ing.id, ing.count);

  let added = 0;
  for (let i = 0; i < recipe.resultCount; i++) {
    const slotIdx = addItem(ctx.inventory, recipe.result, undefined, ctx);
    if (slotIdx < 0) break;
    added++;
  }
  if (added === 0) {
    ctx.ui.showToast('no room for the result');
    renderRows();
    return;
  }
  playCraft();
  ctx.ui.showToast(`crafted ${getItemDef(recipe.result).name.toLowerCase()}`);
  renderRows();
}

function cancelCraft(): void {
  if (!_crafting) return;
  if (_crafting.rafId) cancelAnimationFrame(_crafting.rafId);
  _crafting = null;
}

export function openCraftingMenu(ctx: GameContext): void {
  if (!_root || _open) return;
  _open = true;
  ctx.input.controls.unlock();
  renderRows();
  _root.classList.remove('hidden');
}

export function closeCraftingMenu(): void {
  if (!_root) return;
  cancelCraft();
  _root.classList.add('hidden');
  _open = false;
  resumeFromPause();
}

export function isCraftingMenuOpen(): boolean {
  return _open;
}
