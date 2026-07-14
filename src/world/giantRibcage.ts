// COLOSSAL RIBCAGE — the bone_field biome's HERO "wow" centerpiece (replaces
// the breaching-sandworm skeleton). A titan / dead-god's ribcage half-buried in
// the dunes: a beached leviathan the player is dwarfed beside.
//
// Silhouette (matching the reviewer's reference, in priority order):
//   1. A long horizontal SPINE keel running along +X, gently ARCHED (a shallow
//      hump, higher in the middle, dipping to BURY at both ends).
//   2. Prominent DORSAL NEURAL SPINES — big triangular bony blades sticking
//      straight UP off the keel along its whole length (a stegosaurus sail),
//      tallest over the middle.
//   3. Large RIBS springing from the keel on BOTH sides, sweeping UP + OUT,
//      bowing wide then curling back inward, tapering to points HIGH up (~14m).
//      Their lower ends plant/bury into the sand → an open CAGE to walk into +
//      through. Longest in the middle, shorter toward the ends.
//   4. Weathering/decay: some ribs snapped short, a few missing (asymmetric),
//      plus fallen rib fragments + loose vertebrae half-buried around the base.
//   5. A SKULL at the head (+X) end — elongated, tapering, low + partly buried,
//      with dark eye sockets + a long snout.
//   6. Partly SUBMERGED — the keel, rib bases + skull base bury into the sand;
//      only the upper ~60-70% shows. It sits IN the dune, not on it.
//
// Built in LOCAL space with the spine along +X (tail at -X, skull at +X),
// centered so local y=0 is the SAND PLANE. Everything that must plant extends a
// couple of metres BELOW y=0 so nothing floats over a dune dip; with a `conform`
// descriptor each element samples the REAL terrain at its own world (x,z) so the
// buried parts hug the dunes exactly (the worm's per-vertebra trick, D-worm).
// The caller drops the group at the terrain height + orients by yaw about Y.
//
// Material: ONE shared pale-bone material (the boneScatter POP treatment — a cool
// emissive self-illuminates the ivory to a pale blue-white that pops against the
// warm sand), so the whole ribcage MERGES to ~2 draw calls (mergeStaticByMaterial)
// + a dark socket material for the eyes. All primitives are inherently thick
// (swept tubes / extruded plates / cylinders / cones) per rule 7 — no paper shells.
//
// Paired collider descriptor (paired-build-visual-and-collider-descriptors): the
// builder returns `applyColliders(world, anchor, yaw)` which drops box colliders
// on the reachable lower run of each RIB + the central spine/sail + the skull
// (rule 9 — collision matches the visible geometry; the caller tracks the bodies
// + removes them on unload).

import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { Rng } from '../core/rng.ts';
import { createBoneMaterial } from './boneMaterial.ts';
import { makeStaticBox } from '../physics/bodies.ts';
import { mergeStaticByMaterial } from './wreckForms.ts';

// ── Shared module materials (NEVER disposed — the boneScatter _boneMat rule;
//    merged geometry is disposed via the noCollider tag mergeStaticByMaterial
//    stamps, the shared material survives). EXACT biome-POP treatment (identical
//    to boneScatter / wormSkeleton so the hero + the scatter read as one field). ──
const _ribBone = createBoneMaterial(0xf2f4f6, { marrowHint: 0.28, ageBleach: 0.82 });
_ribBone.emissive = new THREE.Color(0x4a5766);
_ribBone.emissiveIntensity = 0.85;
// Dark recessed eye sockets — reads as hollow eyes, not painted spots.
const _socketMat = new THREE.MeshLambertMaterial({ color: 0x140f09, flatShading: true });

const UP = new THREE.Vector3(0, 1, 0);

interface ColliderDesc {
  center: THREE.Vector3;   // ribcage-local
  half: { x: number; y: number; z: number };
  quat: THREE.Quaternion;  // ribcage-local orientation
}

export interface GiantRibcage {
  group: THREE.Group;
  /** Drop box colliders (reachable rib runs + spine/sail + skull) at the placed
   *  world transform. Returns the created bodies (caller tracks + removes on unload). */
  applyColliders: (world: RAPIER.World, anchor: THREE.Vector3, yaw: number) => RAPIER.RigidBody[];
  length: number;          // spine span along X (m)
  ribPairs: number;
  maxHeight: number;       // tallest bone above the sand plane (m)
}

/** Terrain-conform descriptor (same shape as WormConform). Without it the cage
 *  is authored around a FLAT local y=0 (isolated/studio use); WITH it every
 *  planted element samples the ACTUAL ground at its own world (x,z) so the buried
 *  keel + rib bases + skull hug/dive below the real dunes — no bone ever floats
 *  over a dip. `baseY` is the world Y the group's local y=0 sits at. */
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

// ── A tapered, curved SOLID tube swept along a polyline (a rib). Per-ring radius
//    from `radii`; parallel-transport frames keep the tube from twisting on the
//    curved rib. Both ends fan to their centre point → the fat base is capped +
//    the thin tip closes to a point (or a snapped flat end when radii[last] is
//    left fat, for a broken rib). Carries UVs so it MERGES into the same bucket
//    as the cylinder/cone bones (bone material, one draw call). ──
function sweptTube(pts: THREE.Vector3[], radii: number[], radial: number): THREE.BufferGeometry {
  const n = pts.length;
  const tangents: THREE.Vector3[] = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(n - 1, i + 1)];
    tangents.push(new THREE.Vector3().subVectors(b, a).normalize());
  }
  // Initial normal ⟂ the first tangent.
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
      positions.push(
        pts[i].x + (normal.x * c + B.x * s) * r,
        pts[i].y + (normal.y * c + B.y * s) * r,
        pts[i].z + (normal.z * c + B.z * s) * r,
      );
      uvs.push(i / (n - 1), j / radial);
    }
  }
  const indices: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * stride + j, b = (i + 1) * stride + j;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  // End caps — fan each terminal ring to a centre vertex (base cap + tip point).
  const baseC = positions.length / 3;
  positions.push(pts[0].x, pts[0].y, pts[0].z); uvs.push(0, 0.5);
  for (let j = 0; j < radial; j++) indices.push(baseC, j + 1, j);
  const tipC = positions.length / 3;
  const last = (n - 1) * stride;
  positions.push(pts[n - 1].x, pts[n - 1].y, pts[n - 1].z); uvs.push(1, 0.5);
  for (let j = 0; j < radial; j++) indices.push(tipC, last + j, last + j + 1);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// ── A dorsal neural-spine BLADE — a stegosaurus-style plate, wide at the base,
//    curving to a rounded apex, extruded to a real thickness (rule 7). Built in
//    its own X-Y plane (wide along X = spine axis, tall along +Y), `thick` along
//    Z. The caller positions + rakes it. ──
function bladeGeo(baseW: number, height: number, thick: number): THREE.BufferGeometry {
  const w = baseW * 0.5;
  // A tall TRIANGULAR fin/plate — wide base, near-straight edges tapering to a
  // sharp apex (the stegosaurus-sail read), with a slight shoulder so it's a
  // plate, not a spike.
  const shape = new THREE.Shape();
  shape.moveTo(-w, 0);
  shape.lineTo(w, 0);
  shape.lineTo(w * 0.72, height * 0.34);
  shape.lineTo(w * 0.34, height * 0.74);
  shape.lineTo(0, height);
  shape.lineTo(-w * 0.34, height * 0.74);
  shape.lineTo(-w * 0.72, height * 0.34);
  shape.lineTo(-w, 0);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thick, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 1, steps: 1,
  });
  geo.translate(0, 0, -thick * 0.5);   // centre the thickness on Z
  return geo;
}

/** Build the colossal ribcage. `rand` drives per-instance variation (length,
 *  rib count, arch, per-rib decay + skew, skull, fallen fragments). */
export function makeGiantRibcage(
  rand: Rng, opts?: { name?: string; conform?: RibcageConform },
): GiantRibcage {
  const group = new THREE.Group();
  group.name = opts?.name ?? 'giantRibcage';
  const conform = opts?.conform;

  // ── Silhouette parameters ──
  const length = 34 + rand() * 9;                 // spine span along X (34-43m)
  const sHalf = length * 0.5;
  const ribPairs = 13 + Math.floor(rand() * 4);   // 13-16 rib pairs
  const Hmid = 14 + rand() * 2.4;                  // rib mid-span emergence height (m)
  const Wmax = 5.6 + rand() * 1.4;                 // rib max half-width out from centre (m)
  const archH = 2.3 + rand() * 0.6;               // keel arch height in the middle (m) — a visible arched backbone
  const endBury = 2.4 + rand() * 0.6;             // how deep the keel dives at the ends (m)
  const ribBury = 2.2;                            // how deep each rib base plants below ground (m)
  const inset = 0.62;                             // lateral offset of a rib base from centre

  // Local ground height (ribcage-local Y) at a local (x,z): sample the REAL
  // terrain at that world point, minus baseY. No conform → 0 (flat studio plane).
  const localGroundAt = (lx: number, lz: number): number => {
    if (!conform) return 0;
    const cy = Math.cos(conform.yaw), sy = Math.sin(conform.yaw);
    const wx = conform.originX + cy * lx + sy * lz;   // Ry(yaw)·(x,z) + origin
    const wz = conform.originZ - sy * lx + cy * lz;
    return conform.groundAt(wx, wz) - conform.baseY;
  };

  // Gentle keel arch: +archH in the middle, diving to −endBury at the ends (t=±1).
  const keelArch = (t: number): number => archH * (1 - t * t) - endBury * t * t;
  // Size envelope: full in the middle, ~0.42 at the ends (shorter ribs + spines).
  const env = (t: number): number => 0.42 + 0.58 * (1 - t * t);

  const colliders: ColliderDesc[] = [];
  let maxHeight = 0;
  const _q = new THREE.Quaternion();

  // ── Per-station loop: a vertebra drum + a dorsal blade + a rib on each side. ──
  for (let i = 0; i < ribPairs; i++) {
    const t = (i / (ribPairs - 1)) * 2 - 1;        // −1..1 tail→head
    const x = t * sHalf;
    const e = env(t);
    const lgC = localGroundAt(x, 0);               // ground under the keel
    const keelY = lgC + keelArch(t);               // keel ridge height here

    // Per-station decay rolls (fixed draw count → deterministic).
    const decayL = rand(), decayR = rand();        // per-side rib fate
    const brokenFracL = 0.34 + rand() * 0.24;
    const brokenFracR = 0.34 + rand() * 0.24;
    const bladeRoll = rand();
    const drum = rand();                            // vertebra skew

    // Vertebra DRUM along the keel (fills the gap between the two rib bases +
    // reads as the arched backbone ridge running the length).
    const dr = 0.64 + e * 0.34;
    const drumMesh = boneMesh(new THREE.CylinderGeometry(dr * 0.92, dr, sHalf / ribPairs * 1.05, 10));
    drumMesh.rotation.z = Math.PI / 2;             // axis along X
    drumMesh.position.set(x, keelY, 0);
    drumMesh.rotation.x = (drum - 0.5) * 0.18;
    group.add(drumMesh);
    // Rim disc so the vertebrae read as stacked drums, not a pipe.
    const rim = boneMesh(new THREE.TorusGeometry(dr * 1.04, dr * 0.17, 6, 14));
    rim.rotation.y = Math.PI / 2;
    rim.position.set(x, keelY, 0);
    group.add(rim);

    // Dorsal NEURAL BLADE rising straight up off the keel (the sail). A few are
    // broken short or missing (weathering).
    if (bladeRoll > 0.14) {
      const bh = (3.4 + rand() * 1.3) * e * (Hmid / 15);   // the signature dorsal sail
      const bw = 2.6 + e * 1.9;                            // BROAD plates (not spikes)
      const broken = bladeRoll < 0.28;
      const blade = boneMesh(bladeGeo(bw, broken ? bh * (0.4 + rand() * 0.25) : bh, 0.42));
      blade.position.set(x, keelY + dr * 0.5, 0);
      blade.rotation.z = 0.12 + (rand() - 0.5) * 0.14;     // rake back toward the tail
      blade.rotation.y = (rand() - 0.5) * 0.16;
      group.add(blade);
      maxHeight = Math.max(maxHeight, keelY + dr * 0.5 + bh - lgC);
    }

    // A RIB on each side.
    for (const side of [-1, 1] as const) {
      const decay = side < 0 ? decayL : decayR;
      if (decay < 0.11) continue;                  // ~11% missing (asymmetric)
      const broken = decay < 0.36;                 // ~25% snapped short
      // Per-rib jitter → a decayed carcass, not a regular fabricated cage: each
      // rib varies its height + leans slightly fore/aft (out of its plane).
      const hJit = 0.8 + rand() * 0.36;
      const H = Hmid * e * hJit;
      const W = Wmax * (0.55 + 0.45 * e) * (0.9 + rand() * 0.2);
      const xd = (rand() - 0.5) * 0.9;             // small base sweep
      const lean = (rand() - 0.5) * H * 0.22;      // fore/aft lean of the upper rib
      const lgB = localGroundAt(x, side * inset);

      // Control points: buried base → keel attach → a big bowed C — bowing OUT
      // to max width around mid-height, then rising with the tip leaning gently
      // in (an OPEN ribcage crown, tips well apart, NOT a converging claw).
      const cps = [
        new THREE.Vector3(x, lgB - ribBury, side * inset * 0.5),
        new THREE.Vector3(x, keelY, side * inset),
        new THREE.Vector3(x + xd * 0.3 + lean * 0.2, lgB + H * 0.24, side * W * 0.66),
        new THREE.Vector3(x + xd * 0.6 + lean * 0.5, lgB + H * 0.54, side * W * 1.0),   // bow OUT to max width, mid-height
        new THREE.Vector3(x + xd + lean * 0.85, lgB + H * 0.84, side * W * 0.86),        // curl UP + start pulling IN
        new THREE.Vector3(x + xd + lean, lgB + H * 1.06, side * W * 0.58),               // crown: tip rises higher + leans IN → a barrel, not a splayed spike
      ];
      const curve = new THREE.CatmullRomCurve3(cps);
      const SAMP = 26;
      let full = curve.getPoints(SAMP);
      // Radius taper: FAT where it leaves the sand (a real bone), tapering to a
      // still-visible tip (not a needle).
      // MUCH thicker: substantial curved BONE ribs (a titan ribcage reads as heavy
      // fat ribs, not thin tusks — the #1 reference-match fix). Fat at the base,
      // tapering to a still-chunky tip (never a needle).
      const radiusAt = (u: number): number => THREE.MathUtils.lerp(1.42, 0.36, Math.pow(u, 0.68)) * (0.8 + 0.2 * e);
      let radii = full.map((_, k) => radiusAt(k / (full.length - 1)));
      if (broken) {
        // Snap the rib short at a jagged fraction; leave the end FAT (a real
        // broken cross-section, not a taper to nothing).
        const cut = Math.max(4, Math.round(full.length * (side < 0 ? brokenFracL : brokenFracR)));
        full = full.slice(0, cut);
        radii = radii.slice(0, cut);
        radii[radii.length - 1] = radiusAt((cut - 1) / (SAMP)) * 0.9;  // blunt snapped end
      }
      const ribMesh = boneMesh(sweptTube(full, radii, 8));
      group.add(ribMesh);
      const tipY = full[full.length - 1].y - lgB;
      maxHeight = Math.max(maxHeight, tipY);

      // Rib COLLIDERS — box the reachable lower run (ground..~4.3m) so the player
      // can't walk through a rib but can pass between them (rule 9). Above head
      // height the rib is unreachable → no collider there.
      const band: number[] = [];
      for (let k = 0; k < full.length; k++) {
        const yAbove = full[k].y - lgB;
        if (yAbove > -0.6 && yAbove < 4.3) band.push(k);
      }
      if (band.length >= 2) {
        const nBox = band.length >= 8 ? 2 : 1;
        for (let s = 0; s < nBox; s++) {
          const a = band[Math.floor((s * band.length) / nBox)];
          const b = band[Math.min(band.length - 1, Math.floor(((s + 1) * band.length) / nBox) - 1)];
          const pa = full[a], pb = full[b];
          const mid = pa.clone().add(pb).multiplyScalar(0.5);
          const dir = new THREE.Vector3().subVectors(pb, pa);
          const len = dir.length();
          if (len < 0.2) continue;
          dir.normalize();
          const quat = _q.clone().setFromUnitVectors(UP, dir);   // box +Y → chord
          const rr = radiusAt((0.5 * (a + b)) / (SAMP)) + 0.25;
          colliders.push({ center: mid, half: { x: rr, y: len * 0.5 + rr, z: rr }, quat: quat.clone() });
        }
      }
    }
  }

  // ── Central SPINE + SAIL collider — a low wall down the keel so the player
  //    can't walk through the vertebrae + dorsal blades (rule 9). Reachable band
  //    only (up to ~3m); the sail tips above that are untouchable. ──
  {
    const lgMid = localGroundAt(0, 0);
    colliders.push({
      center: new THREE.Vector3(0, lgMid + 1.4, 0),
      half: { x: sHalf * 0.94, y: 1.9, z: 0.75 },
      quat: new THREE.Quaternion(),
    });
  }

  // ── The SKULL at the head (+X) end — elongated, low, partly buried. ──
  {
    const sx = sHalf + 3.0;
    const lgS = localGroundAt(sx, 0);
    const skull = new THREE.Group();
    const r = 2.1 + rand() * 0.6;
    // Cranium — strongly elongated (a long low skull lying on its side/base).
    const cranium = boneMesh(new THREE.IcosahedronGeometry(r, 1));
    cranium.scale.set(1.75, 0.72, 0.98);
    cranium.position.set(0, r * 0.42, 0);
    skull.add(cranium);
    // Brow / occipital ridge across the back of the cranium (a bony crest).
    const brow = boneMesh(new THREE.TorusGeometry(r * 0.72, r * 0.16, 6, 14, Math.PI));
    brow.rotation.set(0, Math.PI / 2, Math.PI * 0.5);
    brow.position.set(-r * 0.25, r * 0.72, 0);
    skull.add(brow);
    // Long tapering SNOUT (the elongated muzzle).
    const snoutLen = 4.6 + rand() * 1.4;
    const snout = boneMesh(new THREE.CylinderGeometry(r * 0.14, r * 0.6, snoutLen, 9));
    snout.rotation.z = -Math.PI / 2;                       // taper toward +X
    snout.position.set(r * 1.05 + snoutLen * 0.5, r * 0.36, 0);
    skull.add(snout);
    // A hint of lower jaw resting in the sand, slightly open.
    const jaw = boneMesh(new THREE.CylinderGeometry(r * 0.13, r * 0.48, snoutLen * 0.85, 8));
    jaw.rotation.z = -Math.PI / 2;
    jaw.position.set(r * 0.95 + snoutLen * 0.36, -r * 0.02, 0);
    skull.add(jaw);
    // Cheek arches (zygomatic) — short bony struts flaring from the eyes.
    for (const s of [-1, 1] as const) {
      const cheek = boneMesh(new THREE.CylinderGeometry(r * 0.12, r * 0.2, r * 1.15, 7));
      cheek.rotation.x = s * 0.55;
      cheek.position.set(r * 0.5, r * 0.44, s * r * 0.5);
      skull.add(cheek);
    }
    // Recessed dark EYE SOCKETS in a raised bony orbit (the skull tell).
    for (const s of [-1, 1] as const) {
      const orbit = boneMesh(new THREE.TorusGeometry(r * 0.4, r * 0.14, 6, 12));
      orbit.position.set(r * 0.62, r * 0.6, s * r * 0.54);
      orbit.rotation.y = s * 0.4;
      skull.add(orbit);
      const socket = new THREE.Mesh(new THREE.SphereGeometry(r * 0.4, 10, 8), _socketMat);
      socket.position.set(r * 0.56, r * 0.6, s * r * 0.54);
      socket.scale.set(0.65, 1, 1);
      socket.castShadow = false; socket.receiveShadow = true;
      skull.add(socket);
    }
    skull.position.set(sx, lgS - r * 0.24, 0);              // base partly buried
    skull.rotation.y = (rand() - 0.5) * 0.5;
    skull.rotation.z = (rand() - 0.5) * 0.12;
    group.add(skull);
    // Skull collider.
    colliders.push({
      center: new THREE.Vector3(sx + r * 0.6, lgS + r * 0.3, 0),
      half: { x: r * 1.6 + snoutLen * 0.4, y: r * 0.9, z: r * 1.1 },
      quat: new THREE.Quaternion().setFromAxisAngle(UP, skull.rotation.y),
    });
  }

  // ── Fallen FRAGMENTS + loose vertebrae half-buried around the base (decay;
  //    decoration-only, no colliders — the boneScatter rule; they rest ON the
  //    sand so nothing floats). ──
  {
    const nFrag = 3 + Math.floor(rand() * 3);
    for (let f = 0; f < nFrag; f++) {
      const fx = (rand() - 0.5) * length * 0.95;
      const fz = (rand() * 0.5 + 0.5) * (rand() < 0.5 ? -1 : 1) * (Wmax + 3 + rand() * 4);
      const lgF = localGroundAt(fx, fz);
      if (rand() < 0.5) {
        // A fallen rib fragment — a shallow arc lying on the sand.
        const fr = 1.6 + rand() * 2.2;
        const arc = boneMesh(new THREE.TorusGeometry(fr, 0.24 + rand() * 0.12, 6, 16, Math.PI * (0.5 + rand() * 0.4)));
        arc.rotation.x = Math.PI * 0.5 + (rand() - 0.5) * 0.5;   // lie flatish
        arc.rotation.z = rand() * Math.PI;
        arc.position.set(fx, lgF - 0.25, fz);
        group.add(arc);
      } else {
        // A loose vertebra drum half-sunk in the sand.
        const vr = 0.7 + rand() * 0.6;
        const vg = new THREE.Group();
        const d = boneMesh(new THREE.CylinderGeometry(vr * 0.9, vr, vr * 1.5, 10));
        d.rotation.z = Math.PI / 2;
        vg.add(d);
        const rr = boneMesh(new THREE.TorusGeometry(vr * 1.05, vr * 0.2, 6, 14));
        rr.rotation.y = Math.PI / 2;
        vg.add(rr);
        vg.position.set(fx, lgF, fz);
        vg.rotation.set(rand() * 0.6, rand() * Math.PI, (rand() - 0.5) * 0.8);
        group.add(vg);
      }
    }
  }

  // Merge the whole cage to ~2 draw calls (bone bucket + socket bucket). Bakes
  // children to group-local; merged meshes carry userData.noCollider so chunk
  // unload disposes their geometry, the shared materials survive.
  mergeStaticByMaterial(group);

  group.userData.length = length;
  group.userData.maxHeight = maxHeight;
  group.userData.centerLocal = new THREE.Vector3(0, maxHeight * 0.5, 0);
  group.userData.skullLocal = new THREE.Vector3(sHalf + 3.0, 0, 0);

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
