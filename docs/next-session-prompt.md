# ▶ RESUME — Escape-pod intro · Phase 1 · T1.3 (seated-FP camera + beat-framing) — LAST Phase 1 unit — `campaign/escape-pod-intro`

**Cycle 13 of the escape-pod-intro campaign.** Phase 1 (the hero pod, CYLINDRICAL). C11 exterior + C12
interior shipped (the round riveted-aluminium capsule). **T1.3 is the LAST Phase 1 unit** — after it,
the cycle **PAUSES at the Phase 1 milestone** for the user's "pod in + out" walk-test. Boot from
`docs/campaign/campaign-state.json` + `docs/roadmap.md` (NOT chat memory).

## Read first
1. `CLAUDE.md` (auto-loaded) — "Where we are now"
2. `docs/campaign/campaign-state.json` — cycle 12/150, current_tier (T1.3)
3. `docs/roadmap.md` — the `### Milestone: escape-pod Phase 1` marker
4. `src/world/escapePodIntro/podScene.ts` (`getPodSpawn` seated spawn, the cabin: viewport + red parachute lever + yellow eject + console + seat) + `src/world/escapePodIntro/sequence.ts` (the seated beats: enterPod/shipExplode/descent/parachute; `ctx.intro.mode==='seated'`; the per-beat prompts) + `src/player/controller.ts` (the `introLocoLocked` mode-gating + `ctx.player.eyeOffset`).

## What's built (Phase 1)
- **C11 EXTERIOR** (`placeCrashedPodWreck`) + **C12 INTERIOR** (`buildPodScene`) = the cylindrical riveted-aluminium capsule, exterior + round cabin, both passed adversarial gates.
- The seated beats place the player via `seatPlayerAt(getPodSpawn(ctx))` facing −Z (the viewport), mode `seated`. Controls: red parachute lever (right, `setParachuteLeverPull`), yellow eject (left wall), console, the forward viewport (planet swells via `setDescentProgress`).
- KNOWN gaps for T1.3 (from the C12 gates): (a) the seated eye uses STANDING height (~1.7, `Tuning.PLAYER_EYE_OFFSET`) — the cabin was sized up to suit it rather than lowering the player into the chair; (b) **eject/parachute beat-framing**: during enterPod the prompt says "pull the eject lever" but the camera faces the RED parachute lever (the yellow eject is on the −X wall, off-frame); the same input (`pulledLever` = E/click) advances both beats, so the visual story is muddled.

## Cycle 13 focus — T1.3: the seated-FP camera + viewport framing + beat-framing
Mostly camera/feel + light sequence work (do it in the main loop with the visual gate; pull the procedural-modeler only if geometry must move).
- **Seated eye height** — lower the camera to a true SEATED eye (sit the player into the bucket seat) instead of standing height. Set a seated `eyeOffset` while `ctx.intro.mode==='seated'` (restore the normal offset at the desert handoff/`endEscapePodIntro` so the player stands normally in the real game). Re-confirm the viewport sits at eye level + the controls are in natural seated sightlines from the new eye.
- **Viewport framing** — the descent showpiece (Phase 2) frames through the viewport; confirm the planet (via `setDescentProgress` 0→1) reads centered + dramatic from the seated eye across progress.
- **Beat-framing (resolve the eject/parachute confusion)** — give each beat a look-direction that frames its control + keep the prompt naming consistent:
  - `enterPod` ("pull the eject lever") → orient/cue toward the YELLOW eject control (or relabel + make the eject the salient prompted control). 
  - `parachute` ("pull the parachute") → frame toward the RED parachute lever.
  Drive the look in the beat tick (set the camera/look-direction for the scripted moment) OR clearly cue which control via the prompt + a highlight. The goal: the player always knows which control the current beat means. (Camera-driven look = `ctx.intro.mode==='scripted'` for those beats, or a gentle look-nudge; keep free-look where the vision wants it.)
- **Free-look bounds (optional)** — seated free-look shouldn't clip out of the cabin; add a gentle clamp if needed.

### Acceptance (T1.3 → Phase 1 complete)
- From the seated FP view the player sits believably in the bucket seat (not floating at standing height): viewport at eye level (planet framed across the descent), the eject control framed/cued during enterPod, the parachute lever during parachute (no eject/parachute confusion), no clipping out of the cabin on free-look. The beats still play (`smokeIntro` ok). `verify:all` green end-to-end (600s, real exit); flag OFF → live game byte-unchanged; no SAVE_VERSION bump. Restore the normal eyeOffset at the handoff.

## Visual gate
Drive `__game.startIntro()` → `jumpToBeat('enterPod'|'descent'|'parachute')` + screenshot the seated FP view (preview works for the offset pod interior). Confirm the seated eye, the viewport framing, and the per-beat control framing. A light gate (own-eyes + 1-2 critics) suffices — the heavy hero-geometry gates are done (C11/C12); T1.3 is camera/feel.

## ⏸ AFTER THIS CYCLE: PHASE 1 MILESTONE PAUSE
When `/session-end` moves the Phase 1 tiers to Shipped, set `status: paused`, `awaiting_approval: true`,
`stop_reasons: ["milestone-review"]` and **STOP the loop** (no ScheduleWakeup). Surface to the user:
**walk-test the pod IN + OUT** — wake beside the half-buried hero capsule in the desert (exterior) + ride
the pod through eject/descent/parachute (interior). Play via `FEATURES.escapePodIntro = true` + new game,
or `__game.startIntro()`. Then `/campaign-approve` releases Phase 2 (the descent showpiece — the
`descentProgress` effect stack + the planet/atmosphere vista that frames through the pod viewport).

## Campaign rules
ENRICH-NOT-CUT · the adversarial visual gate for hero geometry (C11/C12 done) · anti-punt · behind the flag ·
no save bump · `verify:all` (600s, real exit, NOT piped through `tail`) · commit each cycle · checkpoint = per phase.

## Footguns
- RESTORE the normal `eyeOffset` at the desert handoff — don't leave the player crouched in the real game.
- Keep the podScene contracts + the beats playing (`smokeIntro` ok).
- The hero planet/atmosphere VISTA is Phase 2 — T1.3 just frames the (greybox) viewport well.
- `preview_screenshot` works for the offset pod interior; hangs on the full desert. `verify:all` slow → 600s.
- Keep `FEATURES.escapePodIntro` OFF by default.

## Verify
`npm run verify:all` (600s, real exit) + a seated-FP visual check (seated eye + viewport framing + per-beat control framing) + `smokeIntro` ok + 0 console errors. Then `/session-end` → the Phase 1 milestone pause.
