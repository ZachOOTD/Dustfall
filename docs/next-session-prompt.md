# Cycle 6 — Kickoff brief: ⏸ S5 save schema plan — THE SANCTIONED PAUSE (campaign "Infinite Sands")

**⚙ A CAMPAIGN IS ACTIVE** — "Infinite Sands", branch `campaign/2026-07-10-procgen`. This is the
ladder's FINAL rung and it is `pause_before: "build"`: this cycle PLANS and PAUSES — it does NOT
build. **Never ship an unreviewed save migration (D81).**

## What this cycle does (and does not)
1. Read the current save architecture end-to-end: `src/persistence/save.ts` (SAVE_VERSION 16,
   the id-keyed patch model, the `crashes[]` seed-addressed precedent, `pickupSurvivors`,
   creature reconciles), D292 (transient exclusions + WHY runtime ids can't persist),
   D290/D295/D296 (descriptor purity — the diff keys must be descriptor-derived).
2. Write the SCHEMA PLAN to `docs/feature-save-per-chunk-diffs.md`:
   - Which per-chunk diffs v1 records (salvage remaining/stripped/extracted per streamed wreck,
     looted streamed fauna, landmark salvage) and which it explicitly does NOT (rocks/scenes are
     stateless; markers are debug).
   - The KEY strategy: diffs keyed by (cx, cz) + a stable within-chunk content id derived from
     the DESCRIPTOR (e.g. poi/landmark piece index), never the runtime registry id (D292's trap).
   - The migration story: SAVE_VERSION 16 → 17 (additive `chunkDiffs` map; old saves load with
     an empty map — zero-loss), the loader's version-range handling, and the seed-binding rule.
   - Apply/capture points: capture on unload + save; apply on chunk load after render.
   - The scrap-ring + silhouette re-enable question (S2 deferred both — does v1 include them?
     Recommend: scrap rings stay off until pickups get descriptor-derived ids; silhouettes are
     S4-backlogged, not save work).
   - Open questions for the human, each with a recommendation.
3. Update `docs/campaign/campaign-log.md` with a cycle entry pointing at the plan.
4. Set `campaign-state.json`: `status: "paused"`, `awaiting_approval: true`,
   `stop_reasons: ["save-version-bump"]`. Commit the plan. **Do NOT ScheduleWakeup — the loop
   ends here.** The human reviews (morning walk-test + the plan) and `/campaign-approve`
   releases the build.

## Context: what's already built (S1-S4 + S6)
The infinite world is functionally complete and hitch-free; every streamed content class is
save-TRANSIENT (regenerates pristine). S5 makes player changes to the far field PERSIST.

## Constraints
D81 (the pause is the point); descriptor purity (D290); the boot world's save round-trip must
stay byte-exact; the plan must be reviewable in one sitting (aim ~150 lines, concrete).

## On stop
`/session-end` (campaign auto-commit of the PLAN + docs) + bookkeeping + verdict
**STOP: save-version-bump** (paused, awaiting approval). Print the 3-line status with the exact
resume action (`/campaign-approve`).
