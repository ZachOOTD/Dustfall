// Opening wreck — Session RR full redo.
//
// Replaces the box-walled W-era opening wreck with a tapered "cockpit +
// tail stub" silhouette built from the KK/LL/NN modelling vocabulary:
// LatheGeometry for the curved hull, procedural rust shader for surface
// weathering, per-piece tilted colliders matching the silhouette, and
// salvage panels.
//
// Composition (looking down the wreck-local Z axis, lathe rotated X=-π/2
// so its axial Y maps to world +Z):
//   - Lathe Y = 0           → torn-open tail-stump (entrance, world -Z)
//   - Lathe Y ≈ HULL_LEN/3  → narrow neck where the tail meets cockpit
//   - Lathe Y ≈ 2·HULL_LEN/3→ cockpit max radius (widest waist)
//   - Lathe Y = HULL_LEN    → cockpit nose tip (world +Z)
//
// The hull is built as N angular slices (lathe arcs of phiLength = 2π/N).
// ONE slice is intentionally omitted (`OPENING_WRECK_SKYLIGHT_SLICE`)
// leaving a genuine 15°-wide stress-fracture gap along the upper hull —
// real god-rays pass through into the interior. Smaller decorative
// breach patches on the side flanks are surface-applied dark boxes
// (they read as "rusted-through" holes without literally cutting the
// geometry).
//
// Local space convention preserved from the W-era module:
//   +Z = cockpit interior (skeleton + journal anchor)
//   -Z = torn-open entrance (player walks in)
//   y=0 = top of interior floor slab
//
// `OPENING_WRECK_EXTENTS` is exported as the orchestrator's contract —
// openingScene.ts reads halfX/halfY/halfZ/backZ to place the skeleton,
// journal, shelter zone, and player spawn point.

import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { Rng } from '../core/rng.ts';
import type { Terrain } from './terrain.ts';
import type { SalvageableRegistry } from './salvage.ts';
import { registerSalvageable } from './salvage.ts';
import { Tuning } from '../config/tuning.ts';
import { createRustedHullMaterial } from './hullMaterial.ts';

// ── Materials ───────────────────────────────────────────────────────
// Hull uses the procedural rust shader (Session OO) — vertical streaks
// down the flanks, sun bleach on the upper hull, panel-wear noise.
const _hullMat = createRustedHullMaterial({
  baseColor: Tuning.WRECK_HULL_HEX,
  streakIntensity: 0.55,
});
const _hullDarkMat = createRustedHullMaterial({
  baseColor: Tuning.WRECK_HULL_DARK_HEX,
  streakIntensity: 0.35,
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
const _windowMat = new THREE.MeshBasicMaterial({
  color: 0x0a0d10,            // dark cockpit window (broken / unlit)
});
const _breachMat = new THREE.MeshLambertMaterial({
  color: 0x14100a,            // dark exposed-interior shadow seen through a rusted-through patch
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
  color: 0xb8a888,            // chalky off-white — reads on the dark interior wall
});
const _panelBodyMat = new THREE.MeshLambertMaterial({
  color: Tuning.SALVAGE_PANEL_BODY_HEX,
});
const _panelRimMat = new THREE.MeshLambertMaterial({
  color: Tuning.SALVAGE_PANEL_RIM_HEX,
});

// ── Dimensions ───────────────────────────────────────────────────────
const HULL_LEN = Tuning.OPENING_WRECK_HULL_LEN;
const AXIS_Y = Tuning.OPENING_WRECK_AXIS_Y;
const R_TAIL_RIM = Tuning.OPENING_WRECK_R_TAIL_RIM;
const R_TAIL_BODY = Tuning.OPENING_WRECK_R_TAIL_BODY;
const R_NECK = Tuning.OPENING_WRECK_R_NECK;
const R_COCKPIT = Tuning.OPENING_WRECK_R_COCKPIT;
const R_NOSE = Tuning.OPENING_WRECK_R_NOSE;
const SLICE_COUNT = Tuning.OPENING_WRECK_SLICE_COUNT;
const SKYLIGHT_SLICE = Tuning.OPENING_WRECK_SKYLIGHT_SLICE;
const FLOOR_THICK = Tuning.OPENING_WRECK_FLOOR_THICK;

/** Lathe profile (radius, axial-Y). y=0 is the torn tail-stump,
 *  y=HULL_LEN is the cockpit nose. Sampled densely so the curve reads
 *  smoothly even at low angular tessellation. */
const PROFILE: THREE.Vector2[] = [
  new THREE.Vector2(R_TAIL_RIM,           0.00 * HULL_LEN),  // torn rim
  new THREE.Vector2(R_TAIL_BODY * 0.98,   0.05 * HULL_LEN),
  new THREE.Vector2(R_TAIL_BODY,          0.18 * HULL_LEN),  // tail body
  new THREE.Vector2(R_TAIL_BODY * 0.98,   0.30 * HULL_LEN),
  new THREE.Vector2(R_NECK,               0.42 * HULL_LEN),  // neck pinch
  new THREE.Vector2(R_NECK * 1.05,        0.50 * HULL_LEN),
  new THREE.Vector2(R_COCKPIT * 0.85,     0.58 * HULL_LEN),
  new THREE.Vector2(R_COCKPIT,            0.68 * HULL_LEN),  // cockpit max
  new THREE.Vector2(R_COCKPIT * 0.95,     0.78 * HULL_LEN),
  new THREE.Vector2(R_COCKPIT * 0.78,     0.86 * HULL_LEN),  // shoulder taper
  new THREE.Vector2(R_NOSE * 1.3,         0.93 * HULL_LEN),
  new THREE.Vector2(R_NOSE,               0.97 * HULL_LEN),
  new THREE.Vector2(0,                    1.00 * HULL_LEN),  // nose tip
];

/** Radius lookup — linearly interpolate the profile at a given lathe Y.
 *  Used by per-detail meshes (cockpit windows, breach patches, antenna
 *  stub) to anchor their position to the actual hull surface. */
function profileRadiusAt(latheY: number): number {
  for (let i = 0; i < PROFILE.length - 1; i++) {
    const a = PROFILE[i], b = PROFILE[i + 1];
    if (latheY >= a.y && latheY <= b.y) {
      const u = (latheY - a.y) / Math.max(1e-6, b.y - a.y);
      return a.x + (b.x - a.x) * u;
    }
  }
  return PROFILE[PROFILE.length - 1].x;
}

// ── Extents export ───────────────────────────────────────────────────
export interface OpeningWreckExtents {
  halfX: number;
  halfY: number;
  halfZ: number;
  /** Top surface of the interior floor in wreck-local Y. */
  floorY: number;
  /** Wreck-local Z where the cockpit interior front wall sits — the
   *  skeleton + journal anchor against this Z value (just inside the
   *  cockpit dome). */
  backZ: number;
}

/** halfZ = HULL_LEN/2 because the lathe is centered on the wreck origin
 *  (translated by -HULL_LEN/2 in spawnGroup so lathe Y=0 lands at world
 *  Z=-HULL_LEN/2 and lathe Y=HULL_LEN lands at world Z=+HULL_LEN/2). */
export const OPENING_WRECK_EXTENTS: OpeningWreckExtents = {
  halfX: R_COCKPIT,
  halfY: (AXIS_Y + R_COCKPIT) / 2,    // mid-cavity Y reference
  halfZ: HULL_LEN / 2,
  floorY: 0,
  // Skeleton anchor: 0.6m inside the cockpit nose end (world +Z).
  backZ: HULL_LEN / 2 - 0.6,
};

// ── Sub-builders ─────────────────────────────────────────────────────

/** Build the hull as N angular slices of LatheGeometry, skipping the
 *  designated SKYLIGHT_SLICE to leave a genuine stress-fracture gap
 *  along the upper hull. Each slice's geometry is centered in the
 *  group; the caller translates the group by -HULL_LEN/2 along Z. */
function makeSlicedHull(): THREE.Group {
  const g = new THREE.Group();
  const sliceArc = (Math.PI * 2) / SLICE_COUNT;

  // Skip TWO adjacent slices centered on true UP — 30° gap from slice
  // boundaries at 255°/285° straddling 270° (= world +Y after the
  // X=+π/2 group rotation). One-slice gap was offset 7.5° from
  // vertical; two-slice gap is symmetric around true UP.
  for (let i = 0; i < SLICE_COUNT; i++) {
    if (i === SKYLIGHT_SLICE || i === SKYLIGHT_SLICE + 1) continue;
    const phiStart = i * sliceArc;
    // Alternate hull / dark material so the slice seams read as panel
    // joints rather than disappearing into the curve. Even = base hull,
    // odd = dark hull.
    const mat = (i % 2 === 0) ? _hullMat : _hullDarkMat;
    const geo = new THREE.LatheGeometry(PROFILE, 4, phiStart, sliceArc);
    const slice = new THREE.Mesh(geo, mat);
    g.add(slice);
  }

  return g;
}

/** Build the cockpit window strip — 3 thin dark boxes wrapped around
 *  the upper-front of the hull, suggesting a broken canopy. Anchors
 *  on the hull radius at the cockpit shoulder (lathe Y = 0.78·HULL_LEN). */
function makeCockpitWindows(): THREE.Group {
  const g = new THREE.Group();
  const windowY = 0.80 * HULL_LEN;
  const radiusAtWindow = profileRadiusAt(windowY);
  // 3 horizontal segments wrapped over the top-front arc.
  // Angles chosen to span phi ∈ [3π/2 - 0.55, 3π/2 + 0.55] — i.e.,
  // straddling the UP direction (phi = 3π/2 with the X=-π/2 rotation).
  const baseAng = -Math.PI / 2;  // lathe-local phi for "world up" = -π/2 (= 3π/2)
  for (let i = -1; i <= 1; i++) {
    const ang = baseAng + i * 0.40;
    const win = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.20, 0.05),
      _windowMat,
    );
    // Position on the hull surface at angle `ang`. In lathe-local space
    // (before the group's X=-π/2 rotation), phi=0 is +X and phi=-π/2 is
    // +Z... no wait, phi rotates around +Y. So phi=0 is +X, phi=π/2 is
    // -Z (in lathe-local frame). After the group's X=-π/2 rotation:
    //   lathe-local +X → world +X
    //   lathe-local +Y → world +Z (axial)
    //   lathe-local +Z → world -Y
    //   lathe-local -Z → world +Y (UP)
    // So phi=-π/2 in lathe local (= +Z lathe local under standard math
    // convention... actually let me just compute from the slice arcs:
    // slice i covers phi ∈ [i*sliceArc, (i+1)*sliceArc]. SKYLIGHT_SLICE
    // = 17 with SLICE_COUNT=24 gives phi ∈ [17·15°, 18·15°] = [255°, 270°].
    // After lathe-local → world via X=-π/2, world-UP is achieved at
    // lathe-local phi = 270° = 3π/2 = -π/2. Confirmed: baseAng = -π/2.)
    win.position.set(
      Math.cos(ang) * radiusAtWindow,
      windowY,
      Math.sin(ang) * radiusAtWindow,
    );
    // Window faces outward — lookAt the lathe axis at the same Y.
    win.lookAt(0, windowY, 0);
    g.add(win);
  }
  return g;
}

/** Decorative breach patches — small dark cuboids embedded just shy of
 *  the hull surface on the side flanks. Read as rusted-through holes
 *  exposing interior shadow. Random distribution avoiding the upper
 *  slice (which already has the real skylight gap). */
function makeBreachPatches(rand: Rng): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < Tuning.OPENING_WRECK_LATERAL_PUNCTURES; i++) {
    // Place on SIDE FLANKS. Under the parent group's X=+π/2 rotation,
    // lathe-local +X stays world +X (right flank) and lathe-local -X
    // stays world -X (left flank). So picking lathe-phi near 0 (= +X)
    // or π (= -X) lands the patch on a side flank that's neither
    // buried in the floor (which would be phi=π/2 → world -Y) nor
    // facing the open sky (phi=-π/2 → world +Y).
    const sideCenter = rand() < 0.5 ? 0 : Math.PI;
    const ang = sideCenter + (rand() - 0.5) * (Math.PI / 3); // ±30° around the flank center
    // Y range — mid-body (0.20 to 0.60 of HULL_LEN), keeping patches
    // away from the cockpit windows above and the tail rim below.
    const y = HULL_LEN * (0.20 + rand() * 0.40);
    const r = profileRadiusAt(y);
    const patch = new THREE.Mesh(
      new THREE.BoxGeometry(0.5 + rand() * 0.3, 0.4 + rand() * 0.25, 0.10),
      _breachMat,
    );
    patch.position.set(Math.cos(ang) * r, y, Math.sin(ang) * r);
    patch.lookAt(0, y, 0);
    g.add(patch);
  }
  return g;
}

/** Jagged torn-hull-plate fragments around the rear entrance rim.
 *  Each is a thin angled plate positioned just outside the lathe
 *  surface at y=0, angled randomly to suggest violent tearing. */
function makeEntranceFragments(rand: Rng): THREE.Group {
  const g = new THREE.Group();
  const r = R_TAIL_RIM;
  const fragCount = 7;
  for (let i = 0; i < fragCount; i++) {
    const ang = (i / fragCount) * Math.PI * 2 + rand() * 0.3;
    // Skip fragments that would block the entrance opening at the
    // bottom of the rim — the rim's circular profile in WRECK-LOCAL
    // X/Y space has its bottom at angle θ where sin(θ) is most
    // negative (sin(θ) < -0.3 → bottom ~110° arc). Keeping that band
    // clear gives the player an unobstructed walk-in path.
    if (Math.sin(ang) < -0.3) continue;
    const w = 0.35 + rand() * 0.45;
    const h = 0.25 + rand() * 0.35;
    const frag = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, 0.04),
      _rustDarkMat,
    );
    frag.position.set(
      Math.cos(ang) * (r + 0.05),
      Math.sin(ang) * (r + 0.05) + AXIS_Y,
      -HULL_LEN / 2 - 0.05,
    );
    // Tilt the fragment outward + sideways for chaotic torn-edge look.
    frag.rotation.z = ang + Math.PI / 2 + (rand() - 0.5) * 0.6;
    frag.rotation.y = (rand() - 0.5) * 0.5;
    frag.rotation.x = (rand() - 0.5) * 0.3;
    g.add(frag);
  }
  return g;
}

/** Salvage access panel — local copy of the dish/engineBlock pattern. */
function makeAccessPanel(): THREE.Group {
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

/** Interior props — ash pile + branch stubs (a long-dead campfire),
 *  tally marks on the cockpit interior wall, an empty canteen on the
 *  floor. */
function makeInteriorProps(rand: Rng): THREE.Group {
  const g = new THREE.Group();

  // Old ash pile + branch stubs near the back-center of the cavity
  // (between the entrance and the skeleton — where the previous
  // occupant kept a fire to stay warm).
  const ashPile = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.20, 0),
    _ashMat,
  );
  ashPile.position.set(0, 0.06, -0.4);
  ashPile.scale.set(1.5, 0.4, 1.5);
  g.add(ashPile);
  for (let i = 0; i < 3; i++) {
    const stub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.022, 0.32, 5),
      _branchMat,
    );
    const a = (i / 3) * Math.PI * 2 + rand() * 0.4;
    stub.position.set(
      Math.cos(a) * 0.24,
      0.08,
      -0.4 + Math.sin(a) * 0.24,
    );
    stub.rotation.z = Math.PI / 2 + Math.cos(a) * 0.6;
    stub.rotation.x = Math.sin(a) * 0.6;
    g.add(stub);
  }

  // Tally marks on the cockpit interior wall — just below the cockpit
  // window strip on the inside, where the previous occupant tallied
  // days. Anchored at the +Z end of the wreck, on a curved wall
  // approximated by a flat tangent plane at the tally Z.
  const tallyZ = HULL_LEN / 2 - 0.15;   // just inside the nose interior
  const tallyY = AXIS_Y + 0.2;           // chest-height inside the cockpit
  const tallyXOffset = 0.6;              // off-center to the left
  let totalMarks = 0;
  for (let cluster = 0; cluster < 4 && totalMarks < 17; cluster++) {
    const baseX = -tallyXOffset + cluster * 0.32;
    const inThisCluster = Math.min(5, 17 - totalMarks);
    for (let m = 0; m < Math.min(4, inThisCluster); m++) {
      const bar = new THREE.Mesh(
        new THREE.BoxGeometry(0.016, 0.20, 0.015),
        _scratchMat,
      );
      bar.position.set(baseX + m * 0.045, tallyY, tallyZ);
      g.add(bar);
      totalMarks++;
    }
    if (inThisCluster === 5) {
      const cross = new THREE.Mesh(
        new THREE.BoxGeometry(0.22, 0.016, 0.015),
        _scratchMat,
      );
      cross.position.set(baseX + 0.07, tallyY, tallyZ);
      cross.rotation.z = 0.45;
      g.add(cross);
      totalMarks++;
    }
  }

  // Empty canteen near the skeleton's eventual position — on the floor
  // tipped on its side. Skeleton placement is handled by openingScene.ts.
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
  canteen.position.set(-0.55, 0.10, HULL_LEN / 2 - 1.1);
  canteen.rotation.z = Math.PI / 2 - 0.3;
  canteen.rotation.y = 0.4;
  g.add(canteen);

  return g;
}

// ── Main mesh builder ────────────────────────────────────────────────

export function makeOpeningWreck(rand: Rng): THREE.Group {
  const g = new THREE.Group();

  // ── Lathe hull (sliced, with skylight gap) ──
  const hull = makeSlicedHull();
  // Lathe local axis = +Y. Rotation X=+π/2 sends local +Y → world +Z so
  // the wreck's length runs along world Z (rear at -Z, cockpit at +Z).
  // (R_x(+π/2): (x,y,z) → (x, -z, y); +Y maps to +Z, +Z maps to -Y, so
  // lathe-local UP (-Z direction) ends up at world +Y. Inside the lathe
  // sub-group, the SKYLIGHT_SLICE phi range is positioned at phi=270°
  // which corresponds to lathe-local -Z direction = world +Y after this
  // rotation — the gap really does point at the sky.)
  hull.rotation.x = Math.PI / 2;
  // Center the lathe on the wreck origin in Z: lathe Y from 0..HULL_LEN
  // becomes world Z from -HULL_LEN/2 .. +HULL_LEN/2 after this translate.
  hull.position.set(0, AXIS_Y, -HULL_LEN / 2);
  g.add(hull);

  // ── Cockpit windows (anchored on the lathe surface at the cockpit
  //    shoulder, world-Z translated to match the hull translation). ──
  const windows = makeCockpitWindows();
  windows.rotation.x = Math.PI / 2;
  windows.position.set(0, AXIS_Y, -HULL_LEN / 2);
  g.add(windows);

  // ── Lateral breach patches ──
  const breaches = makeBreachPatches(rand);
  breaches.rotation.x = Math.PI / 2;
  breaches.position.set(0, AXIS_Y, -HULL_LEN / 2);
  g.add(breaches);

  // ── Rust band wrap — a torus near the tail body for a panel-joint
  //    accent (echoes the crashedHull pattern). The torus default axis
  //    is +Z (its ring lies in the X-Y plane); since the wreck's length
  //    runs along wreck-local Z, no rotation is needed. ──
  const bandY = 0.22 * HULL_LEN;
  const bandR = profileRadiusAt(bandY) + 0.04;
  const band = new THREE.Mesh(
    new THREE.TorusGeometry(bandR, 0.10, 5, 20),
    _rustMat,
  );
  band.position.set(0, AXIS_Y, -HULL_LEN / 2 + bandY);
  g.add(band);

  // ── Floor slab — flat dark plank floor below the cavity. Narrower
  //    + shorter than the hull's outer extents so the curved walls
  //    visibly clip into it instead of the floor poking out past the
  //    hull silhouette. ──
  const floorLen = HULL_LEN - 1.2;          // inset from BOTH nose tip and rear opening
  const floorWidth = R_TAIL_BODY * 1.5;     // inside the narrowest waist
  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(floorWidth, FLOOR_THICK, floorLen),
    _floorMat,
  );
  floor.position.set(0, -FLOOR_THICK / 2, 0.1);  // slight forward shift toward cockpit
  g.add(floor);

  // ── Entrance fragments — jagged plates around the torn rim. ──
  g.add(makeEntranceFragments(rand));

  // ── Antenna stub on the upper cockpit hull, leaning forward. ──
  const stubLen = 1.4;
  const stubGeo = new THREE.CylinderGeometry(0.04, 0.06, stubLen, 6);
  stubGeo.translate(0, stubLen * 0.5, 0);   // D60 — anchor at foot
  const stub = new THREE.Mesh(stubGeo, _antennaMat);
  const stubLatheY = 0.72 * HULL_LEN;
  const stubR = profileRadiusAt(stubLatheY);
  // World position: lathe Y → world Z (translated); top of hull = +Y in lathe local
  // = -Z in lathe local under our X=-π/2 rotation. So the world-up point on the
  // hull surface at axial Z = stubLatheY - HULL_LEN/2 has world Y = AXIS_Y + stubR.
  stub.position.set(0, AXIS_Y + stubR - 0.05, stubLatheY - HULL_LEN / 2);
  stub.rotation.x = 0.18;  // lean slightly forward (toward +Z)
  g.add(stub);
  // Small crossbar near the top
  const crossbar = new THREE.Mesh(
    new THREE.BoxGeometry(0.45, 0.04, 0.04),
    _antennaMat,
  );
  crossbar.position.set(
    0,
    AXIS_Y + stubR - 0.05 + stubLen * 0.88,
    stubLatheY - HULL_LEN / 2 + Math.sin(0.18) * stubLen * 0.88,
  );
  g.add(crossbar);

  // ── Interior props ──
  g.add(makeInteriorProps(rand));

  // ── Salvage panels — refs are returned so placeOpeningWreck can
  //    register them. We mark them via userData so they can be found
  //    later via traverse. ──
  // Panel A — visible on the upper-rear hull, just behind the skylight
  // gap. Player approaching from outside sees it perched on the tail-
  // stub. Sits on top of the hull at the panel's axial Z. Panel B sits
  // at panelB-angle on the side flank — see below.
  const panelA = makeAccessPanel();
  const panelALatheY = 0.30 * HULL_LEN;
  const panelAR = profileRadiusAt(panelALatheY) + Tuning.SALVAGE_PANEL_SIZE_Z * 0.4;
  panelA.position.set(0, AXIS_Y + panelAR, panelALatheY - HULL_LEN / 2);
  panelA.userData.openingWreckPanel = 'A';
  g.add(panelA);

  // Panel B — recessed on the lower-side flank, mid-body. Suggests a
  // service hatch accessed from outside (player walks around the wreck).
  const panelBLatheY = 0.50 * HULL_LEN;
  const panelBR = profileRadiusAt(panelBLatheY);
  const panelBAng = Math.PI * 0.20;  // off-axis right flank
  const panelB = makeAccessPanel();
  panelB.position.set(
    Math.cos(panelBAng) * panelBR,
    AXIS_Y + Math.sin(panelBAng) * panelBR,
    panelBLatheY - HULL_LEN / 2,
  );
  panelB.lookAt(0, AXIS_Y, panelBLatheY - HULL_LEN / 2);
  panelB.userData.openingWreckPanel = 'B';
  g.add(panelB);

  // ── Shadow flags. Most meshes cast; the wreck interior breach
  //    patches don't (their job is to read as dark holes, not shadowy
  //    objects). ──
  g.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });

  return g;
}

// ── Placement + colliders ────────────────────────────────────────────

/**
 * Place the opening wreck at a world position with a Y-axis rotation.
 * Builds a fixed RAPIER body holding per-piece colliders that follow
 * the silhouette (curved walls approximated by 2 tilted boxes per
 * side + floor + cockpit cap; tail-stub rear end is open for entry).
 */
export function placeOpeningWreck(
  scene: THREE.Scene,
  world: RAPIER.World,
  _terrain: Terrain,
  pos: THREE.Vector3,
  yaw: number,
  rand: Rng,
  salvageables?: SalvageableRegistry,
): THREE.Group {
  const group = makeOpeningWreck(rand);
  group.position.copy(pos);
  group.rotation.y = yaw;
  scene.add(group);

  // Fixed body at the wreck origin, rotated by yaw.
  const bodyDesc = RAPIER.RigidBodyDesc.fixed()
    .setTranslation(pos.x, pos.y, pos.z)
    .setRotation({ x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) });
  const body = world.createRigidBody(bodyDesc);

  // ── Per-piece tilted colliders following the silhouette ──────────
  // Helper: take a wreck-local position + half-extents + a local rotation
  // (a THREE.Euler) and create a RAPIER box collider attached to the
  // single yaw-rotated body. The body's quaternion already encodes the
  // wreck's world yaw; collider rotations are in body-local space.
  const tmpQ = new THREE.Quaternion();
  const tmpE = new THREE.Euler();
  const addColl = (
    halfExtents: { x: number; y: number; z: number },
    localPos: { x: number; y: number; z: number },
    eulerXYZ?: { x?: number; y?: number; z?: number },
  ): void => {
    let rot: { x: number; y: number; z: number; w: number } = { x: 0, y: 0, z: 0, w: 1 };
    if (eulerXYZ) {
      tmpE.set(eulerXYZ.x ?? 0, eulerXYZ.y ?? 0, eulerXYZ.z ?? 0, 'XYZ');
      tmpQ.setFromEuler(tmpE);
      rot = { x: tmpQ.x, y: tmpQ.y, z: tmpQ.z, w: tmpQ.w };
    }
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(halfExtents.x, halfExtents.y, halfExtents.z)
        .setTranslation(localPos.x, localPos.y, localPos.z)
        .setRotation(rot),
      body,
    );
  };

  // (1) Floor slab — flat, covers the cavity.
  addColl(
    { x: R_COCKPIT * 0.85, y: FLOOR_THICK / 2, z: HULL_LEN / 2 - 0.2 },
    { x: 0, y: -FLOOR_THICK / 2, z: 0 },
  );

  // (2) Cockpit front cap — vertical wall sealing the nose end (+Z).
  // Player can't walk through the cockpit; they bump into this wall.
  addColl(
    { x: R_COCKPIT * 0.75, y: AXIS_Y * 0.8, z: 0.12 },
    { x: 0, y: AXIS_Y * 0.7, z: HULL_LEN / 2 - 0.05 },
  );

  // (3-6) Side walls — 2 tilted boxes per side approximating the
  // curved hull cross-section. Lower (vertical) + upper (angled inward
  // toward the ceiling). The rear (-Z) end is OPEN — colliders span
  // most of the length but stop short of the entrance.
  const sideHalfZ = HULL_LEN / 2 - 0.3;        // collider half-length
  const sideCenterZ = 0.1;                      // shifted slightly toward +Z so rear gap is wider
  for (const side of [-1, 1] as const) {
    // Lower wall — near-vertical, slight inward tilt at top via rot.z.
    addColl(
      { x: 0.08, y: AXIS_Y * 0.7, z: sideHalfZ },
      { x: side * (R_COCKPIT * 0.78), y: AXIS_Y * 0.55, z: sideCenterZ },
      { z: -side * 0.15 },
    );
    // Upper wall — angled inward more steeply, forms the curved roof.
    addColl(
      { x: 0.08, y: AXIS_Y * 0.55, z: sideHalfZ },
      { x: side * (R_COCKPIT * 0.45), y: AXIS_Y + R_COCKPIT * 0.55, z: sideCenterZ },
      { z: -side * 0.85 },
    );
  }

  // (7) Ceiling — flat plate at the top of the cavity, narrower than
  // the floor (the curved roof comes in toward the center).
  addColl(
    { x: R_COCKPIT * 0.35, y: 0.06, z: sideHalfZ },
    { x: 0, y: AXIS_Y + R_COCKPIT * 0.85, z: sideCenterZ },
  );

  // ── Register salvageables ─────────────────────────────────────────
  // Opening wreck reads as a "fuselage" salvage kind (matches the
  // shortName + loot table; gives 2-3 salvage rolls per panel). The
  // wreck was historically untagged because it's a story prop, but
  // user direction for Session RR explicitly requested salvage panels
  // — the narrative read becomes "the previous occupant cannibalized
  // some panels for parts before they died".
  if (salvageables) {
    group.traverse((o) => {
      const tag = o.userData.openingWreckPanel;
      if (tag === 'A' || tag === 'B') {
        o.updateWorldMatrix(true, false);
        const worldPos = new THREE.Vector3().setFromMatrixPosition(o.matrixWorld);
        registerSalvageable(salvageables, o, 'fuselage', worldPos, rand);
      }
    });
  }

  return group;
}
