# Session ACAI — Kickoff Brief

## Read these now (in order)
1. `CLAUDE.md` (auto-loaded) — esp. "Where we are now" (ACAH last-shipped + the ACAI lane options).
2. `docs/session-end-report.md` — cumulative state (ACAH at top).
3. `docs/backlog.md` — open items (the ACAH-shipped block is marked ✓; the deferred big features remain).
4. `docs/decisions.md` — tail D177-D180 (D177 game-wide shader-cache fix, D178 loot bootstrap, D179 vulture creature, D180 mounted-player-at-y=-2000 gotcha).
5. `docs/roadmap.md` — "Recently shipped" (ACAH) + "Up next".
6. `docs/architecture.md` — read before touching terrain/collision (cave lane) or wreck/salvage (mega-wreck lane).

## What's already built
Post-MVP survival sandbox (100+ sessions): terrain/biomes, weather (sandstorm wall + procedural clouds + clear↔overcast
+ NEW cloud shadows), day/night, procedural audio, inventory/crafting/cooking, fire/tent/sled/locker/stake/speeder,
lizard/shrew/sandworm/raider/companion + NEW rare **vulture**, a rigged 3P player, salvage POIs (flagships + composite
procgen wrecks with dynamic panels), pulse rifle, a rust pass, a dev item-spawner panel (Backquote toggle). The
**item-model arc is complete**; the **dead-tree** is a recursive camelthorn model with bark grain; the **early-game loot
deadlock is fixed** (scrap scatters around wrecks). All 7 procedural-material factories now honor their per-instance
params (the D177 cache-key fix).

## Session ACAI focus — MEGA-WRECK REBUILD + procgen-wreck overhaul (user-chosen, 2026-06-05)

**The raider proc-character (Cycle 5) is DEFERRED** — the user is undecided on importing an external rigged character, so
hold all rig-dependent work (raider, lie-down-sleep anims, the deferred 3P use-anims) until that's settled.

### (a) MEGA-WRECK REBUILD FROM SCRATCH + procgen-wreck/panel overhaul (DEFAULT — user-chosen)
The hand-modeled mega-wreck (`src/world/megaWreck.ts`) reads too boxy/blocky. **DESIGN FIRST**: gather real references
(crashed spaceship hulls — think Nostromo / star-destroyer wreck / Mad Max salvage), then rebuild with the leveled-up
modelling techniques the camelthorn-tree (D176) + vulture (D179) rebuilds proved out (recursive/organic geometry,
merged-geometry perf, real depth per rule 7, the now-correct per-instance materials post-D177). Preserve the colliders +
all panels + shelter zone + journal (zero gameplay impact — it's a visual lift, like the ABL pass but from scratch). Then
**pair it with the standing procgen-wreck + salvage-panel placement/variation overhaul** (the composite wreck vocabulary
in `procgenWreck.ts`/`wrecks.ts` + the `findPanelMount` sampler D168) so BOTH the hero mega-wreck and the procgen fleet
level up together. **Surface a save bump only if structurally needed (D81 — unlikely; geometry/material only).** Iterate
hard via rig-shot (a NEW `megawreck`/`wreck` scenario), rule 8.

### Smaller interleavables (if the lane finishes early or for variety)
- **Painted-metal rust gap** (quick): `paintMaterial` (speeder body / sled top) has `wearLevel` but no rust layer — add
  a `rustLevel` parallel to the metal shader (D173) so painted surfaces weather too. Now that D177 fixed the cache key,
  per-surface rust will actually render.
- **Sandworm encounter depth**: retreat-and-stalk loop (extend `tickRetreat`) + multi-worm population (needs a save bump
  — surface it).

### Other standing lanes (NOT this session unless the user redirects)
Wreck-yard biome (Cycle 8), ODST drop-pod opening cutscene, DEEP CAVE SYSTEM. Foreground feel-tune (owed ACW/ACX pile +
the NEW vulture flight feel + cloud-shadow strength) needs a human at the keyboard.

## Autonomy contract
Ambiguous → pick the option closest to the GDD pillars + decisions.md realism dial, append a D-entry, continue. Research
real refs before authoring new geometry (the camelthorn + vulture refs paid off). Screenshot-iterate visual work (rule 8
— 5-8 rounds new, 3-5 tuning). Batch genuine D150/feel items for the user's playtest rather than faking verification.

## Stop conditions
Wall-clock ceiling · all-planned-shipped + budget · 3 consecutive fix-walls on one element (log + move on) · catastrophic
block · destructive-git attempt · a save bump turning out necessary (surface it — likely for cave state in lane c).

## Notable footguns
- **D177** — every onBeforeCompile material factory now has a `customProgramCacheKey`; any NEW one MUST too, or it
  silently shares one program. Verify a shader-source change renders (inject a debug fill) before trusting it.
- **D180** — the player capsule parks at **y=-2000 while mounted**; reading `ctx.player.body.body.translation()` while
  mounted gives garbage. Prefer the `getPlayerPos` util (resolves the speeder pos). Audit raw readers if a mounted bug appears.
- **D175/D109** moving meshes need `localSpace` materials · **Rule 7** ≥10cm box decorations · **D81** save fields additive only.
- **Headless harness runs the game clock ~5× slow** (D172) — cadence/flight/timing tests must wait long in wall-clock or
  assert on game-time; in-motion FEEL is foreground-only (D150).
- **Windows harness** — `dev.kill()` can orphan vite; kill the leftover node listener on a strict-port conflict.

## Verification
`npm run verify` (tsc) — must stay clean. Visual: `npm run rig-shot -- --scenario=<name>` (item-studio / vulture / tree /
panels / a new scenario for the lane). Logic: headless evals (see scrap-loot/worm-shelter/vulture-kill for the pattern).
Feel/in-motion: foreground playtest.

## On stop
Run the gamedev-framework `/session-end` (verify → changelog → CLAUDE last-shipped → roadmap → D-entries → backlog →
report → next-prompt → post-mortem → commit + tag `session-ACAI` + push to master).

## Pending from prior sessions
Framework post-mortem drafts may sit in `~/projects/gamedev-framework/.post-mortem-pending/` — `/consolidate-shared-memory`
(needs the user) to merge/reject. The D177 "audit ALL onBeforeCompile factories, not just the one you noticed" lesson is a
strong post-mortem candidate (extends the D175 canon).

## Begin
Read the order above → confirm tsc clean → **lane (a): MEGA-WRECK rebuild from scratch + procgen-wreck/panel overhaul**
(user-chosen ACAH). DESIGN/reference-gather first, then build + screenshot-iterate (rule 8); preserve colliders/panels/
shelter/journal. → TaskCreate the plan → start. (Raider + all rig-dependent work is deferred until the external-character
decision is made.)
