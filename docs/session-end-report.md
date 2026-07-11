# Dustfall — Session-end report

Cumulative state. Rewritten (and pruned) at each `/session-end`. Per-session detail lives in
`docs/changelog.md`; per-cycle campaign detail in `docs/campaign/campaign-log.md`.

## Current state (2026-07-11)

**The game is a complete, playable, shippable browser + desktop survival game** (released intro,
LIVE web build, Tauri desktop build).

**⚙ ACTIVE CAMPAIGN — "Infinite Sands"** (branch `campaign/2026-07-10-procgen`).
**S1-S4 + S6 shipped (cycles 1-5). ONE rung left: ⏸ S5 save schema — cycle 6 writes the plan and
PAUSES for your review (D81).** Ladder detail: `docs/roadmap.md`.

**Cycle 5 (this session) — S6 hitch-free generation (D296):**
- Terrain tiles build SLICED: staged fns (fill 12 rows/frame ≈ 8-10ms → geometry+normals one
  ~17ms frame → ATOMIC mesh+collider finalize; no partial tile ever visible). The anchor tile +
  boot ring stay synchronous (fall-through safety + boot byte-identity). Old cost: ~90-200ms ×3
  tiles per 800m crossing, in single frames.
- Chunk loads bounded to 1/frame; wreck_knot landmark pieces render DEFERRED one per frame
  (load-time rng draws + per-piece seeds → deterministic regardless of execution frame).
- NEW permanent `chunk-perf` gate (3rd `verify:chunks` leg): a multi-km walk routed through a
  real wreck_knot asserting slicing-is-the-norm (≥100 steps), sync anchor-safety bakes rare
  (≤4 at teleport pace) + bounded, loads/pieces under tripwires, draw+body ceilings, baseline
  return. The gate caught a real edge during development (diagonal teleport legs outrun the
  sliced ring → the anchor safety bake fires — correct behavior, assert recalibrated).
- Permanent perf instrumentation: `__game.chunkPerf()` / `resetChunkPerf`.

**Verify baseline:** all gates green — placement ×5, colliders 55, chunks (determinism ×2 +
cross-seed + streaming + perf), 5 smokes, 9 vista shots regenerated identically. Save v16
untouched. Machine clean after the suite (the reap-orphans fix holding).

## What works end-to-end
The full survival loop + an INFINITE, HITCH-FREE world: deterministic terrain, wrecks with
salvage, rocks, vignettes, prey, hero landmarks, regional graveyard biomes — walk forever in any
direction with no generation hitch a player would feel. Missing only: far-field persistence
(S5 — the pause).

## Known issues / partials
- Streamed content regenerate-pristine until S5 (D292 — the point of the next cycle).
- Regional-yard cluster read, far-field vultures, streamed-landmark silhouettes (backlog).
- The §A owed human walk-tests pile.
- If real-play profiling ever shows the one 17ms normals frame per tile: banded normals is the
  known next step (D296).

## Constants / knobs (new this cycle)
`TERRAIN_SLICE_ROWS` (12), `CHUNK_LOADS_PER_FRAME` (2→1).

## Suggested next
1. **Cycle 6 = ⏸ S5 schema plan** (brief in `docs/next-session-prompt.md`) — plans, pauses,
   awaits `/campaign-approve`.
2. **Your morning review**: walk the infinite world (`npm run dev`) — cross a tile boundary at
   sprint (feel for hitches), visit a landmark + a regional yard, strip a far wreck; then review
   `docs/feature-save-per-chunk-diffs.md` (cycle 6 will have written it) and `/campaign-approve`.
3. After the campaign: the parked Skyfall plan-review.

## State at session end
- **Git:** `campaign/2026-07-10-procgen`; cycles 1-5 committed (`e82d9a7`, `ad49dc0`, `deadc77`,
  `9b3ba92`, cycle 5's SHA in campaign-log). `master` untouched, nothing pushed.
- **Save:** v16 untouched.

## Time + token spend
Cycle 5 ≈ 190K output tokens (measure → build → 4 probe calibration rounds — one of which was
the gate catching the teleport-pace sync edge). Campaign ledger: ~990K / 10M, cycle 5/50.

## Iteration-discipline self-check (rule 8)
PASS (systems/perf bar). No new visual surface (slicing is invisible by design — proven by the
9 vista shots regenerating identically + the atomic-finalize rule). The perf work followed
measure→build→measure discipline with numbers logged at each step.
