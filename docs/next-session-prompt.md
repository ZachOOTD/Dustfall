# Next Session — Kickoff Brief (post-AAS)

## Read these now (in order)

1. `CLAUDE.md` (auto-loaded)
2. `docs/session-end-report.md` — cumulative state through AAS
3. `docs/changelog.md` — AAS + AAR entries at top
4. `docs/decisions.md` — D94 (cosmetic state from existing counters), D95 (prying composes with noise); also D91-D93 + D86-D90.
5. `docs/roadmap.md`
6. `docs/backlog.md`

## What's already built

46 sessions. Salvage is fully tactile (AAR + AAS): scrap_bar lever, hinged-door fuse-box panels with kind-specific interiors (5 component meshes drawn from a 7-mesh vocabulary), deterministic per-component loot mapping, pry creak + extract clink SFX, sandworm noise composition during pry, electrical flicker on open. Per-seed worlds, POI clusters, procgen sandworm, atmospheric music, grill cooking, companion — all shipped. Codebase: tsc clean, 15 recipes (next id 16), 5+1 placeable kits + grill + companion + scrap_bar tool.

## Suggested focus (pick one)

AAR + AAS closed the salvage loop core + first polish pass. Remaining big-ticket lifts open.

### Big-ticket (recommended for a long block)

- **Infinite chunk streaming** (still queued from post-AAI). The last major architectural lift. ~6-10h.
- **POI narrative beats** (AAQ follow-on). Lone-survivor journals at flagships; hostile raider holdouts at convoy crash sites; friendly hermit NPCs at scavenger camps. ~4-6h.
- **Biome-specific POI kinds** (POI overhaul finale). Salt = scientific outpost; rocky = subterranean entrance; dune = buried cockpit. Breaks D93 composition-only (new modules). ~6-8h.
- **Salvage condition tiers** (AAR/AAS follow-on). Corroded panels (easier pry, fewer components) vs pristine (harder pry, premium loot). Tied to wreck age/biome. ~3-5h.
- **Trading / NPC economy** — design pass first.

### Medium picks (~2-3h)

- **Comm-relay cluster** — third cluster kind (satellite_dish-style + 2-3 fuselages + debris).
- **Multi-worm population** (AAP scope-cut).
- **Tutorial coverage refresh** — including scrap_bar tutorial hint.
- **Scrap_gun reload action** — AAN added empty crosshair; close the loop.
- **Salvage thermal-cut tier** — fire-starter as alternative pry tool for sealed/heavier panels.

### Quick polish (~30-90min)

- **Stamina tow factor playtest** (backlog from AAL).
- **Saved companion huddle state** — AAO huddle resets on load.
- **poi.ts scavenger-camp magic-number lift** — deferred from AAO.
- **Music playtest tuning** — AAP shipped without in-play iteration.

## Autonomy contract

When ambiguous, pick the option closest to the GDD pillars + decisions.md realism dial (D45+, D49, D67, D86-D95), append a new D-entry, keep going. The user has authorized "work without stopping for clarifying questions, make the reasonable call and continue; they'll redirect if needed."

Stop conditions: wall-clock limit, 3-strike fix wall, catastrophic block, destructive-action attempt.

## Notable footguns (carried + new)

- **AAS variant interiors require kind hint at addAccessPanel call sites**. Any new POI module that adds a salvage panel MUST pass an appropriate `PanelKind`. Default is 'fuselage' but that gives the wrong loot palette for non-fuselage wrecks. Use the most-thematic kind.
- **AAS `panelComponentKind` tags drive loot lookup** in `COMPONENT_LOOT`. Adding a new ComponentKind requires a corresponding loot entry — without it, the fallback to rollWreckLoot still works but the player doesn't get the deterministic experience.
- **AAS glow PointLight has `castShadow: false`** for perf. If you add a new light feature later that DOES need shadows, do NOT just flip castShadow=true on these glow lights — 50+ shadow-casting point lights will crush GPU.
- **AAR pre-AAR partial saves** (any v10 save with `salvageRemaining < initialMax`) reload showing all 5 component meshes visible but extracts capped (D94).
- **AAR scrap_bar required for first salvage** — players who never craft one are soft-locked on salvage. Tutorial hint MAY be wanted.
- **AAP music tracks** continuous oscillators — HMR may leak nodes.
- **Sandworm `weather.intensity`** not perceivedIntensity (D90).
- **Save schema v10**. Recipe id 16 is next per D71.

## Verification protocol

```
npm run verify     # = tsc --noEmit
```

For substantial features:
1. Boot game, exercise the feature (use `__game.ctx` / `__game.musicState()`).
2. Save + reload roundtrip if persisted state changed.

## Begin block

Read CLAUDE.md (auto), session-end-report, AAR/AAS changelog. Pick focus. TaskCreate sub-tasks. Start coding.
