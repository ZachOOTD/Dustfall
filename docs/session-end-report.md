# Dustfall — Session-end report

Cumulative state. Rewritten end-to-end at each `/session-end`.

**Current state**: Session ABV shipped (2026-05-25, sub-pivot rigging
+ hood drape D117). 77 sessions post-MVP. tsc clean. SAVE_VERSION v11
unchanged. **Seventh Dustfall session under iteration discipline**.
D118 added. 1 file modified (`src/player/playerRig.ts`).

**ABV scope**: completed the rigging deliverable that was deferred 3
sessions running. 2 elements iterated:

- **P1 — Rig sub-pivots + animation (1 round)**. Added 3 new pivot
  Groups to `PlayerRig`: `wrists[2]` (between elbow + hand),
  `ankles[2]` (between knee + foot), `spineBend` (between body +
  upper-body children). Re-parented upper-body meshes (torso,
  headGroup, poncho, bandolier+pouches, pauldron, shoulders) onto
  spineBend; legs stay direct children of body so they aren't tilted
  by spine motion. Moved forward-lean from `body.rotation.x` to
  `spineBend.rotation.x`. Animation tick drives:
  - Ankle: ASYMMETRIC heel-toe roll — `cos > 0 ? × 0.30 : × 0.45`
    (toes UP at heel-strike, toes DOWN MORE at toe-off, push-off is
    more aggressive than landing per real gait).
  - Wrist: `-0.10 + swing × 0.15` (relaxed hang + opposite roll).
  - Spine sway: Z-axis `-sin(phase) × 0.05` (opposite hip lift).
  - Spine lean: X-axis 0.16 running / 0.05 walking.
  Verified at phase=π: left ankle -0.45 plantarflexed (toes down),
  right ankle +0.30 dorsiflexed (toes up). Idle pose preserved: feet
  flat, arms hang naturally with wrist-hang, spine lean visible.

- **P2 — Hood drape D117 cloth folds (1 round)**. Applied D117
  cloth-drape pattern to hood-back-cylinder. Subdivided 14×1 → 18×8.
  HOOD_FOLD_WAVES=4 (fewer than poncho 6 for smaller mesh),
  HOOD_AMP_HEM=1.2cm, HOOD_AMP_TOP=0.3cm (scaled). Pattern matches
  poncho across outfit.

**D-entry added**: D118 — Procedural rigging sub-pivot architecture.
Documents wrist/ankle/spineBend insertion pattern + animation drive
formulas + asymmetric ankle scaling. Pattern composes with any
humanoid procedural rig wanting animation parity with low-poly
stylized 3P games. Friction-2.

**Deferred to ABW** (minor polish wrap-up):
- Bandolier strap leather wear / cracks / stitching
- Walk-cycle to footstep cadence sync (ABR backlog)
- Per-item viewmodel readability at 3P (ABR backlog)
- 3P camera collision real-playtest (ABR backlog)
- Limb R2 refinements (calf bulge, bicep peak smoothing)

OR pivot to big-ticket: A1 infinite chunk streaming, B1 generalized
rope, B5 flagship NPC beats.

**Cross-session quality arc (7 sessions complete)**:
- ABP: baseline blocky procedural rig + 7 clothing layers
- ABQ: poncho barrel→shawl + walk cycle D114 knee bug fix
- ABR: motion verification + camera snap wiring
- ABS: Lathe torso + Lathe limbs + tapered cylinder fingers (D115)
- ABT: over-shoulder camera (D116) + feet plant + head Lathe
- ABU: cloth drape (D117) + body polish (deltoid bridge + knuckles)
- ABV: sub-pivot rigging (D118) + hood D117 drape

Procedural character is now at **low-poly stylized 3rd-person-game
character quality** within D107 zero-asset policy. Stack of D-entries
D107 (zero-asset) + D109 (skin localSpace) + D111 (asymmetric
clothing) + D113 (dual-mesh items) + D114 (knee bend) + D115 (Lathe
organic primitive) + D116 (over-shoulder cam) + D117 (cloth drape) +
D118 (sub-pivot rig) is the full procedural-character pipeline.

---

## Tier progress table

Dustfall opts out of the gamedev-framework v0.3.x tier-ladder structure.

| Era | Sessions | Status | What it proved |
|---|---|---|---|
| Tier 0 — Foundations | A–H | ✓ shipped | Browser runtime, Rapier, GameContext spine, procedural world |
| Tier 1 — Vertical slice | I–W | ✓ shipped | Inventory, crafting, interactions, opening scene, journal |
| Tier 2 — Target | X–CC | ✓ shipped | Audio architecture, atmosphere, speeder, animated title |
| Tier 3 — Expected | DD–PP | ✓ shipped | Sand worm boss, weapon variants, procgen POIs, biome rework |
| Tier 4 — Polish + breadth | QQ–ABV | ✓ ongoing | Tier 4 + ABP→ABV 7-session procedural-character quality arc (rig at low-poly stylized 3P quality, D107 zero-asset preserved, D115/D116/D117/D118 codifying the pipeline) |

**Verify status**: `npm run verify` = `tsc --noEmit`. PASS.

---

## What works end-to-end (singleplayer flow)

[Previously-listed flows preserved; see ABU session-end-report]

**ABV delta to "what works"**:
- 22. **Procedural rig has full sub-pivot hierarchy** — wrists,
  ankles, spineBend in addition to hip/knee/shoulder/elbow. Foot
  heel-toe rolls at heel-strike/toe-off. Spine sways during walk.
  Wrists hang naturally + roll subtly with arm swing.
- 23. **Hood drape has cloth folds matching the poncho** — D117
  pattern applied at head scale.

---

## What's freshly shipped (ABV delta)

- **`src/player/playerRig.ts`** (~+60/-20):
  - `PlayerRig` type extended with wrists[2], ankles[2], spineBend.
  - `buildRigVisual()` creates spineBend; re-parents upper-body
    meshes onto it. Inserts wristGroup between elbowGroup + handGroup.
    Inserts ankleGroup between kneeGroup + foot/toe meshes.
  - Hood drape: 14×1 → 18×8 + D117 cloth-fold offsets.
  - `updatePlayerRig` walking block: ankle/wrist/spine drives.
  - Crouch + idle blocks: explicit sub-pivot resets.
- **`docs/changelog.md`** ABV entry at top.
- **`CLAUDE.md`** Last-shipped block updated.
- **`docs/decisions.md`** D118 appended.
- **`docs/roadmap.md`** ABV row + ABW "Up next" rewritten.
- **`docs/backlog.md`** ABV followup entry added.
- **`docs/session-end-report.md`** — this file.
- **`docs/next-session-prompt.md`** ABW kickoff brief.

---

## ABO-ABU deltas (condensed)

- **ABU** (cloth drape + body polish): D117 cloth drape via subdivided
  geometry + per-vertex sin-wave radial offsets. Deltoid bridges +
  neck cap + finger knuckles.
- **ABT** (over-shoulder cam + feet + head Lathe): 3 user-flagged
  fixes. D116.
- **ABS** (body geometry realism push): Lathe torso + tapered Lathe
  limbs + tapered cylinder fingers. D115.
- **ABR** (ABP+ABQ verification + snap wiring).
- **ABQ** (ABP iterative polish under new discipline): D114 walk
  cycle knee bug fix.
- **ABP** (3P + rig polish, long-overnight): D111-D113.
- **ABO** (long-overnight 7-item bundle): A3 rigged player (ABP
  precursor). D110.

## Older sessions (condensed — see changelog for detail)

- **ABN**: bulk_hauler + megaWreck bow + 3 triage fixes (D109).
- **ABM**: B7 dropped-item physics; v11 schema.
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

- **Minor procedural-rig polish queued** (see backlog):
  - Bandolier strap leather wear
  - Limb R2 refinements (calf bulge, bicep smoothing)
- **Per-item viewmodel readability at 3P distance** (ABR backlog)
- **Walk-cycle to footstep cadence sync** (ABR backlog)
- **3P camera collision real-playtest** still owed
- **Foot IK mid-state transition** — idle→walking on slope shows
  brief reset to flat. Cosmetic.

See `docs/backlog.md` for full open list.

---

## Constants worth tuning

| Constant | Session | Default | Notes |
|---|---|---|---|
| Ankle plantar / dorsi | ABV | -0.45 / +0.30 | Asymmetric heel-toe — D118 |
| Wrist hang base | ABV | -0.10 + swing × 0.15 | D118 |
| Spine sway Z | ABV | -sin(phase) × 0.05 | D118 |
| Spine lean X (run/walk) | ABV | 0.16 / 0.05 | D118 |
| Hood D117 WAVES + amp | ABV | 4 / 1.2cm hem / 0.3cm top | Cloth drape on hood |
| Poncho D117 WAVES + amp | ABU | 6 / 4.5cm / 0.8cm | D117 |
| Poncho subdivision | ABU | 24 radial × 10 height | D117 |
| Deltoid bridge sphere | ABU | r=0.085 scaled (1, 0.75, 1) | Per shoulder |
| Finger knuckle sphere | ABU | r=0.011 at 1/3 + 2/3 | Per finger |
| `_3P_BACK_DIST` / `_ABOVE` | ABT | 1.8m / 0.30m | Over-shoulder — D116 |
| `headProfile` | ABT | 11 points | Lathe head (D115) |
| `torsoProfile` | ABU | 17 points | Lathe torso (D115) |
| Walk cycle knee bend | ABQ | `max(0, cos)*0.65` | D114 |

---

## Suggested next session (1-3 directions in priority order)

1. **ABW — Wrap up minor procedural-rig polish** OR **pivot to big-
   ticket** (~30min - 6h). User pick.
2. **A1 infinite chunk streaming** (~6-10h big-ticket).
3. **B1 generalized rope** (~4-5h).
4. **B5 flagship NPC beats** (~4-6h).

Top pick: ABW user-direction. Rigging arc is complete. If user wants
to keep polishing → minor items remain. If user wants new feature →
big-ticket A1/B1/B5 candidates.

---

## Time spent

77 sessions shipped (A through ABV). Approx ~255-322h cumulative dev
time. ABV itself was ~30 minutes active iteration + 15 minutes docs.

---

## State at session end

- **Git status**: working tree dirty (this session-end's docs updates
  + playerRig.ts edit). Through `9a69008` pushed to origin.
- **Last commit**: `9a69008` (ABU session-end docs catch-up).
- **Last tag**: `session-ABU`. ABV will be tagged at commit time.
- **Ports bound**: none (preview stopped).
- **Save state**: localStorage v11. ABV made zero save-schema changes.

---

## Token spend this session (estimated)

ABV was a focused 2-element iteration session.

- Input: ~100-130K tokens (state-of-build + iteration screenshots)
- Output: ~25-35K tokens (file edits + this session-end rewrite)
- Cached input: substantial
- Cost (Opus 4.7 rates, very rough): $7-10 for ABV itself

Within normal range.

---

## Commit handoff

Print-hints mode. ABV ships 1 source change (playerRig.ts) + 6 doc
updates. Single source commit + session-end docs commit suggested.
