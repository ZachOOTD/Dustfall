# Session ABS — Kickoff Brief (post-ABR)

## Read these now (in order)

1. `CLAUDE.md` (auto-loaded; Last-shipped block summarises ABR)
2. `docs/session-end-report.md` — cumulative state through ABR
3. `docs/changelog.md` — ABR + ABQ + ABP entries at top
4. `docs/decisions.md` — D114 (walk cycle knee bend) is latest;
   D107-D113 from ABP era still apply
5. `docs/roadmap.md` — Up next section rewritten for ABS
6. `docs/backlog.md` — new ABR entry for per-item viewmodel readability
7. `~/projects/gamedev-framework/shared-memory/iterative-polish-
   discipline.md` — THE discipline (now load-bearing for 3rd session
   running)

## What's already built (post-ABR snapshot)

73 sessions. ABP shipped the rig + 3P camera + held-items dual-mesh.
ABQ iterated under discipline (poncho shawl, bandolier wrap, walk cycle
D114 fix). ABR verified ABP+ABQ work + wired the 3P camera teleport
snap at mount + dismount + save-load. The rig + 3P + held-items stack
is now shipping-quality across the discipline gate. 2 files modified
in ABR (`speeder.ts` + `save.ts`). tsc clean. SAVE_VERSION v11
unchanged.

## Session ABS focus

**Continue polish per discipline OR pick up a big-ticket lift**. ABR
closed out the ABP+ABQ verification debt. The discipline rhythm is now
established (3 sessions running). ABS can either:
- Stay in polish mode: per-item viewmodel readability at 3P, footstep
  cadence sync, ABP Tier 5 cut items
- Pivot to big-ticket: A1 infinite chunk streaming, B1 generalized
  rope, B5 flagship NPC beats

User pick informs which.

## Priority items if polish-mode (~30-90min each, pick 3-4)

### P1 — Per-item viewmodel readability at 3P distance (~1h)
Held items work mechanically (ABR P3 verified dual-mesh swap). But
items can be small/dark at 3P distance — they blend with the rig
from a few meters away. Options:
- Add `thirdPersonScale?: number` field to ItemDef; apply 1.5x scale
  to the 3P hand-attach mesh only (FP viewmodel stays original size)
- Add `thirdPersonBrightnessBoost?: number` for matte/dark items
- Per-item review: canteen, machete, scrap_gun, scrap_bar, bandage,
  branch
- Per discipline: 2-3 rounds per item, screenshot 3P + critique

### P2 — Walk-cycle to footstep audio cadence sync (~1-2h)
Gait + footstep SFX fire on separate timers. Lock them: footstep
plays at heel-strike moments (legPhase=π/2 + 3π/2 = max forward
swing per leg). Hook into the walk cycle phase reaching those values.

### P3 — ABP Tier 5: aim twist-IK (~1-2h)
Rotate `rig.shoulders[1]` (right shoulder) toward camera direction
during aim. Triggers: charged weapon hold, gun crosshair on enemy,
LMB held with weapon. Reads as character physically aiming.

### P4 — ABP Tier 5: footstep dust at feet (~30min-1h)
Move dust emit point from player-center to foot mid-stance world
position via Tier 2's foot IK. Dust reads as kicking from FEET.

### P5 — Pauldron polish R2 (~30min)
ABR P5 marked baseline as shipping-quality but noted potential R2
items: slightly thicker plates, more visible chip/wear edges, slight
outward flare. Only if budget remains.

## Priority items if big-ticket-mode

### B1 — A1 infinite chunk streaming (~6-10h)
Last major architectural lift. Lazy 800m chunks load at boundaries;
free farthest; per-chunk seed derivation; GPU memory budget. Save
bump v11→v12. Heavy session.

### B2 — B1 generalized rope attachment (~4-5h)
Re-scoped from ABO/ABP cuts. RopeEndpoint union + Tether refactor +
RMB-on-item UX. Save migration.

### B3 — B5 flagship NPC beats (~4-6h)
Hostile raider holdouts + friendly hermits at hand-modeled flagships.
Composes existing raider AI + new dialogue/journal hooks.

## Autonomy contract

When ambiguous, pick the option closest to the GDD pillars +
decisions.md realism dial (D45+, D49, D67, D86–D114), append a new
D-entry, keep going.

**Iteration discipline contract** (load-bearing, 3rd session running):
- `tsc clean` is NOT the success gate on visual/feel work
- Per substantive element: build → screenshot → critique → iterate
- 5-8 rounds for new visual, 3-5 for tuning, 1-2 for bug fix, 0 for
  pure data/perf/tool work
- Real long-overnight ships 1-2 fully-iterated tiers
- Anti-pattern self-check flags from session-start Step 7

Stop conditions: wall-clock limit, 3-strike fix wall, catastrophic
block, destructive-action attempt.

## Notable footguns

- **D114 walk cycle**: knee bend formula peaks at MID-SWING. If
  touching gait, keep `max(0, cos(legPhase))` shape.
- **D113 dual-mesh items**: `swapEquippedMesh` handles BOTH FP + 3P
  rig-hand-attach. If touching item swap path, update both.
- **D112 Rapier raycast collision**: 3P camera uses `world.castRay`
  excluding player body. New static colliders auto-included; new
  dynamic-bodies-that-should-not-block need exclude filter.
- **D111 asymmetric pauldron**: scavenger silhouette signal. NPC
  variants with paired pauldrons = SOLDIER outfit, separate.
- **D107 zero-asset**: ALL procedural; no GLB. Surface to user if
  the work feels like it needs real animation assets.
- **HMR triggers full reload** when playerRig.ts changes — preview
  state resets. Re-eval setup (started/thirdPerson/paused/dayTime/
  position) after each reload.
- **Kinematic body**: input simulation via `c.input.keys['KeyW']`
  doesn't take effect (no pointer lock + player is kinematic). Use
  paused-pose application for animation iteration; for continuous-
  motion testing real playtest is needed.
- **ABR P3 NOTE**: held items can be small/dark at 3P. Per-item
  readability tuning is the deferred work — backlog entry exists.

## Verification protocol

```
npm run verify     # = tsc --noEmit
npx vite build     # production-build sanity (optional)
```

For ABS iteration (if polish-mode):
- Per element: screenshot before → screenshot after each round
- Critique in chat honestly
- Ship only when screenshot reads as intended goal

## Begin block

Read CLAUDE.md (auto). Read session-end-report (through ABR) +
changelog (ABR + ABQ + ABP entries) + decisions D114. Ask user (or
make reasonable call): polish-mode or big-ticket? TaskCreate sub-
tasks. Start.

**The iteration discipline IS still the contract.** 3 sessions
running. Don't slip.
