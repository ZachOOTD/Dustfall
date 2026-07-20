# Morning summary — 2026-07-20 (Underworld: THE CAVE IS COMPLETE, ready for your descent)

Your overnight mandate — "high quality realistic cave... don't hold back... fully completed by
morning... and fix whatever was slowing us down" — is done on both counts. Branch
`campaign/2026-07-19-underworld`, ~2.9M/6M, push HELD for your walk-test + ship call.

## The speed fix FIRST (you were right to be annoyed)
The 5-hour greybox was three process bugs: full-boot probes re-run after every tweak, fresh-port
permission prompts sitting blocked, and agents parking in "wait for my watcher" patterns.
Standing SPEED RULES now enforce probe batching, prompt-free npm-wrapped probes, and no waiting.
**Proof: the hero geometry pass took 26 minutes. The whole cave — geometry, darkness, life,
integration, plus two deep generator bug-fixes — shipped in one night.**

## What the cave is now
- **Seamless entrance**: a wind-exposed sinkhole — rubble collar of boulders, rock-veneered
  walls, terrain-blended rim; a warm sun-tracking light shaft falls down the ramp.
- **A real labyrinth**: 8-11 chambers per seed on a branching tree — narrow squeeze corridors,
  galleries, a great hall, pockets — all REAL rock: multi-octave displaced walls with strata
  and mineral staining, ceilings hung with stalactites, stalagmites and full columns, sediment
  pooling in floor dips.
- **True darkness**: past the throat, ambient dies to near-black. No free light — your torch,
  flashlight and lantern are survival equipment now. Faint teal **glowing mushrooms** breadcrumb
  a few chambers (and are harvestable). Cave audio: the desert ducks out entirely; a stone hush
  + sparse echoing drips.
- **THE EGG lives here now**: on a natural rock dais in the deepest, tallest chamber, ringed by
  fungi (the screenshot is worth opening: `verification/scen-cave-walk-egg.png`). The old
  single-chamber funnel is retired. Deep loot caches make the descent pay beyond the egg
  (battery/wiring-rich — the cave is now the best battery source).
- **Ships ON by default** (`VITE_CAVE=0` is the kill-switch). One cave per world, 130-260m from
  origin (verified across 5 seeds) — findable, since it holds the egg objective.

## The bugs the wider gate net caught (and fixed structurally)
Testing beyond the 2 gate seeds found real generator defects: corridors from the same junction
could CROSS each other when branching <55° apart (read as a fake 60° cliff), and corridor ramps
stepped ~1m where they met chamber floors. Both fixed by construction (min sibling angle, flat
floors across chamber disks, run sizing on the true clear span) + a fail-loud dev assert so the
generator can never silently emit an untraversable cave again. **6/6 seeds now fully
traversable** (every chamber reached by a real physics march, in and back out).

## Your walk-test (the feel calls only you can make)
`dustfall-cave` config or plain `npm run dev` (the cave is on by default now) → the **"cave"**
dev button warps to the mouth. Judge: the descent dread · torch economy (is darkness punishing
or dull?) · labyrinth navigability (lost enough? too lost?) · mushroom glow level · drip audio ·
the egg-chamber reveal. Tuning is all CAVE_* data.

## Honest flags
- Mushroom harvest yields `alien_fruit` (reversible data — say the word for something else).
- A pre-existing save that was mid-egg-hunt: the old funnel site is gone; the journal hint now
  points at the cave. Player state carries over untouched.
- The final integration agent stalled on a watcher again (rule now in steering); I completed its
  verification myself — every claim above was re-run or re-derived by me, not trusted.

## After your OK: merge + deploy (+ desktop rebuild), then the roadmap's big forks: character/MP
(research digests ready; needs the GDD re-anchor) — or whatever the walk-test surfaces first.
