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
7. **Exterior model decorations need real depth.** When adding boxy decorations to world entities (windows, panels, fragments, hull patches), use a depth of at least ~10cm for "thin" features and 15cm (matching `OPENING_WRECK_HULL_WALL_THICKNESS`) for hull-substantial features. 5cm reads paper-thin at oblique angles and breaks immersion. Cylinders, lathes, and torus-based geometry are inherently thick — this rule only applies to BoxGeometry-based decorations on the OUTSIDE of a hull/wall surface where the camera can view edge-on.
8. **Iteration discipline for visual/feel work** (post-ABP — `shared-memory/iterative-polish-discipline.md`). `npm run verify` clean is NOT the success gate when shipping rig geometry, camera behavior, animation, material colors, UI layout, or anything visual. Per substantive element: build → screenshot → critique → iterate, **5-8 rounds for new visual elements, 3-5 for tuning**. A real long-overnight ships 1-2 fully-iterated tiers, not 4-5 shallow ones. ABP triggered this rule: a 41-minute "long overnight" shipped 4 tiers of visibly-rough work that required follow-up polish. **Never** mark a visual tier complete with `npm run verify` as the only verification. **Never** write >150 LOC of visual code in a single Edit without screenshotting in between. If a tier describes its outcome as "shipped, no save-schema changes, deferred polish to a follow-up" — that's the anti-pattern; loop back and iterate.

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

**Last shipped**: Session ACAX — **Salvage-panel interior + exterior REALISM overhaul** (tsc clean, `verify:placement` 0 fails,
NEW `salvage-audit` 0 mismatches/99, `door-pop` smoke test PASS, no save bump; D217-D220). Long user-feedback-driven session.
**Stencil portal (D217):** the interior renders as a "window into the hull" — a per-panel MASK writes `stencil=REF`, the interior
draws `stencilFunc EQUAL`+`depthTest:false`+transparent so it shows THROUGH a clipping hull (renderer now `{stencil:true}`); the MASK
itself RESPECTS depth (+polygonOffset) so terrain/dunes/sides/far-side panels in front occlude it — visible through the WRECK HULL
ONLY, never the world (`world/panelPortal.ts`). **Breaker-board interior (D218, headline):** scattered greeble → a real DIN-rail board
(adversarially-judged design workflow) = a FIXED skeleton (board + bus + 3 rails + trough + terminal + 12 empty bay-sockets) + 5
salvageable BREAKER modules clipped onto the first bays at the same slot, so salvaging a module reveals its socket — ZERO jitter, ZERO
new logic (`makeBreakerBoard`/`makeBreaker`/`buildSalvageComponents`); merge gained `includeTransparent` (portal mats are transparent)
→ sceneMeshes 21k→8.6k. **WYSIWYG salvage (D219):** `registerSalvageable` hides surplus modules so visible==salvageable (corroded ~1-2,
pristine 5), thins as stripped; `save.ts` persists `extractedIndices`. **Door pop-off (D220):** 50% of pried doors SHEAR LOOSE + fall
with real physics (`world/panelDebris.ts`, dropped-item pattern + clang). Plus: darker/warmer rusted hull + panel-exterior palette,
DoubleSide rusted body, relief'd rusted door, rusted (not gold) frame, `archetypeForKind` fallback (all 16 callsites get V2), removed
the wreck recolor-on-salvage dim + the bandage model.

**Next session** = the OWED human WALK-TESTS in `npm run dev` (eyes-only): the salvage breaker-board read under the amber pry-glow up
close + actually salvaging to feel the bays empty; the door pop-off FEEL (outward/tumble/clang); confirm the stencil portal no longer
bleeds through terrain/sides AND a normal panel doesn't flicker against its hull (mask-vs-coplanar-hull). THEN a new buildable feature:
raider proc-character (Cycle 5b — proven rig pipeline), deep cave system (Cycle 7 — design pass first), or the drop-pod intro.
See [docs/next-session-prompt.md](docs/next-session-prompt.md) + [docs/backlog.md](docs/backlog.md).

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

## Don't burn context on

Re-reading files. `git status -uall`. Pasting full eval results when one value answers. Wide screenshots when `gl.readPixels` is enough. Spawning an agent for a one-symbol lookup a Grep would answer (fan out for real work, not trivial lookups).
