// Feature flags — the central toggle home for gate-and-wait experimental systems.
// (Sibling of tuning.ts: magic numbers live there, on/off switches live here.)
//
// THE GATE-AND-WAIT PATTERN (iteration-plan M9 / Cycles 3-4): land an experimental
// reimplementation of a load-bearing system BEHIND a flag, defaulting OFF so the
// proven path still runs, types compile, and every existing flow is untouched —
// then flip it ON in ONE focused move once the new path is validated in isolation.
// This file is the single place those toggles live, so flipping a system is a
// one-line, fully-reversible change (and `git grep FEATURES.<flag>` finds every
// branch the flag gates).
//
// CONVENTION: every flag defaults to FALSE = the shipped, proven behaviour. A flag
// set TRUE selects the experimental path. Keep flags grouped + documented; remove a
// flag (inlining the winning path) once an experiment is permanently adopted or cut.
//
// Landed inert (campaign M2, 2026-06-18) ahead of the M9 architectural-risk cycles
// that consume it (`real-rope-physics` depends on `feature-flags-infra`). Nothing
// reads these yet — that's intentional; this is the scaffold those cycles flip.

export const FEATURES = {
  /** Real rope physics — a Verlet/segmented rope SIM replacing the inextensible
   *  position-snap constraint (D126, `ropeConstraint.ts`). OFF = the proven
   *  inextensible path runs (sled tow / companion tether / stake / kill-drag all
   *  unchanged). ON = the experimental Verlet sim (hangs/drags/goes-taut). Flipped
   *  + validated in the M9 `real-rope-physics` cycle; CCD-from-the-start per D124. */
  realRope: false,

  /** Real cloth physics — Verlet/spring-mass on fabric panels (tent walls, the
   *  large-tent door, the player tunic). Shares the realRope solver, so it depends
   *  on `realRope` landing first. OFF = the current shader-only fabric (the
   *  `fabricMaterial` vertex-shader wind ripple). M9 `real-cloth-physics`. */
  realCloth: false,

  /** M6 ④ (C40) — diegetic survival: remove the always-on HUD stat bars and surface
   *  survival state through DIEGETIC tells instead (screen-edge vignettes per stat +
   *  procedural audio: heartbeat at low health, stomach growl when starving). OFF = the
   *  classic stat bars always show (the proven floor). ON = the bars hide by default and
   *  the player FEELS their state; a pause-menu toggle (`settings.diegeticSurvival`,
   *  default-ON when this flag is on) lets them switch the bars back any time. Flipped ON
   *  in C40 once the headless + visual gates passed; the user vetoes FEEL at the review. */
  diegeticSurvival: true,
} as const;

/** A valid feature-flag key (e.g. for a dev-panel toggle list later). */
export type FeatureFlag = keyof typeof FEATURES;
