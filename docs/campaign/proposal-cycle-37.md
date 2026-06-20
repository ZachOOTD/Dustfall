# Phase B (M6–M10) — campaign proposal (cycle 37 release)

> **Status: ✅ APPROVED 2026-06-20 (user) — folded into roadmap "Up next", releasing cycle 37.** Produced by a
> 6-agent planning workflow (one `game-planner` per milestone + a lead synthesis).
>
> **User decisions:** (1) **M7 INCLUDED** (variety + new POIs + walkable-interiors) — Phase B = M6→M10 full.
> (2) Survival = **forgiving Long Dark** (prepared→indefinite, unmanaged→~8-12 in-game min; flip `GOD_MODE` off).
> (3) HUD = **flag + pause-menu opt-in, default-ON** (bars stay the floor; reversible). (4) **Flip authority =
> AUTONOMOUS** (override of the rec): the loop MAY flip `FEATURES.*` / kill-switches ON once the headless +
> visual/adversarial gates pass — everything stays behind a reversible flag, the user vetoes FEEL at the Phase-B
> review, and the **D81 save-version-bump STOP rule still holds** (never bump autonomously). Other taste calls
> default to the recommendations (cave = ONE + ramp + no-horror; machete = new id; hover-bike = repairable
> speeder; crafting pair = fire_kit vs signal_kit; drop-pod couples to the broken-speeder spawn).
> **Cap → 75.**

Phase B is the **design-gated** block. The campaign paused at the Phase-A milestone specifically to make these
calls. The user chose: **push straight to Phase B** (defer the Phase-A walk-test/partials to backlog), **full
Phase B with a raised cap**. **M7's `crashing-ship-event` already shipped** ahead of schedule as **D1 "Skyfall"**,
whose crash/persistence/heat/FX patterns are reused throughout this plan.

## Recommended cap + cadence
- **`max_cycles` → 62** (26 Phase-B cycles on top of the 36 spent; the synthesis sized 26 for the full block
  with full rule-8 iteration on the XL/visual units).
- **One committed pause** at `### Milestone: Phase B — Design-gated complete` (phase-level cadence the user set).
- **2 conditional mid-block risk checkpoints** (surface-and-note, not full pauses): after the **deep-cave spike**
  (only if it picks the riskier heightfield-removal path) and after the **sled spike** (only if both candidates
  fail — to log the D125 re-table with evidence).

## ⚠ Decision needed — M7's remaining 3 items
The synthesis EXCLUDED M7's non-crash items from the ladder (it treated M7 as "done"). They are real Phase-B work:
- **procedural-wreck-overhaul** (L) — net-new wreck *variety* via new structure axes in the socket/`mate()` grammar.
- **more-wreck-types-new-pois** (L) — 2–3 new non-wreck POIs (watchtower/vantage, debris-trail, dry well/cistern).
- **walkable-wreck-interiors** (XL, spike→build) — generalize D1's enterable `crash_husk` to more wrecks.
**Your call:** include M7 (adds ~3–4 cycles + a 3rd XL) or defer it to a later breadth pass.

## Ordered build ladder (synthesis; M7 inserted as optional)
1. **[M6] crafting-chooser-colliding-recipe** (S/low) — lead with a guaranteed win; lights up the already-built, idle multi-match chooser via ONE data-level recipe collision.
2. **[M6] survival-rebalance-newgame** (M/med) — **KEYSTONE.** Flip `GOD_MODE` off for real new-game; tune a forgiving Long-Dark curve in `tuning.ts`. Hard-dep for the HUD work + M10's broken-speeder economy.
3. **[M6] flat-color-texture-audit** (L/med) — SCOPE-FIRST; fix the ~6–8 weakest flat readers via the existing 9 shader factories. Zero new programs, zero asset bytes (not the D107 fork).
4. **[M6] remove-hud-stat-bars** (L/high) — behind `FEATURES.diegeticSurvival` (default OFF) + a pause-menu opt-in; screen-effects + procedural audio + viewmodel tells. Hard-dep on #2.
5. **[M8] deep-cave-design-spike** (M/arch-risk) — A/B worktree spike of the sub-surface collision architecture (ramp-shaft vs heightfield-removal); tunnel-carving; dark-nav. Writes `docs/feature-deep-cave.md`.
6. **[M8] deep-cave-build** (XL/high) — seeded tunnel-carving, 4–8 chambers at ONE rare distance-gated location, torch-only dark-nav, deterministic (persist no geometry).
7. **[M8] companion-egg-cherry-pick** (M/med) — re-apply the preserved egg-acquisition spine (`2d4035b`) at the DEEPEST chamber; additive `companionAcquired` (legacy→true).
8. **[M9] rideable-sled-spike** (L/arch-risk) — A/B worktree spike (platform-local-frame override vs ride-peg) behind a `SLED_RIDE_ENABLED` kill-switch; **RE-TABLE if both fail** (no 3rd KCC attempt, per D125).
9. **[M9] real-rope-physics** (L/arch-risk) — Verlet solver behind the `RopeEndpoint` seam, `FEATURES.realRope`, CCD from the start; lands **flag-OFF**.
10. **[M9] real-cloth-physics** (L/arch-risk) — 2D Verlet grid reusing the rope solver, `FEATURES.realCloth`; tent-door/flag only (tunic OUT); lands **flag-OFF**. (First M9 cut.)
11. **[M10] scrap-machete-pry-tool** (M/low) — NEW `scrap_machete` id (combat machete untouched); flips the 2 pry-gate sites. Feeds #12/#13.
12. **[M10] craftable-hover-bike** (L/med) — the *repairable-speeder* economy (one vehicle, two states; additive `speederCondition`, legacy→functional). Dep #11 (+#13 narratively).
13. **[M10] drop-pod-intro-cutscene** (XL/high) — in-world ODST descent on the REAL scene (camera rides the pod, FSM cloned+inverted from `meteorCrash`), reusing Skyfall FX; `FEATURES.dropPodIntro` OFF.
14. **[M10] pickup-instancedmesh** (L/arch-risk) — InstancedMesh the ~340 pickups + a per-region instanceId→pickupId remap; **human-attended**. (First whole-block cut.)
- *(If M7 is IN: insert procedural-wreck-overhaul + new-POIs after #4, and walkable-wreck-interiors after the cave block.)*

## Headline design calls (recommended answers)
1. **Survival target** — flip `GOD_MODE` off; **forgiving** curve: prepared player survives indefinitely, unmanaged dies in **~8–12 in-game min** (soften the ~5-min idle-thirst death; thirst dominant per §7; temperature carries day/night variance via the shipped C31 shade). Data-only; the flip is the explicit end-gate.
2. **HUD bars** — gate-and-wait behind `FEATURES.diegeticSurvival`, **KEEP a pause-menu opt-in** (bars stay the accessibility floor). Don't remove outright; the flip is yours at the review.
3. **Deep cave** — spike the collision architecture A/B first; tunnel-carving (not marching-cubes); **ONE** cave; **darkness-only tension, no horror** (§11).
4. **Rideable sled** — A/B worktree spike, kill-switch-gated; **re-table with evidence if both fail** (a zero-flip M9 is an acceptable planned outcome).
5. **Rope + cloth** — behind flags, **flag-OFF**, **you** flip at the review (game-wide feel calls); cloth depends on rope.
6. **Drop-pod intro** — in-world (no scene-swap), reuse Skyfall FX, `FEATURES.dropPodIntro` OFF, flip after walk-test; keep the opening wreck as a nearby POI.
7. **Hover-bike** — ONE vehicle, two states (repairable speeder), NOT a 2nd vehicle class.
8. **scrap_machete** — a NEW item id; combat machete untouched.

## Open questions for the user (taste calls)
1. Survival teeth — forgiving (rec) / sharper (true scarcity) / softer (near-cozy)?
2. HUD — opt-in default-ON (rec) / gone-by-default (immersion-first, accept the legibility risk)?
3. **Flip authority** — must all gated mechanics (realRope/realCloth/diegeticSurvival/dropPodIntro/SLED_RIDE) stay flag-OFF until you walk-test (rec), or may the loop flip them once headless wiring passes?
4. Sled — confirm RE-TABLE (not a 3rd approach) if both candidates fail; a zero-flip M9 is OK?
5. Cave — ONE cave, walkable ramp/switchback descent (not a ladder movement-mode), no survival hazard v1 — confirm all three?
6. Crafting pair — `fire_kit` vs a new `signal_kit`, both `scrap×2+branch×1` ("warm yourself OR call out"), or a different single either/or?
7. Hover-bike — couple the broken-speeder spawn to the drop-pod intro, or independent?
8. flat-color audit — confirm the ~6–8 surface cap inside the 9 factories; name the surface that bugs you most to pin it top.

## Pre-committed scope-cut order (if the cap tightens)
1. pickup-instancedmesh (invisible perf; field is 842/1000) · 2. real-cloth (shader ripple covers ~80%) ·
3. flat-color FIX tail (keep the audit) · 4. companion-egg (cave ships without it; spine re-applies later) ·
5. drop-pod wry-comedy beats (keep the core descent) · 6. hover-bike coupling (ship machete+intro, speeder stays functional).

## Key risks
Deep-cave XL is a collision-**topology** problem (a single-valued heightfield can't hold a void) — the spike-first
split de-risks it but the build climbs if the risky branch is needed. The physics spikes are friction-3+ (the sled
is the literal D125 KCC wall; **may legitimately not land**). Two XL cinematics + the HUD bet are all feel-pending
behind flags — the loop builds + verifies WIRING but can't judge feel (assumes a real Phase-B walk-test). Save
boundary (D81): egg + bike are additive defaults (legacy→true/functional) needing NO version bump — but if
integration needs a genuine bump, the loop STOPS and surfaces it. Anti-feature guard: the dark cave must read
awe/solitude not horror; no endgame anywhere.
