// Escape-pod intro — the HERO ESCAPE POD INTERIOR (Phase 1 / T1.2; C12 CYLINDRICAL redo).
// ─────────────────────────────────────────────────────────────────────────────
// The tight worn lifeboat cabin the player RIDES, SEATED, in first-person through
// enterPod → shipExplode → descent → the parachute gag → impact. ~20-30s of up-close,
// head-turn-range hero read — NOT set dressing. Built lazily when the intro reaches the
// pod, disposed at the desert handoff, at its OWN offset above the ship so both can
// coexist briefly (you watch the ship explode from the pod's viewport).
//
// IDENTITY (matches the T1.1 exterior `placeCrashedPodWreck` below, D271): the inside of
// a VERTICAL RIVETED-ALUMINIUM CAPSULE. The cabin is a ROUND back-faced cylindrical
// SHELL (NOT the old flat box walls) capped by a low OGIVE DOME matching the exterior's
// nose, with riveted RING-FRAMES + curved vertical RIBS, exposed conduit, and the SAME
// weathered-aluminium material idiom as the exterior skin (light cool-grey aluminium,
// dark channel-steel hardware). A wide channel-steel VIEWPORT is set into the forward
// (−Z) arc (the seated camera faces −Z → looks straight out at the descent planet). The
// praised C10 hardware (red parachute lever, yellow guarded eject, amber console, seat)
// is re-homed curve-seated on the round wall within natural seated reach. Warm dim,
// cramped, lived-in.
//
// CONTRACTS (read sequence.ts before touching): buildPodScene/disposePodScene/
// getPodSpawn/setDescentProgress are the ONLY surface the beats touch; setParachute-
// LeverPull(t) is the OPTIONAL hook the parachute beat can call to jolt/droop the lever.
// ─────────────────────────────────────────────────────────────────────────────

import * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';
import type { GameContext } from '../../GameContext.ts';
import { makeStaticBox, attachCompoundCollider } from '../../physics/bodies.ts';
import { Tuning } from '../../config/tuning.ts';
import { createRustedHullMaterial } from '../hullMaterial.ts';

/** The pod offset — above the ship (which is at y=3000) so you watch it blow up below. */
const POD_ORIGIN = new THREE.Vector3(0, 3200, 0);

// ── Cabin dimensions (pod-LOCAL frame; floor top = y=0, +Z = aft/behind seat, −Z =
//    forward/viewport, +X = the seated player's RIGHT). A tight cramped CAPSULE cabin —
//    the INSIDE of the vertical riveted-aluminium pod. The FP eye lands ~1.7 above the
//    floor, so the cabin is sized so the viewport + controls centre NEAR the eye (the
//    player reads the planet dead-ahead + glances down-right to the lever). NOT a bridge
//    — a humble welded capsule. The shell is a ROUND back-faced cylinder, NOT a box.
const CAB_R = 1.28;       // interior radius (≈2.56m-diameter capsule bore — 1-person believable)
const WALL_H = 1.95;      // straight cylindrical-wall height (floor 0 → shoulder where the dome springs)
const DOME_H = 0.62;      // ogive dome rise (LOWERED — a cramped capsule, not a rotunda; was 0.95)
const CAB_APEX = WALL_H + DOME_H;   // ceiling apex
const SHELL = 0.16;       // panel/ring depth (hull-substantial, rule 7)
const WALL_SEG = 48;      // shell radial segments — round + smooth (raised from 32; faceting bands showed)
// (the seated FP eye lands ~1.7 above the floor — the viewport + controls are centred near it)
// ── Azimuth convention (matches THREE.CylinderGeometry's theta): θ measured from +Z
//    toward +X, so a direction is `dir = (sin θ, 0, cos θ)`. θ=0 → +Z (aft/seat-back),
//    θ=π → −Z (FORWARD/viewport), θ=+π/2 → +X (right), θ=−π/2 → −X (left). Using the
//    SAME convention for the wall-gap, the ring-frames, AND the curve-seated hardware
//    means the cut arc, the rings, and the viewport frame all line up.
// ── Viewport: a ROUND PORTHOLE cut into the FORWARD (−Z, θ=π) wall — a porthole in a
//    riveted barrel, NOT a wide rectangle flanked by two posts (the C12 face/visor
//    pareidolia, P1). The wall is built CONTINUOUS (full hoops + ribs run PAST the
//    window) and the porthole is a real circular aperture: an arc of the wall is omitted
//    only over the disc's angular extent (so the planet reads through a true lofted gap,
//    not a decal — procedural-mesh-authoring.md fake-hole gotcha), and a continuous
//    channel-steel BEZEL RING set into the curve frames it.
const VP_AZ_C = Math.PI;          // porthole centre azimuth = straight forward (−Z)
const VP_R = 0.52;                // porthole radius (the round window's radius along the wall)
const VP_CY = 1.34;              // porthole centre height (on the seated ~1.4 eye glance)
// the porthole's angular half-extent on the cylinder (arc subtended by VP_R at radius CAB_R)
const VP_AZ_HALF = Math.asin(Math.min(0.95, VP_R / CAB_R));   // ≈ the disc's azimuth radius

// ── Materials — the SAME weathered-ALUMINIUM idiom as the exterior hero pod (below,
//    D271). Module-scope so a rebuild doesn't realloc; disposePodScene disposes GEOMETRY
//    only, never these shared materials. Dim/warm tuned for an INTERIOR (less sun-bleach
//    than the sun-baked exterior; lit by a warm dim ambient, not desert noon) but the
//    SAME light cool aluminium skin as the exterior so the cabin reads as the inside of
//    THIS capsule, not a beige box.
const _cabPaintOpts = {
  baseColor: 0xa3a8ac,           // COOL aluminium-grey shell skin (lifted + cooled — the warm key was pushing the prior 0x9ba0a2 to brown)
  bareMetalHex: 0xccd2d6,        // bright cool scuffed-aluminium reveal (near-white, cool)
  rustHex: 0x3a3a3e,             // COOL near-grey grime tone (was warm 0x4a3826 → read as brown wash; now a neutral shadow accent)
  streakIntensity: 0.22, wearAmplitude: 0.34,   // plate-to-plate tonal break-up (denting), streaks pulled down (less drip-brown)
  fleckStrength: 0.55,           // moderate scuff scratches (high fleck read as speckle dots under the lamp)
  oxStrength: 0.08, oxHex: 0x6a6a66,            // very sparse, NEUTRAL patina (interior clean; warm oxide was the brown culprit)
} as const;
// BACK-FACED aluminium shell — the curved wall + dome are viewed from INSIDE (back faces).
const _cabShell = createRustedHullMaterial(_cabPaintOpts);
_cabShell.side = THREE.BackSide;
// Exposed dark channel-steel — ribs / ring-frames / viewport frame / console body. A
// value contrast to the bright aluminium skin so the steel structure reads as fitted-on.
const _cabSteel = createRustedHullMaterial({
  baseColor: 0x40454b,           // COOL dark-grey steel (lifted a touch; value contrast vs bright skin)
  rustHex: 0x242830, streakIntensity: 0.26, wearAmplitude: 0.24,
  oxStrength: 0.08, oxHex: 0x55555a, seamRustStrength: 0.12,   // neutral grime (warm oxide stripped → no brown)
});
// Mid grey-aluminium ring/band metal (the riveted hoops) — lighter than the dark channel
// so the latitude rings read as fitted RIVETED FRAMES, not dark drum-divisions (matches
// the exterior _podBandMat).
const _cabBandOpts = {
  baseColor: 0xb0b5b8,           // BRIGHT cool grey-aluminium band — lighter than the shell so the riveted hoops POP as proud bright frames (sells the curve)
  bareMetalHex: 0xd2d8dc,
  streakIntensity: 0.18, wearAmplitude: 0.26, fleckStrength: 0.6,
  oxStrength: 0.06, oxHex: 0x6a6a66, seamRustStrength: 0.10,   // near-clean: the hoops are the curvature read, keep them bright + cool
} as const;
const _cabBand = createRustedHullMaterial(_cabBandOpts);
// BACK-FACED band for the riveted ring-frame hoops (open tubes seen from inside) — a
// separate material so the front-faced _cabBand (rib plates, dome seams) keeps its side.
const _cabBandShell = createRustedHullMaterial(_cabBandOpts);
_cabBandShell.side = THREE.BackSide;
// Recessed channel-steel (console body, deep frame) — COOL dark steel (NOT the warm
// WRECK_HULL_DARK_HEX which read wood-brown). A value contrast to the bright aluminium.
const _cabChannel = createRustedHullMaterial({
  baseColor: 0x363b41,           // cool near-charcoal steel
  rustHex: 0x222631,
  streakIntensity: 0.24, wearAmplitude: 0.22, oxStrength: 0.08, oxHex: 0x55555a, seamRustStrength: 0.12,
});
// Dedicated DoubleSide variant of the channel steel for the curved viewport bezel ring
// (seen from both faces). A SEPARATE material so we never mutate the shared _cabChannel
// (P2 code bug: buildViewport set _cabChannel.side = DoubleSide on the module-shared mat).
const _cabChannelDS = _cabChannel.clone();
_cabChannelDS.side = THREE.DoubleSide;
// BackSide variant for the porthole bezel RING tube (an open tube whose inner face the
// camera sees — a proud rim set into the curved hull around the window).
const _cabChannelBack = _cabChannel.clone();
_cabChannelBack.side = THREE.BackSide;
// Rivets / studs / small hardware — mid steel-grey (cast/forged fittings; matches the
// exterior _podFrameMat so the rivet language is identical inside + out).
const _cabRivet = createRustedHullMaterial({
  baseColor: 0x8d9094, rustHex: 0x3a3a3e, streakIntensity: 0.18,   // cool mid steel-grey studs (warm rivet read as brassy)
  oxStrength: 0.08, oxHex: 0x6a6a66, fleckStrength: 0.5,
});
// Conduit / cabling — dark matte near-black (lambert, flat).
const _cabCable = new THREE.MeshLambertMaterial({ color: 0x201d18, flatShading: true });
// Floor DECK plate — bright cool aluminium tread-plate (a lit, finished floor, not a void).
const _cabDeck = createRustedHullMaterial({
  baseColor: 0x969a9e, bareMetalHex: 0xc4c9cc,
  streakIntensity: 0.18, wearAmplitude: 0.28, fleckStrength: 0.7,
  oxStrength: 0.08, oxHex: 0x66666a, seamRustStrength: 0.10,   // neutralised (deck was reading warm-tan under the lamp)
});
// Seat cushion — worn padded vinyl, a desaturated warm tan, slightly soft (lambert).
const _cabSeat = new THREE.MeshLambertMaterial({ color: 0x6e6353, flatShading: true });
// Restraint webbing — faded olive-tan strap.
const _cabStrap = new THREE.MeshLambertMaterial({ color: 0x837a5c, flatShading: true });
// Warm self-lit accents — the small green/amber console telltales + the lever grip,
// so the dim cabin has points of warm life (unlit so they glow regardless of light).
const _ledGreen = new THREE.MeshBasicMaterial({ color: 0x57c46a });
const _ledAmber = new THREE.MeshBasicMaterial({ color: 0xd98a32 });
const _ledRed = new THREE.MeshBasicMaterial({ color: 0xc0392b });
// Dim screen face — a faint amber CRT glow.
const _cabScreen = new THREE.MeshBasicMaterial({ color: 0x2a2410 });
// Inner-rim shadow well behind the porthole bezel — near-black, unlit, so the aperture
// reads as a deep inset recess (a dark ring inside the bezel → "inset window").
const _cabRimShadow = new THREE.MeshBasicMaterial({ color: 0x07090a, side: THREE.DoubleSide });
// Porthole GLASS — a faint cool tint, glossy so a small spec catch reads (a window, not an
// open hole). Slightly emissive so it never goes fully black against the void.
const _cabGlass = new THREE.MeshStandardMaterial({
  color: 0x2a3640, roughness: 0.16, metalness: 0.30,
  emissive: 0x0a1418, emissiveIntensity: 0.45,
  transparent: true, opacity: 0.32,   // see the planet through it, but a glazed pane reads
});
// A faint bright spec-streak highlight on the porthole glass (a glazed-pane tell).
const _cabGlassSpec = new THREE.MeshBasicMaterial({
  color: 0xbfd0dc, transparent: true, opacity: 0.13, depthWrite: false,   // softer (the bright crescent read as a stray diagonal across the void)
});
// The EJECT control handle (a hazard-striped pull) — warm safety-yellow grip.
const _ejectGrip = new THREE.MeshLambertMaterial({ color: 0xe0b52e, flatShading: true });   // brighter safety-yellow (was dim mustard → read as a dark patch)
// The PARACHUTE lever grip — worn red rubber (the gag star; reads "pull me").
const _chuteGrip = new THREE.MeshLambertMaterial({ color: 0xb23a2e, flatShading: true });
// The descent planet seen through the viewport — flat unlit, warm desert ochre.
const C_PLANET = 0xc98a5a;

let podGroup: THREE.Group | null = null;
const podBodies: RAPIER.RigidBody[] = [];
let planetMesh: THREE.Mesh | null = null;   // grown during the descent (setDescentProgress)
let planetHaloMesh: THREE.Mesh | null = null; // the atmosphere-rim halo behind the planet (per-build mat)
let voidPlaneMesh: THREE.Mesh | null = null; // the dark space backdrop behind the viewport (per-build mat)
let chuteLever: THREE.Group | null = null;  // the parachute lever pivot (setParachuteLeverPull)
let chuteLeverRestX = 0;                     // its resting pitch (radians); pulls jolt from here
let leverBrokenTell: THREE.Group | null = null;  // the snapped-mount reveal (shown on snap)
const _cabinDisposables: THREE.BufferGeometry[] = [];   // per-build geometry to free on dispose

/** Is the pod currently built? */
export function podBuilt(): boolean {
  return podGroup !== null;
}

/** World-space seated spawn: pod centre-ish, on the floor, slightly aft so the viewport
 *  fills the view ahead + the seat backs the player. Capsule centre = floor-top +
 *  halfHeight + radius. (The seat sits at z≈+0.55; the spawn is just forward of it so
 *  the player's back is against the seat-back and the viewport reads dead ahead.) */
export function getPodSpawn(ctx: GameContext): THREE.Vector3 {
  const pb = ctx.player.body;
  return new THREE.Vector3(
    POD_ORIGIN.x,
    POD_ORIGIN.y + pb.halfHeight + pb.radius,
    POD_ORIGIN.z + 0.35,
  );
}

// ── Build helpers (closure-free; push geometry onto _cabinDisposables to free later) ──
function _box(w: number, h: number, d: number, mat: THREE.Material): THREE.Mesh {
  const g = new THREE.BoxGeometry(w, h, d);
  _cabinDisposables.push(g);
  return new THREE.Mesh(g, mat);
}
function _cyl(rt: number, rb: number, h: number, seg: number, mat: THREE.Material): THREE.Mesh {
  const g = new THREE.CylinderGeometry(rt, rb, h, seg);
  _cabinDisposables.push(g);
  return new THREE.Mesh(g, mat);
}

// ── Round-cabin build helpers ────────────────────────────────────────────────
/** A LatheGeometry mesh (tracked for disposal). */
function _lathe(prof: THREE.Vector2[], seg: number, mat: THREE.Material): THREE.Mesh {
  const g = new THREE.LatheGeometry(prof, seg);
  g.computeVertexNormals();
  _cabinDisposables.push(g);
  return new THREE.Mesh(g, mat);
}
/** An open (no-cap) cylinder mesh (tracked) — used for the ring-frames + the shell. */
function _tube(r: number, h: number, seg: number, mat: THREE.Material, thetaStart = 0, thetaLen = Math.PI * 2): THREE.Mesh {
  const g = new THREE.CylinderGeometry(r, r, h, seg, 1, true, thetaStart, thetaLen);
  _cabinDisposables.push(g);
  return new THREE.Mesh(g, mat);
}
/** Seat a mesh flush on the cylinder wall at azimuth `az` (θ from +Z toward +X — the
 *  CylinderGeometry convention; dir = (sin az, 0, cos az)), radius `r`, height `y`. The
 *  mesh is yawed so its local +Z faces the cabin centre (inward), matching the box-face
 *  convention used by the hardware groups. */
function _seatOnWall(mesh: THREE.Mesh, az: number, r: number, y: number): void {
  mesh.position.set(Math.sin(az) * r, y, Math.cos(az) * r);
  mesh.rotation.y = az + Math.PI;        // local +Z → inward (toward centre)
}

/** Build the HERO cabin interior (mesh group) in the pod-LOCAL frame (floor top=0).
 *  A ROUND riveted-aluminium CAPSULE bore: a back-faced cylinder wall + an ogive dome
 *  ceiling, riveted ring-frames + curved ribs, a forward viewport arc, with the C10
 *  hardware (lever / eject / console / seat) re-homed curve-seated on the round wall. */
function buildCabinInterior(group: THREE.Group): void {
  // ── 1. SHELL — the ROUND capsule bore. A back-faced cylinder wall (you see the
  //    INSIDE of the curve) from the floor up to the shoulder, with a small ROUND
  //    PORTHOLE cut in the forward arc; a lathe OGIVE DOME ceiling; a floor disc + deck.
  // 1.a the curved wall — built CONTINUOUS (a full banded barrel) except for the round
  //     porthole forward: a full-circle band BELOW the window, a full-circle band ABOVE
  //     it, and two side arcs at window height that bracket the porthole azimuth. The
  //     planet reads through the real lofted gap; the wall reads as an unbroken barrel
  //     with a hole, NOT two posts flanking a rectangle (P1 — kills the visor gestalt).
  const vpY0 = VP_CY - VP_R, vpY1 = VP_CY + VP_R;   // porthole vertical span
  // lower full band: floor → porthole bottom
  const wallLo = _tube(CAB_R, vpY0, WALL_SEG, _cabShell);
  wallLo.position.y = vpY0 / 2;
  group.add(wallLo);
  // upper full band: porthole top → shoulder
  const wallHi = _tube(CAB_R, WALL_H - vpY1, WALL_SEG, _cabShell);
  wallHi.position.y = (vpY1 + WALL_H) / 2;
  group.add(wallHi);
  // the two side arcs at window height — everything EXCEPT the porthole azimuth window
  const vpStart = VP_AZ_C + VP_AZ_HALF;             // CCW end of the porthole arc
  const vpLen = Math.PI * 2 - VP_AZ_HALF * 2;       // the wall arc = everything BUT the porthole
  const wallMid = _tube(CAB_R, vpY1 - vpY0, WALL_SEG, _cabShell, vpStart, vpLen);
  wallMid.position.y = (vpY0 + vpY1) / 2;
  group.add(wallMid);
  // 1.b the OGIVE DOME ceiling — a lathe cap from the shoulder radius pulling in to a
  //     blunt apex, matching the exterior's tucked nose. Back-faced (seen from inside).
  const domeProf: THREE.Vector2[] = [];
  const domeSegs = 7;
  for (let i = 0; i <= domeSegs; i++) {
    const t = i / domeSegs;
    const a = t * (Math.PI / 2);
    const r = CAB_R * Math.pow(Math.cos(a), 1.45) + 0.001;   // tucked ogive (matches exterior nose)
    const y = WALL_H + Math.sin(a) * DOME_H;
    domeProf.push(new THREE.Vector2(Math.max(0.04, r), y));
  }
  const dome = _lathe(domeProf, WALL_SEG, _cabShell);
  group.add(dome);
  // (the dome is left as smooth back-faced aluminium with the shoulder ring §2 capping it
  //  — radial seam ribs read as floating bars in the seated FP frame, and the exterior's
  //  ogive nose is itself mostly smooth aluminium, so smooth is the faithful read.)
  // a short riveted spoke RING at the dome base (just above the shoulder) reinforces the
  //  "nose bolts to the body" read without crossing the cabin.
  for (let s = 0; s < 16; s++) {
    const az = (s / 16) * Math.PI * 2 + 0.15;
    const sg = new THREE.SphereGeometry(0.012, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2);
    _cabinDisposables.push(sg);
    const stud = new THREE.Mesh(sg, _cabRivet);
    const r = CAB_R * 0.92;
    const y = WALL_H + 0.08;
    stud.position.set(Math.sin(az) * r, y, Math.cos(az) * r);
    stud.lookAt(0, y, 0);
    group.add(stud);
  }
  // 1.c FLOOR — a real curved riveted-aluminium DECK plate (the seated player stares down
  //     at this for 20-30s, so it must be a finished floor, NOT a dark void, P2). A solid
  //     aluminium deck disc (bright skin tone) + a ring of deck-plate rivets + a forward
  //     FOOTWELL recess (where the feet rest below the seat). A dark structural sub-floor
  //     disc beneath the deck so any rim gap reads as hull, not space.
  const subFloor = _cyl(CAB_R + SHELL, CAB_R + SHELL, SHELL, WALL_SEG, _cabChannel);
  subFloor.position.y = -SHELL / 2;
  group.add(subFloor);
  // the visible aluminium deck plate (bright skin so the floor is LIT, not a void)
  const deck = _cyl(CAB_R - 0.02, CAB_R - 0.02, 0.05, WALL_SEG, _cabDeck);
  deck.position.y = 0.025;
  group.add(deck);
  // deck-plate rivet ring near the floor edge (the riveted-deck tell)
  for (let i = 0; i < 32; i++) {
    const a = (i / 32) * Math.PI * 2 + 0.07;
    const sg = new THREE.SphereGeometry(0.015, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2);
    _cabinDisposables.push(sg);
    const rv = new THREE.Mesh(sg, _cabRivet);   // flush up-facing deck stud (low dome, not a peg)
    rv.position.set(Math.sin(a) * (CAB_R - 0.16), 0.052, Math.cos(a) * (CAB_R - 0.16));
    group.add(rv);
  }
  // raised tread strips across the deck (anti-slip plate ribs — break up the flat disc so
  // the floor reads as a fabricated deck, not a smooth pan). Run fore-aft, offset rows.
  for (let r = -2; r <= 2; r++) {
    const tread = _box(0.07, 0.018, 1.5, _cabSteel);
    tread.position.set(r * 0.34, 0.06, 0.05);
    group.add(tread);
  }
  // FOOTWELL — a shallow recessed pan FORWARD of the seat (−Z) where the feet rest. A dark
  // recessed box sunk into the deck + a bright rim lip so it reads as a real footwell.
  const wellRim = _cyl(0.44, 0.44, 0.06, 20, _cabBand);
  wellRim.position.set(0, 0.05, -0.62);
  group.add(wellRim);
  const wellPan = _cyl(0.38, 0.38, 0.10, 20, _cabSteel);
  wellPan.position.set(0, -0.02, -0.62);
  group.add(wellPan);
  // a couple of foot-rest treads in the well
  for (const wz of [-0.5, -0.74]) {
    const ft = _box(0.5, 0.025, 0.07, _cabRivet);
    ft.position.set(0, 0.02, wz);
    group.add(ft);
  }
  // 1.d a chunky channel-steel FLOOR RING capping the wall-to-floor seam (full circle —
  //     well below the porthole, so the curve springs from a real welded foot).
  const footRing = _tube(CAB_R - 0.03, 0.18, WALL_SEG, _cabBandShell);
  footRing.position.y = 0.09;
  group.add(footRing);

  // ── 2. RIVETED RING-FRAMES — proud aluminium hoops banding the curved wall at
  //    intervals (the "riveted aluminium capsule" read, matching the exterior latitude
  //    bands), each with a ring of rivet studs. Built as FULL-circle open tubes JUST
  //    inside the wall radius (proud into the cabin) — they run PAST the porthole so the
  //    window reads as a hole cut in a continuous BANDED BARREL (P1). A hoop crossing the
  //    porthole height passes behind the bezel; only the rivet studs inside the round
  //    aperture are skipped (so no studs float across the glass).
  const RING_RIVETS = 48;   // FIX 3 — denser, smaller flush studs (was 30 chunky pegs)
  // is the wall point at (az, y) INSIDE the round porthole disc? (on the forward arc, an
  // ellipse in azimuth-offset × height; az-offset scaled to arc-length by CAB_R)
  const inPorthole = (az: number, y: number) => {
    let d = az - VP_AZ_C; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
    const arc = d * CAB_R;                              // approx along-wall horizontal offset
    return (arc * arc + (y - VP_CY) * (y - VP_CY)) < (VP_R + 0.04) * (VP_R + 0.04);
  };
  // half-angle the porthole subtends at a given height y (0 if the row is clear of the
  // disc) — used to GAP a hoop that crosses the window height so it doesn't bar the glass.
  const portholeAzHalfAt = (y: number) => {
    const dy = Math.abs(y - VP_CY);
    if (dy >= VP_R + 0.06) return 0;
    const halfW = Math.sqrt(Math.max(0, (VP_R + 0.06) * (VP_R + 0.06) - dy * dy));  // along-wall horiz half-width
    return Math.min(Math.PI * 0.9, halfW / CAB_R + 0.04);
  };
  // A ring-frame hoop. `proud` = how far it stands INTO the cabin off the wall (a BENT
  //  bright band that visibly arcs L→R is the fastest "this is round" cue — FIX 1). Rivets
  //  are small FLUSH dome studs seated tight to the wall (FIX 3 — not chunky proud pegs).
  const addRing = (y: number, h: number, proud = 0.05, riveted = true) => {
    const ringR = CAB_R - proud;
    const gapHalf = portholeAzHalfAt(y);
    if (gapHalf > 0) {
      // the hoop CROSSES the porthole → build it as an arc that brackets the window (so it
      // doesn't bar the glass, but the band continues past the porthole on each side).
      const start = VP_AZ_C + gapHalf;
      const len = Math.PI * 2 - gapHalf * 2;
      const hoop = _tube(ringR, h, WALL_SEG, _cabBandShell, start, len);
      hoop.position.y = y;
      group.add(hoop);
    } else {
      const hoop = _tube(ringR, h, WALL_SEG, _cabBandShell);
      hoop.position.y = y;
      group.add(hoop);
    }
    if (!riveted) return;
    for (let i = 0; i < RING_RIVETS; i++) {
      const az = (i / RING_RIVETS) * Math.PI * 2;
      if (inPorthole(az, y)) continue;                 // skip studs that fall on the glass
      // small low-poly FLUSH dome stud (a half-sphere flush to the wall — reads as a
      // fastened seam rivet, NOT a furniture bolt sticking proud).
      const sg = new THREE.SphereGeometry(0.013, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2);
      _cabinDisposables.push(sg);
      const stud = new THREE.Mesh(sg, _cabRivet);
      const dir = new THREE.Vector3(Math.sin(az), 0, Math.cos(az));
      stud.position.set(dir.x * (CAB_R - 0.012), y, dir.z * (CAB_R - 0.012));
      stud.lookAt(0, y, 0);                             // dome faces into the cabin (flush cap)
      group.add(stud);
    }
  };
  // The hoop set. The CHEST-height hoop (≈VP_CY) is the headline bent band — built PROUD +
  // bright + DOUBLED (a taller channel) so it visibly arcs across the eye-level frame. The
  // foot + shoulder hoops are flush bands that close the barrel top + bottom.
  addRing(0.46, 0.13, 0.05);
  addRing(0.92, 0.10, 0.045);                          // an extra mid-low hoop → denser banding (more "round" cues)
  addRing(VP_CY - 0.02, 0.17, 0.085);                  // HEADLINE chest hoop: tall + proud, brackets the porthole, arcs L→R
  addRing(VP_CY + 0.40, 0.10, 0.05, false);            // a thin un-riveted upper hoop (extra horizontal cue, clear of the porthole-stud field)
  addRing(WALL_H - 0.12, 0.14, 0.06);                  // shoulder ring where the dome springs

  // ── 3. VERTICAL RIBS — channel-steel battens running UP the wall (the welded skeleton).
  //    C12 FIX 1: dominant verticals read RECTILINEAR/BOXY on a cylinder — they made the
  //    eye-level wall read as a panelled box. So: (a) NO ribs on the FORWARD arc (the
  //    viewport view must be all curved hoop + arc, no vertical posts flanking the porthole
  //    — that was the boxy read); (b) ribs only on the REAR/SIDE arcs (θ near 0 / ±2.x,
  //    behind the seated head-turn-forward read); (c) THINNER (a slim batten, not a wide
  //    plate+spine slab) so even when a head-turn catches one it doesn't chord the arc.
  //    The horizontal RING-FRAMES (§2) now carry the structure read instead.
  const ribAzs = [0.0, 2.25, -2.25];   // rear + far-side only; nothing on the forward arc
  const ribY = WALL_H / 2 - 0.02, ribH = WALL_H - 0.30;
  for (const az of ribAzs) {
    // a SLIM batten hugging the wall (band-metal so it reads welded-on, but narrow → no chord)
    const base = _box(0.08, ribH, 0.035, _cabBand);
    _seatOnWall(base, az, CAB_R - 0.035, ribY);
    group.add(base);
    // a thin proud spine (darker steel) — slim so it reads as a seam batten, not a beam
    const spine = _box(0.04, ribH, 0.05, _cabSteel);
    _seatOnWall(spine, az, CAB_R - 0.075, ribY);
    group.add(spine);
    // rivet studs down the rib (small + flush — FIX 3 idiom)
    for (let k = 0; k < 5; k++) {
      const ry = 0.32 + k * ((ribH - 0.5) / 4);
      const stud = _cyl(0.013, 0.013, 0.02, 6, _cabRivet);
      stud.rotation.x = Math.PI / 2;
      _seatOnWall(stud, az, CAB_R - 0.045, ry);
      group.add(stud);
    }
  }
  // (no big cross-cabin ceiling stringers — they read as a pipe arcing across the view;
  //  the riveted ring-frames §2 carry the structure read.)

  // ── 4. The forward PORTHOLE viewport — a continuous bezel ring set into the curved −Z
  //    hull + a recessed well + a glass pane (the descent planet shows through). NO jamb
  //    posts, NO sill/grille below (that formed the visor + chin face gestalt, P1).
  buildViewport(group);

  // ── 5. The SEAT + restraints — a real CONTOURED BUCKET seat you sit IN (not stacked
  //    boxes that read as a staircase, P2): a steel PEDESTAL → a cushion pan with raised
  //    side BOLSTERS → a back with side WINGS → a headrest → over-shoulder straps + a lap
  //    buckle. Re-homed at the rear (+Z) curve, just aft of the seated spawn.
  const seatZ = 0.70, seatY = 0.44;
  // pedestal column (a single tapered post, not a wide box-base that reads as a step)
  const pedestal = _cyl(0.16, 0.22, seatY - 0.02, 12, _cabChannel);
  pedestal.position.set(0, (seatY - 0.02) / 2, seatZ + 0.04);
  group.add(pedestal);
  const pedFoot = _cyl(0.30, 0.30, 0.05, 14, _cabSteel);
  pedFoot.position.set(0, 0.03, seatZ + 0.04);
  group.add(pedFoot);
  // cushion pan (the seat base) — a rounded slab; slightly scaled to read soft
  const cushion = _box(0.54, 0.14, 0.50, _cabSeat);
  cushion.position.set(0, seatY, seatZ);
  group.add(cushion);
  // raised side bolsters on the cushion (the "bucket" — you sit BETWEEN them)
  for (const sx of [-1, 1]) {
    const bolster = _box(0.10, 0.12, 0.46, _cabSeat);
    bolster.position.set(sx * 0.26, seatY + 0.08, seatZ);
    group.add(bolster);
  }
  // the seat BACK — canted back slightly so you recline INTO it (not a vertical wall)
  const seatBack = _box(0.50, 0.88, 0.14, _cabSeat);
  seatBack.position.set(0, seatY + 0.46, seatZ + 0.26);
  seatBack.rotation.x = -0.12;          // recline
  group.add(seatBack);
  // back side WINGS (wrap-around — reinforces "you sit in it")
  for (const sx of [-1, 1]) {
    const wing = _box(0.10, 0.78, 0.20, _cabSeat);
    wing.position.set(sx * 0.27, seatY + 0.44, seatZ + 0.20);
    wing.rotation.x = -0.12;
    group.add(wing);
  }
  const headRest = _box(0.30, 0.20, 0.13, _cabSeat);
  headRest.position.set(0, seatY + 0.96, seatZ + 0.34);
  group.add(headRest);
  // over-shoulder restraint straps (5-point harness tells)
  for (const sx of [-1, 1]) {
    const strap = _box(0.09, 0.92, 0.035, _cabStrap);
    strap.position.set(sx * 0.16, seatY + 0.46, seatZ + 0.04);
    strap.rotation.x = 0.30;
    group.add(strap);
  }
  const buckle = _box(0.15, 0.11, 0.07, _cabSteel);
  buckle.position.set(0, seatY + 0.10, seatZ - 0.26);
  group.add(buckle);

  // ── 6. RIGHT-side CONSOLE (+X) + the PARACHUTE LEVER — curve-seated against the round
  //    wall. A waist-high cabinet hugging the curve + a canted instrument deck + the
  //    chunky red parachute lever rising off it. The defining usable hardware.
  buildConsoleAndLever(group);

  // ── 7. The EJECT control (LEFT/−X side) — a guarded hazard-yellow T-handle on a panel
  //    curve-seated on the left wall, in seated reach (the enterPod "pull eject" beat).
  buildEjectControl(group);

  // ── 8. CONDUIT + CABLING + a ceiling dome light — lived-in tells following the curve.
  buildConduitAndLight(group);

  // ── 9. A grab handle overhead (brace against the jolts) — a humanising prop on the
  //    aft-left (θ≈−0.85) so it doesn't block the forward viewport read. A tangential bar
  //    on two stubby standoffs off the curve.
  const grabAz = -0.85;
  const gDir = new THREE.Vector3(Math.sin(grabAz), 0, Math.cos(grabAz));
  const grab = _cyl(0.026, 0.026, 0.42, 8, _cabSteel);
  grab.position.set(gDir.x * (CAB_R - 0.14), WALL_H - 0.18, gDir.z * (CAB_R - 0.14));
  grab.rotation.y = grabAz;          // run the bar tangentially (along the wall arc)
  grab.rotation.z = Math.PI / 2;
  group.add(grab);
  // tangent direction along the wall arc (perpendicular to the radial gDir, in XZ)
  const tang = new THREE.Vector3(Math.cos(grabAz), 0, -Math.sin(grabAz));
  for (const t of [-0.18, 0.18]) {
    const standoff = _cyl(0.02, 0.02, 0.1, 6, _cabSteel);
    standoff.position.set(
      gDir.x * (CAB_R - 0.09) + tang.x * t,
      WALL_H - 0.18,
      gDir.z * (CAB_R - 0.09) + tang.z * t,
    );
    standoff.rotation.set(0, 0, 0);          // short radial stub (vertical-ish is fine; tiny)
    group.add(standoff);
  }
}

// ── Section builders (split out so buildCabinInterior reads as the cabin assembly) ──

/** The forward viewport — a ROUND PORTHOLE: a continuous channel-steel BEZEL RING set
 *  into the curved −Z hull, a recessed inner-rim SHADOW well (aperture depth), and a
 *  faint tinted curved GLASS pane. The planet reads through the round gap. This replaces
 *  the C12 rectangle-flanked-by-two-posts (the visor/face gestalt, P1) — there is NO
 *  vertical jamb post, NO sill/grille/placard chin below the window. The bezel ring +
 *  the continuous wall hoops/ribs read it as "a porthole in a riveted barrel". */
function buildViewport(group: THREE.Group): void {
  // The porthole sits on the wall at az=π (−Z); the wall point there is (0, y, −CAB_R) and
  // its inward normal is +Z. Build the round bezel/well/glass in a forward-facing plane
  // (XY plane) at z ≈ −CAB_R, slightly proud into the cabin. Over a 0.52m window on a
  // 1.28m bore the flat-ring approximation hugs the curve closely enough.
  const zWall = -CAB_R;                 // the −Z wall surface plane
  const TUBE_SEG = 36;                  // smooth ring (no facet streaks on the rim)
  // ── BEZEL RING — a proud channel-steel torus framing the round aperture (continuous,
  //    NOT two posts). Set just inside the wall so it stands proud into the cabin.
  const bezelGeo = new THREE.TorusGeometry(VP_R + 0.05, 0.06, 12, TUBE_SEG);
  _cabinDisposables.push(bezelGeo);
  const bezel = new THREE.Mesh(bezelGeo, _cabChannel);
  bezel.position.set(0, VP_CY, zWall + 0.10);   // proud into the cabin
  group.add(bezel);
  // a second thinner inner trim ring (the glazing retainer) — a LIGHTER aluminium value
  // (the deck-plate tone) so the rim reads as a fabricated bright port, not all-dark.
  const trimGeo = new THREE.TorusGeometry(VP_R - 0.02, 0.03, 10, TUBE_SEG);
  _cabinDisposables.push(trimGeo);
  const trim = new THREE.Mesh(trimGeo, _cabDeck);
  trim.position.set(0, VP_CY, zWall + 0.13);
  group.add(trim);
  // ── INNER-RIM SHADOW WELL — a short open tube going OUTWARD (−Z) from the bezel into
  //    the hull thickness so the aperture reads as a deep inset window, not a flat hole.
  //    Axis along Z (rotate the cylinder from Y to Z). Dark unlit inner face.
  const wellGeo = new THREE.CylinderGeometry(VP_R + 0.01, VP_R + 0.01, 0.26, TUBE_SEG, 1, true);
  _cabinDisposables.push(wellGeo);
  const well = new THREE.Mesh(wellGeo, _cabRimShadow);
  well.rotation.x = Math.PI / 2;        // axis Y → Z
  well.position.set(0, VP_CY, zWall - 0.02);   // recessed into the hull (behind the bezel)
  group.add(well);
  // ── GLASS PANE — a shallow convex tinted disc filling the aperture, slightly proud of
  //    the wall plane so it reads as a real pane in front of the void, with a faint spec.
  const glassGeo = new THREE.SphereGeometry(VP_R, TUBE_SEG, 16, 0, Math.PI * 2, 0, Math.PI * 0.30);
  _cabinDisposables.push(glassGeo);
  const glass = new THREE.Mesh(glassGeo, _cabGlass);
  glass.rotation.x = -Math.PI / 2;      // bulge toward +Z (into the cabin) so the spec catches the dome light
  glass.position.set(0, VP_CY, zWall + 0.06);
  group.add(glass);
  // a faint SPEC streak on the glass (top-left) so the pane reads as glazed, not an open
  // hole (P3 — "a window not an open hole"). A thin bright unlit crescent (module-shared mat).
  const specGeo = new THREE.PlaneGeometry(VP_R * 0.7, 0.05);
  _cabinDisposables.push(specGeo);
  const spec = new THREE.Mesh(specGeo, _cabGlassSpec);
  spec.position.set(-VP_R * 0.18, VP_CY + VP_R * 0.42, zWall + 0.18);
  spec.rotation.z = -0.6;
  group.add(spec);
  // ── BOLT STUDS around the bezel (a ring of fasteners) — small flush dome studs (FIX 3),
  //    denser, seated on the bezel face (not chunky proud cylinders).
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2;
    const sg = new THREE.SphereGeometry(0.014, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2);
    _cabinDisposables.push(sg);
    const bolt = new THREE.Mesh(sg, _cabRivet);
    bolt.rotation.x = -Math.PI / 2;     // dome faces +Z (into the cabin)
    bolt.position.set(
      Math.cos(a) * (VP_R + 0.05),
      VP_CY + Math.sin(a) * (VP_R + 0.05),
      zWall + 0.135,
    );
    group.add(bolt);
  }
  // ── A small stencilled "VIEWPORT"-style HAZARD placard set on the wall to the LOWER-
  //    LEFT of the porthole (off-centre, NOT centred below — a centred plate re-forms the
  //    chin/mouth). A single subtle amber strip, curve-seated.
  const plac = _box(0.18, 0.07, 0.012, _ledAmber);
  _seatOnWall(plac, VP_AZ_C + 0.55, CAB_R - 0.05, VP_CY - VP_R - 0.02);
  group.add(plac);
}

/** The right-side console + the chunky red PARACHUTE LEVER, curve-seated on the +X wall.
 *  Sets the module `chuteLever` pivot (the setParachuteLeverPull hook drives it). */
function buildConsoleAndLever(group: THREE.Group): void {
  // The console sits on the +X (right) flank, canted toward FORWARD (θ from +Z→+X; right
  // = π/2, forward = π), so the seated player glances down-forward-right to it + the lever
  // is in natural reach. dir = (sin az, 0, cos az); group local +X → outward at az−π/2.
  const conAz = Math.PI / 2 + 0.42;   // right flank, swung toward the forward viewport
  const conDir = new THREE.Vector3(Math.sin(conAz), 0, Math.cos(conAz));
  const conR = CAB_R - 0.42;          // console body centre, inboard of the wall
  const deckY = 1.30;
  // a console GROUP yawed so its local +X points radially OUTWARD (toward the wall); local
  // −X then faces the cabin centre / seat (where the instruments + lever read).
  const con = new THREE.Group();
  con.position.set(conDir.x * conR, 0, conDir.z * conR);
  con.rotation.y = conAz - Math.PI / 2;
  group.add(con);
  // cabinet body (a curved-back cabinet hugging the wall) — in console-local frame, +X
  // is outward (toward wall), local −X faces the seat. WIDER + a closed seat-facing FACE
  // panel + a kickplate skirt so looking DOWN at it shows a solid lit cabinet, not a dark
  // void cavity under the deck (P2 floor-shot fix).
  const body = _box(0.46, deckY, 1.0, _cabChannel);
  body.position.set(0.13, deckY / 2, 0);
  con.add(body);
  // seat-facing FACE panel (closes the front of the cabinet, lighter band-metal so it's lit)
  const facePanel = _box(0.03, deckY - 0.04, 0.94, _cabBand);
  facePanel.position.set(-0.10, deckY / 2, 0);
  con.add(facePanel);
  // kickplate skirt at the floor (a recessed darker base — the cabinet meets the deck)
  const kick = _box(0.40, 0.12, 0.96, _cabSteel);
  kick.position.set(-0.06, 0.06, 0);
  con.add(kick);
  // angled instrument DECK canted up toward the seat
  const deck = _box(0.46, 0.05, 1.0, _cabSteel);
  deck.position.set(0.0, deckY + 0.05, 0);
  deck.rotation.z = 0.34;             // cant up on the inboard (seat-facing) edge
  con.add(deck);
  // dim amber CRT screen recessed in the deck (forward end)
  const screen = _box(0.24, 0.02, 0.2, _cabScreen);
  screen.position.set(-0.06, deckY + 0.12, -0.3);
  screen.rotation.z = 0.34;
  con.add(screen);
  const screenGlow = _box(0.17, 0.015, 0.13, _ledAmber);
  screenGlow.position.set(-0.075, deckY + 0.135, -0.3);
  screenGlow.rotation.z = 0.34;
  con.add(screenGlow);
  // a row of telltale LEDs (aft of the screen)
  for (let i = 0; i < 4; i++) {
    const mat = [_ledGreen, _ledGreen, _ledAmber, _ledRed][i];
    const led = _cyl(0.018, 0.018, 0.018, 6, mat);
    led.rotation.x = Math.PI / 2;
    led.rotation.z = 0.34;
    led.position.set(-0.14, deckY + 0.155, -0.02 + i * 0.085);
    con.add(led);
  }
  // 3 toggle switches
  for (let i = 0; i < 3; i++) {
    const sw = _cyl(0.012, 0.012, 0.06, 6, _cabRivet);
    sw.rotation.z = 0.34 - 0.4;
    sw.position.set(0.0, deckY + 0.13, 0.16 + i * 0.075);
    con.add(sw);
  }
  // two round gauge dials on the seat-facing vertical face (local −X face)
  for (const dy of [0.92, 0.58]) {
    const ring = _cyl(0.075, 0.075, 0.03, 14, _cabRivet);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(-0.18, dy, -0.38);
    con.add(ring);
    const face = _cyl(0.058, 0.058, 0.012, 14, _cabScreen);
    face.rotation.x = Math.PI / 2;
    face.position.set(-0.2, dy, -0.38);
    con.add(face);
    const needle = _box(0.05, 0.008, 0.004, _ledAmber);
    needle.position.set(-0.21, dy + 0.01, -0.38);
    needle.rotation.z = dy > 0.8 ? 0.6 : -0.4;
    con.add(needle);
  }

  // ── the chunky PARACHUTE LEVER — rises off the deck's forward end into easy seated
  //    reach. A steel clevis bracket + a stout shaft + a fat worn-red rubber grip, canted
  //    back toward the pilot. A pivot GROUP (chuteLever) so setParachuteLeverPull jolts /
  //    droops it. Built in console-local space (folds into the console's curve-seat yaw).
  const leverBaseX = -0.04, leverBaseY = deckY + 0.08, leverBaseZ = -0.42;
  const bracket = _box(0.14, 0.16, 0.18, _cabSteel);
  bracket.position.set(leverBaseX, leverBaseY, leverBaseZ);
  con.add(bracket);
  const leverPivot = new THREE.Group();
  leverPivot.position.set(leverBaseX, leverBaseY + 0.04, leverBaseZ);
  chuteLeverRestX = -0.32;
  leverPivot.rotation.x = chuteLeverRestX;
  con.add(leverPivot);
  const shaft = _cyl(0.028, 0.034, 0.46, 8, _cabSteel);
  shaft.position.set(0, 0.23, 0);
  leverPivot.add(shaft);
  const collar = _cyl(0.05, 0.05, 0.05, 10, _cabSteel);
  collar.position.set(0, 0.16, 0);
  leverPivot.add(collar);
  const hazBand = _cyl(0.038, 0.038, 0.06, 8, _ejectGrip);
  hazBand.position.set(0, 0.30, 0);
  leverPivot.add(hazBand);
  const grip = _cyl(0.078, 0.085, 0.16, 12, _chuteGrip);
  grip.position.set(0, 0.5, 0);
  leverPivot.add(grip);
  const capGeo = new THREE.SphereGeometry(0.082, 12, 8);
  _cabinDisposables.push(capGeo);
  const gripCap = new THREE.Mesh(capGeo, _chuteGrip);
  gripCap.position.set(0, 0.58, 0);
  leverPivot.add(gripCap);
  chuteLever = leverPivot;
  // ── the SNAPPED-MOUNT tell (hidden until setParachuteLeverPull(_, true) shows it): a
  //    bent/sprung clevis pin + a torn bracket lip at the lever base, so the 3rd-pull SNAP
  //    reads as a wrenched-off mount, not just an extreme lever angle (P4).
  const brokenTell = new THREE.Group();
  brokenTell.position.set(leverBaseX, leverBaseY, leverBaseZ);
  brokenTell.visible = false;
  const tornLip = _box(0.12, 0.05, 0.06, _cabSteel);
  tornLip.position.set(0, 0.06, 0.0);
  tornLip.rotation.set(0.6, 0, 0.4);            // peeled up (metal tore)
  brokenTell.add(tornLip);
  const sprungPin = _cyl(0.014, 0.014, 0.14, 6, _cabRivet);
  sprungPin.rotation.set(0.3, 0, 1.1);          // the clevis pin sprung out at an angle
  sprungPin.position.set(0.06, 0.05, 0.03);
  brokenTell.add(sprungPin);
  con.add(brokenTell);
  leverBrokenTell = brokenTell;
  // a hazard-yellow "CHUTE" placard on the deck beside the lever (a dark stencil bar on the
  // yellow plate reads as a label, P4)
  const placard = _box(0.18, 0.012, 0.11, _ledAmber);
  placard.position.set(-0.02, deckY + 0.12, -0.56);
  placard.rotation.z = 0.34;
  con.add(placard);
  const placardText = _box(0.13, 0.014, 0.025, _cabScreen);
  placardText.position.set(-0.018, deckY + 0.135, -0.56);
  placardText.rotation.z = 0.34;
  con.add(placardText);
}

/** The eject control — a guarded hazard-yellow T-handle on a panel curve-seated on the
 *  −X (left) wall, facing inboard (toward the seat). The enterPod "pull eject" beat. */
function buildEjectControl(group: THREE.Group): void {
  // Left (−X) flank, canted toward forward (left = −π/2, forward = π). dir=(sin,cos);
  // group local +X → outward at az−π/2, so local −X faces the seat (where the T-handle reaches).
  const ejAz = -Math.PI / 2 - 0.40;
  const ej = new THREE.Group();
  const ejR = CAB_R - 0.05;
  ej.position.set(Math.sin(ejAz) * ejR, 1.42, Math.cos(ejAz) * ejR);
  ej.rotation.y = ejAz - Math.PI / 2;
  group.add(ej);
  // In ej-local: −X faces the cabin centre. Build the control reaching inboard (−X).
  // C12 FIX 3: BIGGER + clearer so it reads as a real distinct control (the other control),
  // not a tiny dim yellow rectangle. A chunky steel mounting plate → a bright safety-yellow
  // guarded housing → a real guarded toggle inside.
  const panel = _box(0.12, 0.72, 0.62, _cabChannel);   // bigger steel mounting plate
  panel.position.set(-0.04, 0, 0);
  ej.add(panel);
  // hazard-stripe top + bottom bars on the plate (the warning-placard tell — reads "danger")
  for (const sy of [-1, 1]) {
    const hz = _box(0.02, 0.10, 0.60, _ejectGrip);
    hz.position.set(-0.11, sy * 0.30, 0);
    ej.add(hz);
  }
  const inset = _box(0.05, 0.50, 0.50, _ejectGrip);    // bright-yellow guarded housing (bigger)
  inset.position.set(-0.11, 0, 0);
  ej.add(inset);
  const well = _box(0.07, 0.38, 0.38, _cabScreen);     // recessed dark guard cavity
  well.position.set(-0.135, 0, 0);
  ej.add(well);
  // a visible red ARMING TOGGLE inside the well — a chunky base + a canted red switch body
  // so the guard clearly protects a real control (bigger to match the enlarged housing).
  const togBase = _cyl(0.06, 0.07, 0.05, 10, _cabSteel);
  togBase.rotation.z = Math.PI / 2;
  togBase.position.set(-0.155, -0.02, 0);
  ej.add(togBase);
  const togSwitch = _cyl(0.028, 0.038, 0.15, 8, _ledRed);
  togSwitch.rotation.z = Math.PI / 2 + 0.5;     // canted (a thrown toggle)
  togSwitch.position.set(-0.21, 0.0, 0);
  ej.add(togSwitch);
  const togTip = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 6), _ledRed);
  _cabinDisposables.push(togTip.geometry);
  togTip.position.set(-0.275, 0.035, 0);
  ej.add(togTip);
  // flip-up guard arching inboard over the toggle (a chunky steel cage — reads "guarded")
  const guard = _box(0.26, 0.04, 0.42, _cabSteel);
  guard.position.set(-0.32, 0.20, 0);
  ej.add(guard);
  for (const sz of [-1, 1]) {
    const leg = _box(0.22, 0.04, 0.04, _cabSteel);
    leg.position.set(-0.24, 0.10, sz * 0.18);
    leg.rotation.z = 0.7;
    ej.add(leg);
  }
  // stencilled "EJECT" label strip on the lower housing (a dark-on-yellow placard tell)
  const ejLabel = _box(0.025, 0.07, 0.40, _cabScreen);
  ejLabel.position.set(-0.122, -0.34, 0);
  ej.add(ejLabel);
  // the T-handle reaching inboard (−X) + a vertical crossbar grip (chunkier)
  const stem = _cyl(0.038, 0.038, 0.28, 8, _cabSteel);
  stem.rotation.z = Math.PI / 2;
  stem.position.set(-0.30, 0.20, 0);
  ej.add(stem);
  const barT = _cyl(0.055, 0.055, 0.34, 8, _ejectGrip);
  barT.position.set(-0.44, 0.20, 0);
  ej.add(barT);
  for (const sz of [-1, 1]) {
    const cap = _cyl(0.065, 0.052, 0.035, 8, _cabSteel);
    cap.rotation.x = Math.PI / 2;
    cap.position.set(-0.44, 0.20, sz * 0.17);
    ej.add(cap);
  }
  // status LEDs (on the lower housing face)
  const ledR = _cyl(0.026, 0.026, 0.02, 8, _ledRed);
  ledR.rotation.z = Math.PI / 2;
  ledR.position.set(-0.125, -0.20, 0.12);
  ej.add(ledR);
  const ledG = _cyl(0.022, 0.022, 0.02, 8, _ledGreen);
  ledG.rotation.z = Math.PI / 2;
  ledG.position.set(-0.125, -0.20, -0.12);
  ej.add(ledG);
}

/** Conduit pipes following the curve, a junction box, drooping cables, a ceiling dome
 *  light — the lived-in cramped-capsule tells. */
function buildConduitAndLight(group: THREE.Group): void {
  // NOTE (NEW azimuth convention θ from +Z→+X): forward/viewport = θ=π, aft/seat = θ=0.
  // Keep all conduit/cables on the REAR + side arcs (θ near 0 / ±2.x) so NOTHING crosses
  // the forward viewport read.
  // two conduit pipes running UP the REAR curve (θ near 0, behind/beside the seat where
  // they NEVER cross the forward viewport OR sit behind the console/eject as a stray
  // diagonal). Vertical pipes + a couple of bracket clamps each so they read as conduit.
  for (const [az, yc] of [[0.85, WALL_H / 2], [-0.85, WALL_H / 2 + 0.05]] as const) {
    const conduit = _cyl(0.05, 0.05, WALL_H - 0.35, 8, _cabCable);
    _seatOnWall(conduit, az, CAB_R - 0.1, yc);
    group.add(conduit);
    for (const cy of [yc - 0.4, yc + 0.4]) {
      const clamp = _box(0.1, 0.05, 0.05, _cabSteel);
      _seatOnWall(clamp, az, CAB_R - 0.08, cy);
      group.add(clamp);
    }
  }
  // junction box on the rear wall (directly behind the seat, θ≈0)
  const jbox = _box(0.22, 0.28, 0.13, _cabSteel);
  _seatOnWall(jbox, -0.3, CAB_R - 0.07, 1.45);
  group.add(jbox);
  for (const [aoff, mat] of [[-0.05, _ledGreen], [0.05, _ledAmber]] as const) {
    const led = _box(0.025, 0.025, 0.02, mat);
    _seatOnWall(led, -0.3 + aoff, CAB_R - 0.12, 1.55);
    group.add(led);
  }
  // a short drooping cable on the REAR-left flank (θ≈−0.5, behind the seat) — minimal
  //  tilt so it reads as a slack loop, not a bar crossing the cabin.
  const cable = _cyl(0.024, 0.024, 0.5, 6, _cabCable);
  _seatOnWall(cable, -0.5, CAB_R - 0.14, WALL_H - 0.32);
  cable.rotation.x += 0.35;   // sag forward-down a touch (stays tucked against the rear wall)
  group.add(cable);
  // ceiling dome light at the apex (the warm interior source; unlit glow mat)
  const domeRing = _cyl(0.14, 0.16, 0.05, 14, _cabSteel);
  domeRing.position.set(0, CAB_APEX - 0.06, -0.1);
  group.add(domeRing);
  const lamp = _cyl(0.11, 0.13, 0.03, 14, _ledAmber);
  lamp.position.set(0, CAB_APEX - 0.09, -0.1);
  group.add(lamp);
}

/** Build the pod (hero cabin mesh group + a static shell collider) at POD_ORIGIN.
 *  Idempotent. The player rides SEATED (locomotion off), so the collider is just a
 *  conservative shell (floor + 4 walls + ceiling) so the capsule can't fall through —
 *  no per-prop colliders are needed inside a seated cabin. */
export function buildPodScene(ctx: GameContext): void {
  if (podGroup) return;
  const group = new THREE.Group();
  group.name = 'escapePodCabin';   // findable by the rig framer (visual-diagnostic-methodology.md)
  group.position.copy(POD_ORIGIN);

  buildCabinInterior(group);

  // ── Lighting: the cabin is OFF in deep space at the offset (no terrain sun reaching
  //    it), so add a warm dim interior point light + a faint fill hemisphere parented
  //    to the group, giving the cramped-lived-in glow + form on the lambert surfaces.
  // ── Lighting (C12 FIX 2): a dim LIVED-IN cabin with FORM + a cool aluminium read —
  //    NOT a flat warm fill. The prior rig (high flat warm-ish hemisphere ×1.05) washed
  //    the whole bore brown. New scheme: a tight WARM KEY pool from the ceiling lamp (POOLED,
  //    fast decay → shadowed cramped corners), a LOW COOL ambient (so the bare aluminium
  //    reads grey, not warm-bathed), an OFF-CENTRE directional that rakes the curved wall
  //    left-to-right (a gradient across the arc → the curvature reads, FIX 1 support), and a
  //    brighter cool PORTHOLE spill (a cool accent pool forward).
  // Warm ceiling lamp KEY — pooled (lower range + faster decay) so it pools at the apex
  // and the lower wall / corners fall off into shadow (form, not a flat fill).
  const lamp = new THREE.PointLight(0xffd2a0, 1.7, 3.8, 2.9);   // cooler tint + tighter pool (was washing the upper wall warm-tan)
  lamp.position.set(0.1, CAB_APEX - 0.20, 0.05);   // at the ceiling dome light, nudged off-axis
  group.add(lamp);
  // LOW COOL ambient — a cool-grey sky / dark-cool ground hemisphere, so the aluminium skin
  // reads as cool bare metal (the warm key is a POOL on top, not a bath). Lifted a touch so
  // the cool grey dominates the warm pool away from the lamp.
  const fill = new THREE.HemisphereLight(0x93a0b0, 0x2a2d30, 0.72);   // cooler + a touch brighter
  group.add(fill);
  // OFF-CENTRE warm directional — rakes ACROSS the bore from upper-right so the curved wall
  // picks up a clear left→right brightness GRADIENT (the single biggest "this is round" cue
  // at eye level — a flat-lit cylinder reads boxy; a raked one reads curved).
  const key = new THREE.DirectionalLight(0xffe8cc, 0.6);   // gentler, slightly cooler warm rake
  key.position.set(1.6, CAB_APEX, 0.2);          // from the right, so the arc brightens R→L
  key.target.position.set(-0.8, 0.7, 0.0);
  group.add(key);
  group.add(key.target);
  // a faint COOL counter-rake from the left so the far-left arc doesn't go dead black (keeps
  // the gradient readable as curvature, not a hard light/dark split).
  const coolRake = new THREE.DirectionalLight(0x8ea4ba, 0.28);
  coolRake.position.set(-1.4, WALL_H, -0.3);
  coolRake.target.position.set(0.6, 0.8, 0.4);
  group.add(coolRake);
  group.add(coolRake.target);
  // Cool PORTHOLE spill (the planet-glow from −Z) — brighter so the forward arc + bezel get
  // a cool accent pool (a window casts cool light into a warm-lamp cabin).
  const vpGlow = new THREE.PointLight(0xa6c0d6, 0.95, 4.2, 2.2);
  vpGlow.position.set(0, VP_CY, -CAB_R + 0.05);
  group.add(vpGlow);

  // ── Conservative cage collider (seated → can't walk, but keep the capsule caged so a
  //    physics nudge can't drop the player out). The cabin is a round bore; a boxy AABB
  //    cage that ENCLOSES it (±CAB_R) is fine — the player never touches the walls seated.
  const D = (CAB_R + SHELL) * 2;
  const shellSpecs: ReadonlyArray<[number, number, number, number, number, number]> = [
    [D, SHELL, D, 0, -SHELL / 2, 0],                          // floor
    [D, SHELL, D, 0, CAB_APEX + SHELL / 2, 0],                // ceiling cap
    [SHELL, CAB_APEX, D, CAB_R + SHELL / 2, CAB_APEX / 2, 0], // +X wall
    [SHELL, CAB_APEX, D, -(CAB_R + SHELL / 2), CAB_APEX / 2, 0], // −X wall
    [D, CAB_APEX, SHELL, 0, CAB_APEX / 2, CAB_R + SHELL / 2], // aft (+Z) wall
  ];
  for (const [w, h, d, cx, cy, cz] of shellSpecs) {
    const col = makeStaticBox(
      ctx.physics.world,
      { x: w / 2, y: h / 2, z: d / 2 },
      { x: POD_ORIGIN.x + cx, y: POD_ORIGIN.y + cy, z: POD_ORIGIN.z + cz },
    );
    const body = col.parent();
    if (body) podBodies.push(body);
  }

  // A DARK SPACE backdrop far behind the viewport so the window reads as a window onto a
  // VOID, not a flat beige fill (P3). A large unlit plane in deep blue-black; the planet
  // is a SMALLER disc against it so the descent swell visibly reads (forward vs descent).
  const voidGeo = new THREE.PlaneGeometry(80, 80);
  _cabinDisposables.push(voidGeo);
  const voidPlane = new THREE.Mesh(voidGeo, new THREE.MeshBasicMaterial({ color: 0x03040a }));
  voidPlane.position.set(0, 0, -20);
  group.add(voidPlane);
  voidPlaneMesh = voidPlane;

  // The planet — a graded unlit disc (lit crown → warm terminator) reading as a curved
  // LIMB. SMALL at rest (occupies only PART of the porthole) so setDescentProgress can
  // visibly SWELL it (P3 — forward vs descent must differ; before it filled the window at
  // rest so the swell was invisible). Placed low-and-ahead so the curved top limb reads
  // against the void above it.
  const PLANET_R = 1.7;
  const planetGeo = new THREE.CircleGeometry(PLANET_R, 48);
  {
    const pos = planetGeo.attributes.position;
    const cols = new Float32Array(pos.count * 3);
    const cLit = new THREE.Color(0xe8b074);   // sunlit warm ochre crown
    const cMid = new THREE.Color(C_PLANET);   // body desert ochre
    const cDark = new THREE.Color(0x2e2016);  // shadowed terminator (darker → more curvature)
    const tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i);
      // lit gradient runs from top-left (lit) to bottom-right (dark)
      const t = (y * 0.7 - x * 0.5) / PLANET_R * 0.5 + 0.5;   // 0 (dark) → 1 (lit)
      if (t > 0.55) tmp.copy(cMid).lerp(cLit, (t - 0.55) / 0.45);
      else tmp.copy(cDark).lerp(cMid, t / 0.55);
      cols.set([tmp.r, tmp.g, tmp.b], i * 3);
    }
    planetGeo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  }
  _cabinDisposables.push(planetGeo);
  const planet = new THREE.Mesh(planetGeo, new THREE.MeshBasicMaterial({ vertexColors: true }));
  // z=−9: at the porthole (window half-angle ≈0.31 from the eye at z≈0.35) a R=1.7 disc at
  // ~9.3m subtends ≈0.18 rad → fills ~55% of the window radius. Sits low so the top limb
  // curves against the void; the descent swell grows it past the rim.
  planet.position.set(0.2, -1.6, -9);
  group.add(planet);
  planetMesh = planet;
  // a faint atmosphere RIM glow just inside the limb (a thin lighter annulus) so the limb
  // reads as a planet's edge, not a flat coin. A slightly larger dim disc BEHIND the planet.
  const haloGeo = new THREE.CircleGeometry(PLANET_R * 1.12, 40);
  _cabinDisposables.push(haloGeo);
  const halo = new THREE.Mesh(haloGeo, new THREE.MeshBasicMaterial({
    color: 0x6a5a48, transparent: true, opacity: 0.35,
  }));
  halo.position.set(0.2, -1.6, -9.2);
  group.add(halo);
  planetHaloMesh = halo;

  group.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = false; o.receiveShadow = false; } });
  ctx.three.scene.add(group);
  podGroup = group;
}

/** Descent visual — grow the planet as the fall progresses (0 → 1) so it swells to fill
 *  the viewport. Greybox stand-in for the Phase-2 descentProgress effect stack. */
export function setDescentProgress(progress: number): void {
  if (!planetMesh) return;
  const p = Math.max(0, Math.min(1, progress));
  // grow from the small rest disc (≈55% of the window) to filling + overflowing it as you
  // fall toward the surface — the swell must be unmistakable vs the rest frame (P3).
  const s = 1 + p * 3.2;
  planetMesh.scale.setScalar(s);
  planetMesh.position.y = -1.6 - p * 2.4;    // sink lower (you drop toward the surface)
  if (planetHaloMesh) {
    planetHaloMesh.scale.setScalar(s);
    planetHaloMesh.position.y = planetMesh.position.y;
  }
}

/** Pose the PARACHUTE lever (the gag hook). `t` in [0,1]: 0 = at rest, 1 = fully yanked
 *  forward (toward the seat). The parachute beat calls this with a brief jolt on each
 *  pull (e.g. lerp toward 1 then settle), and with `snapped=true` to droop it dead —
 *  the lever hangs slack off its pivot (the 3rd-pull SNAP, no chute). Safe no-op if the
 *  pod isn't built. */
export function setParachuteLeverPull(t: number, snapped = false): void {
  if (!chuteLever) return;
  if (snapped) {
    // The lever SNAPPED off its mount: it hangs DEAD — flopped fully forward + past its
    // travel stop AND drooped hard sideways off the pivot, so it reads limp/wrenched, not
    // a valid pulled position (P4). Combined with the broken-mount tell built below it
    // (the bent bracket reveal), the gag's "no chute" beat is unmistakable.
    chuteLever.rotation.x = chuteLeverRestX + 2.5;   // flopped well past the pull stop (dead)
    chuteLever.rotation.z = 1.05;                     // hard sideways droop (hangs limp)
    chuteLever.rotation.y = 0.35;                     // twisted off-axis (wrenched)
    if (leverBrokenTell) leverBrokenTell.visible = true;   // expose the snapped-mount bracket
    return;
  }
  // a valid (live) lever position — keep the broken-mount tell hidden.
  if (leverBrokenTell) leverBrokenTell.visible = false;
  const k = Math.max(0, Math.min(1, t));
  // Pull travel: rotate forward (toward +X pitch) from the resting back-cant.
  chuteLever.rotation.x = chuteLeverRestX + k * 0.75;
  chuteLever.rotation.z = 0;
}

/** Tear down the pod (meshes + geometry + colliders + the per-build geometry pool). */
export function disposePodScene(ctx: GameContext): void {
  if (podGroup) {
    // Materials are module-shared (NOT disposed) EXCEPT the planet + halo + void-backdrop
    // basic materials, which are built per-placement → dispose only those.
    if (planetMesh) (planetMesh.material as THREE.Material).dispose();
    if (planetHaloMesh) (planetHaloMesh.material as THREE.Material).dispose();
    if (voidPlaneMesh) (voidPlaneMesh.material as THREE.Material).dispose();
    ctx.three.scene.remove(podGroup);
    podGroup = null;
  }
  for (const g of _cabinDisposables) g.dispose();
  _cabinDisposables.length = 0;
  planetMesh = null;
  planetHaloMesh = null;
  voidPlaneMesh = null;
  chuteLever = null;
  leverBrokenTell = null;
  for (const body of podBodies) ctx.physics.world.removeRigidBody(body);
  podBodies.length = 0;
}

// ─── The crashed pod as a desert SPAWN WRECK (T0.4b) ──────────────────────────
// Distinct from the intro's offset flying pod: this is the wreck the player wakes beside
// in the real desert ("salvage your own pod"). A WORLD object that PERSISTS into gameplay
// (NOT disposed by endEscapePodIntro). Greybox; the hero half-buried exterior is Phase 1.

let crashedWreck: THREE.Group | null = null;
let crashedWreckBody: RAPIER.RigidBody | null = null;
let crashedBerm: THREE.Mesh | null = null;   // displaced-sand drift banked against the pod

/** Remove the crashed-pod wreck (so a re-played intro doesn't stack duplicates).
 *  Disposes per-mesh GEOMETRY but NOT the materials — the hero pod's materials are
 *  module-shared + reused on the next placement (disposing them would break it). */
export function removeCrashedPodWreck(ctx: GameContext): void {
  if (crashedWreck) {
    crashedWreck.traverse((o) => {
      if (o instanceof THREE.Mesh) o.geometry.dispose();
    });
    ctx.three.scene.remove(crashedWreck);
    crashedWreck = null;
  }
  if (crashedBerm) {
    crashedBerm.geometry.dispose();
    ctx.three.scene.remove(crashedBerm);
    crashedBerm = null;
  }
  if (crashedWreckBody) {
    ctx.physics.world.removeRigidBody(crashedWreckBody);
    crashedWreckBody = null;
  }
}

// ─── The HERO crashed escape pod (Phase 1 / T1.1 — C11 CYLINDRICAL redo) ──────
// A VERTICAL RIVETED ALUMINIUM CAPSULE / TORPEDO (the LOCKED identity — D271,
// docs/research/escape-pod-cylindrical.md; the user rejected the boxy pod and
// chose "riveted aluminium capsule/torpedo" + "vertical standing capsule").
// A 1-person reentry capsule standing UPRIGHT on its base: a scorched flat
// HEAT-SHIELD base sunk in the sand, a short+fat cylindrical BODY (hand-riveted
// weathered aluminium — dense latitude rivet bands + vertical seams, dented +
// patina'd), a rounded/hemispherical NOSE CAP on top, + a stubby chute-mast /
// antenna. A small OFF-CENTER RECESSED porthole in channel-steel. A pried-open
// /blown HATCH (the salvage face the player escaped through) + a couple of bolted
// removable panels with seam-rims (the strip-it-apart tutorial read). Built in
// the game's weathered-low-poly idiom (wrecks.ts): createRustedHullMaterial TUNED
// toward aluminium (lighter, less full-rust) + LatheGeometry/CylinderGeometry for
// the round body (inherently thick → rule 7's box-depth caveat mostly N/A).
// Half-buried + TILTED (leaning) in the dune for drama.
//
// LOCAL FRAME (pre-tilt/bury): the capsule stands on +Y. The heat-shield base is
// at y=0; the body rises to y≈POD_BODY_H; the nose cap domes above that to
// y≈POD_TOTAL_H. Origin is at the base centre (y=0 = heat-shield underside top).
// The HATCH (salvage face) + porthole are on the +Z side. The caller sinks the
// base below the sand line + leans the capsule a touch.

// Pod-local dimensions (self-contained feature module; named consts per the brief).
// A standing CAPSULE/TORPEDO: the straight riveted CYLINDER must DOMINATE the
// silhouette (the C11-revise headline fix — a wide body + a big full-width dome
// read as a Mandalorian HELMET). Target visible height:width ≥ ~2:1 with a small,
// tucked ogive nose (~25% of total height, crown ~65% of body width — NOT a
// full-width hemisphere). Diameter ~1.7m, ~3.1m tall to the apex.
const POD_R = 0.85;        // body radius (≈1.7m diameter — narrow → TALL capsule, not a head)
const POD_BASE_H = 0.34;   // heat-shield base slab height (scorched, sunk in sand)
const POD_BODY_H = 2.5;    // straight cylindrical body height — the DOMINANT visual zone
const POD_NOSE_H = 0.84;   // tucked ogive nose-cap (~25% of total; crown well inside body width)
const POD_SEG = 28;        // lathe/cylinder radial segments — round but low-poly
const SKIN = 0.16;         // panel / rim depth (rule 7: ≥15cm for hull-substantial)

// ── Shared pod materials (module-scope so re-placing the wreck doesn't realloc;
//    disposed materials in removeCrashedPodWreck reference these — see note there).
// WEATHERED ALUMINIUM skin (D271) — the dominant read. TUNED toward aluminium vs
// the procgen desert profile: a LIGHTER cool-grey base, the HUE-shifting rust
// layers pulled to ACCENTS (sand-abrasion + sparse oxide patina, not a rust-brown
// wash), more bare-metal flecks (scuffed aluminium scratches to bright metal), a
// cool bare-metal reveal. Reads as a dented hand-riveted aluminium capsule that's
// sat in the dunes — patina'd + sand-abraded, but unmistakably ALUMINIUM not iron.
const _podPaint = createRustedHullMaterial({
  baseColor: 0xb6b9b3,           // light cool aluminium-grey — the DOMINANT read
  bareMetalHex: 0xd6d9da,        // bright scuffed-aluminium reveal (cool, near-white)
  rustHex: 0x6a4a2c,             // warm grime tone for the drip-staining channel
  streakIntensity: 0.42,         // grime drip-runs (the seam channel rides this hue too)
  wearAmplitude: 0.46,           // STRONG plate-to-plate tonal break-up (dents + denting)
  fleckStrength: 1.0,            // dense tight bare-metal scuff scratches → scrappy aluminium
  oxStrength: 0.34, oxHex: 0x9a6a3e,    // more warm oxide/patina patches (weathered hero)
  // dust + chalk PULLED DOWN — they washed the up-facing nose dome chalky-white
  // (P5: the nose must read as the SAME weathered aluminium as the body, not plaster).
  dustStrength: 0.28, dustHex: 0xa89c84, chalkStrength: 0.16,
  oxDeepStrength: 0.28, seamRustStrength: 0.46, abrasionStrength: 0.62,  // drip-stain + sand-blast
});
// Darker channel-steel material (porthole + hatch frames, rivet bands) — a value
// contrast to the bright aluminium skin so the steel hardware reads as fitted-on.
const _podSteel = createRustedHullMaterial({
  baseColor: 0x4f4c46,           // dark warm-grey channel steel
  streakIntensity: 0.4, wearAmplitude: 0.3,
  oxStrength: 0.4, oxDeepStrength: 0.45, seamRustStrength: 0.45,
});
// Rivets / studs / small hardware — mid steel-grey (reads as cast/forged fittings,
// distinct from both the bright skin and the dark channel frames).
const _podFrameMat = createRustedHullMaterial({
  baseColor: 0x7d7a72,           // mid steel-grey hardware
  rustHex: 0x4a2810, streakIntensity: 0.3, oxStrength: 0.3, oxHex: 0x9a5a2e,
  oxDeepStrength: 0.3, seamRustStrength: 0.3, fleckStrength: 0.6,
});
// Cables / antenna — dark matte, near-black.
const _podCableMat = new THREE.MeshLambertMaterial({ color: Tuning.WRECK_ANTENNA_HEX, flatShading: true });
// Displaced-sand berm (the drift banked against the speared-in pod). Sand tone.
const _podBermMat = new THREE.MeshLambertMaterial({ color: 0xc69a5a, flatShading: true });
// Reentry SCORCH — a vertex-COLOR-driven Lambert so the char→tarnish→aluminium
// fade is baked into the geometry (no hard top edge, no painted-stripe read). The
// per-vertex gradient (built in §2) supplies the color; flat-shaded low-poly.
const _podScorchFadeMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
// Charred heat-shield base cap (the flat burnt end-down slab peeking at the sand).
const _podScorchMat = createRustedHullMaterial({
  baseColor: 0x1c140d,           // charred near-black, warm
  rustHex: 0x120b06, bleachHex: 0x2e2218,
  streakIntensity: 0.3, wearAmplitude: 0.35,
  oxStrength: 0.5, oxHex: 0x5e3a1e,     // burnt-umber discolouration zones
  oxTopStrength: 0.4, abrasionStrength: 0.3,
});
// Riveted SEAM-BAND metal — a mid grey-aluminium tone (lighter than the dark
// channel steel) so the latitude bands read as fitted RIVETED HOOPS, not as dark
// drum-divisions cutting the capsule into stacked segments.
const _podBandMat = createRustedHullMaterial({
  baseColor: 0x8c8d85,           // mid grey-aluminium band
  streakIntensity: 0.3, wearAmplitude: 0.34, fleckStrength: 0.7,
  oxStrength: 0.32, oxHex: 0x96602e, oxDeepStrength: 0.28, seamRustStrength: 0.3,
});
// PRIED-OPEN HATCH DOOR — a distinctly LIGHTER bright-aluminium value so the
// strippable salvage door POPS off the body (it's the tutorial target, must read
// as the clearest thing on the model). Heavy bare-metal scuffs (it's been forced).
const _podDoorMat = createRustedHullMaterial({
  baseColor: 0xcdd0cb,           // bright pried aluminium — lighter than the body skin
  bareMetalHex: 0xe2e4e2,
  streakIntensity: 0.2, wearAmplitude: 0.34, fleckStrength: 1.0,
  oxStrength: 0.18, oxHex: 0x9a6a3e, abrasionStrength: 0.4,
});
// Dark cavity (blown hatch interior + viewport glass void).
const _podVoidMat = new THREE.MeshBasicMaterial({ color: 0x0a0908 });
// Recessed viewport "glass" — dim cool tint, slightly emissive so it reads as a
// real window, not a painted square.
const _podGlassMat = new THREE.MeshStandardMaterial({
  color: 0x223038, roughness: 0.18, metalness: 0.35,   // glossier → a faint spec catch (P4)
  emissive: 0x0a1318, emissiveIntensity: 0.5,
});
// Inner-rim shadow well behind the recessed glass (so the porthole reads as a deep
// inset window, not a flat disc on the skin) — near-black, unlit.
const _podRimShadowMat = new THREE.MeshBasicMaterial({ color: 0x07090a });

/** Build the hero pod mesh group in its LOCAL frame: a VERTICAL riveted-aluminium
 *  capsule standing on its heat-shield base (base centre = origin, y=0 at the base
 *  underside top; the body rises on +Y; the HATCH + porthole face +Z). The caller
 *  positions / tilts (leans) / buries it. */
function buildHeroPodMesh(): THREE.Group {
  const g = new THREE.Group();

  // Body-surface y-bands (local). Base slab → body → nose dome.
  const baseTop = POD_BASE_H;                       // top of the heat-shield slab
  const bodyTop = baseTop + POD_BODY_H;             // shoulder where the nose begins
  const apex = bodyTop + POD_NOSE_H;                // nose apex

  // ── 1. The CAPSULE BODY — one revolved LatheGeometry profile so it reads truly
  //    ROUND + smooth: a flared heat-shield foot, a TALL straight cylindrical body
  //    (the dominant silhouette), a SHOULDER that pulls IN, then a small tucked
  //    OGIVE nose (NOT a full-width hemisphere — that read as a helmet crown). The
  //    crown ends well inside the body width. Built as the aluminium skin.
  const SHOULDER_R = POD_R * 0.78;   // the nose starts pulled IN from the body radius
  const prof: THREE.Vector2[] = [];
  // base: closed bottom centre → out to a slightly flared foot rim
  prof.push(new THREE.Vector2(0.0, 0.0));
  prof.push(new THREE.Vector2(POD_R * 0.86, 0.0));
  prof.push(new THREE.Vector2(POD_R * 1.02, POD_BASE_H * 0.55));   // flared heat-shield foot
  prof.push(new THREE.Vector2(POD_R, baseTop));                    // foot → body radius
  // straight cylindrical body (the DOMINANT silhouette zone)
  prof.push(new THREE.Vector2(POD_R, baseTop + POD_BODY_H * 0.35));
  prof.push(new THREE.Vector2(POD_R, baseTop + POD_BODY_H * 0.7));
  prof.push(new THREE.Vector2(POD_R, bodyTop - 0.06));
  // SHOULDER chamfer — pull the radius IN at the top of the cylinder (a fabricated
  //   shoulder ring, not a smooth bulge) so the nose springs from a NARROWER base.
  prof.push(new THREE.Vector2(SHOULDER_R, bodyTop + 0.04));
  // tucked OGIVE nose from the shoulder radius → a blunt narrow crown. A high
  //   exponent keeps the cap NARROW (crown ≈0.45·SHOULDER_R) so it can never read
  //   as a full-width helmet crown; the apex stays slightly blunt for the mast base.
  const noseSegs = 8;
  for (let i = 1; i <= noseSegs; i++) {
    const t = i / noseSegs;                  // 0→1 up the dome
    const a = t * (Math.PI / 2);
    const r = SHOULDER_R * Math.pow(Math.cos(a), 1.7) + 0.001;   // narrow tucked ogive
    const y = bodyTop + 0.04 + Math.sin(a) * (POD_NOSE_H - 0.04);
    prof.push(new THREE.Vector2(Math.max(0.05, r), y));
  }
  prof.push(new THREE.Vector2(0.001, apex));   // closed apex (clean pole, per lathe caveat)
  const bodyGeo = new THREE.LatheGeometry(prof, POD_SEG);
  // Asymmetric DENTS — push a few clusters of body verts inward so the capsule
  // reads hand-built + crash-battered, not a perfect machined tube (the lathe is
  // radially symmetric otherwise). Deterministic (fixed centres), only on the
  // straight body band (leave the nose dome + base clean). procedural-mesh-
  // authoring.md "slight vertex displacement" → reads as carved/dented, not box.
  {
    const pos = bodyGeo.attributes.position;
    const dents = [
      { az: 1.15, y: baseTop + POD_BODY_H * 0.55, rad: 0.6, depth: 0.13 },
      { az: 2.7, y: baseTop + POD_BODY_H * 0.30, rad: 0.5, depth: 0.10 },
      { az: -1.3, y: baseTop + POD_BODY_H * 0.7, rad: 0.45, depth: 0.09 },
      { az: 0.5, y: baseTop + POD_BODY_H * 0.18, rad: 0.5, depth: 0.08 },
    ];
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.set(pos.getX(i), pos.getY(i), pos.getZ(i));
      const r = Math.hypot(v.x, v.z);
      if (r < POD_R * 0.6) continue;             // skip near-axis (caps)
      const az = Math.atan2(v.x, v.z);
      for (const d of dents) {
        // angular distance (wrapped) + vertical distance → a soft radial falloff
        let da = az - d.az; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
        const dy = (v.y - d.y);
        const dist = Math.hypot(da * 0.9, dy);
        if (dist < d.rad) {
          const k = (1 - dist / d.rad);
          const push = d.depth * k * k;          // pull radius inward
          const nr = Math.max(0.05, r - push);
          const s = nr / r;
          v.x *= s; v.z *= s;
        }
      }
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    pos.needsUpdate = true;
  }
  bodyGeo.computeVertexNormals();
  const body = new THREE.Mesh(bodyGeo, _podPaint);
  body.userData.noCollider = true;   // a CylinderGeometry collider-proxy (§9) carries collision
  g.add(body);

  // Helper — radius of the straight body (used to seat hardware flush on the curve).
  const bodyR = POD_R;

  // ── 2. REENTRY SCORCH — a real blackened char driven UP the lower body as a
  //    vertex-color fade (near-BLACK char at the base → tarnish → aluminium), with
  //    ASYMMETRIC wind-driven soot LICKS climbing higher up one side (P2 — the warm
  //    wake sun washed out the old soft radial fade + shallow grey). It's the heat-
  //    shield capsule's headline weathering signature → must read in WAKE light.
  //    Raised to ~50% of body height; proud lathe shell over the body + a base cap.
  const scorchTopY = baseTop + POD_BODY_H * 0.5;    // char reaches ~50% up the body
  const scorchProf: THREE.Vector2[] = [
    new THREE.Vector2(POD_R * 0.86 + 0.008, 0.0),
    new THREE.Vector2(POD_R * 1.05, POD_BASE_H * 0.55),  // flared foot rim (proud → peeks at sand)
    new THREE.Vector2(POD_R + 0.012, baseTop),
    new THREE.Vector2(POD_R + 0.012, baseTop + (scorchTopY - baseTop) * 0.5),
    new THREE.Vector2(POD_R + 0.010, scorchTopY),
  ];
  const scorchGeo = new THREE.LatheGeometry(scorchProf, POD_SEG);
  scorchGeo.computeVertexNormals();
  // vertex-color fade with azimuthal soot licks. The base is near-black char; it
  // fades to tarnish then aluminium up the body, BUT the fade-out height is pushed
  // HIGHER on the windward (~+Z/+X) flank by an azimuth+noise term so charred soot
  // tongues lick up one side instead of a clean radial ring.
  {
    const pos = scorchGeo.attributes.position;
    const cols = new Float32Array(pos.count * 3);
    const cChar = new THREE.Color(0x0d0906);   // near-black reentry char (deepened — P2)
    const cTarn = new THREE.Color(0x5a4126);   // tarnished warm transition
    const cAlu = new THREE.Color(0xb6b9b3);    // body aluminium (top → blends in)
    const tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i), vy = pos.getY(i), vz = pos.getZ(i);
      const az = Math.atan2(vx, vz);            // 0 = +Z (windward flank)
      // soot reaches higher near az≈0.4 (the +Z/+X visible flank) + 2 noise licks
      const lick = 0.5 * Math.exp(-Math.pow((az - 0.4) / 0.7, 2))    // broad windward tongue
                 + 0.3 * Math.exp(-Math.pow((az + 1.6) / 0.4, 2))    // a thin lick on the far side
                 + 0.18 * Math.sin(az * 5.0 + vy * 3.0);             // ragged edge wobble
      const span = Math.max(0.01, (scorchTopY - baseTop) * (1 + lick));
      const t = Math.max(0, Math.min(1, (vy - baseTop) / span));
      if (t < 0.45) tmp.copy(cChar).lerp(cTarn, t / 0.45);
      else tmp.copy(cTarn).lerp(cAlu, (t - 0.45) / 0.55);
      cols.set([tmp.r, tmp.g, tmp.b], i * 3);
    }
    scorchGeo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  }
  const scorch = new THREE.Mesh(scorchGeo, _podScorchFadeMat);
  scorch.userData.noCollider = true;
  g.add(scorch);
  // charred flat heat-shield base CAP (the burnt end-down face) — a short fat
  // scorched cylinder at the very bottom; a rim of it peeks at the sand line to
  // confirm "burnt end down" (it reentered base-first + crashed).
  const baseCap = new THREE.Mesh(
    new THREE.CylinderGeometry(POD_R * 0.92, POD_R * 0.8, POD_BASE_H * 0.7, POD_SEG),
    _podScorchMat,
  );
  baseCap.position.y = POD_BASE_H * 0.32;
  baseCap.userData.noCollider = true;
  g.add(baseCap);

  // ── 3. RIVETED LATITUDE BANDS + vertical seams — the hand-riveted aluminium
  //    read. Each band = a thin proud steel hoop (a short open cylinder slightly
  //    proud of the skin) + a ring of small low-poly rivet studs around it. Studs
  //    are tiny cylinders laid flat against the curve. Kept sparse (poly budget):
  //    ~16 rivets/band on a few bands, not every segment.
  const RIVET_N = 16;                  // rivets per latitude band (sparse, not POD_SEG)
  const addRivetRing = (y: number, studR: number, studLen: number, ringR = bodyR) => {
    for (let i = 0; i < RIVET_N; i++) {
      const a = (i / RIVET_N) * Math.PI * 2 + 0.1;
      const rivet = new THREE.Mesh(
        new THREE.CylinderGeometry(studR, studR, studLen, 5),
        _podFrameMat,
      );
      // lay the stud flat against the hull, head pointing radially out
      rivet.position.set(Math.sin(a) * (ringR + studLen * 0.4), y, Math.cos(a) * (ringR + studLen * 0.4));
      rivet.rotation.x = Math.PI / 2;
      rivet.rotation.y = -a;          // axis points radially outward
      rivet.userData.noCollider = true;
      g.add(rivet);
    }
  };
  // proud seam hoop at a band height (radius staggered well clear of the scorch
  // shell at +0.012 to avoid z-fighting — P4 code-audit note).
  const addSeamHoop = (y: number, h: number) => {
    const hoop = new THREE.Mesh(
      new THREE.CylinderGeometry(bodyR + 0.05, bodyR + 0.05, h, POD_SEG, 1, true),
      _podBandMat,
    );
    hoop.position.y = y;
    hoop.userData.noCollider = true;
    g.add(hoop);
  };
  // FOUR latitude bands up the TALL body (strong "banded cylinder" read — the
  // upper body needs the horizontal banding so it can't read as a smooth crown),
  // each a hoop + a rivet ring on each edge.
  const bandYs = [
    baseTop + POD_BODY_H * 0.16,
    baseTop + POD_BODY_H * 0.40,
    baseTop + POD_BODY_H * 0.64,
    baseTop + POD_BODY_H * 0.88,
  ];
  for (const by of bandYs) {
    addSeamHoop(by, 0.10);
    addRivetRing(by + 0.075, 0.026, 0.06);
    addRivetRing(by - 0.075, 0.026, 0.06);
  }
  // a couple of VERTICAL riveted seam strips (longitude) — proud thin steel battens
  // with rivets, on the +X and −X sides (away from the hatch/porthole on +Z).
  for (const seamA of [Math.PI * 0.5, Math.PI * 1.5, Math.PI * 0.92]) {
    const sx = Math.sin(seamA), sz = Math.cos(seamA);
    const batten = new THREE.Mesh(
      new THREE.BoxGeometry(0.09, POD_BODY_H - 0.2, 0.05),
      _podSteel,
    );
    batten.position.set(sx * (bodyR + 0.02), baseTop + POD_BODY_H / 2, sz * (bodyR + 0.02));
    batten.rotation.y = -seamA;
    batten.userData.noCollider = true;
    g.add(batten);
    // rivets down the batten
    for (let k = 0; k < 5; k++) {
      const ry = baseTop + 0.25 + k * ((POD_BODY_H - 0.5) / 4);
      const rivet = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.05, 5), _podFrameMat);
      rivet.position.set(sx * (bodyR + 0.05), ry, sz * (bodyR + 0.05));
      rivet.rotation.x = Math.PI / 2;
      rivet.rotation.y = -seamA;
      rivet.userData.noCollider = true;
      g.add(rivet);
    }
  }
  // rivet ring around the nose-cap shoulder seam (seated on the pulled-IN shoulder
  // radius where the tucked nose bolts to the body).
  addRivetRing(bodyTop + 0.06, 0.024, 0.055, SHOULDER_R);

  // ── 4. The BLOWN-OPEN HATCH on the +Z side (salvage face) — the defining damage.
  //    On a curved hull a recessed void behind intact skin would be occluded
  //    (procedural-mesh-authoring.md fake-hole gotcha), so the opening is built as a
  //    real DARK CAVITY that PROTRUDES through the skin plane (its mouth clears the
  //    curve) + a torn channel-steel frame + an ajar door swung off one edge. The
  //    hatch spans a mid-body band so the player can peer in at the wake height.
  // hatch faces +Z directly (azimuth 0) → all hatch geometry sits at x≈0, z=+bodyR.
  // A CLEAN rectangular recessed opening (the tutorial salvage target — it must be
  // the clearest, least-cluttered feature; no cross-struts/scaffolding in front).
  const hatchCY = baseTop + POD_BODY_H * 0.42;
  const hatchW = 0.74, hatchH = 1.0;     // narrower → fits cleanly on the slim body
  const hzOut = bodyR;                    // the +Z body-surface point at the hatch centre
  const seatZ = (x: number) => Math.sqrt(Math.max(0.01, bodyR * bodyR - x * x)) + 0.03;
  const seatYaw = (x: number) => -Math.asin(Math.max(-1, Math.min(1, x / bodyR)));
  // 4.a a GAPING dark recessed cavity — the blown-open mouth. Deep + wide so the
  //     opening reads as a real hole into darkness at wake distance (the tutorial
  //     target must POP). The body curves away inside; a dim back wall sets depth.
  const cavity = new THREE.Mesh(
    new THREE.BoxGeometry(hatchW * 0.98, hatchH * 0.98, 0.6),
    _podVoidMat,
  );
  cavity.position.set(0, hatchCY, hzOut - 0.34);
  cavity.userData.noCollider = true;
  g.add(cavity);
  // 4.a.ii a dim back wall deep in the bay so the cavity has depth, not a flat void.
  const cavityBack = new THREE.Mesh(
    new THREE.BoxGeometry(hatchW * 0.86, hatchH * 0.86, 0.06),
    new THREE.MeshLambertMaterial({ color: 0x29221b, flatShading: true }),
  );
  cavityBack.position.set(0, hatchCY, hzOut - 0.62);
  cavityBack.userData.noCollider = true;
  g.add(cavityBack);
  // 4.b TORN RIM around the opening — short bent dark-steel teeth/lips proud of the
  //     skin, so the edge reads RIPPED (blown outward), not a clean machined port.
  //     Brighter steel frame value so the opening's border contrasts the skin.
  const torn = 8;
  for (let i = 0; i < torn; i++) {
    const u = (i / torn);
    // walk the rim perimeter (top, right, bottom, left quarters)
    let rx: number, ry: number, ang: number;
    if (u < 0.25) { rx = (u / 0.25 - 0.5) * hatchW; ry = hatchH / 2; ang = 0.5; }
    else if (u < 0.5) { rx = hatchW / 2; ry = (1 - (u - 0.25) / 0.25 - 0.5) * hatchH; ang = -0.4; }
    else if (u < 0.75) { rx = (0.5 - (u - 0.5) / 0.25) * hatchW; ry = -hatchH / 2; ang = 0.3; }
    else { rx = -hatchW / 2; ry = ((u - 0.75) / 0.25 - 0.5) * hatchH; ang = -0.5; }
    const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.09, 0.05), _podSteel);
    tooth.position.set(rx, hatchCY + ry, seatZ(rx) + 0.02);
    tooth.rotation.set(ang, seatYaw(rx), (i % 2 ? 0.4 : -0.3));   // bent outward, alternating
    tooth.userData.noCollider = true;
    g.add(tooth);
  }
  // 4.c slim channel-steel frame bordering the opening (curve-seated). A LIGHTER
  //     steel value than the torn teeth so the port edge contrasts + reads framed.
  const fbT = 0.08;
  const frameBar = (w: number, h: number, ox: number, oy: number) => {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(w, h, SKIN * 0.9), _podBandMat);
    bar.position.set(ox, hatchCY + oy, seatZ(ox) - 0.01);
    bar.rotation.y = seatYaw(ox);
    bar.userData.noCollider = true;
    g.add(bar);
  };
  frameBar(hatchW + fbT * 2, fbT, 0, hatchH / 2 + fbT / 2);     // top
  frameBar(hatchW + fbT * 2, fbT, 0, -hatchH / 2 - fbT / 2);    // bottom
  frameBar(fbT, hatchH, -hatchW / 2 - fbT / 2, 0);             // left
  frameBar(fbT, hatchH, hatchW / 2 + fbT / 2, 0);             // right (hinge side)
  // 4.d the blown DOOR — flung WIDE off the right edge (~1.55 rad ≈ 89°) so it sits
  //     flat against the hull BESIDE the opening, leaving the dark cavity fully
  //     exposed (a door swung partway READS as a shut panel — the critique's note).
  //     A THICK bright pried-aluminium plate (deformed: a corner bent) + a handle.
  const door = new THREE.Group();
  const doorTh = SKIN * 1.7;             // THICK door plate (visible edge)
  const doorPlate = new THREE.Mesh(new THREE.BoxGeometry(hatchW * 0.98, hatchH * 0.98, doorTh), _podDoorMat);
  door.add(doorPlate);
  const doorInset = new THREE.Mesh(new THREE.BoxGeometry(hatchW * 0.64, hatchH * 0.7, doorTh * 0.8), _podDoorMat);
  doorInset.position.z = doorTh * 0.4;
  door.add(doorInset);
  // a bent/peeled top-free corner (deformed edge — it was forced)
  const peel = new THREE.Mesh(new THREE.BoxGeometry(hatchW * 0.4, hatchH * 0.22, doorTh * 0.8), _podDoorMat);
  peel.position.set(-hatchW * 0.28, hatchH * 0.42, doorTh * 0.2);
  peel.rotation.set(-0.5, 0.2, 0);
  door.add(peel);
  for (const bx of [-1, 1]) for (const by of [-1, 1]) {
    const rivet = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, doorTh * 0.6, 6), _podFrameMat);
    rivet.rotation.x = Math.PI / 2;
    rivet.position.set(bx * hatchW * 0.36, by * hatchH * 0.38, doorTh * 0.6);
    door.add(rivet);
  }
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.26, 0.1), _podFrameMat);
  handle.position.set(-hatchW * 0.3, 0, doorTh * 0.9);   // handle near the free (swung-out) edge
  door.add(handle);
  const hinge = new THREE.Group();
  hinge.position.set(hatchW / 2 + fbT / 2, hatchCY, seatZ(hatchW / 2 + fbT / 2) + SKIN * 0.2);
  door.position.set(-hatchW / 2, 0, 0);   // door local origin → hinge (right) edge
  hinge.add(door);
  hinge.rotation.y = -1.2;    // flung wide OUT (stands proud beside the opening) so the
                              //   dark cavity is exposed but the door reads as a door
  hinge.rotation.x = 0.12;    // slight downward sag
  hinge.rotation.z = 0.06;    // small bent twist
  hinge.traverse((o) => { o.userData.noCollider = true; });
  g.add(hinge);
  // bent torn HINGE STRAP at the right edge — the door reads still-attached, not a
  //  floating slab. (Single low strap; the wide swing makes the connection obvious.)
  const strap = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.08, 0.045), _podSteel);
  strap.position.set(hatchW / 2 + 0.08, hatchCY - 0.05, seatZ(hatchW / 2) + 0.06);
  strap.rotation.set(0, -0.7, -0.2);   // bent
  strap.userData.noCollider = true;
  g.add(strap);
  // 4.e a few SCATTERED torn rivets sprung off the frame (blown — debris tells).
  for (const [dx, dy] of [[-0.16, 0.3], [0.1, -0.42], [0.22, 0.12]] as const) {
    const sprung = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.06, 6), _podFrameMat);
    sprung.position.set(dx, hatchCY + dy, seatZ(dx) + 0.05);
    sprung.rotation.set(Math.PI / 2 + (dy > 0 ? 0.4 : -0.3), seatYaw(dx), 0.5);
    sprung.userData.noCollider = true;
    g.add(sprung);
  }

  // ── 5. RECESSED off-center PORTHOLE — SMALL (~half the old diameter), truly inset:
  //    a proud bezel RING + a deep inner-rim SHADOW well + a slightly convex tinted
  //    GLASS disc with a faint spec catch. High segment count so no flat facet
  //    streaks the glass (P4). On the mid-upper CYLINDER body, off the centreline.
  const vpA = 0.95;                       // off-centre on the +X/+Z flank the wake cam sees
  const vpY = baseTop + POD_BODY_H * 0.62;
  const vpR = 0.15;                       // SMALL window (was 0.27) — a mechanic's port
  const vpDir = new THREE.Vector3(Math.sin(vpA), 0, Math.cos(vpA));
  const vpQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), vpDir);
  // proud bezel ring (the frame standing off the skin)
  const vpRing = new THREE.Mesh(new THREE.CylinderGeometry(vpR + 0.04, vpR + 0.05, 0.1, 20, 1, true), _podSteel);
  vpRing.position.set(vpDir.x * (bodyR + 0.03), vpY, vpDir.z * (bodyR + 0.03));
  vpRing.quaternion.copy(vpQuat);
  vpRing.userData.noCollider = true;
  g.add(vpRing);
  // inner-rim SHADOW well — a dark tube set INTO the hull behind the bezel so the
  // recess reads deep (the eye sees a dark ring inside the bezel → "inset window").
  const vpWell = new THREE.Mesh(new THREE.CylinderGeometry(vpR + 0.005, vpR + 0.005, 0.16, 20, 1, true), _podRimShadowMat);
  vpWell.position.set(vpDir.x * (bodyR - 0.06), vpY, vpDir.z * (bodyR - 0.06));
  vpWell.quaternion.copy(vpQuat);
  vpWell.userData.noCollider = true;
  g.add(vpWell);
  // slightly CONVEX tinted glass (a shallow sphere cap) recessed inside the well.
  const vpGlass = new THREE.Mesh(new THREE.SphereGeometry(vpR, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.34), _podGlassMat);
  vpGlass.position.set(vpDir.x * (bodyR - 0.05), vpY, vpDir.z * (bodyR - 0.05));
  // orient the sphere-cap to bulge OUT along vpDir (cap opens toward +Y by default)
  vpGlass.quaternion.copy(vpQuat);
  vpGlass.userData.noCollider = true;
  g.add(vpGlass);
  // five small bolt studs around the bezel.
  for (let i = 0; i < 5; i++) {
    const ba = (i / 5) * Math.PI * 2 + Math.PI / 5;
    const tangent = new THREE.Vector3(Math.cos(vpA), 0, -Math.sin(vpA));
    const up = new THREE.Vector3(0, 1, 0);
    const off = up.clone().multiplyScalar(Math.sin(ba) * (vpR + 0.05)).add(tangent.clone().multiplyScalar(Math.cos(ba) * (vpR + 0.05)));
    const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.06, 6), _podFrameMat);
    bolt.position.set(vpDir.x * (bodyR + 0.04) + off.x, vpY + off.y, vpDir.z * (bodyR + 0.04) + off.z);
    bolt.quaternion.copy(vpQuat);
    bolt.userData.noCollider = true;
    g.add(bolt);
  }

  // ── 6. BOLTED REMOVABLE PANELS (the strip-it-apart tutorial read) — distinctly
  //    LIGHTER-value plates (the band-metal tone, not the skin tone) with a DARK
  //    seam-rim groove so they POP off the body (P5: same-value panels were
  //    invisible). One panel has a corner PRIED up to telegraph "these come off".
  const addPanel = (az: number, py: number, pw: number, ph: number, pried = false) => {
    const dir = new THREE.Vector3(Math.sin(az), 0, Math.cos(az));
    const grp = new THREE.Group();
    // dark recessed seam-rim groove (a value-contrast border so the plate edge reads)
    const rim = new THREE.Mesh(new THREE.BoxGeometry(pw * 1.1, ph * 1.1, SKIN * 0.6), _podSteel);
    rim.position.z = -SKIN * 0.2;
    grp.add(rim);
    // the plate — band-metal (lighter than the skin) so it stands out as bolted-on
    const plate = new THREE.Mesh(new THREE.BoxGeometry(pw, ph, SKIN), _podBandMat);
    grp.add(plate);
    const inset = new THREE.Mesh(new THREE.BoxGeometry(pw * 0.78, ph * 0.78, SKIN * 1.2), _podBandMat);
    inset.position.z = SKIN * 0.2;
    grp.add(inset);
    for (const bx of [-1, 1]) for (const by of [-1, 1]) {
      const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, SKIN * 0.7, 6), _podFrameMat);
      bolt.rotation.x = Math.PI / 2;
      bolt.position.set(bx * pw * 0.42, by * ph * 0.42, SKIN * 0.5);
      grp.add(bolt);
    }
    if (pried) {
      // one corner peeled OUT (a wedge lip lifted off the hull) — "this one's loose".
      const lip = new THREE.Mesh(new THREE.BoxGeometry(pw * 0.5, ph * 0.32, SKIN), _podBandMat);
      lip.position.set(pw * 0.22, ph * 0.3, SKIN * 0.6);
      lip.rotation.set(-0.5, 0.0, 0.18);   // pried up + out
      grp.add(lip);
    }
    grp.position.set(dir.x * (bodyR + SKIN * 0.3), py, dir.z * (bodyR + SKIN * 0.3));
    grp.rotation.y = -az;
    grp.traverse((o) => { o.userData.noCollider = true; });
    g.add(grp);
  };
  addPanel(Math.PI * 1.18, baseTop + POD_BODY_H * 0.4, 0.62, 0.84, true);   // −X flank, corner PRIED
  addPanel(Math.PI * 0.72, baseTop + POD_BODY_H * 0.6, 0.5, 0.5);           // small inspection plate
  addPanel(Math.PI, baseTop + POD_BODY_H * 0.72, 0.46, 0.4);               // −Z back inspection plate

  // ── 7. SHOULDER-MOUNTED ANTENNA MAST (the chute-deploy / comms mast). Moved OFF
  //    the apex (a single thin stalk from the dome centre read as a Mandalorian
  //    rangefinder); now a CHUNKY mast bolted to the upper-body SHOULDER, built up
  //    so it survives at distance: a riveted base flange → a thick lower mast →
  //    a thinner whip → a tip nub, leaning (crash-knocked). The apex stays clean.
  const mastAz = 2.5;   // upper-body shoulder, away from the hatch/porthole flank
  const mastDir = new THREE.Vector3(Math.sin(mastAz), 0, Math.cos(mastAz));
  const mastY = baseTop + POD_BODY_H * 0.86;
  const mastGrp = new THREE.Group();
  mastGrp.position.set(mastDir.x * (bodyR - 0.02), mastY, mastDir.z * (bodyR - 0.02));
  mastGrp.rotation.y = -mastAz;          // local +X points radially outward
  mastGrp.rotation.z = -1.05;            // tip the mast up-and-out off the flank
  g.add(mastGrp);
  // riveted base flange seated on the hull (a real bolt-down plate)
  const mastFlange = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.1, 10), _podSteel);
  mastFlange.rotation.z = Math.PI / 2;
  mastFlange.position.set(0.04, 0, 0);
  mastGrp.add(mastFlange);
  for (let i = 0; i < 4; i++) {
    const ba = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.06, 5), _podFrameMat);
    bolt.rotation.z = Math.PI / 2;
    bolt.position.set(0.05, Math.sin(ba) * 0.11, Math.cos(ba) * 0.11);
    bolt.userData.noCollider = true;
    mastGrp.add(bolt);
  }
  // thick lower mast (a real radius so it reads at distance)
  const mastLower = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.085, 0.55, 8), _podSteel);
  mastLower.rotation.z = Math.PI / 2;
  mastLower.position.set(0.36, 0, 0);
  mastGrp.add(mastLower);
  // collar where the whip steps down
  const mastCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.06, 8), _podFrameMat);
  mastCollar.rotation.z = Math.PI / 2;
  mastCollar.position.set(0.64, 0, 0);
  mastCollar.userData.noCollider = true;
  mastGrp.add(mastCollar);
  // thinner whip
  const mastWhip = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.04, 0.6, 6), _podFrameMat);
  mastWhip.rotation.z = Math.PI / 2;
  mastWhip.position.set(0.97, 0, 0);
  mastWhip.userData.noCollider = true;
  mastGrp.add(mastWhip);
  // tip nub
  const mastTip = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), _podFrameMat);
  mastTip.position.set(1.28, 0, 0);
  mastTip.userData.noCollider = true;
  mastGrp.add(mastTip);
  // a small clean apex cap (the closed nose pole — NO stalk that reads as a rangefinder)
  const apexCap = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.07, 10), _podSteel);
  apexCap.position.set(0, apex - 0.02, 0);
  apexCap.userData.noCollider = true;
  g.add(apexCap);

  // ── 8. EXTERNAL CABLE + a bent lifting-eye — lived-in asymmetric tells. A loose
  //    cable drooping down one flank + a hoist ring knocked askew near the shoulder.
  const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.1, 6), _podCableMat);
  cable.position.set(Math.sin(-1.0) * (bodyR + 0.04), baseTop + POD_BODY_H * 0.5, Math.cos(-1.0) * (bodyR + 0.04));
  cable.rotation.set(0.18, 0, 0.32);
  cable.userData.noCollider = true;
  g.add(cable);
  const eyeStalk = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.16, 8), _podSteel);
  eyeStalk.position.set(Math.sin(1.7) * bodyR * 0.6, bodyTop + 0.02, Math.cos(1.7) * bodyR * 0.6);
  g.add(eyeStalk);
  const liftEye = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.04, 7, 14), _podSteel);
  liftEye.position.set(Math.sin(1.7) * bodyR * 0.6, bodyTop + 0.14, Math.cos(1.7) * bodyR * 0.6);
  liftEye.rotation.set(Math.PI / 2 + 0.5, 0.3, 0);
  liftEye.userData.noCollider = true;
  g.add(liftEye);
  // a small stamped ID plate near the porthole (a built, labelled craft).
  const idPlate = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, SKIN * 0.8), _podSteel);
  const idDir = new THREE.Vector3(Math.sin(-0.45), 0, Math.cos(-0.45));
  idPlate.position.set(idDir.x * (bodyR + SKIN * 0.2), baseTop + POD_BODY_H * 0.72, idDir.z * (bodyR + SKIN * 0.2));
  idPlate.rotation.y = 0.45;
  idPlate.userData.noCollider = true;
  g.add(idPlate);

  // ── 9. COLLIDER PROXY — an invisible vertical CylinderGeometry mesh sized to the
  //    body so attachCompoundCollider emits an EXACT vertical cylinder (the curved
  //    lathe body is noCollider → would otherwise fall back to a loose AABB). The
  //    proxy spans base→shoulder; the nose dome + antenna are non-blocking overhead.
  const colliderProxy = new THREE.Mesh(
    new THREE.CylinderGeometry(POD_R, POD_R, POD_BASE_H + POD_BODY_H, 12),
    _podPaint,
  );
  colliderProxy.position.y = (POD_BASE_H + POD_BODY_H) / 2;
  colliderProxy.visible = false;   // collision-only; the lathe body is the visible skin
  g.add(colliderProxy);

  // Flat-shaded low-poly: shadow flags set by the caller after placement.
  return g;
}

/** Place the HERO crashed pod at desert (x,z) — the VERTICAL aluminium capsule
 *  standing on its heat-shield base, LEANED + half-buried in the dune, hatch +
 *  porthole facing the player's wake spot. Idempotent (replaces any prior).
 *  PERSISTS into the real game (NOT disposed by endEscapePodIntro). A vertical
 *  cylinder collider (from the invisible proxy) follows the standing silhouette;
 *  the dome/antenna/door/decorations are noCollider. */
export function placeCrashedPodWreck(ctx: GameContext, x: number, z: number): void {
  removeCrashedPodWreck(ctx);
  const gy = ctx.terrain.heightAt(x, z);
  const group = buildHeroPodMesh();
  group.name = 'crashedPod';   // findable by the rig-shot framer (visual-diagnostic-methodology.md)

  // ── Crash pose + LEAN-AWARE burial (P1 float fix). The capsule origin is at the
  //    heat-shield BASE centre (y=0). The previous bug: sink was a PURE VERTICAL
  //    drop, then the group leaned ~22° ABOUT that origin — which rotated the base
  //    rim UP out of the sand → a visible float gap + a detached shadow.
  //
  //    Fix: apply the lean FIRST, then compute the sink from the LEANED base disc.
  //    A base disc of radius POD_R, tilted by the total lean angle θ, has its
  //    HIGHEST rim point at +POD_R·sin(θ) above the base centre. To bury the whole
  //    leaned base + ~35% of the body, the centre must drop so that highest rim
  //    point sits clearly (BURY_MARGIN) below grade.
  group.rotation.set(0.34, 0.55, 0.18);   // pitch (lean) + yaw (face cam) + roll
  // total tilt of the local +Y axis away from world-up (how far the base disc tilts)
  const _up = new THREE.Vector3(0, 1, 0).applyEuler(group.rotation);
  const tiltCos = Math.max(-1, Math.min(1, _up.y));
  const tilt = Math.acos(tiltCos);                       // radians off vertical
  const rimRise = POD_R * Math.sin(tilt);               // highest base-rim point above centre
  const BURY_MARGIN = 0.22;                              // clearance of the high rim below grade
  const bodyBury = POD_BODY_H * 0.35;                    // ~35% of the body below grade
  // centre must sit this far below grade so (centre + rimRise) ≤ grade − margin AND
  // ~35% of the (vertical-ish) body is swallowed.
  const sink = Math.max(POD_BASE_H + rimRise + BURY_MARGIN, bodyBury);
  group.position.set(x, gy - sink, z);

  group.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; }
  });
  ctx.three.scene.add(group);

  // Collider: the invisible CylinderGeometry proxy (§9) → attachCompoundCollider
  // emits an EXACT vertical cylinder capturing the CORRECTED lean + burial baked
  // into the group world matrix (re-seated by the lean-aware sink above). The lathe
  // body + dome + all decorations are tagged noCollider so they don't spawn phantom
  // walls or a loose AABB.
  group.updateMatrixWorld(true);
  crashedWreckBody = attachCompoundCollider(ctx.physics.world, group);
  crashedWreck = group;

  // ── DISPLACED-SAND BERM banked against the buried/down-tilt side so the dune
  //    visibly SWALLOWS the pod (no clean float seam). The pod's local +Y tilts
  //    toward (_up.x, _, _up.z) in world → the DOWNHILL base contact is the
  //    OPPOSITE horizontal direction; pile the berm there + wrap it around the base.
  {
    const downhill = new THREE.Vector2(-_up.x, -_up.z);
    if (downhill.lengthSq() < 1e-4) downhill.set(0.6, 0.8);
    downhill.normalize();
    const bx = x + downhill.x * (POD_R + 0.35);
    const bz = z + downhill.y * (POD_R + 0.35);
    const bgy = ctx.terrain.heightAt(bx, bz);
    // a broad, organic drift ring that banks UP against the hull on the downhill side
    const bermGeo = new THREE.ConeGeometry(POD_R + 1.25, 0.92, 14, 2, false);
    const bp = bermGeo.attributes.position;
    for (let i = 0; i < bp.count; i++) {
      const vx = bp.getX(i), vy = bp.getY(i), vz = bp.getZ(i);
      const t = (vy + 0.46) / 0.92;                // 0 base → 1 apex
      const wob = 1 + (Math.sin(vx * 4.6 + vz * 3.3) * 0.24 + Math.cos(vz * 5.2) * 0.12) * (1 - t);
      bp.setXYZ(i, vx * wob, vy * 0.4, vz * wob);  // flatten + organic rim
    }
    bermGeo.computeVertexNormals();
    const berm = new THREE.Mesh(bermGeo, _podBermMat);
    // crest packed up against the hull; base set below grade so it never floats.
    berm.position.set(bx, bgy + 0.12, bz);
    berm.receiveShadow = true;
    berm.castShadow = false;
    crashedBerm = berm;
    ctx.three.scene.add(berm);
  }
}
