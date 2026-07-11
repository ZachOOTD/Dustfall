# Campaign log — Dustfall "Infinite Sands" (started 2026-07-10, overnight)

Newest cycle at top. Prior campaigns archived in this directory:
`*-2026-07-09-sharpen-deepen.*` (PAUSED at M7 Skyfall plan-review — resume later by
restoring those files + `/campaign-approve`; the Skyfall plan itself is
`docs/feature-skyfall.md`) and `*-2026-06-18.*` (complete).

---

## Cycle 1 — S1 ChunkManager spike (2026-07-11) — SHIPPED

- **Planned:** S1 — the chunk grid + per-chunk deterministic seed + load/unload with full disposal, proven by marker posts + the two NEW permanent gates (determinism + streaming/leak).
- **Shipped:**
  - Terrain STREAMS: `terrain.ts` fixed 3×3 grid → an anchor-margin tile ring (24m margin) following the player; full tile disposal; `heightAt` infinite (closed-form fallback); one shared terrain material (fixed a `_shaderRefs` leak-under-streaming). Boot ring byte-identical to the old grid — the intro region untouched (placement 0-fails ×5 seeds).
  - NEW `src/world/chunkManager.ts`: 112m content chunks, r3, 8m anchor margin, `chunkSeed` avalanche + PURE `describeChunk` descriptors (D290), full Rapier/mesh teardown, marker spike content (off by default; `__game.setChunkMarkers`).
  - NEW permanent gates in `verify:all` (`npm run verify:chunks`): `chunk-determinism` (2 seeds + cross-seed digest distinctness) + `chunk-streaming` (4-leg walk to +1500m: terrain follows, collider≡heightAt, bounded set, no seam dupes, byte-identical reload, body-count baseline ±3).
  - Tooling: rig-shot `startDev` 30s→120s; walk probes at 320×240; `chunk-vista` scenario; `__game.chunkDescribe/chunkStats/resetWormCrossing`.
- **Verify:** ALL GREEN — tsc, placement (5 seeds, 0 fails), colliders (55), chunk-determinism (8/8 ×2 seeds, digests differ), chunk-streaming (bodies 332→330, chunks 49/49, tiles 9), smoke-intro `{ok,beats:12}`, smoke-pod-tutorial ok, pickup-take-sweep 0 fails, survival-probe PASS, diurnal-probe PASS. (Several boot-window flakes under concurrent machine load — root-caused to Vite cold boots >30s, fixed by the 120s window; each gate re-run green.)
- **Visual iteration:** placement-sanity bar (systems cycle, per charter) — 4 player-eye `chunk-vista` shots at/past +1500m, 3 identify/reframe rounds (the two "photobombers" were a dune slip face + the ambient worm-crossing ridge — explained, not regressions). No hero bar owed.
- **Design deltas mid-cycle (probe-driven):** the first trim design (settle-frame counter) was replaced by the ANCHOR-MARGIN model after the streaming probe caught corner micro-slide starvation (D288/D289 — the probe did its job before anything shipped).
- **D-entries:** D288 (two-grid anchor-margin streaming architecture, friction 3), D289 (heightAt infinite fallback), D290 (descriptor-pure chunk content — the S2 contract), D291 (walk-probe discipline). decisions.md archived D236–D246 (45 active).
- **Spend:** ~250K output tokens this cycle (campaign total ~250K / 10M; cycle 1/50).
- **Commit:** (SHA recorded on commit — see below.)
- **Next:** cycle 2 = **S2 POI streaming** (brief in `docs/next-session-prompt.md`; the descriptor-first contract is D290).
- **Pending post-mortem drafts:** queued to `.post-mortem-pending/` (consolidate skipped — unattended campaign).

## Cycle 0 — campaign started (2026-07-10)

- **Goal:** infinite deterministic chunk-streamed world per `docs/feature-infinite-procgen.md`.
- **Design decisions (user, 2026-07-09):** ~112m chunks / fog-radius loading; deterministic (seed → same world); DISTRIBUTED rare landmarks; the escape-pod intro stays the fixed start; save v1 = FULL per-chunk diffs (bump pauses at S5).
- **Ladder:** S1 spike+probes → S2 POI streaming → S3 scatter/creatures → S4 landmarks/biomes → S6 perf → ⏸ S5 save (the one sanctioned pause, BEFORE building).
- **Budget:** 50 cycles / ~10M soft. Branch `campaign/2026-07-10-procgen` off master @ 10a27f2 (post-playtest-fixes + the kickoff brief).
- **Guard:** `.gamedev-framework/overnight.lock` present; the destructive-action hook confirmed in `.claude/settings.local.json`.
- **Next:** cycle 1 = S1.
