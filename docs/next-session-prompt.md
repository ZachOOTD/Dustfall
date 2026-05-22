# Next Session — Kickoff Brief (post-AAR)

## Read these now (in order)

1. `CLAUDE.md` (auto-loaded)
2. `docs/session-end-report.md` — cumulative state through AAR
3. `docs/changelog.md` — AAR + AAQ entries at top
4. `docs/decisions.md` — D94 (visible-depletion index-order, no save bump), D95 (prying composes with movement noise); also D91-D93.
5. `docs/roadmap.md`
6. `docs/backlog.md`

## What's already built

45 sessions. Salvage flow is now tactile: scrap_bar lever, hinged-door panels with 5 visible components, per-extract visible depletion, pry creak + component clink SFX, sandworm noise composition during pry (D95). Per-seed worlds, opening wreck, all flagships + procgen clusters (military + caravan), sandworm procgen, atmospheric music, grill cooking, companion — all shipped. Codebase: tsc clean, 0 `as any`, 15 recipes (next id 16), 5+1 placeable kits + grill + companion + scrap_bar tool.

## Suggested focus (pick one)

AAR closed the base salvage rewrite. Remaining big-ticket lifts + salvage polish angles all open.

### Big-ticket (recommended for a long block)

- **Infinite chunk streaming** (still queued from post-AAI). Generate 800m chunks lazily as player approaches boundary; free farthest chunks. Per-chunk seed derivation. GPU memory budget. Save bump v10→v11. ~6-10h. The last major architectural lift.
- **POI narrative beats** (POI overhaul follow-on). Lone-survivor journal entries at flagships; hostile raider holdouts at convoy crash sites (AAQ clusters); friendly hermit NPCs at scavenger camps. ~4-6h.
- **Biome-specific POI kinds** (POI overhaul, final angle). Salt = corroded scientific outpost; rocky = subterranean entrance; dune = buried spaceship cockpit. Breaks D93 composition-only — adds new POI modules. ~6-8h.
- **Salvage condition tiers** (AAR follow-on). Corroded panels (easier pry, fewer components) vs pristine (harder pry, premium loot). Tied to wreck age/biome. ~3-5h.
- **Trading / NPC economy** — design exploration first.

### Medium picks (~2-3h)

- **Salvage polish bundle** — electrical-flicker PointLight on panel open + variant interiors per wreck kind (fuselage has different components than cargo) + per-component loot mapping (wire→rope explicitly, chip→scrap_bullet). The "shaped depth" follow-on to AAR.
- **Comm-relay cluster** — third cluster kind (satellite_dish-style + 2-3 fuselages + debris).
- **Multi-worm population** (AAP scope-cut).
- **Tutorial coverage refresh** — including scrap_bar tutorial hint (AAR-shipped, currently undiscoverable except by recipe browsing).
- **Scrap_gun reload action** — AAN added empty crosshair; close the loop with R-key reload + SFX.

### Quick polish (~30-90min)

- **Stamina tow factor playtest** (backlog from AAL).
- **Saved companion huddle state** — AAO huddle resets on load.
- **poi.ts scavenger-camp magic-number lift** — deferred from AAO.
- **Music playtest tuning** — AAP shipped without in-play iteration.

## Autonomy contract

When ambiguous, pick the option closest to the GDD pillars + decisions.md realism dial (D45+, D49, D67, D86-D95), append a new D-entry, keep going. The user has authorized "work without stopping for clarifying questions, make the reasonable call and continue; they'll redirect if needed."

Stop conditions: wall-clock limit, 3-strike fix wall, catastrophic block, destructive-action attempt.

## Notable footguns (carried + new)

- **AAR pre-AAR partial saves** (any v10 save with `salvageRemaining < initialMax`) reload showing all 5 component meshes visible but extracts capped by `salvageRemaining`. Visible inconsistency on partial saves only — accepted per D94. Don't "fix" this by bumping schema unless playtest shows it's confusing.
- **AAR panel components hide in INDEX ORDER (0 → 4)** on extract. Engine kinds (max 3 extracts) leave components 3+4 visible at strip time. Intentional — reads as "the rest is too damaged." If we want full-cavity emptying on strip, lower the per-kind component count instead.
- **AAR open-door state doesn't persist** — saves close the door; player re-prys. Cheap (no resource cost), but flag if "re-pry feels mandatory" in playtest.
- **AAR scrap_bar is the FIRST tool-gated interaction in the game**. Players who somehow never craft one are soft-locked on salvage. Tutorial hint MAY be wanted to surface the recipe.
- **AAQ clusters expand wreck density**. CLUSTER_COUNT_PER_WORLD=3 adds ~12-18 extra wrecks. If AAR's slower per-panel time makes the world feel "salvage-everything" overwhelming, drop CLUSTER_COUNT_PER_WORLD to 2.
- **`_placedFlagshipPositions`** includes cluster anchors post-AAQ.
- **AAP music tracks** continuous oscillators — HMR may leak nodes.
- **Sandworm `weather.intensity`** not perceivedIntensity (D90) for huddle.
- **Save schema is v10**. Recipe id 16 is next per D71.

## Verification protocol

```
npm run verify     # = tsc --noEmit
```

For substantial features:
1. Boot game, exercise the feature (use `__game.ctx` / `__game.musicState()`).
2. Save + reload roundtrip if persisted state changed.

## Begin block

Read CLAUDE.md (auto), session-end-report, AAQ/AAR changelog. Pick focus. TaskCreate sub-tasks. Start coding.
