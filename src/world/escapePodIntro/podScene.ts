// Escape-pod intro — the HERO ESCAPE POD INTERIOR (Phase 1 / T1.2; C12 CYLINDRICAL redo).
// ─────────────────────────────────────────────────────────────────────────────
// The tight worn lifeboat cabin the player RIDES, SEATED, in first-person through
// enterPod → shipExplode → descent → the parachute gag → impact. ~20-30s of up-close,
// head-turn-range hero read — NOT set dressing. Built lazily when the intro reaches the
// pod, disposed at the desert handoff, at its OWN offset above the ship so both can
// coexist briefly (you watch the ship explode from the pod's viewport).
//
// IDENTITY (matches the T1.1 exterior `placeCrashedPodWreck` below, D271): the inside of
// a VERTICAL RIVETED-ALUMINIUM CAPSULE. The cabin is a ROUND back-faced cylindrical
// SHELL (NOT the old flat box walls) capped by a low OGIVE DOME matching the exterior's
// nose, with riveted RING-FRAMES + curved vertical RIBS, exposed conduit, and the SAME
// weathered-aluminium material idiom as the exterior skin (light cool-grey aluminium,
// dark channel-steel hardware). A wide channel-steel VIEWPORT is set into the forward
// (−Z) arc (the seated camera faces −Z → looks straight out at the descent planet). The
// praised C10 hardware (red parachute lever, yellow guarded eject, amber console, seat)
// is re-homed curve-seated on the round wall within natural seated reach. Warm dim,
// cramped, lived-in.
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
import { mergeStaticByMaterial } from '../wreckForms.ts';                        // PERF — static-merge the cabin's shared-material greebles (ring rivets/ribs/bands) into batched draws
import { addAccessPanel } from '../wrecks.ts';                                   // T4.3 — the crashed pod's REAL salvage panel (the first-salvage tutorial target)
import { registerSalvageable, markSalvageStripped } from '../salvage.ts';       // T4.3 — register the pod as a machete-salvageable; markSalvageStripped — restore stripped state on load
import { makeRng } from '../../core/rng.ts';                                    // T4.3 — deterministic position-seeded rng for the pod's salvage roll
import { playChutePop } from '../../audio/audio.ts';                            // T4.3 — the comic chute-pop FWOOMP

// ── REBUILD v2 R1b — the pod PHYSICALLY falls through the REAL world ─────────────
// The orbit-frame beats (cockpit/corridor/enterPod/shipExplode) still build the pod at
// this fallback OFFSET (the space skybox is their backdrop — they "watch the ship explode
// in orbit"). But the DESCENT re-grounds the pod into the real desert above the player's
// real spawn: at descent start the pod base is set to (returnPos.x, returnPos.y, returnPos.z)
// and the pod GROUP + the seated player ride DESCENT_ALT down to ~0 (the spawn ground) as
// progress eases. Through the −Z porthole the player sees the REAL terrain approaching + the
// REAL sky (space→dawn, driven by setSkyIntroMode in sequence.ts) — NOT a fake shader vista.
//
// Precision: ~DESCENT_ALT (≈3000 m) above the spawn, with x,z AT the spawn, is well within
// three.js float32 range (true orbit/100 km is not — hence the space skybox establishes
// "orbit" and the pod physically falls only this last feasible stretch).
const POD_ORIGIN = new THREE.Vector3(0, 3200, 0);   // orbit-frame fallback (no real spawn yet)
// The physical-fall altitude (m above the real spawn) at descent start. CONCESSION (flagged in
// the R1b report): the game world is only ±worldHalfSize≈1200 m, and the −Z SIDE porthole on the
// upright capsule can only look down ~22° before the cabin wall occludes the view — so the real
// ground only reads through the window below ~500 m (above that, the porthole frames the real
// dawn SKY + distant horizon, which is correct for "high = sky"). 800 m gives a real high-drop
// feel where roughly the last half of the fall shows the desert rushing up through the porthole.
// (The float-precision ceiling is ~10 km — not the limit here; the WORLD SIZE + porthole angle is.)
const DESCENT_ALT = 600;

// The real-world pod BASE for the descent (floor-top centre). Derived from ctx.intro.returnPos
// when the descent begins (set by setDescentBase, called from setDescentProgress / the beats).
// Null until then → getPodSpawn/buildPodScene fall back to POD_ORIGIN (the orbit-frame beats +
// rig shots that never enter the descent). Captured so the swelling altitude rides off it.
let _descentBase: THREE.Vector3 | null = null;
let _podAltitude = DESCENT_ALT;   // current pod altitude above the base (eased DESCENT_ALT→0 by progress)

// ── Cabin dimensions (pod-LOCAL frame; floor top = y=0, +Z = aft/behind seat, −Z =
//    forward/viewport, +X = the seated player's RIGHT). A tight cramped CAPSULE cabin —
//    the INSIDE of the vertical riveted-aluminium pod. The FP eye lands ~1.7 above the
//    floor, so the cabin is sized so the viewport + controls centre NEAR the eye (the
//    player reads the planet dead-ahead + glances down-right to the lever). NOT a bridge
//    — a humble welded capsule. The shell is a ROUND back-faced cylinder, NOT a box.
const CAB_R = 1.28;       // interior radius (≈2.56m-diameter capsule bore — 1-person believable)
// W2a (2026-07-03, user "TOO SHORT/STUBBY → make it TALLER"): the straight body rises from
//   1.95 → 2.55 and the dome 0.62 → 0.85, so total height ≈ 3.40m and h/d climbs 0.92 → ~1.18.
//   ONE dimension contract now (frozen — the sibling agent builds the bay to these numbers): the
//   exterior POD_BODY_H/POD_NOSE_H below ALIAS these so the exterior skin, the canonical bay pod,
//   and this ride cabin are the SAME proportions. Killed the old dome-heavy "helmet" read.
const WALL_H = 2.55;      // straight cylindrical-wall height (floor 0 → shoulder where the dome springs) — TALLER (was 1.95)
const DOME_H = 0.85;      // ogive dome rise (taller crown to match the taller body; was 0.62)
const CAB_APEX = WALL_H + DOME_H;   // ceiling apex (≈ 3.40)
const SHELL = 0.16;       // panel/ring depth (hull-substantial, rule 7)
const WALL_SEG = 48;      // shell radial segments — round + smooth (raised from 32; faceting bands showed)
// (the seated FP eye lands ~1.7 above the floor — the viewport + controls are centred near it)
// ── Azimuth convention (matches THREE.CylinderGeometry's theta): θ measured from +Z
//    toward +X, so a direction is `dir = (sin θ, 0, cos θ)`. θ=0 → +Z (aft/seat-back),
//    θ=π → −Z (FORWARD/viewport), θ=+π/2 → +X (right), θ=−π/2 → −X (left). Using the
//    SAME convention for the wall-gap, the ring-frames, AND the curve-seated hardware
//    means the cut arc, the rings, and the viewport frame all line up.
// ── CLUSTER D — THE MERGED FRONT DOOR (user re-scope, 2026-07-02/03): "ONE pod, one aperture."
//    The old −Z round VIEWPORT and the old side ESCAPE HATCH (−1.25) are UNIFIED into a SINGLE
//    front-facing DOOR on the −Z (θ=π) forward arc, with the DOMED CIRCULAR PORTHOLE integral to
//    the door slab (the same domed-porthole character). The player faces this ONE door/porthole for
//    EVERYTHING: sit facing it, watch the whole descent through its porthole glass (the door SEALED
//    closed), then kick THE SAME door open at the wake + walk out through the opening onto the real
//    terrain. No side hatch, no separate viewport — the door IS the window, on the seat's sight-line.
//    (This mirrors the canonical bay pod's merged glass front door — buildCanonicalPodExterior — so
//    the ride-down cabin is the SAME vessel the player boarded, inside AND out.)
// ── W2a — THE ONE DOOR + PORTHOLE CONTRACT (frozen; the sibling bay agent builds to these). The
//    OLD FDOOR_/VP_ (ride cabin) and CPOD_DOOR_/CPOD_PORT_ (bay) sets are UNIFIED here: the canonical
//    CPOD_ constants below ALIAS these, so the door aperture + porthole are IDENTICAL geometry inside,
//    out, in the bay, and on the descent — one model. Only the AZIMUTH differs by placement (−Z here
//    for the seated sight-line; +X in the bay); every SIZE is shared.
const FDOOR_AZ = Math.PI;         // the merged front door centre azimuth = straight forward (−Z), on the seated sight-line
const FDOOR_W = 1.02;             // door aperture width (a wide climb-through) — CONTRACT
const FDOOR_H = 1.98;             // door aperture height (was 1.86) — CONTRACT: contains the porthole with clear margin + a full climb-through
const FDOOR_CY = 1.10;            // door centre height (was 1.04) — CONTRACT: base ≈0.11 for a floor-level climb-out; spans up past the seated eye
// the door's azimuth half-extent on the cylinder wall (arc the wall/hoops omit for the aperture)
const FDOOR_AZ_HALF = Math.min(Math.PI * 0.85, (FDOOR_W / 2 + 0.06) / CAB_R);
// The DOMED PORTHOLE set into the door slab — sized to sit COMFORTABLY WITHIN the door slab with a
//   clear margin to every door edge (user W2a: the old R 0.44 crowded the 1.02-wide door + the bezel
//   clipped the hull). glass R 0.33, bezel outer ≤ 0.41 (contract), centre 1.38 (seated ~1.4 eye —
//   the descent reads dead-ahead through it). Margins to the door edges: sides = 1.02/2 − 0.41 = 0.10;
//   top = (1.10+1.98/2) − (1.38+0.41) = 2.09 − 1.79 = 0.30; bottom = 1.79-0.41-... comfortably clear.
const VP_R = 0.33;                // domed porthole GLASS radius (was 0.44) — CONTRACT: fits WITHIN the door with ≥0.10 margin
const VP_BEZEL_OUT = 0.41;        // bezel OUTER edge radius (torus outer) — CONTRACT ceiling; ≥0.10m from every door edge
const VP_CY = 1.38;              // porthole centre height (was 1.34) — CONTRACT: on the seated ~1.4 eye glance

// ── Materials — the SAME weathered-ALUMINIUM idiom as the exterior hero pod (below,
//    D271). Module-scope so a rebuild doesn't realloc; disposePodScene disposes GEOMETRY
//    only, never these shared materials. Dim/warm tuned for an INTERIOR (less sun-bleach
//    than the sun-baked exterior; lit by a warm dim ambient, not desert noon) but the
//    SAME light cool aluminium skin as the exterior so the cabin reads as the inside of
//    THIS capsule, not a beige box.
const _cabPaintOpts = {
  // Full-intro coherence fix: the shell base was 0xa3a8ac — a LIGHT grey that, under the stacked
  // interior rig (lamp 1.7 + hemi fill 0.72 + key 0.6 + coolRake + porthole spill), blew to a pale
  // near-WHITE plastic read that broke the worn-industrial through-line vs the cockpit/corridor
  // (same weathered-aluminium idiom but darker exterior tone). Darkened to a MID worn-aluminium
  // value so the SAME lights land the walls at a grimy grey (form/curvature gradients unchanged —
  // everything just sits ~30% lower in value), matching the crashed-pod exterior + the hauler tone.
  baseColor: 0x71767a,           // MID worn cool-aluminium shell skin (was 0xa3a8ac → over-lit to white)
  bareMetalHex: 0xb2b8bc,        // bright cool scuffed-aluminium reveal (scratches still pop against the darker skin)
  rustHex: 0x33333a,             // COOL near-grey grime tone (a neutral shadow accent, no brown)
  streakIntensity: 0.26, wearAmplitude: 0.38,   // a touch more plate-to-plate tonal break-up now that the base is darker (denting reads)
  fleckStrength: 0.55,           // moderate scuff scratches
  oxStrength: 0.10, oxHex: 0x5c5c58,            // sparse neutral patina (slightly stronger against the darker skin)
  localSpace: true,   // the pod FALLS ~600m during the descent — pin the grime to the surface so it doesn't crawl (see hullMaterial.ts localSpace)
} as const;
// BACK-FACED aluminium shell — the curved wall + dome are viewed from INSIDE (back faces).
const _cabShell = createRustedHullMaterial(_cabPaintOpts);
_cabShell.side = THREE.BackSide;
// Exposed dark channel-steel — ribs / ring-frames / viewport frame / console body. A
// value contrast to the bright aluminium skin so the steel structure reads as fitted-on.
const _cabSteel = createRustedHullMaterial({
  baseColor: 0x40454b,           // COOL dark-grey steel (lifted a touch; value contrast vs bright skin)
  rustHex: 0x242830, streakIntensity: 0.26, wearAmplitude: 0.24,
  oxStrength: 0.08, oxHex: 0x55555a, seamRustStrength: 0.12,   // neutral grime (warm oxide stripped → no brown)
  localSpace: true,   // pod falls during descent → pin grime (see hullMaterial.ts)
});
// Mid grey-aluminium ring/band metal (the riveted hoops) — lighter than the dark channel
// so the latitude rings read as fitted RIVETED FRAMES, not dark drum-divisions (matches
// the exterior _podBandMat).
const _cabBandOpts = {
  // User steering 2026-07-03 (match the ship, not pale): the band was BRIGHT near-white
  // aluminium (0xb0b5b8 / reveal 0xd2d8dc) — it read pale against the darker shell + the
  // ship gunmetal. Pulled to the ship _band gunmetal (0x7c8288) but kept a step LIGHTER
  // than the shell (0x71767a) so the riveted hoops still POP as proud frames + sell the
  // curve — just in-family, not bleached.
  baseColor: 0x868c90,           // WORN GUNMETAL band, a step lighter than the shell (was 0xb0b5b8 near-white)
  bareMetalHex: 0xafb4b8,        // cool scuff reveal (was 0xd2d8dc near-white)
  streakIntensity: 0.18, wearAmplitude: 0.26, fleckStrength: 0.6,
  oxStrength: 0.06, oxHex: 0x5a5c5e, seamRustStrength: 0.10,   // cool grime; the hoops carry the curvature read, keep them a bright cool value but not white
  localSpace: true,   // pod falls during descent → pin grime (see hullMaterial.ts)
} as const;
const _cabBand = createRustedHullMaterial(_cabBandOpts);
// BACK-FACED band for the riveted ring-frame hoops (open tubes seen from inside) — a
// separate material so the front-faced _cabBand (rib plates, dome seams) keeps its side.
const _cabBandShell = createRustedHullMaterial(_cabBandOpts);
_cabBandShell.side = THREE.BackSide;
// Recessed channel-steel (console body, deep frame) — COOL dark steel (NOT the warm
// WRECK_HULL_DARK_HEX which read wood-brown). A value contrast to the bright aluminium.
const _cabChannel = createRustedHullMaterial({
  baseColor: 0x363b41,           // cool near-charcoal steel
  rustHex: 0x222631,
  streakIntensity: 0.24, wearAmplitude: 0.22, oxStrength: 0.08, oxHex: 0x55555a, seamRustStrength: 0.12,
  localSpace: true,   // pod falls during descent → pin grime (see hullMaterial.ts)
});
// Dedicated DoubleSide variant of the channel steel for the curved viewport bezel ring
// (seen from both faces). A SEPARATE material so we never mutate the shared _cabChannel
// (P2 code bug: buildViewport set _cabChannel.side = DoubleSide on the module-shared mat).
const _cabChannelDS = _cabChannel.clone();
_cabChannelDS.side = THREE.DoubleSide;
// BackSide variant for the porthole bezel RING tube (an open tube whose inner face the
// camera sees — a proud rim set into the curved hull around the window).
const _cabChannelBack = _cabChannel.clone();
_cabChannelBack.side = THREE.BackSide;
// Rivets / studs / small hardware — mid steel-grey (cast/forged fittings; matches the
// exterior _podFrameMat so the rivet language is identical inside + out).
const _cabRivet = createRustedHullMaterial({
  baseColor: 0x8d9094, rustHex: 0x3a3a3e, streakIntensity: 0.18,   // cool mid steel-grey studs (warm rivet read as brassy)
  oxStrength: 0.08, oxHex: 0x6a6a66, fleckStrength: 0.5,
  localSpace: true,   // pod falls during descent → pin grime (see hullMaterial.ts)
});
// Conduit / cabling — dark matte near-black (lambert, flat).
const _cabCable = new THREE.MeshLambertMaterial({ color: 0x201d18, flatShading: true });
// Floor DECK plate — bright cool aluminium tread-plate (a lit, finished floor, not a void).
const _cabDeck = createRustedHullMaterial({
  // User steering (match the ship): the tread-plate was bright cool aluminium (0x969a9e /
  // reveal 0xc4c9cc) → read pale. Pulled to the ship _deck gunmetal (0x5c6167) but kept a
  // touch lighter/lit so the floor still reads as a finished lit deck, not a void.
  baseColor: 0x71767a, bareMetalHex: 0xa4a9ad,   // worn gunmetal tread (was 0x969a9e pale)
  streakIntensity: 0.18, wearAmplitude: 0.28, fleckStrength: 0.7,
  oxStrength: 0.08, oxHex: 0x5a5c5e, seamRustStrength: 0.10,   // cool grime (deck was reading warm-tan under the lamp)
  localSpace: true,   // pod falls during descent → pin grime (see hullMaterial.ts)
});
// Seat cushion — worn padded vinyl, a desaturated warm tan, slightly soft (lambert).
const _cabSeat = new THREE.MeshLambertMaterial({ color: 0x6e6353, flatShading: true });
// Restraint webbing — faded olive-tan strap.
const _cabStrap = new THREE.MeshLambertMaterial({ color: 0x837a5c, flatShading: true });
// Warm self-lit accents — the small green/amber console telltales + the lever grip,
// so the dim cabin has points of warm life (unlit so they glow regardless of light).
const _ledGreen = new THREE.MeshBasicMaterial({ color: 0x57c46a });
const _ledAmber = new THREE.MeshBasicMaterial({ color: 0xd98a32 });
const _ledRed = new THREE.MeshBasicMaterial({ color: 0xc0392b });
// Y3 Interior Mk-II — the X2a label/CRT-clutter accents (_ledCyan / _labelFace / _labelInk) are
//   RETIRED with the tiny-greeble console detail; the Mk-II console keeps only the chunky screen glow.
// A lit screen face (a faint cyan-green scanned glow, brighter than the dead _cabScreen).
const _crtGlow = new THREE.MeshBasicMaterial({ color: 0x1c3630 });
// Dim screen face — a faint amber CRT glow.
const _cabScreen = new THREE.MeshBasicMaterial({ color: 0x2a2410 });
// SEV1 (2026-07-03) — the OPEN-door porthole read as a big BLACK VOID: the old full-depth OPAQUE
// near-black tube behind the door glass walled off the aperture, so when the door was kicked
// open on the desert you saw an opaque black ring instead of sky/sand through the glass. The
// proud bezel torus (dBez) already carries the inset-depth read; the well now uses a SHALLOW,
// TRANSPARENT dark-tinted COLLAR — it still darkens to a soft shadow rim when SEALED (backed by
// the dark aperture behind the door) but lets the desert read THROUGH when the door swings open.
const _cabDoorWellTint = new THREE.MeshBasicMaterial({
  color: 0x141a1e, side: THREE.DoubleSide,
  transparent: true, opacity: 0.42, depthWrite: false,   // see-through collar → no black void when open
});
// SEV1 (2026-07-03) — the merged FRONT DOOR slab read PALER than the gunmetal hull (a kit-bashed
// two-family read): the slab was drawn in _cabBand (0x868c90, the light riveted-hoop highlight
// grey). This dedicated slab material lands the door in the SAME cool gunmetal family as the
// exterior hull (_podPaint 0x565c62), a SMALL step lighter so it still reads as THE door — mirrors
// the exterior salvage-door value (_podDoorMat 0x6a7076), not warm pale aluminium.
const _cabDoorSlab = createRustedHullMaterial({
  baseColor: 0x646a70,           // WORN GUNMETAL door slab — a step lighter than the hull skin (0x565c62), same cool family (was 0x868c90 pale band-grey)
  bareMetalHex: 0x8f959b,        // cool scuffed reveal (matches _podPaint reveal; was near-white band reveal)
  rustHex: 0x2c3036,             // cool grime channel
  streakIntensity: 0.30, wearAmplitude: 0.36, fleckStrength: 0.8,
  oxStrength: 0.12, oxHex: 0x54585c, oxDeepStrength: 0.18, seamRustStrength: 0.22,   // cool grime, no warm oxide
  localSpace: true,   // the door rides the descent SEALED then swings at the wake — pin the grime (see hullMaterial.ts)
});
// Porthole GLASS — a faint cool tint, glossy so a small spec catch reads (a window, not an
// open hole). Slightly emissive so it never goes fully black against the void.
const _cabGlass = new THREE.MeshStandardMaterial({
  // SEV1 — lifted the tint a touch cooler/lighter + dropped opacity so the whole disc reads
  // see-through in BOTH states: the DESCENT view (sky/planet through it) AND the OPEN door on the
  // desert (the upper half no longer darkens toward the old void read). Still glazed enough that a
  // spec catch + faint tint sell it as a real pane, not an open hole.
  color: 0x36434e, roughness: 0.16, metalness: 0.28,
  emissive: 0x0c1620, emissiveIntensity: 0.45,
  transparent: true, opacity: 0.24,   // see the planet/desert through it, but a glazed pane reads
});
// A faint bright spec highlight on the porthole glass (a glazed-pane tell). A SOFT
// radial-falloff additive blob (NOT a hard-edged plane — the old PlaneGeometry quad read
// as a grey rectangle floating in the void; gate gave a fake decal edge). Feathered to an
// elongated crescent via the UV ellipse so it reads as a glint, with no hard parallel edges.
const _cabGlassSpec = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
  uniforms: {},
  vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader: [
    'precision mediump float; varying vec2 vUv;',
    'void main(){',
    '  vec2 p = vUv - 0.5;',
    '  p.x *= 2.6;',                                  // elongate into a streak
    '  float d = length(p);',
    '  float a = smoothstep(0.5, 0.0, d) * 0.16;',    // soft radial falloff, faint
    '  gl_FragColor = vec4(vec3(0.62,0.72,0.82) * a, a);',
    '}',
  ].join('\n'),
});
// The EJECT control handle (a hazard-striped pull) — warm safety-yellow grip.
const _ejectGrip = new THREE.MeshLambertMaterial({ color: 0xe0b52e, flatShading: true });   // brighter safety-yellow (was dim mustard → read as a dark patch)
// The PARACHUTE lever grip — worn red rubber (the gag star; reads "pull me").
const _chuteGrip = new THREE.MeshLambertMaterial({ color: 0xb23a2e, flatShading: true });
let podGroup: THREE.Group | null = null;
const podBodies: RAPIER.RigidBody[] = [];
// R1b — the FAKE descent vista (planet body / atmosphere shell / starfield / low-alt
// ground-horizon plane + their ShaderMaterials) is DELETED: the pod now physically falls
// through the REAL world, so the porthole shows the REAL terrain + the REAL sky (driven by
// setSkyIntroMode). Only the re-entry FX (plasma + heat-shimmer past the glass) remain — they
// layer over the real-world view as the pod punches the upper atmosphere.
// ── RE-ENTRY FX (Phase 2 / T2.2) — plasma/fire past the glass + viewport heat-shimmer.
//    Both layer IN FRONT of the vista (between the low-alt plane z−5 and the glass z≈−1.22)
//    but BEHIND the porthole frame, so depthTest lets the cabin bezel/wall occlude them to
//    the round aperture (they read THROUGH the porthole only — never on the cabin interior).
//    Driven by a single `re` (the re-entry bump) computed in setDescentProgress from `p`.
let reentryPlasmaMat: THREE.ShaderMaterial | null = null;   // additive incandescent air burning past the window
let reentryPlasmaMesh: THREE.Mesh | null = null;
let reentryShimmerMat: THREE.ShaderMaterial | null = null;  // the heat-haze wobble over the porthole vista
let reentryShimmerMesh: THREE.Mesh | null = null;
let _reentryT0 = 0;   // build-time epoch (for the plasma/shimmer animation time, in seconds)
// T2.1 remainder — the cabin interior-lit-by-exterior: setDescentProgress drives the porthole
// spill (cool space-light → warm dawn wash) + a hint of dawn on the ambient fill, so the cabin
// warms as the dawn desert swells in the viewport. Refs captured at build; reset by progress.
let vpGlowLight: THREE.PointLight | null = null;
let cabinFill: THREE.HemisphereLight | null = null;
const _VP_COOL = new THREE.Color(0xa6c0d6);    // porthole spill in space — cool window light
// CONSISTENT-MIDDAY (user re-scope, 2026-07-01): the descent arrives at + the crash/wake happen in
//   a bright CLEAR MIDDAY (not dawn). The porthole/hatch spill that washes the cabin is now bright
//   neutral MIDDAY SUN (a faint warm, near-white daylight), NOT the old dawn-orange — so the cabin
//   the player wakes/climbs out of is lit by the SAME midday desert they step out into.
const _VP_WARM = new THREE.Color(0xfff2e0);    // porthole spill at the midday desert — bright near-white daylight (was dawn-orange 0xffb070)
const _FILL_COOL = new THREE.Color(0x93a0b0);  // ambient sky-tint in space (matches the build default)
const _FILL_WARM = new THREE.Color(0xd9d2c4);  // ambient sky-tint at midday (bright neutral daylight; was warm-dawn 0xb89a82)
const _VP_BLAST = new THREE.Color(0xff7a2e);   // T2.3 — the explosion flooding the cabin (hot blast-orange) during the tumble
const _FILL_BLAST = new THREE.Color(0xdc8a48); // T2.3 — the blast wash on the ambient fill
const _vpScratch = new THREE.Color();
const _fillScratch = new THREE.Color();
let chuteLever: THREE.Group | null = null;  // the parachute lever pivot (setParachuteLeverPull)
let chuteLeverRestX = 0;                     // its resting pitch (radians); pulls jolt from here
let leverBrokenTell: THREE.Group | null = null;  // the snapped-mount reveal (shown on snap)
let _chutePullState = 0;                     // Y7 — last chute pull t (re-applied after a rebuild re-creates the interior)
let _chuteSnapState = false;                 // Y7 — last chute snapped flag (re-applied after a rebuild)
// Y7 — the EJECT lever pull animation. The T-handle now hangs off a clevis PIVOT so it can swing
//   DOWN when the player ejects (previously the eject fired with no visible lever motion). setEjectLeverPull
//   drives ejectLever.rotation.z from ejectLeverRestZ (rest/up) to +swing (fully pulled down). Module-scope
//   so a descent/crash rebuild doesn't realloc; _ejectPullState is re-applied when the interior rebuilds.
let ejectLever: THREE.Group | null = null;   // the eject T-handle pivot (setEjectLeverPull)
let ejectLeverRestZ = 0;                     // its resting swing angle (radians, local Z); 0 = up/rest
let _ejectPullState = 0;                     // Y7 — last eject pull t (re-applied after a rebuild)
const EJECT_SWING = 1.15;                    // radians the handle swings on a full pull (~66°) — a clear pull-down throw
const _cabinDisposables: THREE.BufferGeometry[] = [];   // per-build geometry to free on dispose
// X2b — per-build CLONED door materials (the sealed through-bore's DoubleSide slab clone). Module
//   materials are NOT disposed, but these per-build clones must be, so a replayed intro doesn't leak.
const _cabinDoorMats: THREE.Material[] = [];

// ── CLUSTER D — the escape exit is now THE MERGED FRONT DOOR (−Z, unified with the viewport).
//    The old separate side hatch (HATCH_AZ=-1.25) RETIRES: the wake kicks open the SAME front door
//    the player watched the descent through, and walks out the −Z opening onto the real terrain.
//    The HATCH_* names alias the FDOOR_* front-door geometry so the wall/hoop-gap + exterior-skin +
//    collider machinery (all parameterized on HATCH_*) now cut the ONE −Z aperture. Set by
//    buildCabinHatch (the swinging door WITH its integral domed porthole); blowCabinHatch swings it.
const HATCH_AZ = FDOOR_AZ;             // the wake-exit door IS the −Z front door (the viewport door)
const HATCH_W = FDOOR_W, HATCH_H = FDOOR_H;   // the door opening = the front-door aperture (climb-through)
const HATCH_CY = FDOOR_CY;             // the door centre height = the front-door centre
let cabinHatchPivot: THREE.Group | null = null;   // the cabin door's hinge pivot (blowCabinHatch)
let _cabinHatchAjarY = 0;                          // the door's ajar resting yaw (blow swings from here)
let hatchSpillLight: THREE.PointLight | null = null;   // dawn spilling through the open hatch (wake)
let cabinLamp: THREE.PointLight | null = null;     // the ceiling lamp KEY (brightened a touch on the dawn wake)
// Item 1 (wake brightness) — the interior RAKE directionals. On the crashed wake, the metallic
//   hull surfaces need DIRECTIONAL light to read (a hemisphere ambient barely lights PBR metal);
//   these are the only interior lights that hit every surface uniformly like the real midday sun,
//   so setCabinCrashPose floods them UP (the point lamps/hatch-spill are pooled + can't reach the
//   walls). Stored at build; driven by setCabinCrashPose / reset to the dim descent base.
let cabinKeyRake: THREE.DirectionalLight | null = null;   // warm right→left rake (the form/curvature key)
let cabinCoolRake: THREE.DirectionalLight | null = null;  // cool left counter-rake (keeps the far arc alive)
// R3a — the cabin's crashed POSE at the spawn: impact tilts/settles the descent cabin to a
// crashed lean (it slammed in). 0 = upright (descent), 1 = full crashed lean. Applied to the pod
// GROUP's rotation in _syncPodToAltitude / _applyCrashPose. The pivot is the floor-base centre.
let _crashPose = 0;
// ONE-ENTERABLE-POD (user re-scope): the crashed lean is now GENTLE — the SAME pod persists as a
//   WALK-IN structure the player walks back into, so the floor must stay walkable (a steep 15° tilt
//   is disorienting to walk on). A slight slam-in lean reads "crashed" while keeping the bore level
//   enough to stand + walk. unify keeps THIS lean (no tilt-snap at step-out — the wake cabin already
//   sits at it). (Was 0.26/0.14 — a steep lean tuned for the old non-walkable interior-only cabin.)
const _CRASH_PITCH = 0.075, _CRASH_ROLL = 0.045, _CRASH_YAW = 0.0;   // the settled GENTLE crashed lean (radians ≈ 4°/2.6°)
// W6 item 5 (user, 2026-07-03: "the lighting is STILL super bright and washed out at exit — make
//   it the original world lighting"): the wake EXPOSURE LIFT is REMOVED. The renderer exposure stays
//   at the desert base (1.05) from the crash onward; the enclosed wake cabin reads by REAL INTERIOR
//   LAMPS (the WAKE_* levels below), not a global tone-curve lift that then had to ease back at exit
//   (that ease WAS the washed-out exit the user still saw). CABIN_BASE_EXPOSURE is the ONE exposure
//   the whole crash→wake→step-out→walk-in leg runs at — nothing to lift, nothing to ease, no shift.
const CABIN_BASE_EXPOSURE = 1.05;   // matches scene.ts renderer.toneMappingExposure (the desert base) — held constant from the crash onward
// ── WAKE / WALK-IN interior LAMP levels (W6 item 5). ONE set of levels for BOTH the wake cabin
//    (setCabinCrashPose s→1) AND the persistent walk-in pod (parkPodLights), so there is ZERO light
//    shift across the wake→step-out→walk-in threshold. Tuned to read the enclosed crashed cabin at
//    the desert-base exposure (1.05) with only the ajar door letting sun in; the walk-in adds the
//    real midday sun through the blown-open door on top (a natural brighten walking into daylight,
//    the SAME lamps — not a state change). The BASE_* are the dim descent (in-space) build levels the
//    lamps lerp FROM as the crash pose settles. (Replaces the old flood levels tuned for the 1.62 lift.)
const CABIN_FILL_BASE = 0.72;       // hemisphere fill — the dim in-space descent level (build default)
const LAMP_BASE = 1.7;              // ceiling lamp — build default
const KEY_RAKE_BASE = 0.6;          // warm rake — build default
const COOL_RAKE_BASE = 0.28;        // cool counter-rake — build default
// (kept under the persistence gate's anti-wash-out ceilings — max interior intensity ≤ 2.5, hatch
//  point-light reach ≤ 5.0 m — so the walk-in never blows out the interior or pools a hot spot on
//  the sand; the enclosed read is carried by the fill + rakes + lamp, not a bright terrain-reaching spill.)
// (WAKE_CABIN_FILL / WAKE_KEY_RAKE / WAKE_COOL_RAKE removed 2026-07-05 — those drove SCENE-GLOBAL
//  lights that washed the whole desert once the pod persisted; grounded, all globals park at ZERO.)
const WAKE_CABIN_LAMP = 2.5;        // ceiling lamp at the wake / walk-in — boosted (2.0→2.5, AT the
                                    //   persistence gate's anti-wash ceiling) to carry the interior
                                    //   read now the scene-global fill/rakes park at ZERO (leak fix)
const WAKE_VP_GLOW = 1.35;          // porthole glow — a calm cool accent forward
const WAKE_HATCH_SPILL = 2.4;       // the door spill (a warm bounce into the bore); ≤ 2.5 so it never blows out / pools on the sand
const WAKE_HATCH_DIST = 4.8;        // the door-spill reach (≤ 5.0 — covers the bore without spilling far onto the terrain)

/** Is the pod currently built? */
export function podBuilt(): boolean {
  return podGroup !== null;
}

/** PERF PRELOAD — hide (true) or reveal (false) the PREBUILT pod cabin without disposing it, so
 *  the up-front preload can build+compile the cabin (+ its re-entry FX) once, then park it
 *  INVISIBLE (at the orbit offset y=3200) so its cabin lights don't leak into the cockpit view —
 *  until the beat that seats the player inside it (ensureInPod / the descent rebuild) reveals it.
 *  Null-guarded (safe if the pod isn't built). The descent's dispose+rebuild yields a fresh
 *  visible pod regardless; this only matters for the enterPod-seal reuse of the preloaded cabin. */
export function setPodHidden(hidden: boolean): void {
  if (podGroup) podGroup.visible = !hidden;
}

/** Set the real-world pod BASE for the descent from the player's real spawn (returnPos —
 *  the floor-top centre on the ground). The descending pod = this base + the current
 *  altitude. Called when the descent begins (the beats pass returnPos). Idempotent-ish:
 *  re-setting just updates the base. Pass null to clear (revert to the orbit-frame offset). */
export function setDescentBase(returnPos: { x: number; y: number; z: number } | null): void {
  _descentBase = returnPos ? new THREE.Vector3(returnPos.x, returnPos.y, returnPos.z) : null;
}

/** The pod GROUP's world origin (floor-top centre) THIS frame: the real-world descent base
 *  + the current altitude if the descent is grounded, else the orbit-frame offset. */
function _podWorldOrigin(): THREE.Vector3 {
  if (_descentBase) {
    return new THREE.Vector3(_descentBase.x, _descentBase.y + _podAltitude, _descentBase.z);
  }
  return POD_ORIGIN.clone();
}

/** World-space seated spawn: pod centre-ish, on the floor, slightly aft so the viewport
 *  fills the view ahead + the seat backs the player. Capsule centre = floor-top +
 *  halfHeight + radius. (The seat sits at z≈+0.55; the spawn is just forward of it so
 *  the player's back is against the seat-back and the viewport reads dead ahead.) Tracks
 *  the descending pod origin (R1b) when the descent is grounded; else the orbit offset. */
export function getPodSpawn(ctx: GameContext): THREE.Vector3 {
  const pb = ctx.player.body;
  const o = _podWorldOrigin();
  return new THREE.Vector3(o.x, o.y + pb.halfHeight + pb.radius, o.z + 0.35);
}

/** W6 item 6 — probe the cabin door (hatch) pivot's rotation, to diagnose the "slanted sealed door".
 *  Reports the pivot's LOCAL euler + its WORLD euler (the group tilt folds in at the crash). A sealed
 *  door should read local (0,0,0); a non-zero local x/z is a build/anim residual (the slant). */
export function probeCabinDoor(): {
  built: boolean; localX: number; localY: number; localZ: number;
  worldX: number; worldY: number; worldZ: number; ajarY: number;
} {
  if (!cabinHatchPivot) return { built: false, localX: 0, localY: 0, localZ: 0, worldX: 0, worldY: 0, worldZ: 0, ajarY: _cabinHatchAjarY };
  cabinHatchPivot.updateMatrixWorld(true);
  const we = new THREE.Euler().setFromQuaternion(cabinHatchPivot.getWorldQuaternion(new THREE.Quaternion()), 'YXZ');
  return {
    built: true,
    localX: +cabinHatchPivot.rotation.x.toFixed(4), localY: +cabinHatchPivot.rotation.y.toFixed(4), localZ: +cabinHatchPivot.rotation.z.toFixed(4),
    worldX: +we.x.toFixed(4), worldY: +we.y.toFixed(4), worldZ: +we.z.toFixed(4), ajarY: _cabinHatchAjarY,
  };
}

/** W6 item 5 — the pod's CURRENT ALTITUDE above the descent base (m). DESCENT_ALT high at the
 *  start of the fall, eased to 0 at the ground by setDescentProgress. Used by the descent-fog blend
 *  (the fog normalizes to survival as the pod drops through the lower atmosphere). */
export function getPodAltitude(): number { return _podAltitude; }

/** W6 item 4 — the seated spawn TRANSFORMED THROUGH THE POD'S CURRENT TILT. getPodSpawn returns the
 *  UPRIGHT seat (pod origin + seat offset); during the crash the pod GROUP rotates about its floor
 *  origin (setCabinCrashPose eases _crashPose 0→1), so the true in-cabin seat swings with it. This
 *  applies the group's live world matrix to the LOCAL seat point so the re-seated body/eye tracks the
 *  tilting cabin exactly — the camera stays planted in the seat as the pod grounds + leans, instead of
 *  hanging at the untilted position (a small lag that, stacked with a mid-air body, is the
 *  "view above the pod" bug). Falls back to getPodSpawn when the pod isn't grounded/built. */
export function getCrashedSeatWorld(ctx: GameContext): THREE.Vector3 {
  const pb = ctx.player.body;
  if (!podGroup || !_descentBase) return getPodSpawn(ctx);
  podGroup.updateMatrixWorld(true);
  // LOCAL seat point: the group origin is the floor-top centre, so the seat is at
  //   (0, halfHeight+radius, +0.35) in the pod's local frame (matches getPodSpawn's offset).
  const localSeat = new THREE.Vector3(0, pb.halfHeight + pb.radius, 0.35);
  return podGroup.localToWorld(localSeat);
}

/** W6 item 4 — IMPACT EYE-INSIDE-THE-CABIN probe (verification). Given a WORLD point (the camera
 *  eye), report whether it is inside the cabin shell THIS frame — accounting for the pod group's
 *  current crashed tilt (the group rotates about its floor origin, so a world point must be tested
 *  in the pod's LOCAL frame). Returns the local coords, the radial/height margins to the shell, and
 *  `inside` (true = the eye is within the bore, so the view stays in the pod; false = it clipped
 *  outside → the "seeing above the pod / the landscape" bug). Used by the impact-eye rig gate to
 *  prove the camera never leaves the cabin through the whole impact→wake. Null-safe (returns a
 *  built:false report when the pod isn't built). */
export function probeEyeInCabin(eye: { x: number; y: number; z: number }): {
  built: boolean; inside: boolean; localX: number; localY: number; localZ: number;
  radial: number; radialMargin: number; heightMargin: number;
} {
  if (!podGroup) return { built: false, inside: false, localX: 0, localY: 0, localZ: 0, radial: 0, radialMargin: 0, heightMargin: 0 };
  podGroup.updateMatrixWorld(true);
  const local = podGroup.worldToLocal(new THREE.Vector3(eye.x, eye.y, eye.z));
  const radial = Math.hypot(local.x, local.z);   // distance from the pod's vertical axis (local Y)
  // margins: how far INSIDE the shell the eye sits (positive = inside). The bore is radius CAB_R,
  //   floor 0 → apex CAB_APEX. A small tolerance lets the eye sit right at the shell without flagging.
  const radialMargin = CAB_R - radial;                    // + = inside the wall
  const heightMargin = Math.min(local.y, CAB_APEX - local.y);   // + = between floor and ceiling
  const inside = radialMargin > -0.02 && local.y > -0.02 && local.y < CAB_APEX + 0.02;
  return {
    built: true, inside, localX: +local.x.toFixed(3), localY: +local.y.toFixed(3), localZ: +local.z.toFixed(3),
    radial: +radial.toFixed(3), radialMargin: +radialMargin.toFixed(3), heightMargin: +heightMargin.toFixed(3),
  };
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

// ── Round-cabin build helpers ────────────────────────────────────────────────
/** A LatheGeometry mesh (tracked for disposal). `phiStart`/`phiLength` (default a full revolve)
 *  gap the revolve over an azimuth window — same sin/cos convention as _tube/CylinderGeometry, so a
 *  gap at `CPOD_DOOR_AZ + dAzHalf` for `2π − 2·dAzHalf` clears the front-door arc (round-1f fix:
 *  the full-revolve scorch fade + flared foot were NOT gapped, so they walled the lower doorway). */
function _lathe(prof: THREE.Vector2[], seg: number, mat: THREE.Material, phiStart = 0, phiLength = Math.PI * 2): THREE.Mesh {
  const g = new THREE.LatheGeometry(prof, seg, phiStart, phiLength);
  g.computeVertexNormals();
  _cabinDisposables.push(g);
  return new THREE.Mesh(g, mat);
}
/** An open (no-cap) cylinder mesh (tracked) — used for the ring-frames + the shell. */
function _tube(r: number, h: number, seg: number, mat: THREE.Material, thetaStart = 0, thetaLen = Math.PI * 2): THREE.Mesh {
  const g = new THREE.CylinderGeometry(r, r, h, seg, 1, true, thetaStart, thetaLen);
  _cabinDisposables.push(g);
  return new THREE.Mesh(g, mat);
}
/** THE ONE door-gap window helper (round-2a). Every full-revolve exterior piece (body bands,
 *  flared foot, reentry-scorch shell, riveted hoops) that crosses the door height MUST be emitted
 *  as the COMPLEMENTARY ARC that bridges AROUND the door opening — otherwise it stands a curved
 *  plate in the door plane, walling the aperture (invisible from inside = FrontSide, visible from
 *  outside — the exact round-1f/2a bug). This returns `[phiStart, phiLength]` for the surviving arc
 *  given the door azimuth `az` + its half-width `azHalf`. ALL THREE codepaths (buildCabinHatch's
 *  wall/hoops, buildCanonicalPodExterior, buildExteriorSkin) call this so a fourth divergent copy
 *  of the gap math is impossible by construction. (sin/cos θ-from-+Z convention — matches
 *  _tube/CylinderGeometry + _lathe/LatheGeometry.) */
function _doorGapArc(az: number, azHalf: number): [number, number] {
  return [az + azHalf, Math.PI * 2 - azHalf * 2];
}

/** Seat a mesh flush on the cylinder wall at azimuth `az` (θ from +Z toward +X — the
 *  CylinderGeometry convention; dir = (sin az, 0, cos az)), radius `r`, height `y`. The
 *  mesh is yawed so its local +Z faces the cabin centre (inward), matching the box-face
 *  convention used by the hardware groups. */
function _seatOnWall(mesh: THREE.Mesh, az: number, r: number, y: number): void {
  mesh.position.set(Math.sin(az) * r, y, Math.cos(az) * r);
  mesh.rotation.y = az + Math.PI;        // local +Z → inward (toward centre)
}

/** X2a — options for the ONE interior-construction path. `door` (default true) builds the
 *  merged −Z front door via buildCabinHatch (the ride cabin wants its own swinging door + the
 *  descent-view porthole). The BAY pod passes door:false + supplies its OWN +X door (shipScene
 *  drives its hinge), so the cabin door isn't doubled up on the bay build — but EVERYTHING ELSE
 *  (the sealing BackSide shell, dome, deck, rings, ribs, seat, console, eject, conduit) is the
 *  SAME real interior both places. `hatchAzHalfOverride` widens the shell/hoop door gap on the bay
 *  build so the bay's own (slightly wider) +X door aperture reads inside the opening, not clipped. */
interface CabinInteriorOpts { door?: boolean; }

/** Build the HERO cabin interior (mesh group) in the pod-LOCAL frame (floor top=0).
 *  A ROUND riveted-aluminium CAPSULE bore: a back-faced cylinder wall + an ogive dome
 *  ceiling, riveted ring-frames + curved ribs, a forward viewport arc, with the C10
 *  hardware (lever / eject / console / seat) re-homed curve-seated on the round wall.
 *  X2a — this is the ONE interior-construction path: BOTH the ride cabin (buildPodScene) and
 *  the canonical bay pod (buildCanonicalPodExterior, via buildUnifiedPodInterior) build their
 *  contents here, so the pod is the SAME model inside — no empty-shell "peek". */
// Y3 finding 4 — ROOT the duplicate-interior build. buildCabinInterior is the ONE interior
//   construction path (its only two callers are buildPodScene for the ride cabin + buildUnified-
//   PodInterior for the bay/landed pod). To make it IMPOSSIBLE for two interior generations to
//   coexist in one pod (the user's "old + new versions overlapping"), we (a) tag each group the
//   first time an interior is built into it + assert it's never built twice into the SAME group,
//   and (b) count live interiors module-wide so a stray second build (a rebuild that didn't
//   dispose) is caught at author time rather than shipping as visible clutter.
let _liveInteriorBuilds = 0;   // # of interiors constructed since the last dispose (should be ≤ the # of live pods)
function buildCabinInterior(group: THREE.Group, opts: CabinInteriorOpts = {}): void {
  // GUARD: never build a second interior into a group that already has one (the duplicate-build bug).
  if (group.userData._cabinInteriorBuilt) {
    console.warn('[podScene] buildCabinInterior called twice on the same group — refusing the duplicate (Y3 finding 4 guard).');
    return;
  }
  group.userData._cabinInteriorBuilt = true;
  _liveInteriorBuilds++;
  const withDoor = opts.door ?? true;
  // ── 1. SHELL — the ROUND capsule bore. A back-faced cylinder wall (you see the
  //    INSIDE of the curve) from the floor up to the shoulder, with a small ROUND
  //    PORTHOLE cut in the forward arc; a lathe OGIVE DOME ceiling; a floor disc + deck.
  // 1.a the curved wall — built CONTINUOUS (a full banded barrel) except for the round
  //     porthole forward: a full-circle band BELOW the window, a full-circle band ABOVE
  //     it, and two side arcs at window height that bracket the porthole azimuth. The
  //     planet reads through the real lofted gap; the wall reads as an unbroken barrel
  //     with a hole, NOT two posts flanking a rectangle (P1 — kills the visor gestalt).
  // CLUSTER D — the cabin wall is built CONTINUOUS as a stack of horizontal bands with ONE real
  //   aperture cut out: the merged −Z FRONT DOOR (§4 seats the swinging door + its integral domed
  //   porthole into it; §10's buildCabinHatch builds the door). Each band that overlaps the door's
  //   height is emitted as the wall arc that AVOIDS the door azimuth (a real lofted gap, not a decal
  //   — procedural-mesh-authoring.md), so the door reads as a real opening cut in an unbroken barrel.
  //   (The old separate round-porthole gap + side-hatch gap are unified into this single door gap.)
  const hY0 = HATCH_CY - HATCH_H / 2, hY1 = HATCH_CY + HATCH_H / 2;   // front-door vertical span
  const hatchAzHalf = FDOOR_AZ_HALF;   // the door's azimuth half-extent
  // emit a horizontal wall band [y0,y1], skipping any azimuth window in `gaps`
  //   (each gap = {c: centre azimuth, h: half-extent}). Splits the ring into the
  //   complementary arcs that bridge the gaps.
  const emitWallBand = (y0: number, y1: number, gaps: { c: number; h: number }[]): void => {
    const h = y1 - y0;
    if (h <= 0.0001) return;
    if (gaps.length === 0) {
      const t = _tube(CAB_R, h, WALL_SEG, _cabShell);
      t.position.y = (y0 + y1) / 2;
      group.add(t);
      return;
    }
    // normalize gap centres to [0,2π) + sort, then walk the gaps emitting the arc between them.
    const gs = gaps.map((g) => ({ s: g.c - g.h, e: g.c + g.h })).map((g) => {
      let s = g.s; while (s < 0) s += Math.PI * 2; while (s >= Math.PI * 2) s -= Math.PI * 2;
      return { s, e: s + (g.e - g.s) };   // e may exceed 2π (the arc wraps); handled by modulo on emit
    }).sort((a, b) => a.s - b.s);
    for (let i = 0; i < gs.length; i++) {
      const cur = gs[i], next = gs[(i + 1) % gs.length];
      const arcStart = cur.e % (Math.PI * 2);
      let arcEnd = next.s; if (i === gs.length - 1) arcEnd = gs[0].s + Math.PI * 2;
      const len = arcEnd - arcStart;
      if (len <= 0.001) continue;
      const t = _tube(CAB_R, h, WALL_SEG, _cabShell, arcStart, len);
      t.position.y = (y0 + y1) / 2;
      group.add(t);
    }
  };
  // the height zones: the band sequence ascends; a band gets the DOOR gap if it overlaps the
  //   door span [hY0,hY1]. Build the sorted unique band edges (0, door bottom, door top, WALL_H),
  //   then emit each — the door band is the complementary arc bridging around the −Z opening.
  const doorGap = { c: HATCH_AZ, h: hatchAzHalf };
  const edges = Array.from(new Set([0, hY0, hY1, WALL_H].filter((y) => y >= 0 && y <= WALL_H))).sort((a, b) => a - b);
  for (let i = 0; i < edges.length - 1; i++) {
    const y0 = edges[i], y1 = edges[i + 1];
    const mid = (y0 + y1) / 2;
    const gaps: { c: number; h: number }[] = [];
    if (mid > hY0 && mid < hY1) gaps.push(doorGap);
    emitWallBand(y0, y1, gaps);
  }
  // 1.b the OGIVE DOME ceiling — a lathe cap from the shoulder radius pulling in to a
  //     blunt apex, matching the exterior's tucked nose. Back-faced (seen from inside).
  const domeProf: THREE.Vector2[] = [];
  const domeSegs = 7;
  for (let i = 0; i <= domeSegs; i++) {
    const t = i / domeSegs;
    const a = t * (Math.PI / 2);
    const r = CAB_R * Math.pow(Math.cos(a), 1.45) + 0.001;   // tucked ogive (matches exterior nose)
    const y = WALL_H + Math.sin(a) * DOME_H;
    domeProf.push(new THREE.Vector2(Math.max(0.04, r), y));
  }
  const dome = _lathe(domeProf, WALL_SEG, _cabShell);
  group.add(dome);
  // SEV2 ceiling light-leak fix (2026-07-04): the wall is emitted as VERTICALLY-STACKED open-tube
  //   height bands (split at the door top/bottom) topped by the dome lathe — so there are horizontal
  //   ABUTMENT seams at the door-top band edge (hY1) AND at the wall↔dome shoulder (WALL_H). The two
  //   BackSide tubes at each seam sit edge-to-edge with slightly mismatched 48-facet vertex rings, so
  //   at grazing angles the bright exterior sparkled through the hairline facet gaps as faint DASHED
  //   arcs near the ceiling (undermining the sealed-shell read). FIX: a single tall back-faced inner
  //   LINER spanning the whole upper wall from just below hY1 up past the wall↔dome seam, set a hair
  //   INSIDE the shell radius so it covers BOTH seams (and the band between) from inside regardless of
  //   any sub-mm gap. Same _cabShell skin → invisible as a distinct surface; it only closes the seams.
  const linerY0 = hY1 - 0.06, linerY1 = WALL_H + 0.08;   // straddle the hY1 seam → past the shoulder seam
  const seamLiner = _tube(CAB_R - 0.006, linerY1 - linerY0, WALL_SEG, _cabShell);
  seamLiner.position.y = (linerY0 + linerY1) / 2;
  group.add(seamLiner);
  // (the dome is left as smooth back-faced aluminium with the shoulder ring §2 capping it
  //  — radial seam ribs read as floating bars in the seated FP frame, and the exterior's
  //  ogive nose is itself mostly smooth aluminium, so smooth is the faithful read.)
  // a short riveted spoke RING at the dome base (just above the shoulder) reinforces the
  //  "nose bolts to the body" read without crossing the cabin.
  for (let s = 0; s < 16; s++) {
    const az = (s / 16) * Math.PI * 2 + 0.15;
    const sg = new THREE.SphereGeometry(0.012, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2);
    _cabinDisposables.push(sg);
    const stud = new THREE.Mesh(sg, _cabRivet);
    const r = CAB_R * 0.92;
    const y = WALL_H + 0.08;
    stud.position.set(Math.sin(az) * r, y, Math.cos(az) * r);
    stud.lookAt(0, y, 0);
    group.add(stud);
  }
  // 1.c FLOOR — a real curved riveted-aluminium DECK plate (the seated player stares down
  //     at this for 20-30s, so it must be a finished floor, NOT a dark void, P2). A solid
  //     aluminium deck disc (bright skin tone) + a ring of deck-plate rivets + a forward
  //     FOOTWELL recess (where the feet rest below the seat). A dark structural sub-floor
  //     disc beneath the deck so any rim gap reads as hull, not space.
  // Y5 lint fix (base penetration): the old subFloor sat at y=−0.08 (bottom −0.16), dipping 16cm
  //   BELOW the pod's authored y=0 base plane (poking through the exterior heat-shield foot). It's a
  //   RIM-CLOSER (fills the seam between the deck disc r=1.26 and the wall r=1.28), so it only needs
  //   to sit UNDER the deck, not below the hull base. Seat it flush ON y=0 (spans 0→0.05, under the
  //   0.025-centred deck plate) → no penetration, same "no space through the rim" read.
  const subFloor = _cyl(CAB_R + SHELL, CAB_R + SHELL, 0.05, WALL_SEG, _cabChannel);
  subFloor.position.y = 0.025;
  group.add(subFloor);
  // the visible aluminium deck plate (bright skin so the floor is LIT, not a void)
  const deck = _cyl(CAB_R - 0.02, CAB_R - 0.02, 0.05, WALL_SEG, _cabDeck);
  deck.position.y = 0.025;
  group.add(deck);
  // deck-plate rivet ring near the floor edge (the riveted-deck tell)
  for (let i = 0; i < 32; i++) {
    const a = (i / 32) * Math.PI * 2 + 0.07;
    const sg = new THREE.SphereGeometry(0.015, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2);
    _cabinDisposables.push(sg);
    const rv = new THREE.Mesh(sg, _cabRivet);   // flush up-facing deck stud (low dome, not a peg)
    rv.position.set(Math.sin(a) * (CAB_R - 0.16), 0.052, Math.cos(a) * (CAB_R - 0.16));
    group.add(rv);
  }
  // raised tread strips across the deck (anti-slip plate ribs — break up the flat disc so
  // the floor reads as a fabricated deck, not a smooth pan). Run fore-aft, offset rows.
  // D-fix (2026-07-05): the OUTER strips (|r|=2, x≈±0.68) ran full-length (1.5m) out to where the deck
  //   disc curves down toward the wall — at the raking descent camera their fore ends read as a lone
  //   floating "rod" lying diagonally on the floor (no fabricated-deck read, just a stray bar). Fix:
  //   keep the strips ON the flat central deck by TAPERING the length with |r| (outer rows shorter) and
  //   biasing them slightly aft (+z), clear of the footwell rim (z≈−0.62) and the curving deck edge, so
  //   every strip's ends land on flat plate — no end floats at the rim.
  for (let r = -2; r <= 2; r++) {
    const len = 1.34 - Math.abs(r) * 0.30;                 // 1.34 centre → 0.74 outer (kept on the flat deck)
    const tread = _box(0.07, 0.018, len, _cabSteel);
    tread.position.set(r * 0.34, 0.06, 0.12);              // biased aft so no fore end reaches the rim
    group.add(tread);
  }
  // FOOTWELL — a marked foot-rest zone FORWARD of the seat (−Z): a bright rim lip + a dark inset
  //   pan. Y5 lint fix: the old pan sat at y=−0.02 (bottom −0.07), dipping BELOW the y=0 base plane
  //   (poking through the hull foot). It now sits FLUSH ON the base (pan spans 0→0.045, just below the
  //   0.05 deck-top so it still reads inset) — the same footwell read without penetrating the base.
  const wellRim = _cyl(0.44, 0.44, 0.06, 20, _cabBand);
  wellRim.position.set(0, 0.05, -0.62);
  group.add(wellRim);
  const wellPan = _cyl(0.38, 0.38, 0.045, 20, _cabSteel);
  wellPan.position.set(0, 0.0225, -0.62);
  group.add(wellPan);
  // a couple of foot-rest treads in the well
  for (const wz of [-0.5, -0.74]) {
    const ft = _box(0.5, 0.025, 0.07, _cabRivet);
    ft.position.set(0, 0.02, wz);
    group.add(ft);
  }
  // 1.d a chunky channel-steel FLOOR RING capping the wall-to-floor seam. Y3 finding 1 (the "black
  //     wall lower half" on first door-open): the old full-circle footRing (r=CAB_R−0.03, y 0→0.18)
  //     was a SOLID band crossing the lower ~7cm of the door aperture (bottom at HATCH_CY−HATCH_H/2 =
  //     0.11) — proud into the bore, BackSide, dark — so looking IN through the open door the lower
  //     doorway read as a dark wall. FIX: gap the ring over the door azimuth (same complementary-arc
  //     scheme as the wall bands/hoops), and drop its top to the sill line (0.11) so the walk-through
  //     threshold is clean. The foot seam still reads as a welded ring everywhere except the doorway.
  {
    // Gap at HATCH_AZ ALWAYS — the shell aperture is cut there in BOTH the ride cabin (its own −Z
    //   door) and the bay/landed pod (the whole interior sub-group is yawed so −Z→+X, and its +X
    //   door fills that same aperture), so the foot ring must clear the doorway in both cases.
    const fRingR = CAB_R - 0.03, fRingH = 0.11, fRingY = fRingH / 2;   // top at 0.11 = the door sill (no lip into the aperture)
    const fGapHalf = Math.min(Math.PI * 0.9, (HATCH_W / 2 + 0.06) / CAB_R);
    const arcStart = HATCH_AZ + fGapHalf, arcLen = Math.PI * 2 - fGapHalf * 2;
    const fr = _tube(fRingR, fRingH, WALL_SEG, _cabBandShell, arcStart, arcLen); fr.position.y = fRingY; group.add(fr);
  }

  // ── 2. RIVETED RING-FRAMES — proud aluminium hoops banding the curved wall at
  //    intervals (the "riveted aluminium capsule" read, matching the exterior latitude
  //    bands), each with a ring of rivet studs. Built as FULL-circle open tubes JUST
  //    inside the wall radius (proud into the cabin) — they run PAST the porthole so the
  //    window reads as a hole cut in a continuous BANDED BARREL (P1). A hoop crossing the
  //    porthole height passes behind the bezel; only the rivet studs inside the round
  //    aperture are skipped (so no studs float across the glass).
  const RING_RIVETS = 48;   // FIX 3 — denser, smaller flush studs (was 30 chunky pegs)
  // CLUSTER D — does the merged FRONT DOOR cross this hoop height? If so, its azimuth half-extent
  //   (0 if the row is clear of the door). Gaps the hoop so the band doesn't bar the −Z opening.
  const hY0r = HATCH_CY - HATCH_H / 2, hY1r = HATCH_CY + HATCH_H / 2;
  const doorAzHalfR = Math.min(Math.PI * 0.9, (HATCH_W / 2) / CAB_R + 0.04);
  const doorAzHalfAt = (y: number) => (y > hY0r - 0.04 && y < hY1r + 0.04) ? doorAzHalfR : 0;
  // is the wall point at (az,y) inside the door opening? (used to skip studs over the door)
  const inDoor = (az: number, y: number) => {
    if (y <= hY0r || y >= hY1r) return false;
    let d = az - HATCH_AZ; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
    return Math.abs(d) < doorAzHalfR;
  };
  // A ring-frame hoop. `proud` = how far it stands INTO the cabin off the wall (a BENT
  //  bright band that visibly arcs L→R is the fastest "this is round" cue — FIX 1). Rivets
  //  are small FLUSH dome studs seated tight to the wall (FIX 3 — not chunky proud pegs).
  //  The hoop gaps the FRONT DOOR (CLUSTER D — the single −Z aperture) so it isn't barred.
  const addRing = (y: number, h: number, proud = 0.05, riveted = true) => {
    const ringR = CAB_R - proud;
    // collect the azimuth window this hoop must bridge (the front door)
    const gaps: { c: number; hh: number }[] = [];
    const hg = doorAzHalfAt(y); if (hg > 0) gaps.push({ c: HATCH_AZ, hh: hg });
    if (gaps.length === 0) {
      const hoop = _tube(ringR, h, WALL_SEG, _cabBandShell);
      hoop.position.y = y;
      group.add(hoop);
    } else {
      // emit the complementary arcs that bridge the gaps (same scheme as the wall bands).
      const gs = gaps.map((g) => { let s = g.c - g.hh; while (s < 0) s += Math.PI * 2; while (s >= Math.PI * 2) s -= Math.PI * 2; return { s, e: s + g.hh * 2 }; }).sort((a, b) => a.s - b.s);
      for (let i = 0; i < gs.length; i++) {
        const arcStart = gs[i].e % (Math.PI * 2);
        let arcEnd = gs[(i + 1) % gs.length].s; if (i === gs.length - 1) arcEnd = gs[0].s + Math.PI * 2;
        const len = arcEnd - arcStart;
        if (len <= 0.001) continue;
        const hoop = _tube(ringR, h, WALL_SEG, _cabBandShell, arcStart, len);
        hoop.position.y = y;
        group.add(hoop);
      }
    }
    if (!riveted) return;
    for (let i = 0; i < RING_RIVETS; i++) {
      const az = (i / RING_RIVETS) * Math.PI * 2;
      if (inDoor(az, y)) continue;                     // CLUSTER D — skip studs over the front-door opening
      // small low-poly FLUSH dome stud (a half-sphere flush to the wall — reads as a
      // fastened seam rivet, NOT a furniture bolt sticking proud).
      const sg = new THREE.SphereGeometry(0.013, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2);
      _cabinDisposables.push(sg);
      const stud = new THREE.Mesh(sg, _cabRivet);
      const dir = new THREE.Vector3(Math.sin(az), 0, Math.cos(az));
      stud.position.set(dir.x * (CAB_R - 0.012), y, dir.z * (CAB_R - 0.012));
      stud.lookAt(0, y, 0);                             // dome faces into the cabin (flush cap)
      group.add(stud);
    }
  };
  // The hoop set. The CHEST-height hoop (≈VP_CY) is the headline bent band — built PROUD +
  // bright + DOUBLED (a taller channel) so it visibly arcs across the eye-level frame. The
  // foot + shoulder hoops are flush bands that close the barrel top + bottom.
  addRing(0.46, 0.13, 0.05);
  addRing(0.92, 0.10, 0.045);                          // an extra mid-low hoop → denser banding (more "round" cues)
  addRing(VP_CY - 0.02, 0.17, 0.085);                  // HEADLINE chest hoop: tall + proud, brackets the porthole, arcs L→R
  addRing(VP_CY + 0.40, 0.10, 0.05, false);            // a thin un-riveted upper hoop (extra horizontal cue, clear of the porthole-stud field)
  addRing(WALL_H - 0.12, 0.14, 0.06);                  // shoulder ring where the dome springs

  // ── 3. VERTICAL RIBS — channel-steel battens running UP the wall (the welded skeleton).
  //    C12 FIX 1: dominant verticals read RECTILINEAR/BOXY on a cylinder — they made the
  //    eye-level wall read as a panelled box. So: (a) NO ribs on the FORWARD arc (the
  //    viewport view must be all curved hoop + arc, no vertical posts flanking the porthole
  //    — that was the boxy read); (b) ribs only on the REAR/SIDE arcs (θ near 0 / ±2.x,
  //    behind the seated head-turn-forward read); (c) THINNER (a slim batten, not a wide
  //    plate+spine slab) so even when a head-turn catches one it doesn't chord the arc.
  //    The horizontal RING-FRAMES (§2) now carry the structure read instead.
  // ROUND-1f: rib-a moved 0.0 → 4.15 (the thin grey CENTRE rod the user saw through the bay door —
  //   az=0.0 sits dead-centre in the +X-door collar sightline behind the seat). At 4.15 it's hidden
  //   behind the pod body in the bay AND behind the ride player, and it rides alongside the relocated
  //   conduit (az=4.30) so the two read as a clamped utility spine. rib-b (2.25) stays (bay-hidden).
  const ribAzs = [4.15, 2.25];   // rear-right + far-side; nothing on the forward arc or the bay-door sightline
  const ribY = WALL_H / 2 - 0.02, ribH = WALL_H - 0.30;
  for (const az of ribAzs) {
    // a SLIM batten hugging the wall (band-metal so it reads welded-on, but narrow → no chord)
    const base = _box(0.08, ribH, 0.035, _cabBand);
    _seatOnWall(base, az, CAB_R - 0.035, ribY);
    group.add(base);
    // a thin proud spine (darker steel) — slim so it reads as a seam batten, not a beam
    const spine = _box(0.04, ribH, 0.05, _cabSteel);
    _seatOnWall(spine, az, CAB_R - 0.075, ribY);
    group.add(spine);
    // rivet studs down the rib (small + flush — FIX 3 idiom)
    for (let k = 0; k < 5; k++) {
      const ry = 0.32 + k * ((ribH - 0.5) / 4);
      const stud = _cyl(0.013, 0.013, 0.02, 6, _cabRivet);
      stud.rotation.x = Math.PI / 2;
      _seatOnWall(stud, az, CAB_R - 0.045, ry);
      group.add(stud);
    }
  }
  // (no big cross-cabin ceiling stringers — they read as a pipe arcing across the view;
  //  the riveted ring-frames §2 carry the structure read.)

  // ── 4. CLUSTER D — the forward viewport is now the DOMED PORTHOLE IN THE FRONT DOOR (built by
  //    §10 buildCabinHatch, so it swings open with the door at the wake). Nothing built here — the
  //    single −Z aperture is the door; the descent view reads through the door's porthole glass.
  //    (buildViewport RETIRED — the bare-wall porthole is merged into the door slab.)

  // ── 5. The SEAT + restraints — a real CONTOURED BUCKET seat you sit IN (not stacked
  //    boxes that read as a staircase, P2): a steel PEDESTAL → a cushion pan with raised
  //    side BOLSTERS → a back with side WINGS → a headrest → over-shoulder straps + a lap
  //    buckle. Re-homed at the rear (+Z) curve, just aft of the seated spawn.
  const seatZ = 0.70, seatY = 0.44;
  // pedestal column (a single tapered post, not a wide box-base that reads as a step)
  const pedestal = _cyl(0.16, 0.22, seatY - 0.02, 12, _cabChannel);
  pedestal.position.set(0, (seatY - 0.02) / 2, seatZ + 0.04);
  group.add(pedestal);
  const pedFoot = _cyl(0.30, 0.30, 0.05, 14, _cabSteel);
  pedFoot.position.set(0, 0.03, seatZ + 0.04);
  group.add(pedFoot);
  // cushion pan (the seat base) — a rounded slab; slightly scaled to read soft
  const cushion = _box(0.54, 0.14, 0.50, _cabSeat);
  cushion.position.set(0, seatY, seatZ);
  group.add(cushion);
  // raised side bolsters on the cushion (the "bucket" — you sit BETWEEN them)
  for (const sx of [-1, 1]) {
    const bolster = _box(0.10, 0.12, 0.46, _cabSeat);
    bolster.position.set(sx * 0.26, seatY + 0.08, seatZ);
    group.add(bolster);
  }
  // the seat BACK — canted back slightly so you recline INTO it (not a vertical wall)
  const seatBack = _box(0.50, 0.88, 0.14, _cabSeat);
  seatBack.position.set(0, seatY + 0.46, seatZ + 0.26);
  seatBack.rotation.x = -0.12;          // recline
  group.add(seatBack);
  // back side WINGS (wrap-around — reinforces "you sit in it")
  for (const sx of [-1, 1]) {
    const wing = _box(0.10, 0.78, 0.20, _cabSeat);
    wing.position.set(sx * 0.27, seatY + 0.44, seatZ + 0.20);
    wing.rotation.x = -0.12;
    group.add(wing);
  }
  const headRest = _box(0.30, 0.20, 0.13, _cabSeat);
  headRest.position.set(0, seatY + 0.96, seatZ + 0.34);
  group.add(headRest);
  // over-shoulder restraint straps (5-point harness tells)
  for (const sx of [-1, 1]) {
    const strap = _box(0.09, 0.92, 0.035, _cabStrap);
    strap.position.set(sx * 0.16, seatY + 0.46, seatZ + 0.04);
    strap.rotation.x = 0.30;
    group.add(strap);
  }
  const buckle = _box(0.15, 0.11, 0.07, _cabSteel);
  buckle.position.set(0, seatY + 0.10, seatZ - 0.26);
  group.add(buckle);

  // ── 6. RIGHT-side CONSOLE (+X) + the PARACHUTE LEVER — curve-seated against the round
  //    wall. A waist-high cabinet hugging the curve + a canted instrument deck + the
  //    chunky red parachute lever rising off it. The defining usable hardware.
  buildConsoleAndLever(group);

  // ── 7. The EJECT control (LEFT/−X side) — a guarded hazard-yellow T-handle on a panel
  //    curve-seated on the left wall, in seated reach (the enterPod "pull eject" beat).
  buildEjectControl(group);

  // ── 8. CONDUIT + CABLING + a ceiling dome light — lived-in tells following the curve.
  buildConduitAndLight(group);

  // ── 9. A grab handle overhead (brace against the jolts) — a humanising prop on the
  //    aft-left (θ≈−0.85) so it doesn't block the forward viewport read. A tangential bar
  //    on two stubby standoffs off the curve.
  const grabAz = 0.55;   // R3a — moved to the rear-right (was −0.85) to clear the escape HATCH arc (−1.25)
  const gDir = new THREE.Vector3(Math.sin(grabAz), 0, Math.cos(grabAz));
  const grab = _cyl(0.026, 0.026, 0.42, 8, _cabSteel);
  grab.position.set(gDir.x * (CAB_R - 0.14), WALL_H - 0.18, gDir.z * (CAB_R - 0.14));
  grab.rotation.y = grabAz;          // run the bar tangentially (along the wall arc)
  grab.rotation.z = Math.PI / 2;
  group.add(grab);
  // tangent direction along the wall arc (perpendicular to the radial gDir, in XZ)
  const tang = new THREE.Vector3(Math.cos(grabAz), 0, -Math.sin(grabAz));
  for (const t of [-0.18, 0.18]) {
    const standoff = _cyl(0.02, 0.02, 0.1, 6, _cabSteel);
    standoff.position.set(
      gDir.x * (CAB_R - 0.09) + tang.x * t,
      WALL_H - 0.18,
      gDir.z * (CAB_R - 0.09) + tang.z * t,
    );
    standoff.rotation.set(0, 0, 0);          // short radial stub (vertical-ish is fine; tiny)
    group.add(standoff);
  }

  // ── 10. The ESCAPE HATCH (R3a) — a real framed DOOR cut into the rear-left wall arc
  //    (HATCH_AZ), the wake-exit. The wall + hoops gap over its opening (§1.a/§2); here we
  //    add the channel-steel frame, a dark recessed jamb (depth read), and the swinging DOOR
  //    on its hinge pivot. Blown open by blowCabinHatch; the player climbs out into the real
  //    desert past it (the cabin is visual-only at the spawn — no collider on the door).
  //    X2a — SKIPPED on the bay build (opts.door=false): the bay pod supplies its OWN +X door
  //    (shipScene drives its hinge), so the cabin's −Z door isn't built there. The shell/hoop gap
  //    (§1.a/§2, cut at HATCH_AZ) is yawed to +X with the whole interior sub-group, so the bay's
  //    +X door fills a real opening in the sealing shell either way.
  if (withDoor) buildCabinHatch(group);
}

// ── X2a — THE ONE INTERIOR, BUILT FOR THE BAY POD TOO ────────────────────────────────────────
// The user's #1 repeated ask: the bay pod's interior must BE the real cabin interior (not a token
// "peek"), so from inside the bay pod you see the SAME sealed riveted bore, seat, console, eject,
// and controls — indistinguishable from the ride-down cabin — with NO open space through any seam.
// buildCabinInterior builds everything in the pod-LOCAL frame with the front door on −Z (θ=π). The
// bay pod's door faces +X (θ=π/2), so we build the full interior into a sub-group YAWED so the
// cabin's −Z front rotates to +X: −Z=(0,0,−1) under a −π/2 yaw about +Y maps to +X=(1,0,0), so the
// sealing-shell door gap, the seat (which backs the aft wall + faces the door), and all the controls
// line up with the bay's own +X door. We build WITHOUT the cabin's own −Z door (door:false) — the
// bay supplies its own +X door slab + hinge (shipScene drives it) — so the door isn't doubled.
const UNIFIED_INTERIOR_YAW = -Math.PI / 2;   // rotate the cabin's −Z front → the bay's +X door

/** Build the FULL real cabin interior into `parent`, yawed so its front (door/seat sight-line)
 *  faces +X (the canonical bay-pod door azimuth). Used by buildCanonicalPodExterior so the bay pod
 *  contains the SAME sealed interior as the ride cabin. Returns the yawed sub-group. */
function buildUnifiedPodInterior(parent: THREE.Group): THREE.Group {
  const inner = new THREE.Group();
  inner.name = 'canonicalPodInterior';
  inner.rotation.y = UNIFIED_INTERIOR_YAW;   // cabin −Z front → +X (the bay door)
  buildCabinInterior(inner, { door: false });   // full sealed interior, minus the cabin's own −Z door (the bay has its own +X door)
  // PERF — the interior is ~380 tiny shared-material greebles (rivets, ribs, banded arcs, deck studs);
  //   the bay build (unlike buildPodScene) doesn't otherwise merge them. The bay interior has NO
  //   animated parts (door:false → no swinging hatch here), so it's safe to static-merge the whole
  //   sub-group into batched draws (keeps the docked-pod draw-call budget in line with the old token
  //   peek). mergeStaticByMaterial skips transparent (the glass) + respects noMerge tags.
  mergeStaticByMaterial(inner);
  parent.add(inner);
  return inner;
}

// ── Section builders (split out so buildCabinInterior reads as the cabin assembly) ──
// CLUSTER D — buildViewport RETIRED: the porthole is no longer a bare-wall window; it's the DOMED
//   PORTHOLE built INTO the swinging front door (buildCabinHatch §10), so it seals the aperture
//   through the descent + swings away with the door at the wake. The glass materials (_cabGlass /
//   _cabGlassSpec / the door-well tint _cabDoorWellTint) live with the door there.

/** Y3 Interior Mk-II (user-locked: MINIMAL + CHUNKY). ONE compact integrated console on the +X
 *  (right) flank + a big clean PARACHUTE LEVER rising off it. Few elements, each chunky + readable
 *  — NO fields of tiny greebles (the X2a CRT/telltale/gauge/rocker clutter that read as "two
 *  generations" is GONE). Sets the module `chuteLever` pivot + `chuteLeverRestX` + `leverBrokenTell`
 *  (the setParachuteLeverPull hook drives them: a visible pull-down + a snapped-off broken state). */
function buildConsoleAndLever(group: THREE.Group): void {
  // The console sits on the +X (right) flank, swung toward FORWARD (θ from +Z→+X; right = π/2,
  //   forward = π), so the seated player glances down-forward-right to it + the lever is in reach.
  const conAz = Math.PI / 2 + 0.42;
  const conDir = new THREE.Vector3(Math.sin(conAz), 0, Math.cos(conAz));
  const conR = CAB_R - 0.40;
  const deckY = 1.24;                  // waist-high deck (a touch lower than the old 1.30 so it clears the seated eye-line to the door)
  // a console GROUP yawed so its local +X points radially OUTWARD (toward the wall); local −X
  //   faces the cabin centre / seat (where the lever + the one screen read).
  const con = new THREE.Group();
  con.position.set(conDir.x * conR, 0, conDir.z * conR);
  con.rotation.y = conAz - Math.PI / 2;
  group.add(con);
  // ── ONE chunky cabinet body hugging the wall: a solid gunmetal block, a lit seat-facing FACE
  //    panel closing the front (no dark void under the deck), and a recessed kickplate skirt at
  //    the floor. Few big volumes — reads as a single fabricated console, not a greeble pile.
  const body = _box(0.44, deckY, 0.92, _cabChannel);
  body.position.set(0.12, deckY / 2, 0);
  con.add(body);
  const facePanel = _box(0.04, deckY - 0.06, 0.86, _cabBand);   // lit seat-facing face (a step lighter → reads as a finished panel)
  facePanel.position.set(-0.10, deckY / 2, 0);
  con.add(facePanel);
  const kick = _box(0.38, 0.12, 0.90, _cabSteel);               // recessed base skirt (meets the deck)
  kick.position.set(-0.05, 0.06, 0);
  con.add(kick);
  // a chunky top DECK slab, canted up toward the seat (one clean surface the lever mounts on).
  const dt = 0.30;
  const deck = _box(0.46, 0.07, 0.94, _cabSteel);
  deck.position.set(0.0, deckY + 0.055, 0);
  deck.rotation.z = dt;
  con.add(deck);
  // ── ONE big readable readout on the seat-facing face — a chunky recessed screen in a proud
  //    steel bezel (a single lit panel, not a strip of tiny lights). The one point of console life.
  {
    const bez = _box(0.05, 0.34, 0.42, _cabSteel);        // proud steel bezel (chunky, one piece)
    bez.position.set(-0.11, deckY - 0.30, 0.14);
    con.add(bez);
    const glow = _box(0.03, 0.26, 0.34, _crtGlow);        // the lit screen face (recessed, one flat glow)
    glow.position.set(-0.135, deckY - 0.30, 0.14);
    con.add(glow);
    // two fat status LEDs beside the screen (chunky, in drilled seats — the only small accents kept)
    for (const [ly, m] of [[deckY - 0.10, _ledGreen], [deckY - 0.20, _ledAmber]] as const) {
      const seat = _box(0.04, 0.06, 0.06, _cabSteel); seat.position.set(-0.11, ly, -0.30); con.add(seat);
      const led = _cyl(0.022, 0.022, 0.03, 8, m); led.rotation.z = Math.PI / 2; led.position.set(-0.135, ly, -0.30); con.add(led);
    }
  }

  // ── Y7 — the PARACHUTE LEVER, REPOSITIONED LOW + SEATED-NATURAL. It used to mount HIGH on the deck
  //    (grip ~1.95m — a weird overhead reach for a seated pilot). It now mounts LOW, beside-and-forward
  //    of the seat on the +X (right) flank: a stout clevis at the console's forward-lower corner → a
  //    short shaft angled UP toward the seated hand → a fat red grip at ~1.0m (seated elbow/thigh reach).
  //    Minimal: clevis + shaft + ONE hazard collar + the fat grip. The animation contract is UNCHANGED —
  //    the pivot still swings on rotation.x from chuteLeverRestX (setParachuteLeverPull), snap unchanged.
  //    Base con-local ≈ (-0.65, 0.60, 0.52) → grip pod-local ≈ (0.36, 1.0, 0.34): FORWARD-right of the
  //    seat so the seated glance is a natural ~45° down-right (faceControl yaw ≈ 0.79, pitch ≈ −0.55),
  //    not a 115° reach behind. The clevis sits just off the console's forward face (con-local z≈0.46).
  const leverBaseX = -0.65, leverBaseY = 0.60, leverBaseZ = 0.52;
  const mount = _box(0.18, 0.16, 0.20, _cabSteel);      // chunky steel clevis mount (bolts to the console flank, low + forward)
  mount.position.set(leverBaseX + 0.05, leverBaseY - 0.04, leverBaseZ);
  con.add(mount);
  const cheek = _box(0.16, 0.16, 0.03, _cabSteel);      // one visible clevis cheek plate (reads as a real hinge bracket)
  cheek.position.set(leverBaseX, leverBaseY + 0.02, leverBaseZ + 0.11);
  con.add(cheek);
  const leverPivot = new THREE.Group();
  leverPivot.position.set(leverBaseX, leverBaseY + 0.02, leverBaseZ);
  leverPivot.userData.noMerge = true;  // Y7 — the swinging lever must NOT be folded into the static batch (the pull + snap must move)
  chuteLeverRestX = -0.34;              // resting back-cant (toward the pilot/hand); pulls swing forward from here
  leverPivot.rotation.x = chuteLeverRestX;
  con.add(leverPivot);
  const shaft = _cyl(0.032, 0.040, 0.40, 10, _cabSteel);   // one stout shaft (shorter now — the mount is low, the grip lands at reach)
  shaft.position.set(0, 0.20, 0);
  leverPivot.add(shaft);
  const hazBand = _cyl(0.046, 0.046, 0.08, 10, _ejectGrip);   // ONE hazard-yellow collar (the "pull" tell)
  hazBand.position.set(0, 0.28, 0);
  leverPivot.add(hazBand);
  const grip = _cyl(0.088, 0.095, 0.20, 12, _chuteGrip);   // fat worn-red grip (the gag star reads "pull me")
  grip.position.set(0, 0.46, 0);
  leverPivot.add(grip);
  const capGeo = new THREE.SphereGeometry(0.092, 12, 8);
  _cabinDisposables.push(capGeo);
  const gripCap = new THREE.Mesh(capGeo, _chuteGrip);
  gripCap.position.set(0, 0.56, 0);
  leverPivot.add(gripCap);
  chuteLever = leverPivot;
  // ── the SNAPPED-MOUNT tell (hidden until setParachuteLeverPull(_, true) shows it): a torn bracket
  //    lip + a sprung clevis pin at the base, so the 3rd-pull SNAP reads as a wrenched-off mount.
  const brokenTell = new THREE.Group();
  brokenTell.position.set(leverBaseX, leverBaseY, leverBaseZ);
  brokenTell.visible = false;
  const tornLip = _box(0.14, 0.06, 0.07, _cabSteel);
  tornLip.position.set(0, 0.05, 0.0);
  tornLip.rotation.set(0.6, 0, 0.4);            // peeled up (metal tore)
  brokenTell.add(tornLip);
  const sprungPin = _cyl(0.016, 0.016, 0.16, 6, _cabRivet);
  sprungPin.rotation.set(0.3, 0, 1.1);          // the clevis pin sprung out at an angle
  sprungPin.position.set(0.07, 0.04, 0.03);
  brokenTell.add(sprungPin);
  con.add(brokenTell);
  leverBrokenTell = brokenTell;
  // Y7 — a stout BRACKET ARM cantilevers the low clevis off the console body's forward-left corner, so
  //   the repositioned lever is physically MOUNTED (no floater) — it reads as bolted to the console, out
  //   forward-and-inboard beside the seat where the seated hand falls. The arm spans the X gap from the
  //   console body (x≈+0.10) to the clevis (x=leverBaseX) at the low mount height.
  const armX0 = 0.12;                                  // where the arm ties into the console body
  const armW = Math.abs(armX0 - leverBaseX) + 0.10;    // spans body → clevis
  const bracket = _box(armW, 0.13, 0.18, _cabChannel);
  bracket.position.set((armX0 + leverBaseX) / 2, leverBaseY - 0.05, leverBaseZ);
  con.add(bracket);
  const bracketGusset = _box(0.10, 0.28, 0.14, _cabSteel);   // a gusset tying the arm down to the console body (stiffens the read, no floating cantilever)
  bracketGusset.position.set(armX0, leverBaseY - 0.20, leverBaseZ);
  con.add(bracketGusset);
  // a chunky hazard-yellow "CHUTE" placard on the bracket top beside the grip (one clear label)
  const placard = _box(0.15, 0.02, 0.10, _ejectGrip);
  placard.position.set(leverBaseX + 0.16, leverBaseY + 0.02, leverBaseZ - 0.12);
  con.add(placard);
  const placardText = _box(0.10, 0.024, 0.03, _cabScreen);
  placardText.position.set(leverBaseX + 0.16, leverBaseY + 0.035, leverBaseZ - 0.12);
  con.add(placardText);
  // Y7 — re-apply the last pull/snap pose so a descent/crash rebuild restores the lever where the
  //   sequence left it (the chute beat re-drives per-frame, but this makes the rebuild self-correct
  //   even on a static frame — mirrors applyEjectLeverPose in buildEjectControl).
  setParachuteLeverPull(_chutePullState, _chuteSnapState);
}

/** Y3 Interior Mk-II — the big guarded EJECT handle, curve-seated on the −X (left) wall, facing
 *  inboard toward the seat. MINIMAL + CHUNKY: a chunky yellow guarded housing, a flip-up steel
 *  guard cage, and ONE fat red T-handle inside it — nothing tiny. Readable at the ride-frame
 *  eject look (faceControl yaw 1.20, pitch −0.20 → facing −X-ish). The enterPod "pull eject" beat. */
function buildEjectControl(group: THREE.Group): void {
  // Left (−X) flank, swung toward forward (left = −π/2, forward = π). dir=(sin,cos); group local
  //   +X → outward at az−π/2, so local −X faces the seat (where the handle reaches).
  const ejAz = -Math.PI / 2 - 0.40;
  const ej = new THREE.Group();
  const ejR = CAB_R - 0.05;
  ej.position.set(Math.sin(ejAz) * ejR, 1.42, Math.cos(ejAz) * ejR);
  ej.rotation.y = ejAz - Math.PI / 2;
  group.add(ej);
  // In ej-local: −X faces the cabin centre. Build the control reaching inboard (−X).
  // ── ONE chunky steel mounting PLATE → a bright safety-yellow guarded HOUSING → a recessed dark
  //    guard well → a flip-up steel guard cage → ONE fat red T-handle. Big volumes, no greeble field.
  const plate = _box(0.10, 0.66, 0.56, _cabChannel);      // chunky steel mounting plate
  plate.position.set(-0.03, 0, 0);
  ej.add(plate);
  const housing = _box(0.06, 0.50, 0.48, _ejectGrip);     // bright-yellow guarded housing (one block)
  housing.position.set(-0.10, 0, 0);
  ej.add(housing);
  // hazard stripe bars top + bottom of the housing (the "danger" tell — two clean bars)
  for (const sy of [-1, 1]) {
    const hz = _box(0.02, 0.08, 0.46, _cabScreen);
    hz.position.set(-0.135, sy * 0.29, 0);
    ej.add(hz);
  }
  const well = _box(0.08, 0.34, 0.34, _cabScreen);        // recessed dark guard cavity
  well.position.set(-0.14, 0.02, 0);
  ej.add(well);
  // flip-up guard CAGE arching inboard over the handle (a chunky steel bar cage — reads "guarded")
  const guard = _box(0.30, 0.05, 0.40, _cabSteel);
  guard.position.set(-0.34, 0.22, 0);
  ej.add(guard);
  for (const sz of [-1, 1]) {
    const leg = _box(0.24, 0.05, 0.05, _cabSteel);
    leg.position.set(-0.25, 0.11, sz * 0.17);
    leg.rotation.z = 0.7;
    ej.add(leg);
  }
  // ── Y7 — the T-handle now hangs off a CLEVIS PIVOT so it SWINGS DOWN on a pull (setEjectLeverPull).
  //    A stout steel clevis is fixed on the housing face; the pivot group sits at its pin; the handle
  //    (stem + fat red crossbar) is a child reaching inboard (−X). At rest it points inboard-and-up
  //    (ejectLeverRestZ); a pull rotates it about the group-local +Z (a horizontal tangent axis) so the
  //    inboard-pointing arm swings DOWN toward −Y — a clear yank-down. KISS: the clevis + the handle only.
  const pinX = -0.20, pinY = 0.10;   // the pivot pin location on the housing face (inboard of the well)
  // the clevis: two steel cheek plates flanking the arm root + a cross pin (reads as a real hinge).
  for (const sz of [-1, 1]) {
    const cheekE = _box(0.05, 0.16, 0.04, _cabSteel);
    cheekE.position.set(pinX, pinY + 0.02, sz * 0.075);
    ej.add(cheekE);
  }
  const clevisPin = _cyl(0.020, 0.020, 0.20, 8, _cabRivet);
  clevisPin.rotation.x = Math.PI / 2;
  clevisPin.position.set(pinX, pinY, 0);
  ej.add(clevisPin);
  // the swinging handle group, hinged at the pin. Local −X = the arm reach; a pull rotates +Z → down.
  ejectLever = new THREE.Group();
  _ejectLevers.add(ejectLever);         // release wiring — the setter drives EVERY live instance (see _ejectLevers)
  ejectLever.position.set(pinX, pinY, 0);
  ejectLever.userData.noMerge = true;   // Y7 — the swinging handle must NOT be folded into the static batch (or the pull reads dead)
  ejectLeverRestZ = -0.30;              // resting: arm points inboard-and-slightly-UP (a raised handle at rest)
  ejectLever.rotation.z = ejectLeverRestZ;
  ej.add(ejectLever);
  const stem = _cyl(0.044, 0.044, 0.30, 8, _cabSteel);   // stout stem reaching inboard from the pin
  stem.rotation.z = Math.PI / 2;
  stem.position.set(-0.15, 0, 0);
  ejectLever.add(stem);
  const barT = _cyl(0.062, 0.062, 0.36, 10, _ledRed);     // fat RED crossbar grip at the arm end (distinct from the yellow housing)
  barT.position.set(-0.30, 0, 0);
  ejectLever.add(barT);
  for (const sz of [-1, 1]) {
    const cap = _cyl(0.072, 0.058, 0.04, 8, _cabSteel);
    cap.rotation.x = Math.PI / 2;
    cap.position.set(-0.30, 0, sz * 0.18);
    ejectLever.add(cap);
  }
  // a chunky stencilled "EJECT" placard on the lower housing (one dark-on-yellow label bar)
  const ejLabel = _box(0.03, 0.10, 0.34, _cabScreen);
  ejLabel.position.set(-0.135, -0.30, 0);
  ej.add(ejLabel);
  // Y7 — re-apply the last pull pose so a descent/crash rebuild restores the handle where it was
  //   (mirrors how buildConsoleAndLever re-applies the chute state below).
  applyEjectLeverPose();
}

/** Release wiring — ALL live eject-lever pivots. The single `ejectLever` ref is last-build-wins,
 *  but during the BOARDING beat the visible lever is the BAY pod's interior, which the preload
 *  builds BEFORE the (parked, invisible) ride cabin — so the single ref would animate the wrong
 *  instance. The setter drives every registered pivot; detached ones (disposed ship) no-op
 *  visually. Cleared with the cabin dispose; the bay instance dies with the ship scene graph. */
const _ejectLevers = new Set<THREE.Group>();

/** Y7 — pose the eject lever from `_ejectPullState` (0 = rest/up, 1 = fully pulled down). Split out so
 *  both the public setter AND the rebuild re-apply drive the exact same math. Safe if unbuilt. */
function applyEjectLeverPose(): void {
  const k = Math.max(0, Math.min(1, _ejectPullState));
  for (const lev of _ejectLevers) lev.rotation.z = ejectLeverRestZ + k * EJECT_SWING;
  if (ejectLever && !_ejectLevers.has(ejectLever)) ejectLever.rotation.z = ejectLeverRestZ + k * EJECT_SWING;
}

/** Pose the EJECT lever. `t` in [0,1]: 0 = at rest (handle up), 1 = fully pulled DOWN (the yank that
 *  fires the eject). The enterPod "pull eject" beat eases t 0→1 as the player commits the pull; the
 *  ease is the caller's job. Persists `t` so a descent/crash rebuild re-applies the pose. Safe no-op
 *  if the pod isn't built. */
export function setEjectLeverPull(t: number): void {
  _ejectPullState = Math.max(0, Math.min(1, t));
  applyEjectLeverPose();
}

/** Conduit pipes following the curve, a junction box, drooping cables, a ceiling dome
 *  light — the lived-in cramped-capsule tells. */
function buildConduitAndLight(group: THREE.Group): void {
  // Y3 Interior Mk-II — MINIMAL conduit, and it lives INSIDE THE WALL LINE (the user saw pipes
  //   clipping THROUGH the wall). Conduit hugs the wall at CAB_R−0.055 (≈5.5cm proud — the pipe
  //   radius 0.045 clears the rivet hoops but never pokes out through the shell). ONE clean vertical
  //   run on the REAR arc, capped top + bottom into structure (junction box + foot clamp) so no
  //   open-cut ends.
  // ROUND-1f FIX (the two top-left pipes in the bay doorway sightline): az=0.7 was authored to clear
  //   the RIDE cabin's −Z door, but in the BAY pod the whole interior is yawed −π/2, so az=0.7 landed
  //   in the +X-door collar SIGHTLINE (the thick pipe with the junction box, upper-left). Moved to
  //   az=4.30 (rear-RIGHT arc): hidden BEHIND the pod body from the bay-collar eye (bayX≈+0.4) AND out
  //   of the ride-forward view (|az−π|>1.0), clear of the −X eject (4.71) + the +X console (2.0). The
  //   companion rib-a (§3) rides the same arc so the run reads clamped to a structural batten.
  const az = 4.30;
  const condH = WALL_H - 0.55, condY = WALL_H / 2 - 0.05;
  const condTop = condY + condH / 2;
  const RC = CAB_R - 0.055;           // conduit centre radius — tight to the wall (inside the wall line)
  const conduit = _cyl(0.045, 0.045, condH, 8, _cabCable);
  _seatOnWall(conduit, az, RC, condY);
  group.add(conduit);
  // a junction BOX capping the top end (into the shoulder structure) + a foot clamp at the bottom.
  const jtop = _box(0.16, 0.18, 0.11, _cabSteel);
  _seatOnWall(jtop, az, CAB_R - 0.06, condTop - 0.02);
  group.add(jtop);
  for (const [aoff, mat] of [[-0.05, _ledGreen], [0.05, _ledAmber]] as const) {
    const led = _box(0.03, 0.03, 0.02, mat);
    _seatOnWall(led, az + aoff, CAB_R - 0.11, condTop + 0.02);
    group.add(led);
  }
  for (const cy of [condY - condH / 2 + 0.06, condY, condY + condH / 2 - 0.1]) {
    const clamp = _box(0.11, 0.05, 0.05, _cabSteel);
    _seatOnWall(clamp, az, CAB_R - 0.045, cy);
    group.add(clamp);
  }
  // ── the ceiling dome LAMP at the apex (the one warm interior source; a chunky ring + a glow disc).
  const domeRing = _cyl(0.16, 0.18, 0.06, 14, _cabSteel);
  domeRing.position.set(0, CAB_APEX - 0.06, -0.08);
  group.add(domeRing);
  const lamp = _cyl(0.13, 0.15, 0.035, 14, _ledAmber);
  lamp.position.set(0, CAB_APEX - 0.09, -0.08);
  group.add(lamp);
  // a SECOND small forward wall lamp above the door (1-2 lamps per the spec) — a warm point tell on
  //   the forward shoulder so the door/porthole surround isn't dead; hugs the wall, clear of the glass.
  const lamp2Az = Math.PI;   // forward (−Z), above the door
  const l2dir = new THREE.Vector3(Math.sin(lamp2Az), 0, Math.cos(lamp2Az));
  const lamp2Ring = _cyl(0.09, 0.10, 0.05, 12, _cabSteel);
  lamp2Ring.position.set(l2dir.x * (CAB_R - 0.05), WALL_H - 0.10, l2dir.z * (CAB_R - 0.05));
  lamp2Ring.lookAt(0, WALL_H - 0.10, 0);
  group.add(lamp2Ring);
  const lamp2 = _cyl(0.07, 0.08, 0.03, 12, _ledAmber);
  lamp2.position.set(l2dir.x * (CAB_R - 0.08), WALL_H - 0.10, l2dir.z * (CAB_R - 0.08));
  lamp2.lookAt(0, WALL_H - 0.10, 0);
  group.add(lamp2);

  // ── A SECONDARY CONDUIT RUN on the front-left shoulder arc (θ≈2.55) — a lived-in utility tell that
  //    reads in the peripheral/head-turn frame without blocking the seated forward door read.
  //    D-fix (2026-07-05): this was a "dangling conduit torn loose in the crash" — a slack pipe with a
  //    CLEAN-CUT free end floating mid-air + a detached amber SPARK stub touching nothing. That read as
  //    a modeling bug the ENTIRE pristine descent (long before any crash). Per the mount-or-remove rule
  //    it's now an INTACT clamped conduit: a pipe capped into a top junction clamp AND a bottom foot
  //    clamp seated on the wall (both ends INTO structure, no floating cut). The wake SPARK tell moves to
  //    a small wire nub SNUG against the lower clamp (not floating) — still hidden until the wake flicker
  //    arms it (_danglingConduitSpark), so the crash "electrics stutter" moment still lands.
  {
    const az = 2.55;
    const RC2 = CAB_R - 0.075;                 // conduit centre radius — tight to the wall (matches the main run)
    const runTopY = WALL_H - 0.16, runBotY = WALL_H - 0.86;   // spans the upper-shoulder → mid-wall
    const runY = (runTopY + runBotY) / 2, runH = runTopY - runBotY;
    // the pipe — a clean vertical run hugging the wall
    const pipe = _cyl(0.036, 0.036, runH, 8, _cabCable);
    _seatOnWall(pipe, az, RC2, runY);
    group.add(pipe);
    // top junction clamp (caps the upper end into the shoulder structure) — no open-cut top end.
    const clampTop = _box(0.12, 0.07, 0.07, _cabSteel);
    _seatOnWall(clampTop, az, CAB_R - 0.05, runTopY);
    group.add(clampTop);
    // bottom foot clamp (caps the lower end onto the wall) — no floating free end.
    const clampBot = _box(0.11, 0.06, 0.06, _cabSteel);
    _seatOnWall(clampBot, az, CAB_R - 0.05, runBotY);
    group.add(clampBot);
    // a mid-run band clamp (reads as a fitted, fastened run)
    const clampMid = _box(0.10, 0.05, 0.05, _cabSteel);
    _seatOnWall(clampMid, az, CAB_R - 0.045, runY);
    group.add(clampMid);
    // the wake SPARK tell — a tiny self-lit wire nub SNUG against the lower clamp (unlit basic so it
    //   glows regardless of light). Hidden until the wake flicker arms it (_updateWakeFlicker), then
    //   stutters + settles dark. Seated on the wall right at the foot clamp, not floating in the bore.
    const spark = _box(0.03, 0.045, 0.03, _ledAmber);
    _seatOnWall(spark, az + 0.06, CAB_R - 0.10, runBotY + 0.04);
    spark.visible = false;   // dark until the wake arms the flicker
    // D-fix (2026-07-05): the spark MUST stay a live mesh — mergeStaticByMaterial folds geometry
    //   IGNORING the `visible` flag, so a merged spark rendered ALWAYS (the floating amber chip the
    //   player saw the whole descent) AND the wake toggle (which flips THIS mesh's .visible) did
    //   nothing once it was merged away. Tag noMerge so .visible actually gates it.
    spark.userData.noMerge = true;
    group.add(spark);
    _danglingConduitSpark = spark;
  }
}

/** UNIFIED POD DOOR SLAB (X2b — door-parity + face-parity + sealed through-bore). The ONE door
 *  construction that serves BOTH the ride cabin (buildCabinHatch, −Z) and the canonical bay pod
 *  (buildCanonicalPodExterior, +X). Prior to this, each host authored its own slab/porthole/latch
 *  inline — same shared MATERIALS but structurally divergent geometry (the bay had a valve WHEEL +
 *  0.10 slab; the ride had a grab-BAR + 0.176 slab; NEITHER had an exterior-face porthole/handle;
 *  the porthole side was an OPEN ring — you saw straight through between glass + slab at a graze).
 *  This builds the WHOLE door into `door` (origin = door centre, local +Z = the cabin-facing INNER
 *  face, −Z = the world-facing OUTER face), IDENTICAL from every angle + both faces:
 *   • a slab FRAME around a real square porthole aperture (a genuine hole so the view reads through);
 *   • a SEALED through-BORE (a closed cylinder wall joining the two faces — no more open-sided ring);
 *   • the full domed-porthole ASSEMBLY (annular cap → domed glass → integral bezel torus → bezel
 *     bolts) MIRRORED on BOTH faces (an escape-pod porthole is glazed + bezelled inside AND out);
 *   • a grab-bar LATCH mirrored on BOTH faces (a real hatch has an external grab too);
 *   • twin stiffener ribs + perimeter rivets, both faces.
 *  `portY` = the porthole centre in door-local Y (the caller passes VP_CY − doorCentreY). Nothing
 *  here may clip the frame/jamb when the door swings ~85° open (all hardware sits within ±doorTh of
 *  the slab faces). Rule 7: the slab + bezel are ≥0.10 m thick features. */
function buildUnifiedDoorSlab(door: THREE.Group, doorTh: number, W: number, H: number, portY: number): void {
  const portOpen = VP_R + 0.055;   // the OPEN aperture radius through the slab (glass + rim margin)
  const zF = doorTh * 0.5;         // inner (cabin +Z) face plane
  const zB = -doorTh * 0.5;        // outer (world −Z) face plane
  // ── the SLAB built as a FRAME around the round aperture (a real hole → the view reads through it).
  const dHalf = (H * 0.98) / 2;
  const pTop = portY + portOpen, pBot = portY - portOpen;
  const addSlab = (h: number, cy: number, w = W, cx = 0) => {
    if (h <= 0.001) return;
    const s = _box(w, h, doorTh, _cabDoorSlab);
    s.position.set(cx, cy, 0);
    door.add(s);
  };
  addSlab(pBot - (-dHalf), (pBot + (-dHalf)) / 2);   // bottom panel (door base → aperture bottom)
  addSlab(dHalf - pTop, (dHalf + pTop) / 2);         // top strip (aperture top → door top)
  const sideW = W / 2 - portOpen;
  addSlab(pTop - pBot, portY, sideW, -(portOpen + sideW / 2));   // left flank
  addSlab(pTop - pBot, portY, sideW, (portOpen + sideW / 2));    // right flank
  // twin horizontal stiffener ribs on the lower panel — proud on BOTH faces (a fabricated plate).
  {
    const lowMid = (pBot + (-dHalf)) / 2;
    for (const dy of [-0.16, 0.16]) {
      for (const zc of [doorTh * 0.55, -doorTh * 0.55]) {
        const rib = _box(W - 0.16, 0.05, doorTh * 0.6, _cabDoorSlab);
        rib.position.set(0, lowMid + dy, zc);
        door.add(rib);
      }
    }
  }
  // ── the SEALED through-BORE — a CLOSED cylinder wall spanning the full slab thickness, joining
  //    the inner + outer aperture rims so the porthole reads as a solid tube from any graze angle
  //    (the fix for "you can see straight through the sides between glass + slab"). Opaque door
  //    aluminium, DoubleSide so it reads from inside the bore + from a grazing exterior look.
  const boreGeo = new THREE.CylinderGeometry(portOpen, portOpen, doorTh + 0.002, 30, 1, true);
  _cabinDisposables.push(boreGeo);
  const boreMat = _cabDoorSlab.clone(); boreMat.side = THREE.DoubleSide;
  _cabinDoorMats.push(boreMat);
  const bore = new THREE.Mesh(boreGeo, boreMat);
  bore.rotation.x = Math.PI / 2;   // axis Y → local Z (through the door)
  bore.position.set(0, portY, 0);
  door.add(bore);
  // ── the domed-porthole ASSEMBLY, MIRRORED on both faces. face=+1 inner (+Z), −1 outer (−Z).
  const addPorthole = (face: number) => {
    const zPlane = face > 0 ? zF : zB;
    // (a) flat ANNULAR CAP rounding the square aperture corners flush on this face (no leak past bezel)
    const capGeo = new THREE.RingGeometry(VP_R + 0.005, portOpen * Math.SQRT2 + 0.02, 30, 1);
    _cabinDisposables.push(capGeo);
    const cap = new THREE.Mesh(capGeo, _cabDoorSlab);
    cap.position.set(0, portY, zPlane + face * 0.006);
    if (face < 0) cap.rotation.y = Math.PI;   // RingGeometry faces +Z → flip for the outer face
    door.add(cap);
    // (b) a shallow TRANSPARENT dark rim collar hugging the glass on this face (a soft inset shadow
    //     when sealed, see-through when open — NOT the old opaque full-depth void tube).
    const wellH = doorTh * 0.45;
    const wellGeo = new THREE.CylinderGeometry(VP_R, VP_R, wellH, 28, 1, true);
    _cabinDisposables.push(wellGeo);
    const well = new THREE.Mesh(wellGeo, _cabDoorWellTint);
    well.rotation.x = Math.PI / 2;
    well.position.set(0, portY, zPlane - face * (wellH / 2 + 0.005));   // hug this face's lip behind the glass
    well.renderOrder = -1;
    door.add(well);
    // (c) the DOMED glass disc bulging OUT of this face (see-through → the view reads through it)
    const glassGeo = new THREE.SphereGeometry(VP_R, 28, 14, 0, Math.PI * 2, 0, Math.PI * 0.32);
    _cabinDisposables.push(glassGeo);
    const glass = new THREE.Mesh(glassGeo, _cabGlass);
    glass.rotation.x = face > 0 ? -Math.PI / 2 : Math.PI / 2;   // bulge toward this face's outward normal
    glass.position.set(0, portY, zPlane + face * 0.02);
    door.add(glass);
    // a faint spec crescent on the glass (glazed-pane tell; module-shared additive mat)
    const specGeo = new THREE.PlaneGeometry(VP_R * 0.62, VP_R * 0.30);
    _cabinDisposables.push(specGeo);
    const spec = new THREE.Mesh(specGeo, _cabGlassSpec);
    spec.position.set(-VP_R * 0.20 * face, portY + VP_R * 0.40, zPlane + face * 0.14);
    spec.rotation.z = -0.6 * face;
    door.add(spec);
    // (d) ONE integral proud BEZEL ring (channel-steel torus) framing the porthole on this face
    const bezTube = 0.045, bezCtr = VP_BEZEL_OUT - bezTube;
    const bezGeo = new THREE.TorusGeometry(bezCtr, bezTube, 12, 30);
    _cabinDisposables.push(bezGeo);
    const bez = new THREE.Mesh(bezGeo, _cabChannel);
    bez.position.set(0, portY, zPlane + face * 0.02);
    door.add(bez);
    // (e) a ring of bezel bolts (the porthole is bolted to the door) on this face
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const sg = new THREE.SphereGeometry(0.013, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2);
      _cabinDisposables.push(sg);
      const stud = new THREE.Mesh(sg, _cabRivet);
      stud.rotation.x = -face * Math.PI / 2;   // dome faces this face's outward normal
      stud.position.set(Math.cos(a) * bezCtr, portY + Math.sin(a) * bezCtr, zPlane + face * 0.03);   // on the proud bezel ring (overlaps it → connected)
      door.add(stud);
    }
  };
  addPorthole(1);    // inner (cabin) face
  addPorthole(-1);   // outer (world) face
  // ── a grab-bar LATCH near the free edge, low on the door, MIRRORED on both faces (a real hatch
  //    has an external grab/latch too). Mount plate + a vertical grab bar on two stubs.
  {
    const hx = -W * 0.30, hy = -H * 0.20;
    for (const face of [1, -1]) {
      const zPlane = face > 0 ? zF : zB;
      const mount = _box(0.14, 0.34, doorTh * 0.5, _cabChannel);
      mount.position.set(hx, hy, zPlane + face * 0.05);
      door.add(mount);
      const bar = _cyl(0.022, 0.022, 0.30, 8, _cabSteel);
      bar.position.set(hx, hy, zPlane + face * 0.13);
      door.add(bar);
      for (const sy of [-0.13, 0.13]) {
        const stub = _cyl(0.018, 0.018, 0.06, 6, _cabSteel);
        stub.rotation.x = Math.PI / 2;
        stub.position.set(hx, hy + sy, zPlane + face * 0.08);
        door.add(stub);
      }
    }
  }
  // ── perimeter door rivets (bolted plate) on BOTH faces — skip any that fall on the porthole disc.
  for (const face of [1, -1]) {
    const zPlane = face > 0 ? zF : zB;
    for (let i = 0; i < 18; i++) {
      const u = i / 18; let rx: number, ry: number;
      if (u < 0.25) { rx = (u / 0.25 - 0.5) * (W - 0.14); ry = H / 2 - 0.06; }
      else if (u < 0.5) { rx = (W - 0.14) / 2; ry = (1 - (u - 0.25) / 0.25 - 0.5) * (H - 0.14); }
      else if (u < 0.75) { rx = (0.5 - (u - 0.5) / 0.25) * (W - 0.14); ry = -H / 2 + 0.06; }
      else { rx = -(W - 0.14) / 2; ry = ((u - 0.75) / 0.25 - 0.5) * (H - 0.14); }
      if ((rx * rx + (ry - portY) * (ry - portY)) < (VP_R + 0.08) * (VP_R + 0.08)) continue;
      const sg = new THREE.SphereGeometry(0.013, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2);
      _cabinDisposables.push(sg);
      const rv = new THREE.Mesh(sg, _cabRivet);
      rv.rotation.x = -face * Math.PI / 2;
      // base ON the slab face (zPlane) so the dome (0.013 proud) reads as a CONNECTED rivet, not a
      //   stud floating 0.05 off the slab (the lint floaters). The dome faces outward via rotation.
      rv.position.set(rx, ry, zPlane);
      door.add(rv);
    }
  }
}

/** ROUND-1f (AIRTIGHT SEAL) — a STATIC pressure-door STOP LIP built on the aperture FRAME (NOT the
 *  swinging door), inboard of the closed slab. The slab is sized EXACTLY to the aperture (W×H) and
 *  is a FLAT plate closing a CURVED-shell opening, so at the side edges the curved shell recedes
 *  behind the flat slab, opening a thin wedge — a "star-gap" crack to space (the user's sealed-eye
 *  screenshot). This is what a real pressure door seats against: a picture-frame flange whose INNER
 *  edge sits at the aperture opening line and that extends OUTWARD past the slab edge, positioned a
 *  hair INBOARD of the closed slab's inner face so it backs the entire perimeter clearance with
 *  opaque metal (no line-of-sight to space) from BOTH the seated interior eye AND an exterior graze.
 *  `host` = the frame group (bay: local +Z outward; ride hatch: local +Z inward); `inZ` = the sign of
 *  the CABIN-inboard direction in the host's local Z (bay: −1; ride: +1); `slabInnerZ` = the closed
 *  slab's inner-face plane in host-local Z. The lip sits just inboard of that plane. It never blocks
 *  the OUTWARD door swing (opposite side) nor the walk-in (its inner opening = the full aperture,
 *  and the collider aperture is already wider than the visual). */
function _addDoorStopLip(host: THREE.Group, W: number, H: number, inZ: number, slabInnerZ: number): void {
  const lapIn = 0.075;                       // how far the flange laps INWARD over the opening edge
  const lapOut = 0.075;                      // how far it reaches OUTWARD past the aperture edge (backs the shell wedge)
  const lipDepth = 0.05;                     // flange plate thickness (along Z)
  const zc = slabInnerZ + inZ * (lipDepth / 2 + 0.004);   // a hair inboard of the closed slab's inner face
  // Perimeter band extents: inner opening = W−2·lapIn (clear walk-through), outer = W+2·lapOut.
  const bandW = lapIn + lapOut;              // radial width of each frame plate
  // The band CENTRE line sits on the aperture edge (±W/2 or ±H/2), so the plate laps lapIn inward + lapOut outward.
  const cW = W / 2, cH = H / 2;              // aperture half-extents (the edge line the band straddles)
  // top + bottom bars — full outer width (span the corners)
  for (const sy of [1, -1]) {
    const bar = _box(W + 2 * lapOut, bandW, lipDepth, _podSteel);
    bar.position.set(0, sy * cH, zc);
    host.add(bar);
  }
  // left + right jamb bars — the SIDE flanges that back the user's side star-gaps (between the top/bottom bars)
  const sideH = H - 2 * lapIn;               // fit between the top/bottom bands (no double-stack at corners)
  for (const sx of [1, -1]) {
    const bar = _box(bandW, sideH, lipDepth, _podSteel);
    bar.position.set(sx * cW, 0, zc);
    host.add(bar);
  }
}

/** CLUSTER D — the MERGED FRONT DOOR on the hero cabin (−Z, FDOOR_AZ): the ONE aperture the player
 *  faces for everything. A curve-seated channel-steel FRAME bordering the −Z wall opening (cut in
 *  §1.a/§2), a dark recessed jamb WELL (opening depth), and the swinging DOOR on a hinge pivot with
 *  the DOMED CIRCULAR PORTHOLE integral to its slab (the descent view reads through the porthole
 *  glass while the door is SEALED CLOSED; at the wake blowCabinHatch swings the whole door — porthole
 *  and all — open + the real desert shows through the opening). CLOSED (sealed) at rest so it rides
 *  the descent + crash shut (the B-spec); the wake cracks it ajar then kicks it wide. Mirrors the
 *  canonical bay pod's front door (buildCanonicalPodExterior) so it's the SAME door in↔out↔phase.
 *  Sets cabinHatchPivot (the front-door hinge). */
function buildCabinHatch(group: THREE.Group): void {
  const az = HATCH_AZ;                                            // = FDOOR_AZ = π (−Z)
  const dir = new THREE.Vector3(Math.sin(az), 0, Math.cos(az));   // outward radial at the door (−Z)
  const cy = HATCH_CY;
  // a door-LOCAL frame seated on the −Z wall: local +Z points INWARD (toward centre), local +X
  //   tangential (along the wall arc), so the door + frame build in a flat forward-facing plane.
  const hatch = new THREE.Group();
  hatch.position.set(dir.x * CAB_R, cy, dir.z * CAB_R);
  hatch.rotation.y = az + Math.PI;       // local +Z → inward (matches _seatOnWall)
  group.add(hatch);
  // ── channel-steel FRAME bordering the opening (4 bars) in the door-local XY plane, proud into
  //    the bore (+Z local). The porthole sits in the door slab, so the frame just rims the aperture.
  const fT = 0.10;                       // frame bar thickness
  const fb = (w: number, h: number, ox: number, oy: number) => {
    const bar = _box(w, h, 0.12, _cabChannel);
    bar.position.set(ox, oy, 0.02);
    hatch.add(bar);
  };
  fb(HATCH_W + fT * 2, fT, 0, HATCH_H / 2 + fT / 2);      // top
  fb(HATCH_W + fT * 2, fT, 0, -HATCH_H / 2 - fT / 2);     // bottom
  fb(fT, HATCH_H + fT * 2, -HATCH_W / 2 - fT / 2, 0);     // left jamb
  fb(fT, HATCH_H + fT * 2, HATCH_W / 2 + fT / 2, 0);      // right jamb (hinge side)
  // ── recessed jamb WELL — a dark shallow box going OUTWARD (−Z local, into the hull thickness)
  //    so the opening reads as a real deep aperture when the door is open. Dark unlit inner faces.
  for (const [w, h, ox, oy] of [
    [HATCH_W, 0.04, 0, HATCH_H / 2] as const,             // well top
    [HATCH_W, 0.04, 0, -HATCH_H / 2] as const,            // well bottom
    [0.04, HATCH_H, -HATCH_W / 2, 0] as const,            // well left
    [0.04, HATCH_H, HATCH_W / 2, 0] as const,             // well right
  ]) {
    const wall = _box(w, h, SHELL + 0.02, _cabChannel);   // a SHALLOW jamb (hull-thickness only) in lit channel-steel so the opening reads framed, not a black tunnel
    wall.position.set(ox, oy, -SHELL / 2);   // recessed outward by the hull thickness only
    hatch.add(wall);
  }
  // riveted studs around the frame (the fastened-port tell; matches the cabin rivet idiom)
  for (let i = 0; i < 14; i++) {
    const u = i / 14;
    let sx: number, sy: number;
    if (u < 0.25) { sx = (u / 0.25 - 0.5) * HATCH_W; sy = HATCH_H / 2 + fT * 0.5; }
    else if (u < 0.5) { sx = HATCH_W / 2 + fT * 0.5; sy = (1 - (u - 0.25) / 0.25 - 0.5) * HATCH_H; }
    else if (u < 0.75) { sx = (0.5 - (u - 0.5) / 0.25) * HATCH_W; sy = -HATCH_H / 2 - fT * 0.5; }
    else { sx = -HATCH_W / 2 - fT * 0.5; sy = ((u - 0.75) / 0.25 - 0.5) * HATCH_H; }
    const sg = new THREE.SphereGeometry(0.014, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2);
    _cabinDisposables.push(sg);
    const stud = new THREE.Mesh(sg, _cabRivet);
    stud.rotation.x = -Math.PI / 2;      // dome faces +Z (into the cabin)
    stud.position.set(sx, sy, 0.07);
    hatch.add(stud);
  }
  // ── the swinging DOOR on a hinge pivot at the RIGHT jamb (hinge side). SOLID riveted aluminium
  //    slab (the door reads as the same fabricated plate as the canonical bay door) with the DOMED
  //    CIRCULAR PORTHOLE set into its UPPER portion so the seated pilot reads the descent through it.
  const pivot = new THREE.Group();
  // W6 item 6 (slanted-door fix): the hinge sits at the aperture's RIGHT EDGE (x = +HATCH_W/2), NOT
  //   HATCH_W/2 + fT/2. The old `+ fT/2` pushed the hinge 5 cm PAST the aperture edge into the frame,
  //   so the closed door (which extends HATCH_W left from the hinge) landed 5 cm to the right of the
  //   aperture centre — it overhung the right jamb + left a 5 cm gap on the left, reading as a SLANTED
  //   /misaligned door. With the hinge on the aperture edge, the closed door fills the aperture flush.
  pivot.position.set(HATCH_W / 2, 0, 0.04);    // hinge ON the right aperture edge (the door closes flush)
  const door = new THREE.Group();
  const doorTh = 0.10;   // X2b — UNIFIED with the bay door (was SHELL*1.1=0.176; the bay was 0.10 → they read as different-thickness slabs)
  // The porthole y in door-local coords (door origin = door centre height HATCH_CY).
  const portY = VP_CY - HATCH_CY;
  // X2b — the ENTIRE door slab + double-faced porthole (sealed through-bore) + double-faced grab
  //   latch + rivets are built by the ONE shared buildUnifiedDoorSlab (identical to the bay door).
  buildUnifiedDoorSlab(door, doorTh, HATCH_W, HATCH_H, portY);
  door.position.set(-HATCH_W / 2, 0, 0);   // door local origin → the hinge (right) edge
  pivot.add(door);
  // CLUSTER D — at rest the door is FULLY CLOSED (sealed) so it rides the descent + crash SHUT
  //   (the B-spec — the porthole glass carries the ride-down view). The wake cracks it ajar then
  //   blowCabinHatch kicks it wide. (Was AJAR at rest — the old side-hatch rode down cracked open.)
  _cabinHatchAjarY = 0;       // sealed shut at rest
  pivot.rotation.y = _cabinHatchAjarY;
  hatch.add(pivot);
  // ROUND-1f AIRTIGHT SEAL — the same static STOP LIP as the bay door (buildCanonicalPodExterior), so
  //   the ride cabin's front door is airtight from the seated eye too. hatch local +Z = INWARD (toward
  //   centre), so cabin-inboard = +Z (inZ=+1). Closed slab inner face: pivot z=0.04 + doorTh/2 = 0.09.
  _addDoorStopLip(hatch, HATCH_W, HATCH_H, +1, 0.04 + doorTh / 2);
  cabinHatchPivot = pivot;
}

/** CLUSTER D — blow/kick the merged FRONT DOOR open (the wake exit). `t` 0→1 swings the (sealed)
 *  door fully wide + drops it as it tears off its hinge, revealing the −Z opening onto the real
 *  desert. No-op before build / after dispose. (The door rode the descent SEALED at rest; the wake
 *  beat calls blowCabinHatch(0) to crack it ajar as you come to, then 0→1 to kick it wide.) */
export function blowCabinHatch(t: number): void {
  if (!cabinHatchPivot) return;
  const k = Math.min(1, Math.max(0, t));
  // swing from sealed (0) through ajar to a clean ~85° kicked-open (the hinge is a VERTICAL axis on
  //   the +X/right jamb → swing −Y opens it outward to the −Z/left).
  // SEV2 door-slant fix (2026-07-04): the OPEN leaf must hang PLUMB from every angle + never pierce
  //   the terrain. The old pose over-swung (~−105°, so the beside view caught the leaf edge-on as a
  //   "propped plank") AND applied a rotation.x=−0.25 "tear/sag" that pitched the whole swung plane so
  //   the free-edge BOTTOM corner dropped below Y=0 into the sand (compounded by the pod's crash tilt,
  //   which read plumb from one azimuth + buried from another). FIX: swing about the VERTICAL hinge
  //   ONLY (rotation.x = 0) so the leaf stays perfectly plumb at any swing angle — its bottom edge
  //   holds at its rest height (cabin-Y ≈0.11, just above the floor) and can never dip into the ground;
  //   and cap the swing at ~85° so the leaf reads as a real open door held clear of the aperture (not
  //   flung past perpendicular). The only lean it now shows is the pod's own gentle crash tilt, applied
  //   uniformly to the whole pod → consistent from all azimuths.
  cabinHatchPivot.rotation.y = -0.24 - k * 1.24;   // ajar (~−14°) → kicked wide (~−85°)
  cabinHatchPivot.rotation.x = 0;                  // NO tear/sag — the vertical hinge keeps the leaf plumb + clear of the sand
}

// ─── ONE ENTERABLE POD (user re-scope, 2026-07-01) ────────────────────────────
// The user walk-tested the old flow: descent → wake INSIDE the cabin → step-out DISPOSED that
// cabin + placed a SEPARATE exterior wreck → "the world changes, there's a different pod". The
// fix: ONE unified pod. The SAME hero cabin the player rode down + woke in gets an EXTERIOR SKIN
// wrapped around it + WALKABLE colliders at step-out, becoming a single real, walk-in-able
// structure at the spawn — you climb out the hatch, and can walk back IN + around the SAME pod.
// NO dispose-and-swap; it PERSISTS into the real game (behind the flag) as an enterable landmark.
//
// The exterior skin is built at the SAME cabin-local frame + dimensions as buildCabinInterior
// (CAB_R/WALL_H/DOME_H/SHELL), with a real WALK-IN OPENING at the cabin's own HATCH_AZ (so the
// door you climbed out of = the door you walk back in), and the salvage panel on the −Z back.
// X2a item 6c — the crash GROUND dressing (displaced-sand berm + gouged furrow/scorch/debris) is
//   DISABLED at the user's request ("remove the sand streaks + mound — plain terrain"). Kept behind
//   this flag (off) rather than deleted, so it can be re-enabled if the user wants a subtler version.
const ENABLE_CRASH_GROUND_DRESSING = false;
let _podEnterable = false;              // true once the cabin has been unified into the walk-in pod (persists into the game)
let _enterableExteriorRoot: THREE.Group | null = null;  // the exterior-skin subtree added to podGroup
let _enterableBerm: THREE.Mesh | null = null;
// SAVE/LOAD (persistence fix) — the unified pod's world (x,z) placement, captured at unify so the
//   save can record it + a fresh-boot Continue can re-build the pod (which isn't rebuilt at boot —
//   only the intro flow builds it, and Continue never runs the intro). Null until unified.
let _enterablePodXZ: { x: number; z: number } | null = null;

// ── CRASH-AFTERMATH DRESSING (2026-07-03, user-approved bonus) — the physical crash story
//    read at the wake + step-out + walk-back views: a gouged landing FURROW behind the pod
//    (skid berms + darkened scorch streaking), a scorch RING under+around the base, and a
//    handful of scattered hull-fragment DEBRIS half-buried along the furrow. All procedural
//    geometry laid ON TOP of the terrain (overlay/skirt meshes conforming to heightAt — the
//    real heightfield is NOT deformed), position-seeded deterministic (identical on the
//    Continue/load path), noCollider (berms low + walkthrough — nothing traps the player).
//    Built by _buildCrashAftermath from unifyEnterablePod (so it appears on both the live
//    step-out AND the restoreEnterablePod load path). Disposed with the pod (_disposeCrashAftermath).
//    The interior post-crash touches (a brief lamp flicker at the wake + a dangling conduit +
//    a door-threshold dust drift) are built/driven separately (see _armWakeLampFlicker / the
//    aftermath interior block).
let _crashAftermath: THREE.Group | null = null;              // furrow + scorch + debris overlay subtree (scene-parented, world-placed)
const _crashAftermathGeos: THREE.BufferGeometry[] = [];      // per-build geometry to free on dispose
// Interior wake-lamp flicker (post-crash "sparking" touch) — a self-settling one-shot driven each
//   frame by updateChutePop while armed. Armed at the wake (setCabinCrashPose s→1); settles ~9s later.
let _wakeFlickerT = -1;                                       // <0 = not armed; else seconds since the wake flicker started
const _WAKE_FLICKER_DUR = 9.0;                               // the flicker self-settles within ~9s of the wake
let _danglingConduitSpark: THREE.Object3D | null = null;     // a self-lit tell on the dangling conduit that stutters with the lamp

/** Is the crashed pod currently the unified WALK-IN structure (exterior skin + walkable colliders,
 *  persisting into the real game)? */
export function podIsEnterable(): boolean { return _podEnterable; }

/** Build the EXTERIOR aluminium skin around the (already-built) interior cabin, in the cabin-LOCAL
 *  frame (floor top = y=0), matching the cabin's own radius/height. A revolved capsule body +
 *  ogive nose + riveted bands, FRONT-faced (seen from outside; culled from inside so it never
 *  occludes the interior read), with a real ARC GAP left over the escape-HATCH azimuth so the
 *  opening you walk through reads as a true hole in the hull, not a decal. Reentry scorch up the
 *  lower body ties it to the descent (it burned coming down). All meshes tagged noCollider — the
 *  walkable colliders are added separately by _addWalkableColliders. */
function buildExteriorSkin(group: THREE.Group): THREE.Group {
  const root = new THREE.Group();
  root.name = 'podExteriorSkin';
  const OUTR = CAB_R + SHELL;                     // outer hull radius (= POD_R; the exterior surface)
  const bodyTop = WALL_H;                         // shoulder where the nose springs (= interior wall height)
  const NOSE_H = DOME_H + 0.10;                   // exterior nose ≈ interior dome + a little crown
  const apex = bodyTop + NOSE_H;
  // the escape-hatch azimuth window to LEAVE OPEN in the exterior body (so you can walk in) —
  //   a touch wider than the door frame so the frame reads inside the opening, not clipped.
  const hAzHalf = Math.min(Math.PI * 0.9, (HATCH_W / 2 + 0.10) / OUTR);
  const hY0 = HATCH_CY - HATCH_H / 2, hY1 = HATCH_CY + HATCH_H / 2;

  // ── 1. BODY — a revolved lathe capsule (flared foot → straight body → shoulder → tucked ogive
  //    nose), matching the interior proportions. Built as the full revolve MINUS the hatch arc:
  //    the straight-body band that spans the hatch height is emitted as the complementary arc
  //    (bridging around the opening); the foot, upper body, shoulder + nose are full revolves.
  const prof: THREE.Vector2[] = [];
  prof.push(new THREE.Vector2(0.0, 0.0));
  prof.push(new THREE.Vector2(OUTR * 0.90, 0.0));
  prof.push(new THREE.Vector2(OUTR * 1.02, 0.16));                 // flared heat-shield foot
  prof.push(new THREE.Vector2(OUTR, 0.28));
  const SHOULDER_R = OUTR * 0.80;
  // Build the body as horizontal LATHE segments so we can gap the hatch band. Simpler + robust:
  //   emit the body as ONE full-revolve lathe (foot→shoulder→nose→apex), then CUT the hatch by
  //   overlaying a dark jamb (the interior hatch §10 already frames it) — but a real gap reads
  //   best. Use CylinderGeometry arc tubes for the straight-body zone (where the hatch lives) and
  //   a lathe for the nose. The straight body runs 0.28 → bodyTop.
  const straightY0 = 0.28, straightY1 = bodyTop - 0.05;
  // straight-body bands, gapping the hatch azimuth on any band that overlaps the door height.
  const bandEdges = Array.from(new Set([straightY0, hY0, hY1, straightY1].filter((y) => y >= straightY0 && y <= straightY1))).sort((a, b) => a - b);
  for (let i = 0; i < bandEdges.length - 1; i++) {
    const y0 = bandEdges[i], y1 = bandEdges[i + 1], mid = (y0 + y1) / 2, h = y1 - y0;
    if (h <= 0.001) continue;
    const overlapsHatch = mid > hY0 && mid < hY1;
    if (!overlapsHatch) {
      const t = _tube(OUTR, h, POD_SEG, _podPaint);
      t.position.y = (y0 + y1) / 2;
      root.add(t);
    } else {
      // the complementary arc that bridges AROUND the hatch opening (a real gap, not a decal)
      const t = _tube(OUTR, h, POD_SEG, _podPaint, ..._doorGapArc(HATCH_AZ, hAzHalf));
      t.position.y = (y0 + y1) / 2;
      root.add(t);
    }
  }
  // the flared FOOT — GAPPED at the hatch arc (round-2a: it's a full revolve up to y=0.28, which
  //   crests the door sill at 0.11, so it walled the very bottom of the aperture; same fix +
  //   _doorGapArc window as the canonical build's foot). Clear from the sill down; the welded flare
  //   still rings the rest of the base.
  const footProf: THREE.Vector2[] = [
    new THREE.Vector2(OUTR * 0.90, 0.0),
    new THREE.Vector2(OUTR * 1.02, 0.16),
    new THREE.Vector2(OUTR, 0.28),
  ];
  root.add(_lathe(footProf, POD_SEG, _podPaint, ..._doorGapArc(HATCH_AZ, hAzHalf)));
  // the SHOULDER + tucked OGIVE NOSE (above the body) — a full-revolve lathe cap.
  const noseProf: THREE.Vector2[] = [];
  noseProf.push(new THREE.Vector2(OUTR, straightY1));
  noseProf.push(new THREE.Vector2(SHOULDER_R, bodyTop + 0.04));    // shoulder chamfer
  const noseSegs = 8;
  for (let i = 1; i <= noseSegs; i++) {
    const t = i / noseSegs, a = t * (Math.PI / 2);
    const r = SHOULDER_R * Math.pow(Math.cos(a), 1.7) + 0.001;
    const y = bodyTop + 0.04 + Math.sin(a) * (NOSE_H - 0.04);
    noseProf.push(new THREE.Vector2(Math.max(0.05, r), y));
  }
  noseProf.push(new THREE.Vector2(0.001, apex));
  root.add(_lathe(noseProf, POD_SEG, _podPaint));
  // a scorched flat heat-shield base cap peeking at the sand (reentered base-first).
  const baseCap = _cyl(OUTR * 0.92, OUTR * 0.80, 0.24, POD_SEG, _podScorchMat);
  baseCap.position.y = 0.11;
  root.add(baseCap);

  // ── 2. REENTRY SCORCH — a char fade up the lower ~45% of the body (it burned coming down),
  //    a proud lathe shell over the body. Vertex-color char→tarnish→aluminium.
  //    ROUND-2a FIX (the user's "invisible-from-inside / visible-from-outside plate walling the
  //    lower doorway"): this scorch fade was a FULL 360° revolve at OUTR+0.01 up to scorchTopY≈1.15
  //    — the THIRD ungapped door-crossing revolve (buildCabinHatch's wall + buildCanonicalPodExterior
  //    were already gapped; THIS unify-time skin was the survivor). Its FrontSide face stood a curved
  //    grey plate right in the door plane across the whole lower aperture (the raycast fan from the
  //    outside eye hit podExteriorSkin/vertexColors at radial≈1.44 for every sill→mid ray). GAP it
  //    over the hatch arc (the SAME _doorGapArc window as the body bands/foot/hoops) so the doorway is
  //    clear from the sill up; the scorch still wraps the rest of the lower body. The az-derived
  //    vertex-colour fade is unchanged (atan2 still resolves the azimuth within the surviving arc).
  const scorchTopY = WALL_H * 0.45;
  const scorchProf: THREE.Vector2[] = [
    new THREE.Vector2(OUTR * 0.90 + 0.008, 0.0),
    new THREE.Vector2(OUTR * 1.03, 0.16),
    new THREE.Vector2(OUTR + 0.012, 0.28),
    new THREE.Vector2(OUTR + 0.010, scorchTopY),
  ];
  const scorchGeo = new THREE.LatheGeometry(scorchProf, POD_SEG, ..._doorGapArc(HATCH_AZ, hAzHalf));
  scorchGeo.computeVertexNormals();
  {
    const pos = scorchGeo.attributes.position;
    const cols = new Float32Array(pos.count * 3);
    const cChar = new THREE.Color(0x0d0906), cTarn = new THREE.Color(0x3e3a34), cAlu = new THREE.Color(0x565c62);   // cAlu → new gunmetal skin (was pale 0xb6b9b3); cTarn cooled to match (was warm 0x5a4126) — the scorch fade must blend UP into the retuned gunmetal, not the old pale aluminium
    const tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i), vy = pos.getY(i), vz = pos.getZ(i);
      const az = Math.atan2(vx, vz);
      const lick = 0.5 * Math.exp(-Math.pow((az - 0.4) / 0.7, 2)) + 0.18 * Math.sin(az * 5.0 + vy * 3.0);
      const span = Math.max(0.01, scorchTopY * (1 + lick));
      const t = Math.max(0, Math.min(1, vy / span));
      if (t < 0.45) tmp.copy(cChar).lerp(cTarn, t / 0.45);
      else tmp.copy(cTarn).lerp(cAlu, (t - 0.45) / 0.55);
      cols.set([tmp.r, tmp.g, tmp.b], i * 3);
    }
    scorchGeo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  }
  _cabinDisposables.push(scorchGeo);
  root.add(new THREE.Mesh(scorchGeo, _podScorchFadeMat));

  // ── 3. RIVETED LATITUDE BANDS — proud steel hoops + sparse rivet rings up the body (the
  //    hand-riveted aluminium read; matches the exterior wreck idiom). Gaps the hatch band.
  const bandYs = [WALL_H * 0.20, WALL_H * 0.44, WALL_H * 0.68, WALL_H * 0.90];
  for (const by of bandYs) {
    const crossesHatch = by > hY0 - 0.06 && by < hY1 + 0.06;
    if (!crossesHatch) {
      const hoop = _tube(OUTR + 0.05, 0.10, POD_SEG, _podBandMat);
      hoop.position.y = by;
      root.add(hoop);
    } else {
      const hoop = _tube(OUTR + 0.05, 0.10, POD_SEG, _podBandMat, ..._doorGapArc(HATCH_AZ, hAzHalf));
      hoop.position.y = by;
      root.add(hoop);
    }
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + 0.1;
      // skip rivets over the hatch opening
      let d = a - HATCH_AZ; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
      if (crossesHatch && Math.abs(d) < hAzHalf) continue;
      const sg = new THREE.SphereGeometry(0.017, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2);
      _cabinDisposables.push(sg);
      const rivet = new THREE.Mesh(sg, _podFrameMat);
      rivet.position.set(Math.sin(a) * (OUTR + 0.006), by, Math.cos(a) * (OUTR + 0.006));
      rivet.lookAt(0, by, 0);
      root.add(rivet);
    }
  }

  // ── 4. The OUTER hatch-opening TRIM — a channel-steel frame ringing the walk-in opening on
  //    the outside (the interior §10 frames the inside; this trims the outer lip) + a torn/pried
  //    tell so it reads as the blown escape hatch you climbed out of.
  {
    const dir = new THREE.Vector3(Math.sin(HATCH_AZ), 0, Math.cos(HATCH_AZ));
    const hFrame = new THREE.Group();
    hFrame.position.set(dir.x * OUTR, HATCH_CY, dir.z * OUTR);
    hFrame.rotation.y = HATCH_AZ;   // local +Z outward
    const fT = 0.10;
    const bar = (w: number, h: number, ox: number, oy: number) => {
      const b = _box(w, h, 0.10, _podSteel);
      b.position.set(ox, oy, -0.03);   // just proud of the outer surface
      hFrame.add(b);
    };
    bar(HATCH_W + fT * 2, fT, 0, HATCH_H / 2 + fT / 2);
    bar(HATCH_W + fT * 2, fT, 0, -HATCH_H / 2 - fT / 2);
    bar(fT, HATCH_H, -HATCH_W / 2 - fT / 2, 0);
    bar(fT, HATCH_H, HATCH_W / 2 + fT / 2, 0);
    root.add(hFrame);
  }

  // ── 5. CLUSTER D — the OUTER porthole bezel echo is RETIRED: the −Z arc is now the walk-in DOOR
  //    OPENING (HATCH_AZ = −Z), so a porthole bezel there would float in the opening. The domed
  //    porthole lives in the swinging door slab (buildCabinHatch); the outer opening is trimmed by
  //    §4's hatch-opening frame. (Was a separate −Z porthole echo when the viewport + hatch were on
  //    different arcs — now they're the same −Z front door.)

  root.traverse((o) => { (o as THREE.Mesh).userData.noCollider = true; });
  group.add(root);
  return root;
}

// ─── B1.a — THE CANONICAL POD MODULE + THE MERGED GLASS FRONT DOOR ────────────────
// The user's core ask: the EXACT SAME pod (the docked bay one they LIKE) the whole way —
// interior + exterior as ONE coherent asset. This is the shared EXTERIOR builder, used by
// the docked bay pod NOW (replacing shipScene's bespoke buildDockedPodExterior) and
// designed so the descent/landed swap onto it is trivial later (CLUSTER D): same body
// proportions (POD_R/WALL_H), same riveted-aluminium identity, and — the design change the
// user specified — the VIEWPORT IS IN THE DOOR: ONE front-facing unit the player faces for
// everything (board it, sit facing it, watch the descent through its glass, kick it open at
// the wake). No side viewport, no side hatch — the front door is the single aperture.
//
// LOCAL FRAME: the capsule stands on +Y (heat-shield base centre at y=0), the FRONT DOOR
// faces +X (the +X arc). In the bay, +X points at the arriving corridor player. The door
// has explicit STATES: 'closed' (flush, sealed — a clean glass window filling most of the
// door; the default the descent/crash ride in) and 'open' (swung ~110° for boarding/exit).
//
// GEOMETRY DIMENSIONS (front-door on the +X arc):
// W2a — the canonical bay door is now the SAME aperture + porthole as the ride cabin (FDOOR_/VP_
//   above): ONE dimension contract. Only the AZIMUTH is bay-specific (+X toward the corridor player).
const CPOD_DOOR_AZ = Math.PI / 2;        // +X arc (toward the corridor player in the bay)
const CPOD_DOOR_W = FDOOR_W;             // = 1.02 — SHARED with the ride cabin (one door)
const CPOD_DOOR_H = FDOOR_H;             // = 1.98 — SHARED (was a divergent 1.74)
const CPOD_DOOR_CY = FDOOR_CY;           // = 1.10 — SHARED (was a divergent 1.08); NOTE: shipScene's CPOD_BAY_DOOR_CY mirror must match → 1.10
// The domed porthole is the SAME size as the ride cabin's (VP_R/VP_BEZEL_OUT) so it's one model.
//   (X2b — CPOD_PORT_R alias removed; the unified buildUnifiedDoorSlab uses VP_R directly.)

// X2a — the divergent bay-door glass/rim materials (_cpodGlass + its Fresnel program + _cpodRimShadow)
//   are RETIRED: the bay door now uses the SAME _cabGlass + _cabDoorWellTint as the ride/landed cabin
//   door (buildCabinHatch), so the porthole reads IDENTICAL in↔out↔bay↔landed (one door, and one fewer
//   shader program).
// X2a — the old token-interior materials (_cpodInteriorShell/Band/Deck/Seat) are RETIRED: the bay
//   pod now builds the FULL real cabin interior (buildUnifiedPodInterior → buildCabinInterior), which
//   uses the shared _cab* materials — so the bay interior is the SAME materials as the ride cabin, not
//   a separate near-duplicate set (the source of the "not the same model" read).

export type CanonicalPodDoorState = 'closed' | 'open';
export interface CanonicalPodOpts {
  /** door state at build ('closed' = flush sealed glass window; 'open' = swung for boarding). */
  door?: CanonicalPodDoorState;
  /** body radius (defaults to POD_R — the hero cabin's outer hull radius). */
  r?: number;
}

/** Build the CANONICAL pod exterior (the shared module) in its LOCAL frame: a vertical
 *  riveted-aluminium capsule standing on its heat-shield (base centre y=0), with the MERGED
 *  GLASS FRONT DOOR on the +X arc. Returns { root, doorPivot } — doorPivot is the front door's
 *  hinge group (setCanonicalPodDoor / an animator can swing it). Reuses the shared _podPaint/
 *  _podBandMat/_podSteel/_podFrameMat/scorch identity so it's the SAME vessel inside↔out↔phase. */
export function buildCanonicalPodExterior(opts: CanonicalPodOpts = {}): { root: THREE.Group; doorPivot: THREE.Group } {
  const R = opts.r ?? POD_R;
  const state: CanonicalPodDoorState = opts.door ?? 'closed';
  const root = new THREE.Group();
  root.name = 'canonicalPod';
  const bodyTop = POD_BODY_H;                       // shoulder where the nose springs
  const NOSE_H = POD_NOSE_H;
  const apex = bodyTop + NOSE_H;
  const SHOULDER_R = R * 0.80;
  // the front-door azimuth window to leave OPEN in the body (a real gap the door seats into).
  const dAzHalf = Math.min(Math.PI * 0.85, (CPOD_DOOR_W / 2 + 0.08) / R);
  const dY0 = CPOD_DOOR_CY - CPOD_DOOR_H / 2, dY1 = CPOD_DOOR_CY + CPOD_DOOR_H / 2;

  // ── 1. BODY — the revolved capsule MINUS the front-door arc. Straight-body bands that span the
  //    door height are emitted as the complementary arc (bridging around the opening); the foot,
  //    upper body, shoulder + nose are full revolves. (Single clean geometry — B1.d: no doubled
  //    nested hoop shells; ONE band ring per latitude, below.)
  const straightY0 = 0.28, straightY1 = bodyTop - 0.05;
  const bandEdges = Array.from(new Set([straightY0, dY0, dY1, straightY1].filter((y) => y >= straightY0 && y <= straightY1))).sort((a, b) => a - b);
  for (let i = 0; i < bandEdges.length - 1; i++) {
    const y0 = bandEdges[i], y1 = bandEdges[i + 1], mid = (y0 + y1) / 2, h = y1 - y0;
    if (h <= 0.001) continue;
    const overlapsDoor = mid > dY0 && mid < dY1;
    if (!overlapsDoor) {
      const t = _tube(R, h, POD_SEG, _podPaint);
      t.position.y = mid; root.add(t);
    } else {
      const t = _tube(R, h, POD_SEG, _podPaint, ..._doorGapArc(CPOD_DOOR_AZ, dAzHalf));
      t.position.y = mid; root.add(t);
    }
  }
  // flared FOOT — GAPPED at the front-door arc (round-1f: it's a full revolve up to y=0.28, so it
  //   crested the door sill at 0.11 and walled the bottom of the aperture). The foot spans y 0→0.28
  //   which crosses the sill, so gap it over the door azimuth (same arc as the body bands) → the
  //   doorway is clear from the sill down; the flare still reads as a welded ring everywhere else.
  const footProf = [
    new THREE.Vector2(R * 0.90, 0.0), new THREE.Vector2(R * 1.02, 0.16), new THREE.Vector2(R, 0.28),
  ];
  root.add(_lathe(footProf, POD_SEG, _podPaint, ..._doorGapArc(CPOD_DOOR_AZ, dAzHalf)));
  // SHOULDER + tucked OGIVE NOSE (above the body)
  const noseProf: THREE.Vector2[] = [new THREE.Vector2(R, straightY1), new THREE.Vector2(SHOULDER_R, bodyTop + 0.04)];
  for (let i = 1; i <= 8; i++) {
    const t = i / 8, a = t * (Math.PI / 2);
    noseProf.push(new THREE.Vector2(Math.max(0.05, SHOULDER_R * Math.pow(Math.cos(a), 1.7) + 0.001), bodyTop + 0.04 + Math.sin(a) * (NOSE_H - 0.04)));
  }
  noseProf.push(new THREE.Vector2(0.001, apex));
  root.add(_lathe(noseProf, POD_SEG, _podPaint));
  // scorched heat-shield base cap
  const baseCap = _cyl(R * 0.92, R * 0.80, 0.24, POD_SEG, _podScorchMat);
  baseCap.position.y = 0.11; root.add(baseCap);

  // ── 2. REENTRY SCORCH — a char fade up the lower body (the shared identity weathering).
  //    ROUND-1f FIX (the "curved grey sheet walling the lower half of the doorway"): this scorch
  //    fade was a FULL 360° revolve at R+0.01 up to scorchTopY=1.15 — so on the +X door arc it stood
  //    a curved grey plate right in the door plane across the whole lower doorway (the raycast fan
  //    from the collar eye hit it at localX≈1.44 for every sill→mid ray). GAP it over the door arc
  //    (same window as the body bands / flared foot) so the aperture is clear from the sill up; the
  //    scorch still wraps the rest of the lower body. The az-derived vertex-colour fade is unchanged
  //    (atan2 still resolves the correct azimuth within the surviving arc).
  const scorchTopY = POD_BODY_H * 0.45;
  const scorchGeo = new THREE.LatheGeometry([
    new THREE.Vector2(R * 0.90 + 0.008, 0.0), new THREE.Vector2(R * 1.03, 0.16),
    new THREE.Vector2(R + 0.012, 0.28), new THREE.Vector2(R + 0.010, scorchTopY),
  ], POD_SEG, ..._doorGapArc(CPOD_DOOR_AZ, dAzHalf));
  scorchGeo.computeVertexNormals();
  {
    const pos = scorchGeo.attributes.position;
    const cols = new Float32Array(pos.count * 3);
    const cChar = new THREE.Color(0x0d0906), cTarn = new THREE.Color(0x3e3a34), cAlu = new THREE.Color(0x565c62);   // cAlu → new gunmetal skin (was pale 0xb6b9b3); cTarn cooled to match (was warm 0x5a4126) — the scorch fade must blend UP into the retuned gunmetal, not the old pale aluminium
    const tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i), vy = pos.getY(i), vz = pos.getZ(i);
      const az = Math.atan2(vx, vz);
      const lick = 0.5 * Math.exp(-Math.pow((az - 0.4) / 0.7, 2)) + 0.18 * Math.sin(az * 5.0 + vy * 3.0);
      const span = Math.max(0.01, scorchTopY * (1 + lick));
      const t = Math.max(0, Math.min(1, vy / span));
      if (t < 0.45) tmp.copy(cChar).lerp(cTarn, t / 0.45); else tmp.copy(cTarn).lerp(cAlu, (t - 0.45) / 0.55);
      cols.set([tmp.r, tmp.g, tmp.b], i * 3);
    }
    scorchGeo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  }
  _cabinDisposables.push(scorchGeo);
  root.add(new THREE.Mesh(scorchGeo, _podScorchFadeMat));

  // ── 3. RIVETED LATITUDE BANDS — ONE clean proud hoop per latitude + a sparse rivet ring (B1.d:
  //    single geometry, NO doubled/nested hoop shells). Gaps the door band.
  for (const by of [POD_BODY_H * 0.20, POD_BODY_H * 0.44, POD_BODY_H * 0.68, POD_BODY_H * 0.90]) {
    const crossesDoor = by > dY0 - 0.06 && by < dY1 + 0.06;
    const hoop = crossesDoor
      ? _tube(R + 0.05, 0.10, POD_SEG, _podBandMat, ..._doorGapArc(CPOD_DOOR_AZ, dAzHalf))
      : _tube(R + 0.05, 0.10, POD_SEG, _podBandMat);
    hoop.position.y = by; root.add(hoop);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + 0.1;
      let d = a - CPOD_DOOR_AZ; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
      if (crossesDoor && Math.abs(d) < dAzHalf) continue;
      const sg = new THREE.SphereGeometry(0.017, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2);
      _cabinDisposables.push(sg);
      const rivet = new THREE.Mesh(sg, _podFrameMat);
      rivet.position.set(Math.sin(a) * (R + 0.006), by, Math.cos(a) * (R + 0.006));
      rivet.lookAt(0, by, 0); root.add(rivet);
    }
  }
  // vertical seam battens around the barrel (skipping the front-door arc) — the panelled-plate read.
  for (const a of [Math.PI, Math.PI * 1.25, Math.PI * 1.5, Math.PI * 1.75, Math.PI * 0]) {
    let d = a - CPOD_DOOR_AZ; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
    if (Math.abs(d) < dAzHalf + 0.15) continue;
    const dir = new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
    const batten = _box(0.06, POD_BODY_H - 0.2, 0.05, _podSteel);
    batten.position.set(dir.x * (R + 0.02), POD_BODY_H / 2 + 0.1, dir.z * (R + 0.02));
    batten.rotation.y = -a; root.add(batten);
  }

  // ── 4. THE FRONT-DOOR APERTURE FRAME — a recessed channel-steel jamb ringing the +X opening
  //    (real depth, not a decal) + a warm-lit cabin peek behind it (so the sealed glass shows a
  //    lit interior). Built in a door-LOCAL group (local +Z = outward radial along +X).
  const doorDir = new THREE.Vector3(Math.sin(CPOD_DOOR_AZ), 0, Math.cos(CPOD_DOOR_AZ));
  const frame = new THREE.Group();
  frame.position.set(doorDir.x * R, CPOD_DOOR_CY, doorDir.z * R);
  frame.rotation.y = CPOD_DOOR_AZ;   // local +Z faces outward (+X); local +X tangential; local +Y up
  root.add(frame);
  // recessed jamb WELL going INWARD (−Z local, into the hull) so the opening reads deep.
  const fT = 0.11;
  for (const [w, h, ox, oy] of [
    [CPOD_DOOR_W, 0.05, 0, CPOD_DOOR_H / 2] as const,
    [CPOD_DOOR_W, 0.05, 0, -CPOD_DOOR_H / 2] as const,
    [0.05, CPOD_DOOR_H, -CPOD_DOOR_W / 2, 0] as const,
    [0.05, CPOD_DOOR_H, CPOD_DOOR_W / 2, 0] as const,
  ]) {
    const wall = _box(w, h, SKIN + 0.04, _podSteel);
    wall.position.set(ox, oy, -SKIN / 2 - 0.02);
    frame.add(wall);
  }
  // proud channel-steel frame border on the outer lip
  for (const [w, h, ox, oy] of [
    [CPOD_DOOR_W + fT * 2, fT, 0, CPOD_DOOR_H / 2 + fT / 2] as const,
    [CPOD_DOOR_W + fT * 2, fT, 0, -CPOD_DOOR_H / 2 - fT / 2] as const,
    [fT, CPOD_DOOR_H, -CPOD_DOOR_W / 2 - fT / 2, 0] as const,
    [fT, CPOD_DOOR_H, CPOD_DOOR_W / 2 + fT / 2, 0] as const,
  ]) {
    const bar = _box(w, h, 0.11, _podSteel);
    bar.position.set(ox, oy, 0.045);
    frame.add(bar);
  }
  // frame rivets
  for (let i = 0; i < 14; i++) {
    const u = i / 14; let sx: number, sy: number;
    if (u < 0.25) { sx = (u / 0.25 - 0.5) * CPOD_DOOR_W; sy = CPOD_DOOR_H / 2 + fT * 0.5; }
    else if (u < 0.5) { sx = CPOD_DOOR_W / 2 + fT * 0.5; sy = (1 - (u - 0.25) / 0.25 - 0.5) * CPOD_DOOR_H; }
    else if (u < 0.75) { sx = (0.5 - (u - 0.5) / 0.25) * CPOD_DOOR_W; sy = -CPOD_DOOR_H / 2 - fT * 0.5; }
    else { sx = -CPOD_DOOR_W / 2 - fT * 0.5; sy = ((u - 0.75) / 0.25 - 0.5) * CPOD_DOOR_H; }
    const sg = new THREE.SphereGeometry(0.015, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2);
    _cabinDisposables.push(sg);
    const stud = new THREE.Mesh(sg, _podFrameMat);
    stud.rotation.x = -Math.PI / 2; stud.position.set(sx, sy, 0.10);
    frame.add(stud);
  }
  // ── X2a — THE ONE REAL INTERIOR (user's #1 repeated ask): the bay pod's interior is now the
  //    SAME sealed cabin the player rides down + wakes in — the full BackSide riveted bore, seat,
  //    console, eject control, conduit, deck — NOT the old token 120° "peek" that left open SPACE
  //    visible through the seams from inside. buildUnifiedPodInterior builds buildCabinInterior into
  //    the ROOT (pod-local, floor at y=0), yawed so the cabin's front (−Z) faces the bay's +X door,
  //    so the seated player faces the door + the sealing shell walls off every other azimuth (no more
  //    "I can see out into space from inside it"). Built WITHOUT the cabin's own −Z door (the bay
  //    supplies its own +X door slab + hinge, §5) — so the interior + exterior are ONE model.
  const portCY = VP_CY - CPOD_DOOR_CY;   // porthole centre in door/frame-local coords (VP_CY 1.38 − door centre 1.10 → 0.28); used by the door §5 below.
  buildUnifiedPodInterior(root);
  // X2b — the bay pod uses the EXACT SAME cabin lamp rig as the ride cabin (buildCabinLampRig), so
  //   the interior reads IDENTICAL bright/character across bay→eject→ride→descent (the "post-eject
  //   cabin is TOO BRIGHT" defect was the bay being lit DIMMER — a lone 1.3 lamp + 0.55 fill, no
  //   directionals — so the swap to the ride's 1.7 lamp + 0.72 fill + two rake directionals read as
  //   a brightness JUMP). Same rig on both → no jump. (The bay doesn't animate these; refs dropped.)
  buildCabinLampRig(root, false);

  // ── 5. THE MERGED DOOR + DOMED PORTHOLE (user clarification 2026-07-02) — a SOLID riveted
  //    aluminium door with the ROUND DOMED porthole glass INTEGRAL to it (the same domed-circular
  //    viewport character the ride-down cabin has), NOT a flat glass pane. The player faces this
  //    door+porthole for everything (board through it, sit facing it, watch the descent through the
  //    round domed glass, kick it open at the wake). The bezel/frame is integral to the door — ONE
  //    clean ring, no doubled/floating rings (B1.d rule applies here too). Hinged on the +X edge.
  const doorPivot = new THREE.Group();
  doorPivot.name = 'canonicalPodDoor';
  // X2a item 4 (door-slant fix, mirrors buildCabinHatch's W6-item-6 fix): the hinge sits ON the
  //   aperture's RIGHT EDGE (x = +CPOD_DOOR_W/2), NOT +fT/2 PAST it. The old `+fT/2` pushed the hinge
  //   5.5 cm past the edge, so the closed door (which extends CPOD_DOOR_W left from the hinge) landed
  //   5.5 cm right of the aperture centre — overhanging the right jamb + gapping the left, reading as
  //   a SLANTED/ajar door (the user's "still slightly ajar pre-eject"). Hinge on the edge → flush.
  doorPivot.position.set(CPOD_DOOR_W / 2, 0, 0.06);   // hinge ON the +X aperture edge (the door closes flush)
  frame.add(doorPivot);
  const door = new THREE.Group();
  const doorTh = 0.10;
  // portCY (porthole centre, frame/door-local) declared above with the interior chamber — reused here.
  // X2b — the ENTIRE door slab + double-faced porthole (sealed through-bore) + double-faced grab
  //   latch + rivets are built by the ONE shared buildUnifiedDoorSlab, IDENTICAL to the ride cabin
  //   door (buildCabinHatch). This replaces the bay's bespoke inline slab that DIVERGED (a valve
  //   WHEEL latch vs the ride's grab-bar, no exterior-face porthole/handle, an open-sided aperture
  //   ring) — the "door reads as a different model during eject" defect. Same W/H/portY → same door.
  buildUnifiedDoorSlab(door, doorTh, CPOD_DOOR_W, CPOD_DOOR_H, portCY);
  door.position.set(-CPOD_DOOR_W / 2, 0, 0);   // door-local origin → the hinge (+X) edge
  doorPivot.add(door);
  // door state: closed = flush over the aperture (sealed); open = swung ~110° outward (into +X).
  doorPivot.rotation.y = state === 'open' ? -1.9 : 0;
  // ROUND-1f AIRTIGHT SEAL — a static STOP LIP inboard of the closed slab so the flat slab's edge
  //   clearance against the CURVED shell aperture reads as backed metal, not a star-gap crack to
  //   space. Frame local +Z = OUTWARD (+X), so cabin-inboard = −Z (inZ=−1). Closed slab inner face:
  //   doorPivot z=0.06 + slab centre 0 − doorTh/2 (0.05) → frame z=0.01.
  _addDoorStopLip(frame, CPOD_DOOR_W, CPOD_DOOR_H, -1, 0.06 - doorTh / 2);

  return { root, doorPivot };
}

/** Add WALKABLE colliders for the unified pod so the player can walk IN through the hatch + around
 *  the interior without passing through the hull. Replaces the seated cage (dropped at crash). The
 *  wall is a ring of thin box segments hugging the outer radius, GAPPED over the hatch azimuth (the
 *  walk-in opening) + a floor slab. Cabin-local offsets are stored so the collider ring rides the
 *  group transform (built AFTER the group is re-grounded, so world-space is baked at build time). */
function _addWalkableColliders(ctx: GameContext): void {
  if (!podGroup) return;
  podGroup.updateMatrixWorld(true);
  const OUTR = CAB_R + SHELL;
  // Y3 fix 6 (doorway friction) — the COLLIDER door gap is WIDER than the visual aperture so the KCC
  //   (radius 0.35) walks through with comfortable clearance (the pod-walkout probe stopped 0.3m short
  //   with the old tight gap: half 0.44 rad → ~1.15m gap, only 0.22m clearance each side of the 0.7m
  //   body, and the segment corners adjacent to the gap poked into the path). A +0.30m wider aperture
  //   (gap ≈1.75m at the wall) clears the body with margin — the VISUAL door design is unchanged (this
  //   only affects where the invisible wall colliders stop; the player walks the door they SEE, wider).
  const hAzHalf = Math.min(Math.PI * 0.9, (HATCH_W / 2 + 0.35) / CAB_R);
  const SEGN = 20;                       // wall arc segments
  const segLen = (Math.PI * 2) / SEGN;
  // the collider wall sits AT the visible interior bore (CAB_R) + a hair so the player stops at the
  //   riveted wall they SEE, not 24 cm past it. Box half-z (radial) is thin, centred just outside CAB_R.
  const wallColR = CAB_R + SHELL / 2;
  // FLOOR — a thin slab under the whole bore (the player stands on it inside).
  const _tmp = new THREE.Vector3();
  const _q = new THREE.Quaternion();
  const _s = new THREE.Vector3();
  const _localQuat = new THREE.Quaternion();
  const _worldQuat = new THREE.Quaternion();
  const addBox = (half: { x: number; y: number; z: number }, localPos: THREE.Vector3, yaw: number) => {
    // bake the group world transform into the collider pose (the group is static post-handoff).
    podGroup!.matrixWorld.decompose(_tmp, _q, _s);
    const worldPos = localPos.clone().applyMatrix4(podGroup!.matrixWorld);
    // world rotation = the group's rotation composed with the segment's local yaw about +Y.
    _localQuat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    _worldQuat.copy(_q).multiply(_localQuat);
    const col = makeStaticBox(ctx.physics.world, half,
      { x: worldPos.x, y: worldPos.y, z: worldPos.z },
      { x: _worldQuat.x, y: _worldQuat.y, z: _worldQuat.z, w: _worldQuat.w });
    const body = col.parent();
    if (body) podBodies.push(body);
  };
  // floor slab (bore radius) — a squat box.
  addBox({ x: OUTR, y: SHELL, z: OUTR }, new THREE.Vector3(0, -SHELL, 0), 0);
  // wall ring — box segments, skipping the ones over the hatch opening.
  for (let i = 0; i < SEGN; i++) {
    const az = i * segLen + segLen / 2;
    let d = az - HATCH_AZ; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
    if (Math.abs(d) < hAzHalf) continue;    // leave the hatch open (walk-in gap)
    const dir = new THREE.Vector3(Math.sin(az), 0, Math.cos(az));
    const segHalfTangent = wallColR * Math.tan(segLen / 2) + 0.02;   // half-width to cover the arc
    const localPos = new THREE.Vector3(dir.x * wallColR, CAB_APEX / 2, dir.z * wallColR);
    // a thin panel tangent to the wall: half-x = tangential half-width, half-z = thin (radial).
    addBox({ x: segHalfTangent, y: CAB_APEX / 2, z: SHELL }, localPos, az);
  }
  _cabinColliderCtx = ctx;
  _shellOffsets = [];   // walkable colliders are baked world-space + static (the group no longer moves), so no per-frame re-place
}

/** Y3 fix 7 — build the LANDED WALK-IN state (exterior skin + the walkable floor/wall colliders) on
 *  the pod, so the pod is a real walk-in structure from the CRASH onward (not a state-flip added at
 *  step-out). Idempotent: guarded on _enterableExteriorRoot (a second call is a no-op), so both the
 *  crash path (setCabinCrashPose) and the step-out path (unifyEnterablePod) can call it safely — the
 *  FIRST one wins and the state never changes. Requires the pod GROUP to be at its FINAL grounded +
 *  leaned pose (the colliders bake the world matrix). Does NOT touch lights/exposure/salvage. */
function _landPodWalkable(ctx: GameContext): void {
  if (!podGroup || _enterableExteriorRoot) return;
  const group = podGroup;
  group.updateMatrixWorld(true);
  // (a) EXTERIOR SKIN — the outer hull wrapped around the interior (matched dims, hatch gap). This is
  //     the visible base/body the user saw "swap in" at landing — now it's present from the crash, so
  //     the landed pod looks IDENTICAL from the crash to forever (Y3 finding 3, fix 7).
  _enterableExteriorRoot = buildExteriorSkin(group);
  group.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  // (b) WALKABLE COLLIDERS — floor slab + wall ring gapped at the −Z door (walk in/out + around).
  _addWalkableColliders(ctx);
}

/** UNIFY the crashed cabin into the ONE persistent WALK-IN pod at the spawn (user re-scope). Called
 *  at step-out INSTEAD of dispose-and-swap: the SAME hero cabin the player woke in gets (1) the
 *  exterior aluminium skin wrapped around it, (2) re-grounded so its floor sits ON the terrain (the
 *  seated ride left the floor ~1.7 m up — fine seated, wrong to walk into), (3) walkable colliders,
 *  and (4) the salvage panel + chute-pop armed. It then PERSISTS into the real game (NOT disposed by
 *  endEscapePodIntro) as an enterable landmark — the SAME pod you rode down, that you can walk back
 *  into. Returns the pod's world (x,z) so the tutorial can scatter around it. W6 item 5: the exposure
 *  is CONSTANT at the desert base throughout (no wake lift → nothing to ease/snap at step-out) and the
 *  walk-in lamps park at the SAME levels the wake ran at, so the wake→step-out→walk-in threshold is a
 *  ZERO visual shift — the wake IS the survival world. */
export function unifyEnterablePod(ctx: GameContext, x: number, z: number): { x: number; z: number } {
  if (!podGroup) { buildPodScene(ctx); setCabinCrashPose(1); }
  const group = podGroup!;
  const gy = ctx.terrain.heightAt(x, z);
  // Y3 fix 7 — the walkable colliders + exterior skin are now built at the CRASH (setCabinCrashPose →
  //   _landPodWalkable), so by the time we reach step-out they usually already exist and this call is
  //   a NO-OP for them (no state-flip, no base-swap — the landed pod is identical from crash → forever).
  //   BUT the LOAD path (restoreEnterablePod → here) and a dev jump straight to stepOut arrive WITHOUT
  //   a crash having grounded the pod, so we still (re-)ground + build here defensively. We only RE-
  //   GROUND / rebuild when the walkable state ISN'T built yet (crash didn't run); if it's built, the
  //   pod is already correctly grounded + collidered and we must NOT disturb it (that WAS the flip).
  if (!_enterableExteriorRoot) {
    // remove any leftover seated cage (a dev jump may still have it) before adding the walkable set.
    for (const body of podBodies) ctx.physics.world.removeRigidBody(body);
    podBodies.length = 0;
    _shellOffsets = [];
    // RE-GROUND: sever the descent base coupling + seat the floor on the terrain at the gentle crashed
    //   lean (pivot = the floor-base centre), so the walk-in floor sits on the sand + the hatch reaches it.
    _descentBase = null;
    _crashPose = 1;
    group.rotation.set(_CRASH_PITCH, _CRASH_YAW, _CRASH_ROLL);
    group.position.set(x, gy - 0.06, z);
    group.updateMatrixWorld(true);
    _cabinColliderCtx = ctx;
    _landPodWalkable(ctx);   // exterior skin + walkable floor/wall colliders (the SAME as the crash path)
  }
  // (5) W6 item 5 — the exposure is ALREADY at the desert base (the crash/wake never lifted it), so
  //     stepping out is a ZERO exposure shift. Re-assert the base defensively (belt-and-braces — the
  //     load path may enter here without a wake having run), then park the interior lamps at the SAME
  //     levels the wake ran at (parkPodLights uses the WAKE_* constants) → no light shift at the
  //     threshold either. The real midday sun through the blown-open door tops it up (the real world).
  ctx.three.renderer.toneMappingExposure = CABIN_BASE_EXPOSURE;
  parkPodLights();
  // widen the hatch fully open (you walk through it) + keep the dawn/midday hatch flood.
  blowCabinHatch(1);
  // (6) the REAL salvage panel on the −Z back + register as a machete-salvageable + arm chute-pop —
  //     the SAME first-salvage tutorial, now on the ONE persistent pod (not the separate wreck).
  _registerEnterablePodSalvage(ctx, group, x, z, gy);
  // X2a item 6c (user, 2026-07-04: "remove the sand streaks + mound around the crashed pod — the pod
  //   settles on plain terrain"): the displaced-sand berm (_addEnterableBerm) + the crash-aftermath
  //   dressing (_buildCrashAftermath: the gouged furrow + skid berms + scorch ring + scattered debris
  //   + door-sill sand drift) are REMOVED. The pod now sits on the plain survival terrain, no ground
  //   decoration. (The functions are kept for the dev-only placeCrashedPodWreck path but no longer run
  //   on the real step-out/restore.) _disposeCrashAftermath in disposePodScene stays a safe no-op.
  if (ENABLE_CRASH_GROUND_DRESSING) { _addEnterableBerm(ctx, x, z, gy); _buildCrashAftermath(ctx, x, z, gy); }
  _podEnterable = true;
  _enterablePodXZ = { x, z };   // SAVE/LOAD — record the placement so the save can persist + re-build it on Continue
  return { x, z };
}

/** Register the unified pod's REAL salvage panel + arm the chute-pop (the first-salvage tutorial,
 *  now on the ONE persistent pod instead of the separate wreck). The panel sits on the +Z back
 *  arc (clear of the −Z viewport / the hatch / the side controls), facing +Z outward, at standing
 *  reach. 'escape_pod' kind = the survivor's-kit loot palette. The salvageable id is what the
 *  tutorial driver watches to fire the chute-pop on the first pry. */
function _registerEnterablePodSalvage(ctx: GameContext, group: THREE.Group, x: number, z: number, gy: number): void {
  const OUTR = CAB_R + SHELL;
  const PANEL_LY = WALL_H * 0.5;      // standing reach on the body (cabin-local)
  const PANEL_LZ = OUTR;              // +Z back-face surface point
  addAccessPanel(group, 0, PANEL_LY, PANEL_LZ, 1.05, 0, 'escape_pod');   // faceYaw=0 → faces +Z outward
  group.updateMatrixWorld(true);
  // register the pod (the whole group) as a machete-salvageable — the same registry the world
  //   wrecks use; drives the pry/extract loop + the hover prompt. Deterministic position-seeded rng.
  const podRng = makeRng((Math.abs(Math.round(x * 73.7 + z * 149.3)) % 0x7fffffff) || 1);
  const rec = registerSalvageable(ctx.salvageables, group, 'escape_pod', new THREE.Vector3(x, gy, z), podRng);
  crashedPodSalvageableId = rec.id;
  // the unified pod IS the crashed wreck now (for the chute-pop parent + the salvageable teardown).
  crashedWreck = group;
  armChutePop(group);   // build the folded canopy on the crown of the UNIFIED pod, ready to burst on the first salvage strike
}

/** Bank a displaced-sand berm against the buried foot of the unified pod so the dune swallows the
 *  base with no clean float seam (the pod slammed in). Reuses the wreck-berm idiom. */
function _addEnterableBerm(ctx: GameContext, x: number, z: number, gy: number): void {
  const OUTR = CAB_R + SHELL;
  const bermGeo = new THREE.ConeGeometry(OUTR + 1.1, 0.85, 14, 2, false);
  const bp = bermGeo.attributes.position;
  for (let i = 0; i < bp.count; i++) {
    const vx = bp.getX(i), vy = bp.getY(i), vz = bp.getZ(i);
    const t = (vy + 0.42) / 0.85;
    const wob = 1 + (Math.sin(vx * 4.6 + vz * 3.3) * 0.22 + Math.cos(vz * 5.2) * 0.11) * (1 - t);
    bp.setXYZ(i, vx * wob, vy * 0.4, vz * wob);
  }
  bermGeo.computeVertexNormals();
  const berm = new THREE.Mesh(bermGeo, _podBermMat);
  berm.position.set(x, gy + 0.04, z);
  berm.receiveShadow = true;
  berm.castShadow = false;
  _enterableBerm = berm;
  ctx.three.scene.add(berm);
}

// ─── CRASH-AFTERMATH DRESSING (2026-07-03, user-approved bonus) ───────────────────────────────
// The physical crash story around the grounded pod, read at the wake + step-out + walk-back views.
// All geometry is laid ON TOP of the real terrain (conforming skirt/overlay meshes sampled at
// terrain.heightAt — the heightfield itself is never deformed) and is deterministic from the pod's
// (x,z) so it appears IDENTICALLY on the Continue/load path (restoreEnterablePod → unify → here).
//
// COMPOSITION (the heading choice): the merged FRONT DOOR faces cabin-local −Z (FDOOR_AZ=π; pod
// yaw≈0 → world −Z), which is the walk-out path + the step-out gaze side (the player steps out and
// looks toward the Leviathan at ~(-0.95,+0.31)). The salvage panel is on the +Z BACK. So the pod
// "plowed in front-first and skidded to a stop" reading with the furrow trailing BEHIND it would
// run straight up +Z — but that collides with the salvage-panel approach + the tutorial scatter
// ring on the +Z back. Instead the furrow trails off the pod's BACK-LEFT (a heading biased +Z and
// −X, dir ≈ (-0.57,+0.82)): it reads clearly behind/athwart the pod in the beside + 3q views, lies
// ACROSS the step-out gaze (composing with it, not down its axis), and leaves BOTH the −Z door path
// and the +Z salvage face clear. The pod sits at the near (deep) end; the furrow fades out ~20 m off.
const _FURROW_DIR = new THREE.Vector2(-0.57, 0.82).normalize();   // world XZ heading the furrow trails AWAY from the pod
const _FURROW_LEN = 21.0;          // furrow length (m) — within the 15-25 m ask; deepest at the pod, fades at the far end
const _FURROW_HALF_W = 1.55;       // half-width of the trench floor at the pod end (tapers to a point at the far end)

/** Build the crash-aftermath ground dressing (furrow + scorch + scattered debris) around the pod at
 *  world (x,z), ground gy. Deterministic from (x,z). Scene-parented + world-placed (like the berm),
 *  noCollider throughout. Idempotent-ish: disposes any prior aftermath first. */
function _buildCrashAftermath(ctx: GameContext, x: number, z: number, gy: number): void {
  _disposeCrashAftermath(ctx);
  const root = new THREE.Group();
  root.name = 'podCrashAftermath';
  const rng = makeRng((Math.abs(Math.round(x * 191.7 + z * 313.9)) % 0x7fffffff) || 1);   // position-seeded, independent stream
  const OUTR = CAB_R + SHELL;
  const dir = _FURROW_DIR;                       // unit heading (XZ) the furrow trails away
  const perp = new THREE.Vector2(-dir.y, dir.x); // left-perpendicular
  const hAt = (wx: number, wz: number) => ctx.terrain.heightAt(wx, wz);   // sample the REAL surface

  // ── 1. THE FURROW — a conforming ribbon of quad-strip segments from the pod (s=0, deepest +
  //    widest) out to the far end (s=1, faded to nothing). Each cross-section has a sunken packed
  //    trench FLOOR + a raised skid BERM ridge on each edge (the plowed-up sand). Built as vertex
  //    strips so it conforms to the terrain per-sample (no heightfield deform, no z-fight — the
  //    floor sits a hair above grade, the berms rise off it).
  const SEGS = 26;                                // lengthwise samples along the furrow
  const START = OUTR * 0.72;                      // begin just inside the pod foot so the trench reads emerging from under it
  // per-sample cross-section arrays (world positions): floor L/R + centre, berm crest L/R.
  const floorL: THREE.Vector3[] = [], floorR: THREE.Vector3[] = [], floorC: THREE.Vector3[] = [];
  const crestL: THREE.Vector3[] = [], crestR: THREE.Vector3[] = [];
  const outerL: THREE.Vector3[] = [], outerR: THREE.Vector3[] = [];   // where the berm feathers back to grade
  for (let i = 0; i <= SEGS; i++) {
    const s = i / SEGS;                           // 0 at pod, 1 at far end
    const along = START + s * (_FURROW_LEN - START);
    // a slight wander so the skid isn't a ruled line (the plow drifted) — SMALL so it reads as a
    //   violent straight gouge, not a wandering path (R3 fix: the smooth wide wander read road-like).
    const wander = (Math.sin(s * 4.1 + 1.4) * 0.32 + Math.sin(s * 9.0) * 0.12) * (0.25 + s * 0.4);
    const cx = x + dir.x * along + perp.x * wander;
    const cz = z + dir.y * along + perp.y * wander;
    // width + depth TAPER: full at the pod, → 0 at the far end (the pod decelerated, so the gouge is
    //   deepest where it stopped and shallows out where it first touched down further along).
    const taper = Math.pow(1 - s, 0.8);
    // WIDE dark trench + a NARROW proud berm LIP (R4 — the R3 wide light berms swamped the thin dark
    //   floor → read as a light path; invert it: the sunken DARK floor is the dominant read, the berm
    //   is a tight raised lip of turned sand right at its edge that catches a shadow line).
    const halfW = _FURROW_HALF_W * (0.62 + 0.5 * taper) + 0.08;
    const depth = (1.05 * taper + 0.08) * (0.9 + 0.2 * Math.sin(s * 6.0));   // trench floor drop below grade
    const bermH = 0.8 * taper + 0.07;             // berm crest rise above grade (a proud plowed lip; step-over)
    const bermOut = halfW + 0.42 + 0.22 * taper;  // TIGHT berm lip (was wide → swamped the floor); feathers quickly back to grade
    // sample the real terrain across the section so the ribbon conforms.
    const lx = cx + perp.x * halfW, lz = cz + perp.y * halfW;
    const rx = cx - perp.x * halfW, rz = cz - perp.y * halfW;
    const olx = cx + perp.x * bermOut, olz = cz + perp.y * bermOut;
    const orx = cx - perp.x * bermOut, orz = cz - perp.y * bermOut;
    floorC.push(new THREE.Vector3(cx, hAt(cx, cz) - depth + 0.02, cz));
    floorL.push(new THREE.Vector3(lx, hAt(lx, lz) - depth * 0.82 + 0.02, lz));   // edges drop near-full depth → a real sunken basin, not a shallow vee
    floorR.push(new THREE.Vector3(rx, hAt(rx, rz) - depth * 0.82 + 0.02, rz));
    crestL.push(new THREE.Vector3(lx, hAt(lx, lz) + bermH, lz));
    crestR.push(new THREE.Vector3(rx, hAt(rx, rz) + bermH, rz));
    outerL.push(new THREE.Vector3(olx, hAt(olx, olz) + 0.02, olz));
    outerR.push(new THREE.Vector3(orx, hAt(orx, orz) + 0.02, orz));
  }
  // helper: build a triangle-strip mesh between two same-length rails of world points.
  //   `cast` — the proud BERM strips cast shadow (the raking sun rakes a shadow off the ridge INTO the
  //   trench, which is what makes the relief read as a real gouge, not a painted stripe — R3 fix).
  const strip = (a: THREE.Vector3[], b: THREE.Vector3[], mat: THREE.Material, cast = false): void => {
    const verts: number[] = [], idx: number[] = [];
    for (let i = 0; i < a.length; i++) { verts.push(a[i].x, a[i].y, a[i].z, b[i].x, b[i].y, b[i].z); }
    for (let i = 0; i < a.length - 1; i++) {
      const p = i * 2; idx.push(p, p + 1, p + 2, p + 1, p + 3, p + 2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    g.setIndex(idx); g.computeVertexNormals();
    _crashAftermathGeos.push(g);
    const m = new THREE.Mesh(g, mat);
    m.receiveShadow = true; m.castShadow = cast;
    root.add(m);
  };
  // the packed trench floor (centre split into two half-strips so the vee reads).
  strip(floorL, floorC, _furrowFloorMat);
  strip(floorC, floorR, _furrowFloorMat);
  // the skid berms (floor edge → raised crest → feather back to grade), each side. The inner face
  //   (floor→crest) is the trench wall; the crest strips CAST shadow so the ridge rakes a shadow line.
  strip(floorL, crestL, _furrowBermMat, true);
  strip(crestL, outerL, _furrowBermMat, true);
  strip(floorR, crestR, _furrowBermMat, true);
  strip(crestR, outerR, _furrowBermMat, true);
  // a darkened SCORCH STREAK down the trench floor (the hull dragged hot) — a narrow transparent
  //   overlay just above the floor, fading out toward the far end (opacity via a second thinner strip).
  {
    const scL: THREE.Vector3[] = [], scR: THREE.Vector3[] = [];
    for (let i = 0; i <= SEGS; i++) {
      const s = i / SEGS; const fw = _FURROW_HALF_W * 0.6 * Math.pow(1 - s, 1.1) + 0.04;
      const c = floorC[i];
      scL.push(new THREE.Vector3(c.x + perp.x * fw, c.y + 0.03, c.z + perp.y * fw));
      scR.push(new THREE.Vector3(c.x - perp.x * fw, c.y + 0.03, c.z - perp.y * fw));
    }
    const g = new THREE.BufferGeometry();
    const verts: number[] = [], idx: number[] = [];
    for (let i = 0; i <= SEGS; i++) { verts.push(scL[i].x, scL[i].y, scL[i].z, scR[i].x, scR[i].y, scR[i].z); }
    for (let i = 0; i < SEGS; i++) { const p = i * 2; idx.push(p, p + 1, p + 2, p + 1, p + 3, p + 2); }
    g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    g.setIndex(idx); g.computeVertexNormals();
    _crashAftermathGeos.push(g);
    const m = new THREE.Mesh(g, _crashScorchMat); m.renderOrder = 2; m.receiveShadow = false;
    root.add(m);
  }

  // ── 2. THE SCORCH under+around the pod base — the re-entry-hot hull met the sand. A char smear
  //    HUGGING the base (not a big flat halo) + a fainter heat-discolour edge, conforming flat discs
  //    just above grade (meteorCrash scorch idiom: transparent lambert, depthWrite off, renderOrder).
  //    Elongated along the furrow heading (the hull skidded in), so it reads as a smear that CONNECTS
  //    to the furrow, not a clean concentric ring. Built as a RingGeometry (annulus) hugging the foot
  //    so it doesn't paint a big opaque disc over the whole clearing (the R1 over-large read).
  //    Elongation is baked into the GEOMETRY (scale then bake) so the flat-on-ground rotation is clean.
  const skidYaw = Math.atan2(dir.x, dir.y);   // world yaw of the furrow heading (about +Y)
  // An IRREGULAR conforming scorch patch (NOT a clean concentric ring — the R1 "landing-pad" read):
  //   a radial fan of verts whose radius wobbles per-angle (a lobed blob) and is EXTENDED toward the
  //   furrow heading (the skid smeared the char back along the gouge). Two layers: a tight dark char
  //   + a fainter heat-discolour skirt. Conforms to the terrain per-vert; depthWrite off + renderOrder.
  const scorchLobe = (rBase: number, rWob: number, mat: THREE.Material, ro: number, yLift: number, seed: number): void => {
    const N = 40;
    const verts: number[] = [], idx: number[] = [];
    verts.push(x, hAt(x, z) + yLift, z);   // centre
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * Math.PI * 2;
      // lobed wobble + a smear extension where the angle aligns with the furrow heading.
      const along = Math.cos(a - skidYaw);            // 1 when pointing down the furrow
      const wob = 1 + rWob * (Math.sin(a * 3.0 + seed) * 0.5 + Math.sin(a * 5.0 + seed * 1.7) * 0.3);
      const smear = 1 + Math.max(0, along) * 0.55;     // reach further along the skid
      const r = rBase * wob * smear;
      const wx = x + Math.cos(a) * r, wz = z + Math.sin(a) * r;
      verts.push(wx, hAt(wx, wz) + yLift, wz);
    }
    for (let i = 1; i <= N; i++) idx.push(0, i, i + 1);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    g.setIndex(idx); g.computeVertexNormals();
    _crashAftermathGeos.push(g);
    const m = new THREE.Mesh(g, mat);
    m.renderOrder = ro; m.receiveShadow = false; m.castShadow = false;
    root.add(m);
  };
  // heat-discolour skirt first (fainter, wider, under) → then the tight dark char on top.
  scorchLobe(OUTR + 0.7, 0.16, _crashHeatMat, 1, 0.03, 2.1);
  scorchLobe(OUTR + 0.05, 0.18, _crashScorchMat, 2, 0.045, 0.7);

  // ── 3. SCATTERED CRASH DEBRIS — a handful of the pod's OWN hull fragments (riveted aluminium
  //    panels, a scorched band fragment, a snapped antenna) strewn along the furrow + around the
  //    pod, half-buried at varied angles. noCollider set-dressing (NOT lootable — the salvage panel
  //    is the loot). Deterministic from the seeded rng.
  const debrisN = 7 + Math.floor(rng() * 3);           // 7-9 fragments
  for (let i = 0; i < debrisN; i++) {
    // bias placement along the furrow (most debris trails the skid) with a couple flung to the sides.
    const alongT = rng();
    const along = OUTR * 0.9 + alongT * (_FURROW_LEN * 0.92);
    const side = (rng() - 0.5) * (_FURROW_HALF_W * 2.2 + 1.6 * alongT);   // spreads wider further out
    const dx = x + dir.x * along + perp.x * side;
    const dz = z + dir.y * along + perp.y * side;
    const dy = hAt(dx, dz);
    const kind = rng();
    let frag: THREE.Mesh;
    if (kind < 0.42) {
      // a torn riveted aluminium HULL PANEL — a thin slab with a few rivet studs.
      const pw = 0.42 + rng() * 0.55, pd = 0.34 + rng() * 0.4;
      frag = _box(pw, 0.06, pd, _crashPanelMat);   // flat scuffed-aluminium (fragment-safe; see _crashPanelMat)
      const rvN = 2 + Math.floor(rng() * 3);
      for (let r = 0; r < rvN; r++) {
        const sg = new THREE.SphereGeometry(0.02, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2);
        _crashAftermathGeos.push(sg);
        const rv = new THREE.Mesh(sg, _crashCharMat);   // flat dark stud (no warm-oxide fragment glow)
        rv.position.set((rng() - 0.5) * pw * 0.7, 0.03, (rng() - 0.5) * pd * 0.7);
        frag.add(rv);
      }
    } else if (kind < 0.68) {
      // a SCORCHED BAND FRAGMENT — a short curved band offcut, scorched dark (a neutral flat matte,
      //   NOT _podBandMat: the hull shader's warm oxide layers glow coral-red on a small fragment
      //   under the low raking sun — the R1 "red toy" read; a scorched band offcut reads dark anyway).
      const arc = 0.5 + rng() * 0.8;
      const bg = new THREE.CylinderGeometry(0.34, 0.34, 0.11 + rng() * 0.08, 10, 1, true, 0, arc);
      _crashAftermathGeos.push(bg);
      frag = new THREE.Mesh(bg, _crashCharMat);
      frag.rotation.x = Math.PI / 2;   // lay the band arc on the sand
    } else if (kind < 0.84) {
      // a CHARRED HULL CHUNK — a small dark scorched fragment (heat-shield/base offcut).
      const cw = 0.3 + rng() * 0.4;
      frag = _box(cw, 0.14 + rng() * 0.12, cw * (0.7 + rng() * 0.5), _crashCharMat);
    } else {
      // a SNAPPED ANTENNA / strut — a thin dark rod half-sunk at an angle.
      const len = 0.9 + rng() * 0.8;
      const ag = new THREE.CylinderGeometry(0.025, 0.035, len, 6);
      _crashAftermathGeos.push(ag);
      frag = new THREE.Mesh(ag, _crashCharMat);   // dark matte strut (no warm-oxide fragment glow)
      frag.rotation.z = Math.PI / 2 - (0.3 + rng() * 0.5);   // tilted, mostly lying down
    }
    // half-bury: sink each fragment part-way + random yaw + a small settle tilt.
    frag.position.set(dx, dy - (0.02 + rng() * 0.06), dz);
    frag.rotation.y = rng() * Math.PI * 2;
    frag.rotation.x += (rng() - 0.5) * 0.6;
    frag.rotation.z += (rng() - 0.5) * 0.5;
    frag.castShadow = true; frag.receiveShadow = true;
    frag.traverse((o) => { (o as THREE.Mesh).userData.noCollider = true; });
    if (frag.geometry) _crashAftermathGeos.push(frag.geometry);   // _box geos already tracked in _cabinDisposables; band/antenna tracked above — harmless dup-safe (dispose is idempotent per-geo)
    root.add(frag);
  }

  // ── 4. DOOR-THRESHOLD SAND DRIFT — a light drift of sand blown in over the open −Z door sill
  //    (the desert crept in through the blown door). A low flat wedge tonguing from the sill INWARD
  //    across the floor, fingering out. Subtle. The door faces cabin-local −Z; the pod yaw≈0, so the
  //    sill is at world (x, gy, z−OUTR). Built here (deterministic, disposed with the aftermath) but
  //    placed at the interior floor so it reads on the walk-in / wake-toward-door frames.
  {
    const sillZ = z - OUTR * 0.9;                 // just inside the −Z door opening
    const driftGeo = new THREE.PlaneGeometry(HATCH_W + 0.5, 1.4, 6, 4);
    const dp = driftGeo.attributes.position;
    for (let i = 0; i < dp.count; i++) {
      const px = dp.getX(i), py = dp.getY(i);     // plane local: x across the sill, y from sill (−) inward (+)
      // taper the tongue to fingers inward + a slight wind-rippled crest near the sill.
      const inward = (py + 0.7) / 1.4;            // 0 at the sill edge, 1 at the inner tip
      const ripple = Math.sin(px * 6.0) * 0.02 * (1 - inward);
      const lift = (0.06 * (1 - inward) + ripple) * (1 - Math.abs(px) / (HATCH_W * 0.5 + 0.3));   // sand piled at the sill, thinning inward + at the edges
      dp.setZ(i, Math.max(0, lift));
    }
    driftGeo.computeVertexNormals();
    _crashAftermathGeos.push(driftGeo);
    const drift = new THREE.Mesh(driftGeo, _furrowBermMat);
    drift.rotation.x = -Math.PI / 2;              // lay flat on the floor
    // position at the sill, tongue pointing inward (+Z, toward the cabin centre from the −Z door).
    drift.position.set(x, gy + 0.05, sillZ + 0.5);
    drift.receiveShadow = true; drift.castShadow = false;
    root.add(drift);
  }

  root.traverse((o) => { (o as THREE.Mesh).userData.noCollider = true; });
  _crashAftermath = root;
  ctx.three.scene.add(root);
}

/** Tear down the crash-aftermath dressing (disposes its owned geometry; materials are module-shared).
 *  Called by _buildCrashAftermath (rebuild) + disposePodScene (teardown). */
function _disposeCrashAftermath(ctx: GameContext): void {
  if (_crashAftermath) { ctx.three.scene.remove(_crashAftermath); _crashAftermath = null; }
  for (const g of _crashAftermathGeos) g.dispose();
  _crashAftermathGeos.length = 0;
}

// ─── SAVE/LOAD — the enterable pod is a PERSISTENT world object built ONLY by the intro's stepOut
//    (unifyEnterablePod), NOT re-derived at boot. So Continue (which never runs the intro) must
//    re-build it from a saved record + re-apply its salvage/chute state. serializeEnterablePod reads
//    that state for the save; restoreEnterablePod re-builds the pod on load. Both no-op / return null
//    when the pod isn't present, so a flag-off game (no unify ever) writes nothing + restores nothing.

/** The saved additive pod-crash record. Optional in the save (older saves omit it → no pod restore,
 *  matching the `introComplete` additive precedent — NO SAVE_VERSION bump). */
export interface SavedPodCrash {
  x: number;
  z: number;
  salvageRemaining: number;
  stripped: boolean;
  panelOpened: boolean;
  extractedIndices: number[];
  chutePopped: boolean;
}

/** Read the enterable pod's current crash state for the save. Returns null when there is no unified
 *  walk-in pod (flag-off games, or an intro that never reached step-out) → the save writes no
 *  podCrash field (additive/optional). State is read from the pod's salvageable record + panel +
 *  the chute-pop module state, so it is WYSIWYG on reload (the exact visible/pried/popped set). */
export function serializeEnterablePod(ctx: GameContext): SavedPodCrash | null {
  if (!_podEnterable || !_enterablePodXZ) return null;
  const rec = crashedPodSalvageableId >= 0
    ? ctx.salvageables.list.find((s) => s.id === crashedPodSalvageableId)
    : undefined;
  const panel = rec?.panel;
  const comps = (panel?.userData.panelComponents as Array<{ visible: boolean }> | undefined) ?? [];
  return {
    x: _enterablePodXZ.x,
    z: _enterablePodXZ.z,
    salvageRemaining: rec?.salvageRemaining ?? 0,
    stripped: rec?.stripped ?? false,
    panelOpened: panel ? panel.userData.panelOpened === true : false,
    // ACAX WYSIWYG — which interior components are GONE (extracted OR condition-surplus).
    extractedIndices: comps.flatMap((c, i) => (c.visible ? [] : [i])),
    // the comic chute has already burst (popped once) if the pop clock has been started (>=0).
    chutePopped: chutePopT >= 0,
  };
}

/** Re-build the enterable pod on load from a saved record, WITHOUT the intro running (Continue never
 *  runs the intro). Builds the cabin + exterior skin + walkable colliders + salvage panel + chute
 *  (reusing unifyEnterablePod's machinery), then applies the saved salvage/pried/chute state DIRECTLY
 *  to the pod's fresh salvageable record (the id counter differs between sessions, so the generic
 *  by-id patch in save.ts cannot reach it — we apply here off crashedPodSalvageableId). No-op if the
 *  pod is already built (defensive — a re-entered intro or a double-restore). This is a real-world
 *  handoff: unifyEnterablePod already restores the desert-base exposure + sets no intro state, so it
 *  leaks nothing (exposure/fog/HUD stay the loaded game's — STATE-RESTORE discipline). */
export function restoreEnterablePod(ctx: GameContext, saved: SavedPodCrash): void {
  if (_podEnterable) return;   // already present (shouldn't happen on a fresh Continue boot)
  // Build the ONE walk-in pod at the saved (x,z). unifyEnterablePod builds the cabin if needed
  //   (podGroup null on a fresh boot), wraps the skin, grounds it, adds colliders, registers the
  //   salvage panel + arms the chute-pop, and sets _podEnterable + _enterablePodXZ. W6 item 5: it
  //   holds the desert-base exposure (no lift anywhere), so the Continue load is byte-clean too.
  unifyEnterablePod(ctx, saved.x, saved.z);
  // Apply the saved salvage state DIRECTLY to the just-registered record (NOT via the generic
  //   by-id patch — the id counter differs between sessions). crashedPodSalvageableId now points at
  //   the fresh record from unify's _registerEnterablePodSalvage.
  const rec = crashedPodSalvageableId >= 0
    ? ctx.salvageables.list.find((s) => s.id === crashedPodSalvageableId)
    : undefined;
  if (rec) {
    rec.salvageRemaining = saved.salvageRemaining;
    if (saved.stripped) markSalvageStripped(rec);
    const panel = rec.panel;
    // re-hide the components that were gone at save (extracted + condition-surplus) so the visible
    //   set matches salvageRemaining (WYSIWYG) — mirrors the save.ts salvageables restore.
    const comps = (panel.userData.panelComponents as Array<{ visible: boolean }> | undefined) ?? [];
    for (const idx of saved.extractedIndices) { if (comps[idx]) comps[idx].visible = false; }
    // if the panel was already pried open, restore the opened door state (updatePanelDoors keeps
    //   it open thereafter — it reads panelOpened + panelDoorTarget).
    if (saved.panelOpened) {
      panel.userData.panelOpened = true;
      panel.userData.panelDoorTarget = Tuning.SALVAGE_PANEL_DOOR_OPEN_ANGLE;
      panel.userData.panelDoorAngle = Tuning.SALVAGE_PANEL_DOOR_OPEN_ANGLE;
    }
  }
  // if the comic chute had already burst before save, restore it DIRECTLY to the settled DRAPE
  //   INSTANTLY (popChute(advanceSeconds) drives the whole pop→flutter→deflate→settle life-cycle
  //   synchronously at calm wind — no flutter replay on reload). armChutePop built a fresh folded
  //   canopy inside unify; fast-forward it past CHUTE_SETTLED_AT so a reload shows the crumpled
  //   drape, not a re-triggered pop.
  if (saved.chutePopped) popChute(CHUTE_SETTLED_AT + 0.6);
}

// Load order (mirrors meteorCrash's pending-restore): onContinue runs loadGameState (which stashes
//   here) THEN handoffToGame (whose world resets run). We can't restore inside loadGameState — it'd
//   run before the handoff. So loadGameState stashes the saved podCrash; main.ts applies it right
//   AFTER the handoff via applyPendingPodCrashRestore.
let _pendingPodCrash: SavedPodCrash | null = null;
export function setPendingPodCrashRestore(saved: SavedPodCrash | null): void { _pendingPodCrash = saved; }
/** Apply the stashed pod-crash restore (called by main.ts right after handoffToGame on Continue).
 *  Returns the re-built pod's placement + whether its comic chute already popped, so main.ts can
 *  resume the pod tutorial driver (fire the chute-pop on a first post-reload pry) WITHOUT this module
 *  importing podTutorial (which imports us — avoids a cycle). Null when there was nothing to restore. */
export function applyPendingPodCrashRestore(ctx: GameContext): { x: number; z: number; chutePopped: boolean } | null {
  const p = _pendingPodCrash;
  _pendingPodCrash = null;
  if (!p) return null;
  restoreEnterablePod(ctx, p);
  return { x: p.x, z: p.z, chutePopped: p.chutePopped };
}

// ─── RE-ENTRY FX (Phase 2 / T2.2 — the violent atmospheric-entry climax) ──────
// As the pod punches the upper atmosphere (the `re` bump, peak ~p0.28) the air ahead
// IONIZES and burns past the viewport. Two layered shaders, both reading THROUGH the
// porthole only (the cabin bezel/wall occludes them like the vista — depthTest on):
//
//   PLASMA_FS — additive ORANGE→WHITE-HOT incandescent air burning past/around the window.
//     A leading incandescent EDGE piled up at the lower/leading rim where the air compresses
//     (the pod falls nose-down → the air rakes UP past the glass), with white-hot streaking
//     TRAILS raked along the fall direction + flicker, brightest at peak `re`. NON-uniform
//     (noise-broken, denser at the leading edge) so it isn't a flat glow, and additive over
//     the vista so the planet/atmosphere still read THROUGH it (air on fire in front of you,
//     not a solid fill). toneMapped:false so the white-hot core survives the Reinhard curve.
//
//   SHIMMER_FS — a subtle heat-haze: faint warm wobbling ripples over the porthole vista
//     (the air boiling in front of the glass), scaled by `re`. A SHIMMER (low-amplitude
//     animated bands), not a smear — it makes the air read HOT without occluding the vista.
//
// Both are full-screen-ish curved planes between the vista (z−5) and the glass (z≈−1.22);
// depthTest keeps them inside the round aperture. uRe (0..1) gates strength; uTime animates.
const REENTRY_VS = /* glsl */ `
  varying vec2 vUv;
  void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const PLASMA_FS = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uRe;     // 0..1 re-entry intensity (the bump; peak ~p0.28)
  uniform float uTime;   // seconds — animates the streak scroll + flicker

  float hash(vec2 p){ p = fract(p*vec2(127.1,311.7)); p += dot(p, p+34.5); return fract(p.x*p.y); }
  float vn(vec2 x){ vec2 p=floor(x), f=fract(x); f=f*f*(3.0-2.0*f);
    return mix(mix(hash(p),hash(p+vec2(1,0)),f.x), mix(hash(p+vec2(0,1)),hash(p+vec2(1,1)),f.x), f.y); }
  float fbm(vec2 p){ float a=0.55, s=0.0; for(int i=0;i<4;i++){ s+=a*vn(p); p=p*2.05+1.7; a*=0.5; } return s; }

  void main(){
    if (uRe <= 0.001) discard;
    vec2 p = vUv - 0.5;
    float t = uTime;

    // ── SLIPSTREAM frame (fix 4). The pod falls nose-down under hypersonic shear, so the air
    //    rips past the glass along a consistent DIAGONAL (up-and-across), not straight up like a
    //    campfire. Build a sheared coordinate: s runs along the slipstream (the flow axis),
    //    q across it. All the fire structure is sampled in this frame so it streaks past.
    const vec2 flowDir = vec2(0.34, 0.94);             // up + raked right (the slipstream)
    const vec2 flowPerp = vec2(0.94, -0.34);
    float s = dot(p, flowDir);                         // along the flow (0 mid, + downstream/up)
    float q = dot(p, flowPerp);                        // across the flow

    // ── TURBULENT streak field sampled in the slipstream frame, scrolling ALONG the flow fast
    //    (filaments raked past the glass). Tight across-flow, stretched along-flow → long
    //    threads. Two octaves at different rates for a turbulent, non-uniform rip.
    float s1 = fbm(vec2(q*9.0, s*1.7 - t*3.4));
    float s2 = fbm(vec2(q*17.0 + 4.0, s*2.8 - t*5.0));
    float streak = s1*0.62 + s2*0.5;
    // Sharpen HARD into distinct threads with dark lanes between (the vista shows through the
    // lanes at EVERY altitude including peak — air on fire, not a curtain).
    streak = smoothstep(0.42, 0.92, streak);
    streak = pow(streak, 1.3) * 2.2;

    // ── LEADING / STAGNATION EDGE (fix 3 — break the ruled band). The bow-shock incandescence
    //    piles at the windward (LOWER, leading) edge. Its boundary is NOT a horizontal line: it
    //    rides the slipstream axis s and its threshold is warped by turbulence + angled, then
    //    feathered — convected plasma, not a decal seam. Reach scales with uRe (peak climbs the
    //    window; fade retreats to a thin lower veil → the arc reads build→peak→ease).
    float warp = (fbm(vec2(q*5.0, s*2.2 - t*2.6)) - 0.5) * 0.42;   // ragged, turbulent boundary
    float reach = mix(-0.30, 0.66, uRe);                          // how far up the slipstream the fire climbs
    float lead = smoothstep(reach, -0.46, s + warp + (streak-0.6)*0.22);   // feathered, warped edge (no straight line)
    float rim = length(vec2(p.x*1.0, p.y*0.95));
    float rimLick = 0.45 + 0.95*smoothstep(0.08, 0.44, rim);      // licks AROUND the porthole edge
    float body = lead * rimLick;

    // ── Flicker — a fast shimmer + a per-thread twinkle so the plasma roars/breathes.
    float flick = 0.80 + 0.20*sin(t*34.0 + q*11.0) + 0.16*(vn(vec2(q*24.0, t*7.0))-0.5);

    // ── COOLER TRAILING WAKE — red/orange only, downstream of the stagnation edge (fix 2: the
    //    wake stays cooler; the white-hot core lives at the leading edge below).
    float wake = body * streak * flick;
    float heat = clamp(wake * (1.4 + 1.9*uRe), 0.0, 3.0);
    vec3 cRed   = vec3(0.95, 0.10, 0.02);
    vec3 cOrange= vec3(1.55, 0.46, 0.06);
    vec3 cYellow= vec3(2.05, 1.20, 0.30);
    vec3 col = mix(cRed, cOrange, smoothstep(0.12, 0.70, heat));
    col = mix(col, cYellow, smoothstep(0.75, 1.55, heat));

    // ── WHITE-HOT STAGNATION CORE (fix 2 — the single biggest "this is re-entry" cue). A blown-
    //    out near-WHITE incandescent ZONE at the LEADING (windward) edge where the ionized air
    //    compresses hardest. A COHERENT feathered band (not thread-gated to scattered dots, not a
    //    ruled line) hugging the windward edge along the slipstream, turbulence-warped so it's
    //    convected plasma. Bright + wide enough to DOMINATE the peak read (the orange is the
    //    cooler trailing wake behind it).
    float coreEdge = smoothstep(0.18, -0.46, s + warp);          // WIDE band along the windward edge
    float coreMod = 0.65 + 0.35*streak;                          // mostly coherent, a little ragged
    float core = coreEdge * coreMod * rimLick * flick;
    core = clamp(core * (0.3 + 2.6*uRe), 0.0, 2.0);              // blows hard to white near peak
    vec3 cWhite = vec3(2.9, 2.65, 2.30);                         // near-white, faint warm (ionized air)
    // add the white-hot core ON TOP of the wake colour (additive incandescence). A lower
    // threshold + steeper ramp → a clear blown-out white zone, not a few stray hot pixels.
    col += cWhite * smoothstep(0.20, 0.95, core);

    // ── Additive emission. Capped + a low FLOOR-DISCARD on the dark lanes so a translucent veil
    //    of fire never fully occludes the world (fix 5): the planet/desert curve persists through
    //    the gaps even at peak. Eased by uRe so orbit/surface stay clean.
    float em = (heat + core*1.3) * uRe;
    em = min(em, 2.6);
    if (em < 0.03) discard;                                       // clear lanes → vista shows through
    gl_FragColor = vec4(col * em, clamp(em*0.85, 0.0, 0.92));     // alpha capped <1 → never a full curtain
  }
`;
const SHIMMER_FS = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uRe;
  uniform float uTime;

  float hash(vec2 p){ p = fract(p*vec2(127.1,311.7)); p += dot(p, p+34.5); return fract(p.x*p.y); }
  float vn(vec2 x){ vec2 p=floor(x), f=fract(x); f=f*f*(3.0-2.0*f);
    return mix(mix(hash(p),hash(p+vec2(1,0)),f.x), mix(hash(p+vec2(0,1)),hash(p+vec2(1,1)),f.x), f.y); }

  void main(){
    if (uRe <= 0.001) discard;
    vec2 p = vUv - 0.5;
    float t = uTime;
    // Wobbling heat-haze ripples: scrolling noise fields that rise (hot air convecting up past
    // the glass). The DIFFERENCE of two vertically-offset samples gives thin shimmering ripple
    // EDGES (a refraction-like wobble) rather than a flat tint — reads as air boiling, a
    // shimmer not a smear. Two scales layered (broad heat columns + fine quiver).
    float w1 = vn(vec2(p.x*4.5, p.y*3.2 - t*1.6));
    float w2 = vn(vec2(p.x*4.5, p.y*3.2 + 0.16 - t*1.6));
    float ripple = abs(w1 - w2) * 9.0;                 // thin bright ripple edges (refraction-like wobble)
    float f1 = vn(vec2(p.x*11.0, p.y*8.0 - t*2.8));
    float f2 = vn(vec2(p.x*11.0, p.y*8.0 + 0.11 - t*2.8));
    float quiver = abs(f1 - f2) * 6.0;                 // fine high-freq quiver
    float v = ripple * 0.7 + quiver * 0.3;
    // Bias the haze toward the UPPER window — where the vista (planet/sky) still shows past the
    // plasma — so the heat reads as DISTORTING the view, not just glowing where the fire already
    // is. A soft vertical weight (top-biased) × a gentle radial keep-off-the-bezel falloff.
    float vert = smoothstep(-0.50, 0.30, p.y);         // weak low, stronger toward the top half
    float fall = smoothstep(0.52, 0.14, length(vec2(p.x, p.y*1.05)));
    float a = clamp(v, 0.0, 1.0) * vert * fall * uRe * 0.55;   // subtle but PRESENT (a heat-wobble)
    if (a < 0.003) discard;
    // a faintly warm shimmer (hot air) — pale so it tints, doesn't paint.
    vec3 warm = vec3(1.0, 0.80, 0.58);
    gl_FragColor = vec4(warm * a, a);
  }
`;

/** X2b — the SHARED cabin lamp rig (a warm pooled ceiling KEY, a low cool ambient FILL, an
 *  off-centre warm RAKE + a cool counter-rake to read the round bore, and a cool PORTHOLE spill).
 *  ONE rig for BOTH the ride cabin (buildPodScene — it keeps the animated refs) AND the docked bay
 *  pod (buildCanonicalPodExterior — refs dropped). Before this, the bay was lit dimmer (a lone 1.3
 *  lamp + 0.55 fill, no rakes) so the eject→ride swap read as a brightness JUMP; now identical.
 *  Stores the module refs the descent/crash/tumble paths animate. */
function buildCabinLampRig(group: THREE.Group, storeRefs = true): void {
  // Warm ceiling lamp KEY — pooled (lower range + faster decay) so it pools at the apex and the
  //   lower wall / corners fall off into shadow (form, not a flat fill).
  const lamp = new THREE.PointLight(0xffd2a0, 1.7, 3.8, 2.9);
  lamp.position.set(0.1, CAB_APEX - 0.20, 0.05);
  group.add(lamp);
  // LOW COOL ambient — a cool-grey sky / dark-cool ground hemisphere → the aluminium reads cool bare
  //   metal (the warm key is a POOL on top, not a bath).
  const fill = new THREE.HemisphereLight(0x93a0b0, 0x2a2d30, 0.72);
  group.add(fill);
  // OFF-CENTRE warm directional — rakes ACROSS the bore from upper-right so the curved wall picks up
  //   a clear left→right brightness GRADIENT (the biggest "this is round" cue at eye level).
  const key = new THREE.DirectionalLight(0xffe8cc, 0.6);
  key.position.set(1.6, CAB_APEX, 0.2);
  key.target.position.set(-0.8, 0.7, 0.0);
  group.add(key);
  group.add(key.target);
  // a faint COOL counter-rake from the left so the far-left arc doesn't go dead black (curvature
  //   reads as a gradient, not a hard light/dark split).
  const coolRake = new THREE.DirectionalLight(0x8ea4ba, 0.28);
  coolRake.position.set(-1.4, WALL_H, -0.3);
  coolRake.target.position.set(0.6, 0.8, 0.4);
  group.add(coolRake);
  group.add(coolRake.target);
  // Cool PORTHOLE spill (the exterior glow from −Z) — a cool accent pool on the forward arc + bezel.
  const vpGlow = new THREE.PointLight(0xa6c0d6, 0.95, 4.2, 2.2);
  vpGlow.position.set(0, VP_CY, -CAB_R + 0.05);
  group.add(vpGlow);
  // Only the RIDE cabin (buildPodScene) keeps the animated refs — the descent/crash/tumble paths
  //   drive them. The docked BAY pod uses the same rig for parity but must NOT clobber them (its
  //   lights are disposed with the ship at the swap; a dangling ref would be a bug).
  if (storeRefs) { cabinLamp = lamp; cabinFill = fill; cabinKeyRake = key; cabinCoolRake = coolRake; vpGlowLight = vpGlow; }
}

/** Build the RE-ENTRY FX (plasma + heat-shimmer) into the group, just in front of the −Z
 *  porthole. R1b: the fake vista is GONE — the porthole is an open aperture showing the
 *  REAL terrain + sky as the pod physically falls. These two additive planes layer over
 *  that real-world view (depthTest clips them to the round aperture; the cabin bezel/wall
 *  occlude them) so the air reads as burning past the window during atmospheric entry.
 *  Pushes geometry to _cabinDisposables + sets the module mesh/material refs. */
function buildReentryFx(group: THREE.Group): void {
  // ── RE-ENTRY PLASMA + SHIMMER (T2.2) — layered just in front of the porthole glass but
  //    BEHIND the porthole frame, so depthTest lets the cabin bezel/wall clip them to the
  //    round aperture (they read THROUGH the window only). Both invisible until uRe > 0.
  //    The REAL world (terrain + sky) shows through the aperture behind them — the plasma
  //    is now air-on-fire over the genuine descent view, not over a fake shader vista.
  _reentryT0 = performance.now() / 1000;
  // PLASMA — a camera-facing plane at z≈−3.4 (just in front of the glass z≈−1.22, behind the
  //   bezel), generously over-sized so it fills the porthole cone at that depth. The shader
  //   does the rim-licking; a flat plane (DoubleSide) reliably faces the seated camera.
  const plasmaGeo = new THREE.PlaneGeometry(4.2, 4.2);
  _cabinDisposables.push(plasmaGeo);
  reentryPlasmaMat = new THREE.ShaderMaterial({
    vertexShader: REENTRY_VS, fragmentShader: PLASMA_FS,
    uniforms: { uRe: { value: 0.0 }, uTime: { value: 0.0 } },
    transparent: true, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    depthWrite: false, depthTest: true, toneMapped: false,   // white-hot must survive the tone-mapper
  });
  const plasma = new THREE.Mesh(plasmaGeo, reentryPlasmaMat);
  plasma.position.set(0, VP_CY, -3.4);     // on the porthole sight-line, just in front of the glass
  plasma.renderOrder = 4;                  // composites over the real-world view through the aperture
  plasma.frustumCulled = false;
  plasma.visible = false;
  group.add(plasma);
  reentryPlasmaMesh = plasma;
  // SHIMMER — a near-flat plane just in front of the glass (z≈−1.9), over the porthole,
  //   carrying the faint heat-haze ripple. depthTest clips it to the aperture.
  const shimGeo = new THREE.PlaneGeometry(1.5, 1.5);
  _cabinDisposables.push(shimGeo);
  reentryShimmerMat = new THREE.ShaderMaterial({
    vertexShader: REENTRY_VS, fragmentShader: SHIMMER_FS,
    uniforms: { uRe: { value: 0.0 }, uTime: { value: 0.0 } },
    transparent: true, blending: THREE.AdditiveBlending,
    depthWrite: false, depthTest: true, toneMapped: false,
  });
  const shimmer = new THREE.Mesh(shimGeo, reentryShimmerMat);
  shimmer.position.set(0, VP_CY, -1.9);
  shimmer.renderOrder = 5;                 // after the plasma (top heat-haze layer)
  shimmer.frustumCulled = false;
  shimmer.visible = false;
  group.add(shimmer);
  reentryShimmerMesh = shimmer;
}

/** Build the pod (hero cabin mesh group + a static shell collider) at the live pod origin
 *  (the real-world descent base + current altitude when grounded, else the orbit offset).
 *  Idempotent. The player rides SEATED (locomotion off), so the collider is just a
 *  conservative shell (floor + 4 walls + ceiling) so the capsule can't fall through —
 *  no per-prop colliders are needed inside a seated cabin. */
export function buildPodScene(ctx: GameContext): void {
  if (podGroup) return;
  const origin = _podWorldOrigin();   // R1b — real-world above the spawn during descent, else the orbit offset
  const group = new THREE.Group();
  group.name = 'escapePodCabin';   // findable by the rig framer (visual-diagnostic-methodology.md)
  group.position.copy(origin);

  buildCabinInterior(group);

  // ── Lighting — the SHARED cabin lamp rig (X2b: buildCabinLampRig), the SAME one the bay pod uses,
  //    so the interior reads identical bright/character bay→eject→ride→descent. It stores the animated
  //    refs (cabinLamp/cabinFill/cabinKeyRake/cabinCoolRake/vpGlowLight) that descent/crash paths drive.
  buildCabinLampRig(group);
  // R3a — DAWN SPILL through the escape HATCH (HATCH_AZ). Off during the descent (intensity 0);
  //   setCabinCrashPose(>0) raises it so the crashed wake cabin is lit by the dawn pouring in the
  //   open hatch (the wake read: the SAME riveted cabin, lit warm from the door the player exits).
  const hDir = new THREE.Vector3(Math.sin(HATCH_AZ), 0, Math.cos(HATCH_AZ));
  const hSpill = new THREE.PointLight(0xffcaa0, 0.0, 5.5, 1.6);   // warm dawn; intensity ramped on crash
  hSpill.position.set(hDir.x * (CAB_R - 0.1), HATCH_CY + 0.1, hDir.z * (CAB_R - 0.1));
  group.add(hSpill);
  hatchSpillLight = hSpill;

  // ── Conservative cage collider (seated → can't walk, but keep the capsule caged so a
  //    physics nudge can't drop the player out). The cabin is a round bore; a boxy AABB
  //    cage that ENCLOSES it (±CAB_R) is fine — the player never touches the walls seated.
  const D = (CAB_R + SHELL) * 2;
  const shellSpecs: ReadonlyArray<[number, number, number, number, number, number]> = [
    [D, SHELL, D, 0, -SHELL / 2, 0],                          // floor
    [D, SHELL, D, 0, CAB_APEX + SHELL / 2, 0],                // ceiling cap
    [SHELL, CAB_APEX, D, CAB_R + SHELL / 2, CAB_APEX / 2, 0], // +X wall
    [SHELL, CAB_APEX, D, -(CAB_R + SHELL / 2), CAB_APEX / 2, 0], // −X wall
    [D, CAB_APEX, SHELL, 0, CAB_APEX / 2, CAB_R + SHELL / 2], // aft (+Z) wall
  ];
  for (const [w, h, d, cx, cy, cz] of shellSpecs) {
    const col = makeStaticBox(
      ctx.physics.world,
      { x: w / 2, y: h / 2, z: d / 2 },
      { x: origin.x + cx, y: origin.y + cy, z: origin.z + cz },
    );
    const body = col.parent();
    if (body) podBodies.push(body);
  }
  // Remember the collider offsets (pod-local) so the per-frame descent sync can re-place the
  // cage as the pod falls (the floor must ride under the seated body each frame — R1b).
  _shellOffsets = shellSpecs.map(([, , , cx, cy, cz]) => [cx, cy, cz]);
  _cabinColliderCtx = ctx;   // R3a — kept so setCabinCrashPose can drop the cage (free the player to walk out)

  // R1b — the porthole is now an OPEN aperture onto the REAL world (terrain + sky); only the
  // re-entry plasma/shimmer layer over that real view as the pod punches the atmosphere.
  buildReentryFx(group);

  group.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = false; o.receiveShadow = false; } });

  // ── PERF: STATIC-MERGE the cabin's shared-material greebles into batched draws (the wreck-field
  //    discipline). The round bore is ~380 tiny meshes — ring-frame rivets (rings of 16/32),
  //    curved ribs, banded wall arcs, deck-plate studs — nearly all sharing a handful of materials
  //    (_cabShell / _podFrameMat / _podRivetMat / _cabDeck). mergeStaticByMaterial collapses each
  //    material into ONE draw. PROTECT the animated FRONT DOOR (cabinHatchPivot swings open at the
  //    wake — the door slab + integral porthole glass/bezel must move as one; merging would detach
  //    them from the pivot). The re-entry plasma/shimmer are transparent → the helper skips them by
  //    default; tag them too so a future includeTransparent can't fold them. The salvage panel +
  //    exterior skin are added LATER (unifyEnterablePod), so they aren't present at this merge.
  if (cabinHatchPivot) cabinHatchPivot.userData.noMerge = true;   // the swinging front door (+ its integral domed porthole) rides the pivot
  if (reentryPlasmaMesh) reentryPlasmaMesh.userData.noMerge = true;
  if (reentryShimmerMesh) reentryShimmerMesh.userData.noMerge = true;
  // Y7 — PROTECT the animated LEVER PIVOTS from the merge. Both hang on a hinge group that
  //   setEjectLeverPull / setParachuteLeverPull rotates; merging would bake the shaft+grip into a
  //   root-static batch (detached from the pivot) so the pull-down + snap would never move. Mark the
  //   pivot groups noMerge so their children stay parented to the hinge. (The chute lever survived
  //   before by luck of unique materials; the eject lever's steel/red bars share the batch materials
  //   and WERE being folded — the pull read dead. This makes both explicit + correct.)
  if (chuteLever) chuteLever.userData.noMerge = true;
  if (ejectLever) ejectLever.userData.noMerge = true;
  mergeStaticByMaterial(group);

  ctx.three.scene.add(group);
  podGroup = group;
}

// Pod-local collider offsets (captured at build) so _syncPodToAltitude can re-place the static
// cage each frame as the pod descends. Parallel to podBodies.
let _shellOffsets: ReadonlyArray<[number, number, number]> = [];
// R3a — the ctx kept at build so setCabinCrashPose can remove the seated cage (free the player
// to walk out the hatch onto the real terrain at the crashed spawn). Cleared on dispose.
let _cabinColliderCtx: GameContext | null = null;

/** R1b — re-place the descending pod GROUP + its collider cage at the current world origin
 *  (descent base + _podAltitude). Called each descent frame (after the altitude is updated)
 *  so the visible cabin AND the floor the seated body rests on ride down together. No-op if
 *  the pod isn't built or the descent isn't grounded. The CALLER (tickDescent) is responsible
 *  for re-seating the player body each frame — see the contract note on setDescentProgress. */
function _syncPodToAltitude(): void {
  if (!podGroup || !_descentBase) return;
  const o = _podWorldOrigin();
  podGroup.position.copy(o);
  // R3a — apply the crashed LEAN (settled at impact: _crashPose 0→1). The pivot is the pod
  //   group origin (the floor-base centre, sat on the spawn ground), so the capsule tips at its
  //   foot like it slammed in. During the descent _crashPose is 0 (upright); the impact beat
  //   eases it to 1 via setCabinCrashPose.
  podGroup.rotation.set(_CRASH_PITCH * _crashPose, _CRASH_YAW * _crashPose, _CRASH_ROLL * _crashPose);
  for (let i = 0; i < podBodies.length; i++) {
    const off = _shellOffsets[i];
    if (!off) continue;
    // makeStaticBox bodies are FIXED; teleport (setTranslation) the cage so it tracks the fall.
    podBodies[i].setTranslation({ x: o.x + off[0], y: o.y + off[1], z: o.z + off[2] }, true);
  }
}

/** R3a — settle the (landed) cabin to its CRASHED pose at the spawn + free the player to walk
 *  out. `pose` 0→1 eases the descent cabin from upright into a crashed lean (it slammed in).
 *  At the FIRST nonzero pose it ALSO removes the cabin's static collider cage so the player can
 *  walk straight out of the hatch onto the REAL terrain (the wake/exit no-collision approach the
 *  separate shell used — the cabin is now visual-only at the spawn, the salvage wreck §exterior
 *  carries the persistent world collider). Safe no-op if the pod isn't built. */
export function setCabinCrashPose(pose: number): void {
  if (!podGroup) return;
  const prevPose = _crashPose;
  _crashPose = Math.max(0, Math.min(1, pose));
  // CRASH-AFTERMATH (2026-07-03) — arm the interior wake LAMP FLICKER as the cabin first settles
  //   crashed (the come-to moment: the lamp stutters + the torn-conduit wire sparks, then settles
  //   within ~9s). Armed once on the 0→crashed transition; updateChutePop drives + self-settles it.
  if (prevPose < 0.5 && _crashPose >= 0.5 && _wakeFlickerT < 0) _wakeFlickerT = 0;
  // Y3 fix 7 — COLLISION, ONE STATE FOREVER (the user got TRAPPED when he lingered inside; the old
  //   flow dropped the seated cage at the crash then added the WALK-IN walls only at step-out, so for
  //   the whole wake there were NO pod walls, then walls snapped in around a lingering player). NOW:
  //   at the first crash pose we drop the seated cage AND immediately build the LANDED WALK-IN state
  //   (exterior skin + walkable floor + gapped wall ring) — the SAME colliders that persist forever.
  //   The player is still scripted/seated (can't move) at the crash, so building the walls around them
  //   here can't trap them; and because they never change again, there is no state-flip trap or
  //   base-swap later (unifyEnterablePod becomes a no-op for the skin/colliders — see below).
  //   GUARD: only drop the SEATED CAGE (before the walk-in state is built). Once _landPodWalkable has
  //   run, podBodies holds the PERSISTENT WALK-IN walls — a later setCabinCrashPose(1) re-assert must
  //   NOT clear them (that was the bug: the walls got dropped on the next pose call, leaving the pod
  //   collider-less → the walk-in never blocked). So gate on !_enterableExteriorRoot.
  if (_crashPose > 0 && podBodies.length > 0 && _cabinColliderCtx && !_enterableExteriorRoot) {
    for (const body of podBodies) _cabinColliderCtx.physics.world.removeRigidBody(body);
    podBodies.length = 0;
    _shellOffsets = [];
  }
  // Build the persistent landed shell+colliders ONCE, when the crash has fully settled (the group is
  //   at its final grounded+leaned pose so the baked world-space colliders align). Only when GROUNDED
  //   (a dev jump into a crash beat without a descent leaves the pod at the offset — skip until unify
  //   re-grounds it). _landPodWalkable is idempotent (guarded on _enterableExteriorRoot).
  if (_crashPose >= 0.999 && _descentBase && _cabinColliderCtx && !_enterableExteriorRoot) {
    _landPodWalkable(_cabinColliderCtx);
  }
  // WAKE LIGHT — as the cabin settles crashed, the interior warms + brightens to a REAL-LAMP-lit
  //   read (a warm-lit riveted cabin, not the dim space cabin). The COLOR warms (cool→warm by `s`);
  //   the INTENSITIES lerp from the dim descent base to the WAKE_* targets, which are the SAME levels
  //   the persistent walk-in pod parks at (parkPodLights) — so there is ZERO light shift across the
  //   wake→step-out→walk-in threshold (W6 item 5: the wake IS the survival world).
  const s = _crashPose;
  // W6 item 5 — NO EXPOSURE LIFT. The renderer exposure stays at the desert base (1.05) from the
  //   crash onward — the wake cabin reads by REAL INTERIOR LAMPS at 1.05, not a global tone-curve
  //   lift that then had to ease back at exit (the washed-out exit the user still saw). The lamp
  //   levels below are tuned to read the enclosed dazed cabin at 1.05; the blown-open front door +
  //   midday sun floods in past that. (The old CABIN_WAKE_EXPOSURE lift + the eye-adaptation ease
  //   are REMOVED entirely.)
  if (hatchSpillLight) {
    hatchSpillLight.color.copy(_VP_WARM);                             // bright near-white daylight pouring in the ajar/open door
    hatchSpillLight.intensity = s * WAKE_HATCH_SPILL;                 // the door spill (a warm bounce into the bore); parked-equal so no shift at unify
    hatchSpillLight.distance = WAKE_HATCH_DIST;
    hatchSpillLight.decay = 1.0;
  }
  if (cabinFill) {
    cabinFill.color.copy(_fillScratch.copy(_FILL_COOL).lerp(_FILL_WARM, s));   // cool descent → warm neutral midday ambient
    // ⚠ WORLD-LIGHT LEAK FIX (user live-test 2026-07-05, 2nd report — "too bright, shadows gone,
    //   day/night has no effect"): HemisphereLight + DirectionalLight are SCENE-GLOBAL in three —
    //   position-independent. The grounded pod PERSISTS forever, so ramping these to the old WAKE
    //   levels poured ~3.7 permanent light-units over the ENTIRE DESERT (vs the real noon sun ~1.3):
    //   terrain at night lit brighter than noon, every shadow filled flat. Once the pod grounds
    //   (s→1), all GLOBAL lights ramp to ZERO — the interior is carried by the LOCAL falloff lights
    //   (the ceiling lamp, hatch spill, porthole glow) + the real sun through the open door. A
    //   lamp-lit-only pod interior at night is correct — it is a real-world object now.
    cabinFill.intensity = CABIN_FILL_BASE + s * (0 - CABIN_FILL_BASE);
  }
  if (vpGlowLight) {
    vpGlowLight.color.copy(_vpScratch.copy(_VP_COOL).lerp(_VP_WARM, s));
    vpGlowLight.intensity = 0.95 + s * (WAKE_VP_GLOW - 0.95);
  }
  if (cabinLamp) {
    cabinLamp.intensity = LAMP_BASE + s * (WAKE_CABIN_LAMP - LAMP_BASE);   // the ceiling lamp KEY pools the dome/apex
    // CRASH-AFTERMATH — publish the CLEAN base each frame so the wake flicker (updateChutePop, later
    //   in the tick) modulates the correct value even as the crashed-settle ease drives it (no drift).
    cabinLamp.userData._flickerBase = cabinLamp.intensity;
  }
  // the RAKE directionals are SCENE-GLOBAL (see the leak-fix note above) — grounded, they ramp to
  //   ZERO with the fill; the boosted local ceiling lamp + hatch spill carry the wake interior read.
  if (cabinKeyRake) {
    cabinKeyRake.intensity = KEY_RAKE_BASE + s * (0 - KEY_RAKE_BASE);
    cabinKeyRake.color.copy(_fillScratch.set(0xffe8cc).lerp(_FILL_WARM, s));
  }
  if (cabinCoolRake) cabinCoolRake.intensity = COOL_RAKE_BASE + s * (0 - COOL_RAKE_BASE);
  _syncPodToAltitude();
}

/** Hard-set the renderer to the desert-base exposure. W6 item 5: the crash/wake no longer LIFT the
 *  exposure (it stays at the base throughout), so this is now just a defensive re-assert of the base
 *  — used by disposePodScene (teardown) + jumpToBeat (dev jumps) so nothing can ever leave a stray
 *  exposure. Idempotent; takes ctx so it works even when the pod isn't built. */
export function restoreCabinExposure(ctx: GameContext): void {
  ctx.three.renderer.toneMappingExposure = CABIN_BASE_EXPOSURE;
}

/** W6 item 5 — the exposure-ease machinery is REMOVED entirely (the wake no longer lifts the
 *  exposure, so there is nothing to ease back at step-out — the old updatePodExposureEase main-loop
 *  tick + the arm/cancel helpers are gone). The exposure is CONSTANT at the desert base throughout. */

/** W6 item 5 — the ZERO-SHIFT EXPOSURE proof (replaces smokeExposureEase). Proves the renderer
 *  exposure stays CONSTANT at the desert base (1.05) across the ENTIRE crash-pose settle (crash 0 →
 *  wake 1) — i.e. the wake never lifts the exposure, so there is no washed-out exit + nothing to ease.
 *  Drives setCabinCrashPose 0→1 in fine steps, sampling the renderer exposure at each; asserts every
 *  sample == CABIN_BASE_EXPOSURE. Exposed via `__game.smokeExposureConstant()`; consumed by the
 *  pod-walkout rig gate (the ease sub-check is now a CONSTANT-1.05 sub-check). */
export function smokeExposureConstant(ctx: GameContext): {
  ok: boolean; base: number; min: number; max: number; samples: number; constant: boolean;
} {
  const r = ctx.three.renderer;
  const prev = r.toneMappingExposure;
  r.toneMappingExposure = CABIN_BASE_EXPOSURE;   // start at the base (the crash onward runs here)
  const vals: number[] = [];
  const N = 24;
  for (let i = 0; i <= N; i++) {
    setCabinCrashPose(i / N);                    // drive the settle 0→1 (this is where the OLD lift lived)
    vals.push(+r.toneMappingExposure.toFixed(4));
  }
  const min = Math.min(...vals), max = Math.max(...vals);
  const constant = Math.abs(min - CABIN_BASE_EXPOSURE) < 1e-3 && Math.abs(max - CABIN_BASE_EXPOSURE) < 1e-3;
  r.toneMappingExposure = prev;   // leave no side effect
  return { ok: constant, base: CABIN_BASE_EXPOSURE, min: +min.toFixed(4), max: +max.toFixed(4), samples: vals.length, constant };
}

/** PARK the pod's interior lights to calm ambient-interior levels for the REAL game (the wash-out
 *  fix). The wake beat (setCabinCrashPose(1)) floods these HARD — hemi fill 7.3, rakes 2.5/1.28,
 *  hatch flood 14@dist9, vpGlow 3.25, lamp 3.4 — tuned to punch the enclosed dazed-wake cabin
 *  through the come-to fade + the crushed Reinhard curve at the WAKE exposure lift (1.62). Those
 *  levels are CORRECT during the wake beat, but with the ONE-ENTERABLE-POD re-scope the SAME pod
 *  PERSISTS into the real midday game — and there the renderer exposure is back at the desert base
 *  (1.05), the real midday sun already lights the pod through the wide-open hatch, and the hatch
 *  flood pools a bright spot on the terrain. Left un-parked, the interior blows out white + the
 *  ground washes out (the USER-reported "everything is really bright and washed out"). So on the
 *  step-out handoff / on Continue-restore, ease the interior lights down to a READABLE-but-CALM
 *  walk-in interior at gameplay exposure: the sun through the open hatch carries the read; these
 *  are only a gentle interior fill + the small cozy lamp. Idempotent + a safe no-op if a light ref
 *  is null. Called from unifyEnterablePod → covers BOTH the live stepOut AND the load path
 *  (restoreEnterablePod → unifyEnterablePod). */
export function parkPodLights(): void {
  // W6 item 5 — the walk-in pod parks at the EXACT SAME lamp levels the wake cabin runs at (the
  //   WAKE_* constants), so stepping out of the crashed cabin into the persistent walk-in pod is a
  //   ZERO light shift (same lamps, same exposure 1.05) — the real midday sun through the blown-open
  //   door tops it up, which is the real world, not an intro-held state change. (Was a SEPARATE,
  //   DIMMER park set that DROPPED the lights at unify — a visible shift the user read as an "instance
  //   change"; and the old wake flood was tuned for the removed 1.62 exposure lift.)
  // ⚠ WORLD-LIGHT LEAK FIX (2026-07-05): the fill (Hemisphere) + both rakes (Directional) are
  //   SCENE-GLOBAL — parked lit on the forever-persisting pod they washed the whole desert
  //   (~3.7 units > the noon sun), killing shadows and the day/night read. Parked at ZERO now;
  //   the LOCAL falloff lights below carry the interior (see setCabinCrashPose's matching ramp).
  if (cabinFill) { cabinFill.intensity = 0; cabinFill.color.copy(_FILL_WARM); }
  if (cabinKeyRake) { cabinKeyRake.intensity = 0; cabinKeyRake.color.copy(_FILL_WARM); }
  if (cabinCoolRake) cabinCoolRake.intensity = 0;
  // Hatch spill — a warm bounce that dies inside the doorway (short range WAKE_HATCH_DIST), so the
  //   open door reads lit-from-within without a hot terrain pool; the real midday sun lights the ground.
  if (hatchSpillLight) { hatchSpillLight.intensity = WAKE_HATCH_SPILL; hatchSpillLight.distance = WAKE_HATCH_DIST; }
  if (vpGlowLight) vpGlowLight.intensity = WAKE_VP_GLOW;
  if (cabinLamp) cabinLamp.intensity = WAKE_CABIN_LAMP;
}

/** Descent driver (REBUILD v2 R1b) — drive the PHYSICAL fall off the fall's single 0..1
 *  input. The pod now physically falls through the REAL world (the porthole shows the real
 *  terrain + sky), so this drives:
 *    (1) ALTITUDE — the pod descends from DESCENT_ALT (m above the real spawn) to ~0 (the
 *        spawn ground). An ease-IN curve (slow high → fast low) reads as a real fall
 *        accelerating toward the ground. The pod GROUP + collider cage are re-placed at the
 *        new altitude here (_syncPodToAltitude); the CALLER re-seats the player body (it has
 *        ctx) — see the contract note below.
 *    (2) CABIN interior-lit-by-exterior — the porthole spill + ambient fill warm cool→dawn as
 *        the real dawn desert rises in the viewport.
 *    (3) RE-ENTRY FX — the plasma/heat-shimmer bump (over the real-world view) at entry.
 *
 *  CONTRACT for the coordinator (tickDescent):
 *    • ONCE at descent init: setDescentBase(intro.returnPos), then ensureInPod / seat the
 *      player (getPodSpawn now returns the grounded seated spawn at full altitude).
 *    • EACH frame: setDescentProgress(progress) (drives altitude + cabin light + FX + pod
 *      sync). THEN re-seat the player body to getPodSpawn(ctx) + set cameraSnapNextFrame so
 *      the seated eye rides the descending pod (the pod floor under the body moves with it,
 *      but re-seating keeps the eye exactly on the seat regardless of gravity drift).
 *  Safe no-op (null-guarded) if the pod isn't built / the descent isn't grounded. */
export function setDescentProgress(progress: number): void {
  const p = Math.max(0, Math.min(1, progress));
  // (1) ALTITUDE — ease-IN fall: DESCENT_ALT at p=0 → 0 at p=1. p^1.7 holds the pod high
  //     early (a serene distant approach) then drops it fast at the end (the ground rushing
  //     up to impact). The pod group + colliders re-place to this altitude (_syncPodToAltitude).
  _podAltitude = DESCENT_ALT * (1 - Math.pow(p, 1.7));
  _syncPodToAltitude();
  // (2) CABIN interior-lit-by-exterior — the cabin is washed by the shifting exterior light.
  //     The porthole spill (the literal window light through the −Z aperture) goes cool+dim
  //     high → warm+bright as the dawn desert fills the viewport; the ambient fill picks up a
  //     hint of dawn too. `dawn` holds COOL through the high/space leg, warming as the pod
  //     drops into the real dawn atmosphere (matches setSkyIntroMode's space→dawn blend).
  const dawn = Math.max(0, Math.min(1, (p - 0.25) / 0.6));   // 0 high → 1 by low altitude
  if (vpGlowLight) {
    vpGlowLight.color.copy(_vpScratch.copy(_VP_COOL).lerp(_VP_WARM, dawn));
    vpGlowLight.intensity = 0.95 + dawn * 1.05;   // 0.95 cool accent → ~2.0 bright dawn wash on the forward arc
  }
  if (cabinFill) {
    cabinFill.color.copy(_fillScratch.copy(_FILL_COOL).lerp(_FILL_WARM, dawn * 0.8));   // a hint of dawn in the ambient
  }
  // (3) RE-ENTRY FX (T2.2) — the violent atmospheric-entry climax. A bump intensity `re`
  //     peaks as the pod punches the upper air (peak p≈0.28) then fades as it breaks through
  //     into the calm dawn desert. SAME curve the main loop uses for the flash+shake — keep
  //     it EXACT. Drives the plasma (incandescent air burning past) + the heat-shimmer.
  const re = Math.max(0, 1 - Math.pow((p - 0.24) / 0.16, 2.0));   // 0 at p≈0.08, peak 1 at p≈0.24, gone by p≈0.40 — HIGH+EARLY so it's DONE before the warm desert cross-fade (~0.34→0.48); matches sequence.ts byte-for-byte
  const reT = (performance.now() / 1000) - _reentryT0;            // animation time (streak scroll + flicker)
  if (reentryPlasmaMat) { reentryPlasmaMat.uniforms.uRe.value = re; reentryPlasmaMat.uniforms.uTime.value = reT; }
  if (reentryShimmerMat) { reentryShimmerMat.uniforms.uRe.value = re; reentryShimmerMat.uniforms.uTime.value = reT; }
  if (reentryPlasmaMesh) reentryPlasmaMesh.visible = re > 0.001;   // skip the draw outside the re-entry window
  if (reentryShimmerMesh) reentryShimmerMesh.visible = re > 0.001;
}

/** T2.3 — the TUMBLING REVEAL's cabin-light swing. The shipExplode beat drives this with a
 *  `settle` (1 at the eject/blast → 0 as the tumble settles into the descent): the explosion
 *  FLOODS the cabin with hot blast-orange light (bright porthole spill + warm ambient), decaying
 *  back to the orbital cool as the pod stabilizes (settle=0 == the descent's setDescentProgress(0)
 *  cool state, so it hands off seamlessly). Safe no-op before build / after dispose. */
export function setTumbleLight(settle: number): void {
  const s = Math.max(0, Math.min(1, settle));
  // X2b (too-bright-post-eject fix): the blast flood is a SHARP PULSE at the actual detonation
  //   (s→1), NOT a sustained lift across the release/recede. The intensity + tint now ramp
  //   QUADRATICALLY in s, so the LOW-settle values the release passes (0.3–0.5, and the recede
  //   decay tail) sit NEAR the cool orbital base — the freshly-revealed ride cabin at the swap reads
  //   the same cool base as the bay pod, and only the genuine ship blast (s near 1) floods it hot
  //   orange. The old LINEAR `0.95 + s*2.6` lifted the cabin to ~1.7–2.25 for the whole ~1.6 s
  //   pre-blast window (the pale/warm lift the user read as "too bright after eject").
  const sq = s * s;
  if (vpGlowLight) {
    vpGlowLight.color.copy(_vpScratch.copy(_VP_COOL).lerp(_VP_BLAST, sq));
    vpGlowLight.intensity = 0.95 + sq * 2.6;    // 0.95 orbital cool base → ~3.5 only at the blast peak
  }
  if (cabinFill) {
    cabinFill.color.copy(_fillScratch.copy(_FILL_COOL).lerp(_FILL_BLAST, sq * 0.9));
    cabinFill.intensity = 0.72 + sq * 0.5;      // ambient base 0.72 (= the bay/ride base) → +0.5 only at the peak
  }
}

/** Pose the PARACHUTE lever (the gag hook). `t` in [0,1]: 0 = at rest, 1 = fully yanked
 *  forward (toward the seat). The parachute beat calls this with a brief jolt on each
 *  pull (e.g. lerp toward 1 then settle), and with `snapped=true` to droop it dead —
 *  the lever hangs slack off its pivot (the 3rd-pull SNAP, no chute). Safe no-op if the
 *  pod isn't built. */
export function setParachuteLeverPull(t: number, snapped = false): void {
  _chutePullState = Math.max(0, Math.min(1, t));   // Y7 — persist so a rebuild re-applies the pose
  _chuteSnapState = snapped;
  if (!chuteLever) return;
  if (snapped) {
    // The lever SNAPPED off its mount: it hangs DEAD — flopped fully forward + past its
    // travel stop AND drooped hard sideways off the pivot, so it reads limp/wrenched, not
    // a valid pulled position (P4). Combined with the broken-mount tell built below it
    // (the bent bracket reveal), the gag's "no chute" beat is unmistakable.
    chuteLever.rotation.x = chuteLeverRestX + 2.5;   // flopped well past the pull stop (dead)
    chuteLever.rotation.z = 1.05;                     // hard sideways droop (hangs limp)
    chuteLever.rotation.y = 0.35;                     // twisted off-axis (wrenched)
    if (leverBrokenTell) leverBrokenTell.visible = true;   // expose the snapped-mount bracket
    return;
  }
  // a valid (live) lever position — keep the broken-mount tell hidden.
  if (leverBrokenTell) leverBrokenTell.visible = false;
  const k = Math.max(0, Math.min(1, t));
  // Pull travel: rotate forward (toward +X pitch) from the resting back-cant.
  chuteLever.rotation.x = chuteLeverRestX + k * 0.75;
  chuteLever.rotation.z = 0;
}

/** Tear down the pod (meshes + geometry + colliders + the per-build geometry pool). */
export function disposePodScene(ctx: GameContext): void {
  // W6 item 5 — the crash/wake no longer lift the exposure, so this is just a defensive re-assert of
  //   the desert base on teardown (belt-and-braces so the real game never inherits a stray exposure).
  ctx.three.renderer.toneMappingExposure = CABIN_BASE_EXPOSURE;
  if (podGroup) {
    // PERF-merge cleanup: the static-merge (buildPodScene) creates NEW batched geometries that
    // aren't tracked in _cabinDisposables (that list holds the pre-merge originals, freed below).
    // Traverse the live graph to dispose whatever geometry is actually mounted (the merged batches
    // + the un-merged hatch/plasma), so a replayed intro doesn't leak the merged buffers.
    podGroup.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && m.geometry) m.geometry.dispose(); });
    if (podGroup.userData._cabinInteriorBuilt) { _liveInteriorBuilds = Math.max(0, _liveInteriorBuilds - 1); }
    ctx.three.scene.remove(podGroup);
    podGroup = null;
  }
  // Materials are module-shared (NOT disposed) EXCEPT the re-entry FX per-placement
  // ShaderMaterials (plasma + heat-shimmer). Dispose them UNCONDITIONALLY (outside the
  // podGroup guard) — the ref-nulling below is unconditional, so a torn state (podGroup
  // already null) would otherwise leak them. (The fake vista's mats/meshes are GONE — R1b.)
  if (reentryPlasmaMat) reentryPlasmaMat.dispose();
  if (reentryShimmerMat) reentryShimmerMat.dispose();
  for (const g of _cabinDisposables) g.dispose();
  _cabinDisposables.length = 0;
  for (const m of _cabinDoorMats) m.dispose();   // X2b — free the per-build cloned door materials
  _cabinDoorMats.length = 0;
  reentryPlasmaMat = null;
  reentryPlasmaMesh = null;
  reentryShimmerMat = null;
  reentryShimmerMesh = null;
  vpGlowLight = null;
  cabinFill = null;
  chuteLever = null;
  leverBrokenTell = null;
  if (ejectLever) _ejectLevers.delete(ejectLever);
  ejectLever = null;             // Y7 — the eject-handle pivot (re-created on the next interior build)
  cabinHatchPivot = null;        // R3a — the cabin escape-hatch pivot
  hatchSpillLight = null;        // R3a
  cabinLamp = null;              // R3a
  cabinKeyRake = null;           // Item 1 — the interior rake directionals
  cabinCoolRake = null;
  _cabinColliderCtx = null;      // R3a
  _crashPose = 0;                // R3a — reset the crashed lean (a re-played intro starts upright)
  _shellOffsets = [];
  // R1b — clear the descent grounding so a re-played intro / the orbit-frame beats start
  // from the offset again until the next descent re-grounds it. (The base is re-set by the
  // descent beat from intro.returnPos; the altitude resets to full.)
  _descentBase = null;
  _podAltitude = DESCENT_ALT;
  // ONE-ENTERABLE-POD (user re-scope) — reset the unified-pod state on a real teardown. The
  //   exterior-skin geometry lives in _cabinDisposables (freed above); the berm + the salvage
  //   record + the chute are cleaned here so a disposed enterable pod leaves nothing dangling.
  //   (endEscapePodIntro SKIPS this dispose when the pod is enterable — it PERSISTS into the game;
  //   this branch only runs on the offset-pod teardown or a dev re-dispose.)
  if (_enterableBerm) { _enterableBerm.geometry.dispose(); ctx.three.scene.remove(_enterableBerm); _enterableBerm = null; }
  _disposeCrashAftermath(ctx);   // CRASH-AFTERMATH (2026-07-03) — tear down the furrow/scorch/debris overlay with the pod
  _wakeFlickerT = -1;            // reset the wake lamp-flicker one-shot (a replayed intro re-arms it at the next wake)
  _danglingConduitSpark = null;
  if (crashedPodSalvageableId >= 0) {
    const i = ctx.salvageables.list.findIndex((s) => s.id === crashedPodSalvageableId);
    if (i >= 0) ctx.salvageables.list.splice(i, 1);
    crashedPodSalvageableId = -1;
  }
  disarmChutePop();
  crashedWreck = null;
  _enterableExteriorRoot = null;
  _podEnterable = false;
  _enterablePodXZ = null;   // SAVE/LOAD — the pod is torn down; no placement to persist
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
// T4.3 — the Salvageable id of the crashed pod's panel (so the tutorial driver can detect
// when THIS pod (not some other wreck) is first pried/searched → fire the chute-pop). -1 = none.
let crashedPodSalvageableId = -1;

// ─── The comic CHUTE-POP payoff (T4.3) ────────────────────────────────────────
// The parachute that FAILED during the fall (the 3-pull → snap gag) comically bursts
// out of the pod crown when the player first-salvages their crashed pod — "now it works",
// uselessly, on the ground. The callback/comedy button. A canopy + shroud lines parented
// to the crashed-pod GROUP (so it rides the pod's crash pose), hidden until popChute() fires;
// then a springy one-shot inflate (scale + a little bob) runs via updateChutePop each frame.
let chuteCanopy: THREE.Group | null = null;   // the folded→inflated canopy assembly (child of crashedWreck)
let chutePopT = -1;                           // pop/lifecycle clock (seconds since the pop); <0 = not popped / not armed
let chutePopArmed = false;                    // the canopy is built + ready to pop on the first salvage strike
const CHUTE_POP_DUR = 1.55;                   // seconds of the inflate+overshoot+saggy-settle one-shot
const CHUTE_OVERSHOOT = 0.34;                 // how far the springy inflate punches PAST full (was ~0.12) — a big comic POOF
const CHUTE_DROOP_LEAN = 0.11;                // rad — the gentle asymmetric lean the billow settles into ("useless" sag; too much tips it over BESIDE the pod)
const CHUTE_DROOP_SAG = 0.14;                 // extra vertical squash the dome sags by as it deflates onto the wreck
// ─── The DEFLATE + DRAPE LIFE-CYCLE (round-2b) — the deployed chute no longer HOVERS static.
//   After the pop settles it FLUTTERS in the wind (procedural cloth), then DEFLATES + collapses
//   into an authored draped pose over the pod's shoulder, then SETTLES as permanent scenery with
//   a barely-there hem stir. All time-parameterised off chutePopT (seconds since the pop), so the
//   restore path can fast-forward straight to the settled drape (no flutter replay). Phase edges:
const CHUTE_FLUTTER_START = CHUTE_POP_DUR;              // 1.55s — flutter begins as the pop settles
const CHUTE_FLUTTER_DUR   = 10.0;                       // ~10s of wind-flutter before the chute gives up
const CHUTE_DEFLATE_START = CHUTE_FLUTTER_START + CHUTE_FLUTTER_DUR;   // 11.55s
const CHUTE_DEFLATE_DUR   = 2.6;                        // ~2.6s to lose form + slump into the drape
const CHUTE_SETTLED_AT    = CHUTE_DEFLATE_START + CHUTE_DEFLATE_DUR;   // 14.15s — settled scenery from here on
// Flutter amplitude/frequency band — layered noise, all scaled by the live wind (0=calm..1=storm).
const CHUTE_BILLOW_AMP    = 0.16;   // low-freq whole-canopy breathing (m of radial swell at calm), grows w/ wind
const CHUTE_BILLOW_FREQ   = 0.55;   // rad/s — the slow breath
const CHUTE_RIPPLE_AMP    = 0.10;   // travelling ripple across the gores (m)
const CHUTE_RIPPLE_FREQ   = 1.7;    // rad/s — the mid ripple travel rate
const CHUTE_HEM_AMP       = 0.14;   // high-freq edge flutter on the skirt hem (m) — snaps in wind
const CHUTE_HEM_FREQ      = 5.2;    // rad/s — the fast hem chatter
const CHUTE_WIND_LEAN     = 0.22;   // rad — max whole-canopy downwind lean at full storm
const CHUTE_SETTLED_STIR  = 0.06;   // residual hem-stir amplitude fraction once settled (barely-there cloth read)
// Comic canopy material — faded orange-white ripstop (reads as a real chute; a bit worn).
const _chuteCanopyMat = new THREE.MeshLambertMaterial({ color: 0xd8894a, flatShading: true, side: THREE.DoubleSide });
const _chuteGoreMat = new THREE.MeshLambertMaterial({ color: 0xe8e2d4, flatShading: true, side: THREE.DoubleSide });   // the alternating pale gores
const _chuteLineMat = new THREE.MeshLambertMaterial({ color: 0x2a2620, flatShading: true });                          // dark shroud lines
const _chuteDisposables: THREE.BufferGeometry[] = [];
// Per-gore flutter/deflate data captured at build (rest verts + crumple target + per-vertex params).
interface ChuteFlutterGore {
  pos: THREE.BufferAttribute;   // the live position attribute (written each frame)
  rest: Float32Array;           // inflated rest positions
  crumple: Float32Array;        // authored deflated/draped target positions
  polar: Float32Array;          // 0 apex → 1 brim
  azim: Float32Array;           // vertex azimuth (rad)
  n: number;                    // vertex count
}
// Per-shroud-line data so the deflate re-lays each line into a slack catenary droop.
interface ChuteLine {
  mesh: THREE.Mesh;
  skirt: THREE.Vector3;   // upper attach (canopy brim), rest
  riser: THREE.Vector3;   // lower attach (riser knot)
  restLen: number;
  up: THREE.Vector3;
}
let _chuteLines: ChuteLine[] = [];
const _CHUTE_UP = new THREE.Vector3(0, 1, 0);   // shared scratch axis for line orientation

/** Remove the crashed-pod wreck (so a re-played intro doesn't stack duplicates).
 *  Disposes per-mesh GEOMETRY but NOT the materials — the hero pod's materials are
 *  module-shared + reused on the next placement (disposing them would break it). */
export function removeCrashedPodWreck(ctx: GameContext): void {
  disarmChutePop();
  // T4.3 — drop the pod's salvageable record so a replay doesn't leave a stale entry pointing
  //   at the disposed group (its panel/interactId is gone with the geometry).
  if (crashedPodSalvageableId >= 0) {
    const i = ctx.salvageables.list.findIndex((s) => s.id === crashedPodSalvageableId);
    if (i >= 0) ctx.salvageables.list.splice(i, 1);
    crashedPodSalvageableId = -1;
  }
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

/** Build the comic parachute CANOPY assembly (a dome of alternating orange/pale gores +
 *  a ring of shroud lines gathering down to a riser) in the pod-LOCAL frame, anchored just
 *  above the pod crown/apex. Starts hidden + folded (tiny scale); popChute inflates it.
 *  Parented to the crashed-pod group so it rides the crash lean. */
function buildChuteCanopy(crownY: number): THREE.Group {
  const grp = new THREE.Group();
  const apex = crownY;   // the host pod's crown height (local) — differs between the standalone wreck + the unified pod
  // ── the CANOPY DOME — a big BILLOW of gores that dwarfs the little pod. The gag is
  //    "this HUGE chute finally deployed, way too late" — so it reads big + worn + draped,
  //    not a tidy tight balloon. A broad, slightly-SQUASHED dome (a settling chute puffs
  //    WIDE, not tall), gored (alternating orange/pale ripstop), low-poly.
  const CANOPY_R = 3.3;             // was 2.3 — a proper POOF that overwhelms the ~1.4m-radius pod
  const SQUASH = 0.74;              // flatten the dome vertically → a wide billow, not a tall balloon
  const GORES = 14;
  const dome = new THREE.Group();   // the billowing canopy (droops as a unit in the settle)
  // ── FLUTTER/DRAPE data: per-gore rest positions + precomputed per-vertex params (polar 0..1
  //    from apex, azimuth) + an authored CRUMPLE target the deflate morphs into. Captured once
  //    at build so the per-frame flutter/deflate driver is a cheap parametric write (no allocs).
  const flutter: ChuteFlutterGore[] = [];
  for (let g = 0; g < GORES; g++) {
    const a0 = (g / GORES) * Math.PI * 2;
    // Sweep the cap a bit past the equator (to 0.58π) so the brim curves gently DOWN into
    //   a draped skirt — but NOT so far it closes into an egg (a chute is an OPEN dome, the
    //   shroud lines must read below it). A mushroom/dome, not a balloon.
    const geo = new THREE.SphereGeometry(CANOPY_R, 4, 10, a0, (Math.PI * 2) / GORES, 0, Math.PI * 0.58);
    _chuteDisposables.push(geo);
    const gore = new THREE.Mesh(geo, g % 2 === 0 ? _chuteCanopyMat : _chuteGoreMat);
    gore.userData.noCollider = true;
    dome.add(gore);
    // Capture rest + build the crumple target for this gore.
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const n = pos.count;
    const rest = new Float32Array(pos.array as Float32Array);   // copy of the inflated rest verts
    const crumple = new Float32Array(n * 3);
    const polar = new Float32Array(n);   // 0 at apex → 1 at the brim (drives ripple travel + hem weighting)
    const azim = new Float32Array(n);    // vertex azimuth (drives billow phase + downwind lean sign)
    for (let i = 0; i < n; i++) {
      const rx = rest[i * 3], ry = rest[i * 3 + 1], rz = rest[i * 3 + 2];
      const rXZ = Math.hypot(rx, rz);
      // polar: apex has y≈CANOPY_R, brim y≈CANOPY_R*cos(0.58π) — normalise by the y drop.
      const p = Math.min(1, Math.max(0, (CANOPY_R - ry) / (CANOPY_R * 1.3)));
      polar[i] = p;
      const az = Math.atan2(rz, rx);
      azim[i] = az;
      // CRUMPLE TARGET — the AUTHORED DRAPE. The deflated canopy loses ALL internal form and collapses
      //   into a LOW rumpled heap slumped over the pod's +X shoulder (away from the −Z front doorway so
      //   the drape never blocks it). Not a shrunk balloon: the fabric flattens hard (little vertical
      //   rise), the whole mass shifts toward +X + sags down the flank, and uneven azimuthal + radial
      //   fold creases read as slack crumpled cloth. The driver ALSO drops the whole group onto the
      //   shoulder, so this target is authored LOW + flat relative to the canopy origin.
      const nx = rXZ > 1e-4 ? rx / rXZ : 0;                 // radial unit dir (for the slump bias)
      const nz = rXZ > 1e-4 ? rz / rXZ : 0;
      const slumpSide = nx;                                 // +1 on the +X slump side, −1 on the far side
      // radius: collapse inward toward a chunky bunched mound that still COVERS the crown (not a thin
      //   rag). The +X slump side spills a touch WIDER + lower (fabric flops down that flank); the far
      //   side stays tucked in. Small X shift only — the heap stays centred OVER the pod, draping one side.
      const fold = 0.62 - 0.10 * p + 0.12 * slumpSide;      // keeps real width → a mounded drape
      const crease = 1 + 0.20 * Math.sin(az * 5 + p * 3.2) + 0.10 * Math.sin(p * 9); // rumpled folds
      const cXZ = rXZ * Math.max(0.25, fold * crease);
      const cx = nx * cXZ + 0.28;                           // gentle +X bias (drapes toward that shoulder, stays on the pod)
      const cz = nz * cXZ;
      // height: a low BUNCHED mound — keeps ~30% of the rise (volume, not a flat rag); the +X slump
      //   side sags lower (draping down the flank), the far side sits higher. Fold ripples add crumple.
      const mound = ry * 0.30;
      const sag = 0.15 + 0.55 * slumpSide;                  // slump side droops down the flank
      const cy = mound - sag - 0.25 * p + 0.16 * Math.sin(az * 4 + p * 6);
      crumple[i * 3] = cx; crumple[i * 3 + 1] = cy; crumple[i * 3 + 2] = cz;
    }
    flutter.push({ pos, rest, crumple, polar, azim, n });
  }
  dome.scale.y = SQUASH;
  dome.userData.flutter = flutter;
  // a crown vent cap so the dome apex reads finished, not a hole.
  const ventGeo = new THREE.CylinderGeometry(CANOPY_R * 0.13, CANOPY_R * 0.17, 0.1, 12);
  _chuteDisposables.push(ventGeo);
  const vent = new THREE.Mesh(ventGeo, _chuteLineMat);
  const ventRestY = CANOPY_R * SQUASH * 0.98;
  vent.position.y = ventRestY;
  vent.name = 'chuteVent';
  vent.userData.ventRestY = ventRestY;
  vent.userData.noCollider = true;
  dome.add(vent);
  dome.name = 'chuteDome';
  grp.add(dome);
  // ── SHROUD LINES — from the canopy skirt gathering down to a riser knot near the crown.
  //    Kept SHORT (the skirt sits low + close) so the chute drapes ONTO the wreck rather
  //    than hanging taut above it like a balloon.
  // the draping brim is low (the gores sweep down past the equator), so pin the shroud
  //   lines to that low outer edge and gather them to the riser knot at the crown.
  const brimA = Math.PI * 0.575;                         // just inside the gore bottom edge (sweep 0.58π)
  const skirtR = CANOPY_R * Math.sin(brimA) * 0.99;
  const skirtY = CANOPY_R * Math.cos(brimA) * SQUASH;    // slightly negative — the brim hangs a touch low
  const riserY = -1.85;                       // the riser gather well below the brim → LONG shroud lines that bridge to the crown
  _chuteLines = [];
  for (let i = 0; i < GORES; i++) {
    const a = (i / GORES) * Math.PI * 2 + Math.PI / GORES;
    const skirt = new THREE.Vector3(Math.cos(a) * skirtR, skirtY, Math.sin(a) * skirtR);
    const riser = new THREE.Vector3(0, riserY, 0);
    const mid = skirt.clone().lerp(riser, 0.5);
    const len = skirt.distanceTo(riser);
    // Unit-length cylinder (scaled per-frame in Y to the current segment length) so the deflate can
    //   re-lay each line into a slacker catenary sag without rebuilding geometry.
    const lineGeo = new THREE.CylinderGeometry(0.026, 0.026, 1, 4);   // reads clearly at distance without looking like a rod
    _chuteDisposables.push(lineGeo);
    const line = new THREE.Mesh(lineGeo, _chuteLineMat);
    line.position.copy(mid);
    line.scale.y = len;
    line.quaternion.setFromUnitVectors(_CHUTE_UP, riser.clone().sub(skirt).normalize());
    line.userData.noCollider = true;
    grp.add(line);
    _chuteLines.push({ mesh: line, skirt: skirt.clone(), riser: riser.clone(), restLen: len, up: _CHUTE_UP });
  }
  // a chunky riser strap/knot at the gather (where it "attaches" to the pod crown)
  const knotGeo = new THREE.CylinderGeometry(0.13, 0.17, 0.36, 8);
  _chuteDisposables.push(knotGeo);
  const knot = new THREE.Mesh(knotGeo, _chuteLineMat);
  knot.position.y = riserY + 0.12;
  knot.name = 'chuteKnot';
  knot.userData.knotRestY = riserY + 0.12;
  knot.userData.noCollider = true;
  grp.add(knot);
  // anchor so the riser knot sits just above the crown and the billow puffs LOW over the
  //   nose — the wide dome drapes down around the pod's upper body, not floating overhead.
  grp.position.set(0, apex + 0.55, 0);
  grp.userData.baseY = apex + 0.55;   // the driver drops the group DOWN from here onto the shoulder as it deflates
  grp.scale.setScalar(0.001);   // folded/hidden until the pop
  grp.visible = false;
  return grp;
}

/** ARM the chute-pop: build the canopy + parent it to the crashed pod, hidden + folded.
 *  Called by placeCrashedPodWreck (separate wreck) OR unifyEnterablePod (the ONE persistent pod),
 *  passing the group to parent the canopy under. No-op if no target. */
export function armChutePop(target?: THREE.Group | null): void {
  disarmChutePop();
  const host = target ?? crashedWreck;
  if (!host) return;
  // The canopy anchors on the HOST's crown, in host-local coords. The two hosts differ:
  //   - the UNIFIED enterable pod (target passed in) wears buildExteriorSkin, whose foot is
  //     at local y=0 and crown = WALL_H + DOME_H + 0.10 (≈2.67).
  //   - the standalone placeCrashedPodWreck (crashedWreck) sinks a heat-shield base slab, so
  //     its crown = POD_BASE_H + POD_BODY_H + POD_NOSE_H (≈2.99).
  // Using the wreck constants on the unified pod floated the canopy ~0.4m above its true crown.
  const crownY = target
    ? WALL_H + DOME_H + 0.10                       // unified pod (exterior-skin crown)
    : POD_BASE_H + POD_BODY_H + POD_NOSE_H;        // standalone wreck crown
  chuteCanopy = buildChuteCanopy(crownY);
  host.add(chuteCanopy);
  chutePopArmed = true;
  chutePopT = -1;
}

/** Dispose the chute canopy (its geometry) + reset state. */
function disarmChutePop(): void {
  if (chuteCanopy) {
    chuteCanopy.parent?.remove(chuteCanopy);
    chuteCanopy = null;
  }
  for (const g of _chuteDisposables) g.dispose();
  _chuteDisposables.length = 0;
  _chuteLines = [];
  chutePopArmed = false;
  chutePopT = -1;
}

/** Is the chute armed + not yet popped? (the tutorial driver checks this to fire the payoff). */
export function chutePopReady(): boolean {
  return chutePopArmed && chutePopT < 0 && chuteCanopy !== null;
}

/** DEV/rig probe — the chute life-cycle clock + phase name (for the chute-lifecycle strip log, so a
 *  still-strip's caption confirms pop→flutter→deflate→settle progression). -1 clock = not popped. */
export function chuteLifecyclePhase(): { t: number; phase: string } {
  if (chutePopT < 0) return { t: -1, phase: chutePopArmed ? 'armed' : 'none' };
  const t = chutePopT;
  const phase = t < CHUTE_POP_DUR ? 'pop'
    : t < CHUTE_DEFLATE_START ? 'flutter'
    : t < CHUTE_SETTLED_AT ? 'deflate'
    : 'settled';
  return { t: +t.toFixed(2), phase };
}

/** FIRE the comic chute-pop (the failed chute finally deploys, uselessly, on the ground).
 *  Reveals the canopy + starts the one-shot springy inflate (updateChutePop drives it) +
 *  plays the FWOOMP. Idempotent — a second call while popping is a no-op. */
export function popChute(advanceSeconds?: number): void {
  if (!chuteCanopy || chutePopT >= 0) return;
  chuteCanopy.visible = true;
  chutePopT = 0;
  playChutePop();
  // Rig-shot / restore helper: synchronously drive the lifecycle (the harness pauses the main
  //   loop, which gates updateChutePop, so without this a paused frame catches the canopy still
  //   folded). Step in small increments so the flutter/deflate/settle math resolves. Driven at
  //   CALM wind so a restore lands deterministically on the settled drape (no flutter replay).
  if (advanceSeconds && advanceSeconds > 0) {
    let left = advanceSeconds;
    while (left > 0) { const step = Math.min(1 / 60, left); _advanceChuteLifecycle(step, 0, chutePopT); left -= step; }
  }
}

/** DEV/rig — step the chute life-cycle by `dt` seconds at a given `wind` (0..1) + downwind
 *  direction (world XZ), for a PAUSED-frame time strip (the harness pauses the loop so the
 *  camera stays fixed; this ticks the canopy motion deterministically without waiting real time).
 *  `elapsed` supplies the noise phase. No-op unless popped. Returns the current phase for the log. */
export function advanceChuteLifecycle(dt: number, wind: number, elapsed: number, dirX = 1, dirZ = 0): { t: number; phase: string } {
  _windDirX = dirX; _windDirZ = dirZ;
  _advanceChuteLifecycle(dt, Math.max(0, Math.min(1, wind)), elapsed);
  return chuteLifecyclePhase();
}

/** D5 — the ROBUST chute-pop TRIGGER (decoupled from the tutorial state machine). The gag
 *  (the failed parachute finally bursting out when the player first pries their pod) MUST fire
 *  on the PRY EVENT itself, no matter what phase the tutorial driver is in. Root cause of the
 *  user-reported "didn't fire": the old trigger lived ONLY inside updatePodTutorial's 'salvage'
 *  phase — if the player pried while the machine was in 'craft' (e.g. they already held a machete,
 *  or the phase hadn't ticked to 'salvage' yet) or 'done', the pry was never observed → no pop.
 *  This check runs every frame (updateChutePop is called unconditionally from the main tick),
 *  fires the pop the instant the pod's salvageable panel reads panelOpened, once ever (popChute
 *  is idempotent + chutePopReady() goes false after popping), independent of the tutorial. The
 *  tutorial toast still reacts, but the GAG no longer depends on it. Cheap: two null-guards +
 *  one list.find only while the chute is actually armed + unpopped. */
function _autoFireChuteOnPry(ctx: GameContext): void {
  if (!chutePopReady()) return;                       // not armed, or already popped → nothing to do
  if (crashedPodSalvageableId < 0) return;            // no registered pod salvageable
  const rec = ctx.salvageables.list.find((s) => s.id === crashedPodSalvageableId);
  if (!rec) return;
  if (rec.panel?.userData.panelOpened === true) popChute();   // pried → the chute finally deploys (the gag)
}

/** Per-frame driver for the chute-pop + DEFLATE/DRAPE life-cycle (T4.3 + round-2b). No-op unless
 *  popping. The full arc: a springy inflate POOF → wind FLUTTER (procedural cloth, wind-scaled) →
 *  DEFLATE + collapse into an authored draped pose → SETTLED scenery with a residual hem stir.
 *  Called from the tutorial driver's tick (normal gameplay, post-handoff). D5 — ALSO owns the
 *  robust pry→pop trigger (always-running, tutorial-phase-independent) so the gag can't be missed. */
export function updateChutePop(ctx: GameContext, dt: number): void {
  _autoFireChuteOnPry(ctx);   // D5 — fire the gag on the pry event itself (decoupled from the tutorial phase)
  // Live wind (0=calm..1=storm) + its downwind direction from the active storm wall (world XZ).
  const wind = Math.max(0, Math.min(1, ctx.weather.perceivedIntensity ?? ctx.weather.intensity ?? 0));
  _windDirX = ctx.weather.wall.dirX; _windDirZ = ctx.weather.wall.dirZ;
  _advanceChuteLifecycle(dt, wind, ctx.time.elapsed);   // advance pop→flutter→deflate→settle (no-op unless popping)
  _updateWakeFlicker(dt);     // CRASH-AFTERMATH (2026-07-03) — the wake lamp/conduit-spark flicker one-shot (no-op unless armed)
}
// downwind direction (world XZ) captured each frame from the active storm wall; used for the lean.
let _windDirX = 1, _windDirZ = 0;

/** Advance the interior wake LAMP-FLICKER one-shot (the post-crash "sparking" tell): the ceiling lamp
 *  stutters + the torn-conduit wire sparks for ~9s at the wake, then settles clean. No-op unless armed
 *  (_wakeFlickerT ≥ 0, set on the crashed settle in setCabinCrashPose). Cheap; self-terminating. The
 *  flicker RIDES the current lamp intensity (setCabinCrashPose sets the base) — it only modulates it,
 *  so it composes with the wake brighten instead of fighting it. */
function _updateWakeFlicker(dt: number): void {
  if (_wakeFlickerT < 0) return;
  _wakeFlickerT += dt;
  const k = Math.min(1, _wakeFlickerT / _WAKE_FLICKER_DUR);
  // envelope: heaviest stutter at the wake, decaying to steady as the electrics settle.
  const env = (1 - k) * (1 - k);
  // a stochastic-ish stutter (two incommensurate sines → irregular dropouts) gated by the envelope.
  const t = _wakeFlickerT;
  const raw = Math.sin(t * 37.0) * 0.5 + Math.sin(t * 61.3 + 1.1) * 0.5;
  const dropout = raw > 0.55 - env * 0.7 ? 1 : (0.35 + 0.65 * (1 - env));   // brief dark dips early, fewer later
  const flick = 1 - env * (1 - dropout);   // 1 = full brightness; dips toward `dropout` in the stutters
  if (cabinLamp) {
    // ride the clean base setCabinCrashPose publishes each frame (no drift as the settle-ease drives it).
    const base = (cabinLamp.userData._flickerBase as number | undefined) ?? cabinLamp.intensity;
    cabinLamp.intensity = k >= 1 ? base : base * flick;
  }
  if (_danglingConduitSpark) {
    // the frayed-wire spark: pops bright on the deepest dropouts early, dark once settled.
    const sparking = k < 1 && env > 0.12 && dropout < 0.6;
    _danglingConduitSpark.visible = sparking;
  }
  if (k >= 1) {
    _wakeFlickerT = -1;   // settled — one-shot done (a replayed wake re-arms via setCabinCrashPose)
    if (_danglingConduitSpark) _danglingConduitSpark.visible = false;
  }
}

/** DEV/rig probe — a headless GATE for the wake lamp-flicker one-shot (a still can't judge a temporal
 *  flicker, so prove the MECHANISM: arming modulates the lamp + toggles the spark, then self-settles).
 *  Arms the flicker from the current crashed lamp base, drives _updateWakeFlicker synchronously in
 *  small steps over the full window, and reports whether the lamp intensity varied, the spark toggled,
 *  and it settled clean. No-op-safe if the pod isn't built. Mirrors popChute's synchronous-drive idiom. */
export function smokeWakeFlicker(): { built: boolean; armed: boolean; lampVaried: boolean; sparkToggled: boolean; settled: boolean; lampMin: number; lampMax: number } {
  const out = { built: !!cabinLamp, armed: false, lampVaried: false, sparkToggled: false, settled: false, lampMin: Infinity, lampMax: -Infinity };
  if (!cabinLamp) return out;
  // publish a clean crashed base (as setCabinCrashPose does at the wake) so the modulation rides it.
  cabinLamp.intensity = 3.4; cabinLamp.userData._flickerBase = 3.4;
  _wakeFlickerT = 0; out.armed = true;   // arm the one-shot
  let sparkOn = false, sparkOff = false;
  const steps = Math.ceil((_WAKE_FLICKER_DUR + 0.5) / 0.05);
  for (let i = 0; i < steps; i++) {
    _updateWakeFlicker(0.05);
    out.lampMin = Math.min(out.lampMin, cabinLamp.intensity);
    out.lampMax = Math.max(out.lampMax, cabinLamp.intensity);
    if (_danglingConduitSpark) { if (_danglingConduitSpark.visible) sparkOn = true; else sparkOff = true; }
  }
  out.lampVaried = out.lampMax - out.lampMin > 0.2;   // the flicker actually dipped the lamp
  out.sparkToggled = sparkOn && sparkOff;             // the spark both fired AND went dark
  out.settled = _wakeFlickerT < 0 && Math.abs(cabinLamp.intensity - 3.4) < 0.01 && (!_danglingConduitSpark || !_danglingConduitSpark.visible);
  return out;
}

/** Advance the chute POP → FLUTTER → DEFLATE → SETTLE life-cycle (round-2b). Split out of
 *  updateChutePop so popChute's synchronous rig-shot/restore advance loop can drive it WITHOUT
 *  the ctx-dependent pry check (D5). No-op unless popping. `wind` (0..1) scales the flutter (0
 *  in the sync/restore path so a reload lands on a calm settled drape); `elapsed` is the wall
 *  clock for deterministic time-based noise phase (no Math.random per frame). */
function _advanceChuteLifecycle(dt: number, wind: number, elapsed: number): void {
  if (!chuteCanopy || chutePopT < 0) return;
  chutePopT += dt;
  const t = chutePopT;
  const dome = chuteCanopy.getObjectByName('chuteDome');
  const flutter = dome?.userData.flutter as ChuteFlutterGore[] | undefined;

  if (t < CHUTE_POP_DUR) {
    // ── PHASE 0 — the springy inflate POOF (unchanged; the gag's pop spring + timing are frozen).
    const k = Math.min(1, t / CHUTE_POP_DUR);
    const base = k * k * (3 - 2 * k);                                 // smoothstep to 1
    const wobble = Math.sin(k * Math.PI * 2.3) * (1 - k) * CHUTE_OVERSHOOT;  // big decaying POOF
    chuteCanopy.scale.setScalar(Math.max(0.001, base + wobble));
    const droop = Math.max(0, (k - 0.45) / 0.55);
    const droopE = droop * droop * (3 - 2 * droop);
    const bob = Math.sin(t * 5.5) * (1 - k) * 0.10;
    chuteCanopy.rotation.z = CHUTE_DROOP_LEAN * droopE + bob;
    chuteCanopy.rotation.x = CHUTE_DROOP_LEAN * 0.30 * droopE;
    if (dome) dome.scale.y = 0.72 * (1 - CHUTE_DROOP_SAG * droopE);
    return;
  }

  // Past the pop the assembly is at full scale; the dome carries the settled vertical squash.
  chuteCanopy.scale.setScalar(1);
  if (dome) dome.scale.y = 0.72 * (1 - CHUTE_DROOP_SAG);

  // deflateK: 0 through the flutter, ramps 0→1 across the deflate window, holds at 1 when settled.
  const deflateK = t <= CHUTE_DEFLATE_START ? 0
    : Math.min(1, (t - CHUTE_DEFLATE_START) / CHUTE_DEFLATE_DUR);
  const deflateE = deflateK * deflateK * (3 - 2 * deflateK);   // smoothstep
  const settled = t >= CHUTE_SETTLED_AT;

  // ── GROUP DROP — as the canopy deflates, lower the WHOLE assembly onto the pod's shoulder + nudge
  //    it toward +X so the rumpled heap sits ON the hull flank, not perched high on the crown.
  const baseY = (chuteCanopy.userData.baseY as number | undefined) ?? chuteCanopy.position.y;
  chuteCanopy.position.set(0.18 * deflateE, baseY - 0.75 * deflateE, 0);

  // ── VENT CAP — track the crown vent to the COLLAPSED heap top as the canopy deflates (else it
  //    floats detached above the drape). Ease it down onto the fabric + toward the +X slump + shrink
  //    it so it nestles into the folds instead of reading as a hard disc perched overhead.
  const vent = dome?.getObjectByName('chuteVent');
  if (vent) {
    const restY = (vent.userData.ventRestY as number) ?? vent.position.y;
    // the collapsed heap top ≈ crumple(p≈0) ≈ cy ~0.7 (mound retains volume; dome-local, pre-squash).
    vent.position.set(0.28 * deflateE, restY + (0.7 - restY) * deflateE, 0);
    vent.scale.setScalar(1 - 0.4 * deflateE);
  }

  // ── FLUTTER envelope: full during the flutter phase, eased OUT across the deflate (the cloth
  //    loses internal form, so the lively flutter dies into the slump), leaving only a residual
  //    stir once settled so it still reads as cloth (never a rigid shell).
  const flutterEnv = settled ? CHUTE_SETTLED_STIR : (1 - deflateE) * (0.35 + 0.65 * wind) + CHUTE_SETTLED_STIR * deflateE;

  // ── WHOLE-CANOPY LEAN: the settled droop lean + a downwind lean that grows with wind, then the
  //    deflate slumps it further over the pod's shoulder (a limp collapse, not a tidy fold).
  const windLean = CHUTE_WIND_LEAN * wind * (1 - 0.6 * deflateE);   // flutter leans downwind; the slump takes over on deflate
  // world downwind dir → canopy-local (pod yaw≈0, so world XZ ≈ local XZ). rotation.z leans about
  //   local +X (toward ±Z world); rotation.x leans about local +Z (toward ±X world). Map the wind
  //   vector onto both so the lean actually points downwind.
  const breathLean = Math.sin(elapsed * CHUTE_BILLOW_FREQ * 0.6) * 0.03 * flutterEnv;   // gentle sway
  chuteCanopy.rotation.z = CHUTE_DROOP_LEAN + windLean * _windDirX * -1 + breathLean + CHUTE_DROOP_LEAN * 0.9 * deflateE;
  chuteCanopy.rotation.x = CHUTE_DROOP_LEAN * 0.30 + windLean * _windDirZ + CHUTE_DROOP_LEAN * 0.5 * deflateE;

  // ── VERTEX FIELD — layered wind cloth blended toward the authored crumple as it deflates.
  if (flutter) {
    // BILLOW: a slow whole-canopy breathing pulse (all verts swell/contract together, phase off elapsed).
    const billowPhase = elapsed * CHUTE_BILLOW_FREQ;
    for (const gore of flutter) {
      const { pos, rest, crumple, polar, azim, n } = gore;
      const arr = pos.array as Float32Array;
      for (let i = 0; i < n; i++) {
        const ix = i * 3;
        const p = polar[i];       // 0 apex → 1 brim
        const az = azim[i];
        // BILLOW — the whole canopy breathes; strongest mid-canopy, driven radially outward.
        const billow = Math.sin(billowPhase + az * 0.5) * CHUTE_BILLOW_AMP * (0.4 + 0.6 * p);
        // RIPPLE — a wave travelling from apex to brim across the gores (phase advances with polar).
        const ripple = Math.sin(elapsed * CHUTE_RIPPLE_FREQ - p * 6.0 + az * 2.0) * CHUTE_RIPPLE_AMP * p;
        // EDGE FLUTTER — fast high-freq chatter concentrated on the skirt hem (p→1).
        const hemW = Math.max(0, (p - 0.6) / 0.4);   // 0 until the outer 40%, →1 at the hem
        const hem = Math.sin(elapsed * CHUTE_HEM_FREQ + az * 4.0) * CHUTE_HEM_AMP * hemW * hemW;
        // radial swell (billow+ripple push out along XZ) + a vertical hem flap.
        const swell = (billow + ripple) * flutterEnv;
        const rx = rest[ix], ry = rest[ix + 1], rz = rest[ix + 2];
        const rXZ = Math.hypot(rx, rz) || 1e-4;
        const flx = rx + (rx / rXZ) * swell;
        const fly = ry + hem * flutterEnv * 0.7;
        const flz = rz + (rz / rXZ) * swell;
        // MORPH the fluttering inflated pose → the authored crumple as the chute deflates.
        arr[ix]     = flx + (crumple[ix]     - flx) * deflateE;
        arr[ix + 1] = fly + (crumple[ix + 1] - fly) * deflateE;
        arr[ix + 2] = flz + (crumple[ix + 2] - flz) * deflateE;
      }
      pos.needsUpdate = true;
    }
  }

  // ── SHROUD LINES — tension/slacken with the billow during flutter; as the canopy DEFLATES they go
  //    fully limp: BOTH ends converge near the collapsed heap (the skirt to the rumpled brim, the riser
  //    gather UP right under the heap) so each line becomes a SHORT slack thread bunched into the fabric
  //    fold — no rigid rods radiating out. Each bellies into a catenary sag.
  const billowSlack = 0.06 * flutterEnv * Math.sin(elapsed * CHUTE_BILLOW_FREQ + 1.3);
  for (const ln of _chuteLines) {
    // skirt end → pulled HARD in toward a tight gather right under the mound (a small radius) so the
    //   lines collapse into a short tucked bunch, NOT rods radiating out. A per-line azimuth keeps them
    //   from all coinciding (reads as a few slack threads at the fabric base).
    const sk = _chuteScratchA.copy(ln.skirt);
    if (deflateE > 0) sk.lerp(_chuteScratchB.set(ln.skirt.x * 0.14 + 0.28, -0.85, ln.skirt.z * 0.14), deflateE);
    // riser gather → RISES from its low knot to just under the heap so the lines are SHORT (no spikes).
    const rY = ln.riser.y + (-1.05 - ln.riser.y) * deflateE;   // −1.85 → ~−1.05 (tucked under the drape brim)
    const rx = ln.riser.x + 0.28 * deflateE, rz = ln.riser.z;
    const dir = _chuteScratchB.set(rx - sk.x, rY - sk.y, rz - sk.z);
    const chord = dir.length();
    const slack = billowSlack + 0.22 * deflateE;               // slack grows as it deflates
    const len = chord * (1 - slack * 0.25);
    const sag = ln.restLen * (billowSlack * 0.5 + 0.10 * deflateE);   // a small belly (short lines can't sag far)
    ln.mesh.position.set((sk.x + rx) * 0.5, (sk.y + rY) * 0.5 - sag, (sk.z + rz) * 0.5);
    ln.mesh.scale.y = Math.max(0.05, len);
    ln.mesh.quaternion.setFromUnitVectors(ln.up, dir.normalize());
  }
  // the riser knot rides up with the gather so the lines terminate in it (not floating below).
  const knot = chuteCanopy.getObjectByName('chuteKnot');
  if (knot) {
    const kRest = (knot.userData.knotRestY as number) ?? knot.position.y;
    knot.position.set(0.28 * deflateE, kRest + (-1.05 - kRest) * deflateE, 0);
  }
}
const _chuteScratchA = new THREE.Vector3();
const _chuteScratchB = new THREE.Vector3();

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
// ── R3a (C18 in↔out SIZE-MATCH) — the exterior wreck now matches the HERO CABIN the player
//    rode down + climbed out of (buildPodScene: interior radius CAB_R=1.28, outer ≈ CAB_R+SHELL
//    ≈ 1.44; interior apex CAB_APEX≈2.57). So the exterior BODY RADIUS = the cabin's OUTER hull
//    radius, and the body+nose height matches the cabin's wall+dome — when the player climbs out
//    + looks back, the wreck IS the same vessel (same diameter/height/proportions). This widens
//    the C11 "tall torpedo" into the FAT capsule the cabin actually is (the cabin is the hero the
//    player lives in 20-30s → it's the anchor; consistency > the old narrow-silhouette pref).
const POD_R = 1.44;        // body radius = the cabin's OUTER hull radius (CAB_R 1.28 + SHELL 0.16) → ≈2.88m diameter, MATCHING the bore the player rode in — CONTRACT (unchanged)
const POD_BASE_H = 0.34;   // heat-shield base slab height (scorched, sunk in sand)
// W2a — ALIAS the taller cabin dims so the exterior skin, the canonical bay pod, AND the wreck all
//   match the TALLER interior (one model). The exterior nose reads a touch above the interior dome.
const POD_BODY_H = WALL_H;          // = 2.55 — straight cylindrical body = the cabin's straight wall (was hardcoded 1.95)
const POD_NOSE_H = DOME_H + 0.10;   // = 0.95 — tucked ogive nose-cap ≈ the cabin's dome + a little crown
const POD_SEG = 28;        // lathe/cylinder radial segments — round but low-poly
const SKIN = 0.16;         // panel / rim depth (rule 7: ≥15cm for hull-substantial)

// ── Shared pod materials (module-scope so re-placing the wreck doesn't realloc;
//    disposed materials in removeCrashedPodWreck reference these — see note there).
// WORN GUNMETAL skin (D271 → user steering 2026-07-03: "the pod should match the
// rest of the ship, not read pale/bright"). RETUNED out of the pale sun-bleached
// aluminium zone (0xb6b9b3 near-white) into the ship's WORN COOL-GUNMETAL idiom
// (shipScene _shell 0x686e73 / _band 0x7c8288 — worn cool grey with a cool
// desaturated grime cast, NOT a warm rust wash). Same one-vessel tone as the
// cockpit/corridor/bay: darker cool base + a COOL scuff reveal (no near-white),
// the warm oxide/dust channels PULLED DOWN + cooled so the skin no longer glows
// warm-tan under the low sun. Keeps the riveted-capsule character (dents, streaks,
// sparse patina) — just landed in gunmetal, not bleached aluminium.
const _podPaint = createRustedHullMaterial({
  baseColor: 0x565c62,           // WORN COOL GUNMETAL — set BELOW shipScene _shell 0x686e73 so it lands gunmetal even under the point-blank WARM airlock spill (the bay hatch close-up lifts+warms it ~1 value step) + the desert dawn (was 0xb6b9b3 pale aluminium)
  bareMetalHex: 0x8f959b,        // COOL scuffed-metal reveal (matches _rivet 0x9299a0; was 0xd6d9da near-white)
  rustHex: 0x30343a,             // COOL near-grey grime tone for the drip channel (was warm 0x6a4a2c)
  streakIntensity: 0.40,         // grime drip-runs (the seam channel rides this hue too)
  wearAmplitude: 0.44,           // STRONG plate-to-plate tonal break-up (dents + denting)
  fleckStrength: 1.0,            // dense tight bare-metal scuff scratches → scrappy worn metal
  oxStrength: 0.16, oxHex: 0x585c60,    // sparse COOL patina patches (warm oxide pulled DOWN + cooled → no coral glow)
  // dust + chalk PULLED DOWN + cooled — they washed the up-facing nose dome pale/warm
  // (the nose must read as the SAME worn gunmetal as the body, not a bleached cap).
  dustStrength: 0.14, dustHex: 0x8c8e8c, chalkStrength: 0.06,
  oxDeepStrength: 0.20, seamRustStrength: 0.30, abrasionStrength: 0.52,  // drip-stain + sand-blast, cool
  localSpace: true,   // the exterior skin rides the descent/tumble in future work — pin the grime now (see hullMaterial.ts)
});
// Darker channel-steel material (porthole + hatch frames, rivet bands) — a value
// contrast to the bright aluminium skin so the steel hardware reads as fitted-on.
const _podSteel = createRustedHullMaterial({
  baseColor: 0x3a4047,           // COOL dark structural steel — matches shipScene _steel 0x373c42 (was warm 0x4f4c46 → read coppery under the sun)
  rustHex: 0x24272d,             // cool grime (was default warm rust)
  streakIntensity: 0.4, wearAmplitude: 0.3,
  oxStrength: 0.18, oxHex: 0x50555b,   // warm oxide PULLED DOWN + cooled (was 0.4 warm-default → the bezel glowed copper)
  oxDeepStrength: 0.24, seamRustStrength: 0.26,
  localSpace: true,   // pod rides the descent/tumble in future work — pin grime (see hullMaterial.ts)
});
// Rivets / studs / small hardware — mid steel-grey (reads as cast/forged fittings,
// distinct from both the bright skin and the dark channel frames).
const _podFrameMat = createRustedHullMaterial({
  baseColor: 0x82868c,           // COOL mid steel-grey rivets/studs — matches shipScene _rivet 0x9299a0 (was warm 0x7d7a72)
  rustHex: 0x2a2d33, streakIntensity: 0.3, oxStrength: 0.14, oxHex: 0x54585e,   // cool grime + faint cool patina (was warm rust 0x4a2810 / 0x9a5a2e)
  oxDeepStrength: 0.2, seamRustStrength: 0.22, fleckStrength: 0.6,
  localSpace: true,   // pod rides the descent/tumble in future work — pin grime (see hullMaterial.ts)
});
// Cables / antenna — dark matte, near-black.
const _podCableMat = new THREE.MeshLambertMaterial({ color: Tuning.WRECK_ANTENNA_HEX, flatShading: true });
// Displaced-sand berm (the drift banked against the speared-in pod). Sand tone.
const _podBermMat = new THREE.MeshLambertMaterial({ color: 0xc69a5a, flatShading: true });
// CRASH-AFTERMATH (2026-07-03) — the ground-story materials.
// Displaced-sand SKID BERM (the plowed-up sand along the furrow edges) — a touch cooler/darker
//   than the base berm so the disturbed ridge reads as freshly-turned sand (shadowed side of the
//   plow), matching the terrain sand idiom without a hard tint.
const _furrowBermMat = new THREE.MeshLambertMaterial({ color: 0xbc9052, flatShading: true });
// Furrow FLOOR — the exposed, compacted skid trench floor (darker, packed sand where the hull
//   scraped down to sub-surface + shadow). Sits just above the terrain as a conforming skirt.
const _furrowFloorMat = new THREE.MeshLambertMaterial({ color: 0x765634, flatShading: true });
// SCORCH streak / RING — a transparent darkened overlay (re-entry-hot hull met the sand), matching
//   the meteorCrash scorch idiom (transparent lambert, depthWrite off, renderOrder so it lays over
//   the sand without z-fighting). Warm near-black char — a MODERATE opacity so it reads as burnt sand,
//   not an opaque black hole (the R1 over-dark blob).
const _crashScorchMat = new THREE.MeshLambertMaterial({
  color: 0x241812, transparent: true, opacity: 0.55, depthWrite: false, flatShading: true,
});
// A lighter HEAT-DISCOLOUR halo (the tarnished/baked sand ringing the char) — a warm scorched-tan,
//   fainter, so the scorch fades OUT into clean sand instead of a hard char edge.
const _crashHeatMat = new THREE.MeshLambertMaterial({
  color: 0x5c4526, transparent: true, opacity: 0.5, depthWrite: false, flatShading: true,
});
// CHARRED DEBRIS — a flat dark matte for the scorched hull chunks. NOT createRustedHullMaterial (its
//   warm oxide layers glow coral-red on a small fragment under the low orange sun — the R1 "toy" read);
//   a plain lambert reads as burnt metal at any light angle.
const _crashCharMat = new THREE.MeshLambertMaterial({ color: 0x28221c, flatShading: true });
// SCUFFED-GUNMETAL DEBRIS — a cool grey lambert for the torn hull-PANEL fragments. The pod's OWN
//   gunmetal tone (matches the retuned _podPaint base 0x565c62), but a FLAT lambert: the full hull shader's
//   warm seam/oxide layers, on a tiny fragment quad under a low raking sun, collapse into a lit
//   coral-red chip (the R1 "red toy" — panels AND bands both hit it). Flat aluminium reads correct
//   at fragment scale + any light angle. A hair darker than the body so it reads as a scuffed offcut.
const _crashPanelMat = new THREE.MeshLambertMaterial({ color: 0x6f7377, flatShading: true });   // matches the retuned _podPaint gunmetal (was 0xa2a6a2, keyed to the old pale skin)
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
  localSpace: true,   // pod rides the descent/tumble in future work — pin grime (see hullMaterial.ts)
});
// Riveted SEAM-BAND metal — a mid grey-aluminium tone (lighter than the dark
// channel steel) so the latitude bands read as fitted RIVETED HOOPS, not as dark
// drum-divisions cutting the capsule into stacked segments.
const _podBandMat = createRustedHullMaterial({
  baseColor: 0x7c8288,           // WORN COOL painted-band grey — matches shipScene _band 0x7c8288 (was mid warm-grey 0x8c8d85); a touch lighter than the skin so hoops read proud
  bareMetalHex: 0x9aa0a6,        // cool scuff reveal (no near-white)
  rustHex: 0x2c3036,             // cool grime channel
  streakIntensity: 0.3, wearAmplitude: 0.34, fleckStrength: 0.7,
  oxStrength: 0.14, oxHex: 0x56585c, oxDeepStrength: 0.2, seamRustStrength: 0.24,   // warm oxide pulled DOWN + cooled (was 0.32 warm 0x96602e)
  localSpace: true,   // pod rides the descent/tumble in future work — pin grime (see hullMaterial.ts)
});
// (CLUSTER D — _podPortholeBandMat RETIRED with the outer −Z porthole-echo bezel: the −Z arc is now
//   the walk-in door OPENING, not a bezel-ringed porthole; the domed porthole moved into the door slab.)
// PRIED-OPEN HATCH DOOR — a distinctly LIGHTER bright-aluminium value so the
// strippable salvage door POPS off the body (it's the tutorial target, must read
// as the clearest thing on the model). Heavy bare-metal scuffs (it's been forced).
const _podDoorMat = createRustedHullMaterial({
  baseColor: 0x6a7076,           // WORN GUNMETAL salvage door — a step LIGHTER than the skin (0x565c62) so it still POPS as the tutorial target, but in-family + survives the point-blank WARM airlock spill as gunmetal, not near-white (was 0xcdd0cb → the "pale door" the user flagged in the bay)
  bareMetalHex: 0x93999f,        // cool scuffed reveal — it's been forced (was 0xe2e4e2 near-white)
  rustHex: 0x2e3238,             // cool grime channel
  streakIntensity: 0.2, wearAmplitude: 0.34, fleckStrength: 1.0,
  oxStrength: 0.10, oxHex: 0x585c60, abrasionStrength: 0.4,   // faint cool patina (was warm 0x9a6a3e)
  localSpace: true,   // pod rides the descent/tumble in future work — pin grime (see hullMaterial.ts)
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
    const cTarn = new THREE.Color(0x3e3a34);   // tarnished transition — cooled to match the retuned palette (was warm 0x5a4126)
    const cAlu = new THREE.Color(0x565c62);    // body GUNMETAL (top → blends into the retuned _podPaint; was pale 0xb6b9b3)
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
  const hatchCY = baseTop + POD_BODY_H * 0.46;
  const hatchW = 0.92, hatchH = 1.5;     // R3a — match the cabin's escape hatch (0.90×1.62) so the in↔out door reads as the SAME door on the now-fatter body
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
  // (T4.3 — the −Z back is now the REAL salvage panel (addAccessPanel in placeCrashedPodWreck),
  //  so the decorative −Z back inspection plate is dropped to avoid a competing "won't-open" tease.)

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

/** ⚠ DEV-ONLY — place a STANDALONE crashed-pod wreck at desert (x,z). The SHIPPED game never
 *  shows this model: since the ONE-ENTERABLE-POD re-scope (2026-07-01) the real crash-site pod
 *  is the unified enterable pod (`unifyEnterablePod` — the SAME cabin the player rode down),
 *  and the walk-in colliders build at the CRASH (rule 9). This separate squat wreck exists only
 *  for `smokePodTutorial` (podTutorial.ts) and the `__game.placeCrashedPod(x,z)` dev hook —
 *  isolated tutorial testing without driving the full intro chain. Do NOT use it as visual
 *  reference for the real landed pod (it manufactured false gate findings on 2026-07-05 when a
 *  rig scenario shot it as "the" crashed pod). Idempotent (replaces any prior); the vertical
 *  cylinder collider proxy matches ITS OWN silhouette. */
// R3a — the separate buildWakeInterior / blowWakeHatch / removeWakeInterior SHELL is GONE.
//   The player now wakes inside + climbs out of the SAME hero cabin (buildPodScene), crashed at
//   the spawn — see setCabinCrashPose + blowCabinHatch above. This kept the pod from being THREE
//   stitched models; it's ONE consistent pod through impact → wake → exit.

export function placeCrashedPodWreck(ctx: GameContext, x: number, z: number): void {
  removeCrashedPodWreck(ctx);
  const gy = ctx.terrain.heightAt(x, z);
  const group = buildHeroPodMesh();
  group.name = 'crashedPod';   // findable by the rig-shot framer (visual-diagnostic-methodology.md)

  // ── T4.3 — the REAL salvage panel (the first-salvage TUTORIAL target). Reuse the shared
  //    salvage-panel system (wrecks.ts addAccessPanel + salvage.ts registerSalvageable) so the
  //    player pries + strips their OWN pod with the machete, teaching the core loop. A NEWER /
  //    less-rusted panel (D271 vision: "newer than world salvage") on the −Z BACK of the capsule
  //    at a comfortable reach height, facing −Z outward (faceYaw=π). 'escape_pod' kind = the
  //    medical loot palette (bandages/cloth — a survivor's kit). The panel is added BEFORE the
  //    shadow pass + collider so its meshes get shadow flags + its noCollider subtree is skipped.
  const PANEL_LY = POD_BASE_H + POD_BODY_H * 0.5;   // comfortable standing reach on the body
  const PANEL_LZ = -POD_R;                          // −Z back-face surface point
  addAccessPanel(group, 0, PANEL_LY, PANEL_LZ, 1.05, Math.PI, 'escape_pod');

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
  // R3a — a GENTLER lean (the wider POD_R 1.44 makes a tilted base disc raise its high rim far
  //   more, which over-buried the fatter capsule into a dome). A shallower lean keeps the now-fat
  //   capsule STANDING + proud so it reads as the vessel the player climbed out of.
  group.rotation.set(0.13, 0.55, 0.06);   // pitch (lean) + yaw (face cam) + roll — a SLIGHT crash lean (the wide base disc's rim-rise dominates the burial, so keep the tilt small to keep the capsule proud)
  // total tilt of the local +Y axis away from world-up (how far the base disc tilts)
  const _up = new THREE.Vector3(0, 1, 0).applyEuler(group.rotation);
  const tiltCos = Math.max(-1, Math.min(1, _up.y));
  const tilt = Math.acos(tiltCos);                       // radians off vertical
  const rimRise = POD_R * Math.sin(tilt);               // highest base-rim point above centre
  const BURY_MARGIN = 0.14;                              // clearance of the high rim below grade
  const bodyBury = POD_BODY_H * 0.12;                    // ~12% of the body below grade — keep the STRAIGHT cylindrical body proud (the dominant silhouette; less buried = less dome-only read)
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

  // ── T4.3 — register the pod's panel as a machete-salvageable + ARM the chute-pop. The
  //    registry drives the hover prompt ("escape pod — pry open" → "search") + the two-stage
  //    pry/extract loop (interaction.ts), gated behind a pry tool (scrap_machete / scrap_bar).
  //    A deterministic position-seeded rng keeps the condition/loot roll stable across replays.
  const podRng = makeRng((Math.abs(Math.round(x * 73.7 + z * 149.3)) % 0x7fffffff) || 1);
  const rec = registerSalvageable(ctx.salvageables, group, 'escape_pod', new THREE.Vector3(x, gy, z), podRng);
  crashedPodSalvageableId = rec.id;
  armChutePop();   // build the folded canopy on the crown, ready to burst out on the first salvage strike
}

/** The crashed pod's salvageable id (the tutorial driver watches it for the pry → chute-pop). */
export function getCrashedPodSalvageableId(): number { return crashedPodSalvageableId; }
