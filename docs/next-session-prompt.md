# Next session — Kickoff brief (2026-07-31, after the cycle-13 night)

**State:** campaign DEEPER is COMPLETE (its content is LIVE on master). Overnight, cycle 13 ran on
branch `campaign/2026-07-24-deeper`: **the tor build is sliced** — the worst frame in the game
(255ms) is gone. **PUSH IS HELD** for your review; nothing went to master.

## What happened overnight (3 commits)

1. `27788af` **A1 — torDigest + phase timing.** The tor mesh was in NO digest anywhere, so a bug
   that moved a vertex would ship green. Fixed first, on its own merits. Also added a per-phase
   split, which corrected the plan's design premise: the field fill was NOT the big cost (20.9ms);
   the **vertex colour pass is** (74.7ms, 29%).
2. `4eb26c6` **A2+A3 — the slicing + its tooth.** Worst tor frame **255ms → 58.3ms** (active build
   time unchanged — this spreads work, it does not speed it up). Done with a GENERATOR (~25 lines
   touched) instead of the plan's ~200-line hand-hoist. The tooth asserts **sync == sliced**, never
   a literal, and was RED-PROVEN. Its first red was an INSTRUMENT bug, caught and fixed.
3. `<docs>` — changelog, D321, backlog.

## The honest limit (please read this one)

Slicing does NOT put the tor under a 16ms frame budget and **cannot**: ~55ms of it is a single
`ColliderDesc.trimesh` bake, which no slicer chops. The tor is no longer the worst frame in the
game and now sits in the same class as the interior bake the game already ships — that is the whole
win, and "under budget" was never available.

## What to do first

1. **Walk it.** A streamed cave arriving should no longer hitch the way it did. The tor now appears
   over a few frames instead of one long stall — worth confirming that reads as smooth rather than
   as a pop-in you dislike. (`__game.gotoErg()`-style helpers aside, just walk toward a far cave.)
2. **Decide on push/merge.** Three commits, all gate-green, all revertible independently.
3. Then the menu in [roadmap.md](roadmap.md) §Up next — taste passes are still the cheapest win,
   and `CAVE_BEAT_CACHE` contents are still your call (⚑ economy gate).

## Live follow-up, deliberately NOT done unattended

The tor's **colour pass (74.7ms)** is the biggest remaining phase. It has a free, value-identical
win available (a `new THREE.Color()` allocated per vertex in the hot loop). I did not take it
because the biome tint is something you approved BY EYE and colour sits outside `torDigest`
(positions only) — so it wants a visual A/B with you, not a night edit. Logged in
[backlog.md](backlog.md).

## Footguns unchanged

- ⚠ `CREVICE_APRON_RISE` is load-bearing (descent line → chamber floors → caveDigest).
- Any A/B tooth that REBUILDS a reference must mirror its subject's construction args exactly
  (this bit us at 01:00 — world seed vs site seed, rect vs raster lid).
- Rule 10: new walkable/visible geometry enrolls in `verify:solid` same-change, red-proven.
- Probes only via `npm run rig -- --scenario=… --port=52xx`; never edit src with a probe in flight.

## Verification protocol

`npm run verify` (tsc) · `npm run verify:chunks` (full suite, run at close last night) ·
`npm run verify:solid` (6 assets incl. cave_tor/cave_dais) · `verify:loot` for economy data edits.
