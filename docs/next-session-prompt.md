# Session ABL — Kickoff Brief (post-ABK)

## Read these now (in order)

1. `CLAUDE.md` (auto-loaded)
2. `docs/session-end-report.md` — cumulative state through ABK
3. `docs/changelog.md` — ABK + ABJ entries at top
4. `docs/decisions.md` — D108 still the latest
5. `docs/roadmap.md`
6. `docs/backlog.md`

## What's already built (post-ABK snapshot)

66 sessions. Tactile salvage + 6 narrative journals + 4 procgen wreck
classes + biome-bias on hullSegment variants + 5 weapon variants +
procedural world seed-stable + 7 procedural shader factories +
3 themed POI clusters (military_convoy / refugee_caravan / comm_relay)
+ **complete biome-specific POI family**: dune buried cockpit (ABJ),
salt corroded outpost (ABK), rocky subterranean entrance with shelter
zone (ABK). Sandworm bait-and-strike feeding loop (ABJ B12).
SAVE_VERSION v11.

## Suggested focus (pick one)

### Big-ticket (single session, 3-10h)

- **A5 megaWreck rebuild** (~4-6h dedicated). BB-2 era model is the
  last visually-behind-the-rest-of-the-world hand-modeled prop.
  Rebuild with higher fidelity + better silhouette + ABH metal/paint
  + ABJ wood-grain/bone shaders.
- **A1 infinite chunk streaming** (~6-10h). Last major architectural
  lift. Lazy 800m chunks at boundaries; free farthest; per-chunk seed
  derivation; GPU memory budget. Save bump v11→v12.
- **B7 dropped-item rigid-body physics** (~3h). Items roll/fall/
  settle. Add Pickup.body field + dynamic spawn + per-frame sync.
  Save round-trip preserves positions.
- **B8 generalized rope attachment** (~3h). Extend SledTether to
  support arbitrary world-object endpoints. Reuses inextensible-rope
  constraint.
- **B5 flagship NPC beats** (~4-6h). Hostile raider holdouts +
  friendly hermit NPCs at hand-modeled flagships. ABF shipped journal
  narrative; NPC beats remain.

### Medium (~2-4h)

- **B6 5th wreck class** (`bulk_hauler` — wide cargo-heavy frame).
- **B9 salvage durability per-wreck** — finite mass across panels;
  deplete completely → "corpse" wreck dim entirely.
- **B11 rare key-card panels** — gated behind a quest item; long-tail
  salvage variety.
- **megaWreck catwalk panel reachability (panels 3 + 4)** — ABE
  shipped 1 ground-level panel; catwalk-mounted ones at ~11.5m still
  require stair climb.

### Polish / quick wins (~1-2h)

- **B10 restore corroded panels via weld kit** — inverts D96.
- **Item viewmodel fidelity pass (continuation)** — ABJ shipped 5
  items (cloth/scrap/branch/bandage/rope); ~25 remaining ItemDefs
  could benefit from similar shader-vocab uplift.
- **POI count tuning** — ABK shipped 1 each of salt/rocky/dune
  biome POIs. Playtest signal may justify SALT_OUTPOST_COUNT or
  ROCKY_ENTRANCE_COUNT > 1 in larger worlds.

## Autonomy contract

When ambiguous, pick the option closest to the GDD pillars +
decisions.md realism dial (D45+, D49, D67, D86–D108), append a new
D-entry, keep going.

Stop conditions: wall-clock limit, 3-strike fix wall, catastrophic
block, destructive-action attempt.

## Notable footguns (carried)

- **ABK biome POI family complete**: 3 biome POIs (dune/salt/rocky)
  are now shipped. Dispatch in `poi.ts` goes dune→salt→rocky for
  greedy multi-region spread — preserve this order if adding 4th
  biome POIs (none planned).
- **ABK rocky entrance has interior + shelter zone**: First non-
  flagship POI with a sheltered chamber. If adding sheltered POIs
  next, follow the BackSide-cavity pattern (`_interiorMat.side =
  THREE.BackSide; shadowSide = THREE.FrontSide`) + `addShelterZone`
  for the interior bounds.
- **ABJ D108 combined v11 bump**: when adding ANOTHER schema-
  affecting field, decide upfront whether to bundle it with other
  pending fields (D108 rule) or ship its own bump.
- **ABJ B4 biome-bias on procgen recipes**: HULL_SEGMENT_BIOME_WEIGHTS
  indexes by array position — adding a 6th hullSegment variant
  requires 6 entries per biome.
- **Salvage panel design**: BackSide body + 4-bar hollow rim +
  flush-with-hull positioning. Verify panel POSITION isn't buried
  inside parent geometry (see ABI report).
- **Preview screenshot rule 4**: always set `ctx.time.dayTime = 0.5`
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

Read CLAUDE.md (auto), session-end-report (through ABK), recent
changelog (ABK + ABJ entries), decisions D106-D108. Pick focus from
the menu above. TaskCreate sub-tasks. Start coding.
