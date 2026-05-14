// Inventory type definitions.

import type * as THREE from 'three';
import type { GameContext } from '../GameContext.ts';

export type ItemId =
  | 'canteen'
  | 'scrap'
  | 'bandage'
  | 'machete'
  | 'cactus_pulp'
  | 'cooked_cactus_pulp'
  | 'raw_lizard_meat'
  | 'cooked_lizard_meat'
  // Session G — fire / tent crafting + fuel + cloth
  | 'branch'
  | 'cloth'
  | 'fire_kit'
  | 'tent_kit';

/** Per-slot metadata for stateful items (canteen fill level, cook state). */
export interface ItemMeta {
  /** 0..1 fill amount for containers (canteen). */
  fillLevel?: number;
  /** Cook state for food items (raw → cooked via fire in Session G). */
  cookState?: 'raw' | 'cooked';
}

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
   * Invoked when the player triggers `use`. Mutate ctx.stats / slot.meta freely.
   * `slot` is the inventory slot containing this item — useful for stateful
   * containers (canteen drains slot.meta.fillLevel rather than consuming the slot).
   * Return consumed=false to keep the item in the slot (e.g. machete, partially-full canteen).
   */
  onUse: (ctx: GameContext, slot: Slot) => UseResult;

  /** Build the held mesh shown in the first-person viewmodel. Optional —
   *  items without a viewmodel render only the hands. */
  makeViewModel?: () => THREE.Object3D;

  /** Build a fresh SVG element for the hotbar icon. Falls back to `glyph` if absent. */
  makeIcon?: () => SVGElement;

  /** Drive the per-frame pose during a use animation. `t` ∈ [0,1]; mutate
   *  `itemRoot.position` / `.rotation` directly. Reset is handled by the caller. */
  playUseAnim?: (itemRoot: THREE.Object3D, t: number) => void;

  /** Duration of the use animation in seconds. Omit/0 = no animation. */
  useAnimDuration?: number;
}

export interface Slot {
  item: ItemId | null;
  count: number;
  /** Optional per-slot metadata (fillLevel for canteens, cookState for food). */
  meta?: ItemMeta;
}

export interface InventoryState {
  slots: Slot[];          // hotbar — length 4
  backpack: Slot[];       // additional storage — length 10 (Session I)
  selectedIdx: number;    // 0..3, indexes into slots only
  /** The pickup the player is currently aiming at (set by player/interaction). */
  hover: HoverState | null;
}

/** What kind of interaction is the player currently aimed at? */
export type InteractType =
  | 'take'      // pickup → press E to take into inventory
  | 'refill'    // water source → E to refill an equipped/owned canteen
  | 'search'    // loot container → E to open the loot menu
  | 'harvest'   // cactus → E to harvest cactus_pulp
  | 'kill'      // living lizard → no E action; LMB to attack
  | 'cook'      // fire + raw food selected → E starts a 0.6s cook
  | 'add_fuel'  // fire + branch selected → E adds fuel
  | 'sleep'     // tent → E opens sleep overlay
  | 'relight'   // dead fire + branch selected → E reignites with 30s fuel
  | 'salvage';  // wreck (Session T) — E starts a 1.5s salvage

export interface HoverState {
  type: InteractType;
  /** Distance in meters from camera to the target. */
  distance: number;
  /** Pickup-specific: the item that would be taken. */
  itemId?: ItemId;
  /** Display noun shown in the prompt — "canteen", "wreckage", "water", etc. */
  promptNoun: string;
  /** When true, the prompt suppresses both the [E] key chip and the verb,
   *  showing only the noun. Used for passive/no-op prompts like a stripped wreck. */
  passive?: boolean;
}
