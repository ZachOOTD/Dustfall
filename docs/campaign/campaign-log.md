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

## Approval — 2026-07-12 — M7 Skyfall plan APPROVED with changes (gate cleared)

Human `/campaign-approve` at the cycle-8 plan-review pause. Answers: **placement = the S4 far-field landmark slot** (region-rolled hero landmark kind in the infinite world — the slot Infinite Sands reserved), interior = **larger** (~25m, 2-3 compartments), archetype = **heavy freighter**, **FEATURES.skyfall flag = yes**. The feature doc gained a binding "Infinite Sands reconciliation" section (descriptor purity D290, streamed teardown D292/rule 9, deferred-piece hitch discipline D296, chunkDiffs persistence D298 — the no-save-bump DoD holds). Between the pause and this approval, the WORLD SHIPPED INFINITE (campaign "Infinite Sands" S1-S6+S5, merged to master + deployed 2026-07-12) — M7 resumes on fresh branch `campaign/2026-07-12-skyfall` off post-merge master. Flag: the human may switch Fable 5 → Opus 4.8 mid-campaign (steering note added). Next: S1 research + exterior blockout.

## Cycle 9 — M7 Skyfall S1: exterior blockout (2026-07-12) — SHIPPED
- Planned: research + exterior blockout of the hero freighter as an S4 far-field landmark kind.
- Shipped: `skyfall_freighter` live in the region-kind roll (34%, FEATURES.skyfall kill-switch restores the pre-M7 50/50 exactly); NEW src/world/skyfallWreck.ts (~46m crashed heavy freighter: container spine + crane rail, fore-starboard bridge tower, engine block + triple nozzles, snapped stern w/ dark torn mouths, deep keel bury, NO mounds); research digest docs/research/crashed-freighter-silhouettes.md; NEW fast `skyfall-shot` rig scenario. D300.
- Steering (mid-cycle, applied): sand mounds removed + retired for Skyfall; S2+ interior bar = intro-ship detail in the wrecked style (bound in feature doc); stale headless shells reaped. Lesson logged: never reap while a probe is live.
- Verify: verify:all PASS · 5 smokes PASS · chunks gate re-run green after the mound removal.
- Visual iteration: 4 rounds real-streamed-view (procedural-modeler) + a 2nd-seed generality check + my own read of the final shots; residual S3 nits logged in the agent report + feature doc.
- Spend: ~350K (campaign total ~3.55M / 10M; cycle 9/50)
- Commit: (this cycle's commit — see git log on campaign/2026-07-12-skyfall)
- Next: cycle 10 = S2 enterable interior + colliders + the skyfall-walk probe → then the ⏸ post-blockout walk-test pause.

## Cycle 10 — M7 Skyfall S2 (enterable interior) + probe infra (2026-07-13) — SHIPPED
- Planned: enterable greybox interior + colliders + the skyfall-walk real-motion gate. (User pre-cycle: do the probe-infra speedups first, then finish the campaign overnight.)
- Shipped: (infra, D301) GPU headless default + streamToSite single-teleport streaming → skyfall-shot 8min→26s, verify:chunks ~15min→2m41s, full suite ~30min→6min, CPU freed. (S2, D302) fore hull opens into a walkable interior — deck, 3 compartments, 2 doorways w/ sills, former-ring entry, exact collider set; NEW permanent skyfall-walk gate; stern-collider-in-mouth + hull-float-over-slopes bugs probe-caught + fixed.
- Verify: verify:all PASS (placement 5-seed, colliders, chunks incl skyfall-walk seeds 1337/808/7) · 5 smokes PASS · interior shots render correct.
- Visual iteration: interior is greybox (correct for S2 — S3 does hero-detail + lighting). Confirmed by my own read of int-mouth/hold/mid/cabin.
- DECISION (transparency): the charter's ⏸ post-blockout human walk-test (feel-review) is CONVERTED to a morning review item, NOT a mid-build stop — the user explicitly authorized an overnight "finish the campaign, want it done when I wake up" run. Collision is gate-proven (skyfall-walk); the un-automatable part (subjective feel/scale) becomes the morning walk-test. Building S3-S5 on top of gate-proven collision maximizes what the user wakes up to.
- Spend: ~350K (campaign total ~3.9M / 10M; cycle 10/50)
- Commit: (this cycle's commit — see git log)
- Next: S3-S5 hero detail (exterior plating/weathering + interior to intro-ship detail in the wrecked style + lighting + Skyfall landing-fire fix), then S6 integration+loot, then the morning walk-test + summary handoff.

## Cycles 11-13 — M7 Skyfall S3/S4-S5/S6 + probe infra (2026-07-13, overnight) — SHIPPED · M7 LADDER COMPLETE
- Context: user reported dev felt slow + CPU pinned; authorized an overnight "do the infra speedups, then finish Skyfall" run (switched to Opus 4.8 partway).
- Probe infra (D301): GPU headless default (~10× faster, CPU-cool) + single-teleport streaming. skyfall-shot 8min→26s, verify:chunks ~15min→2m41s, suite ~30min→6min.
- Cycle 11 (S3): exterior hero detail — cargo-hauler read (multicoloured containers, plating, greebles, de-snowed weathering). procedural-modeler, 6 rounds.
- Cycle 12 (S4-S5): interior hero detail to intro-ship density in the wrecked style (hold/machine-bay/cabin) + "sun through the tear" lighting. procedural-modeler, 7 rounds. Digest unchanged (interior consumes zero rand).
- Cycle 13 (S6, D303): interior salvage loot (2 cabin panels, persist via the S5 chunkDiffs chain) + the pilot's crash-log journal (clean teardown, numeric-probe-verified). Occluder registration dropped (no removal path for streamed content). Position-seeded loot → determinism byte-unchanged.
- Gates: every cycle verify:all + smokes green; skyfall-walk green throughout; digest stable 65f211f8; released origin world + intro byte-unchanged.
- DECISION (transparency): the charter's post-blockout human walk-test (feel-review) was deferred to the morning review per the user's explicit overnight "finish it" instruction — collision is gate-proven, so S3-S6 built on top; the un-automatable feel/scale/lighting judgment is the owed morning step. Campaign set to paused/awaiting_approval/feel-review.
- Spend: ~800K across 3 cycles (campaign total ~4.75M / 10M; cycles 11-13/50).
- Commits: fc3da47 (S3), 907e93d (S4-S5), 53fbec8 (S6) + bd8c819 (infra) on campaign/2026-07-12-skyfall.
- Next: the human walk-test (morning-summary-2026-07-13.md), then /campaign-approve → merge review.

## Setup — 2026-07-13 (evening) — M7 walk-test feedback → M7-R + M8-M12 queue, +4M overnight
- Zach walk-tested the shipped Skyfall wreck and gave M7-R feedback (real hull thickness / no paper-thin double-sided models / floating-model audit / 100% collision incl. the dorsal containers / more interior detail / broken cockpit glass / captain-log "crew ejected in drop pods" story). Spec: `docs/feature-skyfall.md` M7-R section.
- Chose the world-deepening queue for after Skyfall: M8 far-field vultures, M9 new POI archetypes, M10 more story vignettes, M11 retire legacy tube-wrecks (ship->socket), M12 new far-field biome.
- Cleared the M7 feel-review pause (walk-test done). Campaign active; budget capped +4M (ceiling 8.75M); checkpoint none (overnight). New locked_constraint: models-need-thickness.
- Next: cycle 14 = M7-R Skyfall refinement (start with the hull-thickness rebuild + collision sweep).

## Cycle 14 — M7-R part 1: Skyfall real hull thickness + 100% exterior collision (2026-07-13) — SHIPPED
- Planned: fix the paper-thin double-sided hull (user's #1 walk-test complaint) + the dorsal-container collision gap.
- Shipped: HULL_THICK 0.35→0.7 + torn fractureRim() → thick solid torn-steel cross-section at both mouths; _voidMat DoubleSide→FrontSide; +6 dorsal-container colliders + bridge extend (rule-9 sweep); generalized to CLAUDE.md rule 7 (no paper-thin double-sided). Bonus: closed a latent invisible-wall gap. D304.
- Verify: verify tsc · verify-chunks (det 8/8 both seeds, streaming no-leak, perf untripped) · skyfall-walk PASS.
- Visual iteration: 3 rounds real-view (procedural-modeler) + seed-808; my own read of int-mouth confirms the thick torn cross-section. Container stand-on + i=5 cantilever flagged for the walk-test.
- Spend: ~300K (campaign total ~5.05M / 8.75M; cycle 14/50)
- Commit: see git log
- Next: cycle 15 = M7-R part 2 (interior floating-model audit + more interior detail; then glass, then captain-log).

## Cycle 15 — M7-R part 2: Skyfall interior floating-audit + detail (2026-07-13) — SHIPPED
- Planned: fix floating interior models (user: "panels neatly placed on the wall exactly, not floating") + more interior detail.
- Shipped: 8 floaters grounded flush (mid/bow consoles were 0.1-0.4m off deck/wall → floor-standing w/ matched colliders; conduits/placard/crates/pedestals re-seated); a lived-in detail pass across HOLD/MID/CABIN (wall-hugging, off-lane, shared materials, deterministic).
- Verify: verify tsc · skyfall-walk PASS · verify-chunks (det 8/8 both seeds, no-leak, perf untripped).
- Visual iteration: 2 rounds real-view + seed-808; my read confirms the mid console grounded on the deck. Float fixes are exact-geometry (not eyeball).
- Flag (3rd time): CABIN too dark → new detail + loot + journal barely visible. Cycle 16 folds a small reversible visibility lift with the glass. Moody-vs-lit stays the user's call.
- Spend: ~200K (campaign total ~5.25M / 8.75M; cycle 15/50)
- Commit: see git log
- Next: cycle 16 = broken cockpit glass + small cabin-visibility lift; then cycle 17 = captain's-log story.

## Cycle 16 — M7-R part 3: Skyfall broken cockpit glass + cabin light (2026-07-13) — SHIPPED
- Planned: a shattered cockpit windscreen (user: "glass front in the cockpit like the intro ship, could make it broken") + a small reversible cabin-visibility lift (dark-cabin flagged 3×).
- Shipped: broken canopy on the bridge (mullion grid, cracked/blown cells, impact punch-through, sill+deck shards; 3 module-singleton glass materials, transparent panes unmerged); scoped warm cabin fill SKYFALL_CABIN_FILL=1.05 (aft stays dark → mood preserved; =0 reverts).
- Verify: verify tsc · skyfall-walk PASS · verify-chunks (det 8/8 both seeds, no-leak, perf untripped).
- Visual iteration: 3-round glass + 2-round cabin (procedural-modeler) + seed-808; my read confirms the shattered canopy + the now-legible cabin.
- Spend: ~200K (campaign total ~5.45M / 8.75M; cycle 16/50)
- Commit: see git log
- Next: cycle 17 = captain's-log story (crew ejected in drop pods) — the LAST M7-R fix; then the M8 world queue.

## Cycle 17 — M7-R part 4 (FINAL): Skyfall captain's-log story (2026-07-13) — SHIPPED · M7-R COMPLETE
- Planned: the captain's-log story (user: "crew is ejecting in the drop pods, a little story") — the last M7-R fix.
- Shipped: NEW generateSkyfallLog(seed) in crashLog.ts (drop-pod-evac captain's log — order all hands to the pods → captain rides her down alone; Long-Dark restraint, no bodies, ties to the player's own pod). Wired onto the wreck's bow-console journal (replaces the generic freighter log). Text-only, no save bump, deterministic per seed.
- Verify: verify:all PASS (placement/colliders/chunks) · skyfall-walk PASS · tsc clean.
- 🏁 M7-R COMPLETE — all 6 Zach walk-test fixes done (c14 thickness+collision, c15 floating+detail, c16 glass+cabin-light, c17 captain-log).
- Spend: ~150K (campaign total ~5.6M / 8.75M; cycle 17/50)
- Commit: see git log
- Next: cycle 18 = M8 far-field vultures (feature-slice it: solve the D294 chunk-model tension for aerial life).

## Cycle 18 — M8 far-field vultures (2026-07-13) — SHIPPED
- Planned: aerial life for the infinite world (D294 deferred — the vulture system fought the chunk model).
- Shipped: streamed CIRCLING vultures (the FSM's circling state is self-contained → pure circlers over a chunk point sidestep the perch-coupling). New spawnCirclingVultureAt + removeVultureFromWorld (idempotent) in vulture.ts; roamVultures roll in chunkManager (CHUNK_VULTURE_CHANCE 0.06, streamed load/unload, transient). D305.
- Verify: verify:all PASS + 5 smokes · verify:chunks NO body leak (332→332) · numeric probe: 6 circling vultures at altitude in the far field.
- Spend: ~250K (campaign total ~5.85M / 8.75M; cycle 18/50)
- Commit: see git log
- Next: cycle 19 = M9 new POI archetypes (feature-slice; M6-style gate-verified, 2-3 new far-field destination types).

## Cycle 19 — M9 archetype 1/3: refinery_stack (2026-07-13) — SHIPPED
- Planned: new POI archetype #1 (a fuel-refinery/cracking-tower ruin) — feature-sliced 3 concepts (docs/feature-poi-archetypes-m9.md).
- Shipped: refinery_stack — a distinct vertical industrial silhouette (banded column, spherical + drum tanks, manifold, flare, valve skid w/ salvage panel); fully wired (poiComponents/poiArchetypes/ARCH_WEIGHTS), streams via the POI roll. sandMound:false (steering), real thickness, 7/7 colliders.
- Verify: verify tsc · verify:colliders 0 fails · verify:placement 0 fails (5 seeds) · verify-chunks no body leak (335→335) · 3-round + 4-seed real-view.
- Spend: ~250K (campaign total ~6.1M / 8.75M; cycle 19/50)
- Commit: see git log
- Next: cycle 20 = M9 archetype 2/3 = hab_dome (collapsed habitat-dome cluster; note the modeler's tip — getBucketMats forces DoubleSide so a torn dome shows interior; collision = side-wall boxes + auditExempt like huskShell).

## Cycle 20 — M9 archetype 2/3: hab_dome (2026-07-13) — SHIPPED
- Planned: new POI archetype #2 (collapsed habitat-dome cluster — the rounded silhouette).
- Shipped: hab_dome — 2 ribbed geodesic dome shells (torn breach, inner liner for thickness), connecting corridor + airlock (salvage panel), portholes, dead-comms mast. Hollow shells auditExempt + arc-segment wall colliders; cool bucket, sandMound:false. Fully wired, streams via the POI roll.
- Verify: verify tsc · verify:colliders 0 fails (65 audits) · verify:placement 0 fails (5 seeds) · verify-chunks no body leak (336→336) · 3-round real-view.
- Note: the collider-audit archetype list in scripts/rig-shot.mjs is HARDCODED (separate from ARCHETYPES) — extend it for transit_car.
- Spend: ~250K (campaign total ~6.35M / 8.75M; cycle 20/50)
- Commit: see git log
- Next: cycle 21 = M9 archetype 3/3 = transit_car (half-buried rail car; warm bucket; box-collider precedent in crawlerBody).

## Cycle 21 — M9 archetype 3/3: transit_car (2026-07-13) — SHIPPED · M9 COMPLETE
- Planned: new POI archetype #3 (half-buried rail car) — completes M9.
- Shipped: transit_car — boxy car bodies on bogie trucks (paired flanged wheels, couplers, window strip + cargo door w/ salvage panel, roof vents, ladder), rear car jackknifed + sunk. Solid box colliders; warm bucket, sandMound:false, real thickness. Fully wired + added to the hardcoded collider-audit list.
- Verify: verify tsc · verify:placement 0 fails (5 seeds) · verify:colliders covered · verify-chunks no body leak · 4-round real-view.
- 🏁 M9 COMPLETE — 3 new far-field POI archetypes (refinery_stack, hab_dome, transit_car).
- Spend: ~250K (campaign total ~6.6M / 8.75M; cycle 21/50)
- Commit: see git log
- Next: cycle 22 = M10 story vignettes (expand the wordless tableaus).

## Cycle 22 — M10 story vignettes (2026-07-13) — SHIPPED
- Planned: more wordless environmental-story tableaus.
- Shipped: 3 new NO-body vignettes (cold camp / stripped / the cache) + 4 props (bedroll/crate/wheel/tool) in wordlessScenes.ts (ARCHETYPES 2→5). Variety vs the 2 skeleton scenes; "the crew is gone, implied by what's left." Decoration-only, shared materials, real thickness, no mounds, deterministic.
- Verify: verify:all PASS · 2 new vignettes confirmed reading their story in-world (cold-camp, stripped).
- Spend: ~150K (campaign total ~6.75M / 8.75M; cycle 22/50)
- Commit: see git log
- Next: cycle 23 = M11 retire legacy tube-wrecks (ship->socket, D227/D249) — a systems refactor; ~2M budget left (may hit the cap mid-M11 → stops cleanly at 'budget').

## Cycle 23 — M11 retire legacy tube-wrecks (2026-07-13) — SHIPPED
- Planned: retire the legacy linear tube-wreck (D227/D249 owed) — INVESTIGATED first (they twice rejected the risky ship->socket rewrite; the strategy was to shift load to the socket derelict + shave ship).
- Shipped: finished that strategy the low-risk way — `ship` removed from ARCH_WEIGHTS (weight → derelict), pickArchetype fallback retargeted ship->derelict. pickArchetype can NEVER return the tube now. Config-only. D306.
- Verify: verify:all PASS · numeric far-field histogram: 0/278 POIs are ship, varied spread (derelict ~20% + 13 others).
- Spend: ~150K (campaign total ~6.9M / 8.75M; cycle 23/50)
- Commit: see git log
- Next: cycle 24 = M12 new far-field biome (~1.85M left — likely hits the 8.75M cap during/after; stops cleanly at 'budget').

## Cycle 24 — M12 the ash_barren biome (2026-07-13) — SHIPPED — 🏁 QUEUE COMPLETE
- Planned: a new far-field biome (the 5th and last queued overnight item).
- Shipped: `ash_barren` — a rare regional-anchored scorched-flats zone (dark charred ground + cinder mottle + low flatten + a burned-industrial POI mix), mirroring the wreck-yard regional anchor with its own appended seed (yard byte-identical) and NO origin anchor (far-field only, ≥2600m). Distinct from the light salt/dune/rocky desert.
- Verify: verify:all PASS (placement 5-seed / colliders / chunks); a numeric probe found an ash_barren zone (biomeAt confirmed); a shot showed the dark ground reading distinct.
- Visual iteration: 1 shot confirmed distinct; the core biome shipped. Residual flagged: the dark read could be pushed more dramatic (a polish pass — routed to the human review, NOT punted, since the coherent biome DoD is met).
- Spend: ~350K (campaign total ~7.25M / 8.75M cap; cycle 24/40).
- Commit: 7378b92
- Next: **NONE — the queue is empty.** Campaign `completed` (until-met). Awaiting Zach's morning walk-test + merge review.
