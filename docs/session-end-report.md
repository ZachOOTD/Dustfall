# Dustfall — Session-end report

Cumulative state. Rewritten end-to-end at each `/session-end`. A
reviewer who's never seen the project should be able to read this +
`CLAUDE.md` + `docs/GDD.md` and understand where Dustfall is.

**Current state**: Session ABQ shipped (2026-05-25, ABP iterative polish
under the new iteration discipline). 72 sessions post-MVP. tsc clean.
SAVE_VERSION v11 unchanged (rig is purely visual; no schema changes).
3 elements fully iterated > 6 shallow per the discipline. **First
Dustfall session run under the iteration-polish discipline** baked
into the gamedev-framework after ABP playtest revealed shipped-but-
shallow visual work.

**ABQ scope**: 1 file modified (`src/player/playerRig.ts`); 3 substantive
iterations.

- **P3 — Poncho geometry (2 rounds)**: baseline was a barrel covering
  90% of the body — arms, legs, bandolier, pauldron all smothered.
  R1 shrunk to a shawl: top radius `TORSO_CHEST_R * 1.25 → 1.08`
  (arms hang OUTSIDE silhouette), hem flare `TORSO_WAIST_R * 2.0 →
  1.4`, height `TORSO_H * 1.4 → 0.85` (shoulder-to-upper-hip).
  R2: hem flare `1.4 → 1.6` for visible drape. Verified at 4 camera
  angles — all read as wrapped-scavenger. **Highest single-impact
  iteration of the session**: fixed the visual identity of the rig.

- **P4 — Bandolier wrap (1 round)**: pre-fix the strap was front-only
  (3 waypoints all +Z) → invisible from back, half the wrap missing.
  Converted to a 6-waypoint CLOSED Catmull-Rom loop over left
  shoulder + diagonal chest + right hip + around right flank +
  diagonal back + back of left shoulder closing the loop. TubeGeometry
  closed=true; strap radius 0.018→0.020. Back-half is hidden BY THE
  PONCHO at runtime (realistic — cross-body strap worn under cloth).

- **P6 — Walk cycle knee bend (CRITICAL BUG, 1 round, D114)**: pre-fix
  formula `max(0, sin(legPhase - π/3)) * 0.6` peaked knee bend at
  MID-STANCE (weight-bearing leg — wrong; should be straight).
  New formula `max(0, cos(legPhase)) * 0.65` peaks at legPhase=0/2π
  (mid-swing — foot in air recovering forward), zero across
  `[π/2, 3π/2]` (heel-strike + mid-stance + toe-off). Verified at
  phase=π/4 (left forward+bent + right back+straight) and mirror
  phase=5π/4 (right forward+bent + left back+straight). Amplitudes
  bumped: hipAmp 0.40→0.48 walking + 0.55→0.62 running; armAmp ratio
  0.85→0.95; hip sway 0.012→0.020m; body bob 0.035→0.045m walking +
  0.060→0.075m running.

**D-entries added**: D114 (walk cycle knee bend mid-swing-not-mid-
stance, friction-1 — exists primarily as a memo for the iteration
discipline; this is exactly the kind of bug `tsc clean` will never
catch but per-element screenshot critique catches in one round).

**Deferred to ABR (queued)**:
- Pauldron polish — was already reading well in ABP baseline; not
  touched in ABQ.
- Walk cycle in REAL motion (vs static-pose screenshots) — the math
  was fixed but in-motion may need amplitude/cadence tweaks.
- 3P camera collision in real playtest (vs paused-eval-harness).
- Held items in 3P verification (canteen / machete / scrap_gun /
  bandage all need actual swap test).
- FP viewmodel forearm-wraps positioning under actual hands.
- Walk-cycle-to-footstep-cadence sync.
- ABP Tier 5 cut items: aim twist-IK + footstep-dust-at-feet.

**Cross-session impact**: The iteration discipline encoding done at the
end of the prior ABP session (shared-memory/iterative-polish-
discipline.md + 3 SKILL.md updates) was carried into this session's
canon for the first time. ABQ proves the discipline works in practice:
3 rounds of poncho iteration + 1 of bandolier + 1 of walk cycle
shipped substantive fixes that would not have been caught by tsc.

---

## Tier progress table

Dustfall opts out of the gamedev-framework v0.3.x tier-ladder structure
(see `docs/roadmap.md` framework note). The project is post-MVP and
operates on a per-session "Big-ticket bucket + Polish" model.

| Era | Sessions | Status | What it proved |
|---|---|---|---|
| Tier 0 — Foundations | A–H | ✓ shipped | Browser runtime, Rapier, GameContext spine, procedural world |
| Tier 1 — Vertical slice | I–W | ✓ shipped | Inventory, crafting, interactions, opening scene, journal |
| Tier 2 — Target | X–CC | ✓ shipped | Audio architecture, atmosphere, speeder, animated title |
| Tier 3 — Expected | DD–PP | ✓ shipped | Sand worm boss, weapon variants, procgen POIs, biome rework |
| Tier 4 — Polish + breadth | QQ–ABQ | ✓ ongoing | Sled, crafting rework, control overhaul, creature companion, long-storm countdown, procgen world, salvage tactile pry+extract+conditions, procgen wreck system, fire grill multi-cook, narrative journals, texture-overhaul shader vocabulary, biome-specific POIs, sandworm bait-and-strike feeding loop, comm-relay cluster, v11 schema, dropped-item physics, megaWreck rebuild, shader-crawl fix for moving entities (D109), procedural rigged player (ABP) + iteration discipline encoded (ABP→ABQ pivot) |

**Verify status**: `npm run verify` = `tsc --noEmit`. Single check
(no tier breakdown). Currently PASS.

---

## What works end-to-end (singleplayer flow)

1. **Boot title**: animated 3D title scene (CC-3). NEW GAME / DEV MODE
   buttons; Advanced disclosure for seed entry (per-seed worlds via AAI).
2. **Opening cinematic**: player spawns ~4.5m in front of redesigned
   opening wreck. Companion (Rocky-inspired) deployed 3m camera-right.
3. **First interactions**: pickup E, journal E (per-kind content via
   ABF Journal.kind discriminator).
4. **Speeder**: parked ~12m from wreck entrance. Mountable via E.
5. **Survival loop**: thirst/heat/hunger/stamina/health decay. Canteen
   hold-LMB. Wells refill via E. Placeable kits — all LMB-click with
   ghost preview.
6. **Combat**: 5 weapons. R-key reload for scrap_gun. Lizards 1-shot;
   sand worm boss 12 hits.
7. **Sled mechanic**: rope + sled_kit. Inextensible rope constraint.
8. **Crafting**: combine-to-discover. 16 recipes. Categorization
   sub-headers. Recipe Book panel TAB-key.
9. **Salvage**: tactile pry+extract. Equip scrap_bar, hold E to pry,
   E-presses extract components.
10. **Cooking**: grill attachment raises per-fire cap to 4 parallel.
11. **Long Storm**: escalating storm day 0 → 6 plateau day 7+.
12. **POI narrative**: 5 lone-survivor journals at hand-modeled
    flagships.
13. **Procgen wrecks**: 5 wreck classes (corvette / gunship / freighter
    / science_vessel / bulk_hauler); class roulette 35/20/18/12/15.
14. **Biome POIs**: dune buried cockpit + salt corroded outpost +
    rocky subterranean entrance.
15. **megaWreck**: ABL aft hull-shell + ABN bow hull-shell read as
    one continuous silhouette family.
16. **Procedural rigged player + 3P camera** (ABP shipped + ABQ
    iterated): mismatched-scavenger silhouette with hood + poncho +
    bandolier + asymmetric pauldron + bandana + forearm wraps;
    knee/elbow sub-pivots; 3-phase walk cycle with correct knee bend
    timing (D114 — ABQ fix); FOOT IK to terrain; Rapier raycast
    camera collision + smoothed follow + pitch clamp; dual-mesh
    held items (FP viewmodel + 3P rig hand).
17. **Save / load**: single-slot localStorage. `SAVE_VERSION = 11`.

---

## What's freshly shipped (ABQ delta)

- **`src/player/playerRig.ts`** (1 file, 3 substantive iterations):
  - Poncho: ponchoR_top × 1.25→1.08, ponchoR_bot × 2.0→1.6,
    ponchoH × 1.4→0.85, position.y +0.08. Now reads as a shawl.
  - Bandolier: 3 waypoints → 6 waypoints with `closed: true`;
    TubeGeometry closed=true + 36 segs × 8 radial; strap radius
    0.018→0.020; pouch spacing recalc.
  - Walk cycle: knee bend formula `max(0, sin(legPhase-π/3)) * 0.6`
    → `max(0, cos(legPhase)) * 0.65` (D114). Amplitudes bumped.
- **`docs/changelog.md`** ABQ entry at top.
- **`CLAUDE.md`** Last-shipped block updated.
- **`docs/decisions.md`** D114 appended.
- **`docs/roadmap.md`** ABQ row added; "Up next" rewritten for ABR.
- **`docs/backlog.md`** 5 new entries (ABQ deferred items + ABP queued
  polish items pulled into explicit form).
- **`docs/session-end-report.md`** — this file.
- **`docs/next-session-prompt.md`** ABR kickoff brief.

---

## ABA-ABP deltas (condensed)

- **ABP** (3P + rig polish, long-overnight, stay-procedural): 4 of 5
  tiers shipped. 2 research docs (3p-cameras / scavenger-aesthetic).
  Rig overhaul ~270 → ~470 LOC + 7 clothing layers + knee/elbow
  sub-pivots. 3-phase walk + hip sway + run lean + head counter-bob
  + FOOT IK. 3P Rapier raycast collision + smoothed follow + pitch
  clamp + snap flag. Held items dual-mesh (FP viewmodel + 3P rig
  hand). FP forearm-wraps continuity. D111-D113.
- **ABO** (long-overnight 7-item bundle): C1 strip + C5 heat-shield +
  C4 dish framework+collision + C3 viewmodel pass + A3 rigged player
  + B3 sandworm ambush + B6 engineBlock POC. B1 generalized rope CUT.
  D110.
- **ABN** (post-compaction ~1.5h): bulk_hauler 5th procgen class +
  megaWreck bow shell + 3 triage bug fixes (companion stale-mount,
  shader-crawl on moving entities, viewmodel fabric breathing).
  D109.
- **ABM** (B7 dropped-item rigid-body physics): Pickup gains optional
  Rapier body; v11 additive droppedPickups field. B8 cut.
- **ABL** (megaWreck visual rebuild): procedural shader vocab + aft
  hull shell + rust bands + exposed ribs + torn fragments.
- **ABK-tail** (perf pass + bugfixes, 4 direct-paste commits): shaders/
  Rapier pre-warm at boot; PointLight pool 96→31; Lambert downgrade;
  shadow map 2048→1024 + 6-frame cadence.
- **ABK** (biome POI family closed): saltOutpost + rockyEntrance.
- **ABJ** (aggressive overnight 14-item bundle): v10→v11 (D108);
  biome-bias procgen recipes; wood/bone/glass shader factories;
  science_vessel wreck class; sandworm feeding loop; 5 viewmodel
  upgrades; comm-relay cluster; buriedCockpit (first biome POI).
- **ABI** (panel rim fix + 3 procgen panel relocations).
- **ABH** (texture overhaul): 4 procedural shader factories. D107.
- **ABG** (panel interior visibility BackSide fix — D105).
- **ABF** (5 flagship narrative journals — D106).
- **ABE** (5-item polish overnight).
- **ABD** (breach freq tune).
- **ABC** (procgen wreck expansion: 2 hullSegment + gunship class).
- **ABB** (visual audit: 3 migrated panel positions).
- **ABA** (overnight 7-item bundle: light-pool + panel migration +
  procgen wreck system). D101-D104.

## Older sessions (condensed, see changelog for detail)

- **AAY** (visual overhaul: tents + fabric shader + lantern + companion).
  D97-D100.
- **AAR-AAV**: salvage stack.
- **AAA-AAQ**: polish + atmosphere arc.
- **QQ-ZZ**: control overhaul, RMB context verbs, larger tent,
  crafting rework, opening wreck rebuild, sled, weapons.
- **DD-PP**: sandworm boss, weapon variants, procgen POIs, biome
  rework, terrain shader, procedural shader expansion.
- **A-CC-4**: foundations + atmosphere + speeder + animated title.

---

## Known issues / partials

- **ABP+ABQ items needing in-motion verification** (see backlog
  "[polish] ABQ deferred iteration items"):
  - Walk cycle in motion — math fixed in ABQ but in-motion may need
    amplitude tweaks once running tick-driven (vs eval-pose).
  - 3P camera collision in real playtest (walking into wreck walls,
    rapid F-toggle, mount/dismount).
  - Held items in 3P — verified mechanically; need swap test for
    canteen + machete + scrap_gun + bandage.
  - FP forearm wraps under actual hands.
- **3P camera teleport snap wiring** — ctx.player.cameraSnapNextFrame
  exists but isn't wired into mount/dismount/save-load callsites.
  Camera will lerp visibly across teleports (cosmetic glitch).
- **Pauldron polish** — was reading well in baseline, ABQ skipped per
  discipline (3 elements fully iterated > 6 shallow).
- **Foot IK mid-state transition** — idle→walking on slope shows brief
  reset to flat reference. Cosmetic, low-priority.
- **Sandworm at procgen-seeded position**; multi-worm population still
  backlog (needs schema bump).
- **Stale fire+cloth wreck POI** (ABN deferred triage): user reported
  but code-only inspection couldn't pinpoint which POI.
- **megaWreck catwalk panels 3 + 4** (~11.5m up) still require stairs.

See `docs/backlog.md` for full open list.

---

## Constants worth tuning

Recent (session-tagged):

| Constant | Session | Default | Notes |
|---|---|---|---|
| Poncho top×waist×height | ABQ | 1.08 / 1.6 / 0.85× | Shawl proportions (was 1.25/2.0/1.4 = barrel) |
| Bandolier strap radius | ABQ | 0.020 | Wrapped closed-loop TubeGeometry |
| Walk cycle hipAmp | ABQ | 0.48 walking / 0.62 running | bumped 0.40/0.55 |
| Walk cycle armAmp ratio | ABQ | 0.95 | bumped from 0.85 |
| Walk cycle hip sway | ABQ | 0.020m | bumped from 0.012m |
| Walk cycle body bob | ABQ | 0.045/0.075 | bumped from 0.035/0.060 |
| Walk cycle knee bend formula | ABQ | `max(0, cos(legPhase))*0.65` | D114 — was inverted |
| `_3P_BACK_DIST` / `_ABOVE_DIST` | ABP | 3.2m / 1.8m | 3P camera offsets |
| `_3P_PUSHBACK_BUFFER` | ABP | 0.3m | Rapier raycast collision pushback |
| Foot IK clamp | ABP | ±0.15m | per-hip Y adjustment max |
| Class roulette weights | ABN | 35/20/18/12/15 | 5-way procgen wreck class distribution |
| `PROCGEN_COMPOSITE_SHARE` | ABC | 0.50 | Composite vs legacy procgen wreck mix |

---

## Suggested next session (1-3 directions in priority order)

1. **ABR — continue ABP+ABQ polish under the discipline**: (~2-4h).
   In-motion verification + remaining queued items per the iteration
   discipline. Lock the rig + 3P + held items.
2. **A1 infinite chunk streaming** (~6-10h big-ticket). Last major
   architectural lift. Save bump v11→v12.
3. **B1 generalized rope (re-scoped from ABO/ABP cuts)** (~4-5h
   medium-big). RopeEndpoint union + Tether refactor + RMB-on-item UX.
4. **Migrate remaining 4 flagships to composite procgen** (~6-8h
   medium-big). If ABO B6 engineBlock POC reads well in playtest.

Top pick: ABR continued polish. The iteration discipline is now load-
bearing; running it through to "rig + 3P + held items all verified
in motion" before moving to A1/B1 is the right next move.

---

## Time spent

72 sessions shipped (A through ABQ). Approx ~248-313h cumulative dev
time across ~5 weeks calendar. ABQ itself was ~30 minutes of active
iteration + 15 minutes of session-end docs. The discipline value is
that those 30 minutes shipped 3 fixed elements that would have
otherwise required a full follow-up polish session each.

---

## State at session end

- **Git status**: working tree dirty (this session-end's docs updates).
  Branch: `master`. Through `6a52dfa` pushed to origin.
- **Last commit**: `6a52dfa` (ABP-polish R1-R4: iterative discipline
  encoded + hood overhaul + poncho color attempt) — pre-ABQ.
- **Last tag**: `session-end-ABO`. No tag for ABN/ABP/ABQ yet; user
  may run `git tag session-ABQ` if desired.
- **Ports bound**: none (preview stopped).
- **Save state**: localStorage v11. ABQ made zero save-schema changes.

---

## Token spend this session (estimated)

ABQ was a focused iteration session. Compacted summary + framework
catch-up reads + preview eval loop. Rough estimates:

- Input: ~120-160K tokens (compacted summary + multiple file reads
  + screenshot tool calls + system reminders)
- Output: ~25-35K tokens (file edits + iteration deliberation +
  this session-end rewrite)
- Cached input: substantial (CLAUDE.md, system reminders re-read)
- Cost (Opus 4.7 rates, very rough): $8-12 for ABQ itself

Within normal range. Did NOT burn ≥2× baseline.

---

## Commit handoff

Print-hints mode (Dustfall CLAUDE.md does not have `auto-commit: on`).
ABQ ships 1 source change + 6 doc updates. Single commit suggested.
Commands surfaced as the final step.
