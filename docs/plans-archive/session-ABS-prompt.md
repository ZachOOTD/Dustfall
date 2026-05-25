# Session ABT — Kickoff Brief (post-ABS)

## Read these now (in order)

1. `CLAUDE.md` (auto-loaded; Last-shipped block summarises ABS)
2. `docs/session-end-report.md` — cumulative state through ABS
3. `docs/changelog.md` — ABS + ABR + ABQ + ABP entries at top
4. `docs/decisions.md` — D115 (LatheGeometry as canonical organic-
   body-shape primitive) is latest. D107 zero-asset still load-bearing.
5. `docs/roadmap.md` — Up next section rewritten for ABT
6. `docs/backlog.md` — ABS deferred items entry at top of section
7. `~/projects/gamedev-framework/shared-memory/iterative-polish-
   discipline.md` — THE discipline (5th session running)

## What's already built (post-ABS snapshot)

74 sessions. ABP shipped baseline rig (blocky-but-recognizable scavenger).
ABQ iterated 3 elements under newly-encoded discipline (poncho shawl,
bandolier wrap, walk cycle D114 fix). ABR verified motion + wired
camera-snap. ABS shipped Lathe-based body geometry (torso + 4 limbs +
hands → tapered organic shapes). The procedural rig has crossed
"recognizable human figure" threshold within D107 zero-asset.

## Session ABT focus

**Continue realism push per discipline**. ABS deferred 3 elements per
discipline (depth over breadth). ABT picks them up:

## Priority items (in order; pick 2-3)

### P1 — Real head geometry (LatheGeometry profile, 3-5 rounds, ~30-60min)
Currently scaled sphere + flat box jaw + tiny ear bumps. Replace with
LatheGeometry profile for cranium → cheekbones → jaw line. Hood covers
most so this is lower priority than body was, but still visible at
close range (especially with bandana revealing face area). Profile
should include: cap top → cranium widest → temple narrowing → cheek
bone outward → jaw narrow → chin → cap bottom. Probably 8-10 profile
points. 16-20 radial segments. DoubleSide per D115 (hood + bandana
may have gaps that show interior).

### P2 — Realistic cloth drape (3-5 rounds, ~1-2h)
Poncho currently single-segment CylinderGeometry. Subdivide to 8+
height segments × 24 radial. Apply per-vertex offsets at hem to fake
gravity-pulled folds (sine-wave-around-perimeter at hem level,
amplitude ~1-2cm). At shoulder anchor points (where the bandolier
crosses) add subtle inward pull. Static no-physics, but reads as
draped cloth not a uniform tube.

### P3 — Rig sub-pivots: wrist + ankle + spine bend (~1-2h, code-heavier)
Three new pivots in the rig hierarchy:
- `rig.wrists[2]` — child of each hand attach; enables hand orientation
  (e.g., when holding weapon, hand rotates to grip-up). For now just
  add the empty pivot + plumb through PlayerRig type.
- `rig.ankles[2]` — child of each foot; enables foot heel-toe roll
  at heel-strike (foot pitches forward when planting toe, back when
  lifting heel).
- `rig.spineBend` — child of body, parent of headGroup + shoulders.
  Allows subtle Z-axis sway during walk + slight forward bend during
  sprint. (Currently `body.rotation.x` does this whole-body; spine
  bend isolates head/shoulders.)
Wire animation tick in updatePlayerRig to use new pivots.

### P4 — ABS limb R2 refinements (~30min, optional)
Slightly bigger calf bulge, more pronounced bicep peak, smoother
shoulder-arm transition where upper arm meets torso. 1-2 quick tuning
rounds if budget remains.

### P5 — Test new Lathe rig from FP (~15min)
Boot in FP mode and verify nothing about the new Lathe limbs creates
visible artifacts when player is in first-person mode (the rig is
hidden but the FP viewmodel hands should still work; verify wraps +
held items look correct).

## Autonomy contract

When ambiguous, pick the option closest to the GDD pillars +
decisions.md realism dial (D45+, D49, D67, D86–D115), append a new
D-entry, keep going.

**Iteration discipline contract** (5th session running, load-bearing):
- `tsc clean` is NOT the success gate on visual/feel work
- Per substantive element: build → screenshot → critique → iterate
- 5-8 rounds for new visual, 3-5 for tuning, 1-2 for bug fix, 0 for
  pure data/perf/tool work
- Ship 1-2 fully-iterated tiers, NOT 4-5 shallow ones

Stop conditions: wall-clock limit, 3-strike fix wall, catastrophic
block, destructive-action attempt.

## Notable footguns

- **D115 LatheGeometry**: profiles MUST close at top + bottom (radius=0
  endpoints). Materials MUST be DoubleSide for parts that may be seen
  through cutouts (e.g., torso through poncho V). 14-24 radial segments
  for FP/close-3P; less for distant rigs.
- **D107 zero-asset**: ALL procedural; no GLB. If a polish item feels
  like "I need real animation assets", surface to user.
- **D114 walk cycle**: knee bend formula `max(0, cos(legPhase))`. Don't
  re-introduce the old sin-shift bug.
- **D113 dual-mesh items**: `swapEquippedMesh` handles BOTH FP + 3P
  rig-hand-attach. If touching item swap path, update both.
- **HMR triggers full reload** when playerRig.ts changes — preview
  state resets. Re-eval setup (started/thirdPerson/paused/dayTime/
  position) after each reload.
- **Lathe profile arrays**: use Vector2(radial, axial). Axial is RELATIVE
  to mesh center; if mesh.position.y = -LEN/2, profile axial spans
  -LEN/2 to +LEN/2. Profiles in playerRig.ts torsoProfile / upperLeg
  Profile / etc are the templates.

## Verification protocol

```
npm run verify     # = tsc --noEmit
```

For ABT iteration:
- Per element: screenshot before → screenshot after each round
- Critique in chat honestly
- Ship only when screenshot reads as intended goal

## Begin block

Read CLAUDE.md (auto). Read session-end-report (through ABS) +
changelog (ABS + ABR + ABQ + ABP entries) + decisions D115. Pick
priority items P1-P5. TaskCreate sub-tasks. Boot preview. Iterate.

**The iteration discipline IS still the contract.** 5 sessions
running. Don't slip.
