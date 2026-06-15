# Session ACAV — Kickoff Brief

## Read these now (in order)
1. `CLAUDE.md` (auto-loaded) — "Where we are now" (ACAU: bury-audit prune + material shared-noise helper shipped).
2. `docs/session-end-report.md` — cumulative state (ACAU at top).
3. `docs/backlog.md` — the PENDING section (owed walk-tests A + features B).
4. `docs/decisions.md` tail (D209 generator-not-rename helper lift; D210 two-scope bury prune + door-exclusion; D207-D208 the ACAT lineage; D204-D206).
5. `docs/roadmap.md` "Up next" (the Phase-2 cycle plan) + `docs/architecture.md` (only if touching an unfamiliar system).

## What's already built
The wreck-yard biome + recessed Sarlacc pit, the full salvage/crafting/creature/sled/rope/weather/POI stack, a deep perf
pass (static-merges + ALL procedural materials on shared uniforms, perf-probe programs 67), and now the procgen/wreck-yard
salvage panels are bury-pruned (no phantom unreachable panels — `panels` audit 0 fails) + the material noise GLSL is lifted
to one shared `shaderNoise.ts` helper. tsc clean, SAVE_VERSION 14. The perf / material / bury debt buckets are now CLEARED.

## Session ACAV focus — pick a lane (no pressing debt left)
The autonomous debt that motivated ACAT/ACAU is done. Two shapes remain. **If a human is at the keyboard:** the owed
walk-tests are the single highest-value thing left and NONE have been done yet — they gate "is it actually good." **If
running autonomous:** the next real build is a feature (raider proc-character is the most shovel-ready + headless-verifiable).

## Priority items (in order)
1. **(ATTENDED) The owed human WALK-TESTS — `npm run dev`** (the headless harness can't judge feel; the dev server was left
   running on `localhost:5173` at the end of ACAU):
   - **Recessed Sarlacc pit** (`__game.ctx.biomes.sarlaccPitAnchor`, D204): the PULL feel + can you CLIMB BACK OUT of the
     funnel while pulled (no softlock; walls ~39° < KCC 50°); tune `tuning.ts` `SARLACC_PIT_*`.
   - **Dropped-item settle feel** (ACAS B2): `__game.dropTestItem('pipe_staff'|'amban_rifle'|'canteen'|…)` — does the
     capsule/ball lie read more natural than a box? tune the bbox-derived half-extents in `pickups.ts`.
   - **Graveyard** (`wreckYardAnchor`) relic findability + ominous read (now that buried panels are pruned, the reachable
     panels should all be lootable); **mega-wreck interior** (owed since ACAL).
2. **(AUTONOMOUS, biggest payoff) Raider proc-character body (Cycle 5b).** The pulse rifle (its weapon) shipped ACAC; the
   raider BODY is still a placeholder. Rebuild it as a full procedural character using the player-rig / vulture / lizard
   pipeline (Cycle 1+2 rig vocabulary exists) so the corpse-drag path + raider combat has a believable body. Headless-
   verifiable via rig-shots (pose/anim screenshots). **Scope it first** (`/feature-slice` or a `/plan-game`-style pass).
3. **(AUTONOMOUS, bigger, design-first) Deep cave system (Cycle 7).** A genuine sprawling underground reached via a surface
   descent opening; the companion egg lives deep inside (egg-acquisition spine preserved in commit `2d4035b`). Needs a
   DESIGN pass first (gen method / sub-heightfield collision / dark-nav). Not a quick build.
4. **(BUILD) The drop-pod intro cutscene** (backlog §B) — keep the title screen; spawn the player in a small enclosed pod
   with a baked descent + in-world lever/blackout/exit. Self-contained but sizeable.

## Stretch goals
- Speeder pickup-InstancedMesh (attended — interaction-raycast rework, can't feel-verify unattended).
- Activate the crafting chooser by adding ONE colliding recipe (gameplay-design call).
- Session-end-report PRUNE: it has accumulated duplicate scope blocks (ACAC/ACAB/ACAA/ACM appear twice) + a bloated ACAR2
  paragraph; a dedup pass would cut its session-start re-read cost (it's well over the ~3000-token-for-older threshold).

## Autonomy contract
Item 1 needs a human throughout — never claim feel/interaction verified from a headless run. Items 2-4 are real builds →
scope first (`/feature-slice`). Ambiguous → GDD pillars + the realism dial, append a D-entry, continue.

## Stop conditions
3 fix-walls on one element (log + move on / cut) · a `SAVE_VERSION` bump turning out necessary (surface it) ·
destructive-git attempt · an interaction-preserving refactor that can't be live-verified unattended (do the safe half, surface).

## Notable footguns (this arc)
- **RNG-desync (D208/D210):** the procgen world runs off ONE seeded `rand` stream; never conditionally skip an RNG-consuming
  call (`registerSalvageable`) to filter items. Register-all-then-prune (the prune does no `rand`).
- **Occlusion-prune scope (D210):** a bury/visibility prune must raycast at the SAME scope the verifying audit uses — the
  per-wreck self-prune is blind to the wreck-yard's post-merge CROSS-wreck occlusion, so it ALSO runs against the merged
  `yardGroup`. And the prune excludes the panel's `panelDoor` to match the audit's force-open-door state.
- **GLSL helper lifts (D209):** prefer a generator parameterised by the existing identifiers over a rename sweep — a GLSL
  name typo is invisible to tsc (names are strings) and only fails as a runtime shader-compile error; confirm with the
  `perf-probe` program-count invariant + a before/after pixel-diff, not just tsc. NEVER put a backtick or `${…}` in a GLSL
  comment inside a template literal.
- **Windows rig-shot** pins a fixed seed (`dustfall.pendingSeed`=1337) for deterministic shots; `--seed=<n>` overrides; the
  scenario boots its OWN vite on `--port` (default 5191) so it doesn't collide with `npm run dev`. The post-audit screenshot
  step can exit non-zero AFTER the audit line prints — read the captured output, not the exit code.

## Verification protocol
`npm run verify` (= `tsc --noEmit`) clean. Headless gates: `perf-probe` (programs/draw-calls/boot — programs should stay 67),
`procgen-wreck` (`--cls --angle --seeds --zoom`), `panels` (bury-audit — should stay 0 fails across seeds), `item-studio
--items=`, `speeder-fx`, `drop-test`, `craft-chooser`, `wreck-yard --angle=`, `sarlacc-test`. **Item 1 is feel-critical →
`npm run dev`.** Rule 8: screenshot-iterate any visual change (5-8 rounds new elements, 3-5 tuning); a raider proc-character
is NEW visual work → full iteration discipline + `/visual-triage`.

## On stop
Run `/session-end` (verify → changelog WITH any numbers → CLAUDE last-shipped → roadmap → D-entries → backlog → report →
next-prompt → post-mortem → commit + tag `session-ACAV` + push).
