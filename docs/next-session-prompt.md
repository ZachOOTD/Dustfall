# ▶ OVERNIGHT RUN — Escape-pod intro · Phase 3 (the hauler + disaster) — `campaign/escape-pod-intro`

**Campaign ACTIVE, `checkpoint: none` (OVERNIGHT run-through).** The user approved Phase 2 (after an
extended attended walk-test) and asked to run the loop overnight through the remaining phases — **do NOT
pause at phase milestones this run.** Build Phase 3 → 4 → 5 straight through; the user reviews the whole
remaining feature in the morning (via `campaign-log.md` + the live preview link). Boot every cycle from
`docs/campaign/campaign-state.json` + `docs/roadmap.md` (NOT chat — the chat may compact; the campaign is
file-driven).

## Where the feature stands
- **Phase 0 (greybox spine) + Phase 1 (hero cylindrical pod) + Phase 2 (the descent showpiece) = DONE + user-seen.**
- **The descent (Phase 2 + the C18 walk-test polish)** is now: eject → a brief blast (UPRIGHT, no tumble) → close
  orbit → through the atmosphere (re-entry plasma) → a realistic desert with a clear horizon → the ground rushing
  up (real perspective parallax) → impact → black, with dip-to-blacks between phases. Calm, slow (18s), seamless.
- The intro plays behind `FEATURES.escapePodIntro` (off in master; the preview build flips it on).
- **Each cycle PUSHES the branch** (the preview link refreshes) — keep doing this so the user can re-test in the morning.

## ⚠ Phase 3 STATUS (C19 overnight) — the HAULER is DEFERRED to user art-direction; build T3.3 NEXT
- **T3.1 Hauler exterior — BUILT but BELOW the hero bar → DEFERRED to USER ART-DIRECTION.** The adversarial gate failed
  it TWICE (beauty 4-5; the silhouette/engines/cockpit don't read through the porthole; the material reads muddy). After
  8 modeler rounds the autonomous modeler PLATEAUED — this hero ship needs the user's specific eye (as the descent did).
  The model EXISTS as a wired placeholder: `src/world/escapePodIntro/haulerScene.ts` (`buildHaulerExterior`), viewable via
  `__game.buildHauler()` or `rig-shot --scenario=hauler --angle=porthole|broadside|engines`. **Do NOT spin more autonomous
  rounds on it overnight** — it's flagged for the user's morning. **T3.2 (explosion) is DEFERRED with it** (depends on the
  finalized hauler). When the user art-directs the hauler, finish T3.1 → T3.2.
- **▶ BUILD NEXT (overnight): T3.3 — the COCKPIT interior** (procedural-modeler — an INTERIOR, which the modeler does well,
  like the pod cabin; the hauler EXTERIOR silhouette was the hard part): the single-pilot cockpit you START in — a seat, the
  big forward window, the consoles with the **escalating diegetic readouts** (E2: `ORBIT ACHIEVED → ⚠ CORE TEMP CRITICAL →
  HULL BREACH`), a 2-second personal touch (photo/mug for the lone pilot). Real in-game FP view (you're seated in it) →
  the adversarial gate (5-8 rounds). This is Beat 0 (the intro opens here).
- **Then T3.4 — corridor + disaster staging** (3 lighting zones, only-open-door funnel, engine-fire-behind-the-door, red-alert
  strobe, spatial audio cues). Then continue to Phase 4 (crash/tutorial — incl. the wake-in-pod + exterior-size reqs) → Phase 5 (audio).
- Decompose via `/feature-slice` if a tier is >2 sub-tasks; one sub-task per cycle to the DoD (the beat plays as the vision).

## Then Phase 4 + Phase 5 (continue through them)
- **Phase 4 — Crash · wake · reveal + tutorial.** INCLUDE the C18 walk-test reqs (in the roadmap):
  - The crashed-pod **EXTERIOR must match the interior cabin's size** (`placeCrashedPodWreck` vs CAB_R/WALL_H) — same vessel in + out.
  - The player must **WAKE INSIDE the pod (in the desert) + release/blow the door to walk out** — NOT teleport outside
    (the current greybox `stepOut` teleports out; rework so the handoff leaves the player in the pod + the BLOW-DOOR is
    the player-triggered step-out). This is the intended T4.1 flow.
  - T4.2 desert reveal (dawn, half-buried pod, aftermath-silence, horizon hook) · T4.3 craft+salvage tutorial
    (scrap glints, machete→pry [D261], starting supplies) + the chute-pop payoff.
- **Phase 5 — Audio + music** (Web-Audio, code-auditor the graph): the full SFX arc + tutorial sounds + the chute fwoomp;
  music cues (escape sting + descent swell + desert easing).
- When the roadmap "Up next" empties (Phase 5 done) → `until: roadmap-empty` → TERMINAL (`status: completed`).

## Campaign rules (this run)
ENRICH-NOT-CUT · hero geometry/FX → procedural-modeler + the adversarial gate (5-8 rounds for new HERO assets — the
hauler exterior + the explosion ARE hero; lighter/once for FX-over-existing + integration; own-loop for camera/light
staging) · anti-punt (a `[partial]` is genuine progress toward the DoD, never a hollow scaffold) · behind the flag · no
save bump · `verify:all` (600s, real exit, NOT piped through `tail`) · **commit AND push** each cycle · **checkpoint = NONE
(no phase pauses this overnight run)** · `/loop`'s ScheduleWakeup drives the next cycle.

## Backlog / deferred (don't lose these)
- The escape-pod INTERIOR detail/improvement pass (user: "decent first model for now, tackle later") → backlog.
- Descent residuals the user flagged for live re-test: the felt scroll direction + the 18s pacing (one-line tweaks if needed).
- Skyfall hero wreck + the CAVE rework + ⑰ pickup-instancing remain OUT of this loop (separate solo sessions).

## Footguns
- The intro pod is at an OFFSET location (POD_ORIGIN y=3200), NOT the real desert — the descent vista is a SHADER
  (`LOWALT_FS`), not the real terrain. The real terrain is the post-handoff game world.
- `preview_screenshot` can hang on the heavy low-altitude scene → use `rig-shot --scenario=pod-interior|crashed-pod`.
- `addTrauma` is ROTATIONAL + STACKS per-frame — never call it per-frame for a sustained rumble (it saturates → spins the view).
- GLSL: no backticks in shader-string comments (breaks the TS template literal).
