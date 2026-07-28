# Cycle 11 plan — DEPLOYABLE LANTERNS + CAVE COLD AS ATMOSPHERE

**Campaign:** DEEPER · branch `campaign/2026-07-24-deeper` · cycle 11 of the post-walk-test ladder.
**Source of truth:** [steering.md](steering.md) 2026-07-28, Zach verbatim —
*"i like the lanterns, we already have lanterns in the game so can use those"* and
*"the temperature should be colder but not cold enough to damage the player."*
**Status:** RECON COMPLETE, not started. Read-only investigation, 2026-07-28.

---

## 0. The headline finding — the deployable lantern already ships

`src/world/lantern.ts` (387 lines, session AAC + AAY-fix + AAZ-fix) is a **complete
place-and-retrieve system today**: `lantern_kit` ItemId, craft recipe 12, LMB-place via
`deployLantern` (items.ts:3240, `wieldLmb:'place'`), RMB pack-up via `packUpLantern`,
pool-backed `PointLight`, per-instance flicker, ghost-preview ring, tutorial hint, and
**already persisted in the save**.

So cycle 11 is **not** "build deployable lanterns." Zach's read is correct — the item exists.
The work is: **make the shipped lantern work UNDERGROUND, cap it honestly, and make it read as a
breadcrumb.** Four verified gaps, no new architecture.

| # | Gap | Evidence |
|---|---|---|
| **G1** | **BLOCKING.** `deployLantern` line 266: `pos.y = ctx.terrain.heightAt(pos.x, pos.z)` — the *surface* sampler. Underground it teleports the lantern tens of metres up into solid rock: invisible, unretrievable, and it persists there. Same bug in `updateGhostPreview` (ghostPreview.ts:151), so the preview ring lies too. | `lantern.ts:266`, `ghostPreview.ts:151` |
| **G2** | **No cap, silent failure.** `claimLight` returns `null` when the pool is exhausted → `spawnLanternAt` creates a lantern with **no light and no message**. An unlit breadcrumb is the worst possible failure for route-marking. | `lantern.ts:304-319`, `lightPool.ts:71-81` |
| **G3** | Placed lanterns are **scene-direct**, not resident-owned, so they survive cave eviction (correct for persistence) but hold a pool slot forever and hang in a void. Bounded only by a cap that doesn't exist yet. | `lantern.ts:296`, `caveStream.ts` disposeResident |
| **G4** | `setCaveRockLightState` reads **only the HELD lights** (`vm.heldPointLight` / `heldSpotLight`). A placed lantern gets the direct `CAVE_LIT_GAIN` envelope but contributes **zero** carried-light bounce → next to your own lantern the ceiling goes black in a way it does not with a torch. | `caveAtmosphere.ts:179-190` |
| **G5** | **In your favour, and it kills the perf worry in the brief.** All 30 pool lights are permanently scene children at intensity 0 (`createLightPool(three.scene, 30)`, main.ts:140). Placing a lantern only writes `intensity`/`position` — **zero program-cache-key churn, zero incremental per-fragment light loops**; the shader already iterates 30 point lights. The ONLY budget is the 30-slot pool, shared with fires (`fire.ts:224`), the leviathan interior (`leviathanLandmark.ts:1391`, claims many under 95m) and salvage-panel glows (`interaction.ts:1616`). | `lightPool.ts:1-31`, main.ts:140 |

### Closest idiom for "deployable + retrievable"

**The lantern's own family — the AAC camp-placeable pattern** (D80 clone-not-parameterize):
`tent.ts` / `largeTent.ts` / `bedroll.ts` / `lantern.ts` / `locker.ts` / `stake.ts` are all the
same six-part shape — a ctx registry list · `deployX(ctx)` from `wieldLmb:'place'` ·
`spawnXAt(ctx,pos,rotY)` + `setNextXId` + `findXById` for the loader · a `tag()` writing
`userData.interactType/interactId/interactRegistry` · an interaction.ts `case` setting a passive
hover · `handleContextAction` dispatching RMB → `packUpX` on the `hovered` flag
(`wieldAction.ts:138-166`) · an additive optional save array.

Explicitly **not** the sled (sled.ts:639 follows the pattern but also owns tether/cargo
teardown — heavier), **not** `spawnDroppedPickup` (physics-bodied loose items, different
lifecycle), **not** `spawnFire` (fuel + shelter zone + burnout).

### The save story — ADDITIVE, NO BUMP, already correct

`save.ts:310` `lanterns?: Array<{ id, pos: V3, rotationY }>` (v8, D81 additive). Save writes the
**absolute** position (`save.ts:640`); load clears the list, releases pool lights, and re-spawns at
the **saved** position with **no re-projection to terrain** (`save.ts:1191-1198`). An underground
lantern therefore round-trips exactly. **`SAVE_VERSION` stays 18. No migration. No schema change.**
The only save-side work is enforcing the cap on the load path.

---

## 1. The temperature system, and why cave cold is NOT additive

`src/stats/survival.ts:29-73`. `t.temperature ∈ [-1, +1]`, ticked by a **mutually exclusive branch
chain**:

1. `inShelter && crashHeat<=0` → pull toward 0 (`COLD_SHELTER_RECOVER` 1/30)
2. `exposure > 0.2` (day) → heat gain, floored by `SHADE_HEAT_FLOOR` even at `sun01=0`
3. `exposure <= 0.0` (night) → `COLD_NIGHT_DRAIN` **1/420** toward −1
4. else twilight → drift toward 0

Damage at `temperature <= -1`, `COLD_DAMAGE_PER_SEC` **1/150**, death cause *"the cold took you"*
(`survival.ts:110-137`). Vignette at `COLD_VIGNETTE_THRESHOLD` 0.3. Regen needs `|temp| < 0.5`.

**The load-bearing discovery: underground, `exposure` still comes from the SURFACE clock.**
At night, branch 3 already drains you to −1 and **kills you inside a cave today** — cave cold is
not a new risk, it is a pre-existing one nobody has walked into yet. By day, branch 2 runs and you
**warm up** underground (floored gain at `sun01≈0`). So the shipped cave is **warm by day, lethal
by night** — exactly backwards from Zach's ask.

Therefore cave cold **cannot be an added drain**. It must be a **cave branch that pre-empts
branches 2-4 whenever the player is underground**, driving temperature toward a depth-derived
**negative equilibrium** rather than draining without bound. The equilibrium form is what makes
"never damaging" true *by construction* rather than by tuning.

### INV-COLD — the clamp invariant (this is the thing the gate proves)

> **While the player is underground the cave term is the only ambient temperature term that runs
> (shelter still pre-empts it). The cave term moves `temperature` monotonically toward
> `caveColdTarget(depth, kind, wet)` and never past it; `caveColdTarget` is hard-clamped to
> `[CAVE_COLD_FLOOR, 0]` with `CAVE_COLD_FLOOR = -0.55`, and a boot assert requires
> `CAVE_COLD_FLOOR >= COLD_DAMAGE_TEMP + CAVE_COLD_SAFETY_MARGIN` (−1 + 0.35).**

Three separately assertable corollaries:

- **(a) Totality.** For any depth, kind, wetness, weather, time of day and starting temperature
  ≥ the floor, the cave term can never yield `temperature < CAVE_COLD_FLOOR`, hence never `≤ -1`,
  hence **zero cold damage attributable to the cave** — regardless of how terms stack, because the
  floor binds the **target**, not the rate.
- **(b) Descending can only help.** A player who arrives underground already **below** the floor
  (frozen from a night trek) is **warmed toward** it, never chilled further. This is the clause that
  makes the guarantee total instead of conditional, and it is physically true — a cave sits near the
  local mean annual temperature, warmer than a desert night, cooler than a desert noon.
- **(c) Surface parity.** `depth <= 0 ⇒ the cave term is exactly a no-op`; the branch chain and its
  numbers are byte-identical to today's.

**Interactions, spelled out:**
- **Fires / shelter still pre-empt** (branch 1 untouched) → making camp underground fully
  neutralizes the cold. This is the "carry fuel and camp deep" beat, free.
- **Flooded / wading.** `nearWaterSource` (`controller.ts:593`) already works underground — cave
  pools publish into `ctx.waterSources.list` and detach on eviction (cycle 6). Wet applies a
  **colder target multiplier**, never a faster rate, then re-clamps. *(Approximation: the check is a
  radius around the pool centre, not the pool polygon — good enough for a flavour term, named here
  so nobody rediscovers it.)*
- **Kind.** Read from `resident.cave.probe.kind` (`caveGen.ts:2000-2003`); origin = `canonical`.
  Multipliers on the target, re-clamped.
- **Placed lantern warming you:** Zach did **not** ask for it. Default NO — see Q4.

### Where "underground" and "depth" come from

`caveAtmosphere.caveDarknessAt` (line 71) already performs the exact containment test (origin AABB
**or** `ctx.caveStream.occupied(p)`) and computes `depth = terrain.pureHeightAt(x,z) - y`. Two
problems for reuse: it **has a side effect** (`atmo.inCaveKey = …`) and it returns a smoothstep that
**saturates at `CAVE_DARK_DEPTH_FADE` (~7 m)** — useless for cold, which must keep growing to ~50 m.

**Fix:** extract a **pure, side-effect-free** `caveContainmentAt(atmo, p, ctx) →
{ key: string|null; depth: number; kind: CaveKind }`; have `caveDarknessAt` call it and keep its
behaviour bit-identical (provable with the existing `cave-light` scenario). `updateStats` calls the
same pure function. **Tick order:** `updateStats` (main.ts:1247) runs *before*
`updateCaveAtmosphere` (main.ts:1268) — a pure function has no ordering constraint, so this
introduces **no new tick-order dependency** and no frame of latency. (Caching `atmo.depthM` would
have introduced both. Don't.)

---

## 2. File-by-file change list

| File | Change | LOC |
|---|---|---|
| `src/world/caveAtmosphere.ts` | Extract pure `caveContainmentAt()` (no side effects, returns `{key, depth, kind}`); `caveDarknessAt` becomes a thin wrapper over it, behaviour bit-identical. **G4:** extend the `src` selection in `setCaveRockLightState` to also consider placed lanterns within `LANTERN_LIGHT_DISTANCE`, picking max `intensity / max(1, dist²)`. **Contract to preserve:** with nothing held AND no lantern near, `carried` must still be exactly 0 (the no-free-light canary). | ~50 |
| `src/config/tuning.ts` | New `CAVE_COLD_*` block: `CAVE_COLD_TARGET_MAX` (−0.45), `CAVE_COLD_FLOOR` (−0.55), `CAVE_COLD_SAFETY_MARGIN` (0.35), `CAVE_COLD_DEPTH_FULL_M` (50), `CAVE_COLD_RATE_PER_SEC` (≈1/180 toward target), `CAVE_COLD_WET_MUL` (1.25), `CAVE_COLD_KIND_MUL` (per-kind). Plus `LANTERN_MAX_PLACED` (6). All with the usual comment provenance. | ~25 |
| `src/stats/survival.ts` | Insert the cave branch **between** the shelter branch and the sun branch: `else if (caveDepth > 0) { … }`. Target computed, clamped to `[CAVE_COLD_FLOOR, 0]`, temperature moved toward it and **never past** (`Math.min/Math.max` on the approach, both directions). Boot-time assert on the floor-vs-damage margin. | ~35 |
| **NEW** `src/world/placementGround.ts` | `placementGroundY(ctx, x, z, fromY, maxDrop) → number \| null`. Rapier downcast (the exact `castDown` idiom at `debugPanel.ts:1189`: `new RAPIER.Ray`, `world.castRay(ray, 500, true, undefined, undefined, undefined, excludeBody)`), **excluding the player body** (the S1 probe lesson). **Ray origin must be `camera.y + 0.5`, not y=100** — from above, the ray hits the terrain sheet and never reaches a cave floor. Bounded drop (~4 m): a miss returns `null` = "no floor there," which is also the right answer on the surface over a chasm. Falls back to `terrain.heightAt` only when physics is unavailable. | ~60 |
| `src/world/lantern.ts` | `deployLantern`: use `placementGroundY`; refuse with a reason when it returns `null`. **G2:** cap at `LANTERN_MAX_PLACED` with a distinct refusal toast. Widen the return to a small discriminated result (or toast-then-return-null) so items.ts's generic message isn't the only feedback. | ~30 |
| `src/player/ghostPreview.ts` | Use the **same** `placementGroundY` (so preview and deploy agree by construction) and hide/redden the ring when it returns `null`. | ~15 |
| `src/persistence/save.ts` | Defensive cap clamp on the lantern load path (spawn at most `LANTERN_MAX_PLACED`, warn past it) so an old/hand-edited save can't drain the pool. **No schema change, no version bump.** | ~5 |
| `src/world/fire.ts`, `bedroll.ts`, `tent.ts` | Route their `pos.y = ctx.terrain.heightAt(...)` (fire.ts:189, bedroll.ts:110, tent.ts:267) through `placementGroundY`. **See R1 — this is arguably required, not optional.** | ~6 ea |
| `src/debug/debugPanel.ts` | Walk-test affordance: a "drop 3 lanterns down the corridor" dev button beside the per-kind warp buttons (202cc16), so Zach can feel the breadcrumb trail in one click. | ~20 |
| `scripts/rig-shot.mjs` | Gate A (`LANTERN-RT`) + Gate B (`CAVE-COLD`) inside the existing `pool-fill` scenario, each emitting its own probe line. | ~300 |
| `scripts/verify-chunks.mjs` | Parse the two extra lines inside the existing `pool-fill-<seed>` leg's `row(m, out)` — the established `chunk-perf` → `CAVE-BUILD` sub-row idiom (verify-chunks.mjs:160-176). **No new leg.** | ~30 |

**Ballpark: ~250 LOC in `src/`, ~330 LOC of gate/rig.** No new systems, no new save schema, no new
tick-order constraint, no new permanent leg.

---

## 3. Build order

1. **`caveAtmosphere.ts` pure split.** Prove `cave-light` output byte-identical before/after.
2. **`tuning.ts`** `CAVE_COLD_*` + `LANTERN_MAX_PLACED`.
3. **`survival.ts`** cave branch + clamp + boot assert.
4. **Gate B, RED FIRST.** Land the sweep, set `CAVE_COLD_FLOOR = -1.4`, **record the RED output in
   the cycle log**, then restore. (Void-gate discipline, steering: *"a gate that can't be
   demonstrated failing on the broken build is a gate that launders bugs as verified."*)
5. **`placementGround.ts`** + wire `deployLantern` + `updateGhostPreview`.
6. **Cap + refusal + save-load clamp.**
7. **G4 bounce term** for placed lanterns (+ the exactly-zero unlit canary).
8. **Gate A, RED FIRST** — revert step 5 in a scratch run, confirm the collider-identity assert goes
   red, restore.
9. **Fire/bedroll/tent** through the same helper (R1).
10. **Dev-panel breadcrumb button.**
11. `npm run verify` (tsc) after each step. **The orchestrator — not an agent — runs
    `verify:chunks --legs=pool-fill,cave-light,cave-walk` ONCE at close** under its own tracked
    background shell (steering THE STALL RULE).

**Rule 8:** the lantern is existing art, so the 5-8 round hero loop does **not** apply. What does
need eyes is a **2-3 round shot loop of three placed lanterns down a real cave corridor at shipping
exposure** via the existing `cave-look` scenario: does a trail read at 17.5 m spacing, and does the
warm `0xffc080` pool fight the cave's cold palette? That is this cycle's visual gate.

---

## 4. Gates — both ride `pool-fill`, no 25th leg

`pool-fill-<seed>` (×2 seeds, **parallel/non-solo**, est 4 min) is the only existing leg that
already boots a cave, performs a real KCC crossing underground, **and** exercises inventory +
interaction (E fills canteen/jerrycan). Precedent for two probe lines in one leg: `chunk-perf`
prints both `CHUNK-PERF` and `CAVE-BUILD`, parsed by one `row(m, out)`.

### Gate A — `LANTERN-RT` (round-trip + leak canary), +~1.5 min/seed

1. **Underground placement lands on the cave floor.** Place through the shipped path at a real
   chamber floor point; `castDown` from the placed Y hits within 5 cm **and the hit collider handle
   is the CAVE BODY, not the terrain heightfield** (collider identity — the rule-9 idiom
   skyfall-walk already uses). *Red-proof: revert to `terrain.heightAt` → Y off by tens of metres,
   identity = terrain sheet.*
2. **It is actually lit.** `lantern.light !== null`, `intensity > 0`, and the light's world Y is at
   the lantern, not parked at `PARK_Y = -10000`.
3. **Walk away and back with the REAL KCC** (≥25 m down the corridor and return — **not** a
   teleport; teleported waypoints lie, per the `leviathan-walk` lesson). Still present, still lit,
   position unmoved.
4. **Retrieve through the real path.** Drive the RMB hover → `packUpLantern`; `lantern_kit` count
   returns to the pre-place value, `ctx.lanterns.list.length` to baseline, **and the pool slot is
   released** (`pool.inUse` count back to baseline — the cycle-6 pool-source-detach precedent).
5. **Save/reload survival.** Place → `save()` → `load()` → same world position (Δ < 1 cm), live pool
   light, **and `SAVE_VERSION === 18` asserted** so a stray bump reds this gate.
6. **Cap + refusal.** Place N+1 → the extra is refused, list stays at N, a reason is emitted.
   Vacuous guard: `placed === LANTERN_MAX_PLACED` or FAIL.
7. **Leak canary.** After teardown: pool `inUse`, `ctx.lanterns.list.length`, and scene child count
   all back to baseline.

### Gate B — `CAVE-COLD` (the clamp, with teeth), +~30 s/seed

Pure numeric sweep, no rendering.

1. **The sweep.** depth ∈ {0,5,10,20,30,40,55} m × kind ∈ all 5 × wet ∈ {0,1} × time ∈
   {noon, midnight} × startTemp ∈ {+1, 0, −0.5, −0.99}: drive `updateStats` for a simulated 30 min at
   the shipped dt, recording `minTemp` and `coldDamageTicks`.
   **PASS = `minTemp > CAVE_COLD_FLOOR − 1e-6` AND `coldDamageTicks === 0` in every cell.**
2. **Corollary (b).** Every `startTemp = −0.99` cell must end **strictly warmer** than it started.
3. **Surface byte-parity.** `depth = 0` cells reproduce a committed baseline temperature-trace
   digest exactly. A cave change that moves the surface survival model is a bug.
4. **Vacuous-pass guard.** FAIL if `max|minTemp|` over the sweep is < 0.05 (nothing ever got cold) or
   fewer than 5 depths were visited. *"Green because the cold never fired" is the exact failure mode
   cycles 5 and 8 both hit.*
5. **RED-PROOF, demonstrated before the fix ships green.** `CAVE_COLD_FLOOR = -1.4` → the 55 m cells
   must report `minTemp <= -1` with `coldDamageTicks > 0` → RED. Output recorded in the cycle log.
6. **Legibility bounds** (cheap): max-depth steady state below `−COLD_VIGNETTE_THRESHOLD` (0.3) so
   the blue tint reads, and above `−HEALTH_REGEN_TEMP_MAX` (0.5) so regen still runs (unless Q6 says
   otherwise).

### Cost statement (EFFICIENCY WATCH #1)

Both ride a **parallel, non-solo** leg at +~2 min/seed. The parallel phase's critical path is the
solo `cave-kinds` at ~25 min, so the effect on the ~55-min suite wall is **≈ 0**. **Zero new legs.**

---

## 5. Risks

- **R1 — every OTHER placeable is broken underground too, and the fire one matters.**
  `fire.ts:189`, `bedroll.ts:110`, `tent.ts:267`, `sled.ts:395` all use `terrain.heightAt`. **A fire
  is the cave cold's counter** (branch 1 pre-empts everything). If you cannot place a fire in a cave,
  the "make camp down here" answer to the cold does not exist and the cold is a mood with no verb.
  **Treat the fire fix as in-scope, not optional** (+6 LOC).
- **R2 — the battery cost fights "breadcrumb trail."** Recipe 12 costs **1 battery** + wiring +
  scrap + cloth, and battery is deliberately the scarcest material (Scavenger's Economy). Six
  breadcrumb lanterns = six batteries. The intended loop is the **retrievable leapfrog** (2-3
  lanterns, picked up behind you) — which the shipped RMB pack-up already supports. **Do not touch
  the recipe:** economy numbers are a morning gate and are never baked autonomously. Surface it.
- **R3 — this changes an existing survival behaviour, not just adds one.** A player who freezes to
  death in a cave at night today will not any more. Strictly the direction Zach asked for, but it is
  *more* than "colder" and must be stated plainly in the ship note.
- **R4 — `cave-light` (cycle 10) is a rig scenario, NOT a permanent leg.** Cycle 11 edits
  `caveAtmosphere.ts`, the exact file cycle 10's day-invariance guarantee lives in. **Land
  `cave-light` as a leg while the file is already open** — cheapest moment there will ever be (Q10).
- **R5 — placed lanterns survive cave eviction** (scene-direct, by design, so player property is not
  destroyed). Bounded by the new cap; the leak canary asserts the bound. Left as-is for cycle 11 —
  despawning the player's own lantern is the worse failure.
- **R6 — `updateLanterns` writes intensity every frame for every placed lantern regardless of
  distance.** Harmless at a cap of 6 (G5), but if the cap is ever raised past ~12, add a distance
  gate before it becomes a real per-frame cost.

---

## 6. Q-list for Zach — every one has a recommended default

| # | Question | **Recommended default** |
|---|---|---|
| **Q1** | Does a placed lantern **burn down / drain** while placed? | **NO.** lantern.ts's contract and the item description both say "never burns out"; the torch is the consumable clock, the lantern is the permanent marker. A breadcrumb that silently dies strands you — the same reasoning the hazard spec used to forbid extinguishing your light. |
| **Q2** | **How many** placeable at once? | **6** (`LANTERN_MAX_PLACED`). Pool is 30, shared with fires / the leviathan interior / panel glows; 6 breadcrumbs a full branch with headroom. |
| **Q3** | Retrieve **instant RMB** (today) or a hold? | **Keep instant RMB.** It is the shipped idiom for every camp placeable, and a hold on a marker you retrieve six times per descent is friction with no upside. |
| **Q4** | Does a placed lantern **warm** you? | **NO.** You didn't ask for it; fires are heat, lanterns are light. Keeping them distinct preserves the "carry fuel to camp deep" beat. One line to flip if you want it. |
| **Q5** | Cave cold **target at max depth**? | **−0.45 at ~50 m** (vignette on at 0.3, regen still runs under 0.5, floor −0.55, damage line −1 → 0.45 of margin). Alternatives: −0.30 (barely reads) / −0.60 (suppresses regen deep). |
| **Q6** | Should the deep **suppress health regen**? | **NO** — that is exactly why the target is −0.45 rather than −0.55. Raise the target magnitude to flip it. |
| **Q7** | Does the cave **warm** a freezing player who descends at night? | **YES.** Physically true (a cave sits near the local mean annual temperature), and it is the only way to make "never damages" *total* rather than conditional. Bonus: caves become night shelter — a free reason to descend. |
| **Q8** | **Per-kind** cold multipliers? | **flooded ×1.25** (wet reads colder) · **shaft ×1.10** · **fungal ×0.75** (the hazard spec's sanctuary idea, surviving stripped of damage) · canonical/warren ×1.00. All on the **target**, all re-clamped — no stacking can escape INV-COLD. |
| **Q9** | Fix underground placement for **fire / bedroll / tent** too? | **YES** — see R1. Without a placeable fire, the cold has no answer underground. |
| **Q10** | Land **`cave-light` as a permanent leg** this cycle? | **YES.** Cycle 11 edits the file cycle 10's guarantee lives in; this is the cheapest moment it will ever be. |

*Unanswered ⇒ every default above is taken — which by construction means nothing underground can
damage the player, and no economy number moves.*
