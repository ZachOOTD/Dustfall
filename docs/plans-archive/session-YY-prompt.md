# Next Session — Kickoff Brief (post-overnight)

## Read these now (in order)

1. `CLAUDE.md` (auto-loaded) — project manual, current state, architecture rules
2. `docs/session-end-report.md` — cumulative state through Session XX (overnight queue complete)
3. `docs/changelog.md` — read the most recent 5 entries (UU/VV/UU-2/WW/XX); they describe what just shipped overnight
4. `docs/decisions.md` — D73-D81 are the new entries from the overnight run. Critical ongoing: **D71 (recipe id stability)** + **D81 (save migration discipline)**.
5. `docs/roadmap.md` — overnight queue is closed; "Next — Big-ticket bucket" lists future direction
6. `docs/backlog.md` — open items (notably the storm-dampening polish item scope-cut from XX)

## What's already built

Dustfall is 25 sessions past start, post-MVP. The lone-survivor
sandbox loop works end-to-end. The overnight run (sessions UU–XX,
all shipped 2026-05-21) added:

- **Control scheme overhaul** (UU): LMB-leaning interaction model
  via the new `wieldAction.ts` dispatcher (D73). `wieldLmb` field on
  ItemDef (D74). Hold-LMB drinking, LMB-click placement, LMB-take
  pickups.
- **Tuning hygiene + crosshair feedback** (VV): fire.ts/tent.ts
  constants lifted, crosshair turns red on enemy / brightens on
  interactable, lone `as any` removed (codebase now 0 `as any`).
- **RMB context verbs** (UU-2): RMB to pack tents + release sled
  ropes (D77).
- **HUD micro-polish** (WW): low-stat warning vignettes (cold blue
  + thirst brown), low-stamina screen wobble, interact-prompt fade
  (D78).
- **Larger enterable tent** (XX): new `large_tent_kit` + recipe id
  10 + `largeTent.ts` module + SAVE_VERSION 6→7 additive migration
  (D80 + D81).

## Suggested focus (pick one)

The overnight queue is closed, so the next session is open. Three
reasonable directions:

### Option A — Storm visual dampening inside large tent (deferred polish)
~1-1.5h. The scope-cut #1 from XX. Add `weather.perceivedIntensity`
field; updateShelter sets it to `intensity * LARGE_TENT_STORM_DAMPEN`
when the player is in a large-tent shelter. Hook stormVignette +
ambientDust + (optionally) soundscape to read perceivedIntensity
instead of intensity. Storm physics + stats stay on the authoritative
`intensity`. Decision D79 placeholder becomes its actual entry.

### Option B — Post-mortem of the overnight run
~30-60min. Run `/gamedev-framework:post-mortem` to evaluate recurring
patterns from UU-XX for promotion to gamedev-framework shared-memory:
- Centralized dispatch on equipped-item predicate (D73 + D77)
- Clone-not-abstract for N=2-3 callers (D78 + D80)
- Additive-only save migration discipline (D81)
- `slot.meta` for HMR-safe transient state (D74 `onHoldTick`)

### Option C — Pick from the bucket
Roadmap "Next — Big-ticket bucket" includes:
- Small red creature companion (pocketable + re-deployable, ~5h)
- 7-day storm countdown
- Trading / NPC economy
- Bounties
- Procgen world (POI randomization per seed)

## Autonomy contract (if running another autonomous session)

- Verify cleanly per the protocol below.
- Append D-entries for any non-obvious decisions.
- Update changelog + session-end-report.
- For save schema changes: D81 discipline (additive only, never
  remove/rearrange existing fields).

## Stop conditions

- All planned items shipped + verify passes → `/session-end`.
- 3-strike wall → invoke `/scope-cut`.
- Catastrophic block → halt + write CAUTION here.
- Destructive action attempt → halt unconditionally.

## Verification protocol

```
npm run verify  # = tsc --noEmit
```

Plus eval-driven preview verification of whatever feature shipped.
Save round-trip is standard.

## Notable footguns

- **D71 (recipe id stability)** — never reuse ids 1-10. Recipe 10
  (large_tent_kit) was just added; next new recipe gets id 11.
- **D81 (save migration discipline)** — `SAVE_VERSION` is now 7.
  Any new bump must be additive only.
- **D73 (wieldAction.ts as sole LMB dispatcher)** — extend wieldAction
  for new LMB behaviors; don't scatter mousePressed reads.
- **D80 (clone-not-parameterize)** — if a THIRD tent variant ever
  ships (tarp lean-to?), revisit the call; with 2 modules, clone
  was right.

## Begin block

Pick a direction (A/B/C above or roadmap bucket) → read the relevant
files → `TaskCreate` the priority list → mark first item in_progress
→ begin work.
