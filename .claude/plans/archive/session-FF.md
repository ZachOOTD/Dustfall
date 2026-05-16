# World rework #1 — chunked terrain + bigger map

## Context

The roadmap's "world rework" item is split into three sub-sessions
(scoping pass plan at
`.claude/plans/archive/session-pick-from-soft-lobster.md` once
archived). This is **session 1 of 3**. The goal is to grow the playable
world from 800m × 800m to 2400m × 2400m without dropping framerate or
breaking saves. Biomes, POIs, AI spawns, and scatter all stay
unchanged — sessions 2 and 3 will retune them once the bigger world
exists. After this session ships, the player can drive the speeder to
the far edges of a much larger desert, but it will look biome-quilted
and POI-empty out there. That's by design — fixed in session 2 + 3.

## Approach

Replace the single 192-cell 800m heightfield with a **3×3 grid of 800m
heightfield chunks** (each reusing the existing 192-cell pattern, so
per-chunk grid resolution stays at ~4.17m per cell — identical to
today). Each chunk gets its own Rapier heightfield collider + Three.js
mesh, all sharing one `createNoise2D` instance so vertex heights at
chunk boundaries are bit-identical across neighbors (zero-visible
seams). Beyond the 3×3 chunk band (radius ~1200m), a coarse far-LOD
visual ring (no physics, 40m cells) extends out to ~2000m so the
horizon feels continuous instead of dropping off a cliff.

`heightAt(x, z)` becomes a thin chunk-router: pick the chunk index
from `floor((coord + 1200) / 800)`, then do the existing bilinear
interpolation inside that chunk. Outside [-1200, 1200], return 0
(same fallback as today, just at a bigger radius).

## Files to touch

- **`src/world/terrain.ts`** — main rewrite.
  - `Terrain` interface: replace `mesh: THREE.Mesh` with `meshes:
    THREE.Mesh[]`; replace single collider with `colliders:
    RAPIER.ColliderHandle[]`. Keep `heightAt(x,z): number` and any
    existing public helpers (`terrainVarAt`, `terrainFlatnessAt`)
    routing to the appropriate chunk.
  - `createTerrain(rand)`: build a single shared `noise = createNoise2D(rand)`
    instance, then loop `for (let gx = 0; gx < 3; gx++) for (let gz =
    0; gz < 3; gz++)` building each chunk's heightfield + mesh at
    world-space offset `((gx - 1) * 800, (gz - 1) * 800)`. Each
    chunk samples `sampleHeight(noise, worldX, worldZ)` — never
    chunk-local coords — so adjacent chunks produce identical edge
    heights.
  - Verify the per-vertex `blendedBiomeColor` walk still works per
    chunk; biome noise frequency is unchanged this session.
- **`src/main.ts`** — update the terrain shadow-flag walk at lines
  ~167-176 to iterate `terrain.meshes` and call `scene.add` on each
  mesh. Any other place referencing `terrain.mesh` directly
  (search for it) gets the same treatment.
- **`src/config/tuning.ts`** — new and updated constants:
  ```
  // new
  WORLD_SIZE: 2400,
  TERRAIN_CHUNK_SIZE: 800,
  TERRAIN_CHUNK_GRID: 3,
  TERRAIN_CHUNK_CELLS: 192,
  TERRAIN_LOD_INNER_RADIUS: 600,
  TERRAIN_LOD_OUTER_RADIUS: 2000,
  TERRAIN_LOD_CELLS: 80,
  // changed
  FAR_PLANE: 600 → 1800,
  WORLD_RADIUS: 280 → 900,
  FOG_DENSITY_CLEAR: 0.0035 → 0.0018,
  SHADOW_CULL_DISTANCE: 80 → 120,
  ```
- **`src/world/sky.ts`** — if `SKY_SPHERE_RADIUS` sits below ~1400 in
  the shader/geometry setup, bump to ~2200 so the dome encloses the
  new FAR_PLANE.
- **`src/persistence/save.ts`** — bump `SAVE_VERSION` to 2. Loader
  accepts both v1 and v2 (no schema changes; the version bump is a
  marker so future tools can identify pre-bigger-world saves).
- **NEW `src/world/terrainLod.ts`** — exports `createTerrainLod(noise,
  innerRadius, outerRadius, cells)` building a single large
  `THREE.PlaneGeometry` ring (or annulus mesh) with vertices sampling
  the same `sampleHeight(noise, x, z)` at a coarse stride. No
  collider. `frustumCulled = true`. Materials match the dune palette
  (no biome tinting in the LOD ring — it's distant enough that
  uniform sand color reads fine).

## Seam-invisibility note

All chunks MUST share one `createNoise2D` instance, AND each chunk
MUST sample world-space `(x, z)` (not chunk-local coords). With those
two invariants, vertex N on the east edge of chunk (0,0) and vertex 0
on the west edge of chunk (1,0) sample identical world coords and
produce identical heights — no seam visible regardless of camera
angle. The LOD ring uses the same `noise` instance, so the LOD ring's
inner edge also matches the chunk band's outer edge.

## What stays unchanged

- All 6 hand-coded POI coords (`POI_LAYOUT` in `src/world/poi.ts`) —
  all inside the central chunk.
- 4 hard-coded lizard spawn positions in `main.ts` (all within ~36m
  of origin).
- `SANDWORM_HOME_POS = (60, 0)` and the boot-time biome verification.
- `BIOME_NOISE_FREQ = 1/220` (biome regions stay small — session 2's
  job).
- Cactus / dead tree / well / landmark counts and rejection-sampling
  bounds (session 2's job).
- All hero landmarks (`placeHeroLandmarks`).
- `RNG_SEED = 1337` and the three RNG streams (terrainRand 1337,
  scatterRand 1338, biomeRand 1354).

## Acceptance criteria

- `npx tsc --noEmit` clean.
- `npm run dev` boots without console errors.
- Player can mount the speeder at spawn, drive to (2000, 0), and the
  terrain underfoot reads correctly (no falling into a void, no
  invisible wall). Same for (-2000, 0), (0, 2000), (0, -2000).
- Inspect height at a chunk boundary: from the F1 perf HUD or a quick
  `__game.terrain.heightAt(400, 0)` console eval, confirm the value
  is identical when sampled from "the (0,0) chunk's east edge" and
  "the (1,0) chunk's west edge" (they're both at world x=400; just
  sample once).
- Visually inspect the seam line at x=400, z=0 with the speeder —
  no visible crease, color discontinuity, or normal break.
- Existing v1 save loads, player spawns at saved coords, all 6 POIs +
  sandworm + 4 lizards present and behaving correctly.
- Frame time at origin within ~10% of pre-session baseline (eyeball
  with F1 perf HUD).
- Far-LOD ring visible past ~1200m, fading smoothly into the chunk
  band, no z-fighting.
- Sky sphere still encloses the camera at the new FAR_PLANE (no
  visible edge-of-sky artifact at high elevation).

## Verification

1. `npx tsc --noEmit` — must be clean.
2. `npm run dev` — boot, eyeball seams at (400, 0) and (-400, 0)
   walking on foot first (slower view).
3. Mount speeder, drive a cross pattern: origin → (2000, 0) → origin →
   (0, 2000) → origin → (-2000, 0) → origin → (0, -2000). Confirm no
   void / invisible wall / terrain pop.
4. Sample `__game.terrain.heightAt(400, 0.0001)` and
   `__game.terrain.heightAt(399.9999, 0)` in the console (or whatever
   the global handle is named) — should be effectively equal.
5. Reload an old v1 save (or generate one before starting this
   session) — confirm player spawn coords + 6 POI presence.
6. F1 perf HUD: compare frame-time + draw-call count to a pre-session
   baseline screenshot.

## Out of scope (deferred)

- Biome wavelength changes — session 2.
- Cactus / tree / well / landmark count rescaling — session 2.
- New POI placements — session 3.
- AI density / biome-awareness changes — session 3.
- **Streaming chunks** (load/unload by player position) — 3×3 stays
  fully resident this session. Streaming is a future session if perf
  data demands it.
- Vertical chunking / overhangs — heightfield only.
- LOD detail beyond the single coarse outer ring (no nested LOD
  levels yet).
- Larger biome / scatter bounds in `cactus.ts`, `deadTree.ts`,
  `waterSources.ts` — they keep their current bounds; new outer
  chunks will look bare. Fixed in session 2.

## Critical files (verified from scoping exploration)

- `C:\Users\Zach\projects\dustfall\src\world\terrain.ts` — current
  single-heightfield implementation. Lines 12-13: `SIZE = 800; CELLS
  = 192`. Lines 173-192: `heightAt`. Lines 226-270: `sampleHeight`.
- `C:\Users\Zach\projects\dustfall\src\main.ts` — terrain shadow-flag
  walk at lines 167-176 references `terrain.mesh` directly.
- `C:\Users\Zach\projects\dustfall\src\config\tuning.ts` — line 218:
  `FAR_PLANE: 600`. Line 219: `RNG_SEED: 1337`. Constants section
  for fog/world-radius/shadow lives in the same file; grep for the
  names.
- `C:\Users\Zach\projects\dustfall\src\persistence\save.ts` — line
  ~44: `SAVE_VERSION` constant.
- `C:\Users\Zach\projects\dustfall\src\world\sky.ts` — sky sphere
  radius lives here.
