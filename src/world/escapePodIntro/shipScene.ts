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
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type RAPIER from '@dimforge/rapier3d-compat';
import type { GameContext } from '../../GameContext.ts';
import { makeStaticBox } from '../../physics/bodies.ts';
import { mergeStaticByMaterial } from '../wreckForms.ts';   // PERF — static-merge shared-material greebles (rivets/panels) into batched draws
import { buildCanonicalPodExterior } from './podScene.ts';   // B1.a — the ONE canonical pod module (shared interior+exterior+merged front door)

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
// Forward glazing: Y1 GLAZED-DOME REBUILD — the forward hull is demolished and the front section IS
// the glazing (a glass dome on a metal skeleton). The dome geometry/params live with buildGlazedDome
// (DOME_* + _domeNode). The old flat-windscreen sill/rake constants are gone with the demolished hull.
// Corridor opening in the +Z wall: x −1..1, y 0..2.4.
const DOOR_X = 1.0, DOOR_Y1 = 2.4;

// ── The PILOT STATION frame: the pilot sits FORWARD + LOW, dash wrapping his knees, window
//    above. The dash runs across the −Z sill; the seat is just aft of it. SEAT_Z drives the
//    spawn (getShipSpawn) AND seats the geometry so it composes for the low/close pilot eye.
const CON_Z = -1.55;       // the wrap-around dash centre (right at the forward sill)
// W1 (user: "the console is TOO TALL — it blocks vision"). Dropped 0.78→0.60 — a low glare-shield
//   profile (the refs' low console) so the seated gaze clears the dash to the planet. The fascia
//   brow now tops out ~0.90 (was ~1.15) → well below the seated eye (~1.35), no longer eating the
//   lower vista. The MFD/readout/setCockpitAlert hookups ride this datum (re-derived, not moved by hand).
const CON_DECK_Y = 0.60;   // instrument-deck height (LOW glare-shield — a low seated glance clears it)
// A4d (user walk-test 2026-07-02): "move the chair back a little". Seat shifted aft −0.55 → −0.30
//   (more knee room off the dash; the window still dominates the seated gaze). getShipSpawn is
//   re-derived from SEAT_Z so the seated eye tracks the moved seat (the player sits IN it).
const SEAT_Z = -0.30;      // the seat sits aft of the dash (knees clear of it)
const SEAT_Y = 0.42;       // cushion-top height

// ── Materials — weathered ALUMINIUM idiom (podScene.ts), pushed HARDER on weathering per the
//    gate's fidelity note (rust streaks, grime, oxidation, edge wear). Module-scope; shared
//    across rebuilds; disposeShipScene frees per-build geometry/materials, not these.
// ── REBUILD v2 R5a FIX — COOL BRUSHED-ALUMINIUM PBR (the gate's #1 fix). The hull is now real
//    MeshStandardMaterial metal (metalness/roughness response), HARD-desaturated to cool
//    grey/blue-grey — NOT the warm-brown Lambert wood that drove the "wine barrel" read. Five+
//    genuinely distinct materials by metalness/roughness/colour so surfaces read DIFFERENT.
//    Patched with subtle procedural plate break-up via onBeforeCompile (keeps the lived-in
//    plated look without the warm rust). flatShading on the hull = per-triangle plate facets.
function _metal(color: number, metalness: number, roughness: number, opts: { flat?: boolean; emissive?: number; emissiveI?: number; grime?: boolean } = {}): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({
    color, metalness, roughness,
    flatShading: opts.flat ?? false,
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissiveI ?? 1,
  });
  if (opts.grime) _installGrime(m);
  return m;
}
// ── R5a MATERIAL-FEEL PASS — the WORN layer. A shared world-space grime shader that turns the flat
//    gunmetal panels into a lived-in surface WITHOUT texture files or new draw calls: (1) a VERTICAL
//    DUST GRADIENT — the surface darkens + roughens toward the floor (world-Y), so the deck + lower
//    walls read grimier than the crown (grime pools low). (2) a broad low-frequency VALUE BREAK
//    (a cheap 3-axis value noise) so a big flat panel reads as mottled worn metal, not one dead
//    value + it also modulates roughness (streaky worn sheen, not a uniform gloss). (3) darker
//    grime settling into the low world-Y band (oil/dust pooling). The GLSL is BYTE-IDENTICAL for
//    every grimed material (only the material's `color`/`roughness` uniforms differ), so all grimed
//    metals SHARE ONE compiled program — no per-instance baked literals → no cache-key collision,
//    no key needed (the D207 "global-constant factory → sharing is correct" case). World-space
//    coords (D109) are right here: these hull panels are STATIC, and adjacent panels get coherent,
//    seam-matched weathering for free. SHIP_ORIGIN.y (3000) is folded out via a modulo so the noise
//    reads at a sane frequency despite the high world origin.
function _installGrime(m: THREE.MeshStandardMaterial): void {
  m.onBeforeCompile = (shader: THREE.WebGLProgramParametersWithUniforms) => {
    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      `#include <common>
       varying vec3 vGrimeW;`,
    );
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
       vGrimeW = (modelMatrix * vec4(transformed, 1.0)).xyz;`,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      `#include <common>
       varying vec3 vGrimeW;
       // cheap value-noise (hash of a lattice cell, trilerp) — no texture, byte-identical everywhere.
       float _gh(vec3 p){ return fract(sin(dot(floor(p), vec3(17.1, 47.7, 93.3))) * 4375.85); }
       float _gn(vec3 p){
         vec3 f = fract(p); vec3 i = floor(p); f = f*f*(3.0-2.0*f);
         float a = mix(_gh(i+vec3(0,0,0)), _gh(i+vec3(1,0,0)), f.x);
         float b = mix(_gh(i+vec3(0,1,0)), _gh(i+vec3(1,1,0)), f.x);
         float c = mix(_gh(i+vec3(0,0,1)), _gh(i+vec3(1,0,1)), f.x);
         float d = mix(_gh(i+vec3(0,1,1)), _gh(i+vec3(1,1,1)), f.x);
         return mix(mix(a,b,f.y), mix(c,d,f.y), f.z);
       }`,
    );
    // modulate the DIFFUSE (value break + vertical dust) right after the map-color is set.
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
       vec3 gp = vGrimeW; gp.y = mod(gp.y, 64.0);           // fold the high world origin out
       // R5a-r6: 3 octaves (added a coarse streak band) + a stronger amplitude → the big flat panels
       //   read as MOTTLED worn metal, not a dead-uniform showroom plate (the user's "too pristine").
       float gVal = _gn(gp * 0.9) * 0.42 + _gn(gp * 1.7) * 0.38 + _gn(gp * 5.3) * 0.20;
       // long vertical streak grime (dirt runs down the walls) — a directional wash keyed to a hash
       //   band, only on near-vertical surfaces so the floor doesn't get vertical stripes.
       float gStreak = smoothstep(0.55, 0.95, _gn(vec3(gp.x * 3.1, gp.y * 0.35, gp.z * 3.1)));
       // floorY≈0 in local; world floor ≈ SHIP_ORIGIN.y (3000). height above the deck, 0..~3:
       float gAbove = clamp(mod(vGrimeW.y, 64.0) - mod(3000.0, 64.0), 0.0, 3.0);
       float gDust = 1.0 - clamp(gAbove / 2.6, 0.0, 1.0);   // 1 at the floor → 0 at the crown
       // a HARDER low pool for the deck + lower walls (grime settles at the floor — the worn tell).
       float gFloor = 1.0 - clamp(gAbove / 0.95, 0.0, 1.0); // 1 right at the deck, gone by ~waist
       // darken: a broad mottle (±) settling darker low, a dust wash pooling toward the deck, a
       // heavier grime pool at the floor, + vertical streaks (grime runs down the walls). Pushed
       //   harder per the user directive (the flat panels were too clean/pristine).
       float gDark = (gVal - 0.5) * 0.34 - gDust * 0.26 - gFloor * (0.20 + gVal * 0.18) - gStreak * 0.10;
       diffuseColor.rgb *= clamp(1.0 + gDark, 0.40, 1.14);
       // a faint desaturated warm-grey grime cast in the pooled-dust band (dust, not clean metal).
       diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.07, 1.0, 0.88), gDust * 0.48);`,
    );
    // modulate ROUGHNESS — grimier/rougher low + in the mottle (streaky worn sheen, not uniform gloss).
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <roughnessmap_fragment>',
      `#include <roughnessmap_fragment>
       vec3 rp = vGrimeW; rp.y = mod(rp.y, 64.0);
       float rVal = _gn(rp * 2.1);
       float rStreak = smoothstep(0.55, 0.95, _gn(vec3(rp.x * 3.1, rp.y * 0.35, rp.z * 3.1)));
       float rAbove = clamp(mod(vGrimeW.y, 64.0) - mod(3000.0, 64.0), 0.0, 3.0);
       float rDust = 1.0 - clamp(rAbove / 2.6, 0.0, 1.0);
       // R5a-r6: rougher overall + streaky (kills the broad specular hotspot sweep on the crown that
       //   still read as showroom gloss — the highlight is now a soft varied wash, not a mirror sheen).
       roughnessFactor = clamp(roughnessFactor + (rVal - 0.35) * 0.20 + rDust * 0.14 + rStreak * 0.10, 0.34, 1.0);`,
    );
  };
}
// ── REBUILD v2 R5a MATERIAL-FEEL PASS (user directive + independent gate, 2026-06-30):
//    "liked the older metal texture better — the new one looks way too pristine and shiny; the
//    previous had a rugged feel." The cool recolor (killing the wine-barrel brown) was RIGHT, but
//    it was authored as PRISTINE brushed aluminium: high metalness (~0.86) + low roughness (~0.46)
//    + strong envMap (0.85) → surfaces MIRROR the bright planet and glint like a showroom. This
//    pass keeps the COOL NEUTRAL colour but retunes the whole hull idiom to WORN MATTE GUNMETAL:
//    roughness UP hard (broad soft highlights, no sharp glints), metalness DOWN (painted/worn
//    metal, not chrome), envMap CUT (see _applyCockpitEnv → no mirror-sheen), values DARKER + more
//    varied, plus layered grime (see _grime() below). Target = "worn lived-in industrial hauler",
//    not "clean sci-fi showroom". Before→after per material noted inline (metal / rough).
// HULL SKIN — worn cool gunmetal, MATTE. Painted-over-metal read: broad soft sheen, no glint.
//   0.86/0.46 → 0.44/0.78. Darker + a faint desaturated warm-grey grime cast (not the near-white).
const _shell = _metal(0x686e73, 0.44, 0.78, { flat: true, grime: true });
// PAINTED-PANEL metal — a worn battleship-grey painted plate (proud panels + windscreen fascia).
//   0.55/0.34 → 0.40/0.72. Still reads DIFFERENT (a touch lighter + smoother) but no longer glossy.
const _band = _metal(0x7c8288, 0.40, 0.72, { flat: true, grime: true });
// COCKPIT-ROUND-2 item-3 (user: "mullions read flat grey — give them a real metal treatment"): the
//   canopy skeleton beams get a TWO-TONE machined read — a lighter brushed FACE strip proud along the
//   member centreline + a darker RECESS groove line, so each beam reads as a fabricated structural
//   section catching a highlight rail, not a dead flat bar. _domeFace = the machined face (lighter,
//   glossier); _domeRecess = the inset shadow groove (darker, matte).
const _domeFace = _metal(0x9aa0a6, 0.34, 0.66, { flat: true, grime: true });
const _domeRecess = _metal(0x3a3f45, 0.52, 0.70, { flat: true, grime: true });
// DARK STRUCTURAL STEEL — ribs / console body / deep frames. Kept the DARKEST + a touch less rough
//   so the ribs still pop OFF the hull as harder metal (gate: "ribs read as molding"), but the
//   highlight is now a broad soft sheen, not a mirror. 0.90/0.30 → 0.55/0.62.
const _steel = _metal(0x373c42, 0.55, 0.62, { flat: true, grime: true });
// CHANNEL / recessed near-charcoal steel (console body, kickplates, sockets, grime channels) —
//   the deepest matte value; recessed crevices read dark + dead. 0.80/0.42 → 0.42/0.80.
const _channel = _metal(0x24282e, 0.42, 0.80, { flat: true, grime: true });
// RIVETS / studs / cast hardware — scuffed bright bare steel (the ONE place a small glint reads as
//   worn hardware, not showroom). Kept metallic but rougher. 0.92/0.38 → 0.62/0.52.
const _rivet = _metal(0x9299a0, 0.62, 0.52);
// DECK PLATE — worn cool aluminium tread, MATTE + scuffed footfall. Darker so the floor stops
//   reading near-white. 0.82/0.52 → 0.42/0.80.
const _deck = _metal(0x5c6167, 0.42, 0.80, { flat: true, grime: true });
// CEILING / outer-shell darker panel — overhead grime, the roughest/darkest big panel so the vault
//   never blows out to bright grey. 0.78/0.58 → 0.40/0.84.
const _ceil = _metal(0x474c52, 0.40, 0.84, { flat: true, grime: true });
// Conduit / cabling — dark matte rubber (low metal, high rough → reads NON-metal vs the hull).
const _cable = _metal(0x18161a, 0.10, 0.85, { flat: true });
// SEAT — WORN VINYL/LEATHER upholstery. R5a-r5 FIX-2 (the "tan wedge" recurrence): the forward
//   bolsters/cushion caught the warm key + a bright env and lifted to a TAN slab in the seated
//   forward shot. Fix: pull the base vinyl DARKER + off the warm-brown toward a neutral cool-warm
//   charcoal (0x2a2620 → 0x211f20), and (below) kill its env catch so the warm key can't render it
//   bright. Still distinctly darker + a hair warmer than the hull grey → reads as a separate worn
//   upholstered object, not painted hull, but never a bright wedge. Very high rough = matte cushion.
const _seat = _metal(0x1a1917, 0.03, 0.92, { flat: true });
// worn seat highlight — a scuffed rub-through crown on the wear-points. R5a-r5 FIX-2: was a warm
//   TAN (0x6b5d4c) that read as the bright wedge under the key; pull it to a muted NEUTRAL worn
//   grey (0x3c3833) + rougher so it stays a subtle tonal break, not a tan highlight slab. Neutral
//   (not warm-brown) so the warm key can't render it tan.
const _seatWorn = _metal(0x3c3833, 0.04, 0.80, { flat: true });
// seat back / shell sides — the DARKEST + coolest-neutral vinyl (the big visible bolster/back forms
//   are this, so it must stay dark under the warm key — R5a-r5 FIX-2 killed the brown-block read in
//   the aft-turned shot). 0x241f1c (warm) → 0x1c1b1a (near-neutral very dark).
const _seatBack = _metal(0x1a1a1c, 0.04, 0.90, { flat: true });
// ── R5a-r6 FIX-2 (the TAN-WEDGE recurrence, user directive 2026-07-01) — the FORWARD-INTRUDING seat
//   forms (armrest pad + tops + forward thigh-horns) reach into the lower-L/R corners of the SEATED
//   frame, where the warm crown key + warm rake hit their light-facing faces and STILL lifted the
//   dark vinyl to a bright TAN wedge (the recurring gate/user complaint). Root cause: the warm-tinted
//   albedo (R>G>B) + a whisper of env → warm diffuse catch renders them tan. Fix = a dedicated
//   material for JUST these forward forms: NEAR-BLACK + COOL-neutral (B≥G≥R, so warm light can only
//   grey it, never warm it to tan), ZERO metalness, ZERO env, MATTE. Under the warm key these read
//   as dim cool cradling forms flanking the buckle → the BUCKLE + thin straps are what the eye reads.
const _seatArm = _metal(0x121316, 0.0, 0.95, { flat: true });
// piping / seam welt — a worn pale stitch-line welt between cushion sections (lifts the seams).
const _seam = _metal(0x4a4338, 0.04, 0.74, { flat: true });
// Restraint webbing — worn safety-orange strap (reads as a real harness, pops vs the dark seat).
//   R5a-r6 (the "tan wedge" root cause): the over-shoulder straps anchor right beside the seated eye,
//   so a bright-orange band foreshortens into a huge TAN WEDGE under the warm key (the user/gate
//   complaint — misattributed to the bolsters, actually the HARNESS). Pull the webbing DARKER + off
//   the bright orange toward a muted worn oxblood-brown so even foreshortened + key-lit it reads as a
//   dark strap, never a bright tan slab. Still clearly a harness (warm vs the cool hull) — just not neon.
//   dark strap, never a bright tan slab. Still clearly a harness (warm vs the cool hull) — just not neon.
//   R5a-r7 (harness READ, re-judged on the FAITHFUL frame): a first attempt added a self-lit floor to
//   the WHOLE webbing so it'd read at dim orbit — but that re-lit the LAP straps (which foreshorten near
//   the lens) straight back into the twin TAN WEDGES r6 killed. Reverted: the lap straps stay DARK; the
//   "strapped-in" read now rides the raised SELF-LIT BUCKLE (below) as the single clear token, which is
//   what the prior learning says (the buckle is the read, the near-lens straps are the wedge liability).
const _strap = _metal(0x572d1a, 0.05, 0.88, { flat: true });
// strap wear — a grimed darker band on the webbing (the harness isn't a clean flat strip).
const _strapWorn = _metal(0x3a1f13, 0.05, 0.90, { flat: true });
// R5a-r7 — the buckle FACEPLATE material: a brushed pewter with a self-lit floor so the chunky central
//   buckle stays a legible bright plate under the dim orbit key (the _rivet lit-only plate went dark at
//   orbit alongside the straps). Slightly warm so it reads as worn hardware catching a little cabin light.
const _bucklePlate = _metal(0xa9adb2, 0.55, 0.46, { emissive: 0x2a2b2d, emissiveI: 0.85 });
// Warm self-lit accents — unlit so they GLOW (points of life on the dash).
const _ledGreen = new THREE.MeshBasicMaterial({ color: 0x66d877 });
const _ledAmber = new THREE.MeshBasicMaterial({ color: 0xe09838 });
const _ledBlue = new THREE.MeshBasicMaterial({ color: 0x52b0cc });
// Backlit dial-face (a faint lit gauge face — unlit so it glows under the bezel).
const _dialFace = new THREE.MeshBasicMaterial({ color: 0x223240 });
// Yellow/black HAZARD decal (a warning placard) — unlit so it reads as printed paint.
const _hazard = new THREE.MeshBasicMaterial({ color: 0xc9a52e });
// A printed-decal dark base (stencil text/label backing).
const _decal = new THREE.MeshBasicMaterial({ color: 0x20242a });
// ── CORRIDOR accents (R5b). Painted safety-yellow hazard stripe paint (chevrons / door frames) —
//   worn matte metal, not unlit, so it takes the corridor lighting + the red-alert wash like real
//   painted steel. Distinct from the cockpit's unlit _hazard placard.
const _corrHazard = _metal(0xb89224, 0.30, 0.72, { flat: true, grime: true });
// Grab-rail steel — a worn hand-polished tube (bare metal vs the painted wall, but NOT bright-white:
//   pulled down + rougher so it reads as a used oily handrail, not a chrome bar).
const _corrRail = _metal(0x63696f, 0.5, 0.62, { grime: false });
// Recessed-fixture lens (unlit warm-white can-light lens — GLOWS as the corridor's own light).
const _corrLens = new THREE.MeshBasicMaterial({ color: 0xffe4b0 });
// Corridor strip-light emissive (unlit) — a low warm channel-light bar (normal), driven to hot-red
//   by setShipAlert. Instanced per-strip (each captured) so the alert can strobe them.
// Placard face (a lit stencil label — dim so it reads as painted, not a screen).
const _corrPlacard = new THREE.MeshBasicMaterial({ color: 0x9aa6ae });
// EMISSIVE SCREEN — a real recessed MFD: a dark glass face with a green emissive content layer
//   driven separately (the bright bars). Standard so it takes a faint reflection.
const _screenGlass = _metal(0x0c1410, 0.15, 0.22, { emissive: 0x0a1a0e, emissiveI: 0.5 });
// Window frame — the canopy ring / mullion structural beams (dark cool steel, semi-gloss).
const _winFrame = _metal(0x3a4047, 0.85, 0.36, { flat: true });
// ── B1.e — the ENGINE-ROOM GLASS SLIDING-DOOR pane: a heavy scuffed safety-glass pane you CAN'T
//    pass (a collider sits behind it). Cool-tinted, glossy, semi-opaque so the engine room + fire
//    read through it but it clearly reads as a sealed window. Its emissive lifts hot-orange with
//    the fire (setEngineFire) so the blaze GLOWS through the glass. Cloned per-leaf (2 leaves).
function _makeEngineGlass(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: 0x2b3840, roughness: 0.14, metalness: 0.0,
    emissive: 0x000000, emissiveIntensity: 1.0,
    transparent: true, opacity: 0.42, side: THREE.DoubleSide,
  });
}
// Engine-room machinery accent — a hot pipe / reactor casing (mid steel, takes the fire glow).
const _engMachine = _metal(0x54585e, 0.5, 0.6, { flat: true, grime: true });
// Engine-room deep steel (the reactor block / engine mass) — dark, heavy.
const _engBlock = _metal(0x33373d, 0.55, 0.55, { flat: true, grime: true });
// Window GLASS — a real transmissive cool-tinted CANOPY pane: faint blue tint, very glossy, low
//   base opacity so the orbit reads through, but with a real SURFACE that catches a Fresnel rim +
//   a curved-glass sheen so the eye reads a BUBBLE of glass, not a void.
//   COCKPIT-ROUND-2 (the user: "the glass reads as a flat piece / a black hole; make it a real
//   curved canopy that meets the hull on every edge and looks COOL"): the pane was reading as an
//   open black hole (opacity 0.20 + a near-black tint against black space) with two dark rail bars
//   crossing it. This pass keeps the planet crisp through the CENTRE but lifts the pane's own
//   presence: (1) a stronger, warmer-cool Fresnel RIM so the curved bubble edge GLOWS where the eye
//   sees it grazing (the wrap-form reads); (2) a faint broad curved-sheen highlight band so a large
//   flat-looking sheet reads as a gently-domed canopy catching cabin/limb light; (3) the alpha still
//   opens up toward the centre so the world reads through. Single shared material → one program.
// COCKPIT-ROUND-2 item-2 (user: "the panes read MISSING between the members — need a subtle visible
//   glass presence in every cell"). The R2 Fresnel lesson still holds (no milky fog), so the presence
//   is delivered as a FAINT UNIFORM floor: base opacity nudged 0.17→0.225 (a whisper of body tint so a
//   pane is never a clean open hole) + a small constant emissive tint sheen (below) so every cell — even
//   dead-on facing empty sky — catches a hint of cool glazing. The centre stays clear enough to read the
//   vista through; the edge sliver still firms the seal.
const _glass = new THREE.MeshStandardMaterial({
  // ROUND-2d item-1 — THE "FUZZY STARS" DIAGNOSIS (toggle-tested by elimination, not guessed). Soft
  //   warm dots read ON the dome glass, distinct from the crisp sky stars, and PERSISTED through
  //   --hidestars, --noplanet, and killing the glass envMap (moved _glass to ZERO env) — so NOT
  //   stars / planet / IBL-reflection. They VANISHED the instant the glass roughness went up (0.06→1.0
  //   killed them; a --nohull shot proved they render ON the glass, not in the sky). ROOT CAUSE: at
  //   roughness 0.06 the glossy dielectric glass shows a tight SPECULAR LOBE for every cabin POINT
  //   LIGHT (the warm key/aft/exitGlow/winGlow/coolFill sources). On the big curved dome sheet each
  //   warm point light paints a soft warm blob = the "fuzzy stars". FIX: roughness 0.06→0.7 — spreads
  //   the specular so the point-light lobes no longer resolve as discrete blobs at ANY vantage (0.5
  //   still left faint smudges from the STANDING eye; 0.7 is clean seated + standing). Through the
  //   glass the only stars are now the sky dome's. The glass PRESENCE is carried by the emissive
  //   border/rim glint + the uniform glaze floor (onBeforeCompile) — view/UV-driven, NOT
  //   light-specular — so it's untouched by the roughness change.
  color: 0x3a4e5c, roughness: 0.7, metalness: 0.0,
  // ROUND-2d item-2 (haze: slightly LESS overall + EXACTLY uniform front/side/top). The per-pane BODY
  //   glaze is machine-measured by the cockpit-glass-luma probe (isolated glass over black; the robust
  //   per-pane read is the body-band MEDIAN, coverage-independent). Baseline median ≈21 across regions;
  //   nudged the base emissive 0.12→0.10 for the "slightly less" ask (the uniform glaze floor +
  //   Fresnel-alpha were also trimmed in onBeforeCompile). All presence terms are view/UV-driven +
  //   identical per cell → parity BY CONSTRUCTION; the probe confirms front/side/top medians within
  //   ±10% at the lower level (~3-4% dev). ROUND-2c note kept: with DoubleSide the base opacity tint
  //   stacks ≈2×, so it's kept low (the border glint carries the "this cell is glass" read).
  emissive: 0x0c1a26, emissiveIntensity: 0.10,
  transparent: true, opacity: 0.055,
  // Z1 PER-CELL HAZE-PARITY ROOT-CAUSE (2nd half). The glass WAS DoubleSide, which made per-cell haze
  //   inescapably NON-uniform: a ray crossing a pane hits 1 face (near-flat sill panes, where the two
  //   coincident faces collapse to one blend) or 2 faces (curved crown / closure panes, whose faces
  //   separate in depth) → the crown/closure cells composited ~2× the glaze of the sill band (the
  //   cockpit-glass-cells probe: 14.94 vs 5.15). The glaze is meant to be ONE thin layer per pane,
  //   independent of face count. FIX: FrontSide + the per-cell inboard-winding enforcement below
  //   (_pushInboardQuad) → EVERY pane presents exactly ONE cabin-facing face → the glaze is a single
  //   uniform layer on every cell = parity BY CONSTRUCTION. The seated/standing pilot is always INSIDE
  //   the cockpit, so the cabin-facing (inboard) face is the one they see — FrontSide loses nothing for
  //   the intro's interior vantage. depthWrite:false keeps the transparent sort clean + lets the real
  //   sky Points read through (the porthole-glass discipline).
  side: THREE.FrontSide,
  depthWrite: false,
});
_glass.onBeforeCompile = (shader: THREE.WebGLProgramParametersWithUniforms) => {
  shader.vertexShader = shader.vertexShader.replace(
    '#include <common>',
    `#include <common>
     varying vec3 vGlassViewPos;
     varying vec3 vGlassViewNrm;
     varying vec2 vGlassLocal;`,
  );
  shader.vertexShader = shader.vertexShader.replace(
    '#include <begin_vertex>',
    `#include <begin_vertex>
     vGlassViewPos = (modelViewMatrix * vec4(transformed, 1.0)).xyz;
     vGlassViewNrm = normalize(normalMatrix * normal);
     vGlassLocal = uv;`,
  );
  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <common>',
    `#include <common>
     varying vec3 vGlassViewPos;
     varying vec3 vGlassViewNrm;
     varying vec2 vGlassLocal;`,
  );
  // ROUND-2c HAZE ROOT-CAUSE FIX (the user's 2nd haze report + the per-pane inconsistency).
  //   DIAGNOSED (not guessed): the milky veil against the starfield came from the BROAD CURVED-SHEEN
  //   BAND — `totalEmissiveRadiance += vec3(0.26,0.34,0.42) * gSheen * 0.6`, where gSheen =
  //   smoothstep(0.55,1.0,gArc)*(0.35+0.4*gFres) covered a WIDE swath of each pane (a UV-arc, not an
  //   edge). It was BOTH the dominant haze AND the per-pane inconsistency: gArc keys off per-pane UV
  //   and gFres off view angle, so grazing SIDE panes lit up milky while face-on CROWN panes fell
  //   below the smoothstep → pure-black/invisible. THE SHEEN BAND IS DELETED. Glass presence now comes
  //   from a UNIFORM per-cell floor (identical on every pane regardless of angle → top+side panes match)
  //   + a THIN edge glint. The centre body is clear: near-zero veil head-on, stars/planet read through.
  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <emissivemap_fragment>',
    `#include <emissivemap_fragment>
     vec3 gV = normalize(-vGlassViewPos);
     float gNdV = clamp(dot(normalize(vGlassViewNrm), gV), 0.0, 1.0);
     float gGrad = vGlassLocal.y;
     vec3 gRim = mix(vec3(0.16, 0.26, 0.36), vec3(0.34, 0.48, 0.62), gGrad);
     // a THIN grazing-edge rim glint (the bubble seam) — confined to the outer sliver + weak so a
     //   side-wrap pane facing away stays see-through tinted glass, never a fogged sheet. Z1 PER-CELL
     //   PARITY: the dome cells are NON-PLANAR quads, so the interpolated fragment normal deviates a few
     //   degrees from head-on even mid-pane → at pow 3.4 the Fresnel leaked a faint rim tint into the
     //   pane BODY UNEVENLY per cell (the sill band caught [+2,+3,+3] the crown band didn't → the
     //   residual per-cell split the cockpit-glass-cells probe exposed). Raised 3.4→6.0 so the rim is
     //   confined to a HARD grazing sliver only (1-gNdV must be large) → zero body leak → every cell's
     //   body is the pure uniform floor = parity by construction. The seam still lights at true edges.
     float gRimEdge = pow(1.0 - gNdV, 6.0);
     // Z1: gate the Fresnel rim by a UV-EDGE mask too, so it can ONLY light near a pane's actual edge
     //   (where the "bubble seam" belongs) and NEVER leaks into the body. The dome cells are non-planar
     //   quads → the interpolated normal wobbles a few degrees mid-pane, so a pure Fresnel rim leaked a
     //   faint tint into the body UNEVENLY per cell (the near-vertical sill panes caught it, the raked
     //   crown panes didn't → the last per-cell residual). The UV mask (outer ~14% of the pane) confines
     //   the rim to the frame edge → the body is the pure uniform floor on EVERY cell = full parity.
     float gRimUV = 1.0 - smoothstep(0.0, 0.14, min(min(vGlassLocal.x, 1.0 - vGlassLocal.x), min(vGlassLocal.y, 1.0 - vGlassLocal.y)));
     totalEmissiveRadiance += gRim * gRimEdge * gRimUV * 0.62;
     // the UNIFORM glaze floor — a bare cool whisper, view-INDEPENDENT + UV-independent, so EVERY cell
     //   (crown or side) reads the SAME faint glass presence (the fix for "top panes invisible / sides
     //   hazy" — all cells converge). Nudged 0.03→0.05: enough that a face-on crown pane over a BLACK
     //   sky patch shows the same faint glaze as a side pane over the galaxy glow (they read identical),
     //   still low enough that head-on the stars read straight through, not a milky film.
     totalEmissiveRadiance += vec3(0.12, 0.17, 0.22) * 0.038;   // ROUND-2d: 0.05→0.038 (slightly less haze; view/UV-INDEPENDENT so every cell reads identical = parity by construction)
     // a hairline BORDER glint on the outer few % of each pane's uv → every cell shows a sealed frame
     //   even head-on (the "no missing pane" read), uniform per cell, without touching the clear centre.
     float gEdgeU = min(vGlassLocal.x, 1.0 - vGlassLocal.x);
     float gEdgeV = min(vGlassLocal.y, 1.0 - vGlassLocal.y);
     float gBorder = 1.0 - smoothstep(0.0, 0.05, min(gEdgeU, gEdgeV));
     totalEmissiveRadiance += vec3(0.22, 0.30, 0.38) * gBorder * 0.35;`,
  );
  // raise the alpha toward grazing angles so the glazing reads as a real edge-lit CURVED sheet
  //   (the wrap-form seals visibly to the hull at the rim) — the centre stays open for the planet.
  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <opaque_fragment>',
    `gl_FragColor = vec4( outgoingLight, diffuseColor.a );
     #ifdef OPAQUE
     gl_FragColor.a = 1.0;
     #endif
     // ROUND-2c: the grazing-angle alpha boost was firming the SIDE-WRAP panes toward milk (a haze
     //   contributor). Cut hard (0.26→0.09) + confined to the outer sliver (pow 3.2→3.6), so the pane
     //   BODY stays uniformly see-through at every angle — the presence is the border seal glint, not a
     //   view-driven opacification. Top + side panes now read the same transparency.
     float gFres2 = pow(1.0 - clamp(dot(normalize(vGlassViewNrm), normalize(-vGlassViewPos)), 0.0, 1.0), 3.6);
     // a hairline uv-border alpha bump so every pane shows a firm sealed frame even head-on (no cell
     //   reads as an open hole); UNIFORM per cell; the clear centre body is untouched.
     float gEdgeU2 = min(vGlassLocal.x, 1.0 - vGlassLocal.x);
     float gEdgeV2 = min(vGlassLocal.y, 1.0 - vGlassLocal.y);
     float gBorderA = 1.0 - smoothstep(0.0, 0.05, min(gEdgeU2, gEdgeV2));
     // ROUND-2d: the grazing Fresnel-alpha (0.09) opacified SIDE/TOP panes more than FACE-ON FRONT
     //   panes → the per-region body divergence the user reads as "front/side/top don't match". Cut
     //   0.09→0.05 so the pane BODY alpha is near view-INDEPENDENT (the border seal carries presence).
     // Z1: gate the residual Fresnel-alpha by the SAME UV-edge mask as the rim, so it can only firm the
     //   pane EDGE, never the body. The dome cells are non-planar → the interpolated normal wobbles a few
     //   degrees mid-pane → this ungated gFres2 was raising the alpha (→ compositing brighter over black)
     //   on the near-vertical SILL panes but not the raked crown/closures → the last per-cell residual
     //   (front-sill 3.37 vs the rest 2.36 in the pure-glaze probe). UV-gated → the alpha body is now
     //   truly view/geo-independent → every cell composites identically = per-cell parity by construction.
     float gRimUV2 = 1.0 - smoothstep(0.0, 0.14, min(gEdgeU2, gEdgeV2));
     gl_FragColor.a = clamp(gl_FragColor.a + gFres2 * gRimUV2 * 0.05 + gBorderA * 0.30, 0.0, 0.5);`,
  );
};


/** A box's dimensions + centre: [w, h, d, centerX, centerY, centerZ] (LOCAL). */
type BoxSpec = [number, number, number, number, number, number];

// ── CORRIDOR ENVELOPE (REBUILD v2 R5b — fully-modelled). The WALKABLE box is UNCHANGED from the
//    greybox so the KCC collision + the SHIP_CORRIDOR_ENTER_Z/SHIP_DEAD_END_Z beat triggers + the
//    cockpit aft-doorway join are byte-identical: floor top y=0, inner walls x ±1.0, ceiling
//    underside y=2.4, the tunnel runs local z ≈2.6 (mouth, meeting the cockpit +Z doorway) → 14.6
//    (dead-end). The rich geometry lives at/outside this envelope (recessed panels, ribs proud of
//    the wall, ceiling greeble ABOVE 2.4) so the player still walks a clean 2m×2.4m tube.
const COR_HW = 1.0;            // walkable half-width (inner wall face at x ±1.0)
const COR_CH = 2.4;           // ceiling underside (walkable height)
const COR_Z0 = 2.6;           // corridor mouth (joins the cockpit +Z doorway, whose outer face is z 2.6)
const COR_Z1 = 14.6;          // the dead-end bulkhead inner face (SHIP_DEAD_END_Z region)
const COR_LEN = COR_Z1 - COR_Z0;    // 12
const COR_ZC = (COR_Z0 + COR_Z1) / 2;   // 8.6 (tunnel centre)
const COR_WALL_T = 0.2;       // structural wall/floor/ceiling thickness (matches the collider spec)

// ── POD-BAY → AIRLOCK RE-ARCHITECTURE (W2b, user playtest 2026-07-03). The escape pod is now a
//    VESSEL DOCKED TO THE SHIP, not parked in an open closet. Reading corridor → outboard (−X):
//      1. an OPERATIONAL SLIDING DOOR in the corridor −X wall plane (2 leaves that slide apart into
//         wall pockets — setBayAirlockDoor drives it; the engine-room glass idiom but OPAQUE + it
//         actually OPENS). Closed = the wall is sealed (a collider blocks). Open = a walk-through.
//      2. a short GASKETED AIRLOCK COLLAR (a docking passage) behind the sliding door — the ribbed
//         tube that mates the ship to the pod. Walkable.
//      3. the POD'S OWN DOOR at the collar's FAR (outboard) end — the canonical pod's merged glass
//         front door IS the airlock's far end (an airlock-style connection). E-open it to board.
//      4. the POD BODY sits MOSTLY OUTSIDE the ship's hull (beyond the −X wall plane); only its
//         door-face/collar side protrudes into the airlock ring → it reads DOCKED, not parked.
//    The airlock opening spans BAY_Z0..BAY_Z1 on the −X wall; buildCorridor skips the −X structural
//    wall + finish there (the sliding door + collar fill it). The +X wall / floor / ceiling / tube
//    envelope + the corridor collider set are UNCHANGED. Placed near the mouth (bridge end) — the
//    first thing the fleeing eye meets.
const BAY_Z0 = 3.2;           // airlock opening start (local z)
const BAY_Z1 = 6.4;           // airlock opening end (local z) — a ~3.2m aperture span
const BAY_ZC = (BAY_Z0 + BAY_Z1) / 2;   // 4.8 — airlock centre (the docked pod's local z + door centreline)
// The airlock APERTURE (the sliding-door opening cut in the −X wall) — sized to the pod door + a
//   comfortable walk-through. The door aperture is W 1.02 (frozen); the sliding-door opening is a
//   touch wider so the collar/pod-door read inside it.
const AIRLOCK_HW = 0.72;      // sliding-door opening half-width (1.44m clear — clears the KCC + frames the pod door)
const AIRLOCK_TOP = 2.18;     // sliding-door opening top (a tall walk-through, under the ceiling)
const AIRLOCK_WALL_X = -COR_HW;   // the −X corridor wall plane (x = −1.0) — the sliding-door plane
// The COLLAR — the gasketed docking passage from the wall plane (−1.0) outboard to the pod door
//   face. Short (a docking collar, not a room). Its outboard end is the pod-door plane.
const COLLAR_LEN = 0.92;      // collar depth (−X) from the wall plane to the pod-door face
const COLLAR_FAR_X = AIRLOCK_WALL_X - COLLAR_LEN;   // −1.92 — the pod-door face plane (collar far end)
// The DOCKED POD — frozen dims (the sibling builds to these): R 1.44; door on the +X arc; door
//   aperture W 1.02 / H 1.98 / centre-height CY 1.10 above the pod base. The pod's +X arc (door
//   face) sits AT the collar-far plane, so the pod hull is mostly OUTSIDE the ship (x < −1.0).
const BAY_POD_R = 1.44;       // MATCH POD_R (podScene) — the 2.88m-diameter capsule the player rides
const BAY_POD_X = COLLAR_FAR_X - BAY_POD_R;   // −3.36 — pod centre X (only the +X door-arc protrudes toward the collar)
// Is a corridor-wall emission on the −X wall inside the airlock opening span? (buildCorridor SKIPS
// the −X structural wall + finish panels there so the sliding door + collar + docked pod show).
function _inBayGap(z: number): boolean { return z > BAY_Z0 - 0.05 && z < BAY_Z1 + 0.05; }

// ── X4 item-2 — THE STARBOARD (+X) VIEWPORT STRIP. ONE long framed rectangular viewport band in the
//    +X corridor wall (opposite the airlock/quarters −X side), at standing-eye height. The opaque
//    −X-family _shell wall is CUT over the band + replaced with SEALED tinted glass showing space/the
//    planet (the camera-relative space dome reads through it). The COLLIDER stays solid (item 2: cut
//    NO walkable opening — the wall blocks, only the glass is see-through). Placed where the walk
//    passes (between the corridor mouth and the engine room). A slim mullioned frame (rule 7 depth).
const VP_Z0 = 7.2;                        // viewport band fore edge (z)
const VP_Z1 = 12.2;                       // viewport band aft edge (z) — a ~5m strip
const VP_CY = 1.58;                        // band vertical centre (standing eye ~1.5-1.7m)
const VP_HH = 0.42;                        // band half-height (glass 0.84m tall; sill ~1.16, head ~2.0)
const VP_WALL_X = COR_HW;                  // +X corridor wall plane (x=1.0)
// Is a +X corridor greeble emission over the viewport band (skip the finish panel there — the frame
//   + glass dress it)?  (z within the band + the vertical band is handled per-emission by y.)
function _inViewportZ(z: number): boolean { return z > VP_Z0 - 0.05 && z < VP_Z1 + 0.05; }

// ── X4 item-3 — the ACTUAL structural −X wall APERTURE (the hole the sliding door + collar fill).
//    The old build gapped the FULL BAY_Z0..BAY_Z1 (3.2..6.4) span of the −X structural wall, but the
//    blast-door frame only covers the aperture ± its jamb posts (z 4.08..5.52) — so the flanking
//    strips z 3.2..4.08 (fore) + 5.52..6.4 (aft) were LEFT OPEN to the void: the tan space-bg leaked
//    through at floor + ceiling beside the frame (the user's "SPACE visible left+right of the pod-bay
//    entrance"). FIX: the structural −X wall now only gaps the true aperture (BAY_ZC ± AIRLOCK_HW, up
//    to AIRLOCK_TOP); the flanking strips + the above-aperture band are SOLID wall again (matching the
//    CORRIDOR_COLLIDERS fore/aft jambs + lintel exactly = WYSIWYG). `_inBayGap` still gates the finish
//    greeble off the whole bay recess (the docked pod shows through the aperture), but the STRUCTURE
//    seals the void beside the frame.
const BAY_APERTURE_Z0 = BAY_ZC - AIRLOCK_HW;   // 4.08 — the sliding-door opening fore edge
const BAY_APERTURE_Z1 = BAY_ZC + AIRLOCK_HW;   // 5.52 — the sliding-door opening aft edge

// ── X4 item-1 — THE CREW QUARTERS. A small lived-in cabin off the −X corridor wall (same side as the
//    airlock), DOWN the corridor toward the engine room (well aft of the bay, before the dead-end).
//    A sliding door (the airlock/engine-room leaf idiom) in the −X wall → the room OUTBOARD of the
//    hull (x < −1.0). Walkable: floor/ceiling/back/side walls + a door gap; matching colliders +
//    a clean entranceway (the corridor greeble is gated off the door front by `_inQuartersGap`).
const QTR_ZC = 9.6;                       // the quarters door + room centreline (between ribs 8.8 & 10.6)
const QTR_DOOR_HW = 0.62;                 // door opening half-width (1.24m clear walk-through)
const QTR_DOOR_TOP = 2.06;                // door opening top
const QTR_WALL_X = -COR_HW;               // the −X corridor wall plane (x=−1.0) — the door plane
const QTR_FAR_X = QTR_WALL_X - 3.1;       // −4.1 — the room's outboard back wall (a ~3m-deep cabin)
const QTR_Z0 = 8.2;                       // room fore wall (z)
const QTR_Z1 = 12.0;                      // room aft wall (z) — a ~3.8m-wide cabin
const QTR_H = 2.4;                        // room ceiling underside (walkable height, matches the corridor)
const QTR_XC = (QTR_WALL_X + QTR_FAR_X) / 2;   // room centre X
// Is a −X corridor-wall / greeble emission over the quarters DOOR aperture? (skip it for a clean
//   entranceway — no pipe/rail/panel/strip barring the door front).
function _inQuartersDoor(z: number): boolean { return z > QTR_ZC - QTR_DOOR_HW - 0.06 && z < QTR_ZC + QTR_DOOR_HW + 0.06; }

// ── Static-collider specs for the CORRIDOR walkable shell (WYSIWYG — the KCC walks these). These
//    are BYTE-IDENTICAL to the old greybox CORRIDOR_SPECS so collision + flow are unchanged, EXCEPT
//    the −X wall is now GAPPED at the airlock opening: the old single −X wall spanned z 2.6..14.6;
//    the airlock aperture is z BAY_Z0..BAY_Z1 (3.2..6.4), so the wall is split into a FORE stub
//    (z 2.6..3.2) + an AFT run (z 6.4..14.6) leaving the airlock walkable. AIRLOCK_COLLIDERS (below)
//    then wall off the collar + floor it + the sliding-door leaf (state-driven) seals it when shut.
const _BAY_WALL_FORE_LEN = BAY_Z0 - COR_Z0;                 // 0.6 — corridor mouth → airlock opening
// −X aft-wall run split around the QUARTERS door (z QTR_ZC ± QTR_DOOR_HW = 8.98..10.22): a run from
//   the airlock aperture end (6.4) → the quarters door fore edge, + a run from the door aft edge →
//   the dead-end (14.6). The quarters door aperture is walkable INTO the room (its own colliders wall
//   the room); below/above the door stays solid via the sill + lintel below.
const _QTR_DOOR_Z0 = QTR_ZC - QTR_DOOR_HW;   // 8.98
const _QTR_DOOR_Z1 = QTR_ZC + QTR_DOOR_HW;   // 10.22
const _AFT_A_LEN = _QTR_DOOR_Z0 - BAY_Z1;    // 6.4 → 8.98
const _AFT_B_LEN = COR_Z1 - _QTR_DOOR_Z1;    // 10.22 → 14.6
const CORRIDOR_COLLIDERS: ReadonlyArray<BoxSpec> = [
  [2, 0.2, 12, 0, -0.1, 8.6],   // corridor floor  (top y=0)
  [2, 0.2, 12, 0, 2.5, 8.6],    // corridor ceiling (underside y=2.4)
  [0.2, 2.4, 12, 1.1, 1.2, 8.6], // +X wall (inner face x=1.0)
  // −X wall, GAPPED at the airlock opening — a fore stub + an aft run split at the quarters door.
  [0.2, 2.4, _BAY_WALL_FORE_LEN, -1.1, 1.2, COR_Z0 + _BAY_WALL_FORE_LEN / 2],  // −X wall fore (z 2.6..3.2)
  [0.2, 2.4, _AFT_A_LEN, -1.1, 1.2, BAY_Z1 + _AFT_A_LEN / 2],                  // −X aft-A (z 6.4..8.98, up to the quarters door)
  [0.2, 2.4, _AFT_B_LEN, -1.1, 1.2, _QTR_DOOR_Z1 + _AFT_B_LEN / 2],            // −X aft-B (z 10.22..14.6, quarters door → dead-end)
  // −X wall JAMBS flanking the airlock aperture (the solid wall either side of the 1.44m opening),
  //   over the airlock z-span, from the opening edge out to the walkable wall line — so you can't
  //   slip past the sliding-door frame into the collar off-centre.
  [0.2, 2.4, (BAY_ZC - AIRLOCK_HW) - BAY_Z0, -1.1, 1.2, (BAY_Z0 + (BAY_ZC - AIRLOCK_HW)) / 2],  // fore jamb
  [0.2, 2.4, BAY_Z1 - (BAY_ZC + AIRLOCK_HW), -1.1, 1.2, ((BAY_ZC + AIRLOCK_HW) + BAY_Z1) / 2],  // aft jamb
  [0.2, 2.4 - AIRLOCK_TOP, 2 * AIRLOCK_HW, -1.1, (AIRLOCK_TOP + 2.4) / 2, BAY_ZC],               // lintel over the opening
  // QUARTERS door — a SILL below the opening (0..0.05 flush step) + a LINTEL above (top→ceiling) so
  //   only the walk-through gap is open; the room floor is flush (the sill is cosmetic-thin).
  [0.2, 2.4 - QTR_DOOR_TOP, 2 * QTR_DOOR_HW, -1.1, (QTR_DOOR_TOP + 2.4) / 2, QTR_ZC],            // quarters lintel over the door
  [2, 2.4, 0.2, 0, 1.2, 14.7],   // dead-end bulkhead (inner face z=14.6 — the disaster trigger)
];

// ── X4 item-1 — THE CREW QUARTERS walkable envelope (the room OUTBOARD of the −X wall). Floor +
//    ceiling + back wall + two side walls (fore/aft) box the room; the door gap in the −X corridor
//    wall (above, walkable) is the only way in. Spec = [w,h,d, cx,cy,cz] LOCAL to SHIP_ORIGIN.
const _QTR_DEPTH = QTR_WALL_X - QTR_FAR_X;            // 3.1 — room X depth
const _QTR_WIDTH = QTR_Z1 - QTR_Z0;                   // 3.8 — room Z width
const QUARTERS_COLLIDERS: ReadonlyArray<BoxSpec> = [
  [_QTR_DEPTH + 0.2, 0.2, _QTR_WIDTH + 0.2, QTR_XC, -0.1, (QTR_Z0 + QTR_Z1) / 2],           // room floor (top y=0, flush)
  [_QTR_DEPTH + 0.2, 0.2, _QTR_WIDTH + 0.2, QTR_XC, QTR_H + 0.1, (QTR_Z0 + QTR_Z1) / 2],     // room ceiling (underside y=2.4)
  [0.2, QTR_H + 0.2, _QTR_WIDTH + 0.2, QTR_FAR_X - 0.1, QTR_H / 2, (QTR_Z0 + QTR_Z1) / 2],   // back (outboard −X) wall
  [_QTR_DEPTH + 0.2, QTR_H + 0.2, 0.2, QTR_XC, QTR_H / 2, QTR_Z0 - 0.1],                      // fore (−Z) side wall
  [_QTR_DEPTH + 0.2, QTR_H + 0.2, 0.2, QTR_XC, QTR_H / 2, QTR_Z1 + 0.1],                      // aft (+Z) side wall
  // NOTE: the room's CORRIDOR-SIDE face (the −X wall line, flanking the door) is already sealed by
  //   the CORRIDOR_COLLIDERS −X aft-A/aft-B runs (they span z 6.4..8.98 + 10.22..14.6 at x=−1.0);
  //   the door gap (8.98..10.22) is the only opening. So no extra returns are needed here (they'd
  //   duplicate the corridor wall). The room is entered ONLY through the door.
  // ── Z2 OVERHAUL — FURNITURE COLLIDERS (CLAUDE.md rule 9: the re-lofted room's solids block movement,
  //   updated in the SAME change as the geometry; the old room had NONE, so you could walk through the
  //   bunk). Each box = [w,h,d, cx,cy,cz], derived from the buildCrewQuarters coordinates. Verified by
  //   the quarters-walk motion probe (rig-shot --scenario=quarters-walk). Spec math (COR_WALL_T=0.2):
  //     back wall inner face = QTR_FAR_X+0.1 = −4.0; bunkDepth 0.78 → berth front x=−3.22.
  //   BUNK BERTH — a solid built-in from the back wall to the berth front, full height to the canopy,
  //     running z 9.1..11.25 (foot off the desk, head off the lockers, Z2 r3). Blocks walking into it.
  [0.78, 1.96, 2.15, (QTR_FAR_X + 0.1 + 0.39), 0.98, (QTR_Z0 + 0.9 + QTR_Z1 - 0.75) / 2],
  //   LOCKER BANK — the two tall aft-wall lockers (x −3.50..−2.24, proud to z≈11.46, Z2 r3), full height.
  [1.30, 1.86, 0.50, (QTR_FAR_X + 1.23), 0.94, (QTR_Z1 - 0.1 - 0.22)],
  //   FOLD-DOWN DESK — the fore-wall work surface, moved DOOR-SIDE (deskX=−1.95, z≈8.56), floor→desktop.
  [0.94, 0.86, 0.56, (QTR_WALL_X - 0.95), 0.43, (QTR_Z0 + 0.1 + 0.26)],
  //   STOWAGE CRATE — the fore-corner floor crate (a 0.44 cube on the deck).
  [0.48, 0.46, 0.48, (QTR_FAR_X + 0.34), 0.23, (QTR_Z0 + 0.34)],
  //   BASE CABINET — Z2 r5 (SEV2 #3) — the low aft-wall base cabinet (x≈−1.55, z front≈11.52, 0.66 tall)
  //     that fills the dead base band; it protrudes into the walk space so it blocks (rule 9).
  [0.90, 0.66, 0.38, (QTR_FAR_X + 2.55), 0.33, (QTR_Z1 - 0.1 - 0.19)],
];

// ── THE AIRLOCK COLLAR walkable envelope (the docking passage). The player walks through the open
//    sliding door into the short collar and up to the POD DOOR at its far end. These box colliders
//    floor + wall + cap the collar so they can't fall out of the world; the pod-door plane at the
//    far end is walled by the pod's own hull-ring colliders (gapped at the door). Collar spans
//    x AIRLOCK_WALL_X..COLLAR_FAR_X (−1.0..−1.92), z BAY_Z0..BAY_Z1, floor top y=0 (flush deck).
//    Spec = [w,h,d, cx,cy,cz] LOCAL to SHIP_ORIGIN.
const _COLLAR_XC = (AIRLOCK_WALL_X + COLLAR_FAR_X) / 2;   // −1.46 (collar centre X)
// The pod BORE floor — a walkable deck INSIDE the docked pod's hull (the bay pod is a noCollider prop
//   with no interior floor of its own; the ridden-cabin floor is podScene's job in a DIFFERENT frame).
//   Without this the player walks through the open pod door + falls to space. Spans collar-far → past
//   the pod centre, over the bore width; floor top y=0 (flush with the collar deck).
const _BORE_X0 = COLLAR_FAR_X, _BORE_X1 = BAY_POD_X - BAY_POD_R + 0.15;   // −1.92 .. −4.65 (inner hull)
const AIRLOCK_COLLIDERS: ReadonlyArray<BoxSpec> = [
  // collar floor (flush with the corridor deck — a seamless step-in, no lip)
  [COLLAR_LEN + 0.2, 0.2, (BAY_Z1 - BAY_Z0), _COLLAR_XC, -0.1, BAY_ZC],
  // collar ceiling (caps the passage)
  [COLLAR_LEN + 0.2, 0.2, (BAY_Z1 - BAY_Z0), _COLLAR_XC, COR_CH + 0.1, BAY_ZC],
  // the two SIDE walls closing the collar fore/aft (so you can't slip beside the collar tube)
  [COLLAR_LEN + 0.2, COR_CH + 0.4, 0.2, _COLLAR_XC, COR_CH / 2, BAY_ZC - AIRLOCK_HW - 0.1],
  [COLLAR_LEN + 0.2, COR_CH + 0.4, 0.2, _COLLAR_XC, COR_CH / 2, BAY_ZC + AIRLOCK_HW + 0.1],
  // the pod BORE floor (walkable deck inside the docked pod — so walking through the pod door lands
  //   on a floor, not a fall to space). The pod-hull-ring colliders (_addBayPodColliders) wall it.
  [_BORE_X0 - _BORE_X1 + 0.2, 0.2, BAY_POD_R * 1.9, (_BORE_X0 + _BORE_X1) / 2, -0.1, BAY_ZC],
];

// ── Static-collider specs for the COCKPIT walkable shell (WYSIWYG — the KCC walks these).
//    A1 FIX (user walk-test 2026-07-02): the R5a re-loft replaced the flat BOX walls with the
//    tapered/canted `hullProfile(z)` D-section but LEFT this array byte-identical to the old box
//    (side walls at inner face x=3.0). Result: near the nose the visible wall is at x≈1.96 at
//    torso height while the collider let the player walk out to x=3.0 → the player CLIPPED THROUGH
//    the visible skin (and hit invisible walls where the taper is wide). Fix = CURVE-FIT the side
//    walls (`curve-fit-collider-segments.md`): 6 box segments per side along Z, each inner face set
//    to `hullProfile`'s wall x at ~shoulder height (y≈1.15) at the segment's narrow end — so the
//    collider surface tracks the visible taper+cant within ~0.3m everywhere (the tolerance the user
//    allows). Deck edge (below knee, unreachable coving) sits a hair outboard → WYSIWYG at the walk
//    band. The FLOOR (flat), the −Z window-sill walls, and the +Z DOOR-WALL segments stay UNCHANGED
//    so the doorway↔corridor join (SHIP_CORRIDOR_ENTER_Z) is byte-identical + walkable. Values
//    generated from `hullProfile` (see the audit in buildShipScene's collider-sample verify).
//    Y1 GLAZED-DOME REBUILD (rule 9 — colliders match the visible model). The whole FORWARD hull is
//    demolished: the −Z window-sill band, the above-glass band, the forward cheeks, and the FORWARD
//    side-wall segments (z < COLLAR_Z) are all DELETED. The glass-line wall (so the player can't walk
//    through the glass) is a curve-fit RING of ROTATED box segments generated in `_addDomeColliders`
//    from the dome sill footprint (added alongside this array in buildShipScene). This axis-aligned
//    array keeps: the floor, the ceiling, the AFT side walls (only aft of the collar), + the aft door
//    wall (byte-identical — the corridor join must stay walkable).
const COCKPIT_COLLIDERS: ReadonlyArray<BoxSpec> = [
  [6, 0.2, 5, 0, -0.1, 0],         // floor (flat deck — unchanged, full length)
  [3.5, 0.2, 5, 0, 3.1, 0],        // ceiling — aft/over-seat only (the dome crown owns forward; keep it from z≈−2.5..2.5 at the mid width so look-up isn't capped by an invisible plate over the glass)
  // ── AFT SIDE WALLS — curve-fit to the lofted hullProfile, ONLY aft of the collar (z ≥ COLLAR_Z≈0.34).
  //    The forward segments are gone (demolished hull). −X then +X.
  [0.2, 3, 0.80, -2.610, 1.5, 0.34],
  [0.2, 3, 0.80, -2.790, 1.5, 1.10],
  [0.2, 3, 0.68, -2.895, 1.5, 1.84],
  [0.2, 3, 0.80, 2.610, 1.5, 0.34],
  [0.2, 3, 0.80, 2.790, 1.5, 1.10],
  [0.2, 3, 0.68, 2.895, 1.5, 1.84],
  // ── AFT (+Z) DOOR WALL (UNCHANGED — the corridor join must stay byte-identical + walkable).
  [2, 3, 0.2, -2, 1.5, 2.6],       // left of corridor opening
  [2, 3, 0.2, 2, 1.5, 2.6],        // right of corridor opening
  [2, 0.6, 0.2, 0, 2.7, 2.6],      // above corridor opening
];
// ── THE GLAZED-DOME PERIMETER WALL (rule 9). A curve-fit ring of ROTATED thin box segments hugging
//    the dome SILL footprint (the outer bound the walking player would reach), floor→ceiling tall, so
//    the KCC is blocked exactly at the glass line — no walking through the canopy. Generated from
//    `_domeNode(m, 0)` (the sill ring) so it tracks the visible glass by construction. Each segment
//    spans two adjacent sill nodes, biased a hair inboard so the collider face sits just inside the
//    glass. Built at SHIP_ORIGIN by the caller. A dedicated fn (rotated boxes — the axis-aligned array
//    can't express the arc). `curve-fit-collider-segments.md`.
function _addDomeColliders(ctx: GameContext): void {
  const inb = new THREE.Vector3(DOME_CX, DOME_CY, DOME_CZ);   // dome centre — "inboard" is toward this
  const H = 3.2;                                              // floor→header tall (block the whole walk band; > CK_H so no over/under-slip)
  const cyLocal = H / 2 - 0.05;                              // segment centred so its bottom sits at ≈floor y=−0.05
  // LIVE-fix (2026-07-05): the OLD ring built segments from the front meridian nodes + TWO closure
  //   bridges, but a KCC could still slip out at the side closures (the segments didn't fully back the
  //   closure glass floor-to-header + left gaps at the closure↔collar corner). REBUILD: walk the ONE
  //   canonical `_domeSillRing()` (left collar → front arc → right collar) and drop a tall wall segment
  //   per edge, biased inboard, OVERLAPPING neighbours — so EVERY glass span (front panes AND both side
  //   closures) is backed floor-to-header with no azimuth gap. Proven by the full-circle containment
  //   probe (cockpit-glass-seal scenario).
  const ring = _domeSillRing();
  const WALLTHK = 0.30;   // half-thickness INTO the hull (the outboard side is unreachable dead space past
                          //   the glass) — thick enough that a fast KCC can never tunnel the angled wall.
  for (let i = 0; i < ring.length - 1; i++) {
    const a = ring[i], b = ring[i + 1];
    const mid = a.clone().add(b).multiplyScalar(0.5);
    const toC = new THREE.Vector3(inb.x - mid.x, 0, inb.z - mid.z).normalize();
    // bias the wall so its INBOARD face sits ~0.10 inside the glass: push the box centre OUTboard by its
    //   half-thickness minus 0.10 (the inboard face lands just inside the glass; the thick body fills the
    //   dead space out to the hull, so no tunnelling + no reachable outboard face).
    const cx = mid.x - toC.x * (WALLTHK - 0.10);
    const cz = mid.z - toC.z * (WALLTHK - 0.10);
    const segLen = a.distanceTo(b) + 0.20;                    // generous overlap (no azimuth gap between segs)
    const yaw = Math.atan2(b.x - a.x, b.z - a.z);             // segment heading in XZ (about +Y)
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    const col = makeStaticBox(
      ctx.physics.world,
      { x: segLen / 2, y: H / 2, z: WALLTHK },               // long × tall × THICK (thickness into the hull)
      { x: SHIP_ORIGIN.x + cx, y: SHIP_ORIGIN.y + cyLocal, z: SHIP_ORIGIN.z + cz },
      q,
    );
    const body = col.parent();
    if (body) shipBodies.push(body);   // tracked for dispose (like the array colliders)
  }
  // CORNER PILLARS — a tall box at every ring node (incl. the collar termini) so the angle change
  //   between two rotated wall segments can never leave a slot at the joint. Sized to swallow the node.
  for (const n of ring) {
    const toC = new THREE.Vector3(inb.x - n.x, 0, inb.z - n.z).normalize();
    const cx = n.x - toC.x * (WALLTHK - 0.10);
    const cz = n.z - toC.z * (WALLTHK - 0.10);
    const col = makeStaticBox(
      ctx.physics.world,
      { x: WALLTHK, y: H / 2, z: WALLTHK },
      { x: SHIP_ORIGIN.x + cx, y: SHIP_ORIGIN.y + cyLocal, z: SHIP_ORIGIN.z + cz },
    );
    const body = col.parent();
    if (body) shipBodies.push(body);
  }
}

let shipGroup: THREE.Group | null = null;
const shipBodies: RAPIER.RigidBody[] = [];
const _disposables: THREE.BufferGeometry[] = [];
const _buildMats: THREE.Material[] = [];
// ── A5/A4e — FURNITURE colliders (the chair + the console clusters). Paired inline with the
//    visual build (`paired-build-visual-and-collider-descriptors.md`): each solid furniture piece
//    pushes a LOCAL box spec here as it's built; buildShipScene creates the static boxes at
//    SHIP_ORIGIN + the spec. The player can't walk THROUGH the chair or the consoles (the user's
//    A5 complaint). Cleared each dispose. Spec = [w,h,d, cx,cy,cz] (LOCAL to SHIP_ORIGIN).
const _furnitureColliders: BoxSpec[] = [];
function _addFurnitureCollider(w: number, h: number, d: number, cx: number, cy: number, cz: number): void {
  _furnitureColliders.push([w, h, d, cx, cy, cz]);
}
// Alert-state hooks (setCockpitAlert) — refs captured at build, recolored on escalation.
let _alertScreenGlow: THREE.Mesh | null = null;
let _alertStatusLeds: THREE.Mesh[] = [];
let _alertWashLight: THREE.PointLight | null = null;   // the console wash → red flood
let _alertRimLight: THREE.DirectionalLight | null = null; // a red rim across the shell on alert
let _alertBeaconLight: THREE.PointLight | null = null;  // a real red beacon SOURCE (falloff + pulse)
let _alertBeaconMesh: THREE.Mesh | null = null;         // the beacon dome (its emissive pulses)
let _alertStripMats: THREE.MeshBasicMaterial[] = [];    // rib strip-lights (dark→red on alert)
let _alertKeyLights: THREE.Light[] = [];               // the warm keys → dimmed on alert
let _alertAmbient: THREE.HemisphereLight | null = null; // the cabin ambient → reddened on alert
let _cockpitAlertLevel: 0 | 1 | 2 = 0;

// ── A per-cockpit IBL env map — required so the cool brushed-aluminium PBR metals reflect
//    something (metalness without an envMap renders near-black). PMREM-baked from RoomEnvironment;
//    applied per-material (NOT scene.environment) so it never leaks to the desert world. Freed in
//    disposeShipScene. The list of metal mats that take the env (the unlit/basic ones don't).
let _cockpitEnv: THREE.Texture | null = null;
const _ENV_MATS = (): THREE.MeshStandardMaterial[] => [
  _shell, _band, _steel, _channel, _rivet, _deck, _ceil, _cable,
  _seat, _seatWorn, _seatBack, _seatArm, _seam, _strap, _strapWorn, _screenGlass, _winFrame, _glass,
  _bucklePlate,
];
// ── R5a MATERIAL-FEEL PASS — env intensity is the PRISTINE/SHINY tell. At 0.85 every big flat
//    panel MIRRORED the bright planet → the "showroom sheen" the user + gate flagged. Cut hard:
//    the big matte hull/deck/ceiling panels take a WHISPER of env (0.85 → 0.20) so they stop
//    reflecting the scene; the seat vinyls (already the tan-wedge risk) go lower still (0.12 →
//    0.08); small hardware (rivets) + the glass keep a bit more so worn studs + the canopy still
//    catch a highlight (that reads as USED hardware, not showroom).
const _LOW_ENV = new Set<THREE.Material>([_seat, _seatWorn, _seatBack, _seam, _strap, _strapWorn]);   // seat vinyls + harness webbing (R5a-r6: no scene catch → no tan blowout)
const _MED_ENV = new Set<THREE.Material>([_rivet, _glass, _winFrame, _screenGlass, _bucklePlate]); // worn hardware/glass keep a small catch
const _NO_ENV = new Set<THREE.Material>([_seatArm]);   // R5a-r6: forward tan-wedge forms take ZERO env (no scene catch → can't warm to tan)
function _applyCockpitEnv(env: THREE.Texture | null): void {
  for (const m of _ENV_MATS()) {
    m.envMap = env;
    m.envMapIntensity = _NO_ENV.has(m) ? 0.0 : _LOW_ENV.has(m) ? 0.08 : _MED_ENV.has(m) ? 0.40 : 0.14;
    m.needsUpdate = true;
  }
}

// ── T3.4 DISASTER-STAGING hooks (the corridor is greybox MeshBasicMaterial = unlit, so the
//    red-alert is a material TINT, not a light; the engine fire is additive emissive geometry).
//    setShipAlert tints the captured corridor mats red + strobes; setEngineFire erupts/flickers
//    the engine-bay fire at the dead-end. Disposed/cleared in disposeShipScene.
const _corridorMats: { mat: THREE.MeshBasicMaterial; base: THREE.Color }[] = [];
const _ALERT_RED = new THREE.Color(0xff1808);
let _engineFire: THREE.Group | null = null;
const _fireMats: THREE.MeshBasicMaterial[] = [];
let _shipAlertLevel: 0 | 2 = 0;
// ── R5b — the corridor is now LIT metal (not unlit greybox), so setShipAlert drives REAL lights,
//    not a material tint: the normal recessed fixtures + fill DROP toward dark, and the corridor's
//    own RED strip-lights + a pulsing beacon fire. Refs captured at build, restored on level 0.
const _corrNormalLights: THREE.Light[] = [];       // recessed can-lights + fill — dimmed on alert
const _corrLensMats: THREE.MeshBasicMaterial[] = [];    // the warm fixture lenses — cut on alert
const _corrRedStripMats: THREE.MeshBasicMaterial[] = []; // wall/ceiling red channel strips — dark→red
let _corrRedLight: THREE.PointLight | null = null;      // a pulsing red flood down the corridor on alert
let _corrRedLight2: THREE.PointLight | null = null;     // a second red source (mid-corridor) for even wash
// ── B1.e — THE ENGINE ROOM (behind a glass sliding door at the corridor dead-end). Refs captured
//    at build; setEngineFire drives the fire INSIDE the room + the orange glow through the glass.
let _engineGlowLight: THREE.PointLight | null = null;   // the fire's glow inside the room (through the glass)
let _engineSpillLight: THREE.PointLight | null = null;  // the orange spill leaking corridor-side through the glass
const _engineGlassMats: THREE.MeshStandardMaterial[] = [];   // the sliding-door panes (emissive lifts with the fire)
let _engineDoorJudderL: THREE.Group | null = null;      // the two sliding-door leaves (judder on fire)
let _engineDoorJudderR: THREE.Group | null = null;

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
/** An OPEN-ENDED cylinder BAND (no end caps) — a see-through ring/hoop. Used for the docking-bellows
 *  convolutions + mating flanges so you look THROUGH the collar to the pod (a capped _cyl reads as a
 *  solid disc). DoubleSide so the inner wall shows when viewed down the axis. */
function _ring(r: number, h: number, seg: number, mat: THREE.Material): THREE.Mesh {
  const g = new THREE.CylinderGeometry(r, r, h, seg, 1, true);   // openEnded
  _disposables.push(g);
  const m = new THREE.Mesh(g, mat);
  return m;
}
/** A GAPPED open-ended cylinder band — an arc that SKIPS a wedge centred on a door azimuth so a band
 *  wrapping the pod barrel does NOT cross the door aperture (COCKPIT-ROUND-2 item 9). `gapCenterTheta`
 *  is the CylinderGeometry theta at the gap centre (three.js: theta 0 → +Z, π/2 → +X); `gapHalf` is the
 *  half-angle to omit. The band spans (gapCenter+gapHalf) → (gapCenter+2π−gapHalf). Axis = local Y. */
function _arcBand(r: number, h: number, seg: number, mat: THREE.Material, gapCenterTheta: number, gapHalf: number): THREE.Mesh {
  const thetaStart = gapCenterTheta + gapHalf;
  const thetaLength = Math.PI * 2 - gapHalf * 2;
  const g = new THREE.CylinderGeometry(r, r, h, Math.max(6, seg), 1, true, thetaStart, thetaLength);
  _disposables.push(g);
  return new THREE.Mesh(g, mat);
}
/** A small flush dome rivet stud (a half-sphere) at (x,y,z), domed toward `faceDir`.
 *  X1 BOLT-ORIENTATION FIX (user walk-test 2026-07-04: "cockpit bolts must sit flush on their
 *  surface — undersides were exposed"). ROOT CAUSE: a SphereGeometry hemisphere (thetaStart 0 →
 *  θ=π/2) domes along its LOCAL +Y axis, with the flat cut face at the base (−Y). But the old code
 *  used `mesh.lookAt(pos + faceDir)`, which aligns the mesh's local −Z (not +Y) to faceDir — so the
 *  dome pointed 90° OFF the surface normal and the flat underside cut showed edge-on. FIX: align the
 *  dome's +Y axis directly to faceDir with setFromUnitVectors, so the round crown faces out along the
 *  surface normal and the flat cut seats flush against the surface (no exposed underside). */
function _stud(x: number, y: number, z: number, faceDir: THREE.Vector3, mat: THREE.Material, r = 0.018): THREE.Mesh {
  const g = new THREE.SphereGeometry(r, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2);
  _disposables.push(g);
  const m = new THREE.Mesh(g, mat);
  m.position.set(x, y, z);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), faceDir.clone().normalize());
  return m;
}
// ── A custom-vertex skin mesh from a flat list of triangle vertices (each tri = 9 floats).
//    Used to loft the curved fuselage cross-sections into a real hull surface.
function _skin(verts: number[], mat: THREE.Material): THREE.Mesh {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  g.computeVertexNormals();
  _disposables.push(g);
  return new THREE.Mesh(g, mat);
}
// ── Like _skin, but carries a UV attribute (per-vertex u,v) — the canopy glass needs real UVs so
//    its onBeforeCompile sheen/tint gradient reads across the pane (computeVertexNormals leaves uv
//    unset otherwise → the shader's vGlassLocal was garbage).
function _skinUV(verts: number[], uvs: number[], mat: THREE.Material): THREE.Mesh {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.computeVertexNormals();
  _disposables.push(g);
  return new THREE.Mesh(g, mat);
}

// ── THE FUSELAGE CROSS-SECTION — this is what BREAKS THE BOX. For a station at depth `z`
//    (−CK_Z..CK_Z) it returns a chamfered, vaulted half-profile: an arc of [x, y] points from
//    the floor edge (low, near the wall) up over a CANTED (tumblehome) side wall to a VAULTED
//    crown at the centre-top. Mirrored about x=0 → a full hull hoop. The nose (−Z) TAPERS
//    narrower + the crown drops, so the eye reads a fuselage narrowing to the windscreen, not a
//    rectangular room. The floor stays FLAT (the collider/walk envelope); the curve lives above
//    ~waist height where the player can't reach the canted upper corners anyway.
const HULL_PTS = 9;            // arc samples up the continuous D-section (per half)
const HULL_CROWN_MAX = 2.96;  // vault apex cap (≤2.98 collider top — gate contract)
// A CONTINUOUS D-SECTION half-profile (the gate fix: "wall rolls into floor + ceiling, no flat
// vertical face, no 90° floor seam"). From the deck edge: a floor CHAMFER coving up into a
// gently-curved lower wall, continuously bending through the shoulder into the vaulted crown —
// ONE smooth curve, no hard corner. Nose (−Z) tapers narrower + the crown drops.
function hullProfile(z: number): { x: number; y: number }[] {
  const tz = (z + CK_Z) / CK_D;                 // 0 at nose, 1 at tail
  const taper = THREE.MathUtils.lerp(0.76, 1.0, THREE.MathUtils.smoothstep(tz, 0.0, 0.85));
  const halfW = CK_X * taper;                   // deck half-width here
  const crownY = THREE.MathUtils.lerp(2.58, HULL_CROWN_MAX, THREE.MathUtils.smoothstep(tz, 0.0, 0.9));
  const pts: { x: number; y: number }[] = [];
  // (1) floor COVING — a short chamfer rolling the deck edge up into the wall (no 90° seam).
  pts.push({ x: halfW - 0.06, y: 0.0 });        // on the deck, just inboard of the wall
  pts.push({ x: halfW, y: 0.14 });              // chamfer top → the lower wall
  // (2) ONE continuous super-ellipse-ish arc from (halfW, 0.14) to the crown (0, crownY). Use a
  //     blended cosine so the lower portion is near-vertical and it bends smoothly to horizontal
  //     at the crown — the "D" / rounded-rectangle tube section.
  const yLow = 0.14;
  for (let i = 1; i <= HULL_PTS; i++) {
    const t = i / HULL_PTS;                      // 0..1 along the arc
    const a = t * (Math.PI / 2);
    // x: stays wide low (cos^1.4 keeps the lower wall near-vertical), tucks in toward the crown
    const x = halfW * Math.pow(Math.cos(a), 1.35);
    // y: rises slowly low then sweeps to the crown (sin^0.85 → fuller shoulder)
    const y = yLow + (crownY - yLow) * Math.pow(Math.sin(a), 0.85);
    pts.push({ x, y });
  }
  return pts;                                   // [deckEdge, chamfer, ...continuous arc..., crown]
}

// ── A2 helper — the hull WALL x (positive, one side) at station z, at height y. Interpolates the
//    hullProfile polyline by y. Used to re-seat wall-adjacent furniture (side consoles, panels)
//    FLUSH to the real canted/tapered wall so nothing floats off it or embeds into it (the user's
//    "floating pieces / built off the previous box" complaint). Above the crown → the crown x.
function hullWallXAt(z: number, y: number): number {
  const p = hullProfile(z);
  for (let i = 0; i < p.length - 1; i++) {
    const a = p[i], b = p[i + 1];
    if ((y >= a.y && y <= b.y) || (y >= b.y && y <= a.y)) {
      const t = (y - a.y) / ((b.y - a.y) || 1e-6);
      return a.x + (b.x - a.x) * t;
    }
  }
  return p[p.length - 1].x;
}

// ── COCKPIT SHELL — REBUILD v2 R5a: NO LONGER A BOX. A lofted, ribbed, VAULTED fuselage shell:
//    a flat walkable deck, side walls that CANT inward to a vaulted/ribbed roof (structural hoop
//    frames arc over the cabin), the cross-section TAPERING to the nose, and a RAKED faceted
//    windscreen forward. The OLD collider box (COCKPIT_COLLIDERS) is unchanged — the curved skin
//    lives at/outside that envelope above waist height (unreachable corners), the deck + the aft
//    doorway stay WYSIWYG so the walk + corridor join are byte-identical.
function buildCockpitShell(group: THREE.Group): void {
  // FLOOR — LIVE-fix (2026-07-05): the OLD floor was a full rectangular slab (x[−3,3] z[−2.5,2.5]) that
  //   PROTRUDED far past the dome glass line into space — the user walked out through the (then-open)
  //   side glass and stood on the floor OUTSIDE the canopy. The floor is now a LOFTED PLATE trimmed to
  //   the dome sill footprint forward of the collar (so the floor edge meets the glass line exactly) and
  //   kept full-width AFT of the collar (behind the opaque hull, and to meet the corridor). Boundary:
  //   aft rectangle (±CK_X, z ∈ [COLLAR_Z, CK_Z]) → the dome sill ring forward. Fan-triangulated from an
  //   interior spine point (the footprint is star-shaped about the cabin walk centre).
  {
    const floorTopY = 0.0;                 // sub-floor top (deck plate sits +0.02 above)
    const ring = _domeSillRing();          // left collar → front arc → right collar (sill height, y=0.545)
    // the forward boundary in XZ (project the sill ring to the deck) + the aft rectangle corners.
    const bnd: THREE.Vector2[] = [];
    bnd.push(new THREE.Vector2(CK_X, CK_Z));                 // aft-right corner
    bnd.push(new THREE.Vector2(CK_X, COLLAR_Z));             // right side aft-of-collar (full width to hull)
    // right collar → front arc → left collar (reverse the ring so the loop stays clockwise in XZ)
    for (let i = ring.length - 1; i >= 0; i--) bnd.push(new THREE.Vector2(ring[i].x, ring[i].z));
    bnd.push(new THREE.Vector2(-CK_X, COLLAR_Z));            // left side aft-of-collar
    bnd.push(new THREE.Vector2(-CK_X, CK_Z));               // aft-left corner
    // fan-triangulate the sub-floor (dark) + the deck plate (bright, +0.02, inset 3cm) from the spine.
    const spine = new THREE.Vector2(0, 1.0);                 // interior point (aft of the front arc, inside)
    const subV: number[] = [], deckV: number[] = [];
    const push = (arr: number[], x: number, y: number, z: number) => arr.push(x, y, z);
    for (let i = 0; i < bnd.length; i++) {
      const a = bnd[i], b = bnd[(i + 1) % bnd.length];
      // sub-floor (top face at floorTopY)
      push(subV, spine.x, floorTopY, spine.y); push(subV, a.x, floorTopY, a.y); push(subV, b.x, floorTopY, b.y);
      // deck plate (top face at +0.02, boundary pulled in 0.03 so the sub-floor rim shows as a lip)
      const inset = (p: THREE.Vector2) => { const d = p.clone().sub(spine); const L = d.length() || 1; return p.clone().sub(d.multiplyScalar(0.03 / L)); };
      const ai = inset(a), bi = inset(b);
      push(deckV, spine.x, 0.02, spine.y); push(deckV, ai.x, 0.02, ai.y); push(deckV, bi.x, 0.02, bi.y);
    }
    const floor = _skin(subV, _channel); group.add(floor);
    // give the sub-floor plate real thickness so its underside/edge doesn't read paper-thin from the
    //   outside-looking-in vantage: a matching down-face + a rim skirt around the boundary.
    const underV: number[] = [], rimV: number[] = [];
    for (let i = 0; i < bnd.length; i++) {
      const a = bnd[i], b = bnd[(i + 1) % bnd.length];
      push(underV, spine.x, -WALL_T, spine.y); push(underV, b.x, -WALL_T, b.y); push(underV, a.x, -WALL_T, a.y);
      // rim skirt (vertical wall from the boundary top down to the underside)
      rimV.push(a.x, floorTopY, a.y, a.x, -WALL_T, a.y, b.x, floorTopY, b.y);
      rimV.push(b.x, floorTopY, b.y, a.x, -WALL_T, a.y, b.x, -WALL_T, b.y);
    }
    group.add(_skin(underV, _channel));
    group.add(_skin(rimV, _channel));
    const deck = _skin(deckV, _deck); group.add(deck);
    // AFT THRESHOLD SILL — LIVE-fix (2026-07-05): the cockpit floor ends at z=CK_Z=2.5 and the corridor
    //   floor starts at COR_Z0=2.6 → a 0.1m slot at the doorway where stars showed THROUGH the floor
    //   (the user's straight-down threshold shot). A solid sill plate spans z[2.30..2.80] full doorway
    //   width, OVERLAPPING both plates so there is no gap; the yellow doorway stripe sits on it. Its
    //   collider is added below (rule 9).
    const thr = _box(CK_W - 0.1, WALL_T, 0.50, _channel);
    thr.position.set(0, -WALL_T / 2 + 0.001, 2.55);          // top flush at y≈0, centred on the seam
    group.add(thr);
    const thrDeck = _box(CK_W - 0.2, 0.04, 0.50, _deck);
    thrDeck.position.set(0, 0.02, 2.55);
    group.add(thrDeck);
    // paired collider for the threshold sill (spans the seam so no slot a foot could drop through).
    _addFurnitureCollider(CK_W - 0.1, WALL_T, 0.50, 0, -WALL_T / 2 + 0.001, 2.55);
  }
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
  const up = new THREE.Vector3(0, 1, 0);
  // ── DECK PANEL SEAMS — break the flat deck into riveted plates (gate: floor was a flat plane).
  //    Cross seams + corner fasteners → reads as a real bolted deck, not cardboard.
  for (const sz0 of [-1.6, -0.6, 0.4, 1.4]) {
    const seam = _box(CK_W - 0.5, 0.012, 0.03, _channel);
    seam.position.set(0, 0.043, sz0);
    group.add(seam);
    for (const fx of [-2.0, -1.0, 1.0, 2.0]) group.add(_stud(fx, 0.05, sz0, up, _rivet, 0.013));
  }
  for (const sx0 of [-1.5, 1.5]) {
    const seam = _box(0.03, 0.012, CK_D - 0.5, _channel);
    seam.position.set(sx0, 0.043, 0.0);
    group.add(seam);
  }
  // deck-plate rivet ring near the floor edge
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const rx = Math.cos(a) * (CK_X - 0.4), rz = Math.sin(a) * (CK_Z - 0.4);
    group.add(_stud(rx, 0.05, rz, up, _rivet, 0.016));
  }

  // ── THE LOFTED VAULTED HULL SKIN (this is the box-breaker). Loft the chamfered, tapering
  //    hullProfile() cross-section along Z. Y1 DEMOLITION: the skin now starts at the COLLAR
  //    (COLLAR_Z, just behind the seated shoulders) — the WHOLE forward hull is gone, replaced by
  //    the glazed dome. So the opaque ribbed hull only exists AFT of the pilot; forward of the
  //    collar the shell is glass on a skeleton. Built as a triangle-soup skin per side (mirrored),
  //    DOUBLE-skinned so torn edges never read paper-thin. The aft 0.4m is left flat (the door wall
  //    owns it). The deck stays flat below the profile foot + runs the FULL length (kept).
  const SECZ: number[] = [];
  const segZ = 6;
  for (let s = 0; s <= segZ; s++) SECZ.push(THREE.MathUtils.lerp(COLLAR_Z, CK_Z - 0.42, s / segZ));
  const profiles = SECZ.map((z) => hullProfile(z));
  // per-profile-point OUTWARD 2D normals (so the outer shell offsets uniformly along the whole
  // section — no gated band, no coincident-skin z-fight). Normal of the polyline at point i.
  const OFF = 0.08;
  const normals = profiles.map((p) => p.map((_, i) => {
    const a = p[Math.max(0, i - 1)], b = p[Math.min(p.length - 1, i + 1)];
    const tx = b.x - a.x, ty = b.y - a.y;          // tangent
    const nx = ty, ny = -tx;                        // 2D normal (points outboard for this winding)
    const L = Math.hypot(nx, ny) || 1;
    return { nx: nx / L, ny: ny / L };
  }));
  for (const side of [1, -1]) {
    const innerV: number[] = [];
    const outerV: number[] = [];
    for (let s = 0; s < SECZ.length - 1; s++) {
      const z0 = SECZ[s], z1 = SECZ[s + 1];
      const p0 = profiles[s], p1 = profiles[s + 1];
      const n0 = normals[s], n1 = normals[s + 1];
      for (let i = 0; i < p0.length - 1; i++) {
        const a = { x: side * p0[i].x, y: p0[i].y, z: z0 };
        const b = { x: side * p0[i + 1].x, y: p0[i + 1].y, z: z0 };
        const c = { x: side * p1[i].x, y: p1[i].y, z: z1 };
        const d = { x: side * p1[i + 1].x, y: p1[i + 1].y, z: z1 };
        if (side > 0) {
          innerV.push(a.x, a.y, a.z, c.x, c.y, c.z, b.x, b.y, b.z);
          innerV.push(b.x, b.y, b.z, c.x, c.y, c.z, d.x, d.y, d.z);
        } else {
          innerV.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
          innerV.push(b.x, b.y, b.z, d.x, d.y, d.z, c.x, c.y, c.z);
        }
        // outer skin: each vertex pushed out along ITS OWN 2D normal (uniform shell thickness)
        const ao = { x: side * (p0[i].x + n0[i].nx * OFF), y: p0[i].y + n0[i].ny * OFF, z: z0 };
        const bo = { x: side * (p0[i + 1].x + n0[i + 1].nx * OFF), y: p0[i + 1].y + n0[i + 1].ny * OFF, z: z0 };
        const co = { x: side * (p1[i].x + n1[i].nx * OFF), y: p1[i].y + n1[i].ny * OFF, z: z1 };
        const dn = { x: side * (p1[i + 1].x + n1[i + 1].nx * OFF), y: p1[i + 1].y + n1[i + 1].ny * OFF, z: z1 };
        if (side > 0) {
          outerV.push(ao.x, ao.y, ao.z, bo.x, bo.y, bo.z, co.x, co.y, co.z);
          outerV.push(bo.x, bo.y, bo.z, dn.x, dn.y, dn.z, co.x, co.y, co.z);
        } else {
          outerV.push(ao.x, ao.y, ao.z, co.x, co.y, co.z, bo.x, bo.y, bo.z);
          outerV.push(bo.x, bo.y, bo.z, co.x, co.y, co.z, dn.x, dn.y, dn.z);
        }
      }
    }
    group.add(_skin(innerV, _shell));
    group.add(_skin(outerV, _ceil));
  }

  // ── STRUCTURAL HOOP RIBS — the fuselage frames. At a set of Z stations, a chunky channel-steel
  //    arch follows the hullProfile (a ring of short box segments hugging the curve) so the eye
  //    reads "ribbed fuselage", not "flat ceiling". Rivet studs march along each rib.
  //    HEAVY bulkhead frames (z=-0.9, 1.3) are wider/deeper; lighter intermediates between. Each
  //    rib is darker, more-specular steel (pops OFF the hull), with a rivet row down the flange +
  //    a bracket GUSSET where it lands on the deck. A keel STRINGER runs the crown fore-aft.
  // Y1 DEMOLITION: every rib FORWARD of the collar (the old −1.35 / −0.5 A-pillar ribs) is DELETED —
  //   there is no opaque forward hull to rib. Only the AFT ribs (behind the pilot) remain; the glass
  //   dome is framed by its OWN metal skeleton (buildGlazedDome), and the collar (buildCollar) is the
  //   forwardmost structural hoop.
  const ribDefs: [number, boolean][] = [[0.5, true], [1.3, true], [2.2, false]];
  for (const [rz, heavy] of ribDefs) {
    const prof = hullProfile(rz);
    const w = heavy ? 0.16 : 0.09, dep = heavy ? 0.17 : 0.11;
    for (const side of [1, -1]) {
      for (let i = 0; i < prof.length - 1; i++) {
        const ax = side * prof[i].x, ay = prof[i].y;
        const bx = side * prof[i + 1].x, by = prof[i + 1].y;
        const mx = (ax + bx) / 2, my = (ay + by) / 2;
        const len = Math.hypot(bx - ax, by - ay) + 0.02;
        const rib = _box(w, len, dep, _steel);
        rib.position.set(mx, my, rz);
        rib.rotation.z = Math.atan2(by - ay, bx - ax) - Math.PI / 2;
        group.add(rib);
        const inward = new THREE.Vector3(-Math.sign(mx || side), -0.2, 0).normalize();
        group.add(_stud(mx, my, rz + dep * 0.55, inward, _rivet, heavy ? 0.018 : 0.013));
      }
      // a bracket GUSSET where the rib foot meets the deck (a triangular knee)
      const foot = { x: side * prof[0].x, y: prof[0].y };
      const gus = _box(w + 0.04, 0.18, dep + 0.05, _channel);
      gus.position.set(foot.x - side * 0.04, 0.12, rz);
      group.add(gus);
    }
  }
  // KEEL STRINGER along the crown (fore-aft) — ties the AFT ribs together overhead. Y1: truncated to
  //   the aft section only (from the collar to the door wall) — forward of the collar the crown is
  //   the glass dome + its skeleton crown spine (buildGlazedDome), not an opaque stringer.
  const stringerLen = (CK_Z - 0.25) - COLLAR_Z;
  const stringer = _box(0.08, 0.10, stringerLen, _steel);
  stringer.position.set(0, HULL_CROWN_MAX - 0.05, COLLAR_Z + stringerLen / 2);
  group.add(stringer);
  for (let i = 0; i < 3; i++) group.add(_stud(0, HULL_CROWN_MAX - 0.10, COLLAR_Z + 0.4 + i * 0.9, new THREE.Vector3(0, -1, 0), _rivet, 0.014));

  // ── SIDE-WALL detailing — Y1: only AFT of the collar now (forward walls are demolished). A clean
  //    kickplate skirt + a subtle panel-line, seated on the aft hull wall behind the pilot.
  for (const sx of [-1, 1]) {
    const pz = 1.4;   // an aft panel-line scribe (behind the seat)
    const wpv = hullWallXAt(pz, 0.75);
    const pv = _box(0.012, 1.4, 0.018, _channel);
    pv.position.set(sx * (wpv - 0.02), 0.75, pz);
    group.add(pv);
    // kickplate skirt at the floor — aft section only (collar → door wall)
    const kickLen = (CK_Z - 0.2) - COLLAR_Z;
    const kickWallMin = hullWallXAt(1.2, 0.13);
    const kick = _box(0.05, 0.26, kickLen, _steel);
    kick.position.set(sx * (kickWallMin - 0.02), 0.13, COLLAR_Z + kickLen / 2);
    group.add(kick);
  }

  // ── THE FORWARD SHELL — Y1 REBUILD. The whole opaque forward hull (skin, ribs, soffit, overhead
  //    console, windscreen) is DEMOLISHED. In its place: ONE structural COLLAR hoop at the shoulder
  //    line + a GLAZED DOME that wraps the pilot left/overhead/right down to a low sill. The console
  //    (buildConsoleBank) sits under the forward panes; the collar/aft hull are only behind the
  //    shoulders. See buildCollar + buildGlazedDome above.
  buildCollar(group);
  buildGlazedDome(group);

  // ── AFT TRANSITION COLLAR — loft the last hull ring (z=CK_Z−0.42) to the FLAT aft bulkhead plane
  //    (z=afZ) so the curved fuselage ROLLS into the door wall (no abrupt curved-meets-flat seam).
  const afZ = CK_Z - 0.02;
  const aftIn = new THREE.Vector3(0, 0, -1);
  {
    const ringZ = CK_Z - 0.42;
    const prof = hullProfile(ringZ);
    for (const side of [1, -1]) {
      const collarV: number[] = [];
      for (let i = 0; i < prof.length - 1; i++) {
        // curved ring point → flattened toward the bulkhead rectangle (clamp x to door+frame width)
        const a = { x: side * prof[i].x, y: prof[i].y, z: ringZ };
        const b = { x: side * prof[i + 1].x, y: prof[i + 1].y, z: ringZ };
        const fx = (px: number) => side * Math.min(Math.abs(px), CK_X);
        const c = { x: fx(prof[i].x), y: Math.min(prof[i].y, CK_H), z: afZ };
        const d = { x: fx(prof[i + 1].x), y: Math.min(prof[i + 1].y, CK_H), z: afZ };
        if (side > 0) {
          collarV.push(a.x, a.y, a.z, c.x, c.y, c.z, b.x, b.y, b.z);
          collarV.push(b.x, b.y, b.z, c.x, c.y, c.z, d.x, d.y, d.z);
        } else {
          collarV.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
          collarV.push(b.x, b.y, b.z, d.x, d.y, d.z, c.x, c.y, c.z);
        }
      }
      group.add(_skin(collarV, _ceil));
    }
  }

  // ── AFT (+Z) DOOR WALL — the bulkhead segments around the doorway (≥0.10m thick — rule #7) + a
  //    real bulkhead doorway. Side segments + head close the wall around the corridor opening.
  for (const sx of [-1, 1]) {
    const side = _box(CK_X - DOOR_X, CK_H, 0.12, _shell);
    side.position.set(sx * (DOOR_X + (CK_X - DOOR_X) / 2), CK_H / 2, afZ);
    group.add(side);
    const rib = _box(0.07, CK_H - 0.3, 0.14, _steel);
    rib.position.set(sx * (CK_X - 0.6), CK_H / 2, afZ - 0.07);
    group.add(rib);
    // ── R5a-r3 SEV-2 #2 — bring the flat aft bay UP TO THE RIBS' BAR. A recessed darker sub-panel
    //    + panel-line seams + a bolt row + a scuffed-bright proud plate, so the big flat face takes
    //    light as PLATES, not one value.
    const inward = new THREE.Vector3(0, 0, -1);
    const bayX = sx * (DOOR_X + (CK_X - DOOR_X) / 2);
    // a recessed darker access sub-panel (a channel-steel inset → a value break + depth)
    const recess = _box((CK_X - DOOR_X) - 0.5, 1.1, 0.04, _channel);
    recess.position.set(bayX, 1.5, afZ - 0.055);
    group.add(recess);
    // a proud brighter plate above it (painted hull plate → a third value)
    const plate = _box((CK_X - DOOR_X) - 0.7, 0.6, 0.05, _band);
    plate.position.set(bayX, 2.45, afZ - 0.06);
    group.add(plate);
    // horizontal panel-line seams across the bay
    for (const py of [0.55, 2.05]) {
      const seamH = _box((CK_X - DOOR_X) - 0.2, 0.02, 0.02, _channel);
      seamH.position.set(bayX, py, afZ - 0.06);
      group.add(seamH);
    }
    // a vertical panel line
    const seamV = _box(0.02, CK_H - 0.4, 0.02, _channel);
    seamV.position.set(bayX + sx * 0.35, CK_H / 2, afZ - 0.06);
    group.add(seamV);
    // a bolt row down the recess edge
    for (let k = 0; k < 6; k++) {
      group.add(_stud(bayX - sx * 0.62, 1.05 + k * 0.18, afZ - 0.075, inward, _rivet, 0.014));
    }
    // a conduit run dropping down the bay (lived-in greeble — gate: aft walls bare greybox)
    const cond = _cyl(0.035, 0.035, 1.6, 7, _cable);
    cond.position.set(bayX + sx * 0.55, 1.3, afZ - 0.10);
    group.add(cond);
    for (const cy of [0.7, 1.5, 2.1]) {
      const clamp = _cyl(0.05, 0.05, 0.03, 7, _rivet);
      clamp.rotation.x = Math.PI / 2;
      clamp.position.set(bayX + sx * 0.55, cy, afZ - 0.12);
      group.add(clamp);
    }
  }
  const aHead = _box(2 * DOOR_X, CK_H - DOOR_Y1, 0.12, _shell);
  aHead.position.set(0, (DOOR_Y1 + CK_H) / 2, afZ);
  group.add(aHead);
  buildDoorway(group, afZ, aftIn);

  // ── STENCILLED PLACARDS / LABELS (lived-in — gate: walls had no labels). A hull-serial plate
  //    beside the door + a unit-number panel near a rib + small warning labels. Printed decals.
  const serial = _box(0.34, 0.10, 0.008, _decal);   // hull serial plate beside the doorway
  serial.position.set(DOOR_X + 0.42, 2.2, afZ - 0.07);
  group.add(serial);
  const serialTxt = _box(0.28, 0.04, 0.004, _hazard);
  serialTxt.position.set(DOOR_X + 0.42, 2.2, afZ - 0.078);
  group.add(serialTxt);
  // X1 CLEANUP: the yellow-hazard "unit-number" panel that floated on the −X side wall near the
  //   heavy rib is DELETED (the user flagged a yellow box out of place on the cockpit side wall).
}

/** THE CANOPY — X1 FULL REBUILD (user walk-test 2026-07-04, full-rebuild scope explicitly approved:
 *  "revise the WHOLE shape of the cockpit… the glass should have multiple angled panes that connect
 *  together and kind of wrap around part of the top, right, and left sides… right now the glass is
 *  more just a flat sheet in the front which is kinda boring… we need to get it right"). Reference:
 *  a framed panoramic freighter canopy (Millennium-Falcon-like) — slim structural mullions between
 *  angled panes, a huge view of space from the pilot seat.
 *
 *  The old build (W1: ONE gently-bowed sheet with a converging birdcage of hair-thin curved spars)
 *  is DELETED. The new canopy is a set of DISCRETE FLAT ANGLED PANES (research digest
 *  docs/research/cockpit-canopy-design.md, findings 1/2/9): a wide raked front broken into 3 panes
 *  (a wide centre + a raked pane each side), two TOP panes tilting down over the pilot, and two SIDE
 *  panes that angle inward + pull AFT so the glass wraps past the shoulder line. Between every pane is
 *  a REAL structural mullion — a box beam ~9cm wide × 14cm deep (CLAUDE.md rule 7: a 3D lip, not a
 *  decal) — and the glass is OFFSET ~2cm behind the mullion front faces (no z-fight at shared edges).
 *  Panes seal to the hull opening by construction (their outer corners land on the hull-wall perimeter
 *  `_canopyNode(u=±1)`). Sill LOW (0.55, ~0.8m below the seated eye 1.35), header HIGH (2.78, into the
 *  crown) → the vista dominates the seated field of view. Verts wound so the glass faces the cabin. */
// ================================================================================================
//  THE GLAZED CANOPY DOME - Y1 FULL REBUILD (user walk-test 2026-07-04, 3rd cockpit pass, structural
//  fix, PLAN-approved docs/plan-y-queue.md Y1). The user's verdict on the prior 2 canopies: "still a
//  tunnel with a window at the front; the glass doesn't line up with the hull; messy, not connected;
//  nothing like the references." ROOT CAUSE the plan names: both prior builds kept the opaque lofted
//  D-section hull forward and cut a WINDOW into it -> the hull stayed a tunnel, the glass a front hole,
//  and the top/sides were OPAQUE metal (look-left from the seat = a wall of ribs). The reference
//  (Falcon-class) is the inverse: the front section IS the glazing - a GLASS SHELL on a METAL
//  SKELETON, almost no opaque hull forward of the pilot.
//
//  THE FIX (user-locked design): DEMOLISH the whole forward hull (skin + ribs + soffit + overhead +
//  windscreen). Forward of a single structural COLLAR hoop (at the shoulder line, z=COLLAR_Z), the
//  shell is a GLASS DOME that wraps LEFT -> OVERHEAD -> RIGHT continuously down to a LOW front sill -
//  so from the seat, looking 9-o'clock / straight-up / 3-o'clock all read GLASS + skeleton, sky in
//  every forward direction. The dome is a PARAMETRIC NODE FIELD (rings x meridians) -> pane counts /
//  angles / sill / crown are cheap to retune after review. Every pane edge carries a real metal
//  member (rule 7 depth); the glass sits IN the skeleton, recessed ~2cm -> alignment is by
//  construction, no pane floats free of a frame. Research digest: docs/research/cockpit-canopy-design.md
//  (findings 1/2/4/9 - trapezoidal tessellation of a curved shell, flat angled panes read panoramic,
//  low sill relative to the seated eye reads "huge").
// ================================================================================================

// -- DOME PARAMETERS (all cheap to retune) -------------------------------------------------------
const COLLAR_Z = 0.34;             // the springing hoop: just AFT of the seated shoulders (seat back ~ +0.05).
//   The dome is a shell of an ellipsoid centred on the PILOT'S HEAD. Meridians sweep the azimuth
//   (left->front->right), rings sweep the elevation (low front sill -> overhead crown). This guarantees
//   overhead + side glass by construction (a node's y/x/z come straight from (elevation, azimuth)).
const DOME_CX = 0.0;               // dome centre x (pilot head, on axis)
const DOME_CY = 1.30;              // dome centre y (~ the seated eye height)
const DOME_CZ = -0.12;             // dome centre z (~ the seated head, a hair fwd of the seat cushion)
const DOME_RX = 2.42;              // lateral radius (reaches to ~the hull side at the sill)
const DOME_RY = 1.52;              // vertical radius (crown tops out ~ DOME_CY + RY*sin(elCrown) ~ 2.75)
const DOME_RZ = 2.46;              // forward radius (front sill reaches ~ DOME_CZ - RZ*cos ~ -2.4, the nose)
const DOME_AZ_MAX = 1.42;          // +/-81deg azimuth at the side meridians -> the glass wraps PAST the shoulders
const DOME_EL_SILL = -0.52;        // -30deg elevation at the sill ring -> sill y~0.55 (a LOW sill, well below eye ~1.35)
const DOME_EL_CROWN = 1.15;        // +66deg elevation at the crown ring (well overhead -> look-up = glass)
// A dome node from parametric (m in [-1,1] azimuth: -1 left, 0 front, +1 right) x (t in [0,1] ring: 0
//   sill, 1 crown). The elevation eases sill->crown so the lower panes stand tall + the top lies back.
function _domeNode(m: number, t: number): THREE.Vector3 {
  const az = m * DOME_AZ_MAX;
  const te = THREE.MathUtils.smoothstep(t, 0, 1);          // ease so ring spacing reads even on the sphere
  const el = THREE.MathUtils.lerp(DOME_EL_SILL, DOME_EL_CROWN, te);
  const ce = Math.cos(el), se = Math.sin(el);
  // forward is -Z; the shell faces the cabin. az>0 = the pilot's RIGHT (+X).
  const x = DOME_CX + DOME_RX * ce * Math.sin(az);
  const y = DOME_CY + DOME_RY * se;
  const z = DOME_CZ - DOME_RZ * ce * Math.cos(az);
  return new THREE.Vector3(x, y, z);
}
// The meridian / ring grid. COCKPIT-ROUND-2 item-1 (user: "too many mullions too close together —
//   fewer, WIDER panes; the view is the product"): re-parameterized from 7 meridians (6 columns) down
//   to 5 meridians → 4 WIDE columns × 2 bands = 8 trapezoid panes (+ 2 side-closure strips/side = the
//   wrap to the collar). Each glass cell is now clearly wider; the skeleton frames the vista instead of
//   crowding it. Columns: L side-wrap . L-centre . R-centre . R side-wrap (4 wide cells across the front).
const _DOME_M = [-1.0, -0.5, 0.0, 0.5, 1.0];                  // 5 meridians (was 7) → 4 wide columns
const _DOME_T = [0.0, 0.52, 1.0];                             // 3 rings (sill, waist, crown) → 2 bands

// ── LIVE-fix (2026-07-05) — THE ONE SOURCE OF TRUTH FOR THE DOME BASE/PERIMETER. The dome sill line
//    is NOT just the front arc between the meridian nodes: it must include the two SIDE-CLOSURE spans
//    (the wrap from each outer dome meridian back to the collar side). The floating-glass defect + the
//    walk-through-glass hole + the floor-protrudes-past-glass defect all came from three separate bits
//    of code disagreeing about where that line is. This helper returns the FULL ordered sill footprint
//    ring (XZ at sill height), used by: the closure glass, the base skirt/kick, the trimmed floor plate,
//    AND the collider ring — so every one of them lands on the SAME perimeter by construction.
const DOME_SILL_Y = 0.545;                        // the dome sill node y (≈ _domeNode(m,0).y)
// The collar-side terminus of each closure at the sill: land it ON the collar ring plane (z=COLLAR_Z),
//   at the collar hull side x, inset a hair so the glass/skirt tucks just inside the collar flange.
function _collarSillPt(side: number): THREE.Vector3 {
  const cp = hullProfile(COLLAR_Z);
  // interpolate the collar half-profile x at the sill height (so the closure meets the collar at the
  //   right width, not the deck-edge width).
  let x = cp[cp.length - 1].x;
  for (let i = 0; i < cp.length - 1; i++) {
    const A = cp[i], B = cp[i + 1];
    if ((DOME_SILL_Y >= A.y && DOME_SILL_Y <= B.y) || (DOME_SILL_Y >= B.y && DOME_SILL_Y <= A.y)) {
      const t = (DOME_SILL_Y - A.y) / ((B.y - A.y) || 1e-6);
      x = A.x + (B.x - A.x) * t; break;
    }
  }
  return new THREE.Vector3(side * (x - 0.05), DOME_SILL_Y, COLLAR_Z);
}
// The full sill footprint ring, left-collar → left-closure → front arc → right-closure → right-collar.
//   All at DOME_SILL_Y. Returned as XZ-carrying Vector3s (y = sill height).
function _domeSillRing(): THREE.Vector3[] {
  const ring: THREE.Vector3[] = [];
  ring.push(_collarSillPt(-1));                                  // left collar terminus
  for (let mi = 0; mi < _DOME_M.length; mi++) ring.push(_domeNode(_DOME_M[mi], 0));  // −1..+1 front arc
  ring.push(_collarSillPt(1));                                   // right collar terminus
  return ring;
}

// ── FABRICATED SKELETON MEMBERS (user feedback 2026-07-04 on the Mk-II canopy: "the mullions look way
//    too blocky and don't connect cleanly, and are on weird angles"). Three fixes are baked in here:
//    (1) MEMBER PROFILE — every member is a BEVELED beam (a chamfered-rectangle / elongated-hex cross-
//        section extruded along its length), not a raw BoxGeometry, so it reads as a fabricated
//        structural section (eased corners catch a highlight line) instead of a flat blocky bar.
//    (2) REAL JOINTS — every node carries a NODE BOSS (a beveled octagonal hub) that both members
//        visibly enter; the members are drawn a hair SHORT so their ends tuck INSIDE the boss → no
//        butt-gaps, no overshoot, no two beams crossing through each other at an angle.
//    (3) RHYTHM lives in the node field (_DOME_M / _DOME_T even steps); members just follow it.
// A shared beveled cross-section (a rectangle with the 4 corners cut) → one Shape, scaled per member.
const _BEVEL_SHAPE = (() => {
  const s = new THREE.Shape();
  // unit half-extents 0.5 × 0.5; chamfer c on each corner → an octagon reading as a chamfered beam.
  const c = 0.28;
  s.moveTo(-0.5 + c, -0.5); s.lineTo(0.5 - c, -0.5); s.lineTo(0.5, -0.5 + c); s.lineTo(0.5, 0.5 - c);
  s.lineTo(0.5 - c, 0.5); s.lineTo(-0.5 + c, 0.5); s.lineTo(-0.5, 0.5 - c); s.lineTo(-0.5, -0.5 + c);
  s.closePath();
  return s;
})();
// A beveled member between p and q with cross-section (w across × d deep). Extruded along +Z then
//   oriented so its length runs p→q, scaled to (w,d). The ends are inset by `short` so they tuck into
//   the node bosses. Shared geometry is impractical (per-length), so cache by a coarse length key.
const _beamGeoCache = new Map<string, THREE.ExtrudeGeometry>();
function _beveledBeam(p: THREE.Vector3, q: THREE.Vector3, w: number, d: number, mat: THREE.Material, short = 0.06): THREE.Mesh {
  const dir = q.clone().sub(p);
  const len = Math.max(0.04, dir.length() - short);
  const key = w.toFixed(3) + '|' + d.toFixed(3) + '|' + len.toFixed(2);
  let geo = _beamGeoCache.get(key);
  if (!geo) {
    geo = new THREE.ExtrudeGeometry(_BEVEL_SHAPE, { depth: len, bevelEnabled: false, steps: 1 });
    geo.translate(0, 0, -len / 2);                 // centre the extrusion on the origin
    geo.scale(w, d, 1);                            // w across the frame plane, d into the cabin
    _beamGeoCache.set(key, geo);
    _disposables.push(geo);
  }
  const m = new THREE.Mesh(geo, mat);
  m.position.copy(p.clone().add(q).multiplyScalar(0.5));
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir.clone().normalize());
  return m;
}
// A NODE BOSS — a squat beveled hub centred on a joint so members enter it cleanly (hides ends/angles).
//   Faces the cabin (its axis ≈ the local surface normal). r sized to swallow the members meeting here.
function _nodeBoss(centre: THREE.Vector3, faceDir: THREE.Vector3, r: number, mat: THREE.Material): THREE.Mesh {
  const g = new THREE.CylinderGeometry(r, r * 1.06, r * 1.1, 8);   // 8-sided beveled hub (slight taper)
  _disposables.push(g);
  const m = new THREE.Mesh(g, mat);
  m.position.copy(centre);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), faceDir.clone().normalize());
  return m;
}

/** THE GLAZED DOME SHELL - 12 flat trapezoid glass panes on the parametric node field, each framed by
 *  a real metal skeleton member; a heavy crown spine + collar-line members, lighter mullions between
 *  panes (hierarchy). Called from buildCockpitShell after the collar. */
function buildGlazedDome(group: THREE.Group): void {
  const IN = 0.02;   // glass sits 2cm behind (outboard of) the skeleton front faces -> no z-fight.
  // outboard = away from the pilot-head centre (the local surface normal ~ node - centre).
  const centre = new THREE.Vector3(DOME_CX, DOME_CY, DOME_CZ);
  const outward = (p: THREE.Vector3): THREE.Vector3 => p.clone().sub(centre).normalize();

  // -- PANES: a flat quad per (column, band) cell, recessed OUTBOARD by IN so it sits behind the
  //    skeleton. Wound so the lit face points inboard (at the cabin). UVs 0..1 per pane -> the glass
  //    shader's per-facet sheen/tint reads cleanly.
  const glassV: number[] = [], glassUV: number[] = [];
  const node = (mi: number, ti: number): THREE.Vector3 => {
    const p = _domeNode(_DOME_M[mi], _DOME_T[ti]);
    return p.add(outward(p).multiplyScalar(IN));   // recess behind the frame
  };
  // ── PER-CELL INBOARD-WINDING ENFORCEMENT (Z1 haze-parity ROOT-CAUSE FIX, half 1 of 2 — pairs with the
  //    FrontSide switch on _glass). The old hand winding was authored for the SILL band, but the crown
  //    band's quad curves BACK overhead so that same vertex order yields an OUTBOARD-facing front face
  //    there. Back when the glass was DoubleSide this "looked fine" (both faces render) but wrecked
  //    per-cell luma PARITY: a cell whose front face pointed outboard composited its two faces DIFFERENTLY
  //    over black than a correctly-inboard cell → the crown-band (`-hi`) panes measured ~3× the sill-band
  //    body glaze (14.94 vs 5.15 — the user's "top cells don't carry the same haze"). Diagnosed with the
  //    cockpit-glass-cells probe (the FrontSide test isolated it to WINDING, not a UV/view term). FIX:
  //    after emitting a quad's two tris, measure the face normal; if it points OUTBOARD (away from the
  //    pilot-head centre), swap the tri winding (and its UVs) so EVERY glass cell presents its front face
  //    INBOARD. Now that _glass is FrontSide, every cell shows exactly ONE cabin-facing face → identical
  //    single-layer glaze on every cell = parity by construction. Applied to panes AND closures.
  const _pushInboardQuad = (
    v0: THREE.Vector3, v1: THREE.Vector3, v2: THREE.Vector3, v3: THREE.Vector3,
    uv0: [number, number], uv1: [number, number], uv2: [number, number], uv3: [number, number],
  ): void => {
    // tri A = v0,v1,v2 ; tri B = v2,v1,v3 (a consistent quad triangulation). Three.js treats the face
    //   whose vertices wind CCW *as seen from the +normal side* as the FRONT face, and its geometric
    //   normal (right-hand rule on the wound order) points OUT of that front face. We want the FRONT
    //   face to look INBOARD (at the pilot), so the as-authored order is kept when its right-hand normal
    //   already points inboard — i.e. `rhNrm · inboardDir >= 0` — and REVERSED otherwise. (The earlier
    //   sign was inverted, which double-flipped the already-correct sill band; the probe caught it.)
    const centroid = v0.clone().add(v1).add(v2).add(v3).multiplyScalar(0.25);
    const rhNrm = v1.clone().sub(v0).cross(v2.clone().sub(v0)).normalize();
    const inboardDir = centre.clone().sub(centroid).normalize();   // toward the pilot head = inboard
    if (rhNrm.dot(inboardDir) < 0) {
      // already inboard — emit as-is
      glassV.push(v0.x, v0.y, v0.z, v1.x, v1.y, v1.z, v2.x, v2.y, v2.z);
      glassV.push(v2.x, v2.y, v2.z, v1.x, v1.y, v1.z, v3.x, v3.y, v3.z);
      glassUV.push(uv0[0], uv0[1], uv1[0], uv1[1], uv2[0], uv2[1], uv2[0], uv2[1], uv1[0], uv1[1], uv3[0], uv3[1]);
    } else {
      // outboard — reverse each tri's winding (swap the 2nd & 3rd vert of each) so the front face faces in
      glassV.push(v0.x, v0.y, v0.z, v2.x, v2.y, v2.z, v1.x, v1.y, v1.z);
      glassV.push(v2.x, v2.y, v2.z, v3.x, v3.y, v3.z, v1.x, v1.y, v1.z);
      glassUV.push(uv0[0], uv0[1], uv2[0], uv2[1], uv1[0], uv1[1], uv2[0], uv2[1], uv3[0], uv3[1], uv1[0], uv1[1]);
    }
  };
  for (let c = 0; c < _DOME_M.length - 1; c++) {
    for (let b = 0; b < _DOME_T.length - 1; b++) {
      const a = node(c, b), d = node(c + 1, b), e = node(c, b + 1), f = node(c + 1, b + 1);
      // quad (a=lo-left, d=lo-right, e=hi-left, f=hi-right); _pushInboardQuad forces the front face inboard.
      _pushInboardQuad(a, e, d, f, [0, 0], [0, 1], [1, 0], [1, 1]);
    }
  }
  // -- SIDE-CLOSURE GLASS: the outer dome meridian (|m|=1) ends forward of the collar; without this
  //    there is an open triangular GAP to space between the glass side edge and the collar (the "black
  //    void on the left" defect). Continue the WRAP as glass: loft a strip from the outer dome meridian
  //    back to the COLLAR arch (matched by height) per ring, per side, so the glass wraps all the way to
  //    the shoulder line + seals to the collar by construction. The player looks 9/3-o'clock -> glass.
  const cprof = hullProfile(COLLAR_Z);
  const collarPtAtY = (side: number, y: number): THREE.Vector3 => {
    // walk the collar half-profile, interpolate x by y; inset a hair inboard of the ring's inboard face.
    //   LIVE-fix (2026-07-05): the aft edge now lands ON the collar ring plane (z=COLLAR_Z) instead of
    //   0.14 short of it (z=0.20) — that 0.14 stand-off was the "aft edge floats past the hull arch"
    //   star-gap. The collar ring is at z=COLLAR_Z with 0.16 half-depth, so a hair inside (−0.02) keeps
    //   the glass edge tucked just under the collar flange (no z-fight, no gap).
    for (let i = 0; i < cprof.length - 1; i++) {
      const A = cprof[i], B = cprof[i + 1];
      if ((y >= A.y && y <= B.y) || (y >= B.y && y <= A.y)) {
        const t = (y - A.y) / ((B.y - A.y) || 1e-6);
        return new THREE.Vector3(side * (A.x + (B.x - A.x) * t - 0.04), y, COLLAR_Z - 0.02);
      }
    }
    const P = cprof[cprof.length - 1];
    return new THREE.Vector3(side * (P.x - 0.04), Math.min(y, P.y), COLLAR_Z - 0.02);
  };
  for (const side of [-1, 1]) {
    const mi = side < 0 ? 0 : _DOME_M.length - 1;   // the outer meridian for this side
    for (let ti = 0; ti < _DOME_T.length - 1; ti++) {
      const dLo = _domeNode(_DOME_M[mi], _DOME_T[ti]);
      const dHi = _domeNode(_DOME_M[mi], _DOME_T[ti + 1]);
      const cLo = collarPtAtY(side, dLo.y);
      const cHi = collarPtAtY(side, dHi.y);
      // recess the glass a hair outboard so the frame reads proud (match the pane IN)
      for (const v of [dLo, dHi]) v.add(outward(v).multiplyScalar(IN));
      // closure quad (cLo, cHi collar-side; dLo, dHi dome-side); _pushInboardQuad forces the front face
      //   inboard for BOTH sides by construction (no hand winding flip → no per-side/per-band mismatch).
      _pushInboardQuad(cLo, cHi, dLo, dHi, [0, 0], [0, 1], [1, 0], [1, 1]);
    }
  }
  const glassSheet = _skinUV(glassV, glassUV, _glass);
  glassSheet.renderOrder = 2;    // transparent - draw after the opaque hull/collar
  group.add(glassSheet);

  // -- THE METAL SKELETON (user feedback: "mullions too blocky, don't connect cleanly, weird angles").
  //    Every member is a BEVELED beam (_beveledBeam — chamfered section, not a raw box) drawn a hair
  //    SHORT so its ends tuck INSIDE a NODE BOSS at each joint → clean fabricated connections, no
  //    butt-gaps / overshoot / crossing-through. Members sit PROUD (inboard of the glass) for depth.
  //    Hierarchy: heavy members on the crown + collar-line + the two side bows; slim mullions between.
  // COCKPIT-ROUND-2 item-3: cross-sections slimmed ~24% (MW .085→.065, MD .13→.10, HW .115→.088,
  //   HD .15→.115) so the members frame the vista without crowding it; the two side bows stay the
  //   heaviest read.
  const MW = 0.065, MD = 0.10;   // slim mullion cross-section (width across frame plane × depth into cabin)
  const HW = 0.088, HD = 0.115;  // heavy member (crown spine + collar bows + the structural side bows)
  const N = (mi: number, ti: number): THREE.Vector3 => _domeNode(_DOME_M[mi], _DOME_T[ti]);
  // every skeleton segment records its endpoints so we can drop a NODE BOSS wherever ≥2 members meet.
  type Seg = { p: THREE.Vector3; q: THREE.Vector3; w: number; d: number };
  const segs: Seg[] = [];
  // A member = the dark structural beam body + a lighter MACHINED FACE strip proud along its cabin
  //   side + a thin RECESS groove line, so it reads as a real fabricated section (item-3 two-tone).
  const addBeam = (p: THREE.Vector3, q: THREE.Vector3, w: number, d: number): void => {
    group.add(_beveledBeam(p, q, w, d, _domeRecess, 0.07));           // dark body (the recessed steel)
    // the proud machined face rail — narrower + shallower, sat proud toward the cabin (inboard = −normal).
    const mid = p.clone().add(q).multiplyScalar(0.5);
    const inb = mid.clone().sub(new THREE.Vector3(DOME_CX, DOME_CY, DOME_CZ)).normalize().negate();
    const proud = inb.clone().multiplyScalar(d * 0.42);
    const face = _beveledBeam(p.clone().add(proud), q.clone().add(proud), w * 0.60, d * 0.30, _domeFace, 0.10);
    group.add(face);
    segs.push({ p, q, w, d });
  };

  // (1) THE MERIDIAN RIBS — sill→crown along every meridian (the canopy "bows"). |m|≥0.60 = heavy side
  //     bows; inner meridians = slim dividers framing the two wide centre panes.
  for (let mi = 0; mi < _DOME_M.length; mi++) {
    const heavy = Math.abs(_DOME_M[mi]) >= 0.60;
    for (let ti = 0; ti < _DOME_T.length - 1; ti++) addBeam(N(mi, ti), N(mi, ti + 1), heavy ? HW : MW, heavy ? HD : MD);
  }
  // (2) THE RING MEMBERS — one per ring, segmented at each meridian (a jointed frame). Sill + crown
  //     hoops are heavy (the two structural rings the eye reads as top & bottom); the waist is slim.
  for (let ti = 0; ti < _DOME_T.length; ti++) {
    const heavy = (ti === 0 || ti === _DOME_T.length - 1);
    for (let mi = 0; mi < _DOME_M.length - 1; mi++) addBeam(N(mi, ti), N(mi + 1, ti), heavy ? HW : MW, heavy ? HD : MD);
  }
  // (3) THE CROWN SPINE — a heavy fore-aft keel from the front crown node back to the collar crown.
  //   Z1 SYMMETRY FIX (user: "the member joining the hull arch to the dome crown runs off-centre to a
  //   right-side mullion — it reads lopsided"). The keel USED to spring from N(3,top) = _DOME_M[3] = +0.5
  //   (a RIGHT-side crown node, x>0) down to the x=0 collar crown → a diagonal that visibly skewed right.
  //   FIX: run it from the CENTRE crown node N(2,top) = _DOME_M[2] = 0.0 (x=0, the exact apex node the
  //   node field DOES have) straight back to the x=0 collar crown → a keel dead on the centreline,
  //   symmetric about x=0. Both endpoints are real nodes (N(2,top) is where the two centre meridian ribs
  //   + the crown ring meet → a boss already lives there), so it joins the frame cleanly at both ends.
  const cp0 = hullProfile(COLLAR_Z);
  const collarCrown = new THREE.Vector3(0, cp0[cp0.length - 1].y - 0.06, COLLAR_Z);
  addBeam(N(2, _DOME_T.length - 1), collarCrown, HW, HD);
  // (4) THE SIDE-CLOSURE FRAME — a bow from each outer dome meridian back to the collar (frames the
  //     wrap-to-collar glass so it seals cleanly, no raw glass edge to space).
  //   COCKPIT-ROUND-2 item-7: previously these bows ENDED PROUD in the closure-glass plane (z≈0.21) AND
  //     spawned their own node bosses there — reading as a STACK of loose grey tabs at the shoulder
  //     junction (the user's screenshot). FIX: land the collar-side ends recessed at the collar RING
  //     (z=COLLAR_Z, tucked behind the collar flange) via addBeamNoBoss so no proud boss/tab is created —
  //     the collar ring itself is the outer frame the closure glass seals to.
  const cpf = hullProfile(COLLAR_Z);
  const collarPt = (side: number, y: number): THREE.Vector3 => {
    for (let i = 0; i < cpf.length - 1; i++) {
      const A = cpf[i], B = cpf[i + 1];
      if ((y >= A.y && y <= B.y) || (y >= B.y && y <= A.y)) {
        const t = (y - A.y) / ((B.y - A.y) || 1e-6);
        return new THREE.Vector3(side * (A.x + (B.x - A.x) * t - 0.05), y, COLLAR_Z - 0.02);   // recessed to the collar ring
      }
    }
    const P = cpf[cpf.length - 1];
    return new THREE.Vector3(side * (P.x - 0.05), Math.min(y, P.y), COLLAR_Z - 0.02);
  };
  // a beam whose ends do NOT spawn node bosses (so the collar-side terminations tuck into the collar
  //   cleanly instead of reading as loose tabs). Only the DOME-side end coincides with a real dome node
  //   boss (created by the meridian/ring beams), so the bow still visibly joins the frame there.
  const addBeamNoBoss = (p: THREE.Vector3, q: THREE.Vector3, w: number, d: number): void => {
    group.add(_beveledBeam(p, q, w, d, _domeRecess, 0.07));
    const mid = p.clone().add(q).multiplyScalar(0.5);
    const inb = mid.clone().sub(new THREE.Vector3(DOME_CX, DOME_CY, DOME_CZ)).normalize().negate();
    const proud = inb.clone().multiplyScalar(d * 0.42);
    group.add(_beveledBeam(p.clone().add(proud), q.clone().add(proud), w * 0.60, d * 0.30, _domeFace, 0.10));
  };
  for (const side of [-1, 1]) {
    const mi = side < 0 ? 0 : _DOME_M.length - 1;
    // only the SILL + CROWN rails (ti=0 and the top) frame the closure — dropping the mid rail removes a
    //   tab from the stack while still sealing the glass top+bottom to the collar.
    for (const ti of [0, _DOME_T.length - 1]) addBeamNoBoss(N(mi, ti), collarPt(side, N(mi, ti).y), MW, MD);
  }

  // (5) NODE BOSSES — drop a beveled hub at every point where ≥2 members meet, sized to swallow the
  //     thickest member entering it (+ the 7cm short we cut). This is what makes the joints read CLEAN:
  //     the members visibly enter a fabricated node, no gaps/overshoot/crossing. Dedup by rounded key.
  const nodeMap = new Map<string, { c: THREE.Vector3; r: number }>();
  const noteNode = (c: THREE.Vector3, memW: number): void => {
    const key = c.x.toFixed(2) + ',' + c.y.toFixed(2) + ',' + c.z.toFixed(2);
    const r = Math.max(memW * 0.72, 0.058) + 0.038;   // item-3: bosses scaled DOWN to match the slimmer members
    const cur = nodeMap.get(key);
    if (!cur) nodeMap.set(key, { c: c.clone(), r });
    else cur.r = Math.max(cur.r, r);
  };
  for (const s of segs) { noteNode(s.p, s.w); noteNode(s.q, s.w); }
  for (const { c, r } of nodeMap.values()) {
    const boss = _nodeBoss(c, outward(c).negate(), r, _steel);   // darker steel hub → reads as the joint
    group.add(boss);
    // a small rivet centred on the boss face (a fabricated fastener at the node)
    group.add(_stud(c.x, c.y, c.z, outward(c).negate(), _rivet, Math.min(0.02, r * 0.4)));
  }

  // -- THE SILL FASCIA CAP: a lighter-painted proud cap running the SILL hoop so the glass's bottom
  //    edge reads as a finished frame rail (the console meets it), not a raw seam. Beveled + short so it
  //    joins into the sill node bosses like the rest of the frame.
  for (let mi = 0; mi < _DOME_M.length - 1; mi++) {
    const p = N(mi, 0), q = N(mi + 1, 0);
    const mid = p.clone().add(q).multiplyScalar(0.5);
    const dir = outward(mid).negate();
    const capMesh = _beveledBeam(p.clone().add(dir.clone().multiplyScalar(0.06)), q.clone().add(dir.clone().multiplyScalar(0.06)), HW * 1.05, 0.085, _band, 0.12);
    group.add(capMesh);
  }

  // -- THE SILL↔FLOOR BASE CHANNEL — LIVE-fix (2026-07-05). Previously the kick skirt ran ONLY the front
  //    FLANK meridian segments (skipping the front-centre AND the two SIDE-CLOSURE spans). That left the
  //    closure glass floating at y≈0.55 with an OPEN void to the floor + stars below it (the user's
  //    standing/walking-vantage defect). NOW the skirt/lip/edge-band run the ENTIRE sill footprint ring —
  //    `_domeSillRing()` (left collar → front arc → right collar) — so EVERY glass span (front panes AND
  //    both side closures) lands on a solid base wall that meets the trimmed floor by construction. Lofted
  //    strips (not per-segment boxes) so no wedges on the steeply-angled spans. The base sits a hair
  //    OUTBOARD of the glass so the glass tucks in front of its lip.
  {
    const floorTopY = 0.055;                 // the deck plate top (deck at y 0.02, +0.035 tread)
    const OUTB = 0.03;                        // push the base a hair outboard so the glass tucks in front-inboard
    const ring = _domeSillRing();             // the FULL footprint (collar → front arc → collar), sill height
    // each ring node biased a hair OUTBOARD in XZ (so the base wall sits just outboard of the glass line).
    const biasOut = (p: THREE.Vector3): THREE.Vector3 => {
      const o = outward(p); o.y = 0; o.normalize();
      return new THREE.Vector3(p.x + o.x * OUTB, p.y, p.z + o.z * OUTB);
    };
    const lipInb = (p: THREE.Vector3, s: number): THREE.Vector3 => {
      const inb = outward(p).negate(); inb.y = 0; inb.normalize();
      return new THREE.Vector3(p.x + inb.x * s, p.y, p.z + inb.z * s);
    };
    const skirtV: number[] = [], lipV: number[] = [], edgeV: number[] = [];
    for (let i = 0; i < ring.length - 1; i++) {
      const a = biasOut(ring[i]), b = biasOut(ring[i + 1]);
      // (1) KICK SKIRT — a solid wall from the sill node straight DOWN to the deck at that footprint.
      const af = new THREE.Vector3(a.x, floorTopY, a.z);
      const bf = new THREE.Vector3(b.x, floorTopY, b.z);
      // wind so the skirt normal faces INBOARD (toward the cabin/pilot). Double-wound (both faces) so the
      //   base wall reads solid from inside AND from the outside-looking-in vantage.
      skirtV.push(a.x, a.y, a.z, af.x, af.y, af.z, b.x, b.y, b.z);
      skirtV.push(b.x, b.y, b.z, af.x, af.y, af.z, bf.x, bf.y, bf.z);
      // (2) SILL LIP — a short inboard ledge at the sill height (the finished surface the glass sits on).
      const aI = lipInb(a, 0.12), bI = lipInb(b, 0.12); aI.y -= 0.05; bI.y -= 0.05;
      lipV.push(a.x, a.y, a.z, aI.x, aI.y, aI.z, b.x, b.y, b.z);
      lipV.push(b.x, b.y, b.z, aI.x, aI.y, aI.z, bI.x, bI.y, bI.z);
      // (3) FLOOR EDGE BAND — a thin machined strip on the deck at the footprint (the trimmed floor edge
      //     meets the dome front with a clean band, no raw floor past the sill line).
      const af2 = new THREE.Vector3(a.x, floorTopY + 0.008, a.z), bf2 = new THREE.Vector3(b.x, floorTopY + 0.008, b.z);
      const afI = lipInb(af2, 0.14), bfI = lipInb(bf2, 0.14);
      edgeV.push(af2.x, af2.y, af2.z, afI.x, afI.y, afI.z, bf2.x, bf2.y, bf2.z);
      edgeV.push(bf2.x, bf2.y, bf2.z, afI.x, afI.y, afI.z, bfI.x, bfI.y, bfI.z);
    }
    const skirt = _skin(skirtV, _channel); skirt.material = _channel; group.add(skirt);
    // the skirt is a single-sided loft; add its BACK face so the outside-looking-in vantage never sees a
    //   see-through base wall (a second mesh with reversed winding — cheaper than a DoubleSide clone).
    const skirtBack: number[] = [];
    for (let k = 0; k < skirtV.length; k += 9) {
      skirtBack.push(skirtV[k], skirtV[k + 1], skirtV[k + 2], skirtV[k + 6], skirtV[k + 7], skirtV[k + 8], skirtV[k + 3], skirtV[k + 4], skirtV[k + 5]);
    }
    group.add(_skin(skirtBack, _channel));
    group.add(_skin(lipV, _band));         // proud machined sill ledge (lighter)
    group.add(_skin(edgeV, _band));        // finished floor edge band at the footprint
  }
}

/** THE STRUCTURAL COLLAR - the ONE clean hull<->glass transition hoop the dome springs from. The aft
 *  ribbed hull ends at COLLAR_Z; this deliberate ring closes the aft hull to the dome sill ring. It's a
 *  chunky channel-steel arch following the hull profile (deck -> up over the crown -> deck), with a
 *  proud inboard flange face + a rivet row, so from the seat it reads as the finished mouth the glass
 *  canopy bolts onto (not a raw cut edge). Behind the pilot's shoulders -> it never eats the vista. */
function buildCollar(group: THREE.Group): void {
  const prof = hullProfile(COLLAR_Z);
  const centre = new THREE.Vector3(DOME_CX, DOME_CY, DOME_CZ);
  // (1) the arch RING - box segments hugging the hull profile, both sides, forming the springing hoop.
  //   COCKPIT-ROUND-2 item-7: the pale per-segment FLANGE CAPS (a box per profile segment) stepped up
  //   the near-vertical side profile as a STACK of loose grey tabs at the glass↔hull junction (the
  //   user's screenshot). FIX: the flange is now ONE CONTINUOUS LOFTED BAND per side (a skin strip
  //   following the profile), so it reads as a single clean machined mating ring — no stepped tabs.
  for (const side of [1, -1]) {
    const flangeV: number[] = [];
    for (let i = 0; i < prof.length - 1; i++) {
      const ax = side * prof[i].x, ay = prof[i].y;
      const bx = side * prof[i + 1].x, by = prof[i + 1].y;
      const mx = (ax + bx) / 2, my = (ay + by) / 2;
      const len = Math.hypot(bx - ax, by - ay) + 0.03;
      const ring = _box(0.20, len, 0.16, _steel);           // chunky collar member (heaviest frame in the cabin)
      ring.position.set(mx, my, COLLAR_Z);
      ring.rotation.z = Math.atan2(by - ay, bx - ax) - Math.PI / 2;
      group.add(ring);
      // accumulate the CONTINUOUS inboard-flange band: a face at z=COLLAR_Z−0.11 (proud toward cabin),
      //   its inboard edge stepped 0.05 toward the cabin centre so the band reads as a proud machined lip.
      const inbA = new THREE.Vector3(ax - centre.x, ay - centre.y, 0).normalize().negate();
      const inbB = new THREE.Vector3(bx - centre.x, by - centre.y, 0).normalize().negate();
      const zF = COLLAR_Z - 0.11, zIn = COLLAR_Z - 0.05;
      // outer edge (on the ring face) → inner edge (proud lip toward cabin). Wind normal inboard (−Z-ish).
      const a0 = [ax, ay, zF], b0 = [bx, by, zF];
      const a1 = [ax + inbA.x * 0.05, ay + inbA.y * 0.05, zIn], b1 = [bx + inbB.x * 0.05, by + inbB.y * 0.05, zIn];
      flangeV.push(...a0, ...a1, ...b0, ...b0, ...a1, ...b1);
    }
    const flange = _skin(flangeV, _band);   // ONE continuous machined mating band (no stepped tabs)
    group.add(flange);
    // a sparse rivet row along the flange (fabricated fasteners on the mating ring)
    for (let i = 1; i < prof.length - 1; i += 2) {
      const rx = side * prof[i].x, ry = prof[i].y;
      const inb = new THREE.Vector3(rx - centre.x, ry - centre.y, 0).normalize().negate();
      group.add(_stud(rx, ry, COLLAR_Z - 0.11, new THREE.Vector3(inb.x, inb.y, 0.4).normalize(), _rivet, 0.016));
    }
    // a bracket GUSSET where the collar foot lands on the deck (a triangular knee - the hoop is footed)
    const foot = { x: side * prof[0].x, y: prof[0].y };
    const gus = _box(0.22, 0.20, 0.20, _channel);
    gus.position.set(foot.x - side * 0.05, 0.13, COLLAR_Z);
    group.add(gus);
  }
  // (2) a stencilled placard low on the collar foot (lived-in)
  const plac = _box(0.28, 0.06, 0.012, _hazard);
  plac.position.set(-prof[0].x + 0.34, 0.30, COLLAR_Z - 0.10);
  group.add(plac);
}

/** The aft doorway — a fitted channel-steel bulkhead door frame (jambs + header + rivets +
 *  amber threshold + a green "door clear" telltale). R5a-r3 SEV-2 #4: the opening read as a flat
 *  lit monitor — it now has a DEEP recessed jamb TUNNEL (near-black inner faces) + a beveled jamb +
 *  a raised kick-plate threshold + hazard-stripe edging, so it reads as a doorway INTO somewhere. */
function buildDoorway(group: THREE.Group, afZ: number, inward: THREE.Vector3): void {
  const proudZ = afZ - 0.09;
  const jambT = 0.14;
  // ── RECESSED JAMB TUNNEL — dark inner reveal faces lining the opening, set BACK into the wall
  //    (toward +Z) + near-black so the doorway reads with real depth (not a flush flat panel). The
  //    corridor's lit greybox sits past it; this dark collar frames it as a tunnel mouth.
  // ROUND-1e Z-FIGHT SWEEP (hallway↔cockpit archway): the reveal side/head boxes (_channel) reached to
  //   x=±(DOOR_X+0.02)=±1.02 with their OUTER faces near-coplanar with the corridor-mouth wall run front
  //   (x=±1.0, _shell) where the doorway meets the corridor at the seam → a hard flicker at the archway
  //   top (the dolly probe caught it @ hardPct 0.66). FIX: the reveals are made SLIMMER (outer face pulled
  //   in to x=±0.99, INSIDE the wall line) so the dark reveal reads as an inner tunnel lining strictly
  //   inboard of the wall plane — no _channel/_shell shared face at the seam. Depth/read unchanged.
  const tunZ = afZ + 0.22;     // the reveal sits back inside the wall
  for (const sx of [-1, 1]) {
    const reveal = _box(0.10, DOOR_Y1, 0.55, _channel);   // side reveal (deep, dark) — slimmer, outer face at ±0.99
    reveal.position.set(sx * (DOOR_X - 0.06), DOOR_Y1 / 2, tunZ);
    group.add(reveal);
  }
  const revHead = _box(2 * DOOR_X - 0.06, 0.16, 0.55, _channel);   // top reveal — inboard of the wall line
  revHead.position.set(0, DOOR_Y1 - 0.06, tunZ);
  group.add(revHead);
  // a near-black shadow-gasket lip right at the mouth (deepens the threshold read)
  for (const sx of [-1, 1]) {
    const gask = _box(0.04, DOOR_Y1, 0.04, _cable);
    gask.position.set(sx * (DOOR_X - 0.03), DOOR_Y1 / 2, afZ + 0.02);
    group.add(gask);
  }
  for (const sx of [-1, 1]) {
    const jamb = _box(jambT, DOOR_Y1, 0.18, _winFrame);
    jamb.position.set(sx * DOOR_X, DOOR_Y1 / 2, proudZ);
    group.add(jamb);
    // a beveled inner jamb chamfer (a 45° return between the proud frame + the dark reveal)
    const bevel = _box(0.06, DOOR_Y1, 0.10, _steel);
    bevel.position.set(sx * (DOOR_X - 0.05), DOOR_Y1 / 2, proudZ + 0.10);
    bevel.rotation.y = sx * 0.6;
    group.add(bevel);
    for (let k = 0; k < 5; k++) {
      group.add(_stud(sx * DOOR_X, 0.25 + k * (DOOR_Y1 - 0.5) / 4, proudZ - 0.07, inward, _rivet, 0.016));
    }
    // hazard-stripe edging down each jamb (a painted warning border — the door surround)
    const hazEdge = _box(0.03, DOOR_Y1 - 0.2, 0.02, _hazard);
    hazEdge.position.set(sx * (DOOR_X + 0.10), DOOR_Y1 / 2, proudZ - 0.10);
    group.add(hazEdge);
  }
  const lintel = _box(2 * DOOR_X + jambT, jambT, 0.18, _winFrame);
  lintel.position.set(0, DOOR_Y1, proudZ);
  group.add(lintel);
  const hband = _box(2 * DOOR_X, 0.05, 0.06, _band);
  hband.position.set(0, DOOR_Y1 - 0.12, proudZ - 0.07);
  group.add(hband);
  // hazard-stripe lintel edging
  const hazTop = _box(2 * DOOR_X + 0.1, 0.04, 0.02, _hazard);
  hazTop.position.set(0, DOOR_Y1 + 0.10, proudZ - 0.10);
  group.add(hazTop);
  // ── RAISED THRESHOLD KICK-PLATE SILL — a real stepped sill across the floor of the opening (a
  //    bulkhead doorway you step OVER), with a hazard-stripe tread on its face.
  const sillBox = _box(2 * DOOR_X + 0.1, 0.10, 0.14, _steel);
  sillBox.position.set(0, 0.05, afZ - 0.04);
  group.add(sillBox);
  const sillTread = _box(2 * DOOR_X, 0.012, 0.10, _hazard);
  sillTread.position.set(0, 0.105, afZ - 0.06);
  group.add(sillTread);
  for (const sx of [-0.7, 0, 0.7]) group.add(_stud(sx, 0.10, afZ - 0.10, inward, _rivet, 0.013));
  const tell = _cyl(0.022, 0.022, 0.02, 8, _ledGreen);
  tell.rotation.x = Math.PI / 2;
  tell.position.set(DOOR_X - 0.12, 1.4, proudZ - 0.06);
  group.add(tell);
}

/** The lone-pilot SEAT — a believable worn bucket chair at SEAT_Z facing −Z (the window),
 *  where the player spawns seated. A4 REWORK (user walk-test 2026-07-02):
 *   (a) the HARNESS/STRAPS/BUCKLE are DELETED — "we don't need that at all, it just gets in
 *       the way" (they foreshortened into wedges across the seated lower frame).
 *   (b) the head-box is a CLEAN headrest attached flush to the backrest top (no floating block,
 *       no gap-and-guide-posts that read as a detached box).
 *   (c) the backrest is RECLINED BACKWARD ~12° (rotation.x = +RECLINE) — the old −0.18 leaned the
 *       top FORWARD toward the window, which read as an uncomfortable, wrong-way chair.
 *   (d) the seat sits aft (SEAT_Z −0.30) with the spawn re-derived from it.
 *   (e) the whole chair gets a COLLIDER (the player can't walk through it).
 *  Steel pedestal on a deck rail → contoured cushion + bolsters → a reclined padded back + shoulder
 *  wings → a flush headrest → ARMRESTS (the seated-hands foreground) carrying a right side-stick. */
const SEAT_RECLINE = 0.21;   // ~12° BACKWARD recline (top toward +Z) — a natural, comfortable lean.
function buildPilotSeat(group: THREE.Group): void {
  const sz = SEAT_Z, sy = SEAT_Y;
  // the backrest pivots at the cushion-back; +Z grows with height by this rake (top leans aft).
  const backZ = (yLocal: number, base = sz + 0.30) => base + (yLocal - (sy + 0.50)) * Math.tan(SEAT_RECLINE);
  // ── PEDESTAL on a deck RAIL (a real seat track) + a column + swivel collar.
  const railL = _box(0.26, 0.05, 0.9, _steel);   // floor seat-rail
  railL.position.set(0, 0.025, sz + 0.1);
  group.add(railL);
  for (const rz of [-0.3, 0.0, 0.35]) {
    const tie = _box(0.30, 0.03, 0.04, _channel);
    tie.position.set(0, 0.05, sz + 0.1 + rz);
    group.add(tie);
  }
  const ped = _cyl(0.13, 0.17, sy - 0.08, 12, _channel);
  ped.position.set(0, (sy - 0.08) / 2 + 0.05, sz + 0.04);
  group.add(ped);
  const collar = _cyl(0.15, 0.15, 0.05, 14, _rivet);
  collar.position.set(0, sy - 0.08, sz + 0.04);
  group.add(collar);
  // ── CUSHION PAN — a contoured bucket (pan + a raised front lip + deep side bolsters). A longer
  //    squab so the knee-roll lip + bolster fronts read in the seated opening shot.
  const cushion = _box(0.58, 0.14, 0.66, _seat);
  cushion.position.set(0, sy, sz - 0.06);
  group.add(cushion);
  // cushion seam welts (two cross channels → the pan reads as stitched sections, not a slab)
  for (const cz of [sz - 0.10, sz - 0.28]) {
    const welt = _box(0.50, 0.03, 0.02, _seam);
    welt.position.set(0, sy + 0.075, cz);
    group.add(welt);
  }
  // the knee-roll FRONT LIP — the squab's front roll (dark vinyl); a low foreground edge of "your
  //   own seat" between the thighs (kept low so it doesn't loom over the dash/window).
  const frontLip = _box(0.52, 0.12, 0.13, _seat);
  frontLip.position.set(0, sy + 0.01, sz - 0.34);
  group.add(frontLip);
  const lipWelt = _box(0.46, 0.02, 0.02, _seam);   // a worn welt cresting the front roll
  lipWelt.position.set(0, sy + 0.07, sz - 0.39);
  group.add(lipWelt);
  // ── SIDE BOLSTERS — the bucket sides. A4-REWORK: the old "forward THIGH-HORNS" that reached into
  //    the lower-L/R frame corners are DROPPED (they were part of the wedge clutter the user
  //    complained about, and only existed to flank the deleted harness). A clean low bolster only.
  for (const sx of [-1, 1]) {
    const bolster = _box(0.15, 0.24, 0.64, _seat);      // deep side bolster (bucket side)
    bolster.position.set(sx * 0.29, sy + 0.09, sz - 0.06);
    group.add(bolster);
    const bWelt = _box(0.02, 0.03, 0.56, _seam);        // a worn welt down the bolster crest
    bWelt.position.set(sx * 0.355, sy + 0.18, sz - 0.10);
    group.add(bWelt);
  }
  // ── BACKREST — RECLINED BACKWARD (A4c). SEAT_RECLINE tilts the top toward +Z (aft) = a natural,
  //    comfortable lean (the old −0.18 tipped the top FORWARD toward the window — the user's "on an
  //    angle facing forward, doesn't look comfortable"). rotation.x = +SEAT_RECLINE; every backrest
  //    piece rides backZ(y) so the assembly leans as ONE coherent reclined slab (no floaters).
  const R = SEAT_RECLINE;                    // backward recline (top leans +Z / aft)
  const backCY = sy + 0.50;                  // backrest vertical centre
  const back = _box(0.54, 0.96, 0.16, _seatBack);
  back.position.set(0, backCY, backZ(backCY));
  back.rotation.x = R;
  group.add(back);
  const backPad = _box(0.34, 0.84, 0.07, _seat);    // the padded centre channel (darker vinyl)
  backPad.position.set(0, backCY, backZ(backCY) - 0.09);  // proud toward −Z (the sitter's back)
  backPad.rotation.x = R;
  group.add(backPad);
  // CONTOUR QUILTING — vertical channel seams + two lumbar bands (never reads as filing-drawers).
  //   The recline is baked into every seam via backZ() so they track the leaned backrest.
  for (const vx of [-0.105, 0, 0.105]) {              // three vertical bolster/quilt channels
    const vs = _box(0.018, 0.80, 0.022, _seam);
    vs.position.set(vx, backCY, backZ(backCY) - 0.125);
    vs.rotation.x = R;
    group.add(vs);
  }
  for (const ly of [sy + 0.34, sy + 0.64]) {          // two horizontal lumbar bands
    const ls = _box(0.30, 0.022, 0.02, _seam);
    ls.position.set(0, ly, backZ(ly) - 0.125);
    ls.rotation.x = R;
    group.add(ls);
  }
  for (const sx of [-1, 1]) {
    const wing = _box(0.12, 0.78, 0.26, _seatBack);      // shoulder wings (bucket sides)
    wing.position.set(sx * 0.29, sy + 0.48, backZ(sy + 0.48) - 0.04);
    wing.rotation.x = R;
    group.add(wing);
    const wingWorn = _box(0.07, 0.50, 0.07, _seatWorn);  // a scuffed worn crest on each wing
    wingWorn.position.set(sx * 0.31, sy + 0.56, backZ(sy + 0.56) - 0.16);
    wingWorn.rotation.x = R;
    group.add(wingWorn);
  }
  // a metal back FRAME (the seat shell shows its structure — behind the pad, on the aft/door side)
  const backFrame = _box(0.60, 1.0, 0.06, _steel);
  backFrame.position.set(0, backCY, backZ(backCY) + 0.08);
  backFrame.rotation.x = R;
  group.add(backFrame);
  // ── AFT-FACE detail (the DOOR shot sees the seat back). Two vertical channel seams + a stencilled
  //    placard, proud of the door-facing (+Z) face. NO harness-exit slots (the harness is gone).
  for (const ax of [-0.15, 0.15]) {
    const ac = _box(0.035, 0.86, 0.05, _seatWorn);
    ac.position.set(ax, backCY, backZ(backCY) + 0.11);
    ac.rotation.x = R;
    group.add(ac);
  }
  const placard = _box(0.18, 0.12, 0.02, _decal);     // a stencilled placard on the door-facing face
  placard.position.set(0, sy + 0.30, backZ(sy + 0.30) + 0.11);
  placard.rotation.x = R;
  group.add(placard);
  const placTxt = _box(0.13, 0.05, 0.015, _hazard);
  placTxt.position.set(0, sy + 0.31, backZ(sy + 0.31) + 0.125);
  placTxt.rotation.x = R;
  group.add(placTxt);
  // ── HEADREST (A4b) — attached FLUSH to the backrest top on the SAME recline, sitting directly on
  //    the crown (no gap, no steel guide-posts) so it reads as one continuous seat, not a floating
  //    block. A padded restraint + a worn face pad, both riding backZ() at the backrest top.
  const headCY = sy + 1.02;
  const headRest = _box(0.34, 0.20, 0.17, _seatBack);
  headRest.position.set(0, headCY, backZ(headCY));
  headRest.rotation.x = R;
  group.add(headRest);
  const headPad = _box(0.24, 0.15, 0.07, _seatWorn);  // the worn cushioned face (toward the sitter)
  headPad.position.set(0, headCY, backZ(headCY) - 0.10);
  headPad.rotation.x = R;
  group.add(headPad);
  // ── ARMRESTS — reach FORWARD into the seated POV (the hands rest here); on steel posts, carrying
  //    the right side-stick. Kept (they're seat structure, NOT the harness the user asked to remove)
  //    but tightened so nothing floats: the post lands ON the cushion side, the pad is continuous.
  for (const sx of [-1, 1]) {
    const armPost = _box(0.08, 0.40, 0.08, _steel);
    armPost.position.set(sx * 0.37, sy + 0.20, sz - 0.04);
    group.add(armPost);
    const arm = _box(0.13, 0.10, 0.56, _seatArm);       // the armrest body (near-black cool matte)
    arm.position.set(sx * 0.37, sy + 0.42, sz - 0.30);
    group.add(arm);
    const armPad = _box(0.14, 0.06, 0.40, _seatArm);    // dark cool vinyl top
    armPad.position.set(sx * 0.37, sy + 0.48, sz - 0.36);
    group.add(armPad);
    const armWear = _box(0.06, 0.02, 0.30, _seatWorn);  // a thin worn rub-stripe
    armWear.position.set(sx * 0.37, sy + 0.515, sz - 0.38);
    group.add(armWear);
    for (const nb of [-0.035, 0.035]) {                 // a control nub cluster on each armrest tip
      const nub = _cyl(0.013, 0.013, 0.032, 6, sx < 0 ? _ledAmber : _ledGreen);
      nub.position.set(sx * 0.37 + nb, sy + 0.54, sz - 0.52);
      group.add(nub);
    }
  }
  // RIGHT side-stick (a control grip rising off the right armrest — "hands on the controls").
  const stickBase = _box(0.12, 0.08, 0.14, _channel);
  stickBase.position.set(0.37, sy + 0.54, sz - 0.54);
  group.add(stickBase);
  const stick = _cyl(0.026, 0.034, 0.24, 8, _steel);
  stick.position.set(0.37, sy + 0.66, sz - 0.56);
  stick.rotation.x = -0.25;
  group.add(stick);
  const grip = _cyl(0.047, 0.052, 0.12, 10, _cable);
  grip.position.set(0.37, sy + 0.78, sz - 0.59);
  grip.rotation.x = -0.25;
  group.add(grip);
  const trigger = _box(0.04, 0.03, 0.02, _ledAmber);
  trigger.position.set(0.37, sy + 0.78, sz - 0.52);
  group.add(trigger);
  // ── W1 (user: "REMOVE the chair's collider entirely — I want to walk the cockpit freely"). The
  //    former backrest furniture collider is GONE — the chair is now fully walkthrough. (The invisible
  //    "collider behind the chair from a previous version" the user also flagged is hunted separately
  //    — see the W1 note in buildShipScene's collider-audit: no stray box remained in the arrays; the
  //    only aft-of-seat solid was THIS backrest collider, now removed.) Free movement all around the
  //    seat is verified with the B1.f-style real-KCC motion probe (--scenario=cockpit path).
  void sz; void sy;
}

/** The forward CONSOLE — COCKPIT-ROUND-2 REDESIGN (the user: "the whole controls look a bit
 *  messy — overlapping/floating pieces; redesign cleaner + more streamlined").
 *
 *  The old dash was a jumble: a floating proud MFD housing, an amber screen-pod + big dial
 *  floating at odd angles, coplanar face panels z-fighting, scattered dial/LED/switch/throttle
 *  clutter reading as overlapping boxes. This rebuild is ONE COHERENT STREAMLINED CONSOLE:
 *   (1) a single flowing PEDESTAL body — a clean front kneewell wall + a wrapped top that reads as
 *       one continuous surface (the pieces share planes, so no overlap/z-fight);
 *   (2) a GLARE-SHIELD HOOD over a single canted INSTRUMENT FASCIA — the screens are RECESSED into
 *       this one fascia plane with integral bezels (real depth, no proud floating housings);
 *   (3) the MAIN MFD (off-centre left, keeps _alertScreenGlow + _alertStatusLeds + the setCockpitAlert
 *       hooks) + ONE clean secondary readout (right) on the SAME fascia plane → coherent, not scattered;
 *   (4) a tidy CONTROL SHELF below the fascia: one grouped switch strip, two clean flush dials, and a
 *       throttle quadrant on a raised boss — purposeful groupings, all seated on the shelf (nothing floats).
 *  Everything is built off two reference planes (the fascia + the shelf) so faces never overlap/coplane. */
function buildConsoleBank(group: THREE.Group): void {
  _alertStatusLeds = [];
  const conZ = CON_Z, deckY = CON_DECK_Y;
  const inward = new THREE.Vector3(0, 0, 1);
  const CANT = -0.62;   // the single instrument-fascia tilt (up toward the seated pilot)

  // ── (1) THE PEDESTAL BODY — one clean wrapped console mass. A front kneewell wall (seat-facing),
  //    a top deck, and two gently-angled end returns that WRAP toward the pilot. Depth-staggered so
  //    the faces never coplane. This is the console's whole lower body; the fascia + shelf sit on it.
  const bodyH = deckY;                 // 0.78 — knee-height dash
  const bodyD = 0.72;
  const bodyFrontZ = conZ + bodyD / 2; // the seat-facing front plane
  // the core body block
  const body = _box(3.2, bodyH, bodyD, _channel);
  body.position.set(0, bodyH / 2, conZ);
  group.add(body);
  // the seat-facing FRONT FASCIA WALL (one clean painted plate, proud of the body front by 1cm so
  //   it reads as the finished skin — not coplanar with the body face)
  const frontWall = _box(3.14, bodyH - 0.04, 0.05, _band);
  frontWall.position.set(0, bodyH / 2, bodyFrontZ + 0.005);
  group.add(frontWall);
  // a slim kickplate at the floor + a single clean waist reveal line (panel break, real depth)
  const kick = _box(3.14, 0.14, 0.07, _steel);
  kick.position.set(0, 0.07, bodyFrontZ + 0.01);
  group.add(kick);
  const reveal = _box(3.0, 0.03, 0.02, _channel);
  reveal.position.set(0, bodyH * 0.62, bodyFrontZ + 0.03);
  group.add(reveal);
  // two flush access panels + a stencil label on the front wall (lived-in, NOT proud clutter)
  for (const px of [-1.05, 1.05]) {
    for (const cyp of [-0.13, 0.13]) group.add(_stud(px - 0.34, bodyH * 0.34 + cyp, bodyFrontZ + 0.03, inward, _rivet, 0.012));
    for (const cyp of [-0.13, 0.13]) group.add(_stud(px + 0.34, bodyH * 0.34 + cyp, bodyFrontZ + 0.03, inward, _rivet, 0.012));
  }
  const lbl = _box(0.46, 0.05, 0.006, _decal);
  lbl.position.set(-0.9, bodyH * 0.30, bodyFrontZ + 0.035);
  group.add(lbl);
  // (Mk-III review round 1 — the WRAP end-returns REMOVED per the user: the angled end blocks with
  //   their proud lighter face plates read as odd handle-boxes on the console's far ends. The
  //   console now ends cleanly at its body; the collider narrows to match (rule 9).)
  // A5 COLLIDER — the solid console mass (narrowed to the body now the end-returns are gone).
  _addFurnitureCollider(3.3, deckY + 0.30, 0.95, 0, (deckY + 0.30) / 2, conZ + 0.05);

  // ── (2) THE CONTROL SHELF — one flat top surface on the body (the physical shelf that all the
  //    controls sit ON, so nothing floats). Slightly proud of the body top; a rear lip rises to the
  //    fascia. This single plane is the datum for the switch/dial/throttle groups below.
  const shelfY = bodyH + 0.02;
  const shelf = _box(3.14, 0.05, bodyD - 0.06, _steel);
  shelf.position.set(0, shelfY, conZ - 0.01);
  group.add(shelf);
  for (let i = -3; i <= 3; i++) group.add(_stud(i * 0.46, shelfY + 0.03, bodyFrontZ - 0.06, inward, _rivet, 0.013));

  // ── (2b) THE GLARE-SHIELD HOOD + INSTRUMENT FASCIA — one canted plane rising off the shelf's rear
  //    edge, hooded by a brow so the screens read RECESSED. This is the ONE fascia the MFDs live in.
  // Mk-III review round 1 (user): the raised back was "a bit tall — blocks the view" → the fascia
  //   centre drops 10cm and the brow hugs the fascia top instead of riding 2cm above it; the whole
  //   silhouette falls from ~1.38 (right AT the 1.35 seated eye) to ~1.26 — horizon clears it.
  const fasCY = deckY + 0.20;                 // fascia centre height (was +0.30)
  const fasZ = conZ - 0.14;                    // set back (behind the shelf, toward the window)
  // the fascia backing panel (the instrument face all screens recess INTO)
  const fascia = _box(3.0, 0.56, 0.05, _channel);
  fascia.position.set(0, fasCY, fasZ);
  fascia.rotation.x = CANT;
  group.add(fascia);
  // the GLARE-SHIELD BROW — a slim hood cantilevered over the fascia top (shades the screens; gives
  //   the console its purposeful silhouette). One clean bar, angled to overhang.
  const brow = _box(3.06, 0.06, 0.22, _steel);
  brow.position.set(0, fasCY + 0.28, fasZ + 0.10);   // hugs the fascia top (review round 1)
  brow.rotation.x = CANT + 0.5;
  group.add(brow);
  for (let i = -3; i <= 3; i++) group.add(_stud(i * 0.46, fasCY + 0.28, fasZ + 0.16, inward, _rivet, 0.012));

  // ── (3) THE MAIN MFD — recessed INTO the fascia (off-centre left). Integral bezel, recessed dark
  //    glass, green emissive content (horizon + readout lines) + scanlines. Keeps the alert refs.
  const mfdX = -0.62;
  const scrCY = fasCY + 0.02, scrZ = fasZ + 0.05;
  const bezel = _box(1.0, 0.50, 0.05, _steel);   // integral bezel proud of the fascia
  bezel.position.set(mfdX, scrCY, scrZ);
  bezel.rotation.x = CANT;
  group.add(bezel);
  const faceGlass = _box(0.86, 0.40, 0.02, _screenGlass);   // recessed glass (sits back in the bezel)
  faceGlass.position.set(mfdX, scrCY, scrZ + 0.015);
  faceGlass.rotation.x = CANT;
  group.add(faceGlass);
  // ── the screen CONTENT lives in a child GROUP carrying the screen's position + CANT tilt, so all
  //    content is authored in flat local (x, y) coords + reads correctly on the tilted plane (the
  //    prior hand-projected z-math pushed the lower readout lines BEHIND the glass — a real bug).
  const scr = new THREE.Group();
  scr.position.set(mfdX, scrCY, scrZ + 0.03);
  scr.rotation.x = CANT;
  group.add(scr);
  const scrLocal = (mesh: THREE.Mesh, x: number, y: number, z = 0) => { mesh.position.set(x, y, z); scr.add(mesh); };
  const glowGeo = new THREE.PlaneGeometry(0.84, 0.38);
  _disposables.push(glowGeo);
  const glowMat = new THREE.MeshBasicMaterial({ color: 0x1f5a2c });   // R2: brighter green CRT base → the screen reads as a lit avionics page
  _buildMats.push(glowMat);
  const scrGlow = new THREE.Mesh(glowGeo, glowMat);
  scrLocal(scrGlow, 0, 0, 0);
  _alertScreenGlow = scrGlow;
  // content: a banked horizon line + a nav crosshair + scrolling readout lines (alert refs recolor).
  const brightGreen = new THREE.MeshBasicMaterial({ color: 0x8cf29a });
  _buildMats.push(brightGreen);
  const horizGeo = new THREE.PlaneGeometry(0.6, 0.018);
  _disposables.push(horizGeo);
  const horiz = new THREE.Mesh(horizGeo, brightGreen);
  scrLocal(horiz, 0, 0.10, 0.004); horiz.rotation.z = 0.05;   // a slightly banked horizon
  _alertStatusLeds.push(horiz);
  // a small nav crosshair box on the horizon (a real avionics glyph, not just lines)
  const crossGeo = new THREE.PlaneGeometry(0.05, 0.05);
  _disposables.push(crossGeo);
  const cross = new THREE.Mesh(crossGeo, brightGreen);
  scrLocal(cross, 0, 0.10, 0.005);
  _alertStatusLeds.push(cross);
  const lineGeo = new THREE.PlaneGeometry(0.6, 0.028);
  _disposables.push(lineGeo);
  for (let r = 0; r < 4; r++) {
    const line = new THREE.Mesh(lineGeo, brightGreen);
    const w = [0.95, 0.5, 0.72, 0.4][r];
    line.scale.x = w;
    scrLocal(line, -0.28 * (1 - w), -0.02 - r * 0.05, 0.004);
    _alertStatusLeds.push(line);
  }
  // faint CRT scanlines (in the same local frame → they stay ON the screen)
  const scanGeo = new THREE.PlaneGeometry(0.84, 0.004);
  _disposables.push(scanGeo);
  const scanMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.26 });
  _buildMats.push(scanMat);
  for (let s = 0; s < 9; s++) {
    const sl = new THREE.Mesh(scanGeo, scanMat);
    scrLocal(sl, 0, 0.16 - s * 0.04, 0.006);
  }

  // ── (3b) THE SECONDARY READOUT — recessed into the SAME fascia plane to the right (coherent, not a
  //    floating pod). A small amber data screen in its own integral bezel + two clean flush gauges.
  const rX = 0.9;
  const bez2 = _box(0.62, 0.42, 0.05, _steel);
  bez2.position.set(rX, fasCY + 0.03, scrZ);
  bez2.rotation.x = CANT;
  group.add(bez2);
  // the secondary screen content in a child GROUP (same tilt-correct pattern as the MFD).
  const scr2 = new THREE.Group();
  scr2.position.set(rX, fasCY + 0.03, scrZ + 0.03);
  scr2.rotation.x = CANT;
  group.add(scr2);
  const scr2Geo = new THREE.PlaneGeometry(0.5, 0.32);
  _disposables.push(scr2Geo);
  const amberScr = new THREE.MeshBasicMaterial({ color: 0x6a4a12 });   // R2: brighter amber base (was 0x4a3208 → too dark to read as lit)
  _buildMats.push(amberScr);
  const scr2Face = new THREE.Mesh(scr2Geo, amberScr);
  scr2.add(scr2Face);
  const amberBar = new THREE.MeshBasicMaterial({ color: 0xe0a040 });
  _buildMats.push(amberBar);
  for (let r = 0; r < 3; r++) {
    const l2Geo = new THREE.PlaneGeometry(0.4, 0.03);
    _disposables.push(l2Geo);
    const l2 = new THREE.Mesh(l2Geo, amberBar);
    l2.scale.x = [0.9, 0.6, 0.8][r];
    l2.position.set(-0.02, 0.08 - r * 0.07, 0.004);
    scr2.add(l2);
  }
  // two clean flush GAUGES recessed in the fascia, low-right (a tidy pair, not a scattered cluster)
  for (const [gx, gr] of [[1.42, 0.12], [1.42, 0.0]] as [number, number][]) {
    if (gr === 0) continue;
    const gy = fasCY - 0.16;
    const ring = _cyl(gr, gr, 0.035, 20, _band);
    ring.rotation.x = Math.PI / 2 + CANT;
    ring.position.set(gx, gy, fasZ + 0.05);
    group.add(ring);
    const fce = _cyl(gr * 0.8, gr * 0.8, 0.01, 20, _dialFace);
    fce.rotation.x = Math.PI / 2 + CANT;
    fce.position.set(gx, gy, fasZ + 0.065);
    group.add(fce);
    const needle = _box(gr * 0.7, 0.008, 0.004, _ledAmber);
    needle.position.set(gx, gy, fasZ + 0.075);
    needle.rotation.set(CANT, 0, -0.4);
    group.add(needle);
  }

  // ── (4) THE CONTROL SHELF GROUPS — all seated ON the shelf plane (shelfY), grouped + tidy.
  //    (a) one clean grouped SWITCH STRIP (guarded), left-of-centre.
  {
    const bx = -0.35;
    const plate = _box(0.6, 0.02, 0.16, _band);
    plate.position.set(bx, shelfY + 0.03, conZ + 0.10);
    group.add(plate);
    for (let i = 0; i < 5; i++) {
      const sw = _cyl(0.011, 0.011, 0.05, 6, _rivet);
      sw.rotation.x = -0.5;
      sw.position.set(bx - 0.22 + i * 0.11, shelfY + 0.06, conZ + 0.09);
      group.add(sw);
    }
    const guard = _box(0.62, 0.015, 0.02, _steel);
    guard.position.set(bx, shelfY + 0.10, conZ + 0.04);
    group.add(guard);
  }
  //    (b) the telltale LED status row — a tidy grouped strip on the shelf (recessed sockets).
  const ledCols = [_ledGreen, _ledAmber, _ledGreen, _ledBlue, _ledGreen];
  for (let i = 0; i < ledCols.length; i++) {
    const lx = -0.32 + i * 0.11;
    const socket = _cyl(0.022, 0.022, 0.028, 8, _channel);
    socket.rotation.x = Math.PI / 2;
    socket.position.set(lx, shelfY + 0.03, conZ + 0.30);
    group.add(socket);
    const led = _cyl(0.015, 0.015, 0.02, 8, ledCols[i]);
    led.rotation.x = Math.PI / 2;
    led.position.set(lx, shelfY + 0.05, conZ + 0.30);
    group.add(led);
  }
  //    (c) THE THROTTLE QUADRANT — on a raised boss, centre-right (the freighter tell). Twin levers.
  //    W1 (user: "the yellow lever caps don't connect to their shafts"). ROOT CAUSE: the knob was
  //    placed at a hand-guessed (y,z) that didn't track the raked lever's TOP — the lever tilts
  //    rotation.x=−0.5, so its top is at center + halfLen·(0, cos, sin), NOT straight up. The knob's
  //    z was ~0.16m off the shaft top → a floating cap. FIX: compute the lever-top from its own
  //    transform + seat the knob there, rotated to match the shaft so it caps flush.
  const boss = _box(0.3, 0.08, 0.28, _steel);
  boss.position.set(0.5, shelfY + 0.05, conZ + 0.12);
  group.add(boss);
  const LEV_TILT = -0.5, LEV_H = 0.24;
  const upC = Math.cos(LEV_TILT), upS = Math.sin(LEV_TILT);   // the lever's up-axis after rotation.x
  for (const tx of [-0.06, 0.06]) {
    const lcx = 0.5 + tx, lcy = shelfY + 0.17, lcz = conZ + 0.12;
    const lever = _cyl(0.016, 0.022, LEV_H, 8, _steel);
    lever.position.set(lcx, lcy, lcz);
    lever.rotation.x = LEV_TILT;
    group.add(lever);
    // the knob caps the shaft: seat its centre a hair below the lever top so the base overlaps the
    //   shaft (no gap), on the SAME tilt axis.
    const knob = _cyl(0.034, 0.034, 0.05, 10, _ledAmber);
    knob.position.set(lcx, lcy + (LEV_H / 2 - 0.01) * upC, lcz + (LEV_H / 2 - 0.01) * upS);
    knob.rotation.x = LEV_TILT;
    group.add(knob);
  }
  // a single grab-rail across the shelf front edge (one clean lived-in handhold, not clutter).
  const grab = _cyl(0.016, 0.016, 2.4, 8, _band);
  grab.rotation.z = Math.PI / 2;
  grab.position.set(0, shelfY + 0.02, bodyFrontZ - 0.02);
  group.add(grab);
}

/** The 2-second PERSONAL TOUCH — the lone pilot's humanity, made recognizable (gate #6): a
 *  framed PHOTO propped on the dash, a chipped enamel MUG (cup + handle + rim + dark coffee
 *  surface), and a small TOKEN hanging on a cord off the window mullion. */
function buildPersonalTouch(group: THREE.Group): void {
  const conZ = CON_Z, deckY = CON_DECK_Y;
  // R2 RE-SEAT for the redesigned console: the clutter now sits ON the control shelf (shelfY≈0.80),
  //   tucked to the FAR corners (out of the MFD + the window sightline) so it reads as lived-in
  //   detail, not a piece floating over the instruments. shelfTop = the physical surface it rests on.
  const shelfTop = deckY + 0.02 + 0.03;   // shelf plate top (matches buildConsoleBank shelfY + half)
  const cornerZ = conZ + 0.22;            // on the shelf, toward the pilot but clear of the fascia
  // ── a framed PHOTO propped in the FAR-LEFT shelf corner, canted toward the seat
  const photoMat = new THREE.MeshLambertMaterial({ color: 0xc9b890, flatShading: true });
  _buildMats.push(photoMat);
  const photoFrame = new THREE.MeshLambertMaterial({ color: 0x3e362c, flatShading: true });
  _buildMats.push(photoFrame);
  const stand = _box(0.06, 0.05, 0.10, photoFrame);
  stand.position.set(-1.28, shelfTop + 0.02, cornerZ + 0.02);
  group.add(stand);
  const frame = _box(0.20, 0.25, 0.02, photoFrame);
  frame.position.set(-1.28, shelfTop + 0.15, cornerZ);
  frame.rotation.set(-0.4, 0.2, 0.02);
  group.add(frame);
  const photo = _box(0.16, 0.21, 0.012, photoMat);
  photo.position.set(-1.28, shelfTop + 0.155, cornerZ + 0.012);
  photo.rotation.set(-0.4, 0.2, 0.02);
  group.add(photo);
  const figMat = new THREE.MeshLambertMaterial({ color: 0x9a8a70, flatShading: true });
  _buildMats.push(figMat);
  const fig = _cyl(0.035, 0.035, 0.006, 10, figMat);
  fig.position.set(-1.28, shelfTop + 0.18, cornerZ + 0.02);
  fig.rotation.set(Math.PI / 2 - 0.4, 0, 0.02);
  group.add(fig);
  // ── a chipped enamel MUG in the FAR-RIGHT shelf corner (body + rim + dark coffee + handle)
  const mugMat = new THREE.MeshLambertMaterial({ color: 0xb06a44, flatShading: true });
  _buildMats.push(mugMat);
  const mugBody = _cyl(0.05, 0.044, 0.10, 16, mugMat);
  mugBody.position.set(1.24, shelfTop + 0.05, cornerZ);
  group.add(mugBody);
  const mugRim = _cyl(0.052, 0.052, 0.012, 16, _band);   // a bright chipped enamel rim
  mugRim.position.set(1.24, shelfTop + 0.10, cornerZ);
  group.add(mugRim);
  const coffeeMat = new THREE.MeshLambertMaterial({ color: 0x2a1a0e, flatShading: true });
  _buildMats.push(coffeeMat);
  const coffee = _cyl(0.044, 0.044, 0.004, 16, coffeeMat);
  coffee.position.set(1.24, shelfTop + 0.097, cornerZ);
  group.add(coffee);
  const mugGeo = new THREE.TorusGeometry(0.032, 0.01, 6, 12);
  _disposables.push(mugGeo);
  const mugHandle = new THREE.Mesh(mugGeo, mugMat);
  mugHandle.position.set(1.30, shelfTop + 0.05, cornerZ);
  mugHandle.rotation.y = Math.PI / 2;
  group.add(mugHandle);
  // ── W1: the hanging TOKEN charm is DROPPED. With the enlarged panoramic canopy it dangled into
  //    the hero vista (a floating diagonal across the planet — the "distraction" read). The pilot's
  //    humanity now reads via the framed photo + the chipped mug on the shelf (both clear of the glass).
}

/** SIDE WALLS — COCKPIT-ROUND-2 (the user: "those 2 boxes on the right + left of the cockpit hull
 *  seem out of place now — remove + redesign"). The two free-standing side consoles are DELETED
 *  (and their colliders with them). The space is redesigned as INTEGRATED, RECESSED WALL PANELS
 *  that sit FLUSH to the ribbed hull curve (`hullWallXAt`) — letting the fuselage BREATHE. Each side
 *  gets a shallow inset panel (a value break with real depth) carrying a small flush avionics
 *  readout + a stencil placard + a hazard strip, so the walls read as lived-in hull, not detached
 *  furniture blocks. Nothing is proud enough to need a collider (the walk band is unchanged). The
 *  conduit/cable/grab-rail greeble below is retained (that's hull dressing, not a "box"). */
function buildSideConsoles(group: THREE.Group): void {
  // ── X1 CLEANUP (user walk-test 2026-07-04: "the side hull-wall pipes are too messy, can just be
  //    removed"). ALL side-wall pipe/conduit/grab-rail/cable-loom dressing that ran the length of
  //    the +X/−X fuselage walls is DELETED. The waist conduit bundles + clamps, the overhead
  //    grab-rails + standoffs, the rib-valley cable looms, and the flex-conduit drops behind the
  //    console are ALL removed — the fuselage side walls are now clean lofted ribbed hull, which
  //    the user's ref (a purposeful framed canopy over clean structure) calls for. Nothing proud,
  //    nothing clipping, nothing off-purpose. (The aft-bay conduit runs in buildCockpitShell stay
  //    — those are on the door bulkhead behind the pilot, well out of the seated forward read.)
  void group;
}

/** Self-contained cockpit LIGHTING (the offset ship sees no world sun) — WARM + MOODY (gate
 *  #3): a warm KEY pooling over the station + warm bounce, a low warm-grounded ambient (NOT
 *  flat cold grey), pockets of shadow in the corners, the cool WINDOW spill, and a green CRT
 *  glow + an amber console wash pooling on the dash/floor/face. Lived-in + a-bit-claustrophobic. */
function buildLighting(group: THREE.Group): void {
  _alertKeyLights = [];
  // ── REAL RECESSED LIGHT FIXTURES (the actual sources) — caged metal can-lights in the crown,
  //    each = a metal bezel + a warm emissive lens. The point lights sit AT these so the light has
  //    a believable origin (gate: "the light is a blown white blob with no fixture").
  // ── ROUND-2d item-3 — ONE CEILING LIGHT (user: the collar/keel cluster of TWO amber cans + the red
  //    beacon read messy). Consolidated to a SINGLE well-made warm can-dome fixture on the collar crown
  //    carrying the cabin's warm key; the red ALERT beacon is separated + moved clearly AFT on the keel
  //    stringer (built below at zB=1.7, standing ALONE + purposeful). The lighting FUNCTION is preserved
  //    (the warm key point light + the alert wash) — only the fixture COUNT drops. No luminaire in the
  //    glazing (standing rule): the fixture mounts on the OPAQUE collar crown at fz=COLLAR_Z+0.16 (=0.50),
  //    aft of the glass.
  const canZ = COLLAR_Z + 0.16;   // =0.50 — on the opaque collar crown, aft of the glazing
  const canY = HULL_CROWN_MAX;    // crown apex
  {
    // (1) a flush MOUNT PLATE bolted to the crown (the visible mount the spec asks for)
    const plate = _cyl(0.18, 0.20, 0.05, 16, _band);
    plate.position.set(0, canY - 0.045, canZ);
    group.add(plate);
    // 4 mount bolts around the plate rim (worked hardware)
    for (let a = 0; a < 4; a++) {
      const ba = (a / 4) * Math.PI * 2 + Math.PI / 4;
      group.add(_stud(0.15 * Math.cos(ba), canY - 0.03, canZ + 0.15 * Math.sin(ba), new THREE.Vector3(0, -1, 0), _rivet, 0.016));
    }
    // (2) the CAN housing — a recessed metal cylinder (bezel), machined-steel, hanging just below the plate
    const can = _cyl(0.145, 0.165, 0.13, 16, _channel);
    can.position.set(0, canY - 0.125, canZ);
    group.add(can);
    // a thin bright bezel ring at the can mouth (the machined rim catches a highlight → reads as a real fixture)
    const bezel = _cyl(0.155, 0.155, 0.02, 16, _steel);
    bezel.position.set(0, canY - 0.195, canZ);
    group.add(bezel);
    // (3) the warm frosted DOME LENS recessed inside the bezel (a domed lens, not a flat disc — reads
    //     as a real luminaire; the warm key SOURCE sits just below it so the glow has an origin)
    const lensGeo = new THREE.SphereGeometry(0.115, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2);
    _disposables.push(lensGeo);
    const lens = new THREE.Mesh(lensGeo, _ledAmber);
    lens.rotation.x = Math.PI;   // dome opens downward into the cabin
    lens.position.set(0, canY - 0.185, canZ);
    group.add(lens);
    // (4) a slim protective CROSS CAGE under the lens (two crossed bars — the caged-fixture read)
    for (const rot of [0, Math.PI / 2]) {
      const bar = _box(0.26, 0.014, 0.014, _steel);
      bar.rotation.y = rot;
      bar.position.set(0, canY - 0.22, canZ);
      group.add(bar);
    }
  }
  // warm KEY (an invisible source, forward of the collar) — throws warm light DOWN onto the dash. Pulled
  //   DOWN + softened so it no longer blows the crown out. No mesh here (the fixtures are aft, opaque).
  const key = new THREE.PointLight(0xffd0a0, 1.8, 5.2, 2.0);
  key.position.set(0.0, HULL_CROWN_MAX - 0.30, -0.7);
  group.add(key);
  _alertKeyLights.push(key);
  // ROUND-2d item-3 — the SINGLE ceiling can's own warm throw: a source AT the fixture (just below the
  //   lens at canZ=0.50) so the one ceiling light visibly IS the origin of the warm crown pool + it
  //   still reaches the corridor mouth aft. Replaces the old separate aft-fixture fill (that fixture is
  //   gone). Kept in _alertKeyLights so it dims on red-alert.
  const aft = new THREE.PointLight(0xffc488, 1.35, 5.0, 2.2);
  aft.position.set(0.0, HULL_CROWN_MAX - 0.28, COLLAR_Z + 0.16);
  group.add(aft);
  _alertKeyLights.push(aft);
  // FLOW-CLARITY (checkEngines beat): the "check the engines (aft)" cue sends the seated pilot
  //   AFT (+Z) — but the aft bulkhead DOORWAY reads as a near-black void from the window-facing
  //   seat (the deep recessed jamb + the orbit-dim cabin), giving NO visual pull toward where to
  //   go. Add a warm EXIT-GLOW pooling ON the doorway aperture from just inside the corridor mouth
  //   (z past the doorway at afZ≈2.48), so the aft opening reads as a LIT passage — the discoverable
  //   destination. In _alertKeyLights so it DIMS on the disaster (the warm invite yields to red-alert
  //   when the flee begins). A diegetic affordance (a lit doorway), not an arrow/marker.
  const exitGlow = new THREE.PointLight(0xffcaa0, 1.6, 4.2, 2.2);
  exitGlow.position.set(0.0, 1.55, CK_Z + 0.42);   // just aft of the doorway, mid-height — pools on the aperture
  group.add(exitGlow);
  _alertKeyLights.push(exitGlow);
  // ── COOL FILL (gate #6 — lift the crushed shadows + reveal the tube curvature as a gradient).
  //    A neutral-cool hemisphere: a cool sky over a NOT-black floor so the lower walls + deck read
  //    a mid-tone and the brushed metal shows a modeling spec gradient across the curve.
  const fill = new THREE.HemisphereLight(0xaebccc, 0x4a4f55, 0.95);
  group.add(fill);
  _alertKeyLights.push(fill);
  _alertAmbient = fill;
  // a cool FILL spot from the windscreen direction (lifts the floor/console front + sells the
  //   "cold space outside" key washing into the cabin) — the curve-revealing soft light.
  const coolFill = new THREE.PointLight(0xa8c2d8, 1.3, 7.0, 1.5);
  coolFill.position.set(0, 1.5, -CK_Z + 1.0);
  group.add(coolFill);
  _alertKeyLights.push(coolFill);
  // a gentle warm raking directional from upper-right (form across the curved hull + ribs)
  const rake = new THREE.DirectionalLight(0xffe0bc, 0.5);
  rake.position.set(2.2, CK_H + 0.5, 0.6);
  rake.target.position.set(-1.2, 0.9, -0.8);
  group.add(rake);
  group.add(rake.target);
  _alertKeyLights.push(rake);
  // a cool counter-rake from the upper-LEFT (models the opposite curved wall — the temp split)
  const crake = new THREE.DirectionalLight(0x9ab2cc, 0.40);
  crake.position.set(-2.4, CK_H + 0.6, 1.2);
  crake.target.position.set(1.0, 1.2, -0.6);
  group.add(crake);
  group.add(crake.target);
  _alertKeyLights.push(crake);
  // cool WINDOW spill — the orbit-light entering from −Z onto the dash/sill.
  const winGlow = new THREE.PointLight(0xbcd2e4, 1.4, 6.0, 1.8);
  winGlow.position.set(0, 1.7, -CK_Z + 0.6);
  group.add(winGlow);
  _alertKeyLights.push(winGlow);
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
  // a RED RIM directional, OFF by default, a subtle ambient red on alert (NOT the main source).
  const rim = new THREE.DirectionalLight(0xff2418, 0.0);
  rim.position.set(-2.0, 1.4, 1.5);
  rim.target.position.set(0.5, 1.0, -1.0);
  group.add(rim);
  group.add(rim.target);
  _alertRimLight = rim;
  // ── A REAL RED BEACON (gate sev-2 — alert must come from a SOURCE, not a uniform filter): a
  //    caged strobe dome on the soffit + a red point light AT it (strong falloff → the cabin is
  //    brightest near the beacon, falling to the corners) that pulses on alert. OFF at level 0.
  // ROUND-2c RE-SEAT (ABSOLUTE rule: ZERO luminaires in the glazing). The previous mount at
  //   z=COLLAR_Z−0.15 (=0.19) sat FORWARD of the collar — inside the glazed dome, hanging under the
  //   crown SPINE which is a glass-frame member with panes on both sides. From the seat the red dome
  //   read as floating IN the glass (the user's 2nd report). FIX: mount it on the OPAQUE KEEL
  //   STRINGER (buildCockpitShell — a real fore-aft box beam at y=HULL_CROWN_MAX−0.05, running
  //   COLLAR_Z→CK_Z−0.25, strictly AFT of the collar over/behind the pilot's head). Bracket goes UP
  //   INTO the stringer; the dome hangs just below it. Still glanced up-aft from the seat + reads on
  //   alert, but on real opaque structure — never in the glazing.
  // ROUND-2d item-3 — SEPARATE the alert beacon from the ceiling light. The old zB=1.00 sat right
  //   behind the (former two-can) cluster → the "messy cluster" read. Moved CLEARLY AFT to zB=1.7 on
  //   the keel stringer (over/behind the pilot's head, ~1.2m aft of the single warm can at z=0.50) so
  //   the red ALERT beacon stands ALONE + purposeful — it exists only for the alert read. Still on the
  //   opaque keel stringer (runs z 0.34..2.25; never in the glazing), glanced up-aft from the seat on alert.
  const zB = COLLAR_Z + 1.36;                        // =1.70 — well aft on the keel stringer, clearly separated from the warm can (z=0.50)
  const spineY = HULL_CROWN_MAX - 0.10;              // =2.86 — the keel-stringer underside
  const beaconCan = _cyl(0.07, 0.09, 0.06, 10, _channel);
  beaconCan.position.set(0, spineY - 0.10, zB);
  group.add(beaconCan);
  const beaconStem = _cyl(0.028, 0.028, 0.10, 8, _channel);
  beaconStem.position.set(0, spineY - 0.05, zB);
  group.add(beaconStem);
  const beaconPad = _cyl(0.11, 0.13, 0.05, 12, _band);   // the mount bracket flush under the keel stringer
  beaconPad.position.set(0, spineY, zB);
  group.add(beaconPad);
  // a short riser lug bolting the bracket UP INTO the opaque keel stringer (the visible mount)
  const beaconLug = _box(0.10, 0.10, 0.10, _steel);
  beaconLug.position.set(0, spineY + 0.06, zB);
  group.add(beaconLug);
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0x2a0604 });   // dark dome (calm)
  _buildMats.push(beaconMat);
  const beaconGeo = new THREE.SphereGeometry(0.06, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  _disposables.push(beaconGeo);
  const beaconDome = new THREE.Mesh(beaconGeo, beaconMat);
  beaconDome.rotation.x = Math.PI;
  beaconDome.position.set(0, spineY - 0.12, zB);
  group.add(beaconDome);
  _alertBeaconMesh = beaconDome;
  const beacon = new THREE.PointLight(0xff2010, 0.0, 5.5, 2.0);
  beacon.position.set(0, spineY - 0.18, zB);
  group.add(beacon);
  _alertBeaconLight = beacon;
  // RIB STRIP-LIGHTS — thin emissive strips down real structural members (dark at level 0, hot red on
  //   alert → the alert reads as the SHIP's own warning lights firing, not a global tint).
  // COCKPIT-ROUND-2 items 6+7 RE-SEAT: the previous collar strips at z=COLLAR_Z−0.14 sat in the SAME
  //   plane as the wrap-to-collar side-closure GLASS (also at COLLAR_Z−0.14), so from the seat they
  //   read as loose grey/red RECTANGLES protruding into the glass at the shoulder junction (the user's
  //   screenshot). FIX: (a) recess the strips onto the collar FLANGE face (z=COLLAR_Z−0.11 — 3cm AFT of
  //   the closure-glass plane, so they sit BEHIND the glass as an integrated fixture, never proud of it);
  //   (b) lay them flush (depth 0.012, sunk into the flange); (c) only on the LOWER collar arch
  //   (my < 1.7 — below the shoulder line) so no strip crosses the head-height glass junction where the
  //   eye reads it as a floating tab. The aft heavy rib (z=1.3, behind the pilot) keeps its full run.
  _alertStripMats = [];
  for (const [rz, zOff, yCap] of [[COLLAR_Z, -0.06, 1.3], [1.3, 0.09, 99]] as const) {
    const prof = hullProfile(rz);
    for (const side of [1, -1]) {
      for (let i = 2; i < prof.length - 1; i += 2) {
        const ax = side * prof[i].x, ay = prof[i].y;
        const bx = side * prof[i + 1].x, by = prof[i + 1].y;
        const mx = (ax + bx) / 2, my = (ay + by) / 2;
        if (my > yCap) continue;   // skip the shoulder-and-above collar segments (behind the glass junction)
        const sm = new THREE.MeshBasicMaterial({ color: 0x1a0604 });
        _buildMats.push(sm);
        _alertStripMats.push(sm);
        const strip = _box(0.026, Math.hypot(bx - ax, by - ay), 0.012, sm);   // slimmer + flush (sunk on the flange)
        strip.position.set(mx, my, rz + zOff);   // recessed onto the collar flange (AFT of the closure glass)
        strip.rotation.z = Math.atan2(by - ay, bx - ax) - Math.PI / 2;
        group.add(strip);
      }
    }
  }
}

/** Build the HERO cockpit + the greybox corridor (mesh group + matched static colliders)
 *  at SHIP_ORIGIN. Idempotent — a second call while built is a no-op. */
export function buildShipScene(ctx: GameContext): void {
  if (shipGroup) return;
  _cockpitAlertLevel = 0;
  _furnitureColliders.length = 0;   // reset the inline furniture-collider accumulator (idempotent rebuild)
  // ── Bake the per-cockpit IBL (so the brushed-metal PBR reflects + shows a modeling spec
  //    gradient across the curved hull). PMREM from RoomEnvironment; applied per-material only.
  if (!_cockpitEnv) {
    const pmrem = new THREE.PMREMGenerator(ctx.three.renderer);
    const room = new RoomEnvironment();
    _cockpitEnv = pmrem.fromScene(room, 0.04).texture;
    room.dispose();
    pmrem.dispose();
  }
  _applyCockpitEnv(_cockpitEnv);
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

  // ── HERO CORRIDOR (R5b) — fully-modelled worn industrial ship corridor (structure + greeble +
  //    lit fixtures), matching the cockpit's worn-gunmetal idiom. Emits the WYSIWYG walkable
  //    colliders (unchanged from the greybox). setShipAlert/setEngineFire hooks stay wired.
  buildCorridor(group);
  buildCrewQuarters(group);   // X4 — the lived-in crew quarters off the −X wall, down toward the engine room
  buildViewportStrip(group);  // X4 — the long starboard viewport band (+X wall) showing space on the walk
  buildPodBay(group);   // R5c — the docked escape pod in its bay at the bridge end (the flee target + the physical enter)
  _bayPodBodies.length = 0;   // B2 — reset the docked-pod hull ring accumulator (idempotent rebuild)
  _addBayPodColliders(ctx);   // B2 — the walkable pod hull ring (gapped at the door) so the player walks IN through the door, not through the hull
  _airlockCtx = ctx;          // W2b — capture ctx for the state-driven sliding-door seal collider
  _airlockSealBody = null;    // idempotent rebuild — the previous seal (if any) was freed in dispose
  setBayAirlockDoor(0);       // W2b — the sliding door starts CLOSED (installs the seal collider that blocks the aperture)
  for (const [w, h, d, cx, cy, cz] of [...CORRIDOR_COLLIDERS, ...AIRLOCK_COLLIDERS, ...QUARTERS_COLLIDERS]) {   // W2b — airlock collar walkable; X4 — the crew quarters room walkable (both gapped through their doors)
    const col = makeStaticBox(
      ctx.physics.world,
      { x: w / 2, y: h / 2, z: d / 2 },
      { x: SHIP_ORIGIN.x + cx, y: SHIP_ORIGIN.y + cy, z: SHIP_ORIGIN.z + cz },
    );
    const body = col.parent();
    if (body) shipBodies.push(body);
  }
  buildEngineBay(group);   // the engine-bay fire at the dead-end (hidden until the disaster)

  // ── COCKPIT walkable static colliders (WYSIWYG — CLAUDE.md rule 9: collision matches the visible
  //    model exactly, updated in the SAME change as the geometry) + the FURNITURE colliders (now the
  //    console ONLY — accumulated inline during the builds). ──
  //    W1 STALE-COLLIDER SWEEP (2026-07-03): after the front-hull re-loft + the purge, every cockpit
  //    collider was enumerated (rig `--scenario=cockpit-colliders`) against the final geometry:
  //      • the FORWARD wall re-derived to the new canopy (sill dropped to 0.55 → below-band half-h
  //        0.275; glass up to 2.78 → thin roofline band at 2.88; tapered cheeks) — COCKPIT_COLLIDERS.
  //      • the CHAIR collider is DELETED (walkthrough) + NO invisible box remains behind it — the
  //        only aft-of-seat solids are floor/ceiling/aft-door-wall. Proven by the whole-cockpit
  //        real-KCC roam (`--scenario=cockpit-motion`: aft traverse to the door + strafe egress both
  //        sides + reach both walls + both forward corners beside the console; fwd blocked only by
  //        the solid console). The removed side-panel + pre-taper greeble carried NO colliders (they
  //        were decorative), so nothing stale lingers.
  //      • the CONSOLE collider is the sole furniture box, re-derived off the lowered deck (0.60).
  for (const [w, h, d, cx, cy, cz] of [...COCKPIT_COLLIDERS, ..._furnitureColliders]) {
    const col = makeStaticBox(
      ctx.physics.world,
      { x: w / 2, y: h / 2, z: d / 2 },
      { x: SHIP_ORIGIN.x + cx, y: SHIP_ORIGIN.y + cy, z: SHIP_ORIGIN.z + cz },
    );
    const body = col.parent();
    if (body) shipBodies.push(body);
  }
  _addDomeColliders(ctx);   // Y1 — the curve-fit glazed-dome perimeter wall (rotated segments; can't walk through the glass)

  group.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = false; o.receiveShadow = false; } });

  // ── PERF: STATIC-MERGE the shared-material greebles (rivets, panels, structure) into batched
  //    draws (the wreck-field discipline — mergeStaticByMaterial groups by material UUID). The
  //    cockpit alone is ~1400 tiny meshes (hundreds of _rivet studs sharing one material) → this
  //    collapses each material into ONE draw. PROTECT the disaster/alert dynamics: the merge helper
  //    skips any subtree tagged userData.noMerge, so tag every mesh/group the alert-recolor + the
  //    fire/door animation hold by REFERENCE (merging would detach those refs → they'd stop
  //    recoloring/animating). Their materials are recolored in place, so keeping the meshes whole
  //    keeps setCockpitAlert/setShipAlert/setEngineFire working exactly as before.
  const _protect = (o: THREE.Object3D | null): void => { if (o) o.userData.noMerge = true; };
  _protect(_alertScreenGlow);
  for (const led of _alertStatusLeds) _protect(led);
  _protect(_alertBeaconMesh);
  _protect(_engineFire);            // the additive engine-bay fire (flickers + repositions each frame)
  _protect(_engineDoorJudderL);     // the sliding engine-room door leaves (judder open on fire)
  _protect(_engineDoorJudderR);
  _protect(_bayGroup);              // Y3.4 — the docked-pod ROOT: releasePodFromBay moves its position/roll AND setBayPodYaw rotates it about its own axis; if merged, the pod BODY meshes would detach from the root and neither the shudder NOR the rotate-then-eject would move the pod (only the door pivot subtree would). Protecting the whole subtree keeps the root transformable as one rigid capsule.
  _protect(_bayDoorPivot);          // the docked-pod bay door pivot (swings)
  _protect(_airlockDoorL);          // W2b — the operational sliding-door leaves (slide open/shut)
  _protect(_airlockDoorR);
  _protect(_qtrDoorLeaf);           // X4 — the crew-quarters sliding-door leaf (setQuartersDoor slides it)
  // (the engine-room glass panes ride under the sliding-door leaves _engineDoorJudderL/R → already
  //  protected as children of a noMerge subtree, so their emissive-on-fire lift keeps working.)
  // DEV-ONLY: the geometry-lint stage sets `window.__stageNoMerge` so the z-fight sampler can see
  //   individual greeble meshes (the merge collapses shared-material greebles into one BufferGeometry
  //   whose internal coplanar overlaps the per-mesh sweep can't resolve). Never set in the game.
  if (!(typeof window !== 'undefined' && (window as unknown as { __stageNoMerge?: boolean }).__stageNoMerge)) {
    mergeStaticByMaterial(group);
  }

  ctx.three.scene.add(group);
  shipGroup = group;
}

/** Drive the cockpit ALERT state (the disaster escalation hook). Level 0 = calm "ORBIT
 *  ACHIEVED" (green); 1 = caution (amber shift); 2 = full RED-ALERT — the whole cabin goes
 *  hot-red (red wash + a red rim flooding the shell + dimmed warm keys = menace, not a local
 *  texture swap). Safe no-op if the ship isn't built. Wired to 0 at build. */
export function setCockpitAlert(level: 0 | 1 | 2, pulse = 1): void {
  _cockpitAlertLevel = level;
  if (!shipGroup) return;
  // screen face base colour
  if (_alertScreenGlow) {
    const m = _alertScreenGlow.material as THREE.MeshBasicMaterial;
    if (level === 0) m.color.setHex(0x1f5a2c);        // green CRT (calm)  [R2: brighter base]
    else if (level === 1) m.color.setHex(0x4a3208);   // amber caution
    else m.color.setHex(0x5a1410);                    // deep red alert
  }
  // the readout text bars
  for (const led of _alertStatusLeds) {
    const m = led.material as THREE.MeshBasicMaterial;
    if (level === 0) m.color.setHex(0x8cf29a);        // green text
    else if (level === 1) m.color.setHex(0xe6a73a);   // amber text
    else m.color.setHex(0xff5a4e);                    // red text
  }
  // the console wash light
  if (_alertWashLight) {
    if (level === 0) { _alertWashLight.color.setHex(0xffb24a); _alertWashLight.intensity = 1.2; }
    else if (level === 1) { _alertWashLight.color.setHex(0xff7a2e); _alertWashLight.intensity = 1.5; }
    else { _alertWashLight.color.setHex(0xff2418); _alertWashLight.intensity = 2.0; }
  }
  // ── THE BEACON is the real SOURCE (gate sev-2). It PULSES (the `pulse` param 0..1, driven
  //    per-frame by the disaster tick) so the alert reads as a strobing warning light with real
  //    falloff, not a flat global tint. Its dome emissive tracks the pulse too.
  if (_alertBeaconLight) {
    _alertBeaconLight.intensity = level === 2 ? (1.8 + 4.5 * pulse) : (level === 1 ? 0.6 : 0.0);
  }
  if (_alertBeaconMesh) {
    const m = _alertBeaconMesh.material as THREE.MeshBasicMaterial;
    if (level === 0) m.color.setHex(0x2a0604);
    else if (level === 1) m.color.setHex(0x7a3008);
    else m.color.setHex(level === 2 ? (pulse > 0.5 ? 0xff3018 : 0x901008) : 0x2a0604);
  }
  // rib STRIP-LIGHTS fire on alert (the ship's own warning lights → not a global wash)
  for (const sm of _alertStripMats) {
    if (level === 2) sm.color.setHex(pulse > 0.4 ? 0xff2814 : 0x5a0c06);
    else if (level === 1) sm.color.setHex(0x6a3a10);
    else sm.color.setHex(0x1a0604);
  }
  // a GENTLE global red rim on alert (ambient menace ONLY — the beacon does the heavy lifting so
  //   the surfaces still MODEL, not a flat Photoshop red).
  if (_alertRimLight) {
    _alertRimLight.intensity = level === 2 ? (0.7 + 0.5 * pulse) : (level === 1 ? 0.4 : 0.0);
  }
  // KEEP a COOL FILL alive even on alert (gate: "keep some cool fill so material still reads") —
  //   nudge the ambient toward a desaturated red-grey, NOT a saturated flat red, and keep value.
  if (_alertAmbient) {
    if (level === 2) { _alertAmbient.color.setHex(0x7a4a4a); _alertAmbient.groundColor.setHex(0x382226); _alertAmbient.intensity = 0.65; }
    else if (level === 1) { _alertAmbient.color.setHex(0x9a7a64); _alertAmbient.groundColor.setHex(0x40383a); _alertAmbient.intensity = 0.75; }
    else { _alertAmbient.color.setHex(0xaebccc); _alertAmbient.groundColor.setHex(0x4a4f55); _alertAmbient.intensity = 0.95; }
  }
  // dim the WARM keys on red-alert (cool fill + winGlow stay so the metal still reads).
  for (const k of _alertKeyLights) {
    if (k === _alertAmbient) continue;
    const base = (k.userData.baseIntensity ??= k.intensity) as number;
    k.intensity = level === 2 ? base * 0.45 : (level === 1 ? base * 0.8 : base);
  }
}

/** Current cockpit alert level (for tests / the beat machine). */
export function cockpitAlertLevel(): 0 | 1 | 2 {
  return _cockpitAlertLevel;
}

// ── HERO CORRIDOR (REBUILD v2 R5b) — the greybox tube → a fully-modelled, lived-in industrial
//    ship corridor, MATCHING the cockpit's worn-gunmetal idiom (same _shell/_deck/_steel/_channel/
//    _rivet metals + grime shader). Structure: a metal-tread deck (panel seams + rivets + a worn
//    centre traffic-lane), painted side walls broken into recessed panels with bolt rows + access
//    hatches, structural BULKHEAD RIB FRAMES at intervals (the tube reads as framed segments, not
//    one extruded pipe), a ceiling with a raceway spine + recessed can-lights (the corridor's own
//    real light sources) + ducting. Greeble: conduit + cable-loom runs at both wall/ceiling
//    junctions, a pipe run, grab-rails, hazard-stripe door frames, stencil placards + hull
//    numbers, wear + grime. Detail VARIES along the length (a mid junction, an aft engine-bay
//    frame) so it isn't a repeated segment. Self-contained lighting (warm can-lights + a cool
//    fill) that setShipAlert escalates to red. Everything within the WYSIWYG envelope (COR_*).
function buildCorridor(group: THREE.Group): void {
  const up = new THREE.Vector3(0, 1, 0);
  const nz = new THREE.Vector3(0, 0, -1);
  const zc = COR_ZC;

  // ── SHELL: structural floor / ceiling / walls (behind the finish surfaces — dark steel so torn
  //    edges + the recessed-panel gaps never read paper-thin). These sit at the collider envelope.
  const subFloor = _box(2 + 0.02, COR_WALL_T, COR_LEN, _channel);
  subFloor.position.set(0, -COR_WALL_T / 2, zc);
  group.add(subFloor);
  const roof = _box(2.6, COR_WALL_T, COR_LEN, _ceil);
  roof.position.set(0, COR_CH + COR_WALL_T / 2, zc);
  group.add(roof);
  const wallXm = -(COR_HW + COR_WALL_T / 2);   // −X structural wall plane centre (x)
  const _mkSeg = (z0: number, z1: number, y0: number, y1: number): void => {
    const len = z1 - z0; if (len < 0.02) return;
    const h = y1 - y0; if (h < 0.02) return;
    const w = _box(COR_WALL_T, h, len, _shell);
    w.position.set(wallXm, (y0 + y1) / 2, z0 + len / 2);
    group.add(w);
  };
  for (const sx of [1, -1]) {
    if (sx === -1) {
      // X4 — the −X structural wall is built as SOLID runs with two APERTURES cut for real doors: the
      //   AIRLOCK sliding-door opening (z BAY_APERTURE_Z0..Z1, up to AIRLOCK_TOP) + the CREW QUARTERS
      //   door (z _QTR_DOOR_Z0..Z1, up to QTR_DOOR_TOP). Item-3 FIX: the old build gapped the FULL
      //   BAY_Z0..BAY_Z1 which left the flanking strips beside the frame OPEN to the void (the tan
      //   space-bg leaked through). Now only the true door apertures are open; everything else is
      //   solid wall (matching the colliders = WYSIWYG). Above each aperture is a solid header band.
      const yTop = COR_CH + 0.2;
      // full-height solid runs BETWEEN the apertures
      _mkSeg(COR_Z0, BAY_APERTURE_Z0, 0, yTop);                 // mouth → airlock fore edge
      _mkSeg(BAY_APERTURE_Z1, _QTR_DOOR_Z0, 0, yTop);           // airlock aft edge → quarters door fore
      _mkSeg(_QTR_DOOR_Z1, COR_Z1, 0, yTop);                    // quarters door aft → dead-end
      // header bands ABOVE each aperture (so the wall seals over the door tops, not to the void)
      _mkSeg(BAY_APERTURE_Z0, BAY_APERTURE_Z1, AIRLOCK_TOP, yTop);   // over the airlock opening
      _mkSeg(_QTR_DOOR_Z0, _QTR_DOOR_Z1, QTR_DOOR_TOP, yTop);        // over the quarters door
      continue;
    }
    // +X wall — X4 item-2: gap a horizontal STRIP for the starboard viewport (VP_Z0..VP_Z1 at
    //   VP_CY ± VP_HH), leaving solid wall fore + aft + a sill band below + a header band above the
    //   glass. The glass (sealed) + frame fill the hole (buildViewportStrip). The collider stays the
    //   full solid +X wall (no walkable opening — you can't walk through the window).
    const xw = sx * (COR_HW + COR_WALL_T / 2);
    const vpLo = VP_CY - VP_HH, vpHi = VP_CY + VP_HH;
    // fore solid run (mouth → viewport)
    const wf2 = _box(COR_WALL_T, COR_CH + 0.2, VP_Z0 - COR_Z0, _shell);
    wf2.position.set(xw, COR_CH / 2, (COR_Z0 + VP_Z0) / 2);
    group.add(wf2);
    // aft solid run (viewport → dead-end)
    const wa2 = _box(COR_WALL_T, COR_CH + 0.2, COR_Z1 - VP_Z1, _shell);
    wa2.position.set(xw, COR_CH / 2, (VP_Z1 + COR_Z1) / 2);
    group.add(wa2);
    // sill band below the glass (0 → vpLo) + header band above (vpHi → ceiling), over the viewport span
    const sillH = vpLo;
    const wsill = _box(COR_WALL_T, sillH, VP_Z1 - VP_Z0, _shell);
    wsill.position.set(xw, sillH / 2, (VP_Z0 + VP_Z1) / 2);
    group.add(wsill);
    const hdrH = (COR_CH + 0.2) - vpHi;
    const whdr = _box(COR_WALL_T, hdrH, VP_Z1 - VP_Z0, _shell);
    whdr.position.set(xw, vpHi + hdrH / 2, (VP_Z0 + VP_Z1) / 2);
    group.add(whdr);
  }
  // dead-end BULKHEAD (the disaster trigger wall) — B1.e: a heavy riveted end-cap FRAMED around a
  //   central DOORWAY that reveals the ENGINE ROOM through its glass sliding door (buildEngineRoom).
  //   The bulkhead is built as the border AROUND the opening (jambs + lintel + sill panel) so the
  //   glass door + the room read through the hole; the walkable dead-end collider (CORRIDOR_COLLIDERS)
  //   still blocks the player at z≈14.7 (they can look but not pass).
  const bulkZ = COR_Z1 + COR_WALL_T / 2 + 0.05;
  const eDoorHW = 0.86, eDoorTop = 2.14;   // the engine-room doorway opening (in the bulkhead)
  //  left + right bulkhead panels (flanking the opening)
  for (const sx of [-1, 1]) {
    const panel = _box((2.4 - eDoorHW * 2) / 2 + 0.1, COR_CH + 0.2, COR_WALL_T, _steel);
    panel.position.set(sx * (eDoorHW + ((2.4 - eDoorHW * 2) / 2) / 2 - 0.05), COR_CH / 2, bulkZ);
    group.add(panel);
  }
  //  lintel panel above the opening
  const eLintel = _box(eDoorHW * 2 + 0.2, COR_CH + 0.2 - eDoorTop, COR_WALL_T, _steel);
  eLintel.position.set(0, (eDoorTop + COR_CH + 0.2) / 2, bulkZ);
  group.add(eLintel);
  //  a proud channel-steel doorway FRAME around the opening (corridor-side, so it reads framed)
  for (const [w, h, ox, oy] of [
    [eDoorHW * 2 + 0.24, 0.16, 0, eDoorTop + 0.08] as const,
    [0.16, eDoorTop + 0.16, -eDoorHW - 0.08, eDoorTop / 2] as const,
    [0.16, eDoorTop + 0.16, eDoorHW + 0.08, eDoorTop / 2] as const,
  ]) {
    const bar = _box(w, h, 0.14, _steel);
    bar.position.set(ox, oy, bulkZ - COR_WALL_T / 2 - 0.06);
    group.add(bar);
  }
  //  slim hazard accent + rivets down the frame (a warning threshold, matching the corridor language)
  for (const sx of [-1, 1]) {
    const haz = _box(0.04, eDoorTop - 0.3, 0.08, _corrHazard);
    haz.position.set(sx * (eDoorHW + 0.08), eDoorTop / 2, bulkZ - COR_WALL_T / 2 - 0.10);
    group.add(haz);
    for (let y = 0.4; y < eDoorTop; y += 0.5) group.add(_stud(sx * (eDoorHW + 0.14), y, bulkZ - COR_WALL_T / 2 - 0.06, new THREE.Vector3(0, 0, -1), _rivet, 0.016));
  }

  // ── DECK: bright worn tread over the sub-floor, a darker centre traffic-lane (footfall wear),
  //    tread strips, cross panel-seams with corner fasteners, and an edge rivet run.
  const deck = _box(1.96, 0.04, COR_LEN - 0.04, _deck);
  deck.position.set(0, 0.02, zc);
  group.add(deck);
  const lane = _box(0.86, 0.045, COR_LEN - 0.3, _steel);
  lane.position.set(0, 0.024, zc);
  group.add(lane);
  for (const sx of [-1, 1]) {
    const tread = _box(0.07, 0.03, COR_LEN - 0.4, _band);
    tread.position.set(sx * 0.62, 0.05, zc);
    group.add(tread);
  }
  // deck panel seams every ~1.5m + corner fasteners (a bolted plate deck, not a plane)
  for (let z = COR_Z0 + 0.9; z < COR_Z1; z += 1.5) {
    const seam = _box(1.9, 0.014, 0.03, _channel);
    seam.position.set(0, 0.044, z);
    group.add(seam);
    for (const fx of [-0.86, -0.3, 0.3, 0.86]) group.add(_stud(fx, 0.052, z, up, _rivet, 0.014));
  }
  // deck edge kickplate + rivet run along both wall feet (grime channel where deck meets wall)
  for (const sx of [1, -1]) {
    const kick = _box(0.05, 0.16, COR_LEN - 0.2, _channel);
    kick.position.set(sx * (COR_HW - 0.025), 0.08, zc);
    group.add(kick);
    for (let z = COR_Z0 + 0.5; z < COR_Z1; z += 0.75) group.add(_stud(sx * (COR_HW - 0.05), 0.055, z, up, _rivet, 0.012));
  }

  // ── BULKHEAD RIB FRAMES — the structural hoops that segment the tube. A rib = proud vertical
  //    posts (both walls) + a top cross-beam, in dark steel, with bolt rows. Placed at intervals;
  //    every other one carries a HAZARD-STRIPE painted frame (a doorway/bulkhead threshold read).
  // W2b — moved OFF the airlock span (was [3.4, 5.2, …]) so no rib post/beam crosses the sliding-door
  //   front (spec: the door front must be clean + readable as THE exit). The airlock frame's own jambs +
  //   lintel are the structure over BAY_Z0..BAY_Z1; the ribs pick up aft of it.
  const ribZ = [7.0, 8.8, 10.6, 12.4, 14.1];
  for (let ri = 0; ri < ribZ.length; ri++) {
    const z = ribZ[ri];
    const hazard = ri % 2 === 1;
    const postMat = hazard ? _corrHazard : _steel;
    for (const sx of [1, -1]) {
      // vertical rib post proud of the wall — skip the −X post over the airlock gap (the frame covers it)
      if (sx === -1 && _inBayGap(z)) continue;
      const post = _box(0.14, COR_CH, 0.16, postMat);
      post.position.set(sx * (COR_HW - 0.07), COR_CH / 2, z);
      group.add(post);
      // bolt column up the post
      for (let y = 0.35; y < COR_CH; y += 0.42) group.add(_stud(sx * (COR_HW - 0.145), y, z, new THREE.Vector3(-sx, 0, 0), _rivet, 0.016));
      // a flanking dark channel (recessed seam beside the rib)
      const chan = _box(0.04, COR_CH - 0.2, 0.06, _channel);
      chan.position.set(sx * (COR_HW - 0.16), COR_CH / 2, z);
      group.add(chan);
    }
    // top cross-beam of the frame — skip over the airlock gap so nothing crosses above the door front
    if (_inBayGap(z)) continue;
    const beam = _box(2 - 0.28, 0.16, 0.16, postMat);
    beam.position.set(0, COR_CH - 0.08, z);
    group.add(beam);
    for (const fx of [-0.7, -0.24, 0.24, 0.7]) group.add(_stud(fx, COR_CH - 0.165, z, down_(up), _rivet, 0.015));
    // hazard chevrons painted on the beam face of the "threshold" frames (a warning-striped lintel)
    if (hazard) {
      for (let cx = -0.7; cx <= 0.7; cx += 0.2) {
        const chev = _box(0.09, 0.1, 0.02, _channel);
        chev.position.set(cx, COR_CH - 0.08, z - 0.09);
        chev.rotation.z = 0.5;
        group.add(chev);
      }
    }
  }

  // ── WALL FINISH: each wall broken into recessed panels between the ribs (a raised panel face
  //    with a bolt border + a recessed dark reveal around it), plus access hatches + a placard.
  // W2b — fixed panel dividers (the ribs no longer sit fore of z=7, so panelize on a stable set that
  //   keeps the whole tube finished; the −X wall panels over the airlock are skipped below).
  const panelEdges = [COR_Z0 + 0.15, 3.5, 4.8, 6.1, 7.0, 8.8, 10.6, 12.4, COR_Z1 - 0.15];
  const seg: [number, number][] = [];   // [zStart, zEnd] panel spans
  for (let i = 0; i < panelEdges.length - 1; i++) seg.push([panelEdges[i], panelEdges[i + 1]]);
  for (const sx of [1, -1]) {
    for (let si = 0; si < seg.length; si++) {
      const [z0, z1] = seg[si];
      const zmid = (z0 + z1) / 2, len = z1 - z0 - 0.14;
      if (len < 0.2) continue;
      if (sx === -1 && (_inBayGap(zmid) || _inQuartersDoor(zmid))) continue;   // skip −X wall-finish where the pod-bay + quarters doors open (the door frames dress those)
      if (sx === 1 && _inViewportZ(zmid)) continue;   // X4 — skip +X wall-finish over the viewport band (the frame + glass dress it)
      // proud upper panel (raised battleship-grey plate — stands proud of the wall so the reveal
      //   around it reads as a real recessed seam)
      const panel = _box(0.06, 1.0, len, _band);
      panel.position.set(sx * (COR_HW - 0.02), 1.5, zmid);
      group.add(panel);
      // recessed lower panel (near-charcoal — a distinctly DARKER plate so the wall reads two clear
      //   values, not one flat grey; a grimy lower dado where scuffs + oil settle)
      const low = _box(0.035, 0.66, len, _channel);
      low.position.set(sx * (COR_HW - 0.005), 0.55, zmid);
      group.add(low);
      // a horizontal rub-rail / dado line between the two plates
      const dado = _box(0.06, 0.06, len + 0.1, _channel);
      dado.position.set(sx * (COR_HW - 0.03), 0.98, zmid);
      group.add(dado);
      // bolt border on the upper panel corners
      for (const py of [1.08, 1.92]) for (const pz of [zmid - len / 2 + 0.12, zmid + len / 2 - 0.12]) {
        group.add(_stud(sx * (COR_HW - 0.05), py, pz, new THREE.Vector3(-sx, 0, 0), _rivet, 0.014));
      }
      // an ACCESS HATCH on some panels (a recessed door with a latch + hinge studs) — varies the wall
      if (si % 3 === 1) {
        const hatch = _box(0.06, 0.7, Math.min(0.6, len - 0.1), _channel);
        hatch.position.set(sx * (COR_HW - 0.03), 1.45, zmid);
        group.add(hatch);
        const latch = _box(0.05, 0.08, 0.05, _rivet);
        latch.position.set(sx * (COR_HW - 0.065), 1.45, zmid + 0.22);
        group.add(latch);
        for (const hy of [1.15, 1.75]) group.add(_stud(sx * (COR_HW - 0.055), hy, zmid - 0.24, new THREE.Vector3(-sx, 0, 0), _rivet, 0.02));
      }
    }
  }

  // ── PLACARDS + HULL NUMBERS — stencilled labels on the wall (a lit decal face + a dark backing).
  //    Placed at a couple of spots along the length so the corridor has printed "signage".
  const placards: [number, number, number, number, number][] = [
    // [sx, y, z, w(along z), h]
    [-1, 1.75, 4.2, 0.34, 0.16],
    [1, 1.68, 6.2, 0.30, 0.20],   // X4 — moved fore of the viewport band (was z=9.0, floated on the glass)
    [-1, 1.6, 11.8, 0.4, 0.14],
  ];
  for (const [sx, py, pz, pw, ph] of placards) {
    if (sx === -1 && (_inBayGap(pz) || _inQuartersDoor(pz))) continue;   // no placard over the pod-bay gap or the quarters door
    if (sx === 1 && _inViewportZ(pz)) continue;   // X4 — no placard over the viewport glass
    const back = _box(0.02, ph + 0.03, pw + 0.03, _decal);
    back.position.set(sx * (COR_HW - 0.052), py, pz);
    group.add(back);
    const face = _box(0.01, ph, pw, _corrPlacard);
    face.position.set(sx * (COR_HW - 0.058), py, pz);
    group.add(face);
  }
  // ROUND-1c ENTRANCEWAY FLANK CLEANUP — the old "hull-number block" here was a yellow-hazard 0.5×0.5
  //   square with a dark inset (numBack _corrHazard + numFace _channel) that read as an unfinished
  //   yellow-bordered open box on the −X mouth flank (the user's "yellow-bordered box"). Replaced with a
  //   CLEAN stencilled hull-number placard in the corridor signage idiom (dark backing + slim steel bezel
  //   + lit stencil face, no yellow border), and MOVED to the +X (right) mouth flank so each flank reads
  //   ONE purposeful signature element: −X = the service spine, +X = this hull-number sign. Sits proud
  //   of the +X wall (front faces −X into the corridor), clear of the +X fore manifold + the viewport.
  {
    const sxx = 1, nx = sxx * (COR_HW - 0.02), nz = 3.35;
    const nrm = new THREE.Vector3(-sxx, 0, 0);
    const bezel = _box(0.04, 0.46, 0.42, _steel);        // a slim steel frame bezel (proud, framed)
    bezel.position.set(nx + sxx * 0.02, 1.55, nz);       // bezel back embeds into the wall (not coplanar)
    group.add(bezel);
    const back = _box(0.02, 0.36, 0.32, _decal);         // the dark stencil backing (recessed IN the bezel front)
    back.position.set(nx - sxx * 0.006, 1.55, nz);
    group.add(back);
    const face = _box(0.01, 0.28, 0.24, _corrPlacard);   // the lit stencil face (hull number), proud of the backing
    face.position.set(nx - sxx * 0.014, 1.55, nz);
    group.add(face);
    // four corner bolts on the bezel (a bolted signage plate — matches the placard/panel bolt idiom)
    for (const by of [1.37, 1.73]) for (const bz of [nz - 0.16, nz + 0.16]) group.add(_stud(nx + sxx * 0.01, by, bz, nrm, _rivet, 0.014));
  }

  // ── CEILING RACEWAY + DUCTING — a central spine box (cable raceway) down the crown, flanked by a
  //    round duct run, so the ceiling isn't a flat lid. Sits ABOVE the walkable underside (y>2.4).
  //    B1.c CLIPPING FIX: the ceiling runs START aft of the cockpit doorway REVEAL (which reaches
  //    z≈2.98) so the raceway/duct no longer clip INTO the doorway frame near the cockpit (the
  //    user's "ceiling vent clipping into the doorway frame"). ceilZ0 = the front-clear start.
  const ceilZ0 = 3.1;
  const ceilLen = COR_Z1 - ceilZ0 - 0.1, ceilZc = (ceilZ0 + COR_Z1) / 2 - 0.05;
  const raceway = _box(0.5, 0.14, ceilLen, _steel);
  raceway.position.set(0, COR_CH - 0.07, ceilZc);
  group.add(raceway);
  for (let z = ceilZ0 + 0.5; z < COR_Z1; z += 1.2) {
    const clamp = _box(0.56, 0.05, 0.06, _channel);
    clamp.position.set(0, COR_CH - 0.14, z);
    group.add(clamp);
  }
  // a fat round DUCT running along one shoulder of the ceiling (darker steel so it doesn't read
  //   as a bright pale pipe dominating the crown) — also front-clear of the doorway reveal.
  const duct = _cyl(0.11, 0.11, ceilLen, 12, _steel);
  duct.rotation.x = Math.PI / 2;
  duct.position.set(0.66, COR_CH - 0.14, ceilZc);
  group.add(duct);
  // FIX PASS (SEV5: "the ceiling pipe above the viewport ends open-bore in mid-air"). The duct's
  //   fore + aft ends were bare cylinder discs floating over the corridor — from the viewport walk the
  //   fore end read as an open bore hanging in mid-air above the viewport top rail. Land BOTH ends in
  //   a ceiling JUNCTION BOX + a flange collar (the same "terminate the pipe in a manifold/flange"
  //   idiom as the low-pipe elbow + the conduit manifolds), so the run reads as ducted-into-a-plenum.
  for (const [dz, sfore] of [[ceilZc - ceilLen / 2, true], [ceilZc + ceilLen / 2, false]] as const) {
    const jbox = _box(0.34, 0.30, 0.22, _channel);            // a ceiling plenum/junction box the duct enters
    jbox.position.set(0.66, COR_CH - 0.12, dz + (sfore ? -0.10 : 0.10));
    group.add(jbox);
    const collar = _cyl(0.135, 0.135, 0.06, 12, _steel);      // a flange collar where the duct meets the box
    collar.rotation.x = Math.PI / 2;
    collar.position.set(0.66, COR_CH - 0.14, dz + (sfore ? -0.02 : 0.02));
    group.add(collar);
  }
  // duct support straps
  for (let z = COR_Z0 + 1.0; z < COR_Z1; z += 1.8) {
    const strap = _cyl(0.135, 0.135, 0.04, 12, _steel);
    strap.rotation.x = Math.PI / 2;
    strap.position.set(0.66, COR_CH - 0.14, z);
    group.add(strap);
  }

  // ── CONDUIT + CABLE-LOOM RUNS at BOTH wall/ceiling junctions (the "lived-in" greeble). A pair of
  //    parallel conduit pipes + a fat rubber cable loom, clamped at intervals, running the length.
  //  FIX PASS (SEV1: "the UPPER handrail + trim bar cross the quarters doorway at head height").
  //    ROOT CAUSE: these −X-wall runs (loom at y≈1.9, lower conduit at y≈2.06 — right at the
  //    QTR_DOOR_TOP 2.06 head-height) ran the FULL corridor length with no aperture split, so they
  //    barred the OPEN quarters doorway (and the pod-bay opening) exactly like the lower rail used to.
  //    FIX: the −X (sx=−1) runs are now SPLIT around BOTH the bay gap AND the quarters door — a fore
  //    stub → bay → quarters-door-fore → aft run — with a capped JUNCTION BOX at each cut edge (both
  //    sides), the same clean-terminated idiom as the lower rail's end caps + the fore/aft manifolds.
  //    The +X (sx=1) runs stay continuous (no door on that wall). These carry NO colliders (greeble),
  //    so no collider split is needed (rule 9 VERIFY: the structural wall gap + KCC are unchanged).
  const _runSegsX = (sx: number): Array<[number, number]> =>
    sx === 1
      ? [[COR_Z0 + 0.1, COR_Z1 - 0.1]]                                     // +X wall: one continuous run
      : [[COR_Z0 + 0.1, BAY_Z0], [BAY_Z1, _QTR_DOOR_Z0], [_QTR_DOOR_Z1, COR_Z1 - 0.1]];  // −X: split around both doors
  for (const sx of [1, -1]) {
    const segs = _runSegsX(sx);
    for (const [rz0, rz1] of segs) {
      // ROUND-1e Z-FIGHT SWEEP: the conduit/loom cylinder END-DISCS landed exactly at the door-aperture
      //   cut edge (rz0/rz1), coplanar with the junction CAP box's near face there → shimmer at the
      //   quarters-door fore/aft jamb top (the lint flagged mesh#918-922 at z=8.98/10.22). FIX: recess
      //   each end that lands at a DOOR APERTURE (not the mouth/dead-end, which the manifolds terminate)
      //   by 0.06 so the disc hides INSIDE the cap box (depth 0.10), not on its face plane.
      const foreDoor = rz0 > COR_Z0 + 0.15;   // this seg's fore end is a door-aperture edge (gets a cap)
      const aftDoor = rz1 < COR_Z1 - 0.15;    // this seg's aft end is a door-aperture edge (gets a cap)
      const cz0 = rz0 + (foreDoor ? 0.06 : 0), cz1 = rz1 - (aftDoor ? 0.06 : 0);
      const rlen = cz1 - cz0;
      if (rlen < 0.25) continue;
      const rzc = (cz0 + cz1) / 2;
      for (let ci = 0; ci < 2; ci++) {
        const cd = _cyl(0.035 + ci * 0.012, 0.035 + ci * 0.012, rlen, 8, ci === 0 ? _steel : _band);
        cd.rotation.x = Math.PI / 2;
        cd.position.set(sx * (COR_HW - 0.07 - ci * 0.1), COR_CH - 0.2 - ci * 0.14, rzc);
        group.add(cd);
      }
      // the fat black cable loom, sagging slightly (a lower position, thicker, matte rubber)
      const loom = _cyl(0.06, 0.06, rlen, 8, _cable);
      loom.rotation.x = Math.PI / 2;
      loom.position.set(sx * (COR_HW - 0.05), COR_CH - 0.5, rzc);
      group.add(loom);
      // cap EACH cut edge that lands at a door aperture with a small junction box (so the runs read
      //   terminated + worked at the doorway, not floating cut tubes — the end-cap idiom). Skip the
      //   corridor-mouth/dead-end ends (the fore/aft manifolds below already terminate those).
      for (const [cz, isFore] of [[rz0, true], [rz1, false]] as const) {
        if (cz <= COR_Z0 + 0.15 || cz >= COR_Z1 - 0.15) continue;   // mouth/dead-end handled by the manifolds
        const cap = _box(0.14, 0.42, 0.10, _channel);
        cap.position.set(sx * (COR_HW - 0.08), COR_CH - 0.32, cz + (isFore ? 0.05 : -0.05));
        group.add(cap);
      }
    }
    // clamps holding the runs to the wall — skip over the −X door apertures (no clamp on the void).
    //   ROUND-1e FLOATER FIX: the clamp sat at x=±0.95, y=2.08 — between/below the two conduits (ci=0 at
    //   x±0.93/y2.2, ci=1 at x±0.83/y2.06), touching NEITHER within the 1.5cm tol → the lint flagged it
    //   as a floating island (a pre-existing finding). Now a wider clamp saddle that BRIDGES from the
    //   wall over BOTH conduit tubes (spans x to the inner conduit, y across both) — it visibly clamps
    //   the run to the wall, no floater.
    for (let z = COR_Z0 + 0.55; z < COR_Z1; z += 0.9) {
      if (sx === -1 && (_inBayGap(z) || _inQuartersDoor(z))) continue;
      const clamp = _box(0.05, 0.30, 0.04, _channel);   // taller saddle: y-spans both conduits (2.06..2.2)
      clamp.position.set(sx * (COR_HW - 0.09), COR_CH - 0.27, z);   // x=±0.91 (over the ci=0 tube), centred on the run
      group.add(clamp);
    }
    // The conduit/loom runs must NOT end abruptly at the corridor mouth. A JUNCTION box at each wall's
    //   fore end swallows the pipe/cable ends (they route INTO it). A matching smaller terminator caps
    //   the aft ends at the dead-end. ROUND-1c ENTRANCEWAY CLEANUP: the −X FORE end is now handled by a
    //   single full-height SERVICE SPINE built below (the high runs AND the low coolant pipe both
    //   terminate into one clean vertical box, replacing the old separate high-manifold + floor-drop
    //   elbow that read kit-bashed). So here the −X fore manifold is SKIPPED; the +X fore + both aft
    //   terminators are kept.
    const ends: Array<[number, number, THREE.Material]> = [[COR_Z1 - 0.02, 0.30, _channel]];   // aft terminator (both walls)
    if (sx === 1) ends.unshift([COR_Z0 + 0.02, 0.42, _steel]);                                  // +X fore manifold (kept)
    for (const [mz, mw, mmat] of ends) {
      const manifold = _box(0.18, 0.62, mw, mmat);
      manifold.position.set(sx * (COR_HW - 0.09), COR_CH - 0.35, mz);
      group.add(manifold);
      // a proud face plate + a bolt border (a real electrical box)
      const plate = _box(0.05, 0.5, mw - 0.08, _band);
      plate.position.set(sx * (COR_HW - 0.185), COR_CH - 0.35, mz);
      group.add(plate);
      for (const py of [COR_CH - 0.14, COR_CH - 0.56]) for (const pz of [mz - mw / 2 + 0.08, mz + mw / 2 - 0.08]) {
        group.add(_stud(sx * (COR_HW - 0.21), py, pz, new THREE.Vector3(-sx, 0, 0), _rivet, 0.014));
      }
      // a couple of cable GLANDS on the box face where the looms enter (small collars)
      for (const gy of [COR_CH - 0.24, COR_CH - 0.46]) {
        const gland = _cyl(0.035, 0.045, 0.06, 8, _channel);
        gland.rotation.z = Math.PI / 2;
        gland.position.set(sx * (COR_HW - 0.16), gy, mz + (mz < COR_ZC ? mw / 2 - 0.06 : -mw / 2 + 0.06));
        group.add(gland);
      }
    }
  }
  // ROUND-1c ENTRANCEWAY FLANK CLEANUP (−X mouth) — ONE clean full-height SERVICE SPINE at the fore
  //   end, replacing the old cluster (a high electrical manifold + a separate low-pipe floor-drop elbow
  //   + scattered glands that read kit-bashed). The high conduit/loom runs terminate into its TOP; the
  //   low coolant pipe rises INTO its BASE — one purposeful vertical junction everything visibly enters.
  {
    const sx = -1, sz = COR_Z0 + 0.30;   // just aft of the archway, fore of the airlock jamb (z≈2.9)
    const wx = sx * (COR_HW - 0.08);      // the spine body centre (−0.92) — its BACK embeds INTO the wall (see below)
    // the spine body — a tall slim junction cabinet from waist to the ceiling raceway. ROUND-1e Z-FIGHT
    //   SWEEP: sized/placed so its BACK face embeds 0.07m INTO the corridor wall (back x=−1.07, behind
    //   the wall front −1.0) — NOT coplanar with the wall front (the first build's back sat exactly at
    //   −1.0 → an _steel/_shell coplanar flicker at the archway, caught by the dolly probe). Front proud.
    const spine = _box(0.30, 1.9, 0.34, _steel);   // back −1.07, front −0.77 (proud into the corridor)
    spine.position.set(wx, 1.35, sz);
    group.add(spine);
    // a proud face panel (two-value, matches the corridor panel idiom) + a bolt border. The spine front
    //   is at wx+0.15 (−0.77); the face stands PROUD of that at −0.74 (offset +0.18 from wx along +X).
    const face = _box(0.05, 1.6, 0.24, _band);
    face.position.set(wx - sx * 0.18, 1.35, sz);   // −0.74, proud of the spine front (−0.77)
    group.add(face);
    for (const fy of [0.62, 1.35, 2.08]) for (const fz of [sz - 0.09, sz + 0.09]) group.add(_stud(wx - sx * 0.205, fy, fz, new THREE.Vector3(-sx, 0, 0), _rivet, 0.014));
    // a small dark readout + two status lenses (a live junction, not a blank box) — on the face front
    const readout = _box(0.03, 0.16, 0.16, _screenGlass);
    readout.position.set(wx - sx * 0.21, 1.7, sz);
    group.add(readout);
    for (const [ly, lm] of [[1.5, _ledGreen], [1.42, _ledAmber]] as const) {
      const led = _cyl(0.02, 0.02, 0.02, 8, lm);
      led.rotation.z = Math.PI / 2;
      led.position.set(wx - sx * 0.215, ly, sz + 0.12);
      group.add(led);
    }
    // cable GLANDS on the TOP face where the two conduits + the loom enter from above (they route in)
    for (const gz of [sz - 0.08, sz, sz + 0.08]) {
      const gland = _cyl(0.035, 0.045, 0.08, 8, _channel);
      gland.position.set(wx, 2.28, gz);   // vertical, entering the spine top
      group.add(gland);
    }
    // the low coolant pipe rises INTO the spine base: a short vertical riser + a flange where it enters
    const riser = _cyl(0.05, 0.05, 0.5, 10, _steel);
    riser.position.set(wx, 0.62, sz + 0.02);
    group.add(riser);
    const rflange = _cyl(0.08, 0.08, 0.05, 12, _channel);
    rflange.position.set(wx, 0.88, sz + 0.02);   // the flange where the riser meets the spine base
    group.add(rflange);
  }
  // a low PIPE run along the −X wall foot (a plumbing/coolant line, waist-low) — SPLIT around BOTH
  //   the pod-bay opening AND the quarters door so it doesn't bar either entranceway (item 1: clean
  //   quarters door front). Fwd stub → bay → quarters-door fore → aft run.
  for (const [pz0, pz1] of [[COR_Z0, BAY_Z0], [BAY_Z1, _QTR_DOOR_Z0], [_QTR_DOOR_Z1, COR_Z1]] as const) {
    const plen = pz1 - pz0 - 0.2;
    if (plen < 0.2) continue;
    const pipe = _cyl(0.05, 0.05, plen, 10, _steel);
    pipe.rotation.x = Math.PI / 2;
    pipe.position.set(-(COR_HW - 0.08), 0.5, (pz0 + pz1) / 2);
    group.add(pipe);
  }
  // ROUND-1c ENTRANCEWAY CLEANUP — the low pipe's fore end now routes UP into the SERVICE SPINE (built
  //   above) via an elbow knuckle, instead of the old separate floor-drop elbow + flange near the
  //   archway (which read as a floating rod on the mouth flank). One clean termination: the pipe rises
  //   into the spine base where the riser + flange receive it.
  {
    const knuckle = _cyl(0.06, 0.06, 0.12, 10, _steel);   // the elbow knuckle turning the pipe up toward the spine
    knuckle.position.set(-(COR_HW - 0.08), 0.5, COR_Z0 + 0.32);
    group.add(knuckle);
  }
  for (let z = COR_Z0 + 0.7; z < COR_Z1; z += 1.4) {
    if (_inBayGap(z) || _inQuartersDoor(z)) continue;   // no bracket over the bay gap or the quarters door
    const bracket = _box(0.06, 0.12, 0.05, _steel);
    bracket.position.set(-(COR_HW - 0.06), 0.5, z);
    group.add(bracket);
  }
  // a couple of inline VALVES / gauges on the low pipe (breaks the straight run — worked hardware)
  for (const [vz, sx] of [[10.2, -1], [10.2, -1]] as const) {
    const wheel = _cyl(0.09, 0.09, 0.03, 10, _corrRail);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(sx * (COR_HW - 0.12), 0.5, vz);
    group.add(wheel);
    const body = _box(0.1, 0.14, 0.14, _channel);
    body.position.set(sx * (COR_HW - 0.05), 0.5, vz);
    group.add(body);
  }

  // ── WALL-MOUNTED HARDWARE (varies the length so it's not a repeated tube): a junction/breaker
  //    box + a fire-suppression bottle on brackets, at distinct spots on opposite walls.
  //  breaker box (+X wall, mid) — a proud grey cabinet with a hazard-yellow door + a latch + vents
  {
    const bz = 6.4, sx = 1;
    const cab = _box(0.12, 0.6, 0.5, _band);
    cab.position.set(sx * (COR_HW - 0.06), 1.5, bz);
    group.add(cab);
    const door = _box(0.03, 0.5, 0.42, _corrHazard);
    door.position.set(sx * (COR_HW - 0.13), 1.5, bz);
    group.add(door);
    for (const vy of [1.66, 1.58, 1.5, 1.42, 1.34]) {   // louvre vents
      const vent = _box(0.01, 0.015, 0.34, _channel);
      vent.position.set(sx * (COR_HW - 0.145), vy, bz);
      group.add(vent);
    }
    const latch = _box(0.04, 0.1, 0.04, _rivet);
    latch.position.set(sx * (COR_HW - 0.15), 1.5, bz + 0.18);
    group.add(latch);
  }
  //  a red fire-suppression BOTTLE on brackets (−X wall, aft) — a diegetic safety detail
  {
    const fz = 11.0, sx = -1;
    const bottle = _cyl(0.09, 0.1, 0.6, 12, _corrHazard);
    bottle.position.set(sx * (COR_HW - 0.11), 0.95, fz);
    group.add(bottle);
    // recolor via a dedicated red-ish look — reuse the hazard paint but cap it with a dark valve head
    const head = _cyl(0.05, 0.07, 0.08, 10, _channel);
    head.position.set(sx * (COR_HW - 0.11), 1.29, fz);
    group.add(head);
    for (const by of [1.1, 0.8]) {   // wall brackets
      const brk = _box(0.06, 0.05, 0.16, _steel);
      brk.position.set(sx * (COR_HW - 0.05), by, fz);
      group.add(brk);
    }
  }

  // ── GRAB-RAILS — a horizontal handrail down each wall at grip height, on stand-off brackets
  //    (a real freighter corridor detail; reads as a walked, worked space).
  for (const sx of [1, -1]) {
    if (sx === -1) {
      // the −X grab-rail is SPLIT around the bay opening AND the quarters door (it would otherwise
      //   bar the entranceway). ROUND-1c: the old FORE stub [COR_Z0+0.3, BAY_Z0] (a 0.3m rail behind the
      //   service spine) read as a floating rod on the mouth flank → dropped; the rail now starts AFT of
      //   the airlock. Runs: airlock-aft → quarters-door fore → aft.
      for (const [rz0, rz1] of [[BAY_Z1, _QTR_DOOR_Z0], [_QTR_DOOR_Z1, COR_Z1 - 0.3]] as const) {
        const rlen = rz1 - rz0;
        if (rlen < 0.2) continue;
        const rail = _cyl(0.028, 0.028, rlen, 8, _corrRail);
        rail.rotation.x = Math.PI / 2;
        rail.position.set(-(COR_HW - 0.09), 1.15, (rz0 + rz1) / 2);
        group.add(rail);
      }
      for (let z = COR_Z0 + 0.7; z < COR_Z1; z += 2.0) {
        if (_inBayGap(z) || _inQuartersDoor(z)) continue;
        const stand = _box(0.05, 0.05, 0.05, _rivet);
        stand.position.set(-(COR_HW - 0.05), 1.15, z);
        group.add(stand);
      }
      continue;
    }
    const rail = _cyl(0.028, 0.028, COR_LEN - 0.6, 8, _corrRail);
    rail.rotation.x = Math.PI / 2;
    rail.position.set(sx * (COR_HW - 0.09), 1.15, zc);
    group.add(rail);
    for (let z = COR_Z0 + 0.7; z < COR_Z1; z += 2.0) {
      const stand = _box(0.05, 0.05, 0.05, _rivet);
      stand.position.set(sx * (COR_HW - 0.05), 1.15, z);
      group.add(stand);
    }
  }

  // ── RECESSED CEILING CAN-LIGHTS — the corridor's OWN light sources (gate: light must have a
  //    believable origin, not a floating blob). A metal bezel + a glowing warm lens + a real point
  //    light AT each. These + a cool fill are the ONLY corridor lighting (self-contained; the ship
  //    sees no world sun). setShipAlert dims these + fires the red strips.
  _corrNormalLights.length = 0;
  _corrLensMats.length = 0;
  // FIX PASS (SEV2: "the yellow hazard rib crosses the recessed ceiling can-light above the quarters
  //   door"). ROOT CAUSE: the can-light at z=8.8 shared its z with the hazard BULKHEAD RIB at ribZ[1]=8.8
  //   (its full-crown cross-beam + the +X post routed straight over/through the light bezel — a structural
  //   member occluding a fixture). FIX: slid THIS fixture fore to z=8.2 (into the clear panel gap between
  //   the z=7.0 and z=8.8 ribs), so neither occludes the other; both elements kept. The light's point
  //   lamps ride the bezel z, so the corridor pool just shifts 0.6m fore — spacing stays even (6.2→8.2→
  //   11.4, with the z=9.4 pool light still filling the aft stretch). No collider involved (can-lights +
  //   ribs are pure greeble; CORRIDOR_COLLIDERS is untouched — rule 9 VERIFY).
  const canZ = [3.6, 6.2, 8.2, 11.4, 13.8];
  for (let li = 0; li < canZ.length; li++) {
    const z = canZ[li];
    // recessed housing set into the ceiling either side of the raceway
    for (const sx of [-1, 1]) {
      const bezel = _box(0.34, 0.06, 0.5, _channel);
      bezel.position.set(sx * 0.42, COR_CH - 0.03, z);
      group.add(bezel);
      const lensMat = _corrLens.clone();
      _buildMats.push(lensMat);
      _corrLensMats.push(lensMat);
      const lens = _box(0.24, 0.02, 0.4, lensMat);
      lens.position.set(sx * 0.42, COR_CH - 0.065, z);
      group.add(lens);
      // a wire guard cage across the lens (industrial fixture read)
      for (const gx of [-0.08, 0, 0.08]) {
        const bar = _box(0.012, 0.012, 0.42, _steel);
        bar.position.set(sx * 0.42 + gx, COR_CH - 0.08, z);
        group.add(bar);
      }
    }
    // one point light per fixture station (warm worn-industrial white); a softer falloff (1.6) +
    //   more reach so the pools OVERLAP down the tube (no dead-dark gaps between fixtures — the
    //   round-1 read was patchy/underlit). Two lamps per station (a hair off-centre) so the light
    //   lands on BOTH walls, not just the crown.
    for (const lx of [-0.42, 0.42]) {
      const lamp = new THREE.PointLight(0xffd6a0, 0.95, 6.4, 1.6);
      lamp.position.set(lx, COR_CH - 0.2, z);
      group.add(lamp);
      _corrNormalLights.push(lamp);
    }
  }
  // a warm ambient FILL so the crushed lower walls + deck read a mid-tone + the metal shows a
  //   modeling gradient across the tube (mirrors the cockpit's hemisphere fill idiom). Warm-over-
  //   cool (a warm worn-industrial cast up top, cooler grimy deck) + lifted so it's not a cold morgue.
  const corrFill = new THREE.HemisphereLight(0xc4b299, 0x40454c, 0.72);
  corrFill.position.set(0, COR_CH, zc);
  group.add(corrFill);
  _corrNormalLights.push(corrFill);
  // a couple of soft warm pooling points down the tube (fills the mid-corridor between fixtures so
  //   the walls read a warm lived-in wash + the deep sections aren't near-black).
  for (const pz of [5.0, 9.4, 12.6]) {
    const pool = new THREE.PointLight(0xffc890, 0.5, 5.5, 1.7);
    pool.position.set(0, 1.5, pz);
    group.add(pool);
    _corrNormalLights.push(pool);
  }
  // a faint cool spill from the corridor MOUTH (the cockpit's cool space-light bleeding aft)
  const mouthGlow = new THREE.PointLight(0xa8c2d8, 0.7, 6.0, 1.6);
  mouthGlow.position.set(0, 1.6, COR_Z0 + 0.4);
  group.add(mouthGlow);
  _corrNormalLights.push(mouthGlow);

  // ── RED STRIP-LIGHTS + BEACON WASH (the corridor's own warning system) — thin emissive channel
  //    strips low on both walls + on the ceiling raceway, DARK at level 0, driven hot-red +
  //    strobing by setShipAlert. Plus two red point lights (mid + aft) that flood the tube on
  //    alert with real falloff (so the red is a SOURCE + a modelled wash, not a flat filter).
  _corrRedStripMats.length = 0;
  for (const sx of [1, -1]) {
    for (let z = COR_Z0 + 0.4; z < COR_Z1; z += 1.5) {
      if (sx === -1 && (_inBayGap(z + 0.75) || _inQuartersDoor(z + 0.75))) continue;   // no red strip across the bay opening or the quarters door
      const sm = new THREE.MeshBasicMaterial({ color: 0x1c0604 });
      _buildMats.push(sm);
      _corrRedStripMats.push(sm);
      const strip = _box(0.03, 0.05, 1.1, sm);
      strip.position.set(sx * (COR_HW - 0.02), 0.32, z + 0.75);
      group.add(strip);
    }
  }
  // ceiling raceway-edge red runners (a continuous alert line down the crown)
  for (const sx of [-1, 1]) {
    const sm = new THREE.MeshBasicMaterial({ color: 0x1c0604 });
    _buildMats.push(sm);
    _corrRedStripMats.push(sm);
    const run = _box(0.03, 0.03, COR_LEN - 0.6, sm);
    run.position.set(sx * 0.27, COR_CH - 0.02, zc);
    group.add(run);
  }
  const redLight = new THREE.PointLight(0xff2214, 0.0, 7.5, 1.8);
  redLight.position.set(0, 1.5, COR_Z1 - 3.0);
  group.add(redLight);
  _corrRedLight = redLight;
  const redLight2 = new THREE.PointLight(0xff2214, 0.0, 7.0, 1.8);
  redLight2.position.set(0, 1.5, COR_ZC - 1.0);
  group.add(redLight2);
  _corrRedLight2 = redLight2;

  void nz;
  // wire the calm default (lights up, red off) — safe (refs just set above).
  setShipAlert(0);
}

// tiny helper — a downward face vector (for studs domed downward off a lintel/beam underside).
function down_(_up: THREE.Vector3): THREE.Vector3 { return new THREE.Vector3(0, -1, 0); }

// ── W2b — THE ESCAPE-POD AIRLOCK + THE DOCKED POD. The sliding door (in the −X wall) → a short
//    gasketed collar → the pod's own door (the canonical pod's merged glass front door IS the
//    collar's far end). The pod body sits MOSTLY OUTSIDE the hull (x < −1.0); only its +X door-arc
//    protrudes toward the collar → it reads as a VESSEL DOCKED to the ship, not parked in a closet.
//    Everything is at/outside the −X wall line (buildCorridor skips the wall over the aperture); the
//    walkable tube + corridor colliders are untouched. Warm airlock-light spills back into the corridor.
// The docked pod is the ONE CANONICAL module (buildCanonicalPodExterior, podScene) — its skin/scorch/
//   band/frame materials + geometry + real glass porthole (full interior visible through it) live
//   there, shared across phases. Only the AIRLOCK's own dressing materials remain here.
// hazard ACCENT chevron paint — a saturated warn-yellow used ONLY as thin edge accents (doorway
//   leading edges), NOT the primary read. Worn matte so it takes the airlock light like painted steel.
const _bayHazardAccent = _metal(0xc39a22, 0.28, 0.70, { flat: true, grime: true });
// umbilical hoses — dark ribbed rubber conduit (reuse the corridor cable idiom).
const _bayHose = _metal(0x1c1a1e, 0.10, 0.86, { flat: true });
// a brass/bronze coupling on the umbilicals + fuel line (a warm hardware pop vs the grey hull).
const _bayCoupling = _metal(0x6e5a34, 0.55, 0.55, { flat: true });
// airlock seal collar — a dark rubber gasket ring at the collar mouth (matte, non-metal).
const _baySeal = _metal(0x16151a, 0.06, 0.90, { flat: true });
// the OPERATIONAL sliding-door leaf face — a heavy blast-door slab (the engine-room door idiom but
//   OPAQUE steel + it actually OPENS). Worn gunmetal, a touch glossier than the hull so it reads as
//   a fabricated door plate, not wall.
const _bayDoorLeaf = _metal(0x4a5056, 0.52, 0.54, { flat: true, grime: true });
let _bayGlowLight: THREE.PointLight | null = null;   // warm spill from the airlock into the corridor
let _bayGroup: THREE.Group | null = null;            // the docked-pod group (release shudder rides this)
// W2b — the OPERATIONAL sliding door: two leaves that slide apart into wall pockets. setBayAirlockDoor
//   drives them; a state-driven seal collider blocks the aperture when closed.
let _airlockDoorL: THREE.Group | null = null;
let _airlockDoorR: THREE.Group | null = null;
let _airlockDoorT = 0;                                // current open param (0 closed → 1 open)

// ── W2b — THE AIRLOCK BOARDING SURFACES. World-space anchors the boarding flow (sequence.ts)
//    gazes/gates against. The flow is now: approach the SLIDING DOOR (getBayAirlockThreshold, trigger
//    it) → walk the collar → the POD DOOR (getPodBayDoorWorld / getPodBayThreshold) → sit.
/** World-space STANDING position in the corridor in front of the SLIDING DOOR — where the player
 *  stands to trigger it (the sliding-door E-open gaze/proximity anchor). Corridor-side of the −X wall
 *  plane, centred on the airlock aperture, standing eye height. NEW W2b export. */
export function getBayAirlockThreshold(): THREE.Vector3 {
  return new THREE.Vector3(SHIP_ORIGIN.x + AIRLOCK_WALL_X + 0.60, SHIP_ORIGIN.y + 1.62, SHIP_ORIGIN.z + BAY_ZC);
}
/** World centre of the SLIDING DOOR (in the −X wall plane, at aperture centre-height) — the E-OPEN
 *  gaze/proximity target for the sliding door. NEW W2b export. */
export function getBayAirlockDoorWorld(): THREE.Vector3 {
  return new THREE.Vector3(SHIP_ORIGIN.x + AIRLOCK_WALL_X, SHIP_ORIGIN.y + AIRLOCK_TOP * 0.5, SHIP_ORIGIN.z + BAY_ZC);
}
/** World-space STANDING position INSIDE the collar in front of the POD DOOR — where the player stands
 *  to interact with the pod's own door (the E-open pod-door gaze anchor + the climb-in start). Just
 *  corridor-side of the pod-door face, standing eye height, centred on the airlock z. */
export function getPodBayThreshold(): THREE.Vector3 {
  return new THREE.Vector3(SHIP_ORIGIN.x + COLLAR_FAR_X + 0.55, SHIP_ORIGIN.y + 1.62, SHIP_ORIGIN.z + BAY_ZC);
}
/** World centre of the docked pod's vertical axis — the pivot the rotate-then-eject beat orbits the
 *  seated player around (setBayPodYaw rotates the pod root about this axis). Y = the deck plane. */
export function getBayPodCenter(): THREE.Vector3 {
  return new THREE.Vector3(SHIP_ORIGIN.x + BAY_POD_X, SHIP_ORIGIN.y, SHIP_ORIGIN.z + BAY_ZC);
}
/** The docked pod's SEATED-EYE target inside the cabin (the pod-interior peek centre / E-sit gaze +
 *  the climb-in landing). World coords. */
export function getPodBaySeatedEye(): THREE.Vector3 {
  return new THREE.Vector3(SHIP_ORIGIN.x + BAY_POD_X + 0.15, SHIP_ORIGIN.y + 1.34, SHIP_ORIGIN.z + BAY_ZC);
}
/** World centre of the docked pod's front DOOR (on the +X arc, at door centre-height) — the E-OPEN
 *  gaze/proximity target for the POD door (the collar's far end). */
export function getPodBayDoorWorld(): THREE.Vector3 {
  return new THREE.Vector3(SHIP_ORIGIN.x + BAY_POD_X + BAY_POD_R, SHIP_ORIGIN.y + CPOD_BAY_DOOR_CY, SHIP_ORIGIN.z + BAY_ZC);
}
/** World-space STANDING position just INSIDE the pod bore (where the player ends up after walking in
 *  through the open pod door) — the "am I inside?" + the E-SIT proximity anchor (floor-level body pos). */
export function getPodBayInteriorStand(): THREE.Vector3 {
  return new THREE.Vector3(SHIP_ORIGIN.x + BAY_POD_X + 0.30, SHIP_ORIGIN.y, SHIP_ORIGIN.z + BAY_ZC);
}
/** The pod-door centre height on the canonical bay pod (frozen contract CPOD_DOOR_CY → 1.10). Local. */
const CPOD_BAY_DOOR_CY = 1.10;

// B2 — the docked pod's walkable HULL RING colliders (gapped at the +X door). The pod mesh is a
//   noCollider prop; without these the player would walk straight THROUGH the hull. This channels
//   them through the DOOR opening into the bore (they stand on the recess floor at y=0). Baked
//   world-space static (the docked pod never moves pre-eject; the release-shudder is cosmetic).
const _bayPodBodies: RAPIER.RigidBody[] = [];
function _addBayPodColliders(ctx: GameContext): void {
  const cx = SHIP_ORIGIN.x + BAY_POD_X, cz = SHIP_ORIGIN.z + BAY_ZC;
  const R = BAY_POD_R;
  const wallColR = R - 0.06;                       // stop the player at the visible inner hull, not past it
  const wallH = COR_CH;                            // full walk-height ring (floor→ceiling of the recess)
  // the DOOR gap azimuth: +X arc (CPOD_DOOR_AZ = π/2 in the pod frame; dir = (sin,0,cos) → +X here).
  const doorAz = Math.PI / 2;
  // The gap half-angle sized to the VISIBLE aperture + its proud frame (CPOD_DOOR_W 1.02 + fT 0.11
  //   per side ≈ a 1.25m opening): chord = 2·wallColR·sin(doorHalf) ≈ 1.25m. The KCC capsule is
  //   effectively 0.80m wide (r 0.35 + controller offset 0.05) — the walk-in PROOF (rig pod-walkin)
  //   caught the first cut of this ring leaving only a ~0.85m gap (whole-segment skipping): the
  //   capsule GROUND on the flanking segment corners and never got in. The ring is now built with
  //   EXACT gap edges — the wall arc runs doorAz+doorHalf → doorAz+2π−doorHalf, subdivided — so the
  //   opening is exactly the door aperture: the player walks through the visible doorway with
  //   comfortable slop and still stops AT the visible jamb either side.
  const doorHalf = (1.02 / 2 + 0.14) / wallColR;   // ≈0.47 rad → a ≈1.25m clear chord (matches aperture+frame)
  const az0 = doorAz + doorHalf;                   // wall arc start (one jamb edge)
  const arcLen = Math.PI * 2 - doorHalf * 2;       // the wall arc (everything except the door gap)
  const SEGN = 18;
  const segArc = arcLen / SEGN;
  const _up = new THREE.Vector3(0, 1, 0);
  const _q = new THREE.Quaternion();
  for (let i = 0; i < SEGN; i++) {
    const az = az0 + (i + 0.5) * segArc;
    const dir = new THREE.Vector3(Math.sin(az), 0, Math.cos(az));
    const halfTangent = wallColR * Math.tan(segArc / 2) + 0.02;
    _q.setFromAxisAngle(_up, az);
    const col = makeStaticBox(ctx.physics.world,
      { x: halfTangent, y: wallH / 2, z: 0.08 },
      { x: cx + dir.x * wallColR, y: SHIP_ORIGIN.y + wallH / 2, z: cz + dir.z * wallColR },
      { x: _q.x, y: _q.y, z: _q.z, w: _q.w });
    const body = col.parent();
    if (body) _bayPodBodies.push(body);
  }
}

// B1.a — the docked pod's front DOOR pivot (so the boarding flow / release can reference it later).
let _bayDoorPivot: THREE.Group | null = null;

/** B2 flow surface — drive the docked pod's front door: 0 = closed/flush → 1 = open (~110°).
 *  The boarding flow (sequence.ts) animates this for the player-gated E-open; kept here so the
 *  flow task never edits this file (the cockpit design pass owns it concurrently). Safe no-op
 *  before the bay builds / after dispose. (releasePodFromBay's judder overwrites rotation.y
 *  during the release phase only — by then the door is sealed shut at 0, which is correct.) */
export function setBayPodDoorOpen(t: number): void {
  if (_bayDoorPivot) _bayDoorPivot.rotation.y = -1.9 * Math.max(0, Math.min(1, t));
}

// ── Y3.4 — THE ROTATE-THEN-EJECT beat. After the player sits + seals inside, the docked pod
//    mechanically rotates in its cradle (player inside, felt + heard) so the porthole faces OUT into
//    open space, then the eject prompt fires. `setBayPodYaw(rad)` rotates the DOCKED bay pod ROOT
//    (the buildCanonicalPodExterior instance + its child door pivot) about its OWN vertical axis;
//    0 = docked/door-to-collar (the boarding orientation). It COMPOSES cleanly with the other bay
//    pod animators, which all write DIFFERENT channels: releasePodFromBay writes the root's POSITION
//    (x,y) + the root's ROLL (rotation.z) + the door pivot's rattle (rotation.y) — none touch the
//    root's rotation.y — and setBayPodDoorOpen writes the CHILD door pivot's rotation.y. So the yaw
//    lives on the root's rotation.y and survives the shudder + the door swing (the door pivot is a
//    child, so it yaws WITH the pod, exactly as a real hatch on a rotating capsule would).
//    NO COLLIDER CHANGES: the boarding-time walkable hull-ring colliders (_addBayPodColliders) are
//    baked in WORLD space at yaw 0 (door gap on the +X arc) and are correct only at yaw 0. That is
//    fine by design — the player is SEALED INSIDE (seated, controls locked) before this rotates, so
//    they can never walk against the now-mismatched ring during the rotate/eject; boarding + the
//    walk-in only ever happen at yaw 0. Safe no-op before the bay builds / after dispose.
let _bayPodYaw = 0;
export function setBayPodYaw(rad: number): void {
  _bayPodYaw = rad;
  if (_bayGroup) _bayGroup.rotation.y = rad;
}
/** Current docked bay-pod yaw (radians about its own vertical axis; 0 = docked/door-to-collar). */
export function getBayPodYaw(): number { return _bayPodYaw; }

// ── W2b — THE OPERATIONAL SLIDING DOOR. Two leaves ride apart into wall pockets fore/aft. A single
//    static SEAL collider (rebuilt on state) blocks the aperture while the door is even slightly
//    shut, and is removed once it's essentially open — so a closed door blocks the KCC and an open
//    one passes. Ctx captured at build (the collider needs the physics world). Collider matches the
//    VISIBLE leaves: when closed the two leaf faces meet at the aperture centre → one seal box across
//    the opening; the moment the leaves part enough to walk through, the seal is dropped.
let _airlockSealBody: RAPIER.RigidBody | null = null;
let _airlockCtx: GameContext | null = null;
const AIRLOCK_LEAF_TRAVEL = AIRLOCK_HW + 0.10;   // how far each leaf slides (fully clears the aperture)
function _syncAirlockDoorCollider(): void {
  const ctx = _airlockCtx;
  if (!ctx) return;
  // OPEN enough to pass? (leaves parted past the KCC half-width ~0.45m of clear each side). Drop the seal.
  const open = _airlockDoorT > 0.62;
  if (open) {
    if (_airlockSealBody) { ctx.physics.world.removeRigidBody(_airlockSealBody); _airlockSealBody = null; }
    return;
  }
  if (!_airlockSealBody) {
    // one seal box filling the aperture (z BAY_ZC ± AIRLOCK_HW, y 0..AIRLOCK_TOP) at the wall plane.
    const col = makeStaticBox(ctx.physics.world,
      { x: 0.12, y: AIRLOCK_TOP / 2, z: AIRLOCK_HW },
      { x: SHIP_ORIGIN.x + AIRLOCK_WALL_X, y: SHIP_ORIGIN.y + AIRLOCK_TOP / 2, z: SHIP_ORIGIN.z + BAY_ZC });
    const body = col.parent();
    if (body) _airlockSealBody = body;
  }
}
/** W2b flow surface — drive the OPERATIONAL SLIDING DOOR in the corridor wall: 0 = closed → 1 = open
 *  (the two leaves slide apart into wall pockets). The boarding flow (sequence.ts, wired by the
 *  orchestrator) animates this for the player-gated sliding-door open. Moves the leaves AND updates
 *  the state-driven seal collider (closed blocks the KCC, open passes). Safe no-op before build/after
 *  dispose. */
export function setBayAirlockDoor(t: number): void {
  _airlockDoorT = Math.max(0, Math.min(1, t));
  const d = _airlockDoorT * AIRLOCK_LEAF_TRAVEL;
  if (_airlockDoorL) _airlockDoorL.position.z = (BAY_ZC - AIRLOCK_HW / 2) - d;   // fore leaf slides −Z
  if (_airlockDoorR) _airlockDoorR.position.z = (BAY_ZC + AIRLOCK_HW / 2) + d;   // aft leaf slides +Z
  _syncAirlockDoorCollider();
}
/** W2b — current sliding-door open param (0..1). */
export function bayAirlockDoorOpen(): number { return _airlockDoorT; }

/** Build the escape-pod BAY airlock + the DOCKED CANONICAL pod at the bridge end (into the −X
 *  recess). B1.b: a CLEAN framed doorway/airlock collar the player steps through — no clamp
 *  clutter, no floating yellow-bolt cylinders, no overlapping archway. B1.a: the ONE canonical
 *  pod (buildCanonicalPodExterior) sits behind it, its merged glass FRONT DOOR closed, facing
 *  the arriving player (+X). */
function buildPodBay(group: THREE.Group): void {
  const bay = new THREE.Group();
  bay.name = 'escapePodBay';
  group.add(bay);
  const wallX = AIRLOCK_WALL_X;               // the −X corridor wall plane (x = −1.0) — the sliding-door plane
  const collarFar = COLLAR_FAR_X;             // −1.92 — the collar's outboard end (the pod-door face)
  const zc = BAY_ZC, aHW = AIRLOCK_HW;
  const up = new THREE.Vector3(0, 1, 0);
  _airlockDoorL = _airlockDoorR = null;
  _airlockDoorT = 0;

  // ═══ 1. THE AIRLOCK FRAME — a fabricated blast-door portal cut in the −X corridor wall. Channel-
  //    steel jambs + a header + a threshold sill on the CORRIDOR face (so the door reads as THE exit),
  //    a rubber gasket ring, slim hazard accents. Framed cleanly to the wall (buildCorridor skipped
  //    the −X wall over BAY_Z0..BAY_Z1 for this). The proud frame stands 0.14m into the corridor.
  const frameProud = wallX + 0.14;            // frame face stands into the corridor off the wall line
  const jambHW = aHW;                         // the aperture half-width (matches AIRLOCK_HW)
  const top = AIRLOCK_TOP;
  //  side JAMBS — worn channel-steel posts framing the sliding-door opening (corridor-facing). Z4
  //   item-2 FIX (airlock-jamb-aft z-fight, 0.44%): the post was 0.22 DEEP centred at frameProud →
  //   its back face reached x −0.97, poking back into the plane where the OPEN sliding leaf slides
  //   (leaf front −0.95, into the flanking-wall pocket) → the leaf edge clipped/ z-fought the jamb
  //   post when the door was open (the user's "doorway edge clipping"). Slimmed to 0.14 deep with the
  //   SAME proud +X front face (−0.75): the post back (−0.89) now clears the open-leaf front (−0.95),
  //   so nothing interpenetrates the leaf's slide path. The corridor read of the frame is unchanged.
  for (const sz of [-1, 1]) {
    const post = _box(0.14, top + 0.14, 0.22, _steel);
    post.position.set(frameProud + 0.04, (top + 0.14) / 2, zc + sz * (jambHW + 0.11));
    bay.add(post);
    for (let y = 0.4; y < top; y += 0.42) bay.add(_stud(frameProud + 0.12, y, zc + sz * (jambHW + 0.11), new THREE.Vector3(1, 0, 0), _rivet, 0.016));
    // a SLIM hazard accent down the leading edge (yellow = accent, not the wall). Z4 item-2 FIX
    //   (airlock-jamb-aft z-fight): the strip centre sat AT frameProud+0.11 = the post's FRONT-face
    //   plane, so its back half was buried in the post + its mid-plane was coplanar with the steel post
    //   face → the yellow strips fringed with winner-flip (the flip-mask lit them up). Stand the strip
    //   fully PROUD of the post face (back face ahead of frameProud+0.11) — no shared plane.
    const haz = _box(0.03, top - 0.4, 0.08, _bayHazardAccent);
    haz.position.set(frameProud + 0.135, top / 2, zc + sz * (jambHW + 0.11));
    bay.add(haz);
  }
  //  HEADER lintel across the top + a slim hazard band + a stencilled placard. Z4 item-2 FIX: the
  //   lintel was 0.22 DEEP centred at frameProud → its back face reached x −0.97, interpenetrating the
  //   sliding-door HEADER RAIL (front −0.92, y-overlapping) → a lit coplanar seam that hard-flipped
  //   under the aft-jamb graze. Slimmed to 0.14 deep with the SAME proud front face (−0.75), so its back
  //   (−0.89) now clears the rail front (−0.92) — the lintel reads identical, no shared plane with the rail.
  const lintel = _box(0.14, 0.24, jambHW * 2 + 0.66, _steel);
  lintel.position.set(frameProud + 0.04, top + 0.12, zc);
  bay.add(lintel);
  const lintelHaz = _box(0.03, 0.08, jambHW * 2 + 0.3, _bayHazardAccent);
  //  Z4 — proud of the lintel front (was coplanar at +0.11) AND dropped to the header's LOWER lip so it
  //   clears the placard band above it (the moved-proud band had begun interpenetrating the placard).
  lintelHaz.position.set(frameProud + 0.135, top - 0.03, zc);
  bay.add(lintelHaz);
  for (let z = zc - jambHW; z <= zc + jambHW; z += 0.40) bay.add(_stud(frameProud + 0.07, top + 0.02, z, up, _rivet, 0.014));
  const placBack = _box(0.02, 0.18, 1.0, _decal);
  placBack.position.set(frameProud + 0.14, top + 0.13, zc);   // Z4 — proud of the lintel front (+0.11)
  bay.add(placBack);
  const placFace = _box(0.01, 0.11, 0.82, _corrPlacard);
  placFace.position.set(frameProud + 0.165, top + 0.13, zc);  // Z4 — proud of the placard backing (no coplanar layer)
  bay.add(placFace);
  //  THRESHOLD sill plate on the deck at the door + a slim hazard tread
  const sill = _box(0.34, 0.05, jambHW * 2, _steel);
  sill.position.set(frameProud - 0.02, 0.03, zc);
  bay.add(sill);
  const sillHaz = _box(0.34, 0.02, 0.06, _bayHazardAccent);
  sillHaz.position.set(frameProud - 0.02, 0.055, zc);
  bay.add(sillHaz);

  // ═══ 1b. X4 item-5 — AIRLOCK DETAIL PASS (the collar "should read functional"). Restrained,
  //    purposeful, in the gunmetal family: a wall CONTROL PANEL beside the door with a small readout
  //    + status LEDs, SEAL INDICATOR lamps up the jambs, and CAUTION striping on the sill approach.
  //    All corridor-facing (proud of the wall) so the arriving player reads it as an operable airlock.
  //  (a) a CONTROL PANEL on the corridor wall, aft side of the door (a recessed console with a readout
  //      + a green/amber status stack + a couple of buttons) — the "operate the airlock" station.
  //  Z4 item-2 FIX (airlock-jamb-aft z-fight, hardPct 0.183%): the readout/LEDs/buttons were placed at
  //  frameProud−0.04..−0.055 — i.e. BEHIND the panel box (deeper into the −X wall), so the screen's
  //  FRONT face (x≈−0.89) was coplanar with the panel's BACK face (x≈−0.89) → the winner-flip flicker,
  //  and the detail was buried out of sight anyway. The panel's CORRIDOR-facing side is +X (the arriving
  //  player faces −X at the door). All detail now sits PROUD of the panel's +X front face (−0.79), a
  //  real recessed-readout console with no shared plane.
  const panZ = zc + jambHW + 0.42;
  const panel = _box(0.10, 0.62, 0.42, _steel);
  panel.position.set(frameProud + 0.02, 1.42, panZ);
  bay.add(panel);
  const panFront = frameProud + 0.07;                       // the panel's +X (corridor-facing) front face
  // the readout is a bezel + a dark face STANDING PROUD of the panel (a raised console screen), so no
  //   face is coplanar with the panel's front plane (a flush/recessed screen z-fought it — Z4 item-2).
  const panScreen = _box(0.03, 0.22, 0.30, _screenGlass);   // a dark readout face raised off the panel
  panScreen.position.set(panFront + 0.02, 1.58, panZ);      // back face at +0.005 proud of the panel face
  bay.add(panScreen);
  for (let i = 0; i < 3; i++) {   // green readout bars (unlit glow) — proud of the screen
    const bar = _box(0.01, 0.02, 0.16 - i * 0.03, _ledGreen);
    bar.position.set(panFront + 0.05, 1.64 - i * 0.05, panZ - 0.04);
    bay.add(bar);
  }
  for (const [by, mat] of [[1.30, _ledGreen], [1.24, _ledAmber], [1.18, _ledAmber]] as const) {   // a status LED stack
    const led = _cyl(0.018, 0.018, 0.02, 8, mat);
    led.rotation.z = Math.PI / 2;
    led.position.set(panFront + 0.02, by, panZ + 0.12);
    bay.add(led);
  }
  for (const bz of [-0.08, 0.0, 0.08]) {   // a row of push-buttons — proud of the panel face
    const btn = _cyl(0.02, 0.02, 0.02, 8, _corrRail);
    btn.rotation.z = Math.PI / 2;
    btn.position.set(panFront + 0.02, 1.24, panZ + bz - 0.14);
    bay.add(btn);
  }
  //  (b) SEAL-INDICATOR lamps — a REGULAR ALIGNED COLUMN up each jamb (the airlock status telltales).
  //      FIX PASS (SEV2: "the seal lamps read as splotches — irregular sizes/heights, unlit"). ROOT
  //      CAUSE: the old lamps were _cyl discs oriented rotation.x=π/2 (axis along Z), so a corridor eye
  //      saw them EDGE-ON as thin slivers whose apparent size/shape swung wildly with the view angle =
  //      the "splotch" read. FIX: a tidy vertical column of IDENTICAL small emissive units per jamb —
  //      each = a dark recessed housing + a flush green lens box FACING THE CORRIDOR (+X), on a fixed
  //      even pitch (a real status stack), + a matched RED pair at the base ("unsealed" telltales). All
  //      the same size + aligned to the jamb centreline so they read as an instrument column, not nubs.
  const _sealYs = [0.55, 0.90, 1.25, 1.60, 1.95];        // even pitch up the jamb (identical units)
  for (const sz of [-1, 1]) {
    const jz = zc + sz * (jambHW + 0.11);                // the jamb centreline (matches the post)
    // Z4 item-2 FIX (airlock-jamb-aft z-fight, hardPct 0.183%→): the seal-lamp housings sat at the SAME
    //   x-centre (frameProud+0.11) AND z (jz) as the leading-edge HAZARD STRIP (haz, 0.08 wide in z on
    //   the jamb centreline) — their side/front faces were coplanar + interpenetrating with the strip
    //   (the flicker the user saw). Separate them with REAL geometry: shift the whole column INBOARD
    //   (toward the aperture) so it clears the strip's ±0.04 z-span, and stand it clearly PROUD of the
    //   strip face in x (no shared plane). Now the column reads on the clean door-facing jamb face.
    const colZ = jz - sz * 0.10;                         // inboard of the strip (strip z-half = 0.04; 0.10 clears it)
    for (let i = 0; i < _sealYs.length; i++) {
      // a small dark housing standing PROUD of the jamb face (front at x≈−0.71, ahead of the strip −0.735)
      const housing = _box(0.04, 0.05, 0.05, _channel);
      housing.position.set(frameProud + 0.15, _sealYs[i], colZ);
      bay.add(housing);
      // the emissive lens facing the corridor (+X). Green = sealed for the column; the single base
      //   unit is amber ("cycle/unsealed" telltale) so the stack reads as a real status column.
      //   Kept small + identical so the column reads as an instrument stack, not chunky green squares.
      const lens = _box(0.02, 0.026, 0.026, i === 0 ? _ledAmber : _ledGreen);
      lens.position.set(frameProud + 0.175, _sealYs[i], colZ);
      bay.add(lens);
    }
  }
  //  (c) CAUTION striping — angled hazard chevrons on the deck at the door approach (a painted warning
  //      threshold you step over), corridor-side of the sill.
  for (let i = 0; i < 5; i++) {
    const chev = _box(0.26, 0.006, 0.05, _bayHazardAccent);
    chev.position.set(frameProud + 0.14, 0.056, zc - 0.36 + i * 0.18);
    chev.rotation.y = 0.5;
    bay.add(chev);
  }
  //  (d) a small OVERHEAD status beacon housing above the door (a warning strobe fixture — dark now,
  //      reads as the airlock's own alert lamp) + a placard-lit "AIRLOCK" is already on the header.
  const beaconHousing = _box(0.14, 0.10, 0.18, _channel);
  beaconHousing.position.set(frameProud + 0.06, top + 0.02, zc - jambHW - 0.3);
  bay.add(beaconHousing);
  const beaconLens = _cyl(0.05, 0.06, 0.06, 10, _ledAmber);
  beaconLens.position.set(frameProud + 0.06, top - 0.02, zc - jambHW - 0.3);
  bay.add(beaconLens);

  // ═══ 2. THE OPERATIONAL SLIDING DOOR — two heavy opaque blast-door leaves in the wall plane, riding
  //    a header rail + a floor track, meeting at the aperture centre when CLOSED. setBayAirlockDoor
  //    slides them apart into wall pockets. (The engine-room sliding-door idiom — but OPAQUE steel +
  //    it actually OPENS.) The leaves are protected from the static merge (they move).
  const railZ = jambHW + 0.20;
  const headerRail = _box(0.16, 0.14, railZ * 2, _steel);   // header rail (leaves hang from it)
  headerRail.position.set(wallX, top + 0.05, zc);
  bay.add(headerRail);
  const floorTrack = _box(0.16, 0.06, railZ * 2, _channel); // floor track
  floorTrack.position.set(wallX, 0.03, zc);
  bay.add(floorTrack);
  for (const [sz, ref] of [[-1, 'L'], [1, 'R']] as const) {
    const leaf = new THREE.Group();
    leaf.name = 'airlockDoorLeaf' + ref;   // findable by the rig framer
    // each leaf covers half the aperture when closed (meeting at centre); fore leaf −Z, aft leaf +Z.
    leaf.position.set(wallX, 0, zc + sz * (aHW / 2));
    bay.add(leaf);
    if (ref === 'L') _airlockDoorL = leaf; else _airlockDoorR = leaf;
    // the door slab (opaque blast plate)
    const slab = _box(0.10, top - 0.06, aHW - 0.02, _bayDoorLeaf);
    slab.position.set(0, top / 2, 0);
    leaf.add(slab);
    // a recessed panel + two flush horizontal ribs framing it (a worked blast-door read).
    //  FIX PASS (SEV2: "the LEFT leaf's diagonal bar reads unmounted + would clip on slide"). The old
    //  `strut` was a chunky bar tilted by sz·0.5 → a diagonal slash across the leaf with an unmounted
    //  lower end, MIRRORED opposite on each leaf so the two didn't match. Replaced with a symmetric,
    //  SLIDE-SAFE pair of flush horizontal stiffener ribs (no tilt, fully inside the leaf face,
    //  identical on both leaves) — the leaf reads clean + fabricated + slides without clipping.
    // Z4 item-2 FIX (airlock-jamb-aft z-fight, 0.44%, byte-stable across every frame edit → it was the
    //   noMerge LEAF): the recessed-panel `inset` centred at leaf-local x 0.06 (half 0.015 → 0.045..0.075)
    //   STRADDLED the slab's front face (leaf-local +0.05) → its back half was coplanar with the slab
    //   front (channel vs door-leaf material = a high-contrast winner-flip). Stand it fully PROUD (back
    //   face ahead of the slab front) so it reads as a raised blast-door panel with no shared plane.
    const inset = _box(0.03, top - 0.44, aHW - 0.20, _channel);
    inset.position.set(0.075, top / 2, 0);
    leaf.add(inset);
    for (const ry of [top * 0.62, top * 0.38]) {
      const rib = _box(0.045, 0.075, aHW - 0.20, _steel);
      rib.position.set(0.10, ry, 0);   // proud of the inset panel (was 0.078 — near-coplanar with it)
      leaf.add(rib);
    }
    // a vertical grab handle on the meeting stile + rivet studs down the outer edge
    const handle = _box(0.06, 0.44, 0.06, _corrRail);
    handle.position.set(0.09, top * 0.5, -sz * (aHW / 2 - 0.08));
    leaf.add(handle);
    for (let y = 0.4; y < top - 0.2; y += 0.4) leaf.add(_stud(0.055, y, sz * (aHW / 2 - 0.06), new THREE.Vector3(1, 0, 0), _rivet, 0.014));
    // a slim hazard chevron band down the leading (meeting) edge
    const lhaz = _box(0.02, top - 0.5, 0.05, _bayHazardAccent);
    lhaz.position.set(0.055, top / 2, -sz * (aHW / 2 - 0.03));
    leaf.add(lhaz);
  }

  // ═══ 3. THE AIRLOCK COLLAR — a short gasketed docking passage from the wall plane (−1.0) OUTBOARD
  //    to the pod-door face (−1.92). GATE FIX (W2c, hall-of-mirrors SEV1, 2-critic): the old collar
  //    was a RECTANGULAR tube + 3 square concentric gasket rings, so the corridor → blast-door →
  //    collar → pod chain read as 4-5 near-identical rectangular frames telescoping to the porthole —
  //    the "short docking collar" was indistinguishable from more ship framing. Redesign: the collar
  //    is now visually a ROUND RIBBED FLEXIBLE BELLOWS (concentric dark-rubber convolution rings along
  //    the −X axis) seated in a recessed dark housing — a completely different SHAPE + MATERIAL from
  //    the ONE yellow-accented rectangular blast-door frame. The eye now reads: ship doorway (the
  //    rectangular yellow blast frame) → docking bellows (a round rubber tube) → the pod (the round
  //    porthole). The walk envelope is UNCHANGED (the bellows inner bore clears the 1.44m aperture);
  //    the collar structural floor/ceiling/side walls stay (the AIRLOCK_COLLIDERS still match them).
  const collarXC = (wallX + collarFar) / 2, collarLen = wallX - collarFar;
  // the collar HOUSING — a recessed DARK tube (channel steel), read as the socket the bellows sits in
  //   (not bright framing). Floor + ceiling + side walls, kept for structure + the collider match.
  const cFloor = _box(collarLen + 0.1, COR_WALL_T, aHW * 2 + 0.2, _channel);
  cFloor.position.set(collarXC, -COR_WALL_T / 2, zc);
  bay.add(cFloor);
  const cCeil = _box(collarLen + 0.1, COR_WALL_T, aHW * 2 + 0.2, _channel);
  cCeil.position.set(collarXC, top + COR_WALL_T / 2 + 0.1, zc);
  bay.add(cCeil);
  for (const sz of [-1, 1]) {
    const wall = _box(collarLen + 0.1, top + 0.2, COR_WALL_T, _channel);
    wall.position.set(collarXC, (top + 0.2) / 2, zc + sz * (aHW + COR_WALL_T / 2));
    bay.add(wall);
  }
  // ── THE ROUND RIBBED BELLOWS — concentric dark-rubber convolution rings threaded along the −X axis
  //    from just inboard of the blast door to the pod-door seal. Each ring is an open cylinder band
  //    (axis along X) whose radius ALTERNATES (a fat convolution, then a tucked valley) so the eye
  //    reads a flexible accordion docking sleeve, NOT stacked rectangular frames. Radius clears the
  //    aperture (bore ≥ aHW so the 1.44m walk-through is unobstructed). The bellows CY centres it on
  //    the aperture (aperture spans y 0..AIRLOCK_TOP → centre AIRLOCK_TOP/2).
  const belCY = top * 0.52;                           // vertical centre of the bore (a hair high → clears
                                                      //   the deck + frames the pod-door porthole)
  const belBoreR = aHW + 0.12;                        // inner bore radius — comfortably clears the walk-through
  const belRings = 7;
  for (let bi = 0; bi < belRings; bi++) {
    const bt = bi / (belRings - 1);                   // 0 at the ship end → 1 at the pod end
    const bx = (wallX - 0.06) - bt * (collarLen - 0.10);   // step from just inboard of the door → the pod seal
    const convo = bi % 2 === 0;                        // alternate: a proud convolution vs a tucked valley
    const ringR = belBoreR + (convo ? 0.14 : 0.04);   // the accordion profile (fat ring / thin valley)
    const ringThick = convo ? 0.11 : 0.06;
    const ring = _ring(ringR, ringThick, 24, _baySeal);   // OPEN round band (dark rubber) — see through it
    ring.rotation.z = Math.PI / 2;                    // cylinder axis Y → align to the collar's X axis
    ring.position.set(bx, belCY, zc);
    bay.add(ring);
  }
  // a pair of STEEL retaining bands clamping the bellows at each end (a fabricated tell — the sleeve is
  //   bolted to the ship ring + the pod ring, not floating). Open round bands in bare steel.
  for (const [bx, r] of [[wallX - 0.05, belBoreR + 0.18], [collarFar + 0.10, belBoreR + 0.18]] as const) {
    const band = _ring(r, 0.07, 24, _steel);
    band.rotation.z = Math.PI / 2;
    band.position.set(bx, belCY, zc);
    bay.add(band);
    // a few bolt studs marching around the retaining band (worked hardware) — only the ones that
    //   land in the visible housing (not below the deck / above the ceiling).
    for (let a = 0; a < 10; a++) {
      const ang = (a / 10) * Math.PI * 2;
      const sy = belCY + Math.cos(ang) * r, sz2 = zc + Math.sin(ang) * r;
      if (sy < 0.16 || sy > top - 0.04) continue;
      const dir = new THREE.Vector3(0, Math.cos(ang), Math.sin(ang));
      bay.add(_stud(bx + 0.02, sy, sz2, dir, _rivet, 0.02));
    }
  }
  // the round rubber SEAL GASKET where the bellows mates the pod hull (a soft dark compression ring
  //   pressed against the pod door face) — a fatter dark band at the pod end. Z4 FIX: the gasket is a
  //   band whose AXIS is along X (rot.z=π/2), so its pod-FACING face sits at (centerX − halfDepth). The
  //   old center collarFar+0.04 with depth 0.14 put that face at worldX −1.95 — 0.03 m PAST the pod hull
  //   face (collarFar −1.92) → a 2.6 cm graze of the barrel that the rotating pod swept through (the
  //   Z4 sweep's last violator). Thinner (0.10) + pulled outboard (collarFar+0.10) so the pod-facing
  //   face lands at worldX −1.87, a ~5 cm clean mate GAP off the −1.92 hull — the barrel clears it at
  //   every yaw (a docked pod isn't fused to its collar; a small compression standoff reads correct).
  const seal = _ring(belBoreR + 0.06, 0.10, 26, _baySeal);
  seal.rotation.z = Math.PI / 2;
  seal.position.set(collarFar + 0.10, belCY, zc);
  bay.add(seal);

  // ═══ 4. THE DOCKED CANONICAL POD — the ONE pod (buildCanonicalPodExterior), its merged glass FRONT
  //    DOOR CLOSED + facing +X (the collar), mostly OUTSIDE the hull. Its +X door-arc mates the collar
  //    far end; the rest of the barrel hangs in the void off the ship (it reads DOCKED, not parked).
  const podLocalX = BAY_POD_X, podZ = zc;
  const { root: pod, doorPivot } = buildCanonicalPodExterior({ door: 'closed', r: BAY_POD_R });
  pod.name = 'dockedCanonicalPod';
  _bayGroup = pod;
  _bayDoorPivot = doorPivot;
  pod.position.set(podLocalX, 0, podZ);
  bay.add(pod);
  // tag every mesh in the docked pod so it never spawns a collider (it's the scripted-entry prop).
  pod.traverse((o) => { (o as THREE.Mesh).userData.noCollider = true; });

  // ── EXTERIOR MATING SHROUD (W2c, gate SEV1+2: "the pod doesn't read as MATED from outside — the
  //    hull just ENDS at a straight edge and the pod floats adjacent"). Add the visible ship→pod
  //    docking interface on the void side: (a) a HULL-SIDE COLLAR RING that flares off the −X wall
  //    aperture and CUPS onto the pod's +X arc (a truncated-cone skirt hugging the pod curvature), so
  //    the ship visibly reaches out and grips the pod; (b) a dark rubber COMPRESSION SEAL pressed onto
  //    the pod hull at the mate line; (c) CLAMP ARMS that terminate on REAL ship-side anchor pads
  //    (not mid-air). Void-side, non-walkable → NO colliders (rule 7 depths on the boxy bits).
  //  (a) the hull-side collar SKIRT — cone bands stepping from the wall-plane aperture (x=−1.0, r≈aHW)
  //      out to the pod arc (x=−1.92, r≈aHW), reading as a fabricated docking ring wrapping the pod.
  const mateCY = top * 0.52;
  const skirtBands = 4;
  for (let mi = 0; mi < skirtBands; mi++) {
    const mt = mi / (skirtBands - 1);
    const mx = wallX - 0.02 - mt * (collarLen - 0.06);      // wall plane → pod-door face
    const rr = (aHW + 0.26) + mt * 0.16;                    // flares slightly as it reaches toward the pod
    const band = _ring(rr, 0.07, 22, _steel);               // open band (a fabricated docking-ring flange)
    band.rotation.z = Math.PI / 2;
    band.position.set(mx, mateCY, zc);
    bay.add(band);
  }
  //  (b) a dark COMPRESSION SEAL + a steel CLAMP BAND wrapping the pod's barrel at the door band — open
  //      rings coaxial with the vertical pod cylinder, so the ship visibly grips the pod hull curvature
  //      (a docking flange banding the barrel, not a floating disc). Reads "clamped/docked" from outside.
  const podArcX = podLocalX + BAY_POD_R;                    // −1.92, the pod's +X-most (door) face
  // COCKPIT-ROUND-2 item 9: the mating seal + clamp band previously wrapped the FULL 360° barrel at the
  //   door height → they crossed the +X DOOR APERTURE, barring the doorway (the user's screenshot). GAP
  //   them over the door arc (centred on +X = CylinderGeometry theta π/2), the same complementary-arc
  //   scheme the pod's own bands use, so the doorway is CLEAR floor-to-lintel. Gap half-angle 0.62 rad
  //   (door subtends ~0.72 rad at r=1.44 + margin) → the ≈1.02m door + its frame are fully unbanded.
  const DOOR_THETA = Math.PI / 2;      // +X arc (the pod door faces the collar)
  const DOOR_GAP_HALF = 0.62;          // clears the CPOD_DOOR_W 1.02 aperture + frame at BAY_POD_R
  const mateSeal = _arcBand(BAY_POD_R + 0.04, 0.16, 34, _baySeal, DOOR_THETA, DOOR_GAP_HALF);   // dark rubber gasket, GAPPED at the door
  mateSeal.position.set(podLocalX, CPOD_BAY_DOOR_CY, podZ);       // axis Y (default) = the pod's own axis
  bay.add(mateSeal);
  const mateBand = _arcBand(BAY_POD_R + 0.10, 0.10, 34, _steel, DOOR_THETA, DOOR_GAP_HALF);     // steel clamp band, GAPPED at the door
  mateBand.position.set(podLocalX, CPOD_BAY_DOOR_CY + 0.44, podZ);
  bay.add(mateBand);
  // bolt studs marching around the clamp band — but ONLY where the band EXISTS (item 9: skip the door
  //   gap, which we just cut over the +X arc; else the studs would float in the empty doorway). The door
  //   arc is centred on +X (azimuth π/2, dx=sin=1); omit studs within the same gap half-angle.
  for (let a = 0; a < 24; a++) {
    const ang = (a / 24) * Math.PI * 2;
    const dx = Math.sin(ang), dz = Math.cos(ang);
    // angular distance from the +X door centre (azimuth π/2); skip the gap so no stud lands in the doorway.
    let d = Math.abs(ang - Math.PI / 2); if (d > Math.PI) d = Math.PI * 2 - d;
    if (d < DOOR_GAP_HALF + 0.06) continue;                  // in the door gap → no band here, no stud
    const bx2 = podLocalX + dx * (BAY_POD_R + 0.10), bz2 = podZ + dz * (BAY_POD_R + 0.10);
    bay.add(_stud(bx2, CPOD_BAY_DOOR_CY + 0.44, bz2, new THREE.Vector3(dx, 0, dz), _rivet, 0.02));
  }
  //  (c) two clamp arms reaching from a REAL ship-side ANCHOR PAD (bolted to the wall-plane aperture
  //      rim) out to a gripper pad cupping the pod's door-collar shoulder — both ends on real hardware.
  for (const sz of [-1, 1]) {
    const armZ = zc + sz * (aHW + 0.10);
    // ship-side anchor pad — bolted to the −X wall aperture jamb (a real termination, not mid-air)
    const anchor = _box(0.16, 0.34, 0.18, _steel);
    anchor.position.set(wallX - 0.09, 1.10, armZ);
    bay.add(anchor);
    for (const ay of [0.94, 1.26]) bay.add(_stud(wallX - 0.01, ay, armZ, new THREE.Vector3(1, 0, 0), _rivet, 0.02));
    // the arm — a hydraulic strut spanning the anchor → the pod gripper
    const armLen = (wallX - 0.09) - (podArcX - 0.06);
    const arm = _cyl(0.06, 0.06, armLen, 8, _bayCoupling);
    arm.rotation.z = Math.PI / 2;
    arm.position.set((wallX - 0.09 + podArcX - 0.06) / 2, 1.10, armZ);
    bay.add(arm);
    // the gripper PAD cupping the pod shoulder — cupped onto the pod's +X arc (real termination)
    const pad = _box(0.14, 0.32, 0.16, _bayCoupling);
    pad.position.set(podArcX - 0.05, 1.10, armZ);
    bay.add(pad);
  }
  //  two tidy umbilicals routed along the COLLAR's −Z exterior flank (Z4 FIX). PREVIOUSLY the coupling
  //  plate + hose ends terminated on the pod SHOULDER at pod-local (0.43, −0.89) — radial ~0.99 m from
  //  the pod axis, i.e. ~0.45 m INSIDE the 1.44 m hull. At yaw 0 that hid behind the open door; the
  //  moment the pod rotates in its cradle the solid barrel sweeps over that spot and the plate + hoses
  //  punched straight through the interior shell (the user's screenshot; probe-rotate-{73,90}). A pod
  //  that turns freely can't have fixed hardware plugged INTO its skin, so the umbilicals now live wholly
  //  on the COLLAR — a coupling plate bolted to the collar's −Z side wall and hoses draping between two
  //  collar sockets, terminating in a capped stub SHORT of the pod (a ~8 cm mate gap). Every vertex stays
  //  at radial distance > POD_R from the pod axis (verified by pod-rotation-clearance), so the barrel
  //  clears them at all sweep angles. The −Z-flank read is unchanged from the corridor eye.
  const umbY = 1.72;
  const umbWallZ = zc - aHW - COR_WALL_T / 2;               // ON the collar's −Z side-wall inner face
  // coupling plate bolted flat to the collar −Z wall, near the pod-door (outboard) end of the collar
  const umbPlate = _box(0.10, 0.36, 0.30, _channel);
  umbPlate.position.set(collarFar + 0.34, umbY, umbWallZ + 0.06);
  bay.add(umbPlate);
  for (const [hy, sag] of [[umbY + 0.06, 0.12], [umbY - 0.14, 0.16]] as const) {
    // both ends on the collar −Z flank: an inboard socket at the wall plane → a capped stub just SHORT
    //   of the pod-door face (the mate point), draping along the collar (never entering the pod cylinder).
    const x0 = wallX - 0.10, x1 = collarFar + 0.14;          // inboard (ship end) → outboard (pod-door end)
    const z0 = umbWallZ + 0.05, z1 = umbWallZ + 0.05;        // hug the −Z wall the whole run
    const socket = _cyl(0.05, 0.05, 0.16, 10, _bayCoupling);
    socket.rotation.z = Math.PI / 2; socket.position.set(x0, hy, z0);
    bay.add(socket);
    // the capped mate stub at the outboard end (reads as the connector that would plug the pod, held clear)
    const stub = _cyl(0.045, 0.05, 0.12, 10, _bayCoupling);
    stub.rotation.z = Math.PI / 2; stub.position.set(x1, hy, z1);
    bay.add(stub);
    // a single sagging hose spanning the two collar-flank points (sagging in y; runs along −X)
    const midX = (x0 + x1) / 2, midZ = (z0 + z1) / 2;
    const len = Math.hypot(x1 - x0, z1 - z0);
    const hose = _cyl(0.04, 0.04, len, 8, _bayHose);
    hose.position.set(midX, hy - sag, midZ);
    hose.rotation.y = Math.atan2(x1 - x0, z1 - z0);
    hose.rotation.x = Math.PI / 2;
    bay.add(hose);
  }

  // ═══ 5. AIRLOCK LIGHTING — the collar is a lit docking passage, not a black tube. A warm glow at the
  //    pod-door end (the "board here" beacon, spilling back into the corridor through the open door) +
  //    a brighter cool can-light on the collar ceiling washing the whole passage so it reads modelled.
  // W2 gate fix — was 0xffcf9a @ 1.7: at point-blank the warm wash lifted the gunmetal door face
  //   back into the pale-warm family the user flagged. Cooler + dimmer keeps the beacon read.
  const glow = new THREE.PointLight(0xffe6c4, 1.25, 3.4, 2.0);
  glow.position.set(collarFar + 0.30, 1.35, podZ);   // at the pod door, off it, toward the corridor
  bay.add(glow);
  _bayGlowLight = glow;
  // a cool can-light filling the collar tube (so the passage isn't dark when the door opens)
  const can = new THREE.PointLight(0xc6d6e4, 1.15, 3.4, 1.7);
  can.position.set(collarXC, top - 0.08, zc);
  bay.add(can);
  const housing = _box(0.4, 0.1, 0.28, _channel);
  housing.position.set(collarXC, top + 0.02, zc);
  bay.add(housing);
  const lens = _box(0.3, 0.04, 0.2, _corrLens);
  lens.position.set(collarXC, top - 0.03, zc);
  bay.add(lens);
}

// ── X4 item-1 — CREW QUARTERS materials (lived-in basics, in the ship's gunmetal family). Bunk
//    mattress + a folded blanket, a locker, a desk, plus the cockpit's personal-touch idiom (mug,
//    framed photo). Warm fabric tones read the "human" note against the grey hull.
const _qtrMattress = new THREE.MeshLambertMaterial({ color: 0x8f8a7c, flatShading: true });   // pale worn ticking
const _qtrBlanket = new THREE.MeshLambertMaterial({ color: 0x7a4a34, flatShading: true });    // a rust-red wool blanket
const _qtrPillow = new THREE.MeshLambertMaterial({ color: 0xbdb6a4, flatShading: true });     // a grubby pillow
const _qtrLocker = _metal(0x54595f, 0.44, 0.62, { flat: true, grime: true });                 // a steel locker (ship family)
const _qtrDesk = _metal(0x4a4f55, 0.40, 0.66, { flat: true, grime: true });                   // a folding desk/shelf
// Z2 OVERHAUL — the alcove liner (a warmer, darker recessed steel so the bunk niche reads as a
//   built-in pocket, not the same flat wall panel). Two-value with the shell.
const _qtrAlcove = _metal(0x4c4a42, 0.40, 0.70, { flat: true, grime: true });
// Z2 OVERHAUL — the bunk reading-light lens (an unlit warm strip glowing in the alcove head) + a
//   small amber console readout on the desk (a point of life, unlit so it glows). Kept out of the
//   corridor alert-cut array so the cabin stays its own warm space during the disaster.
const _qtrReadLens = new THREE.MeshBasicMaterial({ color: 0xffd79a });
const _qtrConsole = new THREE.MeshStandardMaterial({ color: 0x0e1512, roughness: 0.2, metalness: 0.1, emissive: 0x123a26, emissiveIntensity: 0.6 });
_buildMats.push(_qtrConsole);
// Z2 OVERHAUL — conduit/pipe run (a worn painted pipe, distinct from the black rubber _cable — a
//   dull oxidised copper-grey so the runs read as ship plumbing, not decoration).
const _qtrConduit = _metal(0x6a5f4e, 0.38, 0.70, { flat: true, grime: true });
let _qtrDoorLeaf: THREE.Group | null = null;     // the quarters sliding-door leaf (parked open by default)
let _qtrLamp: THREE.PointLight | null = null;    // the room's warm bunk lamp (kept out of the alert dim)

/** X4 item-1 — build the CREW QUARTERS: a small lived-in cabin OUTBOARD of the −X corridor wall
 *  (x < −1.0), entered through a sliding door in the wall (parked OPEN so the walk peeks in). LIVED-IN
 *  BASICS: a bunk (mattress + folded blanket + pillow), a wall locker, a folding desk with a mug +
 *  a pinned photo, a shelf. Walkable — the QUARTERS_COLLIDERS box the room; the corridor −X wall is
 *  gapped at the door (buildCorridor). The room has its own warm lamp (spills into the corridor
 *  through the open door). The engine-room disaster red-alert still reads in the doorway (the corridor
 *  red floods reach the entrance; the room lamp is a modest warm pool that the menace overrides). */
function buildCrewQuarters(group: THREE.Group): void {
  const q = new THREE.Group();
  q.name = 'escapeShipCrewQuarters';
  group.add(q);
  const wallX = QTR_WALL_X;               // −1.0 (the door plane / corridor wall line)
  const farX = QTR_FAR_X;                 // −4.1 (back wall)
  const zc = QTR_ZC, dHW = QTR_DOOR_HW, dTop = QTR_DOOR_TOP;
  const z0 = QTR_Z0, z1 = QTR_Z1, H = QTR_H;

  // ═══ 1. ROOM SHELL — floor / ceiling / back wall / side walls (dark grimed steel; matches the
  //    corridor family). The corridor-side face (the −X wall line) is the buildCorridor wall, gapped
  //    at the door; here we add the room's own inner faces so the room reads finished from inside.
  // Y2 Z-FIGHT SWEEP (crew-quarters entrance): the room floor/ceiling slabs extend +0.2 past the wall
  //   line (x=−1.0) to tuck gap-free under the corridor wall — but that put their walkable faces
  //   COPLANAR with the corridor's floor top (y=0) / roof underside (y=2.4) over the ~0.1m threshold
  //   overlap, and the DIFFERENT materials (_deck vs corridor _channel sub-floor; _ceil vs corridor
  //   _ceil roof) shimmered there on a slow pan. FIX (real geometry offset, ≥6mm): sink the room floor
  //   6mm (top y=−0.006) + raise the room ceiling 6mm so their planes are cleanly SEPARATED from the
  //   corridor's in the overlap zone. The gap-free tuck is preserved (the boxes still span past the
  //   wall); the 6mm step is under the door sill/roof line and imperceptible.
  const rFloor = _box(wallX - farX + 0.2, COR_WALL_T, z1 - z0 + 0.2, _deck);
  rFloor.position.set(QTR_XC, -COR_WALL_T / 2 - 0.006, (z0 + z1) / 2);
  q.add(rFloor);
  const rCeil = _box(wallX - farX + 0.2, COR_WALL_T, z1 - z0 + 0.2, _ceil);
  rCeil.position.set(QTR_XC, H + COR_WALL_T / 2 + 0.006, (z0 + z1) / 2);
  q.add(rCeil);
  const rBack = _box(COR_WALL_T, H + 0.2, z1 - z0 + 0.2, _shell);
  rBack.position.set(farX - COR_WALL_T / 2, H / 2, (z0 + z1) / 2);
  q.add(rBack);
  for (const sz of [-1, 1]) {
    const side = _box(wallX - farX + 0.2, H + 0.2, COR_WALL_T, _shell);
    side.position.set(QTR_XC, H / 2, (sz < 0 ? z0 : z1) + sz * COR_WALL_T / 2);
    q.add(side);
  }
  // the room's corridor-side wall RETURNS (the −X wall line inside the room, flanking the door) — so
  //   from INSIDE the room the wall reads solid either side of the door, dressed to match.
  // ROUND-1e Z-FIGHT SWEEP (crew-quarters entrance, BOTH sides — the Y2 offsets were insufficient/
  //   regressed at grazing vantages). The residual flicker came from the room-return's DADO band, which
  //   was centred x=−1.02 (front face −0.99) — a _channel face poking 1cm PAST the corridor wall front
  //   (x=−1.0, _shell) into the corridor, near-coplanar with a different material → shimmer on a slow
  //   pan. FIX: the return front is recessed to −1.06 (was −1.05) and its DADO is recessed to sit ON the
  //   return face (front −1.04), 4cm clear BEHIND the corridor wall front — it no longer shares or
  //   crosses the wall plane, and no longer pokes into the corridor. The return + dado are room-interior
  //   detail (seen through the door aperture); nothing of them lands on the corridor-side wall plane now.
  for (const [rz0, rz1] of [[z0, zc - dHW], [zc + dHW, z1]] as const) {
    const rlen = rz1 - rz0; if (rlen < 0.05) continue;
    const ret = _box(0.12, H + 0.2, rlen, _band);
    ret.position.set(wallX - 0.12, H / 2, (rz0 + rz1) / 2);   // front x=−1.06 (recessed 6cm behind the wall line)
    q.add(ret);
    // a lower dado band recessed ONTO the return face (front −1.04) — matches the corridor two-value
    //   language but stays clear behind the corridor wall plane (no proud-into-corridor poke).
    const dado = _box(0.04, 0.6, rlen - 0.1, _channel);
    dado.position.set(wallX - 0.08, 0.5, (rz0 + rz1) / 2);   // center −1.08, front −1.06 → flush on the return, 6cm behind the wall
    q.add(dado);
  }
  // ── Z2 OVERHAUL — WALL DRESSING. The old pass was a flat proud panel + dado on all three walls,
  //    which still read institutional (the user: "generic boxes"). NEW: a purposeful two-value sci-fi
  //    panelling language keyed PER WALL to its function — the BACK wall carries the bunk alcove (built
  //    below, so it is NOT dressed here), the FORE side wall carries the desk/console + lockers, the AFT
  //    side wall carries tall storage. Each side wall gets a proud upper panel band + a darker recessed
  //    lower dado + a machined rub-rail, PLUS real ship greeble (a marching bolt line + a recessed panel
  //    seam). All boxy proud features are ≥10cm deep INTO the room off the wall face (CLAUDE.md rule 7)
  //    so nothing reads paper-thin edge-on. The wall FACE plane is at x/z = the shell inner face; proud
  //    features stand OFF it toward the room by ≥ their half-depth so no face is coplanar with the shell.
  const _dressSide = (nz: number, cz: number, spanLen: number): void => {
    const wallZ = cz;                 // the shell inner-face z for this side wall
    const along = spanLen;            // runs along X (room depth)
    // proud upper panel band (raised battleship grey), 12cm proud → clear of the shell face.
    const upper = _box(along - 0.24, 1.02, 0.12, _band);
    upper.position.set(QTR_XC, 1.52, wallZ + nz * 0.06);   // face 12cm proud, back 0cm at the shell
    q.add(upper);
    // a recessed panel-seam line splitting the upper band (two-plate read).
    const seam = _box(along - 0.24, 0.03, 0.14, _channel);
    seam.position.set(QTR_XC, 1.52, wallZ + nz * 0.055);
    q.add(seam);
    // lower dark dado (deeper matte), 10cm proud.
    const lower = _box(along - 0.24, 0.72, 0.10, _channel);
    lower.position.set(QTR_XC, 0.5, wallZ + nz * 0.05);
    q.add(lower);
    // a machined rub-rail where they meet (a hand-height ledge line).
    const rail = _box(along - 0.16, 0.06, 0.14, _corrRail);
    rail.position.set(QTR_XC, 0.98, wallZ + nz * 0.07);
    q.add(rail);
    // a marching bolt line along the rub-rail (worked hardware, faces into the room).
    for (let x = QTR_FAR_X + 0.4; x <= QTR_WALL_X - 0.3; x += 0.5)
      q.add(_stud(x, 1.06, wallZ + nz * 0.14, new THREE.Vector3(0, 0, nz), _rivet, 0.016));
  };
  //  fore + aft side walls (normal into the room along ∓Z). The back wall is dressed by the alcove.
  _dressSide(1, z0 + COR_WALL_T / 2, wallX - farX);
  _dressSide(-1, z1 - COR_WALL_T / 2, wallX - farX);

  // ── Z2 OVERHAUL — CONDUIT + VENT greeble along the ceiling coving, so the cabin reads as a working
  //    ship compartment, not a painted box. A pair of pipe runs sweep from the fore wall to the back
  //    wall high on the aft side (cylinders are inherently thick → rule 7 exempt), pinned by saddle
  //    clamps, and a louvred air-return vent sits high on the fore wall. All clear of the walkable band.
  for (const [cy, mat, r] of [[2.16, _qtrConduit, 0.05], [2.05, _cable, 0.035]] as const) {
    const pipe = _cyl(r, r, wallX - farX - 0.3, 8, mat);
    pipe.rotation.z = Math.PI / 2;                       // run along X
    pipe.position.set(QTR_XC, cy, z1 - 0.16);
    q.add(pipe);
    for (let x = QTR_FAR_X + 0.5; x <= QTR_WALL_X - 0.4; x += 0.7) {   // saddle clamps to the wall
      const clamp = _box(0.06, 0.09, 0.12, _channel);
      clamp.position.set(x, cy, z1 - 0.1);
      q.add(clamp);
    }
  }
  //  a louvred air-return vent, high on the FORE wall (proud housing + slats, rule-7 depth).
  const ventHousing = _box(0.5, 0.34, 0.11, _steel);
  ventHousing.position.set(QTR_FAR_X + 0.9, 2.05, z0 + 0.06);
  q.add(ventHousing);
  for (let vy = 1.94; vy <= 2.16; vy += 0.055) {
    const slat = _box(0.44, 0.02, 0.13, _channel);
    slat.position.set(QTR_FAR_X + 0.9, vy, z0 + 0.065);
    q.add(slat);
  }

  // ═══ 2. THE SLIDING DOOR — a single heavy leaf riding a header rail, PARKED OPEN in a wall pocket
  //    on the aft side (so the corridor walk sees INTO the lit cabin — the lived-in read). Frame:
  //    channel-steel jambs + a header + a threshold + a stencilled placard + a slim hazard accent, so
  //    it reads as a real, intentional operational door. setQuartersDoor can close it later.
  //  side JAMBS (proud of the wall INTO the room). ROUND-1e Z-FIGHT SWEEP: the Y2 offset (+X face −1.02,
  //   only 2cm proud) was too shallow — at grazing vantages the 2cm gap between the _steel post front
  //   and the _shell wall front (−1.0) still shimmered, and the hazard accents STRADDLED the wall plane.
  //   FIX: the frame stands 4cm proud (base wallX−0.14 → +X face −1.04), an unambiguous proud frame, and
  //   EVERY accent (hazard bands, placard) is seated cleanly ON a frame face, never on/across the wall
  //   plane. Studs face into the frame (not out toward the wall). No _steel/_shell coplanar pair remains.
  const qFrameX = wallX - 0.14;   // door-frame base X: +X face 4cm proud into the room off the wall line
  const qFrontX = qFrameX + 0.09; // the proud frame front face (x=−1.04) — hazard/placard seat OUTBOARD of this
  for (const sz of [-1, 1]) {
    const post = _box(0.18, dTop + 0.12, 0.18, _steel);
    post.position.set(qFrameX, (dTop + 0.12) / 2, zc + sz * (dHW + 0.09));
    q.add(post);
    // studs on the FRONT face of the post (facing +X into the room), proud of the frame front, clear of
    //   the wall plane (tip ≈ −1.06, well behind the corridor wall front −1.0 is wrong sign — front face
    //   is at −1.04 toward the room, so studs sit at −1.05 facing +X, proud of the frame, no wall contact)
    for (let y = 0.4; y < dTop; y += 0.42) q.add(_stud(qFrontX + 0.01, y, zc + sz * (dHW + 0.09), new THREE.Vector3(1, 0, 0), _rivet, 0.015));
  }
  //  HEADER lintel + a slim hazard band + a stencilled placard ("CREW") — all seated on the proud frame
  const lintel = _box(0.18, 0.2, dHW * 2 + 0.5, _steel);
  lintel.position.set(qFrameX, dTop + 0.10, zc);
  q.add(lintel);
  // the hazard band sits PROUD on the lintel front (front face ≈ −1.06, clear of the wall −1.0), not
  //   straddling the wall plane as before.
  const lintelHaz = _box(0.03, 0.06, dHW * 2 + 0.2, _bayHazardAccent);
  lintelHaz.position.set(qFrontX + 0.015, dTop + 0.02, zc);
  q.add(lintelHaz);
  // the placard reads PROUD of the lintel front (back at −1.05, face at −1.06) — no longer buried in the
  //   lintel (the old placBack was coincident with the lintel centre).
  const placBack = _box(0.02, 0.14, 0.6, _decal);
  placBack.position.set(qFrontX + 0.02, dTop + 0.11, zc);
  q.add(placBack);
  const placFace = _box(0.01, 0.09, 0.46, _corrPlacard);
  placFace.position.set(qFrontX + 0.035, dTop + 0.11, zc);
  q.add(placFace);
  //  THRESHOLD sill + a hazard tread (on the deck, seated on the sill top — the sillHaz sits proud on
  //   the sill top face, not sharing the deck plane)
  const sill = _box(0.30, 0.05, dHW * 2, _steel);
  sill.position.set(wallX - 0.08, 0.03, zc);
  q.add(sill);
  const sillHaz = _box(0.26, 0.02, 0.05, _bayHazardAccent);
  sillHaz.position.set(wallX - 0.08, 0.065, zc);
  q.add(sillHaz);
  //  the header rail the leaf hangs from (spanning to the pocket)
  const rail = _box(0.10, 0.10, dHW * 3.4, _channel);
  rail.position.set(wallX - 0.14, dTop + 0.04, zc + dHW);
  q.add(rail);
  //  the LEAF — parked OPEN, slid into the aft pocket (z > the door). A worked blast-plate.
  const leaf = new THREE.Group();
  leaf.name = 'quartersDoorLeaf';
  leaf.position.set(wallX - 0.14, 0, zc + dHW * 2.05);   // parked aft (open)
  q.add(leaf);
  _qtrDoorLeaf = leaf;
  const slab = _box(0.08, dTop - 0.04, dHW * 2 - 0.04, _bayDoorLeaf);
  slab.position.set(0, dTop / 2, 0);
  leaf.add(slab);
  const inset = _box(0.03, dTop - 0.4, dHW * 2 - 0.24, _channel);
  inset.position.set(0.05, dTop / 2, 0);
  leaf.add(inset);
  const handle = _box(0.05, 0.4, 0.05, _corrRail);
  handle.position.set(0.07, dTop * 0.5, -(dHW - 0.1));
  leaf.add(handle);

  // ═══ 3. THE BUILT-IN BUNK ALCOVE — Z2 OVERHAUL. The old bunk was a slab-on-4-legs floating out into
  //    the room (the "generic box" the user flagged). NEW: an integrated BERTH built into the BACK wall
  //    (x=−4.1) — a solid platform base (no floating legs), flanked by fabricated end-panels, capped by
  //    a header canopy that frames a recessed warm reading-light, with the mattress + blanket + pillow
  //    tucked cleanly INSIDE the frame. It runs along Z against the back wall so it does NOT collide
  //    with the desk (fore wall) or the lockers (aft wall) — the overlap defect is designed out.
  //    Coordinates: the berth deck top at bunkTop; the platform is a solid box from the floor up (a real
  //    built-in, storage below). The mattress sits ON the deck; all soft goods are INSET so nothing
  //    pokes past the frame. Bunk faces +X into the room. Collider = a single box at the berth front
  //    (QTR_BUNK_COLLIDER) so the player can't walk into the mattress but the room stays open.
  const bunkDeckY = 0.52;                        // berth deck top height
  const bunkDepth = 0.78;                        // how far the berth reaches OUT off the back wall (+X)
  // Z2 r2 — the berth foot is pulled AFT (bunkZ0 = z0+0.9) so it clears the desk zone on the fore wall
  //   (the recurring "desk overlaps bunk foot" defect). The berth head is at the aft wall; the foot ends
  //   ~0.9m off the fore wall, leaving that corner for the desk/entry.
  // Z2 r3 — head pulled off the aft wall (bunkZ1=z1−0.75≈11.25) so the berth clears the aft-wall
  //   LOCKER BANK (front z≈11.46) — the overlap defect that had migrated to the aft corner.
  const bunkZ0 = z0 + 0.9, bunkZ1 = z1 - 0.75;   // berth foot z≈9.1 (clear of desk), head z≈11.25 (clear of lockers)
  const bunkLen = bunkZ1 - bunkZ0;
  const bunkXBack = farX + COR_WALL_T / 2;        // the back-wall inner face
  const bunkXFront = bunkXBack + bunkDepth;       // the berth front face (−3.32)
  const bunkXC = (bunkXBack + bunkXFront) / 2;
  //  the ALCOVE LINER — a recessed darker panel on the back wall behind the berth head, so the bunk
  //   reads as a built-in pocket (a two-value break vs the shell), full berth length, floor→canopy.
  //  Z2 r5 (SEV2 #1) — the liner TOP is capped BELOW the canopy underside (top y=1.75) so no tan liner
  //   sliver can show above/between the header cap pieces at the aft corner. Liner spans ~0.62..1.75.
  const linerTop = 1.75, linerBot = 0.62;
  const liner = _box(0.06, linerTop - linerBot, bunkLen + 0.24, _qtrAlcove);
  liner.position.set(bunkXBack + 0.05, (linerTop + linerBot) / 2, (bunkZ0 + bunkZ1) / 2);
  q.add(liner);
  //  the solid PLATFORM base (a fabricated locker-front berth base, no legs — storage below the bunk).
  const base = _box(bunkDepth, bunkDeckY, bunkLen, _qtrLocker);
  base.position.set(bunkXC, bunkDeckY / 2, (bunkZ0 + bunkZ1) / 2);
  q.add(base);
  //  two under-berth storage-drawer fronts (a recessed seam + handles → reads as pull-out drawers).
  for (const dz of [bunkZ0 + bunkLen * 0.28, bunkZ0 + bunkLen * 0.72]) {
    const drawer = _box(0.03, bunkDeckY - 0.14, bunkLen * 0.4, _channel);
    drawer.position.set(bunkXFront - 0.005, bunkDeckY / 2, dz);
    q.add(drawer);
    const pull = _box(0.05, 0.04, 0.18, _corrRail);
    pull.position.set(bunkXFront + 0.02, bunkDeckY / 2 + 0.06, dz);
    q.add(pull);
  }
  //  the berth deck lip (a raised front rail so the mattress reads set into a tray).
  const deckLip = _box(0.05, 0.09, bunkLen, _qtrLocker);
  deckLip.position.set(bunkXFront - 0.02, bunkDeckY + 0.045, (bunkZ0 + bunkZ1) / 2);
  q.add(deckLip);
  //  fabricated END-PANELS flanking the berth (fore + aft), tying it into the frame — the built-in read.
  for (const [ez, tag] of [[bunkZ0 - 0.06, -1], [bunkZ1 + 0.06, 1]] as const) {
    const endPanel = _box(bunkDepth, 1.9, 0.10, _qtrLocker);
    endPanel.position.set(bunkXC, 0.95, ez);
    q.add(endPanel);
    void tag;
  }
  //  the HEADER CANOPY over the berth (a boxed-in shelf/light valance — the alcove ceiling), 12cm deep.
  //  Z2 r5 (SEV2 #1) — the header cap was TWO offset slabs (canopy top y=1.89 + a fascia top y=1.83,
  //   set back at different Z) that met the aft side wall non-flush, showing a stepped seam + a liner
  //   sliver at the top-right corner (the overlap-seam defect the overhaul was chartered to kill). FIX:
  //   ONE continuous cap. The canopy slab + its fascia now share ONE top-edge Y (top=1.89) and the fascia
  //   sits FLUSH under the canopy front (no height/depth step), and the whole cap spans z 8.3..11.9 so it
  //   TERMINATES FLUSH against BOTH side walls' inner faces — no set-back, no liner sliver.
  const capZ0 = z0 + COR_WALL_T / 2, capZ1 = z1 - COR_WALL_T / 2;   // side-wall inner faces (8.3 .. 11.9)
  const capLen = capZ1 - capZ0, capZC = (capZ0 + capZ1) / 2;
  const capTop = 1.89, capThick = 0.14;
  const canopy = _box(bunkDepth, capThick, capLen, _qtrLocker);
  canopy.position.set(bunkXC, capTop - capThick / 2, capZC);        // top edge at capTop
  q.add(canopy);
  //  the fascia is a proud front lip sharing the SAME top edge (capTop), dropping below the canopy —
  //   one continuous face, no offset second slab. Runs the full cap length, flush to both side walls.
  const fasciaDrop = 0.17;
  const canopyFascia = _box(0.06, fasciaDrop, capLen, _band);
  canopyFascia.position.set(bunkXFront - 0.02, capTop - fasciaDrop / 2, capZC);
  q.add(canopyFascia);
  //  the recessed READING LIGHT — a warm strip lens tucked under the canopy at the berth head, its own
  //   modest PointLight (motivated, local). This is the room's lived-in warm pool; kept out of the
  //   alert-dim so the cabin stays warm during the disaster.
  const readHousing = _box(bunkDepth - 0.16, 0.06, 0.5, _channel);
  readHousing.position.set(bunkXC, 1.71, bunkZ0 + 0.5);
  q.add(readHousing);
  const readLens = _box(bunkDepth - 0.24, 0.03, 0.42, _qtrReadLens);
  readLens.position.set(bunkXC, 1.685, bunkZ0 + 0.5);
  q.add(readLens);
  //  the MATTRESS + soft goods, all inset within the deck lip (nothing pokes past the frame).
  const mattress = _box(bunkDepth - 0.12, 0.13, bunkLen - 0.08, _qtrMattress);
  mattress.position.set(bunkXC + 0.01, bunkDeckY + 0.075, (bunkZ0 + bunkZ1) / 2);
  q.add(mattress);
  //  Z2 r5 (SEV2 #2) — the pillow read as a stacked foam CUBE (near-square footprint, thick proud side,
  //   hard 90° corners). FIX: reproportion to read SOFT — ~2:1 length(Z):width(X), thickness cut to ~1/3
  //   so it lies LOW, recessed BACK toward the head wall as a headrest, with chamfered top edges (a low
  //   base slab + a narrower crown that steps the top edge in on all sides → a soft rounded read, not a
  //   block) and a slight centre dip where a head would rest. Same low-poly idiom as the bolster/mattress.
  const pillowLen = 0.52, pillowW = 0.26;                 // 2:1 along the bunk long axis (Z)
  const pillowZ = bunkZ0 + 0.34;                          // recessed back toward the head
  const pillowX = bunkXC - 0.08;                          // pushed back toward the head (back) wall
  const pillowBaseY = bunkDeckY + 0.145;
  const pillowBase = _box(pillowW, 0.045, pillowLen, _qtrPillow);   // the low flat base
  pillowBase.position.set(pillowX, pillowBaseY, pillowZ);
  q.add(pillowBase);
  //  a narrower crown stepping the top edge IN on all sides (a chamfer read, no hard proud corners).
  const pillowCrown = _box(pillowW - 0.08, 0.035, pillowLen - 0.12, _qtrPillow);
  pillowCrown.position.set(pillowX, pillowBaseY + 0.038, pillowZ);
  q.add(pillowCrown);
  //  a shallow centre dip ridge along the two long sides (soft folds where a head sinks in).
  for (const sx of [pillowX - pillowW / 2 + 0.03, pillowX + pillowW / 2 - 0.03]) {
    const fold = _box(0.03, 0.055, pillowLen - 0.06, _qtrPillow);
    fold.position.set(sx, pillowBaseY + 0.01, pillowZ);
    q.add(fold);
  }
  //  a rumpled blanket pulled down toward the foot (rust-red wool, inset).
  const blanket = _box(bunkDepth - 0.14, 0.11, bunkLen * 0.5, _qtrBlanket);
  blanket.position.set(bunkXC + 0.02, bunkDeckY + 0.155, bunkZ1 - bunkLen * 0.28);
  q.add(blanket);
  const blanketFold = _box(bunkDepth - 0.10, 0.09, 0.16, _qtrBlanket);   // a fold ridge where it's turned down
  blanketFold.position.set(bunkXC + 0.03, bunkDeckY + 0.20, bunkZ1 - bunkLen * 0.52);
  q.add(blanketFold);

  // ═══ 4. STORAGE LOCKERS — a bank of two tall steel lockers against the AFT side wall (z=z1),
  //    well clear of the desk (fore wall) and the bunk (back wall). Real locker language: twin
  //    doors, a piano seam, louvre vents, latch handles, a stencil placard. Rule-7 depth (0.44 out).
  const lockerZ = z1 - COR_WALL_T / 2 - 0.22;      // face 22cm proud of the aft wall
  for (let i = 0; i < 2; i++) {
    const lx = QTR_FAR_X + 0.9 + i * 0.66;         // Z2 r3 — nudged door-ward so they clear the bunk head
    const cab = _box(0.6, 1.86, 0.44, _qtrLocker);
    cab.position.set(lx, 0.94, lockerZ);
    q.add(cab);
    // Z2 r4 — a lighter proud DOOR-PANEL inset per leaf (a two-value break so the lockers read their
    //   form in the dim cabin, not a flat black slab), + a dark kick-plate at the base.
    for (const dsx of [lx - 0.15, lx + 0.15]) {     // lower door-panel inset (below the vent band)
      const panel = _box(0.24, 1.05, 0.03, _band);
      panel.position.set(dsx, 0.86, lockerZ + 0.225);
      q.add(panel);
    }
    const kick = _box(0.58, 0.14, 0.03, _channel);
    kick.position.set(lx, 0.14, lockerZ + 0.225);
    q.add(kick);
    const seam = _box(0.02, 1.7, 0.03, _channel);   // the twin-door centre seam (on the face, thin)
    seam.position.set(lx, 0.96, lockerZ + 0.225);
    q.add(seam);
    for (const vy of [1.62, 1.55, 1.48]) {          // louvre vents high on the doors, ON the front face
      const vent = _box(0.46, 0.02, 0.03, _channel);
      vent.position.set(lx, vy, lockerZ + 0.225);
      q.add(vent);
    }
    for (const hx of [lx - 0.16, lx + 0.16]) {      // latch handles either side of the seam
      const latch = _box(0.05, 0.14, 0.05, _corrRail);
      latch.position.set(hx, 1.0, lockerZ + 0.24);
      q.add(latch);
    }
  }
  //  a stencil placard on the first locker (a printed unit label).
  const lockPlac = _box(0.24, 0.08, 0.02, _corrPlacard);
  lockPlac.position.set(QTR_FAR_X + 0.9, 1.72, lockerZ + 0.24);
  q.add(lockPlac);
  //  a hung coverall on a hook BETWEEN the lockers and the door jamb (a soft draped form, flush wall).
  const hook = _box(0.05, 0.06, 0.10, _corrRail);
  hook.position.set(QTR_FAR_X + 2.15, 1.86, z1 - 0.07);
  q.add(hook);
  const coverall = _box(0.34, 0.86, 0.13, _qtrDesk);
  coverall.position.set(QTR_FAR_X + 2.15, 1.44, z1 - 0.10);
  q.add(coverall);
  const coverallLo = _box(0.30, 0.4, 0.11, _channel);
  coverallLo.position.set(QTR_FAR_X + 2.15, 0.88, z1 - 0.11);
  q.add(coverallLo);

  // ═══ 4b. Z2 r5 (SEV2 #3) — a LOW BASE CABINET on the door-side stretch of the AFT wall (between the
  //    locker bank and the door jamb), breaking up the dead near-black base band that carried NO cabin
  //    paneling while the fore wall carried a vent/shelf/conduit/rivets. Cheap targeted detail (a base-
  //    cabinet face + a drawer + seam/latch + a kick-rail conduit + rivets + a small vent grille), kept
  //    DIM (the tone-appropriate shadow read is preserved). It protrudes into the walk space → a paired
  //    collider is added in QUARTERS_COLLIDERS (rule 9) + re-verified by the quarters-walk motion probe.
  const baseCabZ = z1 - COR_WALL_T / 2 - 0.19;    // front ≈ z 11.71 (0.38 deep, proud 19cm)
  const baseCabXC = QTR_FAR_X + 2.55;             // x ≈ −1.55 (door-side of the coverall, in the dead gap)
  const baseCabW = 0.9, baseCabH = 0.66, baseCabD = 0.38;
  const baseCab = _box(baseCabW, baseCabH, baseCabD, _qtrLocker);
  baseCab.position.set(baseCabXC, baseCabH / 2, baseCabZ);
  q.add(baseCab);
  //  a drawer face + a recessed seam splitting it into two + a pull latch (locker/desk vocabulary).
  const bcSeam = _box(0.02, baseCabH - 0.12, 0.03, _channel);
  bcSeam.position.set(baseCabXC, baseCabH / 2, baseCabZ + baseCabD / 2 + 0.005);
  q.add(bcSeam);
  for (const dsx of [baseCabXC - 0.22, baseCabXC + 0.22]) {   // two proud drawer faces (two-value break)
    const drawerFace = _box(0.36, baseCabH - 0.16, 0.03, _band);
    drawerFace.position.set(dsx, baseCabH / 2, baseCabZ + baseCabD / 2 + 0.005);
    q.add(drawerFace);
    const pull = _box(0.14, 0.04, 0.04, _corrRail);
    pull.position.set(dsx, baseCabH / 2 + 0.1, baseCabZ + baseCabD / 2 + 0.03);
    q.add(pull);
  }
  const bcKick = _box(baseCabW - 0.04, 0.1, 0.03, _channel);   // a dark kick-plate at the base
  bcKick.position.set(baseCabXC, 0.1, baseCabZ + baseCabD / 2 + 0.005);
  q.add(bcKick);
  //  a horizontal kick-rail conduit running along the wall above the cabinet (breaks the flat band).
  const kickRail = _cyl(0.03, 0.03, 1.35, 8, _qtrConduit);
  kickRail.rotation.z = Math.PI / 2;              // runs along X
  kickRail.position.set(baseCabXC + 0.05, baseCabH + 0.12, z1 - 0.1);
  q.add(kickRail);
  for (const cx of [baseCabXC - 0.5, baseCabXC + 0.05, baseCabXC + 0.6]) {   // saddle clamps + rivets
    const clamp = _box(0.05, 0.08, 0.1, _channel);
    clamp.position.set(cx, baseCabH + 0.12, z1 - 0.06);
    q.add(clamp);
  }
  //  a small louvred VENT GRILLE beside the cabinet, low on the wall (the fore-wall vent's echo).
  const bcVentH = _box(0.22, 0.26, 0.08, _steel);
  bcVentH.position.set(baseCabXC + 0.72, 0.5, z1 - 0.05);
  q.add(bcVentH);
  for (let vy2 = 0.42; vy2 <= 0.58; vy2 += 0.05) {
    const slat = _box(0.18, 0.014, 0.09, _channel);
    slat.position.set(baseCabXC + 0.72, vy2, z1 - 0.055);
    q.add(slat);
  }
  //  a couple of rivets on the cabinet top edge (worked hardware, faces into the room −Z).
  for (const rx of [baseCabXC - 0.3, baseCabXC + 0.3])
    q.add(_stud(rx, baseCabH - 0.03, baseCabZ + baseCabD / 2 + 0.01, new THREE.Vector3(0, 0, -1), _rivet, 0.014));

  // ═══ 5. THE DESK / CONSOLE — a fabricated fold-down work surface on the FORE side wall (z=z0), with
  //    a small glowing amber console readout (a point of life), a mug, a pinned photo above, and a
  //    stow shelf. Placed on the fore wall so it's clear of the bunk (back) + lockers (aft).
  const deskZ = z0 + COR_WALL_T / 2 + 0.26;        // surface centre, proud of the fore wall
  // Z2 r2 — the desk moves to the DOOR-SIDE of the fore wall (deskX=−1.95), 1.3m off the berth front
  //   (−3.22), so the recurring "desk overlaps bunk" defect is designed out. It greets you on entry.
  const deskX = QTR_WALL_X - 0.95;                 // −1.95, on the fore wall near the entry
  const deskY = 0.8;
  const deskFront = z0 + COR_WALL_T / 2 + 0.52;     // the desk's front edge z
  const desk = _box(0.9, 0.06, 0.52, _qtrDesk);
  desk.position.set(deskX, deskY, deskZ);
  q.add(desk);
  // Z2 r4 — a CANTILEVERED FOLD-DOWN desk (ship-mounted, not a free table): a hinge bracket bolted to
  //   the wall + a raised lip + a shallow tool drawer under the surface + two DIAGONAL support struts
  //   from the front edge down to the wall base. Reads as fabricated wall furniture, not a generic table.
  const deskBracket = _box(0.9, 0.12, 0.08, _channel);   // the wall hinge bracket
  deskBracket.position.set(deskX, deskY - 0.02, z0 + COR_WALL_T / 2 + 0.02);
  q.add(deskBracket);
  const deskLip = _box(0.9, 0.05, 0.03, _channel);       // a raised front lip (stops things rolling off)
  deskLip.position.set(deskX, deskY + 0.045, deskFront - 0.02);
  q.add(deskLip);
  const deskDrawer = _box(0.5, 0.12, 0.4, _qtrLocker);   // a shallow tool drawer under the surface
  deskDrawer.position.set(deskX, deskY - 0.1, deskZ - 0.02);
  q.add(deskDrawer);
  const deskPull = _box(0.16, 0.04, 0.04, _corrRail);
  deskPull.position.set(deskX, deskY - 0.1, deskFront - 0.02);
  q.add(deskPull);
  for (const sx of [deskX - 0.34, deskX + 0.34]) {       // two diagonal support struts (front edge → wall base)
    const strut = _box(0.05, 0.05, 0.66, _qtrDesk);
    strut.position.set(sx, deskY / 2, deskZ + 0.06);
    strut.rotation.x = -0.72;                             // rake back toward the wall base
    q.add(strut);
  }
  //  a recessed CONSOLE READOUT on the fore wall above the desk (a small dark glass screen, amber-lit).
  const consoleBezel = _box(0.42, 0.3, 0.06, _steel);
  consoleBezel.position.set(deskX - 0.1, 1.35, z0 + COR_WALL_T / 2 + 0.03);
  q.add(consoleBezel);
  const consoleScreen = _box(0.34, 0.22, 0.02, _qtrConsole);
  consoleScreen.position.set(deskX - 0.1, 1.35, z0 + COR_WALL_T / 2 + 0.07);
  q.add(consoleScreen);
  const consoleReadout = _box(0.24, 0.03, 0.01, _qtrReadLens);   // a warm status bar on the screen
  consoleReadout.position.set(deskX - 0.1, 1.29, z0 + COR_WALL_T / 2 + 0.085);
  q.add(consoleReadout);
  //  a stow shelf above the console (bracketed, holding a tin + a folded cloth).
  const shelf = _box(0.86, 0.05, 0.24, _qtrDesk);
  shelf.position.set(deskX, 1.68, z0 + COR_WALL_T / 2 + 0.13);
  q.add(shelf);
  for (const sx2 of [deskX - 0.38, deskX + 0.38]) {
    const brk = _box(0.05, 0.16, 0.22, _channel);
    brk.position.set(sx2, 1.6, z0 + COR_WALL_T / 2 + 0.12);
    q.add(brk);
  }
  const tin = _cyl(0.055, 0.055, 0.09, 12, _qtrLocker);
  tin.position.set(deskX - 0.24, 1.75, z0 + COR_WALL_T / 2 + 0.12);
  q.add(tin);
  const clothRoll = _box(0.18, 0.09, 0.15, _qtrPillow);
  clothRoll.position.set(deskX + 0.2, 1.75, z0 + COR_WALL_T / 2 + 0.12);
  q.add(clothRoll);
  //  the chipped enamel MUG on the desk.
  const mugBody = _cyl(0.045, 0.04, 0.09, 14, _qtrBlanket);
  mugBody.position.set(deskX + 0.28, deskY + 0.075, deskZ + 0.02);
  q.add(mugBody);
  const mugRim = _cyl(0.047, 0.047, 0.012, 14, _band);
  mugRim.position.set(deskX + 0.28, deskY + 0.12, deskZ + 0.02);
  q.add(mugRim);
  //  a PINNED PHOTO + a smaller snapshot on the fore wall beside the console (the human note).
  const photoFrameMat = new THREE.MeshLambertMaterial({ color: 0x2e281f, flatShading: true });
  _buildMats.push(photoFrameMat);
  const photoMat = new THREE.MeshLambertMaterial({ color: 0xb8a67e, flatShading: true });
  _buildMats.push(photoMat);
  const pframe = _box(0.28, 0.34, 0.03, photoFrameMat);
  pframe.position.set(deskX + 0.34, 1.36, z0 + COR_WALL_T / 2 + 0.03);
  q.add(pframe);
  const photo = _box(0.22, 0.28, 0.012, photoMat);
  photo.position.set(deskX + 0.34, 1.36, z0 + COR_WALL_T / 2 + 0.05);
  q.add(photo);
  const snap = _box(0.14, 0.18, 0.01, photoMat);
  snap.position.set(deskX + 0.34, 1.62, z0 + COR_WALL_T / 2 + 0.05);
  snap.rotation.z = 0.14;
  q.add(snap);

  // ═══ 5b. FLOOR CLUTTER — a stowage crate + a duffel tucked in the FORE-DOOR corner (the walkable
  //    entry side), clear of the berth/desk/lockers. The lived-in "someone dumped their kit" read.
  const crate = _box(0.44, 0.42, 0.44, _qtrLocker);
  crate.position.set(QTR_FAR_X + 0.34, 0.21, z0 + 0.34);
  q.add(crate);
  const crateLid = _box(0.46, 0.04, 0.46, _channel);
  crateLid.position.set(QTR_FAR_X + 0.34, 0.43, z0 + 0.34);
  q.add(crateLid);
  const crateStrap = _box(0.46, 0.05, 0.04, _corrHazard);   // a hazard-yellow shipping strap
  crateStrap.position.set(QTR_FAR_X + 0.34, 0.25, z0 + 0.34);
  q.add(crateStrap);
  const duffel = _cyl(0.17, 0.17, 0.58, 12, _qtrMattress);
  duffel.rotation.x = Math.PI / 2;
  duffel.position.set(QTR_FAR_X + 0.9, 0.17, z0 + 0.32);
  q.add(duffel);

  // ═══ 5c. FLOOR DETAIL — Z2 r4: the deck read too bare. A worn hazard THRESHOLD TREAD just inside the
  //    door (the ship-door idiom) + a pair of recessed deck-plate seams break the empty floor without
  //    cluttering the walkable centre. All flush/near-flush (2cm proud) so they don't trip the walk.
  const tread = _box(0.28, 0.02, 2 * dHW - 0.1, _corrHazard);
  tread.position.set(wallX - 0.28, 0.011, zc);
  q.add(tread);
  //  two deck-plate seams running across the floor (X-wise), dividing the deck into worked plates.
  for (const sz of [z0 + 1.25, z1 - 1.05]) {
    const seam = _box(wallX - farX - 0.2, 0.012, 0.04, _channel);
    seam.position.set(QTR_XC, 0.007, sz);
    q.add(seam);
  }

  // ═══ 6. LIGHTING — MOTIVATED, LOCAL PointLights ONLY. Z2 CRITICAL FIX: the old build used a
  //    THREE.HemisphereLight for room fill — a SCENE-GLOBAL light that bleeds into the desert world
  //    (the exact bug class the brief warns about; it shipped once). REMOVED. The cabin is now lit by
  //    (a) the warm bunk reading-light pool, motivated by the alcove lens, and (b) a cool ceiling can,
  //    motivated by the recessed ceiling fixture. Both are POINT lights with finite range/decay so they
  //    stay inside the room. The warm bunk lamp is kept out of the alert-dim (the cabin's own warmth).
  //  the alcove reading light (warm, pooled at the berth head).
  const lamp = new THREE.PointLight(0xffca8a, 0.85, 3.4, 2.0);
  lamp.position.set(bunkXC + 0.1, 1.62, bunkZ0 + 0.5);
  q.add(lamp);
  _qtrLamp = lamp;
  //  a recessed CEILING CAN fixture (housing + a cool lens) + its cool fill PointLight, centred.
  const canHousing = _box(0.44, 0.06, 0.44, _channel);
  canHousing.position.set(QTR_XC, H - 0.03, (z0 + z1) / 2);
  q.add(canHousing);
  const canLens = _box(0.34, 0.02, 0.34, _corrLens);
  canLens.position.set(QTR_XC, H - 0.075, (z0 + z1) / 2);
  q.add(canLens);
  const can = new THREE.PointLight(0xcfd6de, 0.7, 5.0, 1.7);
  can.position.set(QTR_XC, H - 0.18, (z0 + z1) / 2);
  q.add(can);
  //  a second dim cool fill low toward the door so the entry read isn't a black pit (finite range).
  const entryFill = new THREE.PointLight(0xbcc6d0, 0.4, 3.2, 2.0);
  entryFill.position.set(wallX - 0.6, 1.3, zc);
  q.add(entryFill);
}

// ── X4 item-2 — the STARBOARD VIEWPORT glass: a GENUINELY TRANSPARENT cool space-tinted pane.
//    Y2 TRUTH PASS (user: "the star-backdrop reads fake"). The old fix bolted an emissive
//    star-quad BACKDROP just outboard of the glass so the window "always read as deep space" — but
//    that is a FAKE window (a painted panel, not a view onto the real sky). DELETED. The panes are
//    now genuinely transparent tinted glass: the camera-relative space DOME + its real (now-DENSIFIED,
//    sky.ts) STARFIELD + the celestial planet show THROUGH the glass, exactly as a real window would.
//    Depth discipline: depthWrite:false so the glass does NOT occlude the star Points behind it
//    (the stars are additive, depthWrite-off, drawn before the transparent glass — with the glass
//    also not writing depth, they composite through cleanly). A faint cool tint + gloss keeps the
//    pane readable (edge glints, a whisper of reflection) without hiding the stars. Cloned per-pane.
function _makeViewportGlass(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: 0x3a5468, roughness: 0.10, metalness: 0.0,
    // a faint self-lit tint so the pane never reads as pure invisible void (a hint it is glass),
    // but far dimmer than the old 0.30 so it doesn't wash out the real stars behind it.
    emissive: 0x0a141e, emissiveIntensity: 0.10,
    transparent: true, opacity: 0.14, side: THREE.DoubleSide,
    depthWrite: false,   // Y2 — do NOT occlude the real star Points / sky dome behind the glass
  });
}
const _viewportGlassMats: THREE.MeshStandardMaterial[] = [];

/** X4 item-2 — build the ONE LONG STARBOARD VIEWPORT STRIP: a framed rectangular band of sealed glass
 *  in the +X corridor wall (the wall is cut over the band in buildCorridor; the collider stays solid).
 *  Slim structural frame (rule 7 depth ≥0.10m on the boxy members) + mullions splitting the strip into
 *  panes → the "long viewport" read. The space dome / planet shows through the glass on the walk. */
function buildViewportStrip(group: THREE.Group): void {
  const v = new THREE.Group();
  v.name = 'escapeShipViewport';
  group.add(v);
  const xIn = VP_WALL_X - 0.03;              // glass sits just inboard of the wall plane
  const vpLo = VP_CY - VP_HH, vpHi = VP_CY + VP_HH;
  const zc = (VP_Z0 + VP_Z1) / 2, len = VP_Z1 - VP_Z0;
  // Y2 TRUTH PASS — the fake emissive star-quad backdrop (a painted "space" panel outboard of the
  //   glass) is DELETED. The panes are genuinely transparent now (see _makeViewportGlass), so the
  //   REAL camera-relative sky dome + the (densified) starfield + the planet show THROUGH the glass —
  //   a true window onto space. NOTHING is built outboard of the glass; the corridor +X wall is cut
  //   over the band (buildCorridor) and there is no exterior hull there, so the view is clear sky.
  // ── the GLASS panes (split by mullions into a run of long panes) — showing the REAL space sky.
  const paneN = 4;
  const paneGap = 0.06;                       // mullion width between panes
  const paneW = (len - paneGap * (paneN + 1)) / paneN;
  for (let i = 0; i < paneN; i++) {
    const pz = VP_Z0 + paneGap + paneW / 2 + i * (paneW + paneGap);
    const gm = _makeViewportGlass();
    _viewportGlassMats.push(gm); _buildMats.push(gm);
    const pane = _box(0.04, VP_HH * 2 - 0.04, paneW, gm);
    pane.position.set(xIn, VP_CY, pz);
    v.add(pane);
  }
  // ── the FRAME: a slim proud channel-steel surround (top rail + sill rail + end jambs) + mullions
  //    between panes. Rule 7: the boxy frame members are ≥0.12m deep (into the corridor) so they read
  //    thick, not paper-thin, at oblique angles. Frame stands proud of the wall into the corridor.
  const fx = VP_WALL_X - 0.07;                // frame face stands 0.07m into the corridor off the wall line
  const fDepth = 0.14;                        // proud depth toward the corridor (rule 7)
  // top rail + sill rail (run the length)
  for (const [ry, rh] of [[vpHi + 0.05, 0.14], [vpLo - 0.05, 0.14]] as const) {
    const rail = _box(fDepth, rh, len + 0.24, _winFrame);
    rail.position.set(fx, ry, zc);
    v.add(rail);
  }
  // end jambs (cap the strip fore + aft)
  for (const jz of [VP_Z0 - 0.06, VP_Z1 + 0.06]) {
    const jamb = _box(fDepth, VP_HH * 2 + 0.30, 0.14, _winFrame);
    jamb.position.set(fx, VP_CY, jz);
    v.add(jamb);
  }
  // mullions between the panes (thin vertical dividers)
  for (let i = 1; i < paneN; i++) {
    const mz = VP_Z0 + paneGap / 2 + i * (paneW + paneGap) - paneGap / 2 + paneW / 2 + paneGap / 2;
    // simpler: place at the gap centres
    const gz = VP_Z0 + paneGap + i * (paneW + paneGap) - paneGap / 2;
    const mul = _box(fDepth - 0.02, VP_HH * 2, 0.06, _winFrame);
    mul.position.set(fx + 0.005, VP_CY, gz);
    v.add(mul);
    void mz;
  }
  // a slim inner reveal — a dark channel BORDER around the glass so the pane reads recessed.
  //  FIX PASS (SEV1 ROOT CAUSE): the old reveal was a FULL SOLID PANEL (VP_HH·2+0.04 tall × len+0.06
  //  long) of opaque _channel sitting just inboard of the glass — it OCCLUDED the glass, the star
  //  backdrop, and space entirely. THAT is what made the strip read as "black wall panels" (the
  //  player was looking at the dark reveal panel, not through a window). FIX: build the reveal as a
  //  thin BORDER (top + sill + fore/aft edge strips only), leaving the glazed area OPEN so the stars
  //  read through the glass.
  for (const [ry, rh, rz, rd] of [
    [vpHi - 0.01, 0.04, zc, len + 0.06] as const,          // top edge strip
    [vpLo + 0.01, 0.04, zc, len + 0.06] as const,          // sill edge strip
    [VP_CY, VP_HH * 2 - 0.02, VP_Z0 - 0.01, 0.04] as const,  // fore edge strip
    [VP_CY, VP_HH * 2 - 0.02, VP_Z1 + 0.01, 0.04] as const,  // aft edge strip
  ]) {
    const rv = _box(0.02, rh, rd, _channel);
    rv.position.set(VP_WALL_X - 0.02, ry, rz);
    v.add(rv);
  }
  // bolt studs marching along the rails (worked hardware) — face into the corridor (−X)
  for (let z = VP_Z0 + 0.2; z <= VP_Z1; z += 0.6) {
    for (const by of [vpHi + 0.05, vpLo - 0.05]) v.add(_stud(fx - fDepth / 2, by, z, new THREE.Vector3(-1, 0, 0), _rivet, 0.014));
  }
  // a small grab-rail below the sill (a real freighter window has a hand-hold — reads lived-in)
  const grab = _cyl(0.024, 0.024, len - 0.2, 8, _corrRail);
  grab.rotation.x = Math.PI / 2;
  grab.position.set(VP_WALL_X - 0.12, vpLo - 0.18, zc);
  v.add(grab);
  for (const gz2 of [VP_Z0 + 0.4, zc, VP_Z1 - 0.4]) {
    const stand = _box(0.05, 0.05, 0.05, _rivet);
    stand.position.set(VP_WALL_X - 0.06, vpLo - 0.18, gz2);
    v.add(stand);
  }
}

/** X4 — drive the crew-quarters sliding door: 0 = open (parked, default) → 1 = closed (across the
 *  aperture). Currently the room is left OPEN so the corridor walk peeks in; kept for future scripting
 *  (e.g. sealing it during the disaster). Safe no-op before build / after dispose. */
export function setQuartersDoor(t: number): void {
  if (!_qtrDoorLeaf) return;
  const k = Math.max(0, Math.min(1, t));
  // open (k=0): parked aft at zc + dHW*2.05; closed (k=1): centred over the door (z=QTR_ZC)
  const openZ = QTR_ZC + QTR_DOOR_HW * 2.05, closedZ = QTR_ZC;
  _qtrDoorLeaf.position.z = openZ + (closedZ - openZ) * k;
}

/** R5c — the PHYSICAL EJECT release: shudder the docked pod in its cradle as the explosive bolts
 *  fire (a decaying jitter on the bay pod group) + drop the bay/clamp lighting. `t` 0→1 over the
 *  release. Called by tickShipExplode before the ship is disposed. Safe no-op if the bay isn't built. */
export function releasePodFromBay(t: number): void {
  if (!_bayGroup) return;
  const k = Math.max(0, Math.min(1, t));
  // a hard jitter that grows then the pod tears free (a violent shudder in the cradle)
  const shudder = (1 - Math.abs(k - 0.5) * 2) * 0.06;   // peaks mid-release
  const ph = k * 60;
  _bayGroup.position.x = BAY_POD_X + Math.sin(ph * 1.7) * shudder;
  _bayGroup.position.y = Math.sin(ph * 2.3) * shudder;
  _bayGroup.rotation.z = Math.sin(ph * 1.3) * shudder * 0.5;
  // LIVE-fix (2026-07-05): the front-door pivot RATTLE is REMOVED. It was authored for the OUTSIDE
  //   view; from INSIDE the pod (bay-until-eject) a door swinging ±1.4° around its pivot reads as the
  //   door ajar/broken. The whole-pod shudder (_bayGroup position/roll above) carries the tear-free feel
  //   on its own. Pin the door dead-closed (rotation.y = 0) throughout the release.
  if (_bayDoorPivot) _bayDoorPivot.rotation.y = 0;
  // the bay glow flares hot then everything's about to be disposed
  if (_bayGlowLight) _bayGlowLight.intensity = 1.5 + k * 3.0;
}

// ── B1.e — THE ENGINE ROOM (user: "a REAL engine room I can see through a glass sliding door at
//    the back, on fire, and not able to get back there"). Behind the corridor dead-end bulkhead
//    (buildCorridor now frames a doorway there): a GLASS SLIDING DOOR (closed — the player can't
//    pass; the CORRIDOR_COLLIDERS dead-end box blocks them) and BEHIND it a real ENGINE ROOM —
//    an engine block / reactor mass, pipes, machinery silhouettes, a readable room. The FIRE lives
//    INSIDE the room (setEngineFire), lighting it + glowing hot-orange through the glass. The
//    checkEngines/corridor beat walks the player up to SEE it through the glass.
function buildEngineBay(group: THREE.Group): void {
  const room = new THREE.Group();
  room.name = 'escapeShipEngineRoom';
  group.add(room);
  const doorZ = COR_Z1 + 0.14;         // the glass sliding door plane (just aft of the bulkhead)
  const roomZ0 = doorZ + 0.1, roomZ1 = doorZ + 4.2;   // the engine room depth (behind the door)
  const roomZc = (roomZ0 + roomZ1) / 2;
  const roomHW = 1.9;                  // the room is wider than the corridor (a real machine hall)
  const roomH = 2.9;
  const eDoorHW = 0.86, eDoorTop = 2.14;

  // ── 1. THE ROOM SHELL — floor / ceiling / back wall / side walls (dark grimed steel; the fire
  //    lights it from within). Built as a closed box behind the door.
  const rFloor = _box(roomHW * 2 + 0.4, COR_WALL_T, roomZ1 - roomZ0 + 0.4, _channel);
  rFloor.position.set(0, -COR_WALL_T / 2, roomZc);
  room.add(rFloor);
  const rCeil = _box(roomHW * 2 + 0.4, COR_WALL_T, roomZ1 - roomZ0 + 0.4, _ceil);
  rCeil.position.set(0, roomH + COR_WALL_T / 2, roomZc);
  room.add(rCeil);
  const rBack = _box(roomHW * 2 + 0.4, roomH + 0.2, COR_WALL_T, _shell);
  rBack.position.set(0, roomH / 2, roomZ1 + COR_WALL_T / 2);
  room.add(rBack);
  for (const sx of [-1, 1]) {
    const wall = _box(COR_WALL_T, roomH + 0.2, roomZ1 - roomZ0 + 0.4, _shell);
    wall.position.set(sx * (roomHW + COR_WALL_T / 2), roomH / 2, roomZc);
    room.add(wall);
    // the front wall segments flanking the doorway (the bulkhead's aft face, closing the room to
    //   the corridor except through the door) so you don't see corridor-void past the door edges.
    const frontSeg = _box(roomHW - eDoorHW, roomH + 0.2, COR_WALL_T, _shell);
    frontSeg.position.set(sx * (eDoorHW + (roomHW - eDoorHW) / 2), roomH / 2, doorZ - 0.06);
    room.add(frontSeg);
  }
  const frontTop = _box(eDoorHW * 2, roomH - eDoorTop + 0.2, COR_WALL_T, _shell);
  frontTop.position.set(0, (eDoorTop + roomH + 0.2) / 2, doorZ - 0.06);
  room.add(frontTop);

  // ── 2. THE ENGINE / REACTOR MASS — the room's centrepiece: a big cylindrical reactor drum on the
  //    back wall + a boxy engine block, ringed with pipes + housings (readable machinery, not deep
  //    detail). The fire will glow off these from within.
  const reactor = _cyl(0.7, 0.8, roomH - 0.6, 20, _engBlock);
  reactor.position.set(0.0, (roomH - 0.6) / 2 + 0.1, roomZ1 - 0.9);
  room.add(reactor);
  // reactor bands + a hot core vent (a dark recess where the fire seats)
  for (const by of [0.7, 1.5, 2.2]) {
    const band = _cyl(0.74, 0.74, 0.12, 20, _engMachine);
    band.position.set(0.0, by, roomZ1 - 0.9);
    room.add(band);
  }
  const coreVent = _box(0.7, 1.0, 0.3, _channel);   // the ruptured core the fire pours from
  coreVent.position.set(0.0, 1.1, roomZ1 - 1.35);
  room.add(coreVent);
  // a boxy engine block to one side + a turbine housing to the other (machine-hall silhouettes)
  const block = _box(1.0, 1.4, 1.3, _engBlock);
  block.position.set(-roomHW + 0.7, 0.7, roomZc + 0.3);
  room.add(block);
  const turbine = _cyl(0.55, 0.55, 1.5, 16, _engMachine);
  turbine.rotation.z = Math.PI / 2;
  turbine.position.set(roomHW - 0.7, 1.0, roomZc + 0.2);
  room.add(turbine);
  // PIPES running the room (ceiling + wall runs) + valve wheels — the machinery read
  for (const [px, py] of [[-1.4, roomH - 0.35], [1.4, roomH - 0.35], [-1.5, 1.2], [1.5, 1.2]] as const) {
    const pipe = _cyl(0.08, 0.08, roomZ1 - roomZ0 - 0.3, 10, _engMachine);
    pipe.rotation.x = Math.PI / 2;
    pipe.position.set(px, py, roomZc);
    room.add(pipe);
  }
  for (const [wx, wy, wz] of [[-1.1, 1.4, doorZ + 0.6], [1.2, 0.9, doorZ + 1.0]] as const) {
    const wheel = _cyl(0.18, 0.18, 0.06, 12, _corrRail);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, wy, wz);
    room.add(wheel);
  }
  // a floor grate + a couple of deck plates (the room reads as a real machine deck)
  const grate = _box(roomHW * 1.4, 0.04, roomZ1 - roomZ0 - 0.6, _deck);
  grate.position.set(0, 0.03, roomZc);
  room.add(grate);

  // ── 2b. X4 item-6c — MORE MECHANICAL DETAIL that CONNECTS (manifolds + coil banks + piping that
  //    ties the reactor to the block/turbine, not floating masses). Kept to the SIDES + BACK so the
  //    fire at the core (roomZ1−1.2, centre) still reads clearly through the glass door.
  //  (a) a PIPE MANIFOLD HEADER across the back wall linking the reactor to the side machines — a fat
  //      horizontal drum with take-off pipes dropping to the block + turbine (the plumbing that binds
  //      the machinery into one plant).
  const header = _cyl(0.16, 0.16, roomHW * 1.7, 14, _engMachine);
  header.rotation.z = Math.PI / 2;
  header.position.set(0, roomH - 0.5, roomZ1 - 0.35);
  room.add(header);
  for (const tx of [-roomHW + 0.7, -0.4, 0.4, roomHW - 0.7]) {   // take-off drops from the header
    const drop = _cyl(0.06, 0.06, 1.4, 8, _engMachine);
    drop.position.set(tx, roomH - 1.2, roomZ1 - 0.35);
    room.add(drop);
    const flange = _cyl(0.1, 0.1, 0.05, 10, _engBlock);
    flange.position.set(tx, roomH - 0.5, roomZ1 - 0.35);
    room.add(flange);
  }
  //  (b) COIL BANKS on the engine block (−X) — a stack of ring coils (toroidal windings) reading as an
  //      induction/cooling coil bank; a real machine texture, connected by a bus bar.
  const blockX = -roomHW + 0.7;
  for (let ci = 0; ci < 4; ci++) {
    const coilGeo = new THREE.TorusGeometry(0.22, 0.06, 8, 16);
    _disposables.push(coilGeo);
    const coil = new THREE.Mesh(coilGeo, _engMachine);
    coil.rotation.y = Math.PI / 2;
    coil.position.set(blockX + 0.6, 0.45 + ci * 0.34, roomZc + 0.3);
    room.add(coil);
  }
  const bus = _box(0.06, 1.4, 0.06, _corrRail);   // a copper-ish bus bar up the coil stack
  //   ROUND-1e FLOATER FIX: was at blockX+0.82 (x=−0.38), just PAST the coils' outer radius (blockX+0.6
  //   ±0.22 → −0.38) → a near-miss island. Moved ONTO the coil stack (x=blockX+0.6) so the bar rides the
  //   coils (touching), tying the bank together. (Engine room is behind glass, but the lint stays clean.)
  bus.position.set(blockX + 0.6, 0.9, roomZc + 0.3);
  room.add(bus);
  //  (c) a CONNECTING PIPE ARC from the reactor mid to the turbine (+X) — the coolant loop tying the
  //      core to the turbine (a bent pipe run, not two islands).
  for (const [x0, x1, py] of [[-0.55, blockX + 0.6, 1.6], [0.55, roomHW - 0.75, 1.35]] as const) {
    const run = _cyl(0.07, 0.07, Math.abs(x1 - x0), 8, _engMachine);
    run.rotation.z = Math.PI / 2;
    run.position.set((x0 + x1) / 2, py, roomZ1 - 0.7);
    room.add(run);
    const knee = _cyl(0.08, 0.08, 0.3, 8, _engMachine);   // a vertical knee where it turns down
    knee.position.set(x1, py - 0.15, roomZ1 - 0.7);
    room.add(knee);
  }
  //  (d) a CABLE TRAY down one wall + conduits into a small control cabinet by the door (a manned
  //      station read) — cabling that ROUTES somewhere, not decoration.
  // ROUND-1e FLOATER FIX: the cable tray + rungs sat at x=roomHW−0.14 (1.76), 14cm off the +X wall
  //   (1.9) → the tray/rung island didn't touch the wall (a pre-existing floater). Widened + shifted so
  //   the tray back meets the wall (x=roomHW−0.07 → back face at the wall plane) — it now mounts to the
  //   wall it routes along.
  const tray = _box(0.18, 0.06, roomZ1 - roomZ0 - 0.5, _channel);
  tray.position.set(roomHW - 0.07, roomH - 0.7, roomZc);
  room.add(tray);
  for (let z = roomZ0 + 0.4; z < roomZ1; z += 0.5) {
    const rung = _box(0.20, 0.02, 0.04, _corrRail);
    rung.position.set(roomHW - 0.07, roomH - 0.7, z);
    room.add(rung);
  }
  const cabinet = _box(0.4, 1.3, 0.4, _engBlock);   // a control cabinet by the door
  cabinet.position.set(roomHW - 0.5, 0.65, doorZ + 0.7);
  room.add(cabinet);
  const cabFace = _box(0.02, 0.5, 0.32, _screenGlass);   // a dark readout face
  cabFace.position.set(roomHW - 0.71, 1.0, doorZ + 0.7);
  room.add(cabFace);
  for (const cy of [0.55, 0.7]) {   // a couple of status LEDs on the cabinet (unlit glow)
    const led = _box(0.02, 0.03, 0.03, _ledAmber);
    led.position.set(roomHW - 0.71, cy, doorZ + 0.56);
    room.add(led);
  }
  //  (e) a couple of PRESSURE GAUGES + valve wheels clustered on the manifold (worked hardware)
  for (const [gx, gz] of [[-0.7, roomZ1 - 0.55], [0.7, roomZ1 - 0.55]] as const) {
    const gauge = _cyl(0.09, 0.09, 0.05, 12, _steel);
    gauge.rotation.x = Math.PI / 2;
    gauge.position.set(gx, roomH - 0.5, gz + 0.16);
    room.add(gauge);
    const gface = _cyl(0.06, 0.06, 0.02, 12, _dialFace);
    gface.rotation.x = Math.PI / 2;
    gface.position.set(gx, roomH - 0.5, gz + 0.19);
    room.add(gface);
  }

  // ── 3. THE GLASS SLIDING DOOR — two leaves meeting in the centre of the doorway, CLOSED. Heavy
  //    scuffed safety glass in steel frames, riding a header rail + a floor track (a real sliding
  //    door). The player can't pass (the dead-end collider blocks them); the fire glows through it.
  const doorFrameTop = _box(eDoorHW * 2 + 0.3, 0.14, 0.2, _steel);   // header rail
  doorFrameTop.position.set(0, eDoorTop + 0.05, doorZ);
  room.add(doorFrameTop);
  const doorTrack = _box(eDoorHW * 2 + 0.3, 0.08, 0.2, _channel);    // floor track
  doorTrack.position.set(0, 0.04, doorZ);
  room.add(doorTrack);
  for (const [sx, leafRef] of [[-1, 'L'], [1, 'R']] as const) {
    const leaf = new THREE.Group();
    leaf.position.set(sx * (eDoorHW / 2), 0, doorZ);   // each leaf covers half the doorway (closed)
    room.add(leaf);
    if (leafRef === 'L') _engineDoorJudderL = leaf; else _engineDoorJudderR = leaf;
    // the glass pane
    const glassMat = _makeEngineGlass();
    _engineGlassMats.push(glassMat); _buildMats.push(glassMat);
    const pane = _box(eDoorHW - 0.06, eDoorTop - 0.24, 0.03, glassMat);
    pane.position.set(0, eDoorTop / 2 + 0.02, 0);
    leaf.add(pane);
    // a steel frame border around the leaf (top/bottom rail + stile on the meeting + outer edge)
    for (const [w, h, ox, oy] of [
      [eDoorHW, 0.10, 0, eDoorTop - 0.06] as const,
      [eDoorHW, 0.14, 0, 0.09] as const,
      [0.07, eDoorTop, sx * (eDoorHW / 2 - 0.035), eDoorTop / 2] as const,   // meeting stile (centre)
      [0.07, eDoorTop, -sx * (eDoorHW / 2 - 0.035), eDoorTop / 2] as const,  // outer stile
    ]) {
      const bar = _box(w, h, 0.06, _winFrame);
      bar.position.set(ox, oy, 0.02);
      leaf.add(bar);
    }
    // a pull handle on the meeting stile
    const handle = _box(0.05, 0.4, 0.06, _corrRail);
    handle.position.set(sx * (eDoorHW / 2 - 0.06), eDoorTop * 0.5, 0.05);
    leaf.add(handle);
  }

  // ── 4. THE FIRE (inside the room, at the reactor core) — additive incandescent flame quads that
  //    read THROUGH the glass. Hidden until setEngineFire erupts it; flickers each frame. Two
  //    real lights: the room-glow (lights the machinery from within) + a small corridor-side spill
  //    (leaks through the glass so the door glows into the corridor).
  const fire = new THREE.Group();
  fire.position.set(0.0, 0.9, roomZ1 - 1.2);
  const cols = [0xff2c0c, 0xff7a1e, 0xffc23a];
  for (let i = 0; i < 14; i++) {
    const w = 0.5 + (i % 3) * 0.30, h = 1.0 + (i % 2) * 0.8;
    const g = new THREE.PlaneGeometry(w, h);
    _disposables.push(g);
    const m = new THREE.MeshBasicMaterial({
      color: cols[i % 3], transparent: true, opacity: 0.0,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    });
    _fireMats.push(m); _buildMats.push(m);
    const q = new THREE.Mesh(g, m);
    q.position.set(Math.sin(i * 1.7) * 0.6, (i % 3) * 0.36, -0.2 + 0.06 * i);
    fire.add(q);
  }
  fire.visible = false;
  room.add(fire);
  _engineFire = fire;
  // the room-glow (lights the machinery from within so the room reads lit by the blaze) — off until erupt.
  const glow = new THREE.PointLight(0xff5a1e, 0.0, 7.0, 1.7);
  glow.position.set(0, 1.4, roomZ1 - 1.3);
  room.add(glow);
  _engineGlowLight = glow;
  // the corridor-side spill (leaks through the glass so the door glows into the corridor) — off until erupt.
  const spill = new THREE.PointLight(0xff6a24, 0.0, 6.5, 1.9);
  spill.position.set(0, 1.4, doorZ - 0.4);
  room.add(spill);
  _engineSpillLight = spill;

  // a faint cool ambient in the room so the machinery reads a little even before the fire (so the
  //   room isn't a black void through the glass at first) — dim.
  const roomFill = new THREE.PointLight(0x6a7684, 0.35, 6.0, 1.8);
  roomFill.position.set(0, roomH - 0.5, roomZc);
  room.add(roomFill);
}

/** Drive the ENGINE-ROOM FIRE (B1.e). `intensity` 0 = out, 1 = full blaze; `t` = a time
 *  accumulator that flickers the flames + the glow through the glass. Safe no-op if not built. */
export function setEngineFire(intensity: number, t = 0): void {
  if (!_engineFire) return;
  _engineFire.visible = intensity > 0.001;
  for (let i = 0; i < _fireMats.length; i++) {
    const flick = 0.55 + 0.45 * Math.sin(t * (6.5 + i * 0.7) + i * 1.7);
    const tier = i % 3 === 0 ? 1.0 : (i % 3 === 1 ? 0.8 : 0.6);   // red core brightest
    _fireMats[i].opacity = Math.min(1, intensity * tier * flick);
  }
  const gflick = 0.7 + 0.3 * Math.sin(t * 9.3 + 0.6) + 0.12 * Math.sin(t * 21.0);
  if (_engineGlowLight) _engineGlowLight.intensity = intensity * 4.5 * gflick;
  if (_engineSpillLight) _engineSpillLight.intensity = intensity * 2.2 * gflick;
  // the GLASS glows hot-orange with the fire (its emissive lifts) so the blaze reads through the door.
  for (const m of _engineGlassMats) {
    m.emissive.setRGB(intensity * 0.55 * gflick, intensity * 0.22 * gflick, intensity * 0.05 * gflick);
  }
  // the sliding-door leaves JUDDER faintly as the room burns/pressurises (a menacing rattle).
  const jud = intensity * 0.012 * Math.sin(t * 17.0);
  if (_engineDoorJudderL) _engineDoorJudderL.position.x = -0.86 / 2 + jud;
  if (_engineDoorJudderR) _engineDoorJudderR.position.x = 0.86 / 2 - jud;
  // flicker-scale the blaze (taller/shorter licks)
  _engineFire.scale.set(1 + 0.10 * Math.sin(t * 8.0), 1 + 0.16 * Math.sin(t * 6.3 + 1.0), 1);
}

/** Drive the ship RED-ALERT (T3.4 disaster) — tint the greybox corridor mats toward hot-red,
 *  pulsing with `strobe` (0..1). Level 0 restores the base greybox. Safe no-op if not built. */
export function setShipAlert(level: 0 | 2, strobe = 0): void {
  _shipAlertLevel = level;
  // ── R5b — the corridor is LIT metal now, so the alert is driven by REAL LIGHTS + emissive
  //    strips, NOT a MeshBasicMaterial tint (the old greybox mechanism). On alert: the normal warm
  //    can-lights + fill DROP toward dark, the fixture lenses cut, and the ship's RED warning
  //    strips + two red floods fire + strobe — so the surfaces still MODEL (form + material read)
  //    under a menacing red source, not a flat-red Photoshop wash.
  if (level === 0) {
    for (const l of _corrNormalLights) {
      const base = (l.userData.corrBase ??= l.intensity) as number;
      l.intensity = base;
    }
    for (const m of _corrLensMats) m.color.setHex(0xffe4b0);
    for (const m of _corrRedStripMats) m.color.setHex(0x1c0604);
    if (_corrRedLight) _corrRedLight.intensity = 0;
    if (_corrRedLight2) _corrRedLight2.intensity = 0;
    if (_qtrLamp) _qtrLamp.intensity = (_qtrLamp.userData.qtrBase ??= _qtrLamp.intensity) as number;   // X4 — quarters lamp back to warm
    // legacy: restore any (now unused) tint-mats if present.
    for (const { mat, base } of _corridorMats) mat.color.copy(base);
    return;
  }
  // full red-alert: normal lights crushed (a faint ember of the fill survives so metal still reads),
  //   lenses dimmed to a dead amber, red strips + floods pulsing.
  for (const l of _corrNormalLights) {
    const base = (l.userData.corrBase ??= l.intensity) as number;
    l.intensity = base * 0.14;
  }
  for (const m of _corrLensMats) m.color.setHex(0x3a2410);
  const hot = strobe > 0.45;
  for (const m of _corrRedStripMats) m.color.setHex(hot ? 0xff3218 : 0x5a0e06);
  if (_corrRedLight) _corrRedLight.intensity = 2.4 + 3.4 * strobe;
  if (_corrRedLight2) _corrRedLight2.intensity = 1.8 + 2.6 * strobe;
  if (_qtrLamp) _qtrLamp.intensity = ((_qtrLamp.userData.qtrBase ??= _qtrLamp.intensity) as number) * 0.2;   // X4 — the crew lamp all but dies under the alert
  // legacy tint (no-op unless old greybox mats exist)
  for (const { mat, base } of _corridorMats) mat.color.copy(base).lerp(_ALERT_RED, 0.34 + 0.34 * strobe);
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
  _alertBeaconLight = null;
  _alertBeaconMesh = null;
  _alertStripMats = [];
  _alertKeyLights = [];
  _corridorMats.length = 0;
  _furnitureColliders.length = 0;
  _engineFire = null;
  _fireMats.length = 0;
  _engineGlowLight = null;   // B1.e — engine-room lights (geometry freed via traverse + _disposables)
  _engineSpillLight = null;
  _engineGlassMats.length = 0;
  _engineDoorJudderL = null;
  _engineDoorJudderR = null;
  _corrNormalLights.length = 0;
  _corrLensMats.length = 0;
  _corrRedStripMats.length = 0;
  _corrRedLight = null;
  _corrRedLight2 = null;
  _bayGroup = null;         // R5c — the docked-pod bay group (geometry freed via _disposables + traverse)
  _bayDoorPivot = null;     // B1.a — the docked pod's front-door pivot
  _bayPodYaw = 0;           // Y3.4 — reset the rotate-then-eject yaw (idempotent rebuild starts docked at 0)
  _bayGlowLight = null;     // R5c
  _qtrDoorLeaf = null;      // X4 — the crew-quarters sliding-door leaf
  _qtrLamp = null;          // X4 — the crew-quarters bunk lamp
  _viewportGlassMats.length = 0;   // X4 — the starboard viewport glass (freed via _buildMats)
  // W2b — the operational sliding door: free the state-driven seal collider + null the leaf refs.
  if (_airlockSealBody) { ctx.physics.world.removeRigidBody(_airlockSealBody); _airlockSealBody = null; }
  _airlockDoorL = null;
  _airlockDoorR = null;
  _airlockDoorT = 0;
  _airlockCtx = null;
  _shipAlertLevel = 0;
  // free the per-cockpit IBL + detach it from the persistent metal materials.
  _applyCockpitEnv(null);
  if (_cockpitEnv) { _cockpitEnv.dispose(); _cockpitEnv = null; }
  for (const body of shipBodies) ctx.physics.world.removeRigidBody(body);
  shipBodies.length = 0;
  for (const body of _bayPodBodies) ctx.physics.world.removeRigidBody(body);   // B2 — the docked-pod hull ring colliders
  _bayPodBodies.length = 0;
}
