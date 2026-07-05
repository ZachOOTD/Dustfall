# Next session — OVERNIGHT LIVE-FIX MARATHON COMPLETE (2026-07-05); the released game hardened

The game RELEASED to master + GitHub Pages yesterday; the user's first live playthrough filed
9 defect rounds (steering-archive 2026-07-05, rounds 1a-1j) + granted overnight autonomy.
ALL of it shipped tonight, plus proactive work. Live at https://zachootd.github.io/Dustfall/.

## What shipped overnight (all pushed to master; per-unit detail in git log 8bfaf2b..15c2c58)
- **The dome base/perimeter unified** (one _domeSillRing drives glass/base/floor/colliders):
  closure gaps sealed, GLASS COLLISION at every azimuth (new cockpit-glass-seal gate — the
  old 3-direction probe passed while a hole existed), floor re-lofted to the dome footprint,
  the cockpit↔corridor threshold star-slots sealed, two-sided glaze tuned transparent.
- **The pod doorway truth**: the "sheet of metal" = the scorch-fade + foot lathes never gapped
  at the door (raycast-proven 42→0); sightline pipes relocated; the AIRTIGHT door rebate
  (36/36 edge rays sealed) on both builds.
- **The sequence-break watchdog**: escaping the hull during ship beats now rescues to the
  spawn (the user's "world lighting broken" = they fell 3000m with the intro active — the
  state-restore code was proven clean by 3 converging probes). + __game.lightDebug().
- **THE HERO SHIP EXPLOSION IS VISIBLE FOR THE FIRST TIME**: the FX planes were never
  billboarded + the porthole glass depth-write killed every additive pass — the pillar beat
  showed a black window since it was authored (studio-vantage false-passes). Now a staged
  reactor detonation (flash → aft fireball → spine secondaries → recognizable hull pieces →
  shockwave → ember husk) through the glass.
- **Flanks + the ship-wide z-fight sweep**: one service spine per flank; the archway reveal
  was the biggest real z-fighter (1.082%→0.001% flicker); 444 pairs triaged; 18 pre-merge
  floaters→1 (unreachable); new zfight-probe rig scenario.
- **Perf**: the full profile (docs/research/perf-profile-2026-07-05.md) — verdict: NOT at the
  browser's limit (~580 steady draws; worst 2323 = unmerged POI with scoped fixes); Leviathan
  merged 16→5; +66 shader variants prewarmed (detonation compile hitch gone; PRELOAD entry
  20.4ms, 0 stutters).
- **The full-journey adversarial gate**: PASS (0 confirmed SEV1); its real SEV2s fixed (cabin
  dangle→clamped conduit + the DEAD wake-spark toggle restored; floor tread taper; can-light/
  brace clash; the planet depth-occluder shell + anchor truth stamp). TWO more rig-truth
  repairs: the crashed-pod scenario drove the DEV-ONLY wreck (4 phantom findings); the cockpit
  mirror placed the planet at a stale anchor (the "stars through the planet" read).

## For the user's next playthrough
Everything from rounds 1a-1j is fixed + live. Flags for their eyes: the glaze transparency
balance (tuned per their note — final say is theirs), the felt eject rhythm (lever pull →
rotate → blast), the explosion staging timing (SHIP_BLAST_AT in sequence.ts if they want it
earlier/later), the collar depth in motion.

## Standing next steps (documented, not started)
Pickup instancing (perf candidate 1 — HUMAN-ATTENDED per D263) · light-pool trim (candidate 4,
needs real-GPU measurement) · the audio mix listen-pass · Skyfall wreck + CAVE rework
(attended sessions). Rule 9 + the model-stage/lint/adversarial-gate discipline stand.

## ⏸ PAUSE POINT (2026-07-05, mid-day) — RESUME HERE
The user paused mid-round-2d. Everything through `12de55b` is committed/pushed/deployed
(the world-lighting root fix + doorway skin + glass round 3 + the chute life-cycle — dist
built + live). ONE ITEM IN FLIGHT WAS REVERTED to keep the tree clean: **round 2d (glass:
remove the fuzzy-star speckles through the glass · slightly-less haze with MACHINE-MEASURED
per-region parity ±10% · consolidate to ONE ceiling light)** — spec verbatim in
steering-archive round 2d; re-dispatch a modeler agent on the shipScene cockpit region with
diagnose-by-elimination for the fuzzy stars + pixel-luminance parity verification. Also
still open from the night's flags: the chute flutter/collapse FEEL (walk-test), the eject
rhythm, the explosion timing (SHIP_BLAST_AT).
