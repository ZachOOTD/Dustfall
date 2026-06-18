// Wrecked satellite dish — flagship POI (Session KK). Large parabolic
// dish on a steel tripod, mounted on a hollow concrete base, half-
// reclaimed by the dunes. Designed to read as a destination from far
// across the map: tilted ~30° forward + 10° roll, ~20m total height,
// 16m-diameter dish with multiple missing panels exposing the radial
// framework underneath. Player can climb the base, enter a small
// sand-flooded interior shelter, and salvage two access panels.
//
// Heavy inspiration: Rust's satellite-dish monument, Arecibo
// post-collapse, abandoned Soviet radio telescopes. Visual cues:
//   - Rusted radial dish panels (some missing, exposed ribs underneath)
//   - Tilted gimbal at tripod apex
//   - Broken feed-arm assembly at the focal point
//   - Concrete pedestal with weathered tan-grey color
//   - One bent tripod leg (broken-mount story beat)
//   - Sand mound around the base + heavy bury so the structure feels
//     "settled in" rather than dropped on the surface

import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { Rng } from '../core/rng.ts';
import type { Terrain } from './terrain.ts';
import type { SalvageableRegistry } from './salvage.ts';
import { registerSalvageable } from './salvage.ts';
import { placeJournal, type Journal } from './journal.ts';
import { addAccessPanel } from './wrecks.ts';
import { mergeStaticByMaterial } from './wreckForms.ts';
import type { ShelterRegistry } from '../shelter/shelterZones.ts';
import { addShelterZone } from '../shelter/shelterZones.ts';
import { makeStaticBox, attachAabbCollider } from '../physics/bodies.ts';
import { createRustedHullMaterial } from './hullMaterial.ts';
import { createWeatheredConcreteMaterial } from './concreteMaterial.ts';
import { createMetalMaterial } from './metalMaterial.ts';

// ── Materials — local copies so we can keep the rusted/concrete
// palette here without polluting the generic wreck materials. ────────
// Session OO-2 — procedural concrete shader. Adds aggregate noise +
// mineral mottling + salt-leach efflorescence streaks (paler, low-
// bias) + edge grime. See concreteMaterial.ts for shader detail.
// Used by: base floor, roof, all 4 walls, north-wall lintel +
// segments, buttress columns, buttress caps, raised roof rim,
// collapsed roof chunks, recessed door frame, interior backstop,
// interior backstop, interior console + screen.
const _concreteMat = createWeatheredConcreteMaterial({
  baseColor: 0x8a7e68,       // weathered tan-grey concrete
});
const _concreteDarkMat = createWeatheredConcreteMaterial({
  baseColor: 0x5a4f3e,       // shadow / interior concrete
  leachIntensity: 0.30,      // interior surfaces stay drier — quieter streaks
});
// Session OO — procedural rust shader. Replaces the plain
// MeshLambertMaterial with one that adds vertical rust streaks on
// side-facing surfaces, panel wear patches, and sun-bleach on top
// surfaces. See hullMaterial.ts for the shader detail. Used by
// tripod struts, bent strut, exterior pipes + valves, feed horn,
// interior ladder rungs, and the LL exterior ladder rails + rungs.
const _rustedSteelMat = createRustedHullMaterial({
  baseColor: 0x6b3a22,       // saturated rust orange-brown
});
// AAL → ABO C4: panel materials were DoubleSide for the back-side viewing
// of the parabolic dish. ABO adds real structural framework backing struts
// (see _backingStrutMat + makeDishFramework backing struts), so back-side
// reads now come from the framework geometry — panels can drop to
// FrontSide. Reduces overdraw + sells "torn aluminium plate" depth from
// grazing angles. Backing struts use the ABH metalMaterial shader.
const _dishPanelMat = new THREE.MeshLambertMaterial({
  color: 0x7a4628,           // dish panel rust (mid)
  side: THREE.FrontSide,
  flatShading: true,
});
const _dishPanelDarkMat = new THREE.MeshLambertMaterial({
  color: 0x4a2818,           // darker patchwork panel
  side: THREE.FrontSide,
  flatShading: true,
});
const _dishPanelRustLight = new THREE.MeshLambertMaterial({
  color: 0x8a5a38,           // lighter orange-tan rust (sun-bleached)
  side: THREE.FrontSide,
  flatShading: true,
});
const _dishPanelRustEdge = new THREE.MeshLambertMaterial({
  color: 0x3a1e10,           // darker oxidized edge (deeply weathered)
  side: THREE.FrontSide,
  flatShading: true,
});
// ABO C4 — backing strut material (ABH metal shader): weathered iron
// reads as a real structural rib visible from the convex (back) dish side.
const _backingStrutMat = createMetalMaterial(0x4a3a2a, { wornScale: 8 });
const _frameMat = new THREE.MeshLambertMaterial({
  color: 0x2a1e14,           // dark exposed steel framework
  flatShading: true,
});
const _interiorBlackMat = new THREE.MeshBasicMaterial({
  color: 0x080604,            // pitch-dark interior wall (suggests depth past sand)
});
const _sandPileMat = new THREE.MeshLambertMaterial({
  color: 0xb89870,            // matches dune sand
  flatShading: true,
});
// Session ABA — _panelBodyMat / _panelRimMat removed. The legacy
// makeAccessPanel below has been migrated to addAccessPanel (from
// wrecks.ts) which gives panels hinged doors + interior detail +
// glow + AAU recess uniformly. The materials are now owned by
// wrecks.ts.

// Dimensions — tweak here if balancing.
const BASE_W = 8.0;            // concrete base width (X)
const BASE_D = 8.0;            // concrete base depth (Z)
const BASE_H = 5.0;            // total base height
const BASE_WALL_T = 0.6;       // wall thickness
const INTERIOR_W = BASE_W - BASE_WALL_T * 2;   // 6.8
const INTERIOR_H = 2.8;        // interior cavity height

const ENTRANCE_W = 1.8;
const ENTRANCE_H = 2.2;

const TRIPOD_R = 0.30;         // strut radius
const TRIPOD_APEX_Y = BASE_H + 11.0;   // pivot point Y in mesh-local space

const DISH_R = 8.0;            // 16m diameter
const DISH_DEPTH = 2.6;
const DISH_SEGMENTS = 12;      // radial panel segments
const MISSING_PANELS = [2, 7, 10]; // indices of removed panels (exposes framework)

// ── Helpers ──────────────────────────────────────────────────────────

/** Build a single radial dish panel covering one angular wedge of the
 *  parabolic surface. Uses LatheGeometry with a limited phiLength so
 *  each panel is a separate mesh (some can be omitted to read as
 *  "missing" from the wreck). */
function makeDishPanel(phiStart: number, phiLength: number, mat: THREE.Material): THREE.Mesh {
  const profile: THREE.Vector2[] = [];
  const segs = 8;
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    profile.push(new THREE.Vector2(t * DISH_R, t * t * DISH_DEPTH));
  }
  const geo = new THREE.LatheGeometry(profile, 4, phiStart, phiLength);
  return new THREE.Mesh(geo, mat);
}

/** Build the framework behind the dish: radial spokes + concentric
 *  rings. Visible where the panels are missing — sells the "wrecked"
 *  silhouette by exposing the dish skeleton. */
function makeDishFramework(): THREE.Group {
  const g = new THREE.Group();
  const RING_COUNT = 3;
  // Concentric rings (rusted iron bands holding the structure together)
  for (let r = 1; r <= RING_COUNT; r++) {
    const radius = (r / RING_COUNT) * DISH_R * 0.95;
    const depth = (radius / DISH_R) * (radius / DISH_R) * DISH_DEPTH;
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius, 0.08, 4, 24),
      _frameMat,
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = depth;
    g.add(ring);
  }
  // Radial spokes
  const SPOKE_COUNT = 16;
  for (let i = 0; i < SPOKE_COUNT; i++) {
    const phi = (i / SPOKE_COUNT) * Math.PI * 2;
    const profile: THREE.Vector2[] = [];
    const segs = 6;
    for (let s = 0; s <= segs; s++) {
      const t = s / segs;
      profile.push(new THREE.Vector2(t * DISH_R, t * t * DISH_DEPTH));
    }
    const len = DISH_R;
    // Use a thin box that follows the profile by approximating the
    // chord — for visibility purposes, a flat spoke from center to rim
    // reads fine even though the true profile is curved.
    const spoke = new THREE.Mesh(
      new THREE.BoxGeometry(0.10, 0.10, len),
      _frameMat,
    );
    spoke.position.set(Math.cos(phi) * len * 0.5, DISH_DEPTH * 0.5, Math.sin(phi) * len * 0.5);
    spoke.lookAt(Math.cos(phi) * len, DISH_DEPTH, Math.sin(phi) * len);
    g.add(spoke);
    void profile;  // (kept for future curved-spoke upgrade)
  }
  // ABO C4 — BACK-SIDE radial backing struts. 6 thicker box struts radiate
  // from the dish hub outward on the convex (back) side, sitting below the
  // parabolic profile by ~30cm so they read as real structural ribs holding
  // the dish from underneath. Visible from the convex approach + closes
  // the DoubleSide cheat. Same metal shader as future ABH applications.
  const BACK_STRUT_COUNT = 6;
  const BACK_STRUT_OFFSET = 0.30;          // metres below the dish profile
  for (let i = 0; i < BACK_STRUT_COUNT; i++) {
    const phi = (i / BACK_STRUT_COUNT) * Math.PI * 2 + Math.PI / BACK_STRUT_COUNT;  // half-offset from front spokes
    const strut = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.18, DISH_R * 0.95),
      _backingStrutMat,
    );
    // Place at half-radius / mid-back position. The dish's convex back
    // faces -Y at the dish profile (profile heights are +Y, so subtract
    // BACK_STRUT_OFFSET to sit "under" the dish from the convex side).
    strut.position.set(
      Math.cos(phi) * DISH_R * 0.5,
      -BACK_STRUT_OFFSET + DISH_DEPTH * 0.25,
      Math.sin(phi) * DISH_R * 0.5,
    );
    strut.lookAt(Math.cos(phi) * DISH_R, -BACK_STRUT_OFFSET, Math.sin(phi) * DISH_R);
    g.add(strut);
  }
  // Central back hub — short cylinder centred at dish back, mirrors the
  // feed-arm mount on the convex side. Reads as the dish's structural
  // attachment point.
  const backHub = new THREE.Mesh(
    new THREE.CylinderGeometry(DISH_R * 0.18, DISH_R * 0.22, 0.30, 12),
    _backingStrutMat,
  );
  backHub.position.y = -BACK_STRUT_OFFSET - 0.05;
  g.add(backHub);
  return g;
}

// Session ABA — legacy `makeAccessPanel` helper deleted. The two panel
// callsites (basePanel, dishPanel) now use addAccessPanel from
// wrecks.ts which gives them hinged doors + interior detail + glow +
// AAU recess uniformly with all other salvage panels in the world.
// Wrapper-Group pattern: each callsite constructs an empty Group +
// calls addAccessPanel(wrapper, 0, 0, 0, 1, 0, kind), then positions
// + rotates the wrapper. The wrapper's local +Z is the panel's
// outward direction; addAccessPanel recesses the body INTO -Z so the
// front face sits at the wrapper's origin (flush with the hull
// surface).

// ── Main entry ───────────────────────────────────────────────────────

export function placeSatelliteDish(
  scene: THREE.Scene,
  world: RAPIER.World,
  terrain: Terrain,
  pos: THREE.Vector3,
  rand: Rng,
  shelter: ShelterRegistry,
  salvageables?: SalvageableRegistry,
  journals?: { list: Journal[] },
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'satelliteDish';   // so the `flagship` rig-shot can find + frame it
  // Bury offset — base sits 1.0m below ground so the doorway opening
  // (cut from y_local -1.9 to +0.3) is mostly above grade — its sill
  // sits 0.4m below terrain, so the player steps DOWN through the
  // doorway into the interior. KK shipped with BURY_Y=2.5 which read
  // as "settled in dunes" visually but trapped the entrance 1.9m
  // underground (interior unreachable from outside). 1.0m bury + the
  // PITCH/ROLL tilt still sells "settled in the desert" while keeping
  // entry usable. Going much shallower would expose a high-tilt corner
  // of the base floating above terrain.
  const BURY_Y = 1.0;
  // Whole-structure tilt — sells "sinking into the sand" feel.
  const PITCH = 0.18 + rand() * 0.05;
  const ROLL = 0.10 + rand() * 0.04;

  // ── 1. Concrete base — 4 walls + roof + floor, with an entrance gap
  // in the -Z (north) wall. Modeled as separate boxes so we can leave
  // a hole and so each piece becomes its own collider. ──
  const baseAnchorY = BASE_H * 0.5 - BURY_Y;  // base center y after bury

  const baseGroup = new THREE.Group();

  // Floor (full footprint)
  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(BASE_W, BASE_WALL_T, BASE_D),
    _concreteDarkMat,
  );
  floor.position.y = -BASE_H * 0.5 + BASE_WALL_T * 0.5;
  baseGroup.add(floor);

  // Roof (walkable top — player can climb onto it)
  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(BASE_W, BASE_WALL_T, BASE_D),
    _concreteMat,
  );
  roof.position.y = BASE_H * 0.5 - BASE_WALL_T * 0.5;
  baseGroup.add(roof);

  // South wall (+Z) — full
  const sWall = new THREE.Mesh(
    new THREE.BoxGeometry(BASE_W, BASE_H - BASE_WALL_T * 2, BASE_WALL_T),
    _concreteMat,
  );
  sWall.position.set(0, 0, BASE_D * 0.5 - BASE_WALL_T * 0.5);
  baseGroup.add(sWall);

  // East wall (+X) — full
  const eWall = new THREE.Mesh(
    new THREE.BoxGeometry(BASE_WALL_T, BASE_H - BASE_WALL_T * 2, BASE_D - BASE_WALL_T * 2),
    _concreteMat,
  );
  eWall.position.set(BASE_W * 0.5 - BASE_WALL_T * 0.5, 0, 0);
  baseGroup.add(eWall);

  // West wall (-X) — full
  const wWall = new THREE.Mesh(
    new THREE.BoxGeometry(BASE_WALL_T, BASE_H - BASE_WALL_T * 2, BASE_D - BASE_WALL_T * 2),
    _concreteMat,
  );
  wWall.position.set(-BASE_W * 0.5 + BASE_WALL_T * 0.5, 0, 0);
  baseGroup.add(wWall);

  // North wall (-Z) — split into 3 boxes leaving an entrance hole.
  // Left segment
  const nWallSide = (BASE_W - ENTRANCE_W) * 0.5;
  const nWallL = new THREE.Mesh(
    new THREE.BoxGeometry(nWallSide, BASE_H - BASE_WALL_T * 2, BASE_WALL_T),
    _concreteMat,
  );
  nWallL.position.set(-(BASE_W * 0.5 - nWallSide * 0.5), 0, -BASE_D * 0.5 + BASE_WALL_T * 0.5);
  baseGroup.add(nWallL);
  // Right segment
  const nWallR = new THREE.Mesh(
    new THREE.BoxGeometry(nWallSide, BASE_H - BASE_WALL_T * 2, BASE_WALL_T),
    _concreteMat,
  );
  nWallR.position.set((BASE_W * 0.5 - nWallSide * 0.5), 0, -BASE_D * 0.5 + BASE_WALL_T * 0.5);
  baseGroup.add(nWallR);
  // Lintel above the entrance (header)
  const lintelH = BASE_H - BASE_WALL_T * 2 - ENTRANCE_H;
  const lintel = new THREE.Mesh(
    new THREE.BoxGeometry(ENTRANCE_W, lintelH, BASE_WALL_T),
    _concreteMat,
  );
  lintel.position.set(0, BASE_H * 0.5 - BASE_WALL_T - lintelH * 0.5, -BASE_D * 0.5 + BASE_WALL_T * 0.5);
  baseGroup.add(lintel);

  // ── Base detail — KK-2 — breaking up the flat-cube silhouette ───
  // Corner buttress columns — 4 octagonal-feeling concrete pillars
  // standing slightly proud of each corner, running floor → roof.
  // They read as "this isn't just a box, it's a real engineered
  // structure" and they add silhouette interest from any angle.
  const buttressR = 0.55;
  const buttressH = BASE_H + 0.6;        // pokes 0.3m above the roof
  const buttressOffset = BASE_W * 0.5 - buttressR * 0.6;
  for (const [bx, bz] of [
    [-buttressOffset, -buttressOffset],
    [ buttressOffset, -buttressOffset],
    [-buttressOffset,  buttressOffset],
    [ buttressOffset,  buttressOffset],
  ] as Array<[number, number]>) {
    const col = new THREE.Mesh(
      new THREE.CylinderGeometry(buttressR, buttressR * 1.15, buttressH, 8),
      _concreteMat,
    );
    col.position.set(bx, 0, bz);
    baseGroup.add(col);
    // A small chamfered cap on top of each buttress.
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(buttressR * 1.1, buttressR * 0.9, 0.25, 8),
      _concreteDarkMat,
    );
    cap.position.set(bx, BASE_H * 0.5 + 0.15, bz);
    baseGroup.add(cap);
  }

  // Raised roof rim — a thin lip running around the perimeter of the
  // roof. Stops the roof reading as "flat plate" and gives the player
  // a visible edge to navigate when climbing on top.
  const rimT = 0.25;
  const rimH = 0.35;
  const rimYTop = BASE_H * 0.5 + rimH * 0.5;
  // South + North rim bars
  for (const rz of [-BASE_D * 0.5 + rimT * 0.5, BASE_D * 0.5 - rimT * 0.5]) {
    const rimBar = new THREE.Mesh(
      new THREE.BoxGeometry(BASE_W, rimH, rimT),
      _concreteDarkMat,
    );
    rimBar.position.set(0, rimYTop, rz);
    baseGroup.add(rimBar);
  }
  // East + West rim bars
  for (const rx of [-BASE_W * 0.5 + rimT * 0.5, BASE_W * 0.5 - rimT * 0.5]) {
    const rimBar = new THREE.Mesh(
      new THREE.BoxGeometry(rimT, rimH, BASE_D - rimT * 2),
      _concreteDarkMat,
    );
    rimBar.position.set(rx, rimYTop, 0);
    baseGroup.add(rimBar);
  }

  // Collapsed roof corner — break the +X / +Z corner of the rim so
  // one section reads as "damaged, fell in years ago." Replaces a
  // small portion of the rim with a chunk dropped at an angle on the
  // roof itself.
  const collapsed = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 0.4, 1.6),
    _concreteDarkMat,
  );
  collapsed.position.set(BASE_W * 0.5 - 1.1, BASE_H * 0.5 + 0.2, BASE_D * 0.5 - 1.1);
  collapsed.rotation.set(0.3, 0.5, 0.2);
  baseGroup.add(collapsed);
  // A smaller chunk that fell off and lies further inboard
  const chunk2 = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 0.3, 0.8),
    _concreteDarkMat,
  );
  chunk2.position.set(BASE_W * 0.5 - 2.5, BASE_H * 0.5 + 0.15, BASE_D * 0.5 - 2.0);
  chunk2.rotation.set(0, 0.8, 0.1);
  baseGroup.add(chunk2);

  // Recessed door frame around the entrance — a darker box sitting
  // just inside the entrance opening that reads as a frame / weather
  // seal. Adds depth to the entrance silhouette.
  const doorFrameT = 0.18;
  // Top piece
  const frameTop = new THREE.Mesh(
    new THREE.BoxGeometry(ENTRANCE_W + doorFrameT * 2, doorFrameT, doorFrameT),
    _concreteDarkMat,
  );
  frameTop.position.set(0, -BASE_H * 0.5 + BASE_WALL_T + ENTRANCE_H - doorFrameT * 0.5, -BASE_D * 0.5 + BASE_WALL_T * 0.5);
  baseGroup.add(frameTop);
  // Left + right vertical jambs
  for (const fx of [-ENTRANCE_W * 0.5 - doorFrameT * 0.5, ENTRANCE_W * 0.5 + doorFrameT * 0.5]) {
    const jamb = new THREE.Mesh(
      new THREE.BoxGeometry(doorFrameT, ENTRANCE_H, doorFrameT),
      _concreteDarkMat,
    );
    jamb.position.set(fx, -BASE_H * 0.5 + BASE_WALL_T + ENTRANCE_H * 0.5, -BASE_D * 0.5 + BASE_WALL_T * 0.5);
    baseGroup.add(jamb);
  }

  // A few exterior side-pipes — rusted conduits running up the +X
  // wall, capped with valve wheels. Reads as "this was a serviced
  // facility."
  for (let i = 0; i < 3; i++) {
    const pipe = new THREE.Mesh(
      new THREE.CylinderGeometry(0.10, 0.10, BASE_H * 0.85, 5),
      _rustedSteelMat,
    );
    pipe.position.set(
      BASE_W * 0.5 + 0.15,
      0,
      -BASE_D * 0.3 + i * BASE_D * 0.3,
    );
    baseGroup.add(pipe);
    // Small valve handle near the top — sits flush on the pipe surface
    // (pipe X = BASE_W*0.5 + 0.15, valve X = pipe X + 0.10 so it just
    // protrudes off the pipe instead of floating in space beside it).
    const valve = new THREE.Mesh(
      new THREE.TorusGeometry(0.18, 0.05, 4, 8),
      _rustedSteelMat,
    );
    valve.position.set(
      BASE_W * 0.5 + 0.25,
      BASE_H * 0.3,
      -BASE_D * 0.3 + i * BASE_D * 0.3,
    );
    valve.rotation.y = Math.PI / 2;
    baseGroup.add(valve);
  }

  // Interior darkness backstop — a black box just inside the entrance
  // so the interior reads as deep + suggesting unseen space past the sand.
  const interiorBackstop = new THREE.Mesh(
    new THREE.BoxGeometry(INTERIOR_W * 0.9, INTERIOR_H * 0.9, BASE_WALL_T * 0.5),
    _interiorBlackMat,
  );
  interiorBackstop.position.set(0, -BASE_H * 0.5 + BASE_WALL_T + INTERIOR_H * 0.5, BASE_D * 0.5 - BASE_WALL_T * 1.5);
  baseGroup.add(interiorBackstop);

  // ── Interior props — KK-2 — makes the room feel like a real
  // operations cabin instead of an empty concrete box. Everything
  // sits on the walkable strip near the entrance (between the
  // entrance and the sand pile).
  // Broken console — small angled box on the floor, knocked over.
  const consoleBody = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 0.7, 0.8),
    _rustedSteelMat,
  );
  consoleBody.position.set(
    -INTERIOR_W * 0.35,
    -BASE_H * 0.5 + BASE_WALL_T + 0.35,
    -BASE_D * 0.5 + BASE_WALL_T + 1.4,
  );
  consoleBody.rotation.set(0.1, 0.6, 0.18);
  baseGroup.add(consoleBody);
  // A monitor screen on top of the console (broken / dark)
  const consoleScreen = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 0.5, 0.08),
    _frameMat,
  );
  consoleScreen.position.set(
    -INTERIOR_W * 0.35 + 0.05,
    -BASE_H * 0.5 + BASE_WALL_T + 0.95,
    -BASE_D * 0.5 + BASE_WALL_T + 1.1,
  );
  consoleScreen.rotation.set(0.4, 0.6, 0.18);
  baseGroup.add(consoleScreen);

  // Ladder rungs on the east interior wall — short stack going up,
  // suggests there used to be roof access. 5 rungs, evenly spaced.
  for (let i = 0; i < 5; i++) {
    const rung = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 0.45, 5),
      _rustedSteelMat,
    );
    rung.position.set(
      BASE_W * 0.5 - BASE_WALL_T - 0.10,
      -BASE_H * 0.5 + BASE_WALL_T + 0.4 + i * 0.45,
      -BASE_D * 0.5 + BASE_WALL_T + 1.0,
    );
    rung.rotation.z = Math.PI / 2;
    baseGroup.add(rung);
  }

  // Exposed ceiling pipes — 2 pipes running along the +X to -X axis
  // just under the roof, capped at the wall ends.
  for (let i = 0; i < 2; i++) {
    const pipe = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.12, INTERIOR_W - 0.2, 6),
      _rustedSteelMat,
    );
    pipe.position.set(
      0,
      BASE_H * 0.5 - BASE_WALL_T - 0.25,
      -BASE_D * 0.5 + BASE_WALL_T + 0.5 + i * 0.6,
    );
    pipe.rotation.z = Math.PI / 2;
    baseGroup.add(pipe);
  }

  // Hanging lantern — warm dim PointLight + small emissive prop so the
  // interior reads as a livable shelter at night and in the dim diurnal
  // doorway shadow. Placed back-upper corner so its glow throws across
  // the sand pile and walls without spotlighting the player's path.
  // Intensity/range deliberately half of fire (which is PointLight at
  // 1.3 intensity, 8m range) — fire is hearth-bright, this is a
  // hold-over emergency lantern. No flicker (low cost; lantern, not
  // flame).
  const lanternX = INTERIOR_W * 0.32;                              // off-center toward east
  const lanternY = -BASE_H * 0.5 + BASE_WALL_T + INTERIOR_H - 0.55; // just below ceiling
  const lanternZ = BASE_D * 0.5 - BASE_WALL_T - 0.6;               // pinned to back wall
  const lanternLight = new THREE.PointLight(0xffa844, 0.6, 6);
  lanternLight.position.set(lanternX, lanternY, lanternZ);
  lanternLight.castShadow = false;                                 // perf — small interior, shadowless is fine
  baseGroup.add(lanternLight);
  // Emissive lantern body — a small glowing box at the light's source so
  // the player sees WHERE the light is coming from (otherwise it reads
  // as ambient warmth with no source).
  const lanternBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.22, 0.18),
    new THREE.MeshBasicMaterial({ color: 0xffc266 }),
  );
  lanternBody.position.set(lanternX, lanternY, lanternZ);
  baseGroup.add(lanternBody);
  // A short steel hanger from the ceiling down to the lantern.
  const lanternHanger = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.02, 0.30, 4),
    _frameMat,
  );
  lanternHanger.position.set(lanternX, lanternY + 0.26, lanternZ);
  baseGroup.add(lanternHanger);

  // Sand pile piled against the back wall — leaves a much larger
  // walkable strip near the entrance so the player can actually move
  // around inside. KK-2 — was 5.2m deep × 1.96m tall (only 1.6m
  // walkable, felt like a blocked closet); now 3m deep × 1.6m tall
  // (3.8m × 6.8m walkable area = a proper room).
  const sandPileLen = 3.0;
  const sandPileH = INTERIOR_H * 0.55;
  const sandPile = new THREE.Mesh(
    new THREE.BoxGeometry(INTERIOR_W, sandPileH, sandPileLen),
    _sandPileMat,
  );
  sandPile.position.set(
    0,
    -BASE_H * 0.5 + BASE_WALL_T + sandPileH * 0.5,
    BASE_D * 0.5 - BASE_WALL_T - sandPileLen * 0.5,
  );
  baseGroup.add(sandPile);

  // Sand-slope wedge — a tilted box riding the front edge of the pile
  // so the dune SLOPES from floor up to the pile top, instead of
  // hitting the player as a vertical wall. Purely visual; the collider
  // box for the main pile already keeps the player from going further.
  const sandSlopeLen = 1.4;
  const sandSlope = new THREE.Mesh(
    new THREE.BoxGeometry(INTERIOR_W, sandPileH, sandSlopeLen),
    _sandPileMat,
  );
  sandSlope.position.set(
    0,
    -BASE_H * 0.5 + BASE_WALL_T + sandPileH * 0.5,
    BASE_D * 0.5 - BASE_WALL_T - sandPileLen - sandSlopeLen * 0.5,
  );
  // Pivot the slope around its top-back edge so the front falls toward
  // the floor — the back edge stays flush with the main pile face.
  sandSlope.rotation.x = -0.6;  // tilts the front down toward the floor
  // Lower it slightly so the front edge sinks below the floor (the
  // floor mesh will clip it cleanly).
  sandSlope.position.y -= 0.35;
  baseGroup.add(sandSlope);

  // Exterior climbing ladder — leans against the +X (east) wall at 45°,
  // foot at terrain level, top punching just above the roof rim so the
  // player can step onto the roof. Without this, KK's dish-back salvage
  // panel was unreachable. The ladder is purely a visual — the actual
  // climbable surface is a tilted box collider added below alongside
  // the roof + wall colliders.
  // Geometry coords are in baseGroup-local space. Terrain world Y =
  // group.position.y + baseAnchorY + Y_local. So terrain corresponds to
  // baseGroup-local Y = -baseAnchorY. Ladder sub-group is rotated Z by
  // -45° so its local +X axis points from rim-top DOWN to the sand foot.
  const rampAngle = Math.PI / 4;                       // 45°, under controller's 50° max slope
  const rampTopX = BASE_W * 0.5 - 0.15;                // 0.15m inboard of east roof edge
  const rampTopY = BASE_H * 0.5;                       // = roof top face (baseGroup-local Y)
  const rampFootY = -baseAnchorY;                       // terrain in baseGroup-local Y
  const rampRise = rampTopY - rampFootY;                // total Y rise (= BASE_H/2 + baseAnchorY)
  const rampFootX = rampTopX + rampRise;                // 45° → horizontal run = rise
  const rampLen = rampRise * Math.SQRT2;
  const rampMidX = (rampTopX + rampFootX) * 0.5;
  const rampMidY = (rampFootY + rampTopY) * 0.5;
  const ladderGroup = new THREE.Group();
  ladderGroup.position.set(rampMidX, rampMidY, 0);
  ladderGroup.rotation.z = -rampAngle;                 // local +X → (+cos,−sin,0) = down-the-slope
  // Two parallel rails along local +X.
  const railR = 0.06;
  for (const dz of [-0.25, 0.25]) {
    const rail = new THREE.Mesh(
      new THREE.CylinderGeometry(railR, railR, rampLen, 5),
      _rustedSteelMat,
    );
    rail.rotation.z = Math.PI / 2;                     // cylinder default Y axis → local +X
    rail.position.set(0, 0, dz);
    ladderGroup.add(rail);
  }
  // Rungs evenly spaced along the rail at ~0.32m centers so the spacing
  // reads as a real ladder regardless of overall ramp length.
  const rungCount = Math.max(8, Math.round(rampLen / 0.32));
  for (let i = 0; i < rungCount; i++) {
    const t = (i + 0.5) / rungCount;
    const xLocal = (t - 0.5) * rampLen;
    const rung = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 0.55, 5),
      _rustedSteelMat,
    );
    rung.rotation.x = Math.PI / 2;                     // cylinder Y axis → local +Z
    rung.position.set(xLocal, 0, 0);
    ladderGroup.add(rung);
  }
  baseGroup.add(ladderGroup);

  baseGroup.position.y = baseAnchorY;
  group.add(baseGroup);

  // ── 2. Tripod struts — 3 angled steel legs from the base top
  // corners up to the dish-mount apex. One is bent/broken.
  const apexY = TRIPOD_APEX_Y - BURY_Y;
  const baseTopY = BASE_H - BURY_Y;
  const tripodFootR = BASE_W * 0.40;  // radius at base where the feet plant

  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + Math.PI / 2;  // first leg in -Z direction
    const footX = Math.cos(a) * tripodFootR;
    const footZ = Math.sin(a) * tripodFootR;
    const footY = baseTopY;
    const dx = -footX, dy = apexY - footY, dz = -footZ;
    const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const strut = new THREE.Mesh(
      new THREE.CylinderGeometry(TRIPOD_R * 0.9, TRIPOD_R, len, 6),
      _rustedSteelMat,
    );
    strut.position.set(footX * 0.5, (footY + apexY) * 0.5, footZ * 0.5);
    const up = new THREE.Vector3(0, 1, 0);
    const dir = new THREE.Vector3(dx, dy, dz).normalize();
    strut.quaternion.setFromUnitVectors(up, dir);
    group.add(strut);

    // Cross-brace half-way up between this leg and the next
    if (i < 3) {
      const aNext = ((i + 1) / 3) * Math.PI * 2 + Math.PI / 2;
      const midA = (a + aNext) * 0.5;
      const midR = tripodFootR * 0.65;
      const midX = Math.cos(midA) * midR;
      const midZ = Math.sin(midA) * midR;
      const braceY = baseTopY + (apexY - baseTopY) * 0.55;
      // Span between this leg's midpoint and next leg's midpoint —
      // approximate using a single strut centered between the legs.
      const aFootNextX = Math.cos(aNext) * tripodFootR;
      const aFootNextZ = Math.sin(aNext) * tripodFootR;
      const adx = aFootNextX - footX;
      const adz = aFootNextZ - footZ;
      const brace = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.12, Math.sqrt(adx * adx + adz * adz) * 0.85, 5),
        _frameMat,
      );
      brace.position.set(midX, braceY, midZ);
      const bDir = new THREE.Vector3(adx, 0, adz).normalize();
      brace.quaternion.setFromUnitVectors(up, bDir);
      group.add(brace);
    }
  }

  // Bent / broken extra strut anchored at the FIRST tripod leg's foot
  // (i=0 leg foot was at angle Math.PI/2 → world -Z direction from
  // base center). KK-3 — proper anchor via geometry.translate(0,
  // halfL, 0). After translating the geo, the cylinder's origin (and
  // hence rotation pivot) is at its BOTTOM end. Then any rotation
  // around the mesh origin pivots the strut around that anchor point,
  // keeping the foot end firmly at (footX1, baseTopY, footZ1).
  const bentLen = 4 + rand() * 1.5;
  const bentGeo = new THREE.CylinderGeometry(TRIPOD_R * 0.6, TRIPOD_R * 0.7, bentLen, 5);
  bentGeo.translate(0, bentLen * 0.5, 0);   // anchor at bottom
  const bent = new THREE.Mesh(bentGeo, _rustedSteelMat);
  const footX1 = 0;
  const footZ1 = -tripodFootR;
  bent.position.set(footX1, baseTopY, footZ1);
  bent.rotation.set(0.7 + rand() * 0.3, rand() * Math.PI * 2, 0.4);
  group.add(bent);

  // ── 3. Dish mount / yoke at the tripod apex ──────────────────────
  // KK-2 — yoke is taller (1.2 instead of 0.8) so its top reaches up
  // to where the dish pivot sits; this eliminates the visible gap
  // between yoke and dish.
  const yoke = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 1.2, 1.8),
    _frameMat,
  );
  yoke.position.y = apexY;
  group.add(yoke);

  // ── 4. Parabolic dish — DISH_SEGMENTS radial panels around the
  // axis, with MISSING_PANELS skipped to expose the framework. KK-2
  // — dishPivot sits AT apexY (was apexY + 0.4) so the dish-back
  // sits flush against the yoke top with no gap.
  const dishPivot = new THREE.Group();
  dishPivot.position.y = apexY;
  // The dish is sharply tilted forward + slight roll — looks like it
  // collapsed forward off its mount over the decades. Local +Y is the
  // dish's outward axis (its "aim direction").
  dishPivot.rotation.set(-Math.PI * 0.32, 0, 0.18);

  for (let i = 0; i < DISH_SEGMENTS; i++) {
    if (MISSING_PANELS.includes(i)) continue;
    const phi = (i / DISH_SEGMENTS) * Math.PI * 2;
    const length = (2 * Math.PI) / DISH_SEGMENTS;
    // Rotate through 4 rust shades so adjacent panels read as patched-up
    // mismatched repairs — sun-bleached / mid-rust / dark-rust / heavily
    // oxidized edge. Cycles `i % 4` (was `i % 2` — flat 2-tone read).
    const panelMats = [_dishPanelMat, _dishPanelRustLight, _dishPanelDarkMat, _dishPanelRustEdge];
    const mat = panelMats[i % 4];
    dishPivot.add(makeDishPanel(phi, length, mat));
  }

  // Framework rib + spokes (visible through missing panels)
  dishPivot.add(makeDishFramework());

  // Feed horn assembly at the focal point
  const focalDist = (DISH_R * DISH_R) / (4 * DISH_DEPTH);
  const feedHorn = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 0.55, 1.2, 8),
    _rustedSteelMat,
  );
  feedHorn.position.y = focalDist;
  dishPivot.add(feedHorn);
  // Three feed arms (one broken — only two visible)
  for (let i = 0; i < 2; i++) {
    const ang = (i / 3) * Math.PI * 2;
    const armDx = Math.cos(ang) * DISH_R * 0.92;
    const armDz = Math.sin(ang) * DISH_R * 0.92;
    const armDy = DISH_DEPTH - focalDist;
    const armLen = Math.sqrt(armDx * armDx + armDy * armDy + armDz * armDz);
    const arm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, armLen, 4),
      _frameMat,
    );
    arm.position.set(armDx * 0.5, focalDist + armDy * 0.5, armDz * 0.5);
    const aUp = new THREE.Vector3(0, 1, 0);
    const aDir = new THREE.Vector3(armDx, armDy, armDz).normalize();
    arm.quaternion.setFromUnitVectors(aUp, aDir);
    dishPivot.add(arm);
  }
  // Broken third arm — anchored AT the feed horn (focal point) and
  // dangling outward + downward like a snapped support cable. KK-3 —
  // proper anchor via geometry.translate. Previous attempt computed
  // the rotated +Y axis manually but used the wrong Euler-order
  // formula, leaving the bottom end ~1.9m off the feed horn.
  const brokenArmLen = 2.4;
  const brokenArmGeo = new THREE.CylinderGeometry(0.06, 0.06, brokenArmLen, 4);
  brokenArmGeo.translate(0, brokenArmLen * 0.5, 0);   // anchor at bottom
  const brokenArm = new THREE.Mesh(brokenArmGeo, _frameMat);
  brokenArm.position.set(0, focalDist, 0);
  brokenArm.rotation.set(1.1, 2.1, 0);
  dishPivot.add(brokenArm);

  // Snapped cables — 2 droopy wires hanging off the feed assembly to
  // narrate "something tore loose decades ago." TubeGeometry over a
  // CatmullRomCurve3 spline lets the cable sag naturally between its
  // anchor and unfastened tip; no rotation math needed (the curve
  // endpoints define orientation, not the cylinder anchor pattern). All
  // curve coords are in dishPivot-local frame so the cables inherit the
  // dish's pitch + roll.
  const _cableMat = new THREE.MeshLambertMaterial({
    color: 0x1a1612,        // matte black rubber-coated wire
    flatShading: true,
  });
  // Cable A: from feed-horn body, drooping toward the dish surface.
  // Anchor at feed-horn lower rim, sags 0.4m, ends mid-air about 1.3m
  // out (cut wire that fell short of the dish).
  const cableACurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.30, focalDist - 0.5, 0),                    // anchor on feed horn body
    new THREE.Vector3(0.95, focalDist - 1.0, 0.10),                 // mid-sag
    new THREE.Vector3(1.55, focalDist - 1.3, 0.15),                 // unfastened tip
    new THREE.Vector3(1.65, focalDist - 1.55, 0.18),                // gravity pull on tip
  ]);
  const cableA = new THREE.Mesh(
    new THREE.TubeGeometry(cableACurve, 16, 0.045, 5, false),
    _cableMat,
  );
  dishPivot.add(cableA);
  // Cable B: from the snapped broken-arm stub tip, longer droop curving
  // past the dish edge. The broken arm mesh is positioned at
  // (0, focalDist, 0) in dishPivot-local, with its geometry pre-
  // translated so y=0 is the anchor and y=brokenArmLen is the tip.
  // After rotation by Euler(1.1, 2.1, 0), the tip's offset from the
  // mesh position is the rotated (0, brokenArmLen, 0) vector. World tip
  // in dishPivot-local = mesh position + rotated offset.
  const brokenTipOffset = new THREE.Vector3(0, brokenArmLen, 0)
    .applyEuler(new THREE.Euler(1.1, 2.1, 0));
  const brokenTip = new THREE.Vector3(0, focalDist, 0).add(brokenTipOffset);
  const cableBCurve = new THREE.CatmullRomCurve3([
    brokenTip.clone(),
    brokenTip.clone().add(new THREE.Vector3(0.4, -0.7, 0.2)),       // initial droop
    brokenTip.clone().add(new THREE.Vector3(0.7, -1.6, 0.3)),       // mid-arc
    brokenTip.clone().add(new THREE.Vector3(0.8, -2.6, 0.35)),      // settled tip
  ]);
  const cableB = new THREE.Mesh(
    new THREE.TubeGeometry(cableBCurve, 20, 0.045, 5, false),
    _cableMat,
  );
  dishPivot.add(cableB);

  group.add(dishPivot);

  // (Sand-mound apron is added AFTER the group is positioned + tilted,
  // so each mound can be terrain-snapped to its own XZ — see the
  // mounds block below the rotation section. Keeping them out of the
  // rotated group avoids the "mound floats above the dune" problem
  // when the structure pitches.)

  // ── 6. Salvage panels ───────────────────────────────────────────
  // Session ABA — migrated from legacy makeAccessPanel() (simple
  // box + horizontal rim, no hinge / interior / loot) to the rich
  // addAccessPanel() flow. Two panel kinds picked for thematic
  // interior palettes: basePanel uses 'fuselage' (cabling-heavy —
  // reads as a satellite control-room access panel); dishPanel uses
  // 'fuselage' too (electronics inside the dish backing).
  //
  // (A) On the south wall (+Z face of the BASE_D-wide base), eye-
  //     height. Wrapper +Z = base's +Z (no rotation) = outward from
  //     wall. Position the wrapper at the wall exterior surface so
  //     the body recesses INTO the wall.
  const basePanel = new THREE.Group();
  addAccessPanel(basePanel, 0, 0, 0, 1, 0, 'fuselage');
  basePanel.position.set(
    BASE_W * 0.22,
    baseAnchorY + BASE_H * 0.5 - BASE_WALL_T - 1.0,
    BASE_D * 0.5,                  // exterior wall surface; body recesses into wall
  );
  group.add(basePanel);

  // (B) On the back (convex side) of the dish, mid-radius. Attached
  //     to dishPivot so it inherits the dish's tilt. Lathe-local +Y is
  //     UP from the apex (toward the concave / bowl opening), so the
  //     CONVEX back faces lathe -Y. Rotation around X by +π/2 takes
  //     wrapper +Z = (0,0,1) → (0,-1,0) — i.e. dishPivot's -Y direction
  //     = outward from the convex back surface. Body recesses INTO the
  //     dish (toward concave side, +Y).
  //
  // Session ABB — Y was 0 (apex level), but the dish profile is parabolic
  // y = (r/R)² · DEPTH, so at radius DISH_R*0.5 the dish back sits at
  // y = 0.25 · DISH_DEPTH = 0.65m above the apex. With Y=0 the panel
  // floated ~0.65m below the dish back. Reposition wrapper Y to the
  // dish surface at the panel radius so the body's front face is flush.
  const dishPanelT = 0.5;
  const dishPanelR = DISH_R * dishPanelT;
  const dishPanelY = dishPanelT * dishPanelT * DISH_DEPTH;
  const dishPanel = new THREE.Group();
  addAccessPanel(dishPanel, 0, 0, 0, 1, 0, 'fuselage');
  dishPanel.position.set(dishPanelR, dishPanelY, 0);
  dishPanel.rotation.x = Math.PI / 2;
  dishPivot.add(dishPanel);

  // ── Position, tilt, and add to scene ─────────────────────────────
  group.position.copy(pos);
  group.position.y = terrain.heightAt(pos.x, pos.z);
  group.rotation.set(PITCH, rand() * Math.PI * 2, ROLL);

  group.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });
  scene.add(group);

  // ABO C4 — attach a single AABB collider to the dishPivot. Pre-ABO the
  // dish was visual-only (player could walk through the disc if they
  // climbed the tripod / ladder). AABB is over-approximate at the tilt
  // angle but the dish lives at TRIPOD_APEX_Y ≈ 16m so the over-approx
  // doesn't conflict with anything at player-walk height; it just blocks
  // through-the-dish penetration on the climbed-up path.
  group.updateMatrixWorld(true);
  attachAabbCollider(world, dishPivot);

  // Sand mounds — added as direct scene children AFTER the dish group
  // is placed, so each mound's Y is terrain-snapped independently.
  // This avoids the "mound floats" problem the rotated group caused
  // (when the dish group pitched 15-30°, mounds on the up-side floated
  // 1m above ground, mounds on the down-side sank 1m below). Each
  // mound now lives in its own scene position derived from the dish
  // POI's world XZ + a random outward offset, with Y sampled at that
  // exact spot.
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + rand() * 0.35;
    const r = BASE_W * 0.55 + rand() * 2.0;
    const moundX = pos.x + Math.cos(a) * r;
    const moundZ = pos.z + Math.sin(a) * r;
    const moundY = terrain.heightAt(moundX, moundZ);
    const mound = new THREE.Mesh(
      new THREE.ConeGeometry(1.2 + rand() * 0.7, 0.7 + rand() * 0.5, 6),
      _sandPileMat,
    );
    // Mound sits with its BASE on the terrain (cone origin at center,
    // height/2 below origin is the tip-bottom; ConeGeometry has the
    // apex at +Y and the base at -Y by default).
    mound.position.set(moundX, moundY - 0.15, moundZ);
    mound.rotation.y = rand() * Math.PI * 2;
    mound.castShadow = true;
    mound.receiveShadow = true;
    scene.add(mound);
  }

  // (Wrapping sand burial dune removed — read as a fake-looking sphere
  // berm against the base. Defer to a later session for a more
  // convincing dune approach, possibly applied to other POIs.)

  // ── Colliders — give the base walls + roof + floor static bodies
  // so the player can stand on the roof, walk inside, and bump into
  // the walls. Use the group's world transform via getWorldQuaternion
  // so the rotation is preserved.
  const groupWorldQuat = new THREE.Quaternion();
  group.getWorldQuaternion(groupWorldQuat);
  const groupWorldPos = group.position.clone();

  const addBaseCollider = (localPos: THREE.Vector3, halfExtents: { x: number; y: number; z: number }): void => {
    // Apply group's rotation to the local-space center to get world center.
    const worldCenter = localPos.clone()
      .add(new THREE.Vector3(0, baseAnchorY, 0))  // baseGroup's local Y offset
      .applyQuaternion(groupWorldQuat)
      .add(groupWorldPos);
    makeStaticBox(world, halfExtents, worldCenter, {
      x: groupWorldQuat.x, y: groupWorldQuat.y, z: groupWorldQuat.z, w: groupWorldQuat.w,
    });
  };

  // Roof — walkable top of the base
  addBaseCollider(
    new THREE.Vector3(0, BASE_H * 0.5 - BASE_WALL_T * 0.5, 0),
    { x: BASE_W * 0.5, y: BASE_WALL_T * 0.5, z: BASE_D * 0.5 },
  );
  // ── ACBB Tier 3 (§E) — the 16m parabolic DISH had NO collider (only the base did), so the
  // player walked clean through the reflector + its forward-collapsed lower rim. Add a slab
  // matching the reflector: DISH_R square × DISH_DEPTH thick, at the dishPivot's exact WORLD
  // transform (group world TRS ∘ dishPivot local pos apexY ∘ the forward-collapse tilt). The
  // box corners over-block the round dish slightly at the diagonals (acceptable; the dish sits
  // high). NOTE: collision FEEL owes the attended walk-test (headless can't judge it) — the
  // geometry is grounded in the dishPivot transform, so the worst case is a touch of over-block.
  {
    const dishPivotQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI * 0.32, 0, 0.18));
    const dishWorldQuat = groupWorldQuat.clone().multiply(dishPivotQuat);
    const dishWorldCenter = new THREE.Vector3(0, DISH_DEPTH * 0.5, 0)
      .applyQuaternion(dishPivotQuat)
      .add(new THREE.Vector3(0, apexY, 0))   // dishPivot's local Y within group
      .applyQuaternion(groupWorldQuat)
      .add(groupWorldPos);
    makeStaticBox(
      world,
      { x: DISH_R, y: DISH_DEPTH * 0.5 + 0.3, z: DISH_R },
      dishWorldCenter,
      { x: dishWorldQuat.x, y: dishWorldQuat.y, z: dishWorldQuat.z, w: dishWorldQuat.w },
    );
  }
  // Ladder ramp — tilted 45° box collider that the player can walk up
  // from terrain to roof. addBaseCollider doesn't support local
  // rotations (it only applies the parent group's world quat), so we
  // compose the local Z-tilt manually and call makeStaticBox directly.
  // Center / half-extents / tilt all match the visual ladderGroup
  // above. Slope = 45° is under the character controller's 50° max
  // slope (see makePlayer in physics/bodies.ts), so the player can
  // walk up under normal movement input.
  {
    const rampLocalCenter = new THREE.Vector3(rampMidX, rampMidY + baseAnchorY, 0);
    const rampWorldCenter = rampLocalCenter.clone()
      .applyQuaternion(groupWorldQuat)
      .add(groupWorldPos);
    const rampLocalQuat = new THREE.Quaternion()
      .setFromAxisAngle(new THREE.Vector3(0, 0, 1), -rampAngle);
    const rampComposedQuat = groupWorldQuat.clone().multiply(rampLocalQuat);
    makeStaticBox(
      world,
      { x: rampLen * 0.5, y: 0.05, z: 0.30 },
      rampWorldCenter,
      { x: rampComposedQuat.x, y: rampComposedQuat.y, z: rampComposedQuat.z, w: rampComposedQuat.w },
    );
  }
  // Walls — South / East / West (block player from clipping through)
  addBaseCollider(
    new THREE.Vector3(0, 0, BASE_D * 0.5 - BASE_WALL_T * 0.5),
    { x: BASE_W * 0.5, y: (BASE_H - BASE_WALL_T * 2) * 0.5, z: BASE_WALL_T * 0.5 },
  );
  addBaseCollider(
    new THREE.Vector3(BASE_W * 0.5 - BASE_WALL_T * 0.5, 0, 0),
    { x: BASE_WALL_T * 0.5, y: (BASE_H - BASE_WALL_T * 2) * 0.5, z: (BASE_D - BASE_WALL_T * 2) * 0.5 },
  );
  addBaseCollider(
    new THREE.Vector3(-BASE_W * 0.5 + BASE_WALL_T * 0.5, 0, 0),
    { x: BASE_WALL_T * 0.5, y: (BASE_H - BASE_WALL_T * 2) * 0.5, z: (BASE_D - BASE_WALL_T * 2) * 0.5 },
  );
  // North wall: left segment + right segment (entrance hole between)
  addBaseCollider(
    new THREE.Vector3(-(BASE_W * 0.5 - nWallSide * 0.5), 0, -BASE_D * 0.5 + BASE_WALL_T * 0.5),
    { x: nWallSide * 0.5, y: (BASE_H - BASE_WALL_T * 2) * 0.5, z: BASE_WALL_T * 0.5 },
  );
  addBaseCollider(
    new THREE.Vector3((BASE_W * 0.5 - nWallSide * 0.5), 0, -BASE_D * 0.5 + BASE_WALL_T * 0.5),
    { x: nWallSide * 0.5, y: (BASE_H - BASE_WALL_T * 2) * 0.5, z: BASE_WALL_T * 0.5 },
  );
  // Sand pile — solid (player can walk on top via the slope wedge but
  // can't push through the main pile). KK-2 — sized to match the
  // shrunk pile so it doesn't extend past the actual mesh.
  addBaseCollider(
    new THREE.Vector3(0, -BASE_H * 0.5 + BASE_WALL_T + sandPileH * 0.5,
      BASE_D * 0.5 - BASE_WALL_T - sandPileLen * 0.5),
    { x: INTERIOR_W * 0.5, y: sandPileH * 0.5, z: sandPileLen * 0.5 },
  );

  // ── Shelter zone — covers the small walkable strip just inside
  // the entrance (between the entrance hole and the sand pile).
  const shelterCenter = new THREE.Vector3(0, 1.0, -BASE_D * 0.5 + BASE_WALL_T + 0.8)
    .add(new THREE.Vector3(0, baseAnchorY, 0))
    .applyQuaternion(groupWorldQuat)
    .add(groupWorldPos);
  addShelterZone(shelter, shelterCenter, {
    x: ENTRANCE_W * 0.6, y: INTERIOR_H * 0.5, z: 0.7,
  });

  // ── Salvageable registration — both panels register as 'massive'
  // so they share the rich-loot table other anchor POIs use. Use
  // each panel's world position (it's been re-parented via the
  // dishPivot for the dish panel, so derive from matrixWorld).
  if (salvageables) {
    basePanel.updateWorldMatrix(true, false);
    const basePanelWorld = new THREE.Vector3().setFromMatrixPosition(basePanel.matrixWorld);
    registerSalvageable(salvageables, basePanel, 'massive', basePanelWorld, rand);

    dishPanel.updateWorldMatrix(true, false);
    const dishPanelWorld = new THREE.Vector3().setFromMatrixPosition(dishPanel.matrixWorld);
    registerSalvageable(salvageables, dishPanel, 'massive', dishPanelWorld, rand);
  }

  // Session ABF — radio operator's journal inside the concrete base
  // chamber. Sits on the floor along the -X interior wall, mid-depth,
  // near where the operator would have crouched watching the dish lose
  // signal. Group is already positioned + rotated; the journal mesh
  // gets added directly to the scene with the group's world transform
  // baked in via updateMatrixWorld walk.
  if (journals) {
    group.updateMatrixWorld(true);
    const journalLocal = new THREE.Vector3(
      -BASE_W * 0.30,
      baseAnchorY - BASE_H * 0.5 + BASE_WALL_T + 0.04,   // 4cm above the interior floor
      BASE_D * 0.10,
    );
    const journalWorld = journalLocal.clone().applyMatrix4(group.matrixWorld);
    // Yaw face into the chamber (+X relative to group, after group's yaw).
    const journalYaw = group.rotation.y + Math.PI / 2;
    journals.list.push(placeJournal(scene, journalWorld, journalYaw, 'satellite_dish'));
  }

  // T6 — collapse the static meshes by material (panels stay live).
  mergeStaticByMaterial(group);
  return group;
}
