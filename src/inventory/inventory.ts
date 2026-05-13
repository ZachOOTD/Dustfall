// Inventory state + add/use/select operations. Pure logic — no DOM.

import type { GameContext } from '../GameContext.ts';
import { isPlaying } from '../GameContext.ts';
import type { InventoryState, ItemId, Slot } from './types.ts';
import { getItemDef } from './items.ts';

const SLOT_COUNT = 4;

export function createInventory(): InventoryState {
  const slots: Slot[] = Array.from({ length: SLOT_COUNT }, () => ({
    item: null,
    count: 0,
  }));
  return { slots, selectedIdx: 0, hover: null };
}

/**
 * Try to add an item to the inventory. Returns the slot index it was added
 * to, or -1 if the inventory is full / not stackable into existing slots.
 */
export function addItem(inv: InventoryState, id: ItemId): number {
  const def = getItemDef(id);

  // 1. Stack onto an existing slot if possible.
  if (def.stackable) {
    for (let i = 0; i < inv.slots.length; i++) {
      const s = inv.slots[i];
      if (s.item === id && s.count < def.maxStack) {
        s.count++;
        return i;
      }
    }
  }

  // 2. Drop into the first empty slot.
  for (let i = 0; i < inv.slots.length; i++) {
    const s = inv.slots[i];
    if (s.item === null) {
      s.item = id;
      s.count = 1;
      return i;
    }
  }

  return -1;
}

export function selectSlot(inv: InventoryState, idx: number): void {
  if (idx < 0 || idx >= inv.slots.length) return;
  inv.selectedIdx = idx;
}

export function cycleSelected(inv: InventoryState, dir: number): void {
  const n = inv.slots.length;
  inv.selectedIdx = ((inv.selectedIdx + dir) % n + n) % n;
}

/** Use the currently-selected slot. No-op if empty. */
export function useSelected(ctx: GameContext): void {
  const inv = ctx.inventory;
  const slot = inv.slots[inv.selectedIdx];
  if (!slot.item) return;
  const def = getItemDef(slot.item);
  const result = def.onUse(ctx);
  if (result.message) ctx.ui.showToast(result.message);
  if (result.consumed) {
    slot.count--;
    if (slot.count <= 0) {
      slot.item = null;
      slot.count = 0;
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
  for (let i = 0; i < SLOT_COUNT; i++) {
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
}
