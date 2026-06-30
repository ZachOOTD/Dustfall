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
} from './shipScene.ts';
import { buildPodScene, disposePodScene, getPodSpawn, setDescentProgress, setTumbleLight, setParachuteLeverPull, placeCrashedPodWreck } from './podScene.ts';
import { setGameHudHidden, showIntroPrompt, hideIntroPrompt, setIntroBlack } from './introHud.ts';
import { flashScreen } from '../../fx/screenFlash.ts';
import { addTrauma } from '../../fx/cameraShake.ts';

/** Seconds the cockpit opens SEATED (looking at the planet) before control + the cue. */
const COCKPIT_DWELL = 3.0;
/** Eject auto-fires after this long if the player doesn't pull the lever (anti-softlock). */
const EJECT_FALLBACK = 6.0;
/** Seconds the eject/blast beat holds (the ship dies in a flash; the cabin briefly lit) before
 *  the descent. C18 (user walk-test): NO tumble — the pod stays UPRIGHT; this is just a brief blast. */
const SHIP_EXPLODE_DWELL = 1.2;   // C18: SHORT — the fall begins sooner (less static "freeze" between phases)
/** Seconds of the SLOW, seamless atmospheric fall (C18 user walk-test: descend slowly + serenely —
 *  watch the planet get closer, space fade to sky, the ground slowly approach). Was 8.0. */
const DESCENT_DURATION = 18.0;
/** Pulls before the lever snaps off — THE GAG (3 pulls → no chute). */
const PARACHUTE_PULLS = 3;
/** Anti-softlock: auto-fire a pull this often if the player just stares (seconds). */
const PARACHUTE_AUTOPULL = 2.5;
/** Beat of silent free-fall after the lever snaps, before impact (seconds). */
const PARACHUTE_SNAP_FALL = 2.0;
/** Impact: seconds to fade to black, then hold in blackout, before waking. */
const IMPACT_FADE = 1.2;
const IMPACT_HOLD = 1.0;
/** Wake: seconds to fade FROM black (come to), then hold, before the desert handoff. */
const WAKE_FADE = 2.5;
const WAKE_HOLD = 1.2;

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
  /** Per-beat scratch — added by later tiers (e.g. parachutePulls, doorBlown).
   *  Kept loose so beat controllers can stash transient state without growing this type. */
  scratch: Record<string, number | boolean>;
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
  ctx.intro.beat = beat;
  ctx.intro.beatStartedAt = ctx.time.elapsed;
  ctx.intro.scratch = {};
}

/** Advance to the next beat in BEAT_ORDER (a beat's trigger calls this when done). */
export function advanceBeat(ctx: GameContext): void {
  if (!ctx.intro) return;
  const i = BEAT_ORDER.indexOf(ctx.intro.beat);
  const next = i >= 0 && i + 1 < BEAT_ORDER.length ? BEAT_ORDER[i + 1] : 'done';
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
  setIntroBlack(0);        // never leave a black overlay over the real game
  setGameHudHidden(false);
  disposeShipScene(ctx);
  disposePodScene(ctx);
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
    showIntroPrompt('Check engines — head to the engine bay');
    intro.scratch.init = true;
  }
  if (ctx.player.body.body.translation().z > SHIP_CORRIDOR_ENTER_Z) advanceBeat(ctx);   // → corridor
}

/** corridor beat — walk aft to the engine bay (the dead-end). Reaching it triggers the
 *  disaster (T0.3); for greybox, advance to enterPod. */
function tickCorridor(ctx: GameContext): void {
  const intro = ctx.intro;
  if (!intro) return;
  if (!intro.scratch.init) {
    hideIntroPrompt();
    intro.scratch.init = true;
  }
  if (ctx.player.body.body.translation().z > SHIP_DEAD_END_Z) advanceBeat(ctx);   // → enterPod
}

/** enterPod beat (T0.3a) — on entry, build the pod + seat the player inside it (mode
 *  seated) looking out the viewport, cue "pull the eject lever". Pulling it (E/click), or
 *  a fallback dwell (anti-softlock), → shipExplode. */
function tickEnterPod(ctx: GameContext, dt: number): void {
  const intro = ctx.intro;
  if (!intro) return;
  if (!intro.scratch.init) {
    ensureInPod(ctx);
    faceControl(ctx, Math.PI / 2, -0.12);   // T1.3 — turn LEFT (−X) to the YELLOW eject control so the "pull the eject lever" cue points at the right control
    showIntroPrompt('Pull the eject lever  [click]');
    intro.scratch.init = true;
    intro.scratch.dwell = 0;
  }
  intro.scratch.dwell = (intro.scratch.dwell as number) + dt;
  if (pulledLever(ctx) || (intro.scratch.dwell as number) > EJECT_FALLBACK) advanceBeat(ctx);   // → shipExplode
}

/** shipExplode beat (T0.3a) — eject fires: the ship dies in a blast (a flash + the cabin briefly
 *  lit by the explosion), then the pod settles UPRIGHT into the slow, serene descent. C18 (user
 *  walk-test): NO tumble — the pod stays upright + level, facing the window; you just watch the
 *  world come up to meet you. (The hero ship explosion staged through this frame = Phase 3.) */
function tickShipExplode(ctx: GameContext, dt: number): void {
  const intro = ctx.intro;
  if (!intro) return;
  if (!intro.scratch.init) {
    flashScreen(0xffe6c0, 0.85);    // the blast flash (the ship dies)
    disposeShipScene(ctx);           // the ship is gone after the blast (greybox; hero ship = Phase 3)
    showIntroPrompt('');
    setDescentProgress(0);           // the orbital vista (planet + stars) through the window
    faceControl(ctx, 0, 0);          // upright, facing the window (−Z) — the pod stays LEVEL (no tumble)
    addTrauma(0.1);                  // a tiny ONE-TIME nudge at the blast (one-shot, decays — not per-frame, so it can't saturate)
    intro.mode = 'seated';           // calm seated FP, free-look (no scripted tumble)
    intro.scratch.init = true;
    intro.scratch.dwell = 0;
  }
  intro.scratch.dwell = (intro.scratch.dwell as number) + dt;
  const d = intro.scratch.dwell as number;
  // A brief warm blast-glow lighting the cabin from the explosion, fading — the pod stays UPRIGHT.
  const glow = Math.max(0, 1 - d / 1.4);    // the blast light decays over ~1.4s to the orbital cool
  setTumbleLight(glow * 0.7);
  if (d > SHIP_EXPLODE_DWELL) advanceBeat(ctx);   // → the slow descent (the calm fall)
}

/** descent beat (T0.3b) — the atmospheric fall: the planet swells (setDescentProgress)
 *  + a low continuous rumble (re-added each frame so it persists). Greybox stand-in for
 *  the Phase-2 descentProgress effect stack. At full progress → parachute. */
function tickDescent(ctx: GameContext, dt: number): void {
  const intro = ctx.intro;
  if (!intro) return;
  if (!intro.scratch.init) {
    ensureInPod(ctx);
    showIntroPrompt('');
    intro.scratch.t = 0;
    intro.scratch.reFlash = false;       // T2.2 — the one-shot re-entry flash hasn't fired yet
    intro.scratch.init = true;
  }
  intro.scratch.t = (intro.scratch.t as number) + dt;
  const progress = Math.min(1, (intro.scratch.t as number) / DESCENT_DURATION);
  setDescentProgress(progress);
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
    intro.scratch.reFlash = true;
  }
  if (progress >= 1) advanceBeat(ctx);   // → parachute
}

/** parachute beat (T0.3b) — THE GAG. Cue the player to pull; each pull (E/click, edge-
 *  triggered) jolts but doesn't deploy; the 3rd pull SNAPS the lever off → a beat of
 *  free-fall → impact. An auto-pull fallback keeps it from softlocking. */
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
    intro.scratch.leverT = 0;        // the lever's current pull pose (jab → settle)
    intro.scratch.init = true;
  }
  // (No per-frame rumble — addTrauma stacks every frame → saturates → the disorienting view-spin.
  //  The gag's punch comes from the ONE-TIME per-yank jolts below; the fall stays calm. C18.)

  // After the lever snaps: it hangs dead off its pivot; a beat of faster free-fall → impact.
  if (intro.scratch.snapped) {
    setParachuteLeverPull(1, true);   // drooped/broken pose
    intro.scratch.t = (intro.scratch.t as number ?? 0) + dt;
    if ((intro.scratch.t as number) > PARACHUTE_SNAP_FALL) advanceBeat(ctx);   // → impact
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
    const pulls = intro.scratch.pulls as number;
    if (pulls >= PARACHUTE_PULLS) {
      // The 3rd pull — the lever snaps off. No chute.
      intro.scratch.snapped = true;
      intro.scratch.t = 0;
      setParachuteLeverPull(1, true);
      flashScreen(0xffffff, 0.25);
      showIntroPrompt('The lever snaps off.');
    } else {
      showIntroPrompt(pulls === 1 ? 'Pull harder!' : 'Come on — PULL!');
    }
  }
}

/** impact beat (T0.4a) — the crash: a hard flash + max trauma, then fade to black + hold
 *  (the blackout). → wake. */
function tickImpact(ctx: GameContext, dt: number): void {
  const intro = ctx.intro;
  if (!intro) return;
  if (!intro.scratch.init) {
    flashScreen(0xffffff, 1.0);
    addTrauma(1.0);
    showIntroPrompt('');
    intro.scratch.t = 0;
    intro.scratch.init = true;
  }
  intro.scratch.t = (intro.scratch.t as number) + dt;
  setIntroBlack(Math.min(1, (intro.scratch.t as number) / IMPACT_FADE));
  if ((intro.scratch.t as number) > IMPACT_FADE + IMPACT_HOLD) advanceBeat(ctx);   // → wake
}

/** wake beat (T0.4a) — come to: fade FROM black (the vision's muffled/ringing rouse;
 *  audio is Phase 5), hold a beat, → stepOut. */
function tickWake(ctx: GameContext, dt: number): void {
  const intro = ctx.intro;
  if (!intro) return;
  if (!intro.scratch.init) {
    intro.mode = 'scripted';
    setIntroBlack(1);
    intro.scratch.t = 0;
    intro.scratch.init = true;
  }
  intro.scratch.t = (intro.scratch.t as number) + dt;
  setIntroBlack(Math.max(0, 1 - (intro.scratch.t as number) / WAKE_FADE));
  if ((intro.scratch.t as number) > WAKE_FADE + WAKE_HOLD) advanceBeat(ctx);   // → stepOut
}

/** stepOut beat (T0.4a) — THE DESERT HANDOFF (R3): teleport the capsule to the real
 *  new-game spawn (captured at start) + endEscapePodIntro (restores HUD/locomotion/survival,
 *  disposes all intro geometry, clears the black). The player is now in the dunes, playing.
 *  T0.4b adds the pod-as-spawn-wreck + the craft/salvage tutorial scaffold. */
function tickStepOut(ctx: GameContext): void {
  const intro = ctx.intro;
  if (!intro) return;
  const rp = intro.returnPos;
  ctx.player.body.body.setTranslation({ x: rp.x, y: rp.y, z: rp.z }, true);
  ctx.player.velocityY = 0;
  ctx.player.cameraSnapNextFrame = true;
  ctx.three.camera.position.set(rp.x, rp.y + ctx.player.eyeOffset, rp.z);
  // T0.4b — place the crashed pod a few metres away + wake looking at it (the "salvage your
  // own pod" seam). The wreck PERSISTS into the real game (endEscapePodIntro won't dispose it).
  const wx = rp.x + 4, wz = rp.z + 4;
  placeCrashedPodWreck(ctx, wx, wz);
  ctx.three.camera.lookAt(wx, ctx.terrain.heightAt(wx, wz) + 1, wz);
  endEscapePodIntro(ctx);   // hand control back — the desert game runs from here
  // T0.4b tutorial scaffold — the first-gameplay hint (real craft→pry→chute-pop is Phase 4).
  ctx.ui.showToast('Salvage your pod — craft a machete to pry it open', { kind: 'discovery' });
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
    case 'corridor': tickCorridor(ctx); break;
    case 'enterPod': tickEnterPod(ctx, dt); break;
    case 'shipExplode': tickShipExplode(ctx, dt); break;
    case 'descent': tickDescent(ctx, dt); break;
    case 'parachute': tickParachute(ctx, dt); break;
    case 'impact': tickImpact(ctx, dt); break;
    case 'wake': tickWake(ctx, dt); break;
    case 'stepOut': tickStepOut(ctx); break;
    // The tutorial (Beats 10-11: craft+salvage + chute-pop) runs as normal gameplay AFTER the
    // handoff (the wreck + the hint from stepOut), not as an intro beat — the hero pass is Phase 4.
    default: break;
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
