# Campaign log — Dustfall "Infinite Sands" (started 2026-07-10, overnight)

Newest cycle at top. Prior campaigns archived in this directory:
`*-2026-07-09-sharpen-deepen.*` (PAUSED at M7 Skyfall plan-review — resume later by
restoring those files + `/campaign-approve`; the Skyfall plan itself is
`docs/feature-skyfall.md`) and `*-2026-06-18.*` (complete).

---

## Cycle 7 — S5 BUILD (2026-07-11) — SHIPPED → 🏁 CAMPAIGN COMPLETE (ladder S1-S6+S5 all shipped)

- **Approval:** the user approved in-session ("finish it off with the S5 plan") — the plan's recommendations stood (v17 bump, no scrap rings, no cap, looted-fauna persistence in) + the D297 mounted-save hardening.
- **Shipped (per the plan verbatim):** SAVE_VERSION 17 `chunkDiffs` — sparse per-chunk deviations keyed by descriptor-derived content ids (`poi/N`, `lm/K/N`, `l0`/`s0`); capture on unload + live snapshot at save (`serializeDiffs`); apply on load incl. the deferred knot pieces, mirroring the v16 visuals; `loadDiffs` at load-game; pre-v17 saves = empty map (zero migration). One implementation catch beyond the plan: the incoming looted-fauna set is UNIONED at recapture (skipped spawns would otherwise resurrect — D298). Plus `player.pos` now saves via `getPlayerPos` (D297).
- **Earlier in-session (D297 hotfix, commit `47769c8`):** the playtest speeder bug — streaming re-anchored to the origin mid-ride because the mount PARKS the capsule at (0,-2000,0); fixed via the canonical `getPlayerPos`; deep-cave dark-nav fixed for riders; a permanent A/B-proven RIDE leg added to the streaming gate; the Sarlacc's rider-blindness backlogged as a design question.
- **Verify:** ALL GREEN — placement ×5, colliders 55, chunks (determinism ×2 + cross-seed; streaming with `persisted=1`: extraction → unload capture → revisit re-apply → sparse save file → REAL reload+CONTINUE re-apply; perf leg), all 5 smokes. Origin-world round trip byte-exact.
- **D-entries:** D297, D298. **Spend:** ~270K (campaign TOTAL ~1.3M / 10M; 7 cycles / 50).
- **Verdict: TERMINAL — `until: ladder-complete` met. Campaign `completed`.**
- **▶ THE HUMAN'S MERGE REVIEW:** walk the final build (stream on foot AND on the bike, strip a far wreck → save → reload → still stripped), then merge `campaign/2026-07-10-procgen` → `master` and redeploy (web + desktop) when satisfied. Then: resume the parked Skyfall campaign.
- **Commit:** `a77048a` (+ the D297 hotfix `47769c8`).

## Cycle 6 — ⏸ S5 save schema PLAN (2026-07-11) — PROPOSED → CAMPAIGN PAUSED (the sanctioned pause)

- **Planned:** write the per-chunk-diff save schema plan and PAUSE for human review BEFORE building (D81 — the ladder's one sanctioned pause).
- **Delivered:** `docs/feature-save-per-chunk-diffs.md` — SAVE_VERSION 16→17 (additive `chunkDiffs` map; old saves = empty map, zero migration); content addressed by descriptor-derived CONTENT IDS (never runtime registry ids — the D292 trap); capture on unload + at save, apply on load; scrap rings explicitly deferred to v2; a probe persistence leg (strip-far → round-trip → still-stripped + a real page-reload re-apply); 4 open questions each with a recommendation. Build estimate: one cycle. **No code changed.**
- **Campaign state:** `paused`, `awaiting_approval`, `stop_reasons: ["save-version-bump"]`. The /loop is STOPPED.
- **▶ YOUR MORNING REVIEW:** (1) walk the world — `npm run dev`: sprint across a tile boundary (feel for hitches — S6), visit a landmark + a regional wreck-yard, strip a far wreck; (2) read the S5 plan; (3) `/campaign-approve` to release the S5 build (the final rung), optionally with steering notes. The whole branch (`campaign/2026-07-10-procgen`, cycles 1-6) then merges after S5 ships + your final review.
- **Spend:** ~40K (campaign ~1.03M / 10M; cycle 6/50).
- **Commit:** `fe56a99`

## Cycle 5 — S6 hitch-free generation (2026-07-11) — SHIPPED

- **Planned:** S6 — frame-budget the ~100-200ms terrain-tile bake (the D288 hitch); ceilings; a cross-chunk perf probe.
- **Measured first:** synchronous bake 90-200ms; fill dominates (37k computeHeightAt); computeVertexNormals ~17ms; POI chunk load 20-57ms; a wreck_knot would be ~150ms in one frame.
- **Shipped:**
  - Sliced tile builds: staged `fillRows`(12 rows ≈ 8-10ms/frame) → geometry+normals (one ~17ms frame) → ATOMIC mesh+collider finalize; anchor tile + boot ring stay synchronous (safety + byte-identity). One shared code path; per-vertex output byte-identical.
  - `CHUNK_LOADS_PER_FRAME` 2→1; wreck_knot pieces DEFERRED one per frame (load-time draws + per-piece seeds — deterministic regardless of execution frame; measured ~7-8ms/piece).
  - NEW permanent `chunk-perf` gate (verify:chunks leg 3): mechanism asserts (slicing the norm ≥100 steps; sync anchor bakes ≤4 + ≤250ms) + tripwires (slice ≤60ms, loads/pieces ≤120ms) + draw/body ceilings + baseline return; routed through a REAL wreck_knot via a wide descriptor scan (the cycle-3 unexercised-path lesson).
  - The gate CAUGHT a real edge in development: diagonal teleport legs outrun the sliced ring → the anchor-tile safety bake fires (correct fall-through protection at ~100× play speed) — assert recalibrated from ===0 to the rare-and-bounded allowance, logged in D296.
- **Verify:** ALL GREEN — placement ×5, colliders 55, chunks (determinism digests UNCHANGED from cycle 4 — slicing alters nothing; streaming 332→332; perf leg first-pass), 5 smokes, 9 vista shots regenerated identically.
- **D-entries:** D296. **Spend:** ~190K (campaign ~990K / 10M; cycle 5/50).
- **Commit:** `5f57a5d` (the SHA-recording docs edit rides in cycle 6's commit).
- **Next:** cycle 6 = **⏸ S5 save schema plan — THE SANCTIONED PAUSE** (plans, sets awaiting_approval, STOPS; brief in `docs/next-session-prompt.md`). Morning review: walk-test + review the plan + `/campaign-approve`.

## Cycle 4 — S4 distributed landmarks + per-region biomes (2026-07-11) — SHIPPED (interrupted + resumed)

- **Planned:** S4 — a rare per-region roll scattering hero destinations; re-anchor the distance-override biomes per-region; origin heroes stay authored.
- **Shipped:**
  - **Landmarks:** region grid (16 chunks = 1792m), 0.3/region, pure per-region hash → the hosting chunk renders on the normal lifecycle. Kinds reuse existing art (the SLOT is the deliverable — Skyfall plugs in later): `colossal_ribcage` (placeRibcage × 5-8, collider scaled with the mesh, returns {group, collider}; boot callers byte-identical) + `wreck_knot` (3 × placeProcgenPOI triangle + 2 carcasses; salvage transient per D292).
  - **Regional wreck-yards:** ONE appended draw in createBiomeSampler (prior anchors byte-stable) seeds a memoized region hash; `wreckYardAt` = max(origin, 3×3 regional anchors ≥2200m from origin) → far graveyards inherit ground tint/mottle, flatten, biome id, graveyard POI weights + a 6× POI density, all through existing consumers. Origin bakes byte-identically (placement gate green ×5).
  - Gates: landmark descriptor↔render equality + a landmark-site walk leg + a ±15km regional-yard scan; vista landmark/yard shots + a vertex-color yard diag (proved the bake when the shot read ambiguous — the real gap was density, fixed ×6, cluster-read polish backlogged).
- **Mid-cycle interruption:** the user's machine hit 100% CPU → root-caused (leaked `chrome-headless-shell` processes every reap regex missed + swiftshader probe load) → FRAMEWORK-WIDE fix: `reap-orphans.mjs` (orphan-state reaping) as global SessionStart/SessionEnd hooks + per-project regex fixes + canon (`process-leak-hygiene.md`), committed `gamedev-framework@e78c1ca`. Verified live on resume: the hook fired at session start; after this cycle's full suite the machine sat at exactly 4 node / 0 headless.
- **Verify:** ALL 10 GREEN first-pass — placement ×5 0-fails (the byte-identity tripwire for the biomes change), colliders 55, chunks (determinism ×2 + cross-seed; streaming 332→332 exact incl. the landmark leg), all 5 smokes.
- **Visual:** the colossal ribcage is a genuine hero read (30m titan skeleton arcing a dune crest, player-eye).
- **D-entries:** D295. **Spend:** ~200K (campaign ~800K / 10M; cycle 4/50).
- **Commit:** `9b3ba92` (the SHA-recording docs edit rides in cycle 5's commit).
- **Next:** cycle 5 = **S6 perf** (brief in `docs/next-session-prompt.md`) — then ⏸ S5 (the sanctioned save pause).

## Cycle 3 — S3 scatter + ambient life (2026-07-11) — SHIPPED

- **Planned:** S3 — rocks + wordless scenes per-chunk; creatures streamed (research the spawn systems first — the slice's ❓).
- **Research verdicts (step 1, drove the design):** rocks streamable (no colliders, shared materials; the ONLY care is the boot `scatterRand` stream — every boot creature id depends on its draw order → new exports, boot loops untouched); scenes trivially streamable (already on a dedicated rng); lizards/shrews streamable-with-care (id-keyed saves → D292 transient pattern); **vultures DEFER** (perch/carcass-bound global placement + dynamic death bodies + full-population prey scans fight the chunk model).
- **Shipped:**
  - `ChunkDesc` gains `rocks` (7 candidates/chunk, rocky-biome kept, descriptor-level scene-stage cull), `scene` (0.02/chunk rare tableau), `fauna` (1-2 lizards + 0-2 shrews at the chunk's wreck, salt-skipped). New exports: `makeScatterRock`, `buildWordlessTableau`, `despawnLizard`.
  - **Chunk-keyed fauna (D294)** — spawned via the REAL `spawnLizard`/`spawnShrew` on load, despawned on unload (looted skip), `transient` + save filters (lizards + shrews). No separate ring system — the chunk IS the ring.
  - Probe upgrades: full-ring descriptor↔render equality (POIs/rocks/fauna); a fauna-site walk leg (the straight +X walk landed on all-salt POIs — fauna would have shipped unexercised); population baselines with ambient predators QUIETED (circling vultures grabbed 2 boot lizards mid-walk → false "leak"); vista rock + scene shots.
- **Verify:** ALL 10 GREEN IN ONE PASS, zero flakes — tsc; placement 5-seed 0-fails; colliders 55; chunks (determinism ×2 + cross-seed; streaming bodies 332→332 EXACT, farPois 2/2, farRocks 46/46, fauna leg live); all 5 smokes. The D291/D293 hardening held.
- **Visual iteration:** placement-sanity bar — watcher tableau on a dune crest (reads as intended), rock field seated, wreck+fauna area; all player-eye.
- **D-entries:** D294 (chunk-keyed fauna; vulture defer; sacred boot streams; quiet-ambient-predators probe rule).
- **Spend:** ~170K (campaign total ~600K / 10M; cycle 3/50).
- **Commit:** `deadc77` (the SHA-recording docs edit rides in cycle 4's commit).
- **Next:** cycle 4 = **S4 distributed rare landmarks + per-region biomes** (brief in `docs/next-session-prompt.md`; biomes.ts changes must keep the origin ring byte-identical — the placement gate is the tripwire).

## Cycle 2 — S2 POI streaming (2026-07-11) — SHIPPED

- **Planned:** S2 — `placeProcgenPOIs`/`placeProcgenPOI` per-chunk on the ChunkManager lifecycle: biome weights, static merge, salvage registration per chunk, full teardown, origin exclusion.
- **Shipped:**
  - `ChunkDesc.poi` — a fixed-shape descriptor roll from a dedicated per-chunk rng: presence 0.07/chunk (≈ origin density), 25m edge margin, biome-weighted archetype via the real `pickArchetype`, fresh `renderSeed`. Origin exclusion 1250m (boot placement untouched).
  - `loadChunk` renders through the REAL `placeProcgenPOI` (forced archetype, `parent: group`): panels mount, salvage registers live, per-POI merge, declared colliders. `unloadChunk`: POI body removed, salvage spliced out, merge-output geometry disposed (shared panel geo + bucket materials never). `placeProcgenComposite` now stashes `userData.poiBody` (streamed 'ship' wrecks would have leaked their body).
  - **Save safety (the cycle's danger zone):** streamed wrecks are `transient` — excluded from `save.salvageables` (visit-order ids would patch the WRONG wreck after reload); v1 = regenerate pristine (S5 lifts). The streaming gate now SAVES at +1500m with streamed salvage live + asserts only boot ids in the file. Schema v16 untouched. Skipped deliberately: scrap rings (S5), horizon silhouettes (S4) — backlog + D292.
  - Gate hardening: verify-chunks streaming child 420s→900s (a spawnSync kill mid-probe = fake boot failure + a leaked dev server, D293); probe additions: descriptor↔render POI count, salvage-registry leak assert, world-space snapshots, POI-aware ground ray; `chunk-vista` streamed-POI shot.
- **Verify:** ALL GREEN — tsc; placement 5-seed 0-fails; colliders 55; verify:chunks (determinism 8/8 ×2 seeds + cross-seed; streaming: bodies 332→330, chunks 49/49, farPois=1 descriptor↔render, farSalvage=2, registry baseline, save-safety); smoke-intro/pod-tutorial/pickup-sweep/survival/diurnal PASS. One wrapper-timeout false-fail root-caused (D293), re-run green.
- **Visual iteration:** placement-sanity bar — a streamed `hollow_husk` at (1388,−736) shot player-eye: seated, sand line natural, archetype-faithful (renders through the SAME assemblers the origin field uses — no new-element polish owed).
- **D-entries:** D292 (save-transient streamed wrecks), D293 (wrapper child timeouts / dev-server leak).
- **Spend:** ~180K output tokens (campaign total ~430K / 10M; cycle 2/50).
- **Commit:** `ad49dc0` (the SHA-recording docs edit rides in cycle 3's commit).
- **Next:** cycle 3 = **S3 scatter + ambient life** (brief in `docs/next-session-prompt.md`; step 1 is the spawn*Procgen research ❓ — creature save arrays are the same id-trap as D292).

## Cycle 1 — S1 ChunkManager spike (2026-07-11) — SHIPPED

- **Planned:** S1 — the chunk grid + per-chunk deterministic seed + load/unload with full disposal, proven by marker posts + the two NEW permanent gates (determinism + streaming/leak).
- **Shipped:**
  - Terrain STREAMS: `terrain.ts` fixed 3×3 grid → an anchor-margin tile ring (24m margin) following the player; full tile disposal; `heightAt` infinite (closed-form fallback); one shared terrain material (fixed a `_shaderRefs` leak-under-streaming). Boot ring byte-identical to the old grid — the intro region untouched (placement 0-fails ×5 seeds).
  - NEW `src/world/chunkManager.ts`: 112m content chunks, r3, 8m anchor margin, `chunkSeed` avalanche + PURE `describeChunk` descriptors (D290), full Rapier/mesh teardown, marker spike content (off by default; `__game.setChunkMarkers`).
  - NEW permanent gates in `verify:all` (`npm run verify:chunks`): `chunk-determinism` (2 seeds + cross-seed digest distinctness) + `chunk-streaming` (4-leg walk to +1500m: terrain follows, collider≡heightAt, bounded set, no seam dupes, byte-identical reload, body-count baseline ±3).
  - Tooling: rig-shot `startDev` 30s→120s; walk probes at 320×240; `chunk-vista` scenario; `__game.chunkDescribe/chunkStats/resetWormCrossing`.
- **Verify:** ALL GREEN — tsc, placement (5 seeds, 0 fails), colliders (55), chunk-determinism (8/8 ×2 seeds, digests differ), chunk-streaming (bodies 332→330, chunks 49/49, tiles 9), smoke-intro `{ok,beats:12}`, smoke-pod-tutorial ok, pickup-take-sweep 0 fails, survival-probe PASS, diurnal-probe PASS. (Several boot-window flakes under concurrent machine load — root-caused to Vite cold boots >30s, fixed by the 120s window; each gate re-run green.)
- **Visual iteration:** placement-sanity bar (systems cycle, per charter) — 4 player-eye `chunk-vista` shots at/past +1500m, 3 identify/reframe rounds (the two "photobombers" were a dune slip face + the ambient worm-crossing ridge — explained, not regressions). No hero bar owed.
- **Design deltas mid-cycle (probe-driven):** the first trim design (settle-frame counter) was replaced by the ANCHOR-MARGIN model after the streaming probe caught corner micro-slide starvation (D288/D289 — the probe did its job before anything shipped).
- **D-entries:** D288 (two-grid anchor-margin streaming architecture, friction 3), D289 (heightAt infinite fallback), D290 (descriptor-pure chunk content — the S2 contract), D291 (walk-probe discipline). decisions.md archived D236–D246 (45 active).
- **Spend:** ~250K output tokens this cycle (campaign total ~250K / 10M; cycle 1/50).
- **Commit:** `e82d9a7` (branch `campaign/2026-07-10-procgen`; the SHA-recording docs edit rides in the next cycle's commit).
- **Next:** cycle 2 = **S2 POI streaming** (brief in `docs/next-session-prompt.md`; the descriptor-first contract is D290).
- **Pending post-mortem drafts:** queued to `.post-mortem-pending/` (consolidate skipped — unattended campaign).

## Cycle 0 — campaign started (2026-07-10)

- **Goal:** infinite deterministic chunk-streamed world per `docs/feature-infinite-procgen.md`.
- **Design decisions (user, 2026-07-09):** ~112m chunks / fog-radius loading; deterministic (seed → same world); DISTRIBUTED rare landmarks; the escape-pod intro stays the fixed start; save v1 = FULL per-chunk diffs (bump pauses at S5).
- **Ladder:** S1 spike+probes → S2 POI streaming → S3 scatter/creatures → S4 landmarks/biomes → S6 perf → ⏸ S5 save (the one sanctioned pause, BEFORE building).
- **Budget:** 50 cycles / ~10M soft. Branch `campaign/2026-07-10-procgen` off master @ 10a27f2 (post-playtest-fixes + the kickoff brief).
- **Guard:** `.gamedev-framework/overnight.lock` present; the destructive-action hook confirmed in `.claude/settings.local.json`.
- **Next:** cycle 1 = S1.
