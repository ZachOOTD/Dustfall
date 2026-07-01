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

// ── T3.2 — THE SHIP EXPLOSION. The whole hauler group is `ship` (parented under the
//    yawed `root`). The intact ship is kept as ONE object so the blast can hide it and
//    swap in a debris field of tumbling chunks. Refs captured at build; driven by
//    setHaulerExplosion(t) (0=intact → 1=receding husk), disposed with the hauler.
let shipGroup: THREE.Group | null = null;   // the intact hero ship (hidden as it breaks apart)
let fireballMat: THREE.ShaderMaterial | null = null;   // the blooming additive fireball
let fireballMesh: THREE.Mesh | null = null;
let shockMat: THREE.ShaderMaterial | null = null;      // the expanding shockwave ring
let shockMesh: THREE.Mesh | null = null;
let flashMat: THREE.ShaderMaterial | null = null;      // the white-hot core flash (first frames)
let flashMesh: THREE.Mesh | null = null;
let sparkPoints: THREE.Points | null = null;           // ember/spark cloud flung outward
let sparkMat: THREE.PointsMaterial | null = null;
let sparkGeo: THREE.BufferGeometry | null = null;
let blastLight: THREE.PointLight | null = null;        // the explosion's own light (lights the debris)
// The tumbling debris chunks: each carries a local origin (relative to the ship centre),
// a linear velocity (m/s outward), and an angular velocity (rad/s) so the blast flings +
// spins them. Local-frame so the yawed `root` transform carries them into the porthole view.
interface DebrisChunk { mesh: THREE.Mesh; origin: THREE.Vector3; vel: THREE.Vector3; spin: THREE.Vector3; }
let debris: DebrisChunk[] = [];
let debrisGroup: THREE.Group | null = null;
let _explodeT0 = 0;      // performance.now()/1000 at build (fireball shader animation clock)
// Cached spark ORIGINS (the position attr is overwritten each frame with the advected point,
// so the base launch positions live here — indexed x,y,z per spark). Filled in buildExplosionFx.
let _sparkOrigin = new Float32Array(0);

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

// ─── T3.2 — THE SHIP EXPLOSION FX ─────────────────────────────────────────────
// The hauler dies through the porthole: a white-hot core FLASH, a blooming billowing
// FIREBALL, the hull BREAKING into tumbling debris, a SHOCKWAVE ring, sparks/embers,
// and the blast LIGHT flooding the scene — settling into a receding burning husk.
// Driven by setHaulerExplosion(t) (0=intact → 1=husk). The visuals are additive
// camera-facing billboards (fireball/flash/shock) + real debris meshes + a point cloud;
// all toneMapped:false so the white-hot core survives the Reinhard curve.
const EXPLODE_VS = /* glsl */ `
  varying vec2 vUv;
  void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
// FIREBALL — a churning, billowing ball of fire that blooms out then cools + dissipates.
// uT (0..1) is the beat progress; uGrow (0..1) drives the visual radius reached in the shader
// (the mesh itself is fixed-size + big; the shader grows the lit disc inside it), uTime animates.
const FIREBALL_FS = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uT;      // 0..1 beat progress (drives bloom→cool)
  uniform float uGrow;   // 0..1 the fireball's current radius fraction of the billboard
  uniform float uTime;   // seconds (churn animation)
  uniform float uFade;   // 1 through the blast → 0 as the husk dissipates to clear space (late-beat)
  float hash(vec2 p){ p = fract(p*vec2(127.1,311.7)); p += dot(p, p+34.5); return fract(p.x*p.y); }
  float vn(vec2 x){ vec2 p=floor(x), f=fract(x); f=f*f*(3.0-2.0*f);
    return mix(mix(hash(p),hash(p+vec2(1,0)),f.x), mix(hash(p+vec2(0,1)),hash(p+vec2(1,1)),f.x), f.y); }
  float fbm(vec2 p){ float a=0.55, s=0.0; for(int i=0;i<5;i++){ s+=a*vn(p); p=p*2.03+1.7; a*=0.5; } return s; }
  void main(){
    if (uT <= 0.001 || uGrow <= 0.001) discard;
    vec2 p = (vUv - 0.5) * 2.0;              // -1..1
    float r = length(p);
    float ang = atan(p.y, p.x);
    // Churn coordinate — the flame billows OUTWARD (mushroom/roil), scrolling. Sampled in a mix of
    //   CARTESIAN (p) + polar so it isn't ruled radial streaks (round-3: pure angular sampling read
    //   as regular rays). The cartesian octave breaks the radial banding into turbulent cells.
    float roil = fbm(p*2.6 + vec2(uTime*0.4, -uTime*0.7));
    float roil2 = fbm(vec2(ang*3.1 - uTime*0.8, r*4.2 - uTime*1.9) + roil*1.3);
    float lump = roil*0.6 + roil2*0.5;
    // The fireball edge: a bloomed radius (uGrow) with a lumpy, turbulent boundary (not a smooth
    // disc). SOLID inside — a FILLED churning ball, densest at the core, feathering into billowing
    // tongues at the rim (NOT a hollow ring: the whole interior within the warped edge is opaque fire).
    float edge = uGrow * (0.80 + 0.42*lump);
    float ball = smoothstep(edge, edge - 0.40, r);       // 1 across the whole interior → 0 past the tongues
    // Discard well OUTSIDE both the fire body AND the smoke-billow shell (which balloons to edge+1.05).
    if (r > edge + 1.08) discard;
    // The WHOLE fireball cools as uT climbs (bloom hottest early; late = a smoky red husk-glow). A
    //   small FLOOR keeps a dull-red ember glow at the tail so the husk reads as burning wreckage,
    //   not empty space (round-3: the husk went fully dark → an empty window).
    float coolAll = mix(0.14, 1.0, 1.0 - smoothstep(0.20, 0.82, uT));   // 1 early (hot) → 0.14 late (dull ember floor)
    // CORE-WEIGHTED heat: hottest dead-centre → cooling toward the rim, roiled by the churn. coreHot
    //   fills the middle so the ball reads SOLID, but the white-hot ZONE is kept TIGHT (a hot POINT-ish
    //   heart) so most of the ball is churning orange/yellow, not a flat white blob (FX-polish fix).
    float coreHot = 1.0 - smoothstep(0.0, edge, r);      // 1 dead-centre → 0 at the edge
    // A separate, MUCH tighter incandescent-core mask: only the innermost ~12% goes white, feathered
    //   by the churn so the hot heart isn't a clean disc. (Was smoothstep(0.74,1.0)^2.2 → ~26% blob.)
    float whiteMask = pow(smoothstep(0.86, 1.0, coreHot), 3.2);
    float whiteCore = whiteMask;
    float heat = ball * (0.42 + 0.92*coreHot) * (0.62 + 0.72*lump);
    heat *= (0.45 + 0.85*coolAll);
    vec3 cDark  = vec3(0.34, 0.06, 0.01);
    vec3 cRed   = vec3(1.20, 0.18, 0.03);
    vec3 cOrange= vec3(1.85, 0.60, 0.09);
    vec3 cYellow= vec3(2.20, 1.30, 0.42);
    vec3 cWhite = vec3(2.7, 2.5, 2.2);
    vec3 col = mix(cDark, cRed, smoothstep(0.04, 0.30, heat));
    col = mix(col, cOrange, smoothstep(0.26, 0.78, heat));
    col = mix(col, cYellow, smoothstep(0.80, 1.35, heat));
    col = mix(col, cWhite,  whiteCore * (0.5 + 0.5*lump) * coolAll);   // white ONLY in the tight hot heart (churn-broken)
    // SMOKY dark lumps within the roil (unburnt debris/smoke rolling through the fireball) — STRONG
    //   dark lanes so the body reads as CHURNING billows with internal contrast, not a uniform disc.
    //   Widened band + more depth so more of the ball reads as smoke-shot churn (FX-polish).
    float smoke = smoothstep(0.38, 0.88, roil2) * (0.75 + 0.25*(1.0-coolAll));
    col *= (1.0 - 0.80*smoke);   // strong dark churn lanes cutting through the fire body
    // SMOKY BILLOW HALO — a brown-grey emissive cloud ballooning JUST BEYOND the fire edge (and
    //   into the smoke lanes), so the blast reads as PRODUCING SMOKE against the void — additive
    //   blending can't paint dark over black, so the smoke must self-glow faintly to show. It's a
    //   ragged, lumpy shell (churn-warped) that thins outward; a dissipating dark cloud, not light.
    //   A DEEP + LUMPY shell (reaches edge+0.95) so it reads as real billowing mass, not a thin rim.
    float smokeShell = smoothstep(edge + 0.10, edge + 0.46, r) * (1.0 - smoothstep(edge + 0.52, edge + 1.05, r));
    // A big low-freq roll on top so the smoke clumps into a few fat billows (mushroom lobes) rather
    //   than an even fringe — sampled off a coarser churn so the lobes are chunky.
    float smokeRoll = fbm(p*1.5 + vec2(-uTime*0.25, uTime*0.35));
    float billow = smokeShell * (0.30 + 0.95*lump) * pow(0.28 + 0.72*smokeRoll, 1.9);   // chunky fat lobes (high lump contrast → billows, not an even halo)
    vec3 cSmoke = vec3(0.26, 0.17, 0.12);   // warm-grey smoke — dull enough to read dark vs fire, bright enough to show vs the void
    // EMISSION — kept MODEST so the fire's colour GRADIENT reads (toneMapped:false means the
    //   output clips to white above 1.0 — a big additive value blows the whole disc to a white
    //   blob). Only the tight hot CORE exceeds 1 (white-hot); the orange/red/yellow body is HELD
    //   below clip so its hue shows (the mid-body no longer blooms to white). The lump/churn roils it.
    float bodyEm = ball * (0.20 + 0.30*heat) * (0.45 + 0.75*coolAll) * (0.55 + 0.75*lump) * (1.0 - 0.62*smoke);
    bodyEm = min(bodyEm, 0.60);                // CAP the body emission so yellow/orange never clip to white
    float coreEm = whiteCore * (0.8 + 0.6*lump) * coolAll * 1.6;   // the tight heart is allowed to blow hot
    float em = bodyEm + coreEm;
    // Composite the fire body (col*em) with the dim smoke billow. The billow is a faint self-glow so
    //   it shows against the void, but its own dark lanes (via smoke) keep it reading as CLOUD not fire.
    //   It rises as uT climbs (the blast dies down → smoke takes over the outer read).
    float smokeUp = 1.30 + 0.60*smoothstep(0.12, 0.55, uT);   // smoke reads strong from the peak onward
    vec3 outCol = col * em + cSmoke * billow * smokeUp * (0.85 + 0.45*(1.0-coolAll));
    // ALPHA — the fireball is a translucent-but-dense body over the aperture (additive blending,
    //   so alpha only feathers the edges; the brightness comes from em). Near-full inside, soft rim.
    //   The smoke billow adds its own soft edge presence so the outer smoke feathers the silhouette.
    float a = clamp(ball * (0.40 + 0.55*coreHot) * (0.5 + 0.6*coolAll)
                    + billow * smokeUp * 0.5, 0.0, 0.9);
    // HUSK DISSIPATION (coherence pass): the fireball's dull-red ember floor + its expanding radius
    //   left a FLAT BROWN WASH filling the whole porthole at the husk beat, instead of clearing to
    //   black star-space. uFade drives BOTH the colour and the alpha to ~0 across the late beat so
    //   the cloud genuinely thins away — the window opens back onto the void + stars + the small
    //   receding debris (not an ugly brown fill). Alpha fades faster than emission so the last of it
    //   reads as a few faint dwindling embers, not a solid pane.
    outCol *= uFade;
    a *= uFade * uFade;
    if (em*uFade < 0.008 && billow*uFade < 0.01 && a < 0.02) discard;
    gl_FragColor = vec4(outCol, a);
  }
`;
// FLASH — the initial blinding white-hot detonation core (a bright soft disc, only in the
// first fraction of the beat). uFl (0..1) = its intensity envelope.
const FLASH_FS = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uFl;    // 0..1 flash envelope
  void main(){
    if (uFl <= 0.001) discard;
    vec2 p = (vUv - 0.5) * 2.0;
    float r = length(p);
    float core = smoothstep(0.55, 0.0, r);            // soft round core
    float halo = smoothstep(1.0, 0.0, r) * 0.5;       // a wide bloom halo
    float a = (core + halo) * uFl;
    if (a < 0.01) discard;
    vec3 white = vec3(3.0, 2.9, 2.7);                 // blinding white, faint warm
    gl_FragColor = vec4(white * a, clamp(a, 0.0, 0.95));
  }
`;
// SHOCKWAVE — a thin expanding bright RING (uRing 0..1 = its current radius; uFade = opacity).
const SHOCK_FS = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uRing;   // 0..1 ring radius fraction
  uniform float uFade;   // 0..1 opacity
  void main(){
    if (uFade <= 0.001) discard;
    vec2 p = (vUv - 0.5) * 2.0;
    float r = length(p);
    float ring = smoothstep(0.06, 0.0, abs(r - uRing));   // a thin bright annulus at radius uRing
    float lead = smoothstep(0.0, 0.14, uRing - r) * step(r, uRing) * 0.25;  // faint inner wake
    float a = (ring + lead) * uFade;
    if (a < 0.01) discard;
    // hot leading edge → warm falloff
    vec3 col = mix(vec3(2.2,1.5,0.7), vec3(1.5,0.6,0.15), smoothstep(0.0,0.08,abs(r-uRing)));
    gl_FragColor = vec4(col * a, clamp(a, 0.0, 0.9));
  }
`;

/** Build the explosion FX (fireball / flash / shockwave billboards + a debris field + a
 *  spark cloud + the blast light) into `root`, centred on the ship centre (local origin).
 *  All start invisible/at t=0; setHaulerExplosion drives them. `ship` is the intact hero
 *  ship group (kept so the blast can hide it as the debris takes over). */
function buildExplosionFx(root: THREE.Group, ship: THREE.Group): void {
  _explodeT0 = performance.now() / 1000;
  shipGroup = ship;

  // ── FIREBALL billboard — a big camera-facing plane at the ship centre. Sized to
  //    engulf the whole hull span when bloomed. Additive; the shader grows the lit disc.
  const fbGeo = new THREE.PlaneGeometry(46, 46);
  _disposables.push(fbGeo);
  fireballMat = new THREE.ShaderMaterial({
    vertexShader: EXPLODE_VS, fragmentShader: FIREBALL_FS,
    uniforms: { uT: { value: 0 }, uGrow: { value: 0 }, uTime: { value: 0 }, uFade: { value: 1 } },
    // depthTest ON so the OPAQUE cabin wall/bezel occludes the fireball to the round porthole
    //   aperture (the re-entry-plasma pattern — the fire reads THROUGH the window, never on the
    //   cabin interior). The fireball is out in space at z≈−24; the cabin is in front at z≈−1.2.
    transparent: true, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    depthWrite: false, depthTest: true, toneMapped: false,
  });
  fireballMesh = new THREE.Mesh(fbGeo, fireballMat);
  fireballMesh.renderOrder = 20;
  fireballMesh.frustumCulled = false;
  fireballMesh.visible = false;
  root.add(fireballMesh);

  // ── FLASH billboard — a smaller bright core, in FRONT of the fireball (renderOrder up).
  const flGeo = new THREE.PlaneGeometry(30, 30);
  _disposables.push(flGeo);
  flashMat = new THREE.ShaderMaterial({
    vertexShader: EXPLODE_VS, fragmentShader: FLASH_FS,
    uniforms: { uFl: { value: 0 } },
    transparent: true, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    depthWrite: false, depthTest: true, toneMapped: false,   // clipped to the porthole aperture (see fireball)
  });
  flashMesh = new THREE.Mesh(flGeo, flashMat);
  flashMesh.renderOrder = 22;
  flashMesh.frustumCulled = false;
  flashMesh.visible = false;
  root.add(flashMesh);

  // ── SHOCKWAVE ring — a big flat billboard (bigger than the fireball so the ring can
  //    expand past the wreck). Behind the fireball so the fire reads over it.
  const swGeo = new THREE.PlaneGeometry(70, 70);
  _disposables.push(swGeo);
  shockMat = new THREE.ShaderMaterial({
    vertexShader: EXPLODE_VS, fragmentShader: SHOCK_FS,
    uniforms: { uRing: { value: 0 }, uFade: { value: 0 } },
    transparent: true, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    depthWrite: false, depthTest: true, toneMapped: false,   // clipped to the porthole aperture (see fireball)
  });
  shockMesh = new THREE.Mesh(swGeo, shockMat);
  shockMesh.renderOrder = 18;
  shockMesh.frustumCulled = false;
  shockMesh.visible = false;
  root.add(shockMesh);

  // ── DEBRIS FIELD — real chunks of hull/cargo/engine that break off + tumble outward.
  //    A separate group parented to root (so the yaw carries it into view). Each chunk is
  //    a chunky primitive using the hauler's own materials, given an outward velocity from
  //    the ship centre + a random spin. Deterministic (a fixed pseudo-random from an index)
  //    so the seed budget is fixed (procgen seed-stability).
  debrisGroup = new THREE.Group();
  debrisGroup.visible = false;
  root.add(debrisGroup);
  debris = [];
  // a small deterministic RNG (index-seeded) — no external seed budget consumed.
  const rand = (n: number, salt: number) => {
    const s = Math.sin(n * 127.1 + salt * 311.7) * 43758.5453;
    return s - Math.floor(s);
  };
  const chunkMats = [_hullSkinReal, _hullSteel, _container, _container2, _hullFrame, _engineBell, _tank];
  const N = 38;   // enough that a good spread stays in the porthole through the husk beat
  for (let i = 0; i < N; i++) {
    // seed the chunk's origin somewhere along the hull span (−X tail ↔ +X nose), biased
    // toward the ENGINE tail (where the failure ignites → more debris blows off the rear).
    const along = -HULL_LEN * 0.6 + rand(i, 1) * HULL_LEN * 1.3;   // ship-local X, engine-heavy
    const oy = (rand(i, 2) - 0.5) * HULL_R * 2.4;
    const oz = (rand(i, 3) - 0.5) * HULL_R * 2.2;
    const origin = new THREE.Vector3(along, oy, oz);
    // chunk geometry: mostly chunky torn plate boxes, some cylindrical (pipe/tank/bell shard).
    const kind = rand(i, 4);
    let mesh: THREE.Mesh;
    const mat = chunkMats[Math.floor(rand(i, 9) * chunkMats.length) % chunkMats.length];
    if (kind < 0.62) {
      const w = 0.5 + rand(i, 5) * 1.7, h = 0.35 + rand(i, 6) * 1.1, d = 0.3 + rand(i, 7) * 0.9;
      mesh = _box(w, h, d, mat);
    } else if (kind < 0.85) {
      const r = 0.22 + rand(i, 5) * 0.5, len = 0.8 + rand(i, 6) * 2.2;
      mesh = _cyl(r, r * (0.5 + rand(i, 8) * 0.6), len, 8, mat);
      mesh.rotation.z = Math.PI / 2;
    } else {
      // a flared shard (broken engine-bell / cone lump)
      const r = 0.35 + rand(i, 5) * 0.7;
      mesh = _sphere(r, mat, 8, 5);
      mesh.scale.set(1, 0.5 + rand(i, 6) * 0.6, 0.7 + rand(i, 7) * 0.5);
    }
    mesh.position.copy(origin);
    debrisGroup.add(mesh);
    // velocity: radially outward from the ship centre (so it flies apart), + a bias AFT
    //   (−X, the engine blew) + a little up. Speed varies; the biggest chunks move slower.
    // slower dispersal so a good spread of chunks stays framed through the husk beat (round-3: the
    //   debris had flown out of the aperture by the husk, leaving it near-empty).
    const outward = origin.clone().normalize();
    const speed = 1.6 + rand(i, 10) * 4.2;
    const vel = outward.multiplyScalar(speed);
    vel.x -= 1.0 + rand(i, 11) * 1.6;                 // aft bias (the tail's engine detonated)
    vel.y += (rand(i, 12) - 0.35) * 2.2;
    vel.z += (rand(i, 13) - 0.5) * 1.8;
    const spin = new THREE.Vector3(
      (rand(i, 14) - 0.5) * 6.0, (rand(i, 15) - 0.5) * 6.0, (rand(i, 16) - 0.5) * 6.0);
    debris.push({ mesh, origin, vel, spin });
  }

  // ── SPARK / EMBER cloud — a Points cloud of hot embers flung out with the debris,
  //    fading + slowing. Positions animated in setHaulerExplosion off their velocities.
  const SN = 220;
  sparkGeo = new THREE.BufferGeometry();
  const sPos = new Float32Array(SN * 3);
  const sVel = new Float32Array(SN * 3);
  _sparkOrigin = new Float32Array(SN * 3);
  for (let i = 0; i < SN; i++) {
    const along = -HULL_LEN * 0.55 + rand(i, 21) * HULL_LEN * 1.2;
    const oy = (rand(i, 22) - 0.5) * HULL_R * 1.6;
    const oz = (rand(i, 23) - 0.5) * HULL_R * 1.6;
    sPos[i * 3] = along; sPos[i * 3 + 1] = oy; sPos[i * 3 + 2] = oz;
    _sparkOrigin[i * 3] = along; _sparkOrigin[i * 3 + 1] = oy; _sparkOrigin[i * 3 + 2] = oz;
    const dir = new THREE.Vector3(along, oy, oz).normalize();
    const sp = 5 + rand(i, 24) * 16;
    sVel[i * 3] = dir.x * sp - 2 - rand(i, 25) * 4;   // aft bias
    sVel[i * 3 + 1] = dir.y * sp + (rand(i, 26) - 0.4) * 8;
    sVel[i * 3 + 2] = dir.z * sp + (rand(i, 27) - 0.5) * 8;
  }
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
  sparkGeo.setAttribute('velocity', new THREE.BufferAttribute(sVel, 3));
  sparkMat = new THREE.PointsMaterial({
    color: 0xffcaa0, size: 0.22, sizeAttenuation: true,
    transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
  });
  sparkPoints = new THREE.Points(sparkGeo, sparkMat);
  sparkPoints.renderOrder = 19;
  sparkPoints.frustumCulled = false;
  sparkPoints.visible = false;
  root.add(sparkPoints);

  // ── BLAST LIGHT — the explosion's own point light (lights the tumbling debris + spills
  //    on the nearby hull). Parented to `root` at the ship centre (local origin) so it
  //    rides with the group + reaches the debris (also root's children). Intensity driven.
  blastLight = new THREE.PointLight(0xff8a3a, 0, 90, 1.6);
  blastLight.position.set(0, 0, 0);
  root.add(blastLight);
}

/** Drive the ship explosion. `t` in [0,1]: 0 = intact ship, ~0.05 = the white-hot core
 *  flash, ~0.1–0.4 = the blooming fireball + hull breakup + shockwave, → 1 = a receding
 *  burning husk + drifting debris field. The pod cabin flash is driven SEPARATELY by the
 *  beat (setTumbleLight) so it stays in sequence.ts. Safe no-op if not built. */
export function setHaulerExplosion(t: number): void {
  const p = Math.max(0, Math.min(1, t));
  const now = performance.now() / 1000;
  const anim = now - _explodeT0;

  // ── INTACT SHIP visibility — the ship reads whole until the detonation, then it's
  //    consumed: hide it once the fireball has bloomed enough to engulf it (the debris
  //    field + fireball carry the read from there).
  if (shipGroup) shipGroup.visible = p < 0.14;

  // ── FLASH — a sharp blinding core in the first ~0.12 of the beat (detonation), rising
  //    fast then decaying. Envelope peaks ~p0.04.
  if (flashMesh && flashMat) {
    const fl = p < 0.14 ? Math.max(0, 1 - Math.abs(p - 0.04) / 0.10) : 0;
    flashMat.uniforms.uFl.value = fl;
    flashMesh.visible = fl > 0.001;
  }

  // ── FIREBALL — blooms open from p≈0.03, reaches its (capped) peak radius by ~p0.28, then
  //    cools + slowly shrinks to a dim husk-glow by p1. uGrow drives the lit-disc radius; the
  //    peak is CAPPED below the aperture-filling size so the ship + stars still read AROUND the
  //    ball (a fireball engulfing the ship, not a white-out that fills the whole window).
  if (fireballMesh && fireballMat) {
    const PEAK = 0.62;   // max grow — leaves a margin of space/debris/ship visible around the ball
    const bloom = Math.min(1, p / 0.3);
    // bloom to the cap by p0.3, then EXPAND-and-thin into a broad dull ember/smoke cloud (the husk
    //   dissipating outward, NOT shrinking to a point — round-3: the shrunk husk read as an empty
    //   radial burst). uT cools it to dull red + the emission drops, so it's a big faint smoky glow.
    const grow = p < 0.3 ? PEAK * bloom * bloom * (3 - 2 * bloom)   // smoothstep bloom to the cap
      : PEAK * (1 + (p - 0.3) / 0.7 * 0.35);                        // grow slightly + thin (dissipating cloud)
    fireballMat.uniforms.uGrow.value = p > 0.02 ? grow : 0;
    fireballMat.uniforms.uT.value = p;
    fireballMat.uniforms.uTime.value = anim;
    // HUSK DISSIPATION (coherence pass): fade the whole fireball out across the LATE beat so the
    //   husk frame clears to black star-space + the small receding debris, instead of leaving a
    //   flat brown ember wash filling the porthole. Full presence until p≈0.55, then ease to ~0 by
    //   p≈0.9 (the debris field + drifting sparks carry the "burning wreckage" read from there).
    const fade = 1 - Math.max(0, Math.min(1, (p - 0.55) / 0.35));
    fireballMat.uniforms.uFade.value = fade * fade;   // eased (quadratic) so it lingers a touch then clears
    fireballMesh.visible = p > 0.02 && fade > 0.02;
  }

  // ── SHOCKWAVE — a single expanding ring launched at detonation (p≈0.05), racing out +
  //    fading; gone by ~p0.45.
  if (shockMesh && shockMat) {
    const sw = Math.max(0, (p - 0.04) / 0.40);       // 0 at p0.04 → 1 at p0.44
    if (sw > 0 && sw < 1) {
      shockMat.uniforms.uRing.value = 0.08 + sw * 0.92;
      shockMat.uniforms.uFade.value = (1 - sw) * 0.9;
      shockMesh.visible = true;
    } else {
      shockMesh.visible = false;
    }
  }

  // ── DEBRIS — the chunks fly apart + tumble from detonation (p≈0.08). Position = origin +
  //    vel·τ where τ is the seconds of flight since breakup (mapped off the beat progress).
  //    They keep drifting for the whole beat + spin continuously.
  if (debrisGroup) {
    const flying = p > 0.08;
    debrisGroup.visible = flying;
    if (flying) {
      const tau = (p - 0.08) / 0.92 * 7.0;           // up to ~7 s of drift across the beat tail
      for (const c of debris) {
        c.mesh.position.set(
          c.origin.x + c.vel.x * tau,
          c.origin.y + c.vel.y * tau,
          c.origin.z + c.vel.z * tau);
        c.mesh.rotation.set(c.spin.x * tau, c.spin.y * tau, c.spin.z * tau);
      }
    }
  }

  // ── SPARKS — the ember cloud flung out at detonation, fading over the beat.
  if (sparkPoints && sparkMat && sparkGeo) {
    const on = p > 0.06;
    sparkPoints.visible = on;
    if (on) {
      const tau = (p - 0.06) / 0.94 * 6.0;
      const pos = sparkGeo.attributes.position as THREE.BufferAttribute;
      const vel = sparkGeo.attributes.velocity as THREE.BufferAttribute;
      // advect each ember from its cached LAUNCH origin (_sparkOrigin) by vel·τ — stateless
      //   (the position attr is overwritten every call, so the base lives in _sparkOrigin).
      for (let i = 0; i < pos.count; i++) {
        const ox = _sparkOrigin[i * 3], oy = _sparkOrigin[i * 3 + 1], oz = _sparkOrigin[i * 3 + 2];
        pos.setXYZ(i, ox + vel.getX(i) * tau, oy + vel.getY(i) * tau, oz + vel.getZ(i) * tau);
      }
      pos.needsUpdate = true;
      sparkMat.opacity = Math.max(0, 0.95 - (p - 0.06) / 0.6);   // fade out by ~p0.66
      // cool the ember colour as they fade (yellow-hot → dull red)
      sparkMat.color.setRGB(1.0, 0.7 - 0.35 * p, 0.5 - 0.4 * p);
    }
  }

  // ── BLAST LIGHT — a hot flash spike at detonation, decaying to a low husk-ember glow.
  if (blastLight) {
    const spike = p < 0.18 ? Math.max(0, 1 - Math.abs(p - 0.05) / 0.13) : 0;   // sharp detonation spike
    const glow = Math.max(0, 1 - p) * 0.4;                                       // lingering ember light
    blastLight.intensity = spike * 9 + glow * 3;
    blastLight.color.setRGB(1.0, 0.54 - 0.1 * p, 0.22);
  }
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

  // T3.2 — the explosion FX (fireball / flash / shockwave / debris / sparks / blast light),
  //   centred on root's local origin = HAULER_POS = the ship mid. Starts inert (t=0 intact).
  buildExplosionFx(root, ship);

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
  // T3.2 — dispose the explosion FX per-placement shader/points materials (the meshes ride
  //   under haulerGroup so they're removed with it above; only the per-build mats leak).
  //   The fireball/flash/shock/debris/spark GEOMETRY lives in _disposables (freed below).
  if (fireballMat) { fireballMat.dispose(); fireballMat = null; }
  if (flashMat) { flashMat.dispose(); flashMat = null; }
  if (shockMat) { shockMat.dispose(); shockMat = null; }
  if (sparkMat) { sparkMat.dispose(); sparkMat = null; }
  if (sparkGeo) { sparkGeo.dispose(); sparkGeo = null; }
  fireballMesh = null; flashMesh = null; shockMesh = null; sparkPoints = null;
  blastLight = null; shipGroup = null; debrisGroup = null;
  debris = [];
  _sparkOrigin = new Float32Array(0);
  for (const g of _disposables) g.dispose();
  _disposables.length = 0;
  // Module-shared hull materials are NOT disposed (reused on the next placement).
}
