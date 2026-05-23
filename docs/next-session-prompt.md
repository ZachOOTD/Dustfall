# Next Session — Kickoff Brief (post-ABA)

## Read these now (in order)

1. `CLAUDE.md` (auto-loaded)
2. `docs/session-end-report.md` — cumulative state through ABA
3. `docs/changelog.md` — ABA entry at top + AAY just below
4. `docs/decisions.md` — D101–D104 (door direction, addAccessPanel as universal pipeline, terrainAlign shared util, procgen wreck coexistence), D97–D100 (fabric shader, terrain-align debt, HoverState.entityId, companion architecture), D86–D96 (per-session backstory)
5. `docs/roadmap.md`
6. `docs/backlog.md`

## What's already built

55 sessions. Salvage is fully tactile + tiered + readable + now
inherits hinged doors + interior loot from EVERY panel (post-ABA
legacy-panel migration). Inventory is 20-slot bag + 4-slot hotbar.
Crafting has partial-match hints + a right-side recipe list with
click-to-auto-fill (or direct-craft in DEV MODE). Bedouin tents,
operational doorway, fabric shader, salvaged-tech lantern, companion
with correct rolling + slope alignment, atmospheric music, procgen
sandworm, POI clusters, grill multi-cook all shipped.

**New in ABA**: light pool (no more lantern-placement freeze); all
salvage panels uniformly go through `addAccessPanel`; speeder damps
to rest when bumped; tutorial hints added; `alignToTerrain` lifted
to `src/util/terrainAlign.ts`; **procgen wreck composition system**
shipped (first cut — 3+3+2+2 part variants across cockpit /
hullSegment / engineModule / tailStub kinds, 2 wreck recipes
corvette + freighter, 35% of procgen slots use the system).

## Suggested focus (pick one)

### Big-ticket

- **Procgen wreck expansion** (ABA follow-on). More part variants,
  more recipes (gunship / science_vessel / bulk_hauler), biome-bias
  on recipe pick, breach patches as decoration layer, ramp the
  composite share past 0.35 once playtests validate visual quality.
  ~4-6h.
- **Infinite chunk streaming** (still queued). The last major
  architectural lift. ~6-10h.
- **POI narrative beats** (AAQ follow-on). Lone-survivor journals,
  raider holdouts, hermit NPCs. ~4-6h.
- **Biome-specific POI kinds**. ~6-8h.
- **Texture overhaul** (backlog) — PBR-ish material treatment OR
  extend the procedural shader vocabulary. Decide bundle-cost
  stance first (current zero-texture-files policy per D3 — would
  need to revisit).
- **Interactive opening cutscene** (backlog) — drop-pod descent
  with player inside a pre-baked landing animation, parachute lever
  comedy, blackout, pod exit, scrap salvage to first-pry. Substantial
  set-piece scope.
- **Cloth physics** (backlog from AAY) — real Verlet sim on fabric
  panels for wind response. ~4-6h focused session.

### Medium picks (~2-3h)

- **ABA P3 visual audit** — boot multiple seeds, walk to each
  flagship (satelliteDish / crashedHull / engineBlock / openingWreck)
  and verify the migrated panels sit flush + don't clip + door
  swings outward + the rotations I picked at migration time are
  visually correct. The architecture is sound; per-panel rotations
  may need 1-2 tweaks per site (especially crashedHull bell-throat
  panel B and satelliteDish back-of-dish).
- **Procgen wreck visual playtest** (ABA P7 follow-on) — confirm
  composite wrecks read as varied + plausible across multiple
  seeds. The procgenWreck.ts assembler positions parts along +X
  with cursor advance; verify part-to-part interfaces don't have
  visible seams or radius mismatches.
- **Crafting categorization** — group recipes by type
  (tool / weapon / shelter / consumable) in the right-side panel.
- **Remaining tutorial coverage** (RMB context actions, sled cargo).
- **Salvage thermal-cut tier** — fire-starter as alternative pry
  tool.
- **megaWreck catwalk panel reachability** — ground-level secondary
  panels.
- **Multi-worm population** (AAP scope-cut).
- **Scrap_gun reload action**.
- **Wind shimmer shader** on fabric — cheap alternative to real
  cloth physics; ~30 LOC vertex displacement in `fabricMaterial.ts`.

### Quick polish

- Stamina tow factor playtest, saved companion huddle state,
  music playtest tuning.

## Autonomy contract

When ambiguous, pick the option closest to the GDD pillars +
decisions.md realism dial (D45+, D49, D67, D86–D104), append a new
D-entry, keep going.

Stop conditions: wall-clock limit, 3-strike fix wall, catastrophic
block, destructive-action attempt.

## Notable footguns (carried + new)

- **ABA light pool sized at 24**. If procgen wrecks (P7) add salvage-
  panel glow lights via addAccessPanel, those are SCENE-DIRECT
  PointLights created inside addAccessPanel — they do NOT consume
  pool slots (they're set up at scene-add time and don't change the
  light count later). Confirm by re-reading wrecks.ts panel-glow
  block. If pool exhausted via fire+lantern stacking, callers fall
  back gracefully (no illumination but no crash). Bump pool size in
  `src/main.ts` if `claimLight` returns null frequently.
- **ABA `panelDoorAngle` is a positive magnitude; the sign is
  applied at the application site** (D101). Don't introduce a new
  positive-vs-negative convention; the negative encodes the hinge-
  frame convention. All callers of addAccessPanel inherit the fix.
- **ABA legacy panel migration** uses a wrapper-Group pattern. Each
  wrapper's local +Z = panel's outward direction. addAccessPanel
  recesses the body INTO -Z. New flagship modules should use the
  same pattern.
- **ABA `alignToTerrain` is in `src/util/terrainAlign.ts`** with
  module-level scratch vectors. Per-frame callers get zero GC.
  Per-call thread-safety: don't call from concurrent contexts (not
  an issue on the main-thread tick loop, but worth noting for
  future worker-offload).
- **ABA procgen wreck assembler** lays parts along +X with the
  cursor advancing per `partLength`. Parts assume their LONG axis
  runs along +X with anchor at x=0 and downstream face at x=partLength.
  panelAnchors are part-local; addAccessPanel writes
  `parent.userData.accessPanel = body` so multiple panels on the
  same parent overwrite each other — that's why each part is a
  separate parent in the assembler.
- **ABA `Tuning.PROCGEN_COMPOSITE_SHARE = 0.35`**. Bump in future
  sessions once playtests validate visual quality (currently
  un-tested at runtime).
- **AAY `alignMeshToTerrain` was duplicated 3x** — ABA lifted to
  `src/util/terrainAlign.ts`. Don't add a 4th inline copy.
- **AAY companion has TWO sub-groups**: `bodyShell` (rolls around
  body center) + per-leg `hipGroup` (hinges). Rolling state
  animates `bodyShell.rotation.x`, NOT `body.rotation.x`.
- **AAY HoverState.verb + entityId** — see D99.
- **AAX `ctx.flags.devMode` is in-memory only**. CONTINUE clears it.
- **AAR/AAS/AAT/AAU/AAV salvage stack** — schema stays v10 per
  D94/D96 derivation pattern. ABA added no fields.
- **AAP music tracks** continuous oscillators — HMR may leak nodes.
- **Sandworm `weather.intensity`** not perceivedIntensity (D90).
- **Save schema v10**. Recipe id 16 next per D71.

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

Read CLAUDE.md (auto), session-end-report, ABA changelog, decisions
D101–D104. Pick focus. TaskCreate sub-tasks. Start coding.
