# Session ACH — Cycle 2: Rig to Rey-tier

> Phase 2 iteration plan: **[docs/iteration-plan.md](iteration-plan.md)**. Cycle 1
> (drag verification) shipped in ACG. This is **Cycle 2** — the highest-leverage
> cycle: it's the user's explicit visual bar AND the gate for Cycle 5 (raider
> proc-character), Cycle 7 (companion), and Cycle 9 (sleep anims). After it, run
> a playtest-driven priority refresh (per the plan's cadence).

## Read these now (in order)

1. **CLAUDE.md** (auto-loaded) — esp. rule 8 (iteration discipline) which is LOAD-BEARING this cycle.
2. **docs/session-end-report.md** — cumulative state through ACG.
3. **docs/backlog.md** — the `[feat/polish] Player model refinement — Rey-Jakku-outfit target` entry is the spec; also the 3P-on-speeder bug folds in here.
4. **docs/decisions.md** — recent tail only (D-entries through D133; D107/D109/D111-D118 are the rig stack). **Grep, don't slurp** — older entries are in `docs/decisions-archive.md`.
5. **docs/iteration-plan.md** — Cycle 2 scope + dependencies.
6. **docs/research/reference-tfa-jakku-opening.md** — the Rey reference target.

## What's already built (one paragraph)

The player rig (ABP→ABY, 10-session arc) reached "low-poly stylized 3P character"
quality — Lathe torso + tapered limbs (D115), cloth drape (D117), sub-pivot
rigging (D118), 7 mismatched-scavenger clothing layers, foot IK, over-shoulder
3P camera (D116), dual-mesh held items (D113), all within D107 zero-asset. The
silhouette is right (hood/poncho/bandolier/pauldron/bandana/wraps); the gap to
Rey-tier is **detail fidelity**.

## Session ACH — focus

**Push the rig to the Rey-Jakku bar.** This is a heavy VISUAL-ITERATION cycle —
`tsc` is the type gate, NOT the quality gate. Honor rule 8 / the iteration
discipline: build → screenshot → critique → iterate, **5-8 rounds per new
element, 3-5 for tuning**. Ship **1-2 fully-iterated elements**, not 5 shallow
ones (the ABP precedent). All work in `src/player/playerRig.ts` (+ `viewModelHands.ts`).

## Priority items (in order — pick 1-2 to FULLY iterate, don't shallow-ship all)

1. **Wraps with visible band spacing** — per-arm-segment geometry or per-vertex
   band displacement (Rey's are tightly bound with clear separation; ours read
   as smooth cloth). Reuses the D117 displacement technique. + glove
   finger-cutouts at knuckles. Acceptance: bands read as distinct at 3P distance.
2. **Unified headscarf** — merge hood + bandana into one naturalistic scarf that
   wraps the head + drapes the back-shoulder (Rey-style). Builds on D117 hood drape.
3. **Layered tunic + cinched belt + visible pouches** + tunic-edge variation +
   boot wraps. Acceptance: reads as layered, not a single shell.
4. **Visible backpack mesh** on the back. **SURFACE TO USER** before the
   sled-on-back stretch (carry the sled undeployed) — that's a design pass on
   sled deploy/undeploy state, not a pure rig edit.
5. **Clear residual rig debt**: 3P camera collision real-playtest (walk into
   wreck walls, rapid F-toggle, mid-3P speeder mount); foot-IK idle→walk slope
   snap; **3P-rig-broken-on-speeder bug (ACG playtest find — needs a seated
   stance pose)**.

## Stretch goals

- Skin/material weathering pass per part (face/hands sun damage) — the old ABX
  texture-pass items, if rig geometry lands early.

## Autonomy contract

Ambiguous → pick the option closest to GDD pillars + realism dial, append a
D-entry, keep going. Surface only on: procedural-vs-asset (D107 — stay
procedural), save-schema bumps (D81), destructive git, catastrophic block, OR
the sled-on-back design fork (item 4).

## Stop conditions

- Wall-clock 2-4h for focused; this cycle can run 1-2 sessions.
- 3 consecutive fix walls on one element → `/scope-cutter`.
- **Rule-8 self-check**: if you're about to mark an element done on `tsc` alone,
  or wrote >150 LOC of rig geometry without screenshotting — STOP and iterate.

## Notable footguns

- **D107 zero-asset** — no GLB/PBR; all procedural. **D109 localSpace** on moving
  bodies. **D117/D118** the cloth-drape + sub-pivot stack to build on.
- **Preview gotcha** (`dustfall_preview_gotchas`): pointer-lock handoff blocks
  clean headless framing. For rig screenshots, force a 3P pose via `__game.ctx`
  + eval and position the camera deliberately (the rig is best viewed paused-3P).
- This is THE canonical "never mark a visual tier done on tsc alone" cycle.

## Verification protocol

`npm run verify` (= tsc) is the type gate. The QUALITY gate is the iteration
discipline: screenshot every element against the Rey reference, 3-5+ rounds each.

## Begin block

1. Read CLAUDE.md (auto-loaded), session-end-report, backlog (Rey entry),
   decisions (grep D107/D109/D115-D118 + D133), iteration-plan Cycle 2, the Rey
   research doc.
2. Confirm `npm run verify` baseline passes.
3. TaskCreate covering the 1-2 elements you'll fully iterate this session.
4. Read `src/player/playerRig.ts`.
5. Begin — build → screenshot → critique → iterate per element.
