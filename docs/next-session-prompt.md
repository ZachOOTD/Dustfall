# Next session — campaign DEEPER, the post-walk-test ladder (Zach's direction, 2026-07-28)

**State:** active on `campaign/2026-07-24-deeper` (9/20 cycles, ~9.15M/**14M** — ceiling raised
by Zach). Cycle 9 SHIPPED, gate of record 24/24 GREEN. The hazard checkpoint was RESOLVED IN
PERSON: **no hazards — caves are a place to EXPLORE.** His verbatim feedback: steering.md
2026-07-28. Boot from `docs/campaign/campaign-state.json` + `steering.md` as always.

## The remaining ladder (his feedback, in priority order)

**Cycle 10 — LIGHT & DARKNESS INTEGRITY** (the bugs he saw, plus the dial he asked for):
1. **Deep-cave darkness must not track surface daylight.** Observed: caves brighter by day,
   darker by night — the deep ambient floor multiplies a day-varying base. Fix: constant deep
   darkness (the mouth light shaft + threshold zone STAY sun-tracked — that's a real opening).
   Gate: a deep-chamber framing at noon vs midnight must measure identical.
2. **Sun AND moon visible through terrain/cave rock — fix for ALL caves.** Cycle 7 gated the sun
   sprite's depthTest on being inside THE ORIGIN cave; kind/streamed caves still show both
   bodies. Root-cause the inside-detection for streamed caves, cover the moon too, surface look
   byte-identical, and add the upward-view max-pixel assert to the kinds/audit gate.
3. **Carried-light strength UP: torch, flashlight, lantern** (his call; dials in tuning.ts; he
   fine-tunes by feel next test). Note the cycle-7 envelope/bounce scale with carried light —
   re-verify the pool pixel gates (ratio-based, should hold) and the no-free-light canaries
   (must stay exact).

**Cycle 11 — LANTERN BREADCRUMBS + COLD ATMOSPHERE:** deployable/retrievable lanterns using the
EXISTING lantern item (place on ground, pick back up — route breadcrumbs); cave temperature
reads colder with depth but CLAMPED non-damaging (never below the damage threshold). Both are
feel items — rule 8 + his re-test.

**Cycle 12 — THE SKELETON & JOURNAL:** an authored story beat in one of the caves — a dead
explorer: skeleton (real thickness, rule 7), a readable journal (the Skyfall crash-log idiom),
a loot cache (numbers FLAGGED for Zach per the economy gate, not baked). Seed-pure placement;
decide egg-cave vs a streamed-cave rare roll and surface the choice.

**Cycle 13 — INTEGRATION:** perf pass (the ~160ms tor arrival hitch — the slicing lever),
docs/changelog/D-entries sweep, backlog reconciliation, morning summary → the final descent
walk-test (charter checkpoint 3).

**Parked (unchanged):** shaft skylight (unscheduled idea) · warren history props · corridor
differentiation · canonical speleothem tips + egg-dais read (digest re-baseline decisions) ·
pocket-9 wedge trap + floorOk margin · taste dials. **Zach has MORE tuning feedback pending —
capture same-day when it arrives; it may reorder cycles 11-13.**

## Standing rules (unchanged)

Fable plans / Opus executes · one code-writing agent at a time · never `git stash` · push HELD ·
SPEED RULES + EFFICIENCY WATCH (gate iteration via `--legs=` + `--serial` for march legs; full
suite once per cycle by the orchestrator; tee-to-file; measure-before-dispatch; right-sized
critic waves; per-cycle efficiency retro) · rule 8 for visual/feel · trust the playtest · NO
creature underground · NO damage mechanics underground (2026-07-28) · determinism D290 · origin
digests d8f15005/99e0015b.
