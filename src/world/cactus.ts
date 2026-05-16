// Saguaro-style cacti scattered across the desert. Player aims + E to harvest
// → cactus_pulp item. Once harvested, the visual changes and the prompt
// disappears (the cactus is filtered out of interactable targets).

import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { Rng } from '../core/rng.ts';
import type { Terrain } from '../world/terrain.ts';
import type { BiomeSampler } from './biomes.ts';
import type { GameContext } from '../GameContext.ts';
import { Tuning } from '../config/tuning.ts';

// CC-4 — only the alien variant spawns now (old green saguaro retired).
// Kept as a union for forward-compat if more cactus species ship later.
export type CactusKind = 'alien';

export interface Cactus {
  id: number;
  kind: CactusKind;
  mesh: THREE.Group;
  pos: THREE.Vector3;
  harvested: boolean;
  hovered: boolean;
  /** Fruit + stem meshes — hidden when harvested, re-shown when fruit
   *  regrows (one full day cycle later, CC-4). */
  _fruitMeshes: THREE.Object3D[];
  /** ctx.time.elapsed when this cactus was harvested. Regrowth fires when
   *  elapsed >= _harvestedAt + DAY_LENGTH_SECONDS. 0 means "never harvested
   *  yet" OR "restored from save with unknown harvest time" (in the save
   *  case we re-arm the clock from current elapsed at load). */
  _harvestedAt: number;
}

let _nextId = 1;

function tag(root: THREE.Object3D, id: number): void {
  root.traverse((o) => {
    o.userData.interactType = 'harvest';
    o.userData.interactId = id;
    o.userData.interactRegistry = 'cacti';
  });
}

function untag(root: THREE.Object3D): void {
  root.traverse((o) => {
    delete o.userData.interactType;
    delete o.userData.interactId;
    delete o.userData.interactRegistry;
  });
}

// Alien variant (Session W; recolored CC-4) — a bulbous grey pod with 3-4
// colored fruit nodes on short stems. The base now reads as weathered
// desert stone rather than the original teal-blue so the FRUIT pops as
// the single saturated element on the cactus. Returns the assembled
// group AND the list of fruit + stem meshes so the harvest path can
// hide them (and the regrowth tick can re-show them).
function makeAlienCactus(rand: Rng): { group: THREE.Group; fruitMeshes: THREE.Object3D[] } {
  const g = new THREE.Group();
  const fruitMeshes: THREE.Object3D[] = [];
  const podMat = new THREE.MeshLambertMaterial({
    color: 0x7a7268,         // warm grey, weathered-stone tone
    flatShading: true,
  });
  const fruitMat = new THREE.MeshLambertMaterial({
    color: 0x3aa8ae,
    emissive: 0x1a5a60,
    emissiveIntensity: 0.7,
    flatShading: true,
  });
  const stemMat = new THREE.MeshLambertMaterial({
    color: 0x5a544c,         // darker grey to match the pod
    flatShading: true,
  });

  // Bulbous main body
  const baseR = 0.45 + rand() * 0.15;
  const pod = new THREE.Mesh(new THREE.IcosahedronGeometry(baseR, 1), podMat);
  pod.position.y = baseR * 0.9;
  pod.scale.set(1, 1.15, 1);
  g.add(pod);

  // Smaller bulge on top — gives it an organic, alien feel
  const top = new THREE.Mesh(
    new THREE.IcosahedronGeometry(baseR * 0.55, 1),
    podMat,
  );
  top.position.y = baseR * 1.85;
  g.add(top);

  // 3-4 fruit nodes on short stems poking from the upper body
  const fruitCount = 3 + Math.floor(rand() * 2);
  for (let i = 0; i < fruitCount; i++) {
    const a = (i / fruitCount) * Math.PI * 2 + rand() * 0.4;
    const h = baseR * (1.0 + rand() * 0.6);
    const r = baseR * 0.82;
    const stemLen = 0.10 + rand() * 0.08;
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.026, stemLen, 5),
      stemMat,
    );
    stem.position.set(
      Math.cos(a) * r,
      h + stemLen / 2,
      Math.sin(a) * r,
    );
    stem.rotation.z = Math.cos(a) * -0.4;
    stem.rotation.x = Math.sin(a) * 0.4;
    g.add(stem);
    fruitMeshes.push(stem);

    const fruit = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.10 + rand() * 0.03, 1),
      fruitMat,
    );
    fruit.position.set(
      Math.cos(a) * (r + 0.12),
      h + stemLen + 0.05,
      Math.sin(a) * (r + 0.12),
    );
    g.add(fruit);
    fruitMeshes.push(fruit);
  }

  return { group: g, fruitMeshes };
}

/** Mean of pairwise height-differences across a 4-sample cross around (x,z).
 *  Higher = steeper. Cheap stand-in for slope when terrain has no normal API. */
function terrainFlatnessAt(terrain: Terrain, cx: number, cz: number, r = 1.2): number {
  const c = terrain.heightAt(cx, cz);
  const e = terrain.heightAt(cx + r, cz);
  const w = terrain.heightAt(cx - r, cz);
  const n = terrain.heightAt(cx, cz - r);
  const s = terrain.heightAt(cx, cz + r);
  return Math.max(
    Math.abs(e - c), Math.abs(w - c),
    Math.abs(n - c), Math.abs(s - c),
  );
}

export function spawnCacti(
  scene: THREE.Scene,
  physicsWorld: RAPIER.World,
  terrain: Terrain,
  rand: Rng,
  biomes: BiomeSampler,
): Cactus[] {
  const list: Cactus[] = [];
  // CC-4 — alien cactus is the ONLY variant, restricted to flat-enough
  // salt ground. GG — count + radius bounds rescaled for the 2400m world.
  // Rejection-sample candidate spots until we hit TARGET placements or
  // burn MAX_ATTEMPTS.
  const TARGET = Tuning.CACTUS_TARGET_COUNT;
  const MAX_ATTEMPTS = TARGET * 60;        // keep the 60 attempts/target ratio from CC-4
  const FLATNESS_THRESHOLD = 0.6;          // max |dY/1.2m| sampled in 4 directions
  const RADIUS_MIN = Tuning.CACTUS_SCATTER_RADIUS_MIN;
  const RADIUS_SPAN = Tuning.CACTUS_SCATTER_RADIUS_MAX - RADIUS_MIN;
  let attempts = 0;
  while (list.length < TARGET && attempts < MAX_ATTEMPTS) {
    attempts++;
    const radius = RADIUS_MIN + rand() * RADIUS_SPAN;
    const angle = rand() * Math.PI * 2;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    if (biomes.biomeAt(x, z) !== 'salt') continue;
    if (terrainFlatnessAt(terrain, x, z) > FLATNESS_THRESHOLD) continue;
    const y = terrain.heightAt(x, z);

    const kind: CactusKind = 'alien';
    const built = makeAlienCactus(rand);
    const mesh = built.group;
    // Bury the base ~0.25m so the pod doesn't show a gap on slight slopes.
    mesh.position.set(x, y - 0.25, z);
    mesh.rotation.y = rand() * Math.PI * 2;
    mesh.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });

    // Static collider — single cylinder approximating the pod.
    const bodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(x, y + 1, z);
    const body = physicsWorld.createRigidBody(bodyDesc);
    const colliderDesc = RAPIER.ColliderDesc.cylinder(1, 0.20);
    physicsWorld.createCollider(colliderDesc, body);

    const id = _nextId++;
    tag(mesh, id);
    scene.add(mesh);

    list.push({
      id,
      kind,
      mesh,
      pos: new THREE.Vector3(x, y, z),
      harvested: false,
      hovered: false,
      _fruitMeshes: built.fruitMeshes,
      _harvestedAt: 0,
    });
  }
  return list;
}

/** Mark a cactus as harvested — hide the fruit + stems, record the
 *  timestamp so the regrowth tick can re-show them later, untag so the
 *  interaction system stops surfacing the cactus until fruit returns. */
export function harvestCactus(cactus: Cactus, elapsed: number): void {
  if (cactus.harvested) return;
  cactus.harvested = true;
  cactus._harvestedAt = elapsed;
  for (const f of cactus._fruitMeshes) f.visible = false;
  // Untag so the interaction raycast no longer surfaces this cactus
  // until fruit regrows.
  untag(cactus.mesh);
}

/** Per-frame regrowth tick (CC-4). Iterates harvested cacti and re-shows
 *  their fruit when a full DAY_LENGTH_SECONDS has elapsed since harvest.
 *  Cheap — usually 0–3 entries in `harvested` state at any time. */
export function updateCacti(ctx: GameContext): void {
  const now = ctx.time.elapsed;
  for (const c of ctx.cacti.list) {
    if (!c.harvested) continue;
    if (now - c._harvestedAt < Tuning.DAY_LENGTH_SECONDS) continue;
    // Regrow: show fruit + stems, retag as harvestable.
    c.harvested = false;
    c._harvestedAt = 0;
    for (const f of c._fruitMeshes) f.visible = true;
    tag(c.mesh, c.id);
  }
}

export function findCactusById(list: Cactus[], id: number | undefined): Cactus | null {
  if (id === undefined) return null;
  for (const c of list) if (c.id === id) return c;
  return null;
}

/** Bump the module-level id counter past `n` so future spawns don't collide
 *  with restored ids. Used by save/load. */
export function setNextCactusId(n: number): void {
  if (n > _nextId) _nextId = n;
}
