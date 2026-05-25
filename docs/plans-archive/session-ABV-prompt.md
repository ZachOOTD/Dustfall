# Session ABW — Kickoff Brief (post-ABV)

## Read these now (in order)

1. `CLAUDE.md` (auto-loaded; ABV Last-shipped summarises the 7-session
   procedural-character quality arc)
2. `docs/session-end-report.md` — cumulative through ABV
3. `docs/changelog.md` — ABV + ABU + ABT + ABS at top
4. `docs/decisions.md` — D118 latest. D107+D109+D111+D113+D114+D115+
   D116+D117+D118 = the full procedural-character pipeline
5. `docs/roadmap.md` — Up next is **pivot point**
6. `docs/backlog.md` — ABV followup at top
7. `~/projects/gamedev-framework/shared-memory/iterative-polish-
   discipline.md` — discipline 8 sessions running

## What's already built (post-ABV snapshot)

77 sessions. **7-session procedural-character quality arc COMPLETE**:
- ABP: baseline blocky rig + 7 clothing layers (procedural primitives)
- ABQ: poncho shawl + walk cycle D114 knee bug fix
- ABR: motion verification + camera-snap wiring
- ABS: Lathe torso + Lathe limbs + tapered cylinder fingers (D115)
- ABT: over-shoulder camera (D116) + feet plant fix + head Lathe
- ABU: cloth drape (D117) + body polish (deltoid bridge + knuckles)
- **ABV: sub-pivot rigging (D118) + hood D117 drape**

Procedural character now at **low-poly stylized 3rd-person-game
character quality** within D107 zero-asset policy.

## Session ABW = PIVOT POINT

Two roads. User direction informs which.

### Road A — Wrap minor polish (~30min – 2h)
Bandolier strap leather wear / walk-to-footstep cadence sync / per-item
viewmodel readability at 3P / 3P camera collision real-playtest / limb
R2 refinements. Quick wins to close out the rigging arc fully.

### Road B — Pivot to big-ticket feature (~4-10h)
- **A1 infinite chunk streaming** — last major architectural lift.
  Lazy 800m chunks at boundaries; free farthest; per-chunk seed
  derivation; GPU memory budget. Save bump v11→v12.
- **B1 generalized rope attachment** — re-scoped from ABO/ABP cuts.
  RopeEndpoint union + Tether refactor + RMB-on-item UX.
- **B5 flagship NPC beats** — hostile raider holdouts + friendly
  hermits at hand-modeled flagships. Composes existing raider AI +
  new dialogue/journal hooks.

## Priority items if Road A (polish)

### A1 — Bandolier strap leather wear (~30min)
Currently smooth TubeGeometry. Walk position attribute, apply slight
radial perturbation (~1-2mm) at multiple wavelengths for cracks.
Optional: add stitching dots at intervals.

### A2 — Walk-cycle to footstep cadence sync (~1h)
Hook footstep SFX to legPhase=π/2 + 3π/2 (heel-strike per leg).

### A3 — Per-item viewmodel readability at 3P (~1h)
ItemDef `thirdPersonScale?` + `thirdPersonBrightnessBoost?` for
items that need 3P-context tuning.

### A4 — 3P camera collision real-playtest (~30min)
Walk into wreck walls, rapid F-toggle, mid-3P speeder mount. Verify
no clipping / no stuck-states.

### A5 — Limb R2 refinements (~30min)
Slightly bigger calf bulge, more pronounced bicep peak, smoother
shoulder-arm transition.

## Priority items if Road B (big-ticket)

Pick ONE big-ticket from B1/B2/B3. Plan it as a multi-priority list
with discipline iteration rounds per visual element.

## Autonomy contract

When ambiguous, pick the option closest to the GDD pillars +
decisions.md realism dial (D45+, D49, D67, D86–D118), append a new
D-entry, keep going.

**Iteration discipline contract** (8 sessions running):
- `tsc clean` is NOT the success gate on visual/feel work
- Per substantive element: build → screenshot → critique → iterate
- 5-8 rounds for new visual, 3-5 for tuning, 1-2 for bug fix
- Ship 1-2 fully-iterated tiers, NOT 4-5 shallow ones

Stop conditions: wall-clock limit, 3-strike fix wall, catastrophic
block, destructive-action attempt.

## Notable footguns

- **D118 sub-pivots**: hierarchy is `body → spineBend → headGroup /
  shoulders / torso / cloth`. Legs stay direct children of `body`.
  Wrists between elbow + hand. Ankles between knee + foot. If touching
  rig hierarchy, preserve this structure.
- **D117 cloth drape**: subdivided geometry + per-vertex sin-wave
  offsets in playerRig.ts P1 (poncho) and P2-ish hood section. Copy
  pattern for any new cloth surface.
- **D116 over-shoulder camera**: shoulderAnchor is the target.
- **D115 LatheGeometry**: profiles MUST close at top + bottom (r=0),
  DoubleSide for parts seen through cutouts.
- **D114 walk cycle**: knee formula `max(0, cos(legPhase))`.
- **D107 zero-asset**: ALL procedural; no GLB.
- **Feet plant**: `rig.group.position.y = terrain.heightAt(tr.x, tr.z)`.
- **HMR triggers full reload** for playerRig.ts changes.

## Verification protocol

```
npm run verify     # = tsc --noEmit
```

For ABW iteration (if Road A polish):
- Per element: screenshot before → screenshot after each round
- Critique honestly
- Ship only when screenshot reads as intended goal

## Begin block

Read CLAUDE.md (auto). Read session-end-report (through ABV) +
recent changelog + decisions D118. Ask user (or make reasonable call):
Road A polish wrap-up OR Road B big-ticket pivot? TaskCreate sub-tasks.
Start.

**The iteration discipline IS still the contract.** 8 sessions
running. Don't slip.
