// Recipe registry + discovery state — Session TT.
//
// Replaces the explicit `RECIPES` list UI from Session G with a
// combine-to-discover model: the player throws up to 4 item-stacks
// into the crafting menu's input slots; the system hashes the inputs
// + looks up matching recipes; the player either sees the result (if
// already discovered) or "?" (if undiscovered). Clicking CRAFT
// consumes inputs + produces output. On first-time successful craft,
// the recipe is added to `inventory.discoveredRecipes`.
//
// Design constraints (from GDD pillars + D7/D9/D13):
//   - Crafting is survival pressure, not a min-max vector. Keep the
//     seed set tight (currently 9 recipes; resist sprawl).
//   - The "discovery feel" matters more than recipe count — the player
//     should feel like they figured something out, not like they
//     unlocked a menu item.
//
// Input matching:
//   - Inputs are an unordered MULTISET of (itemId, count). The order
//     the player places items in the input slots is irrelevant.
//   - Match by canonical key: sort the inputs by itemId alphabetically,
//     then serialize as "id:count,id:count,...". Same key → same recipe.
//   - Counts matter. {cloth:1, branch:1} (torch) and {cloth:2, branch:1}
//     (rope) are different recipes despite using the same item types.
//
// Recipe overlap (chooser case):
//   - If two recipes hash to the same key (rare but allowed), the UI
//     surfaces a chooser. `matchRecipes()` returns the array of matches
//     so the UI can render the chooser.
//   - None of the current 9 recipes overlap; the chooser exists for
//     future recipes that might.

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

/** Canonical hash of an input multiset — used as the recipe lookup
 *  key. Sorts inputs by id alphabetically, drops zero-count entries,
 *  serializes as `"id:count,id:count,..."`. Two inputs with the same
 *  multiset hash to the same key regardless of order. */
export function canonicalInputKey(inputs: RecipeInput[]): string {
  const sorted = inputs
    .filter((i) => i.count > 0)
    .map((i) => ({ id: i.id, count: i.count }))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return sorted.map((i) => `${i.id}:${i.count}`).join(',');
}

/** Pre-computed map from canonical input key → matching recipes.
 *  Built once at module load. */
const _recipesByKey = (() => {
  const m = new Map<string, Recipe[]>();
  for (const r of RECIPES) {
    const key = canonicalInputKey(r.inputs);
    const existing = m.get(key);
    if (existing) existing.push(r);
    else m.set(key, [r]);
  }
  return m;
})();

/** Look up all recipes matching the given input multiset. Returns:
 *   - empty array if no recipe matches (invalid combination → "nothing happens")
 *   - single-entry array if exactly one matches (the common case)
 *   - multi-entry array if multiple recipes share the same input multiset
 *     (chooser UI surfaces this — none of the current 9 recipes overlap) */
export function matchRecipes(inputs: RecipeInput[]): Recipe[] {
  const key = canonicalInputKey(inputs);
  return _recipesByKey.get(key) ?? [];
}

/** Find a recipe by its stable numeric id. Used by save/load on
 *  the `discoveredRecipes` ledger. */
export function findRecipeById(id: number): Recipe | undefined {
  for (const r of RECIPES) if (r.id === id) return r;
  return undefined;
}

/** ACAS B3 — TEST-ONLY: register a transient recipe at runtime so the multi-match
 *  CHOOSER path can be exercised without shipping a gameplay collision (the live
 *  recipe set has no input-multiset overlaps, so the chooser is otherwise dormant).
 *  Not called by production code — only the `craft-chooser` rig-shot verification. */
export function __registerTestRecipe(r: Recipe): void {
  RECIPES.push(r);
  const key = canonicalInputKey(r.inputs);
  const existing = _recipesByKey.get(key);
  if (existing) existing.push(r);
  else _recipesByKey.set(key, [r]);
}

/** AAV — partial-match recipes for the "you're on the right track" hint
 *  system in the crafting UI. Returns recipes where the player's current
 *  inputs are a SUB-MULTISET of the recipe's input multiset (every item
 *  the player has appears in the recipe with at least the same count;
 *  no extra items not in the recipe).
 *
 *  Empty inputs return [] (otherwise everything would match every recipe).
 *  Exact matches are EXCLUDED — those are handled by matchRecipes.
 *
 *  Use case: player has dropped 1 branch + 1 cloth. A torch recipe
 *  needs 1 branch + 1 cloth — that's an exact match (matchRecipes).
 *  A tent_kit needs 3 branch + 2 cloth — player has 1/3 and 1/2,
 *  partial match. A rope needs 1 cloth + 2 branch — player has 1/1
 *  but only 1/2 branch — partial match too.
 *
 *  UI shows count of partial matches as "X possible recipes — add more
 *  ingredients" without revealing which (preserves discovery), but if
 *  ANY partial match is DISCOVERED the UI can name it + show what's
 *  missing.
 */
export function partialMatchRecipes(inputs: RecipeInput[]): Recipe[] {
  // Aggregate player's current inputs into a Map for fast lookup.
  const playerCounts = new Map<ItemId, number>();
  for (const inp of inputs) {
    if (inp.count > 0) {
      playerCounts.set(inp.id, (playerCounts.get(inp.id) ?? 0) + inp.count);
    }
  }
  if (playerCounts.size === 0) return [];
  const totalPlayer = Array.from(playerCounts.values()).reduce((a, b) => a + b, 0);
  const matches: Recipe[] = [];
  for (const r of RECIPES) {
    // Build recipe count map.
    const recipeCounts = new Map<ItemId, number>();
    for (const inp of r.inputs) {
      recipeCounts.set(inp.id, inp.count);
    }
    // Check player ⊆ recipe (every player item appears in recipe
    // with count ≥ player's count; player has no items not in recipe).
    let isSubset = true;
    for (const [id, pCount] of playerCounts) {
      const rCount = recipeCounts.get(id) ?? 0;
      if (rCount === 0 || pCount > rCount) { isSubset = false; break; }
    }
    if (!isSubset) continue;
    // Exclude exact matches (handled by matchRecipes).
    const totalRecipe = r.inputs.reduce((a, b) => a + b.count, 0);
    if (totalPlayer >= totalRecipe) continue;
    matches.push(r);
  }
  return matches;
}

/** AAV — diff helper for partial-match UI hints. Given the player's
 *  current inputs + a target recipe, returns the list of (itemId,
 *  needed-more-count) that the player needs to add to complete it.
 *  Used for the "tent_kit needs 2 more branch + 1 more cloth" hint
 *  on DISCOVERED partial matches. */
export function missingForRecipe(
  inputs: RecipeInput[],
  recipe: Recipe,
): Array<{ id: ItemId; count: number }> {
  const playerCounts = new Map<ItemId, number>();
  for (const inp of inputs) {
    if (inp.count > 0) {
      playerCounts.set(inp.id, (playerCounts.get(inp.id) ?? 0) + inp.count);
    }
  }
  const missing: Array<{ id: ItemId; count: number }> = [];
  for (const inp of recipe.inputs) {
    const have = playerCounts.get(inp.id) ?? 0;
    const need = inp.count - have;
    if (need > 0) missing.push({ id: inp.id, count: need });
  }
  return missing;
}
