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

import type { GameContext } from '../../GameContext.ts';
import { FEATURES } from '../../config/features.ts';
import { Tuning } from '../../config/tuning.ts';
import {
  buildShipScene, disposeShipScene, getShipSpawn,
  SHIP_CORRIDOR_ENTER_Z, SHIP_DEAD_END_Z,
  setCockpitAlert, setShipAlert, setEngineFire,
  getPodBayThreshold, getPodBaySeatedEye, releasePodFromBay,   // R5c — the docked-pod bay + physical release
} from './shipScene.ts';
import { buildPodScene, disposePodScene, getPodSpawn, setDescentProgress, setDescentBase, setTumbleLight, setParachuteLeverPull, setCabinCrashPose, blowCabinHatch, restoreCabinExposure, unifyEnterablePod, podIsEnterable } from './podScene.ts';
import { buildHaulerExterior, disposeHaulerExterior, setHaulerExplosion } from './haulerScene.ts';   // Phase 3 (T3.1/T3.2) — the hero freighter + its death staged through the post-eject porthole
import { startPodTutorial } from './podTutorial.ts';   // T4.3 — the first craft→salvage→chute-pop tutorial (runs as gameplay post-handoff)
import { setGameHudHidden, showIntroPrompt, hideIntroPrompt, setIntroBlack } from './introHud.ts';
import { flashScreen } from '../../fx/screenFlash.ts';
import { addTrauma } from '../../fx/cameraShake.ts';
import { setSkyIntroMode } from '../sky.ts';   // REBUILD v2 R1a — drive the real sky into "space mode" for orbit, ease to dawn at re-entry
import {
  ensureAudioStarted, playEjectThunk, playExplosionBoom, playKlaxon, playHullGroan,
  playReentryRumble, playLeverClick, playLeverSnap, playDoorBlow, playCrashImpact,
  startCockpitHum, stopCockpitHum, startDescentRush, stopDescentRush, stopAllIntroLoops,
  startMusicEscape, stopMusicEscape, startMusicDescent, stopMusicDescent, startMusicDesert,
  startEngineFire, stopEngineFire, startDesertWind,
  playBoltShear, playHatchSeal, playShipDeathRoar, playAweSwell,
} from '../../audio/audio.ts';   // T5.1 SFX + ambient loops · T5.2 music cues · T5.3 gap-fill (fire/wind beds + bolt/seal/death-roar/awe one-shots)

/** Seconds the cockpit opens SEATED (looking at the planet) before control + the cue. */
const COCKPIT_DWELL = 3.0;
/** Eject auto-fires after this long if the player doesn't pull the lever (anti-softlock). */
const EJECT_FALLBACK = 6.0;
/** Phase 3 (T3.2) — the SHIP-EXPLOSION beat is now the vision's climactic SPECTACLE: the
 *  player watches their hauler DIE through the porthole (a white flash → a blooming fireball
 *  → the hull breaking into tumbling debris → a shockwave → a receding burning husk), the
 *  cabin flooded by the blast light — then it settles into the descent. Staged over these
 *  sub-timings (seconds). C18 honoured: the POD stays UPRIGHT + LEVEL facing the window (no
 *  tumble) — the SHIP tumbles/breaks; the pod holds steady + watches.
 *    INTACT_DWELL — the ship reads WHOLE in the window (you see what you fled) before it dies.
 *    EXPLODE_DUR  — the fireball/breakup unfolds over this many seconds (the spectacle breathes).
 *    HUSK_DWELL   — a last beat on the receding burning husk/debris before the fall begins. */
const SHIP_INTACT_DWELL = 0.9;    // the intact hauler hangs in the window (the "that's my ship" beat)
const SHIP_EXPLODE_DUR = 2.3;     // the explosion unfolds (flash→fireball→breakup→shockwave→husk)
const SHIP_HUSK_DWELL = 0.5;      // a breath on the receding husk before the descent
/** Seconds of the SLOW, seamless atmospheric fall (C18 user walk-test: descend slowly + serenely —
 *  watch the planet get closer, space fade to sky, the ground slowly approach). Was 8.0.
 *  REBUILD v2 R4 — this is the FULL-FALL clock (progress 0→1 over this many seconds AT a fixed
 *  rate). The descent beat only rides it to DESCENT_HANDOFF_PROGRESS, then HANDS OFF to the
 *  parachute beat MID-AIR; the parachute beat resumes the SAME clock/rate down to the ground, so
 *  the fall rate is seamless across the hand-off (no speed change, no camera jump). */
const DESCENT_DURATION = 18.0;
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

/** Force the real world to a bright clear MIDDAY (the intro's atmospheric handoff look). Sets the
 *  diurnal clock to noon-ish + clears any cloud/storm so the descent sky, the crash, the wake, and
 *  the step-out all share ONE consistent bright sky (no dawn, no time jump on exit). Cloudiness is
 *  RESET (not pinned) so normal gameplay weather resumes after the handoff — it's just clear at the
 *  moment you arrive. Called at the descent re-grounding AND at step-out so both ends match. */
function setIntroMiddayClear(ctx: GameContext): void {
  ctx.time.dayTime = INTRO_MIDDAY_TIME;
  if (ctx.weather) {
    ctx.weather.intensity = 0;    // no sandstorm dust dimming the sky
    ctx.weather.cloudiness = 0;   // clear skies (eases back to normal gameplay cover afterward)
  }
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

/** Place the player capsule + camera at a world spawn, facing −Z, and snap the camera. */
function seatPlayerAt(ctx: GameContext, spawn: { x: number; y: number; z: number }): void {
  ctx.player.body.body.setTranslation(spawn, true);
  ctx.player.velocityY = 0;
  ctx.player.cameraSnapNextFrame = true;
  ctx.three.camera.position.set(spawn.x, spawn.y + ctx.player.eyeOffset, spawn.z);
  ctx.three.camera.rotation.set(0, 0, 0);   // face −Z
}

/** Ensure the player is seated in the (built) pod, mode seated. Idempotent — used by every
 *  pod beat so each is independently jumpable (a dev `jumpToBeat('descent')` builds the pod
 *  too, not just the real enterPod→… chain). */
function ensureInPod(ctx: GameContext): void {
  buildPodScene(ctx);
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
  //   prop. (restoreCabinExposure keeps the desert-base exposure either way — unify already set it.)
  if (podIsEnterable()) restoreCabinExposure(ctx);
  else disposePodScene(ctx);
  stopAllIntroLoops();       // T5.1b — stop any ambient loop (cockpit hum / descent rush) on any exit
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
    showIntroPrompt('⚠ CORE TEMP CRITICAL — check the engines (aft)');
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
      showIntroPrompt('🔥 ENGINE FIRE — GET TO THE ESCAPE POD!');
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
  if (z < SHIP_CORRIDOR_ENTER_Z) advanceBeat(ctx);   // fled back to the bridge → enterPod
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
const ENTER_CLIMB_DUR = 1.4;      // seconds of the continuous climb-in move (hatch → seat)
const ENTER_SEAL_DUR = 0.9;       // seconds the hatch seals over the eye (the swap happens here)
const ENTER_WALK_FALLBACK = 6.0;  // auto-begin the climb-in if the player just stands at the mouth
const ENTER_REACH_DIST = 1.5;     // how near the hatch threshold counts as "at the pod"
function tickEnterPod(ctx: GameContext, dt: number): void {
  const intro = ctx.intro;
  if (!intro) return;
  if (!intro.scratch.init) {
    intro.scratch.init = true;
    intro.scratch.phase = 'walkUp';
    intro.scratch.t = 0;
    intro.mode = 'walk';                 // free-walk the last steps up to the docked hatch
    showIntroPrompt('Get in the escape pod');
  }
  intro.scratch.t = (intro.scratch.t as number) + dt;
  const phase = intro.scratch.phase as string;
  const thr = getPodBayThreshold();      // world: just outside the open hatch, standing eye
  const seat = getPodBaySeatedEye();     // world: inside the docked cabin, seated eye

  if (phase === 'walkUp') {
    // reached the open hatch? (planar distance from the threshold) — or the anti-softlock fallback.
    const tr = ctx.player.body.body.translation();
    const dx = tr.x - thr.x, dz = tr.z - thr.z;
    const reached = (dx * dx + dz * dz) < ENTER_REACH_DIST * ENTER_REACH_DIST;
    if (reached || (intro.scratch.t as number) > ENTER_WALK_FALLBACK) {
      // capture the eye's CURRENT world pose as the climb-in start (seamless from wherever they are)
      const st = ctx.three.camera.position;
      intro.scratch.startX = st.x; intro.scratch.startY = st.y; intro.scratch.startZ = st.z;
      intro.scratch.phase = 'climbIn';
      intro.mode = 'scripted';           // locomotion off; the beat drives the eye
      intro.scratch.t = 0;
      showIntroPrompt('');
    }
    return;
  }

  if (phase === 'climbIn') {
    // CONTINUOUS first-person carry: ease the eye from the captured start pose to the seated eye
    //   inside the docked cabin. Position-drive the body + camera each frame (no snap-cut); a gentle
    //   ease-in-out so it reads as climbing in + settling, not a lerp jerk. Look toward the seat.
    const k = Math.min(1, (intro.scratch.t as number) / ENTER_CLIMB_DUR);
    const e = k * k * (3 - 2 * k);       // smoothstep ease
    const sx = intro.scratch.startX as number, sy = intro.scratch.startY as number, sz = intro.scratch.startZ as number;
    const ex = sx + (seat.x - sx) * e, ey = sy + (seat.y - sy) * e, ez = sz + (seat.z - sz) * e;
    // drive the body (eye rides body + eyeOffset) so gravity can't drift it, then pin the camera.
    ctx.player.body.body.setTranslation({ x: ex, y: ey - ctx.player.eyeOffset, z: ez }, true);
    ctx.player.velocityY = 0;
    ctx.three.camera.position.set(ex, ey, ez);
    // look INTO the pod (toward −X, the cabin interior) as we climb through the hatch, easing to
    //   the forward viewport (−Z) read so we settle facing where the descent view will be.
    ctx.three.camera.rotation.order = 'YXZ';
    const yaw = -Math.PI / 2 + (Math.PI - (-Math.PI / 2)) * (e * 0.5);   // from facing −X (into hatch) toward −Z-ish
    ctx.three.camera.rotation.set(-0.05, yaw, 0);
    ctx.player.cameraSnapNextFrame = true;
    if (k >= 1) {
      intro.scratch.phase = 'seal';
      intro.scratch.t = 0;
      playDoorBlow();                    // the hatch THUNKS shut behind them (reuse the door SFX)
      playHatchSeal();                   // T5.3 — the pressure HISS + airtight pressurise under the clunk (the cabin seals)
      addTrauma(0.2);                    // a one-time clunk as it seals
    }
    return;
  }

  if (phase === 'seal') {
    // the hatch seals over the eye — a brief black dim (the closing door occludes the view); UNDER
    //   it we swap the bay-pod peek for the REAL ridden cabin + seat the player (R3a continuity: the
    //   capsule they're now inside IS the one they ride down). The dim hides the model swap.
    const k = Math.min(1, (intro.scratch.t as number) / ENTER_SEAL_DUR);
    // a quick dip: dark in (0→0.5), then hold+lift as the cabin lights read (0.5→1).
    const dim = k < 0.5 ? (k / 0.5) : Math.max(0, 1 - (k - 0.5) / 0.5);
    setIntroBlack(dim * 0.9);
    if (!intro.scratch.swapped && k >= 0.5) {
      ensureInPod(ctx);                  // build the REAL ridden cabin (offset frame) + seat the player
      // Frame CENTRED on the YELLOW eject control so the "Pull the eject lever" prompt POINTS at it
      // (buckle-lesson: a control the prompt names must be in the framed view, not shoved to the edge).
      // The eject panel sits on the −X wall at az≈−1.97 (curve-seated left-forward); yaw=π/2 aimed
      // dead −X, leaving the control jammed in the right third with the camera centred on empty wall +
      // the hatch. yaw 1.20 / pitch −0.20 lands the guarded T-handle at screen centre (probe-verified).
      faceControl(ctx, 1.20, -0.20);   // frame the YELLOW eject control dead-centre (the next cue points at it)
      intro.scratch.swapped = true;
    }
    if (k >= 1) {
      setIntroBlack(0);
      intro.scratch.phase = 'cue';
      intro.scratch.t = 0;
      intro.mode = 'seated';
      showIntroPrompt('Pull the eject lever  [click]');
    }
    return;
  }

  // phase 'cue' — seated in the sealed pod; pull the eject lever (or the anti-softlock fallback).
  if (pulledLever(ctx) || (intro.scratch.t as number) > EJECT_FALLBACK) advanceBeat(ctx);   // → shipExplode
}

/** shipExplode beat (T0.3a → Phase 3 T3.2) — eject fires; the docked pod tears free; the pod is
 *  flung clear facing the window; then THE PLAYER WATCHES THEIR HAULER DIE through the porthole —
 *  the vision's climactic beat. A white-hot flash → a blooming fireball → the hull breaking into
 *  tumbling debris → a shockwave → sparks → a receding burning husk, the cabin flooded by the
 *  blast light — settling into the slow serene descent. C18 (user walk-test): NO POD TUMBLE — the
 *  pod stays UPRIGHT + LEVEL facing the window; the SHIP tumbles/breaks, the pod holds + watches.
 *
 *  Phases: release (bolts fire, pod tears from the cradle) → watch (the hauler hangs intact in the
 *  window) → blast (the detonation → the fireball/breakup unfolds over EXPLODE_DUR) → husk (a breath
 *  on the receding husk) → the descent. The hauler + its FX DISPOSE at the hand-off (they never leak
 *  into the fall). */
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
    faceControl(ctx, 0, 0);          // upright, facing the window (−Z) — the pod stays LEVEL (no tumble)
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
    setTumbleLight(0.3 + rk * 0.2);  // the bay glow rising into the cabin
    if (rk >= 1) {
      // ── PHASE B: the pod is CLEAR — dispose the interior ship (+ bay), show the ORBITAL VISTA
      //    (planet + stars) through the window, and stage the HERO HAULER out in that view (−Z,
      //    offset to one side of the planet), INTACT, so the player sees what they just fled.
      stopCockpitHum();              // T5.1b — the ship's hum dies with it
      stopEngineFire();              // T5.3 — the engine blaze is left behind with the ship (the pod is clear + sealed)
      disposeShipScene(ctx);         // the interior ship (+ the emptied bay) is gone — the exterior hauler is the NEW separate thing
      setDescentProgress(0);         // the orbital vista (planet + stars) through the window
      buildHaulerExterior(ctx);      // T3.1 — the worn freighter floats out in space ahead (−Z), about to die
      setHaulerExplosion(0);         // intact (ember idle) — the "that's my ship" beat
      showIntroPrompt('');
      addTrauma(0.2);                // a small kick as the pod is flung clear (one-shot, decays)
      intro.scratch.built = true;
      intro.scratch.phase = 'watch';
      intro.scratch.dwell = 0;
    }
    return;
  }

  if (phase === 'watch') {
    // the intact hauler hangs in the window — a held beat so the player reads THE SHIP before it
    //   dies (the vision: "watch the ship explode" wants an intact ship to watch first).
    setTumbleLight(0.5 * Math.max(0, 1 - d / SHIP_INTACT_DWELL));   // the bay glow decays to orbital cool
    if (d > SHIP_INTACT_DWELL) {
      intro.scratch.phase = 'blast';
      intro.scratch.dwell = 0;
    }
    return;
  }

  if (phase === 'blast') {
    // THE DETONATION → the fireball/breakup unfolds over EXPLODE_DUR. Drive the hauler-explosion
    //   `t` 0→1 across it (haulerScene runs the flash/fireball/debris/shockwave/sparks/blast-light);
    //   the CABIN flash is driven here (setTumbleLight — a hot orange pulse that decays); a one-shot
    //   screen flash + boom punctuate the detonation, and a mid-blast secondary punch.
    const te = Math.min(1, d / SHIP_EXPLODE_DUR);
    setHaulerExplosion(te);
    // the detonation punch (one-shot at te≈0): a bright warm screen flash + the boom + a single kick.
    if (!intro.scratch.reFlash && te > 0.02) {
      flashScreen(0xfff0d8, 1.0);    // the blinding detonation flash (the ship dies)
      playExplosionBoom();           // T5.1 — the ship explodes (the concussive boom, felt through the hull)
      playShipDeathRoar();           // T5.3 — the sustained roar + tearing-sub + debris-groan tail UNDER the boom (the ~2.3s spectacle lands sonically)
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
    const cabin = Math.max(0, 1 - te / 0.55);   // 1 at detonation → 0 by mid-explosion
    setTumbleLight(cabin);
    if (te >= 1) {
      intro.scratch.phase = 'husk';
      intro.scratch.dwell = 0;
    }
    return;
  }

  // phase 'husk' — a breath on the receding burning husk + drifting debris field (te held at 1),
  //   the cabin light settled to the orbital cool, before the fall begins.
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
  // R1b — the seated look-pitch tracks the altitude: SHALLOW when high (near the horizon, so the
  // real dawn horizon + distant desert read through the porthole), STEEPENING to the porthole's
  // ~22° cap as the pod nears the ground (so the dunes fill the window + rush up at impact). This
  // gives the real arc — high: sky+horizon+far dunes; low: the desert rushing up — within the
  // fixed side-porthole's down-look limit. Scripted (overwrites free-look) only on the descent.
  const pitch = -0.12 - 0.28 * (progress * progress);   // ≈7° high → ≈23° low (eased late)
  faceControl(ctx, 0, pitch);
  // R1a — RE-ENTRY: blend the real sky from space (1) → the dawn desert sky (0) as the pod drops
  // into the atmosphere (the orbit dissolves into the real sky; the pod physically falls through it).
  setSkyIntroMode(1 - Math.min(1, Math.max(0, (progress - 0.05) / 0.4)));
  // R1b — THIN the fog hard during the fall. The game's FogExp2 (tuned for ~1 km ground-level
  // survival visibility) blends the terrain into the sky from a few hundred metres up — so from
  // altitude the real ground would just read as haze. updateWeather already ran THIS frame, so
  // overriding density here sticks. A high-altitude clear-air value lets the REAL desert read
  // through the porthole (far + hazy high, crisp as the ground rushes up); restored at handoff
  // by updateWeather (the descent overrides only while this beat ticks). Clears more as you near.
  {
    const fog = ctx.three.scene.fog as { density?: number } | null;
    if (fog && 'density' in fog) fog.density = 0.00006 + 0.00006 * progress;   // very thin high → a touch denser low (aerial haze on the far dunes)
  }
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
  // The seated look-pitch steepens as the pod nears the ground (same curve as the descent), so the
  // dunes fill the porthole + rush up — the gag is clearly airborne with the ground coming up.
  const pitch = -0.12 - 0.28 * (progress * progress);
  faceControl(ctx, 0, pitch);
  // Keep the sky + fog blending so the late descent reads identically through the porthole.
  setSkyIntroMode(1 - Math.min(1, Math.max(0, (progress - 0.05) / 0.4)));   // ≈0 by now (we handed off at 0.55), but kept exact for seamlessness
  {
    const fog = ctx.three.scene.fog as { density?: number } | null;
    if (fog && 'density' in fog) fog.density = 0.00006 + 0.00006 * progress;
  }

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
    intro.scratch.t = 0;
    intro.scratch.init = true;
  }
  intro.scratch.t = (intro.scratch.t as number) + dt;
  const t = intro.scratch.t as number;
  // settle the cabin into its crashed lean over the fade (it tips as it slams in). This ALSO
  //   drops the seated cage at the first nonzero pose so the player can later walk out the hatch.
  setCabinCrashPose(Math.min(1, t / (IMPACT_FADE * 0.9)));
  setIntroBlack(Math.min(1, t / IMPACT_FADE));
  if (t > IMPACT_FADE + IMPACT_HOLD) advanceBeat(ctx);   // → wake
}

/** wake beat (R3a — the ONE-POD rework) — you COME TO INSIDE the SAME hero cabin you rode down,
 *  now crashed + tilted at the desert spawn, and BLOW ITS HATCH to climb out (NOT a separate wake
 *  shell, NOT a teleport into open desert). The impact beat already settled the descent cabin to
 *  its crashed pose at the spawn + freed the player (dropped the seated cage). Here we just come to
 *  inside it: fade in dazed, looking at the cabin's own ajar escape HATCH (the blast cracked it),
 *  kick it open, walk out through it onto the real terrain. Phases: comeTo → prompt → blowing →
 *  climb. (HATCH_AZ on the cabin is the local hatch azimuth; the look/emergence aims that way.) */
const CABIN_HATCH_YAW = -1.25 + Math.PI;   // face the cabin's escape hatch (HATCH_AZ=-1.25 → yaw=az+π)
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
    blowCabinHatch(0);           // the cabin's own door sits ajar (the blast cracked it)
    seatPlayerAt(ctx, getPodSpawn(ctx));   // body at the seated spawn INSIDE the crashed cabin
    faceControl(ctx, CABIN_HATCH_YAW, -0.05);   // look at the cabin hatch (the dawn desert past it), slightly down (dazed)
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
    endEscapePodIntro(ctx);   // hand control back — the desert game runs from here (HUD returns)
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
  // R4 — the phase-transition dip-to-black: HOLD at full black, then fade in over the new beat
  // (a REAL ~2 s blackout). _phaseFade counts down in SECONDS from PHASE_FADE_TOTAL; the opacity
  // is full through the hold, then a linear fade-out. Only on the descent-chain cinematic beats
  // (shipExplode owns a blast flash; impact/wake own the black via setIntroBlack themselves).
  if (_phaseFade > 0) {
    _phaseFade = Math.max(0, _phaseFade - dt);
    if (intro.beat === 'descent' || intro.beat === 'parachute') setIntroBlack(phaseFadeOpacity(_phaseFade));
  }
}

/** Dev smoke (T0.4b) — programmatically force every beat + tick it, confirming the whole
 *  sequence is wired (each controller ticks without throwing; the chain reaches the desert
 *  handoff). Returns {ok, beats, error?}. Exposed via `__game.smokeIntro()`. Leaves the game
 *  in the post-handoff state (a greybox crashed wreck at the spawn). */
export function smokeTestIntro(ctx: GameContext): { ok: boolean; beats: number; error?: string } {
  let beats = 0;
  try {
    startEscapePodIntro(ctx, true);
    for (const beat of BEAT_ORDER) {
      if (beat === 'done') break;
      if (!introActive(ctx)) break;          // stepOut ends the intro mid-chain
      jumpToBeat(ctx, beat);
      for (let i = 0; i < 3; i++) updateEscapePodIntro(ctx, 0.05);
      beats++;
    }
    if (introActive(ctx)) endEscapePodIntro(ctx);
    return { ok: true, beats };
  } catch (e) {
    if (introActive(ctx)) endEscapePodIntro(ctx);
    return { ok: false, beats, error: e instanceof Error ? e.message : String(e) };
  }
}
