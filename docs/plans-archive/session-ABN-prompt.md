# Session ABN — Kickoff Brief (post-ABM)

## Read these now (in order)

1. `CLAUDE.md` (auto-loaded)
2. `docs/session-end-report.md` — cumulative state through ABM
3. `docs/changelog.md` — ABM + ABL + ABK-tail entries at top
4. `docs/decisions.md` — D108 still the latest
5. `docs/roadmap.md`
6. `docs/backlog.md`

## What's already built (post-ABM snapshot)

68 sessions. Tactile salvage + 6 narrative journals + 4 procgen wreck
classes + biome-bias on hullSegment variants + 5 weapon variants +
procedural world seed-stable + 7 procedural shader factories + 3
themed POI cluster kinds + complete biome-specific POI family +
sandworm bait-and-strike feeding loop + scrap_bar starter inventory
+ megaWreck on procedural shader vocab + curved hull shell. **NEW**:
dropped items have rigid-body physics — they roll/fall/settle on
dunes + survive save/load round-trip (ABM). SAVE_VERSION v11.

## Suggested focus (pick one)

### Big-ticket (single session, 3-10h)

- **A1 infinite chunk streaming** (~6-10h). Last major architectural
  lift. Lazy 800m chunks at boundaries; free farthest; per-chunk
  seed derivation; GPU memory budget. Save bump v11→v12.
- **B8 generalized rope attachment (re-scoped)** (~4-5h). Now that
  B7 shipped, items have positions + bodies to act as rope anchors.
  Needs new UX path (no rope-stub mesh on pickups) + gameplay
  decisions (can a piece of cloth pull a sled?) + data-model
  refactor splitting Tether into Endpoint pairs.

### Medium (~2-4h)

- **B6 5th wreck class** (`bulk_hauler` — wide cargo-heavy frame).
- **megaWreck catwalk panel reachability (panels 3 + 4)**.

### Polish / quick wins (~1-2h)

- **Item viewmodel fidelity pass (continuation)** — ABJ shipped 5
  items; ~25 remaining ItemDefs could benefit.
- **megaWreck full hull-shell extension to bow** — ABL added shell
  to aft only; bow still has its prior box silhouette.
- **Dropped-item playtest tune** — ABM defaults (damping 0.6/0.8,
  friction 0.85, density 0.6) need in-play signal. May need to bump
  friction higher if items roll forever on slopes.

### Archived 2026-05-24 (parked, may revisit — see docs/backlog.md Archive section)

flagship NPC beats / salvage durability per-wreck / rare key-card
panels / weld-kit restore / machete-as-wreck-loot — all intentionally
not in this session's menu. Detail preserved in backlog Archive for
the day the call changes.

## Autonomy contract

When ambiguous, pick the option closest to the GDD pillars +
decisions.md realism dial (D45+, D49, D67, D86–D108), append a new
D-entry, keep going.

Stop conditions: wall-clock limit, 3-strike fix wall, catastrophic
block, destructive-action attempt.

## Notable footguns

- **ABM dropped-item bodies**: only PLAYER-FACING drops use bodies
  (player drop / craft overflow / pickup-swap). Seed-spawn (branches,
  scavenger-camp bandage) stays static — adding bodies to all 140+
  seeded pickups would burn Rapier step budget. If adding new drop
  paths, decide deliberately whether to thread `opts.world`.
- **ABM save round-trip**: `droppedPickups` is additive on v11. If
  changing Pickup interface fields, audit save serialization to
  ensure they're persisted.
- **ABL megaWreck shell**: tapered cylinder over aft only. Bow still
  has box silhouette. Could extend symmetrically if time.
- **ABK-tail pointer-lock guard**: `handoffToGame()` skips
  `controls.lock()` in DEV+hidden/0×0 preview tabs. Apply same
  guard if adding new lock-acquisition points.
- **ABK-tail perf pass**: 31 scene PointLights via panel-glow pool.
  If adding new lights, use pool.
- **ABJ D108**: combine multiple additive save fields into one bump.
- **ABJ B12**: sandworm 'feeding' state, 2× damage during feeding.
- **Preview screenshot rule 5**: `ctx.time.dayTime = 0.5` + unpause
  briefly before screenshots.

## Verification protocol

```
npm run verify     # = tsc --noEmit
npx vite build     # production-build sanity
```

For substantial features:
1. Boot game, exercise the feature.
2. Save + reload roundtrip if persisted state changed.
3. Multi-seed sanity if the change touches world generation.

## Begin block

Read CLAUDE.md (auto), session-end-report (through ABM), recent
changelog (ABM + ABL + ABK-tail entries), decisions D106-D108. Pick
focus from the menu above. TaskCreate sub-tasks. Start coding.
