# Session — World rework #2: biome rescale + scatter retune

## Context

Session FF shipped chunked terrain (2400m world via 3×3 heightfield
chunks). All scatter (cactus, dead tree, well, hero landmarks) and the
biome noise channel are still tuned for the pre-FF 800m world, so
biomes "speckle" through tiny regions and scatter clusters in a tight
~250m disc around spawn. Outer chunks look bare. This session
generalises the biome wavelength to 1/900 (≈2.67 vast biome regions
per axis) and rescales scatter to cover the full 2400m world while
preserving its sparse, intentional feel.

Save-compat: the schema persists scatter STATE (harvested, looted,
salvage-remaining) keyed by ordinal id, not position. `_nextId`
counters reset per boot, so post-#2 cacti get ids 1..10 deterministically.
A v2 save with `cactus id 2 harvested` loads in v3 and applies
"harvested" to the new id 2 cactus — same id, different position. State
is preserved; the player sees their salt-region landscape rearranged,
which is expected since biome regions are 4× bigger now.

## Approach

### 1. `src/config/tuning.ts` — biome + scatter tuning

Change:
- `BIOME_NOISE_FREQ: 1 / 220 → 1 / 900`. Three biome types over ~2.67
  axis regions means 2-3 visible biomes in a 2400m world.

Add (promote magic numbers from scatter modules):
```
// Scatter — world-rework #2 (EE-FF-GG arc)
CACTUS_TARGET_COUNT: 10,
CACTUS_SCATTER_RADIUS_MIN: 12,
CACTUS_SCATTER_RADIUS_MAX: 1100,
DEAD_TREE_TARGET_COUNT: 30,
DEAD_TREE_SCATTER_RADIUS_MIN: 20,
DEAD_TREE_SCATTER_RADIUS_MAX: 1100,
HERO_LANDMARK_COUNT_MIN: 15,
HERO_LANDMARK_COUNT_MAX: 20,
HERO_LANDMARK_RADIUS_MIN: 70,
HERO_LANDMARK_RADIUS_MAX: 1050,
WELL_MIN_SEPARATION: 400,         // greedy exclusion radius for multi-well placement
BIOME_CENTROID_SEARCH_RADIUS: 1100,
BIOME_CENTROID_GRID_STEP: 24,
```

Change existing:
- `WELL_TARGET_COUNT: 1 → 3` (one per major salt region).

Delete dead config:
- `LANDMARK_COUNT: 180` — never read anywhere (verified via grep).

`WORLD_RADIUS: 900` stays. Only used by `spawnBranches` which boots
with `count=0` — effectively dead but cheap to keep for future use.

### 2. `src/world/biomes.ts` — `findBiomeCentroid()` helper

Generalize the existing `findSaltCentroid` from waterSources.ts:
```ts
export interface BiomeCentroidOptions {
  searchRadius?: number;   // default BIOME_CENTROID_SEARCH_RADIUS
  gridStep?: number;       // default BIOME_CENTROID_GRID_STEP
  excludeCenters?: Array<{ x: number; z: number; radius: number }>;
}

export function findBiomeCentroid(
  biomes: BiomeSampler,
  target: BiomeId,
  options?: BiomeCentroidOptions,
): { x: number; z: number } | null;
```

Score = `biomes.rawAt(x, z)` (raw biome noise — higher = deeper into
target). NO origin-distance penalty — that was a hack for the 800m
world; with 1100m search range it would swamp biome scoring.
`excludeCenters` lets callers do greedy multi-pass placement: pass the
positions of already-chosen centroids with an exclusion radius and the
next call returns the best remaining cell outside those circles.

### 3. `src/world/waterSources.ts` — multi-well via greedy exclusion

Remove the local `findSaltCentroid`. Use `findBiomeCentroid(biomes,
'salt')` from biomes.ts. For `WELL_TARGET_COUNT = 3`:
```
const centers: { x, z, radius }[] = [];
for (let i = 0; i < TARGET_WELLS; i++) {
  const c = findBiomeCentroid(biomes, 'salt', {
    excludeCenters: centers,
  });
  if (!c) break;            // ran out of salt region — stop early
  centers.push({ ...c, radius: WELL_MIN_SEPARATION });
  // ... build + place well at c
}
```
The first centroid is the globally-best salt cell; subsequent ones are
the best remaining cell at least 400m away from prior picks. Wells
naturally distribute across the largest salt regions.

### 4. `src/world/cactus.ts` — pull bounds + count from tuning

Replace:
```
const TARGET = 3;
const radius = 12 + rand() * 240;
```
With:
```
const TARGET = Tuning.CACTUS_TARGET_COUNT;
const radius = Tuning.CACTUS_SCATTER_RADIUS_MIN +
  rand() * (Tuning.CACTUS_SCATTER_RADIUS_MAX - Tuning.CACTUS_SCATTER_RADIUS_MIN);
```
Bump `MAX_ATTEMPTS` from 200 → 600 (10 targets × 60 attempts/target, same
attempts-per-target ratio as before).

### 5. `src/world/deadTree.ts` — same pattern

Replace the `count = 12` default param + hardcoded radius bounds with
tuning constants. `MAX_ATTEMPTS = count * 25` formula stays — auto-scales.
Update `spawnDeadTrees` call site in `main.ts` to NOT pass `count` so
the tuning default wins (or remove the parameter entirely).

### 6. `src/world/heroLandmarks.ts` — same pattern

Replace `count = 7 + Math.floor(rand() * 3)` with:
```
const minCount = Tuning.HERO_LANDMARK_COUNT_MIN;
const maxCount = Tuning.HERO_LANDMARK_COUNT_MAX;
const count = minCount + Math.floor(rand() * (maxCount - minCount + 1));
```
Replace `radius = 70 + rand() * 180` with `HERO_LANDMARK_RADIUS_MIN +
rand() * (MAX - MIN)`. Angles already evenly distributed around the
circle — the existing `(i / count) * Math.PI * 2` formula adapts to
the new count automatically.

### 7. `src/persistence/save.ts` — version bump

- `SAVE_VERSION: 2 → 3`
- `version: 1 | 2 | 3` in the `SaveV1` interface
- Loader accepts versions 1, 2, AND 3 (`save.version !== 1 && !== 2 && !== 3`)

No migration code needed. The id-based persistence schema for cacti /
lizards / salvageables / lootContainers naturally handles count growth:
new ids are spawned fresh (un-harvested / not-looted), saved ids find
their matching new spawn by id and apply state.

## Files to be modified

- `src/config/tuning.ts` — biome freq, scatter constants, well count
- `src/world/biomes.ts` — add `findBiomeCentroid`
- `src/world/waterSources.ts` — multi-well + use shared helper
- `src/world/cactus.ts` — tuning constants
- `src/world/deadTree.ts` — tuning constants
- `src/world/heroLandmarks.ts` — tuning constants
- `src/persistence/save.ts` — SAVE_VERSION bump, accept v1/v2/v3
- `src/main.ts` — possibly drop the `count` arg on `spawnDeadTrees` if
  the param is removed (or leave it; harmless)

## Acceptance criteria

- `npx tsc --noEmit` clean.
- Player at spawn typically sees 1-2 biome regions, not 5+.
- Salt biome reads as a recognisable broad region (not a 50m islet).
- ~10 cacti visible across the salt flats (was 3); none cluster within
  the inner 12m around spawn.
- ~30 dead trees scattered through the world.
- 3 wells placed across separate salt regions (each ≥400m from the
  others).
- 15-20 hero landmarks distributed around the spawn ring out to ~1050m.
- Sandworm biome check at boot still passes (home pos (60, 0) — should
  still resolve to dune since the noise function is the same, only the
  frequency changed).
- An old v2 save loads cleanly and applies harvested/salvage state by
  id (states preserved, but applied to scatter at NEW positions —
  expected).
- Boot a fresh game, save, reload — round-trip preserves all state.

## Verification

1. `npx tsc --noEmit`.
2. `npm run dev`, browser preview, fresh game.
3. From spawn, drive the speeder in a straight line for 1km — count
   biome transitions (should be 1-2, not 5+).
4. Eval `ctx.cacti.list.length` → expect ~10.
5. Eval `ctx.waterSources.list.length` → expect 3; check positions are
   pairwise >400m apart.
6. Save the game, reload, verify scatter counts + saved state restore.
7. Test old-save load: keep a v2 save from FF (if available) and
   confirm load succeeds; otherwise test by manually editing the
   save's `version` field in localStorage.

## Out of scope (deferred to session #3)

- Procgen POI placement — 6 hand-coded POIs stay where they are.
- AI density / biome-awareness changes — 4 lizards still hard-coded
  near origin, sand worm singleton unchanged.
- Distance-based difficulty.
- Adding new biome types.
- Streaming chunks.

## Critical files referenced

- `src/world/biomes.ts:22-36` — `createBiomeSampler` + `BiomeId`
- `src/world/waterSources.ts:151-166` — `findSaltCentroid` (to generalise)
- `src/world/cactus.ts:142-203` — `spawnCacti` rejection-sample loop
- `src/world/deadTree.ts:86-132` — `spawnDeadTrees` rejection-sample loop
- `src/world/heroLandmarks.ts:96-121` — `placeHeroLandmarks`
- `src/persistence/save.ts:37-43` — `SAVE_VERSION` + `SaveV1.version`
- `src/persistence/save.ts:245-250` — version-check branch
- `src/config/tuning.ts:169-176` — biome constants block
- `src/main.ts:96-98` — scatter call sites (`spawnDeadTrees`,
  `spawnWaterSources`, `spawnCacti`)
