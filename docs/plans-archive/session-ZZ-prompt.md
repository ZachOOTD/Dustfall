# Next Session — Kickoff Brief (post-YY)

## Read these now (in order)

1. `CLAUDE.md` (auto-loaded) — project manual, current state
2. `docs/session-end-report.md` — cumulative state through Session YY
3. `docs/changelog.md` — read the most recent 6 entries (UU through YY)
4. `docs/decisions.md` — D73-D81 are the recent entries. Critical ongoing: **D71 (recipe id stability)**, **D81 (save migration discipline)**, **D79 (perceivedIntensity split)**.
5. `docs/roadmap.md` — overnight era is closed; "Next — Big-ticket bucket" lists future direction
6. `docs/backlog.md` — open items

## What's already built

26 sessions past start. The overnight era (UU-YY) added:

- LMB-leaning controls (UU) + RMB context verbs (UU-2)
- Tuning hygiene + crosshair feedback + as-any fix (VV)
- HUD micro-polish (WW): stat vignettes, stamina wobble, prompt fade
- Larger enterable tent + SAVE_VERSION v7 (XX)
- Storm visual dampening inside large tent via perceivedIntensity split (YY)

## Suggested focus

The era is closed; next session is open. A few small completions
and a few larger directions:

### Quick polish completions (~30-60min each)
- Wind audio off `intensity` → `perceivedIntensity` (backlog item) —
  large-tent interior currently dampens dust + vignette but wind
  audio stays full. Completes the perceivedIntensity split.
- Post-mortem of the overnight run via `/gamedev-framework:post-mortem`
  — recurring patterns worth promoting to framework canon.

### Medium picks (1-3h)
- Audio sample stems (.ogg sourcing) — architecture exists since X
- Crosshair styling refinement / new shelter type (cave with opening?)

### Big-ticket bucket (3-7h)
- Small red creature companion (pocketable + re-deployable)
- 7-day storm countdown
- Trading / NPC economy
- Bounties
- Procgen world (POI randomization per seed)
- Raider variants (if reintroducing raiders)

## Autonomy contract

- Append D-entries for any non-obvious decisions.
- Update changelog + session-end-report.
- For save schema changes: D81 discipline (additive only).

## Stop conditions

- All planned items shipped + verify passes → `/session-end`.
- 3-strike wall → `/scope-cut`.
- Catastrophic block → halt + write CAUTION here.

## Verification protocol

```
npm run verify  # = tsc --noEmit
```

Plus eval-driven preview verification of whatever shipped.

## Notable footguns

- **D71** — recipe ids 1-10 immutable; new recipe gets 11.
- **D81** — SAVE_VERSION 7; additive only.
- **D73** — wieldAction.ts as sole LMB dispatcher.
- **D79** — visual storm systems read `perceivedIntensity`; world-state
  systems (fog, stats, AI) read `intensity`.

## Begin block

Pick a direction → read the relevant files → TaskCreate → begin.
