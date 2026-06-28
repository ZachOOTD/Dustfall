# ▶ RESUME — Escape-pod intro · Phase 0 · T0.3 (greybox descent + pod) — `campaign/escape-pod-intro`

**Cycle 5 of the escape-pod-intro campaign.** Phase 0 (the greybox spine). **T0.2 (greybox ship +
Beats 0-2) COMPLETE.** Boot from `docs/campaign/campaign-state.json` + `docs/roadmap.md` (NOT chat memory).

## Read first
1. `CLAUDE.md` (auto-loaded) — "Where we are now"
2. `docs/campaign/campaign-state.json` — cycle 4/150, current_tier (T0.3)
3. `docs/feature-escape-pod-intro.md` — the vision (Beats 3-6: enterPod → shipExplode → descent → parachute) + BUILD PLAN
4. `docs/decisions.md` (tail) — **D269** (architecture) + **D270** (T0.1 wiring)
5. `src/world/escapePodIntro/sequence.ts` (the dispatch + the beat ticks) + `shipScene.ts` (the greybox pattern) + `introHud.ts` (prompts/HUD)

## What's built (T0.0 → T0.2)
- Framework + new-game/save wiring + dev hooks. Greybox ship (cockpit + corridor) that PLAYS: cockpit (seated dwell) → checkEngines (prompt) → corridor → **enterPod (a T0.3 stub)**.
- `introHud.ts`: `setGameHudHidden` (HUD suppressed during intro) + `showIntroPrompt`/`hideIntroPrompt`. Locomotion mode-gating (`ctx.intro.mode`). Survival suppressed during intro.
- Dev hooks: `__game.startIntro()` (force), `skipIntro()`, `jumpToBeat(beat)`. Triggers read capsule world-Z (`SHIP_CORRIDOR_ENTER_Z`/`SHIP_DEAD_END_Z`).

## Cycle 5 focus — T0.3: the greybox DESCENT + the pod (Beats 3-6)
Continue the spine from `enterPod` through the fall. **Greybox = blockout + correct beat flow + the gag, NOT beauty** (the descentProgress hero effect stack is Phase 2; the hero pod is Phase 1). **This is large — DECOMPOSE it** (like T0.2 → a/b):
- **T0.3a — the pod + eject + ship-explode** (this cycle, probably):
  - A greybox **escape-pod interior** (a small enclosed capsule, seated, with a viewport) — new geometry in `shipScene.ts` or a new `podScene.ts`, same pattern (box meshes + a viewport quad, far offset, built lazily). Reuse `getShipSpawn`-style placement.
  - `enterPod` — replace the stub: teleport the capsule into the pod, mode `seated`, a "pull the eject lever" prompt; on a key/click (or a short dwell) → `shipExplode`.
  - `shipExplode` — through the viewport, the ship explodes (greybox: a white flash / a placeholder burst via `introHud` or a quick scene tint); brief, then → `descent`.
- **T0.3b — the descent + the parachute gag** (likely next cycle):
  - `descent` — the atmospheric fall (greybox: a timer + a growing planet / placeholder shake; the real descentProgress effect stack is Phase 2). After a beat → `parachute`.
  - `parachute` — **THE GAG**: a "pull the parachute" prompt; the player pulls (key/click) **3 times** (track `scratch.pulls`); pulls 1-2 jolt but hold; pull 3 → the lever **snaps off** (no chute) → a beat of falling → `impact` (T0.4 handles impact/blackout/wake).
- **Camera during descent** — mode `scripted` or `seated` (the pod owns the view); free-look optionally allowed. The pod/viewport frames the fall.

### Acceptance (T0.3a, this cycle)
- From `enterPod`: you're seated in the greybox pod looking out the viewport → "pull eject" → `shipExplode` (a flash through the viewport) → `descent` (stub/handoff to T0.3b). HUD stays suppressed. `__game.jumpToBeat('enterPod'|'shipExplode')` works. `skipIntro` hands back cleanly (disposes pod + ship geometry). `verify:all` green; no SAVE_VERSION bump.

## Visual/feel gate (greybox, routine bar)
Drive `__game.jumpToBeat(...)` + screenshot the real FP view at each new beat (seated pod, the explosion flash, the descent). Confirm HUD hidden, prompts readable, flow advances, geometry disposes on skip. Routine bar (no sev≥2). Hero pod/descent FX are Phases 1-2.

## Then (rest of Phase 0)
T0.3b descent + parachute gag (if split) · T0.4 greybox impact/wake → **desert handoff** (the
pod-as-spawn seam: teleport to the desert spawn, mark `introComplete`, restore normal play) →
tutorial scaffold + smoke check. **Phase 0 milestone → PAUSE** for the user's first full walk-test.

## Campaign rules
ENRICH-NOT-CUT · greybox now / hero art (procedural-modeler + real FP-view gate) in Phases 1-5 ·
anti-punt (decompose big tiers, don't hollow them) · behind the flag · no save bump · `verify:all` +
a live check each cycle · commit each cycle · checkpoint = per phase. Steer via `docs/campaign/steering.md`.

## Footguns
- Keep the flag OFF by default — live game byte-identical when the intro isn't active.
- **Don't pipe `verify:all` through `tail`** — `tail`'s exit (0) masks tsc failures. Capture the real exit (`... > out 2>&1; echo EXIT=$?`).
- Dispose ALL intro geometry (ship + pod) on `endEscapePodIntro` — check `scene.children` count round-trips on `skipIntro`.
- New body-appended HUD elements must be added to `introHud.ts` `GAME_HUD_IDS` or they leak into the intro (the storm-warning did).
- Beat prompts/flow use `ctx.intro.scratch` (reset each beat by `jumpToBeat`). `introActive` gating ≠ pause.

## Verify
`npm run verify:all` (capture the real exit code) + a live preview: `__game.jumpToBeat('enterPod')` → screenshot the seated pod (HUD hidden) → step the beats (dwell/click) → confirm `shipExplode`/`descent` advance + `skipIntro` round-trips the scene-children count + no console errors.
