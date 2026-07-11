# Dustfall — Session-end report

Cumulative state. Rewritten (and pruned) at each `/session-end`. Per-session detail lives in
`docs/changelog.md` (append-only); per-cycle campaign detail in `docs/campaign/campaign-log.md`.

## Current state (2026-07-11)

**The game is a complete, playable, shippable browser + desktop survival game.** The escape-pod
intro is the **released opening** (2026-07-05, LIVE at https://zachootd.github.io/Dustfall/), and a
Tauri v2 desktop build exists (Dustfall.exe, unsigned v1).

**⚙ ACTIVE CAMPAIGN — "Infinite Sands"** (infinite procgen, overnight-autonomous, branch
`campaign/2026-07-10-procgen`, max 50 cycles / ~10M-token soft ceiling, checkpoint `none` with ONE
sanctioned pause at S5 save-schema). Charter: `docs/campaign/campaign.md`; slice:
`docs/feature-infinite-procgen.md`; ladder status in `docs/roadmap.md` "Up next".
**S1 + S2 shipped (cycles 1-2). S3 (scatter + ambient life) is next.**

**Cycle 2 (this session) — S2 POI streaming (D292–D293):** wrecks now populate the infinite field.
- `ChunkDesc` gains a fixed-shape `poi` roll from a dedicated per-chunk rng: presence
  `CHUNK_POI_CHANCE` 0.07 (≈ the origin field's density), position inside a 25m chunk-edge margin,
  biome-weighted archetype via the real `pickArchetype`, a fresh `renderSeed`. Chunks inside
  `CHUNK_POI_ORIGIN_EXCLUSION_M` (1250m) roll EMPTY — boot placement owns the origin field.
- `loadChunk` renders the descriptor through the REAL `placeProcgenPOI` (forced archetype, biome,
  `parent: group`): panels mount, salvage registers live (pry/extract works on far wrecks),
  per-POI static merge, declared colliders. `unloadChunk` removes the POI body, splices the
  chunk's salvage entries from the registry, disposes merge-output geometry (shared panel
  geometry + bucket materials are never disposed). `placeProcgenComposite` (the 'ship' delegate)
  now stashes `userData.poiBody` — streamed ships would otherwise have leaked their compound body.
- **Save safety:** streamed wrecks are `transient` — excluded from `save.salvageables`
  (load-order-dependent ids would silently patch the WRONG wreck after reload). v1 semantics =
  regenerate pristine; per-chunk diffs are S5's rung. The streaming gate now SAVES at +1500m with
  streamed salvage live and asserts the file contains only boot ids. Save schema v16 untouched.
- Deliberately skipped for streamed POIs (documented, backlog): scrap-debris rings (pickup ids are
  save-coupled → S5) and horizon silhouettes (module-global registry, no removal path → S4).
- Gate/probe hardening: `verify-chunks.mjs` streaming child timeout 420s→900s (a spawnSync kill
  mid-probe reads as a boot failure AND leaks the child's dev server — D293); probe additions:
  descriptor↔render POI count check, salvage-registry leak assert, world-space content snapshots,
  POI-aware ground-truth ray; `chunk-vista` gains a streamed-POI player-eye shot.

**Verify baseline:** `verify:all` = tsc + placement (5 seeds) + colliders (55) + chunks
(determinism ×2 seeds + cross-seed + the POI-extended streaming walk), plus the 5 rig smoke gates.
All 10 green this cycle (streaming: bodies 332→330, farPois=1 descriptor↔render match,
farSalvage=2, registry back to baseline).

## What works end-to-end
Single-player: New Game → the escape-pod intro → the open desert loop — survive, scavenge wrecks
(pry+extract salvage, 11 procgen archetypes), craft, build camp, hunt/cook, sled/speeder, the
wreck-yard biome + Sarlacc pit + deep cave. Continue restores a real save. Browser + desktop.
**NEW: walking past the old ±1200m edge now yields REAL destinations — biome-weighted wreck POIs
with working salvage stream in deterministically forever** (rocks/scenes/creatures out there
arrive at S3; rare hero landmarks at S4).

## Known issues / partials
- **Streamed-wreck salvage progress is regenerate-pristine** (strip → save → reload = full again)
  until S5's per-chunk diffs — documented v1 semantics (D292), not a bug.
- Streamed wrecks have no scrap ring + no horizon silhouette (deliberate — S5/S4; backlog).
- The far field still has no rocks/wordless scenes/creatures (S3) or rare heroes (S4).
- Terrain tile bake blocks its frame at ring crossings (S6's rung, D288).
- The §A owed human walk-tests pile (`docs/backlog.md`) is unchanged.

## Constants / knobs worth tuning (new this cycle)
`tuning.ts`: `CHUNK_POI_CHANCE` (0.07), `CHUNK_POI_ORIGIN_EXCLUSION_M` (1250),
`CHUNK_POI_EDGE_MARGIN_M` (25).

## Suggested next
1. **Campaign cycle 3 = S3 scatter + ambient life streaming** (brief in
   `docs/next-session-prompt.md`) — rocks + wordless scenes per-chunk; creatures via an active
   ring; FIRST verify how `spawn*Procgen` works (the slice's open ❓).
2. Then S4 (distributed landmarks + biome re-anchor) → S6 (perf) → ⏸ S5 (save, sanctioned pause).
3. After the campaign: resume the parked Skyfall plan-review (S4 landmark).

## State at session end
- **Git:** on `campaign/2026-07-10-procgen`; cycle 2 auto-committed (SHA in
  `docs/campaign/campaign-log.md`; cycle 1 = `e82d9a7`). `master` untouched, nothing pushed.
- **Save:** localStorage v16 (untouched).
- **Machine note:** concurrent load from another project persisted all session — the D291/D293
  timeout hardening exists because of it.

## Time + token spend
Cycle 2 ran leaner than cycle 1 (~180K output tokens est.): the S1 architecture + probes absorbed
most of the new-surface cost; S2 was mostly wiring the REAL placement path onto the existing
lifecycle + probe extensions. One wrapper-timeout diagnosis (D293). Campaign ledger: ~430K / 10M,
cycle 2/50.

## Iteration-discipline self-check (rule 8)
PASS (systems bar, per the charter). New visual surface = streamed wrecks — rendered by the SAME
assemblers/materials the shipped origin field uses, so no new-element polish loop is owed; the
appearance gate ran as placement-sanity (a streamed hollow_husk shot player-eye: seated, sand line
natural, archetype-faithful; plus the four S1 vista angles). No hero bar applies.
