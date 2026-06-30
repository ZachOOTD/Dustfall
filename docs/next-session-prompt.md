# ▶ REBUILD v2 — Escape-pod intro · the REAL-WORLD physical intro — `campaign/escape-pod-intro`

**Campaign ACTIVE, `checkpoint: milestone` (ATTENDED — the user art-directs the hero looks; pause at each
`### Milestone:` R-phase boundary for their review/`/campaign-approve`).** The user walk-tested the v1
overnight build (C19-C26) + directed a re-architecture. **READ `docs/feature-escape-pod-intro.md` `## REBUILD v2`
FIRST** (the full plan + locked decisions). Boot every cycle from `docs/campaign/campaign-state.json` +
`docs/roadmap.md` (the REBUILD R-phases are the active "Up next"). Each cycle PUSHES the branch (the preview refreshes).

## The rework (why + what)
The v1 intro was built at a hidden OFFSET + faked space/descent via shaders + split the pod into 3 teleport-stitched
models — the root of the "fake" reads. **The shift (user-approved):** re-ground in the REAL world; ONE physical pod
(enter/eject/ride/crash/wake/exit, no teleport); space = a wrapping celestial SKYBOX (the real sky in "space mode",
NOT a flat plane); descent = the pod PHYSICALLY falling + crashing into the real desert (the viewport = the actual
spawn world; multiplayer-ready). Orbit→atmosphere = a scripted re-entry (NOT a literal 100km fall — float precision
wall ~10km). The v1 beats/audio/staging CARRY OVER (re-grounded, not rewritten).

## Where the rework stands
- **✅ R1a SHIPPED — the real sky in "space mode"**: `setSkyIntroMode(space01)` in `src/world/sky.ts` drives the game's
  REAL camera-relative sky into space (dark dome, `uCloudiness→0`, full wrapping stars, a large real-scale planet +
  atmosphere limb; `0` = the normal sky, byte-unchanged). The fake `buildOrbitView` star/atmo planes are GONE from
  `shipScene.ts`. Wired into the beats (space at the cockpit, ease to dawn at re-entry, restored at handoff; cabin
  dust hidden in orbit). `__game.setSkyIntroMode`; rig `--scenario=cockpit --space`.
- **▶ R1b NEXT — re-ground the DESCENT into real-world coordinates**: the pod falls toward the player's REAL spawn;
  the viewport shows the REAL world (real terrain/sky), NOT the `LOWALT_FS` shader fake. Delete the pod's
  `STAR_FS`/`LOWALT_FS` fakes (`podScene.ts`). The space→dawn sky ease is already wired (`setSkyIntroMode` in
  `tickDescent`). [the deeper half of the keystone]. Then R1c (remove teleport seams — intertwined with R3).
- The intro plays behind `FEATURES.escapePodIntro` (off in master; the preview build flips it on).
- **Footgun:** float precision jitters past ~10km from origin — the physical fall starts at a FEASIBLE altitude
  (a few km above the spawn), NOT true orbit; the skybox establishes "orbit." Real-world coords near the spawn.

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
