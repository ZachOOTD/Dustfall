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
const WALL_H = 1.95;      // straight cylindrical-wall height (floor 0 → shoulder where the dome springs)
const DOME_H = 0.62;      // ogive dome rise (LOWERED — a cramped capsule, not a rotunda; was 0.95)
const CAB_APEX = WALL_H + DOME_H;   // ceiling apex
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
const FDOOR_AZ = Math.PI;         // the merged front door centre azimuth = straight forward (−Z), on the seated sight-line
const FDOOR_W = 1.02;             // door aperture width (a wide climb-through; matches the canonical CPOD_DOOR_W)
const FDOOR_H = 1.86;             // door aperture height (contains the porthole + a climb-through opening)
const FDOOR_CY = 1.04;            // door centre height (base ≈0.11 for a floor-level climb-out; spans up past the seated eye)
// the door's azimuth half-extent on the cylinder wall (arc the wall/hoops omit for the aperture)
const FDOOR_AZ_HALF = Math.min(Math.PI * 0.85, (FDOOR_W / 2 + 0.06) / CAB_R);
// The DOMED PORTHOLE set into the door slab — sits at the seated eye line so the descent reads
//   dead-ahead at eye level through the glass. VP_* names kept (the viewport → the door's porthole).
//   (The porthole shares the door azimuth FDOOR_AZ = −Z; no separate azimuth const needed.)
const VP_R = 0.44;                // domed porthole radius (fits inside the FDOOR_W×FDOOR_H door slab)
const VP_CY = 1.34;              // porthole centre height (on the seated ~1.4 eye glance)

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
  baseColor: 0xb0b5b8,           // BRIGHT cool grey-aluminium band — lighter than the shell so the riveted hoops POP as proud bright frames (sells the curve)
  bareMetalHex: 0xd2d8dc,
  streakIntensity: 0.18, wearAmplitude: 0.26, fleckStrength: 0.6,
  oxStrength: 0.06, oxHex: 0x6a6a66, seamRustStrength: 0.10,   // near-clean: the hoops are the curvature read, keep them bright + cool
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
  baseColor: 0x969a9e, bareMetalHex: 0xc4c9cc,
  streakIntensity: 0.18, wearAmplitude: 0.28, fleckStrength: 0.7,
  oxStrength: 0.08, oxHex: 0x66666a, seamRustStrength: 0.10,   // neutralised (deck was reading warm-tan under the lamp)
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
// Dim screen face — a faint amber CRT glow.
const _cabScreen = new THREE.MeshBasicMaterial({ color: 0x2a2410 });
// Inner-rim shadow well behind the porthole bezel — near-black, unlit, so the aperture
// reads as a deep inset recess (a dark ring inside the bezel → "inset window").
const _cabRimShadow = new THREE.MeshBasicMaterial({ color: 0x07090a, side: THREE.DoubleSide });
// Porthole GLASS — a faint cool tint, glossy so a small spec catch reads (a window, not an
// open hole). Slightly emissive so it never goes fully black against the void.
const _cabGlass = new THREE.MeshStandardMaterial({
  color: 0x2a3640, roughness: 0.16, metalness: 0.30,
  emissive: 0x0a1418, emissiveIntensity: 0.45,
  transparent: true, opacity: 0.32,   // see the planet through it, but a glazed pane reads
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
const _cabinDisposables: THREE.BufferGeometry[] = [];   // per-build geometry to free on dispose

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
// WAKE exposure lift (coherence-pass fix): the desert base exposure (scene.ts, Reinhard) is too
//   dim for an enclosed interior; the crashed wake cabin lifts the renderer exposure so the dawn
//   interior reads. Restored to the base on any intro exit (endEscapePodIntro → restoreCabinExposure).
const CABIN_BASE_EXPOSURE = 1.05;   // matches scene.ts renderer.toneMappingExposure (the desert base)
// CONSISTENT-MIDDAY (user re-scope): the wake happens at BRIGHT midday now (not dim dawn), so the
//   enclosed crashed cabin needs LESS exposure compensation than the old dawn lift (2.0 → 1.5) —
//   the midday sun flooding the hatch already lights it far more. Restored to the base on step-out
//   (the unified pod becomes a real-world object lit by the real sun at the desert-base exposure).
// WAKE-BRIGHTNESS (Item 1, user re-scope): 1.5 still rendered the enclosed midday cabin as a near-
//   BLACK box (the Reinhard curve crushes the interior + the ajar hatch blocks the sun flood — the
//   point-light fill was the whole read and it wasn't reaching). Lifted so the wake cabin reads as a
//   MIDDAY-lit crashed capsule (bore/seat/console/eject clearly legible), CLOSE to the bright step-out
//   that follows (no dim→bright pop when the hatch opens) — still a hair under step-out's real-sun read
//   so a slight dazed-enclosed mood survives. Paired with a much stronger cabinFill + lamp below.
const CABIN_WAKE_EXPOSURE = 1.62;   // the crashed-cabin MIDDAY interior reads on the Reinhard curve at this lift (was 1.5 → near-black box; the real bottleneck was the come-to fade, not the lift)

/** Is the pod currently built? */
export function podBuilt(): boolean {
  return podGroup !== null;
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
/** A LatheGeometry mesh (tracked for disposal). */
function _lathe(prof: THREE.Vector2[], seg: number, mat: THREE.Material): THREE.Mesh {
  const g = new THREE.LatheGeometry(prof, seg);
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
/** Seat a mesh flush on the cylinder wall at azimuth `az` (θ from +Z toward +X — the
 *  CylinderGeometry convention; dir = (sin az, 0, cos az)), radius `r`, height `y`. The
 *  mesh is yawed so its local +Z faces the cabin centre (inward), matching the box-face
 *  convention used by the hardware groups. */
function _seatOnWall(mesh: THREE.Mesh, az: number, r: number, y: number): void {
  mesh.position.set(Math.sin(az) * r, y, Math.cos(az) * r);
  mesh.rotation.y = az + Math.PI;        // local +Z → inward (toward centre)
}

/** Build the HERO cabin interior (mesh group) in the pod-LOCAL frame (floor top=0).
 *  A ROUND riveted-aluminium CAPSULE bore: a back-faced cylinder wall + an ogive dome
 *  ceiling, riveted ring-frames + curved ribs, a forward viewport arc, with the C10
 *  hardware (lever / eject / console / seat) re-homed curve-seated on the round wall. */
function buildCabinInterior(group: THREE.Group): void {
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
  const subFloor = _cyl(CAB_R + SHELL, CAB_R + SHELL, SHELL, WALL_SEG, _cabChannel);
  subFloor.position.y = -SHELL / 2;
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
  for (let r = -2; r <= 2; r++) {
    const tread = _box(0.07, 0.018, 1.5, _cabSteel);
    tread.position.set(r * 0.34, 0.06, 0.05);
    group.add(tread);
  }
  // FOOTWELL — a shallow recessed pan FORWARD of the seat (−Z) where the feet rest. A dark
  // recessed box sunk into the deck + a bright rim lip so it reads as a real footwell.
  const wellRim = _cyl(0.44, 0.44, 0.06, 20, _cabBand);
  wellRim.position.set(0, 0.05, -0.62);
  group.add(wellRim);
  const wellPan = _cyl(0.38, 0.38, 0.10, 20, _cabSteel);
  wellPan.position.set(0, -0.02, -0.62);
  group.add(wellPan);
  // a couple of foot-rest treads in the well
  for (const wz of [-0.5, -0.74]) {
    const ft = _box(0.5, 0.025, 0.07, _cabRivet);
    ft.position.set(0, 0.02, wz);
    group.add(ft);
  }
  // 1.d a chunky channel-steel FLOOR RING capping the wall-to-floor seam (full circle —
  //     well below the porthole, so the curve springs from a real welded foot).
  const footRing = _tube(CAB_R - 0.03, 0.18, WALL_SEG, _cabBandShell);
  footRing.position.y = 0.09;
  group.add(footRing);

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
  const ribAzs = [0.0, 2.25];   // rear + far-side only; nothing on the forward arc (the −2.25 rib is dropped — the escape HATCH §10 lives on that rear-left arc)
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
  buildCabinHatch(group);
}

// ── Section builders (split out so buildCabinInterior reads as the cabin assembly) ──
// CLUSTER D — buildViewport RETIRED: the porthole is no longer a bare-wall window; it's the DOMED
//   PORTHOLE built INTO the swinging front door (buildCabinHatch §10), so it seals the aperture
//   through the descent + swings away with the door at the wake. The glass materials (_cabGlass /
//   _cabGlassSpec / _cabRimShadow) are reused there.

/** The right-side console + the chunky red PARACHUTE LEVER, curve-seated on the +X wall.
 *  Sets the module `chuteLever` pivot (the setParachuteLeverPull hook drives it). */
function buildConsoleAndLever(group: THREE.Group): void {
  // The console sits on the +X (right) flank, canted toward FORWARD (θ from +Z→+X; right
  // = π/2, forward = π), so the seated player glances down-forward-right to it + the lever
  // is in natural reach. dir = (sin az, 0, cos az); group local +X → outward at az−π/2.
  const conAz = Math.PI / 2 + 0.42;   // right flank, swung toward the forward viewport
  const conDir = new THREE.Vector3(Math.sin(conAz), 0, Math.cos(conAz));
  const conR = CAB_R - 0.42;          // console body centre, inboard of the wall
  const deckY = 1.30;
  // a console GROUP yawed so its local +X points radially OUTWARD (toward the wall); local
  // −X then faces the cabin centre / seat (where the instruments + lever read).
  const con = new THREE.Group();
  con.position.set(conDir.x * conR, 0, conDir.z * conR);
  con.rotation.y = conAz - Math.PI / 2;
  group.add(con);
  // cabinet body (a curved-back cabinet hugging the wall) — in console-local frame, +X
  // is outward (toward wall), local −X faces the seat. WIDER + a closed seat-facing FACE
  // panel + a kickplate skirt so looking DOWN at it shows a solid lit cabinet, not a dark
  // void cavity under the deck (P2 floor-shot fix).
  const body = _box(0.46, deckY, 1.0, _cabChannel);
  body.position.set(0.13, deckY / 2, 0);
  con.add(body);
  // seat-facing FACE panel (closes the front of the cabinet, lighter band-metal so it's lit)
  const facePanel = _box(0.03, deckY - 0.04, 0.94, _cabBand);
  facePanel.position.set(-0.10, deckY / 2, 0);
  con.add(facePanel);
  // kickplate skirt at the floor (a recessed darker base — the cabinet meets the deck)
  const kick = _box(0.40, 0.12, 0.96, _cabSteel);
  kick.position.set(-0.06, 0.06, 0);
  con.add(kick);
  // angled instrument DECK canted up toward the seat
  const deck = _box(0.46, 0.05, 1.0, _cabSteel);
  deck.position.set(0.0, deckY + 0.05, 0);
  deck.rotation.z = 0.34;             // cant up on the inboard (seat-facing) edge
  con.add(deck);
  // dim amber CRT screen recessed in the deck (forward end)
  const screen = _box(0.24, 0.02, 0.2, _cabScreen);
  screen.position.set(-0.06, deckY + 0.12, -0.3);
  screen.rotation.z = 0.34;
  con.add(screen);
  const screenGlow = _box(0.17, 0.015, 0.13, _ledAmber);
  screenGlow.position.set(-0.075, deckY + 0.135, -0.3);
  screenGlow.rotation.z = 0.34;
  con.add(screenGlow);
  // a row of telltale LEDs (aft of the screen)
  for (let i = 0; i < 4; i++) {
    const mat = [_ledGreen, _ledGreen, _ledAmber, _ledRed][i];
    const led = _cyl(0.018, 0.018, 0.018, 6, mat);
    led.rotation.x = Math.PI / 2;
    led.rotation.z = 0.34;
    led.position.set(-0.14, deckY + 0.155, -0.02 + i * 0.085);
    con.add(led);
  }
  // 3 toggle switches
  for (let i = 0; i < 3; i++) {
    const sw = _cyl(0.012, 0.012, 0.06, 6, _cabRivet);
    sw.rotation.z = 0.34 - 0.4;
    sw.position.set(0.0, deckY + 0.13, 0.16 + i * 0.075);
    con.add(sw);
  }
  // two round gauge dials on the seat-facing vertical face (local −X face)
  for (const dy of [0.92, 0.58]) {
    const ring = _cyl(0.075, 0.075, 0.03, 14, _cabRivet);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(-0.18, dy, -0.38);
    con.add(ring);
    const face = _cyl(0.058, 0.058, 0.012, 14, _cabScreen);
    face.rotation.x = Math.PI / 2;
    face.position.set(-0.2, dy, -0.38);
    con.add(face);
    const needle = _box(0.05, 0.008, 0.004, _ledAmber);
    needle.position.set(-0.21, dy + 0.01, -0.38);
    needle.rotation.z = dy > 0.8 ? 0.6 : -0.4;
    con.add(needle);
  }

  // ── the chunky PARACHUTE LEVER — rises off the deck's forward end into easy seated
  //    reach. A steel clevis bracket + a stout shaft + a fat worn-red rubber grip, canted
  //    back toward the pilot. A pivot GROUP (chuteLever) so setParachuteLeverPull jolts /
  //    droops it. Built in console-local space (folds into the console's curve-seat yaw).
  const leverBaseX = -0.04, leverBaseY = deckY + 0.08, leverBaseZ = -0.42;
  const bracket = _box(0.14, 0.16, 0.18, _cabSteel);
  bracket.position.set(leverBaseX, leverBaseY, leverBaseZ);
  con.add(bracket);
  const leverPivot = new THREE.Group();
  leverPivot.position.set(leverBaseX, leverBaseY + 0.04, leverBaseZ);
  chuteLeverRestX = -0.32;
  leverPivot.rotation.x = chuteLeverRestX;
  con.add(leverPivot);
  const shaft = _cyl(0.028, 0.034, 0.46, 8, _cabSteel);
  shaft.position.set(0, 0.23, 0);
  leverPivot.add(shaft);
  const collar = _cyl(0.05, 0.05, 0.05, 10, _cabSteel);
  collar.position.set(0, 0.16, 0);
  leverPivot.add(collar);
  const hazBand = _cyl(0.038, 0.038, 0.06, 8, _ejectGrip);
  hazBand.position.set(0, 0.30, 0);
  leverPivot.add(hazBand);
  const grip = _cyl(0.078, 0.085, 0.16, 12, _chuteGrip);
  grip.position.set(0, 0.5, 0);
  leverPivot.add(grip);
  const capGeo = new THREE.SphereGeometry(0.082, 12, 8);
  _cabinDisposables.push(capGeo);
  const gripCap = new THREE.Mesh(capGeo, _chuteGrip);
  gripCap.position.set(0, 0.58, 0);
  leverPivot.add(gripCap);
  chuteLever = leverPivot;
  // ── the SNAPPED-MOUNT tell (hidden until setParachuteLeverPull(_, true) shows it): a
  //    bent/sprung clevis pin + a torn bracket lip at the lever base, so the 3rd-pull SNAP
  //    reads as a wrenched-off mount, not just an extreme lever angle (P4).
  const brokenTell = new THREE.Group();
  brokenTell.position.set(leverBaseX, leverBaseY, leverBaseZ);
  brokenTell.visible = false;
  const tornLip = _box(0.12, 0.05, 0.06, _cabSteel);
  tornLip.position.set(0, 0.06, 0.0);
  tornLip.rotation.set(0.6, 0, 0.4);            // peeled up (metal tore)
  brokenTell.add(tornLip);
  const sprungPin = _cyl(0.014, 0.014, 0.14, 6, _cabRivet);
  sprungPin.rotation.set(0.3, 0, 1.1);          // the clevis pin sprung out at an angle
  sprungPin.position.set(0.06, 0.05, 0.03);
  brokenTell.add(sprungPin);
  con.add(brokenTell);
  leverBrokenTell = brokenTell;
  // a hazard-yellow "CHUTE" placard on the deck beside the lever (a dark stencil bar on the
  // yellow plate reads as a label, P4)
  const placard = _box(0.18, 0.012, 0.11, _ledAmber);
  placard.position.set(-0.02, deckY + 0.12, -0.56);
  placard.rotation.z = 0.34;
  con.add(placard);
  const placardText = _box(0.13, 0.014, 0.025, _cabScreen);
  placardText.position.set(-0.018, deckY + 0.135, -0.56);
  placardText.rotation.z = 0.34;
  con.add(placardText);
}

/** The eject control — a guarded hazard-yellow T-handle on a panel curve-seated on the
 *  −X (left) wall, facing inboard (toward the seat). The enterPod "pull eject" beat. */
function buildEjectControl(group: THREE.Group): void {
  // Left (−X) flank, canted toward forward (left = −π/2, forward = π). dir=(sin,cos);
  // group local +X → outward at az−π/2, so local −X faces the seat (where the T-handle reaches).
  const ejAz = -Math.PI / 2 - 0.40;
  const ej = new THREE.Group();
  const ejR = CAB_R - 0.05;
  ej.position.set(Math.sin(ejAz) * ejR, 1.42, Math.cos(ejAz) * ejR);
  ej.rotation.y = ejAz - Math.PI / 2;
  group.add(ej);
  // In ej-local: −X faces the cabin centre. Build the control reaching inboard (−X).
  // C12 FIX 3: BIGGER + clearer so it reads as a real distinct control (the other control),
  // not a tiny dim yellow rectangle. A chunky steel mounting plate → a bright safety-yellow
  // guarded housing → a real guarded toggle inside.
  const panel = _box(0.12, 0.72, 0.62, _cabChannel);   // bigger steel mounting plate
  panel.position.set(-0.04, 0, 0);
  ej.add(panel);
  // hazard-stripe top + bottom bars on the plate (the warning-placard tell — reads "danger")
  for (const sy of [-1, 1]) {
    const hz = _box(0.02, 0.10, 0.60, _ejectGrip);
    hz.position.set(-0.11, sy * 0.30, 0);
    ej.add(hz);
  }
  const inset = _box(0.05, 0.50, 0.50, _ejectGrip);    // bright-yellow guarded housing (bigger)
  inset.position.set(-0.11, 0, 0);
  ej.add(inset);
  const well = _box(0.07, 0.38, 0.38, _cabScreen);     // recessed dark guard cavity
  well.position.set(-0.135, 0, 0);
  ej.add(well);
  // a visible red ARMING TOGGLE inside the well — a chunky base + a canted red switch body
  // so the guard clearly protects a real control (bigger to match the enlarged housing).
  const togBase = _cyl(0.06, 0.07, 0.05, 10, _cabSteel);
  togBase.rotation.z = Math.PI / 2;
  togBase.position.set(-0.155, -0.02, 0);
  ej.add(togBase);
  const togSwitch = _cyl(0.028, 0.038, 0.15, 8, _ledRed);
  togSwitch.rotation.z = Math.PI / 2 + 0.5;     // canted (a thrown toggle)
  togSwitch.position.set(-0.21, 0.0, 0);
  ej.add(togSwitch);
  const togTip = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 6), _ledRed);
  _cabinDisposables.push(togTip.geometry);
  togTip.position.set(-0.275, 0.035, 0);
  ej.add(togTip);
  // flip-up guard arching inboard over the toggle (a chunky steel cage — reads "guarded")
  const guard = _box(0.26, 0.04, 0.42, _cabSteel);
  guard.position.set(-0.32, 0.20, 0);
  ej.add(guard);
  for (const sz of [-1, 1]) {
    const leg = _box(0.22, 0.04, 0.04, _cabSteel);
    leg.position.set(-0.24, 0.10, sz * 0.18);
    leg.rotation.z = 0.7;
    ej.add(leg);
  }
  // stencilled "EJECT" label strip on the lower housing (a dark-on-yellow placard tell)
  const ejLabel = _box(0.025, 0.07, 0.40, _cabScreen);
  ejLabel.position.set(-0.122, -0.34, 0);
  ej.add(ejLabel);
  // the T-handle reaching inboard (−X) + a vertical crossbar grip (chunkier)
  const stem = _cyl(0.038, 0.038, 0.28, 8, _cabSteel);
  stem.rotation.z = Math.PI / 2;
  stem.position.set(-0.30, 0.20, 0);
  ej.add(stem);
  const barT = _cyl(0.055, 0.055, 0.34, 8, _ejectGrip);
  barT.position.set(-0.44, 0.20, 0);
  ej.add(barT);
  for (const sz of [-1, 1]) {
    const cap = _cyl(0.065, 0.052, 0.035, 8, _cabSteel);
    cap.rotation.x = Math.PI / 2;
    cap.position.set(-0.44, 0.20, sz * 0.17);
    ej.add(cap);
  }
  // status LEDs (on the lower housing face)
  const ledR = _cyl(0.026, 0.026, 0.02, 8, _ledRed);
  ledR.rotation.z = Math.PI / 2;
  ledR.position.set(-0.125, -0.20, 0.12);
  ej.add(ledR);
  const ledG = _cyl(0.022, 0.022, 0.02, 8, _ledGreen);
  ledG.rotation.z = Math.PI / 2;
  ledG.position.set(-0.125, -0.20, -0.12);
  ej.add(ledG);
}

/** Conduit pipes following the curve, a junction box, drooping cables, a ceiling dome
 *  light — the lived-in cramped-capsule tells. */
function buildConduitAndLight(group: THREE.Group): void {
  // NOTE (NEW azimuth convention θ from +Z→+X): forward/viewport = θ=π, aft/seat = θ=0.
  // Keep all conduit/cables on the REAR + side arcs (θ near 0 / ±2.x) so NOTHING crosses
  // the forward viewport read.
  // two conduit pipes running UP the REAR curve (θ near 0, behind/beside the seat where
  // they NEVER cross the forward viewport OR sit behind the console/eject as a stray
  // diagonal). Vertical pipes + a couple of bracket clamps each so they read as conduit.
  for (const [az, yc] of [[0.85, WALL_H / 2], [-0.45, WALL_H / 2 + 0.05]] as const) {   // R3a — the −0.85 conduit moved to −0.45 to clear the escape HATCH arc (−1.25)
    const conduit = _cyl(0.05, 0.05, WALL_H - 0.35, 8, _cabCable);
    _seatOnWall(conduit, az, CAB_R - 0.1, yc);
    group.add(conduit);
    for (const cy of [yc - 0.4, yc + 0.4]) {
      const clamp = _box(0.1, 0.05, 0.05, _cabSteel);
      _seatOnWall(clamp, az, CAB_R - 0.08, cy);
      group.add(clamp);
    }
  }
  // junction box on the rear wall (directly behind the seat, θ≈0)
  const jbox = _box(0.22, 0.28, 0.13, _cabSteel);
  _seatOnWall(jbox, -0.3, CAB_R - 0.07, 1.45);
  group.add(jbox);
  for (const [aoff, mat] of [[-0.05, _ledGreen], [0.05, _ledAmber]] as const) {
    const led = _box(0.025, 0.025, 0.02, mat);
    _seatOnWall(led, -0.3 + aoff, CAB_R - 0.12, 1.55);
    group.add(led);
  }
  // a short drooping cable on the REAR-left flank (θ≈−0.5, behind the seat) — minimal
  //  tilt so it reads as a slack loop, not a bar crossing the cabin.
  const cable = _cyl(0.024, 0.024, 0.5, 6, _cabCable);
  _seatOnWall(cable, -0.5, CAB_R - 0.14, WALL_H - 0.32);
  cable.rotation.x += 0.35;   // sag forward-down a touch (stays tucked against the rear wall)
  group.add(cable);
  // ceiling dome light at the apex (the warm interior source; unlit glow mat)
  const domeRing = _cyl(0.14, 0.16, 0.05, 14, _cabSteel);
  domeRing.position.set(0, CAB_APEX - 0.06, -0.1);
  group.add(domeRing);
  const lamp = _cyl(0.11, 0.13, 0.03, 14, _ledAmber);
  lamp.position.set(0, CAB_APEX - 0.09, -0.1);
  group.add(lamp);
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
  pivot.position.set(HATCH_W / 2 + fT / 2, 0, 0.04);    // hinge at the right jamb, just proud
  const door = new THREE.Group();
  const doorTh = SHELL * 1.1;
  // The porthole y in door-local coords (door origin = door centre height HATCH_CY).
  const portY = VP_CY - HATCH_CY;
  const portOpen = VP_R + 0.055;   // the true OPEN aperture radius through the door slab (glass + rim)
  // ── SOLID door SLAB built as a FRAME around the porthole APERTURE (a real hole so the descent
  //    reads THROUGH the porthole glass — a solid slab would occlude the view). Bottom panel below
  //    the porthole, a top strip above it, and two side strips flanking it at porthole height.
  const dHalf = (HATCH_H * 0.98) / 2;
  const pTop = portY + portOpen, pBot = portY - portOpen;   // the aperture's vertical span
  const addSlab = (h: number, cy: number, w = HATCH_W, cx = 0) => {
    if (h <= 0.001) return;
    const s = _box(w, h, doorTh, _cabBand);
    s.position.set(cx, cy, 0);
    door.add(s);
  };
  addSlab(pBot - (-dHalf), (pBot + (-dHalf)) / 2);          // bottom panel (door base → aperture bottom)
  addSlab(dHalf - pTop, (dHalf + pTop) / 2);                // top strip (aperture top → door top)
  // side strips at porthole height (flank the round aperture; width = the gap either side of the disc)
  const sideW = HATCH_W / 2 - portOpen;
  addSlab(pTop - pBot, portY, sideW, -(portOpen + sideW / 2));   // left flank
  addSlab(pTop - pBot, portY, sideW, (portOpen + sideW / 2));    // right flank
  // door-panel edge batten (a proud stiffener on the lower panel → the door reads as a fabricated plate)
  {
    const batten = _box(HATCH_W - 0.14, 0.06, doorTh * 0.7, _cabDeck);
    batten.position.set(0, (pBot - dHalf) / 2, doorTh * 0.55);
    door.add(batten);
  }
  // ── the DOMED PORTHOLE set into the door aperture (the descent view reads through it — glass is
  //    see-through). Porthole centre at the SEATED EYE line (portY = VP_CY − HATCH_CY, computed above).
  // (a0) a flat ANNULAR PLATE (door aluminium) capping the square door-aperture CORNERS around the
  //      round porthole, so no descent-sky leaks in the rectangle corners past the round bezel (the
  //      slab hole is square; this rounds it off flush on the cabin face). Inner = the round opening,
  //      outer = past the square-aperture corners. Double-sided so it reads from the well side too.
  const dCapGeo = new THREE.RingGeometry(VP_R + 0.005, portOpen * Math.SQRT2 + 0.02, 30, 1);
  _cabinDisposables.push(dCapGeo);
  const dCap = new THREE.Mesh(dCapGeo, _cabBand);   // front-faced door aluminium; RingGeometry faces +Z → toward the cabin
  dCap.position.set(0, portY, doorTh * 0.5 + 0.006);
  door.add(dCap);
  // (a) the recessed inner-rim shadow WELL (the aperture through the door → depth, reads inset)
  const dWellGeo = new THREE.CylinderGeometry(VP_R, VP_R, doorTh + 0.02, 28, 1, true);
  _cabinDisposables.push(dWellGeo);
  const dWell = new THREE.Mesh(dWellGeo, _cabRimShadow);
  dWell.rotation.x = Math.PI / 2;        // axis Y → local Z (through the door)
  dWell.position.set(0, portY, -0.01);
  door.add(dWell);
  // (b) the DOMED glass disc bulging INTO the cabin (+local Z, toward the seated eye) — the same
  //     domed-porthole character as the canonical door. See-through (low opacity) → descent reads.
  const dGlassGeo = new THREE.SphereGeometry(VP_R, 28, 14, 0, Math.PI * 2, 0, Math.PI * 0.32);
  _cabinDisposables.push(dGlassGeo);
  const dGlass = new THREE.Mesh(dGlassGeo, _cabGlass);
  dGlass.rotation.x = -Math.PI / 2;      // bulge toward +local Z (into the cabin, toward the eye)
  dGlass.position.set(0, portY, doorTh * 0.5 + 0.02);
  door.add(dGlass);
  // a faint spec crescent on the domed glass (glazed-pane tell; module-shared additive mat)
  const dSpecGeo = new THREE.PlaneGeometry(VP_R * 0.62, VP_R * 0.30);
  _cabinDisposables.push(dSpecGeo);
  const dSpec = new THREE.Mesh(dSpecGeo, _cabGlassSpec);
  dSpec.position.set(-VP_R * 0.20, portY + VP_R * 0.40, doorTh * 0.5 + 0.14);
  dSpec.rotation.z = -0.6;
  door.add(dSpec);
  // (c) ONE integral proud BEZEL ring framing the porthole (channel-steel torus, part of the door)
  const dBezGeo = new THREE.TorusGeometry(VP_R + 0.04, 0.05, 12, 30);
  _cabinDisposables.push(dBezGeo);
  const dBez = new THREE.Mesh(dBezGeo, _cabChannel);
  dBez.position.set(0, portY, doorTh * 0.5 + 0.02);
  door.add(dBez);
  // (d) a ring of bezel bolts (the porthole is bolted to the door)
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const sg = new THREE.SphereGeometry(0.013, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2);
    _cabinDisposables.push(sg);
    const stud = new THREE.Mesh(sg, _cabRivet);
    stud.rotation.x = -Math.PI / 2;
    stud.position.set(Math.cos(a) * (VP_R + 0.04), portY + Math.sin(a) * (VP_R + 0.04), doorTh * 0.5 + 0.06);
    door.add(stud);
  }
  // a lever HANDLE / latch near the free (left) edge, low on the door (grab + kick to open)
  const handle = _box(0.06, 0.30, 0.10, _cabSteel);
  handle.position.set(-HATCH_W * 0.32, -HATCH_H * 0.22, doorTh * 0.9);
  door.add(handle);
  // perimeter door rivets (the door is bolted together) — skip the porthole disc
  for (let i = 0; i < 18; i++) {
    const u = i / 18; let rx: number, ry: number;
    if (u < 0.25) { rx = (u / 0.25 - 0.5) * (HATCH_W - 0.14); ry = HATCH_H / 2 - 0.06; }
    else if (u < 0.5) { rx = (HATCH_W - 0.14) / 2; ry = (1 - (u - 0.25) / 0.25 - 0.5) * (HATCH_H - 0.14); }
    else if (u < 0.75) { rx = (0.5 - (u - 0.5) / 0.25) * (HATCH_W - 0.14); ry = -HATCH_H / 2 + 0.06; }
    else { rx = -(HATCH_W - 0.14) / 2; ry = ((u - 0.75) / 0.25 - 0.5) * (HATCH_H - 0.14); }
    // skip a rivet if it falls on the porthole disc
    if ((rx * rx + (ry - portY) * (ry - portY)) < (VP_R + 0.08) * (VP_R + 0.08)) continue;
    const sg = new THREE.SphereGeometry(0.013, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2);
    _cabinDisposables.push(sg);
    const rv = new THREE.Mesh(sg, _cabRivet);
    rv.rotation.x = -Math.PI / 2; rv.position.set(rx, ry, doorTh * 0.55);
    door.add(rv);
  }
  door.position.set(-HATCH_W / 2, 0, 0);   // door local origin → the hinge (right) edge
  pivot.add(door);
  // CLUSTER D — at rest the door is FULLY CLOSED (sealed) so it rides the descent + crash SHUT
  //   (the B-spec — the porthole glass carries the ride-down view). The wake cracks it ajar then
  //   blowCabinHatch kicks it wide. (Was AJAR at rest — the old side-hatch rode down cracked open.)
  _cabinHatchAjarY = 0;       // sealed shut at rest
  pivot.rotation.y = _cabinHatchAjarY;
  hatch.add(pivot);
  cabinHatchPivot = pivot;
}

/** CLUSTER D — blow/kick the merged FRONT DOOR open (the wake exit). `t` 0→1 swings the (sealed)
 *  door fully wide + drops it as it tears off its hinge, revealing the −Z opening onto the real
 *  desert. No-op before build / after dispose. (The door rode the descent SEALED at rest; the wake
 *  beat calls blowCabinHatch(0) to crack it ajar as you come to, then 0→1 to kick it wide.) */
export function blowCabinHatch(t: number): void {
  if (!cabinHatchPivot) return;
  const k = Math.min(1, Math.max(0, t));
  // swing from sealed (0) through ajar to fully wide (the hinge is on the +X/right edge → swing −Y
  //   opens it outward to the −Z/left). A gentle ajar crack at t=0 reads "the blast sprang it".
  cabinHatchPivot.rotation.y = -0.28 - k * 1.55;   // ajar (~−16°) → fully wide (~−105°)
  cabinHatchPivot.rotation.x = -k * 0.25;          // sags/tears down off the hinge as it flings
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
let _podEnterable = false;              // true once the cabin has been unified into the walk-in pod (persists into the game)
let _enterableExteriorRoot: THREE.Group | null = null;  // the exterior-skin subtree added to podGroup
let _enterableBerm: THREE.Mesh | null = null;
// SAVE/LOAD (persistence fix) — the unified pod's world (x,z) placement, captured at unify so the
//   save can record it + a fresh-boot Continue can re-build the pod (which isn't rebuilt at boot —
//   only the intro flow builds it, and Continue never runs the intro). Null until unified.
let _enterablePodXZ: { x: number; z: number } | null = null;

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
      const arcStart = HATCH_AZ + hAzHalf;
      const arcLen = Math.PI * 2 - hAzHalf * 2;
      const t = _tube(OUTR, h, POD_SEG, _podPaint, arcStart, arcLen);
      t.position.y = (y0 + y1) / 2;
      root.add(t);
    }
  }
  // the flared FOOT (below the hatch) — a short full-revolve lathe.
  const footProf: THREE.Vector2[] = [
    new THREE.Vector2(OUTR * 0.90, 0.0),
    new THREE.Vector2(OUTR * 1.02, 0.16),
    new THREE.Vector2(OUTR, 0.28),
  ];
  root.add(_lathe(footProf, POD_SEG, _podPaint));
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
  const scorchTopY = WALL_H * 0.45;
  const scorchProf: THREE.Vector2[] = [
    new THREE.Vector2(OUTR * 0.90 + 0.008, 0.0),
    new THREE.Vector2(OUTR * 1.03, 0.16),
    new THREE.Vector2(OUTR + 0.012, 0.28),
    new THREE.Vector2(OUTR + 0.010, scorchTopY),
  ];
  const scorchGeo = new THREE.LatheGeometry(scorchProf, POD_SEG);
  scorchGeo.computeVertexNormals();
  {
    const pos = scorchGeo.attributes.position;
    const cols = new Float32Array(pos.count * 3);
    const cChar = new THREE.Color(0x0d0906), cTarn = new THREE.Color(0x5a4126), cAlu = new THREE.Color(0xb6b9b3);
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
      const arcStart = HATCH_AZ + hAzHalf, arcLen = Math.PI * 2 - hAzHalf * 2;
      const hoop = _tube(OUTR + 0.05, 0.10, POD_SEG, _podBandMat, arcStart, arcLen);
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
const CPOD_DOOR_AZ = Math.PI / 2;        // +X arc (toward the corridor player in the bay)
const CPOD_DOOR_W = 1.02;                // door aperture width (a wide climb-through unit)
const CPOD_DOOR_H = 1.74;                // door aperture height
const CPOD_DOOR_CY = 1.08;               // door centre height (seated-eye glance + standing walk-in)
// The merged front door (user clarification 2026-07-02): a SOLID riveted aluminium door with a
//   ROUND DOMED PORTHOLE integral to it (the same domed-circular viewport character the ride-down
//   cabin has), NOT a flat glass pane. The porthole is generous enough to carry the descent view.
const CPOD_PORT_R = 0.40;                // the domed porthole radius (generous — carries the descent view; fits the 1.02×1.74 door upper half)

// FRONT-DOOR DOMED-PORTHOLE GLASS — a faint cool-tinted glossy glass (the domed disc set into the
//   door). Low opacity so the descent reads through, a Fresnel rim so the eye registers glass, not
//   a hole. Shared across all canonical pods (one program). Matches the cabin viewport's character.
const _cpodGlass = new THREE.MeshStandardMaterial({
  color: 0x2b3a44, roughness: 0.10, metalness: 0.30,
  emissive: 0x0a1620, emissiveIntensity: 0.42,
  transparent: true, opacity: 0.32, side: THREE.DoubleSide,
});
// inner-rim shadow well behind the domed glass — near-black, unlit, so the porthole reads as a deep
//   inset window in the door (a dark ring inside the bezel).
const _cpodRimShadow = new THREE.MeshBasicMaterial({ color: 0x07090a, side: THREE.DoubleSide });
_cpodGlass.onBeforeCompile = (shader: THREE.WebGLProgramParametersWithUniforms) => {
  shader.vertexShader = shader.vertexShader.replace('#include <common>',
    `#include <common>
     varying vec3 vCGVpos; varying vec3 vCGVnrm;`);
  shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>',
    `#include <begin_vertex>
     vCGVpos = (modelViewMatrix * vec4(transformed,1.0)).xyz;
     vCGVnrm = normalize(normalMatrix * normal);`);
  shader.fragmentShader = shader.fragmentShader.replace('#include <common>',
    `#include <common>
     varying vec3 vCGVpos; varying vec3 vCGVnrm;`);
  shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>',
    `#include <emissivemap_fragment>
     vec3 gV = normalize(-vCGVpos);
     float gF = pow(1.0 - clamp(dot(normalize(vCGVnrm), gV), 0.0, 1.0), 2.4);
     totalEmissiveRadiance += vec3(0.16,0.24,0.32) * gF * 1.6;`);
  shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>',
    `gl_FragColor = vec4( outgoingLight, diffuseColor.a );
     #ifdef OPAQUE
     gl_FragColor.a = 1.0;
     #endif
     float gF2 = pow(1.0 - clamp(dot(normalize(vCGVnrm), normalize(-vCGVpos)), 0.0, 1.0), 2.0);
     gl_FragColor.a = clamp(gl_FragColor.a + gF2 * 0.5, 0.0, 0.9);`);
};
// A DIM warm-lit cabin peek BEHIND the domed glass (so through the sealed porthole you see a lit
//   interior, inviting — "get in here"). Unlit warm but MUTED so the domed GLASS tint + Fresnel
//   still read as a window (not a blown-white disc); the descent view reads through it in-phase.
const _cpodCabinGlow = new THREE.MeshBasicMaterial({ color: 0x3a2c18 });

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
      const t = _tube(R, h, POD_SEG, _podPaint, CPOD_DOOR_AZ + dAzHalf, Math.PI * 2 - dAzHalf * 2);
      t.position.y = mid; root.add(t);
    }
  }
  // flared FOOT (below the door)
  root.add(_lathe([
    new THREE.Vector2(R * 0.90, 0.0), new THREE.Vector2(R * 1.02, 0.16), new THREE.Vector2(R, 0.28),
  ], POD_SEG, _podPaint));
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
  const scorchTopY = POD_BODY_H * 0.45;
  const scorchGeo = new THREE.LatheGeometry([
    new THREE.Vector2(R * 0.90 + 0.008, 0.0), new THREE.Vector2(R * 1.03, 0.16),
    new THREE.Vector2(R + 0.012, 0.28), new THREE.Vector2(R + 0.010, scorchTopY),
  ], POD_SEG);
  scorchGeo.computeVertexNormals();
  {
    const pos = scorchGeo.attributes.position;
    const cols = new Float32Array(pos.count * 3);
    const cChar = new THREE.Color(0x0d0906), cTarn = new THREE.Color(0x5a4126), cAlu = new THREE.Color(0xb6b9b3);
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
      ? _tube(R + 0.05, 0.10, POD_SEG, _podBandMat, CPOD_DOOR_AZ + dAzHalf, Math.PI * 2 - dAzHalf * 2)
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
  // a warm-lit cabin peek BEHIND the aperture (a dim interior box so the sealed glass reads LIT).
  const peekBack = _box(CPOD_DOOR_W + 0.2, CPOD_DOOR_H + 0.1, 0.12, _cpodCabinGlow);
  peekBack.position.set(0, 0, -0.95);
  frame.add(peekBack);
  for (const sx of [-1, 1]) {
    const side = _box(0.12, CPOD_DOOR_H + 0.1, 0.86, _cpodCabinGlow);
    side.position.set(sx * (CPOD_DOOR_W / 2 + 0.05), 0, -0.5);
    frame.add(side);
  }
  const peekFloor = _box(CPOD_DOOR_W + 0.1, 0.12, 0.86, _cpodCabinGlow);
  peekFloor.position.set(0, -CPOD_DOOR_H / 2, -0.5);
  frame.add(peekFloor);
  // a hint of interior structure (a seat-back + a rib) catching the warm light so the peek isn't flat.
  const innerSeat = _box(0.5, 0.66, 0.12, _podSteel);
  innerSeat.position.set(0, -0.05, -0.7); frame.add(innerSeat);
  // a DIM warm point lamp inside the peek so the interior reads lit but the domed glass stays a
  //   tinted window (not a blown disc).
  const peekLamp = new THREE.PointLight(0xffcf96, 0.35, 1.0, 2.8);
  peekLamp.position.set(0, 0.2, -0.6);
  frame.add(peekLamp);

  // ── 5. THE MERGED DOOR + DOMED PORTHOLE (user clarification 2026-07-02) — a SOLID riveted
  //    aluminium door with the ROUND DOMED porthole glass INTEGRAL to it (the same domed-circular
  //    viewport character the ride-down cabin has), NOT a flat glass pane. The player faces this
  //    door+porthole for everything (board through it, sit facing it, watch the descent through the
  //    round domed glass, kick it open at the wake). The bezel/frame is integral to the door — ONE
  //    clean ring, no doubled/floating rings (B1.d rule applies here too). Hinged on the +X edge.
  const doorPivot = new THREE.Group();
  doorPivot.name = 'canonicalPodDoor';
  doorPivot.position.set(CPOD_DOOR_W / 2 + fT / 2, 0, 0.06);   // hinge at the +X (right) edge, proud
  frame.add(doorPivot);
  const door = new THREE.Group();
  const doorTh = 0.10;
  // (a) the SOLID door PLATE — one riveted aluminium slab filling the opening (the door is solid;
  //     the porthole is a domed window set INTO it).
  const plate = _box(CPOD_DOOR_W, CPOD_DOOR_H, doorTh, _podDoorMat);
  plate.position.set(0, 0, 0);
  door.add(plate);
  // door-panel edge battens (a couple of proud stiffeners → the door reads as a fabricated plate)
  for (const by of [-CPOD_DOOR_H * 0.32, CPOD_DOOR_H * 0.34]) {
    const batten = _box(CPOD_DOOR_W - 0.14, 0.06, doorTh * 0.7, _podBandMat);
    batten.position.set(0, by, doorTh * 0.55);
    door.add(batten);
  }
  // perimeter rivet rows (the door is bolted together)
  for (let i = 0; i < 18; i++) {
    const u = i / 18; let rx: number, ry: number;
    if (u < 0.25) { rx = (u / 0.25 - 0.5) * (CPOD_DOOR_W - 0.14); ry = CPOD_DOOR_H / 2 - 0.06; }
    else if (u < 0.5) { rx = (CPOD_DOOR_W - 0.14) / 2; ry = (1 - (u - 0.25) / 0.25 - 0.5) * (CPOD_DOOR_H - 0.14); }
    else if (u < 0.75) { rx = (0.5 - (u - 0.5) / 0.25) * (CPOD_DOOR_W - 0.14); ry = -CPOD_DOOR_H / 2 + 0.06; }
    else { rx = -(CPOD_DOOR_W - 0.14) / 2; ry = ((u - 0.75) / 0.25 - 0.5) * (CPOD_DOOR_H - 0.14); }
    const sg = new THREE.SphereGeometry(0.013, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2);
    _cabinDisposables.push(sg);
    const stud = new THREE.Mesh(sg, _podFrameMat);
    stud.rotation.x = -Math.PI / 2; stud.position.set(rx, ry, doorTh * 0.55);
    door.add(stud);
  }
  // (b) the ROUND DOMED PORTHOLE set into the UPPER portion of the door (generous — carries the
  //     descent view). A dark inner-rim shadow well (aperture depth) → a domed convex glass disc →
  //     ONE integral proud bezel ring → a ring of bezel bolts. The dome bulges OUTWARD (+local Z).
  const portCY = CPOD_DOOR_H / 2 - CPOD_PORT_R - 0.14;   // porthole centre, in the door's upper half
  //  the recessed shadow well (the aperture through the door → depth, reads as inset)
  const wellGeo = new THREE.CylinderGeometry(CPOD_PORT_R, CPOD_PORT_R, doorTh + 0.02, 28, 1, true);
  _cabinDisposables.push(wellGeo);
  const well = new THREE.Mesh(wellGeo, _cpodRimShadow);
  well.rotation.x = Math.PI / 2;   // axis Y → local Z (through the door)
  well.position.set(0, portCY, -0.01);
  door.add(well);
  //  the DOMED glass disc (a shallow convex sphere cap bulging outward, +Z) — the same domed
  //    porthole character as the ride-down cabin viewport.
  const glassGeo = new THREE.SphereGeometry(CPOD_PORT_R, 28, 14, 0, Math.PI * 2, 0, Math.PI * 0.32);
  _cabinDisposables.push(glassGeo);
  const glass = new THREE.Mesh(glassGeo, _cpodGlass);
  glass.rotation.x = -Math.PI / 2;   // bulge toward +local Z (outward, toward the player)
  glass.position.set(0, portCY, doorTh * 0.5 + 0.02);
  door.add(glass);
  //  ONE integral proud BEZEL ring framing the porthole (channel-steel torus, part of the door)
  const bezGeo = new THREE.TorusGeometry(CPOD_PORT_R + 0.04, 0.05, 12, 30);
  _cabinDisposables.push(bezGeo);
  const bez = new THREE.Mesh(bezGeo, _podSteel);
  bez.position.set(0, portCY, doorTh * 0.5 + 0.02);   // in the door's XY plane, proud outward
  door.add(bez);
  //  a ring of bezel bolts (the porthole is bolted to the door) — flush studs on the bezel face
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const sg = new THREE.SphereGeometry(0.012, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2);
    _cabinDisposables.push(sg);
    const stud = new THREE.Mesh(sg, _podFrameMat);
    stud.rotation.x = -Math.PI / 2;
    stud.position.set(Math.cos(a) * (CPOD_PORT_R + 0.04), portCY + Math.sin(a) * (CPOD_PORT_R + 0.04), doorTh * 0.5 + 0.06);
    door.add(stud);
  }
  // (c) a wheel/lever LATCH near the free (−X) edge, low on the door (grab + turn to open)
  const wheel = _cyl(0.12, 0.12, 0.05, 14, _podFrameMat);
  wheel.rotation.y = Math.PI / 2;
  wheel.position.set(-CPOD_DOOR_W / 2 + 0.16, -CPOD_DOOR_H * 0.28, doorTh * 0.7);
  door.add(wheel);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const spoke = _cyl(0.011, 0.011, 0.10, 5, _podFrameMat);
    spoke.rotation.z = Math.PI / 2; spoke.rotation.y = a;
    spoke.position.set(-CPOD_DOOR_W / 2 + 0.16, -CPOD_DOOR_H * 0.28, doorTh * 0.7);
    door.add(spoke);
  }
  door.position.set(-CPOD_DOOR_W / 2, 0, 0);   // door-local origin → the hinge (+X) edge
  doorPivot.add(door);
  // door state: closed = flush over the aperture (sealed); open = swung ~110° outward (into +X).
  doorPivot.rotation.y = state === 'open' ? -1.9 : 0;

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
  const hAzHalf = Math.min(Math.PI * 0.9, (HATCH_W / 2 + 0.05) / CAB_R);
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

/** UNIFY the crashed cabin into the ONE persistent WALK-IN pod at the spawn (user re-scope). Called
 *  at step-out INSTEAD of dispose-and-swap: the SAME hero cabin the player woke in gets (1) the
 *  exterior aluminium skin wrapped around it, (2) re-grounded so its floor sits ON the terrain (the
 *  seated ride left the floor ~1.7 m up — fine seated, wrong to walk into), (3) walkable colliders,
 *  and (4) the salvage panel + chute-pop armed. It then PERSISTS into the real game (NOT disposed by
 *  endEscapePodIntro) as an enterable landmark — the SAME pod you rode down, that you can walk back
 *  into. Returns the pod's world (x,z) so the tutorial can scatter around it. `easeExposure` (default
 *  true = the live stepOut path) EASES the wake exposure down to the desert base like eye-adaptation
 *  (user spec #4 — no snap); the Continue-load path (restoreEnterablePod) passes false → snap to base
 *  (no wake exposure ever ran to ease from). */
export function unifyEnterablePod(ctx: GameContext, x: number, z: number, easeExposure = true): { x: number; z: number } {
  if (!podGroup) { buildPodScene(ctx); setCabinCrashPose(1); }
  const group = podGroup!;
  // (1) remove the seated cage (may already be gone from the crash) so we can add the walkable set.
  for (const body of podBodies) ctx.physics.world.removeRigidBody(body);
  podBodies.length = 0;
  _shellOffsets = [];
  // (2) RE-GROUND: the floor must sit on the terrain so the player can walk in. Sever the descent
  //     base coupling (else _syncPodToAltitude would haul it back to returnPos+altitude), then place
  //     the group with its floor on the ground + a GENTLE crashed lean (proud, not buried — you walk
  //     IN, so the hatch must reach the ground + the bore stay clear).
  _descentBase = null;
  const gy = ctx.terrain.heightAt(x, z);
  _crashPose = 1;
  // KEEP the exact GENTLE crashed lean the wake cabin already sits at (_CRASH_*) so there is NO
  //   tilt-snap at step-out — the pod the player climbed out of and the pod they can walk back into
  //   are the same object at the same pose. (_syncPodToAltitude normally applies this, but we just
  //   severed _descentBase, so set it directly here.) Pivot is the floor-base centre.
  group.rotation.set(_CRASH_PITCH, _CRASH_YAW, _CRASH_ROLL);
  // seat the floor on the sand (a hair below grade so the flared foot has no float gap). The cabin
  //   was already grounded here during wake (groundedDescentBase), so this is at most a ~6 cm nudge.
  group.position.set(x, gy - 0.06, z);
  group.updateMatrixWorld(true);
  // (3) EXTERIOR SKIN — wrap the outer hull around the interior (matched dims, hatch gap).
  if (!_enterableExteriorRoot) _enterableExteriorRoot = buildExteriorSkin(group);
  group.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  // (4) WALKABLE COLLIDERS (floor + wall ring gapped at the hatch).
  _addWalkableColliders(ctx);
  // (5) the pod is now a REAL-WORLD object lit by the real midday sun → restore the desert-base
  //     exposure (the wake lift was for the enclosed dim-interior moment) AND park the interior
  //     lights down to calm walk-in levels. The wake beat floods the cabin lights HARD (hemi 7.3,
  //     hatch flood 14@dist9, …) to punch the dazed enclosed cabin through the come-to fade at the
  //     lifted wake exposure; left un-parked they PERSIST into the real midday game (this SAME pod
  //     persists) and — now at the desert-base exposure, with the real sun already lighting the pod —
  //     blow the interior out + pool a hot spot on the sand (the USER-reported wash-out). Park them.
  // CLUSTER D — spec #4: EASE the wake exposure down to the desert base like eye-adaptation (no snap
  //   "instance change") on the live stepOut; SNAP on the Continue-load path (no wake exposure to ease
  //   from). Either way the interior lights park now (they don't need to ease — the ease is the tone
  //   curve, and the sun already lights the walk-in; the park just stops the wake flood blowing out).
  if (easeExposure) armExposureEase(ctx);   // ease over EXPO_EASE_S (ticked by updatePodExposureEase)
  else ctx.three.renderer.toneMappingExposure = CABIN_BASE_EXPOSURE;   // load path: snap to base
  parkPodLights();
  // widen the hatch fully open (you walk through it) + keep the dawn/midday hatch flood.
  blowCabinHatch(1);
  // (6) the REAL salvage panel on the −Z back + register as a machete-salvageable + arm chute-pop —
  //     the SAME first-salvage tutorial, now on the ONE persistent pod (not the separate wreck).
  _registerEnterablePodSalvage(ctx, group, x, z, gy);
  // (7) a displaced-sand berm banked against the buried foot so the dune swallows the base cleanly.
  _addEnterableBerm(ctx, x, z, gy);
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
  //   salvage panel + arms the chute-pop, and sets _podEnterable + _enterablePodXZ. easeExposure=false
  //   → SNAP to the desert base (a Continue load never ran the wake lift, so there's nothing to ease).
  unifyEnterablePod(ctx, saved.x, saved.z, false);
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
  // if the comic chute had already burst before save, restore it to its settled popped pose
  //   INSTANTLY (popChute(advanceSeconds) drives the inflate/settle synchronously). armChutePop
  //   built a fresh folded canopy inside unify; pop it to the end state so a reload shows the gag
  //   already deployed (not re-triggering it).
  if (saved.chutePopped) popChute(CHUTE_POP_DUR + 0.5);
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

  // ── Lighting: the cabin is OFF in deep space at the offset (no terrain sun reaching
  //    it), so add a warm dim interior point light + a faint fill hemisphere parented
  //    to the group, giving the cramped-lived-in glow + form on the lambert surfaces.
  // ── Lighting (C12 FIX 2): a dim LIVED-IN cabin with FORM + a cool aluminium read —
  //    NOT a flat warm fill. The prior rig (high flat warm-ish hemisphere ×1.05) washed
  //    the whole bore brown. New scheme: a tight WARM KEY pool from the ceiling lamp (POOLED,
  //    fast decay → shadowed cramped corners), a LOW COOL ambient (so the bare aluminium
  //    reads grey, not warm-bathed), an OFF-CENTRE directional that rakes the curved wall
  //    left-to-right (a gradient across the arc → the curvature reads, FIX 1 support), and a
  //    brighter cool PORTHOLE spill (a cool accent pool forward).
  // Warm ceiling lamp KEY — pooled (lower range + faster decay) so it pools at the apex
  // and the lower wall / corners fall off into shadow (form, not a flat fill).
  const lamp = new THREE.PointLight(0xffd2a0, 1.7, 3.8, 2.9);   // cooler tint + tighter pool (was washing the upper wall warm-tan)
  cabinLamp = lamp;   // R3a — brightened a touch on the crashed dawn wake
  lamp.position.set(0.1, CAB_APEX - 0.20, 0.05);   // at the ceiling dome light, nudged off-axis
  group.add(lamp);
  // LOW COOL ambient — a cool-grey sky / dark-cool ground hemisphere, so the aluminium skin
  // reads as cool bare metal (the warm key is a POOL on top, not a bath). Lifted a touch so
  // the cool grey dominates the warm pool away from the lamp.
  const fill = new THREE.HemisphereLight(0x93a0b0, 0x2a2d30, 0.72);   // cooler + a touch brighter
  group.add(fill);
  cabinFill = fill;   // T2.1 — setDescentProgress nudges the sky-tint warmer as the dawn fills the viewport
  // OFF-CENTRE warm directional — rakes ACROSS the bore from upper-right so the curved wall
  // picks up a clear left→right brightness GRADIENT (the single biggest "this is round" cue
  // at eye level — a flat-lit cylinder reads boxy; a raked one reads curved).
  const key = new THREE.DirectionalLight(0xffe8cc, 0.6);   // gentler, slightly cooler warm rake
  key.position.set(1.6, CAB_APEX, 0.2);          // from the right, so the arc brightens R→L
  key.target.position.set(-0.8, 0.7, 0.0);
  group.add(key);
  group.add(key.target);
  cabinKeyRake = key;   // Item 1 — flooded UP on the crashed wake (the directional carries the metallic-hull read)
  // a faint COOL counter-rake from the left so the far-left arc doesn't go dead black (keeps
  // the gradient readable as curvature, not a hard light/dark split).
  const coolRake = new THREE.DirectionalLight(0x8ea4ba, 0.28);
  coolRake.position.set(-1.4, WALL_H, -0.3);
  coolRake.target.position.set(0.6, 0.8, 0.4);
  group.add(coolRake);
  group.add(coolRake.target);
  cabinCoolRake = coolRake;   // Item 1 — the left counter-rake, flooded UP on the crashed wake too
  // Cool PORTHOLE spill (the planet-glow from −Z) — brighter so the forward arc + bezel get
  // a cool accent pool (a window casts cool light into a warm-lamp cabin).
  const vpGlow = new THREE.PointLight(0xa6c0d6, 0.95, 4.2, 2.2);
  vpGlow.position.set(0, VP_CY, -CAB_R + 0.05);
  group.add(vpGlow);
  vpGlowLight = vpGlow;   // T2.1 — the literal exterior light entering the cabin; warms+brightens on descent
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
  _crashPose = Math.max(0, Math.min(1, pose));
  // free the player: drop the seated cage so they can walk out the hatch onto real ground.
  if (_crashPose > 0 && podBodies.length > 0 && _cabinColliderCtx) {
    for (const body of podBodies) _cabinColliderCtx.physics.world.removeRigidBody(body);
    podBodies.length = 0;
    _shellOffsets = [];
  }
  // DAWN WAKE LIGHT — as the cabin settles crashed, the dawn pours in the open hatch + the
  //   cabin warms/brightens (the wake read: a warm-lit riveted cabin, not the dim space cabin).
  const s = _crashPose;
  // WAKE-READABILITY FIX (coherence pass): the numeric intensities were "set" but the small
  //   bore still rendered near-black — the point spills decay too fast to actually FILL the
  //   riveted walls (world sun is ~0 in the intro dawn frame, so these cabin lights carry the
  //   whole read). Raise the hatch flood + widen its reach (lower decay), lift the ambient fill
  //   so the cabin clears the gloom, and warm the porthole glow — the player must WAKE in a
  //   readable dawn-lit crashed cabin, not a black box.
  if (hatchSpillLight) {
    hatchSpillLight.color.copy(_VP_WARM);   // CONSISTENT-MIDDAY — bright near-white daylight pouring in (was the warm-dawn build color 0xffcaa0)
    hatchSpillLight.intensity = s * 14.0;   // MIDDAY FLOODING the hatch arc (brighter than dawn — the open door → full daylight pours in)
    hatchSpillLight.distance = 9.0;         // reach across the whole bore (was 5.5 — fell off before the far wall)
    hatchSpillLight.decay = 1.0;            // gentler falloff so the flood actually lights the cabin
  }
  if (cabinFill) {
    cabinFill.color.copy(_fillScratch.copy(_FILL_COOL).lerp(_FILL_WARM, s));   // bright neutral midday ambient
    // Item 1 — the hemisphere fill is the WHOLE-cabin lift (the ajar hatch blocks the sun flood, so
    //   this + the rakes carry the read). Lifted so the enclosed bore clears the gloom to a readable
    //   MIDDAY interior, a hair under the step-out (a slight dazed mood survives). NOTE (footgun): the
    //   original "still dark" read was the come-to FADE overlay at ~0.8, not the cabin lumens — these
    //   values are tuned against the FADE-CLEARED steady wake read (the rig now clears it pre-shot).
    cabinFill.intensity = 0.72 + s * 6.6;
  }
  if (vpGlowLight) {
    vpGlowLight.color.copy(_vpScratch.copy(_VP_COOL).lerp(_VP_WARM, s));
    vpGlowLight.intensity = 0.95 + s * 2.3;                            // the porthole also reads the bright midday desert (lifted with the rest)
  }
  if (cabinLamp) cabinLamp.intensity = 1.7 + s * 1.7;                  // the ceiling lamp KEY pools the dome/apex — a modest lift (the rakes/fill carry the wall read; keep the dome from over-hotting for a dazed mood)
  // Item 1 — the RAKE directionals hit every wall/seat/console face uniformly (a hemisphere ambient
  //   alone leaves the curved bore flat), so the crashed wake floods them up toward a midday-sun rake
  //   — every face reads lit, matching the step-out. The warm key drifts toward neutral daylight.
  if (cabinKeyRake) {
    cabinKeyRake.intensity = 0.6 + s * 1.9;                            // 0.6 dim descent key → ~2.5 midday flood
    cabinKeyRake.color.copy(_fillScratch.set(0xffe8cc).lerp(_FILL_WARM, s));   // warm → bright neutral daylight
  }
  if (cabinCoolRake) cabinCoolRake.intensity = 0.28 + s * 1.0;         // the far-arc counter-rake lifts too (no dead-black side)
  // WAKE-READABILITY FIX (coherence pass, root cause): the game runs ReinhardToneMapping @ a
  //   dim base exposure (1.05) tuned for the bright open desert — it CRUSHES a dark enclosed
  //   interior, so the crashed dawn cabin rendered near-black no matter how high the cabin lights
  //   went (a 4× light bump barely moved the read; the tone-curve was the bottleneck, not the
  //   lumens). Lift the renderer exposure as the cabin settles crashed so the enclosed dawn
  //   interior sits READABLE on the Reinhard curve; endEscapePodIntro restores the desert base.
  if (_cabinColliderCtx) {
    const r = _cabinColliderCtx.three.renderer;
    r.toneMappingExposure = CABIN_BASE_EXPOSURE + s * (CABIN_WAKE_EXPOSURE - CABIN_BASE_EXPOSURE);
  }
  _syncPodToAltitude();
}

/** Restore the renderer to the desert-base exposure. The impact/wake crash-pose LIFTS the
 *  global renderer.toneMappingExposure (1.05 → 2.0) so the enclosed dawn interior reads on the
 *  Reinhard curve (setCabinCrashPose). disposePodScene restores it on the normal exit, but a
 *  dev `jumpToBeat` OUT of a crash beat back to an earlier beat (e.g. wake → cockpit) does NOT
 *  tear down the pod — so without this the lifted exposure LEAKS into the non-crash beat (and,
 *  since sequence.setSkyIntroMode/etc. only reset on endEscapePodIntro, it would render washed
 *  out). jumpToBeat calls this whenever it lands on a beat that is not a crash beat. Idempotent;
 *  takes ctx so it works even when the pod isn't built (_cabinColliderCtx is null). */
export function restoreCabinExposure(ctx: GameContext): void {
  cancelExposureEase();   // CLUSTER D — a hard exposure restore (dev jump away) cancels a live step-out ease
  ctx.three.renderer.toneMappingExposure = CABIN_BASE_EXPOSURE;
}

// ─── CLUSTER D — the EYE-ADAPTATION exposure EASE at step-out (user spec #4: "no lighting instance
//    change; ease the exposure like eye adaptation"). The wake cabin runs a lifted exposure
//    (CABIN_WAKE_EXPOSURE, so the enclosed crashed interior reads on the Reinhard curve). When the
//    player steps out into the bright real desert, the exposure must drop to the desert base — but
//    NOT snap (a hard cut reads as an "instance change"). Instead ease it over ~1.8 s as they cross
//    the threshold, like an eye adapting to daylight. Armed at the LIVE stepOut (unifyEnterablePod);
//    ticked every frame from the main loop (it must persist PAST endEscapePodIntro, since it's a
//    gameplay-side ease — the fog-ease idiom). The Continue-load path (restoreEnterablePod) snaps to
//    base directly (no wake exposure ever ran to ease from). Hard-restored on skip/quit/dev-jump.
const EXPO_EASE_S = 1.8;              // seconds to ease the wake exposure down to the desert base
let _expoEase = 0;                    // countdown (s remaining); 0 = inactive
let _expoEaseFrom = CABIN_WAKE_EXPOSURE;   // the exposure to ease FROM (captured at arm)
/** Arm the step-out exposure ease (wake exposure → desert base over EXPO_EASE_S). Captures the
 *  current exposure as the start. Called from unifyEnterablePod on the LIVE stepOut path only. */
function armExposureEase(ctx: GameContext): void {
  _expoEaseFrom = ctx.three.renderer.toneMappingExposure;
  _expoEase = EXPO_EASE_S;
}
/** Tick the step-out exposure ease from the main loop (like updateIntroFogEase). Lerps the renderer
 *  exposure from the wake lift down to the desert base over EXPO_EASE_S (smoothstep, no snap), then
 *  lands EXACTLY on the base + disarms. No-op when inactive. Persists past endEscapePodIntro (it's a
 *  gameplay-side ease); a hard restore (disposePodScene/restoreCabinExposure) cancels a live ease. */
export function updatePodExposureEase(ctx: GameContext, dt: number): void {
  if (_expoEase <= 0) return;
  _expoEase = Math.max(0, _expoEase - dt);
  const k = _expoEase / EXPO_EASE_S;              // 1 at arm → 0 at the end
  const eased = k * k * (3 - 2 * k);              // smoothstep so it eases in AND out
  ctx.three.renderer.toneMappingExposure = CABIN_BASE_EXPOSURE + (_expoEaseFrom - CABIN_BASE_EXPOSURE) * eased;
  if (_expoEase <= 0) ctx.three.renderer.toneMappingExposure = CABIN_BASE_EXPOSURE;   // land exactly on base
}
/** Cancel any live exposure ease (a hard exposure restore happened — skip/quit/dev-jump). */
function cancelExposureEase(): void { _expoEase = 0; }

/** Dev smoke (CLUSTER D) — prove the step-out exposure EASE is a gradual eye-adaptation, not a snap.
 *  Arms the ease from the wake lift, then ticks updatePodExposureEase with SMALL FIXED dt (bypassing
 *  the throttled headless RAF, which feeds huge dt and can complete the ease in one frame → a false
 *  "snap"), collecting the exposure curve. Asserts: it starts at the wake lift, DESCENDS through
 *  several distinct mid values (an ease), is monotone non-increasing, and LANDS exactly on the desert
 *  base. Exposed via `__game.smokeExposureEase()`; consumed by the pod-walkout rig gate. */
export function smokeExposureEase(ctx: GameContext): {
  ok: boolean; from: number; final: number; midSamples: number; monotone: boolean; curve: number[];
} {
  const r = ctx.three.renderer;
  const prev = r.toneMappingExposure;
  r.toneMappingExposure = CABIN_WAKE_EXPOSURE;   // start at the wake lift
  armExposureEase(ctx);                          // arm the eye-adaptation ease from here
  const curve: number[] = [+r.toneMappingExposure.toFixed(4)];
  // tick past the full ease (EXPO_EASE_S) in small fixed steps so the descent is sampled finely.
  const steps = Math.ceil((EXPO_EASE_S / 0.08) + 4);
  for (let i = 0; i < steps; i++) { updatePodExposureEase(ctx, 0.08); curve.push(+r.toneMappingExposure.toFixed(4)); }
  const from = curve[0];
  const final = curve[curve.length - 1];
  // mid samples: strictly between the base and the wake lift (proves a gradual transition, not a snap).
  const midSamples = curve.filter((e) => e > CABIN_BASE_EXPOSURE + 0.03 && e < CABIN_WAKE_EXPOSURE - 0.03).length;
  // monotone non-increasing (an ease never rises).
  let monotone = true;
  for (let i = 1; i < curve.length; i++) if (curve[i] > curve[i - 1] + 1e-4) monotone = false;
  r.toneMappingExposure = prev;   // restore whatever was there (leave no side effect)
  cancelExposureEase();
  const ok = Math.abs(from - CABIN_WAKE_EXPOSURE) < 1e-3 && Math.abs(final - CABIN_BASE_EXPOSURE) < 1e-3
    && midSamples >= 4 && monotone;
  return { ok, from: +from.toFixed(3), final: +final.toFixed(3), midSamples, monotone, curve };
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
  // Hemisphere fill — near the dim build default (0.72); a touch above so the far arc away from
  //   the hatch stays legible when you walk back in, but nowhere near the 7.3 wake flood.
  if (cabinFill) {
    cabinFill.intensity = 1.1;
    cabinFill.color.copy(_FILL_WARM);   // keep the neutral-midday tint (matches the real sky)
  }
  // Rake directionals — back to a gentle form rake (build 0.6 / 0.28); the real sun does the heavy
  //   lifting on the walk-in now, these just keep the curved bore from reading flat/dead in shadow.
  if (cabinKeyRake) { cabinKeyRake.intensity = 0.7; cabinKeyRake.color.copy(_FILL_WARM); }
  if (cabinCoolRake) cabinCoolRake.intensity = 0.32;
  // Hatch spill — the wash-out CULPRIT (14@dist9 spilled a bright pool onto the sand). Drop it to a
  //   faint warm bounce that dies inside the doorway (short range), so the OPEN hatch reads lit-from-
  //   within without a hot terrain pool. The real midday sun lights the ground.
  if (hatchSpillLight) { hatchSpillLight.intensity = 1.4; hatchSpillLight.distance = 4.0; }
  // Porthole glow — back near the build default (0.95); a calm cool accent forward, not a 3.25 pool.
  if (vpGlowLight) vpGlowLight.intensity = 1.0;
  // Ceiling lamp — KEEP the small lamp as a cozy lived-in interior tell (a hair under the build 1.7).
  if (cabinLamp) cabinLamp.intensity = 1.5;
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
  if (vpGlowLight) {
    vpGlowLight.color.copy(_vpScratch.copy(_VP_COOL).lerp(_VP_BLAST, s));
    vpGlowLight.intensity = 0.95 + s * 2.6;    // 0.95 orbital cool → ~3.5 the blast flooding the cabin
  }
  if (cabinFill) {
    cabinFill.color.copy(_fillScratch.copy(_FILL_COOL).lerp(_FILL_BLAST, s * 0.9));
    cabinFill.intensity = 0.72 + s * 0.5;       // the whole cabin brightens under the blast
  }
}

/** Pose the PARACHUTE lever (the gag hook). `t` in [0,1]: 0 = at rest, 1 = fully yanked
 *  forward (toward the seat). The parachute beat calls this with a brief jolt on each
 *  pull (e.g. lerp toward 1 then settle), and with `snapped=true` to droop it dead —
 *  the lever hangs slack off its pivot (the 3rd-pull SNAP, no chute). Safe no-op if the
 *  pod isn't built. */
export function setParachuteLeverPull(t: number, snapped = false): void {
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
  // Restore the desert-base exposure (the wake crash-pose lifted it for the enclosed dawn
  //   interior — see setCabinCrashPose). Runs on every teardown path (stepOut swap +
  //   endEscapePodIntro), so the real game never inherits the lifted interior exposure.
  cancelExposureEase();   // CLUSTER D — a hard teardown cancels any live step-out exposure ease
  ctx.three.renderer.toneMappingExposure = CABIN_BASE_EXPOSURE;
  if (podGroup) {
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
  reentryPlasmaMat = null;
  reentryPlasmaMesh = null;
  reentryShimmerMat = null;
  reentryShimmerMesh = null;
  vpGlowLight = null;
  cabinFill = null;
  chuteLever = null;
  leverBrokenTell = null;
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
let chutePopT = -1;                           // pop animation clock (seconds); <0 = not popped / not armed
let chutePopArmed = false;                    // the canopy is built + ready to pop on the first salvage strike
const CHUTE_POP_DUR = 1.55;                   // seconds of the inflate+overshoot+saggy-settle one-shot
const CHUTE_OVERSHOOT = 0.34;                 // how far the springy inflate punches PAST full (was ~0.12) — a big comic POOF
const CHUTE_DROOP_LEAN = 0.11;                // rad — the gentle asymmetric lean the billow settles into ("useless" sag; too much tips it over BESIDE the pod)
const CHUTE_DROOP_SAG = 0.14;                 // extra vertical squash the dome sags by as it deflates onto the wreck
// Comic canopy material — faded orange-white ripstop (reads as a real chute; a bit worn).
const _chuteCanopyMat = new THREE.MeshLambertMaterial({ color: 0xd8894a, flatShading: true, side: THREE.DoubleSide });
const _chuteGoreMat = new THREE.MeshLambertMaterial({ color: 0xe8e2d4, flatShading: true, side: THREE.DoubleSide });   // the alternating pale gores
const _chuteLineMat = new THREE.MeshLambertMaterial({ color: 0x2a2620, flatShading: true });                          // dark shroud lines
const _chuteDisposables: THREE.BufferGeometry[] = [];

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
  }
  dome.scale.y = SQUASH;
  // a crown vent cap so the dome apex reads finished, not a hole.
  const ventGeo = new THREE.CylinderGeometry(CANOPY_R * 0.13, CANOPY_R * 0.17, 0.1, 12);
  _chuteDisposables.push(ventGeo);
  const vent = new THREE.Mesh(ventGeo, _chuteLineMat);
  vent.position.y = CANOPY_R * SQUASH * 0.98;
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
  for (let i = 0; i < GORES; i++) {
    const a = (i / GORES) * Math.PI * 2 + Math.PI / GORES;
    const skirt = new THREE.Vector3(Math.cos(a) * skirtR, skirtY, Math.sin(a) * skirtR);
    const riser = new THREE.Vector3(0, riserY, 0);
    const mid = skirt.clone().lerp(riser, 0.5);
    const len = skirt.distanceTo(riser);
    const lineGeo = new THREE.CylinderGeometry(0.026, 0.026, len, 4);   // reads clearly at distance without looking like a rod
    _chuteDisposables.push(lineGeo);
    const line = new THREE.Mesh(lineGeo, _chuteLineMat);
    line.position.copy(mid);
    line.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), riser.clone().sub(skirt).normalize());
    line.userData.noCollider = true;
    grp.add(line);
  }
  // a chunky riser strap/knot at the gather (where it "attaches" to the pod crown)
  const knotGeo = new THREE.CylinderGeometry(0.13, 0.17, 0.36, 8);
  _chuteDisposables.push(knotGeo);
  const knot = new THREE.Mesh(knotGeo, _chuteLineMat);
  knot.position.y = riserY + 0.12;
  knot.userData.noCollider = true;
  grp.add(knot);
  // anchor so the riser knot sits just above the crown and the billow puffs LOW over the
  //   nose — the wide dome drapes down around the pod's upper body, not floating overhead.
  grp.position.set(0, apex + 0.55, 0);
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
  chutePopArmed = false;
  chutePopT = -1;
}

/** Is the chute armed + not yet popped? (the tutorial driver checks this to fire the payoff). */
export function chutePopReady(): boolean {
  return chutePopArmed && chutePopT < 0 && chuteCanopy !== null;
}

/** FIRE the comic chute-pop (the failed chute finally deploys, uselessly, on the ground).
 *  Reveals the canopy + starts the one-shot springy inflate (updateChutePop drives it) +
 *  plays the FWOOMP. Idempotent — a second call while popping is a no-op. */
export function popChute(advanceSeconds?: number): void {
  if (!chuteCanopy || chutePopT >= 0) return;
  chuteCanopy.visible = true;
  chutePopT = 0;
  playChutePop();
  // Rig-shot helper: synchronously drive the inflate (the harness pauses the main
  //   loop, which gates updateChutePop, so without this a paused frame catches the
  //   canopy still folded). Step in small increments so the settle math resolves.
  if (advanceSeconds && advanceSeconds > 0) {
    let left = advanceSeconds;
    while (left > 0) { const step = Math.min(1 / 60, left); _advanceChuteInflate(step); left -= step; }
  }
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

/** Per-frame driver for the chute-pop inflate (T4.3). No-op unless popping. The COMIC arc:
 *  a fast springy inflate that punches PAST full (a big "FWOOMP" overshoot POOF), then the
 *  billow sags back and DROOPS — the dome deflates a touch + leans limply to one side and
 *  the canopy squashes down onto the wreck (the useless-anticlimax gag). Called from the
 *  tutorial driver's tick (normal gameplay, post-handoff). D5 — ALSO owns the robust pry→pop
 *  trigger (always-running, tutorial-phase-independent) so the gag can never be missed. */
export function updateChutePop(ctx: GameContext, dt: number): void {
  _autoFireChuteOnPry(ctx);   // D5 — fire the gag on the pry event itself (decoupled from the tutorial phase)
  _advanceChuteInflate(dt);   // advance the one-shot inflate animation (no-op unless popping)
}

/** Advance the chute-pop inflate one-shot (the scale/droop/settle animation). Split out of
 *  updateChutePop so popChute's synchronous rig-shot advance loop can drive it WITHOUT the
 *  ctx-dependent pry check (D5). No-op unless popping. */
function _advanceChuteInflate(dt: number): void {
  if (!chuteCanopy || chutePopT < 0) return;
  chutePopT += dt;
  const k = Math.min(1, chutePopT / CHUTE_POP_DUR);
  // ── SCALE: springy inflate with a big early overshoot, then ease down to rest.
  //   base smoothsteps 1→ slightly-past-1 fast; the overshoot is a decaying wobble.
  const base = k * k * (3 - 2 * k);                                 // smoothstep to 1
  const wobble = Math.sin(k * Math.PI * 2.3) * (1 - k) * CHUTE_OVERSHOOT;  // big decaying POOF
  const s = Math.max(0.001, base + wobble);
  chuteCanopy.scale.setScalar(s);
  // ── DROOP: after the overshoot peaks (k≳0.45) the billow goes limp — it leans to one
  //   side + sags down onto the pod. Ramp the droop in over the back half of the arc.
  const droop = Math.max(0, (k - 0.45) / 0.55);       // 0 until mid, →1 at rest
  const droopE = droop * droop * (3 - 2 * droop);     // smooth
  // whole-assembly lean (asymmetric, sells "useless") + a little bob that decays as it settles
  const bob = Math.sin(chutePopT * 5.5) * (1 - k) * 0.10;
  chuteCanopy.rotation.z = CHUTE_DROOP_LEAN * droopE + bob;
  chuteCanopy.rotation.x = CHUTE_DROOP_LEAN * 0.30 * droopE;   // a touch of forward flop too
  // the DOME sub-group sags vertically (deflates onto the wreck) as it droops
  const dome = chuteCanopy.getObjectByName('chuteDome');
  if (dome) dome.scale.y = 0.72 * (1 - CHUTE_DROOP_SAG * droopE);
  if (k >= 1) {
    chuteCanopy.scale.setScalar(1);
    chuteCanopy.rotation.z = CHUTE_DROOP_LEAN;
    chuteCanopy.rotation.x = CHUTE_DROOP_LEAN * 0.30;
    if (dome) dome.scale.y = 0.72 * (1 - CHUTE_DROOP_SAG);
    // leave chutePopT at its end value (>0) so chutePopReady() stays false — popped once.
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
// ── R3a (C18 in↔out SIZE-MATCH) — the exterior wreck now matches the HERO CABIN the player
//    rode down + climbed out of (buildPodScene: interior radius CAB_R=1.28, outer ≈ CAB_R+SHELL
//    ≈ 1.44; interior apex CAB_APEX≈2.57). So the exterior BODY RADIUS = the cabin's OUTER hull
//    radius, and the body+nose height matches the cabin's wall+dome — when the player climbs out
//    + looks back, the wreck IS the same vessel (same diameter/height/proportions). This widens
//    the C11 "tall torpedo" into the FAT capsule the cabin actually is (the cabin is the hero the
//    player lives in 20-30s → it's the anchor; consistency > the old narrow-silhouette pref).
const POD_R = 1.44;        // body radius = the cabin's OUTER hull radius (CAB_R 1.28 + SHELL 0.16) → ≈2.88m diameter, MATCHING the bore the player rode in
const POD_BASE_H = 0.34;   // heat-shield base slab height (scorched, sunk in sand)
const POD_BODY_H = 1.95;   // straight cylindrical body = the cabin's straight WALL_H (1.95) → the standing-wall zone matches
const POD_NOSE_H = 0.70;   // tucked ogive nose-cap ≈ the cabin's DOME_H (0.62) + a little crown (the exterior nose reads above the interior dome)
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
  localSpace: true,   // the exterior skin rides the descent/tumble in future work — pin the grime now (see hullMaterial.ts)
});
// Darker channel-steel material (porthole + hatch frames, rivet bands) — a value
// contrast to the bright aluminium skin so the steel hardware reads as fitted-on.
const _podSteel = createRustedHullMaterial({
  baseColor: 0x4f4c46,           // dark warm-grey channel steel
  streakIntensity: 0.4, wearAmplitude: 0.3,
  oxStrength: 0.4, oxDeepStrength: 0.45, seamRustStrength: 0.45,
  localSpace: true,   // pod rides the descent/tumble in future work — pin grime (see hullMaterial.ts)
});
// Rivets / studs / small hardware — mid steel-grey (reads as cast/forged fittings,
// distinct from both the bright skin and the dark channel frames).
const _podFrameMat = createRustedHullMaterial({
  baseColor: 0x7d7a72,           // mid steel-grey hardware
  rustHex: 0x4a2810, streakIntensity: 0.3, oxStrength: 0.3, oxHex: 0x9a5a2e,
  oxDeepStrength: 0.3, seamRustStrength: 0.3, fleckStrength: 0.6,
  localSpace: true,   // pod rides the descent/tumble in future work — pin grime (see hullMaterial.ts)
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
  localSpace: true,   // pod rides the descent/tumble in future work — pin grime (see hullMaterial.ts)
});
// Riveted SEAM-BAND metal — a mid grey-aluminium tone (lighter than the dark
// channel steel) so the latitude bands read as fitted RIVETED HOOPS, not as dark
// drum-divisions cutting the capsule into stacked segments.
const _podBandMat = createRustedHullMaterial({
  baseColor: 0x8c8d85,           // mid grey-aluminium band
  streakIntensity: 0.3, wearAmplitude: 0.34, fleckStrength: 0.7,
  oxStrength: 0.32, oxHex: 0x96602e, oxDeepStrength: 0.28, seamRustStrength: 0.3,
  localSpace: true,   // pod rides the descent/tumble in future work — pin grime (see hullMaterial.ts)
});
// (CLUSTER D — _podPortholeBandMat RETIRED with the outer −Z porthole-echo bezel: the −Z arc is now
//   the walk-in door OPENING, not a bezel-ringed porthole; the domed porthole moved into the door slab.)
// PRIED-OPEN HATCH DOOR — a distinctly LIGHTER bright-aluminium value so the
// strippable salvage door POPS off the body (it's the tutorial target, must read
// as the clearest thing on the model). Heavy bare-metal scuffs (it's been forced).
const _podDoorMat = createRustedHullMaterial({
  baseColor: 0xcdd0cb,           // bright pried aluminium — lighter than the body skin
  bareMetalHex: 0xe2e4e2,
  streakIntensity: 0.2, wearAmplitude: 0.34, fleckStrength: 1.0,
  oxStrength: 0.18, oxHex: 0x9a6a3e, abrasionStrength: 0.4,
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

/** Place the HERO crashed pod at desert (x,z) — the VERTICAL aluminium capsule
 *  standing on its heat-shield base, LEANED + half-buried in the dune, hatch +
 *  porthole facing the player's wake spot. Idempotent (replaces any prior).
 *  PERSISTS into the real game (NOT disposed by endEscapePodIntro). A vertical
 *  cylinder collider (from the invisible proxy) follows the standing silhouette;
 *  the dome/antenna/door/decorations are noCollider. */
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
