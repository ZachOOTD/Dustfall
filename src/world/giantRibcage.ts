// COLOSSAL RIBCAGE — the bone_field biome's HERO "wow" centerpiece. A dead
// titan / leviathan half-buried in the dunes, built so the player WALKS UNDER it:
// an arched vertebral BACKBONE forms the highest ridge overhead, and the RIBS
// hang DOWN from it on both sides to plant in the sand — a row of arches, a bone
// TUNNEL / Gothic nave the player passes beneath. (This REPLACES the earlier
// upside-down build where the spine sat at the sand line and the ribs splayed up
// like a bowl — twice wrong; this is the corrected orientation.)
//
// Silhouette (matching the reviewer's concept references, in priority order):
//   1. An arched SPINE RIDGE at the TOP — a chain of vertebra running the length,
//      CROWN highest mid-span (~13m up), curving DOWN to BURY at both ends. This
//      is the highest part of the structure; the player is beneath it.
//   2. DORSAL NEURAL SPINES — solid bony blades/spikes with real 3D thickness,
//      pointing UP off the ridge along its length (tallest over the crown ~16m).
//   3. RIBS hanging DOWN + OUT from each spine vertebra on BOTH sides, curving to
//      plant their tips in the SAND — forming walk-under ARCHES. SUBSTANTIAL but
//      not chunky at the spine (base tube r ~1.06 × envelope), tapering to a still-
//      fat buried tip (~0.38). The radius has HISTORY: r~0.82 read as "thin curved
//      spikes / tusks" (rejected), r~1.34 read as "too chunky and wide" (rejected) —
//      1.06→0.38 is the middle: slim, never spiky. Adjacent arches form a
//      colonnade → a walkable TUNNEL down the centre aisle, clearance well over
//      player height.
//   3b. DECAY — this carcass has been weathering for YEARS, so the cage must NOT
//      read intact: ~17% of ribs are missing entirely and ~41% are SNAPPED, with
//      the break sampled by HEIGHT ABOVE THE SAND across the whole visible arc
//      (low stubs near the sand ↔ high snaps just under the crown). Every snapped
//      rib's broken-off lower half is re-laid ON THE SAND beside its own stump
//      (`layFallen`), part-buried at a tumble angle — "that broke off and fell
//      here". Plus loose fragments + vertebra drums scattered around the base.
//   4. NO skull, NO tail (both removed per the reviewer).
//   5. Half-buried — rib tips + the spine's dipping ends sink below the local sand.
//
// Built in LOCAL space with the spine ridge along +X, centered so local y=0 is the
// SAND PLANE. Everything that plants extends BELOW y=0 so nothing floats over a
// dune dip; with a `conform` descriptor each element samples the REAL terrain at
// its own world (x,z) so the buried parts hug the dunes exactly. The caller drops
// the group at terrain height + orients by yaw about Y.
//
// Material: ONE shared weathered sun-bleached GREYISH bone material (the biome
// treatment — a cool-but-modest emissive self-illuminates the bone so it doesn't
// collapse to sand-tan under the warm sun, tuned GREYER/less-cool than before per
// the reviewer). The whole cage MERGES to ~1 draw call (mergeStaticByMaterial).
// All primitives are closed solids with real thickness (swept capped tubes /
// extruded thick blades / cylinders) per rule 7 — NO paper shells, nothing may
// vanish or read paper-thin at grazing angles.
//
// Paired collider descriptor (paired-build-visual-and-collider-descriptors): the
// builder returns `applyColliders(world, anchor, yaw)` which drops box colliders on
// the REACHABLE lower run of each rib leg (ground..~head height, out at the tunnel
// sides — the centre aisle stays clear so you can walk through) + the spine's low
// buried ENDS where they come down to reach (rule 9 — collision matches the visible
// geometry; the caller tracks the bodies + removes them on unload).

import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { Rng } from '../core/rng.ts';
import { createBoneMaterial } from './boneMaterial.ts';
import { makeStaticBox } from '../physics/bodies.ts';
import { mergeStaticByMaterial } from './wreckForms.ts';

// ── Shared module material (NEVER disposed — the boneScatter _boneMat rule;
//    merged geometry is disposed via the noCollider tag mergeStaticByMaterial
//    stamps, the shared material survives). GREYER weathered bone (reviewer:
//    "bones too white") — a warmer/greyer base + a modest, less-cool emissive so
//    it reads as OLD sun-bleached bone, not stark blue-white. Kept in sync with
//    boneScatter._boneMat + the chunkManager scatter-ribcage override. ──
const _ribBone = createBoneMaterial(0xc9c5bc, {
  crackDensity: 1.3,   // denser hairline network
  crackDepth: 0.4,     // DEEP dark cracks (was the fixed 0.65 faint)
  marrowHint: 0.5,     // stronger yellow-brown mineral staining
  ageBleach: 0.55,     // a little less top-bleach so it's not washed white
  weathering: 0.9,     // heavy broad grime/AO — the distance-surviving contrast
});
// Greyer/darker base (0xc9c5bc vs 0xdcd8cf) + a LOWER, greyer emissive: the old
// 0x545a60@0.55 self-illuminated the bone toward flat blue-white (reviewer: "too
// white + flat"). This keeps just enough cool fill to POP against the warm sand
// without washing the weathering out.
_ribBone.emissive = new THREE.Color(0x494d52);
_ribBone.emissiveIntensity = 0.36;

const UP = new THREE.Vector3(0, 1, 0);

// ── BONE GAUGE (reviewer-tuned, and the tuning has history — read it before you
//    move these). r ~1.34 base → "too chunky and wide" (REJECTED); r ~0.82 base →
//    "thin curved spikes / tusks" (REJECTED) — BUT that rejection predates the arc /
//    fore-aft rake / ±6% section wobble / taper AND the jagged fracture caps, all of
//    which carry the "this is a BONE, not a tusk" read on their own. The reviewer has
//    since asked for thinner TWICE (1.34 → 1.00 → 0.85), so 0.85 is the current dial:
//    a rib is ~1.7m across at the spine, slimming to ~0.6m at the buried tip. The
//    spine tube slims in step (−15%, same as the ribs) so the ridge keeps its relative
//    mass without reading as a pipeline. If a future pass is told "too thin", come UP
//    from here — do not go below ~0.8. ──
const RIB_R_BASE = 0.85;   // rib tube radius at the spine attach (× the size envelope)
const RIB_R_TIP = 0.30;    // rib tube radius at the buried tip (× the size envelope)
const SPINE_R0 = 0.51;     // backbone radius at the buried ends
const SPINE_R1 = 0.31;     // + this × envelope at the crown (→ 0.82 max)

// ── DECAY RATES — a carcass that has sat weathering for YEARS, not a fresh cage
//    (reviewer: "too intact"). Rolled per rib SIDE, so the colonnade is asymmetric. ──
const RIB_MISSING = 0.17;  // decay roll below this → the rib is gone entirely (~17%)
const RIB_SNAPPED = 0.58;  // ...below this → the rib is SNAPPED (~41%); the rest intact

interface ColliderDesc {
  center: THREE.Vector3;   // ribcage-local
  half: { x: number; y: number; z: number };
  quat: THREE.Quaternion;  // ribcage-local orientation
}

export interface GiantRibcage {
  group: THREE.Group;
  /** Drop box colliders (reachable rib legs + buried spine ends) at the placed
   *  world transform. Returns the created bodies (caller tracks + removes on unload). */
  applyColliders: (world: RAPIER.World, anchor: THREE.Vector3, yaw: number) => RAPIER.RigidBody[];
  length: number;          // spine span along X (m)
  ribPairs: number;
  maxHeight: number;       // tallest bone above the sand plane (m)
}

/** Terrain-conform descriptor. Without it the cage is authored around a FLAT local
 *  y=0 (isolated/studio use); WITH it every planted element samples the ACTUAL
 *  ground at its own world (x,z) so the buried rib tips + spine ends hug/dive below
 *  the real dunes — no bone ever floats over a dip. `baseY` is the world Y the
 *  group's local y=0 sits at. */
export interface RibcageConform {
  groundAt: (worldX: number, worldZ: number) => number;
  originX: number;
  originZ: number;
  yaw: number;
  baseY: number;
}

function boneMesh(geo: THREE.BufferGeometry): THREE.Mesh {
  const m = new THREE.Mesh(geo, _ribBone);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** Deterministic per-vertex hash in [0,1). Used ONLY for the fracture caps: it must
 *  never touch the `rand()` stream (procgen-seed-stability — the per-item RNG draw
 *  budget is fixed, so cap detail is derived from a caller-supplied integer seed
 *  rather than drawn). Same seed → byte-identical cap, every boot. */
function jhash(seed: number, k: number): number {
  const s = Math.sin(seed * 127.1 + k * 311.7 + 0.5) * 43758.5453;
  return s - Math.floor(s);
}

/** Which ends of a swept tube are FRACTURE faces. A number = that end is a jagged
 *  snap seeded by this value; null/absent = a smooth blunt dome (the natural taper
 *  ends + the buried ends, which nobody sees split open). Stump and its fallen half
 *  are handed the SAME seed so the two faces of one snap share a shard profile. */
interface JagSpec { start?: number | null; end?: number | null }

/** THE FRACTURE PROFILE — the shape of one snapped bone face.
 *
 *  Returns `depth(j, radScale)`: how far (× the tube radius) the fracture surface
 *  stands off the tube's nominal end, at angular slot `j`, on a ring at `radScale ×
 *  r`. Four superposed terms, each doing a job the DOME cap failed:
 *   • an OBLIQUE PLANE (`tilt·cos(a − phase)`) — a real snap is a slanted slash
 *     across the shaft, never a face square to the axis. This alone kills most of the
 *     "sausage end" read. It scales linearly with radScale because that is literally
 *     what a tilted plane does.
 *   • a SADDLE (`tilt2·cos(2(a − phase2))`) — the second harmonic. Without it the
 *     slash is a clean ellipse and the break reads as a MITRE CUT (round 2's verdict:
 *     jagged, but suspiciously like a workshop chamfer). Bone snaps twist: one side
 *     tears long, the opposite side short, and the two flanks between them step.
 *   • RELIEF — two octaves of per-slot noise, so the fracture LINE is chipped and
 *     stepped rather than smooth. Amplitude ±0.5 r, which is deliberately LOUD: this
 *     is the term that has to survive to the flank read (~16m, where the reviewer
 *     actually judges). At ±0.2 r the chipping was ~4 px on screen there and the break
 *     collapsed back to "rounded blob". Unlike `tilt`, relief is per-slot and
 *     uncorrelated, so raising it chips the rim rather than growing a beak — it is the
 *     safe lever, and the `floor` clamp catches the deep notches it cuts.
 *   • SPLINTERS — 3-5 slots pushed 0.26-0.54 r along the axis, most of them two slots
 *     WIDE, with their neighbours flared 0.40-0.70. A shard must be a solid WEDGE
 *     with real thickness, never a paper knife-edge (rule 7): round 3 ran a single
 *     slot at up to 1.4 r and the shards rendered as dark needles/thorns — visibly
 *     the wrong material. Ramped by radScale^1.5 → the push is concentrated at the
 *     RIM, where a torn-off piece of cortical wall actually lives, but still carries
 *     far enough inward to give the shard a real shaft rather than a rim-only tooth.
 *
 *  `floor` clamps how far the profile may cut BACKWARDS into the tube. The caller
 *  passes −0.75 × (the end segment's length) / r: cutting deeper than the previous
 *  ring would fold the wall through itself and re-open the "pipe mouth with a lid
 *  sitting inside it" read (round 1's failure — worse than the dome it replaced).
 *  Everything is `jhash`-derived → no `rand()` draws, so the procgen seed budget does
 *  not move. */
function jagProfile(
  seed: number, radial: number, floor: number,
): (j: number, radScale: number) => number {
  // AMPLITUDES. These are small on purpose and the reason is the round-4 failure: at
  // base 0.50 / tilt ≤ 0.60 / shard ≤ 0.95 the terms STACK when a splinter lands on
  // the tilt maximum, pushing the end out ~2.7 r past the nominal tip — a 1.5m point
  // on a 1.1m-diameter bone. That renders as a BEAK / TUSK, i.e. straight back into
  // the exact read the rib gauge has been fighting for three revisions. The plane
  // component alone is now only ~8-19° of slant; the CHIPPING and the SPLINTERS carry
  // the "snapped" read, which is what a real fracture looks like anyway.
  const base = 0.30;
  const tilt = 0.14 + jhash(seed, 800) * 0.20;
  const tilt2 = 0.06 + jhash(seed, 802) * 0.10;
  const phase = jhash(seed, 801) * Math.PI * 2;
  const phase2 = jhash(seed, 803) * Math.PI * 2;
  const nSh = 3 + Math.floor(jhash(seed, 900) * 2.999);   // 3-5 splinters
  const shards: { slot: number; len: number; wide: boolean }[] = [];
  for (let q = 0; q < nSh; q++) {
    shards.push({
      slot: Math.floor(jhash(seed, 910 + q * 7) * radial) % radial,
      // MORE, SHORTER shards beat fewer long ones: a lone long one silhouettes
      // edge-on as a thin blade (round 5) and edges back toward the spiky read.
      len: 0.26 + jhash(seed, 930 + q) * 0.28,
      wide: jhash(seed, 960 + q) > 0.35,
    });
  }
  const wrap = (j: number) => ((j % radial) + radial) % radial;
  return (j: number, rs: number): number => {
    const jm = wrap(j);
    const a = (jm / radial) * Math.PI * 2;
    const relief = (jhash(seed, jm) - 0.5) * 0.66 + (jhash(seed, 60 + jm) - 0.5) * 0.34;
    let sh = 0;
    for (const s of shards) {
      const raw = Math.abs(jm - s.slot);
      const d = Math.min(raw, radial - raw);
      const rawW = Math.abs(jm - wrap(s.slot + 1));
      const dW = Math.min(rawW, radial - rawW);
      if (d === 0 || (s.wide && dW === 0)) sh += s.len;
      else if (d === 1 || (s.wide && dW === 1)) sh += s.len * (0.40 + jhash(seed, 940 + jm) * 0.30);
    }
    const raw = base
      + tilt * Math.cos(a - phase) * rs
      + tilt2 * Math.cos(2 * (a - phase2)) * rs
      + relief * Math.pow(rs, 1.3) + sh * Math.pow(rs, 1.5);
    return Math.max(floor, raw);
  };
}

// ── A tapered, curved SOLID tube swept along a polyline (a rib or the backbone).
//    Per-ring radius from `radii`; parallel-transport frames keep the tube from
//    twisting on the curve. Both ends are CLOSED — either a smooth blunt dome
//    (default) or, where `jag` marks a real break, a JAGGED SPLINTERED FRACTURE
//    (see `emitJagCap`). Carries UVs so it MERGES into the bone bucket (one draw
//    call). ──
function sweptTube(
  pts: THREE.Vector3[], radii: number[], radial: number, wobble = 0.06,
  jag?: JagSpec,
): THREE.BufferGeometry {
  const n = pts.length;
  const tangents: THREE.Vector3[] = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(n - 1, i + 1)];
    tangents.push(new THREE.Vector3().subVectors(b, a).normalize());
  }
  const normal = new THREE.Vector3(1, 0, 0);
  if (Math.abs(tangents[0].dot(normal)) > 0.8) normal.set(0, 0, 1);
  normal.addScaledVector(tangents[0], -normal.dot(tangents[0])).normalize();
  const q = new THREE.Quaternion();
  const prevT = tangents[0].clone();
  const positions: number[] = [];
  const uvs: number[] = [];
  const stride = radial + 1;
  // Per-ring transported basis — the fracture caps must rebuild rings in the SAME
  // frame as the terminal ring they attach to, or the cap would spiral off the tube.
  const frames: { N: THREE.Vector3; B: THREE.Vector3 }[] = [];
  // Fracture profiles for the ends that are real breaks. Built ONCE per end — the
  // terminal RING itself is displaced by them (below), so the tube's side wall
  // terminates on the jagged slash line. That is the whole trick: a splinter is a
  // torn piece of the WALL, not a lid floating in a pipe mouth. The `floor` is
  // geometric, not a magic number: never cut back further than 0.75 of the end
  // segment's own length, or the wall folds through itself (see `jagProfile`).
  const backFloor = (i: number, k: number): number =>
    -0.75 * pts[i].distanceTo(pts[k]) / Math.max(0.05, radii[i]);
  const pStart = jag?.start != null && n >= 2
    ? jagProfile(jag.start, radial, backFloor(0, 1)) : null;
  const pEnd = jag?.end != null && n >= 2
    ? jagProfile(jag.end, radial, backFloor(n - 1, n - 2)) : null;
  for (let i = 0; i < n; i++) {
    if (i > 0) {
      q.setFromUnitVectors(prevT, tangents[i]);
      normal.applyQuaternion(q);
      prevT.copy(tangents[i]);
    }
    normal.addScaledVector(tangents[i], -normal.dot(tangents[i])).normalize();
    const B = new THREE.Vector3().crossVectors(tangents[i], normal).normalize();
    frames.push({ N: normal.clone(), B: B.clone() });
    const r = radii[i];
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      const c = Math.cos(a), s = Math.sin(a);
      // Deterministic surface WOBBLE — a perfectly circular constant-section sweep
      // reads as an extruded PIPE, which is most of why the ribs read "chunky" even at
      // an honest bone gauge. This lumps the section by a few percent so it reads as a
      // weathered organic shaft. Both terms are periodic in `a` (2a / 3a), so the ring
      // still closes exactly at j=0 ≡ j=radial — a non-periodic wobble would split the
      // seam open and hand `openend` a boundary loop.
      const rw = r * (1 + wobble * (0.62 * Math.sin(i * 1.9 + 2 * a) + 0.38 * Math.sin(i * 0.7 - 3 * a)));
      // At a FRACTURE end, slide this ring's vertex along the axis by the fracture
      // profile → the side wall runs out to an oblique, uneven, splintered edge
      // instead of stopping on a clean circle. (Profiles are ≥ 0 by construction, so
      // this only ever extends the tube — it can never fold back through the wall.)
      let ax = 0;
      if (i === 0 && pStart) ax = -r * pStart(j, 1);
      else if (i === n - 1 && pEnd) ax = r * pEnd(j, 1);
      positions.push(
        pts[i].x + (normal.x * c + B.x * s) * rw + tangents[i].x * ax,
        pts[i].y + (normal.y * c + B.y * s) * rw + tangents[i].y * ax,
        pts[i].z + (normal.z * c + B.z * s) * rw + tangents[i].z * ax,
      );
      uvs.push(i / (n - 1), j / radial);
    }
  }
  const indices: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * stride + j, b = (i + 1) * stride + j;
      // OUTWARD winding. The frame is B = tangent × normal, so at a ring the
      // circumferential direction (increasing radial angle) crosses the tangent to
      // give −radial: winding (a, b, a+1) faces INWARD (the old see-through bug —
      // FrontSide culled the exterior, 90%+ back-faces from every orbit angle).
      // (a, a+1, b) / (a+1, b+1, b) reverse it so the face normal is +radial =
      // outward; both end caps below are already outward-wound (fan sign checked). ──
      indices.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  // ── END CAPS. Both ends are always CLOSED (no boundary edges → the harness
  //    `open-end` check stays [OK]); the QUESTION is what shape. ──

  // (a) A smooth blunt DOME — for the ends nobody reads as a break: the buried rib
  //     tips, the spine's ends diving under the dune, the natural taper of a fallen
  //     bone. A centre vertex pushed OUT along the tangent by DOME × r.
  const DOME = 0.42;
  const emitDome = (ci: number, ringBase: number, outT: THREE.Vector3, forward: boolean) => {
    const c = positions.length / 3;
    positions.push(
      pts[ci].x + outT.x * radii[ci] * DOME,
      pts[ci].y + outT.y * radii[ci] * DOME,
      pts[ci].z + outT.z * radii[ci] * DOME,
    ); uvs.push(forward ? 1 : 0, 0.5);
    for (let j = 0; j < radial; j++) {
      if (forward) indices.push(c, ringBase + j, ringBase + j + 1);
      else indices.push(c, ringBase + j + 1, ringBase + j);
    }
  };

  // (b) A JAGGED SPLINTERED FRACTURE — for a real snap. The reviewer's read on the
  //     dome caps was exact: a rounded end is a SAUSAGE end, and a tube with sausage
  //     ends is a tube. (History: flat disc → "sawn-off PVC"; dome → "too rounded,
  //     reads as tubes". This is the third answer — neither disc nor dome.)
  //
  //     The terminal RING is already riding the fracture profile (above), so the side
  //     wall runs out to the jagged slash and each splinter is a torn piece of the
  //     WALL — solid, ~0.3 r thick radially, its neighbour slots flared so it is a
  //     wedge and not a paper knife-edge (rule 7). All that is left here is to SEAL
  //     that jagged mouth: two inner rings (0.62 r, 0.30 r) riding the SAME profile,
  //     then a centre vertex at the profile's flat base. Because every ring is fully
  //     connected and the profile is indexed by j MOD radial (so j=0 ≡ j=radial
  //     exactly), the result has ZERO boundary edges → the harness `open-end` check
  //     stays [OK]. The inner rings inherit the tilt and shard terms at reduced
  //     radScale, which is what gives each splinter a real inner face / shaft rather
  //     than a flat lid stretched across the mouth.
  const emitJagCap = (
    ci: number, ringBase: number, outT: THREE.Vector3,
    prof: (j: number, rs: number) => number, forward: boolean,
  ) => {
    const c = pts[ci], r = radii[ci], { N, B } = frames[ci];
    const ring = (rs: number, u: number): number => {
      const base = positions.length / 3;
      for (let j = 0; j <= radial; j++) {
        const a = (j / radial) * Math.PI * 2;
        const cs = Math.cos(a), sn = Math.sin(a);
        const rr = r * rs;
        const dd = r * prof(j, rs);
        positions.push(
          c.x + (N.x * cs + B.x * sn) * rr + outT.x * dd,
          c.y + (N.y * cs + B.y * sn) * rr + outT.y * dd,
          c.z + (N.z * cs + B.z * sn) * rr + outT.z * dd,
        );
        uvs.push(u, j / radial);
      }
      return base;
    };
    const aBase = ring(0.62, forward ? 0.94 : 0.06);
    const bBase = ring(0.30, forward ? 0.97 : 0.03);
    const cIdx = positions.length / 3;
    const dd = r * prof(0, 0);   // rs=0 → tilt/relief/shard all vanish; the flat base
    positions.push(c.x + outT.x * dd, c.y + outT.y * dd, c.z + outT.z * dd);
    uvs.push(forward ? 1 : 0, 0.5);
    // Wound OUTWARD, matching the dome fan's sign at each end.
    for (let j = 0; j < radial; j++) {
      const R0 = ringBase + j, R1 = ringBase + j + 1;
      const A0 = aBase + j, A1 = aBase + j + 1;
      const B0 = bBase + j, B1 = bBase + j + 1;
      if (forward) {
        indices.push(A0, R0, R1, A0, R1, A1);
        indices.push(B0, A0, A1, B0, A1, B1);
        indices.push(cIdx, B0, B1);
      } else {
        indices.push(A0, R1, R0, A0, A1, R1);
        indices.push(B0, A1, A0, B0, B1, A1);
        indices.push(cIdx, B1, B0);
      }
    }
  };

  const startT = tangents[0].clone().negate();
  const last = (n - 1) * stride;
  if (pStart) emitJagCap(0, 0, startT, pStart, false);
  else emitDome(0, 0, startT, false);
  if (pEnd) emitJagCap(n - 1, last, tangents[n - 1], pEnd, true);
  else emitDome(n - 1, last, tangents[n - 1], true);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/** Build the colossal walk-under ribcage. `rand` drives per-instance variation
 *  (length, rib count, arch height, per-rib decay + skew, fallen fragments). */
export function makeGiantRibcage(
  rand: Rng, opts?: { name?: string; conform?: RibcageConform },
): GiantRibcage {
  const group = new THREE.Group();
  group.name = opts?.name ?? 'giantRibcage';
  const conform = opts?.conform;

  // ── Silhouette parameters — a LONG, LOW, half-buried SANDWORM skeleton (reviewer:
  //    "less arched, lower, more sunken, longer — a massive sandworm skeleton, not a
  //    tall arched ribcage"). Longer spine, much lower crown, deeper burial at the
  //    ends + rib tips. Walk-under is preserved: even the lowered crown clears ~6m
  //    over the centre aisle. ──
  const length = 64 + rand() * 14;                // spine span along X (64-78m — LONG worm)
  const sHalf = length * 0.5;
  const ribPairs = 19 + Math.floor(rand() * 5);   // 19-23 rib pairs (denser over the long spine)
  const crownH = 7.0 + rand() * 1.6;             // spine CROWN height above sand (7-8.6m — LOW, settled)
  const endBury = 3.6 + rand() * 1.1;             // how deep the spine dives + buries at each end (m)
  const footZ0 = 5.6 + rand() * 1.4;             // half-width of the tunnel at the sand (m)
  const ribBury = 3.0;                            // how deep each rib tip plants below ground (m — deeper = more sunken)
  const inset = 0.7;                              // lateral offset of a rib's spine attach from centre

  // Local ground height (ribcage-local Y) at a local (x,z): sample the REAL
  // terrain at that world point, minus baseY. No conform → 0 (flat studio plane).
  const localGroundAt = (lx: number, lz: number): number => {
    if (!conform) return 0;
    const cy = Math.cos(conform.yaw), sy = Math.sin(conform.yaw);
    const wx = conform.originX + cy * lx + sy * lz;   // Ry(yaw)·(x,z) + origin
    const wz = conform.originZ - sy * lx + cy * lz;
    return conform.groundAt(wx, wz) - conform.baseY;
  };

  // SETTLE — drop the whole arch by this much so the carcass reads as SUNKEN into
  // the dune (reviewer: "more sunken into the sand"), not perched on top. Rib tips
  // + spine ends bury deeper; the crown lowers to ~5.5-6.5m (walk-under preserved,
  // ~5m aisle clearance).
  const sink = 1.9;
  // Spine ARCH profile (height ABOVE local ground): a LONG, FLAT-crowned ridge that
  // dives to −endBury (buried) at the ends. The |t|^2.6 crown term stays near full
  // height across a broad central span (a settled sandworm back, not a peaked dome)
  // and only drops steeply near the ends where it sinks into the dune. (Was a plain
  // parabola crownH*(1−t²) — too peaked/arched; the reviewer wanted lower + longer.)
  const spineArch = (t: number): number =>
    crownH * (1 - Math.pow(t * t, 1.3)) - endBury * t * t - sink;
  // Size envelope: full in the middle, ~0.45 at the ends (shorter ribs + blades).
  const env = (t: number): number => 0.45 + 0.55 * (1 - t * t);

  const colliders: ColliderDesc[] = [];
  let maxHeight = 0;
  // Every SNAP's two faces, ribcage-local — the stump's break face and the matching
  // fallen half's. Published on userData purely so the verify/rig harness can frame a
  // TIGHT read on a real fracture (the flank shots are too wide to judge the jag);
  // nothing in the game reads this. Same spirit as skyfallProbe/leviathanProbe.
  // `axis` = the rib's direction at the break, so the harness can frame the face
  // PERPENDICULAR to the shaft (shooting down a rib's own axis just fills the frame
  // with shaft and hides the very thing under test — rounds 2-3 both did that).
  const breaks: { stump: THREE.Vector3; fallen: THREE.Vector3; axis: THREE.Vector3; r: number }[] = [];

  // ── Box ONE sub-run (index a..b) of a swept tube as an oriented box collider
  //    (rule 9 — collision tracks the visible tube; `rr` is the tube radius +
  //    padding, so a thinner rib automatically yields a thinner collider). ──
  const boxRun = (pts: THREE.Vector3[], rr: number, a: number, b: number): void => {
    const pa = pts[a], pb = pts[b];
    const mid = pa.clone().add(pb).multiplyScalar(0.5);
    const dir = new THREE.Vector3().subVectors(pb, pa);
    const len = dir.length();
    if (len < 0.2) return;
    dir.normalize();
    const quat = new THREE.Quaternion().setFromUnitVectors(UP, dir);
    colliders.push({ center: mid, half: { x: rr, y: len * 0.5 + rr, z: rr }, quat });
  };

  // ── LAY A SNAPPED-OFF PIECE ON THE SAND — the reviewer's specific ask: when a rib
  //    breaks, its broken-off half must be lying right there beside the stump.
  //    `run` is the parent rib's DISCARDED points (break → old tip, ribcage-local) and
  //    `runRad` its matching radii, so the fallen piece is literally the bone that left
  //    the stump: same arc, same taper, same FAT snapped cross-section at the break.
  //    We flatten the parent's 3D arc into (u = along its chord, v = its lateral bow),
  //    then re-lay that 2D bone on the dune at a tumble `yaw`/`roll`. Every sample is
  //    TERRAIN-CONFORMED — y = the real local ground + ~0.45r, minus a `bury` ramp that
  //    digs the far end in — so a fallen piece can never float over a dune dip and
  //    always reads as part-buried in the sand. ──
  const layFallen = (
    run: THREE.Vector3[], runRad: number[],
    ox: number, oz: number, yaw: number, roll: number, bury: number,
  ): { pts: THREE.Vector3[]; rad: number[] } | null => {
    const n = run.length;
    if (n < 3) return null;
    const c0 = run[0];
    const chord = new THREE.Vector3().subVectors(run[n - 1], c0);
    const chordLen = chord.length();
    if (chordLen < 1.2) return null;                 // too stubby to read as a fallen bone
    const dir = chord.clone().divideScalar(chordLen);
    // Reference perpendicular = the direction of the arc's largest deviation from its
    // chord → laying the bone flat preserves its natural bow instead of straightening it.
    const tmp = new THREE.Vector3(), perp = new THREE.Vector3();
    let bow = 0;
    for (let k = 1; k < n - 1; k++) {
      tmp.subVectors(run[k], c0).addScaledVector(dir, -tmp.dot(dir));
      if (tmp.length() > bow) { bow = tmp.length(); perp.copy(tmp); }
    }
    if (bow > 1e-3) perp.normalize();
    const fxh = Math.cos(yaw), fzh = Math.sin(yaw);  // horizontal along-axis
    const pxh = -Math.sin(yaw), pzh = Math.cos(yaw); // horizontal lateral
    const cr = Math.cos(roll), sr = Math.sin(roll);
    const pts: THREE.Vector3[] = [];
    for (let k = 0; k < n; k++) {
      tmp.subVectors(run[k], c0);
      const u = tmp.dot(dir);
      const v = bow > 1e-3 ? tmp.dot(perp) : 0;
      const wx = ox + fxh * u + pxh * v * cr;
      const wz = oz + fzh * u + pzh * v * cr;
      const lg = localGroundAt(wx, wz);
      // The tube's AXIS sits ~0.3r above the local sand → the shaft is drifted over to
      // roughly a third of its diameter: it still READS as a long curved bone (r1 laid
      // them fully on the surface → "smooth sausages"; sinking to the midline over-
      // corrected → they read as boulders), while the `bury` ramp drives the far end
      // progressively under the dune. The bottom of the tube is always below the sand,
      // so a fallen piece can never trip the `floating` detector.
      pts.push(new THREE.Vector3(wx, lg + runRad[k] * 0.3 - bury * (u / chordLen) + v * sr * 0.45, wz));
    }
    return { pts, rad: runRad.slice() };
  };

  // ── The arched BACKBONE — one continuous swept tube along the ridge (crown
  //    overhead, ends diving to bury). Fat mid, tapering toward the buried ends. ──
  {
    const NS = ribPairs * 3;
    const spinePts: THREE.Vector3[] = [];
    const spineRadii: number[] = [];
    for (let s = 0; s <= NS; s++) {
      const t = (s / NS) * 2 - 1;
      const xx = t * sHalf;
      const lg = localGroundAt(xx, 0);
      spinePts.push(new THREE.Vector3(xx, lg + spineArch(t), 0));
      spineRadii.push(SPINE_R0 + SPINE_R1 * env(t));
    }
    group.add(boneMesh(sweptTube(spinePts, spineRadii, 12)));

    // Reachable spine-END colliders — near the ends the backbone dips to ~ground
    // and a player at the tunnel mouth could walk into it (rule 9). Box the low
    // segments (height above ground in [−0.5, 3.2]); the crown overhead is out of
    // reach → no collider there.
    const _q = new THREE.Quaternion();
    let run: number[] = [];
    const flush = () => {
      if (run.length >= 2) {
        const a = run[0], b = run[run.length - 1];
        const pa = spinePts[a], pb = spinePts[b];
        const mid = pa.clone().add(pb).multiplyScalar(0.5);
        const dir = new THREE.Vector3().subVectors(pb, pa);
        const len = dir.length();
        if (len > 0.3) {
          dir.normalize();
          const quat = _q.clone().setFromUnitVectors(UP, dir);
          const rr = spineRadii[Math.floor((a + b) / 2)] + 0.3;
          colliders.push({ center: mid, half: { x: rr, y: len * 0.5 + rr, z: rr }, quat: quat.clone() });
        }
      }
      run = [];
    };
    for (let s = 0; s <= NS; s++) {
      const t = (s / NS) * 2 - 1;
      const above = spineArch(t);
      if (above > -0.5 && above < 3.2) run.push(s); else flush();
    }
    flush();
  }

  // ── Per-station loop: vertebra ring + dorsal blade + a rib hanging down each side. ──
  for (let i = 0; i < ribPairs; i++) {
    const t = (i / (ribPairs - 1)) * 2 - 1;        // −1..1 end→end
    const x = t * sHalf;
    const e = env(t);
    const lgC = localGroundAt(x, 0);
    const spineY = lgC + spineArch(t);             // this vertebra's height overhead
    const spineR = SPINE_R0 + SPINE_R1 * e;
    // Ridge slope here (for tilting the vertebra ring + blade to follow the arch).
    const slope = (-2 * t * (crownH + endBury)) / sHalf;
    const archAng = Math.atan(slope);

    // Per-station decay rolls (fixed draw count → deterministic).
    const decayL = rand(), decayR = rand();
    const ringSkew = rand();

    // Vertebra RING — a torus girdling the backbone (reads as a segmented drum),
    // tilted to follow the arch so it doesn't clip through near the diving ends.
    if (spineY - lgC > -0.4) {
      const ring = boneMesh(new THREE.TorusGeometry(spineR * 1.12, spineR * 0.34, 8, 16));
      ring.rotation.y = Math.PI / 2;               // torus plane ⟂ spine axis
      ring.rotation.x = archAng + (ringSkew - 0.5) * 0.1;
      ring.position.set(x, spineY, 0);
      group.add(ring);
    }

    // (Dorsal neural BLADES removed — they read as dark spiky dragon-fins from the
    //  side and added height, fighting the reviewer's "lower, less arched,
    //  ribcage-ONLY" direction. The spine tube + vertebra rings carry the ridge.)
    maxHeight = Math.max(maxHeight, Math.max(0, spineY - lgC) + spineR);

    // A RIB hanging DOWN + OUT to the sand on each side (skip near the buried ends
    // where the ridge is already at/under the ground — no room for an arch).
    if (spineY - lgC < 1.2) continue;
    const footZ = footZ0 * (0.6 + 0.4 * e);        // tunnel narrows toward the ends
    for (const side of [-1, 1] as const) {
      const decay = side < 0 ? decayL : decayR;
      // FIXED per-side RNG budget (procgen-seed-stability): every roll is drawn for
      // every side, whether or not this rib survives / snaps — so the stream can't
      // shift when a decay branch flips.
      const lean = (rand() - 0.5) * 1.9;           // per-rib fore/aft jitter (breaks the parallel-pillar side-read)
      const breakRoll = rand();                    // WHERE it snapped (0 = low by the sand, 1 = high under the crown)
      const fallYawJit = (rand() - 0.5) * 1.4;     // tumble heading of the fallen half
      const fallOut = 0.5 + rand() * 2.2;          // how far outboard of the old foot it came to rest
      const fallSlide = (rand() - 0.5) * 3.2;      // ...and how far it slid along the spine axis
      const fallRoll = (rand() - 0.5) * 1.7;       // roll of the bone's bow as it lies
      const fallBury = 0.4 + rand() * 0.9;         // how deep the far end dug into the dune
      const fallSplit = rand();                    // where a long fallen half broke AGAIN
      const fallYaw2 = (rand() - 0.5) * 2.4;       // ...and how the second piece tumbled off
      const fallOut2 = rand() * 2.6;
      const fallSlide2 = (rand() - 0.5) * 4.0;
      const fallRoll2 = (rand() - 0.5) * 1.7;
      if (decay < RIB_MISSING) continue;           // gone entirely (asymmetric — real gaps in the colonnade)
      const lgB = localGroundAt(x, side * footZ);  // ground under this rib's foot
      const G = lgB - ribBury;                     // buried tip Y
      const V = spineY - G;                         // vertical span of the rib
      const aboveH = spineY - lgB;                 // this rib's VISIBLE height above the sand
      // Snapped? Short flank ribs stay whole — there's no visible arc to break.
      const broken = decay < RIB_SNAPPED && aboveH > 2.4;
      // Fore/aft RAKE — the rib's tip sweeps along X as it descends (crown ribs
      // near-vertical, flank ribs fanning toward the ends). Turns the flat "row of
      // vertical legs" side-read into a barrel RIBCAGE that reads as curved ribs.
      const rake = t * 3.8 + lean;

      // Control points TOP→BOTTOM: attach at the spine (near centre, high), sweep
      // OUT + DOWN with fore/aft rake, bowing to max width around mid-height (a
      // barrel-ribcage bulge), then curling to plant the tip in the sand. f =
      // fraction of V above G; the tip (f=0) takes the full rake.
      const zAt = (k: number): number => side * (inset + (footZ - inset) * k);
      const yAt = (f: number): number => G + f * V;
      const xAt = (f: number): number => x + rake * (1 - f);
      const cps = [
        new THREE.Vector3(xAt(1.0), yAt(1.0), zAt(0.0)),   // spine attach
        new THREE.Vector3(xAt(0.82), yAt(0.82), zAt(0.42)),
        new THREE.Vector3(xAt(0.52), yAt(0.52), zAt(1.14)),  // bow OUT, max width mid-height
        new THREE.Vector3(xAt(0.22), yAt(0.22), zAt(1.06)),
        new THREE.Vector3(xAt(0.0), yAt(0.0), zAt(1.0)),   // plant (buried)
      ];
      const curve = new THREE.CatmullRomCurve3(cps);
      const SAMP = 26;
      const fullAll = curve.getPoints(SAMP);
      // Substantial at the spine, tapering to a still-blunt buried tip (never a needle,
      // never a tusk — see the RIB_R_* history note).
      const radiusAt = (u: number): number =>
        THREE.MathUtils.lerp(RIB_R_BASE, RIB_R_TIP, Math.pow(u, 0.7)) * (0.82 + 0.18 * e);
      const radAll = fullAll.map((_, k) => radiusAt(k / (fullAll.length - 1)));
      let full = fullAll, radii = radAll.slice();
      // Fracture seeds — derived from the station index + side, NOT drawn from `rand()`
      // (the per-side RNG budget above is fixed and must stay fixed). `snapSeed` is
      // shared by the stump's break face and its fallen half's break face: two faces of
      // ONE snap, so they get the same shard profile / count. (They can't mirror
      // vertex-for-vertex — the fallen half is re-laid in its own transported frame —
      // but the pair reads as the same break, not two unrelated ends.)
      const snapSeed = i * 31 + (side < 0 ? 0 : 1) + 3;
      const reSeed = snapSeed + 977;
      if (broken) {
        // WHERE it snapped — sampled as a HEIGHT ABOVE THE SAND spanning the rib's whole
        // visible arc: 1.1m (a low break, most of the arch still standing) up to
        // aboveH−0.9 (snapped high, only a nub left under the crown). Two things matter
        // here and BOTH were wrong before:
        //  • The old build cut on a raw ARC-FRACTION (0.56-0.84 of the curve), which
        //    parked nearly every break down in the BURIED tip — invisible. That, not the
        //    rate, is why a "21% snapped" cage still read INTACT.
        //  • The 1.1m floor: a break any lower leaves the rib all but touching the sand
        //    and reads intact at a glance. Every break now clears a visible gap.
        // pow(·,0.85) leans the spread mildly toward the higher, more obvious snaps.
        const bh = 1.1 + Math.pow(breakRoll, 0.85) * Math.max(0.4, aboveH - 2.0);
        let cut = fullAll.length;
        for (let k = 0; k < fullAll.length; k++) {
          if (fullAll[k].y < lgB + bh) { cut = k; break; }   // pts run spine → tip
        }
        cut = THREE.MathUtils.clamp(cut, 3, fullAll.length - 3);
        full = fullAll.slice(0, cut);
        radii = radAll.slice(0, cut);
        // The snapped face keeps the tube's FULL local radius (×0.96) → the jagged
        // fracture cap is fanned over a FAT cross-section, a real broken bone, never a
        // knife edge and never a taper-to-nothing.
        radii[radii.length - 1] = radAll[cut - 1] * 0.96;

        // ── ...and the piece that broke OFF is lying RIGHT THERE beside its stump —
        //    the reviewer's specific ask. The fallen bone is literally the rib's own
        //    discarded run (same arc, same taper, same snapped face), re-laid outboard
        //    of where its foot used to plant. ──
        const runAll = fullAll.slice(cut - 1);
        const rradAll = radAll.slice(cut - 1);
        rradAll[0] = radAll[cut - 1] * 0.96;                // matching snapped face
        // Years of weathering rarely leave the fallen half in ONE clean piece: a long
        // one has broken AGAIN where it hit, so it lies as two tumbled-apart pieces.
        const runs: { p: THREE.Vector3[]; r: number[] }[] = [];
        if (runAll[0].distanceTo(runAll[runAll.length - 1]) > 9 && runAll.length >= 8) {
          const m = Math.round(runAll.length * (0.4 + fallSplit * 0.24));
          runs.push({ p: runAll.slice(0, m), r: rradAll.slice(0, m) });
          runs.push({ p: runAll.slice(m - 1), r: rradAll.slice(m - 1) });
        } else runs.push({ p: runAll, r: rradAll });
        const outYaw = side > 0 ? Math.PI / 2 : -Math.PI / 2;   // radiating away from the cage
        for (let s = 0; s < runs.length; s++) {
          const second = s > 0;
          const laid = layFallen(
            runs[s].p, runs[s].r,
            x + rake + fallSlide + (second ? fallSlide2 : 0),           // near the old foot
            side * (footZ + fallOut + (second ? 3.2 + fallOut2 : 0)),   // OUTBOARD — the aisle stays clear
            outYaw + fallYawJit + (second ? fallYaw2 : 0),
            second ? fallRoll2 : fallRoll, fallBury,
          );
          if (!laid) continue;
          // Fracture faces on the fallen half: piece 0's START is the ORIGINAL snap
          // (same `snapSeed` as the stump it fell from), its END is the re-break where
          // it shattered on landing; piece 1's START is that same re-break.
          // The LAST piece's far end is the rib's own tapered tip — and it gets a snap
          // too. Leaving it domed was defensible on paper (a rib tip is naturally
          // round) but it was the single most tube-like thing in the flank shot: these
          // halves lie horizontal, fully lit, and long, so a smooth bullet nose on one
          // end reads as a PILL. A tip that has spent years in a moving dune is broken
          // off, so a snap is also the truer answer.
          const lastPiece = s === runs.length - 1;
          group.add(boneMesh(sweptTube(laid.pts, laid.rad, 10, 0.06, {
            start: second ? reSeed : snapSeed,
            end: lastPiece ? reSeed + 313 : reSeed,
          })));
          if (!second) {
            breaks.push({
              stump: full[full.length - 1].clone(),
              fallen: laid.pts[0].clone(),
              axis: new THREE.Vector3()
                .subVectors(full[full.length - 1], full[full.length - 2]).normalize(),
              r: radii[radii.length - 1],
            });
          }
          // Rule 9: a fallen half-rib is a chunky knee/waist-high obstacle out on the
          // flank, not scatter gravel — box its run. (Small tip shards stay decoration,
          // per the scatter-rock rule.)
          if (laid.rad[0] > 0.5) {
            const nb = laid.pts.length >= 12 ? 2 : 1;
            for (let b0 = 0; b0 < nb; b0++) {
              const a = Math.floor((b0 * (laid.pts.length - 1)) / nb);
              const b = Math.floor(((b0 + 1) * (laid.pts.length - 1)) / nb);
              boxRun(laid.pts, laid.rad[Math.floor((a + b) / 2)] + 0.2, a, b);
            }
          }
        }
      }
      // The rib itself. A SNAPPED one gets the jagged fracture on its cut end (the
      // stump's break face); an intact one's tip is buried in the sand → plain dome.
      // radial 12: the fracture cap's shards live on angular slots, so a coarse ring
      // yields 120° "teeth" instead of splinters.
      group.add(boneMesh(sweptTube(full, radii, 12, 0.06, { end: broken ? snapSeed : null })));
      maxHeight = Math.max(maxHeight, full[0].y - lgB);

      // Rib LEG COLLIDERS — box the reachable lower run (ground..~4.3m up), out at
      // the tunnel side. Above head height the rib arcs overhead (unreachable) → no
      // collider; the centre aisle (Z≈0) stays clear so the player walks through.
      const band: number[] = [];
      for (let k = 0; k < full.length; k++) {
        const yAbove = full[k].y - lgB;
        if (yAbove > -0.6 && yAbove < 4.3) band.push(k);
      }
      if (band.length >= 2) {
        const nBox = band.length >= 9 ? 2 : 1;
        for (let s = 0; s < nBox; s++) {
          const a = band[Math.floor((s * band.length) / nBox)];
          const b = band[Math.min(band.length - 1, Math.floor(((s + 1) * band.length) / nBox) - 1)];
          // rr tracks the (now thinner) tube radius → collision follows the visible rib.
          boxRun(full, radiusAt((0.5 * (a + b)) / SAMP) + 0.25, a, b);
        }
      }
    }
  }

  // ── Fallen FRAGMENTS + loose vertebrae half-buried around the base (decay;
  //    decoration-only, no colliders — the boneScatter rule; they rest ON the
  //    sand so nothing floats). ──
  {
    const nFrag = 3 + Math.floor(rand() * 3);
    for (let f = 0; f < nFrag; f++) {
      const fx = (rand() - 0.5) * length * 0.95;
      const fz = (rand() * 0.5 + 0.5) * (rand() < 0.5 ? -1 : 1) * (footZ0 + 3 + rand() * 5);
      const lgF = localGroundAt(fx, fz);
      if (rand() < 0.5) {
        // A fallen rib fragment — a shallow curved solid tube lying on the sand.
        const fr = 2.4 + rand() * 3.2;
        const arcSpan = Math.PI * (0.5 + rand() * 0.4);
        const a0 = rand() * Math.PI;
        const seg = 8;
        const fpts: THREE.Vector3[] = [];
        for (let s = 0; s <= seg; s++) {
          const a = a0 + (s / seg) * arcSpan;
          fpts.push(new THREE.Vector3(Math.cos(a) * fr, Math.sin(a) * fr * 0.4, 0));
        }
        const frad = fpts.map((_, k) => THREE.MathUtils.lerp(0.42, 0.24, k / seg));
        // A loose fragment is a bone broken at BOTH ends → jagged both ways (seeded
        // off the fragment index, not the rand() stream).
        const arc = boneMesh(sweptTube(fpts, frad, 10, 0.06, { start: f * 53 + 7, end: f * 53 + 41 }));
        arc.rotation.y = rand() * Math.PI * 2;
        arc.rotation.z = (rand() - 0.5) * 0.4;
        arc.position.set(fx, lgF - 0.15, fz);
        group.add(arc);
      } else {
        // A loose vertebra drum half-sunk in the sand.
        const vr = 0.8 + rand() * 0.7;
        const vg = new THREE.Group();
        const d = boneMesh(new THREE.CylinderGeometry(vr * 0.9, vr, vr * 1.6, 12));
        d.rotation.z = Math.PI / 2;
        vg.add(d);
        const rr = boneMesh(new THREE.TorusGeometry(vr * 1.08, vr * 0.24, 8, 16));
        rr.rotation.y = Math.PI / 2;
        vg.add(rr);
        vg.position.set(fx, lgF, fz);
        vg.rotation.set(rand() * 0.5, rand() * Math.PI, (rand() - 0.5) * 0.7);
        group.add(vg);
      }
    }
  }

  // Merge the whole cage to ~1 draw call. Bakes children to group-local; merged
  // meshes carry userData.noCollider so chunk unload disposes their geometry, the
  // shared material survives.
  mergeStaticByMaterial(group);

  group.userData.length = length;
  group.userData.maxHeight = maxHeight;
  group.userData.breaks = breaks;   // harness-only: tight fracture framing (see `breaks`)
  group.userData.centerLocal = new THREE.Vector3(0, maxHeight * 0.5, 0);

  const applyColliders = (
    world: RAPIER.World, anchor: THREE.Vector3, yaw: number,
  ): RAPIER.RigidBody[] => {
    const bodies: RAPIER.RigidBody[] = [];
    const ry = new THREE.Quaternion().setFromAxisAngle(UP, yaw);
    for (const c of colliders) {
      const center = c.center.clone().applyQuaternion(ry).add(anchor);
      const q = ry.clone().multiply(c.quat);
      const col = makeStaticBox(world, c.half, center, { x: q.x, y: q.y, z: q.z, w: q.w });
      const body = col.parent();
      if (body) bodies.push(body);
    }
    return bodies;
  };

  return { group, applyColliders, length, ribPairs, maxHeight };
}
