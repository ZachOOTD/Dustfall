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

**✅ SHIPPED (overnight, main-loop logic):** T3.4 disaster staging (C21) · T4.1 WAKE-INSIDE-POD + BLOW-DOOR (C22, the C18 req) ·
T4.2 DESERT REVEAL (C23 — dawn handoff + aftermath-silence pacing E7 + the horizon-hook emergence E8) · T5.1a INTRO SFX (C24 —
8 procedural Web-Audio one-shots wired to the beats: eject/explosion/klaxon/hull-groan/re-entry/lever-click+snap/crash/door-blow).

**✅ T5.1b ambient LOOPS SHIPPED (C25)** — cockpit hum (Beat 0→eject) + descent rush (descent→impact), with start/stop lifecycle.

**▶ BUILD NEXT (overnight): T5.2 — MUSIC cues** (main-loop, Web Audio synthesis — no samples): cues in the game's current vibe —
a tense **escape sting** (cockpit→disaster→eject), a **beautiful descent swell** (the calm fall), a **desert easing** (the dawn
reveal/handoff). Procedural, layered onto the existing audio buses; mind the lifecycle (start/stop per phase, like the loops).
**T5.2 is the FINAL overnight-tractable piece** — after it, everything remaining needs the user (hero visuals, T4.3, LISTENING to
balance), so the loop should write the comprehensive morning summary + **STOP** (don't start doing the deferred-to-user work).
**Deferred to the user's morning:** [hero VISUALS] the hauler, cockpit surface-fidelity, the
explosion FX, the hero corridor + fire FX, the HERO crashed-cabin wake interior + exterior↔interior size-match, a dedicated hook
landmark; [feel/playtest] **T4.3** the craft+salvage tutorial + the comic chute-pop payoff (the salvage-pry can't be verified
unattended; the `scrap_machete`/D261 pry tool + the salvage system EXIST — wire the pod as a pryable `escape_pod` salvageable +
the chute-pop). The whole intro now PLAYS end-to-end with sound; the deferred list is the feel/visual/comic polish for the user.
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
