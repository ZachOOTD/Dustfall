// Session XX — larger enterable tent. Walk-in shelter the player
// physically enters (in contrast to tent.ts's smaller "sleep next to
// it" pyramid). Geometry: 3-walled cabin with open front, cloth-draped
// frame, walk-in interior cavity. Player capsule fits inside; shelter
// zone covers the interior so being inside grants the warmth bubble.
//
// Architecture (D80 — distinct module vs. parameterized): kept as a
// separate file from tent.ts because the collider geometry diverges
// (3-wall walk-in vs. simple pyramid). Two modules is cheaper than
// one parameterized for this scope.
//
// Pack-up (UU-2 pattern): RMB on the large tent → packUpLargeTent
// via wieldAction.ts's handleContextAction.
//
// AAY — visual redesign: Bedouin "beit al-sha'ar" silhouette (peaked
// ridge, visible poles, guy ropes, weathered fabric patches, interior
// rug). Terrain-slope alignment so the tent + stakes sit flush.
//
// AAZ — visual polish + operational doorway:
//   * Off-white canvas color (replaces dark goat-hair brown)
//   * Subdivided PlaneGeometry roof + walls with catenary sag for
//     organic cloth read (vs. pre-AAZ flat BoxGeometry panels)
//   * Doorway roll fixed to span full width + tucked under the front
//     gable apex (no more floating)
//   * Operational door — hovering the doorway shows "open"/"close"
//     prompt; E toggles. Closed door fully encloses the shelter zone
//     (storm dampen 0); open door reverts to the YY "open-fronted"
//     dampen 0.4. Door animation lerps the roll thickness + the
//     hanging fabric panel scale.

import * as THREE from 'three';
import type { GameContext } from '../GameContext.ts';
import { Tuning } from '../config/tuning.ts';
import {
  addShelterZone,
  removeShelterZone,
  type ShelterZone,
} from '../shelter/shelterZones.ts';
import { addItem } from '../inventory/inventory.ts';
import { playBandageUse } from '../audio/audio.ts';
import { createFabricMaterial } from './fabricMaterial.ts';

export interface LargeTent {
  id: number;
  mesh: THREE.Group;
  shelterZone: ShelterZone;
  pos: THREE.Vector3;
  rotationY: number;
  hovered: boolean;
  /** AAZ — door state. doorOpen is the target; doorAnim is the eased
   *  current visual position. 0 = closed (fabric hanging full); 1 = open
   *  (fabric rolled up at the gable). */
  doorOpen: boolean;
  doorAnim: number;
  /** AAZ — mesh refs for the doorway tick. Roll thickness scales with
   *  doorAnim (visible when open); panel scale.y scales with (1-doorAnim)
   *  so it shrinks upward as it rolls. */
  doorPanel: THREE.Mesh;
  doorRoll: THREE.Mesh;
}

let _nextId = 1;

/** Tag every mesh in the tent with the registry/id pair so any raycast
 *  hit resolves back to the right LargeTent. The doorPanel + doorRoll +
 *  doorHitArea additionally carry an `interactSubKind='door'` marker so
 *  the interaction case can branch into the toggle path. */
function tag(root: THREE.Object3D, id: number): void {
  root.traverse((o) => {
    o.userData.interactType = 'sleep';   // reuse 'sleep' verb (same as small tent)
    o.userData.interactId = id;
    o.userData.interactRegistry = 'largeTents';
  });
}

/** AAY — align a placeable mesh's local up (+Y) to the terrain normal so
 *  it tilts with the slope instead of floating vertically on slanted
 *  ground. Pre-AAY the tent stood straight up regardless of terrain,
 *  leaving rope stakes hanging in midair on the uphill side. Samples 4
 *  cardinal heights at `radius` and computes a finite-difference gradient
 *  → up-vector. The mesh's facing direction (yaw around world Y) is
 *  preserved by projecting the desired forward onto the tilted plane.
 *
 *  Could be lifted into a shared helper for bedroll / locker / fire later;
 *  kept inline here until a second caller wants it. */
function alignMeshToTerrain(
  mesh: THREE.Object3D,
  terrain: { heightAt: (x: number, z: number) => number },
  pos: THREE.Vector3,
  yaw: number,
  radius: number,
): void {
  const hE = terrain.heightAt(pos.x + radius, pos.z);
  const hW = terrain.heightAt(pos.x - radius, pos.z);
  const hN = terrain.heightAt(pos.x, pos.z + radius);
  const hS = terrain.heightAt(pos.x, pos.z - radius);
  // Slope gradient (height-per-meter along each axis).
  const dxGrad = (hE - hW) / (2 * radius);
  const dzGrad = (hN - hS) / (2 * radius);
  // Terrain normal (right-handed, +Y up). When the ground rises in +X,
  // the normal tilts toward -X.
  const normal = new THREE.Vector3(-dxGrad, 1, -dzGrad).normalize();

  // Desired forward in world XZ-plane (matches the legacy `rotation.y = yaw`
  // semantics — local +Z maps to (sin yaw, 0, cos yaw) in world).
  const desiredForward = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
  // Project onto the plane perpendicular to `normal` so forward + up are
  // orthogonal. If the forward is nearly parallel to the normal (steep
  // cliff), the projection collapses — fall back to world forward.
  const forward = desiredForward
    .clone()
    .sub(normal.clone().multiplyScalar(desiredForward.dot(normal)));
  if (forward.lengthSq() < 1e-6) forward.set(0, 0, 1);
  forward.normalize();
  // Right vector completes the right-handed basis: right = up × forward.
  const right = new THREE.Vector3().crossVectors(normal, forward).normalize();
  // Reproject forward = right × up to guarantee orthonormality after the
  // initial projection's rounding.
  forward.crossVectors(right, normal).normalize();

  // Apply: rotation built from the three orthonormal basis vectors. We
  // don't touch position here — caller sets pos before/after.
  const basis = new THREE.Matrix4().makeBasis(right, normal, forward);
  mesh.quaternion.setFromRotationMatrix(basis);
}

/** AAZ — smooth, deterministic noise for fabric micro-wrinkles. Three
 *  sin waves at incommensurable frequencies produce a natural-looking
 *  irregular surface variation without the overhead of a real noise lib.
 *  Output range is roughly [-1, 1]; multiply by a small amplitude to
 *  add 1-2cm of natural cloth wrinkle on top of the macro catenary sag. */
function fabricNoise(x: number, y: number, seed: number): number {
  const a = Math.sin(x * 2.7 + seed * 1.3) * Math.cos(y * 3.1 + seed * 0.7);
  const b = Math.sin(x * 4.9 + seed * 2.1) * Math.cos(y * 5.3 + seed * 1.5);
  const c = Math.sin(x * 8.1 + seed * 3.7) * Math.cos(y * 7.3 + seed * 2.5);
  return (a + b * 0.5 + c * 0.25) / 1.75;
}

/** AAZ — vertex displacement helper. Maps every vertex in `geo` through
 *  the callback (which returns dx/dy/dz) and recomputes normals so
 *  lighting picks up the new surface curvature. Generic enough to use
 *  on any BoxGeometry / PlaneGeometry — sag direction is up to the
 *  caller. Pre-AAZ this was inlined per-call; lifting it makes adding
 *  sag to the walls (not just roof) a one-liner. */
function displaceVertices(
  geo: THREE.BufferGeometry,
  fn: (x: number, y: number, z: number) => { dx?: number; dy?: number; dz?: number },
): void {
  const positions = geo.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const y = positions.getY(i);
    const z = positions.getZ(i);
    const d = fn(x, y, z);
    positions.setXYZ(i, x + (d.dx ?? 0), y + (d.dy ?? 0), z + (d.dz ?? 0));
  }
  positions.needsUpdate = true;
  geo.computeVertexNormals();
}

/** AAZ — subdivided BoxGeometry sagged along its local +Y direction
 *  (the natural "thickness" axis for a horizontal-built fabric panel).
 *  Catenary macro sag + per-vertex fabric wrinkles. Edges stay pinned
 *  at sag = 0 because both sin(πu) and sin(πv) → 0 at u/v ∈ {0,1}.
 *
 *  Pre-AAZ-polish: sag only; cloth read as a smooth dome.
 *  AAZ-polish: sag + smooth noise wrinkle modulated by the same edge-
 *  pinning envelope (sin·sin) so micro-detail still tapers to zero at
 *  supports. The combined effect is fabric draped naturally between
 *  rigid attachment points. */
function makeSaggedFabricPanel(
  w: number,
  thickness: number,
  d: number,
  segW: number,
  segD: number,
  sagAmount: number,
  wrinkleAmount: number,
  seed: number,
  material: THREE.Material,
): THREE.Mesh {
  const geo = new THREE.BoxGeometry(w, thickness, d, segW, 1, segD);
  displaceVertices(geo, (x, _y, z) => {
    const u = x / w + 0.5;
    const v = z / d + 0.5;
    // Edge envelope — peaks at center, zero at edges. Modulates both the
    // macro sag and the micro wrinkle so the panel stays pinned to its
    // supports while drooping + rippling in the interior.
    const envelope = Math.sin(Math.PI * u) * Math.sin(Math.PI * v);
    const macroSag = sagAmount * envelope;
    const microWrinkle = wrinkleAmount * fabricNoise(x, z, seed) * envelope;
    return { dy: macroSag + microWrinkle };
  });
  return new THREE.Mesh(geo, material);
}

/** AAZ — Bedouin desert-tent visual (off-white canvas with sagged cloth
 *  panels). Returns the group plus refs to the doorway panel + roll so
 *  the per-frame `updateLargeTents` tick can animate them.
 *
 *  Geometry recipe: low side walls (PlaneGeometry, slight outward bow);
 *  two slanted roof panels meeting at the ridge (PlaneGeometry with
 *  catenary sag); back + front gables (ExtrudeGeometry triangles); ridge
 *  poles + horizontal interior ridge beam; weathered patches scattered
 *  per-id; five guy ropes + ground stakes; interior rug. The front face
 *  is open by default — the doorway panel hangs from the top when
 *  closed. */
function makeLargeTentVisual(idForSeed: number): {
  group: THREE.Group;
  doorPanel: THREE.Mesh;
  doorRoll: THREE.Mesh;
} {
  const g = new THREE.Group();
  const W = Tuning.LARGE_TENT_WIDTH_M;
  const D = Tuning.LARGE_TENT_DEPTH_M;
  const SIDE_H = Tuning.LARGE_TENT_SIDE_WALL_H_M;
  const RIDGE_Y = Tuning.LARGE_TENT_RIDGE_PEAK_Y_M;
  const POLE_RISE = Tuning.LARGE_TENT_POLE_PROTRUDE_M;
  const POLE_R = Tuning.LARGE_TENT_POLE_RADIUS_M;
  const GUY_REACH = Tuning.LARGE_TENT_GUY_REACH_M;
  const GUY_R = Tuning.LARGE_TENT_GUY_RADIUS_M;
  const STAKE_H = Tuning.LARGE_TENT_STAKE_H_M;
  const PATCH_COUNT = Tuning.LARGE_TENT_PATCH_COUNT;
  const ROOF_SAG = Tuning.LARGE_TENT_ROOF_SAG_M;
  const WALL_BOW = Tuning.LARGE_TENT_WALL_BOW_M;
  const WRINKLE = Tuning.LARGE_TENT_FABRIC_WRINKLE_M;
  const FABRIC_THICK = 0.04;
  // Per-tent wrinkle seed — varies surface noise between tents so they
  // don't all look stamped from one mould.
  const WRINKLE_SEED = (idForSeed * 0.7361) % 17.3;

  const RISE = RIDGE_Y - SIDE_H;
  const HALF_W = W * 0.5;
  const SLANT_LEN = Math.hypot(HALF_W, RISE);
  const SLANT_ANGLE = Math.atan2(RISE, HALF_W);

  // AAZ — off-white canvas palette. Pre-AAZ was deep goat-hair brown
  // (0x342819 / 0x7a6750); the lighter tones read more as worn travelling
  // canvas + better differentiate seams + patches against the base.
  //
  // AAZ-polish: createFabricMaterial patches MeshLambertMaterial with a
  // procedural weave + color variation + stain shader. Replaces the
  // pre-AAZ-polish flat MeshLambertMaterial which read as painted card-
  // board even with the sag geometry.
  const fabricMat = createFabricMaterial(0xd4c5a8, THREE.DoubleSide);
  const patchMat = createFabricMaterial(0xa48f6e, THREE.DoubleSide);
  const rugMat = new THREE.MeshLambertMaterial({ color: 0x8a3a26 });   // muted red ochre
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x4a3320 });
  const ropeMat = new THREE.MeshLambertMaterial({ color: 0x4a3a26 });
  const stakeMat = new THREE.MeshLambertMaterial({ color: 0x3a2818 });

  // ── Interior rug, offset toward the back so the entry threshold reads
  // as bare sand floor.
  {
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.55, D * 0.55), rugMat);
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(0, 0.015, -D * 0.10);
    g.add(rug);
  }

  // ── Back wall: subdivided BoxGeometry. Vertices displace in -Z
  // (outward, since the wall is positioned at -D/2 and faces -Z) by a
  // sin·sin envelope + the fabric noise. The result is a soft outward
  // bulge with fabric wrinkles instead of a flat plywood face.
  {
    const lowerGeo = new THREE.BoxGeometry(W, SIDE_H, FABRIC_THICK, 10, 5, 1);
    displaceVertices(lowerGeo, (x, y, _z) => {
      const u = x / W + 0.5;
      const v = y / SIDE_H + 0.5;
      const envelope = Math.sin(Math.PI * u) * Math.sin(Math.PI * v);
      const bow = -WALL_BOW * envelope;   // -Z = outward for the back wall
      const wrinkle = WRINKLE * fabricNoise(x, y, WRINKLE_SEED + 3.7) * envelope;
      return { dz: bow + wrinkle };
    });
    const lower = new THREE.Mesh(lowerGeo, fabricMat);
    lower.position.set(0, SIDE_H * 0.5, -D * 0.5 - FABRIC_THICK * 0.5);
    g.add(lower);

    // Back gable triangle (peak above the wall). ExtrudeGeometry; sagged
    // gables would need custom BufferGeometry — visual gain doesn't pay
    // the LOC.
    const tri = new THREE.Shape();
    tri.moveTo(-HALF_W, 0);
    tri.lineTo(HALF_W, 0);
    tri.lineTo(0, RISE);
    tri.closePath();
    const triGeo = new THREE.ExtrudeGeometry(tri, { depth: FABRIC_THICK, bevelEnabled: false });
    const gable = new THREE.Mesh(triGeo, fabricMat);
    gable.position.set(0, SIDE_H, -D * 0.5 - FABRIC_THICK);
    g.add(gable);
  }

  // ── Side walls: subdivided BoxGeometry, bowed outward in ±X. Same
  // envelope-modulated sag + wrinkle as the back wall, with the sag
  // direction set per side.
  for (const sx of [-1, 1]) {
    const wallGeo = new THREE.BoxGeometry(FABRIC_THICK, SIDE_H, D, 1, 5, 8);
    displaceVertices(wallGeo, (_x, y, z) => {
      const u = z / D + 0.5;
      const v = y / SIDE_H + 0.5;
      const envelope = Math.sin(Math.PI * u) * Math.sin(Math.PI * v);
      const bow = sx * WALL_BOW * envelope;   // +X for right wall, -X for left
      const wrinkle = WRINKLE * fabricNoise(z, y, WRINKLE_SEED + sx * 1.7) * envelope;
      return { dx: bow + wrinkle };
    });
    const wall = new THREE.Mesh(wallGeo, fabricMat);
    wall.position.set(sx * (HALF_W + FABRIC_THICK * 0.5), SIDE_H * 0.5, 0);
    g.add(wall);
  }

  // ── Roof: two slanted subdivided panels meeting at the ridge along
  // X. BoxGeometry preserves real thickness; the subdivision + sag adds
  // catenary droop between the ridge and the side-wall top, with fabric
  // wrinkles layered on top for natural cloth read.
  for (const side of [-1, 1]) {
    // Sag direction: negative pushes Y in the panel's local frame
    // downward (toward the structure interior). After the Z-rotation,
    // local -Y maps roughly to world -Y, so the visible effect is the
    // fabric dipping under gravity. Each side gets a phase-shifted
    // wrinkle seed so the two panels read as separate cloth pieces, not
    // mirrored copies.
    const panel = makeSaggedFabricPanel(
      SLANT_LEN + 0.05, FABRIC_THICK, D + 0.10,
      12, 6,
      -ROOF_SAG,
      WRINKLE,
      WRINKLE_SEED + side * 4.2,
      fabricMat,
    );
    panel.position.set(side * HALF_W * 0.5, (SIDE_H + RIDGE_Y) * 0.5, 0);
    panel.rotation.z = -side * SLANT_ANGLE;
    g.add(panel);
  }

  // ── Front gable + operational doorway. The gable triangle closes the
  // peaked top of the front; the door panel hangs below it (closed
  // state) or rolls up into the doorRoll bundle (open state).
  let doorPanel: THREE.Mesh;
  let doorRoll: THREE.Mesh;
  {
    const triF = new THREE.Shape();
    triF.moveTo(-HALF_W, 0);
    triF.lineTo(HALF_W, 0);
    triF.lineTo(0, RISE);
    triF.closePath();
    const triGeoF = new THREE.ExtrudeGeometry(triF, { depth: FABRIC_THICK, bevelEnabled: false });
    const gableF = new THREE.Mesh(triGeoF, fabricMat);
    gableF.position.set(0, SIDE_H, D * 0.5);
    g.add(gableF);

    // ── Doorway roll — full width, tucked under the gable apex. Pre-AAZ
    // this was a 55%-width cylinder floating 15cm below the side-wall
    // top; AAZ pins it at SIDE_H + 0.04 (just above the entry, snug
    // against the gable bottom) and spans the entry minus a small inset
    // to clear the corner poles.
    const ROLL_LEN = W * 0.96;
    const ROLL_R = 0.085;
    const roll = new THREE.Mesh(
      new THREE.CylinderGeometry(ROLL_R, ROLL_R, ROLL_LEN, 10),
      patchMat,
    );
    roll.rotation.z = Math.PI / 2;   // align cylinder axis with world X
    roll.position.set(0, SIDE_H + 0.04, D * 0.5);
    g.add(roll);
    doorRoll = roll;

    // ── Door panel — hangs from the gable bottom when closed. Geometry
    // is translated so the TOP edge sits at the local origin; the mesh
    // is positioned at SIDE_H so scale.y = 1 → fabric reaches the ground,
    // scale.y = 0 → fabric collapses upward into the roll. Subdivided +
    // sagged slightly so it reads as cloth, not a cardboard panel.
    const doorGeo = new THREE.PlaneGeometry(W * 0.96, SIDE_H, 10, 5);
    // Bow the door panel OUTWARD (toward +Z = away from the tent
    // interior). The front face of the tent is at z = D*0.5; pushing
    // the fabric further in +Z reads as the loose cloth billowing OUT
    // when the door is closed — what you'd see standing outside the
    // tent. Pre-AAZ-bow-fix the sign was negative (inward bow) which
    // looked like the cloth was getting sucked into the interior.
    {
      const positions = doorGeo.attributes.position;
      for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i);
        const y = positions.getY(i);
        const u = x / (W * 0.96) + 0.5;
        // v: 0 at top edge, 1 at bottom — sag is heaviest near the bottom
        // (gravity pulls the loose end out + away from the tent).
        const vRaw = y / SIDE_H + 0.5;
        const v = vRaw * vRaw;  // weight toward the bottom
        const bump = WALL_BOW * Math.sin(Math.PI * u) * v;
        positions.setZ(i, bump);
      }
      positions.needsUpdate = true;
      doorGeo.computeVertexNormals();
    }
    // Translate origin to TOP edge — scale.y collapses toward the top.
    doorGeo.translate(0, -SIDE_H * 0.5, 0);
    const panel = new THREE.Mesh(doorGeo, fabricMat);
    panel.position.set(0, SIDE_H + 0.02, D * 0.5);
    g.add(panel);
    doorPanel = panel;

    // ── Door hit area — invisible plane covering the entry, marked with
    // interactSubKind='door' so the player hovering the doorway gets the
    // toggle prompt rather than the sleep prompt. Sits slightly in front
    // of the door panel + roll so the raycast hits it first when both are
    // present. Stays present in open + closed states.
    const hitGeo = new THREE.PlaneGeometry(W * 0.96, SIDE_H * 1.02);
    const hitMat = new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide });
    const hit = new THREE.Mesh(hitGeo, hitMat);
    hit.position.set(0, SIDE_H * 0.5, D * 0.5 + 0.08);
    hit.userData.interactSubKind = 'door';
    g.add(hit);
  }

  // ── Ridge poles: two visible wooden uprights at the long-axis ends,
  // protruding above the apex by POLE_RISE.
  for (const sz of [-1, 1]) {
    const totalH = RIDGE_Y + POLE_RISE;
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(POLE_R, POLE_R * 1.2, totalH, 6),
      poleMat,
    );
    pole.position.set(0, totalH * 0.5, sz * (D * 0.5 - 0.04));
    g.add(pole);
  }

  // ── Interior ridge beam: horizontal pole connecting the two upright
  // pole tops. Reads as a structural member when looking up inside.
  {
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(POLE_R * 0.7, POLE_R * 0.7, D - 0.10, 6),
      poleMat,
    );
    beam.rotation.x = Math.PI / 2;
    beam.position.set(0, RIDGE_Y - POLE_R * 0.5, 0);
    g.add(beam);
  }

  // AAZ-polish — roof patches removed. They read as floating squares
  // since the procedural fabric shader now provides the
  // weathering/staining variation that the patches were attempting to
  // simulate. PATCH_COUNT + idForSeed retained in the function signature
  // for now in case a future pass wants to bring them back differently
  // (e.g. as actual hole-and-repair stitches with thread geometry).
  void PATCH_COUNT;
  void idForSeed;

  // ── Guy ropes + stakes. Five anchors: four side-wall tops + back
  // ridge. Front-side ridge guy is intentionally omitted so the entry
  // stays clear of low-hanging ropes.
  const anchors: Array<{ ax: number; ay: number; az: number; dx: number; dz: number }> = [
    { ax: -HALF_W, ay: SIDE_H, az: -D * 0.5, dx: -GUY_REACH * 0.7, dz: -GUY_REACH * 0.7 },
    { ax:  HALF_W, ay: SIDE_H, az: -D * 0.5, dx:  GUY_REACH * 0.7, dz: -GUY_REACH * 0.7 },
    { ax: -HALF_W, ay: SIDE_H, az:  D * 0.5, dx: -GUY_REACH * 0.7, dz:  GUY_REACH * 0.7 },
    { ax:  HALF_W, ay: SIDE_H, az:  D * 0.5, dx:  GUY_REACH * 0.7, dz:  GUY_REACH * 0.7 },
    { ax: 0, ay: RIDGE_Y + POLE_RISE * 0.4, az: -D * 0.5, dx: 0, dz: -GUY_REACH * 1.2 },
  ];

  const upVec = new THREE.Vector3(0, 1, 0);
  for (const a of anchors) {
    const sx = a.ax + a.dx;
    const sz = a.az + a.dz;
    const sy = 0;
    const dx = sx - a.ax;
    const dy = sy - a.ay;
    const dz = sz - a.az;
    const len = Math.hypot(dx, dy, dz);
    const rope = new THREE.Mesh(
      new THREE.CylinderGeometry(GUY_R, GUY_R, len, 4),
      ropeMat,
    );
    rope.position.set((a.ax + sx) * 0.5, (a.ay + sy) * 0.5, (a.az + sz) * 0.5);
    const dir = new THREE.Vector3(dx, dy, dz).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(upVec, dir);
    rope.quaternion.copy(q);
    g.add(rope);

    const stake = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.04, STAKE_H, 4),
      stakeMat,
    );
    stake.position.set(sx, STAKE_H * 0.35, sz);
    g.add(stake);
  }

  return { group: g, doorPanel, doorRoll };
}

/** Attempt to deploy a large tent in front of the camera. Returns null
 *  if too close to an existing large tent. Mirrors deployTent + the
 *  D75 PLACEMENT_DISTANCE_M pattern. */
export function deployLargeTent(ctx: GameContext): LargeTent | null {
  const cam = ctx.three.camera;
  const dir = new THREE.Vector3();
  cam.getWorldDirection(dir);
  dir.y = 0;
  if (dir.lengthSq() < 1e-4) dir.set(0, 0, -1);
  dir.normalize();
  const distance = Tuning.PLACEMENT_DISTANCE_M + Tuning.LARGE_TENT_DEPTH_M * 0.5;
  const pos = new THREE.Vector3()
    .copy(cam.position)
    .addScaledVector(dir, distance);
  pos.y = ctx.terrain.heightAt(pos.x, pos.z);

  for (const existing of ctx.largeTents.list) {
    if (existing.pos.distanceToSquared(pos) < Tuning.LARGE_TENT_NEAR_DISTANCE_SQ) {
      return null;
    }
  }

  const rotationY = Math.atan2(-dir.x, -dir.z);
  return spawnLargeTentAt(ctx, pos, rotationY);
}

/** Materialise a large tent at a world position + Y rotation. Used by
 *  both deployLargeTent (player action) and save/load (restored pose).
 *  AAZ — tent always restores in the OPEN state (doorAnim=1). Save/load
 *  doesn't track doorOpen yet — see backlog. */
export function spawnLargeTentAt(
  ctx: GameContext,
  pos: THREE.Vector3,
  rotationY: number,
): LargeTent {
  const id = _nextId++;
  const { group: mesh, doorPanel, doorRoll } = makeLargeTentVisual(id);
  mesh.position.copy(pos);
  alignMeshToTerrain(
    mesh,
    ctx.terrain,
    pos,
    rotationY,
    Tuning.LARGE_TENT_WIDTH_M * 0.5,
  );
  mesh.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });
  ctx.three.scene.add(mesh);

  tag(mesh, id);

  const shelterZone = addShelterZone(
    ctx.shelter,
    { x: pos.x, y: pos.y + Tuning.LARGE_TENT_SHELTER_HALF_Y, z: pos.z },
    {
      x: Tuning.LARGE_TENT_SHELTER_HALF_X,
      y: Tuning.LARGE_TENT_SHELTER_HALF_Y,
      z: Tuning.LARGE_TENT_SHELTER_HALF_Z,
    },
    { isLargeTent: true },   // initial state: door is OPEN → open-fronted
  );

  // Initial visual state — door open: panel collapsed (scale.y = 0),
  // roll fully visible (scale.y/z = 1). updateLargeTents will lerp these
  // each frame as the player toggles the door.
  doorPanel.scale.y = 0;
  doorRoll.scale.y = 1;
  doorRoll.scale.z = 1;

  const tent: LargeTent = {
    id,
    mesh,
    shelterZone,
    pos: pos.clone(),
    rotationY,
    hovered: false,
    doorOpen: true,
    doorAnim: 1,
    doorPanel,
    doorRoll,
  };
  ctx.largeTents.list.push(tent);
  return tent;
}

/** AAZ — per-frame tick. Eases doorAnim toward its target (1 if doorOpen,
 *  0 if closed), and applies the result to the panel + roll meshes. Cheap
 *  no-op when every tent is at rest. */
export function updateLargeTents(ctx: GameContext, dt: number): void {
  const speed = Tuning.LARGE_TENT_DOOR_ANIM_SPEED;
  for (const t of ctx.largeTents.list) {
    const target = t.doorOpen ? 1 : 0;
    if (t.doorAnim === target) continue;
    const step = speed * dt;
    if (t.doorAnim < target) t.doorAnim = Math.min(target, t.doorAnim + step);
    else t.doorAnim = Math.max(target, t.doorAnim - step);
    // Door panel: visible (full extension) when closed, collapsed when open.
    t.doorPanel.scale.y = 1 - t.doorAnim;
    // Roll: thicker (visible bundle) when open, gone when closed. The
    // cylinder's radius axes are Y and Z after the Z-rotation that
    // aligned the cylinder along world X.
    t.doorRoll.scale.y = t.doorAnim;
    t.doorRoll.scale.z = t.doorAnim;
  }
}

/** AAZ — toggle the doorway open/closed. Mutates ctx.shelterZone's
 *  isLargeTent flag dynamically so storm dampening updates with the
 *  door state: closed door → fully enclosed (storm visible = 0); open
 *  door → open-fronted (storm visible = 0.4 per LARGE_TENT_STORM_DAMPEN). */
export function toggleLargeTentDoor(ctx: GameContext, tent: LargeTent): void {
  tent.doorOpen = !tent.doorOpen;
  // Shelter zone's isLargeTent flag drives the perceived-intensity
  // dampening in updateShelter. Closed = full enclosure, open = dampened.
  tent.shelterZone.isLargeTent = tent.doorOpen;
  // SFX: short cloth rustle. Reuses the bandage-use sound (cloth-tear
  // + pad-pat texture from AAN) — closest existing sound to fabric
  // rolling/unrolling without adding a new audio routine this session.
  playBandageUse();
  ctx.ui.showToast(tent.doorOpen ? 'doorway open' : 'doorway closed');
}

/** Save/load bumps the id counter past restored ids. */
export function setNextLargeTentId(n: number): void {
  if (n > _nextId) _nextId = n;
}

export function findLargeTentById(list: LargeTent[], id: number | undefined): LargeTent | undefined {
  if (id === undefined) return undefined;
  return list.find((t) => t.id === id);
}

/** Pack the tent into inventory. Atomic: tries `addItem` first;
 *  if inventory full, refuses + tent stays placed. Symmetric to
 *  packUpTent in tent.ts (UU-2). */
export function packUpLargeTent(ctx: GameContext, tent: LargeTent): boolean {
  // Check: is the player currently INSIDE this tent? If so, refuse —
  // don't yank shelter out from under the player.
  const tr = ctx.player.body.body.translation();
  const zone = tent.shelterZone;
  const insideThisTent =
    Math.abs(tr.x - zone.cx) <= zone.hx &&
    Math.abs(tr.y - zone.cy) <= zone.hy &&
    Math.abs(tr.z - zone.cz) <= zone.hz;
  if (insideThisTent) {
    ctx.ui.showToast("can't pack — you're inside the tent");
    return false;
  }
  // Try to give the kit back first.
  const slotIdx = addItem(ctx.inventory, 'large_tent_kit', undefined, ctx);
  if (slotIdx < 0) {
    ctx.ui.showToast('no room in your bag');
    return false;
  }
  removeShelterZone(ctx.shelter, tent.shelterZone);
  ctx.three.scene.remove(tent.mesh);
  const i = ctx.largeTents.list.indexOf(tent);
  if (i >= 0) ctx.largeTents.list.splice(i, 1);
  ctx.ui.showToast('shelter packed');
  return true;
}
