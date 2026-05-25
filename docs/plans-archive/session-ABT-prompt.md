# Session ABU — Kickoff Brief (post-ABT)

## Read these now (in order)

1. `CLAUDE.md` (auto-loaded; Last-shipped summarises ABT)
2. `docs/session-end-report.md` — cumulative state through ABT
3. `docs/changelog.md` — ABT + ABS + ABR + ABQ + ABP entries at top
4. `docs/decisions.md` — D116 (over-shoulder camera) + D115 (Lathe
   organic primitive) + D107 (zero-asset) are load-bearing
5. `docs/roadmap.md` — Up next section rewritten for ABU
6. `docs/backlog.md` — ABT followup entry at top of section
7. `~/projects/gamedev-framework/shared-memory/iterative-polish-
   discipline.md` — THE discipline (6th session running)

## What's already built (post-ABT snapshot)

75 sessions. ABP shipped baseline rig. ABQ iterated under newly-encoded
discipline (poncho shawl, bandolier wrap, walk cycle D114 fix). ABR
verified motion + wired snap. ABS pushed body geometry to Lathe
profiles (torso + limbs + hands). **ABT fixed 3 user-flagged issues**:
over-shoulder camera (D116), feet on ground bug, head Lathe geometry.
The character + camera now reads at modern 3rd-person-game quality
within D107 zero-asset policy.

## Session ABU focus

**Continue realism push with cloth drape as the big-ticket lift**.
Remaining ABS+ABT-deferred items grouped:

## Priority items (in order; pick 2-3 per discipline)

### P1 — Realistic cloth drape (3-5 rounds, ~1-2h) — HIGHEST visual impact
Current poncho: single-segment `CylinderGeometry` tube. Subdivide
geometry to 8+ height segments × 24 radial = 192 vertices. Apply
per-vertex offsets:
- At hem level: sine-wave-around-perimeter (4-6 wavelengths), amplitude
  ~1-2cm — reads as gravity-pulled folds
- At shoulder anchor points (where bandolier crosses): subtle inward
  pull
- Optional: slight forward bias (cloth weight pulls forward)
Static no-physics, but reads as cloth not a uniform tube. Per
discipline: 3-5 build/screenshot/critique rounds.

### P2 — Rig sub-pivots: wrist + ankle + spine bend (~1-2h, code-heavier)
Three new pivots in the rig hierarchy:
- `rig.wrists[2]` — child of each hand attach; enables hand orientation
  (rotate to grip-up for weapon hold)
- `rig.ankles[2]` — child of each foot; enables foot heel-toe roll
  during heel-strike phase of walk cycle
- `rig.spineBend` — child of body, parent of headGroup + shoulders.
  Subtle Z-axis sway during walk + forward bend during sprint
Plumb through `PlayerRig` type. Wire animation tick in `updatePlayerRig`
to use them.

### P3 — Body model polish refinements (~30-60min)
ABT noted several visible gaps:
- Shoulder-arm transition: visible gap where upper arm meets torso.
  Add a small "deltoid bridge" geometry or slightly extend upper-arm
  top toward torso.
- Neck Lathe cap blend: small visible lip where torso top closes at
  neck. Add an intermediate profile point or smooth the neck join.
- Hand-wrist joint: forearm taper meets palm box abruptly. Smoother
  transition needed.
- Finger knuckle inflections: tapered cylinders are smooth but real
  fingers have visible knuckle bumps. Add small radial bulges at
  finger 1/3 and 2/3 marks.

### P4 — Walk cycle to footstep cadence sync (~1h)
Gait + footstep audio fire on separate timers. Lock them: footstep
SFX plays at heel-strike moments (legPhase=π/2 + 3π/2 per leg).

### P5 — Per-item viewmodel readability at 3P (~1h)
ABR backlog. Held items can be small/dark from 3P distance. Add
`thirdPersonScale?` or `thirdPersonBrightnessBoost?` field to ItemDef.

## Autonomy contract

When ambiguous, pick the option closest to the GDD pillars +
decisions.md realism dial (D45+, D49, D67, D86–D116), append a new
D-entry, keep going.

**Iteration discipline contract** (6th session running, load-bearing):
- `tsc clean` is NOT the success gate on visual/feel work
- Per substantive element: build → screenshot → critique → iterate
- 5-8 rounds for new visual, 3-5 for tuning, 1-2 for bug fix
- Ship 1-2 fully-iterated tiers, NOT 4-5 shallow ones

Stop conditions: wall-clock limit, 3-strike fix wall, catastrophic
block, destructive-action attempt.

## Notable footguns

- **D116 over-shoulder camera**: shoulderAnchor is the target, NOT
  playerHead. If touching camera math, preserve the anchor pattern.
- **D115 LatheGeometry**: profiles MUST close at top + bottom
  (radius=0). DoubleSide for parts seen through cutouts.
- **D114 walk cycle**: knee bend formula `max(0, cos(legPhase))`.
- **D113 dual-mesh items**: `swapEquippedMesh` handles BOTH FP + 3P.
- **D107 zero-asset**: ALL procedural; no GLB.
- **Feet plant fix (ABT P2)**: `rig.group.position.y = terrain.heightAt(
  tr.x, tr.z)`. Don't reintroduce the `tr.y - eyeOffset - 0.5` magic
  number — feet will go under sand.
- **HMR triggers full reload** when playerRig.ts or controller.ts
  changes. Re-eval setup (started/thirdPerson/paused/dayTime/position)
  after each reload.

## Verification protocol

```
npm run verify     # = tsc --noEmit
```

For ABU iteration:
- Per element: screenshot before → screenshot after each round
- Critique in chat honestly
- Ship only when screenshot reads as intended goal

## Begin block

Read CLAUDE.md (auto). Read session-end-report (through ABT) +
changelog (ABT + ABS + ABR + ABQ + ABP entries) + decisions D116.
Pick P1-P5 sub-tasks. Boot preview. Iterate.

**The iteration discipline IS still the contract.** 6 sessions
running. Don't slip.
