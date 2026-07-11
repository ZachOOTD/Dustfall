# Campaign log — Dustfall "Sharpen & Deepen" (started 2026-07-09)

Newest cycle at top. Prior campaign (2026-06-18, M1–M13, COMPLETE) archived at
`campaign-log-2026-06-18-cont.md` + `campaign-log-2026-06-18-m1-m13.md`.

---

## Cycle 8 — M7 Skyfall feature-slice (2026-07-09) — PAUSED (plan-review)

- **Planned:** M7 Skyfall is `[feel-critical]` -> feature-slice + PAUSE for human plan-review (no autonomous build on a hero asset).
- **Did:** 2 read-only code-map agents (intro-ship interior tech + hero-landmark/enterable/save). Wrote `docs/feature-skyfall.md`: DoD, 6 sub-tasks, reuse map, the post-blockout walk-test pause, scope-cut order, 4 open questions.
- **Key finding:** NO SAVE_VERSION bump needed (additive; fixed landmark rebuilds from seed, salvageables/journals auto-persist on v16). Save-bump pause NOT triggered.
- **Verify:** n/a (plan-only; no code changed).
- **Spend:** ~150K est. (campaign total ~3.2M / 10M; cycle 8/50).
- **STATUS: PAUSED — awaiting_approval, stop_reasons [plan-review].** Human action: review `docs/feature-skyfall.md`, optionally answer the 4 open questions in `steering.md`, then `/campaign-approve` to release S1 (research + exterior blockout). The loop is STOPPED (no wakeup scheduled).
- **Next (after approval):** S1 exterior blockout -> S2 interior+colliders -> walk-test pause -> hero-detail.

## Cycle 7 — M6 POI breadth A3: cargo_crawler (2026-07-09) — SHIPPED (M6 COMPLETE, 3/3)

- **Planned:** M6 A3 cargo_crawler (optional stretch; DoD already met at 2) — the tracked-vehicle silhouette.
- **Shipped (D287, A3):** `crawlerBody` component (cab + exhaust stack + open cargo bed + two track bogies with wheels/drums/lugs); `assembleCargoCrawler` adds 1-2 spilled containers (reused debrisPiece). Cab/bed/2-bogie box colliders. Registry (`warm` bucket) + `ARCH_WEIGHTS` all biomes. Added to verify:colliders default list (50->55 audits).
- **Visual gate rework:** round 1 (seatSink 0.45) buried the tracks -> box pile; round 2 (seatSink 0.16) made the tread/wheels/drums read as a tracked hauler. The defining feature must stay visible.
- **Verify:** verify:all PASS (tsc + placement 5-seed 0-fails + colliders 55 audits, cargo_crawler 5-6/5-6 x4 seeds) - all 6 rig gates PASS.
- **Visual iteration:** rendered via the procgen framer (3q natural + pinyaw broadside + zoom); routine bar (no sev>=2); 1 rework round. Clean tracked-hauler read.
- **Spend:** ~600K est. (campaign total ~3.05M / 10M; cycle 7/50).
- **M6 CLOSED:** 3 distinct archetypes (vertical mast / horizontal pipeline / ground vehicle).
- **Next:** cycle 8 -> M7 Skyfall [feel-critical] — feature-slice it, then PAUSE (plan-review) for the human to approve the plan before building.

## Cycle 6 — M6 POI breadth A2: buried_pipeline (2026-07-09) — SHIPPED (M6 DoD met, 2/2-3)

- **Planned:** M6 A2 buried_pipeline — a surfacing/diving pipe run (the low-horizontal silhouette).
- **Shipped (D286, A2):** `pipeSegment` + `pipeJunction` components; `assembleBuriedPipeline` — 4-5 bedded pipe cylinders (lower third in sand, one surfacing hump, a diving far end, a ruptured joint) tied into a manifold hub (drum + valve handwheel + flange stubs + proud access housing/panel). Registry (`dark` bucket) + `ARCH_WEIGHTS` all biomes (derelict shaved to keep sums ~1.0). Added to verify:colliders default list (45->50 audits).
- **Design rework (visual gate):** the first sine-undulation pass floated crests ~1.5m proud — a rigid POI group has NO terrain access, so it can't weave under the real heightfield. Reworked to a fixed shallow-bedding run (robust at any anchor). This is the value of rendering before declaring done.
- **Verify:** verify:all PASS (tsc + placement 5-seed 0-fails + colliders 50 audits, buried_pipeline 7-8/7-8 x4 seeds) - all 6 rig gates PASS.
- **Visual iteration:** rendered via the procgen framer (3q + zoom, 2 seeds); routine bar (no sev>=2); 1 rework round (float -> bedded). Seed 1337 broadside confirms a clean half-buried pipeline + manifold read.
- **Spend:** ~550K est. (campaign total ~2.45M / 10M; cycle 6/50).
- **Next:** cycle 7 -> M6 A3 cargo_crawler (optional stretch; DoD already met) — the last autonomous content before M7 Skyfall pauses for human plan-review.

## Cycle 5 — M6 POI breadth A1: relay_mast (2026-07-09) — SHIPPED (partial 1/2-3)

- **Planned:** M6 = 2-3 new procgen archetypes. DECOMPOSED (multi-part feature, anti-punt) into `docs/feature-poi-archetypes.md` — one archetype per cycle to depth.
- **Shipped (D285, A1):** `relay_mast` — a fallen guyed lattice comms tower (the missing TALL+THIN silhouette). NEW `latticeMast` component (truss + housing + crossarm/dish/whip antennae/beacon + guy wires); `assembleRelayMast`; registry (`cool` bucket, list 0.42); `ARCH_WEIGHTS` all biomes (derelict shaved to keep sums ~1.0). Envelope-cylinder + base-box collision. Added to the verify:colliders default list (40->45 audits).
- **Verify:** verify:all PASS (tsc + placement 5-seed 0-fails + colliders 45 audits 0-fails, relay_mast 5/5 x4 seeds) - all 6 rig gates PASS.
- **Visual iteration:** rendered via the procgen framer at real placement (3q + tight zoom, 2 seeds); routine bar (no sev>=2); 1 polish round (weathered splayed whip antennae). Reads as a distinct, tone-appropriate leaning comms tower.
- **Spend:** ~500K est. (campaign total ~1.9M / 10M; cycle 5/50).
- **Next:** cycle 6 -> M6 A2 buried_pipeline (a surfacing/sinking pipe run — the low horizontal silhouette).

## Cycle 4 — M5 diurnal-cycle (2026-07-09) — SHIPPED

- **Planned:** bind lizards/shrews/vultures/worms to time-of-day (feature-audit first).
- **Audit:** worms ALREADY fully twilight-bound (ACC twilightActivityMultiplier + ambient breach, D121) → verify-only. Lizard/shrew/vulture had zero time hooks → built.
- **Shipped (D284):** NEW `enemies/diurnal.ts` — one pure `diurnalActivity01(ctx, profile)`. Lizards diurnal (spot radius + flee speed scaled, night bob suppressed); shrews crepuscular (idle time ÷ activity bell, wander pace eased); vultures day-fliers (no perch launch + no hunt dives below the roost line). Scalars on existing FSMs — no new states, no save fields. `__game.diurnalInfo()` + NEW permanent `diurnal-probe` gate (dawn found by sunHeight sweep; curve + perched-launch behavior asserted).
- **Verify:** all 7 gates PASS (verify:all · smoke-intro · smoke-pod-tutorial · pickup-take-sweep · survival-probe · ambient-beds · diurnal-probe — noon 1/.25/1, midnight .15/.25/0, dawn shrew .998, vulture stayed-then-launched).
- **Visual iteration:** N/A — behavior scalars; the night-read (sleeping lizards/roosting vultures) is an end-review walk item.
- **Spend:** ~250K est. (campaign total ~1.4M / 10M; cycle 4/50).
- **Next:** cycle 5 → M6 POI breadth (2-3 new socket-grammar archetypes; verify:placement + verify:colliders gates).

## Cycle 3 — M4 ambient life beds (2026-07-09) — SHIPPED

- **Planned:** M4 — procedural day/night ambient beds (wind stays muted).
- **Shipped (D283):** `makeNightBedBuffer` (sparse cricket chirp-trains, ~22s loop) + `makeDayBedBuffer` (breathing heat-shimmer + 1-2 distant falling cries, ~26s) attached as SAMPLE-FALLBACK sources on the existing silent `ambient.day/night` stems (`attachProceduralBed`) — full mixer reuse (crossfade/storm-mask/masters/suppression); real samples auto-win if they land. Sparseness baked into the buffers. Snapshot gains `bedSrc` + `bedTargets`; NEW permanent `ambient-beds` gate (attach + crossfade + REAL-storm duck via triggerStorm + wind-still-muted).
- **Verify:** verify:all PASS · smoke-intro {ok,beats:12} · smoke-pod-tutorial ok · pickup-take-sweep PASS · survival-probe PASS · ambient-beds PASS (noon day 0.35/night 0; midnight flipped; storm 0/0; pwind 0).
- **Visual iteration:** N/A (audio) — tone FEEL (lonely vs annoying) is an end-review item; density conservative by construction.
- **Spend:** ~250K est. (campaign total ~1.15M / 10M; cycle 3/50).
- **Next:** cycle 4 → M5 living world (diurnal creature activity).

## Cycle 2 — M3 survival depth (2026-07-09) — SHIPPED

- **Planned:** M3 as re-scoped in cycle 1 — (a) C31 sun-occluder decouple + coverage, (b) water-scarcity/exposure.
- **Shipped (D282):** `SUN_OCCLUDER_MIN_HEIGHT` (2.5m) decoupled from the 8m silhouette constant; procgen POIs (both branches) + wreck-yard hulks register post-placement bboxes as occluders → **3→51** in the probe seed (static boot sites only — meteor/debug spawns excluded to avoid stale-occluder leaks). `THIRST_SHADE_RELIEF` (0.8): open-air daytime shade slows water loss, gated (!inShelter + daytime) so all four C38 bands stay byte-identical BY CONSTRUCTION (design chosen over sun-drives-thirst precisely to avoid autonomous drift of the human-ratified curve). NEW `heat-shade` probe env (tops thirst/hunger to isolate temperature) + gate assertions: shade SURVIVES midday (minHealth ≥0.95) and occluder coverage ≥20; the gate now throws on failure.
- **Verify:** verify:all PASS · smoke-intro {ok,beats:12} · smoke-pod-tutorial ok · pickup-take-sweep PASS · survival-probe PASS (7.54/8.67/10/15 unchanged; shade=true; occluders=51).
- **Visual iteration:** N/A — pure systems/tuning cycle.
- **Spend:** ~300K est. (campaign total ~900K / 10M; cycle 2/50).
- **Commit:** (this cycle's commit — SHA in git log)
- **Next:** cycle 3 → M4 ambient life beds (procedural day/night synthesis in soundscape.ts; wind STAYS muted).

## Cycle 1 — M1 perf + housekeeping (2026-07-09) — SHIPPED

- **Planned:** M1 (pickup-instancing, decisions-archival, panel-deadcode, crash-heat guard, doc-scrub).
- **Shipped:**
  - Pickup instancing (D281): branch/scrap → shared InstancedMesh pools; `instanceId→pickupId` raycast resolver; swap-with-last slot frees + index fixup; overflow fallback; seeded rand order preserved. drawCalls 852→817 at the probe cam (worst-case dense-view flattened; +70K always-drawn tris accepted). NEW permanent gate `pickup-take-sweep` (6 real E-takes end-to-end incl. the swap-fixup case + id↔slot bijection invariant).
  - decisions.md archival D221–D235 (280=280 conserved) · panel dead-code sweep (backlog stale — mostly pre-shipped; deleted `clearPanelDebris`) · `survivalProbe` crash-heat guard · endgame-finale candidates scrubbed from CLAUDE.md/roadmap/next-session-prompt.
- **Discovery (feature-audit):** M2 "survival curve" was ALREADY BUILT + probe-pinned (C38/D246: heat 7.54 / cold 8.67 / thirst 10 / hunger 15 min; prepared heals; death UI) — the planning input was stale. M2 → verify-only, re-run green this cycle. M3's sun-shade half also pre-shipped (C31) → M3 re-scoped to the occluder-threshold decouple + water-scarcity.
- **Verify:** `verify:all` PASS (tsc + placement + colliders 40-audits) · `smoke-intro` {ok,beats:12} · `smoke-pod-tutorial` ok · `pickup-take-sweep` PASS · `survival-probe` PASS (guard active).
- **Visual iteration:** N/A — pure perf/debt cycle (appearance unchanged by construction; instance positions proven by the take-sweep gate).
- **Spend:** ~600K est. (campaign total ~600K / 10M; cycle 1/50). The take-sweep harness burned ~5 diagnostic rounds (stale-body, 3P boot, settle-drift) — lessons embedded in the gate + D281.
- **Commit:** (this cycle's commit — SHA in git log)
- **Next:** cycle 2 → M3 survival depth: (a) C31 sun-occluder decouple + occluder coverage, (b) water-scarcity/exposure.

## Cycle 0 — campaign started (2026-07-09)

- **Goal:** sharpen/deepen the existing game — no new pillars, no tone change, no endgame.
- **Budget:** max-cycles 50 (hard stop) · ~10M output-token soft ceiling.
- **Checkpoint:** `none`, with two sanctioned pauses (Skyfall pre-detail `[feel-critical]`; any SAVE_VERSION bump).
- **Verify gate:** `npm run verify:all` + `smoke-intro`/`smoke-pod-tutorial` + adversarial visual gate on visual cycles.
- **Ladder:** M1 perf/housekeeping → M2 survival-curve (flagged) → M3 survival-depth → M4 ambient beds → M5 diurnal-cycle → M6 POI archetypes → M7 Skyfall `[feel-critical]`.
- **Excluded:** the Phase-A feel-pile (attended sessions).
- **Setup done:** session-end docs committed to `master` (`873d310`, tagged `session-ACN`); guard hook installed + behaviorally confirmed (blocks `rm -rf`/`reset --hard`/force-push under `overnight.lock`); `campaign/2026-07-09` branch created; old 2026-06-18 campaign state archived; `.gamedev-framework/overnight.lock` set.
- **Next:** cycle 1 builds M1.
