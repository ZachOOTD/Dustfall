# Next cycle (19) — M9: new POI archetypes (2-3 new far-field destination types)

**State:** campaign "Sharpen & Deepen" `active` on `campaign/2026-07-12-skyfall` (18 cycles, ~5.85M/8.75M
spent; ~2.9M left of the +4M cap). Checkpoint none. **M7-R + M8 COMPLETE.** Queue: **M9 → M10 → M11 → M12.**

## Cycle 19 = M9 — new POI archetypes
2-3 NEW salvageable far-field destination types (like M6's relay_mast / buried_pipeline / cargo_crawler,
but new silhouettes). Deepens exploration; gate-verified; no save bump. **`/feature-slice` it** (write
`docs/feature-poi-archetypes-m9.md` with 2-3 concrete archetype concepts + the DoD). Then build ONE
archetype per cycle (M6 shipped one per cycle).

Study the M6 archetype pipeline: `src/world/poiArchetypes.ts` (the archetype builders — `assembleWatchtower`,
`assembleDebrisTrail`, the M6 relay_mast/buried_pipeline/cargo_crawler), `src/world/poiAssembler.ts`
(`placeProcgenPOI`, `pickArchetype`), the `ArchetypeId` union, and how archetypes are biome-weighted +
streamed (chunkManager POI rolls). Each new archetype: a distinct procedural silhouette + salvage panels
(reuse `addAccessPanel`/`registerSalvageable`) + colliders (rule 9) + real thickness (rule 7) + descriptor-
pure (D290) + streamed-teardown-safe (D292). Gate each: verify:all (placement 5-seed + colliders) + the
6 rig gates + the adversarial visual gate (routine bar for set-dressing POIs, hero if it's a focal one) +
verify-chunks (no leak).

Candidate concepts (pick 2-3 at feature-slice, or invent better): a toppled comms/radar dish array; a
half-buried transit/cargo train segment; a fuel-refinery / cracking-tower ruin; a collapsed hab-dome
cluster; a crashed smaller craft (distinct from Skyfall). Fit the salvage/survival tone (GDD).

## The rest of the queue
M10 more story vignettes → M11 retire legacy tube-wrecks (ship→socket, D227/D249) → M12 new far-field biome.
(Budget ~2.9M left → likely gets through M9 + a start on M10; the run stops cleanly at the cap.)

## Standing constraints (steering.md)
- **models-need-thickness** (rule 7) · **100% collision** (rule 9, swept) · determinism (D290) +
  streamed-teardown (D292/rule 9, NO body leaks) · no save-schema change without the D81 pause · GPU probe default.
- Cleanup owed (guard-blocked): remove the stray untracked `scratch-baseline/` dir AND `scripts/_vultcheck.mjs`
  (a leftover M8 numeric probe) in the morning.
