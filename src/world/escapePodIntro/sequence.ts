// Escape-pod intro — the sequence/state-machine framework.
// ─────────────────────────────────────────────────────────────────────────────
// The first-person crash-landing opening (FEATURES.escapePodIntro). Full vision +
// phased build plan: docs/feature-escape-pod-intro.md. This file is the SPINE the
// whole feature hangs on — the beat state machine + the contract every beat obeys.
//
// T0.0 (the contract spike) lands this INERT scaffold: the beat enum, the IntroState
// shape, the manager skeleton (start/advance/end + the per-frame dispatch), and the
// gating helper. Nothing starts the intro yet — T0.1 wires the new-game branch; the
// per-beat controllers (camera/locomotion/FX) land in T0.2+.
//
// THE CONTRACT (how beats work — read before adding one):
//  • GATING: while `ctx.intro?.active`, the intro OWNS the player + camera. Normal
//    gameplay systems are suppressed via `introActive(ctx)` guards (NOT ctx.flags.paused
//    — that would freeze the intro tick too). updateEscapePodIntro runs BEFORE
//    updatePlayer in the main tick so it can set the capsule + drive the camera first.
//    (R4 confirmed: the KCC is collision-general — it walks on bespoke ship-floor box
//    colliders, no terrain coupling.)
//  • CAMERA: a beat may leave FREE-LOOK (player mouse-looks via PointerLockControls) or
//    DRIVE the look (scripted) by writing the controls' euler + syncing. Locomotion
//    (WASD→KCC) is enabled on walk beats, disabled on seated beats (gate in updatePlayer
//    via introActive + the per-beat mode).
//  • BEAT COMPLETION: a per-beat tick drives its content and calls advanceBeat / jumpToBeat
//    when its trigger fires (reached a position, a timer, an interaction). The manager
//    holds no global timer — each beat owns its own (beatStartedAt).
//  • PAUSE/SAVE: Esc opens the pause menu (freezes via flags.paused, intro included). The
//    intro is NOT saved mid-sequence — the first real save is at the desert handoff
//    (T0.4). Quitting mid-intro restarts the intro next load. (R1: the additive
//    `introComplete` save field, legacy=true, prevents a post-intro save from replaying.)
//  • WORLD: the desert world is already generated synchronously at boot (R2), so the
//    handoff (stepOut → the real game) is a TELEPORT to the spawn, not a stream. The
//    ship/pod beats run in their own offset geometry while the desert sits ready.
// ─────────────────────────────────────────────────────────────────────────────

import * as THREE from 'three';   // B2 — the boarding-flow gaze/proximity math (Vector3 scratch)
import type { GameContext } from '../../GameContext.ts';
import { FEATURES } from '../../config/features.ts';
import { Tuning } from '../../config/tuning.ts';
import {
  buildShipScene, disposeShipScene, getShipSpawn,
  SHIP_CORRIDOR_ENTER_Z, SHIP_DEAD_END_Z,
  setCockpitAlert, setShipAlert, setEngineFire,
  getPodBayThreshold, getPodBaySeatedEye, releasePodFromBay,   // R5c — the docked-pod bay + physical release
  setBayPodDoorOpen, getPodBayDoorWorld, getPodBayInteriorStand,   // B2 — the player-gated boarding flow (E-open door + walk-in gate + E-sit)
  setBayAirlockDoor, getBayAirlockThreshold, getBayAirlockDoorWorld,   // W2b — the airlock sliding door in front of the pod (E-open → walk the collar → the pod's own door)
  setBayPodYaw, getBayPodCenter,   // Y-queue — the rotate-then-eject beat (the pod turns in its cradle, porthole to space)
} from './shipScene.ts';
import { buildPodScene, disposePodScene, getPodSpawn, getCrashedSeatWorld, getPodAltitude, setDescentProgress, setDescentBase, setTumbleLight, setParachuteLeverPull, setEjectLeverPull, setCabinCrashPose, blowCabinHatch, restoreCabinExposure, unifyEnterablePod, podIsEnterable, setPodHidden } from './podScene.ts';
import { buildHaulerExterior, disposeHaulerExterior, setHaulerExplosion, setHaulerDeparture, setHaulerHidden, haulerBuilt } from './haulerScene.ts';   // Phase 3 (T3.1/T3.2) — the hero freighter + its death staged through the post-eject porthole; C1 — the post-eject departure recession; PERF — reveal the preloaded (parked) hauler instead of a cold build
import { startPodTutorial } from './podTutorial.ts';   // T4.3 — the first craft→salvage→chute-pop tutorial (runs as gameplay post-handoff)
import { setGameHudHidden, showIntroPrompt, hideIntroPrompt, setIntroBlack } from './introHud.ts';
import { flashScreen } from '../../fx/screenFlash.ts';
import { addTrauma } from '../../fx/cameraShake.ts';
import { setSkyIntroMode, setPlanetApproach } from '../sky.ts';   // REBUILD v2 R1a — drive the real sky into "space mode" for orbit, ease to dawn at re-entry; C3 — grow the planet toward the porthole across the early descent (the approach arc)
import {
  ensureAudioStarted, playEjectThunk, playExplosionBoom, playKlaxon, playHullGroan,
  playReentryRumble, playLeverClick, playLeverSnap, playDoorBlow, playCrashImpact,
  startCockpitHum, stopCockpitHum, startDescentRush, stopDescentRush, stopAllIntroLoops,
  startMusicEscape, stopMusicEscape, startMusicDescent, stopMusicDescent, startMusicDesert,
  startEngineFire, stopEngineFire, startDesertWind,
  playBoltShear, playHatchSeal, playShipDeathRoar, playAweSwell,
} from '../../audio/audio.ts';   // T5.1 SFX + ambient loops · T5.2 music cues · T5.3 gap-fill (fire/wind beds + bolt/seal/death-roar/awe one-shots)
import { setSoundscapeSuppressed } from '../../audio/soundscape.ts';   // C2 — silence the normal desert wind while the intro owns the scene (its own ambience plays)
import { setMusicSuppressed } from '../../audio/music.ts';             // C2 — silence the normal game music while the intro owns the scene (its own music cues play)

/** Seconds the cockpit opens SEATED (looking at the planet) before control + the cue. */
const COCKPIT_DWELL = 3.0;
// B2 — the EJECT_FALLBACK auto-fire timer is REMOVED: the eject is now PURELY player-gated (the
//   user: "nothing automatic; it waits until the player actually does all of these things").
/** Phase 3 (T3.2) — the SHIP-EXPLOSION beat is now the vision's climactic SPECTACLE: the
 *  player watches their hauler DIE through the porthole (a white flash → a blooming fireball
 *  → the hull breaking into tumbling debris → a shockwave → a receding burning husk), the
 *  cabin flooded by the blast light — then it settles into the descent. Staged over these
 *  sub-timings (seconds). C18 honoured: the POD stays UPRIGHT + LEVEL facing the window (no
 *  tumble) — the SHIP tumbles/breaks; the pod holds steady + watches.
 *    INTACT_DWELL — the ship reads WHOLE in the window (you see what you fled) before it dies.
 *    EXPLODE_DUR  — the fireball/breakup unfolds over this many seconds (the spectacle breathes).
 *    HUSK_DWELL   — a last beat on the receding burning husk/debris before the fall begins. */
const SHIP_EXPLODE_DUR = 2.3;     // the explosion unfolds (flash→fireball→breakup→shockwave→husk)
const SHIP_HUSK_DWELL = 0.7;      // a breath on the receding burning husk before the descent
/** W6 item 2 (user, 2026-07-03: "just have ONE view where we're getting further away while it
 *  explodes") — the depart + explosion are now ONE continuous shot: the pod pulls away from the
 *  ship AND the ship explodes DURING the recession (no fade, no re-frame). The `recede` phase
 *  drives setHaulerDeparture the WHOLE time; setHaulerExplosion fires mid-recession, once the
 *  ship has drifted out to a good distance (~40 m), so the blast reads with the husk receding.
 *    SHIP_RECEDE_DUR — total seconds the ship recedes (departure 0→1: 24 m → ~58 m out).
 *    SHIP_BLAST_AT   — seconds into the recession the detonation fires. At the ease-out departure
 *                      curve, ~1.6 s puts the ship ~40 m out (a good "read at distance" blast) — the
 *                      intact hauler is watched receding for that beat, THEN it blows mid-drift.
 *  After BOTH the recession completes AND the explosion finishes, → husk → the descent. */
const SHIP_RECEDE_DUR = 4.6;      // total recession time (the pod pulls away the whole shot)
const SHIP_BLAST_AT = 1.6;        // seconds into the recession the ship detonates (~40 m out by the ease-out curve)
/** Seconds of the SLOW, seamless atmospheric fall (C18 user walk-test: descend slowly + serenely —
 *  watch the planet get closer, space fade to sky, the ground slowly approach). Was 8.0.
 *  REBUILD v2 R4 — this is the FULL-FALL clock (progress 0→1 over this many seconds AT a fixed
 *  rate). The descent beat only rides it to DESCENT_HANDOFF_PROGRESS, then HANDS OFF to the
 *  parachute beat MID-AIR; the parachute beat resumes the SAME clock/rate down to the ground, so
 *  the fall rate is seamless across the hand-off (no speed change, no camera jump).
 *  W6 item 3 (user, 2026-07-03: "moving way too fast toward the planet — slower"): lengthened
 *  18.0 → 22.0 (×1.22). The SPACE leg (progress 0→~0.24, the planet-approach + plasma) now runs
 *  ~5.3 s (was ~4.3 s, ≈1.35× the near-plasma segment given the reshaped approach curve below);
 *  the whole fall stays a serene ~22 s without dragging. All progress-keyed timings (handoff 0.55,
 *  ground 0.98) are unchanged — only the wall-clock lengthens. */
const DESCENT_DURATION = 22.0;

/** W6 item 3 — THE PLANET-APPROACH CURVE (progress 0..1 → approach 0..1). Slower + TWO PHASES, so
 *  the planet reads as APPROACH PHYSICS (slow when far, faster as the atmosphere nears), not a
 *  linear zoom. Two segments across the space leg (both before the plasma hands over at p≈0.24):
 *    • PHASE A (far, subtle): progress 0 → APPROACH_PHASE_A · a GENTLE drift — most of the space
 *      leg spent barely growing (the distant disc creeping closer). Ends at approach ≈ 0.32.
 *    • PHASE B (near, accelerating): progress APPROACH_PHASE_A → APPROACH_PHASE_B · the growth
 *      ACCELERATES — the limb fills the porthole + overflows it just as the plasma fires.
 *  sky.ts squares this again (ease-in) before scaling, so PHASE A reads truly subtle (0.32²≈0.10
 *  of the scale range) and PHASE B genuinely rushes in. Beyond PHASE_B it's clamped at 1 (filling).*/
const APPROACH_PHASE_A = 0.15;   // progress at which the far→near handover happens (most of the space leg is far/slow)
const APPROACH_PHASE_B = 0.24;   // progress at which the approach is full (the limb fills) — hands into the plasma here
const APPROACH_A_END = 0.32;     // the approach value reached by the end of PHASE A (a subtle far drift)
export function planetApproachCurve(progress: number): number {
  if (progress <= 0) return 0;
  if (progress < APPROACH_PHASE_A) {
    // PHASE A — far + slow. A gentle drift: ease the approach 0 → APPROACH_A_END over the far leg,
    //   shaped so it stays low early (the distant disc barely growing). (Squared again in sky.ts.)
    const kf = progress / APPROACH_PHASE_A;          // 0→1 across the far leg
    return APPROACH_A_END * kf * kf;                 // slow-start drift (very subtle when truly far)
  }
  if (progress < APPROACH_PHASE_B) {
    // PHASE B — near + accelerating. Ramp APPROACH_A_END → 1 as the atmosphere limb sweeps up + fills.
    const kn = (progress - APPROACH_PHASE_A) / (APPROACH_PHASE_B - APPROACH_PHASE_A);   // 0→1 across the near leg
    return APPROACH_A_END + (1 - APPROACH_A_END) * kn;
  }
  return 1;   // filling the porthole (handed into the plasma)
}
/** REBUILD v2 R4 — the descent beat hands off to the parachute gag at THIS progress, MID-FALL.
 *  At p=0.55 the pod is ~383 m up (altitude = DESCENT_ALT·(1−p^1.7); DESCENT_ALT≈600) with the
 *  bulk of the fall still ahead — so the gag (3 pulls + the snap) plays clearly AIRBORNE with the
 *  ground rushing up, NOT on the ground. The parachute beat continues the fall to impact. */
const DESCENT_HANDOFF_PROGRESS = 0.55;
/** Progress at which the continued fall reaches the ground → the parachute beat advances to impact
 *  (just shy of 1.0 so the cabin is essentially on the spawn ground when impact's hard cut lands). */
const PARACHUTE_GROUND_PROGRESS = 0.98;
/** Pulls before the lever snaps off — THE GAG (3 pulls → no chute). */
const PARACHUTE_PULLS = 3;
/** Anti-softlock: auto-fire a pull this often if the player just stares (seconds). R4 — 2.0 (was
 *  2.5) so all 3 auto-pulls + the snap land by ~progress 0.88 (~114 m up) within the continued
 *  fall, leaving a natural ~1.75 s airborne post-snap beat (ground rushing up) before impact. */
const PARACHUTE_AUTOPULL = 2.0;
/** Min beat of continued free-fall AFTER the lever snaps before impact (seconds) — guarantees the
 *  snap reads as a distinct beat with the ground still coming up even if the snap lands very low.
 *  (The fall keeps going via the descent clock; this is the floor on the post-snap airborne window.) */
const PARACHUTE_SNAP_FALL = 1.6;
/** Impact: seconds to fade to black, HOLD in full blackout, then (wake) fade in. REBUILD v2 R4 —
 *  the user wanted a REAL blackout (≥2 s of black), not a flash: a quick fade-to-black + a long
 *  HOLD, so impact→wake reads as a solid ~2.5 s+ of darkness before coming to. */
const IMPACT_FADE = 0.7;
const IMPACT_HOLD = 2.0;
/** Wake: seconds to fade FROM black (come to), then hold, before the blow-hatch prompt. */
const WAKE_FADE = 2.5;
const WAKE_HOLD = 1.2;
/** T4.1 — wake-inside-the-pod → blow-the-hatch → climb-out (the C18 req). Door blow duration,
 *  how far you walk to "climb out", and anti-softlock fallbacks (auto-blow / auto-step-out). */
const WAKE_BLOW_DUR = 0.6;
const WAKE_CLIMB_DIST = 2.2;
const WAKE_BLOW_FALLBACK = 5.0;
const WAKE_CLIMB_FALLBACK = 8.0;
/** T4.2 — the desert reveal: seconds of held aftermath-silence (E7) as you stand in the dawn
 *  (your pod beside you, the horizon hook ahead, no HUD/objectives) before the game takes over. */
const REVEAL_DWELL = 4.0;

/** CONSISTENT-MIDDAY (user re-scope, 2026-07-01): the whole atmospheric leg — from the pod
 *  falling into the real sky through the crash, wake, and step-out — plays at a BRIGHT CLEAR
 *  MIDDAY, IDENTICAL crashing-down vs stepping-out (no dawn, no time/light jump on exit). The
 *  game's diurnal clock (core/lighting.ts) puts NOON at dayTime=0.5 (sun height peaks); 0.46 is
 *  a hair past noon → still bright midday but a sliver of sun-angle so the dunes + the pod read
 *  with form (dead 0.5 flattens shadows). setSkyIntroMode's "real sky" leg is fully driven by
 *  ctx.time.sunHeight (from dayTime), so setting this at DESCENT re-grounding makes the sky the
 *  pod falls into = the sky you step out into, automatically. Clear skies = cloudiness/storm 0. */
const INTRO_MIDDAY_TIME = 0.46;

/** W6 item 5 (user, 2026-07-03: "the weather stays the same as when crashing… NOTHING changes when
 *  I leave the pod"): the fog is NORMALIZED to the game's survival fog DURING THE FALL, so the
 *  crash/wake/exit are ALREADY at plain game fog — there is nothing to pin at ground level and
 *  nothing to ease back after the handoff (both the ground-level clear-fog pin AND the 6 s post-exit
 *  ease are RETIRED). The descent keeps a THIN fog at ALTITUDE (so the vista + far dunes read clear
 *  from high up), then blends imperceptibly to the survival density as the pod drops through the
 *  lower atmosphere — by the time it lands, the fog IS the survival fog (no hazing-over on step-out).
 *  ALTITUDE_CLEAR_FOG = the thin high-altitude value (the vista); FOG_BLEND_ALT = the altitude (m)
 *  below which the blend to survival runs (so it's done well before the ground). */
const ALTITUDE_CLEAR_FOG = 0.00006;   // very thin fog high up (the clear vista through the porthole)
const FOG_BLEND_ALT = 150;            // metres — below this the descent fog blends to the survival density (done by landing)

/** Force the real world to a bright clear MIDDAY (the intro's atmospheric handoff look). Sets the
 *  diurnal clock to noon-ish + clears any cloud/storm so the descent sky, the crash, the wake, and
 *  the step-out all share ONE consistent bright sky (no dawn, no time jump on exit). Cloudiness is
 *  RESET (not pinned) so normal gameplay weather resumes after the handoff. W6 item 5: this is set
 *  DURING THE FALL (the descent re-grounding) so the crash/wake/exit run at the SAME midday-clear the
 *  game continues at — the clock + weather simply carry on from here; nothing is restored at the exit.
 *
 *  W6 item 5 — SET ONCE PER INTRO. The clock keeps advancing during the descent/wake (updatePlayer
 *  runs the diurnal clock throughout the intro), so RE-setting dayTime at wake/stepOut would SNAP the
 *  sun BACKWARD (the "time jump / different instance" the user felt). So this establishes midday only
 *  the FIRST time it's called this intro (the descent on the live path; or the first ground beat on a
 *  dev jump that skipped the descent) — after that it's a NO-OP and the game's clock+weather simply
 *  CONTINUE from that state through the crash, wake, exit, and into gameplay. `_introMiddaySet` is
 *  reset at startEscapePodIntro so each new intro re-establishes it. */
let _introMiddaySet = false;
function setIntroMiddayClear(ctx: GameContext): void {
  if (_introMiddaySet) return;   // already established this intro — let the clock/weather continue (no backward snap)
  _introMiddaySet = true;
  ctx.time.dayTime = INTRO_MIDDAY_TIME;
  if (ctx.weather) {
    ctx.weather.intensity = 0;    // no sandstorm dust dimming the sky
    ctx.weather.cloudiness = 0;   // clear skies (normal gameplay weather resumes from here)
  }
}

/** W6 item 5 — blend the descent fog from the thin high-altitude value toward the game's SURVIVAL
 *  fog as the pod drops, so the crash/wake/exit are already at plain game fog (no hazing-over at
 *  step-out). updateWeather ran earlier THIS frame and wrote the survival density into fog.density;
 *  we read that as the target and blend from ALTITUDE_CLEAR_FOG toward it based on altitude: full
 *  thin above FOG_BLEND_ALT, easing to survival by the ground. Density only (updateLighting owns the
 *  warm fog COLOUR). Called every descent/parachute frame with the current altitude. */
function blendDescentFog(ctx: GameContext, altitude: number): void {
  const fog = ctx.three.scene.fog as { density?: number } | null;
  if (!fog || !('density' in fog) || fog.density == null) return;
  const survival = fog.density;   // updateWeather's survival target for this frame (the game's normal fog)
  // k = 0 high (above FOG_BLEND_ALT → full thin clear) → 1 at the ground (→ survival). Smoothstepped
  //   so the survival haze rolls in imperceptibly through the lower atmosphere, not a hard threshold.
  const kRaw = Math.max(0, Math.min(1, 1 - altitude / FOG_BLEND_ALT));
  const k = kRaw * kRaw * (3 - 2 * kRaw);
  fog.density = ALTITUDE_CLEAR_FOG + (survival - ALTITUDE_CLEAR_FOG) * k;
}

/** ONE-ENTERABLE-POD (user re-scope): the descent base whose FLOOR sits on the terrain at the real
 *  spawn (x,z). returnPos.y is the player CAPSULE CENTRE (≈ ground + halfHeight + radius); the pod's
 *  local origin is its FLOOR, so we drop the base by (halfHeight + radius) to seat the landed cabin
 *  floor ON the sand. Grounding the WHOLE descent (ride → land → wake → step-out) at this one base
 *  means the crashed cabin is walk-in-able at ground level from the moment it lands, and step-out's
 *  unify adds the exterior skin + colliders with NO vertical jump (the pod was already grounded). */
function groundedDescentBase(ctx: GameContext): { x: number; y: number; z: number } {
  const rp = ctx.intro!.returnPos;
  const gy = ctx.terrain?.heightAt ? ctx.terrain.heightAt(rp.x, rp.z) : rp.y;
  return { x: rp.x, y: gy, z: rp.z };   // floor on the sand (returnPos.y − (halfHeight+radius) ≈ gy at the spawn)
}

/** C18 (user walk-test: "black out briefly between each phase to make things feel smoother") —
 *  a DIP-TO-BLACK at the descent-chain transitions. advanceBeat cuts to black; the new beat
 *  HOLDS full black, then fades it in, so the camera/vista change happens hidden under the black.
 *  Applied only to descent + parachute (shipExplode has its own blast flash; impact/wake own the
 *  overlay). REBUILD v2 R4 — the user: "the blackouts just flash for a fraction of a second, make
 *  them a REAL blackout for at least 2 seconds." So the dip now HOLDS at full black for
 *  PHASE_FADE_HOLD, THEN fades in over PHASE_FADE_DUR — total ≈2.3 s of black per transition (not a
 *  flash). `_phaseFade` counts DOWN from (HOLD+DUR): while > DUR it's the hold (clamp to 1=full
 *  black); from DUR→0 it's the linear fade-in (value/DUR). */
let _phaseFade = 0;
const PHASE_FADE_HOLD = 1.2;   // seconds held at FULL black before the fade-in begins
const PHASE_FADE_DUR = 1.1;    // seconds to fade the black back out (1→0)
const PHASE_FADE_TOTAL = PHASE_FADE_HOLD + PHASE_FADE_DUR;
/** The black overlay opacity for the current _phaseFade countdown: full black through the hold,
 *  then a linear fade-out over the last PHASE_FADE_DUR seconds. */
function phaseFadeOpacity(remaining: number): number {
  if (remaining <= 0) return 0;
  if (remaining >= PHASE_FADE_DUR) return 1;   // still in the HOLD window — full black
  return remaining / PHASE_FADE_DUR;           // the fade-in (the world emerges from black)
}

/** Did the player "pull the lever" this frame (click or E)? */
function pulledLever(ctx: GameContext): boolean {
  return ctx.input.pressed.has('KeyE') || ctx.input.mousePressed.has(0);
}

/** B2 — did the player press E this frame (edge-triggered)? The boarding gates (open the door, sit)
 *  are E-ONLY per the user spec ("press E on it"); the eject/parachute pulls stay E-or-click. The
 *  smoke path synthesizes this by seeding ctx.input.pressed (see smokeTestIntro's E-driver). */
function pressedE(ctx: GameContext): boolean {
  return ctx.input.pressed.has('KeyE');
}

/** B2 — boarding-flow gaze/proximity gate. Is the player standing within `dist` of `target` (planar)
 *  AND looking roughly at it (camera-forward · dir-to-target ≥ `facing`)? Returns { near, look, ok }.
 *  Player-gated prompts show when `near`; the action fires on E while `ok`. Scratch vectors so this
 *  is allocation-free per frame. */
const _bfCamDir = new THREE.Vector3();
const _bfToTarget = new THREE.Vector3();
function gazeGate(ctx: GameContext, target: THREE.Vector3, dist: number, facing: number): { near: boolean; look: boolean; ok: boolean } {
  const cam = ctx.three.camera;
  const dx = target.x - cam.position.x, dz = target.z - cam.position.z;
  const planar = Math.hypot(dx, dz);
  const near = planar <= dist;
  cam.getWorldDirection(_bfCamDir); _bfCamDir.y = 0;
  if (_bfCamDir.lengthSq() < 1e-6) _bfCamDir.set(0, 0, -1);
  _bfCamDir.normalize();
  _bfToTarget.set(dx, 0, dz);
  if (_bfToTarget.lengthSq() < 1e-6) _bfToTarget.set(0, 0, -1);
  _bfToTarget.normalize();
  const look = _bfCamDir.dot(_bfToTarget) >= facing;
  return { near, look, ok: near && look };
}

/** Place the player capsule + camera at a world spawn, facing −Z, and snap the camera. */
function seatPlayerAt(ctx: GameContext, spawn: { x: number; y: number; z: number }): void {
  ctx.player.body.body.setTranslation(spawn, true);
  ctx.player.velocityY = 0;
  ctx.player.cameraSnapNextFrame = true;
  ctx.three.camera.position.set(spawn.x, spawn.y + ctx.player.eyeOffset, spawn.z);
  ctx.three.camera.rotation.set(0, 0, 0);   // face −Z
}

/** W6 item 1 — re-seat the player BODY at a world spawn WITHOUT touching the camera rotation, so
 *  the player's free-look orientation carries across the reseat (used by the wake: the player rode
 *  the descent free-looking; coming to inside the SAME crashed cabin must NOT snap their gaze — it's
 *  one continuous seated view, fades included). Position + eye height only; rotation left as-is. */
function seatBodyKeepLook(ctx: GameContext, spawn: { x: number; y: number; z: number }): void {
  ctx.player.body.body.setTranslation(spawn, true);
  ctx.player.velocityY = 0;
  ctx.player.cameraSnapNextFrame = true;
  ctx.three.camera.position.set(spawn.x, spawn.y + ctx.player.eyeOffset, spawn.z);
}

/** Ensure the player is seated in the (built) pod, mode seated. Idempotent — used by every
 *  pod beat so each is independently jumpable (a dev `jumpToBeat('descent')` builds the pod
 *  too, not just the real enterPod→… chain). */
function ensureInPod(ctx: GameContext): void {
  buildPodScene(ctx);
  setPodHidden(false);   // PERF: the preload may have parked the prebuilt cabin invisible — reveal it now the player sits inside
  seatPlayerAt(ctx, getPodSpawn(ctx));
  if (ctx.intro) ctx.intro.mode = 'seated';
}

/** Orient the seated camera toward a control (T1.3 beat-framing) — point the initial look
 *  at the control the current beat wants the player to operate, so each beat clearly shows
 *  ITS control (resolves the eject-vs-parachute confusion). Uses rotation.set (the proven
 *  seatPlayerAt method; lookAt fought the camera/up setup). Yaw about +Y: 0 faces −Z (the
 *  viewport), +π/2 faces −X (the eject, LEFT), −π/2 faces +X (the parachute lever, RIGHT).
 *  Free-look stays active afterwards. */
function faceControl(ctx: GameContext, yaw: number, pitch: number): void {
  // YXZ order = the FPS-correct yaw-then-pitch (matches PointerLockControls). With the
  // default XYZ order the pitch mis-applies after a 90° yaw (camera stares at the floor).
  ctx.three.camera.rotation.order = 'YXZ';
  ctx.three.camera.rotation.set(pitch, yaw, 0);
  ctx.player.cameraSnapNextFrame = true;
}

/** R1a — hide/restore the desert ATMOSPHERE (dust motes + ambient dust + the 3 weather dust
 *  layers) during the intro. They're camera-anchored, so in orbit/descent they read as junk
 *  floating in "vacuum"; restored at the desert handoff. Null-guarded (a system may be absent
 *  in a rig/headless run). */
function setIntroAtmosphereHidden(ctx: GameContext, hidden: boolean): void {
  const vis = !hidden;
  const layers = ctx.weather?.layers;
  if (layers) for (const k of ['near', 'mid', 'far'] as const) {
    const p = layers[k]?.particles; if (p) p.visible = vis;
  }
  const am = ctx.ambientDust?.particles; if (am) am.visible = vis;
  const dm = ctx.dustMotes?.particles; if (dm) dm.visible = vis;
}

/** The intro beats, in order (Beats 0-11 of the vision; `done` = handed off). */
export type BeatId =
  | 'cockpit'       // 0 — seated in the bridge; the planet below the window
  | 'checkEngines'  // 1 — console flashes "check engines"; get up + leave the bridge
  | 'corridor'      // 2 — walk the corridor; reaching the end triggers the disaster
  | 'enterPod'      // 3 — into the escape pod, sit, pull the eject lever
  | 'shipExplode'   // 4 — watch the ship explode through the viewport
  | 'descent'       // 5 — atmospheric entry + the beautiful fall (the showpiece)
  | 'parachute'     // 6 — the lever gag: 3 pulls → it snaps off; no chute
  | 'impact'        // 7 — crash into the desert + blackout
  | 'wake'          // 8 — come to; blow the pod door
  | 'stepOut'       // 9 — step into the desert (HANDOFF to the real game)
  | 'tutorial'      // 10 — pick up scrap → craft a machete → pry the pod's back panel
  | 'payoff'        // 11 — the parachute pops out the pod crown (the gag payoff)
  | 'done';         // intro complete; normal game running

/** Canonical beat order — the manager advances through this. */
export const BEAT_ORDER: readonly BeatId[] = [
  'cockpit', 'checkEngines', 'corridor', 'enterPod', 'shipExplode',
  'descent', 'parachute', 'impact', 'wake', 'stepOut', 'tutorial', 'payoff', 'done',
] as const;

/** How the player capsule + camera behave during the current beat. Per-beat
 *  controllers (T0.2+) set this; updatePlayer reads it to gate locomotion/look. */
export type IntroControlMode =
  | 'walk'      // free locomotion (WASD→KCC) + free look — the ship beats
  | 'seated'    // locomotion OFF, free look ON — inside the pod
  | 'scripted'; // locomotion OFF, look DRIVEN by the beat — pure cinematic moments

export interface IntroState {
  /** True while the intro owns the player/camera + suppresses normal gameplay. */
  active: boolean;
  /** The current beat. */
  beat: BeatId;
  /** ctx.time.elapsed when the current beat began (each beat owns its own timing). */
  beatStartedAt: number;
  /** Capsule/camera control mode for the current beat (T0.2+ set per beat). */
  mode: IntroControlMode;
  /** The desert position to hand back to — captured at startEscapePodIntro (the player is
   *  at the real new-game spawn at that point, before the intro teleports them to the ship).
   *  stepOut teleports the capsule here for the desert handoff (R3). */
  returnPos: { x: number; y: number; z: number };
  /** Per-beat scratch — added by later tiers (e.g. parachutePulls, doorBlown, the wake phase).
   *  Kept loose so beat controllers can stash transient state without growing this type. */
  scratch: Record<string, number | boolean | string>;
}

/** Does the intro currently own input / locomotion / gameplay gating? Cheap; call
 *  from any system that must stand down while the intro plays. */
export function introActive(ctx: GameContext): boolean {
  return ctx.intro?.active === true;
}

/** Begin the intro. Called from the new-game branch (T0.1) when FEATURES.escapePodIntro
 *  is on. Sets the state to beat 0; the per-beat controllers (placing the player in the
 *  ship cockpit, etc.) land in T0.2+. No-op if the flag is off, UNLESS `force` (the
 *  `__game.startIntro()` dev hook passes force so the intro is testable without flipping
 *  the build flag). */
export function startEscapePodIntro(ctx: GameContext, force = false): void {
  if (!force && !FEATURES.escapePodIntro) return;
  // Capture the desert spawn NOW — setupOpeningScene placed the player there at boot, and
  // we're about to teleport them to the ship; stepOut hands back to this position (R3).
  _introMiddaySet = false;   // W6 item 5 — a fresh intro re-establishes midday-clear on its first setIntroMiddayClear (then the clock continues)
  ensureAudioStarted();   // T5.1 — the intro starts on a new-game click; make the audio ctx ready for the beat SFX
  const t = ctx.player.body.body.translation();
  ctx.intro = {
    active: true,
    beat: 'cockpit',
    beatStartedAt: ctx.time.elapsed,
    mode: 'scripted',
    returnPos: { x: t.x, y: t.y, z: t.z },
    scratch: {},
  };
  // Suppress the game HUD up front (decoupled from any single beat) so ANY entry path —
  // new game, the force-start dev hook, or a jumpToBeat past cockpit — gets a clean intro
  // view. handoffToGame re-asserts this after it un-hides the in-game HUD; endEscapePodIntro
  // restores it.
  setGameHudHidden(true);
  // C2 (user, 2026-07-02) — "remove the wind and music audio when we're on the ship — the
  //   intro should have its own audio." Silence the normal DESERT soundscape (procedural
  //   wind) + the game MUSIC up front, for ANY entry path (like the HUD hide). The intro's
  //   own audio (cockpit hum / klaxon / startMusicEscape/Descent/Desert) is unaffected — it
  //   feeds the same ambient bus but through its own loops/one-shots, not these two systems.
  //   endEscapePodIntro restores both at the desert handoff (the intro's own desert-wind cue
  //   hands off to the game's live soundscape there — no double-wind).
  setSoundscapeSuppressed(true);
  setMusicSuppressed(true);
}

/** Jump straight to a beat (the per-beat controllers call this to advance; the dev
 *  `__game.jumpToBeat` hook uses it for fast iteration). `done` ends the intro. */
export function jumpToBeat(ctx: GameContext, beat: BeatId): void {
  if (!ctx.intro) return;
  if (beat === 'done') { endEscapePodIntro(ctx); return; }
  // GLOBAL-STATE-RESTORE guard: the impact/wake beats LIFT the global renderer exposure
  // (setCabinCrashPose 1.05 → 2.0) so the enclosed crashed dawn cabin reads. In normal play
  // beats only advance forward and the exposure is restored at teardown (disposePodScene, via
  // stepOut / endEscapePodIntro). But a dev `jumpToBeat` OUT of a crash beat to an earlier beat
  // (wake → cockpit) does NOT tear down the pod, so the 2.0 exposure would LEAK and render the
  // orbit/desert washed out. Restore the base whenever we're not landing on a lifting beat.
  if (beat !== 'impact' && beat !== 'wake') restoreCabinExposure(ctx);
  ctx.intro.beat = beat;
  ctx.intro.beatStartedAt = ctx.time.elapsed;
  ctx.intro.scratch = {};
}

/** Advance to the next beat in BEAT_ORDER (a beat's trigger calls this when done). */
export function advanceBeat(ctx: GameContext): void {
  if (!ctx.intro) return;
  const i = BEAT_ORDER.indexOf(ctx.intro.beat);
  const next = i >= 0 && i + 1 < BEAT_ORDER.length ? BEAT_ORDER[i + 1] : 'done';
  _phaseFade = PHASE_FADE_TOTAL;   // R4 — cut to FULL black, HOLD, then the new beat fades it in (a REAL ~2 s blackout, not a flash)
  jumpToBeat(ctx, next);
}

/** End the intro + hand control back to the normal game. Restores the game HUD, hides
 *  the beat prompt, tears down the greybox ship. T0.4 will teleport the player to the
 *  desert spawn + mark `introComplete`; for now this clears the flag + cleans up. */
export function endEscapePodIntro(ctx: GameContext): void {
  if (!ctx.intro) return;
  ctx.intro.active = false;
  ctx.intro.beat = 'done';
  hideIntroPrompt();
  _phaseFade = 0;
  setIntroBlack(0);        // never leave a black overlay over the real game
  setGameHudHidden(false);
  disposeShipScene(ctx);
  disposeHaulerExterior(ctx);   // Phase 3 — the exterior hauler + its explosion FX (belt-and-suspenders: never leak past the intro on any exit)
  // ONE-ENTERABLE-POD (user re-scope): if the pod was UNIFIED into the persistent walk-in structure
  //   at step-out, it is now a REAL-WORLD object (the SAME pod you rode down + can walk back into) —
  //   do NOT dispose it. It stays in the game behind the flag. Only tear the pod down on the OTHER
  //   exit paths (skipIntro / quit / a dev jump-away before step-out), where it's still the intro
  //   prop. (restoreCabinExposure re-asserts the desert-base exposure either way — unify already set it;
  //   the crash/wake never lifted it, so this is a defensive no-op on the step-out path — W6 item 5.)
  // W6 item 5 — NO fog ease-back is armed here: the fog was already normalized to the survival
  //   density during the fall (blendDescentFog), so the world is bit-stable across the exit — nothing
  //   to roll back in. (The old clear→survival ease is gone with the ground-level clear pin.)
  if (podIsEnterable()) {
    restoreCabinExposure(ctx);
  } else disposePodScene(ctx);
  stopAllIntroLoops();       // T5.1b — stop any ambient loop (cockpit hum / descent rush) on any exit
  // C2 — RESTORE the normal game soundscape + music (they were suppressed at startEscapePodIntro).
  //   This is the single exit path EVERY path reaches (stepOut handoff, skipIntro, quit, a dev
  //   jump to 'done'), so the desert wind + game music can never leak-stay-muted. The intro's own
  //   desert-wind cue (startDesertWind) was just stopped by stopAllIntroLoops above, so the live
  //   game wind bed rolls in cleanly in its place (no double-wind). Smooth ramps → no pop.
  setSoundscapeSuppressed(false);
  setMusicSuppressed(false);
  setSkyIntroMode(0);                  // R1a — restore the normal game sky on any exit
  setIntroAtmosphereHidden(ctx, false); // R1a — restore the desert atmosphere on any exit
}

/** Cockpit beat (T0.2a/b) — on first entry, build the greybox ship, hide the game HUD,
 *  drop the capsule into the bridge facing the window, SEATED (look-only). After a short
 *  dwell looking at the planet, advance to checkEngines (which hands control + cues the
 *  player aft). */
function tickCockpit(ctx: GameContext, dt: number): void {
  const intro = ctx.intro;
  if (!intro) return;
  if (!intro.scratch.shipBuilt) {
    buildShipScene(ctx);
    seatPlayerAt(ctx, getShipSpawn(ctx));
    startCockpitHum();                          // T5.1b — the calm in-orbit ambient bed (until eject)
    setSkyIntroMode(1);                         // R1a — the REAL sky in space mode (wrapping stars + planet through the window)
    setPlanetApproach(0);                       // C3 — the cockpit shows the ORBIT-FRAMED distant disc (the descent's planet-approach grow is DESCENT-only). Self-heals a dev jumpToBeat BACK to cockpit after a mid-descent grow (else the scaled+dropped planet would balloon in the orbit view — _planetApproach only auto-resets when space mode is FULLY off, but the cockpit re-engages space mode at 1). Real forward flow: this is already 0, a harmless no-op.
    setIntroAtmosphereHidden(ctx, true);        // R1a — no desert dust floating in orbit
    // OPENING VISTA FRAMING (R5b): the seated pilot opens looking OUT at the orbit — not dead-level
    // −Z (which put the planet low + half-behind the console), but a hair RIGHT + UP so the planet's
    // curved disc sits in the clear upper-right pane with the black + the starfield filling the
    // window around it (a "we're in orbit above a world" read, not "a wall behind the glass"). The
    // planet sits at world dir (0.30,0.10,−1); this look lands it framed. Free-look stays active —
    // this only sets the INITIAL gaze. (yaw − = look right toward +X; pitch + = look up.)
    faceControl(ctx, -0.09, -0.03);
    intro.mode = 'seated';                      // open seated, looking at the planet
    intro.scratch.shipBuilt = true;
    intro.scratch.dwell = 0;
  }
  intro.scratch.dwell = (intro.scratch.dwell as number) + dt;
  if ((intro.scratch.dwell as number) > COCKPIT_DWELL) advanceBeat(ctx);   // → checkEngines
}

/** checkEngines beat — hand control (walk), cue the player to the engine bay, advance
 *  once they step into the corridor. */
function tickCheckEngines(ctx: GameContext): void {
  const intro = ctx.intro;
  if (!intro) return;
  if (!intro.scratch.init) {
    intro.mode = 'walk';
    setCockpitAlert(1);   // E2 escalation — the bridge console flips ORBIT ACHIEVED → CORE TEMP CRITICAL (the diegetic reason to check)
    showIntroPrompt('CORE TEMP CRITICAL — check the engines (aft)');
    intro.scratch.init = true;
  }
  if (ctx.player.body.body.translation().z > SHIP_CORRIDOR_ENTER_Z) advanceBeat(ctx);   // → corridor
}

/** corridor beat (T3.4 disaster staging) — walk aft to the engine bay (the dead-end). Reaching
 *  it TRIGGERS THE DISASTER: the engine bay erupts in fire, the ship floods red-alert (the
 *  console hits HULL BREACH), a one-time concussive jolt + flash + the cue flips to "GET TO THE
 *  ESCAPE POD!". The player then FLEES forward back down the burning corridor; reaching the
 *  bridge (crossing back past ENTER_Z) → enterPod. (Greybox corridor + greybox fire — the hero
 *  corridor geometry + smoke/particles are deferred to the user's art-direction pass.) */
function tickCorridor(ctx: GameContext, dt: number): void {
  const intro = ctx.intro;
  if (!intro) return;
  if (!intro.scratch.init) {
    hideIntroPrompt();
    intro.scratch.init = true;
    intro.scratch.disaster = false;
    intro.scratch.t = 0;
  }
  const z = ctx.player.body.body.translation().z;
  if (!intro.scratch.disaster) {
    // walking aft, drawn toward the engine bay; reaching the dead-end triggers the disaster
    if (z > SHIP_DEAD_END_Z) {
      intro.scratch.disaster = true;
      intro.scratch.t = 0;
      setEngineFire(1, 0);          // the bay ERUPTS in fire
      setShipAlert(2, 1);           // the corridor floods red-alert (full pulse)
      setCockpitAlert(2);           // E2 escalation — the bridge console hits HULL BREACH (seen if you glance back)
      flashScreen(0xffd0a0, 0.55);  // the blast flash
      addTrauma(0.55);              // a ONE-TIME concussive jolt (one-shot — never per-frame, which would saturate/spin the view)
      playExplosionBoom();          // T5.1 — the engine blast
      playHullGroan();             // T5.1 — the ship groans, dying
      playKlaxon();                // T5.1 — the red-alert alarm
      startEngineFire();           // T5.3 — the crackling engine-bay BLAZE roars (a bed under the alarm; stopped on eject)
      startMusicEscape();          // T5.2 — the tense escape sting kicks in
      showIntroPrompt('ENGINE FIRE — GET TO THE ESCAPE POD!');
    }
    return;
  }
  // the disaster is underway — flicker the fire + strobe the red-alert; the player FLEES forward.
  intro.scratch.t = (intro.scratch.t as number) + dt;
  const t = intro.scratch.t as number;
  setEngineFire(1, t);
  const strobe = 0.5 + 0.5 * Math.sin(t * 11.0);
  setShipAlert(2, strobe);                           // a fast red strobe (corridor)
  setCockpitAlert(2, strobe);                        // the cockpit beacon pulses with the same strobe
  // X3 (user walk-test 2026-07-04): arm the boarding when the fleeing player REACHES THE BAY,
  // not only after over-running all the way back to the bridge — they were forced to detour to
  // the cockpit (crossing ENTER_Z) before the pod door would respond. The bay airlock sits at
  // the pod-bay threshold's z; a ~2.6m reach covers arriving from the engine-room side.
  if (z < getPodBayThreshold().z + 2.6) advanceBeat(ctx);   // reached the bay (or beyond) → enterPod
}

/** R5c — enterPod is now a PHYSICAL entry, NO teleport. The player fled to the bridge end + the
 *  DOCKED pod sits in its bay there (shipScene buildPodBay), hatch open. Phases:
 *   • walkUp  — free-walk the last steps up to the open hatch (cue "Get in the escape pod").
 *   • climbIn — a ~1.4s SCRIPTED continuous first-person move that carries the eye from the hatch
 *               threshold INTO the pod seat (no blink/teleport — the whole point). Locomotion off.
 *   • seal    — the hatch SEALS behind them (a thunk + a brief dim as the door closes over the eye);
 *               under that dim we swap the bay-pod peek for the REAL ridden cabin (buildPodScene) +
 *               seat the player, so the cabin they're now inside IS the one they ride down (R3a).
 *   • cue     — "pull the eject lever". Pull (E/click) or the fallback dwell → shipExplode.
 *  Anti-softlock: a fallback auto-advances walkUp→climbIn, and the eject fallback stays. */
// ── B2 — THE PLAYER-GATED BOARDING FLOW (the user's #1 requested interaction, 2026-07-02):
//    "the pod door should be closed, you press E on it to open, you physically walk inside YOURSELF,
//     press E on the seat to sit, press E on the lever to eject — NOTHING automatic; it waits until
//     the player actually does all of these things." Every progression step is gated on real player
//    action; the ONLY scripted assist is the E-SIT snap-to-seat (natural) + the consequent auto-seal
//    (the door closing behind you IS the launch prep, per the user). No timeouts, no auto-eject.
//
//    Phases (W2b — the bay is now an AIRLOCK: sliding blast-door → gasketed collar → the pod's own
//    door, the pod docked mostly OUTSIDE the hull): airlock (free-walk; E-open the sliding door) →
//    collar (leaves slide open; walk the short collar) → approach (E-open the pod's closed door) →
//    enter (door swings open; the player WALKS IN themselves through the door into the bore — real
//    KCC, no scripted carry) → atSeat (E to sit) → sealing (seat snap under a brief dim; BOTH doors
//    AUTO-SEAL shut as launch prep) → rotate (Y-queue: the pod grinds 180° in its cradle, player +
//    camera riding the turn — the porthole swings to open space) → eject (E/click, no fallback) →
//    ejectPull (the handle VISIBLY drags down ~0.35s, then the bolts fire).
const ENTER_DOOR_OPEN_DUR = 0.75;    // seconds the door swings open on E (0→1)
const ENTER_SEAL_DUR = 0.9;          // seconds the seal dim + model swap + door auto-close play over
const ENTER_ROTATE_DUR = 3.4;        // seconds the sealed pod grinds 180° in its cradle (porthole → space)
const EJECT_PULL_DUR = 0.35;         // seconds the eject handle visibly drags down before the bolts fire
const ENTER_DOOR_GAZE_DIST = 3.2;    // within this (planar, m) of the door + looking at it → the E-open prompt
const ENTER_DOOR_GAZE_FACING = 0.55; // camera-forward · dir-to-door ≥ this (≈57°) counts as "looking at the door"
const ENTER_INSIDE_DIST = 1.05;      // within this (planar, m) of the bore-stand point → "the player is INSIDE"
const ENTER_SEAT_GAZE_DIST = 1.6;    // within this of the seat + looking in → the E-sit prompt
const ENTER_SEAT_GAZE_FACING = 0.2;  // a loose facing gate for the seat (they're right on top of it inside the bore)
function tickEnterPod(ctx: GameContext, dt: number): void {
  const intro = ctx.intro;
  if (!intro) return;
  if (!intro.scratch.init) {
    intro.scratch.init = true;
    intro.scratch.phase = 'airlock';   // W2b — the boarding now starts at the SLIDING airlock door
    intro.scratch.doorT = 0;           // the pod-door-open animation param (0=closed → 1=open)
    intro.scratch.airlockT = 0;        // the sliding-door animation param (0=closed → 1=open)
    intro.scratch.t = 0;
    intro.mode = 'walk';               // free-walk the last steps to the closed airlock door
    setBayAirlockDoor(0);              // the sliding door starts CLOSED (its seal collider blocks)
    setBayPodDoorOpen(0);              // the pod's own door starts CLOSED (the user spec)
    // the klaxon/alert cue keeps pointing the fleeing player at the pod until they're at the door.
    showIntroPrompt('GET TO THE ESCAPE POD');
  }
  intro.scratch.t = (intro.scratch.t as number) + dt;
  // X3 (user walk-test 2026-07-04): the red-alert must KEEP FLASHING through the whole boarding —
  // the corridor beat's strobe froze mid-pulse on advance. Strobe here until the launch fires
  // (shipExplode then owns the staging). Dedicated scratch key — per-phase code resets scratch.t.
  intro.scratch.alertT = ((intro.scratch.alertT as number) ?? 0) + dt;
  const alertStrobe = 0.5 + 0.5 * Math.sin((intro.scratch.alertT as number) * 11.0);
  setShipAlert(2, alertStrobe);
  setCockpitAlert(2, alertStrobe);
  const phase = intro.scratch.phase as string;

  // ── PHASE airlock (W2b) — free-walk up to the CLOSED sliding blast-door; a gaze/proximity prompt
  //    to E-open it. Same player-gated contract as the pod door: only opens on the player's E.
  if (phase === 'airlock') {
    const door = getBayAirlockDoorWorld();
    const g = gazeGate(ctx, door, ENTER_DOOR_GAZE_DIST, ENTER_DOOR_GAZE_FACING);
    showIntroPrompt(g.near ? 'Open the airlock  [E]' : 'GET TO THE ESCAPE POD');
    if (g.ok && pressedE(ctx)) {
      playDoorBlow();                  // the door mechanism THUNKS + the leaves start to slide
      intro.scratch.phase = 'collar';
      intro.scratch.airlockT = 0;
      showIntroPrompt('');
    }
    return;
  }

  // ── PHASE collar (W2b) — the sliding leaves part (animated; the seal collider clears past ~62%);
  //    once open, the player walks the short gasketed collar to the pod's own closed door → 'approach'.
  if (phase === 'collar') {
    intro.scratch.airlockT = Math.min(1, (intro.scratch.airlockT as number) + dt / ENTER_DOOR_OPEN_DUR);
    setBayAirlockDoor(intro.scratch.airlockT as number);
    if ((intro.scratch.airlockT as number) >= 1) intro.scratch.phase = 'approach';
    return;
  }

  // ── PHASE approach — through the collar to the pod's CLOSED door; a gaze/proximity prompt to
  //    E-open it. The door does NOT open on its own — only on the player's E press while looking at it.
  if (phase === 'approach') {
    const door = getPodBayDoorWorld();
    const g = gazeGate(ctx, door, ENTER_DOOR_GAZE_DIST, ENTER_DOOR_GAZE_FACING);
    showIntroPrompt(g.near ? 'Open the pod  [E]' : 'GET TO THE ESCAPE POD');
    if (g.ok && pressedE(ctx)) {
      playDoorBlow();                  // the door mechanism THUNKS + starts to swing (reuse the door SFX)
      intro.scratch.phase = 'enter';
      intro.scratch.doorT = 0;
      showIntroPrompt('');
    }
    return;
  }

  // ── PHASE enter — the door swings OPEN (animated); then the player physically WALKS IN themselves
  //    (real KCC — mode stays 'walk', no scripted carry). The bore has a walkable floor + a hull ring
  //    gapped at the door (shipScene _addBayPodColliders), so they walk through the door into the pod.
  if (phase === 'enter') {
    intro.scratch.doorT = Math.min(1, (intro.scratch.doorT as number) + dt / ENTER_DOOR_OPEN_DUR);
    setBayPodDoorOpen(intro.scratch.doorT as number);   // swing 0→1 (~110°)
    if ((intro.scratch.doorT as number) >= 1) showIntroPrompt('Step inside');   // cue the walk-in once it's open
    // are they physically INSIDE the bore now? (planar distance from the interior stand-point).
    const stand = getPodBayInteriorStand();
    const tr = ctx.player.body.body.translation();
    const dx = tr.x - stand.x, dz = tr.z - stand.z;
    if ((dx * dx + dz * dz) < ENTER_INSIDE_DIST * ENTER_INSIDE_DIST) {
      intro.scratch.phase = 'atSeat';
      showIntroPrompt('');
    }
    return;
  }

  // ── PHASE atSeat — inside the pod; an E-SIT gate (looking toward the seat). On E, the ONE scripted
  //    assist: snap to the seated pose + swap to the ridden cabin under a seal dim + AUTO-SEAL the door.
  if (phase === 'atSeat') {
    const seat = getPodBaySeatedEye();
    const g = gazeGate(ctx, seat, ENTER_SEAT_GAZE_DIST, ENTER_SEAT_GAZE_FACING);
    showIntroPrompt(g.near ? 'Sit  [E]' : 'Step to the seat');
    // Y3 (user walk-test 2026-07-04): E-to-sit failed on first presses. Root cause: the sit
    // required the FACING test too, and dir-to-target degenerates when standing basically ON
    // the seat point — any look direction could fail it. Proximity alone gates the sit now:
    // inside the pod near the seat + E = sit, first press, every time.
    if (g.near && pressedE(ctx)) {
      intro.scratch.phase = 'sealing';
      intro.scratch.t = 0;
      intro.mode = 'scripted';         // locomotion off from here (they're being seated + sealed)
      playHatchSeal();                 // the pressure HISS as the door seals behind them (launch prep)
      addTrauma(0.2);                  // a one-time clunk as it seals
      showIntroPrompt('');
    }
    return;
  }

  // ── PHASE sealing — the seat snap + the model swap (bay pod → the REAL ridden cabin) + the door
  //    AUTO-SEALS shut behind them, all under a brief seal dim (the door closing over the eye is the
  //    correct launch-prep staging — the "nothing automatic" gate is on PROGRESSION [open/sit/eject];
  //    the seal is the consequence of sitting). Then → eject (player-gated, no fallback).
  if (phase === 'sealing') {
    const k = Math.min(1, (intro.scratch.t as number) / ENTER_SEAL_DUR);
    setBayPodDoorOpen(1 - k);          // the door swings SHUT (auto-seal) as the dim covers the swap
    setBayAirlockDoor(1 - k);          // W2b — the airlock sliding door reseals behind them too (launch prep)
    // a quick dip: dark in (0→0.5), then hold+lift as the cabin lights read (0.5→1).
    const dim = k < 0.5 ? (k / 0.5) : Math.max(0, 1 - (k - 0.5) / 0.5);
    setIntroBlack(dim * 0.9);
    if (!intro.scratch.swapped && k >= 0.5) {
      // X3b (user answer 2026-07-04: BAY UNTIL EJECT) — NO model swap here anymore. The player is
      // seated in the BAY pod itself (X2a made it the real cabin, byte-identical) and stays IN THE
      // SHIP until the eject actually fires; the swap to the offset ride frame now happens in
      // tickShipExplode under the eject blast. Seat at the bay pod's seat (eye export → body y).
      const eye = getPodBaySeatedEye();
      seatPlayerAt(ctx, { x: eye.x, y: eye.y - ctx.player.eyeOffset, z: eye.z });
      // Frame CENTRED on the YELLOW eject control ("Pull the eject lever" points at it). The bay
      // pod's unified interior is yawed −π/2 (cabin −Z door → bay +X), so the ride frame's proven
      // yaw 1.20 becomes 1.20 − π/2 here (same control, bay frame).
      faceControl(ctx, 1.20 - Math.PI / 2, -0.20);
      intro.scratch.swapped = true;
    }
    if (k >= 1) {
      setIntroBlack(0);
      // Y-queue (user answer: AUTO 180° ON SEAL) — sealed in, the pod now mechanically ROTATES in
      // its docking cradle so the porthole swings from the airlock to OPEN SPACE. The player (and
      // camera) ride the rotation; then the eject prompt.
      intro.scratch.phase = 'rotate';
      intro.scratch.t = 0;
      intro.scratch.rotPrev = 0;
      intro.mode = 'seated';           // free-look, locomotion off — seated + sealed, riding the turn
      playHullGroan();                 // the cradle motors grind the capsule around
      addTrauma(0.12);                 // the engage clunk
    }
    return;
  }

  // ── PHASE rotate (Y-queue) — the pod turns 180° in its cradle, the player inside: the pod root
  //    yaws via setBayPodYaw while the seated body + camera ORBIT the pod's own axis in lockstep,
  //    so the cabin stays fixed around the player and the porthole view sweeps airlock → stars.
  if (phase === 'rotate') {
    const k = Math.min(1, (intro.scratch.t as number) / ENTER_ROTATE_DUR);
    const e = k * k * (3 - 2 * k);                      // smoothstep — heavy machinery ease
    const yaw = e * Math.PI;
    const delta = yaw - (intro.scratch.rotPrev as number);
    intro.scratch.rotPrev = yaw;
    setBayPodYaw(yaw);
    // ride the turn: rotate the body + camera about the pod's vertical axis by this frame's delta.
    const c = getBayPodCenter();
    const tr = ctx.player.body.body.translation();
    const rx = tr.x - c.x, rz = tr.z - c.z;
    const cos = Math.cos(delta), sin = Math.sin(delta);
    // three.js yaw is CCW about +Y looking down −Y; rotate the offset with the same handedness.
    const nx = c.x + rx * cos + rz * sin;
    const nz = c.z - rx * sin + rz * cos;
    ctx.player.body.body.setTranslation({ x: nx, y: tr.y, z: nz }, true);
    ctx.three.camera.position.set(nx, tr.y + ctx.player.eyeOffset, nz);
    ctx.three.camera.rotation.order = 'YXZ';
    ctx.three.camera.rotation.y += delta;               // the look rides the turn (free-look preserved)
    if (k >= 1) {
      playDoorBlow();                  // the cradle latches at launch attitude (a heavy clunk)
      addTrauma(0.1);
      intro.scratch.phase = 'eject';
      intro.scratch.t = 0;
      showIntroPrompt('Pull the eject lever  [E / click]');
    }
    return;
  }

  // ── PHASE eject — seated in the SEALED pod, porthole to the stars; pull the eject lever. PURELY
  //    PLAYER-GATED (E or click) — no fallback. The pull VISIBLY drags the handle down (Y7 pivot)
  //    over ~0.35s and THEN the eject fires.
  if (phase === 'eject') {
    if (pulledLever(ctx)) {
      playLeverClick();
      intro.scratch.phase = 'ejectPull';
      intro.scratch.t = 0;
      showIntroPrompt('');
    }
    return;
  }
  if (phase === 'ejectPull') {
    const k = Math.min(1, (intro.scratch.t as number) / EJECT_PULL_DUR);
    setEjectLeverPull(k * k);          // ease-in — the yank commits
    if (k >= 1) advanceBeat(ctx);      // → shipExplode (the bolts fire on the fully-pulled handle)
    return;
  }
}

/** shipExplode beat (T0.3a → Phase 3 T3.2) — eject fires; the docked pod tears free; the pod is
 *  flung clear facing the window; then THE PLAYER WATCHES THEIR HAULER DIE through the porthole —
 *  the vision's climactic beat. A white-hot flash → a blooming fireball → the hull breaking into
 *  tumbling debris → a shockwave → sparks → a receding burning husk, the cabin flooded by the
 *  blast light — settling into the slow serene descent. C18 (user walk-test): NO POD TUMBLE — the
 *  pod stays UPRIGHT + LEVEL facing the window; the SHIP tumbles/breaks, the pod holds + watches.
 *
 *  W6 item 2 (user, 2026-07-03: "there seem to be 2 different views of the ship — just have ONE
 *  where we're getting further away while it explodes"). The old depart→fade→re-framed-explosion
 *  is MERGED into ONE unbroken shot:
 *  Phases: release (bolts fire, pod tears from the cradle) → recede (the pod pulls AWAY continuously
 *  AND the ship EXPLODES mid-recession — no fade, no re-frame: tear free → drift away → it blows at
 *  ~40 m out → the burning husk keeps receding) → husk (a breath on the receding husk) → the descent.
 *  The hauler + its FX DISPOSE at the hand-off (they never leak into the fall).
 *
 *  The recession (setHaulerDeparture) runs the WHOLE recede phase; the detonation (setHaulerExplosion)
 *  fires at SHIP_BLAST_AT seconds in, when the ship has drifted to a good read distance — so the blast
 *  reads with the husk still receding, one continuous camera-static shot (the pod holds LEVEL, C18). */
const EJECT_RELEASE_DUR = 0.7;   // R5c — seconds of the physical detach (bolts fire + the pod tears from the bay cradle) before the blast
function tickShipExplode(ctx: GameContext, dt: number): void {
  const intro = ctx.intro;
  if (!intro) return;
  if (!intro.scratch.init) {
    // ── PHASE A: the PHYSICAL RELEASE (R5c). The explosive bolts fire + the docked pod TEARS FREE
    //    of its bay cradle — the interior ship is still here so the detach reads (a shudder + the
    //    clamps releasing). The player, sealed in the cabin, FEELS it (a rising shudder + bay glow).
    playBoltShear();                 // T5.3 — the explosive bolts SHEAR (a sharp bright crack + tearing metal), layered before the heave
    playEjectThunk();                // T5.1 — the pneumatic eject heave under the shear (the pod fires clear)
    // X3b/Y-queue — the player is still seated in the BAY pod (bay-until-eject), and the rotate
    // beat just turned the pod 180° with the camera riding the turn — their free-look is already
    // on the door/porthole. NO snap here (W6 free-look discipline); the swap to the offset ride
    // frame (door at −Z, yaw 0) happens at the release end, under the flash, via ensureInPod.
    intro.mode = 'seated';
    intro.scratch.init = true;
    intro.scratch.phase = 'release';
    intro.scratch.dwell = 0;
    intro.scratch.reFlash = false;   // the one-shot detonation flash/boom hasn't fired yet
    intro.scratch.sec2 = false;      // one-shot secondary-blast flash (mid-explosion punch)
    intro.scratch.built = false;
  }
  intro.scratch.dwell = (intro.scratch.dwell as number) + dt;
  const d = intro.scratch.dwell as number;
  const phase = intro.scratch.phase as string;

  if (phase === 'release') {
    // the pod shudders + tears from the cradle (drives the bay-pod detach in shipScene) + a rising
    //   felt shudder in the sealed cabin. Trauma is ONE-SHOT per step-up so it can't saturate/spin.
    const rk = Math.min(1, d / EJECT_RELEASE_DUR);
    releasePodFromBay(rk);           // the physical detach in the bay (bolts fire, cradle releases, pod tears free)
    // 1h (user live-test): NO pre-blast wash — the release is mechanical (bolts + shudder); the
    // hot flood belongs to the DETONATION later. A whisper of rising glow only (the quadratic
    // source curve keeps this near-invisible); the old 0.3-0.5 read "bright and weird" pre-blast.
    setTumbleLight(rk * 0.1);
    // X3b — the player RIDES the bay pod through the release now; the dying ship's red-alert keeps
    // strobing outside the porthole until the ship is disposed (no frozen mid-pulse light).
    setShipAlert(2, 0.5 + 0.5 * Math.sin(d * 11.0));
    if (rk >= 1) {
      // X3b — THE SWAP, under the eject blast: a hot flash covers relocating the seated player from
      // the bay pod (ship frame, door +X) into the offset ride cabin (door −Z). Same cabin (X2a),
      // same door in view before/after — the flash + 90° reframe read as the pod being FLUNG clear.
      flashScreen(0xffd9b0, 0.5);
      ensureInPod(ctx);              // build/reveal the ride cabin + seat the player (faces −Z = the door)
    }
    if (rk >= 1) {
      // ── PHASE B: the pod is CLEAR — dispose the interior ship (+ bay), show the ORBITAL VISTA
      //    (planet + stars) through the window, and stage the HERO HAULER out in that view (−Z,
      //    offset to one side of the planet), INTACT, so the player sees what they just fled.
      stopCockpitHum();              // T5.1b — the ship's hum dies with it
      stopEngineFire();              // T5.3 — the engine blaze is left behind with the ship (the pod is clear + sealed)
      disposeShipScene(ctx);         // the interior ship (+ the emptied bay) is gone — the exterior hauler is the NEW separate thing
      setDescentProgress(0);         // the orbital vista (planet + stars) through the window
      // PERF: the preload already BUILT the hauler + compiled its FX (parked invisible). REVEAL
      //   it here (no cold build/compile freeze); the fallback build-on-entry stays for the
      //   dev/jumpToBeat path (no preload ran → haulerBuilt() false → build it cold as before).
      if (haulerBuilt()) setHaulerHidden(false);
      else buildHaulerExterior(ctx); // T3.1 — the worn freighter floats out in space ahead (−Z), about to die
      setHaulerExplosion(0);         // intact (ember idle) — the "that's my ship" beat
      setHaulerDeparture(0);         // start at the framed hero pose; the recede phase eases it out (recedes) the whole shot
      showIntroPrompt('');
      addTrauma(0.2);                // a small kick as the pod is flung clear (one-shot, decays)
      intro.scratch.built = true;
      intro.scratch.phase = 'recede';   // W6 item 2 — ONE continuous shot: recede + explode (no fade, no re-frame)
      intro.scratch.dwell = 0;
    }
    return;
  }

  // ── W6 item 2 — PHASE recede — ONE continuous shot: the pod pulls AWAY from the ship the WHOLE
  //    time (setHaulerDeparture runs 0→1 across SHIP_RECEDE_DUR), and the ship EXPLODES mid-recession
  //    (setHaulerExplosion fires at SHIP_BLAST_AT, once the ship has drifted to ~40 m out). NO fade,
  //    NO re-frame — the camera holds LEVEL facing the window (C18) and the player watches the ship
  //    recede → blow → the burning husk keep receding, all in one unbroken exterior view. The
  //    detonation punch + the mid-blast secondary + the cabin blast-flash are one-shots along the way.
  if (phase === 'recede') {
    // the ship recedes continuously the whole phase (drift/shrink in the porthole) — never reset.
    setHaulerDeparture(Math.min(1, d / SHIP_RECEDE_DUR));
    // the detonation fires mid-recession; before it, the intact ship is watched receding (bay glow decays).
    if (d < SHIP_BLAST_AT) {
      setTumbleLight(0.1 * Math.max(0, 1 - d / 0.9));   // 1h: continuous with the release's 0.1 peak — no brightness jump at the swap; decays to the orbital cool
      return;
    }
    // ── THE EXPLOSION, unfolding DURING the recession. te 0→1 over SHIP_EXPLODE_DUR from the blast time.
    const de = d - SHIP_BLAST_AT;
    const te = Math.min(1, de / SHIP_EXPLODE_DUR);
    setHaulerExplosion(te);   // the fireball/breakup rides the receding husk (haulerScene FX follow the departing group)
    // the detonation punch (one-shot at te≈0): a bright warm screen flash + the boom + a single kick.
    if (!intro.scratch.reFlash && te > 0.0) {
      flashScreen(0xfff0d8, 1.0);    // the blinding detonation flash (the ship dies)
      playExplosionBoom();           // T5.1 — the ship explodes (the concussive boom, felt through the hull)
      playShipDeathRoar();           // T5.3 — the sustained roar + tearing-sub + debris-groan tail UNDER the boom
      addTrauma(0.5);                // a ONE-TIME concussive kick (one-shot — never per-frame, which would spin the view)
      intro.scratch.reFlash = true;
    }
    // a mid-explosion SECONDARY blast punch (one-shot ~te0.4) — a fuel cell / magazine cooks off.
    if (!intro.scratch.sec2 && te > 0.4) {
      flashScreen(0xffcaa0, 0.45);
      playExplosionBoom();
      addTrauma(0.25);
      intro.scratch.sec2 = true;
    }
    // CABIN FLASH — the blast floods the cabin hot blast-orange (setTumbleLight), a sharp pulse at
    //   the detonation decaying through the fireball to the orbital cool (C18: light only, no tumble).
    setTumbleLight(Math.max(0, 1 - te / 0.55));   // 1 at detonation → 0 by mid-explosion
    // advance once the ship has fully receded AND the explosion has finished (both complete = husk).
    if (te >= 1 && d >= SHIP_RECEDE_DUR) {
      intro.scratch.phase = 'husk';
      intro.scratch.dwell = 0;
    }
    return;
  }

  // phase 'husk' — a breath on the receding burning husk + drifting debris field (te held at 1),
  //   the cabin light settled to the orbital cool, before the fall begins. The ship holds at its
  //   full-receded pose (setHaulerDeparture(1)) so it doesn't snap back.
  setHaulerDeparture(1);
  setHaulerExplosion(1);
  setTumbleLight(0);
  if (d > SHIP_HUSK_DWELL) {
    disposeHaulerExterior(ctx);   // the hauler + all its FX dispose HERE — they never leak into the descent
    advanceBeat(ctx);             // → the slow descent (the calm fall)
  }
}

/** descent beat (T0.3b) — the atmospheric fall: the planet swells (setDescentProgress)
 *  + a low continuous rumble (re-added each frame so it persists). Greybox stand-in for
 *  the Phase-2 descentProgress effect stack. At full progress → parachute. */
function tickDescent(ctx: GameContext, dt: number): void {
  const intro = ctx.intro;
  if (!intro) return;
  if (!intro.scratch.init) {
    // REBUILD v2 R1b — RE-GROUND the descent into the REAL world above the player's real
    // spawn. The pod was built at the orbit OFFSET (the cockpit/eject/explode beats sit in
    // the space-skybox frame); here we relocate it: set the real-world descent base from
    // intro.returnPos, then DISPOSE + REBUILD the pod at (returnPos.x, returnPos.y+ALT,
    // returnPos.z) so the porthole now shows the REAL terrain + sky as the pod physically
    // falls. (The orbit→real-world jump is the accepted scripted re-entry — the PLAYER stays
    // inside the pod throughout; only the pod's world coords change, hidden under the re-entry
    // FX/flash. setDescentProgress then drives the altitude DESCENT_ALT→0 to the spawn ground.)
    setDescentBase(groundedDescentBase(ctx));
    disposeHaulerExterior(ctx);   // Phase 3 — ensure the exterior hauler/FX is gone before the fall (defensive: a dev jump past shipExplode could leave it built)
    disposePodScene(ctx);   // tear down the offset pod (its group + colliders were at y=3200)
    setDescentBase(groundedDescentBase(ctx));   // re-assert after dispose cleared it (dispose nulls the base)
    // CONSISTENT-MIDDAY (user re-scope): set the REAL world to a bright clear MIDDAY NOW, at the
    //   re-grounding — the pod is about to physically fall through the real sky, and setSkyIntroMode
    //   blends space→THIS sky (driven by dayTime/sunHeight). Setting it here (not just at step-out)
    //   makes the sky you crash down through IDENTICAL to the sky you step out into (no dawn, no jump).
    setIntroMiddayClear(ctx);
    ensureInPod(ctx);       // rebuild at the grounded base + full altitude; seat the player there
    setIntroAtmosphereHidden(ctx, true);   // the desert dust is camera-anchored — hide it at altitude
    // (the seated look-pitch is driven per-frame below — shallow when high → steep as you near.)
    showIntroPrompt('');
    startDescentRush();                  // T5.1b — the sustained air-rush of the fall (until impact)
    stopMusicEscape();                   // T5.2 — the tension resolves...
    startMusicDescent();                 // T5.2 — ...into the beautiful descent swell
    intro.scratch.t = 0;
    intro.scratch.reFlash = false;       // T2.2 — the one-shot re-entry flash hasn't fired yet
    intro.scratch.init = true;
  }
  intro.scratch.t = (intro.scratch.t as number) + dt;
  // R4 — ride the descent clock only to the MID-FALL hand-off; the parachute beat resumes the
  //   SAME clock from here down to the ground (so the fall rate is seamless across the hand-off).
  const progress = Math.min(DESCENT_HANDOFF_PROGRESS, (intro.scratch.t as number) / DESCENT_DURATION);
  setDescentProgress(progress);          // R1b — drives the pod ALTITUDE (group + colliders) + cabin light + FX
  // R1b — ride the descending pod: snap the player BODY onto the pod's seat each frame (the
  // pod floor rides under the body via _syncPodToAltitude, but a direct body-set keeps the
  // eye exactly on the seat regardless of gravity drift). POSITION ONLY — do NOT touch the
  // camera rotation (the beat is 'seated' free-look; the player turns their head). The FP
  // camera re-pins to the body each frame in updatePlayer, so the eye follows the fall.
  const ds = getPodSpawn(ctx);
  ctx.player.body.body.setTranslation({ x: ds.x, y: ds.y, z: ds.z }, true);
  ctx.player.velocityY = 0;
  ctx.player.cameraSnapNextFrame = true;
  // W6 item 1 — CAMERA IS FREE-LOOK. The per-frame look-pitch drive is REMOVED (was a scripted
  //   pitch ramp that fought the player's mouse-look each frame). The seated orientation was set
  //   ONCE at the eject (shipExplode release faceControl(0,0) = facing the −Z door/porthole); from
  //   here the player free-looks through the ENTIRE fall — they can look at the vista through the
  //   porthole, glance around the cabin, whatever. Position-only ride (above); rotation untouched.
  // W6 item 3 — THE PLANET-APPROACH ARC (reworked: slower + TWO PHASES). The planet grows to fill
  //   the porthole across the space leg ("we are falling INTO that"), handing into the re-entry
  //   plasma at p≈0.24. planetApproachCurve(progress) shapes it as approach physics: PHASE A (far)
  //   a slow subtle drift over most of the space leg, then PHASE B (near) an accelerating growth as
  //   the atmosphere limb sweeps up + fills the view. sky.ts squares the value again (ease-in), so
  //   the far phase reads genuinely gentle and the near phase genuinely rushes in — not a linear zoom.
  setPlanetApproach(planetApproachCurve(progress));
  // R1a — RE-ENTRY: blend the real sky from space (1) → the dawn desert sky (0) as the pod drops
  // into the atmosphere (the orbit dissolves into the real sky; the pod physically falls through it).
  // C3 — HOLD full space a touch longer (start the blend at 0.14, not 0.05) so the grown planet +
  //   its atmosphere limb READ as the pod falls toward them BEFORE the sky dissolves them into blue
  //   — the approach + limb get their moment; the plasma (p≈0.24) then carries the entry.
  setSkyIntroMode(1 - Math.min(1, Math.max(0, (progress - 0.14) / 0.34)));
  // W6 item 5 — NORMALIZE THE FOG TO SURVIVAL DURING THE FALL. High up the fog is thin (the clear
  //   vista); as the pod drops below FOG_BLEND_ALT it blends imperceptibly to the game's survival
  //   fog (what updateWeather wrote this frame), so by landing the fog IS the survival fog — the
  //   crash/wake/exit are already at plain game fog (no clear-fog pin at ground level, no post-exit
  //   haze roll-in). blendDescentFog reads the pod's live altitude.
  blendDescentFog(ctx, getPodAltitude());
  // T2.2 — RE-ENTRY FX. The plasma + heat-shimmer VISUALS live in setDescentProgress, driven by
  // this SAME curve; here we drive the felt half (shake + flash). Re-entry is HIGH + EARLY (the
  // thin upper atmosphere at hypersonic speed) and DONE before the desert appears, so the plasma
  // doesn't stack on the warm desert cross-fade (~0.34→0.48): a sharp bump, 0 at p≈0.08, peak at
  // p≈0.24, gone by p≈0.40 — the violence at entry releases into the calm, beautiful descent.
  // NO camera shake during the descent (C18 user walk-test): addTrauma is ROTATIONAL and STACKS
  // each frame, so calling it per-frame SATURATES the trauma → the view spins/turns ("camera all
  // over the place, disorienting"). The atmosphere's force reads through the VISUAL plasma instead;
  // the fall stays perfectly smooth + serene. Only one soft entry FLASH punctuates it.
  if (progress >= 0.24 && !intro.scratch.reFlash) {
    flashScreen(0xfff2e6, 0.55);     // a soft warm flash as you punch into the atmosphere
    playReentryRumble();             // T5.1 — the swelling re-entry roar (then it passes)
    intro.scratch.reFlash = true;
  }
  // R4 — hand off to the parachute gag MID-FALL (the pod is still well up, ~383 m at p=0.55). The
  //   parachute beat CONTINUES this exact fall to the ground from DESCENT_HANDOFF_PROGRESS (a const,
  //   so it survives advanceBeat's scratch wipe), at the SAME clock rate — so the gag plays airborne
  //   with no fall-rate change across the hand-off.
  if (progress >= DESCENT_HANDOFF_PROGRESS) advanceBeat(ctx);   // → parachute (continues the fall)
}

/** parachute beat (T0.3b · R4) — THE GAG, played MID-FALL. The descent handed off here at
 *  DESCENT_HANDOFF_PROGRESS (~383 m up); this beat CONTINUES the physical fall (it keeps driving
 *  setDescentProgress at the same clock rate, pins the player body to the falling seat, and keeps
 *  the look-pitch / sky / fog blending — so the ride is seamless across the hand-off) WHILE the
 *  3-pull gag runs. Each pull (E/click, edge-triggered) jolts but doesn't deploy; the 3rd pull
 *  SNAPS the lever off — no chute. The pod keeps falling after the snap; the ground rushes up;
 *  when the fall reaches the ground (and the snap has had its airborne beat) → impact. An auto-pull
 *  fallback keeps it from softlocking. */
function tickParachute(ctx: GameContext, dt: number): void {
  const intro = ctx.intro;
  if (!intro) return;
  if (!intro.scratch.init) {
    ensureInPod(ctx);
    // C18 (user walk-test): DON'T snap to the lever — keep facing the window (−Z) so the player
    // watches the GROUND rush up to impact (seamless, no camera jump). The prompt cues the pull;
    // the lever animates off to the right. (Was faceControl(−π/2) to the lever, a jarring snap.)
    showIntroPrompt('Pull the parachute!  [click]');
    intro.scratch.pulls = 0;
    intro.scratch.sincePull = 0;
    intro.scratch.snapped = false;
    intro.scratch.snapT = 0;         // seconds of fall since the snap (the post-snap airborne beat)
    intro.scratch.leverT = 0;        // the lever's current pull pose (jab → settle)
    // R4 — resume the descent clock from the hand-off so the fall CONTINUES at the same rate. The
    //   descent ran progress 0→DESCENT_HANDOFF over fallT 0→(HANDOFF·DURATION); we pick the clock
    //   up at exactly that elapsed time and keep advancing it toward DESCENT_DURATION (progress→1).
    intro.scratch.fallT = DESCENT_HANDOFF_PROGRESS * DESCENT_DURATION;
    intro.scratch.init = true;
  }

  // ── R4 — CONTINUE THE PHYSICAL FALL every frame (mirrors tickDescent's per-frame ride so the
  //    hand-off is seamless: same altitude curve, same body-pin, same look-pitch, same sky + fog
  //    blend). The pod keeps physically falling while the gag plays + after the snap.
  intro.scratch.fallT = (intro.scratch.fallT as number) + dt;
  const progress = Math.min(1, (intro.scratch.fallT as number) / DESCENT_DURATION);
  setDescentProgress(progress);          // drives the pod ALTITUDE (group + colliders) + cabin light + FX
  // Pin the player body to the falling seat (POSITION only — leave the look to faceControl below;
  // copied from tickDescent so the eye rides the descent exactly).
  const ds = getPodSpawn(ctx);
  ctx.player.body.body.setTranslation({ x: ds.x, y: ds.y, z: ds.z }, true);
  ctx.player.velocityY = 0;
  ctx.player.cameraSnapNextFrame = true;
  // W6 item 1 — CAMERA IS FREE-LOOK. The per-frame look-pitch drive is REMOVED (was a scripted
  //   pitch ramp identical to the descent's). The seated orientation set once at the eject holds;
  //   the player free-looks through the whole gag + the fall (position-only ride above; no rotation
  //   drive). They watch the ground rush up through the porthole if they choose to look at it.
  // Keep the sky + fog blending so the late descent reads identically through the porthole. C3 —
  //   use the SAME (progress−0.14)/0.34 curve as tickDescent so the space→sky blend is seamless
  //   across the hand-off (both are ≈0 by progress 0.55, but kept exact). The planet approach is
  //   already reset (space mode is off by now); no setPlanetApproach needed here.
  setSkyIntroMode(1 - Math.min(1, Math.max(0, (progress - 0.14) / 0.34)));
  // W6 item 5 — the SAME survival-fog normalization as tickDescent. The parachute beat carries the
  //   pod through the lower atmosphere (below FOG_BLEND_ALT) to the ground, so this is where the fog
  //   finishes blending to the survival density — the crash then lands already at plain game fog.
  blendDescentFog(ctx, getPodAltitude());

  // (No per-frame rumble — addTrauma stacks every frame → saturates → the disorienting view-spin.
  //  The gag's punch comes from the ONE-TIME per-yank jolts below; the fall stays calm. C18.)

  // After the lever snaps: it hangs dead off its pivot. The pod KEEPS falling (above) — we don't
  // cut the fall short. Advance to impact once the ground is rushing up (progress near 1) AND the
  // snap has had at least its airborne beat (so a last-moment manual snap still reads before impact).
  if (intro.scratch.snapped) {
    setParachuteLeverPull(1, true);   // drooped/broken pose
    intro.scratch.snapT = (intro.scratch.snapT as number) + dt;
    const groundReached = progress >= PARACHUTE_GROUND_PROGRESS;
    const snapBeatDone = (intro.scratch.snapT as number) > PARACHUTE_SNAP_FALL;
    if (groundReached && snapBeatDone) advanceBeat(ctx);   // → impact (at the ground)
    return;
  }

  // The lever springs back between yanks: decay leverT toward 0 so a jab reads as a
  // distinct snap-forward-then-recoil (animates the chuteLever node each frame).
  intro.scratch.leverT = Math.max(0, (intro.scratch.leverT as number) - dt * 4.5);
  setParachuteLeverPull(intro.scratch.leverT as number);

  // Count pulls (edge-triggered input; auto-pull fallback so it can't softlock).
  intro.scratch.sincePull = (intro.scratch.sincePull as number) + dt;
  const autoPull = (intro.scratch.sincePull as number) > PARACHUTE_AUTOPULL;
  if (pulledLever(ctx) || autoPull) {
    intro.scratch.pulls = (intro.scratch.pulls as number) + 1;
    intro.scratch.sincePull = 0;
    intro.scratch.leverT = 1;        // jab the lever to full-pull (then it springs back)
    setParachuteLeverPull(1);
    addTrauma(0.35);   // each yank jolts the pod
    playLeverClick();  // T5.1 — the stiff mechanical yank
    const pulls = intro.scratch.pulls as number;
    if (pulls >= PARACHUTE_PULLS) {
      // The 3rd pull — the lever snaps off. No chute. The pod KEEPS FALLING (above) to the ground.
      intro.scratch.snapped = true;
      intro.scratch.snapT = 0;
      setParachuteLeverPull(1, true);
      playLeverSnap();   // T5.1 — the lever breaks off (no chute)
      flashScreen(0xffffff, 0.25);
      showIntroPrompt('The lever snaps off — no chute.');
    } else {
      showIntroPrompt(pulls === 1 ? 'Pull harder!' : 'Come on — PULL!');
    }
  }
}

/** impact beat (T0.4a · R3a) — the crash: a hard flash + max trauma, then fade to black + hold
 *  (the blackout). R3a — the ONE-POD unification: the descent cabin landed AT the spawn ground
 *  (progress=1 → altitude 0); we DON'T dispose it + swap to a separate shell. Instead we SETTLE
 *  the SAME hero cabin to a crashed LEAN at the spawn (it slammed in) — the player is still inside
 *  it — and free them to walk out (setCabinCrashPose drops the seated cage). The crash lean eases
 *  in under the blackout, so when the player comes to (wake) they're inside the SAME tilted cabin
 *  they rode down. The player body rides the cabin's seat as it tilts. → wake. */
function tickImpact(ctx: GameContext, dt: number): void {
  const intro = ctx.intro;
  if (!intro) return;
  if (!intro.scratch.init) {
    flashScreen(0xffffff, 1.0);
    addTrauma(1.0);
    stopDescentRush();    // T5.1b — the air-rush cuts at impact
    stopMusicDescent();   // T5.2 — the descent swell cuts at the crash
    playCrashImpact(0);   // T5.1 — the crash (a big near boom + sub rumble)
    showIntroPrompt('');
    // R3a — keep the descent cabin grounded at the spawn (do NOT dispose). Ensure the descent
    //   is fully landed (altitude 0) so the cabin sits on the spawn ground, then begin settling
    //   it to its crashed pose. The base was set by tickDescent; re-assert nothing — just drive
    //   the pose. (If we arrived here via a dev jump without a descent, the pod is at the offset;
    //   setCabinCrashPose is a safe no-op when the cabin isn't grounded — _crashPose still eases.)
    setDescentProgress(1);   // fully landed (altitude 0; cabin floor on the spawn ground)
    // W6 item 4 — RE-SEAT THE BODY ONTO THE GROUNDED SEAT IMMEDIATELY. The parachute's last frame
    //   left the body at the pod's ~20 m-up altitude (getPodSpawn at p<1); setDescentProgress(1)
    //   just dropped the CABIN to the ground but NOT the body — so without this the eye hangs 20 m
    //   above the grounded cabin for the first impact frames (the "seeing above the pod / the
    //   landscape" bug the user reported, visible before the fade fully covers). Snap the body onto
    //   the landed seat now (look preserved — free-look continuity), so the view is INSIDE the cabin
    //   from frame 1 of the impact. getCrashedSeatWorld tracks the tilt as the crash pose settles.
    seatBodyKeepLook(ctx, getCrashedSeatWorld(ctx));
    intro.scratch.t = 0;
    intro.scratch.init = true;
  }
  intro.scratch.t = (intro.scratch.t as number) + dt;
  const t = intro.scratch.t as number;
  // settle the cabin into its crashed lean over the fade (it tips as it slams in). This ALSO
  //   drops the seated cage at the first nonzero pose so the player can later walk out the hatch.
  setCabinCrashPose(Math.min(1, t / (IMPACT_FADE * 0.9)));
  // W6 item 4 — the pod TILTS as it settles (setCabinCrashPose rotates the group about its floor
  //   pivot), so keep the body planted in the seat AS IT LEANS (getCrashedSeatWorld transforms the
  //   local seat through the live tilt). This holds the eye inside the bore through the whole
  //   impact→wake, so the camera never clips outside the cabin during the settle (fades included).
  seatBodyKeepLook(ctx, getCrashedSeatWorld(ctx));
  setIntroBlack(Math.min(1, t / IMPACT_FADE));
  if (t > IMPACT_FADE + IMPACT_HOLD) advanceBeat(ctx);   // → wake
}

/** wake beat (CLUSTER D — the ONE-POD, ONE-DOOR rework) — you COME TO INSIDE the SAME hero cabin you
 *  rode down, now crashed + tilted at the desert spawn, facing the SAME merged FRONT DOOR you watched
 *  the descent through, and KICK IT OPEN to walk out (NOT a separate wake shell, NOT a teleport into
 *  open desert). The impact beat already settled the descent cabin to its crashed pose + freed the
 *  player (dropped the seated cage). Here we just come to inside it: fade in dazed, looking at the −Z
 *  front door (the blast cracked it ajar), kick it wide, walk out through it onto the real terrain.
 *  Phases: comeTo → prompt → blowing → climb. The front door faces −Z (FDOOR_AZ) → the descent-ride
 *  free-look already points there; the wake keeps that look (W6 item 1 — no re-anchor). */
function tickWake(ctx: GameContext, dt: number): void {
  const intro = ctx.intro;
  if (!intro) return;
  if (!intro.scratch.init) {
    // R3a — the SAME cabin the player crashed in is still here (impact kept it, settled to a
    //   crashed lean at the spawn). DON'T dispose/rebuild — just seat the player inside it + aim
    //   them at its hatch. If we got here via a dev jump (no descent/impact ran), ensureInPod
    //   builds the cabin at the grounded spawn + setCabinCrashPose tilts it so the wake still
    //   reads inside the real tilted cabin.
    setDescentBase(groundedDescentBase(ctx));   // ONE-POD: the crashed cabin floor sits on the terrain (grounded — a dev jump straight to wake still lands it on the sand)
    setIntroMiddayClear(ctx);    // CONSISTENT-MIDDAY: re-assert the bright clear midday (defensive — a dev jump straight to wake skips the descent that set it, so the wake cabin is lit by the same midday desert as step-out)
    buildPodScene(ctx);          // no-op if already built (the crashed cabin from impact); else builds it at the spawn
    setCabinCrashPose(1);        // ensure the crashed lean + the dropped cage (idempotent)
    blowCabinHatch(0);           // the front door sits ajar (the blast cracked it) — the dawn reads past it
    // W6 item 1 — re-seat the BODY inside the crashed cabin but DON'T re-drive the camera: the player
    //   free-looked through the descent + impact, and the wake is a continuous seated view (fades
    //   included), so their gaze carries over (no snap to face the door). seatBodyKeepLook keeps the
    //   camera rotation; the front door is already dead-ahead (−Z) if they were watching the vista.
    //   (Was seatPlayerAt + faceControl(FRONT_DOOR_YAW,−0.05) — a re-anchor the user asked us to drop.)
    seatBodyKeepLook(ctx, getCrashedSeatWorld(ctx));   // body at the seated spawn INSIDE the crashed (tilted) cabin; look preserved (W6 item 4 — tilt-aware seat keeps the eye in the bore)
    startDesertWind();           // T5.3 — the dawn-desert WIND fades in as you come to (the quiet aftermath; persists into step-out, stopped at handoff)
    intro.mode = 'seated';       // dazed: free-look, can't move yet
    setIntroBlack(1);
    intro.scratch.t = 0;
    intro.scratch.blowT = 0;
    intro.scratch.phase = 'comeTo';
    intro.scratch.init = true;
  }
  intro.scratch.t = (intro.scratch.t as number) + dt;
  const t = intro.scratch.t as number;
  const phase = intro.scratch.phase as string;

  if (phase === 'comeTo') {
    setIntroBlack(Math.max(0, 1 - t / WAKE_FADE));   // fade in, dazed, the dawn desert past the cabin hatch
    if (t > WAKE_FADE + WAKE_HOLD) {
      showIntroPrompt('Kick the hatch open  [click]');
      intro.scratch.phase = 'prompt';
      intro.scratch.t = 0;
    }
    return;
  }
  if (phase === 'prompt') {
    if (pulledLever(ctx) || t > WAKE_BLOW_FALLBACK) {
      flashScreen(0xfff0d8, 0.4);
      addTrauma(0.5);                 // a ONE-TIME kick as the hatch blows off (not per-frame)
      playDoorBlow();                 // T5.1 — the hatch kicks off (metal bang + debris)
      showIntroPrompt('');
      intro.scratch.phase = 'blowing';
      intro.scratch.blowT = 0;
    }
    return;
  }
  if (phase === 'blowing') {
    intro.scratch.blowT = Math.min(1, (intro.scratch.blowT as number) + dt / WAKE_BLOW_DUR);
    blowCabinHatch(intro.scratch.blowT as number);   // fling the cabin hatch open
    if ((intro.scratch.blowT as number) >= 1) {
      intro.mode = 'walk';            // hand over control — climb out the cabin hatch
      showIntroPrompt('Climb out into the desert');
      intro.scratch.phase = 'climb';
      intro.scratch.t = 0;
    }
    return;
  }
  // phase 'climb' — the player walks out the cabin hatch onto the real terrain; leaving the pod
  //   radius ends the wake (the cabin is visual-only at the spawn — no collider, walk straight out).
  const rp = intro.returnPos;
  const tr = ctx.player.body.body.translation();
  const dx = tr.x - rp.x, dz = tr.z - rp.z;
  if (dx * dx + dz * dz > WAKE_CLIMB_DIST * WAKE_CLIMB_DIST || t > WAKE_CLIMB_FALLBACK) {
    advanceBeat(ctx);   // → stepOut (finalize the desert handoff)
  }
}

/** stepOut beat (T0.4a) — THE DESERT HANDOFF (R3): teleport the capsule to the real
 *  new-game spawn (captured at start) + endEscapePodIntro (restores HUD/locomotion/survival,
 *  disposes all intro geometry, clears the black). The player is now in the dunes, playing.
 *  T0.4b adds the pod-as-spawn-wreck + the craft/salvage tutorial scaffold. */
function tickStepOut(ctx: GameContext, dt: number): void {
  const intro = ctx.intro;
  if (!intro) return;
  if (!intro.scratch.init) {
    const rp = intro.returnPos;
    // CONSISTENT-MIDDAY (user re-scope): the DESERT REVEAL is a bright CLEAR MIDDAY, IDENTICAL to
    //   the sky the pod fell through (set at descent re-grounding). Re-assert it here so a dev jump
    //   straight to stepOut (skipping the descent) still lands the same midday — no dawn, no jump.
    setIntroMiddayClear(ctx);
    setSkyIntroMode(0);                  // R1a — the REAL desert sky (space mode fully off), now driven by the midday sun
    setIntroAtmosphereHidden(ctx, false); // R1a — the desert dust/atmosphere returns
    // ONE-ENTERABLE-POD (user re-scope): NO dispose-and-swap. The player ALREADY walked out the
    //   hatch of the SAME hero cabin they woke in (the wake beat). Now UNIFY that cabin into the ONE
    //   persistent WALK-IN pod: wrap the exterior aluminium skin around it, re-ground it so its floor
    //   sits on the terrain, add walkable colliders (walk back IN + around it), and register its
    //   salvage panel + chute-pop. It's the SAME pod — you rode it down, woke in it, climbed out of
    //   it, and can walk back into it. It PERSISTS into the real game (NOT disposed on handoff).
    unifyEnterablePod(ctx, rp.x, rp.z);
    playAweSwell();                   // T5.3 — a low, wide awe-drone UNDER the music as the vista/horizon opens (the horizon-hook reveal)
    startMusicDesert();               // T5.2 — the gentle desert-easing cue (resolves into gameplay)
    showIntroPrompt('');
    intro.mode = 'walk';              // free to look around / step into the dawn
    intro.scratch.t = 0;
    intro.scratch.init = true;
  }
  // AFTERMATH-SILENCE pacing (E7): a held QUIET beat — no HUD, no objectives — as you stand in
  // the dawn, your crashed pod beside you, a distant landmark silhouette on the horizon (E8: the
  // emergence faces the M5a landmark field) — before the game's bustle. Then hand off + the hint.
  intro.scratch.t = (intro.scratch.t as number) + dt;
  if ((intro.scratch.t as number) > REVEAL_DWELL) {
    // Capture the pod spawn BEFORE endEscapePodIntro clears ctx.intro (returnPos is where the
    //   crashed pod was placed by placeCrashedPodWreck above — the tutorial scatters around it).
    const podX = intro.returnPos.x, podZ = intro.returnPos.z;
    endEscapePodIntro(ctx);   // hand control back — the desert game runs from here (HUD returns); it arms the CLEAR-SKIES fog ease-back (pod is enterable)
    // T4.3 — THE FIRST TUTORIAL. Now that control is the player's, seed the craft→salvage→
    //   chute-pop loop on their own crashed pod: scatter scrap + cloth, cue the machete craft,
    //   then (in updatePodTutorial) the pry → the comic chute-pop. Runs as normal gameplay.
    startPodTutorial(ctx, podX, podZ);
  }
}

/** Per-frame intro driver — inserted into the main tick BEFORE updatePlayer. No-op
 *  unless the intro is active. Dispatches the current beat's controller; each calls
 *  advanceBeat()/jumpToBeat() on its trigger. Beats 10-11 (tutorial, payoff) land in T0.4b+. */
export function updateEscapePodIntro(ctx: GameContext, dt: number): void {
  const intro = ctx.intro;
  if (!intro || !intro.active) return;
  // T1.3 — seated eye while the intro owns the camera. Set here (runs every frame, before
  // updatePlayer + regardless of isPlaying) so the lower seated eye also applies in the
  // preview/rig where updatePlayer early-returns at !isPlaying. 'walk' beats keep standing.
  if (intro.mode !== 'walk') ctx.player.eyeOffset = Tuning.POD_SEATED_EYE_OFFSET;
  // 1i SEQUENCE-BREAK WATCHDOG (user live-test: they escaped the ship through a collision hole
  // and fell 3000m to the desert WITH THE INTRO STILL ACTIVE — space sky + pinned midday +
  // suppressed weather = the "world lighting broken" report). During ship-interior WALK beats,
  // if the player ever leaves the hull envelope (fell below the deck or strayed far off the
  // ship), rescue them back to the ship spawn — collision holes must degrade to a hiccup, not
  // a sequence-broken world. (Seated/scripted beats pin the body; only walk beats can stray.)
  if (intro.mode === 'walk' && (intro.beat === 'cockpit' || intro.beat === 'checkEngines' ||
      intro.beat === 'corridor' || intro.beat === 'enterPod')) {
    const spawn = getShipSpawn(ctx);
    const tr = ctx.player.body.body.translation();
    const fellBelowDeck = tr.y < spawn.y - 6;          // the deck sits near spawn.y; 6m = well through the floor
    const strayedOffShip = Math.abs(tr.x - spawn.x) > 25 || Math.abs(tr.z - spawn.z) > 40;
    if (fellBelowDeck || strayedOffShip) {
      seatPlayerAt(ctx, spawn);
      ctx.player.velocityY = 0;
      showIntroPrompt(intro.scratch.disaster ? 'GET TO THE ESCAPE POD' : '');
    }
  }
  switch (intro.beat) {
    case 'cockpit': tickCockpit(ctx, dt); break;
    case 'checkEngines': tickCheckEngines(ctx); break;
    case 'corridor': tickCorridor(ctx, dt); break;
    case 'enterPod': tickEnterPod(ctx, dt); break;
    case 'shipExplode': tickShipExplode(ctx, dt); break;
    case 'descent': tickDescent(ctx, dt); break;
    case 'parachute': tickParachute(ctx, dt); break;
    case 'impact': tickImpact(ctx, dt); break;
    case 'wake': tickWake(ctx, dt); break;
    case 'stepOut': tickStepOut(ctx, dt); break;
    // The tutorial (Beats 10-11: craft+salvage + chute-pop) runs as normal gameplay AFTER the
    // handoff (the wreck + the hint from stepOut), not as an intro beat — the hero pass is Phase 4.
    default: break;
  }
  // R1a — NO DUST IN SPACE. updateWeather/updateAmbientDust/updateDustMotes run BEFORE this in
  // the tick and re-show their particles every frame, so a one-time hide gets overwritten — keep
  // it suppressed each frame here (this runs after them) through the space/ship/descent/crash
  // beats; stepOut restores the desert atmosphere when the player steps out into the dunes.
  if (intro.beat !== 'stepOut' && intro.beat !== 'done') setIntroAtmosphereHidden(ctx, true);
  // W6 item 5 — NO ground-level fog pin. The descent/parachute already blended the fog to the
  //   game's survival density during the fall (blendDescentFog), so by the crash it IS the survival
  //   fog — impact/wake/stepOut just let updateWeather's survival fog stand (nothing to override).
  //   The Leviathan reveal reads through survival fog now (acceptable — it was re-valued for that
  //   range) rather than the old artificial ground-level clear pin the user read as an "instance".
  // R4 — the phase-transition dip-to-black: HOLD at full black, then fade in over the new beat
  // (a REAL ~2 s blackout). _phaseFade counts down in SECONDS from PHASE_FADE_TOTAL; the opacity
  // is full through the hold, then a linear fade-out. Only on the descent-chain cinematic beats
  // (shipExplode owns a blast flash; impact/wake own the black via setIntroBlack themselves).
  if (_phaseFade > 0) {
    _phaseFade = Math.max(0, _phaseFade - dt);
    if (intro.beat === 'descent' || intro.beat === 'parachute') setIntroBlack(phaseFadeOpacity(_phaseFade));
  }
}

/** B2 — the SMOKE DRIVER for the player-gated enterPod flow. The smoke can't wait for real player
 *  input, so it SYNTHESIZES the E-presses + the walk-in body motion to drive tickEnterPod through
 *  ALL its gated phases (E-open the airlock → collar → E-open the pod → walk in → E-sit → seal →
 *  E-eject), proving the gated
 *  chain runs headlessly + leaving the beat at 'shipExplode' (whereupon the smoke loop's next
 *  jumpToBeat is a harmless re-jump to the beat it already reached). Seeds ctx.input.pressed + the
 *  camera look + the body position per phase; clears the synthesized press each iteration (there's
 *  no main-loop endInputFrame in the smoke). Safe if the ship/bay aren't built (the gates just
 *  won't fire — but the smoke jumps to shipExplode next regardless, so the count is preserved). */
function driveEnterPodForSmoke(ctx: GameContext): void {
  const pressE = () => { ctx.input.pressed.add('KeyE'); };
  const clearE = () => { ctx.input.pressed.delete('KeyE'); };
  const lookAt = (t: THREE.Vector3) => {
    const cam = ctx.three.camera;
    cam.rotation.order = 'YXZ';
    cam.rotation.y = Math.atan2(t.x - cam.position.x, -(t.z - cam.position.z)) + Math.PI;   // yaw toward the target (−Z basis)
  };
  const setBody = (p: THREE.Vector3) => {
    ctx.player.body.body.setTranslation({ x: p.x, y: p.y, z: p.z }, true);
    ctx.three.camera.position.set(p.x, p.y + ctx.player.eyeOffset, p.z);
  };
  // guard: bail out after a bounded number of iterations so a wiring bug can't infinite-loop the smoke.
  for (let i = 0; i < 200 && ctx.intro?.beat === 'enterPod'; i++) {
    const phase = ctx.intro.scratch.phase as string;
    if (phase === 'airlock') {
      // W2b — stand at the sliding blast-door + E-open it (the boarding now starts here).
      setBody(getBayAirlockThreshold()); lookAt(getBayAirlockDoorWorld()); pressE();
    } else if (phase === 'approach') {   // ('collar' just needs time — the leaves slide open)
      setBody(getPodBayThreshold()); lookAt(getPodBayDoorWorld()); pressE();
    } else if (phase === 'enter') {
      // walk into the bore: teleport the body to the interior stand-point (real motion is proven by
      //   the rig; the smoke just needs the gate to register "inside").
      setBody(getPodBayInteriorStand());
    } else if (phase === 'atSeat') {
      lookAt(getPodBaySeatedEye()); pressE();
    } else if (phase === 'eject') {
      pressE();
    }   // 'sealing' just needs time — tick through it
    updateEscapePodIntro(ctx, 0.05);
    clearE();
  }
}

/** Dev smoke (T0.4b) — programmatically force every beat + tick it, confirming the whole
 *  sequence is wired (each controller ticks without throwing; the chain reaches the desert
 *  handoff). Returns {ok, beats, error?}. Exposed via `__game.smokeIntro()`. Leaves the game
 *  in the post-handoff state (a greybox crashed wreck at the spawn). B2 — the enterPod beat is now
 *  player-gated, so its 3 blind ticks would stall in 'approach'; driveEnterPodForSmoke synthesizes
 *  the E-presses + walk-in so the gated flow is exercised end-to-end (still {ok, beats:12}). */
export function smokeTestIntro(ctx: GameContext): { ok: boolean; beats: number; error?: string } {
  let beats = 0;
  try {
    startEscapePodIntro(ctx, true);
    for (const beat of BEAT_ORDER) {
      if (beat === 'done') break;
      if (!introActive(ctx)) break;          // stepOut ends the intro mid-chain
      jumpToBeat(ctx, beat);
      for (let i = 0; i < 3; i++) updateEscapePodIntro(ctx, 0.05);
      if (beat === 'enterPod') driveEnterPodForSmoke(ctx);   // B2 — drive the player-gated boarding through its phases
      beats++;
    }
    if (introActive(ctx)) endEscapePodIntro(ctx);
    return { ok: true, beats };
  } catch (e) {
    if (introActive(ctx)) endEscapePodIntro(ctx);
    return { ok: false, beats, error: e instanceof Error ? e.message : String(e) };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PERF INSTRUMENTATION — prove the preload win. benchIntro drives the WHOLE beat chain
// (like smokeTestIntro) but TIMES each beat's ENTRY tick — the first updateEscapePodIntro
// per beat runs that beat's init (buildShipScene at cockpit, the hauler reveal/build at
// shipExplode, the pod rebuild + first-plasma-visible at descent, etc.), so its duration IS
// the beat-entry stall the user feels as a freeze. Run it WITHOUT the preload (cold builds
// on entry — the freezes) and WITH it (everything prebuilt — entries ~0) to measure the win.
//
// It ALSO records the per-TICK frame time across the chain + counts the >50ms/>100ms hitches
// (the "stutter" metric). Real GPU shader-compile hitches only show in a live browser (the
// warm-up + first-draw path); in headless node this captures the geometry-build stalls (the
// dominant CPU cost — the ~1400-mesh ship build). Playwright timings are noisy → the caller
// runs it a few times + reports medians (see the perf report / scripts/bench-intro.mjs).
// ─────────────────────────────────────────────────────────────────────────────

/** One beat's measured entry cost. `ms` = the duration of the beat's FIRST tick (its build/init). */
export interface BeatEntryTiming { beat: BeatId; ms: number; }

export interface IntroBenchResult {
  ok: boolean;
  preloaded: boolean;
  /** Per-beat entry-tick durations (the stall the player feels on each beat transition). */
  beatEntries: BeatEntryTiming[];
  /** Total time across all ticks of the whole chain (ms). */
  totalMs: number;
  /** The single worst tick frame time (ms). */
  maxFrameMs: number;
  /** How many ticks took >50ms (a visible stutter). */
  framesOver50: number;
  /** How many ticks took >100ms (a hard freeze). */
  framesOver100: number;
  /** If preloaded: the preload's own per-step timings + total (the up-front cost we moved the freezes into). */
  preload?: { totalMs: number; steps: Array<{ label: string; ms: number; error?: string }> };
  error?: string;
}

/**
 * Drive the full intro beat chain with per-beat-entry + per-tick timing. If `opts.preload` is
 * true, run the up-front preload FIRST (awaited) so the beats reuse prebuilt scenes — the
 * beat-entry stalls should then collapse to ~0. Exposed via `__game.benchIntro({preload})`.
 * Leaves the game in the post-handoff state (like smokeTestIntro).
 *
 * NOTE: async because the preload is async (compileAsync + rAF yields). In headless node the
 * preload's GPU steps are guarded to fast no-ops, so this still measures the CPU build stalls.
 */
export async function benchIntro(ctx: GameContext, opts?: { preload?: boolean }): Promise<IntroBenchResult> {
  const beatEntries: BeatEntryTiming[] = [];
  let maxFrameMs = 0, framesOver50 = 0, framesOver100 = 0, totalMs = 0;
  let preload: IntroBenchResult['preload'];
  try {
    startEscapePodIntro(ctx, true);
    if (opts?.preload) {
      const { preloadIntro } = await import('./introPreload.ts');
      const r = await preloadIntro(ctx);
      preload = { totalMs: r.totalMs, steps: r.steps };
    }
    const tick = (dt: number): number => {
      const t0 = performance.now();
      updateEscapePodIntro(ctx, dt);
      const ms = performance.now() - t0;
      totalMs += ms;
      if (ms > maxFrameMs) maxFrameMs = ms;
      if (ms > 50) framesOver50++;
      if (ms > 100) framesOver100++;
      return ms;
    };
    for (const beat of BEAT_ORDER) {
      if (beat === 'done') break;
      if (!introActive(ctx)) break;
      jumpToBeat(ctx, beat);
      // The FIRST tick of the beat runs its init (the build/reveal cost) — that's the entry stall.
      const entryMs = tick(0.05);
      beatEntries.push({ beat, ms: entryMs });
      // A few more ticks to settle the beat (not counted as the entry, but they feed the hitch stats).
      for (let i = 0; i < 2; i++) tick(0.05);
      if (beat === 'enterPod') driveEnterPodForSmoke(ctx);
    }
    if (introActive(ctx)) endEscapePodIntro(ctx);
    return { ok: true, preloaded: !!opts?.preload, beatEntries, totalMs, maxFrameMs, framesOver50, framesOver100, preload };
  } catch (e) {
    if (introActive(ctx)) endEscapePodIntro(ctx);
    return { ok: false, preloaded: !!opts?.preload, beatEntries, totalMs, maxFrameMs, framesOver50, framesOver100, preload, error: e instanceof Error ? e.message : String(e) };
  }
}
