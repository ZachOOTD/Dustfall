# Campaign 2026-06-18 — milestone ladder (ACTIVE QUEUE)

> **This is the authoritative ordered queue for the `campaign/2026-06-18` autonomous run**
> (`/campaign-start --until=roadmap-empty --checkpoint=milestone --max-cycles=12 --plan-first
> --verify-cmd="npm run verify:all" --visual-gate=auto`). It supersedes the per-cycle ordering in
> the "Phase 2" plan below (that detail is preserved as the design reference for the
> architectural-risk cycles — sled-riding, real-rope). Produced from a 6-domain backlog analysis
> (51 work-units) + a coverage/GDD-compliance audit (2026-06-18). Awaiting `/campaign-approve` at
> the `plan-review` checkpoint before building starts.

**How to read this.** Each milestone is a coherent, **playable** bundle ending in a human
walk-test (the campaign verifies *appearance* headlessly + via the adversarial gate; **feel**
— motion/traversal/timing — is yours to judge at the checkpoint; those units are tagged
`feel-pending`). Per unit: `id` (scope S/M/L/XL · verify-type · risk). Milestones are tagged:

- **[BUILD-NOW]** — the campaign builds these unattended, gates on `verify:all` (+ the visual gate
  for visual/feel cycles), commits each cycle, and pauses at the milestone boundary for your playtest.
- **[DESIGN-GATE]** — the lead unit needs a **design decision or an architecture spike before any
  build**. The cycle that reaches it will surface a proposal and pause (it will NOT build-now). These
  are the genuinely-consequential calls (deep cave, real-rope/cloth, sled-riding, drop-pod intro,
  survival-curve, HUD removal). They're sequenced AFTER the build-now bulk on purpose.

**Verify-type legend:** `headless` (verify:all fully proves it) · `visual-gate` (adversarial
appearance gate: front-lit + length-framed render → harsh critics + code-auditor, PASS iff no
sev≥2) · `feel-pending` (appearance-verified by the campaign; **you walk-test the feel**) ·
`design-gated` (needs a design call first) · `human-attended` (build with a human in the loop).

**Hard exclusions (GDD §11/§14 — NOT in scope, logged for reversibility):** base-building as a
core loop · multiplayer + MP character-customization (`Solo only`, §14). See "Excluded" at the end.

---

## Phase A — autonomous build-out (BUILD-NOW; the campaign traverses these unattended)

### Milestone 1 — Wreck-arc finish (calibration) · [BUILD-NOW]
*Small, low-risk, high-visibility — the OWED ACBB walk-test (next-session-prompt §1). Reachable in
~2-4 cycles; built to let you calibrate cost + quality before resuming with a higher cap.*
- `scrap-pickup-3q-thin` (S · visual-gate · low) — rework the rusted-sheet so it has edge-on mass at
  a 3-quarter angle without re-introducing the disliked "busy pile". Shared `scrapMesh.ts` builder →
  one fix covers held + world. **Critics MUST shoot the 3q angle** (front already reads fine).
- `dish-collider-feel` (S · feel-pending · low) — refine the flagship `satelliteDish` slab collider
  (thinner/rotated slab, disc, or tighter hull) so the round face doesn't snag at the diagonals.
- `panel-deadcode-cleanup` (S · headless · low) — strip superseded greeble builders (`makeBreakerBank`
  /`makeWireLoom`/…), the dead `colliderHint` field (D211), redundant `_panelInteriorMat`.
- `perf-budget-reprofile` (S · headless · low) — `perf-probe` pass; record drawCalls/meshes/programs
  baseline so later content lands against a known budget.
- `remove-wreck-sand-mounds` (M · visual-gate + headless · low) — **[user directive 2026-06-18]**
  remove the `makeSandMound` sand drifts banked around wreck bases (`procgenWreck`/`poiAssembler`/
  `wreckYard`) so wrecks sit on the terrain without mounds. **Reverses the ACBB D236 banking + supersedes
  the §G sand-integration polish items** (wrecked_tank sand-swallow, satellite/debris drifts) — those are
  dropped, not built. Re-run `verify:placement`/`verify:colliders` (mounds were additive sand; removing
  them shouldn't bury panels — confirm the bury-audit still passes 0 fails).
- **Your ~5-min playtest:** walk INTO the satellite dish (no diagonal clip-wall) · inspect scrap
  in-hand in motion (reads solid, not thin) · **wrecks read right on bare terrain (no sand mounds)** ·
  fleet still cohesive under sky/fog · field drawCalls < 1000. Then `/campaign-approve` + resume with a
  higher `--max-cycles`.

### Milestone 2 — Wreck breadth + polish + infra · [BUILD-NOW]
*The high-risk wreck-perf item gets its own checkpoint so a regression can't poison M1's signal; plus
the FEATURES scaffold the later physics cycles depend on.*
- `yard-cross-poi-merge` (M · headless · **high**) — re-attempt the yard-level cross-POI merge
  (~36-38 sub-groups → few draw calls; ~18% cut last time). **Attempted+reverted twice (D237/D239)** —
  it regressed the terrain bury-audit by perturbing the `panelDoorExtents` bottom-edge measure.
  Re-attempt by running `pruneBuriedPanels`/`validatePanels` (or snapshotting bottom-edge world
  positions) **before** the cross-merge. Gate hard on `verify:placement` + `verify:colliders`.
- `feature-flags-infra` (S · headless · low) — NEW `src/config/features.ts` (`FEATURES.realRope` et al),
  flag-OFF. **Dependency enabler** for the gate-and-wait rope/cloth cycles (M9). Land early, inert.
- `security-review-repo` (M · headless · medium) — audit the public GitHub repo for vulns / leaked
  secrets (`/security-review` over the tree). Headless hygiene; rides this review boundary.
- `wreck-polish-bundle` (M · visual-gate · low-medium) — **[user directive 2026-06-18: build-now]**
  the full §F/§G sev-2/3 wreck polish set: **one non-axial mass per heavy class** (dorsal superstructure
  / sponson / bridge tower — breaks the length-axis "sausage" silhouette) · **up-close weathering chroma**
  (oxide → more orange, seam-rust lifted out of shadow, gravity drips rust-coloured + seam-gated) ·
  **engine droop** sign-randomize + widen + ~15% nozzle-detach · **scout/corvette guaranteed visible
  trauma** (≥1 SHEARED/breach + a list, since they sit fully proud) · **scale-anchor exclusion pocket**
  (lee-flank greebles/seams don't punch through near the human-scale door).
- **Your playtest:** stand in a dense wreck-yard (620-1000m out) — no float/clip/bury regression, draw
  budget held; re-confirm the mega-wreck interior (push bow/flanks/bells, lee sand-ramp, panels
  flush+pry-able, natural-light brightness) and the wreck-yard graveyard read (relic findability,
  ominous silhouette, vultures).

### Milestone 3 — The worm + the pit, made right · [BUILD-NOW]
*The worm units converge on the SAME entity → one sustained encounter judges the package; the Sarlacc
lure rides the same hazard-playtest. Strongest single lever on the GDD's Dune "how a sand worm enters a
scene" pillar. **Order: worm model + tail-depth BEFORE population** so the scaled worms inherit the corrected mesh.*
- `worm-model-overhaul` (M · visual-gate · medium) — more realistic mouth + body (`sandWorm.ts`).
- `worm-tail-buried` (S · feel-pending · low) — tail stays buried (model / spawn depth); no above-ground tail.
- `worm-charge-dive` (M · feel-pending · medium, dep `worm-tail-buried`) — replace the jump attack with a
  charge-and-dive. **Awe-not-horror (§11):** reads as geography/presence, not a combat escalation.
- `worm-audio-rumble` (S · feel-pending · low) — replace the abrasive SFX with a low procedural rumble
  (`audio.ts`, Web Audio per D3).
- `multi-worm-population` (M · feel-pending · medium) — N>2 scaling + per-worm min-sep + the
  retreat-and-stalk loop (deferred ABO). *(The 2-worm `sandWorms[]` array already shipped — additive
  only per D81; flag if N>2 needs a SAVE_VERSION bump.)*
- `sarlacc-lure-ambush` (M · visual-gate · medium) — **[user directive 2026-06-18: build-now]** a
  bulb-flower lure in the pit centre; the maw emerges + opens when the player gets close (net-new — no
  lure mesh exists today; the pit FSM is gate-on-proximity). **§11 guardrail baked in:** reads as awe /
  indifferent geography + telegraphed, NOT a jump-scare or bait-and-gotcha startle.
- **Your playtest:** force-spawn worms — judge model read, low rumble, buried-tail spawn, the
  charge-and-dive telegraph, and N>2 stalk behaviour in one encounter. **Plus the recessed Sarlacc-pit
  walk-test** (the new lure draw + the maw-emerges read; pull feel — escapable but scary? climb back
  out of the funnel, no softlock?).

### Milestone 4 — Critters + atmosphere · [BUILD-NOW]
*Ambient/sensory feel with a shared TEST CONTEXT — one full day→night cycle judges them together.*
- `vulture-motion-feel` (M · feel-pending · low) — flap cadence / relocate arc / landing flare / death
  tumble / carcass-ecology tunes (all `VULTURE_*` in tuning.ts).
- `atmosphere-feeltunes` (M · feel-pending · low) — **a feel-pass on shipped systems, not a build:**
  in-storm sensory camera sway (built ACW #134), cloud-shadow strength, star twinkle/drift, storm-wall
  sweep timing.
- `smoke-signal-plume` (M · visual-gate · medium) — a tall smoke column rising high from fires.
- **Also fold:** `amban-rifle-balance` (S · feel-pending) — range 60 / dmg 3 / cd 1.6 / mag 8 vs
  scrap_gun/energy_pistol (a small combat-pressure tune, not a combat loop — §11).
- **Your playtest:** one day/night loop — vultures, storm sway + sky drift, the smoke plume from a lit
  fire, rifle feel. *(NOTE: `companion-egg-cherry-pick` was proposed here but is **blocked** on the
  deep cave existing — moved to M8.)*

### Milestone 5 — Riding & rest feel · [BUILD-NOW]
*All third-person / vehicle / rope FEEL — judged only in live continuous motion. One long attended
motion-playtest covers the whole player-rig surface instead of five stops. (`sled-mechanics-feel-tune`
DROPPED 2026-06-18 — the slope-slide tune already shipped ACU: GAIN 6→2.5 + FRICTION .15→.20.)*
- `speeder-riding-feel` (M · feel-pending · medium) — in-motion riding + exact feet-on-pegs.
- `rope-attach-speeder-rear-bar` (M · feel-pending · low) — rope-attach via the speeder's rear tow bar.
  *(Targets today's inextensible rope; if real-rope (M9) is ever in flight, sequence after the FEATURES flag.)*
- `3p-camera-and-render-polish` (M · feel-pending · medium) — the OPEN 3P sub-items only (camera
  snap-on-teleport + walk-cycle already shipped ABR/ABQ): held-items-in-3P render/swap, gait↔footstep
  cadence sync, foot-IK idle→walk-on-slope reset snap.
- `lie-down-to-sleep` (L · feel-pending · medium) — camera lerps low to a bedroll pose + lie-down/get-up
  anims (the rig is now mature — replaces the instant-sleep overlay). *(Genuinely PENDING — still an instant overlay.)*
- `viewmodel-nits` (S · visual-gate · low) — just the **3P torch-flame animation** (the FP held-item
  night-lighting nit already shipped, D174). First scope-cut candidate (GDD §12).
- **Surface during this milestone:** the player-model **in-game-lighting-mood** lever (D142 — lowering
  ambient / raising contrast makes the figure read far more solid, but changes the WHOLE game's look;
  the biggest remaining realism lever — *your aesthetic call*). Plus the owed salvage-panel ACAX
  walk-tests (breaker-board under the pry-glow, door pop-off feel, stencil-portal bleed).

### Milestone 5a — Exploration & exposure (promoted from Phase C) · [BUILD-NOW]
*The §13 "over that ridge" lever + the survival teeth that make the long open traverse a real decision.*
- `horizon-landmark-silhouettes` (L · visual-gate · low) — 2-4 seeded MONUMENTAL silhouettes above the fog
  plane, visible across the 2400m map; a self-generated objective with NO UI marker (diegetic only).
- `salvaged-spyglass-wayfinding` (S · visual-gate · low) — a craftable monocular (RMB zoom + procedural
  vignette) to read a distant silhouette before committing water to the trek. Gear, not an unlock.
- `vista-crest-reveal` (M · feel-pending · low) — worldgen-tagged crests; cresting reveals a composed wide
  shot + a brief procedural music swell (cooldown-gated so it stays special).
- `sun-shade-exposure` (S · feel-pending · low) — position-aware heat (open sun vs wreck-shadow / hull /
  canopy); makes the midday open-desert trek toward a far silhouette a shade-hop decision. *(From C1; the
  rest of C1 — wreck-water-tanks / wind-chill / condensation-still — DEFERRED per user.)*
- **Your playtest:** walk toward a horizon silhouette across open desert at noon — does the exposure make it
  a real route decision, and do the spyglass + vista-reveal make the trek feel rewarded? (NO UI markers.)

### Milestone 5b — Living world & tone (promoted from Phase C) · [BUILD-NOW]
*Ambient depth ON TOP of the M3 worm + M4 atmosphere — the lonely-melancholy texture pass.*
- `wordless-prop-scenes` (M · visual-gate · low) — sparse prop-only tableaus from EXISTING meshes (two
  skeletons round a dead fire; a child's toy in a refugee wreck). **NO text** (§11 not-lore-heavy);
  skeletons weathered/peaceful, not violent (§11 not-horror).
- `wind-mood-soundscape` (M · feel-pending · low) — reactive wind moods (slow-Perlin gusts, altitude-keyed
  howl) + sparse structural creak. Pure procedural Web Audio (D3).
- `rare-sky-phenomena` (M · visual-gate · medium) — weighted-rare blood-dusk / meteor shower / eclipse-dim
  recolouring the existing sky/light rig (the meteor is a beautiful arc, no impact threat).
- `diurnal-cycle` (S · feel-pending · low) — bind the existing fauna to day/night (lizards diurnal, shrews
  nocturnal, vultures roost) — no new creatures.
- `worm-far-horizon-crossing` (M · feel-pending · low, dep M3) — a distant non-aggro worm plowing the far
  horizon as pure geography (awe, never threat; never closes distance). *(Optional breadth: spoor-and-tracks,
  worm-dead-zone, follow-the-flock.)*
- **Your playtest:** one day→night cycle — do the prop-scenes land emotionally, does the wind/creak deepen
  the loneliness, and do the sky events + diurnal fauna + distant worm read as a living, indifferent world?

---

## Phase B — design-gated arcs (DESIGN-GATE; the cycle surfaces a proposal + pauses here)

> These need a decision or a spike before code. Under `--checkpoint=milestone` the campaign pauses at
> each as it reaches it. Ordered roughly by value/independence; you can reorder via `steering.md`.

### Milestone 6 — Survival & UX direction · [DESIGN-GATE]
- `survival-rebalance-newgame` (M · feel-pending · medium) — rebalance health/food/thirst/temperature +
  **enable survival in the new-game mode** to playtest the curve. *Design call:* the target difficulty curve.
- `crafting-chooser-colliding-recipe` (S · design-gated · medium) — activate the dormant multi-match
  chooser by adding ONE colliding recipe (same inputs → different output). *Design call:* which recipe
  (a gameplay/discovery/save-balance decision, D71).
- `remove-hud-stat-bars` (L · design-gated · **high**, dep `survival-rebalance`) — replace HUD bars with
  audio/visual/text cues. *Big UX call* — only after the survival curve is tuned enough to telegraph state without bars.
- `flat-color-texture-audit` (XL · visual-gate · high) — review ALL materials, improve the weakest
  readers. *Scope-first:* pick the N weakest, don't open-endedly re-shade everything.

### Milestone 7 — Wreck depth & new POIs · [DESIGN-GATE]
- `procedural-wreck-overhaul` (L · visual-gate · medium) — net-new variety BEYOND the §F deltas (those
  moved to M2's `wreck-polish-bundle`, build-now): more part/component variants + new silhouette families.
  *Confirm the wanted scope vs re-doing shipped work.*
- `more-wreck-types-new-pois` — net-new POI archetypes beyond the procgen overhaul.
- `walkable-wreck-interiors` (XL · design-gated · high) — generalize the mega-wreck's walkable interior
  procedurally (floor + interior collision + lighting + layout). Split: design spike → build. The
  hollow-husk archetype is the enterable-ready seed.
- `crashing-ship-event` (L · design-gated · high) — a fiery wreck falls from the sky → a salvageable
  *dynamic* wreck. *(Mega-wreck depth/dagger polish + W2 conditional flagship greebles + the "real
  breach holes" idea fold in here.)*

### Milestone 8 — Deep cave & companion · [DESIGN-GATE]
- `deep-cave-design-spike` (M · design-gated · high) — design pass + generation spike (cellular-automata
  vs tunnel-carving vs modules? sub-heightfield collision? torch/dark model?).
- `deep-cave-build` (XL · feel-pending · high, dep spike) — the sprawling underground system + descent opening.
- `companion-egg-cherry-pick` (M · feel-pending · medium, **dep `deep-cave-build`**) — cherry-pick the
  preserved egg-acquisition spine (commit `2d4035b`) into the new cave **only once it exists**. *(Audit
  flagged this as out-of-order if scheduled earlier — it is hard-gated here.)* Optional: deeper companion
  proc-character rebuild only if it stops reading well.

### Milestone 9 — Architectural-risk physics · [DESIGN-GATE]
*Flagged friction-3+ cycles. Spike-first, gate-and-wait. See the Phase-2 Cycle 3/4 detail below for the blessed approaches + the documented KCC failures NOT to retry.*
- `rideable-sled-spike` (L · design-gated · high) — Cycle 3. Spike **Option-C platform-local frame** vs
  **synthetic ride-peg** concurrently (worktrees); do NOT retry the 3 documented KCC failures (D125).
- `real-rope-physics` (L · feel-pending · high, dep `feature-flags-infra`) — Cycle 4. Verlet/segment sim
  behind `FEATURES.realRope`; keep the `RopeEndpoint` vocabulary as the seam, enable CCD from the start (D124).
- `real-cloth-physics` (L · feel-pending · high, **dep `real-rope-physics`**) — PM-D; shares the Verlet
  solver. Cheap intermediate (vertex-shader wind ripple) already shipped.

### Milestone 10 — Big features & tools · [DESIGN-GATE]
- `scrap-machete-pry-tool` (M · visual-gate · medium) — replace `scrap_bar` with a scrap MACHETE pry
  tool + panel-open anim (+ `rope-rmb-pick-ux` follow-on).
- `craftable-hover-bike` (L · feel-pending · medium) — build/repair a hover-bike from found parts
  (incl. the repairable-speeder sub-item) instead of starting with one.
- `drop-pod-intro-cutscene` (XL · feel-pending · high) — the ODST opening: in-world pod descent + lever +
  blackout + wake + exit + delayed comedic parachute; keep the existing opening wreck as a nearby POI.
- `sarlacc-lure-ambush` (M · visual-gate · medium) — bulb-flower lure + maw-emerges-on-approach.
  **§11 guardrail baked in:** awe/indifferent-geography + telegraphed, NOT a jump-scare.
- `pickup-instancedmesh` (L · human-attended · high) — InstancedMesh batch the ~340 branch/scrap pickups
  (needs an `instanceId` interaction-raycast rework — **build with a human** to confirm pickups still take).

---

## Excluded / deferred (logged for reversibility — NOT in the campaign queue)

- **`base-building`** — GDD §11 anti-feature (tents/fires placeables exist; not a fortress loop).
- **`multiplayer-character-customization`** — GDD §14 "Solo only. No MP planned."
- **`real-pbr-textures`** — revisits the D107 zero-asset policy; a deliberate asset-fork, **your call** only.
- **`renderer-webgpu-explore`** — re-evaluate only when frames are the wall.
- **`desktop-packaging-electron`** — post-content distribution decision (design-first, not now).
- **`dynamic-poi-model-gen`** — partly realized by the composite fleet; revisit if hand-flagships become the bottleneck.
- **`shrew-save-determinism`** — only if shrew procgen ever becomes non-deterministic (D144).
- **`sarlacc-throw-items`**, **`idea-generation-tooling`** — speculative; park.
- **Player-model §D optional — DEFERRED (user, 2026-06-18):** PM-S.3 torso/neck skinning · PM-E deeper
  texture · in-game lighting-mood lever · sled-on-back-when-undeployed. The rig is at its
  believable-stylized ceiling; kept out of the autonomous queue. (PM-D cloth lives in M9 via `real-cloth-physics`.)
- **PARKED items — DROPPED as won't-do (user, 2026-06-18):** flagship hermit NPCs · salvage-durability-
  per-wreck · rare key-card panels · restore-corroded-via-weld-kit · machete-as-wreck-loot. Cut from the
  backlog (NPCs + key-cards rub against the lone-survivor / anti-quest pillars; the rest unprioritized).
- **Continuous (handled per-cycle by `/session-end`, not a milestone):** the full roadmap/docs refresh.

---

## Phase C — net-new direction candidates (PROPOSED 2026-06-18, not yet in the active queue)

> Beyond the existing backlog: a vetted ideation pass (5 GDD-grounded lenses → anti-feature +
> value/vision vetting, 23 proposals) found the real net-new frontier is THREE systems the GDD weights
> heavily but ships THIN — **water/thirst sourcing, exploration pull, and the Long-Storm endgame arc.**
> All below cleared the §11/§14 anti-feature filter + the D107 zero-asset constraint. **PROPOSED, not
> active** — they become the campaign's `--self-author` seed when M1-M10 empties, OR can be promoted into
> the active queue now (user pick). Both vetters converged on the same 4 core-levers (★).
>
> **Promotion decision (2026-06-18):** user promoted **C2 (exploration) + `sun-shade-exposure` (from C1) →
> new build-now Milestone M5a**, and the **tone/ecology layer → M5b**. **Deferred** the rest of C1
> (`wreck-water-tanks`, `wind-chill-storm-cold`, `condensation-still` — "not for now"). **C3 (endgame) is
> NOT pursued** — the user does not want an endgame; the game stays open-ended ("it's more days survived
> at the moment"). The `--self-author` phase must NOT resurface a storm-finale.

### Arc C1 — Water & exposure (the Long Dark survival core) — ⟶ PARTIALLY PROMOTED (sun-shade → M5a)
*Thirst is the named "dominant pressure" (§7) but water is canteen-only + temperature is a flat scalar.*
- `sun-shade-exposure` (S) — **✅ PROMOTED → M5a.** Position-aware heat: open sun heats faster, a wreck's
  shadow / hull interior / tent canopy slows it (raycast-to-sun `shadeFactor` scaling HEAT_GAIN). Midday
  travel → a shade-hop route decision. No save, no mesh — pure `survival.ts` + `tuning.ts`.
- `wreck-water-tanks` (M) — **⏸ DEFERRED (user, "not for now").** Finite salvageable water-tank components in
  wrecks (brackish vs clean), tapped via per-component extract; deplete permanently. Additive save (v15).
- `wind-chill-storm-cold` (S) — **⏸ DEFERRED (user, "not the wind-chill storm").** Wire `weather.intensity`
  into TEMPERATURE + a fire warmth radius.
- `condensation-still` (M) — **⏸ DEFERRED.** A placeable craft-and-wait still; overlaps tanks + leans base-builder.

### Arc C2 — Exploration pull ("over that ridge") — ✅ PROMOTED → M5a · directly targets §13
*The §13 success metric the iteration plan calls "real but thin." Make the horizon beckon, diegetically
(NO UI markers / objective HUD — that would break the lone-survivor emptiness).*
- ★ `horizon-landmark-silhouettes` (L) — 2-4 seeded MONUMENTAL silhouettes that sit ABOVE the fog plane,
  visible across the 2400m map (a colossal canted hull, a lone mesa/spire, a derelict tower). A
  self-generated objective with no marker — just a shape you choose to walk toward.
- `salvaged-spyglass-wayfinding` (S) — a craftable monocular (RMB zoom + procedural vignette) to read a
  distant silhouette BEFORE committing water to the trek. Gear, not an unlock.
- `vista-crest-reveal` (M) — worldgen tags a few seed-stable high crests; cresting the lee side reveals a
  composed wide shot + a brief procedural music swell (cooldown-gated so it stays special). *(Merges the
  two duplicate vista proposals.)*

### Arc C3 — The Long Storm endgame — ❌ NOT PURSUED (user: no endgame; keep open-ended days-survived)
*Recorded user direction (2026-06-18): **do NOT add an endgame/finale** — the game stays open-ended,
"it's more days survived at the moment." The storm-finale + its arc are NOT queued and must NOT be
resurfaced by the `--self-author` phase. Kept here only for reversibility. (The shipped 7-day countdown
stays as-is, ambient.) If a VISIBLE "days survived" record is ever wanted, `days-lasted-ledger` is the only
piece that fits the open-ended model — but the user did not request it.*
- `storm-eve-survivable-finale` (M) — ❌ a day-7 unsurvivable-outside climax. NOT wanted (no endgame).
- `morning-after-rearranged-world` (M) — a post-peak dune re-seed. NOT queued (tied to the finale).
- `storm-prep-readiness-mirror` (S) — a night-6 readiness reflection. NOT queued.
- `days-lasted-ledger` (S) — a quiet days-survived record; the only piece aligned with the open-ended
  "days survived" model — available if ever wanted, not currently requested.

### Tone & ecology layer — ✅ PROMOTED → M5b (build ON TOP of M3/M4, not ahead of the frontier)
- `wordless-prop-scenes` (M) — sparse prop-only tableaus from EXISTING meshes (two skeletons round a dead
  fire; a child's toy in a refugee wreck) — Pillar-4 "the world tells you what happened," NO text.
- `wind-mood-soundscape` (M) — reactive wind moods + sparse structural creak (audible loneliness; pure Web Audio).
- `rare-sky-phenomena` (M) — weighted-rare blood-dusk / meteor shower / eclipse-dim recolouring the existing sky rig.
- `diurnal-cycle` (S) — bind the existing fauna to day/night (lizards diurnal, shrews nocturnal, vultures roost).
- `worm-far-horizon-crossing` (M) — a distant non-aggro worm plowing the far horizon as pure geography (awe,
  never threat) — built on top of the M3 worm overhaul. *(Breadth: `spoor-and-tracks`, `worm-dead-zone`,
  `follow-the-flock` — Dune ecology, downstream of M3.)*

**Consciously NOT chasing** (both vetters): `self-set-storm-goals` + quest-flavored seeds (closest to the §11
lore-heavy line — the opening journal stays the ONLY authored narrative) · `placeable-cairns`
(base-builder-adjacent; marginal once silhouettes + spyglass exist).

---

# Phase 2: Iteration cycles after MVP completion

> Produced by `/iteration-plan` (game-planner) 2026-05-31, after Session ACF (87 shipped sessions).
> Dustfall **opts out of the tier-ladder** (see CLAUDE.md + roadmap.md). These are
> **theme-shaped iteration cycles**, not verify-gated tiers — each is 1–2 sessions of the
> open-ended hobby cadence, generous with the build→screenshot→critique→iterate loop
> (`shared-memory/iterative-polish-discipline.md`, CLAUDE.md rule 8). The "Up next" /
> "Big-ticket bucket" sections of roadmap.md are superseded by the ordering at the bottom
> of this file; the "Recently shipped" baseline in roadmap.md is preserved.

---

## Gap analysis

The GDD's core vision (§1 lone-survivor procedural desert; §3 five pillars; §13 success
conditions) is **substantially shipped**. The full loop — spawn → survive the thirst/heat
curve → salvage → craft → mount the speeder → reach a distant biome → encounter the worm →
return to shelter → save — runs end-to-end (session-end-report "What works end-to-end"). All
five pillars are load-bearing in code: lone-survivor tone (raiders dormant by design, D13/U),
procedural-everything (D107 zero-asset across geometry + shaders + audio), browser-first
(WebGL2 + Rapier WASM), tactile-world (every prop earns a verb), and `tuning.ts` iteration.
What remains is **not new vision — it's depth and finish on the vision already chosen.** Two
honest gaps stand out. First, a backlog of *started-but-unfinished* work: the ACF corpse/carcass
drag is functionally landed but never visually iterated and its raider path was never run
(0 raiders spawn); the ABP→ABY player rig hit "low-poly stylized" but the user set a higher
Rey-Jakku bar; the sled-riding mechanic is tabled mid-attempt (D125). Second, the atmosphere
and world-content vision the GDD leans hardest on — Dune's "sweeping sand worm geography" and
"vast featureless dune horizons" — is delivered as an *ambient intensity-ramp* storm and a
fixed-gradient sky, not the telegraphed sweeping storm wall or the varied skies the references
imply. §13's "I want to know what's over that ridge" moment is real but thin: the world has
biome-specific POIs but no rare *destination* biome (a wreck-yard) that rewards the long trek.
The throughline of Phase 2: **close the open debt first, then add breadth on the now-solid base.**

---

## Cycle 1: Drag verification

**Why**: ACF (D131-D132) shipped the corpse/carcass rope-drag functionally but skipped the
rule-8 aesthetic loop, and the raider path was never runtime-exercised (0 raiders spawn —
D13/Pillar 1 keeps them dormant). This is the immediate-next session (ACG), and it unblocks
Cycle 5 (proc-character raider needs a live raider to test against). Closing fresh debt beats
letting it fossilize.

**Scope** (1 session):
1. Dev-only raider-spawn hook — `__game.spawnRaider(x, z)` in `src/debug/debugPanel.ts` + a
   `spawnRaider` export in `src/enemies/raider.ts` (or a DEV-MODE starter raider near spawn).
   This is a test affordance, NOT bringing raiders back as a loop (Pillar 1 / GDD §11 "not
   driven by combat" — gate it to DEV MODE only).
2. Raider-corpse drag visual-triage (`src/world/killDrag.ts`, `src/player/interaction.ts`) —
   kill → wield rope → LMB-on-corpse → drag on foot, then tie to a player-tethered sled. Judge
   rope sag + body position. 3-5 iteration rounds per discipline.
3. Body-trails-head-first orientation (`killDrag.ts`) — orient the dragged corpse
   (`r.group.rotation.y`) + carcass (`w.mesh.rotation.y`) to point away from the anchor, but
   **verify against** `applyRaiderDeadPose` (flop) + `applySandWormDeadPose` so it doesn't fight
   them. Screenshot before/after.
4. Worm-carcass tow visual-triage (mount speeder, force a worm dead, tow it) — judge the 24m
   carcass on the 14m leash; tune `KILL_DRAG_WORM_*` in `tuning.ts` if it reads wrong.
5. In-progress-drag save round-trip — tie a corpse, save, reload, confirm the drag resumes
   (fields wired: `dragAnchor` on raider + worm).

**Verify**:
- A raider exists in the world in DEV MODE (was: zero, ever).
- `npm run verify` (tsc) clean.
- Qualitative — playtest signal: dragged body reads as "a body being dragged" (head trails the
  anchor, rope sags between), confirmed across 3-5 screenshot rounds, not on tsc alone.

**Dependencies**: none (uses ACE `ropeConstraint.ts` + ACF `killDrag.ts`, both landed).

**Risk / likely D-entries**: low. Possible D-entry if the head-first orientation forces a
refactor of how dead-pose rotation composes with drag-yaw. Possible micro-D for the
`lootSandWorm`-untags-carcass edge if you fix tow-after-harvest (keep an `attach_rope`-only tag
on looted-but-towed carcasses, or move cut-loose onto the speeder — see backlog `[bug] ACF
carcass tow blocked after harvest`). **Preview gotcha** (`dustfall_preview_gotchas`): pointer-lock
gating + opening-wreck spawn occlusion block automated framing — force state via `__game.ctx` +
eval and reposition the camera deliberately for screenshots.

---

## Cycle 2: Rig to Rey-tier — ⚠ RE-SCOPED into a multi-cycle arc

> **Status (post-ACH)**: ACH shipped rig *detail* (band wraps, fingerless glove, unified scarf,
> belt/pouches, backpack, boots) + the `enterGame` headless self-verify tooling (D134) — but an
> honest full-body audit found the result is **far from the Rey/real-human bar**: a rigid
> barrel/sandwich-board silhouette on stick-legs, blank ovoid face, floating-disc scarf. The
> single "Rig to Rey-tier" cycle was the wrong scope. **Re-planned as a 5-cycle arc → see
> [docs/feature-player-model.md](feature-player-model.md)** (PM-Cycle A proportion/silhouette →
> B head/face/scarf → C layered outfit → D cloth physics → E texture), each with a repeatable
> Model Verification Protocol + adversarial pass-bar. PM-Cycle A is the next session. The
> original single-cycle scope below is retained for history.

**Why**: GDD Pillar 2 + Pillar 4 (every mesh earns its place; procedural-only). The ABP→ABY
10-session arc reached "low-poly stylized 3P character" (D115/D117/D118), but the user set an
explicit higher bar: the Rey-Jakku outfit (backlog `[feat/polish] Player model refinement`,
logged 2026-05-26 from `docs/research/reference-tfa-jakku-opening.md`). The rig is the gate for
Cycle 9 (lie-down-to-sleep needs lie-down/get-up anims) and the reference target for Cycle 5
(proc-character raider) + Cycle 7 (proc-character companion).

**Scope** (1-2 sessions, all `src/player/playerRig.ts` + `src/player/viewModelHands.ts`):
1. Wraps with visible band spacing — per-arm-segment geometry or per-vertex band displacement
   (Rey's are tightly bound with clear separation; ours read as smooth cloth). Reuses the D117
   per-vertex-displacement technique. Glove finger-cutouts at knuckles.
2. Unify hood + bandana into one naturalistic headscarf that wraps the head and drapes the
   back-shoulder (Rey-style) — builds on D117 hood drape.
3. Layered tunic + cinched belt + visible pouches + tunic-edge variation (layering depth) +
   boot wraps (check feet detail).
4. Visible backpack mesh strapped on the back. **Surface to the user before building the
   sled-on-back stretch idea** (sled carried when undeployed) — that's a design pass touching
   sled deploy/undeploy state, not a pure rig edit.
5. Clear the carried-forward rig polish debt while in this file: walk-cycle→footstep cadence
   sync residue (ABR backlog — though D129 mostly closed it), foot-IK mid-state transition snap
   (idle→walk on slope), 3P camera collision real-playtest (still owed — walk into wreck walls,
   rapid F-toggle, mid-3P speeder mount).

**Verify**:
- `npm run verify` (tsc) clean.
- Qualitative — playtest signal: side-by-side against the Rey reference image reads as "same
  silhouette family," confirmed across the discipline's 3-5 rounds *per element* (this cycle is
  the canonical "never mark a visual tier done on tsc alone" case — CLAUDE.md rule 8).
- 3P camera collision verified in live continuous motion (not paused-screenshot harness).

**Dependencies**: Cycle 1 (cadence — do fresh-debt drag first; not a hard code dependency).

**Risk / likely D-entries**: low-architectural, high-iteration-cost. Stays within D107 zero-asset
+ D109 localSpace + the D111-D118 stack — no superseding D needed. Likely a D-entry codifying the
headscarf unification (replaces two layers with one) and the band-spaced-wrap technique. **Risk**:
this is the cycle most likely to sprawl past its session budget — the discipline's "1-2
fully-iterated elements per session" cap is the guardrail, not a stretch goal.

---

## Cycle 3: Ride the sled

**Why**: GDD §7 sled mechanic + Pillar 5 (game feel is the deliverable). The user wants
"stand on the sled, it slides downhill or is towed, you ride along" — tabled at D125 after
5h across 3+ attempts. ACD shipped the foundations that the next attempt needs: managed-scalar
slope-slide (D122), KinematicPositionBased body that tilts to terrain (D123), pickup CCD (D124).
The `sled._frameDeltaX/Y/Z` tracking is already computed each frame, unused, waiting.

**Open D-question (architectural wall — `known-hard-patterns.md` → "Rapier KCC + moving
platforms")**: This is the canonical KCC-moving-platform wall (it IS the entry that seeded that
pattern, via D125). **Do NOT retry KCC delta-add/post-compute/sticky-state** — those are the three
documented failures. Decide up front between the two foundation-blessed approaches and **route this
to parallel exploratory branches** (per `orchestration-policy.md` + CLAUDE.md sub-agent policy —
spike both concurrently in worktrees, don't serial-retry):
- **(A) Option C — platform-local frame with detach-to-world**: while riding, completely override
  player `setNextKinematicTranslation` to `sled.tr + savedLocalOffset + inputMotion`, skip KCC
  entirely; Space exits ride state to world frame. (`character-controller.md` "almost always on
  one platform".)
- **(B) Synthetic ride-peg** — a thin invisible dynamic sub-collider at the sled center that
  intrudes into the capsule's lower hemisphere; the sled drags the peg via friction and the peg
  shoves the capsule via Rapier contact resolution. Mirrors the "branch on sled" case the user
  observed working. (`rapier-physics-patterns.md` separate-kinematic-sub-collider.)
Pick by spike comparison; log the winner as a superseding-of-D125 entry.

**Scope** (1-2 sessions, `src/world/` sled module + `src/player/controller.ts`):
1. Spike both A and B concurrently (exploratory branches) on a stationary-then-sliding sled. `[parallel]`
2. Adopt the winner; wire ride enter/exit (mount on step-up, Space to dismount). `[ordered]`
3. Ride survives both slope-slide (downhill dune) AND tow (player/speeder pulling the sled). `[ordered]`
4. Camera + rig behave while riding (no jitter; `cameraSnapNextFrame` on enter/exit per D116/ABR). `[ordered]`

**Verify**:
- Player stays on a sled sliding down a 20-30° dune for ≥ 10 s without drifting off (the prior
  attempts failed at ~5-10 frames).
- Player stays on a towed sled through a direction change.
- `npm run verify` (tsc) clean.

**Dependencies**: none in code (ACD foundations landed). Sequenced here because it's open debt
the user explicitly wants closed before new breadth.

**Risk / likely D-entries**: HIGH (this is a flagged architectural-risk cycle — friction-3+ at
D125). Superseding D-entry for D125 with the chosen approach. If both spikes fail again within the
session budget, re-table with the new evidence rather than burning a third multi-hour serial
attempt — the spike-and-compare IS the de-risking.

---

## Cycle 4: Real rope physics

**Why**: GDD Pillar 4 (tactile world) + backlog `[feat] real rope physics with slack`. The
current rope is a cosmetic Catmull-Rom sag over an **inextensible position-snap constraint**
(D126 `ropeConstraint.ts`); it doesn't hang, drag, or go taut like real rope. The ordering
directive sequences this **before any new rope feature** because it supersedes the
ACE/ACF constraint that everything ropes through (sled tow, companion tether, stake, kill-drag).
This is a **flagged architectural-risk cycle**.

**Open D-question (supersede D126 — and screen against `known-hard-patterns.md` →
"discrete-collision tunneling for fast/thin bodies")**: Replacing `applyInextensibleConstraint`
touches every caller: `updateSleds`, `updateKillDrag`, companion tether, stake. The architectural
question is **segmented/Verlet rope sim vs. distance-joint-chain** — and whether the new sim drives
the same `RopeEndpoint`/`resolveEndpointWorldPos` vocabulary (D120, `endpoint-vocabulary-implicit-second.md`)
or replaces it. Decide up front: keep the endpoint vocabulary as the integration seam (recommended
— it's the proven boundary) and swap only the constraint *solver* behind it. Verlet segments are
fast/thin bodies → **enable CCD from the start** per D124, don't rediscover tunneling. **Route to
a parallel exploratory branch** (per CLAUDE.md sub-agent policy for tabled-wall spikes).

**Scope** (1-2 sessions, `src/world/ropeConstraint.ts` → likely a new segmented-rope module,
`src/world/rope.ts`):
1. Spike a Verlet/segment rope behind a `FEATURES.realRope` flag (see Risk) on ONE caller (sled
   tow) — leave the inextensible path live for the others. `[ordered]`
2. Rope hangs (catenary sag under gravity), drags on terrain, goes taut at full extension. `[ordered]`
3. Migrate the remaining callers (kill-drag, companion, stake) behind the same flag. `[parallel: group A]`
4. Save round-trip: rope endpoints persist; transient segment positions re-derive on load (per
   `day-cycle-weather-state.md` "resume from save — just set state, don't simulate"). `[parallel: group A]`

**Gate-and-wait** (`feature-flag-gate-and-wait.md`): land the segmented sim behind a
`FEATURES.realRope` flag (NEW `src/config/features.ts` — none exists today). Flag OFF = the proven
inextensible path runs; flag ON = the Verlet sim. Ship flag-off so types compile + every existing
rope flow is untouched; flip once the sag/taut feel is validated in one focused move. Pair with
verify probes for both paths (flag-off: existing sled-tow regression still passes; flag-on: rope
reaches taut at max distance, sags at slack).

**Verify**:
- Flag-off: existing sled-tow + kill-drag behavior unchanged (regression).
- Flag-on: rope visibly sags at slack and snaps taut at `maxDist`; a towed sled lags behind on
  rope slack then accelerates when taut.
- `npm run verify` (tsc) clean with the flag both off and on.

**Dependencies**: Cycle 3 (riding) is independent, but do rope physics **before** Cycle 5's
weapon/fauna and Cycle 6's atmosphere only insofar as no *new rope feature* should land on the old
constraint. Nothing downstream of Cycle 4 here adds rope, so the hard ordering is just "before any
future rope feature."

**Risk / likely D-entries**: HIGH (architectural; supersedes a friction-2 D126 that 4 systems
depend on). Superseding D-entry for D126. The gate-and-wait is the de-risk — if the sim doesn't
feel right, the flag stays off and nothing regresses. Watch for the `feature-flag-gate-and-wait.md`
anti-pattern "flag without isolation": verify by flipping the flag in a fresh terminal and running
every rope flow.

---

## Cycle 5: ~~Raider character~~ + pulse rifle — RAIDER HALF DROPPED (D238)

> **DROPPED (D238, 2026-06-18):** the user is not adding raiders. The **pulse rifle shipped (ACAC) + stays** as a usable weapon; the **raider proc-character rebuild + everything raider-specific below in this cycle is CUT**. The dormant raider placeholder remains ONLY as a combat/corpse-drag test affordance (D13), not an ambient threat. The rest of this section is retained for history only — do NOT pick it up.

**Why**: GDD §7 combat (WeaponKind dispatch, generalized PP) + Pillar 2 (procedural-only). Two
folded items: (a) apply the proc-character pipeline to the **raider** — ACE did the lizard (D128);
companion + raider remained; raider retires the Quaternius GLB (retroactive D107 alignment, per
roadmap ACG candidates); (b) the **Amban-style pulse rifle** (backlog `[feat]`) — a new weapon
variant. Both stay strictly within Pillar 1: the raider gets a *body*, not a revived combat loop;
the rifle is a survival pressure tool, not a progression vector (GDD §8 "no XP").

**Why folded together**: the raider proc-character is *the* live entity that finally exercises
Cycle 1's raider-drag path against a real, good-looking corpse — and a raider holding a new gun is
the natural test target for the rifle. The companion proc-character is deliberately split OUT to
Cycle 7 (the companion-overhaul cycle owns it) per the ordering directive's explicit split note.

**Scope** (1-2 sessions):
1. Raider proc-character (`src/enemies/raider.ts`) — rebuild the hooded primitive as Lathe body +
   sub-pivot rig per the D115/D117/D118 pipeline; reference the Rey-tier rig (Cycle 2) for the
   scavenger-outfit vocabulary but keep the raider visually distinct (different palette/silhouette
   — asymmetric armor per D111). 5 iteration rounds per discipline. Retire the Quaternius GLB.
   `[ordered]` (wants Cycle 2's vocabulary)
2. Amban pulse rifle as a `WeaponKind` variant (`src/player/combat.ts` + `src/inventory/items.ts`
   + `src/inventory/types.ts` ItemId union) — high-damage long-gun, slow reload, scarce ammo.
   `variant-dispatch.md`: add to `_WEAPON_SPECS`, NOT a new branchy call site. Procgen rifle as
   rare wreck loot. `[parallel: group A]`
3. Rifle viewmodel + 3P hand-attach mesh (dual-mesh per D113; `thirdPersonScale` per ABY) +
   procedural pulse-fire SFX (`src/audio/audio.ts`, Web Audio per D3). `[parallel: group A]`
4. Raider death → corpse path now visually verified end-to-end with Cycle 1's drag (the raider
   finally has a good-looking body to drag). `[ordered]`

**Verify**:
- Pulse rifle fires, reloads, and depletes scarce ammo per its `_WEAPON_SPECS` entry (read the
  spec in any assertion, not a hardcoded number — `variant-dispatch.md`).
- A killed proc-character raider drags as a recognizable body (closes Cycle 1's raider gap with a
  real mesh).
- `npm run verify` (tsc) clean; qualitative — raider reads as "scavenger person," not block-figure.

**Dependencies**: Cycle 1 (drag path), Cycle 2 (rig vocabulary the raider borrows).

**Risk / likely D-entries**: moderate. D-entry for the raider proc-character (mirrors D128's
lizard entry). D-entry for the pulse-rifle spec if it adds a new optional `WeaponKind` hook
(e.g. `onCharge` already exists for energy_pistol; a long-reload knob may be pure data). **Pillar-1
guardrail**: this cycle must NOT make raiders spawn as an ambient threat by default — they stay
dormant (D13) except the DEV-MODE spawn from Cycle 1. If a future cycle wants raiders back as
world content, that's a separate, explicitly-surfaced design decision (GDD §11 "not driven by
combat"; backlog flagship-NPC-beats is *parked* pending exactly that call).

---

## Cycle 6: Dune storm rework

**Why**: GDD §1/§2 (Dune tone — "vast featureless dune horizons," "how a sand worm enters a
scene," "vast scale through procedural haze and dust") + Pillar 1 (weather as a primary
antagonist). The current storm is an ambient *intensity ramp* (composes FogExp2 D31 + dust
layers D32 + AAF 7-day countdown); the GDD's Dune reference implies a **telegraphed sweeping storm
wall** you see approach, prep for, get engulfed by, and watch pass. Plus the night-sky and
daytime-sky variation the references imply. This is the single highest-leverage *atmosphere* lift
and it touches the pillar the GDD weights most.

**Scope** (1-2 sessions, `src/world/weather.ts` + `src/world/sky.ts` + `src/config/tuning.ts`):
1. Sweeping storm wall (`weather.ts`) — a visible wall that approaches across the map with a
   telegraphed prep window (pitch a tent / reach shelter), sweeps over the player, continues past.
   Reworks the intensity-ramp into a *moving front*. Follow `day-cycle-weather-state.md`: keep the
   gameplay coupling in a centralized table (fog/LOS/warmth-decay/visibility), not hardcoded in 6
   files; physics/AI read `weather.intensity` truth, visual/audio read perceived (D79/D90,
   `state-split-perceived-vs-truth.md`). `[ordered]`
2. In-storm movement penalty + sensory degradation — disable sprint + slow walk while the front is
   overhead (`src/player/controller.ts` reads the coupling table); near-zero forward visibility +
   slight camera sway + wind/sandstorm SFX while engulfed (`src/world/stormVignette.ts` +
   `audio.ts`). `[ordered]` (consumes the storm-front state from sub-task 1)
3. Star drift — night-sky stars rotate slowly across the cycle (celestial rotation) +
   per-star twinkle (`sky.ts` shader; the procedural-stars + twinkle skeleton is in
   `day-cycle-weather-state.md`). `[parallel: group A]`
4. Clear vs cloudy daytime skies — add a cloud layer to the gradient-shader sky (none exist today;
   sky is gradient + sun/moon/stars). Drive via the weather FSM staircase (clear→cloudy), not a
   direct jump. `[parallel: group A]`

**Verify**:
- Player moves < (normal sprint speed) while the storm front is overhead, and sprint is disabled
  (testable against `tuning.ts` storm-movement constants).
- The storm front is visibly distinct from the player's current position before it arrives (you
  can SEE it coming) and continues past after (not a uniform fade-in/out).
- Stars are in measurably different sky positions at hour 22 vs hour 2 of the same night.
- `npm run verify` (tsc) clean; qualitative — the approach/engulf/pass arc reads as a Dune
  storm, confirmed over screenshot rounds.

**Dependencies**: none hard. Sequenced after the debt cycles per the finish-first directive.

**Risk / likely D-entries**: moderate. D-entry for the sweeping-front model (supersedes the
AAF/D31/D32 intensity-ramp framing — note this as a superseding-of-prior-storm-decisions entry).
**Save**: weather resume should set state, not simulate the front forward (D-era + the
"resume from save" rule in `day-cycle-weather-state.md`) — additive only (D81), flag if a version
bump is needed. **Risk**: a moving-front + cloud layer can sprawl; cut star-twinkle (cosmetic)
before cutting the storm-front (the load-bearing pillar feature) if the session tightens.

---

## Cycle 7: Companion overhaul

**Why**: GDD Pillar 4 (tactile world) + Pillar 2 (procedural-only) + GDD §11 "not lore-heavy"
guardrail. Three folded backlog items: (a) rock-biome cave POI → descends to a findable
**companion egg** that hatches the companion — *the canonical acquisition path* in the final game
(replaces starting with the companion already at your side); (b) **rename the companion to
"Pebble"** (UI/journal/prompt copy); (c) apply the **proc-character pipeline to the companion**
(D128's lizard pipeline; this is the companion half of the debt-phase "proc-character for
companion+raider" — the raider half lives in Cycle 5, per the ordering directive's explicit split).

**Anti-feature guardrail (GDD §11)**: the egg beat stays **LIGHT — a charm/character acquisition
moment, not a story arc**. No lore dump, no journal chain about the egg. The opening journal
remains the only authored narrative. Frame the cave-descent as discovery-and-delight, not
narrative exposition.

**Scope** (1-2 sessions):
1. Rock-biome cave POI extension (`src/world/rockyEntrance.ts` already exists — extend its
   descending chamber) → a findable egg at the bottom. Reuses `interactable-tagged-content-routing.md`
   for the egg interact. `[ordered]`
2. Egg → hatch → companion acquisition flow (`src/enemies/companion.ts` + `src/player/interaction.ts`)
   — interact with the egg, it hatches Pebble. New-game no longer spawns the companion at your
   side; the egg is the path. **Save-schema decision** (see Risk). `[ordered]`
3. Companion proc-character (`src/enemies/companion.ts`) — rebuild via D128 Lathe pipeline +
   D100 body-shell/hip-group decomposition (the radial-creature rig); 5 iteration rounds per
   discipline. `[parallel: group B]`
4. Rename to "Pebble" everywhere in copy (`src/ui/`, journal, interact prompts, tutorial hints).
   `[parallel: group B]`

**Verify**:
- A cave POI exists in the rock biome with an egg at its descent; interacting hatches the
  companion (was: companion present at spawn).
- New-game starts WITHOUT a companion at the player's side; the egg is the only acquisition path
  (or a clearly-flagged DEV fallback exists).
- The string "Pebble" appears in companion-related UI/prompts; no stale "companion" copy in
  player-facing text.
- `npm run verify` (tsc) clean; qualitative — Pebble reads as charming, not block-figure.

**Dependencies**: Cycle 2 (rig vocabulary, optional reference). Independent of Cycle 5's raider
half. Cycle 6 (biome atmosphere) is a nice-to-have-before but not required.

**Risk / likely D-entries** (screen against `known-hard-patterns.md` → "singleton→list promotion
under existing save"): the companion is currently a singleton present from spawn; making
acquisition gated means a save must record "has the player hatched Pebble yet?" — a **save-schema
decision** (`singleton-to-list-promotion.md` + `save-schema-migration.md`). This is likely an
**additive boolean** (`companionAcquired?: boolean`, default true for legacy saves so existing
players keep their companion — D81 additive, NO version bump if framed right). **Flag to the user
if a SAVE_VERSION bump is genuinely needed** (D81 autonomy boundary). D-entries: companion
proc-character (mirrors D128), egg-acquisition flow + its save handling, Pebble rename.

---

## Cycle 8: Wreck-yard biome

**Why**: GDD §13 success condition — "the wreck → speeder → distant POI loop produces at least one
'I want to know what's over that ridge' moment per playthrough." A **rare destination biome** is
the strongest lever on that moment: a ship-graveyard worth the long trek. Backlog `[feat] rare
"wreck yard" biome` (4th biome alongside dune/salt/rocky, spawns rarely) + `[idea]
wreck-yard-exclusive loot`. Pillar 2 (procedural) + Pillar 4 (tactile, intentional POIs).

**Scope** (1-2 sessions, `src/world/biomes.ts` + `src/world/poi.ts` + `src/world/procgenPoi.ts`):
1. Wreck-yard biome — a rare 4th biome with highly-condensed wrecks (large + small packed
   together). Add to the biome sampler with a low spawn probability + a min-distance-from-spawn so
   it's a *destination*, not a starter area. Reuses `procgen-part-vocabulary-assembly.md` (the
   composite-wreck part vocabulary from ABA-ABN) for dense procgen fill. `[ordered]`
2. Dense-wreck layout rules — condensed spacing distinct from the dune-biome scatter (a junkyard
   reads as *piled*, not *scattered*); reuses the themed-cluster composition idea (D93,
   `procgen-themed-clusters.md`) for the formation. `[ordered]`
3. Wreck-yard-exclusive loot — items obtainable only here (currently `[idea]`, TBD). **Surface the
   loot identity to the user** before authoring (the backlog flags it as unscoped: "specific loot
   TBD, likely tied to a future mechanic"). Default if no direction: a high-tier salvage component
   that feeds an existing recipe (no new mechanic), keeping scope contained. `[parallel: group A]`
4. Sarlacc pit hazard (`src/world/` new POI) — rare dune-biome hazard; falling in = death; throw
   items in for a TBD effect. **GDD §11 anti-feature guardrail: must read as AWE/HAZARD, NOT
   horror** (the worm is "awe-inducing, not terror-inducing"; "not a horror game"). Frame it as a
   vast, indifferent geographic feature — a hole in the world, like the worm is a presence in the
   world — not a jump-scare or gore set-piece. `[parallel: group A]`

**Verify**:
- A wreck-yard biome spawns rarely (testable: across N seeds it appears in a minority, and never
  within the spawn-exclusion radius).
- The wreck-yard is visibly denser than the surrounding dune biome (wreck-count-per-area distinct).
- The Sarlacc pit kills on fall-in and accepts thrown items; reads as awe/hazard (qualitative —
  screenshot framing confirms it's not horror-coded).
- `npm run verify` (tsc) clean.

**Dependencies**: none hard (composite-wreck vocabulary already shipped). Best after Cycle 6 so
the new biome is seen under the reworked atmosphere, but not required.

**Risk / likely D-entries**: moderate. D-entry for the 4th biome + its rarity/distance rules.
D-entry for the Sarlacc pit framing (the awe-not-horror call is exactly the kind of GDD-§11 tension
worth logging). **Risk**: the exclusive-loot `[idea]` is unscoped — do NOT invent a new mechanic
to justify it (scope creep); default to feeding an existing recipe and surface for direction.
Dense-wreck spawn could stress draw-call budget — check the F1 perf HUD (architecture.md) if the
yard is heavy.

---

## Cycle 9: Shrew + sleep

**Why**: Two smaller folded items that round out the survival-feel surface. (a) **Desert shrew
critter** (Dune Muad'Dib; backlog `[feat]`) — burrows into sand when the player nears; catchable +
cookable on a stick like the lizard. GDD Pillar 1 (lone-survivor sandbox; the world has incidental
fauna) + §7 (the lizard flee/catch/cook loop already exists to reuse). (b) **Lie-down-to-sleep**
(backlog `[feat]`) — camera lerps low to a fixed pose just above the bedroll, sleep, wake in the
same pose + stand; replaces the instant-sleep overlay. **GATED on player-rig/animation maturity**
(needs lie-down/get-up anims) — which is exactly why it's sequenced after Cycle 2.

**Scope** (1-2 sessions):
1. Desert shrew (`src/enemies/shrew.ts`, NEW — mirror `src/enemies/lizard.ts`) — reuse the
   `LizardState` flee/dead pattern + `spawnLizardsProcgen` scatter + `lootLizard`/`applyDeadPose`
   shape; the distinguishing behavior is **burrow-on-approach** (reuse the sandworm burrow visual
   vocabulary from `sandWorm.ts`). Catchable + cookable on a stick (new cooked-meat ItemId).
   `variant-dispatch.md` if the cook recipe shares the lizard path. `[parallel: group A]`
2. Shrew proc-character — Lathe body per D128 (small critter); 3-5 rounds. `[parallel: group A]`
3. Lie-down-to-sleep (`src/ui/sleepOverlay.ts` + `src/player/playerRig.ts` + camera) — camera
   lerps to a low fixed pose above the bedroll; lie-down + get-up anims on the rig (built on
   Cycle 2's mature rig + D118 sub-pivots); replaces the instant-overlay. `[ordered]` (consumes
   Cycle 2's rig anims)
4. Wake-in-pose-then-stand transition (no snap; `cameraSnapNextFrame` discipline per D116/ABR).
   `[ordered]`

**Verify**:
- A shrew burrows into the sand when the player approaches within a tuned radius (testable against
  `tuning.ts` shrew-detect distance) and can be caught + cooked (yields a cooked item).
- Lie-down-to-sleep lerps the camera to the bedroll pose and back without a snap; the rig plays a
  lie-down/get-up motion (not an instant overlay).
- `npm run verify` (tsc) clean; qualitative — burrow + sleep both read smoothly.

**Dependencies**: Cycle 2 (rig anims — HARD dependency for the sleep half; the shrew half is
independent and could ship earlier if Cycle 2 slips).

**Risk / likely D-entries**: low-moderate. D-entry for the shrew (mirrors D128). D-entry for the
lie-down camera/anim approach. **Risk**: the sleep half is gated — if Cycle 2's rig isn't mature
enough for clean lie-down/get-up anims, ship the shrew half and defer sleep to a follow-up rather
than shipping a stiff lie-down (CLAUDE.md rule 8 — don't ship rough visual/anim work).

---

## Recommended ordering

Dependency-aware, honoring the **finish-what's-started-first** spine from the directive
(close debt before new breadth), then breadth on the solid base:

**Phase 2a — close open debt (Cycles 1-4):**
1. **Cycle 1 — Drag verification** (immediate next = ACG). Closes the freshest debt; unblocks
   the raider path Cycle 5 needs.
2. **Cycle 2 — Rig to Rey-tier**. The rig is the gate for Cycle 5 (raider reference), Cycle 7
   (companion reference), and Cycle 9 (sleep anims). Do it early so downstream cycles inherit it.
3. **Cycle 3 — Ride the sled** (architectural-risk; spike A/B in parallel). Tabled debt the user
   wants closed; foundations (ACD) are ready.
4. **Cycle 4 — Real rope physics** (architectural-risk; gate-and-wait). Must precede any *new*
   rope feature; supersedes D126.

**Phase 2b — new breadth on the base (Cycles 5-9):**
5. ~~**Cycle 5 — Raider character**~~ **DROPPED (D238)** — pulse rifle shipped (ACAC); the raider proc-character is cut (user call, no more raiders).
6. **Cycle 6 — Dune storm rework**. Highest-leverage atmosphere lift; the pillar the GDD weights
   most. Independent — can swap with 5 if a playtest says atmosphere is the bigger gap.
7. **Cycle 7 — Companion overhaul**. Needs Cycle 2 (rig). Owns the companion proc-character half.
8. **Cycle 8 — Wreck-yard biome**. Strongest lever on §13's "over that ridge" moment. Best after
   Cycle 6 (seen under reworked atmosphere) but independent.
9. **Cycle 9 — Shrew + sleep**. Sleep half is HARD-gated on Cycle 2's mature rig; sequence last.

---

## Cadence note

**Every 2-3 cycles, run a playtest-driven priority refresh.** This is an open-ended hobby
cadence, not a fixed plan — after the debt phase (post-Cycle 4) and again mid-breadth (post-Cycle
6/7), do a real playtest and re-rank the remaining cycles against what actually feels missing.
The two natural checkpoints:
- **After Cycle 4** (debt closed): is the base solid enough to build breadth on, or did rope
  physics / riding surface a foundation issue worth a follow-up before new content?
- **After Cycle 6** (atmosphere reworked): does the world now produce the §13 "over that ridge"
  moment, or does it need Cycle 8's destination biome more urgently than Cycle 7's companion charm?
Because there's no `docs/playtest-log.md` yet, capture each refresh's signal in the session-end
report + reorder the remaining cycles here. Honor the discipline throughout: a real long session
ships **1-2 fully-iterated cycles, not 4-5 shallow ones** (CLAUDE.md rule 8 / the ABP precedent).
