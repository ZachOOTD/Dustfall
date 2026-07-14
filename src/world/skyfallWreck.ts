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
import { type Rng, makeRng } from '../core/rng.ts';
import { makeLoftedHull, makeFormerRings, mergeStaticByMaterial, type LoftStation } from './wreckForms.ts';
import { createRustedHullMaterial } from './hullMaterial.ts';
import { createMetalMaterial } from './metalMaterial.ts';
import { makeStaticBox } from '../physics/bodies.ts';
import { registerSalvageable, type SalvageableRegistry, type Salvageable } from './salvage.ts';   // S6 — interior salvage loot
import { addAccessPanel } from './wrecks.ts';                                                      // S6 — the pry-open panel builder
import { placeJournal, type Journal } from './journal.ts';                                         // S6 — the pilot's crash-log
import { generateCrashLog } from './crashLog.ts';

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
// (the S1 first-visit nit). M7-R: FrontSide (was DoubleSide) — every _voidMat
// use is a SOLID box with real depth, so a single-sided solid reads correct
// from outside AND can never present as a see-through paper card (the standing
// no-paper-thin rule). Solid dark structure, not a hollow shell.
const _voidMat = new THREE.MeshLambertMaterial({ color: 0x0a0805, flatShading: true });

// ── HULL WALL THICKNESS (M7-R headline). 0.35 read paper-thin at the ~46m
//    freighter scale — the fracture/breach cross-section was a knife edge. 0.7
//    reads as a real heavy-freighter hull plate + frame, and it lands the loft's
//    inner skin EXACTLY on the interior wall plane (HALF_W - 0.7 = WALL_X = 3.1),
//    which also closes a latent invisible-wall gap: before, the visible inner
//    skin sat 0.35m outboard of the side-wall collider face, so the player
//    stopped short of the wall they could see. Now skin == collider face.
const HULL_THICK = 0.7;

// ══ INTERIOR DRESSING MATERIALS (S4-S5) — module singletons ═══════════════
// The wrecked-interior palette, mirroring shipScene's vocabulary (worn painted
// panels, dead screen glass, black cabling, exposed conduit/wire, stripped
// vinyl, failing emergency strips, drifted sand, scorch) but as SHARED
// singletons (streamed content never disposes). Panels/deck reuse the metal
// program (createMetalMaterial → one shared shader); the rest are Lambert
// (shares the Lambert program). A couple carry a whisper of emissive so a dead
// screen / failing strip reads as GLASS or a live-but-dying lamp, not paint.
const _intPanelMat = createMetalMaterial(0x565049, { wornScale: 5.0, scratchStrength: 0.10, rustLevel: 0.30 });  // worn interior wall lining
const _intPanelDkMat = createMetalMaterial(0x3f3a34, { wornScale: 4.5, scratchStrength: 0.09, rustLevel: 0.34 }); // darker recess/backing panel
const _seatMat = new THREE.MeshLambertMaterial({ color: 0x37402f, flatShading: true });      // stripped crew-seat vinyl (worn olive)
const _cableMat = new THREE.MeshLambertMaterial({ color: 0x121014, flatShading: true });     // black rubber cable / loom
const _conduitMat = new THREE.MeshLambertMaterial({ color: 0x6a5a3d, flatShading: true });   // painted conduit / pipe (worn ochre-grey)
const _wireRedMat = new THREE.MeshLambertMaterial({ color: 0x742824, flatShading: true });   // exposed wire bundle (dull red)
const _wireCuMat = new THREE.MeshLambertMaterial({ color: 0x7c5330, flatShading: true });    // exposed wire bundle (copper / tan)
const _deadScreenMat = new THREE.MeshLambertMaterial({ color: 0x05080a, emissive: 0x0a151c, emissiveIntensity: 0.22, flatShading: true }); // dead MFD glass (barely-alive cool glow)
const _stripDeadMat = new THREE.MeshLambertMaterial({ color: 0x1b1d1f, flatShading: true });  // dead strip-light housing (no glow)
const _stripRedMat = new THREE.MeshLambertMaterial({ color: 0x3a1210, emissive: 0x8a1c0a, emissiveIntensity: 1.05, flatShading: true }); // failing red emergency strip
const _stripCoolMat = new THREE.MeshLambertMaterial({ color: 0x1a2228, emissive: 0x243a42, emissiveIntensity: 0.5, flatShading: true }); // failing cool strip (desaturated — was a lurid cyan)
const _scorchMat = new THREE.MeshLambertMaterial({ color: 0x0d0a08, flatShading: true });      // burnt scorch scar (matte warm-black)
const _sandDriftMat = new THREE.MeshLambertMaterial({ color: 0x9e885d, flatShading: true });  // interior sand drift (warm ochre)
const _mugMat = new THREE.MeshLambertMaterial({ color: 0xa85f3e, flatShading: true });        // a crew mug (faded terracotta)
const _paperMat = new THREE.MeshLambertMaterial({ color: 0x9a917c, flatShading: true });      // grimy pinned manifest / label / clipboard sheet (dull bone)
const _rubberMat = new THREE.MeshLambertMaterial({ color: 0x201d1a, flatShading: true });     // dark rubber — coiled hose / gasket / boot (near-black warm)

export interface SkyfallResult {
  group: THREE.Group;
  bodies: RAPIER.RigidBody[];
  /** S6 — the interior salvage panels this wreck registered (the caller tags
   *  them `sky/N`, applies the chunk diff, and tracks them for teardown). */
  salvage: Salvageable[];
  /** S6 — the pilot's crash-log journal on the bow console (the caller pushes
   *  it into ctx.journals + tracks it for teardown). Null if not requested. */
  journal: Journal | null;
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
  opts: { salvage?: SalvageableRegistry; journal?: boolean } = {},
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
  fore.add(makeLoftedHull(foreStations, _hullMat, HULL_THICK));
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
  // Collider data captured at build (fore.quat/pos aren't known until the pose
  // is solved below) — each dorsal container gets a matching rotated cuboid
  // (M7-R collision gap: the player walked THROUGH the row on top of the hull).
  const dorsalCols: { localPos: THREE.Vector3; localQuat: THREE.Quaternion }[] = [];
  const cnPalette = [_hullDarkMat, _cnBlue, _cnRust, _cnTan, _cnBlue, _frameMat] as const;
  for (let i = 0; i < 6; i++) {
    const j = rand();                                    // fixed per-container jitter draw
    const cz = rowZ0 + i * rowStep;
    const box = new THREE.Mesh(new THREE.BoxGeometry(CN_W, CN_H, CN_L), cnPalette[i]);
    box.position.set((j - 0.5) * 0.5, HALF_H + CN_H * 0.5 - 0.25, cz);
    box.rotation.set((j - 0.5) * 0.10, (j - 0.5) * 0.22, (j - 0.5) * 0.14);
    fore.add(box);
    dorsalBoxes.push({ box, hazard: i === 1 || i === 4, breach: j > 0.72 });
    dorsalCols.push({ localPos: box.position.clone(), localQuat: new THREE.Quaternion().setFromEuler(box.rotation) });
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
  stern.add(makeLoftedHull(sternStations, _hullMat, HULL_THICK));
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
    dBox(fore, _hazardMat, 0.13, 0.9, 2.4, HALF_W * 0.985 * s, 1.0, 4.0);       // number plate (rule-7 depth, was a 0.06 card)
    for (const dz of [-0.75, -0.05, 0.65] as const) dBox(fore, _hullDarkMat, 0.13, 0.5, 0.28, HALF_W * 0.985 * s + 0.06 * s, 1.0, 4.0 + dz);  // digits (proud of the plate)
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

  // ── TORN CUT-PLATE RIM at the fracture mouths (M7-R headline). The 0.7m loft
  //    inner-skin + rim cap gives real thickness, but the weathered hull paint
  //    lets the cut edge sink into shadow. A bare-metal (_frameMat) torn rim
  //    framing each opening makes the wall CROSS-SECTION read unmistakably as
  //    thick torn STEEL — the plate depth (HULL_THICK) is the box's z-extent, so
  //    you see the inner+outer skin sandwich edge-on. Crash-jagged (a couple
  //    bent out). Shared material → folds into the merge; NO collider (the hull
  //    loft/mouth colliders stand; the mouth stays a clear walk-in entry).
  //    faceSign: +1 = open face points +Z (fore fracture at z=FORE_LEN);
  //              -1 = open face points -Z (stern fracture at z=0).
  const fractureRim = (parent: THREE.Object3D, faceZ: number, faceSign: 1 | -1, hw: number, hh: number): void => {
    const zc = faceZ - faceSign * HULL_THICK * 0.5;         // rim centred on the cut plane
    const T = HULL_THICK * 1.04;                            // plate depth (slightly proud so it reads)
    const crownY = hh * 0.95;
    // Top crown — 3 slightly-jagged plate segments across the deck opening,
    // hugging the cut plane (small bend so they read as an attached torn rim,
    // not detached flaps).
    for (let i = 0; i < 3; i++) {
      const bend = (i - 1) * 0.06;
      dBox(parent, _frameMat, hw * 0.46, 0.40, T,
        (i - 1) * hw * 0.42, crownY + (i % 2 ? 0.05 : -0.03), zc + (i % 2 ? 0.05 : -0.03) * faceSign,
        bend, 0, bend * 0.5);
    }
    // Upper-shoulder plates (both top chines) + upper vertical-side plates.
    // Pulled in slightly (×0.94) so they visually meet the hull skin.
    for (const s of [-1, 1] as const) {
      dBox(parent, _frameMat, 0.46, 0.5, T, s * hw * 0.76, hh * 0.80, zc, 0, 0, s * 0.28);   // top chine
      dBox(parent, _frameMat, 0.42, 0.95, T, s * hw * 0.94, hh * 0.40, zc, 0, 0, s * 0.08);  // upper side
    }
    // Lower-side stub plates (the cut continues down the flanks a little).
    for (const s of [-1, 1] as const) {
      dBox(parent, _frameMat, 0.40, 0.7, T, s * hw * 0.94, -hh * 0.20, zc);
    }
  };
  fractureRim(fore, FORE_LEN, 1, HALF_W * 0.97, HALF_H * 0.97);
  fractureRim(stern, 0, -1, HALF_W * 0.96, HALF_H * 0.96);

  // ══ S4-S5 — INTERIOR HERO DETAIL + LIGHTING ═══════════════════════════════
  // The enterable interior taken from S2 greybox to intro-ship density in the
  // WRECKED style: ransacked, sand-drifted, dead. Three compartments walked
  // bow-ward from the mouth — HOLD (z 20-30, cargo) → MID BAY (z 12-20, systems)
  // → CABIN (z 6.2-12, crew). All DECORATION (children of `fore`, local coords,
  // shared materials → merge folds each to one draw); colliders for the few
  // wall-hugging masses are added in the collider section, well clear of the
  // 1.4m centre walk lane + the doorways (the skyfall-walk gate). Fixed draw
  // order — no rand() consumed here (interior layout is deterministic from the
  // hull dims; doorX1/doorX2 already carry the only per-site interior jitter).
  const FLOOR_Y = DECK_Y;               // walk surface (deck top)
  const ROOF_Y = CEIL_Y;                // ceiling underside
  const IWALL = WALL_X;                 // inner wall face x = ±3.1
  // Dead instrument screen — a recessed dark-glass pane in a thin metal bezel
  // (reads as a real MFD, not a painted tile). Faces local +z; rotate to aim.
  const deadScreen = (parent: THREE.Object3D, w: number, h: number, px: number, py: number, pz: number, rx = 0, ry = 0, rz = 0): void => {
    const g = new THREE.Group();
    g.position.set(px, py, pz);
    g.rotation.set(rx, ry, rz);
    parent.add(g);
    dBox(g, _frameMat, w + 0.10, h + 0.10, 0.05, 0, 0, 0);       // bezel
    dBox(g, _deadScreenMat, w, h, 0.07, 0, 0, 0.03);             // dark glass, proud of the bezel
  };

  // ── INTERIOR WALL PANELLING — the bare hull inner skin reads as flat brown
  //    slabs; break it into a plated, framed, cabled compartment (the intro-
  //    ship wall density, wrecked). Both side walls, full interior length:
  //    horizontal seam rails + skirting, vertical frame straps at intervals, a
  //    low conduit run, + a couple wall props. Proud ≥0.10m (rule 7). Decoration.
  for (const s of [-1, 1] as const) {
    const wx = IWALL * s;
    dBox(fore, _frameMat, 0.12, 0.12, 21.0, wx - 0.05 * s, FLOOR_Y + 1.62, 17.5);   // upper seam rail
    dBox(fore, _frameMat, 0.14, 0.14, 21.0, wx - 0.05 * s, FLOOR_Y + 0.12, 17.5);   // skirting rail
    for (let i = 0; i < 8; i++) {
      const fz = 8.0 + i * 2.9;
      dBox(fore, _frameMat, 0.11, ROOF_Y - FLOOR_Y - 0.1, 0.16, wx - 0.05 * s, (ROOF_Y + FLOOR_Y) / 2, fz);  // vertical frame strap
    }
    dCyl(fore, _conduitMat, 0.06, 0.06, 20.0, wx - 0.06 * s, FLOOR_Y + 1.95, 17.5, Math.PI / 2, 0, 0, 6);    // high conduit run (flush: r0.06 lands the crown on the wall)
    for (let k = 0; k < 4; k++) dBox(fore, _frameMat, 0.10, 0.14, 0.10, wx - 0.03 * s, FLOOR_Y + 1.95, 9.5 + k * 5.3);  // conduit standoff clamps (bridge the pipe to the wall)
  }
  // Wall props — a hazard placard + a fire-bottle bracket + a wall junction box.
  dBox(fore, _hazardMat, 0.10, 0.5, 0.7, IWALL - 0.05, FLOOR_Y + 1.7, 21.6);          // hazard placard (starboard hold — rule-7 depth, flush back on the wall)
  dBox(fore, _frameMat, 0.18, 0.55, 0.22, -IWALL + 0.10, FLOOR_Y + 1.05, 18.6);       // fire-bottle bracket body (port mid)
  dCyl(fore, _wireRedMat, 0.11, 0.11, 0.6, -IWALL + 0.16, FLOOR_Y + 1.05, 18.6, 0, 0, 0, 8);  // the red fire bottle in it
  dBox(fore, _intPanelDkMat, 0.14, 0.5, 0.6, IWALL - 0.08, FLOOR_Y + 1.1, 24.6);      // wall junction box (starboard hold)

  // ── HOLD (z 20-30) — the cargo space at the breach mouth ──────────────────
  // Tie-down rails + cleats run the length of both walls (freighter cargo
  // grammar). A cargo rail at chest height, a lower kick rail, and cleats.
  for (const s of [-1, 1] as const) {
    const wx = IWALL * s;
    dBox(fore, _frameMat, 0.10, 0.14, 9.4, wx - 0.06 * s, FLOOR_Y + 1.35, 25.0);   // upper lashing rail
    dBox(fore, _frameMat, 0.10, 0.12, 9.4, wx - 0.06 * s, FLOOR_Y + 0.45, 25.0);   // lower kick rail
    for (let i = 0; i < 5; i++) {
      const cz = 20.9 + i * 2.1;
      dBox(fore, _frameMat, 0.16, 0.22, 0.14, wx - 0.10 * s, FLOOR_Y + 0.90, cz);  // D-ring cleat block
      dBox(fore, _cableMat, 0.05, 0.30, 0.05, wx - 0.14 * s, FLOOR_Y + 0.90, cz, 0.5 * s, 0, 0.3 * s); // dangling lash strap
    }
  }
  // Lashed + spilled cargo crates against both walls (interior-scale, reusing
  // the container-tone palette). Wall-hugging (inner faces ~x2.35); a couple
  // toppled toward the centre but their nearest edge stays > 1.3m off the lane.
  const CR = 1.15;   // interior crate half-extent-ish (~1.1m cube-ish)
  const intCrate = (mat: THREE.Material, px: number, py: number, pz: number, rx: number, ry: number, rz: number, w = CR, h = CR, d = CR): void => {
    const b = dBox(fore, mat, w, h, d, px, py, pz, rx, ry, rz);
    // corner castings (ISO-fitting read) + one corrugation strap per long face
    const hw = w / 2, hh = h / 2, hl = d / 2;
    for (const sx of [-1, 1] as const) for (const sy of [-1, 1] as const) for (const sz of [-1, 1] as const)
      dBox(b, _frameMat, 0.14, 0.14, 0.14, sx * (hw - 0.02), sy * (hh - 0.02), sz * (hl - 0.02));
    for (const s of [-1, 1] as const)
      dBox(b, mat, 0.06, h - 0.24, 0.10, s * (hw + 0.02), 0, 0);
  };
  // Starboard stack (2 stacked + 1 leaning), port scatter (2 toppled).
  intCrate(_cnRust, IWALL - 0.62, FLOOR_Y + 0.575, 22.4, 0, 0.12, 0);        // base crate — sits flush on the deck
  intCrate(_cnBlue, IWALL - 0.66, FLOOR_Y + 1.70, 22.6, 0.05, 0.05, 0.04);   // stacked on the rust crate's top
  intCrate(_cnTan, IWALL - 0.70, FLOOR_Y + 0.58, 25.2, 0, -0.22, 0.10);
  intCrate(_hullDarkMat, -IWALL + 0.66, FLOOR_Y + 0.55, 21.9, 0.06, 0.3, -0.14);
  intCrate(_cnRust, -IWALL + 1.35, FLOOR_Y + 0.50, 24.7, 0.5, 1.1, 0.35, CR * 0.9, CR * 0.9, CR * 0.9);  // spilled, tipped onto its side
  intCrate(_cnBlue, -IWALL + 0.60, FLOOR_Y + 1.62, 21.7, 0.04, -0.1, 0.05);  // stacked
  // Torn cargo net — a slack lattice hanging off the starboard wall over the
  // stack (thin _cableMat bars, a couple snapped short). Reads as ripped mesh.
  {
    const nx = IWALL - 0.16, ny0 = FLOOR_Y + 2.55, nz0 = 23.0;
    for (let i = 0; i < 6; i++) dBox(fore, _cableMat, 0.03, 0.03, 3.2, nx, ny0 - i * 0.34 - (i > 3 ? 0.2 : 0), nz0, 0, 0, 0.04 * (i % 2 ? 1 : -1)); // horizontal strands, sagging
    for (let j = 0; j < 7; j++) { const jz = nz0 - 1.5 + j * 0.5; const cut = j === 2 || j === 5; dBox(fore, _cableMat, 0.03, cut ? 0.9 : 1.85, 0.03, nx, ny0 - (cut ? 1.0 : 0.7), jz, 0.06 * (j - 3) * 0.1, 0, 0); } // vertical strands (2 snapped short)
  }
  // Sand drifted in from the breach — a thin flat wedge on the deck at the
  // mouth, thickest at the lip, feathering bow-ward. FLAT (≤0.14 high), no
  // collider — the deck collider stands under it (walk gate untouched).
  for (let i = 0; i < 4; i++) {
    const sz = 29.4 - i * 1.5;
    const hgt = 0.14 - i * 0.03;
    dBox(fore, _sandDriftMat, (IWALL + 0.5) * 2 - i * 0.6, hgt, 1.5, (i % 2 ? 0.4 : -0.4), FLOOR_Y + hgt / 2, sz);
  }
  // A low sand tongue creeping along the low-list (port) wall base into the hold.
  dBox(fore, _sandDriftMat, 1.1, 0.10, 5.0, -IWALL + 0.55, FLOOR_Y + 0.05, 25.0);
  // Strewn crash debris on the hold deck — a fallen lining panel, a spilled
  // crate lid, a couple of loose chunks — all near the walls, OFF the lane, so
  // the floor reads ransacked, not a bare tan expanse. Decoration (no collider).
  dBox(fore, _intPanelMat, 1.3, 0.07, 0.8, -1.9, FLOOR_Y + 0.05, 27.2, 0.05, 0.4, 0.03);   // fallen lining panel (port)
  dBox(fore, _cnTan, 0.9, 0.10, 0.7, 1.9, FLOOR_Y + 0.06, 26.4, 0.03, -0.6, 0.06);          // spilled crate lid (starboard)
  dBox(fore, _frameMat, 0.35, 0.30, 0.5, 1.7, FLOOR_Y + 0.15, 21.6, 0.2, 0.5, 0.1);         // a knocked-loose fitting
  dBox(fore, _hullDarkMat, 0.6, 0.14, 0.45, -1.8, FLOOR_Y + 0.07, 22.8, 0.04, 0.9, 0.08);   // torn plate chunk
  // ── HOLD extra dressing (M7-R density pass) — all wall-hugging, off-lane, no
  //    collider, shared materials (folds into the merge). Deepens the "working
  //    cargo bay, then it crashed" read without touching the walk lane.
  {
    // Starboard-wall electrical breaker cabinet + conduit drop (flush on x=+IWALL).
    dBox(fore, _intPanelDkMat, 0.16, 0.8, 0.55, IWALL - 0.08, FLOOR_Y + 1.15, 27.4);        // breaker cabinet body (flush)
    dBox(fore, _frameMat, 0.20, 0.62, 0.40, IWALL - 0.10, FLOOR_Y + 1.15, 27.4);            // door frame proud of it
    dBox(fore, _stripDeadMat, 0.22, 0.5, 0.30, IWALL - 0.22, FLOOR_Y + 1.15, 27.4);         // dark inset (door ajar → guts)
    dCyl(fore, _conduitMat, 0.05, 0.05, 1.5, IWALL - 0.12, FLOOR_Y + 0.55, 27.4, 0, 0, 0, 6); // conduit dropping to the deck
    // Coiled hose hung on the port wall (stacked flat rings, dark rubber).
    for (let r = 0; r < 3; r++)
      dCyl(fore, _rubberMat, 0.30, 0.30, 0.09, -IWALL + 0.16, FLOOR_Y + 1.55 - r * 0.10, 26.6, 0, 0, Math.PI / 2, 12); // hose coil rings (flush on wall)
    dBox(fore, _frameMat, 0.14, 0.10, 0.10, -IWALL + 0.10, FLOOR_Y + 1.85, 26.6);           // the coil's wall hook
    // A jerry-can + a small drum knocked over by the starboard wall (deck clutter).
    dBox(fore, _frameMat, 0.32, 0.44, 0.22, 2.05, FLOOR_Y + 0.22, 28.3, 0.05, 0.4, 0.02);   // jerry-can body
    dBox(fore, _frameMat, 0.10, 0.10, 0.08, 2.05, FLOOR_Y + 0.47, 28.3, 0.05, 0.4, 0.02);   // jerry-can cap/handle
    dCyl(fore, _hazardMat, 0.24, 0.24, 0.5, 1.75, FLOOR_Y + 0.24, 27.6, Math.PI / 2, 0.3, 0, 10); // toppled hazard drum on its side
    // A fallen conduit run + rivet-plate debris on the port deck (off-lane).
    dCyl(fore, _conduitMat, 0.07, 0.07, 2.2, -1.85, FLOOR_Y + 0.08, 28.4, 0, 0.5, Math.PI / 2, 6); // bent pipe on the deck
    dBox(fore, _paperMat, 0.4, 0.02, 0.5, -1.6, FLOOR_Y + 0.03, 23.6, 0, 0.3, 0.02);          // a fallen manifest sheet on the deck
  }

  // ── MID BAY (z 12-20) — the systems / machine room ────────────────────────
  // Wall-mounted DEAD CONSOLE BANK on the starboard wall: a cabinet with a row
  // of dead screens + a switch strip + a canted (crash-sprung) panel.
  {
    const cw = 3.4, cx = IWALL - 0.25;   // half-x 0.25 → back face lands ON the wall (was 0.35 = floated 0.10 off)
    dBox(fore, _intPanelMat, 0.5, 1.9, cw, cx, FLOOR_Y + 0.95, 16.0);          // console cabinet body — FLOOR-STANDING (base on the deck; was floating 0.4m)
    dBox(fore, _intPanelDkMat, 0.30, 0.9, cw - 0.3, cx - 0.30, FLOOR_Y + 1.45, 16.0); // recessed instrument face
    for (let i = 0; i < 4; i++) deadScreen(fore, 0.56, 0.44, cx - 0.47, FLOOR_Y + 1.55, 14.7 + i * 0.85, 0, -Math.PI / 2, 0);  // dead MFD screens (bezelled, facing −x)
    for (let i = 0; i < 3; i++) dBox(fore, _frameMat, 0.10, 0.10, 0.9, cx - 0.42, FLOOR_Y + 0.95, 15.0 + i * 0.9);          // switch/breaker strips
    dBox(fore, _frameMat, 0.44, 0.10, cw, cx, FLOOR_Y + 0.06, 16.0);            // cabinet kick-plinth (foots the cabinet on the deck)
    // a sprung panel hanging off the cabinet top, exposing dark guts
    dBox(fore, _intPanelMat, 0.06, 0.7, 1.0, cx - 0.52, FLOOR_Y + 2.05, 15.0, 0, 0, -0.5);
    dBox(fore, _voidMat, 0.10, 0.6, 1.0, cx - 0.30, FLOOR_Y + 2.0, 15.0);      // dark cavity behind it
  }
  // RIPPED-OPEN WALL PANELS on the PORT wall — peeled panels expose conduit +
  // wire bundles + a pipe run behind (the crash tore the lining open).
  {
    const px = -IWALL, wz = 14.4;
    dBox(fore, _voidMat, 0.12, 1.9, 3.2, px + 0.08, FLOOR_Y + 1.15, wz);        // dark exposed cavity (wider/taller — reads as torn-open)
    // peeled panel flaps (canted OUT from the wall — the torn lining) + a
    // pale torn-liner strip at each edge so the tear reads against the dark.
    dBox(fore, _intPanelMat, 0.06, 1.6, 1.0, px + 0.42, FLOOR_Y + 1.15, wz - 1.35, 0, -0.62, 0.18);
    dBox(fore, _intPanelMat, 0.06, 1.0, 0.9, px + 0.36, FLOOR_Y + 1.75, wz + 1.35, 0.22, 0.55, -0.12);
    dBox(fore, _intPanelMat, 0.05, 0.30, 3.0, px + 0.16, FLOOR_Y + 2.05, wz, 0, 0, 0.06);  // torn top liner lip
    // conduit runs across the cavity + a junction box hanging in it
    for (const [dy, m] of [[0.25, _conduitMat], [-0.25, _conduitMat]] as const)
      dCyl(fore, m as THREE.Material, 0.08, 0.08, 3.0, px + 0.22, FLOOR_Y + 1.4 + dy, wz, Math.PI / 2, 0, 0, 7);
    dBox(fore, _intPanelDkMat, 0.22, 0.5, 0.42, px + 0.30, FLOOR_Y + 1.55, wz - 0.4);       // exposed junction box
    // a PROMINENT wire loom spilling OUT of the tear + drooping into the room
    // (2-segment catenary, pulled toward centre so it reads clearly).
    dCyl(fore, _wireRedMat, 0.06, 0.06, 1.0, px + 0.45, FLOOR_Y + 1.25, wz + 0.3, 0.5, 0.2, 0.6, 6);
    dCyl(fore, _wireRedMat, 0.06, 0.06, 0.9, px + 0.95, FLOOR_Y + 0.75, wz + 0.55, 1.15, 0.2, 0.3, 6);
    dCyl(fore, _wireCuMat, 0.05, 0.05, 0.9, px + 0.42, FLOOR_Y + 1.05, wz - 0.4, 0.4, 0, -0.5, 6);
    dCyl(fore, _wireCuMat, 0.05, 0.05, 0.8, px + 0.85, FLOOR_Y + 0.6, wz - 0.55, 1.2, 0, -0.2, 6);
    dBox(fore, _scorchMat, 0.05, 1.1, 1.5, px + 0.12, FLOOR_Y + 2.05, wz - 0.2);  // scorch scar above the tear
  }
  // CEILING CABLE RUNS down the mid bay, a couple HANGING LOOSE (drooped).
  for (const cxi of [-1.7, 0, 1.6] as const)
    dCyl(fore, _cableMat, 0.05, 0.05, 8.0, cxi, ROOF_Y - 0.12, 16.0, Math.PI / 2, 0, 0, 6);   // taut ceiling runs
  // two loose drops (2-segment fake catenary) dangling into the bay, off-lane
  for (const [dx, dz] of [[-1.9, 14.6], [1.7, 18.2]] as const) {
    dCyl(fore, _cableMat, 0.04, 0.04, 1.1, dx, ROOF_Y - 0.55, dz, 0.7, 0, 0.2, 6);
    dCyl(fore, _cableMat, 0.04, 0.04, 0.9, dx + 0.25, ROOF_Y - 1.25, dz + 0.1, 1.25, 0, 0.1, 6);
  }
  // FLOOR HATCH — a recessed access hatch in the deck near the port wall, lid
  // dislodged + canted (reads as a systems crawlway). Off-lane (x ~ -2.0),
  // recess is a dark plate flush IN the deck (no proud lip → no collider).
  {
    const hx = -1.95, hz = 18.6;
    dBox(fore, _frameMat, 1.0, 0.06, 1.0, hx, FLOOR_Y + 0.02, hz);              // hatch frame rim (flush)
    dBox(fore, _voidMat, 0.85, 0.05, 0.85, hx, FLOOR_Y - 0.06, hz);            // dark recess (down into the crawlway)
    dBox(fore, _intPanelDkMat, 0.9, 0.05, 0.9, hx + 0.55, FLOOR_Y + 0.18, hz - 0.3, 0.55, 0.2, 0.1);  // the flipped-up lid, leaning
  }
  // Low pipe run along the port wall base + a valve wheel.
  dCyl(fore, _conduitMat, 0.09, 0.09, 7.5, -IWALL + 0.14, FLOOR_Y + 0.30, 16.0, Math.PI / 2, 0, 0, 8);
  dCyl(fore, _frameMat, 0.22, 0.22, 0.06, -IWALL + 0.30, FLOOR_Y + 0.55, 13.4, 0, 0, Math.PI / 2, 10);   // valve handwheel
  // ── MID BAY extra dressing (M7-R density pass) — machine-room greebles; all
  //    wall-hugging/ceiling, off-lane, no collider, shared materials.
  {
    // Floor-standing equipment rack against the PORT wall aft (flush + on deck).
    dBox(fore, _intPanelDkMat, 0.44, 1.9, 1.3, -IWALL + 0.22, FLOOR_Y + 0.95, 18.4);        // generator/equipment cabinet
    for (let i = 0; i < 3; i++) dBox(fore, _frameMat, 0.10, 0.10, 1.1, -IWALL + 0.42, FLOOR_Y + 0.5 + i * 0.55, 18.4); // cooling-fin bars on its face
    dBox(fore, _frameMat, 0.50, 0.10, 1.34, -IWALL + 0.22, FLOOR_Y + 0.06, 18.4);           // rack kick-plinth (foots on deck)
    dCyl(fore, _cableMat, 0.05, 0.05, 0.8, -IWALL + 0.44, FLOOR_Y + 1.7, 18.7, 0.4, 0, 0.3, 6); // a cable trailing off its top
    // A gauge cluster + valve manifold on the STARBOARD wall flanking the console.
    dBox(fore, _intPanelDkMat, 0.14, 0.6, 0.7, IWALL - 0.08, FLOOR_Y + 1.35, 18.6);          // gauge backplate (flush)
    for (const gz of [-0.18, 0.18] as const) dCyl(fore, _frameMat, 0.11, 0.11, 0.12, IWALL - 0.22, FLOOR_Y + 1.45, 18.6 + gz, 0, 0, Math.PI / 2, 10); // round gauge faces
    dCyl(fore, _frameMat, 0.05, 0.05, 0.9, IWALL - 0.20, FLOOR_Y + 0.9, 18.6, 0, 0, 0, 6);   // gauge feed pipe down to the deck
    // Ceiling DUCT run in the port-ceiling corner (square duct, off-lane high up).
    dBox(fore, _conduitMat, 0.34, 0.30, 7.0, -IWALL + 0.42, ROOF_Y - 0.22, 16.0);            // rectangular duct
    for (let i = 0; i < 4; i++) dBox(fore, _frameMat, 0.42, 0.06, 0.10, -IWALL + 0.42, ROOF_Y - 0.06, 13.2 + i * 1.9); // duct hanger straps to the ceiling
    // A dark spilled-fluid pool on the deck under the torn port wall (flat, no lip).
    dBox(fore, _rubberMat, 1.0, 0.03, 1.4, -1.75, FLOOR_Y + 0.015, 14.6, 0, 0.2, 0);         // oil/coolant puddle (flat sheen)
    // A dropped wrench + a coiled cable on the deck by the starboard wall.
    dBox(fore, _frameMat, 0.07, 0.04, 0.42, 1.8, FLOOR_Y + 0.04, 15.4, 0, 0.7, 0.02);        // dropped wrench
    for (let r = 0; r < 2; r++) dCyl(fore, _cableMat, 0.20, 0.20, 0.06, 1.9, FLOOR_Y + 0.04 + r * 0.06, 17.2, Math.PI / 2, 0, 0, 10); // coiled cable on the deck
  }

  // ── CABIN (z 6.2-12) — the crew / story room ──────────────────────────────
  // 1-2 STRIPPED CREW SEATS facing the bow console. One upright-ish, one
  // dislodged/canted (crash). Seat pan + back + frame + worn restraint stub.
  const crewSeat = (px: number, pz: number, faceYaw: number, tip: number): void => {
    const g = new THREE.Group();
    g.position.set(px, FLOOR_Y, pz);
    g.rotation.set(tip * 0.5, faceYaw, tip, 'YXZ');
    fore.add(g);
    dBox(g, _frameMat, 0.5, 0.42, 0.5, 0, 0.21, 0);            // pedestal (base flush on the deck)
    dBox(g, _seatMat, 0.56, 0.16, 0.54, 0, 0.52, 0);           // seat pan (worn vinyl)
    dBox(g, _seatMat, 0.56, 0.72, 0.16, 0, 0.90, -0.30);       // seat back
    for (const s of [-1, 1] as const) dBox(g, _frameMat, 0.08, 0.20, 0.48, s * 0.30, 0.66, 0.02); // armrest frames
    dBox(g, _cableMat, 0.06, 0.5, 0.05, 0.18, 0.70, 0.10, 0.3, 0, 0.4);  // dangling restraint web stub
    dBox(g, _seatMat, 0.10, 0.10, 0.10, -0.22, 0.55, 0.24);    // buckle plate
  };
  // Placed just bow-ward of the cabin waypoint, seat-BACKS toward the crew
  // console (they face the bow / −z), so the cabin-fwd shot frames a real crew
  // station: two worn chairs at a dead viewscreen console. Off the walk lane.
  crewSeat(1.68, 8.2, Math.PI - 0.10, 0.05);           // starboard seat, facing the console
  crewSeat(-1.72, 8.0, Math.PI + 0.34, 0.26);          // port seat, knocked askew

  // CONTROL CONSOLE / dead instrument panel against the BOW-CLOSURE wall
  // (z 6.2) — the crew station + the S6 focal point. A raked console desk with
  // dead screens + dials; the TOP CENTRE is left clear for the S6 journal/
  // salvage. Flanked by dark instrument stacks.
  {
    const bz = 6.9, deskW = 4.2;
    dBox(fore, _intPanelMat, deskW, 1.0, 0.7, 0, FLOOR_Y + 0.50, bz);            // console desk body — base ON the deck (was floating 0.10m; top held at +0.60)
    dBox(fore, _intPanelDkMat, deskW, 0.5, 0.5, 0, FLOOR_Y + 1.05, bz + 0.18, -0.5, 0, 0); // raked instrument face (tilted up toward crew)
    for (const dx of [-1.5, -0.75, 0.75, 1.5] as const) deadScreen(fore, 0.62, 0.40, dx, FLOOR_Y + 1.12, bz + 0.42, -0.5, 0, 0); // dead readout screens (bezelled; skip centre → S6)
    for (let i = 0; i < 7; i++) dBox(fore, _frameMat, 0.08, 0.08, 0.08, -1.5 + i * 0.5, FLOOR_Y + 1.02, bz + 0.02);  // switch/dial row
    // bow-wall instrument stacks flanking the desk (dark, dead) — FLOOR-STANDING
    for (const s of [-1, 1] as const) {
      dBox(fore, _intPanelDkMat, 0.9, 2.4, 0.4, s * 1.75, FLOOR_Y + 1.2, bz - 0.35);   // base on the deck (was floating 0.4m; top held at +2.0)
      deadScreen(fore, 0.6, 0.5, s * 1.75, FLOOR_Y + 1.9, bz + 0.06);
      dBox(fore, _scorchMat, 0.5, 0.7, 0.04, s * 1.75, FLOOR_Y + 1.0, bz - 0.14);   // scorch below a blown panel
    }
    dBox(fore, _cableMat, 0.05, 0.05, 1.6, 0.9, FLOOR_Y + 1.7, bz + 0.1, 0.9, 0, 0);  // a cable drooping onto the desk
  }
  // WALL LOCKERS — tall thin cabinets against the side walls, a couple ajar.
  for (const [s, aj] of [[-1, 0.0], [1, 0.35]] as const) {
    const wx = IWALL * s, lz = 10.8;
    dBox(fore, _intPanelMat, 0.4, 1.9, 1.2, wx - 0.20 * s, FLOOR_Y + 0.95, lz);       // locker body
    dBox(fore, _intPanelDkMat, 0.06, 1.7, 0.55, wx - 0.42 * s, FLOOR_Y + 0.95, lz - 0.3, 0, aj * s, 0); // door (one ajar → dark gap)
    dBox(fore, _frameMat, 0.05, 0.10, 0.10, wx - 0.44 * s, FLOOR_Y + 0.95, lz - 0.55);  // latch handle
  }
  // PERSONAL EFFECTS — scattered crew life (dressing; S6 owns the journal/loot).
  // A mug + a helmet + a couple datapads, low on the deck / desk corners, all
  // off-lane. Kept OFF the console top-centre (reserved for S6).
  dCyl(fore, _mugMat, 0.06, 0.055, 0.10, -1.9, FLOOR_Y + 0.05, 10.0, 0, 0, 0.35, 8);       // toppled mug on the deck
  dBox(fore, _frameMat, 0.28, 0.24, 0.30, 2.0, FLOOR_Y + 0.12, 8.4, 0.2, 0.6, 0.1);        // a discarded helmet (blocky)
  dBox(fore, _intPanelDkMat, 0.24, 0.24, 0.02, 2.0, FLOOR_Y + 0.13, 8.4, 0.2, 0.6, 0.1);   // helmet visor
  dBox(fore, _deadScreenMat, 0.16, 0.02, 0.24, -1.7, FLOOR_Y + 0.04, 9.2, 0, 0.4, 0.03);   // datapad on the deck
  dBox(fore, _deadScreenMat, 0.15, 0.02, 0.22, 1.4, FLOOR_Y + 1.02, 6.75, -0.05, 0, 0);      // datapad lying ON the console desk top (was buried inside the desk body)
  // ── CABIN extra dressing (M7-R density pass) — the crew's daily-life tells;
  //    wall-hugging/on-deck, off-lane, no collider, shared materials.
  {
    // Starboard wall shelf + a couple items (flush bracket, off-lane).
    dBox(fore, _frameMat, 0.28, 0.06, 1.2, IWALL - 0.16, FLOOR_Y + 1.5, 7.4);                // wall shelf plate (flush)
    for (const s of [-1, 1] as const) dBox(fore, _frameMat, 0.24, 0.20, 0.05, IWALL - 0.16, FLOOR_Y + 1.4, 7.4 + s * 0.5); // shelf brackets
    dCyl(fore, _mugMat, 0.05, 0.045, 0.10, IWALL - 0.18, FLOOR_Y + 1.58, 7.2, 0, 0, 0, 8);   // a mug left on the shelf
    dBox(fore, _paperMat, 0.10, 0.16, 0.24, IWALL - 0.20, FLOOR_Y + 1.61, 7.7);              // a stack of manuals on the shelf
    // A pinned manifest / crew roster on the PORT wall by the locker (flush plate).
    dBox(fore, _paperMat, 0.04, 0.42, 0.32, -IWALL + 0.06, FLOOR_Y + 1.55, 11.4);            // pinned sheet (proud of wall)
    dBox(fore, _paperMat, 0.04, 0.30, 0.26, -IWALL + 0.06, FLOOR_Y + 1.15, 11.7, 0, 0, 0.08); // a second sheet, askew
    // A wall MED / first-aid box on the starboard wall (hazard-marked, flush).
    dBox(fore, _intPanelMat, 0.18, 0.4, 0.34, IWALL - 0.09, FLOOR_Y + 1.15, 9.6);            // med-box body (flush on wall)
    dBox(fore, _hazardMat, 0.10, 0.18, 0.16, IWALL - 0.14, FLOOR_Y + 1.15, 9.6);             // its hazard/cross plate (proud)
    // A coat hook with a hanging rag/jacket on the port wall (worn cloth).
    dBox(fore, _frameMat, 0.10, 0.06, 0.20, -IWALL + 0.08, FLOOR_Y + 1.75, 8.6);             // hook rail (flush)
    dBox(fore, _seatMat, 0.10, 0.55, 0.26, -IWALL + 0.16, FLOOR_Y + 1.35, 8.6, 0.05, 0, 0.04); // hanging jacket
    // On-deck crew effects near the seats (off-lane): a boot + a ration tin.
    dBox(fore, _rubberMat, 0.14, 0.16, 0.30, 2.15, FLOOR_Y + 0.08, 9.4, 0.1, 0.5, 0.05);      // a discarded boot
    dCyl(fore, _frameMat, 0.08, 0.08, 0.10, -2.1, FLOOR_Y + 0.05, 10.6, 0, 0, Math.PI / 2, 10); // a ration tin on its side
    // A small storage bin shoved under the starboard seat corner (off-lane).
    dBox(fore, _intPanelDkMat, 0.46, 0.28, 0.4, 2.2, FLOOR_Y + 0.14, 7.5, 0, 0.2, 0);        // stowage bin
  }

  // ── EMERGENCY STRIP-LIGHTS on the ceiling — a couple failing, a couple dead
  //    (emissive → self-glow with ~no light cost; merge folds them per material).
  const stripBar = (mat: THREE.Material, pz: number, len = 3.0): void => {
    dBox(fore, _stripDeadMat, 0.5, 0.14, len, 0, ROOF_Y - 0.08, pz);     // housing
    dBox(fore, mat, 0.34, 0.06, len - 0.2, 0, ROOF_Y - 0.16, pz);        // the lens (lit or dead)
  };
  stripBar(_stripDeadMat, 25.5);        // HOLD — dead (only the mouth daylight reaches here)
  stripBar(_stripCoolMat, 20.4);        // over door2 — a failing cool tube
  stripBar(_stripRedMat, 16.0);         // MID — the failing red emergency bar
  stripBar(_stripDeadMat, 12.3);        // over door1 — dead
  stripBar(_stripRedMat, 8.8);          // CABIN — failing red

  // ── INTERIOR LIGHTING (S5) — "power's out, sun leaks in through the tear."
  //    Warm daylight floods the HOLD from the breach + falls off bow-ward;
  //    dim failing emergency lamps keep the MID + CABIN dark-but-legible.
  //    Lights are `fore` children → torn down with the chunk. Count kept low
  //    (4) — emissive strips carry the rest of the glow.
  const addLight = (color: number, intensity: number, range: number, lx: number, ly: number, lz: number): void => {
    const pl = new THREE.PointLight(color, intensity, range, 2);
    pl.position.set(lx, ly, lz);
    fore.add(pl);
  };
  addLight(0xffb877, 1.30, 17, 0, 1.8, 28.2);   // MOUTH daylight shaft — warm sun through the breach, floods the hold
  addLight(0xffa860, 0.55, 11, 0, 1.7, 23.0);   // hold fill — the daylight bleeding deeper
  addLight(0x9a3420, 0.55, 9, 0.4, 1.9, 16.2);  // MID — the failing red emergency lamp (co-located w/ the red strip)
  addLight(0x8a2a18, 0.60, 10, 0, 1.7, 8.9);    // CABIN — a last dim red lamp
  // A soft cool bounce fill spanning MID+CABIN so the systems room + crew
  // station stay dark-but-LEGIBLE without a light source the wreck can't have
  // (the player carries none yet — this is faked ambient bounce, kept low).
  addLight(0x52627c, 0.72, 18, 0, 1.55, 10.6);   // cabin+mid cool fill (pulled into the cabin so the aft walls/lockers read)

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
  // ── Interior FURNITURE colliders (S4 — rule 9). Only the large wall-hugging
  //    masses the player shouldn't walk through; every one sits well off the
  //    1.4m centre walk lane + forward of / beside the waypoints, so the
  //    skyfall-walk gate stays clear (verified). Small dressing (debris, net,
  //    cables, effects, sand) is decoration — no collider.
  localCol(0.36, 0.58, 0.40, 1.68, DECK_Y + 0.55, 8.2);    // starboard crew seat
  localCol(0.36, 0.58, 0.40, -1.72, DECK_Y + 0.55, 8.0);   // port crew seat
  localCol(2.10, 0.50, 0.42, 0, DECK_Y + 0.50, 6.9);       // bow crew console desk (base on deck; forward of the cabin waypoint)
  localCol(0.25, 0.95, 1.70, IWALL - 0.25, DECK_Y + 0.95, 16.0);   // mid console bank (starboard wall — flush + floor-standing)
  localCol(0.22, 0.95, 0.62, IWALL - 0.20, DECK_Y + 0.95, 10.8);   // starboard cabin locker
  localCol(0.22, 0.95, 0.62, -(IWALL - 0.20), DECK_Y + 0.95, 10.8); // port cabin locker
  localCol(0.60, 1.15, 0.65, IWALL - 0.62, DECK_Y + 1.10, 22.5);   // starboard hold crate stack
  localCol(0.60, 1.15, 0.65, -(IWALL - 0.60), DECK_Y + 1.10, 21.8); // port hold crate stack
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
  // Bridge castle stands proud of the hull box — its own collider. Height
  // extended (2.0 half, was 1.5) so it also caps the bridgeCap block on top
  // (HALF_H+3.7) — the whole tower is one solid climbable mass (rule 9 sweep).
  const bridgeCol = makeStaticBox(
    world,
    { x: HALF_W * 0.45, y: 2.0, z: 1.9 },
    fore.position.clone().add(new THREE.Vector3(BR_X, HALF_H + 2.0, 6.9).applyQuaternion(foreQuat)),
    foreQuat,
  );
  {
    const b = bridgeCol.parent();
    if (b) bodies.push(b);
  }
  // ── DORSAL CARGO CONTAINERS — a matching rotated cuboid per box (M7-R: the
  //    row on top of the hull had NO collision — the player walked through it).
  //    Each collider composes the fore crash pose with the box's own crash
  //    jitter (foreQuat * boxQuat) so it aligns to the visibly-posed container.
  for (const dc of dorsalCols) {
    const c = makeStaticBox(
      world,
      { x: CN_W / 2, y: CN_H / 2, z: CN_L / 2 },
      fore.position.clone().add(dc.localPos.clone().applyQuaternion(foreQuat)),
      foreQuat.clone().multiply(dc.localQuat),
    );
    const b = c.parent();
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

  // ══ S6 — INTERIOR LOOT: the reward for walking to the bow ═══════════════
  // 2 pry-open salvage panels on the cabin side walls + the pilot's crash-log
  // journal on the bow console. Both parented to `fore` so they inherit the
  // crash pose. A POSITION-SEEDED rng (NOT the main `rand`) drives the loot
  // condition + log text, so adding loot does not perturb the exterior/pose
  // determinism — it's purely additive + still deterministic per site. Both
  // are added AFTER mergeStaticByMaterial so they stay live (interactable).
  const salvage: Salvageable[] = [];
  let journal: Journal | null = null;
  const lootRand = makeRng((Math.abs(Math.round(x * 73.1 + z * 179.3)) % 0x7fffffff) || 1);
  if (opts.salvage) {
    // Starboard cabin-wall panel — face points -X into the room, body recesses
    // +X into the wall (wrapper-Group pattern, mirrors crashedHull/engineBlock).
    const pA = new THREE.Group();
    addAccessPanel(pA, 0, 0, 0, 1, 0, 'fuselage');
    pA.position.set(WALL_X, DECK_Y + 1.25, 10.4);
    pA.rotation.y = -Math.PI / 2;
    fore.add(pA);
    // Port cabin-wall panel — face +X, body recesses -X into the wall.
    const pB = new THREE.Group();
    addAccessPanel(pB, 0, 0, 0, 1, 0, 'fuselage');
    pB.position.set(-WALL_X, DECK_Y + 1.25, 9.2);
    pB.rotation.y = Math.PI / 2;
    fore.add(pB);
    for (const p of [pA, pB]) {
      p.updateWorldMatrix(true, false);
      const w = new THREE.Vector3().setFromMatrixPosition(p.matrixWorld);
      salvage.push(registerSalvageable(opts.salvage, p, 'massive', w, lootRand));
    }
  }
  if (opts.journal) {
    // The pilot's crash log on the bow console top (the story payoff). Built +
    // returned; the CALLER pushes it into ctx.journals (placeJournal itself
    // does not). Its per-call materials are tagged chunkGeo/chunkMat so the
    // chunk teardown disposes them (streamed content — the D292 rule).
    fore.updateMatrixWorld(true);
    const jWorld = new THREE.Vector3(0.4, DECK_Y + 0.86, 7.05).applyMatrix4(fore.matrixWorld);
    journal = placeJournal(
      scene, jWorld, yaw + Math.PI, 'crashed_hull',
      generateCrashLog((lootRand() * 0x7fffffff) >>> 0, 'freighter'),
    );
    fore.attach(journal.mesh);   // reparent under the wreck (preserves world pose) → tears down with the chunk
    journal.mesh.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) { m.userData.chunkGeo = true; m.userData.chunkMat = true; }
    });
  }

  return { group: root, bodies, salvage, journal };
}
