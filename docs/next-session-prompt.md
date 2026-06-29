# ▶ RESUME — Escape-pod intro · Phase 1 · T1.3 (seated-FP camera + viewport framing) — LAST Phase 1 unit — `campaign/escape-pod-intro`

**Cycle 11 of the escape-pod-intro campaign.** Phase 1 (the hero pod). T1.1 exterior (C9) + T1.2 interior
(C10) shipped. **T1.3 is the LAST Phase 1 unit** — after it, the cycle **PAUSES at the Phase 1 milestone**
for the user's "pod in + out" walk-test. Boot from `docs/campaign/campaign-state.json` + `docs/roadmap.md`.

## Read first
1. `CLAUDE.md` (auto-loaded) — "Where we are now"
2. `docs/campaign/campaign-state.json` — cycle 10/150, current_tier (T1.3)
3. `docs/roadmap.md` — Phase 1 line + the `### Milestone: escape-pod Phase 1` marker
4. `docs/feature-escape-pod-intro.md` — the seated-FP / viewport-framing intent
5. `src/world/escapePodIntro/podScene.ts` (`getPodSpawn`, the hero cabin + viewport) + `src/world/escapePodIntro/sequence.ts` (`seatPlayerAt`, the seated beats: enterPod/shipExplode/descent/parachute; `ctx.intro.mode === 'seated'`) + `src/player/controller.ts` (the `introLocoLocked` mode-gating + `ctx.player.eyeOffset`)

## What's built (Phase 1 so far)
- **T1.1 hero pod EXTERIOR** (`placeCrashedPodWreck`) + **T1.2 hero pod INTERIOR** (`buildPodScene`: cabin, viewport, red parachute lever w/ `setParachuteLeverPull`, yellow eject, console, seat).
- The seated beats place the player via `seatPlayerAt(getPodSpawn(ctx))` facing −Z (the viewport), mode `seated` (locomotion off, free-look on). The descent planet shows + grows through the viewport.
- KNOWN T1.3 gap (flagged by the T1.2 agent): the seated "eye" currently uses the STANDING capsule height (~1.7m, `Tuning.PLAYER_EYE_OFFSET`), so the cabin was sized UP to suit it rather than the player being lowered into the chair. T1.3 fixes the seated camera pose.

## Cycle 11 focus — T1.3: the seated-FP camera + viewport framing
Lock the seated first-person camera so the player sits BELIEVABLY in the chair and the viewport frames the descent showpiece (Phase 2 frames through it). This is camera/feel work (the procedural-modeler can help if geometry tweaks are needed, but it's mostly camera tuning — do it in the main loop with the visual gate).
- **Seated eye height** — lower the camera to a true seated eye (sit the player into the chair) instead of standing height. Options: a per-beat seated `eyeOffset` (set `ctx.player.eyeOffset` lower while `ctx.intro.mode === 'seated'`, restore on handoff), or bake a seated offset into `getPodSpawn`/`seatPlayerAt`. Make the viewport sit at eye level dead-ahead, the lever + eject in natural seated reach, the console at a glance-down angle. (Re-frame the cabin if needed — but prefer moving the camera over resizing the hero cabin the T1.2 agent tuned.)
- **Viewport framing** — confirm the descent planet (via `setDescentProgress`) fills the viewport nicely from the seated eye across progress 0→1 (the Phase-2 showpiece lives here). Adjust the viewport/planet framing so the swelling planet reads centered + dramatic from the seat.
- **Free-look bounds (optional)** — seated free-look should let the player glance at the lever/eject/console + back to the viewport without clipping out of the cabin; if the look range needs a gentle clamp while seated, add it (small, optional).
- **Re-verify the seated beats** read well from the new eye: enterPod (eject control reachable), descent (planet framed), parachute (the lever jab/snap visible from the seat).

### Acceptance (T1.3 → Phase 1 complete)
- From the seated FP view the player sits believably in the cabin: viewport at eye level (planet framed across the descent), lever + eject + console in natural seated sightlines, no clipping out of the cabin on free-look. The beats still play (`smokeIntro` ok). `verify:all` green end-to-end (600s budget, real exit); flag OFF → live game byte-unchanged; no SAVE_VERSION bump.

## ⏸ AFTER THIS CYCLE: PHASE 1 MILESTONE PAUSE
When `/session-end` moves the Phase 1 tiers to Shipped (all before `### Milestone: escape-pod Phase 1`),
set `status: paused`, `awaiting_approval: true`, `stop_reasons: ["milestone-review"]` and **STOP the loop**
(no ScheduleWakeup). Surface to the user: **walk-test the pod in + out** — wake beside the hero crashed pod
in the desert (the exterior) + ride the pod through eject/descent/parachute (the interior). Play via
`FEATURES.escapePodIntro = true` + new game, or `__game.startIntro()`/`jumpToBeat`. Then `/campaign-approve`
releases Phase 2 (the descent showpiece — the `descentProgress` effect stack).

## Campaign rules
ENRICH-NOT-CUT · hero/feel work + the real in-game-view gate · anti-punt · behind the flag · no save bump ·
`verify:all` (600s, real exit, not piped through `tail`) + the visual gate · commit each cycle · checkpoint = per phase.

## Footguns
- Lowering the seated eye: RESTORE the normal `eyeOffset` at the desert handoff (`endEscapePodIntro`/stepOut) so the player stands normally in the real game — don't leave them crouched.
- Keep the beats working (`smokeIntro` ok) + the contracts intact.
- `preview_screenshot` WORKS for the pod interior (offset, light scene); it HANGS on the full desert (use the `crashed-pod` rig for desert views). `verify:all` is slow — 600s + real exit.
- Keep `FEATURES.escapePodIntro` OFF by default.

## Verify
`npm run verify:all` (600s, real exit) + a seated-FP visual gate (preview screenshot at enterPod/descent/parachute from the new seated eye — viewport framed, controls in reach) + `smokeIntro` ok + 0 console errors. Then `/session-end` → the Phase 1 milestone pause.
