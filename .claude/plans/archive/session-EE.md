# Session — World rework: scoping pass

## Context

The "World + biome rework — larger map, vaster biomes, spaced-out POIs,
procgen terrain/biomes/POI/AI spawns" entry on the roadmap is estimated
at 10-15h, which doesn't fit Dustfall's 4-7h-per-session cadence. The
user picked this as the next session with the steer "foundational work
and mechanics first" — meaning the deliverable here is the *breakdown
itself*, not implementation. Output of this session: a three-sub-session
plan committed to the roadmap, plus the first sub-session's plan file
fully written and ready to execute on the following session.

Current world state (verified from exploration):
- 800m × 800m fixed square, single 192×192 heightfield collider + mesh.
- 3 biomes (dune/rocky/salt) assigned by noise at 220m wavelength —
  biomes "speckle" rather than form vast regions.
- 6 hand-authored POIs all within ~200m of origin; 1 well, 12 dead
  trees, 3 alien cacti procgen-scattered.
- 4 lizards hard-coded near origin; raiders disabled (D13); sandworm
  singleton at (60, 0).
- `RNG_SEED = 1337` makes world layout fully deterministic. Saves
  persist entity *state* (looted, harvested, salvage-remaining) keyed
  by ordinal id, not entity *layout*.

## The three sub-sessions (committed split)

**Session 1 — Chunked terrain + bigger map (5-6h).**
World grows 800m → 2400m via 3×3 grid of 800m heightfield chunks
(reusing the existing 192-cell-per-chunk heightfield + collider
pattern). Adds a coarse far-LOD ring (40m cells, no physics) for the
outer visible band. Bumps `FAR_PLANE` (600 → 1800), `WORLD_RADIUS`
(280 → 900), tightens `FOG_DENSITY_CLEAR` (0.0035 → 0.0018). Biome
wavelength, POI placements, AI spawns all unchanged this session — the
existing world content stays inside the central chunk and continues to
work. Acceptance: player can drive to (2000, 0) without hitting a void,
seams between chunks visually invisible, old saves load with player at
saved coords. Save version bumps to 2 (no migration needed).

**Session 2 — Biome rescale + procgen scatter retune (4-5h).**
`BIOME_NOISE_FREQ` shifts from 1/220 to 1/900 — biome regions become
vast (2-3 per axis instead of dozens). Cactus / dead tree / well /
landmark counts and bounds rescale to the 2400m world. New helper
`findBiomeCentroid()` generalizes the existing `findSaltCentroid`. Well
count 1 → 3 (one per major salt region). Save-compat: scatter state
persists by ordinal-id, so harvested cacti / looted positions are
preserved up to `min(savedCount, newCount)`. Save version bumps to 3.

**Session 3 — Procgen POIs + biome-aware AI spawns (4-6h).**
6 anchor POIs (engine_block, camp, antenna_outpost, crashed_hull,
mega_ship, mega_wreck) stay at their hand-authored coords. New
`procgenPoi.ts` adds ~15 procgen POIs across the world via Poisson-disk
sampling (`POI_MIN_SEPARATION = 250m`), each rolling a kind from a
biome-weighted table over the existing wreck vocabulary (engine_bell,
fuselage, escape_pod, antenna_spire, engine_cluster) — no new art.
Lizards become biome-aware (salt excluded) and density-based by
distance from origin; target ~28 lizards, clustered 1-2 per POI plus
sparse global density. Save version bumps to 4 with an explicit
migration helper for the 4 hand-placed lizards → first 4 procgen-ordered
lizards. Highest save-compat risk of the three sessions, contained by
deterministic Poisson-disk ordering.

**Sequencing rationale.** Bigger biomes (session 2) only make sense
inside a bigger world (session 1) — at 800m, a 900m biome wavelength
gives one biome on the whole map. Procgen POI placement (session 3)
only makes sense once biomes are stable + the world has room — Poisson-
disk in an 800m world with 250m separation gives ~6 POIs (already
hand-authored). Order also matches risk descending: session 1 is the
highest-risk Rapier / LOD / seam-invisibility work and benefits from
going first while the rest of the codebase is untouched.

The full per-session detail (files to touch, tuning constants,
acceptance criteria, save-compat notes, OUT-of-scope items) lives in
the docs/roadmap.md entries this session writes, and in the
`.claude/plans/world-rework-1-chunked-terrain.md` file ready for the
next session.

## This session's concrete deliverables

### 1. Update `C:\Users\Zach\projects\dustfall\docs\roadmap.md`

Replace the two existing bullet lines in the Big-ticket bucket:
```
- World + biome rework: larger map, vaster biomes, procgen terrain/biomes/POI/AI spawns
- Wreck POI rework: ...
```
with three new ordered entries inserted just above the wreck POI
rework line:
```
- World rework #1 — chunked terrain + bigger map (5-6h): 800m → 2400m via
  3×3 heightfield chunks + far-LOD ring. See `.claude/plans/world-rework-
  1-chunked-terrain.md` for the full plan.
- World rework #2 — biome rescale + scatter retune (4-5h): BIOME_NOISE_FREQ
  1/220 → 1/900, cactus/tree/well counts rescaled, `findBiomeCentroid()`
  helper.
- World rework #3 — procgen POIs + biome-aware AI spawns (4-6h): 6 anchor
  POIs + ~15 Poisson-disk procgen POIs (250m min separation); ~28 lizards,
  salt-excluded, density-by-distance.
```

### 2. Write `C:\Users\Zach\.claude\plans\world-rework-1-chunked-terrain.md`

Full session-1 plan ready to execute. Contents:

- **Context**: one paragraph on why session 1 is the foundation for the
  3-session rework (links to this scoping plan).
- **Files to touch** (verified from exploration):
  - `src/world/terrain.ts` — rewrite `createTerrain` to build a 3×3
    `terrain.meshes: THREE.Mesh[]` + `terrain.colliders: ColliderHandle[]`.
    `heightAt(x,z)` becomes a chunk-router. Bounds query returns `0`
    outside [-1200, 1200].
  - `src/main.ts` — terrain shadow-flag walk at lines 167-176 iterates
    `terrain.meshes` instead of `terrain.mesh`.
  - `src/config/tuning.ts` — new constants: `WORLD_SIZE: 2400`,
    `TERRAIN_CHUNK_SIZE: 800`, `TERRAIN_CHUNK_GRID: 3`,
    `TERRAIN_CHUNK_CELLS: 192`, `TERRAIN_LOD_INNER_RADIUS: 600`,
    `TERRAIN_LOD_OUTER_RADIUS: 2000`, `TERRAIN_LOD_CELLS: 80`. Update:
    `FAR_PLANE: 600 → 1800`, `WORLD_RADIUS: 280 → 900`,
    `FOG_DENSITY_CLEAR: 0.0035 → 0.0018`, `SHADOW_CULL_DISTANCE: 80 → 120`.
  - `src/world/sky.ts` — bump `SKY_SPHERE_RADIUS` if it sits below 1400.
  - `src/persistence/save.ts` — bump `SAVE_VERSION` to 2 (loader accepts
    both v1 and v2; no migration needed).
  - New file `src/world/terrainLod.ts` — owns the far-LOD ring.
- **Seam-invisibility note**: all chunks must share one `createNoise2D`
  instance and sample the SAME world-space `(x,z)` at chunk boundaries —
  edge vertices in adjacent chunks must produce identical heights.
  Single shared noise instance + world-space sampling makes this
  automatic.
- **What stays unchanged**: hand-coded POI coords (all inside central
  chunk), lizard spawn positions, sandworm home (60, 0), biome
  wavelength (still 1/220), scatter counts.
- **Acceptance criteria**:
  - `npx tsc --noEmit` clean.
  - Browser preview: player sprints from origin to (2000, 0) without
    hitting a void or invisible wall.
  - Visible chunk seams = none (sample heights at chunk-boundary
    coords and confirm identical across chunks).
  - Existing v1 save loads, player spawns at saved coords, all 6 POIs
    + sandworm + 4 lizards present.
  - Frame time at origin within 10% of pre-session baseline.
- **Out of scope** (deferred to sessions 2 + 3): biome wavelength
  changes, new POIs, AI density changes, streaming chunks (3×3 stays
  fully resident).
- **Verification**: run `npm run dev`, eyeball seams at e.g. (400, 0)
  and (-400, 0), drive to (2000, 0), load an existing save.

### 3. Update `C:\Users\Zach\projects\dustfall\docs\changelog.md`

One entry for this session (scoping pass): 2-4 lines noting the
roadmap update + the session-1 plan file authored. No code shipped.

### 4. Update `C:\Users\Zach\projects\dustfall\CLAUDE.md` "Last shipped"

One line update — "Session XX (scoping): split world rework into 3
sub-sessions; session 1 plan ready." Keeps the manual current for the
next session start.

## Files to be modified this session

- `C:\Users\Zach\projects\dustfall\docs\roadmap.md` — replace world-
  rework line with 3 ordered entries
- `C:\Users\Zach\projects\dustfall\docs\changelog.md` — append scoping
  session entry
- `C:\Users\Zach\projects\dustfall\CLAUDE.md` — update "Last shipped"
- `C:\Users\Zach\.claude\plans\world-rework-1-chunked-terrain.md` —
  new file, full session-1 plan

No source files touched this session. No `tsc` or preview verification
needed (no code change). Verification = the plan file is readable, the
roadmap update is coherent, and a future session-start invocation
would surface session 1 as the next item.

## Verification at end of session

- Roadmap.md reads cleanly when scanned (the three new bullets are
  ordered + concise).
- `.claude/plans/world-rework-1-chunked-terrain.md` is self-contained
  enough that opening it cold tells you exactly which files to touch +
  what acceptance looks like.
- Changelog entry mentions the scoping pass + the next plan file path.
- Invoke `/session-end` skill at the end — it handles git commit/tag
  command printing as usual.

## Critical files referenced (no edits)

- `C:\Users\Zach\projects\dustfall\src\world\terrain.ts` — current
  heightfield + heightAt implementation that session 1 will refactor.
- `C:\Users\Zach\projects\dustfall\src\world\biomes.ts` — biome noise
  channel that session 2 will rescale.
- `C:\Users\Zach\projects\dustfall\src\world\poi.ts` — POI_LAYOUT table
  that session 3 will augment with procgen.
- `C:\Users\Zach\projects\dustfall\src\config\tuning.ts` — all new
  constants land here.
- `C:\Users\Zach\projects\dustfall\src\persistence\save.ts` — save
  version bumps + migration helpers across all three sessions.
- `C:\Users\Zach\projects\dustfall\src\main.ts` — boot sequence + per-
  frame tick order that all three sessions touch lightly.
