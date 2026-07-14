# Next cycle (17) — M7-R part 4 (FINAL): the captain's-log story

**State:** campaign "Sharpen & Deepen" `active` on `campaign/2026-07-12-skyfall` (16 cycles, ~5.45M/8.75M
spent; ~3.3M left of the +4M cap). Checkpoint none. Queue: **M7-R (final fix) → M8 → M9 → M10 → M11 → M12**.

## M7-R progress
- ✅ part 1 (c14, D304): real hull thickness (paper-thin fix) + 100% exterior collision.
- ✅ part 2 (c15): interior floating-model audit (8 grounded flush) + more interior detail.
- ✅ part 3 (c16): broken cockpit glass (shattered canopy) + reversible cabin-visibility fill
  (`SKYFALL_CABIN_FILL`; =0 for darker).
- **FINAL (cycle 17): the captain's-log story.** User: "need some kind of captains log... maybe says
  the crew is ejecting in the drop pods and have a little story." The wreck already has a crash-log
  journal on the bow console (S6 — `placeSkyfallWreck` → `placeJournal` + `generateCrashLog(seed,'freighter')`).
  Replace the generic freighter lore with a BESPOKE Skyfall log: the captain ordering the crew to
  EVACUATE IN THE DROP PODS as the freighter goes down — a short, melancholy, environmental-story log
  (the GDD's "the world tells you what happened by what's left"). Likely: add a dedicated Skyfall crash
  role / content in `crashLog.ts` (or pass explicit `content` from `skyfallWreck.ts`), a few dated
  entries building to the evac order + the captain staying / going down with the ship. Keep it short
  (fits the journal panel), no new save schema (journal content is text). Ties the empty wreck to the
  world + a future drop-pod feature.
  Gate: verify:all + skyfall-walk PASS + the loot/journal numeric probe (journal still registers +
  tears down clean); read the log text in-panel if a probe can (or just verify it's wired).
  **After this ships, M7-R is COMPLETE** → session-end moves M7-R to Shipped; next cycle picks up M8.

## The world-deepening queue (after M7-R)
M8 far-field vultures → M9 new POI archetypes → M10 story vignettes → M11 retire legacy tube-wrecks
(ship→socket, D227/D249) → M12 new far-field biome. Each its own `/feature-slice` when reached
(M8 first: solve the D294 chunk-model tension for aerial life — region-rolled perch/placement rework).

## Standing constraints (steering.md)
- **models-need-thickness** (rule 7) · **100% collision** (rule 9, swept) · determinism (D290) +
  streamed-teardown (D292/rule 9) · no save-schema change without the D81 pause · GPU probe default.
- Cleanup owed (guard-blocked): remove the stray untracked `scratch-baseline/` dir in the morning.
