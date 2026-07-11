// Salvage system (Session T). Every wreck (hero landmark + massive POI) is a
// finite loot source: hover → press E → 1.5s progress → roll loot per wreck
// kind → decrement salvageRemaining. When it hits zero the wreck is stripped:
// the prompt reads "stripped" and a desaturation walk dims its meshes.
//
// Ribcages are organic — explicitly NOT registered (the caller decides).

import * as THREE from 'three';
import type { ItemId, ItemMeta } from '../inventory/types.ts';
import type { Rng } from '../core/rng.ts';
import type { WreckKind } from './wrecks.ts';
import type { BiomeSampler } from './biomes.ts';
import { Tuning } from '../config/tuning.ts';

export type SalvageKind = WreckKind | 'massive' | 'escape_pod';   // ACBD — 'escape_pod' is a loot palette (medical); the wreck MODEL was removed but the palette stays

/** AAT — per-panel condition tier. Set deterministically at
 *  registerSalvageable time from (rand + biome-at-pos). Affects pry
 *  duration, max-extract count, loot quality, and visual appearance.
 *  Persists implicitly via deterministic re-derivation on save load. */
export type SalvageCondition = 'corroded' | 'standard' | 'pristine';

// AAT — module-level biome singleton. Set once at boot from main.ts
// after the biome sampler is built. registerSalvageable uses it to
// look up biome-at-pos without a signature change to every caller.
// Defensive default: if not set (e.g. early-boot calls before
// setSalvageBiomesContext fires), conditions default to base
// distribution with no biome bias.
let _biomes: BiomeSampler | null = null;
export function setSalvageBiomesContext(b: BiomeSampler): void { _biomes = b; }

export interface LootEntry {
  id: ItemId;
  count?: number;
  meta?: ItemMeta;
}

export interface Salvageable {
  id: number;
  kind: SalvageKind;
  /** AAT — per-panel condition tier, set at registration. */
  condition: SalvageCondition;
  /** The full wreck group the panel belongs to. The wreck itself is NOT
   *  interactive; only `panel` is. (ACAX — no longer dimmed on depletion.) */
  mesh: THREE.Object3D;
  /** Small access panel embedded in the wreck. The interaction raycast targets
   *  this mesh; the wreck root carries no interact userData (Session Z). */
  panel: THREE.Object3D;
  pos: THREE.Vector3;
  salvageRemaining: number;
  hovered: boolean;
  /** True once material desaturation has been applied on stripping. */
  stripped: boolean;
  /** Infinite Sands S2 — TRUE for chunk-STREAMED wrecks: excluded from save
   *  serialization (their ids are load-order-dependent, so persisting them
   *  would mis-match on reload — the D290 descriptor model regenerates them
   *  pristine instead; per-chunk diffs arrive at S5). Boot-placed wrecks
   *  leave this unset and persist exactly as before (save schema untouched). */
  transient?: boolean;
}

/** AAT — friendly adjective for the hover prompt. */
export function conditionAdjective(c: SalvageCondition): string {
  switch (c) {
    case 'corroded': return 'rusted';
    case 'pristine': return 'pristine';
    case 'standard': return '';   // no adjective; standard is the default
  }
}

/** AAT — pick a condition deterministically for a panel at position `pos`.
 *  Uses `rand()` for the dice roll + biome-at-pos for the bias. Falls
 *  back to base distribution if the biome singleton hasn't been wired
 *  yet (defensive — pre-AAT call sites still register cleanly). */
function pickCondition(rand: Rng, pos: THREE.Vector3): SalvageCondition {
  const roll = rand();
  // Choose thresholds based on biome at the panel position. Salt-flat
  // wrecks corrode (water + minerals); dune wrecks preserve dry (more
  // pristine); rocky is base distribution. (`: number` widens the
  // Tuning literal types so the bias branches can reassign.)
  let pristineT: number = Tuning.SALVAGE_CONDITION_BASE_PRISTINE_THRESHOLD;
  let standardT: number = Tuning.SALVAGE_CONDITION_BASE_STANDARD_THRESHOLD;
  if (_biomes) {
    const biome = _biomes.biomeAt(pos.x, pos.z);
    if (biome === 'salt') {
      pristineT = Tuning.SALVAGE_CONDITION_SALT_PRISTINE_THRESHOLD;
      standardT = Tuning.SALVAGE_CONDITION_SALT_STANDARD_THRESHOLD;
    } else if (biome === 'dune') {
      pristineT = Tuning.SALVAGE_CONDITION_DUNE_PRISTINE_THRESHOLD;
      standardT = Tuning.SALVAGE_CONDITION_DUNE_STANDARD_THRESHOLD;
    }
  }
  if (roll < pristineT) return 'pristine';
  if (roll < standardT) return 'standard';
  return 'corroded';
}

/** Public friendly name for the prompt. */
export function shortNameFor(kind: SalvageKind): string {
  switch (kind) {
    case 'engine_cluster':  return 'engine cluster';
    case 'fuselage':        return 'fuselage';
    case 'escape_pod':      return 'escape pod';
    case 'cargo_container': return 'cargo container';
    case 'engine_bell':     return 'engine bell';
    case 'massive':         return 'wreck';
  }
}

export interface SalvageableRegistry {
  list: Salvageable[];
  nextId: number;
}

export function createSalvageableRegistry(): SalvageableRegistry {
  return { list: [], nextId: 1 };
}

/** Tag the wreck group's access panel + push a record into the registry. The
 *  wreck root itself is left untagged — only the panel is interactable
 *  (Session Z, tactile salvage). Wreck constructors stash the panel on
 *  `group.userData.accessPanel`; if missing we fall back to tagging the group
 *  for legacy compatibility. */
export function registerSalvageable(
  registry: SalvageableRegistry,
  group: THREE.Object3D,
  kind: SalvageKind,
  pos: THREE.Vector3,
  rand: Rng,
): Salvageable {
  const id = registry.nextId++;
  // AAT — pick condition first; it caps the remaining count for the
  // corroded/pristine variants. Standard keeps the AAR baseline ranges.
  const condition = pickCondition(rand, pos);
  let remaining: number;
  if (condition === 'corroded') {
    // Corroded — capped low; 1-2 extracts (most of the panel is rust).
    remaining = Math.min(
      Tuning.SALVAGE_CONDITION_MAX_EXTRACTS_CORRODED,
      1 + Math.floor(rand() * 2),
    );
  } else if (condition === 'pristine') {
    // Pristine — full 5 extracts (panel has the last "premium" slot too).
    remaining = Tuning.SALVAGE_CONDITION_MAX_EXTRACTS_PRISTINE;
  } else {
    // Standard — ACAX: massive 4-6, others 3-4 (bumped from 2-3 so the common panels
    // read a bit fuller now the structural fixtures live at the higher indices).
    remaining = kind === 'massive'
      ? 4 + Math.floor(rand() * 3)
      : 3 + Math.floor(rand() * 2);
  }
  const panel = (group.userData.accessPanel as THREE.Object3D | undefined) ?? group;
  // ACAX — WYSIWYG salvage: the number of VISIBLE interior components must equal
  // the number you can extract. The panel mesh builds a full set of lootable
  // components; here we cap `remaining` to how many actually exist, then HIDE the
  // surplus so what you see is exactly what you can salvage (a corroded panel shows
  // ~1-2 components, not a packed cavity you can only take 2 things from). Each
  // visible component disappears as it's extracted → the cavity empties realistically.
  const allComponents = (panel.userData.panelComponents as THREE.Object3D[] | undefined) ?? [];
  if (allComponents.length > 0) remaining = Math.min(remaining, allComponents.length);
  for (let i = remaining; i < allComponents.length; i++) allComponents[i].visible = false;
  panel.userData.interactType = 'salvage';
  panel.userData.interactId = id;
  panel.userData.interactRegistry = 'salvageables';
  // AAT — stash condition on the panel mesh too so wrecks.ts /
  // interaction.ts can read it without a Salvageable lookup. Door
  // material variant is applied here since wrecks.ts addAccessPanel
  // already ran and stashed door + materials we can mutate.
  panel.userData.panelCondition = condition;
  applyConditionVisuals(panel, condition);
  const record: Salvageable = {
    id,
    kind,
    condition,
    mesh: group,
    panel,
    pos: pos.clone(),
    salvageRemaining: remaining,
    hovered: false,
    stripped: false,
  };
  registry.list.push(record);
  return record;
}

// AAT — per-condition door + rim material variants. Built once at
// module load; the `_panelDoorMat` baseline lives in wrecks.ts so we
// shadow it here with our own variants that get swapped onto the door
// mesh's material slot when a non-standard condition is picked.
const _doorMatCorroded = new THREE.MeshLambertMaterial({
  color: 0x8a4a28,             // heavy rust orange-brown
  flatShading: true,
});
const _doorMatPristine = new THREE.MeshLambertMaterial({
  color: 0x7a7a82,             // cooler grey, almost steel
  flatShading: true,
  emissive: 0x080a0e,           // faint cool sheen
});

/** AAT — apply per-condition visual differentiation to a panel.
 *  Currently a door material swap; rim material could also vary if
 *  the silhouette needs more differentiation. Standard panels are
 *  the AAR baseline (no change). */
function applyConditionVisuals(panel: THREE.Object3D, condition: SalvageCondition): void {
  if (condition === 'standard') return;
  const hinge = panel.userData.panelDoor as THREE.Object3D | undefined;
  if (!hinge) return;
  const targetMat = condition === 'corroded' ? _doorMatCorroded : _doorMatPristine;
  // The door mesh is the first child of the hinge group (see
  // wrecks.ts addAccessPanel). Swap its material; leave the rivets +
  // handle on the standard rim/door material so the door reads as
  // "weathered substrate with metal accents."
  const doorMesh = hinge.children.find((c) => (c as THREE.Mesh).isMesh) as THREE.Mesh | undefined;
  if (doorMesh) doorMesh.material = targetMat;
}

export function findSalvageableById(
  list: Salvageable[],
  id: number,
): Salvageable | undefined {
  for (const s of list) if (s.id === id) return s;
  return undefined;
}

// ────────────────────────────────────────────────────────────────
// Loot tables. Weighted independent rolls — each entry is "roll
// the dice once; if it hits, append to the loot list."
// ────────────────────────────────────────────────────────────────

interface LootRoll {
  id: ItemId;
  chance: number;
  count?: number;
}

// Session AAB — tables rebalanced for stronger per-kind identity, so
// players gain real exploration choice ("I need rope → fuselages /
// cargo / massive are best" instead of strip-anything-nearby). Each
// kind now has a clear thematic signature:
//   engine kinds        → scrap-pure metal (cabling = occasional rope)
//   fuselage            → cloth + bandage + rope (interior textiles + wiring)
//   escape_pod          → medical (bandages first, cloth secondary)
//   cargo_container     → varied lottery (scrap, cloth, branch, tent_kit chance, rope)
//   massive             → rich mix of everything including rope
const TABLES: Record<SalvageKind, LootRoll[]> = {
  // Engine wrecks — pure metal. Rope drops are cabling/hoses pulled
  // from the engine bay. Occasional scrap_bullet from ammunition stowed
  // near the engine block.
  engine_cluster: [
    { id: 'scrap',         chance: 0.90, count: 2 },
    { id: 'scrap',         chance: 0.50 },
    { id: 'rope',          chance: 0.10 },
    { id: 'scrap_bullet',  chance: 0.12 },   // AAL — bumped 0.05 → 0.12; ammo was scrap_bullet-recipe-dependent in practice
  ],
  // Fuselage — interior textiles + bulkhead cabling. The cloth/rope
  // wreck of choice.
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
  // Massive POIs — richer rolls, includes rope. AAL — added energy_pistol
  // (was an orphan ItemDef + combat spec that never spawned in world) +
  // scrap_bullet on massive wrecks so ammo isn't gated on the scrap recipe
  // pipeline alone.
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
    // ACY — amban rifle was dev-loadout-only (orphan ItemDef + combat spec).
    // Make it the rarest hero find on massive wrecks (mirrors energy_pistol,
    // a notch rarer — it's the top-tier marksman weapon). Ammo shares the
    // scrap_bullet pipeline, so finding one is immediately usable.
    { id: 'amban_rifle',   chance: 0.02 },
    // ACAC — pulse rifle: the rarest hero find (rapid-fire energy carbine, no
    // ammo item — its cell self-recharges, so it's immediately usable).
    { id: 'pulse_rifle',   chance: 0.015 },
  ],
};

export function rollWreckLoot(kind: SalvageKind, rand: Rng): LootEntry[] {
  const table = TABLES[kind];
  const out: LootEntry[] = [];
  for (const r of table) {
    if (rand() < r.chance) {
      out.push({ id: r.id, count: r.count });
    }
  }
  // Guarantee at least one item so a successful salvage never feels empty.
  if (out.length === 0) out.push({ id: 'scrap' });
  return out;
}

/** Mark a panel's wreck as fully stripped. ACAX — this used to DIM every mesh in
 *  the whole wreck group (×0.7) on depletion, a pre-panel-overhaul effect that
 *  made the ENTIRE wreck visibly change colour when a single panel was emptied.
 *  The user asked for that removed — a wreck must NOT recolour at all. We keep
 *  the `stripped` flag (it's persisted in the save schema — no version bump) but
 *  do NO visual change; the emptied cavity + the "— stripped" prompt are the only
 *  cues. (`s.mesh` is retained on the type for potential future use.) */
export function markSalvageStripped(s: Salvageable): void {
  if (s.stripped) return;
  s.stripped = true;
}
