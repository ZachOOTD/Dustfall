# Next cycle (21) — M9 archetype 3/3: `transit_car` (half-buried rail car) — LAST M9

**State:** campaign "Sharpen & Deepen" `active` on `campaign/2026-07-12-skyfall` (20 cycles, ~6.35M/8.75M
spent; ~2.4M left of the +4M cap). Checkpoint none. **M7-R + M8 done; M9 = 2/3** (refinery_stack, hab_dome).
Queue: **M9 (1 more) → M10 → M11 → M12.**

## Cycle 21 = M9 archetype 3/3 — `transit_car` (completes M9)
A half-buried transit / cargo RAIL car (or a short 2-segment train), tilted on a buried bogie/truck.
A boxy passenger/freight car — distinct from `cargo_crawler` (a tracked hauler): this reads as RAIL
(a car body on a bogie/rail truck, coupler ends, window strip / cargo-door side). ≥1 salvage panel on
the car side. Spec + integration pattern: `docs/feature-poi-archetypes-m9.md`.

Follow the refinery_stack/hab_dome wiring pattern EXACTLY (freshest templates in `poiComponents.ts` +
`poiArchetypes.ts`): a `transitCar` `BuiltComponent` (one `seedOf` draw + phash) → `assembleTransitCar`
+ `ARCHETYPES.transit_car` + `ARCH_WEIGHTS`. Params: `bucket:'warm'`, `sandMound:false` (steering),
a modest `list` (a tilted car), `seatSink` to bed the bogie, `panelMin/Max:1`. Box-collider precedent
in `crawlerBody` (a boxy car body is a solid box collider, unlike the dome's hollow shell). Real
thickness (rule 7). Favor `salt`/`dune` (old rail lines across the flats), a touch on the others.
**IMPORTANT:** the collider-audit archetype list in `scripts/rig-shot.mjs` is HARDCODED (separate from
the ARCHETYPES registry) — you MUST add `'transit_car'` to it or `verify:colliders` won't audit it.

Gate: verify:all (placement 5-seed + colliders 0 fails) + verify-chunks (det stable, no leak) + the
`procgen-wreck` rig visual (distinct rail-car silhouette). GPU probes ~26s.

**When transit_car ships, M9 is COMPLETE** (3 archetypes) → next cycle picks up M10.

## The rest of the queue
M10 more story vignettes → M11 retire legacy tube-wrecks (ship→socket, D227/D249) → M12 new far-field biome.
(~2.4M left → M9 finishes + M10 gets a real start; run stops cleanly at the 8.75M cap. M11/M12 likely
carry to a future session — that's fine, priority order.)

## Standing constraints (steering.md)
- **models-need-thickness** (rule 7) · **100% collision** (rule 9, swept) · determinism (D290) +
  streamed-teardown (D292/rule 9, NO body leaks) · no save-schema change without the D81 pause · GPU probe default.
- Cleanup owed (guard-blocked): remove the stray untracked `scratch-baseline/` dir AND `scripts/_vultcheck.mjs`
  in the morning.
