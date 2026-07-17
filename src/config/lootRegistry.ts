// ────────────────────────────────────────────────────────────────
// LOOT REGISTRY — the SINGLE data-driven home for every loot table in the game
// (Scavenger's Economy, build 1). Unifies the three formerly-separate loot
// systems into one module:
//
//   1. SALVAGE panels        — SALVAGE_TABLES + rollSalvageTable() (was salvage.ts TABLES / rollWreckLoot)
//   2. LOOT containers        — CONTAINER_LOOT + rollContainerLoot()  (was lootContainers.ts rollLoot + tuning.LOOT_CONTAINER_*)
//   3. COMPONENT (panel) loot — COMPONENT_LOOT{,_CORRODED,_PRISTINE_BONUS} (was interaction.ts)
//
// PURITY IS A GOAL. This module imports ONLY types (`import type` — fully erased
// at runtime), so it carries NO transitive three.js / GameContext / WebGL
// dependency and is importable headlessly under plain `node` (Node ≥22 type-
// stripping). scripts/verify-loot-digest.mjs imports it directly to prove the
// refactor is byte-for-byte behavior-preserving (see docs / npm run verify:loot).
//
// THE THREE ROLLERS ARE DELIBERATELY SEPARATE — their chance semantics differ:
//   • rollSalvageTable — INDEPENDENT weighted rolls: every entry is diced on its
//     own; multiple (or zero, then a guaranteed scrap) items per salvage.
//   • rollContainerLoot — WEIGHTED-PICK cascade: each of N entry-rolls yields
//     exactly ONE item, chosen by cumulative threshold.
//   • component loot — NOT a roll at all: a deterministic per-component-kind
//     lookup (with corroded / pristine-bonus variants).
// Merging them into one helper would change behavior, so they stay distinct.
// Randomness is injected: both rollers take an `rng: Rng` parameter (callers pass
// the game's seeded LCG; the harness passes a seeded rng for reproducible digests).
// ────────────────────────────────────────────────────────────────

import type { ItemId, ItemMeta } from '../inventory/types.ts';
import type { Rng } from '../core/rng.ts';
import type { WreckKind } from '../world/wrecks.ts';

// ── Salvage-kind union (moved here from salvage.ts so the data lives with the
//    table it keys). 'massive' = big POIs; 'escape_pod' = a medical loot palette
//    whose wreck model was retired (ACBD) but whose palette other POIs still use. ──
export type SalvageKind = WreckKind | 'massive' | 'escape_pod';

// ════════════════════════════════════════════════════════════════
// 1. SALVAGE PANEL TABLES (independent weighted rolls)
// ════════════════════════════════════════════════════════════════

/** One independent weighted roll: "dice once; if it hits, append id×count." */
export interface LootRoll {
  id: ItemId;
  chance: number;
  count?: number;
}

/** A single salvage/component loot result. */
export interface SalvageLootEntry {
  id: ItemId;
  count?: number;
  meta?: ItemMeta;
}

// Session AAB — tables balanced for per-kind identity (players learn which wreck
// kind yields what). Each kind has a thematic signature:
//   engine kinds     → scrap-pure metal (cabling = occasional rope)
//   fuselage         → cloth + bandage + rope (interior textiles + wiring)
//   escape_pod       → medical (bandages first, cloth secondary)
//   cargo_container  → varied lottery (scrap, cloth, branch, tent_kit chance, rope)
//   massive          → rich mix of everything including rope + rare hero weapons
export const SALVAGE_TABLES: Record<SalvageKind, LootRoll[]> = {
  // Engine wrecks — pure metal. Rope = cabling/hoses; occasional scrap_bullet
  // (ammunition stowed near the block).
  engine_cluster: [
    { id: 'scrap',         chance: 0.90, count: 2 },
    { id: 'scrap',         chance: 0.50 },
    { id: 'rope',          chance: 0.10 },
    { id: 'scrap_bullet',  chance: 0.12 },   // AAL — bumped 0.05 → 0.12; ammo was scrap_bullet-recipe-dependent in practice
  ],
  // Fuselage — interior textiles + bulkhead cabling. The cloth/rope wreck of choice.
  fuselage: [
    { id: 'cloth',      chance: 0.70 },
    { id: 'cloth',      chance: 0.30 },
    { id: 'scrap',      chance: 0.35 },
    { id: 'bandage',    chance: 0.25 },
    { id: 'rope',       chance: 0.15 },
    { id: 'flashlight', chance: 0.04 },
  ],
  // Escape pod — medical kit + survival gear. Bandage-heavy.
  escape_pod: [
    { id: 'bandage', chance: 0.80 },
    { id: 'bandage', chance: 0.30 },
    { id: 'cloth',   chance: 0.35 },
    { id: 'scrap',   chance: 0.20 },
    { id: 'branch',  chance: 0.08 },
  ],
  // Cargo container — varied lottery + rope (lashing material).
  cargo_container: [
    { id: 'scrap',    chance: 0.45 },
    { id: 'cloth',    chance: 0.35 },
    { id: 'bandage',  chance: 0.20 },
    { id: 'branch',   chance: 0.25 },
    { id: 'rope',     chance: 0.15 },
    { id: 'tent_kit', chance: 0.04 },
  ],
  // Engine bell — pure scrap, occasional rope (cabling around the nozzle).
  engine_bell: [
    { id: 'scrap', chance: 1.00, count: 2 },
    { id: 'scrap', chance: 0.60 },
    { id: 'rope',  chance: 0.05 },
  ],
  // Massive POIs — richer rolls incl. rope + rare hero-tier weapons. AAL added
  // energy_pistol + scrap_bullet so ammo isn't gated on the scrap recipe alone.
  massive: [
    { id: 'scrap',         chance: 0.95, count: 2 },
    { id: 'scrap',         chance: 0.75 },
    { id: 'cloth',         chance: 0.65 },
    { id: 'bandage',       chance: 0.45 },
    { id: 'branch',        chance: 0.25 },
    { id: 'rope',          chance: 0.20 },
    { id: 'scrap_bullet',  chance: 0.15 },
    { id: 'fire_kit',      chance: 0.05 },
    { id: 'flashlight',    chance: 0.08 },
    { id: 'energy_pistol', chance: 0.03 },   // rare hero-tier weapon drop
    // ACY — amban rifle: rarest hero find (top-tier marksman weapon; shares scrap_bullet ammo).
    { id: 'amban_rifle',   chance: 0.02 },
    // ACAC — pulse rifle: the rarest hero find (self-recharging cell, no ammo item).
    { id: 'pulse_rifle',   chance: 0.015 },
  ],
};

/** Roll one salvage of `kind` — INDEPENDENT weighted rolls (each entry diced on
 *  its own). Guarantees ≥1 item so a successful salvage never feels empty. This
 *  is the exact former `salvage.ts rollWreckLoot`; the RNG call sequence (one
 *  `rng()` per table entry, in order) is preserved. */
export function rollSalvageTable(kind: SalvageKind, rng: Rng): SalvageLootEntry[] {
  const table = SALVAGE_TABLES[kind];
  const out: SalvageLootEntry[] = [];
  for (const r of table) {
    if (rng() < r.chance) {
      out.push({ id: r.id, count: r.count });
    }
  }
  if (out.length === 0) out.push({ id: 'scrap' });
  return out;
}

// ════════════════════════════════════════════════════════════════
// 2. LOOT CONTAINER TABLE (weighted-pick cascade)
// ════════════════════════════════════════════════════════════════

/** A single loot-container result. NB: the container system keys results by
 *  `itemId` (not `id`) — its consumers (lootMenu, save, locker, sled) read that
 *  field, so the shape is kept distinct from SalvageLootEntry. */
export interface ContainerLootEntry {
  itemId: ItemId;
  count: number;
  meta?: ItemMeta;
}

/** One weighted-pick option in the container cascade. `threshold` is the
 *  CUMULATIVE upper bound (0..1); the roller picks the FIRST option whose
 *  threshold exceeds the roll `r`. `countMax` (if set) → count = 1 + floor(rng()*countMax);
 *  `canteenFill` marks the fillLevel meta special-case. */
export interface ContainerLootOption {
  id: ItemId;
  threshold: number;
  countMax?: number;
  canteenFill?: boolean;
}

/** Container-roll shaping (AAL — was tuning.ts LOOT_CONTAINER_*, relocated here so
 *  all loot data lives in one registry). `entriesMin/Max` = items per container;
 *  `fillMin/fillRange` = canteen fill spread. */
export const CONTAINER_CONFIG = {
  entriesMin: 1,
  entriesMax: 3,
  fillMin: 0.3,        // 0.3..0.8 fill level on loot canteens
  fillRange: 0.5,
} as const;

/** The container drop table — a WEIGHTED-PICK cascade (exactly one item per
 *  entry-roll). Thresholds ascending + cumulative; `machete` at 1.0 is the
 *  fallback tail. Same buckets as the former tuning.LOOT_CONTAINER_* thresholds:
 *  bandage 25% / cloth 30% / scrap 20% / canteen 17% / machete 8%. */
export const CONTAINER_LOOT: ContainerLootOption[] = [
  { id: 'bandage', threshold: 0.25 },
  { id: 'cloth',   threshold: 0.55, countMax: 2 },
  { id: 'scrap',   threshold: 0.75, countMax: 3 },
  { id: 'canteen', threshold: 0.92, canteenFill: true },
  { id: 'machete', threshold: 1.00 },
];

/** Roll the contents of ONE loot container — WEIGHTED-PICK cascade. Byte-for-byte
 *  the former `lootContainers.ts rollLoot`: one `rng()` for the entry count, then
 *  per entry one `rng()` for the bucket pick plus (only for cloth/scrap/canteen)
 *  one further `rng()` for the count/fill. The RNG call sequence is preserved. */
export function rollContainerLoot(rng: Rng): ContainerLootEntry[] {
  const contents: ContainerLootEntry[] = [];
  const { entriesMin, entriesMax, fillMin, fillRange } = CONTAINER_CONFIG;
  const entries = entriesMin + Math.floor(rng() * (entriesMax - entriesMin + 1));
  for (let i = 0; i < entries; i++) {
    const r = rng();
    const opt = CONTAINER_LOOT.find((o) => r < o.threshold) ?? CONTAINER_LOOT[CONTAINER_LOOT.length - 1];
    if (opt.canteenFill) {
      const fill = fillMin + rng() * fillRange;
      contents.push({ itemId: opt.id, count: 1, meta: { fillLevel: fill } });
    } else if (opt.countMax !== undefined) {
      contents.push({ itemId: opt.id, count: 1 + Math.floor(rng() * opt.countMax) });
    } else {
      contents.push({ itemId: opt.id, count: 1 });
    }
  }
  return contents;
}

// ════════════════════════════════════════════════════════════════
// 3. COMPONENT (salvage-panel) LOOT — deterministic per-kind lookup
// ════════════════════════════════════════════════════════════════

/** One deterministic component-loot result. */
export interface ComponentLoot {
  id: ItemId;
  count?: number;
}

// AAS — standard (baseline) mapping: each PanelComponentKind → a fixed item.
export const COMPONENT_LOOT: Record<string, ComponentLoot> = {
  red_wire:     { id: 'rope' },
  yellow_wire:  { id: 'cloth', count: 2 },
  chip:         { id: 'scrap_bullet' },
  fuse:         { id: 'scrap_bullet' },
  scrap_chunk:  { id: 'scrap', count: 2 },
  cloth_scrap:  { id: 'cloth', count: 2 },
  bandage_pack: { id: 'bandage' },
};

/** AAT — corroded variant. Rusted panels yield degraded items: wires → cloth
 *  (insulation rotted), chips → scrap (silicon shot), bandages → cloth (gauze
 *  weathered). Reads as "this stuff has been sitting too long." */
export const COMPONENT_LOOT_CORRODED: Record<string, ComponentLoot> = {
  red_wire:     { id: 'cloth' },               // rope → cloth (degraded)
  yellow_wire:  { id: 'cloth' },               // cloth×2 → cloth×1 (less)
  chip:         { id: 'scrap' },               // bullet → scrap (silicon shot)
  fuse:         { id: 'scrap' },               // bullet → scrap
  scrap_chunk:  { id: 'scrap' },               // scrap×2 → scrap×1
  cloth_scrap:  { id: 'cloth' },               // cloth×2 → cloth×1
  bandage_pack: { id: 'cloth' },               // bandage → cloth (gauze rotted)
};

/** AAT — pristine bonus. The LAST extract from a pristine panel upgrades to a
 *  premium roll (mostly ammo bundles). Rewards finding the rare intact wreck. */
export const COMPONENT_LOOT_PRISTINE_BONUS: ComponentLoot = {
  id: 'scrap_bullet', count: 3,
};
