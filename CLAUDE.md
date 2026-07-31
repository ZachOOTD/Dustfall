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
   caveStream.update → updateChunks →
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
10. **New walkable/visible geometry ENROLLS in `verify:solid` in the same change that creates it** (process reflection 2026-07-30 — rule 9's twin, for the harness instead of the colliders). Coverage does not extend itself: the egg dais shipped see-through into Zach's walk-test while `verify:solid` — seven machine checks built for exactly that defect — sat green beside it, never having been pointed at the cave. When you add a hero/walkable structure, add its `ASSET_DEFS` entry (+ spawn branch) in `scripts/verify-solid.mjs` in the same change; scope inapplicable checks with an explicit per-asset `na` reason, never a silently-vacuous OK; and red-proof the enrollment by temporarily reintroducing the defect class it guards (winding flip, tri-punch) so the reading provably moves. `cave_tor`/`cave_dais` are the worked example.

## How to change the game

- **Game feel** (movement speed, drain rates, etc.) → `src/config/tuning.ts`.
- **Look** (sky colors, shadow map, exposure) → `src/config/tuning.ts` + `src/world/sky.ts` shader.
- **Add an item** → add to `inventory/types.ts` ItemId union + register in `inventory/items.ts`.
- **Add a sound** → new function in `src/audio/audio.ts` synthesizing via Web Audio nodes.
- **Add a system** → new file, hook into `main.ts` tick at the right order.

## Where we are now

**LIVE** at https://zachootd.github.io/Dustfall/ (a push to `master` auto-deploys via `.github/workflows/deploy.yml`). Desktop Tauri build is **CURRENT as of 2026-07-31** — rebuilt from master `875c611`, so it carries procgen + caves + the sliced tor: `src-tauri/target/release/Dustfall.exe` (9.4 MB) + an NSIS installer (3.0 MB) at `src-tauri/target/release/bundle/nsis/`. Rebuild with `npm run tauri:build` (~1 min). Still UNSIGNED — SmartScreen warns on other machines. The game: escape-pod intro opening → infinite streamed persistent desert (SAVE_VERSION 18) with hero landmarks (Skyfall freighter, leviathan, bone-field ribcage), mega dune-sea ergs + the ridable scrap sled, the identity-material loot economy, and the SDF cave system. Per-campaign history: [docs/changelog.md](docs/changelog.md); why: [docs/decisions.md](docs/decisions.md) (D277+ active, older in decisions-archive.md).

**Last shipped — campaign "DEEPER" COMPLETE (2026-07-24→30, branch `campaign/2026-07-24-deeper`, merged-to-master content LIVE):** the cave system rebuilt as **watertight SDF surface-nets interiors** (no shell kit) with warren/fungal/flooded/shaft kinds streamed as regular rocky-terrain features, the crevice-tor entrance (narrow squeeze mouth, biome-matched tint, organic edge lobes — 8 attended rounds to Zach's "looks decent now"), SDF-carved wadeable pool basins, cave-as-storm-shelter (cold preserved), the sealed egg dais, the dead-explorer beat (skeleton + 5-entry journal + rifled cache in every warren; **loot containers ONLY spawn beside bodies** — both orphan spawners deleted), and the process reflection close: **rule 10** (geometry enrolls in `verify:solid` same-change; cave back-enrolled, red-proven twice, D320) + four process levers in steering.md + the framework consolidation (5 drafts → canon). Batch gate of record: 22 legs green, every new sub-gate red-proven; origin digests ec2ebf98/876749d6.

**THE LESSON THAT DRIVES THIS PROJECT'S PROCESS** (Fable's audit + repeated proof): *every failure that got a machine gate stopped recurring; every failure that got only a prose rule recurred.* And the inverse: **a gate that measures the wrong thing is WORSE than no gate — it launders a bug as verified** (open-end once bricked up the leviathan; the harness collision check was vacuous; Zach's playtest beat the gates three times running). **Trust the playtest over a green gate**; red-proof every new tooth (the reading must MOVE); a builder that cuts a real opening declares `userData.intendedOpening`.

**NEXT (Zach's pick):** owed taste passes, all data/tuning edits — cave feel (darkness depth, torch range, mushroom glow, drip rate, `CAVE_*`), economy feel (drop rates / recipe costs), Deep-Desert tweaks (music duck, trough-find rarity, shard collision, sled feel) · `CAVE_BEAT_CACHE` contents (his call, ⚑) · cycle-13 candidate: tor build-cost slicing (236ms, plan needs re-read — the mouth sill IS digest-coupled via the descent line) · character/MP direction (research digests in `docs/research/`, needs the GDD multiplayer re-anchor) · audio listen session (attended) · [docs/backlog.md](docs/backlog.md) §PENDING. Kickoff brief: [docs/next-session-prompt.md](docs/next-session-prompt.md).

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
