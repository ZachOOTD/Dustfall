// M7 SKYFALL — the enterable hero freighter wreck (Sharpen & Deepen, plan:
// docs/feature-skyfall.md). A ~38m crashed HEAVY FREIGHTER shipped as a rare
// S4 far-field landmark kind ('skyfall_freighter', FEATURES.skyfall-gated).
//
// S1 (this file's first life): EXTERIOR BLOCKOUT — the crashed silhouette at
// intro-ship-or-larger scale, built silhouette-first from 3-5 read-defining
// masses (fore hull, snapped stern, bridge castle, engine block, cargo
// frames), in a crashed pose (list + bow-bury + a hull SNAP with exposed
// formers). Interior is S2 (a void for now — the breach mouth is visible but
// leads nowhere yet). Hero-detail passes are S3-S5.
//
// STREAMED-LIFECYCLE RULES (Infinite Sands reconciliation — binding):
// - Deterministic from the passed rng ONLY (descriptor purity, D290).
// - Every rigid body is returned for the chunk's teardown list (D292/rule 9);
//   geometry is per-call (callers tag meshes chunkGeo); materials are SHARED
//   module-level singletons (the _treeMat precedent — never disposed).
// - NO horizon-silhouette registration (module-global registry has no
//   removal path — backlogged; a streamed landmark must fully unload).
// - Colliders match the visible masses (rule 9): rotated cuboids aligned
//   with each posed hull piece. The S2 walk-probe is the real-motion gate.

import * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';
import type { Terrain } from './terrain.ts';
import type { Rng } from '../core/rng.ts';
import { makeLoftedHull, makeFormerRings, mergeStaticByMaterial, type LoftStation } from './wreckForms.ts';
import { createRustedHullMaterial } from './hullMaterial.ts';
import { createMetalMaterial } from './metalMaterial.ts';
import { makeStaticBox } from '../physics/bodies.ts';

// ── Shared materials (module singletons — one shader program set for every
//    streamed Skyfall; meshes get chunkGeo so geometry unloads, materials stay).
// S3 WEATHERING — the S1 config leaned on `chalkStrength` (a pale UV veil) +
// the material's default cool bare-metal flecks (0x9ea2a6), which the flat
// shading + high smoothstep thresholds rendered as bright WHITE speckle —
// "snow on a rusty ship" (the S3 nit #1). Fixed by killing chalk, warming +
// dimming the flecks to worn brown metal, and leaning the corrosion into WARM
// channels: rust-orange side oxidation, deep underside/belly rust, seam-pooled
// drip rust running DOWN the flanks, warm ochre deck dust, and a light warm
// sand-scour. Result reads grime/rust/oxidation, not frost.
const _skyfallWeather = {
  rustHex: 0x5a2c14,          // warm rust for streaks + seam drips (was reading near-shadow)
  oxHex: 0x9a5024,            // saturated rust-ORANGE side oxidation
  oxDeepHex: 0x7a3a18,        // deep belly/underside rust (saturated, not mud)
  dustHex: 0x8f7c58,          // WARM ochre desert dust on the decks (was cool grey)
  bareMetalHex: 0x6f5c46,     // WARM worn steel for scuffs (was cool 0x9ea2a6 → the "snow")
  streakIntensity: 0.60,
  wearAmplitude: 0.26,
  aoStrength: 0.30,
  fleckStrength: 0.16,        // was 0.7 — sparse warm scrapes, not a blizzard
  oxStrength: 0.56,
  oxTopStrength: 0.34,
  dustStrength: 0.42,
  chalkStrength: 0.0,         // was 0.22/0.14 — the white-veil source, OFF
  oxDeepStrength: 0.52,
  seamRustStrength: 0.50,     // warm rust drips DOWN the flanks (the wanted streak)
  abrasionStrength: 0.18,     // light warm sand-scour on the lower hull
} as const;
const _hullMat = createRustedHullMaterial({ baseColor: 0x4a4238, ..._skyfallWeather });
const _hullDarkMat = createRustedHullMaterial({ baseColor: 0x3a332c, ..._skyfallWeather, oxStrength: 0.46, seamRustStrength: 0.42 });
const _frameMat = createMetalMaterial(0x51493d, { wornScale: 4.0, scratchStrength: 0.12, rustLevel: 0.35 });
// Faded container livery — a cargo hauler reads via MULTICOLOURED containers, not
// one monotone hull. All via createRustedHullMaterial (same injected GLSL → Three
// shares ONE program; only the uniform colours differ). Containers use a LIGHTER
// weathering profile than the hull — painted steel fades but doesn't rust to mud,
// so the heavy warm-oxidation of _skyfallWeather is dialled WAY back here and the
// livery COLOUR reads (the round-6 nit: full hull rust turned every box brown).
const _cnWeather = {
  ..._skyfallWeather,
  oxStrength: 0.20, oxTopStrength: 0.12, oxDeepStrength: 0.24,
  seamRustStrength: 0.26, streakIntensity: 0.42, dustStrength: 0.34,
  fleckStrength: 0.12, abrasionStrength: 0.10, wearAmplitude: 0.22,
} as const;
const _cnBlue = createRustedHullMaterial({ baseColor: 0x2c5a72, ..._cnWeather });   // faded maritime blue
const _cnRust = createRustedHullMaterial({ baseColor: 0x8a3a22, ..._cnWeather });   // red-oxide / cargo red
const _cnTan  = createRustedHullMaterial({ baseColor: 0xa89268, ..._cnWeather });   // sun-bleached tan (pops)
// Faded warning-ochre — hazard stripes + hull-number plate (freighter livery,
// sun-bleached from a bright yellow to a dull ochre). Stock Lambert → shares the
// Lambert program; flat-shaded to match the wreck palette.
const _hazardMat = new THREE.MeshLambertMaterial({ color: 0x8f7220, flatShading: true });
// Near-black interior baffle — sits recessed inside torn/open mouths so a
// sightline into the fracture hits DARK structure, not a lit pale inner skin
// (the S1 first-visit nit). DoubleSide so it reads from any grazing angle.
const _voidMat = new THREE.MeshLambertMaterial({ color: 0x0a0805, side: THREE.DoubleSide, flatShading: true });

export interface SkyfallResult {
  group: THREE.Group;
  bodies: RAPIER.RigidBody[];
}

/** Place the Skyfall freighter wreck at (x, z), crashed pose derived from
 *  `rand`. Returns the root group (parented under `parent`) + every rigid
 *  body created, for the streamed chunk's teardown list. */
export function placeSkyfallWreck(
  scene: THREE.Scene,
  world: RAPIER.World,
  terrain: Terrain,
  x: number,
  z: number,
  rand: Rng,
  parent?: THREE.Group,
): SkyfallResult {
  const bodies: RAPIER.RigidBody[] = [];
  const root = new THREE.Group();
  root.name = 'skyfallWreck';
  (parent ?? scene).add(root);
  root.userData.skyfallCenter = { x, z };

  // ── Crash pose (drawn up front — fixed rand budget). The freighter came in
  //    shallow, belly-first: hull sunk + listing, the stern SNAPPED off and
  //    settled behind with its own lean, gap showing daylight. Pitch/list are
  //    kept SHALLOW so the long hull lies IN the sand (a steep pose floats a
  //    26m rigid body over near-flat terrain — the R1 float bug).
  const yaw = rand() * Math.PI * 2;
  root.userData.skyfallYaw = yaw;
  const listSign = rand() < 0.5 ? 1 : -1;
  const list = (0.07 + rand() * 0.05) * listSign;                 // 4-7° roll
  const pitch = -(0.01 + rand() * 0.02);                          // ~0.5-1.7° bow-settle (near-flat = no float)
  const sternYawOff = (0.22 + rand() * 0.28) * (rand() < 0.5 ? 1 : -1);
  const sternListSign = rand() < 0.5 ? 1 : -1;
  const sternList = (0.16 + rand() * 0.16) * sternListSign;
  const sternGap = 5.0 + rand() * 3.0;                            // the SNAP daylight (wider = reads)

  // ── FORE HULL — the main mass: ~30m of boxy freighter loft, long-dominant
  //    (L:H ≈ 5:1). Local +Z = forward. Stations: blunt working bow → long
  //    full midbody → the fracture. Slimmer/taller-ratio than R1 so length
  //    reads at 70m instead of a stubby tank blob.
  const FORE_LEN = 30;
  const HALF_W = 3.8;
  const HALF_H = 2.9;
  const foreStations: LoftStation[] = [
    { z: 0, halfW: HALF_W * 0.58, halfH: HALF_H * 0.60, cy: HALF_H * 0.12 },   // blunt working bow face
    { z: 2.5, halfW: HALF_W * 0.82, halfH: HALF_H * 0.86, cy: HALF_H * 0.04 },
    { z: 6, halfW: HALF_W, halfH: HALF_H },                                     // full section (short blunt bow taper)
    { z: FORE_LEN - 4, halfW: HALF_W, halfH: HALF_H },                          // long constant cargo body
    { z: FORE_LEN, halfW: HALF_W * 0.97, halfH: HALF_H * 0.97 },                // fracture face (open)
  ];
  const fore = new THREE.Group();
  fore.add(makeLoftedHull(foreStations, _hullMat, 0.35));
  // Exposed formers at the fracture mouth (the snap shows structure) + a dark
  // baffle recessed behind it so the torn mouth reads DARK, not a lit pale
  // inner skin (the S1 first-visit nit).
  const foreRings = makeFormerRings(HALF_H * 0.9, 3, 0.9);
  foreRings.rotation.y = Math.PI / 2;   // rings space along +X → along the hull's +Z
  foreRings.position.set(0, 0, FORE_LEN - 1.4);
  fore.add(foreRings);
  // (S1's dark mouth baffle is GONE — the fracture is now the real walk-in
  //  entry; the S2 interior below provides the dark depth behind the mouth.)

  // ══ S2 — THE ENTERABLE INTERIOR (greybox + exact collision) ══════════════
  // Local frame: deck TOP at DECK_Y; ceiling underside at CEIL_Y (2.5m clear,
  // DoD ≥2.4m); inner wall faces at ±WALL_X. Three compartments walked bow-
  // ward from the fracture mouth: HOLD (z 20-30) → MID BAY (z 12-20) →
  // FORE CABIN (z 6-12); the tapered nose (z<6) is a sealed mass. Entry is
  // the fracture mouth at z=30 — the deck lip lands ~at outside grade (the
  // hull center sits ≈ ground level from the deep bury), so you walk straight
  // in off the sand. Bulkheads carry a doorway each (jamb panels + lintel +
  // a 10cm anti-leak SILL — the shipScene threshold pattern).
  const DECK_Y = -0.4;
  const CEIL_Y = 2.1;
  const WALL_X = HALF_W - 0.7;            // inner wall face (±3.1)
  const DOOR_HW = 0.55;                   // doorway half-width (1.1m clear)
  const DOOR_TOP = DECK_Y + 2.05;         // doorway clear height 2.05m
  const doorX1 = (rand() - 0.5) * 3.2;    // cabin↔mid doorway x (bulkhead z=12)
  const doorX2 = (rand() - 0.5) * 3.2;    // mid↔hold doorway x (bulkhead z=20)
  // Deck plate — one long walkable plate, overhanging the mouth 0.6m so the
  // lip meets the sand without a gap.
  const deck = new THREE.Mesh(new THREE.BoxGeometry((WALL_X + 0.6) * 2, 0.3, 24.6), _hullDarkMat);
  deck.position.set(0, DECK_Y - 0.15, 18.3);
  fore.add(deck);
  // Bow-closure wall (the interior's forward end, hiding the sealed nose).
  const closure = new THREE.Mesh(new THREE.BoxGeometry((WALL_X + 0.6) * 2, 5.4, 0.35), _hullDarkMat);
  closure.position.set(0, -0.2, 6.2);
  fore.add(closure);
  // Under-deck skirt at the mouth (closes the void below the deck lip).
  const skirt = new THREE.Mesh(new THREE.BoxGeometry((WALL_X + 0.6) * 2, 2.5, 0.3), _voidMat);
  skirt.position.set(0, -1.65, 30.45);
  fore.add(skirt);
  // Bulkheads (visuals; colliders below mirror these exactly): two jamb
  // panels + a lintel + a 10cm sill per doorway.
  const bulkheadAt = (bz: number, doorX: number): void => {
    const panelY = (CEIL_Y + DECK_Y) / 2, panelH = CEIL_Y - DECK_Y;
    const leftW = (doorX - DOOR_HW) - (-WALL_X - 0.35);
    const rightW = (WALL_X + 0.35) - (doorX + DOOR_HW);
    const left = new THREE.Mesh(new THREE.BoxGeometry(leftW, panelH, 0.35), _hullDarkMat);
    left.position.set((-WALL_X - 0.35) + leftW / 2, panelY, bz);
    fore.add(left);
    const right = new THREE.Mesh(new THREE.BoxGeometry(rightW, panelH, 0.35), _hullDarkMat);
    right.position.set((doorX + DOOR_HW) + rightW / 2, panelY, bz);
    fore.add(right);
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(DOOR_HW * 2, CEIL_Y - DOOR_TOP, 0.35), _hullDarkMat);
    lintel.position.set(doorX, (CEIL_Y + DOOR_TOP) / 2, bz);
    fore.add(lintel);
    const sill = new THREE.Mesh(new THREE.BoxGeometry(DOOR_HW * 2, 0.1, 0.4), _frameMat);
    sill.position.set(doorX, DECK_Y + 0.05, bz);
    fore.add(sill);
  };
  bulkheadAt(12, doorX1);
  bulkheadAt(20, doorX2);
  // Dim emergency lighting — enough to WALK the greybox (S3 does the real
  // lighting pass). Lights are group children → torn down with the chunk.
  for (const [ly, lz] of [[1.5, 9], [1.6, 16], [1.5, 25]] as const) {
    const pl = new THREE.PointLight(0xff9a55, 0.55, 10, 2);
    pl.position.set(0, ly, lz);
    fore.add(pl);
  }
  // Bridge castle — FORWARD superstructure, offset to starboard (freighter
  // grammar: crew tower fore-starboard, cargo spine behind it). A distinct
  // 2-tier tower rising clear of the deck so it reads separately from cargo.
  const BR_X = HALF_W * 0.34;   // starboard offset (breaks symmetry)
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(HALF_W * 0.9, 3.0, 3.6), _hullDarkMat);
  bridge.position.set(BR_X, HALF_H + 1.5, 7.0);
  fore.add(bridge);
  const bridgeCap = new THREE.Mesh(new THREE.BoxGeometry(HALF_W * 0.58, 1.5, 2.2), _hullDarkMat);
  bridgeCap.position.set(BR_X, HALF_H + 3.7, 6.6);
  fore.add(bridgeCap);
  // A dark forward window band on the bridge front (thin recessed inset — depth
  // reads at the sill graze, >10cm per rule 7).
  const bridgeWin = new THREE.Mesh(new THREE.BoxGeometry(HALF_W * 0.72, 0.9, 0.25), _voidMat);
  bridgeWin.position.set(BR_X, HALF_H + 2.2, 7.0 + 1.9);
  fore.add(bridgeWin);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 3.4, 6), _frameMat);
  mast.position.set(BR_X + 1.0, HALF_H + 5.1, 6.4);
  fore.add(mast);
  // ── Dorsal CARGO row — a proper spaced spine of containers down the deck
  //    centerline (R1's bunched lump → a legible modular row that subdivides
  //    the hull + reads "cargo hauler"). Alternating tones; a couple knocked
  //    askew for the crash. Fixed 6-draw jitter budget.
  const CN_W = 2.5, CN_H = 2.3, CN_L = 3.2;
  const rowZ0 = 11.5, rowStep = CN_L + 0.7;
  // Collected for the S3 container-detail pass (decorated as CHILDREN so the
  // corrugation/doors/castings inherit each box's crash jitter, and bake into
  // the merge with it). breached: a couple caved-in for crash language.
  const dorsalBoxes: { box: THREE.Mesh; hazard: boolean; breach: boolean }[] = [];
  const cnPalette = [_hullDarkMat, _cnBlue, _cnRust, _cnTan, _cnBlue, _frameMat] as const;
  for (let i = 0; i < 6; i++) {
    const j = rand();                                    // fixed per-container jitter draw
    const cz = rowZ0 + i * rowStep;
    const box = new THREE.Mesh(new THREE.BoxGeometry(CN_W, CN_H, CN_L), cnPalette[i]);
    box.position.set((j - 0.5) * 0.5, HALF_H + CN_H * 0.5 - 0.25, cz);
    box.rotation.set((j - 0.5) * 0.10, (j - 0.5) * 0.22, (j - 0.5) * 0.14);
    fore.add(box);
    dorsalBoxes.push({ box, hazard: i === 1 || i === 4, breach: j > 0.72 });
  }
  // A crane GANTRY rail on posts running the cargo length (a strong freighter
  // silhouette cue; also draws the eye down the LENGTH). Breaks before the
  // fracture. Box beam >10cm deep (rule 7).
  const gantryLen = rowStep * 5 + CN_L;
  const gantryZ = rowZ0 - CN_L * 0.5 + gantryLen * 0.5;
  const beam = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.4, gantryLen), _frameMat);
  beam.position.set(-BR_X, HALF_H + CN_H + 1.3, gantryZ);
  fore.add(beam);
  for (let i = 0; i < 4; i++) {
    const pz = rowZ0 - CN_L * 0.4 + (gantryLen - 1.0) * (i / 3);
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.28, CN_H + 1.5, 0.28), _frameMat);
    post.position.set(-BR_X, HALF_H + (CN_H + 1.5) * 0.5 - 0.25, pz);
    fore.add(post);
  }
  // World-space frame helpers (yaw only). fwd = hull +Z; lateral = +X.
  const fwd = new THREE.Vector2(Math.sin(yaw), Math.cos(yaw));
  const lat = new THREE.Vector2(Math.cos(yaw), -Math.sin(yaw));

  // Pose the fore hull — SLOPE-CONFORMED (S2). Landmark sites roll anywhere
  // (no flatness gate), so grade can drop meters bow→mouth; a bury measured
  // only at the bow anchor leaves the mouth END floating over lower sand
  // (the walk probe caught the capsule strolling UNDER the deck on terrain).
  // Fix: pitch follows the bow→mouth grade (plus the small crash settle),
  // and the DECK LIP is anchored ~0.15m above LOCAL grade at the mouth — the
  // entry is a real step-in on every site, and the bow end digs in deeper
  // uphill (which reads as the crash furrow).
  const foreBury = 2.8 + rand() * 0.4;    // (kept draw) modulates the lip height a touch
  const groundMouth = terrain.heightAt(x + fwd.x * FORE_LEN, z + fwd.y * FORE_LEN);
  const lipH = 0.12 + (foreBury - 2.8) * 0.15;   // 0.12-0.18m step onto the deck
  const mouthDeckY = groundMouth + lipH;
  // Deck-line slope: start from the bow→mouth endpoint grade, then RAISE the
  // pitch until the deck clears the grade at interior samples to within 0.3m
  // (dune curvature can bulge ABOVE a two-point line mid-hull — seed-808's
  // waist-deep sand in the mid bay). Residual ≤ ~0.3m reads as shin-deep
  // ingress in the buried end (deliberate wreck language, probe-bounded 0.5).
  let deckSlope = (terrain.heightAt(x + fwd.x * 2, z + fwd.y * 2) - groundMouth) / FORE_LEN;
  for (const zi of [9, 16, 23] as const) {
    const gi = terrain.heightAt(x + fwd.x * zi, z + fwd.y * zi);
    deckSlope = Math.max(deckSlope, (gi - 0.3 - mouthDeckY) / (FORE_LEN - zi));
  }
  deckSlope = Math.min(Math.max(deckSlope, -0.06), 0.15);   // deck stays walkable (≤~8.5°)
  // The conforming slope IS the final pitch — adding the cosmetic crash
  // settle (`pitch`, ~1°) after the fit drooped the bow-end deck back under
  // the grade constraint (seed-808). The LIST carries the crash read.
  fore.rotation.set(Math.asin(deckSlope), yaw, list, 'YXZ');
  const foreQ0 = new THREE.Quaternion().setFromEuler(fore.rotation);
  const mouthDeckLocal = new THREE.Vector3(0, -0.4, FORE_LEN).applyQuaternion(foreQ0);
  fore.position.set(x, mouthDeckY - mouthDeckLocal.y, z);
  root.add(fore);

  // ── STERN PIECE — snapped off, ~10m: engine block + nozzles, settled with
  //    its own lean behind the fracture, gap showing daylight. Front mouth
  //    dark-baffled + former-ringed to match the fore fracture.
  const STERN_LEN = 10;
  const sternStations: LoftStation[] = [
    { z: 0, halfW: HALF_W * 0.96, halfH: HALF_H * 0.96 },                      // fracture face (open)
    { z: STERN_LEN - 3, halfW: HALF_W * 0.92, halfH: HALF_H * 0.92 },
    { z: STERN_LEN, halfW: HALF_W * 0.72, halfH: HALF_H * 0.76, cy: HALF_H * 0.05 },  // transom
  ];
  const stern = new THREE.Group();
  stern.add(makeLoftedHull(sternStations, _hullMat, 0.35));
  const sternRings = makeFormerRings(HALF_H * 0.86, 2, 0.9);
  sternRings.rotation.y = Math.PI / 2;
  sternRings.position.set(0, 0, 1.2);
  stern.add(sternRings);
  const sternBaffle = new THREE.Mesh(new THREE.BoxGeometry(HALF_W * 1.7, HALF_H * 1.7, 0.4), _voidMat);
  sternBaffle.position.set(0, 0, 2.2);
  stern.add(sternBaffle);
  // Engine block + three nozzles off the transom (cylinders are inherently thick).
  const engBlock = new THREE.Mesh(new THREE.BoxGeometry(HALF_W * 1.7, HALF_H * 1.6, 2.6), _hullDarkMat);
  engBlock.position.set(0, 0.1, STERN_LEN - 0.4);
  stern.add(engBlock);
  for (const [nx, ny] of [[-2.0, 0.7], [2.0, 0.7], [0, -1.1]] as const) {
    const noz = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.4, 2.0, 12), _frameMat);
    noz.rotation.x = Math.PI / 2;
    noz.position.set(nx, ny, STERN_LEN + 1.0);
    stern.add(noz);
  }
  // Pose the stern behind the fore hull's fracture, along the crashed axis,
  // sunk + tilted so it reads as a broken-off chunk (settled lower than the fore).
  // stern.position is the stern loft's FRONT face (its local z=0); the fore
  // hull spans local z 0..FORE_LEN from fore.position (the BOW) — so the real
  // snap daylight is aftDist − FORE_LEN. The S1 code measured from the hull
  // MIDDLE (FORE_LEN*0.5), which embedded the stern's front 2-5m INSIDE the
  // fore hull and parked its collider in the fracture mouth — caught by the
  // S2 walk probe's mouth waypoint (visually masked: both masses dark + yawed).
  const aftDist = FORE_LEN + sternGap;
  const sternBase = new THREE.Vector3(x + fwd.x * aftDist, 0, z + fwd.y * aftDist);
  const sternGroundY = terrain.heightAt(sternBase.x, sternBase.z);
  const sternBury = 2.65 + rand() * 0.4;   // deeper settle — no-float without mounds (user steering)
  stern.rotation.set(pitch * 0.5 + 0.03, yaw + sternYawOff, sternList, 'YXZ');
  stern.position.set(sternBase.x, sternGroundY + HALF_H - sternBury, sternBase.z);
  root.add(stern);

  // ── Spilled ground containers — two crash-strewn boxes on the sand off the
  //    low-list flank (breaks the neat row read; crash language). Each gets a
  //    collider (reachable, rule 9).
  const spillCols: { hx: number; hy: number; hz: number; pos: THREE.Vector3; quat: THREE.Quaternion }[] = [];
  const spillBoxes: THREE.Mesh[] = [];
  for (let i = 0; i < 2; i++) {
    const j = rand();
    const along = FORE_LEN * (0.4 + i * 0.35);
    const outward = (HALF_W + 3.0 + j * 2.0) * listSign;
    const sx = x + fwd.x * along + lat.x * outward;
    const sz = z + fwd.y * along + lat.y * outward;
    const sgy = terrain.heightAt(sx, sz);
    const cbox = new THREE.Mesh(new THREE.BoxGeometry(CN_W, CN_H, CN_L), i % 2 === 0 ? _cnRust : _cnTan);
    const cyaw = yaw + (j - 0.5) * 1.4;
    const croll = (j - 0.5) * 0.6;
    cbox.rotation.set(0.1 * (j - 0.5), cyaw, croll, 'YXZ');
    cbox.position.set(sx, sgy + CN_H * 0.32, sz);
    root.add(cbox);
    spillBoxes.push(cbox);
    spillCols.push({
      hx: CN_W / 2, hy: CN_H / 2, hz: CN_L / 2,
      pos: cbox.position.clone(),
      quat: new THREE.Quaternion().setFromEuler(cbox.rotation),
    });
  }

  // ── NO SAND MOUNDS (user steering, 2026-07-12): the drift banks/mounds read
  //    as geometric orange piles and are retired for Skyfall. The no-float read
  //    is carried by the deep keel bury alone (foreBury/sternBury sink ~half
  //    the hull below the pan; terrain here is near-flat salt by the landmark
  //    site roll, so the buried waterline holds on every flank without berms).
  //    NOTE the rand draws the mounds consumed are gone — this generator has
  //    no cross-version determinism obligation (no save coupling), draw budget
  //    stays fixed WITHIN a build, which is all D290 requires.

  // ══ S3 — EXTERIOR HERO DETAIL ═══════════════════════════════════════════
  // Plating + freighter grammar layered onto the posed masses so the blockout
  // reads as a REAL crashed heavy freighter at 20-40m and holds up close. All
  // DECORATION (no colliders — the hull/bulkhead/stern/spill colliders stand);
  // all use the SHARED materials so mergeStaticByMaterial folds them to one
  // draw per material. Added as children of `fore`/`stern` in LOCAL coords so
  // they inherit each mass's crash transform.
  const dBox = (
    parent: THREE.Object3D, mat: THREE.Material,
    w: number, h: number, d: number, px: number, py: number, pz: number,
    rx = 0, ry = 0, rz = 0,
  ): THREE.Mesh => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(px, py, pz);
    if (rx || ry || rz) m.rotation.set(rx, ry, rz);
    parent.add(m);
    return m;
  };

  // ── Hull-side PLATING (fore flanks) — the S1 flanks read as smooth painted
  //    slabs. A rubbing strake (belt rail) + a lower chine strake + regularly-
  //    spaced vertical frame straps break the flat into a plated, framed hull.
  //    Visible flank is local y ≈ [-0.4 grade .. +1.3 top-chine]; strakes at
  //    mid-height, protruding ~0.15m (rule 7).
  for (const s of [-1, 1] as const) {
    const fx = HALF_W * s;
    dBox(fore, _frameMat, 0.18, 0.36, 25, fx + 0.06 * s, 0.62, 16.5);    // rubbing strake (belt)
    dBox(fore, _hullDarkMat, 0.16, 0.24, 24, fx + 0.05 * s, -0.35, 16.5); // lower chine strake
    for (let i = 0; i < 8; i++) {                                         // vertical frame straps
      const fz = 6.5 + i * 3.05;
      dBox(fore, _frameMat, 0.14, 1.75, 0.30, fx + 0.04 * s, 0.30, fz);
    }
  }
  // Deck-edge bulwark coaming — a low raised rim along the two dorsal deck
  // edges (cargo-deck grammar; reads as a strong parallel line at distance).
  for (const s of [-1, 1] as const) {
    dBox(fore, _hullDarkMat, 0.22, 0.42, 25, HALF_W * 0.44 * s, HALF_H + 0.16, 16.5);
  }

  // ── CONTAINER DETAIL — the S1 cargo were plain boxes. Give them freighter-
  //    grade grammar: corrugation ribs on the long sides, corner castings at
  //    all 8 corners, an end-door recess (twin doors + locking rods), faded
  //    hazard stripes on a couple, and a caved-in breach on the crash-crushed
  //    ones. Added as CHILDREN of each box (inherits its jitter; bakes into
  //    the merge). Corner castings + rods = _frameMat; doors = _voidMat gap.
  const detailContainer = (box: THREE.Mesh, hazard: boolean, breach: boolean): void => {
    const hw = CN_W / 2, hh = CN_H / 2, hl = CN_L / 2;
    // Corrugation — proud vertical ribs on the two long (±x) faces.
    for (const s of [-1, 1] as const) {
      for (let r = 0; r < 6; r++) {
        const rz = -hl + 0.35 + r * ((CN_L - 0.7) / 5);
        dBox(box, box.material as THREE.Material, 0.10, CN_H - 0.36, 0.14, s * (hw + 0.03), 0, rz);
      }
    }
    // Corner castings — the ISO cube fittings at all 8 corners.
    for (const sx of [-1, 1] as const) for (const sy of [-1, 1] as const) for (const sz of [-1, 1] as const) {
      dBox(box, _frameMat, 0.30, 0.30, 0.30, sx * (hw - 0.02), sy * (hh - 0.02), sz * (hl - 0.02));
    }
    // End-door face (+z end): recessed dark gap + a central seam + locking rods.
    dBox(box, _voidMat, CN_W - 0.5, CN_H - 0.5, 0.06, 0, 0, hl + 0.03);        // door recess (dark)
    dBox(box, _frameMat, 0.12, CN_H - 0.4, 0.10, 0, 0, hl + 0.07);             // centre seam
    for (const rx of [-0.72, -0.32, 0.32, 0.72] as const) {
      dBox(box, _frameMat, 0.06, CN_H - 0.55, 0.10, rx, 0, hl + 0.07);         // locking rods
    }
    // Hazard stripe — a faded warning band across the door end, cut by two dark
    //    diagonal slashes (reads as hazard chevrons at distance).
    if (hazard) {
      dBox(box, _hazardMat, CN_W - 0.5, 0.5, 0.05, 0, hh - 0.55, hl + 0.05);
      dBox(box, _hullDarkMat, 0.28, 0.6, 0.06, -0.5, hh - 0.55, hl + 0.06, 0, 0, 0.6);
      dBox(box, _hullDarkMat, 0.28, 0.6, 0.06, 0.5, hh - 0.55, hl + 0.06, 0, 0, 0.6);
    }
    // Breach — a caved-in dark maw on the top + a couple bent torn plates
    //    (crash crush language). Only on flagged boxes.
    if (breach) {
      dBox(box, _voidMat, CN_W - 0.9, 0.5, CN_L - 1.1, 0.2, hh - 0.12, -0.1);  // sunken dark top
      dBox(box, box.material as THREE.Material, CN_W - 0.7, 0.14, 1.0, 0.2, hh - 0.02, 0.5, 0.5, 0.2, 0.1); // bent lid plate
      dBox(box, _frameMat, 0.9, 0.12, 0.5, -0.4, hh + 0.05, -0.6, -0.4, 0.1, -0.2);   // torn flap
    }
  };
  for (const d of dorsalBoxes) detailContainer(d.box, d.hazard, d.breach);
  detailContainer(spillBoxes[0], true, false);
  detailContainer(spillBoxes[1], false, true);

  // ── FREIGHTER GREEBLES — the grammar that says "working heavy freighter,"
  //    prioritised for what reads at 20-40m: a bridge sensor mast + dish that
  //    break the sky silhouette, a boarding ladder + pipe runs (strong
  //    vertical/horizontal lines), flank intake vents, a bow hull-number
  //    plate (identity), deck tie-down cleats, and an exhaust funnel.
  const dCyl = (
    parent: THREE.Object3D, mat: THREE.Material,
    rt: number, rb: number, len: number, px: number, py: number, pz: number,
    rx = 0, ry = 0, rz = 0, seg = 8,
  ): THREE.Mesh => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, len, seg), mat);
    m.position.set(px, py, pz);
    if (rx || ry || rz) m.rotation.set(rx, ry, rz);
    parent.add(m);
    return m;
  };
  // Bridge sensor array — a radar crossyard on the existing mast + a whip
  //    antenna + a comms dish + a small exhaust funnel behind the castle.
  dBox(fore, _frameMat, 1.7, 0.09, 0.09, BR_X + 1.0, HALF_H + 6.7, 6.4);        // radar crossyard
  dBox(fore, _frameMat, 0.09, 0.09, 1.1, BR_X + 1.0, HALF_H + 6.4, 6.4);        // crossyard fore/aft arm
  dCyl(fore, _frameMat, 0.04, 0.05, 2.6, BR_X - 0.7, HALF_H + 4.9, 7.2);        // whip antenna
  dCyl(fore, _frameMat, 0.5, 0.5, 0.16, BR_X + 0.5, HALF_H + 4.5, 7.7, Math.PI * 0.35, 0, 0, 10); // comms dish face
  dCyl(fore, _frameMat, 0.9, 1.05, 1.4, BR_X - 0.4, HALF_H + 4.0, 4.6, 0, 0, 0, 10);              // exhaust funnel
  dBox(fore, _hullDarkMat, 1.7, 0.2, 1.7, BR_X - 0.4, HALF_H + 4.75, 4.6);      // funnel cap rim
  // Boarding ladder — rails + rungs up the bridge front face (deck → bridge).
  for (const s of [-1, 1] as const) dBox(fore, _frameMat, 0.06, 3.0, 0.06, BR_X + 0.35 * s, HALF_H + 1.5, 8.75);
  for (let r = 0; r < 7; r++) dBox(fore, _frameMat, 0.7, 0.05, 0.05, BR_X, HALF_H + 0.1 + r * 0.42, 8.75);
  // Pipe runs — twin conduits running ALONG the port flank just under the belt
  //    rail (rx=π/2 aligns the cylinder axis to the hull's +Z length).
  for (const dy of [0, 0.26] as const) dCyl(fore, _frameMat, 0.11, 0.11, 19, HALF_W + 0.08, 1.05 - dy, 15.5, Math.PI / 2, 0, 0, 8);
  for (let i = 0; i < 5; i++) dBox(fore, _frameMat, 0.14, 0.5, 0.12, HALF_W + 0.02, 0.85, 8 + i * 4.2);  // pipe brackets
  // Flank intake vents — flush recessed louvered grilles on the starboard flank
  //    (a thin frame + dark mouth + a few slats; protrudes only ~0.06m).
  for (const vz of [10, 18, 25] as const) {
    dBox(fore, _voidMat, 0.05, 0.9, 1.2, -(HALF_W - 0.06), 0.55, vz);           // recessed dark mouth (inset)
    for (let l = 0; l < 4; l++) dBox(fore, _frameMat, 0.06, 0.07, 1.2, -(HALF_W + 0.02), 0.2 + l * 0.24, vz);  // louvers (flush)
    dBox(fore, _frameMat, 0.07, 1.05, 0.1, -(HALF_W + 0.02), 0.55, vz - 0.6);   // vent frame edge
    dBox(fore, _frameMat, 0.07, 1.05, 0.1, -(HALF_W + 0.02), 0.55, vz + 0.6);   // vent frame edge
  }
  // Bow hull-number plate — a faded ochre plate near the bow with dark digit
  //    blocks (abstract ID; reads as painted hull markings at distance).
  for (const s of [-1, 1] as const) {
    dBox(fore, _hazardMat, 0.06, 0.9, 2.4, HALF_W * 0.99 * s, 1.0, 4.0);        // number plate
    for (const dz of [-0.75, -0.05, 0.65] as const) dBox(fore, _hullDarkMat, 0.08, 0.5, 0.28, HALF_W * 0.99 * s + 0.02 * s, 1.0, 4.0 + dz);  // digits
  }
  // Deck tie-down cleats — small bollards along both deck-edge coamings.
  for (const s of [-1, 1] as const) for (let i = 0; i < 6; i++) {
    dBox(fore, _frameMat, 0.22, 0.28, 0.22, HALF_W * 0.44 * s, HALF_H + 0.42, 8 + i * 3.6);
  }
  // Bridge window frame + mullions around the dark forward window band.
  const bwY = HALF_H + 2.2, bwZ = 7.0 + 1.9, bwW = HALF_W * 0.72;
  dBox(fore, _frameMat, bwW + 0.2, 0.12, 0.12, BR_X, bwY + 0.52, bwZ + 0.02);   // top rail
  dBox(fore, _frameMat, bwW + 0.2, 0.12, 0.12, BR_X, bwY - 0.52, bwZ + 0.02);   // sill rail
  for (const s of [-1, 1] as const) dBox(fore, _frameMat, 0.12, 1.1, 0.12, BR_X + (bwW / 2 + 0.06) * s, bwY, bwZ + 0.02); // jambs
  for (const mx of [-0.9, 0, 0.9] as const) dBox(fore, _frameMat, 0.08, 1.0, 0.10, BR_X + mx, bwY, bwZ + 0.03);           // mullions

  // ── STERN mechanical detail — nozzle throat rings + a finned engine radiator
  //    on the snapped engine block (cylinders/tori are inherently thick).
  for (const [nx, ny] of [[-2.0, 0.7], [2.0, 0.7], [0, -1.1]] as const) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.12, 0.16, 8, 14), _frameMat);
    ring.position.set(nx, ny, STERN_LEN + 2.0);
    stern.add(ring);                                                            // nozzle throat ring
    const innerRing = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.10, 8, 12), _frameMat);
    innerRing.position.set(nx, ny, STERN_LEN + 1.4);
    stern.add(innerRing);                                                       // inner throat
  }
  for (let f = 0; f < 6; f++) {                                                 // engine cooling fins
    dBox(stern, _frameMat, 0.10, 0.7, 2.4, -2.6 + f * 1.05, HALF_H * 0.95, STERN_LEN - 0.4);
  }
  dBox(stern, _frameMat, HALF_W * 1.7, 0.16, 2.5, 0, HALF_H * 0.55, STERN_LEN - 0.4);  // fin base manifold

  // PERF — one draw per material.
  mergeStaticByMaterial(root);

  // ── COLLIDERS (rule 9 — match the posed visible masses). Rotated cuboids
  //    aligned with each piece; the buried fraction sits below ground.
  //    S2: the S1 single fore-hull cuboid is GONE (it filled the interior) —
  //    replaced by an exact walkable set: deck, side walls, roof, bow mass,
  //    bulkhead panels/lintels/sills, mouth skirt. The mouth itself has NO
  //    collider — it is the entry.
  const foreQuat = new THREE.Quaternion().setFromEuler(fore.rotation);
  const localCol = (hx: number, hy: number, hz: number, lx: number, ly: number, lz: number): RAPIER.Collider => {
    const c = makeStaticBox(
      world, { x: hx, y: hy, z: hz },
      fore.position.clone().add(new THREE.Vector3(lx, ly, lz).applyQuaternion(foreQuat)),
      foreQuat,
    );
    const b = c.parent();
    if (b) bodies.push(b);
    return c;
  };
  // Deck (the walkable floor — its handle is exported for the walk probe).
  const deckCol = localCol(WALL_X + 0.6, 0.15, 12.3, 0, DECK_Y - 0.15, 18.3);
  // Side walls (double as the exterior hull sides over the interior span).
  localCol(0.35, HALF_H, 12, -(WALL_X + 0.35), 0, 18);
  localCol(0.35, HALF_H, 12, WALL_X + 0.35, 0, 18);
  // Roof (underside = the interior ceiling at CEIL_Y).
  localCol(HALF_W, 0.4, 12, 0, CEIL_Y + 0.4, 18);
  // Sealed bow mass (the tapered nose, z 0-6 — also the interior's end wall).
  localCol(3.0, HALF_H * 0.9, 3.1, 0, 0.1, 3.0);
  // Bulkhead colliders — mirror the visuals exactly (panels + lintel + sill).
  const sillHandles: number[] = [];
  const bulkheadCols = (bz: number, doorX: number): void => {
    const panelY = (CEIL_Y + DECK_Y) / 2, panelHH = (CEIL_Y - DECK_Y) / 2;
    const leftW = (doorX - DOOR_HW) - (-WALL_X - 0.35);
    const rightW = (WALL_X + 0.35) - (doorX + DOOR_HW);
    localCol(leftW / 2, panelHH, 0.175, (-WALL_X - 0.35) + leftW / 2, panelY, bz);
    localCol(rightW / 2, panelHH, 0.175, (doorX + DOOR_HW) + rightW / 2, panelY, bz);
    localCol(DOOR_HW, (CEIL_Y - DOOR_TOP) / 2, 0.175, doorX, (CEIL_Y + DOOR_TOP) / 2, bz);
    // The anti-leak sill — standing IN a doorway means standing on it, so its
    // handle counts as legitimate floor for the walk probe.
    sillHandles.push(localCol(DOOR_HW, 0.05, 0.2, doorX, DECK_Y + 0.05, bz).handle);
  };
  bulkheadCols(12, doorX1);
  bulkheadCols(20, doorX2);
  // Under-deck skirt at the mouth (matches the visual plate).
  localCol(WALL_X + 0.6, 1.25, 0.15, 0, -1.65, 30.45);
  // ── Walk-probe data (rig-shot `skyfall-walk`): world-space waypoints down
  //    the full walk path + the deck collider handle (a castDown from any
  //    interior waypoint must hit THIS collider — terrain underneath sits
  //    within ~0.4m of the deck, so height alone can't prove no-fall-through).
  fore.updateMatrixWorld(true);
  const wp = (name: string, lx: number, ly: number, lz: number): { name: string; x: number; y: number; z: number } => {
    const v = fore.localToWorld(new THREE.Vector3(lx, ly, lz));
    return { name, x: v.x, y: v.y, z: v.z };
  };
  root.userData.skyfallProbe = {
    deckHandle: deckCol.handle,
    floorHandles: [deckCol.handle, ...sillHandles],
    waypoints: [
      wp('outside', 0, DECK_Y, 33.0),
      wp('mouth', 0, DECK_Y, 29.0),
      wp('hold', 0, DECK_Y, 24.5),
      wp('door2', doorX2, DECK_Y, 20.0),
      wp('mid', 0, DECK_Y, 16.0),
      wp('door1', doorX1, DECK_Y, 12.0),
      wp('cabin', 0, DECK_Y, 9.0),
    ],
    ceilY: CEIL_Y - DECK_Y,   // clearance above deck (ray-up assert)
    wallX: WALL_X,            // inner wall face distance (ray-side assert)
  };
  // Bridge castle stands proud of the hull box — its own collider.
  const bridgeCol = makeStaticBox(
    world,
    { x: HALF_W * 0.45, y: 1.5, z: 1.8 },
    fore.position.clone().add(new THREE.Vector3(BR_X, HALF_H + 1.5, 7.0).applyQuaternion(foreQuat)),
    foreQuat,
  );
  {
    const b = bridgeCol.parent();
    if (b) bodies.push(b);
  }
  const sternQuat = new THREE.Quaternion().setFromEuler(stern.rotation);
  const sternCol = makeStaticBox(
    world,
    { x: HALF_W * 0.96, y: HALF_H * 0.96, z: STERN_LEN / 2 + 1.5 },   // +nozzles
    stern.position.clone().add(new THREE.Vector3(0, 0, STERN_LEN / 2).applyQuaternion(sternQuat)),
    sternQuat,
  );
  {
    const b = sternCol.parent();
    if (b) bodies.push(b);
  }
  // Spilled ground containers — a collider each (walk-into-able, rule 9).
  for (const s of spillCols) {
    const c = makeStaticBox(world, { x: s.hx, y: s.hy, z: s.hz }, s.pos, s.quat);
    const b = c.parent();
    if (b) bodies.push(b);
  }

  return { group: root, bodies };
}
