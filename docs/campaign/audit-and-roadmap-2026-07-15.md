# Dustfall — audit + forward roadmap (2026-07-15)

Senior design/dev audit + a complete phased plan, grounded in the repo as of branch
`campaign/2026-07-12-skyfall` @ `5ca0523` (review fixes + Phase 1 committed, **nothing pushed to master**).
Sources: CLAUDE.md, GDD, roadmap, decisions (D247–D307 active + archive headers), backlog, architecture,
changelog, campaign state/logs/morning-summaries, `feedback-and-ideas-2026-07-15.md`, and a source-tree
survey (file paths + counts below are from code, not docs — several docs have drifted; see §A3.4).

---

# Part A — AUDIT

## A1. Where the game is now

### The shipped game (facts from source)

| Area | State |
|---|---|
| Core loop | Escape-pod intro (LIVE opening) → wake in the crashed pod → tutorial → scavenge / drink / craft / shelter / sleep → speeder → far-field destinations. Diegetic survival HUD default-ON (`FEATURES.diegeticSurvival`). |
| World | **Infinite** streamed world (SAVE_VERSION 17 `chunkDiffs`, descriptor-pure determinism, perf-sliced generation, gate-proven persistence). 5 biomes (`dune / rocky / salt / wreck_yard / bone_field` — note: M12's `ash_barren` was **replaced** by `bone_field` on 07-14). Region-grid hero landmarks: `colossal_ribcage`, `wreck_knot`, `skyfall_freighter` (enterable, hero interior + loot + journal), plus the fixed big-fin **leviathan** (now with a walkable hero interior) and the boneyard ribcage hero. |
| POIs | **16 procgen archetypes** (`poiArchetypes.ts`) — derelict, hollow/crash husk, enterable_wreck, satellite, tank, debris field/trail, well, watchtower-era pieces, relay_mast, buried_pipeline, cargo_crawler, refinery_stack, hab_dome, transit_car; legacy tube-`ship` retired from the roulette (D306). Salvage panels: pry → per-component extract, condition tiers, stencil-portal interiors, WYSIWYG depletion, pop-off doors. 5 wordless story vignettes. |
| Creatures | Sandworm (breach-dive, noise detection, shelter immunity), vultures (rigged, carcass ecology + streamed far-field wheelers), lizards, shrews, companion "Pebble" + **egg in the deep cave (wired end-to-end)**, sarlacc pit hazard. Diurnal activity binding. Raiders dormant by design (D238). |
| Items/crafting | **52 ItemIds**, **20 recipes**, pickup-gated discovery + card-grid UI (D277). 4 guns + melee spread. Raw-material vocabulary is thin: essentially `scrap / cloth / branch / rope` (+ food/ammo). |
| Vehicles/hauling | Hover speeder (mount, chase cam, seated rig, static-merged), sled + inextensible tow rope (`rideableSled` flag exists but is **inert — zero code readers**), Verlet `realRope`/`realCloth` foundations behind OFF flags. |
| Weather/sky | Day/night, clouds, storm state machine + **new approaching dustwall** (`dustWall.ts`) + whiteout fog + wind-audio ramp, cloud shadows, fireball/worm-horizon spectacles. |
| Audio | `audio.ts` 2261 LOC, ~65 procedural one-shot SFX + loops; `music.ts`/`soundscape.ts` exist but the **life-beds + music are effectively silent** (D283 procedural beds user-vetoed and reverted; wind muted "for now" at user request). |
| Distribution | Live on GH-Pages + Tauri desktop exe (unsigned, pre-procgen build). |
| Verification | `verify:all` = tsc + placement (5-seed bury audit) + colliders (coverage audit) + chunks (determinism / leak / perf / skyfall-walk); ~25 rig-shot scenarios; smoke suites (intro, tutorial, pickups, survival, diurnal); `model-stage.mjs` geometry lint (floaters/z-fights/penetrations/orphans); GPU headless probes (~10× faster, D301). |

### Against the GDD vision

The game **exceeds** the GDD's written scope (GDD still says 2400m world, single worm, "no multiplayer
planned", tier-ladder history) while staying true to its four load-bearing pillars: lone-survivor tone,
procedural-everything, browser-first, tactile world. The pillar that has slipped is the **implicit fifth** —
The Long Dark's *quiet survival rhythm*. The world is now gorgeous, infinite, and destination-rich, but the
moment-to-moment survival loop pays out a shallow material economy (find scrap+cloth again), the audio bed
is silence-plus-wind, and the "is ~10 minutes tense-but-fair?" survival-curve feel test has still never been
run by a human on a real new game. GDD §13's success conditions (30-min average session, 5/5 testers want
more) have never been measured.

### Standout strengths

1. **The verification culture.** Machine gates that permanently close bug classes (bury-audit, collider
   audit, chunk determinism, skyfall-walk) are genuinely rare discipline; regressions in gated classes are
   now structurally impossible.
2. **The procedural asset pipeline at its best** — the escape-pod intro, the Skyfall freighter, the storm.
   When the loop iterates to convergence with a human in it, the output is legitimately good for code-only art.
3. **Infinite Sands** — streaming, determinism, and sparse persistence shipped near-flawlessly in 7 cycles
   / ~1.3M tokens, with the released origin world byte-identical. This is the project's best campaign and
   the template for what "overnight-safe" means: crisp machine-checkable invariants.
4. **Tuning.ts discipline + additive-save discipline (D81)** — never violated across 300+ decisions.

### Weakest links (ranked)

1. **Loot/crafting economy** — the search-and-survive loop's *payoff*. 16 POI archetypes all yield the same
   4-5 materials; every recipe crafts from scrap+cloth+branch+rope. Exploration is visually rewarded but
   mechanically flat. (The user's feedback B3–B5 targets exactly this — correctly.)
2. **Audio identity** — the weakest pillar vs the Long Dark reference. No music, no life-bed, muted wind,
   several "cute/beepy" SFX the user dislikes. Audio is also the *least machine-verifiable* area, which is
   why the autonomous loop has under-served it (see A3).
3. **Hero-model solidity** — the same three geometry bug classes (paper-thin shells, floaters, collision
   mismatch) have recurred across ~every hero asset for two months; feedback §A is literally a list of the
   latest instances (leviathan exterior collision, boneyard backface see-through, Skyfall open ends).
4. **Felt-quality debt** — backlog §A is a large pile of shipped-but-never-felt systems (survival curve,
   diegetic HUD, storm feel, ride feel, cave descent, sarlacc pull…). Content breadth is outrunning
   human validation bandwidth.
5. **Progression arc** — by design there is no XP, but the *player-mastery* arc (better tools → further
   ranging → richer finds) currently tops out fast because the material economy is flat (see #1).

## A2. Gaps — what would most raise quality

In descending order of game-quality-per-effort:

1. **Material/recipe/loot depth (feedback B3+B4+B5 as ONE system).** A richer material vocabulary
   (electronics, machine parts, bars, glass, wiring…) + per-archetype loot identity ("refineries yield
   machine parts; hab domes yield electronics") turns the 16 archetypes from scenery into *destinations
   worth choosing between* — the "scan horizon → pick a POI" beat in GDD §4 becomes a real decision.
   This is the single biggest lever on the core loop.
2. **Audio bed + de-cute.** A quiet procedural night-insect bed, a sparse drone score, rebalanced wind,
   rugged SFX. Cheap in LOC, huge in tone — and it directly serves the #1 pillar (solitude + weathering).
3. **Sightline/traversal drama (mega dunes + ridable sled).** The infinite world is legible everywhere;
   a dune-sea erg where you *can't* see far until you crest — then sled down the far side — adds the
   missing terrain verb and the "what's over that ridge" moment GDD §13 names as the success condition.
4. **The cave system (the egg's home).** The one genuinely *interior* exploration space; dark-nav +
   torch economy gives the flashlight/torch items a reason to exist. High effort, high payoff, known
   physics unknowns (D254).
5. **Survival-feel validation.** Not new code — a human hour on the survival curve, diegetic HUD, storm,
   and stamina cadence, then tuning. The systems exist; nobody has certified they're *fun*.
6. **World reactivity (longer-term).** The world barely reacts to the player beyond salvage depletion.
   Post-storm world rearrangement, flare consequences, worm ecology responses — all backlogged, all
   good, none urgent versus 1–4.

## A3. The development process — honest assessment

### What's working

- **Throughput + budget honesty.** "Sharpen & Deepen": 24 gate-green cycles, one revertible commit each,
  ~7.25M tokens under an 8.75M cap, sanctioned pauses honored, D81 never breached, morning summaries that
  candidly list what a still-render can't judge. This is a functioning autonomous factory.
- **Gates convert pain into permanence.** Every recurring failure that got a *machine gate* stopped
  recurring (buried panels, missing colliders on gated archetypes, chunk leaks). Every failure that got
  only a *rule in prose* recurred (thickness, floaters — until D304/model-stage).
- **Adversarial fresh-critic review works when used.** D230's 5-lens workflow caught 3 real collision bugs;
  the pod-as-Boba-Fett and floating-pod reads were caught *only* by fresh critics. The builder's
  self-critique reliably misses identity/pareidolia/placement errors (memory: hero-asset-adversarial-gate).
- **Specialist division of labor** (procedural-modeler agents own one module per hero asset; main loop
  integrates) has kept shared-file conflicts manageable.

### Recurring failure modes (with receipts)

1. **Visual self-grade inflation.** Work ships "gate-green + self-critiqued" and a human immediately flags
   it: ACAJ mega-wreck "boxy, shipped too early"; ABP's 41-minute "long overnight" shipped 4 shallow tiers
   (→ rule 8); Skyfall shipped S1–S6 with a paper-thin double-sided hull that survived *six cycles* of
   gate-green verification until the human walk-test (→ M7-R, D304, rule 7); the boneyard ribcage was
   built "upside-down twice" and redirected three times; the leviathan shipped an interior whose entrance
   faced a wall while the exterior opening led nowhere. The 07-15 morning summary itself: "not trusting
   the agents' self-grades — I caught and redirected several." **Root cause:** the gates verify
   *invariants* (colliders exist, panels aren't buried, tsc passes) but the *read* of a model — solid,
   oriented, enterable, believable — has been graded by the same agent that built it, from angles it chose.
2. **The same three geometry bug classes, for two months.** (a) Paper-thin/DoubleSide shells: AAJ
   (2026-05-21!) → AAL sweep → AAN/AAO sweeps → Skyfall D304 → leviathan exterior *still* single-skin →
   boneyard backface holes. (b) Floaters/unseated detail: ACAL ~16-floater hunt → Skyfall 8-floater audit
   → hab-dome floating cone → Skyfall floating fixtures *again* in the 07-15 feedback. (c) Collision ≠
   visual: escape-pod invisible walls (→ rule 9) → dorsal containers → leviathan exterior collision
   *deleted* when the interior replaced its blocking box. Rules 7/9 were written reactively; the only
   proactive detector (`model-stage.mjs` lint) covers floaters/penetrations/z-fights but **not**
   thin-shells, see-through backfaces, open torn ends, or collider-visual parity.
3. **Feel-debt outruns the human.** The loop generates verified-but-unfelt systems faster than one person
   can walk-test them; backlog §A has grown monotonically since D150. Some shipped systems (diegetic HUD,
   survival curve) carry a real veto risk that compounds the longer they sit unvalidated.
4. **Doc drift.** CLAUDE.md "Where we are now" describes cycles 9-13 awaiting approval (actual: 24 complete,
   campaign done); architecture.md's file map says "12 items, 3 recipes, main.ts ~130 lines" (actual: 52,
   20, ~1650); the GDD says the world is 2400m, one worm, and **"Not an MMO / multiplayer… No MP planned"**
   while multiplayer sits in the active idea list. Docs are the agents' ground truth — drift is a direct
   quality risk for autonomous work.
5. **Audio starvation is structural.** The loop optimizes for what it can verify. Audio has no gate and a
   proven human-veto risk (D283's beds were built gate-green and reverted on feel) → the loop rationally
   under-invests. Audio work *must* be human-in-the-loop by design, not left to overnight batches.
6. **Sequentialism from shared hot files.** `tuning.ts`, `poiArchetypes.ts` (ARCH_WEIGHTS), `types.ts`
   (ItemId union), `main.ts` tick order are contended by nearly every unit, which pushes overnight ladders
   into serial execution even when the work is conceptually parallel.

### Process recommendations (concrete)

1. **Build the SOLID-MODEL HARNESS before the next modeling campaign** — extend `model-stage.mjs` lint +
   a rig-shot scenario with the four missing detectors, wired into `verify:all` for any touched asset:
   - **Thin-shell/backface probe:** flag `DoubleSide` materials on closed-solid candidates; ray-pair test
     (enter/exit distance < ε ⇒ zero-thickness); render the asset from N grazing + interior angles against
     a chroma-key background and count bleed-through pixels (catches the boneyard vanish + Skyfall gaps).
   - **Open-end/jamb check:** for any mesh with declared openings (torn ends, entrances), verify a closed
     rim loop — the "torn edges always close with a solid thick cross-section" standing rule from feedback
     A3, as a detector instead of prose.
   - **Collider-visual parity, negative form:** the existing audit proves colliders *cover* meshes; add a
     walk-probe that drives the capsule along/through exterior surfaces and asserts blocked-outside /
     free-inside (the leviathan bug class — collision *deleted* under a visible hull — passes the current
     coverage audit's exemptions).
   - **Player's-eye shot set as the default review artifact:** grazing angles, into-the-tear, interior
     looking out — not builder-framed beauty shots (memories: verify-visual-multi-angle,
     verify-near-glass-from-outside).
2. **Blockout-approval checkpoint for hero assets.** The boneyard cost 3 redirects because orientation/read
   was wrong at the *concept* level. Rule: any hero asset gets a 12-shot turntable + reference-image board
   at blockout, human-approved (5 minutes async) before detail cycles are spent. This is the cheapest
   possible gate and it targets the most expensive failure.
3. **Fresh-critic gate as a hard requirement** for hero visuals (N≥3 critics who did not build it, at
   least one prompted adversarially "what is wrong with this"), already proven; make it non-skippable in
   the campaign charter rather than "visual_gate: auto".
4. **Feel-debt budget rule.** No new content-adding campaign while backlog §A exceeds ~10 open walk-test
   items; alternate build-nights with an attended "feel day" whose output is tuning commits + item closure.
   (The 07-15 review round is exactly this — formalize it.)
5. **Doc auto-sync at campaign end**: the closing cycle must diff-update CLAUDE.md "Where we are now",
   architecture.md's file map, and GDD deltas (`vision-deltas.md`) as a gated step. Schedule the GDD
   re-anchor (`/interview-vision`) **before** the multiplayer/character forks — the GDD currently
   *forbids* multiplayer.
6. **Registry-file merge discipline for parallelism:** fan out asset/module work (one agent = one new
   file), serialize only the tiny registry edits (ARCH_WEIGHTS, ItemId union, tuning constants) in the
   integrating loop; consider splitting `tuning.ts` into per-domain files (`tuning/world.ts`,
   `tuning/survival.ts`…) re-exported from one barrel to shrink the contention surface without breaking
   rule 2.

## A4. Risk / tech-debt register

| Risk | Severity | Notes |
|---|---|---|
| Held production push (branch ahead of master since 07-12) | Med | Growing big-bang merge; review + ship soon (Phase 0). |
| D254 open physics unknown: KCC under the heightfield | High for B7 | Blocks any real cave system; resolve with a 10-min attended spike **before** designing caves. |
| Yard cross-POI merge tar-pit (D240, 3 failed attempts, un-pinned audit regression) | Med | Do NOT re-attempt blind; perf is currently acceptable (field 842 / yard 1705 draws). |
| Draw-call creep as content grows | Med | Watch `perf-probe`; worst yard view 3215. Perf budget line exists — keep it. |
| Save-schema pressure from the material/loot expansion | Low-Med | New ItemIds are additive-safe; loot-table *changes* to already-streamed chunks are fine (transient), but panel *contents* persist via chunkDiffs — keep ids stable. |
| Desktop exe stale (pre-procgen) + unsigned + localStorage saves wiped on uninstall | Low | Rebuild at next release; signing ~$70-200/yr; file-based saves via Tauri fs backlogged. |
| GDD contradicts active direction (multiplayer, infinite world) | Med | Agents plan from the GDD; re-anchor before the big forks. |
| Known small bugs: attach_rope LMB double-fire, airlock z-fight motion-confirm, worm-hump read on salt flats | Low | Batch into a fix pass. |
| Single-human review bottleneck | Med | Mitigate with A3 recs 1-3 (make machines catch more before the human). |

---

# Part B — PLAN

Effort scale: **S** ≤1 cycle · **M** 2-4 cycles · **L** a campaign ladder (5-10 cycles) · **XL** multi-campaign.
"Overnight-safe" = machine/rig-verifiable to the quality bar without a human mid-loop (human still reviews at the end).

## B0. Shared systems to build ONCE (unlock multiple items)

| System | Unlocks | Notes |
|---|---|---|
| **Solid-model verification harness** (A3 rec 1) | A1, A2, A3, A4, every future asset incl. B5 panels, B7 cave props, C2 character | Build FIRST — it converts the review-fix pack itself into its own proving ground. |
| **Material + loot-table system** (B3 core) | B4 ground loot, B5 panel variety, recipe depth, per-archetype identity, future trade/economy | One data-driven registry: material ItemIds + per-archetype/per-panel-kind loot tables, replacing the three ad-hoc loot systems (`lootContainers.rollLoot`, `salvage.TABLES`, `COMPONENT_LOOT`). |
| **Blockout-approval + fresh-critic pipeline** (A3 recs 2-3) | Every hero asset: A2 boneyard redo, B1 dunes look, B7 cave, C2 character | Process, near-zero LOC. |

## B1. Item catalog

### Section A — review-feedback fixes (near-term polish/bugs)

| Item | Scope | Effort | Autonomy | Depends on | Human decisions needed |
|---|---|---|---|---|---|
| **A1 Leviathan** (`leviathanLandmark.ts`) | Restore exterior collision (walk-probe-verified); align entrance (interior mouth ↔ exterior opening as one thick jamb); interior fits inside exterior with no gaps/overlap; likely a Skyfall-style hull re-loft for real thickness | M | **Overnight-safe** once the entrance call is made — geometry + collision are exactly what the new harness verifies (`leviathan-walk` gate exists) | Solid-model harness (strongly) | Entrance: align interior to the FRONT opening vs new back opening + close front. Interior lighting: keep moody-dark or lift (one-line `FILL` constant either way). |
| **A2 Boneyard ribcage** | Diagnose the backface/see-through precisely (multi-angle probe FIRST); redesign: lower, longer, sunken — a colossal *sandworm* skeleton, keep walk-under; distance-surviving bone weathering/cracks; 100% collision; delete blob scatter | M-L | **Needs a blockout checkpoint** — this hero has been redirected 3×; concept read is the risk, not execution. Detail cycles after approval are overnight-safe | Harness; reference board | Skull: add a horned/tusked skull or stay ribcage-only (open question from 07-15). Approve the blockout silhouette before detailing. |
| **A3 Skyfall** (`skyfallWreck.ts`) | Cap BOTH torn hull ends with solid cross-sections; seat the floating end panels + mast fixture; jamb both fracture faces (stern never got one); fix deck z-fight (probe-first per memory); make the sky-crash (meteor) event's wreck BE this model | M | **Overnight-safe** — `skyfall-walk` gate + z-fight probe + the harness cover all of it; the crash-event unification is code plumbing | Harness | Confirm the integration intent: the crash event should land/point at a skyfall_freighter instance (assumed yes). |
| **A4 Hab dome** | Scale up ~1.2-1.4×; open + walkable connector tube (colliders); full accurate collision; seat/remove the floating cone | S-M | **Overnight-safe** (placement/collider gates + harness) | Harness (nice-to-have) | None. |
| **A5 Storm** (`dustWall.ts`, `weather.ts`, `sky.ts`) | Replace the re-yawed curved cylinder with a LINEAR advancing wall from one fixed wind direction (grows on horizon, sweeps through, no rotation); kill remaining distant outlines: earlier fog densening + sky-dome horizon flatten + optional hard draw-cull at peak | M | **Mostly overnight-safe** (rig stills verify geometry/occlusion) but advance-speed/wind loudness are ear/feel calls → end walk-test | — | How total should the whiteout be? (User may want *some* ground reference to navigate — flagged 07-15.) Wind loudness target. |
| **A6 Horizon worm** (`wormHorizonCrossing.ts`) | Lighter dusty brown at distance; sink body base below terrain (kill the floating read; also fixes the salt-flat hump-base nit) | S | **Overnight-safe** (rig-shot) | — | None. |

### Section B — new features

| Item | Scope | Effort | Autonomy | Depends on | Research | Human decisions needed |
|---|---|---|---|---|---|---|
| **B3 Crafting materials + recipes** ⭐ foundational | New material ItemIds (proposed: `scrap_metal`, `metal_bar`, `electronics`, `machine_part`, `wiring`, `glass_shard`, `chem_canister`, `power_cell` — final list = the human's call); realistic multi-material recipes; rework the 3 loot systems into one data-driven registry; per-archetype loot identity | M-L | **Split:** the *system* (registry, ItemIds, recipe wiring, craft-unlock gate re-verify) is overnight-safe; the *economy table* (what drops where, at what rates, what recipes cost) needs human sign-off BEFORE build — balance is taste | — | Survey survival-crafting material taxonomies (Long Dark / Rust / Subnautica) — cheap researcher agent | Approve the material list + a recipe/drop matrix (a 1-page table). Realism level (smelting? crafting stations? or bench-free like today). |
| **B4 Ground-loot variety** | New material types spawn scattered around wrecks/POIs (generalize the D299 scrap-ring pattern; `pickups.taken` persistence branch already exists); biome/archetype-flavored scatter | S-M | **Overnight-safe** (pickup-take-sweep + chunk gates cover it) | B3 | — | None beyond B3's matrix. |
| **B5 Panel/lootable variety** | New lootable *kinds* beyond the fuse-box: lockers, crates, machine-access panels; varied sizes/shapes/interiors mapped to the new materials; reuse `findSurfaceMounts` + greeble library + stencil portal | M | **Overnight-safe** for placement/collision (verify:placement + salvage-audit + harness); visual quality via the fresh-critic gate | B3; harness | — | None (visual approval at end review). |
| **B6 Infinite sprint + toggle** | Zero stamina drain on sprint; Left Shift becomes a TOGGLE; decide the stamina stat's fate | XS-S | **Overnight-safe** trivially | — | — | Does stamina survive for anything else (tow ×1.5, future melee) or is the stat retired/hidden? Keep sprint-thirst ×2.2? |
| **B1 Mega dune biome** | A rare regional **erg/dune-sea** biome (mirror the wreck_yard/bone_field regional-anchor pattern): much larger Sahara-scale dunes, sightline occlusion in the troughs, long views only from crests; near-empty by design; must respect KCC 50° climb limit, POI placement gates, speeder terrain-follow, descriptor purity (D290) | L | **Core is overnight-safe** (chunk determinism/placement/slope-walkability are machine gates); the *feel* (dune scale, crest payoff) is checkpoint-gated — plan 1-2 walk-test pauses | — | Dune-field synthesis on a heightfield (directional superposed noise / dune ridge functions) — researcher agent | Regional biome vs reworking global terrain (recommend: regional). Target dune height/wavelength (approve from a vista shot at blockout). |
| **B2 Ridable scrap sled** | Wire the inert `FEATURES.rideableSled` (D257 seat-teleport approach): `ridingSled` state gating updatePlayer + per-frame capsule seat pin in `updateSleds`; E mount / jump dismount; downhill gravity-slide fun | M | **Build overnight-safe behind the OFF flag**; the RIDE FEEL is the exact D125 failure class → human walk-test gates the flag flip. Cap at 2 approaches per D257 if it fights the KCC | Pairs with B1 (sled-down-a-dune is the payoff moment) | — | None upfront; feel veto at walk-test. |
| **B7 Cave system for the egg** | A real multi-chamber/branching dark cave replacing the single chamber (D255): descent, dark-nav + torch economy, the egg deep inside; "get it right" per user | XL | **NOT overnight-safe as a whole.** Sequence: (1) attended 10-min spike — can the KCC walk below the heightfield sheet and back (D254's open risk)? (2) design pass (gen method: room-kit under a carve vs tunnel-carving vs hand-authored modules; scale; light model); (3) then a checkpoint-gated campaign — collision/nav gates are machine-checkable, claustrophobic *feel* is not | D254 spike; harness; benefits from B3 (cave-exclusive materials give it a loot reason) | Cave-gen methods vs Rapier heightfield constraints; dark-nav/torch reference (Long Dark's caves) | Gen-method + scope approval after the spike; whether the egg stays the sole objective or the cave also gets exclusive loot. |

### Section C — carried-over big items

| Item | Scope | Effort | Autonomy | Depends on | Human decisions needed |
|---|---|---|---|---|---|
| **C1 Audio de-cute + audio identity** | Replace beepy/cute SFX (flare etc.); re-enable + rebalance wind; procedural night life-bed + sparse drone score (the D283 retry, with the human's ears in the loop this time); worm rumble polish | M | **Needs-human-direction by design** — no machine gate can judge it and D283 proved the veto risk. Format: attended listen session enumerates offenders + targets → agent re-synths in small batches → human listens per batch | — | The listen session itself; which sounds offend; music yes/no (GDD says deferred stems). |
| **C2 Character model + rig + animation** | Either (a) push the procedural rig past its documented "in-pipeline ceiling" (PM-D cloth, skinning, lighting mood) or (b) import a rigged glTF (breaks D1/D107 zero-asset) | XL | Research + spike overnight-safe; the fork decision and the quality bar are human | Prereq for good MP remote players — but note the existing procedural rig may be *adequate* for a co-op MVP silhouette | **The fork:** procedural (on-ethos, lower ceiling) vs imported (higher ceiling, breaks the pillar). Recommend: decide only after MP scope is decided — if MP is 2-player co-op, the current rig might ship it. |
| **C3 Multiplayer** | Co-op in the shared deterministic world (the seed+descriptor architecture is genuinely MP-friendly); needs a server (currently a zero-server static site), state sync (chunkDiffs, creatures, physics authority) | XL (largest item on the board) | Research campaigns overnight-safe; the build needs staged human checkpoints | C2 decision; GDD re-anchor (currently an anti-feature: "solo by design, no MP planned"); infra/hosting budget | **Scope:** 2-4 co-op vs many. **Infra:** hosted server (Colyseus 0.16 canon exists in shared-memory) vs P2P/relay. **Authority:** server-auth (canon) vs host-auth. **And the GDD change itself** — this reverses a written pillar; do it deliberately via `/interview-vision`. |

## B2. Phased ordering (the campaigns)

### Phase 0 — SHIP IT (attended, ~a day) — do first
Walk-test the held branch (skyfall/boneyard/leviathan/storm/POI density), make the four open feel calls
(skull, leviathan lighting, storm horizon, density), then **merge to master + redeploy + rebuild the
desktop exe**. Also: the doc-sync pass (CLAUDE.md "Where we are now", architecture.md file map, GDD deltas
note). Rationale: three campaigns of work are sitting unshipped; every day held raises merge risk, and the
07-15 feedback items will land on top of this branch anyway.

### Phase 1 — Campaign "SOLID" (overnight-heavy, ~8-12 cycles): harness + the fix pack
1. **Solid-model harness first** (B0) — then prove it by running it over leviathan/boneyard/skyfall/hab-dome
   and confirming it flags the known defects before fixing them (test-mode discipline, like model-stage's).
2. A6 worm (S, warm-up) → A4 hab dome → A3 Skyfall (establishes the torn-end jamb as a reusable pattern +
   detector) → A1 leviathan → A5 storm linear wall.
3. **A2 boneyard as the one checkpoint-gated unit** (blockout approval → detail).
4. Quick wins folded in: B6 sprint toggle; the small-bug batch (attach_rope LMB, worm hump on salt).
Human involvement: the upfront decision sheet (below), one boneyard blockout approval, one end walk-test.

### Phase 2 — Campaign "SCAVENGER'S ECONOMY" (the recommended next BIG campaign): B3 → B4 → B5
The highest game-quality lever (A2 gap #1). Sequence: research digest + a 1-page material/recipe/drop
matrix → **human approves the matrix** (the one real design gate) → system build (registry unification,
ItemIds, recipes) → ground loot → panel/lootable variety (fresh-critic gate on the new models, harness on
their geometry). End review: an attended scavenging session judging whether finds now *feel* differentiated.

### Phase 3 — Campaign "THE DEEP DESERT": B1 mega dunes + B2 ridable sled (paired)
The pairing is the point: crest a colossal dune, see the next landmark, sled down. Blockout checkpoint on
the dune vista; feel checkpoint on the ride. Storm + dune-sea + sled is the game's Mad-Max/Dune postcard.

### Phase 4 — Campaign "UNDERWORLD": B7 the cave system
Gate: the attended D254 KCC spike + design approval FIRST (do the spike itself during any Phase 1-3 review
day — it's 10 minutes). Then a checkpoint-gated campaign: carve/kit architecture → blockout walk →
chambers + dark-nav + egg relocation + cave-exclusive loot (from Phase 2's registry) → hero detail.

### Interleaved (attended sessions, not campaigns)
- **Audio identity (C1)** — schedule the listen session early (it's cheap and the tone payoff is large);
  batches can then run alongside any phase since audio files don't contend with world/model files.
- **Feel-debt paydown** — every phase-end review day also closes 3-5 backlog §A items (per A3 rec 4).

### Phase 5+ — the heavy forks: C2 character → C3 multiplayer
Sequenced last deliberately: they're the largest, least overnight-safe, and gated on decisions that reshape
the GDD. Run the *research* campaigns cheaply anytime (researcher agents; MP architecture digest; character
pipeline spike). But commit build effort only after: GDD re-anchor (`/interview-vision`) → MP scope + infra
decision → character-fork decision (informed by MP scope). If MP lands as small co-op, consider shipping it
with the existing procedural rig and upgrading the character later — decoupling the two XL items.

## B3. Why this order (design rationale)

- **Fix before add** (Phase 1): the feedback §A items are the player-facing credibility of the hero content
  just built; the harness makes the fixes cheaper AND stops the classes recurring into Phases 2-4.
- **Economy before more world** (Phase 2 before 3/4): dunes and caves make the world bigger; the material
  economy makes *every existing and future POI* more worth visiting. It multiplies; terrain adds.
- **Pair mechanics with terrain** (Phase 3): a ridable sled without mega dunes is a curiosity; together
  they're a loop verb.
- **Caves after the economy** (Phase 4): the cave earns its danger when it holds loot you can't get
  elsewhere, not just the egg.
- **Forks last, research early** (Phase 5): decisions, not tokens, are the bottleneck on character/MP.

## B4. Decision sheet (everything the human must answer, by phase)

| # | Decision | Blocks |
|---|---|---|
| 0a | Ship the held branch? Any pre-push tweaks (skull / leviathan light / storm horizon / density)? | Phase 0 |
| 0b | Boneyard skull: horned/tusked skull, or ribcage-only | Phase 1 (A2) |
| 0c | Leviathan entrance: interior→front opening vs new back opening; lighting moody vs lifted | Phase 1 (A1) |
| 0d | Storm: total whiteout vs keep faint ground reference; wind loudness target | Phase 1 (A5) |
| 1a | Stamina's fate under infinite sprint (retire vs keep for tow/melee; keep sprint-thirst?) | Phase 1 (B6) |
| 2a | Approve the material list + recipe/drop matrix (1 page); realism level (stations? smelting?) | Phase 2 |
| 3a | Approve the dune-sea blockout vista (height/wavelength/emptiness) | Phase 3 |
| 3b | Sled ride feel veto at walk-test | Phase 3 |
| 4a | Do the 10-min D254 KCC-under-terrain spike; then approve cave gen-method + scope | Phase 4 |
| 5a | GDD re-anchor: is multiplayer now IN? (`/interview-vision`) | Phase 5 |
| 5b | MP scope (2-4 co-op vs many) + infra (server vs P2P/relay) + authority model | Phase 5 |
| 5c | Character fork: procedural ceiling-push vs imported rigged glTF (breaks D1/D107) | Phase 5 |
| — | Audio listen session: enumerate the "cute" offenders + wind/music targets | C1, anytime |

## B5. Recommended NEXT

**Phase 0 this week** (ship the branch), then **Campaign "SOLID"** (Phase 1) as the next overnight run —
with the solid-model harness as its first unit — followed by **"Scavenger's Economy"** (Phase 2) as the
next big feature campaign. Slot the audio listen session and the D254 cave spike into the Phase 0/1 review
days so Phases 4-5's gates are already answered by the time their campaigns start.
