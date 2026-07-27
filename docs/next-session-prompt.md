# Next session — campaign DEEPER is PAUSED mid-cycle-9 (Zach's call, 2026-07-27)

**State:** `campaign/2026-07-24-deeper` at `c8fab5a`, tree clean, push HELD. 8 cycles + a cycle-9
partial shipped (~6.9M/10M). `status: paused`, `awaiting_approval: true`. Boot from
`docs/campaign/campaign-state.json` (the paused_note is the resume brief) + `steering.md`.

## Resume: finish cycle 9 first

1. **The entrance headroom defect (the cave-kinds seed-1337 leg is deliberately RED for it).**
   Some streamed caves pinch to 1.17-1.44m clear height vs the 1.70m capsule in the roofed
   fissure stretch — they cannot be entered. Pre-existing, kind-independent, fully measured.
   Instrument: `npm run rig -- --scenario=crevice-profile --siteOffset=N`. Failing sites: seed
   1337 (675,1113) pinch s=8.39; seed 7 (-1100,-1146) pinch s=8.69. Falsified already: the SDF
   grid origin (A/B'd), the guard sweep (no-op, 1.44→1.42m), width levers (height is the
   deficit). Levers: carve the hole further / locally steeper roofed leg / floor depression at
   pinched columns / profile-based site rejection (rule-6 pattern, the authorized fallback).
   Acceptance: ≥1.9m clear along both failing descents (or both rejected + replacements clean),
   marches pass, a permanent clearance tooth proven red-then-green, cave-kinds leg GREEN.
2. **The per-kind rule-8 look pass** — 12 smoke shots at `verification/scen-kind-*.png`; rubble
   heaps flagged low (≈0.5m); fungal is the perf-heaviest kind (135-153k tris).
3. **The flaky shaft/1337 apron steering** (fails ~sometimes on approach, off-axis drift ~7m).
Then close cycle 9 (log/state/bookkeeping) and continue the ladder: hazard SPEC (a doc that
PAUSES for Zach — the charter's checkpoint 2) → light budget → return reason → integration.

## Owed to Zach — the big one

**The repair descent walk-test.** Cycles 6-9 changed pools, interior rendering (envelope/dither/
strata/bounce), entrance geometry (sawtooth/roof/horn), density (caves everywhere + streamed
gates), and kinds. One descent judges it all — including motion feel (bounce flicker, dither
crawl, glint movement, the tor arrival hitch ~155-175ms).

Parked decisions: `CAVE_SITE_CHANCE 0.60` (~3.3 caves/travel-hour) · `CAVE_KIND_WEIGHTS` ·
warren `scrapPerCave 6` · jerrycan recipe/capacity · pocket-9 wedge trap + `floorOk` margin
(digest-moving) · ~20 CAVE_*/CREVICE_* taste dials · swiftshader rock cost 15-22% · tor slicing.

## Standing rules (unchanged)

Fable plans / Opus executes · one code-writing agent at a time · never `git stash` · push HELD ·
SPEED RULES · rule 8 for visual work · trust the playtest over a green gate · NO creature
underground · D290 · flaky-gate n≥5 discipline · `strands=N` nonzero = a real trap · origin cave
digests are now `d8f15005` / `99e0015b` (re-baselined at the lattice snap, documented).
