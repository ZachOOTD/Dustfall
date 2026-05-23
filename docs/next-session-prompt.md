# Next Session — Kickoff Brief (post-AAY)

## Read these now (in order)

1. `CLAUDE.md` (auto-loaded)
2. `docs/session-end-report.md` — cumulative state through AAY
3. `docs/changelog.md` — AAY + AAX + AAW entries at top
4. `docs/decisions.md` — D97-D100 (fabric shader, terrain-align debt, HoverState.entityId, companion architecture), D96 (condition derived), D94/D89 (no-bump derivation pattern), D86-D95.
5. `docs/roadmap.md`
6. `docs/backlog.md`

## What's already built

54 sessions. Salvage is fully tactile + tiered + readable. Inventory is
20-slot bag + 4-slot hotbar = 24 total. Crafting has partial-match
hints + a right-side recipe list with click-to-auto-fill (or click-to-
direct-craft in DEV MODE). Title screen has NEW GAME (empty) /
CONTINUE / DEV MODE (debug loadout with all recipes pre-discovered).
**Tents** are Bedouin-style with off-white canvas, sagged subdivided
roof panels, ridge poles, guy ropes, terrain-slope tilt; large tent
has an operational doorway. **Procedural fabric shader** lives in
`fabricMaterial.ts` (weave + color variation + stains + micro-grain).
**Lantern** is a salvaged-tech power-cell on an iron tripod with a
glowing crystalline core. **Companion** has a bodyShell-shaped
rotation pivot (rolls correctly) + hip-group leg articulation (legs
hinge at the body attachment) + terrain-slope alignment. POI clusters,
procgen sandworm, atmospheric music, grill, companion all shipped.

## Suggested focus (pick one)

### Big-ticket

- **Infinite chunk streaming** (still queued from post-AAI). The last major architectural lift. ~6-10h.
- **POI narrative beats** (AAQ follow-on). Lone-survivor journals, raider holdouts, hermit NPCs. ~4-6h.
- **Biome-specific POI kinds**. ~6-8h.
- **Trading / NPC economy** — design pass first.
- **Cloth physics** — real Verlet sim on fabric panels for wind response. Backlogged from AAY; ~4-6h focused session.

### Medium picks (~2-3h)

- **Texture overhaul** (backlog) — game-wide visual upgrade via PBR-ish material treatment OR extend procedural shader vocabulary. Decide bundle-cost stance first (current zero-texture-files policy per D3).
- **Crafting categorization** — group recipes by type (tool / weapon / shelter / consumable) in the right-side panel. Right now they're sorted by id.
- **Tutorial coverage refresh** — scrap_bar hint, DEV MODE explainer, grill_kit attach hint.
- **Salvage thermal-cut tier** — fire-starter as alternative pry tool.
- **megaWreck catwalk panel reachability** — ground-level secondary panels.
- **Multi-worm population** (AAP scope-cut).
- **Scrap_gun reload action**.
- **Wind shimmer shader** on fabric — cheap alternative to real cloth physics; ~30 LOC vertex displacement in `fabricMaterial.ts`.

### Quick polish

- Stamina tow factor playtest, saved companion huddle state, music playtest tuning, lift `alignMeshToTerrain` to shared util (4th caller will trigger).

## Autonomy contract

When ambiguous, pick the option closest to the GDD pillars + decisions.md realism dial (D45+, D49, D67, D86-D100), append a new D-entry, keep going.

Stop conditions: wall-clock limit, 3-strike fix wall, catastrophic block, destructive-action attempt.

## Notable footguns (carried + new)

- **AAY `alignMeshToTerrain` is duplicated 3x** (tent / largeTent / companion). 4th caller triggers extraction per D98. Don't add a 4th inline copy without lifting.
- **AAY large tent's operational doorway mutates `shelterZone.isLargeTent` dynamically**. Closed door = full enclosure (storm dampen 0). Save schema doesn't track door state — tents always load OPEN. Acceptable today; if "closed door persists" matters, bump schema additively.
- **AAY companion has TWO sub-groups now**: `bodyShell` (rolls around body center) + per-leg `hipGroup` (hinges). Rolling state animates `bodyShell.rotation.x`, NOT `body.rotation.x` (the old code did the latter and caused the bobbing-into-sand bug). Walking/idle/huddle animate `hips[i].rotation.z`, NOT `legs[i].position.y` (the old code did the latter and made the legs slide flat under the body).
- **AAY HoverState.verb overrides the static VERBS[type] map**. New verb-string-on-hover pattern; if a future case wants a state-dependent verb without adding a new InteractType, use this.
- **AAY HoverState.entityId** is now set on every fire interaction branch. Future onUse handlers that act on hovered entities should set + read this field (D99).
- **AAX `ctx.flags.devMode` is in-memory only**. CONTINUE clears it explicitly. Saves don't track it (backlog item if it ever matters).
- **AAW `[ DEV MODE ]` badge** is a single DOM element (`#dev-mode-badge`); visibility toggled by `handoffToGame` based on `ctx.flags.devMode`.
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

Read CLAUDE.md (auto), session-end-report, AAW/AAX/AAY changelog. Pick focus. TaskCreate sub-tasks. Start coding.
