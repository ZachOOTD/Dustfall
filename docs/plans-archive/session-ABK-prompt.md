# Session ABK — Kickoff Brief (post-ABJ)

## Read these now (in order)

1. `CLAUDE.md` (auto-loaded)
2. `docs/session-end-report.md` — cumulative state through ABJ
3. `docs/changelog.md` — ABJ entry at top (substantial — 4 tiers, 14 items)
4. `docs/decisions.md` — D108 (combined v11 schema bump rationale)
5. `docs/roadmap.md`
6. `docs/backlog.md`

## What's already built (post-ABJ snapshot)

65 sessions. Tactile salvage + 6 narrative journals + 4 procgen wreck
classes (corvette/gunship/freighter/science_vessel) with breach
patches + biome-bias on hullSegment variants + 5 weapon variants + procedural
world seed-stable + **7 procedural shader factories** covering all major
surface types (metal/paint/stone/skin/fabric/terrain/hull/concrete +
ABJ's wood-grain/bone/glass). 3 themed POI cluster kinds
(military_convoy / refugee_caravan / comm_relay) + first biome-
specific POI (dune buried cockpit, ABJ A4). Sandworm now has a
bait-and-strike feeding loop (B12 — 2× damage vulnerability window
when feeding on meat pickups). SAVE_VERSION v11 (combined huddleState
+ journalReadKinds + bornInDevMode per D108).

## Suggested focus (pick one)

### Big-ticket (single session, 4-10h)

- **A5 megaWreck rebuild** (~4-6h dedicated). BB-2 era model is the
  last visually-behind-the-rest-of-the-world hand-modeled prop.
  Rebuild with higher fidelity + better silhouette + ABH metal/paint
  shaders. Listed in ABJ Tier 5 stretch but explicitly deferred to
  its own session.
- **A1 infinite chunk streaming** (~6-10h). Last major architectural
  lift. Lazy 800m chunks generated at boundaries; free farthest
  chunks; per-chunk seed derivation; GPU memory budget. Save bump
  v11→v12.
- **A4 salt outpost POI** (~2.5h) + **A4 rocky entrance POI** (~3.5h)
  — completes the biome-specific POI family started in ABJ. Salt =
  concrete base + corroded antenna + sample crates. Rocky = cave-
  mouth + descending stair geometry (needs interior — largest of 3).
- **B7 dropped-item rigid-body physics** (~3h). Items roll/fall/
  settle. Needs Pickup.body field + dynamic-body spawn + per-frame
  sync. Save-state round-trip preserves body positions.
- **B8 generalized rope attachment** (~3h). Extend SledTether to
  support `{ kind: 'anchor', anchorEntityId }` for arbitrary world-
  object endpoints (bike + items + props). Reuses inextensible-rope
  constraint.

### Medium (~2-4h)

- **B6 5th wreck class** (`bulk_hauler` — wide cargo-heavy frame).
- **B5 flagship NPC beats** — hostile raider holdouts + friendly
  hermit NPCs at hand-modeled flagships (ABF shipped journals; NPC
  beats remain).
- **B9 salvage durability per-wreck** — finite mass across all
  panels; deplete completely → "corpse" wreck dim entirely.
- **B11 rare key-card panels** — gated behind a quest item; adds
  long-tail salvage variety.
- **megaWreck catwalk panel reachability (panels 3 + 4)** — ABE
  shipped 1 ground-level panel; the catwalk-mounted ones at ~11.5m
  still require stair climb.

### Polish / quick wins (~1-2h)

- **B10 restore corroded panels via weld kit** — inverts D96
  (condition becomes player-mutable, must move to save).
- **Item viewmodel fidelity pass (continuation)** — ABJ shipped 5
  items (cloth/scrap/branch/bandage/rope); ~25 remaining ItemDefs
  could benefit from similar shader-vocab uplift.
- **Tier 5 backlog stretch from ABJ** — any of the 5 deferred items.

## Autonomy contract

When ambiguous, pick the option closest to the GDD pillars +
decisions.md realism dial (D45+, D49, D67, D86–D108), append a new
D-entry, keep going.

Stop conditions: wall-clock limit, 3-strike fix wall, catastrophic
block, destructive-action attempt.

## Notable footguns (carried + new)

- **ABJ D108 combined v11 bump**: when adding ANOTHER schema-affecting
  field next session, decide upfront whether to bundle it with other
  pending fields (D108 rule) or ship its own bump. For non-trivial
  migrations (renames, restructures), prefer atomic bumps.
- **ABJ B4 biome-bias**: procgenWreck's `pickPart` now takes an
  optional `biome` arg. Default (no biome) preserves uniform variant
  selection. If adding new part variants to HULL_SEGMENT_VARIANTS,
  update HULL_SEGMENT_BIOME_WEIGHTS too (it indexes by array
  position — adding a 6th variant would need 6 entries per biome).
- **ABJ B12 sandworm 'feeding' state**: damageSandWorm now allows
  hits during 'feeding' at 2× damage. If adding new SandWormState
  values, audit damageSandWorm's gate to confirm intended damage
  window. New _feedBaitPickupId field on the SandWorm interface.
- **ABJ A4 buriedCockpit.ts**: first POI module to integrate the
  glassMaterial. If adding more glass-surfaced POIs, reuse
  `createGlassMaterial` from `src/world/glassMaterial.ts` (DON'T
  re-roll the factory — it's the standard now).
- **ABG/ABI/ABJ salvage panel design**: BackSide body + 4-bar hollow
  rim + flush-with-hull positioning. When placing new salvage panels
  on new wreck modules, verify the panel POSITION isn't buried
  inside the parent geometry (see ABI report for the 3 fixes).
- **AAB legacy preview_screenshot blocker**: canvas 0×0 in hidden
  tabs. Per `dustfall_preview_gotchas.md`: use data-driven
  verification via preview_eval. Rule 4 (added ABI): always set
  `ctx.time.dayTime = 0.5` + unpause briefly before any visual
  screenshot, otherwise scene is too dark.
- **Save schema v11**. If a session needs to persist new state, bump
  additively per D81 + D108. ABJ's combined bump pattern is the
  template.

## Verification protocol

```
npm run verify     # = tsc --noEmit
npx vite build     # production-build sanity
```

For substantial features:
1. Boot game, exercise the feature.
2. Save + reload roundtrip if persisted state changed.
3. Multi-seed sanity if the change touches world generation.

Preview screenshot tool: per `memory/dustfall_preview_gotchas.md`
rule 4, always pre-set `ctx.time.dayTime = 0.5` + unpause briefly +
re-pause before the screenshot.

## Begin block

Read CLAUDE.md (auto), session-end-report (current state through ABJ),
recent changelog (ABJ + ABI + ABH entries), decisions D106-D108.
Pick focus from the menu above. TaskCreate sub-tasks. Start coding.
