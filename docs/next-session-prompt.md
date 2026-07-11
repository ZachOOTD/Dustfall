# Cycle 5 — Kickoff brief: S6 perf — frame-budgeted generation (campaign "Infinite Sands")

**⚙ A CAMPAIGN IS ACTIVE** — "Infinite Sands", branch `campaign/2026-07-10-procgen`.
Boot `/campaign-cycle` from `docs/campaign/campaign-state.json` + `campaign.md`.
After S6 ships, the ONLY remaining rung is ⏸ S5 (save schema — the sanctioned pause).

## Read these now
1. `CLAUDE.md` (auto-loaded) — "Last shipped" = cycles 1-4.
2. `docs/campaign/campaign.md` — charter; scope-cut order ("S6 LOD depth" is cuttable; hitch-free
   generation is NOT).
3. `docs/decisions.md` D288 (the tile-bake hitch is explicitly S6's rung), D290/D292/D294/D295.
4. `src/world/terrain.ts` — `buildTile` (the ~100-200ms bake: 37k heights + colors + normals +
   Rapier heightfield) + `recenter`'s 1-per-call budget.
5. `src/world/chunkManager.ts` — `loadChunk` (POI assembly ~5-15ms, landmark chunks heavier) +
   `CHUNK_LOADS_PER_FRAME`.
6. `scripts/rig-shot.mjs` — the existing `perf`-related scenarios (grep 'perf') + chunk-streaming.

## What's already built (S1-S4)
The infinite world is functionally COMPLETE pending perf + save: streamed terrain, wrecks (with
salvage), rocks, scenes, prey, hero landmarks, regional wreck-yard biomes — all descriptor-pure,
leak-gated, save-transient (D292), origin byte-identical.

## Cycle 5 focus — S6: hitch-free generation + perf ceilings
DoD: walking across tile/chunk boundaries produces NO frame hitch a player would feel (target:
no tick > ~25ms attributable to generation at 60fps-equivalent pacing), and the active set's
draw calls + Rapier bodies hold steady ceilings during an arbitrary-length walk — asserted by a
NEW permanent cross-chunk perf probe.

## Priority sub-tasks (in order)
1. **Measure first.** Instrument (temporarily or via the perf HUD path) the actual per-frame cost
   of: a terrain tile bake, a POI chunk load, a landmark chunk load, on THIS machine headless +
   estimate real-play (headless swiftshader ≠ GPU play — measure the CPU-side generation only;
   it's the hitch source). Log numbers in the cycle log BEFORE optimizing.
2. **Slice the terrain-tile bake across frames.** The bake is ~37k `computeHeightAt` samples +
   a color pass + `computeVertexNormals` + a Rapier heightfield. Options (pick by measurement):
   (a) row-banded incremental fill — build the heights/colors arrays over N frames (e.g. 24-32
   rows/frame), then geometry+collider on the final frame; (b) a Web Worker for the height/color
   arrays (postMessage the Float32Arrays back, transferable) with main-thread geometry+collider;
   (c) precompute-ahead: start baking the NEXT ring tile as soon as the anchor is 1 margin-width
   from a boundary (hides latency without slicing). (a) is simplest and deterministic; (b) is the
   real fix if (a)'s final-frame geometry step still hitches; (c) composes with either.
   CONSTRAINT: the player-tile-immediate rule (D288) stays — a save-load teleport must never
   fall through; slicing applies only to NON-anchor tiles.
3. **Budget the POI/landmark loads.** `CHUNK_LOADS_PER_FRAME` already bounds count; if a single
   landmark/knot load blows the frame, split its render across 2-3 frames (descriptor → stage
   list) or lower the per-frame budget when a heavy chunk is queued.
4. **Ceilings + the NEW permanent perf probe.** Extend the chunk-streaming walk (or a sibling
   `chunk-perf` scenario): during a multi-km walk sample per-frame generation time (expose a
   `__game.chunkPerf()` accumulator), renderer.info draw calls, and world.bodies.len(); assert
   (i) no generation frame > threshold, (ii) draw calls + bodies bounded (max-over-walk within a
   ceiling), (iii) counts return to baseline at home. Wire into `verify:chunks` (or a
   `verify:perf` sibling — keep wrapper timeouts per D293: 900s+).
5. **Visual sanity** — a vista shot mid-crossing proving no half-built tile is ever visible
   (slicing must not show a partial mesh: build off-scene, add atomically).
6. **Stretch (scope-cuttable per charter: "S6 LOD depth")** — a cheap far-tile LOD ring or
   horizon skirt. Do NOT reach for this before 1-4 are green.

## Constraints (locked)
Determinism law (sliced/worker bakes must produce byte-identical heights — same computeHeightAt,
same order-independence; the determinism + placement gates are the tripwire); rule 9 (atomic
collider+mesh add — never a collider before its mesh or vice versa); intro + origin byte-identical;
NO save changes (S5 next); keep banked perf; master untouched.

## Footguns
- `computeVertexNormals` on 37k verts is itself ~10-20ms — slicing heights but not normals still
  hitches; measure per-stage.
- A Rapier heightfield create is main-thread-only (WASM) — if it's the dominant cost, (b) worker
  won't help it; consider building the collider one frame after the mesh (ground exists visually
  first; the player is ≥400m away from a non-anchor tile by construction).
- Probe discipline: D291 (320×240, cell centers, clear rays), D293 (wrapper timeouts), D294
  (quiet ambient predators before count baselines; `resetWormCrossing` before vistas).
- The process-leak reaper (SessionStart/End hooks) is now global — leaked probe processes are
  swept automatically; `npm run reap` for immediate manual relief.

## Stop conditions
Charter caps; 3-strike walls → scope-cut order (LOD depth first — NEVER hitch-free generation);
`stuck`; steering `pause`.

## On stop
`/session-end` (campaign auto-commit) + campaign bookkeeping + verdict. If S6 ships, the verdict
still CONTINUEs — the next cycle opens **⏸ S5** which pauses BEFORE building (write the save
schema plan, set awaiting_approval, stop for the human review — D81).

## Begin
Read the files above → write `.gamedev-framework/campaign-cycle.inprogress` → measure → build →
gates (incl. the new perf probe) → vista → `/session-end` → log + verdict.
