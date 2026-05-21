// Loot containers — a subset of the scattered wreckage in the world is
// flagged as "searchable". The player aims + E to open a small overlay
// showing the contents; click each item row to transfer to inventory.
//
// Containers piggyback on the wreckage meshes that landmarks.ts already
// spawns — we accept a list of candidate meshes + positions and tag a
// random subset as searchable.

import * as THREE from 'three';
import type { Rng } from '../core/rng.ts';
import type { Terrain } from '../world/terrain.ts';
import type { ItemId, ItemMeta } from '../inventory/types.ts';
import { Tuning } from '../config/tuning.ts';

export interface LootEntry {
  itemId: ItemId;
  count: number;
  meta?: ItemMeta;
}

export interface LootContainer {
  id: number;
  mesh: THREE.Object3D;
  pos: THREE.Vector3;
  contents: LootEntry[];
  opened: boolean;     // true once the player has opened it (visual cue)
}

let _nextId = 1;

function tag(root: THREE.Object3D, id: number): void {
  root.traverse((o) => {
    o.userData.interactType = 'search';
    o.userData.interactId = id;
    o.userData.interactRegistry = 'lootContainers';
  });
}

function rollLoot(rand: Rng): LootEntry[] {
  const contents: LootEntry[] = [];
  // AAL — entries-per-container + drop balance lifted to Tuning.LOOT_CONTAINER_*.
  const entries = Tuning.LOOT_CONTAINER_ENTRIES_MIN +
    Math.floor(rand() * (Tuning.LOOT_CONTAINER_ENTRIES_MAX - Tuning.LOOT_CONTAINER_ENTRIES_MIN + 1));
  for (let i = 0; i < entries; i++) {
    const r = rand();
    if (r < Tuning.LOOT_CONTAINER_BANDAGE_THRESHOLD) {
      contents.push({ itemId: 'bandage', count: 1 });
    } else if (r < Tuning.LOOT_CONTAINER_CLOTH_THRESHOLD) {
      contents.push({ itemId: 'cloth', count: 1 + Math.floor(rand() * Tuning.LOOT_CONTAINER_CLOTH_COUNT_MAX) });
    } else if (r < Tuning.LOOT_CONTAINER_SCRAP_THRESHOLD) {
      contents.push({ itemId: 'scrap', count: 1 + Math.floor(rand() * Tuning.LOOT_CONTAINER_SCRAP_COUNT_MAX) });
    } else if (r < Tuning.LOOT_CONTAINER_CANTEEN_THRESHOLD) {
      const fill = Tuning.LOOT_CONTAINER_CANTEEN_FILL_MIN + rand() * Tuning.LOOT_CONTAINER_CANTEEN_FILL_RANGE;
      contents.push({ itemId: 'canteen', count: 1, meta: { fillLevel: fill } });
    } else {
      contents.push({ itemId: 'machete', count: 1 });
    }
  }
  return contents;
}

/**
 * Given a list of candidate wreckage meshes (with their world positions),
 * tag a random fraction as searchable loot containers.
 */
export function spawnLootContainers(
  candidates: Array<{ mesh: THREE.Object3D; pos: THREE.Vector3 }>,
  rand: Rng,
  fraction: number = 0.5,
): LootContainer[] {
  const list: LootContainer[] = [];
  for (const c of candidates) {
    if (rand() > fraction) continue;
    const contents = rollLoot(rand);
    if (contents.length === 0) continue;
    const id = _nextId++;
    tag(c.mesh, id);
    list.push({
      id,
      mesh: c.mesh,
      pos: c.pos.clone(),
      contents,
      opened: false,
    });
  }
  return list;
}

export function findLootContainerById(
  list: LootContainer[],
  id: number | undefined,
): LootContainer | undefined {
  if (id === undefined) return undefined;
  return list.find((c) => c.id === id);
}

/** Make a small wooden-crate primitive. Distinctive enough to spot. */
function makeCrate(rand: Rng): THREE.Group {
  const g = new THREE.Group();
  const woodMat = new THREE.MeshLambertMaterial({ color: 0x6a4a2a });
  const trimMat = new THREE.MeshLambertMaterial({ color: 0x3a2818 });
  const w = 0.42 + rand() * 0.14;
  const h = 0.38 + rand() * 0.10;
  const d = 0.42 + rand() * 0.14;
  const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), woodMat);
  box.position.y = h / 2;
  g.add(box);
  // Corner reinforcements: 4 thin verticals
  const cw = 0.04;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(cw, h, cw), trimMat);
    beam.position.set(sx * (w / 2 - cw / 2), h / 2, sz * (d / 2 - cw / 2));
    g.add(beam);
  }
  // Small dent — slight rotation gives weathered look
  g.rotation.y = rand() * Math.PI * 2;
  g.rotation.z = (rand() - 0.5) * 0.15;
  return g;
}

/** Spawn standalone loot crates (no dependency on existing landmarks). */
export function spawnStandaloneLootContainers(
  scene: THREE.Scene,
  terrain: Terrain,
  rand: Rng,
  count: number = 12,
): LootContainer[] {
  const list: LootContainer[] = [];
  for (let i = 0; i < count; i++) {
    const radius = 15 + rand() * 230;
    const angle = rand() * Math.PI * 2;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const y = terrain.heightAt(x, z);
    const mesh = makeCrate(rand);
    mesh.position.set(x, y, z);
    mesh.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });
    const contents = rollLoot(rand);
    if (contents.length === 0) continue;
    const id = _nextId++;
    tag(mesh, id);
    scene.add(mesh);
    list.push({
      id,
      mesh,
      pos: new THREE.Vector3(x, y, z),
      contents,
      opened: false,
    });
  }
  return list;
}
