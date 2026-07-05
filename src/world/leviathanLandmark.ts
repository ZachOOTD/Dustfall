// Horizon-hook landmark — the BEACHED LEVIATHAN (escape-pod-intro desert reveal,
// 2026-07-01). A colossal broken capital-ship wreck breaching the dunes far on the
// horizon in the step-out reveal direction: a BIGGER, older echo of the player's own
// crashed pod, saying "a greater disaster happened out there — go see." Read purely
// as a DISTANT SILHOUETTE against the sky (~360m from the intro/opening spawn), so it
// is built silhouette-first: a monumental snapped hull, prow reared skyward, a leaning
// superstructure, exposed former rings at the fracture, half-buried in sand. (2026-07-01:
// the intro moved DAWN → bright MIDDAY; the hull value was deepened so a FRONT-LIT noon
// wreck still reads as a dark monumental mass against the bright horizon — see the
// LEVIATHAN_HULL_HEX material block below.)
//
// PLACEMENT (world-fixed, deterministic): the opening-scene / intro spawn is at a
// stable nominal position (~(-61,-2), west of origin) and the step-out gaze faces
// world dir ~(-0.949, +0.315). The leviathan sits at a FIXED world position along
// that gaze, far enough (~360m) to fog into a hazed monument but clearly reachable.
// It is NOT random-scattered — one hand-placed monument, same every seed.
//
// SCOPE: a pure landmark — no interior, no salvage, no enterable cavity. A single
// static box collider (below the visible silhouette footprint) keeps the player from
// walking through the hull if they hike out to it; the rest is noCollider decor.
// Determinism: its own seeded RNG (does NOT draw from the world scatter stream).
// One shared hull material + a couple of accents -> a handful of draw calls.

import * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';
import type { Terrain } from './terrain.ts';
import { Tuning } from '../config/tuning.ts';
import { makeRng } from '../core/rng.ts';
import { makeLoftedHull, makeFormerRings, makeSandMound, type LoftStation } from './wreckForms.ts';
import { createRustedHullMaterial } from './hullMaterial.ts';
import { createMetalMaterial } from './metalMaterial.ts';
import { makeStaticBox } from '../physics/bodies.ts';
import { addHorizonSilhouette } from './horizonSilhouettes.ts';

// ── World placement. The intro/opening spawn is deterministic at ~(-61,-2); the
//    step-out gaze faces ~(-0.949, +0.315). Sit the leviathan ~360m out along it.
//    (Fixed literals — a monument, not a scatter — so it lands in the reveal every run.)
const LANDMARK_X = -403;
const LANDMARK_Z = 106;

// ── Silhouette scale. Long-axis (local Z) hull; the reared prow spears the sky.
//    Sized MONUMENTAL — it is read at ~365m, so it must dominate the horizon (R2:
//    a fin read as too small; the long hull must present broadside + rise clear of
//    the horizon line, with the reared prow the tall peak).
const HULL_LEN = 128;         // stem-to-stern span of the two masses
const HULL_HALF_W = 11.0;     // beam half-width at the fat midships
const HULL_HALF_H = 11.0;     // hull half-height at midships
// Yaw that presents the long hull BROADSIDE to the step-out gaze (~(-0.949,+0.315)):
// local +Z after yaw = (sin,cos); set it perpendicular to the sightline so the whole
// length reads (R2 fix — YAW 2.15 was nearly end-on, so it looked like a single fin).
const HULL_YAW = 0.34;

// MIDDAY-READ (2026-07-01 consistency re-scope): the leviathan was tuned as a DAWN-BACKLIT
// silhouette — dark shape against the salt-flat glow band. At the new bright MIDDAY it is
// FRONT-LIT + the sun is high, and the shared warm rust-brown wreck value (0x5b4c3c) sat
// tonally INSIDE the orange horizon-haze band, so at the real ~355m reveal (≈47% fog blend at
// FOG_DENSITY_CLEAR) it washed toward the sky and lost its "go there" pull. Fix: give the
// leviathan its OWN DEEPER, COOLER, DESATURATED hull value (NOT the shared WRECK_HULL_HEX —
// that would darken every wreck in the game) so a front-lit noon wreck still reads as a DARK
// MONUMENTAL MASS punching below the bright hazed horizon. chalkStrength also dropped (no dawn
// to catch — bleached upper decks were adding light value that killed the mass at midday).
// DoubleSide so the open lofted belly + torn fracture faces never punch a hole to the sky.
const LEVIATHAN_HULL_HEX = 0x362d24;      // deep desaturated brown-grey — clearly below the midday horizon-haze value
const LEVIATHAN_HULL_DARK_HEX = 0x281f18; // the shadowed under-mass / tower — darker still for value depth
const _hullMat = createRustedHullMaterial({
  baseColor: LEVIATHAN_HULL_HEX,
  streakIntensity: 0.8,
  oxDeepStrength: 0.5,
  chalkStrength: 0.12,        // minimal bleach — a high noon sun, not a raking dawn; keep the mass dark
});
_hullMat.side = THREE.DoubleSide;
const _hullDarkMat = createRustedHullMaterial({
  baseColor: LEVIATHAN_HULL_DARK_HEX,
  streakIntensity: 0.6,
});
_hullDarkMat.side = THREE.DoubleSide;
const _ribMat = createMetalMaterial(Tuning.WRECK_ANTENNA_HEX, { wornScale: 5.0, scratchStrength: 0.05 });

let _group: THREE.Group | null = null;
let _drift: THREE.Mesh | null = null;
let _collider: RAPIER.Collider | null = null;

/** Build the leviathan mesh in LOCAL space (long-axis +Z, y=0 = keel-ish),
 *  BEFORE the world tilt/burial transform is applied by placeLeviathanLandmark. */
function buildLeviathanMesh(rand: () => number): THREE.Group {
  const g = new THREE.Group();

  // ── AFT MASS — the bulk of the hull: a LONG low body lying broadside (the "beached
  //    leviathan" belly). Lofted from the stern transom to the amidships FRACTURE face
  //    at z~+8. Kept proud of the sand so the whole length reads on the horizon.
  const aftStations: LoftStation[] = [
    { z: -64, halfW: HULL_HALF_W * 0.30, halfH: HULL_HALF_H * 0.42, cy: 1.6 },  // stern transom
    { z: -50, halfW: HULL_HALF_W * 0.66, halfH: HULL_HALF_H * 0.66, cy: 0.9 },
    { z: -34, halfW: HULL_HALF_W * 0.92, halfH: HULL_HALF_H * 0.86, cy: 0.4 },
    { z: -16, halfW: HULL_HALF_W * 1.0,  halfH: HULL_HALF_H * 1.0,  cy: 0.1 },   // fat midships
    { z: 0,   halfW: HULL_HALF_W * 0.98, halfH: HULL_HALF_H * 1.0,  cy: 0.0 },
    { z: 8,   halfW: HULL_HALF_W * 0.9,  halfH: HULL_HALF_H * 0.96, cy: 0.1 },   // fracture face
  ];
  const aft = makeLoftedHull(aftStations, _hullMat);
  g.add(aft);

  // ── FORWARD MASS — the SNAPPED-OFF bow section, REARED UP so the prow spears the
  //    sky (the dramatic silhouette peak). Built level, then pitched up about the
  //    fracture hinge at z~+8 so its long axis rakes into the air — the tallest point.
  //    Kept CHUNKY (a broken bow has mass — R3: an over-tapered loft read as a thin
  //    flat fin), tapering to a blunt prow rather than a sliver, and steepened so it
  //    spears up as a bold diagonal peak.
  const bowLen = 62;
  const bowStations: LoftStation[] = [
    { z: 0,  halfW: HULL_HALF_W * 0.92, halfH: HULL_HALF_H * 0.98, cy: 0.0 },   // torn root (mates the fracture)
    { z: 18, halfW: HULL_HALF_W * 0.82, halfH: HULL_HALF_H * 0.86, cy: 0.2 },
    { z: 38, halfW: HULL_HALF_W * 0.60, halfH: HULL_HALF_H * 0.62, cy: 0.5 },
    { z: 54, halfW: HULL_HALF_W * 0.34, halfH: HULL_HALF_H * 0.34, cy: 0.7 },
    { z: bowLen, halfW: HULL_HALF_W * 0.22, halfH: HULL_HALF_H * 0.22, cy: 0.8 }, // blunt prow
  ];
  const bow = makeLoftedHull(bowStations, _hullMat);
  const bowPivot = new THREE.Group();
  bowPivot.add(bow);
  bowPivot.position.set(0, HULL_HALF_H * 0.3, 8);      // hinge at the fracture
  bowPivot.rotation.order = 'YXZ';
  bowPivot.rotation.y = 0.42;                           // twist off the hull axis so a broadside look shows the bow VOLUME, not a flat plate (R4)
  bowPivot.rotation.x = -1.12;                          // rear the bow UP (~64deg) — nose to the sky (R5: a taller, bolder prow peak)
  bowPivot.rotation.z = 0.05;                           // a slight cant so it is not dead-symmetric
  g.add(bowPivot);

  // ── EXPOSED FORMER RINGS at the fracture — the guts of the giant, where the two
  //    masses tore apart. Face them along the hull axis at the aft fracture mouth.
  const rings = makeFormerRings(HULL_HALF_H * 0.92, 6, 2.0, { startX: 0, tube: 0.4, taper: 0.03 });
  rings.rotation.y = Math.PI / 2;                       // ring plane perpendicular to the +Z hull axis
  rings.position.set(0, HULL_HALF_H * 0.2, 7);
  g.add(rings);
  // A couple of exposed ribs at the reared bow root too (the tear shows on both halves).
  const bowRibs = makeFormerRings(HULL_HALF_H * 0.72, 3, 1.7, { startX: 0, tube: 0.34, taper: 0.04 });
  bowRibs.rotation.y = Math.PI / 2;
  bowRibs.position.copy(bowPivot.position);
  bowRibs.rotation.x = bowPivot.rotation.x;
  g.add(bowRibs);

  // ── LEANING SUPERSTRUCTURE / command island — a broken tower on the aft deck: a
  //    second TALL vertical breaking the long horizontal hull (a distinct silhouette
  //    peak beside the reared prow, so the read is unmistakably a SHIP with a bridge).
  const tower = new THREE.Group();
  const towerBase = new THREE.Mesh(
    new THREE.BoxGeometry(HULL_HALF_W * 1.0, 16, HULL_HALF_W * 0.7),
    _hullDarkMat,
  );
  towerBase.position.y = 8;
  tower.add(towerBase);
  // A stacked upper bridge block (steps the tower so it is not one plain slab).
  const bridge = new THREE.Mesh(
    new THREE.BoxGeometry(HULL_HALF_W * 0.6, 6, HULL_HALF_W * 0.5),
    _hullMat,
  );
  bridge.position.set(HULL_HALF_W * 0.12, 16 + 3, 0);
  tower.add(bridge);
  // A snapped upper mast/antenna spar off the tower top (thin, catches the dawn edge).
  const mast = new THREE.Mesh(
    new THREE.CylinderGeometry(0.45, 0.7, 16, 6),
    _ribMat,
  );
  mast.position.set(HULL_HALF_W * 0.12, 16 + 6 + 7, 0);
  mast.rotation.z = 0.30;                               // leaning, about to fall
  tower.add(mast);
  const crossSpar = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 8, 5), _ribMat);
  crossSpar.rotation.z = Math.PI / 2;
  crossSpar.position.set(HULL_HALF_W * 0.12 + 2.0, 16 + 6 + 11, 0);
  tower.add(crossSpar);
  tower.position.set(0, HULL_HALF_H * 0.6, -28);        // on the aft deck
  tower.rotation.z = 0.08;                              // the whole island leans
  g.add(tower);

  // ── Secondary engine-nacelle stub aft (mass at the stern for a balanced silhouette).
  const nacelle = new THREE.Mesh(
    new THREE.CylinderGeometry(HULL_HALF_W * 0.38, HULL_HALF_W * 0.3, 14, 10),
    _hullDarkMat,
  );
  nacelle.rotation.x = Math.PI / 2;
  nacelle.position.set(HULL_HALF_W * 0.6, HULL_HALF_H * 0.35, -58);
  g.add(nacelle);

  // Mark ALL of it as decoration / noCollider (the collider is a separate proxy box).
  g.traverse((o) => {
    o.userData.isWreckDecoration = true;
    o.userData.noCollider = true;
    const m = o as THREE.Mesh;
    if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; }
  });
  void rand;   // reserved for future per-instance variation; determinism handle
  return g;
}

/** Place the beached-leviathan horizon landmark at its fixed world position, tilted
 *  + half-buried in the dune. Additive; safe to call once at world build. Idempotent
 *  (removes a prior instance first). Registers itself as a fog-resistant sun occluder
 *  + skyline silhouette like the other flagships. */
export function placeLeviathanLandmark(
  scene: THREE.Scene,
  world: RAPIER.World,
  terrain: Terrain,
): void {
  removeLeviathanLandmark(scene);
  const rand = makeRng(0x1e71a7);              // fixed seed — deterministic, own stream
  const group = buildLeviathanMesh(rand);
  group.name = 'leviathanLandmark';            // findable by the rig-shot framer + occluder-by-name

  // ── Tilt (a crashed-and-settled list) + burial. The hull long-axis is local +Z;
  //    yaw it BROADSIDE to the spawn gaze so the whole length reads, pitch a settled
  //    list, and sink only the keel so the long body rises clear of the horizon line.
  const gy = terrain.heightAt(LANDMARK_X, LANDMARK_Z);
  group.rotation.set(0.08, HULL_YAW, 0.05);    // pitch (settle) + yaw (broadside) + roll (list)
  // Sink only the keel so the whole LONG hull body rises clear of the horizon line
  // (R2: over-burial made it read as a lone fin — keep the belly proud so the ship
  // silhouette lies broadside above the dune).
  const BURY = HULL_HALF_H * 0.22;
  group.position.set(LANDMARK_X, gy - BURY, LANDMARK_Z);
  group.updateMatrixWorld(true);
  scene.add(group);

  // ── Windward sand drift banked against the buried flank (the dune reclaims it).
  const drift = makeSandMound(terrain, LANDMARK_X, LANDMARK_Z, new THREE.Vector2(0.7, 0.5), HULL_LEN * 0.34, rand, { proud: 0.03 });
  drift.userData.noCollider = true;
  scene.add(drift);
  _drift = drift;

  // ── ONE static collider — a broad box under the visible hull footprint so a player
  //    who hikes out cannot walk through the leviathan. Sits at the buried mass; the
  //    reared prow + tower are decor-only (unreachably high anyway).
  // Local hull long-axis is +Z; box half-Z spans the length, half-X the beam.
  const half = { x: HULL_HALF_W * 1.4, y: HULL_HALF_H * 1.2, z: HULL_LEN * 0.42 };
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, HULL_YAW, 0));
  _collider = makeStaticBox(
    world,
    half,
    { x: LANDMARK_X, y: gy - BURY + HULL_HALF_H * 0.9, z: LANDMARK_Z },
    { x: q.x, y: q.y, z: q.z, w: q.w },
  );

  // ── Skyline / sun-occluder registration (a sun-shade for the long hike out) — the same
  //    system the flagships use. NOTE (ACBD): this no longer draws a fog-resistant billboard;
  //    it only registers the bounding box as a sun occluder. The leviathan reads on the
  //    horizon purely via its REAL geometry + its own deepened hull value (see the material
  //    block above — the midday-read fix), not a billboard. No rand draw.
  addHorizonSilhouette(scene, new THREE.Box3().setFromObject(group));

  _group = group;
}

/** Tear down the landmark (world rebuild / new game) so it does not accumulate. */
export function removeLeviathanLandmark(scene: THREE.Scene): void {
  if (_group) {
    scene.remove(_group);
    _group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) { m.geometry?.dispose(); }
    });
    _group = null;
  }
  if (_drift) {
    scene.remove(_drift);
    _drift.geometry?.dispose();
    _drift = null;
  }
  // The static body persists in the world; new-game rebuilds the world wholesale, so
  // we do not remove the collider here (mirrors the other hand-placed landmarks).
  void _collider;   // held for lifecycle symmetry / future teardown
  _collider = null;
}

/** The fixed world position of the leviathan (for any nav / telemetry that wants it). */
export function getLeviathanLandmarkPos(): { x: number; z: number } {
  return { x: LANDMARK_X, z: LANDMARK_Z };
}
