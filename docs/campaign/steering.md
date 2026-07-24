# Steering inbox — DEEPER (2026-07-24)

Write notes below this header; read at the TOP of each cycle. `pause` on its own line to pause.
(Underworld's steering is archived in `steering-archive.md`.)

## Standing directives (in force)

**The walk-test repair outranks the charter.** [cave-walktest-2026-07-24.md](cave-walktest-2026-07-24.md)
is the source of truth for cycles 1-5. No new content ships before Zach's repair descent signs off.

**Zach's kickoff decisions — DECIDED, do not relitigate:**
- **NO CREATURE UNDERGROUND.** Environment-only danger: the dark, the depth, the rock, your torch
  burning down. No cycle may introduce a cave monster.
- **Caves are a regular feature of ROCKY TERRAIN**, not a rare landmark. The egg cave stays unique
  and legible near origin. If uniform density can't be made perf-safe, the fallback is clustered
  "cave country" — and that is a SCOPE-CUT that gets surfaced to Zach, never taken silently.
- **Water pools are wanted** ("do love the idea… definitely want to add that") — promoted to
  cycle 6, the first new-content cycle. Default design is atmosphere-parity with wells, built so
  the larger-vessel follow-on is small. Water purity/boiling is OUT of this campaign.
- Ceiling 10M / 20 cycles.

**Engineering constraints:**
- D307 architecture is DECIDED: under-sheet trimesh interiors + entrance-chunk collider swap.
  **No portals, no teleports.** The crevice makes the carved hole smaller, which is easier.
- The D-2 fix is a **watertight single surface** (SDF → marching cubes over the existing
  room-graph). `DoubleSide` is NOT an acceptable fix — it hides the symptom and leaves paper walls.
- **The room-graph layout logic is preserved.** Underworld's sibling-angle (55°) and clear-span
  run-sizing fixes were bought with real bugs; the remesh replaces the MESHING layer only.
- Rule 7 (real thickness) / rule 9 (collision matches the visible geometry, changed together).
- Determinism (D290): seed-pure per site descriptor. Saves additive-only.

**Gate discipline — the project's driving lesson:**
- Every failure given a machine gate stopped recurring; every failure given only a prose rule came
  back. **The void-ray gate lands in cycle 1 and must be shown RED on today's `master` before the
  fix is built.** A gate that can't be demonstrated failing on the broken build is a gate that
  launders bugs as verified.
- Widen the seed net. Underworld's two generator defects hid behind 2 gate seeds. 6 seeds minimum.
- **Trust the playtest over a green gate.**

**SPEED RULES (Zach 2026-07-20, in force):**
1. Probes ONLY via `npm run rig -- --scenario=… --port=52xx` (zero permission prompts).
   NEVER raw `node scripts/…`.
2. The full-boot gate runs at most ONCE per iteration BATCH. Geometry iteration uses the fast
   in-page screenshot path or the cave digest, not full walks. Final gates run ONCE at the end.
3. **NO monitor/wait/watcher patterns.** Run gates synchronously, then finish and report. An agent
   that has results does not wait for anything. (This stalled TWO Underworld cycles.)
4. Per-agent wall-clock budget stated in the brief; report if you'll blow it, don't grind.

**Rule 8 (visual iteration):** `npm run verify` green is NOT the success gate for the crevice
entrance, the remesh read, or the water pools. Build → screenshot → critique → iterate, 5-8 rounds
for new visual elements. Never >150 LOC of visual code in one Edit without a screenshot between.

**Process:** one code-writing agent at a time · never `git stash` here · Fable plans / Opus
executes · **push HELD** — commit to this branch, master untouched · walk-test feedback gets
written down the SAME DAY (the 4-day gap that produced this campaign's cycle 1 was the miss).

---

## Notes
