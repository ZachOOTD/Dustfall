// Placeable tent — created when a tent_kit is used.
// Provides: a shelter zone + a 'sleep' interactable.
//
// AAZ-fix — visual rebuild to match the AAY/AAZ large-tent style. The
// pre-AAZ-fix small tent was a hand-rolled A-frame with flat BoxGeometry
// walls + a center pole — it looked like a cardboard prop next to the
// detailed shelter tent. AAZ-fix gives it:
//   * Off-white canvas color + the procedural fabric shader
//     (createFabricMaterial — weave, color variation, stains, micro-grain)
//   * Catenary-sagged side walls (visible cloth drape between the ridge
//     and the ground)
//   * Horizontal ridge pole + two upright end poles + guy ropes to
//     ground stakes (one per base corner)
//   * Terrain-slope alignment so it sits flush + the stakes drive in
//   * Camera-facing deploy rotation (pre-AAZ-fix was random — players
//     couldn't predict orientation)
//
// Gameplay is unchanged: shelter zone dimensions and "sleep next to it"
// semantics stay the same; the tent is NOT enterable (use the large
// shelter tent for walk-in).

import * as THREE from 'three';
import type { GameContext } from '../GameContext.ts';
import { Tuning } from '../config/tuning.ts';
import {
  addShelterZone,
  removeShelterZone,
  type ShelterZone,
} from '../shelter/shelterZones.ts';
import { addItem } from '../inventory/inventory.ts';
import { createFabricMaterial } from './fabricMaterial.ts';
import { createWoodGrainMaterial } from './woodGrainMaterial.ts';   // M6 ③ (C39) — wood-grain tent poles (was flat Lambert)
import { alignToTerrain } from '../util/terrainAlign.ts';

export interface Tent {
  id: number;
  mesh: THREE.Group;
  shelterZone: ShelterZone;
  pos: THREE.Vector3;
  rotationY: number;
  hovered: boolean;
}

let _nextId = 1;

// VV — local constants lifted to Tuning.TENT_*. Values unchanged.
const TENT_SHELTER_HALF = {
  x: Tuning.TENT_SHELTER_HALF_X,
  y: Tuning.TENT_SHELTER_HALF_Y,
  z: Tuning.TENT_SHELTER_HALF_Z,
};

function tag(root: THREE.Object3D, id: number): void {
  root.traverse((o) => {
    o.userData.interactType = 'sleep';
    o.userData.interactId = id;
    o.userData.interactRegistry = 'tents';
  });
}

// Session ABA — local alignMeshToTerrain deleted; the shared helper
// lives in src/util/terrainAlign.ts now (lifted from 3 duplicates per
// D98). Imported at top of file.

/** AAZ-fix — sagged fabric panel helper. Mirrors the same-named helper in
 *  largeTent.ts; subdivided BoxGeometry with vertex displacement along
 *  the panel's local +Y to produce a catenary droop between supports. */
function makeSaggedFabricPanel(
  w: number,
  thickness: number,
  d: number,
  segW: number,
  segD: number,
  sagAmount: number,
  material: THREE.Material,
): THREE.Mesh {
  const geo = new THREE.BoxGeometry(w, thickness, d, segW, 1, segD);
  const positions = geo.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const z = positions.getZ(i);
    const u = x / w + 0.5;
    const v = z / d + 0.5;
    const bump = sagAmount * Math.sin(Math.PI * u) * Math.sin(Math.PI * v);
    positions.setY(i, positions.getY(i) + bump);
  }
  positions.needsUpdate = true;
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, material);
}

/** AAZ-fix — small Bedouin-style pup tent visual. Two slanted side walls
 *  meeting at a horizontal ridge along the long (X) axis, with cloth
 *  sag, fabric shader, end-cap gables, ridge + end poles, and guy ropes.
 *  Returns the assembled group; spawnTentAt handles positioning + shadow
 *  setup + terrain tilt + interaction tagging. */
function makeTentVisual(): THREE.Group {
  const g = new THREE.Group();
  const L = Tuning.TENT_LENGTH_M;          // along X (ridge axis)
  const BW = Tuning.TENT_BASE_WIDTH_M;     // base-to-base across Z
  const RIDGE_Y = Tuning.TENT_RIDGE_HEIGHT_M;
  const POLE_RISE = Tuning.TENT_POLE_PROTRUDE_M;
  const POLE_R = 0.035;                    // small pup-tent pole
  const GUY_REACH = Tuning.TENT_GUY_REACH_M;
  const GUY_R = 0.012;
  const STAKE_H = 0.14;
  const SAG = Tuning.TENT_ROOF_SAG_M;
  const FABRIC_THICK = 0.03;

  // Each slanted side spans from (ridge at z=0, y=RIDGE_Y) down to
  // (base at z=±BW/2, y=0). Slope length + angle drive both the panel
  // geometry and the side rotation.
  const HALF_BW = BW * 0.5;
  const SLANT_LEN = Math.hypot(HALF_BW, RIDGE_Y);
  const SLANT_ANGLE = Math.atan2(RIDGE_Y, HALF_BW);

  // Materials — same off-white canvas + fabric shader as the large
  // shelter tent so they read as the same material family.
  const fabricMat = createFabricMaterial(0xd4c5a8, THREE.DoubleSide);
  const poleMat = createWoodGrainMaterial(0x4a3320, { weatherLevel: 0.4, ringDensity: 6.0, bark: 0.22 });   // M6 ③ (C39) — seasoned branch poles
  const ropeMat = new THREE.MeshLambertMaterial({ color: 0x4a3a26 });
  const stakeMat = new THREE.MeshLambertMaterial({ color: 0x3a2818 });

  // ── Two slanted side walls. Built flat (XZ in panel-local frame),
  // sagged along Y (downward at the center), then rotated so the
  // panel's local +Z aligns with the ridge→base slope direction in
  // world space. The ridge runs along world X; sides slope outward to
  // ±Z.
  //
  // AAZ-fix-2 — was `rotation.x = side * (PI/2 - SLANT_ANGLE)`, which
  // tilted the panel by ~34° when the slope angle needed ~56° for this
  // geometry. Result: each panel sat half-way between ridge and base
  // and the two sides crossed over each other in the middle of the
  // tent. Replaced with a quaternion that aligns the panel's local +Z
  // directly to the desired slope unit vector — handles the asymmetric
  // rotation between +Z and -Z sides cleanly (side=+1 needs ~+α around
  // +X, side=-1 needs ~+(π-α), both around +X). setFromUnitVectors does
  // the math for us; local +X stays along the ridge axis as required.
  const upZ = new THREE.Vector3(0, 0, 1);
  const sinA = Math.sin(SLANT_ANGLE);
  const cosA = Math.cos(SLANT_ANGLE);
  for (const side of [-1, 1]) {
    // Panel dimensions: X = ridge length, Z = slant length (from ridge to
    // base), Y = fabric thickness. The sag pushes the cloth downward
    // (into the structure interior) at the panel center.
    //
    // Sag sign per side: setFromUnitVectors rotates differently for the
    // two sides (+α vs π-α around +X), and the panel's local Y axis
    // flips between them. For side=+1, local -Y → down-and-inward
    // (correct gravity direction); for side=-1, local +Y → down-and-
    // inward (sign inverted). Multiplying the sag amplitude by `side`
    // keeps the visible droop downward on both panels.
    const panel = makeSaggedFabricPanel(
      L + 0.05, FABRIC_THICK, SLANT_LEN + 0.04,
      10, 5,
      -SAG * side,
      fabricMat,
    );
    // Centroid in world space: midpoint between ridge and base along
    // the side's diagonal. Y = halfway up to the ridge; Z = halfway out
    // to the base edge on the relevant side.
    panel.position.set(0, RIDGE_Y * 0.5, side * HALF_BW * 0.5);
    // Slope direction: from ridge (y=RIDGE_Y, z=0) to base (y=0,
    // z=±HALF_BW). Normalized: (0, -sin α, side·cos α). Aligning the
    // panel's local +Z to this puts the +Z edge at the base and the
    // -Z edge at the ridge.
    const slopeDir = new THREE.Vector3(0, -sinA, side * cosA);
    panel.quaternion.setFromUnitVectors(upZ, slopeDir);
    g.add(panel);
  }

  // ── Back gable only — the +X end is the entrance and stays open.
  // ExtrudeGeometry on a 2D triangle (apex at the ridge, base spanning
  // the full BW), positioned at -X with its extrusion facing outward.
  {
    const tri = new THREE.Shape();
    tri.moveTo(-HALF_BW, 0);
    tri.lineTo(HALF_BW, 0);
    tri.lineTo(0, RIDGE_Y);
    tri.closePath();
    const triGeo = new THREE.ExtrudeGeometry(tri, { depth: FABRIC_THICK, bevelEnabled: false });
    const gable = new THREE.Mesh(triGeo, fabricMat);
    gable.position.set(-L * 0.5, 0, 0);
    gable.rotation.y = -Math.PI / 2;   // gable plane perpendicular to X, facing -X
    g.add(gable);
  }

  // (Rolled-up flap removed — the small tent is too small for a tied-
  // open door cloth to read sensibly; the open +X gable is enough on
  // its own to signal "this is the entrance".)

  // ── Ridge poles: two upright poles at the long-axis ends, protruding
  // above the apex by POLE_RISE. Visible structural marker that ties
  // the silhouette to the large tent.
  for (const sx of [-1, 1]) {
    const totalH = RIDGE_Y + POLE_RISE;
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(POLE_R, POLE_R * 1.2, totalH, 6),
      poleMat,
    );
    pole.position.set(sx * (L * 0.5 - 0.02), totalH * 0.5, 0);
    g.add(pole);
  }

  // ── Interior ridge beam: horizontal pole connecting the two upright
  // pole tops along world +X. Visible inside if the player crouches +
  // peers in from an end.
  {
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(POLE_R * 0.7, POLE_R * 0.7, L - 0.04, 6),
      poleMat,
    );
    beam.rotation.z = Math.PI / 2;   // align cylinder axis with world X
    beam.position.set(0, RIDGE_Y - POLE_R * 0.5, 0);
    g.add(beam);
  }

  // ── Guy ropes + stakes. Four anchors: corners of the base rectangle,
  // each guy angled diagonally outward to a ground stake. Pup-tent
  // canonical setup.
  const anchors: Array<{ ax: number; ay: number; az: number; dx: number; dz: number }> = [
    { ax: -L * 0.5, ay: 0.05, az: -HALF_BW, dx: -GUY_REACH * 0.6, dz: -GUY_REACH * 0.6 },
    { ax:  L * 0.5, ay: 0.05, az: -HALF_BW, dx:  GUY_REACH * 0.6, dz: -GUY_REACH * 0.6 },
    { ax: -L * 0.5, ay: 0.05, az:  HALF_BW, dx: -GUY_REACH * 0.6, dz:  GUY_REACH * 0.6 },
    { ax:  L * 0.5, ay: 0.05, az:  HALF_BW, dx:  GUY_REACH * 0.6, dz:  GUY_REACH * 0.6 },
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
      new THREE.CylinderGeometry(0.016, 0.035, STAKE_H, 4),
      stakeMat,
    );
    stake.position.set(sx, STAKE_H * 0.35, sz);
    g.add(stake);
  }

  return g;
}

export function deployTent(ctx: GameContext): Tent | null {
  const cam = ctx.three.camera;
  const dir = new THREE.Vector3();
  cam.getWorldDirection(dir);
  dir.y = 0;
  if (dir.lengthSq() < 1e-4) dir.set(0, 0, -1);
  dir.normalize();
  const pos = new THREE.Vector3()
    .copy(cam.position)
    .addScaledVector(dir, Tuning.PLACEMENT_DISTANCE_M);
  pos.y = ctx.terrain.heightAt(pos.x, pos.z);

  // Reject if too close to existing tent
  for (const existing of ctx.tents.list) {
    if (existing.pos.distanceToSquared(pos) < Tuning.TENT_NEAR_DISTANCE_SQ) {
      return null;
    }
  }

  // AAZ-fix — face the camera. The pre-AAZ-fix random yaw made
  // placement feel arbitrary; deploying via camera-forward matches the
  // large tent's convention (entry predictable from where the player
  // is looking).
  //
  // Open-entrance variant: the small tent has its entrance at the +X
  // gable end (the -X gable is closed). To put +X TOWARD the camera
  // we rotate -π/2 off the large-tent yaw — the original aligned local
  // +Z toward the player, this aligns local +X toward the player so
  // the entrance is what they see first.
  const rotationY = Math.atan2(-dir.x, -dir.z) - Math.PI / 2;
  return spawnTentAt(ctx, pos, rotationY);
}

/** Materialise a tent at the given world position + Y rotation. Used by
 *  both deployTent (camera-forward) and save/load (saved rotation). */
export function spawnTentAt(
  ctx: GameContext,
  pos: THREE.Vector3,
  rotationY: number,
): Tent {
  const mesh = makeTentVisual();
  mesh.position.copy(pos);
  // AAZ-fix — terrain-slope alignment so the tent tilts with the ground
  // and the guy stakes contact the surface.
  alignToTerrain(
    mesh,
    ctx.terrain,
    pos.x,
    pos.z,
    rotationY,
    Tuning.TENT_LENGTH_M * 0.5,
  );
  mesh.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });
  ctx.three.scene.add(mesh);

  const id = _nextId++;
  tag(mesh, id);

  const shelterZone = addShelterZone(
    ctx.shelter,
    { x: pos.x, y: pos.y + TENT_SHELTER_HALF.y, z: pos.z },
    TENT_SHELTER_HALF,
  );

  const tent: Tent = {
    id,
    mesh,
    shelterZone,
    pos: pos.clone(),
    rotationY,
    hovered: false,
  };
  ctx.tents.list.push(tent);
  return tent;
}

/** Bump the module-level id counter past `n` so future spawns don't collide
 *  with restored ids. Used by save/load. */
export function setNextTentId(n: number): void {
  if (n > _nextId) _nextId = n;
}

export function findTentById(list: Tent[], id: number | undefined): Tent | undefined {
  if (id === undefined) return undefined;
  return list.find((t) => t.id === id);
}

/** Session UU-2 — symmetric to `deployTent`. RMB on a tent invokes
 *  this via wieldAction.ts. Refuses if inventory can't hold the
 *  returned `tent_kit` (no silent destruction of the player's tent). */
export function packUpTent(ctx: GameContext, tent: Tent): boolean {
  // Try to give the kit back first — if this fails, we abort BEFORE
  // touching scene / shelter / list so the tent stays placed.
  const slotIdx = addItem(ctx.inventory, 'tent_kit', undefined, ctx);
  if (slotIdx < 0) {
    ctx.ui.showToast('no room in your bag');
    return false;
  }
  // Remove shelter zone (player loses the warmth bubble immediately).
  removeShelterZone(ctx.shelter, tent.shelterZone);
  // Remove the mesh from the scene.
  ctx.three.scene.remove(tent.mesh);
  // Splice out of the registry.
  const i = ctx.tents.list.indexOf(tent);
  if (i >= 0) ctx.tents.list.splice(i, 1);
  ctx.ui.showToast('tent packed');
  return true;
}
