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
import { makeLoftedHull, makeFormerRings, mergeStaticByMaterial, SHIP_SECTION, type LoftStation, type HullCut } from './wreckForms.ts';   // PERF (2026-07-05 profile #2) — static-merge the landmark into per-material draws
import { createRustedHullMaterial } from './hullMaterial.ts';
import { createMetalMaterial } from './metalMaterial.ts';
import { makeStaticBox, makeStaticTrimesh } from '../physics/bodies.ts';
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
// SOLID re-loft (review 2026-07-16): the hull was a hollow single-skin DoubleSide
// silhouette shell with open ends + no exterior collision (verify:solid flagged
// thin/backface/open-end/collision). The lofts are now genuine thick-walled closed
// solids — makeLoftedHull(..., HULL_THICK, solidInner) gives an outer+inner skin +
// closed proud rim lips at every torn end — so the material is FrontSide (a correctly
// wound closed solid never punches a hole to the sky the way the old open shell did).
const HULL_THICK = 0.9;                    // hull wall thickness (leviathan ~22m-beam — heavier plate than Skyfall's 0.7)
const LEVIATHAN_HULL_HEX = 0x362d24;      // deep desaturated brown-grey — clearly below the midday horizon-haze value
const LEVIATHAN_HULL_DARK_HEX = 0x281f18; // the shadowed under-mass / tower — darker still for value depth
const _hullMat = createRustedHullMaterial({
  baseColor: LEVIATHAN_HULL_HEX,
  streakIntensity: 0.8,
  oxDeepStrength: 0.5,
  chalkStrength: 0.06,        // minimal bleach — a high noon sun, not a raking dawn; keep the mass dark
  fleckStrength: 0.1, bareMetalHex: 0x5a4c3a,   // 2026-07-15 (enterable): the default cool flecks read as WHITE SNOW up close — warm + sparse
});
const _hullDarkMat = createRustedHullMaterial({
  baseColor: LEVIATHAN_HULL_DARK_HEX,
  streakIntensity: 0.6,
  fleckStrength: 0.1, bareMetalHex: 0x4c4030,
});
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
const I_MOUTH_Z = 7.5;           // fracture face (the hold's forward end — now a SEALED torn bulkhead, see below)

// ══ THE BREACH — the ONE walk-in entrance (review 2026-07-16) ═══════════════
// The hold used to be entered through the amidships FRACTURE FACE at +Z. It could
// not be: the reared bow is a ~21m-diameter hollow tube hinged AT the fracture and
// pitched up 64°, so its root plane + bore geometrically ENGULF the fracture face.
// Measured on the shipped build — a raycast at eye height from 30m out toward the
// fracture mouth, from 8 compass directions, hit the bow's skin every time
// (3.2/4.7/13.3/16.2/17.7/18.9/19.2/24.8m; 0/8 reached). No pivot height, root
// taper or bore plug fixes that: any 21m tube reared off the fracture covers the
// fracture. Only two things can move — the tuned fin, or the door. The fin is the
// monument (kept byte-identical), so the door moved.
//
// It moved to the STARBOARD flank at the forward hold: the side the step-out gaze
// approaches from, and the one band a reachability sweep proved is genuinely open.
// The sweep matters — it was run at the APERTURE's own height (y≈5.4), not at
// ground+1.6, because whether the bow's skin crosses this flank depends steeply on
// y. Result, "compass directions from 30m out that see this patch of skin first":
//   fracture face (any x)  0/8      z=+4..+8 starboard  2-3/8  (bow skin grazes it)
//   z=-2..-14 starboard    4/8      ← the clean band; z≈-0.5 is its forward end
// So the breach sits at the forward end of the clean band: as close to the break as
// the bow allows, still unmistakably "the tear where the bow snapped away", just
// opening to the side rather than dead ahead. The hull skin is CUT here for real
// (makeLoftedHull's HullCut → a hole with the outer and inner skins welded into one
// 0.9m-thick rim), the interior's starboard wall is cut to match, and a drifted sand
// ramp carries the player from grade up to the deck lip.
// AFT of z≈-1.5 as well as clear of the bow's SKIN: the reared bow's tube does not
// only occlude the fracture from outside, its root also INTRUDES into the hold's
// forward-starboard corner (measured: the hull trimesh sits at local ≈(6.5, 6.6, -1),
// i.e. head height on the walk line). That intrusion predates this change, but a
// breach at z=-0.5 walked the player straight under it. Sitting the tear aft of it
// keeps the whole entrance path in clear air.
const I_BREACH_Z = -3.6;                      // breach centre, local z (forward hold, clear of the bow root)
// SIZE (round 2): 3.4 × 2.8m read as a garage door on a 22m-beam titan — a mouse hole
// you'd never cross a desert for. A tear where a bow the size of a building sheared off
// has to be architectural. 6 × 3.9m fills the flank between the chine and the deck line
// without punching through either.
const I_BREACH_HZ = 2.4;                      // half-length in z → 4.8m clear (fits between the bow root and the z=-7 bulkhead)
const I_BREACH_Y0 = I_DECK_Y;                 // sill = the deck; you walk straight in, no step
const I_BREACH_Y1 = I_DECK_Y + 3.9;           // header → 3.9m clear, stopping under the chine
// The interior wall is cut WIDER than the hull is, in both axes, so the hull's own
// intact skin always overlaps the wall's opening. That is what kills the "thin bright
// gap/slot at the rim" the review saw: there is no sightline that can find the void
// between the hull's inner skin and the interior lining, from any grazing angle.
const I_BREACH_WALL_MARGIN = 0.85;
const LEV_HULL_CUT: HullCut = {
  xSign: 1, yMin: I_BREACH_Y0, yMax: I_BREACH_Y1,
  zMin: I_BREACH_Z - I_BREACH_HZ, zMax: I_BREACH_Z + I_BREACH_HZ,
  // A RAGGED outline — the plain box cut read as a garage door stamped into the
  // plating, not a place a titan tore open. Deterministic (fixed trig, no rng draw,
  // so the monument stays identical every seed). The SILL stays dead flat: it is the
  // floor you walk in over, and a jagged threshold is a trip hazard, not character.
  // The header + both ends jag. Amplitudes stay under I_BREACH_WALL_MARGIN so the
  // interior lining's opening still overlaps the hull's cut everywhere.
  contains: (_x, y, z) => {
    const t = (z - (I_BREACH_Z - I_BREACH_HZ)) / (2 * I_BREACH_HZ);          // 0..1 along the tear
    const top = I_BREACH_Y1 - 0.40 + 0.40 * Math.sin(t * 8.1 + 0.7) + 0.20 * Math.sin(t * 17.3 + 2.1);
    const u = (y - I_BREACH_Y0) / (I_BREACH_Y1 - I_BREACH_Y0);               // 0..1 up the tear
    const halfZ = I_BREACH_HZ - 0.30 + 0.26 * Math.sin(u * 9.4 + 1.3) + 0.12 * Math.sin(u * 21.0);
    return y < top && Math.abs(z - I_BREACH_Z) < halfZ;
  },
};
// ── THE SAND DRIFT / RAMP. The hull lies canted, so this flank stands ~3.8m proud of
//    grade at the breach (the port side is buried instead). The drift banked up into
//    the tear is what makes the door usable — and it is the flight recorder's own
//    image: "it came up through the breach like water and would not stop."
//
// DERIVED FROM THE REAL DUNE (review 2026-07-16). Round 1 hand-fitted this to a
// LINEAR approximation of the terrain ("the dune falls away ≈0.24m per metre
// outboard") and built it as a rigid tilted BOX plus a lofted tongue. Both halves of
// that were wrong, and a terrain sample proved it: the dune here does not fall at all
// — it is flat to ≈0.01 m/m out to lx≈18.5 and then RISES. So the slab's buried tail
// stood proud of the sand as a low ridge, and a player-radius sphere walking in off
// the dune clipped the slab's FLANK (measured: blocked at local [18,-0.1,-7.1] on the
// ramp box) instead of ever reaching the door. Hand-fitting a rigid box to a dune is
// the bug; the geometry has to be SAMPLED from terrain.heightAt (the same source
// makeSandMound already uses) so the drift is proud where the dune is low and vanishes
// where the dune rises. See buildLeviathanInterior's drift block + LevSite below.
//
// THRESH_OUT_X is the load-bearing number: the threshold PLATE's outboard face. The
// drift's crest must start EXACTLY there, because a crest that starts inboard of the
// plate is already below the plate's top by the time it clears it, which drops the
// walking sphere low enough to clip the plate's outboard corner — the measured
// az337 failure (blocked at local [11.2,4.3,-3.5]; sphere-to-corner 0.316 < r 0.35).
// It must also clear the hull's OUTER skin (halfW ≈ 10.65-10.86 across the breach
// z-band; the cut only removes skin from y=I_BREACH_Y0 up, so the plating BELOW the
// sill is intact) — 11.1 lands 0.24-0.45m proud of it.
const THRESH_OUT_X = 11.1;        // the breach threshold plate's outboard face
const RAMP_TOP_X = THRESH_OUT_X;  // …and the drift crest's break point — FLUSH, by construction
const RAMP_TAN = 0.58;            // ≈30° crest descent per metre outboard (inside the controller's 50° climb limit)
const RAMP_HALF_Z = I_BREACH_HZ + I_BREACH_WALL_MARGIN;   // 3.25 → the full-height WALK band, matching the wall's cut
// The drift's inboard edge is buried INSIDE the hull's 0.9m wall (outer skin ≈10.9,
// inner ≈10.0), so the sand emerges from the plating instead of leaving a slot
// between the drift and the skin. Only the part framed by the cut is ever seen.
const DRIFT_IN_X = 10.2;
// The crest rides 8cm PROUD of the threshold plate: sand spilled over the torn deck
// (the same "came up through the breach" read as the interior deck tongue). It is not
// decoration — it is what holds the walking sphere clear of the plate's corner, and it
// keeps the two surfaces off a shared plane so they cannot z-fight.
const DRIFT_CREST_LIFT = 0.08;
const DRIFT_REPOSE_TAN = 0.72;    // ≈36° flank — sand's angle of repose, so the drift falls to grade instead of ending in a wall
const DRIFT_HALF_Z = 9.5;         // sampling half-width; the flanks self-terminate where they meet the dune
const I_END_Z = -34;             // aft end wall
const I_DOOR_HW = 0.95;          // doorway half-width (1.9m clear)
const I_DOOR_TOP = I_DECK_Y + 2.5;   // doorway clear height 2.5m
const I_BULK_A = -7;             // HOLD↔MID bulkhead
const I_BULK_B = -21;            // MID↔AFT bulkhead
const I_DOORX_A = 1.6;           // door offsets (fixed — deterministic monument)
const I_DOORX_B = -1.5;
const I_WALL_T = 0.5;            // interior wall/deck/ceiling plate thickness (rule 7)

// ── THE MONUMENT'S POSE. Hoisted to module scope (was inline in place()) because the
//    DRIFT is now sampled from the real dune at BUILD time, which means the builder
//    has to know where its local frame lands in the world before the group is posed.
//    One definition, used by buildLeviathanMesh (sampling), place() (posing) and the
//    collider composition — they cannot drift apart.
const GROUP_PITCH = 0.08;                  // a crashed-and-settled list
const GROUP_ROLL = 0.05;
const BURY = HULL_HALF_H * 0.22;           // sink only the keel — the long body stays proud of the horizon

/** The monument's world pose + a terrain sampler expressed in the group's LOCAL frame.
 *  The drift geometry is derived from the REAL dune, and `makeSandMound` shows the
 *  shape of the idea (sample terrain.heightAt, place to it) — but a mound sits on a
 *  world-axis column, whereas this hull is YAWED, PITCHED and ROLLED, so a local
 *  column is not a world column and "the terrain height at this local (x,z)" needs
 *  solving, not looking up. */
interface LevSite {
  matrix: THREE.Matrix4;
  /** The local y at which the local column (lx, ·, lz) meets the dune surface. */
  terrainLocalY(lx: number, lz: number): number;
}
function makeLevSite(terrain: Terrain): LevSite {
  const gy = terrain.heightAt(LANDMARK_X, LANDMARK_Z);
  const matrix = new THREE.Matrix4().compose(
    new THREE.Vector3(LANDMARK_X, gy - BURY, LANDMARK_Z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(GROUP_PITCH, HULL_YAW, GROUP_ROLL, 'XYZ')),
    new THREE.Vector3(1, 1, 1),
  );
  const v = new THREE.Vector3();
  return {
    matrix,
    terrainLocalY(lx, lz) {
      // Fixed-point solve: raising local y by d raises world y by ≈cos(list)·d, and
      // this monument's list is ~5°, so the iteration contracts hard (converges to
      // <1mm in ~3 passes). It also re-samples heightAt each pass because tilting the
      // column moves it across the dune in x/z too, which a one-shot lookup misses.
      let ly = 0;
      for (let i = 0; i < 5; i++) {
        v.set(lx, ly, lz).applyMatrix4(matrix);
        ly += terrain.heightAt(v.x, v.z) - v.y;
      }
      return ly;
    },
  };
}

let _group: THREE.Group | null = null;
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

/** A solid CLOSED section-plug that seals a lofted BORE across `zMid` (bow-local),
 *  so a decorative reared tube reads solid instead of a see-through hollow pipe
 *  (review 2026-07-16 backface: the bow's open bore showed its interior from below).
 *  It is a short closed slab shaped to the interpolated hull SECTION at `zMid` (sized
 *  to the INNER bore so it fills the hole flush inside the skin): a front cap (+Z), a
 *  back cap (-Z), and a rim loft between — a genuinely closed solid (no boundary
 *  edges → no open-end flag, no back-faces). Placed UP the bore, clear of the mouth. */
function borePlug(stations: LoftStation[], zMid: number, mat: THREE.Material): THREE.Mesh {
  // Interpolate the section at zMid.
  let a = stations[0], b = stations[stations.length - 1];
  for (let i = 0; i < stations.length - 1; i++) if (zMid >= stations[i].z && zMid <= stations[i + 1].z) { a = stations[i]; b = stations[i + 1]; }
  const t = b.z === a.z ? 0 : (zMid - a.z) / (b.z - a.z);
  const hw = Math.max(0.1, (a.halfW + (b.halfW - a.halfW) * t) - HULL_THICK);
  const hh = Math.max(0.1, (a.halfH + (b.halfH - a.halfH) * t) - HULL_THICK);
  const cy = (a.cy ?? 0) + ((b.cy ?? 0) - (a.cy ?? 0)) * t;
  const N = SHIP_SECTION.length;
  const zF = zMid + 0.4, zB = zMid - 0.4;
  const ringAt = (z: number): THREE.Vector3[] => SHIP_SECTION.map(([x, y]) => new THREE.Vector3(x * hw, cy + y * hh, z));
  const rF = ringAt(zF), rB = ringAt(zB);
  const cF = new THREE.Vector3(0, cy, zF), cB = new THREE.Vector3(0, cy, zB);
  const pos: number[] = [];
  const push = (v: THREE.Vector3): void => { pos.push(v.x, v.y, v.z); };
  for (let k = 0; k < N; k++) {
    const k2 = (k + 1) % N;
    push(cF); push(rF[k]); push(rF[k2]);                                   // front cap (+Z)
    push(cB); push(rB[k2]); push(rB[k]);                                   // back cap (-Z)
    push(rB[k]); push(rF[k2]); push(rF[k]); push(rB[k]); push(rB[k2]); push(rF[k2]);   // rim band (radially outward)
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, mat);
}

// ── AFT MASS stations (module scope: the bow's collider trim needs to know where the
//    aft hull's skin is — see insideAftHull below).
const AFT_STATIONS: LoftStation[] = [
  { z: -64, halfW: HULL_HALF_W * 0.30, halfH: HULL_HALF_H * 0.42, cy: 1.6 },  // stern transom
  { z: -50, halfW: HULL_HALF_W * 0.66, halfH: HULL_HALF_H * 0.66, cy: 0.9 },
  { z: -34, halfW: HULL_HALF_W * 0.92, halfH: HULL_HALF_H * 0.86, cy: 0.4 },
  { z: -16, halfW: HULL_HALF_W * 1.0,  halfH: HULL_HALF_H * 1.0,  cy: 0.1 },   // fat midships
  { z: 0,   halfW: HULL_HALF_W * 0.98, halfH: HULL_HALF_H * 1.0,  cy: 0.0 },
  { z: 8,   halfW: HULL_HALF_W * 0.9,  halfH: HULL_HALF_H * 0.96, cy: 0.1 },   // fracture face
];

/** Is a GROUP-LOCAL point inside the aft hull's outer skin?
 *
 *  This is the trim region for the reared bow's collider, and it is chosen because it
 *  is the region that is PROVABLY invisible: anything inside the aft mass's skin
 *  cannot render, and the aft hull's own trimesh already carries every visible surface
 *  there — so dropping the bow's triangles inside it cannot open a collision gap the
 *  player could ever reach. Two hand-fitted boxes were tried first and both leaked
 *  (the second excluded y < deck-0.2, but the bow's root passes DOWN THROUGH the deck,
 *  so those triangles' centroids fell under the box and their tops kept intruding at
 *  0.44m headroom). Testing against the real hull section instead of a guessed box
 *  removes the guess. */
function insideAftHull(lx: number, ly: number, lz: number): boolean {
  if (lz < AFT_STATIONS[0].z || lz > AFT_STATIONS[AFT_STATIONS.length - 1].z) return false;
  let a = AFT_STATIONS[0], b = AFT_STATIONS[AFT_STATIONS.length - 1];
  for (let i = 0; i < AFT_STATIONS.length - 1; i++) if (lz >= AFT_STATIONS[i].z && lz <= AFT_STATIONS[i + 1].z) { a = AFT_STATIONS[i]; b = AFT_STATIONS[i + 1]; }
  const t = b.z === a.z ? 0 : (lz - a.z) / (b.z - a.z);
  const halfW = a.halfW + (b.halfW - a.halfW) * t;
  const halfH = a.halfH + (b.halfH - a.halfH) * t;
  const cy = (a.cy ?? 0) + ((b.cy ?? 0) - (a.cy ?? 0)) * t;
  // Point-in-polygon against the hull's real SHIP_SECTION profile (ray crossing).
  const px = lx / halfW, py = (ly - cy) / halfH;
  let inside = false;
  for (let i = 0, j = SHIP_SECTION.length - 1; i < SHIP_SECTION.length; j = i++) {
    const [xi, yi] = SHIP_SECTION[i], [xj, yj] = SHIP_SECTION[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Subdivide a station list so no gap below `zMax` exceeds `maxStep`, interpolating
 *  LINEARLY through the ORIGINAL knots — so the lofted surface is bit-for-bit the same
 *  shape and only its TESSELLATION changes (the same trick makeLoftedHull already uses
 *  to resample around a cut). The silhouette is untouched by construction.
 *
 *  WHY (review 2026-07-16): the bow's collider trim drops triangles whose centroid
 *  lands inside the hold, but the bow's native stations are 18m apart — 384 triangles
 *  for a 62m loft — so a single triangle runs from the buried root ring right up the
 *  reared tube. Its centroid sits far outside the hold while the triangle itself
 *  slices through it, which is why trimming 31/384 tris left the invisible wall
 *  standing. Refining the ROOT (and only the root — the prow stays cheap) makes the
 *  triangles there small enough for the centroid to mean what the trim assumes. */
function refineStations(stations: LoftStation[], maxStep: number, zMax: number): LoftStation[] {
  const at = (z: number): LoftStation => {
    let a = stations[0], b = stations[stations.length - 1];
    for (let i = 0; i < stations.length - 1; i++) if (z >= stations[i].z && z <= stations[i + 1].z) { a = stations[i]; b = stations[i + 1]; }
    const t = b.z === a.z ? 0 : (z - a.z) / (b.z - a.z);
    return {
      z,
      halfW: a.halfW + (b.halfW - a.halfW) * t,
      halfH: a.halfH + (b.halfH - a.halfH) * t,
      cy: (a.cy ?? 0) + ((b.cy ?? 0) - (a.cy ?? 0)) * t,
    };
  };
  const zs = new Set<number>(stations.map((s) => s.z));
  for (let z = stations[0].z; z < zMax; z += maxStep) zs.add(z);
  return [...zs].sort((p, q) => p - q).map(at);
}

/** Build the leviathan mesh in LOCAL space (long-axis +Z, y=0 = keel-ish),
 *  BEFORE the world tilt/burial transform is applied by placeLeviathanLandmark. */
function buildLeviathanMesh(rand: () => number, site: LevSite, terrain: Terrain): THREE.Group {
  const g = new THREE.Group();

  // ── AFT MASS — the bulk of the hull: a LONG low body lying broadside (the "beached
  //    leviathan" belly). Lofted from the stern transom to the amidships FRACTURE face
  //    at z~+8. Kept proud of the sand so the whole length reads on the horizon.
  const aftStations = AFT_STATIONS;
  // SOLID re-loft: thick outer+inner skin, solidInner rim lips close the stern
  // transom + the fracture cut edge. hullCollide → the exterior-hull trimesh
  // collider (megaWreck/Skyfall D189 pattern) is baked from this real surface.
  // LEV_HULL_CUT punches the real walk-in breach through the starboard flank; the
  // trimesh is baked from THIS surface, so the hole is a hole to collision too —
  // the visual and the collider cannot disagree about the doorway (rule 9).
  const aft = makeLoftedHull(aftStations, _hullMat, HULL_THICK, true, LEV_HULL_CUT);
  aft.userData.hullCollide = true;
  g.add(aft);
  // Hoist the cut's DECLARED opening onto the group: mergeStaticByMaterial builds
  // fresh meshes and does not carry source userData across, so the declaration would
  // die in the merge. The loft sits at identity inside the group, so the group's
  // matrixWorld is the correct transform for it. verify:solid reads this to (a) excuse
  // the entrance from the open-end detector and (b) aim its walk-in probe.
  g.userData.intendedOpening = aft.userData.intendedOpening;

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
  // Refine the ROOT stations (shape identical — see refineStations) so the collider
  // trim below can resolve the hold's boundary; the prow keeps its cheap 16m stations.
  const bow = makeLoftedHull(refineStations(bowStations, 1.5, 26), _hullMat, HULL_THICK, true);
  bow.userData.hullCollide = true;
  // The reared bow's ROOT swings back down INSIDE the aft hull (a 64° pitch about a
  // hinge at z=+8 throws the top of the ~21m root ring to local ≈(6.5,6.6,-1) — head
  // height, on the walk line through the hold). The skin there is buried inside the
  // aft mass and never renders, but its TRIMESH was a solid invisible wall in the
  // middle of the walkable hold. Trim those triangles at bake time (see place()).
  bow.userData.trimInsideHold = true;
  const bowPivot = new THREE.Group();
  bowPivot.add(bow);
  // SEAL THE DECOY (review 2026-07-16). The reared bow is a decorative thick TUBE.
  // Its ROOT BORE emerges from the sand right where the hull breaks, so it read as a
  // big arched opening — the "entrance" the reviewer could see and walk toward — but
  // it leads nowhere: 8m up a slanted 21m pipe to a plug. The earlier pass could not
  // cap it at the root because the root plane sat over the (then) walk-in mouth. Now
  // the entrance is the starboard breach, so the bore can be plugged at the ROOT: the
  // fin becomes a closed solid and there is exactly ONE opening on this wreck that
  // looks like a way in, which is also the one that is. The root plug sits inside the
  // aft hull's forward mass (invisible), so the fin's silhouette is untouched.
  bowPivot.add(borePlug(bowStations, 0.6, _hullDarkMat));    // ROOT plug — kills the decoy arch
  bowPivot.add(borePlug(bowStations, 50.0, _hullDarkMat));   // upper plug near the prow tip
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
  buildLeviathanInterior(g, site, terrain);

  // Mark ALL of it as decoration / noCollider (structural collision is the
  // exterior-hull trimesh + the interior box set, both added in place()). The
  // hullCollide tag on the two lofts survives this (it drives the trimesh bake).
  g.traverse((o) => {
    o.userData.isWreckDecoration = true;
    o.userData.noCollider = true;
    const m = o as THREE.Mesh;
    if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; }
  });
  // NOTE: the static-merge that folds the interior/hull to per-material draws now
  // runs in placeLeviathanLandmark AFTER the exterior-hull trimesh colliders are
  // baked from the posed loft surfaces (the merge disposes that geometry, so it
  // MUST run after — the Skyfall D189/review-2026-07-16 ordering).
  void rand;   // reserved for future per-instance variation; determinism handle
  return g;
}

/** Build the walkable titan's-hold interior into the aft belly (LOCAL frame,
 *  long-axis +Z; DECK top at I_DECK_Y). All shared materials so the merge folds
 *  it to per-material draws; point lights are group children (torn down with the
 *  group). NO colliders here — they need the world pose (added in place()).
 *  Deterministic layout (a fixed monument). Rule 7: every surface is a solid box
 *  with real thickness; no single-sided flats. */
function buildLeviathanInterior(g: THREE.Group, site: LevSite, terrain: Terrain): void {
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
  // Side walls (full length, deck→above ceiling, real thickness). PORT is one plate;
  // STARBOARD is cut for the breach into four plates (aft / fore / header / sill
  // strip). Its opening is deliberately LARGER than the hull's hole by
  // I_BREACH_WALL_MARGIN on every side, so the hull's intact skin overlaps the wall's
  // cut all the way round and no sightline can find the void between them.
  dBox(_intWallMat, I_WALL_T, wallH, spanZ + 1.0, -(I_WALL_X + I_WALL_T / 2), wallCY, midZ + 0.3);
  {
    const wx = I_WALL_X + I_WALL_T / 2;
    const bz0 = I_BREACH_Z - I_BREACH_HZ - I_BREACH_WALL_MARGIN;   // wall opening, z
    const bz1 = I_BREACH_Z + I_BREACH_HZ + I_BREACH_WALL_MARGIN;
    const by0 = I_BREACH_Y0 - I_BREACH_WALL_MARGIN;                // wall opening, y
    const by1 = I_BREACH_Y1 + I_BREACH_WALL_MARGIN;
    const wTop = wallCY + wallH / 2, wBot = wallCY - wallH / 2;
    const zFwd = midZ + 0.3 + (spanZ + 1.0) / 2, zAft = midZ + 0.3 - (spanZ + 1.0) / 2;
    // Skip any segment that computes to a non-positive extent. The sill strip does:
    // the wall's bottom edge (3.3) sits ABOVE the breach's cut-margin bottom (3.15),
    // so there is no strip to build — the deck and the threshold plate already seal
    // below the sill. Building it anyway yields a NEGATIVE-height BoxGeometry and, in
    // place(), a negative-half-extent Rapier box: an inverted, degenerate collider
    // that flung the walk probe's capsule out through the deck and onto the hull's
    // roof. Guard both segments rather than hand-tune the numbers so it stays correct
    // if the breach is ever resized.
    const seg = (h: number, d: number, py: number, pz: number): void => {
      if (h > 0.01 && d > 0.01) dBox(_intWallMat, I_WALL_T, h, d, wx, py, pz);
    };
    seg(wallH, bz0 - zAft, wallCY, (zAft + bz0) / 2);              // aft of the breach (full height)
    seg(wallH, zFwd - bz1, wallCY, (bz1 + zFwd) / 2);              // fore of the breach (full height)
    seg(wTop - by1, bz1 - bz0, (by1 + wTop) / 2, (bz0 + bz1) / 2); // header above the opening
    seg(by0 - wBot, bz1 - bz0, (wBot + by0) / 2, (bz0 + bz1) / 2); // sill strip (usually degenerate → skipped)
  }
  // Ceiling / overhead deckhead — solid, caps the upward view.
  dBox(_intWallDkMat, (I_WALL_X + 0.6) * 2, I_WALL_T, spanZ + 1.0, 0, I_CEIL_Y + I_WALL_T / 2, midZ + 0.3);
  // Aft end wall (closes the hold; hides the sealed stern mass).
  dBox(_intWallMat, (I_WALL_X + 0.6) * 2, wallH, I_WALL_T, 0, wallCY, I_END_Z - I_WALL_T / 2);
  // Under-deck skirt at the fracture (seals the buried void below the deck lip).
  dBox(_voidMat, (I_WALL_X + 0.6) * 2, 3.2, 0.4, 0, I_DECK_Y - 1.7, I_MOUTH_Z + 0.7);

  // ── FRACTURE BULKHEAD — the hold's forward end, now SEALED (review 2026-07-16).
  //    This was the walk-in mouth: a section-shaped collar with a walk aperture in
  //    it. It could never be walked into — the reared bow's 21m bore encloses this
  //    whole face (see the I_BREACH block above) — so the aperture only served as a
  //    lit arch glimpsed from inside the bow's bore: an entrance that wasn't one.
  //    It is now a SOLID full-section plate: the torn bulkhead where the bow sheared
  //    away, backing the exposed former rings. From the hold you read a thick dark
  //    cut face at the break, not a false way out. (Winding mirrors makeLoftedHull.)
  {
    const outHW = HULL_HALF_W * 0.9, outHH = HULL_HALF_H * 0.96, ocy = 0.1;   // aft loft z≈+8 station
    const zFront = I_MOUTH_Z + 1.1;    // proud of the outer skin (occludes the loft's cut edge)
    const zBack = I_MOUTH_Z - 0.1;     // 1.2m of real plate depth; clear of the breach at z≤6.7
    const N = SHIP_SECTION.length;
    const ring = (z: number): THREE.Vector3[] => SHIP_SECTION.map(([sx, sy]) => new THREE.Vector3(sx * outHW, ocy + sy * outHH, z));
    const oF = ring(zFront), oB = ring(zBack);
    const cF = new THREE.Vector3(0, ocy, zFront), cB = new THREE.Vector3(0, ocy, zBack);
    const pos: number[] = [];
    const push = (v: THREE.Vector3): void => { pos.push(v.x, v.y, v.z); };
    for (let k = 0; k < N; k++) {
      const k2 = (k + 1) % N;
      push(oB[k]); push(oF[k2]); push(oF[k]); push(oB[k]); push(oB[k2]); push(oF[k2]);   // rim band (radially OUT)
      push(cF); push(oF[k]); push(oF[k2]);                                               // front face (+Z, toward the bow)
      push(cB); push(oB[k2]); push(oB[k]);                                               // back face (-Z, into the hold)
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.computeVertexNormals();
    g.add(new THREE.Mesh(geo, _hullDarkMat));
  }

  // ── BREACH THRESHOLD — the walk-in floor. The deck plate stops at x=±8.6 but the
  //    hull skin is out at x≈10.2, so without this the sill would be a hole into the
  //    under-deck void. One solid plate carries the deck out THROUGH the cut to the
  //    skin, its top flush with the deck (no lip to trip on), and it seals the void
  //    under the opening. Reaching past the skin is deliberate: the small proud stub
  //    reads as the torn deck plate bent out of the tear, and the sand ramp buries it.
  {
    const tz0 = I_BREACH_Z - I_BREACH_HZ - I_BREACH_WALL_MARGIN;
    const tz1 = I_BREACH_Z + I_BREACH_HZ + I_BREACH_WALL_MARGIN;
    dBox(_intFloorMat, THRESH_OUT_X - (I_WALL_X - 0.4), 0.7, tz1 - tz0,
      ((I_WALL_X - 0.4) + THRESH_OUT_X) / 2, I_DECK_Y - 0.35, (tz0 + tz1) / 2);
    // Torn plate lips fore + aft of the opening, biting into the sand ramp.
    for (const s of [-1, 1] as const) dBox(_frameMat, 2.0, 0.16, 0.5, 9.5, I_DECK_Y + 0.06, I_BREACH_Z + s * (I_BREACH_HZ + 0.2), 0, 0, s * 0.05);
    // ── THE SAND DRIFT (visible AND walkable) — a HEIGHTFIELD SAMPLED FROM THE REAL
    //    DUNE. Rounds 1-2 built this as a lofted tongue over a tilted box collider,
    //    both hand-fitted to a straight-line guess at the terrain. That is what made
    //    the two gates trade off: the guess is wrong (the dune here is flat, then
    //    rises), so the tongue's buried tail stood proud as a ridge you clipped, and
    //    the crest started inboard of the threshold plate so you clipped that too.
    //
    //    The shape is now DERIVED, not fitted:
    //      surf  = the crest line (flat over the plate, then falling at RAMP_TAN),
    //              minus a repose-angle flank falloff outside the walk band
    //      top   = smax(terrainLocalY, surf)  ← the drift only exists where it is
    //              PROUD of the dune; everywhere else it collapses onto the sand
    //      bottom= terrainLocalY - 0.9        ← a real buried skirt (rule 7 thickness)
    //
    //    The max is the whole trick, and it is what a hand-fit cannot do: the drift
    //    self-terminates at the toe and at both flanks, with zero thickness exactly
    //    where it meets grade — so there is no edge, ledge or ridge to clip ANYWHERE,
    //    at any dune shape. The collider is a trimesh baked from this same surface
    //    (see place()), so what you climb is literally what you see (rule 9).
    //
    //    It is a SMOOTH max, though: a hard max() leaves a concave CREASE where the
    //    flank meets the dune, and a player-radius sphere walking the sand next to the
    //    drift catches on it (measured — az23/az45 blocked exactly on that crease, at
    //    the one point where surf ≈ terrain). smax rounds the junction over ~0.55m and
    //    is exact beyond it, so the drift still vanishes into the dune rather than
    //    riding 0.25m proud of the whole desert. Sand feathering into sand does not
    //    have a crease anyway — this reads better AND walks better.
    /** max(a,b), but rounded over a band of `k` — exact once they differ by ≥ k. */
    const smax = (a: number, b: number, k: number): number => {
      const h = Math.min(1, Math.max(0, 0.5 + (0.5 * (a - b)) / k));
      return b + (a - b) * h + k * h * (1 - h);
    };
    const surfY = (lx: number, lz: number): number => {
      const crest = I_DECK_Y + DRIFT_CREST_LIFT - Math.max(0, lx - RAMP_TOP_X) * RAMP_TAN;
      // SOFT SHOULDER (round 2): a hard max(0, |dz|-band) gave the drift a dead-flat
      // 6.5m plateau that broke to a straight repose plane at a knife edge — it read as
      // a poured-concrete pyramid, not sand. Rounding the shoulder over ~1.4m costs
      // nothing at the doorway (at the cut's own ±2.4m the drop is under 4cm, so the
      // threshold stays flush) and everything outside it crowns like a real bank.
      const flank = smax(Math.abs(lz - I_BREACH_Z) - RAMP_HALF_Z, 0, 1.4) * DRIFT_REPOSE_TAN;
      return crest - flank;
    };
    /** Deterministic dune wobble (no rng draw — the monument stays seed-identical).
     *  Amplitude/frequency are deliberately small + low: the crest is a WALKING
     *  surface, and the probe sphere can only stand on ≲42°, of which the crest's own
     *  30° descent already spends most. 0.14m at ~0.9 rad/m adds ≈0.13 of gradient →
     *  ~35° worst case, which keeps the climb honest while killing the flat-facet read.
     *  Faded to zero at the sill (the threshold must stay flush) and wherever the drift
     *  meets grade (so it cannot lift a lip out of the open sand). */
    const wobble = (lx: number, lz: number, proud: number): number => {
      const a = Math.sin(lx * 0.45 + lz * 0.38) * 0.55
        + Math.sin(lx * 0.9 - lz * 0.72 + 2.1) * 0.3
        + Math.sin(lz * 0.85 + 1.3) * 0.25;
      const offSill = Math.min(1, Math.max(0, (lx - RAMP_TOP_X - 0.7) / 2.2));
      const offGrade = Math.min(1, Math.max(0, proud / 0.7));
      return a * 0.14 * offSill * offGrade;
    };
    // THE TOE — sampled, not assumed. March the crest line outboard until it finally
    // sinks under the real dune; that point (plus a margin so the last stations are
    // buried) is where the drift ends. Round 1 hard-coded RAMP_RUN=11.1 from the
    // linear guess; the real answer here is ≈7 shorter, and it changes if the breach
    // ever moves — which is exactly the coupling that kept breaking these gates.
    let toeX = RAMP_TOP_X + 3;
    for (let lx = RAMP_TOP_X; lx <= RAMP_TOP_X + 26; lx += 0.25) {
      if (surfY(lx, I_BREACH_Z) > site.terrainLocalY(lx, I_BREACH_Z)) toeX = lx + 1.2;
    }
    {
      const NX = 22, NZ = 36;
      const gx = (i: number): number => DRIFT_IN_X + (toeX - DRIFT_IN_X) * (i / (NX - 1));
      const gz = (k: number): number => I_BREACH_Z - DRIFT_HALF_Z + 2 * DRIFT_HALF_Z * (k / (NZ - 1));
      const terr: number[][] = [], top: number[][] = [];
      for (let i = 0; i < NX; i++) {
        terr[i] = []; top[i] = [];
        for (let k = 0; k < NZ; k++) {
          const t = site.terrainLocalY(gx(i), gz(k));
          terr[i][k] = t;
          const s = smax(surfY(gx(i), gz(k)), t, 0.55);
          top[i][k] = s + wobble(gx(i), gz(k), s - t);
        }
      }
      const pos: number[] = [];
      const push = (x: number, y: number, z: number): void => { pos.push(x, y, z); };
      const T = (i: number, k: number): [number, number, number] => [gx(i), top[i][k], gz(k)];
      const B = (i: number, k: number): [number, number, number] => [gx(i), terr[i][k] - 0.9, gz(k)];
      const quad = (a: number[], b: number[], c: number[], d: number[]): void => {
        push(a[0], a[1], a[2]); push(b[0], b[1], b[2]); push(c[0], c[1], c[2]);
        push(a[0], a[1], a[2]); push(c[0], c[1], c[2]); push(d[0], d[1], d[2]);
      };
      for (let i = 0; i < NX - 1; i++) for (let k = 0; k < NZ - 1; k++) {
        quad(T(i, k), T(i, k + 1), T(i + 1, k + 1), T(i + 1, k));       // top surface (up)
        quad(B(i, k), B(i + 1, k), B(i + 1, k + 1), B(i, k + 1));       // buried underside (down)
      }
      for (let i = 0; i < NX - 1; i++) {                                 // z-end skirts (buried)
        quad(T(i, 0), T(i + 1, 0), B(i + 1, 0), B(i, 0));
        quad(T(i, NZ - 1), B(i, NZ - 1), B(i + 1, NZ - 1), T(i + 1, NZ - 1));
      }
      for (let k = 0; k < NZ - 1; k++) {                                 // x-end skirts (buried / inside the hull wall)
        quad(T(0, k), B(0, k), B(0, k + 1), T(0, k + 1));
        quad(T(NX - 1, k), T(NX - 1, k + 1), B(NX - 1, k + 1), B(NX - 1, k));
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.computeVertexNormals();
      // TERRAIN-MATCH (Zach 2026-07-17): render the drift with the ground's OWN
      // shared material + per-vertex biome color/raw sampled at each vertex's
      // WORLD position, so the entrance bank is indistinguishable from the dune
      // it rises out of (the old flat-ochre _sandDriftMat read as a pasted-on
      // mound). site.matrix == the group's world matrix, so the world XZ sampled
      // here is exactly what the terrain shader recomputes at render — the FBM
      // grain/ripple/streak/slope detail lines up with the surrounding sand, and
      // the color picks up THIS site's biome (not a global average). The mesh is
      // tagged noMerge because mergeStaticByMaterial strips every attribute but
      // position/normal/uv, which would gut the color/aBiomeRaw the shader needs.
      const vCount = pos.length / 3;
      const colAttr = new Float32Array(vCount * 3);
      const rawAttr = new Float32Array(vCount);
      const _wv = new THREE.Vector3();
      for (let vi = 0; vi < vCount; vi++) {
        _wv.set(pos[vi * 3], pos[vi * 3 + 1], pos[vi * 3 + 2]).applyMatrix4(site.matrix);
        const s = terrain.groundSample(_wv.x, _wv.z);
        colAttr[vi * 3] = s.color[0]; colAttr[vi * 3 + 1] = s.color[1]; colAttr[vi * 3 + 2] = s.color[2];
        rawAttr[vi] = s.biomeRaw;
      }
      geo.setAttribute('color', new THREE.Float32BufferAttribute(colAttr, 3));
      geo.setAttribute('aBiomeRaw', new THREE.Float32BufferAttribute(rawAttr, 1));
      const driftMesh = new THREE.Mesh(geo, terrain.groundMaterial);
      driftMesh.userData.driftCollide = true;   // → trimesh collider baked in place() (rule 9)
      driftMesh.userData.noMerge = true;        // keep color/aBiomeRaw through the static merge
      g.add(driftMesh);
    }
    // Hand the probe its waypoints in the drift's own terms. They MUST come from the
    // sampled surface: the old ones were computed from RAMP_RUN/RAMP_TAN and so sat in
    // mid-air (or under the dune) as soon as the fit was off — which is how the walk
    // gate came to be "passing" on a drift you could not actually climb.
    g.userData.leviathanDrift = {
      // On the crest, just outboard of the plate — level with the sill.
      outside: [RAMP_TOP_X + 1.2, surfY(RAMP_TOP_X + 1.2, I_BREACH_Z), I_BREACH_Z],
      // Out on the open sand at the foot of the drift, where it meets grade.
      outsideFoot: [toeX - 0.8, site.terrainLocalY(toeX - 0.8, I_BREACH_Z) + 0.3, I_BREACH_Z],
    };
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
  //    framed, cabled compartment. Seam rails + skirting + a high conduit run.
  //    Proud ≥0.1m. The STARBOARD runs stop at the breach: a rail sailing across a
  //    6m tear and ending in mid-air announces "the hole was cut afterwards". They
  //    are severed at the tear's edge instead, which is what a tear does to them.
  const BZ0 = I_BREACH_Z - I_BREACH_HZ - I_BREACH_WALL_MARGIN;
  const BZ1 = I_BREACH_Z + I_BREACH_HZ + I_BREACH_WALL_MARGIN;
  const zFwdEnd = midZ + 0.3 + (spanZ - 1) / 2, zAftEnd = midZ + 0.3 - (spanZ - 1) / 2;
  /** Run a wall-line feature down a flank, severed at the breach on starboard. */
  const wallRun = (s: -1 | 1, make: (len: number, cz: number) => void, y: number): void => {
    if (s < 0 || y > I_BREACH_Y1 + 0.3 || y < I_BREACH_Y0 - 0.3) { make(spanZ - 1, midZ + 0.3); return; }
    make(BZ0 - zAftEnd, (zAftEnd + BZ0) / 2);
    make(zFwdEnd - BZ1, (BZ1 + zFwdEnd) / 2);
  };
  for (const s of [-1, 1] as const) {
    const wx = (I_WALL_X - 0.05) * s;
    wallRun(s, (len, cz) => dBox(_frameMat, 0.14, 0.16, len, wx, I_DECK_Y + 2.3, cz), I_DECK_Y + 2.3);   // upper seam rail
    wallRun(s, (len, cz) => dBox(_frameMat, 0.16, 0.16, len, wx, I_DECK_Y + 0.15, cz), I_DECK_Y + 0.15); // skirting rail
    // The high conduit run sits above the tear's header, so it crosses uncut.
    dCyl(_conduitMat, 0.09, 0.09, spanZ - 2, wx - 0.06 * s, I_CEIL_Y - 0.55, midZ + 0.3, Math.PI / 2, 0, 0, 7);
  }

  // ── HOLD (z +7 → -7) — cargo cathedral at the breach ──────────────────────
  // Lashing rails + D-ring cleats down both walls (freighter cargo grammar). On
  // starboard both stop clear of the tear (see wallRun above) — the cleats simply
  // aren't placed where there is no wall left to bolt them to.
  for (const s of [-1, 1] as const) {
    const wx = (I_WALL_X - 0.08) * s;
    if (s < 0) dBox(_frameMat, 0.12, 0.16, 12.5, wx, I_DECK_Y + 1.5, 0.0);
    else { dBox(_frameMat, 0.12, 0.16, 5.0, wx, I_DECK_Y + 1.5, BZ1 + 2.5); dBox(_frameMat, 0.12, 0.16, 5.0, wx, I_DECK_Y + 1.5, BZ0 - 2.5); }
    for (let i = 0; i < 6; i++) {
      const cz = 5.5 - i * 2.1;
      if (s > 0 && cz > BZ0 && cz < BZ1) continue;                                           // torn away with the plating
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
  // NOTE (review 2026-07-16): the starboard cargo moved off z≈-0.5±2.5 — that is the
  // BREACH bay now, and cargo parked in the doorway would block the one way in. The
  // mass split fore (z≈4.6, against the fracture bulkhead) and aft (z≈-4.6), which
  // also frames the tear with cargo instead of burying it.
  intCrate(_cnRust, I_WALL_X - 1.5, I_DECK_Y + CN_H / 2, -6.0, 0, 0.06, 0);
  intCrate(_cnBlue, I_WALL_X - 1.6, I_DECK_Y + CN_H * 1.5 + 0.1, -5.8, 0.04, 0.03, 0.03);   // stacked
  intCrate(_cnTan, I_WALL_X - 1.7, I_DECK_Y + CN_H / 2, 5.4, 0, -0.14, 0.06);
  intCrate(_hullDarkMat, -I_WALL_X + 1.6, I_DECK_Y + CN_H / 2, 4.2, 0.05, 0.2, -0.1);
  intCrate(_cnRust, -I_WALL_X + 2.4, I_DECK_Y + CN_H * 0.45, -1.5, 0.5, 0.9, 0.35, 0.85);   // spilled, tipped
  intCrate(_cnBlue, -I_WALL_X + 1.5, I_DECK_Y + CN_H / 2, -4.8, 0, 0.1, 0.05);
  // Sand drifted in THROUGH THE BREACH — a tongue that starts on the threshold and
  // fans across the deck away from the tear, thickest at the sill (FLAT, no collider;
  // the deck stands). This is the payoff of the flight-recorder line: "it came up
  // through the breach like water and would not stop." It now points at the real
  // opening (starboard, at the break) instead of the sealed fracture face.
  for (let i = 0; i < 7; i++) {
    const sx = (I_WALL_X + 0.4) - i * 1.9;
    const hgt = 0.36 - i * 0.045;
    dBox(_sandDriftMat, 2.0, Math.max(0.05, hgt), (I_BREACH_HZ * 2 + 1.6) - i * 0.35,
      sx, I_DECK_Y + Math.max(0.05, hgt) / 2, I_BREACH_Z + (i % 2 ? 0.5 : -0.5) - i * 0.35);
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
  // A fallen manifest bundle + a mug on the deck (crew life). Thickness 0.06 (a
  // grimy ledger/manifest STACK, not a single sheet) so it clears the verify:solid
  // `thin` wall-scale gate — its own material bucket held only this one flat sheet
  // at 3cm, which read as a paper-thin panel (review 2026-07-16).
  dBox(_paperMat, 0.5, 0.06, 0.6, -2.6, I_DECK_Y + 0.05, -28, 0, 0.3, 0.02);
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
  // LIGHTING LIFT (review 2026-07-16): the cavernous hold read moody-DARK in the
  //    walk-test — the detail was barely legible. A single multiplier lifts every
  //    interior fill a notch so the deck / cargo / structure / crew station read,
  //    while keeping the "power's-out, sun through the tear" atmosphere (not a flat
  //    day-lit box). One-line revert: set LEVIATHAN_LIGHT_LIFT back to 1.0.
  const LEVIATHAN_LIGHT_LIFT = 1.4;
  const addLight = (color: number, intensity: number, range: number, lx: number, ly: number, lz: number): void => {
    _lightConfigs.push({ c: color, i: intensity * LEVIATHAN_LIGHT_LIFT, r: range, x: lx, y: ly, z: lz });
  };
  // The daylight now enters at the STARBOARD BREACH, not the (sealed) fracture face —
  // the shaft has to sit where the actual hole is, or the hold is lit from a wall.
  addLight(0xffc38c, 4.2, 34, I_WALL_X - 1.6, I_DECK_Y + 2.2, I_BREACH_Z);   // BREACH daylight shaft (floods the hold)
  addLight(0xffb578, 2.7, 26, 1.5, I_DECK_Y + 3.3, 3.0);            // hold near fill (daylight on the cargo)
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
  // The site resolves the monument's world pose + a dune sampler in its local frame.
  // It is built FIRST because the drift geometry is derived from the real terrain at
  // build time (see the DRIFT block), so the builder needs the pose up front.
  const site = makeLevSite(terrain);
  const group = buildLeviathanMesh(rand, site, terrain);
  group.name = 'leviathanLandmark';            // findable by the rig-shot framer + occluder-by-name

  // ── Tilt (a crashed-and-settled list) + burial. The hull long-axis is local +Z;
  //    yaw it BROADSIDE to the spawn gaze so the whole length reads, pitch a settled
  //    list, and sink only the keel so the long body rises clear of the horizon line.
  // Pose from the SITE's matrix — the same transform the drift was sampled against,
  // so the sand cannot land at a different height than the dune it was fitted to.
  const gy = terrain.heightAt(LANDMARK_X, LANDMARK_Z);
  group.rotation.set(GROUP_PITCH, HULL_YAW, GROUP_ROLL);   // pitch (settle) + yaw (broadside) + roll (list)
  // Sink only the keel so the whole LONG hull body rises clear of the horizon line
  // (R2: over-burial made it read as a lone fin — keep the belly proud so the ship
  // silhouette lies broadside above the dune).
  group.position.set(LANDMARK_X, gy - BURY, LANDMARK_Z);
  group.updateMatrixWorld(true);
  scene.add(group);

  // ── Windward sand mound REMOVED (Zach 2026-07-17: standalone sand mounds read
  //    weird + conflict with the terrain). The terrain-conforming ENTRANCE drift
  //    (built in buildLeviathanInterior, now on the ground's own material) stays —
  //    that one is the approved walk-in ramp. This decorative cone against the
  //    buried flank was the last live makeSandMound mesh in the game; its removal
  //    consumes no seeded rand (it was the terminal draw of this monument's stream,
  //    and lootRand is separate), so the monument geometry is byte-identical.

  // ══ EXTERIOR HULL trimesh colliders (review 2026-07-16 — rule 9). The visible
  //    hull skin was walk-through from OUTSIDE (verify:solid: 32% of exterior rays
  //    hit a visible wall with no collider). Bake an EXACT trimesh from each posed
  //    loft's real surface (megaWreck D189 / the Skyfall fix) so collision matches
  //    the rendered skin triangle-for-triangle. MUST run BEFORE the merge disposes
  //    the loft geometry. The fracture bore is a genuine open cross-section (no
  //    triangles across the walk-in centre), so the mouth entry stays clear; the
  //    interior walkable box set below seals the lived space. World-baked on an
  //    identity body (the monument is world-anchored like the interior colliders).
  group.updateMatrixWorld(true);
  const IDENT = new THREE.Matrix4();
  const ZEROP = { x: 0, y: 0, z: 0 };
  const IDENTQ = { x: 0, y: 0, z: 0, w: 1 };
  // The BOW's trimesh is trimmed where it passes through the walkable hold (rule 9 /
  // review 2026-07-16). Reared 64° about the fracture hinge, the top of its ~21m root
  // ring swings back down to local ≈(6.5,6.6,-1) — head height, mid-hold, right on the
  // walk line — and the player hit it as an invisible wall. That skin is buried inside
  // the aft mass and never renders, so dropping those triangles cannot open an
  // exterior gap: the aft hull's own trimesh already covers every visible surface
  // there, and the hold's forward end gets a REAL bulkhead collider below (it had been
  // relying on this same stray bow skin to stop the player, by accident).
  const groupInv = group.matrixWorld.clone().invert();
  const _lp = new THREE.Vector3();
  const buriedInAft = (wx: number, wy: number, wz: number): boolean => {
    _lp.set(wx, wy, wz).applyMatrix4(groupInv);
    return insideAftHull(_lp.x, _lp.y, _lp.z);
  };
  const hullMeshes: THREE.Mesh[] = [];
  group.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && o.userData.hullCollide) hullMeshes.push(m); });
  for (const hm of hullMeshes) {
    const tri = makeStaticTrimesh(world, [hm], ZEROP, IDENTQ, IDENT,
      hm.userData.trimInsideHold ? { skipTri: buriedInAft } : undefined);
    if (tri) _bodies.push(tri);
  }
  // ── THE SAND DRIFT collider — a trimesh baked from the drift's OWN sampled surface.
  //    Round 1 used a tilted box hand-derived from RAMP_* constants; that box could
  //    only ever approximate a surface fitted to the real dune, and its buried flank
  //    was the thing blocking the walk-in. Baking the collider from the geometry makes
  //    "what you climb is what you see" true by construction rather than by arithmetic.
  const driftMeshes: THREE.Mesh[] = [];
  group.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && o.userData.driftCollide) driftMeshes.push(m); });
  const driftHandles: number[] = [];
  for (const dm of driftMeshes) {
    const tri = makeStaticTrimesh(world, [dm], ZEROP, IDENTQ, IDENT);
    if (tri) { _bodies.push(tri); for (let i = 0; i < tri.numColliders(); i++) driftHandles.push(tri.collider(i).handle); }
  }
  // ── PERF static-merge into one draw per (material, attribute-signature) bucket —
  //    moved here (was in buildLeviathanMesh) so it runs AFTER the hull trimesh bake.
  //    Everything is static scenery (no interactables/animated/transparent); the
  //    salvage panels + journal are added LATER so they stay unmerged + interactive.
  mergeStaticByMaterial(group);
  group.traverse((o) => { o.userData.isWreckDecoration = true; o.userData.noCollider = true; });

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
  const localCol = (hx: number, hy: number, hz: number, lx: number, ly: number, lz: number, localEuler?: THREE.Euler): RAPIER.Collider => {
    // localEuler tilts the box WITHIN the group's frame (the sand ramp) — composed as
    // group ∘ local so a tilted collider still rides the monument's pose exactly.
    const q = localEuler
      ? groupQuat.clone().multiply(new THREE.Quaternion().setFromEuler(localEuler))
      : groupQuat;
    const c = makeStaticBox(
      world, { x: hx, y: hy, z: hz },
      groupPos.clone().add(new THREE.Vector3(lx, ly, lz).applyQuaternion(groupQuat)),
      q,
    );
    cols.push(c);
    const b = c.parent(); if (b) _bodies.push(b);
    return c;
  };
  // Deck (the walkable floor — handle exported for the walk probe).
  const deckCol = localCol(I_WALL_X + 0.6, 0.25, (spanZ + 1) / 2, 0, I_DECK_Y - 0.25, midZ + 0.3);
  // Side walls (inner face lands on the visible ±I_WALL_X plane). PORT is one box;
  // STARBOARD is split around the BREACH so the doorway carries no collider — the
  // collider set mirrors the four visible wall plates exactly (rule 9). The floor
  // through the opening is the threshold collider below.
  localCol(I_WALL_T / 2, wallH / 2, (spanZ + 1) / 2, -(I_WALL_X + I_WALL_T / 2), wallCY, midZ + 0.3);
  const breachFloorHandles: number[] = [];
  {
    const wx = I_WALL_X + I_WALL_T / 2;
    const bz0 = I_BREACH_Z - I_BREACH_HZ - I_BREACH_WALL_MARGIN;
    const bz1 = I_BREACH_Z + I_BREACH_HZ + I_BREACH_WALL_MARGIN;
    const by0 = I_BREACH_Y0 - I_BREACH_WALL_MARGIN, by1 = I_BREACH_Y1 + I_BREACH_WALL_MARGIN;
    const wTop = wallCY + wallH / 2, wBot = wallCY - wallH / 2;
    const zFwd = midZ + 0.3 + (spanZ + 1) / 2, zAft = midZ + 0.3 - (spanZ + 1) / 2;
    // Mirrors the visible wall plates exactly, INCLUDING the degenerate-segment skip
    // (see buildLeviathanInterior): a negative half-extent is not a small collider,
    // it is an invalid one, and Rapier will happily eject a capsule through the deck.
    const segCol = (hy: number, hz: number, py: number, pz: number): void => {
      if (hy > 0.005 && hz > 0.005) localCol(I_WALL_T / 2, hy, hz, wx, py, pz);
    };
    segCol(wallH / 2, (bz0 - zAft) / 2, wallCY, (zAft + bz0) / 2);              // aft of the breach
    segCol(wallH / 2, (zFwd - bz1) / 2, wallCY, (bz1 + zFwd) / 2);              // fore of the breach
    segCol((wTop - by1) / 2, (bz1 - bz0) / 2, (by1 + wTop) / 2, (bz0 + bz1) / 2); // header
    segCol((by0 - wBot) / 2, (bz1 - bz0) / 2, (wBot + by0) / 2, (bz0 + bz1) / 2); // sill strip (usually skipped)
    // Breach threshold — the walk-in floor from the deck edge out through the cut.
    // Its outboard face at THRESH_OUT_X is exactly where the drift's crest begins.
    breachFloorHandles.push(localCol((THRESH_OUT_X - (I_WALL_X - 0.4)) / 2, 0.35, (bz1 - bz0) / 2, ((I_WALL_X - 0.4) + THRESH_OUT_X) / 2, I_DECK_Y - 0.35, (bz0 + bz1) / 2).handle);
    // (The sand ramp's collider is the drift TRIMESH baked above — no box here.)
    breachFloorHandles.push(...driftHandles);
  }
  // Roof (underside = the interior ceiling at I_CEIL_Y).
  localCol(I_WALL_X + 0.6, 0.25, (spanZ + 1) / 2, 0, I_CEIL_Y + 0.25, midZ + 0.3);
  // Aft end wall.
  localCol(I_WALL_X + 0.6, wallH / 2, I_WALL_T / 2, 0, wallCY, I_END_Z - I_WALL_T / 2);
  // Under-deck skirt at the mouth (blocks stepping off the front lip into the void).
  localCol(I_WALL_X + 0.6, 1.6, 0.2, 0, I_DECK_Y - 1.7, I_MOUTH_Z + 0.7);
  // FRACTURE BULKHEAD — the hold's sealed forward end (rule 9). The visible torn
  // section plate at the break had NO collider of its own: what actually stopped the
  // player walking through it was the reared bow's stray trimesh, which is precisely
  // the geometry being trimmed out of the hold above. So the wall it was standing in
  // for has to become real, or trimming the bow would open the hold's forward end.
  localCol(I_WALL_X + 0.6, wallH / 2, 0.6, 0, wallCY, I_MOUTH_Z + 0.5);
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
  localCol(CHW, 2.6 * 1.0, CHL, I_WALL_X - 1.5, I_DECK_Y + 2.0, -6.0);   // starboard stack (2 high) — aft of the breach
  localCol(CHW, CH, CHL, I_WALL_X - 1.7, I_DECK_Y + CH, 5.4);            // starboard fwd crate — fore of the breach
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
  // The `outside` waypoint MUST be genuinely outdoors (review 2026-07-16). The old
  // one — (0, I_DECK_Y, I_MOUTH_Z+4) at the fracture — sat INSIDE the reared bow's
  // enclosed bore, so `leviathan-walk` teleported the player into a sealed pocket and
  // then "walked in" from there: the gate passed on a wreck no player could enter.
  //
  // Two outdoor waypoints now. `outsideFoot` is out on the open sand at the bottom of
  // the ramp — the walk gate STARTS there, so it has to climb the drift to get in,
  // which is the part that was never tested. `outside` is the ramp lip just outboard
  // of the skin: still open sky overhead, but level with the sill, which is what the
  // straight-line sightline checks (seam A/B, the backface into-opening shot) need —
  // they'd otherwise be aiming through the ramp itself. Both names match /outside/ so
  // seam's interior daylight-fan correctly excludes them from its centroid.
  // verify:solid's walk-in check derives its own outside and trusts neither of these.
  const dw = group.userData.leviathanDrift as { outside: number[]; outsideFoot: number[] };
  group.userData.leviathanProbe = {
    deckHandle: deckCol.handle,
    floorHandles: [deckCol.handle, ...sillHandles, ...breachFloorHandles],
    waypoints: [
      // Both outdoor waypoints come from the SAMPLED drift (buildLeviathanInterior),
      // not from ramp arithmetic: `outsideFoot` sits on the open sand where the drift
      // actually meets grade, and `outside` on the crest just outboard of the plate.
      // Derived the old way they drifted into mid-air / under the dune whenever the
      // linear fit was off, which made the walk gate green on an unclimbable ramp.
      wp('outsideFoot', dw.outsideFoot[0], dw.outsideFoot[1], dw.outsideFoot[2]),
      wp('outside', dw.outside[0], dw.outside[1], dw.outside[2]),
      wp('mouth', THRESH_OUT_X - 2.2, I_DECK_Y, I_BREACH_Z),
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
