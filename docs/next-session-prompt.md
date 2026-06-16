# Session ACAY — Kickoff Brief

## Read these now (in order)
1. `CLAUDE.md` (auto-loaded) — "Where we are now" (the salvage-panel mechanic is realism-COMPLETE: stencil portal + breaker-board interior + WYSIWYG-deplete salvage + door pop-off).
2. `docs/session-end-report.md` — cumulative state (ACAX at top).
3. `docs/backlog.md` — the PENDING section (the owed ACAX walk-tests + the next buildable features).
4. `docs/decisions.md` tail — D217-D220 (stencil portal / breaker-board redesign / WYSIWYG salvage / door pop-off); D214-216 (ACAW shapes/interior/gate).
5. `docs/roadmap.md` "Recently shipped" + `docs/architecture.md` (the panel-placement + stencil-portal contracts at the `Salvage-panel placement` footgun bullet).

## What's already built
The salvage-panel mechanic is now realism-complete end-to-end. Panels mount flush on any hull (`findSurfaceMounts`), come in rect/square/circular shapes, and their interior is a real **DIN-rail breaker board** (`panelGreeble.ts`: a fixed mounting skeleton — board + bus + DIN rails + wiring trough + terminal + 12 grid-aligned empty bay-sockets — with 5 salvageable breaker modules clipped onto the first bays; salvaging a module reveals its socket). The interior renders through a **stencil portal** (`panelPortal.ts`) so it's visible through a clipping wreck hull but correctly occluded by terrain/world. Salvage is **WYSIWYG** (visible parts == salvageable count, scales with condition, thins as stripped). Pried doors have a **50% pop-off** that falls with real physics (`panelDebris.ts`). The hull + panel exterior are darker/warmer rusted. `verify:placement` (0 bury fails), `salvage-audit` (0 mismatches/99), and `door-pop` gates all pass. The full wreck-yard / Sarlacc / salvage / crafting / creature / sled / weather / POI stack sits underneath. tsc clean, SAVE_VERSION 14 (unchanged — ACAX's `extractedIndices` is additive), perf-probe programs 69, draw calls 728.

## Session ACAY focus — pick a lane
The panel mechanic is done + headless-verified. **If a human is at the keyboard:** the owed ACAX walk-tests are the highest-value thing left (they gate "is it actually good" — feel + the glow-lit read can't be judged headless). **If running autonomous:** the next real build is a feature (raider proc-character is the most shovel-ready + headless-verifiable via rig-shots).

## Priority items (in order)
1. **(ATTENDED) The owed ACAX walk-tests — `npm run dev`** (the headless harness can't judge feel/glow/world-occlusion):
   - **Breaker-board read + salvage:** pry a panel, see the breaker board under the amber pry-glow up close; SALVAGE the modules + watch the bays empty (sockets revealed). Tune `SALVAGE_PANEL_GLOW_*` if the cavity reads dark.
   - **Door pop-off FEEL:** the 50% shear-loose — outward launch / tumble / clang satisfying? Tune `SALVAGE_PANEL_POP_SPEED`/`_UP`/`_SPIN` (tuning.ts).
   - **Stencil portal:** confirm the interior NO LONGER bleeds through terrain/dunes/sides, AND a normal panel doesn't FLICKER against its coplanar hull (if it does → raise the mask polygonOffset in `panelPortal.ts`).
   - Older owed: recessed Sarlacc pull-feel + climb-out (`sarlaccPitAnchor`), graveyard read (`wreckYardAnchor`), mega-wreck interior.
2. **(AUTONOMOUS, biggest payoff) Raider proc-character body (Cycle 5b).** The pulse rifle (its weapon) shipped ACAC; the raider BODY is still a placeholder. Rebuild it as a full procedural character (player-rig/vulture/lizard pipeline) so the corpse-drag path + raider combat has a believable body. Headless-verifiable via rig-shots. **Scope first** (`/feature-slice`).
3. **(AUTONOMOUS, design-first) Deep cave system (Cycle 7).** A sprawling underground reached via a descent opening; the companion egg lives deep inside (egg spine preserved in `2d4035b`). Needs a DESIGN pass first.
4. **(BUILD) Drop-pod intro cutscene** (backlog §B) — pod descent + lever + blackout + exit. Self-contained but sizeable.

## Stretch goals
- Panel dead-code cleanup (the superseded greeble builders + the redundant `_panelInteriorMat` backplate + the `colliderHint` field — see backlog §A `[debt]`).
- Activate the crafting chooser by adding ONE colliding recipe (gameplay-design call).

## Autonomy contract
Item 1 needs a human throughout — never claim feel/glow/world-occlusion verified from a headless run. Items 2-4 are real builds → scope first. Ambiguous → GDD pillars + the realism dial, append a D-entry, continue.

## Stop conditions
3 fix-walls on one element (log + move on / cut) · a `SAVE_VERSION` bump turning out necessary (surface it) · destructive-git attempt · an interaction-preserving refactor that can't be live-verified unattended (do the safe half, surface).

## Notable footguns (this arc)
- **Stencil portal (D217):** the renderer MUST stay `{ stencil: true }` (`core/scene.ts`); the interior materials are transparent + `depthTest:false` + `stencilFunc EQUAL` (shared singletons — keep them shared); the MASK is `depthTest:true` + polygonOffset (so the world occludes it). renderOrder bands: backplate/skeleton < modules.
- **Breaker board (D218):** ZERO jitter (alignment is the realism); the salvageable modules sit at the SAME slot+depth as the fixed bay-sockets so hiding reveals the socket (extraction only hides — no new logic); `mergeStaticByMaterial(..., {includeTransparent:true})` only works because the board is built strictly back-to-front.
- **WYSIWYG salvage (D219):** `registerSalvageable` hides surplus modules + caps `salvageRemaining` to the built count; `save.ts` `extractedIndices` is additive (no version bump) — re-hide them on load.
- **Panel placement contract (D212-216):** any new wreck CLASS/flagship must pass `npm run verify:placement` (0 bury fails); terrain-cull is SURFACE-scoped; per-panel placement keeps a FIXED `rand` budget; a new cover pivot must be named `panelDoor`.
- **Windows rig-shot** pins `dustfall.pendingSeed`=1337; boots its own vite on `--port`; the post-scenario teardown can exit non-zero AFTER the assertion line prints — read the captured stdout, not the exit code.
- **Rule 8** — visual/feel work is NOT done when tsc passes: build → screenshot → critique → iterate. ACAX's breaker board came from an adversarial design workflow + multi-round screenshot critique; hold that bar.

## Verification protocol
`npm run verify` (= `tsc --noEmit`) clean. `npm run verify:placement` (panels bury-audit 0 fails across seeds — re-run after ANY wreck-model change). Headless gates: `perf-probe` (programs ≤72), `salvage-audit` (visible==salvageable, 0 mismatches), `door-pop` (door detaches + falls finite), `panel-studio`, `procgen-wreck`, `wreck-yard`, `sarlacc-test`, `drop-test`. **Feel/glow-critical items → `npm run dev`.**

## On stop
Run `/session-end` (verify → changelog → CLAUDE last-shipped → roadmap → D-entries → backlog → report → next-prompt → post-mortem → commit + tag `session-ACAY` + push).
