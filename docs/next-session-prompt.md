# Next cycle (18) — M8: far-field vultures (the world-deepening queue begins)

**State:** campaign "Sharpen & Deepen" `active` on `campaign/2026-07-12-skyfall` (17 cycles, ~5.6M/8.75M
spent; ~3.15M left of the +4M cap). Checkpoint none. **🏁 M7-R (Skyfall refinement) COMPLETE** — all 6
of Zach's walk-test fixes shipped (cycles 14-17). Queue now: **M8 → M9 → M10 → M11 → M12.**

## Cycle 18 = M8 — far-field vultures
Aerial life for the infinite world. Backlog (D294, deferred): "Perch-pool + carcass-anchored placement
+ dynamic death bodies fight the chunk model; the infinite field has no aerial life. Revisit with a
placement-model rework (region-rolled perch trees?)."

**This is a `[feat]` with a real architecture problem to solve → `/feature-slice` it first** (write
`docs/feature-vultures.md` with the DoD + sub-tasks). The core tension: the existing vulture system
(perch pool, carcass-anchored, dynamic death bodies) was built for the finite origin world and doesn't
fit the streamed chunk model (determinism D290 + streamed teardown D292/rule 9 + no body leaks). The
DoD = vultures actually EXIST + behave (circle/perch/scavenge) in the far field, streamed-safe.
Candidate approach (from the backlog): region-rolled perches (like the S4 landmark/biome rolls) that
spawn a small vulture population when their chunk loads, tearing down cleanly on unload. Study
`src/enemies/` (vulture code), `src/world/chunkManager.ts` (the streamed-content pattern: descriptor
roll → load spawns → unload tears down; see the D299 dressing + roaming-prey rolls for the template),
and the diurnal binding (M5 — vultures perch at night, fly by day). Reuse the streamed-fauna pattern
that lizards/shrews already use (chunk-keyed, transient, despawn-on-unload).

Gates: verify:all + 5 smokes + verify-chunks (determinism stable per seed; streaming NO body leak —
the vulture bodies/perches must tear down; the gate's body-count baseline will catch a leak) +
adversarial visual gate if new vulture visuals. GPU probes ~26s.

## The rest of the queue (each its own /feature-slice when reached)
M9 new POI archetypes → M10 story vignettes → M11 retire legacy tube-wrecks (ship→socket, D227/D249)
→ M12 new far-field biome.

## Standing constraints (steering.md)
- **models-need-thickness** (rule 7) · **100% collision** (rule 9, swept) · determinism (D290) +
  streamed-teardown (D292/rule 9, NO body leaks) · no save-schema change without the D81 pause · GPU probe default.
- Cleanup owed (guard-blocked): remove the stray untracked `scratch-baseline/` dir in the morning.
