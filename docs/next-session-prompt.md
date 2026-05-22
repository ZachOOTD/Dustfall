# Next Session — Kickoff Brief (post-AAT)

## Read these now (in order)

1. `CLAUDE.md` (auto-loaded)
2. `docs/session-end-report.md` — cumulative state through AAT
3. `docs/changelog.md` — AAT + AAS entries at top
4. `docs/decisions.md` — D96 (salvage condition derived from save-stable inputs); also D94/D95 (AAR), D91-D93.
5. `docs/roadmap.md`
6. `docs/backlog.md`

## What's already built

47 sessions. Salvage is fully tactile + tiered: scrap_bar lever, hinged-door panels with kind-specific interiors, deterministic per-component loot, electrical glow on open, AND per-panel condition tier (corroded / standard / pristine) with biome-driven distribution. Player can wreck-shop at a glance — "pristine cargo container in the dunes, worth the longer pry." POI clusters, procgen sandworm, atmospheric music, grill cooking, companion — all shipped.

## Suggested focus (pick one)

The salvage arc is now 4 sessions deep (AAR + AAS + AAT, with the AAB tables underpinning it). Salvage system is feature-complete enough — remaining backlog items are depth additions (thermal-cut tier, key-card panels, wreck durability). Other big-ticket lifts still open.

### Big-ticket (recommended for a long block)

- **Infinite chunk streaming** (still queued from post-AAI). The last major architectural lift. Lazy 800m chunks, per-chunk seed derivation, save bump v10→v11 (chunk state + placed-flagships set). ~6-10h.
- **POI narrative beats** (AAQ follow-on). Lone-survivor journal entries at flagships; hostile raider holdouts at convoy crash sites; friendly hermit NPCs at scavenger camps. ~4-6h. Story for the world.
- **Biome-specific POI kinds** (POI overhaul finale). Salt = corroded scientific outpost; rocky = subterranean entrance; dune = buried cockpit. ~6-8h.
- **Trading / NPC economy** — design pass first.

### Medium picks (~2-3h)

- **Comm-relay cluster** — third cluster kind (satellite_dish-style + 2-3 fuselages + debris).
- **Multi-worm population** (AAP scope-cut).
- **Tutorial coverage refresh** — including scrap_bar tutorial hint (still undiscovered except via recipe-book browsing).
- **Scrap_gun reload action** — AAN added empty crosshair; close the loop.
- **Salvage thermal-cut tier** — fire-starter as alternative pry tool for sealed panels.

### Quick polish (~30-90min)

- **Stamina tow factor playtest** (backlog from AAL).
- **Saved companion huddle state** — AAO huddle resets on load.
- **poi.ts scavenger-camp magic-number lift** — deferred from AAO.
- **Music playtest tuning** — AAP shipped without in-play iteration.

## Autonomy contract

When ambiguous, pick the option closest to the GDD pillars + decisions.md realism dial (D45+, D49, D67, D86-D96), append a new D-entry, keep going. The user has authorized "work without stopping for clarifying questions, make the reasonable call and continue; they'll redirect if needed."

Stop conditions: wall-clock limit, 3-strike fix wall, catastrophic block, destructive-action attempt.

## Notable footguns (carried + new)

- **AAT condition derives at registerSalvageable from `_biomes` singleton**. Any new salvageable-registering path that runs BEFORE `setSalvageBiomesContext(biomes)` (in main.ts boot) will get the base distribution with no biome bias. If you add a pre-biome-init salvage spawn (unlikely but possible), it'll skew uniform.
- **AAT `pickCondition` reads `rand()` once per registration**. The order of registerSalvageable calls affects the condition rolls across panels. Don't reorder existing registration calls without re-eyeballing condition distribution at a few seeds.
- **AAT loot-table fallback path** (corroded panel without panelComponentKind tag, or unknown ComponentKind) goes through `rollWreckLoot(kind)`. Pre-AAS saves with old panels hit this path — they yield the AAR loot, which is fine.
- **AAS variant interiors require kind hint at addAccessPanel call sites** — defaults to 'fuselage' if omitted.
- **AAR pre-AAR partial saves** reload showing all component meshes visible but extracts capped (D94).
- **AAR scrap_bar gates first salvage** — players who skip the recipe are soft-locked on salvage.
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
3. Spot-check across 2-3 seeds if procgen-touching.

## Begin block

Read CLAUDE.md (auto), session-end-report, AAS/AAT changelog. Pick focus. TaskCreate sub-tasks. Start coding.
