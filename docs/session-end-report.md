# Dustfall — Session-end report

Cumulative state. Rewritten end-to-end at each `/session-end`.

**Current state**: Session ABZ shipped (2026-05-25, B1 generalized
rope Phase 1 — companion tether kind). 81 sessions post-MVP. tsc
clean. **SAVE_VERSION v12** (additive — pre-v12 saves load unchanged).
**Eleventh Dustfall session under iteration discipline**. 3 files
modified.

**ABZ scope (B1 Phase 1)**:
- SledTether union extended with `'companion'` kind
- updateSleds anchor resolution for companion (ctx.companion.pos +
  0.3y back-top), auto-detach if companion gone
- interaction.ts 'companion' case extended — rope-wielded + player-
  tethered-sled + LMB transfers tether
- SAVE_VERSION 11 → 12 additive
- Sled now drags behind companion when player ties rope across

Phase 1 delivers user-visible new capability + foundation for future
endpoint kinds. Full refactor (RopeEndpoint union, abstract
`Tether {a,b}`, RMB-rope-raycast UX, more endpoint kinds) queued
for ACA Track A or future B1 sessions.

**Prior state (ABY pre-ABZ)**: Session ABY shipped Road A polish
wrap-ups (footstep cadence sync + limb R2 + 3P viewmodel readability).

**ABX scope**: 4 elements iterated, all material/texture variation
within zero-asset:
- **P1 — Poncho dye stripes**: per-vertex color attribute on poncho
  geometry. 5 alternating tonal bands (warm-darker vs cool-lighter)
  bucketed by theta + wear gradient (+5% hem, -3% top). Cloned
  ponchoMat with `vertexColors=true`. Reads as hand-dyed cloth.
- **P2 — Skin tone weathering**: face skinMat accent `0x8a7048 →
  0x6e4a26` (sun-aged brown), sheen 0.5→0.22 (matte). NEW handSkinMat
  with grimy accent `0x4a3520` + larger calluses, applied to all
  hand parts. Face vs hands now visually distinct.
- **P3 — Pauldron weathering + rivets**: wearLevel 0.7→0.88 + 4
  rivet studs per plate (12 total small SphereGeometry corner studs).
- **P4 — Bandolier leather**: STRAP_COLOR 0x505050→0x4a3220 +
  strapMat factory switched metalMaterial → fabricMaterial+
  disableShimmer. Reads as worn brown leather.

**Cross-session arc COMPLETE**: 9 sessions of discipline-driven
iteration (ABP→ABX). Full procedural-character pipeline:
- Geometry: D115 Lathe body
- Cloth: D117 drape displacement
- Rigging: D118 sub-pivots + animation
- Camera: D116 over-shoulder
- Movement: D114 walk cycle
- Items: D113 dual-mesh
- Asymmetric clothing: D111
- Moving-entity shader: D109
- Zero-asset policy: D107

ABX patterns (per-vertex color, per-region material variation,
rivets-as-detail-decoration, leather-via-fabricMaterial) add
texture/material variation to the pipeline without new D-entry —
they're applications of existing decisions.

**ABW scope**: focused fix-the-bug session. User direction: "another
round of polish, screenshots from multiple angles, check for weird
or unrealistic — cape clipping through back. Texture pass deferred
to its own session."

- **P1 — Multi-angle audit (verification only)**. Captured rig from
  front, side, back, back-3/4 angles in 3P over-shoulder cam.
  Confirmed user-reported cape clipping. Verified prior-session
  polish (ABS Lathe body geometry, ABU deltoid bridges + finger
  knuckles + cloth folds, ABV sub-pivot rigging) all reading
  correctly across angles — no critical secondary issues surfaced.

- **P2 — Cape clipping fix (1 round)**. Root cause analysis:
  `ponchoR_top` was `TORSO_CHEST_R * 1.08 = 0.238m` but the ABS
  Lathe torso has a pectoral swell at `TORSO_CHEST_R * 1.18 =
  0.260m`. Chest geometry was wider than poncho — body poked
  through the cloth at the front V cut + back. Fix: `ponchoR_top ×
  1.08 → 1.32` (0.290m, 3cm clearance over pectoral swell). Hem
  flare `1.6 → 1.75` proportionally so the drape shape stays
  natural. Verified front, side, back: body fully contained inside
  poncho, cape silhouette reads as proper draped cloth.

**Deferred to ABX (per user direction)**: PLAYER MODEL TEXTURE PASS.
Apply existing procedural shader vocabulary to specific rig elements
for material variation + weathering detail. This is the natural next
step now that rigging + geometry + cloth + animation are all in
place. Shader vocab available: D107 (zero-asset) + ABH (metalMaterial
/ paintMaterial / skinMaterial) + ABJ (woodGrain / bone / glass) +
ABN (fabricMaterial disableShimmer) + ABU (D117 cloth-drape
displacement). Texture work composes ON TOP without breaking D107.

**Cross-session quality arc (8 sessions complete)**:
- ABP: baseline blocky procedural rig + 7 clothing layers
- ABQ: poncho barrel→shawl + walk cycle D114 knee bug fix
- ABR: motion verification + camera-snap wiring
- ABS: Lathe torso + Lathe limbs + tapered cylinder fingers (D115)
- ABT: over-shoulder camera (D116) + feet plant fix + head Lathe
- ABU: cloth drape (D117) + body polish (deltoid bridge + knuckles)
- ABV: sub-pivot rigging (D118) + hood D117 drape
- **ABW: cape clipping fix + multi-angle audit**

Procedural character + rigging + animation are NOW SOLID. ABX
(texture/material variation) closes out the visual side of the
character pipeline.

---

## Tier progress table

Dustfall opts out of the gamedev-framework v0.3.x tier-ladder structure.

| Era | Sessions | Status | What it proved |
|---|---|---|---|
| Tier 0 — Foundations | A–H | ✓ shipped | Browser runtime, Rapier, GameContext spine, procedural world |
| Tier 1 — Vertical slice | I–W | ✓ shipped | Inventory, crafting, interactions, opening scene, journal |
| Tier 2 — Target | X–CC | ✓ shipped | Audio architecture, atmosphere, speeder, animated title |
| Tier 3 — Expected | DD–PP | ✓ shipped | Sand worm boss, weapon variants, procgen POIs, biome rework |
| Tier 4 — Polish + breadth | QQ–ABW | ✓ ongoing | Plus ABP→ABW 8-session procedural-character quality arc (rig + cloth + animation + cape-fit all solid; D115/D116/D117/D118 codify the pipeline) |

**Verify status**: `npm run verify` = `tsc --noEmit`. PASS.

---

## What works end-to-end (singleplayer flow)

[Previously-listed flows preserved; see ABV session-end-report]

**ABW delta to "what works"**:
- 24. **Cape clips no longer break the silhouette** — poncho top
  radius now clears the pectoral swell at all angles. Body
  contained inside the cloth, no breakthrough.

---

## What's freshly shipped (ABW delta)

- **`src/player/playerRig.ts`** (~+5/-3): `ponchoR_top` factor
  1.08 → 1.32, hem flare 1.6 → 1.75. Single-bug-fix change.
- **`docs/changelog.md`** ABW entry at top.
- **`CLAUDE.md`** Last-shipped block updated.
- **`docs/roadmap.md`** ABW row + ABX "Up next" rewritten.
- **`docs/backlog.md`** ABW followup entry noting texture pass next.
- **`docs/session-end-report.md`** — this file.
- **`docs/next-session-prompt.md`** ABX kickoff brief.

---

## ABP-ABV deltas (condensed)

- **ABV** (sub-pivot rigging + hood D117): wrists + ankles +
  spineBend + animation drives. D118.
- **ABU** (cloth drape + body polish): D117 + deltoid bridges +
  knuckles.
- **ABT** (over-shoulder cam + feet + head Lathe): D116 + bug fix.
- **ABS** (body geometry): Lathe torso + Lathe limbs + tapered
  cylinder fingers. D115.
- **ABR** (verification + snap wiring): 3P teleport snap callsites.
- **ABQ** (iterative polish under new discipline): D114 knee fix.
- **ABP** (3P + rig polish, long-overnight): D111-D113.

## Older sessions (condensed — see changelog for detail)

- **ABO**: long-overnight 7-item bundle; A3 rigged player. D110.
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

- **Texture pass owed (ABX)** — character has solid silhouette +
  cloth + rigging but materials are still relatively uniform per
  ABS+ABU work. Texture session brings per-element variation.
- **Walk-cycle to footstep cadence sync** (ABR backlog)
- **Per-item viewmodel readability at 3P distance** (ABR backlog)
- **3P camera collision real-playtest** still owed
- **Foot IK mid-state transition** — idle→walking on slope shows
  brief reset to flat. Cosmetic.

See `docs/backlog.md` for full open list.

---

## Constants worth tuning

| Constant | Session | Default | Notes |
|---|---|---|---|
| `ponchoR_top` factor | ABW | × 1.32 | Was 1.08, expanded to clear pectoral |
| `ponchoR_bot` factor | ABW | × 1.75 | Was 1.6, proportional bump |
| Ankle plantar / dorsi | ABV | -0.45 / +0.30 | D118 |
| Wrist hang base | ABV | -0.10 + swing × 0.15 | D118 |
| Spine sway Z | ABV | -sin(phase) × 0.05 | D118 |
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

1. **ABX — Texture pass** (~2-4h, user's stated next focus). Apply
   procedural shader vocabulary to specific rig elements for
   material variation + weathering. Per-element iteration per
   discipline.
2. **A1 infinite chunk streaming** (~6-10h big-ticket).
3. **B1 generalized rope** (~4-5h).

Top pick: ABX — user explicitly requested texture pass as the next
focused session.

---

## Time spent

78 sessions shipped (A through ABW). Approx ~256-323h cumulative dev
time. ABW itself was ~15 minutes active iteration + 10 minutes docs
(focused single-bug fix session).

---

## State at session end

- **Git status**: working tree dirty (this session-end's docs updates
  + playerRig.ts edit). Through `141510a` pushed to origin.
- **Last commit**: `141510a` (ABV session-end docs catch-up).
- **Last tag**: `session-ABV`. ABW will be tagged at commit time.
- **Ports bound**: none (preview stopped).
- **Save state**: localStorage v11. ABW made zero save-schema changes.

---

## Token spend this session (estimated)

ABW was a focused fix-the-bug session.

- Input: ~80-100K tokens (mostly screenshot eval loops + audit)
- Output: ~15-20K tokens (focused fix + docs)
- Cached input: substantial
- Cost (Opus 4.7 rates, very rough): $5-7 for ABW itself

Within normal range.

---

## Commit handoff

Print-hints mode. ABW ships 1 source change (playerRig.ts) + 6 doc
updates. Single source commit + session-end docs commit suggested.
