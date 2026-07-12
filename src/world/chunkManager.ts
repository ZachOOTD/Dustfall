// Infinite Sands S1 (campaign 2026-07-10) — content-chunk streaming.
//
// The ChunkManager keeps a ring of CONTENT chunks loaded around the player
// on an unbounded integer grid: chunk (cx, cz) spans
// [cx*SIZE, (cx+1)*SIZE) × [cz*SIZE, (cz+1)*SIZE), SIZE =
// Tuning.CHUNK_SIZE (112m). Chunks within CHUNK_LOAD_RADIUS (Chebyshev)
// of the ANCHOR chunk load; beyond it they fully unload — meshes removed +
// geometry disposed, every Rapier body removed (rule 9: no orphaned
// colliders), registry entries released. The anchor follows the player
// with an 8m margin past the chunk edge (anti-thrash hysteresis — see
// update()).
//
// DETERMINISM LAW (D208/D226 extended): a chunk's content is a pure
// function of (worldSeed, cx, cz). `describeChunk` produces the full
// content descriptor from `chunkSeed(worldSeed, cx, cz)` alone — loading
// only *renders* that descriptor. Same seed → byte-identical descriptor →
// identical world, every visit, every boot. The chunk-determinism probe
// (scripts/rig-shot.mjs) gates this per cycle.
//
// S1 content is the spike proof: one numbered marker post per chunk
// (+ seed-varied satellites) with real colliders, OFF by default in
// normal play (`markers` flag) — the machinery (lifecycle, disposal,
// probes) is the deliverable. S2 hangs real POIs on this same lifecycle.

import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { GameContext } from '../GameContext.ts';
import { Tuning } from '../config/tuning.ts';
import { makeRng } from '../core/rng.ts';
import type { Terrain } from './terrain.ts';
import type { BiomeSampler, BiomeId } from './biomes.ts';
import { markSalvageStripped, type SalvageableRegistry, type Salvageable } from './salvage.ts';
import { placeProcgenPOI } from './poiAssembler.ts';
import { pickArchetype, type ArchetypeId } from './poiArchetypes.ts';
import { makeScatterRock } from './rockScatter.ts';
import { buildWordlessTableau } from './wordlessScenes.ts';
import { spawnLizard, despawnLizard, type Lizard } from '../enemies/lizard.ts';
import { spawnShrew, removeShrew, type Shrew } from '../enemies/shrew.ts';
import { placeRibcage } from './heroLandmarks.ts';
import { getPlayerPos } from '../util/playerPos.ts';
import { spawnDeadTreeAt } from './deadTree.ts';
import { spawnWellAt, type WaterSource } from './waterSources.ts';
import { spawnCactusAt, type Cactus } from './cactus.ts';
import { spawnScrapAt, despawnPickup, type Pickup } from '../pickups/pickups.ts';

/** 32-bit avalanche mix of (worldSeed, cx, cz) — the per-chunk seed.
 *  Murmur3-finalizer style so adjacent chunk coords (including negatives)
 *  land far apart in seed space. */
export function chunkSeed(worldSeed: number, cx: number, cz: number): number {
  let h = worldSeed >>> 0;
  h = Math.imul(h ^ (cx | 0), 0x85ebca6b) >>> 0;
  h = ((h << 13) | (h >>> 19)) >>> 0;
  h = Math.imul(h ^ (cz | 0), 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x45d9f3b) >>> 0;
  h ^= h >>> 15;
  return h >>> 0;
}

/** One marker in a chunk descriptor. World-space XZ; Y is resolved
 *  against the terrain at render time (terrain is itself deterministic). */
export interface ChunkMarkerDesc {
  x: number;
  z: number;
  yaw: number;
  height: number;
  /** 0..1 — rendered as the post's hue so per-chunk variety is VISIBLE. */
  tint: number;
}

/** Infinite Sands S2 — the streamed-POI roll for one chunk. Fixed shape:
 *  every field is drawn/derived whether or not `present` (stable rand
 *  budget → descriptor byte-identity is meaningful). `renderSeed` seeds
 *  the FRESH rng `placeProcgenPOI` consumes at load time (yaw, bury,
 *  panel count, salvage registration) so rendering is a pure function of
 *  the descriptor (D290). */
export interface ChunkPoiDesc {
  present: boolean;
  x: number;
  z: number;
  biome: BiomeId;
  archetype: ArchetypeId;
  renderSeed: number;
}

/** Infinite Sands S3 — one streamed scatter rock (kept candidates only). */
export interface ChunkRockDesc {
  x: number;
  z: number;
  /** Seeds the rock's own 6-draw pose rng at render time. */
  seed: number;
}

/** Infinite Sands S3 — the streamed wordless-scene roll (fixed shape). */
export interface ChunkSceneDesc {
  present: boolean;
  x: number;
  z: number;
  /** Archetype cycle index + the tableau's render rng seed. */
  index: number;
  seed: number;
}

/** Infinite Sands S3 — the fauna cluster at this chunk's POI (empty when
 *  no POI / salt biome), plus D299 free-ROAMING prey independent of any
 *  wreck (the origin's global sparse fill, chunk-rolled). */
export interface ChunkFaunaDesc {
  lizards: Array<{ x: number; z: number }>;
  shrews: Array<{ x: number; z: number }>;
  roamLizards: Array<{ x: number; z: number }>;
  roamShrews: Array<{ x: number; z: number }>;
}

/** D299 — origin-parity dressing: dead trees (salt, flat), a rare well
 *  (salt), a rare cactus patch (salt, flat). All fixed-shape rolls. */
export interface ChunkDressingDesc {
  trees: Array<{ x: number; z: number; seed: number }>;
  well: { present: boolean; x: number; z: number; seed: number };
  cacti: Array<{ x: number; z: number; seed: number }>;
}

/** Infinite Sands S4 — the rare per-REGION hero landmark (fixed shape).
 *  `present` is true only on the ONE chunk that hosts the region's
 *  landmark position. Kinds: 'colossal_ribcage' (a titan skeleton
 *  breaching the dunes — a silhouette destination) | 'wreck_knot' (a
 *  tight 3-wreck salvage knot + 2 carcasses — a reward destination). */
export interface ChunkLandmarkDesc {
  present: boolean;
  kind: 'colossal_ribcage' | 'wreck_knot';
  x: number;
  z: number;
  seed: number;
}

/** The full deterministic content descriptor for one chunk. */
export interface ChunkDesc {
  cx: number;
  cz: number;
  seed: number;
  markers: ChunkMarkerDesc[];
  poi: ChunkPoiDesc;
  rocks: ChunkRockDesc[];
  scene: ChunkSceneDesc;
  fauna: ChunkFaunaDesc;
  landmark: ChunkLandmarkDesc;
  dressing: ChunkDressingDesc;
}

interface LoadedChunk {
  cx: number;
  cz: number;
  group: THREE.Group;
  bodies: RAPIER.RigidBody[];
  /** S2 — this chunk's streamed-wreck salvage registry entries (spliced
   *  back out on unload). */
  salvage: Salvageable[];
  /** S3 — this chunk's streamed fauna (despawned on unload unless the
   *  player already looted them). */
  lizards: Lizard[];
  shrews: Shrew[];
  /** S6 — heavy content pieces (landmark knot wrecks/ribcages) deferred
   *  to ONE piece per frame so a landmark chunk can't blow a single
   *  frame. Executed thunks push into bodies/salvage/etc as usual;
   *  unload drops unexecuted thunks (their content never existed). */
  deferred: Array<() => void>;
  /** S5 — the looted-fauna ids this chunk was LOADED with (skipped at
   *  spawn; unioned back in at capture so they never resurrect). */
  priorLooted: string[];
  /** D299 — streamed pickups (tree branches, wreck scrap), wells, cacti
   *  this chunk owns, + the taken-pickup ids it was loaded with. */
  pickups: Pickup[];
  wells: WaterSource[];
  cactiRecs: Cactus[];
  priorTaken: string[];
}

/** S5 — one chunk's deviations from its descriptor-pristine state
 *  (SAVE_VERSION 17 `chunkDiffs` values). Sparse: pristine chunks have no
 *  entry. Keys are descriptor-derived content ids (D290/D297 — NEVER the
 *  runtime registry ids, the D292 trap). */
export interface ChunkDiff {
  salvage?: Record<string, { remaining: number; stripped: boolean; extracted: number[] }>;
  fauna?: { looted: string[] };
  /** D299 — taken streamed pickups (tree branches, wreck scrap rings). */
  pickups?: { taken: string[] };
}

export interface ChunkManager {
  /** Stream the ring toward (px, pz). Call once per frame. */
  update: (px: number, pz: number) => void;
  /** S5 — snapshot live chunks into the diff map and return the full map
   *  (plain object) for the save file. */
  serializeDiffs: () => Record<string, ChunkDiff>;
  /** S5 — replace the diff map from a loaded save (loadGameState). */
  loadDiffs: (data: Record<string, ChunkDiff> | undefined) => void;
  /** Pure: descriptor for ANY chunk, loaded or not. */
  describeChunk: (cx: number, cz: number) => ChunkDesc;
  /** Toggle the S1 marker layer. Regenerates all active chunks. */
  setMarkersEnabled: (on: boolean) => void;
  /** S3/D299 — wire the live GameContext after boot placement (streamed
   *  content pushes into / splices out of its live lists). */
  wireCtx: (ctx: GameContext) => void;
  /** Probe/debug snapshot. */
  stats: () => {
    activeKeys: string[];
    markersEnabled: boolean;
    markerMeshCount: number;
    bodyCount: number;
    poiCount: number;
    salvageCount: number;
    /** S3 — streamed scatter meshes (rocks + tableau props). */
    rockCount: number;
    lizardCount: number;
    shrewCount: number;
    /** S4 — streamed hero landmarks (root groups tagged streamLandmark). */
    landmarkCount: number;
    /** D299 — origin-parity dressing counts (tracked per chunk). */
    treeCount: number;
    wellCount: number;
    cactusCount: number;
    pickupCount: number;
    /** S6 — per-load wall-clock maxima. */
    perf: { loads: number; maxLoadMs: number; maxPoiLoadMs: number; maxLandmarkLoadMs: number };
  };
  /** S6 — reset the load-perf maxima (probe baseline). */
  resetPerf: () => void;
}

export function createChunkManager(
  scene: THREE.Scene,
  world: RAPIER.World,
  terrain: Terrain,
  biomes: BiomeSampler,
  salvageables: SalvageableRegistry,
  worldSeed: number,
): ChunkManager {
  const SIZE = Tuning.CHUNK_SIZE;
  const LOAD_R = Tuning.CHUNK_LOAD_RADIUS;

  const chunks = new Map<string, LoadedChunk>();
  const key = (cx: number, cz: number): string => `${cx},${cz}`;

  // S1 marker layer visibility. Default OFF for normal play (the spike
  // content is a probe/debug affordance, not set dressing); probes and
  // curious humans enable it via localStorage or __game.setChunkMarkers.
  let markers = false;
  try {
    markers = localStorage.getItem('dustfall.chunkMarkers') === '1';
  } catch { /* headless/no-storage contexts run markers-off */ }

  // One shared material per tint bucket would be ideal; S1 keeps one
  // shared base material and colors via per-mesh material clones ONLY for
  // marker posts (cheap, few, and fully disposed with the chunk).
  const markerGeo = new THREE.CylinderGeometry(0.28, 0.34, 3.2, 8);
  const crossGeo = new THREE.BoxGeometry(1.6, 0.16, 0.16);

  const describeChunk = (cx: number, cz: number): ChunkDesc => {
    const seed = chunkSeed(worldSeed, cx, cz);
    const rand = makeRng(seed);
    // Center post + 0-2 satellites. Every value below is drawn from the
    // chunk's OWN rng stream — nothing global, nothing order-dependent
    // across chunks. Fixed draw budget (D226 discipline): 8 draws always.
    const centerX = (cx + 0.5) * SIZE;
    const centerZ = (cz + 0.5) * SIZE;
    const markerList: ChunkMarkerDesc[] = [];
    markerList.push({
      x: centerX,
      z: centerZ,
      yaw: rand() * Math.PI * 2,
      height: 2.6 + rand() * 1.4,
      tint: rand(),
    });
    const satCount = Math.floor(rand() * 3);   // 0..2
    for (let s = 0; s < 2; s++) {
      const ox = (rand() - 0.5) * SIZE * 0.7;
      const oz = (rand() - 0.5) * SIZE * 0.7;
      if (s < satCount) {
        markerList.push({
          x: centerX + ox,
          z: centerZ + oz,
          yaw: 0,
          height: 1.4,
          tint: markerList[0].tint,
        });
      }
    }
    // ── S2: the streamed-POI roll (a DEDICATED rng stream so the S1
    //    marker draws above stay byte-stable). Every draw happens
    //    unconditionally — fixed budget. ──
    const poiRand = makeRng((seed ^ 0x9e3779b9) >>> 0);
    const roll = poiRand();
    const px = (cx + 0.5) * SIZE + (poiRand() - 0.5) * (SIZE - 2 * Tuning.CHUNK_POI_EDGE_MARGIN_M);
    const pz = (cz + 0.5) * SIZE + (poiRand() - 0.5) * (SIZE - 2 * Tuning.CHUNK_POI_EDGE_MARGIN_M);
    const biome = biomes.biomeAt(px, pz);
    const archetype = pickArchetype(poiRand, biome);
    const renderSeed = Math.floor(poiRand() * 0x100000000) >>> 0;
    // The boot-placed field owns the origin region — streamed POIs begin
    // beyond the exclusion radius (measured at the chunk CENTER so the
    // whole chunk rolls consistently).
    const exclR = Tuning.CHUNK_POI_ORIGIN_EXCLUSION_M;
    const outsideOrigin = centerX * centerX + centerZ * centerZ > exclR * exclR;
    // S4 — regional wreck-yards are DENSE: a graveyard biome chunk rolls
    // wrecks at 4× the field rate so far yards read as destinations (the
    // origin yard's density comes from a boot cluster; regional yards get
    // theirs from the roll). Same archetype weights (the graveyard mix).
    const poiChance = biome === 'wreck_yard'
      ? Tuning.CHUNK_POI_CHANCE * 6
      : Tuning.CHUNK_POI_CHANCE;
    const present = outsideOrigin && roll < poiChance;
    const poi: ChunkPoiDesc = { present, x: px, z: pz, biome, archetype, renderSeed };
    // ── S3: rocks — N candidates from a dedicated stream, kept only on
    //    rocky biome (the boot sampler's rule), never inside the origin
    //    field, and never on a wordless-scene stage (cleared below). ──
    const rockRand = makeRng((seed ^ 0x726f636b) >>> 0);
    const rocks: ChunkRockDesc[] = [];
    for (let r = 0; r < Tuning.CHUNK_ROCK_CANDIDATES; r++) {
      // Fixed budget: 3 draws per candidate, always.
      const rx = cx * SIZE + rockRand() * SIZE;
      const rz = cz * SIZE + rockRand() * SIZE;
      const rSeed = Math.floor(rockRand() * 0x100000000) >>> 0;
      if (!outsideOrigin) continue;
      if (biomes.biomeAt(rx, rz) !== 'rocky') continue;
      rocks.push({ x: rx, z: rz, seed: rSeed });
    }
    // ── S3: wordless scene — a rare roll (fixed 4-draw budget). ──
    const sceneRand = makeRng((seed ^ 0x5ce7e5) >>> 0);
    const sceneRoll = sceneRand();
    const sx = (cx + 0.5) * SIZE + (sceneRand() - 0.5) * (SIZE - 2 * Tuning.CHUNK_POI_EDGE_MARGIN_M);
    const sz = (cz + 0.5) * SIZE + (sceneRand() - 0.5) * (SIZE - 2 * Tuning.CHUNK_POI_EDGE_MARGIN_M);
    const sceneSeed = Math.floor(sceneRand() * 0x100000000) >>> 0;
    const scenePresent = outsideOrigin && sceneRoll < Tuning.CHUNK_WORDLESS_CHANCE;
    const sceneDesc: ChunkSceneDesc = {
      present: scenePresent,
      x: sx,
      z: sz,
      index: Math.abs(cx * 31 + cz * 17),
      seed: sceneSeed,
    };
    // A boulder in the middle of a death tableau reads as clutter — the
    // boot ring clears rocks off stages; here it's a descriptor-level cull.
    if (scenePresent) {
      for (let r = rocks.length - 1; r >= 0; r--) {
        const dx = rocks[r].x - sx, dz = rocks[r].z - sz;
        if (dx * dx + dz * dz < Tuning.WORDLESS_SCENE_CLEAR_M * Tuning.WORDLESS_SCENE_CLEAR_M) {
          rocks.splice(r, 1);
        }
      }
    }
    // ── S3: fauna cluster at the POI wreck (boot rule: none on salt).
    //    Fixed budget: 2 count draws + 2×MAX offset pairs, always. ──
    const faunaRand = makeRng((seed ^ 0xfa0a) >>> 0);
    const lizCount = 1 + Math.floor(faunaRand() * Tuning.CHUNK_POI_LIZARDS_MAX);
    const shrewCount = Math.floor(faunaRand() * (Tuning.CHUNK_POI_SHREWS_MAX + 1));
    const fauna: ChunkFaunaDesc = { lizards: [], shrews: [], roamLizards: [], roamShrews: [] };
    const faunaOk = present && biome !== 'salt';
    for (let i = 0; i < Tuning.CHUNK_POI_LIZARDS_MAX; i++) {
      const ang = faunaRand() * Math.PI * 2;
      const dist = 6 + faunaRand() * 8;
      if (faunaOk && i < lizCount) {
        fauna.lizards.push({ x: px + Math.cos(ang) * dist, z: pz + Math.sin(ang) * dist });
      }
    }
    for (let i = 0; i < Tuning.CHUNK_POI_SHREWS_MAX; i++) {
      const ang = faunaRand() * Math.PI * 2;
      const dist = 6 + faunaRand() * 8;
      if (faunaOk && i < shrewCount) {
        fauna.shrews.push({ x: px + Math.cos(ang) * dist, z: pz + Math.sin(ang) * dist });
      }
    }
    // ── S4: the region's rare hero landmark — hosted by exactly ONE chunk
    //    (the one containing the region-rolled position). Pure per-region
    //    derivation; fixed shape either way. ──
    const REGION = Tuning.CHUNK_REGION_CHUNKS;
    const rx = Math.floor(cx / REGION);
    const rz = Math.floor(cz / REGION);
    const regionRand = makeRng(chunkSeed((worldSeed ^ 0x1a4d) >>> 0, rx, rz));
    const regionRoll = regionRand();
    const regionKind: ChunkLandmarkDesc['kind'] = regionRand() < 0.5 ? 'colossal_ribcage' : 'wreck_knot';
    const REGION_M = REGION * SIZE;
    const lmMargin = 150;
    const lx = rx * REGION_M + lmMargin + regionRand() * (REGION_M - 2 * lmMargin);
    const lz = rz * REGION_M + lmMargin + regionRand() * (REGION_M - 2 * lmMargin);
    const lmSeed = Math.floor(regionRand() * 0x100000000) >>> 0;
    const lmOutside = lx * lx + lz * lz > exclR * exclR;
    const landmark: ChunkLandmarkDesc = {
      present:
        lmOutside &&
        regionRoll < Tuning.CHUNK_LANDMARK_CHANCE &&
        Math.floor(lx / SIZE) === cx &&
        Math.floor(lz / SIZE) === cz,
      kind: regionKind,
      x: lx,
      z: lz,
      seed: lmSeed,
    };
    // ── D299: origin-parity dressing (trees, well, cactus patch) +
    //    free-roaming prey. Dedicated streams; every draw unconditional
    //    (fixed budget). Flatness gates use the PURE closed-form height —
    //    bilinear-vs-formula differences must never flip a descriptor. ──
    const pureFlat = (fx: number, fz: number, r = 1.5): number => {
      const c = terrain.pureHeightAt(fx, fz);
      return Math.max(
        Math.abs(terrain.pureHeightAt(fx + r, fz) - c),
        Math.abs(terrain.pureHeightAt(fx - r, fz) - c),
        Math.abs(terrain.pureHeightAt(fx, fz + r) - c),
        Math.abs(terrain.pureHeightAt(fx, fz - r) - c),
      );
    };
    const dressRand = makeRng((seed ^ 0xd4e551) >>> 0);
    const trees: ChunkDressingDesc['trees'] = [];
    for (let t = 0; t < Tuning.CHUNK_TREE_CANDIDATES; t++) {
      const tx2 = cx * SIZE + dressRand() * SIZE;
      const tz2 = cz * SIZE + dressRand() * SIZE;
      const tSeed = Math.floor(dressRand() * 0x100000000) >>> 0;
      if (!outsideOrigin) continue;
      if (biomes.biomeAt(tx2, tz2) !== 'salt') continue;
      if (pureFlat(tx2, tz2) > Tuning.DEAD_TREE_FLATNESS_THRESHOLD) continue;
      trees.push({ x: tx2, z: tz2, seed: tSeed });
    }
    const wellRoll = dressRand();
    const wlx = (cx + 0.5) * SIZE + (dressRand() - 0.5) * (SIZE - 2 * Tuning.CHUNK_POI_EDGE_MARGIN_M);
    const wlz = (cz + 0.5) * SIZE + (dressRand() - 0.5) * (SIZE - 2 * Tuning.CHUNK_POI_EDGE_MARGIN_M);
    const wSeed = Math.floor(dressRand() * 0x100000000) >>> 0;
    const wellPresent = outsideOrigin && wellRoll < Tuning.CHUNK_WELL_CHANCE
      && biomes.biomeAt(wlx, wlz) === 'salt';
    const cactusRoll = dressRand();
    const ccx = (cx + 0.5) * SIZE + (dressRand() - 0.5) * (SIZE - 2 * Tuning.CHUNK_POI_EDGE_MARGIN_M);
    const ccz = (cz + 0.5) * SIZE + (dressRand() - 0.5) * (SIZE - 2 * Tuning.CHUNK_POI_EDGE_MARGIN_M);
    const cactusCount = Tuning.CHUNK_CACTUS_PATCH_MIN
      + Math.floor(dressRand() * (Tuning.CHUNK_CACTUS_PATCH_MAX - Tuning.CHUNK_CACTUS_PATCH_MIN + 1));
    const patchOk = outsideOrigin && cactusRoll < Tuning.CHUNK_CACTUS_PATCH_CHANCE
      && biomes.biomeAt(ccx, ccz) === 'salt';
    const cacti: ChunkDressingDesc['cacti'] = [];
    for (let i = 0; i < Tuning.CHUNK_CACTUS_PATCH_MAX; i++) {
      const ang = dressRand() * Math.PI * 2;
      const dist = Math.sqrt(dressRand()) * 12;   // boot cluster radius
      const cSeed = Math.floor(dressRand() * 0x100000000) >>> 0;
      const px2 = ccx + Math.cos(ang) * dist;
      const pz2 = ccz + Math.sin(ang) * dist;
      if (!patchOk || i >= cactusCount) continue;
      if (biomes.biomeAt(px2, pz2) !== 'salt') continue;
      if (pureFlat(px2, pz2) > 0.6) continue;   // the boot loop's local threshold
      cacti.push({ x: px2, z: pz2, seed: cSeed });
    }
    // Free-roaming prey (non-salt — the boot rule).
    const roamRand = makeRng((seed ^ 0x40a4) >>> 0);
    const rlRoll = roamRand();
    const rlx = cx * SIZE + roamRand() * SIZE;
    const rlz = cz * SIZE + roamRand() * SIZE;
    if (outsideOrigin && rlRoll < Tuning.CHUNK_ROAM_LIZARD_CHANCE && biomes.biomeAt(rlx, rlz) !== 'salt') {
      fauna.roamLizards = [{ x: rlx, z: rlz }];
    } else fauna.roamLizards = [];
    const rsRoll = roamRand();
    const rsx = cx * SIZE + roamRand() * SIZE;
    const rsz = cz * SIZE + roamRand() * SIZE;
    if (outsideOrigin && rsRoll < Tuning.CHUNK_ROAM_SHREW_CHANCE && biomes.biomeAt(rsx, rsz) !== 'salt') {
      fauna.roamShrews = [{ x: rsx, z: rsz }];
    } else fauna.roamShrews = [];
    return {
      cx, cz, seed,
      markers: markerList,
      poi,
      rocks,
      scene: sceneDesc,
      fauna,
      landmark,
      dressing: { trees, well: { present: wellPresent, x: wlx, z: wlz, seed: wSeed }, cacti },
    };
  };

  // S3/D299 — the live GameContext is wired AFTER boot placement finishes
  // (boot spawn order is sacred); streamed content needs its live lists
  // (pickups, cacti, waterSources, lizards) + despawnPickup's ctx.
  let gameCtx: GameContext | null = null;
  let lizardList: Lizard[] | null = null;

  // S6 — per-load wall-clock accounting (drives the chunk-perf gate).
  const _perf = { loads: 0, maxLoadMs: 0, maxPoiLoadMs: 0, maxLandmarkLoadMs: 0 };

  // ── S5 — the per-chunk save-diff layer. `diffs` holds every known
  // modified chunk ("cx,cz" → ChunkDiff); populated from the save at
  // load-game, updated on chunk unload (capture) + at save time (live
  // snapshot), consumed on chunk load (apply). Sparse by construction:
  // an untouched chunk never gets an entry. ──
  let diffs = new Map<string, ChunkDiff>();

  /** Mark + baseline a piece's freshly-registered salvage records so the
   *  capture/apply sides share ids ("<prefix>/<index in registration order>"). */
  const tagSalvage = (recs: Salvageable[], prefix: string): void => {
    recs.forEach((rec, j) => {
      rec.chunkContentId = `${prefix}/${j}`;
      rec.chunkInitialRemaining = rec.salvageRemaining;
    });
  };

  /** Apply a chunk diff's salvage entries to freshly-registered records
   *  (mirrors the v16 loader: remaining + stripped visuals + re-hidden
   *  extracted components). */
  const applySalvageDiff = (chunkKey: string, recs: Salvageable[]): void => {
    const diff = diffs.get(chunkKey);
    if (!diff?.salvage) return;
    for (const rec of recs) {
      const d = diff.salvage[rec.chunkContentId ?? ''];
      if (!d) continue;
      rec.salvageRemaining = d.remaining;
      if (d.stripped) markSalvageStripped(rec);
      const comps = (rec.panel.userData.panelComponents as Array<{ visible: boolean }> | undefined) ?? [];
      for (const i of d.extracted) { if (comps[i]) comps[i].visible = false; }
    }
  };

  /** Capture a loaded chunk's deviations into the diff map (called on
   *  unload + at save time). Pristine chunks are REMOVED from the map —
   *  the descriptor regenerates them for free. */
  const captureChunkDiff = (c: LoadedChunk): void => {
    const k = key(c.cx, c.cz);
    const diff: ChunkDiff = {};
    for (const rec of c.salvage) {
      const touched = rec.stripped ||
        rec.salvageRemaining < (rec.chunkInitialRemaining ?? rec.salvageRemaining);
      if (!touched) continue;
      const comps = (rec.panel.userData.panelComponents as Array<{ visible: boolean }> | undefined) ?? [];
      const extracted = comps.flatMap((cm, i) => (cm.visible ? [] : [i]));
      (diff.salvage ??= {})[rec.chunkContentId ?? ''] = {
        remaining: rec.salvageRemaining,
        stripped: rec.stripped,
        extracted,
      };
    }
    // Union the incoming looted set (creatures skipped at spawn never
    // appear in c.lizards/shrews — without the union they'd resurrect on
    // the visit after next).
    const looted = [
      ...c.priorLooted,
      ...c.lizards.filter((l) => l.looted).map((l) => l.chunkContentId ?? ''),
      ...c.shrews.filter((s) => s.looted).map((s) => s.chunkContentId ?? ''),
    ].filter(Boolean);
    if (looted.length) diff.fauna = { looted: [...new Set(looted)] };
    // D299 — taken streamed pickups: a tracked pickup no longer in the
    // live list was taken by the player. Union the incoming taken set
    // (taken ones were culled at spawn — same resurrect trap as fauna).
    const takenNow = gameCtx
      ? c.pickups.filter((p) => !gameCtx!.pickups.list.includes(p)).map((p) => p.chunkContentId ?? '')
      : [];
    const taken = [...c.priorTaken, ...takenNow].filter(Boolean);
    if (taken.length) diff.pickups = { taken: [...new Set(taken)] };
    if (diff.salvage || diff.fauna || diff.pickups) diffs.set(k, diff);
    else diffs.delete(k);
  };

  const loadChunk = (cx: number, cz: number): void => {
    const _t0 = performance.now();
    const group = new THREE.Group();
    group.name = `chunk-${cx}_${cz}`;
    const bodies: RAPIER.RigidBody[] = [];
    const salvage: Salvageable[] = [];
    const chunkLizards: Lizard[] = [];
    const chunkShrews: Shrew[] = [];
    const deferred: Array<() => void> = [];
    const priorLooted: string[] = [];
    const chunkPickups: Pickup[] = [];
    const chunkWells: WaterSource[] = [];
    const chunkCacti: Cactus[] = [];
    const priorTaken: string[] = [];
    const desc = describeChunk(cx, cz);
    // S5/D299 — this chunk's diff state, consulted by every content class.
    const chunkDiff = diffs.get(key(cx, cz));
    const lootedSet = new Set(chunkDiff?.fauna?.looted ?? []);
    priorLooted.push(...lootedSet);
    const takenSet = new Set(chunkDiff?.pickups?.taken ?? []);
    priorTaken.push(...takenSet);
    // Track-or-cull a freshly spawned streamed pickup: taken ones (per the
    // diff) despawn immediately — spawning-then-despawning keeps the rand
    // draw order identical to a fresh chunk (determinism).
    const trackPickup = (p: Pickup, contentId: string): void => {
      p.transient = true;
      p.chunkContentId = contentId;
      if (takenSet.has(contentId) && gameCtx) despawnPickup(gameCtx, p);
      else chunkPickups.push(p);
    };
    // ── S2: streamed POI wreck — a pure render of the descriptor. The
    //    archetype is FORCED from the descriptor (the determinism gate
    //    covers the pick); the fresh renderSeed rng drives yaw/bury/panels/
    //    salvage registration. Deliberately SKIPPED vs the boot path:
    //    addHorizonSilhouette (module-global, no removal — S4's landmark
    //    concern) and the scrap-debris ring (pickup ids are save-coupled;
    //    per-chunk loot diffs arrive at S5). ──
    if (desc.poi.present) {
      const p = desc.poi;
      const rand = makeRng(p.renderSeed);
      const before = salvageables.list.length;
      const poiGroup = placeProcgenPOI(
        scene, world, terrain,
        new THREE.Vector3(p.x, terrain.heightAt(p.x, p.z), p.z),
        rand, salvageables,
        { archetype: p.archetype, biome: p.biome, parent: group, buryY: 0.3 + rand() * 0.4 },
      );
      // The 'ship' delegate (placeProcgenComposite) doesn't stamp the
      // archetype itself — normalize so stats/probes count every streamed POI.
      if (!poiGroup.userData.poiArchetype) poiGroup.userData.poiArchetype = p.archetype;
      const poiBody = poiGroup.userData.poiBody as RAPIER.RigidBody | undefined;
      if (poiBody) bodies.push(poiBody);
      // Entries added by this POI (post-prune survivors) — marked transient
      // (excluded from the global id-keyed save arrays, D292) and tagged
      // with descriptor-derived content ids for the S5 chunk diff, which
      // is then applied (a revisit restores stripped/extracted state).
      const poiRecs = salvageables.list.slice(before);
      for (const rec of poiRecs) {
        rec.transient = true;
        salvage.push(rec);
      }
      tagSalvage(poiRecs, 'poi');
      applySalvageDiff(key(cx, cz), poiRecs);
      // ── D299: the scrap-debris ring around the streamed wreck (the boot
      //    parity item S2 deferred until transient pickups existed).
      //    Deterministic from a renderSeed-derived stream. ──
      if (gameCtx) {
        const sRand = makeRng((p.renderSeed ^ 0x5c4a9) >>> 0);
        const n = Tuning.SCRAP_PER_WRECK_MIN
          + Math.floor(sRand() * (Tuning.SCRAP_PER_WRECK_MAX - Tuning.SCRAP_PER_WRECK_MIN + 1));
        for (let j = 0; j < n; j++) {
          const ang = sRand() * Math.PI * 2;
          const rr = Tuning.SCRAP_RING_RADIUS_MIN + sRand() * (Tuning.SCRAP_RING_RADIUS_MAX - Tuning.SCRAP_RING_RADIUS_MIN);
          const sp = spawnScrapAt(scene, terrain, p.x + Math.cos(ang) * rr, p.z + Math.sin(ang) * rr, sRand, gameCtx.pickups.list);
          trackPickup(sp, `poi/sc${j}`);
        }
      }
      // ── S3: the wreck's fauna cluster (transient — the D292 rule).
      //    S5: looted ones (per the chunk diff) never respawn. ──
      if (lizardList) {
        desc.fauna.lizards.forEach((f, i) => {
          if (lootedSet.has(`l${i}`)) return;
          const l = spawnLizard(scene, world, terrain, f);
          l.transient = true;
          l.chunkContentId = `l${i}`;
          lizardList!.push(l);
          chunkLizards.push(l);
        });
      }
      desc.fauna.shrews.forEach((f, i) => {
        if (lootedSet.has(`s${i}`)) return;
        const s = spawnShrew(scene, world, terrain, f);   // self-registers into the module list
        s.transient = true;
        s.chunkContentId = `s${i}`;
        chunkShrews.push(s);
      });
    }
    // ── S4: the region's hero landmark (this chunk hosts it). Rendered
    //    from lm.seed alone; bodies tracked; salvage transient (D292);
    //    ribcage geometry AND material are per-call → chunk-owned. ──
    if (desc.landmark.present) {
      const lm = desc.landmark;
      const rand = makeRng(lm.seed);
      const tagRibcage = (grp: THREE.Group): void => {
        grp.traverse((o) => {
          const m = o as THREE.Mesh;
          if (m.isMesh) { m.userData.chunkGeo = true; m.userData.chunkMat = true; }
        });
      };
      if (lm.kind === 'colossal_ribcage') {
        // A single cheap build — render inline.
        const scale = 5 + rand() * 3;   // a 20-40m titan skeleton
        const y = terrain.heightAt(lm.x, lm.z) - scale * (0.1 + rand() * 0.15);
        const rc = placeRibcage(scene, world, new THREE.Vector3(lm.x, y, lm.z), rand, group, scale);
        rc.group.userData.streamLandmark = lm.kind;
        tagRibcage(rc.group);
        const body = rc.collider.parent();
        if (body) bodies.push(body);
      } else {
        // wreck_knot — 5 heavy pieces. S6: DEFERRED, one piece per frame
        // (a single frame rendering 3 wreck assemblies + merges was the
        // worst generation hitch). ALL rng draws happen NOW, in the same
        // order as the old inline render, so the pieces are byte-identical
        // regardless of when their thunks execute.
        const chunkRef = (): LoadedChunk | undefined => chunks.get(key(cx, cz));
        for (let i = 0; i < 3; i++) {
          const ang = (i / 3) * Math.PI * 2 + rand() * 0.6;
          const dist = 18 + rand() * 14;
          const kx = lm.x + Math.cos(ang) * dist;
          const kz = lm.z + Math.sin(ang) * dist;
          const kBiome = biomes.biomeAt(kx, kz);
          const kArch = pickArchetype(rand, kBiome);
          const buryY = 0.3 + rand() * 0.4;
          const pieceSeed = Math.floor(rand() * 0x100000000) >>> 0;
          const isFirst = i === 0;
          deferred.push(() => {
            const c = chunkRef();
            if (!c) return;
            const before = salvageables.list.length;
            const pg = placeProcgenPOI(
              scene, world, terrain,
              new THREE.Vector3(kx, terrain.heightAt(kx, kz), kz),
              makeRng(pieceSeed), salvageables,
              { archetype: kArch, biome: kBiome, parent: c.group, buryY },
            );
            if (!pg.userData.poiArchetype) pg.userData.poiArchetype = kArch;
            if (isFirst) pg.userData.streamLandmark = lm.kind;
            const pb = pg.userData.poiBody as RAPIER.RigidBody | undefined;
            if (pb) c.bodies.push(pb);
            const knotRecs = salvageables.list.slice(before);
            for (const rec of knotRecs) {
              rec.transient = true;
              c.salvage.push(rec);
            }
            // S5 — knot piece i's panels persist under "lm/<i>/<j>".
            tagSalvage(knotRecs, `lm/${i}`);
            applySalvageDiff(key(cx, cz), knotRecs);
          });
        }
        for (let i = 0; i < 2; i++) {
          const ang = rand() * Math.PI * 2;
          const dist = 8 + rand() * 20;
          const rx2 = lm.x + Math.cos(ang) * dist;
          const rz2 = lm.z + Math.sin(ang) * dist;
          const pieceSeed = Math.floor(rand() * 0x100000000) >>> 0;
          deferred.push(() => {
            const c = chunkRef();
            if (!c) return;
            const rc = placeRibcage(scene, world, new THREE.Vector3(rx2, terrain.heightAt(rx2, rz2), rz2), makeRng(pieceSeed), c.group, 1);
            tagRibcage(rc.group);
            const body = rc.collider.parent();
            if (body) c.bodies.push(body);
          });
        }
      }
    }
    // ── D299: origin-parity dressing — dead trees (+ branch pickups),
    //    a rare well, a rare cactus patch, free-roaming prey. All render
    //    from descriptor-derived seeds through the REAL single-unit
    //    spawners; all state channels (transient flags, chunk diffs)
    //    mirror the S2/S3/S5 patterns. Needs the wired ctx (live lists). ──
    if (gameCtx) {
      desc.dressing.trees.forEach((t, ti) => {
        const tRand = makeRng(t.seed);
        const res = spawnDeadTreeAt(scene, terrain, world, t.x, t.z, tRand, gameCtx!.pickups.list, group);
        res.group.traverse((o) => {
          const m = o as THREE.Mesh;
          if (m.isMesh) m.userData.chunkGeo = true;   // merged tree geo is per-tree; _treeMat shared
        });
        const tBody = res.collider.parent();
        if (tBody) bodies.push(tBody);
        res.branches.forEach((b, j) => trackPickup(b, `t${ti}/b${j}`));
      });
      if (desc.dressing.well.present) {
        const w = spawnWellAt(scene, terrain, desc.dressing.well.x, desc.dressing.well.z, makeRng(desc.dressing.well.seed), group);
        w.mesh.traverse((o) => {
          const m = o as THREE.Mesh;
          if (m.isMesh) m.userData.chunkGeo = true;   // per-well geos; stone/wood mats shared
        });
        gameCtx.waterSources.list.push(w);
        chunkWells.push(w);
      }
      for (const c2 of desc.dressing.cacti) {
        const { cactus, body: cBody } = spawnCactusAt(scene, world, terrain, c2.x, c2.z, makeRng(c2.seed), group);
        cactus.transient = true;
        cactus.mesh.traverse((o) => {
          const m = o as THREE.Mesh;
          if (m.isMesh) { m.userData.chunkGeo = true; m.userData.chunkMat = true; }   // per-cactus materials
        });
        gameCtx.cacti.list.push(cactus);
        chunkCacti.push(cactus);
        bodies.push(cBody);
      }
      // Free-roaming prey (independent of any wreck).
      if (lizardList) {
        desc.fauna.roamLizards.forEach((f, i) => {
          if (lootedSet.has(`rl${i}`)) return;
          const l = spawnLizard(scene, world, terrain, f);
          l.transient = true;
          l.chunkContentId = `rl${i}`;
          lizardList!.push(l);
          chunkLizards.push(l);
        });
      }
      desc.fauna.roamShrews.forEach((f, i) => {
        if (lootedSet.has(`rs${i}`)) return;
        const s = spawnShrew(scene, world, terrain, f);
        s.transient = true;
        s.chunkContentId = `rs${i}`;
        chunkShrews.push(s);
      });
    }
    // ── S3: scatter rocks (no colliders — visual props, the boot rule).
    //    Per-rock geometry is chunk-owned; materials are module singletons. ──
    for (const r of desc.rocks) {
      const rock = makeScatterRock(terrain, r.x, r.z, makeRng(r.seed));
      rock.userData.chunkGeo = true;
      rock.userData.streamRock = true;   // probe metric: rocks distinct from tableau props
      group.add(rock);
    }
    // ── S3: a rare wordless tableau (decoration-only, no colliders). ──
    if (desc.scene.present) {
      const sceneRng = makeRng(desc.scene.seed);
      const yaw = sceneRng() * Math.PI * 2;
      const tableau = buildWordlessTableau(desc.scene.index, sceneRng);
      tableau.position.set(desc.scene.x, terrain.heightAt(desc.scene.x, desc.scene.z), desc.scene.z);
      tableau.rotation.y = yaw;
      tableau.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) o.userData.chunkGeo = true;
      });
      group.add(tableau);
    }
    if (markers) {
      for (let m = 0; m < desc.markers.length; m++) {
        const md = desc.markers[m];
        const y = terrain.heightAt(md.x, md.z);
        const mat = new THREE.MeshLambertMaterial({
          color: new THREE.Color().setHSL(md.tint, 0.75, 0.5),
        });
        const post = new THREE.Mesh(markerGeo, mat);
        post.name = `marker-${cx}_${cz}-${m}`;
        post.scale.y = md.height / 3.2;
        post.position.set(md.x, y + md.height * 0.5, md.z);
        post.rotation.y = md.yaw;
        group.add(post);
        if (m === 0) {
          // The center post gets a yaw'd crossbar — makes the yaw draw
          // visible so a determinism regression shows up on screen too.
          const bar = new THREE.Mesh(crossGeo, mat);
          bar.position.set(md.x, y + md.height + 0.15, md.z);
          bar.rotation.y = md.yaw;
          group.add(bar);
        }
        // Real collider per post — the streaming probe asserts these are
        // fully disposed on unload (body count returns to baseline).
        const body = world.createRigidBody(
          RAPIER.RigidBodyDesc.fixed().setTranslation(md.x, y + md.height * 0.5, md.z),
        );
        world.createCollider(
          RAPIER.ColliderDesc.cuboid(0.34, md.height * 0.5, 0.34),
          body,
        );
        bodies.push(body);
      }
    }
    scene.add(group);
    chunks.set(key(cx, cz), {
      cx, cz, group, bodies, salvage,
      lizards: chunkLizards, shrews: chunkShrews,
      deferred, priorLooted,
      pickups: chunkPickups, wells: chunkWells, cactiRecs: chunkCacti, priorTaken,
    });
    const _ms = performance.now() - _t0;
    _perf.loads++;
    if (_ms > _perf.maxLoadMs) _perf.maxLoadMs = _ms;
    if (desc.poi.present && _ms > _perf.maxPoiLoadMs) _perf.maxPoiLoadMs = _ms;
    if (desc.landmark.present && _ms > _perf.maxLandmarkLoadMs) _perf.maxLandmarkLoadMs = _ms;
  };

  const unloadChunk = (k: string): void => {
    const c = chunks.get(k);
    if (!c) return;
    // S5 — capture the chunk's deviations BEFORE teardown (the diff map
    // is what makes a revisit + the save file remember them).
    captureChunkDiff(c);
    chunks.delete(k);
    scene.remove(c.group);
    c.group.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      if (mesh.geometry === markerGeo || mesh.geometry === crossGeo) {
        // Marker: shared geometry survives; the per-post material clone doesn't.
        (mesh.material as THREE.Material).dispose();
        return;
      }
      // S3 rocks/tableau props + S4 ribcages: per-mesh geometry is
      // chunk-owned (dispose); materials are module singletons EXCEPT the
      // ribcage's per-call material (chunkMat — dispose is idempotent
      // across the ribcage's shared-material meshes).
      if (mesh.userData.chunkGeo) {
        mesh.geometry.dispose();
        if (mesh.userData.chunkMat) (mesh.material as THREE.Material).dispose();
        return;
      }
      // POI content: dispose ONLY merge-output geometry (unique per POI,
      // tagged noCollider by mergeStaticByMaterial — the memory that
      // matters). Panel/component meshes may share module-level geometry
      // and ALL wreck materials are shared bucket singletons — never
      // dispose those.
      if (mesh.userData.noCollider) mesh.geometry.dispose();
    });
    // S3 fauna: despawn survivors (looted ones already had mesh/body
    // removed by their loot path — skip them).
    if (lizardList) {
      for (const l of c.lizards) {
        if (!l.looted && lizardList.includes(l)) despawnLizard(l, scene, world, lizardList);
      }
    }
    for (const s of c.shrews) {
      if (!s.looted) removeShrew(s, scene, world);
    }
    // D299 dressing teardown: pickups despawn pool-aware (taken ones are
    // already gone from the live list — skip); wells/cacti splice out of
    // their ctx lists (their meshes go with the group; cactus bodies are
    // in c.bodies).
    if (gameCtx) {
      for (const p of c.pickups) {
        if (gameCtx.pickups.list.includes(p)) despawnPickup(gameCtx, p);
      }
      for (const w of c.wells) {
        const wi = gameCtx.waterSources.list.indexOf(w);
        if (wi >= 0) gameCtx.waterSources.list.splice(wi, 1);
      }
      for (const cc of c.cactiRecs) {
        const ci = gameCtx.cacti.list.indexOf(cc);
        if (ci >= 0) gameCtx.cacti.list.splice(ci, 1);
      }
    }
    // Splice this chunk's streamed salvage entries back out of the live
    // registry (interaction rebuilds its target list per frame, so
    // removal is immediately effective).
    for (const rec of c.salvage) {
      const idx = salvageables.list.indexOf(rec);
      if (idx >= 0) salvageables.list.splice(idx, 1);
    }
    for (const body of c.bodies) world.removeRigidBody(body);
  };

  // ANCHOR-MARGIN model: the ring centers on an ANCHOR chunk, and the
  // anchor only moves when the player walks more than CHUNK_ANCHOR_MARGIN_M
  // past the anchor chunk's edge. A player straddling (or micro-sliding on)
  // a chunk boundary therefore never flips the ring — no load/unload
  // thrash, no retained trailing band, and the active set is always exactly
  // the (2*LOAD_R+1)² ring once loads finish (the leak probe's baseline).
  let acx = Number.NaN;
  let acz = Number.NaN;

  const update = (px: number, pz: number): void => {
    const margin = Tuning.CHUNK_ANCHOR_MARGIN_M;
    if (
      Number.isNaN(acx) ||
      px < acx * SIZE - margin || px > (acx + 1) * SIZE + margin ||
      pz < acz * SIZE - margin || pz > (acz + 1) * SIZE + margin
    ) {
      acx = Math.floor(px / SIZE);
      acz = Math.floor(pz / SIZE);
    }
    // Unload everything beyond the ring (relative to the anchor) — cheap
    // (geometry dispose + body removal), at most one ring edge per re-anchor.
    for (const k of [...chunks.keys()]) {
      const c = chunks.get(k)!;
      if (Math.max(Math.abs(c.cx - acx), Math.abs(c.cz - acz)) > LOAD_R) {
        unloadChunk(k);
      }
    }
    // Load nearest-first, budgeted per frame; the anchor chunk (where the
    // player stands, modulo the margin) always loads this frame.
    if (!chunks.has(key(acx, acz))) loadChunk(acx, acz);
    let budget = Tuning.CHUNK_LOADS_PER_FRAME;
    for (let d = 1; d <= LOAD_R && budget > 0; d++) {
      for (let cx = acx - d; cx <= acx + d && budget > 0; cx++) {
        for (let cz = acz - d; cz <= acz + d && budget > 0; cz++) {
          if (Math.max(Math.abs(cx - acx), Math.abs(cz - acz)) !== d) continue;
          if (!chunks.has(key(cx, cz))) {
            loadChunk(cx, cz);
            budget--;
          }
        }
      }
    }
    // S6 — drain ONE deferred heavy piece per frame (landmark knot wrecks/
    // ribcages) so a landmark chunk never renders more than one assembly
    // in a single frame.
    for (const c of chunks.values()) {
      if (c.deferred.length === 0) continue;
      const thunk = c.deferred.shift()!;
      const t0 = performance.now();
      thunk();
      const ms = performance.now() - t0;
      if (ms > _perf.maxLandmarkLoadMs) _perf.maxLandmarkLoadMs = ms;
      break;
    }
  };

  const setMarkersEnabled = (on: boolean): void => {
    if (on === markers) return;
    markers = on;
    // Regenerate everything active under the new flag.
    for (const k of [...chunks.keys()]) unloadChunk(k);
    // Next update() rebuilds the ring; nothing else to do here — but
    // rebuild immediately for probe determinism (no half-empty frame).
  };

  return {
    update,
    describeChunk,
    setMarkersEnabled,
    wireCtx: (c) => { gameCtx = c; lizardList = c.lizards; },
    serializeDiffs: () => {
      for (const c of chunks.values()) captureChunkDiff(c);   // live chunks too
      return Object.fromEntries(diffs);
    },
    loadDiffs: (data) => { diffs = new Map(Object.entries(data ?? {})); },
    resetPerf: () => { _perf.loads = 0; _perf.maxLoadMs = 0; _perf.maxPoiLoadMs = 0; _perf.maxLandmarkLoadMs = 0; },
    stats: () => {
      let markerMeshCount = 0;
      let bodyCount = 0;
      let poiCount = 0;
      let salvageCount = 0;
      let rockCount = 0;
      let lizardCount = 0;
      let shrewCount = 0;
      let landmarkCount = 0;
      let treeCount = 0;
      let wellCount = 0;
      let cactusCount = 0;
      let pickupCount = 0;
      for (const c of chunks.values()) {
        c.group.traverse((obj) => {
          const mesh = obj as THREE.Mesh;
          if (mesh.isMesh && (mesh.geometry === markerGeo || mesh.geometry === crossGeo)) markerMeshCount++;
          if (mesh.isMesh && mesh.userData.streamRock) rockCount++;
          if ((obj as THREE.Group).userData?.poiArchetype) poiCount++;
          if ((obj as THREE.Group).userData?.streamLandmark) landmarkCount++;
          if ((obj as THREE.Group).name === 'deadTree') treeCount++;
        });
        bodyCount += c.bodies.length;
        salvageCount += c.salvage.length;
        lizardCount += c.lizards.length;
        shrewCount += c.shrews.length;
        wellCount += c.wells.length;
        cactusCount += c.cactiRecs.length;
        pickupCount += c.pickups.length;
      }
      return {
        activeKeys: [...chunks.keys()].sort(),
        markersEnabled: markers,
        markerMeshCount,
        bodyCount,
        poiCount,
        salvageCount,
        rockCount,
        lizardCount,
        shrewCount,
        landmarkCount,
        treeCount,
        wellCount,
        cactusCount,
        pickupCount,
        perf: { ..._perf },
      };
    },
  };
}

/** Per-frame tick — keeps the terrain tile ring AND the content-chunk
 *  ring centered on the player's EFFECTIVE position. No-ops during the
 *  escape-pod intro (the authored origin region is fully loaded at boot;
 *  streaming starts when normal play does).
 *
 *  Uses getPlayerPos, NOT the raw capsule (playtest bug, 2026-07-11 /
 *  D297): while riding the speeder the capsule is PARKED at (0,-2000,0)
 *  (speeder.ts mount — collision isolation), so capsule-centered
 *  streaming re-anchored the world to the ORIGIN mid-ride — nothing
 *  loaded until dismount. getPlayerPos is the codebase's canonical
 *  speeder-aware accessor (the ACBD storm/dust fix was this same bug
 *  class); it also keeps the anchor-tile synchronous-build safety under
 *  the BIKE, so a fast ride can't outrun the ground it needs. */
export function updateChunks(c: GameContext): void {
  if (c.intro?.active) return;
  const p = getPlayerPos(c);
  c.terrain.recenter(p.x, p.z);
  c.chunks.update(p.x, p.z);
}
