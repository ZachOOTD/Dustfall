# Steering inbox — Scavenger's Economy (setup)

Write notes below this header; the loop reads them at the TOP of each cycle (so a note lands at the
next cycle boundary, not mid-cycle). To halt immediately, stop the `/loop` directly.
- To redirect: describe the change. To pause: write `pause` on its own line.

Examples: "skip #29, go straight to research" · "the boneyard scatter is too dense" · "pause".

## Standing directives (still in force from prior runs)
- **MODELS NEED REAL THICKNESS** — no paper-thin zero-thickness double-sided shells; torn edges
  show a cross-section; verify from grazing/edge angles (CLAUDE.md rule 7).
- **100% accurate collision** — every visible mass gets a matching collider, swept (rule 9).
- **Never `git stash` here; run agents ONE AT A TIME** (read-only research swarm excepted).
- **Push is HELD** — commit to `campaign/2026-07-17-economy`, never merge to master.
- **Model split (Zach, 2026-07-17 overnight):** Fable for thinking/planning (the main loop),
  Opus for execution — code-writing subagents get an explicit `model: opus` override.
