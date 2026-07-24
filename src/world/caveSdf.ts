// DEEPER cycle 2 (2026-07-24) — THE WATERTIGHT CAVE SURFACE. **This is the cave's ONLY meshing
// path** (cycle 1 landed it behind `VITE_CAVE_SDF`; cycle 2 made it the default and DELETED the
// shell kit — `buildChamberGeometry`, `buildCorridorGeometry`, the `Carve` machinery and
// `_caveShell` no longer exist). The cave palette lives HERE now (`caveVertexColor`, exported for
// the dais + speleothems), so there is exactly one copy.
//
// WHY: the shipped cave is N interpenetrating zero-thickness shells (one ellipsoid per chamber,
// one tube per corridor) sharing ONE material. `buildChamberGeometry` winds INWARD, corridor tubes
// wind OUTWARD, so a single `side` is wrong for half the kit — 53.6% of eye-height rays escape into
// the void on seed 1337 (`npm run verify:cave:void`). Flipping the winding would drop the number but
// leave paper-thin shells and the carve-boundary gaps: rule 7, and a laundered gate.
//
// THE FIX PROTOTYPED HERE: build a signed-distance field from the EXISTING room-graph and polygonize
// it into ONE continuous, consistently-wound surface. No shells, no interpenetration, no carve rims.
//
//   SIGN CONVENTION:  f(p) < 0  ⇒  p is inside the CAVITY (air).
//                     f(p) > 0  ⇒  p is inside ROCK.
//   The emitted triangles are wound so their normals point along −∇f — i.e. INTO the cavity, at the
//   player. So the surface renders `side: FrontSide` and there is nothing ambiguous left to get wrong.
//
// POLYGONIZER: naive SURFACE NETS (dual contouring without the QEF). Chosen over marching cubes
// because the dual formulation emits one vertex per sign-changing cell and quads across sign-changing
// edges — no sliver triangles on the near-tangent grazing cells that a 46m-long corridor tube produces
// by the thousand, ~35% fewer triangles at equal resolution, and a manifold by construction (every
// interior edge is shared by exactly two faces, so `computeVertexNormals` gives smooth shading for
// free). Marching cubes' only real advantage here — sharper feature capture — is worthless on rock.
//
// THE ROOM-GRAPH IS UNTOUCHED. `generateCaveGraph` (chamber placement, the branching tree, the 55°
// sibling-divergence rule, clear-span corridor run sizing, the fail-loud traversability assert) was
// bought with real Underworld bugs. This module consumes its OUTPUT. Only the meshing layer changes.
//
// `VITE_CAVE_SDF_BENCH=1` additionally polygonizes at the measurement resolutions (cost only).

import * as THREE from 'three';
import { Tuning } from '../config/tuning.ts';
import type { CaveGraph, CaveJunction, CaveNode } from './caveGen.ts';

type Noise3 = (x: number, y: number, z: number) => number;

/** Chamber floor-disk fraction: at y = floorY the ellipsoid's horizontal radius should be ~0.94·rx
 *  (matching the shell generator's flattened floor disk, so corridors still land on flat floor). */
const FLOOR_DISK = 0.94;
const RY_FACTOR = 1 / (1 + Math.sqrt(1 - FLOOR_DISK * FLOOR_DISK));   // ry = height · this ≈ 0.746

/** One SDF primitive. Chambers are floor-cut ellipsoids; corridors are floor-cut D-section tubes
 *  swept along the graph edge with the SAME flat-across-the-disk / ramp-over-the-clear-span floor
 *  profile the shell corridor used — so the ≤ MAX_SLOPE guarantee the graph bought still holds. */
interface Prim {
  corridor: boolean;
  // chamber
  cx: number; cy: number; cz: number; rx: number; ry: number; rz: number;
  // corridor (XZ segment + endpoint floors + the flat-disk pads)
  ax: number; az: number; dx: number; dz: number; len: number;
  fa: number; fb: number; tA: number; tB: number;
  halfW: number; height: number;
  // bounding sphere (padded at build time)
  bx: number; by: number; bz: number; br: number;
}

function chamberPrim(n: CaveNode): Prim {
  const ry = n.height * RY_FACTOR;
  const cy = n.floorY + n.height - ry;
  return {
    corridor: false,
    cx: n.x, cy, cz: n.z, rx: n.rx, ry, rz: n.rz,
    ax: 0, az: 0, dx: 0, dz: 0, len: 1, fa: n.floorY, fb: n.floorY, tA: 0, tB: 1,
    halfW: 0, height: n.height,
    bx: n.x, by: cy, bz: n.z, br: Math.max(n.rx, n.rz, ry) + 0.1,
  };
}

function corridorPrim(
  ax: number, az: number, fa: number, aRx: number,
  bx: number, bz: number, fb: number, bRx: number,
  halfW: number, height: number,
): Prim {
  const dx = bx - ax, dz = bz - az;
  const len = Math.hypot(dx, dz) || 1;
  // Flat across each chamber's floor disk, ramping only over the CLEAR span between them — the exact
  // profile buildCorridorGeometry used, so the slope the graph sized for is the slope you walk.
  const tA = Math.min(0.45, (aRx * FLOOR_DISK) / len);
  const tB = Math.max(0.55, 1 - (bRx * FLOOR_DISK) / len);
  const midY = (fa + fb) * 0.5;
  return {
    corridor: true,
    cx: 0, cy: 0, cz: 0, rx: 0, ry: 0, rz: 0,
    ax, az, dx: dx / len, dz: dz / len, len,
    fa, fb, tA, tB, halfW, height,
    bx: (ax + bx) * 0.5, by: midY + height * 0.5, bz: (az + bz) * 0.5,
    br: len * 0.5 + Math.max(halfW, height) + 0.1,
  };
}

/** Side-channel out of `primDist`: the LOCAL floor plane Y at the sampled XZ for the primitive just
 *  evaluated. For a chamber that is its flat floor; for a corridor it is the RAMP floor at this point
 *  along the run, NOT `min(fa,fb)`.
 *
 *  DEEPER cycle 2 — this is the 32.4° fix. Cycle 1 attenuated the rock displacement (and the blend)
 *  by height above `p.floorY`, which for a corridor was `min(fa, fb)`. On a descending corridor the
 *  SHALLOW half therefore read as "6m above the floor" and took the FULL ±0.95m multi-octave
 *  displacement straight through its walkable floor — a 0.8m bump over a 1.2m sample baseline is
 *  33°, which is exactly what the walk gate reported (e1-2, dy-0.8/dx1.2). Keyed to the local ramp
 *  floor the corridor floors are flat again and the slope is the graph's sized ramp, as intended. */
let _localFloor = 0;

/** Primitive SDF. Negative inside the cavity. Exact-ish for the floor plane, an ellipsoid
 *  approximation elsewhere (the classic (|q|−1)·min(r) bound — under-estimates near the poles by a
 *  few cm at these radii, which surface nets absorbs without a visible artefact). */
function primDist(p: Prim, x: number, y: number, z: number): number {
  if (!p.corridor) {
    _localFloor = p.fa;
    const qx = (x - p.cx) / p.rx, qy = (y - p.cy) / p.ry, qz = (z - p.cz) / p.rz;
    const k = Math.sqrt(qx * qx + qy * qy + qz * qz);
    const d = (k - 1) * Math.min(p.rx, p.ry, p.rz);
    return Math.max(d, p.fa - y);                       // intersect with the halfspace above the floor
  }
  let t = ((x - p.ax) * p.dx + (z - p.az) * p.dz) / p.len;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const s = t * p.len;
  const px = p.ax + p.dx * s, pz = p.az + p.dz * s;
  const perp = Math.hypot(x - px, z - pz);
  let tr = (t - p.tA) / (p.tB - p.tA);
  tr = tr < 0 ? 0 : tr > 1 ? 1 : tr;
  const fy = p.fa + (p.fb - p.fa) * tr;
  _localFloor = fy;
  const qw = perp / p.halfW, qh = (y - fy) / p.height;
  const k = Math.sqrt(qw * qw + qh * qh);
  const d = (k - 1) * Math.min(p.halfW, p.height);
  return Math.max(d, fy - y);
}

/** Polynomial smooth-min (IQ). Rounds the concave crease where a corridor meets a chamber into a
 *  natural flared mouth — the thing the shell kit needed an explicit carve + a ×1.7 flare to fake. */
function smin(a: number, b: number, k: number): number {
  if (k <= 1e-3) return Math.min(a, b);
  const h = Math.max(0, k - Math.abs(a - b)) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

export interface CaveSdfStats {
  voxel: number;
  dims: [number, number, number];
  samples: number;         // grid corners actually evaluated (blocks with no nearby primitive are skipped)
  gridSamples: number;     // total grid corners
  tris: number;
  verts: number;
  msField: number;
  msNets: number;
  msNormals: number;
  msTotal: number;
}

export interface CaveSdfResult {
  geometry: THREE.BufferGeometry;
  stats: CaveSdfStats;
  /** World-space centre + radius of the cut entrance rim (declared as an intendedOpening). */
  opening: { center: THREE.Vector3; radius: number };
}

/** Build the whole cave as ONE watertight surface-nets mesh from the room-graph.
 *  `voxel` = grid spacing in metres (the quality/cost dial). */
export function buildCaveSdf(
  graph: CaveGraph, junction: CaveJunction, noise3: Noise3, cnoise: Noise3,
  voxel: number, depthOf: (floorY: number) => number,
): CaveSdfResult {
  const T = Tuning;
  const t0 = performance.now();

  // ── Primitives from the graph (layout logic consumed, never re-derived). ──
  const prims: Prim[] = [];
  for (const n of graph.nodes) prims.push(chamberPrim(n));
  for (const e of graph.edges) {
    const a = graph.nodes[e.a], b = graph.nodes[e.b];
    prims.push(corridorPrim(a.x, a.z, a.floorY, a.rx, b.x, b.z, b.floorY, b.rx, e.halfW, e.height));
  }
  // The ENTRANCE slot: one more primitive, unioned into the same field — so there is no weld seam
  // between the entrance and the cave at all (the thing the shell kit could never have). It runs from
  // inside the throat (past the junction plane, so the cut below lands in open throat air) to node 0.
  const n0 = graph.nodes[0];
  const hx = junction.heading.x, hz = junction.heading.z;
  const ENTRY_BACK = 2.4;                                   // m back into the throat past the junction
  const entryHalfW = Math.max(1.0, junction.width * 0.5 - 0.35);
  const entryH = Math.max(2.2, T.CAVE_TEST_THROAT_H - 0.45);
  prims.push(corridorPrim(
    junction.x - hx * ENTRY_BACK, junction.z - hz * ENTRY_BACK, junction.y, 0.1,
    n0.x, n0.z, n0.floorY, n0.rx, entryHalfW, entryH,
  ));

  const SMOOTH = T.CAVE_SDF_SMOOTH;
  // DEEPER cycle 2 — THE 32.4° FIX. Cycle 1 measured corridor 1–2 at 32.4° against the 32° ceiling.
  // Cause: the smooth-min blend is isotropic, so at a corridor mouth it rounds the concave crease
  // DOWNWARD as well as sideways — it eats the start of the flat floor pad and the ramp effectively
  // begins early over a shorter run. The blend radius is therefore ATTENUATED toward the floor: full
  // `SMOOTH` from FLOOR_BAND upward (where the flared mouth is the whole point, visually), shrinking
  // to SMOOTH·FLOOR_MIN at the floor plane itself, where the walkable slope is measured. Not fixed by
  // raising the slope ceiling — the ceiling is the contract the room-graph was sized against.
  const SMOOTH_FLOOR_MIN = T.CAVE_SDF_SMOOTH_FLOOR;
  const SMOOTH_BAND = T.CAVE_SDF_SMOOTH_BAND;
  const AMP_OUT = T.CAVE_GEN_DISP_AMP, AMP_IN = T.CAVE_GEN_DISP_IN, FREQ = T.CAVE_GEN_DISP_FREQ;
  const BAND = voxel * 2 + SMOOTH + AMP_OUT + 0.5;          // "near the surface" half-width

  // ── Grid AABB from the padded primitive bounds. ──
  let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
  for (const p of prims) {
    const r = p.br + BAND;
    x0 = Math.min(x0, p.bx - r); x1 = Math.max(x1, p.bx + r);
    y0 = Math.min(y0, p.by - r); y1 = Math.max(y1, p.by + r);
    z0 = Math.min(z0, p.bz - r); z1 = Math.max(z1, p.bz + r);
    p.br += BAND;                                            // pad once, for the block-cull test
  }
  const nx = Math.ceil((x1 - x0) / voxel), ny = Math.ceil((y1 - y0) / voxel), nz = Math.ceil((z1 - z0) / voxel);
  const cw = nx + 1, ch = ny + 1, cd = nz + 1;               // corner grid dims

  // ── FIELD SAMPLING, block-culled. A cave occupies a small fraction of its own AABB (corridors are
  //    thin), so evaluating every corner is mostly wasted. Blocks with no primitive within BAND keep
  //    the +BIG fill: their true distance is > BAND > 0, so the SIGN is right and no sign change is
  //    missed — and any cell that could carry a vertex has a negative corner, whose block is active,
  //    and every corner within one voxel of it is inside that primitive's padded sphere. ──
  const BIG = 1e4;
  const field = new Float32Array(cw * ch * cd).fill(BIG);
  const B = 8;                                              // block edge in voxels
  const cand: Prim[] = [];
  const dcs: number[] = [];
  let evaluated = 0;
  for (let bz = 0; bz < cd; bz += B) {
    for (let by = 0; by < ch; by += B) {
      for (let bx = 0; bx < cw; bx += B) {
        // Block AABB (corner space, inclusive of the shared +1 boundary corner).
        const wx0 = x0 + bx * voxel, wx1 = x0 + Math.min(bx + B, cw - 1) * voxel;
        const wy0 = y0 + by * voxel, wy1 = y0 + Math.min(by + B, ch - 1) * voxel;
        const wz0 = z0 + bz * voxel, wz1 = z0 + Math.min(bz + B, cd - 1) * voxel;
        cand.length = 0;
        for (const p of prims) {
          const ddx = p.bx < wx0 ? wx0 - p.bx : p.bx > wx1 ? p.bx - wx1 : 0;
          const ddy = p.by < wy0 ? wy0 - p.by : p.by > wy1 ? p.by - wy1 : 0;
          const ddz = p.bz < wz0 ? wz0 - p.bz : p.bz > wz1 ? p.bz - wz1 : 0;
          if (ddx * ddx + ddy * ddy + ddz * ddz <= p.br * p.br) cand.push(p);
        }
        if (!cand.length) continue;
        const ix1 = Math.min(bx + B, cw - 1), iy1 = Math.min(by + B, ch - 1), iz1 = Math.min(bz + B, cd - 1);
        for (let k = bz; k <= iz1; k++) {
          const wz = z0 + k * voxel;
          for (let j = by; j <= iy1; j++) {
            const wy = y0 + j * voxel;
            let o = (k * ch + j) * cw + bx;
            for (let i = bx; i <= ix1; i++, o++) {
              const wx = x0 + i * voxel;
              // Evaluate every candidate FIRST (so `fl` is the NEAREST primitive's floor, not the
              // nearest-so-far of a running blend), then fold with a floor-attenuated blend radius.
              let nearest = BIG, fl = 0;
              for (let c = 0; c < cand.length; c++) {
                const dc = primDist(cand[c], wx, wy, wz);
                dcs[c] = dc;
                if (dc < nearest) { nearest = dc; fl = _localFloor; }   // LOCAL floor, not min(fa,fb)
              }
              const above = wy - fl;
              const kt = above <= 0 ? 0 : above >= SMOOTH_BAND ? 1 : above / SMOOTH_BAND;
              const kLocal = SMOOTH * (SMOOTH_FLOOR_MIN + (1 - SMOOTH_FLOOR_MIN) * kt);
              let d = dcs[0];
              for (let c = 1; c < cand.length; c++) d = smin(d, dcs[c], kLocal);
              // Multi-octave rock displacement, evaluated ONLY in the narrow band around the surface
              // (outside it the sign can't flip, so the noise is pure cost). Attenuated to zero at the
              // floor plane so the walkable floor stays flat — the shell kit's `role` split, in world
              // space instead of on a per-shell parametric UV.
              if (d > -BAND && d < BAND) {
                const at = Math.min(1, Math.max(0, (wy - fl - 0.25) / 1.1));
                if (at > 0) {
                  let v = noise3(wx * FREQ, wy * FREQ, wz * FREQ) * 0.62;
                  v += noise3(wx * FREQ * 2.7 + 19, wy * FREQ * 2.7, wz * FREQ * 2.7 + 5) * 0.27;
                  v += noise3(wx * FREQ * 5.9 + 41, wy * FREQ * 5.9, wz * FREQ * 5.9 + 13) * 0.13;
                  d -= (v >= 0 ? v * AMP_OUT : v * AMP_IN) * at;
                }
              }
              field[o] = d;
              evaluated++;
            }
          }
        }
      }
    }
  }
  const t1 = performance.now();

  // ── SURFACE NETS. One vertex per sign-changing cell (average of its edge crossings), one quad per
  //    sign-changing edge, wound so the normal points −∇f = into the cavity. ──
  const cellIdx = new Int32Array(nx * ny * nz).fill(-1);
  const vx: number[] = [], vy: number[] = [], vz: number[] = [];
  const CORNER = [
    [0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1],
  ] as const;
  const EDGE = [
    [0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7],
  ] as const;
  const fv = new Float32Array(8);
  for (let k = 0; k < nz; k++) {
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        let neg = 0;
        for (let c = 0; c < 8; c++) {
          const [a, b, cc] = CORNER[c];
          const v = field[((k + cc) * ch + (j + b)) * cw + (i + a)];
          fv[c] = v;
          if (v < 0) neg++;
        }
        if (neg === 0 || neg === 8) continue;
        let sx = 0, sy = 0, sz = 0, n = 0;
        for (let e = 0; e < 12; e++) {
          const a = EDGE[e][0], b = EDGE[e][1];
          const fa = fv[a], fb = fv[b];
          if ((fa < 0) === (fb < 0)) continue;
          const t = fa / (fa - fb);
          sx += CORNER[a][0] + (CORNER[b][0] - CORNER[a][0]) * t;
          sy += CORNER[a][1] + (CORNER[b][1] - CORNER[a][1]) * t;
          sz += CORNER[a][2] + (CORNER[b][2] - CORNER[a][2]) * t;
          n++;
        }
        cellIdx[(k * ny + j) * nx + i] = vx.length;
        vx.push(x0 + (i + sx / n) * voxel);
        vy.push(y0 + (j + sy / n) * voxel);
        vz.push(z0 + (k + sz / n) * voxel);
      }
    }
  }

  // Quads across sign-changing corner edges. Axis u with perpendicular pair (v,w) in right-handed
  // cyclic order — the loop (0,0)→(1,0)→(1,1)→(0,1) is CCW in (v,w), i.e. normal +u; so we KEEP that
  // order when ∇f points −u (corner0 positive) and REVERSE it when ∇f points +u.
  const idx: number[] = [];
  const cellAt = (i: number, j: number, k: number): number =>
    (i < 0 || j < 0 || k < 0 || i >= nx || j >= ny || k >= nz) ? -1 : cellIdx[(k * ny + j) * nx + i];
  // per-axis: [strideCorner, cell-offset basis for v and w]
  for (let axis = 0; axis < 3; axis++) {
    for (let k = 0; k < cd; k++) {
      for (let j = 0; j < ch; j++) {
        for (let i = 0; i < cw; i++) {
          const i1 = axis === 0 ? i + 1 : i, j1 = axis === 1 ? j + 1 : j, k1 = axis === 2 ? k + 1 : k;
          if (i1 >= cw || j1 >= ch || k1 >= cd) continue;
          const f0 = field[(k * ch + j) * cw + i];
          const f1 = field[(k1 * ch + j1) * cw + i1];
          if ((f0 < 0) === (f1 < 0)) continue;
          // The four cells sharing this corner-edge, in (v,w) CCW order.
          let a: number, b: number, c: number, d: number;
          if (axis === 0) {          // u=x, v=y, w=z
            a = cellAt(i, j - 1, k - 1); b = cellAt(i, j, k - 1); c = cellAt(i, j, k); d = cellAt(i, j - 1, k);
          } else if (axis === 1) {   // u=y, v=z, w=x
            a = cellAt(i - 1, j, k - 1); b = cellAt(i - 1, j, k); c = cellAt(i, j, k); d = cellAt(i, j, k - 1);
          } else {                   // u=z, v=x, w=y
            a = cellAt(i - 1, j - 1, k); b = cellAt(i, j - 1, k); c = cellAt(i, j, k); d = cellAt(i - 1, j, k);
          }
          if (a < 0 || b < 0 || c < 0 || d < 0) continue;   // grid boundary — cannot happen inside the pad
          if (f0 >= 0) idx.push(a, b, c, a, c, d);          // ∇f points −u → face normal +u
          else idx.push(a, c, b, a, d, c);                  // ∇f points +u → face normal −u
        }
      }
    }
  }
  const t2 = performance.now();

  // ── CUT the entrance rim: drop every triangle on the throat side of the junction plane, so the
  //    cavity genuinely OPENS into the throat instead of sealing itself into an unreachable bubble
  //    (a sealed cave would pass the void gate while being the exact "gate measuring the wrong thing"
  //    failure the project's driving lesson names). The rim lands inside the throat box, whose own
  //    walls/roof/floor bound everything past it. Declared as an intendedOpening. ──
  const kept: number[] = [];
  for (let t = 0; t < idx.length; t += 3) {
    const cx = (vx[idx[t]] + vx[idx[t + 1]] + vx[idx[t + 2]]) / 3;
    const cz = (vz[idx[t]] + vz[idx[t + 1]] + vz[idx[t + 2]]) / 3;
    if ((cx - junction.x) * hx + (cz - junction.z) * hz < 0) continue;
    kept.push(idx[t], idx[t + 1], idx[t + 2]);
  }

  // ── Vertex colours: the SAME strata / staining / sediment read, evaluated in WORLD space per
  //    vertex. Role is inferred from the local surface orientation instead of the shell's parametric
  //    lat-long — see the cycle-2 note in the header of caveGen.ts. ──
  const nv = vx.length;
  const pos = new Float32Array(nv * 3);
  for (let v = 0; v < nv; v++) { pos[v * 3] = vx[v]; pos[v * 3 + 1] = vy[v]; pos[v * 3 + 2] = vz[v]; }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setIndex(kept);
  const t3a = performance.now();
  geo.computeVertexNormals();
  const t3 = performance.now();

  // Role from the (now-known) normal: normals point INTO the cavity, so a floor faces +Y, a ceiling
  // faces −Y. Colour is the existing palette, applied to the unified surface.
  const nrm = geo.attributes.normal as THREE.BufferAttribute;
  const col = new Float32Array(nv * 3);
  const c = new THREE.Color();
  for (let v = 0; v < nv; v++) {
    const wy = vy[v];
    const up = nrm.getY(v);
    const role: 'wall' | 'ceiling' | 'floor' = up > 0.55 ? 'floor' : up < -0.4 ? 'ceiling' : 'wall';
    caveVertexColor(role, vx[v], wy, vz[v], depthOf(wy), cnoise, c);
    col[v * 3] = c.r; col[v * 3 + 1] = c.g; col[v * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));

  const t4 = performance.now();
  const opening = {
    center: new THREE.Vector3(junction.x, junction.y + entryH * 0.45, junction.z),
    radius: Math.max(entryHalfW, entryH) + 0.9,
  };
  return {
    geometry: geo,
    opening,
    stats: {
      voxel, dims: [nx, ny, nz], samples: evaluated, gridSamples: cw * ch * cd,
      tris: kept.length / 3, verts: nv,
      msField: +(t1 - t0).toFixed(1), msNets: +(t2 - t1).toFixed(1),
      msNormals: +(t3 - t3a).toFixed(1), msTotal: +(t4 - t0).toFixed(1),
    },
  };
}

/** THE cave palette — the single copy (cycle 2 deleted caveGen's, which died with the shells).
 *  Cave-rock vertex colour by role + world position + normalized depth `depthT` (0 near the mouth,
 *  1 at the egg): walls carry horizontal STRATA bands + patchy mineral (rust / cool) STAINING; the
 *  ceiling is darker + cooler (soot, less light); the floor blends pooled TAN SAND sediment into its
 *  dips (ties to the desert above). Picked perceptually (sRGB), stored LINEAR — a raw sRGB value in
 *  the vertex buffer renders far too bright (the pale-plaster look). Also used by the dais + the
 *  speleothems in caveGen.ts. */
export function caveVertexColor(
  role: 'wall' | 'ceiling' | 'floor', wx: number, wy: number, wz: number,
  depthT: number, cn: Noise3, out: THREE.Color,
): void {
  const L = (a: number, b: number, t: number): number => a + (b - a) * t;
  let r = L(0.315, 0.235, depthT), g = L(0.285, 0.245, depthT), b = L(0.255, 0.275, depthT);
  const bandN = cn(wx * 0.02, 0, wz * 0.02) * 1.4;
  const bl = 1 + Math.sin(wy * 0.85 + bandN) * 0.10;
  r *= bl; g *= bl; b *= bl;
  const stain = cn(wx * 0.055 + 11, wy * 0.055, wz * 0.055 + 7);
  const warm = Math.max(0, stain) * 0.55;
  r = L(r, 0.40, warm); g = L(g, 0.235, warm * 0.85); b = L(b, 0.145, warm * 0.9);
  const cool = Math.max(0, -stain) * 0.32;
  r = L(r, 0.195, cool); g = L(g, 0.235, cool); b = L(b, 0.30, cool);
  if (role === 'ceiling') { r *= 0.58; g *= 0.62; b *= 0.72; }
  else if (role === 'floor') {
    const sand = Math.max(0, cn(wx * 0.10 + 5, 3.7, wz * 0.10 + 9)) * 0.9;
    r = L(r, 0.52, sand); g = L(g, 0.43, sand); b = L(b, 0.28, sand);
    const gr = cn(wx * 0.9, 1.3, wz * 0.9) * 0.035;
    r += gr; g += gr; b += gr;
  }
  out.setRGB(Math.max(0.02, r), Math.max(0.02, g), Math.max(0.02, b)).convertSRGBToLinear();
}
