// Distant POIs (Session S re-theme). Four hand-placed silhouettes ~60-130m
// from spawn, each a single legible focal point in the otherwise barren
// scavenger desert.
//
//   - Engine Block       — massive 5-bell engine module tipped into a dune
//   - Scavenger Camp     — fire ring + small fuselage lean-to + bandage
//   - Antenna Outpost    — comm spire on buried wreckage base
//   - Crashed Hull       — long fuselage with engine bell + debris field

import * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';
import type { Rng } from '../core/rng.ts';
import type { Terrain } from './terrain.ts';
import type { Pickup } from '../pickups/pickups.ts';
import { spawnDroppedPickup } from '../pickups/pickups.ts';
import {
  makeFuselage,
  placeWreck,
  placeDebrisField,
  addAccessPanel,
  type WreckKind,
} from './wrecks.ts';
import { attachCompoundCollider } from '../physics/bodies.ts';
import { registerSalvageable, type SalvageableRegistry } from './salvage.ts';
import { placeMegaShip } from './megaShip.ts';
import { placeMegaWreck } from './megaWreck.ts';
import { placeSatelliteDish } from './satelliteDish.ts';
import { placeEngineBlock } from './engineBlock.ts';
import { placeCrashedHull } from './crashedHull.ts';
import type { ShelterRegistry } from '../shelter/shelterZones.ts';
import { Tuning } from '../config/tuning.ts';
import { placeBuriedCockpit, sampleBuriedCockpitPositions } from './buriedCockpit.ts';

// ────────────────────────────────────────────────────────────────
// The Engine Block POI is built by `placeEngineBlock` in
// `./engineBlock.ts` (Session LL — dedicated module, LatheGeometry
// bells + cooling shroud + per-piece colliders + 2 salvage panels).
// ────────────────────────────────────────────────────────────────

// ────────────────────────────────────────────────────────────────
// Scavenger camp — small fuselage chunk + lean-to fire ring + bandage.
// Returns the bandage pickup so the caller can register it.
// ────────────────────────────────────────────────────────────────
function placeScavengerCamp(
  scene: THREE.Scene,
  world: RAPIER.World,
  terrain: Terrain,
  rand: Rng,
  center: THREE.Vector3,
): { pickup: Pickup; fuselage: THREE.Group } {
  // Small fuselage section as the windbreak the camp is built against.
  const fuselage = makeFuselage(rand, 0.9);
  fuselage.position.copy(center);
  fuselage.position.x += Tuning.SCAVENGER_CAMP_FUSELAGE_OFFSET_X_M;
  fuselage.position.y += Tuning.SCAVENGER_CAMP_FUSELAGE_OFFSET_Y_M;
  fuselage.rotation.y = Tuning.SCAVENGER_CAMP_FUSELAGE_YAW_RAD;
  fuselage.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; }
  });
  scene.add(fuselage);
  attachCompoundCollider(world, fuselage);

  // Fire ring — 8 small dark stones in a 1m circle, on the lee side.
  const stoneMat = new THREE.MeshLambertMaterial({
    color: new THREE.Color().setHSL(0.07, 0.05, 0.12),
    flatShading: true,
  });
  const ringR = Tuning.SCAVENGER_CAMP_RING_RADIUS_M;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + rand() * 0.2;
    const r = ringR + (rand() - 0.5) * Tuning.SCAVENGER_CAMP_RING_JITTER_M;
    const sx = center.x + Math.cos(a) * r;
    const sz = center.z + Math.sin(a) * r;
    const stoneSize = Tuning.SCAVENGER_CAMP_STONE_SIZE_MIN_M
      + rand() * Tuning.SCAVENGER_CAMP_STONE_SIZE_RANGE_M;
    const stone = new THREE.Mesh(
      new THREE.IcosahedronGeometry(stoneSize, 0),
      stoneMat,
    );
    stone.position.set(sx, terrain.heightAt(sx, sz) - 0.02, sz);
    stone.rotation.y = rand() * Math.PI;
    stone.castShadow = false;
    stone.receiveShadow = true;
    scene.add(stone);
  }
  // Ash patch — small dark disc, terrain-aligned.
  const ash = new THREE.Mesh(
    new THREE.CircleGeometry(ringR * Tuning.SCAVENGER_CAMP_ASH_RADIUS_FRACTION, 16),
    new THREE.MeshBasicMaterial({ color: 0x14100c }),
  );
  ash.position.set(center.x, terrain.heightAt(center.x, center.z) + 0.015, center.z);
  ash.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 0, 1),
    terrain.normalAt(center.x, center.z).clone(),
  );
  scene.add(ash);

  // Bandage pickup on the far side of the fire.
  const bandageX = center.x
    + Tuning.SCAVENGER_CAMP_BANDAGE_OFFSET_X_MIN_M
    + rand() * Tuning.SCAVENGER_CAMP_BANDAGE_OFFSET_X_RANGE_M;
  const bandageZ = center.z
    + Tuning.SCAVENGER_CAMP_BANDAGE_OFFSET_Z_MIN_M
    + rand() * Tuning.SCAVENGER_CAMP_BANDAGE_OFFSET_Z_RANGE_M;
  const pickup = spawnDroppedPickup(scene, terrain, { x: bandageX, z: bandageZ }, 'bandage');
  return { pickup, fuselage };
}

// ────────────────────────────────────────────────────────────────
// The Crashed Hull POI is built by `placeCrashedHull` in
// `./crashedHull.ts` (Session NN — dedicated module, LatheGeometry-
// tapered fuselage + custom engine bell + per-piece tilted colliders
// + 2 salvage panels).
// ────────────────────────────────────────────────────────────────

// ────────────────────────────────────────────────────────────────
// Public entry — hand-picked positions + dispatch
// ────────────────────────────────────────────────────────────────
/** Variance of terrain heights in a small patch (3×3 samples at 2.5m spacing).
 *  Lower = flatter spot. Used to pick a flat landing for the mega-ship. */
function terrainVarAt(terrain: Terrain, cx: number, cz: number): number {
  const samples: number[] = [];
  for (const dx of [-2.5, 0, 2.5]) {
    for (const dz of [-2.5, 0, 2.5]) {
      samples.push(terrain.heightAt(cx + dx, cz + dz));
    }
  }
  const mean = samples.reduce((s, v) => s + v, 0) / samples.length;
  return samples.reduce((s, v) => s + (v - mean) ** 2, 0) / samples.length;
}

/** Variance sample for the 120m mega-wreck: 9×9 grid at 15m spacing
 *  (≈120m × 120m sample area), covering the wreck's full length
 *  regardless of yaw. Anything smaller misses dune-slope gradients that
 *  put bow + aft on very different terrain levels. */
function terrainVarAtWide(terrain: Terrain, cx: number, cz: number): number {
  const samples: number[] = [];
  for (let i = -4; i <= 4; i++) {
    for (let j = -4; j <= 4; j++) {
      samples.push(terrain.heightAt(cx + i * 15, cz + j * 15));
    }
  }
  const mean = samples.reduce((s, v) => s + v, 0) / samples.length;
  return samples.reduce((s, v) => s + (v - mean) ** 2, 0) / samples.length;
}

type FlagshipKind = 'engine_block' | 'camp' | 'satellite_dish' | 'crashed_hull' | 'mega_ship' | 'mega_wreck';

// AAI — flagship POI catalog. Per D82, the 6 flagships go through the
// same rejection-sampler infrastructure as the procgen wrecks (was
// hardcoded coordinates in POI_LAYOUT pre-AAI). Positions are seeded
// per-game from the scatterRand stream; same seed = same flagship layout.
const FLAGSHIP_KINDS: ReadonlyArray<FlagshipKind> = [
  'engine_block',
  'camp',
  'satellite_dish',
  'crashed_hull',
  'mega_ship',
  'mega_wreck',
];

// AAI — module-level cache for the positions picked during placePOIs.
// getAnchorPOIPositions() returns this for procgenPoi + lizard cluster
// use. Cleared between sessions if hot-reloading.
let _placedFlagshipPositions: Array<{ x: number; z: number }> = [];

/** Mean per-meter terrain height delta in a 5m patch. Flat ≈ 0; steep
 *  dune slope ≈ 1.0+. AAK — used by sampleFlagshipPositions to reject
 *  candidate positions on steep slopes so flagship wrecks don't tilt
 *  awkwardly past the per-spawn flat-spot drift's compensation range. */
function localRoughness(terrain: Terrain, cx: number, cz: number): number {
  const center = terrain.heightAt(cx, cz);
  let sum = 0;
  let n = 0;
  for (const dx of [-5, 0, 5]) for (const dz of [-5, 0, 5]) {
    sum += Math.abs(terrain.heightAt(cx + dx, cz + dz) - center);
    n++;
  }
  return sum / n;
}

/** Sample positions for all 6 flagships via rejection. Honors
 *  POI_MIN_SEPARATION between flagships + FLAGSHIP_SPAWN_EXCLUSION_RADIUS
 *  from the opening-scene anchor + FLAGSHIP_MAX_ROUGHNESS sanity gate.
 *  AAK — tightened the scatter band + spawn-exclusion + added roughness
 *  check after multi-seed playtest surfaced flagships landing too far
 *  (>1km), too close to spawn (60m mega_ship ~108m away), or on steep
 *  dunes (roughness > 1.0). */
function sampleFlagshipPositions(rand: Rng, terrain: Terrain): Array<{ x: number; z: number }> {
  const minSep = Tuning.POI_MIN_SEPARATION;
  const minSepSq = minSep * minSep;
  // AAK — flagship-specific scatter bounds (tighter than procgen-wreck bounds).
  const rMin = Tuning.FLAGSHIP_SCATTER_RADIUS_MIN;
  const rMax = Tuning.FLAGSHIP_SCATTER_RADIUS_MAX;
  const maxTries = Tuning.POI_MAX_PLACEMENT_TRIES;
  const spawnX = Tuning.OPENING_SCENE_ANCHOR_X;
  const spawnZ = Tuning.OPENING_SCENE_ANCHOR_Z;
  // AAK — flagship spawn exclusion is larger than procgen-wreck exclusion
  // because flagship structures are visually dominant (60m+).
  const spawnExcludeSq = Tuning.FLAGSHIP_SPAWN_EXCLUSION_RADIUS * Tuning.FLAGSHIP_SPAWN_EXCLUSION_RADIUS;
  const maxRoughness = Tuning.FLAGSHIP_MAX_ROUGHNESS;
  const result: Array<{ x: number; z: number }> = [];
  for (let k = 0; k < FLAGSHIP_KINDS.length; k++) {
    let accepted: { x: number; z: number } | null = null;
    for (let t = 0; t < maxTries; t++) {
      const r = rMin + rand() * (rMax - rMin);
      const a = rand() * Math.PI * 2;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      // Player-spawn exclusion (flagship-specific, larger than procgen-wreck).
      const sdx = x - spawnX, sdz = z - spawnZ;
      if (sdx * sdx + sdz * sdz < spawnExcludeSq) continue;
      // AAK — terrain-roughness gate. Reject candidates on steep slopes.
      if (localRoughness(terrain, x, z) > maxRoughness) continue;
      // Flagship-to-flagship min-separation.
      let blocked = false;
      for (const c of result) {
        const dx = x - c.x, dz = z - c.z;
        if (dx * dx + dz * dz < minSepSq) { blocked = true; break; }
      }
      if (!blocked) { accepted = { x, z }; break; }
    }
    if (accepted) {
      result.push(accepted);
    } else {
      // Fallback: place at a position respecting spawn exclusion but
      // ignoring flagship min-sep + roughness (only happens in a
      // saturated/rough world, which is rare for 6 flagships).
      let fx = 0, fz = 0;
      for (let t = 0; t < maxTries; t++) {
        const r = rMin + rand() * (rMax - rMin);
        const a = rand() * Math.PI * 2;
        const x = Math.cos(a) * r;
        const z = Math.sin(a) * r;
        const sdx = x - spawnX, sdz = z - spawnZ;
        if (sdx * sdx + sdz * sdz >= spawnExcludeSq) { fx = x; fz = z; break; }
      }
      result.push({ x: fx, z: fz });
    }
  }
  return result;
}

/** AAI — positions picked by the most recent placePOIs() call. Used by
 *  procgenPoi (min-sep exclusion) + lizard procgen (per-POI cluster).
 *  AAQ — extended to include cluster anchor positions (treated as
 *  flagship-equivalent obstacles by procgen wrecks). */
export function getAnchorPOIPositions(): ReadonlyArray<{ x: number; z: number }> {
  return _placedFlagshipPositions;
}

// ────────────────────────────────────────────────────────────────
// AAQ — themed POI clusters
// ────────────────────────────────────────────────────────────────
// A cluster is multiple existing wreck/camp primitives placed in a
// coordinated layout that reads as a narrative beat: convoy crash, refugee
// stopover, etc. Anchors sample via the same rejection-sampler family as
// flagships + procgen wrecks, but with cluster-specific exclusion radii
// so the linear/wide footprints don't collide with neighbors.
//
// Reuses placeWreck (wrecks.ts) + placeScavengerCamp (above) — no new
// 3D models. The "theme" is the SHAPE of the layout (line vs ring) +
// the choice of wreck kinds.

// ABJ — B3: 'comm_relay' added as 3rd cluster kind. Central antenna
// spire + radial dish reflectors + collapse debris + 1 salvage panel.
// Reads as "abandoned signal relay — the operator went silent."
type ClusterKind = 'military_convoy' | 'refugee_caravan' | 'comm_relay';
const CLUSTER_KINDS: ReadonlyArray<ClusterKind> = ['military_convoy', 'refugee_caravan', 'comm_relay'];

/** military_convoy: 4-6 wrecks aligned along a "crash trajectory" line.
 *  Mix of engine_clusters (the trucks), cargo_containers (the cargo
 *  they were hauling), and a fuselage at the back end (the comms/
 *  command vehicle that punched a divot when it broke up). Yaw locks
 *  all wrecks to the trajectory direction so they read as a coordinated
 *  formation that crashed together, not a random scatter.
 *
 *  Anchor = center of the convoy line. Wrecks placed at evenly-spaced
 *  offsets from -halfLen to +halfLen along the trajectory direction,
 *  with small per-wreck lateral jitter for the "skid" feel.
 */
function placeMilitaryConvoy(
  scene: THREE.Scene,
  world: RAPIER.World,
  terrain: Terrain,
  rand: Rng,
  anchor: { x: number; z: number },
  salvageables: SalvageableRegistry | undefined,
): void {
  const lenMin = Tuning.MILITARY_CONVOY_LENGTH_MIN;
  const lenSpan = Tuning.MILITARY_CONVOY_LENGTH_MAX - lenMin;
  const length = lenMin + rand() * lenSpan;
  const halfLen = length / 2;
  // Crash trajectory yaw — random per cluster, but locked across all
  // wrecks in this cluster. Atan2 unused; just a uniform radian pick.
  const trajYaw = rand() * Math.PI * 2;
  const dx = Math.cos(trajYaw);
  const dz = Math.sin(trajYaw);
  // Perpendicular for lateral skid jitter
  const px = -dz;
  const pz = dx;
  const wreckCountMin = Tuning.MILITARY_CONVOY_WRECK_COUNT_MIN;
  const wreckSpan = Tuning.MILITARY_CONVOY_WRECK_COUNT_MAX - wreckCountMin;
  const n = wreckCountMin + Math.floor(rand() * (wreckSpan + 1));
  // Kind palette for the convoy. Cargo containers form the BODY of the
  // formation; the lead vehicle is an engine_cluster ("the truck"); the
  // tail is a fuselage ("comms"). Distribution: lead + middle cargo +
  // possibly a fuselage at the tail.
  const kinds: WreckKind[] = [];
  // Lead vehicle = engine_cluster (always)
  kinds.push('engine_cluster');
  // Middle = cargo_container × (n - 2)
  for (let i = 0; i < n - 2; i++) kinds.push('cargo_container');
  // Tail = fuselage (always)
  kinds.push('fuselage');
  // If we ended up with too few middle cargos for the count, pad with
  // engine_clusters (rare path, only when n=3 — gives 1 lead + 1 middle
  // + 1 tail, which is fine without padding).
  while (kinds.length < n) kinds.push('cargo_container');
  // Place each wreck along the trajectory.
  for (let i = 0; i < n; i++) {
    // Even spacing from -halfLen to +halfLen along trajectory.
    const t = n > 1 ? i / (n - 1) : 0.5;
    const dist = -halfLen + t * length;
    // Lateral skid: ±2m perpendicular jitter
    const lat = (rand() - 0.5) * 4.0;
    const x = anchor.x + dx * dist + px * lat;
    const z = anchor.z + dz * dist + pz * lat;
    const y = terrain.heightAt(x, z);
    const pos = new THREE.Vector3(x, y, z);
    // Wreck yaw aligned to trajectory + small per-wreck jitter (skidding
    // crash, not all dead-on aligned).
    const wreckYaw = trajYaw + (rand() - 0.5) * 0.5;
    const tiltZ = (rand() - 0.5) * 0.3;        // crash-tilt
    const buryY = 0.4 + rand() * 0.5;
    const scale = i === 0 ? 1.2 : 0.95 + rand() * 0.3; // lead a bit bigger
    const group = placeWreck(scene, world, terrain, pos, kinds[i], rand, {
      scale, buryY, tiltZ, yaw: wreckYaw,
    });
    if (salvageables) registerSalvageable(salvageables, group, kinds[i], pos, rand);
  }
  // Optional debris field at the lead-end of the convoy ("impact zone").
  const impactX = anchor.x + dx * halfLen;
  const impactZ = anchor.z + dz * halfLen;
  placeDebrisField(scene, terrain, new THREE.Vector3(impactX, 0, impactZ), 12, rand, 8);
}

/** refugee_caravan: a scavenger camp at the center + 2-3 cargo containers
 *  ringed around it at 6-12m + (placeScavengerCamp already includes
 *  a fuselage windbreak). Reads as "this was the last place they
 *  stopped — set up camp, watched the dust, never got back on the road."
 */
function placeRefugeeCaravan(
  scene: THREE.Scene,
  world: RAPIER.World,
  terrain: Terrain,
  rand: Rng,
  anchor: { x: number; z: number },
  pickupList: Pickup[],
  salvageables: SalvageableRegistry | undefined,
): void {
  const y = terrain.heightAt(anchor.x, anchor.z);
  const center = new THREE.Vector3(anchor.x, y, anchor.z);
  // Camp at center — includes fuselage windbreak + fire stones + bandage.
  const { pickup, fuselage } = placeScavengerCamp(scene, world, terrain, rand, center);
  pickupList.push(pickup);
  if (salvageables) registerSalvageable(salvageables, fuselage, 'fuselage', center, rand);
  // Ring of cargo containers around the camp.
  const cargoMin = Tuning.REFUGEE_CARAVAN_CARGO_COUNT_MIN;
  const cargoSpan = Tuning.REFUGEE_CARAVAN_CARGO_COUNT_MAX - cargoMin;
  const cargoN = cargoMin + Math.floor(rand() * (cargoSpan + 1));
  const rMin = Tuning.REFUGEE_CARAVAN_RADIUS_MIN;
  const rSpan = Tuning.REFUGEE_CARAVAN_RADIUS_MAX - rMin;
  for (let i = 0; i < cargoN; i++) {
    // Distribute angles evenly with small jitter — avoid all cargos
    // landing on one side.
    const baseA = (i / cargoN) * Math.PI * 2;
    const a = baseA + (rand() - 0.5) * 0.6;
    const r = rMin + rand() * rSpan;
    const cx = anchor.x + Math.cos(a) * r;
    const cz = anchor.z + Math.sin(a) * r;
    const cy = terrain.heightAt(cx, cz);
    const cargoPos = new THREE.Vector3(cx, cy, cz);
    // Cargo containers point INWARD (toward the camp center) — gives
    // the formation a coherent "stowed around the fire" read rather
    // than random orientations.
    const cargoYaw = a + Math.PI;
    const group = placeWreck(scene, world, terrain, cargoPos, 'cargo_container', rand, {
      scale: 0.95 + rand() * 0.2,
      buryY: 0.3 + rand() * 0.3,
      tiltZ: (rand() - 0.5) * 0.15,
      yaw: cargoYaw,
    });
    if (salvageables) registerSalvageable(salvageables, group, 'cargo_container', cargoPos, rand);
  }
}

/** AAQ — sample anchor positions for N clusters via rejection. Avoids
 *  flagship positions, player spawn, and other clusters. Roughness-gated
 *  so clusters don't land on steep dune slopes (their multi-wreck
 *  footprint amplifies tilt issues more than single-wreck flagships do). */
function sampleClusterPositions(
  rand: Rng,
  terrain: Terrain,
  flagshipPositions: ReadonlyArray<{ x: number; z: number }>,
): Array<{ x: number; z: number; kind: ClusterKind }> {
  const result: Array<{ x: number; z: number; kind: ClusterKind }> = [];
  const n = Tuning.CLUSTER_COUNT_PER_WORLD;
  const rMin = Tuning.CLUSTER_SCATTER_RADIUS_MIN;
  const rMax = Tuning.CLUSTER_SCATTER_RADIUS_MAX;
  const maxTries = Tuning.POI_MAX_PLACEMENT_TRIES;
  const spawnX = Tuning.OPENING_SCENE_ANCHOR_X;
  const spawnZ = Tuning.OPENING_SCENE_ANCHOR_Z;
  const spawnExcludeSq = Tuning.CLUSTER_SPAWN_EXCLUSION_RADIUS * Tuning.CLUSTER_SPAWN_EXCLUSION_RADIUS;
  const clusterSepSq = Tuning.CLUSTER_MIN_SEPARATION * Tuning.CLUSTER_MIN_SEPARATION;
  const flagshipSepSq = Tuning.CLUSTER_FLAGSHIP_MIN_SEPARATION * Tuning.CLUSTER_FLAGSHIP_MIN_SEPARATION;
  const maxRoughness = Tuning.CLUSTER_MAX_ROUGHNESS;
  for (let i = 0; i < n; i++) {
    let accepted: { x: number; z: number } | null = null;
    for (let t = 0; t < maxTries; t++) {
      const r = rMin + rand() * (rMax - rMin);
      const a = rand() * Math.PI * 2;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const sdx = x - spawnX, sdz = z - spawnZ;
      if (sdx * sdx + sdz * sdz < spawnExcludeSq) continue;
      if (localRoughness(terrain, x, z) > maxRoughness) continue;
      // Cluster ↔ flagship exclusion
      let blocked = false;
      for (const f of flagshipPositions) {
        const dx = x - f.x, dz = z - f.z;
        if (dx * dx + dz * dz < flagshipSepSq) { blocked = true; break; }
      }
      if (blocked) continue;
      // Cluster ↔ cluster exclusion
      for (const c of result) {
        const dx = x - c.x, dz = z - c.z;
        if (dx * dx + dz * dz < clusterSepSq) { blocked = true; break; }
      }
      if (!blocked) { accepted = { x, z }; break; }
    }
    if (!accepted) break;   // saturated world — ship with what we have
    // Pick kind from the rotation — first half military_convoy, rest
    // refugee_caravan (so a 3-cluster world gets 1-2 of each). Random
    // tiebreaker per cluster so the order varies seed-to-seed.
    const kind: ClusterKind = CLUSTER_KINDS[i % CLUSTER_KINDS.length];
    result.push({ x: accepted.x, z: accepted.z, kind });
  }
  // Shuffle the kinds so the rotation doesn't bias by sample order.
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [result[i].kind, result[j].kind] = [result[j].kind, result[i].kind];
  }
  return result;
}

export function placePOIs(
  scene: THREE.Scene,
  world: RAPIER.World,
  terrain: Terrain,
  rand: Rng,
  pickupList: Pickup[],
  salvageables?: SalvageableRegistry,
  shelter?: ShelterRegistry,
  // Session ABF — flagship-specific journals are placed by each
  // flagship's module (megaShip / megaWreck / satelliteDish / etc.).
  // Optional so legacy callers stay source-compatible.
  journals?: { list: import('./journal.ts').Journal[] },
  // Session ABJ — A4: biome sampler is threaded so we can place the
  // dune buried cockpit at biome centroids. Optional so any pre-ABJ
  // callers (none in main.ts now, but defensive) stay source-compat.
  biomes?: import('./biomes.ts').BiomeSampler,
): void {
  // AAI — rejection-sample positions for the 6 flagships in a single
  // pass, then dispatch each kind's spawn fn against its sampled position.
  // AAK — passes terrain so the sampler can apply a roughness gate.
  const positions = sampleFlagshipPositions(rand, terrain);
  _placedFlagshipPositions = positions;
  for (let i = 0; i < FLAGSHIP_KINDS.length; i++) {
    const kind = FLAGSHIP_KINDS[i];
    const pickedX = positions[i].x;
    const pickedZ = positions[i].z;
    const y = terrain.heightAt(pickedX, pickedZ);
    const pos = new THREE.Vector3(pickedX, y, pickedZ);
    // Shadowing `p` from the old POI_LAYOUT entry — the existing dispatch
    // code below reads p.x/p.z + p.kind. Keep the shape so the cases stay
    // a clean diff.
    const p = { kind, x: pickedX, z: pickedZ };
    switch (p.kind) {
      case 'engine_block': {
        // LL — flagship POI: massive 5-nozzle engine cluster tipped
        // into a dune. Dedicated module (placeEngineBlock) handles the
        // LatheGeometry bells + per-piece colliders + 2 salvage panels
        // internally. Mirrors the dish dispatch shape.
        placeEngineBlock(scene, world, terrain, pos, rand, salvageables, journals);
        break;
      }
      case 'camp': {
        const { pickup, fuselage } = placeScavengerCamp(scene, world, terrain, rand, pos);
        pickupList.push(pickup);
        // The camp fuselage is small (0.9× scale) — register as a regular
        // fuselage salvageable rather than 'massive'.
        if (salvageables) registerSalvageable(salvageables, fuselage, 'fuselage', pos, rand);
        break;
      }
      case 'satellite_dish': {
        // KK — flagship POI: large rusted dish on a tripod over a
        // hollow concrete base, half-reclaimed by dunes. Dedicated
        // module (placeSatelliteDish) handles the geometry + walkable
        // colliders + shelter zone + two salvage panels internally.
        if (!shelter) break;
        placeSatelliteDish(scene, world, terrain, pos, rand, shelter, salvageables, journals);
        placeDebrisField(scene, terrain, pos, 14, rand, 18);
        break;
      }
      case 'crashed_hull': {
        // NN — flagship POI: tapered LatheGeometry fuselage with
        // custom tail bell. Dedicated module (placeCrashedHull)
        // handles geometry + per-piece colliders + 2 salvage panels
        // internally. Mirrors the dish + engineBlock dispatch shape.
        placeCrashedHull(scene, world, terrain, pos, rand, salvageables, journals);
        break;
      }
      case 'mega_ship': {
        if (!salvageables || !shelter) break;
        // Find a flatter spot near the nominal position so the wreck has
        // less terrain variation under its footprint. Sample 8 angular
        // candidates × 2 radii within 5m.
        let bestX = p.x, bestZ = p.z;
        let bestVar = terrainVarAt(terrain, p.x, p.z);
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          for (const r of [3, 5]) {
            const x = p.x + Math.cos(a) * r;
            const z = p.z + Math.sin(a) * r;
            const v = terrainVarAt(terrain, x, z);
            if (v < bestVar) { bestVar = v; bestX = x; bestZ = z; }
          }
        }
        // Use mean footprint terrain as the origin so terrain rises into
        // the cavity for the "sand-reclaimed" look. Walls extend WALL_BURY
        // below this to avoid any floating gap on sloped dunes.
        let sumY = 0, countY = 0;
        for (const dx of [-5, -2, 0, 2, 5]) {
          for (const dz of [-6, -3, 0, 3, 6]) {
            sumY += terrain.heightAt(bestX + dx, bestZ + dz);
            countY++;
          }
        }
        const meanY = sumY / countY;
        const buryPos = new THREE.Vector3(bestX, meanY, bestZ);
        // Tilt the wreck so its up-axis matches the terrain normal at the
        // wreck position — gives a natural "crashed and settled" angle on
        // sloped dunes. Cap the tilt angle so the wreck doesn't tip too far.
        const normal = terrain.normalAt(bestX, bestZ).clone();
        const upVec = new THREE.Vector3(0, 1, 0);
        const angle = Math.min(upVec.angleTo(normal), 0.25);  // cap ~14°
        const axis = new THREE.Vector3().crossVectors(upVec, normal);
        let tilt = new THREE.Quaternion();
        if (axis.lengthSq() > 1e-6) {
          axis.normalize();
          tilt = new THREE.Quaternion().setFromAxisAngle(axis, angle);
        }
        // Yaw chosen so the entrance (-X side) faces toward player spawn.
        const yaw = Math.PI;
        placeMegaShip(scene, world, terrain, buryPos, yaw, tilt, rand, shelter, salvageables, journals);
        break;
      }
      case 'mega_wreck': {
        if (!salvageables || !shelter) break;
        // Wide flat-spot search — 120m structure. 8 angles × 4 radii up
        // to 60m so the search can escape a steep dune face.
        let bestX = p.x, bestZ = p.z;
        let bestVar = terrainVarAtWide(terrain, p.x, p.z);
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          for (const r of [15, 30, 45, 60]) {
            const x = p.x + Math.cos(a) * r;
            const z = p.z + Math.sin(a) * r;
            const v = terrainVarAtWide(terrain, x, z);
            if (v < bestVar) { bestVar = v; bestX = x; bestZ = z; }
          }
        }
        // Mean-Y over the full 120m footprint so pos.y reflects the
        // entire wreck, not a 40m neighbourhood.
        let sumY = 0, countY = 0;
        for (let i = -4; i <= 4; i++) {
          for (let j = -4; j <= 4; j++) {
            sumY += terrain.heightAt(bestX + i * 15, bestZ + j * 15);
            countY++;
          }
        }
        const meanY = sumY / countY;
        const buryPos = new THREE.Vector3(bestX, meanY, bestZ);
        // Tilt cap tightened to 0.10 rad — at 60m half-length, even 0.10
        // exposes ~6m of wall on the high end, right at WALL_BURY=7m.
        const normal = terrain.normalAt(bestX, bestZ).clone();
        const upVec = new THREE.Vector3(0, 1, 0);
        const angle = Math.min(upVec.angleTo(normal), 0.10);
        const axis = new THREE.Vector3().crossVectors(upVec, normal);
        let tilt = new THREE.Quaternion();
        if (axis.lengthSq() > 1e-6) {
          axis.normalize();
          tilt = new THREE.Quaternion().setFromAxisAngle(axis, angle);
        }
        // Yaw so the bow tip (-Z local) points toward spawn at (-55, 0):
        // direction-to-spawn = (125, 130); local -Z → world (-sin yaw,
        // -cos yaw), so yaw = atan2(125, 130) + π ≈ -2.38 rad.
        const dxSpawn = -55 - bestX;
        const dzSpawn = 0 - bestZ;
        const yaw = Math.atan2(dxSpawn, dzSpawn) + Math.PI;
        placeMegaWreck(scene, world, terrain, buryPos, yaw, tilt, rand, shelter, salvageables, journals);
        // 3 small companion wrecks at 30-60m around the mega-wreck (BB-3
        // polish — scale-reference props that suggest "crashed in formation").
        const companions: ReadonlyArray<{ kind: 'fuselage' | 'engine_cluster' | 'escape_pod'; dx: number; dz: number; scale: number; tiltX?: number; tiltZ?: number; }> = [
          { kind: 'fuselage',       dx:  35, dz: -40, scale: 1.5, tiltZ:  0.3 },
          { kind: 'engine_cluster', dx: -45, dz:  20, scale: 1.0, tiltX: -0.4 },
          { kind: 'escape_pod',     dx:  25, dz:  35, scale: 1.2, tiltZ: -0.2 },
        ];
        for (const c of companions) {
          const cx = bestX + c.dx;
          const cz = bestZ + c.dz;
          const cy = terrain.heightAt(cx, cz);
          placeWreck(scene, world, terrain, new THREE.Vector3(cx, cy, cz), c.kind, rand, {
            scale: c.scale,
            buryY: 0.6,
            tiltX: c.tiltX,
            tiltZ: c.tiltZ,
          });
        }
        break;
      }
    }
  }

  // ── AAQ — themed POI clusters ────────────────────────────────────
  // After flagships are placed, sample N cluster anchors avoiding both
  // the flagships and the player spawn. Each cluster is built from
  // existing wreck/camp primitives in a coordinated layout. Cluster
  // anchors are pushed onto `_placedFlagshipPositions` so procgenPoi's
  // rejection sampler treats them as obstacles too (procgen wrecks
  // won't intrude on a convoy crash site).
  const clusterAnchors = sampleClusterPositions(rand, terrain, positions);
  for (const c of clusterAnchors) {
    if (c.kind === 'military_convoy') {
      placeMilitaryConvoy(scene, world, terrain, rand, { x: c.x, z: c.z }, salvageables);
    } else if (c.kind === 'comm_relay') {
      placeCommRelayCluster(scene, world, terrain, rand, { x: c.x, z: c.z }, salvageables);
    } else {
      placeRefugeeCaravan(scene, world, terrain, rand, { x: c.x, z: c.z }, pickupList, salvageables);
    }
    // Add cluster anchor to the flagship-position list so procgenPoi
    // honors it via the same min-sep mechanism (POI_MIN_SEPARATION).
    _placedFlagshipPositions = [..._placedFlagshipPositions, { x: c.x, z: c.z }];
  }

  // ── ABJ — A4: dune buried cockpit POI ────────────────────────────
  // 1 per world (cap at Tuning.BURIED_COCKPIT_COUNT). Sampled at dune
  // biome centroid via findBiomeCentroid (greedy w/ exclusion of
  // flagships, clusters, player spawn). First of a planned biome-
  // specific POI family (salt outpost + rocky entrance deferred to
  // future sessions per scope-cut tier).
  if (biomes) {
    const cockpitExcludes = _placedFlagshipPositions.map(p => ({
      x: p.x, z: p.z, radius: Tuning.POI_MIN_SEPARATION,
    }));
    const cockpitCenters = sampleBuriedCockpitPositions(
      biomes, cockpitExcludes, Tuning.BURIED_COCKPIT_COUNT,
    );
    for (const c of cockpitCenters) {
      const y = terrain.heightAt(c.x, c.z);
      placeBuriedCockpit(
        scene, world, terrain,
        new THREE.Vector3(c.x, y, c.z),
        rand, salvageables,
      );
      _placedFlagshipPositions = [..._placedFlagshipPositions, { x: c.x, z: c.z }];
    }
  }
}

// ── ABJ — B3: comm_relay cluster ─────────────────────────────────────
// Central antenna spire + 2-3 small dish reflectors at 8-12m radius +
// debris pieces (relay went down) + 1 salvage panel on the spire base.
// Composes existing primitives (no new wreck modules per D93).
function placeCommRelayCluster(
  scene: THREE.Scene,
  world: RAPIER.World,
  terrain: Terrain,
  rand: Rng,
  anchor: { x: number; z: number },
  salvageables: SalvageableRegistry | undefined,
): void {
  const y = terrain.heightAt(anchor.x, anchor.z);
  const center = new THREE.Vector3(anchor.x, y, anchor.z);

  // Central concrete base — half-buried cube with antenna spire on top.
  const baseGroup = new THREE.Group();
  baseGroup.position.copy(center);
  const baseSize = 1.8;
  const baseH = 1.0;
  const baseMat = new THREE.MeshLambertMaterial({
    color: 0x6e6660, flatShading: true,
  });
  const baseBox = new THREE.Mesh(
    new THREE.BoxGeometry(baseSize, baseH, baseSize),
    baseMat,
  );
  baseBox.position.y = baseH * 0.35;     // half-buried
  baseBox.castShadow = true;
  baseBox.receiveShadow = true;
  baseGroup.add(baseBox);

  // Antenna spire — tall slim cylinder
  const spireMat = new THREE.MeshLambertMaterial({
    color: 0x4a4640, flatShading: true,
  });
  const spireH = 6.0;
  const spire = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.08, spireH, 8),
    spireMat,
  );
  spire.position.y = baseH + spireH / 2;
  spire.castShadow = true;
  baseGroup.add(spire);
  // Cross-bar near the top
  const crossbar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.03, 0.8, 6),
    spireMat,
  );
  crossbar.rotation.z = Math.PI / 2;
  crossbar.position.y = baseH + spireH * 0.85;
  baseGroup.add(crossbar);
  // Beacon stub at the very top (small box; could glow at night in a
  // future polish pass).
  const beacon = new THREE.Mesh(
    new THREE.BoxGeometry(0.10, 0.14, 0.10),
    new THREE.MeshLambertMaterial({ color: 0xc04030 }),
  );
  beacon.position.y = baseH + spireH + 0.07;
  baseGroup.add(beacon);

  // 3 guy-wires (tube geometry along catmull curves from spire-top to
  // ground 120° apart).
  const wireMat = new THREE.MeshLambertMaterial({
    color: 0x2a2622, flatShading: true,
  });
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.3;
    const groundR = 2.5;
    const top = new THREE.Vector3(0, baseH + spireH * 0.92, 0);
    const bot = new THREE.Vector3(Math.cos(a) * groundR, 0, Math.sin(a) * groundR);
    const curve = new THREE.CatmullRomCurve3([
      top,
      new THREE.Vector3(
        Math.cos(a) * groundR * 0.5,
        (top.y + bot.y) * 0.5 - 0.15,
        Math.sin(a) * groundR * 0.5,
      ),
      bot,
    ]);
    const tube = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 8, 0.015, 4, false),
      wireMat,
    );
    baseGroup.add(tube);
  }

  // Salvage panel on the concrete base — front face (+Z)
  addAccessPanel(
    baseGroup,
    0, baseH * 0.65, baseSize / 2,
    1,
    0,
    'engine_cluster',     // cabling-heavy palette fits comm equipment
  );
  scene.add(baseGroup);
  attachCompoundCollider(world, baseGroup);
  if (salvageables) {
    registerSalvageable(salvageables, baseGroup, 'engine_cluster', center, rand);
  }

  // Radial dish reflectors — 2-3 placed at 8-12m radius pointed inward
  // toward the spire. Each is a small Lathe parabola (simpler than
  // satelliteDish flagship, just for silhouette).
  const dishCount = 2 + Math.floor(rand() * 2);    // 2-3
  for (let i = 0; i < dishCount; i++) {
    const a = (i / dishCount) * Math.PI * 2 + rand() * 0.5;
    const r = 8 + rand() * 4;                       // 8-12m
    const dx = Math.cos(a) * r;
    const dz = Math.sin(a) * r;
    const dy = terrain.heightAt(anchor.x + dx, anchor.z + dz);

    const dishGroup = new THREE.Group();
    dishGroup.position.set(anchor.x + dx, dy, anchor.z + dz);
    // Pole
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.05, 1.2, 6),
      spireMat,
    );
    pole.position.y = 0.6;
    dishGroup.add(pole);
    // Dish — small parabolic Lathe
    const dishR = 0.55;
    const dishPts: THREE.Vector2[] = [];
    for (let p = 0; p <= 8; p++) {
      const t = p / 8;
      const x = t * dishR;
      const y = -t * t * 0.20;       // shallow parabola
      dishPts.push(new THREE.Vector2(x, y));
    }
    const dishGeom = new THREE.LatheGeometry(dishPts, 12);
    const dish = new THREE.Mesh(
      dishGeom,
      new THREE.MeshLambertMaterial({
        color: 0x9a8a78, side: THREE.DoubleSide, flatShading: true,
      }),
    );
    dish.position.y = 1.2;
    dishGroup.add(dish);
    // Point inward toward the spire — rotate around Y so the dish "looks at" the center.
    const yawToCenter = Math.atan2(-dz, -dx) + Math.PI / 2;
    dishGroup.rotation.y = yawToCenter;
    // Slight terrain tilt
    dishGroup.rotation.z = (rand() - 0.5) * 0.15;
    scene.add(dishGroup);
    attachCompoundCollider(world, dishGroup);
  }

  // Debris field at impact site — 6 pieces around the base showing the relay collapsed.
  placeDebrisField(scene, terrain, center, 4.0, rand, 6);
}
