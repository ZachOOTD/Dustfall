# Campaign log — Dustfall · "DEEPER" (started 2026-07-24)

Newest cycle at top. Prior campaigns archived alongside
(`campaign-log-underworld-DONE.md`, `campaign-log-sharpen-deepen-DONE.md`, …).

Charter: [campaign-deeper.md](campaign-deeper.md) · Walk-test source of truth:
[cave-walktest-2026-07-24.md](cave-walktest-2026-07-24.md) · Steering: [steering.md](steering.md)

## Cycle 0 — campaign started (2026-07-24)

**Goal:** turn the underworld from a beautiful place with one errand in it into a *system* —
repaired first, then given variety, danger, water, and a reason to descend twice.

**Branch:** `campaign/2026-07-24-deeper` (from `master` @ e9f75b5). **Push HELD.**
**Ceiling:** 10M tokens / 20 cycles. **Checkpoint policy:** milestone.

**Why this campaign exists.** The Underworld ship (2026-07-20) merged with Zach's walk-test
feedback unrecorded — the docs said "feedback pending" for four days. Collected 2026-07-24 and
root-caused against the code the same day:

- **D-1 — the entrance is still the greybox.** `caveTest.ts` still carries its own
  "cycle-1 ENABLING TECH only — greybox geometry" header; it was never replaced. Ships as a
  29.2m × 8.34m × 12m snapped trench + slab ramp (~22°). Zach's "massive ramp" read is literal.
  Wanted: a **crevice** in a rock outcrop, tight and committing.
- **D-2 — see-through interior walls and floors.** Root cause found: the cave is N separate
  **zero-thickness `BackSide` shells that interpenetrate** (chamber ellipsoids + corridor tubes,
  `caveGen.ts:951`, `CAVE_GEN_END_OVERLAP` 1.2m). Stand in a chamber, look at a corridor — you're
  outside that shell, its faces cull, and with no thickness there's nothing behind them. Rule 7,
  never applied to the cave kit. Fix: **one watertight surface** (SDF → marching cubes over the
  existing room-graph). `DoubleSide` explicitly rejected as a symptom-hider.
- **D-3** — reassess + adversarial sweep afterward.
- **D-4** — preload caves at the loading screen; slice streamed cave builds.

**Zach's kickoff calls:** 10M/20 · **no creature underground** (environment-only danger) ·
**caves are a regular rocky-terrain feature**, not a rare landmark · **water pools promoted to
cycle 6**, the first new-content cycle.

**Ladder:** 1 void-ray gate + D-2 spike → 2 watertight remesh → 3 crevice entrance →
4 preload/gen-budget → 5 reassess **→ repair descent (Zach)** → 6 water → 7 density → 8 kinds →
9 hazards → 10 light budget → 11 return reason → 12 integration **→ final descent (Zach)**.
Cycles 1-5 are never cut.

**Flagged at launch:** "caves are common" breaks an assumption in D307 — the entrance collider
swap was specced and gate-proven for exactly ONE cave. At rocky density it becomes a routine
streaming event with multiple resident interiors. Cycle 7 must prove swap cost, teardown symmetry,
and a resident cap rather than assume them; the fallback is clustered cave country, surfaced as a
scope-cut, never taken silently.
