# Campaign log — Dustfall · "DEEPER" (started 2026-07-24)

Newest cycle at top. Prior campaigns archived alongside
(`campaign-log-underworld-DONE.md`, `campaign-log-sharpen-deepen-DONE.md`, …).

Charter: [campaign-deeper.md](campaign-deeper.md) · Walk-test source of truth:
[cave-walktest-2026-07-24.md](cave-walktest-2026-07-24.md) · Steering: [steering.md](steering.md)

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
