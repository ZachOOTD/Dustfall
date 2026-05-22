# Next Session — Kickoff Brief (post-AAV)

## Read these now (in order)

1. `CLAUDE.md` (auto-loaded)
2. `docs/session-end-report.md` — cumulative state through AAV
3. `docs/changelog.md` — AAV + AAU entries at top
4. `docs/decisions.md` — D96 (condition derived), D94/D89 (no-bump derivation pattern), D86-D95.
5. `docs/roadmap.md`
6. `docs/backlog.md`

## What's already built

49 sessions. Salvage is fully tactile + tiered + readable. Inventory bumped to 24 slots. Crafting has partial-match hints. Title screen has NEW GAME (empty) / CONTINUE / DEV MODE (debug loadout) — distinct intent paths. POI clusters, procgen sandworm, atmospheric music, grill, companion all shipped.

## Suggested focus (pick one)

### Big-ticket

- **Infinite chunk streaming** (still queued from post-AAI). The last major architectural lift. ~6-10h.
- **POI narrative beats** (AAQ follow-on). Lone-survivor journals, raider holdouts, hermit NPCs. ~4-6h.
- **Biome-specific POI kinds**. ~6-8h.
- **Trading / NPC economy** — design pass first.

### Medium picks (~2-3h)

- **Crafting categorization** — user mentioned grouping crafts by type (tool / weapon / shelter / consumable). Recipe book panel (TAB) could add tabs.
- **Tutorial coverage refresh** — scrap_bar hint, DEV MODE explainer.
- **Salvage thermal-cut tier** — fire-starter as alternative pry tool.
- **megaWreck catwalk panel reachability** — ground-level secondary panels.
- **Multi-worm population** (AAP scope-cut).
- **Scrap_gun reload action**.

### Quick polish

- Stamina tow factor playtest, saved companion huddle state, scavenger-camp magic-number lift, music playtest tuning.

## Autonomy contract

When ambiguous, pick the option closest to the GDD pillars + decisions.md realism dial (D45+, D49, D67, D86-D96), append a new D-entry, keep going.

Stop conditions: wall-clock limit, 3-strike fix wall, catastrophic block, destructive-action attempt.

## Notable footguns (carried + new)

- **AAV `Tuning.DEBUG_STARTER_LOADOUT` defaults to FALSE post-AAV** — regular NEW GAME starts empty. To force debug loadout for every boot regardless of title-menu pick, flip back to true (e.g. for verification harness runs).
- **AAV localStorage.devMode** persists across reloads — DEV MODE → reload → flag stays true → next vanilla refresh ALSO loads with starter loadout. Click NEW GAME from title to clear.
- **AAV backpack now 20 slots** — any save iteration that hardcoded `slots.length === 10` will break. Confirmed save.ts uses `inv.backpack.length` so it adapts.
- **AAV craft-drops-on-full** — pickups spawn at camera-forward 0.8m. If camera is pointing into a wall, drops may clip. (Same caveat as the AAG pickup-swap drop path.)
- **AAR/AAS/AAT/AAU/AAV salvage stack** — 5 sessions deep. Schema stays v10 throughout per D94/D96 derivation pattern.
- **AAP music tracks** continuous oscillators — HMR may leak nodes.
- **Sandworm `weather.intensity`** not perceivedIntensity (D90).
- **Save schema v10**. Recipe id 16 next per D71.

## Verification protocol

```
npm run verify     # = tsc --noEmit
```

For substantial features:
1. Boot game, exercise the feature.
2. Save + reload roundtrip if persisted state changed.

## Begin block

Read CLAUDE.md (auto), session-end-report, AAU/AAV changelog. Pick focus. TaskCreate sub-tasks. Start coding.
