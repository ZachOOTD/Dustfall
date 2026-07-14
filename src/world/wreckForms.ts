// Shared procedural-hull TOOLKIT (Session ACAJ). The reusable building blocks
// for believable crashed-ship wrecks — used by the hand-modeled mega-wreck AND
// the procgen wreck fleet so leveling up a block improves every wreck at once.
//
// Research touchstones (game-researcher, ACAJ): dominant-feature silhouette
// (avoid boxy symmetry; read at 100m), LatheGeometry for tapered fuselage/nose,
// exposed formers/ribs at breaks, breach via VERTEX-DISPLACEMENT (not boolean) +
// jagged edges, half-burial via a windward sand-drift mound (~20° slope).
//
// Convention: hull long-axis = +X (matches the procgen part convention — parts
// advance along +X, radius in the YZ plane). Builders return Groups/Meshes ready
// to position; the caller owns world transform + colliders + merge.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Rng } from '../core/rng.ts';
import type { Terrain } from './terrain.ts';

// ── Shared accent materials (low instance count; module singletons). The HULL
//    material is passed IN by callers (reuse wrecks.ts `_hullMat` etc. — no dup). ──
/** Dark interior rib/former metal. */
const _formerMat = new THREE.MeshLambertMaterial({ color: 0x342f28, flatShading: true });
/** Near-black breach interior (the dark void behind a torn hole). */
const _voidMat = new THREE.MeshBasicMaterial({ color: 0x0b0907, side: THREE.DoubleSide });
/** Torn, rust-bitten metal flaps around a breach rim. */
const _tornMat = new THREE.MeshLambertMaterial({ color: 0x4a3a2b, flatShading: true });
/** Wind-drifted sand piled against a hull (matches the dune ground 0xcd9555). */
const _sandMat = new THREE.MeshLambertMaterial({ color: 0xc69a5a, flatShading: true });

// ──────────────────────────────────────────────────────────────────────────
// Lathe hull section
// ──────────────────────────────────────────────────────────────────────────

export interface LatheHullOpts {
  /** Hull surface material (pass the shared `_hullMat` from wrecks.ts). */
  material: THREE.Material;
  /** Angular slices (default 20). */
  segments?: number;
  /** Partial-arc start angle (radians) — for a torn-open or skylight gap. */
  phiStart?: number;
  /** Partial-arc sweep (radians, default 2π = closed tube). */
  phiLength?: number;
  /** Long axis: 'x' (default — procgen convention) rotates the lathe so length
   *  runs along +X; 'z' along +Z (the mega-wreck ship axis); 'y' leaves the
   *  native lathe Y axis. */
  axis?: 'x' | 'y' | 'z';
}

/** A tapered/bowed hull section revolved from a 2D profile of
 *  `Vector2(radius, axialPosition)` points (the openingWreck.ts PROFILE pattern,
 *  generalized). Smooth taper replaces box sections. Use a partial `phiLength`
 *  for a torn-open end or a skylight slot. Returns a single Mesh. */
export function makeLatheHull(profile: THREE.Vector2[], opts: LatheHullOpts): THREE.Mesh {
  const geo = new THREE.LatheGeometry(
    profile,
    opts.segments ?? 20,
    opts.phiStart ?? 0,
    opts.phiLength ?? Math.PI * 2,
  );
  const axis = opts.axis ?? 'x';
  if (axis === 'x') geo.rotateZ(-Math.PI / 2);       // lathe +Y → world +X
  else if (axis === 'z') geo.rotateX(Math.PI / 2);   // lathe +Y → world +Z
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, opts.material);
}

/** A symmetric tapered-fuselage profile helper: nose tip → bulge → tail, with a
 *  little mid bow. `len` along the axis, `maxR` at the widest, `noseR`/`tailR`
 *  end radii. Returns Vector2(radius, axialY) for `makeLatheHull`. */
export function fuselageProfile(
  len: number,
  maxR: number,
  noseR: number,
  tailR: number,
  rand?: Rng,
): THREE.Vector2[] {
  const jit = (f: number) => (rand ? 1 + (rand() - 0.5) * f : 1);
  return [
    new THREE.Vector2(Math.max(0.02, tailR), 0),
    new THREE.Vector2(tailR * 1.04 * jit(0.06), len * 0.10),
    new THREE.Vector2(maxR * 0.82 * jit(0.06), len * 0.26),
    new THREE.Vector2(maxR * jit(0.05), len * 0.44),        // widest waist
    new THREE.Vector2(maxR * 0.97 * jit(0.05), len * 0.60),
    new THREE.Vector2(maxR * 0.74 * jit(0.06), len * 0.74), // shoulder taper
    new THREE.Vector2(maxR * 0.46 * jit(0.06), len * 0.86),
    new THREE.Vector2(noseR * 1.5 * jit(0.06), len * 0.94),
    new THREE.Vector2(Math.max(0.02, noseR), len),          // nose tip
  ];
}

// ──────────────────────────────────────────────────────────────────────────
// Lofted faceted ship hull (a real angular hull, NOT a smooth lathe tube)
// ──────────────────────────────────────────────────────────────────────────

/** A ship-hull cross-section normalized to half-extents 1×1, centred on (0,0):
 *  flat keel/bottom, hard bottom chines, vertical sides, a flat dorsal DECK,
 *  top chines. Points go CCW. Lofting this reads as a real hull (flat deck for
 *  the bridge, flat sides for panel lines, hard chine line) — not a dome. */
const SHIP_SECTION: ReadonlyArray<readonly [number, number]> = [
  [-0.60, -1.00], [0.60, -1.00],   // flat keel
  [0.90, -0.78],                    // bottom chine
  [1.00, -0.30], [1.00, 0.45],      // vertical side
  [0.80, 0.84],                     // top chine
  [0.44, 1.00], [-0.44, 1.00],      // flat dorsal deck
  [-0.80, 0.84],                    // top chine
  [-1.00, 0.45], [-1.00, -0.30],    // vertical side
  [-0.90, -0.78],                   // bottom chine
];

export interface LoftStation { z: number; halfW: number; halfH: number; cy?: number }

/** Loft the ship-hull cross-section along +Z through a list of stations (each a
 *  half-width/half-height + optional vertical centre), building a FACETED hull
 *  with a flat dorsal deck, hard chines, and flat sides. Open ends (for fracture
 *  faces / transom). Outward normals → FrontSide shows the outside, the interior
 *  shows through from inside the bay. */
export function makeLoftedHull(stations: LoftStation[], material: THREE.Material, thickness = 0): THREE.Mesh {
  const N = SHIP_SECTION.length;
  const ringOf = (s: LoftStation, inset: number): THREE.Vector3[] =>
    SHIP_SECTION.map(([x, y]) => new THREE.Vector3(
      x * Math.max(0.05, s.halfW - inset), (s.cy ?? 0) + y * Math.max(0.05, s.halfH - inset), s.z));
  const pos: number[] = [];
  const push = (v: THREE.Vector3) => { pos.push(v.x, v.y, v.z); };
  const loft = (rings: THREE.Vector3[][], inward: boolean) => {
    for (let i = 0; i < rings.length - 1; i++) {
      const A = rings[i], B = rings[i + 1];
      for (let k = 0; k < N; k++) {
        const k2 = (k + 1) % N;
        // Quad wound for OUTWARD normals on the OUTER skin (CCW section + +Z loft);
        // reversed (inward-facing) for the INNER skin. M7-R BUGFIX: the two
        // branches were SWAPPED — the outer skin was wound inward-facing and the
        // inner skin outward-facing, so under a FrontSide material the outer skin
        // culled from outside and the inner skin culled from inside (the Skyfall
        // "wall visible from the wrong side / see-through hull" report). The
        // legacy callers (megaWreck/procgen/leviathan) hid this by forcing the
        // hull material DoubleSide; Skyfall's hull is FrontSide, so it showed.
        // Cross-check: on the +x flank, the OUTER branch's face normal is +x
        // (outward) with this winding. Positions are unchanged → DoubleSide
        // callers + hullCollide trimeshes are byte-identical.
        if (inward) { push(A[k]); push(B[k]); push(B[k2]); push(A[k]); push(B[k2]); push(A[k2]); }
        else { push(A[k]); push(B[k2]); push(B[k]); push(A[k]); push(A[k2]); push(B[k2]); }
      }
    }
  };
  const outer = stations.map((s) => ringOf(s, 0));
  loft(outer, false);
  // Optional WALL THICKNESS — a second inner skin + rim caps at the two open ends, so the
  // hull reads as thick plating (not a paper edge) where it's torn open (fracture, bow tip,
  // transom). Also makes the collision trimesh a solid wall (no thin-surface tunnelling).
  if (thickness > 0) {
    const inner = stations.map((s) => ringOf(s, thickness));
    loft(inner, true);
    for (const idx of [0, stations.length - 1]) {
      const O = outer[idx], I = inner[idx], endFlip = idx === 0;
      for (let k = 0; k < N; k++) {
        const k2 = (k + 1) % N;
        if (endFlip) { push(O[k]); push(I[k2]); push(I[k]); push(O[k]); push(O[k2]); push(I[k2]); }
        else { push(O[k]); push(I[k]); push(I[k2]); push(O[k]); push(I[k2]); push(O[k2]); }
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, material);
}

// ──────────────────────────────────────────────────────────────────────────
// Exposed former rings (internal structure shown at breaks/breaches)
// ──────────────────────────────────────────────────────────────────────────

/** Exposed internal rib/former rings — thin tori spaced along the +X axis, sized
 *  just inside the hull radius so the structure reads where the skin is torn open.
 *  Position the returned group at a torn end / breach mouth. */
export function makeFormerRings(
  radius: number,
  count: number,
  spacing: number,
  opts?: { startX?: number; tube?: number; taper?: number; arc?: number },
): THREE.Group {
  const g = new THREE.Group();
  const tube = opts?.tube ?? Math.max(0.04, radius * 0.06);
  const startX = opts?.startX ?? 0;
  const taper = opts?.taper ?? 0.02;
  const arc = opts?.arc ?? Math.PI * 2;     // < 2π → a partial arc with its GAP centred at the bottom
  for (let i = 0; i < count; i++) {
    const r = Math.max(0.1, radius * (0.84 - i * taper));
    const tseg = Math.max(8, Math.round(20 * arc / (Math.PI * 2)));
    const geo = new THREE.TorusGeometry(r, tube, 10, tseg, arc);
    if (arc < Math.PI * 2) geo.rotateZ(Math.PI / 2 - arc / 2);   // gap → bottom (so a rib springs from the deck, no belly hoop)
    const ring = new THREE.Mesh(geo, _formerMat);
    ring.rotation.y = Math.PI / 2;       // ring plane ⟂ +X
    ring.position.x = startX + i * spacing;
    g.add(ring);
  }
  return g;
}

// ──────────────────────────────────────────────────────────────────────────
// Breach (torn hole) — vertex-displaced look, NO boolean cut
// ──────────────────────────────────────────────────────────────────────────

const _flapGeo = new THREE.ConeGeometry(0.5, 1, 3);   // shared unit torn-flap

/** A torn breach built in LOCAL space facing +Z (place it on a hull flank with
 *  +Z = the surface OUTWARD normal): a recessed dark void + a ragged ring of
 *  bent torn-metal flaps. Reads as a hole punched through the skin without any
 *  CSG. Tag children `isWreckDecoration` via `tagBreach` before adding. */
export function makeBreach(radius: number, rand: Rng): THREE.Group {
  const g = new THREE.Group();
  // Recessed interior darkness (slightly behind the skin so it reads as depth).
  const voidDisc = new THREE.Mesh(new THREE.CircleGeometry(radius * 0.95, 14), _voidMat);
  voidDisc.position.z = -radius * 0.45;
  g.add(voidDisc);
  // Dark collar bridging the skin plane to the recessed disc, so an OBLIQUE sightline
  // hits a dark wall (not daylight) through the hole — reads as a real cavity.
  const collar = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.95, radius * 0.95, radius * 0.45, 14, 1, true),
    _voidMat,
  );
  collar.rotation.x = Math.PI / 2; collar.position.z = -radius * 0.225;
  g.add(collar);
  // Torn rim flaps — irregular bent plates splayed outward around the rim.
  const flapN = 7 + Math.floor(rand() * 4);
  for (let i = 0; i < flapN; i++) {
    const a = (i / flapN) * Math.PI * 2 + (rand() - 0.5) * 0.5;
    const fl = radius * (0.55 + rand() * 0.6);
    const fw = radius * (0.22 + rand() * 0.18);
    const flap = new THREE.Mesh(_flapGeo, _tornMat);
    flap.scale.set(fw, fl, Math.max(0.04, radius * 0.12));
    const rr = radius * 0.85;
    flap.position.set(Math.cos(a) * rr, Math.sin(a) * rr, radius * (0.05 + rand() * 0.12));
    // Cone points +Y by default → point it radially outward from the rim, bent out.
    flap.rotation.z = a - Math.PI / 2;
    flap.rotation.x = (rand() - 0.5) * 0.7;     // bend out of plane
    g.add(flap);
  }
  return g;
}

/** Tag every mesh in a breach (or any decoration group) so `findPanelMount`
 *  won't place a salvage panel on top of it. */
export function tagWreckDecoration(group: THREE.Object3D): void {
  group.traverse((o) => { o.userData.isWreckDecoration = true; });
}

/** Localized vertex displacement — shove the verts of `geo` within `radius` of a
 *  LOCAL-space `center` by `push` (world-ish units) along `dir`, falloff smooth.
 *  For impact crumple / a driven-into-sand crushed nose (NOT a boolean cut). */
export function dentGeometry(
  geo: THREE.BufferGeometry,
  center: THREE.Vector3,
  radius: number,
  push: THREE.Vector3,
): void {
  const p = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.set(p.getX(i), p.getY(i), p.getZ(i));
    const d = v.distanceTo(center);
    if (d >= radius) continue;
    const t = 1 - d / radius;                 // 1 at center → 0 at edge
    const f = t * t * (3 - 2 * t);            // smoothstep falloff
    p.setXYZ(i, v.x + push.x * f, v.y + push.y * f, v.z + push.z * f);
  }
  geo.computeVertexNormals();
}

/** A sagging cable/conduit as a TubeGeometry along a Catmull-Rom curve from `a`
 *  to `b` with the midpoint dropped by `sag` (gravity droop). For dangling cables
 *  at a hull fracture, conduit runs, etc. */
export function makeCable(
  a: THREE.Vector3,
  b: THREE.Vector3,
  sag: number,
  mat: THREE.Material,
  radius = 0.06,
): THREE.Mesh {
  const mid = a.clone().lerp(b, 0.5);
  mid.y -= sag;
  const q1 = a.clone().lerp(mid, 0.5); q1.y -= sag * 0.4;
  const q2 = mid.clone().lerp(b, 0.5); q2.y -= sag * 0.4;
  const curve = new THREE.CatmullRomCurve3([a, q1, mid, q2, b]);
  return new THREE.Mesh(new THREE.TubeGeometry(curve, 14, radius, 5, false), mat);
}

// ──────────────────────────────────────────────────────────────────────────
// Windward sand-drift mound (half-burial; visual only)
// ──────────────────────────────────────────────────────────────────────────

/** A wind-drifted sand pile heaped against a wreck's windward flank — a low,
 *  flattened, organic dome (~20° slope) sunk so only the drift shows, blended to
 *  the terrain. Visual only (sand is non-traversable anyway). Returns a
 *  WORLD-positioned Mesh to add to the scene. */
export function makeSandMound(
  terrain: Terrain,
  cx: number,
  cz: number,
  windDir: THREE.Vector2,
  size: number,
  rand: Rng,
  opts?: { proud?: number },
): THREE.Mesh {
  const h = size * 0.42;                                   // ~atan(h/size) drift slope
  const geo = new THREE.ConeGeometry(size, h, 14, 2, false);
  // Squash + perturb the rim verts so it reads as an organic drift, not a cone.
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const t = (y + h / 2) / h;                             // 0 base → 1 apex
    const wob = 1 + (Math.sin(x * 5.1 + z * 3.7) * 0.18 + (rand() - 0.5) * 0.12) * (1 - t);
    p.setXYZ(i, x * wob, y * 0.62, z * wob);               // flatten + wobble base
  }
  geo.computeVertexNormals();
  const mound = new THREE.Mesh(geo, _sandMat);
  // Offset toward the windward side.
  const ox = cx + windDir.x * size * 0.45;
  const oz = cz + windDir.y * size * 0.45;
  const gy = terrain.heightAt(ox, oz);
  // `proud` = the drift CREST height above terrain, as a fraction of `size` (the apex
  // sits at gy + proud*size). The default (-0.0942) reproduces the legacy near-buried
  // drift exactly (ship/megaWreck callers unchanged); the POI assembler passes a small
  // POSITIVE proud (ACBB Tier 2) so the drift actually BANKS up as a visible crest
  // against the wreck base instead of sinking below the sand to a clean seam. The cone
  // apex (post-squash, ConeGeometry apex at +h/2) sits at position.y + 0.62*h/2 = +0.1302*size.
  const proud = opts?.proud ?? -0.0942;
  mound.position.set(ox, gy + proud * size - 0.1302 * size, oz);
  mound.rotation.y = rand() * Math.PI * 2;
  mound.receiveShadow = true;
  return mound;
}

// ── T6 — WebGL static-mesh MERGE (the never-cut perf win) ──────────────
//
// Collapse a wreck's many static, non-interactive meshes into ONE merged
// mesh per (material, attribute-signature) — the dominant draw-call cost.
// Salvage PANELS (interactive, animated doors) are kept LIVE. Colliders are
// built per-part BEFORE this runs (`attachCompoundCollider`) so per-part
// collision shapes survive the merge (Rapier colliders are independent of
// the meshes — removing the visual meshes afterward leaves the body intact).
//
// Each geometry is baked into ROOT-LOCAL space (the mega-wreck D189 bake) so
// the merged mesh, added as a child of `root`, inherits the wreck's
// terrain-align transform. Returns {before, after} mesh counts for logging.
export function mergeStaticByMaterial(
  root: THREE.Object3D,
  opts?: { includeTransparent?: boolean },
): { before: number; after: number } {
  root.updateMatrixWorld(true);
  const rootInv = root.matrixWorld.clone().invert();
  // Group baked geometries by material UUID + attribute signature (uv presence)
  // so every group is mergeable (mergeGeometries needs identical attributes).
  const groups = new Map<string, { mat: THREE.Material; geos: THREE.BufferGeometry[]; meshes: THREE.Mesh[]; cast: boolean; recv: boolean }>();
  let before = 0;
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.geometry) return;
    // Skip the whole salvage-PANEL subtree (animated doors + interaction state)
    // AND any interactable subtree (journals, loot, triggers — userData.interactType),
    // so merging arbitrary hand POIs can't silently fold a live interaction into a
    // static mesh. (ACAP — hardened for the hand-POI merge sweep.)
    let n: THREE.Object3D | null = o;
    while (n) { if (n.userData?.accessPanel || n.userData?.noMerge || n.userData?.interactType) return; n = n.parent; }
    if (Array.isArray(m.material)) return;            // multi-material meshes: leave as-is (rare)
    const mat = m.material as THREE.Material;
    // Transparent is normally left unmerged to preserve per-mesh depth sort. The
    // ACAX breaker-board skeleton opts IN: it's a single renderOrder band built
    // strictly back-to-front, so the merged buffer order IS the correct draw order.
    if (mat.transparent && !opts?.includeTransparent) return;
    before++;
    const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
    m.updateWorldMatrix(true, false);
    g.applyMatrix4(rootInv.clone().multiply(m.matrixWorld));        // → root-local
    if (!g.attributes.normal) g.computeVertexNormals();
    const hasUV = !!g.attributes.uv;
    for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal' && name !== 'uv') g.deleteAttribute(name);
    // Sub-group so shadow behaviour is preserved (a merged mesh has ONE castShadow flag).
    const key = mat.uuid + (hasUV ? '|uv' : '|nouv') + (m.castShadow ? '|cs' : '') + (m.receiveShadow ? '|rs' : '');
    let grp = groups.get(key);
    if (!grp) { grp = { mat, geos: [], meshes: [], cast: m.castShadow, recv: m.receiveShadow }; groups.set(key, grp); }
    grp.geos.push(g); grp.meshes.push(m);
  });
  let after = 0;
  for (const { mat, geos, meshes, cast, recv } of groups.values()) {
    const merged = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
    if (!merged) { geos.forEach((g) => g.dispose()); continue; }    // merge failed → leave originals untouched
    if (geos.length > 1) geos.forEach((g) => g.dispose());
    const mm = new THREE.Mesh(merged, mat);
    mm.userData.noCollider = true; mm.castShadow = cast; mm.receiveShadow = recv;
    root.add(mm); after++;
    for (const om of meshes) om.parent?.remove(om);
  }
  return { before, after };
}
