# Session ABV — Kickoff Brief (post-ABU)

## Read these now (in order)

1. `CLAUDE.md` (auto-loaded; Last-shipped summarises ABU)
2. `docs/session-end-report.md` — cumulative state through ABU
3. `docs/changelog.md` — ABU + ABT + ABS + ABR + ABQ + ABP at top
4. `docs/decisions.md` — D117 (procedural cloth drape) + D116 +
   D115 + D114 are recent + load-bearing
5. `docs/roadmap.md` — Up next rewritten for ABV
6. `docs/backlog.md` — ABU followup entry at top
7. `~/projects/gamedev-framework/shared-memory/iterative-polish-
   discipline.md` — THE discipline (7th session running)

## What's already built (post-ABU snapshot)

76 sessions. ABP shipped baseline rig. ABQ→ABU progressively iterated
under discipline: poncho shawl + walk-cycle bug fix (ABQ), camera +
feet plant + head Lathe (ABT), Lathe body geometry (ABS), cloth drape
+ body polish (ABU). The procedural character is now at low-poly
stylized 3rd-person-game quality within D107 zero-asset policy. The
remaining piece for full "real video game quality rigging" claim is
the sub-pivot work (wrist + ankle + spine bend + animation tick
wiring) — deferred 3 sessions running.

## Session ABV focus

**Land the deferred rig sub-pivots + finish any remaining polish**.
Sub-pivots are the last piece of the "rigging" claim. Plus apply
the D117 cloth-drape pattern to the hood-back-cylinder for matching
folds at the back of head.

## Priority items (in order; pick 2-3)

### P1 — Rig sub-pivots (1-2 rounds, ~1-2h) — HIGHEST PRIORITY
Three new pivots in the rig hierarchy:
- `rig.wrists[2]` — child of each elbowGroup before handGroup. Enables
  hand orientation (rotate to grip-up when holding weapon, hang down
  in relaxed pose). Plumb through `PlayerRig` type.
- `rig.ankles[2]` — child of each kneeGroup before foot. Enables foot
  heel-toe roll: pitch forward at toe-off, pitch back at heel-strike.
- `rig.spineBend` — child of body, parent of headGroup + shoulders.
  Subtle Z-axis sway during walk (~±2°) + forward bend during sprint
  (~5°). Isolate from current `body.rotation.x` (whole-body) so head
  + shoulders bend independently of legs.

Wire `updatePlayerRig` animation tick to drive them:
- Ankle pitch: peak at legPhase=π/2 (heel-strike) and 3π/2 (toe-off),
  zero at mid-swing.
- Spine bend Z: gentle sin(phase) × 0.04 sway during walk; X bend
  pinned during sprint.
- Wrist rotation: idle-state slight hang; in walking state, slight
  inward rotation as arm swings (natural shoulder-driven wrist).

### P2 — Hood drape D117 cloth folds (3 rounds, ~30-60min)
Apply the D117 cloth-drape pattern (subdivided geometry + per-vertex
sin-wave radial offsets) to the hood-back-cylinder. Currently the
hood drape is single-segment. Match the poncho's fold WAVES and
amplitude scaled to head size.

### P3 — Bandolier strap detail (2-3 rounds, ~30min)
Currently smooth TubeGeometry. Could add subtle leather wear/cracks
via slight per-vertex radial perturbation. Or add stitching detail
via small dark dots at intervals along the strap.

### P4 — Walk-cycle to footstep cadence sync (ABR backlog, ~1h)
Lock footstep SFX to walk cycle phase: trigger at legPhase=π/2 +
3π/2 (heel-strikes per leg).

### P5 — Per-item viewmodel readability at 3P (ABR backlog, ~1h)
`thirdPersonScale?` field on ItemDef for items that need 3P-context
scale boost.

## Autonomy contract

When ambiguous, pick the option closest to the GDD pillars +
decisions.md realism dial (D45+, D49, D67, D86–D117), append a new
D-entry, keep going.

**Iteration discipline contract** (7th session running, load-bearing):
- `tsc clean` is NOT the success gate on visual/feel work
- Per substantive element: build → screenshot → critique → iterate
- 5-8 rounds for new visual, 3-5 for tuning, 1-2 for bug fix
- Ship 1-2 fully-iterated tiers, NOT 4-5 shallow ones

Stop conditions: wall-clock limit, 3-strike fix wall, catastrophic
block, destructive-action attempt.

## Notable footguns

- **D117 cloth drape**: pattern is in P1 of playerRig.ts — walk
  position attribute, compute polar coords, apply sin-wave radial
  offset modulated by height, call `computeVertexNormals()` after.
  Copy from poncho when applying to hood drape.
- **D116 over-shoulder camera**: shoulderAnchor is the target.
- **D115 LatheGeometry**: profiles MUST close at top + bottom (r=0
  endpoints), DoubleSide for parts seen through cutouts.
- **D114 walk cycle**: knee formula `max(0, cos(legPhase))`.
- **D113 dual-mesh items**: `swapEquippedMesh` handles both FP + 3P.
- **D107 zero-asset**: ALL procedural; no GLB.
- **Feet plant (ABT P2)**: `rig.group.position.y = terrain.heightAt(
  tr.x, tr.z)`. Don't reintroduce the magic-number offset.
- **HMR triggers full reload** for playerRig.ts changes. Re-eval
  setup after each reload.
- **Sub-pivots in hierarchy**: order matters. wrist goes BETWEEN
  elbowGroup and handGroup (so elbow rotation moves wrist).
  spineBend goes between body and (headGroup + shoulders) — affects
  upper body only, not legs.

## Verification protocol

```
npm run verify     # = tsc --noEmit
```

For ABV iteration:
- Per element: screenshot before → screenshot after each round
- Critique in chat honestly
- For animated elements (sub-pivots): test at multiple phases
  (phase=0, π/2, π, 3π/2) to verify the cycle reads correctly

## Begin block

Read CLAUDE.md (auto). Read session-end-report (through ABU) +
changelog (ABU + ABT + ABS + ABR + ABQ + ABP) + decisions D117.
Pick P1-P5 sub-tasks. Boot preview. Iterate.

**The iteration discipline IS still the contract.** 7 sessions
running. Don't slip.
