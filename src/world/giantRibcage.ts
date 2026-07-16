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

// ── BONE GAUGE (reviewer-tuned, and the tuning has history — do not overshoot in
//    either direction). Ribs: r ~0.82 base → "thin curved spikes / tusks" (REJECTED);
//    r ~1.34 base → "too chunky and wide" (REJECTED). These are the middle: a rib is
//    a substantial curved BONE, ~2.1m across at the spine, slimming to a still-blunt
//    ~0.76m across at the buried tip. The spine tube slims in step so the ridge keeps
//    its relative mass without reading as a pipeline. ──
const RIB_R_BASE = 1.00;   // rib tube radius at the spine attach (× the size envelope)
const RIB_R_TIP = 0.36;    // rib tube radius at the buried tip (× the size envelope)
const SPINE_R0 = 0.60;     // backbone radius at the buried ends
const SPINE_R1 = 0.36;     // + this × envelope at the crown (→ 0.96 max)

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

// ── A tapered, curved SOLID tube swept along a polyline (a rib or the backbone).
//    Per-ring radius from `radii`; parallel-transport frames keep the tube from
//    twisting on the curve. Both ends fan to a centre vertex → the tube is CAPPED
//    at both ends (a broken rib leaves its terminal radius fat → a real snapped
//    cross-section, never a knife edge). Carries UVs so it MERGES into the bone
//    bucket (one draw call). ──
function sweptTube(
  pts: THREE.Vector3[], radii: number[], radial: number, wobble = 0.06,
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
  for (let i = 0; i < n; i++) {
    if (i > 0) {
      q.setFromUnitVectors(prevT, tangents[i]);
      normal.applyQuaternion(q);
      prevT.copy(tangents[i]);
    }
    normal.addScaledVector(tangents[i], -normal.dot(tangents[i])).normalize();
    const B = new THREE.Vector3().crossVectors(tangents[i], normal).normalize();
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
      positions.push(
        pts[i].x + (normal.x * c + B.x * s) * rw,
        pts[i].y + (normal.y * c + B.y * s) * rw,
        pts[i].z + (normal.z * c + B.z * s) * rw,
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
  // End caps — fan each terminal ring to a centre vertex (both ends CLOSED). The
  // centre vertex is pushed OUT along the tangent by DOME × r, so a terminal ring is
  // a shallow blunt DOME rather than a flat disc: a flat disc cap on a fat snapped
  // radius reads as a sawn-off PIPE end, while a years-weathered bone break is fat
  // but rounded off. Still fully closed (no boundary edges → `openend` stays clean)
  // and still a FAT cross-section (no knife edge, no taper-to-nothing).
  const DOME = 0.42;
  const baseC = positions.length / 3;
  positions.push(
    pts[0].x - tangents[0].x * radii[0] * DOME,
    pts[0].y - tangents[0].y * radii[0] * DOME,
    pts[0].z - tangents[0].z * radii[0] * DOME,
  ); uvs.push(0, 0.5);
  for (let j = 0; j < radial; j++) indices.push(baseC, j + 1, j);
  const tipC = positions.length / 3;
  const last = (n - 1) * stride;
  positions.push(
    pts[n - 1].x + tangents[n - 1].x * radii[n - 1] * DOME,
    pts[n - 1].y + tangents[n - 1].y * radii[n - 1] * DOME,
    pts[n - 1].z + tangents[n - 1].z * radii[n - 1] * DOME,
  ); uvs.push(1, 0.5);
  for (let j = 0; j < radial; j++) indices.push(tipC, last + j, last + j + 1);

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
        // The snapped face keeps the tube's FULL local radius (×0.96) → sweptTube's end
        // cap fans a FAT blunt cross-section, a real broken bone, never a knife edge.
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
          group.add(boneMesh(sweptTube(laid.pts, laid.rad, 8)));
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
      group.add(boneMesh(sweptTube(full, radii, 9)));
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
        const arc = boneMesh(sweptTube(fpts, frad, 7));
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
