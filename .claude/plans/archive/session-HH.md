# Session HH — World rework #3: procgen POIs + biome-aware AI spawns
# (with LOD-ring fix folded in)

## Context

Sessions FF + GG shipped the chunked terrain (2400m world) and the biome
rescale + scatter retune. HH was originally scoped as procgen POIs +
biome-aware lizard spawns — that work is already in the working tree
(see "Already in working tree" below). During verification the user
spotted a bug from FF: a second terrain surface (the LOD ring) floats
above the chunks in dune valleys, and since it has no collider, the
player passes through it. This plan folds the LOD-ring removal into the
HH commit before shipping.

## Diagnosis

The FF LOD ring (`src/world/terrainLod.ts`) is a coarse 80-cell square
plane spanning [-2000, +2000] sampled from the same noise as the chunks.
D52 logged the design call: slot the LOD 0.15m beneath the chunks via
`mesh.position.y = -0.15` so the chunks always win the z-buffer fight
inside the chunk band [-1200, +1200].

That bias works only if the LOD's vertices interpolate close to the
chunks' actual surface. They don't:

- Chunks: 4.17m vertex spacing (fine dune detail, primary wavelength 170m)
- LOD:    50m vertex spacing (linear between samples)

When two adjacent LOD samples land on dune crests (15m height) and the
chunks dip into a valley between them, the LOD's straight line stays at
~14m while the chunk surface dips to ~0m. The LOD ends up **10+ meters
above** the chunks in those valleys. The 0.15m downward bias does
nothing against that overshoot.

Result: visible "second terrain" floating in valleys + no collider →
player phases through it.

## Approach

**Delete the LOD ring entirely.** Chunks become the single source of
terrain truth. Inside the chunk band → chunks (with collision). Outside
the chunk band → nothing visible (fog density 0.0018 at the band edge
1200m is ~99% opaque per `exp(-(0.0018·1200)²)` ≈ 0.009, so the band
edge IS the visible horizon anyway).

Alternative considered: donut-carve the LOD to only emit triangles
outside the chunk band. Rejected — the LOD's only purpose was to extend
the visible horizon past 1200m, but fog at that distance makes it
invisible from typical play positions. Carrying the LOD's code path
for a contribution fog erases isn't worth it.

## Files

### Delete
- `src/world/terrainLod.ts` — remove the file entirely.

### Edit
- `src/main.ts` —
  - Remove `import { createTerrainLod } from './world/terrainLod.ts';`
  - Remove the `createTerrainLod(three.scene, terrain.noise, biomes);`
    call.
- `src/config/tuning.ts` —
  - Remove `TERRAIN_LOD_OUTER_RADIUS: 2000,` and
    `TERRAIN_LOD_CELLS: 80,` lines. The comment block above them stays
    informative if shortened.

### Keep
- `terrain.noise` export on `Terrain` interface — useful for future
  procgen sampling needs even without the LOD.
- `sampleHeight` + `biomeHeightScale` re-exports from `terrain.ts` —
  same reason.
- FF tuning bumps (`FAR_PLANE: 1800`, `WORLD_RADIUS: 900`,
  `FOG_DENSITY_CLEAR: 0.0018`, `SHADOW_CULL_DISTANCE: 120`) — they're
  for the bigger world, not specific to the LOD.

## Already in working tree (HH proper)

Procgen POIs + biome-aware AI spawns — implementation already complete:

- `src/config/tuning.ts` — `POI_PROCGEN_COUNT: 15`,
  `POI_MIN_SEPARATION: 250`, `POI_SCATTER_RADIUS_MIN/MAX: 120/1100`,
  `LIZARD_TARGET_COUNT: 28`, `LIZARD_SPAWN_BUFFER_FROM_ORIGIN: 25`, etc.
- `src/world/procgenPoi.ts` — NEW; rejection-sample placement with
  min-separation against anchors + already-registered salvageables.
- `src/world/poi.ts` — exported `getAnchorPOIPositions()`.
- `src/enemies/lizard.ts` — added `spawnLizardsProcgen` (cluster pass
  near POIs + global pass with salt rejection + spawn buffer).
- `src/main.ts` — wired procgen POIs, replaced 4 hardcoded lizards with
  `spawnLizardsProcgen`. Passes all already-registered salvageable
  positions (hero landmarks too) to procgen rejection so procgen POIs
  don't land on hero landmarks.
- `src/persistence/save.ts` — `SAVE_VERSION 3 → 4`, accepts v1/v2/v3/v4.

Verified numerically (lizards 28 / 0-in-salt / min radius 74m,
salvageables 48 with procgen-vs-anchor min separation 265m).

## Verification

1. `npx tsc --noEmit` clean after the LOD removal.
2. Reload the browser preview, walk on foot near origin in a dune
   valley — confirm no second terrain surface floating overhead, no
   pop-through.
3. Drive the speeder toward (1100, 0). Visible horizon should fade
   smoothly to fog at the chunk band edge with no second-terrain
   discontinuity past the edge.
4. Eval `ctx.three.scene.children.filter(c => c.isMesh && c.geometry
   && c.geometry.attributes.position).length` near origin to confirm
   no LOD mesh remains. Or simpler: confirm exactly 9 terrain chunk
   meshes via `ctx.terrain.meshes.length`.
5. The HH-proper checks remain valid: lizard count 28, 0 in salt,
   48 salvageables, procgen min separation ≥250m.

## Critical files referenced

- `C:\Users\Zach\projects\dustfall\src\world\terrainLod.ts` (to delete)
- `C:\Users\Zach\projects\dustfall\src\main.ts` (import + call site)
- `C:\Users\Zach\projects\dustfall\src\config\tuning.ts` (LOD constants
  to remove)
- `C:\Users\Zach\projects\dustfall\docs\decisions.md:D52` — the
  superseded LOD-bias decision (will need a D-numbered correction
  entry at session-end noting D52's revision).

## Out of scope

- Re-introducing an extended horizon via donut LOD — defer until/unless
  the chunk-band-edge fog feels visibly insufficient.
- Streaming chunks — still a future-session call.
