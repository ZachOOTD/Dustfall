# Dustfall — project manual

Browser first-person desert survival game. Long Dark / Mad Max / Dune tone.

This project uses **gamedev-framework v0.3.x** (retrofitted 2026-05-20).
The framework provides session-lifecycle skills (`/session-start`,
`/session-end`, `/triage-ideas`, `/audit-debt`, …), an autonomy
convention for agentic sessions, and shared design patterns. See
`~/.claude/plugins/.../gamedev-framework/` for plugin source and
`~/projects/gamedev-framework/docs/` for framework docs. Dustfall
**opts out** of the framework's tier-ladder verification model — see
[docs/roadmap.md](docs/roadmap.md) for the rationale (post-MVP, the
per-session "Next + Big-ticket bucket" structure stays in use).

## Tech stack

Three.js + TypeScript + Vite + `@dimforge/rapier3d-compat` + `simplex-noise` + procedural Web Audio (no sample files).

## Project location

`C:\Users\Zach\projects\dustfall`

Run with `npm run dev` (port 5173). Type-check / verify with
`npm run typecheck` or `npm run verify` (both = `tsc --noEmit`).

**Reference docs** (read on demand):
- [docs/GDD.md](docs/GDD.md) — game design truth document (hydrated at retrofit).
- [docs/architecture.md](docs/architecture.md) — file map, footguns, FPS-debug path.
- [docs/changelog.md](docs/changelog.md) — what shipped per session.
- [docs/roadmap.md](docs/roadmap.md) — what's next.
- [docs/decisions.md](docs/decisions.md) — why we made key calls (with friction-scores).
- [docs/backlog.md](docs/backlog.md) — unprioritized ideas / bugs / polish / debt.
- [docs/next-session-prompt.md](docs/next-session-prompt.md) — queued direction for the upcoming session.

## Architecture rules

1. **`GameContext` is the spine.** Every system reads/writes `ctx`. Don't pass random params around.
2. **Magic numbers → `src/config/tuning.ts` ONLY.** Don't sprinkle them.
3. **Per-frame tick order in `main.ts` matters.** Current order:
   ```
   physics.step → updateWeather → updateLighting → updateSky → updatePlayer →
   updateShelter → updateStats → updateSoundscape → bobPickups → updateRaiders →
   updateLizards → updateShrews → updateFires → updateInteraction → updateInventoryInput →
   updateCombat → updateViewModel → updateHud → updateHotbar →
   updateInteractPrompt → updatePhysicsDebug → updatePerfHud → endInputFrame
   ```
4. **Pause gates everything.** `if (ctx.flags.paused) { endInputFrame(); return; }` — physics, AI, weather all freeze.
5. **DOM ownership.** Each UI module owns its DOM refs; created at boot, mutated each frame.
6. **No `innerHTML` with concatenated strings** — the pre-tool hook flags it as XSS risk. Use `createElement` + `textContent`.
7. **Models need REAL THICKNESS — no paper-thin zero-thickness double-sided shells** (generalized 2026-07-13, user rule from the Skyfall walk-test: "all of the models in the game should have thickness to make them realistic"). A `DoubleSide` material on a single-surface mesh renders both faces of a zero-thickness shell → it reads as paper at any grazing/edge angle (and you see through gaps). Solids get FrontSide + genuine wall depth so torn/cut edges show a real cross-section; `DoubleSide` is only for things that are genuinely open + thin (grille slats, cloth). Lofted hulls take a real wall `thickness` (an inner skin + rim caps — e.g. Skyfall's `HULL_THICK = 0.7`; 0.35 read paper-thin at 46m scale). **Sub-rule (boxy decorations):** BoxGeometry decorations on the OUTSIDE of a hull/wall (windows, panels, fragments, hull patches, plate strakes) need depth ≥10cm for "thin" features, 15cm (`OPENING_WRECK_HULL_WALL_THICKNESS`) for hull-substantial — 5cm reads paper-thin edge-on. Cylinders/lathes/tori are inherently thick. **Verify from grazing/edge angles + the fracture cross-section, not just face-on.**
8. **Iteration discipline for visual/feel work** (post-ABP — `shared-memory/iterative-polish-discipline.md`). `npm run verify` clean is NOT the success gate when shipping rig geometry, camera behavior, animation, material colors, UI layout, or anything visual. Per substantive element: build → screenshot → critique → iterate, **5-8 rounds for new visual elements, 3-5 for tuning**. A real long-overnight ships 1-2 fully-iterated tiers, not 4-5 shallow ones. ABP triggered this rule: a 41-minute "long overnight" shipped 4 tiers of visibly-rough work that required follow-up polish. **Never** mark a visual tier complete with `npm run verify` as the only verification. **Never** write >150 LOC of visual code in a single Edit without screenshotting in between. If a tier describes its outcome as "shipped, no save-schema changes, deferred polish to a follow-up" — that's the anti-pattern; loop back and iterate.
9. **Collision always matches the models — update both together** (user rule, 2026-07-03). If you change, move, retire, or re-loft a model, you update its colliders IN THE SAME CHANGE; collision must match the visible geometry exactly unless the user explicitly states otherwise. Stale colliders from removed/old geometry are bugs (the escape-pod ship shipped with old-box collision under a re-lofted hull and an orphaned collider behind a reworked chair — the user walked into invisible walls). When touching a scene's geometry, sweep its collider list against what's actually visible; verify with a real-motion probe (walk the space), not clearance numbers alone.

## How to change the game

- **Game feel** (movement speed, drain rates, etc.) → `src/config/tuning.ts`.
- **Look** (sky colors, shadow map, exposure) → `src/config/tuning.ts` + `src/world/sky.ts` shader.
- **Add an item** → add to `inventory/types.ts` ItemId union + register in `inventory/items.ts`.
- **Add a sound** → new function in `src/audio/audio.ts` synthesizing via Web Audio nodes.
- **Add a system** → new file, hook into `main.ts` tick at the right order.

## Where we are now

<!-- Keep this to the LATEST Last-shipped paragraph + the Next pointer only.
     Prior milestones live in docs/changelog.md — do NOT accumulate "Prior milestone"
     blocks here. CLAUDE.md is auto-loaded every turn; keep it ≤5K tokens. -->

**🚀 RELEASED (2026-07-05) — the ESCAPE-POD INTRO IS THE GAME'S OPENING** — merged to `master` + LIVE at https://zachootd.github.io/Dustfall/. `FEATURES.escapePodIntro` defaults ON everywhere (env kill-switch `VITE_ESCAPE_POD_INTRO=0`). Arc: hauler cockpit → engine disaster → flee the corridor → board the ONE pod → seal → cradle-rotate → eject → descent → the parachute gag → crash → wake in the SAME pod → step out → tutorial → the chute pops. Full detail + the vision-interview arc: the feature doc + [changelog.md](docs/changelog.md). Hero-model pipeline: `scripts/model-stage.mjs` (turntable + geometry lint; `docs/model-stage.md`).

**🖥️ DESKTOP BUILD (2026-07-08)** — Dustfall is now an installable Tauri v2 desktop app alongside the web build. `npm run tauri:build` → **Dustfall.exe (9.3 MB)** + an NSIS installer (`src-tauri/`; `csp:null` for Rapier WASM, `mainBinaryName Dustfall`, `build:desktop`=`cross-env VITE_BASE=/ vite build` — the GH-Pages build is byte-identical). This machine has the toolchain (Rust `stable-msvc` + VS 2022 Build Tools). Unsigned v1 (SmartScreen warns on other machines); localStorage saves persist per-app.

**Last shipped — campaign "Infinite Sands" COMPLETE, cycles 1-7 / the full S-ladder (2026-07-11, autonomous, branch `campaign/2026-07-10-procgen`)** — **the world is INFINITE: streamed, inhabited, destination-rich, hitch-free, and PERSISTENT.** S1 anchor-margin streaming core + permanent `verify:chunks` gates; S2 streamed POI wrecks; S3 rocks/scenes/prey; S4 region-grid hero landmarks (colossal ribcage, wreck knot — Skyfall's future slot) + regional wreck-yard biomes; S6 sliced hitch-free generation + the `chunk-perf` gate; S5 SAVE_VERSION **17** `chunkDiffs` (descriptor-keyed sparse far-field persistence, zero-migration, REAL reload+CONTINUE gate-proven). Playtest hotfix D297 (stream/save around `getPlayerPos`, not the speeder-parked capsule; permanent ride leg, A/B-proven). Post-campaign **D299 ORIGIN PARITY** (playtest: the far field felt empty): streamed chunks now spawn the FULL boot content set — dead trees w/ branch pickups, wells, cactus patches, roaming prey, scrap rings at streamed wrecks — all save-transient, taken pickups persisting via a `pickups.taken` diff branch; new purity-safe `terrain.pureHeightAt` for descriptor gates. All gates green every cycle; the released origin world byte-identical throughout. D288–D299. (Also this session: the framework-wide `reap-orphans` process-leak fix, `gamedev-framework@e78c1ca`.)

**MERGED + DEPLOYED (2026-07-12)**: Infinite Sands went to `master` and the GH-Pages site redeployed (desktop exe still pre-procgen — rebuild when wanted).

**🚀 SHIPPED (2026-07-17) — campaign "SHARPEN & DEEPEN" + the review-fix / Phase-1 / SOLID batches are MERGED to `master` and LIVE** at https://zachootd.github.io/Dustfall/ (a push to `master` auto-deploys via `.github/workflows/deploy.yml`). Desktop exe is still pre-procgen — rebuild when wanted. What shipped, in two stretches:

- **The M7-R→M12 queue (cycles 9-24, autonomous):** the enterable hero **Skyfall freighter** — a rare S4 far-field landmark kind (`skyfall_freighter`, `FEATURES.skyfall`/`VITE_SKYFALL=0` kill-switch): a ~46m crashed heavy freighter, hero-detailed exterior (cargo containers, plated hull, greebles, warm-rust weathering) + a walkable hero interior (cargo hold / dead-console machine bay / crew cabin, "sun through the tear" lighting) + 2 salvage panels + the pilot's crash-log journal (`src/world/skyfallWreck.ts`, ~1000 lines; S1-S6 = D300/D302/D303). Then M7-R Skyfall refinement (walk-test fixes) · M8 far-field vultures · M9 3 new POI archetypes (refinery / hab-dome / rail-car) · M10 3 new story vignettes · M11 legacy tube-wreck retirement (D306) · M12 a new far-field biome — **`bone_field`, a titan graveyard with a colossal half-buried ribcage centerpiece (this REPLACED the short-lived `ash_barren` biome on 2026-07-14; `ash_barren` no longer exists in the game).** **Probe infra (D301): GPU headless is now the rig-shot default — ~10× faster + CPU-cool** (`RIG_GL=swiftshader` reverts).
- **The 2026-07-15 review-fix + Phase-1 batch (attended, 6 commits, each gate-green + human-verified):** Skyfall fracture/entrance seal · boneyard ribcage full redesign (walk-under bone tunnel, correct orientation, greyer bone) · sandworm horizon color lifted off near-black · POI/wreck spacing (sparser 0.07→0.048 + larger spawn-clear zone 1250→1600m) · storm overhaul (approaching dustwall haboob + whiteout fog + wind-audio ramp + denser particles; `dustWall.ts`) · big-fin **leviathan** walkable hero interior + exact collision (`leviathan-walk` gate; `leviathanLandmark.ts`).

Also shipped in the 2026-07-16/17 SOLID batch: the **`verify:solid` harness** (`scripts/verify-solid.mjs`, `docs/verify-solid.md`) — 7 machine checks (thin / backface / open-end / floating / collision / seam / **walkin**), now fully green across skyfall / leviathan / ribcage / hab_dome; plus the storm colour-space fix, the bone + worm night-lighting fixes, and the hab_dome unseal.

**THE LESSON THAT DRIVES THIS PROJECT'S PROCESS** (from Fable's audit + a hard session): *every failure that got a machine gate stopped recurring; every failure that got only a prose rule recurred.* And the inverse, proven repeatedly: **a gate that measures the wrong thing is WORSE than no gate — it launders a bug as verified.** `open-end` once flagged the leviathan's front door as a defect, so a pass bricked up the interior; `leviathan-walk` was green on an unclimbable ramp because its waypoints teleport; the harness's collision check was vacuous (Rapier's QueryPipeline only rebuilds on `world.step()`). Zach's playtest beat the gates three times running. **Trust the playtest report over the gate**, and when a builder cuts a real opening it must declare `userData.intendedOpening` so `open-end` and `walkin` can never fight each other.

**🚀 SHIPPED (2026-07-18) — campaign "SCAVENGER'S ECONOMY" MERGED to `master` and LIVE.** The loot economy is real: **4 new materials** (`metal_pipe` / `machine_part` / `wiring` / `battery` — a pipe, a mechanism, a cable, a cell; battery deliberately scarcest) drop by **per-POI identity** (pipelines→pipes, tanks/crawlers→machine parts, relays/satellites/habs→wiring+batteries, hero wrecks richest) via ONE data-driven registry (`src/config/lootRegistry.ts`, all 4 former loot systems unified; `npm run verify:loot` = a 1000-roll digest gate against a committed baseline). Ground scatter world-wide (origin parity + generic wrecks). **3 existing loot-only items became craftable** (pipe_staff / scrap_gun / worm_lure with an `anyOf` any-raw-meat input) + **7 recipes updated** to cost identity materials; tutorial arc untouched; recipe cards show material source hints; discovery flow preserved. **SAVE_VERSION 18** (density rebalance forced it): pre-18 saves migrate gracefully — player intact, seeded world respawns pristine. Walk-test fix batch shipped same-day: climbable ribcage (full top collision + a real march gate), spike-bone removal, leviathan drift on the REAL terrain material + sand-mound audit (decorative mounds removed), the storm wall's sideways drift root-caused to SHADER UV scroll (0px lateral gate with proven teeth), POI density equalized origin↔far (41%→1%, dead ring closed, area-uniform sampling). cactus_pulp is deprecated dead code (grant paths removed, ids kept for save-compat).

**NEXT:** Zach's final feel pass on the economy in real play (drop rates, recipe costs — tuning is data edits in `lootRegistry.ts`/`recipeDiscovery.ts`; regen the loot baseline with `node scripts/verify-loot-digest.mjs --update`). Then the next campaign from `docs/campaign/audit-and-roadmap-2026-07-15.md`: mega dunes + ridable sled (Phase 3 "The Deep Desert") → cave system (needs the 10-min attended D254 KCC spike first — spike script in `docs/research/cave-feasibility.md`) → character/MP (research digests in `docs/research/`; needs the GDD multiplayer re-anchor). Owed feel-tests: `docs/backlog.md` §A. Desktop exe still pre-procgen — rebuild when wanted.

**Full per-session history**: [docs/changelog.md](docs/changelog.md).

### Tutorial flags (Session L)

`localStorage['dustfall.tutorial.v1']` stores `{seenIntro, usedItems}`. Wipe via the console with `__game.resetTutorial()` (or delete the key + refresh) to see the first-boot panel + all pickup hints again. `__game.showControls()` opens the controls panel without changing flags.

## Session workflow

Skills come from the **gamedev-framework plugin**, not local
`.claude/skills/`. Local copies of session-start, session-end, and
triage-ideas were removed at retrofit — invoke the framework versions:

- **Start of session**: `/session-start`. Reads
  [docs/next-session-prompt.md](docs/next-session-prompt.md) if
  present (written by the previous session-end), else falls back to
  [roadmap.md](docs/roadmap.md). Surfaces the last 2 changelog
  entries + 3-5 critical files for the active session.
- **End of session**: `/session-end`. Verifies (`npm run verify`),
  writes changelog entry, updates roadmap, archives plan, prints +
  auto-runs commit + `git tag session-<X>` + push.
- **Idea dumping**: `/triage-ideas` — paste free-form text;
  classifies + appends to [backlog.md](docs/backlog.md).
- **Audit debt**: `/audit-debt` — surfaces high-friction unresolved
  decisions from [decisions.md](docs/decisions.md).
- Memory upkeep: every ~5 shipped sessions, run
  `consolidate-shared-memory`.

Framework skills that DON'T apply to Dustfall (post-MVP, opt-out from
the tier-ladder): `/plan-vertical-slice`, `/verify-tier`,
`/scope-cutter` (until the Scope-cut section in roadmap is populated
per-session).

**Doc-drift guardrail** — print-hints commits (the default per
Dustfall's git policy) can drift from the docs when `/session-end` is
skipped between commits. Precedent: AAW+AAX backfilled in AAY; ABB-ABH
7-session bundle backfilled before ABI. **If the agent finds itself
with 3+ direct-paste commits since the last `/session-end` invocation,
it should pause and surface to the user that a docs catch-up is due
before continuing further code commits.**

## Sub-agent policy

**Parallel-by-default** (gamedev-framework v0.4.0+). Fanning work out across subagents is the default execution model, not a last resort — `/session-start` step 5 classifies each work item and picks a strategy. See `~/projects/gamedev-framework/shared-memory/orchestration-policy.md`.

- **Fan out** independent work: procedural materials/wreck variants authored together, multi-angle visual critique via `/visual-triage` (high-value for the procedural-character + wreck work), research sweeps, and exploratory architecture branches for tabled walls (e.g. the D125 riding mechanic — spike 2-3 candidates concurrently instead of serial retry). Issue as concurrent Agent calls or a dynamic workflow; `isolation: worktree` when agents mutate the same files.
- **Stay solo + sequential** only for dependency-ordered work (a step consuming the previous step's output) and observation-dependent tuning loops.
- Govern cost with per-agent `effort` (`low|medium|high|xhigh|max`), not by avoiding fan-out. `/effort ultracode` lets the model auto-orchestrate a whole session.
- **Dev servers self-reap (automatic, no command needed).** Each modeler agent + each rig-shot spawns its own Vite server (node), and completed ones used to leak until dozens piled up and slowed the machine. FIXED at the source: the `autoShutdownIdle` plugin in `vite.config.ts` makes every dev server terminate ITSELF once no browser has been connected for ~8 min (or ~20 min if never used) — safe because an in-use rig-shot/bench keeps its page attached, so it never dies mid-run. So orphaned servers clean up on their own; you don't need to reap. `npm run reap` (scripts/reap-dev.ps1) stays as the manual force-clean for IMMEDIATE relief (`-KeepPort 5180` preserves a test server); opt a server out of auto-shutdown with `DUSTFALL_NO_AUTOSHUTDOWN=1`.

## Don't burn context on

Re-reading files. `git status -uall`. Pasting full eval results when one value answers. Wide screenshots when `gl.readPixels` is enough. Spawning an agent for a one-symbol lookup a Grep would answer (fan out for real work, not trivial lookups).
