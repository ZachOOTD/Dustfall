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
    // Scavenger's Economy (build 2) — an engine block yields machinery (primary)
    // + the odd bit of tube. APPENDED (existing rolls keep their rng sequence).
    { id: 'machine_part',  chance: 0.30 },
    { id: 'metal_pipe',    chance: 0.12 },
  ],
  // Fuselage — interior textiles + bulkhead cabling. The cloth/rope wreck of choice.
  fuselage: [
    { id: 'cloth',      chance: 0.70 },
    { id: 'cloth',      chance: 0.30 },
    { id: 'scrap',      chance: 0.35 },
    { id: 'bandage',    chance: 0.25 },
    { id: 'rope',       chance: 0.15 },
    { id: 'flashlight', chance: 0.04 },
    // Scavenger's Economy (build 2) — debris fields / derelicts carry salvaged
    // tube (secondary) + the odd loose cable.
    { id: 'metal_pipe', chance: 0.22 },
    { id: 'wiring',     chance: 0.12 },
  ],
  // Escape pod — medical kit + survival gear. Bandage-heavy.
  escape_pod: [
    { id: 'bandage', chance: 0.80 },
    { id: 'bandage', chance: 0.30 },
    { id: 'cloth',   chance: 0.35 },
    { id: 'scrap',   chance: 0.20 },
    { id: 'branch',  chance: 0.08 },
    // Scavenger's Economy (build 2) — this is the SalvageKind shared by the
    // electronic POIs (satellite / relay_mast / hab_dome) + actual escape pods,
    // so it owns wiring (primary) + battery (secondary) — the powered-wreck loot.
    { id: 'wiring',  chance: 0.45 },
    { id: 'battery', chance: 0.28 },
  ],
  // Cargo container — varied lottery + rope (lashing material).
  cargo_container: [
    { id: 'scrap',    chance: 0.45 },
    { id: 'cloth',    chance: 0.35 },
    { id: 'bandage',  chance: 0.20 },
    { id: 'branch',   chance: 0.25 },
    { id: 'rope',     chance: 0.15 },
    { id: 'tent_kit', chance: 0.04 },
    // Scavenger's Economy (build 2) — the SalvageKind shared by the industrial
    // ground POIs (buried_pipeline / refinery / transit_car / cargo_crawler /
    // wrecked_tank / well): metal_pipe + machine_part (their identity split),
    // with a rare loose cable. Ground scatter carries the precise per-POI identity.
    { id: 'metal_pipe',   chance: 0.30 },
    { id: 'machine_part', chance: 0.24 },
    { id: 'wiring',       chance: 0.08 },
  ],
  // Engine bell — pure scrap, occasional rope (cabling around the nozzle).
  engine_bell: [
    { id: 'scrap', chance: 1.00, count: 2 },
    { id: 'scrap', chance: 0.60 },
    { id: 'rope',  chance: 0.05 },
    // Scavenger's Economy (build 2) — a bit of machinery stowed in the nozzle housing.
    { id: 'machine_part', chance: 0.18 },
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
    // Scavenger's Economy (build 2) — massive/hero wrecks (husks, enterable
    // wrecks, Skyfall, leviathan) are the RICHEST single material stops: they
    // earn the walk with machine_part + wiring, plus tube + the odd power cell.
    { id: 'machine_part',  chance: 0.40 },
    { id: 'wiring',        chance: 0.35 },
    { id: 'metal_pipe',    chance: 0.20 },
    { id: 'battery',       chance: 0.15 },
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
 *  fallback tail.
 *
 *  Scavenger's Economy (build 2) — the four materials are woven in as UNCOMMON
 *  buckets (~5-7% each) between scrap and canteen; the surrounding buckets were
 *  narrowed slightly to make room (bandage 25→22%, cloth 30→26%, scrap 20→18%,
 *  canteen 17→5.5%, machete 8→4.5%). Old buckets: bandage 25 / cloth 30 / scrap
 *  20 / canteen 17 / machete 8. This drift is INTENDED (loot-digest baseline
 *  regenerated this cycle). */
export const CONTAINER_LOOT: ContainerLootOption[] = [
  { id: 'bandage',      threshold: 0.22 },
  { id: 'cloth',        threshold: 0.48, countMax: 2 },
  { id: 'scrap',        threshold: 0.66, countMax: 3 },
  { id: 'metal_pipe',   threshold: 0.73 },
  { id: 'machine_part', threshold: 0.79 },
  { id: 'wiring',       threshold: 0.85 },
  { id: 'battery',      threshold: 0.90 },
  { id: 'canteen',      threshold: 0.955, canteenFill: true },
  { id: 'machete',      threshold: 1.00 },
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
// Scavenger's Economy (build 2) — red_wire (a stripped cable) now yields `wiring`
// (was rope; rope still drops from engine/fuselage/cargo/massive panels). The
// "cabling components → wiring" teach the proposal called for. yellow_wire stays
// cloth for material variety.
export const COMPONENT_LOOT: Record<string, ComponentLoot> = {
  red_wire:     { id: 'wiring' },
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

// ════════════════════════════════════════════════════════════════
// 4. POI GROUND SCATTER — per-ARCHETYPE identity material pickups
// ════════════════════════════════════════════════════════════════
//
// Scavenger's Economy (build 2) — the D299 scrap-ring pattern scatters `scrap`
// pickups around every wreck; this adds 1-3 of the POI's IDENTITY material as
// ground pickups so the drop matrix is legible WITHOUT prying a panel ("this is
// the pipeline → pipes lie around it"). Keyed by ARCHETYPE id (the precise
// identity — salvage panels can only distinguish by the coarser SalvageKind).
//
// Each roll is diced independently (`chance`); `count` = how many INDEPENDENT
// attempts at that id (so `{chance:0.9,count:2}` ≈ 1.8 expected pipes). The
// chunkManager streamer draws these on an INDEPENDENT renderSeed-derived rng so
// it never disturbs the scrap-ring / salvage-panel draw sequences (determinism).
// The `bone_field` biome is excluded at the call site (boneyard = scrap only).
//
// P = primary (high chance + count), s = secondary (lower). Matches the approved
// matrix: pipeline→pipe P · refinery→pipe P,wiring s · transit_car→pipe P,
// machine_part s · debris→pipe s · wrecked_tank→machine_part P · cargo_crawler→
// machine_part P · satellite/relay_mast/hab_dome→wiring P,battery s.
//
// WALK-TEST FIX (2026-07-17, Zach: "only seeing scrap at most POIs — need the
// other materials to show up more often on the ground around wrecks and POIs"):
// abundance bumped so a specialty POI CLEARLY out-yields a generic wreck for its
// identity material. Primaries → chance 0.95 count 3 (≈2.85 expected); material
// SECONDARIES → 0.6 count 2 (≈1.2 expected). BATTERY is the deliberate exception
// (it gates the powered recipes → stays the scarcest find): battery secondary is
// a single 0.5 roll (≈0.5 expected). The scrap-dominant generic hulls (derelict /
// hollow_husk / enterable_wreck / crash_husk / ship) were REMOVED from this map —
// they now fall through to WRECK_GENERIC_SCATTER via scatterForArchetype() so
// EVERY wreck teaches "materials exist," while these keys keep the RICH identity.
export const POI_IDENTITY_SCATTER: Record<string, LootRoll[]> = {
  buried_pipeline: [{ id: 'metal_pipe', chance: 0.95, count: 3 }],
  refinery_stack:  [{ id: 'metal_pipe', chance: 0.95, count: 3 }, { id: 'wiring', chance: 0.6, count: 2 }],
  transit_car:     [{ id: 'metal_pipe', chance: 0.95, count: 3 }, { id: 'machine_part', chance: 0.6, count: 2 }],
  debris_field:    [{ id: 'metal_pipe', chance: 0.6, count: 2 }],
  debris_trail:    [{ id: 'metal_pipe', chance: 0.6, count: 2 }],
  wrecked_tank:    [{ id: 'machine_part', chance: 0.95, count: 3 }],
  cargo_crawler:   [{ id: 'machine_part', chance: 0.95, count: 3 }],
  well:            [{ id: 'metal_pipe', chance: 0.6, count: 2 }],
  satellite:       [{ id: 'wiring', chance: 0.95, count: 3 }, { id: 'battery', chance: 0.5 }],
  relay_mast:      [{ id: 'wiring', chance: 0.95, count: 3 }, { id: 'battery', chance: 0.5 }],
  hab_dome:        [{ id: 'wiring', chance: 0.95, count: 3 }, { id: 'battery', chance: 0.5 }],
};

// WALK-TEST FIX (2026-07-17) — the "every wreck teaches materials exist" table.
// Any wreck WITHOUT a specialty identity (the generic hulls derelict / hollow_husk
// / enterable_wreck / crash_husk / ship, AND every kind-based boot/hero wreck —
// fuselage, cargo_container, engine_*, the 'massive' anchors, legacy procgen)
// rolls this mixed table beside its scrap ring. Independent rolls → ≈1.45 expected
// materials/wreck (pipe .5 / machine_part .4 / wiring .35 / battery .2), so a
// walk-up to ANY wreck usually reveals 1-2 materials while a specialty POI still
// clearly out-yields it for its identity item. Battery lowest here too (scarcest).
export const WRECK_GENERIC_SCATTER: LootRoll[] = [
  { id: 'metal_pipe',   chance: 0.5 },
  { id: 'machine_part', chance: 0.4 },
  { id: 'wiring',       chance: 0.35 },
  { id: 'battery',      chance: 0.2 },
];

/** WALK-TEST FIX (2026-07-17) — resolve the ground-scatter table for a wreck by
 *  its archetype id. Specialty POIs return their RICH identity table; anything
 *  else (unknown/undefined archetype, or a generic hull) falls back to the mixed
 *  WRECK_GENERIC_SCATTER so no wreck is scrap-only. Used by BOTH the origin-world
 *  boot scatter (main.ts) and the far-field chunk streamer (chunkManager). */
export function scatterForArchetype(archetype: string | undefined): LootRoll[] {
  return (archetype && POI_IDENTITY_SCATTER[archetype]) || WRECK_GENERIC_SCATTER;
}
