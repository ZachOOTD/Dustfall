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
