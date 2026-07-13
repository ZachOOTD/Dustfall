# Next session — M7 Skyfall is COMPLETE; the human walk-test is the next action

**State:** campaign "Sharpen & Deepen" `paused`, `awaiting_approval`, `stop_reasons: ["feel-review"]`,
on branch `campaign/2026-07-12-skyfall` (cycles 9–13 done, ~4.75M/10M tokens). The M7 Skyfall ladder
(S1 blockout → S2 enterable → S3 exterior hero → S4-S5 interior hero → S6 loot) is COMPLETE and
gate-green. **Full detail + the walk-test aid: `docs/campaign/morning-summary-2026-07-13.md`.**

## The one owed step: the human post-blockout WALK-TEST (charter pause #1)
Feel/scale/lighting can't be judged headlessly. The human walks a Skyfall wreck in-app (console
teleport snippet in the morning summary), then:
- **Approves** (`/campaign-approve`) → M7 done (the ladder's last milestone → campaign `completed`)
  → merge review: merge `campaign/2026-07-12-skyfall` → master + redeploy (nothing pushed/merged yet).
- **Requests changes** (`/campaign-approve --with-changes` or just says so) → iterate. The most
  likely ask: **cabin lighting** (the payoff room reads dark in stills — the fix is a small interior
  ambient term, NOT more point lights, per the modeler; deliberately left for the human's eye).

## Probe infra (now standing — D301)
`scripts/rig-shot.mjs` defaults to **GPU headless** (`--use-angle=d3d11`): ~10× faster + CPU-cool.
`RIG_GL=swiftshader` reverts (GPU-less machine/CI). Fast `streamToSite()` single-teleport streaming.
Caveat: pre-existing cockpit numeric-luma probes may read differently under GPU — re-baseline or pass
`RIG_GL=swiftshader` if ever re-run. The `skyfall-shot` (5 exterior + 6 interior cameras) and
`skyfall-walk` (verify:chunks leg 4) scenarios are the Skyfall probes.

## Key files
`src/world/skyfallWreck.ts` (the whole wreck — exterior, interior, loot; ~1000 lines) ·
`src/world/chunkManager.ts` (the skyfall thunk ~line 680 + journal teardown in unloadChunk) ·
`src/config/features.ts` (`FEATURES.skyfall`) · `docs/feature-skyfall.md` (the plan + DoD + steering).

## If the campaign closes after approval
The Sharpen & Deepen ladder (M1-M7) is then fully shipped. Options: the owed §A feel walk-tests
(`docs/backlog.md`), or a new campaign from the GDD. No autonomous run is active; the overnight lock
can be cleared if done with autonomous sessions.
