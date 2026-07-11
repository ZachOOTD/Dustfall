# Feature slice — Infinite procedural generation (chunk-streamed open world)

**Status:** planning / kickoff. Written 2026-07-09 as the entry point for a fresh session.
**Relationship to the campaign:** the "Sharpen & Deepen" campaign is PAUSED at M7 Skyfall plan-review — that plan is SAVED in `docs/feature-skyfall.md` (untouched) and `docs/campaign/` (state = paused). Infinite procgen is a separate, larger direction to tackle first; come back to Skyfall after (it slots naturally into the per-region landmark system, S4 below).

## Goal
Turn Dustfall's currently-FINITE world (a fixed set of content scattered around the origin at boot) into an **infinite, chunk-streamed** world the player can walk in any direction forever, generated deterministically from the world seed, with content loading ahead of the player and unloading behind.

## Definition of Done
1. The player can travel arbitrarily far in any direction and the world keeps generating — terrain, biomes, POIs, scatter, creatures — with no origin-bounded edge.
2. Generation is **deterministic**: a given `worldSeed` produces the same infinite world every time; re-entering a chunk regenerates it identically (unless the player modified it — see save).
3. **Streaming is clean**: chunks load within a radius of the player and unload beyond it, disposing meshes AND Rapier bodies AND registry entries (no leaks, no growth in draw calls / body count as you travel).
4. **No frame hitches** from generation (chunk work is budgeted across frames or off-thread).
5. The released **escape-pod intro + near-origin spawn** still work exactly as today (the origin region is the "start").
6. **Save works** for an infinite world (a sparse per-chunk diff over the deterministic base) — OR a scoped v1 is agreed (see S5 + open question 5). A `SAVE_VERSION` bump is likely and must be planned, not cut around (D81).

## Current architecture — what's finite vs already-infinite
All world-build runs ONCE at boot in `src/main.ts`, placing a bounded set around the origin:

| System | Where | Infinite-ready? |
|---|---|---|
| **Terrain heightfield** | `src/world/terrain.ts` `heightAt` (simplex-noise) | ✅ already infinite — queryable at any x,z |
| **Biomes** | `src/world/biomes.ts` `biomeAt` (noise) + distance-override biomes (wreck_yard 620-1000m) | ⚠️ noise part infinite; the distance-anchored biomes are origin-relative → need per-region anchoring |
| **POI scatter** | `main.ts:246` `placeProcgenPOIs` → `src/world/procgenPoi.ts` → `poiAssembler.placeProcgenPOI` | ❌ one-shot fixed count around the origin anchor |
| **Rock/decoration scatter** | `main.ts:207` `spawnRockScatter` | ❌ one-shot |
| **Wordless scenes** | `main.ts:210` `placeWordlessScenes` (dedicated RNG, ring around origin) | ❌ one-shot |
| **Hero landmarks (ring)** | `main.ts:194` `placeHeroLandmarks` + ribcage carcasses | ❌ fixed ring near origin |
| **Fixed heroes** | Leviathan `main.ts:232` (`-403,106`), mega-ship / mega-wreck | ❌ hardcoded positions |
| **Opening scene** | `main.ts:575` `setupOpeningScene` (player spawn + pod + the now-offset skeleton wreck) | ❌ fixed at origin (KEEP — it's the start) |
| **Creatures** | `main.ts:301/308/315` `spawnLizards/Shrews/VulturesProcgen` | ❓ verify — may already be player-relative; if origin-scattered, convert to an active ring around the player |
| **View horizon** | `FogExp2` desert density ~1.8e-3 (`sky.ts`) fogs out past ~0.5-0.7km | ✅ this is the natural streaming radius — set the chunk load radius to ~the fog cull distance |

**Determinism law already in place (D208/D226):** every procgen component uses `phash` (a rand-neutral hash) instead of touching the shared RNG; dedicated RNG streams are seeded independently; the salvage-panel rand budget is a pure function of (archetype, part-count). `npm run verify:placement` gates it. THIS is the foundation infinite procgen builds on — per-chunk seeding is a natural extension.

## Proposed sub-task breakdown (one focused chunk of work each; S5 may be its own slice)
- **S1 — Research + architecture spike.** `/research-topic chunk streaming three.js rapier open world`. Decide chunk size (candidate 96-128m so a handful of chunks cover the fog radius) + load/unload radius + hysteresis. Design the **ChunkManager**: a grid of active chunks around the player, each keyed by `(cx, cz)` with a deterministic seed `hash(worldSeed, cx, cz)`; loads on approach, unloads (dispose everything) beyond radius. Spike it with a trivial per-chunk marker (a numbered post at each chunk center) to prove load/unload/determinism before wiring real content.
- **S2 — Chunk-stream the POI scatter.** Refactor `placeProcgenPOIs` so a CHUNK places its POIs deterministically (reuse `placeProcgenPOI` + biome weights, seeded per-chunk). ChunkManager loads/unloads them. Must dispose the Rapier `poiBody`, the salvageables/journals registrations, and the merged static meshes on unload. Keep the collider-audit + static-merge pipeline per chunk. Origin chunk honors the player-spawn exclusion.
- **S3 — Chunk-stream scatter + ambient life.** `spawnRockScatter`, `placeWordlessScenes`, and the creature spawns → per-chunk or player-relative streaming. Creatures probably want an "active ring" model (spawn within N m of the player, despawn beyond) rather than per-chunk — verify how `spawn*Procgen` currently works first.
- **S4 — Landmarks + biomes for infinite.** Keep the origin region as the authored "start" (opening scene + a couple of anchored heroes). Distribute NEW landmarks per-region: a rare per-region roll for a hero wreck (Poisson-disk or a coarse landmark grid) so the infinite field has destinations, not homogeneity. Re-anchor the distance-override biomes (wreck_yard etc.) to a per-region biome-anchor scheme. **This is where Skyfall (the M7 enterable hero wreck) plugs in** — as a distributed rare landmark.
- **S5 — Save/persistence for infinite (likely its own feature-slice + a SAVE_VERSION bump).** Extend the current model — v16 rebuilds seed-derived content and serializes only DIFFS (pickup survivors, dropped items, salvage/panel state, crashes, journals) — into a **sparse per-chunk diff over the infinite deterministic base**: per chunk, record only what the player changed (taken pickups, stripped panels, dropped/placed items, killed creatures). A chunk with no diff regenerates pristine. Surface the `SAVE_VERSION` bump for approval (D81); do not cut around it.
- **S6 — Perf + LOD + hitch-free generation.** Budget chunk generation across frames (or a worker); a draw-call/body ceiling for the active set; lean on fog cull + the existing pickup instancing (D281) + `mergeStaticByMaterial`. Extend `perf-probe` to walk the player across chunks and assert steady draw calls / body count.

## Verify strategy
- Extend `verify:placement` / the determinism discipline to a **per-chunk determinism probe**: the same `(worldSeed, cx, cz)` → byte-identical placement across two generations.
- A **streaming probe** (new rig-shot scenario): teleport/walk the player across several chunk boundaries and assert chunks load + unload, Rapier body count returns to baseline (no leaks), and no duplicate POIs at seams.
- The existing collider-audit + smoke-intro/pod gates must stay green (the origin/intro experience is unchanged).

## Open design questions — ANSWERED (user, 2026-07-09; baked into docs/campaign/campaign.md)
1. Chunk size/load radius: ~112m, radius ≈ fog horizon (~3 chunks) — S1 may tune, log a D-entry.
2. Deterministic-infinite: YES.
3. Landmarks: DISTRIBUTED rares across the infinite field.
4. Intro stays the fixed start: YES.
5. Save v1: FULL per-chunk diffs (SAVE_VERSION bump — the S5 sanctioned pause).

### (original questions, for context)
1. **Chunk size + load radius** — tie to the fog cull distance. Proposal: ~112m chunks, load radius ~3 chunks.
2. **Deterministic-infinite vs endless-random** — strongly recommend deterministic (a seed → the same infinite world). It matches the codebase's determinism law and is what makes save tractable.
3. **Landmark distribution** — heroes near origin only, or rare heroes distributed across the infinite field (recommended: distributed, so travel has destinations)?
4. **Keep the escape-pod intro as the fixed start?** (Recommended yes — infinite world extends beyond the authored origin region.)
5. **Save scope for v1** — full per-chunk diff persistence (a SAVE_VERSION bump, more work), OR a simpler v1 where only the near-origin region persists modifications and far chunks are ephemeral? Pick the v1 ambition.

## Invariants to preserve (do NOT regress)
- **Determinism law (D208/D226)** — per-chunk deterministic seeding; keep components `phash`-only; keep `verify:placement` green.
- **Rule 9 (collision matches models)** — dispose every Rapier body on chunk unload; no orphaned colliders, no leaks.
- **The released escape-pod intro + near-origin spawn** — unchanged.
- **Save compatibility** — additive, or a sanctioned `SAVE_VERSION` bump surfaced for approval (D81).
- **Perf wins already banked** — pickup instancing (D281) + static merge; don't undo them.

## Files you'll touch first
`src/main.ts` (world-build orchestration → hand off to a ChunkManager), a NEW `src/world/chunkManager.ts`, `src/world/procgenPoi.ts` + `poiAssembler.ts` (per-chunk placement), `src/world/biomes.ts` (per-region anchors), `src/world/heroLandmarks.ts` / `leviathanLandmark.ts` (per-region distribution), the creature `spawn*Procgen` fns, `src/persistence/save.ts` (per-chunk diffs), and the `scripts/rig-shot.mjs` gates (determinism + streaming probes).
