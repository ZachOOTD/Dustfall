// Crashed Hull — flagship POI (Session NN — Wreck POI rework #2).
// Downed freighter at (18, -110), tilted into the dune. Replaces the
// inline `placeCrashedHull` in `poi.ts` which composed a shared
// `makeFuselage(3.2)` (straight cylinder + rust band) + `placeWreck
// (engine_bell, 2.4)` placed 8m off the tail, both wrapped in a single
// AABB collider. The shared builders are kept untouched (other callers
// use them — procgen POIs, mega_wreck companions) and this module
// builds its own curved hull + bell from scratch.
//
// Silhouette upgrade over the prior straight cylinder:
//   - LatheGeometry-tapered fuselage with a cockpit bulge at the nose
//     end, mid-body waist, and tail neck-down where the engine bell
//     attaches. Reads like a real spacecraft fuselage instead of a
//     plain section of pipe.
//   - Hull ribbing (TorusGeometry rings) around the body.
//   - 2 hatches + 2 broken antenna stubs + cockpit window strip for
//     hand-built detail.
//   - Custom LatheGeometry engine bell at the tail with BackSide
//     emissive throat + dark backstop disc (D48 sandworm-maw trick).
//
// Colliders: per-piece tilted box helper (composed-quaternion pattern
// from satelliteDish.ts + engineBlock.ts) so the player can walk on
// the upper hull as a lookout perch. Drops the prior single
// `attachCompoundCollider` AABB which overshot ~1.5m at tilted
// corners.
//
// 2 salvage panels (matches dish + engineBlock pattern): visible side
// hatch on the upper hull + recessed inside the bell throat (hidden
// loot reward — climb the hull, peer down into the bell).
//
// No interior + no shelter zone — crashed_hull is an open landmark
// (the dish is the lone shelter POI; doubling that affordance dilutes
// the dish's identity). Walkable upper hull is the player perch.
//
// D60 — angled cylinders anchored via `geometry.translate(0, halfL,
// 0)` before rotation, so the foot stays fixed. Applies here to the
// broken-antenna stubs that lean off vertical. Tube-curves and Lathe
// profiles don't need it (their endpoints are already authoritative).
//
// D62 — relevant only if/when we apply the procedural-shader
// treatment from `terrainMaterial.ts` to the hull material. First
// pass uses flat-shaded MeshLambertMaterial like the other POIs.

import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { Rng } from '../core/rng.ts';
import type { Terrain } from './terrain.ts';
import type { SalvageableRegistry } from './salvage.ts';
import { registerSalvageable } from './salvage.ts';
import { makeStaticBox } from '../physics/bodies.ts';
import { Tuning } from '../config/tuning.ts';
import { placeDebrisField } from './wrecks.ts';
import { createRustedHullMaterial } from './hullMaterial.ts';

// ── Materials — local copies so this module's palette can drift from
// the generic wrecks.ts hulls without polluting the shared pack. ────
// Session OO — procedural rust shader on the fuselage hull. The
// fuselage uses LatheGeometry which has SMOOTH normals (continuous
// surface) so the streak attenuation reads as a smooth gradient
// down the flanks rather than per-triangle bands. Upper hull gets
// sun bleach, side flanks get streaks, panel wear everywhere.
const _hullMat = createRustedHullMaterial({
  baseColor: Tuning.WRECK_HULL_HEX,
});
const _hullDarkMat = createRustedHullMaterial({
  baseColor: Tuning.WRECK_HULL_DARK_HEX,
  streakIntensity: 0.35,     // ribs already darker — quieter streaks
});
const _rustMat = new THREE.MeshLambertMaterial({
  color: 0x6a3a1f,           // saturated rust band on the hull
  flatShading: true,
});
const _bellOuterMat = new THREE.MeshLambertMaterial({
  color: 0x3a2820,           // weathered bell exterior
  flatShading: true,
  // AAL — was DoubleSide; the bell already has _bellInnerMat (BackSide)
  // + _bellBackstopMat covering the interior so DoubleSide was redundant
  // (and gave the outer shell a paper-thin read from oblique angles).
  side: THREE.FrontSide,
});
const _bellInnerMat = new THREE.MeshBasicMaterial({
  color: 0x180a06,           // dark interior, slight warmth
  side: THREE.BackSide,
});
const _bellBackstopMat = new THREE.MeshBasicMaterial({
  color: 0x080403,           // pitch-dark throat cap
});
const _bellRimMat = new THREE.MeshLambertMaterial({
  color: Tuning.WRECK_NOZZLE_RIM_HEX,
  flatShading: true,
});
const _bellScarMat = new THREE.MeshBasicMaterial({
  color: 0x2a1208,           // heat-scarring ring inside the rim
});
const _antennaMat = new THREE.MeshLambertMaterial({
  color: Tuning.WRECK_ANTENNA_HEX,
  flatShading: true,
});
const _windowMat = new THREE.MeshBasicMaterial({
  color: 0x0a0d10,           // dark cockpit window (broken / unlit)
});
const _panelBodyMat = new THREE.MeshLambertMaterial({
  color: Tuning.SALVAGE_PANEL_BODY_HEX,
});
const _panelRimMat = new THREE.MeshLambertMaterial({
  color: Tuning.SALVAGE_PANEL_RIM_HEX,
});

// ── Dimensions ──────────────────────────────────────────────────────
// Hull oriented along local +X (tail at X=0, nose at X=HULL_LEN).
// The Lathe profile is built around local +Y (standard Lathe
// orientation) then the mesh is rotated Z by -π/2 so its Y axis
// becomes world +X, putting the nose at world +X.
const HULL_LEN = 18;                    // m — total fuselage length
const HULL_R_FRONT = 1.4;               // m — cockpit radius
const HULL_R_MID = 2.6;                 // m — widest mid-body
const HULL_R_TAIL = 1.2;                // m — tail attachment radius

const BELL_THROAT_R = 1.05;             // m — bell throat (mounts to hull tail)
const BELL_RIM_R = 1.95;                // m — bell mouth wide flare
const BELL_DEPTH = 3.4;                 // m — bell length along its axis

const BURY_Y = 1.6;                     // m — match prior placeCrashedHull
const YAW = 0.9;                        // match prior
const PITCH = 0.08;
const ROLL = -0.18;

const RIB_COUNT = 4;                    // structural rings along the hull

// ── Sub-builders ────────────────────────────────────────────────────

/** Build the tapered fuselage body. LatheGeometry profile defines the
 *  silhouette in 2D (radius, lengthAxis); the lathe rotates the
 *  profile 16 times around its local +Y to produce the rotational
 *  body. We later rotate the whole group Z=-π/2 so the lathe's
 *  Y-length axis ends up aligned with world +X. */
function makeFuselageBody(): THREE.Group {
  const g = new THREE.Group();
  // Profile: pairs of (radius, lathe-Y). Tail at Y=0, nose at Y=HULL_LEN.
  // Walking through the silhouette:
  //   * Tail neck where the bell attaches (small radius)
  //   * Wide mid-body (combustion compartment / cargo bay)
  //   * Slight pinch behind the cockpit
  //   * Cockpit bulge near the nose
  //   * Pointed nose
  const profile: THREE.Vector2[] = [
    new THREE.Vector2(0,                       0),                  // tail seal
    new THREE.Vector2(HULL_R_TAIL * 0.70,      0.50),
    new THREE.Vector2(HULL_R_TAIL,             1.80),
    new THREE.Vector2(HULL_R_TAIL * 1.40,      HULL_LEN * 0.20),
    new THREE.Vector2(HULL_R_MID  * 0.75,      HULL_LEN * 0.32),
    new THREE.Vector2(HULL_R_MID  * 0.92,      HULL_LEN * 0.42),
    new THREE.Vector2(HULL_R_MID,              HULL_LEN * 0.52),    // widest waist
    new THREE.Vector2(HULL_R_MID  * 0.95,      HULL_LEN * 0.62),
    new THREE.Vector2(HULL_R_MID  * 0.78,      HULL_LEN * 0.72),
    new THREE.Vector2(HULL_R_FRONT * 1.25,     HULL_LEN * 0.80),    // pre-cockpit pinch
    new THREE.Vector2(HULL_R_FRONT * 1.35,     HULL_LEN * 0.86),    // cockpit bulge
    new THREE.Vector2(HULL_R_FRONT,            HULL_LEN * 0.93),
    new THREE.Vector2(HULL_R_FRONT * 0.50,     HULL_LEN * 0.98),
    new THREE.Vector2(0,                       HULL_LEN),           // nose tip
  ];
  const body = new THREE.Mesh(new THREE.LatheGeometry(profile, 18), _hullMat);
  g.add(body);

  // Rust band wrap — TorusGeometry near the mid-tail (echoes the old
  // makeFuselage's rust-band aesthetic without bringing the straight-
  // cylinder body along). Cross-section radius scaled to sit just
  // proud of the hull surface.
  const bandY = HULL_LEN * 0.28;
  const bandR = HULL_R_MID * 0.78;
  const band = new THREE.Mesh(
    new THREE.TorusGeometry(bandR, 0.16, 6, 22),
    _rustMat,
  );
  band.rotation.x = Math.PI / 2;          // torus normal → +Y axis
  band.position.y = bandY;
  g.add(band);

  // Structural ribs — TorusGeometry rings along the body length to
  // break up the smooth Lathe silhouette + suggest internal frames.
  for (let i = 0; i < RIB_COUNT; i++) {
    // Spread ribs through the mid-body (0.35..0.78 of length).
    const t = 0.35 + (i / (RIB_COUNT - 1)) * 0.43;
    const ribY = HULL_LEN * t;
    // Sample the profile to keep ribs flush with hull radius at their Y.
    let ribR = HULL_R_MID;
    for (let j = 0; j < profile.length - 1; j++) {
      const a = profile[j], b = profile[j + 1];
      if (ribY >= a.y && ribY <= b.y) {
        const u = (ribY - a.y) / (b.y - a.y);
        ribR = a.x + (b.x - a.x) * u;
        break;
      }
    }
    const rib = new THREE.Mesh(
      new THREE.TorusGeometry(ribR * 1.02, 0.10, 5, 22),
      _hullDarkMat,
    );
    rib.rotation.x = Math.PI / 2;
    rib.position.y = ribY;
    g.add(rib);
  }

  // Cockpit window strip — a slim darkened band on the upper-front of
  // the hull. Made from 3 small box meshes (front + 2 sides).
  const cockpitY = HULL_LEN * 0.88;
  for (let i = 0; i < 3; i++) {
    const ang = -0.35 + i * 0.35;
    const win = new THREE.Mesh(
      new THREE.BoxGeometry(0.65, 0.30, 0.06),
      _windowMat,
    );
    // Cockpit windows wrap around the upper front — angle determines
    // their position on the curved hull surface.
    win.position.set(
      Math.sin(ang) * HULL_R_FRONT * 1.25,
      cockpitY,
      Math.cos(ang) * HULL_R_FRONT * 1.25,
    );
    win.lookAt(0, cockpitY, 0);
    g.add(win);
  }

  // Hull breach — a darker "punched hole" on the side suggesting
  // damage. Small dark box embedded just shy of the hull surface,
  // reads as exposed interior shadow.
  const breach = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 0.9, 0.20),
    _hullDarkMat,
  );
  const breachY = HULL_LEN * 0.48;
  const breachAng = 1.8;
  breach.position.set(
    Math.sin(breachAng) * HULL_R_MID * 0.95,
    breachY,
    Math.cos(breachAng) * HULL_R_MID * 0.95,
  );
  breach.lookAt(0, breachY, 0);
  g.add(breach);

  // Broken antenna stubs near the nose — 2 short cylinders leaning
  // off the upper hull. Anchored via geometry.translate(0, halfL, 0)
  // (D60) so the rotation pivots around the foot, keeping the base
  // flush with the hull surface.
  for (let i = 0; i < 2; i++) {
    const stubLen = 1.3 + i * 0.3;
    const stubGeo = new THREE.CylinderGeometry(0.04, 0.06, stubLen, 6);
    stubGeo.translate(0, stubLen * 0.5, 0);   // D60 — anchor at foot
    const stub = new THREE.Mesh(stubGeo, _antennaMat);
    const sy = HULL_LEN * (0.78 + i * 0.04);
    // Foot on top of hull (local +Y direction in lathe frame).
    let stubR = HULL_R_FRONT * 1.20;
    for (let j = 0; j < profile.length - 1; j++) {
      const a = profile[j], b = profile[j + 1];
      if (sy >= a.y && sy <= b.y) {
        const u = (sy - a.y) / (b.y - a.y);
        stubR = a.x + (b.x - a.x) * u;
        break;
      }
    }
    stub.position.set(0, sy, stubR);
    // Lean the stub off vertical (rotate around X axis so the tip
    // sweeps in the Y-Z plane = sideways from the hull-axis view).
    stub.rotation.x = (i === 0 ? 0.35 : -0.45);
    stub.rotation.z = (i === 0 ? -0.15 : 0.10);
    g.add(stub);
  }

  // Rotate the whole group so the lathe's Y-length axis aligns with
  // world +X. Local (0, 1, 0) under Z=-π/2 rotation → (1, 0, 0).
  // Now nose at world +X = HULL_LEN, tail at world X = 0.
  g.rotation.z = -Math.PI / 2;

  return g;
}

/** Engine bell at the tail — mirrors engineBlock.ts's makeNozzleBell
 *  pattern (LatheGeometry tapered outer + BackSide inner cylinder +
 *  backstop disc + rim torus + scar ring). Bell built around its own
 *  local +Y (Lathe convention); caller rotates it. */
function makeTailBell(): THREE.Group {
  const g = new THREE.Group();
  // Outer flared profile — narrow throat at lathe Y=0 to wide rim at
  // lathe Y=BELL_DEPTH. Same shoulder/pinch/flare pattern as
  // engineBlock's nozzles for visual consistency across both POIs.
  const profile: THREE.Vector2[] = [
    new THREE.Vector2(BELL_THROAT_R,         0.00 * BELL_DEPTH),
    new THREE.Vector2(BELL_THROAT_R * 1.05,  0.10 * BELL_DEPTH),
    new THREE.Vector2(BELL_THROAT_R * 1.30,  0.22 * BELL_DEPTH),
    new THREE.Vector2(BELL_THROAT_R * 1.55,  0.36 * BELL_DEPTH),    // shoulder
    new THREE.Vector2(BELL_THROAT_R * 1.35,  0.50 * BELL_DEPTH),    // pinch
    new THREE.Vector2(BELL_THROAT_R * 1.45,  0.62 * BELL_DEPTH),
    new THREE.Vector2(BELL_THROAT_R * 1.75,  0.76 * BELL_DEPTH),
    new THREE.Vector2(BELL_RIM_R    * 0.88,  0.90 * BELL_DEPTH),
    new THREE.Vector2(BELL_RIM_R,            1.00 * BELL_DEPTH),    // rim
  ];
  const outer = new THREE.Mesh(new THREE.LatheGeometry(profile, 14), _bellOuterMat);
  g.add(outer);

  // Inner darkness — open BackSide cylinder, recessed past the rim.
  const innerR = BELL_THROAT_R * 1.15;
  const inner = new THREE.Mesh(
    new THREE.CylinderGeometry(BELL_RIM_R * 0.85, innerR, BELL_DEPTH * 0.95, 14, 1, true),
    _bellInnerMat,
  );
  inner.position.y = BELL_DEPTH * 0.5 - 0.05;
  g.add(inner);

  // Backstop disc — pitch-dark cap at throat end so the bell isn't
  // see-through from oblique angles.
  // AAO: was CircleGeometry (zero depth); replaced with a short Cylinder
  // so the throat cap has real thickness at grazing angles (rule 7).
  const backstop = new THREE.Mesh(
    new THREE.CylinderGeometry(innerR * 0.95, innerR * 0.95, 0.10, 14),
    _bellBackstopMat,
  );
  backstop.position.y = 0.10;
  g.add(backstop);

  // Rim torus + scar ring for silhouette legibility from distance.
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(BELL_RIM_R * 1.02, BELL_RIM_R * 0.05, 6, 18),
    _bellRimMat,
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.y = BELL_DEPTH;
  g.add(rim);

  const scar = new THREE.Mesh(
    new THREE.TorusGeometry(BELL_RIM_R * 0.95, BELL_RIM_R * 0.03, 4, 16),
    _bellScarMat,
  );
  scar.rotation.x = Math.PI / 2;
  scar.position.y = BELL_DEPTH * 0.93;
  g.add(scar);

  return g;
}

/** Salvage access panel — local copy of the dish/engineBlock pattern
 *  so this module is self-contained (doesn't reach into wrecks.ts's
 *  addAccessPanel which has its own conventions). */
function makeCHAccessPanel(): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(
      Tuning.SALVAGE_PANEL_SIZE_X,
      Tuning.SALVAGE_PANEL_SIZE_Y,
      Tuning.SALVAGE_PANEL_SIZE_Z,
    ),
    _panelBodyMat,
  );
  g.add(body);
  const rim = new THREE.Mesh(
    new THREE.BoxGeometry(
      Tuning.SALVAGE_PANEL_SIZE_X * 1.1,
      Tuning.SALVAGE_PANEL_SIZE_Y * 0.18,
      Tuning.SALVAGE_PANEL_SIZE_Z * 0.4,
    ),
    _panelRimMat,
  );
  rim.position.set(0, -Tuning.SALVAGE_PANEL_SIZE_Y * 0.42, Tuning.SALVAGE_PANEL_SIZE_Z * 0.35);
  g.add(rim);
  return g;
}

// ── Main entry ──────────────────────────────────────────────────────

export function placeCrashedHull(
  scene: THREE.Scene,
  world: RAPIER.World,
  terrain: Terrain,
  pos: THREE.Vector3,
  rand: Rng,
  salvageables?: SalvageableRegistry,
): THREE.Group {
  // We don't randomize the hero hull's silhouette — flagship reads as
  // a deliberate placement. `rand` is still threaded so future
  // tweaks (debris field seeding, antenna lean variance) can pick it up.
  void rand;

  const group = new THREE.Group();

  // ── 1. Fuselage body — tapered Lathe along local +X after rotation.
  const fuselage = makeFuselageBody();
  group.add(fuselage);

  // ── 2. Engine bell — attached at fuselage-local +X = 0 (tail), bell
  //    mouth opening in -X direction (away from the hull). The bell's
  //    LatheGeometry rotates around its local +Y axis (throat at Y=0,
  //    rim at Y=BELL_DEPTH). To make the mouth open in world -X, we
  //    rotate the bell's Y axis to world -X via Z=+π/2.
  //    Local (0, 1, 0) under Z=+π/2 → (-1, 0, 0). Throat anchors at
  //    world (0, 0, 0), rim ends at (-BELL_DEPTH, 0, 0).
  const bell = makeTailBell();
  bell.rotation.z = Math.PI / 2;
  bell.position.set(-0.2, 0, 0);          // small overlap into hull for clean seam
  group.add(bell);

  // ── 3. Salvage panels (2) ──────────────────────────────────────
  // Panel A — visible side hatch on the upper-mid hull. After the
  // parent group's roll, this sits eye-height-ish from the dune
  // approach side.
  const panelA = makeCHAccessPanel();
  // Place on the upper hull surface, mid-body. World X = HULL_LEN * 0.55,
  // upper-Y = HULL_R_MID + small offset, Z = 0 (centered top).
  panelA.position.set(HULL_LEN * 0.55, HULL_R_MID + Tuning.SALVAGE_PANEL_SIZE_Z * 0.5, 0);
  panelA.userData.accessPanel = panelA;
  group.add(panelA);
  // Panel B — recessed inside the bell throat (climb the hull, peer
  // down into the bell). After the bell.rotation.z = +π/2, the bell's
  // throat is at world (0, 0, 0) and mouth at (-BELL_DEPTH, 0, 0).
  // Place panel B at world X = -BELL_DEPTH * 0.55 (mid-depth), upper
  // inner wall.
  const panelB = makeCHAccessPanel();
  panelB.position.set(-BELL_DEPTH * 0.55, BELL_THROAT_R * 0.45, 0);
  panelB.rotation.z = Math.PI / 2;        // panel face perpendicular to bell axis
  panelB.userData.accessPanel = panelB;
  group.add(panelB);

  // ── 4. Position, tilt, add to scene ────────────────────────────
  group.position.copy(pos);
  group.position.y -= BURY_Y;
  group.rotation.y = YAW;
  group.rotation.x = PITCH;
  group.rotation.z = ROLL;
  group.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });
  scene.add(group);

  // ── 5. Colliders — per-piece tilted boxes via composed-quat helper
  //    (same pattern as engineBlock.ts / satelliteDish.ts). ──
  const groupWorldQuat = new THREE.Quaternion();
  group.getWorldQuaternion(groupWorldQuat);
  const groupWorldPos = group.position.clone();

  const addCHCollider = (localPos: THREE.Vector3, halfExtents: { x: number; y: number; z: number }): void => {
    const worldCenter = localPos.clone()
      .applyQuaternion(groupWorldQuat)
      .add(groupWorldPos);
    makeStaticBox(world, halfExtents, worldCenter, {
      x: groupWorldQuat.x, y: groupWorldQuat.y, z: groupWorldQuat.z, w: groupWorldQuat.w,
    });
  };

  // (a) Main fuselage body — one fitted cuboid spanning the length.
  //     Centered at HULL_LEN/2, height matches max radius (HULL_R_MID).
  //     The Lathe surface is curved but a single box collider here is
  //     close enough — player can walk on top, can't clip through.
  addCHCollider(
    new THREE.Vector3(HULL_LEN * 0.5, 0, 0),
    { x: HULL_LEN * 0.5, y: HULL_R_MID * 0.95, z: HULL_R_MID * 0.95 },
  );
  // (b) Walkable upper-hull strip — flat thin box sitting on top of
  //     the fuselage so the player has a clean perch surface.
  addCHCollider(
    new THREE.Vector3(HULL_LEN * 0.5, HULL_R_MID * 0.95, 0),
    { x: HULL_LEN * 0.45, y: 0.05, z: HULL_R_MID * 0.55 },
  );
  // (c) Engine bell — single cuboid covering the bell. After the
  //     bell's Z=+π/2 rotation in local space, the bell extends from
  //     X=0 to X=-BELL_DEPTH with width = 2 * BELL_RIM_R.
  addCHCollider(
    new THREE.Vector3(-BELL_DEPTH * 0.5, 0, 0),
    { x: BELL_DEPTH * 0.5, y: BELL_RIM_R, z: BELL_RIM_R },
  );
  // (d) Underside wedge — stops the player crawling under the
  //     buried side of the hull. Mostly below local Y=0 (which after
  //     BURY_Y is mostly below terrain).
  addCHCollider(
    new THREE.Vector3(HULL_LEN * 0.5, -HULL_R_MID * 0.6, 0),
    { x: HULL_LEN * 0.5, y: HULL_R_MID * 0.6, z: HULL_R_MID },
  );

  // ── 6. Register both salvageables ──────────────────────────────
  if (salvageables) {
    panelA.updateWorldMatrix(true, false);
    const panelAWorld = new THREE.Vector3().setFromMatrixPosition(panelA.matrixWorld);
    registerSalvageable(salvageables, panelA, 'massive', panelAWorld, rand);

    panelB.updateWorldMatrix(true, false);
    const panelBWorld = new THREE.Vector3().setFromMatrixPosition(panelB.matrixWorld);
    registerSalvageable(salvageables, panelB, 'massive', panelBWorld, rand);
  }

  // ── 7. Debris field — preserve the prior 16m / 12-piece debris
  //    apron from the impact site. ──
  placeDebrisField(scene, terrain, pos, 16, rand, 12);

  return group;
}
