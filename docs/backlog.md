# Backlog

Unprioritized ideas, bugs, polish, debt. Tags:

- `[bug]` — something broken or visibly wrong
- `[feat]` — new gameplay or mechanic
- `[polish]` — feel, UX, visual refinement
- `[debt]` — code cleanup, refactor, doc improvement
- `[idea]` — speculative, needs validation before promotion

When ready to ship one, promote it into a session in [roadmap.md](roadmap.md).
Use `/triage-ideas` to bulk-classify a free-form dump.

---

<!-- entries below this line — newest at the bottom -->

[idea] procedural world: POIs + objects randomized per new-game seed
[feat] atmospheric music tracks for day, sandstorm, and night
[feat] base-building mechanics
[feat] small red creature companion — follows player, pocketable into backpack, re-deployable
[idea] remove HUD stat bars in favor of audio/visual/text cues ("you could use a drink")
[feat] sandworm overhaul — AAL moved home to (900, 0) at world edge as a quick test fix. Real overhaul: procgen biome-seeded spawn (dune-biome rejection sampler, like wells in salt); possibly multiple worms per world; smarter detection (sound-based? footstep cadence?); deeper encounter design beyond "sees player → charges"
[feat] satellite dish structural-framework backing geometry — visible from above when player approaches from the convex side; currently uses DoubleSide as a known cheat (documented in satelliteDish.ts AAL comment)
[feat] engine block heat shield back panel — modeled thickness instead of FrontSide-only (AAL switched DoubleSide → FrontSide; back face is mostly occluded but a thin back layer would improve oblique-angle reads)
[idea] stamina tow factor playtest — current 2.0× drain discourages sled travel; audit flagged this; needs in-play signal before tuning
