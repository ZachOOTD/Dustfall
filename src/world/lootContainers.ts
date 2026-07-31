// Loot containers — a searchable crate. The player aims + E to open a small overlay showing the
// contents; click each item row to transfer to inventory.
//
// WALK-TEST 2026-07-30 — A CONTAINER ONLY EXISTS BESIDE A BODY. Zach: *"lets make it so those loot
// boxes only spawn next to skeletons in caves. doesn't really make sense for them to be on their own
// if the world is supposed to be empty. at least beside the skeletons the loot has a story/purpose."*
// So this file offers exactly ONE spawn entry point — `spawnLootContainerAt`, called by the
// dead-explorer tableau (deadExplorer.ts) and by nothing else. The two former world-scatter
// spawners are deleted rather than left dead: an unreferenced but working orphan-crate spawner is
// how that rule quietly comes back.

import * as THREE from 'three';
import type { Rng } from '../core/rng.ts';
import type { ItemId, ItemMeta } from '../inventory/types.ts';

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

// WALK-TEST 2026-07-30 — THE TWO ORPHAN-CRATE SPAWNERS ARE DELETED, not left dead.
// `spawnLootContainers` (tag a fraction of wreckage as searchable) and
// `spawnStandaloneLootContainers` (12 crates scattered 15-245m from origin) had already fallen out
// of the boot path at some earlier point and sat here unreferenced. Zach: *"doesn't really make
// sense for them to be on their own if the world is supposed to be empty. at least beside the
// skeletons the loot has a story/purpose."* Leaving a working orphan-crate spawner in the file is
// how that rule quietly comes back — the only way to spawn a container now is beside a body, via
// `spawnLootContainerAt` from a dead-explorer tableau.

export function findLootContainerById(
  list: LootContainer[],
  id: number | undefined,
): LootContainer | undefined {
  if (id === undefined) return undefined;
  return list.find((c) => c.id === id);
}

/** Make a small wooden-crate primitive. Distinctive enough to spot.
 *
 *  DEEPER cycle 12 — `opts.muted` is for crates read UNDERGROUND at torch range. The shipped colour
 *  (`0x6a4a2a`) is a saturated mid-brown chosen to be spottable across open desert under daylight;
 *  lit by a warm torch at 1.5m against muted bone and grey stone it blows out to a bright orange
 *  cube and becomes the loudest thing in the frame — it out-shouts the body it is supposed to sit
 *  beside. The muted variant is greyer and darker so it reads as somebody's weathered supply crate
 *  in a cave. `opts.open` leaves the lid ajar: the dead explorer's cache was already rifled — by
 *  them, not by the player — which is the difference between "their pack" and "a container". */
function makeCrate(rand: Rng, opts: { muted?: boolean; open?: boolean } = {}): THREE.Group {
  const g = new THREE.Group();
  const woodMat = new THREE.MeshLambertMaterial({ color: opts.muted ? 0x4d4335 : 0x6a4a2a });
  const trimMat = new THREE.MeshLambertMaterial({ color: opts.muted ? 0x2b251d : 0x3a2818 });
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
  if (opts.open) {
    // The lid, off and leaning against the crate's side — real thickness (rule 7), never a card.
    const lid = new THREE.Mesh(new THREE.BoxGeometry(w, 0.055, d), woodMat);
    lid.position.set(w * 0.62, h * 0.42, d * 0.1);
    lid.rotation.z = -1.15;
    g.add(lid);
  }
  // Small dent — slight rotation gives weathered look
  g.rotation.y = rand() * Math.PI * 2;
  g.rotation.z = (rand() - 0.5) * 0.15;
  return g;
}

/** UNDERWORLD (2026-07-20) — place ONE crate at a fixed world position with EXPLICIT contents
 *  (deep cave caches: contents are pre-rolled from the cave-cache table by the caller, deterministic).
 *  No terrain snap (the caller knows the cave floor Y), no collider (crates never had one). */
export function spawnLootContainerAt(
  scene: THREE.Scene,
  pos: THREE.Vector3,
  contents: LootEntry[],
  rand: Rng,
  opts: { muted?: boolean; open?: boolean } = {},
): LootContainer {
  const mesh = makeCrate(rand, opts);
  mesh.position.copy(pos);
  mesh.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  const id = _nextId++;
  tag(mesh, id);
  scene.add(mesh);
  return { id, mesh, pos: pos.clone(), contents, opened: false };
}
