# Campaign log — Dustfall "Infinite Sands" (started 2026-07-10, overnight)

Newest cycle at top. Prior campaigns archived in this directory:
`*-2026-07-09-sharpen-deepen.*` (PAUSED at M7 Skyfall plan-review — resume later by
restoring those files + `/campaign-approve`; the Skyfall plan itself is
`docs/feature-skyfall.md`) and `*-2026-06-18.*` (complete).

---

## Cycle 2 — S2 POI streaming (2026-07-11) — SHIPPED

- **Planned:** S2 — `placeProcgenPOIs`/`placeProcgenPOI` per-chunk on the ChunkManager lifecycle: biome weights, static merge, salvage registration per chunk, full teardown, origin exclusion.
- **Shipped:**
  - `ChunkDesc.poi` — a fixed-shape descriptor roll from a dedicated per-chunk rng: presence 0.07/chunk (≈ origin density), 25m edge margin, biome-weighted archetype via the real `pickArchetype`, fresh `renderSeed`. Origin exclusion 1250m (boot placement untouched).
  - `loadChunk` renders through the REAL `placeProcgenPOI` (forced archetype, `parent: group`): panels mount, salvage registers live, per-POI merge, declared colliders. `unloadChunk`: POI body removed, salvage spliced out, merge-output geometry disposed (shared panel geo + bucket materials never). `placeProcgenComposite` now stashes `userData.poiBody` (streamed 'ship' wrecks would have leaked their body).
  - **Save safety (the cycle's danger zone):** streamed wrecks are `transient` — excluded from `save.salvageables` (visit-order ids would patch the WRONG wreck after reload); v1 = regenerate pristine (S5 lifts). The streaming gate now SAVES at +1500m with streamed salvage live + asserts only boot ids in the file. Schema v16 untouched. Skipped deliberately: scrap rings (S5), horizon silhouettes (S4) — backlog + D292.
  - Gate hardening: verify-chunks streaming child 420s→900s (a spawnSync kill mid-probe = fake boot failure + a leaked dev server, D293); probe additions: descriptor↔render POI count, salvage-registry leak assert, world-space snapshots, POI-aware ground ray; `chunk-vista` streamed-POI shot.
- **Verify:** ALL GREEN — tsc; placement 5-seed 0-fails; colliders 55; verify:chunks (determinism 8/8 ×2 seeds + cross-seed; streaming: bodies 332→330, chunks 49/49, farPois=1 descriptor↔render, farSalvage=2, registry baseline, save-safety); smoke-intro/pod-tutorial/pickup-sweep/survival/diurnal PASS. One wrapper-timeout false-fail root-caused (D293), re-run green.
- **Visual iteration:** placement-sanity bar — a streamed `hollow_husk` at (1388,−736) shot player-eye: seated, sand line natural, archetype-faithful (renders through the SAME assemblers the origin field uses — no new-element polish owed).
- **D-entries:** D292 (save-transient streamed wrecks), D293 (wrapper child timeouts / dev-server leak).
- **Spend:** ~180K output tokens (campaign total ~430K / 10M; cycle 2/50).
- **Commit:** (SHA recorded on commit — next log edit.)
- **Next:** cycle 3 = **S3 scatter + ambient life** (brief in `docs/next-session-prompt.md`; step 1 is the spawn*Procgen research ❓ — creature save arrays are the same id-trap as D292).

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
- **Commit:** `e82d9a7` (branch `campaign/2026-07-10-procgen`; the SHA-recording docs edit rides in the next cycle's commit).
- **Next:** cycle 2 = **S2 POI streaming** (brief in `docs/next-session-prompt.md`; the descriptor-first contract is D290).
- **Pending post-mortem drafts:** queued to `.post-mortem-pending/` (consolidate skipped — unattended campaign).

## Cycle 0 — campaign started (2026-07-10)

- **Goal:** infinite deterministic chunk-streamed world per `docs/feature-infinite-procgen.md`.
- **Design decisions (user, 2026-07-09):** ~112m chunks / fog-radius loading; deterministic (seed → same world); DISTRIBUTED rare landmarks; the escape-pod intro stays the fixed start; save v1 = FULL per-chunk diffs (bump pauses at S5).
- **Ladder:** S1 spike+probes → S2 POI streaming → S3 scatter/creatures → S4 landmarks/biomes → S6 perf → ⏸ S5 save (the one sanctioned pause, BEFORE building).
- **Budget:** 50 cycles / ~10M soft. Branch `campaign/2026-07-10-procgen` off master @ 10a27f2 (post-playtest-fixes + the kickoff brief).
- **Guard:** `.gamedev-framework/overnight.lock` present; the destructive-action hook confirmed in `.claude/settings.local.json`.
- **Next:** cycle 1 = S1.
