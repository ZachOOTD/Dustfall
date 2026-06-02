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
  | 'raw_shrew_meat'
  | 'cooked_shrew_meat'
  | 'raw_worm_meat'
  | 'cooked_worm_meat'
  // Session G — fire / tent crafting + fuel + cloth
  | 'branch'
  | 'cloth'
  | 'fire_kit'
  | 'tent_kit'
  // Session W — alien cactus harvest
  | 'alien_fruit'
  // Session AA — light sources for night gameplay
  | 'torch'
  | 'flashlight'
  // Session II — lizard-on-a-stick wielded cooking
  | 'lizard_on_a_stick_raw'
  | 'lizard_on_a_stick_cooked'
  // Session PP — weapon variants
  | 'pipe_staff'
  | 'scrap_gun'
  | 'scrap_bullet'
  | 'energy_pistol'
  // Session QQ — sled + rope
  | 'rope'
  | 'sled_kit'
  // Session XX — larger enterable tent (walk-in interior)
  | 'large_tent_kit'
  // Session AAC — craftable home placeables
  | 'bedroll_kit'
  | 'lantern_kit'
  | 'locker_kit'
  // Session AAE — pocketable creature companion
  | 'companion_pod'
  // Session AAM — craftable fire grill attachment (multi-cook)
  | 'grill_kit'
  // Session AAR — heavy iron lever for prying salvage panels open
  | 'scrap_bar'
  // Session ACE — craftable world-anchor stake (B1 Phase 3 rope endpoint)
  | 'stake_kit'
  // ACL ITEMS — long-barreled procedural rifle (ranged weapon)
  | 'amban_rifle';

/** Per-slot metadata for stateful items (canteen fill level, cook state, light state). */
export interface ItemMeta {
  /** 0..1 fill amount for containers (canteen). */
  fillLevel?: number;
  /** Cook state for food items (raw → cooked via fire in Session G). */
  cookState?: 'raw' | 'cooked';
  /** Whether a light source is currently on (torch / flashlight). */
  lit?: boolean;
  /** 0..1 remaining burn time for consumable torches. Reaches 0 → torch burns out. */
  burnRemaining?: number;
  /** 0..1 fuel level for rechargeable flashlights. Drains while lit, recharges while held + off. */
  fuelLevel?: number;
  /** 0..1 cook progress for the lizard-on-a-stick (Session II). Ticks
   *  up while the raw skewer is held near a fire; at 1 the slot flips
   *  to the cooked variant. Persists with the slot so cooking can be
   *  resumed across save/load. */
  cookProgress?: number;
  /** Rounds remaining for ranged weapons (Session PP). Decrements
   *  per shot; reload via consuming a `scrap_bullet` while the gun
   *  is the equipped slot. Persists across save/load. */
  ammoRemaining?: number;
  /** Session QQ — set on the wielded `rope` slot while one end is
   *  tied to a sled. Identifies which Sled.id the rope is bound to;
   *  cleared on detach. Persists across save/load so towing survives
   *  a reload. */
  attachedSledId?: number;
  /** Session UU — seconds accumulated while LMB has been held on a
   *  `wieldLmb: 'hold_use'` item (e.g., canteen). Reset to 0 on each
   *  new press; cleared (undefined) on release. Mirrors the cookProgress
   *  pattern (D58): slot.meta survives HMR, module-level singletons
   *  don't. NOT persisted across save (transient input state — see
   *  save.ts serialize). */
  holdProgress?: number;
}

export interface UseResult {
  /** True if the item was consumed by the use (slot loses one). */
  consumed: boolean;
  /** Optional toast message shown to the player. */
  message?: string;
}

/** Session UU (D74) — declares how LMB dispatches when this item is the
 *  equipped slot. Read by `src/player/wieldAction.ts` (the sole LMB-while-
 *  wielded dispatcher). Defaults to `'click_use'` if omitted.
 *
 *  - `'attack'`    — delegate to `updateCombat` (machete, pipe_staff, scrap_gun, energy_pistol).
 *  - `'place'`     — single LMB-click invokes `onUse` (kits: fire_kit, tent_kit, sled_kit).
 *  - `'hold_use'`  — hold LMB to drive `onHoldTick` continuously (canteen).
 *  - `'click_use'` — default. No LMB action on the wielded item; LMB on a
 *                    hovered pickup takes it. Q still calls `onUse`.
 *  - `'none'`      — neither LMB nor pickup-take fires for this item (rope:
 *                    LMB-on-sled-stub is handled by `interaction.ts` because
 *                    it needs hover-state; torch/flashlight: Q toggles, LMB
 *                    is inert).
 */
export type WieldLmb = 'attack' | 'place' | 'hold_use' | 'click_use' | 'none';

export interface ItemDef {
  id: ItemId;
  name: string;
  /** Single-character glyph shown in the hotbar slot. */
  glyph: string;
  /** Long-press / look-at description. */
  description: string;
  stackable: boolean;
  maxStack: number;
  /** Session UU (D74) — LMB-dispatch behavior. Optional; defaults to 'click_use'. */
  wieldLmb?: WieldLmb;
  /**
   * Invoked when the player triggers `use`. Mutate ctx.stats / slot.meta freely.
   * `slot` is the inventory slot containing this item — useful for stateful
   * containers (canteen drains slot.meta.fillLevel rather than consuming the slot).
   * Return consumed=false to keep the item in the slot (e.g. machete, partially-full canteen).
   */
  onUse: (ctx: GameContext, slot: Slot) => UseResult;

  /** Session UU — per-frame hook for `wieldLmb: 'hold_use'` items. Called
   *  every frame while LMB is held. `holdSeconds` is the cumulative time
   *  since the press started (cleared on release). The hook mutates
   *  `ctx.stats` / `slot.meta` as needed; toasts via `ctx.ui.showToast`.
   *  The wieldAction module also bumps `slot.meta.holdProgress` for the
   *  viewmodel system to read (cook-progress-style animation hook). */
  onHoldTick?: (ctx: GameContext, slot: Slot, holdSeconds: number, dt: number) => void;

  /** Build the held mesh shown in the first-person viewmodel. Optional —
   *  items without a viewmodel render only the hands. */
  makeViewModel?: () => THREE.Object3D;

  /** ABY P3 — scale multiplier applied to the 3P hand-attach mesh ONLY
   *  (FP viewmodel stays at original scale). Items that read too small/
   *  dark at 3P distance bump this to ~1.3-1.5 for visibility. Default
   *  1.0 (no scale change). */
  thirdPersonScale?: number;

  /** ACW Phase A — per-item 3P hand-attach transform applied to the 3P
   *  hand-attach mesh ONLY (FP viewmodel unaffected). `pos` in meters in
   *  rightHandAttach-local space, `rot` in radians (XYZ Euler). Applied
   *  AFTER thirdPersonScale in viewModel.swapEquippedMesh. This is the
   *  per-item knob that seats a grip correctly in the rig's right hand at
   *  3P distance — without it most makeViewModel meshes float/intersect
   *  the hand (they're authored for the FP camera origin). Default =
   *  identity (legacy behavior). */
  handAttachTransform?: { pos: [number, number, number]; rot: [number, number, number] };

  /** ACW Phase A — 3P use-animation hook. The FP viewmodel item isn't
   *  rendered in 3P, so an FP-only `playUseAnim` shows NO arm motion when
   *  the player swings/drinks/fires while the camera is behind the body.
   *  This drives the RIG's right-arm bones instead. `t` ∈ [0,1] over
   *  `useAnimDuration`. Author ABSOLUTE poses on `rig.shoulders[1]` /
   *  `elbows[1]` / `wrists[1]` (and the head/spine if needed) — the caller
   *  does NOT reset between frames, and the per-state gait/idle block
   *  re-poses the arm the frame after the anim ends. Optional — items
   *  without it show no 3P arm motion on use. */
  playUseAnim3P?: (rig: import('../player/playerRig.ts').PlayerRig, t: number) => void;

  /** Build a fresh SVG element for the hotbar icon. Falls back to `glyph` if absent. */
  makeIcon?: () => SVGElement;

  /** Drive the per-frame pose during a use animation. `t` ∈ [0,1]; mutate
   *  `itemRoot.position` / `.rotation` directly. Reset is handled by the caller. */
  playUseAnim?: (itemRoot: THREE.Object3D, t: number) => void;

  /** Duration of the use animation in seconds. Omit/0 = no animation. */
  useAnimDuration?: number;

  /** Per-frame hook for the currently-held item — reacts to slot.meta changes
   *  (e.g., torch/flashlight light state, fuel depletion). Called from
   *  `updateViewModel` only while this item is the equipped slot. */
  updateHeld?: (itemRoot: THREE.Object3D, slot: Slot, ctx: GameContext, dt: number) => void;

  /** Drive the per-frame pose during the cook-over-fire timer (Session II).
   *  `t` ∈ [0,1] runs from cook start to cook complete. Mutate
   *  `itemRoot.position` / `.rotation` directly. Reset is handled by the
   *  caller. Only items present in interaction.ts's `COOK_MAP` are ever
   *  cooked, so most items don't need this. */
  playCookAnim?: (itemRoot: THREE.Object3D, t: number) => void;
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
  /** Session TT — set of Recipe.id numbers the player has personally
   *  crafted at least once via the combine-to-discover UI. Persisted
   *  across save/load. Used by `craftingMenu.ts` to decide whether to
   *  show the actual output icon (discovered) or "?" (unknown) on the
   *  output preview slot for a given input combination. Pre-v6 saves
   *  get the full seed set on load (see save.ts) so existing
   *  playtesters keep their accumulated recipe knowledge. */
  discoveredRecipes: number[];
  /** Session ABJ (v11) — set of journal kinds the player has read at
   *  least once. Mutated by openJournalPanel; persisted across save/
   *  load as JournalKind[]. Used by HUD (interact prompt) to dim the
   *  hover hint for already-read journals. Per-kind rather than per-id
   *  because journal ids regenerate per-seed but kinds are stable. */
  journalReadKinds: Set<import('../world/journal.ts').JournalKind>;
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
  | 'salvage'   // wreck (Session T) — E starts a 1.5s salvage
  | 'read'      // journal (Session W) — E opens the journal panel
  | 'mount'     // speeder seat (Session CC-3.1) — E mounts the bike
  | 'open_sled' // sled cargo deck (Session QQ) — E opens the sled inventory
  | 'attach_rope' // sled rope stub (Session QQ) — LMB w/ rope equipped attaches/detaches
  | 'open_locker' // locker chest (Session AAC) — E opens the locker inventory
  | 'pet_companion'; // creature companion (Session AAE) — passive hover, RMB packs it up

export interface HoverState {
  type: InteractType;
  /** Distance in meters from camera to the target. */
  distance: number;
  /** Pickup-specific: the item that would be taken. */
  itemId?: ItemId;
  /** AAZ-fix — optional registry-id of the hovered entity (fire id,
   *  cactus id, etc.). Lets item `onUse` callbacks resolve back to the
   *  hovered entity without doing their own raycast. Previously
   *  grill_kit.onUse tried to read this off the hover via a stale type
   *  assertion (`(hover as { id?: number }).id`) — the field never
   *  actually existed, so the lookup always failed. */
  entityId?: number;
  /** Display noun shown in the prompt — "canteen", "wreckage", "water", etc. */
  promptNoun: string;
  /** AAZ — optional verb override. When set, the prompt uses this string
   *  instead of the static VERBS[type] mapping. Lets the same InteractType
   *  carry a state-dependent verb (e.g. tent doorway shows "open" or
   *  "close" depending on doorOpen). Ignored when `passive` is true. */
  verb?: string;
  /** When true, the prompt suppresses both the [E] key chip and the verb,
   *  showing only the noun. Used for passive/no-op prompts like a stripped wreck. */
  passive?: boolean;
}
