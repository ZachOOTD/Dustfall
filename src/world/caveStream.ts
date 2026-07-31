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
import type { CaveKind } from './caveKinds.ts';   // DEEPER cycle 9 — cave kinds
import { caveEntranceHoleBlocks, startSpawnCaveEntrance, type CaveEntrance, type CaveEntranceJob } from './caveEntrance.ts';
import { releaseCavePoolMaterial } from './cavePools.ts';   // per-cave water material — disposed on eviction
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
  // ── DEEPER cycle 8 — a STREAMED resident owns two more things than a preloaded one: the crevice
  //    entrance (tor mesh + its trimesh body) and the carved hole in the terrain sheet. Both are
  //    null for the origin cave, whose entrance is built by main.ts and whose hole is the static
  //    D307 one baked into tile (0,0) — nothing about the origin cave streams. ──
  entrance: CaveEntrance | null;
  /** The `terrain.addCaveHole` key this resident opened, or null (origin). */
  holeKey: string | null;
  /** Where the entrance stands — the site the descriptor placed. */
  site: { x: number; z: number } | null;
}

/** What the streamer needs to know about a site. A pure descriptor from caveSites.ts. */
export interface CaveStreamSite {
  key: string;
  x: number;
  z: number;
  seed: number;
  /** DEEPER cycle 9 — the cave KIND this site rolled. Optional so a hand-placed request (the dev
   *  panel, the chunk-perf cap test) still gets the canonical cave without saying so. */
  kind?: CaveKind;
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
  /** DEEPER cycle 8 — releases driven by DISTANCE / tile unload rather than by the cap. */
  releases: number;
  /** Sites requested from the descriptor (the density driver actually firing). */
  requests: number;
  /** Worst single-frame cost of the crevice-tor build. It is the one stage this cycle could not
   *  slice (see the note on `doTor`), so it is reported on its own and never blended into the
   *  interior's numbers — an unsliced 180ms stage hiding inside a "max atomic" figure is exactly
   *  the laundering cycle 7 had to unpick. */
  maxTorMs: number;
  /** Worst single-frame cost of the ATOMIC finalize (interior collider bake + hole open). */
  maxFinalizeMs: number;
  /** Worst single-frame cost of a teardown (hole close + entrance + interior disposal). */
  maxTeardownMs: number;
  /** DEEPER cycle 8 (closing agent) — shader warm-ups started (one per streamed build). */
  warms: number;
  /** Worst single-frame cost of KICKING OFF a warm-up (the synchronous half of `compileAsync`:
   *  the traverse + `gl.compileShader`/`linkProgram` calls, NOT the link itself). */
  maxWarmMs: number;
  /** Frames the worst warm-up waited for the driver to report its programs ready. */
  maxWarmFrames: number;
  /** Warm-ups that hit CAVE_WARM_MAX_FRAMES and finalized anyway — should be 0; a non-zero value
   *  means the fail-safe fired and that build paid the cold-compile stall it was meant to avoid. */
  warmTimeouts: number;
}

/** DEEPER cycle 6 — how a resident cave publishes CONTENT that lives outside the cave's own scene
 *  graph: cycle 6's water pools into `ctx.waterSources`, and (cycle 9) the warren kind's loose scrap
 *  pickups into `ctx.pickups`. Those registries are built AFTER the origin cave (main.ts), so a sink
 *  is installed late; installing it attaches every cave that is already resident, and from then on it
 *  is driven by the resident lifecycle. THE INVARIANT: published content never outlives its cave —
 *  eviction detaches before the geometry is disposed, so the interaction raycast can never hold a
 *  mesh that left the scene.
 *
 *  DEEPER cycle 9 made this a LIST rather than a single slot (`addResidentSink`, was `setPoolSink`).
 *  Not cosmetic: the pool sink is installed while the water registry is built, and the scrap sink can
 *  only be installed once `ctx` exists — a single slot would have meant one closure spanning both
 *  moments, i.e. a boot-order landmine the day a canonical cave gets its first scrap. */
export interface CaveResidentSink {
  /** DEEPER cycle 12 added the `resident` argument. Content that PERSISTS needs the descriptor key
   *  (`resident.key`), because a `SpawnedCave` is a runtime object whose identity dies with its
   *  eviction — keying persistence off it is the D292 trap. Existing sinks that only take `cave`
   *  still satisfy this signature unchanged. */
  attach(cave: SpawnedCave, resident: CaveResident): void;
  detach(cave: SpawnedCave, resident: CaveResident): void;
}

export interface CaveStream {
  /** Queue a cave build at `junction`. Returns the resident key (idempotent per key). */
  request(key: string, junction: CaveJunction, seed: number): string;
  /** DEEPER cycle 8 — queue a FULL streamed cave (crevice entrance + interior + terrain hole) at a
   *  descriptor site. Idempotent per key; ignored if the site's terrain tile is not loaded. */
  requestSite(site: CaveStreamSite): boolean;
  /** DEEPER cycle 8 — the density driver: a pure source of the sites near a point. Installing it
   *  makes `update` stream caves in and out on its own. */
  setSiteSource(src: ((x: number, z: number, radius: number) => CaveStreamSite[]) | null): void;
  /** Install a resident-content sink (see CaveResidentSink). Attaches existing residents immediately. */
  addResidentSink(sink: CaveResidentSink): void;
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
const ATOMIC_STAGES = new Set(['graph', 'sdf:geom', 'dress', 'finalize', 'tor:geom', 'tor:finalize']);

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
 *  every collider it owns) removed. Rule 9 — no orphaned collider under vanished geometry.
 *
 *  DEEPER cycle 8 — TEARDOWN SYMMETRY. A streamed resident owns THREE things and all three go here,
 *  in the order that keeps the world legal at every instant:
 *    1. the carved terrain hole CLOSES FIRST — the sheet is solid again before the cave under it
 *       disappears, so there is never a frame with an opening onto nothing (the invariant that
 *       makes the whole density safe; see terrain.addCaveHole),
 *    2. the crevice entrance (tor mesh + its own trimesh body),
 *    3. the interior (meshes + the single trimesh body + the per-cave pool material).
 *  The pool SOURCES are detached by the caller before this runs — the interaction raycast must
 *  never hold a mesh that has left the scene. */
function disposeResident(
  scene: THREE.Scene, world: RAPIER.World, terrain: Terrain, r: CaveResident,
): void {
  // 1 — close the hole (no-op for the origin cave, whose hole is the static D307 one).
  if (r.holeKey) terrain.removeCaveHole(r.holeKey);
  // 2 — the entrance.
  if (r.entrance) {
    scene.remove(r.entrance.group);
    r.entrance.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && m.geometry) m.geometry.dispose();   // the tor's rock material is module-shared
    });
    if (r.entrance.body) world.removeRigidBody(r.entrance.body);
  }
  // 3 — the interior.
  scene.remove(r.cave.group);
  r.cave.group.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.geometry) return;
    m.geometry.dispose();
    // Materials here are module-shared and must NEVER be disposed — with ONE exception: the pool
    // water material is a PER-CAVE instance (round-13; its mirrored-emitter uniforms are this cave's
    // fungi, so it cannot be shared). Leaving it live would leak a material + its uniform arrays per
    // evicted cave and keep a dead cave in the per-frame ripple-clock loop forever. The release is
    // idempotent, which matters because several pools in one cave share the one instance.
    if (m.userData.cavePool) releaseCavePoolMaterial(m.material);
  });
  if (r.cave.body) world.removeRigidBody(r.cave.body);
}

export function createCaveStream(
  scene: THREE.Scene,
  world: RAPIER.World,
  terrain: Terrain,
  /** DEEPER cycle 8 (closing agent) — precompile an OFF-SCENE object's shader programs against the
   *  live scene. `main.ts` passes `renderer.compileAsync(obj, camera, scene)`; the gates that boot
   *  without a warm hook simply skip the stage. See `doWarm`. */
  warm: ((obj: THREE.Object3D) => Promise<unknown>) | null = null,
): CaveStream {
  const list: CaveResident[] = [];
  /** A queued build. `site` non-null ⇒ the full streamed unit (entrance + interior + hole);
   *  `junction` non-null ⇒ the legacy body-only request (the probe/debug hook). */
  interface QueueItem {
    key: string;
    seed: number;
    site: CaveStreamSite | null;
    junction: CaveJunction | null;
  }
  const queue: QueueItem[] = [];
  interface Inflight extends QueueItem {
    entrance: CaveEntrance | null;
    /** cycle 13 — the tor's own resumable build, stepped before `job` (the interior) starts. */
    torJob: CaveEntranceJob | null;
    job: CaveSpawnJob | null;
    /** 0 = not started, 1 = compiling, 2 = done/skipped (see `doWarm`). */
    warmState: 0 | 1 | 2;
    warmFrames: number;
  }
  let inflight: Inflight | null = null;
  let born = 0;
  const perf: CaveStreamPerf = {
    steps: 0, builds: 0, maxSliceMs: 0, maxAtomicMs: 0, worstAtomicStage: '-', maxStepMs: 0,
    evictions: 0, evictionsRefused: 0, occupiedEvictionsBlocked: 0,
    releases: 0, requests: 0, maxTorMs: 0, maxFinalizeMs: 0, maxTeardownMs: 0,
    warms: 0, maxWarmMs: 0, maxWarmFrames: 0, warmTimeouts: 0,
  };

  const sinks: CaveResidentSink[] = [];
  let siteSource: ((x: number, z: number, radius: number) => CaveStreamSite[]) | null = null;
  let pollCountdown = 0;

  const has = (key: string): boolean =>
    list.some((r) => r.key === key) || queue.some((q) => q.key === key) || inflight?.key === key;

  const addResident = (
    key: string, seed: number, cave: SpawnedCave, pinned: boolean,
    entrance: CaveEntrance | null = null, holeKey: string | null = null,
    site: { x: number; z: number } | null = null,
  ): CaveResident => {
    const box = caveBounds(cave);
    const r: CaveResident = {
      key, seed, cave, box, center: box.getCenter(new THREE.Vector3()), pinned, bornAt: born++,
      entrance, holeKey, site,
    };
    list.push(r);
    for (const s of sinks) s.attach(cave, r);   // publish this cave's pools (c6) + scrap (c9) + the beat (c12)
    return r;
  };

  /** Release a resident: detach its pool sources, then tear down hole → entrance → interior. */
  const release = (r: CaveResident): void => {
    const t0 = performance.now();
    for (const s of sinks) s.detach(r.cave, r);
    disposeResident(scene, world, terrain, r);
    const i = list.indexOf(r);
    if (i >= 0) list.splice(i, 1);
    const ms = performance.now() - t0;
    if (ms > perf.maxTeardownMs) perf.maxTeardownMs = ms;
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
      release(victim);
      perf.evictions++;
    }
  };

  /** DEEPER cycle 8 — DISTANCE + TILE RELEASE, run before the cap. Two rules, and the second one is
   *  the load-bearing half of the hole invariant:
   *    · past CAVE_STREAM_DROP_M the cave is simply out of range,
   *    · a cave whose TERRAIN TILE has unloaded must go, because its carved hole went with the tile
   *      and a resident whose hole the sheet no longer has is a cave with no way in. Releasing it
   *      means the pair is re-derived together when the player comes back.
   *  Both defer to occupancy and to the pin, exactly like the cap does: never drop the floor out
   *  from under the player, whatever the range says. */
  const releaseOutOfRange = (p: { x: number; y: number; z: number }): void => {
    const here = occupied(p);
    for (let i = list.length - 1; i >= 0; i--) {
      const r = list[i];
      if (r.pinned || r === here) continue;
      // A resident with NO site descriptor was placed by hand — the dev panel's "spawn far cave"
      // button and the chunk-perf gate's synthetic cap test both do this. It is not part of the
      // density system and must not evaporate just because you are not standing next to it: the
      // dev tool would be unusable, and the cap gate would never get to run (it requests four caves
      // 5km away on purpose, and the first version of this rule released them before the cap could
      // fire — a green-looking regression in the OTHER gate, caught by running it).
      if (!r.site) continue;
      const d = Math.hypot(r.site.x - p.x, r.site.z - p.z);
      const tileGone = !terrain.isTileLoadedAt(r.site.x, r.site.z);
      if (d <= Tuning.CAVE_STREAM_DROP_M && !tileGone) continue;
      release(r);
      perf.releases++;
    }
  };

  /** The density driver. Polled every CAVE_STREAM_POLL_FRAMES (the scan is a small cell sweep, but
   *  it is pure work with no reason to run every frame). A site is only requested when its terrain
   *  tile is already loaded — see the invariant. */
  const pollSites = (p: { x: number; y: number; z: number }): void => {
    if (!siteSource) return;
    if (pollCountdown-- > 0) return;
    pollCountdown = Tuning.CAVE_STREAM_POLL_FRAMES;
    // Don't out-queue the cap: one queued build at a time is enough to keep up with walking, and it
    // stops a fast traverse from banking a queue of caves the player has already left behind.
    if (queue.length || inflight) return;
    for (const s of siteSource(p.x, p.z, Tuning.CAVE_STREAM_REQUEST_M)) {
      if (has(s.key)) continue;
      if (!terrain.isTileLoadedAt(s.x, s.z)) continue;
      queue.push({ key: s.key, seed: s.seed, site: s, junction: null });
      perf.requests++;
      break;                                   // nearest first (the source sorts) — one per poll
    }
  };

  /** Stage 1 of a streamed build: the crevice tor. SLICED as of cycle 13.
   *
   *  It used to be the one unsliced stage — a single ~180-255ms call, and the worst frame in the
   *  game. It is now the same resumable-job shape as the interior (`startSpawnCaveEntrance`), and
   *  for the same reason: the divisible work (column precompute, field fill, polygonizer, vertex
   *  colour ≈ 194ms of a measured 255ms) spreads across frames, leaving only the genuinely
   *  indivisible residue on any one frame — `tor:geom` (`computeVertexNormals`, ~5ms) and
   *  `tor:finalize` (the Rapier trimesh bake of ~63k tris, ~55ms).
   *
   *  ⚠ THE HONEST LIMIT, stated rather than buried: this does NOT put the tor under a 16ms frame
   *  budget and cannot. No slicer can chop a single `ColliderDesc.trimesh` call — the same limit
   *  this file already states for the interior. What it buys is real: the tor stops being the worst
   *  frame in the game and lands in the same class as the interior bake the game already ships.
   *
   *  `maxTorMs` still reports the tor's worst SINGLE frame (not its total), so the tripwire keeps
   *  measuring what it always measured; atomic tor stages are additionally booked to
   *  `maxAtomicMs`/`worstAtomicStage` via ATOMIC_STAGES, so a blown bake can never hide inside a
   *  slice budget or vice versa.
   *
   *  The tor goes live (mesh + its trimesh collider together) while the interior is still building.
   *  That is safe and deliberate: with no hole yet, it is simply a solid rock outcrop with a fissure
   *  in it, and the terrain sheet under it is intact. Nothing is drawn that is not also solid, which
   *  is what rule 9 asks. Slicing does not change that ordering — the entrance is published only on
   *  the step that completes it. */
  const doTor = (f: Inflight): void => {
    if (!f.torJob) {
      f.torJob = startSpawnCaveEntrance(scene, world, terrain, { x: f.site!.x, z: f.site!.z }, f.seed);
    }
    const stageBefore = `tor:${f.torJob.stage()}`;
    const t0 = performance.now();
    const done = f.torJob.step(Tuning.CAVE_BUILD_SLICE_MS);
    const ms = performance.now() - t0;
    if (ms > perf.maxTorMs) perf.maxTorMs = ms;
    perf.steps++;
    if (ms > perf.maxStepMs) perf.maxStepMs = ms;
    if (ATOMIC_STAGES.has(stageBefore)) {
      if (ms > perf.maxAtomicMs) { perf.maxAtomicMs = ms; perf.worstAtomicStage = stageBefore; }
    } else if (ms > perf.maxSliceMs) {
      perf.maxSliceMs = ms;
    }
    if (done) f.entrance = f.torJob.result();
  };

  /** ── THE SHADER WARM-UP — the fix for the 1.6-SECOND FINALIZE FRAME (DEEPER cycle 8, closing).
   *
   *  WHAT WAS MEASURED. `cave-density` seed 7 reported a worst frame of 1544-1667ms across four
   *  runs, against 87ms at seed 1337 — reproducible, so structural. None of the build's own numbers
   *  came near it: tor 154-166ms, divisible slices ≤16ms, the atomic Rapier bake 81-84ms, the
   *  terrain-hole rebuild 8ms. The cost is not in the build. `finalize` calls `scene.add(group)` and
   *  the SAME frame renders a cave carrying a shader program that has never been compiled;
   *  `renderer.info.programs` went 101 → 103 across that one frame at seed 7 (and 99 → 99 at 1337).
   *  Both new keys were `cavePoolWater-v1` — the cycle-6 pool water, which is `transparent` +
   *  `DoubleSide` and therefore renders in two passes, so three needs the `flipSided` and
   *  non-flipSided builds of it. Two cold links inside one frame, and the driver blocks the draw
   *  until they finish.
   *
   *  WHY "IT'S FINE ON 1337" WAS NEVER SAFETY. Every cave has at least one pool, so every cave needs
   *  those programs; what differed is only whether something had already rendered a pool surface.
   *  And the luck does not even hold within a session — the per-cave pool material is DISPOSED on
   *  eviction, and disposing the last material that references a program frees it, so once every
   *  pooled cave has been evicted the next one pays the full stall again. This is a player-facing
   *  freeze on the first cave of a walk, not a gate artefact.
   *
   *  WHY THE OBVIOUS FIX DOES NOT WORK, tried and measured before this one: warming those programs
   *  at boot next to `renderer.compileAsync(scene, camera)`. Two materials byte-identical to a pool
   *  material but pinned FrontSide/BackSide DID compile both variants — and the streamed cave still
   *  compiled two more, because a three program key carries the SCENE'S LIGHT STATE. The boot keys
   *  read `numPointLights 33, shadowMapType 2`; the cave-build keys read `34` and `1`. No warm-up at
   *  a fixed moment can match a key that moves with the world, so the warm-up has to happen at the
   *  live light state, which means here.
   *
   *  HOW. The cave's whole material set is parented to its group before `finalize` and the group is
   *  still OFF-SCENE, which is exactly what `compileAsync(object, camera, targetScene)` exists for:
   *  lights, fog and shadow state come from the real scene, nothing is added to it, nothing is drawn.
   *  The link then runs on the driver's parallel-compile threads while the build sits here, so the
   *  finalize frame meets a warm cache. It generalises past the pool material: whatever a future cave
   *  introduces is warmed the same way, at whatever light count the world happens to have.
   *
   *  Returns true when the build may proceed to `finalize`. */
  const doWarm = (f: Inflight): boolean => {
    if (!warm || f.warmState === 2) return true;
    if (f.warmState === 0) {
      f.warmState = 1;
      perf.warms++;
      const t0 = performance.now();
      // `compileAsync`'s synchronous half (traverse + shader creation) happens inside this call; the
      // promise only reports when the driver says the programs are ready. A REJECTION is handled the
      // same way as success — the warm-up is an optimisation and a failed precompile must cost a
      // hitch, never a cave that refuses to arrive. The try/catch covers the one case `.then` cannot:
      // a synchronous throw (a lost GL context), which would otherwise fire on every frame forever.
      try {
        warm(f.job!.object()).then(() => { f.warmState = 2; }, () => { f.warmState = 2; });
      } catch {
        f.warmState = 2;
      }
      const ms = performance.now() - t0;
      if (ms > perf.maxWarmMs) perf.maxWarmMs = ms;
    }
    // A `.then` callback can never have run by the time control returns here (promise callbacks are
    // always a task later), so the completion test is the early guard above, on the NEXT frame.
    f.warmFrames++;
    if (f.warmFrames > perf.maxWarmFrames) perf.maxWarmFrames = f.warmFrames;
    if (f.warmFrames >= Tuning.CAVE_WARM_MAX_FRAMES) {   // fail-safe — never wedge on a compile
      f.warmState = 2;
      perf.warmTimeouts++;
      return true;
    }
    return false;
  };

  const update = (playerPos: { x: number; y: number; z: number }): void => {
    pollSites(playerPos);

    if (!inflight && queue.length) {
      const next = queue.shift()!;
      inflight = { ...next, entrance: null, torJob: null, job: null, warmState: 0, warmFrames: 0 };
      // A body-only request (the legacy probe hook) already has its junction; a SITE request has to
      // build the crevice first, because the crevice IS what produces the junction the cave hangs
      // off. Either way the tor gets its own frame — never stacked onto a slice step.
      if (!inflight.site) {
        inflight.job = startSpawnCave(scene, world, terrain, inflight.junction!, inflight.seed, 'canonical');
      }
      return;
    }
    if (inflight) {
      if (!inflight.job) {
        if (!inflight.entrance) { doTor(inflight); return; }   // ← its own frame
        inflight.job = startSpawnCave(
          scene, world, terrain, inflight.entrance.junction, inflight.seed,
          inflight.site!.kind ?? 'canonical',   // DEEPER cycle 9 — the kind rolled by the descriptor
        );
        return;
      }
      const stageBefore = inflight.job.stage();
      // The cave's material set is complete and still off-scene: precompile it before the step that
      // makes it visible (see `doWarm`). Waiting here costs frames the build already spends anyway.
      if (stageBefore === 'finalize' && !doWarm(inflight)) return;
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
        // ── THE ATOMIC FINALIZE. The interior's mesh + collider are already live (caveGen's own
        //    finalize stage); the LAST thing to happen is the hole, in the same frame. Ordered this
        //    way on purpose: the sheet opens only once there is a cave under it to catch you.
        const tf = performance.now();
        let holeKey: string | null = null;
        if (inflight.site) {
          holeKey = inflight.key;
          // Round 7 tried a seed-bent slot-hugging RASTER here and the streamed march went RED on
          // both seeds — a roof lip at head height where the rastered row transitions meet the
          // ROOF_UNDER safety clamp (fwdClear@1.7m = 0.5m, mid-descent). The arithmetic in the
          // caveEntranceHoleBlocks doc records why the hole cannot shrink; the carve stays the RECT.
          terrain.addCaveHole(holeKey, caveEntranceHoleBlocks({ x: inflight.site.x, z: inflight.site.z }));
        }
        addResident(
          inflight.key, inflight.seed, inflight.job.result(), false,
          inflight.entrance, holeKey, inflight.site ? { x: inflight.site.x, z: inflight.site.z } : null,
        );
        const fms = performance.now() - tf;
        if (fms > perf.maxFinalizeMs) perf.maxFinalizeMs = fms;
        perf.builds++;
        inflight = null;
      }
    }
    releaseOutOfRange(playerPos);
    enforceCap(playerPos);
  };

  return {
    request: (key, junction, seed) => {
      if (!has(key)) queue.push({ key, seed, junction, site: null });
      return key;
    },
    requestSite: (site) => {
      if (has(site.key)) return false;
      if (!terrain.isTileLoadedAt(site.x, site.z)) return false;
      queue.push({ key: site.key, seed: site.seed, site, junction: null });
      perf.requests++;
      return true;
    },
    setSiteSource: (src) => { siteSource = src; pollCountdown = 0; },
    adopt: (key, _junction, seed, cave, pinned) => addResident(key, seed, cave, pinned),
    addResidentSink: (sink) => {
      sinks.push(sink);
      for (const r of list) sink.attach(r.cave, r);   // catch up the caves that were resident already
    },
    update,
    residents: () => list.slice(),
    occupied,
    pending: () => (inflight
      ? { key: inflight.key, stage: inflight.job ? inflight.job.stage() : (inflight.entrance ? 'tor:done' : 'tor') }
      : null),
    queued: () => queue.length,
    perf: () => ({ ...perf }),
    resetPerf: () => {
      perf.steps = 0; perf.builds = 0; perf.maxSliceMs = 0; perf.maxAtomicMs = 0;
      perf.worstAtomicStage = '-'; perf.maxStepMs = 0;
      perf.evictions = 0; perf.evictionsRefused = 0; perf.occupiedEvictionsBlocked = 0;
      perf.releases = 0; perf.requests = 0; perf.maxTorMs = 0;
      perf.maxFinalizeMs = 0; perf.maxTeardownMs = 0;
      perf.warms = 0; perf.maxWarmMs = 0; perf.maxWarmFrames = 0; perf.warmTimeouts = 0;
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
