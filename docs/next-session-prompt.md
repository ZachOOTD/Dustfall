# Next cycle (20) — M9 archetype 2/3: `hab_dome` (collapsed habitat-dome cluster)

**State:** campaign "Sharpen & Deepen" `active` on `campaign/2026-07-12-skyfall` (19 cycles, ~6.1M/8.75M
spent; ~2.65M left of the +4M cap). Checkpoint none. **M7-R + M8 done; M9 = 1/3** (refinery_stack shipped).
Queue: **M9 (2 more archetypes) → M10 → M11 → M12.**

## Cycle 20 = M9 archetype 2/3 — `hab_dome`
A collapsed HABITAT-DOME cluster: 1-2 torn geodesic/ribbed dome shells (partial, caved-in) + a
connecting corridor module. A ROUNDED silhouette (unique — nothing else in the set is domed) + a
human-habitation story. ≥1 salvage panel. Spec + integration pattern: `docs/feature-poi-archetypes-m9.md`.

**Modeler tip (from the cycle-19 refinery build):** `getBucketMats` forces `DoubleSide`, so a torn/partial
dome shell (`cool` bucket) shows its interior correctly WITHOUT extra work — but the collision must be
side-wall boxes + `auditExempt` on the hollow shell (mirror `huskShell`), NOT a solid volume, or the
collider audit flags the empty AABB. Follow the `refinery_stack`/`relay_mast` wiring pattern (one `seedOf`
draw → a `BuiltComponent` builder in poiComponents.ts → `assembleHabDome` + `ARCHETYPES.hab_dome` +
`ARCH_WEIGHTS`). `sandMound: false` (steering); real thickness (rule 7 — dome ribs/panels get depth);
descriptor-pure + streamed-teardown-safe. Favor `rocky`/`dune` biomes (habitats in the highlands).

Gate: verify:all (placement 5-seed + colliders 0 fails) + verify-chunks (det stable, no leak) + the
`procgen-wreck` rig visual (distinct domed silhouette). GPU probes ~26s.

## Then M9 archetype 3/3 = `transit_car` (cycle 21)
A half-buried transit/cargo RAIL car (or short 2-segment train), tilted on a buried bogie. Distinct from
cargo_crawler (a tracked hauler). `warm` bucket; box-collider precedent in `crawlerBody`.

## The rest of the queue
M10 more story vignettes → M11 retire legacy tube-wrecks (ship→socket, D227/D249) → M12 new far-field biome.
(~2.65M left → M9 finishes (2 more archetypes ~1M) + M10 gets a start; run stops cleanly at the 8.75M cap.)

## Standing constraints (steering.md)
- **models-need-thickness** (rule 7) · **100% collision** (rule 9, swept) · determinism (D290) +
  streamed-teardown (D292/rule 9, NO body leaks) · no save-schema change without the D81 pause · GPU probe default.
- Cleanup owed (guard-blocked): remove the stray untracked `scratch-baseline/` dir AND `scripts/_vultcheck.mjs`
  in the morning.
