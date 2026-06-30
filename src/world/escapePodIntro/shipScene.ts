// Escape-pod intro — the HERO COCKPIT INTERIOR (Phase 3 / T3.3) + the greybox CORRIDOR.
// ─────────────────────────────────────────────────────────────────────────────
// This is the GAME'S OPENING SHOT. Beat 0: the player wakes SEATED at the worn controls of
// a cramped single-pilot cargo-hauler bridge, having just reached orbit, looking out a BIG
// forward window at the curved desert planet below; a "check engines" prompt then sends them
// UP and a long walk AFT down the corridor. So the COCKPIT is a hero interior built to the
// pod-cabin quality bar (createRustedHullMaterial weathered aluminium + rust, warm moody
// lighting, a believable LARGE orbit view, the lone pilot's lived-in clutter); the CORRIDOR
// stays greybox (T3.4 reworks it next cycle).
//
// COMPOSITION (the gate fix): the pilot sits FORWARD + LOW, knees at a wrap-around dash, so
// the first half-second reads "I am a lone pilot seated at the controls, looking out a big
// window at the planet" — NOT "a man in an empty box looking at a counter". The seat + dash
// are tight up against the −Z window; the corridor exit is a long walk aft (+Z). The space
// is closed-in (a soffit + side consoles) so it feels cramped, not tall + empty.
//
// IDENTITY: a working freighter's bridge — cramped, utilitarian, weathered, SOLO ("you're
// alone out here"). Long Dark / Mad Max / Dune: grounded, industrial, lived-in. Same riveted
// weathered-aluminium idiom as the hero pod cabin, but a BOX bridge. Palette is a CALM WARM
// cockpit (the "before"); it escalates to red-alert via setCockpitAlert (NOT this cycle).
//
// LAYOUT (collision + flow depend on it): the cockpit is 6w (x −3..3) × 3h (y 0..3) × 5d
// (z −2.5..2.5). The WINDOW gap is in the −Z wall (x −1.5..1.5, y 0.9..2.5). The CORRIDOR
// opening is in the +Z wall (2w × 2.4h). getShipSpawn = the forward pilot station; the
// player rises and walks AFT (+Z) to the corridor + the dead-end (the disaster trigger).
//
// CONTRACTS (read sequence.ts before touching): buildShipScene / disposeShipScene /
// shipBuilt / getShipSpawn / SHIP_CORRIDOR_ENTER_Z / SHIP_DEAD_END_Z are the surface the
// beats wire. setCockpitAlert(level) is the OPTIONAL hook the disaster escalation drives
// (0 = ORBIT ACHIEVED calm, 1 = caution, 2 = full red-alert cabin wash). disposeShipScene
// MUST free ALL geometry/materials/lights this module creates.
// ─────────────────────────────────────────────────────────────────────────────

import * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';
import type { GameContext } from '../../GameContext.ts';
import { makeStaticBox } from '../../physics/bodies.ts';
import { createRustedHullMaterial } from '../hullMaterial.ts';

/** Far offset — high "in orbit", enclosed so the desert far below is not seen. */
const SHIP_ORIGIN = new THREE.Vector3(0, 3000, 0);

/** World-Z beat triggers (the corridor runs +Z from SHIP_ORIGIN; mouth ≈ z 2.6,
 *  dead-end ≈ z 14.6). Crossing ENTER_Z = "stepped into the corridor"; passing
 *  DEAD_END_Z = "reached the engine bay" (the disaster trigger). */
export const SHIP_CORRIDOR_ENTER_Z = SHIP_ORIGIN.z + 3.2;
export const SHIP_DEAD_END_Z = SHIP_ORIGIN.z + 13.6;

// ── Cockpit dimensions (LOCAL to SHIP_ORIGIN; floor top = y=0). UNCHANGED so the matched
//    static colliders + the beat flow still work.
const CK_W = 6;            // cockpit width  (x −3..3)
const CK_H = 3;            // cockpit height (y 0..3)
const CK_D = 5;            // cockpit depth  (z −2.5..2.5)
const CK_X = CK_W / 2;     // 3
const CK_Z = CK_D / 2;     // 2.5
const WALL_T = 0.2;        // wall/floor/ceiling thickness (matches the collider half-spec)
// Forward (−Z) window gap: x −1.5..1.5, y 0.9..2.5.
const WIN_X = 1.5, WIN_Y0 = 0.9, WIN_Y1 = 2.5;
// Corridor opening in the +Z wall: x −1..1, y 0..2.4.
const DOOR_X = 1.0, DOOR_Y1 = 2.4;

// ── The PILOT STATION frame: the pilot sits FORWARD + LOW, dash wrapping his knees, window
//    above. The dash runs across the −Z sill; the seat is just aft of it. SEAT_Z drives the
//    spawn (getShipSpawn) AND seats the geometry so it composes for the low/close pilot eye.
const CON_Z = -1.55;       // the wrap-around dash centre (right at the forward sill)
const CON_DECK_Y = 0.78;   // instrument-deck height (a low seated glance lands on it)
const SEAT_Z = -0.55;      // the seat sits just aft of the dash (knees under it)
const SEAT_Y = 0.42;       // cushion-top height

// ── Materials — weathered ALUMINIUM idiom (podScene.ts), pushed HARDER on weathering per the
//    gate's fidelity note (rust streaks, grime, oxidation, edge wear). Module-scope; shared
//    across rebuilds; disposeShipScene frees per-build geometry/materials, not these.
const _shell = createRustedHullMaterial({
  baseColor: 0x9aa0a4,           // cool aluminium-grey shell skin
  bareMetalHex: 0xc8ced2,        // bright cool scuffed-aluminium edge-wear reveal
  rustHex: 0x5a3a26,             // warm rust streaks (reads as RUST, not just shadow — gate)
  streakIntensity: 0.42, wearAmplitude: 0.40,   // strong plate-to-plate break-up + drip streaks
  fleckStrength: 0.8,            // bare-metal scuff flecks (chipped paint)
  oxStrength: 0.34, oxHex: 0x8a5230,            // warm oxidation patchwork (corroded plates)
  seamRustStrength: 0.30,        // rust pooling at seams
});
// Dark channel-steel — ribs / conduit / console body / frames. Value contrast to skin.
const _steel = createRustedHullMaterial({
  baseColor: 0x3e434a, rustHex: 0x3a2014, streakIntensity: 0.40, wearAmplitude: 0.30,
  fleckStrength: 0.6, oxStrength: 0.30, oxHex: 0x6e3c1e, seamRustStrength: 0.28,
});
// Bright grey-aluminium band/rib metal (proud riveted frames).
const _band = createRustedHullMaterial({
  baseColor: 0xafb4b8, bareMetalHex: 0xd2d8dc,
  streakIntensity: 0.30, wearAmplitude: 0.30, fleckStrength: 0.75,
  oxStrength: 0.22, oxHex: 0x8a5230, seamRustStrength: 0.20,
});
// Cool near-charcoal recessed steel (console body, kickplates, deep frames).
const _channel = createRustedHullMaterial({
  baseColor: 0x33383e, rustHex: 0x301a10, streakIntensity: 0.38, wearAmplitude: 0.28,
  fleckStrength: 0.5, oxStrength: 0.28, oxHex: 0x6e3c1e, seamRustStrength: 0.30,
});
// Rivets / studs / small cast hardware — mid steel-grey.
const _rivet = createRustedHullMaterial({
  baseColor: 0x8d9094, rustHex: 0x4a2a18, streakIntensity: 0.24,
  oxStrength: 0.22, oxHex: 0x7a4424, fleckStrength: 0.5,
});
// Floor DECK plate — bright aluminium tread-plate with a worn TRAFFIC lane down the centre
// (the gate: floor traffic wear). The wear-amplitude + flecks read as scuffed footfall.
const _deck = createRustedHullMaterial({
  baseColor: 0x8e9296, bareMetalHex: 0xc4c9cc,
  streakIntensity: 0.24, wearAmplitude: 0.40, fleckStrength: 0.85,
  oxStrength: 0.24, oxHex: 0x7a4828, seamRustStrength: 0.22,
});
// Ceiling — darker grimed panel (overhead soot/grime).
const _ceil = createRustedHullMaterial({
  baseColor: 0x6e7378, rustHex: 0x33261c, streakIntensity: 0.34, wearAmplitude: 0.40,
  oxStrength: 0.26, oxHex: 0x5e3a22,
});
// Conduit / cabling — dark matte near-black (lambert, flat).
const _cable = new THREE.MeshLambertMaterial({ color: 0x1c1a16, flatShading: true });
// Seat cushion — worn cracked vinyl, a desaturated warm tan (lambert).
const _seat = new THREE.MeshLambertMaterial({ color: 0x5f5446, flatShading: true });
// A worn leather-tan seat highlight (the cushion crown/wear) for tonal break-up.
const _seatWorn = new THREE.MeshLambertMaterial({ color: 0x7a6b54, flatShading: true });
// Restraint webbing — faded olive-tan strap.
const _strap = new THREE.MeshLambertMaterial({ color: 0x837a5c, flatShading: true });
// Warm self-lit accents — unlit so they GLOW (points of life on the dash).
const _ledGreen = new THREE.MeshBasicMaterial({ color: 0x66d877 });
const _ledAmber = new THREE.MeshBasicMaterial({ color: 0xe09838 });
const _ledBlue = new THREE.MeshBasicMaterial({ color: 0x52b0cc });
// Backlit dial-face (a faint amber lit gauge face — unlit so it glows under the bezel).
const _dialFace = new THREE.MeshBasicMaterial({ color: 0x3a2c12 });
// Yellow/black HAZARD decal (a warning placard) — unlit so it reads as printed.
const _hazard = new THREE.MeshBasicMaterial({ color: 0xc9a52e });
// A printed-decal dark base (stencil text/label backing).
const _decal = new THREE.MeshBasicMaterial({ color: 0x20242a });
// Window frame — chunky channel-steel mullion frame (dark, fitted, weathered).
const _winFrame = createRustedHullMaterial({
  baseColor: 0x363b41, rustHex: 0x3a2014, streakIntensity: 0.40, wearAmplitude: 0.28,
  oxStrength: 0.28, oxHex: 0x6e3c1e, seamRustStrength: 0.26,
});
// Window GLASS — a faint cool tint, glossy; slightly emissive so it never goes black.
const _glass = new THREE.MeshStandardMaterial({
  color: 0x2a3640, roughness: 0.16, metalness: 0.30,
  emissive: 0x0a1418, emissiveIntensity: 0.40,
  transparent: true, opacity: 0.12,   // see the orbit clearly through it
});


// ── Greybox CORRIDOR palette (UNCHANGED — flat / unlit; T3.4 reworks it). ──
const C_CORR_FLOOR = 0x52565d;
const C_CORR_WALL = 0x5e636b;
const C_FRAME = 0x26292d;

/** A greybox box's dimensions + centre: [w, h, d, centerX, centerY, centerZ] (LOCAL). */
type BoxSpec = [number, number, number, number, number, number];

const CORRIDOR_SPECS: ReadonlyArray<readonly [BoxSpec, number]> = [
  [[2, 0.2, 12, 0, -0.1, 8.6], C_CORR_FLOOR],   // corridor floor
  [[2, 0.2, 12, 0, 2.5, 8.6], C_CORR_WALL],     // corridor ceiling
  [[0.2, 2.4, 12, 1.1, 1.2, 8.6], C_CORR_WALL], // corridor +X wall
  [[0.2, 2.4, 12, -1.1, 1.2, 8.6], C_CORR_WALL],// corridor −X wall
  [[2, 2.4, 0.2, 0, 1.2, 14.7], C_FRAME],       // corridor dead-end (disaster trigger)
];

// ── Static-collider specs for the COCKPIT walkable shell (WYSIWYG — the KCC walks these),
//    matching the OLD greybox shell exactly so collision + flow are byte-identical.
const COCKPIT_COLLIDERS: ReadonlyArray<BoxSpec> = [
  [6, 0.2, 5, 0, -0.1, 0],         // floor
  [6, 0.2, 5, 0, 3.1, 0],          // ceiling
  [0.2, 3, 5, 3.1, 1.5, 0],        // +X wall
  [0.2, 3, 5, -3.1, 1.5, 0],       // −X wall
  [6, 0.9, 0.2, 0, 0.45, -2.6],    // below window
  [6, 0.5, 0.2, 0, 2.75, -2.6],    // above window
  [1.5, 1.6, 0.2, -2.25, 1.7, -2.6], // left of window
  [1.5, 1.6, 0.2, 2.25, 1.7, -2.6],  // right of window
  [2, 3, 0.2, -2, 1.5, 2.6],       // left of corridor opening
  [2, 3, 0.2, 2, 1.5, 2.6],        // right of corridor opening
  [2, 0.6, 0.2, 0, 2.7, 2.6],      // above corridor opening
];

let shipGroup: THREE.Group | null = null;
const shipBodies: RAPIER.RigidBody[] = [];
const _disposables: THREE.BufferGeometry[] = [];
const _buildMats: THREE.Material[] = [];
// Alert-state hooks (setCockpitAlert) — refs captured at build, recolored on escalation.
let _alertScreenGlow: THREE.Mesh | null = null;
let _alertStatusLeds: THREE.Mesh[] = [];
let _alertWashLight: THREE.PointLight | null = null;   // the console wash → red flood
let _alertRimLight: THREE.DirectionalLight | null = null; // a red rim across the shell on alert
let _alertKeyLights: THREE.Light[] = [];               // the warm keys → dimmed on alert
let _alertAmbient: THREE.HemisphereLight | null = null; // the cabin ambient → reddened on alert
const _AMBIENT_SKY = new THREE.Color(0xb59878);        // the calm warm-grounded ambient sky tint
let _cockpitAlertLevel: 0 | 1 | 2 = 0;

// ── T3.4 DISASTER-STAGING hooks (the corridor is greybox MeshBasicMaterial = unlit, so the
//    red-alert is a material TINT, not a light; the engine fire is additive emissive geometry).
//    setShipAlert tints the captured corridor mats red + strobes; setEngineFire erupts/flickers
//    the engine-bay fire at the dead-end. Disposed/cleared in disposeShipScene.
const _corridorMats: { mat: THREE.MeshBasicMaterial; base: THREE.Color }[] = [];
const _ALERT_RED = new THREE.Color(0xff1808);
let _engineFire: THREE.Group | null = null;
const _fireMats: THREE.MeshBasicMaterial[] = [];
let _shipAlertLevel: 0 | 2 = 0;

/** Is the ship currently built? */
export function shipBuilt(): boolean {
  return shipGroup !== null;
}

/** World-space seated spawn: the PILOT STATION — well FORWARD (close to the −Z window) so the
 *  wrap-around dash is right at the seated pilot's knees and the big window + planet dominate
 *  the view, with the corridor exit a long walk AFT (+Z). The opening-shot composition: a
 *  pilot seated AT the controls, not standing in an empty box. The corridor flow still works
 *  (the player rises + walks aft past SHIP_CORRIDOR_ENTER_Z). The in-game seated EYE is
 *  lowered/leaned in the seated pose (sequence.ts owns it) to match this low, close pilot. */
export function getShipSpawn(ctx: GameContext): THREE.Vector3 {
  const pb = ctx.player.body;
  return new THREE.Vector3(
    SHIP_ORIGIN.x,
    SHIP_ORIGIN.y + pb.halfHeight + pb.radius,
    SHIP_ORIGIN.z + SEAT_Z,    // forward pilot station (was z+1.4 centre — too far back)
  );
}

// ── Build helpers (push geometry onto _disposables to free later) ──
function _box(w: number, h: number, d: number, mat: THREE.Material): THREE.Mesh {
  const g = new THREE.BoxGeometry(w, h, d);
  _disposables.push(g);
  return new THREE.Mesh(g, mat);
}
function _cyl(rt: number, rb: number, h: number, seg: number, mat: THREE.Material): THREE.Mesh {
  const g = new THREE.CylinderGeometry(rt, rb, h, seg);
  _disposables.push(g);
  return new THREE.Mesh(g, mat);
}
/** A small flush dome rivet stud (a half-sphere) at (x,y,z), domed toward `faceDir`. */
function _stud(x: number, y: number, z: number, faceDir: THREE.Vector3, mat: THREE.Material, r = 0.018): THREE.Mesh {
  const g = new THREE.SphereGeometry(r, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2);
  _disposables.push(g);
  const m = new THREE.Mesh(g, mat);
  m.position.set(x, y, z);
  m.lookAt(x + faceDir.x, y + faceDir.y, z + faceDir.z);
  return m;
}
// ── COCKPIT SHELL — the worn riveted-aluminium box. The space is CLOSED-IN (a forward
//    soffit + a lowered aft header) so it reads cramped, not tall + empty (gate #10).
function buildCockpitShell(group: THREE.Group): void {
  // FLOOR — sub-floor + bright deck plate + a worn CENTRE traffic lane + tread strips + rivets.
  const floor = _box(CK_W, WALL_T, CK_D, _channel);
  floor.position.set(0, -WALL_T / 2, 0);
  group.add(floor);
  const deck = _box(CK_W - 0.06, 0.04, CK_D - 0.06, _deck);
  deck.position.set(0, 0.02, 0);
  group.add(deck);
  // a worn DARKER traffic-lane plate down the walk centre (footfall wear — gate fidelity)
  const lane = _box(0.9, 0.045, CK_D - 0.4, _steel);
  lane.position.set(0, 0.022, 0.3);
  group.add(lane);
  // tread strips flanking the lane
  for (const sx of [-1, 1]) {
    const tread = _box(0.08, 0.025, CK_D - 0.8, _band);
    tread.position.set(sx * 0.62, 0.05, 0.2);
    group.add(tread);
  }
  // deck-plate rivet ring near the floor edge
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const rx = Math.cos(a) * (CK_X - 0.4), rz = Math.sin(a) * (CK_Z - 0.4);
    group.add(_stud(rx, 0.05, rz, up, _rivet, 0.016));
  }

  // CEILING — darker grimed panel + crossbeam ribs + a lowered forward SOFFIT (closes the
  //   space over the pilot's head so it reads cramped + frames the window from above).
  const ceil = _box(CK_W, WALL_T, CK_D, _ceil);
  ceil.position.set(0, CK_H + WALL_T / 2, 0);
  group.add(ceil);
  const down = new THREE.Vector3(0, -1, 0);
  // forward soffit bulkhead — a deep header dropping from the ceiling above the window,
  // bringing the overhead IN over the seated pilot (cramped) without blocking the window.
  const soffit = _box(CK_W - 0.2, 0.5, 0.5, _steel);
  soffit.position.set(0, CK_H - 0.30, -CK_Z + 0.55);
  group.add(soffit);
  for (let i = -2; i <= 2; i++) group.add(_stud(i * 1.1, CK_H - 0.55, -CK_Z + 0.30, down, _rivet, 0.016));
  // crossbeam ribs aft
  for (const cz of [-0.4, 1.0, 1.9]) {
    const beam = _box(CK_W - 0.3, 0.14, 0.16, _steel);
    beam.position.set(0, CK_H - 0.09, cz);
    group.add(beam);
    for (let i = -2; i <= 2; i++) group.add(_stud(i * 1.2, CK_H - 0.18, cz, down, _rivet, 0.016));
  }

  // ── SIDE WALLS (±X) — riveted aluminium plates with panel lines, vertical channel ribs,
  //    a proud waist rail, a kickplate, and a warning placard. Brought IN visually by the
  //    side consoles (buildSideConsoles) so the station feels enclosed.
  for (const sx of [-1, 1]) {
    const wallX = sx * (CK_X - 0.02);
    const wall = _box(0.04, CK_H, CK_D, _shell);
    wall.position.set(wallX, CK_H / 2, 0);
    group.add(wall);
    const inward = new THREE.Vector3(-sx, 0, 0);
    // panel-line breakup (horizontal seams at two heights + verticals)
    for (const py of [0.9, 1.95]) {
      const pl = _box(0.012, 0.018, CK_D - 0.4, _channel);
      pl.position.set(sx * (CK_X - 0.045), py, 0.1);
      group.add(pl);
    }
    for (const pz of [-1.0, 0.8]) {
      const pv = _box(0.012, CK_H - 0.5, 0.018, _channel);
      pv.position.set(sx * (CK_X - 0.045), CK_H / 2, pz);
      group.add(pv);
    }
    // vertical channel ribs + rivets
    for (const cz of [-1.7, -0.1, 1.6]) {
      const rib = _box(0.05, CK_H - 0.3, 0.14, _steel);
      rib.position.set(sx * (CK_X - 0.09), CK_H / 2, cz);
      group.add(rib);
      for (let k = 0; k < 5; k++) {
        group.add(_stud(sx * (CK_X - 0.05), 0.4 + k * ((CK_H - 0.8) / 4), cz, inward, _rivet, 0.016));
      }
    }
    // a proud waist rail (bright horizontal band)
    const rail = _box(0.07, 0.16, CK_D - 0.4, _band);
    rail.position.set(sx * (CK_X - 0.07), 1.2, 0.1);
    group.add(rail);
    // kickplate skirt
    const kick = _box(0.05, 0.26, CK_D - 0.2, _steel);
    kick.position.set(sx * (CK_X - 0.06), 0.13, 0.1);
    group.add(kick);
    // a stencilled hazard placard on the wall (a lived-in warning decal)
    const plac = _box(0.005, 0.16, 0.30, _hazard);
    plac.position.set(sx * (CK_X - 0.07), 1.7, 1.3);
    group.add(plac);
    const placTxt = _box(0.006, 0.05, 0.22, _decal);
    placTxt.position.set(sx * (CK_X - 0.072), 1.66, 1.3);
    group.add(placTxt);
  }

  // ── FORWARD (−Z) WINDOW WALL — the four hull segments around the gap, worn hull, plus a
  //    chunky channel-steel mullion frame bezel (the focal point). The orbit view shows
  //    through. The BIG read comes from the planet sized large + the soffit/dash framing it.
  const fwZ = -CK_Z + 0.02;
  const fwdIn = new THREE.Vector3(0, 0, 1);
  const wBelow = _box(CK_W, WIN_Y0, 0.04, _shell);
  wBelow.position.set(0, WIN_Y0 / 2, fwZ);
  group.add(wBelow);
  const wAbove = _box(CK_W, CK_H - WIN_Y1, 0.04, _shell);
  wAbove.position.set(0, (WIN_Y1 + CK_H) / 2, fwZ);
  group.add(wAbove);
  for (const sx of [-1, 1]) {
    const side = _box(CK_X - WIN_X, WIN_Y1 - WIN_Y0, 0.04, _shell);
    side.position.set(sx * (WIN_X + (CK_X - WIN_X) / 2), (WIN_Y0 + WIN_Y1) / 2, fwZ);
    group.add(side);
  }
  buildWindowFrame(group, fwZ, fwdIn);

  // ── AFT (+Z) DOOR WALL — the three hull segments, worn hull, + a real bulkhead doorway.
  const afZ = CK_Z - 0.02;
  const aftIn = new THREE.Vector3(0, 0, -1);
  for (const sx of [-1, 1]) {
    const side = _box(CK_X - DOOR_X, CK_H, 0.04, _shell);
    side.position.set(sx * (DOOR_X + (CK_X - DOOR_X) / 2), CK_H / 2, afZ);
    group.add(side);
    const rib = _box(0.05, CK_H - 0.3, 0.12, _steel);
    rib.position.set(sx * (CK_X - 0.6), CK_H / 2, afZ - 0.02);
    group.add(rib);
  }
  const aHead = _box(2 * DOOR_X, CK_H - DOOR_Y1, 0.04, _shell);
  aHead.position.set(0, (DOOR_Y1 + CK_H) / 2, afZ);
  group.add(aHead);
  buildDoorway(group, afZ, aftIn);
}

/** The forward window bezel — a chunky channel-steel mullion frame set proud into the gap, a
 *  vertical centre mullion, a faint glass pane, rivet rows, trim, + an "ORBITAL OPS" placard. */
function buildWindowFrame(group: THREE.Group, fwZ: number, inward: THREE.Vector3): void {
  const cy = (WIN_Y0 + WIN_Y1) / 2;
  const hh = (WIN_Y1 - WIN_Y0) / 2;
  const proudZ = fwZ + 0.10;
  const barT = 0.12;
  const top = _box(2 * WIN_X + barT, barT, 0.16, _winFrame);
  top.position.set(0, WIN_Y1, proudZ);
  group.add(top);
  const bot = _box(2 * WIN_X + barT, barT, 0.16, _winFrame);
  bot.position.set(0, WIN_Y0, proudZ);
  group.add(bot);
  for (const sx of [-1, 1]) {
    const jamb = _box(barT, 2 * hh + barT, 0.16, _winFrame);
    jamb.position.set(sx * WIN_X, cy, proudZ);
    group.add(jamb);
  }
  const mull = _box(0.07, 2 * hh, 0.14, _winFrame);
  mull.position.set(0, cy, proudZ);
  group.add(mull);
  for (const sx of [-1, 1]) {
    for (let k = 0; k < 5; k++) {
      group.add(_stud(sx * WIN_X, WIN_Y0 + 0.1 + k * (2 * hh - 0.2) / 4, proudZ + 0.08, inward, _rivet, 0.016));
    }
  }
  const trimTop = _box(2 * WIN_X, 0.04, 0.06, _band);
  trimTop.position.set(0, WIN_Y1 - 0.07, proudZ + 0.06);
  group.add(trimTop);
  const trimBot = _box(2 * WIN_X, 0.04, 0.06, _band);
  trimBot.position.set(0, WIN_Y0 + 0.07, proudZ + 0.06);
  group.add(trimBot);
  const glass = _box(2 * WIN_X - 0.05, 2 * hh - 0.05, 0.02, _glass);
  glass.position.set(0, cy, fwZ - 0.04);
  group.add(glass);
  // a stencilled placard low-left of the window (lived-in)
  const plac = _box(0.30, 0.07, 0.012, _hazard);
  plac.position.set(-WIN_X + 0.30, WIN_Y0 + 0.14, fwZ + 0.04);
  group.add(plac);
}

/** The aft doorway — a fitted channel-steel bulkhead door frame (jambs + header + rivets +
 *  amber threshold + a green "door clear" telltale). */
function buildDoorway(group: THREE.Group, afZ: number, inward: THREE.Vector3): void {
  const proudZ = afZ - 0.09;
  const jambT = 0.14;
  for (const sx of [-1, 1]) {
    const jamb = _box(jambT, DOOR_Y1, 0.18, _winFrame);
    jamb.position.set(sx * DOOR_X, DOOR_Y1 / 2, proudZ);
    group.add(jamb);
    for (let k = 0; k < 5; k++) {
      group.add(_stud(sx * DOOR_X, 0.25 + k * (DOOR_Y1 - 0.5) / 4, proudZ - 0.07, inward, _rivet, 0.016));
    }
  }
  const lintel = _box(2 * DOOR_X + jambT, jambT, 0.18, _winFrame);
  lintel.position.set(0, DOOR_Y1, proudZ);
  group.add(lintel);
  const hband = _box(2 * DOOR_X, 0.05, 0.06, _band);
  hband.position.set(0, DOOR_Y1 - 0.12, proudZ - 0.07);
  group.add(hband);
  const thr = _box(2 * DOOR_X, 0.012, 0.10, _hazard);
  thr.position.set(0, 0.06, afZ - 0.18);
  group.add(thr);
  const tell = _cyl(0.022, 0.022, 0.02, 8, _ledGreen);
  tell.rotation.x = Math.PI / 2;
  tell.position.set(DOOR_X - 0.12, 1.4, proudZ - 0.06);
  group.add(tell);
}

/** The lone-pilot SEAT — a believable worn bucket chair at SEAT_Z facing −Z (the window),
 *  where the player spawns seated. Clearly reads as a chair in the WIDE 3/4 (gate #5). A
 *  noCollider decoration (the player rises through it), low-backed so it never blocks the aft
 *  walk lane. Steel pedestal → cracked-vinyl cushion + bolsters → a tall ribbed back +
 *  wings → a headrest → over-shoulder harness + lap buckle → ARMRESTS (the foreground the
 *  forward shot needs) carrying the throttle + a side stick. */
function buildPilotSeat(group: THREE.Group): void {
  const sz = SEAT_Z, sy = SEAT_Y;
  // pedestal column + foot + a swivel collar
  const ped = _cyl(0.15, 0.20, sy - 0.06, 12, _channel);
  ped.position.set(0, (sy - 0.06) / 2, sz + 0.04);
  group.add(ped);
  const pedFoot = _cyl(0.30, 0.32, 0.06, 16, _steel);
  pedFoot.position.set(0, 0.04, sz + 0.04);
  group.add(pedFoot);
  const collar = _cyl(0.17, 0.17, 0.05, 14, _band);
  collar.position.set(0, sy - 0.08, sz + 0.04);
  group.add(collar);
  // cushion pan (cracked vinyl) + a worn crown + side bolsters
  const cushion = _box(0.56, 0.13, 0.52, _seat);
  cushion.position.set(0, sy, sz);
  group.add(cushion);
  const crown = _box(0.40, 0.04, 0.40, _seatWorn);
  crown.position.set(0, sy + 0.075, sz);
  group.add(crown);
  for (const sx of [-1, 1]) {
    const bolster = _box(0.11, 0.13, 0.50, _seat);
    bolster.position.set(sx * 0.27, sy + 0.06, sz);
    group.add(bolster);
  }
  // the seat BACK — tall + ribbed (clearly a chair), canted to recline
  const back = _box(0.50, 0.86, 0.13, _seat);
  back.position.set(0, sy + 0.50, sz + 0.27);
  back.rotation.x = -0.16;
  group.add(back);
  // back ribs (padded channels — a recognizable seat-back read)
  for (const rx of [-0.14, 0, 0.14]) {
    const ribb = _box(0.08, 0.78, 0.05, _seatWorn);
    ribb.position.set(rx, sy + 0.50, sz + 0.34);
    ribb.rotation.x = -0.16;
    group.add(ribb);
  }
  for (const sx of [-1, 1]) {
    const wing = _box(0.10, 0.66, 0.22, _seat);
    wing.position.set(sx * 0.27, sy + 0.46, sz + 0.22);
    wing.rotation.x = -0.16;
    group.add(wing);
  }
  const headRest = _box(0.32, 0.20, 0.14, _seat);
  headRest.position.set(0, sy + 0.94, sz + 0.36);
  headRest.rotation.x = -0.16;
  group.add(headRest);
  // ── ARMRESTS — the seated foreground the forward shot needs (the hands rest here). Two
  //    padded arms reaching FORWARD toward the dash, each on a steel post; the right arm
  //    carries a side-stick, the left a small armrest console pad.
  for (const sx of [-1, 1]) {
    const armPost = _box(0.06, 0.26, 0.06, _steel);
    armPost.position.set(sx * 0.34, sy + 0.13, sz - 0.05);
    group.add(armPost);
    const arm = _box(0.10, 0.07, 0.52, _seat);
    arm.position.set(sx * 0.34, sy + 0.28, sz - 0.28);
    group.add(arm);
    const armPad = _box(0.11, 0.05, 0.30, _seatWorn);
    armPad.position.set(sx * 0.34, sy + 0.32, sz - 0.34);
    group.add(armPad);
  }
  // RIGHT side-stick (a control grip rising off the right armrest — "hands on the controls")
  const stickBase = _box(0.10, 0.06, 0.12, _channel);
  stickBase.position.set(0.34, sy + 0.34, sz - 0.50);
  group.add(stickBase);
  const stick = _cyl(0.022, 0.03, 0.20, 8, _steel);
  stick.position.set(0.34, sy + 0.44, sz - 0.52);
  stick.rotation.x = -0.25;
  group.add(stick);
  const grip = _cyl(0.04, 0.045, 0.10, 10, _seat);
  grip.position.set(0.34, sy + 0.55, sz - 0.55);
  grip.rotation.x = -0.25;
  group.add(grip);
  const trigger = _box(0.04, 0.03, 0.02, _ledAmber);
  trigger.position.set(0.34, sy + 0.55, sz - 0.50);
  group.add(trigger);
  // over-shoulder harness straps + a lap buckle
  for (const sx of [-1, 1]) {
    const strap = _box(0.09, 0.82, 0.035, _strap);
    strap.position.set(sx * 0.16, sy + 0.46, sz + 0.06);
    strap.rotation.x = 0.30;
    group.add(strap);
  }
  const buckle = _box(0.16, 0.12, 0.07, _steel);
  buckle.position.set(0, sy + 0.10, sz - 0.22);
  group.add(buckle);
}

/** The forward CONSOLE bank — the WRAP-AROUND dash right at the pilot's knees, below the
 *  window. A real instrument dash: a grouped centre cluster with the green ORBIT ACHIEVED CRT
 *  as the centrepiece, flanking bezeled backlit gauge dials, guarded switch banks, a throttle
 *  quadrant, labeled decals — clustered + dense (gate #7). A console wash + the CRT throw
 *  warm/green glow. setCockpitAlert recolors the screen + status + wash. */
function buildConsoleBank(group: THREE.Group): void {
  _alertStatusLeds = [];
  const conZ = CON_Z, deckY = CON_DECK_Y;
  const inward = new THREE.Vector3(0, 0, 1);
  // ── the wrap-around dash body (a wide low dash hugging the forward sill, wrapping toward
  //    the pilot at the ends so it reads as a station, not a flat counter)
  const body = _box(3.6, deckY, 0.78, _channel);
  body.position.set(0, deckY / 2, conZ);
  group.add(body);
  // wrap-around side wings angled toward the seat (close the station in around the pilot)
  for (const sx of [-1, 1]) {
    const wing = _box(0.5, deckY, 0.7, _channel);
    wing.position.set(sx * 1.7, deckY / 2, conZ + 0.5);
    wing.rotation.y = sx * 0.5;
    group.add(wing);
  }
  // bright seat-facing face panel + a kickplate + a seam rail + riveted access panels
  const face = _box(3.5, deckY - 0.06, 0.04, _band);
  face.position.set(0, deckY / 2, conZ + 0.38);
  group.add(face);
  const kick = _box(3.5, 0.16, 0.08, _steel);
  kick.position.set(0, 0.08, conZ + 0.37);
  group.add(kick);
  const seam = _box(3.5, 0.05, 0.05, _steel);
  seam.position.set(0, deckY * 0.55, conZ + 0.39);
  group.add(seam);
  for (const px of [-1.1, 1.1]) {
    const panel = _box(0.8, 0.34, 0.03, _shell);
    panel.position.set(px, deckY * 0.30, conZ + 0.39);
    group.add(panel);
    for (const cxp of [-0.36, 0.36]) for (const cyp of [-0.14, 0.14]) {
      group.add(_stud(px + cxp, deckY * 0.30 + cyp, conZ + 0.41, inward, _rivet, 0.013));
    }
  }
  // a small stencilled panel label on the dash face
  const lbl = _box(0.5, 0.05, 0.006, _decal);
  lbl.position.set(0, deckY * 0.30, conZ + 0.41);
  group.add(lbl);
  // ── canted instrument deck (the top surface tilts up toward the seated pilot)
  const deck = _box(3.6, 0.06, 0.72, _steel);
  deck.position.set(0, deckY + 0.04, conZ);
  deck.rotation.x = -0.55;
  group.add(deck);
  for (let i = -3; i <= 3; i++) group.add(_stud(i * 0.48, deckY + 0.02, conZ + 0.30, inward, _rivet, 0.015));

  // ── THE CENTREPIECE CRT — a hooded green "ORBIT ACHIEVED" screen standing up off the dash
  //    centre, canted toward the pilot. Hooded body + brow visor + glowing face + readout text
  //    bars (the calm level-0 green state). setCockpitAlert flips it red.
  // The screen sits LOW + flatter on the dash (cant nearly flat so it lies on the deck and
  // does NOT tower up into the window — the window/planet own the upper frame, the dash the
  // lower). A modest hood, no tall brow slab.
  const CANT = -0.80;                       // tilted up toward the seated pilot (reads as a screen)
  const scrCY = deckY + 0.18, scrZ = conZ + 0.05;
  const hood = _box(1.14, 0.52, 0.10, _channel);
  hood.position.set(0, scrCY, scrZ);
  hood.rotation.x = CANT;
  group.add(hood);
  const glowGeo = new THREE.PlaneGeometry(0.98, 0.42);
  _disposables.push(glowGeo);
  const glowMat = new THREE.MeshBasicMaterial({ color: 0x224a26 });   // dim green CRT base (calm)
  _buildMats.push(glowMat);
  const scrGlow = new THREE.Mesh(glowGeo, glowMat);
  scrGlow.position.set(0, scrCY, scrZ + 0.065);
  scrGlow.rotation.x = CANT;
  group.add(scrGlow);
  _alertScreenGlow = scrGlow;
  const lineGeo = new THREE.PlaneGeometry(0.70, 0.06);
  _disposables.push(lineGeo);
  const lineMat = new THREE.MeshBasicMaterial({ color: 0x86f292 });   // bright green text bar
  _buildMats.push(lineMat);
  for (let r = 0; r < 4; r++) {
    const line = new THREE.Mesh(lineGeo, lineMat);
    const w = [1.0, 0.62, 0.78, 0.4][r];
    line.scale.x = w;
    const dy = 0.15 - r * 0.085;
    line.position.set(-0.10 * (1 - w), scrCY + dy * Math.cos(CANT), scrZ + 0.07 + dy * -Math.sin(CANT));
    line.rotation.x = CANT;
    group.add(line);
    _alertStatusLeds.push(line);
  }

  // ── flanking BEZELED backlit gauge dials (clustered left + right of the CRT) — a ring
  //    bezel + a lit dial face + a needle each (a real grouped instrument cluster).
  for (const dx of [-1.25, -0.92, 0.92, 1.25]) {
    const ring = _cyl(0.12, 0.12, 0.05, 18, _band);   // bright bezel
    ring.rotation.x = Math.PI / 2 + CANT;
    ring.position.set(dx, deckY + 0.21, conZ - 0.03);
    group.add(ring);
    const fce = _cyl(0.093, 0.093, 0.016, 18, _dialFace);   // backlit face (glows)
    fce.rotation.x = Math.PI / 2 + CANT;
    fce.position.set(dx, deckY + 0.215, conZ - 0.02);
    group.add(fce);
    const needle = _box(0.08, 0.009, 0.005, _ledAmber);
    needle.position.set(dx, deckY + 0.22, conZ - 0.01);
    needle.rotation.set(CANT, 0, dx < 0 ? 0.7 : -0.5);
    group.add(needle);
  }
  // ── telltale LED status row on the dash just FORWARD of the CRT (calm green/green/amber/blue)
  const ledCols = [_ledGreen, _ledGreen, _ledAmber, _ledBlue];
  for (let i = 0; i < 4; i++) {
    const led = _cyl(0.022, 0.022, 0.024, 8, ledCols[i]);
    led.rotation.x = Math.PI / 2 - 0.55;
    led.position.set(-0.18 + i * 0.12, deckY + 0.10, conZ + 0.26);
    group.add(led);
  }
  // ── GUARDED switch banks (a flip-guard over toggle rows — a freighter dash tell) L + R
  for (const sx of [-1, 1]) {
    const bankX = sx * 0.65;
    const plate = _box(0.34, 0.02, 0.18, _band);
    plate.position.set(bankX, deckY + 0.10, conZ + 0.20);
    plate.rotation.x = -0.55;
    group.add(plate);
    for (let i = 0; i < 3; i++) {
      const sw = _cyl(0.012, 0.012, 0.06, 6, _rivet);
      sw.rotation.x = -0.55 - 0.4;
      sw.position.set(bankX - 0.10 + i * 0.10, deckY + 0.13, conZ + 0.18);
      group.add(sw);
    }
    // the flip-guard (a wire/bracket over the switches)
    const guard = _box(0.32, 0.02, 0.03, _steel);
    guard.position.set(bankX, deckY + 0.18, conZ + 0.14);
    guard.rotation.x = -0.55;
    group.add(guard);
  }
  // ── a chunky THROTTLE quadrant on the right end of the dash (the freighter tell)
  const throttleBase = _box(0.22, 0.08, 0.28, _steel);
  throttleBase.position.set(1.55, deckY + 0.06, conZ + 0.18);
  group.add(throttleBase);
  for (const tx of [-0.05, 0.05]) {
    const lever = _cyl(0.016, 0.022, 0.24, 8, _steel);
    lever.position.set(1.55 + tx, deckY + 0.18, conZ + 0.18);
    lever.rotation.x = -0.55;
    group.add(lever);
    const knob = _cyl(0.034, 0.034, 0.05, 10, _ledAmber);
    knob.position.set(1.55 + tx, deckY + 0.30, conZ + 0.28);
    group.add(knob);
  }
}

/** The 2-second PERSONAL TOUCH — the lone pilot's humanity, made recognizable (gate #6): a
 *  framed PHOTO propped on the dash, a chipped enamel MUG (cup + handle + rim + dark coffee
 *  surface), and a small TOKEN hanging on a cord off the window mullion. */
function buildPersonalTouch(group: THREE.Group): void {
  const conZ = CON_Z, deckY = CON_DECK_Y;
  // ── a framed PHOTO propped on the dash's left flat, canted toward the seat
  const photoMat = new THREE.MeshLambertMaterial({ color: 0xc9b890, flatShading: true });
  _buildMats.push(photoMat);
  const photo = _box(0.18, 0.23, 0.012, photoMat);
  photo.position.set(-0.62, deckY + 0.23, conZ + 0.16);
  photo.rotation.set(-0.45, 0.14, 0.03);
  group.add(photo);
  const frameTone = new THREE.MeshLambertMaterial({ color: 0x3e362c, flatShading: true });
  _buildMats.push(frameTone);
  const photoFrame = _box(0.22, 0.27, 0.022, frameTone);
  photoFrame.position.set(-0.62, deckY + 0.22, conZ + 0.155);
  photoFrame.rotation.set(-0.45, 0.14, 0.03);
  group.add(photoFrame);
  // a faded figure on the photo (a hint of a face — a pale oval) so it reads as a portrait
  const figMat = new THREE.MeshLambertMaterial({ color: 0x9a8a70, flatShading: true });
  _buildMats.push(figMat);
  const fig = _cyl(0.04, 0.04, 0.006, 10, figMat);
  fig.position.set(-0.62, deckY + 0.26, conZ + 0.17);
  fig.rotation.set(Math.PI / 2 - 0.45, 0, 0.03);
  group.add(fig);
  const stand = _box(0.06, 0.05, 0.12, frameTone);
  stand.position.set(-0.62, deckY + 0.07, conZ + 0.22);
  group.add(stand);
  // ── a chipped enamel MUG on the dash's right flat (body + interior + dark coffee + handle)
  const mugMat = new THREE.MeshLambertMaterial({ color: 0xb06a44, flatShading: true });
  _buildMats.push(mugMat);
  const mugBody = _cyl(0.05, 0.044, 0.11, 16, mugMat);
  mugBody.position.set(0.58, deckY + 0.12, conZ + 0.20);
  group.add(mugBody);
  const mugRim = _cyl(0.052, 0.052, 0.012, 16, _band);   // a bright chipped enamel rim
  mugRim.position.set(0.58, deckY + 0.175, conZ + 0.20);
  group.add(mugRim);
  const coffeeMat = new THREE.MeshLambertMaterial({ color: 0x2a1a0e, flatShading: true });
  _buildMats.push(coffeeMat);
  const coffee = _cyl(0.044, 0.044, 0.004, 16, coffeeMat);
  coffee.position.set(0.58, deckY + 0.172, conZ + 0.20);
  group.add(coffee);
  const mugGeo = new THREE.TorusGeometry(0.034, 0.01, 6, 12);
  _disposables.push(mugGeo);
  const mugHandle = new THREE.Mesh(mugGeo, mugMat);
  mugHandle.position.set(0.64, deckY + 0.12, conZ + 0.20);
  mugHandle.rotation.y = Math.PI / 2;
  group.add(mugHandle);
  // ── a TOKEN on a cord off the window centre mullion (a hanging charm), off-centre
  const cordMat = new THREE.MeshLambertMaterial({ color: 0x2a2620, flatShading: true });
  _buildMats.push(cordMat);
  const cord = _cyl(0.004, 0.004, 0.28, 5, cordMat);
  cord.position.set(0.10, WIN_Y1 - 0.20, -CK_Z + 0.16);
  group.add(cord);
  const tokenMat = new THREE.MeshLambertMaterial({ color: 0xc8a050, flatShading: true });
  _buildMats.push(tokenMat);
  const token = _cyl(0.035, 0.035, 0.008, 12, tokenMat);
  token.rotation.x = Math.PI / 2;
  token.position.set(0.10, WIN_Y1 - 0.35, -CK_Z + 0.16);
  group.add(token);
}

/** SIDE CONSOLES + clutter — short auxiliary consoles down the side walls (bring the space
 *  IN around the pilot — gate #10), conduit runs, an overhead grab rail, a stowed crate. */
function buildSideConsoles(group: THREE.Group): void {
  // short side-wall consoles flanking the seat (close the station in, add instrument density)
  for (const sx of [-1, 1]) {
    const sc = _box(0.5, 0.85, 1.4, _channel);
    sc.position.set(sx * (CK_X - 0.32), 0.43, -0.3);
    group.add(sc);
    const scTop = _box(0.52, 0.05, 1.42, _steel);
    scTop.position.set(sx * (CK_X - 0.32), 0.88, -0.3);
    group.add(scTop);
    // a couple of lit readouts on the side console top
    for (const cz of [-0.7, -0.2, 0.3]) {
      const rd = _box(0.18, 0.012, 0.10, sx < 0 ? _ledGreen : _ledAmber);
      rd.position.set(sx * (CK_X - 0.32), 0.91, -0.3 + cz);
      group.add(rd);
    }
    // a hazard stripe on the side-console face
    const haz = _box(0.02, 0.10, 1.2, _hazard);
    haz.position.set(sx * (CK_X - 0.58), 0.7, -0.3);
    group.add(haz);
  }
  // conduit runs along the upper +X/−X wall (drooping bundles + clamps)
  for (const sx of [-1, 1]) {
    const conduit = _cyl(0.045, 0.045, CK_D - 0.6, 8, _cable);
    conduit.rotation.x = Math.PI / 2;
    conduit.position.set(sx * (CK_X - 0.16), CK_H - 0.30, 0.2);
    group.add(conduit);
    for (const cz of [-1.4, 0, 1.4]) {
      const clamp = _cyl(0.055, 0.055, 0.045, 8, _rivet);
      clamp.rotation.z = Math.PI / 2;
      clamp.position.set(sx * (CK_X - 0.13), CK_H - 0.30, cz + 0.2);
      group.add(clamp);
    }
  }
  // overhead grab rail (+X side, clear of the central lane)
  const railY = CK_H - 0.5;
  const grab = _cyl(0.028, 0.028, 1.2, 8, _steel);
  grab.rotation.z = Math.PI / 2;
  grab.position.set(CK_X - 0.55, railY, 0.8);
  group.add(grab);
  for (const gz of [-0.5, 0.5]) {
    const standoff = _cyl(0.022, 0.022, 0.14, 6, _steel);
    standoff.position.set(CK_X - 0.55, railY + 0.07, 0.8 + gz);
    group.add(standoff);
  }
  // a stowed crate in the aft-right corner (cargo clutter), clear of the lane
  const crate = _box(0.5, 0.5, 0.5, _steel);
  crate.position.set(CK_X - 0.42, 0.27, CK_Z - 0.5);
  group.add(crate);
  const crateLid = _box(0.52, 0.04, 0.52, _band);
  crateLid.position.set(CK_X - 0.42, 0.53, CK_Z - 0.5);
  group.add(crateLid);
  const crateHaz = _box(0.02, 0.3, 0.3, _hazard);
  crateHaz.position.set(CK_X - 0.68, 0.27, CK_Z - 0.5);
  group.add(crateHaz);
}

/** Self-contained cockpit LIGHTING (the offset ship sees no world sun) — WARM + MOODY (gate
 *  #3): a warm KEY pooling over the station + warm bounce, a low warm-grounded ambient (NOT
 *  flat cold grey), pockets of shadow in the corners, the cool WINDOW spill, and a green CRT
 *  glow + an amber console wash pooling on the dash/floor/face. Lived-in + a-bit-claustrophobic. */
function buildLighting(group: THREE.Group): void {
  _alertKeyLights = [];
  // warm KEY over the station — pooled (faster decay → corners fall to shadow = cramped mood)
  const key = new THREE.PointLight(0xffcf96, 2.4, 5.2, 2.4);
  key.position.set(0.0, CK_H - 0.45, -0.4);
  group.add(key);
  _alertKeyLights.push(key);
  // a softer warm aft fill so the corridor end isn't dead black (but stays dim — pocketed)
  const aft = new THREE.PointLight(0xffc488, 1.0, 4.5, 2.6);
  aft.position.set(0.0, CK_H - 0.5, 1.4);
  group.add(aft);
  _alertKeyLights.push(aft);
  // WARM-GROUNDED ambient — a warm sky tint over a dark warm ground (lived-in, not cold grey
  //   fill). Low so the keys do the modelling + the corners stay moody.
  const fill = new THREE.HemisphereLight(0xb59878, 0x2a2620, 0.58);
  group.add(fill);
  _alertKeyLights.push(fill);
  _alertAmbient = fill;
  // a gentle warm raking directional from upper-right (form across the box)
  const rake = new THREE.DirectionalLight(0xffe0bc, 0.5);
  rake.position.set(2.2, CK_H, 0.6);
  rake.target.position.set(-1.2, 0.7, -0.8);
  group.add(rake);
  group.add(rake.target);
  _alertKeyLights.push(rake);
  // cool WINDOW spill — the orbit-light entering from −Z (a cool accent that complements the
  //   warm cabin — the temperature contrast that sells "warm room, cold space outside").
  const winGlow = new THREE.PointLight(0xaecbe0, 1.5, 6.0, 1.8);
  winGlow.position.set(0, 1.7, -CK_Z + 0.6);
  group.add(winGlow);
  // GREEN CRT glow — the diegetic screen throwing green light onto the dash + the pilot's
  //   chest area (a key mood cue: the instruments light the room).
  const crtGlow = new THREE.PointLight(0x4fd06a, 0.7, 2.0, 2.6);
  crtGlow.position.set(0, CON_DECK_Y + 0.4, CON_Z + 0.3);
  group.add(crtGlow);
  // amber console WASH — a warm pool over the dash (instrument glow); alert recolors it red.
  const conWash = new THREE.PointLight(0xffb24a, 1.2, 3.0, 2.2);
  conWash.position.set(0, CON_DECK_Y + 0.5, CON_Z + 0.4);
  group.add(conWash);
  _alertWashLight = conWash;
  // a RED RIM directional, OFF by default, that floods the whole shell on red-alert (gate #8).
  const rim = new THREE.DirectionalLight(0xff2418, 0.0);
  rim.position.set(-2.0, 1.4, 1.5);
  rim.target.position.set(0.5, 1.0, -1.0);
  group.add(rim);
  group.add(rim.target);
  _alertRimLight = rim;
}

/** Build the HERO cockpit + the greybox corridor (mesh group + matched static colliders)
 *  at SHIP_ORIGIN. Idempotent — a second call while built is a no-op. */
export function buildShipScene(ctx: GameContext): void {
  if (shipGroup) return;
  _cockpitAlertLevel = 0;
  const group = new THREE.Group();
  group.name = 'escapePodShipCockpit';   // findable by the rig framer
  group.position.copy(SHIP_ORIGIN);

  // ── HERO COCKPIT ──
  buildCockpitShell(group);
  buildPilotSeat(group);
  buildConsoleBank(group);
  buildPersonalTouch(group);
  buildSideConsoles(group);
  // REBUILD v2 R1a — the v1 FAKE orbit planes (flat STAR_FS/PLANET_FS/ATMO_FS meshes)
  // are GONE. The window now shows the game's REAL wrapping sky in "space mode"
  // (sky.ts setSkyIntroMode) — deep stars, a real-scale planet, no desert clouds.
  buildLighting(group);
  setCockpitAlert(0);   // wire the calm "ORBIT ACHIEVED" default

  // ── GREYBOX CORRIDOR (flat unlit boxes; hero geometry deferred). Each mat is captured so
  //    setShipAlert can tint it red on the disaster (MeshBasicMaterial is unlit → tint = the look).
  for (const [spec, color] of CORRIDOR_SPECS) {
    const [w, h, d, cx, cy, cz] = spec;
    const g = new THREE.BoxGeometry(w, h, d);
    _disposables.push(g);
    const corrMat = new THREE.MeshBasicMaterial({ color });
    _buildMats.push(corrMat);
    _corridorMats.push({ mat: corrMat, base: new THREE.Color(color) });
    const mesh = new THREE.Mesh(g, corrMat);
    mesh.position.set(cx, cy, cz);
    group.add(mesh);
    const col = makeStaticBox(
      ctx.physics.world,
      { x: w / 2, y: h / 2, z: d / 2 },
      { x: SHIP_ORIGIN.x + cx, y: SHIP_ORIGIN.y + cy, z: SHIP_ORIGIN.z + cz },
    );
    const body = col.parent();
    if (body) shipBodies.push(body);
  }
  buildEngineBay(group);   // the engine-bay fire at the dead-end (hidden until the disaster)

  // ── COCKPIT walkable static colliders (WYSIWYG — match the shell surfaces). ──
  for (const [w, h, d, cx, cy, cz] of COCKPIT_COLLIDERS) {
    const col = makeStaticBox(
      ctx.physics.world,
      { x: w / 2, y: h / 2, z: d / 2 },
      { x: SHIP_ORIGIN.x + cx, y: SHIP_ORIGIN.y + cy, z: SHIP_ORIGIN.z + cz },
    );
    const body = col.parent();
    if (body) shipBodies.push(body);
  }

  group.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = false; o.receiveShadow = false; } });
  ctx.three.scene.add(group);
  shipGroup = group;
}

/** Drive the cockpit ALERT state (the disaster escalation hook). Level 0 = calm "ORBIT
 *  ACHIEVED" (green); 1 = caution (amber shift); 2 = full RED-ALERT — the whole cabin goes
 *  hot-red (red wash + a red rim flooding the shell + dimmed warm keys = menace, not a local
 *  texture swap). Safe no-op if the ship isn't built. Wired to 0 at build. */
export function setCockpitAlert(level: 0 | 1 | 2): void {
  _cockpitAlertLevel = level;
  if (!shipGroup) return;
  // screen face base colour
  if (_alertScreenGlow) {
    const m = _alertScreenGlow.material as THREE.MeshBasicMaterial;
    if (level === 0) m.color.setHex(0x224a26);        // dim green CRT (calm)
    else if (level === 1) m.color.setHex(0x4a3208);   // amber caution
    else m.color.setHex(0x5a1410);                    // deep red alert
  }
  // the readout text bars
  for (const led of _alertStatusLeds) {
    const m = led.material as THREE.MeshBasicMaterial;
    if (level === 0) m.color.setHex(0x86f292);        // green text
    else if (level === 1) m.color.setHex(0xe6a73a);   // amber text
    else m.color.setHex(0xff5a4e);                    // red text
  }
  // the console wash light
  if (_alertWashLight) {
    if (level === 0) { _alertWashLight.color.setHex(0xffb24a); _alertWashLight.intensity = 1.2; }
    else if (level === 1) { _alertWashLight.color.setHex(0xff7a2e); _alertWashLight.intensity = 1.5; }
    else { _alertWashLight.color.setHex(0xff2418); _alertWashLight.intensity = 2.4; }
  }
  // the whole-cabin red rim flood (off until level 2 — the menace cue) — strong so the shell
  // walls/soffit visibly go hot-red, not just the dash.
  if (_alertRimLight) {
    _alertRimLight.intensity = level === 2 ? 3.0 : (level === 1 ? 0.7 : 0.0);
  }
  // redden the cabin AMBIENT on alert so the WHOLE space reads hot-red (gate #8 — menace).
  if (_alertAmbient) {
    if (level === 2) { _alertAmbient.color.setHex(0xb02418); _alertAmbient.groundColor.setHex(0x300806); _alertAmbient.intensity = 0.7; }
    else if (level === 1) { _alertAmbient.color.setHex(0xb07840); _alertAmbient.groundColor.setHex(0x2a1f18); _alertAmbient.intensity = 0.6; }
    else { _alertAmbient.color.copy(_AMBIENT_SKY); _alertAmbient.groundColor.setHex(0x2a2620); _alertAmbient.intensity = 0.58; }
  }
  // dim the warm keys HARD on red-alert so the red dominates (darkened mood, not just a swap).
  for (const k of _alertKeyLights) {
    if (k === _alertAmbient) continue;   // ambient handled above
    const base = (k.userData.baseIntensity ??= k.intensity) as number;
    k.intensity = level === 2 ? base * 0.25 : (level === 1 ? base * 0.7 : base);
  }
}

/** Current cockpit alert level (for tests / the beat machine). */
export function cockpitAlertLevel(): 0 | 1 | 2 {
  return _cockpitAlertLevel;
}

// ── T3.4 — the engine-bay FIRE at the corridor dead-end (the disaster reveal). Additive
//    emissive flame quads (the corridor is unlit greybox, so the fire is its own glow). Hidden
//    until setEngineFire erupts it; setEngineFire flickers it each frame. Greybox-grade — the
//    hero fire FX (smoke, particles, real light) rides the deferred hero corridor.
function buildEngineBay(group: THREE.Group): void {
  const fire = new THREE.Group();
  // at the dead-end door (local z≈14.5), corridor-side, low so it climbs the bulkhead
  fire.position.set(0, 0.7, 14.4);
  const cols = [0xff2c0c, 0xff7a1e, 0xffc23a];   // deep-red → orange → yellow flame tones
  for (let i = 0; i < 9; i++) {
    const w = 0.5 + (i % 3) * 0.28, h = 1.0 + (i % 2) * 0.7;
    const g = new THREE.PlaneGeometry(w, h);
    _disposables.push(g);
    const m = new THREE.MeshBasicMaterial({
      color: cols[i % 3], transparent: true, opacity: 0.0,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    });
    _fireMats.push(m); _buildMats.push(m);
    const q = new THREE.Mesh(g, m);
    q.position.set(Math.sin(i * 1.7) * 0.55, (i % 3) * 0.32, -0.04 * i);
    fire.add(q);
  }
  fire.visible = false;
  group.add(fire);
  _engineFire = fire;
}

/** Drive the engine-bay FIRE (T3.4 disaster). `intensity` 0 = out, 1 = full blaze; `t` = a
 *  time accumulator that flickers the flames. Safe no-op if the ship isn't built. */
export function setEngineFire(intensity: number, t = 0): void {
  if (!_engineFire) return;
  _engineFire.visible = intensity > 0.001;
  for (let i = 0; i < _fireMats.length; i++) {
    const flick = 0.55 + 0.45 * Math.sin(t * (6.5 + i * 0.7) + i * 1.7);
    const tier = i % 3 === 0 ? 1.0 : (i % 3 === 1 ? 0.8 : 0.6);   // red core brightest
    _fireMats[i].opacity = Math.min(1, intensity * tier * flick);
  }
  // flicker-scale the blaze (taller/shorter licks)
  _engineFire.scale.set(1 + 0.10 * Math.sin(t * 8.0), 1 + 0.16 * Math.sin(t * 6.3 + 1.0), 1);
}

/** Drive the ship RED-ALERT (T3.4 disaster) — tint the greybox corridor mats toward hot-red,
 *  pulsing with `strobe` (0..1). Level 0 restores the base greybox. Safe no-op if not built. */
export function setShipAlert(level: 0 | 2, strobe = 0): void {
  _shipAlertLevel = level;
  for (const { mat, base } of _corridorMats) {
    if (level === 0) { mat.color.copy(base); continue; }
    // lerp base→red, KEEPING ~32-66% of the base greybox so the corridor structure (walls/
    // floor/ceiling value differences) still reads as FORM under the red, not a flat-red wash;
    // the strobe pulse breathes the intensity (a hard red flash that ebbs).
    mat.color.copy(base).lerp(_ALERT_RED, 0.34 + 0.34 * strobe);
  }
}

/** Current ship red-alert level (for tests). */
export function shipAlertLevel(): 0 | 2 {
  return _shipAlertLevel;
}

/** Tear down the ship (meshes + per-build geometry + per-build materials + colliders +
 *  lights). The SHARED weathered-hull materials persist (module-scope, reused next build). */
export function disposeShipScene(ctx: GameContext): void {
  if (shipGroup) {
    shipGroup.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) m.geometry.dispose();
    });
    ctx.three.scene.remove(shipGroup);
    shipGroup = null;
  }
  for (const g of _disposables) g.dispose();
  _disposables.length = 0;
  for (const mat of _buildMats) mat.dispose();
  _buildMats.length = 0;
  _alertScreenGlow = null;
  _alertStatusLeds = [];
  _alertWashLight = null;
  _alertRimLight = null;
  _alertKeyLights = [];
  _corridorMats.length = 0;
  _engineFire = null;
  _fireMats.length = 0;
  _shipAlertLevel = 0;
  for (const body of shipBodies) ctx.physics.world.removeRigidBody(body);
  shipBodies.length = 0;
}
