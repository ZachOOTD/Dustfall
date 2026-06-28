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
import { buildShipScene, disposeShipScene, getShipSpawn } from './shipScene.ts';

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
  ctx.intro = {
    active: true,
    beat: 'cockpit',
    beatStartedAt: ctx.time.elapsed,
    mode: 'scripted',
    scratch: {},
  };
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

/** End the intro + hand control back to the normal game. Tears down the greybox ship
 *  (T0.2). T0.4 will teleport the player to the desert spawn + mark `introComplete` in
 *  the save; for now this clears the flag + disposes the ship geometry. */
export function endEscapePodIntro(ctx: GameContext): void {
  if (!ctx.intro) return;
  ctx.intro.active = false;
  ctx.intro.beat = 'done';
  disposeShipScene(ctx);
}

/** Cockpit beat (T0.2a) — on first entry, build the greybox ship + drop the player
 *  capsule into the bridge facing the window, in WALK mode (so the space is walkable
 *  for the blockout). T0.2b adds the "check engines" prompt + the advance trigger. */
function tickCockpit(ctx: GameContext): void {
  const intro = ctx.intro;
  if (!intro || intro.scratch.shipBuilt) return;
  buildShipScene(ctx);
  const spawn = getShipSpawn(ctx);
  const pb = ctx.player.body;
  pb.body.setTranslation({ x: spawn.x, y: spawn.y, z: spawn.z }, true);
  ctx.player.velocityY = 0;
  ctx.player.cameraSnapNextFrame = true;
  ctx.three.camera.position.set(spawn.x, spawn.y + ctx.player.eyeOffset, spawn.z);
  ctx.three.camera.rotation.set(0, 0, 0);   // face −Z → straight out the window
  intro.mode = 'walk';                        // T0.2a: walkable for the blockout (T0.2b → seated open)
  intro.scratch.shipBuilt = true;
}

/** Per-frame intro driver — inserted into the main tick BEFORE updatePlayer. No-op
 *  unless the intro is active. T0.0: the beat-dispatch skeleton; the per-beat
 *  controllers (camera/locomotion/FX + the advance triggers) land in T0.2+. */
export function updateEscapePodIntro(ctx: GameContext, _dt: number): void {
  const intro = ctx.intro;
  if (!intro || !intro.active) return;
  switch (intro.beat) {
    case 'cockpit':
      tickCockpit(ctx);
      break;
    // T0.2b+ — each remaining case drives its beat + calls advanceBeat()/jumpToBeat()
    // on its trigger (checkEngines walk-out, corridor end → disaster, descent, …).
    default:
      break;
  }
}
