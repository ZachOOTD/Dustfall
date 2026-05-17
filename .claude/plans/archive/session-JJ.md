# Session JJ — Quick polish + UI bugfixes

## Context

After II's cooking session the user spotted small papercuts that hurt
playtest readability. Knocking them out before tackling another
big-ticket feature. Five items, all isolated, ~3-4h total.

## Approach

### 1. Toast Y position (bug)

**File**: `src/ui/hud.ts:52` (inline style on `#toast`)

Current: `bottom: 32px`. Hotbar lives in `src/style.css:236-245` at
`bottom: 28px` with 52px-tall slots → hotbar occupies viewport-bottom
[28, 80]px. Toast at 32px renders INSIDE that band, visually
overlapping the hotbar slots (z-index 20 > 15 so it draws on top but
still reads as cluttered).

**Fix**: bump toast `bottom: 32px → 100px`. That clears the hotbar's
top edge (80px) with a ~20px buffer, lifting toast text into clean
empty space.

### 2. Shelter indicator Y position (bug)

**File**: `src/style.css:358-371` (rule for `#shelter-indicator`)

Current: `bottom: 100px; left: 32px`. Stat-bar group at
`bottom: 32px; left: 32px` extends up ~153px → bottom [32, 185]px.
Shelter indicator at 100px lands in the MIDDLE of the stat bar
column, overlapping THIRST / HUNGER / TEMPERATURE labels.

**Fix**: bump shelter indicator `bottom: 100px → 200px`. Clears the
stat group's top (~185px) with a 15px buffer.

### 3. Cluster dead trees in salt-flats (polish)

**File**: `src/world/deadTree.ts:86-132` (`spawnDeadTrees`)

Current: rejection sample uniformly across radius
`DEAD_TREE_SCATTER_RADIUS_MIN/MAX` = 20-1100m, accept if salt + flat.
Trees end up uniformly scattered with no visual grouping.

**Fix**: use the existing `findBiomeCentroid(biomes, 'salt', { excludeCenters })`
helper from `src/world/biomes.ts` (added GG, D54) to pick N grove
centroids, then rejection-sample tree positions within a small radius
of each centroid.

```ts
// Pseudocode:
const groveCount = Tuning.TREE_GROVE_COUNT;       // 2
const cluster   = Tuning.TREE_GROVE_CLUSTER_RADIUS;  // 35m
const minSep    = Tuning.TREE_GROVE_MIN_SEPARATION;  // 600m
const targetPerGrove = Math.ceil(count / groveCount); // 15 each

const centroids = [];
for (let i = 0; i < groveCount; i++) {
  const c = findBiomeCentroid(biomes, 'salt', { excludeCenters: centroids });
  if (!c) break;
  centroids.push({ ...c, radius: minSep });
  // then scatter targetPerGrove trees within `cluster` meters of c,
  // keeping the existing flatness + salt check + max-attempts pattern
}
```

### 4. Cluster alien cacti in salt-flats (polish)

**File**: `src/world/cactus.ts:142-203` (`spawnCacti`)

Same pattern as #3. Single patch (or two — keeping it dense). Tuning:
- `CACTUS_PATCH_COUNT: 1`
- `CACTUS_PATCH_CLUSTER_RADIUS: 25` (10 cacti in 25m feels like a
  proper garden without crowding)

If `CACTUS_PATCH_COUNT > 1` later, reuse the `excludeCenters` trick
with a `CACTUS_PATCH_MIN_SEPARATION` (default to `WELL_MIN_SEPARATION`).

### 5. Remove antenna tower hero-landmark variant (debt)

**Files**:
- `src/world/heroLandmarks.ts:86-93` — drop `'antenna_spire'` from
  `HERO_WRECK_TYPES`.
- `src/world/procgenPoi.ts:27-33` — drop `'antenna_spire'` from
  `PROCGEN_WRECK_KINDS` for consistency (otherwise procgen POIs still
  spawn antenna spires across the world).

**Keep**: the anchor POI `antenna_outpost` at (-88, -50). It's the
single hand-placed antenna in `src/world/poi.ts:217`; one is fine, the
many random spires are what looked redundant.

The `makeAntennaSpire` geometry helper + 'antenna_spire' WreckKind
union member stay — they're still used by the anchor POI.

## Files to modify

- `src/ui/hud.ts` — toast bottom
- `src/style.css` — shelter indicator bottom
- `src/world/deadTree.ts` — grove clustering
- `src/world/cactus.ts` — patch clustering
- `src/world/heroLandmarks.ts` — remove antenna_spire from rotation
- `src/world/procgenPoi.ts` — remove antenna_spire from procgen kinds
- `src/config/tuning.ts` — new constants:
  - `TREE_GROVE_COUNT: 2`
  - `TREE_GROVE_CLUSTER_RADIUS: 35`
  - `TREE_GROVE_MIN_SEPARATION: 600`
  - `CACTUS_PATCH_COUNT: 1`
  - `CACTUS_PATCH_CLUSTER_RADIUS: 25`

## Acceptance criteria

- `npx tsc --noEmit` clean.
- Cook something (debug starter loadout has all the ingredients) and
  confirm the toast "you cook the …" appears clearly ABOVE the
  hotbar with no overlap.
- Stand in shelter (light a fire from the starter fire_kit) and
  confirm the "SHELTER" indicator appears clearly above the stat-bar
  column with no overlap.
- Boot a fresh game: dead trees visibly clustered in 2 distinct
  groves rather than scattered uniformly. Each grove ~35m radius with
  ~15 trees.
- Cacti visibly clustered in 1 patch (or 2 if `CACTUS_PATCH_COUNT > 1`).
- No antenna spires spawn as hero landmarks or procgen POIs — only
  the single hand-placed `antenna_outpost` remains.

## Verification

1. `npx tsc --noEmit`.
2. `npm run dev`, fresh game.
3. Trigger a toast: select cactus pulp, deploy fire, look at fire, E
   to cook. Watch the "cooking..." → "you cook the roasted pulp"
   sequence — both must clear the hotbar.
4. Stand next to the fire (within `SHELTER_RADIUS = 2.2m`) — the
   SHELTER indicator should fade in above the stat bars, not overlap.
5. Eval `ctx.three.scene` for dead-tree positions, group by
   pairwise-distance to confirm 2 clusters.
6. Eval `ctx.cacti.list` positions to confirm patch clustering.
7. Eval salvageables list, filter `s.kind === 'antenna_spire'`,
   expect exactly 1 (the anchor antenna_outpost).

## Out of scope

- New biomes, new cookable foods, full procgen rework, fire rework.
- Visual rework of antenna_spire geometry (separate backlog item).
- Toast or shelter-indicator restyling beyond the position fix.

## Critical files referenced

- `src/ui/hud.ts:50-58` — toast inline style
- `src/style.css:236-245` — hotbar position (don't touch — reference)
- `src/style.css:358-371` — shelter indicator position
- `src/style.css:39-85` — stat bars (don't touch — reference)
- `src/world/biomes.ts` — `findBiomeCentroid` (GG addition)
- `src/world/deadTree.ts:86-132` — spawnDeadTrees
- `src/world/cactus.ts:142-203` — spawnCacti
- `src/world/heroLandmarks.ts:86-93` — HERO_WRECK_TYPES
- `src/world/procgenPoi.ts:27-33` — PROCGEN_WRECK_KINDS
- `src/config/tuning.ts` — new constants land here
