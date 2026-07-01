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
// Forward (−Z) window gap: x −1.5..1.5, y 0.9..2.5.
const WIN_X = 1.5, WIN_Y0 = 0.9;   // windscreen sill half-width + sill height (top = WIN_TOP_Y)
// Corridor opening in the +Z wall: x −1..1, y 0..2.4.
const DOOR_X = 1.0, DOOR_Y1 = 2.4;

// ── The PILOT STATION frame: the pilot sits FORWARD + LOW, dash wrapping his knees, window
//    above. The dash runs across the −Z sill; the seat is just aft of it. SEAT_Z drives the
//    spawn (getShipSpawn) AND seats the geometry so it composes for the low/close pilot eye.
const CON_Z = -1.55;       // the wrap-around dash centre (right at the forward sill)
const CON_DECK_Y = 0.78;   // instrument-deck height (a low seated glance lands on it)
const SEAT_Z = -0.55;      // the seat sits just aft of the dash (knees under it)
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
// Window GLASS — a real transmissive cool-tinted pane: faint blue tint, very glossy, low opacity
//   so the orbit reads through, but with enough surface to catch a Fresnel rim + reflection.
//   R5a-r3 SEV-2 #1: the panes were reading as open holes against the bright planet. A Fresnel
//   patch (onBeforeCompile) brightens the pane toward grazing angles (the glazing rim glows where
//   the eye sees it edge-on) + adds a soft diagonal reflection sweep + a vertical tint gradient, so
//   the eye registers a sheet of glass between it and the orbit, not a void. Single shared material
//   → no program-cache-key concern (one instance, identical source).
const _glass = new THREE.MeshStandardMaterial({
  color: 0x33444f, roughness: 0.08, metalness: 0.0,
  emissive: 0x0a1620, emissiveIntensity: 0.30,
  transparent: true, opacity: 0.20,
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
  // After the emissive is composed, add the Fresnel rim + reflection sweep + tint gradient.
  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <emissivemap_fragment>',
    `#include <emissivemap_fragment>
     vec3 gV = normalize(-vGlassViewPos);
     float gFres = pow(1.0 - clamp(dot(normalize(vGlassViewNrm), gV), 0.0, 1.0), 2.5);
     // a soft diagonal reflection band sweeping across the pane (a window-light streak)
     float gSweep = smoothstep(0.62, 0.96, sin((vGlassLocal.x * 2.4 + vGlassLocal.y * 3.1) + 1.3) * 0.5 + 0.5);
     // a faint vertical tint gradient (cooler/bluer toward the top of the pane)
     float gGrad = vGlassLocal.y;
     vec3 gRim = mix(vec3(0.14, 0.22, 0.30), vec3(0.30, 0.42, 0.55), gGrad);
     totalEmissiveRadiance += gRim * gFres * 1.7;          // grazing-angle rim glow
     totalEmissiveRadiance += vec3(0.20, 0.27, 0.34) * gSweep * (0.35 + 0.5 * gFres); // reflection sweep`,
  );
  // raise the alpha toward grazing angles so the glazing reads as a real edge-lit sheet, not a hole.
  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <opaque_fragment>',
    `gl_FragColor = vec4( outgoingLight, diffuseColor.a );
     #ifdef OPAQUE
     gl_FragColor.a = 1.0;
     #endif
     float gFres2 = pow(1.0 - clamp(dot(normalize(vGlassViewNrm), normalize(-vGlassViewPos)), 0.0, 1.0), 2.0);
     gl_FragColor.a = clamp(gl_FragColor.a + gFres2 * 0.55, 0.0, 0.9);`,
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

// ── POD-BAY (REBUILD v2 R5c) — the ESCAPE-POD AIRLOCK BAY at the BRIDGE end of the corridor
//    (where the flee leads). A recessed alcove in the −X wall holding the DOCKED escape pod:
//    the SAME size-matched riveted capsule (POD_R) the player rides down, standing on its
//    heat-shield in a clamped bay cradle, its HATCH OPEN toward the corridor with the lit cabin
//    interior visible through it. The fleeing player runs down the corridor + straight up to the
//    open hatch; enterPod then plays a scripted climb-IN (no teleport). Everything here is at/
//    outside the −X wall over BAY_Z0..BAY_Z1 (the structural −X wall + wall-finish skip that span,
//    §buildCorridor); the walkable tube envelope + the +X wall + the collider set are unchanged.
//    The bay is placed near the mouth (bridge end) so it's the first thing the fleeing eye meets.
const BAY_Z0 = 3.2;           // bay opening start (local z) — just aft of the corridor mouth
const BAY_Z1 = 6.4;           // bay opening end (local z) — a ~3.2m airlock frame
const BAY_ZC = (BAY_Z0 + BAY_Z1) / 2;   // 4.8 — bay centre (the docked pod's local z)
const BAY_RECESS = 2.9;       // how far the bay alcove recesses into −X off the wall (room for the 2.88m pod)
// The docked pod stands vertically on its heat-shield in the bay, its body axis +Y, offset into
// the recess; its HATCH faces +X (toward the corridor centreline / the arriving player). The pod
// LOCAL frame's hatch (HATCH_AZ on the cabin, +Z-forward capsule) is rotated to face +X here.
const BAY_POD_X = -(COR_HW + BAY_RECESS * 0.52);   // pod centre X (well into the −X recess)
// Is a corridor-wall emission on the −X wall inside the bay opening span? (so buildCorridor
// SKIPS the −X structural wall + finish panels there, revealing the docked pod in the alcove).
function _inBayGap(z: number): boolean { return z > BAY_Z0 - 0.05 && z < BAY_Z1 + 0.05; }

// ── Static-collider specs for the CORRIDOR walkable shell (WYSIWYG — the KCC walks these). These
//    are BYTE-IDENTICAL to the old greybox CORRIDOR_SPECS so collision + flow are unchanged.
const CORRIDOR_COLLIDERS: ReadonlyArray<BoxSpec> = [
  [2, 0.2, 12, 0, -0.1, 8.6],   // corridor floor  (top y=0)
  [2, 0.2, 12, 0, 2.5, 8.6],    // corridor ceiling (underside y=2.4)
  [0.2, 2.4, 12, 1.1, 1.2, 8.6], // +X wall (inner face x=1.0)
  [0.2, 2.4, 12, -1.1, 1.2, 8.6],// −X wall (inner face x=−1.0)
  [2, 2.4, 0.2, 0, 1.2, 14.7],   // dead-end bulkhead (inner face z=14.6 — the disaster trigger)
];

// ── Static-collider specs for the COCKPIT walkable shell (WYSIWYG — the KCC walks these),
//    matching the OLD greybox shell exactly so collision + flow are byte-identical.
const COCKPIT_COLLIDERS: ReadonlyArray<BoxSpec> = [
  [6, 0.2, 5, 0, -0.1, 0],         // floor
  [6, 0.2, 5, 0, 3.1, 0],          // ceiling
  [0.2, 3, 5, 3.1, 1.5, 0],        // +X wall
  [0.2, 3, 5, -3.1, 1.5, 0],       // −X wall
  [6, 0.9, 0.2, 0, 0.45, -2.6],    // below window
  [6, 0.5, 0.2, 0, 2.75, -2.6],    // above window
  [1.5, 1.6, 0.2, -2.25, 1.7, -2.6], // left of window
  [1.5, 1.6, 0.2, 2.25, 1.7, -2.6],  // right of window
  [2, 3, 0.2, -2, 1.5, 2.6],       // left of corridor opening
  [2, 3, 0.2, 2, 1.5, 2.6],        // right of corridor opening
  [2, 0.6, 0.2, 0, 2.7, 2.6],      // above corridor opening
];

let shipGroup: THREE.Group | null = null;
const shipBodies: RAPIER.RigidBody[] = [];
const _disposables: THREE.BufferGeometry[] = [];
const _buildMats: THREE.Material[] = [];
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
let _engineFireLight: THREE.PointLight | null = null;   // the real flickering light the blaze casts up the corridor
let _shipAlertLevel: 0 | 2 = 0;
// ── R5b — the corridor is now LIT metal (not unlit greybox), so setShipAlert drives REAL lights,
//    not a material tint: the normal recessed fixtures + fill DROP toward dark, and the corridor's
//    own RED strip-lights + a pulsing beacon fire. Refs captured at build, restored on level 0.
const _corrNormalLights: THREE.Light[] = [];       // recessed can-lights + fill — dimmed on alert
const _corrLensMats: THREE.MeshBasicMaterial[] = [];    // the warm fixture lenses — cut on alert
const _corrRedStripMats: THREE.MeshBasicMaterial[] = []; // wall/ceiling red channel strips — dark→red
let _corrRedLight: THREE.PointLight | null = null;      // a pulsing red flood down the corridor on alert
let _corrRedLight2: THREE.PointLight | null = null;     // a second red source (mid-corridor) for even wash

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
/** A small flush dome rivet stud (a half-sphere) at (x,y,z), domed toward `faceDir`. */
function _stud(x: number, y: number, z: number, faceDir: THREE.Vector3, mat: THREE.Material, r = 0.018): THREE.Mesh {
  const g = new THREE.SphereGeometry(r, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2);
  _disposables.push(g);
  const m = new THREE.Mesh(g, mat);
  m.position.set(x, y, z);
  m.lookAt(x + faceDir.x, y + faceDir.y, z + faceDir.z);
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

// ── COCKPIT SHELL — REBUILD v2 R5a: NO LONGER A BOX. A lofted, ribbed, VAULTED fuselage shell:
//    a flat walkable deck, side walls that CANT inward to a vaulted/ribbed roof (structural hoop
//    frames arc over the cabin), the cross-section TAPERING to the nose, and a RAKED faceted
//    windscreen forward. The OLD collider box (COCKPIT_COLLIDERS) is unchanged — the curved skin
//    lives at/outside that envelope above waist height (unreachable corners), the deck + the aft
//    doorway stay WYSIWYG so the walk + corridor join are byte-identical.
function buildCockpitShell(group: THREE.Group): void {
  // FLOOR — sub-floor + bright deck plate + a worn CENTRE traffic lane + tread strips + rivets.
  const floor = _box(CK_W, WALL_T, CK_D, _channel);
  floor.position.set(0, -WALL_T / 2, 0);
  group.add(floor);
  const deck = _box(CK_W - 0.06, 0.04, CK_D - 0.06, _deck);
  deck.position.set(0, 0.02, 0);
  group.add(deck);
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
  //    hullProfile() cross-section along Z from the nose (−Z) to the aft door wall (+Z): the
  //    walls cant inward, the roof vaults, the whole cross-section narrows to the nose. Built as
  //    a triangle-soup skin per side (mirrored), DOUBLE-skinned (a darker outer shell behind a
  //    lit inner skin) so torn edges never read paper-thin. The aft 0.4m is left flat (the door
  //    wall owns it). The deck stays flat below the profile foot.
  const SECZ: number[] = [];
  const segZ = 10;
  for (let s = 0; s <= segZ; s++) SECZ.push(THREE.MathUtils.lerp(-CK_Z + 0.02, CK_Z - 0.42, s / segZ));
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
  const ribDefs: [number, boolean][] = [[-2.0, false], [-0.9, true], [0.2, false], [1.3, true], [2.2, false]];
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
  // KEEL STRINGER along the crown (fore-aft) — ties the ribs together overhead.
  const stringer = _box(0.08, 0.10, CK_D - 0.5, _steel);
  stringer.position.set(0, HULL_CROWN_MAX - 0.05, 0.0);
  group.add(stringer);
  for (let i = -2; i <= 2; i++) group.add(_stud(0, HULL_CROWN_MAX - 0.10, i * 0.9, new THREE.Vector3(0, -1, 0), _rivet, 0.014));

  // ── A lowered forward SOFFIT brow — a deep canted header dropping over the windscreen top
  //    (brings the overhead IN over the seated pilot + frames the canopy from above). Canted to
  //    follow the windscreen rake.
  const down = new THREE.Vector3(0, -1, 0);
  const soffit = _box(CK_W - 0.7, 0.42, 0.5, _steel);
  soffit.position.set(0, 2.46, -CK_Z + 0.62);
  soffit.rotation.x = 0.35;
  group.add(soffit);
  for (let i = -2; i <= 2; i++) group.add(_stud(i * 0.95, 2.30, -CK_Z + 0.42, down, _rivet, 0.016));

  // ── OVERHEAD SWITCH PANEL — the cockpit "roof console": a canted instrument panel hanging off
  //    the soffit brow into the pilot's upper view (wraps the pilot in instruments — a key
  //    cockpit-vs-room tell). Toggle-guard rows + a couple of lit telltales + a placard.
  const ohY = 2.34, ohZ = -CK_Z + 0.95;
  const ohPanel = _box(1.5, 0.06, 0.42, _channel);
  ohPanel.position.set(0, ohY, ohZ);
  ohPanel.rotation.x = -0.62;          // faces down-aft toward the seated pilot's eyes
  group.add(ohPanel);
  const ohFace = _box(1.42, 0.02, 0.36, _band);
  ohFace.position.set(0, ohY - 0.04, ohZ + 0.04);
  ohFace.rotation.x = -0.62;
  group.add(ohFace);
  // guarded toggle rows
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 6; c++) {
      const sw = _cyl(0.011, 0.011, 0.05, 6, _rivet);
      sw.rotation.x = -0.62 - 0.35;
      sw.position.set(-0.55 + c * 0.22, ohY - 0.06 - r * 0.02, ohZ - 0.06 + r * 0.13);
      group.add(sw);
    }
    const guard = _box(1.36, 0.015, 0.02, _steel);
    guard.position.set(0, ohY - 0.02 - r * 0.02, ohZ - 0.10 + r * 0.13);
    guard.rotation.x = -0.62;
    group.add(guard);
  }
  // a few lit telltales on the overhead (calm green/amber)
  const ohLeds = [_ledGreen, _ledAmber, _ledGreen, _ledBlue];
  for (let i = 0; i < 4; i++) {
    const led = _cyl(0.016, 0.016, 0.02, 8, ohLeds[i]);
    led.rotation.x = -0.62 + Math.PI / 2;
    led.position.set(-0.30 + i * 0.20, ohY - 0.10, ohZ + 0.14);
    group.add(led);
  }
  const ohPlac = _box(0.4, 0.005, 0.07, _hazard);
  ohPlac.position.set(0.5, ohY - 0.09, ohZ + 0.10);
  ohPlac.rotation.x = -0.62;
  group.add(ohPlac);

  // ── SIDE-WALL detailing on the canted lower wall (waist rail + kickplate + placard + panel
  //    lines), riding the now-canted profile so it reads as hull detail, not flat-wall trim.
  for (const sx of [-1, 1]) {
    const inward = new THREE.Vector3(-sx, 0, 0);
    const wallX = sx * (CK_X - 0.04);
    // panel-line breakup on the lower vertical wall
    for (const pz of [-1.0, 0.8]) {
      const pv = _box(0.012, 1.4, 0.018, _channel);
      pv.position.set(sx * (CK_X - 0.05), 0.75, pz);
      group.add(pv);
    }
    // a proud waist rail at the shoulder line (where the wall starts to cant — reads the chine)
    const rail = _box(0.09, 0.14, CK_D - 0.7, _band);
    rail.position.set(sx * (CK_X - 0.10), 1.5, 0.1);
    group.add(rail);
    for (let k = 0; k < 6; k++) group.add(_stud(sx * (CK_X - 0.05), 1.5, -1.5 + k * 0.6, inward, _rivet, 0.015));
    // kickplate skirt at the floor
    const kick = _box(0.05, 0.26, CK_D - 0.4, _steel);
    kick.position.set(wallX, 0.13, 0.1);
    group.add(kick);
    // a stencilled hazard placard on the lower wall (a lived-in warning decal)
    const plac = _box(0.005, 0.16, 0.30, _hazard);
    plac.position.set(sx * (CK_X - 0.06), 1.0, 1.3);
    group.add(plac);
    const placTxt = _box(0.006, 0.05, 0.22, _decal);
    placTxt.position.set(sx * (CK_X - 0.062), 0.96, 1.3);
    group.add(placTxt);
  }

  // ── FORWARD RAKED WINDSCREEN / CANOPY (the focal point — NOT a flat wall with a hole). The
  //    glass RAKES BACK from a low sill up toward the soffit brow, faceted into a lower + upper
  //    pane, divided + framed by structural canopy spars that sweep up. Below the sill is solid
  //    hull (the dash sits against it); the canted cheek panels close the sides. The orbit view
  //    (the planet) reads through the raked glass.
  const fwZ = -CK_Z + 0.02;
  const fwdIn = new THREE.Vector3(0, 0, 1);
  // sill hull below the windscreen (≥0.10m — rule #7; the dash sits against it)
  const sill = _box(CK_W - 0.4, WIN_Y0, 0.12, _shell);
  sill.position.set(0, WIN_Y0 / 2, fwZ + 0.02);
  group.add(sill);
  buildWindscreen(group, fwZ, fwdIn);

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
  const unit = _box(0.24, 0.16, 0.008, _hazard);    // a unit-number panel near the −X heavy rib
  unit.position.set(-(CK_X - 0.5), 1.7, -0.9);
  unit.rotation.y = 0.5;
  group.add(unit);
  const unitTxt = _box(0.16, 0.10, 0.004, _decal);
  unitTxt.position.set(-(CK_X - 0.52), 1.7, -0.88);
  unitTxt.rotation.y = 0.5;
  group.add(unitTxt);
}

/** The RAKED FACETED WINDSCREEN — the cockpit's focal point. The glazing rakes back from the
 *  low sill (y=WIN_Y0, z=fwZ) up + aft to the brow (y≈WIN_TOP_Y, z=fwZ+RAKE), split into a lower
 *  + upper pane by a horizontal transom; a central vertical mullion + raked side spars + a sill
 *  bar + brow bar frame it as a real canopy. Canted cheek panels close the sides. The orbit view
 *  reads through the angled glass. Verts are wound so glass faces the cabin. */
const WIN_TOP_Y = 2.55;            // the windscreen top (at the brow)
const WIN_RAKE = 0.92;             // how far aft (+Z) the top leans from the sill
const WIN_MIDY = 1.72;             // the transom split height
function _winZ(y: number): number {
  // the rake line: z grows with height from the sill up to the brow
  const t = THREE.MathUtils.clamp((y - WIN_Y0) / (WIN_TOP_Y - WIN_Y0), 0, 1);
  return -CK_Z + 0.02 + WIN_RAKE * t * t;   // eased so the lower pane is steeper, the top lies back
}
function _winHalfW(y: number): number {
  // the windscreen narrows toward the top (the canopy tapers up as well as the nose tapering)
  const t = (y - WIN_Y0) / (WIN_TOP_Y - WIN_Y0);
  return THREE.MathUtils.lerp(WIN_X + 0.05, WIN_X - 0.45, THREE.MathUtils.clamp(t, 0, 1));
}
function buildWindscreen(group: THREE.Group, fwZ: number, inward: THREE.Vector3): void {
  // ── the two faceted GLASS panes (lower steeper, upper raked back), each a thin angled slab.
  //    Real transmissive cool-tinted glass (envMap-reflective) + a faint reticle/smudge overlay so
  //    the pane reads as GLASS, not a hole (gate #5 — space was compositing behind like a void).
  const panes: [number, number][] = [[WIN_Y0 + 0.02, WIN_MIDY - 0.02], [WIN_MIDY + 0.02, WIN_TOP_Y - 0.02]];
  for (const [y0, y1] of panes) {
    const cy = (y0 + y1) / 2;
    const z0 = _winZ(y0), z1 = _winZ(y1);
    const h = Math.hypot(y1 - y0, z1 - z0);
    const w = 2 * Math.min(_winHalfW(y0), _winHalfW(y1)) - 0.06;
    const rake = -Math.atan2(z1 - z0, y1 - y0);
    const glass = _box(w, h, 0.025, _glass);
    glass.position.set(0, cy, (z0 + z1) / 2);
    glass.rotation.x = rake;
    group.add(glass);
    // a faint additive SMUDGE/dust film on the inner face (catches the cabin light → reads as a
    // real grimy pane the eye sits behind). Very low opacity so the orbit still reads through.
    const smGeo = new THREE.PlaneGeometry(w * 0.9, h * 0.8);
    _disposables.push(smGeo);
    const smMat = new THREE.MeshBasicMaterial({ color: 0x9fb4c4, transparent: true, opacity: 0.08, depthWrite: false });
    _buildMats.push(smMat);
    const smudge = new THREE.Mesh(smGeo, smMat);
    smudge.position.set(0, cy, (z0 + z1) / 2 + 0.02 * Math.cos(rake));
    smudge.rotation.x = rake;
    group.add(smudge);
    // ── R5a-r4 SEV-2 (UNANIMOUS): baked diagonal SPECULAR STREAKS on the inner pane face. ONE clear
    //    bright streak flips "hole" → "glass". Additive, cool-white, angled — a window-light reflection
    //    sliding across the canopy. Two streaks per pane (a wide soft one + a thin bright one), offset
    //    so the grazing WIDE 3/4 catches at least one. blending=Additive so it pops against the planet.
    for (const [sw, so, sx0, srot] of [[0.085, 0.42, -0.18, 0.62], [0.035, 0.62, 0.12, 0.55]] as [number, number, number, number][]) {
      const stGeo = new THREE.PlaneGeometry(sw, h * 1.18);
      _disposables.push(stGeo);
      const stMat = new THREE.MeshBasicMaterial({
        color: 0xcfe2f2, transparent: true, opacity: so, depthWrite: false, blending: THREE.AdditiveBlending,
      });
      _buildMats.push(stMat);
      const streak = new THREE.Mesh(stGeo, stMat);
      streak.position.set(w * sx0, cy, (z0 + z1) / 2 + 0.026 * Math.cos(rake));
      streak.rotation.x = rake;
      streak.rotation.z = srot;   // the diagonal slant of the reflection
      group.add(streak);
    }
    // faint dust GLOW pooled at the mullion joints (the corners of the pane catch dust)
    for (const dx of [-1, 1]) {
      const dGeo = new THREE.PlaneGeometry(w * 0.22, h * 0.3);
      _disposables.push(dGeo);
      const dMat = new THREE.MeshBasicMaterial({ color: 0xaebccb, transparent: true, opacity: 0.10, depthWrite: false, blending: THREE.AdditiveBlending });
      _buildMats.push(dMat);
      const dust = new THREE.Mesh(dGeo, dMat);
      dust.position.set(dx * w * 0.40, y0 + (y1 - y0) * 0.12, (z0 + z1) / 2 + 0.024 * Math.cos(rake));
      dust.rotation.x = rake;
      group.add(dust);
    }
  }
  // a faint HUD RETICLE etched on the lower pane (a thin green crosshair ring — diegetic avionics
  //   reflected in the glass; sells "you're looking THROUGH a cockpit canopy").
  const retY = WIN_Y0 + 0.5, retZ = _winZ(retY) + 0.03;
  const retMat = new THREE.MeshBasicMaterial({ color: 0x5fae73, transparent: true, opacity: 0.5, depthWrite: false });
  _buildMats.push(retMat);
  const ringGeo = new THREE.TorusGeometry(0.12, 0.004, 6, 20);
  _disposables.push(ringGeo);
  const ret = new THREE.Mesh(ringGeo, retMat);
  ret.position.set(0.0, retY, retZ);
  ret.rotation.x = -Math.atan2(_winZ(WIN_MIDY) - _winZ(WIN_Y0), WIN_MIDY - WIN_Y0) + Math.PI / 2;
  group.add(ret);
  for (const [tw, th] of [[0.18, 0.004], [0.004, 0.18]] as [number, number][]) {
    const tick = _box(tw, th, 0.002, retMat);
    tick.position.set(0.0, retY, retZ);
    tick.rotation.x = ret.rotation.x - Math.PI / 2;
    group.add(tick);
  }
  // ── SILL BAR (chunky, along the bottom of the glazing) + BROW BAR (along the top) + TRANSOM
  const sillBar = _box(2 * _winHalfW(WIN_Y0) + 0.14, 0.14, 0.20, _winFrame);
  sillBar.position.set(0, WIN_Y0, _winZ(WIN_Y0) + 0.02);
  group.add(sillBar);
  const browBar = _box(2 * _winHalfW(WIN_TOP_Y) + 0.14, 0.13, 0.20, _winFrame);
  browBar.position.set(0, WIN_TOP_Y, _winZ(WIN_TOP_Y));
  browBar.rotation.x = 0.5;
  group.add(browBar);
  const transom = _box(2 * _winHalfW(WIN_MIDY), 0.10, 0.15, _winFrame);
  transom.position.set(0, WIN_MIDY, _winZ(WIN_MIDY));
  transom.rotation.x = -0.35;
  group.add(transom);
  // ── NOSE-CAP ROOF FAIRING — closes the entire forward roof above the windscreen so there is NO
  //    dark void. Loft the UPPER arc (windscreen-top → crown) between a BROW ring (at the
  //    windscreen top edge, narrow, aft) and the FRONT hull ring (at z=−CK_Z, full crown). Both
  //    rings sampled as an arc from the windscreen-top corner up to the crown; the loft sweeps the
  //    fairing from aft-low to forward-high, capping the nose.
  const browZ = _winZ(WIN_TOP_Y);
  const frontProf = hullProfile(-CK_Z + 0.02);
  const ARC_N = 6;
  // brow ring arc: from (winHalfW(top), WIN_TOP_Y, browZ) sweeping in/up to (0, crown≈brow+0.2)
  const browRing = (side: number) => {
    const x0 = side * _winHalfW(WIN_TOP_Y), y0 = WIN_TOP_Y;
    const pts = [];
    for (let i = 0; i <= ARC_N; i++) {
      const a = (i / ARC_N) * (Math.PI / 2);
      pts.push({ x: x0 * Math.cos(a), y: y0 + 0.18 * Math.sin(a), z: browZ - 0.05 * Math.sin(a) });
    }
    return pts;
  };
  // front ring arc: the upper arc of the front hull profile (shoulder→crown), at z=−CK_Z
  const frontRing = (side: number) => {
    const upper = frontProf.slice(2);   // skip foot+shoulder; the arc above the shoulder
    return upper.map((p) => ({ x: side * p.x, y: p.y, z: -CK_Z + 0.02 }));
  };
  for (const side of [1, -1]) {
    const capV: number[] = [];
    const b = browRing(side), f = frontRing(side);
    const n = Math.min(b.length, f.length);
    for (let i = 0; i < n - 1; i++) {
      const a0 = b[i], a1 = b[i + 1], c0 = f[i], c1 = f[i + 1];
      if (side > 0) {
        capV.push(a0.x, a0.y, a0.z, c0.x, c0.y, c0.z, a1.x, a1.y, a1.z);
        capV.push(a1.x, a1.y, a1.z, c0.x, c0.y, c0.z, c1.x, c1.y, c1.z);
      } else {
        capV.push(a0.x, a0.y, a0.z, a1.x, a1.y, a1.z, c0.x, c0.y, c0.z);
        capV.push(a1.x, a1.y, a1.z, c1.x, c1.y, c1.z, c0.x, c0.y, c0.z);
      }
    }
    // SIDE GUSSET — close the wedge between the windscreen-top OUTER corner, the brow-ring base,
    //   and the front-ring shoulder. SUBDIVIDED into 3 tris (gate: the single oversized gusset was
    //   crease-popping) by inserting a midpoint along the brow→front edge.
    const wc = { x: side * (_winHalfW(WIN_TOP_Y) + 0.06), y: WIN_TOP_Y - 0.06, z: browZ };
    const br = b[0];
    const fr = f[0];
    const mid = { x: (br.x + fr.x) / 2, y: (br.y + fr.y) / 2, z: (br.z + fr.z) / 2 };
    const tri = (p: typeof wc, q: typeof wc, r: typeof wc) => {
      if (side > 0) capV.push(p.x, p.y, p.z, r.x, r.y, r.z, q.x, q.y, q.z);
      else capV.push(p.x, p.y, p.z, q.x, q.y, q.z, r.x, r.y, r.z);
    };
    tri(wc, br, mid);
    tri(wc, mid, fr);
    tri(br, fr, mid);
    group.add(_skin(capV, _ceil));
  }
  // ── BROW OVERLAP FASCIA — a slim opaque metal strip overlapping the windscreen-top edge ~12cm
  //    UP past the glass, sealing the top-center slit where the nose-cap meets the upper pane.
  const fascia = _box(2 * _winHalfW(WIN_TOP_Y) + 0.05, 0.16, 0.06, _winFrame);
  fascia.position.set(0, WIN_TOP_Y + 0.04, _winZ(WIN_TOP_Y) - 0.04);
  fascia.rotation.x = 0.5;
  group.add(fascia);
  // ── RAKED SIDE SPARS (the canopy A-pillars) + a CENTRE mullion, each following the rake line
  const spars: number[] = [-1, 0, 1];
  for (const sx of spars) {
    const segs = 6;
    for (let s = 0; s < segs; s++) {
      const ya = WIN_Y0 + (WIN_TOP_Y - WIN_Y0) * (s / segs);
      const yb = WIN_Y0 + (WIN_TOP_Y - WIN_Y0) * ((s + 1) / segs);
      const za = _winZ(ya), zb = _winZ(yb);
      const xa = sx * _winHalfW(ya), xb = sx * _winHalfW(yb);
      const mx = (xa + xb) / 2, my = (ya + yb) / 2, mz = (za + zb) / 2;
      const len = Math.hypot(xb - xa, yb - ya, zb - za) + 0.01;
      const bar = _box(sx === 0 ? 0.055 : 0.09, len, 0.13, _winFrame);
      bar.position.set(mx, my, mz);
      bar.rotation.x = -Math.atan2(zb - za, yb - ya);
      bar.rotation.z = Math.atan2(xb - xa, yb - ya);
      group.add(bar);
      // a GASKET retainer strip on the cabin face of each spar (frame depth + a real glazed look)
      const gasket = _box((sx === 0 ? 0.055 : 0.09) - 0.01, len, 0.03, _channel);
      gasket.position.set(mx, my, mz + 0.07);
      gasket.rotation.copy(bar.rotation);
      group.add(gasket);
      if (s % 2 === 0) group.add(_stud(mx, my, mz + 0.10, inward, _rivet, 0.015));
    }
  }
  // ── CANTED CHEEK panels — close the gap between the windscreen edge + the canted side wall
  //    (a triangle skin each side so there's hull, not a void, beside the glazing).
  for (const side of [1, -1]) {
    const cheek: number[] = [];
    const a = { x: side * _winHalfW(WIN_Y0), y: WIN_Y0, z: _winZ(WIN_Y0) };
    const b = { x: side * _winHalfW(WIN_TOP_Y), y: WIN_TOP_Y, z: _winZ(WIN_TOP_Y) };
    const prof0 = hullProfile(-CK_Z + 0.02);
    const c = { x: side * prof0[1].x, y: 1.55, z: -CK_Z + 0.02 };   // the shoulder of the front ring
    const d = { x: side * prof0[1].x, y: WIN_Y0, z: -CK_Z + 0.02 };
    if (side > 0) {
      cheek.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
      cheek.push(a.x, a.y, a.z, c.x, c.y, c.z, d.x, d.y, d.z);
    } else {
      cheek.push(a.x, a.y, a.z, c.x, c.y, c.z, b.x, b.y, b.z);
      cheek.push(a.x, a.y, a.z, d.x, d.y, d.z, c.x, c.y, c.z);
    }
    group.add(_skin(cheek, _shell));
  }
  // a stencilled placard low on the sill (lived-in)
  const plac = _box(0.30, 0.07, 0.012, _hazard);
  plac.position.set(-WIN_X + 0.30, WIN_Y0 + 0.10, fwZ + 0.05);
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
  const tunZ = afZ + 0.22;     // the reveal sits back inside the wall
  for (const sx of [-1, 1]) {
    const reveal = _box(0.14, DOOR_Y1, 0.55, _channel);   // side reveal (deep, dark)
    reveal.position.set(sx * (DOOR_X + 0.02), DOOR_Y1 / 2, tunZ);
    group.add(reveal);
  }
  const revHead = _box(2 * DOOR_X + 0.04, 0.16, 0.55, _channel);   // top reveal
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
 *  where the player spawns seated. Clearly reads as a chair in the WIDE 3/4 (gate #5). A
 *  noCollider decoration (the player rises through it), low-backed so it never blocks the aft
 *  walk lane. Steel pedestal → cracked-vinyl cushion + bolsters → a tall ribbed back +
 *  wings → a headrest → over-shoulder harness + lap buckle → ARMRESTS (the foreground the
 *  forward shot needs) carrying the throttle + a side stick. */
function buildPilotSeat(group: THREE.Group): void {
  const sz = SEAT_Z, sy = SEAT_Y;
  // ── PEDESTAL on a deck RAIL (a real seat track) + a gas-strut column + swivel collar.
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
  // ── CUSHION PAN — a contoured bucket (pan + a raised front lip + deep side bolsters). The pan
  //    is EXTENDED forward (a longer squab) so the knee-roll lip + bolster fronts intrude into the
  //    lower forward frustum (R5a-r3 SEV-1: the seat must show in the seated opening shot).
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
  // ── DEEP SIDE BOLSTERS — the bucket sides, EXTENDED forward + raised into tall front horns that
  //    flank the seated eye at the lower-left/right frame corners (the unmistakable "I'm sitting in
  //    a seat" foreground). Each = a long low bolster + a proud forward horn that rises up beside
  //    the pilot's hips/thighs into the POV.
  for (const sx of [-1, 1]) {
    const bolster = _box(0.15, 0.24, 0.64, _seat);      // deep side bolster (bucket side)
    bolster.position.set(sx * 0.29, sy + 0.09, sz - 0.06);
    group.add(bolster);
    // forward THIGH-BOLSTER (R5a-r4 SEV-1): symmetric dark-vinyl knee-bolsters brought UP + forward
    //   into the lower-LEFT/RIGHT corners of the FP frame, so the pilot reads as CRADLED between
    //   them. Raised crest (y≈0.92) lands in the lower corners; kept DARK so it reads as a bolster.
    // A compact DARK knee-bolster hugging the lower corner (the pilot reads as cradled). Kept
    //   smaller + rolled so its top face turns AWAY from the warm overhead key (no tan flat-top
    //   slab → it stays a dark bolster, not the warned "tan wedge"). The roll is OUTBOARD (top
    //   leans toward the side wall) so the lit face is the dark outer cheek, not the up-face.
    const horn = _box(0.16, 0.30, 0.38, _seatArm);   // R5a-r6: dedicated near-black cool matte (was _seatBack → read tan under the warm key)
    horn.position.set(sx * 0.38, sy + 0.16, sz - 0.28);
    horn.rotation.x = 0.10;
    horn.rotation.z = sx * -0.22;                      // crown rolls toward the pilot's centre
    group.add(horn);
    // a worn welt down the INNER crest (the only highlight — a thin sliver, not a slab)
    const hornWelt = _box(0.02, 0.30, 0.04, _seam);
    hornWelt.position.set(sx * 0.30, sy + 0.20, sz - 0.28);
    group.add(hornWelt);
    // a worn welt down the bolster crest
    const bWelt = _box(0.02, 0.03, 0.56, _seam);
    bWelt.position.set(sx * 0.355, sy + 0.18, sz - 0.10);
    group.add(bWelt);
  }
  // ── BACKREST — tall + raked, with a padded centre column flanked by bolsters + a head BOX.
  const back = _box(0.54, 0.96, 0.16, _seatBack);
  back.position.set(0, sy + 0.56, sz + 0.28);
  back.rotation.x = -0.18;
  group.add(back);
  const backPad = _box(0.34, 0.84, 0.07, _seat);    // the padded centre channel (darker vinyl)
  backPad.position.set(0, sy + 0.56, sz + 0.37);
  backPad.rotation.x = -0.18;
  group.add(backPad);
  // CONTOUR QUILTING (R5a-r4 SEV-2): replace the even horizontal "drawer" seams with vinyl quilting
  //   that follows the seat form — VERTICAL channel seams splitting the centre pad into upholstered
  //   columns + just TWO horizontal lumbar bands. This never reads as a filing-cabinet's drawers.
  //   The rake (x=-0.18) is baked into every seam so they track the leaned backrest.
  const _rakeZ = (yLocal: number) => sz + 0.405 + (yLocal - (sy + 0.56)) * Math.tan(0.18);
  for (const vx of [-0.105, 0, 0.105]) {              // three vertical bolster/quilt channels
    const vs = _box(0.018, 0.80, 0.022, _seam);
    vs.position.set(vx, sy + 0.56, _rakeZ(sy + 0.56));
    vs.rotation.x = -0.18;
    group.add(vs);
  }
  for (const ly of [sy + 0.40, sy + 0.70]) {          // two horizontal lumbar bands (not 4 drawers)
    const ls = _box(0.30, 0.022, 0.02, _seam);
    ls.position.set(0, ly, _rakeZ(ly));
    ls.rotation.x = -0.18;
    group.add(ls);
  }
  for (const sx of [-1, 1]) {
    const wing = _box(0.12, 0.78, 0.26, _seatBack);      // shoulder wings (bucket sides)
    wing.position.set(sx * 0.29, sy + 0.54, sz + 0.24);
    wing.rotation.x = -0.18;
    group.add(wing);
    // a scuffed worn crest on each shoulder wing (where the pilot rubs through)
    const wingWorn = _box(0.07, 0.50, 0.07, _seatWorn);
    wingWorn.position.set(sx * 0.31, sy + 0.62, sz + 0.12);
    wingWorn.rotation.x = -0.18;
    group.add(wingWorn);
  }
  // a metal back FRAME (the seat shell shows its structure — not a soft box)
  const backFrame = _box(0.60, 1.0, 0.06, _steel);
  backFrame.position.set(0, sy + 0.56, sz + 0.235);
  backFrame.rotation.x = -0.18;
  group.add(backFrame);
  // ── AFT-FACE detail (R5a-r4 SEV-2): the back of the seat is what the DOOR shot sees. Break the
  //    smooth-crate read with TWO vertical channel seams, SHOULDER CUT-OUTS where the harness exits
  //    (slotted recesses near the top), + a stencilled PLACARD. The aft face sits ~z=sz+0.16 (the
  //    +Z side of the raked frame).
  // The seat back's DOOR-FACING face (the standing door camera sits at z≈sz-0.10 and looks +Z, so
  //   it sees the LOW-Z side of the backrest assembly ≈ z=sz+0.19, raking back with height). Detail
  //   must sit PROUD of THAT face (a hair toward -Z / the camera) or it hides on the far side.
  const aftZ = (yLocal: number) => sz + 0.19 + (yLocal - (sy + 0.56)) * Math.tan(0.18);
  for (const ax of [-0.15, 0.15]) {                   // two vertical channel seams down the door-facing face
    const ac = _box(0.035, 0.86, 0.05, _seatWorn);    // lighter worn welt → the seam reads as relief, not dark-on-dark
    ac.position.set(ax, sy + 0.52, aftZ(sy + 0.52) - 0.03);
    ac.rotation.x = -0.18;
    group.add(ac);
  }
  for (const sx of [-1, 1]) {                          // shoulder harness exit cut-outs (dark recessed slots)
    const slot = _box(0.10, 0.13, 0.05, _channel);
    slot.position.set(sx * 0.15, sy + 0.90, aftZ(sy + 0.90) - 0.02);
    slot.rotation.x = -0.18;
    group.add(slot);
    const slotWeb = _box(0.06, 0.05, 0.03, _strap);   // a stub of harness webbing poking through the slot
    slotWeb.position.set(sx * 0.15, sy + 0.86, aftZ(sy + 0.86) - 0.05);
    slotWeb.rotation.x = -0.18;
    group.add(slotWeb);
  }
  // a headrest BUMP proud of the door-facing face (so the silhouette isn't a flat crate top)
  const aftHead = _box(0.30, 0.20, 0.10, _seatBack);
  aftHead.position.set(0, sy + 1.06, aftZ(sy + 1.06) - 0.03);
  aftHead.rotation.x = -0.18;
  group.add(aftHead);
  const placard = _box(0.18, 0.12, 0.02, _decal);     // a stencilled placard on the door-facing face
  placard.position.set(0, sy + 0.32, aftZ(sy + 0.32) - 0.03);
  placard.rotation.x = -0.18;
  group.add(placard);
  const placTxt = _box(0.13, 0.05, 0.015, _hazard);   // a printed warn-stripe on the placard
  placTxt.position.set(0, sy + 0.33, aftZ(sy + 0.33) - 0.045);
  placTxt.rotation.x = -0.18;
  group.add(placTxt);
  // HEAD BOX — a real padded head restraint (≥10cm depth, rule #7), clearly SEPARATED from the
  //   backrest top by a gap + two steel guide posts (a distinct headrest, not a continuous slab).
  for (const sx of [-1, 1]) {
    const post = _box(0.03, 0.14, 0.03, _steel);
    post.position.set(sx * 0.10, sy + 0.96, sz + 0.40);
    post.rotation.x = -0.18;
    group.add(post);
  }
  const headRest = _box(0.34, 0.22, 0.18, _seatBack);
  headRest.position.set(0, sy + 1.10, sz + 0.44);
  headRest.rotation.x = -0.18;
  group.add(headRest);
  const headPad = _box(0.24, 0.16, 0.07, _seatWorn);
  headPad.position.set(0, sy + 1.10, sz + 0.53);
  headPad.rotation.x = -0.18;
  group.add(headPad);
  // ── ARMRESTS — reach FORWARD into the seated POV (the hands rest here); on steel posts, with
  //    control nubs; the right carries a side-stick. These + the harness MUST read in the forward
  //    frame (the player is seated). Brought up + forward so they sit in the lower POV.
  for (const sx of [-1, 1]) {
    const armPost = _box(0.08, 0.40, 0.08, _steel);
    armPost.position.set(sx * 0.37, sy + 0.20, sz - 0.04);
    group.add(armPost);
    // the armrest pad — raised + reaching forward so its tip lands in the lower-side forward frame.
    //   R5a-r6: the forward armrest forms are the #1 tan-wedge offender under the warm key → the
    //   dedicated near-black COOL matte _seatArm (was _seatBack/_seat, warm-tinted → lifted to tan).
    const arm = _box(0.13, 0.10, 0.60, _seatArm);
    arm.position.set(sx * 0.37, sy + 0.42, sz - 0.34);
    group.add(arm);
    const armPad = _box(0.14, 0.06, 0.40, _seatArm);    // DARK cool vinyl top (was _seat → still warmed
    armPad.position.set(sx * 0.37, sy + 0.48, sz - 0.40); //  to a tan wall in the close forward POV)
    group.add(armPad);
    const armWear = _box(0.06, 0.02, 0.30, _seatWorn);  // a THIN worn rub-stripe (a sliver, not a slab)
    armWear.position.set(sx * 0.37, sy + 0.515, sz - 0.42);
    group.add(armWear);
    // a control nub cluster on each armrest tip (lit telltales — a point of life)
    for (const nb of [-0.035, 0.035]) {
      const nub = _cyl(0.013, 0.013, 0.032, 6, sx < 0 ? _ledAmber : _ledGreen);
      nub.position.set(sx * 0.37 + nb, sy + 0.54, sz - 0.56);
      group.add(nub);
    }
  }
  // RIGHT side-stick (a control grip rising off the right armrest — "hands on the controls"); it
  //   rises into the lower-right of the forward frame (the freighter pilot's stick).
  const stickBase = _box(0.12, 0.08, 0.14, _channel);
  stickBase.position.set(0.37, sy + 0.54, sz - 0.58);
  group.add(stickBase);
  const stick = _cyl(0.026, 0.034, 0.24, 8, _steel);
  stick.position.set(0.37, sy + 0.66, sz - 0.60);
  stick.rotation.x = -0.25;
  group.add(stick);
  const grip = _cyl(0.047, 0.052, 0.12, 10, _cable);
  grip.position.set(0.37, sy + 0.78, sz - 0.63);
  grip.rotation.x = -0.25;
  group.add(grip);
  const trigger = _box(0.04, 0.03, 0.02, _ledAmber);
  trigger.position.set(0.37, sy + 0.78, sz - 0.56);
  group.add(trigger);
  // ── 5-POINT HARNESS (R5a-r4 SEV-1, ASSERTIVE) — the defining "I am STRAPPED IN" token. The
  //    seated eye is at LOCAL (0, 1.35, sz+0.1=-0.45), 78° FOV, pitched a hair UP. The forward
  //    frame's lower-center third sits at roughly local y≈1.10, z≈-0.90 (~0.45m ahead of the
  //    eye). So: a CHUNKY central quick-release buckle parked DEAD-CENTER-LOW there, with two
  //    over-shoulder straps converging from the upper-outer shoulders into it (a clear V/Y in the
  //    lower-center), plus lap belts out to the bolsters. The shoulder ANCHORS are kept outboard
  //    (x≈±0.27) + at shoulder height (y≈1.34) + slightly behind the eye (z≈-0.30) so the straps
  //    stay diagonal bands in the lower periphery — a chunky buckle low + THIN straps converging
  //    reads as "harness", NOT a tan wall. A small helper lays a webbing box between two points.
  const _webBetween = (ax: number, ay: number, az: number, bx: number, by: number, bz: number, w: number, mat: THREE.Material, thick = 0.035) => {
    const dx = bx - ax, dy = by - ay, dz = bz - az;
    const len = Math.hypot(dx, dy, dz);
    const strap = _box(w, len, thick, mat);
    strap.position.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2);
    // orient the box's +Y (length) axis along (dx,dy,dz)
    const up = new THREE.Vector3(0, 1, 0);
    const dir = new THREE.Vector3(dx, dy, dz).normalize();
    strap.quaternion.setFromUnitVectors(up, dir);
    group.add(strap);
    return strap;
  };
  // The central CHEST BUCKLE — dead-center, parked in the lower-center third of the forward frame.
  //   bkY=1.12, bkZ=-0.92 → ~0.45m ahead + ~0.23m below the eye → lands ~15-20% up from the bottom
  //   edge, centered. Palm-sized in frame.
  // R5a-r7 (the recurring "does it read as strapped-in?" concern, re-judged on the FAITHFUL frame):
  //   the debug-probe proved the buckle at y=1.15 projected at the very BOTTOM EDGE (half off-frame) of
  //   the real seated forward gaze (eye y≈1.35, pitch −0.03 ≈ level) — so the "5-point center buckle"
  //   the whole harness reads off was falling out of shot. RAISE it to y≈1.26 so it lands ~18% up from
  //   the bottom, dead-center, with the shoulder-strap V converging INTO frame above it. Pull it a hair
  //   CLOSER (−0.90→−0.86) so it's palm-sized + unmistakable in the lower-center third.
  //   (r7: after the eye-facing fix the plate READS — but at bkY 1.34/bkZ −0.86 it ballooned to a wall
  //   that occluded the planet vista. Settle at bkY 1.30 + push it back to bkZ −0.98 so it's palm-sized:
  //   clearly a 5-point chest buckle low-center, with the window/vista reading OVER it.)
  const bkX = 0, bkY = 1.30, bkZ = -0.98;
  for (const sx of [-1, 1]) {
    // OVER-SHOULDER strap: from high + outboard (shoulder height, behind the eye), descending
    //   down-forward-INWARD onto the buckle → a clear thick diagonal converging into the lower-center.
    // R5a-r6: anchor pulled OUTBOARD + BACK (0.34→0.40 x, -0.26→-0.18 z) so the strap starts further
    //   from the near-eye plane + NARROWED (0.055→0.038) → it reads as a thin diagonal harness band,
    //   not the near-eye tan wedge it foreshortened into. The buckle stays the read.
    const shAx = sx * 0.40, shAy = 1.40, shAz = -0.18;
    _webBetween(shAx, shAy, shAz, bkX + sx * 0.05, bkY + 0.04, bkZ, 0.038, _strap, 0.028);
    // a grimed wear band overlaid on the shoulder strap (breaks the flat webbing)
    _webBetween((shAx + bkX) / 2 + sx * 0.01, (shAy + bkY) / 2 + 0.02, (shAz + bkZ) / 2 - 0.006, bkX + sx * 0.05, bkY + 0.02, bkZ - 0.006, 0.020, _strapWorn, 0.020);
    // LAP strap: a THIN webbing band tucking from the buckle horizontally out to the hip (kept
    //   narrow + close so it reads as a belt, NOT a wide foreshortened slab — the "tan wedge" the
    //   wide version produced). Ends at the bolster inner edge, low + just below the buckle. R5a-r6:
    //   narrowed 0.05→0.036 to match the slimmed shoulder straps.
    _webBetween(bkX + sx * 0.05, bkY - 0.07, bkZ + 0.02, sx * 0.26, bkY - 0.16, sz - 0.18, 0.036, _strap, 0.028);
    // a steel adjuster slider partway down each shoulder strap (hardware detail)
    const slider = _box(0.09, 0.05, 0.05, _rivet);
    slider.position.set(sx * 0.16, (shAy + bkY) / 2 + 0.08, (shAz + bkZ) / 2 - 0.02);
    group.add(slider);
  }
  // the BUCKLE HOUSING — a chunky painted quick-release release-box, palm-sized in frame, catching
  //   light. A dark steel body → a bright rivet faceplate → a lit amber release tab + two latch
  //   slots, so it reads unmistakably as a 5-point center buckle, not a strap junction.
  const buckle = _box(0.20, 0.17, 0.12, _channel);
  buckle.position.set(bkX, bkY, bkZ);
  group.add(buckle);
  const buckleBevel = _box(0.21, 0.05, 0.13, _band);   // a top bevel rim catching the cabin key
  buckleBevel.position.set(bkX, bkY + 0.085, bkZ);
  group.add(buckleBevel);
  // R5a-r7 ROOT-CAUSE FIX — the faceplate + release tab + latches were on bkZ−0.07/−0.092, the −Z
  //   (WINDOW-facing) side of the housing → they faced AWAY from the seated pilot, who looks toward
  //   −Z and so saw only the dark _channel BACK of the buckle (dark-on-dark = the harness "vanished",
  //   the recurring concern). Move them to the +Z (EYE-facing) face so the pilot actually sees the
  //   bright brushed plate + the lit amber release, and the "5-point center buckle" reads.
  const bucklePlate = _box(0.155, 0.12, 0.04, _bucklePlate);  // self-lit brushed faceplate — now EYE-facing
  bucklePlate.position.set(bkX, bkY, bkZ + 0.07);
  group.add(bucklePlate);
  const buckleBtn = _box(0.085, 0.07, 0.03, _ledAmber); // a lit central release tab (a point of life)
  buckleBtn.position.set(bkX, bkY, bkZ + 0.092);
  group.add(buckleBtn);
  for (const lx of [-1, 1]) {                            // two latch slots flanking the release tab
    const latch = _box(0.022, 0.05, 0.03, _channel);
    latch.position.set(lx * 0.058, bkY, bkZ + 0.092);
    group.add(latch);
  }
}

/** The forward CONSOLE bank — the WRAP-AROUND dash right at the pilot's knees, below the
 *  window. A real instrument dash: a grouped centre cluster with the green ORBIT ACHIEVED CRT
 *  as the centrepiece, flanking bezeled backlit gauge dials, guarded switch banks, a throttle
 *  quadrant, labeled decals — clustered + dense (gate #7). A console wash + the CRT throw
 *  warm/green glow. setCockpitAlert recolors the screen + status + wash. */
function buildConsoleBank(group: THREE.Group): void {
  _alertStatusLeds = [];
  const conZ = CON_Z, deckY = CON_DECK_Y;
  const inward = new THREE.Vector3(0, 0, 1);
  // ── the wrap-around dash body (a wide low dash hugging the forward sill, wrapping toward
  //    the pilot at the ends so it reads as a station, not a flat counter)
  const body = _box(3.6, deckY, 0.78, _channel);
  body.position.set(0, deckY / 2, conZ);
  group.add(body);
  // wrap-around side wings angled toward the seat (close the station in around the pilot)
  for (const sx of [-1, 1]) {
    const wing = _box(0.5, deckY, 0.7, _channel);
    wing.position.set(sx * 1.7, deckY / 2, conZ + 0.5);
    wing.rotation.y = sx * 0.5;
    group.add(wing);
  }
  // bright seat-facing face panel + a kickplate + a seam rail + riveted access panels
  const face = _box(3.5, deckY - 0.06, 0.04, _band);
  face.position.set(0, deckY / 2, conZ + 0.38);
  group.add(face);
  const kick = _box(3.5, 0.16, 0.08, _steel);
  kick.position.set(0, 0.08, conZ + 0.37);
  group.add(kick);
  const seam = _box(3.5, 0.05, 0.05, _steel);
  seam.position.set(0, deckY * 0.55, conZ + 0.39);
  group.add(seam);
  for (const px of [-1.1, 1.1]) {
    const panel = _box(0.8, 0.34, 0.03, _shell);
    panel.position.set(px, deckY * 0.30, conZ + 0.39);
    group.add(panel);
    for (const cxp of [-0.36, 0.36]) for (const cyp of [-0.14, 0.14]) {
      group.add(_stud(px + cxp, deckY * 0.30 + cyp, conZ + 0.41, inward, _rivet, 0.013));
    }
  }
  // a small stencilled panel label on the dash face
  const lbl = _box(0.5, 0.05, 0.006, _decal);
  lbl.position.set(0, deckY * 0.30, conZ + 0.41);
  group.add(lbl);
  // ── canted instrument deck (the top surface tilts up toward the seated pilot)
  const deck = _box(3.6, 0.06, 0.72, _steel);
  deck.position.set(0, deckY + 0.04, conZ);
  deck.rotation.x = -0.55;
  group.add(deck);
  for (let i = -3; i <= 3; i++) group.add(_stud(i * 0.48, deckY + 0.02, conZ + 0.30, inward, _rivet, 0.015));

  // ── THE MAIN MFD — a recessed multi-line display in a real beveled bezel housing, set
  //    OFF-CENTRE to the LEFT (kills the symmetric "mouth"). Hooded body + a recessed dark glass
  //    face + green emissive content (a horizon bar + nav glyphs + scrolling readout lines) + a
  //    CRT scanline overlay. setCockpitAlert flips it red.
  const CANT = -0.80;                       // tilted up toward the seated pilot (reads as a screen)
  const mfdX = -0.55;                        // OFF-CENTRE left (asymmetry — anti-face)
  const scrCY = deckY + 0.20, scrZ = conZ + 0.04;
  // recessed housing (a deep bezel box the screen sits INSIDE)
  const housing = _box(1.06, 0.62, 0.16, _channel);
  housing.position.set(mfdX, scrCY, scrZ - 0.02);
  housing.rotation.x = CANT;
  group.add(housing);
  const bezel = _box(0.98, 0.54, 0.06, _steel);   // a proud bezel frame around the glass
  bezel.position.set(mfdX, scrCY, scrZ + 0.05);
  bezel.rotation.x = CANT;
  group.add(bezel);
  // the recessed glass face (sits BACK inside the bezel → real depth)
  const faceGlass = _box(0.82, 0.40, 0.015, _screenGlass);
  faceGlass.position.set(mfdX, scrCY, scrZ + 0.035);
  faceGlass.rotation.x = CANT;
  group.add(faceGlass);
  // the emissive CONTENT layer (the lit screen base — recolored by setCockpitAlert)
  const glowGeo = new THREE.PlaneGeometry(0.80, 0.38);
  _disposables.push(glowGeo);
  const glowMat = new THREE.MeshBasicMaterial({ color: 0x163a1c });   // dim green CRT base (calm)
  _buildMats.push(glowMat);
  const scrGlow = new THREE.Mesh(glowGeo, glowMat);
  scrGlow.position.set(mfdX, scrCY, scrZ + 0.04);
  scrGlow.rotation.x = CANT;
  group.add(scrGlow);
  _alertScreenGlow = scrGlow;
  // a HORIZON bar + nav glyph block (UI content — reads as a real avionics page)
  const horizGeo = new THREE.PlaneGeometry(0.6, 0.02);
  _disposables.push(horizGeo);
  const brightGreen = new THREE.MeshBasicMaterial({ color: 0x8cf29a });
  _buildMats.push(brightGreen);
  const horiz = new THREE.Mesh(horizGeo, brightGreen);
  horiz.position.set(mfdX, scrCY + 0.02, scrZ + 0.045);
  horiz.rotation.set(CANT, 0, 0.06);   // a slightly banked horizon line
  group.add(horiz);
  _alertStatusLeds.push(horiz);
  // scrolling readout lines (varying widths — real text, not even dots)
  const lineGeo = new THREE.PlaneGeometry(0.62, 0.035);
  _disposables.push(lineGeo);
  for (let r = 0; r < 4; r++) {
    const line = new THREE.Mesh(lineGeo, brightGreen);
    const w = [0.95, 0.5, 0.72, 0.38][r];
    line.scale.x = w;
    const dy = -0.05 - r * 0.058;
    line.position.set(mfdX - 0.28 * (1 - w), scrCY + dy * Math.cos(CANT), scrZ + 0.045 + dy * -Math.sin(CANT));
    line.rotation.x = CANT;
    group.add(line);
    _alertStatusLeds.push(line);
  }
  // CRT scanline overlay (faint dark stripes → the screen reads as a real CRT, not a flat quad)
  const scanGeo = new THREE.PlaneGeometry(0.80, 0.004);
  _disposables.push(scanGeo);
  const scanMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32 });
  _buildMats.push(scanMat);
  for (let s = 0; s < 9; s++) {
    const sl = new THREE.Mesh(scanGeo, scanMat);
    const dy = 0.16 - s * 0.04;
    sl.position.set(mfdX, scrCY + dy * Math.cos(CANT), scrZ + 0.046 + dy * -Math.sin(CANT));
    sl.rotation.x = CANT;
    group.add(sl);
  }

  // ── A SECOND raised SCREEN TIER to the RIGHT (asymmetric — a smaller amber data readout in its
  //    own bezel, set higher + at a different angle than the main MFD → no mirror symmetry).
  const mfd2X = 0.78, mfd2Y = deckY + 0.30;
  const housing2 = _box(0.5, 0.42, 0.12, _channel);
  housing2.position.set(mfd2X, mfd2Y, conZ + 0.0);
  housing2.rotation.set(CANT + 0.15, -0.25, 0);
  group.add(housing2);
  const face2Geo = new THREE.PlaneGeometry(0.38, 0.30);
  _disposables.push(face2Geo);
  const amberScr = new THREE.MeshBasicMaterial({ color: 0x4a3208 });
  _buildMats.push(amberScr);
  const face2 = new THREE.Mesh(face2Geo, amberScr);
  face2.position.set(mfd2X - 0.04, mfd2Y, conZ + 0.07);
  face2.rotation.set(CANT + 0.15, -0.25, 0);
  group.add(face2);
  for (let r = 0; r < 3; r++) {
    const l2Geo = new THREE.PlaneGeometry(0.3, 0.03);
    _disposables.push(l2Geo);
    const l2 = new THREE.Mesh(l2Geo, new THREE.MeshBasicMaterial({ color: 0xe0a040 }));
    _buildMats.push(l2.material as THREE.Material);
    l2.scale.x = [0.9, 0.6, 0.8][r];
    l2.position.set(mfd2X - 0.04, mfd2Y + 0.08 - r * 0.07, conZ + 0.075);
    l2.rotation.set(CANT + 0.15, -0.25, 0);
    group.add(l2);
  }

  // ── ASYMMETRIC GAUGE DIALS — a TIGHT cluster of THREE on the LEFT (different sizes), and just
  //    ONE big dial on the RIGHT (varying counts L≠R → no mirror = anti-face). Each recessed into
  //    a beveled socket with a lit face + needle.
  const dialSpec: [number, number][] = [[-1.35, 0.13], [-1.15, 0.10], [-1.02, 0.085], [1.18, 0.15]];
  for (const [dx, dr] of dialSpec) {
    const socket = _cyl(dr + 0.02, dr + 0.02, 0.06, 18, _channel);   // recessed socket
    socket.rotation.x = Math.PI / 2 + CANT;
    socket.position.set(dx, deckY + 0.20, conZ - 0.04);
    group.add(socket);
    const ring = _cyl(dr, dr, 0.04, 18, _band);   // bright bezel
    ring.rotation.x = Math.PI / 2 + CANT;
    ring.position.set(dx, deckY + 0.21, conZ - 0.02);
    group.add(ring);
    const fce = _cyl(dr * 0.78, dr * 0.78, 0.012, 18, _dialFace);   // lit face
    fce.rotation.x = Math.PI / 2 + CANT;
    fce.position.set(dx, deckY + 0.215, conZ - 0.01);
    group.add(fce);
    const needle = _box(dr * 0.7, 0.009, 0.005, _ledAmber);
    needle.position.set(dx, deckY + 0.22, conZ);
    needle.rotation.set(CANT, 0, dx < 0 ? 0.7 - dr : -0.5 + dr);
    group.add(needle);
  }
  // ── telltale LED status row — OFF-CENTRE + irregular spacing (anti-face: not a centered even row).
  //    R5a-r3 SEV-2 #3: each telltale now sits in a recessed bezel SOCKET (real ~1.5cm depth — a
  //    powered indicator, not a painted dot) + an irregular cluster (no centred even grille).
  const ledCols = [_ledGreen, _ledAmber, _ledGreen, _ledBlue, _ledGreen];
  const ledXs = [-0.30, -0.16, 0.02, 0.10, 0.24];
  const ledYs = [0.0, 0.02, -0.01, 0.03, 0.0];   // jitter the row vertically (kills the even line)
  for (let i = 0; i < ledCols.length; i++) {
    const socket = _cyl(0.026, 0.026, 0.03, 8, _channel);   // recessed bezel socket (depth)
    socket.rotation.x = Math.PI / 2 - 0.55;
    socket.position.set(0.15 + ledXs[i], deckY + 0.10 + ledYs[i], conZ + 0.255);
    group.add(socket);
    const led = _cyl(0.018, 0.018, 0.024, 8, ledCols[i]);
    led.rotation.x = Math.PI / 2 - 0.55;
    led.position.set(0.15 + ledXs[i], deckY + 0.105 + ledYs[i], conZ + 0.275);
    group.add(led);
  }
  // a small EMISSIVE label readout beside the telltales (a powered amber data strip — life)
  const readoutGeo = new THREE.PlaneGeometry(0.16, 0.03);
  _disposables.push(readoutGeo);
  const readoutMat = new THREE.MeshBasicMaterial({ color: 0xffb24a });
  _buildMats.push(readoutMat);
  const readout = new THREE.Mesh(readoutGeo, readoutMat);
  readout.rotation.x = -0.55;
  readout.position.set(-0.30, deckY + 0.085, conZ + 0.275);
  group.add(readout);
  // ── GUARDED switch banks — TWO on the LEFT-of-centre, ONE wide bank on the RIGHT (asymmetric).
  for (const [bankX, n] of [[-0.10, 4], [0.30, 2], [1.0, 3]] as [number, number][]) {
    const plate = _box(0.08 + n * 0.09, 0.02, 0.18, _band);
    plate.position.set(bankX, deckY + 0.10, conZ + 0.21);
    plate.rotation.x = -0.55;
    group.add(plate);
    for (let i = 0; i < n; i++) {
      const sw = _cyl(0.012, 0.012, 0.06, 6, _rivet);
      sw.rotation.x = -0.55 - 0.4;
      sw.position.set(bankX - (n - 1) * 0.045 + i * 0.09, deckY + 0.13, conZ + 0.19);
      group.add(sw);
    }
    const guard = _box(0.06 + n * 0.09, 0.02, 0.03, _steel);
    guard.position.set(bankX, deckY + 0.18, conZ + 0.15);
    guard.rotation.x = -0.55;
    group.add(guard);
  }
  // ── CENTRE THROTTLE QUADRANT (the freighter tell) — moved to the CENTRE-RIGHT, a chunky housing
  //    with twin levers (this breaks the centre, replacing the symmetric green "mouth").
  const throttleBase = _box(0.26, 0.10, 0.30, _steel);
  throttleBase.position.set(0.40, deckY + 0.07, conZ + 0.16);
  group.add(throttleBase);
  for (const tx of [-0.06, 0.06]) {
    const lever = _cyl(0.018, 0.024, 0.26, 8, _steel);
    lever.position.set(0.40 + tx, deckY + 0.19, conZ + 0.16);
    lever.rotation.x = -0.55;
    group.add(lever);
    const knob = _cyl(0.038, 0.038, 0.055, 10, _ledAmber);
    knob.position.set(0.40 + tx, deckY + 0.32, conZ + 0.27);
    group.add(knob);
  }
  // a grab-rail across the dash top edge (lived-in cockpit detail)
  const grab = _cyl(0.018, 0.018, 1.4, 8, _band);
  grab.rotation.z = Math.PI / 2;
  grab.position.set(-0.3, deckY + 0.02, conZ + 0.34);
  group.add(grab);
}

/** The 2-second PERSONAL TOUCH — the lone pilot's humanity, made recognizable (gate #6): a
 *  framed PHOTO propped on the dash, a chipped enamel MUG (cup + handle + rim + dark coffee
 *  surface), and a small TOKEN hanging on a cord off the window mullion. */
function buildPersonalTouch(group: THREE.Group): void {
  const conZ = CON_Z, deckY = CON_DECK_Y;
  // ── a framed PHOTO propped on the dash's left flat, canted toward the seat
  const photoMat = new THREE.MeshLambertMaterial({ color: 0xc9b890, flatShading: true });
  _buildMats.push(photoMat);
  const photo = _box(0.18, 0.23, 0.012, photoMat);
  photo.position.set(-0.62, deckY + 0.23, conZ + 0.16);
  photo.rotation.set(-0.45, 0.14, 0.03);
  group.add(photo);
  const frameTone = new THREE.MeshLambertMaterial({ color: 0x3e362c, flatShading: true });
  _buildMats.push(frameTone);
  const photoFrame = _box(0.22, 0.27, 0.022, frameTone);
  photoFrame.position.set(-0.62, deckY + 0.22, conZ + 0.155);
  photoFrame.rotation.set(-0.45, 0.14, 0.03);
  group.add(photoFrame);
  // a faded figure on the photo (a hint of a face — a pale oval) so it reads as a portrait
  const figMat = new THREE.MeshLambertMaterial({ color: 0x9a8a70, flatShading: true });
  _buildMats.push(figMat);
  const fig = _cyl(0.04, 0.04, 0.006, 10, figMat);
  fig.position.set(-0.62, deckY + 0.26, conZ + 0.17);
  fig.rotation.set(Math.PI / 2 - 0.45, 0, 0.03);
  group.add(fig);
  const stand = _box(0.06, 0.05, 0.12, frameTone);
  stand.position.set(-0.62, deckY + 0.07, conZ + 0.22);
  group.add(stand);
  // ── a chipped enamel MUG on the dash's right flat (body + interior + dark coffee + handle)
  const mugMat = new THREE.MeshLambertMaterial({ color: 0xb06a44, flatShading: true });
  _buildMats.push(mugMat);
  const mugBody = _cyl(0.05, 0.044, 0.11, 16, mugMat);
  mugBody.position.set(0.58, deckY + 0.12, conZ + 0.20);
  group.add(mugBody);
  const mugRim = _cyl(0.052, 0.052, 0.012, 16, _band);   // a bright chipped enamel rim
  mugRim.position.set(0.58, deckY + 0.175, conZ + 0.20);
  group.add(mugRim);
  const coffeeMat = new THREE.MeshLambertMaterial({ color: 0x2a1a0e, flatShading: true });
  _buildMats.push(coffeeMat);
  const coffee = _cyl(0.044, 0.044, 0.004, 16, coffeeMat);
  coffee.position.set(0.58, deckY + 0.172, conZ + 0.20);
  group.add(coffee);
  const mugGeo = new THREE.TorusGeometry(0.034, 0.01, 6, 12);
  _disposables.push(mugGeo);
  const mugHandle = new THREE.Mesh(mugGeo, mugMat);
  mugHandle.position.set(0.64, deckY + 0.12, conZ + 0.20);
  mugHandle.rotation.y = Math.PI / 2;
  group.add(mugHandle);
  // ── a TOKEN on a cord hung off the windscreen brow bar (a hanging charm), off-centre, in
  //    front of the raked glass so it dangles into the orbit view (the lone pilot's keepsake).
  const browZ = -CK_Z + 0.02 + WIN_RAKE * 0.85;   // near the brow rake, a hair into the cabin
  const cordMat = new THREE.MeshLambertMaterial({ color: 0x2a2620, flatShading: true });
  _buildMats.push(cordMat);
  const cord = _cyl(0.004, 0.004, 0.30, 5, cordMat);
  cord.position.set(0.35, 2.20, browZ - 0.10);
  group.add(cord);
  const tokenMat = new THREE.MeshLambertMaterial({ color: 0xc8a050, flatShading: true });
  _buildMats.push(tokenMat);
  const token = _cyl(0.035, 0.035, 0.008, 12, tokenMat);
  token.rotation.x = Math.PI / 2;
  token.position.set(0.35, 2.04, browZ - 0.10);
  group.add(token);
}

/** SIDE CONSOLES + clutter — short auxiliary consoles down the side walls (bring the space
 *  IN around the pilot — gate #10), conduit runs, an overhead grab rail, a stowed crate. */
function buildSideConsoles(group: THREE.Group): void {
  // ── ASYMMETRIC side-wall consoles (anti-face: the two flanking pods were reading as bright
  //    oval EYES). LEFT = a TALL angled instrument stack; RIGHT = a LOWER bench with a raised
  //    screen pod — different silhouettes + heights → the symmetry that drove the face is broken.
  // LEFT (−X): a taller console with a canted top deck of recessed readouts.
  {
    const sx = -1;
    const sc = _box(0.5, 0.95, 1.5, _channel);
    sc.position.set(sx * (CK_X - 0.32), 0.48, -0.25);
    group.add(sc);
    const scTop = _box(0.52, 0.06, 1.5, _steel);   // canted top (does NOT read as a flat oval)
    scTop.position.set(sx * (CK_X - 0.30), 0.98, -0.25);
    scTop.rotation.z = sx * 0.18;
    group.add(scTop);
    for (const cz of [-0.7, -0.3, 0.1, 0.5]) {
      const rd = _box(0.16, 0.012, 0.09, cz < 0 ? _ledGreen : _ledAmber);
      rd.position.set(sx * (CK_X - 0.30), 1.02, -0.25 + cz);
      rd.rotation.z = sx * 0.18;
      group.add(rd);
    }
    const haz = _box(0.02, 0.12, 1.3, _hazard);
    haz.position.set(sx * (CK_X - 0.58), 0.74, -0.25);
    group.add(haz);
  }
  // RIGHT (+X): a LOWER bench + a raised angled screen pod at the forward end (different mass).
  {
    const sx = 1;
    const sc = _box(0.5, 0.72, 1.5, _channel);
    sc.position.set(sx * (CK_X - 0.32), 0.36, -0.25);
    group.add(sc);
    const scTop = _box(0.52, 0.06, 1.5, _steel);
    scTop.position.set(sx * (CK_X - 0.32), 0.74, -0.25);
    group.add(scTop);
    // a raised angled screen pod (forward end) — gives this side a taller forward mass
    const pod = _box(0.46, 0.34, 0.4, _channel);
    pod.position.set(sx * (CK_X - 0.34), 0.94, -0.8);
    pod.rotation.x = -0.4;
    group.add(pod);
    const podScr = _box(0.34, 0.24, 0.02, _screenGlass);
    podScr.position.set(sx * (CK_X - 0.36), 0.98, -0.96);
    podScr.rotation.x = -0.4;
    group.add(podScr);
    const podGlow = _box(0.28, 0.18, 0.01, _ledAmber);
    podGlow.position.set(sx * (CK_X - 0.37), 0.98, -0.97);
    podGlow.rotation.x = -0.4;
    group.add(podGlow);
    const haz = _box(0.02, 0.10, 1.3, _hazard);
    haz.position.set(sx * (CK_X - 0.58), 0.56, -0.25);
    group.add(haz);
  }
  // conduit runs along the upper +X/−X wall (drooping bundles + clamps)
  for (const sx of [-1, 1]) {
    const conduit = _cyl(0.045, 0.045, CK_D - 0.6, 8, _cable);
    conduit.rotation.x = Math.PI / 2;
    conduit.position.set(sx * (CK_X - 0.16), CK_H - 0.30, 0.2);
    group.add(conduit);
    for (const cz of [-1.4, 0, 1.4]) {
      const clamp = _cyl(0.055, 0.055, 0.045, 8, _rivet);
      clamp.rotation.z = Math.PI / 2;
      clamp.position.set(sx * (CK_X - 0.13), CK_H - 0.30, cz + 0.2);
      group.add(clamp);
    }
  }
  // overhead grab rails on BOTH ribs (clear of the central lane) — lived-in handholds.
  for (const sx of [-1, 1]) {
    const railY = CK_H - 0.55;
    const grab = _cyl(0.026, 0.026, 1.0, 8, _band);
    grab.rotation.z = Math.PI / 2;
    grab.position.set(sx * (CK_X - 0.7), railY, sx > 0 ? 0.8 : 1.2);
    group.add(grab);
    for (const gz of [-0.42, 0.42]) {
      const standoff = _cyl(0.02, 0.02, 0.13, 6, _steel);
      standoff.position.set(sx * (CK_X - 0.7), railY + 0.06, (sx > 0 ? 0.8 : 1.2) + gz);
      group.add(standoff);
    }
  }
  // ── CABLE LOOMS — flex conduit bundles running the rib valleys + behind the console (lived-in).
  //    A drooping catenary-ish run per side (3 segment cylinders) + a couple of flex conduits down
  //    to the dash. Dark matte rubber (non-metal) → reads as cabling vs the brushed hull.
  for (const sx of [-1, 1]) {
    const runZ = [-1.4, 0.0, 1.4];
    for (let i = 0; i < runZ.length; i++) {
      const loom = _cyl(0.05, 0.05, 1.5, 7, _cable);
      loom.rotation.set(Math.PI / 2, 0, 0.04 * (i - 1));
      loom.position.set(sx * (CK_X - 0.5), 1.9 - 0.05 * Math.abs(i - 1), runZ[i]);
      group.add(loom);
    }
  }
  // a flex conduit dropping from the −X wall down behind the console
  const flex = _cyl(0.035, 0.035, 1.3, 7, _cable);
  flex.rotation.set(0.5, 0, 0.3);
  flex.position.set(-(CK_X - 0.55), 1.1, -1.0);
  group.add(flex);
  const flex2 = _cyl(0.03, 0.03, 1.0, 7, _cable);
  flex2.rotation.set(-0.4, 0, -0.4);
  flex2.position.set(CK_X - 0.6, 1.0, -0.9);
  group.add(flex2);
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
  const down = new THREE.Vector3(0, -1, 0);
  for (const fz of [-0.9, 0.7]) {
    const can = _cyl(0.13, 0.15, 0.10, 12, _channel);
    can.position.set(0, HULL_CROWN_MAX - 0.16, fz);
    group.add(can);
    const lens = _cyl(0.10, 0.10, 0.02, 12, _ledAmber);
    lens.position.set(0, HULL_CROWN_MAX - 0.22, fz);
    group.add(lens);
    // a cross cage bar under each
    const cage = _box(0.22, 0.012, 0.012, _steel);
    cage.position.set(0, HULL_CROWN_MAX - 0.24, fz);
    group.add(cage);
    void down;
  }
  // warm KEY at the FORWARD fixture — pulled DOWN + softened so it no longer blows the crown out.
  const key = new THREE.PointLight(0xffd0a0, 1.8, 5.2, 2.0);
  key.position.set(0.0, HULL_CROWN_MAX - 0.30, -0.7);
  group.add(key);
  _alertKeyLights.push(key);
  // a softer warm aft fill at the aft fixture (lights the corridor mouth + aft curve).
  const aft = new THREE.PointLight(0xffc488, 1.1, 4.8, 2.4);
  aft.position.set(0.0, HULL_CROWN_MAX - 0.30, 0.7);
  group.add(aft);
  _alertKeyLights.push(aft);
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
  const beaconCan = _cyl(0.07, 0.09, 0.06, 10, _channel);
  beaconCan.position.set(0, 2.34, -CK_Z + 1.0);
  group.add(beaconCan);
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0x2a0604 });   // dark dome (calm)
  _buildMats.push(beaconMat);
  const beaconGeo = new THREE.SphereGeometry(0.06, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  _disposables.push(beaconGeo);
  const beaconDome = new THREE.Mesh(beaconGeo, beaconMat);
  beaconDome.rotation.x = Math.PI;
  beaconDome.position.set(0, 2.32, -CK_Z + 1.0);
  group.add(beaconDome);
  _alertBeaconMesh = beaconDome;
  const beacon = new THREE.PointLight(0xff2010, 0.0, 5.5, 2.0);
  beacon.position.set(0, 2.25, -CK_Z + 1.0);
  group.add(beacon);
  _alertBeaconLight = beacon;
  // RIB STRIP-LIGHTS — thin emissive strips down two ribs (dark at level 0, hot red on alert →
  //   the alert reads as the SHIP's own warning lights firing, not a global tint).
  _alertStripMats = [];
  for (const rz of [-0.9, 1.3]) {
    const prof = hullProfile(rz);
    for (const side of [1, -1]) {
      for (let i = 2; i < prof.length - 1; i += 2) {
        const ax = side * prof[i].x, ay = prof[i].y;
        const bx = side * prof[i + 1].x, by = prof[i + 1].y;
        const mx = (ax + bx) / 2, my = (ay + by) / 2;
        const sm = new THREE.MeshBasicMaterial({ color: 0x1a0604 });
        _buildMats.push(sm);
        _alertStripMats.push(sm);
        const strip = _box(0.03, Math.hypot(bx - ax, by - ay), 0.02, sm);
        strip.position.set(mx, my, rz + 0.1);
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
  buildPodBay(group);   // R5c — the docked escape pod in its bay at the bridge end (the flee target + the physical enter)
  for (const [w, h, d, cx, cy, cz] of CORRIDOR_COLLIDERS) {
    const col = makeStaticBox(
      ctx.physics.world,
      { x: w / 2, y: h / 2, z: d / 2 },
      { x: SHIP_ORIGIN.x + cx, y: SHIP_ORIGIN.y + cy, z: SHIP_ORIGIN.z + cz },
    );
    const body = col.parent();
    if (body) shipBodies.push(body);
  }
  buildEngineBay(group);   // the engine-bay fire at the dead-end (hidden until the disaster)

  // ── COCKPIT walkable static colliders (WYSIWYG — match the shell surfaces). ──
  for (const [w, h, d, cx, cy, cz] of COCKPIT_COLLIDERS) {
    const col = makeStaticBox(
      ctx.physics.world,
      { x: w / 2, y: h / 2, z: d / 2 },
      { x: SHIP_ORIGIN.x + cx, y: SHIP_ORIGIN.y + cy, z: SHIP_ORIGIN.z + cz },
    );
    const body = col.parent();
    if (body) shipBodies.push(body);
  }

  group.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = false; o.receiveShadow = false; } });
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
    if (level === 0) m.color.setHex(0x163a1c);        // dim green CRT (calm)
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
  for (const sx of [1, -1]) {
    if (sx === -1) {
      // R5c — the −X structural wall is SPLIT around the pod-bay opening (BAY_Z0..BAY_Z1): a
      //   forward segment (mouth → bay) + an aft segment (bay → dead-end), so the bay alcove is a
      //   real gap in the hull revealing the docked pod (not a decal). The COLLIDER stays the full
      //   span (CORRIDOR_COLLIDERS unchanged) — the player never walks INTO the bay (the enter is
      //   scripted), so the invisible collider over the gap is correct WYSIWYG for the walk.
      const fwdLen = (BAY_Z0) - COR_Z0;
      const wf = _box(COR_WALL_T, COR_CH + 0.2, fwdLen, _shell);
      wf.position.set(-(COR_HW + COR_WALL_T / 2), COR_CH / 2, COR_Z0 + fwdLen / 2);
      group.add(wf);
      const aftLen = COR_Z1 - BAY_Z1;
      const wa = _box(COR_WALL_T, COR_CH + 0.2, aftLen, _shell);
      wa.position.set(-(COR_HW + COR_WALL_T / 2), COR_CH / 2, BAY_Z1 + aftLen / 2);
      group.add(wa);
      continue;
    }
    const wall = _box(COR_WALL_T, COR_CH + 0.2, COR_LEN, _shell);
    wall.position.set(sx * (COR_HW + COR_WALL_T / 2), COR_CH / 2, zc);
    group.add(wall);
  }
  // dead-end BULKHEAD (the disaster trigger wall) — a heavy riveted end-cap with a central
  //   engine-access hatch (the fire ruptures through it). Structural steel + a painted frame.
  const endWall = _box(2.4, COR_CH + 0.2, COR_WALL_T, _steel);
  endWall.position.set(0, COR_CH / 2, COR_Z1 + COR_WALL_T / 2 + 0.05);
  group.add(endWall);

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
  const ribZ = [3.4, 5.2, 7.0, 8.8, 10.6, 12.4, 14.1];
  for (let ri = 0; ri < ribZ.length; ri++) {
    const z = ribZ[ri];
    const hazard = ri % 2 === 1;
    const postMat = hazard ? _corrHazard : _steel;
    for (const sx of [1, -1]) {
      // vertical rib post proud of the wall
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
    // top cross-beam of the frame
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
  const seg: [number, number][] = [];   // [zStart, zEnd] gaps between ribs to panelize
  const bounds = [COR_Z0 + 0.15, ...ribZ.slice(0, -1).map((z, i) => (z + ribZ[i + 1]) / 2), COR_Z1 - 0.15];
  for (let i = 0; i < ribZ.length; i++) seg.push([i === 0 ? COR_Z0 + 0.15 : (ribZ[i - 1] + ribZ[i]) / 2, i === ribZ.length - 1 ? COR_Z1 - 0.15 : (ribZ[i] + ribZ[i + 1]) / 2]);
  void bounds;
  for (const sx of [1, -1]) {
    for (let si = 0; si < seg.length; si++) {
      const [z0, z1] = seg[si];
      const zmid = (z0 + z1) / 2, len = z1 - z0 - 0.14;
      if (len < 0.2) continue;
      if (sx === -1 && _inBayGap(zmid)) continue;   // R5c — skip −X wall-finish where the pod-bay opens
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
    [1, 1.68, 9.0, 0.30, 0.20],
    [-1, 1.6, 11.8, 0.4, 0.14],
  ];
  for (const [sx, py, pz, pw, ph] of placards) {
    if (sx === -1 && _inBayGap(pz)) continue;   // R5c — no placard floating over the pod-bay gap
    const back = _box(0.02, ph + 0.03, pw + 0.03, _decal);
    back.position.set(sx * (COR_HW - 0.052), py, pz);
    group.add(back);
    const face = _box(0.01, ph, pw, _corrPlacard);
    face.position.set(sx * (COR_HW - 0.058), py, pz);
    group.add(face);
  }
  // a big painted hull-number panel (a stencilled "block" near the mouth)
  const numBack = _box(0.02, 0.5, 0.5, _corrHazard);
  numBack.position.set(-(COR_HW - 0.055), 1.7, 3.0);
  group.add(numBack);
  const numFace = _box(0.01, 0.34, 0.34, _channel);
  numFace.position.set(-(COR_HW - 0.062), 1.7, 3.0);
  group.add(numFace);

  // ── CEILING RACEWAY + DUCTING — a central spine box (cable raceway) down the crown, flanked by a
  //    round duct run, so the ceiling isn't a flat lid. Sits ABOVE the walkable underside (y>2.4).
  const raceway = _box(0.5, 0.14, COR_LEN - 0.2, _steel);
  raceway.position.set(0, COR_CH - 0.07, zc);
  group.add(raceway);
  for (let z = COR_Z0 + 0.6; z < COR_Z1; z += 1.2) {
    const clamp = _box(0.56, 0.05, 0.06, _channel);
    clamp.position.set(0, COR_CH - 0.14, z);
    group.add(clamp);
  }
  // a fat round DUCT running along one shoulder of the ceiling (darker steel so it doesn't read
  //   as a bright pale pipe dominating the crown)
  const duct = _cyl(0.11, 0.11, COR_LEN - 0.3, 12, _steel);
  duct.rotation.x = Math.PI / 2;
  duct.position.set(0.66, COR_CH - 0.14, zc);
  group.add(duct);
  // duct support straps
  for (let z = COR_Z0 + 1.0; z < COR_Z1; z += 1.8) {
    const strap = _cyl(0.135, 0.135, 0.04, 12, _steel);
    strap.rotation.x = Math.PI / 2;
    strap.position.set(0.66, COR_CH - 0.14, z);
    group.add(strap);
  }

  // ── CONDUIT + CABLE-LOOM RUNS at BOTH wall/ceiling junctions (the "lived-in" greeble). A pair of
  //    parallel conduit pipes + a fat rubber cable loom, clamped at intervals, running the length.
  for (const sx of [1, -1]) {
    for (let ci = 0; ci < 2; ci++) {
      const cd = _cyl(0.035 + ci * 0.012, 0.035 + ci * 0.012, COR_LEN - 0.2, 8, ci === 0 ? _steel : _band);
      cd.rotation.x = Math.PI / 2;
      cd.position.set(sx * (COR_HW - 0.07 - ci * 0.1), COR_CH - 0.2 - ci * 0.14, zc);
      group.add(cd);
    }
    // the fat black cable loom, sagging slightly (a lower position, thicker, matte rubber)
    const loom = _cyl(0.06, 0.06, COR_LEN - 0.2, 8, _cable);
    loom.rotation.x = Math.PI / 2;
    loom.position.set(sx * (COR_HW - 0.05), COR_CH - 0.5, zc);
    group.add(loom);
    // clamps holding the runs to the wall
    for (let z = COR_Z0 + 0.55; z < COR_Z1; z += 0.9) {
      const clamp = _box(0.05, 0.06, 0.04, _channel);
      clamp.position.set(sx * (COR_HW - 0.05), COR_CH - 0.32, z);
      group.add(clamp);
    }
  }
  // a low PIPE run along the −X wall foot (a plumbing/coolant line, waist-low) — R5c: SPLIT around
  //   the pod-bay opening so it doesn't bar the docked-hatch view (a fwd stub + the aft run).
  for (const [pz0, pz1] of [[COR_Z0, BAY_Z0], [BAY_Z1, COR_Z1]] as const) {
    const plen = pz1 - pz0 - 0.2;
    if (plen < 0.2) continue;
    const pipe = _cyl(0.05, 0.05, plen, 10, _steel);
    pipe.rotation.x = Math.PI / 2;
    pipe.position.set(-(COR_HW - 0.08), 0.5, (pz0 + pz1) / 2);
    group.add(pipe);
  }
  for (let z = COR_Z0 + 0.7; z < COR_Z1; z += 1.4) {
    if (_inBayGap(z)) continue;   // R5c — no bracket over the bay gap
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
      // R5c — the −X grab-rail is SPLIT around the bay opening (it would otherwise bar the hatch).
      for (const [rz0, rz1] of [[COR_Z0 + 0.3, BAY_Z0], [BAY_Z1, COR_Z1 - 0.3]] as const) {
        const rlen = rz1 - rz0;
        if (rlen < 0.2) continue;
        const rail = _cyl(0.028, 0.028, rlen, 8, _corrRail);
        rail.rotation.x = Math.PI / 2;
        rail.position.set(-(COR_HW - 0.09), 1.15, (rz0 + rz1) / 2);
        group.add(rail);
      }
      for (let z = COR_Z0 + 0.7; z < COR_Z1; z += 2.0) {
        if (_inBayGap(z)) continue;
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
  const canZ = [3.6, 6.2, 8.8, 11.4, 13.8];
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
      if (sx === -1 && _inBayGap(z + 0.75)) continue;   // R5c — no red strip across the bay opening
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

// ── R5c — the ESCAPE-POD BAY + the DOCKED POD. Built into the −X alcove opened above (the
//    structural wall + finish skip BAY_Z0..BAY_Z1). This is what the fleeing player runs toward:
//    a hazard-framed airlock recess with the SAME size-matched riveted capsule (POD_R) they ride
//    down, standing on its heat-shield in a clamped cradle, HATCH OPEN toward the corridor with a
//    warm-lit cabin interior peek behind it. Everything is at/outside the −X wall line (x ≤ −COR_HW)
//    so the walkable tube + colliders are untouched. Warm bay-light spills back into the corridor.
// The pod's exterior identity mirrors buildHeroPodMesh (podScene) — a light cool-aluminium
//   riveted capsule with dark channel-steel bands/frames — but authored in the corridor's own
//   worn-gunmetal materials so the docked pod reads as part of THIS ship's bay (grimed, lit by the
//   bay's own lamps), not a desert-weathered wreck. The RIDDEN cabin (buildPodScene) is the same
//   vessel; enterPod builds it + carries the eye in.
const BAY_POD_R = 1.44;        // MATCH POD_R (podScene) — the 2.88m-diameter capsule the player rides
const BAY_POD_BASE_H = 0.34;   // heat-shield foot (matches POD_BASE_H)
const BAY_POD_BODY_H = 1.95;   // straight body (matches POD_BODY_H / the cabin WALL_H)
const BAY_POD_NOSE_H = 0.70;   // ogive nose (matches POD_NOSE_H)
// Docked-pod exterior materials: reuse the corridor's grimed gunmetal skin + hardware so the pod
//   reads as bay-lit ship hardware. A dedicated LIGHT band material so the capsule reads aluminium
//   (lighter than the dark hull walls) and its hatch reads as an opened bright plate.
const _bayPodSkin = _metal(0x8f9498, 0.36, 0.82, { flat: true, grime: true });   // light cool-aluminium capsule skin (roughened → no broad specular hotspot from the bay/hatch lamps)
const _bayPodHatch = _metal(0x939a9f, 0.38, 0.74, { flat: true, grime: true });  // opened hatch plate (a touch brighter than the body but not a bright slab that steals focus from the lit cabin)
const _bayCabinGlow = new THREE.MeshBasicMaterial({ color: 0x5a4126 });          // warm-lit cabin-interior peek (unlit → glows behind the open hatch, reads clearly LIT — the inviting "climb in here" light)
// R5-POLISH — the docked pod's REENTRY SCORCH: a vertex-coloured near-black char fading up the lower
//   body (mirrors buildHeroPodMesh's scorch identity so the bay pod reads as the SAME weathered
//   capsule). Vertex colours + a matte dark base material; a faint warm interior lamp material.
const _bayPodScorch = _metal(0xffffff, 0.30, 0.86, { flat: true });   // scorch shell — vertexColors drive the char→aluminium fade
_bayPodScorch.vertexColors = true;
// hazard ACCENT chevron paint — a saturated warn-yellow used ONLY as thin edge accents (bay-mouth
//   corners, clamp jaws), NOT the primary read. Worn matte so it takes the bay light like painted steel.
const _bayHazardAccent = _metal(0xc39a22, 0.28, 0.70, { flat: true, grime: true });
// umbilical hoses — dark ribbed rubber conduit (reuse the corridor cable idiom).
const _bayHose = _metal(0x1c1a1e, 0.10, 0.86, { flat: true });
// a brass/bronze coupling on the umbilicals + fuel line (a warm hardware pop vs the grey hull).
const _bayCoupling = _metal(0x6e5a34, 0.55, 0.55, { flat: true });
// airlock seal collar — a dark rubber gasket ring at the bay mouth (matte, non-metal).
const _baySeal = _metal(0x16151a, 0.06, 0.90, { flat: true });
let _bayGlowLight: THREE.PointLight | null = null;   // warm spill from the open hatch into the corridor
let _bayGroup: THREE.Group | null = null;            // the docked-pod group (release shudder rides this)

/** World-space position of the DOCKED pod's HATCH THRESHOLD — where the fleeing player ends up +
 *  the scripted climb-in starts (just outside the open hatch, on the corridor centre-ish). And the
 *  docked pod's SEATED-EYE target inside the cabin (where the climb-in lands). Both in world coords
 *  (SHIP_ORIGIN + local). Used by sequence.ts's enterPod climb-in. Null-safe values (constants). */
export function getPodBayThreshold(): THREE.Vector3 {
  // just corridor-side of the hatch, at standing eye height, centred on the bay z
  return new THREE.Vector3(SHIP_ORIGIN.x - COR_HW + 0.55, SHIP_ORIGIN.y + 1.62, SHIP_ORIGIN.z + BAY_ZC);
}
export function getPodBaySeatedEye(): THREE.Vector3 {
  // inside the docked cabin, at the seated eye (the pod interior peek centre) — the climb-in target
  return new THREE.Vector3(SHIP_ORIGIN.x + BAY_POD_X + 0.15, SHIP_ORIGIN.y + 1.34, SHIP_ORIGIN.z + BAY_ZC);
}

/** Build the escape-pod BAY alcove + the DOCKED pod at the bridge end (into the −X recess). */
function buildPodBay(group: THREE.Group): void {
  const bay = new THREE.Group();
  bay.name = 'escapePodBay';
  group.add(bay);
  const xNear = -COR_HW;                       // the corridor wall line (bay mouth)
  const xFar = -COR_HW - BAY_RECESS;           // the back of the recess
  const zc = BAY_ZC, halfZ = (BAY_Z1 - BAY_Z0) / 2;
  const up = new THREE.Vector3(0, 1, 0);

  // ── ALCOVE SHELL — floor / ceiling / back wall / end walls closing the recess (dark steel so torn
  //    edges never read thin; the pod + cradle sit in front). The near face is the open bay mouth.
  const bayFloor = _box(BAY_RECESS + 0.2, COR_WALL_T, (halfZ + 0.1) * 2, _channel);
  bayFloor.position.set((xNear + xFar) / 2, -COR_WALL_T / 2, zc);
  bay.add(bayFloor);
  const bayCeil = _box(BAY_RECESS + 0.2, COR_WALL_T, (halfZ + 0.1) * 2, _ceil);
  bayCeil.position.set((xNear + xFar) / 2, COR_CH + COR_WALL_T / 2, zc);
  bay.add(bayCeil);
  const bayBack = _box(COR_WALL_T, COR_CH + 0.2, (halfZ + 0.1) * 2, _shell);
  bayBack.position.set(xFar - COR_WALL_T / 2, COR_CH / 2, zc);
  bay.add(bayBack);
  for (const sz of [-1, 1]) {
    const end = _box(BAY_RECESS, COR_CH + 0.2, COR_WALL_T, _shell);
    end.position.set((xNear + xFar) / 2, COR_CH / 2, zc + sz * (halfZ + COR_WALL_T / 2));
    bay.add(end);
    // a ribbed frame on each end wall (the bay reads as a fabricated recess)
    const erib = _box(BAY_RECESS - 0.2, 0.14, 0.12, _steel);
    erib.position.set((xNear + xFar) / 2, COR_CH - 0.4, zc + sz * halfZ);
    bay.add(erib);
  }
  // bay floor tread + a rivet ring (a real deck under the pod)
  const bayDeck = _box(BAY_RECESS - 0.1, 0.04, (halfZ) * 2, _deck);
  bayDeck.position.set((xNear + xFar) / 2 - 0.05, 0.02, zc);
  bay.add(bayDeck);
  for (const bx of [xNear - 0.4, (xNear + xFar) / 2, xFar + 0.5]) for (const bz of [zc - halfZ + 0.4, zc, zc + halfZ - 0.4]) {
    bay.add(_stud(bx, 0.05, bz, up, _rivet, 0.016));
  }

  // ── AIRLOCK PORTAL FRAME around the mouth — a proud WORN-STEEL airlock collar (the primary read),
  //    with a rubber seal gasket ring, rivet rows, and only THIN hazard-chevron ACCENTS on the
  //    leading corners (the de-clutter: worn metal dominates, yellow is a warning accent, not a wall).
  //  side jambs — worn channel-steel structural posts (was full-height hazard yellow)
  for (const sz of [-1, 1]) {
    const jamb = _box(0.22, COR_CH, 0.34, _steel);
    jamb.position.set(xNear - 0.05, COR_CH / 2, zc + sz * halfZ);
    bay.add(jamb);
    for (let y = 0.35; y < COR_CH; y += 0.42) bay.add(_stud(xNear - 0.24, y, zc + sz * halfZ, new THREE.Vector3(1, 0, 0), _rivet, 0.016));
    // a THIN hazard-chevron accent stripe down the leading (corridor-facing) edge of each jamb only
    const chevron = _box(0.02, COR_CH - 0.4, 0.09, _bayHazardAccent);
    chevron.position.set(xNear - 0.17, COR_CH / 2, zc + sz * (halfZ + 0.02));
    bay.add(chevron);
  }
  //  lintel across the top of the bay mouth — worn steel with a slim hazard accent band on its face
  const lintel = _box(0.24, 0.3, halfZ * 2 + 0.3, _steel);
  lintel.position.set(xNear - 0.05, COR_CH - 0.1, zc);
  bay.add(lintel);
  const lintelHaz = _box(0.02, 0.08, halfZ * 2 + 0.2, _bayHazardAccent);
  lintelHaz.position.set(xNear - 0.18, COR_CH - 0.02, zc);
  bay.add(lintelHaz);
  for (let z = zc - halfZ; z <= zc + halfZ; z += 0.4) bay.add(_stud(xNear - 0.22, COR_CH - 0.25, z, new THREE.Vector3(1, 0, 0), _rivet, 0.014));
  //  a threshold sill plate on the deck at the mouth + a thin hazard tread accent
  const sill = _box(0.24, 0.06, halfZ * 2, _steel);
  sill.position.set(xNear - 0.06, 0.04, zc);
  bay.add(sill);
  const sillHaz = _box(0.02, 0.05, halfZ * 2 - 0.1, _bayHazardAccent);
  sillHaz.position.set(xNear - 0.19, 0.05, zc);
  bay.add(sillHaz);
  //  ── AIRLOCK SEAL COLLAR — a proud rubber gasket ring set just inboard of the mouth frame, the
  //    docking seal the pod mates against (a real airlock read). A thin dark torus-ish ring built
  //    from four edge bars so it hugs the mouth without touching the walk envelope.
  const collarX = xNear - 0.32;
  for (const [w, h, d, py, pz] of [
    [0.06, 0.14, halfZ * 2, COR_CH - 0.35, 0],            // top run
    [0.06, 0.14, halfZ * 2, 0.35, 0],                      // bottom run
    [0.06, COR_CH - 0.6, 0.14, COR_CH / 2, -(halfZ - 0.02)], // −Z run
    [0.06, COR_CH - 0.6, 0.14, COR_CH / 2, (halfZ - 0.02)],  // +Z run
  ] as const) {
    const seg = _box(w, h, d, _baySeal);
    seg.position.set(collarX, py, zc + pz);
    bay.add(seg);
  }
  //  a stencilled "ESCAPE POD" placard over the lintel (a lit decal face on a dark backing)
  const placBack = _box(0.02, 0.2, 1.1, _decal);
  placBack.position.set(xNear - 0.19, COR_CH - 0.55, zc);
  bay.add(placBack);
  const placFace = _box(0.01, 0.13, 0.92, _corrPlacard);
  placFace.position.set(xNear - 0.2, COR_CH - 0.55, zc);
  bay.add(placFace);
  //  a small warning placard low on the +Z jamb (a second stencil label, deck-side) — hazard-framed
  const warnBack = _box(0.02, 0.34, 0.44, _decal);
  warnBack.position.set(xNear - 0.19, 0.95, zc + halfZ - 0.1);
  bay.add(warnBack);
  const warnFace = _box(0.01, 0.24, 0.34, _corrPlacard);
  warnFace.position.set(xNear - 0.2, 0.95, zc + halfZ - 0.1);
  bay.add(warnFace);
  for (const wsz of [-1, 1]) {   // a thin hazard frame edge around the warning placard
    const wframe = _box(0.015, 0.34, 0.03, _bayHazardAccent);
    wframe.position.set(xNear - 0.195, 0.95, zc + halfZ - 0.1 + wsz * 0.2);
    bay.add(wframe);
  }

  // ── THE DOCKED POD — the size-matched riveted capsule standing in the recess, HATCH toward +X.
  const podLocalX = BAY_POD_X, podZ = zc;
  const pod = new THREE.Group();
  _bayGroup = pod;
  pod.position.set(podLocalX, 0, podZ);
  bay.add(pod);
  buildDockedPodExterior(pod);

  // ── CRADLE CLAMPS — real explosive-bolt latches gripping the pod at two heights (they tear free on
  //    eject). Each: a channel-steel arm off the back wall, a curved clamp JAW hugging the body, an
  //    explosive-bolt hub with a hazard-tip, and rivets. Two rings (low + high) so the pod reads
  //    firmly cradled, not propped.
  for (const cy of [0.95, 2.05]) {
    for (const cz of [-1, 1]) {
      const armLen = BAY_RECESS * 0.5;
      const arm = _box(armLen, 0.2, 0.18, _steel);
      arm.position.set(podLocalX + BAY_POD_R * 0.55 - armLen * 0.3, cy, podZ + cz * (BAY_POD_R * 0.66));
      bay.add(arm);
      // the arm's mount into the back wall (a bolted bracket)
      const mount = _box(0.22, 0.34, 0.26, _channel);
      mount.position.set(xFar + 0.14, cy, podZ + cz * (BAY_POD_R * 0.66));
      bay.add(mount);
      for (const my of [cy - 0.1, cy + 0.1]) bay.add(_stud(xFar + 0.26, my, podZ + cz * (BAY_POD_R * 0.66), new THREE.Vector3(1, 0, 0), _rivet, 0.02));
      // the CLAMP JAW — a curved channel-steel cuff hugging the body arc (a short lathe wedge)
      const jaw = _box(0.16, 0.26, 0.5, _channel);
      jaw.position.set(podLocalX + BAY_POD_R + 0.06, cy, podZ + cz * (BAY_POD_R * 0.62));
      jaw.rotation.y = cz * 0.35;
      bay.add(jaw);
      // the EXPLOSIVE-BOLT HUB — a cylinder cap with a hazard collar (the release charge)
      const boltHub = _cyl(0.09, 0.11, 0.16, 12, _steel);
      boltHub.rotation.z = Math.PI / 2;
      boltHub.position.set(podLocalX + BAY_POD_R + 0.16, cy, podZ + cz * (BAY_POD_R * 0.62));
      bay.add(boltHub);
      const boltHaz = _cyl(0.115, 0.115, 0.09, 12, _bayHazardAccent);
      boltHaz.rotation.z = Math.PI / 2;
      boltHaz.position.set(podLocalX + BAY_POD_R + 0.23, cy, podZ + cz * (BAY_POD_R * 0.62));
      bay.add(boltHaz);
      // the bolt head cap on the end (a hex-ish stud so it reads as a fastener, not a flat coin)
      const boltCap = _cyl(0.06, 0.06, 0.05, 6, _rivet);
      boltCap.rotation.z = Math.PI / 2;
      boltCap.position.set(podLocalX + BAY_POD_R + 0.3, cy, podZ + cz * (BAY_POD_R * 0.62));
      bay.add(boltCap);
    }
  }
  // a base cradle ring cupping the heat-shield foot (worn steel, riveted)
  const cradle = _cyl(BAY_POD_R + 0.14, BAY_POD_R + 0.2, 0.22, 20, _steel);
  cradle.position.set(podLocalX, 0.11, podZ);
  bay.add(cradle);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    bay.add(_stud(podLocalX + Math.cos(a) * (BAY_POD_R + 0.18), 0.2, podZ + Math.sin(a) * (BAY_POD_R + 0.18), new THREE.Vector3(0, 1, 0), _rivet, 0.02));
  }

  // ── UMBILICALS — ship→pod hoses + a fuel/power conduit feeding the docked pod (these tear on
  //    eject). Ribbed rubber hoses from the back wall to a coupling plate on the pod's aft body, plus
  //    a rigid conduit run + a junction box. Reads as a live docked vessel, not a parked prop.
  const umbPlateZ = podZ - BAY_POD_R * 0.5;
  const umbPlate = _box(0.1, 0.5, 0.4, _channel);   // the pod-side coupling plate on the aft body
  umbPlate.position.set(podLocalX - BAY_POD_R * 0.7, 1.5, umbPlateZ);
  bay.add(umbPlate);
  for (const [hy, sag] of [[1.62, 0.18], [1.42, 0.26], [1.28, 0.22]] as const) {
    // a slack hose: three tube segments drooping between the wall socket and the pod coupling
    const x0 = xFar + 0.12, x1 = podLocalX - BAY_POD_R * 0.7 - 0.05;
    const midX = (x0 + x1) / 2;
    const hoseSocket = _cyl(0.06, 0.06, 0.2, 10, _bayCoupling);
    hoseSocket.rotation.z = Math.PI / 2;
    hoseSocket.position.set(x0 + 0.08, hy, umbPlateZ);
    bay.add(hoseSocket);
    for (const [sx, ex, dip] of [[x0, midX, sag], [midX, x1, sag]] as const) {
      const len = Math.hypot(ex - sx, dip);
      const hose = _cyl(0.045, 0.045, len, 8, _bayHose);
      hose.position.set((sx + ex) / 2, hy - dip / 2, umbPlateZ);
      // a cylinder is +Y-axis; tilt it in the X-Y plane so it droops from (sx,hy) down to (ex,hy-dip)
      //   on the near leg and rises back up on the far leg (the slack-hose catenary read).
      hose.rotation.z = Math.atan2(ex - sx, dip) * (sx < midX ? 1 : -1);
      bay.add(hose);
    }
    const hoseEnd = _cyl(0.055, 0.055, 0.12, 10, _bayCoupling);   // coupling into the pod plate
    hoseEnd.rotation.z = Math.PI / 2;
    hoseEnd.position.set(x1, hy - sag, umbPlateZ);
    bay.add(hoseEnd);
  }
  // a rigid FUEL/POWER conduit run up the back wall + a junction box (bracket-mounted)
  const conduit = _cyl(0.07, 0.07, COR_CH - 0.6, 10, _channel);
  conduit.position.set(xFar + 0.14, COR_CH / 2, podZ - halfZ + 0.35);
  bay.add(conduit);
  const junc = _box(0.24, 0.4, 0.3, _steel);
  junc.position.set(xFar + 0.2, 1.7, podZ - halfZ + 0.35);
  bay.add(junc);
  for (const jy of [1.55, 1.85]) bay.add(_stud(xFar + 0.32, jy, podZ - halfZ + 0.35, new THREE.Vector3(1, 0, 0), _rivet, 0.018));

  // ── BAY LIGHTING — real recessed sources: a warm hatch glow (the "climb in here" beacon) spilling
  //    into the corridor + two recessed can-lights in the alcove ceiling casting cool fill onto the
  //    pod so it reads modelled, and a lens mesh under each so the source is visible.
  const glow = new THREE.PointLight(0xffcf9a, 1.15, 4.2, 2.2);   // softened + shorter (was blowing a hotspot across the whole barrel)
  glow.position.set(podLocalX + BAY_POD_R + 0.35, 1.42, podZ);   // pulled off the hull toward the corridor so it lights the hatch/mouth, not the barrel
  bay.add(glow);
  _bayGlowLight = glow;
  for (const lz of [zc - halfZ * 0.5, zc + halfZ * 0.5]) {
    const can = new THREE.PointLight(0xbcd0e0, 0.55, 4.6, 1.9);
    can.position.set((xNear + xFar) / 2 - 0.2, COR_CH - 0.15, lz);
    bay.add(can);
    // a recessed housing + a glowing lens so the source is physically there
    const housing = _box(0.5, 0.1, 0.28, _channel);
    housing.position.set((xNear + xFar) / 2 - 0.2, COR_CH - 0.04, lz);
    bay.add(housing);
    const lens = _box(0.4, 0.04, 0.2, _corrLens);
    lens.position.set((xNear + xFar) / 2 - 0.2, COR_CH - 0.09, lz);
    bay.add(lens);
  }
}

/** The docked pod's exterior mesh (local frame: heat-shield base centre at y=0, body on +Y, the
 *  open HATCH + interior peek face +X toward the corridor). Mirrors buildHeroPodMesh's identity in
 *  the corridor's grimed-gunmetal idiom: a light-aluminium lathe capsule, dark channel bands +
 *  frames, riveted hoops, a real recessed hatch swung OPEN with a warm cabin peek behind it. */
function buildDockedPodExterior(pod: THREE.Group): void {
  const baseTop = BAY_POD_BASE_H;
  const bodyTop = baseTop + BAY_POD_BODY_H;
  const apex = bodyTop + BAY_POD_NOSE_H;
  const SHOULDER_R = BAY_POD_R * 0.78;
  // (1) the revolved capsule skin — flared foot → straight body → tucked ogive nose (matches POD).
  const prof: THREE.Vector2[] = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(BAY_POD_R * 0.86, 0.0),
    new THREE.Vector2(BAY_POD_R * 1.02, BAY_POD_BASE_H * 0.55),
    new THREE.Vector2(BAY_POD_R, baseTop),
    new THREE.Vector2(BAY_POD_R, baseTop + BAY_POD_BODY_H * 0.5),
    new THREE.Vector2(BAY_POD_R, bodyTop - 0.06),
    new THREE.Vector2(SHOULDER_R, bodyTop + 0.04),
  ];
  // tucked ogive nose (high exponent → narrow crown, matches POD)
  const NOSE_SEG = 6;
  for (let i = 1; i <= NOSE_SEG; i++) {
    const t = i / NOSE_SEG;
    const r = SHOULDER_R * Math.pow(Math.cos(t * (Math.PI / 2)), 1.4);
    prof.push(new THREE.Vector2(Math.max(0.02, r), bodyTop + 0.04 + t * (apex - bodyTop - 0.04)));
  }
  const skinGeo = new THREE.LatheGeometry(prof, POD_SEG_BAY);
  // ASYMMETRIC DENTS — push clusters of body verts inward so the docked capsule reads hand-built +
  //   battered (mirrors buildHeroPodMesh), not a machined drum. Deterministic centres, body band only.
  {
    const pos = skinGeo.attributes.position;
    const dents = [
      { az: 1.15, y: baseTop + BAY_POD_BODY_H * 0.55, rad: 0.6, depth: 0.12 },
      { az: 2.7, y: baseTop + BAY_POD_BODY_H * 0.30, rad: 0.5, depth: 0.09 },
      { az: -1.3, y: baseTop + BAY_POD_BODY_H * 0.7, rad: 0.45, depth: 0.08 },
      { az: 3.5, y: baseTop + BAY_POD_BODY_H * 0.18, rad: 0.5, depth: 0.08 },
    ];
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.set(pos.getX(i), pos.getY(i), pos.getZ(i));
      const r = Math.hypot(v.x, v.z);
      if (r < BAY_POD_R * 0.6) continue;
      const az = Math.atan2(v.x, v.z);
      for (const d of dents) {
        let da = az - d.az; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
        const dist = Math.hypot(da * 0.9, v.y - d.y);
        if (dist < d.rad) {
          const k = 1 - dist / d.rad;
          const nr = Math.max(0.05, r - d.depth * k * k);
          const s = nr / r; v.x *= s; v.z *= s;
        }
      }
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    pos.needsUpdate = true;
  }
  skinGeo.computeVertexNormals();
  _disposables.push(skinGeo);
  pod.add(new THREE.Mesh(skinGeo, _bayPodSkin));

  // REENTRY SCORCH — a near-black char fading up the lower body (the capsule's headline weathering,
  //   matching buildHeroPodMesh). A proud lathe shell over the lower body with a vertex-colour fade +
  //   asymmetric soot licks so it reads as the SAME scorched heat-shield capsule the player rides.
  const scorchTopY = baseTop + BAY_POD_BODY_H * 0.5;
  const scorchProf: THREE.Vector2[] = [
    new THREE.Vector2(BAY_POD_R * 0.86 + 0.008, 0.0),
    new THREE.Vector2(BAY_POD_R * 1.05, BAY_POD_BASE_H * 0.55),
    new THREE.Vector2(BAY_POD_R + 0.012, baseTop),
    new THREE.Vector2(BAY_POD_R + 0.012, baseTop + (scorchTopY - baseTop) * 0.5),
    new THREE.Vector2(BAY_POD_R + 0.010, scorchTopY),
  ];
  const scorchGeo = new THREE.LatheGeometry(scorchProf, POD_SEG_BAY);
  scorchGeo.computeVertexNormals();
  {
    const pos = scorchGeo.attributes.position;
    const cols = new Float32Array(pos.count * 3);
    const cChar = new THREE.Color(0x0d0906), cTarn = new THREE.Color(0x4a3722), cAlu = new THREE.Color(0x8f9498);
    const tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i), vy = pos.getY(i), vz = pos.getZ(i);
      const az = Math.atan2(vx, vz);
      const lick = 0.5 * Math.exp(-Math.pow((az - 0.4) / 0.7, 2))
                 + 0.3 * Math.exp(-Math.pow((az + 1.6) / 0.4, 2))
                 + 0.18 * Math.sin(az * 5.0 + vy * 3.0);
      const span = Math.max(0.01, (scorchTopY - baseTop) * (1 + lick));
      const t = Math.max(0, Math.min(1, (vy - baseTop) / span));
      if (t < 0.45) tmp.copy(cChar).lerp(cTarn, t / 0.45);
      else tmp.copy(cTarn).lerp(cAlu, (t - 0.45) / 0.55);
      cols.set([tmp.r, tmp.g, tmp.b], i * 3);
    }
    scorchGeo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  }
  _disposables.push(scorchGeo);
  pod.add(new THREE.Mesh(scorchGeo, _bayPodScorch));

  // charred heat-shield foot cap (a dark end-cap peeking under the flare)
  const foot = _cyl(BAY_POD_R * 0.9, BAY_POD_R * 0.9, BAY_POD_BASE_H * 0.5, POD_SEG_BAY, _channel);
  foot.position.y = BAY_POD_BASE_H * 0.25;
  pod.add(foot);

  // (2) RIVETED LATITUDE BANDS (the "riveted aluminium capsule" read) — proud channel hoops with
  //     rivet studs, matching the exterior/interior banding idiom.
  const bandYs = [baseTop + 0.05, baseTop + BAY_POD_BODY_H * 0.4, baseTop + BAY_POD_BODY_H * 0.8, bodyTop - 0.02];
  for (const by of bandYs) {
    // a PROUD dark channel-steel hoop (darker → pops off the aluminium skin, reads as a real seam
    //   ring, not a faint painted line) + a thin lighter batten cap on top so it catches the light.
    const band = _cyl(BAY_POD_R + 0.06, BAY_POD_R + 0.06, 0.16, POD_SEG_BAY, _channel);
    band.position.y = by;
    pod.add(band);
    const bandCap = _cyl(BAY_POD_R + 0.075, BAY_POD_R + 0.075, 0.04, POD_SEG_BAY, _band);
    bandCap.position.y = by + 0.06;
    pod.add(bandCap);
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
      pod.add(_stud(dir.x * (BAY_POD_R + 0.08), by, dir.z * (BAY_POD_R + 0.08), dir, _rivet, 0.018));
    }
  }
  // vertical seam battens around the barrel (skipping the +X hatch arc) so the drum reads as riveted
  //   panel plates, not a smooth cylinder — matching the hero pod's panelled skin.
  for (const a of [Math.PI * 0.5, Math.PI * 0.75, Math.PI, Math.PI * 1.25, Math.PI * 1.5]) {
    const dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
    const batten = _box(0.06, BAY_POD_BODY_H - 0.2, 0.05, _steel);
    batten.position.set(dir.x * (BAY_POD_R + 0.02), baseTop + BAY_POD_BODY_H / 2, dir.z * (BAY_POD_R + 0.02));
    batten.rotation.y = -a;
    pod.add(batten);
    // a few rivets down each batten (the panel-seam fasteners)
    for (let s = 0; s < 4; s++) {
      const by = baseTop + 0.3 + s * (BAY_POD_BODY_H - 0.6) / 3;
      pod.add(_stud(dir.x * (BAY_POD_R + 0.06), by, dir.z * (BAY_POD_R + 0.06), dir, _rivet, 0.014));
    }
  }

  // (3) THE OPEN HATCH (faces +X toward the corridor) — a real aperture in the +X body arc with a
  //     channel-steel frame, a warm-lit cabin INTERIOR peek behind it, and the swung-open door.
  const hCY = 1.28, hW = 0.98, hH = 1.6;      // hatch centre/size (a climb-through door)
  const hazHalf = (hW / 2) / BAY_POD_R + 0.02;   // azimuth half-extent of the opening on the body
  // a recessed interior BOX behind the opening (the cabin void) with WARM-LIT walls so the interior
  //   reads clearly LIT (the cabin the player is about to climb into — the "hatch open, cabin
  //   visible" requirement). The glow material is unlit warm so it reads bright regardless of the
  //   bay lamps. Set inboard of the +X wall so there's real depth behind the aperture.
  const cabinBack = _box(0.14, hH + 0.2, hW + 0.3, _bayCabinGlow);
  cabinBack.position.set(BAY_POD_R - 0.95, hCY, 0);   // the back wall of the peek (warm-lit)
  pod.add(cabinBack);
  for (const sz of [-1, 1]) {   // side walls of the cabin peek (warm, angled slightly in)
    const cw = _box(0.85, hH + 0.2, 0.14, _bayCabinGlow);
    cw.position.set(BAY_POD_R - 0.5, hCY, sz * (hW / 2 + 0.05));
    pod.add(cw);
  }
  const cabinFloor = _box(0.85, 0.12, hW + 0.2, _bayCabinGlow);
  cabinFloor.position.set(BAY_POD_R - 0.5, hCY - hH / 2, 0);
  pod.add(cabinFloor);
  // a WARM POINT LIGHT inside the cabin peek so the interior + the aperture rim read genuinely lit
  //   (a lamp glow spilling out the open hatch — the inviting "get in" read).
  const cabLamp = new THREE.PointLight(0xffcf96, 0.85, 1.15, 2.6);   // short range → lights the cabin peek only, not the outer barrel (kills the blowout hotspot)
  cabLamp.position.set(BAY_POD_R - 0.7, hCY + 0.25, 0);
  pod.add(cabLamp);
  // a hint of interior structure (a seat-back silhouette + a rivet hoop) so the peek isn't a flat
  //   glow slab — dark forms catching the warm interior light, reading as the cabin's guts.
  const innerSeat = _box(0.12, 0.72, 0.46, _channel);
  innerSeat.position.set(BAY_POD_R - 0.72, hCY - 0.05, 0);
  pod.add(innerSeat);
  const innerHoop = _cyl(0.5, 0.5, 0.08, 16, _band);
  innerHoop.rotation.z = Math.PI / 2;
  innerHoop.position.set(BAY_POD_R - 0.9, hCY + 0.3, 0);
  pod.add(innerHoop);
  // the channel-steel HATCH FRAME ring around the +X opening (a recessed jamb → depth)
  for (const [oy, oh, ow, oz] of [[hCY + hH / 2, 0.14, hW + 0.24, 0], [hCY - hH / 2, 0.14, hW + 0.24, 0]] as const) {
    const bar = _box(0.16, oh, ow, _podFrameBay);
    bar.position.set(BAY_POD_R + 0.02, oy, oz);
    pod.add(bar);
  }
  for (const sz of [-1, 1]) {
    const jamb = _box(0.16, hH + 0.24, 0.14, _podFrameBay);
    jamb.position.set(BAY_POD_R + 0.02, hCY, sz * (hW / 2 + 0.05));
    pod.add(jamb);
  }
  void hazHalf;
  // THE SWUNG-OPEN DOOR — a bright aluminium plate hinged on the +Z jamb, swung ~100° outward into
  //   the bay so it reads OPEN + inviting (the player enters here). A hinge stub + a latch wheel.
  const doorPivot = new THREE.Group();
  doorPivot.position.set(BAY_POD_R + 0.04, hCY, hW / 2 + 0.02);   // hinge at the +Z edge of the opening
  pod.add(doorPivot);
  const door = _box(0.08, hH, hW, _bayPodHatch);
  door.position.set(0, 0, -hW / 2);   // extends from the hinge across the opening (local −Z)
  doorPivot.add(door);
  // a channel-steel frame border + two cross battens on the outer door face so it reads as a real
  //   riveted hatch plate (not a blank slab) from the wide/side angles where its face is toward the eye.
  for (const [oy, oh] of [[hH / 2 - 0.05, 0.1], [-hH / 2 + 0.05, 0.1]] as const) {
    const rail = _box(0.06, oh, hW, _podFrameBay);
    rail.position.set(0.06, oy, -hW / 2);
    doorPivot.add(rail);
  }
  for (const bz of [-hW * 0.3, -hW * 0.7]) {
    const batten = _box(0.05, hH - 0.24, 0.09, _podFrameBay);
    batten.position.set(0.06, 0, bz);
    doorPivot.add(batten);
  }
  // rivets down both battens (the door-panel fasteners) + a lock wheel
  for (const bz of [-hW * 0.3, -hW * 0.7]) for (let i = 0; i < 5; i++) {
    doorPivot.add(_stud(0.1, -hH / 2 + 0.25 + i * (hH - 0.5) / 4, bz, new THREE.Vector3(1, 0, 0), _rivet, 0.018));
  }
  const wheel = _cyl(0.14, 0.14, 0.06, 14, _corrRail);
  wheel.rotation.z = Math.PI / 2;
  wheel.position.set(0.11, 0, -hW + 0.2);
  doorPivot.add(wheel);
  for (let i = 0; i < 5; i++) {   // the wheel spokes/hub bolts
    const a = (i / 5) * Math.PI * 2;
    doorPivot.add(_stud(0.14, Math.cos(a) * 0.09, -hW + 0.2 + Math.sin(a) * 0.09, new THREE.Vector3(1, 0, 0), _rivet, 0.014));
  }
  // swing it OPEN wide so it lays back toward the hull on the +Z flank → the APERTURE + the lit cabin
  //   peek stay CLEAR to the approaching player from the flee + wide angles (door doesn't cover the hole).
  doorPivot.rotation.y = -2.3;   // ~132° open — laid back off the aperture but not swung across the flee approach (clears the lit-cabin read from both flee + wide)
}
const POD_SEG_BAY = 28;   // docked-pod lathe segments (matches POD_SEG)
// dedicated hatch-frame steel for the docked pod (grimed dark channel, corridor idiom)
const _podFrameBay = _metal(0x3a3f45, 0.5, 0.6, { flat: true, grime: true });

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
  // the bay glow flares hot then everything's about to be disposed
  if (_bayGlowLight) _bayGlowLight.intensity = 1.5 + k * 3.0;
}

// ── T3.4 — the engine-bay FIRE at the corridor dead-end (the disaster reveal). Additive
//    emissive flame quads (the corridor is unlit greybox, so the fire is its own glow). Hidden
//    until setEngineFire erupts it; setEngineFire flickers it each frame. Greybox-grade — the
//    hero fire FX (smoke, particles, real light) rides the deferred hero corridor.
function buildEngineBay(group: THREE.Group): void {
  const fire = new THREE.Group();
  // at the dead-end door (local z≈14.5), corridor-side, low so it climbs the bulkhead
  fire.position.set(0, 0.7, 14.4);
  // ── the RUPTURED ENGINE-ACCESS HATCH: a blown-open dark maw in the dead-end bulkhead the fire
  //    erupts from (so the blaze reads as a breach in real hardware, not a floating flame). A dark
  //    recessed frame + peeled/blackened plate edges around the hole; always visible (the hatch is
  //    there before it ruptures), the fire quads + light appear on setEngineFire.
  const maw = _box(1.0, 1.4, 0.05, _channel);   // the dark opening (deep, near-black recess)
  maw.position.set(0, 0.75, -0.05);
  fire.add(maw);
  // scorched/peeled plate lips around the breach (blackened battered steel)
  for (const [ox, oy, ow, oh] of [[-0.6, 0.75, 0.16, 1.5], [0.6, 0.75, 0.16, 1.5], [0, 1.55, 1.3, 0.16], [0, -0.02, 1.3, 0.16]] as const) {
    const lip = _box(ow, oh, 0.12, _steel);
    lip.position.set(ox, oy, 0.0);
    fire.add(lip);
  }
  const cols = [0xff2c0c, 0xff7a1e, 0xffc23a];   // deep-red → orange → yellow flame tones
  for (let i = 0; i < 12; i++) {
    const w = 0.5 + (i % 3) * 0.28, h = 1.0 + (i % 2) * 0.7;
    const g = new THREE.PlaneGeometry(w, h);
    _disposables.push(g);
    const m = new THREE.MeshBasicMaterial({
      color: cols[i % 3], transparent: true, opacity: 0.0,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    });
    _fireMats.push(m); _buildMats.push(m);
    const q = new THREE.Mesh(g, m);
    q.position.set(Math.sin(i * 1.7) * 0.55, (i % 3) * 0.32, 0.06 + 0.04 * i);
    fire.add(q);
  }
  // the REAL light the blaze casts up the corridor (hot orange, strong falloff) — off until erupt.
  const fireLight = new THREE.PointLight(0xff5a1e, 0.0, 9.0, 1.7);
  fireLight.position.set(0, 1.0, -0.6);   // corridor-side of the breach, throwing light forward (−z)
  fire.add(fireLight);
  _engineFireLight = fireLight;
  fire.visible = false;
  group.add(fire);
  _engineFire = fire;
}

/** Drive the engine-bay FIRE (T3.4 disaster). `intensity` 0 = out, 1 = full blaze; `t` = a
 *  time accumulator that flickers the flames. Safe no-op if the ship isn't built. */
export function setEngineFire(intensity: number, t = 0): void {
  if (!_engineFire) return;
  _engineFire.visible = intensity > 0.001;
  for (let i = 0; i < _fireMats.length; i++) {
    const flick = 0.55 + 0.45 * Math.sin(t * (6.5 + i * 0.7) + i * 1.7);
    const tier = i % 3 === 0 ? 1.0 : (i % 3 === 1 ? 0.8 : 0.6);   // red core brightest
    _fireMats[i].opacity = Math.min(1, intensity * tier * flick);
  }
  // the real light the blaze throws up the corridor — flickers with the flames.
  if (_engineFireLight) {
    const lflick = 0.7 + 0.3 * Math.sin(t * 9.3 + 0.6) + 0.12 * Math.sin(t * 21.0);
    _engineFireLight.intensity = intensity * 5.0 * lflick;
  }
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
  _engineFire = null;
  _fireMats.length = 0;
  _engineFireLight = null;
  _corrNormalLights.length = 0;
  _corrLensMats.length = 0;
  _corrRedStripMats.length = 0;
  _corrRedLight = null;
  _corrRedLight2 = null;
  _bayGroup = null;         // R5c — the docked-pod bay group (geometry freed via _disposables + traverse)
  _bayGlowLight = null;     // R5c
  _shipAlertLevel = 0;
  // free the per-cockpit IBL + detach it from the persistent metal materials.
  _applyCockpitEnv(null);
  if (_cockpitEnv) { _cockpitEnv.dispose(); _cockpitEnv = null; }
  for (const body of shipBodies) ctx.physics.world.removeRigidBody(body);
  shipBodies.length = 0;
}
