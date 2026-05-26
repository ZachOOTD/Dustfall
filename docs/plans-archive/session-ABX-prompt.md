# Session ABY — Kickoff Brief (post-ABX)

## Read these now (in order)

1. `CLAUDE.md` (auto-loaded; ABX Last-shipped + 9-session arc summary)
2. `docs/session-end-report.md` — cumulative through ABX
3. `docs/changelog.md` — ABX + ABW + ABV + ABU at top
4. `docs/decisions.md` — D118 + D117 + D116 + D115 + D114 + D113
   + D111 + D109 + D107 = the procedural-character pipeline
5. `docs/roadmap.md` — Up next = ABY pivot point
6. `docs/backlog.md` — ABX followup at top
7. `~/projects/gamedev-framework/shared-memory/iterative-polish-
   discipline.md` — discipline 10 sessions running

## What's already built (post-ABX snapshot)

79 sessions. **9-session procedural-character pipeline COMPLETE**:
- ABP: baseline blocky rig + clothing layers
- ABQ: poncho shawl + walk cycle D114 knee bug fix
- ABR: motion verify + camera-snap wiring
- ABS: Lathe body geometry (D115)
- ABT: over-shoulder cam (D116) + feet plant + head Lathe
- ABU: cloth drape (D117) + body polish
- ABV: sub-pivot rigging (D118) + hood D117
- ABW: cape clip fix + multi-angle audit
- **ABX: texture pass (dye stripes + skin weathering + pauldron
  rivets + leather bandolier)**

Procedural character is now at low-poly stylized 3rd-person-game
quality + material variation, all within D107 zero-asset.

## Session ABY = PIVOT POINT

Three roads.

### Road A — Minor polish wrap-ups (~30min – 2h)
ABR backlog items still owed:
- Walk-cycle to footstep cadence sync
- Per-item viewmodel readability at 3P
- 3P camera collision real-playtest
- Limb R2 refinements (calf bulge, bicep peak smoothing)

### Road B — Big-ticket pivot (~4-10h+)
- **A1 infinite chunk streaming** — last major architectural lift.
  Lazy 800m chunks; per-chunk seed; GPU budget. Save bump v11→v12.
- **B1 generalized rope attachment** — re-scoped from ABO/ABP.
  RopeEndpoint union + Tether refactor + RMB-on-item UX.
- **B5 flagship NPC beats** — hostile raider holdouts + friendly
  hermits at hand-modeled flagships.

### Road C — New character pipeline application
The 9-session pipeline (D107+D109+D111+D113+D114+D115+D116+D117+D118)
can be applied to OTHER characters in Dustfall: raider variants,
the companion, lizards/sandworm could use the same Lathe+cloth+
sub-pivot approach. Could spin off a new NPC variant using the
procedural pipeline as a test.

## Autonomy contract

When ambiguous, pick the option closest to the GDD pillars +
decisions.md realism dial (D45+, D49, D67, D86–D118), append a new
D-entry, keep going.

**Iteration discipline contract** (10 sessions running):
- `tsc clean` is NOT the success gate on visual/feel work
- Per substantive element: build → screenshot → critique → iterate
- 5-8 rounds for new visual, 3-5 for tuning, 1-2 for bug fix
- Ship 1-2 fully-iterated tiers, NOT 4-5 shallow ones

Stop conditions: wall-clock limit, 3-strike fix wall, catastrophic
block, destructive-action attempt.

## Notable footguns

- **D107 zero-asset** is now battle-tested across 9 sessions —
  procedural shaders + Lathe + per-vertex displacement + per-vertex
  color + sub-pivot rigging all compose without breaking. Stay in.
- **D118 sub-pivots**: hierarchy is body → spineBend → upper-body.
  Legs stay on body.
- **D117 cloth drape**: subdivided geometry + per-vertex sin-wave
  offsets. Now used on poncho + hood drape.
- **D116 over-shoulder camera**: shoulderAnchor is the target.
- **D115 LatheGeometry**: profiles MUST close at top + bottom (r=0).
- **ABX vertex colors**: enabled via `vertexColors: true` on cloned
  ponchoMat only. Don't enable on shared fabric instances.
- **ABX skin variation**: skinMat = face only, handSkinMat = hands.
  Don't accidentally reuse skinMat on hands or hands will lose grime.
- **HMR full reload** on playerRig.ts changes.

## Verification protocol

```
npm run verify     # = tsc --noEmit
```

For ABY (Road A polish):
- Per element: screenshot before → screenshot after each round.

## Begin block

Read CLAUDE.md (auto). Read session-end-report (through ABX) +
recent changelog + decisions D118. Ask user or make reasonable call:
Road A polish / Road B big-ticket / Road C new character pipeline app?
TaskCreate sub-tasks. Start.

**The iteration discipline IS still the contract.** 10 sessions
running. Don't slip.
