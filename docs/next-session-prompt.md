# ⏸ CAMPAIGN PAUSED — Phase A — Build-out complete (after cycle 36) — `campaign/2026-06-18`

**The campaign is PAUSED for human review (`status:paused`, `awaiting_approval:true`, `stop_reasons:["milestone-review"]`). The unattended Phase-A block (M1→M5b) is DONE. The loop has STOPPED — it will not auto-cycle. To continue, the user reviews + runs `/campaign-approve` (which releases Phase B).**

## What shipped in the unattended run (cycles 13-36, this overnight)
- ✓ **M3** worm arc · ✓ **M4** critters + atmosphere · ✓ **M5** riding & rest feel.
- ✓ **M5a — Exploration & exposure (C28-31):** ◑ horizon-landmark-silhouettes `[partial]` · ✓ salvaged-spyglass · ✓ vista-crest-reveal · ✓ sun-shade-exposure.
- ✓ **M5b — Living world & tone (C32-36):** ✓ wordless-prop-scenes · ✓ wind-mood-soundscape · ✓ rare-sky-phenomena (fireball) · ✓ diurnal-cycle · ◑ worm-far-horizon-crossing `[partial]`.
- Every cycle committed on `campaign/2026-06-18`; verify:all green throughout (placement 0/0 ×5, colliders 0/25); no save-schema bumps.

## ⏵ Human review checklist (do before `/campaign-approve`)
1. **Walk-test the build** (`npm run dev`) — a large FEEL batch is owed (headless can't judge feel):
   - C36 worm-far-horizon timing/feel · C34 fireball in-motion · C33 wind levels/character · C31 sun-shade strength (find a wreck's shadow at midday) · C30 vista-reveal (crest a ridge) · C29 spyglass zoom + the missing aim-down pose · C26 sleep-fade · C27 3P torch flicker · C23/C25 speeder handling + foot-lift.
   - Dev hooks: `__game.triggerFireball()`, `__game.triggerWormCrossing()`, `__game.audioState()`, `__game.sunInfo()`, `__game.setTime(0..1)`. Dev-start inventory has a `spyglass`.
2. **Art-direct the two `[partial]` looks** (these owe a focused visual pass):
   - **C28 horizon-landmark-silhouettes** — the fog-resistant nav-silhouette SYSTEM works; the LOOK wants a per-model impostor (RTT the actual wreck outline) + ground-tuck + far-boldness (backlog §A).
   - **C36 worm-far-horizon-crossing** — the decoupled distant-worm SYSTEM works; the silhouette wants a breach berm (erupt THROUGH the dune) + colossal scale + a multi-S spine + a dust wake (backlog §A). This is the one to art-direct — the colossal-worm awe needs your eye.
3. **Silent systems** to decide on: the day/night-LIFE beds + MUSIC are still silent (empty CC0 pack; C33 synthesized only the WIND) — synthesize them procedurally, or source samples? (backlog)
4. **Phase-B (M6-M10) design review** — these were design-gated; make the calls now. See `docs/iteration-plan.md` + the GDD. The no-endgame direction stands (keep open-ended "days survived"; no storm-finale).

## After `/campaign-approve` → cycle 37 picks up Phase B
The approve folds the Phase-B plan into the roadmap "Up next" + releases the loop. Likely first: the highest-value M6 unit per the design review. Re-run `/loop /campaign-cycle` to resume the unattended loop once Phase B is approved.

## Full backlog of owed polish/feel: `docs/backlog.md` (§A has the C28-C36 follow-ups). Per-cycle detail: `docs/campaign/campaign-log.md`.
