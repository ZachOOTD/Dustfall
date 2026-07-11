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

/** The full deterministic content descriptor for one chunk. */
export interface ChunkDesc {
  cx: number;
  cz: number;
  seed: number;
  markers: ChunkMarkerDesc[];
}

interface LoadedChunk {
  cx: number;
  cz: number;
  group: THREE.Group;
  bodies: RAPIER.RigidBody[];
}

export interface ChunkManager {
  /** Stream the ring toward (px, pz). Call once per frame. */
  update: (px: number, pz: number) => void;
  /** Pure: descriptor for ANY chunk, loaded or not. */
  describeChunk: (cx: number, cz: number) => ChunkDesc;
  /** Toggle the S1 marker layer. Regenerates all active chunks. */
  setMarkersEnabled: (on: boolean) => void;
  /** Probe/debug snapshot. */
  stats: () => {
    activeKeys: string[];
    markersEnabled: boolean;
    markerMeshCount: number;
    bodyCount: number;
  };
}

export function createChunkManager(
  scene: THREE.Scene,
  world: RAPIER.World,
  terrain: Terrain,
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
    return { cx, cz, seed, markers: markerList };
  };

  const loadChunk = (cx: number, cz: number): void => {
    const group = new THREE.Group();
    group.name = `chunk-${cx}_${cz}`;
    const bodies: RAPIER.RigidBody[] = [];
    if (markers) {
      const desc = describeChunk(cx, cz);
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
    chunks.set(key(cx, cz), { cx, cz, group, bodies });
  };

  const unloadChunk = (k: string): void => {
    const c = chunks.get(k);
    if (!c) return;
    chunks.delete(k);
    scene.remove(c.group);
    c.group.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      // Shared marker geometries survive; per-post materials don't.
      if (mesh.geometry !== markerGeo && mesh.geometry !== crossGeo) {
        mesh.geometry.dispose();
      }
      const mat = mesh.material as THREE.Material;
      mat.dispose();
    });
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
    stats: () => {
      let markerMeshCount = 0;
      let bodyCount = 0;
      for (const c of chunks.values()) {
        c.group.traverse((obj) => {
          if ((obj as THREE.Mesh).isMesh) markerMeshCount++;
        });
        bodyCount += c.bodies.length;
      }
      return {
        activeKeys: [...chunks.keys()].sort(),
        markersEnabled: markers,
        markerMeshCount,
        bodyCount,
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
