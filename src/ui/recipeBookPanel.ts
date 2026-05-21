// Session AAA — recipe book panel. Closes the TT deferred stretch
// goal of "let players see what they've discovered" — pre-AAA, the
// combine-to-discover system only surfaced recipes the player tried
// in the crafting input slots. The book is a TAB-key modal listing
// every entry in ctx.inventory.discoveredRecipes with input icons,
// arrow, and output icon — sorted by recipe id.
//
// Pattern: mirrors the controls panel + journal panel (overlay-style
// modal, pauses gameplay via the existing overlay-gate, closes on TAB
// toggle / Esc / close button).

import type { GameContext } from '../GameContext.ts';
import { RECIPES, findRecipeById, type Recipe } from '../inventory/recipeDiscovery.ts';
import { getItemDef } from '../inventory/items.ts';
import { playUiHover, playUiClick } from '../audio/audio.ts';

let _ctx: GameContext | null = null;
let _panel: HTMLDivElement | null = null;
let _rowsEl: HTMLDivElement | null = null;
let _open = false;

function buildRow(recipe: Recipe): HTMLDivElement {
  const row = document.createElement('div');
  row.className = 'craft-row';   // reuse crafting-menu row style

  // Output icon (leftmost — emphasized)
  const outDef = getItemDef(recipe.output.id);
  const outIcon = document.createElement('div');
  outIcon.className = 'craft-result-icon';
  if (outDef.makeIcon) outIcon.appendChild(outDef.makeIcon());
  else outIcon.textContent = outDef.glyph;
  row.appendChild(outIcon);

  // Output name
  const outName = document.createElement('div');
  outName.className = 'craft-result-name';
  const count = recipe.output.count > 1 ? ` ×${recipe.output.count}` : '';
  outName.textContent = `${outDef.name.toLowerCase()}${count}`;
  row.appendChild(outName);

  // Arrow ← (recipe-book reads "output FROM inputs", reversed vs. crafting menu)
  const arrow = document.createElement('div');
  arrow.className = 'craft-arrow';
  arrow.textContent = '←';
  row.appendChild(arrow);

  // Input ingredients
  const ings = document.createElement('div');
  ings.className = 'craft-ingredients';
  for (const input of recipe.inputs) {
    const def = getItemDef(input.id);
    const ing = document.createElement('div');
    ing.className = 'craft-ing';
    const icon = document.createElement('div');
    icon.className = 'craft-ing-icon';
    if (def.makeIcon) icon.appendChild(def.makeIcon());
    else icon.textContent = def.glyph;
    ing.appendChild(icon);
    const label = document.createElement('span');
    label.className = 'craft-ing-label';
    label.textContent = input.count > 1 ? `×${input.count}` : '';
    ing.appendChild(label);
    ings.appendChild(ing);
  }
  row.appendChild(ings);

  return row;
}

function buildPanel(ctx: GameContext): HTMLDivElement {
  const panel = document.createElement('div');
  panel.id = 'recipe-book-panel';
  panel.className = 'overlay hidden';

  const title = document.createElement('div');
  title.className = 'title small';
  title.textContent = 'RECIPES';
  panel.appendChild(title);

  const subtitle = document.createElement('div');
  subtitle.className = 'subtitle';
  subtitle.textContent = 'what you have figured out so far';
  panel.appendChild(subtitle);

  const rows = document.createElement('div');
  rows.className = 'craft-rows';
  panel.appendChild(rows);
  _rowsEl = rows;

  const closeBtn = document.createElement('button');
  closeBtn.className = 'menu-btn';
  closeBtn.textContent = 'close';
  closeBtn.addEventListener('mouseenter', playUiHover);
  closeBtn.addEventListener('click', () => {
    playUiClick();
    closeRecipeBookPanel(ctx);
  });
  panel.appendChild(closeBtn);

  return panel;
}

function refreshRows(ctx: GameContext): void {
  if (!_rowsEl) return;
  _rowsEl.replaceChildren();
  const discovered = ctx.inventory.discoveredRecipes;
  if (discovered.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'craft-result-name';
    empty.style.opacity = '0.5';
    empty.style.textAlign = 'center';
    empty.style.padding = '24px 0';
    empty.textContent = '(no recipes discovered yet — try combining items via C)';
    _rowsEl.appendChild(empty);
    return;
  }
  // Sort by recipe id (ascending) so the order is stable as new recipes
  // get discovered.
  const sorted = [...discovered].sort((a, b) => a - b);
  for (const id of sorted) {
    const recipe = findRecipeById(id);
    if (!recipe) continue;   // tombstoned/retired recipe id; skip silently
    _rowsEl.appendChild(buildRow(recipe));
  }
}

export function createRecipeBookPanel(ctx: GameContext): void {
  _ctx = ctx;
  _panel = buildPanel(ctx);
  document.body.appendChild(_panel);
}

export function openRecipeBookPanel(ctx: GameContext): void {
  if (!_panel) return;
  refreshRows(ctx);
  _panel.classList.remove('hidden');
  _open = true;
  if (ctx.flags.started && !ctx.stats.dead) {
    ctx.input.controls.unlock();
  }
}

export function closeRecipeBookPanel(ctx: GameContext): void {
  if (!_panel) return;
  _panel.classList.add('hidden');
  _open = false;
  if (ctx.flags.started && !ctx.stats.dead) {
    void import('./menus.ts').then((m) => m.resumeFromPause());
  }
}

export function isRecipeBookPanelOpen(): boolean {
  return _open;
}

// Silence unused-import warning on _ctx (kept for symmetry with other panels).
void _ctx;

// Total recipe count (for display purposes if we want "X of Y discovered" later)
export function totalRecipeCount(): number {
  return RECIPES.length;
}
