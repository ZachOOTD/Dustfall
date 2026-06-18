# Campaign cycle-1 kickoff — `campaign/2026-06-18`

> This replaces the old ACBC hand-session brief. The campaign drives the queue now; `/session-end`
> rewrites this file at the end of each cycle. **The roadmap is authoritative** (skill Step 4) — if this
> brief and `docs/roadmap.md` "Up next" ever disagree, the roadmap wins.

## Boot order (re-read every cycle from FILES, never chat memory)
1. `docs/campaign/campaign-state.json` — cycles done, spend, ceilings, `status`/`awaiting_approval`, `current_tier`.
2. `docs/campaign/steering.md` — the human inbox (apply + archive any note).
3. `docs/roadmap.md` "Up next" — the **PHASE-grouped milestone queue** (the authority on what's next).
4. `docs/iteration-plan.md` "Campaign 2026-06-18 — milestone ladder" — per-unit scope / verify-type / risk.
5. `CLAUDE.md` architecture rules + `docs/decisions.md` tail.

## What this campaign is
Autonomous build-out of the remaining roadmap+backlog. **Review cadence = PHASE-level**: the loop runs the
WHOLE build-out phase (M1→M5b) unattended, **commits every cycle** (one cycle ≈ one session ≈ a chunk of a
milestone — a milestone spans several cycles), and PAUSES only at the `### Milestone: Phase A — Build-out
complete` marker. Gate = `npm run verify:all`. Visual/feel cycles also run the adversarial appearance gate
(`--visual-gate=auto`) — appearance only; mark feel items `appearance-verified; feel-pending` for the human
walk-test at the phase boundary.

## Cycle 1 picks up: **Phase A → M1 — Wreck-arc finish (calibration)**
Take the top M1 unit (all low-risk, small):
1. `scrap-pickup-3q-thin` (visual-gate; shoot the 3-QUARTER angle — front already reads fine) — `src/world/scrapMesh.ts`.
2. `dish-collider-feel` (feel-pending; refine the flagship `satelliteDish` slab so it doesn't snag at diagonals).
3. `remove-wreck-sand-mounds` (user directive) — strip the `makeSandMound` drifts around wreck bases
   (`procgenWreck`/`poiAssembler`/`wreckYard`); re-run `verify:placement`/`verify:colliders` (mounds were
   additive sand → removing them shouldn't bury panels; confirm 0 fails). **Supersedes the §G sand items.**
4. `panel-deadcode-cleanup` (headless) · 5. `perf-budget-reprofile` (headless — record the drawCalls/programs baseline).

Scope each cycle to ONE unit (sometimes a few tiny related ones). Ship `[partial]` if a unit won't fit the
cycle rather than launching an unbounded sweep.

## Autonomy contract (unchanged from the project norms)
- **`phash`-determinism (D221):** components never draw `rand`; assemblers draw a small FIXED budget. Re-run
  `npm run verify:placement` AND `npm run verify:colliders` after ANY POI/panel/geometry/seating change.
- **Rule 8:** visual work is NOT done when tsc passes — build → screenshot → critique → iterate (front-light +
  length-frame the rig FIRST). Hold the ACBB bar (3-critic cohesion pass / 5-round model iteration).
- **COLLIDER-AUDIT footgun (D235):** a NEW structural mesh needs a declared collider OR an
  `auditExempt`/`isWreckDecoration` tag, else `verify:colliders` trips.
- **Save (D81):** additive-only. A `SAVE_VERSION` bump (e.g. multi-worm N>2 later) → **surface it, do NOT
  auto-bump unattended**; log + flag for the phase review.
- **Net-new content needs a rig-shot framing** for the visual gate (e.g. M5a horizon silhouettes / M5b sky
  phenomena have no scenario yet) — author the `--scenario`/framing as part of that cycle, or the appearance
  gate can't run. The dense `wreck-yard --angle=ground` view times out at 30s (chain shots sequentially).

## Stop conditions
3 fix-walls on one element (game-verifier → scope-cut from GDD §12, log a D-entry) · a buried-panel or
un-covered-collider regression you can't clear in 2 tries · a needed `SAVE_VERSION` bump (surface) ·
destructive-git attempt (blocked by the guard) · per-cycle spend exhausted (ship `[partial]`).
