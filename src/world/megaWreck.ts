// Mega-wreck POI (Sessions BB-2 + BB-3) — a Force Awakens / Jakku-scale
// crashed ship. 120m long × 45m wide × 30m+ tall above sand, in the
// unused SW quadrant at (-180, -130). Three hull sections (bow, mid-hull
// break, aft) plus a bridge tower on top of aft and two giant engine
// bells at the rear.
//
// BB-2 (this file's initial cut) ships the MINIMUM PLAYABLE SHELL:
//   • Walk-through end-to-end: bow side entrance → bow chamber → open
//     mid-hull break → doorway → main aft bay.
//   • 2 salvage panels (1 main aft bay, 1 bow chamber).
//   • Shelter zone covering the main aft bay.
//   • Engine bells visual only (no salvage, no colliders).
//   • Bridge tower visual only (collidable but no entry).
//
// BB-3 (deferred) adds catwalks/ramps, side room (Chamber 3), skylights,
// the remaining 6 salvage panels, interior detail pass (pipes,
// conduits, consoles, broken plates), exterior detail (rust, seams,
// fragments), bridge-tower climb + antenna spire, surrounding debris
// field, and small companion wrecks for scale reference.
//
// Local space convention (same as megaShip):
//   +Z = aft/engine end ; -Z = bow tip
//   -X = bow side-entrance side
//   y=0 = nominal terrain inside the cavity. Walls extend WALL_BURY
//         below this so they always reach below the surrounding terrain.
//
// Reuses megaShip's patterns 1:1 for materials, panelWithHole-based wall
// holes, sub-group salvage panels, oversized AABB shelter zone, and
// cuboid colliders on a single fixed body.

import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { Rng } from '../core/rng.ts';
import type { Terrain } from './terrain.ts';
import { Tuning } from '../config/tuning.ts';
import { panelWithHole } from './panelUtils.ts';
import { addAccessPanel, placeDebrisField, makeEngineBellMesh } from './wrecks.ts';
import { addShelterZone, type ShelterRegistry } from '../shelter/shelterZones.ts';
import { registerSalvageable, type SalvageableRegistry } from './salvage.ts';

// ── Shared materials — same palette as megaShip.
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
const _pipeMat = new THREE.MeshLambertMaterial({
  color: 0x3a3028,
  flatShading: true,
});
const _viewportMat = new THREE.MeshBasicMaterial({ color: 0x14181c });

// ── Burial + wall thickness. WALL_BURY scaled up from megaShip's 2.0m
// because at 120m length even small terrain variation otherwise exposes
// the wall underside.
const WALL_BURY = 7.0;
const WALL_THICK = 0.4;
const ROOF_HALF_T = 0.125;

// ── Bow section (chamber 1). Narrow + short — the "nose-dive" silhouette
// at this scale comes from the bow being half the aft's height, not from
// a Y-offset (a Y-offset would push the entrance hole below terrain at
// this WALL_BURY). True tilted-bow geometry deferred to BB-3.
const BOW_HALF_W = 9.0;
const BOW_HALF_H = 4.0;            // 8m visible above sand
const BOW_HALF_L = 17.5;           // 35m long
const BOW_ORIGIN_Z = -42.5;        // centers bow at world Z=-42.5 in body frame
const BOW_WALL_TOTAL_H = BOW_HALF_H * 2 + WALL_BURY;
const BOW_WALL_CENTER_Y = (BOW_HALF_H * 2 - WALL_BURY) / 2;

// ── Aft section (chamber 2 / main bay). Cavernous.
const AFT_HALF_W = 20.0;           // 40m wide
const AFT_HALF_H = 11.0;           // 22m visible above sand
const AFT_HALF_L = 30.0;           // 60m long
const AFT_ORIGIN_Z = 20.0;         // mid-hull break = local Z [-25, -10]
const AFT_WALL_TOTAL_H = AFT_HALF_H * 2 + WALL_BURY;
const AFT_WALL_CENTER_Y = (AFT_HALF_H * 2 - WALL_BURY) / 2;

// ── Bridge tower — sits on aft roof. Visual landmark, no entry in BB-2.
const TOWER_HALF_W = 5.0;
const TOWER_HALF_H = 6.0;          // 12m tall → 34m total above sand
const TOWER_HALF_L = 4.0;
const TOWER_BASE_Y = AFT_HALF_H * 2;
const TOWER_OFFSET_Z = -AFT_HALF_L * 0.4;   // forward of aft center

// ── Side entrance on bow chamber (-X wall). Tall (4m) for slack so the
// player still fits even when terrain at the entrance position sits 1m+
// above the bow's terrain-aligned cavity floor.
const BOW_ENTRANCE_W = 3.5;        // along Z (ship length)
const BOW_ENTRANCE_H = 4.0;        // along Y (vertical)
const BOW_ENTRANCE_CU = BOW_ENTRANCE_H / 2 - BOW_WALL_CENTER_Y;

// ── Doorway between mid-hull break and main aft bay (aft -Z front wall).
const AFT_DOOR_W = 6.0;
const AFT_DOOR_H = 6.0;
const AFT_DOOR_CV = AFT_DOOR_H / 2 - AFT_WALL_CENTER_Y;

// ── Engine bells (rear of aft). Salvageable in BB-3.
const BELL_R = 5.0;                // 10m diameter each
const BELL_OFFSET_X = 10.0;        // half-distance between bell centers
const BELL_OFFSET_Z = 4.0;         // out from aft back wall

// ── Side room (Chamber 3) — dark side chamber off aft +X wall.
const SIDE_HALF_W = 8.0;           // 16m wide
const SIDE_HALF_H = 6.0;           // 12m tall
const SIDE_HALF_L = 10.0;          // 20m long
const SIDE_ORIGIN_X = AFT_HALF_W + WALL_THICK + SIDE_HALF_W;   // 28.4
const SIDE_ORIGIN_Z = 5.0;
const SIDE_WALL_TOTAL_H = SIDE_HALF_H * 2 + WALL_BURY;          // 19
const SIDE_WALL_CENTER_Y = (SIDE_HALF_H * 2 - WALL_BURY) / 2;   // 2.5

// Doorway in aft +X wall (panel built XZ-plane thickness-Y, rotated
// -π/2 around Z so panel +Y → world +X; panel +X → world -Y, so cu sign
// flips relative to world-Y offset).
const SIDE_DOOR_W = 2.5;           // along Z (world Z)
const SIDE_DOOR_H = 4.0;           // along Y (world Y)
const SIDE_DOOR_CU = AFT_WALL_CENTER_Y - SIDE_DOOR_H / 2;       // 5.5
const SIDE_DOOR_CV = SIDE_ORIGIN_Z - AFT_ORIGIN_Z;              // -15

// ── Catwalks (in aft bay only).
const CATWALK_T = 0.2;
const CATWALK_LOW_Y = 3.0;
const CATWALK_LOW_W = 1.8;
const CATWALK_LOW_L = AFT_HALF_L * 2 - 4;        // 56m
const CATWALK_UP_Y = 7.0;
const CATWALK_UP_W = AFT_HALF_W * 2 - 2;         // 38m (across the bay)
const CATWALK_UP_L = 1.8;
const CATWALK_STUB_Y = 11.0;
const CATWALK_STUB_W = 6.0;
const CATWALK_STUB_L = 4.0;

// ── Skylights — 3 holes in 3 roof strips along Z.
const SKYLIGHT_HW = 4.0;           // along X
const SKYLIGHT_HD = 6.0;           // along Z
// Strip Z ranges: each strip is 1/3 of the aft length.
const ROOF_STRIPS: ReadonlyArray<{ z0: number; z1: number; holeCv: number }> = [
  { z0: -10, z1: 10,  holeCv: -2 },   // strip 1, hole at body Z ≈ -2
  { z0: 10,  z1: 30,  holeCv:  3 },   // strip 2, hole at body Z ≈ 23
  { z0: 30,  z1: 50,  holeCv: -2 },   // strip 3, hole at body Z ≈ 38
];

// ── Bow ragged opening (in bow +X wall, for side-light).
const BOW_OPENING_W = 2.0;         // along Z
const BOW_OPENING_H = 2.5;         // along Y
const BOW_OPENING_Y_CENTER = 1.5 + BOW_OPENING_H / 2;            // 2.75 in bow frame
const BOW_OPENING_CU = BOW_WALL_CENTER_Y - BOW_OPENING_Y_CENTER; // -2.25

// ── Tower climb (debris ramp + steps from aft roof to tower top).
const TOWER_RAMP_PITCH = Math.PI / 5;   // 36°
const TOWER_RAMP_L = 6.0;
const TOWER_RAMP_W = 2.0;
const TOWER_RAMP_T = 0.25;
const TOWER_STEP_T = 0.3;            // step thickness
const TOWER_STEP_W = 2.0;
const TOWER_STEP_L = 1.4;

function box(w: number, h: number, d: number, mat: THREE.Material): THREE.Mesh {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
}

function cyl(rTop: number, rBot: number, h: number, mat: THREE.Material, seg = 8): THREE.Mesh {
  return new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, seg), mat);
}

/**
 * Build the mega-wreck meshes. Caller positions + rotates the returned
 * group. Salvage panels live in dedicated sub-groups attached during
 * placeMegaWreck so each can strip independently.
 *
 * The BOW section is built inside a named sub-group ('bow') so its Y can
 * be offset at placement time to match terrain at the bow's far-flung
 * world position — over a 120m length the terrain Y at the bow may
 * differ by several meters from the wreck root's mean Y.
 */
export function makeMegaWreck(rand: Rng): THREE.Group {
  // Local alias so the existing _rand() calls in the detail pass stay terse.
  const _rand = rand;
  const g = new THREE.Group();

  // ────────────────────────────────────────────────────────────────────
  // BOW section (chamber 1). Back is OPEN — opens to the mid-hull break.
  // Wrapped in a named sub-group; placeMegaWreck shifts its Y so the
  // bow's cavity floor lines up with local terrain.
  // ────────────────────────────────────────────────────────────────────
  const bowGroup = new THREE.Group();
  bowGroup.name = 'bow';
  g.add(bowGroup);

  // Front wall (-Z tip).
  {
    const w = box(
      BOW_HALF_W * 2 + WALL_THICK * 2,
      BOW_WALL_TOTAL_H,
      WALL_THICK,
      _hullDarkMat,
    );
    w.position.set(0, BOW_WALL_CENTER_Y, BOW_ORIGIN_Z - BOW_HALF_L - WALL_THICK / 2);
    bowGroup.add(w);
  }

  // Left side wall (-X) — pierced with the entrance.
  {
    const w = panelWithHole(
      BOW_WALL_TOTAL_H, WALL_THICK, BOW_HALF_L * 2,
      BOW_ENTRANCE_CU, 0,
      BOW_ENTRANCE_H, BOW_ENTRANCE_W,
      _hullMat,
    );
    w.position.set(-BOW_HALF_W - WALL_THICK / 2, BOW_WALL_CENTER_Y, BOW_ORIGIN_Z);
    w.rotation.z = Math.PI / 2;
    bowGroup.add(w);
  }

  // Right side wall (+X) — small ragged opening for side-light.
  {
    const w = panelWithHole(
      BOW_WALL_TOTAL_H, WALL_THICK, BOW_HALF_L * 2,
      BOW_OPENING_CU, 0,
      BOW_OPENING_H, BOW_OPENING_W,
      _hullMat,
    );
    w.position.set(BOW_HALF_W + WALL_THICK / 2, BOW_WALL_CENTER_Y, BOW_ORIGIN_Z);
    w.rotation.z = -Math.PI / 2;   // panel +Y → world +X (face outward)
    bowGroup.add(w);
  }

  // NO back wall — open to mid-hull break.

  // Roof.
  {
    const r = box(
      BOW_HALF_W * 2 + WALL_THICK * 2,
      ROOF_HALF_T * 2,
      BOW_HALF_L * 2 + WALL_THICK * 2,
      _hullMat,
    );
    r.position.set(0, BOW_HALF_H * 2 + ROOF_HALF_T, BOW_ORIGIN_Z);
    bowGroup.add(r);
  }

  // ────────────────────────────────────────────────────────────────────
  // AFT section (chamber 2 / main bay). Front faces mid-hull break.
  // ────────────────────────────────────────────────────────────────────

  // Front wall (-Z) — doorway hole at floor level.
  {
    const w = panelWithHole(
      AFT_HALF_W * 2 + WALL_THICK * 2,
      WALL_THICK,
      AFT_WALL_TOTAL_H,
      0, AFT_DOOR_CV,
      AFT_DOOR_W, AFT_DOOR_H,
      _hullDarkMat,
    );
    w.position.set(0, AFT_WALL_CENTER_Y, AFT_ORIGIN_Z - AFT_HALF_L - WALL_THICK / 2);
    w.rotation.x = -Math.PI / 2;
    g.add(w);
  }

  // Back wall (+Z) — engine bulkhead, solid.
  {
    const w = box(
      AFT_HALF_W * 2 + WALL_THICK * 2,
      AFT_WALL_TOTAL_H,
      WALL_THICK,
      _hullDarkMat,
    );
    w.position.set(0, AFT_WALL_CENTER_Y, AFT_ORIGIN_Z + AFT_HALF_L + WALL_THICK / 2);
    g.add(w);
  }

  // Left wall (-X) — solid.
  {
    const w = box(WALL_THICK, AFT_WALL_TOTAL_H, AFT_HALF_L * 2, _hullMat);
    w.position.set(-AFT_HALF_W - WALL_THICK / 2, AFT_WALL_CENTER_Y, AFT_ORIGIN_Z);
    g.add(w);
  }

  // Right wall (+X) — doorway into side room (Chamber 3).
  {
    const w = panelWithHole(
      AFT_WALL_TOTAL_H, WALL_THICK, AFT_HALF_L * 2,
      SIDE_DOOR_CU, SIDE_DOOR_CV,
      SIDE_DOOR_H, SIDE_DOOR_W,
      _hullMat,
    );
    w.position.set(AFT_HALF_W + WALL_THICK / 2, AFT_WALL_CENTER_Y, AFT_ORIGIN_Z);
    w.rotation.z = -Math.PI / 2;
    g.add(w);
  }

  // Roof — 3 strip panels with skylight holes (replaces single roof box).
  for (const strip of ROOF_STRIPS) {
    const stripLen = strip.z1 - strip.z0;
    const stripCenterZ = (strip.z0 + strip.z1) / 2;
    const r = panelWithHole(
      AFT_HALF_W * 2 + WALL_THICK * 2,
      ROOF_HALF_T * 2,
      stripLen,
      0, strip.holeCv,
      SKYLIGHT_HW, SKYLIGHT_HD,
      _hullMat,
    );
    r.position.set(0, AFT_HALF_H * 2 + ROOF_HALF_T, stripCenterZ);
    g.add(r);
  }

  // ────────────────────────────────────────────────────────────────────
  // BRIDGE TOWER. 12m box on top of aft section.
  // ────────────────────────────────────────────────────────────────────
  const towerCenterZ = AFT_ORIGIN_Z + TOWER_OFFSET_Z;
  // Front wall.
  {
    const w = box(
      TOWER_HALF_W * 2 + WALL_THICK * 2,
      TOWER_HALF_H * 2,
      WALL_THICK,
      _hullDarkMat,
    );
    w.position.set(0, TOWER_BASE_Y + TOWER_HALF_H, towerCenterZ - TOWER_HALF_L - WALL_THICK / 2);
    g.add(w);
  }
  // Back wall.
  {
    const w = box(
      TOWER_HALF_W * 2 + WALL_THICK * 2,
      TOWER_HALF_H * 2,
      WALL_THICK,
      _hullDarkMat,
    );
    w.position.set(0, TOWER_BASE_Y + TOWER_HALF_H, towerCenterZ + TOWER_HALF_L + WALL_THICK / 2);
    g.add(w);
  }
  // Left wall.
  {
    const w = box(WALL_THICK, TOWER_HALF_H * 2, TOWER_HALF_L * 2, _hullMat);
    w.position.set(-TOWER_HALF_W - WALL_THICK / 2, TOWER_BASE_Y + TOWER_HALF_H, towerCenterZ);
    g.add(w);
  }
  // Right wall.
  {
    const w = box(WALL_THICK, TOWER_HALF_H * 2, TOWER_HALF_L * 2, _hullMat);
    w.position.set(TOWER_HALF_W + WALL_THICK / 2, TOWER_BASE_Y + TOWER_HALF_H, towerCenterZ);
    g.add(w);
  }
  // Roof.
  {
    const r = box(
      TOWER_HALF_W * 2 + WALL_THICK * 2,
      ROOF_HALF_T * 2,
      TOWER_HALF_L * 2 + WALL_THICK * 2,
      _hullMat,
    );
    r.position.set(0, TOWER_BASE_Y + TOWER_HALF_H * 2 + ROOF_HALF_T, towerCenterZ);
    g.add(r);
  }

  // ────────────────────────────────────────────────────────────────────
  // ENGINE BELLS — 2 giant nozzles at the rear of aft. Visual only.
  // Uses the shared 3D bell helper (CC-3) so the hero-scale 10m
  // diameter bells read as real flared nozzles from any angle.
  // ────────────────────────────────────────────────────────────────────
  const bellCenterY = AFT_HALF_H * 0.7;
  const bellCenterZ = AFT_ORIGIN_Z + AFT_HALF_L + WALL_THICK + BELL_OFFSET_Z;
  const BELL_DEPTH = BELL_R * 1.1;
  for (const side of [-1, 1] as const) {
    const x = side * BELL_OFFSET_X;
    // Mounting frame behind the bell.
    const frame = box(BELL_R * 1.8, BELL_R * 1.6, 1.2, _hullDarkMat);
    frame.position.set(x, bellCenterY, bellCenterZ - 1.0);
    g.add(frame);
    // 3D bell — mouth opens +Z; anchor base just past the mounting frame.
    const bell = makeEngineBellMesh(BELL_R, BELL_DEPTH, _hullMat, _nozzleInteriorMat);
    bell.rotation.x = Math.PI / 2;
    bell.position.set(x, bellCenterY, bellCenterZ - BELL_DEPTH / 2);
    g.add(bell);
    // 3 struts radiating off the bell's outer rim — same broken-mount
    // detail as the original.
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const strut = cyl(0.15, 0.20, BELL_R * 0.7, _nozzleRimMat, 6);
      strut.position.set(
        x + Math.cos(a) * BELL_R * 0.85,
        bellCenterY + Math.sin(a) * BELL_R * 0.5,
        bellCenterZ - 0.3,
      );
      strut.rotation.z = a;
      g.add(strut);
    }
  }

  // ────────────────────────────────────────────────────────────────────
  // SIDE ROOM (Chamber 3) — dark side chamber off aft +X wall. The aft
  // +X wall (with the doorway hole) doubles as the side room's -X wall.
  // ────────────────────────────────────────────────────────────────────
  const sideGroup = new THREE.Group();
  sideGroup.name = 'sideRoom';
  g.add(sideGroup);
  // +X wall (far wall of side room).
  {
    const w = box(WALL_THICK, SIDE_WALL_TOTAL_H, SIDE_HALF_L * 2, _hullMat);
    w.position.set(SIDE_ORIGIN_X + SIDE_HALF_W + WALL_THICK / 2, SIDE_WALL_CENTER_Y, SIDE_ORIGIN_Z);
    sideGroup.add(w);
  }
  // -Z wall.
  {
    const w = box(SIDE_HALF_W * 2 + WALL_THICK * 2, SIDE_WALL_TOTAL_H, WALL_THICK, _hullDarkMat);
    w.position.set(SIDE_ORIGIN_X, SIDE_WALL_CENTER_Y, SIDE_ORIGIN_Z - SIDE_HALF_L - WALL_THICK / 2);
    sideGroup.add(w);
  }
  // +Z wall.
  {
    const w = box(SIDE_HALF_W * 2 + WALL_THICK * 2, SIDE_WALL_TOTAL_H, WALL_THICK, _hullDarkMat);
    w.position.set(SIDE_ORIGIN_X, SIDE_WALL_CENTER_Y, SIDE_ORIGIN_Z + SIDE_HALF_L + WALL_THICK / 2);
    sideGroup.add(w);
  }
  // Roof (solid — fully dark room).
  {
    const r = box(
      SIDE_HALF_W * 2 + WALL_THICK * 2,
      ROOF_HALF_T * 2,
      SIDE_HALF_L * 2 + WALL_THICK * 2,
      _hullMat,
    );
    r.position.set(SIDE_ORIGIN_X, SIDE_HALF_H * 2 + ROOF_HALF_T, SIDE_ORIGIN_Z);
    sideGroup.add(r);
  }

  // ────────────────────────────────────────────────────────────────────
  // CATWALKS (3) inside main aft bay.
  // ────────────────────────────────────────────────────────────────────
  // Lower — along -X wall, full bay length.
  {
    const cw = box(CATWALK_LOW_W, CATWALK_T, CATWALK_LOW_L, _hullDarkMat);
    cw.position.set(-AFT_HALF_W + CATWALK_LOW_W / 2 + 0.1, CATWALK_LOW_Y, AFT_ORIGIN_Z);
    g.add(cw);
  }
  // Upper — perpendicular across the bay.
  {
    const cw = box(CATWALK_UP_W, CATWALK_T, CATWALK_UP_L, _hullDarkMat);
    cw.position.set(0, CATWALK_UP_Y, AFT_ORIGIN_Z);
    g.add(cw);
  }
  // Bridge-overlook stub — short dead-end against back wall.
  {
    const cw = box(CATWALK_STUB_W, CATWALK_T, CATWALK_STUB_L, _hullDarkMat);
    cw.position.set(0, CATWALK_STUB_Y, AFT_ORIGIN_Z + AFT_HALF_L - CATWALK_STUB_L / 2 - 0.3);
    g.add(cw);
  }

  // ────────────────────────────────────────────────────────────────────
  // RAMPS (3) — access to the catwalks.
  // ────────────────────────────────────────────────────────────────────
  // Ramp 1: tilted broken hull plate from bay floor to lower catwalk.
  // 30° pitch; place near the aft front doorway end.
  {
    const ramp = box(CATWALK_LOW_W, 0.2, 6.0, _hullDarkMat);
    ramp.position.set(-AFT_HALF_W + CATWALK_LOW_W / 2 + 0.1, 1.5, AFT_ORIGIN_Z - AFT_HALF_L * 0.7);
    ramp.rotation.x = -Math.PI / 6;     // 30° (lifts +Z end up)
    g.add(ramp);
  }
  // Ramp 2: fallen interior bulkhead from lower → upper, 25° pitch.
  // Spans body Z midway. Place at +X side of bay so it doesn't cross lower catwalk.
  {
    const ramp = box(1.8, 0.2, 10.0, _hullMat);
    ramp.position.set(AFT_HALF_W - 5, 5.0, AFT_ORIGIN_Z);
    ramp.rotation.x = -Math.PI / 7.2;   // 25° (rises toward +Z)
    g.add(ramp);
  }
  // Ramp 3: stack of 3 debris boxes acting as steps from upper to stub.
  {
    for (let i = 0; i < 3; i++) {
      const step = box(2.0, 1.4, 1.4, _hullDarkMat);
      step.position.set(0, CATWALK_UP_Y + 0.7 + i * 1.4, AFT_ORIGIN_Z + AFT_HALF_L - 8 + i * 1.4);
      g.add(step);
    }
  }

  // ────────────────────────────────────────────────────────────────────
  // BRIDGE TOWER CLIMB — ramp + steps from aft roof to tower top.
  // ────────────────────────────────────────────────────────────────────
  const towerCenterZ_geom = AFT_ORIGIN_Z + TOWER_OFFSET_Z;
  // Tilted ramp from aft roof (Y=22) up to tower front-wall mid-height.
  // 36° pitch, rises toward -Z to meet the tower's front wall.
  {
    const ramp = box(TOWER_RAMP_W, TOWER_RAMP_T, TOWER_RAMP_L, _hullDarkMat);
    // Center the ramp so its top end abuts tower's -Z wall at Y≈28.
    // Center Y = (22 + 28)/2 = 25, center Z = towerCenterZ - TOWER_HALF_L - TOWER_RAMP_L/2 * cos(pitch)
    const cz = towerCenterZ_geom - TOWER_HALF_L - 2.0;
    ramp.position.set(0, 25, cz);
    ramp.rotation.x = -TOWER_RAMP_PITCH;     // rises toward +Z (tower side)
    g.add(ramp);
  }
  // 3 stack steps from tower-front mid-height up to tower roof (Y=34).
  for (let i = 0; i < 3; i++) {
    const step = box(TOWER_STEP_W, TOWER_STEP_T, TOWER_STEP_L, _hullDarkMat);
    step.position.set(
      0,
      28 + (i + 1) * 2,                            // rises 2m per step (28→30→32→34)
      towerCenterZ_geom - TOWER_HALF_L - 0.2 - i * 0.5,
    );
    g.add(step);
  }

  // ────────────────────────────────────────────────────────────────────
  // EXTERIOR DETAIL pass — seams, rust, pipes, vents, antenna stubs.
  // ────────────────────────────────────────────────────────────────────
  // Hull-plate seams on aft +Z back wall (5 verticals + 2 horizontals).
  // AAO: 6cm welds read paper-thin at oblique angles → bumped to 10cm
  // (CLAUDE.md rule 7). Seam offset bumped 0.03 → 0.05 so the outer
  // face still sits proud of the wall by the same margin.
  for (let i = 0; i < 5; i++) {
    const seam = box(0.10, AFT_HALF_H * 2 - 0.4, 0.10, _hullDarkMat);
    seam.position.set(
      -AFT_HALF_W + (i + 1) * (AFT_HALF_W * 2 / 6),
      AFT_HALF_H,
      AFT_ORIGIN_Z + AFT_HALF_L + WALL_THICK + 0.05,
    );
    g.add(seam);
  }
  for (const y of [3.0, 11.0, 18.0]) {
    const seam = box(AFT_HALF_W * 2 - 0.4, 0.10, 0.10, _hullDarkMat);
    seam.position.set(0, y, AFT_ORIGIN_Z + AFT_HALF_L + WALL_THICK + 0.05);
    g.add(seam);
  }
  // Hull-plate seams on aft -X wall.
  for (let i = 0; i < 6; i++) {
    const seam = box(0.10, AFT_HALF_H * 2 - 0.4, 0.10, _hullDarkMat);
    seam.position.set(
      -AFT_HALF_W - WALL_THICK - 0.05,
      AFT_HALF_H,
      AFT_ORIGIN_Z - AFT_HALF_L + (i + 1) * (AFT_HALF_L * 2 / 7),
    );
    g.add(seam);
  }
  for (const y of [3.0, 11.0, 18.0]) {
    const seam = box(0.10, 0.10, AFT_HALF_L * 2 - 0.4, _hullDarkMat);
    seam.position.set(-AFT_HALF_W - WALL_THICK - 0.05, y, AFT_ORIGIN_Z);
    g.add(seam);
  }
  // Rust streaks scattered on aft + bow + tower walls.
  // AAO: 6cm thickness → 10cm (rule 7). Offsets bumped accordingly.
  for (let i = 0; i < 25; i++) {
    const side = _rand() < 0.5 ? -1 : 1;
    const surface = _rand();
    const streak = box(0.10, 0.8 + _rand() * 1.6, 0.12 + _rand() * 0.15, _rustMat);
    if (surface < 0.5) {
      // Aft side wall
      streak.position.set(
        side * (AFT_HALF_W + WALL_THICK + 0.06),
        AFT_HALF_H * 0.3 + _rand() * (AFT_HALF_H * 1.3),
        AFT_ORIGIN_Z - AFT_HALF_L + _rand() * AFT_HALF_L * 2,
      );
    } else if (surface < 0.8) {
      // Bow side wall
      streak.position.set(
        side * (BOW_HALF_W + WALL_THICK + 0.06),
        BOW_HALF_H * 0.4 + _rand() * (BOW_HALF_H * 1.3),
        BOW_ORIGIN_Z - BOW_HALF_L + _rand() * BOW_HALF_L * 2,
      );
      bowGroup.add(streak);   // attached so it picks up bow Y-offset
      continue;
    } else {
      // Tower wall
      streak.position.set(
        side * (TOWER_HALF_W + WALL_THICK + 0.06),
        TOWER_BASE_Y + _rand() * TOWER_HALF_H * 1.6,
        towerCenterZ_geom - TOWER_HALF_L + _rand() * TOWER_HALF_L * 2,
      );
    }
    g.add(streak);
  }
  // Rust patches on aft roof (between strips, on the solid parts).
  // AAO: 4cm patch → 10cm (rule 7).
  for (let i = 0; i < 6; i++) {
    const patch = box(0.6 + _rand() * 0.8, 0.10, 0.5 + _rand() * 0.7, _rustDarkMat);
    patch.position.set(
      (_rand() - 0.5) * (AFT_HALF_W * 1.4),
      AFT_HALF_H * 2 + ROOF_HALF_T * 2 + 0.06,
      AFT_ORIGIN_Z - AFT_HALF_L + _rand() * AFT_HALF_L * 2,
    );
    patch.rotation.y = _rand() * Math.PI;
    g.add(patch);
  }
  // Exterior pipes on aft +X wall (above + below the side-room doorway).
  for (const [y, length, zOff] of [
    [3.0, AFT_HALF_L * 1.8, 0],
    [12.0, AFT_HALF_L * 1.6, AFT_HALF_L * 0.2],
    [18.0, AFT_HALF_L * 1.4, -AFT_HALF_L * 0.3],
  ] as const) {
    const pipe = cyl(0.12, 0.12, length, _pipeMat, 8);
    pipe.rotation.x = Math.PI / 2;
    pipe.position.set(AFT_HALF_W + WALL_THICK + 0.15, y, AFT_ORIGIN_Z + zOff);
    g.add(pipe);
  }
  // Vents/bulges on aft walls — 6 vents distributed.
  const ventLocs: Array<[number, number, number]> = [
    [+1, 4, -6], [+1, 14, 12], [+1, 9, 30],
    [-1, 5, -3], [-1, 13, 18], [-1, 8, 35],
  ];
  for (const [side, y, z] of ventLocs) {
    const vent = box(0.5, 0.5, 0.8, _hullDarkMat);
    vent.position.set(side * (AFT_HALF_W + WALL_THICK + 0.25), y, AFT_ORIGIN_Z + z - AFT_ORIGIN_Z);
    // Adjust: vent Z should be in body frame
    vent.position.set(side * (AFT_HALF_W + WALL_THICK + 0.25), y, z);
    g.add(vent);
    const cap = cyl(0.18, 0.18, 0.10, _nozzleRimMat, 8);
    cap.rotation.z = Math.PI / 2;
    cap.position.set(side * (AFT_HALF_W + WALL_THICK + 0.55), y, z);
    g.add(cap);
  }
  // Broken antenna stubs on aft roof (visual masts, no spires).
  for (const [x, z, h] of [
    [-3, AFT_ORIGIN_Z - 12, 4.0],
    [4, AFT_ORIGIN_Z + 8, 2.5],
    [-1, AFT_ORIGIN_Z + 25, 3.2],
  ] as const) {
    const mast = cyl(0.08, 0.12, h, _antennaMat, 6);
    mast.position.set(x, AFT_HALF_H * 2 + ROOF_HALF_T * 2 + h / 2, z);
    mast.rotation.z = (_rand() - 0.5) * 0.2;
    g.add(mast);
  }

  // ────────────────────────────────────────────────────────────────────
  // INTERIOR DETAIL pass — main aft bay (pipes, conduits, consoles,
  // broken plates around openings).
  // ────────────────────────────────────────────────────────────────────
  // Ceiling pipes — 5 long cylinders running Z, hanging 0.5m below roof.
  const aftCeilingY = AFT_HALF_H * 2 - 0.5;
  for (const [xOff, length, zCenter] of [
    [-12, AFT_HALF_L * 1.8, 0],
    [-5, AFT_HALF_L * 1.5, 5],
    [0, AFT_HALF_L * 1.7, -3],
    [5, AFT_HALF_L * 1.4, 8],
    [12, AFT_HALF_L * 1.6, -2],
  ] as const) {
    const pipe = cyl(0.14, 0.14, length, _pipeMat, 8);
    pipe.rotation.x = Math.PI / 2;
    pipe.position.set(xOff, aftCeilingY, AFT_ORIGIN_Z + zCenter);
    g.add(pipe);
  }
  // Short dangling broken pipe stubs.
  for (let i = 0; i < 3; i++) {
    const dangler = cyl(0.10, 0.10, 1.2 + _rand() * 0.6, _pipeMat, 6);
    dangler.rotation.z = (_rand() - 0.5) * 1.0;
    dangler.position.set((_rand() - 0.5) * AFT_HALF_W * 1.5, AFT_HALF_H * 2 - 1.0, AFT_ORIGIN_Z + (_rand() - 0.5) * AFT_HALF_L * 1.4);
    g.add(dangler);
  }
  // Wall conduits along aft -X and +X walls at Y≈4 (above lower catwalk).
  const conduitY = 4.5;
  for (const side of [-1, 1] as const) {
    const zs = [-25, -10, 5, 20, 35, 47];
    for (let i = 0; i < zs.length - 1; i++) {
      const cz1 = zs[i], cz2 = zs[i + 1];
      const segLen = Math.abs(cz2 - cz1) - 0.2;
      if (segLen <= 0) continue;
      const conduit = cyl(0.06, 0.06, segLen, _antennaMat, 6);
      conduit.rotation.x = Math.PI / 2;
      conduit.position.set(side * (AFT_HALF_W - 0.1), conduitY, (cz1 + cz2) / 2);
      g.add(conduit);
    }
    for (const z of zs) {
      const junc = box(0.14, 0.14, 0.14, _hullDarkMat);
      junc.position.set(side * (AFT_HALF_W - 0.1), conduitY, z);
      g.add(junc);
    }
  }
  // Vertical drops from ceiling pipes to wall conduits at junctions.
  for (const [x, z] of [[-12, -25], [-12, 47], [12, -25], [12, 47]] as const) {
    const drop = cyl(0.05, 0.05, aftCeilingY - conduitY, _antennaMat, 5);
    drop.position.set(x * 0.95, (aftCeilingY + conduitY) / 2, z);
    g.add(drop);
  }
  // Broken consoles — 4 chest-high box clusters on the bay floor.
  for (const [x, z] of [[-6, -5], [3, 0], [-2, 12], [8, 30]] as const) {
    const cons = box(1.2, 1.0, 0.8, _hullDarkMat);
    cons.position.set(x, 0.5, z);
    g.add(cons);
    const top = box(1.1, 0.05, 0.7, _viewportMat);
    top.position.set(x, 1.03, z);
    g.add(top);
  }
  // Hull-plate fragments around aft front doorway.
  // AAO: 8cm fragments → 10cm (rule 7).
  for (let i = 0; i < 5; i++) {
    const w = 0.6 + _rand() * 0.8;
    const h = 0.4 + _rand() * 0.7;
    const frag = box(0.10, h, w, _rustDarkMat);
    frag.position.set(
      (_rand() - 0.5) * 6,
      6.5 + _rand() * 2.5,
      AFT_ORIGIN_Z - AFT_HALF_L - 0.5 + _rand() * 1.5,
    );
    frag.rotation.set((_rand() - 0.5) * 0.6, (_rand() - 0.5) * 0.4, (_rand() - 0.5) * 0.7);
    g.add(frag);
  }
  // Bow interior — minimal detail.
  {
    // 2 ceiling pipes
    for (const [xOff, length, zCenter] of [
      [-3, BOW_HALF_L * 1.6, 0],
      [3, BOW_HALF_L * 1.4, 2],
    ] as const) {
      const pipe = cyl(0.10, 0.10, length, _pipeMat, 6);
      pipe.rotation.x = Math.PI / 2;
      pipe.position.set(xOff, BOW_HALF_H * 2 - 0.4, BOW_ORIGIN_Z + zCenter);
      bowGroup.add(pipe);
    }
    // 1 wall conduit run on +X side
    const zs = [-BOW_HALF_L + 2, -3, 5, BOW_HALF_L - 2];
    for (let i = 0; i < zs.length - 1; i++) {
      const segLen = Math.abs(zs[i + 1] - zs[i]) - 0.2;
      const conduit = cyl(0.05, 0.05, segLen, _antennaMat, 6);
      conduit.rotation.x = Math.PI / 2;
      conduit.position.set(BOW_HALF_W - 0.1, 2.5, BOW_ORIGIN_Z + (zs[i] + zs[i + 1]) / 2);
      bowGroup.add(conduit);
    }
  }

  // ── Shadow flags.
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
 * Place the mega-wreck at a world position with yaw + tilt. Attaches all
 * cuboid colliders on a single fixed body (NO attachCompoundCollider),
 * registers a shelter zone covering the main aft bay, and registers 2
 * salvage panels (main aft bay + bow chamber).
 */
export function placeMegaWreck(
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
  const group = makeMegaWreck(rand);
  group.position.copy(pos);
  const yawQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
  const finalQ = new THREE.Quaternion().multiplyQuaternions(tilt, yawQ);
  group.quaternion.copy(finalQ);
  scene.add(group);

  // ── Bow Y-offset: at this scale (60m from wreck root) terrain at the
  // bow can sit several meters below pos.y (the mean of the footprint).
  // Anchor to terrain at the ENTRANCE position so the entrance hole is
  // always walkable — at the bow center terrain may be lower (sand
  // reclaims into the cavity, fine) but at the entrance terrain must be
  // at or below the entrance's body-Y=0 (floor level).
  const bowGroup = group.getObjectByName('bow') as THREE.Group;
  const sideGroup = group.getObjectByName('sideRoom') as THREE.Group;
  const bowEntranceLocal = new THREE.Vector3(-BOW_HALF_W - 2, 0, BOW_ORIGIN_Z);
  const bowEntranceWorld = bowEntranceLocal.clone().applyQuaternion(finalQ).add(pos);
  const bowEntranceTerrainY = _terrain.heightAt(bowEntranceWorld.x, bowEntranceWorld.z);
  const bowYOffset = bowEntranceTerrainY - bowEntranceWorld.y;
  if (bowGroup) bowGroup.position.y = bowYOffset;

  // ── Single fixed body for all colliders. No attachCompoundCollider —
  // hand-author every cuboid (~25 total).
  const bodyDesc = RAPIER.RigidBodyDesc.fixed()
    .setTranslation(pos.x, pos.y, pos.z)
    .setRotation({ x: finalQ.x, y: finalQ.y, z: finalQ.z, w: finalQ.w });
  const body = world.createRigidBody(bodyDesc);

  // ── BOW colliders. Every Y is +bowYOffset to track the bow sub-group.
  // Front wall (-Z tip).
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(BOW_HALF_W + WALL_THICK, BOW_WALL_TOTAL_H / 2, WALL_THICK / 2)
      .setTranslation(0, BOW_WALL_CENTER_Y + bowYOffset, BOW_ORIGIN_Z - BOW_HALF_L - WALL_THICK / 2),
    body,
  );
  // Right wall (+X) — split around the 2m × 2.5m ragged opening at body
  // Y center = BOW_OPENING_Y_CENTER (= 2.75), Z center = BOW_ORIGIN_Z.
  {
    const holeYBot = BOW_OPENING_Y_CENTER - BOW_OPENING_H / 2;   // 1.5
    const holeYTop = BOW_OPENING_Y_CENTER + BOW_OPENING_H / 2;   // 4
    // Below opening (full Z).
    {
      const belowH = holeYBot - (-WALL_BURY);
      world.createCollider(
        RAPIER.ColliderDesc.cuboid(WALL_THICK / 2, belowH / 2, BOW_HALF_L)
          .setTranslation(BOW_HALF_W + WALL_THICK / 2, -WALL_BURY + belowH / 2 + bowYOffset, BOW_ORIGIN_Z),
        body,
      );
    }
    // Above opening (full Z).
    {
      const aboveH = BOW_HALF_H * 2 - holeYTop;
      if (aboveH > 0) {
        world.createCollider(
          RAPIER.ColliderDesc.cuboid(WALL_THICK / 2, aboveH / 2, BOW_HALF_L)
            .setTranslation(BOW_HALF_W + WALL_THICK / 2, holeYTop + aboveH / 2 + bowYOffset, BOW_ORIGIN_Z),
          body,
        );
      }
    }
    // Front + back segments in opening Y-band.
    const sideLen = BOW_HALF_L - BOW_OPENING_W / 2;
    if (sideLen > 0) {
      world.createCollider(
        RAPIER.ColliderDesc.cuboid(WALL_THICK / 2, BOW_OPENING_H / 2, sideLen / 2)
          .setTranslation(BOW_HALF_W + WALL_THICK / 2, BOW_OPENING_Y_CENTER + bowYOffset, BOW_ORIGIN_Z - BOW_HALF_L + sideLen / 2),
        body,
      );
      world.createCollider(
        RAPIER.ColliderDesc.cuboid(WALL_THICK / 2, BOW_OPENING_H / 2, sideLen / 2)
          .setTranslation(BOW_HALF_W + WALL_THICK / 2, BOW_OPENING_Y_CENTER + bowYOffset, BOW_ORIGIN_Z + BOW_HALF_L - sideLen / 2),
        body,
      );
    }
  }
  // Left wall (-X) — split into 4 colliders around the entrance.
  {
    // Buried strip (below entrance).
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(WALL_THICK / 2, WALL_BURY / 2, BOW_HALF_L)
        .setTranslation(-BOW_HALF_W - WALL_THICK / 2, -WALL_BURY / 2 + bowYOffset, BOW_ORIGIN_Z),
      body,
    );
    // Lintel (above entrance).
    const lintelH = BOW_HALF_H * 2 - BOW_ENTRANCE_H;
    if (lintelH > 0) {
      world.createCollider(
        RAPIER.ColliderDesc.cuboid(WALL_THICK / 2, lintelH / 2, BOW_HALF_L)
          .setTranslation(-BOW_HALF_W - WALL_THICK / 2, BOW_ENTRANCE_H + lintelH / 2 + bowYOffset, BOW_ORIGIN_Z),
        body,
      );
    }
    // Front + back segments in entrance Y-band.
    const sideLen = BOW_HALF_L - BOW_ENTRANCE_W / 2;
    if (sideLen > 0) {
      world.createCollider(
        RAPIER.ColliderDesc.cuboid(WALL_THICK / 2, BOW_ENTRANCE_H / 2, sideLen / 2)
          .setTranslation(-BOW_HALF_W - WALL_THICK / 2, BOW_ENTRANCE_H / 2 + bowYOffset, BOW_ORIGIN_Z - BOW_HALF_L + sideLen / 2),
        body,
      );
      world.createCollider(
        RAPIER.ColliderDesc.cuboid(WALL_THICK / 2, BOW_ENTRANCE_H / 2, sideLen / 2)
          .setTranslation(-BOW_HALF_W - WALL_THICK / 2, BOW_ENTRANCE_H / 2 + bowYOffset, BOW_ORIGIN_Z + BOW_HALF_L - sideLen / 2),
        body,
      );
    }
  }
  // Bow back wall: SKIPPED — open to mid-break.
  // Bow roof.
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(BOW_HALF_W + WALL_THICK, ROOF_HALF_T, BOW_HALF_L + WALL_THICK)
      .setTranslation(0, BOW_HALF_H * 2 + ROOF_HALF_T + bowYOffset, BOW_ORIGIN_Z),
    body,
  );

  // ── AFT colliders.
  // Front wall (-Z) — split around doorway.
  {
    // Buried strip.
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(AFT_HALF_W + WALL_THICK, WALL_BURY / 2, WALL_THICK / 2)
        .setTranslation(0, -WALL_BURY / 2, AFT_ORIGIN_Z - AFT_HALF_L - WALL_THICK / 2),
      body,
    );
    // Lintel.
    const lintelH = AFT_HALF_H * 2 - AFT_DOOR_H;
    if (lintelH > 0) {
      world.createCollider(
        RAPIER.ColliderDesc.cuboid(AFT_HALF_W + WALL_THICK, lintelH / 2, WALL_THICK / 2)
          .setTranslation(0, AFT_DOOR_H + lintelH / 2, AFT_ORIGIN_Z - AFT_HALF_L - WALL_THICK / 2),
        body,
      );
    }
    // Left + right segments in doorway Y-band.
    const sideLen = AFT_HALF_W - AFT_DOOR_W / 2;
    if (sideLen > 0) {
      world.createCollider(
        RAPIER.ColliderDesc.cuboid(sideLen / 2, AFT_DOOR_H / 2, WALL_THICK / 2)
          .setTranslation(-AFT_HALF_W + sideLen / 2, AFT_DOOR_H / 2, AFT_ORIGIN_Z - AFT_HALF_L - WALL_THICK / 2),
        body,
      );
      world.createCollider(
        RAPIER.ColliderDesc.cuboid(sideLen / 2, AFT_DOOR_H / 2, WALL_THICK / 2)
          .setTranslation(AFT_HALF_W - sideLen / 2, AFT_DOOR_H / 2, AFT_ORIGIN_Z - AFT_HALF_L - WALL_THICK / 2),
        body,
      );
    }
  }
  // Back wall (+Z, solid).
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(AFT_HALF_W + WALL_THICK, AFT_WALL_TOTAL_H / 2, WALL_THICK / 2)
      .setTranslation(0, AFT_WALL_CENTER_Y, AFT_ORIGIN_Z + AFT_HALF_L + WALL_THICK / 2),
    body,
  );
  // Left wall (-X, solid).
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(WALL_THICK / 2, AFT_WALL_TOTAL_H / 2, AFT_HALF_L)
      .setTranslation(-AFT_HALF_W - WALL_THICK / 2, AFT_WALL_CENTER_Y, AFT_ORIGIN_Z),
    body,
  );
  // Right wall (+X) — split around side-room doorway at body Z = 5,
  // Y range [0, SIDE_DOOR_H].
  {
    // Buried strip below door (full Z, Y=-WALL_BURY..0).
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(WALL_THICK / 2, WALL_BURY / 2, AFT_HALF_L)
        .setTranslation(AFT_HALF_W + WALL_THICK / 2, -WALL_BURY / 2, AFT_ORIGIN_Z),
      body,
    );
    // Lintel above door (full Z).
    const lintelH = AFT_HALF_H * 2 - SIDE_DOOR_H;
    if (lintelH > 0) {
      world.createCollider(
        RAPIER.ColliderDesc.cuboid(WALL_THICK / 2, lintelH / 2, AFT_HALF_L)
          .setTranslation(AFT_HALF_W + WALL_THICK / 2, SIDE_DOOR_H + lintelH / 2, AFT_ORIGIN_Z),
        body,
      );
    }
    // Front + back segments in door Y-band. Door at body Z = SIDE_ORIGIN_Z.
    // Front segment: from wall front (AFT_ORIGIN_Z - AFT_HALF_L) to door front (SIDE_ORIGIN_Z - SIDE_DOOR_W/2).
    const wallZ0 = AFT_ORIGIN_Z - AFT_HALF_L;
    const wallZ1 = AFT_ORIGIN_Z + AFT_HALF_L;
    const doorZ0 = SIDE_ORIGIN_Z - SIDE_DOOR_W / 2;
    const doorZ1 = SIDE_ORIGIN_Z + SIDE_DOOR_W / 2;
    const frontLen = doorZ0 - wallZ0;
    const backLen = wallZ1 - doorZ1;
    if (frontLen > 0) {
      world.createCollider(
        RAPIER.ColliderDesc.cuboid(WALL_THICK / 2, SIDE_DOOR_H / 2, frontLen / 2)
          .setTranslation(AFT_HALF_W + WALL_THICK / 2, SIDE_DOOR_H / 2, wallZ0 + frontLen / 2),
        body,
      );
    }
    if (backLen > 0) {
      world.createCollider(
        RAPIER.ColliderDesc.cuboid(WALL_THICK / 2, SIDE_DOOR_H / 2, backLen / 2)
          .setTranslation(AFT_HALF_W + WALL_THICK / 2, SIDE_DOOR_H / 2, wallZ1 - backLen / 2),
        body,
      );
    }
  }
  // Roof — 3 strip-panels each with a skylight hole. For each strip,
  // emit up to 4 cuboid colliders wrapping the hole (front + back of
  // hole in Z, left + right of hole in X within the hole Z band).
  for (const strip of ROOF_STRIPS) {
    const stripCenterZ = (strip.z0 + strip.z1) / 2;
    const holeZCenter = stripCenterZ + strip.holeCv;
    const holeZ0 = holeZCenter - SKYLIGHT_HD / 2;
    const holeZ1 = holeZCenter + SKYLIGHT_HD / 2;
    const stripZ0 = strip.z0;
    const stripZ1 = strip.z1;
    // Roof full width (X) = AFT_HALF_W * 2 + WALL_THICK * 2. Hole hw = SKYLIGHT_HW centered cu=0.
    const fullHalfW = AFT_HALF_W + WALL_THICK;
    const holeHalfW = SKYLIGHT_HW / 2;
    const roofY = AFT_HALF_H * 2 + ROOF_HALF_T;

    // Front of hole (Z direction, full width).
    const frontLen = holeZ0 - stripZ0;
    if (frontLen > 0) {
      world.createCollider(
        RAPIER.ColliderDesc.cuboid(fullHalfW, ROOF_HALF_T, frontLen / 2)
          .setTranslation(0, roofY, stripZ0 + frontLen / 2),
        body,
      );
    }
    // Back of hole (Z direction, full width).
    const backLen = stripZ1 - holeZ1;
    if (backLen > 0) {
      world.createCollider(
        RAPIER.ColliderDesc.cuboid(fullHalfW, ROOF_HALF_T, backLen / 2)
          .setTranslation(0, roofY, stripZ1 - backLen / 2),
        body,
      );
    }
    // Left of hole in hole Z band.
    const leftLen = fullHalfW - holeHalfW;
    if (leftLen > 0) {
      world.createCollider(
        RAPIER.ColliderDesc.cuboid(leftLen / 2, ROOF_HALF_T, SKYLIGHT_HD / 2)
          .setTranslation(-fullHalfW + leftLen / 2, roofY, holeZCenter),
        body,
      );
      // Right (symmetric).
      world.createCollider(
        RAPIER.ColliderDesc.cuboid(leftLen / 2, ROOF_HALF_T, SKYLIGHT_HD / 2)
          .setTranslation(fullHalfW - leftLen / 2, roofY, holeZCenter),
        body,
      );
    }
  }

  // ── BRIDGE TOWER colliders (4 walls + roof).
  const towerCenterZ = AFT_ORIGIN_Z + TOWER_OFFSET_Z;
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(TOWER_HALF_W + WALL_THICK, TOWER_HALF_H, WALL_THICK / 2)
      .setTranslation(0, TOWER_BASE_Y + TOWER_HALF_H, towerCenterZ - TOWER_HALF_L - WALL_THICK / 2),
    body,
  );
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(TOWER_HALF_W + WALL_THICK, TOWER_HALF_H, WALL_THICK / 2)
      .setTranslation(0, TOWER_BASE_Y + TOWER_HALF_H, towerCenterZ + TOWER_HALF_L + WALL_THICK / 2),
    body,
  );
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(WALL_THICK / 2, TOWER_HALF_H, TOWER_HALF_L)
      .setTranslation(-TOWER_HALF_W - WALL_THICK / 2, TOWER_BASE_Y + TOWER_HALF_H, towerCenterZ),
    body,
  );
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(WALL_THICK / 2, TOWER_HALF_H, TOWER_HALF_L)
      .setTranslation(TOWER_HALF_W + WALL_THICK / 2, TOWER_BASE_Y + TOWER_HALF_H, towerCenterZ),
    body,
  );
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(TOWER_HALF_W + WALL_THICK, ROOF_HALF_T, TOWER_HALF_L + WALL_THICK)
      .setTranslation(0, TOWER_BASE_Y + TOWER_HALF_H * 2 + ROOF_HALF_T, towerCenterZ),
    body,
  );

  // ── SIDE ROOM colliders (3 walls + roof — the -X wall is the aft's
  // +X wall which already has its 4-piece split-around-doorway pattern).
  // +X far wall (solid).
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(WALL_THICK / 2, SIDE_WALL_TOTAL_H / 2, SIDE_HALF_L)
      .setTranslation(SIDE_ORIGIN_X + SIDE_HALF_W + WALL_THICK / 2, SIDE_WALL_CENTER_Y, SIDE_ORIGIN_Z),
    body,
  );
  // -Z wall.
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(SIDE_HALF_W + WALL_THICK, SIDE_WALL_TOTAL_H / 2, WALL_THICK / 2)
      .setTranslation(SIDE_ORIGIN_X, SIDE_WALL_CENTER_Y, SIDE_ORIGIN_Z - SIDE_HALF_L - WALL_THICK / 2),
    body,
  );
  // +Z wall.
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(SIDE_HALF_W + WALL_THICK, SIDE_WALL_TOTAL_H / 2, WALL_THICK / 2)
      .setTranslation(SIDE_ORIGIN_X, SIDE_WALL_CENTER_Y, SIDE_ORIGIN_Z + SIDE_HALF_L + WALL_THICK / 2),
    body,
  );
  // Roof (solid).
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(SIDE_HALF_W + WALL_THICK, ROOF_HALF_T, SIDE_HALF_L + WALL_THICK)
      .setTranslation(SIDE_ORIGIN_X, SIDE_HALF_H * 2 + ROOF_HALF_T, SIDE_ORIGIN_Z),
    body,
  );

  // ── CATWALK colliders (3).
  // Lower.
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(CATWALK_LOW_W / 2, CATWALK_T / 2, CATWALK_LOW_L / 2)
      .setTranslation(-AFT_HALF_W + CATWALK_LOW_W / 2 + 0.1, CATWALK_LOW_Y, AFT_ORIGIN_Z),
    body,
  );
  // Upper.
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(CATWALK_UP_W / 2, CATWALK_T / 2, CATWALK_UP_L / 2)
      .setTranslation(0, CATWALK_UP_Y, AFT_ORIGIN_Z),
    body,
  );
  // Stub.
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(CATWALK_STUB_W / 2, CATWALK_T / 2, CATWALK_STUB_L / 2)
      .setTranslation(0, CATWALK_STUB_Y, AFT_ORIGIN_Z + AFT_HALF_L - CATWALK_STUB_L / 2 - 0.3),
    body,
  );

  // ── RAMP colliders (tilted via Rapier setRotation).
  // Ramp 1: bay floor → lower catwalk, 30° around X.
  {
    const rampQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 6);
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(CATWALK_LOW_W / 2, 0.1, 3.0)
        .setTranslation(-AFT_HALF_W + CATWALK_LOW_W / 2 + 0.1, 1.5, AFT_ORIGIN_Z - AFT_HALF_L * 0.7)
        .setRotation({ x: rampQ.x, y: rampQ.y, z: rampQ.z, w: rampQ.w }),
      body,
    );
  }
  // Ramp 2: lower → upper, 25° around X.
  {
    const rampQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 7.2);
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(0.9, 0.1, 5.0)
        .setTranslation(AFT_HALF_W - 5, 5.0, AFT_ORIGIN_Z)
        .setRotation({ x: rampQ.x, y: rampQ.y, z: rampQ.z, w: rampQ.w }),
      body,
    );
  }
  // Ramp 3: stack-of-3 debris steps from upper to stub.
  for (let i = 0; i < 3; i++) {
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(1.0, 0.7, 0.7)
        .setTranslation(0, CATWALK_UP_Y + 0.7 + i * 1.4, AFT_ORIGIN_Z + AFT_HALF_L - 8 + i * 1.4),
      body,
    );
  }

  // ── TOWER CLIMB colliders.
  // Tilted ramp from aft roof to tower-front mid-height.
  {
    const rampQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -TOWER_RAMP_PITCH);
    const cz = towerCenterZ + TOWER_OFFSET_Z * 0;   // recompute below from constant
    void cz;
    const rampZCenter = (AFT_ORIGIN_Z + TOWER_OFFSET_Z) - TOWER_HALF_L - 2.0;
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(TOWER_RAMP_W / 2, TOWER_RAMP_T / 2, TOWER_RAMP_L / 2)
        .setTranslation(0, 25, rampZCenter)
        .setRotation({ x: rampQ.x, y: rampQ.y, z: rampQ.z, w: rampQ.w }),
      body,
    );
  }
  // 3 stack steps on tower-front face.
  for (let i = 0; i < 3; i++) {
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(TOWER_STEP_W / 2, TOWER_STEP_T / 2, TOWER_STEP_L / 2)
        .setTranslation(
          0,
          28 + (i + 1) * 2,
          (AFT_ORIGIN_Z + TOWER_OFFSET_Z) - TOWER_HALF_L - 0.2 - i * 0.5,
        ),
      body,
    );
  }

  // CC-3.2 — engine bell colliders (2 hero bells at the rear of aft).
  // Cylinder axis along +Z so the mouth faces back. The bell mesh is
  // positioned at body-local (±BELL_OFFSET_X, bellCenterY, bellCenterZ
  // - BELL_DEPTH/2) and extends from there +BELL_DEPTH along Z.
  const _bellRotMw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
  const _bellRotMwObj = { x: _bellRotMw.x, y: _bellRotMw.y, z: _bellRotMw.z, w: _bellRotMw.w };
  const BELL_DEPTH_MW = BELL_R * 1.1;
  const bellCenterY_col = AFT_HALF_H * 0.7;
  const bellCenterZ_col = AFT_ORIGIN_Z + AFT_HALF_L + WALL_THICK + BELL_OFFSET_Z;
  for (const side of [-1, 1] as const) {
    world.createCollider(
      RAPIER.ColliderDesc.cylinder(BELL_DEPTH_MW / 2, BELL_R)
        .setTranslation(side * BELL_OFFSET_X, bellCenterY_col, bellCenterZ_col)
        .setRotation(_bellRotMwObj),
      body,
    );
  }

  // ── Shelter zone covering main aft bay only. AABB sized by diagonal so
  // the axis-aligned zone covers the rotated + tilted cavity (megaShip
  // trick — windless edges may over-cover slightly, acceptable).
  const aftLocal = new THREE.Vector3(0, AFT_HALF_H, AFT_ORIGIN_Z);
  const aftWorld = aftLocal.clone().applyQuaternion(finalQ).add(pos);
  const shelterHalf = Math.sqrt(AFT_HALF_W * AFT_HALF_W + AFT_HALF_L * AFT_HALF_L);
  addShelterZone(
    shelter,
    { x: aftWorld.x, y: aftWorld.y, z: aftWorld.z },
    { x: shelterHalf, y: AFT_HALF_H + 0.5, z: shelterHalf },
  );

  // ── Salvage panels — each in its own sub-group so they strip
  // independently (registerSalvageable reads userData.accessPanel).
  const worldPos = (local: THREE.Vector3): THREE.Vector3 =>
    local.clone().applyQuaternion(finalQ).add(pos);

  // 1. Main aft bay — back interior wall, lower-left.
  const aftPanel = new THREE.Group();
  aftPanel.position.set(-AFT_HALF_W * 0.5, 1.0, AFT_ORIGIN_Z + AFT_HALF_L - WALL_THICK - 0.05);
  aftPanel.rotation.y = Math.PI;       // face -Z, into the bay
  group.add(aftPanel);
  addAccessPanel(aftPanel, 0, 0, 0, 1, 0);
  registerSalvageable(salvageables, aftPanel, 'massive', worldPos(aftPanel.position), rand);

  // 2. Bow chamber — front interior wall (-Z tip), facing into chamber.
  // Attached to bowGroup so the bowYOffset applies; world position is
  // computed via the parent chain (group → bowGroup → bowPanel).
  const bowPanel = new THREE.Group();
  bowPanel.position.set(0.5, 1.0, BOW_ORIGIN_Z - BOW_HALF_L + WALL_THICK + 0.05);
  if (bowGroup) bowGroup.add(bowPanel); else group.add(bowPanel);
  addAccessPanel(bowPanel, 0, 0, 0, 1, 0);
  bowPanel.updateWorldMatrix(true, false);
  const bowPanelWorld = new THREE.Vector3().setFromMatrixPosition(bowPanel.matrixWorld);
  registerSalvageable(salvageables, bowPanel, 'massive', bowPanelWorld, rand);

  // Helper: register a salvage panel whose true world position depends on
  // nested-group transforms (catwalk-mounted, side-room, engine bell,
  // antenna spire). Pattern: build sub-group at body-local pos, attach to
  // parent group, updateWorldMatrix, then registerSalvageable with the
  // matrix-derived world position.
  const registerNested = (
    panelGroup: THREE.Group, parent: THREE.Object3D, kind: 'massive' | 'engine_bell',
  ) => {
    parent.add(panelGroup);
    addAccessPanel(panelGroup, 0, 0, 0, 1, 0);
    panelGroup.updateWorldMatrix(true, false);
    const wp = new THREE.Vector3().setFromMatrixPosition(panelGroup.matrixWorld);
    registerSalvageable(salvageables, panelGroup, kind, wp, rand);
  };

  // 3. Upper catwalk dead-end (massive) — far end of upper catwalk.
  {
    const p = new THREE.Group();
    p.position.set(AFT_HALF_W - 2, CATWALK_UP_Y + 0.5, AFT_ORIGIN_Z + 0.2);
    p.rotation.y = -Math.PI / 2;       // face -X
    registerNested(p, group, 'massive');
  }
  // 4. Bridge-overlook stub (best position).
  {
    const p = new THREE.Group();
    p.position.set(0, CATWALK_STUB_Y + 0.5, AFT_ORIGIN_Z + AFT_HALF_L - CATWALK_STUB_L - 0.3);
    p.rotation.y = 0;                  // face +Z (toward back wall = away from bay)
    registerNested(p, group, 'massive');
  }
  // 5. Side room (Chamber 3) back wall, lower.
  {
    const p = new THREE.Group();
    p.position.set(SIDE_ORIGIN_X, 1.0, SIDE_ORIGIN_Z + SIDE_HALF_L - WALL_THICK - 0.05);
    p.rotation.y = Math.PI;            // face -Z into the side room
    registerNested(p, sideGroup, 'massive');
  }
  // 6. Engine bell A — exterior, on the +X bell's mounting frame.
  {
    const p = new THREE.Group();
    const bellCenterY = AFT_HALF_H * 0.7;
    const bellCenterZ = AFT_ORIGIN_Z + AFT_HALF_L + WALL_THICK + BELL_OFFSET_Z;
    p.position.set(BELL_OFFSET_X + BELL_R * 0.7, bellCenterY, bellCenterZ - 1.5);
    p.rotation.y = -Math.PI / 2;       // face -X (toward viewer between bells)
    registerNested(p, group, 'engine_bell');
  }
  // 7. Engine bell B — exterior, on the -X bell.
  {
    const p = new THREE.Group();
    const bellCenterY = AFT_HALF_H * 0.7;
    const bellCenterZ = AFT_ORIGIN_Z + AFT_HALF_L + WALL_THICK + BELL_OFFSET_Z;
    p.position.set(-BELL_OFFSET_X - BELL_R * 0.7, bellCenterY, bellCenterZ - 1.5);
    p.rotation.y = Math.PI / 2;        // face +X
    registerNested(p, group, 'engine_bell');
  }
  // 8. Antenna spire atop bridge tower — exterior, climb to reach.
  {
    // Visual antenna spire on the tower roof for the salvage to attach to.
    const spireBase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.25, 2.5, 8),
      _antennaMat,
    );
    const towerCenterZ_geom = AFT_ORIGIN_Z + TOWER_OFFSET_Z;
    spireBase.position.set(0, TOWER_BASE_Y + TOWER_HALF_H * 2 + ROOF_HALF_T * 2 + 1.25, towerCenterZ_geom);
    group.add(spireBase);
    const spireTip = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.12, 1.8, 6),
      _antennaMat,
    );
    spireTip.position.set(0, TOWER_BASE_Y + TOWER_HALF_H * 2 + ROOF_HALF_T * 2 + 2.5 + 0.9, towerCenterZ_geom);
    group.add(spireTip);
    // Salvage panel at the base of the spire on the tower roof.
    const p = new THREE.Group();
    p.position.set(0.6, TOWER_BASE_Y + TOWER_HALF_H * 2 + ROOF_HALF_T * 2 + 0.4, towerCenterZ_geom);
    p.rotation.y = -Math.PI / 2;
    // KK — was 'antenna_spire' (now retired). The structure stays
    // (it's a mega-wreck spire silhouette, not a satellite dish), but
    // the salvage panel uses 'massive' to roll the mega-wreck loot
    // table — consistent with the wreck's other panels.
    registerNested(p, group, 'massive');
  }

  // ── Surrounding debris field — 40 small pieces in a 50m radius.
  placeDebrisField(scene, _terrain, pos, 50, rand, 40);

  return group;
}
