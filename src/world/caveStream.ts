// DEEPER cycle 5 (2026-07-25) — CAVE BUILD SCHEDULING + THE RESIDENT CAP. Walk-test defect D-4:
//
//   "will also need to preload the caves on the starting loading screen so it doesn't slow down the
//    game as much when it loads in"  — Zach, 2026-07-24
//
// D-4 is TWO problems, and this module owns the second one.
//
//   1. THE ORIGIN / EGG CAVE — built synchronously in `main.ts` during module init, i.e. behind the
//      boot loading screen, before the first frame is ever presented. It is resident before play
//      starts and can never hitch. That half needs no scheduler; it needs the boot cost to be
//      MEASURED and COVERED (see `#boot-overlay` in index.html + the `cave:*` marks in `__bootT`).
//
//   2. EVERY OTHER CAVE — cycle 8 makes caves a regular rocky-terrain feature, so they will build
//      during travel and cannot be preloaded. Those go through this scheduler, which is the S6/D296
//      terrain-tile pattern applied to `startSpawnCave`: ONE in-flight build, advanced by
//      `CAVE_BUILD_SLICE_MS` of wall clock per frame, with an ATOMIC finalize — the cave becomes
//      visible and collidable in the same frame, never one without the other (rule 9).
//
// THE HONEST NUMBER, measured and not hidden: the cave build's one INDIVISIBLE cost is the Rapier
// trimesh bake at ~70k triangles (~68ms, cycle 2). No slicer can chop a single `ColliderDesc.trimesh`
// call, so the worst frame during a streamed cave build is the finalize frame, not the slice budget.
// Everything before it — the SDF field pass, both surface-nets passes, the sky-rim cut, the vertex
// colours — is sliced to the budget. The gate asserts BOTH numbers separately so neither hides the
// other (`chunk-perf`, scripts/verify-chunks.mjs).
//
// THE RESIDENT CAP. Each cave interior is ~90k visual triangles and a ~70k-triangle static trimesh.
// `CAVE_RESIDENT_MAX` bounds how many are loaded at once. THE RULE THAT OUTRANKS THE CAP: **the cave
// the player is inside is never evicted** — evicting it would delete the floor under the capsule and
// drop the player through the world. Occupancy is a padded-bounds test against the live player
// position, and a pinned cave (the origin/egg cave, which owns the terrain hole and the companion
// egg) is never evictable at all. If every resident is occupied or pinned the cap is simply not
// enforced this frame — a soft cap that can never cause a fall-through.

import * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';
import { Tuning } from '../config/tuning.ts';
import { startSpawnCave, type CaveJunction, type CaveSpawnJob, type SpawnedCave } from './caveGen.ts';
import type { Terrain } from './terrain.ts';

export interface CaveResident {
  key: string;
  seed: number;
  cave: SpawnedCave;
  /** Padded world bounds of the cave interior (occupancy + eviction distance). */
  box: THREE.Box3;
  center: THREE.Vector3;
  /** Never evicted (the origin/egg cave: it owns the carved terrain hole + the companion egg). */
  pinned: boolean;
  /** Monotonic counter — the tiebreak when several caves are equally far. */
  bornAt: number;
}

export interface CaveStreamPerf {
  /** Sliced stage-steps executed (a SYNC build would be 1 — the tripwire that slicing actually runs). */
  steps: number;
  /** Caves that reached `done` through the sliced path. */
  builds: number;
  /** Worst single-frame cost of a DIVISIBLE slice step (SDF field / both surface-nets passes /
   *  the sky-rim cut / the vertex colours) — this is what CAVE_BUILD_SLICE_MS actually bounds. */
  maxSliceMs: number;
  /** Worst single-frame cost of an INDIVISIBLE step. Three exist and none can be chopped:
   *  `sdf:geom` (three.js computeVertexNormals is one pass), `dress` (the speleothem/fungi kit), and
   *  `finalize` (Rapier's trimesh bake + scene.add, the dominant one at ~90ms / 70k tris). Reported
   *  separately so an atomic cost can never hide inside the slice budget. */
  maxAtomicMs: number;
  /** The stage that produced `maxAtomicMs` — names the cost instead of leaving it anonymous. */
  worstAtomicStage: string;
  /** Worst single-frame cost of ANY cave step, whichever kind. */
  maxStepMs: number;
  /** Evictions performed, and the count refused because the cave was occupied or pinned. */
  evictions: number;
  evictionsRefused: number;
  /** Set if the scheduler ever considered evicting the cave the player was standing in. */
  occupiedEvictionsBlocked: number;
}

/** DEEPER cycle 6 — how a resident cave publishes its water pools into `ctx.waterSources`. The
 *  registry is built AFTER the origin cave (main.ts), so the sink is installed late; installing it
 *  attaches every cave that is already resident, and from then on it is driven by the resident
 *  lifecycle. THE INVARIANT: a pool source never outlives its cave — eviction detaches before the
 *  geometry is disposed, so the interaction raycast can never hold a mesh that left the scene. */
export interface CavePoolSink {
  attach(cave: SpawnedCave): void;
  detach(cave: SpawnedCave): void;
}

export interface CaveStream {
  /** Queue a cave build at `junction`. Returns the resident key (idempotent per key). */
  request(key: string, junction: CaveJunction, seed: number): string;
  /** Install the water-source sink (see CavePoolSink). Attaches existing residents immediately. */
  setPoolSink(sink: CavePoolSink): void;
  /** Register an ALREADY-BUILT cave (the boot preload) as a resident. */
  adopt(key: string, junction: CaveJunction, seed: number, cave: SpawnedCave, pinned: boolean): CaveResident;
  /** Per-frame tick: advance the in-flight build by the slice budget, then enforce the cap. */
  update(playerPos: { x: number; y: number; z: number }): void;
  residents(): CaveResident[];
  /** The resident whose padded bounds contain the player, or null. */
  occupied(playerPos: { x: number; y: number; z: number }): CaveResident | null;
  pending(): { key: string; stage: string } | null;
  queued(): number;
  perf(): CaveStreamPerf;
  resetPerf(): void;
}

/** The build stages that cannot be chopped, so their cost is reported apart from the slice budget:
 *  `graph` (the room-graph solve, ~1ms), `sdf:geom` (three.js computeVertexNormals over the whole
 *  index buffer), `dress` (speleothems + fungi), `finalize` (the Rapier trimesh bake + scene.add). */
const ATOMIC_STAGES = new Set(['graph', 'sdf:geom', 'dress', 'finalize']);

/** Padded interior bounds from the room graph (chamber ellipsoids + their floors/ceilings). */
function caveBounds(cave: SpawnedCave): THREE.Box3 {
  const box = new THREE.Box3();
  box.makeEmpty();
  for (const n of cave.graph.nodes) {
    box.expandByPoint(new THREE.Vector3(n.x - n.rx, n.floorY - 1, n.z - n.rz));
    box.expandByPoint(new THREE.Vector3(n.x + n.rx, n.floorY + n.height + 1, n.z + n.rz));
  }
  return box;
}

/** Tear a resident down completely: geometries disposed, group off-scene, rigid body (and with it
 *  every collider it owns) removed. Rule 9 — no orphaned collider under vanished geometry. */
function disposeResident(scene: THREE.Scene, world: RAPIER.World, r: CaveResident): void {
  scene.remove(r.cave.group);
  r.cave.group.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && m.geometry) m.geometry.dispose();     // materials are module-shared — never disposed
  });
  if (r.cave.body) world.removeRigidBody(r.cave.body);
}

export function createCaveStream(
  scene: THREE.Scene,
  world: RAPIER.World,
  terrain: Terrain,
): CaveStream {
  const list: CaveResident[] = [];
  const queue: Array<{ key: string; junction: CaveJunction; seed: number }> = [];
  let inflight: { key: string; junction: CaveJunction; seed: number; job: CaveSpawnJob } | null = null;
  let born = 0;
  const perf: CaveStreamPerf = {
    steps: 0, builds: 0, maxSliceMs: 0, maxAtomicMs: 0, worstAtomicStage: '-', maxStepMs: 0,
    evictions: 0, evictionsRefused: 0, occupiedEvictionsBlocked: 0,
  };

  let poolSink: CavePoolSink | null = null;

  const has = (key: string): boolean =>
    list.some((r) => r.key === key) || queue.some((q) => q.key === key) || inflight?.key === key;

  const addResident = (key: string, seed: number, cave: SpawnedCave, pinned: boolean): CaveResident => {
    const box = caveBounds(cave);
    const r: CaveResident = {
      key, seed, cave, box, center: box.getCenter(new THREE.Vector3()), pinned, bornAt: born++,
    };
    list.push(r);
    poolSink?.attach(cave);          // DEEPER cycle 6 — publish this cave's pools as water sources
    return r;
  };

  const occupied = (p: { x: number; y: number; z: number }): CaveResident | null => {
    const m = Tuning.CAVE_EVICT_MARGIN_M;
    for (const r of list) {
      if (p.x >= r.box.min.x - m && p.x <= r.box.max.x + m
        && p.z >= r.box.min.z - m && p.z <= r.box.max.z + m
        && p.y >= r.box.min.y - m && p.y <= r.box.max.y + m) return r;
    }
    return null;
  };

  const enforceCap = (p: { x: number; y: number; z: number }): void => {
    while (list.length > Tuning.CAVE_RESIDENT_MAX) {
      const here = occupied(p);
      // Candidates: not pinned, not the occupied cave, and not close enough that the player could be
      // looking at it. Farthest-first — the same nearest-keeps policy the chunk ring uses.
      let victim: CaveResident | null = null;
      let bestD = -1;
      let blockedOccupied = 0;
      for (const r of list) {
        if (r.pinned) continue;
        if (here && r === here) { blockedOccupied++; continue; }
        const d = Math.hypot(r.center.x - p.x, r.center.z - p.z);
        if (d < Tuning.CAVE_EVICT_MIN_DIST_M) continue;
        if (d > bestD) { bestD = d; victim = r; }
      }
      perf.occupiedEvictionsBlocked += blockedOccupied;
      if (!victim) { perf.evictionsRefused++; return; }   // soft cap — never evict at the cost of a fall-through
      // Detach BEFORE the geometry goes: the interaction raycast must never hold a pool mesh that
      // has left the scene (rule 9's registry twin — no dangling source under vanished water).
      poolSink?.detach(victim.cave);
      disposeResident(scene, world, victim);
      list.splice(list.indexOf(victim), 1);
      perf.evictions++;
    }
  };

  const update = (playerPos: { x: number; y: number; z: number }): void => {
    if (!inflight && queue.length) {
      const next = queue.shift()!;
      inflight = { ...next, job: startSpawnCave(scene, world, terrain, next.junction, next.seed) };
    }
    if (inflight) {
      const stageBefore = inflight.job.stage();
      const t0 = performance.now();
      const done = inflight.job.step(Tuning.CAVE_BUILD_SLICE_MS);
      const ms = performance.now() - t0;
      perf.steps++;
      if (ms > perf.maxStepMs) perf.maxStepMs = ms;
      // Indivisible stages are budgeted SEPARATELY from the divisible ones, so a ~90ms Rapier bake
      // can never launder a blown slice budget (or vice versa).
      if (ATOMIC_STAGES.has(stageBefore)) {
        if (ms > perf.maxAtomicMs) { perf.maxAtomicMs = ms; perf.worstAtomicStage = stageBefore; }
      } else if (ms > perf.maxSliceMs) {
        perf.maxSliceMs = ms;
      }
      if (done) {
        addResident(inflight.key, inflight.seed, inflight.job.result(), false);
        perf.builds++;
        inflight = null;
      }
    }
    enforceCap(playerPos);
  };

  return {
    request: (key, junction, seed) => {
      if (!has(key)) queue.push({ key, junction, seed });
      return key;
    },
    adopt: (key, _junction, seed, cave, pinned) => addResident(key, seed, cave, pinned),
    setPoolSink: (sink) => {
      poolSink = sink;
      for (const r of list) sink.attach(r.cave);   // catch up the caves that were resident already
    },
    update,
    residents: () => list.slice(),
    occupied,
    pending: () => (inflight ? { key: inflight.key, stage: inflight.job.stage() } : null),
    queued: () => queue.length,
    perf: () => ({ ...perf }),
    resetPerf: () => {
      perf.steps = 0; perf.builds = 0; perf.maxSliceMs = 0; perf.maxAtomicMs = 0;
      perf.worstAtomicStage = '-'; perf.maxStepMs = 0;
      perf.evictions = 0; perf.evictionsRefused = 0; perf.occupiedEvictionsBlocked = 0;
    },
  };
}

/** A far-field cave junction for a site with no crevice entrance yet. DEEPER cycle 8 replaces this
 *  with the real `spawnCaveEntrance` hand-off (tor + carved terrain hole + slot polyline); until
 *  then this gives the scheduler and its gate a REAL cave body to build at an arbitrary site —
 *  the expensive, sliceable part — without pretending the entrance mechanism is solved.
 *  Seed-pure: derived from the site only. */
export function farCaveJunction(terrain: Terrain, x: number, z: number): CaveJunction {
  const gy = terrain.pureHeightAt(x, z);
  // Heading: a deterministic function of the site, so the same site always yields the same cave.
  const a = (Math.abs(Math.sin(x * 0.017 + z * 0.031)) * Math.PI * 2);
  return {
    x, y: gy - Tuning.CREVICE_DEPTH, z, gy,
    width: Math.max(2.2, Tuning.CREVICE_HALF_W_DEEP * 2),
    heading: { x: Math.cos(a), z: Math.sin(a) },
  };
}
