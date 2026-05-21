# Next Session — Kickoff Brief (post-AAH)

## Read these now (in order)

1. `CLAUDE.md` (auto-loaded)
2. `docs/session-end-report.md` — cumulative state through AAH
3. `docs/changelog.md` — read AAG / AAH entries at the top
4. `docs/decisions.md` — D73-D81. Especially D71 (recipe id stability — next recipe is id 15), D75 (PLACEMENT_DISTANCE_M), D81 (save migration additive only — SAVE_VERSION is now v9).
5. `docs/roadmap.md`
6. `docs/backlog.md`

## What's already built

35 sessions. The overnight era + AAA/AAB/AAC polish/depth/home + AAD playtest polish + AAE creature companion + AAF storm countdown + AAG atmospheric polish + AAH AAG-polish all shipped. Codebase: tsc clean, 0 `as any`, SAVE_VERSION 9, 14 recipes, 5 placeable kits + companion_pod as deployable creature. Atmosphere is rich (mirage shader, dust motes, footprint puffs, god-rays, perceivedIntensity-driven visuals + audio).

## Suggested focus (pick one)

The next-most-likely architectural lift is **procedural world generation** — POI layout randomized per new-game seed. The user has called this out twice as "the logical next step" with the caveat "need to put in the work to get it right." This is meaty (5-8h) and merits a planning pass.

### Big-ticket (recommended — pick if you have a long block)

- **Procedural world generation** (`[idea]` from backlog). World is procgen-flavored (chunks + biomes from FF/GG/HH) but POI layout is hand-placed (opening wreck, satellite dish, engine block) + procgen wreck rejection-sampler. Goal: every new-game seed produces a freshly-shuffled POI layout. Save the seed in v10 (additive). Open questions: does the opening scene stay seed-fixed (so the player's spawn experience is stable)? Recommend keeping opening fixed + flagship POIs constant-count, randomize positions + procgen wreck distribution.

### Medium picks (2-3h)

- **Fire grill attachment** (deferred AAG item — backlogged). Craftable add-on; multi-slot cook state on fire instead of single `_cooking` module var. Lift `_cooking` to per-fire `fire.cookSlots: Array<CookState>`. Save schema bump v9 → v10 (additive). New recipe id 15. Grill mesh = 4 metal cross-bars on the fire ring.
- **First-recipe-discovery fanfare**. The recipe-book modal exists (AAA) but discovery is still a toast. A visual flourish on first craft (icon scale-up + screen flash?) would make the moment land.
- **Trading / NPC economy** — design exploration (probably warrants a dedicated planning session before code).

### Quick polish (~30-60min)

- **AAH validation playtest**. The AAG polish tweaks (puff height, motes opacity, swap snappier, mirage near-edge, storm cross-fade) were tuned from math + brief preview-tool verification. Walk through each in real play and confirm; revert any that feel off.
- **More CLAUDE.md rule-2 sweeps**. Search src/ for hardcoded magic numbers in modules with no Tuning import — there are likely more violations from older sessions that AAH only fixed the 2 obvious ones.
- **PointsMaterial constants in footprintPuffs** — color `0xb89878`, size 0.10, opacity 0.55 are still inline. Lift if iterating on look. (Scope-cut from AAH plan.)

## Autonomy contract

When ambiguous, pick the option closest to the GDD pillars + decisions.md realism dial (D45+, D49, D67), append a new D-entry, keep going. The user has authorized "work without stopping for clarifying questions, make the reasonable call and continue; they'll redirect if needed."

Stop conditions: wall-clock limit, 3-strike fix wall, catastrophic block (tsc broken in main, dev server crashes), destructive-action attempt (push --force, reset --hard, etc.).

## Notable footguns (from AAH + recent sessions)

- **`_shaderRefs` is a module-level Set** — Vite HMR re-imports of terrainMaterial.ts will leave old shaders orphaned. Hard-reload the preview tab after touching that module.
- **`controller.ts` footstep block fires twice per stride** (left+right) — spawnFootprintPuff is called twice, not once per "step." Account for this in pool sizing or pile-up reasoning.
- **First-boot NEW GAME auto-shows the tutorial controls panel** (`#controls-panel`). For preview eval that depends on view of the scene, dismiss it (key H, or `.classList.add('hidden')`) before screenshotting.
- **Mirage shader templates the amp/distance/sun masks into shader source at material-construction time** — runtime constant-change requires a hard reload, not just HMR.
- **`PICKUP_SWAP_DURATION_S` is now Tuning** (was module-local in interaction.ts pre-AAH). Code paths reference `Tuning.PICKUP_SWAP_DURATION_S` not the old `PICKUP_SWAP_DURATION` symbol.
- **Save schema is v9.** v9 → v10 is fine if needed (additive only per D81). Recipe id stability per D71 — next id is 15.

## Verification protocol

```
npm run verify     # = tsc --noEmit
```

For substantial features:
1. Boot game, exercise the feature (use `__game` console handle).
2. Save + reload roundtrip if any persisted state changed.
3. If touching atmospherics: high-sun + storm-peak both.

## Begin block

Read CLAUDE.md (auto), session-end-report, AAG/AAH changelog. Pick focus from the suggestions (procgen recommended). TaskCreate sub-tasks. Start coding.
