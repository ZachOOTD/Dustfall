# Next Session — Kickoff Brief (post-AAU)

## Read these now (in order)

1. `CLAUDE.md` (auto-loaded)
2. `docs/session-end-report.md` — cumulative state through AAU
3. `docs/changelog.md` — AAU + AAT entries at top
4. `docs/decisions.md` — D94 (cosmetic-state from counters), D96 (condition derived from save-stable inputs); D91-D95.
5. `docs/roadmap.md`
6. `docs/backlog.md`

## What's already built

48 sessions. Salvage is 5 sessions deep (AAR + AAS + AAT + AAU + AAB tables underneath): tactile pry + extract, kind-specific interiors with per-component loot, condition tiers (corroded/standard/pristine) with biome distribution, rectangular access-panel proportions recessed into hulls. POI clusters, procgen sandworm, atmospheric music, grill cooking, companion — all shipped. Codebase: tsc clean, 15 recipes (next id 16), 5+1 placeable kits + grill + companion + scrap_bar tool. **The salvage arc is feature-complete** — remaining items are progression depth, not core loop.

## Suggested focus (pick one)

### Big-ticket (recommended for a long block)

- **Infinite chunk streaming** (still queued from post-AAI). The last major architectural lift. ~6-10h.
- **POI narrative beats** (AAQ follow-on). Lone-survivor journal entries at flagships; hostile raider holdouts at convoy crash sites; friendly hermit NPCs at scavenger camps. ~4-6h.
- **Biome-specific POI kinds** (POI overhaul finale). Salt = corroded scientific outpost; rocky = subterranean entrance; dune = buried cockpit. ~6-8h.
- **Trading / NPC economy** — design pass first.

### Medium picks (~2-3h)

- **Comm-relay cluster** — third cluster kind.
- **Multi-worm population** (AAP scope-cut).
- **Tutorial coverage refresh** — including scrap_bar tutorial hint (still undiscovered except via recipe book).
- **Scrap_gun reload action** — close the AAN empty-crosshair loop.
- **Salvage thermal-cut tier** — fire-starter as alternative pry tool.
- **megaWreck catwalk panel reachability** — engine bell panels at 7.7m need ground-level secondary panels for players who don't climb.

### Quick polish (~30-90min)

- **Stamina tow factor playtest** (backlog from AAL).
- **Saved companion huddle state** — AAO huddle resets on load.
- **poi.ts scavenger-camp magic-number lift** — deferred from AAO.
- **Music playtest tuning** — AAP shipped without in-play iteration.

## Autonomy contract

When ambiguous, pick the option closest to the GDD pillars + decisions.md realism dial (D45+, D49, D67, D86-D96), append a new D-entry, keep going.

Stop conditions: wall-clock limit, 3-strike fix wall, catastrophic block, destructive-action attempt.

## Notable footguns (carried + new)

- **AAU recessed-body shift uses faceYaw rotation** — if a caller passes localZ that already accounts for the old "panel sticks out forward" geometry, the new recess will sink the panel TOO far. Audit caller positions if AAU's recess feels too deep on any wreck kind.
- **AAU scrap_bar in starter loadout is a DEBUG toggle** — when shipping a "real" playthrough, set Tuning.DEBUG_STARTER_LOADOUT=false; the player will then need to craft scrap_bar (recipe id 15: scrap×2 + branch×1) before any salvage.
- **AAR/AAS/AAT/AAU saves stay v10** — derived state per D94/D96; no schema bump across the whole salvage arc.
- **megaWreck engine bell panels at y=7.7m and catwalk stub panels at y=11.5m** require interior stairs to reach. If playtest reveals players don't realize the climb path, add ground-level secondary panels.
- **AAP music tracks** continuous oscillators — HMR may leak nodes.
- **Sandworm `weather.intensity`** not perceivedIntensity (D90).
- **Save schema v10**. Recipe id 16 next per D71.

## Verification protocol

```
npm run verify     # = tsc --noEmit
```

For substantial features:
1. Boot game, exercise the feature (use `__game.ctx` / `__game.musicState()`).
2. Save + reload roundtrip if persisted state changed.

## Begin block

Read CLAUDE.md (auto), session-end-report, AAT/AAU changelog. Pick focus. TaskCreate sub-tasks. Start coding.
