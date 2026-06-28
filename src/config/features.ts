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

  /** M9 ⑪ (C53 spike, D257) — rideable sled: stand on a towed sled + ride it as the speeder
   *  pulls it. OFF = the proven non-ride tow (the player walks/tows; D125 tabled the old
   *  delta-based ride). ON = the experimental ride via the SPEEDER's proven seat-teleport
   *  pattern ("Option C" per D125 — while riding, gate `updatePlayer` like `speeder.mounted`
   *  + teleport the capsule to a sled rider-seat each frame in `updateSleds`, bypassing the
   *  KCC slope/contact issues that killed the old attempts). Landed INERT here by the C53
   *  spike (gate-and-wait); the ⑪-build wires it + the user walk-tests the ride feel before any
   *  flip (riding FEEL is the exact D125 failure mode — headless can't judge it). */
  rideableSled: false,

  /** M10 ⑮ (C58) — repairable speeder (the "craftable hover-bike" = ONE vehicle, two states).
   *  OFF = the speeder spawns WORKING + rideable (the proven flow; current game unchanged).
   *  ON = it spawns BROKEN (grounded, dead, unmountable) and must be REPAIRED with scrap
   *  (E on it → consumes scrap → restored to a hovering, rideable bike). Default OFF because
   *  the broken-spawn flow is COUPLED to the deferred ⑯ drop-pod-intro (the intended "arrive →
   *  find your speeder broken → repair it" beat); this lands the repair MECHANIC behind the
   *  flag so the user walk-tests it + the ⑯ flow wires it in later. Additive save (`broken?`),
   *  no SAVE_VERSION bump. */
  repairableSpeeder: false,

  /** Escape-pod intro (dedicated campaign, 2026-06-28) — the first-person crash-landing
   *  opening: cockpit → ship disaster → escape pod → eject → ship explosion → atmospheric
   *  descent → parachute-fail gag → crash → wake → desert reveal → craft+salvage tutorial.
   *  OFF = the current new-game spawn runs (the proven path; dev mode always uses it). ON =
   *  a NEW game plays the intro sequence instead, handing off to the desert at the spawn.
   *  Built behind this flag per the gate-and-wait pattern (full plan:
   *  docs/feature-escape-pod-intro.md). Landed INERT by T0.0 (the sequence framework
   *  scaffold); T0.1 wires the new-game branch. The `introComplete` save field is additive
   *  (legacy saves default true → never replay) — no SAVE_VERSION bump. */
  escapePodIntro: false,
} as const;

/** A valid feature-flag key (e.g. for a dev-panel toggle list later). */
export type FeatureFlag = keyof typeof FEATURES;
