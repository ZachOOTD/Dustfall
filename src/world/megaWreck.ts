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
import { makeLoftedHull, makeFormerRings, makeBreach, tagWreckDecoration, makeCable, makeSandMound } from './wreckForms.ts';
import { addShelterZone, type ShelterRegistry } from '../shelter/shelterZones.ts';
import { registerSalvageable, type SalvageableRegistry } from './salvage.ts';
import { placeJournal, type Journal } from './journal.ts';
// ABL — visual rebuild: apply ABH procedural shaders + tapered hull shell.
import { createMetalMaterial } from './metalMaterial.ts';
import { createPaintedMetalMaterial } from './paintMaterial.ts';
import { createRustedHullMaterial } from './hullMaterial.ts';

// ── Shared materials.
// ABL — visual rebuild: BB-2/BB-3 era flat-Lambert hulls upgraded to
// the ABH procedural shader vocabulary (metalMaterial + paintMaterial
// + hullMaterial). Same color palette per Tuning.WRECK_* hexes so
// gameplay clarity / faction-color reads stay identical; the lift is
// surface detail (scratches, worn highlights, paint chips, rust drips
// via the shader's onBeforeCompile patches).
const _hullMat = createRustedHullMaterial({
  baseColor: Tuning.WRECK_HULL_HEX,
  streakIntensity: 0.55,
});
const _hullDarkMat = createRustedHullMaterial({
  baseColor: Tuning.WRECK_HULL_DARK_HEX,
  streakIntensity: 0.40,
});
const _rustMat = createPaintedMetalMaterial(Tuning.WRECK_RUST_HEX, {
  wearLevel: 0.65,
});
const _rustDarkMat = createMetalMaterial(Tuning.WRECK_RUST_DARK_HEX, {
  wornScale: 5.0,
  scratchStrength: 0.06,
});
const _nozzleInteriorMat = new THREE.MeshBasicMaterial({
  color: Tuning.WRECK_NOZZLE_INTERIOR_HEX,
});
const _nozzleRimMat = createMetalMaterial(Tuning.WRECK_NOZZLE_RIM_HEX, {
  wornScale: 4.0,
  scratchStrength: 0.05,
});
const _antennaMat = createMetalMaterial(Tuning.WRECK_ANTENNA_HEX, {
  wornScale: 6.0,
  scratchStrength: 0.04,
});
const _pipeMat = createMetalMaterial(0x3a3028, {
  wornScale: 5.0,
  scratchStrength: 0.04,
});
const _viewportMat = new THREE.MeshBasicMaterial({ color: 0x14181c });

// (ACAJ T2 — the ABL rust-band `_bandMat` was retired with the band wraps;
// the new toolkit hull carries its own rust-streak material.)

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
  const bellCenterY = AFT_HALF_H * 1.15;   // ACAJ — raised onto the hull centerline (was 0.7 → read as low wheels)
  const bellCenterZ = AFT_ORIGIN_Z + AFT_HALF_L + WALL_THICK + BELL_OFFSET_Z;
  const BELL_DEPTH = BELL_R * 1.1;
  for (const side of [-1, 1] as const) {
    const x = side * BELL_OFFSET_X;
    // (ACAJ — the flat billboard mounting frame was removed; the A6 exposed cage
    // ring + struts in the shell is the mount now.)
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

  // ════════════════════════════════════════════════════════════════════
  // ACAJ T2 (ground-up rebuild vs docs/research/megawreck-anatomy.md + the
  // adversarial critique). A BROKEN downed warship: a listing tapered dagger,
  // spine snapped at the mid-hull with a readable cut-open cross-section
  // (countable decks + ribs + spine stub + cables), a detailed command island
  // (windows + sensor mast + dishes), exposed engine cage, asymmetric breaches.
  // ALL of it lives in `shell` — a group TILTED into a list + sunk into the dune,
  // leaving the level interior box cavity + colliders untouched (D185). The shell
  // ENVELOPS the boxes generously so no cuboid corner pokes through even tilted.
  // Sand drifts + the debris field are added terrain-aware in placeMegaWreck.
  // ════════════════════════════════════════════════════════════════════
  const FRACTURE_Z1 = AFT_ORIGIN_Z - AFT_HALF_L;   // -10 — aft front (torn) face
  const FRACTURE_Z0 = BOW_ORIGIN_Z + BOW_HALF_L;   // -25 — bow rear (torn) face
  const dark = _hullDarkMat;
  const shell = new THREE.Group();
  shell.name = 'shell';
  const add = (m: THREE.Object3D) => { m.userData.noCollider = true; shell.add(m); };
  const AFT_CY = AFT_HALF_H + 2.0;

  // (A1) Aft hull — a faceted DAGGER mass: belly+dorsal peak amidships, a RAKED
  // roofline dropping toward both ends, a generous envelope (×1.4 — must contain
  // the tilted level box corners), a blunt LOW transom.
  {
    const W = AFT_HALF_W, H = AFT_HALF_H;
    add(makeLoftedHull([
      { z: FRACTURE_Z1, halfW: W * 1.34, halfH: H * 1.20, cy: AFT_CY },         // fracture (tall)
      { z: 6,  halfW: W * 1.42, halfH: H * 1.24, cy: AFT_CY + 0.5 },            // belly + dorsal peak
      { z: 24, halfW: W * 1.38, halfH: H * 1.16, cy: AFT_CY - 0.5 },
      { z: 40, halfW: W * 1.20, halfH: H * 1.00, cy: AFT_CY - 2.5 },            // taper + roof drop
      { z: 50, halfW: W * 1.00, halfH: H * 0.82, cy: AFT_CY - 4.5 },            // blunt low transom
    ], _hullMat));
  }

  // (A2) Bow — a dagger nose DROPPING + tapering to a buried crushed point, rising
  // toward the fracture (so the whole ship reads as a wedge driven nose-first into
  // the dune, the aft mass riding higher).
  {
    const W = BOW_HALF_W, H = BOW_HALF_H, z0 = BOW_ORIGIN_Z - BOW_HALF_L;       // -60
    add(makeLoftedHull([
      { z: z0,          halfW: W * 0.18, halfH: H * 0.42, cy: BOW_HALF_H - 3.0 },  // crushed buried tip (low)
      { z: z0 + 8,      halfW: W * 0.70, halfH: H * 0.95, cy: BOW_HALF_H - 1.0 },
      { z: z0 + 20,     halfW: W * 1.30, halfH: H * 1.22, cy: BOW_HALF_H + 1.0 },
      { z: FRACTURE_Z0, halfW: W * 1.32, halfH: H * 1.24, cy: BOW_HALF_H + 1.5 },  // fracture (rising)
    ], _hullMat));
  }

  // (A3) Mid-hull FRACTURE cross-section — THE hero (the spec "money shot"). The
  // gap is filled with a cut-open cross-section: full-width recessed deck slabs
  // (staggered Y between faces → countable decks), former rings, a kinked spine
  // stub, and dangling cables. A dark interior backboard makes the depth read.
  {
    const R = AFT_HALF_W * 1.18, cy = AFT_CY;
    // Dark interior backboards (so the cross-section reads as depth, not a gap to sky).
    for (const z of [FRACTURE_Z1 + 0.2, FRACTURE_Z0 - 0.2]) {
      const back = box(R * 1.7, AFT_HALF_H * 2.2, 0.4, _viewportMat);
      back.position.set(0, cy - 1, z); add(back);
    }
    // Former rings on each torn face.
    const af = makeFormerRings(R, 3, 1.4, { tube: 0.55 });
    af.rotation.y = -Math.PI / 2; af.position.set(0, cy, FRACTURE_Z1 + 0.4); af.scale.set(1, 0.78, 1); add(af);
    const bf = makeFormerRings(R * 0.95, 3, 1.4, { tube: 0.55 });
    bf.rotation.y = -Math.PI / 2; bf.position.set(0, cy, FRACTURE_Z0 - 3.2); bf.scale.set(1, 0.78, 1); add(bf);
    // Deck-edge ledges — full-width thin slabs, recessed, staggered Y between faces.
    const deckW = AFT_HALF_W * 1.05;
    const mkDeck = (y: number, z: number, w: number) => {
      const slab = box(w * 2, 0.3, 3.4, dark); slab.position.set(0, y, z); add(slab);
    };
    for (const y of [3.0, 6.5, 10.0, 13.5]) mkDeck(y, FRACTURE_Z1 + 1.9, deckW);          // aft decks
    for (const y of [4.6, 8.2, 11.6]) mkDeck(y, FRACTURE_Z0 - 1.9, deckW * 0.9);          // bow decks (offset Y)
    // Snapped spine/keel stub — a bent two-segment beam low-center ("broke its back").
    const seg1 = box(1.4, 1.2, 10, dark);
    seg1.position.set(-2.0, 1.8, (FRACTURE_Z0 + FRACTURE_Z1) / 2 - 2.5); seg1.rotation.y = 0.14; add(seg1);
    const seg2 = box(1.2, 1.1, 7, dark);
    seg2.position.set(1.6, 2.8, (FRACTURE_Z0 + FRACTURE_Z1) / 2 + 3); seg2.rotation.set(0.12, -0.22, 0.07); add(seg2);
    // Dangling cables from upper deck-edges to the floor.
    for (const [x, z, y] of [[-7, FRACTURE_Z1 + 1.6, 13], [6, FRACTURE_Z0 - 1, 11], [-2, -17.5, 12], [10, FRACTURE_Z1 + 1, 9]] as const) {
      add(makeCable(new THREE.Vector3(x, y, z), new THREE.Vector3(x + 3, 0.4, z - 2), 3.2, _pipeMat, 0.1));
    }
    // Bent torn rim flaps on the aft face.
    const rim = makeBreach(R * 0.9, _rand); tagWreckDecoration(rim);
    rim.rotation.x = -Math.PI / 2; rim.position.set(0, cy + AFT_HALF_H * 0.5, FRACTURE_Z1 + 0.5); rim.scale.set(1.6, 1.0, 0.6); add(rim);
  }

  // (A4) Command island — a stepped 5-deck wedding-cake bridge, OFFSET toward the
  // +X impact flank + exaggerated, with framed viewport clusters + a raked
  // windscreen. The recognition anchor that must dominate the skyline.
  let bridgeTopY = TOWER_BASE_Y;
  let bridgeCx = TOWER_HALF_W * 0.6;            // offset off-centre toward +X
  {
    const cz = AFT_ORIGIN_Z + TOWER_OFFSET_Z, baseY = TOWER_BASE_Y, cx = bridgeCx;
    const baseW = TOWER_HALF_W * 1.55, baseL = TOWER_HALF_L * 1.7;
    const decks = 5, dh = 2.8;
    let y = baseY;
    for (let i = 0; i < decks; i++) {
      const t = i / decks;
      const w = baseW * (1 - t * 0.5), l = baseL * (1 - t * 0.32);
      const deck = box(w * 2, dh, l * 2, _hullMat);
      deck.position.set(cx, y + dh / 2, cz + t * 1.5); add(deck);
      const winN = 6, zf = cz + t * 1.5 - l;
      for (let k = 0; k < winN; k++) {
        const wx = cx + (k - (winN - 1) / 2) * (w * 1.6 / winN);
        const frame = box(0.95, 1.15, 0.16, dark); frame.position.set(wx, y + dh * 0.55, zf - 0.08); add(frame);
        const win = box(0.74, 0.94, 0.36, _viewportMat); win.position.set(wx, y + dh * 0.55, zf - 0.18); win.userData.noShadow = true; add(win);
      }
      y += dh;
    }
    const screen = box(baseW * 1.9, 3.0, 0.45, _viewportMat);
    screen.position.set(cx, baseY + 1.8, cz - baseL - 0.5); screen.rotation.x = -0.42; screen.userData.noShadow = true; add(screen);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(baseW * 0.3, baseW * 0.66, 1.9, 6), _hullMat);
    cap.rotation.y = Math.PI / 6; cap.position.set(cx, y + 0.95, cz); add(cap);
    bridgeTopY = y + 1.9;
  }

  // (A5) Sensor mast + dish array on the bridge crown — leaned (bent on impact).
  {
    const cz = AFT_ORIGIN_Z + TOWER_OFFSET_Z, cx = bridgeCx;
    const mast = cyl(0.15, 0.4, 12, dark, 7);
    mast.position.set(cx, bridgeTopY + 6, cz); mast.rotation.z = 0.09; mast.rotation.x = -0.05; add(mast);
    const crownY = bridgeTopY + 12, mx = cx + 0.9;
    for (const [r, ox, oy, tilt] of [[2.2, 1.6, -1, 0.4], [3.4, -1.8, 1.8, -0.3], [1.4, 0.8, 3.6, 0.6]] as const) {
      const d = new THREE.Mesh(new THREE.ConeGeometry(r, r * 0.5, 12, 1, true), dark);
      d.position.set(mx + ox, crownY + oy, cz + 0.4); d.rotation.x = Math.PI / 2 + tilt; d.rotation.z = ox * 0.1; add(d);
    }
    for (const ox of [-0.9, 0.6, 1.5]) {
      const whip = cyl(0.03, 0.06, 4 + Math.abs(ox), _antennaMat, 4);
      whip.position.set(mx + ox, crownY + 2.2, cz - 0.6); whip.rotation.z = ox * 0.12; add(whip);
    }
    const globe = new THREE.Mesh(new THREE.SphereGeometry(1.4, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), _hullMat);
    globe.position.set(mx, crownY + 0.5, cz); add(globe);
  }

  // (A6) Engine mount cage — exposed ring + radial struts around each bell so the
  // engines read torn from their housing.
  {
    const ez = AFT_ORIGIN_Z + AFT_HALF_L + BELL_OFFSET_Z - 1.5, ey = AFT_HALF_H * 1.15;
    for (const sx of [-BELL_OFFSET_X, BELL_OFFSET_X]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(BELL_R * 1.06, 0.35, 6, 16), dark);
      ring.rotation.y = Math.PI / 2; ring.position.set(sx, ey, ez); add(ring);
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2 + 0.3;
        const strut = box(0.32, 0.32, 3.6, dark);
        strut.position.set(sx + Math.cos(a) * BELL_R * 0.95, ey + Math.sin(a) * BELL_R * 0.7, ez - 1.6);
        strut.lookAt(sx, ey, ez - 5); add(strut);
      }
    }
  }

  // (A7) Asymmetric impact breaches — +X impact flank shattered (2 big), -X lee
  // flank one small tear. makeBreach = recessed void + bent flaps.
  {
    const breach = (side: number, y: number, z: number, radius: number) => {
      const b = makeBreach(radius, _rand); tagWreckDecoration(b);
      b.position.set(side * AFT_HALF_W * 1.3, y, z);
      b.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
      b.scale.set(1, 0.95, 1.2); add(b);
    };
    breach(1, AFT_CY + 4, 10, 4.4);     // impact flank — gaping
    breach(1, AFT_CY - 3, 34, 2.8);     // impact flank — second
    breach(-1, AFT_CY + 3, 22, 2.0);    // lee flank — small tear
  }

  // (A8) Hull PLATING — a dorsal spine keel strake running the full length (the
  // cheapest "one long ship" signal) + fore-aft flank strakes with irregular
  // spacing → the flat faces read as plated hull, not a smooth box. Rule 7: ≥12cm.
  {
    const L = 110, z0 = BOW_ORIGIN_Z - BOW_HALF_L + 4;
    // Dorsal spine keel.
    const spine = box(1.4, 0.5, L, _hullMat);
    spine.position.set(bridgeCx * 0.3, AFT_CY + AFT_HALF_H * 1.12, (z0 + z0 + L) / 2); add(spine);
    // Flank strakes (both sides), irregular Y, ≥14cm proud.
    for (const side of [-1, 1]) {
      for (const yf of [0.35, 0.62, 0.85, 1.05]) {
        const st = box(0.18, 0.4, L * 0.92, _hullDarkMat);
        st.position.set(side * AFT_HALF_W * 1.28, AFT_CY - AFT_HALF_H + AFT_HALF_H * 2 * yf, (z0 + z0 + L) / 2 + (yf - 0.6) * 6);
        add(st);
      }
    }
  }

  // ── Tilt the whole exterior shell into a stronger LIST + sink it into the dune.
  // The interior boxes + colliders stay LEVEL (gameplay), so the wreck looks
  // rolled + nose-down while the player still walks a level cavity (D185). The
  // generous envelope keeps the level box corners inside the tilted shell.
  shell.rotation.z = -0.19;   // ~11° roll toward the +X impact flank
  shell.rotation.x = -0.06;   // nose-down pitch
  shell.position.y = -2.5;    // sink into the sand
  g.add(shell);

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
  journals?: { list: Journal[] },
): THREE.Group {
  const group = makeMegaWreck(rand);
  group.name = 'megaWreck';   // ACAJ — so the `megawreck` rig-shot can locate it
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
  addAccessPanel(aftPanel, 0, 0, 0, 1, 0, 'massive');
  registerSalvageable(salvageables, aftPanel, 'massive', worldPos(aftPanel.position), rand);

  // 2. Bow chamber — front interior wall (-Z tip), facing into chamber.
  // Attached to bowGroup so the bowYOffset applies; world position is
  // computed via the parent chain (group → bowGroup → bowPanel).
  const bowPanel = new THREE.Group();
  bowPanel.position.set(0.5, 1.0, BOW_ORIGIN_Z - BOW_HALF_L + WALL_THICK + 0.05);
  if (bowGroup) bowGroup.add(bowPanel); else group.add(bowPanel);
  addAccessPanel(bowPanel, 0, 0, 0, 1, 0, 'massive');
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
    addAccessPanel(panelGroup, 0, 0, 0, 1, 0, kind);
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
  // Session ABE — 7b. Ground-level secondary panel between the engine
  // bells. The two exterior bell panels above sit at ~AFT_HALF_H*0.7
  // (≈7.7m up) — only reachable by climbing the catwalk stairs. This
  // adds a ground-reachable alternative on the AFT BACK WALL exterior,
  // centred between the bells, at chest height (y≈1.5m). Players can
  // walk up to the wreck from the rear and pry this without scaling
  // the structure. Same 'massive' loot kind as the aft bay panel.
  {
    const p = new THREE.Group();
    const groundY = 1.5;
    const backWallZ = AFT_ORIGIN_Z + AFT_HALF_L + WALL_THICK + 0.05;
    p.position.set(0, groundY, backWallZ);
    p.rotation.y = 0;                  // face +Z (away from hull = outward)
    registerNested(p, group, 'massive');
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

  // ACL megawreck-catwalk-panel-reachability — 2 GROUND-LEVEL exterior
  // hull panels. Panels #3/#4/#8 (upper catwalk ≈7.5m, bridge stub
  // ≈11.5m, antenna spire ≈30m+) all require the ramp/stair climb. ABE
  // added one ground panel on the rear back wall between the bells; this
  // pair finishes the "fully salvageable from the ground" goal with two
  // more on the most-walkable hull faces — the long aft -X side wall and
  // the bow +X side wall (near the existing ragged opening). Both at
  // chest/eye height so a player walking up from the sand can pry them
  // without scaling the structure. Same 'massive' loot kind + scale=1 as
  // the wreck's other hull panels. Additive registrations (no save bump).
  const PANEL_GROUND_Y = Tuning.WRECK_GROUND_PANEL_Y;   // chest/eye-height for ground-reachable hull panels (m)

  // 9. Aft -X side wall exterior — long flat hull face, mid-length.
  // The aft -X wall is solid (no doorway) and spans the full 60m bay
  // length, so it's the most approachable salvage surface from the sand.
  // Panel sits proud of the wall (localX just outside the wall face),
  // facing -X (outward toward the approaching player).
  {
    const p = new THREE.Group();
    p.position.set(
      -AFT_HALF_W - WALL_THICK - 0.05,
      PANEL_GROUND_Y,
      AFT_ORIGIN_Z - AFT_HALF_L * 0.3,
    );
    p.rotation.y = -Math.PI / 2;   // face -X (outward)
    registerNested(p, group, 'massive');
  }

  // 10. Bow +X side wall exterior — beside the ragged side-light opening.
  // Attached to bowGroup so it inherits bowYOffset (terrain tracking).
  // Faces +X (outward). Offset along Z from the opening (BOW_ORIGIN_Z) so
  // the panel doesn't overlap the opening hole.
  {
    const p = new THREE.Group();
    p.position.set(
      BOW_HALF_W + WALL_THICK + 0.05,
      PANEL_GROUND_Y,
      BOW_ORIGIN_Z + BOW_HALF_L * 0.45,
    );
    p.rotation.y = Math.PI / 2;    // face +X (outward)
    registerNested(p, bowGroup ?? group, 'massive');
  }

  // ── ACAJ — asymmetric half-burial: wind-drifted sand mounds heap against the
  // -X LEE flank (the impact +X flank stays exposed for the breaches/debris) +
  // a big mound swallowing the driven-in bow nose. Reads as "sitting IN the
  // dunes," and the asymmetric drift reinforces the list.
  {
    const cos = Math.cos(yaw), sin = Math.sin(yaw);
    const wd = new THREE.Vector2(-cos, -sin);   // local -X drift, rotated into world by yaw
    const leeLocal: Array<[number, number, number]> = [
      [-AFT_HALF_W * 1.15, -6, 13],
      [-AFT_HALF_W * 1.2, 12, 16],
      [-AFT_HALF_W * 1.15, 30, 14],
      [-AFT_HALF_W * 0.9, 44, 11],
      [-BOW_HALF_W * 1.2, BOW_ORIGIN_Z, 12],
      [-2, BOW_ORIGIN_Z - BOW_HALF_L, 18],       // big mound over the crushed nose
    ];
    for (const [lx, lz, sz] of leeLocal) {
      const w = new THREE.Vector3(lx, 0, lz).applyQuaternion(finalQ).add(pos);
      scene.add(makeSandMound(_terrain, w.x, w.z, wd, sz, rand));
    }
    // Bow ground-contact: a dark settling-depression disc where it hit nose-first.
    const noseLocal = new THREE.Vector3(0, 0, BOW_ORIGIN_Z - BOW_HALF_L - 6);
    const noseW = noseLocal.clone().applyQuaternion(finalQ).add(pos);
    const scorch = new THREE.Mesh(
      new THREE.CircleGeometry(7, 16),
      new THREE.MeshLambertMaterial({ color: 0x3a2c20 }),
    );
    scorch.rotation.x = -Math.PI / 2;
    scorch.position.set(noseW.x, _terrain.heightAt(noseW.x, noseW.z) + 0.04, noseW.z);
    scorch.userData.noCollider = true; scorch.userData.noShadow = true;
    scene.add(scorch);
  }

  // ── Surrounding debris field — 40 small pieces in a 50m radius.
  placeDebrisField(scene, _terrain, pos, 50, rand, 40);

  // Session ABF — captain's log journal in the aft bay, mid-floor on
  // the +X side at chest-station distance from the existing aftPanel.
  // Picked a position well inside the bay (not against a wall) so the
  // player encounters it walking the floor rather than searching panel
  // edges. The bow chamber has its own panel + bowYOffset complication;
  // keeping the journal in the simpler aft bay avoids that math.
  if (journals) {
    const journalLocal = new THREE.Vector3(
      AFT_HALF_W * 0.3,
      0.0,
      AFT_ORIGIN_Z + AFT_HALF_L * 0.4,
    );
    const journalWorld = journalLocal.clone().applyQuaternion(finalQ).add(pos);
    const journalYaw = yaw + Math.PI / 2;
    journals.list.push(placeJournal(scene, journalWorld, journalYaw, 'mega_wreck'));
  }

  return group;
}
