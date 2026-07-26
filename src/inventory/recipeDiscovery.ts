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

import type { ItemId, ItemMeta } from './types.ts';

/** A single input stack — `count` of a given ItemId.
 *
 *  Scavenger's Economy (build 3) — an input may accept ANY of a set of
 *  interchangeable ids via `anyOf` (e.g. worm_lure takes "raw meat" = any of
 *  the four raw-meat ids). When `anyOf` is present the `id` field is the
 *  REPRESENTATIVE (used for the icon fallback + the source-hint key); the pool
 *  in `anyOf` is what actually satisfies + gets consumed. `label` overrides the
 *  displayed material name for such generic inputs ("raw meat"). Discovery,
 *  craftability, and consumption all treat the whole `anyOf` pool as one. */
export interface RecipeInput {
  id: ItemId;
  count: number;
  /** Interchangeable ids that all satisfy this input (any-of). If set, `id`
   *  is only the representative for display; consumption draws from this pool. */
  anyOf?: ItemId[];
  /** Display-name override for generic anyOf inputs (e.g. "raw meat"). */
  label?: string;
}

/** A single output stack. */
export interface RecipeOutput {
  id: ItemId;
  count: number;
  /** Optional per-slot metadata stamped on the crafted item (e.g. a crafted
   *  canteen starts EMPTY, fillLevel 0, so it must be filled at a water source
   *  rather than granting free water). Applied via addItem's meta param. */
  meta?: ItemMeta;
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
    // Scavenger's Economy (build 3) — a battery-powered light: was scrap×2+cloth,
    // now a salvaged power cell + wiring + a scrap housing.
    inputs: [
      { id: 'battery', count: 1 },
      { id: 'wiring', count: 1 },
      { id: 'scrap', count: 1 },
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
    // Scavenger's Economy (build 3) — a scavenged frame: a salvaged pipe replaces
    // one of the scrap billets (was scrap×2+branch+rope).
    inputs: [
      { id: 'metal_pipe', count: 1 },
      { id: 'scrap', count: 1 },
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
    // Scavenger's Economy (build 3) — a powered camp lamp: power cell + wiring +
    // a scrap frame + a cloth shade (was cloth×2+scrap×2+branch).
    inputs: [
      { id: 'battery', count: 1 },
      { id: 'wiring', count: 1 },
      { id: 'scrap', count: 1 },
      { id: 'cloth', count: 1 },
    ],
    output: { id: 'lantern_kit', count: 1 },
    category: 'shelter',
  },
  // Locker = wooden chest with metal banding.
  {
    id: 13,
    displayName: 'locker',
    // Scavenger's Economy (build 3) — a pipe-framed chest: was scrap×4+branch×2.
    inputs: [
      { id: 'metal_pipe', count: 1 },
      { id: 'scrap', count: 2 },
      { id: 'branch', count: 1 },
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
    // Scavenger's Economy (build 3) — a salvaged-pipe grate over the fire (was
    // scrap×2+branch×2).
    inputs: [
      { id: 'metal_pipe', count: 1 },
      { id: 'scrap', count: 1 },
      { id: 'branch', count: 1 },
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
    // Scavenger's Economy (build 3) — a driven length of pipe (was scrap×3+branch).
    inputs: [
      { id: 'metal_pipe', count: 1 },
      { id: 'scrap', count: 1 },
    ],
    output: { id: 'stake_kit', count: 1 },
    category: 'tool',
  },
  {
    // M5a (C29) — salvaged spyglass: a brass tube (scrap) + a wrapped grip (cloth).
    // Scavenger's Economy (build 3) — the lens optics now want a machine_part
    // (was scrap×3+cloth).
    id: 17,
    displayName: 'spyglass',
    inputs: [
      { id: 'machine_part', count: 1 },
      { id: 'scrap', count: 1 },
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
  {
    // 2026-07-09 (user request) — a craftable canteen. Starts EMPTY (fillLevel 0):
    // a hammered-scrap flask with a cloth strap/seal; the player fills it at a water
    // source. Empty-by-construction so crafting isn't free water (would undercut the
    // M3 thirst curve). Unlocks once scrap + cloth have been collected.
    id: 20,
    displayName: 'canteen',
    inputs: [
      { id: 'scrap', count: 2 },
      { id: 'cloth', count: 1 },
    ],
    output: { id: 'canteen', count: 1, meta: { fillLevel: 0 } },
    category: 'tool',
  },
  // ── Scavenger's Economy (build 3) — new recipes ───────────────────
  // These make EXISTING loot-only items craftable using the new materials.
  // D71: ids continue the sequence (21, 22, 23); never reuse 1-20.
  {
    // pipe staff — a scavenged plumbing melee weapon: a salvaged pipe, a
    // cloth grip, rope lashing.
    id: 21,
    displayName: 'pipe staff',
    inputs: [
      { id: 'metal_pipe', count: 1 },
      { id: 'cloth', count: 1 },
      { id: 'rope', count: 1 },
    ],
    output: { id: 'pipe_staff', count: 1 },
    category: 'tool',
  },
  {
    // scrap gun — a crude single-shot pistol: a pipe barrel, a salvaged
    // firing mechanism (machine_part), a scrap receiver. Crafts EMPTY
    // (ammoRemaining undefined → 0); load scrap bullets with R.
    id: 22,
    displayName: 'scrap gun',
    inputs: [
      { id: 'metal_pipe', count: 1 },
      { id: 'machine_part', count: 1 },
      { id: 'scrap', count: 1 },
    ],
    output: { id: 'scrap_gun', count: 1 },
    category: 'tool',
  },
  {
    // worm-lure — a powered thumper: a salvaged power cell, wiring, and a
    // hunk of raw flesh for scent. Any raw meat works (anyOf pool).
    id: 23,
    displayName: 'worm-lure',
    inputs: [
      { id: 'battery', count: 1 },
      { id: 'wiring', count: 1 },
      {
        id: 'raw_lizard_meat',
        count: 1,
        label: 'raw meat',
        anyOf: ['raw_lizard_meat', 'raw_shrew_meat', 'raw_vulture_meat', 'raw_worm_meat'],
      },
    ],
    output: { id: 'worm_lure', count: 1 },
    category: 'tool',
  },
  // ── DEEPER cycle 6 — UNDERGROUND WATER ────────────────────────────
  {
    // JERRYCAN — the volume vessel. Deliberately in-family with the canteen (id 20, scrap×2 +
    // cloth×1) and priced ONE tier above it: a bigger tank is more sheet metal (scrap×3), a proper
    // welded spout and handle is a salvaged fitting (metal_pipe×1), and the cap still needs a
    // gasket (cloth×1). No battery/wiring — this is a bucket, not a machine, and gating the
    // desert's water behind the scarcest material would be a survival tax, not a decision.
    // Discovery unlocks exactly like the canteen's: once scrap + cloth + metal_pipe have all been
    // collected. Crafts EMPTY (fillLevel 0) — making one is never free water.
    // *** BALANCE NUMBERS FLAGGED FOR ZACH: inputs + JERRYCAN_CAPACITY_MULT (4×). ***
    id: 24,
    displayName: 'jerrycan',
    inputs: [
      { id: 'scrap', count: 3 },
      { id: 'metal_pipe', count: 1 },
      { id: 'cloth', count: 1 },
    ],
    output: { id: 'jerrycan', count: 1, meta: { fillLevel: 0 } },
    category: 'tool',
  },
];

// ── Scavenger's Economy (build 3) — material source hints ─────────
// Single source of truth for the diegetic "where does this live" line shown
// on a recipe card when a material is missing. Keyed by ItemId. Teaches the
// per-POI drop matrix (lootRegistry.ts POI_IDENTITY_SCATTER) in the game's
// lowercase laconic voice. Any material without an entry simply shows no hint.
export const MATERIAL_SOURCE: Partial<Record<ItemId, string>> = {
  metal_pipe:    'salvaged from pipelines and refineries',
  machine_part:  'pulled from dead tanks and crawlers',
  wiring:        'stripped from relays and satellites',
  battery:       'found in pods, habs and relays',
  scrap:         'scavenged off any wreck or debris field',
  cloth:         'torn from fuselage textiles and old tents',
  branch:        'gathered from the dead desert trees',
  rope:          'craft it from cloth, or pull it from cargo',
  // worm-lure's generic "raw meat" input keys its hint off the representative id.
  raw_lizard_meat: 'butchered from prey you hunt out there',
};

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
  const inputs = recipe.inputs;
  let have = 0;
  for (const inp of inputs) if (inputTypeCollected(inp, collected)) have++;
  if (have === 0) return 'cold';
  if (have === inputs.length) return 'unlocked';
  return 'warm';
}

// ── Scavenger's Economy (build 3) — anyOf input helpers ───────────
// One place decides how an input is satisfied / counted / consumed, so the
// discovery gate, the crafting UI, and the verify probe all agree on anyOf.

/** The ids that can satisfy this input — its `anyOf` pool, or just `id`. */
export function inputIds(inp: RecipeInput): ItemId[] {
  return inp.anyOf ?? [inp.id];
}

/** True once the player has ever collected SOME id that satisfies this input
 *  (any of the anyOf pool, or the single id). Drives cold/warm/unlocked. */
export function inputTypeCollected(
  inp: RecipeInput,
  collected: ReadonlySet<ItemId>,
): boolean {
  for (const id of inputIds(inp)) if (collected.has(id)) return true;
  return false;
}

/** Total count the player holds across every id that satisfies this input. */
export function inputHeld(
  inp: RecipeInput,
  totals: ReadonlyMap<ItemId, number>,
): number {
  let n = 0;
  for (const id of inputIds(inp)) n += totals.get(id) ?? 0;
  return n;
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

