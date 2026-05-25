# Dustfall — Session-end report

Cumulative state. Rewritten end-to-end at each `/session-end`.

**Current state**: Session ABU shipped (2026-05-25, realistic cloth
drape + body polish). 76 sessions post-MVP. tsc clean. SAVE_VERSION
v11 unchanged. **Sixth Dustfall session under iteration discipline**.
1 file modified (`src/player/playerRig.ts`). D117 added.

**ABU scope**: continued realism push. 2 elements iterated:

- **P1 — Realistic cloth drape (2 rounds, D117)**. Poncho
  `CylinderGeometry` subdivided 16×1 → 24×10 (240 verts). Walked
  position attribute, applied per-vertex sine-wave radial offsets
  modulated by height (deepest at hem, gentle at shoulder).
  `computeVertexNormals()` after displacement so lighting catches the
  ridge/valley shading. R1: WAVES=5, hem 2.2cm — too subtle. R2:
  WAVES=6, hem 4.5cm — clear vertical fold ridges + scalloped wavy
  hem. Poncho went from "plastic tube" to "wrapped fabric with drape
  folds".

- **P2 — Body polish refinements (1 round, 3 fixes)**. (a) Neck cap
  blend — added 3 intermediate points to torsoProfile so the Lathe
  rolls smoothly from cap (r=0) to neck-base (r=0.110). Eliminates
  visible lip. (b) Deltoid bridge spheres — new `SphereGeometry(0.085)`
  per shoulder, scaled (1.0, 0.75, 1.0), positioned at shoulderPivot.
  Bridges the arm-to-torso gap. (c) Finger knuckle bumps — 2 small
  `SphereGeometry(0.011)` per finger at 1/3 and 2/3 marks along finger
  forward direction. Reads as joint articulation.

**D-entry added**: D117 — Procedural cloth drape via subdivided
geometry + per-vertex sin-wave radial offsets. Documents the
displacement formula + amplitude attenuation pattern. Composes with
any cylindrical mesh that should read as cloth (robe, banner, flag,
sail, hood-drape). Friction-1.

**Deferred to ABV**:
- Rig sub-pivots (wrist + ankle + spine bend + animation tick
  wiring) — code-heavier than geometry iteration, merits own session.
  This is the remaining piece for "rigging" parity with low-poly
  stylized 3rd-person-game characters.
- Hood drape: apply D117 cloth-drape pattern to hood-back-cylinder
  for matching scalloped folds on the back of head.
- Bandolier strap detail: subtle leather wear/cracks/stitching.
- Walk-cycle to footstep cadence sync (ABR backlog).
- Per-item viewmodel readability at 3P (ABR backlog).

**Cross-session quality arc**: ABP shipped baseline rig (blocky-but-
recognizable). ABQ→ABT progressively iterated under discipline:
poncho shawl shape (Q), walk-cycle bug fix (Q), camera + feet plant +
head Lathe (T), Lathe body geometry (S). ABU added cloth folds +
shoulder bridge + knuckles. The procedural rig has gone from "blocky
scavenger figure" through "recognizable human" to "wrapped scavenger
with draped cloth at low-poly stylized 3rd-person-game quality"
within D107 zero-asset policy.

---

## Tier progress table

Dustfall opts out of the gamedev-framework v0.3.x tier-ladder structure.

| Era | Sessions | Status | What it proved |
|---|---|---|---|
| Tier 0 — Foundations | A–H | ✓ shipped | Browser runtime, Rapier, GameContext spine, procedural world |
| Tier 1 — Vertical slice | I–W | ✓ shipped | Inventory, crafting, interactions, opening scene, journal |
| Tier 2 — Target | X–CC | ✓ shipped | Audio architecture, atmosphere, speeder, animated title |
| Tier 3 — Expected | DD–PP | ✓ shipped | Sand worm boss, weapon variants, procgen POIs, biome rework |
| Tier 4 — Polish + breadth | QQ–ABU | ✓ ongoing | Sled, crafting rework, control overhaul, creature companion, long-storm countdown, procgen world, salvage tactile, procgen wreck system, fire grill multi-cook, narrative journals, texture-overhaul shader vocabulary, biome-specific POIs, sandworm feeding loop, comm-relay cluster, v11 schema, dropped-item physics, megaWreck rebuild, shader-crawl fix (D109), procedural rigged player (ABP), iteration discipline (ABP→ABQ), ABP+ABQ verification + snap wiring (ABR), Lathe body geometry (ABS — D115), over-shoulder camera + feet plant + head Lathe (ABT — D116), cloth drape + body polish (ABU — D117) |

**Verify status**: `npm run verify` = `tsc --noEmit`. PASS.

---

## What works end-to-end (singleplayer flow)

[Previously-listed flows preserved, see ABT session-end-report]

**ABU delta to "what works"**:
- 19. **Poncho reads as cloth, not a tube** — visible vertical fold
  ridges + scalloped wavy hem. Lighting catches the ridge highlights
  and valley shadows.
- 20. **Shoulders read as natural attachment** — deltoid bridge
  spheres eliminate the arm-cap-to-torso gap.
- 21. **Fingers have visible knuckle articulation** — small bumps
  at 1/3 and 2/3 marks make the tapered cylinder fingers read as
  jointed instead of smooth tubes.

---

## What's freshly shipped (ABU delta)

- **`src/player/playerRig.ts`** (1 file, 2 substantive iterations):
  - Poncho: 16×1 CylinderGeometry → 24×10 + per-vertex sin-wave
    fold offsets. ~30 LOC added for the displacement loop.
  - torsoProfile: 3 new intermediate points at the neck cap region.
  - Per shoulder: new deltoid bridge SphereGeometry.
  - Per finger: 2 new knuckle SphereGeometry bumps.
- **`docs/changelog.md`** ABU entry at top.
- **`CLAUDE.md`** Last-shipped block updated.
- **`docs/decisions.md`** D117 appended.
- **`docs/roadmap.md`** ABU row + ABV "Up next" rewritten.
- **`docs/backlog.md`** ABU followup entry added.
- **`docs/session-end-report.md`** — this file.
- **`docs/next-session-prompt.md`** ABV kickoff brief.

---

## ABP-ABT deltas (condensed)

- **ABT** (over-shoulder cam + feet + head Lathe): 3 user-flagged
  issues fixed. D116.
- **ABS** (body geometry realism push): Lathe torso + tapered Lathe
  limbs + tapered cylinder fingers. D115.
- **ABR** (ABP+ABQ verification + snap wiring): 5 P-items, 2 code
  changes. cameraSnapNextFrame at mount/dismount/save-load.
- **ABQ** (ABP iterative polish under new discipline): poncho shawl
  + bandolier wrap + walk cycle D114 knee bug fix.
- **ABP** (3P + rig polish, long-overnight): rig overhaul + 7
  clothing layers + foot IK + 3P collision + held items dual-mesh.
  D111-D113.

## Older sessions (condensed — see changelog for detail)

- **ABO**: long-overnight 7-item bundle; A3 rigged player (ABP precursor).
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

- **ABU deferred items** (see backlog):
  - Rig sub-pivots not yet added (wrist/ankle/spine bend + animation
    tick wiring) — code-heavier deferred 3 sessions
  - Hood drape still single-segment cylinder (D117 pattern applicable)
  - Bandolier strap could use detail (leather wear)
- **Per-item viewmodel readability at 3P distance** (ABR backlog)
- **Walk-cycle to footstep cadence sync** (ABR backlog)
- **3P camera collision real-playtest** — mechanically verified ABP +
  snap wiring landed ABR + positioning landed ABT, still owes a
  live-walk-into-wall test
- **Foot IK mid-state transition** — idle→walking on slope shows
  brief reset to flat. Cosmetic.

See `docs/backlog.md` for full open list.

---

## Constants worth tuning

| Constant | Session | Default | Notes |
|---|---|---|---|
| Poncho fold WAVES + amp | ABU | 6 / 4.5cm hem / 0.8cm top | Cloth drape — D117 |
| Poncho subdivision | ABU | 24 radial × 10 height | Cloth drape — D117 |
| Deltoid bridge sphere | ABU | r=0.085 scaled (1.0, 0.75, 1.0) | Per shoulder |
| Finger knuckle sphere | ABU | r=0.011 at finger 1/3 + 2/3 | Per finger |
| `_3P_BACK_DIST` / `_ABOVE_DIST` | ABT | 1.8m / 0.30m | Over-shoulder — D116 |
| `_3P_LATERAL_OFFSET` | ABT | 0.40m | Right shoulder — D116 |
| `_3P_SHOULDER_DROP` | ABT | 0.25m | Below eye — D116 |
| `headProfile` | ABT | 11 points | Lathe profile for head (D115) |
| `torsoProfile` | ABU | 17 points | (3 new ABU neck-cap intermediate) — D115 |
| `upperLegProfile` etc | ABS | 6-8 points | Lathe limbs (D115) |
| Walk cycle knee bend formula | ABQ | `max(0, cos(legPhase))*0.65` | D114 |

---

## Suggested next session (1-3 directions in priority order)

1. **ABV — Rig sub-pivots + remaining polish** (~2-4h). Wrist +
   ankle + spine bend hierarchy + animation tick wiring. Plus hood
   drape D117 treatment. Closes out the "rigging" deliverable that's
   been deferred 3 sessions running.
2. **A1 infinite chunk streaming** (~6-10h big-ticket).
3. **B1 generalized rope (re-scoped)** (~4-5h).

Top pick: ABV — sub-pivots are now the only remaining piece of the
"real video game quality rigging" claim. Land them and the procedural
character is at full parity.

---

## Time spent

76 sessions shipped (A through ABU). Approx ~253-320h cumulative dev
time. ABU itself was ~30 minutes of active iteration + 15 minutes
docs. Discipline value: 2 substantive elements shipped vs old failure
mode that would have shipped 5 shallow ones.

---

## State at session end

- **Git status**: working tree dirty (this session-end's docs updates
  + playerRig.ts edit). Through `d9ca963` pushed to origin.
- **Last commit**: `d9ca963` (ABT session-end docs catch-up).
- **Last tag**: `session-ABT`. ABU will be tagged at commit time.
- **Ports bound**: none (preview stopped).
- **Save state**: localStorage v11. ABU made zero save-schema changes.

---

## Token spend this session (estimated)

ABU was a focused two-element iteration session.

- Input: ~100-140K tokens (state-of-build docs + screenshot eval loops
  + cumulative system reminders)
- Output: ~20-30K tokens (file edits + this session-end rewrite)
- Cached input: substantial
- Cost (Opus 4.7 rates, very rough): $7-10 for ABU itself

Within normal range.

---

## Commit handoff

Print-hints mode. ABU ships 1 source change (playerRig.ts) + 6 doc
updates. Single source commit + session-end docs commit suggested.
