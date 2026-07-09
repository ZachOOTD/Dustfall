# Campaign cycle 4 — Kickoff Brief (Sharpen & Deepen · after cycle 3: M4 shipped)

**A campaign is ACTIVE** — boot from `docs/campaign/campaign-state.json` + `campaign.md`. Charter wins on conflict.

## Read these first
1. `CLAUDE.md` + `docs/campaign/campaign.md` + `campaign-state.json` + `steering.md` (inbox).
2. `docs/campaign/campaign-log.md` cycles 1-3.

## Cycle 4 focus: M5 — Living world (diurnal-cycle)
Bind the existing fauna to time-of-day (iteration-plan M5b `diurnal-cycle`): lizards DIURNAL (active by day, sheltering/still at night), shrews CREPUSCULAR (dawn/dusk activity peaks), vultures circle by DAY (grounded/absent at night), worms stir at TWILIGHT (the twilight-breach ambient already exists — `_isTwilightBreach`, D121 — verify + extend activity gating, don't duplicate it). **Feature-audit first**: grep each creature's update for existing time-of-day hooks before building — C-series cycles may have partial diurnal behavior already (the cycle-1 lesson: the code never lies).

Implementation shape: per-creature activity gate/scalar driven by `ctx.time.sunHeight` (spawn rates, movement speed, or state-machine biases — pick the lightest lever per creature that reads clearly). All tuning constants → `tuning.ts`. NO save-schema changes expected (transient behavior); if one becomes necessary ⇒ PAUSE (D81).

**Verify** (headless): a NEW rig-shot `diurnal-probe` scenario — `setTime` across {noon, midnight, dawn} and assert measurable activity deltas per species (e.g. lizard mean speed / active-state fraction over N sim frames; vulture airborne count; shrew activity at dawn > noon). Plus the standing suite.

## Gates (every cycle)
`npm run verify:all` + `smoke-intro` + `smoke-pod-tutorial` + `pickup-take-sweep` + `survival-probe` + `ambient-beds`. rig-shot `--port=52xx`.

## Constraints
No endgame · no tone change · additive-save-only (bump ⇒ PAUSE) · no new pillars · wind muted · Phase-A feel-pile excluded (this is ACTIVITY gating, not the worm charge-dive/vulture-motion FEEL work — don't drift into it).

## Footguns
- The worm twilight-breach flag bypasses combat side-effects (D121) — reuse its pattern for non-hostile ambient behavior.
- `ctx.player.body` rebuilt by `enterGame(dev)`; live-scenario boots default 3P; `__interactionDebug` taps the ray (cycle-1 lessons).
- Sim-frame probes: drive time with `g.setTime`, tick via rAF frames; read state, don't screenshot.

## On stop
Session-end docs → cycle commit on `campaign/2026-07-09` → verdict → ScheduleWakeup if CONTINUE.
