# Session ACAX — Kickoff Brief

## Read these now (in order)
1. `CLAUDE.md` (auto-loaded) — "Where we are now" (the salvage-panel overhaul is COMPLETE, all 6 tiers).
2. `docs/session-end-report.md` — cumulative state (ACAW at top).
3. `docs/backlog.md` — the PENDING section (owed walk-tests + buildable features).
4. `docs/decisions.md` tail — D214-216 (panel shapes / interior split / scalability gate); D211-213 (ACAV).
5. `docs/roadmap.md` "Up next" (the Phase-2 cycle plan) + `docs/architecture.md` (the panel-placement contract).

## What's already built
The salvage-panel mechanic was rebuilt end-to-end (ACAV+ACAW, 6 tiers): one unified `validatePanels`, a surface-scoped
terrain cull (no more phase-through), a shape-agnostic flush `findSurfaceMounts` (works on any hull), rect/square/circular
shapes (the circle is a bolted lift-off port), and a 5-archetype scrappy interior (`world/panelGreeble.ts` — pipes/fuses/
machinery/wires/gauges/valves) with the loot economy unchanged. `npm run verify:placement` is the scalability gate. The full
wreck-yard / Sarlacc / salvage / crafting / creature / sled / weather / POI stack sits underneath. tsc clean, SAVE_VERSION 14,
perf-probe programs 67.

## Session ACAX focus — pick a lane
The panel overhaul is done + headless-verified. Two shapes remain. **If a human is at the keyboard:** the owed walk-tests are
the highest-value thing left (they gate "is it actually good"). **If running autonomous:** the next real build is a feature
(raider proc-character is the most shovel-ready + headless-verifiable via rig-shots).

## Priority items (in order)
1. **(ATTENDED) The owed human WALK-TESTS — `npm run dev`** (the headless harness can't judge feel):
   - **NEW: salvage-panel pry-FEEL (ACAW).** Pry a few panels (rect + circle): does the door swing / circle cover lift-off
     read well? Does the amber-glow-lit cavity show the scrappy interior cleanly? The headless audit force-opens doors WITHOUT
     igniting the pry-glow, so the LIT cavity is eyes-only. Tune `SALVAGE_PANEL_GLOW_*` + the V2 backplate depth / glow-anchor
     in `wrecks.ts` if the deep cavity reads too dark. `__game.spawnPanelStudio({shape,archetype,open})` renders one in isolation.
   - **Recessed Sarlacc pit** (`__game.ctx.biomes.sarlaccPitAnchor`, D204): PULL feel + climb-out (no softlock).
   - **Dropped-item settle** (now the cuboid, D211): confirm the revert feels right.
   - **Graveyard** (`wreckYardAnchor`) read; **mega-wreck interior** (owed since ACAL).
2. **(AUTONOMOUS, biggest payoff) Raider proc-character body (Cycle 5b).** The pulse rifle (its weapon) shipped ACAC; the
   raider BODY is still a placeholder. Rebuild it as a full procedural character (player-rig/vulture/lizard pipeline) so the
   corpse-drag path + raider combat has a believable body. Headless-verifiable via rig-shots. **Scope first** (`/feature-slice`).
3. **(AUTONOMOUS, design-first) Deep cave system (Cycle 7).** A sprawling underground reached via a descent opening; the
   companion egg lives deep inside (egg spine preserved in `2d4035b`). Needs a DESIGN pass first.
4. **(BUILD) Drop-pod intro cutscene** (backlog §B) — pod descent + lever + blackout + exit. Self-contained but sizeable.

## Stretch goals
- Strip the now-dead `colliderHint` field + tags (`types.ts`/`items.ts`) — D211 left them harmless.
- Activate the crafting chooser by adding ONE colliding recipe (gameplay-design call).
- Session-end-report dedup (duplicate ACAC/ACAB/ACAA/ACM scope blocks + the long ACAR2 paragraph).

## Autonomy contract
Item 1 needs a human throughout — never claim feel/interaction verified from a headless run. Items 2-4 are real builds →
scope first. Ambiguous → GDD pillars + the realism dial, append a D-entry, continue.

## Stop conditions
3 fix-walls on one element (log + move on / cut) · a `SAVE_VERSION` bump turning out necessary (surface it) ·
destructive-git attempt · an interaction-preserving refactor that can't be live-verified unattended (do the safe half, surface).

## Notable footguns (this arc)
- **Panel placement contract (D212-216):** any new wreck CLASS/flagship must pass `npm run verify:placement` (0 bury-audit
  fails); terrain-cull is SURFACE-scoped (interiors are legitimately below terrain); any per-panel placement search keeps a
  FIXED `rand` budget; a new panel cover pivot must be named `panelDoor`.
- **RNG-desync (D208):** the procgen world runs off ONE seeded `rand` stream; never conditionally skip an RNG-consuming call.
- **Windows rig-shot** pins `dustfall.pendingSeed`=1337; boots its own vite on `--port`; the post-scenario teardown can exit
  non-zero AFTER the assertion line prints — read the captured stdout, not the exit code.
- **Rule 8** — visual/feel work is NOT done when tsc passes: build → screenshot → critique → iterate (5-8 rounds new, 3-5 tuning).

## Verification protocol
`npm run verify` (= `tsc --noEmit`) clean. `npm run verify:placement` (panels bury-audit 0 fails across seeds — re-run after
ANY wreck-model change). Headless gates: `perf-probe` (programs 67), `procgen-wreck`, `panel-studio`, `item-studio`,
`wreck-yard`, `sarlacc-test`, `drop-test`. **Feel-critical items → `npm run dev`.**

## On stop
Run `/session-end` (verify → changelog → CLAUDE last-shipped → roadmap → D-entries → backlog → report → next-prompt →
post-mortem → commit + tag `session-ACAX` + push).
