# Session ACI — Player-model arc, PM-Cycle A: proportion + silhouette

> The player model was honestly audited at the end of ACH and found **far from the
> Rey/real-human bar** — a rigid barrel/sandwich-board silhouette on stick-legs. The
> "Rig to Rey-tier" single cycle was re-planned into a **5-cycle arc**:
> **[docs/feature-player-model.md](feature-player-model.md)** (A proportion/silhouette →
> B head/face/scarf → C layered outfit → D cloth physics → E texture). This is **PM-Cycle A**,
> the foundation: get a correct slim-human silhouette before any garment/detail/texture work.

## Read these now (in order)

1. **CLAUDE.md** (auto-loaded) — rule 8 is LOAD-BEARING this whole arc.
2. **docs/feature-player-model.md** — THE plan. Esp. the **Model Verification Protocol (MVP-check)** + PM-Cycle A scope/pass-bar.
3. **docs/research/reference-tfa-jakku-opening.md** — the Rey target (shots 4/7/10 = outfit; palette table).
4. **docs/session-end-report.md** — cumulative state through ACH + the audit findings.
5. **docs/decisions.md** — recent tail; esp. **D134** (the `__game.enterGame` headless screenshot loop you'll lean on), D107 (zero-asset), D109 (localSpace), D115/D117/D118 (the rig stack).

## What's already built / the problem

The rig has Rey-ish *detail* (band wraps, fingerless glove, one-cloth scarf, belt/pouches,
backpack, boots) but the **silhouette is wrong**: torso is a wide rigid box with no waist taper,
head too small, neck too long + bare, legs spindly, poncho juts out front+back as a hard slab.
Detail is invisible under a wrong silhouette. **Fix the armature + garment resting-shape first.**

## PM-Cycle A focus — proportion + silhouette (the foundation)

Heavy visual-iteration. `tsc` is the type gate, NOT the quality gate. Use the MVP-check (6
canonical frames + critique vs real-human + Rey + the adversarial second look) EVERY round.
5–8 rounds for the rebuilt elements.

## Priority items (in order)

1. **`__game.rigStudio(angle?)` verification helper** (`debugPanel.ts` + `main.ts`) — FIRST. One
   call = `enterGame(true)` + `setSize(900,1100)` + `thirdPerson` + EVEN studio lighting
   (ambient ~2.2 + front key directional + exposure ~2.0 — the in-game dusk hid all detail in
   the ACH audit) + frame a canonical angle (front/back/left/3q/head). Makes every later round's
   verification one repeatable call. (DEV-gated; runtime lighting only.)
2. **Slim the torso** (`playerRig.ts` `TORSO_CHEST_R`/`TORSO_WAIST_R` + lathe profile) — real
   shoulder→waist taper; waist clearly narrower than chest. Kill the barrel. Acceptance: torso
   reads as a tapered human trunk, shoulders > waist.
3. **Poncho resting-shape rework** — from rigid wide box → narrower, body-following, gravity-draped
   static geometry: hangs DOWN (taller than wide), soft/broken hem (not a flat cut), open front V,
   slight asymmetry. (Full sim is PM-Cycle D — this is the correct *rest* shape.)
4. **Fix ratios** — head bigger (~1/7.5 body height), neck shorter, legs more volume
   (thigh/calf), feet → boot-shaped not flat slabs.
5. **Re-verify rig consumers** after touching core constants: 3P camera offsets, held-item
   attach, footstep cadence (these read rig dims).

## Stretch
- Posture: slight contrapposto / weight-shift for a less stiff stand.

## MVP-check verification (the quality gate — from feature-player-model.md)
Every round + cycle gate: capture **6 frames** (front/back/left/3q/head + waist focus) via
`rigStudio`, critique each vs **(a) real-human proportion** (~7–7.5 head-heights, shoulders>waist,
proportional limbs, short neck) **and (b) the Rey reference**, then the **adversarial second look**
("what still reads as barrel/board/mannequin?"). **PASS BAR**: at 3 m the full-body silhouette
reads as a slim draped human — no barrel, no slab-poncho, no bare long neck, no stick-legs.

## Autonomy contract
Ambiguous → GDD pillars + realism dial + the Rey reference, append a D-entry, continue. Surface
only on: procedural-vs-asset (D107), save bumps (D81), destructive git.

## Stop conditions
Wall-clock 2-4h. 3 fix-walls on one element → `/scope-cutter`. **Rule-8 self-check**: never mark
the silhouette done on tsc alone, or without the adversarial second look passing.

## Notable footguns
- **Touching `TORSO_*`/leg/neck constants ripples** to camera offsets, held-item attach, footstep
  cadence — re-verify those (item 5).
- **D107** procedural-only; **D109** localSpace on the moving rig.
- **Preview**: if `preview_screenshot` wedges mid-session, restart Claude Code / the preview MCP
  (it clears). State inspection via `ctx` keeps working. Pause AFTER a frame settles the rig
  (else joint world-pos is stale → camera aims at sky) — D134 footguns.

## Verification protocol
`npm run verify` (= tsc) = type gate. QUALITY gate = the MVP-check, 5–8 rounds.

## Begin block
1. Read CLAUDE.md, feature-player-model.md (MVP-check + Cycle A), the Rey reference, decisions (D134/D107/D109).
2. `npm run verify` baseline.
3. TaskCreate: rigStudio tool → torso taper → poncho rest-shape → ratios → re-verify consumers.
4. Build `rigStudio` first, then iterate the silhouette with the MVP-check each round.
