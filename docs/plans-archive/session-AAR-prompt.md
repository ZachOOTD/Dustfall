# Next Session — Kickoff Brief (post-AAQ)

## Read these now (in order)

1. `CLAUDE.md` (auto-loaded)
2. `docs/session-end-report.md` — cumulative state through AAQ
3. `docs/changelog.md` — AAQ + AAP entries at top
4. `docs/decisions.md` — D93 (composition-over-creation for cluster kinds); also D91/D92 (AAP), D88-D90.
5. `docs/roadmap.md`
6. `docs/backlog.md`

## What's already built

44 sessions. The overnight era + AAA-AAQ all shipped. Per-seed worlds (AAI/AAK), opening wreck polished (AAJ), project-wide audit (AAL), fire grill multi-cook (AAM, SAVE_VERSION v10), systems-review quick-wins (AAN), flagship paper-thin + grill HUD + companion huddle (AAO), sandworm overhaul + atmospheric music (AAP), POI clusters (AAQ — military convoys + refugee caravans). Codebase: tsc clean, 0 `as any`, 14 recipes (next id 15), 5 placeable kits + grill + companion + 3 procgen clusters per world. **World now reads as having narrative formation** — convoys and caravans give the scatter a "things happened here together" texture.

## Suggested focus (pick one)

AAQ slice closed cluster placement. Remaining POI-overhaul slices + other big-ticket items are open.

### Big-ticket (recommended for a long block)

- **Infinite chunk streaming** (still queued from post-AAI). Generate 800m chunks lazily as player approaches boundary; free farthest chunks. Per-chunk seed derivation (hash from worldSeed). GPU memory budget. Save bump v10→v11 (chunk state + placed-flagships set). ~6-10h. The last major architectural lift.
- **POI narrative beats** (POI overhaul follow-on). Add lone-survivor journal entries at the 6 flagships; hostile raider holdouts at convoy crash sites (AAQ's military_convoy clusters get a 50% chance of having raiders living in the wreckage); friendly hermit NPCs at scavenger camps. ~4-6h. The next coherent POI-overhaul angle.
- **Biome-specific POI kinds** (POI overhaul, final angle). Salt = corroded scientific outpost; rocky = subterranean entrance; dune = buried spaceship cockpit. Each is a NEW POI module — breaks the AAQ composition-only pattern (D93) but adds real silhouette variety. ~6-8h.
- **Salvage mechanics overhaul** — AAP's noise detection now makes "loud salvage attracts worm" concrete. Add tool requirements + per-panel rarity + condition decay. ~5-7h.
- **Trading / NPC economy** — design exploration first; warrants a planning pass.

### Medium picks (~2-3h)

- **Comm-relay cluster** — third cluster kind (satellite_dish-style center + 2-3 fuselages + debris). Tight scope; follows AAQ template directly.
- **Multi-worm population** (AAP scope-cut). Extend `ctx.sandWorm` from singleton to array. Save schema additive bump.
- **Tutorial coverage refresh** — grill_kit, companion_pod, RMB context actions, sled cargo hints.
- **Scrap_gun reload action** — AAN added empty crosshair; close the loop with R-key reload + SFX.
- **Music playtest tuning** — AAP shipped without in-play iteration.

### Quick polish (~30-90min)

- **Stamina tow factor playtest** (backlog from AAL).
- **Saved companion huddle state** — AAO huddle resets on load.
- **poi.ts scavenger-camp magic-number lift** — deferred from AAO.

## Autonomy contract

When ambiguous, pick the option closest to the GDD pillars + decisions.md realism dial (D45+, D49, D67, D86-D93), append a new D-entry, keep going. The user has authorized "work without stopping for clarifying questions, make the reasonable call and continue; they'll redirect if needed."

Stop conditions: wall-clock limit, 3-strike fix wall, catastrophic block, destructive-action attempt.

## Notable footguns (carried + new)

- **AAQ clusters expand the scatter density**. Each military_convoy adds 4-6 wrecks; with 3 clusters/world that's ~12-18 extra wrecks on top of 22 procgen + 6 flagships. If playtest reveals crowding, lower `CLUSTER_COUNT_PER_WORLD` to 2 before tightening other density bumps.
- **`_placedFlagshipPositions` now includes cluster anchors** post-AAQ. `getAnchorPOIPositions()` returns the combined list — any future code reading this should know it's flagships + clusters, not just the 6 original.
- **Composition-over-creation (D93)** — when adding a new cluster theme, default to layout-of-existing-primitives. Only break the rule for silhouettes the existing vocabulary genuinely can't produce.
- **AAP music tracks are continuous oscillators** — HMR may leak nodes. Hard-reload if music gets weird.
- **Sandworm reads `weather.intensity` not `perceivedIntensity`** (D90) for huddle — don't switch for "visual consistency."
- **Save schema is v10** — additive `hasGrill?: boolean` per fire. Pre-v10 saves load with hasGrill=false. Recipe id stability per D71 — next id is 15.

## Verification protocol

```
npm run verify     # = tsc --noEmit
```

For substantial features:
1. Boot game, exercise the feature (use `__game.ctx` / `__game.musicState()` console).
2. Save + reload roundtrip if persisted state changed.

## Begin block

Read CLAUDE.md (auto), session-end-report, AAP/AAQ changelog. Pick focus — infinite chunks is the biggest remaining architectural lift; POI narrative beats is the natural AAQ follow-on; salvage overhaul is the highest "depth" payoff now that noise-detection enables it. TaskCreate sub-tasks. Start coding.
