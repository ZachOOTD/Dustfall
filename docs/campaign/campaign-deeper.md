# Campaign charter — DEEPER (proposed 2026-07-24)

**Goal:** turn the underworld from *a beautiful place with one errand in it* into a **system** —
somewhere with variety, danger, a resource worth the descent, and a reason to go back down after
the egg is yours.

Underworld (2026-07-20) shipped the hard part: the entrance tech (D307), a seed-pure branching
cave generator, true darkness, cave audio, and the egg on its dais. What it did **not** ship:
- **One cave per world.** The underground is a single destination, then it's finished forever.
- **Nothing down there can hurt you.** Darkness is atmospheric, not dangerous.
- **No water.** The most obvious desert-survival payoff of a cave is absent.
- **No second visit.** Once the egg is taken there is no reason to ever descend again.
- **The light economy is unexploited.** Torch (180s, consumed) and flashlight (120s drain /
  180s recharge) are already real pressures — but nothing in the cave is *designed against them*.

**Branch:** `campaign/2026-07-24-deeper` (from master). **Push HELD** — commit to the branch,
merge only on Zach's call.

## Non-negotiable constraints
- **Zach's cave walk-test defects are cycle 1 and outrank everything else in this charter.**
  They were never written down at the 07-20 ship; they land in `steering.md` and get fixed first.
- Determinism (D290): every cave layout seed-pure per site descriptor; saves additive-only.
- Architecture is DECIDED (D307) — under-sheet trimesh interiors + entrance-chunk collider swap.
  Do not relitigate. **No portals, no teleports.**
- Rule 7 (real thickness) / rule 9 (collision matches the visible geometry, changed together).
- `cave-walk` stays green at every commit, and **the seed net widens as the generator gains
  parameters** — the Underworld lesson was that 2 gate seeds hid two real generator defects.
- Trust the playtest over a green gate. A gate that measures the wrong thing is worse than none.
- SPEED RULES in force: probes via `npm run rig -- --scenario=… --port=52xx` only · the full-boot
  gate runs at most ONCE per iteration batch · **no monitor/wait/watcher patterns** · every agent
  brief states a wall-clock budget.
- One code-writing agent at a time · never `git stash` here · Fable plans / Opus executes.

## Decisions taken at kickoff (2026-07-24, Zach)
- **Ceiling: 10M / 20 cycles.** Room to iterate hard per rule 8 and to widen the seed net
  aggressively rather than cut.
- **NO CREATURE UNDERGROUND — environment only.** The danger is the dark, the depth, the rock,
  and your torch burning down. Nothing hunts you. This is the pure Long Dark reading and it is
  **decided** — cycle 5 builds environmental hazards, and no cycle may reintroduce a cave monster.
- **Caves are a regular feature of ROCKY TERRAIN**, not a rare landmark. You meet several in an
  hour's travel; the underground is part of routine survival, not an event. The egg cave stays
  unique and findable near origin — it must remain legible as *the* one that matters.

### ⚠ Architectural consequence of "caves are common" — flagged before building
D307's entrance mechanism swaps an entire chunk's heightfield collider for a trimesh with a
carved hole. That was specced and gate-proven for **exactly one cave in the world**. Making caves
a routine rocky-biome feature means the swap becomes a **frequent streaming event**, and multiple
cave interiors can be resident at once. Three things this campaign must prove, not assume:
1. **Swap cost under streaming** — the collider rebuild happening repeatedly while moving, inside
   the frame budget (the `chunk-perf` gate extended to cover cave chunks, with real tripwires).
2. **Teardown symmetry** — a cave chunk unloading must restore the heightfield collider exactly;
   a leaked trimesh or a stale hole is an invisible-wall bug of the worst kind (rule 9).
3. **Resident-interior budget** — a cap on concurrently loaded cave interiors, with the deepest
   trimeshes unloaded before the player can be inside one. Never unload a cave the player is in.
If any of these can't be made safe at density, the fallback is **clustered cave country** (the
erg / wreck-yard regional pattern) rather than uniform rocky density — that is a scope-cut, and
it gets surfaced to Zach rather than taken silently.

## Human checkpoints
1. **After cycle 5** — the repair descent: are D-1…D-4 actually fixed? New content waits on this.
2. **Before cycle 9 is built** — a **hazard spec review** (a doc, not a walk-test): exactly which
   environmental hazards, how each is telegraphed, and how each interacts with the light economy.
   Cheap to read; exists so an unfair hazard can't ship overnight.
3. **Final descent walk-test** — the whole system: dark-nav, light budget, the hazards, the water,
   the return trip, and how caves feel now that they're everywhere.

## Cycle ladder

> **Cycles 1-4 are the walk-test repair. They ship before any new content.** Source of truth:
> [cave-walktest-2026-07-24.md](cave-walktest-2026-07-24.md) (defects D-1…D-4).

| # | Unit | Gate |
|---|---|---|
| 1 | **D-2 spike + the see-through gate** — confirm the interpenetrating-BackSide-shell diagnosis with a real probe, prototype the SDF→marching-cubes watertight remesh on one seed, and land the **void-ray gate** (sphere of rays from N points per chamber/corridor; every ray must hit cave geometry or a declared `intendedOpening`). The gate lands FIRST so it fails on today's build and passes on the fix | the void-ray gate demonstrably RED on current `master`, GREEN on the prototype · tri-count + gen-time measured, not estimated |
| 2 | **D-2 build-out** — the watertight remesh across the whole generator: displacement, strata, mineral staining, sediment re-applied to the unified surface; the room-graph layout logic (sibling angle, clear-span sizing) preserved intact; collider re-baked from the exact visual triangles (rule 9) | void-ray gate green × **6 seeds** · `cave-walk` green × 6 seeds · `verify:solid` cave checks · `verify:all` |
| 3 | **D-1 the crevice entrance** — retire the greybox trench/ramp (`caveTest.ts`) completely. A fissure in a distinctive rock outcrop: small opening, tight committed descent (switchback/chimney inside a slot, not one straight ramp), unioned into the same SDF so there is no weld seam. Must stay findable from a distance | KCC descent + ascent march · void-ray green · **rule 8 visual iteration: 5-8 rounds, screenshots, not `verify`** · the entrance reads as a crevice from 3 approach distances |
| 4 | **D-4 preload + generation budget** — origin cave built during the boot loading screen; streamed cave builds sliced on the S6 frame-budget pattern (D296); resident-interior cap | `chunk-perf` extended to cave builds with real tripwires · no boot-time regression on the flag-off path |
| 5 | **D-3 reassess** — full adversarial player-eye visual audit across the whole tree by fresh critics (not the builders), + `CAVE_*` taste tuning (darkness depth, torch range/intensity, mushroom glow, drip rate, shaft falloff) | audit findings fixed or explicitly backlogged · **→ PAUSE (checkpoint 1: your second descent)** |

> **Cycles 6+ are the new content — they start only after your second descent signs off cycles 1-5.**

| # | Unit | Gate |
|---|---|---|
| 6 | **UNDERGROUND WATER** *(Zach: "do love the idea of water pools in the caves — definitely want to add that")* — promoted ahead of density/kinds; see the spec below | drink/fill probe · determinism ×2 seeds · pool collision matches the visible surface (rule 9) · **rule 8 visual iteration, 5-8 rounds — this is a hero visual** |
| 7 | **Caves as rocky-terrain density** — caves roll off the chunk descriptor in the rocky biome at real density; streamed entrances, resident-interior cap, exact teardown. The egg cave stays unique near origin | placement + chunk determinism ×2 seeds · `cave-walk` + void-ray widened to N sites · **`chunk-perf` covering swap cost + teardown symmetry + resident cap** · surface world byte-identical |
| 8 | **Cave kinds** — distinct parameter sets over the same generator so caves read as different places: a tight salvage warren, a vaulted fungal cavern, a **flooded cave** (leans on cycle 6), a collapsed shaft. Not new code paths — a kind table | `cave-walk` + void-ray green across every kind × 3 seeds · `verify:solid` cave checks · rule 8 visual iteration |
| 9 | **Environmental hazards** (spec-gated by checkpoint 2, **no creature**) — from: unstable ceilings / rockfall on disturbance, foul air in unventilated deep pockets, false floors over drops, deep-cold. Each must be telegraphed and must interact with the light economy, never bypass it | a real physics probe per hazard · every hazard survivable by a careful player · `cave-walk` unaffected or explicitly re-baselined |
| 10 | **The light budget as a designed pressure** — deployable lanterns as route breadcrumbs you can retrieve, torch stockpiling/crafting cost sanity, a descent tuned so a full round-trip *costs* you. Tuning + small UX, not new systems | a "descend to the egg chamber and get back out" march with a realistic light inventory |
| 11 | **The reason to return** — cave-only value that regenerates or persists: the best battery/wiring source (already true — make it legible), a water run, a deep cache tier worth a second trip | loot digest gate (`verify:loot` baseline rebase, deliberate) · save/reload persistence |
| 12 | **Integration** — story/journal beat for the underworld, perf pass on multi-cave streaming, docs (feature doc, D-entries, changelog, backlog sweep), morning summary | `verify:all` + `verify:chunks` + `chunk-perf` · **→ PAUSE (checkpoint 3)** |

**Scope-cut order if the ceiling bites:** 11 → 10 → 8 (drop to one extra kind) → 9 deferred to its
own slice. **Cycles 1-5 are the repair and are never cut**; 6 and 7 are the spine of the new work.

---

## Cycle 6 spec — UNDERGROUND WATER

Zach's own pull, promoted ahead of density and kinds. It **must** come after the cycle-2 remesh:
pools sit on cave floors, and the floor geometry is being rebuilt.

### It plugs into an existing system, not a new one
`ctx.waterSources` is already a generic registry with hover + `E`-to-refill handled in
[interaction.ts:442](../../src/player/interaction.ts). Wells are its only current kind and the
prompt noun is hardcoded to `'well'`. A cave pool is **a second water-source kind** — the
integration is a noun, a placement rule, and a mesh. Refill logic is reused as-is.

### The design question this cycle has to answer honestly
Wells today give **instant, unlimited, free** refills (`fillLevel = 1`, source never depletes) and
roll at `CHUNK_WELL_CHANCE 0.03` per chunk — not rare. So *mechanically* a cave pool that refills
a canteen adds nothing you can't get on the surface without descending. Three ways to make it
matter, in ascending cost:
1. **Atmosphere only** (honest, cheapest) — a pool refills exactly like a well. The payoff is the
   *place*: still black water in torchlight, the sound of it in the dark. No balance risk.
2. **Volume** — a pool is where you top up *everything*, tied to a larger vessel (waterskin /
   jerrycan) that only makes sense to fill at a real body of water. Gives the descent a purpose.
3. **Quality** — cave water is clean; surface/well water is brackish and wants boiling. The
   richest, but it adds a purity system that touches every existing water source and the fires.
**Recommendation: (1) for this cycle, built so (2) is a small follow-on.** Do not build (3) inside
this campaign — it is a survival-systems change, not a cave change, and it belongs with the Phase-C
water & exposure arc. Zach's call at the cycle-6 kickoff; unanswered = (1).

### The build
- **Placement**: pools form in the true low points of chamber floors (the generator already pools
  sediment in floor dips — same signal), seeded per cave, never in the egg chamber's walk line and
  never blocking a corridor mouth.
- **Rendering** — this is the hero visual, and it earns its 5-8 rounds: near-black still water,
  a real reflection of the torch (the only moving light down there), gentle normal-map ripple,
  a wet-rock rim where the water meets stone, and a visible bottom fading into depth. Flat-black
  ellipses on the floor would be a failure of this cycle, not a pass.
- **Audio**: the existing drip bed gets a destination — drips *land in water* near a pool, plus a
  quiet lapping bed that fades in by proximity. Ties to `CAVE_BED_DRIP_*`.
- **Collision (rule 9)**: shallow pools are walkable — the collider must match the visible bottom,
  not the water plane, or you get an invisible floor. Deep pools, if any, need an explicit
  decision (wade / block / swim); **default: shallow and walkable, no swimming in this campaign.**
- **Determinism + save**: seed-pure per cave descriptor; pools are world geometry, not state — no
  save-schema change.

## Ceiling
**10M tokens / 20 cycles.** Checkpoints as listed above.

## Walk-test defects — RECEIVED 2026-07-24
Recorded in [cave-walktest-2026-07-24.md](cave-walktest-2026-07-24.md): D-1 greybox ramp entrance
(wanted: a crevice) · D-2 see-through interior walls/floors (root-caused: interpenetrating
zero-thickness BackSide shells — rule 7) · D-3 reassess + sweep · D-4 preload caves.
They are cycles 1-5 and they gate everything else.
