# Next session — campaign DEEPER, cycle 8: caves as rocky-terrain density

**State:** campaign DEEPER **active** on `campaign/2026-07-24-deeper` (7/20 cycles, ~5.2M/10M,
push HELD). Cycle 6 (water, volume tier) + cycle 7 (the D-3 reassess: interior rendering overhaul
+ entrance geometry) SHIPPED — tip `23c29fe`, all gates green. Boot from
`docs/campaign/campaign-state.json` + `steering.md`; this file is the hint, the state is truth.

## Cycle 8 — density (the charter's cycle 7, shifted by the reassess)

Caves roll off the chunk descriptor in the rocky biome at real density; the egg cave stays unique
and legible near origin. **This is the D307-at-density proof the charter flagged at kickoff** —
prove, not assume:
1. **Swap cost under streaming** — the entrance-chunk heightfield→trimesh swap as a routine
   event while moving (cycle 5's slicer + `chunk-perf` legs are the base; the atomic finalize
   ~90-100ms floor is known and accepted at one cave — measure it at density).
2. **Teardown symmetry** — an unloading cave chunk restores the heightfield exactly; no leaked
   trimesh, no stale carved hole (rule 9). The pool-source detach + pool-material release paths
   (cycles 6-7) must hold under churn.
3. **Resident-interior budget** — the cap-3 farthest-first evictor exists (cycle 5); prove it at
   real density with the pinned/occupied protections.
Gates per the charter: placement + chunk determinism ×2 seeds · cave-walk + cave-void **widened
to N sites** (not just the origin cave — streamed-site descriptors need their own walk/void
sampling) · `chunk-perf` covering swap + teardown + cap · **the surface world byte-identical**
(released-origin parity). If uniform density can't be made perf-safe, the fallback is clustered
"cave country" — **a scope-cut that gets SURFACED TO ZACH, never taken silently.**

## Owed to Zach (surface at every checkpoint)

- **The repair descent walk-test (D-1..D-4) is STILL OWED**, and cycles 6-7 changed how the cave
  looks substantially — his next descent judges the whole stack (crevice approach, interior
  legibility, pools, motion feel: bounce flicker, dither crawl, ripple/glint movement).
- **Milestone ahead: hazard-spec-review** (a doc review) before the hazards cycle builds.
- Decisions parked for him: pocket-9 wedge trap (pre-existing, digest-moving) · `floorOk` margin
  under-bound (pre-existing, digest-moving) · jerrycan/pool balance numbers · ~20 new
  CAVE_*/CREVICE_* taste dials · swiftshader rock cost 15-22% (real GPUs: noise).

## Standing rules (unchanged)

Fable plans / Opus executes · one code-writing agent at a time · never `git stash` · push HELD ·
SPEED RULES (probes via `npm run rig -- --scenario=… --port=52xx`; full gate suite ONCE per
batch; no watchers; honest wall-clock budgets) · rule 8 for visual work · trust the playtest
over a green gate · NO creature underground · determinism D290 · **flaky-gate discipline: one
sample is not evidence — n≥5 per tree before calling introduced-vs-pre-existing** · the march
gate now prints `strands=N` (nonzero strands on a green run = a real traversal trap to triage).
