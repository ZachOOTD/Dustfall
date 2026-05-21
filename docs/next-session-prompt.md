# Next Session — Kickoff Brief (post-AAG)

## Read these now (in order)

1. `CLAUDE.md` (auto-loaded)
2. `docs/session-end-report.md` — cumulative state through AAG
3. `docs/changelog.md` — read AAF / AAG entries at the top
4. `docs/decisions.md` — D73-D81. Especially D71 (recipe id stability — next recipe is id 15), D75 (PLACEMENT_DISTANCE_M), D81 (save migration additive only — SAVE_VERSION is now v9).
5. `docs/roadmap.md`
6. `docs/backlog.md`

## What's already built

34 sessions. The overnight era + AAA/AAB/AAC polish/depth/home + AAD playtest polish + AAE creature companion + AAF storm countdown + AAG atmospheric polish all shipped. Codebase: tsc clean, 0 `as any`, SAVE_VERSION 9, 14 recipes, 5 placeable kits (fire/tent/large-tent/sled/bedroll/lantern/locker — and `companion_pod` as a deployable creature). Atmosphere is at its richest yet (mirage shader, dust motes, footprint puffs, god-rays inside opening wreck, perceivedIntensity-driven storm visuals + audio).

## Suggested focus (pick one)

The biggest remaining architectural lift is **procedural world generation** — POIs randomized per new-game seed. The user has called this out twice as "the logical next step" with the caveat "need to put in the work to get it right." This is a meaty session (likely 5-8h on its own) and merits a planning pass before coding.

### Big-ticket (recommended — pick if you have a long block)

- **Procedural world generation** (`[idea]` from backlog). Currently the world is procgen-flavored (chunks + biomes from FF/GG/HH) but POI layout is hand-placed (opening wreck, satellite dish, engine block, etc.) plus the procgen wreck rejection-sampler from HH. Goal: every new-game seed produces a freshly-shuffled POI layout — pickup distribution, wreck variety, biome shapes, scatter density all derive from `seed`. Save the seed in v10 (additive). Open questions to settle before coding: does the opening scene stay seeded-fixed (so the player's spawn experience is stable) or also randomize? Does the satellite-dish + engine-block + opening wreck pair count stay constant (one each) or randomize? Recommend keeping the opening fixed + flagship POIs constant-count to preserve narrative arc, but randomize positions + procgen-wreck distribution.

### Medium picks (2-3h)

- **Fire grill attachment** (the deferred AAG item). Craftable add-on; multi-slot cook state on fire instead of single `_cooking` module var. Lift `_cooking` to per-fire `fire.cookSlots: Array<CookState>`. Save schema bump v9 → v10 (additive). New recipe (id 15 — suggest scrap×2 + branch×2). Grill mesh = 4 metal cross-bars sitting on the fire ring. Each slot independently cooks one item; LMB on fire while wielding raw food places it in the next empty slot. Player gets parallel cooking — feeds the "set up camp + cook your day's haul" loop.
- **First-recipe-discovery fanfare**. The recipe-book modal exists (AAA) but discovery is still a toast. A visual flourish on first craft (icon scale-up + screen flash?) would make the moment land.
- **Trading / NPC economy** — design exploration (probably warrants a dedicated planning session before code).
- **Bounties** — design exploration (template: D39 `'mount'` singleton-interactable pattern from CC-2).

### Quick polish (~30-90min)

- **Playtest pass on AAG additions.** Walk the salt-flats at midday and confirm the mirage feels right; sprint through dunes and check footprint puffs are visible but not over-the-top; force the bag full and verify the swap UX feels good with a heavy held item vs a stack of light ones. Surface anything off and fix in a 30-60min polish pass.
- **Mirage shader tuning** — the current 0.18m peak amp + 15-80m distance band might need playtest adjustment. Cheap if the math is solid but reads "too much/too little."
- **Companion polish** — re-playtest from AAE. Does it path well around obstacles? Does the ROLLING→WALKING transition feel smooth?

## Autonomy contract

When ambiguous, pick the option closest to the GDD pillars + decisions.md realism dial (D45+, D49, D67), append a new D-entry, keep going. The user has authorized "work without stopping for clarifying questions, make the reasonable call and continue; they'll redirect if needed."

Stop conditions: wall-clock limit, 3-strike fix wall, catastrophic block (tsc broken in main, dev server crashes), destructive-action attempt (push --force, reset --hard, etc.).

## Notable footguns (from AAG + recent sessions)

- **`_shaderRefs` is a module-level Set** — if Vite HMR re-imports terrainMaterial.ts, the existing shaders won't be in the new module's Set. Hard-reload the preview tab after touching that module. (Generic Vite-HMR rule that bites repeatedly across the codebase — see also `_chargeStartedAt` in combat.ts, `_cooking` in fire.ts, `_salvaging` + `_pickupSwap` in interaction.ts.)
- **`controller.ts` footstep block fires on the player's left+right alternation** — `spawnFootprintPuff` is called twice per stride, not once. If you adjust pool size or burst count, account for that.
- **`updateInteraction` resets `ctx.inventory.hover` at the top of every frame, then re-raycasts.** Test mocks that set hover state get wiped before any downstream code reads them — call the downstream code path directly with a constructed hover, or hook into a verification-only path that snapshots before reset.
- **Save schema is v9.** v9 → v10 is fine if the next session needs a new persisted field (additive only per D81). Recipe id stability per D71 — next id is 15. Do NOT bump `SAVE_VERSION` for runtime-only state.

## Verification protocol

```
npm run verify     # = tsc --noEmit
```

Then for substantial features:
1. Boot game, exercise the feature (use `__game` console handle for state forcing).
2. Save + reload roundtrip to confirm no schema regression.
3. If touching atmospherics (vignettes, dust, shader): high-sun + storm-peak both, since masks gate behavior.

## Begin block

Read CLAUDE.md (auto), session-end-report.md, the AAG changelog entry. Pick a session focus from the suggestions above (procgen recommended). TaskCreate the sub-tasks. Start coding.
