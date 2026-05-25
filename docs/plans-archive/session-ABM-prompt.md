# Session ABM — Kickoff Brief (post-ABL)

## Read these now (in order)

1. `CLAUDE.md` (auto-loaded)
2. `docs/session-end-report.md` — cumulative state through ABL
3. `docs/changelog.md` — ABL + ABK-tail + ABK entries at top
4. `docs/decisions.md` — D108 still the latest
5. `docs/roadmap.md`
6. `docs/backlog.md`

## What's already built (post-ABL snapshot)

67 sessions. Tactile salvage + 6 narrative journals + 4 procgen wreck
classes + biome-bias on hullSegment variants + 5 weapon variants +
procedural world seed-stable + 7 procedural shader factories (now
applied across ALL major hand-modeled props — last holdout megaWreck
closed ABL) + 3 themed POI cluster kinds + **complete biome-specific
POI family** (dune cockpit + salt outpost + rocky entrance with
shelter zone) + sandworm bait-and-strike feeding loop + scrap_bar
starter inventory. SAVE_VERSION v11. Perf-pass tuned (96→31 scene
PointLights, throttled shadow updates, Rapier pre-warm; targeting
144fps).

## Suggested focus (pick one)

### Big-ticket (single session, 3-10h)

- **A1 infinite chunk streaming** (~6-10h). Last major architectural
  lift. Lazy 800m chunks at boundaries; free farthest; per-chunk
  seed derivation; GPU memory budget. Save bump v11→v12.
- **B5 flagship NPC beats** (~4-6h). Hostile raider holdouts +
  friendly hermit NPCs at hand-modeled flagships. ABF shipped
  journals; this adds the live NPCs.
- **B7 + B8 paired** (~5-6h). Dropped-item rigid-body physics +
  generalized rope attachment to arbitrary world endpoints.

### Medium (~2-4h)

- **B6 5th wreck class** (`bulk_hauler` — wide cargo-heavy frame).
- **B9 salvage durability per-wreck** — finite mass across panels;
  deplete → "corpse" wreck dim entirely.
- **B11 rare key-card panels** — gated behind a quest item.
- **megaWreck catwalk panel reachability (panels 3 + 4)**.
- **Add machete back as wreck loot** — ABK-tail swap left player
  with no starter melee weapon. If playtest feels too punishing,
  add machete as a small-chance procgen wreck drop.

### Polish / quick wins (~1-2h)

- **B10 restore corroded panels via weld kit** — inverts D96.
- **Item viewmodel fidelity pass (continuation)** — ABJ shipped 5
  items; ~25 remaining ItemDefs could benefit.
- **megaWreck full hull-shell extension to bow** — ABL added shell
  to aft only; bow still has its prior box silhouette.

## Autonomy contract

When ambiguous, pick the option closest to the GDD pillars +
decisions.md realism dial (D45+, D49, D67, D86–D108), append a new
D-entry, keep going.

Stop conditions: wall-clock limit, 3-strike fix wall, catastrophic
block, destructive-action attempt.

## Notable footguns

- **ABK-tail starter swap**: player starts with scrap_bar + canteen
  (no machete). Unarmed for melee until pipe_staff crafted. Add
  machete to wreck loot pool if playtest feels too punishing.
- **ABK-tail pointer-lock guard**: `handoffToGame()` skips
  `controls.lock()` in DEV+hidden/0×0 preview tabs. Real-user
  gameplay unaffected. If you add other lock-acquisition points,
  apply the same guard pattern.
- **ABK-tail perf pass**: 96 → 31 scene PointLights (panel glows
  pooled). lightPool size 30. If adding new panel-glow consumers,
  use the pool, don't allocate new per-entity PointLights.
- **ABL megaWreck shell**: tapered cylinder shell drapes over aft
  only. If extending to bow, mirror the pattern (smaller radii,
  attached to bowGroup so bowYOffset applies).
- **ABJ D108 combined v11 bump**: combine additive fields when 2+
  ship same session.
- **ABJ B12 sandworm feeding**: damageSandWorm allows 2× damage
  during 'feeding' state.
- **Preview screenshot rule 5**: always set `ctx.time.dayTime = 0.5`
  + unpause briefly before any visual screenshot.

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

Read CLAUDE.md (auto), session-end-report (through ABL), recent
changelog (ABL + ABK-tail + ABK entries), decisions D106-D108. Pick
focus from the menu above. TaskCreate sub-tasks. Start coding.
