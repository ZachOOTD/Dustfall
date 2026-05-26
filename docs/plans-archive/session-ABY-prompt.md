# Session ABZ — Kickoff Brief (post-ABY)

## Read these now (in order)

1. `CLAUDE.md` (auto-loaded; ABY Last-shipped + 10-session arc)
2. `docs/session-end-report.md` — cumulative through ABY
3. `docs/changelog.md` — ABY + ABX + ABW + ABV at top
4. `docs/decisions.md` — D118 latest; D107-D118 = procedural-character
   pipeline
5. `docs/roadmap.md` — Up next = ABZ big-ticket pivot
6. `docs/backlog.md` — ABY followup at top
7. `~/projects/gamedev-framework/shared-memory/iterative-polish-
   discipline.md` — discipline 11 sessions running

## What's already built (post-ABY snapshot)

80 sessions. **10-session iteration arc complete**: ABP→ABX procedural-
character pipeline + ABY Road A polish wrap-ups. Full visual stack
landed within D107 zero-asset. The character + cloth + animation +
camera + textures + audio cadence + viewmodel readability are all
shipping-quality at low-poly stylized 3P game level.

## Session ABZ focus

**Pivot to big-ticket feature work**. Procedural character is done;
time to shift back to game-design feature additions.

## Priority items — pick ONE big-ticket (~4-10h)

### Option A — A1 Infinite chunk streaming (~6-10h)
Last major architectural lift. Lazy 800m chunks load at boundaries;
free farthest; per-chunk seed derivation; GPU memory budget. Save
bump v11→v12.
- Replace 3×3 hardcoded chunk grid with streaming N×N around player
- LRU eviction
- Per-chunk POI placement deferred to load-time
- Seed-stable across reload
- Save format: chunk-anchor + dirty-chunks deltas

### Option B — B1 Generalized rope attachment (~4-5h)
Re-scoped from ABO/ABP cuts. RopeEndpoint union + Tether refactor +
RMB-on-item UX.
- Currently rope attaches to specific sled-rope-stub
- Generalize so player can tether: companion, raider corpse, sandworm
  carcass (anything with body), or even between two static objects
- Save migration for new Tether shape
- RMB-on-wielded-rope picks attachment target

### Option C — B5 Flagship NPC beats (~4-6h)
Hostile raider holdouts + friendly hermits at hand-modeled flagships.
Composes existing raider AI + new dialogue/journal hooks.
- 3-4 NPC variants: raider sentry, raider scavenger, scarred hermit,
  amputee survivor
- Hand-placed at megaShip + crashedHull + satelliteDish + opening
  wreck (or procgen flagships)
- Per-NPC journal/dialogue blurbs
- Optional combat/peaceful flag per NPC

### Option D — Apply procedural-character pipeline to NPCs (~4-8h)
Use the D115+D117+D118 stack to upgrade existing creatures: companion,
raider variants, lizards. Each creature gets Lathe-based body + cloth
where applicable + sub-pivots for animation. Pipeline reusability test.

## Autonomy contract

When ambiguous, pick the option closest to the GDD pillars +
decisions.md realism dial (D45+, D49, D67, D86–D118), append a new
D-entry, keep going.

**Iteration discipline contract** (11 sessions running):
- `tsc clean` is NOT the success gate on visual/feel work
- For BIG-TICKET feature work, the discipline shifts: ship tier-
  ladder slices with verify gates, not "5 rounds per element".
  Iteration discipline applies if the feature has visual surface.
- Pure architectural lifts (chunk streaming) verify via tsc + smoke
  test + multi-seed reload.

Stop conditions: wall-clock limit, 3-strike fix wall, catastrophic
block, destructive-action attempt.

## Notable footguns

- **D107 zero-asset** stays load-bearing.
- **D118 sub-pivots**: body → spineBend → upper-body. Legs on body.
- **D117 cloth drape pattern**: codified, ready to apply to NPCs.
- **D115 LatheGeometry organic primitive**: ready to apply to NPCs.
- **ABV stepCount infra** in rig: available for tying audio/effects
  to gait phase if NPCs adopt the rig pipeline.
- **HMR full reload** on playerRig.ts changes.

## Verification protocol

```
npm run verify     # = tsc --noEmit
```

For big-ticket work, plan tier-by-tier with success criteria per
tier. Boot game + smoke-test critical paths.

## Begin block

Read CLAUDE.md (auto). Read session-end-report (through ABY) +
recent changelog + decisions. Ask user or make reasonable call:
Option A/B/C/D. TaskCreate sub-tasks. Start.

**The iteration discipline IS still the contract** for any visual
surface work in the chosen big-ticket.
