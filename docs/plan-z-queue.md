# Z-queue plan — overnight round 3 (2026-07-06)

## LIVE STATE (update as waves land — compaction-safe checkpoint)
- ⚠ USAGE-LIMIT CONTINGENCY (2026-07-06 ~night): the user may hit their 5-hour limit; it resets
  at 5AM. IF A NEW SESSION BOOTS FROM THIS FILE: (1) git status — if uncommitted partial edits
  exist in podScene/shipScene they are DEAD agents mid-work: run tsc + the owning unit gates;
  if not verifiably complete, git checkout -- those files and RE-DISPATCH the unit from the
  spec below; (2) resume the wave loop exactly as written; (3) the user expects the morning
  summary when the queue + wrap complete.
- ✅ DONE+PUSHED: Z5a+Z7 `7b1ec69` (90° rotation, player-gated wake) · Z9+Z10 `67fd140` (0.55x far-space time-rate warp; blackouts trimmed: phase 2.3s->1.6s, wake 2.5/1.2->1.8/0.8) · Z1 `9d594fa` (per-cell glass parity — winding/DoubleSide root cause, all 12 cells 0.0% dev; the crown keel centred) · Z6 `8ff11a8` (blast flood->window flare, plasma/shimmer ~40% slower, local cabinDeckFill deck light; pod-parity/descent-strip diagnostic rigs) · Z5b `cb99682` (STRUCTURAL door seal: _addDoorSeal box-section jamb returns on all 4 sides, both hosts — the ~6cm shell-cut sliver each side was the 4th-report root cause; NEW pod-seal-sweep gate: 0 cracks at yaw 0/45/90, sensitivity-proven 156/yaw without the seal) · Z4 `49a20fc` (umbilical plate+hoses were authored INSIDE the pod hull -> relocated to the collar flank, gasket outboard; NEW pod-rotation-clearance gate: 0 violations across the 0->pi/2 sweep; airlock control-panel readout was mounted backwards-in-the-wall -> flipped proud; resting doorway <0.1% everywhere).
- ✅ DONE+PUSHED (wave 3): Z2 `ee46082` (crew-quarters full sci-fi overhaul — built-in berth/lockers/fold-down desk/base-cabinet/panels/vent/conduit; scene-global HemisphereLight REMOVED; 4 rule-9 furniture colliders; PASSED adversarial gate 0 SEV1; 3 refuter-confirmed SEV2s fixed: header-cap seam unified, pillow reproportioned soft, dead wall detailed) + tooling `04e8941` (quarters rig vantages/junctions/quarters-walk probe) · Z8 `04e8941` (parachute round 2 — lines EMBED into the runtime brim [root: build-vs-runtime squash mismatch + grp/dome parent split], flutter 10s->1.6s [pop->settled 5.65s, gag intact], per-vertex gravity drape wrapping the POD_R=1.44 hull to a ground pool; 4-angle + timing-strip verified). z8-*.mjs diagnostics gitignored.
- 🔨 IN FLIGHT (wave 3, LAST UNIT): Z3 reactor room. The reactor REBUILD is BUILT and lives as UNCOMMITTED changes in shipScene.ts (the old engine "blocky cylinders" -> a real containment column/core channel/coils/coolant towers/manifold/control station/hazard rail, two states via setEngineFire calm/critical). It PASSED the CRITICAL-state identity bar but the adversarial gate confirmed fixes now in a FIX PASS (agent, shipScene only): (1) SEV1 CALM core doesn't glow -> add emissive cyan #2fd8e0 + co-located cool light routed off the setEngineFire state driver so calm=cool contained glow, critical=hot breach (must read at close-up AND mid-corridor); (2) SEV1 glass door center mullion bisects the hero core column -> yaw-rotate the reactor ~15-25deg to 3/4 (or lateral offset half a door-leaf, or single-leaf pane) so the mullion crosses the flank not the core; (3) SEV3 coolant-tower cap collars overhang the cylinders with a drip lip -> collar radius <= cylinder radius. Shots scen-z3-r6-*.
- ⚠ IF A COLD SESSION RESUMES HERE: do NOT git checkout shipScene.ts — the uncommitted diff IS the valuable Z3 reactor rebuild. Verify npx tsc --noEmit; if clean, re-dispatch the Z3 FIX PASS agent (procedural-modeler, shipScene only, the 3 findings above) to finish, then run the wrap. Only revert if tsc is broken AND unrecoverable.
- ⏳ NEXT: Z3 fix verify + commit shipScene.ts · wave-4 wrap (full gate suite + bench ~30min DO-NOT-KILL + adversarial journey gate over changed areas + npm run build + deploy + live probes vs https://zachootd.github.io/Dustfall/ + docs [changelog/next-session-prompt/CLAUDE.md] + THE MORNING SUMMARY).

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
