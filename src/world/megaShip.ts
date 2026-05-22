// Mega-ship POI (Session BB) — a large enterable wreck on the scale of a
// crashed cargo hauler. ~12m long × 5m wide × 3m visible-above-terrain,
// split into two chambers by a central bulkhead with a doorway. Player
// enters through a torn-hull opening on the side wall, walks through both
// chambers on a SAND floor (the sea of dunes has reclaimed the original
// metal deck), and finds three salvage panels (one per interior chamber +
// one on the exterior engine bell).
//
// Interior is intentionally DARK — solid walls + roof, no skylights — so
// the torch/flashlight from Session AA matters here.
//
// Structural notes:
//   - NO floor mesh + no floor collider. The terrain at the wreck's
//     position IS the floor; sand drifts up into the cavity for the
//     "reclaimed by the desert" read.
//   - Walls extend WALL_BURY metres below the wreck origin so they always
//     reach below terrain everywhere in the footprint — no gap visible
//     even when the wreck sits on a sloped dune.
//   - Caller (placePOIs) finds a flat-ish spot near the nominal position,
//     samples terrain normal, and passes a tilt quaternion so the wreck
//     is angled with the slope (crashed-and-settled silhouette).
//
// Local space convention (caller does not rotate before placeMegaShip):
//   +Z = back (engine) end
//   -Z = front (bridge) end
//   -X = entrance side (the torn-hull opening)
//   y=0 = nominal terrain level inside the cavity (sand reclaims it)

import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { Rng } from '../core/rng.ts';
import type { Terrain } from './terrain.ts';
import { Tuning } from '../config/tuning.ts';
import { panelWithHole } from './panelUtils.ts';
import { addAccessPanel, placeDebrisField, makeEngineBellMesh } from './wrecks.ts';
import { addShelterZone, type ShelterRegistry } from '../shelter/shelterZones.ts';
import { registerSalvageable, type SalvageableRegistry } from './salvage.ts';

// ── Shared materials — reuse the wreck palette + a darker rust for accents.
const _hullMat = new THREE.MeshLambertMaterial({
  color: Tuning.WRECK_HULL_HEX,
  flatShading: true,
});
const _hullDarkMat = new THREE.MeshLambertMaterial({
  color: Tuning.WRECK_HULL_DARK_HEX,
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
const _nozzleInteriorMat = new THREE.MeshBasicMaterial({
  color: Tuning.WRECK_NOZZLE_INTERIOR_HEX,
});
const _nozzleRimMat = new THREE.MeshLambertMaterial({
  color: Tuning.WRECK_NOZZLE_RIM_HEX,
  flatShading: true,
});
const _antennaMat = new THREE.MeshLambertMaterial({
  color: Tuning.WRECK_ANTENNA_HEX,
  flatShading: true,
});
// Pipes — slightly warmer/darker than the hull so they read as separate parts.
const _pipeMat = new THREE.MeshLambertMaterial({
  color: 0x3a3028,
  flatShading: true,
});

// ── Interior dimensions. The bulkhead at z=0 splits front (bridge, -Z) and
// back (cargo, +Z). Doorway is centered in the bulkhead.
const HALF_W = 2.5;            // interior half-width (X)
const HALF_H = 1.5;            // visible interior half-height ABOVE origin
const HALF_L = 6.0;            // interior half-length (Z)
const WALL_THICK = 0.3;

// Walls extend WALL_BURY meters BELOW origin so they always reach below
// terrain even on a sloped dune. Total wall height = HALF_H*2 + WALL_BURY.
const WALL_BURY = 2.0;
const WALL_TOTAL_H = HALF_H * 2 + WALL_BURY;        // 5m
const WALL_CENTER_Y = (HALF_H * 2 - WALL_BURY) / 2; // 0.5 → midpoint of wall in Y

// Side entrance: large torn-hull opening on the -X (left) side wall.
const ENTRANCE_W = 2.0;        // along the ship's length (Z)
const ENTRANCE_H = 2.4;        // vertical (Y), reaching from origin upward
// Hole center (in panel-local coords for the side wall panel — see notes
// at the leftWall construction below). cu = entrance center Y - wall center Y.
const ENTRANCE_CU = ENTRANCE_H / 2 - WALL_CENTER_Y;  // 1.2 - 0.5 = 0.7

// Interior bulkhead doorway.
const DOORWAY_W = 1.4;
const DOORWAY_H = 2.2;
// cv = doorway center Y - wall center Y.
const DOORWAY_CV = DOORWAY_H / 2 - WALL_CENTER_Y;    // 1.1 - 0.5 = 0.6

function box(w: number, h: number, d: number, mat: THREE.Material): THREE.Mesh {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
}

function cyl(rTop: number, rBot: number, h: number, mat: THREE.Material, seg = 8): THREE.Mesh {
  return new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, seg), mat);
}

/**
 * Build the mega-ship's meshes. Returns the root group; caller positions +
 * rotates it. Salvage panels live in dedicated sub-groups so they register
 * as independent Salvageables — see `placeMegaShip` below.
 */
export function makeMegaShip(rand: Rng): THREE.Group {
  const g = new THREE.Group();

  // ── NO floor mesh — terrain serves as the cavity floor. Sand reclaims
  // the interior.

  // ── Front wall (-Z end, bridge). Solid panel; extends below origin too. ─
  const frontWall = box(
    HALF_W * 2 + WALL_THICK * 2,
    WALL_TOTAL_H,
    WALL_THICK,
    _hullDarkMat,
  );
  frontWall.position.set(0, WALL_CENTER_Y, -HALF_L - WALL_THICK / 2);
  g.add(frontWall);

  // ── Back wall (+Z end, engine bulkhead). Solid panel. ────────────────
  const backWall = box(
    HALF_W * 2 + WALL_THICK * 2,
    WALL_TOTAL_H,
    WALL_THICK,
    _hullDarkMat,
  );
  backWall.position.set(0, WALL_CENTER_Y, HALF_L + WALL_THICK / 2);
  g.add(backWall);

  // ── Left side wall (-X). Pierced with the entrance opening.
  //   panelWithHole builds in the XZ plane with thickness on Y. After
  //   rotation +π/2 around Z it stands upright: panel-local +X → world +Y,
  //   panel-local +Z stays world +Z. cu maps to wall y-offset from center,
  //   cv to z position along the ship.
  const leftWall = panelWithHole(
    WALL_TOTAL_H, WALL_THICK, HALF_L * 2,
    ENTRANCE_CU, 0,
    ENTRANCE_H, ENTRANCE_W,
    _hullMat,
  );
  leftWall.position.set(-HALF_W - WALL_THICK / 2, WALL_CENTER_Y, 0);
  leftWall.rotation.z = Math.PI / 2;
  g.add(leftWall);

  // ── Right side wall (+X). Solid. ──────────────────────────────────────
  const rightWall = box(WALL_THICK, WALL_TOTAL_H, HALF_L * 2, _hullMat);
  rightWall.position.set(HALF_W + WALL_THICK / 2, WALL_CENTER_Y, 0);
  g.add(rightWall);

  // ── Roof. Solid hull (no skylights — interior should be dark so
  // torch/flashlight matters). ─────────────────────────────────────────
  const roof = box(
    HALF_W * 2 + WALL_THICK * 2,
    0.25,
    HALF_L * 2 + WALL_THICK * 2,
    _hullMat,
  );
  roof.position.set(0, HALF_H * 2 + 0.125, 0);
  g.add(roof);

  // ── Interior bulkhead at z=0 splitting bridge / cargo. Doorway in the
  // middle (centered laterally, bottom at floor). panelWithHole builds in
  // XZ plane with thickness on Y; rotating -π/2 around X makes panel-local
  // +Z map to world +Y. cv = doorway y-offset from wall center.
  const bulkhead = panelWithHole(
    HALF_W * 2,
    WALL_THICK,
    WALL_TOTAL_H,
    0, DOORWAY_CV,
    DOORWAY_W, DOORWAY_H,
    _hullDarkMat,
  );
  bulkhead.position.set(0, WALL_CENTER_Y, 0);
  bulkhead.rotation.x = -Math.PI / 2;
  g.add(bulkhead);

  // ──────────────────────────────────────────────────────────────────────
  // Exterior detail pass — pipes, vents, rust, hull seams, broken plates.
  // The hull is a box, so detail breaks up the silhouette.
  // ──────────────────────────────────────────────────────────────────────

  // Hull-plate seams on the right wall (5 verticals + 2 horizontals). The
  // crosshatch makes the wall read as plated armour rather than one slab.
  // AAO: 5cm seams read paper-thin at oblique angles → bumped to 10cm
  // (CLAUDE.md rule 7). They now read as chunkier welded ribs.
  for (let i = 0; i < 5; i++) {
    const seam = box(0.10, HALF_H * 2 - 0.2, 0.10, _hullDarkMat);
    seam.position.set(
      HALF_W + WALL_THICK + 0.05,
      HALF_H,
      -HALF_L + 1.0 + i * 2.4,
    );
    g.add(seam);
  }
  for (const y of [0.5, 2.0]) {
    const seam = box(0.10, 0.10, HALF_L * 2 - 0.4, _hullDarkMat);
    seam.position.set(HALF_W + WALL_THICK + 0.05, y, 0);
    g.add(seam);
  }
  // Mirror seams on the LEFT side too (sparser since the wall has an entrance).
  for (const z of [-HALF_L + 1.0, -HALF_L + 2.2, HALF_L - 1.0, HALF_L - 2.2]) {
    const seam = box(0.10, HALF_H * 2 - 0.2, 0.10, _hullDarkMat);
    seam.position.set(-HALF_W - WALL_THICK - 0.05, HALF_H, z);
    g.add(seam);
  }

  // Rust streaks — random vertical drips on both sides + roof. More than
  // the opening wreck: this thing's been baking longer.
  // AAO: 5cm × 0.05 thickness → 10cm thickness (rule 7).
  for (let i = 0; i < 14; i++) {
    const side = rand() < 0.5 ? -1 : 1;
    const streak = box(0.10, 0.5 + rand() * 1.2, 0.10 + rand() * 0.10, _rustMat);
    streak.position.set(
      side * (HALF_W + WALL_THICK + 0.05),
      HALF_H * 0.4 + rand() * (HALF_H * 1.3),
      -HALF_L + rand() * (HALF_L * 2),
    );
    g.add(streak);
  }
  // Rust patches scattered on the roof.
  // AAO: 4cm patch → 10cm (rule 7).
  for (let i = 0; i < 5; i++) {
    const patch = box(0.5 + rand() * 0.6, 0.10, 0.4 + rand() * 0.5, _rustDarkMat);
    patch.position.set(
      (rand() - 0.5) * (HALF_W * 1.4),
      HALF_H * 2 + 0.30,
      (rand() - 0.5) * (HALF_L * 1.6),
    );
    patch.rotation.y = rand() * Math.PI;
    g.add(patch);
  }

  // Exterior PIPES running along the side walls. Mix of horizontal lengths
  // and short verticals connecting them.
  // Right wall — three horizontal pipes at different heights.
  for (const [y, length, zOff] of [
    [0.6, HALF_L * 1.6, 0],
    [1.4, HALF_L * 1.2, 0.6],
    [2.1, HALF_L * 0.9, -0.8],
  ] as const) {
    const pipe = cyl(0.08, 0.08, length, _pipeMat, 8);
    pipe.rotation.x = Math.PI / 2;       // align cylinder length along Z
    pipe.position.set(HALF_W + WALL_THICK + 0.10, y, zOff);
    g.add(pipe);
  }
  // Right wall — two vertical pipe drops at fixed Z positions.
  for (const z of [-HALF_L + 1.5, HALF_L - 1.5]) {
    const drop = cyl(0.06, 0.06, HALF_H * 1.6, _pipeMat, 6);
    drop.position.set(HALF_W + WALL_THICK + 0.10, HALF_H * 0.85, z);
    g.add(drop);
  }
  // Left wall — two short horizontal pipes flanking the entrance.
  for (const z of [-HALF_L + 1.2, HALF_L - 1.2]) {
    const pipe = cyl(0.07, 0.07, 1.6, _pipeMat, 6);
    pipe.rotation.x = Math.PI / 2;
    pipe.position.set(-HALF_W - WALL_THICK - 0.10, 1.8, z);
    g.add(pipe);
  }

  // Vents / bulges on the side walls — small box protrusions.
  const ventPositions: Array<[number, number, number]> = [
    [+1, 0.8, -3.5],
    [+1, 1.8, 1.8],
    [-1, 1.0, 3.5],
    [-1, 1.6, -3.8],
  ];
  for (const [side, y, z] of ventPositions) {
    const vent = box(0.30, 0.30, 0.50, _hullDarkMat);
    vent.position.set(side * (HALF_W + WALL_THICK + 0.18), y, z);
    g.add(vent);
    // Small cap on the outer face
    const cap = cyl(0.10, 0.10, 0.06, _nozzleRimMat, 8);
    cap.rotation.z = Math.PI / 2;
    cap.position.set(side * (HALF_W + WALL_THICK + 0.36), y, z);
    g.add(cap);
  }

  // Broken hull-plate fragments around the entrance — tilted boxes around
  // the torn opening like the hull was peeled back.
  // AAO: 5cm fragments → 10cm (rule 7).
  for (let i = 0; i < 6; i++) {
    const w = 0.35 + rand() * 0.5;
    const h = 0.22 + rand() * 0.4;
    const frag = box(0.10, h, w, _rustDarkMat);
    // Around the entrance (Z ≈ 0, X = -HALF_W outward)
    const r = 1.6 + rand() * 0.5;
    const a = (rand() - 0.5) * Math.PI * 0.9;
    frag.position.set(
      -HALF_W - WALL_THICK - 0.08 - Math.cos(a) * 0.1,
      HALF_H + Math.sin(a) * r * 0.5,
      Math.sin(a) * r,
    );
    frag.rotation.x = (rand() - 0.5) * 0.6;
    frag.rotation.y = (rand() - 0.5) * 0.3;
    frag.rotation.z = a + (rand() - 0.5) * 0.4;
    g.add(frag);
  }

  // ──────────────────────────────────────────────────────────────────────
  // Segmented bridge cone at the -Z end. Built from a few rotated boxes
  // instead of a clean cone so the silhouette reads as patched panels.
  // ──────────────────────────────────────────────────────────────────────
  const bridgeG = new THREE.Group();
  bridgeG.position.set(0, HALF_H * 0.9, -HALF_L - WALL_THICK - 0.6);
  // Wide squat cone base
  const bridgeBase = box(HALF_W * 1.4, HALF_H * 1.6, 1.4, _hullMat);
  bridgeBase.position.z = 0;
  bridgeG.add(bridgeBase);
  // Narrow forward extension
  const bridgeNose = box(HALF_W * 0.8, HALF_H * 1.0, 1.4, _hullDarkMat);
  bridgeNose.position.z = -1.1;
  bridgeG.add(bridgeNose);
  // Two side-fin panels. AAO: 8cm → 10cm (rule 7).
  for (const side of [-1, 1] as const) {
    const fin = box(0.10, HALF_H * 0.7, 1.0, _hullMat);
    fin.position.set(side * HALF_W * 0.8, 0.2, -0.4);
    fin.rotation.z = side * 0.18;
    bridgeG.add(fin);
  }
  // Viewport — small dark glass-like slab on the nose. AAO: 5cm slab read
  // as a 2D decal at oblique angles → 10cm (rule 7); offset bumped a touch
  // so the viewport still sits proud of the nose face.
  const viewportMat = new THREE.MeshBasicMaterial({ color: 0x14181c });
  const viewport = new THREE.Mesh(new THREE.BoxGeometry(HALF_W * 0.5, 0.30, 0.10), viewportMat);
  viewport.position.set(0, 0.45, -1.80);
  bridgeG.add(viewport);
  g.add(bridgeG);

  // ──────────────────────────────────────────────────────────────────────
  // Engine bell at the +Z end. Larger frame + visible nozzle ring.
  // ──────────────────────────────────────────────────────────────────────
  const ENGINE_R = 1.6;
  const engineFrame = box(HALF_W * 1.8, 1.4, 0.6, _hullMat);
  engineFrame.position.set(0, HALF_H * 0.9, HALF_L + WALL_THICK + 0.3);
  g.add(engineFrame);
  // 3D bell mesh (CC-3) — flared cone + recessed interior, no more flat
  // disc. Mouth opens +Z (rotation.x = +π/2 maps local +Y → world +Z).
  const bell = makeEngineBellMesh(ENGINE_R, ENGINE_R * 1.1, _hullMat, _nozzleInteriorMat);
  bell.rotation.x = Math.PI / 2;
  bell.position.set(0, HALF_H * 0.9, HALF_L + WALL_THICK + 0.95);   // base anchors to engineFrame back; mouth ends at +Z ≈ +2.05
  g.add(bell);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const strut = cyl(0.06, 0.08, ENGINE_R * 0.8, _nozzleRimMat, 6);
    strut.position.set(
      Math.cos(a) * ENGINE_R,
      HALF_H * 0.9 + Math.sin(a) * ENGINE_R * 0.5,
      HALF_L + WALL_THICK + 1.6,
    );
    strut.rotation.z = a;
    g.add(strut);
  }

  // ──────────────────────────────────────────────────────────────────────
  // Wing fin on +X — long flat panel sticking out as if a stabiliser cracked.
  // ──────────────────────────────────────────────────────────────────────
  const fin = box(0.08, 2.2, 3.5, _hullMat);
  fin.position.set(HALF_W + WALL_THICK + 1.4, HALF_H * 0.6, HALF_L * 0.2);
  fin.rotation.z = 0.3;
  fin.rotation.x = 0.1;
  g.add(fin);
  // Smaller secondary fin off the -X side
  const fin2 = box(0.06, 1.1, 1.8, _hullDarkMat);
  fin2.position.set(-HALF_W - WALL_THICK - 0.6, HALF_H * 1.8, -HALF_L * 0.5);
  fin2.rotation.z = -0.4;
  fin2.rotation.y = 0.3;
  g.add(fin2);

  // ──────────────────────────────────────────────────────────────────────
  // Antenna masts on the roof — two of different heights for a richer
  // silhouette.
  // ──────────────────────────────────────────────────────────────────────
  const mast1 = cyl(0.06, 0.10, 3.0, _antennaMat, 6);
  mast1.position.set(0.6, HALF_H * 2 + 0.25 + 1.5, -HALF_L * 0.5);
  mast1.rotation.z = -0.05;
  g.add(mast1);
  const crossbar = box(0.7, 0.05, 0.05, _antennaMat);
  crossbar.position.set(0.6, HALF_H * 2 + 0.25 + 2.7, -HALF_L * 0.5);
  g.add(crossbar);
  // Second shorter mast off-center
  const mast2 = cyl(0.05, 0.08, 1.8, _antennaMat, 6);
  mast2.position.set(-0.4, HALF_H * 2 + 0.25 + 0.9, HALF_L * 0.4);
  mast2.rotation.z = 0.12;
  g.add(mast2);
  // Roof-mounted box (transformer / power unit)
  const transformer = box(0.6, 0.4, 0.8, _hullDarkMat);
  transformer.position.set(-1.2, HALF_H * 2 + 0.45, HALF_L * 0.1);
  g.add(transformer);

  // ──────────────────────────────────────────────────────────────────────
  // INTERIOR detail. The cavity is dark and the player explores with a
  // light source (AA's torch/flashlight). Add pipes and conduits running
  // along the walls + ceiling so there's something to see when lit.
  // ──────────────────────────────────────────────────────────────────────

  // Ceiling pipes — 3 cylinders parallel to the ship's length, hanging
  // ~25cm below the roof. Different lengths so they read as broken.
  const ceilingPipeY = HALF_H * 2 - 0.25;
  for (const [xOff, length, zCenter] of [
    [-1.4, HALF_L * 1.5, 0],
    [0.0, HALF_L * 1.2, 1.0],
    [+1.4, HALF_L * 1.0, -1.5],
  ] as const) {
    const pipe = cyl(0.10, 0.10, length, _pipeMat, 6);
    pipe.rotation.x = Math.PI / 2;
    pipe.position.set(xOff, ceilingPipeY, zCenter);
    g.add(pipe);
  }
  // Short dangling pipe stub (broken end)
  const dangler = cyl(0.08, 0.08, 0.9, _pipeMat, 6);
  dangler.rotation.z = 0.6;
  dangler.position.set(0.8, HALF_H * 2 - 0.6, HALF_L * 0.6);
  g.add(dangler);

  // Wall conduits — short horizontal pipes near eye level on each interior wall.
  const conduitY = 1.6;
  for (const [side, zs] of [
    [-1, [-3.0, -1.2, 1.2, 3.0]] as const,
    [+1, [-3.2, -1.5, 1.5, 3.2]] as const,
  ]) {
    for (let i = 0; i < zs.length - 1; i++) {
      const cz1 = zs[i], cz2 = zs[i + 1];
      const segLen = Math.abs(cz2 - cz1) - 0.1;
      if (segLen <= 0) continue;
      const conduit = cyl(0.05, 0.05, segLen, _antennaMat, 6);
      conduit.rotation.x = Math.PI / 2;
      conduit.position.set(side * (HALF_W - 0.08), conduitY, (cz1 + cz2) / 2);
      g.add(conduit);
    }
    // Small junction box at each "joint"
    for (const z of zs) {
      const junc = box(0.12, 0.12, 0.12, _hullDarkMat);
      junc.position.set(side * (HALF_W - 0.08), conduitY, z);
      g.add(junc);
    }
  }

  // Vertical conduit drops from the ceiling pipes down to the wall conduits
  for (const [x, z] of [[-1.4, -3.0], [-1.4, 3.0], [1.4, -3.2], [1.4, 3.2]] as const) {
    const drop = cyl(0.04, 0.04, ceilingPipeY - conduitY, _antennaMat, 5);
    drop.position.set(x * 1.7 / 2.5, (ceilingPipeY + conduitY) / 2, z);
    g.add(drop);
  }

  // ──────────────────────────────────────────────────────────────────────
  // Shadow flags. Respect userData.noShadow per AA pattern.
  // ──────────────────────────────────────────────────────────────────────
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
 * Place the mega-ship at a world position with a Y-axis yaw and an
 * optional tilt quaternion (e.g. matching terrain normal). Attaches
 * walls + roof + bulkhead colliders, registers an interior shelter zone,
 * and registers THREE separate `Salvageable`s — one per chamber + one on
 * the exterior engine bell.
 */
export function placeMegaShip(
  scene: THREE.Scene,
  world: RAPIER.World,
  _terrain: Terrain,
  pos: THREE.Vector3,
  yaw: number,
  tilt: THREE.Quaternion,
  rand: Rng,
  shelter: ShelterRegistry,
  salvageables: SalvageableRegistry,
): THREE.Group {
  const group = makeMegaShip(rand);
  group.position.copy(pos);
  // Compose orientation: yaw around Y, then apply terrain-tilt on top.
  const yawQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  const finalQ = new THREE.Quaternion().multiplyQuaternions(tilt, yawQ);
  group.quaternion.copy(finalQ);
  scene.add(group);

  // ── Colliders — fixed body at the ship origin, rotated by the same
  // compound quaternion. Walls, bulkhead, and roof get cuboid colliders.
  // No floor collider — terrain serves as the floor.
  const bodyDesc = RAPIER.RigidBodyDesc.fixed()
    .setTranslation(pos.x, pos.y, pos.z)
    .setRotation({ x: finalQ.x, y: finalQ.y, z: finalQ.z, w: finalQ.w });
  const body = world.createRigidBody(bodyDesc);

  // Front wall (-Z) — covers full vertical (including the buried portion).
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(HALF_W + WALL_THICK, WALL_TOTAL_H / 2, WALL_THICK / 2)
      .setTranslation(0, WALL_CENTER_Y, -HALF_L - WALL_THICK / 2),
    body,
  );
  // Back wall (+Z)
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(HALF_W + WALL_THICK, WALL_TOTAL_H / 2, WALL_THICK / 2)
      .setTranslation(0, WALL_CENTER_Y, HALF_L + WALL_THICK / 2),
    body,
  );
  // Right wall (+X, solid)
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(WALL_THICK / 2, WALL_TOTAL_H / 2, HALF_L)
      .setTranslation(HALF_W + WALL_THICK / 2, WALL_CENTER_Y, 0),
    body,
  );
  // Left wall (-X) — split into FOUR colliders to leave the entrance opening
  // clear: buried bottom strip (full Z) + lintel above entrance (full Z) +
  // front segment + back segment (in entrance Y band).
  // Buried strip: from local Y=-WALL_BURY to Y=0, full Z length.
  {
    const buriedH = WALL_BURY;
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(WALL_THICK / 2, buriedH / 2, HALF_L)
        .setTranslation(-HALF_W - WALL_THICK / 2, -buriedH / 2, 0),
      body,
    );
  }
  // Lintel: from local Y=ENTRANCE_H to Y=HALF_H*2, full Z length.
  {
    const lintelH = HALF_H * 2 - ENTRANCE_H;
    if (lintelH > 0) {
      world.createCollider(
        RAPIER.ColliderDesc.cuboid(WALL_THICK / 2, lintelH / 2, HALF_L)
          .setTranslation(-HALF_W - WALL_THICK / 2, ENTRANCE_H + lintelH / 2, 0),
        body,
      );
    }
  }
  // Front + back segments of the entrance-height band.
  const sideLen = HALF_L - ENTRANCE_W / 2;
  if (sideLen > 0) {
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(WALL_THICK / 2, ENTRANCE_H / 2, sideLen / 2)
        .setTranslation(-HALF_W - WALL_THICK / 2, ENTRANCE_H / 2, -HALF_L + sideLen / 2),
      body,
    );
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(WALL_THICK / 2, ENTRANCE_H / 2, sideLen / 2)
        .setTranslation(-HALF_W - WALL_THICK / 2, ENTRANCE_H / 2, HALF_L - sideLen / 2),
      body,
    );
  }
  // Roof
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(HALF_W + WALL_THICK, 0.125, HALF_L + WALL_THICK)
      .setTranslation(0, HALF_H * 2 + 0.125, 0),
    body,
  );
  // Interior bulkhead — buried strip + side panels + lintel (around doorway).
  {
    const buriedH = WALL_BURY;
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(HALF_W, buriedH / 2, WALL_THICK / 2)
        .setTranslation(0, -buriedH / 2, 0),
      body,
    );
  }
  const bulkheadSideLen = HALF_W - DOORWAY_W / 2;
  if (bulkheadSideLen > 0) {
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(bulkheadSideLen / 2, DOORWAY_H / 2, WALL_THICK / 2)
        .setTranslation(-HALF_W + bulkheadSideLen / 2, DOORWAY_H / 2, 0),
      body,
    );
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(bulkheadSideLen / 2, DOORWAY_H / 2, WALL_THICK / 2)
        .setTranslation(HALF_W - bulkheadSideLen / 2, DOORWAY_H / 2, 0),
      body,
    );
  }
  const lintelHeight = HALF_H * 2 - DOORWAY_H;
  if (lintelHeight > 0) {
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(DOORWAY_W / 2, lintelHeight / 2, WALL_THICK / 2)
        .setTranslation(0, DOORWAY_H + lintelHeight / 2, 0),
      body,
    );
  }

  // CC-3.2 — engine bell collider (cylinder, axis along +Z to match the
  // bell's mouth direction). Bell mesh is at body-local
  // (0, HALF_H*0.9, HALF_L + WALL_THICK + 0.95) with depth = ENGINE_R * 1.1.
  // The body's existing fixed rotation transforms this into world space.
  const _bellRotMs = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
  const ENGINE_R_MS = 1.6;
  const BELL_DEPTH_MS = ENGINE_R_MS * 1.1;
  world.createCollider(
    RAPIER.ColliderDesc.cylinder(BELL_DEPTH_MS / 2, ENGINE_R_MS)
      .setTranslation(0, HALF_H * 0.9, HALF_L + WALL_THICK + 0.95 + BELL_DEPTH_MS / 2)
      .setRotation({ x: _bellRotMs.x, y: _bellRotMs.y, z: _bellRotMs.z, w: _bellRotMs.w }),
    body,
  );

  // ── Shelter zone covering the cavity. Oversized so the axis-aligned
  // zone covers the rotated + tilted cavity in worst case.
  const shelterHalf = Math.sqrt(HALF_W * HALF_W + HALF_L * HALF_L);
  addShelterZone(
    shelter,
    { x: pos.x, y: pos.y + HALF_H, z: pos.z },
    { x: shelterHalf, y: HALF_H + 0.5, z: shelterHalf },
  );

  // ── Salvage panels — each in its own sub-group of `group` so they can
  // strip independently. registerSalvageable reads
  // `subgroup.userData.accessPanel` and tags THAT mesh as the interact
  // target.
  // 1. Bridge chamber — panel on the front wall interior, lower left.
  const bridgePanel = new THREE.Group();
  bridgePanel.position.set(-1.5, 1.0, -HALF_L + 0.12);
  group.add(bridgePanel);
  addAccessPanel(bridgePanel, 0, 0, 0, 1, 0);
  // 2. Cargo chamber — panel on the back wall interior, lower right.
  const cargoPanel = new THREE.Group();
  cargoPanel.position.set(1.5, 1.0, HALF_L - 0.12);
  cargoPanel.rotation.y = Math.PI;
  group.add(cargoPanel);
  addAccessPanel(cargoPanel, 0, 0, 0, 1, 0);
  // 3. Engine bell — panel on the bell's rim, exterior.
  const bellPanel = new THREE.Group();
  bellPanel.position.set(1.4, HALF_H * 0.9, HALF_L + WALL_THICK + 1.8);
  bellPanel.rotation.y = Math.PI / 2;
  group.add(bellPanel);
  addAccessPanel(bellPanel, 0, 0, 0, 1, 0);

  // Compute each panel's WORLD position (accounting for yaw + tilt + ship pos)
  // for the Salvageable.pos field.
  const worldPos = (local: THREE.Vector3): THREE.Vector3 => {
    return local.clone().applyQuaternion(finalQ).add(pos);
  };
  registerSalvageable(salvageables, bridgePanel, 'massive', worldPos(bridgePanel.position), rand);
  registerSalvageable(salvageables, cargoPanel, 'massive', worldPos(cargoPanel.position), rand);
  registerSalvageable(salvageables, bellPanel, 'engine_bell', worldPos(bellPanel.position), rand);

  // ── Debris field around the wreck — denser than other POIs.
  placeDebrisField(scene, _terrain, pos, 22, rand, 24);

  return group;
}
