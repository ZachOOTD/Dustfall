# Dustfall — Session-end report

Cumulative state. Rewritten (and pruned) at each `/session-end`. Per-session detail lives in
`docs/changelog.md` (append-only); per-cycle campaign detail in `docs/campaign/campaign-log.md`.

## Current state (2026-07-11)

**The game is a complete, playable, shippable browser + desktop survival game.** The escape-pod
intro is the **released opening** (LIVE at https://zachootd.github.io/Dustfall/); a Tauri v2
desktop build exists.

**⚙ ACTIVE CAMPAIGN — "Infinite Sands"** (infinite procgen, overnight-autonomous, branch
`campaign/2026-07-10-procgen`, 50-cycle / ~10M-token ceilings, ONE sanctioned pause at S5).
**S1+S2+S3 shipped (cycles 1-3). S4 (distributed landmarks + per-region biomes) is next**, then S6
perf, then ⏸ S5 save-schema (the pause). Ladder detail: `docs/roadmap.md` "Up next".

**Cycle 3 (this session) — S3 scatter + ambient life (D294):** the far field is inhabited.
- **Rocks**: 7 descriptor candidates/chunk on a dedicated stream, kept only on rocky biome (boot
  density match), culled off scene stages at the descriptor level; rendered via NEW
  `makeScatterRock`; per-rock geometry chunk-owned/disposed; boot loop untouched (its inline
  draws feed the shared boot stream that defines every boot creature id — sacred).
- **Wordless scenes**: rare rolls (0.02/chunk) via NEW `buildWordlessTableau`; decoration-only.
- **Fauna (chunk-keyed, D294)**: each streamed wreck rolls a prey cluster (1-2 lizards +
  0-2 shrews, salt-skipped) spawned via the REAL `spawnLizard`/`spawnShrew` on load, despawned on
  unload (NEW `despawnLizard`; looted ones skip), `transient`-excluded from saves (D292 rule).
  NO separate active-ring system — the chunk IS the ring. **Vultures deferred** (placement model
  fights chunking; backlog).
- **Probe upgrades**: full-ring descriptor↔render equality (POIs/rocks/fauna); a fauna-site walk
  leg (the straight path landed on all-salt POIs — the fauna path can't ship unexercised);
  population-baseline asserts with ambient predators QUIETED (circling vultures grabbed 2 boot
  lizards mid-walk and read as a leak); vista rock-field + scene shots.

**Verify baseline:** `verify:all` (tsc, placement ×5 seeds, colliders 55, chunks) + 5 smoke gates.
**All 10 green in ONE pass this cycle, zero flakes** (streaming: bodies 332→332 exact, farRocks
46/46, farPois 2/2). Save schema v16 untouched.

## What works end-to-end
Single-player: intro → the open desert loop (survive, scavenge, craft, camp, hunt, sled/speeder,
wreck-yard + Sarlacc + cave). Continue restores a real save. Browser + desktop. **The infinite
field now has wrecks with working salvage, rocky-biome rock scatter, rare wordless-scene
vignettes, and prey clusters at wrecks — all deterministic, all leak-clean, forever in any
direction.** Missing out there: rare hero landmarks + per-region biomes (S4), far-field vultures
(deferred), persistent far-field changes (S5).

## Known issues / partials
- Streamed content is regenerate-pristine on reload until S5 (D292 — documented v1 semantics).
- No far-field vultures (D294 defer, backlog); prey only clusters at wrecks (density knob noted).
- Terrain tile bake frame-blocks at ring crossings (S6's rung, D288).
- The §A owed human walk-tests pile (`docs/backlog.md`) is unchanged.

## Constants / knobs (new this cycle)
`CHUNK_ROCK_CANDIDATES` (7), `CHUNK_WORDLESS_CHANCE` (0.02), `CHUNK_POI_LIZARDS_MAX` (2),
`CHUNK_POI_SHREWS_MAX` (2).

## Suggested next
1. **Cycle 4 = S4 distributed rare landmarks + per-region biomes** (brief in
   `docs/next-session-prompt.md`) — hero destinations for the infinite field; the Skyfall
   plug-in point.
2. Then S6 (perf: frame-budgeted tile bake + cross-chunk perf probe) → ⏸ S5 (save, the pause).
3. After the campaign: the parked Skyfall plan-review.

## State at session end
- **Git:** `campaign/2026-07-10-procgen`; cycles 1-3 committed (`e82d9a7`, `ad49dc0`, cycle 3's
  SHA in campaign-log). `master` untouched, nothing pushed.
- **Save:** v16 untouched. **Machine:** calm this cycle (5 node processes) — the whole suite ran
  green first-pass; the D291/D293 hardening held.

## Time + token spend
Cycle 3 ≈ 170K output tokens (research agent + build + one probe-fix round: the vulture-predation
false-fail + the fauna-leg addition). Campaign ledger: ~600K / 10M, cycle 3/50.

## Iteration-discipline self-check (rule 8)
PASS (systems bar). New visual surface renders through existing prop builders (rocks, tableaux,
creatures — the same meshes the origin field ships); the appearance gate ran as placement-sanity
(3 new player-eye shots: rock field, watcher tableau, wreck+fauna area — all seated, no floats).
No hero bar applies.
