// Crafting menu — opens on C. Session TT rewrite from explicit
// recipe-list UI to a **combine-to-discover** model:
//
//   - 4 input slots (multiset; order doesn't matter)
//   - 1 output preview slot
//   - CRAFT button
//   - Player inventory column (click to add to inputs)
//
// Output preview:
//   - empty inputs   → empty preview
//   - matches a discovered recipe → output icon + name
//   - matches an undiscovered recipe → "?" (unknown)
//   - matches multiple recipes → chooser (one button per match)
//   - no match → "nothing happens" indicator
//
// Click an input slot to remove 1 from it (returned to inventory on
// close + on individual remove). Clicking CRAFT consumes inputs +
// adds output + (if undiscovered) marks the recipe as known with a
// toast. None of the current 9 recipes overlap; the chooser exists
// for future recipes that might.

import type { GameContext } from '../GameContext.ts';
import type { ItemId, ItemMeta, Slot } from '../inventory/types.ts';
import { addItem, countItems, removeItems } from '../inventory/inventory.ts';
import { getItemDef } from '../inventory/items.ts';
import {
  RECIPES,
  matchRecipes,
  type Recipe,
  type RecipeInput,
} from '../inventory/recipeDiscovery.ts';
import { playCraft, playUiClick, playUiHover, playRecipeDiscovery } from '../audio/audio.ts';
import { resumeFromPause } from './menus.ts';

// ── Input-slot model. Each slot holds one ItemId + count. Meta is
// preserved on the slot but ignored by recipe matching — if the
// player drops a meta-bearing item (canteen, ammo'd gun) into an
// input, its meta is lost on craft. Reasonable footgun; no recipe
// currently consumes a meta-bearing item.
interface InputSlot {
  item: ItemId | null;
  count: number;
  meta?: ItemMeta;
}
const INPUT_SLOT_COUNT = 4;

let _root: HTMLDivElement | null = null;
let _inputsRow: HTMLDivElement | null = null;
let _outputSlotEl: HTMLDivElement | null = null;
let _outputLabelEl: HTMLDivElement | null = null;
let _chooserEl: HTMLDivElement | null = null;
let _craftBtn: HTMLButtonElement | null = null;
let _bagRowsEl: HTMLDivElement | null = null;
let _ctx: GameContext | null = null;
let _open = false;

// Mutable input slots (reset on open + close).
const _inputs: InputSlot[] = Array.from(
  { length: INPUT_SLOT_COUNT },
  () => ({ item: null, count: 0 }),
);

// When multiple recipes match the current inputs, the player picks
// one via the chooser. Until they pick, CRAFT is disabled and the
// preview shows the chooser.
let _selectedRecipe: Recipe | null = null;

// ── DOM helpers ──────────────────────────────────────────────────

function makeBtn(label: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.className = 'menu-btn';
  b.textContent = label;
  b.addEventListener('mouseenter', playUiHover);
  b.addEventListener('click', () => { playUiClick(); onClick(); });
  return b;
}

function clearChildren(el: HTMLElement): void {
  while (el.firstChild) el.removeChild(el.firstChild);
}

/** Build the icon-or-glyph element for a given item id. Standard
 *  pattern — defs may provide makeIcon() for SVG, else fall back to
 *  the single-char glyph. */
function makeItemIcon(itemId: ItemId): HTMLDivElement {
  const def = getItemDef(itemId);
  const box = document.createElement('div');
  box.className = 'craft-icon';
  if (def.makeIcon) box.appendChild(def.makeIcon());
  else box.textContent = def.glyph;
  return box;
}

// ── Construction ────────────────────────────────────────────────

export function createCraftingMenu(ctx: GameContext): void {
  _ctx = ctx;
  const root = document.createElement('div');
  root.id = 'crafting-menu';
  root.className = 'overlay hidden';

  const title = document.createElement('div');
  title.className = 'title small';
  title.textContent = 'CRAFT';
  root.appendChild(title);

  // ── Top combine row: [in1][in2][in3][in4]  →  [out] ──
  const combineRow = document.createElement('div');
  combineRow.className = 'craft-combine-row';
  root.appendChild(combineRow);

  const inputsRow = document.createElement('div');
  inputsRow.className = 'craft-inputs-row';
  combineRow.appendChild(inputsRow);
  _inputsRow = inputsRow;

  const arrow = document.createElement('div');
  arrow.className = 'craft-flow-arrow';
  arrow.textContent = '→';
  combineRow.appendChild(arrow);

  const outputSlot = document.createElement('div');
  outputSlot.className = 'craft-output-slot empty';
  combineRow.appendChild(outputSlot);
  _outputSlotEl = outputSlot;

  // Output label sits below the slot — name of the result, "?"
  // for unknown, or "nothing happens".
  const outputLabel = document.createElement('div');
  outputLabel.className = 'craft-output-label';
  outputLabel.textContent = '';
  root.appendChild(outputLabel);
  _outputLabelEl = outputLabel;

  // Chooser row for multi-match recipes (hidden when not needed).
  const chooser = document.createElement('div');
  chooser.className = 'craft-chooser hidden';
  root.appendChild(chooser);
  _chooserEl = chooser;

  // CRAFT button
  const craftBtn = makeBtn('craft', performCraft);
  craftBtn.classList.add('craft-go-btn');
  craftBtn.disabled = true;
  root.appendChild(craftBtn);
  _craftBtn = craftBtn;

  // ── Player inventory column ──
  const bagHeader = document.createElement('div');
  bagHeader.className = 'craft-col-header';
  bagHeader.textContent = 'YOUR BAG';
  root.appendChild(bagHeader);

  const bagRows = document.createElement('div');
  bagRows.className = 'craft-bag-rows';
  root.appendChild(bagRows);
  _bagRowsEl = bagRows;

  // Close button — returns any items still in input slots back to bag.
  root.appendChild(makeBtn('close', closeCraftingMenu));
  document.body.appendChild(root);
  _root = root;
}

// ── Rendering ────────────────────────────────────────────────────

function renderInputs(): void {
  if (!_inputsRow) return;
  clearChildren(_inputsRow);
  for (let i = 0; i < _inputs.length; i++) {
    const s = _inputs[i];
    const slot = document.createElement('button');
    slot.className = 'craft-input-slot' + (s.item ? '' : ' empty');
    if (s.item) {
      slot.appendChild(makeItemIcon(s.item));
      const count = document.createElement('div');
      count.className = 'craft-input-count';
      count.textContent = s.count > 1 ? `×${s.count}` : '';
      slot.appendChild(count);
      slot.addEventListener('mouseenter', playUiHover);
      slot.addEventListener('click', () => removeFromInput(i));
    }
    _inputsRow.appendChild(slot);
  }
}

function renderOutputPreview(): void {
  if (!_outputSlotEl || !_outputLabelEl || !_chooserEl || !_craftBtn) return;

  clearChildren(_outputSlotEl);
  clearChildren(_chooserEl);
  _chooserEl.classList.add('hidden');
  _outputSlotEl.classList.add('empty');
  _craftBtn.disabled = true;

  // Build the multiset from current input slots.
  const inputs: RecipeInput[] = [];
  const merged = new Map<ItemId, number>();
  for (const s of _inputs) {
    if (!s.item) continue;
    merged.set(s.item, (merged.get(s.item) ?? 0) + s.count);
  }
  if (merged.size === 0) {
    _outputLabelEl.textContent = '';
    _selectedRecipe = null;
    return;
  }
  for (const [id, count] of merged) inputs.push({ id, count });

  const matches = matchRecipes(inputs);
  if (matches.length === 0) {
    // No recipe — show "nothing happens" hint.
    _outputLabelEl.textContent = 'nothing happens';
    _selectedRecipe = null;
    return;
  }

  if (matches.length === 1) {
    // Single match — preview directly.
    _selectedRecipe = matches[0];
    showOutputForRecipe(_selectedRecipe);
    return;
  }

  // Multi-match — show chooser. Players must pick one before
  // CRAFT is enabled.
  if (!_selectedRecipe || !matches.includes(_selectedRecipe)) {
    _selectedRecipe = null;
  }
  _chooserEl.classList.remove('hidden');
  for (const r of matches) {
    const btn = makeBtn(r.displayName, () => {
      _selectedRecipe = r;
      renderOutputPreview();
    });
    btn.classList.add('craft-chooser-btn');
    if (_selectedRecipe === r) btn.classList.add('selected');
    _chooserEl.appendChild(btn);
  }
  if (_selectedRecipe) {
    showOutputForRecipe(_selectedRecipe);
  } else {
    _outputLabelEl.textContent = 'choose what to make';
  }
}

/** Show the preview for a single, settled recipe (post-chooser if
 *  applicable). Honors discovery state — "?" if undiscovered. */
function showOutputForRecipe(recipe: Recipe): void {
  if (!_outputSlotEl || !_outputLabelEl || !_craftBtn || !_ctx) return;
  const discovered = _ctx.inventory.discoveredRecipes.includes(recipe.id);
  _outputSlotEl.classList.remove('empty');
  if (discovered) {
    _outputSlotEl.appendChild(makeItemIcon(recipe.output.id));
    if (recipe.output.count > 1) {
      const count = document.createElement('div');
      count.className = 'craft-input-count';
      count.textContent = `×${recipe.output.count}`;
      _outputSlotEl.appendChild(count);
    }
    _outputLabelEl.textContent = recipe.displayName;
  } else {
    const q = document.createElement('div');
    q.className = 'craft-output-unknown';
    q.textContent = '?';
    _outputSlotEl.appendChild(q);
    _outputLabelEl.textContent = 'unknown — try crafting';
  }
  _craftBtn.disabled = false;
}

function renderBag(): void {
  if (!_bagRowsEl || !_ctx) return;
  clearChildren(_bagRowsEl);
  const inv = _ctx.inventory;
  const allSlots: Slot[] = [...inv.slots, ...inv.backpack];

  // Aggregate item totals across all slots so the bag shows ONE row
  // per item type with the summed count (mirroring how the player
  // thinks about their materials — "I have 4 cloth", not "I have 1
  // cloth in slot 3 and 3 in slot 11").
  const totals = new Map<ItemId, number>();
  for (const s of allSlots) {
    if (!s.item || s.count <= 0) continue;
    // Skip meta-bearing slots — they shouldn't be merged or auto-
    // selected as inputs (canteens with fillLevel etc.). Still
    // clickable individually below.
    if (s.meta) continue;
    totals.set(s.item, (totals.get(s.item) ?? 0) + s.count);
  }

  if (totals.size === 0) {
    const empty = document.createElement('div');
    empty.className = 'subtitle';
    empty.style.opacity = '0.6';
    empty.textContent = 'your bag is empty';
    _bagRowsEl.appendChild(empty);
    return;
  }

  // Sort alphabetically by item name for stable display.
  const entries = Array.from(totals.entries()).sort((a, b) => {
    const aName = getItemDef(a[0]).name;
    const bName = getItemDef(b[0]).name;
    return aName < bName ? -1 : aName > bName ? 1 : 0;
  });

  for (const [itemId, count] of entries) {
    const def = getItemDef(itemId);
    const row = document.createElement('button');
    row.className = 'craft-bag-row';
    row.addEventListener('mouseenter', playUiHover);

    row.appendChild(makeItemIcon(itemId));
    const name = document.createElement('div');
    name.className = 'craft-bag-name';
    name.textContent = def.name + (count > 1 ? ` ×${count}` : '');
    row.appendChild(name);
    row.addEventListener('click', () => addToInput(itemId));
    _bagRowsEl.appendChild(row);
  }
}

function renderAll(): void {
  renderInputs();
  renderOutputPreview();
  renderBag();
}

// ── Input-slot mutation ──────────────────────────────────────────

/** Add 1 of `itemId` to the input slots. Stacks onto an existing
 *  input slot of the same item if one exists, otherwise occupies
 *  the first empty input slot. Removes 1 from the player's inventory.
 *  Refuses if all input slots are full + the item isn't already
 *  represented, or if the player has none of the item available. */
function addToInput(itemId: ItemId): void {
  if (!_ctx) return;
  if (countItems(_ctx.inventory, itemId) <= 0) return;

  // Find existing input slot with this item.
  let slot = _inputs.find((s) => s.item === itemId);
  if (!slot) {
    // First empty slot.
    slot = _inputs.find((s) => s.item === null);
    if (!slot) {
      _ctx.ui.showToast('input slots full');
      return;
    }
    slot.item = itemId;
    slot.count = 0;
  }
  slot.count++;
  removeItems(_ctx.inventory, itemId, 1);
  playUiClick();
  renderAll();
}

/** Remove 1 from the given input slot index — returns the item to
 *  the player's inventory. If the slot empties, it's reset for
 *  reuse. */
function removeFromInput(idx: number): void {
  if (!_ctx) return;
  const s = _inputs[idx];
  if (!s.item || s.count <= 0) return;
  addItem(_ctx.inventory, s.item, s.meta, _ctx);
  s.count--;
  if (s.count <= 0) {
    s.item = null;
    s.count = 0;
    s.meta = undefined;
  }
  playUiClick();
  renderAll();
}

/** Return every remaining input-slot item to the player's bag.
 *  Called on close so the player doesn't lose materials accidentally. */
function flushInputsToBag(): void {
  if (!_ctx) return;
  for (const s of _inputs) {
    while (s.item && s.count > 0) {
      addItem(_ctx.inventory, s.item, s.meta, _ctx);
      s.count--;
    }
    s.item = null;
    s.count = 0;
    s.meta = undefined;
  }
  _selectedRecipe = null;
}

// ── Craft execution ──────────────────────────────────────────────

function performCraft(): void {
  if (!_ctx || !_selectedRecipe) return;
  const ctx = _ctx;
  const recipe = _selectedRecipe;

  // The input slots are the source of truth — recipe.inputs is
  // just a multiset definition. Consume from the input slots.
  // (We could also verify inputs match again, but renderOutputPreview
  // already gated this — if _selectedRecipe is set, inputs match.)
  for (const slot of _inputs) {
    slot.item = null;
    slot.count = 0;
    slot.meta = undefined;
  }

  // Add the output to the player's bag.
  let added = 0;
  for (let i = 0; i < recipe.output.count; i++) {
    const result = addItem(ctx.inventory, recipe.output.id, undefined, ctx);
    if (result < 0) break;
    added++;
  }
  if (added === 0) {
    // No room — return the consumed inputs to inventory.
    for (const inp of recipe.inputs) {
      for (let i = 0; i < inp.count; i++) {
        addItem(ctx.inventory, inp.id, undefined, ctx);
      }
    }
    ctx.ui.showToast('no room for the result');
    renderAll();
    return;
  }

  const wasDiscovered = ctx.inventory.discoveredRecipes.includes(recipe.id);
  if (!wasDiscovered) {
    // AAN — first-time discovery is a moment: distinct rising-arp chime
    // (not the routine playCraft tick) + larger, warm-gold toast held
    // longer. Subsequent crafts of the same recipe fall back to the
    // standard playCraft + muted toast.
    ctx.inventory.discoveredRecipes.push(recipe.id);
    playRecipeDiscovery();
    ctx.ui.showToast(
      `you've figured out how to make ${recipe.displayName}`,
      { kind: 'discovery' },
    );
  } else {
    playCraft();
    ctx.ui.showToast(`crafted ${recipe.displayName}`);
  }
  _selectedRecipe = null;
  renderAll();
}

// ── Lifecycle ────────────────────────────────────────────────────

export function openCraftingMenu(ctx: GameContext): void {
  if (!_root || _open) return;
  _open = true;
  ctx.input.controls.unlock();
  // Seed an empty input state on each open (player doesn't carry
  // mid-craft inputs across close/reopen).
  for (const s of _inputs) { s.item = null; s.count = 0; s.meta = undefined; }
  _selectedRecipe = null;
  renderAll();
  _root.classList.remove('hidden');
}

export function closeCraftingMenu(): void {
  if (!_root) return;
  flushInputsToBag();
  _root.classList.add('hidden');
  _open = false;
  resumeFromPause();
}

export function isCraftingMenuOpen(): boolean {
  return _open;
}

// Re-export so callers can introspect (used by an upcoming Recipe Book
// stretch goal). RECIPES is the canonical list for any other code that
// needs to enumerate.
export { RECIPES };
