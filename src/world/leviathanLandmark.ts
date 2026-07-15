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
import { makeLoftedHull, makeFormerRings, makeSandMound, mergeStaticByMaterial, SHIP_SECTION, type LoftStation } from './wreckForms.ts';   // PERF (2026-07-05 profile #2) — static-merge the landmark into per-material draws
import { createRustedHullMaterial } from './hullMaterial.ts';
import { createMetalMaterial } from './metalMaterial.ts';
import { makeStaticBox } from '../physics/bodies.ts';
import { addHorizonSilhouette } from './horizonSilhouettes.ts';
import { registerSalvageable, type SalvageableRegistry, type Salvageable } from './salvage.ts';   // interior salvage loot
import { addAccessPanel } from './wrecks.ts';                                                      // the pry-open salvage panel builder
import { placeJournal, type Journal, type JournalContent } from './journal.ts';                     // the recovered flight-recorder log
import { type LightPool, claimLight, releaseLight } from '../core/lightPool.ts';                    // proximity-gated interior lights (no always-on global light-loop cost)

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
  chalkStrength: 0.06,        // minimal bleach — a high noon sun, not a raking dawn; keep the mass dark
  fleckStrength: 0.1, bareMetalHex: 0x5a4c3a,   // 2026-07-15 (enterable): the default cool flecks read as WHITE SNOW up close — warm + sparse
});
_hullMat.side = THREE.DoubleSide;
const _hullDarkMat = createRustedHullMaterial({
  baseColor: LEVIATHAN_HULL_DARK_HEX,
  streakIntensity: 0.6,
  fleckStrength: 0.1, bareMetalHex: 0x4c4030,
});
_hullDarkMat.side = THREE.DoubleSide;
const _ribMat = createMetalMaterial(Tuning.WRECK_ANTENNA_HEX, { wornScale: 5.0, scratchStrength: 0.05 });

// ══ INTERIOR MATERIALS (2026-07-15 — the enterable hold) ═══════════════════
// Module singletons (one shared program each; the merge folds every interior
// draw per material). The hold is CAVERNOUS + dead + sand-reclaimed — a colder,
// grimmer palette than the warm Skyfall freighter cabin (this is a titan
// capital-ship hold half-swallowed by the dune, not a cargo hauler).
// NOTE (2026-07-15 lighting pass): a cavernous 16m-wide hold spreads point-light
// falloff thin, so DARK base values (0x2a/0x37) read near-black in the dead-ship
// gloom. Lifted the interior palette toward the Skyfall vocabulary (~0x50 walls)
// so even the dim "power's-out" light reveals the deck / cargo / structure — the
// mood stays dark, but the space is legible (the hero-read gate).
const _intFloorMat = createMetalMaterial(0x413a30, { wornScale: 6.0, scratchStrength: 0.10, rustLevel: 0.40 });   // deck plate (worn steel)
const _intWallMat = createMetalMaterial(0x554c40, { wornScale: 5.0, scratchStrength: 0.09, rustLevel: 0.34 });    // interior wall lining
const _intWallDkMat = createMetalMaterial(0x453d31, { wornScale: 4.5, scratchStrength: 0.08, rustLevel: 0.38 });  // darker recess/backing + ceiling panel (lifted so the deckhead catches the wash)
const _frameMat = createMetalMaterial(0x5a4e3e, { wornScale: 4.0, scratchStrength: 0.12, rustLevel: 0.32 });      // rails/ribs/struts/greebles
const _voidMat = new THREE.MeshLambertMaterial({ color: 0x08070a, flatShading: true });                          // solid dark recess/baffle (real depth)
const _sandDriftMat = new THREE.MeshLambertMaterial({ color: 0xb09460, flatShading: true });                     // interior sand drift (warm ochre)
const _cnWeather = { fleckStrength: 0.12, bareMetalHex: 0x6f5c46, chalkStrength: 0, streakIntensity: 0.42 } as const;   // warm sparse flecks (no snow), painted-steel weathering
const _cnRust = createRustedHullMaterial({ baseColor: 0x8a3c22, oxStrength: 0.24, ..._cnWeather });   // cargo red-oxide
const _cnBlue = createRustedHullMaterial({ baseColor: 0x2c5468, oxStrength: 0.22, ..._cnWeather });   // faded maritime blue
const _cnTan = createRustedHullMaterial({ baseColor: 0xa4885a, oxStrength: 0.20, ..._cnWeather });    // sun-bleached tan (pops)
const _cableMat = new THREE.MeshLambertMaterial({ color: 0x121014, flatShading: true });                         // black cable / chain loom
const _conduitMat = new THREE.MeshLambertMaterial({ color: 0x5c4f37, flatShading: true });                       // painted conduit / pipe
const _wireRedMat = new THREE.MeshLambertMaterial({ color: 0x6e2622, flatShading: true });                       // exposed wire bundle (dull red)
const _deadScreenMat = new THREE.MeshLambertMaterial({ color: 0x05080a, emissive: 0x0a141c, emissiveIntensity: 0.22, flatShading: true }); // dead MFD glass
const _stripDeadMat = new THREE.MeshLambertMaterial({ color: 0x1a1c1e, flatShading: true });                     // dead strip-light housing
const _stripRedMat = new THREE.MeshLambertMaterial({ color: 0x3a1210, emissive: 0x7a2010, emissiveIntensity: 0.72, flatShading: true }); // failing red emergency strip (dimmed so it reads as a fixture, not a floating mark)
const _scorchMat = new THREE.MeshLambertMaterial({ color: 0x0d0a08, flatShading: true });                        // burnt scorch scar
const _paperMat = new THREE.MeshLambertMaterial({ color: 0x8f8672, flatShading: true });                         // grimy manifest / label

// ── INTERIOR LAYOUT (local frame: long-axis +Z; group origin → world ~(-403,
//    8.49,106); DECK top at I_DECK_Y lands ≈ grade at the uphill mouth + rises a
//    gentle crash-cant aft — verified against the site terrain profile). The
//    fracture at z≈+7.5 is the walk-in breach MOUTH; the hold runs aft to an end
//    wall at z=I_END_Z. Three compartments: HOLD → MID (machine spine) → AFT
//    (engineering / the crew station + story console). CAVERNOUS (16m wide, 5m
//    clear) — a titan's hold, not a freighter cabin.
const I_DECK_Y = 4.0;
const I_CEIL_Y = 9.2;
const I_WALL_X = 8.0;             // inner wall face ±8 (16m beam)
const I_MOUTH_Z = 7.5;           // fracture mouth (deck front lip)
const I_END_Z = -34;             // aft end wall
const I_DOOR_HW = 0.95;          // doorway half-width (1.9m clear)
const I_DOOR_TOP = I_DECK_Y + 2.5;   // doorway clear height 2.5m
const I_BULK_A = -7;             // HOLD↔MID bulkhead
const I_BULK_B = -21;            // MID↔AFT bulkhead
const I_DOORX_A = 1.6;           // door offsets (fixed — deterministic monument)
const I_DOORX_B = -1.5;
const I_WALL_T = 0.5;            // interior wall/deck/ceiling plate thickness (rule 7)

let _group: THREE.Group | null = null;
let _drift: THREE.Mesh | null = null;
let _bodies: RAPIER.RigidBody[] = [];
let _salvage: Salvageable[] = [];
// Interior lights are proximity-gated through the shared pool: the leviathan is a
// FIXED monument always in the scene (unlike streamed Skyfall), so ALWAYS-ON point
// lights would permanently grow the renderer's per-fragment light loop (Three loops
// every point light for every lit material, everywhere — a global cost even at the
// 400m-away spawn). Instead the interior light CONFIGS are stashed at build; a tick
// (updateLeviathanLandmark) claims pool lights only when the player is near + frees
// them when far → zero cost normally, no shader recompile (pool count is fixed).
interface LevLightCfg { c: number; i: number; r: number; x: number; y: number; z: number }
let _lightConfigs: LevLightCfg[] = [];
let _lightsWorld: { c: number; i: number; r: number; pos: THREE.Vector3 }[] = [];
let _claimedLights: THREE.PointLight[] = [];
let _lightsOn = false;

// The recovered flight-recorder log on the aft console (the story payoff — a
// bigger, older echo of the player's own disaster: this titan died the same way).
const LEVIATHAN_LOG: JournalContent = {
  title: 'FLIGHT RECORDER — RELIC',
  subtitle: 'salvaged black box · heavy transit hull "Anassa"',
  entries: [
    ['CYCLE 3', 'She is too big to fall. Forty thousand tonnes of hull and a spine of formers you could drive a hauler down. The crews call the main hold the cathedral. I understand why.'],
    ['CYCLE 411', 'Reactor two flickered on the long crossing and nobody logged it. We are a freight run, not a warship — there is no margin written for a titan that limps.'],
    ['THE FALL', 'She came down shallow, belly to the pan, and slid for a mile. The formers held. The formers always hold. It was the sand that took her — it came up through the breach like water and would not stop.'],
    ['LAST', 'If you are reading this off the box, you walked in through the tear. Mind the deck aft — the dune is under it now. Take what you can carry. She is a monument, not a home.'],
  ],
};

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

  // ══ THE ENTERABLE INTERIOR (2026-07-15) — a walkable titan's hold built inside
  //    the aft belly, entered through the amidships fracture MOUTH. Added BEFORE
  //    the decoration-tag + merge so every interior surface folds into the shared
  //    per-material draws. Colliders + salvage/journal are added post-transform in
  //    placeLeviathanLandmark (they need the world pose). ─────────────────────
  buildLeviathanInterior(g);

  // Mark ALL of it as decoration / noCollider (the collider is a separate proxy box).
  g.traverse((o) => {
    o.userData.isWreckDecoration = true;
    o.userData.noCollider = true;
    const m = o as THREE.Mesh;
    if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; }
  });
  // ── PERF (2026-07-05 profile, candidate 2): STATIC-MERGE into one draw per (material,
  //    attribute-signature) bucket — the same wreck-field discipline every other wreck/POI
  //    applies. Everything here is static scenery: no interactables, no animated parts, no
  //    transparent materials — nothing needs a noMerge protect (the proxy collider is a
  //    separate hand-placed static box, untouched; merge bakes the same verts into g-local
  //    space, so the silhouette + the Box3 the sun-occluder registers are unchanged).
  //    Folds the 16 meshes → 5 (hull-loft / hull-box / dark-hull / former-rings / rib metal).
  mergeStaticByMaterial(g);
  // The merge re-parents FRESH merged meshes under g (tagging them noCollider itself) —
  // re-assert the decoration tag so the whole landmark keeps its decor contract.
  g.traverse((o) => { o.userData.isWreckDecoration = true; o.userData.noCollider = true; });
  void rand;   // reserved for future per-instance variation; determinism handle
  return g;
}

/** Build the walkable titan's-hold interior into the aft belly (LOCAL frame,
 *  long-axis +Z; DECK top at I_DECK_Y). All shared materials so the merge folds
 *  it to per-material draws; point lights are group children (torn down with the
 *  group). NO colliders here — they need the world pose (added in place()).
 *  Deterministic layout (a fixed monument). Rule 7: every surface is a solid box
 *  with real thickness; no single-sided flats. */
function buildLeviathanInterior(g: THREE.Group): void {
  _lightConfigs = [];   // (re)collect the interior light configs for this build
  const dBox = (
    mat: THREE.Material, w: number, h: number, d: number,
    px: number, py: number, pz: number, rx = 0, ry = 0, rz = 0,
  ): THREE.Mesh => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(px, py, pz);
    if (rx || ry || rz) m.rotation.set(rx, ry, rz);
    g.add(m);
    return m;
  };
  const dCyl = (
    mat: THREE.Material, rt: number, rb: number, len: number,
    px: number, py: number, pz: number, rx = 0, ry = 0, rz = 0, seg = 8,
  ): THREE.Mesh => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, len, seg), mat);
    m.position.set(px, py, pz);
    if (rx || ry || rz) m.rotation.set(rx, ry, rz);
    g.add(m);
    return m;
  };
  const midZ = (I_MOUTH_Z + I_END_Z) / 2;           // hold centre in z
  const spanZ = I_MOUTH_Z - I_END_Z;                // hold length
  const wallH = I_CEIL_Y - I_DECK_Y + 1.4;          // side-wall height (deck-ish → above ceiling)
  const wallCY = (I_CEIL_Y + I_DECK_Y) / 2;

  // ── STRUCTURE — deck / walls / ceiling / end wall / mouth seal ────────────
  // Deck: one long walkable plate, overhanging the mouth so the lip meets sand.
  dBox(_intFloorMat, (I_WALL_X + 0.6) * 2, I_WALL_T, spanZ + 1.0, 0, I_DECK_Y - I_WALL_T / 2, midZ + 0.3);
  // Deck plate seams (break the wide floor into plated bays).
  for (const sx of [-1, 1] as const) dBox(_frameMat, 0.16, 0.07, spanZ, sx * (I_WALL_X * 0.5), I_DECK_Y + 0.02, midZ);
  for (let i = 0; i < 9; i++) dBox(_frameMat, (I_WALL_X + 0.4) * 2, 0.07, 0.16, 0, I_DECK_Y + 0.02, I_MOUTH_Z - 3 - i * 4.6);
  // Side walls (full length, deck→above ceiling, real thickness).
  for (const s of [-1, 1] as const) dBox(_intWallMat, I_WALL_T, wallH, spanZ + 1.0, s * (I_WALL_X + I_WALL_T / 2), wallCY, midZ + 0.3);
  // Ceiling / overhead deckhead — solid, caps the upward view.
  dBox(_intWallDkMat, (I_WALL_X + 0.6) * 2, I_WALL_T, spanZ + 1.0, 0, I_CEIL_Y + I_WALL_T / 2, midZ + 0.3);
  // Aft end wall (closes the hold; hides the sealed stern mass).
  dBox(_intWallMat, (I_WALL_X + 0.6) * 2, wallH, I_WALL_T, 0, wallCY, I_END_Z - I_WALL_T / 2);
  // Under-deck skirt at the mouth (seals the buried void below the deck lip).
  dBox(_voidMat, (I_WALL_X + 0.6) * 2, 3.2, 0.4, 0, I_DECK_Y - 1.7, I_MOUTH_Z + 0.7);

  // ── SOLID MOUTH JAMB — the thick cut collar at the fracture (rule 7). A
  //    section-shaped ring: OUTER loop = the true arched hull section; INNER loop
  //    = the walk aperture (flat deck floor + flat header + near-vertical sides)
  //    clamped into the UPPER hull. A sightline into the mouth hits a solid cut
  //    cross-section (never a knife edge or a see-through slot); below the deck
  //    the collar is a solid plate sealing the buried lower hull. Shared material
  //    → folds into the merge. (Winding mirrors makeLoftedHull exactly.)
  {
    const outHW = HULL_HALF_W * 0.9, outHH = HULL_HALF_H * 0.96, ocy = 0.1;   // aft loft z≈+8 station
    const apLoY = I_DECK_Y, apHiY = I_CEIL_Y - 0.15, apX = I_WALL_X - 0.3;    // aperture extents
    const zFront = I_MOUTH_Z + 1.1;    // proud of the outer skin (occludes the loft knife edge)
    const zBack = I_MOUTH_Z - 0.6;     // recessed → a real plate depth
    const N = SHIP_SECTION.length;
    const outer = SHIP_SECTION.map(([sx, sy]) => new THREE.Vector2(sx * outHW, ocy + sy * outHH));
    const inner = SHIP_SECTION.map(([sx, sy]) => new THREE.Vector2(
      Math.sign(sx) * Math.min(Math.abs(sx * outHW), apX),
      Math.max(Math.min(ocy + sy * outHH, apHiY), apLoY),
    ));
    const pos: number[] = [];
    const oF = outer.map((p) => new THREE.Vector3(p.x, p.y, zFront));
    const iF = inner.map((p) => new THREE.Vector3(p.x, p.y, zFront));
    const iB = inner.map((p) => new THREE.Vector3(p.x, p.y, zBack));
    const oB = outer.map((p) => new THREE.Vector3(p.x, p.y, zBack));
    const push = (v: THREE.Vector3) => { pos.push(v.x, v.y, v.z); };
    for (let k = 0; k < N; k++) {
      const k2 = (k + 1) % N;
      push(oB[k]); push(oF[k2]); push(oF[k]); push(oB[k]); push(oB[k2]); push(oF[k2]);   // outer skin
      push(iB[k]); push(iF[k]); push(iF[k2]); push(iB[k]); push(iF[k2]); push(iB[k2]);   // inner jamb wall
      push(oF[k]); push(iF[k]); push(iF[k2]); push(oF[k]); push(iF[k2]); push(oF[k2]);   // front cap (cut cross-section)
      push(oB[k]); push(iB[k2]); push(iB[k]); push(oB[k]); push(oB[k2]); push(iB[k2]);   // back cap
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.computeVertexNormals();
    g.add(new THREE.Mesh(geo, _hullDarkMat));
  }

  // ── SHIP FRAME — transverse deckhead beams + vertical wall ribs + corner
  //    brackets (the titan's heavy structure, sized to the flat-wide hold). Reads
  //    as a ribbed capital-ship hold, not a smooth box.
  for (let i = 0; i < 9; i++) {
    const fz = I_MOUTH_Z - 2.5 - i * 4.4;
    dBox(_frameMat, (I_WALL_X + 0.3) * 2, 0.5, 0.5, 0, I_CEIL_Y - 0.3, fz);                 // deckhead beam across the beam
    for (const s of [-1, 1] as const) {
      dBox(_frameMat, 0.35, wallH - 1.2, 0.4, s * (I_WALL_X - 0.15), wallCY, fz);           // vertical wall rib
      dBox(_frameMat, 1.3, 0.4, 0.4, s * (I_WALL_X - 0.7), I_CEIL_Y - 0.75, fz, 0, 0, s * 0.7); // corner knee brace
    }
  }
  // ── EXPOSED FRAME RIBS — the titan's structure arching across the beam (the
  //    hero "you are standing in a ribcage" read). Flattened half-ring arcs
  //    (a torus scaled in Y to fit the flat-wide hold) springing from the deck at
  //    the walls to a crown just under the ceiling; tucked just inside the wall/
  //    ceiling plane. Shared frame material → folds into the merge.
  {
    const R = I_WALL_X - 0.15, spring = I_DECK_Y + 0.05, crown = I_CEIL_Y - 0.25;
    const kY = (crown - spring) / R;
    for (const rz of [5.5, -1.5, -9.0, -16.5, -24.0, -30.5]) {
      const rib = new THREE.Mesh(new THREE.TorusGeometry(R, 0.34, 7, 26, Math.PI), _frameMat);
      rib.position.set(0, spring, rz);
      rib.scale.set(1, kY, 1);      // flatten to the hold's proportions (arc ⟂ +Z, crown near ceiling)
      g.add(rib);
      // a gusset where each rib foots the wall (both sides)
      for (const s of [-1, 1] as const) dBox(_frameMat, 0.5, 0.6, 0.5, s * (I_WALL_X - 0.35), I_DECK_Y + 0.4, rz, 0, 0, s * 0.5);
    }
  }

  // A collapsed structural member — a big beam fallen diagonally across the hold
  // (crash drama; well aft of the mouth + off the centre walk lane so it doesn't
  // clutter the entrance read).
  dBox(_frameMat, 0.6, 0.6, 9.0, 3.6, I_DECK_Y + 2.4, -9.5, 0.2, 0.15, -0.9);
  dBox(_frameMat, 0.5, 0.5, 3.5, 5.6, I_DECK_Y + 0.9, -12.0, 0.3, -0.2, -0.5);

  // ── HORIZONTAL WALL PANELLING — break the tall flat inner skin into a plated,
  //    framed, cabled compartment (both walls, full length). Seam rails +
  //    skirting + a high conduit run. Proud ≥0.1m.
  for (const s of [-1, 1] as const) {
    const wx = (I_WALL_X - 0.05) * s;
    dBox(_frameMat, 0.14, 0.16, spanZ - 1, wx, I_DECK_Y + 2.3, midZ + 0.3);                 // upper seam rail
    dBox(_frameMat, 0.16, 0.16, spanZ - 1, wx, I_DECK_Y + 0.15, midZ + 0.3);               // skirting rail
    dCyl(_conduitMat, 0.09, 0.09, spanZ - 2, wx - 0.06 * s, I_CEIL_Y - 0.55, midZ + 0.3, Math.PI / 2, 0, 0, 7); // high conduit run
  }

  // ── HOLD (z +7 → -7) — cargo cathedral at the breach ──────────────────────
  // Lashing rails + D-ring cleats down both walls (freighter cargo grammar).
  for (const s of [-1, 1] as const) {
    const wx = (I_WALL_X - 0.08) * s;
    dBox(_frameMat, 0.12, 0.16, 12.5, wx, I_DECK_Y + 1.5, 0.0);
    for (let i = 0; i < 6; i++) {
      const cz = 5.5 - i * 2.1;
      dBox(_frameMat, 0.20, 0.26, 0.16, wx - 0.10 * s, I_DECK_Y + 0.95, cz);                // D-ring cleat
      dBox(_cableMat, 0.05, 0.34, 0.05, wx - 0.16 * s, I_DECK_Y + 0.95, cz, 0.5 * s, 0, 0.3 * s); // dangling lash strap
    }
  }
  // Big interior cargo containers stacked against both walls (titan-scale). A
  // couple toppled toward centre, nearest edge kept > 2m off the walk lane.
  const CN_W = 2.8, CN_H = 2.6, CN_L = 4.2;
  const intCrate = (mat: THREE.Material, px: number, py: number, pz: number, rx: number, ry: number, rz: number, sc = 1): void => {
    const w = CN_W * sc, h = CN_H * sc, d = CN_L * sc;
    const crate = new THREE.Group();
    crate.position.set(px, py, pz);
    crate.rotation.set(rx, ry, rz, 'YXZ');
    g.add(crate);
    const child = (m: THREE.Material, cw: number, ch: number, cd: number, cx: number, cy: number, cz: number): void => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(cw, ch, cd), m);
      b.position.set(cx, cy, cz);
      crate.add(b);
    };
    child(mat, w, h, d, 0, 0, 0);                        // the box
    const hw = w / 2, hh = h / 2, hl = d / 2;
    for (const sx of [-1, 1] as const) for (const sy of [-1, 1] as const) for (const sz of [-1, 1] as const)
      child(_frameMat, 0.24, 0.24, 0.24, sx * (hw - 0.02), sy * (hh - 0.02), sz * (hl - 0.02));   // corner castings
    for (const s of [-1, 1] as const) for (let r = 0; r < 4; r++)
      child(mat, 0.08, h - 0.4, 0.14, s * (hw + 0.03), 0, -hl + 0.6 + r * ((d - 1.2) / 3));        // corrugation straps
  };
  intCrate(_cnRust, I_WALL_X - 1.5, I_DECK_Y + CN_H / 2, 3.5, 0, 0.06, 0);
  intCrate(_cnBlue, I_WALL_X - 1.6, I_DECK_Y + CN_H * 1.5 + 0.1, 3.7, 0.04, 0.03, 0.03);   // stacked
  intCrate(_cnTan, I_WALL_X - 1.7, I_DECK_Y + CN_H / 2, -2.0, 0, -0.14, 0.06);
  intCrate(_hullDarkMat, -I_WALL_X + 1.6, I_DECK_Y + CN_H / 2, 4.2, 0.05, 0.2, -0.1);
  intCrate(_cnRust, -I_WALL_X + 2.4, I_DECK_Y + CN_H * 0.45, -1.5, 0.5, 0.9, 0.35, 0.85);   // spilled, tipped
  intCrate(_cnBlue, -I_WALL_X + 1.5, I_DECK_Y + CN_H / 2, -4.8, 0, 0.1, 0.05);
  // Sand drifted in through the breach — a wedge on the deck at the mouth,
  // thickest at the lip, feathering aft (FLAT, no collider; the deck stands).
  for (let i = 0; i < 6; i++) {
    const sz = I_MOUTH_Z - 0.5 - i * 1.7;
    const hgt = 0.34 - i * 0.05;
    dBox(_sandDriftMat, (I_WALL_X + 0.4) * 2 - i * 1.0, Math.max(0.05, hgt), 1.8, (i % 2 ? 0.6 : -0.6), I_DECK_Y + Math.max(0.05, hgt) / 2, sz);
  }
  // Hanging chains from the deckhead (a cargo hoist, snapped) — off-lane.
  for (const [cx, cz] of [[3.0, 1.5], [-3.4, -3.0], [4.2, -4.5]] as const) {
    dCyl(_cableMat, 0.05, 0.05, 2.6, cx, I_CEIL_Y - 1.4, cz, 0.06, 0, 0.03, 6);
    dBox(_frameMat, 0.4, 0.3, 0.2, cx, I_CEIL_Y - 2.8, cz);   // the hook block
  }

  // ── MID (z -7 → -21) — machine spine / systems ────────────────────────────
  // A central row of dead machinery (a reactor/tank bank) down the spine, kept
  // off the ±1.4m walk lane (the row sits at x ≈ ±3, clear of centre).
  for (const s of [-1, 1] as const) {
    dBox(_intWallDkMat, 1.8, 3.0, 8.0, s * 4.4, I_DECK_Y + 1.5, -14, 0, 0, 0);              // machine block
    for (let i = 0; i < 4; i++) dBox(_frameMat, 0.12, 0.12, 8.0, s * (4.4 - 0.95), I_DECK_Y + 0.6 + i * 0.7, -14); // cooling-fin bars
    dCyl(_conduitMat, 0.16, 0.16, 3.0, s * (4.4 - 1.0), I_DECK_Y + 0.4, -14, Math.PI / 2, 0, 0, 8);   // low pipe run
  }
  // A big dead reactor drum standing against the STARBOARD machine bank (OFF the
  // centre walk lane — the lane runs clear down the middle of the mid bay).
  dCyl(_intWallMat, 1.5, 1.5, 4.6, 5.5, I_DECK_Y + 2.3, -17.5, 0, 0, 0, 14);
  dBox(_frameMat, 3.2, 0.3, 0.3, 5.5, I_DECK_Y + 4.3, -17.5);                               // drum cap strap
  for (const dy of [0.5, 1.6, 2.7] as const) dCyl(_frameMat, 1.55, 1.55, 0.14, 5.5, I_DECK_Y + dy, -17.5, 0, 0, 0, 16);  // hoop bands
  // Ripped-open PORT wall panel — exposed conduit + wire loom + scorch (crash).
  {
    const px = -I_WALL_X + 0.06, wz = -12.0;
    dBox(_voidMat, 0.14, 2.4, 3.2, px, I_DECK_Y + 1.6, wz);                                 // dark torn cavity
    dBox(_intWallMat, 0.08, 1.8, 1.0, px + 0.5, I_DECK_Y + 1.6, wz - 1.4, 0, -0.6, 0.18);   // peeled panel flap
    for (const dy of [0.4, -0.3] as const) dCyl(_conduitMat, 0.10, 0.10, 3.0, px + 0.28, I_DECK_Y + 1.6 + dy, wz, Math.PI / 2, 0, 0, 7);  // conduit across cavity
    for (const dy of [0.1, -0.5] as const) dCyl(_wireRedMat, 0.07, 0.07, 1.2, px + 0.6, I_DECK_Y + 1.2 + dy, wz + 0.4, 0.6, 0.2, 0.5, 6); // spilling wire loom
    dBox(_scorchMat, 0.05, 1.4, 1.8, px, I_DECK_Y + 2.9, wz - 0.2);                          // scorch scar above
  }
  // Ceiling duct + hanging loose cables down the mid bay.
  dBox(_conduitMat, 0.5, 0.44, 9.0, -I_WALL_X + 0.7, I_CEIL_Y - 0.4, -14);
  for (const [dx, dz] of [[2.2, -9.5], [-2.6, -17.0]] as const) {
    dCyl(_cableMat, 0.05, 0.05, 1.6, dx, I_CEIL_Y - 0.9, dz, 0.7, 0, 0.2, 6);
    dCyl(_cableMat, 0.05, 0.05, 1.2, dx + 0.3, I_CEIL_Y - 1.9, dz + 0.1, 1.25, 0, 0.1, 6);
  }

  // ── AFT (z -21 → -34) — engineering / the crew station (story focal) ──────
  // A dead CONSOLE BANK against the end wall, dark screens + dials. The top
  // centre is left clear for the salvage/journal (added post-transform).
  {
    const bz = I_END_Z + 1.4, deskW = 6.0;
    dBox(_intWallMat, deskW, 1.2, 0.9, 0, I_DECK_Y + 0.6, bz);                               // console desk body (on deck)
    dBox(_intWallDkMat, deskW, 0.6, 0.6, 0, I_DECK_Y + 1.25, bz + 0.22, -0.5, 0, 0);         // raked instrument face
    for (const dx of [-2.2, -1.1, 1.1, 2.2] as const) {                                      // dead readout screens (skip centre)
      dBox(_frameMat, 0.72, 0.54, 0.06, dx, I_DECK_Y + 1.32, bz + 0.46, -0.5, 0, 0);
      dBox(_deadScreenMat, 0.6, 0.42, 0.05, dx, I_DECK_Y + 1.32, bz + 0.50, -0.5, 0, 0);
    }
    for (let i = 0; i < 9; i++) dBox(_frameMat, 0.09, 0.09, 0.09, -2.0 + i * 0.5, I_DECK_Y + 1.22, bz + 0.02);  // switch/dial row
    // flanking floor-standing instrument stacks
    for (const s of [-1, 1] as const) {
      dBox(_intWallDkMat, 1.0, 2.8, 0.5, s * 2.9, I_DECK_Y + 1.4, bz - 0.3);
      dBox(_deadScreenMat, 0.7, 0.6, 0.05, s * 2.9, I_DECK_Y + 2.1, bz + 0.0);
      dBox(_scorchMat, 0.6, 0.8, 0.04, s * 2.9, I_DECK_Y + 1.0, bz - 0.1);
    }
  }
  // Tall wall lockers on both aft walls (a couple ajar → dark gap).
  for (const [s, aj] of [[-1, 0.0], [1, 0.4]] as const) {
    const wx = (I_WALL_X - 0.25) * s, lz = -26;
    dBox(_intWallMat, 0.5, 2.2, 1.4, wx, I_DECK_Y + 1.1, lz);
    dBox(_intWallDkMat, 0.07, 2.0, 0.62, wx - 0.28 * s, I_DECK_Y + 1.1, lz - 0.35, 0, aj * s, 0);   // door (ajar)
  }
  // Two stripped crew seats facing the console (off-lane).
  const crewSeat = (px: number, pz: number, faceYaw: number, tip: number): void => {
    const seat = new THREE.Group();
    seat.position.set(px, I_DECK_Y, pz);
    seat.rotation.set(tip * 0.5, faceYaw, tip, 'YXZ');
    g.add(seat);
    const sc = (m: THREE.Material, w: number, h: number, d: number, y: number, z: number): void => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(0, y, z); seat.add(b);
    };
    sc(_frameMat, 0.6, 0.5, 0.6, 0.25, 0);          // pedestal
    sc(_intWallDkMat, 0.62, 0.2, 0.6, 0.6, 0);       // seat pan
    sc(_intWallDkMat, 0.62, 0.9, 0.18, 1.05, -0.32); // back
  };
  crewSeat(1.9, -30.5, Math.PI - 0.1, 0.05);
  crewSeat(-2.0, -30.2, Math.PI + 0.3, 0.24);
  // A fallen manifest + a mug on the deck (crew life).
  dBox(_paperMat, 0.5, 0.03, 0.6, -2.6, I_DECK_Y + 0.04, -28, 0, 0.3, 0.02);
  dCyl(_frameMat, 0.08, 0.075, 0.14, 2.4, I_DECK_Y + 0.07, -29, 0, 0, 0.3, 8);

  // ── STRIP LIGHTS on the ceiling (emissive → self-glow, ~no light cost). A
  //    couple failing red, most dead (power's out).
  const stripBar = (mat: THREE.Material, pz: number, len = 4.0): void => {
    dBox(_frameMat, 0.62, 0.18, len, 0, I_CEIL_Y - 0.32, pz);        // fixture housing (visible metal, not a black gap)
    dBox(_stripDeadMat, 0.5, 0.05, len - 0.1, 0, I_CEIL_Y - 0.42, pz); // reflector backing
    dBox(mat, 0.4, 0.08, len - 0.3, 0, I_CEIL_Y - 0.46, pz);         // the lens (lit or dead)
  };
  stripBar(_stripDeadMat, 3.0);
  stripBar(_stripDeadMat, -3.0);
  stripBar(_stripRedMat, -12.0);
  stripBar(_stripDeadMat, -21.0);
  stripBar(_stripRedMat, -29.0);

  // ── LIGHTING — "power's out, the sun leaks in through the tear." Warm daylight
  //    floods the HOLD from the breach + falls off aft; dim failing red lamps keep
  //    the MID + AFT dark-but-legible; a low cool bounce fills the deep aft so the
  //    crew station reads. These are CONFIGS (local positions) collected here; the
  //    tick claims/frees POOL lights by proximity (see the module note above), so
  //    the monument adds ZERO permanent light-loop cost. Kept to 9 (pool headroom).
  //    decay 1.5 (not physical 2) — in a cavern inverse-square crushes the fill to
  //    black a few metres out; 1.5 fills the wide hold while the gradient still
  //    falls off bow-ward (the "sun through the tear" read).
  const addLight = (color: number, intensity: number, range: number, lx: number, ly: number, lz: number): void => {
    _lightConfigs.push({ c: color, i: intensity, r: range, x: lx, y: ly, z: lz });
  };
  addLight(0xffc38c, 4.2, 34, 0, I_DECK_Y + 3.4, I_MOUTH_Z - 1.0);   // MOUTH daylight shaft (floods the hold)
  addLight(0xffb578, 2.7, 26, 0, I_DECK_Y + 3.3, 1.5);              // hold near fill (daylight on the cargo)
  addLight(0xffa25c, 1.8, 24, 0, I_DECK_Y + 3.2, -4.5);            // hold deep fill (bleed toward door A)
  addLight(0x8a7458, 1.4, 22, 0, I_DECK_Y + 3.3, -14.0);          // MID neutral fill (machine bay legible)
  addLight(0xb0361f, 1.1, 15, 0.5, I_DECK_Y + 2.7, -12.0);        // MID failing red lamp (with the red strip)
  addLight(0x54637e, 1.3, 24, 0, I_DECK_Y + 3.1, -24.0);          // cool bounce fill (aft legibility)
  addLight(0xa83322, 1.0, 14, 0, I_DECK_Y + 2.6, -29.0);          // AFT last red lamp (with the red strip)
  addLight(0xc8a878, 1.7, 14, 0, I_DECK_Y + 1.9, -31.0);          // warm crew-station fill (console/loot)
  // Ceiling-structure wash — dim high lamps grazing the deckhead beams + ribs so
  // the cavernous overhead reads (was a black void); kept low so the top stays moody.
  addLight(0xa89372, 1.0, 22, 0, I_CEIL_Y - 0.7, -2.0);           // hold deckhead wash
  addLight(0x8892a0, 0.9, 20, 0, I_CEIL_Y - 0.7, -18.0);         // mid/aft deckhead wash (cool)
}

/** Place the beached-leviathan horizon landmark at its fixed world position, tilted
 *  + half-buried in the dune. Additive; safe to call once at world build. Idempotent
 *  (removes a prior instance first). Registers itself as a fog-resistant sun occluder
 *  + skyline silhouette like the other flagships. */
export function placeLeviathanLandmark(
  scene: THREE.Scene,
  world: RAPIER.World,
  terrain: Terrain,
  opts: { salvage?: SalvageableRegistry; journals?: { list: Journal[] } } = {},
): void {
  removeLeviathanLandmark(scene, world);
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

  // ══ INTERIOR COLLIDERS (rule 9 — match the visible walkable hold EXACTLY).
  //    The S1 single hull-filling box is GONE (it blocked entry) → replaced by an
  //    exact walkable set: deck, side walls, roof, aft end wall, mouth skirt,
  //    bulkhead panels/lintel/sill, and the large off-lane furniture masses. The
  //    mouth aperture + the doorways carry NO collider (they are the entries).
  //    Every collider is composed with the group's world pose (yaw+pitch+roll).
  const groupQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.08, HULL_YAW, 0.05, 'XYZ'));
  const groupPos = new THREE.Vector3(LANDMARK_X, gy - BURY, LANDMARK_Z);
  const midZ = (I_MOUTH_Z + I_END_Z) / 2, spanZ = I_MOUTH_Z - I_END_Z;
  const wallH = I_CEIL_Y - I_DECK_Y + 1.4, wallCY = (I_CEIL_Y + I_DECK_Y) / 2;
  const cols: RAPIER.Collider[] = [];
  const localCol = (hx: number, hy: number, hz: number, lx: number, ly: number, lz: number): RAPIER.Collider => {
    const c = makeStaticBox(
      world, { x: hx, y: hy, z: hz },
      groupPos.clone().add(new THREE.Vector3(lx, ly, lz).applyQuaternion(groupQuat)),
      groupQuat,
    );
    cols.push(c);
    const b = c.parent(); if (b) _bodies.push(b);
    return c;
  };
  // Deck (the walkable floor — handle exported for the walk probe).
  const deckCol = localCol(I_WALL_X + 0.6, 0.25, (spanZ + 1) / 2, 0, I_DECK_Y - 0.25, midZ + 0.3);
  // Side walls (inner face lands on the visible ±I_WALL_X plane).
  localCol(I_WALL_T / 2, wallH / 2, (spanZ + 1) / 2, I_WALL_X + I_WALL_T / 2, wallCY, midZ + 0.3);
  localCol(I_WALL_T / 2, wallH / 2, (spanZ + 1) / 2, -(I_WALL_X + I_WALL_T / 2), wallCY, midZ + 0.3);
  // Roof (underside = the interior ceiling at I_CEIL_Y).
  localCol(I_WALL_X + 0.6, 0.25, (spanZ + 1) / 2, 0, I_CEIL_Y + 0.25, midZ + 0.3);
  // Aft end wall.
  localCol(I_WALL_X + 0.6, wallH / 2, I_WALL_T / 2, 0, wallCY, I_END_Z - I_WALL_T / 2);
  // Under-deck skirt at the mouth (blocks stepping off the front lip into the void).
  localCol(I_WALL_X + 0.6, 1.6, 0.2, 0, I_DECK_Y - 1.7, I_MOUTH_Z + 0.7);
  // Bulkhead colliders (mirror the visuals: panels + lintel + sill; the doorway is open).
  const sillHandles: number[] = [];
  const bulkheadCols = (bz: number, doorX: number): void => {
    const panelHH = (I_CEIL_Y - I_DECK_Y) / 2, panelY = (I_CEIL_Y + I_DECK_Y) / 2;
    const leftW = (doorX - I_DOOR_HW) - (-I_WALL_X - I_WALL_T);
    const rightW = (I_WALL_X + I_WALL_T) - (doorX + I_DOOR_HW);
    localCol(leftW / 2, panelHH, I_WALL_T / 2, (-I_WALL_X - I_WALL_T) + leftW / 2, panelY, bz);
    localCol(rightW / 2, panelHH, I_WALL_T / 2, (doorX + I_DOOR_HW) + rightW / 2, panelY, bz);
    localCol(I_DOOR_HW, (I_CEIL_Y - I_DOOR_TOP) / 2, I_WALL_T / 2, doorX, (I_CEIL_Y + I_DOOR_TOP) / 2, bz);
    sillHandles.push(localCol(I_DOOR_HW, 0.06, 0.25, doorX, I_DECK_Y + 0.06, bz).handle);
  };
  bulkheadCols(I_BULK_A, I_DOORX_A);
  bulkheadCols(I_BULK_B, I_DOORX_B);
  // ── Off-lane furniture masses (rule 9) — every one sits well clear of the
  //    ±1.4m centre walk lane + the doorways (the walk gate stays clean).
  // HOLD cargo crates (half ≈ container/2).
  const CH = 2.6 / 2, CHW = 2.8 / 2, CHL = 4.2 / 2;
  localCol(CHW, 2.6 * 1.0, CHL, I_WALL_X - 1.5, I_DECK_Y + 2.0, 3.5);    // starboard stack (2 high)
  localCol(CHW, CH, CHL, I_WALL_X - 1.7, I_DECK_Y + CH, -2.0);           // starboard fwd crate
  localCol(CHW, CH, CHL, -I_WALL_X + 1.6, I_DECK_Y + CH, 4.2);          // port crate
  localCol(CHW * 0.85, CH * 0.85, CHL * 0.85, -I_WALL_X + 2.4, I_DECK_Y + CH * 0.9, -1.5);   // spilled crate
  localCol(CHW, CH, CHL, -I_WALL_X + 1.5, I_DECK_Y + CH, -4.8);         // port aft crate
  // MID machine banks + the drum (off-lane).
  localCol(0.95, 1.5, 4.1, 4.4, I_DECK_Y + 1.5, -14);                    // starboard machine bank
  localCol(0.95, 1.5, 4.1, -4.4, I_DECK_Y + 1.5, -14);                   // port machine bank
  localCol(1.6, 2.4, 1.6, 5.5, I_DECK_Y + 2.3, -17.5);                   // reactor drum
  // AFT console + flanks + lockers + seats.
  localCol(3.05, 1.1, 0.55, 0, I_DECK_Y + 0.7, I_END_Z + 1.4);          // console desk
  for (const s of [-1, 1] as const) localCol(0.55, 1.5, 0.3, s * 2.9, I_DECK_Y + 1.4, I_END_Z + 1.1);   // flanking instrument stacks
  for (const s of [-1, 1] as const) localCol(0.3, 1.15, 0.75, s * (I_WALL_X - 0.25), I_DECK_Y + 1.1, -26);  // wall lockers
  for (const [sx, sz] of [[1.9, -30.5], [-2.0, -30.2]] as const) localCol(0.4, 0.6, 0.42, sx, I_DECK_Y + 0.6, sz);  // crew seats

  // ── Walk-probe data (rig-shot `leviathan-walk`): world-space waypoints down the
  //    full path + the floor collider handles (a castDown from any interior waypoint
  //    must hit a floor collider — or shin-deep sand ingress).
  group.updateMatrixWorld(true);
  const wp = (name: string, lx: number, ly: number, lz: number): { name: string; x: number; y: number; z: number } => {
    const v = group.localToWorld(new THREE.Vector3(lx, ly, lz));
    return { name, x: v.x, y: v.y, z: v.z };
  };
  group.userData.leviathanProbe = {
    deckHandle: deckCol.handle,
    floorHandles: [deckCol.handle, ...sillHandles],
    waypoints: [
      wp('outside', 0, I_DECK_Y, I_MOUTH_Z + 4.0),
      wp('mouth', 0, I_DECK_Y, I_MOUTH_Z - 1.0),
      wp('hold', 0, I_DECK_Y, -1.0),
      wp('doorA', I_DOORX_A, I_DECK_Y, I_BULK_A),
      wp('mid', 0, I_DECK_Y, -14.0),
      wp('doorB', I_DOORX_B, I_DECK_Y, I_BULK_B),
      wp('aft', 0, I_DECK_Y, -27.0),
    ],
    ceilY: I_CEIL_Y - I_DECK_Y,
    wallX: I_WALL_X,
  };

  // ── Bake the interior light WORLD positions (the group pose is fixed) for the
  //    proximity tick to claim/free pool lights from.
  _lightsWorld = _lightConfigs.map((cfg) => ({
    c: cfg.c, i: cfg.i, r: cfg.r,
    pos: group.localToWorld(new THREE.Vector3(cfg.x, cfg.y, cfg.z)),
  }));
  _lightsOn = false;
  _claimedLights = [];

  // ══ INTERIOR LOOT — 2 pry-open salvage panels on the aft-cabin walls + the
  //    recovered flight-recorder log on the console (the reward for the long hike +
  //    walk to the stern). A POSITION-SEEDED rng drives loot condition/log text so
  //    it stays deterministic + additive. Added AFTER the merge → stay interactive.
  const lootRand = makeRng(0x1e71a7 ^ 0x51f00d);
  if (opts.salvage) {
    for (const [sgn, lz] of [[1, -24.5], [-1, -23.0]] as const) {
      const p = new THREE.Group();
      addAccessPanel(p, 0, 0, 0, 1.4, 0, 'fuselage');
      p.position.set((I_WALL_X - 0.05) * sgn, I_DECK_Y + 1.3, lz);
      p.rotation.y = sgn > 0 ? -Math.PI / 2 : Math.PI / 2;   // face into the room
      group.add(p);
      p.updateWorldMatrix(true, false);
      const w = new THREE.Vector3().setFromMatrixPosition(p.matrixWorld);
      _salvage.push(registerSalvageable(opts.salvage, p, 'massive', w, lootRand));
    }
  }
  if (opts.journals) {
    group.updateMatrixWorld(true);
    const jWorld = group.localToWorld(new THREE.Vector3(0.2, I_DECK_Y + 1.28, I_END_Z + 1.2));
    const j = placeJournal(scene, jWorld, HULL_YAW, 'crash_log', LEVIATHAN_LOG);
    group.attach(j.mesh);   // reparent under the group (preserves world pose) → tears down with it
    opts.journals.list.push(j);
  }

  // ── Skyline / sun-occluder registration (a sun-shade for the long hike out) — the same
  //    system the flagships use. NOTE (ACBD): this no longer draws a fog-resistant billboard;
  //    it only registers the bounding box as a sun occluder. The leviathan reads on the
  //    horizon purely via its REAL geometry + its own deepened hull value (see the material
  //    block above — the midday-read fix), not a billboard. No rand draw.
  addHorizonSilhouette(scene, new THREE.Box3().setFromObject(group));

  _group = group;
}

/** Tear down the landmark (world rebuild / new game) so it does not accumulate.
 *  The interior is now a real walkable set (deck/walls/bulkheads/furniture +
 *  salvage/journal), so teardown removes ALL of it — meshes, every static body,
 *  and the loot records — leak-clean, not just the group (rule 9 lifecycle). The
 *  caller passes the world when it wants the physics bodies removed too. */
export function removeLeviathanLandmark(scene: THREE.Scene, world?: RAPIER.World): void {
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
  // Remove every interior static body (deck/walls/roof/bulkheads/furniture) so a
  // world rebuild does not leave orphaned invisible colliders (rule 9).
  if (world) for (const b of _bodies) { try { world.removeRigidBody(b); } catch { /* already gone */ } }
  _bodies = [];
  // The salvage/journal records live in the shared registries the caller owns; a
  // new-game recreates those wholesale, so we only drop our local handles here.
  _salvage = [];
  // Park any claimed interior lights (intensity 0) so a torn-down monument leaves
  // no lit pool lights behind (the pool itself is recreated on world rebuild).
  for (const pl of _claimedLights) pl.intensity = 0;
  _claimedLights = [];
  _lightsWorld = [];
  _lightsOn = false;
}

/** Per-frame proximity gate for the interior lights (call from the main tick).
 *  The leviathan is a FIXED, always-in-scene monument; ALWAYS-ON point lights
 *  would permanently cost every lit fragment everywhere. So claim pool lights only
 *  when the player is near the wreck (walking its interior) + free them when far.
 *  Hysteresis (on ≤ 95m, off > 120m) avoids churn at the boundary. No-op until the
 *  monument is placed / when the intro feature is off. */
export function updateLeviathanLandmark(pool: LightPool, px: number, pz: number): void {
  if (!_group || _lightsWorld.length === 0) return;
  const dx = px - LANDMARK_X, dz = pz - LANDMARK_Z;
  const d2 = dx * dx + dz * dz;
  if (!_lightsOn && d2 < 95 * 95) {
    for (const lw of _lightsWorld) {
      const pl = claimLight(pool);
      if (!pl) break;   // pool exhausted → graceful (some fills just don't illuminate)
      pl.color.setHex(lw.c);
      pl.intensity = lw.i;
      pl.distance = lw.r;
      pl.decay = 1.5;
      pl.position.copy(lw.pos);
      _claimedLights.push(pl);
    }
    _lightsOn = true;
  } else if (_lightsOn && d2 > 120 * 120) {
    for (const pl of _claimedLights) releaseLight(pool, pl);
    _claimedLights = [];
    _lightsOn = false;
  }
}

/** The fixed world position of the leviathan (for any nav / telemetry that wants it). */
export function getLeviathanLandmarkPos(): { x: number; z: number } {
  return { x: LANDMARK_X, z: LANDMARK_Z };
}
