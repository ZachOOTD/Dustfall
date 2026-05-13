// Inventory type definitions.

import type { GameContext } from '../GameContext.ts';

export type ItemId = 'canteen' | 'scrap' | 'bandage' | 'machete';

export interface UseResult {
  /** True if the item was consumed by the use (slot loses one). */
  consumed: boolean;
  /** Optional toast message shown to the player. */
  message?: string;
}

export interface ItemDef {
  id: ItemId;
  name: string;
  /** Single-character glyph shown in the hotbar slot. */
  glyph: string;
  /** Long-press / look-at description. */
  description: string;
  stackable: boolean;
  maxStack: number;
  /**
   * Invoked when the player triggers `use`. Mutate ctx.stats / ctx.* freely.
   * Return consumed=false to keep the item in the slot (e.g. machete).
   */
  onUse: (ctx: GameContext) => UseResult;
}

export interface Slot {
  item: ItemId | null;
  count: number;
}

export interface InventoryState {
  slots: Slot[];          // length 4
  selectedIdx: number;    // 0..3
  /** The pickup the player is currently aiming at (set by player/interaction). */
  hover: HoverState | null;
}

export interface HoverState {
  itemId: ItemId;
  /** Distance in meters from camera to the pickup. */
  distance: number;
}
