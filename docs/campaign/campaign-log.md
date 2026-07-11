# Campaign log — Dustfall "Infinite Sands" (started 2026-07-10, overnight)

Newest cycle at top. Prior campaigns archived in this directory:
`*-2026-07-09-sharpen-deepen.*` (PAUSED at M7 Skyfall plan-review — resume later by
restoring those files + `/campaign-approve`; the Skyfall plan itself is
`docs/feature-skyfall.md`) and `*-2026-06-18.*` (complete).

---

## Cycle 0 — campaign started (2026-07-10)

- **Goal:** infinite deterministic chunk-streamed world per `docs/feature-infinite-procgen.md`.
- **Design decisions (user, 2026-07-09):** ~112m chunks / fog-radius loading; deterministic (seed → same world); DISTRIBUTED rare landmarks; the escape-pod intro stays the fixed start; save v1 = FULL per-chunk diffs (bump pauses at S5).
- **Ladder:** S1 spike+probes → S2 POI streaming → S3 scatter/creatures → S4 landmarks/biomes → S6 perf → ⏸ S5 save (the one sanctioned pause, BEFORE building).
- **Budget:** 50 cycles / ~10M soft. Branch `campaign/2026-07-10-procgen` off master @ 10a27f2 (post-playtest-fixes + the kickoff brief).
- **Guard:** `.gamedev-framework/overnight.lock` present; the destructive-action hook confirmed in `.claude/settings.local.json`.
- **Next:** cycle 1 = S1.
