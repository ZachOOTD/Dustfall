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

export function generateCaveGraph(seed: number, junction: CaveJunction, terrain: Terrain): CaveGraph {
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
  const trunkSteps = T.CAVE_GEN_TRUNK_STEPS_MIN
    + Math.floor(rand() * (T.CAVE_GEN_TRUNK_STEPS_MAX - T.CAVE_GEN_TRUNK_STEPS_MIN + 1));
  const totalChambers = T.CAVE_GEN_CHAMBERS_MIN
    + Math.floor(rand() * (T.CAVE_GEN_CHAMBERS_MAX - T.CAVE_GEN_CHAMBERS_MIN + 1));
  const eggDepth = lerp(T.CAVE_GEN_DEPTH_MIN, T.CAVE_GEN_DEPTH_MAX, rand());
  const entranceDepth = junction.gy - junction.y;             // ~12m
  const trunkDescent = Math.max(6, eggDepth - entranceDepth);
  const perDrop = trunkDescent / trunkSteps;
  const slopeTarget = ((T.CAVE_GEN_MAX_SLOPE - 2) * Math.PI) / 180;
  const tanSlope = Math.tan(slopeTarget);
  const hallIndex = trunkSteps - 1;                          // the big gallery sits just before the egg
  // Centre-to-centre run for a corridor. The floor ramps ONLY over the CLEAR span between the two
  // chamber shells (the tube floor stays flat = the chamber floor across each chamber's flat-floor
  // disk — buildCorridorGeometry — so the corridor never steps off the disk into a cliff). So size
  // the run for the CLEAR span (centreDist − raRx − rbRx ≥ drop/tan(target)); the chamber radii add
  // on top. Jitter only lengthens (flatter, never steeper).
  const runFor = (raRx: number, rbRx: number, drop: number): number => {
    const clearSpan = Math.max(T.CAVE_GEN_CORRIDOR_RUN_MIN, drop / tanSlope) * (1 + rand() * 0.25);
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
    const rx = isEgg ? T.CAVE_GEN_EGG_RX
      : isHall ? T.CAVE_GEN_HALL_RX
        : lerp(T.CAVE_GEN_POCKET_RX_MAX - 0.4, T.CAVE_GEN_POCKET_RX_MAX + 1.2, rand());
    const height = isEgg ? T.CAVE_GEN_EGG_H
      : isHall ? T.CAVE_GEN_HALL_H
        : lerp(T.CAVE_GEN_POCKET_H_MIN + 0.6, T.CAVE_GEN_POCKET_H_MAX, rand());
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
    edges.push(makeEdge(prev, node, rand));
    prev = node;
  }

  // Force the trunk to have BOTH a wide gallery (the entry corridor) and a squeeze (right after)
  // so the player meets varied cross-sections early — the rest stay as rolled.
  if (edges.length >= 1) { edges[0].squeeze = false; edges[0].halfW = T.CAVE_GEN_GALLERY_HALF_W; edges[0].height = T.CAVE_GEN_GALLERY_H; }
  if (edges.length >= 2) { edges[1].squeeze = true; edges[1].halfW = T.CAVE_GEN_SQUEEZE_HALF_W; edges[1].height = T.CAVE_GEN_SQUEEZE_H; }

  const eggId = nodes.length - 1;

  // Side pockets — branch sideways off non-egg nodes until the count lands in range.
  let attempts = 0;
  while (nodes.length < totalChambers && attempts < 120) {
    attempts++;
    // Branch off deeper chambers only (never the shallow entrance) so pockets inherit real cover —
    // a branch off the ~12m-deep entrance can poke through a nearby dune valley.
    const candidates = nodes.filter((n) => n.kind !== 'egg' && n.kind !== 'entrance');
    const parent = candidates[Math.floor(rand() * candidates.length)];
    const side = rand() < 0.5 ? 1 : -1;
    const ang = side * ((60 + rand() * 50) * Math.PI) / 180;   // roughly perpendicular to the trunk
    const c = Math.cos(ang), sn = Math.sin(ang);
    const bhx = parent.hx * c - parent.hz * sn, bhz = parent.hx * sn + parent.hz * c;
    const drop = rand() * T.CAVE_GEN_BRANCH_DROP_MAX;
    const rx = lerp(T.CAVE_GEN_POCKET_RX_MIN, T.CAVE_GEN_POCKET_RX_MAX, rand());
    const height = lerp(T.CAVE_GEN_POCKET_H_MIN, T.CAVE_GEN_POCKET_H_MAX, rand());
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
    if (tooClose(node, nodes, parent.id)) continue;           // reject chamber overlap
    if (corridorCrowds(parent, node, nodes, edges)) continue; // reject crossing/crowding corridors
    nodes.push(node);
    edges.push(makeEdge(parent, node, rand));
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
  if (import.meta.env?.DEV) assertCaveTraversable(nodes, edges);

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
function assertCaveTraversable(nodes: CaveNode[], edges: CaveEdge[]): void {
  const T = Tuning;
  const slopeCeil = T.CAVE_GEN_MAX_SLOPE + 4;   // ° — +margin for local floor displacement
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

function makeEdge(a: CaveNode, b: CaveNode, rand: () => number): CaveEdge {
  const squeeze = rand() < Tuning.CAVE_GEN_SQUEEZE_CHANCE;
  return {
    a: a.id, b: b.id,
    halfW: squeeze ? Tuning.CAVE_GEN_SQUEEZE_HALF_W : Tuning.CAVE_GEN_GALLERY_HALF_W,
    height: squeeze ? Tuning.CAVE_GEN_SQUEEZE_H : Tuning.CAVE_GEN_GALLERY_H,
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
function corridorCrowds(parent: CaveNode, node: CaveNode, nodes: CaveNode[], edges: CaveEdge[]): boolean {
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
    if (d < m.rx + T.CAVE_GEN_GALLERY_HALF_W + T.CAVE_GEN_CORRIDOR_CLEARANCE) return true;
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
    const wSum = T.CAVE_GEN_GALLERY_HALF_W + e.halfW + T.CAVE_GEN_CORRIDOR_CLEARANCE;
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
  const baseR = Math.min(node.rx * 0.34, 3.4);
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

/** A single speleothem cone (stalactite hanging DOWN from `apexY` a length `len`, or stalagmite/
 *  column rising UP from the floor). `up` = +1 rises from base, −1 hangs from apex. Slightly bent +
 *  fluted (noise per ring) so it reads as dripstone, not a party hat. Solid (rule 7). WORLD space. */
function buildSpeleothem(
  x: number, z: number, baseY: number, topY: number, r0: number,
  cnoise: Noise3, depthT: number, hangDown: boolean, bendScale: number,
): THREE.BufferGeometry {
  const RINGS = 6, SEGS = 8;
  const stride = SEGS + 1;
  const H = topY - baseY;                  // signed (hang: topY<baseY)
  const pos = new Float32Array((RINGS + 1) * stride * 3 + 3);
  const col = new Float32Array((RINGS + 1) * stride * 3 + 3);
  const bendA = cnoise(x * 0.3, 9.1, z * 0.3) * 0.5 * bendScale, bendB = cnoise(x * 0.3 + 4, 9.1, z * 0.3) * 0.5 * bendScale;
  let vi = 0;
  for (let i = 0; i <= RINGS; i++) {
    const t = i / RINGS;                   // 0 base → 1 tip
    const rr = r0 * (1 - t) * (0.85 + cnoise(t * 6, x, z) * 0.15) + 0.02;
    const yy = baseY + H * t;
    const bx = x + bendA * t * t * 1.6, bz = z + bendB * t * t * 1.6;   // gentle taper-bend
    for (let j = 0; j <= SEGS; j++) {
      const ph = (j / SEGS) * Math.PI * 2;
      const flute = 1 + cnoise(Math.cos(ph) * 3, i * 1.7, Math.sin(ph) * 3) * 0.22;   // fluted ridges
      const wx = bx + Math.cos(ph) * rr * flute;
      const wz = bz + Math.sin(ph) * rr * flute;
      pos[vi * 3] = wx; pos[vi * 3 + 1] = yy; pos[vi * 3 + 2] = wz;
      caveVertexColor(hangDown ? 'ceiling' : 'floor', wx, yy, wz, depthT, cnoise, _tmpCol);
      col[vi * 3] = _tmpCol.r; col[vi * 3 + 1] = _tmpCol.g; col[vi * 3 + 2] = _tmpCol.b;
      vi++;
    }
  }
  // tip vertex
  const tipX = x + bendA * 1.6, tipZ = z + bendB * 1.6;
  pos[vi * 3] = tipX; pos[vi * 3 + 1] = topY; pos[vi * 3 + 2] = tipZ;
  caveVertexColor(hangDown ? 'ceiling' : 'floor', tipX, topY, tipZ, depthT, cnoise, _tmpCol);
  col[vi * 3] = _tmpCol.r; col[vi * 3 + 1] = _tmpCol.g; col[vi * 3 + 2] = _tmpCol.b;
  const tip = vi; vi++;
  const idx: number[] = [];
  for (let i = 0; i < RINGS; i++) {
    for (let j = 0; j < SEGS; j++) {
      const p0 = i * stride + j, p1 = p0 + 1, p2 = (i + 1) * stride + j, p3 = p2 + 1;
      idx.push(p0, p2, p1, p1, p2, p3);
    }
  }
  for (let j = 0; j < SEGS; j++) { const p0 = RINGS * stride + j; idx.push(p0, tip, p0 + 1); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
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
): void {
  const T = Tuning;
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
  const nStalag = kind === 'egg' ? 5 : kind === 'hall' ? 4 : kind === 'entrance' ? 0 : rx > 3.6 ? 2 : 1;
  const nColumn = kind === 'egg' ? 2 : kind === 'hall' ? 1 : 0;
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
      const geo = buildSpeleothem(x, z, floorY - 0.15, topY, baseR, cnoise, depthT, false, bend);
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
  const nSmall = Math.round((kind === 'entrance' ? 1 : rx > 4 ? 4 : 2) * dens * 2);
  for (let i = 0; i < nSmall; i++) {
    for (let a = 0; a < 12; a++) {
      const ang = rand() * Math.PI * 2, ux = Math.cos(ang), uz = Math.sin(ang);
      const fr = lerp(0.55, 0.94, rand());
      const x = node.x + ux * rx * fr, z = node.z + uz * rx * fr;
      const baseR = 0.15 + rand() * 0.22;
      if (!clearOfMouth(ux, uz) || !floorOk(x, z, baseR)) continue;
      const geo = buildSpeleothem(x, z, floorY - 0.1, floorY + 0.35 + rand() * 0.7, baseR, cnoise, depthT, false, 0.9);
      const m = new THREE.Mesh(geo, _caveSolid); m.receiveShadow = true;
      group.add(m); decor.push(m); placed.push({ x, z, r: baseR });
      break;
    }
  }

  // ── Ceiling stalactites (visual-only; tips kept ≥ CLEAR above the floor). ──
  const nTip = kind === 'egg' ? 22 : kind === 'hall' ? 16 : kind === 'entrance' ? 4 : 9;
  for (let i = 0; i < nTip; i++) {
    const ang = rand() * Math.PI * 2, ux = Math.cos(ang), uz = Math.sin(ang);
    const fr = Math.sqrt(rand()) * 0.86;                            // bias toward the walls where drips cluster
    const x = node.x + ux * rx * fr, z = node.z + uz * rx * fr;
    const apexY = ceilAt(fr) - 0.05;
    const maxLen = apexY - (floorY + T.CAVE_SPELEO_STALACTITE_CLEAR);
    if (maxLen < 0.4) continue;
    const big = i < nTip * 0.35;
    const len = Math.min(big ? 1.0 + rand() * 2.2 : 0.35 + rand() * 0.9, maxLen * 0.92);
    const baseR = big ? 0.28 + rand() * 0.32 : 0.12 + rand() * 0.18;
    const geo = buildSpeleothem(x, z, apexY, apexY - len, baseR, cnoise, depthT, true, 1.0);
    const m = new THREE.Mesh(geo, _caveSolid); m.receiveShadow = true;
    group.add(m); decor.push(m);
  }
}

// ── Weird mushrooms (the life accent) ────────────────────────────────────────

// Pale bone-cream stalk (lit by the torch when the player is near) + a faintly cool-bioluminescent
// cap. The cap's LOW emissive renders even in pitch black (a navigation breadcrumb + eerie accent),
// but toneMapped keeps it from blowing out so DARKNESS still dominates — these are NOT lamps. Shared
// materials → one program for every fungus. Solid primitives (rule 7 — cylinders/spheres are thick).
const _fungiStalk = new THREE.MeshStandardMaterial({ color: Tuning.CAVE_FUNGI_STALK_HEX, roughness: 0.9, metalness: 0.0, flatShading: true });
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
  const stalk = new THREE.Mesh(new THREE.CylinderGeometry(stalkR * 0.8, stalkR, h, 6), _fungiStalk);
  stalk.position.y = h * 0.5;
  stalk.rotation.z = bend * 0.6;
  grp.add(stalk);
  // Cap — a squashed hemisphere dome sitting on the stalk top (glowing underside + top).
  const cap = new THREE.Mesh(new THREE.SphereGeometry(capR, 10, 7, 0, Math.PI * 2, 0, Math.PI * 0.62), _fungiCap);
  cap.scale.set(1, 0.72 + rand() * 0.2, 1);
  cap.position.set(Math.sin(bend) * h * 0.5, h - capR * 0.15, 0);
  grp.add(cap);
  grp.traverse((o) => { const mm = o as THREE.Mesh; if (mm.isMesh) mm.receiveShadow = true; });
  return grp;
}

/** A cluster of 2..MAX mushrooms of varied height crowded within ~`spread` of a point. */
function buildFungiCluster(rand: () => number, spread: number): THREE.Group {
  const cl = new THREE.Group();
  const n = 2 + Math.floor(rand() * (Tuning.CAVE_FUNGI_PER_CLUSTER_MAX - 1));
  for (let i = 0; i < n; i++) {
    const capR = Tuning.CAVE_FUNGI_CAP_MAX_R * (0.42 + rand() * 0.58);
    const h = capR * (2.2 + rand() * 3.4);
    const m = buildMushroom(h, capR, rand);
    const a = rand() * Math.PI * 2, rr = rand() * spread;
    m.position.set(Math.cos(a) * rr, 0, Math.sin(a) * rr);
    m.rotation.y = rand() * Math.PI * 2;
    cl.add(m);
  }
  return cl;
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

function tagFungi(root: THREE.Object3D, id: number): void {
  root.traverse((o) => { o.userData.interactType = 'harvest'; o.userData.interactId = id; o.userData.interactRegistry = 'caveFungi'; });
}

/** Seed the chosen chamber with sparse fungi clusters: floor clusters at mid radii (near the walls
 *  / floor dips) + optional shelf fungi on the wall. Floor clusters are HARVESTABLE (tagged +
 *  recorded); wall-shelf fungi stay pure decor. No colliders — never trips the walk/collision gates.
 *  Deterministic via the passed rng stream. */
function addFungi(node: CaveNode, cnoise: Noise3, rand: () => number, group: THREE.Group, decor: THREE.Mesh[], clusters: CaveFungiCluster[]): void {
  const rx = node.rx, floorY = node.floorY;
  const nClusters = Tuning.CAVE_FUNGI_CLUSTER_MIN
    + Math.floor(rand() * (Tuning.CAVE_FUNGI_CLUSTER_MAX - Tuning.CAVE_FUNGI_CLUSTER_MIN + 1));
  for (let c = 0; c < nClusters; c++) {
    const ang = rand() * Math.PI * 2;
    const fr = 0.45 + rand() * 0.42;                    // mid → outer floor (toward the walls)
    const x = node.x + Math.cos(ang) * rx * fr, z = node.z + Math.sin(ang) * rx * fr;
    // Sit on the actual bumpy floor (matches the mesh floor micro-bump).
    const fy = floorY + Math.max(0, cnoise(x * 0.5, 7.3, z * 0.5)) * Tuning.CAVE_GEN_FLOOR_BUMP;
    const cl = buildFungiCluster(rand, 0.35);
    cl.position.set(x, fy, z);
    for (const o of cl.children) o.traverse((m) => { (m as THREE.Mesh).receiveShadow = true; });
    group.add(cl); cl.traverse((o) => { if ((o as THREE.Mesh).isMesh) decor.push(o as THREE.Mesh); });
    // HARVESTABLE — tag the cluster + record it (E → alien_fruit). The dais/egg chamber is a rich
    // spot; every seeded floor cluster is pickable.
    const cid = _fungiId++;
    tagFungi(cl, cid);
    clusters.push({ id: cid, group: cl, pos: new THREE.Vector3(x, fy, z), harvested: false, hovered: false });
  }
  // Optional wall shelf fungi — a few small caps jutting horizontally from the wall at head height.
  if (rand() < Tuning.CAVE_FUNGI_WALL_CHANCE) {
    const ry = node.height * 0.6, cyc = floorY + node.height - ry;
    const shelves = 2 + Math.floor(rand() * 3);
    for (let s = 0; s < shelves; s++) {
      const ang = rand() * Math.PI * 2, ux = Math.cos(ang), uz = Math.sin(ang);
      const hFrac = 0.28 + rand() * 0.34;               // fraction up the wall
      const wy = floorY + node.height * hFrac;
      // approx shell radius at this height on the ellipsoid (relative to the vertical centre)
      const yn = Math.max(-0.98, Math.min(0.98, (wy - cyc) / ry));
      const wallR = rx * Math.sqrt(Math.max(0.02, 1 - yn * yn)) - 0.05;
      const x = node.x + ux * wallR, z = node.z + uz * wallR;
      const m = buildMushroom(0.08 + rand() * 0.1, Tuning.CAVE_FUNGI_CAP_MAX_R * (0.4 + rand() * 0.4), rand);
      m.position.set(x, wy, z);
      m.rotation.z = Math.PI * 0.5;                     // lay it horizontal, growing off the wall
      m.rotation.y = Math.atan2(uz, ux);
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
const _caveBumpU = { value: Tuning.CAVE_ROCK_BUMP };
_caveSurface.userData.bumpU = _caveBumpU;
function caveRockBumpPatch(this: THREE.Material, shader: THREE.WebGLProgramParametersWithUniforms): void {
  shader.uniforms.uCaveBump = (this.userData.bumpU as { value: number }) ?? _caveBumpU;
  shader.vertexShader = 'varying vec3 vCaveWPos;\n' + shader.vertexShader.replace(
    '#include <begin_vertex>',
    '#include <begin_vertex>\n  vCaveWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;',
  );
  shader.fragmentShader = `
    varying vec3 vCaveWPos;
    uniform float uCaveBump;
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
    // Two octaves: 0.6m grit over 0.22m tooth. Amplitudes chosen so the finer octave contributes
    // roughly the same SLOPE as the coarser (a·f near-constant), which is the fBm-for-rock case.
    float caveRockH(vec3 p) {
      return caveVN(p * 1.65) * 0.62 + caveVN(p * 4.60 + 31.7) * 0.24;
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
      float foot = length(fwidth(vCaveWPos));
      float fade = 1.0 / (1.0 + foot * 24.0);
      vec3 gg = caveRockGrad(vCaveWPos) * (uCaveBump * fade);
      normal = normalize(normal - (gg - normal * dot(gg, normal)));
    }`,
  );
}
_caveSurface.onBeforeCompile = caveRockBumpPatch;
_caveSurface.customProgramCacheKey = (): string => 'caveRockBump-v1';

/** A cave-rock surface material with its OWN bump strength (same program, different uniform).
 *  Used by the crevice tor, whose sunlit exterior needs a fraction of the interior's relief. */
export function makeCaveRockMaterial(bump: number): THREE.MeshLambertMaterial {
  const m = new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true, flatShading: true, side: THREE.FrontSide });
  m.userData.bumpU = { value: bump };
  m.onBeforeCompile = caveRockBumpPatch;
  m.customProgramCacheKey = (): string => 'caveRockBump-v1';
  return m;
}

export interface CaveGenProbe {
  seed: number;
  eggId: number;
  depthBelowSurface: number;
  triCount: number;
  /** Triangles actually baked into the Rapier trimesh (rule 9 — identical to the visible set). */
  colliderTris: number;
  /** ms — the Rapier trimesh bake (the streaming-budget number). */
  msCollider: number;
  /** ms — the SDF polygonization (field + nets + normals). */
  msMesh: number;
  digest: string;
  nodes: Array<{ id: number; x: number; y: number; z: number; rx: number; height: number; kind: CaveNodeKind; parent: number }>;
  edges: Array<{ a: number; b: number; halfW: number; height: number; squeeze: boolean }>;
  tour: number[];
  junction: CaveJunction;
}

export interface SpawnedCave {
  group: THREE.Group;
  body: RAPIER.RigidBody | null;
  graph: CaveGraph;
  probe: CaveGenProbe;
  /** UNDERWORLD cycle 3 — harvestable fungi clusters (E → alien_fruit). Wired to ctx.caveFungi. */
  fungi: CaveFungiCluster[];
  /** World-space top of the egg-chamber dais — where main.ts places the companion egg. */
  eggDaisTop: THREE.Vector3;
  /** World-space floor anchors for the deep loot caches (the hall + the egg chamber, battery-rich). */
  lootAnchors: THREE.Vector3[];
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
): SpawnedCave {
  const job = startSpawnCave(scene, world, terrain, junction, seed);
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
): CaveSpawnJob {
  type Stage = 'graph' | 'sdf' | 'dress' | 'finalize' | 'done';
  let stage: Stage = 'graph';

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
  let msMesh = 0;
  let out: SpawnedCave | null = null;
  // VITE_CAVE_SDF_BENCH=1 only — re-polygonizes at the measurement resolutions (cost numbers).
  let benchNoise: Noise3 | null = null;
  let benchDepthY: ((y: number) => number) | null = null;
  let benchSurfaceY: ((x: number, z: number) => number) | null = null;

  const depthOf = (n: CaveNode): number =>
    Math.max(0, Math.min(1, (junction.gy - n.floorY) / Math.max(1, graph.depthBelowSurface)));

  // -- Stage 1: the room graph + the RNG streams (cheap; the layout logic is consumed, never re-derived).
  const doGraph = (): void => {
    graph = generateCaveGraph(seed, junction, terrain);
    const noise3 = createNoise3D(makeRng((seed ^ 0x5eed3d) >>> 0));
    cnoise = createNoise3D(makeRng((seed ^ 0xc010a2) >>> 0));   // colour/dressing noise stream
    srand = makeRng((seed ^ 0x59e1e0) >>> 0);                   // speleothem placement RNG
    frand = makeRng((seed ^ 0xf0091a) >>> 0);                   // fungi placement RNG (own stream)

    group = new THREE.Group();
    group.name = 'caveGen';
    meshes = []; decor = []; fungi = [];

    const byId = (id: number): CaveNode => graph.nodes[id];
    // Neighbour directions per node (to keep the corridor-mouth sectors clear of speleothems).
    dirsByNode = new Map<number, Array<{ x: number; z: number }>>();
    const pushDir = (id: number, tx: number, tz: number): void => {
      const n = byId(id); const d = Math.hypot(tx - n.x, tz - n.z) || 1;
      (dirsByNode.get(id) ?? dirsByNode.set(id, []).get(id)!).push({ x: (tx - n.x) / d, z: (tz - n.z) / d });
    };
    for (const e of graph.edges) { pushDir(e.a, byId(e.b).x, byId(e.b).z); pushDir(e.b, byId(e.a).x, byId(e.a).z); }
    { const n0 = byId(0); pushDir(0, n0.x - junction.heading.x, n0.z - junction.heading.z); }

    // Weird mushrooms — seed 2-4 chambers (never every one), the egg + hall favoured (the "distinct
    // landmark" rooms), the rest chosen by rng score. Deterministic (frand stream). Visual-only.
    const fungiTarget = Tuning.CAVE_FUNGI_CHAMBERS_MIN
      + Math.floor(frand() * (Tuning.CAVE_FUNGI_CHAMBERS_MAX - Tuning.CAVE_FUNGI_CHAMBERS_MIN + 1));
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

    for (const node of graph.nodes) {
      const dT = depthOf(node);
      // The egg's central natural pedestal (dais) — collider-bearing (baked into the trimesh).
      if (node.kind === 'egg') {
        const dm = new THREE.Mesh(buildDais(node, cnoise, dT), _caveSolid);
        dm.castShadow = false; dm.receiveShadow = true; dm.userData.eggDais = true;
        group.add(dm); meshes.push(dm);
      }
      addSpeleothems(node, dirsByNode.get(node.id) ?? [], cnoise, dT, srand, group, meshes, decor);
      if (fungiSet.has(node.id)) addFungi(node, cnoise, frand, group, decor, fungi);
    }
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
      seed, eggId: graph.eggId, depthBelowSurface: graph.depthBelowSurface, triCount,
      colliderTris, msCollider, msMesh,
      digest: caveDigest(graph, allMeshes),
      nodes: graph.nodes.map((n) => ({ id: n.id, x: n.x, y: n.floorY, z: n.z, rx: n.rx, height: n.height, kind: n.kind, parent: n.parent })),
      edges: graph.edges.map((e) => ({ a: e.a, b: e.b, halfW: e.halfW, height: e.height, squeeze: e.squeeze })),
      tour: graph.tour,
      junction,
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

    out = { group, body, graph, probe, fungi, eggDaisTop, lootAnchors };
  };

  const step = (budgetMs: number): boolean => {
    const deadline = budgetMs === Infinity ? Infinity : performance.now() + budgetMs;
    while (stage !== 'done') {
      if (stage === 'graph') { doGraph(); stage = 'sdf'; }
      else if (stage === 'sdf') { if (!sdfJob!.step(budgetMs)) return false; stage = 'dress'; }
      else if (stage === 'dress') { doDress(); stage = 'finalize'; }
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
