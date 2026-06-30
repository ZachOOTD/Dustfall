// Escape-pod intro — the HERO CARGO HAULER EXTERIOR (Phase 3 / T3.1).
// ─────────────────────────────────────────────────────────────────────────────
// The worn freighter the lone pilot has just fled — seen THROUGH the escape pod's
// round porthole at the `shipExplode` beat: it floats in orbit ahead of the pod
// (−Z, the seated FP view straight out the window), about to die. This is the
// vessel the whole opening is about; it must read as a beautiful, weathered,
// believable HERO ship through that round aperture ("you just escaped THAT").
//
// REDESIGN (after a 4-critic adversarial gate failed the first build: "a floating
// pallet of cardboard boxes" — engines/cockpit didn't READ even though they were in
// the code). The fix is structural, not cosmetic:
//   • ORIENTATION: the readable views (porthole + broadside) look at the ship's +Z
//     flank from a 3/4. So the ENGINE BELLS must FLARE OUT past the −X tail where
//     their cones read in PROFILE against the star void (the prior bells pointed
//     dead away → you saw the open box-END). The engine bay is now the longest,
//     chunkiest, most-readable feature of the rear: a reactor housing + 4 big flared
//     nozzles with charred + EMBER-EMISSIVE throats projecting clearly aft.
//   • DIRECTIONALITY: an unmistakable THREE-PART silhouette — a glassed warm-lit
//     COCKPIT up FRONT (a clear pointed nose), a LONG cargo SPINE in the middle with
//     containers LASHED into open steel CRADLES (not loose crates piled on a skid),
//     and the REAR ENGINE BLOCK. Front≠back at a glance (Nostromo / Mad-Max war-rig
//     / Sandcrawler read).
//   • METAL: createRustedHullMaterial tuned to MATCH the pod (metallic panel breakup,
//     rust streaks, bare-metal flecks, edge wear) — NOT flat tan cardboard.
//   • HERO READ through the porthole: a cool back-RIM pops the silhouette off the
//     stars; EMISSIVE nav lights at the extremities; a WARM cockpit-window glow; the
//     ship sits CLOSER/BIGGER so it fills the aperture as THE ship, not debris.
//
// CONTRACT: buildHaulerExterior(ctx) builds + places the hero hauler in front of the
// pod, visible through the −Z porthole, against a self-contained star backdrop;
// disposeHaulerExterior(ctx) fully tears it down. SELF-CONTAINED — does NOT touch the
// descent vista / cabin / camera / FX.
// ─────────────────────────────────────────────────────────────────────────────

import * as THREE from 'three';
import type { GameContext } from '../../GameContext.ts';
import { createRustedHullMaterial } from '../hullMaterial.ts';

// The pod offset (mirrors podScene's POD_ORIGIN — the pod is at y=3200 in deep
// space). The hauler is placed RELATIVE to this so it frames through the −Z porthole.
const POD_ORIGIN = new THREE.Vector3(0, 3200, 0);

// ── Placement (pod-relative). The seated eye is ~POD_ORIGIN + (0, ~1.94, 0) looking
//    down −Z (porthole centre y≈POD_ORIGIN.y+1.34). The hauler floats out in space
//    ahead (−Z), CLOSE enough to fill the porthole + feel its mass, presenting its
//    BROADSIDE +Z flank at a gentle 3/4 (engines screen-LEFT at −X, cockpit screen-
//    RIGHT at +X). It hangs slightly above the eye line + a touch +X for a 3/4 read.
const HAULER_DIST = 24;     // metres down −Z (close → fills the porthole as THE ship)
const HAULER_Y = 1.6;       // a touch above the eye line
const HAULER_X = 1.0;       // slight +X bias → depth
const HAULER_POS = new THREE.Vector3(
  POD_ORIGIN.x + HAULER_X,
  POD_ORIGIN.y + HAULER_Y,
  POD_ORIGIN.z - HAULER_DIST,
);
// Present a REAR-three-quarter to the porthole: a positive yaw swings the −X engine
// bay toward the camera (+Z) so the flared nozzle cones read prominently (the gate's
// fatal miss was the bells edge-on), while the long flank + the cockpit at the far end
// still read → an unmistakable directional silhouette with the engines featured.
const HAULER_YAW = 0.34;
// A gentle adrift attitude — slightly nose-up + banked (a dead ship, not flying level).
const HAULER_PITCH = 0.05;
const HAULER_ROLL = -0.05;

// ── Long-axis layout (ship-LOCAL: long axis = +X = nose → −X = tail; +Y = up; +Z =
//    the broadside flank facing the camera). Built nose-at-+X, tail-at-−X, then the
//    whole assembly is centred on its span. A LONG, heavy freighter (~22m), slim beam
//    → tonnage (the prior near-cubic build read small).
const HULL_R = 1.35;         // cargo-spine hull half-beam (slim → long freighter)
const HULL_LEN = 11.0;       // cargo midsection length (the dominant body — long)
const COCKPIT_LEN = 3.4;     // front bridge length
const ENGINE_LEN = 5.0;      // rear engine bay length (block + the bells flaring aft)
const SEG = 18;              // cylinder/lathe radial segments (round, low-poly)

// ── Materials — createRustedHullMaterial tuned to MATCH the pod/wreck METAL read
//    (the gate flagged "cardboard"). Module-scope (no realloc on rebuild); dispose
//    frees GEOMETRY + the per-build star/glow mats, NOT these shared mats.
// Weathered aluminium HULL skin — cool grey, strong plate breakup + rust streaks +
// dense bare-metal flecks (a working freighter, grubbier than the clean pod).
const _hullSkinReal = createRustedHullMaterial({
  baseColor: 0x9aa0a4,           // cool weathered aluminium-grey — the DOMINANT read (lifted + cooled)
  bareMetalHex: 0xccd1d4,        // bright scuffed-aluminium reveal (cool, near-white)
  rustHex: 0x5a4634,             // a more NEUTRAL grime tone (was a warm rust → browned the whole hull)
  streakIntensity: 0.4,          // grime drip-runs as ACCENT, not a wash
  wearAmplitude: 0.46,           // plate-to-plate tonal break-up (patchwork plating)
  fleckStrength: 1.0,            // dense bare-metal scuff scratches → scrappy aluminium reads metallic
  oxStrength: 0.3, oxHex: 0x8a6038,    // SPARSER warm oxide patches (rust as accent, hull stays aluminium)
  oxDeepStrength: 0.26, seamRustStrength: 0.36, abrasionStrength: 0.5,   // more cool sand-abrasion (bare metal)
});
// Dark channel-steel structure (engine reactor block, frame ribs, keel beams, cargo
// cradles, mullions) — a value contrast so the structure reads as fitted-on.
const _hullSteel = createRustedHullMaterial({
  baseColor: 0x474a4d, rustHex: 0x2a1d12, streakIntensity: 0.46, wearAmplitude: 0.34,
  oxStrength: 0.45, oxDeepStrength: 0.45, seamRustStrength: 0.5,
});
// Mid steel-grey hardware (rivets, struts, collars, ladder rungs, pipes).
const _hullFrame = createRustedHullMaterial({
  baseColor: 0x787a7c, rustHex: 0x4a2810, streakIntensity: 0.36,
  oxStrength: 0.36, oxHex: 0x8f5a2e, oxDeepStrength: 0.32, seamRustStrength: 0.36, fleckStrength: 0.7,
});
// Cargo containers — INDUSTRIAL METAL (the gate flagged "tan cardboard"). A faded
// utilitarian rust-red shipping-container steel (a colour ACCENT vs the grey hull, but
// unmistakably corroded metal: heavy streaks, flecks, oxidation, abrasion).
const _container = createRustedHullMaterial({
  baseColor: 0x7e4a32,           // faded rust-red container steel (deeper, less tan)
  bareMetalHex: 0xa89684, rustHex: 0x46281a,
  streakIntensity: 0.62, wearAmplitude: 0.42, fleckStrength: 0.85,
  oxStrength: 0.55, oxHex: 0x934f26, oxDeepStrength: 0.46, seamRustStrength: 0.58, abrasionStrength: 0.4,
});
// A second container tone (a different cargo lot — asymmetry; a grimy green-grey steel).
const _container2 = createRustedHullMaterial({
  baseColor: 0x5e6256, bareMetalHex: 0x9aa090, rustHex: 0x3a3022,
  streakIntensity: 0.55, wearAmplitude: 0.4, fleckStrength: 0.8,
  oxStrength: 0.5, oxHex: 0x7a5a2a, oxDeepStrength: 0.42, seamRustStrength: 0.5,
});
// Slung tanks — a cool industrial tank-grey (value + hue break from the hull).
const _tank = createRustedHullMaterial({
  baseColor: 0x80878c, bareMetalHex: 0xbcc2c6, rustHex: 0x5a4030,
  streakIntensity: 0.46, wearAmplitude: 0.36, fleckStrength: 0.7,
  oxStrength: 0.36, oxDeepStrength: 0.34, seamRustStrength: 0.42,
});
// Engine-bell metal (the flared nozzle skirts) — a dark heat-tarnished bronze-steel so
// the bells read as nozzles, distinct from the cool hull.
const _engineBell = createRustedHullMaterial({
  baseColor: 0x584636, bareMetalHex: 0x8a7458, rustHex: 0x3a2616,
  streakIntensity: 0.42, wearAmplitude: 0.38, oxStrength: 0.48, oxHex: 0x7a4a22, oxDeepStrength: 0.42,
});
// Charred combustion-throat char (the sooted hot end — where the failure ignites).
const _engineChar = createRustedHullMaterial({
  baseColor: 0x241c16, rustHex: 0x140d08, bleachHex: 0x342820,
  streakIntensity: 0.3, wearAmplitude: 0.35, oxStrength: 0.5, oxHex: 0x6a3a1e, oxTopStrength: 0.4,
});
// Cockpit glass — a glossy dark-tinted canopy (a clear glass spec catch + a lit-from-
// within bridge so the FRONT reads unmistakably as a cockpit you just fled).
const _cockpitGlass = new THREE.MeshStandardMaterial({
  color: 0x1a2632, roughness: 0.1, metalness: 0.6,
  emissive: 0x223a4a, emissiveIntensity: 1.1,   // a warm-cool lit bridge (you just fled it)
});
// Dark matte near-black (antennae, cabling, fine struts, lashing straps).
const _dark = new THREE.MeshLambertMaterial({ color: 0x1a1814, flatShading: true });
// Self-lit NAV lights (emissive basic → glow against the void): red port, green stbd,
// amber strobe/beacon. toneMapped:false so they pop as light sources.
const _navRed = new THREE.MeshBasicMaterial({ color: 0xff3326, toneMapped: false });
const _navGreen = new THREE.MeshBasicMaterial({ color: 0x3cf05a, toneMapped: false });
const _navAmber = new THREE.MeshBasicMaterial({ color: 0xffb028, toneMapped: false });
// Stencilled registration paint — a faded off-white hull number (basic, unlit).
const _stencil = new THREE.MeshBasicMaterial({ color: 0xb4ad9e, toneMapped: false });
// Warm cockpit interior glow plate (behind the glass — the lit bridge spill).
const _cockpitGlow = new THREE.MeshBasicMaterial({ color: 0x6a5230, toneMapped: false });
// Engine-throat EMBER (a hot idle deep in the bells — pre-stages the T3.2 failure).
const _engineEmber = new THREE.MeshBasicMaterial({ color: 0xc24a1e, toneMapped: false });

// Per-build disposables (geometry rebuilt per placement) + per-build star/glow mats.
let haulerGroup: THREE.Group | null = null;
const _disposables: THREE.BufferGeometry[] = [];
let starMat: THREE.ShaderMaterial | null = null;
let starMesh: THREE.Mesh | null = null;
let starGeo: THREE.BufferGeometry | null = null;
const _heroLights: THREE.Light[] = [];

/** Is the hauler currently built? */
export function haulerBuilt(): boolean {
  return haulerGroup !== null;
}

// ── Build helpers (closure-free; push geometry to _disposables to free later) ──
function _box(w: number, h: number, d: number, mat: THREE.Material): THREE.Mesh {
  const g = new THREE.BoxGeometry(w, h, d);
  _disposables.push(g);
  return new THREE.Mesh(g, mat);
}
function _cyl(rt: number, rb: number, h: number, seg: number, mat: THREE.Material, open = false): THREE.Mesh {
  const g = new THREE.CylinderGeometry(rt, rb, h, seg, 1, open);
  _disposables.push(g);
  return new THREE.Mesh(g, mat);
}
function _lathe(prof: THREE.Vector2[], seg: number, mat: THREE.Material): THREE.Mesh {
  const g = new THREE.LatheGeometry(prof, seg);
  g.computeVertexNormals();
  _disposables.push(g);
  return new THREE.Mesh(g, mat);
}
function _sphere(r: number, mat: THREE.Material, wseg = 12, hseg = 8): THREE.Mesh {
  const g = new THREE.SphereGeometry(r, wseg, hseg);
  _disposables.push(g);
  return new THREE.Mesh(g, mat);
}

// ── 1. CARGO SPINE (mid) — the dominant body. A long boxy aluminium keel hull banded
//    by riveted frame ribs, carrying containers LASHED into open steel CRADLES on the
//    camera-facing flank (NOT a loose pile), slung underneath with cylindrical tanks,
//    + greebles (pipes, vents, a hatch, a ladder, hull number, placards).
function buildCargoSpine(g: THREE.Group, midX: number): void {
  const HALF = HULL_LEN / 2;
  // 1.a the keel hull — a long boxy aluminium body, chamfered so it isn't a plain brick.
  const hull = _box(HULL_LEN, HULL_R * 1.8, HULL_R * 1.6, _hullSkinReal);
  hull.position.set(midX, 0, 0);
  g.add(hull);
  // a narrower dorsal spine box on top (the utility run / walkway) — breaks the brick.
  const dorsal = _box(HULL_LEN * 0.94, HULL_R * 0.42, HULL_R * 0.95, _hullSteel);
  dorsal.position.set(midX, HULL_R * 1.05, 0);
  g.add(dorsal);
  // a ventral keel beam (the channel-steel underbelly the tanks hang from)
  const keel = _box(HULL_LEN * 0.97, HULL_R * 0.42, HULL_R * 0.66, _hullSteel);
  keel.position.set(midX, -HULL_R * 1.0, 0);
  g.add(keel);

  // 1.b riveted FRAME RIBS banding the hull (the fabricated-freighter structural read).
  const ribN = 7;
  for (let i = 0; i < ribN; i++) {
    const rx = midX - HALF * 0.86 + (i / (ribN - 1)) * HALF * 1.72;
    const ribTop = _box(0.16, 0.16, HULL_R * 1.7, _hullFrame);
    ribTop.position.set(rx, HULL_R * 0.9, 0);
    g.add(ribTop);
    const ribFace = _box(0.16, HULL_R * 1.8, 0.16, _hullFrame);
    ribFace.position.set(rx, 0, HULL_R * 0.82);
    g.add(ribFace);
    for (let k = 0; k < 5; k++) {
      const ry = -HULL_R * 0.66 + k * (HULL_R * 1.32 / 4);
      const stud = _sphere(0.05, _hullFrame, 6, 4);
      stud.scale.z = 0.5;
      stud.position.set(rx, ry, HULL_R * 0.9);
      g.add(stud);
    }
  }

  // 1.c CONTAINERS LASHED INTO CRADLES on the dorsal deck (integrated cargo, not loose
  //     crates). Each: an open steel CRADLE frame (4 corner posts + a base) holding a
  //     corrugated container, cinched with dark tie-down STRAPS over the top + corner
  //     castings. Varied container tones (different cargo lots → asymmetry).
  const cargo: ReadonlyArray<[number, number, number, number, THREE.Material]> = [
    // [xFrac of HULL_LEN, w, h, d, container mat]
    [-0.30, 1.7, 1.15, 1.5, _container],
    [-0.02, 2.1, 1.3, 1.55, _container2],
    [0.28, 1.5, 1.0, 1.45, _container],
  ];
  for (const [xf, cw, ch, cd, mat] of cargo) {
    const cx = midX + xf * HULL_LEN;
    const cy = HULL_R * 1.26 + ch / 2;
    // the cradle base plate (the container sits IN the cradle, not loose on the deck)
    const base = _box(cw + 0.2, 0.14, cd + 0.2, _hullSteel);
    base.position.set(cx, HULL_R * 1.26, 0);
    g.add(base);
    // 4 corner posts of the cradle (the container is seated between them)
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const post = _box(0.12, ch + 0.1, 0.12, _hullSteel);
      post.position.set(cx + sx * (cw / 2 + 0.05), cy, sz * (cd / 2 + 0.05));
      g.add(post);
    }
    // the corrugated container body (ribbed via thin proud vertical strakes on the +Z face)
    const cont = _box(cw, ch, cd, mat);
    cont.position.set(cx, cy, 0);
    g.add(cont);
    for (let s = 0; s < 5; s++) {
      const sx = -cw / 2 + 0.12 + s * ((cw - 0.24) / 4);
      const corr = _box(0.06, ch * 0.86, 0.05, _hullFrame);
      corr.position.set(sx, cy, cd / 2 + 0.02);
      g.add(corr);
    }
    // corner castings (the shipping-container corner blocks — the metal-cargo tell)
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
      const cast = _box(0.18, 0.18, cd + 0.04, _hullFrame);
      cast.position.set(cx + sx * (cw / 2 - 0.05), cy + sy * (ch / 2 - 0.05), 0);
      g.add(cast);
    }
    // 2 dark tie-down STRAPS cinching the container into the cradle (lashed read)
    for (const sf of [-0.3, 0.3]) {
      const strap = _box(0.1, ch + 0.24, cd + 0.18, _dark);
      strap.position.set(cx + sf * cw, cy, 0);
      g.add(strap);
    }
  }

  // 1.d slung cylindrical TANKS underneath the keel (the recognizable cargo-hauler cue).
  for (const [tx, tlen, tr] of [[-0.16, HULL_LEN * 0.5, 0.6], [0.22, HULL_LEN * 0.42, 0.52]] as const) {
    const tankX = midX + tx * HULL_LEN;
    const tank = _cyl(tr, tr, tlen, SEG, _tank);
    tank.rotation.z = Math.PI / 2;
    tank.position.set(tankX, -HULL_R * 1.08, HULL_R * 0.52);
    g.add(tank);
    for (const ef of [-1, 1]) {
      const cap = _sphere(tr, _tank, SEG, 8);
      cap.scale.x = 0.55;
      cap.position.set(tankX + ef * tlen / 2, -HULL_R * 1.08, HULL_R * 0.52);
      g.add(cap);
    }
    for (const cf of [-0.28, 0.28]) {
      const collar = _cyl(tr + 0.08, tr + 0.08, 0.12, SEG, _hullFrame, true);
      collar.rotation.z = Math.PI / 2;
      collar.position.set(tankX + cf * tlen, -HULL_R * 1.08, HULL_R * 0.52);
      g.add(collar);
      const strut = _box(0.12, HULL_R * 0.7, 0.12, _hullSteel);
      strut.position.set(tankX + cf * tlen, -HULL_R * 0.7, HULL_R * 0.28);
      g.add(strut);
    }
  }

  // 1.e a HUMAN-SCALE airlock HATCH on the camera-facing (+Z) hull flank (implies mass —
  //     a person-sized door on a huge hull). A recessed dark frame + a round hatch + a
  //     ladder of rungs leading up to it.
  const hatchX = midX + HULL_LEN * 0.12;
  const hatchFrame = _box(0.95, 1.25, 0.1, _hullSteel);
  hatchFrame.position.set(hatchX, -0.1, HULL_R * 0.82);
  g.add(hatchFrame);
  const hatch = _cyl(0.42, 0.42, 0.12, SEG, _hullFrame);
  hatch.rotation.x = Math.PI / 2;
  hatch.position.set(hatchX, -0.1, HULL_R * 0.86);
  g.add(hatch);
  const hatchHub = _cyl(0.12, 0.12, 0.16, 8, _hullSteel);
  hatchHub.rotation.x = Math.PI / 2;
  hatchHub.position.set(hatchX, -0.1, HULL_R * 0.9);
  g.add(hatchHub);
  // ladder rungs down from the hatch (human-scale tell)
  for (let r = 0; r < 4; r++) {
    const rung = _box(0.34, 0.05, 0.06, _hullFrame);
    rung.position.set(hatchX, -0.75 - r * 0.22, HULL_R * 0.88);
    g.add(rung);
  }
  for (const sx of [-0.15, 0.15]) {
    const rail = _box(0.05, 0.95, 0.05, _hullFrame);
    rail.position.set(hatchX + sx, -0.95, HULL_R * 0.87);
    g.add(rail);
  }

  // 1.f dorsal + flank GREEBLES — pipes, vents, conduit boxes (asymmetric, lived-in).
  const greebs: ReadonlyArray<[number, number, number, number, number]> = [
    [-0.4, 0.4, 0.5, 0.4, HULL_R * 0.3], [-0.1, 0.55, 0.32, 0.55, HULL_R * 0.36],
    [0.14, 0.34, 0.55, 0.34, HULL_R * 0.3], [0.4, 0.46, 0.4, 0.46, HULL_R * 0.32],
  ];
  for (const [xf, gw, gh, gd, gz] of greebs) {
    const greeb = _box(gw, gh, gd, _hullSteel);
    greeb.position.set(midX + xf * HULL_LEN, HULL_R * 1.0 + gh / 2, gz);
    greeb.rotation.y = xf * 0.4;
    g.add(greeb);
  }
  // long flank conduit pipes running the spine (the plumbing read)
  for (const [py, pr] of [[HULL_R * 0.5, 0.1], [-HULL_R * 0.55, 0.08]] as const) {
    const pipe = _cyl(pr, pr, HULL_LEN * 0.72, 8, _hullFrame);
    pipe.rotation.z = Math.PI / 2;
    pipe.position.set(midX, py, HULL_R * 0.78);
    g.add(pipe);
  }

  // 1.g stencilled REGISTRATION number + a hazard STRIPE + a warning PLACARD on the
  //     camera-facing flank (lived-in identity; abstracted glyph blocks read as a code).
  const regChars = [0.9, 0.5, 0.7, 0.9, 0.6, 0.8];
  let gx = midX - 2.0;
  for (const cw of regChars) {
    const glyph = _box(cw * 0.5, 0.55, 0.04, _stencil);
    glyph.position.set(gx, 0.62, HULL_R * 0.83 + 0.02);
    g.add(glyph);
    gx += cw * 0.5 + 0.2;
  }
  // a faded painted hazard stripe along the lower flank (asymmetric — only the fore half)
  const stripe = _box(HULL_LEN * 0.42, 0.3, 0.03, _navAmber);
  stripe.position.set(midX + HULL_LEN * 0.16, -0.62, HULL_R * 0.83 + 0.015);
  g.add(stripe);
  // a small warning placard near the hatch
  const placard = _box(0.5, 0.34, 0.03, _stencil);
  placard.position.set(hatchX + 0.7, -0.1, HULL_R * 0.83 + 0.02);
  g.add(placard);
}

// ── 2. COCKPIT / BRIDGE (front, +X nose) — a distinct forward bridge with a raised
//    house, a big WARM-LIT raked windscreen, a pointed nose, mast + dish + antennae.
//    The unmistakable FRONT (you just fled this).
function buildCockpit(g: THREE.Group, noseX: number): void {
  // 2.a the forward bridge BLOCK + a RAISED house on top (a clear "head").
  const bridge = _box(COCKPIT_LEN, HULL_R * 1.55, HULL_R * 1.5, _hullSkinReal);
  bridge.position.set(noseX - COCKPIT_LEN / 2, HULL_R * 0.15, 0);
  g.add(bridge);
  const house = _box(COCKPIT_LEN * 0.7, HULL_R * 1.0, HULL_R * 1.2, _hullSkinReal);
  house.position.set(noseX - COCKPIT_LEN * 0.52, HULL_R * 1.15, 0);
  g.add(house);
  // a pointed nose prow (a clear FRONT, not a flat brick face).
  const nose = _cyl(0.16, HULL_R * 1.0, 1.5, SEG, _hullSkinReal);
  nose.rotation.z = -Math.PI / 2;
  nose.scale.y = 0.78;
  nose.position.set(noseX + 0.6, HULL_R * 0.0, 0);
  g.add(nose);
  // a stack of nose running-light + sensor strip under the prow
  const chin = _box(0.7, 0.42, 0.7, _hullSteel);
  chin.position.set(noseX - 0.05, -HULL_R * 0.55, 0);
  g.add(chin);

  // 2.b the WARM-LIT raked WINDSCREEN across the front of the bridge house — glossy
  //     tinted glass + a bright interior glow + framed panes → reads as a cockpit you
  //     fled (the lit bridge is a key hero cue through the porthole).
  const wsX = noseX - COCKPIT_LEN * 0.18;
  const wsY = HULL_R * 1.28;
  const canopy = _box(0.12, HULL_R * 1.1, HULL_R * 1.35, _cockpitGlass);   // bigger windscreen
  canopy.position.set(wsX, wsY, 0);
  canopy.rotation.z = 0.62;
  g.add(canopy);
  // a BRIGHT warm glow plate just behind the glass (the lit bridge)
  const glow = _box(0.06, HULL_R * 0.96, HULL_R * 1.16, _cockpitGlow);
  glow.position.set(wsX - 0.14, wsY - 0.04, 0);
  glow.rotation.z = 0.62;
  g.add(glow);
  // a row of small lit SIDE WINDOWS on the camera-facing (+Z) flank of the bridge house
  // (so the cockpit reads as lit + occupied even from the porthole 3/4 angle).
  for (let i = 0; i < 3; i++) {
    const win = _box(0.34, 0.3, 0.05, _cockpitGlass);
    win.position.set(noseX - COCKPIT_LEN * 0.32 - i * 0.42, HULL_R * 1.2, HULL_R * 0.62);
    g.add(win);
    const winGlow = _box(0.28, 0.24, 0.03, _cockpitGlow);
    winGlow.position.set(noseX - COCKPIT_LEN * 0.32 - i * 0.42, HULL_R * 1.2, HULL_R * 0.6);
    g.add(winGlow);
  }
  // windscreen mullions (vertical pane splits) + a horizontal split
  for (const mf of [-0.62, 0, 0.62]) {
    const mull = _box(0.14, HULL_R * 1.0, 0.09, _hullFrame);
    mull.position.set(wsX + 0.03, wsY, mf * HULL_R * 0.68);
    mull.rotation.z = 0.62;
    g.add(mull);
  }
  const hMull = _box(0.16, 0.1, HULL_R * 1.2, _hullFrame);
  hMull.position.set(wsX + 0.05, wsY, 0);
  hMull.rotation.z = 0.62;
  g.add(hMull);
  // a brow visor over the windscreen top
  const brow = _box(0.9, 0.14, HULL_R * 1.3, _hullSteel);
  brow.position.set(noseX - COCKPIT_LEN * 0.46, HULL_R * 1.78, 0);
  brow.rotation.z = 0.18;
  g.add(brow);

  // 2.c sensor MAST + comms DISH + whip antennae on the bridge roof.
  const mast = _cyl(0.06, 0.08, 1.5, 8, _hullFrame);
  mast.position.set(noseX - COCKPIT_LEN * 0.72, HULL_R * 1.7, 0.3);
  g.add(mast);
  const dishProf: THREE.Vector2[] = [];
  for (let i = 0; i <= 6; i++) { const t = i / 6; dishProf.push(new THREE.Vector2(t * 0.44, t * t * 0.22)); }
  const dish = _lathe(dishProf, 12, _hullFrame);
  dish.position.set(noseX - COCKPIT_LEN * 0.72, HULL_R * 1.7 + 0.65, 0.3);
  dish.rotation.set(-0.6, 0, 0.3);
  g.add(dish);
  for (const [ax, az] of [[noseX - 0.2, -0.4], [noseX - COCKPIT_LEN * 0.5, 0.5]] as const) {
    const whip = _cyl(0.02, 0.03, 1.2, 5, _dark);
    whip.position.set(ax, HULL_R * 1.7, az);
    whip.rotation.z = 0.12;
    g.add(whip);
  }
}

// ── 3. ENGINE BAY (rear, −X tail) — THE PROMINENT, READABLE feature that fails +
//    explodes (T3.2). A chunky channel-steel REACTOR HOUSING + tall radiator vanes
//    carrying FOUR big flared rocket NOZZLES that protrude clearly AFT past the tail,
//    so their flared cones read in PROFILE against the star void (the gate's fatal
//    miss: the prior bells were edge-on/hidden). Charred throats + EMISSIVE embers.
function buildEngineCluster(g: THREE.Group, tailX: number): void {
  // 3.a the REACTOR HOUSING — a fat dark-steel block at the rear, wider + taller than
  //     the spine, stepped from a transition collar (the engines mount on its aft face).
  const collar = _cyl(HULL_R * 1.2, HULL_R * 0.9, 0.9, SEG, _hullSteel);
  collar.rotation.z = Math.PI / 2;
  collar.position.set(tailX + 0.45, 0, 0);
  g.add(collar);
  const block = _box(1.9, HULL_R * 2.5, HULL_R * 2.5, _hullSteel);
  block.position.set(tailX - 0.55, 0, 0);
  g.add(block);
  // tall dorsal RADIATOR VANES on the housing (the heat-shedding read, vertical so they
  //   read in profile against the stars).
  for (let i = 0; i < 3; i++) {
    const vane = _box(0.1, HULL_R * 1.5, HULL_R * 1.9, _hullFrame);
    vane.position.set(tailX - 0.1 - i * 0.55, HULL_R * 1.7, 0);
    g.add(vane);
  }
  // horizontal heat-fin stack on the camera-facing (+Z) flank of the housing
  for (let i = 0; i < 4; i++) {
    const fin = _box(1.5, 0.09, 0.55, _hullFrame);
    fin.position.set(tailX - 0.55, -HULL_R * 0.9 + i * (HULL_R * 0.62), HULL_R * 1.35);
    g.add(fin);
  }
  // fuel manifold pipes feeding the housing from the spine
  for (const [py, pz] of [[HULL_R * 0.7, HULL_R * 0.55], [-HULL_R * 0.6, -HULL_R * 0.45]] as const) {
    const manifold = _cyl(0.12, 0.12, 2.0, 8, _hullFrame);
    manifold.rotation.z = Math.PI / 2;
    manifold.position.set(tailX + 1.0, py, pz);
    g.add(manifold);
  }

  // 3.b FOUR big flared NOZZLES protruding AFT from the housing's rear face (mouths at
  //     ~tailX − 2.6 → well past the tail). Each: a flared lathe skirt (throat → big
  //     mouth) pointing −X, a charred combustion throat, a mouth ring, an EMISSIVE
  //     ember disc deep inside, + a turbopump greeble. A dominant central main + 3
  //     flanking, clustered so the iconic engine-bay silhouette reads from the broadside.
  const aftFace = tailX - 1.5;     // the housing rear face (nozzle throats start here)
  const bells: ReadonlyArray<[number, number, boolean]> = [
    [0.0, 0.0, true],                              // central main (biggest), on-axis
    [HULL_R * 1.05, HULL_R * 0.55, false],         // upper-near (+Z → reads)
    [-HULL_R * 0.95, HULL_R * 0.7, false],         // lower-near
    [HULL_R * 0.4, -HULL_R * 0.85, false],         // upper-far (depth)
  ];
  for (const [by, bz, big] of bells) {
    const mouthR = big ? 1.15 : 0.72;
    const throatR = mouthR * 0.28;
    const bellLen = big ? 2.3 : 1.7;               // long skirts → the flared cone reads in profile
    const throatX = aftFace;                       // forward (combustion) end at the housing face
    const mouthX = aftFace - bellLen;              // mouth flares aft past the tail
    const nzProf: THREE.Vector2[] = [];
    const ns = 10;
    for (let k = 0; k <= ns; k++) {
      const t = k / ns;
      const r = throatR + (mouthR - throatR) * Math.pow(t, 1.85);   // tight throat → exp flare
      nzProf.push(new THREE.Vector2(Math.max(0.04, r), t * bellLen));
    }
    const bell = _lathe(nzProf, SEG, _engineBell);
    bell.rotation.z = -Math.PI / 2;     // lathe profile (throat→mouth) runs toward −X (aft)
    bell.position.set(throatX, by, bz);
    g.add(bell);
    // charred throat plug at the combustion end
    const throat = _sphere(throatR * 1.6, _engineChar, 10, 6);
    throat.scale.x = 0.6;
    throat.position.set(throatX + 0.1, by, bz);
    g.add(throat);
    // EMISSIVE ember disc deep in the bell (the hot idle — pre-stages the failure)
    const ember = _cyl(mouthR * 0.5, throatR * 1.1, 0.06, SEG, _engineEmber);
    ember.rotation.z = Math.PI / 2;
    ember.position.set(throatX - bellLen * 0.45, by, bz);
    g.add(ember);
    // mouth ring (the nozzle rim)
    const rim = _cyl(mouthR + 0.06, mouthR + 0.06, 0.16, SEG, _hullFrame, true);
    rim.rotation.z = Math.PI / 2;
    rim.position.set(mouthX, by, bz);
    g.add(rim);
    // turbopump greeble above the throat
    const pump = _box(0.5, 0.5, 0.5, _hullFrame);
    pump.position.set(throatX + 0.25, by + throatR + 0.35, bz + throatR);
    g.add(pump);
  }
}

// ── 4. NAV / RUNNING lights — emissive red(port)/green(stbd)/amber(strobe) markers at
//    the silhouette extremities (nose, dorsal, tail, mid) so the dead ship still has
//    points of life against the void.
function buildNavLights(g: THREE.Group, noseX: number, tailX: number, midX: number): void {
  const lights: ReadonlyArray<[number, number, number, THREE.Material]> = [
    [noseX + 0.5, HULL_R * 0.0, HULL_R * 0.85, _navGreen],   // nose stbd green (+Z, camera-near)
    [noseX + 0.5, HULL_R * 0.0, -HULL_R * 0.85, _navRed],    // nose port red (far)
    [noseX - 1.0, HULL_R * 1.7, 0.3, _navAmber],             // bridge-roof amber beacon
    [midX - HULL_LEN * 0.2, HULL_R * 1.0, HULL_R * 0.85, _navGreen], // mid stbd marker
    [midX + HULL_LEN * 0.15, HULL_R * 1.3, 0, _navAmber],    // dorsal amber strobe
    [tailX + 0.2, HULL_R * 1.4, HULL_R * 0.9, _navRed],      // tail amber/red marker
  ];
  for (const [lx, ly, lz, mat] of lights) {
    const lamp = _sphere(0.11, mat, 8, 6);
    lamp.position.set(lx, ly, lz);
    g.add(lamp);
    const housing = _cyl(0.14, 0.14, 0.09, 8, _hullFrame);
    housing.position.set(lx, ly, lz - 0.06);
    housing.rotation.x = Math.PI / 2;
    g.add(housing);
  }
}

// ── 5. STARFIELD backdrop — a big depth-writing plane BEHIND the hauler (the proven
//    descent-vista approach; a giant enclosing sphere lost to the game's far sky dome).
const STAR_VS = /* glsl */ `
  varying vec2 vUv;
  void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const STAR_FS = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  float hash(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
  float vn(vec2 x){ vec2 p=floor(x), f=fract(x); f=f*f*(3.0-2.0*f);
    return mix(mix(hash(p),hash(p+vec2(1,0)),f.x), mix(hash(p+vec2(0,1)),hash(p+vec2(1,1)),f.x), f.y); }
  vec3 starLayer(vec2 uv, float freq, float seed, float thresh){
    vec2 gp = uv*freq + seed;
    vec2 cell = floor(gp), f = fract(gp);
    float h = hash(cell+seed);
    if (h <= thresh) return vec3(0.0);
    vec2 sp = vec2(hash(cell+seed+1.3), hash(cell+seed+7.7));
    float d = length(f - sp);
    float bright = pow(hash(cell+seed+3.1), 2.4);
    float core = smoothstep(0.09, 0.0, d) * (0.45 + 2.0*bright);
    float glow = smoothstep(0.32, 0.0, d) * 0.15 * bright;
    float ct = hash(cell+seed+9.2);
    vec3 tint = mix(vec3(0.74,0.82,1.0), vec3(1.0,0.90,0.78), ct);
    tint = mix(vec3(0.92,0.94,1.0), tint, smoothstep(0.30,0.85,abs(ct-0.5)*2.0));
    return tint * (core + glow);
  }
  void main(){
    vec2 uv = vUv;
    vec3 sky = mix(vec3(0.010,0.015,0.030), vec3(0.004,0.007,0.016), uv.y);
    sky += vec3(0.020,0.026,0.036) * smoothstep(0.32, 0.0, uv.y);   // faint cool planet-glow low
    float band = exp(-pow((uv.x*0.7 + uv.y*0.7 - 0.7)*3.4, 2.0));
    sky += vec3(0.012,0.016,0.026) * band * (0.5 + 0.5*vn(uv*vec2(7.0,3.0)+4.0));
    vec3 stars = vec3(0.0);
    stars += starLayer(uv, 220.0, 0.0,  0.60) * 1.1;
    stars += starLayer(uv, 130.0, 31.0, 0.72) * 1.2;
    stars += starLayer(uv, 76.0,  61.0, 0.86) * 1.5;
    gl_FragColor = vec4(sky + stars, 1.0);
  }
`;

function buildStarfield(): THREE.Mesh {
  starGeo = new THREE.PlaneGeometry(1400, 1400);
  starMat = new THREE.ShaderMaterial({
    vertexShader: STAR_VS, fragmentShader: STAR_FS,
    side: THREE.DoubleSide, depthWrite: true, fog: false, toneMapped: true,
    uniforms: {},
  });
  return new THREE.Mesh(starGeo, starMat);
}

/** Build + place the HERO cargo hauler in front of the pod (−Z), against a star
 *  backdrop, framed through the porthole. Idempotent (no-op if already built). */
export function buildHaulerExterior(ctx: GameContext): void {
  if (haulerGroup) return;
  const root = new THREE.Group();
  root.name = 'escapePodHauler';   // findable by the rig framer (visual-diagnostic-methodology)
  root.position.copy(HAULER_POS);
  root.rotation.set(HAULER_PITCH, HAULER_YAW, HAULER_ROLL);

  // Built nose-at-+X; centre the assembly on its span so HAULER_POS is the ship's mid.
  const ship = new THREE.Group();
  const midX = 0;
  const noseX = HULL_LEN / 2;
  const tailX = -HULL_LEN / 2;
  buildCargoSpine(ship, midX);
  buildCockpit(ship, noseX);
  buildEngineCluster(ship, tailX);
  buildNavLights(ship, noseX, tailX, midX);
  const spanMid = ((tailX - ENGINE_LEN) + (noseX + COCKPIT_LEN)) / 2;
  ship.position.x = -spanMid;
  root.add(ship);

  // Starfield backdrop — a big plane far behind the hauler, centred on its X/Y (so
  // off-axis framing angles stay backed by void), in WORLD space (scene-level).
  starMesh = buildStarfield();
  starMesh.position.set(HAULER_POS.x, HAULER_POS.y, POD_ORIGIN.z - (HAULER_DIST + 90));
  ctx.three.scene.add(starMesh);

  // ── HERO LIGHTING. No terrain sun reaches the offset → the ship carries its own rig
  //    (front-light prerequisite + the gate's "pop it off the stars" note). A warm KEY
  //    from the camera side, a soft front-FILL so no flank goes dead-black, a cool
  //    HEMISPHERE fill, and a strong cool back-RIM that edges the silhouette off the
  //    starfield (the single biggest hero cue through the porthole).
  const key = new THREE.DirectionalLight(0xfff0e0, 2.5);   // cooler, less amber (the hull read brown)
  key.position.copy(HAULER_POS).add(new THREE.Vector3(7, 8, 20));
  key.target.position.copy(HAULER_POS);
  ctx.three.scene.add(key); ctx.three.scene.add(key.target); _heroLights.push(key);
  const front = new THREE.DirectionalLight(0xdfe6ee, 1.0);
  front.position.copy(HAULER_POS).add(new THREE.Vector3(-3, 2, 22));
  front.target.position.copy(HAULER_POS);
  ctx.three.scene.add(front); ctx.three.scene.add(front.target); _heroLights.push(front);
  const fill = new THREE.HemisphereLight(0xaac0d8, 0x2a2018, 1.05);   // cooler + brighter sky fill (cools the brown)
  fill.position.copy(HAULER_POS);
  ctx.three.scene.add(fill); _heroLights.push(fill);
  // Cool back-RIM — from BEHIND/above the ship (−Z, away from the camera) so the top +
  // far edges catch a cool light line that separates the hull from the black void.
  const rim = new THREE.DirectionalLight(0x9cc0f0, 1.8);
  rim.position.copy(HAULER_POS).add(new THREE.Vector3(-6, 9, -22));
  rim.target.position.copy(HAULER_POS);
  ctx.three.scene.add(rim); ctx.three.scene.add(rim.target); _heroLights.push(rim);
  // A warm POINT light at the cockpit (the lit bridge spills onto the nearby hull). Tight
  // range so it warms ONLY the cockpit zone (a wide warm lamp browned the whole hull).
  const cockpitLamp = new THREE.PointLight(0xffb060, 1.2, 5.5, 2.6);
  cockpitLamp.position.copy(HAULER_POS).add(
    new THREE.Vector3(Math.cos(HAULER_YAW) * 6.5, 1.6, -Math.sin(HAULER_YAW) * 6.5 + 1.5));
  ctx.three.scene.add(cockpitLamp); _heroLights.push(cockpitLamp);

  root.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = false; o.receiveShadow = false; } });
  ctx.three.scene.add(root);
  haulerGroup = root;
}

/** Full teardown — remove the hauler group + hero lights + the star plane, dispose
 *  per-build geometry + the star material. Null-guarded (safe if not built). */
export function disposeHaulerExterior(ctx: GameContext): void {
  if (haulerGroup) { ctx.three.scene.remove(haulerGroup); haulerGroup = null; }
  for (const light of _heroLights) {
    ctx.three.scene.remove(light);
    if ((light as THREE.DirectionalLight).target) ctx.three.scene.remove((light as THREE.DirectionalLight).target);
  }
  _heroLights.length = 0;
  if (starMesh) { ctx.three.scene.remove(starMesh); starMesh = null; }
  if (starMat) { starMat.dispose(); starMat = null; }
  if (starGeo) { starGeo.dispose(); starGeo = null; }
  for (const g of _disposables) g.dispose();
  _disposables.length = 0;
  // Module-shared hull materials are NOT disposed (reused on the next placement).
}
