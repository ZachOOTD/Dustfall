# ▶ RESUME — Escape-pod intro · Phase 0 · T0.3b (descent + the parachute gag) — `campaign/escape-pod-intro`

**Cycle 6 of the escape-pod-intro campaign.** Phase 0 (the greybox spine). T0.2 (ship) + **T0.3a
(pod + eject + ship-explode) COMPLETE**. Boot from `docs/campaign/campaign-state.json` +
`docs/roadmap.md` (NOT chat memory).

## Read first
1. `CLAUDE.md` (auto-loaded) — "Where we are now"
2. `docs/campaign/campaign-state.json` — cycle 5/150, current_tier (T0.3b)
3. `docs/feature-escape-pod-intro.md` — the vision (Beats 5-7: descent → parachute gag → impact) + BUILD PLAN
4. `docs/decisions.md` (tail) — **D269** (architecture) + **D270** (T0.1 wiring)
5. `src/world/escapePodIntro/sequence.ts` (the beat ticks + `pulledLever`/`seatPlayerAt` helpers) + `podScene.ts`

## What's built (T0.0 → T0.3a)
- Full ship section (cockpit → checkEngines → corridor) + pod section start (enterPod → shipExplode → **descent stub**). The pod (`podScene.ts`) builds + seats + has a viewport/planet.
- HUD suppression (decoupled to `startEscapePodIntro` + `handoffToGame`), diegetic prompts (`introHud.ts`), locomotion mode-gating, survival suppressed, `flashScreen` reused for the blast.
- Dev hooks: `__game.startIntro()`/`skipIntro()`/`jumpToBeat(beat)`. Beat input: `pulledLever(ctx)` = E or left-click; beats auto-advance via a fallback dwell (anti-softlock).

## Cycle 6 focus — T0.3b: the descent + the parachute GAG (Beats 5-7)
Finish the pod section through the fall. **Greybox = the beat flow + the gag landing, NOT beauty** (the hero descentProgress effect stack is Phase 2). Replace the `descent` stub:
- **`descent` beat** — the atmospheric fall. Greybox: drive a `descentProgress` 0→1 over ~N seconds (store in `scratch`); make the **planet disc grow** (scale it up as progress climbs — grab the pod's planet mesh, or add a `setDescentProgress` to `podScene.ts`) and add a little camera shake (reuse `fx/cameraShake` — `triggerCameraShake`/`addTrauma`, grep it). Mode `seated`/`scripted` (pod owns the view). After a beat → `parachute`.
- **`parachute` beat — THE GAG** (the emotional core, even in greybox): cue "pull the parachute"; the player pulls (`pulledLever`) — track `scratch.pulls`. Pulls 1 & 2: a jolt (small shake / a "—snap?" flicker) but nothing deploys. Pull 3: the lever **snaps off** — a beat of silence/faster-fall — then → `impact`. Use a per-pull debounce (require the press to release between pulls, or a small cooldown) so one held click ≠ 3 pulls. Keep a fallback (after M seconds or M auto-pulls) so it can't softlock.
- **`impact` beat** — T0.4 STUB for now (the crash/blackout/wake + the **desert handoff** are T0.4). Greybox: a hard `flashScreen` + a "[ impact — T0.4 ]" cue, hold. (T0.4 will: blackout → wake → teleport to the desert spawn → `endEscapePodIntro` + mark `introComplete`.)

### Acceptance (T0.3b)
- From `descent`: the planet grows + a shake conveys falling → `parachute` → the **3-pull gag** works (1-2 jolt, 3rd snaps, then falls) → `impact` stub. HUD clean throughout; `__game.jumpToBeat('descent'|'parachute')` works; `skipIntro` disposes everything (scene-children round-trips). `verify:all` green; no SAVE_VERSION bump.

## Visual/feel gate (greybox, routine bar)
Drive `__game.jumpToBeat('descent')` / `'parachute'` + screenshot the real FP view (the growing planet, the gag pulls). Confirm HUD hidden, the gag reads (3 distinct pulls → snap), flow advances, geometry disposes on skip. Routine bar. Note: the 3-pull gag is **feel-critical comedy** — the user will judge the timing at the Phase 0 walk-test; get the beats *roughly* right, real polish is later phases.

## Then (rest of Phase 0)
T0.4 — greybox impact/blackout/wake → **the desert handoff** (teleport to the desert spawn, restore
play, mark `introComplete`, dispose pod) → the craft+salvage tutorial scaffold + a `feature-escape-pod-intro`
smoke check. **Phase 0 milestone → PAUSE** for the user's first full greybox-spine walk-test.

## Campaign rules
ENRICH-NOT-CUT · greybox now / hero art (procedural-modeler + real FP-view gate) in Phases 1-5 ·
anti-punt (decompose, don't hollow) · behind the flag · no save bump · `verify:all` (capture the real
exit — don't pipe through `tail`) + a live check each cycle · commit each cycle · checkpoint = per phase.

## Footguns
- Keep the flag OFF by default — live game byte-identical when the intro isn't active.
- Debounce the parachute pulls (one held click must not count as 3). Always have an anti-softlock fallback.
- Dispose ALL intro geometry on `endEscapePodIntro` (ship + pod) — check `scene.children` round-trips on `skipIntro`.
- `introActive` gating ≠ pause. New body-appended HUD must be added to `introHud.ts` `GAME_HUD_IDS`.
- Reuse `fx/cameraShake` + `fx/screenFlash` (don't reinvent). Beat state in `ctx.intro.scratch` (reset per beat).

## Verify
`npm run verify:all` (capture the real exit code) + a live preview: `jumpToBeat('descent')` → confirm planet grows + advances; `jumpToBeat('parachute')` → simulate 3 pulls (`pulledLever` via input, or step `scratch.pulls`) → confirm snap → impact; `skipIntro` round-trips scene-children; 0 console errors.
