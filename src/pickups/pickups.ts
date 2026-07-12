// World-spawned pickups. Generic over item type — canteens are just one
// kind. Each pickup links a mesh in the scene to an itemId; the player's
// interaction module raycasts against this list to figure out what's hovered.

import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { Rng } from '../core/rng.ts';
import type { Terrain } from '../world/terrain.ts';
import type { AssetRegistry } from '../assets/loader.ts';
import { cloneAsset } from '../assets/loader.ts';
import { Tuning } from '../config/tuning.ts';
import { stormWindAccel } from '../world/weather.ts';
import type { ItemId, ItemMeta } from '../inventory/types.ts';
import { getItemDef } from '../inventory/items.ts';
import { buildBranchMesh, BRANCH_WOOD_COLOR, BRANCH_WEATHER_LEVEL } from '../world/branchMesh.ts';  // ACAA — shared branch model + shared color
import { buildRelicCoreMesh } from '../world/relicMesh.ts';  // ACAQ — shared relic-core model (wreck-yard exclusive)
import { createWoodGrainMaterial } from '../world/woodGrainMaterial.ts';  // ACAE — dark wood branches
import { buildScrapMesh } from '../world/scrapMesh.ts';  // ACAH — shared scrap model
import { createMetalMaterial } from '../world/metalMaterial.ts';  // ACAH — world scrap material
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';  // ACAH perf — merge world pickups

// ACAH perf — collapse a multi-mesh pickup Group into ONE merged geometry (the
// dead-tree trick). World pickups are static + numerous (~220 scrap, ~140
// branches); a 12-mesh scrap chunk × 220 = ~2600 extra draw calls vs 1 each.
function mergeGroupToGeometry(group: THREE.Group): THREE.BufferGeometry {
  group.updateMatrixWorld(true);
  const geos: THREE.BufferGeometry[] = [];
  group.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && m.geometry) {
      const g = m.geometry.clone();
      g.applyMatrix4(m.matrixWorld);
      // Keep only the attributes merge needs (uniform across primitives).
      for (const name of Object.keys(g.attributes)) {
        if (name !== 'position' && name !== 'normal' && name !== 'uv') g.deleteAttribute(name);
      }
      geos.push(g);
    }
  });
  const merged = mergeGeometries(geos, false);
  geos.forEach((g) => g.dispose());
  return merged;
}

// ACAH perf — SHARED merged geometries, built ONCE. Previously each of ~220 scrap
// + ~140 branches re-ran buildScrapMesh/buildBranchMesh + a merge at boot (~360
// redundant builds → boot stall) AND uploaded its own geometry to the GPU. Now a
// small pool is built once; each pickup is a cheap Mesh sharing a pooled geometry
// (random rotation per spawn keeps the variety). despawnPickup only scene.remove's
// the mesh (never disposes geometry), so sharing is safe.
let _scrapGeo: THREE.BufferGeometry | null = null;
const _branchGeos: THREE.BufferGeometry[] = [];
function _scrapGeometry(): THREE.BufferGeometry {
  if (!_scrapGeo) _scrapGeo = mergeGroupToGeometry(buildScrapMesh(_worldScrapMat, _worldScrapAccentMat));
  return _scrapGeo;
}
function _ensureBranchGeos(): void {
  if (_branchGeos.length === 0) {
    // buildBranchMesh is deterministic without an RNG → a few (len, twigs)
    // variants give shape variety; per-spawn yaw + terrain-align do the rest.
    for (const [len, twigs] of [[0.40, 2], [0.46, 1], [0.52, 2], [0.44, 1], [0.50, 2]] as Array<[number, number]>) {
      _branchGeos.push(mergeGroupToGeometry(buildBranchMesh(_worldBranchMat, { len, twigs })));
    }
  }
}
// M1 pickup-instancing — variant picked by INDEX so the spawn can route to the
// per-variant instanced pool (same single rand draw as the old _branchGeometry(rand);
// the fallback path indexes _branchGeos[variant] directly).
function _branchVariantIndex(rand: Rng): number {
  _ensureBranchGeos();
  return Math.floor(rand() * _branchGeos.length);
}

// ────────────────────────────────────────────────────────────────
// M1 pickup-instancing (campaign 2026-07-09) — seed-spawned branch + scrap
// rendered via shared InstancedMesh POOLS instead of ~367 individual Meshes.
// The ACAH merged-geometry pooling had already collapsed the GEOMETRY cost;
// this collapses the DRAW-CALL cost (1 call per pool vs 1 per pickup: probe
// baseline 852 drawCalls with pickups ≈ 43% of them). Only STATIC seed spawns
// are instanced (branch/scrap: body=null, never bob, never ride sleds);
// canteens/relics/dropped items keep individual meshes (few, or dynamic).
//   - The raycast resolves instanced hits via intersection.instanceId →
//     imesh.userData.instanceToPickupId[instanceId] (interaction.ts), NOT the
//     per-mesh userData.pickupId parent-walk — the shared imesh is never
//     tagged with a single pickupId (it would alias every instance).
//   - despawnPickup FREES the instance slot (swap-with-last, dense [0,count))
//     instead of scene.remove — removing the shared imesh would kill them all.
//   - Pool overflow falls back to the legacy individual-Mesh path (logged),
//     so a seed with unusual scatter counts can never lose pickups.
// ────────────────────────────────────────────────────────────────
export interface PickupInstPool {
  imesh: THREE.InstancedMesh;
  capacity: number;
  count: number;
  /** instance index → pickupId (same array as imesh.userData.instanceToPickupId). */
  ids: number[];
}
const _instPools: PickupInstPool[] = [];
let _scrapPool: PickupInstPool | null = null;
const _branchPools: (PickupInstPool | null)[] = [null, null, null, null, null];
const SCRAP_POOL_CAP = 384;    // probe baseline 227 scrap — generous headroom, 64B/instance
const BRANCH_POOL_CAP = 96;    // per geometry variant (5 pools; baseline 140 total ≈ 28/variant)

function _makeInstPool(scene: THREE.Scene, geo: THREE.BufferGeometry, mat: THREE.Material, capacity: number): PickupInstPool {
  const imesh = new THREE.InstancedMesh(geo, mat, capacity);
  imesh.count = 0;
  imesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);  // slots free on take → matrix rewrites
  imesh.castShadow = false;      // pickups never cast (matches the per-mesh rule below)
  imesh.receiveShadow = true;
  imesh.frustumCulled = false;   // instances span the whole world — no meaningful whole-pool cull
  imesh.userData.noShadow = true;
  const ids: number[] = [];
  imesh.userData.instanceToPickupId = ids;   // the interaction.ts instanceId resolver reads this
  scene.add(imesh);
  const pool: PickupInstPool = { imesh, capacity, count: 0, ids };
  _instPools.push(pool);
  return pool;
}

function _poolAlloc(pool: PickupInstPool, pickupId: number, matrix: THREE.Matrix4): number | null {
  if (pool.count >= pool.capacity) return null;   // full → caller falls back to a legacy Mesh
  const i = pool.count;
  pool.count += 1;
  pool.imesh.count = pool.count;
  pool.imesh.setMatrixAt(i, matrix);
  pool.imesh.instanceMatrix.needsUpdate = true;
  pool.ids[i] = pickupId;
  return i;
}

const _poolFreeMat = new THREE.Matrix4();
/** Free an instance slot (swap-with-last so [0, count) stays dense). Returns the
 *  pickupId whose instance MOVED into the freed slot (its Pickup.inst.index must
 *  be updated by the caller), or null if nothing moved. */
function _poolFree(pool: PickupInstPool, index: number): number | null {
  const last = pool.count - 1;
  let movedId: number | null = null;
  if (index !== last) {
    pool.imesh.getMatrixAt(last, _poolFreeMat);
    pool.imesh.setMatrixAt(index, _poolFreeMat);
    pool.ids[index] = pool.ids[last];
    movedId = pool.ids[index];
  }
  pool.ids.length = last;
  pool.count = last;
  pool.imesh.count = last;
  pool.imesh.instanceMatrix.needsUpdate = true;
  return movedId;
}

/** The instanced-pool meshes, for interaction.ts to push ONCE each into the raycast
 *  target list (instanced pickups are NOT pushed per-pickup — that would raycast the
 *  same imesh hundreds of times). */
export function getPickupInstancedMeshes(): THREE.Object3D[] {
  return _instPools.map((p) => p.imesh);
}

// Scratch for composing a spawn transform (position + yaw + terrain-align) into an
// instance matrix without allocating a Mesh.
const _instScratch = new THREE.Object3D();

// ACAE — ONE shared wood-grain material for every world branch (~200
// instances → 1 program, world-space grain so it varies per branch). Aged
// deadwood. ACAF follow-up — uses the SHARED BRANCH_WOOD_COLOR/WEATHER_LEVEL so
// it's the EXACT same color as the held branch (items.ts); the vm scene now
// mirrors the world lighting (viewModel.ts) so held + dropped read identical.
const _worldBranchMat = createWoodGrainMaterial(BRANCH_WOOD_COLOR, {
  grainAxis: 0,          // grain along the stick's lie (world branches lie ~flat)
  ringDensity: 11.0,
  weatherLevel: BRANCH_WEATHER_LEVEL,
});

// ACAH — shared world-space metal for the scrap scattered around wrecks (rusty
// salvage debris). World-space (not localSpace) — these are STATIC pickups, so
// the cheaper world-space sampling is fine and varies the weathering per-position.
// ACBD — wornScale bumped hard (6→44): the scrap is only ~15cm, so at the old low
// scale the world-space rust noise barely cycled once across it and read as one
// flat blotch. Finer scale = the detailed per-flake rust mottling the user wanted.
const _worldScrapMat = createMetalMaterial(0x7a3c1c, { wornScale: 44.0, scratchStrength: 0.08, rustLevel: 0.92 });
const _worldScrapAccentMat = createMetalMaterial(0x52260f, { wornScale: 52.0, scratchStrength: 0.06, rustLevel: 0.97 });

export interface Pickup {
  id: number;                 // unique handle for hover/take
  /** D299 — TRUE for chunk-STREAMED pickups (far branches / scrap rings):
   *  excluded from the pickupSurvivors save set (visit-order ids — the
   *  D292 trap); taken-state persists via the chunk diff instead. */
  transient?: boolean;
  /** D299 — descriptor-derived within-chunk id keying this pickup in the
   *  chunk's save diff ("t0/b1" tree branches, "poi/scrap0"). Runtime-only. */
  chunkContentId?: string;
  itemId: ItemId;
  /** Optional meta attached on world-spawn (e.g. canteen fillLevel). Passes
   *  through to addItem on take. */
  meta?: ItemMeta;
  mesh: THREE.Object3D;
  pos: THREE.Vector3;         // resting position; bob is added each frame
  bobPhase: number;
  hovered: boolean;           // updated by player/interaction each frame
  /** ABM (B7) — optional Rapier dynamic body for dropped items that roll/
   *  fall/settle. Null for seed-spawned pickups (branches, scavenger-camp
   *  bandage) which sit statically at deterministic positions. When non-
   *  null, the per-frame `updatePickups` tick syncs mesh.position +
   *  quaternion from the body. The body uses a cuboid collider sized to
   *  the item's bounding box, and starts awake to settle into rest;
   *  Rapier auto-sleeps it once stopped. */
  body: RAPIER.RigidBody | null;
  /** ACC P2 — when set, this pickup is "riding" a sled: its body has
   *  been switched to KinematicPositionBased and `updateSledRiders`
   *  drives its world transform each frame from the sled's group
   *  transform applied to `ridingLocalPos` + `ridingLocalQuat`. Set
   *  null when not riding (the common case). */
  ridingSledId: number | null;
  /** ACC P2 — captured at promotion time. Pickup's pose in sled.group
   *  local coords. Re-applied each frame to compute world pose. */
  ridingLocalPos?: THREE.Vector3;
  ridingLocalQuat?: THREE.Quaternion;
  /** M1 pickup-instancing — set when this pickup renders as an instance in a
   *  shared InstancedMesh pool (seed-spawned branch/scrap). `mesh` then points
   *  at the SHARED imesh: never scene.remove it, never tag it with pickupId;
   *  despawnPickup frees the slot via _poolFree instead. */
  inst?: { pool: PickupInstPool; index: number };
}

let _nextId = 1;

/** Recursively tag every Mesh under `root` with userData.pickupId so the
 *  raycast can map a hit back to its Pickup record. */
function tagPickupMeshes(root: THREE.Object3D, pickupId: number): void {
  root.traverse((o) => {
    o.userData.pickupId = pickupId;
  });
}

const _UP = new THREE.Vector3(0, 1, 0);
const _alignQuat = new THREE.Quaternion();
const _alignAxis = new THREE.Vector3();

/** Tilt `mesh` so its local +Y points along the terrain normal at (x, z).
 *  Preserves any existing rotation by composing the alignment quaternion
 *  with whatever was already on the mesh. */
function alignToTerrainNormal(mesh: THREE.Object3D, terrain: Terrain, x: number, z: number): void {
  _alignAxis.copy(terrain.normalAt(x, z));
  // Skip a no-op rotation when ground is flat (normal === +Y).
  if (Math.abs(_alignAxis.y - 1) < 1e-4) return;
  _alignQuat.setFromUnitVectors(_UP, _alignAxis);
  mesh.quaternion.premultiply(_alignQuat);
}

// ────────────────────────────────────────────────────────────────
// Canteen visual (improved primitive)
// ────────────────────────────────────────────────────────────────
function makePrimitiveCanteen(): THREE.Group {
  const g = new THREE.Group();
  // ABL — perf: downgraded from MeshStandardMaterial (PBR) to
  // MeshLambertMaterial. Visual diff is negligible for matte-canvas
  // canteens at world scale; Lambert is significantly cheaper in the
  // fragment shader (no metallic/roughness sampling). Emissive
  // preserved via .emissive + .emissiveIntensity (Lambert supports
  // both). flatShading equivalent.
  const bodyMat = new THREE.MeshLambertMaterial({
    color: 0x6f3622,
    emissive: 0x281106,
    emissiveIntensity: 0.55,
    flatShading: true,
  });
  const trimMat = new THREE.MeshLambertMaterial({
    color: 0x1a1208,
    flatShading: true,
  });
  const strapMat = new THREE.MeshLambertMaterial({
    color: 0x2e1a0e,
    flatShading: true,
  });

  const body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 1), bodyMat);
  body.scale.set(1.0, 1.05, 0.55);
  g.add(body);

  const neck = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.08, 0.12, 8),
    trimMat,
  );
  neck.position.y = 0.22;
  g.add(neck);

  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.075, 0.075, 0.06, 8),
    trimMat,
  );
  cap.position.y = 0.31;
  g.add(cap);

  const strap = new THREE.Mesh(
    new THREE.TorusGeometry(0.085, 0.012, 4, 12),
    strapMat,
  );
  strap.position.y = 0.18;
  strap.rotation.x = Math.PI / 2;
  g.add(strap);

  return g;
}

export function spawnCanteens(
  scene: THREE.Scene,
  terrain: Terrain,
  assets: AssetRegistry,
  rand: Rng,
): Pickup[] {
  const canteenPool = assets.pool('pickup_canteen');
  const list: Pickup[] = [];
  for (let i = 0; i < Tuning.CANTEEN_COUNT; i++) {
    const radius = 8 + rand() * (Tuning.WORLD_RADIUS - 30);
    const angle = rand() * Math.PI * 2;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const groundY = terrain.heightAt(x, z);

    let mesh: THREE.Object3D | null = null;
    if (canteenPool.length > 0) {
      const variant = canteenPool[Math.floor(rand() * canteenPool.length)];
      mesh = cloneAsset(variant);
    }
    if (!mesh) mesh = makePrimitiveCanteen();

    const restY = groundY + 0.32;
    mesh.position.set(x, restY, z);
    mesh.rotation.y = rand() * Math.PI * 2;

    // Pickups are small (~10cm) — their shadows are invisible against the
    // dune and add to the shadow caster count for no visual gain.
    mesh.userData.noShadow = true;
    mesh.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = false;
        m.receiveShadow = true;
      }
    });

    const pickupId = _nextId++;
    tagPickupMeshes(mesh, pickupId);
    scene.add(mesh);

    list.push({
      id: pickupId,
      itemId: 'canteen',
      meta: { fillLevel: 1 },  // fresh canteens start full
      mesh,
      pos: new THREE.Vector3(x, restY, z),
      bobPhase: rand() * Math.PI * 2,
      hovered: false,
      body: null,  // ABM (B7) — seed-spawned canteens stay static
      ridingSledId: null,
    });
  }
  return list;
}

// ────────────────────────────────────────────────────────────────
// Branch pickup — small brown stick scattered across the world.
// Used as fire fuel (aim at fire + E with branch selected adds 30s).
// ACAE/ACAH history: shared wood-grain material + pooled merged geometries.
// M1 pickup-instancing: rendered via the per-variant InstancedMesh pools in
// spawnBranchAt (the old makePrimitiveBranch per-pickup Mesh path is gone;
// _branchGeometry survives for the pool-overflow legacy fallback).
// ────────────────────────────────────────────────────────────────

/** Spawn a single branch pickup at a specific (x, z) world position.
 *  Aligns to terrain normal, applies the same no-shadow + pickup tagging.
 *  Appends to `list` and returns the new Pickup. Used by dead-tree clusters
 *  (Session W) and the legacy random scatter. */
export function spawnBranchAt(
  scene: THREE.Scene,
  terrain: Terrain,
  x: number,
  z: number,
  rand: Rng,
  list: Pickup[],
): Pickup {
  const groundY = terrain.heightAt(x, z);
  const restY = groundY + 0.012;
  // M1 pickup-instancing — SAME rand-draw order as the legacy path (variant, yaw,
  // bobPhase) so seeded worldgen stays byte-identical across the pool/legacy split.
  const variant = _branchVariantIndex(rand);
  const yaw = rand() * Math.PI * 2;

  const pickupId = _nextId++;
  // Try the per-variant instanced pool first; overflow falls back to a legacy Mesh.
  let pool = _branchPools[variant];
  if (!pool) {
    pool = _makeInstPool(scene, _branchGeos[variant], _worldBranchMat, BRANCH_POOL_CAP);
    _branchPools[variant] = pool;
  }
  _instScratch.position.set(x, restY, z);
  _instScratch.rotation.set(0, yaw, 0);
  alignToTerrainNormal(_instScratch, terrain, x, z);
  _instScratch.updateMatrix();
  const slot = _poolAlloc(pool, pickupId, _instScratch.matrix);

  let mesh: THREE.Object3D;
  let inst: Pickup['inst'];
  if (slot !== null) {
    mesh = pool.imesh;   // shared — despawn frees the slot, never scene.remove's this
    inst = { pool, index: slot };
  } else {
    // Pool full (unusual seed) — legacy individual mesh so the pickup still exists.
    console.warn(`[pickups] branch pool ${variant} full (${pool.capacity}) — legacy mesh fallback`);
    const m = new THREE.Mesh(_branchGeos[variant], _worldBranchMat);
    m.position.set(x, restY, z);
    m.rotation.set(0, yaw, 0);
    alignToTerrainNormal(m, terrain, x, z);
    m.userData.noShadow = true;
    m.castShadow = false;
    m.receiveShadow = true;
    tagPickupMeshes(m, pickupId);
    scene.add(m);
    mesh = m;
  }

  const pickup: Pickup = {
    id: pickupId,
    itemId: 'branch',
    mesh,
    pos: new THREE.Vector3(x, restY, z),
    bobPhase: rand() * Math.PI * 2,
    hovered: false,
    body: null,  // ABM (B7) — seed-spawned branches stay static
    ridingSledId: null,
    inst,
  };
  list.push(pickup);
  return pickup;
}

// ────────────────────────────────────────────────────────────────
// Scrap pickup — scavenged hull debris scattered around wrecks (ACAH).
// The no-tools loot source that breaks the early-game bootstrap deadlock:
// salvage panels need a scrap_bar to pry, but scrap_bar's recipe needs scrap,
// and scrap otherwise only drops from panels. Ground scrap around wrecks lets
// the player craft their first scrap_bar. Mirrors the branch-around-trees
// pattern; uses the SHARED buildScrapMesh so it matches the held item.
// ────────────────────────────────────────────────────────────────
function makePrimitiveScrap(): THREE.Mesh {
  // ACAH perf — share ONE pooled merged scrap geometry (buildScrapMesh is
  // deterministic, so all instances were identical anyway); per-spawn yaw +
  // terrain-align vary it. One material (drops the minor accent tint, invisible
  // at pickup distance; the HELD item keeps the detailed 2-material version).
  return new THREE.Mesh(_scrapGeometry(), _worldScrapMat);
}

/** Spawn a single scrap pickup at a specific (x, z) world position. Terrain-
 *  aligned, no-shadow, pickup-tagged. Appends to `list` and returns the Pickup.
 *  Used by the wreck-scatter loop (main.ts). */
export function spawnScrapAt(
  scene: THREE.Scene,
  terrain: Terrain,
  x: number,
  z: number,
  rand: Rng,
  list: Pickup[],
): Pickup {
  const groundY = terrain.heightAt(x, z);
  const restY = groundY + 0.02;
  // M1 pickup-instancing — same rand-draw order as legacy (yaw, bobPhase).
  const yaw = rand() * Math.PI * 2;

  const pickupId = _nextId++;
  if (!_scrapPool) {
    _scrapPool = _makeInstPool(scene, _scrapGeometry(), _worldScrapMat, SCRAP_POOL_CAP);
  }
  _instScratch.position.set(x, restY, z);
  _instScratch.rotation.set(0, yaw, 0);
  alignToTerrainNormal(_instScratch, terrain, x, z);
  _instScratch.updateMatrix();
  const slot = _poolAlloc(_scrapPool, pickupId, _instScratch.matrix);

  let mesh: THREE.Object3D;
  let inst: Pickup['inst'];
  if (slot !== null) {
    mesh = _scrapPool.imesh;
    inst = { pool: _scrapPool, index: slot };
  } else {
    console.warn(`[pickups] scrap pool full (${_scrapPool.capacity}) — legacy mesh fallback`);
    const m = makePrimitiveScrap();
    m.position.set(x, restY, z);
    m.rotation.set(0, yaw, 0);
    alignToTerrainNormal(m, terrain, x, z);
    m.userData.noShadow = true;
    m.castShadow = false;
    m.receiveShadow = true;
    tagPickupMeshes(m, pickupId);
    scene.add(m);
    mesh = m;
  }

  const pickup: Pickup = {
    id: pickupId,
    itemId: 'scrap',
    mesh,
    pos: new THREE.Vector3(x, restY, z),
    bobPhase: rand() * Math.PI * 2,
    hovered: false,
    body: null,   // seed-spawned, static (like branches)
    ridingSledId: null,
    inst,
  };
  list.push(pickup);
  return pickup;
}

/** ACAQ (Cycle 8) — spawn a single glowing relic-core pickup at (x, z). The
 *  wreck-yard-exclusive reward; sits slightly proud of the sand so its emissive
 *  core reads from a distance. Appends to `list` (the boot pickup list). */
export function spawnRelicAt(
  scene: THREE.Scene,
  terrain: Terrain,
  x: number,
  z: number,
  rand: Rng,
  list: Pickup[],
): Pickup {
  const groundY = terrain.heightAt(x, z);
  const mesh = buildRelicCoreMesh();
  const restY = groundY + 0.13;
  mesh.position.set(x, restY, z);
  mesh.rotation.y = rand() * Math.PI * 2;
  mesh.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) { m.castShadow = false; m.receiveShadow = false; }
  });
  const pickupId = _nextId++;
  tagPickupMeshes(mesh, pickupId);
  scene.add(mesh);

  const pickup: Pickup = {
    id: pickupId,
    itemId: 'relic_core',
    mesh,
    pos: new THREE.Vector3(x, restY, z),
    bobPhase: rand() * Math.PI * 2,
    hovered: false,
    body: null,
    ridingSledId: null,
  };
  list.push(pickup);
  return pickup;
}

export function spawnBranches(
  scene: THREE.Scene,
  terrain: Terrain,
  rand: Rng,
  count: number = 30,
): Pickup[] {
  const list: Pickup[] = [];
  for (let i = 0; i < count; i++) {
    const radius = 6 + rand() * 200;
    const angle = rand() * Math.PI * 2;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    spawnBranchAt(scene, terrain, x, z, rand, list);
  }
  return list;
}

/** Retained for source compatibility — pickups no longer bob or spin.
 *  Removed from the per-frame tick; callers may still reference the symbol. */
export function bobPickups(
  _ctx: import('../GameContext.ts').GameContext,
  _dt: number,
): void {
  /* intentionally empty */
}

/** Spawn a Pickup at a given world position from any ItemId — used for
 *  player drops, crafting drops, and inventory-full pickup swaps. Reuses
 *  the item's viewmodel mesh (scaled up) as the world visual; falls back
 *  to a primitive cube if no makeViewModel is defined.
 *
 *  ABM (B7) — when `opts.world` is provided, a Rapier DYNAMIC body is
 *  attached so the item rolls/falls/settles naturally (e.g., dropped on
 *  a slope rolls downhill). When omitted, original behavior preserved
 *  (static mesh at the snapped-to-terrain position). Most player-facing
 *  drops should pass opts.world; deterministic seed-spawn callers (poi.ts
 *  scavenger camp) can leave it null for the static placement. */
export function spawnDroppedPickup(
  scene: THREE.Scene,
  terrain: Terrain,
  pos: { x: number; z: number },
  itemId: ItemId,
  meta?: ItemMeta,
  opts?: {
    world?: RAPIER.World;
    /** Optional initial linear velocity for the dynamic body (player
     *  drops use a small forward + up impulse for "tossed" feel). */
    initialVel?: { x: number; y: number; z: number };
    /** Override the spawn Y (default: terrain height + 0.04 for static,
     *  terrain + 0.6 for physics so items fall a bit). */
    yOverride?: number;
  },
): Pickup {
  const def = getItemDef(itemId);
  let mesh: THREE.Object3D;
  if (def.makeViewModel) {
    mesh = def.makeViewModel();
    mesh.scale.set(1.5, 1.5, 1.5);
  } else {
    // ABL — perf: PBR Standard → Lambert for the no-viewmodel fallback
    // pickup. Matte tan box; identical visually.
    const fallback = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.08, 0.10),
      new THREE.MeshLambertMaterial({ color: 0x8a7a5e }),
    );
    mesh = fallback;
  }
  const groundY = terrain.heightAt(pos.x, pos.z);
  // For physics-attached pickups, spawn slightly higher so they fall +
  // settle — gives the "tossed onto the ground" reading. Static pickups
  // sit flush at +4cm (original behavior).
  const defaultY = opts?.world ? groundY + 0.6 : groundY + 0.04;
  const restY = opts?.yOverride ?? defaultY;
  mesh.position.set(pos.x, restY, pos.z);
  mesh.rotation.y = Math.random() * Math.PI * 2;
  // Terrain-normal align only for static pickups; physics bodies derive
  // rotation from the body each frame so an initial mesh rotation gets
  // immediately overwritten.
  if (!opts?.world) {
    alignToTerrainNormal(mesh, terrain, pos.x, pos.z);
  }
  // Dropped items inherit the pickup no-shadow rule.
  mesh.userData.noShadow = true;
  mesh.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = false;
      m.receiveShadow = true;
    }
  });

  const pickupId = _nextId++;
  tagPickupMeshes(mesh, pickupId);
  scene.add(mesh);

  // ABM (B7) — attach a Rapier dynamic body when world is provided.
  // Cuboid collider sized to the mesh's bounding box (snug; pickups are
  // small so the AABB approximation reads fine). Damping prevents
  // jittery rolling on dunes; friction high so they grip slopes after
  // settling rather than slowly creeping forever.
  let body: RAPIER.RigidBody | null = null;
  if (opts?.world) {
    mesh.updateMatrixWorld(true);
    const bbox = new THREE.Box3().setFromObject(mesh);
    const size = new THREE.Vector3();
    bbox.getSize(size);
    const hx = Math.max(0.04, size.x * 0.5);
    const hy = Math.max(0.04, size.y * 0.5);
    const hz = Math.max(0.04, size.z * 0.5);
    const bd = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(pos.x, restY, pos.z)
      .setLinearDamping(0.6)
      .setAngularDamping(0.8)
      // ACC playtest follow-up — CCD enabled to prevent tunneling through
      // the heightfield. Some viewmodels (rope coil, cloth, bandage) have
      // very flat AABBs — bbox.y ≈ 4-6cm so the collider half-height hits
      // the 4cm Math.max floor. With the 60cm spawn height + aimable-throw
      // downward velocity, the body can reach 4+ m/s within 0.3sec —
      // per-frame travel at 60Hz = ~7cm, exceeding the 8cm collider
      // thickness. Discrete collision misses the heightfield and the
      // pickup tunnels through. CCD's swept-shape test catches the
      // crossing regardless of step size. Cheap on the ~30 pickup max.
      .setCcdEnabled(true);
    if (opts.initialVel) {
      bd.setLinvel(opts.initialVel.x, opts.initialVel.y, opts.initialVel.z);
    }
    body = opts.world.createRigidBody(bd);
    // Snug cuboid sized to the bbox (the original ABM behavior). A box's flat
    // faces grip the dune and settle without rolling. ACAU REVERTED the ACAS B2
    // sphere/capsule colliderHint (D206): in the walk-test spheres/capsules
    // rolled + spun instead of settling, and the thin capsule radius (2cm floor,
    // vs the box's 4cm) tunneled through the heightfield even with CCD. The box
    // reads best for all items (the dead `def.colliderHint` field was removed).
    const shape = RAPIER.ColliderDesc.cuboid(hx, hy, hz);
    shape.setFriction(0.85).setRestitution(0.15).setDensity(0.6);
    opts.world.createCollider(shape, body);
  }

  return {
    id: pickupId,
    itemId,
    meta: meta ? { ...meta } : undefined,
    mesh,
    pos: new THREE.Vector3(pos.x, restY, pos.z),
    bobPhase: Math.random() * Math.PI * 2,
    hovered: false,
    body,
    ridingSledId: null,
  };
}

/** ABM (B7) — per-frame sync: copy each physics-bodied pickup's body
 *  transform onto its mesh. Cheap walk; skips pickups without a body.
 *  Also updates the persisted `pos` field so other systems (raycast
 *  pickup detection, save serialization) read the live position. */
const _pickupSyncPos = new THREE.Vector3();
const _pickupSyncQuat = new THREE.Quaternion();
export function updatePickups(ctx: import('../GameContext.ts').GameContext, dt: number): void {
  // ACW E (#146) — storm wind nudges loose dropped items downwind. Computed
  // once per frame; applied as a per-frame impulse (= force × dt) on dynamic
  // bodies so a sandstorm scatters dropped gear.
  const wind = stormWindAccel(ctx.weather);
  const hasWind = wind.x !== 0 || wind.z !== 0;
  for (const p of ctx.pickups.list) {
    if (!p.body) continue;
    // ACC P2 — riding pickups are kinematic-driven by updateSledRiders.
    // Skip them here so we don't overwrite this-frame's sled-driven pose
    // with the stale body translation.
    if (p.ridingSledId !== null) continue;
    if (hasWind) {
      const m = p.body.mass();
      if (m > 0) p.body.applyImpulse({ x: wind.x * m * dt, y: 0, z: wind.z * m * dt }, true);
    }
    const t = p.body.translation();
    const r = p.body.rotation();
    _pickupSyncPos.set(t.x, t.y, t.z);
    _pickupSyncQuat.set(r.x, r.y, r.z, r.w);
    p.mesh.position.copy(_pickupSyncPos);
    p.mesh.quaternion.copy(_pickupSyncQuat);
    p.pos.copy(_pickupSyncPos);
  }
}

/** Bump the module-level id counter past `n` so future spawns don't collide
 *  with restored ids. Used by save/load. */
export function setNextPickupId(n: number): void {
  if (n > _nextId) _nextId = n;
}

/** Find a pickup by its userData.pickupId. */
export function findPickupById(
  list: Pickup[],
  id: number | undefined,
): Pickup | null {
  if (id === undefined) return null;
  for (const p of list) if (p.id === id) return p;
  return null;
}

/** Remove a pickup from the world + the list. Used when E-take fires.
 *  ABM (B7) — also removes the Rapier body when present so dropped-item
 *  bodies don't leak (Rapier doesn't GC removed scene objects). */
export function despawnPickup(
  ctx: import('../GameContext.ts').GameContext,
  pickup: Pickup,
): void {
  if (pickup.inst) {
    // M1 pickup-instancing — free the instance slot; pickup.mesh is the SHARED
    // imesh (removing it would erase every instanced pickup of this kind). The
    // swap-with-last may relocate another pickup's instance: fix its index.
    const freedIndex = pickup.inst.index;
    const movedId = _poolFree(pickup.inst.pool, freedIndex);
    if (movedId !== null) {
      const moved = findPickupById(ctx.pickups.list, movedId);
      if (moved?.inst) moved.inst.index = freedIndex;
    }
    pickup.inst = undefined;
  } else {
    ctx.three.scene.remove(pickup.mesh);
  }
  if (pickup.body) {
    ctx.physics.world.removeRigidBody(pickup.body);
    pickup.body = null;
  }
  const idx = ctx.pickups.list.indexOf(pickup);
  if (idx >= 0) ctx.pickups.list.splice(idx, 1);
}
