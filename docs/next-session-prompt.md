# Session ACAU — Kickoff Brief

## Read these now (in order)
1. `CLAUDE.md` (auto-loaded) — "Where we are now" (ACAT: material-uniforms + brighter hulls shipped).
2. `docs/session-end-report.md` — cumulative state (ACAT at top).
3. `docs/backlog.md` — the PENDING section (owed walk-tests + buildable debt/features).
4. `docs/decisions.md` tail (D207 material-uniforms pattern; D208 RNG-desync footgun; D204-D206).
5. `docs/roadmap.md` + `docs/architecture.md` (only if touching an unfamiliar system).

## What's already built
The wreck-yard biome + recessed Sarlacc pit, the full salvage/crafting/creature/sled/rope/weather/POI stack, and a deep
perf pass: static-merges (wrecks, speeder, wreck-yard), and now ALL procedural material factories share uniforms
(perf-probe programs 105→67). tsc clean, SAVE_VERSION 14.

## Session ACAU focus — pick a lane (the perf/material debt is now largely cleared)
Two shapes available. **If a human is at the keyboard:** the owed walk-tests are the highest-value thing left (they gate
"is it actually good"). **If running autonomous:** there's a clean buildable item (the bury-audit register-all-then-prune
fix) plus the big feature options.

## Priority items (in order)
1. **(ATTENDED) The owed human WALK-TESTS — `npm run dev`** (the headless harness can't judge feel):
   - **Recessed Sarlacc pit** (`__game.ctx.biomes.sarlaccPitAnchor`, D204): the PULL feel + can you CLIMB BACK OUT of the
     funnel while pulled (no softlock); tune `tuning.ts` `SARLACC_PIT_*`.
   - **Dropped-item settle feel** (ACAS B2): `__game.dropTestItem('pipe_staff'|'amban_rifle'|'canteen'|…)` — does the
     capsule/ball lie read more natural than a box? tune the bbox-derived half-extents in `pickups.ts`.
   - **Graveyard** (`wreckYardAnchor`) relic findability + ominous read; **mega-wreck interior** (owed since ACAL).
2. **(AUTONOMOUS, clean) Bury-audit the RIGHT way (D208).** The 4 fails (~3% of 133) are procgen findPanelMount panels
   occluded by a sibling post-assembly. Implement **register-all-then-prune** in `placeProcgenComposite`'s registration
   loop: every panel `registerSalvageable`s normally (do NOT skip — it consumes `rand`, D208), then a 2nd pass removes any
   panel the assembled wreck occludes (mirror `panelBuryAudit`'s raycast; `updateWorldMatrix(true,true)` on the wreck root
   first). Gate: `panels` scenario fails → 0, total count drops only ~4.
3. **(AUTONOMOUS, stretch) Material shared-noise-helper lift (D207).** Each factory redeclares an identical IQ `hash`/
   `valueNoise`/`fbm` GLSL block — lift to one shared snippet. Low-risk cleanup; verify materials render identical.
4. **(BUILD, bigger) A feature from the backlog §B:** raider proc-character (Cycle 5b — pulse rifle done, body remains,
   proven rig pipeline, headless-verifiable); deep cave system (Cycle 7 — needs a design pass first); or the opening
   drop-pod cutscene.

## Stretch goals
- Speeder pickup-InstancedMesh (attended — interaction-raycast rework, can't feel-verify unattended).
- Activate the crafting chooser by adding ONE colliding recipe (gameplay-design call).

## Autonomy contract
Item 1 needs a human throughout — never claim feel/interaction verified from a headless run. Items 2-3 are headless-safe.
Item 4 (raider/cave/drop-pod) is a real build → scope it first (a `/plan-game`-style pass or the `feature-slice` skill).
Ambiguous → GDD pillars + the realism dial, append a D-entry, continue.

## Stop conditions
3 fix-walls on one element (log + move on / cut) · a `SAVE_VERSION` bump turning out necessary (surface it) ·
destructive-git attempt · an interaction-preserving refactor that can't be live-verified unattended (do the safe half, surface).

## Notable footguns (this arc)
- **RNG-desync (D208):** the procgen world runs off ONE seeded `rand` stream; never conditionally skip an RNG-consuming
  call (`registerSalvageable`) to filter items — it regenerates the whole world. Register-all-then-prune instead.
- **Material program collapse (D207):** to merge onBeforeCompile variants, make every per-instance difference a
  uniform/runtime-branch, then drop the per-instance cache key (default `onBeforeCompile.toString()` handles it); a `pbr`
  base-class fork needs no key. NEVER put a backtick or `${...}` in a GLSL comment inside the template literal (it closes
  the literal / interpolates — two TS errors this session).
- **Windows rig-shot** pins a fixed seed (`dustfall.pendingSeed`=1337) for deterministic shots; `--seed=<n>` overrides.

## Verification protocol
`npm run verify` (= `tsc --noEmit`) clean. Headless gates: `perf-probe` (programs/draw-calls/boot), `procgen-wreck`
(`--class --angle --seeds --zoom`), `panels` (bury-audit), `item-studio --items=`, `speeder-fx`, `drop-test`,
`craft-chooser`, `wreck-yard --angle=`, `sarlacc-test`. **Item 1 is feel-critical → `npm run dev`.** Rule 8: screenshot-
iterate any visual change (per-factory material-identity shot is the catch-net for material edits).

## On stop
Run `/session-end` (verify → changelog WITH any perf numbers → CLAUDE last-shipped → roadmap → D-entries → backlog →
report → next-prompt → post-mortem → commit + tag `session-ACAU` + push).
