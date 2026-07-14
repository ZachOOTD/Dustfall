# Next cycle (23) — M11: retire legacy tube-wrecks (ship→socket) — INVESTIGATE FIRST

**State:** campaign "Sharpen & Deepen" `active` on `campaign/2026-07-12-skyfall` (22 cycles, ~6.75M/8.75M
spent; **~2.0M left** of the +4M cap). Checkpoint none. **M7-R + M8 + M9 + M10 COMPLETE.** Queue: **M11 → M12.**

## Cycle 23 = M11 — retire legacy tube-wrecks (ship→socket migration, D227/D249)
The owed cleanup: the legacy linear `placeProcgenComposite` wreck path makes some wrecks read as plain
TUBES; migrate them to the socket/faceted approach so NO wreck reads as a tube (Pillar 4 — every object
earns its mesh). Grep D227 + D249 in `docs/decisions.md` / `docs/decisions-archive.md` for the history +
the intended socket approach; study `src/world/procgenWreck.ts` (`placeProcgenComposite` — the legacy
linear path) + the faceted `makeLoftedHull` / `poiAssembler` socket path the M6/M9 archetypes use.

**⚠ BUDGET/RISK CAVEAT — read before diving in:** only ~2.0M is left, and M11 is a RISKY SYSTEMS REFACTOR
of the core wreck gen (the placement + collider gates cover it, so a regression is caught, but getting
it right may take >1 cycle). **START by INVESTIGATING** (a `code-archaeologist` or targeted read): map
exactly which wreck kinds still use the legacy tube path, what "retiring" it entails, and whether it's a
clean INCREMENTAL migration (migrate kind-by-kind, verify each) or a big rewrite. THEN decide:
- If it's a clean incremental migration that fits ~2M → do it (migrate + verify per kind; never leave a
  half-migrated mess — each committed cycle must be gate-green + coherent).
- If it's a big risky rewrite that won't finish in ~2M → do NOT start a hollow half-refactor. Instead
  do a SMALL contained slice (e.g. retire the ONE worst tube kind cleanly) OR mark M11 as needing a
  dedicated future session, log the finding, and let the budget cap stop the run cleanly (`budget`).

**The budget will likely hit the 8.75M cap during/after M11.** When `spend.total >= 8.75M`, the campaign
STOPS as `status:"completed"`, `stop_reasons:["budget"]` — the intended clean end of this overnight.
M12 (new biome) carries to a future `/campaign-start --resume` with a raised ceiling. That's expected.

## Standing constraints (steering.md)
- **models-need-thickness** (rule 7) · **100% collision** (rule 9, swept) · determinism (D290) +
  streamed-teardown (D292/rule 9, NO body leaks) · no save-schema change without the D81 pause · GPU probe default.
- Cleanup owed (guard-blocked, morning): remove the stray untracked `scratch-baseline/` dir,
  `scripts/_vultcheck.mjs`, and `scripts/_scenecheck.mjs` (throwaway M8/M10 numeric+visual probes).
