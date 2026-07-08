// Recipe registry + discovery state.
//
// Discovery is PICKUP-GATED (crafting rework, replacing the Session TT
// combine-to-discover input slots): a recipe unlocks once the player has
// ever collected all of its ingredient TYPES (tracked in
// InventoryState.collectedItemTypes, updated on every addItem). Counts
// don't gate the unlock — only whether the recipe can actually be crafted
// once known. The crafting menu (craftingMenu.ts) renders each recipe as a
// card with three states from recipeCardState():
//   - cold     — no ingredient types collected yet ("?").
//   - warm     — some collected (tease: known ingredients revealed, "?"
//                for the rest); output still hidden.
//   - unlocked — all ingredient types collected; full card + craftable
//                when the bag holds the counts.
// unlockNewlyEligible() runs on each acquire to append newly-satisfied
// recipe ids to inventory.discoveredRecipes (the persisted ledger).
//
// Design constraints (from GDD pillars + D7/D9/D13):
//   - Crafting is survival pressure, not a min-max vector. Keep the seed
//     set tight; resist sprawl.
//   - Discovery is coupled to gathering — scavenging rewards the player
//     with knowledge, which fits the survival loop.
//
// Recipe collisions (two recipes with the same input multiset, e.g.
// fire_kit + signal_flare) are no longer special: each is an independent
// card that unlocks on the same ingredient set. No chooser needed.

import type { ItemId } from './types.ts';

/** A single input stack — `count` of a given ItemId. */
export interface RecipeInput {
  id: ItemId;
  count: number;
}

/** A single output stack. */
export interface RecipeOutput {
  id: ItemId;
  count: number;
}

/** Session ABE — recipe category for UI grouping. Persisted nowhere
 *  (purely a display attribute). New recipes pick the closest fit:
 *    - 'tool' — wieldable utility items (torch, rope, scrap_bar)
 *    - 'ammo' — consumable munitions for weapons (scrap_bullet)
 *    - 'shelter' — placeable home/camp kits (fire, tent, bedroll, …)
 *    - 'consumable' — health/food items (bandage, cooked meat skewer)
 *  Order in the right-side panel is tool → ammo → shelter → consumable.
 */
export type RecipeCategory = 'tool' | 'ammo' | 'shelter' | 'consumable';

/** A recipe entry. `id` is a stable numeric identifier persisted in
 *  `inventory.discoveredRecipes` — never reuse a retired id, never
 *  renumber. New recipes get the next-highest unused id. */
export interface Recipe {
  /** Stable numeric id. Persisted in save. Don't renumber. */
  id: number;
  /** Display name (used for the "you've figured out how to make X" toast). */
  displayName: string;
  /** Input multiset. Order doesn't matter; counts do. */
  inputs: RecipeInput[];
  /** Output stack. */
  output: RecipeOutput;
  /** Session ABE — UI category for the right-side recipe list grouping. */
  category: RecipeCategory;
}

// ── Seed recipes ──────────────────────────────────────────────────
// Migrated from `src/ui/craftingMenu.ts` (Session G + extensions).
// Numeric ids are stable: 1 = bandage, 2 = fire_kit, ..., 9 = sled_kit.
// New recipes added in future sessions get id ≥ 10.
//
// Each recipe also acts as the source-of-truth for the legacy save
// migration path: pre-v6 saves get all 9 of these added to
// `discoveredRecipes` on load (see save.ts SAVE_VERSION 5→6).
export const RECIPES: Recipe[] = [
  {
    id: 1,
    displayName: 'bandage',
    inputs: [
      { id: 'cloth', count: 1 },
      { id: 'scrap', count: 1 },
    ],
    output: { id: 'bandage', count: 1 },
    category: 'consumable',
  },
  {
    id: 2,
    displayName: 'fire kit',
    inputs: [
      { id: 'branch', count: 3 },
      { id: 'scrap', count: 1 },
    ],
    output: { id: 'fire_kit', count: 1 },
    category: 'shelter',
  },
  {
    id: 3,
    displayName: 'tent kit',
    inputs: [
      { id: 'cloth', count: 3 },
      { id: 'branch', count: 2 },
    ],
    output: { id: 'tent_kit', count: 1 },
    category: 'shelter',
  },
  // Session AA — light sources.
  {
    id: 4,
    displayName: 'torch',
    inputs: [
      { id: 'branch', count: 1 },
      { id: 'cloth', count: 1 },
    ],
    output: { id: 'torch', count: 1 },
    category: 'tool',
  },
  {
    id: 5,
    displayName: 'flashlight',
    inputs: [
      { id: 'scrap', count: 2 },
      { id: 'cloth', count: 1 },
    ],
    output: { id: 'flashlight', count: 1 },
    category: 'tool',
  },
  // Session II — wielded skewer.
  {
    id: 6,
    displayName: 'lizard on a stick',
    inputs: [
      { id: 'branch', count: 1 },
      { id: 'raw_lizard_meat', count: 1 },
    ],
    output: { id: 'lizard_on_a_stick_raw', count: 1 },
    category: 'consumable',
  },
  // Session PP — ammo.
  {
    id: 7,
    displayName: 'scrap bullets',
    inputs: [
      { id: 'scrap', count: 1 },
    ],
    output: { id: 'scrap_bullet', count: 2 },
    category: 'ammo',
  },
  // Session QQ — sled + rope.
  {
    id: 8,
    displayName: 'rope',
    inputs: [
      { id: 'cloth', count: 2 },
      { id: 'branch', count: 1 },
    ],
    output: { id: 'rope', count: 1 },
    category: 'tool',
  },
  {
    id: 9,
    displayName: 'sled kit',
    inputs: [
      { id: 'scrap', count: 2 },
      { id: 'branch', count: 1 },
      { id: 'rope', count: 1 },
    ],
    output: { id: 'sled_kit', count: 1 },
    category: 'shelter',
  },
  // Session XX — larger enterable shelter tent. Id 10 per D71
  // (never reuse ids 1-9, even if they look unused).
  {
    id: 10,
    displayName: 'shelter tent',
    inputs: [
      { id: 'cloth', count: 4 },
      { id: 'branch', count: 3 },
      { id: 'rope', count: 1 },
    ],
    output: { id: 'large_tent_kit', count: 1 },
    category: 'shelter',
  },
  // Session AAC — craftable home placeables. D71: never reuse 1-10.
  // Bedroll = portable cloth pad. Cheap recipe — early-game accessible.
  {
    id: 11,
    displayName: 'bedroll',
    inputs: [
      { id: 'cloth', count: 3 },
      { id: 'branch', count: 1 },
    ],
    output: { id: 'bedroll_kit', count: 1 },
    category: 'shelter',
  },
  // Lantern = standing light source. Scrap + cloth for the globe wrap.
  {
    id: 12,
    displayName: 'lantern',
    inputs: [
      { id: 'cloth', count: 2 },
      { id: 'scrap', count: 2 },
      { id: 'branch', count: 1 },
    ],
    output: { id: 'lantern_kit', count: 1 },
    category: 'shelter',
  },
  // Locker = wooden chest with metal banding.
  {
    id: 13,
    displayName: 'locker',
    inputs: [
      { id: 'scrap', count: 4 },
      { id: 'branch', count: 2 },
    ],
    output: { id: 'locker_kit', count: 1 },
    category: 'shelter',
  },
  // Session AAM — grill attachment for a fire. Allows multiple raw
  // items to cook in parallel. companion_pod (Session AAE) was never
  // craftable (singleton spawn-only), so id 14 was free per D71.
  {
    id: 14,
    displayName: 'grill kit',
    inputs: [
      { id: 'scrap', count: 2 },
      { id: 'branch', count: 2 },
    ],
    output: { id: 'grill_kit', count: 1 },
    category: 'shelter',
  },
  // Session AAR — scrap bar: heavy iron lever used to pry open salvage
  // access panels. The new tactile salvage flow (D94) requires this
  // tool equipped to lever a panel open; without it, panels stay
  // sealed. Cheap to craft so it's not a gate, just a "find the
  // crowbar first" beat early in the run.
  {
    id: 15,
    displayName: 'scrap bar',
    inputs: [
      { id: 'scrap', count: 2 },
      { id: 'branch', count: 1 },
    ],
    output: { id: 'scrap_bar', count: 1 },
    category: 'tool',
  },
  // Session ACE — iron stake: a craftable world-anchor for the rope.
  // B1 Phase 3 RopeEndpoint. Lets the player tie a sled (or other
  // tetherable entity) to a persistent point in the world that
  // survives save/load. Cheap enough to deploy several across a run.
  {
    id: 16,
    displayName: 'iron stake',
    inputs: [
      { id: 'scrap', count: 3 },
      { id: 'branch', count: 1 },
    ],
    output: { id: 'stake_kit', count: 1 },
    category: 'tool',
  },
  {
    // M5a (C29) — salvaged spyglass: a brass tube (scrap) + a wrapped grip (cloth).
    id: 17,
    displayName: 'spyglass',
    inputs: [
      { id: 'scrap', count: 3 },
      { id: 'cloth', count: 1 },
    ],
    output: { id: 'spyglass', count: 1 },
    category: 'tool',
  },
  {
    // M6 (C37) — signal flare. DELIBERATELY shares fire_kit's input multiset
    // (branch×3 + scrap×1) → the first live recipe COLLISION, which lights up the
    // multi-match chooser (built ACAS B3, dormant until now): the same scavenged
    // sticks + scrap can become a fire ("warm yourself") OR a flare ("call out").
    // NOTE: the Phase-B proposal suggested scrap×2+branch×1, but that key is already
    // owned by scrap_bar (id 15) — using it would make a 3-way pileup and change
    // fire_kit's long-standing recipe. Reusing fire_kit's existing recipe yields the
    // intended clean 2-way fire_kit/signal_kit chooser with zero churn (D-entry C37).
    id: 18,
    displayName: 'signal flare',
    inputs: [
      { id: 'branch', count: 3 },
      { id: 'scrap', count: 1 },
    ],
    output: { id: 'signal_kit', count: 1 },
    category: 'tool',
  },
  // M10 ⑭ (C57) — scrap machete: the craftable pry tool. A scrap blade + a cloth-wrapped
  // grip. Distinct input multiset (scrap×2 + cloth×1) from scrap_bar (scrap×2 + branch×1)
  // + spyglass (scrap×3 + cloth×1), so no recipe-collision chooser. Pries panels just like
  // scrap_bar (interaction.ts accepts either); the machete is the intended tool going forward.
  {
    id: 19,
    displayName: 'scrap machete',
    inputs: [
      { id: 'scrap', count: 2 },
      { id: 'cloth', count: 1 },
    ],
    output: { id: 'scrap_machete', count: 1 },
    category: 'tool',
  },
];

/** Session ABE — display order for category sub-headers. Recipes within
 *  each (craftable / missing) bucket render grouped by category in this
 *  order. */
export const CATEGORY_ORDER: ReadonlyArray<RecipeCategory> = [
  'tool',
  'ammo',
  'shelter',
  'consumable',
];

/** Session ABE — display label for each category. Used as sub-header
 *  text within the right-side recipe panel. */
export const CATEGORY_LABEL: Record<RecipeCategory, string> = {
  tool: 'TOOLS',
  ammo: 'AMMO',
  shelter: 'SHELTER & CAMP',
  consumable: 'CONSUMABLES',
};

/** All currently-defined recipe ids. Used by save.ts on v5→v6
 *  migration to seed `discoveredRecipes` with the full set so
 *  existing playtesters don't lose their recipe knowledge. */
export const ALL_RECIPE_IDS: ReadonlyArray<number> = RECIPES.map((r) => r.id);

/** Find a recipe by its stable numeric id. Used by save/load on
 *  the `discoveredRecipes` ledger. */
export function findRecipeById(id: number): Recipe | undefined {
  for (const r of RECIPES) if (r.id === id) return r;
  return undefined;
}

// ── Pickup-gated discovery (crafting rework) ──────────────────────
// Discovery is coupled to gathering, not to guessing an input combo:
// a recipe unlocks once the player has ever collected all of its
// ingredient TYPES (counts don't gate the unlock — only whether you
// can actually craft it). The `collected` set is InventoryState.
// collectedItemTypes, updated on every addItem (pickup / craft / loot).

/** Card state for a recipe given the player's ever-collected item-type
 *  set:
 *    - 'cold'     — none of the recipe's input types collected yet → "?".
 *    - 'warm'     — some but not all input types collected → tease
 *                   (output stays "?", collected ingredients revealed).
 *    - 'unlocked' — every input type collected at least once → full card.
 *  Monotonic: driven by the cumulative `collected` set, never by live
 *  inventory counts, so a card never regresses once it warms/unlocks. */
export function recipeCardState(
  recipe: Recipe,
  collected: ReadonlySet<ItemId>,
): 'cold' | 'warm' | 'unlocked' {
  const types = new Set(recipe.inputs.map((i) => i.id));
  let have = 0;
  for (const id of types) if (collected.has(id)) have++;
  if (have === 0) return 'cold';
  if (have === types.size) return 'unlocked';
  return 'warm';
}

/** Scan every recipe not yet in `discovered` and, for any whose input
 *  types are all present in `collected`, append its id to `discovered`
 *  (mutating in place). Returns the newly-unlocked ids so the caller can
 *  fire a discovery toast/chime. Called from inventory.addItem after each
 *  successful acquire. */
export function unlockNewlyEligible(
  discovered: number[],
  collected: ReadonlySet<ItemId>,
): number[] {
  const known = new Set(discovered);
  const newly: number[] = [];
  for (const r of RECIPES) {
    if (known.has(r.id)) continue;
    if (recipeCardState(r, collected) === 'unlocked') {
      discovered.push(r.id);
      newly.push(r.id);
    }
  }
  return newly;
}

