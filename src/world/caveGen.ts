// UNDERWORLD cycle 2 (2026-07-19) — the CAVE-GEN CORE: a deterministic room-graph +
// corridor branching-tree cave (greybox trimesh), hung off cycle 1's entrance bore/throat,
// living UNDER the intact terrain sheet (D307 under-sheet coexistence — the cave has its own
// floors/walls; it never touches the neighbouring tiles' heightfield colliders). Behind
// FEATURES.caveTest (default OFF → the surface world is byte-identical).
//
// WHY A NEW FILE (not grown into caveTest.ts): caveTest.ts owns the ENTRANCE weld — the
// terrain heightfield→trimesh hole swap (its `caveTestHoleBlock` is imported by terrain.ts)
// + the ramp/trench/throat box geometry that welds to the carved terrain lip. That is stable
// cycle-1 enabling tech. This module is a distinct concern: the seed-pure ROOM GRAPH, corridor
// routing, and the displaced-ring mesh lofting of the cave BODY. caveTest hands us a JUNCTION
// (the throat's open far end); we grow the tree from there.
//
// THE ALGORITHM (room-graph + corridor carving, per docs/research/cave-feasibility.md — a
// BRANCHING TREE, no maze loops, for backtrack-able dark-nav):
//   1. Node 0 = the entrance hall, planted at the throat junction (floor = junction floor).
//   2. A descending TRUNK of CAVE_GEN_TRUNK_STEPS chambers walks forward+down from node 0; the
//      LAST trunk node is the EGG chamber (the deepest + largest — tagged in userData for
//      cycle 4+). Each trunk corridor's horizontal run is SIZED from its vertical drop so the
//      floor slope is ≤ CAVE_GEN_MAX_SLOPE by construction (the slope gate can't fail).
//   3. Side POCKETS branch off non-egg nodes (sideways, shallow) until the chamber count lands
//      in [MIN, MAX]. Overlap-rejected so chambers stay separated (only corridors connect them),
//      and never allowed deeper than the egg (egg stays strictly deepest).
//   4. Every chamber's ceiling is clamped ≥ CAVE_GEN_MIN_COVER below the real terrain height
//      (no poke-through). The tree (V nodes, V-1 edges) is guaranteed acyclic by construction.
//
// THE MESH (greybox but REAL — reads "cave", not "corridor level"): each chamber is a displaced
// ellipsoid SHELL (irregular rock walls + a domed ceiling) with a FLAT walkable floor (the lower
// cap is clamped to the floor plane); each corridor is a displaced D-section TUBE (flat tilted
// floor + arched ceiling). Portal APERTURES are cut in each chamber shell facing its corridors,
// and the corridor end rings overlap INTO the chambers so there's no gap + no see-through (rule
// 7 — the player is always inside a closed cavity; shells render BackSide = the interior face of
// solid rock). One TRIMESH collider is baked from the exact visual triangles (rule 9).
//
// DETERMINISM (D290): the generator draws ONLY from its own hashed RNG (caveGenSeed) + a private
// simplex stream — never the shared procgen rand — so the seeded surface world is untouched and
// same-seed → identical layout (a graph+vertex digest proves it in the cave-walk gate).

import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { createNoise3D } from 'simplex-noise';
import type { Terrain } from './terrain.ts';
import { makeStaticTrimesh } from '../physics/bodies.ts';
import { makeRng } from '../core/rng.ts';
import { Tuning } from '../config/tuning.ts';
import { startCaveSdf, buildCaveSdf, caveVertexColor, type CaveSdfJob } from './caveSdf.ts';
import { buildCavePools, placeCavePools, eggDaisRadius, setCavePoolEmitters, lastFloorSamplerMs, type CavePool, type CavePoolSpec } from './cavePools.ts';
// DEEPER cycle 9 — CAVE KINDS. One table of parameter overrides over this ONE generator; see
// caveKinds.ts for the table, the safety floors it machine-checks, and why `canonical` is empty.
import { caveKindParams, type CaveKind, type CaveKindParams } from './caveKinds.ts';

/** One station on the crevice's descent centreline (DEEPER cycle 4). The entrance hands the WHOLE
 *  polyline to the cave's SDF so the descent is built as part of the cave's own watertight
 *  surface — not welded onto it. */
export interface CreviceStation {
  x: number; z: number;
  floorY: number;
  halfW: number;      // clear half-width of the TOR's fissure here (the SDF slot is wider)
  height: number;     // clear height of the roofed slot here
}

/** The hand-off from the crevice entrance: the bottom of the descent slot, where the cave body
 *  begins, plus the slot polyline that got you there. */
export interface CaveJunction {
  x: number; y: number; z: number;   // slot-bottom floor point (cave node 0 sits just past it)
  gy: number;                        // surface height at the mouth (depth reference)
  width: number;                     // slot clear width at the hand-off
  heading: { x: number; z: number }; // unit XZ heading into the cave
  slot?: CreviceStation[];           // mouth → junction, world space
  slotMargin?: number;               // m the SDF slot is wider/taller than the tor's fissure
}

export type CaveNodeKind = 'entrance' | 'pocket' | 'hall' | 'egg';

export interface CaveNode {
  id: number;
  x: number; z: number;   // horizontal centre
  floorY: number;         // flat floor plane world Y
  rx: number; rz: number; // horizontal ellipsoid radii
  height: number;         // interior clear height (ceiling = floorY + height)
  kind: CaveNodeKind;
  parent: number;         // parent node id (-1 for the entrance)
  hx: number; hz: number; // the incoming heading (for sideways-branch placement)
}

export interface CaveEdge {
  a: number; b: number;   // node ids (a = parent, b = child)
  halfW: number;          // corridor half-width (clear)
  height: number;         // corridor clear height
  squeeze: boolean;
}

export interface CaveGraph {
  nodes: CaveNode[];
  edges: CaveEdge[];
  eggId: number;
  tour: number[];         // Euler tour of node ids from the root (each edge down+up) — the march route
  depthBelowSurface: number;  // gy - egg.floorY
}

/** Pure hash of the world seed → the cave generator's private RNG seed. Never consumes the
 *  shared procgen stream (D208), so the surface world stays byte-identical. */
export function caveGenSeed(worldSeed: number): number {
  let h = (worldSeed ^ 0xe6600a7e) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39) >>> 0;
  h ^= h >>> 15;
  return h >>> 0;
}

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

// ── The room-graph generator ────────────────────────────────────────────────

export function generateCaveGraph(
  seed: number,
  junction: CaveJunction,
  terrain: Terrain,
  /** DEEPER cycle 9 — the KIND's parameter set. Defaults to the canonical one (every field a literal
   *  `Tuning` read), so an un-kinded call — the origin/egg cave, `cavePoolLayout`, every existing
   *  gate — produces the byte-identical cave it always did. */
  p: CaveKindParams = caveKindParams('canonical'),
): CaveGraph {
  const T = Tuning;
  const rand = makeRng(seed);
  const nodes: CaveNode[] = [];
  const edges: CaveEdge[] = [];

  // Deepen a node so its ceiling keeps ≥ MIN_COVER of rock below the terrain sheet (never raises
  // it — the cave only goes deeper). `floorGuard` keeps non-egg nodes above the egg's floor.
  const clampCover = (n: CaveNode, floorGuard: number | null): void => {
    // MIN terrain over the chamber footprint (centre + a ring at rx) — a nearby dune valley must
    // not clip the ceiling even if the centre sits under high ground.
    let terrH = terrain.pureHeightAt(n.x, n.z);
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      terrH = Math.min(terrH, terrain.pureHeightAt(n.x + Math.cos(a) * n.rx, n.z + Math.sin(a) * n.rx));
    }
    const coverFloor = terrH - T.CAVE_GEN_MIN_COVER - n.height - T.CAVE_GEN_DISP_AMP;
    if (n.floorY > coverFloor) n.floorY = coverFloor;             // deepen for cover
    if (floorGuard !== null && n.floorY < floorGuard) n.floorY = floorGuard;  // but stay above the egg
  };

  // Node 0 — the entrance hall, planted at the throat junction (floor continuous with the throat).
  const h0x = junction.heading.x, h0z = junction.heading.z;
  const n0: CaveNode = {
    id: 0,
    x: junction.x + h0x * T.CAVE_GEN_ENTRANCE_OFFSET,
    z: junction.z + h0z * T.CAVE_GEN_ENTRANCE_OFFSET,
    floorY: junction.y,
    rx: T.CAVE_GEN_ENTRANCE_RX, rz: T.CAVE_GEN_ENTRANCE_RX * 0.92,
    height: T.CAVE_GEN_ENTRANCE_H,
    kind: 'entrance', parent: -1, hx: h0x, hz: h0z,
  };
  nodes.push(n0);

  // Counts + the egg's target depth.
  const trunkSteps = p.trunkStepsMin
    + Math.floor(rand() * (p.trunkStepsMax - p.trunkStepsMin + 1));
  const totalChambers = p.chambersMin
    + Math.floor(rand() * (p.chambersMax - p.chambersMin + 1));
  const eggDepth = lerp(p.depthMin, p.depthMax, rand());
  const entranceDepth = junction.gy - junction.y;             // ~12m
  const trunkDescent = Math.max(6, eggDepth - entranceDepth);
  const perDrop = trunkDescent / trunkSteps;
  const slopeTarget = ((p.maxSlope - 2) * Math.PI) / 180;
  const tanSlope = Math.tan(slopeTarget);
  const hallIndex = trunkSteps - 1;                          // the big gallery sits just before the egg
  // Centre-to-centre run for a corridor. The floor ramps ONLY over the CLEAR span between the two
  // chamber shells (the tube floor stays flat = the chamber floor across each chamber's flat-floor
  // disk — buildCorridorGeometry — so the corridor never steps off the disk into a cliff). So size
  // the run for the CLEAR span (centreDist − raRx − rbRx ≥ drop/tan(target)); the chamber radii add
  // on top. Jitter only lengthens (flatter, never steeper).
  const runFor = (raRx: number, rbRx: number, drop: number): number => {
    const clearSpan = Math.max(p.corridorRunMin, drop / tanSlope) * (1 + rand() * 0.25);
    return raRx + rbRx + clearSpan;
  };

  // Trunk — descend forward, bending gently, each node deeper than the last (egg = last).
  let prev = n0;
  let hx = h0x, hz = h0z;
  const eggFloorY = junction.y - trunkDescent;               // the egg's floor (deepest)
  for (let s = 1; s <= trunkSteps; s++) {
    const ang = (rand() - 0.5) * ((40 * Math.PI) / 180);     // gentle bend keeps it forward (no loops)
    const c = Math.cos(ang), sn = Math.sin(ang);
    const nhx = hx * c - hz * sn, nhz = hx * sn + hz * c;
    hx = nhx; hz = nhz;
    const isEgg = s === trunkSteps;
    const isHall = s === hallIndex && !isEgg;
    const drop = isEgg ? (prev.floorY - eggFloorY) : perDrop * (0.85 + rand() * 0.3);
    const rx = isEgg ? p.eggRx
      : isHall ? p.hallRx
        : lerp(p.pocketRxMax - 0.4, p.pocketRxMax + 1.2, rand());
    const height = isEgg ? p.eggH
      : isHall ? p.hallH
        : lerp(p.pocketHMin + 0.6, p.pocketHMax, rand());
    const run = runFor(prev.rx, rx, drop);
    const node: CaveNode = {
      id: nodes.length,
      x: prev.x + hx * run, z: prev.z + hz * run,
      floorY: prev.floorY - drop,
      rx, rz: rx * (0.86 + rand() * 0.2),
      height,
      kind: isEgg ? 'egg' : isHall ? 'hall' : 'pocket',
      parent: prev.id, hx, hz,
    };
    if (!isEgg) clampCover(node, eggFloorY + 3);
    else clampCover(node, null);
    nodes.push(node);
    edges.push(makeEdge(prev, node, rand, p));
    prev = node;
  }

  // Force the trunk to have BOTH a wide gallery (the entry corridor) and a squeeze (right after)
  // so the player meets varied cross-sections early — the rest stay as rolled. This survives every
  // kind on purpose: a warren at squeezeChance 0.88 would otherwise be able to emit an all-squeeze
  // tree, and the march's "corridors lack varied cross-sections" assert exists to catch exactly that.
  if (edges.length >= 1) { edges[0].squeeze = false; edges[0].halfW = p.galleryHalfW; edges[0].height = p.galleryH; }
  if (edges.length >= 2) { edges[1].squeeze = true; edges[1].halfW = p.squeezeHalfW; edges[1].height = p.squeezeH; }

  const eggId = nodes.length - 1;

  // Side pockets — branch sideways off non-egg nodes until the count lands in range.
  let attempts = 0;
  while (nodes.length < totalChambers && attempts < p.pocketAttempts) {
    attempts++;
    // Branch off deeper chambers only (never the shallow entrance) so pockets inherit real cover —
    // a branch off the ~12m-deep entrance can poke through a nearby dune valley.
    const candidates = nodes.filter((n) => n.kind !== 'egg' && n.kind !== 'entrance');
    const parent = candidates[Math.floor(rand() * candidates.length)];
    const side = rand() < 0.5 ? 1 : -1;
    const ang = side * ((60 + rand() * 50) * Math.PI) / 180;   // roughly perpendicular to the trunk
    const c = Math.cos(ang), sn = Math.sin(ang);
    const bhx = parent.hx * c - parent.hz * sn, bhz = parent.hx * sn + parent.hz * c;
    const drop = rand() * p.branchDropMax;
    const rx = lerp(p.pocketRxMin, p.pocketRxMax, rand());
    const height = lerp(p.pocketHMin, p.pocketHMax, rand());
    const run = runFor(parent.rx, rx, drop);
    const node: CaveNode = {
      id: nodes.length,
      x: parent.x + bhx * run, z: parent.z + bhz * run,
      floorY: parent.floorY - drop,
      rx, rz: rx * (0.86 + rand() * 0.2),
      height,
      kind: 'pocket', parent: parent.id, hx: bhx, hz: bhz,
    };
    clampCover(node, eggFloorY + 3);                          // never deeper than the egg
    if (tooClose(node, nodes, parent.id)) continue;              // reject chamber overlap
    if (corridorCrowds(parent, node, nodes, edges, p)) continue; // reject crossing/crowding corridors
    nodes.push(node);
    edges.push(makeEdge(parent, node, rand, p));
  }

  // Corridor-span cover pass — a corridor can dip under a dune valley BETWEEN two well-covered
  // chambers. Sample the terrain min along each corridor and deepen the SHALLOWER endpoint until
  // its ceiling clears (never the entrance — its floor is welded to the throat — nor below the
  // egg). Deepening the shallow end only FLATTENS that corridor (slope-safe); a couple of passes
  // let it propagate. The egg is re-confirmed deepest afterward.
  for (let iter = 0; iter < 3; iter++) {
    for (const e of edges) {
      const a = nodes[e.a], b = nodes[e.b];
      const D = Math.hypot(b.x - a.x, b.z - a.z);
      const steps = Math.max(4, Math.ceil(D / 3));
      let minTerr = Infinity;
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        minTerr = Math.min(minTerr, terrain.pureHeightAt(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t));
      }
      const shallow = a.floorY >= b.floorY ? a : b;
      if (shallow.kind === 'entrance') continue;                // never move the welded entrance
      const need = minTerr - T.CAVE_GEN_MIN_COVER - shallow.height - T.CAVE_GEN_DISP_AMP;
      if (shallow.floorY > need) shallow.floorY = Math.max(need, eggFloorY + 2);   // deepen, stay above egg
    }
  }

  // SLOPE GUARANTEE re-asserted against the FINAL floors. `runFor` sized every corridor from its
  // PROVISIONAL drop, but clampCover + the corridor-span cover pass move chambers vertically AFTER
  // sizing (a deepened child steepens the corridor above it — suspects a/c). For any corridor now
  // steeper than the target, push the child AND ITS WHOLE SUBTREE outward along the corridor heading
  // until the run again fits the FINAL drop at ≤ the slope target. Rigid subtree translation leaves
  // every downstream corridor's slope + relative shape untouched; it fires only where deepening
  // actually over-steepened a run (within-target seeds keep their exact layout). Node ids are
  // creation order and a parent is always created before its child, so id-ascending is topological.
  const childIdsOf = (id: number): number[] => nodes.filter((n) => n.parent === id).map((n) => n.id);
  const translateSubtree = (rootId: number, dx: number, dz: number): void => {
    const stack = [rootId];
    while (stack.length) {
      const id = stack.pop()!;
      nodes[id].x += dx; nodes[id].z += dz;
      for (const c of childIdsOf(id)) stack.push(c);
    }
  };
  for (let s = 1; s < nodes.length; s++) {
    const n = nodes[s], p = nodes[n.parent];
    const drop = Math.abs(p.floorY - n.floorY);
    const centerDist = Math.hypot(n.x - p.x, n.z - p.z);
    const need = p.rx + n.rx + drop / tanSlope;   // clear span (shell-to-shell) fits the drop at target
    if (centerDist < need - 1e-3) {
      const extra = need - centerDist, u = 1 / (centerDist || 1);
      translateSubtree(n.id, (n.x - p.x) * u * extra, (n.z - p.z) * u * extra);
    }
  }

  // FAIL-LOUD tripwire (dev only) — the generator must NEVER emit an untraversable cave (the cave
  // holds the mandatory egg). Validate the FINAL geometry: every corridor's centre-to-centre floor
  // slope ≤ the ceiling (+ a small displacement margin), clear height ≥ the 2.0m headroom minimum,
  // and sibling corridors diverging (no crossing mouths). Throws in dev so a bad seed is caught at
  // the source; production (guarantee already enforced above) degrades to the built geometry.
  if (import.meta.env?.DEV) assertCaveTraversable(nodes, edges, p);

  // Euler tour of the tree from the root (each edge down then up) — the DFS march route with
  // backtracking through junctions. Children sorted by id for determinism.
  const children = new Map<number, number[]>();
  for (const e of edges) {
    if (!children.has(e.a)) children.set(e.a, []);
    children.get(e.a)!.push(e.b);
  }
  for (const arr of children.values()) arr.sort((p, q) => p - q);
  const tour: number[] = [];
  const dfs = (u: number): void => {
    tour.push(u);
    for (const ch of children.get(u) ?? []) { dfs(ch); tour.push(u); }
  };
  dfs(0);

  return { nodes, edges, eggId, tour, depthBelowSurface: junction.gy - nodes[eggId].floorY };
}

/** Dev-only guarantee tripwire: throws if the FINAL cave geometry is untraversable — a corridor floor
 *  steeper than the ceiling (centre-to-centre, matching how the mesh + probe measure the ramp), a
 *  corridor clear height below the 2.0m headroom minimum, or two sibling corridors whose mouths cross
 *  (< MIN_SIBLING_ANGLE apart). A generator that can silently emit a broken mandatory objective is a
 *  bug; this makes it fail at the source instead. */
function assertCaveTraversable(nodes: CaveNode[], edges: CaveEdge[], p: CaveKindParams): void {
  const T = Tuning;
  const slopeCeil = p.maxSlope + 4;             // ° — +margin for local floor displacement
  for (const e of edges) {
    const a = nodes[e.a], b = nodes[e.b];
    const cd = Math.hypot(b.x - a.x, b.z - a.z);
    const rampSpan = Math.max(0.5, cd - a.rx - b.rx);   // the floor ramps only over the CLEAR span
    const slopeDeg = (Math.atan2(Math.abs(a.floorY - b.floorY), rampSpan) * 180) / Math.PI;
    if (slopeDeg > slopeCeil)
      throw new Error(`caveGen: corridor ${e.a}-${e.b} floor slope ${slopeDeg.toFixed(1)}° > ${slopeCeil}° — untraversable`);
    if (e.height < 2.0)
      throw new Error(`caveGen: corridor ${e.a}-${e.b} clear height ${e.height}m < 2.0m headroom`);
  }
  const minCos = Math.cos((T.CAVE_GEN_MIN_SIBLING_ANGLE * Math.PI) / 180);
  for (const p of nodes) {
    const kids = edges.filter((e) => e.a === p.id).map((e) => nodes[e.b]);
    for (let i = 0; i < kids.length; i++) {
      for (let j = i + 1; j < kids.length; j++) {
        const A = kids[i], B = kids[j];
        const la = Math.hypot(A.x - p.x, A.z - p.z) || 1, lb = Math.hypot(B.x - p.x, B.z - p.z) || 1;
        const dot = ((A.x - p.x) * (B.x - p.x) + (A.z - p.z) * (B.z - p.z)) / (la * lb);
        if (dot > minCos)
          throw new Error(`caveGen: corridors ${p.id}-${A.id} & ${p.id}-${B.id} diverge < ${T.CAVE_GEN_MIN_SIBLING_ANGLE}° — crossing mouths`);
      }
    }
  }
}

function makeEdge(a: CaveNode, b: CaveNode, rand: () => number, p: CaveKindParams): CaveEdge {
  const squeeze = rand() < p.squeezeChance;
  return {
    a: a.id, b: b.id,
    halfW: squeeze ? p.squeezeHalfW : p.galleryHalfW,
    height: squeeze ? p.squeezeH : p.galleryH,
    squeeze,
  };
}

/** Reject a candidate chamber that overlaps an existing one (except its own parent, which is
 *  spaced by a corridor). Horizontal + vertical separation both required to count as clear. */
function tooClose(node: CaveNode, nodes: CaveNode[], parentId: number): boolean {
  for (const m of nodes) {
    if (m.id === parentId) continue;
    const dx = node.x - m.x, dz = node.z - m.z;
    const horiz = Math.hypot(dx, dz);
    const dy = Math.abs(node.floorY - m.floorY);
    if (horiz < (node.rx + m.rx) * 0.9 && dy < (node.height + m.height) * 0.6) return true;
  }
  return false;
}

/** Reject a side-pocket candidate whose CORRIDOR would cross or crowd existing geometry — the cause
 *  chamber-overlap (`tooClose`) misses. Two failures: (1) two corridors leaving the SAME parent that
 *  diverge by < MIN_SIBLING_ANGLE overlap their flared mouths into a crossing floor/ceiling (the
 *  seed-42 wedge — two pockets ~30° apart off one hub, corridors crossing → a 2m local floor step
 *  read as 59.6° + a blocking wall + <2m headroom); (2) a corridor that passes through a chamber it
 *  doesn't connect. Both are XZ tests (a compact cave keeps heights close). */
function corridorCrowds(
  parent: CaveNode, node: CaveNode, nodes: CaveNode[], edges: CaveEdge[], p: CaveKindParams,
): boolean {
  const T = Tuning;
  const nl = Math.hypot(node.x - parent.x, node.z - parent.z) || 1;
  const nux = (node.x - parent.x) / nl, nuz = (node.z - parent.z) / nl;
  const minCos = Math.cos((T.CAVE_GEN_MIN_SIBLING_ANGLE * Math.PI) / 180);
  // (1) sibling divergence — vs every corridor already touching this parent (its children AND the
  //     incoming trunk corridor), so mouths never overlap.
  for (const e of edges) {
    const sib = e.a === parent.id ? nodes[e.b] : e.b === parent.id ? nodes[e.a] : null;
    if (!sib) continue;
    const sl = Math.hypot(sib.x - parent.x, sib.z - parent.z) || 1;
    if ((nux * (sib.x - parent.x) + nuz * (sib.z - parent.z)) / sl > minCos) return true;
  }
  // (2) the new corridor segment must clear every non-adjacent chamber (segment→centre distance).
  for (const m of nodes) {
    if (m.id === parent.id || m.id === node.id) continue;
    const along = Math.max(0, Math.min(nl, (m.x - parent.x) * nux + (m.z - parent.z) * nuz));
    const d = Math.hypot(m.x - (parent.x + nux * along), m.z - (parent.z + nuz * along));
    if (d < m.rx + p.galleryHalfW + T.CAVE_GEN_CORRIDOR_CLEARANCE) return true;
  }
  // (3) the new corridor must not cross or run alongside a NON-adjacent corridor at a similar depth
  //     (a pocket corridor crossing the trunk, or two pockets' corridors overlapping). Skip edges
  //     that share the parent (governed by (1)). Sample the new segment; reject if it comes within a
  //     combined-mouth width of another corridor AND their floors there overlap vertically.
  const nSteps = Math.max(3, Math.ceil(nl / 1.5));
  for (const e of edges) {
    if (e.a === parent.id || e.b === parent.id || e.a === node.id || e.b === node.id) continue;
    const ea = nodes[e.a], eb = nodes[e.b];
    const el = Math.hypot(eb.x - ea.x, eb.z - ea.z) || 1;
    const eux = (eb.x - ea.x) / el, euz = (eb.z - ea.z) / el;
    const wSum = p.galleryHalfW + e.halfW + T.CAVE_GEN_CORRIDOR_CLEARANCE;
    for (let s = 0; s <= nSteps; s++) {
      const tt = s / nSteps;
      const px = parent.x + (node.x - parent.x) * tt, pz = parent.z + (node.z - parent.z) * tt;
      const pf = parent.floorY + (node.floorY - parent.floorY) * tt;
      const al = Math.max(0, Math.min(el, (px - ea.x) * eux + (pz - ea.z) * euz));
      const qf = ea.floorY + (eb.floorY - ea.floorY) * (al / el);
      if (Math.hypot(px - (ea.x + eux * al), pz - (ea.z + euz * al)) < wSum
        && Math.abs(pf - qf) < (node.height + e.height) * 0.55) return true;
    }
  }
  return false;
}

// ── Dressing (speleothems, the egg dais, fungi) ──────────────────────────────
//
// DEEPER cycle 2 deleted the SHELL MESHING KIT that used to live here — `rockDisp`,
// `buildChamberGeometry`, `buildCorridorGeometry`, the `Carve` interface + the per-node carve map,
// and the `_caveShell` BackSide material. The cave BODY is now one watertight surface-nets mesh
// (`caveSdf.ts`), and its displacement lives inside the SDF. The palette (`caveVertexColor`) moved
// to caveSdf.ts as the single copy; the dressing below imports it.

type Noise3 = (x: number, y: number, z: number) => number;

const _tmpCol = new THREE.Color();

/** A raised natural rock PEDESTAL (dais) at the egg-chamber centre — a wide, gently-sloped mound
 *  (sides ≤ the walk grade so the KCC climbs it; top ≤ the floor-grid tolerance so it isn't read as
 *  a hole). Where the egg will sit next cycle. WORLD space; baked into the trimesh (collider=visual). */
function buildDais(node: CaveNode, cnoise: Noise3, depthT: number): THREE.BufferGeometry {
  // Shared with cavePools.ts so a water pool can never be placed on top of the pedestal.
  const baseR = eggDaisRadius(node.rx);
  const topR = baseR * 0.42;
  const H = 0.9;                           // slope = H/(baseR−topR) ≈ 0.48 → ~26° (KCC-walkable, gentle)
  const RINGS = 5, SEGS = 20;
  const stride = SEGS + 1;
  const pos = new Float32Array((RINGS + 1) * stride * 3);
  const col = new Float32Array((RINGS + 1) * stride * 3);
  let vi = 0;
  for (let i = 0; i <= RINGS; i++) {
    const t = i / RINGS;                   // 0 rim → 1 top
    const rr = lerp(baseR, topR, t);
    const yy = node.floorY + H * t;
    for (let j = 0; j <= SEGS; j++) {
      const ph = (j / SEGS) * Math.PI * 2;
      const wob = 1 + cnoise(Math.cos(ph) * 2 + i, 5.5, Math.sin(ph) * 2) * 0.10;
      const wx = node.x + Math.cos(ph) * rr * wob;
      const wz = node.z + Math.sin(ph) * rr * wob;
      const wy = yy + (i > 0 && i < RINGS ? cnoise(wx * 0.4, 2.2, wz * 0.4) * 0.06 : 0);
      pos[vi * 3] = wx; pos[vi * 3 + 1] = wy; pos[vi * 3 + 2] = wz;
      caveVertexColor(i === RINGS ? 'floor' : 'wall', wx, wy, wz, depthT, cnoise, _tmpCol);
      col[vi * 3] = _tmpCol.r; col[vi * 3 + 1] = _tmpCol.g; col[vi * 3 + 2] = _tmpCol.b;
      vi++;
    }
  }
  const idx: number[] = [];
  for (let i = 0; i < RINGS; i++) {
    for (let j = 0; j < SEGS; j++) {
      const p0 = i * stride + j, p1 = p0 + 1, p2 = (i + 1) * stride + j, p3 = p2 + 1;
      idx.push(p0, p2, p1, p1, p2, p3);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

/** THE SPELEOTHEM CLEARANCE CONTRACT, as one number. A speleothem's surface never sits further than
 *  `r0 · SPELEO_MAX_RADIUS_FACTOR + SPELEO_RADIUS_EPS` from its (bent) axis, at ANY height — this is
 *  what `addSpeleothems`'s placement margins are sized against, and floor stalagmites + columns are
 *  collider-bearing, so it is a KCC clearance contract and not a cosmetic one. 1.22 is the maximum
 *  the ORIGINAL linear-taper + flute profile could reach at its base; every profile since has been
 *  clamped to it so the walkable envelope of a chamber never moves when the silhouette is restyled.
 *  Enforced by `assertSpeleothemEnvelope` below — change the profile freely, but a change that makes
 *  a speleothem exceed this cannot ship silently. */
export const SPELEO_MAX_RADIUS_FACTOR = 1.22;
const SPELEO_RADIUS_EPS = 0.02;               // the flat additive term that keeps a tip from degenerating
/** CLOSE-OUT ROUND 2 — the tip-radius floor a kind buys with `speleoSolidity = 1` (× r0). 0.02m of
 *  epsilon is not "thickness": on a 30cm-base nubbin it is a 4cm-wide blade, and at arm's length that
 *  is a paper shaving. At 0.22 the same nubbin ends in a ~9cm knob and still tapers by 78%. Well under
 *  SPELEO_MAX_RADIUS_FACTOR, so the clearance envelope (and therefore every placement margin) is
 *  untouched — the widest point of a speleothem is still its base. */
const SPELEO_TIP_FLOOR = 0.22;

/** Fail-loud dev assert for the contract above, measured on the EMITTED vertices rather than on the
 *  formula — the point is to survive a future edit that adds a term the clamp does not cover (a
 *  post-multiply, a second noise octave applied after the min, a widened eps). Dev-only: this is a
 *  generator invariant, and the cave is generated hundreds of times per session in a probe run.
 *  Precedent: the UNDERWORLD dev assert that stops an untraversable cave from shipping silently. */
function assertSpeleothemEnvelope(maxRR: number, r0: number): void {
  if (!import.meta.env.DEV) return;
  const bound = r0 * SPELEO_MAX_RADIUS_FACTOR + SPELEO_RADIUS_EPS;
  if (maxRR > bound + 1e-6) {
    throw new Error(
      `[caveGen] SPELEOTHEM CLEARANCE CONTRACT VIOLATED: profile reaches r=${maxRR.toFixed(4)} about its axis, ` +
      `bound is r0(${r0.toFixed(4)})·${SPELEO_MAX_RADIUS_FACTOR}+${SPELEO_RADIUS_EPS}=${bound.toFixed(4)}. ` +
      `Floor speleothems are COLLIDER-BEARING (baked into the chamber trimesh), so a fatter profile ` +
      `narrows real KCC clearance that addSpeleothems' placement margins were sized against. Either ` +
      `re-clamp the profile to SPELEO_MAX_RADIUS_FACTOR, or raise the factor AND widen floorOk's margin ` +
      `in the same change — and re-run \`npm run rig -- --scenario=cave-walk\` on several seeds.`,
    );
  }
}

/** A single speleothem cone (stalactite hanging DOWN from `apexY` a length `len`, or stalagmite/
 *  column rising UP from the floor). `up` = +1 rises from base, −1 hangs from apex. Slightly bent +
 *  fluted (noise per ring) so it reads as dripstone, not a party hat. Solid (rule 7). WORLD space. */
function buildSpeleothem(
  x: number, z: number, baseY: number, topY: number, r0: number,
  cnoise: Noise3, depthT: number, hangDown: boolean, bendScale: number,
  /** DEEPER cycle-9 CLOSE-OUT ROUND 2 — `CaveKindParams.speleoSolidity`. Read that doc first: it is
   *  0 for canonical BY CONTRACT (this function bakes WORLD-space vertices, so it is the one piece
   *  of dressing whose position `caveDigest` hashes), and every use of it below is an exact identity
   *  at 0. Here it raises a FLOOR under the tip radius so the profile ends in a blunt dripstone knob
   *  instead of the 2cm-epsilon blade that read as a paper sliver at arm's length. */
  solidity = 0,
): THREE.BufferGeometry {
  // DEEPER cycle 7 — DRIPSTONE, NOT TRAFFIC CONES. The shipped profile was a LINEAR taper
  // (r0·(1−t)) with a ±22% angular flute at 8 segments, which is geometrically a smooth cone: the
  // audit's read was "orange traffic cones". Real speleothems are grown by accretion, so they are
  // fat-based with a long thin tip (a POWER taper), they neck and bulge along their length, and they
  // carry vertical flutes/ribs from the drip channels. Three changes: the power profile, an
  // along-axis bulge octave, and a stronger, WORLD-ANCHORED angular flute (the old flute sampled
  // (cos φ, i, sin φ) with no world term, so every speleothem in the cave had the SAME flute pattern).
  // Resolution goes 6×8 → 8×12 rings×segments (104 → 204 tris each) because a 12% flute is invisible
  // at 8 segments.
  //
  // THE ENVELOPE IS PRESERVED ON PURPOSE. `shape` is clamped to SPELEO_MAX_RADIUS_FACTOR — the same
  // 1.22 maximum the shipped flute could reach — so the widest point of a speleothem is exactly as
  // wide as before, which is what the placement code's clearance margins (floorOk: baseR + 0.2 off
  // the walk grid) were sized against. Rule 9 is satisfied by construction: floor stalagmites +
  // columns are pushed into `meshes`, and the chamber collider is baked from those same meshes, so
  // the collision follows the new silhouette in the same change.
  //
  // ⚠ READ THIS BEFORE BLAMING THIS FUNCTION FOR A `cave-walk` MARCH FAILURE. "Preserved envelope"
  // means preserved MAXIMUM, not preserved profile: at mid-height the power+bulge form is genuinely
  // FATTER than the old linear taper (measured at t=0.5: up to ~1.5× the old radius there). That
  // sounds like it should narrow corridors, and it does not, for a reason worth writing down — the
  // KCC capsule stands ON the floor, so what blocks it is the MAX radius over its whole vertical
  // span, and for a floor-rising speleothem that max is at the BASE under both profiles. The bulge
  // only ever fills space that was already inside the base radius's shadow. This was investigated
  // and measured on 2026-07-26 against a 3cf3d73 A/B (the cycle-7 tree and the pristine base flake
  // on seed 4242 at the SAME rate with the SAME signature); it is not a clearance regression.
  const RINGS = 8, SEGS = 12;
  const stride = SEGS + 1;
  const H = topY - baseY;                  // signed (hang: topY<baseY)
  const pos = new Float32Array((RINGS + 1) * stride * 3 + 3);
  const bendA = cnoise(x * 0.3, 9.1, z * 0.3) * 0.5 * bendScale, bendB = cnoise(x * 0.3 + 4, 9.1, z * 0.3) * 0.5 * bendScale;
  // The tip-radius floor. `Math.max(0, v) === v` exactly for the non-negative `v` this clamps (prof,
  // wob and flute are each strictly positive by construction), so canonical is bit-identical.
  const tipFloor = solidity * SPELEO_TIP_FLOOR;
  let vi = 0, maxRR = 0;
  for (let i = 0; i <= RINGS; i++) {
    const t = i / RINGS;                   // 0 base → 1 tip
    // Power taper: fat base, long thin tip (an accreted drip form), broken by a slow bulge/neck
    // octave along the axis so the silhouette has waists and shoulders instead of a straight edge.
    const prof = Math.pow(1 - t, 0.74) * (1 + cnoise(t * 4.2 + 11, x * 0.7, z * 0.7) * 0.26);
    const wob = 0.92 + cnoise(t * 6, x, z) * 0.08;
    const yy = baseY + H * t;
    const bx = x + bendA * t * t * 1.6, bz = z + bendB * t * t * 1.6;   // gentle taper-bend
    for (let j = 0; j <= SEGS; j++) {
      const ph = (j / SEGS) * Math.PI * 2;
      // World-anchored so neighbouring speleothems flute DIFFERENTLY, and deep enough to read.
      const flute = 1 + cnoise(Math.cos(ph) * 3.4 + x * 0.13, i * 1.1, Math.sin(ph) * 3.4 + z * 0.13) * 0.24;
      const shape = Math.max(tipFloor, Math.min(SPELEO_MAX_RADIUS_FACTOR, prof * wob * flute));
      const rr = r0 * shape + SPELEO_RADIUS_EPS;
      if (rr > maxRR) maxRR = rr;
      const wx = bx + Math.cos(ph) * rr;
      const wz = bz + Math.sin(ph) * rr;
      pos[vi * 3] = wx; pos[vi * 3 + 1] = yy; pos[vi * 3 + 2] = wz;
      vi++;
    }
  }
  // tip vertex
  const tipX = x + bendA * 1.6, tipZ = z + bendB * 1.6;
  pos[vi * 3] = tipX; pos[vi * 3 + 1] = topY; pos[vi * 3 + 2] = tipZ;
  const tip = vi; vi++;
  const idx: number[] = [];
  for (let i = 0; i < RINGS; i++) {
    for (let j = 0; j < SEGS; j++) {
      const p0 = i * stride + j, p1 = p0 + 1, p2 = (i + 1) * stride + j, p3 = p2 + 1;
      idx.push(p0, p2, p1, p1, p2, p3);
    }
  }
  for (let j = 0; j < SEGS; j++) { const p0 = RINGS * stride + j; idx.push(p0, tip, p0 + 1); }
  assertSpeleothemEnvelope(maxRR, r0);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  // ── CLOSE-OUT ROUND 2 (finding N1, the COLOUR half) — DRIPSTONE IS ROCK, NOT SEDIMENT. ─────────
  //    Every speleothem was coloured with a FIXED face role: 'floor' for anything rising, 'ceiling'
  //    for anything hanging. `caveVertexColor`'s floor role is dominated by `caveFloorSediment`, a
  //    3-10m-wavelength pooled-sand wash — over a 60cm nubbin that is ONE value, so the whole object
  //    came out as a flat beige card with no strata, no stain and no grain, which is exactly why the
  //    close-out frames read them as pale paper shavings (`scen-kind-flooded-pocket-c5.png`, three of
  //    them alone on a lit floor). This is the SAME defect, with the same fix, that the rubble
  //    boulders got in round 1: the wall palette (strata bands + mineral staining) with the floor/
  //    ceiling roles ramped in SMOOTHLY by the vertex's own up-ness, plus a body-local mottle at 28cm
  //    and 13cm — the cave-wide palette's finest term is 1.25m, i.e. invisible at this size.
  //
  //    `hangDown` still does real work: drip water runs DOWN a stalactite, so its flanks must never
  //    pick up floor sediment even where the flute tips a facet upward — its up-ness is clamped at 0,
  //    which leaves only the ceiling darkening ramp.
  //
  //    KIND-NEUTRAL ON PURPOSE, canonical included: `caveDigest` hashes vertex POSITIONS only, so a
  //    colour change cannot move the origin digest (d8f15005). The GEOMETRY half of this fix is the
  //    kind-gated `speleoSolidity`, for exactly the opposite reason.
  const nrm = geo.attributes.normal as THREE.BufferAttribute;
  const col = new Float32Array(pos.length);
  for (let i = 0; i < nrm.count; i++) {
    const wx = pos[i * 3], wy = pos[i * 3 + 1], wz = pos[i * 3 + 2];
    const upn = hangDown ? Math.min(0, nrm.getY(i)) : nrm.getY(i);
    caveVertexColor('wall', wx, wy, wz, depthT, cnoise, _tmpCol, upn);
    // Sampled on the position RELATIVE to this speleothem's own base (+ a world offset), so two
    // neighbouring cones mottle differently and a duplicated rim vertex can never split the shading.
    const lx = wx - x, ly = wy - baseY, lz = wz - z;
    const mot = cnoise(lx * 7.3 + x * 0.53, ly * 7.3 + 2.7, lz * 7.3 + z * 0.53) * 0.055
              + cnoise(lx * 15.1 + z * 0.29, ly * 15.1 + 8.2, lz * 15.1 + x * 0.29) * 0.028;
    col[i * 3] = Math.max(0.02, _tmpCol.r + mot);
    col[i * 3 + 1] = Math.max(0.02, _tmpCol.g + mot * 0.94);
    col[i * 3 + 2] = Math.max(0.02, _tmpCol.b + mot * 0.86);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}

/** Populate one chamber with speleothems: STALACTITES hang from the ceiling (visual-only — kept
 *  ≥CLEAR above the floor so they never eat headroom), STALAGMITES rise from the floor + COLUMNS
 *  span floor→ceiling (both collider-bearing, so a real player can't walk through them). Floor
 *  features are placed OFF the walk path: beyond the chamber floor-grid the walk gate samples, clear
 *  of corridor mouths, and spaced apart. Denser in the hall + egg, sparse in small pockets. */
function addSpeleothems(
  node: CaveNode,
  mouthDirs: Array<{ x: number; z: number }>,
  cnoise: Noise3, depthT: number, rand: () => number,
  group: THREE.Group, meshes: THREE.Mesh[], decor: THREE.Mesh[],
  /** DEEPER cycle 9 — the kind's speleothem density. EXACTLY 1 for canonical, and every count is
   *  `Math.round(n × 1)`, so the canonical cave's dripstone is bit-identical. */
  speleoDensity = 1,
  /** cycle-9 LOOK PASS — × on the COLUMN count and on stalactite LENGTH. Both default to 1 and
   *  neither adds or removes a single `rand()` draw at 1, so canonical stays bit-identical. */
  columnScale = 1,
  dropScale = 1,
  /** CLOSE-OUT ROUND 2 — `CaveKindParams.speleoSolidity`. 0 for canonical BY CONTRACT (origin
   *  digest); see the field doc. Drives the tip-radius floor inside `buildSpeleothem`, a bend
   *  reduction here, and real-rock seating for the small nubbins. */
  solidity = 0,
  /** The REAL rock height under a point (`makeRockFloorSampler`). Only consulted when `solidity > 0`
   *  — seating a canonical speleothem on the measured surface instead of the analytic plane would
   *  move its baked world vertices, i.e. the origin digest. */
  rockFloor?: RockFloor,
): void {
  const T = Tuning;
  // A leaning cone, not a wood shaving. At bendScale 0.9 the nubbin path throws a 1m cone up to 0.7m
  // sideways, and a strongly-bent thin taper photographs as a curved sliver. `1 - 0.45·0 === 1`, and
  // `bend * 1 === bend` exactly, so canonical bends are bit-identical.
  const bendMul = 1 - 0.45 * solidity;
  const rx = node.rx, floorY = node.floorY, height = node.height;
  const ry = height * 0.6, cyc = floorY + height - ry;
  const ceilAt = (fr: number): number => cyc + ry * Math.sqrt(Math.max(0, 1 - fr * fr));
  const mouthCos = Math.cos((T.CAVE_SPELEO_MOUTH_CLEAR_DEG * Math.PI) / 180);
  const clearOfMouth = (ux: number, uz: number): boolean => {
    for (const md of mouthDirs) if (ux * md.x + uz * md.z > mouthCos) return false;
    return true;
  };
  // The floor grid the walk gate samples (rings 0.72·rx·{0..1}, 8 spokes) — floor features must not
  // overlap any of these thin castDown rays (else they'd read as a floor "hole" or eat headroom).
  const grid: Array<{ x: number; z: number }> = [];
  for (let ri = 0; ri <= 4; ri++) {
    const rr = (rx * 0.72 * ri) / 4, spokes = ri === 0 ? 1 : 8;
    for (let si = 0; si < spokes; si++) { const a = (si / spokes) * Math.PI * 2; grid.push({ x: node.x + Math.cos(a) * rr, z: node.z + Math.sin(a) * rr }); }
  }
  const placed: Array<{ x: number; z: number; r: number }> = [];
  const floorOk = (x: number, z: number, baseR: number): boolean => {
    for (const gp of grid) if (Math.hypot(x - gp.x, z - gp.z) < baseR + 0.2) return false;
    for (const p of placed) if (Math.hypot(x - p.x, z - p.z) < baseR + p.r + 0.5) return false;
    return true;
  };
  const kind = node.kind;
  const dens = kind === 'egg' ? 1.0 : kind === 'hall' ? 0.85 : kind === 'entrance' ? 0.2 : 0.5;

  // ── Floor stalagmites + columns (collider-bearing). ──
  const nStalag = Math.round((kind === 'egg' ? 5 : kind === 'hall' ? 4 : kind === 'entrance' ? 0 : rx > 3.6 ? 2 : 1) * speleoDensity);
  const nColumn = Math.round((kind === 'egg' ? 2 : kind === 'hall' ? 1 : 0) * speleoDensity * columnScale);
  const placeFloor = (isColumn: boolean): void => {
    for (let a = 0; a < 26; a++) {
      const ang = rand() * Math.PI * 2;
      const ux = Math.cos(ang), uz = Math.sin(ang);
      if (!clearOfMouth(ux, uz)) continue;
      const fr = lerp(T.CAVE_SPELEO_RING_MIN, T.CAVE_SPELEO_RING_MAX, rand());
      const x = node.x + ux * rx * fr, z = node.z + uz * rx * fr;
      const baseR = isColumn
        ? Math.min(0.55 + rx * 0.05, 1.05)
        : Math.min(0.30 + rx * 0.045, 0.85) * (0.7 + rand() * 0.5);
      if (!floorOk(x, z, baseR)) continue;
      const ceilY = ceilAt(fr);
      let topY: number, bend: number;
      if (isColumn) { topY = ceilY - 0.05; bend = 0.22; }          // reach the ceiling; near-straight
      else {
        const maxUp = ceilY - 0.4 - floorY;                        // stay clear of the ceiling
        const h = Math.min(1.0 + rand() * 2.0, Math.max(0.6, maxUp));
        topY = floorY + h; bend = 0.9;
      }
      const geo = buildSpeleothem(x, z, floorY - 0.15, topY, baseR, cnoise, depthT, false, bend * bendMul, solidity);
      const m = new THREE.Mesh(geo, _caveSolid);
      m.castShadow = false; m.receiveShadow = true;
      group.add(m); meshes.push(m);                                // collider (baked into trimesh)
      placed.push({ x, z, r: baseR });
      return;
    }
  };
  for (let i = 0; i < nStalag; i++) placeFloor(false);
  for (let i = 0; i < nColumn; i++) placeFloor(true);
  // small no-collider floor nubbins for density (still off the walk grid).
  const nSmall = Math.round((kind === 'entrance' ? 1 : rx > 4 ? 4 : 2) * dens * 2 * speleoDensity);
  for (let i = 0; i < nSmall; i++) {
    for (let a = 0; a < 12; a++) {
      const ang = rand() * Math.PI * 2, ux = Math.cos(ang), uz = Math.sin(ang);
      const fr = lerp(0.55, 0.94, rand());
      const x = node.x + ux * rx * fr, z = node.z + uz * rx * fr;
      const baseR = 0.15 + rand() * 0.22;
      if (!clearOfMouth(ux, uz) || !floorOk(x, z, baseR)) continue;
      // SEAT ON THE MEASURED ROCK, not the analytic plane. The nubbins are the dressing standing
      // closest to the lens in a small room, and `floorY` disagrees with the SDF surface by up to
      // the displacement amplitude — which is a nubbin hovering, or half-swallowed, at torch range.
      // (Nubbins are DECOR: no collider, so this cannot move a walk-gate margin. The collider-bearing
      // stalagmites/columns above deliberately keep the analytic seat — see the residuals note.)
      const fy = solidity > 0 && rockFloor ? rockFloor(x, z, floorY) : floorY;
      const geo = buildSpeleothem(x, z, fy - 0.1, fy + 0.35 + rand() * 0.7, baseR, cnoise, depthT, false, 0.9 * bendMul, solidity);
      const m = new THREE.Mesh(geo, _caveSolid); m.receiveShadow = true;
      group.add(m); decor.push(m); placed.push({ x, z, r: baseR });
      break;
    }
  }

  // ── Ceiling stalactites (visual-only; tips kept ≥ CLEAR above the floor). ──
  const nTip = Math.round((kind === 'egg' ? 22 : kind === 'hall' ? 16 : kind === 'entrance' ? 4 : 9) * speleoDensity);
  for (let i = 0; i < nTip; i++) {
    const ang = rand() * Math.PI * 2, ux = Math.cos(ang), uz = Math.sin(ang);
    const fr = Math.sqrt(rand()) * 0.86;                            // bias toward the walls where drips cluster
    const x = node.x + ux * rx * fr, z = node.z + uz * rx * fr;
    const apexY = ceilAt(fr) - 0.05;
    const maxLen = apexY - (floorY + T.CAVE_SPELEO_STALACTITE_CLEAR);
    if (maxLen < 0.4) continue;
    const big = i < nTip * 0.35;
    // `dropScale` multiplies the DRAWN length, never the clamp: `maxLen` still keeps every tip
    // ≥ CAVE_SPELEO_STALACTITE_CLEAR above the floor, so no kind can hang one into head height.
    const len = Math.min((big ? 1.0 + rand() * 2.2 : 0.35 + rand() * 0.9) * dropScale, maxLen * 0.92);
    const baseR = big ? 0.28 + rand() * 0.32 : 0.12 + rand() * 0.18;
    const geo = buildSpeleothem(x, z, apexY, apexY - len, baseR, cnoise, depthT, true, 1.0 * bendMul, solidity);
    const m = new THREE.Mesh(geo, _caveSolid); m.receiveShadow = true;
    group.add(m); decor.push(m);
  }
}

// ── Rubble heaps (DEEPER cycle 9 — a GENERAL capability, canonical density 0) ─────────────────
//
// The "collapsed shaft" kind needs a floor that reads as fallen ceiling. This is built as a general
// dressing capability with a per-kind `rubblePerChamber` whose canonical value is ZERO — so the code
// path is shared by every kind (nothing branches on the kind name) and the canonical cave emits not
// one vertex of it. Same shape as the small-nubbin speleothem path it sits beside.
//
// RULE 7 (real thickness): a boulder is a displaced ICOSAHEDRON — a closed convex solid with genuine
// volume, seen from outside, FrontSide, exactly like the dripstone kit. There is no shell anywhere in
// it. The displacement is a pure function of the UNDISPLACED vertex position, so the polyhedron's
// duplicated seam vertices move identically and the solid stays watertight (which the void-ray gate
// would catch if it did not).
//
// RULE 9 (collision matches the visible geometry): boulders go into `meshes`, i.e. they are baked
// into the cave's ONE trimesh collider in the same change that adds them — a heap you can walk
// through would be worse than no heap. Placement therefore borrows the speleothem clearance
// discipline verbatim: off the chamber floor grid the march samples, out of the corridor-mouth
// sectors, and spaced from anything already placed.

// ── THE REAL-ROCK SAMPLERS (cycle-9 CLOSE-OUT) ────────────────────────────────────────────────
//
// Every float the close-out critic found had ONE root cause: the dressing was seated against the
// ANALYTIC room — `node.floorY` for the floor, the ellipsoid `rx·√(1-yn²)` for the wall — while the
// room the player actually stands in is the SDF SURFACE, and the two disagree by the displacement
// amplitude (up to CAVE_GEN_DISP_IN 0.30 + CAVE_SDF_MICRO_AMP 0.075, and more where a chamber's
// dome is clipped by a neighbour). A salvage plate seated on the plane hung a metre over the sand;
// wall shelves pulled a flat 4% inside the ellipsoid still ended up in mid-air wherever the SDF
// came in wider. Pulling harder is not a fix, it is a bigger guess.
//
// So: MEASURE THE ROCK. Both samplers read the SDF surface that has already been built and is in
// hand at the dress stage — no raycast against the scene, no BVH dependency, no collider (the
// trimesh is not baked until `finalize`), and exactly as deterministic as the mesh they read.
// This is `procgen-surface-placement.md` ("sample the REAL surface, don't assume the part's shape")
// and `cavePools.makeFloorSampler`'s idiom, generalised so the dressing can use it too.

/** Real floor height of the cave ROCK at (x, z); `fallback` when there is no data (or the answer is
 *  implausible, which is a clipped-dome corner, not a floor). */
type RockFloor = (x: number, z: number, fallback: number) => number;

/** One up-facing-vertex height grid per chamber, max-splatted at the polygonization spacing. */
function makeRockFloorSampler(geometry: THREE.BufferGeometry, rooms: CaveNode[]): RockFloor {
  const CELL = Tuning.CAVE_SDF_VOXEL;
  type Grid = { x0: number; z0: number; n: number; base: number; h: Float32Array };
  const grids: Grid[] = rooms.map((r) => {
    const reach = r.rx * 1.05 + 1.0;
    const n = Math.ceil((reach * 2) / CELL) + 2;
    return { x0: r.x - reach - CELL, z0: r.z - reach - CELL, n, base: r.floorY, h: new Float32Array(n * n).fill(-Infinity) };
  });
  const pos = geometry.getAttribute('position') as THREE.BufferAttribute;
  const nrm = geometry.getAttribute('normal') as THREE.BufferAttribute | undefined;
  const pa = pos.array as ArrayLike<number>;
  const na = nrm ? (nrm.array as ArrayLike<number>) : null;
  for (let i = 0, n3 = pos.count * 3; i < n3; i += 3) {
    // FLOOR-FACING VERTICES ONLY. The same column carries the ceiling and the walls; a wall vertex
    // max-splatted into the grid would seat a boulder halfway up the room. The surface is wound INTO
    // the cavity, so a floor normal points UP.
    if (na && na[i + 1] < 0.30) continue;
    const x = pa[i], y = pa[i + 1], z = pa[i + 2];
    for (let gi = 0; gi < grids.length; gi++) {
      const g = grids[gi];
      if (y < g.base - 1.8 || y > g.base + 1.8) continue;
      const cx = Math.floor((x - g.x0) / CELL), cz = Math.floor((z - g.z0) / CELL);
      if (cx < 0 || cz < 0 || cx >= g.n || cz >= g.n) continue;
      const o = cz * g.n + cx;
      if (y > g.h[o]) g.h[o] = y;
    }
  }
  return (x: number, z: number, fallback: number): number => {
    let best = Number.NaN, bestD = Infinity;
    for (const g of grids) {
      const fx = (x - g.x0) / CELL, fz = (z - g.z0) / CELL;
      if (fx < 0 || fz < 0 || fx >= g.n - 1 || fz >= g.n - 1) continue;
      const d = Math.abs(fx - g.n * 0.5) + Math.abs(fz - g.n * 0.5);
      if (d >= bestD) continue;
      const ix = Math.floor(fx), iz = Math.floor(fz), tx = fx - ix, tz = fz - iz;
      const o = iz * g.n + ix;
      const c00 = g.h[o], c10 = g.h[o + 1], c01 = g.h[o + g.n], c11 = g.h[o + g.n + 1];
      let v: number;
      if (c00 > -Infinity && c10 > -Infinity && c01 > -Infinity && c11 > -Infinity) {
        v = (c00 * (1 - tx) + c10 * tx) * (1 - tz) + (c01 * (1 - tx) + c11 * tx) * tz;
      } else {
        v = Math.max(c00, c10, c01, c11);
        if (!(v > -Infinity)) continue;
      }
      best = v; bestD = d;
    }
    if (Number.isNaN(best)) return fallback;
    // A max-splat over a 45cm cell biases HIGH by about the micro-relief amplitude, and a high
    // answer is the failure mode we are here to kill (it hovers), so bias back down: an object
    // seated on this beds INTO the rock rather than perching on the cell's tallest vertex.
    const y = best - Tuning.CAVE_SDF_MICRO_AMP * 0.5;
    // …and never trust an answer that is nowhere near the room we asked about (a clipped dome, a
    // corridor floor caught by the grid's corner). Same tooth as the shot helper's floor clamp.
    return Math.abs(y - fallback) > 2.5 ? fallback : y;
  };
}

/** A wall hit: distance along the cast bearing + the rock's INWARD normal at the hit. */
interface WallHit { d: number; nx: number; ny: number; nz: number; }
/** Cast from a chamber's own vertical axis OUTWARD along (ux, uz) at height y; first hit = the real
 *  wall, whatever shape the SDF gave it. `null` = nothing within `maxD` (a corridor mouth, or a
 *  height where the dome has already closed). */
type WallCast = (node: CaveNode, y: number, ux: number, uz: number, maxD: number) => WallHit | null;

function makeWallCaster(geometry: THREE.BufferGeometry, rooms: CaveNode[]): WallCast {
  // Per room, the SDF triangles that could possibly be its wall — filtered ONCE (one pass over the
  // index, ~68k triangles) so each ray tests a few thousand instead of the whole cave. No BVH: this
  // is a one-shot worldgen pass over a couple of dozen rays.
  const idx = geometry.getIndex();
  const pos = geometry.getAttribute('position') as THREE.BufferAttribute;
  const pa = pos.array as ArrayLike<number>;
  const tris = new Map<number, number[]>();
  const boxes = rooms.map((r) => ({
    id: r.id, x: r.x, z: r.z, rr: (r.rx * 1.7 + 1.8) ** 2,
    y0: r.floorY - 1.0, y1: r.floorY + r.height + 1.5,
  }));
  for (const b of boxes) tris.set(b.id, []);
  const count = idx ? idx.count : pos.count;
  const ia = idx ? (idx.array as ArrayLike<number>) : null;
  for (let t = 0; t + 2 < count; t += 3) {
    const a = (ia ? ia[t] : t) * 3, b2 = (ia ? ia[t + 1] : t + 1) * 3, c = (ia ? ia[t + 2] : t + 2) * 3;
    const cx = (pa[a] + pa[b2] + pa[c]) / 3, cy = (pa[a + 1] + pa[b2 + 1] + pa[c + 1]) / 3, cz = (pa[a + 2] + pa[b2 + 2] + pa[c + 2]) / 3;
    for (const b of boxes) {
      if (cy < b.y0 || cy > b.y1) continue;
      const dx = cx - b.x, dz = cz - b.z;
      if (dx * dx + dz * dz > b.rr) continue;
      tris.get(b.id)!.push(a, b2, c);
    }
  }
  return (node, y, ux, uz, maxD): WallHit | null => {
    const list = tris.get(node.id);
    if (!list || !list.length) return null;
    const ox = node.x, oz = node.z;
    let bt = maxD, bnx = 0, bny = 0, bnz = 0, found = false;
    for (let i = 0; i < list.length; i += 3) {
      const a = list[i], b = list[i + 1], c = list[i + 2];
      const ax = pa[a], ay = pa[a + 1], az = pa[a + 2];
      const e1x = pa[b] - ax, e1y = pa[b + 1] - ay, e1z = pa[b + 2] - az;
      const e2x = pa[c] - ax, e2y = pa[c + 1] - ay, e2z = pa[c + 2] - az;
      // Möller–Trumbore with dir = (ux, 0, uz).
      const px = -uz * e2y, py = uz * e2x - ux * e2z, pz = ux * e2y;
      const det = e1x * px + e1y * py + e1z * pz;
      if (det > -1e-9 && det < 1e-9) continue;
      const inv = 1 / det;
      const tx = ox - ax, ty = y - ay, tz = oz - az;
      const u = (tx * px + ty * py + tz * pz) * inv;
      if (u < 0 || u > 1) continue;
      const qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x;
      const v = (ux * qx + uz * qz) * inv;
      if (v < 0 || u + v > 1) continue;
      const tt = (e2x * qx + e2y * qy + e2z * qz) * inv;
      if (tt <= 0.05 || tt >= bt) continue;
      bt = tt; found = true;
      let nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
      const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
      // Face the normal back INTO the room (the ray left the axis heading out, so the inward normal
      // must oppose it). This is what a shelf's stem is oriented along.
      if (nx * ux + nz * uz > 0) { nx = -nx; ny = -ny; nz = -nz; }
      bnx = nx; bny = ny; bnz = nz;
    }
    return found ? { d: bt, nx: bnx, ny: bny, nz: bnz } : null;
  };
}

/** One boulder, WORLD space, as a displaced icosahedron squashed toward the floor. */
function buildBoulder(
  x: number, y: number, z: number, r: number, cnoise: Noise3, depthT: number, squash: number,
): THREE.BufferGeometry {
  const geo = new THREE.IcosahedronGeometry(r, 1);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i), py = pos.getY(i), pz = pos.getZ(i);
    // Two octaves of angular relief so a boulder reads as fractured rock, not as a die. Sampled on
    // the UNDISPLACED local position (+ a world offset per boulder), so duplicated seam vertices
    // land on the same value and the solid cannot split.
    //
    // ── CLOSE-OUT ROUND 2 (finding N1, the ACTUAL culprit) — A RADIUS FLOOR, i.e. NO FINS. ────────
    //    The N1 frames (`scen-kind-warren-pocket-c5.png`, 750-1100 × 460-720) were read as "paper-thin
    //    knife-edged slivers", and an identity raycast through those exact pixels named these meshes:
    //    `userData.rubbleHeap`, IcosahedronGeometry, 240 verts. So it IS this path, not the dripstone
    //    beside it — round 1 fixed this builder's COLOUR (wall role + mottle) and its SEATING, and
    //    left the silhouette alone. At detail 1 an icosahedron has 80 huge facets, and a ±37% radial
    //    displacement on facets that big does not make bumps, it makes FINS and deep concave dimples:
    //    two large flat faces meeting at a sharp edge, which under flat shading with one point light
    //    is a bright plate against black — a shaving. The honest fix is a floor under how far a vertex
    //    may be pulled IN (and a ceiling on how far out), so the body stays a convex-ish block that
    //    cannot present an edge without a face beside it. It costs ZERO triangles, which matters:
    //    detail 2 was measured at +33% on the collapsed shaft's whole cave, against a streaming budget
    //    that is this campaign's flagged risk.
    //    ORIGIN-SAFE BY CONSTRUCTION: `rubblePerChamber` is 0 for canonical, so the origin cave
    //    contains no boulder and cannot notice any of this.
    const nRaw = 1
      + cnoise(px * 2.1 + x * 0.31, py * 2.1 + 5.1, pz * 2.1 + z * 0.31) * 0.26
      + cnoise(px * 5.7 + z * 0.17, py * 5.7 + 9.4, pz * 5.7 + x * 0.17) * 0.11;
    const n = Math.min(1.20, Math.max(0.84, nRaw));
    const wx = x + px * n, wy = y + py * n * squash, wz = z + pz * n;
    pos.setXYZ(i, wx, wy, wz);
    // CLOSE-OUT FIX (finding 4). r4 coloured every boulder with the 'floor' role, whose dominant
    // term is `caveFloorSediment` — a 3-10m-wavelength pooled-sand wash. Over a 60cm body that
    // wash is ONE value, so the whole heap came out as flat untextured beige cards next to walls
    // carrying visible strata. A fallen ceiling block is WALL rock: it gets the strata/stain
    // palette, with the floor role ramped in smoothly by the vertex's own up-ness so the crown
    // still catches sediment and the flanks do not. On top of that, a boulder-local mottle at a
    // 28cm wavelength — the cave-wide palette's finest term is 1.25m, i.e. invisible at this size,
    // which is the other half of why these read as cardboard. Sampled on the UNDISPLACED local
    // position (+ the world offset) exactly like the displacement, so the icosahedron's duplicated
    // seam vertices get identical colours and no crack appears along an edge.
    const upn = Math.max(-1, Math.min(1, py / Math.max(1e-6, r)));
    caveVertexColor('wall', wx, wy, wz, depthT, cnoise, _tmpCol, upn);
    const mot = cnoise(px * 7.3 + x * 0.53, py * 7.3 + 2.7, pz * 7.3 + z * 0.53) * 0.055
              + cnoise(px * 15.1 + z * 0.29, py * 15.1 + 8.2, pz * 15.1 + x * 0.29) * 0.028;
    col[i * 3] = Math.max(0.02, _tmpCol.r + mot);
    col[i * 3 + 1] = Math.max(0.02, _tmpCol.g + mot * 0.94);
    col[i * 3 + 2] = Math.max(0.02, _tmpCol.b + mot * 0.86);
  }
  pos.needsUpdate = true;
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  // ── CLOSE-OUT ROUND 2 (finding N1, the last of it) — SMOOTH NORMALS, ZERO EXTRA TRIANGLES. ─────
  //    `IcosahedronGeometry` is NON-INDEXED: every triangle owns its three vertices, so
  //    `computeVertexNormals` produces FACE normals, and at detail 1 that is 80 enormous facets each
  //    rendering as one uniform value under a single point light. Adjacent facets then differ by a
  //    lot, and a lit facet against a black neighbour is read as a PLATE with a knife rim — which is
  //    finding N1 in one sentence. The two ways out are more geometry (detail 2 = 4× the triangles,
  //    measured at +34% on the collapsed shaft's whole cave, against the campaign's flagged streaming
  //    budget) or smoother shading of the SAME geometry. This is the second: face normals averaged
  //    over coincident positions. The displacement is a pure function of the undisplaced vertex, so
  //    the duplicated corner vertices move identically and still share a position exactly — the
  //    bucket key is safe, and the same property is why the solid stays watertight.
  //    It needs `_caveRubble` (flatShading OFF) to have any effect at all; `_caveSolid` discards the
  //    normal attribute and re-derives a face normal in the fragment shader.
  {
    const nn = geo.attributes.normal as THREE.BufferAttribute;
    const acc = new Map<string, number[]>();
    const key = (i: number): string =>
      `${Math.round(pos.getX(i) * 1e4)},${Math.round(pos.getY(i) * 1e4)},${Math.round(pos.getZ(i) * 1e4)}`;
    for (let i = 0; i < pos.count; i++) {
      const k = key(i), a = acc.get(k);
      if (a) { a[0] += nn.getX(i); a[1] += nn.getY(i); a[2] += nn.getZ(i); }
      else acc.set(k, [nn.getX(i), nn.getY(i), nn.getZ(i)]);
    }
    for (let i = 0; i < pos.count; i++) {
      const a = acc.get(key(i))!;
      const l = Math.hypot(a[0], a[1], a[2]) || 1;
      nn.setXYZ(i, a[0] / l, a[1] / l, a[2] / l);
    }
    nn.needsUpdate = true;
  }
  return geo;
}

/** DEEPER cycle-9 LOOK PASS — a STRIPPED PLATE: a torn sheet of hull metal leaning on a rubble heap.
 *
 *  WHY IT EXISTS. The warren's claim is "somebody worked down here", and rounds 1-4 proved that
 *  loose `scrap` pickups cannot carry it on their own: one flake per room reads as litter, and even
 *  grouped into caches at the foot of a rubble spill they are still just small orange chips on a
 *  stone floor. There is no MAN-MADE LANGUAGE in the frame — nothing straight, nothing cut. Two
 *  rectangular plates fix that in one object: a straight edge is the only silhouette in a cave that
 *  cannot be geology.
 *
 *  WHAT IT COSTS. Nothing new: no material (it rides `_caveSolid` with rust VERTEX COLOURS, so the
 *  cave is still one program), no ItemId, no loot table, no interaction — it is scenery beside the
 *  pickups, not a pickup. Rule 7: a real box with ≥12cm of depth, FrontSide, so the torn edge shows
 *  a genuine cross-section at a grazing angle. Rule 9: collider-bearing, and placed INSIDE the
 *  heap's own already-cleared footprint so it inherits the clearance the heap was tested against. */
function buildStrippedPlate(w: number, h: number, d: number, rust: number, rand: () => number): THREE.BufferGeometry {
  // ── CLOSE-OUT FIX (finding 1, the shape half). r5 built this as a ONE-SEGMENT box, so the "torn"
  //    top edge had exactly TWO movable vertices: the tear could only ever produce a single straight
  //    slanted cut, i.e. a symmetric WEDGE. Two of those crossed at a heap read — correctly — as an
  //    orange CHEVRON, a waypoint arrow, which is the one thing a piece of scenery must never look
  //    like. A torn sheet needs a torn EDGE (7 columns, each pulled down by its own hash) and a
  //    plate stripped off a hull is BENT, not flat. Rule 7 survives all of it: every deformation
  //    moves the front and back faces by the SAME amount, so the wall thickness `d` is preserved and
  //    the cut edges still show a real cross-section.
  //
  //    FIXED RNG BUDGET (procgen-surface-placement.md). The old version pulled a `rand()` PER VERTEX
  //    inside the colour loop, so the number of draws it consumed depended on the box's tessellation
  //    — change the segment counts and every downstream placement in the rubble stream moves. Three
  //    draws are pulled up front and the loops are RNG-free.
  const bendAmp = (rand() - 0.5) * w * 0.16;      // ± a real curve across the plate's width
  const shear = (rand() - 0.5) * 0.34;            // the top edge is not parked over the bottom edge
  const tone = 0.86 + rand() * 0.24;
  const geo = new THREE.BoxGeometry(w, h, d, 6, 2, 1);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const col = new Float32Array(pos.count * 3);
  const base = new THREE.Color(rust);
  const halfW = w * 0.5, halfH = h * 0.5;
  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i), py = pos.getY(i), pz = pos.getZ(i);
    const u = px / (halfW || 1);                                  // -1 … +1 across the width
    const vt = (py + halfH) / (h || 1);                           // 0 bottom … 1 top
    // Every offset below is keyed on the ORIGINAL (px, py) only, so the front face, the back face,
    // the side caps and the top cap all agree at a shared rim and the solid stays closed.
    const s = 0.5 + 0.5 * Math.sin(u * 9.7 + 2.3) * Math.sin(u * 23.1 + 5.9);
    let nx = px, ny = py, nz = pz;
    if (py > halfH * 0.25) {                                      // the TOP row only — a torn rim
      ny = py - h * (0.04 + 0.26 * s);
      nx = px + (s - 0.5) * w * 0.06;
    }
    nx += shear * w * 0.25 * vt;                                  // lean the sheet
    nz += bendAmp * (u * u - 0.42);                               // BEND about the vertical
    pos.setXYZ(i, nx, ny, nz);
    // Oxide, mottled — a uniform orange box is what read as a signpost. Darker in the middle of the
    // sheet where water sat, lighter along the cut edges where the metal is fresh.
    const edge = Math.max(Math.abs(u) > 0.86 ? 1 : 0, vt > 0.72 ? 1 : 0);
    const patch = 0.5 + 0.5 * Math.sin(u * 5.1 + vt * 7.7) * Math.sin(u * 12.3 - vt * 3.1);
    const t = tone * (0.60 + 0.26 * patch + 0.20 * edge);
    // A rust plate under a torch is not a saturated orange: pull the whole thing toward the cave's
    // own cold grey by a fixed fraction so it reads as METAL in the frame, not as a marker.
    const gy = 0.24;
    col[i * 3] = (base.r * (1 - gy) + 0.20 * gy) * t;
    col[i * 3 + 1] = (base.g * (1 - gy) + 0.21 * gy) * t;
    col[i * 3 + 2] = (base.b * (1 - gy) + 0.23 * gy) * t;
  }
  pos.needsUpdate = true;
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  return geo;
}

/** `count` rubble heaps in one chamber. Each heap is 4-7 part-buried boulders around a centre; the
 *  heap's footprint is what the clearance test is run against, so the KCC meets it exactly as it
 *  meets a stalagmite. Returns the number actually placed (a tight room may fit none). */
function addRubble(
  node: CaveNode,
  count: number,
  mouthDirs: Array<{ x: number; z: number }>,
  cnoise: Noise3, depthT: number, rand: () => number,
  group: THREE.Group, meshes: THREE.Mesh[],
  /** cycle-9 LOOK PASS — × on footprint and boulder radius. See `CaveKindParams.rubbleScale`. */
  scale = 1,
  /** …and × on the CONE HEIGHT, which is a separate dial for a hard geometric reason: the footprint
   *  is bounded by the chamber (a heap has to fit in the annulus between the march's floor grid and
   *  the wall, which in a 3m-radius pocket is under a metre), but the HEIGHT is bounded by nothing.
   *  A collapsed ceiling is a steep pile, so height is where the read has to come from. */
  heightScale = 1,
  /** OUT — every heap placed, appended as {node, x, z, r}. The warren's scrap caches land NEXT TO
   *  one (see the scrap pass): broken rock plus salvaged metal in the same corner is what turns two
   *  orange flakes from litter into evidence that somebody worked here. */
  outSpots?: Array<{ node: number; x: number; z: number; r: number }>,
  /** Stripped hull plates leaning on each heap (canonical 0 — see `buildStrippedPlate`). */
  salvagePlates = 0,
  /** CLOSE-OUT — the REAL rock height under a point (`makeRockFloorSampler`). Every boulder and
   *  every plate is seated against THIS, never against `node.floorY`: the analytic plane is what
   *  hung r5's salvage plate a metre over unbroken sand. */
  floorH?: RockFloor,
): number {
  if (count <= 0) return 0;
  const T = Tuning;
  const rx = node.rx, floorY = node.floorY;
  const mouthCos = Math.cos((T.CAVE_SPELEO_MOUTH_CLEAR_DEG * Math.PI) / 180);
  // The same floor grid the march samples (rings 0.72·rx, 8 spokes) — identical to addSpeleothems.
  const grid: Array<{ x: number; z: number }> = [];
  for (let ri = 0; ri <= 4; ri++) {
    const rr = (rx * 0.72 * ri) / 4, spokes = ri === 0 ? 1 : 8;
    for (let si = 0; si < spokes; si++) { const a = (si / spokes) * Math.PI * 2; grid.push({ x: node.x + Math.cos(a) * rr, z: node.z + Math.sin(a) * rr }); }
  }
  const placed: Array<{ x: number; z: number; r: number }> = [];
  let made = 0;
  for (let i = 0; i < count; i++) {
    for (let a = 0; a < 24; a++) {
      const ang = rand() * Math.PI * 2;
      const ux = Math.cos(ang), uz = Math.sin(ang);
      let blockedByMouth = false;
      for (const md of mouthDirs) if (ux * md.x + uz * md.z > mouthCos) { blockedByMouth = true; break; }
      if (blockedByMouth) continue;
      const fr = lerp(T.CAVE_SPELEO_RING_MIN, T.CAVE_SPELEO_RING_MAX, rand());
      const cx = node.x + ux * rx * fr, cz = node.z + uz * rx * fr;
      // Footprint. Scaled by the kind, then CLAMPED to the ANNULUS the chamber actually has spare —
      // from the march's 0.72·rx floor grid out to the ~0.94·rx wall. Measured, not guessed: a fixed
      // 2× footprint placed ZERO heaps in a re-proportioned collapsed shaft (8 chambers × 3 heaps ×
      // 24 attempts, all rejected), i.e. the kind's defining feature silently disappeared while every
      // other number in the report stayed green.
      const heapR = Math.min((0.85 + rand() * 0.55) * scale, Math.max(0.45, rx * 0.21));
      let clear = true;
      for (const gp of grid) if (Math.hypot(cx - gp.x, cz - gp.z) < heapR + 0.2) { clear = false; break; }
      if (clear) for (const q of placed) if (Math.hypot(cx - q.x, cz - q.z) < heapR + q.r + 0.5) { clear = false; break; }
      if (!clear) continue;
      // A TALUS CONE, not a scatter. Cycle 9 laid every boulder flat on the floor plane inside one
      // 0.85m disc, so the crown of a "collapsed ceiling" sat ~0.5m off the floor and the frames
      // read as gravel. The heap is now a filled cone of height `peak`: boulders march from the
      // centre out to the rim in order (never at random radii — with 4-7 bodies a random spread
      // leaves holes in the profile and the high ones read as FLOATING rocks), each one bigger near
      // the middle, each SEATED so its top meets the cone surface and its base is buried in what is
      // under it. Silhouette: a steep lumpy pile you walk around. It is one solid to the KCC.
      const peak = heapR * 0.85 * heightScale;
      const n = Math.round((4 + Math.floor(rand() * 4)) * (0.5 + 0.5 * heightScale));
      for (let b = 0; b < n; b++) {
        const ba = rand() * Math.PI * 2;
        const t = Math.min(1, (b + 0.30 + rand() * 0.55) / n);   // centre → rim, in order
        // Lateral offset never goes to zero. With `br = t·heapR` the first two or three boulders sit
        // on the SAME vertical axis and the r3 frames showed a stacked-disc CAIRN — a deliberate
        // human marker, which is the exact opposite of "the ceiling fell in". Every boulder keeps at
        // least ~28% of the footprint off-axis, on its own bearing, so the pile interlocks sideways.
        const br = (0.28 + 0.72 * t) * heapR * 0.86;
        // CLOSE-OUT ROUND 2 (N1) — AN ABSOLUTE SIZE FLOOR. `scale` is a kind dial (the warren runs
        // 0.8) and it multiplies a radius that already tapers to 0.80× at the rim, so the warren's
        // outermost blocks came out at 15cm — pebble-sized, i.e. exactly the size at which 80 facets
        // read as a few flakes rather than as a rock. 22cm is the floor: still small beside the
        // shaft's blocks, big enough to carry its own facets at arm's length.
        const r0 = Math.max(0.22, (0.24 + rand() * 0.30) * scale * (1.30 - 0.50 * t));
        // CLOSE-OUT (finding 4): 0.62 squash flattened a boulder to under two-thirds of its own
        // width, and the icosahedron's angular relief turned that into knife-edged SLABS — cardboard
        // with a sharp rim, the exact rule-7 read. A collapsed ceiling drops blocks, not shingles.
        // ROUND 2 lifts the floor again (0.74 → 0.80): at the near end of the old range a block was
        // still a quarter flatter than it was wide, and flatter reads thinner from every angle.
        const squash = 0.80 + rand() * 0.18;
        const bx = cx + Math.cos(ba) * br, bz = cz + Math.sin(ba) * br;
        // The cone's surface height at this radius, then seat the boulder into it. `Math.max(0, …)`
        // is the no-float guarantee: a boulder can never end up above the floor on its own — and
        // "the floor" is now the REAL ROCK under THIS boulder, sampled from the SDF surface, not the
        // chamber's nominal plane (which the r4 frames showed a slab hovering over).
        const bfy = floorH ? floorH(bx, bz, floorY) : floorY;
        const surf = peak * (1 - t) * (1 - t);
        const bodyH = r0 * squash;
        const by = bfy + Math.max(0, surf - bodyH * 0.55) + bodyH * (0.10 + rand() * 0.30) - bodyH * 0.40;
        const m = new THREE.Mesh(buildBoulder(bx, by, bz, r0, cnoise, depthT, squash), _caveRubble);
        m.castShadow = false; m.receiveShadow = true;
        // Tag the heap so a diagnostic can FIND one. The cycle-9 shot helper guessed at "a small
        // solid near a chamber floor" and kept framing STALAGMITES, i.e. the one framing meant to
        // prove the kind's defining feature was never actually of that feature.
        m.userData.rubbleHeap = { x: cx, z: cz, floorY, r: heapR };
        group.add(m); meshes.push(m);                            // collider-bearing (rule 9)
      }
      // ── Stripped plates, STANDING AT THE HEAP'S FOOT AND LEANING ON IT. ──────────────────────
      //    r5 dropped each plate at `floorY + ph·0.42` with a free Euler on all three axes: the
      //    height was a guess against the analytic plane (it hung ~1m over the real sand), the free
      //    roll meant the bottom edge was never parallel to anything, and there was no contact with
      //    the heap it was supposedly leaning on. All three are fixed by construction here:
      //      · the BASE POINT is on the heap's rim and its height is the sampled ROCK, embedded;
      //      · the plate is tipped about a HORIZONTAL axis perpendicular to the lean, so its bottom
      //        edge stays level and lies ON the floor over its whole width;
      //      · it leans INWARD, toward the heap centre, so its upper half rests against the cone.
      for (let s = 0; s < salvagePlates; s++) {
        const pw = 0.55 + rand() * 0.55, ph = 0.62 + rand() * 0.52, pd = 0.14 + rand() * 0.06;
        const geo = buildStrippedPlate(pw, ph, pd, Tuning.CAVE_SALVAGE_PLATE_HEX, rand);
        const m = new THREE.Mesh(geo, _caveSolid);
        const pa = rand() * Math.PI * 2;
        const pr = heapR * (1.06 + rand() * 0.32);                 // at the FOOT, on open floor —
                                                                   //   the ground contact has to be
                                                                   //   visible, not hidden behind
                                                                   //   the boulders it leans on
        const bxp = cx + Math.cos(pa) * pr, bzp = cz + Math.sin(pa) * pr;
        const fyp = floorH ? floorH(bxp, bzp, floorY) : floorY;
        const lx = -Math.cos(pa), lz = -Math.sin(pa);              // lean toward the heap centre
        const tilt = 0.40 + rand() * 0.26;                         // 23-38° off vertical
        // axis = up × lean  ⇒  tipping about it swings local +Y toward the heap and keeps local X
        // (the bottom edge) horizontal.
        const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(lz, 0, -lx).normalize(), tilt);
        // …then a small ROLL about the lean direction, so one bottom corner rides a bump instead of
        // both sitting on a machined line. Bounded (±0.14 rad over a ≤1.1m plate ⇒ ≤8cm) so the
        // opposite corner is still inside the 8cm embed below and nothing lifts off the rock.
        const roll = (rand() - 0.5) * 0.28;
        q.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(lx, 0, lz).normalize(), roll));
        m.quaternion.copy(q);
        const up = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
        m.position.set(bxp + up.x * ph * 0.5, fyp + up.y * ph * 0.5 - 0.08, bzp + up.z * ph * 0.5);
        m.castShadow = false; m.receiveShadow = true;
        group.add(m); meshes.push(m);                          // collider-bearing (rule 9)
      }
      placed.push({ x: cx, z: cz, r: heapR });
      if (outSpots) outSpots.push({ node: node.id, x: cx, z: cz, r: heapR });
      made++;
      break;
    }
  }
  return made;
}

// ── Weird mushrooms (the life accent) ────────────────────────────────────────

// Pale bone-cream stalk (lit by the torch when the player is near) + a faintly cool-bioluminescent
// cap. The cap's LOW emissive renders even in pitch black (a navigation breadcrumb + eerie accent),
// but toneMapped keeps it from blowing out so DARKNESS still dominates — these are NOT lamps. Shared
// materials → one program for every fungus. Solid primitives (rule 7 — cylinders/spheres are thick).
// CLOSE-OUT ROUND 2, two changes, BOTH digest-free (`caveDigest` hashes vertex positions only):
//   · `vertexColors` — carries the CONTACT SHADOW baked into each stalk (finding N6). Every stalk
//     geometry built here writes the attribute, so the shared material can never meet one without it.
//   · `flatShading: false` — finding "stem prism". A 6-sided prism under flat shading shows three
//     hard vertical corner seams, which at cathedral cap scale reads as a milled dowel rather than a
//     stem. Smooth normals cost nothing, need no extra segments, and cannot move a single vertex —
//     the alternative (more segments) would have moved the origin cave's mushroom geometry, since
//     every canonical stalk radius sits below the existing LOD threshold.
const _fungiStalk = new THREE.MeshStandardMaterial({ color: Tuning.CAVE_FUNGI_STALK_HEX, roughness: 0.9, metalness: 0.0, flatShading: false, vertexColors: true });
const _fungiCap = new THREE.MeshStandardMaterial({
  color: 0x243c3a, roughness: 0.6, metalness: 0.0,
  emissive: Tuning.CAVE_FUNGI_EMISSIVE_HEX, emissiveIntensity: Tuning.CAVE_FUNGI_EMISSIVE_INT,
});

/** One mushroom (bent stalk + a domed glowing cap) at LOCAL origin, stalk rising +Y. Height `h`,
 *  cap radius `capR`. Solid — a real capped stalk, not a flat shell. */
function buildMushroom(h: number, capR: number, rand: () => number): THREE.Group {
  const grp = new THREE.Group();
  const stalkR = Math.max(0.012, capR * (0.28 + rand() * 0.12));
  const bend = (rand() - 0.5) * 0.5;
  // CLOSE-OUT (sev-3, "popsicle"): a 6-sided prism is honest at 4cm and a visible hexagon at 10cm,
  // which is what a cathedral-scale cap's stalk is. The count is a pure function of the RADIUS, so
  // it is an LOD rule and not a kind branch — and every CANONICAL stalk is under the threshold by
  // construction (canonical capR ≤ CAVE_FUNGI_CAP_MAX_R 0.16 ⇒ stalkR ≤ 0.064), which is why the
  // origin cave's mushroom geometry — and therefore the origin digest — cannot move.
  const segs = stalkR > 0.065 ? 10 : 6;    // 0.07 → 0.065: canonical stalkR is < 0.064 by construction
  const sgeo = new THREE.CylinderGeometry(stalkR * 0.8, stalkR, h, segs);
  // ── CLOSE-OUT ROUND 2 (finding N6) — A CONTACT CUE AT THE BASE. Every rock in the frame gets one
  //    for free (it is lit by a torch and self-shadows into the floor); a flat-cut cylinder standing
  //    on sand does not, so the stalks read as PUSHED INTO the ground rather than GROWING out of it.
  //    A baked darkening over the bottom ~18% of the stalk is the cheapest honest version: no extra
  //    mesh (which would change the mesh set and therefore the digest), no light, no RNG — a pure
  //    function of local height, so it is deterministic and identical on every reload.
  {
    const sp = sgeo.attributes.position as THREE.BufferAttribute;
    const sc = new Float32Array(sp.count * 3);
    for (let i = 0; i < sp.count; i++) {
      const t = Math.min(1, Math.max(0, (sp.getY(i) + h * 0.5) / Math.max(1e-6, h)));  // 0 base → 1 top
      const k = 0.32 + 0.68 * Math.min(1, t / 0.18);
      sc[i * 3] = k; sc[i * 3 + 1] = k; sc[i * 3 + 2] = k;
    }
    sgeo.setAttribute('color', new THREE.BufferAttribute(sc, 3));
  }
  const stalk = new THREE.Mesh(sgeo, _fungiStalk);
  stalk.position.y = h * 0.5;
  stalk.rotation.z = bend * 0.6;
  grp.add(stalk);
  // Cap — a squashed hemisphere dome sitting on the stalk top (glowing underside + top).
  const cap = new THREE.Mesh(new THREE.SphereGeometry(capR, 10, 7, 0, Math.PI * 2, 0, Math.PI * 0.62), _fungiCap);
  cap.scale.set(1, 0.72 + rand() * 0.2, 1);
  cap.position.set(Math.sin(bend) * h * 0.5, h - capR * 0.15, 0);
  grp.add(cap);
  // Publish the CAP's own footprint (its lateral offset from this mushroom's origin, and its
  // radius) so a cluster can enforce silhouette separation on the caps themselves rather than on
  // the stalk bases — the caps are what merge, and a bent stalk puts its cap up to h/2 away.
  grp.userData.capOffX = Math.sin(bend) * h * 0.5;
  grp.userData.capR = capR;
  grp.traverse((o) => { const mm = o as THREE.Mesh; if (mm.isMesh) mm.receiveShadow = true; });
  return grp;
}

/** A cluster of 2..MAX mushrooms of varied height crowded within ~`spread` of a point.
 *  `perMax`/`capScale` default to the canonical constants — same draws, same values. */
function buildFungiCluster(
  rand: () => number, spread: number,
  perMax: number = Tuning.CAVE_FUNGI_PER_CLUSTER_MAX, capScale = 1,
): THREE.Group {
  const cl = new THREE.Group();
  const n = 2 + Math.floor(rand() * (perMax - 1));
  for (let i = 0; i < n; i++) {
    const capR = Tuning.CAVE_FUNGI_CAP_MAX_R * (0.42 + rand() * 0.58) * capScale;
    const h = capR * (2.2 + rand() * 3.4);
    const m = buildMushroom(h, capR, rand);
    const a = rand() * Math.PI * 2, rr = rand() * spread;
    m.position.set(Math.cos(a) * rr, 0, Math.sin(a) * rr);
    m.rotation.y = rand() * Math.PI * 2;
    cl.add(m);
  }
  relaxClusterCaps(cl, spread);
  return cl;
}

/** ── CLOSE-OUT FIX (finding 2) — CAPS MAY TOUCH, THEY MAY NOT ENGULF. ────────────────────────────
 *
 *  A cluster draws each mushroom's (angle, radius) independently inside a ~35cm disc, so nothing
 *  stopped two 16cm caps landing 3cm apart. At arm's length that is not two mushrooms, it is ONE
 *  lumpy white mass with a bump on it — `scen-kind-shaft-signature-r4.png` was read by a fresh
 *  critic as a CARTOON SNOWMAN, stems entirely swallowed. The whole defect is silhouette merge, and
 *  it is a PLACEMENT problem: the shared cap/stalk materials are cycle-6/7 hero work and stay frozen.
 *
 *  THE RULE: the lateral distance between two caps' centres is at least `SEP·(rA + rB)`. At 0.86 two
 *  equal caps overlap by ~14% of their diameter — they read as crowded and touching, which is what a
 *  bloom looks like, and never as one blob. Enforced by RELAXATION, not by re-placement, and that is
 *  the load-bearing choice: a pair that already satisfies the rule is not moved by one float, so
 *  every canonical cluster that was already legal is byte-identical, and no cluster anywhere changes
 *  a single mushroom's SIZE — which is why the cave-walk vertex digest (d8f15005 at the origin)
 *  cannot move, since it hashes each mesh's local geometry.
 *
 *  It consumes ZERO `rand()` draws (the tie-break for a perfectly-coincident pair is derived from
 *  the pair's own indices), so the fungi stream downstream of any cluster is untouched. */
function relaxClusterCaps(cl: THREE.Group, spread: number): void {
  const items = cl.children.map((o, i) => {
    const ox = (o.userData.capOffX as number) ?? 0;
    const ry = (o as THREE.Object3D).rotation.y;
    return { o, i, r: (o.userData.capR as number) ?? 0, dx: ox * Math.cos(ry), dz: -ox * Math.sin(ry) };
  }).filter((it) => it.r > 0);
  if (items.length < 2) return;
  const SEP = 0.86;
  // The cluster may grow, but not without bound: it still has to sit in the annulus its chamber gave
  // it. 2.6× the authored spread is the ceiling (a 6-cap canonical cluster settles well inside it).
  const maxR = spread * 2.6 + 0.05;
  for (let it = 0; it < 16; it++) {
    let moved = false;
    for (let a = 0; a < items.length; a++) {
      for (let b = a + 1; b < items.length; b++) {
        const A = items[a], B = items[b];
        const ax = A.o.position.x + A.dx, az = A.o.position.z + A.dz;
        const bx = B.o.position.x + B.dx, bz = B.o.position.z + B.dz;
        let dx = bx - ax, dz = bz - az;
        let d = Math.hypot(dx, dz);
        const need = SEP * (A.r + B.r);
        if (d >= need) continue;
        if (d < 1e-4) { const t = a * 2.39996 + b * 0.7; dx = Math.cos(t); dz = Math.sin(t); d = 1; }
        const push = ((need - d) * 0.5) / d;
        A.o.position.x -= dx * push; A.o.position.z -= dz * push;
        B.o.position.x += dx * push; B.o.position.z += dz * push;
        moved = true;
      }
    }
    if (!moved) break;
  }
  for (const it of items) {
    const l = Math.hypot(it.o.position.x, it.o.position.z);
    if (l > maxR) { const k = maxR / l; it.o.position.x *= k; it.o.position.z *= k; }
  }
}

/** UNDERWORLD cycle 3 — a HARVESTABLE fungi cluster. E on it yields 1-2 alien_fruit (the
 *  established weird-flora food; no new craftable output). Visual-only geometry (no collider), but
 *  its meshes are tagged for the 'caveFungi' interaction raycast so a real player can pick it. */
export interface CaveFungiCluster {
  id: number;
  group: THREE.Group;     // the cluster's mushrooms (harvested → hidden)
  pos: THREE.Vector3;     // world-space cluster centre (for the hover prompt distance)
  harvested: boolean;
  hovered: boolean;
}

let _fungiId = 1;

/** CLOSE-OUT instrument — wall-shelf anchor accounting for the CURRENT build (reset per cave, read
 *  into the probe). A shelf that finds no rock is hidden rather than left in mid-air, and a kind
 *  whose "glow ladder" is quietly 70% hidden is a defect the frames alone would never name. */
let _fungiWallTotal = 0;
let _fungiWallHidden = 0;
/** …of which THIS many were hidden because every bearing at that height found only CEILING (close-out
 *  round 2). Reported separately so "the band is aimed too high" is distinguishable in one number from
 *  "the SDF closed the dome there", which are different table edits. */
let _fungiWallCeiling = 0;

function tagFungi(root: THREE.Object3D, id: number): void {
  root.traverse((o) => { o.userData.interactType = 'harvest'; o.userData.interactId = id; o.userData.interactRegistry = 'caveFungi'; });
}

/** Seed the chosen chamber with sparse fungi clusters: floor clusters at mid radii (near the walls
 *  / floor dips) + optional shelf fungi on the wall. Floor clusters are HARVESTABLE (tagged +
 *  recorded); wall-shelf fungi stay pure decor. No colliders — never trips the walk/collision gates.
 *  Deterministic via the passed rng stream. */
function addFungi(
  node: CaveNode, cnoise: Noise3, rand: () => number,
  group: THREE.Group, decor: THREE.Mesh[], clusters: CaveFungiCluster[],
  p: CaveKindParams,
  /** CLOSE-OUT — casts against the REAL SDF wall (`makeWallCaster`). Optional so the pure-placement
   *  call paths still work; without it the shelves fall back to the analytic ellipsoid. */
  wallCast?: WallCast,
  /** CLOSE-OUT ROUND 2 — the REAL rock height under a floor cluster (`makeRockFloorSampler`). A
   *  cluster is a GROUP TRANSFORM, not baked vertices, so seating it on the measured surface moves no
   *  hashed position and the origin digest cannot follow it. Kind-neutral for that reason. */
  rockFloor?: RockFloor,
): void {
  const rx = node.rx, floorY = node.floorY;
  const nClusters = p.fungiClusterMin
    + Math.floor(rand() * (p.fungiClusterMax - p.fungiClusterMin + 1));
  // CLOSE-OUT — clusters must not land on top of EACH OTHER either. `relaxClusterCaps` fixes the
  // merge INSIDE a cluster, but a vaulted kind seeds 5-8 clusters per room at independent (angle,
  // radius) draws, so two whole clusters can occupy the same square metre and the result is the
  // same white mass by another route (the c1 fungal/pocket frame, bottom centre). Pushed apart
  // deterministically after the draw — RNG-free, and a no-op for a cluster that was already clear,
  // so a canonical room whose clusters never collided is untouched.
  const clusterSpots: Array<{ x: number; z: number; r: number }> = [];
  for (let c = 0; c < nClusters; c++) {
    const ang = rand() * Math.PI * 2;
    const fr = 0.45 + rand() * 0.42;                    // mid → outer floor (toward the walls)
    let x = node.x + Math.cos(ang) * rx * fr, z = node.z + Math.sin(ang) * rx * fr;
    {
      const myR = 0.35 * p.fungiCapScale * 2.0 + 0.25;  // the relaxed cluster's own reach
      for (let it = 0; it < 6; it++) {
        let moved = false;
        for (const q of clusterSpots) {
          let dx = x - q.x, dz = z - q.z;
          let d = Math.hypot(dx, dz);
          const need = myR + q.r;
          if (d >= need) continue;
          if (d < 1e-4) { dx = Math.cos(c * 2.39996); dz = Math.sin(c * 2.39996); d = 1; }
          const k = (need - d) / d;
          x += dx * k; z += dz * k; moved = true;
        }
        if (!moved) break;
      }
      // …but never pushed out of the room it was seeded in.
      const dl = Math.hypot(x - node.x, z - node.z), lim = rx * 0.90;
      if (dl > lim) { const k = lim / dl; x = node.x + (x - node.x) * k; z = node.z + (z - node.z) * k; }
      // …and never left standing where the rock sampler HAS NO DATA. `fr` reaches 0.87·rx, which for
      // a clipped dome or a corridor-mouth corner is past the last floor-facing vertex the
      // polygonizer emitted — the sampler then returns its `fallback`, i.e. the ANALYTIC plane, and
      // that is precisely the silent path that left one cluster 0.45m in the air in the fungal cave
      // and another 0.54m up in the shaft when `fungiContact` was first pointed at them. So walk the
      // cluster INWARD in fixed steps until the sampler answers with a plausible height. RNG-free
      // (the fungi stream is untouched) and a no-op wherever the sampler already had data — which is
      // most spots in most rooms.
      if (rockFloor) {
        for (let k = 0; k <= 5; k++) {
          const t = 1 - k * 0.15;
          const sx = node.x + (x - node.x) * t, sz = node.z + (z - node.z) * t;
          const r = rockFloor(sx, sz, Number.NaN);       // NaN fallback = "say so when you don't know"
          // 0.6m, not 1.2: the SDF floor cannot honestly differ from the analytic plane by more
          // than the displacement amplitude (CAVE_GEN_DISP_IN 0.30 + CAVE_SDF_MICRO_AMP 0.075, plus
          // the bump), and a wider band lets the sampler hand back a NEIGHBOURING room's floor where
          // two grids overlap — which is how the first cut of this fix bedded two clusters half a
          // metre INTO the rock (the signed `fungiContact` gaps named it: -0.45m and -0.54m).
          if (Number.isFinite(r) && Math.abs(r - floorY) <= 0.6) { x = sx; z = sz; break; }
        }
      }
      clusterSpots.push({ x, z, r: myR });
    }
    // Sit on the actual bumpy floor (matches the mesh floor micro-bump)… and then, CLOSE-OUT ROUND 2,
    // on the floor that is actually THERE. The analytic plane + micro-bump is a MODEL of the floor;
    // the rock the player walks on is the SDF surface, and the two differ by up to the displacement
    // amplitude, which is a whole cluster hovering or half-buried. `fungiContact` in the cave-kinds
    // leg is the machine tooth on this, so it can never quietly regress into a still-photo argument
    // again. The 4cm bias sinks the stalk bases into the rock: `makeRockFloorSampler` max-splats
    // up-facing vertices over a 0.45m cell, so its answer can sit a couple of cm PROUD of the true
    // surface between vertices, and a gap at the base is the whole "floating mushroom" read.
    const fy0 = floorY + Math.max(0, cnoise(x * 0.5, 7.3, z * 0.5)) * Tuning.CAVE_GEN_FLOOR_BUMP;
    const rf = rockFloor ? rockFloor(x, z, Number.NaN) : Number.NaN;
    const fy = Number.isFinite(rf) && Math.abs(rf - floorY) <= 0.6 ? rf - 0.04 : fy0;
    // Spread scales with cap size — otherwise a cathedral-scale cluster is a bouquet of caps all
    // intersecting each other inside a 35cm disc.
    const cl = buildFungiCluster(rand, 0.35 * p.fungiCapScale, p.fungiPerCluster, p.fungiCapScale);
    cl.position.set(x, fy, z);
    for (const o of cl.children) o.traverse((m) => { (m as THREE.Mesh).receiveShadow = true; });
    group.add(cl); cl.traverse((o) => { if ((o as THREE.Mesh).isMesh) decor.push(o as THREE.Mesh); });
    // HARVESTABLE — tag the cluster + record it (E → alien_fruit). The dais/egg chamber is a rich
    // spot; every seeded floor cluster is pickable.
    const cid = _fungiId++;
    tagFungi(cl, cid);
    clusters.push({ id: cid, group: cl, pos: new THREE.Vector3(x, fy, z), harvested: false, hovered: false });
  }
  // Optional wall shelf fungi — caps jutting horizontally off the wall. For most kinds that is a
  // few at head height (canonical: 2-4 over 0.28..0.62 of the room). For a VAULTED kind it is the
  // load-bearing height cue: a ladder of glow climbing 16%→90% of the dome, because emissive
  // geometry is the only light this cave is allowed to add (no free light — torch/lantern only) and
  // a torch physically cannot reach an 11m ceiling. All four dials are canonical-neutral.
  if (rand() < p.fungiWallChance) {
    const ry = node.height * 0.6, cyc = floorY + node.height - ry;
    const shelves = p.fungiWallShelves + Math.floor(rand() * p.fungiWallShelvesSpan);
    for (let s = 0; s < shelves; s++) {
      const ang = rand() * Math.PI * 2;
      const hFrac = p.fungiWallLoFrac + rand() * p.fungiWallSpanFrac;   // fraction up the wall
      const wy = floorY + node.height * hFrac;
      // ── CLOSE-OUT FIX (finding 3) — ANCHOR ON THE ROCK, NOT ON THE ELLIPSOID. ────────────────
      //    The 4% inward pull was a GUESS at how far the SDF undercuts the analytic shell, and the
      //    close-out frames showed exactly what a guess buys: caps hanging in open air with their
      //    stems projecting into space (fungal/pocket 1035,160 and 360,290) and a stemless cap
      //    floating in the middle of the vault (fungal/vault 967,578). The shell is measured now —
      //    one ray from the chamber's own axis straight out along the shelf's bearing; the first
      //    triangle it meets IS the wall, whatever the displacement did to it, and the triangle's
      //    normal is what the stem grows along, so the fungus sits FLUSH on a sloped, undercut or
      //    bulging surface instead of at a cardinal yaw. If a bearing finds no rock in reach (it
      //    went down a corridor mouth, or the dome has already closed at that height) it retries on
      //    GOLDEN-ANGLE offsets — RNG-FREE, so the fungi stream is untouched and every chamber
      //    downstream is byte-identical — and a shelf that finds nothing at all is HIDDEN rather
      //    than parked in mid-air. It is still built and still counted, so the mesh set (and the
      //    digest) is exactly what it was.
      const yn0 = Math.max(-0.98, Math.min(0.98, (wy - cyc) / ry));
      const analyticR = rx * Math.sqrt(Math.max(0.02, 1 - yn0 * yn0));
      // A hit much further out than the analytic wall is the ray having escaped down a CORRIDOR
      // MOUTH and struck the far side of the tube — mounting a shelf there would put it in a
      // doorway metres from the room it belongs to. Cap the reach, and require a wall-ish face.
      const maxD = analyticR * 1.30 + 0.9;
      // ── CLOSE-OUT ROUND 2 (finding 3, the residual) — NO CEILING FUNGI. ──────────────────────
      //    Round 1 anchored the shelves on measured rock and that fixed the WALL band. What it did
      //    not fix is the top of the band, because `|ny| < 0.88` accepts a face that is 62° from
      //    vertical — a CEILING. A cap mounted up there hangs with most of its silhouette in open
      //    black (fungal/pocket-c5 at 665,212 is tangent to a stalactite with ~55% of the cap in
      //    void; fungal/signature-c5 at 447,15 is a bare glowing disc), because there is no rock
      //    BEHIND it from any angle a player stands at, and no stem in the silhouette either — the
      //    up-bias that puts a wall shelf's stem in view points a ceiling shelf's stem straight at
      //    the viewer. There is no fix that keeps them: a ceiling shelf photographed from the floor
      //    is an orb by geometry, not by shading. So the acceptance test is now a TRUE WALL — 60°
      //    from vertical or steeper — and a bearing that only finds ceiling is treated exactly like
      //    a bearing that finds nothing: the mushroom is still BUILT, still counted, still pushed to
      //    `decor` (so the mesh set and `caveDigest` are unchanged, the same mechanism round 1 used),
      //    and simply not drawn. The glow ladder loses nothing a wall could have carried.
      const WALL_MAX_NY = 0.5;
      // ── …AND THE BAND TEST, WHICH IS THE ONE THAT ACTUALLY BITES. Testing only the MEASURED face
      //    normal hid 1 shelf out of 38 in the fungal cave and left the orbs in the frames
      //    (`scen-kind-fungal-room-r4.png` at 538,297 and 602,268), for a reason worth writing down:
      //    the SDF surface carries the rock displacement, so a dome high above the shoulder is still
      //    covered in locally-VERTICAL facets, and a per-triangle normal test happily calls one of
      //    them a wall. Whether a height is WALL or CEILING is a property of the room, not of the
      //    bump you happened to hit — so it is asked of the ANALYTIC ellipsoid, which is smooth. Its
      //    normal at this height is (√(1−yn²)/rx, yn/ry): past 0.5 the room is closing overhead and
      //    nothing mounted there can show rock BEHIND it from a floor-level eye.
      const anx = Math.sqrt(Math.max(0, 1 - yn0 * yn0)) / rx, any = yn0 / ry;
      const bandNy = Math.abs(any) / (Math.hypot(anx, any) || 1);
      const inWallBand = bandNy < WALL_MAX_NY;
      let hit: WallHit | null = null, hx = Math.cos(ang), hz = Math.sin(ang), sawCeiling = !inWallBand;
      for (let k = 0; k < 8 && !hit && inWallBand; k++) {
        const a2 = ang + k * 2.39996;
        const cx2 = Math.cos(a2), cz2 = Math.sin(a2);
        const h2 = wallCast ? wallCast(node, wy, cx2, cz2, maxD) : null;
        if (!h2 || h2.d <= 0.6) continue;
        if (Math.abs(h2.ny) < WALL_MAX_NY) { hit = h2; hx = cx2; hz = cz2; } else sawCeiling = true;
      }
      // ── THE SCONCE (finding 3, second half). `fungiWallCapScale` is aimed at a shelf 8m up, which
      //    has to be big to subtend any angle at all — but it was applied FLAT across the band, so
      //    the shelves at 18% of the dome (head height, right next to the player) came out 2.4×
      //    the size of the ground fungi three metres away and hotter with it: glowing sconces on a
      //    wall, not fungus. The scale now RAMPS with height up the band, so a low shelf is close to
      //    ground scale and only the ones the player has to crane at get the full multiplier.
      //    Canonical is `fungiWallCapScale = 1`, so this evaluates to exactly 1 at every height and
      //    the canonical cap geometry — hence the digest — is untouched.
      const bandT = p.fungiWallSpanFrac > 1e-6
        ? Math.min(1, Math.max(0, (hFrac - p.fungiWallLoFrac) / p.fungiWallSpanFrac)) : 0;
      const wc = 1 + (p.fungiWallCapScale - 1) * (0.25 + 0.75 * bandT);
      const stemH = (0.08 + rand() * 0.1) * wc;
      const m = buildMushroom(stemH, Tuning.CAVE_FUNGI_CAP_MAX_R * (0.4 + rand() * 0.4) * wc, rand);
      if (hit) {
        // Seat the stalk's base INSIDE the rock so there is never a gap at the mount, and grow it
        // along the surface's own inward normal (a full quaternion — a yaw cannot pitch a shelf to
        // lie flush on a sloping wall; see procgen-surface-placement.md), BIASED UPWARD. A bracket
        // fungus that grows dead-normal off a vertical wall presents its cap face-on to anyone
        // standing in the room, so the stem hides behind it and — against unlit rock — the whole
        // thing reads as a glowing ORB stuck to nothing, which is the second half of the critic's
        // "sconce" finding. Up-and-out puts the stem in the silhouette and the cap's underside
        // toward the player, which is what a shelf fungus actually looks like.
        const n = new THREE.Vector3(hit.nx, hit.ny, hit.nz).normalize();
        const grow = n.clone().addScaledVector(new THREE.Vector3(0, 1, 0), 0.55).normalize();
        // HUG THE ROCK. The stalk is sunk most of its own length into the wall, so the cap's rim
        // overlaps the stone's silhouette instead of standing a third of a metre off it. A cap
        // floating clear of a wall in the dark is an ORB whatever is attached to it — the whole
        // point of the shelf read is that you can see the rock it came out of. Position only, so
        // no geometry (and no digest) moves. Sunk far enough that the mount can never show a gap,
        // and NO further: burying the whole stalk trades the orb read for a cap glued flat to the
        // rock, which is the same picture with a different explanation. The stalk keeps ~85% of its
        // length in the room.
        const embed = 0.05 + stemH * 0.15;
        const px = node.x + hx * hit.d - n.x * embed;
        const py = wy - n.y * embed;
        const pz = node.z + hz * hit.d - n.z * embed;
        m.position.set(px, py, pz);
        m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), grow);
        // DECLARE the mount (close-out): the critic found the floating shelves by luck, in a POCKET
        // framing that happened to contain one. A diagnostic must be able to FIND one on purpose —
        // same lesson as `userData.rubbleHeap` in r4, where the shot helper guessed and kept framing
        // stalagmites instead of the feature it existed to prove.
        // …and the cap's own radius, so the `shelf` evidence framing can solve a macro lens for it
        // instead of photographing a 12-pixel dot (close-out round 2, finding N3).
        m.userData.wallShelf = {
          x: px, y: py, z: pz, nx: n.x, ny: n.y, nz: n.z,
          capR: (m.userData.capR as number) ?? Tuning.CAVE_FUNGI_CAP_MAX_R,
        };
      } else {
        // No WALL found on any bearing — do not invent one, and do not settle for a ceiling. (Kept in
        // the scene graph and in `decor` so the mesh set is unchanged; simply not drawn.)
        const wallR = analyticR * 0.96 - 0.05;
        m.position.set(node.x + hx * wallR, wy, node.z + hz * wallR);
        m.visible = false;
        _fungiWallHidden++;
        if (sawCeiling) _fungiWallCeiling++;
      }
      _fungiWallTotal++;
      group.add(m); m.traverse((o) => { if ((o as THREE.Mesh).isMesh) decor.push(o as THREE.Mesh); });
    }
  }
}

// Cave rock — dark, slightly cool stone. Colour comes from baked VERTEX colours (strata bands,
// mineral staining, pooled floor sediment) so ONE program serves the whole cave. White base so the
// vertex colour is the final tint. SPELEOTHEMS + the dais are solid objects seen from OUTSIDE →
// FrontSide, flat-shaded (faceted dripstone).
const _caveSolid = new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true, flatShading: true, side: THREE.FrontSide });
// The cave BODY surface (DEEPER cycle 2 — the only path). ONE watertight mesh, normals wound INTO
// the cavity, so FrontSide is unambiguously correct everywhere (the whole point: no half of the kit
// wound the other way; the shipped shells were wound both ways under one BackSide material and leaked
// 53.6% of eye-height rays).
// DEEPER cycle 3 R1 — SURFACE CHARACTER. Cycle 2 shipped this smooth-shaded and reported the honest
// regression: the shell kit was `flatShading: true` (crisp carved facets) and the smooth SDF surface
// read as a soft brown wash — the flat-shaded dais out-read the whole cavern. R1 tests the direct
// analogue: full flat shading at 0.45m voxels.
const _caveSurface = new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true, flatShading: true, side: THREE.FrontSide });
/** CLOSE-OUT ROUND 2 — RUBBLE BLOCKS ONLY, and the ONLY difference from `_caveSolid` is
 *  `flatShading: false`. See the smooth-normal block in `buildBoulder`: a talus block is 80 facets of
 *  displaced icosahedron, and flat-shading facets that big is what read as knife-edged plates in the
 *  N1 frames. It is a second program in the cave — deliberately, and cheaply: it is compiled only
 *  when a kind actually emits rubble, so the canonical cave (rubblePerChamber 0) never sees it, and
 *  the alternative (detail 2) was measured at +34% triangles on the collapsed shaft. */
const _caveRubble = new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true, flatShading: false, side: THREE.FrontSide });
/** DEEPER cycle 4 — the crevice TOR uses the SAME material (one program, one rock read; the tor's
 *  sun-bleached exterior tone is carried in its vertex colours, not a second shader). */
export const caveSurfaceMaterial = _caveSurface;

// DEEPER cycle 3 R4 — ROCK MICRO-RELIEF, in the shader. R1-R3 established the ceiling: at
// CAVE_SDF_VOXEL = 0.45m the polygonized surface simply CANNOT carry detail below ~1.2m — the third
// displacement octave sits under Nyquist and surface nets smooths it away — so at torch range (the
// player's real read, `scen-*-dark-torch-hall.png`) the wall was a featureless soft-focus blob no
// matter what the SDF did. Halving the voxel was rejected: cycle 1 measured 0.35m at 113.6k tris /
// 1509ms against a streaming budget that is already the campaign's flagged risk, for detail that is
// still only ~0.9m. So the sub-metre read is done as a normal perturbation instead: zero triangles,
// zero collider change (rule 9 stays trivially satisfied — the collider is baked from geometry this
// never touches), no new material program beyond this one, and it works at ANY view distance.
//
// R4 TRIED a sum of directional sine waves (exact analytic gradient, ~7 trig ops — far cheaper than a
// hashed noise). It FAILED visibly and is recorded here so it isn't retried: even domain-warped, six
// waves resolve into oriented ZEBRA BANDING across a large curved surface — the r4 shots read as wood
// grain, not rock. A bump field for rock has to be genuinely isotropic, so R5 uses a hashed 3D value
// noise with a forward-difference gradient. Two octaves at 0.6m and 0.22m — the band between "what
// the 0.45m voxel grid already carries" and "finer than the player can resolve at torch range".
// `uCaveBump` is a uniform so strength is tunable without a second program (D-note: don't compile a
// new shader for something a uniform can do).
// ⚠ PERF: this is ~8 value-noise evaluations (64 hashes) per cave fragment. It is confined to the one
// cave-surface program and rolled off hard with distance, but it is the cycle's one real perf risk
// and is flagged as such rather than assumed free.
// DEEPER cycle 4 — the strength is per-MATERIAL (not one shared uniform object) because the
// crevice tor needs a far weaker perturbation: 1.15 was tuned for torch-lit interior rock at ~2m,
// and on a sunlit exterior under a directional sun the same value reads as violent camouflage
// mottling (round 1: the tor looked leopard-spotted from 13m). `customProgramCacheKey` is the same
// constant on both, so this is still ONE compiled program — a uniform doing a uniform's job.
const _caveBumpU = { value: Tuning.CAVE_ROCK_BUMP_INTERIOR };
_caveSurface.userData.bumpU = _caveBumpU;

// ── DEEPER cycle 7 — THE OUTPUT ENVELOPE + THE CARRIED-LIGHT BOUNCE ─────────────────────────────
// Three GLOBAL uniform objects, shared by every material this patch touches (there is one player, so
// there is one carried light and one depth factor; a per-material copy could only ever disagree).
// `updateCaveAtmosphere` writes them once per frame on the cave's own pause-gated tick — so when the
// game is paused they hold, and when no cave exists they stay at their zero defaults and the shader
// collapses to EXACTLY the shipped cycle-6 response (gain 1, bounce 0).
//
//  · uCaveLitDepth — the live cave-darkness factor, remapped through CAVE_LIT_GAIN_DEPTH0/1. It is
//    the LIT-GAIN's gate: 0 anywhere the sky still reaches (the trench, the ramp, the surface tor),
//    1 in the deep tree. Keeps the descent's falling-light read intact.
//  · uCaveBounce   — xyz = the carried light's world position, w = its bounce intensity (already
//    multiplied by CAVE_BOUNCE_FRAC and by the darkness factor). w = 0 with no light out. THE
//    no-free-light invariant lives in this one number.
const _caveLitDepthU = { value: 0 };
const _caveBounceU = { value: new THREE.Vector4(0, 0, 0, 0) };
const _caveBounceColU = { value: new THREE.Color(Tuning.CAVE_BOUNCE_COLOR_HEX).convertSRGBToLinear() };

/** DEEPER cycle 7 — per-frame publish of the cave-rock light-response uniforms. Called from
 *  `updateCaveAtmosphere` (pause-gated, cave-scoped). `intensity` is the carried light's LIVE
 *  intensity (0 when nothing is lit) and `darkness` the containment factor at the player. */
export function setCaveRockLightState(
  x: number, y: number, z: number, intensity: number, darkness: number,
): void {
  const T = Tuning;
  const t = Math.min(1, Math.max(0,
    (darkness - T.CAVE_LIT_GAIN_DEPTH0) / Math.max(1e-4, T.CAVE_LIT_GAIN_DEPTH1 - T.CAVE_LIT_GAIN_DEPTH0)));
  _caveLitDepthU.value = t * t * (3 - 2 * t);
  // The bounce is gated by the SAME depth factor as the gain: a torch carried down the daylit trench
  // must not paint fill light onto rock the sun is already doing a better job of.
  _caveBounceU.value.set(x, y, z, Math.max(0, intensity) * T.CAVE_BOUNCE_FRAC * _caveLitDepthU.value);
}

/** DEEPER cycle 11 — read back what the rock is actually being told. The G4 canary needs to prove
 *  BOTH directions: a placed lantern feeds the bounce, and with nothing held and no lantern in range
 *  the bounce is EXACTLY zero (no free light). A write-only uniform cannot be asserted on. */
export function getCaveRockLightState(): { x: number; y: number; z: number; bounce: number; litDepth: number } {
  const v = _caveBounceU.value;
  return { x: v.x, y: v.y, z: v.z, bounce: v.w, litDepth: _caveLitDepthU.value };
}

function caveRockBumpPatch(this: THREE.Material, shader: THREE.WebGLProgramParametersWithUniforms): void {
  shader.uniforms.uCaveBump = (this.userData.bumpU as { value: number }) ?? _caveBumpU;
  // Per-material: the crevice TOR is a sunlit exterior and keeps gain 1 (a 4× boost on a
  // directional-sun term is a blown-out white rock, not a legible cave).
  shader.uniforms.uCaveLitGain = (this.userData.litGainU as { value: number }) ?? { value: Tuning.CAVE_LIT_GAIN };
  shader.uniforms.uCaveLitDepth = _caveLitDepthU;
  shader.uniforms.uCaveBounce = _caveBounceU;
  shader.uniforms.uCaveBounceCol = _caveBounceColU;
  shader.vertexShader = 'varying vec3 vCaveWPos;\n' + shader.vertexShader.replace(
    '#include <begin_vertex>',
    '#include <begin_vertex>\n  vCaveWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;',
  );
  shader.fragmentShader = `
    varying vec3 vCaveWPos;
    uniform float uCaveBump;
    uniform float uCaveLitGain;
    uniform float uCaveLitDepth;
    uniform vec4 uCaveBounce;
    uniform vec3 uCaveBounceCol;
    float caveHash(vec3 p) {
      p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
      p *= 17.0;
      return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
    }
    float caveVN(vec3 x) {
      vec3 i = floor(x), f = fract(x);
      f = f * f * (3.0 - 2.0 * f);
      return mix(mix(mix(caveHash(i + vec3(0,0,0)), caveHash(i + vec3(1,0,0)), f.x),
                     mix(caveHash(i + vec3(0,1,0)), caveHash(i + vec3(1,1,0)), f.x), f.y),
                 mix(mix(caveHash(i + vec3(0,0,1)), caveHash(i + vec3(1,0,1)), f.x),
                     mix(caveHash(i + vec3(0,1,1)), caveHash(i + vec3(1,1,1)), f.x), f.y), f.z);
    }
    // DEEPER cycle 7 — FOUR octaves, not two, plus a BEDDING octave.
    //
    // Cycle 3 shipped 0.61m grit over 0.22m tooth. The cycle-7 audit measured the consequence: 89% of
    // the interior's tonal variance survived a 128× downsample, i.e. the rock had exactly ONE visible
    // texture scale — the 0.61m octave, which at torch range subtends 64-128px and reads as LEOPARD
    // SPOTS rather than stone. Two things changed:
    //   · the coarse octave is DEMOTED (0.62 → 0.40) and two finer ones (~9cm, ~4cm-class through the
    //     albedo speckle below) added, so the amplitude spectrum has a slope instead of a spike;
    //   · a compressed-along-Y octave adds ANISOTROPIC BEDDING. Rock in a cave is layered, and layers
    //     are the single strongest "this was deposited and then cut" cue. CAVE_STRATA_SCALE is a
    //     const vector, not a per-cave rotation: the bedding axis is world +Y everywhere, which is
    //     what actual sedimentary strata do, and keeps this seed-free (no determinism surface).
    // Cost: 4 value-noise evaluations per height sample (was 2) x 4 gradient taps = 16 hashes-worth
    // more per fragment. Measured against the shipped shader by cave-audit --only=perf.
    const vec3 CAVE_STRATA_SCALE = vec3(${Tuning.CAVE_ROCK_STRATA_STRETCH.toFixed(4)},
                                        1.0,
                                        ${Tuning.CAVE_ROCK_STRATA_STRETCH.toFixed(4)});
    // PER-OCTAVE anti-alias weights, set once per fragment from the world-space pixel footprint.
    // Cycle 3 faded the WHOLE perturbation by one footprint term, which is wrong in the case that
    // matters most: a wall seen at a grazing angle has a huge footprint even when it is 1m away, so
    // the nearest, largest surface in the frame got the LEAST detail (visible in this cycle's round-4
    // wall-2m shot as a smooth, obviously-polygonal near wall). An octave only aliases once its
    // wavelength approaches the footprint, so each gets its own weight and the big form survives to
    // any range while the grit rolls off where it would sparkle.
    float caveOW1 = 1.0, caveOW2 = 1.0, caveOW3 = 1.0, caveOWS = 1.0;
    // …and the footprint itself is ANISOTROPY-AWARE. length(fwidth(wp)) is the SUM of both screen
    // axes' world-space steps, so a wall seen at a grazing angle — the biggest, nearest surface in a
    // corridor frame — reports a footprint 10-30× a head-on wall at the same distance and loses all
    // of its detail. The compression is along ONE axis only; the other still resolves fine detail.
    // Weighting toward the SMALLER axis keeps grazing walls textured and still rolls everything off
    // at true distance (where both axes grow together).
    float caveFootprint() {
      float fa = length(dFdx(vCaveWPos)), fb = length(dFdy(vCaveWPos));
      return mix(min(fa, fb), max(fa, fb), 0.30);
    }
    float caveRockH(vec3 p) {
      float h = caveVN(p * 1.65) * (${(0.46).toFixed(3)} * caveOW1)
              + caveVN(p * 4.60 + 31.7) * (0.20 * caveOW2)
              + caveVN(p * 11.30 + 7.90) * (0.065 * ${Tuning.CAVE_ROCK_MICRO.toFixed(3)} * caveOW3);
      h += (caveVN(p * CAVE_STRATA_SCALE * ${Tuning.CAVE_ROCK_STRATA_FREQ.toFixed(3)} + 61.3) - 0.5)
           * (${Tuning.CAVE_ROCK_STRATA.toFixed(3)} * caveOWS);
      return h;
    }
    vec3 caveRockGrad(vec3 p) {
      const float E = 0.035;
      float h = caveRockH(p);
      return vec3(caveRockH(p + vec3(E,0.0,0.0)) - h,
                  caveRockH(p + vec3(0.0,E,0.0)) - h,
                  caveRockH(p + vec3(0.0,0.0,E)) - h) / E;
    }
  ` + shader.fragmentShader.replace(
    '#include <normal_fragment_begin>',
    `#include <normal_fragment_begin>
    {
      // Distance fade: past a few metres the finest octaves alias into shimmer, so the perturbation
      // is rolled off by the on-screen world-space footprint. Big forms keep reading at range; the
      // grit only exists where the player can actually resolve it.
      float foot = caveFootprint();
      caveOW1 = 1.0 / (1.0 + foot * 2.0);     // ~0.61m form — survives to any range a player can see
      caveOWS = 1.0 / (1.0 + foot * 7.0);     // ~0.32m bedding relief
      caveOW2 = 1.0 / (1.0 + foot * 9.0);     // ~0.22m tooth
      caveOW3 = 1.0 / (1.0 + foot * 22.0);    // ~0.09m grit — the only octave that can really sparkle
      vec3 gg = caveRockGrad(vCaveWPos) * uCaveBump;
      // DEEPER cycle 7 — SATURATE THE TILT. The raw gradient of a 4-octave field routinely exceeds 3,
      // i.e. a 70°+ normal swing, and once the envelope fix made the rock actually visible that read
      // as a DALMATIAN floor: whole fragments flipped past N·L = 0 into hard black craters with sharp
      // edges (worst under the flashlight). Rock has relief; it does not have pits every 20cm. This is
      // a smooth saturation, not a clamp — small gradients pass through untouched (the micro-tooth
      // survives) and only the tail is compressed, so the surface keeps its texture and loses the
      // craters. CAVE_ROCK_TILT_MAX is the asymptotic tangent-space swing.
      //
      // SHAPE MATTERS. The obvious saturation (M·g/(g+M)) compresses SMALL gradients as hard as large
      // ones, so when the raw field sits above the knee the whole surface collapses to a near-CONSTANT
      // tilt magnitude that only varies in direction — which renders as smooth mud with the polygon
      // facets showing straight through (round 2 of this cycle did exactly that). g·M/sqrt(g²+M²) is
      // near-IDENTITY below the knee and asymptotic above it: the micro-tooth passes through intact
      // and only the crater-making tail is bent.
      vec3 gt = gg - normal * dot(gg, normal);
      float gtl2 = dot(gt, gt);
      gt *= ${Tuning.CAVE_ROCK_TILT_MAX.toFixed(3)}
            * inversesqrt(gtl2 + ${(Tuning.CAVE_ROCK_TILT_MAX * Tuning.CAVE_ROCK_TILT_MAX).toFixed(5)});
      normal = normalize(normal - gt);
    }`,
  ).replace(
    '#include <color_fragment>',
    `#include <color_fragment>
    {
      // MICRO-GRAIN IN THE ALBEDO. One extra noise sample (not four — this is not in the gradient),
      // at ~4cm. The audit's "1px vs 8px stdev ratio is flat" finding is precisely a missing
      // per-pixel term: the normal octaves above give the surface RELIEF, this gives it TOOTH.
      float caveG = caveVN(vCaveWPos * 26.0 + 13.7) - 0.5;
      // BEDDING, IN THE ALBEDO. The normal field carries only a modest strata octave — relief is the
      // wrong channel for layering, and pushing it there is what makes craters. What actually reads as
      // "this rock was DEPOSITED in beds and then cut" is a tonal band: darker/lighter layers stacked
      // along the bedding axis. Same compressed-along-Y noise as the normal octave, sharpened toward
      // its extremes so the layers have EDGES instead of being a soft wash. The vertex colours already
      // carry 7.4m + 2.0m bands (caveVertexColor); this is the ~30cm set that only a per-fragment
      // sample can resolve, and it lands directly in the scale gap the audit's downsample test found.
      float caveSB = caveVN(vCaveWPos * CAVE_STRATA_SCALE * ${Tuning.CAVE_ROCK_STRATA_FREQ.toFixed(3)} + 4.1) - 0.5;
      caveSB = sign(caveSB) * pow(abs(caveSB) * 2.0, 0.65);
      // NEAR-FIELD TOOTH. At 1m every octave above is HUGE on screen — the 4cm speckle covers ~40px —
      // so the surface a player has their face against still has no per-pixel structure. This ~8mm
      // octave supplies it, weighted to die within ~1.5m so it can never sparkle at range. It is the
      // literal answer to the audit's "89% of tonal variance survives a 128x downsample".
      float caveNear = 1.0 / (1.0 + caveFootprint() * 110.0);
      float caveG2 = caveVN(vCaveWPos * 118.0 + 71.3) - 0.5;
      diffuseColor.rgb *= 1.0 + caveG * ${Tuning.CAVE_ROCK_GRAIN.toFixed(3)} * 2.0
                              + caveG2 * ${Tuning.CAVE_ROCK_GRAIN.toFixed(3)} * 1.5 * caveNear
                              + caveSB * ${Tuning.CAVE_ROCK_STRATA_TINT.toFixed(3)};
    }`,
  ).replace(
    '#include <aomap_fragment>',
    `#include <aomap_fragment>
    {
      // ── (1) THE LIT-ROCK ENVELOPE. Multiply the DIRECT term only — the torch/flashlight/lantern
      //    contribution — through a soft shoulder. reflectedLight.indirectDiffuse (ambient, i.e. the
      //    CAVE_DARK_AMBIENT_FLOOR that decides how black unlit rock is) is deliberately untouched,
      //    so this widens the envelope of the LIT read without lifting the dark floor by one code.
      //    Ramped in by depth (uCaveLitDepth) so the daylit trench keeps its shipped response.
      float caveGain = mix(1.0, uCaveLitGain, uCaveLitDepth);
      vec3 caveLit = reflectedLight.directDiffuse * caveGain;
      reflectedLight.directDiffuse = caveLit / (1.0 + caveLit / ${Tuning.CAVE_LIT_WHITE.toFixed(4)});

      // ── (2) CARRIED-LIGHT BOUNCE — the ceiling fix, and the one place "no free light" could be
      //    broken. uCaveBounce.w is the carried light's intensity × CAVE_BOUNCE_FRAC × the depth
      //    factor, so with nothing lit this whole block adds exactly vec3(0). Weighted toward
      //    DOWN-facing rock because floor-bounced light arrives from below — which is the entire
      //    reason ceilings above the torch's 11-12m cutoff currently render at code 1-4.
      if (uCaveBounce.w > 0.0001) {
        vec3 caveWN = normalize((vec4(normal, 0.0) * viewMatrix).xyz);
        float caveBD = length(vCaveWPos - uCaveBounce.xyz);
        float caveCut = clamp(1.0 - pow(caveBD / ${Tuning.CAVE_BOUNCE_DIST_M.toFixed(1)}, 4.0), 0.0, 1.0);
        float caveAtt = caveCut * caveCut
          / (1.0 + (caveBD / ${Tuning.CAVE_BOUNCE_REF_M.toFixed(2)}) * (caveBD / ${Tuning.CAVE_BOUNCE_REF_M.toFixed(2)}));
        float caveFace = mix(1.0 - ${Tuning.CAVE_BOUNCE_UP_BIAS.toFixed(3)}, 1.0,
                             clamp(-caveWN.y, 0.0, 1.0));
        reflectedLight.indirectDiffuse +=
          uCaveBounceCol * (uCaveBounce.w * caveAtt * caveFace) * diffuseColor.rgb;
      }
    }`,
  ).replace(
    '#include <dithering_fragment>',
    `#include <dithering_fragment>
    // ── (3) OUTPUT DITHER, the pool's proven fix applied to the rock (see CAVE_POOL_DITHER). In
    //    OUTPUT space — after tone-map AND sRGB encode — because sRGB's slope near black is ~12×, so
    //    a ±1/255 perturbation added in linear space arrives down here as a dozen levels. At the
    //    interior's ~25-code envelope every 1-level step is a visible Mach band across metres of
    //    wall; interleaved-gradient noise breaks them into film grain.
    //    GATED BY LUMINANCE, which the pool's copy does not need to be: a symmetric ±0.5-level
    //    perturbation applied to a pixel that is EXACTLY 0 is rectified by the clamp (the negative
    //    half floors, the positive half rounds up), so it lifts true black by ~0.3 of a code. On a
    //    water surface that is irrelevant; on a cave whose no-free-light canary is "the fungi-only
    //    frame is black", it is exactly the invariant we are not allowed to spend. The weight is 0
    //    below ~1 code and 1 by ~3, so the dither exists everywhere there is anything to band.
    {
      float caveIgn = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
      float caveOL = dot(gl_FragColor.rgb, vec3(0.2126, 0.7152, 0.0722));
      float caveDW = smoothstep(0.0039, 0.0118, caveOL);
      gl_FragColor.rgb += vec3((caveIgn - 0.5) * (${Tuning.CAVE_ROCK_DITHER.toFixed(3)} / 255.0) * caveDW);
    }`,
  );
}
// DEEPER cycle 7 — THE CAVE BODY IS SMOOTH-SHADED NOW. Cycle 3 R1 chose `flatShading: true` for a
// defensible reason: the smooth SDF surface read as "a soft brown wash" and the flat-shaded dais
// out-read the whole cavern. But that choice was made BEFORE the same cycle's R4/R5 added the shader
// bump — i.e. flat shading was standing in for surface detail the material did not yet have. It now
// has four octaves + bedding + two albedo grain scales, and what flat shading contributes at 0.45m
// voxels is no longer "carved facets" but VISIBLE POLYGONS: the cycle-7 audit's near-wall frames read
// as a greybox because a 0.45m triangle is ~400px at 1m and its edges are sharper than any texture on
// it. Smooth normals + a real bump is the correct division of labour.
//   ⚠ `customProgramCacheKey` OVERRIDES three's default key entirely, so `flatShading` (which the
//   default key WOULD have covered) has to be encoded by hand or the solid kit — still flat-shaded,
//   because a stalagmite genuinely is a faceted dripstone — would silently share this program (D175).
_caveSurface.flatShading = false;
const caveRockKey = (m: THREE.Material): string => 'caveRockBump-v3:' + ((m as THREE.MeshLambertMaterial).flatShading ? 1 : 0);
_caveSurface.onBeforeCompile = caveRockBumpPatch;
_caveSurface.customProgramCacheKey = function (this: THREE.Material): string { return caveRockKey(this); };
// The SOLID kit (speleothems + the egg dais) runs the SAME program — before cycle 7 it was a bare
// Lambert, so it got neither the envelope fix nor the dither and would have read as a different rock
// from the walls it stands against. Its bump is lower (CAVE_SOLID_BUMP): the 0.61m octave is wider
// than a stalagmite.
// DEEPER cycle 7 (entrance round) — the SOLID kit follows the body SMOOTH. The cycle-7 comment above
// kept it flat-shaded on the reasoning that "a stalagmite genuinely is a faceted dripstone", and that
// was true while the body was flat too. Once the body went smooth the kit was the only faceted thing
// in the cave, and the dais + speleothems out-read the cavern as POLYGONS rather than as dripstone —
// A/B'd on `egg-dais` and `gallery`, both seeds. The cache key already encodes `flatShading`, so this
// is one flag and no new program.
_caveSolid.flatShading = false;
_caveSolid.userData.bumpU = { value: Tuning.CAVE_SOLID_BUMP };
_caveSolid.onBeforeCompile = caveRockBumpPatch;
_caveSolid.customProgramCacheKey = function (this: THREE.Material): string { return caveRockKey(this); };

/** A cave-rock surface material with its OWN bump strength (same program, different uniform).
 *  Used by the crevice tor, whose sunlit exterior needs a fraction of the interior's relief — and,
 *  since cycle 7, its own LIT GAIN of 1: the tor stands in the sun, and the interior's 4.2× direct
 *  boost would render it as a white rock. (It is gated by depth as well, so this is belt + braces.) */
export function makeCaveRockMaterial(bump: number, litGain = 1): THREE.MeshLambertMaterial {
  const m = new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true, flatShading: true, side: THREE.FrontSide });
  m.userData.bumpU = { value: bump };
  m.userData.litGainU = { value: litGain };
  m.onBeforeCompile = caveRockBumpPatch;
  m.customProgramCacheKey = function (this: THREE.Material): string { return caveRockKey(this); };
  return m;
}

/** Per-chamber unit directions toward every neighbour (plus, for node 0, back out the entrance).
 *  Used to keep corridor mouths clear of speleothems (cycle 2) and of water pools (cycle 6). One
 *  definition so the two consumers can never disagree about where a mouth is. */
function cornerDirsByNode(graph: CaveGraph, junction: CaveJunction): Map<number, Array<{ x: number; z: number }>> {
  const dirs = new Map<number, Array<{ x: number; z: number }>>();
  const byId = (id: number): CaveNode => graph.nodes[id];
  const push = (id: number, tx: number, tz: number): void => {
    const n = byId(id); const d = Math.hypot(tx - n.x, tz - n.z) || 1;
    let arr = dirs.get(id);
    if (!arr) { arr = []; dirs.set(id, arr); }
    arr.push({ x: (tx - n.x) / d, z: (tz - n.z) / d });
  };
  for (const e of graph.edges) { push(e.a, byId(e.b).x, byId(e.b).z); push(e.b, byId(e.a).x, byId(e.a).z); }
  { const n0 = byId(0); push(0, n0.x - junction.heading.x, n0.z - junction.heading.z); }
  return dirs;
}

/** DEEPER cycle 6 — the PURE water-pool layout for a seed: the exact placement `startSpawnCave`
 *  will use, with no geometry, no collider and no scene. The `pool-fill` gate calls this twice and
 *  diffs the results, so a stray `Math.random` in the placement fails determinism in milliseconds
 *  instead of costing two full cave builds. */
export function cavePoolLayout(
  seed: number, junction: CaveJunction, terrain: Terrain, kind: CaveKind = 'canonical',
): CavePoolSpec[] {
  const p = caveKindParams(kind);
  const graph = generateCaveGraph(seed, junction, terrain, p);
  const cnoise = createNoise3D(makeRng((seed ^ 0xc010a2) >>> 0));
  const prand = makeRng((seed ^ 0x9007e4) >>> 0);
  return placeCavePools(graph, cnoise, prand, cornerDirsByNode(graph, junction), p);
}

export interface CaveGenProbe {
  seed: number;
  /** DEEPER cycle 9 — which KIND built this cave (`canonical` for the origin/egg cave). */
  kind: CaveKind;
  /** The kind's DECLARED gate envelope. The `cave-walk` march asserts chamber count + egg depth
   *  against these instead of the hardcoded 8-11 / 25-40m it carried before kinds existed. The
   *  numbers are declared in the kind table and `assertCaveKindTable` proves each one actually
   *  contains its generator's range — so this is the gate reading an INTENT, not a self-report. */
  envelope: { chambersMin: number; chambersMax: number; depthMin: number; depthMax: number };
  /** Dressing actually emitted (vacuous-pass guards for the kinds gate: a "fungal cavern" with the
   *  canonical fungi count, or a "collapsed shaft" with no rubble, is a table that did not take). */
  fungiClusters: number;
  rubbleHeaps: number;
  scrapAnchors: number;
  /** The kind's drip-interval multiplier, published here so the soundscape can read the wet bias off
   *  the cave the player is standing in without importing the kind table into the audio layer. */
  kindDripScale: number;
  eggId: number;
  depthBelowSurface: number;
  triCount: number;
  /** Triangles actually baked into the Rapier trimesh (rule 9 — identical to the visible set). */
  colliderTris: number;
  /** ms — the Rapier trimesh bake (the streaming-budget number). */
  msCollider: number;
  /** ms — the SDF polygonization (field + nets + normals). */
  msMesh: number;
  /** ms — `makeFloorSampler`'s linear pass over the SDF positions, the one cost the water feature
   *  adds to the ATOMIC dress stage. Measured, not assumed (the cycle-5 hitch-budget lesson). */
  msPoolSampler: number;
  /** CLOSE-OUT — wall-clock of the two real-rock sampler passes (floor grid + wall triangle
   *  buckets) added to the ATOMIC dress stage. Measured, not assumed. */
  msRockSamplers: number;
  /** CLOSE-OUT — wall-shelf fungi placed, and how many found no rock to sit on (hidden, never left
   *  floating). A high hidden fraction means the kind's glow ladder is not being built. */
  fungiWallShelves: number;
  fungiWallHidden: number;
  /** …of the hidden ones, how many found only CEILING at their height (close-out round 2). */
  fungiWallCeiling: number;
  digest: string;
  nodes: Array<{ id: number; x: number; y: number; z: number; rx: number; height: number; kind: CaveNodeKind; parent: number }>;
  edges: Array<{ a: number; b: number; halfW: number; height: number; squeeze: boolean }>;
  tour: number[];
  junction: CaveJunction;
  /** DEEPER cycle 6 — the placed water pools (`y` = the water SURFACE; the floor plane is
   *  CAVE_POOL_DEPTH_M below it). Visual-only geometry: no collider is baked for them. The
   *  `pool-fill` scenario + the determinism check read this. */
  pools: Array<{ node: number; x: number; y: number; z: number; r: number }>;
}

export interface SpawnedCave {
  group: THREE.Group;
  body: RAPIER.RigidBody | null;
  graph: CaveGraph;
  probe: CaveGenProbe;
  /** UNDERWORLD cycle 3 — harvestable fungi clusters (E → alien_fruit). Wired to ctx.caveFungi. */
  fungi: CaveFungiCluster[];
  /** DEEPER cycle 6 — standing water pools. Their `source` records are published into
   *  `ctx.waterSources.list` when the cave becomes resident and removed when it is evicted
   *  (caveStream.ts) — a pool source must never outlive its cave. */
  pools: CavePool[];
  /** World-space top of the egg-chamber dais — where main.ts places the companion egg. */
  eggDaisTop: THREE.Vector3;
  /** World-space floor anchors for the deep loot caches (the hall + the egg chamber, battery-rich). */
  lootAnchors: THREE.Vector3[];
  /** DEEPER cycle 9 — world-space floor points for the kind's loose `scrap` scatter (empty for every
   *  kind but the warren, and ALWAYS empty for canonical). Deliberately ANCHORS, not pickups: this
   *  module has no `GameContext`, and the pickup lifecycle has to be owned by whoever can also
   *  despawn them when the cave is evicted — see the resident sink in caveStream/main. */
  scrapAnchors: THREE.Vector3[];
}

/** DEEPER cycle 5 — a RESUMABLE cave spawn. `step(budgetMs)` advances the build and returns true
 *  when it is complete; `spawnCave` below is the same job driven with an infinite budget, so the
 *  synchronous (boot-preload) and sliced (streamed) paths are the SAME CODE and cannot diverge.
 *
 *  ATOMIC FINALIZE (the terrain-tile precedent, S6/D296): nothing is added to the scene and no
 *  collider exists until the last step, so a half-built cave is never visible and never collidable.
 *  The Rapier trimesh bake and `scene.add` land in the SAME step, so "visible but not solid" cannot
 *  exist for even one frame (rule 9). */
export interface CaveSpawnJob {
  step(budgetMs: number): boolean;
  stage(): string;
  /** The cave's scene graph WHILE IT IS STILL OFF-SCENE. Every mesh — walls, speleothems, fungi,
   *  pool surfaces — is parented by the time the job reaches `finalize`, so this is the complete
   *  material set the renderer will meet the instant `finalize` calls `scene.add`. caveStream uses
   *  it to precompile those programs against the LIVE scene first (see `doWarm` there). Valid from
   *  the `graph` stage on; before that there is no group. */
  object(): THREE.Group;
  /** Valid only once `step` has returned true. */
  result(): SpawnedCave;
}

/** Build + place the generated cave body: one watertight SDF surface + the dressing, one trimesh
 *  collider matching the visual (rule 9). Attaches a `caveGenProbe` on the group.
 *  SYNCHRONOUS driver — the boot preload (main.ts) and every gate use this. */
export function spawnCave(
  scene: THREE.Scene,
  world: RAPIER.World,
  terrain: Terrain,
  junction: CaveJunction,
  seed: number,
  kind: CaveKind = 'canonical',
): SpawnedCave {
  const job = startSpawnCave(scene, world, terrain, junction, seed, kind);
  while (!job.step(Infinity)) { /* run to completion */ }
  return job.result();
}

/** The resumable driver. See `CaveSpawnJob`. */
export function startSpawnCave(
  scene: THREE.Scene,
  world: RAPIER.World,
  terrain: Terrain,
  junction: CaveJunction,
  seed: number,
  /** DEEPER cycle 9 — the cave KIND. Defaults to `canonical`, so the boot preload and every
   *  pre-kinds call site build the exact cave they always did. */
  kind: CaveKind = 'canonical',
): CaveSpawnJob {
  type Stage = 'graph' | 'sdf' | 'dress' | 'finalize' | 'done';
  let stage: Stage = 'graph';
  const kp = caveKindParams(kind);

  let graph!: CaveGraph;
  let cnoise!: Noise3;
  let srand!: () => number;
  let frand!: () => number;
  let group!: THREE.Group;
  let dirsByNode!: Map<number, Array<{ x: number; z: number }>>;
  let fungiSet!: Set<number>;
  let sdfJob: CaveSdfJob | null = null;
  let meshes: THREE.Mesh[] = [];            // baked into the trimesh collider (rule 9)
  let decor: THREE.Mesh[] = [];             // visual-only (small speleothems + fungi; no collider, like scatter)
  let fungi: CaveFungiCluster[] = [];       // UNDERWORLD cycle 3 — harvestable fungi clusters (E -> alien_fruit)
  let pools: CavePool[] = [];               // DEEPER cycle 6 — standing water (visual-only mesh; the FLOOR is the collider)
  let prand!: () => number;                 // pool placement RNG (own stream — never perturbs the others)
  // DEEPER cycle 9 — the kind dressing streams. BOTH are private streams keyed off the cave seed,
  // never `srand`/`frand`/`prand`: a kind that adds rubble must not shift one speleothem of another
  // kind's cave, and canonical (density 0) draws from neither at all.
  let rrand!: () => number;                 // rubble placement RNG
  let scrand!: () => number;                // scrap-anchor RNG
  let rubbleHeaps = 0;
  let scrapAnchors: THREE.Vector3[] = [];
  let msMesh = 0;
  let msRockSamplers = 0;                   // CLOSE-OUT — the two real-rock sampler passes
  let out: SpawnedCave | null = null;
  // VITE_CAVE_SDF_BENCH=1 only — re-polygonizes at the measurement resolutions (cost numbers).
  let benchNoise: Noise3 | null = null;
  let benchDepthY: ((y: number) => number) | null = null;
  let benchSurfaceY: ((x: number, z: number) => number) | null = null;

  const depthOf = (n: CaveNode): number =>
    Math.max(0, Math.min(1, (junction.gy - n.floorY) / Math.max(1, graph.depthBelowSurface)));

  // -- Stage 1: the room graph + the RNG streams (cheap; the layout logic is consumed, never re-derived).
  const doGraph = (): void => {
    graph = generateCaveGraph(seed, junction, terrain, kp);
    const noise3 = createNoise3D(makeRng((seed ^ 0x5eed3d) >>> 0));
    cnoise = createNoise3D(makeRng((seed ^ 0xc010a2) >>> 0));   // colour/dressing noise stream
    srand = makeRng((seed ^ 0x59e1e0) >>> 0);                   // speleothem placement RNG
    frand = makeRng((seed ^ 0xf0091a) >>> 0);                   // fungi placement RNG (own stream)
    prand = makeRng((seed ^ 0x9007e4) >>> 0);                   // DEEPER cycle 6 — pool placement RNG (own stream)
    rrand = makeRng((seed ^ 0xb01de5) >>> 0);                   // DEEPER cycle 9 — rubble (own stream)
    scrand = makeRng((seed ^ 0x5c2a91) >>> 0);                  // DEEPER cycle 9 — scrap anchors (own stream)

    group = new THREE.Group();
    group.name = 'caveGen';
    _fungiWallTotal = 0; _fungiWallHidden = 0; _fungiWallCeiling = 0;   // CLOSE-OUT — wall-shelf anchor accounting
    meshes = []; decor = []; fungi = []; pools = [];
    rubbleHeaps = 0; scrapAnchors = [];

    // Neighbour directions per node (to keep the corridor-mouth sectors clear of speleothems and,
    // since cycle 6, of water pools — shared so both agree on where a mouth is).
    dirsByNode = cornerDirsByNode(graph, junction);

    // Weird mushrooms — seed 2-4 chambers (never every one), the egg + hall favoured (the "distinct
    // landmark" rooms), the rest chosen by rng score. Deterministic (frand stream). Visual-only.
    const fungiTarget = kp.fungiChambersMin
      + Math.floor(frand() * (kp.fungiChambersMax - kp.fungiChambersMin + 1));
    const fungiCandidates = graph.nodes
      .filter((n) => n.kind !== 'entrance')
      .map((n) => ({ id: n.id, score: (n.kind === 'egg' || n.kind === 'hall' ? 1 : 0) + frand() }))
      .sort((a, b) => b.score - a.score);
    fungiSet = new Set(fungiCandidates.slice(0, fungiTarget).map((c) => c.id));

    // -- THE CAVE BODY (DEEPER cycle 2 — the only meshing path). One SDF built from THIS graph,
    //    polygonized once into ONE consistently-wound watertight surface: no shells, no
    //    interpenetration, no carve rims, one material, one winding. The dressing (dais, speleothems,
    //    fungi) is untouched and still rides on the same nodes.
    const depthOfY = (y: number): number =>
      Math.max(0, Math.min(1, (junction.gy - y) / Math.max(1, graph.depthBelowSurface)));
    const surfaceY = (x: number, z: number): number => terrain.pureHeightAt(x, z);
    sdfJob = startCaveSdf(graph, junction, noise3, cnoise, Tuning.CAVE_SDF_VOXEL, depthOfY, surfaceY);
    benchNoise = noise3; benchDepthY = depthOfY; benchSurfaceY = surfaceY;
  };

  // -- Stage 3: the surface mesh + the dressing (dais / speleothems / fungi). Built OFF-SCENE.
  const doDress = (): void => {
    const sdf = sdfJob!.result();
    msMesh = sdf.stats.msTotal;
    const mesh = new THREE.Mesh(sdf.geometry, _caveSurface);
    mesh.name = 'caveSdfSurface';
    mesh.castShadow = false; mesh.receiveShadow = true;
    mesh.userData.caveSdf = true;
    // The cut entrance rim is a DECLARED opening (verify-solid.mjs:268 precedent) — never a loosened
    // gate threshold. Past it lies the throat box, whose own walls bound everything beyond.
    mesh.userData.intendedOpening = { center: sdf.opening.center.clone(), radius: sdf.opening.radius };
    group.add(mesh);
    meshes.push(mesh);
    group.userData.caveSdfStats = sdf.stats;
    if (import.meta.env?.VITE_CAVE_SDF_BENCH === '1') {
      const bench = [sdf.stats];
      for (const v of [0.65, 0.35]) {
        const r = buildCaveSdf(graph, junction, benchNoise!, cnoise, v, benchDepthY!, benchSurfaceY!);
        bench.push(r.stats); r.geometry.dispose();
      }
      bench.sort((a, b) => b.voxel - a.voxel);
      group.userData.caveSdfBench = bench;
      console.log('CAVE-SDF-BENCH ' + JSON.stringify(bench));
    }

    // ── CLOSE-OUT — MEASURE THE ROCK ONCE, BEFORE ANY DRESSING IS SEATED. Two linear passes over
    //    the SDF surface that was just built: a per-chamber floor-height grid and a per-chamber
    //    triangle bucket for wall casts. Everything that touches the cave's surface (rubble,
    //    salvage plates, scrap caches, wall-shelf fungi) is placed against these instead of against
    //    the analytic room. Cost is measured, not assumed — see `msRockSamplers` on the probe.
    const tRock = performance.now();
    const rockFloor = makeRockFloorSampler(sdf.geometry, graph.nodes);
    const wallCast = makeWallCaster(sdf.geometry, graph.nodes);
    msRockSamplers = +(performance.now() - tRock).toFixed(1);

    const heapSpots: Array<{ node: number; x: number; z: number; r: number }> = [];
    for (const node of graph.nodes) {
      const dT = depthOf(node);
      // The egg's central natural pedestal (dais) — collider-bearing (baked into the trimesh).
      if (node.kind === 'egg') {
        const dm = new THREE.Mesh(buildDais(node, cnoise, dT), _caveSolid);
        dm.castShadow = false; dm.receiveShadow = true; dm.userData.eggDais = true;
        group.add(dm); meshes.push(dm);
      }
      addSpeleothems(node, dirsByNode.get(node.id) ?? [], cnoise, dT, srand, group, meshes, decor,
        kp.speleoDensity, kp.speleoColumnScale, kp.speleoDropScale, kp.speleoSolidity, rockFloor);
      // DEEPER cycle 9 — rubble heaps. Density 0 for every kind but the collapsed shaft, and the
      // call is unconditional so the ONE code path is what runs (an `if (kind === …)` here is
      // exactly the branch this cycle exists to avoid). Never in the entrance hall: that room is the
      // hand-off frame and the crevice's walk line, and it is the one room every player crosses.
      if (node.kind !== 'entrance') {
        rubbleHeaps += addRubble(node, kp.rubblePerChamber, dirsByNode.get(node.id) ?? [], cnoise, dT, rrand, group, meshes, kp.rubbleScale, kp.rubbleHeight, heapSpots, kp.salvagePlates, rockFloor);
      }
      if (fungiSet.has(node.id)) addFungi(node, cnoise, frand, group, decor, fungi, kp, wallCast, rockFloor);
    }

    // DEEPER cycle 9 — SCRAP ANCHORS (the warren's salvage). Positions only; the pickups themselves
    // are spawned by the resident sink (see SpawnedCave.scrapAnchors). Never in the egg chamber —
    // that room already carries the objective and the deep cache — and never on the corridor
    // centreline, so a scrap flake can never read as blocking a mouth.
    if (kp.scrapPerCave > 0) {
      // …and never in the ENTRANCE chamber either (cycle-9 look pass). That room sits under the
      // crevice throat with real sky in the frame, so a cache there is lit by daylight and reads as
      // roadside litter at a hole in the ground rather than as salvage somebody carried DOWN. It is
      // also the composed hand-off frame cycle 7 built, and the one room every player crosses.
      const cands = graph.nodes.filter((n) => n.kind !== 'egg' && n.kind !== 'entrance');
      // cycle-9 LOOK PASS — CACHES, not litter. `scrapPerCave` (Zach's number) is unchanged; what
      // changed is that the flakes land in `scrapClusterSize`-sized piles AGAINST A WALL instead of
      // one lone flake per room at a random radius. A single object dropped in the middle of each of
      // six rooms is the visual grammar of scatter; two or three touching, dumped in a corner, is
      // the grammar of somebody having stopped and worked there — which is the whole claim the
      // "salvage warren" makes. Same RNG stream, same total count.
      const caches = Math.round(kp.scrapPerCave / kp.scrapClusterSize);
      // Prefer a corner that already has BROKEN ROCK in it. Two orange flakes alone on a clean floor
      // still read as litter no matter how they are grouped — r3 proved that. Two flakes at the foot
      // of a rubble spill read as a dig. Heaps are drawn from the eligible rooms only, and the fall
      // back to a bare wall spot keeps the count exact when a kind has no rubble at all.
      const okHeaps = heapSpots.filter((h) => cands.some((n) => n.id === h.node));
      for (let i = 0; i < caches && cands.length; i++) {
        const useHeap = okHeaps.length > 0 && scrand() < 0.8;
        let n: CaveNode, cxp: number, czp: number;
        if (useHeap) {
          const h = okHeaps[Math.floor(scrand() * okHeaps.length)];
          n = graph.nodes.find((q) => q.id === h.node)!;
          // Just off the heap, on the room-centre side, so the flakes sit at its foot in the open.
          let dx = n.x - h.x, dz = n.z - h.z;
          const dl = Math.hypot(dx, dz) || 1; dx /= dl; dz /= dl;
          const off = h.r + 0.55 + scrand() * 0.5;
          cxp = h.x + dx * off; czp = h.z + dz * off;
        } else {
          n = cands[Math.floor(scrand() * cands.length)];
          const ang = scrand() * Math.PI * 2;
          const fr = 0.62 + scrand() * 0.22;                 // out by the wall, off the walk line
          cxp = n.x + Math.cos(ang) * n.rx * fr; czp = n.z + Math.sin(ang) * n.rx * fr;
        }
        for (let k = 0; k < kp.scrapClusterSize; k++) {
          const ja = scrand() * Math.PI * 2, jr = 0.18 + scrand() * 0.45;
          const sx = cxp + Math.cos(ja) * jr, sz = czp + Math.sin(ja) * jr;
          // CLOSE-OUT: the flake sits on the ROCK, not on the nominal plane plus a noise guess.
          const sy = rockFloor(sx, sz, n.floorY + Math.max(0, cnoise(sx * 0.5, 7.3, sz * 0.5)) * Tuning.CAVE_GEN_FLOOR_BUMP) + 0.02;
          scrapAnchors.push(new THREE.Vector3(sx, sy, sz));
        }
      }
    }

    // DEEPER cycle 7 — THE ARRIVAL CUE. `addFungi` deliberately skips the entrance chamber, so the
    // hand-off frame (step out of the crevice slot into the first room) had nothing lit in it at all
    // — the room is authored, but 2-3 stops under visibility, and the player's first look into the
    // cave is a black wall. Fixed the way the cave's own breadcrumb design already works: ONE
    // guaranteed bioluminescent cluster against the entrance chamber's wall, ~5-7m from the hand-off
    // and off the arrival axis so it reads as something to walk TOWARD. NO new light source — the
    // caps are emissive geometry, so the "no free light / torch is survival gear" rule is intact.
    // Its own rand stream (never `frand`), so every other chamber's fungi are byte-identical.
    {
      const arrival = graph.nodes[0];
      const arand = makeRng((seed ^ 0xa77111) >>> 0);
      let ux = arrival.x - junction.x, uz = arrival.z - junction.z;
      const ul = Math.hypot(ux, uz) || 1; ux /= ul; uz /= ul;
      const side = (seed & 2) === 0 ? 1 : -1;
      const lat = arrival.rx * (0.48 + arand() * 0.16) * side;
      const fx = junction.x + ux * ul * 0.86 + -uz * lat;
      const fz = junction.z + uz * ul * 0.86 + ux * lat;
      const fy = arrival.floorY + Math.max(0, cnoise(fx * 0.5, 7.3, fz * 0.5)) * Tuning.CAVE_GEN_FLOOR_BUMP;
      const cl = buildFungiCluster(arand, 0.35 * kp.fungiCapScale, kp.fungiPerCluster, kp.fungiCapScale);
      cl.position.set(fx, fy, fz);
      for (const o of cl.children) o.traverse((m) => { (m as THREE.Mesh).receiveShadow = true; });
      group.add(cl); cl.traverse((o) => { if ((o as THREE.Mesh).isMesh) decor.push(o as THREE.Mesh); });
      const cid = _fungiId++;
      tagFungi(cl, cid);
      fungi.push({ id: cid, group: cl, pos: new THREE.Vector3(fx, fy, fz), harvested: false, hovered: false });
    }

    // DEEPER cycle 6 — STANDING WATER. Pools go in `decor`, NOT `meshes`: the water surface is
    // never baked into the trimesh collider. What you wade on is the SDF floor visible through it
    // (rule 9 — see cavePools.ts). They still ride the determinism digest below, so a pool that
    // moved between two builds of the same seed fails the cave-walk gate like any other drift.
    // The SDF geometry goes in so the water can measure the REAL rock height under it and cut its
    // shoreline on the stone (cavePools.makeFloorSampler) — one linear pass over the positions.
    const poolBuild = buildCavePools(graph, cnoise, prand, dirsByNode, sdf.geometry, kp);
    pools = poolBuild.pools;
    for (const p of pools) { group.add(p.mesh); decor.push(p.mesh); }

    // DEEPER cycle 6, round 12 — WHAT THE WATER MIRRORS. The pools had zero environmental reflection:
    // bioluminescent caps standing AT a waterline showed nothing in the water beside them. A planar
    // render-target mirror is unaffordable here (a second scene pass per pool inside the streaming
    // budget), so the cave's emissive features are published ONCE, right here, into K shader uniform
    // slots and evaluated as mirror sources in the water's own specular lobe (cavePools.ts). Per-frame
    // cost is nil — this is build-time data. The fungi list is already seed-pure and already built by
    // the loop above, so no new RNG draw and no new placement rule enters the determinism digest.
    //
    // ROUND-13: the slots live on THIS CAVE'S OWN material instance (`poolBuild.material`), never on
    // a module-shared one. With CAVE_RESIDENT_MAX = 3 the shared version meant the second cave to
    // build stole the first one's reflections — including from the cave the player was standing in.
    const capCol = new THREE.Color(Tuning.CAVE_FUNGI_EMISSIVE_HEX);
    setCavePoolEmitters(
      poolBuild.material,
      fungi.map((f) => ({
        x: f.pos.x, y: f.pos.y + Tuning.CAVE_POOL_GLINT_CAP_Y, z: f.pos.z,
        intensity: Tuning.CAVE_FUNGI_EMISSIVE_INT, color: capCol,
      })),
      pools.map((p) => p.spec),
    );
  };

  // -- Stage 4: FINALIZE, atomic. ONE trimesh collider baked from the EXACT visual triangles (rule 9):
  //    the SDF body surface, the dais + the player-scale (collider-bearing) speleothems in `meshes`.
  //    Small decor speleothems are visual-only (no collider, like scatter). Meshes are world-space
  //    (identity group) -> body at origin. The bake is TIMED and reported (`msCollider`): at ~68k body
  //    triangles it is the streaming budget's one INDIVISIBLE cost, so it is measured, not assumed.
  const doFinalize = (): void => {
    const tCol = performance.now();
    const body = makeStaticTrimesh(world, meshes, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0, w: 1 }, new THREE.Matrix4());
    const msCollider = +(performance.now() - tCol).toFixed(1);
    scene.add(group);

    // Triangle count (perf report) — the full visual set incl. decor.
    const allMeshes = meshes.concat(decor);
    let triCount = 0;
    for (const m of allMeshes) triCount += (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3;

    // Collider triangle count = exactly what was baked (rule 9: collision IS the visible geometry).
    let colliderTris = 0;
    for (const m of meshes) colliderTris += (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3;

    const probe: CaveGenProbe = {
      seed,
      kind,
      envelope: {
        chambersMin: kp.gateChambersMin, chambersMax: kp.gateChambersMax,
        depthMin: kp.gateDepthMin, depthMax: kp.gateDepthMax,
      },
      fungiClusters: fungi.length, rubbleHeaps, scrapAnchors: scrapAnchors.length,
      fungiWallShelves: _fungiWallTotal, fungiWallHidden: _fungiWallHidden, fungiWallCeiling: _fungiWallCeiling,
      kindDripScale: kp.dripIntervalScale,
      eggId: graph.eggId, depthBelowSurface: graph.depthBelowSurface, triCount,
      colliderTris, msCollider, msMesh, msPoolSampler: lastFloorSamplerMs, msRockSamplers,
      digest: caveDigest(graph, allMeshes),
      nodes: graph.nodes.map((n) => ({ id: n.id, x: n.x, y: n.floorY, z: n.z, rx: n.rx, height: n.height, kind: n.kind, parent: n.parent })),
      edges: graph.edges.map((e) => ({ a: e.a, b: e.b, halfW: e.halfW, height: e.height, squeeze: e.squeeze })),
      tour: graph.tour,
      junction,
      pools: pools.map((p) => ({
        node: p.spec.nodeId,
        x: +p.spec.x.toFixed(3), y: +p.spec.waterY.toFixed(3), z: +p.spec.z.toFixed(3),
        r: +p.spec.radius.toFixed(3),
      })),
    };
    group.userData.caveGenProbe = probe;

    // UNDERWORLD cycle 3 — egg dais top (where main.ts sets the companion egg) + deep loot-cache
    // anchors. The egg chamber's dais rises 0.9m (buildDais H); the egg centre sits on top. Loot
    // caches go on the floor of the egg chamber + the big hall (+ the deepest pocket if any) — the
    // deepest, most dangerous rooms, so the cave EARNS its danger (battery-rich, per scarcity design).
    const eggNode = graph.nodes[graph.eggId];
    const eggDaisTop = new THREE.Vector3(eggNode.x, eggNode.floorY + 0.9 + 0.23, eggNode.z);
    const lootAnchors: THREE.Vector3[] = [];
    const floorAnchor = (n: CaveNode, frac: number, angOff: number): THREE.Vector3 => {
      // A deterministic floor point offset from the chamber centre (clear of the central dais / mouths).
      const ang = (n.id * 1.7 + angOff);
      return new THREE.Vector3(n.x + Math.cos(ang) * n.rx * frac, n.floorY + 0.02, n.z + Math.sin(ang) * n.rx * frac);
    };
    lootAnchors.push(floorAnchor(eggNode, 0.6, 0));                       // egg chamber (deepest)
    const hallNode = graph.nodes.find((n) => n.kind === 'hall');
    if (hallNode) lootAnchors.push(floorAnchor(hallNode, 0.55, 1.3));     // the big gallery
    const pockets = graph.nodes.filter((n) => n.kind === 'pocket').sort((a, b) => a.floorY - b.floorY);
    if (pockets.length) lootAnchors.push(floorAnchor(pockets[0], 0.5, 2.1));  // the deepest side pocket

    out = { group, body, graph, probe, fungi, pools, eggDaisTop, lootAnchors, scrapAnchors };
  };

  const step = (budgetMs: number): boolean => {
    const sliced = budgetMs !== Infinity;
    const deadline = sliced ? performance.now() + budgetMs : Infinity;
    while (stage !== 'done') {
      if (stage === 'graph') { doGraph(); stage = 'sdf'; }
      // DEEPER cycle 7 — HAND EACH ATOMIC STAGE ITS OWN FRAME. The deadline is only checked at the
      // BOTTOM of this loop, so when the SDF job happened to finish with budget left over, the loop
      // fell straight through and ran `dress` (and sometimes `finalize`) in the SAME call. Two
      // consequences, both bad: the real frame cost was sdf-tail + dress + bake stacked into one
      // hitch, and — because caveStream attributes a step to the stage it ENTERED at — that atomic
      // cost was booked against the DIVISIBLE slice budget, where it is invisible next to the
      // separately-reported atomic number. Cycle 7's heavier speleothem kit made that leak visible:
      // the chunk-perf gate's divisible slice went 16.1ms → 22.2ms (tripwire 20) while the atomic
      // number barely moved, which reads as "the SDF slicing regressed" and is not what happened.
      // Breaking after the SDF completes keeps each indivisible stage on its own frame, so the two
      // budgets measure what they claim to. `sliced` guards the SYNC preload path (step(Infinity)),
      // which is driven by a `while (!job.step(Infinity))` loop and so is correct either way.
      else if (stage === 'sdf') { if (!sdfJob!.step(budgetMs)) return false; stage = 'dress'; if (sliced) break; }
      else if (stage === 'dress') { doDress(); stage = 'finalize'; if (sliced) break; }
      else if (stage === 'finalize') { doFinalize(); stage = 'done'; }
      if (performance.now() >= deadline) break;
    }
    return stage === 'done';
  };

  return {
    step,
    // The SDF sub-stage is exposed (`sdf:field`, `sdf:geom`, …) so the scheduler can classify a step
    // as DIVISIBLE (budgetable) or INDIVISIBLE (`sdf:geom` = computeVertexNormals, `dress`, and
    // `finalize` = the Rapier trimesh bake). Reporting one blended "slice" number would let a 90ms
    // atomic bake hide inside the slice budget.
    stage: () => (stage === 'sdf' && sdfJob ? `sdf:${sdfJob.stage()}` : stage),
    object: () => group,
    result: () => {
      if (!out) throw new Error('caveGen: result() before the spawn completed');
      return out;
    },
  };
}

/** Determinism digest: FNV-1a over the graph (rounded node/edge fields + egg) AND a checksum of
 *  every cave-mesh vertex (rounded to 1cm). Same seed → identical; different seeds → different. */
function caveDigest(graph: CaveGraph, meshes: THREE.Mesh[]): string {
  let h = 0x811c9dc5 >>> 0;
  const mix = (n: number): void => { h = Math.imul(h ^ (n & 0xffffffff), 0x01000193) >>> 0; };
  const r2 = (v: number): number => Math.round(v * 100);
  for (const n of graph.nodes) {
    mix(n.id); mix(r2(n.x)); mix(r2(n.floorY)); mix(r2(n.z)); mix(r2(n.rx)); mix(r2(n.height));
    mix(n.parent); mix(n.kind.charCodeAt(0));
  }
  for (const e of graph.edges) { mix(e.a); mix(e.b); mix(r2(e.halfW)); mix(r2(e.height)); mix(e.squeeze ? 1 : 0); }
  mix(graph.eggId);
  for (const m of meshes) {
    const p = m.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) { mix(r2(p.getX(i))); mix(r2(p.getY(i))); mix(r2(p.getZ(i))); }
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}
