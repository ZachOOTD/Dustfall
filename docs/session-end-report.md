# Dustfall — Session-end report

Cumulative state. Rewritten (and pruned) at each `/session-end`. Per-session detail lives in
`docs/changelog.md` (append-only); per-cycle campaign detail in `docs/campaign/campaign-log.md`.

## Current state (2026-07-11)

**The game is a complete, playable, shippable browser + desktop survival game** (released intro,
LIVE web build, Tauri desktop build).

**⚙ ACTIVE CAMPAIGN — "Infinite Sands"** (branch `campaign/2026-07-10-procgen`).
**S1-S4 shipped (cycles 1-4). Two rungs left: S6 perf (next) → ⏸ S5 save (the sanctioned pause,
then the morning review).** Ladder detail: `docs/roadmap.md` "Up next".

**Cycle 4 (this session) — S4 landmarks + per-region biomes (D295):** the far field has
destinations. Region-grid (1792m) hero landmarks at 0.3/region — `colossal_ribcage` (a 5-8×
titan skeleton; placeRibcage gained scale + returns handles, collider scaled with the mesh) and
`wreck_knot` (a 3-wreck salvage triangle + carcasses; Skyfall's future slot) — rendered on the
normal chunk lifecycle. Regional wreck-yard anchors (0.08/region, ≥2200m from origin — the boot
ring's corner vertex is 1697m) feed the SAME `wreckYardAt` via one APPENDED biome-stream draw +
a memoized region hash: far graveyards get the ashen mottled ground, terrain flatten, biome id,
graveyard POI mix, and a 6× POI density with zero new consumer code. The released origin world
bakes byte-identically (placement gate green ×5 seeds). Gates extended: landmark
descriptor↔render equality, a landmark-site walk leg, a ±15km regional-yard biome scan, vista
landmark/yard shots + a vertex-color yard diagnostic.

**Mid-cycle interruption (resolved):** the user's machine hit 100% CPU — root-caused to leaked
headless browsers (`chrome-headless-shell`, whose dashed name every reap regex missed) + probe
suites' inherent swiftshader load. Fixed FRAMEWORK-WIDE: `gamedev-framework/plugin/scripts/
reap-orphans.mjs` (orphan-state reaping, safe with concurrent sessions) wired as global
SessionStart/SessionEnd hooks; per-project regexes fixed (dustfall, project-mountain, skeleton);
canon in `gamedev-framework/shared-memory/process-leak-hygiene.md`. Verified live: the
SessionStart hook fired on restart, and the full cycle-4 gate suite returned the machine to an
exact 4-node/0-headless baseline.

**Verify baseline:** all 10 gates green first-pass this cycle (streaming: bodies 332→332,
farPois/farRocks descriptor↔render exact, landmark leg green). Save schema v16 untouched.

## What works end-to-end
The full survival loop plus an INFINITE world: walk any direction forever — deterministic terrain,
wrecks with working salvage, rocks, wordless vignettes, prey clusters, rare hero landmarks
(titan skeletons, salvage knots), and rare regional wreck-yard graveyard regions. All streamed
content is save-transient (regenerates pristine — v1 semantics until S5) and leak-gated.

## Known issues / partials
- Terrain tile bake frame-blocks at ring crossings (~100-200ms ×3 tiles per 800m) — **S6, next**.
- Streamed content regenerate-pristine on reload until S5 (D292, documented).
- Regional yards lack a dense boot-style cluster read (backlog `[polish]`, knob: the ×6).
- No far-field vultures (D294 defer); streamed-landmark horizon silhouettes skipped (S2/S4 note).
- The §A owed human walk-tests pile (`docs/backlog.md`).

## Constants / knobs (new this cycle)
`CHUNK_REGION_CHUNKS` (16), `CHUNK_LANDMARK_CHANCE` (0.3), `WRECK_YARD_REGION_CHANCE` (0.08),
`WRECK_YARD_REGION_MIN_DIST` (2200), the yard POI ×6 (chunkManager).

## Suggested next
1. **Cycle 5 = S6 perf** (brief in `docs/next-session-prompt.md`): measure → slice the tile bake
   across frames → ceilings + a NEW permanent cross-chunk perf probe.
2. **Then ⏸ S5** — the save-schema plan pauses for human review BEFORE building (D81).
3. Morning review: walk the infinite world (`npm run dev`) — landmarks, a regional yard, far
   salvage; then `/campaign-approve` at the S5 pause; Skyfall resumes after the campaign.

## State at session end
- **Git:** `campaign/2026-07-10-procgen`; cycles 1-4 committed (`e82d9a7`, `ad49dc0`, `deadc77`,
  cycle 4's SHA in campaign-log). `master` untouched, nothing pushed.
- **Save:** v16 untouched. **Machine:** 4 node / 0 headless after the full suite (the reap fix
  holding); framework fix committed separately (`gamedev-framework@e78c1ca`).

## Time + token spend
Cycle 4 ≈ 200K output tokens (build + the yard density iteration + the vista diagnostics), plus
~120K on the mid-cycle machine-slowdown investigation + framework fix (outside the campaign's
scope but charged to the session). Campaign ledger: ~800K / 10M, cycle 4/50.

## Iteration-discipline self-check (rule 8)
PASS (systems bar + one hero moment). The colossal-ribcage landmark shot is a genuine hero read
achieved through existing art at scale (screenshot-verified player-eye); the regional-yard look
went through 3 diagnose rounds (shot → suspected missing bake → vertex-color diag proved the bake
→ density identified as the real gap → ×6 + a logged cluster-read polish item). No visual element
shipped blind.
