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
import { panelWithHole } from './panelUtils.ts';

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
// Session AA — tally marks were nearly black (0x14110a) on a dark wall and
// invisible in-game. Bumped to a chalky off-white so the scratch reads as
// scratched-away surface rather than scratched-in.
const _scratchMat = new THREE.MeshLambertMaterial({
  color: 0xb8a888,
});
// Session AA — translucent canvas tarp covering the back portion of the roof.
// Tagged `noShadow` per-instance so the sun reaches the cavity floor below.
// Material design: low opacity so the bright sky shows through, PLUS a warm
// emissive so the fabric itself glows like backlit cloth when sunlit from
// above. At night the diffuse colour falls to near-black and only the small
// emissive remains — fabric never looks "off" but doesn't artificially glow
// in pitch dark either.
const _tarpMat = new THREE.MeshLambertMaterial({
  color: 0xd8c090,
  transparent: true,
  opacity: 0.30,
  emissive: 0xb88a4a,
  emissiveIntensity: 0.45,
  flatShading: true,
  side: THREE.DoubleSide,
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

// `panelWithHole` was extracted to `panelUtils.ts` in Session BB so megaShip.ts
// can share it. Same shape (W=X, T=Y thickness, D=Z) and same caller contract.

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

  // ── Back wall: pierced with one larger hole high up above the tally
  // marks. With the wreck oriented so the back wall faces east (see
  // openingScene.ts WRECK_SEARCH_CENTER), morning sun streams through this
  // hole into the cavity. Tally marks at world Y=1.5 stay below the hole.
  //
  // panelWithHole builds the panel in the XZ plane with thickness along Y.
  // Rotating -π/2 around X maps panel-local Z → world Y and panel-local Y →
  // world +Z (thickness extending into the back). So cu maps to wall X
  // position and cv maps to wall y-offset from center.
  const BACK_HOLE = 0.55;
  const backWallG = panelWithHole(
    HALF_W * 2 + WALL_THICK * 2,
    WALL_THICK,
    HALF_H * 2,
    0.0, 0.6,                  // cu = lateral center; cv = +0.6 → world Y ≈ 1.8m
    BACK_HOLE, BACK_HOLE,
    _hullDarkMat,
  );
  backWallG.position.set(0, HALF_H, HALF_L + WALL_THICK / 2);
  backWallG.rotation.x = -Math.PI / 2;
  g.add(backWallG);

  // ── Side walls: left and right. Each pierced with one larger hole so the
  // sun can reach the interior at low-angle (dawn/dusk) hours.
  //   panelWithHole builds a horizontal panel; rotating it ±π/2 around Z
  //   stands it up as a vertical wall. After +π/2: panel local +X → world
  //   +Y (so cu maps to wall y-offset from center). cv maps to z.
  // Hole positions chosen so they're at chest/head height and away from the
  // back wall (which carries the tally marks).
  const SIDE_HOLE_W = 0.34;
  // Wreck-local hole records — consulted later when placing exterior decals
  // (seams, rust streaks, roof patches) so nothing floats over an empty gap.
  type WallHole = { side: -1 | 1; yCenter: number; zCenter: number; halfSize: number };
  type RoofHole = { xCenter: number; zCenter: number; halfX: number; halfZ: number };
  const wallHoles: WallHole[] = [];
  const roofHoles: RoofHole[] = [];

  // Left wall — hole at world y ≈ HALF_H + 0.50 = 1.70m, z = 0.4 (mid-cavity)
  const LEFT_HOLE_DY = 0.50, LEFT_HOLE_Z = 0.4;
  const leftWallG = panelWithHole(
    HALF_H * 2, WALL_THICK, HALF_L * 2,
    LEFT_HOLE_DY, LEFT_HOLE_Z, SIDE_HOLE_W, SIDE_HOLE_W,
    _hullMat,
  );
  leftWallG.position.set(-HALF_W - WALL_THICK / 2, HALF_H, 0);
  leftWallG.rotation.z = Math.PI / 2;
  g.add(leftWallG);
  wallHoles.push({ side: -1, yCenter: HALF_H + LEFT_HOLE_DY, zCenter: LEFT_HOLE_Z, halfSize: SIDE_HOLE_W / 2 });

  // Right wall — hole at world y ≈ HALF_H + 0.20 = 1.40m
  //   rotation -π/2: panel local +X → world -Y (so cu maps to negated y-offset)
  //   To put the hole at +Y of center, set cu = -0.20.
  const RIGHT_HOLE_DY = 0.20, RIGHT_HOLE_Z = -1.0;
  const rightWallG = panelWithHole(
    HALF_H * 2, WALL_THICK, HALF_L * 2,
    -RIGHT_HOLE_DY, RIGHT_HOLE_Z, SIDE_HOLE_W, SIDE_HOLE_W,
    _hullMat,
  );
  rightWallG.position.set(HALF_W + WALL_THICK / 2, HALF_H, 0);
  rightWallG.rotation.z = -Math.PI / 2;
  g.add(rightWallG);
  wallHoles.push({ side: +1, yCenter: HALF_H + RIGHT_HOLE_DY, zCenter: RIGHT_HOLE_Z, halfSize: SIDE_HOLE_W / 2 });

  // ── Roof: A-frame shape with a HOLE punched in the middle so the sun
  // can shine through into the interior. Each side of the A-frame is
  // split into two slabs (front + back) with a gap left for the hole.
  // The hole runs across the full width of the apex and ~1.2 m along Z.
  const slabW = HALF_W + WALL_THICK + 0.05;
  const slabL = HALF_L * 2 + WALL_THICK * 2;
  const HOLE_Z_FRONT = -0.4;        // front edge of the skylight hole
  const HOLE_Z_BACK = 0.8;          // back edge — biased toward the back wall
  const roofSlopeAngle = Math.atan2(ROOF_PEAK, slabW);
  // Session AA rework — three extra skylights besides the main central one.
  // Both BACK slabs get a 0.7m skylight near the apex, positioned above the
  // skeleton+journal at the back of the wreck so the focal point reads.
  // Front-R also gets a 0.55m skylight. Front-L stays solid to avoid
  // swiss-cheesing the roof.
  //
  // ROTATION FIX (Session AA): the pre-existing `side * roofSlopeAngle` was
  // inverted — it tilted the slabs so their OUTER edges sat ~35cm ABOVE the
  // wall tops (and the apex was at wall-top level), making the roof look
  // like it floated above the walls. Negating the sign makes the outer
  // edges touch the wall tops and the apex form the true peak.
  // Main central skylight zone (spans full width, z ∈ [HOLE_Z_FRONT, HOLE_Z_BACK]).
  roofHoles.push({ xCenter: 0, zCenter: (HOLE_Z_FRONT + HOLE_Z_BACK) / 2,
    halfX: slabW, halfZ: (HOLE_Z_BACK - HOLE_Z_FRONT) / 2 });

  for (const side of [-1, 1]) {
    const cx = side * (slabW / 2 - 0.025);
    const cy = HALF_H * 2 + ROOF_PEAK / 2;

    // Front piece — from front edge of roof to the hole's front edge.
    const frontLen = HOLE_Z_FRONT - (-slabL / 2);
    if (frontLen > 0) {
      const cz = (-slabL / 2 + HOLE_Z_FRONT) / 2;
      let mesh: THREE.Object3D;
      if (side === 1) {
        // Front-R skylight — 0.55m hole, slightly forward in the slab.
        const HOLE = 0.55;
        const cu = -0.2, cv = 0.3;
        mesh = panelWithHole(slabW, 0.18, frontLen, cu, cv, HOLE, HOLE, _hullMat);
        roofHoles.push({ xCenter: cx + cu, zCenter: cz + cv, halfX: HOLE / 2, halfZ: HOLE / 2 });
      } else {
        mesh = new THREE.Mesh(new THREE.BoxGeometry(slabW, 0.18, frontLen), _hullMat);
      }
      mesh.position.set(cx, cy, cz);
      mesh.rotation.z = -side * roofSlopeAngle;
      g.add(mesh);
    }

    // (Back piece moved out of the per-side loop — replaced with a single
    // FLAT tarp covering the full back of the wreck, see below.)
  }

  // ── Canvas tarp covering the back portion of the roof. Anchored at the
  // top of the back wall (Y = HALF_H*2 = 2.40m) and sloping slightly
  // downward toward the front — reads as a salvaged tarp tied off to the
  // back-wall ledge with its forward edge sagging into the cavity. Tagged
  // `noShadow` so sunlight passes through to the cavity floor below
  // (the wreck's local shadow walk above sets castShadow=false on any mesh
  // with that flag). ────────────────────────────────────────────────────
  const tarpW = HALF_W * 2 + WALL_THICK * 2;        // 3.8m, matches outer wall span
  const tarpLen = (slabL / 2) - HOLE_Z_BACK;        // 2.1m back portion length
  const tarpDrop = 0.25;                             // front edge sags 25cm below back
  // Sit the tarp's back edge slightly ABOVE the wall ledge (6cm clearance)
  // so the wall top visibly supports the tarp instead of intersecting it.
  const tarpBackY = HALF_H * 2 + 0.06;
  const tarpCenterY = tarpBackY - tarpDrop / 2;     // midpoint of the tilted span
  const tarpCenterZ = (HOLE_Z_BACK + slabL / 2) / 2;
  // Rotation -θ around X tilts the +Z end UP and the -Z end DOWN — back
  // edge sits at the back-wall ledge, front edge dips toward the cavity.
  const tarpTilt = -Math.asin(tarpDrop / tarpLen);
  const tarp = new THREE.Mesh(
    new THREE.BoxGeometry(tarpW, 0.04, tarpLen),
    _tarpMat,
  );
  tarp.position.set(0, tarpCenterY, tarpCenterZ);
  tarp.rotation.x = tarpTilt;
  tarp.userData.noShadow = true;
  g.add(tarp);

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

  // (Session AA — removed the floor sun-patch disc + fake emissive cone
  // shafts. Interior light now comes ENTIRELY from real geometry holes:
  // the main central skylight + the four smaller pierced holes — two in
  // the side walls (built above via `panelWithHole`) and two extra
  // skylights in the roof slabs (added in the roof loop above). The sun
  // reaches the floor through each gap on its own, no fake glow added.)

  // Helper for decoration placement — skip wall seams/streaks that would
  // float over a pierced wall hole. (Roof hole zones used to filter rust
  // patches too; patches were removed in Session AA so the roof helper is
  // gone as well — `roofHoles` retained in case future decoration logic
  // needs it.)
  function wallHoleAt(side: -1 | 1, y: number, z: number, padY: number, padZ: number): boolean {
    for (const h of wallHoles) {
      if (h.side !== side) continue;
      if (Math.abs(y - h.yCenter) > h.halfSize + padY) continue;
      if (Math.abs(z - h.zCenter) > h.halfSize + padZ) continue;
      return true;
    }
    return false;
  }
  void roofHoles;

  // ── Exterior: hull-plate seams on the side walls (decorative thin
  // vertical ridges). Skip ones overlapping a wall hole — they'd float. ─
  for (const side of [-1, 1] as const) {
    for (let i = 0; i < 4; i++) {
      const seamZ = -HALF_L + 0.5 + i * 1.2;
      // Seam spans nearly the full wall height; passes through any hole at
      // matching Z. Pad Z by half the seam width + a bit of visual clearance.
      if (wallHoleAt(side, HALF_H, seamZ, 999, 0.06)) continue;
      const seam = box(0.05, HALF_H * 2 - 0.2, 0.05, _hullDarkMat);
      seam.position.set(
        side * (HALF_W + WALL_THICK + 0.025),
        HALF_H,
        seamZ,
      );
      g.add(seam);
    }
  }

  // ── Exterior: rust streaks running down the sides. Resampled if a draw
  // lands over a wall hole.
  for (let i = 0; i < 6; i++) {
    let side: -1 | 1 = -1, y = 0, z = 0;
    for (let attempt = 0; attempt < 8; attempt++) {
      side = rand() < 0.5 ? -1 : 1;
      y = HALF_H + 0.3 - rand() * 0.4;
      z = -HALF_L + rand() * (HALF_L * 2);
      // Streak is ~0.5m tall × 0.12m deep — pad accordingly.
      if (!wallHoleAt(side, y, z, 0.25, 0.06)) break;
    }
    const streak = box(0.04, 0.6 + rand() * 0.5, 0.12, _rustMat);
    streak.position.set(
      side * (HALF_W + WALL_THICK + 0.027),
      y,
      z,
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

  // (Session AA — roof rust patches removed. They were flat boxes positioned
  // at a fixed Y above the apex, so they didn't follow the tilted slabs and
  // floated visibly over slabs at their outer edges. Rust streaks on the
  // side walls already provide the weathered-hull read; the patches were
  // double-duty decoration not worth the floating-element cost.)

  // ── Exterior: antenna stub mounted on the SOLID front roof (Session AA —
  // moved off the back tarp, which can't structurally support an antenna).
  // Z = -1.5 keeps it on the front-gabled hull, near the apex line. ─────
  const ANTENNA_Z = -1.5;
  const stub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.07, 1.6, 6),
    _antennaMat,
  );
  stub.position.set(0.2, HALF_H * 2 + ROOF_PEAK + 0.8, ANTENNA_Z);
  stub.rotation.z = -0.18;
  g.add(stub);
  // Small crossbar near the top
  const crossbar = box(0.5, 0.04, 0.04, _antennaMat);
  crossbar.position.set(0.18, HALF_H * 2 + ROOF_PEAK + 1.45, ANTENNA_Z);
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
  // Session AA tally Y has bounced around: 1.5 floated in the back-wall
  // hole, 1.0 clipped the skeleton's skull. 1.30 sits cleanly between the
  // skull top (~Y=1.1) and the window bottom (Y=1.525) — 0.20m tall bars
  // span [1.20, 1.40] which clears both.
  const tallyZ = HALF_L - 0.015;
  let totalMarks = 0;
  for (let cluster = 0; cluster < 4 && totalMarks < 17; cluster++) {
    const baseX = -0.8 + cluster * 0.35;
    const tallyY = 1.30;
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

  // Shadow flags. Meshes flagged `userData.noShadow` opt out of casting (the
  // tarp uses this so the directional sun reaches the cavity floor through
  // it). main.ts also runs a global shadow walk at boot, but that walk
  // happens BEFORE setupOpeningScene runs — so this local walk is the
  // authoritative source for the wreck's shadow flags.
  g.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = !m.userData.noShadow;
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
