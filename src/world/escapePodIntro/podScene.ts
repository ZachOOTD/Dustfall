// Escape-pod intro — the HERO ESCAPE POD INTERIOR (Phase 1 / T1.2).
// ─────────────────────────────────────────────────────────────────────────────
// The tight worn industrial lifeboat cabin the player RIDES, SEATED, in first-person
// through enterPod → shipExplode → descent → the parachute gag → impact. ~20-30s of
// up-close, head-turn-range hero read — NOT set dressing. Built lazily when the intro
// reaches the pod, disposed at the desert handoff, at its OWN offset above the ship so
// both can coexist briefly (you watch the ship explode from the pod's viewport).
//
// IDENTITY (matches the T1.1 exterior `placeCrashedPodWreck` below): the INDUSTRIAL
// MODULAR BOX — a worn hauler's lifeboat (Nostromo/Narcissus; explicitly NOT ODST).
// Same weathered idiom (createRustedHullMaterial + the WRECK_* palette): grey-beige
// painted panels over an exposed dark-steel rib/frame, conduit + cabling, panel seams,
// a low cramped ceiling, a warm dim ambient. The viewport is channel-steel framed on
// the −Z wall (the seated camera faces −Z → looks straight out at the descent planet).
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
//    forward/viewport, +X = the seated player's RIGHT). A tight cramped lifeboat. The
//    capsule's FP eye lands ~1.7 above the floor, so the cabin is sized so the viewport
//    + controls centre NEAR the eye (the player reads the planet dead-ahead + glances
//    down-right to the lever). NOT a spaceship bridge — a humble welded box.
const CAB_W = 2.2;    // X — interior width (x −1.1..1.1)
const CAB_H = 2.35;   // Y — cramped ceiling (floor 0 → ceiling 2.35); head clearance over the ~1.7 eye
const CAB_D = 2.6;    // Z — depth (z −1.3..1.3); viewport on the −Z front wall
const SHELL = 0.18;   // wall/floor/ceiling slab thickness (hull-substantial, rule 7)
// (the seated FP eye lands ~1.7 above the floor — the viewport + controls are centred near it)

// ── Materials — the SAME weathered idiom as the exterior hero pod (below). Module-
//    scope so a rebuild doesn't realloc; disposePodScene disposes GEOMETRY only, never
//    these shared materials. Dim/warm tuned for an INTERIOR (less sun-bleach than the
//    sun-baked exterior; the cabin is lit by a warm dim ambient, not desert noon).
const _cabPaint = createRustedHullMaterial({
  baseColor: 0xa9a288,           // grey-beige painted interior panels — the dominant read
  streakIntensity: 0.32, wearAmplitude: 0.30,
  oxStrength: 0.16, oxHex: 0x8a4a26,    // sparse rust-accent zones only (interior is less corroded)
  fleckStrength: 0.6,
});
// Exposed dark-steel ribs / frame / channel — the structural skeleton you see from
// inside (value-contrast against the beige panels).
const _cabSteel = createRustedHullMaterial({
  baseColor: 0x4a4842,           // dark warm-grey steel
  rustHex: 0x3a1c0c, streakIntensity: 0.45, wearAmplitude: 0.28,
  oxStrength: 0.4, oxHex: 0x8a4119, seamRustStrength: 0.42,
});
// Recessed channel-steel (viewport frame, console body) — darker, greyer.
const _cabChannel = createRustedHullMaterial({
  baseColor: Tuning.WRECK_HULL_DARK_HEX,
  streakIntensity: 0.4, wearAmplitude: 0.25, oxStrength: 0.35, seamRustStrength: 0.4,
});
// Conduit / cabling — dark matte near-black (lambert, flat).
const _cabCable = new THREE.MeshLambertMaterial({ color: 0x201d18, flatShading: true });
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
// The EJECT control handle (a hazard-striped pull) — warm safety-yellow grip.
const _ejectGrip = new THREE.MeshLambertMaterial({ color: 0xc9a227, flatShading: true });
// The PARACHUTE lever grip — worn red rubber (the gag star; reads "pull me").
const _chuteGrip = new THREE.MeshLambertMaterial({ color: 0xb23a2e, flatShading: true });
// The descent planet seen through the viewport — flat unlit, warm desert ochre.
const C_PLANET = 0xc98a5a;

let podGroup: THREE.Group | null = null;
const podBodies: RAPIER.RigidBody[] = [];
let planetMesh: THREE.Mesh | null = null;   // grown during the descent (setDescentProgress)
let chuteLever: THREE.Group | null = null;  // the parachute lever pivot (setParachuteLeverPull)
let chuteLeverRestX = 0;                     // its resting pitch (radians); pulls jolt from here
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

/** Build the HERO cabin interior (mesh group) in the pod-LOCAL frame (floor top=0). */
function buildCabinInterior(group: THREE.Group): void {
  const hw = CAB_W / 2, hd = CAB_D / 2;

  // ── 1. SHELL — floor, low ceiling, side walls, aft wall. Painted beige panel slabs.
  //    (The −Z front wall is built in §3 around the viewport opening.)
  const floor = _box(CAB_W + SHELL, SHELL, CAB_D + SHELL, _cabChannel);
  floor.position.set(0, -SHELL / 2, 0);
  group.add(floor);
  const ceil = _box(CAB_W + SHELL, SHELL, CAB_D + SHELL, _cabPaint);
  ceil.position.set(0, CAB_H + SHELL / 2, 0);
  group.add(ceil);
  for (const sx of [-1, 1]) {
    const wall = _box(SHELL, CAB_H, CAB_D, _cabPaint);
    wall.position.set(sx * (hw + SHELL / 2), CAB_H / 2, 0);
    group.add(wall);
  }
  const aft = _box(CAB_W, CAB_H, SHELL, _cabPaint);
  aft.position.set(0, CAB_H / 2, hd + SHELL / 2);
  group.add(aft);

  // Panel-seam tells on the side + aft walls — thin proud steel strips that read as the
  //  modular bolted plates of the exterior (break up the flat beige). Horizontal beltline
  //  + a couple of vertical seams per wall, with small bolt studs at the crossings.
  for (const sx of [-1, 1]) {
    const wallX = sx * (hw - 0.02);
    // horizontal beltline strip
    const belt = _box(0.05, 0.07, CAB_D - 0.1, _cabSteel);
    belt.position.set(wallX, 0.95, 0);
    group.add(belt);
    // vertical seams dividing the wall into plates
    for (const sz of [-0.55, 0.55]) {
      const seam = _box(0.05, CAB_H - 0.1, 0.06, _cabSteel);
      seam.position.set(wallX, CAB_H / 2, sz);
      group.add(seam);
      // bolt studs where the beltline meets each vertical seam
      for (const by of [-0.35, 0.35]) {
        const stud = _cyl(0.018, 0.018, 0.05, 6, _cabSteel);
        stud.rotation.z = Math.PI / 2;
        stud.position.set(wallX, 0.95 + by, sz);
        group.add(stud);
      }
    }
  }

  // ── 2. RIBS — exposed dark-steel hoop frames at intervals down the cabin length,
  //    proud of the panels (the "you can see how it's welded" read). Each rib is a
  //    U of steel running up one wall, across the ceiling, down the other wall.
  const ribT = 0.12, ribProud = 0.05;
  for (const rz of [-0.75, 0.0, 0.75]) {
    // ceiling cross-beam
    const top = _box(CAB_W + 0.02, ribT, ribT, _cabSteel);
    top.position.set(0, CAB_H - ribProud, rz);
    group.add(top);
    // side uprights
    for (const sx of [-1, 1]) {
      const up = _box(ribT, CAB_H, ribT, _cabSteel);
      up.position.set(sx * (hw - ribProud), CAB_H / 2, rz);
      group.add(up);
    }
  }
  // A couple of longitudinal stringers tying the ribs (ceiling) — more "structure".
  for (const sx of [-0.55, 0.55]) {
    const str = _box(0.08, 0.08, CAB_D - 0.1, _cabSteel);
    str.position.set(sx, CAB_H - 0.03, 0);
    group.add(str);
  }

  // ── 3. The −Z FRONT WALL + the VIEWPORT. A wide opening centred on the eye (~1.6),
  //    framed in proud channel-steel; the descent planet shows through dead-ahead.
  const vpX0 = -0.78, vpX1 = 0.78, vpY0 = 1.08, vpY1 = 2.12;
  const vpW = vpX1 - vpX0, vpH = vpY1 - vpY0;
  const frontZ = -hd - SHELL / 2;
  // wall slabs around the opening (below / above / left / right)
  const below = _box(CAB_W, vpY0, SHELL, _cabPaint);
  below.position.set(0, vpY0 / 2, frontZ);
  group.add(below);
  const above = _box(CAB_W, CAB_H - vpY1, SHELL, _cabPaint);
  above.position.set(0, (CAB_H + vpY1) / 2, frontZ);
  group.add(above);
  for (const [sx, sw] of [[-1, hw - vpW / 2], [1, hw - vpW / 2]] as const) {
    const side = _box(sw, vpH, SHELL, _cabPaint);
    side.position.set(sx * (hw - sw / 2), (vpY0 + vpY1) / 2, frontZ);
    group.add(side);
  }
  // Channel-steel frame ring around the opening, proud INTO the cabin (toward +Z).
  const vpCY = (vpY0 + vpY1) / 2, vpFrameZ = frontZ + 0.10, vpFt = 0.14;
  const vpBar = (w: number, h: number, ox: number, oy: number) => {
    const bar = _box(w, h, 0.16, _cabChannel);
    bar.position.set(ox, vpCY + oy, vpFrameZ);
    group.add(bar);
  };
  vpBar(vpW + vpFt * 2, vpFt, 0, vpH / 2 + vpFt / 2);
  vpBar(vpW + vpFt * 2, vpFt, 0, -vpH / 2 - vpFt / 2);
  vpBar(vpFt, vpH, -vpW / 2 - vpFt / 2, 0);
  vpBar(vpFt, vpH, vpW / 2 + vpFt / 2, 0);
  // A single vertical mullion offset to one side (a fabricated, mechanic's window) — it
  //  frames the planet without bisecting the centre.
  const mullion = _box(0.07, vpH, 0.13, _cabChannel);
  mullion.position.set(-vpW * 0.22, vpCY, vpFrameZ);
  group.add(mullion);
  // 4 corner bolt studs on the frame.
  for (const bx of [-1, 1]) for (const by of [-1, 1]) {
    const bolt = _cyl(0.03, 0.03, 0.18, 6, _cabSteel);
    bolt.rotation.x = Math.PI / 2;
    bolt.position.set(bx * (vpW / 2 + vpFt / 2), vpCY + by * (vpH / 2 + vpFt / 2), vpFrameZ + 0.02);
    group.add(bolt);
  }
  // Below the viewport: a vent GRILLE + a low forward shelf with a couple of small
  //  fixtures — fills the blank wall under the window with lived-in detail.
  const grilleY = vpY0 - 0.32;
  const grilleBack = _box(0.9, 0.34, 0.04, _cabScreen);
  grilleBack.position.set(0.1, grilleY, frontZ + 0.06);
  group.add(grilleBack);
  for (let i = 0; i < 6; i++) {
    const slat = _box(0.86, 0.025, 0.05, _cabSteel);
    slat.position.set(0.1, grilleY - 0.13 + i * 0.052, frontZ + 0.08);
    group.add(slat);
  }
  // a small forward parcel shelf lip under the window (a ledge you'd brace gear on)
  const shelf = _box(CAB_W - 0.2, 0.05, 0.18, _cabSteel);
  shelf.position.set(0, vpY0 - 0.06, frontZ + 0.12);
  group.add(shelf);
  for (const sx of [-0.7, 0.7]) {
    const bracket = _box(0.06, 0.14, 0.16, _cabSteel);
    bracket.position.set(sx, vpY0 - 0.13, frontZ + 0.11);
    group.add(bracket);
  }
  // a couple of warning placards on the lower wall
  for (const [px, mat] of [[-0.7, _ledAmber], [0.62, _ledRed]] as const) {
    const plac = _box(0.16, 0.1, 0.012, mat);
    plac.position.set(px, grilleY + 0.02, frontZ + 0.05);
    group.add(plac);
  }

  // ── 4. The SEAT + restraints (the player rides this; spawn sits just forward of it).
  //    A steel pedestal base + a worn cushion seat + a high back + a head rest + two
  //    over-shoulder restraint straps crossing the chest. Behind the seated eye (+Z).
  const seatZ = 0.62, seatY = 0.42;
  const seatBase = _box(0.66, 0.42, 0.6, _cabChannel);
  seatBase.position.set(0, 0.21, seatZ + 0.05);
  group.add(seatBase);
  const cushion = _box(0.62, 0.16, 0.58, _cabSeat);
  cushion.position.set(0, seatY, seatZ);
  group.add(cushion);
  const seatBack = _box(0.62, 0.95, 0.16, _cabSeat);
  seatBack.position.set(0, seatY + 0.5, seatZ + 0.3);
  group.add(seatBack);
  const headRest = _box(0.34, 0.22, 0.14, _cabSeat);
  headRest.position.set(0, seatY + 1.02, seatZ + 0.28);
  group.add(headRest);
  // Over-shoulder restraint straps — two angled webbing bars from the seat-back top
  // down past the chest (they read as the 5-point harness you're buckled into).
  for (const sx of [-1, 1]) {
    const strap = _box(0.10, 1.05, 0.04, _cabStrap);
    strap.position.set(sx * 0.18, seatY + 0.5, seatZ - 0.02);
    strap.rotation.x = 0.32;          // angle forward over the chest
    group.add(strap);
  }
  // Buckle hub at the lap.
  const buckle = _box(0.16, 0.12, 0.08, _cabSteel);
  buckle.position.set(0, seatY + 0.12, seatZ - 0.34);
  group.add(buckle);

  // ── 5. RIGHT-side CONSOLE (+X) — a humble waist-high cabinet with an angled
  //    instrument deck the seated pilot reads at a glance-down: a few dials, toggle
  //    switches, a small dim screen + telltale LEDs. The PARACHUTE lever rises off its
  //    forward end. A lifeboat panel, NOT a bridge. Built in the world frame (no group
  //    rotation — placement is explicit so instruments sit ON the canted deck plane).
  const conX = hw - 0.20;            // console centre, just inboard of the +X wall
  const deckY = 1.34;                // the deck top — readable at the seated eye glance-down
  // cabinet body (the boxed-in console under the deck)
  const conBody = _box(0.46, deckY, 1.15, _cabChannel);
  conBody.position.set(conX, deckY / 2, 0.0);
  group.add(conBody);
  // the angled instrument DECK (tilted up toward the seat = toward −X + a touch up)
  const deck = _box(0.5, 0.05, 1.15, _cabSteel);
  deck.position.set(conX - 0.02, deckY + 0.05, 0.0);
  deck.rotation.z = 0.32;            // cant the deck up on its inboard edge toward the pilot
  group.add(deck);
  // a small dim CRT screen recessed in the deck (forward end), faintly amber.
  const screen = _box(0.26, 0.02, 0.22, _cabScreen);
  screen.position.set(conX - 0.10, deckY + 0.11, -0.34);
  screen.rotation.z = 0.32;
  group.add(screen);
  const screenGlow = _box(0.18, 0.015, 0.14, _ledAmber);
  screenGlow.position.set(conX - 0.115, deckY + 0.125, -0.34);
  screenGlow.rotation.z = 0.32;
  group.add(screenGlow);
  // a row of telltale LEDs across the deck (aft of the screen).
  for (let i = 0; i < 4; i++) {
    const mat = [_ledGreen, _ledGreen, _ledAmber, _ledRed][i];
    const led = _cyl(0.018, 0.018, 0.018, 6, mat);
    led.rotation.x = Math.PI / 2;
    led.rotation.z = 0.32;
    led.position.set(conX - 0.18, deckY + 0.145, -0.05 + i * 0.09);
    group.add(led);
  }
  // 3 toggle switches in a row on the deck.
  for (let i = 0; i < 3; i++) {
    const sw = _cyl(0.012, 0.012, 0.06, 6, _cabSteel);
    sw.rotation.z = 0.32 - 0.4;
    sw.position.set(conX - 0.02, deckY + 0.12, 0.18 + i * 0.08);
    group.add(sw);
  }
  // two round gauge dials on the FORWARD vertical face of the cabinet (face the seat
  // along −Z), so the front of the console isn't a blank slab.
  for (const dy of [0.95, 0.6]) {
    const ring = _cyl(0.08, 0.08, 0.03, 14, _cabSteel);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(conX, dy, -0.58);
    group.add(ring);
    const face = _cyl(0.062, 0.062, 0.012, 14, _cabScreen);
    face.rotation.x = Math.PI / 2;
    face.position.set(conX, dy, -0.6);
    group.add(face);
    // a needle hint (a thin bar across the dial face)
    const needle = _box(0.05, 0.008, 0.004, _ledAmber);
    needle.position.set(conX - 0.01, dy + 0.01, -0.61);
    needle.rotation.z = dy > 0.8 ? 0.6 : -0.4;
    group.add(needle);
  }

  // ── 6. The chunky PARACHUTE LEVER — the gag STAR. Rises off the console deck's
  //    forward end, into easy seated reach (the grip ball ends ~at chest/eye height):
  //    a steel pivot bracket + a stout shaft + a fat worn-red rubber grip, canted back
  //    toward the pilot so it reads "grab and yank". A pivot GROUP (chuteLever) so
  //    setParachuteLeverPull jolts it per pull + droops it on the snap.
  const leverBaseX = conX - 0.12, leverBaseY = deckY + 0.06, leverBaseZ = -0.5;
  // pivot bracket (a steel clevis at the deck — NOT rotated with the shaft).
  const bracket = _box(0.14, 0.16, 0.18, _cabSteel);
  bracket.position.set(leverBaseX, leverBaseY, leverBaseZ);
  group.add(bracket);
  const leverPivot = new THREE.Group();
  leverPivot.position.set(leverBaseX, leverBaseY + 0.04, leverBaseZ);
  chuteLeverRestX = -0.32;            // resting: tilted back toward the seat (−X pitch)
  leverPivot.rotation.x = chuteLeverRestX;
  group.add(leverPivot);
  // shaft (rises from the pivot)
  const shaft = _cyl(0.028, 0.034, 0.46, 8, _cabSteel);
  shaft.position.set(0, 0.23, 0);
  leverPivot.add(shaft);
  // a collar mid-shaft + a hazard band
  const collar = _cyl(0.05, 0.05, 0.05, 10, _cabSteel);
  collar.position.set(0, 0.16, 0);
  leverPivot.add(collar);
  const hazBand = _cyl(0.038, 0.038, 0.06, 8, _ejectGrip);
  hazBand.position.set(0, 0.30, 0);
  leverPivot.add(hazBand);
  // fat red grip at the top (the "pull me" affordance) — a stubby cylinder + a ball cap.
  const grip = _cyl(0.078, 0.085, 0.16, 12, _chuteGrip);
  grip.position.set(0, 0.5, 0);
  leverPivot.add(grip);
  const capGeo = new THREE.SphereGeometry(0.082, 12, 8);
  _cabinDisposables.push(capGeo);
  const gripCap = new THREE.Mesh(capGeo, _chuteGrip);
  gripCap.position.set(0, 0.58, 0);
  leverPivot.add(gripCap);
  chuteLever = leverPivot;
  // a hazard-striped placard on the deck beside the lever (reads "this is the chute").
  const placard = _box(0.2, 0.012, 0.12, _ledAmber);
  placard.position.set(conX - 0.06, deckY + 0.1, -0.66);
  placard.rotation.z = 0.32;
  group.add(placard);

  // ── 7. The EJECT control (LEFT/−X side) — DISTINCT from the parachute lever: a
  //    guarded T-handle on a left-side panel, hazard-yellow grip, in seated reach. The
  //    player "pulls" this in enterPod. A mounting plate + flip-guard + T-handle + LED.
  // The whole control sits on the left wall (x=ejX) and faces INBOARD (+X), so its
  //  local +X points toward the cabin centre where the seated pilot reaches it.
  const ejX = -(hw - 0.04);
  const ejGroup = new THREE.Group();
  ejGroup.position.set(ejX, 1.5, -0.4);
  group.add(ejGroup);
  // a recessed panel box flush on the wall (thin in X, faces +X)
  const ejPanel = _box(0.1, 0.56, 0.5, _cabChannel);
  ejPanel.position.set(0.05, 0, 0);
  ejGroup.add(ejPanel);
  // hazard-yellow recessed inset (the "this is the eject control" callout)
  const ejInset = _box(0.04, 0.46, 0.4, _ejectGrip);
  ejInset.position.set(0.11, 0, 0);
  ejGroup.add(ejInset);
  // a dark recessed well the handle sits in
  const ejWell = _box(0.06, 0.34, 0.3, _cabScreen);
  ejWell.position.set(0.13, 0, 0);
  ejGroup.add(ejWell);
  // flip-up safety guard (a wire cage arched OUT into the cabin over the handle, +X)
  const guard = _box(0.22, 0.03, 0.34, _cabSteel);
  guard.position.set(0.28, 0.16, 0);
  ejGroup.add(guard);
  for (const sz of [-1, 1]) {
    const guardLeg = _box(0.18, 0.03, 0.03, _cabSteel);
    guardLeg.position.set(0.21, 0.09, sz * 0.15);
    guardLeg.rotation.z = -0.7;
    ejGroup.add(guardLeg);
  }
  // the T-handle: a stem reaching OUT into the cabin (+X) + a vertical crossbar grip
  const ejStem = _cyl(0.03, 0.03, 0.24, 8, _cabSteel);
  ejStem.rotation.z = Math.PI / 2;
  ejStem.position.set(0.26, 0, 0);
  ejGroup.add(ejStem);
  const ejBar = _cyl(0.045, 0.045, 0.3, 8, _ejectGrip);
  ejBar.position.set(0.38, 0, 0);   // crossbar runs along Z (the grip you wrap a hand around)
  ejGroup.add(ejBar);
  for (const sz of [-1, 1]) {
    const ejCap = _cyl(0.055, 0.045, 0.03, 8, _cabSteel);
    ejCap.rotation.x = Math.PI / 2;
    ejCap.position.set(0.38, 0, sz * 0.15);
    ejGroup.add(ejCap);
  }
  // a red status LED above + a small green LED below the handle.
  const ejLed = _cyl(0.024, 0.024, 0.02, 8, _ledRed);
  ejLed.rotation.z = Math.PI / 2;
  ejLed.position.set(0.12, 0.2, 0.0);
  ejGroup.add(ejLed);
  const ejLed2 = _cyl(0.02, 0.02, 0.02, 8, _ledGreen);
  ejLed2.rotation.z = Math.PI / 2;
  ejLed2.position.set(0.12, -0.2, 0.0);
  ejGroup.add(ejLed2);

  // ── 8. CONDUIT + CABLING — the lived-in tells. Thick conduit pipes up the aft
  //    corners, a junction box on the aft wall, and loose cables drooping under the ribs.
  const conduit = _cyl(0.055, 0.055, CAB_H - 0.2, 8, _cabCable);
  conduit.position.set(-(hw - 0.1), CAB_H / 2, hd - 0.2);
  group.add(conduit);
  const conduit2 = _cyl(0.045, 0.045, CAB_H - 0.5, 8, _cabCable);
  conduit2.position.set(hw - 0.12, CAB_H / 2 + 0.15, hd - 0.32);
  group.add(conduit2);
  // junction box on the aft wall
  const jbox = _box(0.24, 0.3, 0.13, _cabSteel);
  jbox.position.set(-0.55, 1.45, hd - 0.04);
  group.add(jbox);
  for (const [jx, mat] of [[-0.05, _ledGreen], [0.05, _ledAmber]] as const) {
    const led = _box(0.025, 0.025, 0.02, mat);
    led.position.set(-0.55 + jx, 1.54, hd - 0.1);
    group.add(led);
  }
  // drooping cables under the ceiling ribs (tilted short cylinders)
  const cableSpecs: ReadonlyArray<[number, number, number, number]> = [
    [-0.45, CAB_H - 0.18, 0.4, 0.9],
    [0.4, CAB_H - 0.16, -0.45, 0.85],
  ];
  for (const [cx, cy, cz, len] of cableSpecs) {
    const cable = _cyl(0.025, 0.025, len, 6, _cabCable);
    cable.position.set(cx, cy, cz);
    cable.rotation.set(0, 0, Math.PI / 2 - 0.4);
    group.add(cable);
  }
  // a recessed dim dome light in the ceiling (the warm interior source, unlit mat). Set
  //  small + flush so it reads as a fixture, not a floating disc.
  const domeRing = _cyl(0.13, 0.15, 0.05, 14, _cabSteel);
  domeRing.position.set(0.0, CAB_H - 0.03, -0.1);
  group.add(domeRing);
  const dome = _cyl(0.10, 0.12, 0.03, 14, _ledAmber);
  dome.position.set(0.0, CAB_H - 0.05, -0.1);
  group.add(dome);

  // ── 9. A grab handle overhead (brace against the jolts) — a humanising prop on the
  //    aft-left so it doesn't block the forward viewport read.
  const grab = _cyl(0.026, 0.026, 0.46, 8, _cabSteel);
  grab.rotation.x = Math.PI / 2;
  grab.position.set(-0.5, CAB_H - 0.16, 0.5);
  group.add(grab);
  for (const sz of [-1, 1]) {
    const grabEnd = _cyl(0.026, 0.026, 0.12, 8, _cabSteel);
    grabEnd.position.set(-0.5, CAB_H - 0.22, 0.5 + sz * 0.23);
    group.add(grabEnd);
  }
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
  const lamp = new THREE.PointLight(0xffcf9e, 2.4, 7, 1.6);
  lamp.position.set(0, CAB_H - 0.12, -0.1);   // at the ceiling dome
  group.add(lamp);
  const fill = new THREE.HemisphereLight(0x6a7282, 0x2a2620, 0.55);
  group.add(fill);
  // A second cooler fill from the viewport (the planet-glow spilling in from −Z).
  const vpGlow = new THREE.PointLight(0x9fb4c4, 0.9, 5.5, 2);
  vpGlow.position.set(0, 1.6, -CAB_D / 2 - 0.05);
  group.add(vpGlow);

  // ── Conservative shell collider (seated → can't walk, but keep the capsule caged).
  const shellSpecs: ReadonlyArray<[number, number, number, number, number, number]> = [
    [CAB_W + SHELL, SHELL, CAB_D + SHELL, 0, -SHELL / 2, 0],                 // floor
    [CAB_W + SHELL, SHELL, CAB_D + SHELL, 0, CAB_H + SHELL / 2, 0],          // ceiling
    [SHELL, CAB_H, CAB_D, hwCollider(), CAB_H / 2, 0],                       // +X wall
    [SHELL, CAB_H, CAB_D, -hwCollider(), CAB_H / 2, 0],                      // −X wall
    [CAB_W, CAB_H, SHELL, 0, CAB_H / 2, CAB_D / 2 + SHELL / 2],              // aft (+Z)
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

  // The planet, seen through the viewport — a flat unlit disc, ahead + below. The
  // descent (setDescentProgress) grows it; here it's the static stand-in.
  const planetGeo = new THREE.CircleGeometry(5, 48);
  _cabinDisposables.push(planetGeo);
  const planet = new THREE.Mesh(planetGeo, new THREE.MeshBasicMaterial({ color: C_PLANET }));
  planet.position.set(0, -0.6, -11);   // ahead + slightly below the eye → reads through the window
  group.add(planet);
  planetMesh = planet;

  group.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = false; o.receiveShadow = false; } });
  ctx.three.scene.add(group);
  podGroup = group;
}

function hwCollider(): number { return CAB_W / 2 + SHELL / 2; }

/** Descent visual — grow the planet as the fall progresses (0 → 1) so it swells to fill
 *  the viewport. Greybox stand-in for the Phase-2 descentProgress effect stack. */
export function setDescentProgress(progress: number): void {
  if (!planetMesh) return;
  const p = Math.max(0, Math.min(1, progress));
  const s = 1 + p * 3.5;             // 1× → 4.5× as you fall toward the surface
  planetMesh.scale.setScalar(s);
  planetMesh.position.y = -0.6 - p * 1.8;   // sink lower (you drop toward it)
}

/** Pose the PARACHUTE lever (the gag hook). `t` in [0,1]: 0 = at rest, 1 = fully yanked
 *  forward (toward the seat). The parachute beat calls this with a brief jolt on each
 *  pull (e.g. lerp toward 1 then settle), and with `snapped=true` to droop it dead —
 *  the lever hangs slack off its pivot (the 3rd-pull SNAP, no chute). Safe no-op if the
 *  pod isn't built. */
export function setParachuteLeverPull(t: number, snapped = false): void {
  if (!chuteLever) return;
  if (snapped) {
    // The lever snaps off: it flops forward + over-rotates past its travel, then sags
    // sideways off the pivot (dead/limp) — reads "broken", not "fully pulled".
    chuteLever.rotation.x = chuteLeverRestX + 1.9;   // over-rotated past the pull stop
    chuteLever.rotation.z = 0.7;                      // slack sideways droop off the pivot
    return;
  }
  const k = Math.max(0, Math.min(1, t));
  // Pull travel: rotate forward (toward +X pitch) from the resting back-cant.
  chuteLever.rotation.x = chuteLeverRestX + k * 0.75;
  chuteLever.rotation.z = 0;
}

/** Tear down the pod (meshes + geometry + colliders + the per-build geometry pool). */
export function disposePodScene(ctx: GameContext): void {
  if (podGroup) {
    podGroup.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        // Materials are module-shared (NOT disposed); the planet's basic material is
        // per-build → dispose only that one.
        if ((o.material as THREE.Material) instanceof THREE.MeshBasicMaterial && o === planetMesh) {
          (o.material as THREE.Material).dispose();
        }
      }
    });
    ctx.three.scene.remove(podGroup);
    podGroup = null;
  }
  for (const g of _cabinDisposables) g.dispose();
  _cabinDisposables.length = 0;
  planetMesh = null;
  chuteLever = null;
  for (const body of podBodies) ctx.physics.world.removeRigidBody(body);
  podBodies.length = 0;
}

// ─── The crashed pod as a desert SPAWN WRECK (T0.4b) ──────────────────────────
// Distinct from the intro's offset flying pod: this is the wreck the player wakes beside
// in the real desert ("salvage your own pod"). A WORLD object that PERSISTS into gameplay
// (NOT disposed by endEscapePodIntro). Greybox; the hero half-buried exterior is Phase 1.

let crashedWreck: THREE.Group | null = null;
let crashedWreckBody: RAPIER.RigidBody | null = null;

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
  if (crashedWreckBody) {
    ctx.physics.world.removeRigidBody(crashedWreckBody);
    crashedWreckBody = null;
  }
}

// ─── The HERO crashed escape pod (Phase 1 / T1.1) ─────────────────────────────
// Industrial modular box (the LOCKED identity — docs/research/escape-pod-design-
// variety.md §B; explicitly NOT an ODST drop-pod). A worn hauler's lifeboat:
// steel-tube exoskeleton over frame-and-panel construction, modular cargo-hatch
// panels at cracked seams that read as REMOVABLE (sells the salvage tutorial),
// one BLOWN-OPEN hatch (the salvage face the player escaped through), a small
// OFF-CENTER RECESSED viewport in channel-steel, external cables / struts / a
// stubby thruster nub, grey-beige industrial paint + rust + sand abrasion + a
// scorched base (it reentered + crashed). Built in the game's weathered-low-poly
// idiom (wrecks.ts): createRustedHullMaterial + the WRECK_* palette, flat-shaded,
// ≥10cm panel depth (CLAUDE.md rule 7). Half-buried + tilted in the dunes.
//
// LOCAL FRAME (pre-tilt): the box long axis is X (width 2.5), height Y (2.4),
// depth Z (2.2). The BLOWN HATCH (salvage face) is on the +Z face. Origin is the
// box CENTRE; the caller drops it so ~45% sinks below the sand line.

// Pod-local dimensions (self-contained feature module; named consts per the brief).
const POD_W = 2.5;   // X — width
const POD_H = 2.4;   // Y — height
const POD_D = 2.2;   // Z — depth (the +Z face carries the blown hatch)
const FRAME = 0.16;  // exoskeleton tube half-thickness-ish (full ~0.30 square steel tube)
const SKIN = 0.16;   // hull-panel depth (rule 7: ≥15cm for hull-substantial)

// ── Shared pod materials (module-scope so re-placing the wreck doesn't realloc;
//    disposed materials in removeCrashedPodWreck reference these — see note there).
// Grey-beige industrial paint with desert-weathering opted in (dust on tops, deep
// underside oxidation, seam-pooled rust, lower-hull sand abrasion) so it sits in
// the world like the procgen wrecks, not like a clean hero prop.
const _podPaint = createRustedHullMaterial({
  baseColor: 0xb4ad96,           // grey-beige industrial paint — the DOMINANT read
  // Keep the value-only layers (wear/streak/bleach/chalk preserve the beige); pull
  // the HUE-shifting rust layers DOWN to accents so it's "beige + rust streaks",
  // NOT a rust-brown wash (the procgen desert profile is too aggressive for a hero).
  streakIntensity: 0.4,
  wearAmplitude: 0.28,
  oxStrength: 0.18, oxHex: 0x9a5026,    // sparse rust-orange accent zones only
  dustStrength: 0.3, chalkStrength: 0.32,
  oxDeepStrength: 0.22, seamRustStrength: 0.28, abrasionStrength: 0.3,
});
// Darker recessed-panel / channel-steel material (frames, viewport channel).
const _podSteel = createRustedHullMaterial({
  baseColor: Tuning.WRECK_HULL_DARK_HEX,
  streakIntensity: 0.45, wearAmplitude: 0.3,
  oxStrength: 0.45, oxDeepStrength: 0.5, seamRustStrength: 0.5,
});
// Exoskeleton tubes / struts — darker structural steel, GREYER than the panels so
// the frame-and-panel construction reads as a value contrast (dark grey steel vs
// grey-beige panel), with rust pooling as an accent — not an all-rust wash.
const _podFrameMat = createRustedHullMaterial({
  baseColor: 0x53504a,           // dark warm-grey steel
  rustHex: 0x3a1c0c, streakIntensity: 0.5, oxStrength: 0.35, oxHex: 0x8a4119,
  oxDeepStrength: 0.4, seamRustStrength: 0.45,
});
// Cables / antenna — dark matte, near-black.
const _podCableMat = new THREE.MeshLambertMaterial({ color: Tuning.WRECK_ANTENNA_HEX, flatShading: true });
// Scorched lower band — heavily darkened reentry char.
const _podScorchMat = new THREE.MeshLambertMaterial({ color: 0x1a1714, flatShading: true });
// Dark cavity (blown hatch interior + viewport glass void).
const _podVoidMat = new THREE.MeshBasicMaterial({ color: 0x0a0908 });
// Recessed viewport "glass" — dim cool tint, slightly emissive so it reads as a
// real window, not a painted square.
const _podGlassMat = new THREE.MeshStandardMaterial({
  color: 0x2b3a40, roughness: 0.35, metalness: 0.2,
  emissive: 0x0c161a, emissiveIntensity: 0.6,
});

/** Build the hero pod mesh group in its LOCAL frame (box centre = origin, +Z =
 *  salvage face). The caller positions / tilts / buries it. */
function buildHeroPodMesh(): THREE.Group {
  const g = new THREE.Group();
  const hw = POD_W / 2, hh = POD_H / 2, hd = POD_D / 2;

  // ── 1. Core hull box (the painted shell the panels + frame sit on). Slightly
  //    inset from the exoskeleton so the steel tubes read PROUD of the skin.
  const core = new THREE.Mesh(
    new THREE.BoxGeometry(POD_W - 0.06, POD_H - 0.06, POD_D - 0.06),
    _podPaint,
  );
  g.add(core);

  // ── 2. Steel-tube EXOSKELETON — square tubes running the vertical edges + a
  //    mid girth band + top/bottom rails on the front/back, so "you can see how
  //    it's built" reads from outside. Tubes are box prisms (inherently thick).
  const tube = (w: number, h: number, d: number, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), _podFrameMat);
    m.position.set(x, y, z);
    g.add(m);
    return m;
  };
  const t = FRAME * 2;   // ~0.24 tube cross-section
  // 4 vertical corner posts (proud of the skin on X and Z).
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    tube(t, POD_H + 0.04, t, sx * hw, 0, sz * hd);
  }
  // Mid girth band — horizontal tubes wrapping all 4 faces at mid-height, the
  // "modular seam" line the panels clip below/above.
  const bandY = -0.05;
  tube(POD_W + 0.04, t * 0.8, t * 0.7, 0, bandY, hd);     // front band
  tube(POD_W + 0.04, t * 0.8, t * 0.7, 0, bandY, -hd);    // back band
  tube(t * 0.7, t * 0.8, POD_D + 0.04, hw, bandY, 0);     // +X band
  tube(t * 0.7, t * 0.8, POD_D + 0.04, -hw, bandY, 0);    // -X band
  // Top rails (front + back) — the lifting/frame top edge.
  for (const sz of [-1, 1]) tube(POD_W + 0.04, t * 0.7, t * 0.6, 0, hh, sz * hd);
  for (const sz of [-1, 1]) tube(t * 0.6, t * 0.7, t * 0.6, hw, hh, sz * hd); // short top corner caps +X
  for (const sz of [-1, 1]) tube(t * 0.6, t * 0.7, t * 0.6, -hw, hh, sz * hd);

  // ── 3. Modular cargo-hatch PANELS on the side + back faces — slightly proud
  //    bolted plates with a recessed border groove, so they read as REMOVABLE
  //    ("you can strip this"). Each is a panel plate + a thin inset + 4 corner
  //    bolt studs. Depth ≥SKIN (rule 7). Placed BELOW the mid band on the flanks.
  const addModularPanel = (face: '+X' | '-X' | '-Z', cx: number, cy: number, pw: number, ph: number) => {
    const grp = new THREE.Group();
    // Plate = grey-beige paint (a removable hull panel), with a steel border groove
    // + bolt studs so it reads as bolted-on + strippable (vs the painted core skin).
    const plate = new THREE.Mesh(new THREE.BoxGeometry(pw, ph, SKIN), _podPaint);
    grp.add(plate);
    const inset = new THREE.Mesh(new THREE.BoxGeometry(pw * 0.78, ph * 0.78, SKIN * 1.4), _podPaint);
    inset.position.z = SKIN * 0.25;   // raised stamped centre → border groove shadow
    grp.add(inset);
    // A thin steel rim around the plate edge → the "removable panel seam" tell.
    const rim = new THREE.Mesh(new THREE.BoxGeometry(pw * 1.04, ph * 1.04, SKIN * 0.6), _podFrameMat);
    rim.position.z = -SKIN * 0.2;
    grp.add(rim);
    for (const bx of [-1, 1]) for (const by of [-1, 1]) {
      const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, SKIN * 0.7, 6), _podFrameMat);
      bolt.rotation.x = Math.PI / 2;
      bolt.position.set(bx * pw * 0.4, by * ph * 0.4, SKIN * 0.55);
      grp.add(bolt);
    }
    // Orient + position the panel group onto the requested face.
    if (face === '+X') { grp.rotation.y = Math.PI / 2; grp.position.set(hw + SKIN * 0.3, cy, cx); }
    else if (face === '-X') { grp.rotation.y = -Math.PI / 2; grp.position.set(-hw - SKIN * 0.3, cy, cx); }
    else { grp.position.set(cx, cy, -hd - SKIN * 0.3); }   // -Z (back) face
    g.add(grp);
  };
  // +X flank: two stacked-ish cargo panels (asymmetric sizes).
  addModularPanel('+X', -0.35, -0.45, 1.1, 0.9);
  addModularPanel('+X', 0.5, 0.55, 0.85, 0.7);
  // -X flank: one big panel + a small inspection plate.
  addModularPanel('-X', 0.2, -0.4, 1.2, 1.0);
  addModularPanel('-X', -0.55, 0.65, 0.6, 0.55);
  // -Z back: two cargo panels (the back is also strippable, not a bare slab).
  addModularPanel('-Z', 0.55, -0.3, 1.0, 1.1);
  addModularPanel('-Z', -0.6, 0.35, 0.8, 0.85);

  // ── 4. The BLOWN-OPEN HATCH on the +Z (front / salvage) face — the defining
  //    feature. A torn-open rectangular bay: a dark recessed cavity, a hatch
  //    DOOR hanging ajar off one hinge edge (bent outward), and a ragged frame
  //    of channel-steel around the opening. Off-center (the player's escape).
  const hatchCX = 0.35, hatchCY = -0.15;   // off-center on the +Z face
  const hatchW = 1.15, hatchH = 1.35;
  // 4.a cavity — a real recessed interior you peer INTO (the salvage face), not a
  //    painted black square. A deep dark box bay + a back wall set deeper + a few
  //    bent interior struts / a torn lip so the opening reads as a ripped-open hull.
  const cavity = new THREE.Mesh(
    new THREE.BoxGeometry(hatchW * 0.92, hatchH * 0.92, 0.55),
    _podVoidMat,
  );
  cavity.position.set(hatchCX, hatchCY, hd - 0.28);   // recessed INTO the box
  cavity.userData.noCollider = true;   // sits inside the core box (which has the collider)
  g.add(cavity);
  // 4.a.ii a slightly-lit back wall deep in the bay so the cavity has depth, not a flat void.
  const cavityBack = new THREE.Mesh(
    new THREE.BoxGeometry(hatchW * 0.8, hatchH * 0.8, 0.06),
    new THREE.MeshLambertMaterial({ color: 0x322a22, flatShading: true }),
  );
  cavityBack.position.set(hatchCX, hatchCY, hd - 0.52);
  cavityBack.userData.noCollider = true;
  g.add(cavityBack);
  // 4.a.iii a couple of bent interior struts crossing the bay (ripped-open frame).
  for (const [sy, rz] of [[0.25, 0.4], [-0.3, -0.25]] as const) {
    const strut = new THREE.Mesh(new THREE.BoxGeometry(hatchW * 0.85, 0.06, 0.06), _podFrameMat);
    strut.position.set(hatchCX + 0.05, hatchCY + sy, hd - 0.4);
    strut.rotation.z = rz;
    strut.userData.noCollider = true;
    g.add(strut);
  }
  // 4.b channel-steel frame ring around the opening (4 bars, proud of the skin).
  const frameBar = (w: number, h: number, ox: number, oy: number) => {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(w, h, SKIN * 1.1), _podSteel);
    bar.position.set(hatchCX + ox, hatchCY + oy, hd + SKIN * 0.2);
    g.add(bar);
  };
  const fbT = 0.16;   // frame bar thickness
  frameBar(hatchW + fbT * 2, fbT, 0, hatchH / 2 + fbT / 2);     // top
  frameBar(hatchW + fbT * 2, fbT, 0, -hatchH / 2 - fbT / 2);    // bottom
  frameBar(fbT, hatchH, -hatchW / 2 - fbT / 2, 0);             // left (hinge side)
  frameBar(fbT, hatchH, hatchW / 2 + fbT / 2, 0);              // right
  // 4.c the hatch DOOR hanging ajar — hinged at the LEFT frame edge, swung out +
  //    twisted (blown). A riveted plate with a raised inset + a handle.
  const door = new THREE.Group();
  const doorPlate = new THREE.Mesh(new THREE.BoxGeometry(hatchW * 0.98, hatchH * 0.98, SKIN), _podSteel);
  door.add(doorPlate);
  const doorInset = new THREE.Mesh(new THREE.BoxGeometry(hatchW * 0.7, hatchH * 0.7, SKIN * 1.3), _podSteel);
  doorInset.position.z = SKIN * 0.2;
  door.add(doorInset);
  for (const bx of [-1, 1]) for (const by of [-1, 1]) {
    const rivet = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, SKIN * 0.6, 6), _podFrameMat);
    rivet.rotation.x = Math.PI / 2;
    rivet.position.set(bx * hatchW * 0.38, by * hatchH * 0.38, SKIN * 0.5);
    door.add(rivet);
  }
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.3, 0.1), _podFrameMat);
  handle.position.set(hatchW * 0.32, 0, SKIN * 0.7);
  door.add(handle);
  // Hinge the door on the RIGHT vertical edge of the opening; swing it OUT (away
  // from the box, toward +Z) ~95° so the door stands proud of the hull beside the
  // dark cavity (a door across the hole reads as "shut" — the cavity must show).
  // A small blown twist so it reads as forced/torn, not a tidy open. The door
  // pivots about its own vertical (Y) edge.
  const hinge = new THREE.Group();
  hinge.position.set(hatchCX + hatchW / 2 + fbT / 2, hatchCY, hd + SKIN * 0.4);
  door.position.set(-hatchW / 2, 0, 0);   // door's local origin → RIGHT (hinge) edge
  hinge.add(door);
  hinge.rotation.y = -1.6;   // negative-Y swing → free (left) edge throws OUT to +Z, off the hull
  hinge.rotation.x = -0.12;  // tipped slightly out at the top (blown ajar, not flat)
  hinge.rotation.z = 0.1;    // small bent twist
  door.userData.noCollider = true;       // the door is a thin swung plate — skip collider
  hinge.traverse((o) => { o.userData.noCollider = true; });
  g.add(hinge);

  // ── 5. RECESSED off-center VIEWPORT in channel-steel — small, on the +Z FRONT
  //    face UPPER-LEFT (clearly separated from the hatch at lower-right), a
  //    mechanic's window (anti-ODST: small / offset / recessed, NOT a wide central
  //    vista). A proud channel-steel ring + a dim recessed glass pane facing +Z.
  const vpCX = -0.62, vpCY = 0.62, vpW = 0.52, vpH = 0.4;
  const vpRingT = 0.13;   // channel-steel ring bar thickness (proud frame)
  // 4 channel bars around the window (a real recessed frame, not a flat plate).
  const vpBar = (w: number, h: number, ox: number, oy: number) => {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(w, h, SKIN * 1.4), _podSteel);
    bar.position.set(vpCX + ox, vpCY + oy, hd + SKIN * 0.15);
    g.add(bar);
  };
  vpBar(vpW + vpRingT * 2, vpRingT, 0, vpH / 2 + vpRingT / 2);
  vpBar(vpW + vpRingT * 2, vpRingT, 0, -vpH / 2 - vpRingT / 2);
  vpBar(vpRingT, vpH, -vpW / 2 - vpRingT / 2, 0);
  vpBar(vpRingT, vpH, vpW / 2 + vpRingT / 2, 0);
  const vpGlass = new THREE.Mesh(
    new THREE.BoxGeometry(vpW, vpH, 0.06),
    _podGlassMat,
  );
  vpGlass.position.set(vpCX, vpCY, hd - 0.06);   // recessed behind the channel frame
  vpGlass.userData.noCollider = true;
  g.add(vpGlass);

  // ── 6. External CABLES + CONDUIT + a stubby THRUSTER nub — asymmetric, lived-
  //    in. A conduit pipe running up the -X/+Z corner, a loose cable drooping off
  //    the top, and a short thruster/antenna nub off the top-back corner.
  // 6.a conduit pipe up the front-left corner.
  const conduit = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.07, POD_H * 0.85, 8),
    _podCableMat,
  );
  conduit.position.set(-hw - 0.04, 0.1, hd - 0.18);
  conduit.userData.noCollider = true;
  g.add(conduit);
  // 6.b a drooping loose cable across the top (a short tilted cylinder).
  const cable = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.04, 1.3, 6),
    _podCableMat,
  );
  cable.rotation.set(0, 0.3, Math.PI / 2 - 0.5);
  cable.position.set(0.2, hh - 0.05, hd * 0.4);
  cable.userData.noCollider = true;
  g.add(cable);
  // 6.c stubby thruster nub off the top-back — a short flared cone + collar.
  const thrusterCollar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.22, 0.18, 10),
    _podSteel,
  );
  thrusterCollar.position.set(-0.5, hh + 0.05, -hd + 0.3);
  g.add(thrusterCollar);
  const thruster = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.18, 0.4, 10, 1, true),
    _podScorchMat,
  );
  thruster.position.set(-0.5, hh + 0.32, -hd + 0.3);
  thruster.userData.noCollider = true;   // hollow open cone
  g.add(thruster);
  // 6.d a stubby antenna off the top-front corner.
  const antenna = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.04, 0.9, 5),
    _podCableMat,
  );
  antenna.position.set(0.85, hh + 0.4, hd - 0.2);
  antenna.rotation.z = 0.25;
  antenna.userData.noCollider = true;
  g.add(antenna);
  // 6.e a bent lifting-eye / hoist ring on the top (asymmetric, lived-in) — a small
  //    torus on a short stalk, knocked askew by the crash. Reads as a hauler's
  //    craned-cargo fitting (anti-ODST: this is a worked container, not a weapon).
  const eyeStalk = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.22, 8), _podSteel);
  eyeStalk.position.set(0.15, hh + 0.1, -0.2);
  g.add(eyeStalk);
  const liftEye = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.045, 7, 14), _podSteel);
  liftEye.position.set(0.15, hh + 0.26, -0.2);
  liftEye.rotation.set(Math.PI / 2 + 0.5, 0.3, 0);   // knocked askew
  liftEye.userData.noCollider = true;
  g.add(liftEye);
  // 6.f a short stamped data/ID plate on the front face (upper-right) — a tiny bit
  //    of human signage so it reads as a built, labelled craft.
  const idPlate = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, SKIN * 0.9), _podSteel);
  idPlate.position.set(0.7, 0.78, hd + SKIN * 0.1);
  idPlate.userData.noCollider = true;
  g.add(idPlate);

  // ── 7. SCORCHED BASE band — the reentry + crash char on the lower hull. A
  //    slightly-proud darkened wrap on the lower ~third of all 4 faces. (Mostly
  //    buried, but the upper edge of the char shows above the sand line.)
  const scorchY = -hh + POD_H * 0.18;
  const scorch = (w: number, d: number, x: number, z: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, POD_H * 0.34, d), _podScorchMat);
    m.position.set(x, scorchY, z);
    m.userData.noCollider = true;   // cosmetic skin over the core (core has the collider)
    g.add(m);
  };
  scorch(POD_W + 0.02, SKIN, 0, hd);
  scorch(POD_W + 0.02, SKIN, 0, -hd);
  scorch(SKIN, POD_D + 0.02, hw, 0);
  scorch(SKIN, POD_D + 0.02, -hw, 0);

  // Flat-shaded low-poly: shadow flags set by the caller after placement.
  return g;
}

/** Place the HERO crashed pod at desert (x,z) — tilted + half-buried, blown hatch
 *  facing the player's wake spot. Idempotent (replaces any prior). PERSISTS into
 *  the real game (NOT disposed by endEscapePodIntro). A compound collider follows
 *  the structural silhouette (the blown door + decorations are noCollider). */
export function placeCrashedPodWreck(ctx: GameContext, x: number, z: number): void {
  removeCrashedPodWreck(ctx);
  const gy = ctx.terrain.heightAt(x, z);
  const group = buildHeroPodMesh();
  group.name = 'crashedPod';   // findable by the rig-shot framer (visual-diagnostic-methodology.md)

  // Half-buried: the box centre is at origin (height POD_H). Sink it so ~45% of
  // the hull is below the sand line, keeping the blown hatch + viewport + the
  // upper exoskeleton legibly ABOVE the sand. centre at gy + (sand line offset).
  const buryFraction = 0.42;
  const centreY = gy + POD_H * (0.5 - buryFraction);   // 0.5 → centre at sand; less → sunk
  group.position.set(x, centreY, z);
  // Crash pose: yaw to a 3/4 so the wake camera (from +X/+Z) sees BOTH the +Z
  // hatch face AND the +X modular-panel flank → the box reads as a 3D volume, not
  // a flat board. A forward pitch + roll for the tipped-into-dune look.
  group.rotation.set(0.08, 0.7, 0.14);

  group.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; }
  });
  ctx.three.scene.add(group);

  // Compound collider matching the structural meshes (core box + frame tubes +
  // panels). Decorations (door, cables, viewport glass, thruster cone, scorch
  // skins) are tagged noCollider so they don't spawn phantom walls. The tilt +
  // burial are baked into the group's world matrix that attachCompoundCollider reads.
  group.updateMatrixWorld(true);
  crashedWreckBody = attachCompoundCollider(ctx.physics.world, group);
  crashedWreck = group;
}
