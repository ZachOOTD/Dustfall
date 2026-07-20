# Steering inbox — Underworld

Write notes below this header; read at the TOP of each cycle. `pause` on its own line to pause.

## Standing directives (in force)
- Rules 7/9 (thickness / collision-matches-visual); walkin gate + declared intendedOpening at
  the cave mouth (the leviathan lesson).
- Never `git stash` here; ONE code-writing agent at a time; Fable plans / Opus executes.
- Push HELD — commit to `campaign/2026-07-19-underworld`, never merge to master.
- Trust the playtest over a green gate; verify tests aren't vacuous (the D307 setLinvel lesson).
- Architecture is DECIDED (D307): under-sheet trimesh interiors + entrance-chunk collider swap.
  Do not relitigate; do not build portals.
- Checkpoints: cave-plan blockout approval, then the descent feel walk-test — human-only calls.

## SPEED RULES (Zach 2026-07-20: "greybox took 5h, should be 20 min — fix it")
Root causes found: full-boot probe re-runs per tweak (minutes each), fresh-port permission
prompts blocking unattended, agent watcher-wait stalls. Every agent brief MUST enforce:
1. Probes via `npm run rig -- --scenario=... --port=52xx` (matches the existing npm-run allow
   rule — zero prompts). NEVER raw `node scripts/...`.
2. The full-boot probe runs at most ONCE per iteration BATCH (make N changes, probe once).
   Layout/geometry iteration uses the fast in-page screenshot path or cave-digest, not full
   walks. Final gates run ONCE at the end.
3. NO monitor/wait/watcher patterns. Run gates synchronously, then finish and report. An agent
   that has results does not wait for anything.
4. Per-agent wall-clock budget stated in the brief; report if you'll blow it, don't grind.
