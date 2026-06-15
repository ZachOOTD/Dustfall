# Session ACAR — Kickoff Brief

## Read these now (in order)
1. `CLAUDE.md` (auto-loaded) — "Where we are now" (ACAQ: wreck-yard biome / Cycle 8 shipped).
2. `docs/session-end-report.md` — cumulative state (ACAQ at top).
3. `docs/backlog.md` + `docs/decisions.md` (D201 distance-override-biome; D202 KCC-external-pull; D203 group.attach-merge).
4. `docs/roadmap.md` + `docs/architecture.md`.

## What's already built
The wreck arc + the **wreck-yard biome (Cycle 8)** are shipped: a rare distance-override destination (`biomes.wreckYardAnchor`,
620-1000m out) with a dense crashed-fleet graveyard (`wreckYard.ts`), `relic_core` exclusive glowing loot, an animated
Sarlacc-pit hazard (`sarlaccPit.ts` — gapes/pulls/bites), vulture ecology, and a yard-level perf merge. Verifiable via the
`wreck-yard` framer (`--angle=aerial|approach|ground|pit`) + `sarlacc-test`. tsc clean, no save bump (SAVE_VERSION 14).

## Session ACAR focus — the owed WALK-TESTS (human) + the flagged perf/polish follow-ups
This is an **ATTENDED** session: its top items need a human in `npm run dev` (feel + interaction), and the perf
refactors are interaction-preserving. The autonomous biome build is done; what's left needs your eyes or careful edits.

## Priority items (in order)
1. **Wreck-yard + Sarlacc-pit WALK-TESTS (needs YOU) — now SEPARATE locations (ACAR).** `npm run dev`:
   - **The pit** (`__game.ctx.biomes.sarlaccPitAnchor` — its own DUNE-desert spot, ~420-950m out): judge the **PULL feel**
     (escapable but scary? — D202; `tuning.ts` `SARLACC_PIT_PULL_ACCEL`/`_RADIUS`/`_DANGER` are a first pass), the damage
     cadence, does the maw open/close read as you approach/leave, does it sit nicely in its sand bowl. Tune to taste.
   - **The graveyard** (`__game.ctx.biomes.wreckYardAnchor` — separate, ~620-1000m out): relic findability + full-restore
     value, whether the ashen ground + dense wreck silhouette + circling vultures read ominous on approach.
2. **Mega-wreck interior WALK-TEST (owed since ACAL).** The other human-owed check: collision holds / fracture-ramp
   entrance walks / panels reachable / interior brightness.
3. **Wreck-yard perf follow-up (D203).** Route the sand mounds + debris + ribcages into the yard merge: add a `parent?:
   THREE.Object3D` opt to `placeProcgenComposite`/`placeDebrisField`/`placeRibcage` (add to `parent ?? scene`) so
   `placeWreckYard` puts them in `yardGroup` before `mergeStaticByMaterial` → ~200 more draw calls saved. `wreckYard.ts`.
4. **The ACAP-flagged perf (attended):** speeder static-merge (tag its animated parts `noMerge` first) + pickup
   InstancedMesh (interaction-raycast rework). Measure via `perf-probe`.
5. **Wreck-yard polish:** the muddy-bare ground color (`BIOME_COLOR_WRECK_YARD`); register the big hand-wrecks' panels
   for more graveyard loot; a 2nd maw-iteration pass if the walk-test flags it.

## Stretch goals
- W2 flagship greebles / W5 dusk-lit procgen pass (deferred from ACAP).
- The next Phase-2 cycle (iteration-plan.md): Cycle 5 raider proc-character, or Cycle 7 deep cave.

## Verification protocol
`npm run verify` (= `tsc --noEmit`) clean. **Wreck-yard visual:** the `wreck-yard` framer (now reports draw calls) +
`sarlacc-test` (open/pull/bite wiring). **Items 1-2 are feel/interaction-critical** → verify in `npm run dev` (the framer
can't judge feel). **Perf:** `perf-probe` + the `wreck-yard --angle=ground` draw-call read. Rule 8: screenshot-iterate
any visual change.

## Autonomy contract
Items 1-2 need a human throughout. Item 3-4 are interaction-preserving — if running unattended, do the SAFE half (the
`parent` plumbing + measure) and STOP before claiming the speeder/pickups still work; surface it. Ambiguous → GDD pillars
+ realism dial; append a D-entry; continue.

## Footguns (this arc)
- **The merge skips accessPanel/noMerge/interactType/transparent (D198/D203)** — ANIMATED parts with no interactType
  (speeder wheels/tow-bar) are NOT auto-skipped; tag them `noMerge` before merging.
- **External force on the KCC → a one-frame `ctx.player.externalPull` field folded into `desired` (D202)**, never a
  competing `setNextKinematicTranslation`.
- **A rare destination biome is a distance-override around `wreckYardAnchor`, not a noise band (D201)** — terrain reads
  `biomes.wreckYardAt`; new biome consumers must widen any hardcoded `'dune'|'rocky'|'salt'` unions.
- **Windows rig-shot teardown** `taskkill /T /F`s the vite tree (ACAO) — if a run wedges, check port 5191.

## Save discipline (D81)
Geometry/material/collider/additive-item only → no `SAVE_VERSION` bump. (relic_core is additive — old saves ignore it.)

## Stop conditions
3 fix-walls on one element (log + move on) · a `SAVE_VERSION` bump turning out necessary (surface it) · destructive-git
attempt · an interaction-preserving refactor that can't be live-verified unattended (do the safe half, surface).

## On stop
Run `/session-end` (verify → changelog → CLAUDE last-shipped → roadmap → D-entries → backlog → report → next-prompt →
post-mortem → commit + tag `session-ACAR` + push).
