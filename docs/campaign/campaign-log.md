# Campaign log — Dustfall · "DEEPER" (started 2026-07-24)

Newest cycle at top. Prior campaigns archived alongside
(`campaign-log-underworld-DONE.md`, `campaign-log-sharpen-deepen-DONE.md`, …).

Charter: [campaign-deeper.md](campaign-deeper.md) · Walk-test source of truth:
[cave-walktest-2026-07-24.md](cave-walktest-2026-07-24.md) · Steering: [steering.md](steering.md)

## Cycle 3 — surface character restored; the seed net proven 6/6 (2026-07-25) — SHIPPED

- **Planned:** re-run the two cycle-2 probe hangs · restore the carved-rock read the shell kit had,
  iterating on the REAL torch-lit view, without regressing the void gate or the 32° slope ceiling.

- **TASK A — the two hangs did NOT reproduce; the seed net is 6/6.** `cave-walk` seed 99 = PASS,
  10/10 chambers, full Euler tour, `ascent=OUT`, **max slope 21.1°**, fails=0, digest `a6e21544`.
  `cave-void` seed 2024 = **0/8160 escapes (0.00%)**, 85/85 points clean, `excused=1`, `frontEsc=1`.
  Both ran first-try on a machine with no special preparation. Cycle 2's read ("harness, not
  generator") is now supported by evidence rather than inference. Recorded as a **flake**, not a fix:
  nothing was changed that would explain it, so if it recurs it is still unexplained.

- **THE DIAGNOSIS BEHIND THE REGRESSION, measured.** Cycle 2 called the new surface "smoother and
  softer". The real causes were three, and only one was the shading model:
  1. **Flat vs smooth shading** — real, and the smallest of the three.
  2. **THE SMOKE MOTTLE (the actual reason the cave read as fog).** `caveVertexColor` picked its role
     with a HARD threshold on the surface normal (`up > 0.55` floor / `up < -0.4` ceiling). On the
     SDF surface the normal carries the rock displacement, so adjacent vertices across a bumpy
     ceiling flipped between 'wall' and 'ceiling' — a **×0.58 value step applied per-vertex at
     random**, interpolated into grey-brown smoke. This was a genuine bug, not a taste issue.
  3. **The 0.45m voxel floor on detail.** The third displacement octave (1.2m) sits under Nyquist for
     a 0.45m grid, so surface nets smooths it away: **the surface cannot carry ANY detail below
     ~1.2m**, and at torch range (1-2m) the wall was a featureless blob no matter what the SDF did.

- **What shipped**, in the order the shots forced it:
  - `_caveSurface` is **`flatShading: true`** again (the direct analogue of `_caveShell`).
  - **`CAVE_SDF_MICRO_*`** — a small un-attenuated relief term (0.075m at ~2.5m ≈ 5.5 voxels). The
    big octaves are floor-attenuated to zero (cycle 2's 32.4° fix, preserved), which left walkable
    floors *geometrically planar* — a flat-shaded plane has one normal and reads as brown mud. Sized
    so its own worst-case gradient is ~6° and it cannot approach the 32° ceiling on a 22° ramp.
  - **Smooth role weights** — `caveVertexColor` takes the raw normal Y and ramps the ceiling/floor
    contributions with a smoothstep; the ceiling darkening went ×0.58 → ×0.70. Kills the mottle.
  - **Sharper strata** — two band scales (7.4m formation + 2.0m bedding), each through a power curve
    so a band reads as a layer with an edge; contrast roughly doubled; fine grain added everywhere.
  - **Floor sediment rebalanced** — one 10m blob at 0.9 strength (the "mudflat") → 0.72 broken by a
    3m octave, so it reads as drifts between exposed rock.
  - **`CAVE_ROCK_BUMP` — sub-voxel rock relief as a normal perturbation** in `_caveSurface`'s
    `onBeforeCompile` (hashed 3D value noise, 2 octaves at 0.6m/0.22m, forward-difference gradient,
    world-space, rolled off by `fwidth` footprint). **Zero triangles, zero collider change, one
    program, one uniform.** Halving the voxel was the alternative and was rejected on cycle 1's own
    numbers: 0.35m = 113.6k tris / 1509ms against a streaming budget that is already the campaign's
    flagged risk — for detail still only ~0.9m.

- **ROUND-BY-ROUND** (all on seed 1337; the fast `cave-look` scenario — see below):
  | round | change | what the shot showed |
  |---|---|---|
  | R1 | `flatShading: true` | Walls/ceilings got facets — real gain. **Floor still a featureless wash**, and now inconsistent with the faceted walls. |
  | R2 | micro-relief + sharper strata + sediment rebalance | Floor gained relief and value break-up. Still read as smoke — and the shot showed *why*: blotchy grey mottling on the upper walls. |
  | R3 | smooth role weights + **re-framed the torch shots** | Mottle gone. The re-framed `dark-torch-hall` (the real in-game read) exposed the actual problem: **at torch range the wall is completely featureless.** |
  | R4 | shader bump v1 — sum of directional sine waves | **FAILED loudly.** Even domain-warped, six waves resolve into oriented **zebra banding**; it read as wood grain. Recorded in the source so it isn't retried. |
  | R5 | replaced with hashed value noise, strength 0.16 | Isotropic — but invisible. Over-corrected. |
  | R6 | strength 0.50 | Still barely there. |
  | R7 | strength 2.20 (diagnostic) | Works, clearly too strong: splotchy dark blobs, speckle at range. |
  | R8 | **strength 1.15 — landed** | Floor has genuine grain and drift structure; the torch-lit wall has real ledges and recesses; the dais no longer out-reads the cavern. |

- **⚠ HONEST VERDICT vs the shell baseline — better in the near field, still weakest on ceilings.**
  The near/mid read (floors, walls at torch range, the dais surround) is **better than the shell
  baseline**, and it is better on a surface that is also watertight, which the shell never was. The
  **ceiling is still the weak element**: it reads as a dark smoky band rather than as rock with
  structure — the mottle bug is fixed, but a ceiling seen at 8-15m through the distance roll-off has
  little left to look at, and the finest bump octave still speckles slightly at range. Call it
  **~80% there on ceilings**, good on everything else. Also unresolved: the overall value contrast is
  still lower than the shell kit's, most visible in the wide diagnostic shots.
- **⚠ PERF RISK, flagged not assumed away:** the bump is ~8 value-noise evaluations (≈64 hashes) per
  cave fragment. Confined to one program and distance-faded, but unmeasured on a low-end GPU.
  `CAVE_ROCK_BUMP: 0` disables it with no other change.
- **Harness:** new **`cave-look`** rig scenario — the `cave-walk` shot set (now a shared
  `caveShotSet`, so the framings are byte-identical) with the ~4-minute KCC march skipped. That is
  what made 8 rounds affordable inside one cycle. The two `dark-torch-*` framings were fixed: the
  torch used to sit at the camera aimed across the hall's open middle, so its pool fell out of frame
  and the shot was near-black — **it could not judge anything**, which is why cycle 2's regression
  was described from the rig-lit shots only.
- **Constraints held:** entrance untouched (cycle 4) · room-graph layout logic untouched · collider
  still baked from the same triangles.
- **GATES.** `npm run verify:all` **GREEN**, every leg. `cave-void` **0/8160 (0.00%)** seed 1337 and
  **0/7392 (0.00%)** seed 7, **`excused=0` on both** (cycle 2 was 0-1). `cave-walk` 11/11 and 10/10,
  `ascent=OUT`. **Max corridor slope 1337: 22.3° → 24.8°** — the micro-relief costs ~2.5°, inside the
  ~6° it was sized for, and leaves **7.2° of margin** under the 32° ceiling. Named, not buried: the
  budget for future un-attenuated relief is now smaller than it was.
- **`caveDigest` re-baselined by construction** (the micro-relief moves vertices): 1337
  `fe884530` → **`82a66e57`**, 7 `da185721` → **`3eb21a1a`** — both **stable ×2**, cross-seed
  distinct. Body tris 1337: 67,418 → 89,199 whole-cave (the micro-relief adds sign changes).
- **Commit:** `e0ed864`. **Next:** cycle 4 — the crevice entrance (D-1).

## Cycle 2 — the watertight surface is THE cave; the shell kit is deleted (2026-07-24) — SHIPPED

- **Planned:** make cycle 1's SDF remesh the only meshing path · delete the shell kit · re-bake the
  collider from the same triangles · fix the 32.4° corridor · re-baseline `caveDigest` · 6-seed
  sweep · wire `verify:cave:void` into `verify:chunks` · measure the Rapier trimesh bake.

- **Switched + deleted.** `FEATURES.caveSdf` is RETIRED (nothing left to select between); the cave
  body is always `buildCaveSdf`. `VITE_CAVE=0` kill-switches exactly as before. Removed from
  `caveGen.ts`: `buildChamberGeometry`, `buildCorridorGeometry`, `rockDisp`, the `Carve` interface +
  `carveByNode`/`addCarve`, the `_caveShell` BackSide material, and the duplicated palette (the one
  copy now lives in `caveSdf.ts` as the exported `caveVertexColor`, used by the dais + speleothems).
  Also removed the tuning keys that only the shells read (`CAVE_GEN_CHAMBER_RINGS/SEGS`,
  `CORRIDOR_RINGS/SEGS`, `END_OVERLAP`, `DOORWAY_H`, `FLOOR_FILL`, `CHAMBER_FLOOR_DROP`) and
  rig-shot's `--sdf` selector. `caveGen.ts` 1176 → 837 lines. The room-graph layout logic is
  untouched, as required.

- **THE 32.4° CORRIDOR — root-caused, and it was NOT the smooth-min.** Cycle 1 guessed smooth-min
  rounding. Measured: cycle 1 attenuated the rock displacement by height above `Prim.floorY`, which
  for a corridor was `min(fa, fb)`. On a **descending** corridor the shallow half therefore read as
  "6m above the floor" and took the FULL ±0.95m multi-octave displacement **through its walkable
  floor** — dy-0.8m over a dx-1.2m sample baseline = 33°, exactly the reported figure. Fixed by
  keying attenuation to the LOCAL ramp floor (`_localFloor`, a side-channel out of `primDist`).
  Seed 1337 **32.4° → 22.3°**. The smooth-min blend is ALSO now floor-attenuated
  (`CAVE_SDF_SMOOTH_FLOOR` / `_BAND`) — belt-and-braces, and correct in its own right. The 32°
  ceiling was never touched.

- **The gate is permanent AND has teeth.** `verify:cave:void` is now a leg of `verify:chunks`, so it
  runs in `verify:all` every session. Two anti-laundering guards, because "green because it measured
  nothing" would have been the worst outcome of this cycle: (1) a **vacuous-pass guard** on both the
  in-page probe and the harness — under 40 sample points / 3840 rays is a FAIL, not a pass;
  (2) the **puncture proof** — `--puncture=25` deletes ~25% of the surface's triangles in-page and
  the gate goes RED (seed 1337: **1837/8160 = 22.51%**, `pass=0`, holes=1806). Re-runnable any time.

- **Collider = the visual triangles, only path** (rule 9): the trimesh is baked from the SDF surface
  + dais + collider-bearing speleothems, and `colliderTris` is now reported so the identity is
  visible in the probe line.

- **THE STREAMING NUMBER (cycle 1 deferred this to cycle 4 — measured now).** At voxel 0.45m,
  seed 1337: 67,418 body tris (70,322 baked incl. dressing). **Rapier trimesh bake = 68.2 ms.**
  Polygonization = 992 ms (field 553 / nets 410). So the collider is ~6% of the build cost and is
  NOT the streaming blocker — the polygonizer is, and it is the sliceable half (pure per-block loop,
  zero cross-block state, the S6/D296 pattern). That materially de-risks cycles 4 and 7.

- **⚠ HONEST VISUAL VERDICT — a partial REGRESSION in surface character, reported despite a green
  gate.** The fundamental read is enormously better: the egg chamber used to be a dais and
  speleothems floating in pure black void (that IS D-2), and is now a continuous enclosed cavern
  with floor, walls, ceiling and a light pool. But the new surface reads **smoother and softer**
  than the shell kit's: `_caveShell` was `flatShading: true` (crisp carved facets) and the SDF
  surface is smooth-shaded, so strata banding and the multi-octave knobs read as broad soft washes
  instead of rock. The flat-shaded dais in the same frame now looks MORE like rock than the cave
  around it. Not fixed here (cycle 3 is the entrance; cycle 5 is the visual reassess) — logged as
  the first item of that pass. Evidence: `verification/scen-cave-walk-{egg,hall}.png` vs
  `verification/baseline-shell/` (same shots, shell path, preserved for the comparison).

- **THE 6-SEED SWEEP** (the widened net the cycle demanded — Underworld hid two generator defects
  behind 2 seeds):

  | seed | `cave-void` | `cave-walk` | max corridor slope |
  |---|---|---|---|
  | 1337 | 0 / 8160 escapes (0.00%) | PASS 11/11 chambers, ascent=OUT | 22.3° |
  | 7 | 0 / 7392 (0.00%) | PASS 10/10, ascent=OUT | 22.5° |
  | 42 | 0 / 6624 (0.00%) | PASS 9/9, ascent=OUT | 21.0° |
  | 99 | 0 / 7392 (0.00%) | not completed (probe hang, see below) | — |
  | 2024 | not completed (probe hang) | not completed | — |
  | 555 | 0 / 5856 (0.00%) | not completed | — |

  `excused` is 0 or 1 everywhere — nothing is laundered through the declared-opening allowance.
  **⚠ OPEN: two probe runs (walk 99 / void 2024) hung** with the machine at 25% CPU after ~30 min,
  twice, including once alone on a reaped machine. Not reproduced as a *generator* fault — the same
  seeds pass the other gate (void 99 = 0.00%) — so the current read is probe/harness, not cave. It
  is NOT proven, and it is the first thing cycle 3 should re-run before trusting the far seeds.

- **`caveDigest` re-baselined** (the SDF changes it by construction): 1337 `fe884530`, 7 `da185721`,
  42 `ac136278` — same-seed **stable ×2** (`verify:chunks` runs each seed twice), cross-seed distinct.
- **`npm run verify:all`: GREEN**, every leg, including the new `cave-void` leg inside
  `verify:chunks` (seeds 1337 + 7, 0 escapes each).

- **Commit:** `c5f0a35`. **Next:** cycle 3 — the crevice entrance (D-1).

## Cycle 1 — D-2 diagnosis + the void-ray gate + the SDF remesh prototype (2026-07-24) — SHIPPED

- **Planned:** confirm the D-2 root cause with a real probe · land a see-through gate demonstrated
  RED on the broken cave · prototype the watertight remesh on one seed with real cost numbers.

- **⚠ THE DIAGNOSIS WAS PARTLY WRONG — measured, then corrected.** The pre-cycle hypothesis
  (interpenetrating zero-thickness BackSide shells) is real but accounts for only ~15-18% of the
  leak. **The dominant cause is inverted winding**: `buildChamberGeometry` emits inward-facing
  normals while corridor tubes are wound outward, and both share `_caveShell` (`side: BackSide`).
  So `BackSide` culls exactly the faces you stand behind — **a room's own walls and floor are
  invisible from inside that room** (74.6% chamber escape; the egg-chamber centre leaks 88/96
  rays, 3/96 when forced FrontSide). Corridors are wound the other way, which is why the cave read
  as half-plausible rather than absent. Only 4.0% of rays escape even with `DoubleSide` forced.
  **The prescribed fix is unchanged** — one watertight surface is consistently wound AND seamless,
  killing both classes. Flipping the chamber side was explicitly rejected: it would drop the number
  while leaving paper shells + carve gaps (rule 7).

- **Shipped:**
  - `scripts/verify-cave-void.mjs` + the `cave-void` rig scenario — 85 eye-height sample points
    (chamber centres + 4 offsets, 3 per corridor axis) × 96 Fibonacci-sphere rays, raycast against
    the cave mesh set honoring `material.side`. Declared-opening allowance reads
    `userData.intendedOpening` exactly as `verify-solid.mjs:268` does. `npm run verify:cave:void`.
  - **Demonstrated RED on the shipped cave**: seed 1337 **4373/8160 escapes (53.59%)**, 84/85
    points leaky, `excused=0`; seed 7 3926/7392 (53.11%), 77/77 leaky. Nothing laundered through
    the opening allowance.
  - `src/world/caveSdf.ts` — the remesh prototype behind `VITE_CAVE_SDF` (default OFF, shipped path
    untouched). **Naive surface nets**, not marching cubes: no slivers on near-tangent corridor
    cells, ~35% fewer tris at equal resolution, manifold by construction. Displacement moved INTO
    the SDF (narrow-band, 3 world-space octaves); `role` now derives from the normal, which is
    correct on overhangs where the old lat-long test never was.
  - **Gate result on the prototype: 53.59% → 0.00%.** `excused=0`, and `frontEsc=0` too — correct
    from either side declaration, which is the real proof the winding is now consistent.
  - The builder also ran `cave-walk --sdf` unprompted, because a *sealed* cave would pass the void
    gate while being unreachable — the exact "gate measuring the wrong thing" failure. It doesn't:
    11/11 chambers, full Euler tour, `ascent=OUT`.

- **Cost measured (seed 1337, cave body):** 0.65m → 32.5k tris / 317ms · **0.45m → 68.4k tris /
  814ms (recommended)** · 0.35m → 113.6k tris / 1509ms. Shell baseline ~13.5k tris. Field eval and
  net extraction split cost ~50/50, both linear in voxel count.
- **⚠ STREAMING FLAG (loud, not a stop):** 814ms synchronous ≈ 49 frames of hitch — unacceptable
  as written for "several caves resident". Sliceable on the S6/D296 pattern with **no algorithmic
  change** (the field pass is a pure per-block loop with zero cross-block state). Per-kind
  resolution (far caves 0.65m, hero egg cave 0.45m) buys another ~35%. **The unknown that could
  actually change the plan is the Rapier trimesh bake cost at 68k tris — not yet measured.**
  Cycle 4 must measure the collider bake, not just the polygonizer.

- **Verify:** `npm run verify` (tsc) clean; `verify:all` re-run at batch end (default path unchanged
  — the prototype is flag-gated OFF).
- **Visual iteration:** N/A this cycle (diagnostic + prototype). The remesh's *look* is cycle 2-3.
- **Known residual for cycle 2:** corridor 1–2 measures 32.4° against the 32° ceiling — smooth-min
  rounding shaves the ramp start. Named and marginal, not hidden.
- **Commits:** `db8082a` (diagnosis + gate), `7af419f` (SDF prototype).
- **Next:** cycle 2 — the full watertight build-out: 6-seed sweep, collider re-bake as the only
  path, delete the shell path, re-baseline `caveDigest`, fix the 32.4° corridor, wire
  `verify:cave:void` into `verify:chunks`.

## Cycle 0 — campaign started (2026-07-24)

**Goal:** turn the underworld from a beautiful place with one errand in it into a *system* —
repaired first, then given variety, danger, water, and a reason to descend twice.

**Branch:** `campaign/2026-07-24-deeper` (from `master` @ e9f75b5). **Push HELD.**
**Ceiling:** 10M tokens / 20 cycles. **Checkpoint policy:** milestone.

**Why this campaign exists.** The Underworld ship (2026-07-20) merged with Zach's walk-test
feedback unrecorded — the docs said "feedback pending" for four days. Collected 2026-07-24 and
root-caused against the code the same day:

- **D-1 — the entrance is still the greybox.** `caveTest.ts` still carries its own
  "cycle-1 ENABLING TECH only — greybox geometry" header; it was never replaced. Ships as a
  29.2m × 8.34m × 12m snapped trench + slab ramp (~22°). Zach's "massive ramp" read is literal.
  Wanted: a **crevice** in a rock outcrop, tight and committing.
- **D-2 — see-through interior walls and floors.** Root cause found: the cave is N separate
  **zero-thickness `BackSide` shells that interpenetrate** (chamber ellipsoids + corridor tubes,
  `caveGen.ts:951`, `CAVE_GEN_END_OVERLAP` 1.2m). Stand in a chamber, look at a corridor — you're
  outside that shell, its faces cull, and with no thickness there's nothing behind them. Rule 7,
  never applied to the cave kit. Fix: **one watertight surface** (SDF → marching cubes over the
  existing room-graph). `DoubleSide` explicitly rejected as a symptom-hider.
- **D-3** — reassess + adversarial sweep afterward.
- **D-4** — preload caves at the loading screen; slice streamed cave builds.

**Zach's kickoff calls:** 10M/20 · **no creature underground** (environment-only danger) ·
**caves are a regular rocky-terrain feature**, not a rare landmark · **water pools promoted to
cycle 6**, the first new-content cycle.

**Ladder:** 1 void-ray gate + D-2 spike → 2 watertight remesh → 3 crevice entrance →
4 preload/gen-budget → 5 reassess **→ repair descent (Zach)** → 6 water → 7 density → 8 kinds →
9 hazards → 10 light budget → 11 return reason → 12 integration **→ final descent (Zach)**.
Cycles 1-5 are never cut.

**Flagged at launch:** "caves are common" breaks an assumption in D307 — the entrance collider
swap was specced and gate-proven for exactly ONE cave. At rocky density it becomes a routine
streaming event with multiple resident interiors. Cycle 7 must prove swap cost, teardown symmetry,
and a resident cap rather than assume them; the fallback is clustered cave country, surfaced as a
scope-cut, never taken silently.
