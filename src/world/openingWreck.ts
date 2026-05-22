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
import type { GameContext } from '../GameContext.ts';
import { registerSalvageable } from './salvage.ts';
import { Tuning } from '../config/tuning.ts';
import { createRustedHullMaterial } from './hullMaterial.ts';

// ── Materials ───────────────────────────────────────────────────────
// Hull uses the procedural rust shader (Session OO) — vertical streaks
// down the flanks, sun bleach on the upper hull, panel-wear noise.
//
// AAJ — outer hull uses FrontSide (was DoubleSide in SS — read as
// paper-thin from inside the cavity). An inner shell at slightly
// smaller radius with BackSide material renders the interior wall
// as a separate surface. Together they give the hull actual thickness
// (visible at the entrance + skylight gap), with different exterior
// + interior materials.
const _hullMat = createRustedHullMaterial({
  baseColor: Tuning.WRECK_HULL_HEX,
  streakIntensity: 0.55,
});
_hullMat.side = THREE.FrontSide;
const _hullDarkMat = createRustedHullMaterial({
  baseColor: Tuning.WRECK_HULL_DARK_HEX,
  streakIntensity: 0.35,
});
_hullDarkMat.side = THREE.FrontSide;
// AAJ — interior wall material. Darker tone, flat shading, BackSide so
// it renders only from inside the cavity (where the player looks at the
// inner face of the inner shell, which faces inward = back side).
const _hullInteriorMat = new THREE.MeshLambertMaterial({
  color: Tuning.OPENING_WRECK_HULL_INTERIOR_HEX,
  side: THREE.BackSide,
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

// Session AAB godray refs removed in AAJ — the additive light cone read
// as unrealistic and didn't fit the tone. Natural lighting through the
// skylight slice gap is sufficient. updateOpeningWreckGodRay is now a
// no-op to preserve the main.ts import (deleting it would force a coupled
// main.ts change for no behavior gain).

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
const SKYLIGHT_WIDTH = Tuning.OPENING_WRECK_SKYLIGHT_WIDTH;
const FLOOR_THICK = Tuning.OPENING_WRECK_FLOOR_THICK;
const HULL_WALL_THICKNESS = Tuning.OPENING_WRECK_HULL_WALL_THICKNESS;

/** AAJ — inner-shell profile: same shape as PROFILE but radii reduced
 *  by HULL_WALL_THICKNESS. Computed lazily so we use the latest Tuning
 *  values. The taper at the nose tip + tail rim is preserved (radii
 *  clamped to 0). */
function makeInteriorProfile(): THREE.Vector2[] {
  const t = HULL_WALL_THICKNESS;
  return PROFILE.map((p) => new THREE.Vector2(Math.max(0, p.x - t), p.y));
}

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
  const interiorProfile = makeInteriorProfile();

  // Skip SKYLIGHT_WIDTH adjacent slices for the top stress-fracture gap.
  // AAM-followup #4: corrected the phi convention — Three.js LatheGeometry
  // uses x=R*sin(phi), z=R*cos(phi). So phi=π (slice 12) is the -Z direction
  // in lathe-local, which after the hull's X=+π/2 group rotation becomes
  // wreck-local +Y (= UP). Previous AAJ comments incorrectly assumed
  // phi=3π/2 was UP; resulting gaps were on the wreck's LEFT side. With
  // SKYLIGHT_SLICE=9 + WIDTH=6, omitted slices 9-14 = phi 135°-225° are
  // centered on phi=180° = true UP.
  for (let i = 0; i < SLICE_COUNT; i++) {
    if (i >= SKYLIGHT_SLICE && i < SKYLIGHT_SLICE + SKYLIGHT_WIDTH) continue;
    const phiStart = i * sliceArc;
    // Alternate hull / dark material so the slice seams read as panel
    // joints rather than disappearing into the curve. Even = base hull,
    // odd = dark hull.
    const mat = (i % 2 === 0) ? _hullMat : _hullDarkMat;
    const outerGeo = new THREE.LatheGeometry(PROFILE, 4, phiStart, sliceArc);
    const outerSlice = new THREE.Mesh(outerGeo, mat);
    g.add(outerSlice);
    // AAJ — inner shell at smaller radius with interior material. The
    // BackSide material renders only when viewed from inside the cavity.
    // Together with the FrontSide outer shell this gives the hull
    // visible wall thickness at the entrance + skylight openings.
    const innerGeo = new THREE.LatheGeometry(interiorProfile, 4, phiStart, sliceArc);
    const innerSlice = new THREE.Mesh(innerGeo, _hullInteriorMat);
    g.add(innerSlice);
  }

  return g;
}

/** Build the cockpit window strip — 3 thin dark boxes wrapped around
 *  the upper-FRONT-RIGHT of the hull, suggesting a broken canopy. Anchors
 *  on the hull radius at the cockpit shoulder (lathe Y = 0.78·HULL_LEN).
 *  AAM-followup #5: baseAng shifted from -π/2 (top-center) to -π/4
 *  (upper-right) so the windows live on the OPPOSITE side from the
 *  skylight gap, avoiding floating-window meshes where the hull is open. */
function makeCockpitWindows(): THREE.Group {
  const g = new THREE.Group();
  const windowY = 0.80 * HULL_LEN;
  const radiusAtWindow = profileRadiusAt(windowY);
  // 3 horizontal segments wrapped over the upper-right arc.
  // baseAng=-π/4 puts the center window at lathe phi=135° (upper-right
  // in wreck-local hull-group). The skylight gap occupies phi 165°-225°
  // (upper-left). Window arc (~±23°) lands at phi 112°-158°, fully
  // outside the skylight.
  const baseAng = -Math.PI / 4;
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
  // Session SS — was 7 evenly-distributed fragments which read as a
  // "saw-blade crown" around the rim rather than torn metal. Reduced
  // to 4 fragments clustered on the UPPER half + ONE side. AAJ — further
  // reduced to 2 because 4 read as "wings/fins" obscuring the entrance
  // from a head-on view, leading the player to think the wreck was sealed.
  // 2 fragments at the upper-rim still suggest torn metal without blocking
  // the visual line into the cavity.
  const fragCount = 2;
  // Bias the angles toward the upper-right of the rim (phi roughly
  // 0..π so cos > 0 ish): start each fragment at base angle 0..π
  // with light jitter. The bottom-skip below still applies.
  for (let i = 0; i < fragCount; i++) {
    // AAM-followup #5: shifted fragment angles to RIGHT-side only
    // (lathe phi ~60°-150°) so fragments don't sit in the skylight gap
    // (phi 165°-225°) where the rim ends and the fragment would float
    // without hull behind it.
    const ang = 0.15 + (i / fragCount) * (Math.PI * 0.55) + rand() * 0.3;
    // Skip fragments that would block the entrance opening at the
    // bottom of the rim — the rim's circular profile in WRECK-LOCAL
    // X/Y space has its bottom at angle θ where sin(θ) is most
    // negative (sin(θ) < -0.3 → bottom ~110° arc). Keeping that band
    // clear gives the player an unobstructed walk-in path.
    if (Math.sin(ang) < -0.3) continue;
    // Larger, more "plate-like" pieces. Smaller w + h gave a confetti
    // read; bigger plates read as actual torn hull sections.
    // AAJ — sized down (was 0.55+0.55w / 0.40+0.45h, now 0.40+0.35w /
    // 0.30+0.30h) so a head-on player view doesn't see the fragments
    // crowding the entrance silhouette.
    const w = 0.40 + rand() * 0.35;
    const h = 0.30 + rand() * 0.30;
    const frag = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, 0.05),
      _rustDarkMat,
    );
    frag.position.set(
      Math.cos(ang) * (r + 0.08),
      Math.sin(ang) * (r + 0.08) + AXIS_Y,
      -HULL_LEN / 2 - 0.05,
    );
    // Tilt the fragment outward + sideways for chaotic torn-edge look.
    frag.rotation.z = ang + Math.PI / 2 + (rand() - 0.5) * 0.8;
    frag.rotation.y = (rand() - 0.5) * 0.6;
    frag.rotation.x = (rand() - 0.5) * 0.4;
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

  // Tally marks — AAJ rework, refined post-AAM. Pre-AAJ these were on a
  // flat tangent plane that floated past the hull. AAJ moved them to a
  // side wall but used `markX = wallX + 0.02` which left a 2cm gap
  // between the mark and the inner shell — still floating, just by a
  // smaller amount. AAM-followup (this revision): (1) flip to the RIGHT
  // interior side wall per user direction, (2) place marks FLUSH with
  // the inner shell so the box geometry straddles the wall and reads
  // as engraved/scratched relief rather than a hovering icon.
  const tallyY = AXIS_Y + 0.10;          // just above wreck axis (chest-height)
  const tallyZStart = 1.55;              // just behind the skeleton (at z=1.95)
  const clusterZSpacing = 0.34;
  const markZSpacing = 0.05;
  const yOffsetFromAxis = tallyY - AXIS_Y;
  // AAM-followup #6: wallX is now computed PER-MARK (not per-cluster).
  // Pre-followup, all 5 marks in a cluster shared the wallX computed at
  // clusterZBase. But the hull radius shrinks significantly toward the
  // nose — between cluster 1 (Z=1.55, R≈1.48) and cluster 4 (Z=2.57,
  // R≈0.58) the wall pulls in ~90cm, and WITHIN cluster 4 the wall
  // curves another ~10cm across its 0.15m Z span. Marks at the end of
  // a cluster were floating up to 10cm inside the cavity. Fixing per-mark.
  const wallXAt = (markZ: number): number => {
    const latheY = markZ + HULL_LEN / 2;
    const rInner = Math.max(0.3, profileRadiusAt(latheY) - HULL_WALL_THICKNESS);
    return Math.sqrt(Math.max(0.01, rInner * rInner - yOffsetFromAxis * yOffsetFromAxis));
  };
  let totalMarks = 0;
  for (let cluster = 0; cluster < 4 && totalMarks < 17; cluster++) {
    const clusterZBase = tallyZStart + cluster * clusterZSpacing;
    const inThisCluster = Math.min(5, 17 - totalMarks);
    // RIGHT-side wall (local +X). Player enters from -X facing +X; after
    // the wreck's yaw=π/2 rotation, world-Z mapping puts local +X on
    // the player's RIGHT hand side as they walk in.
    for (let m = 0; m < Math.min(4, inThisCluster); m++) {
      const markZ = clusterZBase + m * markZSpacing;
      const bar = new THREE.Mesh(
        // X = depth into wall (thin), Y = vertical (tall), Z = spacing (thin)
        new THREE.BoxGeometry(0.015, 0.20, 0.016),
        _scratchMat,
      );
      bar.position.set(wallXAt(markZ), tallyY, markZ);
      g.add(bar);
      totalMarks++;
    }
    if (inThisCluster === 5) {
      // Crossing slash — diagonal across the 4 bars. Long axis = Z, tilted
      // around X axis so it slopes top-front to bottom-back across the bars.
      // Position at the midpoint of the 4 bars; per-Z wallX still applies.
      const crossZ = clusterZBase + markZSpacing * 1.5;
      const cross = new THREE.Mesh(
        new THREE.BoxGeometry(0.015, 0.016, 0.22),
        _scratchMat,
      );
      cross.position.set(wallXAt(crossZ), tallyY, crossZ);
      cross.rotation.x = 0.45;
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

  // ── AAM-followup — entrance ramp plate. A thin rust-dark plate just
  //    outside the rim, sloping from terrain level up to floor top.
  //    Plays as a "fallen hull panel that bridges to the entrance" —
  //    fixes the autostep blockage when outside terrain dips below the
  //    wreck floor's elevation. Collider added separately in
  //    placeOpeningWreck for the physics path. ──
  const rampLen = Tuning.OPENING_WRECK_RAMP_LEN_M;
  const rampDrop = Tuning.OPENING_WRECK_RAMP_DROP_M;
  const rampThick = Tuning.OPENING_WRECK_RAMP_THICK_M;
  const rampWidth = R_COCKPIT * 1.4;     // wider than entrance for visual cover
  const rampTilt = Math.atan2(rampDrop, rampLen); // inclination so outer end is rampDrop below inner end
  const rampCenterZ = -HULL_LEN / 2 + 0.05 - rampLen / 2; // inner edge at rim; extends -Z outward
  const rampCenterY = -rampDrop / 2 - rampThick / 2;       // inner edge top at Y=0, outer edge top at Y=-rampDrop
  const ramp = new THREE.Mesh(
    new THREE.BoxGeometry(rampWidth, rampThick, rampLen),
    _rustDarkMat,
  );
  ramp.position.set(0, rampCenterY, rampCenterZ);
  ramp.rotation.x = -rampTilt;           // tilt so the -Z end drops
  ramp.castShadow = true;
  ramp.receiveShadow = true;
  g.add(ramp);

  // ── Entrance fragments — jagged plates around the torn rim. ──
  g.add(makeEntranceFragments(rand));

  // ── AAJ — entrance rim torus. Closes the cross-section gap between
  //    the outer hull (at R_TAIL_RIM) and the inner shell (at
  //    R_TAIL_RIM - HULL_WALL_THICKNESS). Without this ring, looking
  //    into the entrance from outside, the gap between outer and inner
  //    edges renders as background (sky/terrain). The ring fills it,
  //    giving a clean torn-metal edge with visible thickness. ──
  const rimMajorR = R_TAIL_RIM - HULL_WALL_THICKNESS * 0.5;
  const rimMinorR = HULL_WALL_THICKNESS * 0.5;
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(rimMajorR, rimMinorR, 4, 24),
    _rustDarkMat,
  );
  // Position: entrance rim is at lathe Y=0 = world Z = -HULL_LEN/2.
  // Torus default ring is in XY plane (axis = +Z); since the hull's
  // length runs along world Z, that's already correct.
  rim.position.set(0, AXIS_Y, -HULL_LEN / 2);
  g.add(rim);

  // ── Antenna stub on the upper-RIGHT cockpit hull, tilted radially
  //    outward. AAM-followup #5: moved from top-center (was floating in
  //    the skylight gap after that gap shifted off-axis) to upper-right
  //    (lathe phi=135°). Now anchored on the same side as the cockpit
  //    windows + panel-A, opposite the skylight (which sits on the
  //    upper-LEFT at phi=195°). ──
  const stubLen = 1.4;
  const stubGeo = new THREE.CylinderGeometry(0.04, 0.06, stubLen, 6);
  stubGeo.translate(0, stubLen * 0.5, 0);   // D60 — anchor at foot
  const stub = new THREE.Mesh(stubGeo, _antennaMat);
  const stubLatheY = 0.72 * HULL_LEN;
  const stubR = profileRadiusAt(stubLatheY);
  // Anchor point: wreck-local upper-right at 45° off-axis. Lathe phi=135°
  // → wreck-local (sin*R, AXIS_Y - cos*R, _) → (0.707R, AXIS_Y + 0.707R, _).
  const stubCos = Math.cos(Math.PI / 4);   // 0.707
  stub.position.set(
    stubCos * stubR,
    AXIS_Y + stubCos * stubR - 0.05,
    stubLatheY - HULL_LEN / 2,
  );
  // Tilt the cylinder so it points radially outward (= upper-right at 45°).
  // Default cylinder is +Y; rotate around Z by -π/4 to align with the
  // outward direction in wreck-local XY plane.
  stub.rotation.z = -Math.PI / 4;
  g.add(stub);
  // Small crossbar near the top — follows the same radial direction.
  const crossbar = new THREE.Mesh(
    new THREE.BoxGeometry(0.45, 0.04, 0.04),
    _antennaMat,
  );
  const stubTipDist = stubLen * 0.88;
  crossbar.position.set(
    stubCos * stubR + stubCos * stubTipDist,
    AXIS_Y + stubCos * stubR - 0.05 + stubCos * stubTipDist,
    stubLatheY - HULL_LEN / 2,
  );
  crossbar.rotation.z = -Math.PI / 4;   // perpendicular to the antenna shaft
  g.add(crossbar);

  // ── Interior props ──
  g.add(makeInteriorProps(rand));

  // AAJ — AAB godray cone removed. Natural lighting via the skylight
  // slice gap is the read now; the explicit additive cone read as
  // unrealistic + theatrical.

  // ── Salvage panels — refs are returned so placeOpeningWreck can
  //    register them. We mark them via userData so they can be found
  //    later via traverse. ──
  // Panel A — visible on the upper-rear hull, just behind the skylight
  // gap. Player approaching from outside sees it perched on the tail-
  // stub. Sits on top of the hull at the panel's axial Z. Panel B sits
  // at panelB-angle on the side flank — see below.
  // AAM-followup #5: panel A moved from straight-up (lathe phi=180°) to
  // upper-right (lathe phi=135°, same side as antenna + windows) so it
  // doesn't float in the off-center skylight gap on the upper-LEFT.
  const panelA = makeAccessPanel();
  const panelALatheY = 0.30 * HULL_LEN;
  const panelAR = profileRadiusAt(panelALatheY) + Tuning.SALVAGE_PANEL_SIZE_Z * 0.4;
  const panelAAng = Math.PI * 0.25;     // 45° off-axis on the right flank (upper-right)
  panelA.position.set(
    Math.cos(panelAAng) * panelAR,
    AXIS_Y + Math.sin(panelAAng) * panelAR,
    panelALatheY - HULL_LEN / 2,
  );
  panelA.lookAt(0, AXIS_Y, panelALatheY - HULL_LEN / 2);
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

  // (1) Floor slab — flat, covers the cavity. AAJ: half-Z bumped from
  // (HULL_LEN/2 - 0.2) to (HULL_LEN/2 - 0.05) so the floor reaches all
  // the way to the entrance rim. Previous 0.2m gap meant the player
  // briefly stepped onto terrain between the rim and the floor, which
  // depending on terrain dips made entry feel sticky.
  addColl(
    { x: R_COCKPIT * 0.85, y: FLOOR_THICK / 2, z: HULL_LEN / 2 - 0.05 },
    { x: 0, y: -FLOOR_THICK / 2, z: 0 },
  );

  // (2) Cockpit front cap — vertical wall sealing the nose end (+Z).
  // Player can't walk through the cockpit; they bump into this wall.
  addColl(
    { x: R_COCKPIT * 0.75, y: AXIS_Y * 0.8, z: 0.12 },
    { x: 0, y: AXIS_Y * 0.7, z: HULL_LEN / 2 - 0.05 },
  );

  // (3-4) Side walls — AAM-followup #3: simplified to a single VERTICAL
  // wall per side, positioned at the inner shell radius so the player's
  // physical cavity matches what they SEE. Previous design (AAJ) used 2
  // tilted boxes per side (lower near-vertical, upper at ~49° tilt). The
  // upper tilt squeezed the cavity at head height to ±0.5m wide — player
  // capsule (0.35m radius) had only 15cm clearance per side. User reported
  // "too small to fit inside" with no visible blockage; the colliders
  // were tighter than the visual interior. Vertical walls at the inner
  // shell radius (R_COCKPIT - HULL_WALL_THICKNESS) give the player the
  // full cavity width they can see. Some headroom is lost at very high Y
  // (near the dome ceiling) but the silhouette at player height is correct.
  const sideHalfZ = HULL_LEN / 2 - 0.3;        // collider half-length (unchanged)
  const sideCenterZ = 0.1;                      // shifted slightly toward +Z so rear gap is wider (unchanged)
  const sideHalfY = (AXIS_Y + R_COCKPIT * 0.85) * 0.5; // wall extends floor → ceiling
  const sideCenterY = sideHalfY;                // bottom at Y=0 (floor top)
  const sideWallX = R_COCKPIT - HULL_WALL_THICKNESS; // flush with the inner hull shell
  for (const side of [-1, 1] as const) {
    addColl(
      { x: 0.08, y: sideHalfY, z: sideHalfZ },
      { x: side * sideWallX, y: sideCenterY, z: sideCenterZ },
    );
  }

  // (5) Ceiling — flat plate at the top of the cavity, narrower than
  // the floor (the curved roof comes in toward the center).
  addColl(
    { x: R_COCKPIT * 0.35, y: 0.06, z: sideHalfZ },
    { x: 0, y: AXIS_Y + R_COCKPIT * 0.85, z: sideCenterZ },
  );

  // (8) AAM-followup — entrance ramp collider. Matches the visible plate
  // added in makeOpeningWreck. Tilted box bridging outside terrain to
  // the floor edge. Half-extents + position mirror the mesh exactly.
  const rampLen = Tuning.OPENING_WRECK_RAMP_LEN_M;
  const rampDrop = Tuning.OPENING_WRECK_RAMP_DROP_M;
  const rampThick = Tuning.OPENING_WRECK_RAMP_THICK_M;
  const rampWidth = R_COCKPIT * 1.4;
  const rampTilt = Math.atan2(rampDrop, rampLen);
  const rampCenterZ = -HULL_LEN / 2 + 0.05 - rampLen / 2;
  const rampCenterY = -rampDrop / 2 - rampThick / 2;
  addColl(
    { x: rampWidth / 2, y: rampThick / 2, z: rampLen / 2 },
    { x: 0, y: rampCenterY, z: rampCenterZ },
    { x: -rampTilt },
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

/** AAJ — no-op. The AAB godray cone was removed; this stub keeps
 *  the export so main.ts's import doesn't need a coupled change. */
export function updateOpeningWreckGodRay(_ctx: GameContext): void {
  // intentionally empty
}
