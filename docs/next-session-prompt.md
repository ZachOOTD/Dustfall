# Session ABR — Kickoff Brief (post-ABQ)

## Read these now (in order)

1. `CLAUDE.md` (auto-loaded; the Last-shipped block summarises ABQ)
2. `docs/session-end-report.md` — cumulative state through ABQ
3. `docs/changelog.md` — ABQ + ABP entries at top
4. `docs/decisions.md` — D114 (walk cycle knee bend mid-swing-not-
   mid-stance) is the latest; D107-D113 from ABP era still apply
5. `docs/roadmap.md`
6. `docs/backlog.md` — 5 new entries from ABQ at the top of the
   freshly-added section
7. `~/projects/gamedev-framework/shared-memory/iterative-polish-
   discipline.md` — THE discipline this session runs under

## What's already built (post-ABQ snapshot)

72 sessions. Procedural mismatched-scavenger player rig + 3P camera +
held items dual-mesh + FP forearm continuity all shipped through ABP.
ABQ iterated 3 elements under the new discipline: poncho shrunk from
barrel to shawl, bandolier converted to closed-loop wrap, walk cycle
knee-bend bug fixed (D114). 1 file modified this session
(`src/player/playerRig.ts`). tsc clean. SAVE_VERSION v11 unchanged.

## Session ABR focus

**Continue ABP+ABQ iteration polish under the same discipline**. ABQ
proved the discipline works — 3 substantive iterations shipped fixes
that `tsc clean` would have shipped as "done" but visibly weren't.

ABR's job: verify the polished work in MOTION (not just static-pose
screenshots), iterate remaining queued elements, lock the rig + 3P +
held-items as actually-shipped quality.

## Priority items (in order; pick first 3-4)

### P1 — Walk cycle in real motion (~30-60min)
ABQ verified the knee-bend math at static phase=π/4 + 5π/4 via eval.
Now boot the game, sprint around, watch the rig in real motion. Look
for:
- Knee timing in motion (does the bend visually match foot-up moments?)
- Hip sway amplitude (is 0.020m visible at 3P distance?)
- Body bob amplitude (is 0.045m walking / 0.075m running enough?)
- Arm swing readability at 3P
- Forward lean during sprint

Iterate amplitudes as needed. Screenshot 2-3 mid-stride frames at
different running phases via preview tool.

### P2 — 3P camera real-playtest (~30-60min)
ABP shipped Rapier raycast collision + smoothed follow + 3P pitch
clamp. Verified mechanically. Now playtest:
- Walk into a wreck wall — camera should NOT clip through
- Rapid F-toggles — no jitter / stuck-state
- Pitch up + down — should clamp at ~45° up / 60° down
- Mount speeder while in 3P — camera will lerp visibly (no snap
  wired). Add a snap-on-mount call to set
  `ctx.player.cameraSnapNextFrame=true`. Same for dismount.

### P3 — Held items in 3P verification (~30min)
ABP shipped dual-mesh swap (D113) but only verified mechanically.
Equip each of: canteen, machete, scrap_gun, bandage. Confirm each:
- Shows in rig's right hand from 3P
- Shows as FP viewmodel in FP
- Swaps correctly on item change
- Hides from FP when in 3P (and vice versa)

If any item's hand-attach mesh is mis-scaled or mis-positioned at the
hand, tune via the rightHandAttach.position in playerRig.ts.

### P4 — FP forearm wraps positioning (~30min)
ABP's `createForearmWraps` in viewModelHands.ts attaches to
`viewmodel.itemRoot` which is camera-anchored. Positions are relative
to FP camera. Boot game in FP mode and verify the wraps READ as
"wrapping the hands" not "floating in space". May need offset tweaks.

### P5 — Pauldron polish R1 (~30min)
Was reading well in ABQ baseline; not touched. Quick R1: try 1-2
variants (more/less metallic chip, slightly larger plates, etc.) and
ship best read.

## Stretch (optional, if time after P1-P5)

### S1 — Walk-cycle to footstep-cadence sync (~1-2h)
Currently gait + footstep audio fire on separate timers. Lock them
so a heel-strike triggers the footstep SFX, not a separate timer.
Hook into the walk cycle phase reaching π/2 or 3π/2 (max-spread
moments = heel-strikes).

### S2 — ABP Tier 5 cut items (~1-2h)
- Aim twist-IK: rotate rig.shoulders[1] toward camera direction
  during aim (charged weapon hold, gun crosshair on enemy).
- Footstep dust at feet: move dust emit point from player-center to
  foot mid-stance world position via foot IK.

## Autonomy contract

When ambiguous, pick the option closest to the GDD pillars +
decisions.md realism dial (D45+, D49, D67, D86–D114), append a new
D-entry, keep going.

**Iteration discipline contract** (load-bearing for this session):
- `tsc clean` is NOT the success gate on visual/feel work
- Per substantive element: build → screenshot → critique → iterate
- 5-8 rounds for new visual, 3-5 for tuning, 1-2 for bug fix
- Real long-overnight ships 1-2 fully-iterated tiers, not 4-5 shallow
- Self-check anti-pattern flags from session-start Step 7

Stop conditions: wall-clock limit, 3-strike fix wall, catastrophic
block, destructive-action attempt.

## Notable footguns

- **ABP D107 stand**: ALL procedural; no GLB. If a polish item starts
  feeling like "I need a real animation", that's the signal to stop +
  surface to user.
- **D114 knee bend formula**: peak at MID-SWING. If touching walk
  cycle, keep the `max(0, cos(legPhase))` shape.
- **D111 asymmetric pauldron**: scavenger silhouette signal. If adding
  NPC variants with paired pauldrons → that's a SOLDIER outfit; keep
  separate.
- **D112 Rapier raycast collision**: 3P camera collision uses
  `world.castRay` excluding player body. New static colliders need no
  extra tagging; new DYNAMIC bodies that should NOT block camera need
  to be added to exclude filter chain.
- **D113 dual-mesh items**: `swapEquippedMesh` is responsible for BOTH
  FP viewmodel AND 3P rig-hand-attach lifecycle. If changing item
  swap path, update both.
- **ABP foot IK**: only runs in walking/running states. Mid-state
  transitions on slopes show brief snap to flat reference — cosmetic
  gap.
- **HMR triggers full reload** when playerRig.ts changes — preview
  state resets. Need to re-eval setup (started/thirdPerson/paused/
  dayTime/position camera) after each reload.
- **Player gravity**: setting paused=true then setTranslation puts
  player above terrain. Briefly unpause to let gravity settle, then
  re-pause for clean screenshot.

## Verification protocol

```
npm run verify     # = tsc --noEmit
npx vite build     # production-build sanity (optional)
```

For ABR-specific iteration:
- Per element: screenshot before → screenshot after each round.
  Critique in chat honestly.
- Element ships ONLY when the screenshot reads as the intended goal.
- "I screenshotted it and it looks right" beats "tsc clean".

## Begin block

Read CLAUDE.md (auto). Read session-end-report (through ABQ) +
changelog (ABQ + ABP entries) + decisions D114. Pick priority items
P1-P5. TaskCreate sub-tasks. Boot preview. Iterate.

**The iteration discipline IS the contract for this session.** If
you find yourself about to mark a polish item complete with `tsc
clean` as the only verification → STOP and screenshot first.
