# Dustfall — Session-end report

Cumulative state. Rewritten end-to-end at each `/session-end`. A
reviewer who's never seen the project should be able to read this +
`CLAUDE.md` + `docs/GDD.md` and understand where Dustfall is.

**Current state**: Session ABR shipped (2026-05-25, ABP+ABQ verification
pass + 3P camera teleport snap wiring). 73 sessions post-MVP. tsc
clean. SAVE_VERSION v11 unchanged. **Second session under the iteration-
polish discipline**, verification-focused rather than new-feature. 5
P-items shipped (P1-P5). 2 files modified (`speeder.ts` + `save.ts`).

**ABR scope**: verification of ABP+ABQ work + 3 callsite snap wiring.

- **P1 — Walk cycle in motion (verified, no code change)**. ABQ D114
  knee-bend fix verified at 3 phases: running π/4 (mid-stride bent
  knee + opposite arm + forward lean 0.16rad), running π/2 (heel-
  strike: both legs max-spread, both knees straight, max arm spread),
  walking π/4 (gentler — less lean/amplitude). All read correctly.

- **P2 — 3P camera teleport snap wiring (3 callsites)**. ABP shipped
  `ctx.player.cameraSnapNextFrame` flag but only set it at boot. ABR
  wires it at `speeder.ts` mount (player parked at y=-2000), `speeder
  .ts` dismount (setTranslation to right-side spawn), `save.ts` load
  (setTranslation to saved pos). Camera now snaps across teleports
  instead of lerping visibly across the world.

- **P3 — Held items in 3P swap verification (verified)**. Dual-mesh
  swap working: scrap_bar (5 BoxGeometry meshes) → branch (3 meshes
  incl CylinderGeometry). Attach group at correct world position on
  the rig's right hand. NOTE: held items can be small/dark at 3P
  distance — per-item viewmodel-readability polish deferred (backlog
  item).

- **P4 — FP viewmodel forearm wraps positioning (verified)**. Wraps
  sit at the base of held items reading as wrapping the wrist/forearm
  area, NOT floating. Continuity with 3P rig outfit cohesive. No
  tuning needed.

- **P5 — Pauldron polish R1 (verified baseline)**. 3-plate cascading
  stack reads as asymmetric scrap armor. More visible now after ABQ
  poncho shrink. No iteration changes needed this round.

**D-entries added**: none this session (no novel architectural calls).

**Discipline net result**: 5 items verified in ~45 minutes. 2 needed
code changes (snap wiring + held-items NOTE), 3 needed only screenshot
critique to certify shipping-quality. Compare to the old failure mode
(ABP) where all 5 would have shipped untested.

**Deferred to ABS (queued)**:
- Per-item viewmodel readability at 3P distance (new backlog entry —
  canteen/machete/scrap_gun/scrap_bar/bandage need 3P-context scale
  or brightness review)
- 3P camera collision in real moving-game playtest (vs ABR's paused-
  eval harness which can't simulate continuous motion on kinematic body)
- Walk-cycle-to-footstep-cadence sync
- ABP Tier 5 cut items (aim twist-IK + footstep-dust-at-feet)

---

## Tier progress table

Dustfall opts out of the gamedev-framework v0.3.x tier-ladder structure.

| Era | Sessions | Status | What it proved |
|---|---|---|---|
| Tier 0 — Foundations | A–H | ✓ shipped | Browser runtime, Rapier, GameContext spine, procedural world |
| Tier 1 — Vertical slice | I–W | ✓ shipped | Inventory, crafting, interactions, opening scene, journal |
| Tier 2 — Target | X–CC | ✓ shipped | Audio architecture, atmosphere, speeder, animated title |
| Tier 3 — Expected | DD–PP | ✓ shipped | Sand worm boss, weapon variants, procgen POIs, biome rework |
| Tier 4 — Polish + breadth | QQ–ABR | ✓ ongoing | Sled, crafting rework, control overhaul, creature companion, long-storm countdown, procgen world, salvage tactile pry+extract+conditions, procgen wreck system, fire grill multi-cook, narrative journals, texture-overhaul shader vocabulary, biome-specific POIs, sandworm bait-and-strike feeding loop, comm-relay cluster, v11 schema, dropped-item physics, megaWreck rebuild, shader-crawl fix for moving entities (D109), procedural rigged player (ABP), iteration discipline encoded (ABP→ABQ pivot), ABP+ABQ verification pass (ABR) |

**Verify status**: `npm run verify` = `tsc --noEmit`. PASS.

---

## What works end-to-end (singleplayer flow)

[All previously-listed flows preserved, see ABQ session-end-report]

**ABR delta to "what works"**:
- 16a. **Mount/dismount + save-load no longer lerps camera across the
  teleport** — `ctx.player.cameraSnapNextFrame=true` set at all 3
  callsites. Camera snaps instantly.

---

## What's freshly shipped (ABR delta)

- **`src/world/speeder.ts`** (+4/-0):
  - Mount block: `ctx.player.cameraSnapNextFrame = true;`
  - Dismount block: `ctx.player.cameraSnapNextFrame = true;`
- **`src/persistence/save.ts`** (+3/-0):
  - Load function: `ctx.player.cameraSnapNextFrame = true;` after
    setTranslation.
- **`docs/changelog.md`** ABR entry at top.
- **`CLAUDE.md`** Last-shipped block updated.
- **`docs/roadmap.md`** ABR row added; "Up next" rewritten for ABS.
- **`docs/backlog.md`** new entry for per-item viewmodel-readability
  at 3P distance.
- **`docs/session-end-report.md`** — this file.
- **`docs/next-session-prompt.md`** ABS kickoff brief.

---

## ABP-ABQ deltas (condensed)

- **ABQ** (ABP iterative polish under new iteration discipline): 3
  elements fully iterated: poncho (barrel→shawl), bandolier (closed
  loop wrap), walk cycle knee bend (D114 critical bug fix —
  `max(0, cos)` instead of `max(0, sin(legPhase-π/3))`). 1 file
  modified (playerRig.ts).
- **ABP** (3P + rig polish, long-overnight, stay-procedural): 4 of 5
  tiers shipped. 2 research docs. Rig overhaul ~270 → ~470 LOC + 7
  clothing layers + knee/elbow sub-pivots. 3-phase walk + hip sway
  + FOOT IK. 3P Rapier raycast collision + smoothed follow + pitch
  clamp + snap-on-teleport flag. Held items dual-mesh (FP viewmodel
  + 3P rig hand) + FP forearm-wraps continuity. D111-D113.

## Older sessions (condensed — see changelog for detail)

- **ABO**: long-overnight 7-item bundle; A3 rigged player (ABP precursor).
- **ABN**: bulk_hauler + megaWreck bow shell + 3 triage fixes (D109).
- **ABM**: B7 dropped-item rigid-body physics; v11 schema.
- **ABL**: megaWreck visual rebuild.
- **ABK**: biome POI family closed (salt outpost + rocky entrance).
- **ABJ**: aggressive overnight 14-item bundle.
- **ABH**: texture overhaul (4 shader factories). D107.
- **ABG**: panel interior visibility BackSide fix.
- **ABF**: 5 flagship narrative journals.
- **ABA**: overnight 7-item bundle (light-pool + panel migration +
  procgen wreck system).
- **AAY**: visual overhaul pass (tents + fabric shader + lantern +
  companion).
- **AAR-AAV**: salvage stack.
- **AAA-AAQ**: polish + atmosphere arc.
- **QQ-ZZ**: control overhaul, RMB context verbs, larger tent, sled.
- **DD-PP**: sandworm boss, weapon variants, procgen POIs, biome
  rework, terrain shader.
- **A-CC-4**: foundations + atmosphere + speeder + animated title.

---

## Known issues / partials

- **Per-item viewmodel readability at 3P distance** (new ABR backlog):
  held items work mechanically (dual-mesh swap verified) but small/dark
  items blend with rig from a few meters. Per-item scale or brightness
  tuning needed.
- **3P camera collision real-playtest** still deferred — mechanically
  verified in ABP, snap wiring landed in ABR, but live-walk-into-wall
  test needs continuous motion the kinematic body blocks via eval.
- **Foot IK mid-state transition** — idle→walking on slope shows brief
  reset to flat reference. Cosmetic, low-priority.
- **Sandworm at procgen-seeded position**; multi-worm population still
  backlog (needs schema bump).
- **Stale fire+cloth wreck POI** (ABN deferred triage): user reported.
- **megaWreck catwalk panels 3 + 4** (~11.5m up) still require stairs.

See `docs/backlog.md` for full open list.

---

## Constants worth tuning

| Constant | Session | Default | Notes |
|---|---|---|---|
| `cameraSnapNextFrame` callsites | ABR | 3 (mount, dismount, save-load) | Wired this session |
| Poncho top×waist×height | ABQ | 1.08 / 1.6 / 0.85× | Shawl proportions |
| Bandolier strap radius | ABQ | 0.020 | Wrapped closed-loop TubeGeometry |
| Walk cycle hipAmp | ABQ | 0.48 walking / 0.62 running | bumped 0.40/0.55 |
| Walk cycle knee bend formula | ABQ | `max(0, cos(legPhase))*0.65` | D114 |
| `_3P_BACK_DIST` / `_ABOVE_DIST` | ABP | 3.2m / 1.8m | 3P camera offsets |
| `_3P_PUSHBACK_BUFFER` | ABP | 0.3m | Rapier raycast collision pushback |
| Foot IK clamp | ABP | ±0.15m | per-hip Y adjustment max |

---

## Suggested next session (1-3 directions in priority order)

1. **ABS — continue polish per discipline** (~2-4h). Per-item viewmodel
   readability pass at 3P distance. Walk-cycle-to-footstep cadence
   sync. ABP Tier 5 cut items.
2. **A1 infinite chunk streaming** (~6-10h big-ticket). Last major
   architectural lift. Save bump v11→v12.
3. **B1 generalized rope (re-scoped from ABO/ABP cuts)** (~4-5h).

---

## Time spent

73 sessions shipped (A through ABR). Approx ~248-313h cumulative dev
time. ABR itself was ~45 minutes of active verification + 15 minutes
of session-end docs. Discipline value: 5 items verified in 45min;
those would have been queued for multi-session-polish without it.

---

## State at session end

- **Git status**: working tree dirty (this session-end's docs updates).
  Through `f4d9168` pushed to origin.
- **Last commit**: `f4d9168` (ABQ session-end docs catch-up) — pre-ABR.
- **Last tag**: `session-ABQ`. ABR will be tagged at commit time.
- **Ports bound**: none (preview stopped).
- **Save state**: localStorage v11. ABR made zero save-schema changes.

---

## Token spend this session (estimated)

ABR was a verification + light-edit session. Rough estimates:

- Input: ~80-110K tokens (state-of-build docs + screenshot eval loops)
- Output: ~15-25K tokens (file edits + verification deliberation +
  this session-end rewrite)
- Cached input: substantial
- Cost (Opus 4.7 rates, very rough): $5-8 for ABR itself

Within normal range. Did NOT burn ≥2× baseline.

---

## Commit handoff

Print-hints mode (Dustfall CLAUDE.md does not have `auto-commit: on`).
ABR ships 2 source changes (speeder.ts + save.ts) + 6 doc updates.
Single source commit + session-end docs commit suggested.
