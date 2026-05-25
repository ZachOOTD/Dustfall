# Dustfall — Session-end report

Cumulative state. Rewritten end-to-end at each `/session-end`.

**Current state**: Session ABT shipped (2026-05-25, over-shoulder
camera + feet-on-ground bug fix + head Lathe geometry). 75 sessions
post-MVP. tsc clean. SAVE_VERSION v11 unchanged. **Fifth Dustfall
session under iteration discipline**. 2 files modified (`src/player/
controller.ts` + `src/player/playerRig.ts`). D116 added.

**ABT scope**: user post-ABS feedback flagged 3 issues — "model still
needs more polish", "camera in weird position way above the player,
should be closer behind over-the-shoulder like most 3p games",
"legs/feet are under the sand". 3 substantive fixes shipped (depth
over breadth — 2 more deferred to ABU).

- **P1 — Over-the-shoulder camera (D116, 1 round)**. Rewrote
  `syncCameraToBody` in `controller.ts`. Pre-ABT: 3.2m back + 1.8m
  above + no lateral offset (research-recommended in ABP but felt
  "way above player"). New: `_3P_BACK_DIST=1.8`, `_3P_ABOVE_DIST=
  0.30`, NEW `_3P_LATERAL_OFFSET=0.40` (over right shoulder), NEW
  `_3P_SHOULDER_DROP=0.25`. Camera targets `shoulderAnchor` =
  (playerPos + eyeOffset - shoulderDrop) + camRight × lateralOffset,
  not headPos. Spring-arm raycast collision rays now fire from
  shoulderAnchor. Reads as modern TLOU/GoW over-the-shoulder cam —
  player fills right side of frame, camera at shoulder height,
  tight 1.8m distance.

- **P2 — Feet on ground bug fix (1 round)**. `rig.group.position.y`
  was `tr.y - eyeOffset - 0.5` — `0.5` was a magic number that
  didn't match the actual capsule halfHeight + radius. Feet ended
  up under the sand. Replaced with `terrain.heightAt(tr.x, tr.z)`
  direct query so the rig plants AT terrain Y exactly. Foot IK
  helper still does per-foot variation on top. Verified visually —
  feet/toes clearly sit on sand surface.

- **P5 — Real head geometry (1 round)**. `SphereGeometry` scaled
  (1.0, 1.15, 0.95) + `BoxGeometry` flat plane for jaw → `LatheGeometry`
  from 11-point profile: crown cap → cranium top → cranium widest
  (temple) → brow ridge → cheek mid → cheek taper → jaw line → CHIN
  POINT → under-chin → cap bottom. 18 radial segments. DoubleSide
  per D115. Ears repositioned slightly forward + raised. Reads as
  real human skull silhouette with cheekbones + narrowing jaw +
  pointed chin.

**D-entry added**: D116 — Over-the-shoulder camera convention
(close behind + shoulder-anchor target + lateral offset). Templates
the constants + the shoulder-anchor pattern for future camera modes.
Friction-1.

**Deferred to ABU** (per discipline depth-over-breadth):
- More body model polish — shoulder-arm transition smoothness
  (visible gap where upper arm meets torso), neck Lathe cap blend
  (small visible lip), hand-wrist joint smoothness, finger knuckle
  inflections.
- Realistic cloth drape (subdivided poncho with per-vertex weight
  folds) — biggest remaining visual lift.
- Rig sub-pivots (wrist, ankle, spine bend + animation tick wiring).

**Cross-session quality arc**: ABP shipped baseline rig. ABQ iterated
under newly-encoded discipline. ABR verified motion + wired snap.
ABS pushed body geometry to Lathe profiles (torso + limbs + hands).
ABT fixed camera positioning + feet plant + head geometry. The
character + camera now reads at modern 3rd-person-game quality
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
| Tier 4 — Polish + breadth | QQ–ABT | ✓ ongoing | Sled, crafting rework, control overhaul, creature companion, long-storm countdown, procgen world, salvage tactile, procgen wreck system, fire grill multi-cook, narrative journals, texture-overhaul shader vocabulary, biome-specific POIs, sandworm feeding loop, comm-relay cluster, v11 schema, dropped-item physics, megaWreck rebuild, shader-crawl fix (D109), procedural rigged player (ABP), iteration discipline (ABP→ABQ), ABP+ABQ verification + snap wiring (ABR), Lathe body geometry (ABS — D115), over-shoulder camera + feet plant + head Lathe (ABT — D116) |

**Verify status**: `npm run verify` = `tsc --noEmit`. PASS.

---

## What works end-to-end (singleplayer flow)

[Previously-listed flows preserved, see ABS session-end-report]

**ABT delta to "what works"**:
- 16. **3P camera now reads as modern over-the-shoulder game cam**
  (TLOU/GoW style) — close behind + slight lateral offset over right
  shoulder + at shoulder height. Pre-ABT was distant/elevated.
- 17. **Feet plant on sand correctly** — was a long-standing
  positioning bug (rig used magic-number offset instead of terrain
  query). Now feet visibly sit on sand.
- 18. **Head reads as real skull silhouette** — Lathe profile with
  cranium + cheekbones + jaw + chin. Previously was scaled sphere
  + flat box jaw.

---

## What's freshly shipped (ABT delta)

- **`src/player/controller.ts`** (~+30/-10): Camera positioning
  rewrite for over-shoulder. New constants + new shoulderAnchor
  target + lateral offset + shoulder drop. Raycast collision rays
  now fire from shoulderAnchor.
- **`src/player/playerRig.ts`** (~+25/-15):
  - Head geometry: SphereGeometry + BoxGeometry jaw → LatheGeometry
    from 11-point profile. Ears repositioned.
  - Position: `tr.y - eyeOffset - 0.5` → `terrain.heightAt(tr.x, tr.z)`.
- **`docs/changelog.md`** ABT entry at top.
- **`CLAUDE.md`** Last-shipped block updated.
- **`docs/decisions.md`** D116 appended.
- **`docs/roadmap.md`** ABT row + ABU "Up next" rewritten.
- **`docs/backlog.md`** ABT followup entry added.
- **`docs/session-end-report.md`** — this file.
- **`docs/next-session-prompt.md`** ABU kickoff brief.

---

## ABO-ABS deltas (condensed)

- **ABS** (body geometry realism push): Lathe torso + tapered Lathe
  limbs + tapered cylinder fingers. D115.
- **ABR** (ABP+ABQ verification + snap wiring): 5 P-items, 2 code
  changes. cameraSnapNextFrame at mount/dismount/save-load.
- **ABQ** (ABP iterative polish under new discipline): poncho shawl
  + bandolier wrap + walk cycle D114 knee bug fix.
- **ABP** (3P + rig polish, long-overnight): rig overhaul + 7
  clothing layers + foot IK + 3P collision + held items dual-mesh.
  D111-D113.
- **ABO** (long-overnight 7-item bundle): A3 rigged player (ABP
  precursor) + scavenger camp + B3 ambush + B6 POC. D110.

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

- **ABT deferred items** (see backlog):
  - Cloth drape still single-segment cylinder
  - Rig sub-pivots not yet added (wrist/ankle/spine bend)
  - Body polish: shoulder-arm transition gap, neck Lathe cap lip,
    finger knuckle inflections
- **Per-item viewmodel readability at 3P distance** (ABR backlog)
- **3P camera collision real-playtest** — mechanically verified ABP +
  snap wiring landed ABR + camera positioning landed ABT, but live-
  walk-into-wall test still owed
- **Foot IK mid-state transition** — idle→walking on slope shows
  brief reset to flat. Cosmetic.

See `docs/backlog.md` for full open list.

---

## Constants worth tuning

| Constant | Session | Default | Notes |
|---|---|---|---|
| `_3P_BACK_DIST` / `_ABOVE_DIST` | ABT | 1.8m / 0.30m | Over-shoulder (was 3.2/1.8) — D116 |
| `_3P_LATERAL_OFFSET` | ABT | 0.40m | Right shoulder — D116 |
| `_3P_SHOULDER_DROP` | ABT | 0.25m | Below eye — D116 |
| `headProfile` | ABT | 11 points | Lathe profile for head (D115) |
| `torsoProfile` | ABS | 14 points | Lathe torso (D115) |
| `upperLegProfile` etc | ABS | 6-8 points | Lathe limbs (D115) |
| Lathe radial segments | ABS | 14-24 | per-mesh smoothness |
| Hand palm dim | ABS | 0.078x0.028x0.062 | hand proportions |
| `cameraSnapNextFrame` callsites | ABR | 3 | mount, dismount, save-load |
| Walk cycle knee bend formula | ABQ | `max(0, cos(legPhase))*0.65` | D114 |

---

## Suggested next session (1-3 directions in priority order)

1. **ABU — Realistic cloth drape + body polish + sub-pivots** (~2-4h).
   Highest remaining visual lift: subdivided poncho with weight folds.
   Plus shoulder-arm transition smoothing + sub-pivots if budget.
2. **A1 infinite chunk streaming** (~6-10h big-ticket).
3. **B1 generalized rope (re-scoped)** (~4-5h).

Top pick: ABU — cloth drape is the biggest remaining "real video game
quality" delta. Once cloth + sub-pivots land, the rig is at parity
with low-poly stylized 3rd-person-game character quality.

---

## Time spent

75 sessions shipped (A through ABT). Approx ~252-318h cumulative dev
time. ABT itself was ~35 minutes of active iteration + 15 minutes
docs. Discipline value: 3 user-flagged issues fixed in <1h vs the
old failure mode that would have shipped them rough + bounced.

---

## State at session end

- **Git status**: working tree dirty (this session-end's docs updates
  + the 2 source edits). Through `79a907a` pushed to origin.
- **Last commit**: `79a907a` (ABS session-end docs catch-up).
- **Last tag**: `session-ABS`. ABT will be tagged at commit time.
- **Ports bound**: none (preview stopped).
- **Save state**: localStorage v11. ABT made zero save-schema changes.

---

## Token spend this session (estimated)

ABT was a focused fix-3-issues session.

- Input: ~110-150K tokens (state-of-build docs + screenshot eval loops
  + cumulative system reminders)
- Output: ~20-30K tokens (file edits + this session-end rewrite)
- Cached input: substantial
- Cost (Opus 4.7 rates, very rough): $7-10 for ABT itself

Within normal range.

---

## Commit handoff

Print-hints mode. ABT ships 2 source changes (controller.ts +
playerRig.ts) + 6 doc updates. Single source commit + session-end
docs commit suggested.
