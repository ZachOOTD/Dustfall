# Campaign — Dustfall "Infinite Sands" (infinite procedural generation)

**Goal:** Convert the finite origin-bound world into an **infinite, deterministic, chunk-streamed** open world per `docs/feature-infinite-procgen.md` (the authoritative feature slice — read it every cycle). "Done enough" = the S-ladder below built + green, ready for one morning review.
**Started:** 2026-07-10 (overnight)
**Branch:** `campaign/2026-07-10-procgen` (every cycle commits here; never pushed; merged after the human review)
**Budget:** max-cycles **50** (hard stop) · soft ceiling ~10M output tokens
**Checkpoint policy:** `none` — run to completion, **except the one sanctioned pause** (below)
**Self-author policy:** `propose` (if the ladder empties, propose + wait — do NOT auto-add)
**Status:** active

## Design decisions (ANSWERED by the user 2026-07-09 — do not re-litigate)
1. **Chunk size / load radius:** ~112m chunks, load radius ≈ the fog cull horizon (~3 chunks). S1 may tune ±, log a D-entry if it does.
2. **Deterministic world:** yes — `hash(worldSeed, cx, cz)` per chunk; same seed → same infinite world.
3. **Landmarks:** DISTRIBUTED rares — a rare per-region roll scatters hero destinations across the infinite field (Skyfall plugs in here later).
4. **The escape-pod intro stays the fixed start** — the origin region is authored; infinity extends beyond it.
5. **Save v1 ambition:** FULL per-chunk diffs (modified chunks persist; pristine chunks regenerate). Requires a `SAVE_VERSION` bump → the sanctioned pause.

## The S-ladder (authoritative queue — traverse in order; from feature-infinite-procgen.md)
- **S1 — ChunkManager spike** `[auto]` — the chunk grid + per-chunk deterministic seed + load/unload with full disposal (meshes, Rapier bodies, registries). Prove it with trivial marker posts + author the NEW permanent gates: a per-chunk **determinism probe** (same (seed,cx,cz) → byte-identical twice) and a **streaming probe** (walk across boundaries → chunks load/unload, body count returns to baseline, no seam duplicates).
- **S2 — POI streaming** `[auto]` — `placeProcgenPOIs`/`placeProcgenPOI` become per-chunk (biome weights, collider audit, static merge, salvage/journal registration all per chunk; full teardown on unload). Origin chunk keeps the spawn exclusion.
- **S3 — Scatter + ambient life streaming** `[auto]` — rocks, wordless scenes per-chunk; creatures via an active-ring model around the player (VERIFY how spawn*Procgen works first — the brief's ❓).
- **S4 — Landmarks + biomes for infinite** `[auto]` — distributed rare heroes (coarse landmark grid / Poisson-disk roll); re-anchor the distance-override biomes (wreck_yard etc.) per-region; origin heroes (Leviathan, mega-ship/wreck, opening scene) stay authored.
- **S6 — Perf + hitch-free generation** `[auto]` — frame-budgeted chunk generation; draw-call/body ceilings for the active set; extend `perf-probe` to a cross-chunk walk asserting steady counts. (Ordered before S5 so the pause lands last.)
- **S5 — Save: per-chunk diffs** `[⏸ SANCTIONED PAUSE — pause BEFORE building]` — write the schema plan (which diffs per chunk, migration story, the `SAVE_VERSION` bump), set `awaiting_approval` + `stop_reasons: ["save-version-bump"]`, STOP. The human reviews in the morning + `/campaign-approve` releases the build. **Never ship an unreviewed migration (D81).**

## Locked constraints (do NOT violate autonomously)
- **Determinism law (D208/D226)** — per-chunk seeding; components stay `phash`-only; `verify:placement` (adapted as needed) + the new determinism probe stay green.
- **Rule 9 / no leaks** — every Rapier body, registry entry, and mesh disposed on chunk unload; the streaming probe asserts body-count baseline.
- **The released escape-pod intro + near-origin spawn are UNCHANGED** — `smoke-intro` / `smoke-pod-tutorial` must stay green every cycle.
- **No save-schema changes before the S5 pause** (D81).
- **Keep banked perf** — pickup instancing (D281), `mergeStaticByMaterial`; don't undo.
- **Master stays untouched** — all work on this branch.
- **The PARKED Skyfall campaign** (`campaign-*-2026-07-09-sharpen-deepen.*`) is read-only — resume later by restoring those files + `/campaign-approve`.

## Verify gate (per cycle)
`npm run verify:all` + `smoke-intro` + `smoke-pod-tutorial` + `pickup-take-sweep` + `survival-probe` + `diurnal-probe`, PLUS (once S1 authors them) the **chunk-determinism** + **streaming/leak** probes. A cycle that breaks the released opening does NOT pass. Visual gate: this is systems work — screenshots for placement sanity, no hero bar.

## Scope-cut order (if a wall hits 3× or budget trips)
Wordless-scene streaming (keep them origin-only) → creature active-ring nuance (simple radius despawn) → S4 biome re-anchoring breadth (wreck_yard stays origin-anchored for v1) → S6 LOD depth. **Never cut:** determinism, unload disposal (leaks), the intro gates, or the S5 pause.

## How to steer
- Watch: `campaign-log.md` (this file's sibling) or `/campaign-status`.
- Redirect: write in `steering.md` (picked up at the next cycle boundary).
- Stop: delete `.gamedev-framework/overnight.lock`, or write `pause` in `steering.md`.
- Morning: review the log + walk the world (`npm run dev`), then `/campaign-approve` at the S5 pause.
