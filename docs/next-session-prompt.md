# Session ACAJ — Kickoff Brief

## Read these now (in order)
1. `CLAUDE.md` (auto-loaded) — esp. "Where we are now" (ACAI last-shipped + the ACAJ mega-wreck pointer).
2. `docs/session-end-report.md` — cumulative state (ACAI at top).
3. `docs/backlog.md` — open items (the ACAH+ACAI-shipped blocks are marked ✓; the deferred big features + the perf/platform follow-ups remain).
4. `docs/decisions.md` — tail D177-D182 (D177 game-wide shader-cache fix, D178 loot bootstrap, D179/D181 vulture, D180 mounted-player-at-y=-2000 gotcha, D182 tree colliders).
5. `docs/roadmap.md` — "Recently shipped" (ACAI) + "Up next" + the near-term priority block (mega-wreck is NEXT).
6. `docs/architecture.md` — read before touching wreck/salvage geometry (the mega-wreck lane).

## What's already built
Post-MVP survival sandbox (100+ sessions): terrain/biomes, weather (sandstorm wall + procedural clouds + clear↔overcast
+ cloud shadows), day/night, procedural audio, inventory/crafting/cooking, fire/tent/sled/locker/stake/speeder,
lizard/shrew/sandworm/raider/companion + a **fully-rigged rare vulture** (perches on real branches, flies tree-to-tree +
re-perches, shot for meat with a dynamic-body death tumble — ACAI), a rigged 3P player, salvage POIs (flagships +
composite procgen wrecks with dynamic panels), pulse rifle, a rust pass, a dev item-spawner panel (Backquote toggle).
The **item-model arc is complete**; the **dead-tree** is a recursive camelthorn model with bark grain + now a trunk
collider; the **early-game loot deadlock is fixed**; all 7 procedural-material factories honor per-instance params (D177).
The buried-cockpit POI was removed (ACAI). Recent **perf wins** (ACAI pre-tier): `compileAsync` boot pre-warm, pickup
geometry-merge (draw calls 2386→~1150), metal material→uniforms.

## Session ACAJ focus — MEGA-WRECK REBUILD + procgen-wreck overhaul (user-chosen, deferred through ACAH+ACAI)

**The raider proc-character (Cycle 5) + all rig-dependent work stays DEFERRED** — the user is undecided on importing an
external rigged character, so hold the raider rebuild, lie-down-sleep anims, and the deferred 3P use-anims until settled.

### MEGA-WRECK REBUILD FROM SCRATCH + procgen-wreck/panel overhaul (the headline)
The hand-modeled mega-wreck (`src/world/megaWreck.ts`) reads too boxy/blocky. **DESIGN FIRST**: gather real references
(crashed spaceship hulls — Nostromo / star-destroyer wreck / Mad Max salvage), then rebuild with the leveled-up modelling
techniques the camelthorn-tree (D176) + vulture (D181) rebuilds proved out (recursive/organic geometry, merged-geometry
perf, real depth per rule 7, the now-correct per-instance materials post-D177). Preserve the colliders + all panels +
shelter zone + journal (zero gameplay impact — a visual lift, like the ABL pass but from scratch). Then **pair it with the
standing procgen-wreck + salvage-panel placement/variation overhaul** (the composite wreck vocabulary in
`procgenWreck.ts`/`wrecks.ts` + the `findPanelMount` sampler D168) so BOTH the hero mega-wreck and the procgen fleet level
up together. **FOLD IN the WebGL perf wreck pass** (backlog §207): the wrecks now dominate draw calls, and you're
rebuilding that geometry anyway — InstancedMesh / geometry-merge the repeated hull pieces + props, distance LODs for far
wrecks. **Surface a save bump only if structurally needed (D81 — unlikely; geometry/material only).** Iterate hard via
rig-shot (a NEW `megawreck`/`wreck` scenario), rule 8 (5-8 rounds for new geometry).

### Smaller interleavables (if the lane finishes early or for variety)
- **Painted-metal rust gap** (quick): `paintMaterial` (speeder body / sled top) has `wearLevel` but no rust layer — add a
  `rustLevel` parallel to the metal shader (D173). Now that D177 fixed the cache key, per-surface rust will render.
- **Finish material-factory → uniforms** (backlog §208): wood/fabric/skin/bone/glass/paint/stone like metal got in ACAI,
  to collapse the ~100 compiled programs → faster real-GPU startup. Do highest-instance first (wood, skin).
- **Sandworm encounter depth**: retreat-and-stalk loop (extend `tickRetreat`) + multi-worm population (needs a save bump —
  surface it).

### Other standing lanes (NOT this session unless the user redirects)
Wreck-yard biome (Cycle 8), ODST drop-pod opening cutscene, DEEP CAVE SYSTEM, desktop packaging (Electron) + WebGPU
exploration. Foreground feel-tune (owed ACW/ACX pile + the NEW vulture in-motion feel + cloud-shadow strength) needs a
human at the keyboard.

## Autonomy contract
Ambiguous → pick the option closest to the GDD pillars + decisions.md realism dial, append a D-entry, continue. Research
real refs before authoring new geometry (the camelthorn + vulture refs paid off). Screenshot-iterate visual work (rule 8 —
5-8 rounds new, 3-5 tuning). Batch genuine D150/feel items for the user's playtest rather than faking verification.

## Stop conditions
Wall-clock ceiling · all-planned-shipped + budget · 3 consecutive fix-walls on one element (log + move on) · catastrophic
block · destructive-git attempt · a save bump turning out necessary (surface it).

## Notable footguns
- **D177** — every onBeforeCompile material factory has a `customProgramCacheKey`; any NEW one MUST too, or it silently
  shares one program. Verify a shader-source change renders (inject a debug fill) before trusting it.
- **D180** — the player capsule parks at **y=-2000 while mounted**; reading `ctx.player.body.body.translation()` while
  mounted gives garbage. Prefer the `getPlayerPos` util (resolves the speeder pos).
- **D182** — `spawnDeadTrees` now needs a `RAPIER.World` param (trunk colliders); any new caller must pass it.
- **D175/D109** moving meshes need `localSpace` materials · **Rule 7** ≥10cm box decorations · **D81** save fields additive only.
- **Headless harness runs the game clock SLOW (~8× wall:sim, D172)** — cadence/flight/timing/settle tests must wait long in
  wall-clock or assert on game-time; in-motion FEEL is foreground-only (D150). The live player-camera overwrites a manually
  set camera each tick when the subject is far from the player — PAUSE before framing a distant subject for a screenshot.
- **Windows harness** — `dev.kill()` can orphan vite; kill the leftover node listener on a strict-port conflict.

## Verification
`npm run verify` (tsc) — must stay clean. Visual: `npm run rig-shot -- --scenario=<name>` (item-studio / vulture / tree /
panels / a new `megawreck` scenario for the lane). Logic: headless evals (see `vulture-flight`/`vulture-kill`/`scrap-loot`/
`tree` for the pattern). Feel/in-motion: foreground playtest.

## On stop
Run the gamedev-framework `/session-end` (verify → changelog → CLAUDE last-shipped → roadmap → D-entries → backlog →
report → next-prompt → post-mortem → commit + tag `session-ACAJ` + push to master).

## Pending from prior sessions
Framework post-mortem drafts may sit in `~/projects/gamedev-framework/.post-mortem-pending/` — `/consolidate-shared-memory`
(needs the user) to merge/reject. Two strong ACAI post-mortem candidates: (1) the heightfield-settle gotcha — a dynamic
body resting on a triangle-mesh heightfield keeps spurious ANGULAR jitter, so settle on LINEAR velocity only (D181); (2)
capture-before-merge — when a generator merges sub-meshes into one geometry, any per-feature anchor data (perch points,
mount points) must be captured DURING generation, not recovered after (D181/T3).

## Begin
Read the order above → confirm tsc clean → **MEGA-WRECK rebuild from scratch + procgen-wreck/panel overhaul** (user-chosen,
deferred through ACAH+ACAI). DESIGN/reference-gather first, then build + screenshot-iterate (rule 8); preserve colliders/
panels/shelter/journal; fold in the wreck perf pass. → TaskCreate the plan → start. (Raider + all rig-dependent work is
deferred until the external-character decision is made.)
