# Dustfall — Session-end report

Cumulative state. Rewritten (and pruned) at each `/session-end`. Per-session detail lives in
`docs/changelog.md` (append-only); per-cycle campaign detail in `docs/campaign/campaign-log.md`.

## Current state (2026-07-11)

**The game is a complete, playable, shippable browser + desktop survival game.** The escape-pod
intro is the **released opening** (2026-07-05, LIVE at https://zachootd.github.io/Dustfall/), and a
Tauri v2 desktop build exists (Dustfall.exe, unsigned v1).

**⚙ ACTIVE CAMPAIGN — "Infinite Sands"** (infinite procgen, overnight-autonomous, branch
`campaign/2026-07-10-procgen`, max 50 cycles / ~10M-token soft ceiling, checkpoint policy `none`
with ONE sanctioned pause at S5 save-schema). Charter: `docs/campaign/campaign.md`; feature slice:
`docs/feature-infinite-procgen.md`; ladder status in `docs/roadmap.md` "Up next".

**This session (campaign cycle 1 — S1 ChunkManager spike, D288–D291):** the world now STREAMS.
- `terrain.ts`: fixed 3×3×800m boot grid → an unbounded ANCHOR-MARGIN tile ring following the
  player (24m margin hysteresis — boundary straddling can't thrash a 37k-vert rebuild); tiles fully
  disposed outside the ring (geometry + Rapier heightfield body); `heightAt` = collider-exact
  bilinear inside loaded tiles + closed-form fallback ANYWHERE else; ONE shared terrain material
  (per-tile materials leaked `_shaderRefs` entries). The initial ring is byte-identical to the old
  grid — the released intro region is untouched (placement gate 0-fails ×5 seeds).
- NEW `src/world/chunkManager.ts`: 112m content chunks, Chebyshev load radius 3, 8m anchor margin,
  `chunkSeed(worldSeed,cx,cz)` avalanche + pure `describeChunk` descriptors (loading only renders
  them — the determinism law extended to the infinite grid), full teardown on unload. S1 content =
  seed-tinted marker posts with real colliders, OFF by default (`__game.setChunkMarkers`).
- 2 NEW permanent gates wired into `verify:all` via `npm run verify:chunks`: **chunk-determinism**
  (descriptor byte-identity ×2 derivations at 8 coord spreads, adjacent-chunk + cross-seed
  distinctness) and **chunk-streaming** (a 4-leg walk to +1500m — past the old ±1200m edge — and
  back: terrain follows, collider agrees with heightAt, bounded active set, no seam duplicates,
  unload→reload regenerates byte-identical positions, global body count returns to baseline ±3).
- Tooling: rig-shot `startDev` 30s→120s (loaded-machine boots flaked every probe); walk probes
  shrink the renderer to 320×240 (18min → ~2-3min); NEW `chunk-vista` visual scenario (crest-framed
  player-eye shots at +1500m + a fwd-ray identify diagnostic); `__game.chunkDescribe/chunkStats/
  setChunkMarkers/resetWormCrossing`.

**Verify baseline:** `verify:all` = tsc + placement (5 seeds) + colliders (55) + **chunks** (NEW),
plus the 5 rig smoke gates (smoke-intro, smoke-pod-tutorial, pickup-take-sweep, survival-probe,
diurnal-probe). All 10 green this cycle. Save schema **v16, untouched** (S5 is the sanctioned bump).

## What works end-to-end
Single-player: New Game → the escape-pod intro → the open desert loop — survive (5 stats, the 7-day
Long Storm), scavenge wrecks (pry+extract salvage, 11 procgen archetypes), craft via the
pickup-gated card grid, build camp, hunt/cook, tow a sled / ride the speeder, the wreck-yard biome +
Sarlacc pit + deep cave. Continue restores a real save. Browser + desktop identical. **NEW: the
player can walk arbitrarily far in any direction and the GROUND keeps generating deterministically**
(content beyond the origin field arrives in S2-S4 — for now the far field is bare dunes; marker
posts prove the machinery when enabled).

## Known issues / partials
- **The far field is intentionally EMPTY** — POIs/scatter/creatures/landmarks are still origin-bound
  boot placement; that's S2/S3/S4 of the ladder (not a bug).
- **Terrain tile bake blocks its frame** (~100-200ms × 3 tiles per 800m ring crossing, budgeted
  1/frame) — explicitly S6's rung (frame-budgeted generation); do not band-aid earlier (D288).
- Worm-crossing humps read exposed on dead-flat salt at close range (pre-existing, newly observable;
  backlog `[polish]`).
- The §A owed human walk-tests / feel-tunes pile (see `docs/backlog.md`) is unchanged.

## Constants / knobs worth tuning (new this session)
`tuning.ts`: `TERRAIN_TILE_RADIUS` (1), `TERRAIN_ANCHOR_MARGIN_M` (24), `CHUNK_SIZE` (112),
`CHUNK_LOAD_RADIUS` (3), `CHUNK_ANCHOR_MARGIN_M` (8), `CHUNK_LOADS_PER_FRAME` (2). All charter-
sanctioned S1 tunables (D288).

## Suggested next
1. **Campaign cycle 2 = S2 POI streaming** (the loop's next rung — see `docs/next-session-prompt.md`).
2. Then S3 (scatter/creatures) → S4 (distributed landmarks + biome re-anchor) → S6 (perf) → ⏸ S5
   (save schema, the sanctioned pause + morning review).
3. After the campaign: resume the parked Skyfall plan-review (`/campaign-approve` on the restored
   Sharpen & Deepen state) — Skyfall becomes an S4 distributed landmark.

## State at session end
- **Git:** on `campaign/2026-07-10-procgen`; this cycle auto-committed (campaign mode) — SHA in
  `docs/campaign/campaign-log.md`. `master` untouched. Not pushed (charter: never push; merge after
  the morning review).
- **Save:** localStorage v16 (untouched).
- **Docs:** `decisions.md` archived D236–D246 → 45 active entries + this cycle's D288–D291 = 49.
- **Machine note:** another project (project-mountain) was running its own verify suite concurrently
  — Vite boots were slow all session (hence the 120s startDev window).

## Time + token spend
Campaign cycle 1 (autonomous, overnight window). Heavy for a systems cycle: the build itself was
lean, but the streaming probe needed 4 diagnose→fix rounds (settle-counter → anchor-margin redesign;
castDown false-hits; corner ambiguity; swiftshader runtime) and the vista needed 3 photobomber
identification rounds. Estimated **~250K output tokens** this cycle (recorded in the campaign
ledger: 250K / 10M ceiling, cycle 1/50).

## Iteration-discipline self-check (rule 8)
PASS (systems bar). This cycle shipped no player-facing visual element — the marker posts are
probe/debug affordances (off by default) and the streamed terrain re-renders the SAME formula the
shipped world used. The visual gate still ran as placement-sanity: 4 player-eye `chunk-vista` shots
(crest fwd/back at +1500m, tile seam, marker ground-contact), 3 iterate rounds on framing +
photobomber identification (dune face + the worm spectacle — both explained, neither a regression).
No hero bar applied — correctly, per the charter ("systems work — screenshots for placement sanity,
no hero bar").
