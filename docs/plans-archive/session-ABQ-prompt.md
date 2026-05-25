# Session ABQ — Kickoff Brief (post-ABP)

## Read these now (in order)

1. `CLAUDE.md` (auto-loaded)
2. `docs/session-end-report.md` — cumulative state through ABP
3. `docs/changelog.md` — ABP entry at top (substantial — tiered polish session)
4. `docs/decisions.md` — D111-D113 are the latest (procedural clothing
   layering, 3P camera collision arch, dual-mesh held items)
5. `docs/roadmap.md`
6. `docs/backlog.md`
7. `docs/research/3p-cameras-in-games.md` (if touching 3P further)
8. `docs/research/sci-fi-desert-scavenger-aesthetic.md` (if touching rig further)

## What's already built (post-ABP snapshot)

71 sessions. **NEW**: procedural mismatched-scavenger player rig
(hood + poncho + bandolier + asymmetric pauldron + face bandana +
forearm wraps; tapered torso, elongated head, finger hands) +
knee/elbow sub-pivots + 3-phase walk cycle + FOOT IK to terrain +
hip sway / run lean / head counter-bob. **3P camera**: Rapier raycast
collision (0.3m pushback) + smoothed follow at ~10/s + 3.2m/1.8m
offsets + 3P pitch clamp. **Held items dual-mesh**: items render in
the rig's right hand (3P) AND in the FP viewmodel (FP); both swap in
lockstep on item change. **FP viewmodel forearm wraps** for outfit
continuity. D107 zero-asset policy preserved — all procedural.
SAVE_VERSION v11 unchanged.

## Suggested focus (pick one)

### Big-ticket (single session, 4-10h)

- **A1 infinite chunk streaming** (~6-10h). Last major architectural
  lift. Lazy 800m chunks at boundaries; free farthest; per-chunk seed
  derivation; GPU memory budget. Save bump v11→v12.
- **B1 generalized rope attachment (re-scoped)** (~4-5h). Re-deferred
  from ABP cycle (was last cut from ABO). RopeEndpoint union + Tether
  {endpointA, endpointB} + RMB-on-item UX. Plan still available.

### Medium (~2-5h)

- **Migrate remaining 4 flagships to composite procgen** (~6-8h) —
  if ABO B6 engineBlock POC reads well in playtest, sweep megaShip /
  megaWreck / satelliteDish / crashedHull using flagship_<kind>
  fixed-recipe pattern.

### Polish / quick wins (~30 min – 2h, ABP follow-ups)

- **3P upper-body aim twist-IK** (~1-2h) — ABP Tier 5 cut. Rotate
  rig.shoulders[1] toward camera direction during aim. Reads as
  character physically aiming.
- **Footstep dust at foot terrain contact** (~30min-1h) — ABP Tier 5
  cut. Move dust emit from player-center to foot mid-stance position.
- **3P walk-cycle to footstep cadence sync** (~1-2h) — gait + footstep
  audio currently fire on separate timers; lock them together.
- **3P camera teleport snap wiring** (~30min) — wire mount/dismount/
  save-load to set `ctx.player.cameraSnapNextFrame` so camera
  doesn't lerp across teleports.
- **3P mouse-look ergonomics** (~2-3h) — Souls-style orbit around
  player vs current "aim from player". Make optional.

## Autonomy contract

When ambiguous, pick the option closest to the GDD pillars +
decisions.md realism dial (D45+, D49, D67, D86–D113), append a new
D-entry, keep going.

Stop conditions: wall-clock limit, 3-strike fix wall, catastrophic
block, destructive-action attempt.

## Notable footguns

- **ABP D107 stand**: ALL procedural; no GLB. If a polish item starts
  feeling like "I need a real animation", that's the signal to stop +
  surface to user (don't quietly add asset loaders).
- **D111 asymmetric pauldron**: scavenger silhouette signal. If
  adding NPC variants with paired pauldrons, that's a SOLDIER outfit
  — keep separate from the scavenger rig.
- **D112 Rapier raycast collision**: 3P camera collision uses
  `world.castRay` excluding `ctx.player.body.body`. If adding new
  static colliders that should block camera, no extra tagging needed
  (Rapier already sees them); if adding new DYNAMIC bodies that
  should NOT block camera, add to the exclude filter chain.
- **D113 dual-mesh items**: `swapEquippedMesh` is now responsible
  for BOTH FP viewmodel AND 3P rig-hand-attach mesh lifecycle. If
  changing item swap path, update both.
- **ABP FP↔3P visibility**: per-frame in `updateViewModel`. The
  F-key handler in input.ts also flips visibility but per-frame is
  authoritative; can remove the F-key flip if needed.
- **ABP foot IK**: only runs in walking/running states, not idle/
  crouch. Mid-state transitions on slopes may show a brief snap to
  flat reference — known cosmetic gap; deferred polish.
- **ABO + ABN footguns still apply** (see prior next-session-prompts
  + decisions.md).

## Verification protocol

```
npm run verify     # = tsc --noEmit
npx vite build     # production-build sanity
```

For substantial features:
1. Boot game, exercise the feature.
2. Save + reload roundtrip if persisted state changed.
3. Multi-seed sanity if the change touches world generation.

For ABP-specific playtest (do these first, before any new ABQ work):
- Boot game, press F to switch to 3P.
- Walk around a flat area — confirm walk cycle (knees flex, arms
  swing, hip sway).
- Walk onto a sloped dune — confirm feet plant on slope (FOOT IK).
- Walk into a wreck wall — camera should NOT clip through (Rapier
  collision).
- Rotate camera quickly — confirm smoothed follow (no snappy jerk).
- Pitch camera up + down — should clamp at ~45° up / 60° down (no
  flip-overhead).
- Equip an item (canteen, machete) — should see it in the rig's
  right hand from 3P + see it as FP viewmodel + see forearm wraps
  around the FP viewmodel item.
- Mount the speeder in 3P (currently camera will lerp across the
  teleport — that's the deferred snap wiring item).

## Begin block

Read CLAUDE.md (auto), session-end-report (through ABP), recent
changelog (ABP + ABO + ABN entries), decisions D110-D113. Pick
focus from the menu above. TaskCreate sub-tasks. Start coding.
