# Next Session — Kickoff Brief (post-AAI)

## Read these now (in order)

1. `CLAUDE.md` (auto-loaded)
2. `docs/session-end-report.md` — cumulative state through AAI
3. `docs/changelog.md` — read AAH / AAI entries at the top
4. `docs/decisions.md` — D82-D85 (the AAI procgen + seed decisions). Also D71 (recipe id stability — next recipe is id 15), D81 (save migration additive only — SAVE_VERSION is now v9).
5. `docs/roadmap.md`
6. `docs/backlog.md`

## What's already built

36 sessions. Per-seed worlds within the 2400m grid now shipped (AAI):
auto-roll on NEW GAME, custom seed via Advanced UI, 6 flagship POIs +
procgen wrecks all rejection-sampled per seed, opening scene as
seed-stable anchor. Codebase: tsc clean, 0 `as any`, SAVE_VERSION 9
(unchanged — v9 already had `seed: number`), 14 recipes, 5 placeable
kits + companion. Atmosphere stack: mirage shader, dust motes,
footprint puffs, god-rays, perceivedIntensity-driven visuals + audio.

## Suggested focus (pick one)

The natural next architectural lift is **infinite chunk streaming**
(Minecraft-style). AAI's per-seed contract is the foundation; this
session would extend to per-chunk seed derivation + JIT chunk load/
unload + GPU memory budget. Big lift (6-10h).

### Big-ticket (recommended for a long block)

- **Infinite chunk streaming**. Today: 3×3 fixed grid loaded at boot,
  world span 2400m, hard horizon at chunk-band edge. Goal: when player
  approaches world boundary, generate the next 800m chunk lazily +
  free oldest/farthest chunk. Architecture:
  - Per-chunk seed: `chunkSeed(x, z) = hash(worldSeed, chunkX, chunkZ)`
    using a fast 32-bit mix (e.g., MurmurHash3 finalizer).
  - Chunk lifecycle: `loadChunk(x, z)` → terrain + colliders + scatter
    + maybe POI. `unloadChunk(x, z)` → dispose meshes + colliders.
  - Frame budget: cap chunk generation cost to ~16ms; spill across
    frames if over.
  - GPU memory: track chunk count, evict farthest when above threshold
    (default 49 = 7×7 around player; 5.6km × 5.6km loaded radius).
  - POIs per-chunk: each chunk gets 0-2 procgen wrecks via per-chunk seed.
    Flagship POIs become "spawn once" at a deterministic chunk; subsequent
    visits don't re-spawn. (Tracked via `placedFlagships: Set<string>`
    persisted in save.)
  - Save schema bump v9 → v10: chunks-loaded-state, placed-flagship-chunks set.
  - Open questions: lizard population — keep per-chunk or world-wide?
    Sandworm — single boss-tier, where does it live in infinite world?

### Medium picks (2-3h)

- **AAI multi-seed playtest pass**. Boot 5+ different seeds, screenshot
  opening views + walking tours. Surface tuning issues (flagship density,
  scatter clutter, biome distribution unevenness). Tune Tuning constants.
- **Fire grill attachment** (backlog from AAG). Craftable add-on; multi-
  slot cook state per fire. Lift `_cooking` module var to
  `fire.cookSlots: Array<CookState>`. Save schema v9 → v10 (additive).
  Recipe id 15 (next per D71). 4 metal cross-bar mesh on fire ring.
- **First-recipe-discovery fanfare**. Recipe-book modal exists (AAA) but
  discovery is just a toast. Add icon scale-up + screen flash on first
  craft.
- **Trading / NPC economy** — design exploration; warrants planning pass.

### Quick polish (~30-90min)

- **Seed display in pause overlay too**. AAI puts the seed in the H-key
  controls panel; the pause overlay (Esc) doesn't show it. Players pause
  more than they hit H — copy the seed line there.
- **More CLAUDE.md rule-2 sweeps**. AAH cleaned 2 violations; there
  may be more in older modules (`raider.ts`, `sandWorm.ts`, etc.).
- **Companion pathing polish** (AAE follow-on). Recently re-playtest
  the rolling→walking→idle state machine; does companion path
  smoothly around obstacles?

## Autonomy contract

When ambiguous, pick the option closest to the GDD pillars + decisions.md realism dial (D45+, D49, D67, **D82-D85**), append a new D-entry, keep going. The user has authorized "work without stopping for clarifying questions, make the reasonable call and continue; they'll redirect if needed."

Stop conditions: wall-clock limit, 3-strike fix wall, catastrophic block (tsc broken in main, dev server crashes), destructive-action attempt (push --force, reset --hard, etc.).

## Notable footguns (from AAI + recent sessions)

- **`scatterRand` consumption order matters for determinism.** AAI's
  `sampleFlagshipPositions` consumes scatterRand BEFORE `placeProcgenPOIs`.
  Changing this order would silently reshuffle every existing seed's
  scatter layout. If adding new procgen passes, append at the end
  (or document the reshuffle).
- **First-ever boot inline-rolls a random seed.** The `Tuning.RNG_SEED = 1337`
  fallback (D85) is only hit when localStorage is pre-seeded to 1337.
  Devs who want a known world: `localStorage['dustfall.pendingSeed'] = '1337'; location.reload()`.
- **NEW GAME with save existing → always reloads.** No way to "play
  the current world" if save already exists; it's always a fresh seed
  unless the user enters one in Advanced.
- **flagship rejection sampler can fail** (rare — 6 flagships in 2400m at
  250m min-sep is well within budget). Fallback ignores min-sep but
  still respects spawn exclusion. If 3-strike walls land here, may need
  to relax POI_MIN_SEPARATION or split the sampler into multiple passes.
- **`_placedFlagshipPositions` is module-level state in poi.ts.** Vite HMR
  re-imports leave this stale. Hard-reload on poi.ts edits.
- **mega_ship/mega_wreck have their own flat-spot drift** (up to 60m).
  After rejection sampling picks a position, the actual placement may
  drift; min-separation is checked against the picked position, not
  the drifted one. Worst-case violation is rare but possible.
- **Save schema is v9.** v9 → v10 is fine if needed (additive only per
  D81). Recipe id stability per D71 — next id is 15.

## Verification protocol

```
npm run verify     # = tsc --noEmit
```

For substantial features:
1. Boot game, exercise the feature (use `__game` console handle).
2. Save + reload roundtrip if persisted state changed.
3. For seed-related work: boot multiple seeds via `localStorage['dustfall.pendingSeed']`; confirm same-seed → identical world; verify `ctx.seed` matches the entered value.

## Begin block

Read CLAUDE.md (auto), session-end-report, AAH/AAI changelog. Pick focus
from the suggestions (infinite chunks recommended). TaskCreate sub-tasks.
Start coding.
