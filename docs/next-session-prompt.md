# Next cycle (3) — the research swarm (4 digests)

**State:** campaign "Scavenger's Economy (setup)" `active` on `campaign/2026-07-17-economy`
(2 cycles done, ~0.75M/6M spent, max-cycles 16). Checkpoint = pause at the economy proposal.
Self-author = none. **Plan of record: `docs/campaign/plan-2026-07-17.md` — do NOT re-plan.**

## The fixed queue (in order)
1. ~~#28 Skyfall stern seam~~ ✅ SHIPPED (009ccca)
2. ~~#29 Boneyard scatter overhaul~~ ✅ SHIPPED (e90344b)
3. **Research swarm (4 digests)** ← THIS cycle
4. Economy proposal → PAUSE

## Model split (Zach steering, in force)
Fable for thinking/planning (the main loop — including the cycle-4 proposal synthesis);
**Opus (`model: opus`) for execution subagents**. Researchers stay on the framework's cheap
researcher model (information gathering per the approved plan).

## Cycle 3 mission — 4 research digests to docs/research/
Fan out via `/research-topic` / the `game-researcher` agent. **This is the sanctioned parallel
exception**: read-only researchers, each writing ONLY its own `docs/research/<topic>.md` — safe to
run concurrently. No source-code changes this cycle.

1. **`crafting-improvements`** — survival-crafting material/recipe taxonomies (Long Dark, Rust,
   Subnautica + any strong desert/scavenger analogues) AND concrete ways to improve Dustfall's
   CURRENT bench-free crafting (recipe depth, discovery flow, material identity, inventory
   pressure). Constraint to honor: crafting stays BENCH-FREE (locked). This digest FEEDS cycle 4's
   economy proposal — bias toward actionable taxonomies + a leaner-set recommendation (~4-5
   materials building on the existing `scrap`), per-POI loot identity ideas, and recipe patterns.
2. **`multiplayer-architecture`** — co-op over Dustfall's seed+descriptor deterministic world:
   Colyseus-style hosted server vs P2P/relay; state sync for chunkDiffs/creatures/physics
   authority; what 2-4-player co-op needs vs many-player. Note the GDD currently FORBIDS MP — this
   is decision support for the re-anchor, not a commitment.
3. **`character-pipeline`** — procedural-rig ceiling-push vs imported rigged glTF (which would
   break the zero-asset pillar D1/D107); skinning/cloth/animation options in Three.js for each
   fork; what a 2-4-co-op remote-player silhouette minimally needs.
4. **`cave-feasibility`** — cave-gen methods compatible with Rapier heightfield terrain (room-kit
   under a carve vs tunnel-carving vs hand-authored modules); the D254 open question (can the KCC
   walk BELOW the heightfield sheet and back?); dark-nav/torch-economy reference (Long Dark).
   Flag clearly that a 10-min ATTENDED spike must precede any cave build.

**Done =** all 4 digests exist in `docs/research/`, each structured (sources, findings, options
with trade-offs, a recommendation, open questions). Commit them. No gates needed beyond tsc-noop
(no source changes) — but run `npm run verify` once anyway as the cheap invariant.

## Then cycle 4 (the LAST before the pause)
Synthesize digest 1 + the current inventory/recipe code into `docs/campaign/economy-proposal.md`
(leaner ~4-5 material set, 1-page recipe/drop matrix w/ per-POI identity, crafting-UX
improvements). **Bake NO ItemIds, change NO loot tables.** Then set `awaiting_approval: true`,
`stop_reasons: ["milestone-review"]`, write the morning summary, STOP the loop.

## Hard rules
Never `git stash` here · one code-writing agent at a time (read-only researchers exempt) · no
AskUserQuestion overnight · push HELD.
