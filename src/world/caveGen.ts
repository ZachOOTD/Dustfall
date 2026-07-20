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

/** The hand-off from the entrance bore: the throat's open far end (where the cave body begins). */
export interface CaveJunction {
  x: number; y: number; z: number;   // throat-far floor point (cave node 0 sits just past it)
  gy: number;                        // surface height at the mouth (depth reference)
  width: number;                     // throat clear width
  heading: { x: number; z: number }; // unit XZ heading into the cave (+X from the bore)
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
    x: junction.x + h0x * T.CAVE_GEN_ENTRANCE_RX * 0.5,
    z: junction.z + h0z * T.CAVE_GEN_ENTRANCE_RX * 0.5,
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
  const ov = T.CAVE_GEN_END_OVERLAP;
  const hallIndex = trunkSteps - 1;                          // the big gallery sits just before the egg
  // Centre-to-centre run for a corridor: the drop must fit over the SURFACE-to-SURFACE tube length
  // (not centre-to-centre) at ≤ the slope target — else the corridor floor meets the chamber floor
  // in a cliff (a big chamber's surface is far from its centre). So run = both chamber reaches +
  // a tube gap sized from the drop. Jitter only lengthens the gap (flatter, never steeper).
  const runFor = (raRx: number, rbRx: number, drop: number): number => {
    const tubeGap = Math.max(T.CAVE_GEN_CORRIDOR_RUN_MIN, drop / tanSlope) * (1 + rand() * 0.25);
    return (raRx - ov) + (rbRx - ov) + tubeGap;
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
  while (nodes.length < totalChambers && attempts < 40) {
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

// ── Mesh lofting ─────────────────────────────────────────────────────────────

type Noise3 = (x: number, y: number, z: number) => number;

/** A corridor's carve footprint in the chamber shell: the shell is removed exactly where the
 *  (flared) tube passes — within `halfW` of the corridor axis, above the floor, up to `ceilTop` —
 *  so the tube plugs the opening with NO rim gap (a cone aperture left a see-through rim). */
interface Carve { ux: number; uz: number; halfW: number; ceilTop: number; }

/** Build one chamber's displaced ellipsoid shell (flat floor, domed ceiling, tube-carved portals).
 *  Geometry is in WORLD space. */
function buildChamberGeometry(node: CaveNode, carves: Carve[], noise3: Noise3): THREE.BufferGeometry {
  const T = Tuning;
  const R = T.CAVE_GEN_CHAMBER_RINGS, S = T.CAVE_GEN_CHAMBER_SEGS;
  const amp = T.CAVE_GEN_DISP_AMP, freq = T.CAVE_GEN_DISP_FREQ;
  const ry = node.height * 0.6;
  const cy = node.floorY + node.height - ry;      // ellipsoid centre → top = floorY + height
  const cx = node.x, cz = node.z;
  const stride = S + 1;
  const pos = new Float32Array((R + 1) * stride * 3);
  let vi = 0;
  for (let i = 0; i <= R; i++) {
    const theta = (i / R) * Math.PI;
    const st = Math.sin(theta), ct = Math.cos(theta);
    for (let j = 0; j <= S; j++) {
      const phi = (j / S) * Math.PI * 2;
      const dxu = st * Math.cos(phi), dyu = ct, dzu = st * Math.sin(phi);
      let bx = dxu * node.rx, by = dyu * ry, bz = dzu * node.rz;
      const d = noise3((cx + bx) * freq, (cy + by) * freq, (cz + bz) * freq) * amp;
      bx += dxu * d; by += dyu * d; bz += dzu * d;
      let wx = cx + bx, wy = cy + by, wz = cz + bz;
      // Flatten the lower CAVE_GEN_FLOOR_FILL of the chamber height into a wide flat floor disk (so
      // it reaches ~0.94·rx and corridors — connecting at rx−overlap — land on flat floor).
      if (wy < node.floorY + node.height * T.CAVE_GEN_FLOOR_FILL) wy = node.floorY + noise3(wx * 0.5, 7.3, wz * 0.5) * T.CAVE_GEN_FLOOR_BUMP;
      pos[vi * 3] = wx; pos[vi * 3 + 1] = wy; pos[vi * 3 + 2] = wz;
      vi++;
    }
  }
  const floorGuard = node.floorY + 0.2;                    // never carve the flat floor (drops the player through)
  // Remove a triangle iff its centroid sits inside a corridor's tube footprint: on the +axis side,
  // within the flared half-width of the axis, and in the wall band above the floor. The tube's own
  // (equally-flared) mouth then plugs exactly this opening — coincident edges, no rim gap/see-through.
  const carved = (a: number, b: number, cc: number): boolean => {
    const cx = (pos[a * 3] + pos[b * 3] + pos[cc * 3]) / 3;
    const cyTri = (pos[a * 3 + 1] + pos[b * 3 + 1] + pos[cc * 3 + 1]) / 3;
    const cz = (pos[a * 3 + 2] + pos[b * 3 + 2] + pos[cc * 3 + 2]) / 3;
    if (cyTri < floorGuard) return false;                  // keep the floor
    const dx = cx - node.x, dz = cz - node.z;
    for (const c of carves) {
      const along = dx * c.ux + dz * c.uz;
      if (along <= 0) continue;                            // only the wall toward this corridor
      const perp = Math.hypot(dx - along * c.ux, dz - along * c.uz);
      if (perp < c.halfW && cyTri < c.ceilTop) return true;
    }
    return false;
  };
  const idx: number[] = [];
  for (let i = 0; i < R; i++) {
    for (let j = 0; j < S; j++) {
      const a = i * stride + j;
      const b = a + 1;
      const c2 = (i + 1) * stride + j;
      const d2 = c2 + 1;
      if (!carved(a, c2, b)) idx.push(a, c2, b);
      if (!carved(b, c2, d2)) idx.push(b, c2, d2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

/** Build one corridor's displaced D-section tube (flat tilted floor + arched ceiling). End rings
 *  overlap into both chambers (no gap at the aperture). Geometry is in WORLD space. */
function buildCorridorGeometry(a: CaveNode, b: CaveNode, edge: CaveEdge, noise3: Noise3): THREE.BufferGeometry {
  const T = Tuning;
  const M = T.CAVE_GEN_CORRIDOR_RINGS, K = T.CAVE_GEN_CORRIDOR_SEGS;
  const amp = T.CAVE_GEN_DISP_AMP * 0.7, freq = T.CAVE_GEN_DISP_FREQ;
  const ax = a.x, az = a.z, bx = b.x, bz = b.z;
  const dx = bx - ax, dz = bz - az;
  const horiz = Math.hypot(dx, dz) || 1;
  const hx = dx / horiz, hz = dz / horiz;         // heading (XZ)
  const rgtx = -hz, rgtz = hx;                     // right = heading rotated +90° (XZ)
  // CRITICAL (the partition bug): the tube spans SURFACE-to-SURFACE — from just inside a's surface
  // to just inside b's surface — NOT centre-to-centre. Extending the tube's side walls into the
  // chamber interiors would wall the chamber off; here it only pokes CAVE_GEN_END_OVERLAP past each
  // surface to plug the aperture, leaving the chamber interiors fully open.
  const ov = T.CAVE_GEN_END_OVERLAP;
  const sx = ax + hx * (a.rx - ov), sz = az + hz * (a.rx - ov);   // tube near end (inside a by ov)
  const ex = bx - hx * (b.rx - ov), ez = bz - hz * (b.rx - ov);   // tube far end (inside b by ov)
  const sdx = ex - sx, sdz = ez - sz;
  const stride = K + 1;
  const pos = new Float32Array((M + 1) * stride * 3);
  let vi = 0;
  for (let m = 0; m <= M; m++) {
    const t = m / M;                               // 0..1 ALONG THE TUBE (surface to surface)
    const px = sx + sdx * t, pz = sz + sdz * t;
    // Floor descends a.floorY → b.floorY across the TUBE (surface to surface), so it meets each
    // chamber's flat floor exactly at the mouth (no cliff) and the drop is spread over the tube
    // length (run was sized so this slope ≤ the target).
    const floorY = lerp(a.floorY, b.floorY, t);
    // Mouth FLARE at the ends (both width AND ceiling): near each chamber the tube opens up so it
    // fully COVERS that chamber's round aperture hole — else the hole's rim (wider than the tube)
    // is left open and you see straight up to the surface (a see-through / cover gap). In the middle
    // it's the corridor's own cross-section (a squeeze stays a tight NARROW passage, width constant,
    // never mid-pinched below the ~2.2m minimum).
    const endW = Math.max(0, 1 - Math.min(t, 1 - t) / 0.22);   // 1 at the ends → 0 by t≈0.22
    const Wt = edge.halfW * (1 + endW * 0.7);                  // widen the mouth to plug the carve exactly
    // At the mouths the ceiling drops to DOORWAY_H above the LOCAL floor (constant headroom — a
    // fixed CHAMBER-floor lintel pinched the headroom on a descending corridor and bumped the
    // capsule's head). At the exact mouth the local floor == the chamber floor, so it still meets
    // the chamber's carved doorway top; the chamber wall above stays closed (no see-through).
    const doorCeil = floorY + Tuning.CAVE_GEN_DOORWAY_H;
    const baseCeil = floorY + edge.height;
    const ceilY = lerp(baseCeil, doorCeil, endW);
    const Ht = ceilY - floorY;
    for (let k = 0; k <= K; k++) {
      const beta = (k / K) * Math.PI * 2;
      const cb = Math.cos(beta), sb = Math.sin(beta);
      const horizOff = cb * Wt;
      let wy: number;
      if (sb <= 0) {
        wy = floorY + noise3(px * 0.5, 3.1, pz * 0.5) * T.CAVE_GEN_FLOOR_BUMP;   // flat floor + micro-bump
      } else {
        wy = floorY + sb * Ht;
      }
      let wx = px + rgtx * horizOff;
      let wz = pz + rgtz * horizOff;
      if (sb > 0.15) {                              // displace walls/ceiling only (keep the floor clean)
        const d = noise3(wx * freq, wy * freq, wz * freq) * amp;
        wx += rgtx * cb * d; wz += rgtz * cb * d; wy += Math.max(0, sb) * d;
      }
      pos[vi * 3] = wx; pos[vi * 3 + 1] = wy; pos[vi * 3 + 2] = wz;
      vi++;
    }
  }
  const idx: number[] = [];
  for (let m = 0; m < M; m++) {
    for (let k = 0; k < K; k++) {
      const p0 = m * stride + k;
      const p1 = p0 + 1;
      const p2 = (m + 1) * stride + k;
      const p3 = p2 + 1;
      idx.push(p0, p2, p1, p1, p2, p3);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

// Greybox cave rock — mid-grey, flat-shaded, BackSide (we render the INTERIOR face of the cavity
// in solid rock). Two tones separate corridors from chambers so the blockout reads. Real cave
// dressing (dark rock + torch dark-nav) is cycle 4+.
const _caveRock = new THREE.MeshLambertMaterial({ color: 0x8d857a, flatShading: true, side: THREE.BackSide });
const _caveRockDark = new THREE.MeshLambertMaterial({ color: 0x6c655c, flatShading: true, side: THREE.BackSide });
const _caveEgg = new THREE.MeshLambertMaterial({ color: 0x9a8f88, flatShading: true, side: THREE.BackSide });

export interface CaveGenProbe {
  seed: number;
  eggId: number;
  depthBelowSurface: number;
  triCount: number;
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
}

/** Build + place the generated cave body: chamber + corridor meshes welded to the throat junction,
 *  one trimesh collider matching the visual (rule 9). Attaches a `caveGenProbe` on the group. */
export function spawnCave(
  scene: THREE.Scene,
  world: RAPIER.World,
  terrain: Terrain,
  junction: CaveJunction,
  seed: number,
): SpawnedCave {
  const graph = generateCaveGraph(seed, junction, terrain);
  const noise3 = createNoise3D(makeRng((seed ^ 0x5eed3d) >>> 0));

  const group = new THREE.Group();
  group.name = 'caveGen';

  // Per-node CARVE list: one tube-footprint per connected corridor + the entrance's throat opening.
  // Each carve removes the chamber wall exactly where the (flared) corridor tube passes — a doorway
  // up to floor+DOORWAY_H, width = the tube's flared mouth — so the tube plugs it with no rim gap and
  // the dome above stays closed (no see-through). The tube mouth flares to the SAME width (×1.7).
  const carveByNode = new Map<number, Carve[]>();
  const addCarve = (id: number, ux: number, uz: number, halfW: number, floorY: number): void => {
    const list = carveByNode.get(id) ?? [];
    list.push({ ux, uz, halfW, ceilTop: floorY + Tuning.CAVE_GEN_DOORWAY_H });
    carveByNode.set(id, list);
  };
  const byId = (id: number): CaveNode => graph.nodes[id];
  for (const e of graph.edges) {
    const na = byId(e.a), nb = byId(e.b);
    const hl = Math.hypot(nb.x - na.x, nb.z - na.z) || 1;
    const ux = (nb.x - na.x) / hl, uz = (nb.z - na.z) / hl;
    const flaredHalf = e.halfW * 1.7;                            // matches the tube's mouth width flare
    addCarve(e.a, ux, uz, flaredHalf, na.floorY);
    addCarve(e.b, -ux, -uz, flaredHalf, nb.floorY);
  }
  // Entrance node — a carve toward the throat (opposite the cave heading), the throat's width.
  {
    const n0 = byId(0);
    addCarve(0, -junction.heading.x, -junction.heading.z, junction.width * 0.5 + 0.4, n0.floorY);
  }

  const meshes: THREE.Mesh[] = [];
  for (const node of graph.nodes) {
    const geo = buildChamberGeometry(node, carveByNode.get(node.id) ?? [], noise3);
    const mat = node.kind === 'egg' ? _caveEgg : _caveRock;
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = false; mesh.receiveShadow = true;
    mesh.userData.caveNode = node.id;
    if (node.kind === 'egg') mesh.userData.eggChamber = true;
    group.add(mesh);
    meshes.push(mesh);
  }
  for (const e of graph.edges) {
    const geo = buildCorridorGeometry(byId(e.a), byId(e.b), e, noise3);
    const mesh = new THREE.Mesh(geo, _caveRockDark);
    mesh.castShadow = false; mesh.receiveShadow = true;
    group.add(mesh);
    meshes.push(mesh);
  }

  scene.add(group);

  // ONE trimesh collider baked from the exact visual triangles (rule 9). Meshes are already in
  // world space (identity group), so bakeInv = identity, body at origin.
  const body = makeStaticTrimesh(world, meshes, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0, w: 1 }, new THREE.Matrix4());

  // Triangle count (perf report).
  let triCount = 0;
  for (const m of meshes) triCount += (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3;

  const probe: CaveGenProbe = {
    seed, eggId: graph.eggId, depthBelowSurface: graph.depthBelowSurface, triCount,
    digest: caveDigest(graph, meshes),
    nodes: graph.nodes.map((n) => ({ id: n.id, x: n.x, y: n.floorY, z: n.z, rx: n.rx, height: n.height, kind: n.kind, parent: n.parent })),
    edges: graph.edges.map((e) => ({ a: e.a, b: e.b, halfW: e.halfW, height: e.height, squeeze: e.squeeze })),
    tour: graph.tour,
    junction,
  };
  group.userData.caveGenProbe = probe;

  return { group, body, graph, probe };
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
