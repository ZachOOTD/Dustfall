// Escape-pod intro — the greybox ESCAPE POD interior (Phase 0 / T0.3).
// ─────────────────────────────────────────────────────────────────────────────
// A tight enclosed capsule the player rides during eject → ship-explode → descent.
// Built lazily when the intro reaches the pod, disposed at the desert handoff. Same
// blockout discipline as shipScene.ts (box meshes + matched static colliders, unlit
// MeshBasicMaterial, far offset), at its OWN offset above the ship so both can coexist
// briefly (you watch the ship explode from the pod). The HERO pod (industrial modular
// box, the chosen identity) is Phase 1; this is just the volume + the viewport.
// ─────────────────────────────────────────────────────────────────────────────

import * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';
import type { GameContext } from '../../GameContext.ts';
import { makeStaticBox, attachCompoundCollider } from '../../physics/bodies.ts';
import { Tuning } from '../../config/tuning.ts';
import { createRustedHullMaterial } from '../hullMaterial.ts';

/** The pod offset — above the ship (which is at y=3000) so you watch it blow up below. */
const POD_ORIGIN = new THREE.Vector3(0, 3200, 0);

// Greybox palette — warmer/darker than the ship so the pod reads as a different space.
const C_FLOOR = 0x40444b;
const C_WALL = 0x595e66;
const C_CEIL = 0x32363b;
const C_FRAME = 0x232529;
const C_SEAT = 0x4d5258;
const C_PLANET = 0xc98a5a;

type BoxSpec = [number, number, number, number, number, number];

// A tight capsule: ~2.6w (x −1.3..1.3) × 2.2h (y 0..2.2) × 2.8d (z −1.4..1.4). The
// VIEWPORT is in the −Z wall (the camera faces −Z when seated → looks straight out).
const SPECS: ReadonlyArray<readonly [BoxSpec, number]> = [
  [[2.6, 0.2, 2.8, 0, -0.1, 0], C_FLOOR],     // floor (top at y=0)
  [[2.6, 0.2, 2.8, 0, 2.3, 0], C_CEIL],       // ceiling
  [[0.2, 2.2, 2.8, 1.3, 1.1, 0], C_WALL],     // +X wall
  [[0.2, 2.2, 2.8, -1.3, 1.1, 0], C_WALL],    // −X wall
  [[2.6, 2.2, 0.2, 0, 1.1, 1.4], C_WALL],     // back (+Z) wall
  // Front (−Z) viewport wall, around a 1.6w × 1.2h gap (x −0.8..0.8, y 0.7..1.9):
  [[2.6, 0.7, 0.2, 0, 0.35, -1.4], C_FRAME],  // below viewport
  [[2.6, 0.3, 0.2, 0, 2.05, -1.4], C_FRAME],  // above viewport
  [[0.5, 1.2, 0.2, -1.05, 1.3, -1.4], C_FRAME], // left of viewport
  [[0.5, 1.2, 0.2, 1.05, 1.3, -1.4], C_FRAME],  // right of viewport
  // A blocky seat the player rides in (greybox flavour; no collider needed but cheap).
  [[0.8, 0.5, 0.7, 0, 0.25, 0.5], C_SEAT],
];

let podGroup: THREE.Group | null = null;
const podBodies: RAPIER.RigidBody[] = [];
let planetMesh: THREE.Mesh | null = null;   // grown during the descent (setDescentProgress)

/** Is the greybox pod currently built? */
export function podBuilt(): boolean {
  return podGroup !== null;
}

/** World-space seated spawn: pod centre, on the floor, slightly aft so the viewport
 *  fills the view ahead. Capsule centre = floor-top + halfHeight + radius. */
export function getPodSpawn(ctx: GameContext): THREE.Vector3 {
  const pb = ctx.player.body;
  return new THREE.Vector3(
    POD_ORIGIN.x,
    POD_ORIGIN.y + pb.halfHeight + pb.radius,
    POD_ORIGIN.z + 0.45,
  );
}

/** Build the greybox pod (mesh group + matched static colliders) at POD_ORIGIN.
 *  Idempotent. */
export function buildPodScene(ctx: GameContext): void {
  if (podGroup) return;
  const group = new THREE.Group();
  group.position.copy(POD_ORIGIN);

  for (const [spec, color] of SPECS) {
    const [w, h, d, cx, cy, cz] = spec;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshBasicMaterial({ color }),
    );
    mesh.position.set(cx, cy, cz);
    group.add(mesh);
    const col = makeStaticBox(
      ctx.physics.world,
      { x: w / 2, y: h / 2, z: d / 2 },
      { x: POD_ORIGIN.x + cx, y: POD_ORIGIN.y + cy, z: POD_ORIGIN.z + cz },
    );
    const body = col.parent();
    if (body) podBodies.push(body);
  }

  // The planet, seen through the viewport — a flat unlit disc, ahead + below. During the
  // descent (T0.3b) it grows; here it's a static stand-in.
  const planet = new THREE.Mesh(
    new THREE.CircleGeometry(5, 48),
    new THREE.MeshBasicMaterial({ color: C_PLANET }),
  );
  planet.position.set(0, -2.5, -12);
  group.add(planet);
  planetMesh = planet;

  ctx.three.scene.add(group);
  podGroup = group;
}

/** Descent visual — grow the planet as the fall progresses (0 → 1) so it swells to fill
 *  the viewport. Greybox stand-in for the Phase-2 descentProgress effect stack. */
export function setDescentProgress(progress: number): void {
  if (!planetMesh) return;
  const p = Math.max(0, Math.min(1, progress));
  const s = 1 + p * 3.5;             // 1× → 4.5× as you fall toward the surface
  planetMesh.scale.setScalar(s);
  planetMesh.position.y = -2.5 - p * 2.5;   // sink lower (you drop toward it)
}

/** Tear down the greybox pod (meshes + geometry + colliders). */
export function disposePodScene(ctx: GameContext): void {
  if (podGroup) {
    podGroup.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        (o.material as THREE.Material).dispose();
      }
    });
    ctx.three.scene.remove(podGroup);
    podGroup = null;
  }
  planetMesh = null;
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
