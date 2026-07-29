# DEEPER cycle 13 — INTEGRATION & THE FINAL DESCENT

**Recon written 2026-07-28. READ-ONLY pass — no code, no gates, no probes run** (a gate suite was
live on the machine; every number below is read from committed source or from
`verification/gate-logs/`, never re-measured).

Third recon of this pattern. Cycles 11 and 12 both landed fast because the plan named real symbols;
same standard here. **Every claim about code cites a file:symbol I actually read. Anything derived
rather than measured is marked `DERIVED`. Anything I could not check is marked `UNVERIFIED`.**

---

## 0. Where this cycle sits

| | |
|---|---|
| Spend | **11.2M of a 14M ceiling** (`campaign-state.json`) → ~2.8M headroom |
| Cycles shipped | 1-11 (`master..HEAD` = 44 commits) |
| **Cycle 12** | **PLAN ONLY — never built** (`docs/campaign/cycle-12-plan.md`, committed `3d5e177`). Blocked on Zach's **Q4** (loot-cache contents) + **Q9** (journal text) |
| Cycle 13 | this doc — the closing cycle |

**The budget arithmetic that shapes everything below.** Cycle 12 still has to be built. Prior cycles
ran 0.8-3.0M (cycle 9 alone was ~3.0M). If cycle 12 costs ~1.0M, cycle 13 has **~1.6-1.8M** — about
half of what cycle 9 spent. Cycle 13 is therefore **one engineering item plus paperwork**, and the
cut order in §7 is not decorative.

**Owed from the pause:** `campaign-state.json` says `--legs=cave-kinds,cave-streamed` were unrun.
Gate logs since then contain `20260728T213327Z-cave-kinds.txt` and
`20260728T231336Z-cave-streamed-{1337,7}.txt`, both with `fails=0` rows. **Check the running suite's
output before re-running anything** — this debt may already be paid.

---

## 1. Workstream A — THE TOR ARRIVAL HITCH

### Verdict: **GO — but the target in the brief is wrong, and I will not plan against it.**

The brief asks for "the smallest change that gets it under the frame budget." Slicing **cannot** get
the tor under a 16ms frame budget, because the residual after slicing is a Rapier trimesh bake, and
`caveStream.ts:19-24` already states the honest limit for the interior: *"No slicer can chop a single
`ColliderDesc.trimesh` call."* The same physics applies here. What slicing achieves is real and worth
buying — it just is not "under budget", and a plan that promises that is the kind of laundering this
campaign keeps having to unpick.

### The measurement, from committed gate logs

`cave-density` reports the worst frame and names its stage. **The tor is the worst frame in every
run**, across every log in `verification/gate-logs/`:

```
20260727T220753Z-SUMMARY.txt   worst frame 160.1ms (tor)   tor 141.2 / atomic 76.7 (finalize)
20260728T083350Z-SUMMARY.txt   worst frame 199.1ms (tor)   tor 181.9 / atomic 101.1 (finalize)
20260728T002202Z-SUMMARY.txt   worst frame 210.3ms (tor)   tor 196.3 / atomic 77.6 (finalize)
20260728T231336Z-cave-density-7.txt   tor=184.9ms ... frame=199.4ms(tor)
```

Range: **160.1 – 210.3ms**, second-worst is always the interior's `finalize` (59.7 – 118.1ms).
Tor size, from the `CAVE-CREVICE` rig line (`scripts/rig-shot.mjs:2788`): `torTris=41752 … 48708`
on the two determinism seeds (32.6k at the low end across all logged seeds).

### Is the field fill genuinely divisible? — YES, and more of it than the brief assumed

I read `spawnCaveEntrance` end to end (`src/world/caveEntrance.ts:526-918`). It decomposes into
exactly the interior's stage shape:

| # | lines | work | divisible? |
|---|---|---|---|
| 1 | 533-607 | setup: `buildCreviceLine`, noise factories, **all four RNG streams consumed here** (`arand` 551, `hrand` 578) | atomic, ~free — and must stay one piece: this is where determinism lives |
| 2 | **626-755** | **column precompute** — `for k { for i {` over (nz+1)×(nx+1); writes only its own `o = k*cw+i` slot in 7 `Float32Array`s; reads `terrain.pureHeightAt` / `projectSlot` / `noise3` (all pure); updates `yLo`/`yHi` by min/max (commutative) | **YES — suspend on a k-plane** |
| 3 | 756-758 | `gy0/gy1/ny/ch` derived from `yLo`/`yHi` | **reduction barrier** — the field array cannot be allocated until 2 finishes. This is why it is two stages, not one |
| 4 | **766-808** | **the field fill** — `for k { for i { for j {`; writes only `field[(k*ch+j)*cw+i]`; reads only `col*[c]` at `c=k*cw+i` | **YES — suspend on a k-plane.** The big one |
| 5 | 810 | `surfaceNets(...)` | **ALREADY SLICEABLE AND ALREADY SHIPPING.** See below |
| 6 | 817 | `geo.computeVertexNormals()` | **atomic** (identical to the interior's `sdf:geom`) |
| 7 | 824-843 | vertex colour — per-vertex, pure | **YES** |
| 8 | 846-861 | mesh + `scene.add` + `makeStaticTrimesh` | **atomic, and must stay one step** (rule 9 / atomic finalize) |

**The find that makes this cheap.** `caveEntrance.ts:810` calls the *synchronous* `surfaceNets`. But
`src/world/caveSdf.ts:530-538` shows `surfaceNets()` is nothing but `startSurfaceNets()` driven to
completion, and `startSurfaceNets` (`caveSdf.ts:552-643`) already exposes
`stepCells(deadline)` / `stepQuads(deadline)`, each suspendable on a k-plane, **already used by the
interior every frame in the shipped game.** Slicing the tor's polygonizer is a call-site change.
Zero new polygonizer code, zero new risk surface.

Resulting stage list, mirroring `startSpawnCave` exactly:
`cols` → `field` → `nets:cells` → `nets:quads` → `geom`(atomic) → `color` → `finalize`(atomic).

### What it buys — and what it does not `DERIVED`

Residual after slicing = `computeVertexNormals` + the Rapier bake of ~45k triangles.
Calibrating off the same runs: the interior bakes 61k-86k collider tris in 59.7-118.1ms
≈ **1.0-1.4 µs/tri**. At 45k tris the tor's bake ≈ **45-65ms** `DERIVED — not measured`.

> **Expected worst tor frame after slicing: ~50-70ms, not <16ms.**

That is still the right trade: it removes ~120-140ms of divisible work, takes the tor **out of
"worst frame in the game"**, and lands it in the same class as the interior `finalize` the game
already ships — the one Zach has walk-tested repeatedly without reporting it.

### What it risks — the prior flag is OVERSTATED

Prior agents flagged that the refactor "cuts through the geometry cycles 4 and 7 tuned." Having read
it: **the refactor is control-flow only.** Hoist locals into closure state, add a resumable `k` index
with a deadline check at the plane boundary, split the `yLo`/`yHi` reduction at a stage edge. **No
geometry expression changes.** Every loop keeps its iteration order and its arithmetic — which is
precisely the invariant `caveSdf.ts:179-183` already states: *"slicing changes only WHEN work runs,
never WHAT it computes."*

And the established idiom makes sync and sliced literally the same code:
`buildCaveSdf` = `startCaveSdf` at `Infinity` (`caveSdf.ts:193-201`); `spawnCave` = `startSpawnCave`
at `Infinity` (`caveGen.ts:2103-2114`). `spawnCaveEntrance` becomes the same four-line wrapper.

**Call-site surface is two lines** (`grep spawnCaveEntrance`): `src/main.ts:222` (boot preload —
stays synchronous, it is behind `#boot-overlay` and must not stretch across frames) and
`src/world/caveStream.ts:385` (`doTor` — the one to slice).

### THE REAL GAP — and it decides the order of work

`caveDigest` (`caveGen.ts:2476-2491`) hashes the cave graph and the **cave** meshes. **The tor mesh is
in no digest anywhere.** So today a slicing bug that moved one tor vertex would ship green. That is
this campaign's own recurring failure — a gate that measures the wrong thing. So:

1. **Step A1 — the digest FIRST (~20 LOC).** Add `torDigest` to `CaveEntranceProbe`
   (`caveEntrance.ts:496-514`): FNV-1a over the position attribute rounded to 1cm, same `mix`/`r2`
   shape as `caveDigest`. Emit it on the `CAVE-CREVICE` line (`rig-shot.mjs:2788`) and in
   `cave-density` / `cave-streamed`. Baseline on seeds 1337 + 7. **Durable on its own merits.**
2. **Step A2 — the refactor.**
3. **Step A3 — the tooth.** Assert the **sync**-built tor (`main.ts:222` preload) and the
   **sliced**-built tor (streamed) produce the SAME `torDigest` at the same site, and that both match
   the pre-refactor baseline. Cycle 5's precedent verbatim. This converts *"trust me, I only touched
   control flow"* into a machine fact.

### LOC estimate

| file | change | LOC |
|---|---|---|
| `src/world/caveEntrance.ts` | `spawnCaveEntrance` (393 lines) → `startSpawnCaveEntrance` job + 4-line sync wrapper; mechanical re-indent + closure hoisting | ~200 touched, **+90 net** |
| `src/world/caveStream.ts` | `doTor` → sliced branch mirroring the `inflight.job` path; `ATOMIC_STAGES` (`:167`) gains `tor:geom`/`tor:finalize`; `maxTorMs` splits divisible/atomic | **~40** |
| digest + gate plumbing | `caveEntrance.ts` + `rig-shot.mjs` + `verify-chunks.mjs` regex (`:335`) | **~40** |
| | **total** | **~280 touched / ~170 net** |

One agent, one gate window.

### Cheaper alternatives, honestly ranked (if the GO is refused)

- **(a) Coarser tor voxel.** `CREVICE_TOR_VOXEL` 0.32 → 0.40 (`tuning.ts:1105`) cuts field cells
  ×0.51 and triangles ×0.64 → ~29k tris, bake ~30-40ms. **One line.** **Do not do this.** It
  re-baselines tor geometry and gives back cycle 7's sub-voxel work: `CREVICE_WALL_NOISE_FLOOR` is
  explicitly sized at *"half a voxel"* (`caveEntrance.ts:791-794`) and the sliver/sawtooth fixes
  (777-785) are all voxel-relative. It is a taste regression wearing a perf hat, and it would force a
  full re-shoot of the kind look pass.
- **(b) Build the tor before the player is in sight range.** **Already true, and it does not solve
  anything.** `CAVE_STREAM_REQUEST_M = 330` (`tuning.ts:1366`) against a tor findability range of
  ~78m — the tor already builds far off-screen. A 200ms hitch is felt as a stutter whether or not its
  cause is visible. Naming this explicitly because it is the tempting non-fix.
- **(c) Cheapen `makeStaticTrimesh` for single-mesh identity bakes.** `src/physics/bodies.ts:41-78`
  calls `toNonIndexed()` (triples the vertex data) then runs a 9-accessor-call-per-triangle JS loop —
  ~400k `BufferAttribute` accessor calls for the tor alone. A fast path passing the indexed positions
  + index buffer straight to `ColliderDesc.trimesh` would help the tor **and** the interior finalize.
  **UNVERIFIED how much of the bake is JS versus Rapier.** Per steering's *"measure before
  dispatching"*: buy the 15-minute probe, then decide. Do not commission this blind.

**Recommendation: A1 + A2 + A3. Reject (a). Discount (b). Probe (c) only if budget allows.**

---

## 2. Workstream B — THE DOCS SWEEP

44 commits since the last `/session-end`. CLAUDE.md's own doc-drift guardrail fires at 3.

| doc | current state | owed (shape only) |
|---|---|---|
| **`CLAUDE.md`** | "Where we are now" ends at `**🚀 SHIPPED (2026-07-20) — campaign "UNDERWORLD"…**` (line 90). Touched once this campaign (`f7450fe`, +1 line, the tick-order line) | **Line 90 is internally stale**: names `src/world/caveTest.ts` as entrance owner (now `caveEntrance.ts`) and "one cave per world 130-260m from origin" (now ~3.0-3.2/travel-hour). **Line 94 `**NEXT:**` is factually false** — the walk-test feedback it calls "pending" was collected 07-24 and fixed in cycles 1-5. New closing paragraph: DEEPER in flight / not merged; repair ladder 1-5 (watertight SDF surface, shell kit deleted, `cave-void` gate, crevice entrance, boot overlay + slicer); content 6-11 (pools + jerrycan, rocky-terrain density, 4 kinds, darkness decoupling, `placementGround.ts` + INV-COLD); gate = 24-leg tiered parallel `verify:chunks`; **hazards CANCELLED in person 2026-07-28**; NEXT = cycle 12 + final descent + merge |
| **`docs/changelog.md`** | 7242 lines, latest-at-top. Last entry = `## Campaign "Sharpen & Deepen" cycle 24 — 2026-07-13 …` (line 6). **Untouched all campaign** | Everything from **2026-07-14 on**: the 07-15 review-fix/Phase-1 batch, the 07-16/17 SOLID batch, Scavenger's Economy (07-18), Deep Desert (07-19), Underworld (07-20), **plus DEEPER cycles 1-12**. Format: `## Campaign "<NAME>" cycle <N> — <date> — <headline> ✓ all gates` → backticked `` `verified` — `` line → `- **BOLD LEAD**` bullets closing with D-numbers. **No session letters** (last ever = `ACBB`, 2026-06-18). ⚠ Note cycle 4 has no campaign-log entry either — its record is only `campaign-state.json` `cycles[3].note`. ⚠ The cycle-24 entry's `ash_barren` claim is itself wrong (replaced by `bone_field` 07-14) — add `⚠ SUPERSEDED` inline |
| **`docs/architecture.md`** | cave block = lines 59-64, six files. Touched once (`f7450fe`, +7/−1) | **Missing**: `caveKinds.ts`, `caveSites.ts`, `cavePools.ts` (+ `placementGround.ts`, which is not cave-scoped — file it near `panelPlacement.ts`). **Line 44's gate list is stale**: `"(determinism / leak / perf / skyfall-walk)"` vs the real **24 legs** in `scripts/verify-chunks.mjs` (`DET_SEEDS=[1337,7]`): determinism×2, streaming, perf/`cave-build`, skyfall-walk, leviathan-walk, ribcage-climb, dune-slope×2, cave-walk×4, cave-preload×2, pool-fill×2 (carries **LANTERN-RT** + **CAVE-COLD**), cave-density×2, cave-streamed×2, cave-kinds, cave-void×2. Also document `--legs=` matching **name OR group**, and that `solo:true` legs run in the quiet phase |
| **`docs/decisions.md`** | 625 lines. **Highest = D307 — and it is a COLLISION**: `## D307 — M12: the ash-barren biome (2026-07-13)` and `## D307 — 2026-07-19 — THE D254 SPIKE RAN…` | New entries start at **D308**. **Flag the collision, do not renumber** (the file's own rule, line 5). Format: `## D<N> — <date> — <title>`, bold-lead fields `**When**` / `**Decision**` / `**Considered alternatives**` / `**Verification**` / closing `**friction-score:** <0-5>`. **Zero D-entries were written this campaign** — the log's `D-1…D-4` are walk-test *defect ids*, not decisions; do not confuse them |
| **`docs/roadmap.md`** | "Up next" still opens with `⚙ ACTIVE CAMPAIGN — "Sharpen & Deepen" +4M overnight batch (2026-07-13…)`. **Untouched all campaign** | Three campaigns out of date. Replace the ACTIVE block with DEEPER (✅ per cycle, ⚠ for cancelled hazards); backfill 5 "Recently shipped" bullets (07-15 → 07-20) + one DEEPER roll-up |
| **`docs/backlog.md`** | `### DEEPER residuals` exists but holds **2 items, both from cycle 2**. Touched once (`c5f0a35`) | File the parked items that never landed — see §5. Also strike `~~…~~ SHIPPED` on §B line 110 (deep cave → companion egg) and line 65 (D255 multi-chamber), both fully shipped. And `docs/campaign/hazard-spec.md` Q1-Q10 is now **dead spec** (cancelled 07-28) — needs an explicit DROPPED note, not silence |

### D-entry candidates (all D308+), ranked

**MUST — the durable lessons, write these five even under the tightest cut:**

| # | candidate | one-line rationale |
|---|---|---|
| 1 | **Band-decomposed heightfield hole + the hole-iff-resident invariant** (c8) | Amends D307. Holed tiles decompose into sub-heightfields instead of a full-tile trimesh — 0.3ms vs 24.4ms, 80× — and the invariant *a hole exists iff the cave beneath it is a live resident* is what makes arbitrary cave density safe at all |
| 2 | **One code path, two drivers + atomic finalize** (c5) | `buildCaveSdf`/`spawnCave` are infinite-budget wrappers over the resumable jobs, so sync and sliced **cannot diverge by construction**; trimesh bake + `scene.add` land in one step (rule 9). This is the pattern cycle 13's own tor work depends on |
| 3 | **INV-COLD** (c11) | A cave branch pre-empts shelter/sun and walks temperature toward `caveColdTarget(depth, kind, wet)` **in both directions, never past it**; `CAVE_COLD_FLOOR = −0.48` — and the gate proved the plan's own −0.55 made its defaults jointly unsatisfiable. A plan corrected by its gate |
| 4 | **KCC marches are dt-coupled → the quiet phase** (c9) | Parallelizing the gate suite manufactured march false-reds twice. Verdict integrity beat the 35-min latency target. Generalizes far past Dustfall |
| 5 | **The placement-sampler unification** (c11) | `placementGround.ts` casts placeables down against **LIVE colliders**, not `terrain.heightAt` — and the fix landed at **nine** sites, not the six the plan named. The "one function, N consumers" shape |

**SHOULD — write if budget holds:**
6. **The SDF grid lattice snap** (c9) — origin snapped to a fixed world lattice so identical world geometry polygonizes identically regardless of layout; **and the honest negative result**: it was shipped believing it fixed the entrance marches, and measurement proved it did not (`caveSdf.ts:284-297`). The negative result is the valuable half.
7. **Cave kinds = a parameter table over one generator** (c9) — not new code paths; seed-pure assignment leaves placement digests untouched.
8. **The shader warm stage** (c8) — program keys carry live light state, so boot-time warming provably cannot match; `compileAsync` off-scene at the live state is the only correct moment.

**OPTIONAL / fold:** surface-nets-not-marching-cubes (c1) · `CAVE_ROCK_BUMP` sub-voxel relief as shader normal perturbation (c3) · `CAVE_RESIDENT_MAX` as a **soft** cap (c5) · pools scored on the same `caveFloorSediment` signal the floor tint uses (c6) · entrance headroom closed by construction (c9).

---

## 3. Workstream C — THE FRAMEWORK BACKFLOW

### The gap, quantified

- `~/projects/gamedev-framework/.post-mortem-pending/` holds **17** drafts, not 16 — the count in the
  campaign log predates `addition-heightfield-discontinuity-cliff.md` (mtime Jul 28 19:18).
- `shared-memory/` (84 files) **untouched since Jul 17 02:32**; last commit touching it 2026-07-13.
- **Zero of the 17 drafts come from this campaign.** 14 Odyssey, 2 project-mountain, 1 dustfall-ABL.
- **Every one of the 17 is a code/rendering pattern. Not one is orchestration or process** — which is
  exactly what DEEPER produced most of. The `Orchestration` category has **3 files**.

### Staleness triage of the 17

All 17 remain **valid as claims**. Three qualifications:

- **OVERDUE (11 days, twice-observed):** `addition-pointer-lock-preview-guard.md` (Jul 17, dustfall
  ABL then project-mountain D62) and `addition-verify-bots-rot-when-movement-model-evolves.md`
  (Jul 17, project-mountain D50 — *the same failure family as our dt-coupled KCC marches*).
- **MERGE, do not file twice** — each is a near-duplicate of a Dustfall finding:
  `shell-audit-closed-and-wound` ≈ cycle 1's void-ray gate · `one-shape-one-function` ≈ cycle 2's
  shell-kit deletion · `shot-harness-state-leak` ≈ cycle 10's freeze-flag (one flag produced all
  seven "game bugs") · `glsl-reserved-words-and-hmr` ≈ cycle 9's *never edit `src/` while a rig runs*.
- **FOLD:** `verify-throw-aim-pitch-reset` is narrow; belongs inside `verify-bots-rot…`.

### Candidate entries from THIS campaign

Written to the promotion spec (`plugin/skills/consolidate-shared-memory/SKILL.md`): filename
`addition-<slug>.md`, line 1 `# Addition → shared-memory/<target>.md`, `## ` = the claim as an
imperative, then a provenance line `Dustfall DEEPER cycle N (2026-07-NN): <evidence>`.

**New files (no existing home):**

1. **`addition-agent-stall-detached-gate.md`** → `shared-memory/orchestration-policy.md`
   *An agent's shell caps below your long-gate runtime, so agents must never own long-running work.*
   An agent whose shell times out detaches the run and ends its turn; the harness then reports the
   AGENT complete while the gate runs untracked and the orchestrator waits on a notification that can
   never arrive. Ownership split: the orchestrator runs every long gate under its own tracked shell.
   Zach caught the same idle pattern twice before it was written down (c10, `6ed743b`).

2. **`addition-gate-suite-tiering-and-legs.md`** → `shared-memory/` (new, Process & verification)
   *Tier a long gate suite into parallel and quiet phases, tee every leg to a file, and let `--legs=`
   match name OR group.* Took `verify:chunks` from ~90 min to ~32-55 min. Tee-to-file is what let the
   pause salvage **22 of 24 per-leg verdicts** from a suite killed mid-run. Hard-error on unknown leg
   names — a typo that silently selects nothing is a green suite that ran nothing.

3. **`addition-dt-coupled-verdicts-quiet-phase.md`** → `shared-memory/` (new)
   *A verdict computed from a real-time simulation is coupled to machine load; parallelizing its gate
   can manufacture false reds.* Dustfall's KCC marches false-failed twice under parallel load
   (`cave-streamed-7`, 528s vs 310s). The fix is a quiet phase, not a loosened threshold — and the
   trade was made explicitly: verdict integrity over the 35-minute latency target.

4. **`addition-red-proof-before-fix.md`** → `shared-memory/` (new)
   *A gate you have never seen fail is not a gate.* Cycle 1 demonstrated the void-ray gate RED first
   (53.59% escapes) before trusting its green. Cycle 11's gate falsified its own plan's constant
   (−0.55 → −0.48). Pairs with the project's standing lesson that a gate measuring the wrong thing is
   worse than no gate, because it launders a bug as verified.

5. **`addition-critic-attribution-vs-pixel-probe.md`** → `shared-memory/adversarial-visual-critique-harness.md`
   *A critic reliably names the defect and unreliably names its cause.* One mis-attribution cost two
   fix rounds before a 90-second pixel→mesh probe named the real builder. Trust the critic's
   observation; probe before acting on its attribution.

6. **`addition-recon-before-build.md`** → `shared-memory/orchestration-policy.md`
   *Spend a read-only recon pass before each build cycle; run it inside the previous cycle's gate
   window at zero marginal wall-clock.* Cycles 11 and 12 both landed fast because of it, and cycle 11's
   recon found the real fix sites **by reading** — nine, not the six the plan had named.

**Extend existing files (do not create):**
- `session-start-feature-audit.md` ← *the feature already exists — recon first.* **Twice this
  campaign**: cycle 5 found the origin cave was already built at boot behind a missing loading screen
  (inverting half the ticket), and cycle 11 found the lantern already existed as an item.
- `verify-wait-budget-vs-scene-complexity.md` ← *n≥5 runs per tree before calling a flake.* The 4242
  episode: the orchestrator "proved" introduced-vs-pre-existing off ONE pristine-worktree run — a
  lucky sample. Proper falsification (5+10 runs) showed flaky on BOTH trees at the same rate.

### Scope call

Writing 6 drafts is cheap and autonomous (~30 min). **Draining the 17 is not**:
`/consolidate-shared-memory` is interactive (per-item Merge/Reject/Defer via AskUserQuestion) and is
therefore **Zach's time, not an autonomous task**. Cycle 13 **writes the drafts** and **queues the
drain as a checkpoint-3 agenda item.**

---

## 4. Workstream D — THE FINAL WALK-TEST BRIEF

*(Draft for checkpoint 3, `deeper-shipped`. Kept to one page because that is what gets read.)*

**Dev-panel affordances that exist today** (verified in `src/ui/devPanel.ts`):
`cave` / `egg cave` → `gotoCave()` (99, 104) · `warren` `fungal` `flooded` `shaft` `canonical` →
`gotoCaveKind(k)` (105-109) · `lantern trail` (112-115, reports `n/N set` and the refusal reason) ·
`dune sea` → `gotoErg()` (96) · `spawn sled` (97).

**Walk it in this order** — the first two legs are the ones that cannot be warped to:

1. **Boot → the origin/egg cave, on foot, no warps.** This is the repair baseline (D-1…D-4). Does the
   descent still read? Does the boot loading screen cover the preload?
2. **Walk out and keep travelling until a cave streams in by itself.** Two judgments: is the
   **density** right (~3.0-3.2 caves per travel-hour), and **do you feel the arrival hitch?** If
   cycle 13's tor slicing shipped, this is the leg that says whether ~50-70ms is acceptable where
   ~200ms was not. Trust your eyes over the gate number.
3. **The five kinds, warped, in order:** canonical → warren → fungal → flooded → shaft. Each: can you
   tell which kind you are in within ten seconds?
4. **`lantern trail` in the darkest kind.** Is placed light strong enough to be worth carrying?
5. **Cold + water:** fill the jerrycan at a flooded pool; sit in the cold long enough to feel it.
6. **Exit and re-enter.** Does the cave come back identical?

**The open taste dials — these are yours to call, all one-line edits in `src/config/tuning.ts`:**

| dial | current | line |
|---|---|---|
| `CAVE_SITE_CHANCE` — **THE density dial**, already ⚑ flagged for you | `0.60` | 1340 |
| `CAVE_KIND_WEIGHTS` | `canonical .24, warren .19, fungal .19, flooded .19, shaft .19` | 1160 |
| `CAVE_DARK_AMBIENT_LEVEL` / `_HEX` / `CAVE_DARK_SUN_LEVEL` | `0.021` / `0x4a3a2a` / `0.0` | 1247-1249 |
| `CAVE_DARK_DEPTH_FADE` / `CAVE_DARK_AABB_MARGIN` | `7.0m` / `14m` | 1241, 1250 |
| `CAVE_TORCH_INTENSITY` / `CAVE_TORCH_DIST` | `2.4` / `11m` | 890-891 |
| `LANTERN_LIGHT_INTENSITY` / `_DISTANCE` / `_MAX_PLACED` | `2.4` (was 1.6) / `17.5m` (was 14) / `6` | 634-635, 646 |
| `CAVE_COLD_FLOOR` (+ `CAVE_COLD_SAFETY_MARGIN 0.35`, boot-asserted) | `−0.48` | 1282-1283 |
| jerrycan / warren scrap numbers | cycle 6 recipe 24 | — |

**Still your calls, blocking cycle 12:** **Q4** the loot-cache contents and **Q9** the journal text.
Both are economy-gate items — never baked autonomously.

---

## 5. PARKED — listed for completeness, no work planned

Shaft **collapse-skylight** (a diegetic light source via the existing hole machinery — was
hazard-spec Q9) · **warren history props** · **corridor differentiation** · **canonical speleothem
knife-tips** *(digest re-baseline call)* · **egg-dais grey-tarp read** *(digest re-baseline call;
pre-existing shared `_caveSolid` asset)* · **pocket-9 wedge trap** (seed 4242) · **`floorOk` margin
under-bounds the true speleothem silhouette**.

Also parked, from the cycle logs and not yet in `backlog.md`: ~20 new `CAVE_*`/`CREVICE_*` taste
dials · `CREVICE_COVER_CLEAR` under-sized · sub-voxel lintel slivers · speeder-pace density unmeasured
· the warm fail-safe path untested · the tile-seam fix has no negative-control seed · pool motion
untestable in stills · cycle 5's honest ceiling levers (coarser far-cave voxel, convex-decomposed or
per-chamber-heightfield collider, off-thread collider build).

---

## 6. Q-LIST (defaults in bold — all safe if unanswered)

1. **Tor slicing target.** Accept ~50-70ms as the goal rather than <16ms? → **Default: yes, ship A1+A2+A3 and report the honest number.**
2. **`CREVICE_TOR_VOXEL` 0.32 → 0.40** as a cheap extra win? → **Default: NO.** Taste regression wearing a perf hat.
3. **Probe `makeStaticTrimesh`'s indexed fast path** (alternative c)? → **Default: only if budget survives A+B+D.**
4. **Changelog granularity.** 17 entries, or roll-ups? → **Default: one roll-up per shipped campaign for the 5 backfills, per-cycle entries for DEEPER only.**
5. **D-entry depth.** → **Default: the 5 MUST entries; SHOULD tier only if budget holds.**
6. **The D307 collision.** → **Default: flag inline, do not renumber** (the file's own rule).
7. **Framework drafts.** → **Default: write all 6, queue the interactive drain for Zach at checkpoint 3.**
8. **Cycle 12.** Build it before 13, or fold the story beat into 13? → **Default: build 12 first — it is planned, verified, and only blocked on Q4/Q9.**
9. **Merge to `master`.** After the walk-test, or hold? → **Default: hold until Zach passes checkpoint 3.**
10. **The owed `--legs=cave-kinds,cave-streamed`.** → **Default: read the running suite's logs; do not re-run if green rows exist.**

---

## 7. RECOMMENDED SCOPE — and the cut order

**Commit order:**

| | item | note |
|---|---|---|
| A1 | tor `torDigest` + baseline both seeds | small, durable regardless of A2 |
| A2 | tor slicing refactor | the one real engineering item |
| A3 | the sync-vs-sliced digest tooth | what makes A2 trustworthy |
| B1 | `CLAUDE.md` + `architecture.md` + `roadmap.md` + `backlog.md` | four short ones, one commit |
| B2 | `changelog.md` backfill | the bulk |
| B3 | `decisions.md` D308+ | MUST tier |
| C1 | 6 framework drafts | outside this repo |
| D1 | the walk-test brief | checkpoint-3 deliverable |

**Cut order if the budget bites (≈1.6-1.8M is the realistic envelope):**

1. **B2 → one DEEPER roll-up entry** instead of 12 per-cycle entries. Saves the most, costs the least.
2. **B3 → MUST tier only** (5 entries, drop SHOULD/OPTIONAL).
3. **C1 → 3 drafts** (stall rule, gate tiering, red-proof — the three with no existing home and the widest reuse).
4. **If it comes to the tor: cut A2, KEEP A1.** Never the other way around. A digest without a
   refactor is a durable gate; a refactor without its digest is exactly the untested-change pattern
   this campaign has had to unpick three times. The cut direction is not negotiable.
5. **D1 is never cut.** It is the deliverable of checkpoint 3.
