// Crafting menu — opens on C (and TAB). Pickup-gated discovery rework:
// discovery no longer happens by guessing an input combo — a recipe
// unlocks when the player has collected all of its ingredient TYPES (see
// inventory.addItem → unlockNewlyEligible). This menu is a browse-and-craft
// CARD GRID, not the old combine-to-discover input slots.
//
// Card states (recipeCardState against inventory.collectedItemTypes):
//   - cold     → "?" card, nothing revealed.
//   - warm     → "?" output, but the collected ingredients are teased
//                (still-uncollected ingredients show as "?").
//   - unlocked → output icon + name + full have/need ingredient chips;
//                CRAFT enabled iff the player holds the required counts.
//
// Clicking a card selects it and fills the bottom detail footer
// (ingredients → output, the item's description, CRAFT). Dev mode
// (ctx.flags.devMode) treats every card as unlocked + free-crafts on
// CRAFT (no material cost), so visual/verification passes can reach any
// recipe with an empty bag.

import * as THREE from 'three';
import type { GameContext } from '../GameContext.ts';
import type { ItemId, Slot } from '../inventory/types.ts';
import { addItem, removeItems } from '../inventory/inventory.ts';
import { getItemDef } from '../inventory/items.ts';
import { spawnDroppedPickup } from '../pickups/pickups.ts';
import {
  RECIPES,
  recipeCardState,
  CATEGORY_ORDER,
  CATEGORY_LABEL,
  type Recipe,
} from '../inventory/recipeDiscovery.ts';
import { playCraft, playUiClick, playUiHover } from '../audio/audio.ts';
import { resumeFromPause } from './menus.ts';

let _root: HTMLDivElement | null = null;
let _gridEl: HTMLDivElement | null = null;
let _detailEl: HTMLDivElement | null = null;
let _ctx: GameContext | null = null;
let _open = false;

// The card the player has clicked — drives the detail footer. Reset on
// each open (no sticky selection across close/reopen).
let _selected: Recipe | null = null;

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

/** Icon-or-glyph element for an item id (SVG makeIcon() if the def
 *  provides one, else the single-char glyph). */
function makeItemIcon(itemId: ItemId): HTMLDivElement {
  const def = getItemDef(itemId);
  const box = document.createElement('div');
  box.className = 'craft-icon';
  if (def.makeIcon) box.appendChild(def.makeIcon());
  else box.textContent = def.glyph;
  return box;
}

/** A "?" placeholder used for undiscovered outputs + un-collected
 *  ingredient teases. */
function makeUnknownIcon(): HTMLDivElement {
  const box = document.createElement('div');
  box.className = 'craft-icon unknown';
  box.textContent = '?';
  return box;
}

// ── Bag totals (shared craftability math) ────────────────────────

/** Sum item totals across hotbar + backpack, skipping meta-bearing slots
 *  (half-full canteens / loaded guns aren't crafting material — same
 *  exclusion the old bag/recipe panels used). */
function bagTotals(): Map<ItemId, number> {
  const inv = _ctx!.inventory;
  const totals = new Map<ItemId, number>();
  const all: Slot[] = [...inv.slots, ...inv.backpack];
  for (const s of all) {
    if (!s.item || s.count <= 0 || s.meta) continue;
    totals.set(s.item, (totals.get(s.item) ?? 0) + s.count);
  }
  return totals;
}

function canCraftRecipe(r: Recipe, totals: Map<ItemId, number>): boolean {
  for (const inp of r.inputs) {
    if ((totals.get(inp.id) ?? 0) < inp.count) return false;
  }
  return true;
}

/** Effective card state — dev mode reveals everything as unlocked so a
 *  verification pass can browse/craft any recipe with an empty bag. */
function cardStateOf(r: Recipe): 'cold' | 'warm' | 'unlocked' {
  if (_ctx!.flags.devMode) return 'unlocked';
  return recipeCardState(r, _ctx!.inventory.collectedItemTypes);
}

// ── Construction ────────────────────────────────────────────────

export function createCraftingMenu(ctx: GameContext): void {
  _ctx = ctx;
  const root = document.createElement('div');
  root.id = 'crafting-menu';
  root.className = 'overlay hidden';

  const title = document.createElement('div');
  title.className = 'title small';
  title.textContent = 'CRAFTING';
  root.appendChild(title);

  // Scrollable card grid (categories as full-width sub-headers).
  const grid = document.createElement('div');
  grid.className = 'craft-grid';
  root.appendChild(grid);
  _gridEl = grid;

  // Detail footer — ingredients → output + description + CRAFT for the
  // selected recipe.
  const detail = document.createElement('div');
  detail.className = 'craft-detail';
  root.appendChild(detail);
  _detailEl = detail;

  root.appendChild(makeBtn('close', closeCraftingMenu));
  document.body.appendChild(root);
  _root = root;
}

// ── Rendering ────────────────────────────────────────────────────

function renderGrid(): void {
  if (!_gridEl || !_ctx) return;
  const scroll = _gridEl.scrollTop;   // preserve scroll across rebuilds
  clearChildren(_gridEl);
  const totals = bagTotals();
  for (const cat of CATEGORY_ORDER) {
    const inCat = RECIPES
      .filter((r) => r.category === cat)
      .sort((a, b) => a.id - b.id);
    if (inCat.length === 0) continue;
    const header = document.createElement('div');
    header.className = 'craft-cat-header';
    header.textContent = CATEGORY_LABEL[cat];
    _gridEl.appendChild(header);
    for (const r of inCat) _gridEl.appendChild(buildCard(r, totals));
  }
  _gridEl.scrollTop = scroll;
}

function buildCard(r: Recipe, totals: Map<ItemId, number>): HTMLButtonElement {
  const state = cardStateOf(r);
  const craftable = state === 'unlocked' && canCraftRecipe(r, totals);
  const card = document.createElement('button');
  card.className = 'craft-card ' + state + (craftable ? ' craftable' : '');
  if (_selected === r) card.classList.add('selected');

  // Output icon (or "?").
  const icon = document.createElement('div');
  icon.className = 'craft-card-icon';
  icon.appendChild(state === 'unlocked' ? makeItemIcon(r.output.id) : makeUnknownIcon());
  card.appendChild(icon);

  // Name (or "???").
  const name = document.createElement('div');
  name.className = 'craft-card-name';
  name.textContent = state === 'unlocked'
    ? r.displayName + (r.output.count > 1 ? ` ×${r.output.count}` : '')
    : '???';
  card.appendChild(name);

  // Ingredient tease chips — icons only (counts live in the detail
  // footer). Warm reveals just the ingredients already collected (others
  // show "?"); unlocked shows every ingredient icon. A short ingredient
  // (unlocked, not enough in the bag) tints red so the eye lands on it.
  if (state !== 'cold') {
    const chips = document.createElement('div');
    chips.className = 'craft-card-chips';
    const collected = _ctx!.inventory.collectedItemTypes;
    for (const inp of r.inputs) {
      const known = state === 'unlocked' || collected.has(inp.id);
      const chip = document.createElement('div');
      chip.className = 'craft-card-chip';
      if (known) {
        const short = state === 'unlocked' && (totals.get(inp.id) ?? 0) < inp.count;
        if (short) chip.classList.add('short');
        chip.appendChild(makeItemIcon(inp.id));
      } else {
        const q = document.createElement('span');
        q.className = 'craft-card-chip-q';
        q.textContent = '?';
        chip.appendChild(q);
      }
      chips.appendChild(chip);
    }
    card.appendChild(chips);
  }

  card.addEventListener('mouseenter', playUiHover);
  card.addEventListener('click', () => { playUiClick(); selectRecipe(r); });
  return card;
}

function renderDetail(): void {
  if (!_detailEl || !_ctx) return;
  clearChildren(_detailEl);

  if (!_selected) {
    const hint = document.createElement('div');
    hint.className = 'craft-detail-hint';
    hint.textContent = 'select a recipe';
    _detailEl.appendChild(hint);
    return;
  }

  const r = _selected;
  const state = cardStateOf(r);
  const totals = bagTotals();
  const collected = _ctx.inventory.collectedItemTypes;

  // Flow row: [ingredient chips]  →  [output].
  const flow = document.createElement('div');
  flow.className = 'craft-detail-flow';

  const ings = document.createElement('div');
  ings.className = 'craft-detail-ings';
  for (const inp of r.inputs) {
    const known = state === 'unlocked' || collected.has(inp.id);
    const ing = document.createElement('div');
    ing.className = 'craft-detail-ing';
    if (known) {
      ing.appendChild(makeItemIcon(inp.id));
      const label = document.createElement('div');
      const have = totals.get(inp.id) ?? 0;
      const ok = have >= inp.count;
      label.className = 'craft-detail-ing-label' + (state === 'unlocked' && !ok ? ' missing' : '');
      label.textContent = state === 'unlocked'
        ? `${have}/${inp.count} ${getItemDef(inp.id).name.toLowerCase()}`
        : getItemDef(inp.id).name.toLowerCase();
      ing.appendChild(label);
    } else {
      ing.appendChild(makeUnknownIcon());
      const label = document.createElement('div');
      label.className = 'craft-detail-ing-label';
      label.textContent = '???';
      ing.appendChild(label);
    }
    ings.appendChild(ing);
  }
  flow.appendChild(ings);

  const arrow = document.createElement('div');
  arrow.className = 'craft-detail-arrow';
  arrow.textContent = '→';
  flow.appendChild(arrow);

  const out = document.createElement('div');
  out.className = 'craft-detail-output';
  out.appendChild(state === 'unlocked' ? makeItemIcon(r.output.id) : makeUnknownIcon());
  const outName = document.createElement('div');
  outName.className = 'craft-detail-output-name';
  outName.textContent = state === 'unlocked'
    ? r.displayName + (r.output.count > 1 ? ` ×${r.output.count}` : '')
    : '???';
  out.appendChild(outName);
  flow.appendChild(out);
  _detailEl.appendChild(flow);

  // Flavor / tease line.
  const desc = document.createElement('div');
  desc.className = 'craft-detail-desc';
  if (state === 'unlocked') {
    desc.textContent = getItemDef(r.output.id).description;
  } else if (state === 'warm') {
    desc.textContent = 'you have some of what this takes — scavenge the rest to reveal it';
  } else {
    desc.textContent = 'unknown — scavenge its materials to work out what it makes';
  }
  _detailEl.appendChild(desc);

  // CRAFT button.
  const craftable = state === 'unlocked' && canCraftRecipe(r, totals);
  const devMode = _ctx.flags.devMode;
  const btn = makeBtn('craft', () => {
    if (devMode && !canCraftRecipe(r, totals)) directCraft(r);
    else performCraft(r);
  });
  btn.classList.add('craft-go-btn');
  btn.disabled = !(craftable || devMode);
  _detailEl.appendChild(btn);
}

function renderAll(): void {
  renderGrid();
  renderDetail();
}

function selectRecipe(r: Recipe): void {
  _selected = r;
  renderAll();
}

// ── Craft execution ──────────────────────────────────────────────

/** Consume the recipe's inputs from the bag + add the output; overflow
 *  drops at the player's feet (bag full). Discovery already happened at
 *  pickup, so this just plays the craft tick + a "crafted X" toast. */
function performCraft(r: Recipe): void {
  if (!_ctx) return;
  const ctx = _ctx;
  const totals = bagTotals();
  if (!canCraftRecipe(r, totals)) return;   // gated by the disabled button, but re-check

  for (const inp of r.inputs) removeItems(ctx.inventory, inp.id, inp.count);

  const dropped = addOutputWithOverflow(ctx, r);
  playCraft();
  if (dropped > 0) {
    ctx.ui.showToast(
      dropped === r.output.count
        ? `crafted ${r.displayName} — dropped at your feet (bag full)`
        : `crafted ${r.displayName} — partial drop at your feet`,
    );
  } else {
    ctx.ui.showToast(`crafted ${r.displayName}`);
  }
  renderAll();
}

/** Dev free-craft — produce the output with no input consumption. Wired
 *  to the CRAFT button when devMode is on and the player lacks materials
 *  (a real craft still runs when they have them, keeping the dev flow
 *  faithful when possible). */
function directCraft(r: Recipe): void {
  if (!_ctx) return;
  const ctx = _ctx;
  const dropped = addOutputWithOverflow(ctx, r);
  playCraft();
  ctx.ui.showToast(
    dropped > 0 ? `${r.displayName} (dev) — dropped at your feet` : `${r.displayName} (dev craft)`,
  );
  renderAll();
}

/** Add the recipe output to the bag; whatever doesn't fit scatters at the
 *  player's feet with a physics body (ABM B7). Returns the dropped count. */
function addOutputWithOverflow(ctx: GameContext, r: Recipe): number {
  let added = 0;
  for (let i = 0; i < r.output.count; i++) {
    // clone the recipe's output meta per stack so slots don't share a meta object
    const meta = r.output.meta ? { ...r.output.meta } : undefined;
    if (addItem(ctx.inventory, r.output.id, meta, ctx) < 0) break;
    added++;
  }
  const dropped = r.output.count - added;
  if (dropped > 0) {
    const cam = ctx.three.camera;
    const fwd = new THREE.Vector3();
    cam.getWorldDirection(fwd);
    fwd.y = 0;
    if (fwd.lengthSq() < 1e-4) fwd.set(0, 0, -1);
    fwd.normalize();
    const dx = cam.position.x + fwd.x * 0.8;
    const dz = cam.position.z + fwd.z * 0.8;
    for (let i = 0; i < dropped; i++) {
      const p = spawnDroppedPickup(
        ctx.three.scene, ctx.terrain, { x: dx, z: dz }, r.output.id,
        r.output.meta ? { ...r.output.meta } : undefined,
        {
          world: ctx.physics.world,
          initialVel: { x: (Math.random() - 0.5) * 0.6, y: 0.5, z: (Math.random() - 0.5) * 0.6 },
        },
      );
      ctx.pickups.list.push(p);
    }
  }
  return dropped;
}

// ── Lifecycle ────────────────────────────────────────────────────

export function openCraftingMenu(ctx: GameContext): void {
  if (!_root || _open) return;
  _open = true;
  ctx.input.controls.unlock();
  _selected = null;
  renderAll();
  _root.classList.remove('hidden');
}

export function closeCraftingMenu(): void {
  if (!_root) return;
  _selected = null;
  _root.classList.add('hidden');
  _open = false;
  resumeFromPause();
}

export function isCraftingMenuOpen(): boolean {
  return _open;
}

// Canonical recipe list re-export for any other code that enumerates.
export { RECIPES };
