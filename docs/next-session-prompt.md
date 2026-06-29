# ⏸ PAUSED — Escape-pod intro · PHASE 2 MILESTONE (the descent showpiece COMPLETE) — `campaign/escape-pod-intro`

**The campaign is PAUSED at the Phase 2 milestone** (`status: paused`, `awaiting_approval: true`,
`stop_reasons: ["milestone-review"]`). The beautiful atmospheric descent is whole — vista + cabin-light +
re-entry FX + the tumbling reveal. **The user walk-tests, then `/campaign-approve` releases Phase 3.** Do NOT
auto-continue the loop until approved.

## 🎮 FOR THE USER — walk-test the descent (Phase 2): the beautiful atmospheric fall
This is the emotional core you described in the vision interview — watch the whole thing play:
- **Eject → the tumble:** pull the eject lever; the ship dies in a blast and the pod is flung **tumbling** —
  the cabin rolls + floods with the explosion's orange light, settling level into the fall.
- **Re-entry:** the pod punches into the upper atmosphere — plasma burns past the glass (a white-hot core),
  a flash, heat-shimmer, the pod buffeting — then it breaks through into calm.
- **The descent:** the **beautiful fall** — from orbit you watch a curved Dune-desert planet with a glowing
  blue atmosphere limb against the stars, then cross-fade down through the atmosphere to a dawn-lit dune
  surface rushing up, the cabin warming with the dawn light.
- **The parachute gag** follows (3 pulls → it snaps; no chute → crash). [unchanged from Phase 0]

**How to play it:**
- **Real flow:** set `FEATURES.escapePodIntro = true` (`src/config/features.ts`) → start a NEW game → play
  from the start (cockpit → corridor → pod → eject → **the descent** → parachute → crash → desert).
- **In-console, jump to the descent:** `__game.startIntro()` then `__game.jumpToBeat('enterPod')` (then pull
  the eject lever to trigger the tumble→descent), or `__game.jumpToBeat('shipExplode')` (the tumble) /
  `'descent'` (the fall) / `'parachute'`. `__game.smokeIntro()` runs the whole chain.

**What to give feedback on:** the FEEL + look of the descent — the **tumble** (does the spin feel right, or
too much / too little / nauseating?), the **re-entry** (violent + tense?), the **descent pacing** (the ~8s
fall — too fast / slow? does the surface "rush up"?), the planet/atmosphere beauty, the cabin light, the
parachute gag. Drop notes in `docs/campaign/steering.md` or say them. **The MOTION/pace is the key thing
stills couldn't judge** — that's what this walk-test is for.

**Known deferred (NOT bugs):**
- The **hero ship explosion** seen through the tumble frame is **Phase 3** — right now the blast is staged via
  the flash + the cabin blast-flood + the tumble (the ship itself is greybox/disposed at the blast).
- Sev-3 polish noted from the gates: the re-entry white-hot core could go a touch whiter/larger; the descent
  vista is dim at the plasma peak; the d05↔d09 dune-scale progression is subtle. All walk-test-or-later.
- Audio is Phase 5 (the descent is silent for now).

## ▶ AFTER `/campaign-approve` → Phase 3 — The hauler (hero) + the disaster staging
Boot from `docs/campaign/campaign-state.json` + `docs/roadmap.md`. The ship you flee + the disaster that
drives you to the pod (it precedes the now-built descent):
- **T3.1 Hauler exterior** (procedural-modeler) — the worn cargo-hauler silhouette (rear engines), a hero
  asset → the full adversarial gate.
- **T3.2 Explosion FX** — the ship blowing up; **stage it through the C17 tumble frame** (the tumbling-reveal
  staging + `setTumbleLight` blast-flood hook are already built — fill them with the hero ship's death; the
  window can drift across the exploding ship → space → planet as the pod tumbles away).
- **T3.3 Cockpit** (escalating consoles + a personal touch) · **T3.4 Corridor + disaster staging** (3 lighting
  zones, only-open-door funnel, fire, red-alert, spatial audio).
- **Milestone: Phase 3 — ship COMPLETE → USER WALK-TEST → `/campaign-approve`.**

## State of the code (Phase 2)
- `src/world/escapePodIntro/podScene.ts` — the descent VISTA (`PLANET_VS/FS`, `ATMO_FS`, `STAR_FS`,
  `LOWALT_FS`), the re-entry FX (`PLASMA_FS`, `SHIMMER_FS`), the cabin-light hooks (`setDescentProgress`'s
  section 6 + `setTumbleLight`). The single `setDescentProgress(0..1)` is the descent's animation surface.
- `src/world/escapePodIntro/sequence.ts` — the beat machine; `tickShipExplode` = the tumbling reveal,
  `tickDescent` = the fall + the re-entry felt half (flash + shake on the shared `re` curve).
- `src/player/controller.ts` — `applyIntroTumble` (the tumble camera post-multiply, storm-sway pattern).
- Rig: `rig-shot.mjs --scenario=pod-interior --descent=<0..1>`; `preview_screenshot` works for the offset pod.

## Campaign rules
ENRICH-NOT-CUT · hero geometry/FX → procedural-modeler + the adversarial gate (the gate caught real defects on
the hero vista every round; run it on hero assets, lighter/once on FX-over-existing, own-loop for contained
camera/light staging + motion [a still can't gate a spin]) · anti-punt · behind the flag · no save bump ·
`verify:all` (600s, real exit, NOT piped through `tail`) · commit each cycle · checkpoint = per phase.
