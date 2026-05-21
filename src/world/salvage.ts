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

export type SalvageKind = WreckKind | 'massive';

export interface LootEntry {
  id: ItemId;
  count?: number;
  meta?: ItemMeta;
}

export interface Salvageable {
  id: number;
  kind: SalvageKind;
  /** The full wreck group — used by markSalvageStripped to dim every child mesh
   *  on depletion. The wreck itself is NOT interactive; only `panel` is. */
  mesh: THREE.Object3D;
  /** Small access panel embedded in the wreck. The interaction raycast targets
   *  this mesh; the wreck root carries no interact userData (Session Z). */
  panel: THREE.Object3D;
  pos: THREE.Vector3;
  salvageRemaining: number;
  hovered: boolean;
  /** True once material desaturation has been applied on stripping. */
  stripped: boolean;
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
  const remaining = kind === 'massive'
    ? 4 + Math.floor(rand() * 3)   // 4-6
    : 2 + Math.floor(rand() * 2);  // 2-3
  const panel = (group.userData.accessPanel as THREE.Object3D | undefined) ?? group;
  panel.userData.interactType = 'salvage';
  panel.userData.interactId = id;
  panel.userData.interactRegistry = 'salvageables';
  const record: Salvageable = {
    id,
    kind,
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
    { id: 'scrap_bullet',  chance: 0.05 },
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
  // Massive POIs — richer rolls, includes rope.
  massive: [
    { id: 'scrap',      chance: 0.95, count: 2 },
    { id: 'scrap',      chance: 0.75 },
    { id: 'cloth',      chance: 0.65 },
    { id: 'bandage',    chance: 0.45 },
    { id: 'branch',     chance: 0.25 },
    { id: 'rope',       chance: 0.20 },
    { id: 'fire_kit',   chance: 0.05 },
    { id: 'flashlight', chance: 0.08 },
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

/** Dim every mesh under the wreck group by cloning its material and
 *  multiplying the color by 0.7. Materials are shared across wrecks at
 *  module level in wrecks.ts — cloning per mesh protects the originals. */
export function markSalvageStripped(s: Salvageable): void {
  if (s.stripped) return;
  s.stripped = true;
  s.mesh.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const mat = m.material;
    if (Array.isArray(mat)) {
      m.material = mat.map((mm) => dimMaterial(mm));
    } else if (mat) {
      m.material = dimMaterial(mat);
    }
  });
}

function dimMaterial(mat: THREE.Material): THREE.Material {
  // Only clone if it's a material with a `.color` we can darken.
  const anyMat = mat as THREE.Material & { color?: THREE.Color };
  if (!anyMat.color) return mat;
  const clone = mat.clone() as THREE.Material & { color: THREE.Color };
  clone.color.multiplyScalar(0.7);
  return clone;
}
