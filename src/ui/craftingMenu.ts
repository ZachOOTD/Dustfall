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

import * as THREE from 'three';
import type { GameContext } from '../GameContext.ts';
import type { ItemId, ItemMeta, Slot } from '../inventory/types.ts';
import { addItem, countItems, removeItems } from '../inventory/inventory.ts';
import { getItemDef } from '../inventory/items.ts';
import { spawnDroppedPickup } from '../pickups/pickups.ts';
import {
  RECIPES,
  matchRecipes,
  partialMatchRecipes,
  missingForRecipe,
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
// AAW — recipe list panel on the right of the crafting menu. Lists every
// recipe in `ctx.inventory.discoveredRecipes`, categorized CRAFTABLE vs
// MISSING INGREDIENTS based on the player's current bag totals. Clicking a
// CRAFTABLE row auto-fills the input slots so the player can hit CRAFT.
let _recipesRowsEl: HTMLDivElement | null = null;
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

  // ── AAW — Two-column row: YOUR BAG (left) + RECIPES (right) ──
  // Each column owns its own header + scrollable rows list. The bag is
  // still click-to-add-input as before; recipes is new and click-to-
  // auto-fill (for CRAFTABLE rows; MISSING rows are read-only).
  const twoCol = document.createElement('div');
  twoCol.className = 'craft-two-col';
  root.appendChild(twoCol);

  // Left column: bag.
  const bagCol = document.createElement('div');
  bagCol.className = 'craft-col';
  const bagHeader = document.createElement('div');
  bagHeader.className = 'craft-col-header';
  bagHeader.textContent = 'YOUR BAG';
  bagCol.appendChild(bagHeader);

  const bagRows = document.createElement('div');
  bagRows.className = 'craft-bag-rows';
  bagCol.appendChild(bagRows);
  _bagRowsEl = bagRows;
  twoCol.appendChild(bagCol);

  // Right column: known recipes (categorized craftable / missing).
  const recCol = document.createElement('div');
  recCol.className = 'craft-col';
  const recHeader = document.createElement('div');
  recHeader.className = 'craft-col-header';
  recHeader.textContent = 'RECIPES';
  recCol.appendChild(recHeader);

  const recRows = document.createElement('div');
  recRows.className = 'craft-recipes-rows';
  recCol.appendChild(recRows);
  _recipesRowsEl = recRows;
  twoCol.appendChild(recCol);

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
    // No exact recipe — but maybe the player is partway to one.
    // AAV — partial-match suggestions: if the current inputs are a
    // sub-multiset of any recipe's inputs, surface a hint. For
    // DISCOVERED partial matches we can name the recipe + show what's
    // missing ("tent_kit needs 2 more branch + 1 more cloth"). For
    // UNDISCOVERED partial matches we only show the count ("3 possible
    // recipes — keep adding ingredients") to preserve discovery.
    const partials = partialMatchRecipes(inputs);
    if (partials.length === 0) {
      _outputLabelEl.textContent = 'nothing happens';
    } else {
      // Find the first DISCOVERED partial; if any, name it + show diff.
      const discoveredPartial = partials.find((r) =>
        _ctx!.inventory.discoveredRecipes.includes(r.id),
      );
      if (discoveredPartial) {
        const missing = missingForRecipe(inputs, discoveredPartial);
        const missStr = missing
          .map((m) => `${m.count} ${getItemDef(m.id).name.toLowerCase()}`)
          .join(' + ');
        const others = partials.length - 1;
        const tail = others > 0 ? ` (+ ${others} other possible)` : '';
        _outputLabelEl.textContent = `${discoveredPartial.displayName}: need ${missStr}${tail}`;
      } else {
        // All partial matches are undiscovered — preserve discovery.
        _outputLabelEl.textContent =
          partials.length === 1
            ? '1 possible recipe — add more ingredients'
            : `${partials.length} possible recipes — add more ingredients`;
      }
    }
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

/** AAW — render the right-side recipe list. Categorizes every discovered
 *  recipe as CRAFTABLE (player has all ingredients) or MISSING INGREDIENTS,
 *  and lets the player click a CRAFTABLE row to auto-fill the inputs. Pre-AAW
 *  the only place to see discovered recipes was the TAB-key recipe book, which
 *  was a separate screen — players had to remember ingredients while crafting. */
function renderRecipes(): void {
  if (!_recipesRowsEl || !_ctx) return;
  clearChildren(_recipesRowsEl);
  const inv = _ctx.inventory;
  const known = inv.discoveredRecipes;
  if (known.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'craft-recipes-empty';
    empty.textContent = '(no recipes discovered yet — combine items in the input slots to learn one)';
    _recipesRowsEl.appendChild(empty);
    return;
  }

  // Aggregate player inventory totals once (same exclusion rule as renderBag —
  // skip meta-bearing slots so canteens / loaded guns don't count as crafting
  // material).
  const allSlots: Slot[] = [...inv.slots, ...inv.backpack];
  const totals = new Map<ItemId, number>();
  for (const s of allSlots) {
    if (!s.item || s.count <= 0 || s.meta) continue;
    totals.set(s.item, (totals.get(s.item) ?? 0) + s.count);
  }

  // Partition discovered recipes into craftable vs missing buckets. Sort each
  // bucket by recipe id (stable display order as new recipes get added).
  const craftable: Recipe[] = [];
  const missing: Recipe[] = [];
  const sortedKnown = [...known].sort((a, b) => a - b);
  for (const id of sortedKnown) {
    const recipe = RECIPES.find((r) => r.id === id);
    if (!recipe) continue;
    let canCraft = true;
    for (const inp of recipe.inputs) {
      if ((totals.get(inp.id) ?? 0) < inp.count) { canCraft = false; break; }
    }
    (canCraft ? craftable : missing).push(recipe);
  }

  if (craftable.length > 0) {
    const h = document.createElement('div');
    h.className = 'craft-recipes-category';
    h.textContent = `CRAFTABLE (${craftable.length})`;
    _recipesRowsEl.appendChild(h);
    for (const r of craftable) _recipesRowsEl.appendChild(buildRecipeRow(r, true, totals));
  }
  if (missing.length > 0) {
    const h = document.createElement('div');
    h.className = 'craft-recipes-category missing';
    h.textContent = `MISSING INGREDIENTS (${missing.length})`;
    _recipesRowsEl.appendChild(h);
    for (const r of missing) _recipesRowsEl.appendChild(buildRecipeRow(r, false, totals));
  }
}

/** AAW — build a single recipe row for the right-side panel. CRAFTABLE
 *  rows hover-react + click to auto-fill; MISSING rows are visually muted
 *  and not clickable. Per-ingredient `have/need` is displayed inline; the
 *  missing ones tint red so the eye lands on what's still needed. */
function buildRecipeRow(
  recipe: Recipe,
  canCraft: boolean,
  totals: Map<ItemId, number>,
): HTMLButtonElement {
  const row = document.createElement('button');
  row.className = 'craft-recipe-row' + (canCraft ? '' : ' insufficient');
  row.disabled = !canCraft;

  // Output icon (compact — 28px).
  const outIcon = makeItemIcon(recipe.output.id);
  outIcon.classList.add('craft-recipe-output-icon');
  row.appendChild(outIcon);

  // Name + ingredient line stacked in a vertical sub-column.
  const nameCol = document.createElement('div');
  nameCol.className = 'craft-recipe-name-col';
  const name = document.createElement('div');
  name.className = 'craft-recipe-name';
  const cnt = recipe.output.count > 1 ? ` ×${recipe.output.count}` : '';
  name.textContent = recipe.displayName + cnt;
  nameCol.appendChild(name);

  const ings = document.createElement('div');
  ings.className = 'craft-recipe-ings';
  for (const inp of recipe.inputs) {
    const def = getItemDef(inp.id);
    const have = totals.get(inp.id) ?? 0;
    const ok = have >= inp.count;
    const span = document.createElement('span');
    span.className = 'craft-recipe-ing' + (ok ? '' : ' missing');
    span.textContent = `${have}/${inp.count} ${def.name.toLowerCase()}`;
    ings.appendChild(span);
  }
  nameCol.appendChild(ings);
  row.appendChild(nameCol);

  if (canCraft) {
    row.addEventListener('mouseenter', playUiHover);
    row.addEventListener('click', () => autoFillFromRecipe(recipe));
  }
  return row;
}

function renderAll(): void {
  renderInputs();
  renderOutputPreview();
  renderBag();
  renderRecipes();
}

// ── Input-slot mutation ──────────────────────────────────────────

/** Core stacking logic — extracted in AAW so the auto-fill from a recipe
 *  click can drive N additions without paying N renderAll() + N playUiClick
 *  costs. Returns true if the item was added, false if the player has
 *  none of it OR all input slots are full. */
function addToInputCore(itemId: ItemId): boolean {
  if (!_ctx) return false;
  if (countItems(_ctx.inventory, itemId) <= 0) return false;
  let slot = _inputs.find((s) => s.item === itemId);
  if (!slot) {
    slot = _inputs.find((s) => s.item === null);
    if (!slot) return false;
    slot.item = itemId;
    slot.count = 0;
  }
  slot.count++;
  removeItems(_ctx.inventory, itemId, 1);
  return true;
}

/** Add 1 of `itemId` to the input slots. Stacks onto an existing
 *  input slot of the same item if one exists, otherwise occupies
 *  the first empty input slot. Removes 1 from the player's inventory.
 *  Refuses if all input slots are full + the item isn't already
 *  represented, or if the player has none of the item available. */
function addToInput(itemId: ItemId): void {
  if (!_ctx) return;
  if (countItems(_ctx.inventory, itemId) <= 0) return;
  if (!addToInputCore(itemId)) {
    _ctx.ui.showToast('input slots full');
    return;
  }
  playUiClick();
  renderAll();
}

/** AAW — auto-fill the input slots with all ingredients for `recipe`.
 *  Used by the right-side recipe list — click a CRAFTABLE recipe and
 *  the inputs jump straight to the ready-to-craft configuration. The
 *  caller is responsible for ensuring the player actually has the
 *  ingredients (the row click handler hides this behind the CRAFTABLE
 *  predicate). Returns silently if a partial fill happens; CRAFT button
 *  gating still keeps the craft from firing in that edge case. */
function autoFillFromRecipe(recipe: Recipe): void {
  if (!_ctx) return;
  flushInputsToBag();
  for (const inp of recipe.inputs) {
    for (let i = 0; i < inp.count; i++) {
      if (!addToInputCore(inp.id)) break;
    }
  }
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
  // AAV — if some/all of the output didn't fit, DROP the overflow at
  // the player's feet instead of the pre-AAV "refund inputs + abort"
  // path. Player keeps the craft progress; bag is just full and the
  // result lands on the ground for them to pick up later. Inputs are
  // already consumed at this point (line 405-409 above).
  const dropped = recipe.output.count - added;
  if (dropped > 0) {
    // Drop position: ~0.8m in front of camera, projected to terrain.
    const cam = ctx.three.camera;
    const fwd = new THREE.Vector3();
    cam.getWorldDirection(fwd);
    fwd.y = 0;
    if (fwd.lengthSq() < 1e-4) fwd.set(0, 0, -1);
    fwd.normalize();
    const dx = cam.position.x + fwd.x * 0.8;
    const dz = cam.position.z + fwd.z * 0.8;
    for (let i = 0; i < dropped; i++) {
      const p = spawnDroppedPickup(ctx.three.scene, ctx.terrain, { x: dx, z: dz }, recipe.output.id);
      ctx.pickups.list.push(p);
    }
    if (added === 0) {
      ctx.ui.showToast(`crafted ${recipe.displayName} — dropped at your feet (bag full)`);
    } else {
      ctx.ui.showToast(`crafted ${recipe.displayName} — partial drop at your feet`);
    }
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
