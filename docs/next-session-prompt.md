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

## ⚠ Phase 3 STATUS (C20 overnight) — STRATEGIC PIVOT: hero VISUALS → user's morning; overnight builds the PLAYABLE intro
**Why the pivot:** two consecutive Phase-3 hero VISUAL assets (C19 hauler exterior, C20 cockpit interior) plateaued below the
released-game bar across multiple modeler rounds + adversarial gates (each gate failed ×2) — AND both are assets the user will
art-direct regardless (the hero ship + the game's opening shot; the descent took 5 user rounds). So **stop grinding the modeler
on hero visuals overnight; build the LOGIC/STAGING/AUDIO that makes the whole intro PLAY** (the main loop's strength, no user-eye
needed). The user wakes to a fully-playable intro end-to-end + a hero-visual art-direction list.

**⚠ DEFERRED to the user's MORNING art-direction (do NOT spin more autonomous modeler rounds on these overnight):**
- **T3.1 hauler exterior** — wired placeholder, `__game.buildHauler()` / `rig-shot --scenario=hauler`. Gate: silhouette/engines/cockpit don't read; muddy material.
- **T3.3 cockpit surface-fidelity** — the real cockpit (`shipScene.ts`), much improved, `rig-shot --scenario=cockpit`. Gate: flat untextured walls, no rivets-as-geometry, blank CRT text, candy-button gauges, blank photo, flat lighting, planet cropped too big. The OPENING SHOT reads but needs the user's eye.
- **T3.2 explosion FX** + the **hero corridor geometry** — deferred with them.

**▶ BUILD NEXT (overnight): T3.4 — the disaster STAGING** (main-loop logic, over the EXISTING greybox corridor — NOT new hero
geometry). The Beat 1-2 disaster: the "check engines" prompt → the corridor walk → reaching the back triggers the disaster
(engine fire behind the door) → **red-alert** (drive the cockpit `setCockpitAlert(2)` [hook built C20] + corridor red lighting +
strobe) → the 3 lighting zones + the only-open-door funnel (guide the player) + spatial-audio cue hooks → flee back to the pod
(enterPod). Make the ship's DEATH play. Wire the E2 console escalation (ORBIT→CORE TEMP CRITICAL→HULL BREACH) via setCockpitAlert.
**Then Phase 4** (crash/wake/reveal + tutorial — the C18 reqs: crashed-pod exterior matches the interior size; WAKE INSIDE the pod
+ blow-the-door to step out, NOT teleport-out; desert reveal; craft+salvage tutorial [machete→pry D261]; the chute-pop payoff) →
**Phase 5** (audio: the full SFX arc + music cues + the chute fwoomp). These are logic/integration/audio — the main loop's strength.
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
