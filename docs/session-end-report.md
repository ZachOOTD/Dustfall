# Dustfall — Session-end report

Cumulative state. Rewritten end-to-end at each `/session-end`.

**Current state**: Session ABS shipped (2026-05-25, body geometry
realism push under iteration discipline). 74 sessions post-MVP. tsc
clean. SAVE_VERSION v11 unchanged. **Fourth Dustfall session under
iteration discipline**. Major procedural-rig quality threshold crossed.
1 file modified (`src/player/playerRig.ts`). D115 added.

**ABS scope**: user direction was "push toward real video game quality
model + rigging, not just blocky figures and cylinders but a real body
shape with accurate limbs and movements, and realistic modeled
clothing". Within D107 zero-asset policy, the path is LatheGeometry
profile curves replacing primitive boxes/cylinders. 3 elements fully
iterated:

- **P1 — Torso: organic Lathe profile (4 rounds)**. Replaced 4-piece
  composite (2 cylinders + 2 sphere caps = "cans stacked") with single
  LatheGeometry from 14-point hand-crafted profile (cap → neck →
  shoulders → pectoral swell → ribcage taper → waist narrow → upper
  hip → hip flare → crotch → cap). 24 radial segments. DoubleSide
  material so back-interior renders when seen through poncho V cut.
  R1 found open-top/bottom + interior-hole-through-poncho. R2 added
  radius=0 cap endpoints. R3 added DoubleSide. R4 refined contours
  (pectoral swell 1.18× vs 1.08×, sharper waist taper, more flared
  hip). Front view: real body silhouette through poncho. Back view:
  strong shoulder-waist-hip taper.

- **P2 — Limbs: tapered Lathe profiles (1 round)**. All 4 limb meshes
  (upper/lower leg × upper/lower arm) converted from uniform
  CylinderGeometry to tapered LatheGeometry. Upper leg: hip→quad
  peak→knee taper. Lower leg: knee→calf muscle peak→ankle. Upper
  arm: deltoid→bicep peak→elbow. Forearm: elbow→bulk→wrist. 14-16
  radial segs. DoubleSide. Reads as muscular silhouette vs uniform
  tubes.

- **P3 — Hands: tapered cylinder fingers (1 round)**. Palm: BoxGeometry
  0.07x0.06x0.04 → 0.078x0.028x0.062 (proper hand proportions) +
  added knuckle ridge box. 4 fingers: single boxes → tapered
  CylinderGeometry (8 segments, tip 0.0075 → base 0.010, variable
  lengths with middle longest). Thumb: same tapered cylinder, angled
  outward + forward. Reads as hands at FP/close-3P range.

**D-entry added**: D115 — LatheGeometry as canonical organic-body-
shape primitive within D107. Documents profile-array approach + cap
requirement + DoubleSide rule + 14-24 radial segments guidance.
Templates: torsoProfile, upperLegProfile, lowerLegProfile, upperArm
Profile, forearmProfile in playerRig.ts. Friction-2.

**Deferred to ABT per discipline** (3 elements; better as own focused
sessions vs shallow this session):
- P4 Real head geometry (sphere + flat jaw → Lathe with cranium/jaw)
- P5 Realistic cloth drape (subdivided poncho with weight folds)
- P6 Rig sub-pivots (wrist, ankle, spine bend + animation tick wiring)

**Cross-session quality arc**: ABP shipped baseline rig (blocky-but-
recognizable). ABQ iterated under newly-encoded discipline (poncho
shawl + bandolier wrap + walk cycle bug fix). ABR verified motion +
wired snap. ABS pushed body geometry into Lathe profiles. The
procedural rig has crossed from "blocky primitive scavenger figure"
to "recognizable human silhouette in scavenger outfit" — a real
quality threshold within D107.

---

## Tier progress table

Dustfall opts out of the gamedev-framework v0.3.x tier-ladder structure.

| Era | Sessions | Status | What it proved |
|---|---|---|---|
| Tier 0 — Foundations | A–H | ✓ shipped | Browser runtime, Rapier, GameContext spine, procedural world |
| Tier 1 — Vertical slice | I–W | ✓ shipped | Inventory, crafting, interactions, opening scene, journal |
| Tier 2 — Target | X–CC | ✓ shipped | Audio architecture, atmosphere, speeder, animated title |
| Tier 3 — Expected | DD–PP | ✓ shipped | Sand worm boss, weapon variants, procgen POIs, biome rework |
| Tier 4 — Polish + breadth | QQ–ABS | ✓ ongoing | Sled, crafting rework, control overhaul, creature companion, long-storm countdown, procgen world, salvage tactile, procgen wreck system, fire grill multi-cook, narrative journals, texture-overhaul shader vocabulary, biome-specific POIs, sandworm feeding loop, comm-relay cluster, v11 schema, dropped-item physics, megaWreck rebuild, shader-crawl fix (D109), procedural rigged player (ABP), iteration discipline encoded (ABP→ABQ), ABP+ABQ verification + snap wiring (ABR), Lathe-based body geometry (ABS — D115) |

**Verify status**: `npm run verify` = `tsc --noEmit`. PASS.

---

## What works end-to-end (singleplayer flow)

[Previously-listed flows preserved, see ABR session-end-report]

**ABS delta to "what works"**:
- 16. **Procedural rig now reads as a real human figure** — Lathe-
  based torso (organic chest swell + waist + hip flare), tapered
  Lathe limbs (muscle silhouettes for arms + legs), tapered cylinder
  fingers + proper palm proportions. Hood + bandana + bandolier +
  pauldron + poncho + forearm wraps all still readable; underlying
  body is no longer blocky.

---

## What's freshly shipped (ABS delta)

- **`src/player/playerRig.ts`** (1 file, 3 substantive iterations):
  - Torso: 4-piece composite → single 24-segment LatheGeometry from
    14-point profile (DoubleSide for poncho-V visibility).
  - Limbs: 4 cylinders → 4 tapered Lathes (14-16 radial segs).
  - Hands: palm box widened, knuckle ridge added, fingers + thumb
    became 8-segment tapered cylinders.
- **`docs/changelog.md`** ABS entry at top.
- **`CLAUDE.md`** Last-shipped block updated.
- **`docs/decisions.md`** D115 appended.
- **`docs/roadmap.md`** ABS row + ABT "Up next" rewritten.
- **`docs/backlog.md`** ABS deferred items entry.
- **`docs/session-end-report.md`** — this file.
- **`docs/next-session-prompt.md`** ABT kickoff brief.

---

## ABP-ABR deltas (condensed)

- **ABR** (ABP+ABQ verification pass + snap wiring): 5 P-items
  shipped, 2 needed code changes. Snap wiring at speeder mount/
  dismount + save-load (`ctx.player.cameraSnapNextFrame=true`).
  Walk cycle in motion verified at 3 phases. Held-items dual-mesh
  swap verified. FP forearm wraps positioning correct out of box.
  Pauldron baseline shipping-quality.
- **ABQ** (ABP iterative polish under new iteration discipline):
  3 elements fully iterated: poncho (barrel→shawl), bandolier
  (closed-loop wrap), walk cycle knee bend (D114 critical bug fix).
- **ABP** (3P + rig polish, long-overnight, stay-procedural):
  4 of 5 tiers shipped. Rig overhaul ~270 → ~470 LOC + 7 clothing
  layers + knee/elbow sub-pivots. Foot IK. 3P Rapier raycast
  collision + smoothed follow. Held items dual-mesh. D111-D113.

## Older sessions (condensed — see changelog for detail)

- **ABO**: long-overnight 7-item bundle; A3 rigged player (ABP precursor).
- **ABN**: bulk_hauler + megaWreck bow shell + 3 triage fixes (D109).
- **ABM**: B7 dropped-item rigid-body physics; v11 schema.
- **ABL**: megaWreck visual rebuild.
- **ABK**: biome POI family closed.
- **ABJ**: aggressive overnight 14-item bundle.
- **ABH**: texture overhaul (4 shader factories). D107.
- **ABG**: panel interior visibility BackSide fix.
- **ABF**: 5 flagship narrative journals.
- **ABA**: overnight 7-item bundle. D101-D104.
- **AAY**: visual overhaul. D97-D100.
- **AAR-AAV**: salvage stack.
- **AAA-AAQ**: polish + atmosphere arc.
- **QQ-ZZ**: control overhaul, RMB context verbs, larger tent, sled.
- **DD-PP**: sandworm boss, weapon variants, procgen POIs, biome rework.
- **A-CC-4**: foundations + atmosphere + speeder + animated title.

---

## Known issues / partials

- **ABS deferred items** (see backlog):
  - Head geometry still scaled sphere + flat box jaw (LatheGeometry
    treatment deferred)
  - Cloth drape still single-segment cylinder (subdivided + per-
    vertex folds deferred)
  - Rig sub-pivots (wrist, ankle, spine bend) not yet added
- **Per-item viewmodel readability at 3P distance** (ABR backlog):
  held items can be small/dark + blend with rig from a few meters.
- **3P camera collision real-playtest** — mechanically verified ABP +
  snap wiring landed ABR, but live-walk-into-wall test still owed.
- **Foot IK mid-state transition** — idle→walking on slope shows
  brief reset to flat. Cosmetic.
- **Sandworm at procgen-seeded position**; multi-worm population
  still backlog.

See `docs/backlog.md` for full open list.

---

## Constants worth tuning

| Constant | Session | Default | Notes |
|---|---|---|---|
| `torsoProfile` | ABS | 14 points | Lathe profile for torso (D115) |
| `upperLegProfile` etc | ABS | 6-8 points each | Lathe profiles for limbs (D115) |
| Lathe radial segments | ABS | 14-24 | per-mesh smoothness |
| Hand palm dim | ABS | 0.078x0.028x0.062 | proper hand proportions |
| Finger cylinder taper | ABS | 0.0075 tip → 0.010 base | 8 segs |
| `cameraSnapNextFrame` callsites | ABR | 3 | mount, dismount, save-load |
| Poncho top×waist×height | ABQ | 1.08 / 1.6 / 0.85× | Shawl proportions |
| Walk cycle knee bend formula | ABQ | `max(0, cos(legPhase))*0.65` | D114 |
| `_3P_BACK_DIST` / `_ABOVE_DIST` | ABP | 3.2m / 1.8m | 3P camera offsets |

---

## Suggested next session (1-3 directions in priority order)

1. **ABT — Realism push continuation per discipline** (~2-4h).
   Head Lathe + cloth drape subdivision + rig sub-pivots. The
   remaining queued items from ABS plan.
2. **A1 infinite chunk streaming** (~6-10h big-ticket).
3. **B1 generalized rope (re-scoped)** (~4-5h).

Top pick: ABT continued polish. Rig quality threshold crossed in ABS
but cloth + head + sub-pivots still owed to fully land "real video
game quality" claim.

---

## Time spent

74 sessions shipped (A through ABS). Approx ~250-315h cumulative dev
time. ABS itself was ~50 minutes of active iteration + 15 minutes
docs. Discipline value: 3 substantive geometry conversions shipped
in 50min vs the old failure mode that would have shipped all 6
items rough.

---

## State at session end

- **Git status**: working tree dirty (this session-end's docs updates
  + the playerRig.ts edit). Through `689a6e5` pushed to origin.
- **Last commit**: `689a6e5` (ABR session-end docs catch-up) — pre-ABS.
- **Last tag**: `session-ABR`. ABS will be tagged at commit time.
- **Ports bound**: none (preview stopped).
- **Save state**: localStorage v11. ABS made zero save-schema changes.

---

## Token spend this session (estimated)

ABS was a moderate iteration session — 3 substantive geometry
conversions + multiple screenshot/critique loops. Rough estimates:

- Input: ~130-170K tokens (state-of-build docs + screenshot eval loops
  + cumulative system reminders)
- Output: ~25-35K tokens (file edits + iteration deliberation +
  this session-end rewrite)
- Cached input: substantial
- Cost (Opus 4.7 rates, very rough): $8-12 for ABS itself

Within normal range.

---

## Commit handoff

Print-hints mode. ABS ships 1 source change (playerRig.ts) + 6 doc
updates. Single source commit + session-end docs commit suggested.
