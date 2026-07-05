# Campaign — Dustfall: Escape-Pod Intro

**Goal:** build the game's opening — the first-person escape-pod intro sequence — to a
world-class, shippable bar, exactly as captured in `docs/feature-escape-pod-intro.md`
(vision + approved enrichments E1-E10 + the phased BUILD PLAN). **Definition of Done:** a new
game plays the entire sequence (Beats 0-11: cockpit → disaster → escape → eject → ship explosion →
beautiful descent → parachute gag → crash → wake → desert reveal → craft+salvage tutorial → the
chute-pop payoff) hero-quality, behind `FEATURES.escapePodIntro`.

**Started:** 2026-06-28
**Branch:** `campaign/escape-pod-intro` (off `master`; commits every cycle)
**Budget:** max-cycles **150** (a high safety backstop, NOT a target) · `until: roadmap-empty`
(build the whole plan) · no soft token ceiling (the user opted into a large, quality-maxed run).
**Checkpoint policy:** **milestone** — markers sit at **PHASE boundaries** (Phase 0 greybox spine →
1 pod → 2 descent → 3 ship → 4 crash/tutorial → 5 audio). The loop pauses after each phase for the
user's **walk-test** (this is a feel/look-critical feature — feel/audio can't be self-verified).
**Self-author policy:** propose.
**Status:** active.

## Operating rules (this campaign)
- **ENRICH-NOT-CUT.** The scope-cut list in the feature doc is a TRUE-TECHNICAL-WALL safety net
  ONLY — never a target, always surfaced to the user before any cut. The spine + pod + descent +
  tutorial are NOT cuttable. If anything, propose enrichments (self-author=propose).
- **Hero geometry/FX → the `procedural-modeler` agent**, iterated to a quality BAR (5-8 rounds new
  hero elements). **Real first-person in-game-view** visual gate (not an isolated rig). **Anti-punt.**
- Behind `FEATURES.escapePodIntro` (default off until shipped). **No `SAVE_VERSION` bump** unless
  unavoidable (D81) — the `introComplete` save marker is additive (legacy = true).
- New game → the intro; the old spawn → **dev-mode only**.
- Verify gate each cycle: `npm run verify:all` (tsc + placement 0/0 ×5 + colliders 0/40) + the new
  `feature-escape-pod-intro` sequence smoke check. Per-phase: the user's walk-test.

## How to steer this campaign
- Watch progress: read `campaign-log.md` or run `/campaign-status`.
- Redirect: write a note in `steering.md` — picked up at the next cycle boundary (no need to stop the loop).
- At a PHASE checkpoint: walk-test the build (`npm run dev`), then `/campaign-approve` to release the next phase.
- Stop: write "pause" in `steering.md`, or stop the `/loop`.

## Prior campaign
The M11→M13 review-fix pass (campaign `campaign/2026-06-18`, 69 cycles, ~18.5M tokens) COMPLETED +
was user-approved. Its chronicle is archived at `campaign-log-2026-06-18-m1-m13.md`.
