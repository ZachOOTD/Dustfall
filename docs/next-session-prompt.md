# Campaign cycle 8 — Kickoff Brief (Sharpen & Deepen · M7 Skyfall — the SANCTIONED PAUSE)

**A campaign is ACTIVE** — boot from `docs/campaign/campaign-state.json` + `campaign.md`. **M6 is COMPLETE (3 archetypes).** The next milestone is **M7 Skyfall, tagged `[feel-critical]`.**

## ⚠ This cycle does NOT build — it PLANS then PAUSES
Per campaign-cycle Step 4a, a `[feel-critical]` item STOPS before building:
1. `/feature-slice` M7 Skyfall into a multi-cycle sub-plan → write `docs/feature-skyfall.md` with an explicit Definition of Done and per-cycle sub-tasks (blockout → interior → colliders → hero-detail).
2. Set `awaiting_approval: true`, `status: "paused"`, `stop_reasons: ["plan-review"]` in `campaign-state.json`.
3. Log the pause in `campaign-log.md`; write the plan summary so the human can review async.
4. **Do NOT schedule another wakeup** — STOP. The human reviews `docs/feature-skyfall.md`, then runs `/campaign-approve` to release the build.

## M7 Skyfall — the spec (from the user, verbatim + charter)
- **A NEW enterable hero wreck.** Scale = **similar to the intro ship** you start on; an **enterable interior of similar-or-larger scale**.
- **Build ON the intro-ship interior tech** (`src/world/escapePodIntro/shipScene.ts`: D-section hull, room colliders, doorways, rule-9 collider discipline) — reuse guarantees the scale-match + de-risks collision.
- Research-first → blockout → **PAUSE for human walk-test** (enter it; verify collision + intro-ship scale) → hero-detail via the `procedural-modeler` agent + the adversarial-visual gate (HERO bar: 5-8 rounds, positive quality target, defining quality may NOT be routed to backlog).
- Two sanctioned pauses will occur: (a) THIS cycle's plan-review (up front), (b) the post-blockout walk-test before hero-detail.

## Feature-slice guidance (what to put in docs/feature-skyfall.md)
- **DoD**: a new enterable hero wreck the player can walk into, at intro-ship scale, collision-correct (rule 9 — colliders match the visible geometry, verified by a real-motion walk probe), hero-detailed to released-game quality, placed in the world (a fixed hero landmark, not procgen scatter — mirror `heroLandmarks.ts` / `leviathanLandmark.ts`).
- **Sub-tasks (one per cycle)**: e.g. S1 research + exterior blockout (silhouette, hull sections, scale-match to the intro ship); S2 enterable interior layout (rooms, doorways, floor/ceiling, collider shell); S3 collision correctness + a walk-probe gate; S4-S6 hero-detail passes (materials, greebles, story dressing) via procedural-modeler.
- Note the intro-ship reuse points + the known collision footguns (memory: stale colliders behind reworked geometry; verify with a real-motion probe, not clearance numbers).
- Flag: does Skyfall need a `SAVE_VERSION` bump (a new persistent salvageable/enterable)? If so that's the OTHER sanctioned pause (D81) — call it out in the plan.

## Gates (still run them if you touch code — but this cycle is plan-only)
`verify:all` + `smoke-intro` + `smoke-pod-tutorial` + `pickup-take-sweep` + `survival-probe` + `ambient-beds` + `diurnal-probe`.

## Constraints
No endgame · no tone change · additive-save-only (bump ⇒ PAUSE) · wind muted · feel-pile excluded.

## On stop (this cycle)
Write the plan → set the pause flags → log → STOP (no ScheduleWakeup). Human resumes with `/campaign-approve` after reviewing `docs/feature-skyfall.md`.
