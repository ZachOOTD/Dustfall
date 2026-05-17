# Session KK — Wrecked-satellite-dish POI swap + antenna_outpost retirement

## Context

JJ removed `'antenna_spire'` from the random rotations (HERO_WRECK_TYPES
+ PROCGEN_WRECK_KINDS) but kept the hand-placed `antenna_outpost`
anchor POI at (-88, -50). This session swaps that one remaining
antenna for a wrecked satellite-dish silhouette (per backlog "wrecked
satellite dish POI") and retires the antenna_spire machinery
entirely. Net result: zero antenna_spire meshes in the world, one
new dish silhouette.

## Approach

### 1. New `makeSatelliteDish(rand, scale)` in `src/world/wrecks.ts`

Stylized low-poly wrecked dish, matching the existing wreck palette
(_hullMat / _hullDarkMat / _antennaMat). Components:

- **Buried base box** — ~2m × 1m × 2m, partly buried (similar to
  `makeAntennaSpire`'s base). Holds the salvage access panel.
- **Tripod struts** — 3 cylinders from the base up to a pivot point
  ~1.5m above ground, angled outward ~25° from vertical. Reads as
  "the dish mount."
- **Parabolic dish** — `LatheGeometry` with a quadratic profile
  (`y = t² × depth` from r=0..R). Diameter ~3m, depth ~0.6m.
  DoubleSide material so the concave inside is visible. **Tilted
  ~40° from vertical** to read as "broken / fallen over."
- **Feed horn** — small cylinder at the dish's focal point (along
  the dish axis, ~0.4m offset), painted dark.
- **Optional bent strut** — one extra strut at an awkward angle to
  emphasize "wrecked" silhouette.

Place via `addAccessPanel(g, baseW*0.42, baseH*0.5, baseW*0.30,
scale, 0)` — same convention as `makeAntennaSpire`.

### 2. Add `'satellite_dish'` to `WreckKind` union + placeWreck switch

`src/world/wrecks.ts:507` — extend the union; `src/world/wrecks.ts:541`
— add the case to the switch dispatching to `makeSatelliteDish`.

### 3. Remove all `'antenna_spire'` traces

After step 4 (the only user of antenna_spire) swaps to satellite_dish,
nothing else references `'antenna_spire'`. Remove:
- `makeAntennaSpire` function (`src/world/wrecks.ts:352-402`)
- `'antenna_spire'` member from `WreckKind` union (`src/world/wrecks.ts:512`)
- `case 'antenna_spire':` from placeWreck switch (`src/world/wrecks.ts:541`)
- `case 'antenna_spire':` from `shortNameFor` in `src/world/salvage.ts:44`

### 4. POI rename: `antenna_outpost` → `satellite_dish` (POI kind)

`src/world/poi.ts`:
- `POISpec.kind` union (line ~206-208) — replace `'antenna_outpost'`
  with `'satellite_dish'`
- `POI_LAYOUT` entry (line ~217) — same rename
- `placePOIs` switch (lines ~259-268) — replace the `'antenna_outpost'`
  case body: call `placeWreck(... 'satellite_dish' ...)` with the
  same `{ scale: 1.4, buryY: 0.5, tiltZ: 0.08 }` options. Keep the
  `placeDebrisField` call + `registerSalvageable(...'massive'...)`
  registration unchanged.

The POI position stays at (-88, -50). The visual changes from
"antenna tower" to "satellite dish wreck."

### 5. Add `'satellite_dish'` case to `shortNameFor` in salvage.ts

Returns `'satellite dish'` for prompt display.

## Files to modify

- `src/world/wrecks.ts` — add makeSatelliteDish, add to WreckKind +
  switch, remove makeAntennaSpire + 'antenna_spire' from union + switch
- `src/world/poi.ts` — rename POI kind + swap wreck kind in switch
- `src/world/salvage.ts` — shortNameFor: add 'satellite_dish', remove
  'antenna_spire'

## Acceptance criteria

- `npx tsc --noEmit` clean.
- Boot a fresh game: where the antenna_outpost was, there's now a
  wrecked satellite dish — visible silhouette (large tilted concave
  dish + tripod + small feed horn) instead of the tall thin spire.
- Eval `ctx.salvageables.list.filter(s => s.kind === 'antenna_spire').length`
  → 0 (was 1 before this session).
- Eval `ctx.salvageables.list.filter(s => s.kind === 'satellite_dish').length`
  → ≥ 1 (the new POI).
- Walking up to the dish + pressing E shows the salvage prompt with
  "satellite dish" as the noun.

## Verification

1. `npx tsc --noEmit`.
2. Browser reload, fresh game (skip opening via flag-flip if needed).
3. Eval the salvageables filter counts above.
4. Teleport to (-88, -50) (the POI position): see the dish silhouette
   at a visible offset (POI may have drifted slightly via terrain
   variance handling).
5. Screenshot from ~15m away showing the dish.

## Out of scope

- Pickup spawn at the dish (no journal / no special loot — just a
  salvageable wreck).
- Animation (dish doesn't rotate / track anything).
- Wider POI rework (just this one anchor).
