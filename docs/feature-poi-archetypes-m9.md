# Feature slice — M9: new POI archetypes (world-deepening queue)

**Campaign:** Sharpen & Deepen · M9 · goal: 2-3 NEW far-field salvageable destination types that
deepen exploration in the infinite world (like M6's relay_mast/buried_pipeline/cargo_crawler, but new
silhouettes). Gate-verified, no save bump. Build ONE archetype per cycle.

## Definition of Done (per archetype)
A NEW procgen POI archetype that: (1) reads as a DISTINCT silhouette vs the existing set
(ship/derelict/satellite/wrecked_tank/debris_field/hollow_husk/well/debris_trail/enterable_wreck/
relay_mast/buried_pipeline/cargo_crawler); (2) is fully wired into the pipeline (an `assembleX(rand)`
builder + an `ARCHETYPES` registry entry + `ARCH_WEIGHTS` per biome, so it streams in the far field
via the existing chunk POI roll); (3) has ≥1 salvage panel (reuse the assembler's panel mounts +
`registerSalvageable`); (4) is collision-correct (rule 9 — colliders match the visible masses);
(5) has REAL thickness (rule 7 — no paper-thin double-sided); (6) descriptor-pure (D290) +
streamed-teardown-safe (D292 — it flows through the proven `placeProcgenPOI` streamed path).

## The 3 concepts (build in this order)
1. **`refinery_stack`** — a fuel-refinery / cracking-tower ruin. A TALL vertical industrial silhouette
   (a cracking column / distillation tower) + 1-2 storage tanks (cylindrical or spherical) + pipe
   runs + a flare stack, toppled/leaning from the crash of an industry. Distinct from relay_mast (a
   thin comms mast) — this is a chunky industrial mass. Salvage on a tank/valve console. `bucket: dark`
   or `warm` (rusted industrial). A vertical destination visible on the horizon.
2. **`hab_dome`** — a collapsed habitat-dome cluster. 1-2 torn geodesic/ribbed dome shells (partial,
   caved-in) + a connecting corridor module. A ROUNDED silhouette (unique — nothing else is domed) +
   a human-habitation story (someone lived here). Salvage inside/on a dome. `bucket: cool`.
3. **`transit_car`** — a half-buried transit / cargo RAIL car (or a short 2-segment train). A boxy
   passenger/freight car tilted on a buried bogie/truck. Distinct from cargo_crawler (a tracked
   hauler) — this reads as rail/transit. Salvage panel on the car side. `bucket: warm`.

## Grounding (user steering — NO sand mounds)
Per the 2026-07-13 steering (models-need-thickness + the Skyfall no-mounds note), prefer `burySink` /
`seatSink` grounding over `sandMound: true` for these new archetypes (the big geometric drift piles
read poorly). A subtle bed is fine; avoid mound-heavy looks.

## Integration pattern (mirror relay_mast)
- `assembleX(rand: Rng): AssembleResult` in `poiArchetypes.ts` — build the geometry via the assembler
  helper (`a.place(...)`, panel mounts, `a.result()`); real thickness + colliders declared per the
  assembler's collidable convention.
- `ARCHETYPES.X = { id: 'X', params: { bucket, burySink, bury, list, panelMin, panelMax, sandMound:false,
  seatSink, salvageKind }, assemble: assembleX }`. `ArchetypeId` picks it up automatically (keyof).
- Add `['X', ~0.05]` to each biome's `ARCH_WEIGHTS` (favor the biomes that fit the archetype's story).

## Gates (per archetype)
verify:all (placement 5-seed + colliders) + the 6 rig gates + the adversarial visual gate (routine bar
for a set-dressing POI; hero if focal) + verify-chunks (determinism stable per seed, no body leak).
