// Opening wreck (Session W) — a new, larger wreck design distinct from
// the six in world/wrecks.ts, authored explicitly to be entered. The
// player walks in along the -Z side and finds the skeleton + journal
// against the back wall at +Z.
//
// Built from thick (0.3m) box walls — solid both from outside and inside,
// no half-cylinder rotation that left the previous version see-through.
// Roof has a subtle two-piece A-frame for sci-fi silhouette.
//
// Local space convention (caller does not rotate):
//   +Z = back wall (skeleton against this side)
//   -Z = open entrance (player walks in here)
//   y=0 = interior floor (sits flush with terrain at placement position)
//
// Footprint ~4 m × 5.4 m × 2.7 m tall. NOT salvageable (story prop).

import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { Rng } from '../core/rng.ts';
import type { Terrain } from './terrain.ts';
import { Tuning } from '../config/tuning.ts';

// ── Shared materials. Reuse the wreck palette. ─────────────────────────
const _hullMat = new THREE.MeshLambertMaterial({
  color: Tuning.WRECK_HULL_HEX,
  flatShading: true,
});
const _hullDarkMat = new THREE.MeshLambertMaterial({
  color: Tuning.WRECK_HULL_DARK_HEX,
  flatShading: true,
});
const _floorMat = new THREE.MeshLambertMaterial({
  color: 0x2a2620,
  flatShading: true,
});
const _rustMat = new THREE.MeshLambertMaterial({
  color: Tuning.WRECK_RUST_HEX,
  flatShading: true,
});
const _rustDarkMat = new THREE.MeshLambertMaterial({
  color: Tuning.WRECK_RUST_DARK_HEX,
  flatShading: true,
});
const _antennaMat = new THREE.MeshLambertMaterial({
  color: Tuning.WRECK_ANTENNA_HEX,
  flatShading: true,
});
const _ashMat = new THREE.MeshLambertMaterial({
  color: 0x1a1410,
  flatShading: true,
});
const _branchMat = new THREE.MeshLambertMaterial({
  color: 0x3a2818,
  flatShading: true,
});
const _emptyCanteenMat = new THREE.MeshLambertMaterial({
  color: 0x5a4030,
  flatShading: true,
});
const _scratchMat = new THREE.MeshLambertMaterial({
  color: 0x14110a,
});

// ── Geometry constants. Interior cavity = 2*HALF_W wide, 2*HALF_H tall,
//    2*HALF_L deep. Walls are WALL_THICK thick. ──────────────────────────
const HALF_W = 1.6;       // interior half-width (X)
const HALF_H = 1.2;       // interior half-height (Y, floor to ceiling)
const HALF_L = 2.6;       // interior half-length (Z)
const WALL_THICK = 0.3;
const ROOF_PEAK = 0.35;   // additional roof apex height above HALF_H*2

/** Interior extents — used by the orchestrator to register a shelter zone
 *  + position the skeleton and journal at the back of the cavity. */
export interface OpeningWreckExtents {
  halfX: number;
  halfY: number;
  halfZ: number;
  floorY: number;
  backZ: number;
}

export const OPENING_WRECK_EXTENTS: OpeningWreckExtents = {
  halfX: HALF_W,
  halfY: HALF_H + ROOF_PEAK / 2,
  halfZ: HALF_L,
  floorY: 0,
  backZ: HALF_L,
};

function box(w: number, h: number, d: number, mat: THREE.Material): THREE.Mesh {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
}

export function makeOpeningWreck(rand: Rng): THREE.Group {
  const g = new THREE.Group();

  // ── Floor: slightly inset slab. Top surface at y=0. ───────────────────
  const floor = box(
    HALF_W * 2 + WALL_THICK * 2,
    0.3,
    HALF_L * 2 + WALL_THICK * 2,
    _floorMat,
  );
  floor.position.y = -0.15;
  g.add(floor);

  // ── Back wall: solid box at +Z end. Receives tally marks on its
  // inside face. ────────────────────────────────────────────────────────
  const backWall = box(
    HALF_W * 2 + WALL_THICK * 2,
    HALF_H * 2,
    WALL_THICK,
    _hullDarkMat,
  );
  backWall.position.set(0, HALF_H, HALF_L + WALL_THICK / 2);
  g.add(backWall);

  // ── Side walls: left and right. ───────────────────────────────────────
  const leftWall = box(WALL_THICK, HALF_H * 2, HALF_L * 2, _hullMat);
  leftWall.position.set(-HALF_W - WALL_THICK / 2, HALF_H, 0);
  g.add(leftWall);

  const rightWall = box(WALL_THICK, HALF_H * 2, HALF_L * 2, _hullMat);
  rightWall.position.set(HALF_W + WALL_THICK / 2, HALF_H, 0);
  g.add(rightWall);

  // ── Roof: A-frame shape with a HOLE punched in the middle so the sun
  // can shine through into the interior. Each side of the A-frame is
  // split into two slabs (front + back) with a gap left for the hole.
  // The hole runs across the full width of the apex and ~1.2 m along Z.
  const slabW = HALF_W + WALL_THICK + 0.05;
  const slabL = HALF_L * 2 + WALL_THICK * 2;
  const HOLE_Z_FRONT = -0.4;        // front edge of the skylight hole
  const HOLE_Z_BACK = 0.8;          // back edge — biased toward the back wall
  const roofSlopeAngle = Math.atan2(ROOF_PEAK, slabW);
  for (const side of [-1, 1]) {
    const cx = side * (slabW / 2 - 0.025);
    const cy = HALF_H * 2 + ROOF_PEAK / 2;

    // Front piece — from front edge of roof to the hole's front edge.
    const frontLen = HOLE_Z_FRONT - (-slabL / 2);
    if (frontLen > 0) {
      const front = box(slabW, 0.18, frontLen, _hullMat);
      front.position.set(cx, cy, (-slabL / 2 + HOLE_Z_FRONT) / 2);
      front.rotation.z = side * roofSlopeAngle;
      g.add(front);
    }

    // Back piece — from hole's back edge to the back edge of the roof.
    const backLen = (slabL / 2) - HOLE_Z_BACK;
    if (backLen > 0) {
      const back = box(slabW, 0.18, backLen, _hullMat);
      back.position.set(cx, cy, (HOLE_Z_BACK + slabL / 2) / 2);
      back.rotation.z = side * roofSlopeAngle;
      g.add(back);
    }
  }

  // ── Ceiling cap above the back wall — covers the small gap at the
  // back where the A-frame meets the back wall edge. ────────────────────
  const ceilingCap = box(
    HALF_W * 2 + WALL_THICK * 2,
    WALL_THICK,
    WALL_THICK,
    _hullDarkMat,
  );
  ceilingCap.position.set(0, HALF_H * 2 + 0.05, HALF_L + WALL_THICK / 2);
  g.add(ceilingCap);

  // ── Floor sun patch — emissive disc under the skylight hole. Reads as
  // a shaft of sunlight hitting the floor. No actual light source (the
  // PointLight was unrealistic — interior lighting comes from the real
  // sun + ambient, which reach through the hole on their own). ────────
  const sunPatch = new THREE.Mesh(
    new THREE.CircleGeometry(0.75, 20),
    new THREE.MeshBasicMaterial({
      color: 0xffe4b0,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
      fog: false,
      toneMapped: false,
    }),
  );
  sunPatch.rotation.x = -Math.PI / 2;
  sunPatch.position.set(0, 0.01, (HOLE_Z_FRONT + HOLE_Z_BACK) / 2);
  g.add(sunPatch);

  // ── Exterior: hull-plate seams on the side walls (decorative thin
  // vertical ridges). ──────────────────────────────────────────────────
  for (const side of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const seam = box(0.05, HALF_H * 2 - 0.2, 0.05, _hullDarkMat);
      seam.position.set(
        side * (HALF_W + WALL_THICK + 0.025),
        HALF_H,
        -HALF_L + 0.5 + i * 1.2,
      );
      g.add(seam);
    }
  }

  // ── Exterior: rust streaks running down the sides. ────────────────────
  for (let i = 0; i < 6; i++) {
    const side = rand() < 0.5 ? -1 : 1;
    const streak = box(0.04, 0.6 + rand() * 0.5, 0.12, _rustMat);
    streak.position.set(
      side * (HALF_W + WALL_THICK + 0.027),
      HALF_H + 0.3 - rand() * 0.4,
      -HALF_L + rand() * (HALF_L * 2),
    );
    g.add(streak);
  }

  // ── Exterior: torn hull-plate fragments around the entrance. ─────────
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + Math.PI * (0.05 + rand() * 0.9);
    const w = 0.4 + rand() * 0.5;
    const h = 0.25 + rand() * 0.35;
    const frag = box(w, h, 0.05, _rustDarkMat);
    const radius = 1.7;
    frag.position.set(
      Math.cos(a) * radius,
      HALF_H + Math.sin(a) * radius * 0.7,
      -HALF_L - 0.1 + rand() * 0.2,
    );
    frag.rotation.z = a + Math.PI / 2 + (rand() - 0.5) * 0.5;
    frag.rotation.y = (rand() - 0.5) * 0.4;
    g.add(frag);
  }

  // ── Exterior: roof rust patches. ─────────────────────────────────────
  for (let i = 0; i < 3; i++) {
    const patch = box(0.5 + rand() * 0.4, 0.04, 0.4 + rand() * 0.3, _rustMat);
    patch.position.set(
      (rand() - 0.5) * 1.5,
      HALF_H * 2 + ROOF_PEAK + 0.05,
      (rand() - 0.5) * (HALF_L * 1.5),
    );
    patch.rotation.y = rand() * Math.PI;
    g.add(patch);
  }

  // ── Exterior: antenna stub off the apex. ─────────────────────────────
  const stub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.07, 1.6, 6),
    _antennaMat,
  );
  stub.position.set(0.2, HALF_H * 2 + ROOF_PEAK + 0.8, HALF_L * 0.3);
  stub.rotation.z = -0.18;
  g.add(stub);
  // Small crossbar near the top
  const crossbar = box(0.5, 0.04, 0.04, _antennaMat);
  crossbar.position.set(0.18, HALF_H * 2 + ROOF_PEAK + 1.45, HALF_L * 0.3);
  crossbar.rotation.z = -0.18;
  g.add(crossbar);

  // ─────────────────────────────────────────────────────────────────────
  // Lived-in interior details
  // ─────────────────────────────────────────────────────────────────────

  // Old ash pile + branch stubs near floor center.
  const ashPile = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.18, 0),
    _ashMat,
  );
  ashPile.position.set(0, 0.06, 0.3);
  ashPile.scale.set(1.4, 0.4, 1.4);
  g.add(ashPile);
  for (let i = 0; i < 3; i++) {
    const stub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.022, 0.32, 5),
      _branchMat,
    );
    const a = (i / 3) * Math.PI * 2 + rand() * 0.4;
    stub.position.set(
      Math.cos(a) * 0.22,
      0.08,
      0.3 + Math.sin(a) * 0.22,
    );
    stub.rotation.z = Math.PI / 2 + Math.cos(a) * 0.6;
    stub.rotation.x = Math.sin(a) * 0.6;
    g.add(stub);
  }

  // Tally marks on the INSIDE face of the back wall. Inner face is at
  // z = HALF_L (back wall extends from HALF_L to HALF_L + WALL_THICK).
  // Place tallies at z = HALF_L - 0.015 to float just in front.
  const tallyZ = HALF_L - 0.015;
  let totalMarks = 0;
  for (let cluster = 0; cluster < 4 && totalMarks < 17; cluster++) {
    const baseX = -0.8 + cluster * 0.35;
    const tallyY = 1.5;
    const inThisCluster = Math.min(5, 17 - totalMarks);
    for (let m = 0; m < Math.min(4, inThisCluster); m++) {
      const bar = box(0.016, 0.20, 0.015, _scratchMat);
      bar.position.set(baseX + m * 0.05, tallyY, tallyZ);
      g.add(bar);
      totalMarks++;
    }
    if (inThisCluster === 5) {
      const cross = box(0.24, 0.016, 0.015, _scratchMat);
      cross.position.set(baseX + 0.075, tallyY, tallyZ);
      cross.rotation.z = 0.45;
      g.add(cross);
      totalMarks++;
    }
  }

  // Empty canteen on the floor near where the skeleton will sit.
  const canteen = new THREE.Group();
  const canteenBody = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.16, 1),
    _emptyCanteenMat,
  );
  canteenBody.scale.set(1.0, 1.05, 0.55);
  canteen.add(canteenBody);
  const canteenNeck = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.06, 0.08, 6),
    _emptyCanteenMat,
  );
  canteenNeck.position.y = 0.18;
  canteen.add(canteenNeck);
  canteen.position.set(-0.5, 0.10, HALF_L - 0.7);
  canteen.rotation.z = Math.PI / 2 - 0.3;
  canteen.rotation.y = 0.4;
  g.add(canteen);

  // Torn cloth strip at the entrance threshold.
  const cloth = box(0.5, 0.02, 0.18, _rustMat);
  cloth.position.set(0.6, 0.01, -HALF_L + 0.4);
  cloth.rotation.y = 0.3;
  cloth.rotation.x = 0.08;
  g.add(cloth);

  // Shadow flags.
  g.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });

  return g;
}

/**
 * Place the opening wreck at a world position with a Y-axis rotation
 * (yaw). One rigid body holds all 4 wall colliders at LOCAL positions —
 * colliders inherit the body's rotation, so visual and physics stay
 * aligned regardless of how the wreck is oriented in the world.
 */
export function placeOpeningWreck(
  scene: THREE.Scene,
  world: RAPIER.World,
  _terrain: Terrain,
  pos: THREE.Vector3,
  yaw: number,
  rand: Rng,
): THREE.Group {
  const group = makeOpeningWreck(rand);
  group.position.copy(pos);
  group.rotation.y = yaw;
  scene.add(group);

  // Single fixed body at the wreck origin, rotated by yaw. Quaternion
  // for a pure Y-axis rotation: (0, sin(θ/2), 0, cos(θ/2)).
  const bodyDesc = RAPIER.RigidBodyDesc.fixed()
    .setTranslation(pos.x, pos.y, pos.z)
    .setRotation({ x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) });
  const body = world.createRigidBody(bodyDesc);
  const E = OPENING_WRECK_EXTENTS;

  // Back wall (local +Z end).
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(E.halfX + WALL_THICK, HALF_H, WALL_THICK / 2)
      .setTranslation(0, HALF_H, HALF_L + WALL_THICK / 2),
    body,
  );
  // Left wall (local -X).
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(WALL_THICK / 2, HALF_H, HALF_L)
      .setTranslation(-(HALF_W + WALL_THICK / 2), HALF_H, 0),
    body,
  );
  // Right wall (local +X).
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(WALL_THICK / 2, HALF_H, HALF_L)
      .setTranslation(HALF_W + WALL_THICK / 2, HALF_H, 0),
    body,
  );
  // Roof collider — at the apex, spans interior width + small margin.
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(HALF_W + WALL_THICK, 0.15, HALF_L + WALL_THICK)
      .setTranslation(0, HALF_H * 2 + ROOF_PEAK / 2, 0),
    body,
  );

  return group;
}
