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
import type { SalvageableRegistry, Salvageable } from './salvage.ts';
import { placeProcgenPOI } from './poiAssembler.ts';
import { pickArchetype, type ArchetypeId } from './poiArchetypes.ts';
import { makeScatterRock } from './rockScatter.ts';
import { buildWordlessTableau } from './wordlessScenes.ts';
import { spawnLizard, despawnLizard, type Lizard } from '../enemies/lizard.ts';
import { spawnShrew, removeShrew, type Shrew } from '../enemies/shrew.ts';

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
 *  no POI / salt biome). Offsets are ring positions around the wreck. */
export interface ChunkFaunaDesc {
  lizards: Array<{ x: number; z: number }>;
  shrews: Array<{ x: number; z: number }>;
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
}

export interface ChunkManager {
  /** Stream the ring toward (px, pz). Call once per frame. */
  update: (px: number, pz: number) => void;
  /** Pure: descriptor for ANY chunk, loaded or not. */
  describeChunk: (cx: number, cz: number) => ChunkDesc;
  /** Toggle the S1 marker layer. Regenerates all active chunks. */
  setMarkersEnabled: (on: boolean) => void;
  /** S3 — wire the live lizard array (created after the manager at boot;
   *  streamed lizards push into it / splice out of it). */
  wireCreatures: (lizards: Lizard[]) => void;
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
  };
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
    const present = outsideOrigin && roll < Tuning.CHUNK_POI_CHANCE;
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
    const fauna: ChunkFaunaDesc = { lizards: [], shrews: [] };
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
    return {
      cx, cz, seed,
      markers: markerList,
      poi,
      rocks,
      scene: sceneDesc,
      fauna,
    };
  };

  // S3 — the live lizard list (= ctx.lizards) is created AFTER the manager
  // (boot creature spawn order is sacred); main.ts wires it before play.
  // Shrews self-register into their module list via spawnShrew.
  let lizardList: Lizard[] | null = null;

  const loadChunk = (cx: number, cz: number): void => {
    const group = new THREE.Group();
    group.name = `chunk-${cx}_${cz}`;
    const bodies: RAPIER.RigidBody[] = [];
    const salvage: Salvageable[] = [];
    const chunkLizards: Lizard[] = [];
    const chunkShrews: Shrew[] = [];
    const desc = describeChunk(cx, cz);
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
      // so the save serializer skips them (regenerate-pristine v1, D290/S5).
      for (const rec of salvageables.list.slice(before)) {
        rec.transient = true;
        salvage.push(rec);
      }
      // ── S3: the wreck's fauna cluster (transient — the D292 rule). ──
      if (lizardList) {
        for (const f of desc.fauna.lizards) {
          const l = spawnLizard(scene, world, terrain, f);
          l.transient = true;
          lizardList.push(l);
          chunkLizards.push(l);
        }
      }
      for (const f of desc.fauna.shrews) {
        const s = spawnShrew(scene, world, terrain, f);   // self-registers into the module list
        s.transient = true;
        chunkShrews.push(s);
      }
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
    chunks.set(key(cx, cz), { cx, cz, group, bodies, salvage, lizards: chunkLizards, shrews: chunkShrews });
  };

  const unloadChunk = (k: string): void => {
    const c = chunks.get(k);
    if (!c) return;
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
      // S3 rocks/tableau props: per-mesh geometry is chunk-owned (dispose);
      // their materials are module singletons (never disposed).
      if (mesh.userData.chunkGeo) {
        mesh.geometry.dispose();
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
    wireCreatures: (lizards) => { lizardList = lizards; },
    stats: () => {
      let markerMeshCount = 0;
      let bodyCount = 0;
      let poiCount = 0;
      let salvageCount = 0;
      let rockCount = 0;
      let lizardCount = 0;
      let shrewCount = 0;
      for (const c of chunks.values()) {
        c.group.traverse((obj) => {
          const mesh = obj as THREE.Mesh;
          if (mesh.isMesh && (mesh.geometry === markerGeo || mesh.geometry === crossGeo)) markerMeshCount++;
          if (mesh.isMesh && mesh.userData.streamRock) rockCount++;
          if ((obj as THREE.Group).userData?.poiArchetype) poiCount++;
        });
        bodyCount += c.bodies.length;
        salvageCount += c.salvage.length;
        lizardCount += c.lizards.length;
        shrewCount += c.shrews.length;
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
      };
    },
  };
}

/** Per-frame tick — keeps the terrain tile ring AND the content-chunk
 *  ring centered on the player. No-ops during the escape-pod intro (the
 *  authored origin region is fully loaded at boot; streaming starts when
 *  normal play does, so the released intro path is untouched). */
export function updateChunks(c: GameContext): void {
  if (c.intro?.active) return;
  const p = c.player.body.body.translation();
  c.terrain.recenter(p.x, p.z);
  c.chunks.update(p.x, p.z);
}
