# Campaign log — Dustfall · "DEEPER" (started 2026-07-24)

Newest cycle at top. Prior campaigns archived alongside
(`campaign-log-underworld-DONE.md`, `campaign-log-sharpen-deepen-DONE.md`, …).

Charter: [campaign-deeper.md](campaign-deeper.md) · Walk-test source of truth:
[cave-walktest-2026-07-24.md](cave-walktest-2026-07-24.md) · Steering: [steering.md](steering.md)

## RESUMED (2026-07-27) — Zach: /campaign-start --resume, after the pace review

The pause gate is cleared. Per the approved efficiency plan: the tiered/parallel gate runner is
the first act (EFFICIENCY WATCH standing directive now in force in steering.md), then cycle 9
finishes (entrance headroom fix → kinds look pass → shaft/1337 apron flake → close).

## PAUSED mid-cycle-9 (2026-07-27) — Zach: "ok need to pause cleanly here"

Cycle 9 state at the pause (`c8fab5a`, tree clean, in-flight agent stopped pre-edit):
- **DONE + committed:** the four-kind table (warren/fungal/flooded/shaft) over the canonical
  generator with machine-asserted safety invariants; seed-pure kind assignment (placement digests
  untouched); distribution proven ×3 seeds; 9/12 kind marches green with 0 strands everywhere;
  a real void-gate mis-sampling fixed (+ puncture-red re-proof); the warren's scrap scatter (6
  plain scrap, transient, loot digest untouched — Zach's number); the `cave-kinds` gate as
  verify:chunks leg 13; the lattice snap (latent-coupling fix, origin digests re-baselined
  108af91c→d8f15005 / ff8309a8→99e0015b, surface+density digests unmoved).
- **REMAINING (cycle 9 finishes on resume):** (1) the **pre-existing entrance headroom defect**
  — at some streamed sites the roofed fissure pinches to 1.17-1.44m clear height vs the 1.70m
  capsule: those caves cannot be entered. Kind-independent (canonical A/B fails identically);
  the grid-origin theory was falsified by measurement; the guard-sweep fix proven a no-op; the
  `crevice-profile` instrument + measured deficits + four shortlisted levers are in the c8fab5a
  message. The cave-kinds seed-1337 leg stays deliberately RED until this is fixed. (2) The
  per-kind rule-8 look pass (12 smoke shots exist). (3) The flaky shaft/1337 apron steering.
- **Two process notes from tonight worth keeping:** the 4242 lesson (one flaky-gate sample is
  not evidence — n≥5 per tree) was applied again when the grid-origin diagnosis was falsified
  by A/B measurement before any churn shipped; and the density/kinds gate-widening philosophy
  paid for itself three times (the tile-clamped hole, the 1.6s cold-shader frame, the headroom
  pinch — all found by widening, none by the original nets).

**Resume:** `/campaign-start --resume` then `/loop /campaign-cycle`. **Owed: Zach's repair
descent walk-test** — cycles 6-9 changed pools, interior rendering, entrance geometry, density,
and kinds; his next descent judges the whole stack. Parked decisions listed in
[next-session-prompt.md](../next-session-prompt.md).

## Cycle 8 — caves are a rocky-terrain feature: the D307-at-density proof (2026-07-27) — SHIPPED

- **Planned:** the charter's density cycle — caves roll off the chunk descriptor in rocky terrain
  at real density; the three flagged D307-at-density proofs (swap cost, teardown symmetry,
  resident cap); egg cave unique; origin world byte-identical; the "cave country" fallback only
  ever as a Zach-surfaced scope-cut.

- **Baseline honesty first:** placement was NOT real before this cycle — cycles 5-7 built
  infrastructure; the chunk-perf "8 caves" were synthetic hardcoded-coordinate test placements.
  The game placed exactly one cave (origin/egg).

- **Shipped (`d5b28e8`):** `caveSites.ts` — 460m grid + jitter → 300m spacing by construction,
  rocky-only, relief/POI/landmark rejections, origin protection 1150m (= the POI exclusion, so
  tors can't weld onto boot POIs). Realized density measured: **~3.0-3.4 caves per travel-hour**
  (`CAVE_SITE_CHANCE 0.60` = Zach's dial). **The architectural win:** holed tiles now
  band-decompose into sub-heightfields instead of a full-tile trimesh — measured **80× cheaper**
  (0.3 vs 24.4ms) — buying the invariant *a hole exists iff the cave beneath it is a live
  resident* (the sheet is simply intact until the cave arrives; origin tile keeps the D307
  trimesh path untouched). Teardown proven EXACT (restoreMax 0.0000m; 0 rays through the sheet
  outside the hole; pools/materials/water registries to baseline); re-entry bit-identical.
  **No scope cut needed** — uniform density is perf-safe on foot.

- **Gates widened + two real defects found by the widening:** (1) cave-walk/cave-void extended
  to STREAMED sites as literal reuse (residentKey — not a fork that can drift); 4 sites
  marched/void-swept clean through the real streaming path (0 strands, 0 escapes); permanent
  leg, +~11min. (2) Code-reading found the carved hole CLAMPS TO ONE TERRAIN TILE — ~1.6% of
  sites would ship a visible-but-unenterable cave with every gate green; fixed by construction
  (tile-seam rejection sharing one `rawHoleCells` derivation with the hole block itself).
  (3) The reproducible **1.6-second frame** at seed 7 root-caused to a COLD SHADER-PROGRAM LINK
  on the finalize frame (pool water needs 2 programs; three's program keys carry the live light
  state, so boot-time warming can never match — tried, proven, reverted). Shipped: a warm stage
  in the build scheduler (`compileAsync` off-scene at live state) — **0 programs compiled on the
  visible frame, gate-asserted**; worst frame 1667ms → the known ~155-175ms unsliced tor. Also
  fixed `worstFrameMs f>2` silently skipping the actual worst frame, and a false-positive
  edge-check in the new density gate (the "gate that fails on healthy geometry is the same class
  of error" lesson, written into the check).

- **Verify:** `verify:all` end-to-end ALL GREEN on the final tree — every leg. Origin parity
  byte-stable (`108af91c`/`ff8309a8`); density digests `f180c0fc`/`f95e4986` stable ×2;
  SAVE_VERSION stays 18 (streamed caves descriptor-derived + save-transient, D299).

- **FLAGGED FOR ZACH:** `CAVE_SITE_CHANCE 0.60` (~3.3/travel-hour — the low end of "several";
  1.0 ≈ one per 360m rocky travel, 0.3 ≈ landmark-rare) · the tor is now the worst frame
  (~155-175ms every ~90s of rocky walking; the slicing refactor is the named lever) · streamed
  caves' harvested-fungi state is save-transient (matches D299 streamed-content behavior) ·
  program keys carry the scene light count (engine-wide pre-existing recompile sensitivity —
  fires/lanterns elsewhere; the cave path is now immune).

- **Residuals:** speeder-pace drive unmeasured (foot-pace proven; feeds the density taste call) ·
  the warm fail-safe path untested (no harness browser lacks KHR_parallel_shader_compile) ·
  tile-seam fix has no negative-control seed on the net (by design — rejection removes them).

- **Spend:** ~0.95M this cycle (campaign ~6.15M / 10M; cycle 8/20).
- **Commit:** `d5b28e8`.
- **Next (cycle 9):** cave kinds — distinct parameter sets over the same generator (tight salvage
  warren / vaulted fungal cavern / flooded cave leaning on cycle 6 / collapsed shaft): a kind
  table, not new code paths. Walk/void green across every kind ×3 seeds.

## Cycle 7 — the D-3 reassess: the cave renders, the crevice reads (2026-07-26/27) — SHIPPED

- **Planned:** the displaced D-3 full-tree adversarial visual audit + CAVE_* taste pass, carrying
  five named residuals (ceiling band, value contrast, tor at 78m, sawtooth spikes, ROCK_BUMP perf).

- **The audit instrument first:** a new `cave-audit` rig scenario — 17 player-eye framings ×2
  seeds at true shipping settings (exposure 1.05, real light path via `__game.setCaveRockLight`,
  HUD-masked metrics), + a swiftshader/GPU CAVE_ROCK_BUMP perf A/B with pixel-proofed legs. Two
  fresh critics then produced the cycle's unifying diagnosis: **the entire interior rendered into
  ~18 of 255 output codes** — the "smoky ceiling band" was a hard torch-distance cutoff leaving
  8-15m rock at code 1-4, the "low contrast" was a healthy 8-11× lighting ratio crushed into a 7%
  envelope, the banding was that envelope quantized, and the "leopard" mottle was the only texture
  octave the rock had. Bonus confirmed bug: the sun sprite (depthTest:false) painting an L≈220
  disc on deep-cave rock in upward views.

- **Interior round (`23c29fe`):** rock dither + depth-ramped lit-envelope gain (unlit floor
  bit-identical — the fungi-only no-free-light canary bit-stable at meanL 0.29); 4-octave normal
  field with tilt saturation (the leopard was the old bump OVER-DRIVEN past the normal-flip
  point); bedding strata + near grain; `flatShading` off on the cave body (it was standing in for
  detail that didn't exist); ceiling bounce strictly proportional to carried light (NO new
  PointLight — one uniform; ceilings p95 2.4→13.4 gallery / 7.9 hall); sun-through-rock fixed
  with the surface byte-identical; motes/wind-dust/flashlight-penumbra/speleothem batch. Found
  and properly fixed a pre-existing slicer laundering hazard: atomic stages were billing work to
  the divisible budget (now 15.3ms, better than baseline — proven against a pristine worktree,
  not blamed on machine load).

- **Entrance round (`23c29fe`):** sawtooth comb fixed by construction (relief out-slopes the
  voxel grid + lateral wobble, widths compensated); the "roof lamina" root-caused as the TERRAIN
  SHEET overshooting the carved hole by 7cm (closure moved inside + ROOF_UNDER clamp — 6.8m of
  real rock above the lintel now); 78m findability met by silhouette not value (seed-pure horn +
  fin shoulders; arc 1.9°→4.1° / 2.7°→5.5°, the notch survives); apron/aperture/sky-rim reshaped;
  the deepest fix was cycle-4's `projectSlot` nearest-segment discontinuity (the true source of
  the lintel blade thicket) replaced with a softmin; a guaranteed arrival fungi cluster near the
  hand-off on its own rand stream. The margin lesson re-learned safely: two clearance approaches
  that moved the whole cave were caught by gates and replaced with `CREVICE_ROOF_DROP`.

- **The 4242 episode (a process lesson recorded honestly):** the entrance round's wide-net run
  flagged seed 4242 failing cave-walk; the orchestrator "proved" it introduced-vs-pre-existing
  with ONE pristine-worktree run — a lucky sample. The follow-up agent falsified the premise
  properly (5+10 runs: flaky on BOTH trees at the same rate), refused to build the hypothesized
  speleothem fix whose reasoning was also wrong, and instead fixed what the flake exposed: the
  march gate could not fail a stranded REVISIT leg (silent blind spot → misdiagnosis 60m away).
  Now every run prints `strands=N`, and it immediately made a genuine pre-existing wedge trap
  visible on green runs. One flaky-gate sample is not evidence; n≥5 per tree is the floor.

- **Verify:** tsc clean · `verify:chunks` 20/20 legs green (walk 11/11+10/10 stable ×2, void
  0/8160+0/7392, pool-fill, preload ON/OFF, perf, skyfall/leviathan/ribcage/dune unmoved) ·
  wide net 4242/99/2024/31337 all `ascent=OUT fails=0` · the speleothem envelope assert PROVEN
  able to fire (clamp deliberately broken → loud abort → reverted).

- **Visual iteration:** interior ~8 rounds, entrance ~9 rounds incl. 4 falsified hypotheses on
  the lintel slivers; both agents A/B'd against the audit framings throughout.

- **FLAGGED FOR ZACH:** ~20 new CAVE_*/CREVICE_* taste dials (legibility gain, bounce, strata,
  horn) — the darkness READ is preserved but the lit rock is far more legible; swiftshader rock
  cost 15-22% (real GPUs: inside noise; levers named in tuning.ts); pocket-9 wedge trap at seed
  4242 (pre-existing on master, digest-moving to fix); `floorOk` margin under-bounds the true
  speleothem silhouette (pre-existing, digest-moving); motion feel (bounce flicker, dither crawl,
  crevice commitment beat) is walk-test territory.

- **Residuals carried:** entrance apron outer shelf still flat-ish with a hard sand rim (terrain
  blend, not tor); 1-3 sub-voxel slivers at the lintel at 3.5× zoom; the horn slightly
  needle-like; the descent below the tor's footprint keeps 0.45m-voxel facets; `ceil-hall` p95
  at the bottom of target; `CREVICE_COVER_CLEAR` under-sized but only binding off-net (named in
  tuning.ts, belongs to a graph-re-baselining cycle).

- **Spend:** ~1.55M this cycle (campaign ~5.2M / 10M; cycle 7/20).
- **Commit:** `23c29fe`.
- **Next (cycle 8):** the charter's density cycle — caves as a regular rocky-terrain feature
  (streamed entrances, resident cap, exact teardown, the D307-at-density proof), egg cave stays
  unique. The clustered-"cave country" fallback remains a Zach-surfaced scope-cut, never silent.

## Cycle 6 — UNDERGROUND WATER, volume tier: pools + the jerrycan (2026-07-26) — SHIPPED

- **Planned:** the charter's cycle-6 spec at the VOLUME tier (Zach's kickoff call): seed-pure pools
  in chamber floor dips + a larger vessel that only fills at real bodies of water.

- **Systems (`d717a9a`):** `src/world/cavePools.ts` (new) — pools scored on the SAME
  `caveFloorSediment` signal the floor tint uses (extracted so placement and the visual read can
  never drift), 1-3 per cave, ≥1 guaranteed, excluded from corridor mouths and the egg dais (a
  real seed-1337 defect: a pool overlapped the dais — fixed by construction, `eggDaisRadius` now
  shared). Water surface has NO collider; the collider is the visible SDF bottom (probe: delta
  0.0000m, 0 frames standing on water). Pool sources publish via `caveStream.setPoolSink`, detach
  before `disposeResident`. **Jerrycan**: craft-only (recipe 24: scrap ×3 + metal_pipe ×1 +
  cloth ×1), 4× canteen capacity, fills ONLY at pools — wells refuse diegetically. Pool audio:
  splash-tailed drips + a proximity lapping bed. Loot registry untouched (digest baseline intact);
  SAVE_VERSION stays 18.

- **Hero visual (rounds 1-13, `f388194`):** the builder's 11-round pass was then FAILED by a
  3-critic adversarial panel (identity, craft, code) with measured findings — the surface shaded
  as a lit diffuse pan up to 16× brighter than the rock, ripple at 0.14 of one 8-bit level,
  nothing mirrored, banding, and the rig shooting 19-29% over shipping exposure while claiming
  honesty. The fix rounds killed the diffuse term (raw-linear albedo + real F0 via r184's
  `specularColorBlended`), moved the ripple onto the specular lobe (6 octaves), added post-sRGB
  dither, and built K=8 seed-pure emissive glint reflections — the fungi framing is now a broken
  teal glitter column down near-black water. Verify critics: visual **PASS** (all 9 failures
  resolved; the 2 remaining metric reds ruled false positives from a mis-normalized denominator),
  code FAIL → a final integrity round: per-cave pool materials (a streaming cave could steal the
  live cave's reflections — proven fixed by uniform snapshot), the pixel gate wired into
  `verify:chunks` with unconditional throws, a TEMPORAL ripple metric (proven 0.00 on a flat
  surface after the spatial metric measured toothless — flat pool2-rim scored HIGHER than
  rippled), leg 4b re-anchored in GPU readPixels truth, f32-faithful CPU twins with a measured
  0.70m tolerance, all 9 shader-injection anchors guarded and gate-asserted, seed-7 de-overfit of
  two gate assertions.

- **Verify:** tsc + loot + placement + colliders + `verify:chunks` (cave-walk 11/11 + 10/10,
  cave-void 0 escapes ×2 seeds, chunk-perf, cave-preload, the new pool pixel legs) ALL GREEN on
  the final tree. `pool-fill`: refill rules proven both ways, phantom-annulus 8/8 bearings,
  determinism stable + matchesLive (digests c54885f7 / 74da41c5).

- **Visual iteration:** 13 rounds total + a 5-agent adversarial panel across two waves. Honest
  residuals: pool motion (ripple/glint crawl) untestable in stills — needs Zach's walk-test;
  wet-collar gloss strip invisible in all poses (harmless); the r11 dark shard gone but root
  cause unnamed (a locating diagnostic now lives in pool-fill); at shipping exposure the water is
  a genuinely DARK mirror (median 2-5/255 near, taste dials `CAVE_POOL_GLINT_STRENGTH` /
  `CAVE_POOL_ALPHA_MIN`); pool2-rim is the weakest framing — recheck at cycle 7; dither
  crosshatch worth one motion look.

- **FLAGGED FOR ZACH (balance, not baked):** jerrycan recipe scrap ×3 + metal_pipe ×1 + cloth ×1 ·
  capacity 4× canteen (16 gulps) · pools 1-3/cave ~0.3m deep · the "fill everything at a real
  body of water" purpose lands fully when cave density (cycle 7+) makes descents routine.

- **Spend:** ~1.9M this cycle (campaign ~3.65M / 10M; cycle 6/20). Heavier than a normal cycle —
  the 3+2-critic adversarial panel and three build rounds are what the hero bar costs.
- **Commits:** `d717a9a` (systems) + `f388194` (hero visual + gate integrity).
- **Next (cycle 7):** the displaced D-3 visual reassess + CAVE_* taste pass, carrying the named
  residuals: ceilings ~80% (dark smoky band 8-15m), global value contrast below the old shell
  kit, the tor marginal at 78m, sawtooth spikes on the fissure's upper walls, CAVE_ROCK_BUMP perf
  unmeasured on low-end GPUs + its leopard-print mottle competing with the pools for attention,
  rock 8-bit banding under amplification, and the pool taste dials above.

## Resume + cycle-6 kickoff (2026-07-26)

Zach: "pick up where we left off" — campaign unpaused at `31a6de9` (tree clean, verify:all green).
Cycle-6 design decision, his call at kickoff (made in chat, AskUserQuestion): **VOLUME tier** —
pools plus a larger vessel (jerrycan) that only fills at real bodies of water, giving the descent
a purpose. Stated honestly: the repair descent (D-1..D-4) is **still unwalked**; cycle 6 builds on
the gate-green but human-unverified base, per his 2026-07-25 "run the remaining ladder" directive.

## Cycle 5 — the cave build stops hitching: boot preload + frame-budgeted slicing (2026-07-25) — SHIPPED

- **Planned:** walk-test **D-4** — preload the origin cave behind the loading screen; slice streamed
  cave builds on the S6/D296 pattern; add a resident-interior cap that never unloads the cave the
  player is standing in; gate all three inside `chunk-perf` with real tripwires.

- **⚠ THE FIRST FINDING INVERTS HALF THE TICKET.** The origin/egg cave was **already built at boot**
  — `spawnCave` runs at `main.ts` module scope, before the first frame is ever presented — so it has
  never been able to hitch gameplay. What was missing was not the preload but the **loading screen**:
  the browser showed a blank page for the whole ~4.6s boot, so the 1.3s of cave build read as "the
  game is slow to load in". Shipped `#boot-overlay` in `index.html` — inline-styled so it paints
  BEFORE the module bundle (whose CSS arrives too late to cover boot) and removed on the last line of
  `main.ts`. Measured: **boot 4562.6ms, of which the cave is 1311.9ms (tor 152.3 + body 1159.5) =
  28.7%.** The cost is real, it is covered, and it is now instrumented (`__cavePreloadMs`, the
  `cave:entrance` / `cave:body` marks in `__bootT`).

- **THE SLICER — one code path, two drivers.** `buildCaveSdf` and `spawnCave` are now thin wrappers
  that drive `startCaveSdf` / `startSpawnCave` with an infinite budget. The sliced driver runs the
  SAME job with `CAVE_BUILD_SLICE_MS` (8ms). Nothing was re-implemented, so the synchronous and
  sliced outputs cannot diverge by construction — and the gate proves it rather than trusting it.
  Stages, in run order:

  | stage | divisible? | resume granularity |
  |---|---|---|
  | `graph` | no (~1ms) | — |
  | `sdf:field` | **yes** | one 8³-voxel block (~0.02ms), loop linearized, order unchanged |
  | `sdf:cells` | **yes** | one k-plane of the surface-nets vertex pass |
  | `sdf:quads` | **yes** | one (axis, k) plane of the quad pass |
  | `sdf:cut` | **yes** | 3k triangles of the sky-rim cut |
  | `sdf:geom` | **no** | `computeVertexNormals` is one pass inside three.js |
  | `sdf:color` | **yes** | 7k vertices |
  | `dress` | no | the speleothem/fungi kit |
  | `finalize` | **no** | the Rapier trimesh bake **+ `scene.add` in the SAME step** |

  **Atomic finalize** (the terrain-tile precedent): nothing enters the scene and no collider exists
  until the last step, so a half-built cave is never visible and never collidable, and "visible but
  not solid" cannot exist for even one frame (rule 9).

- **MEASURED, before → after** (seed 1337, GPU headless, the `chunk-perf` walk):

  | | before (sync) | after (sliced) |
  |---|---|---|
  | worst frame of a streamed cave build | **~1160ms** (the whole body build, ~70 frames of hitch) | **90.5ms observed** |
  | worst DIVISIBLE slice step | n/a | **17.7ms** (budget 8ms) |
  | worst INDIVISIBLE step | n/a | **97.6ms — `finalize`, the Rapier trimesh bake** |
  | steps per build | 1 | ~84 (671 steps / 8 caves) |

  **The honest ceiling, stated plainly: ~90-100ms is the floor and no slicer can lower it.** A
  `ColliderDesc.trimesh` call over ~70k triangles cannot be chopped — it is one call into WASM. So a
  streamed cave costs **one dropped frame (~5-6 frames at 60fps), not seventy.** That is a 13× cut,
  not a fix. The remaining levers, none taken this cycle: a coarser voxel for far caves (0.65m was
  ~2.4× cheaper in cycle 1's table and would cut the collider triangles with it), a convex-decomposed
  or heightfield-per-chamber collider instead of one trimesh, or building the collider off-thread.
  The two budgets are reported and gated **separately** so the 97ms bake can never hide inside the
  slice budget, and the divisible tripwire (20ms) is deliberately above the 8ms budget: a stage step
  always finishes the chunk it started, and the coarsest chunk is ~10ms of `pureHeightAt`.

- **THE RESIDENT CAP.** `CAVE_RESIDENT_MAX` = 3 interiors (each ~95k visual tris + a ~70k-tri static
  trimesh). Eviction is farthest-first, and **three things are never evicted**: a `pinned` cave (the
  origin/egg cave, which owns the carved terrain hole and the companion egg), the cave whose padded
  bounds contain the player (`CAVE_EVICT_MARGIN_M`), and anything inside `CAVE_EVICT_MIN_DIST_M`
  (260m — you can see the mouth from there). If every resident is protected the cap is simply not
  enforced that frame: **a soft cap can never cause a fall-through, and a hard one could.** Teardown
  disposes geometries and removes the rigid body (rule 9 — no orphaned collider under vanished rock).

- **THE GATE — `chunk-perf` extended, plus a new boot-only `cave-preload` leg** (both in
  `verify:chunks`, so both run in `verify:all` every session). What it asserts, and the tripwire
  behind each — because "green because nothing built" is the failure mode this project keeps hitting:
  - `builds === N` and every new resident has **>0 visual AND >0 collider triangles** — a cave that
    silently didn't build cannot pass.
  - `steps ≥ 100` for 4 caves — a build that reverted to one synchronous call reports **1** step and
    a ~1160ms max, so slicing cannot be quietly lost.
  - divisible slice ≤ 20ms · **indivisible ≤ 170ms, named by stage** · worst **observed rAF gap**
    ≤ 260ms, measured independently of the counters so a cost they miss still shows.
  - the cap **evicted** (`evictions ≥ 1`, `residents ≤ 3`), the **pinned** origin cave survived, and
    with the player held INSIDE a far cave: that cave is still resident, `occupiedEvictionsBlocked`
    actually incremented (else the guard was never exercised — a vacuous pass), and a second eviction
    round really ran.
  - **the digest contract**: the origin cave's exact junction+seed is rebuilt through the SLICED path
    and its `caveDigest` must equal the synchronously-preloaded original's.
  - `cave-preload` runs at BOTH flag states: ON → preload record exists, origin resident is pinned
    with real triangles, `#boot-overlay` came down; **`--cave=0` → no preload record, no residents,
    and the flag-off world still boots** (the shipped kill-switch cannot be regressed by the preload).
  - **Proven able to fail**: the first `chunk-perf` run went RED on the digest-clone tripwire
    (`the sliced digest-clone cave never built`) — the clone was evicted by the cap in the same frame
    it finalized. Real bug in the probe, caught by the gate, fixed by standing the player at the site.

- **`caveDigest` UNCHANGED — measured, not asserted.** A git worktree at the pre-cycle-5 commit
  (`5433227`) reports seed 1337 `digest=a5d75db9 nodes=11 tris=94927`; after the refactor the same
  scenario reports **`a5d75db9`, 94927 tris**, and the sliced rebuild of the same junction reports
  `a5d75db9` too. Slicing changed when work runs, nothing about what it computes.

- **HONEST READ — can several caves build during travel?** At the cycle-8 density: **yes, with a
  caveat.** One in-flight build at a time, ~84 sliced steps at ≤18ms plus one ~97ms finalize frame
  ≈ 1.4s of wall clock per cave with a single visible stutter. Three caves entering the ring
  back-to-back queue up and cost three stutters over ~4s — noticeable on a fast traverse (speeder,
  sled), acceptable on foot. **What would break it is a cave building every few seconds**, i.e.
  uniform density at speed. If Zach's playtest finds the stutter objectionable the cheap fix is a
  coarser far-cave voxel (fewer collider triangles → a smaller atomic bake), and only after that does
  the clustered "cave country" scope-cut come into play. **Not taken here — it is Zach's call.**

- **Constraints held:** room-graph layout logic untouched · collider still baked from the same
  triangles · `VITE_CAVE=0` still kills the whole feature (now gate-proven) · determinism (D290)
  preserved and digest-verified · no `git stash`, push held.
- **GATES — `npm run verify:all` GREEN, every leg, run end-to-end once at the end.** The new rows:
  - `cave-build`: preload 1305.5ms (tor 145 / body 1160.5) · **8 sliced builds in 699 steps** ·
    divisible slice **17.1ms** / atomic **81.9ms (`finalize`)** / worst observed frame **80.6ms** ·
    residents 3 · **6 evictions, occupied-blocked 3, occupied cave survived** · 0 fails.
  - `cave-preload` flag ON: boot 4349.9ms, cave preload 1332.8ms (tor 157.1 / body 1175.7),
    94,927 tris, digest `a5d75db9`, 0 fails.
  - `cave-preload` **`VITE_CAVE=0`**: boot **2523.5ms**, no preload record, 0 residents, 0 fails —
    the kill-switch path is intact. Note the honest delta: the cave-off boot is **1826ms** shorter,
    not 1333ms — the extra ~490ms is the entrance-chunk heightfield→trimesh swap and the carved-hole
    terrain path, i.e. **the cave's true boot cost is ~40% of boot, not 29%.**
  - `cave-walk` 1337 **11/11 chambers, digest `a5d75db9` stable ×2** · seed 7 **10/10, `ff8162e8`
    stable ×2** · `cave-void` **0/8160 (0.00%)** and **0/7392 (0.00%)**, `excused=0`, `holes=0`.
  - The pre-existing legs are unmoved: terrain `perf` slice 30.4ms / 812 steps, streaming
    bodies 378→378, skyfall / leviathan / ribcage / dune-slope all OK.
- **Commit:** `f7450fe` (code) + `1501bc8` (bookkeeping). **Next:** cycle 6 — water pools (the first
  new-content cycle; Zach asked for it by name).
- **⚠ DOC GAP NOTED, not fixed here:** cycle 4 never wrote a `campaign-log.md` entry (it updated
  `campaign-state.json` only), so this file jumps cycle 3 → cycle 5. The cycle-4 record lives in the
  state file's `cycles[3].note`.

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
