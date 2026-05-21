// Inventory state + add/use/select operations. Pure logic — no DOM.

import * as THREE from 'three';
import type { GameContext } from '../GameContext.ts';
import { isPlaying } from '../GameContext.ts';
import type { InventoryState, ItemId, ItemMeta, Slot } from './types.ts';
import { getItemDef } from './items.ts';
import { spawnDroppedPickup } from '../pickups/pickups.ts';
import { playDrop } from '../audio/audio.ts';

const HOTBAR_SLOT_COUNT = 4;
const BACKPACK_SLOT_COUNT = 10;

export function createInventory(): InventoryState {
  const empty = (): Slot => ({ item: null, count: 0 });
  return {
    slots: Array.from({ length: HOTBAR_SLOT_COUNT }, empty),
    backpack: Array.from({ length: BACKPACK_SLOT_COUNT }, empty),
    selectedIdx: 0,
    hover: null,
    // TT — Empty on fresh game; the combine-to-discover UI populates
    // this as the player crafts. Save load may seed it with the full
    // recipe set on v5→v6 migration so existing playtesters keep
    // their recipe knowledge.
    discoveredRecipes: [],
  };
}

/**
 * Try to add an item to the inventory. Returns a slot reference indicator:
 *  - 0..3        : hotbar slot index
 *  - 100..109    : backpack slot index (100 + i)
 *  - -1          : inventory full
 * Items with `meta` (canteen fillLevel, food cookState) never auto-stack —
 * a half-full canteen ≠ a full canteen.
 *
 * Pickup precedence: try hotbar first (stack, then empty), then backpack
 * (stack, then empty). Selected slot bias not implemented for v1.
 */
export function addItem(inv: InventoryState, id: ItemId, meta?: ItemMeta, ctx?: GameContext): number {
  const def = getItemDef(id);

  // 1a. Stack onto an existing hotbar slot.
  if (def.stackable && !meta) {
    for (let i = 0; i < inv.slots.length; i++) {
      const s = inv.slots[i];
      if (s.item === id && s.count < def.maxStack && !s.meta) {
        s.count++;
        if (ctx) maybeFireHint(ctx, id);
        return i;
      }
    }
    // 1b. Stack onto an existing backpack slot.
    for (let i = 0; i < inv.backpack.length; i++) {
      const s = inv.backpack[i];
      if (s.item === id && s.count < def.maxStack && !s.meta) {
        s.count++;
        if (ctx) maybeFireHint(ctx, id);
        return 100 + i;
      }
    }
  }

  // 2a. First empty hotbar slot.
  for (let i = 0; i < inv.slots.length; i++) {
    const s = inv.slots[i];
    if (s.item === null) {
      s.item = id;
      s.count = 1;
      if (meta) s.meta = { ...meta };
      else delete s.meta;
      if (ctx) maybeFireHint(ctx, id);
      return i;
    }
  }

  // 2b. First empty backpack slot.
  for (let i = 0; i < inv.backpack.length; i++) {
    const s = inv.backpack[i];
    if (s.item === null) {
      s.item = id;
      s.count = 1;
      if (meta) s.meta = { ...meta };
      else delete s.meta;
      if (ctx) maybeFireHint(ctx, id);
      return 100 + i;
    }
  }

  return -1;
}

/** Lazy-load the tutorial module so inventory.ts doesn't grow a static dep
 *  on ui/* (which would invite circulars). Identical pattern to the KeyC
 *  crafting-menu lazy-import below. */
function maybeFireHint(ctx: GameContext, id: ItemId): void {
  void import('../ui/tutorial.ts').then((m) => m.maybeShowItemHint(ctx, id));
}

/** Count total occurrences of an item across hotbar + backpack.
 *  Skips slots whose `meta` is set — partial canteens / cooked food shouldn't
 *  be eligible as crafting ingredients. */
export function countItems(inv: InventoryState, id: ItemId): number {
  let total = 0;
  for (const s of inv.slots) if (s.item === id && !s.meta) total += s.count;
  for (const s of inv.backpack) if (s.item === id && !s.meta) total += s.count;
  return total;
}

/** Remove `n` of the given item from inventory (hotbar first, then backpack). */
export function removeItems(inv: InventoryState, id: ItemId, n: number): boolean {
  if (countItems(inv, id) < n) return false;
  let remaining = n;
  const drainSlot = (s: Slot): void => {
    if (remaining === 0) return;
    if (s.item === id && !s.meta) {
      const take = Math.min(s.count, remaining);
      s.count -= take;
      remaining -= take;
      if (s.count <= 0) {
        s.item = null;
        s.count = 0;
        delete s.meta;
      }
    }
  };
  for (const s of inv.slots) drainSlot(s);
  for (const s of inv.backpack) drainSlot(s);
  return true;
}

export function selectSlot(inv: InventoryState, idx: number): void {
  if (idx < 0 || idx >= inv.slots.length) return;
  inv.selectedIdx = idx;
}

export function cycleSelected(inv: InventoryState, dir: number): void {
  const n = inv.slots.length;
  inv.selectedIdx = ((inv.selectedIdx + dir) % n + n) % n;
}

/** Drop one unit of the selected slot into the world 1m in front of the player. */
const _dropDir = new THREE.Vector3();
export function dropSelected(ctx: GameContext): void {
  const slot = ctx.inventory.slots[ctx.inventory.selectedIdx];
  if (!slot.item) return;
  const droppedId = slot.item;
  const droppedMeta = slot.meta ? { ...slot.meta } : undefined;

  // Decrement the slot
  slot.count--;
  if (slot.count <= 0) {
    slot.item = null;
    slot.count = 0;
    delete slot.meta;
  }

  // Compute drop position: camera + forward * 1m, projected to terrain.
  const cam = ctx.three.camera;
  cam.getWorldDirection(_dropDir);
  _dropDir.y = 0;
  if (_dropDir.lengthSq() < 1e-4) _dropDir.set(0, 0, -1);
  _dropDir.normalize();
  const px = cam.position.x + _dropDir.x * 1.0;
  const pz = cam.position.z + _dropDir.z * 1.0;

  const pickup = spawnDroppedPickup(ctx.three.scene, ctx.terrain, { x: px, z: pz }, droppedId, droppedMeta);
  ctx.pickups.list.push(pickup);
  playDrop();
  const def = getItemDef(droppedId);
  ctx.ui.showToast(`dropped — ${def.name.toLowerCase()}`);
}

/** Use the currently-selected slot. No-op if empty. */
export function useSelected(ctx: GameContext): void {
  const inv = ctx.inventory;
  const slot = inv.slots[inv.selectedIdx];
  if (!slot.item) return;
  const def = getItemDef(slot.item);
  const result = def.onUse(ctx, slot);
  if (result.message) ctx.ui.showToast(result.message);
  // Fire the viewmodel use animation (if the item defines one).
  ctx.player.viewModel?.triggerUse();
  if (result.consumed) {
    slot.count--;
    if (slot.count <= 0) {
      slot.item = null;
      slot.count = 0;
      delete slot.meta;
    }
  }
}

/**
 * Per-frame hotbar input handling: number keys, mouse wheel, Q to use.
 * Hover/raycast and E-to-pickup live in player/interaction.ts.
 */
export function updateInventoryInput(ctx: GameContext, _dt: number): void {
  if (!isPlaying(ctx)) return;
  const inv = ctx.inventory;

  // Number keys 1-4 select
  for (let i = 0; i < HOTBAR_SLOT_COUNT; i++) {
    if (ctx.input.pressed.has(`Digit${i + 1}`)) {
      selectSlot(inv, i);
    }
  }

  // Mouse wheel cycles
  if (ctx.input.wheel !== 0) {
    cycleSelected(inv, ctx.input.wheel > 0 ? 1 : -1);
  }

  // Q to use selected
  if (ctx.input.pressed.has('KeyQ')) {
    useSelected(ctx);
  }

  // G to drop selected (one unit)
  if (ctx.input.pressed.has('KeyG')) {
    dropSelected(ctx);
  }

  // I (inventory) and C (crafting) toggle handlers live in core/input.ts on
  // a window listener so they fire even while another overlay has paused
  // the game (this function is skipped when paused).
}
