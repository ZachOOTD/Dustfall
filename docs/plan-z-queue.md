# Z-queue plan — overnight round 3 (2026-07-06)

## LIVE STATE (update as waves land — compaction-safe checkpoint)
- ✅ DONE+PUSHED: Z5a+Z7 `7b1ec69` (90° rotation, player-gated wake) · Z9+Z10 `67fd140` (0.55x far-space time-rate warp; blackouts trimmed: phase 2.3s->1.6s, wake 2.5/1.2->1.8/0.8) · Z1 `9d594fa` (per-cell glass parity — winding/DoubleSide root cause, all 12 cells 0.0% dev; the crown keel centred).
- 🔨 IN FLIGHT: Z6 (podScene: explosion-bright + descent light-streak + landed floor + parity strip, port 5191) · Z4 (shipScene bay: the intrusion sweep w/ a NEW pod-rotation-clearance rig gate [evidence: verification/probe-rotate-{73,90}-porthole.png] + airlock edge flicker, port 5192).
- ⏳ NEXT: Z5b (podScene: sealed-door edge gaps in the ROTATED state — after Z6) · Z8 (podScene: chute lines/2-3s flutter/gravity drape — after Z5b) · Z2 quarters overhaul + Z3 reactor room (shipScene serial, after Z4) · wave-4 wrap (suite+bench+journey gate+build+deploy+live probes+docs+morning summary).

## Units × file ownership (shipScene units run SERIALLY, one agent at a time; podScene in parallel)

**Wave 1 (parallel):**
- **Z1 (shipScene, cockpit):** glass haze parity at the EDGE/TOP cells — extend the
  cockpit-glass-luma probe to sample every closure strip + literal crown cell (per-CELL, not
  per-region); tune to ±10% of the front panes. + The asymmetric crown connector: the
  hull-arch→dome member must run centre-of-hull → centre crown node (symmetric).
- **Z6 (podScene):** ONE-POD parity, the remaining deltas — (a) the explosion-phase bright/
  wrong-model read (diagnose which instance/lighting the player is actually in during the
  recede; compare against the descent cabin); (b) the descent "light textures moving super
  fast inside" glitch (suspects: the plasma/heat-shimmer FX leaking inside, porthole-spill
  flicker, or speed-coupled z-shimmer — reproduce with a descent strip, name it, fix it);
  (c) the landed floor's rusty texture vs the ride deck (deck material must be identical —
  find the unify/landed path's divergent floor material).
- **Z5a+Z7 (sequence.ts, orchestrator):** rotation angle 180°→~65-90° computed to FRAME THE
  PLANET through the porthole (read the sky's spaceAnchorDir truth stamp; clamp 45-90°); the
  wake door-kick becomes PLAYER-GATED (prompt 'Kick the door open [E]'; the auto-kick timer
  removed — pure player gate per the B2 precedent).

**Wave 2 (after Z1 frees shipScene; podScene freed by Z6):**
- **Z4 (shipScene, bay):** airlock doorway edge clipping (flicker probe) + THE INTRUSION
  SWEEP: no ship geometry may penetrate the pod's interior volume at yaw 0 NOR at any angle
  of the rotation sweep (drive setBayPodYaw 0→final stepwise; ray/AABB-test the interior
  volume against ship meshes each step — a machine gate, kept as a rig scenario).
- **Z5b (podScene):** the sealed door's edge gaps in the ROTATED state (diagnose why the
  rebate doesn't cover at that vantage/lighting; the door must read flush, zero gaps, at
  every rotation angle) — coordinates with Z4's sweep.
- **Z8 (podScene, after Z5b):** parachute round 2 — lines connect INTO the canopy brim
  (terminate in the fabric, not short of it); flutter shortened to ~2-3s (deflate begins
  1-2s after full deploy); THE DRAPE pushed to gravity-truth: the canopy falls down the
  pod's flank and WRAPS the hull curve (contact-conforming folds, catenary sags, possibly a
  small one-shot verlet settle baked at collapse time if stable) — verified from 4+ angles.

**Wave 3 (shipScene serial):**
- **Z2 (shipScene, quarters):** the FULL sci-fi cabin overhaul — built-in bunk alcove,
  integrated storage/desk, paneled walls with purposeful detail, proper lighting; nothing
  overlapping; the hero treatment (5-8 rounds + adversarial gate). + The doorway clipping
  (3rd report): flicker-probe at the player's real vantages until <0.1%.
- **Z3 (shipScene, engine room):** the reactor-room spectacle through the glass — a real
  core (column/torus), coil arrays, manifolds, gauges, emissive glow, cabling — composed
  for the through-glass view; setEngineFire staging intact.

**Wave 4 — the wrap:** full gate suite + bench + the adversarial journey gate over changed
areas + build + deploy + live probes + docs + the morning summary.
