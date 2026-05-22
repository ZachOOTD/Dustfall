# Next Session — Kickoff Brief (post-AAP)

## Read these now (in order)

1. `CLAUDE.md` (auto-loaded)
2. `docs/session-end-report.md` — cumulative state through AAP
3. `docs/changelog.md` — AAP + AAO entries at top
4. `docs/decisions.md` — D91 (sandworm dune-rejection sampler), D92 (procedural music separate from sample stems); also D88 (hover-wins crosshair), D89 (toast.kind variants), D90 (companion reads world-truth intensity).
5. `docs/roadmap.md`
6. `docs/backlog.md`

## What's already built

43 sessions. The overnight era + AAA-AAP all shipped. Per-seed worlds (AAI/AAK), opening wreck polished (AAJ), project-wide audit (AAL), fire grill multi-cook (AAM, SAVE_VERSION v10), systems-review quick-wins (AAN), flagship paper-thin + grill HUD + companion huddle (AAO), sandworm overhaul + atmospheric music (AAP). Codebase: tsc clean, 0 `as any`, 14 recipes (next id 15), 5 placeable kits + grill + companion. **Sandworm is now procgen-placed + noise-aware** (no more world-edge test-fix). **Atmospheric music finally exists** (3 procedural Web Audio tracks crossfaded by sun + storm).

## Suggested focus (pick one)

AAP closed two long-deferred backlog items. Remaining big-ticket lifts are mostly architectural (infinite chunks) or design-heavy (trading, POI overhaul).

### Big-ticket (recommended for a long block)

- **Infinite chunk streaming** (still queued from post-AAI). Generate 800m chunks lazily as player approaches boundary; free farthest chunks. Per-chunk seed derivation (hash from worldSeed). GPU memory budget. Save bump v10→v11 (chunk state + placed-flagships set). ~6-10h. The last major architectural lift the project hasn't tackled.
- **Salvage mechanics overhaul** — current loop is "hold-E on panel → roll loot table." Add: tool requirements (scrap-bar to lever; fire-starter to thermal-cut), per-panel rarity tiers, salvage condition decay over time, risk/reward (loud salvage attracts raiders or worm — AAP's noise detection makes this concrete). ~5-7h with playtest.
- **POI overhaul** — themed clusters (military convoy, refugee caravan, comm-relay), per-POI narrative beats. Builds on AAI/AAK rejection sampler. ~5-7h.
- **Trading / NPC economy** — design exploration first; warrants a planning pass.

### Medium picks (~2-3h)

- **Multi-worm population** (AAP scope-cut). Extend `ctx.sandWorm` from singleton to array. Per-worm min-separation. Save schema bump (additive `sandWorms?: SavedSandWorm[]` field; legacy `sandWorm?` field stays for v10 saves).
- **Tutorial coverage refresh** — grill_kit, companion_pod, RMB context actions, sled cargo don't have prominent first-discovery hints.
- **Scrap_gun reload action** — AAN added the empty crosshair; closing the loop needs a real reload UX + SFX.
- **Music playtest tuning** — AAP shipped without in-play tuning. After a real play session you'll know which track is too loud / too sparse / wrong key. Adjust the per-track target gains + motif cadences.
- **Sandworm encounter polish** — AAP shipped procgen spawn + noise detection. Encounter beats (ambush state, retreat-and-stalk loop) need design + iteration.

### Quick polish (~30-90min)

- **Saved companion huddle state** — AAO huddle resets on load. Save schema additive bump if persistence matters.
- **Stamina tow factor playtest** (backlog from AAL).
- **poi.ts scavenger-camp magic-number lift** — deferred from AAO; would happen alongside scavenger-camp rework.
- **Satellite dish backing geometry / engine block back panel**.

## Autonomy contract

When ambiguous, pick the option closest to the GDD pillars + decisions.md realism dial (D45+, D49, D67, **D86 cook-list, D87 seed-check, D88 hover-wins, D89 toast-kind, D90 weather-intensity-for-AI, D91 dune-rejection-sampler, D92 procedural-music**), append a new D-entry, keep going. The user has authorized "work without stopping for clarifying questions, make the reasonable call and continue; they'll redirect if needed."

Stop conditions: wall-clock limit, 3-strike fix wall, catastrophic block (tsc broken in main, dev server crashes), destructive-action attempt.

## Notable footguns (carried + new)

- **AAP music tracks are continuous oscillators** — `startMusic()` starts oscillators that never stop until the page unloads. HMR cycles will leak nodes. Mostly fine in dev; hard-reload if music gets weird.
- **Sandworm `Tuning.SANDWORM_HOME_POS = (900, 0)`** is the LEGACY FALLBACK ONLY post-AAP. Production reads sampled position. Don't revert main.ts's `sampleSandwormHome` call without re-checking spawn-exclusion math.
- **AAP's noise multipliers** scale the 150m radius. Default product = 82.5m (still) to 277.5m (mounted). If you change `SANDWORM_DETECTION_RADIUS`, the multipliers compose multiplicatively — sanity-check the scaled range.
- **Soundscape's sample-stem music layer is silent in production** (no .ogg pack ever shipped) but the architecture is preserved per D92. If you add .ogg files, both layers will play simultaneously — add a toggle then.
- **`_cooks` is module-level state in interaction.ts** — survives HMR badly.
- **Save schema is v10** — additive `hasGrill?: boolean` per fire. Pre-v10 saves load with hasGrill=false. Recipe id stability per D71 — next id is 15.

## Verification protocol

```
npm run verify     # = tsc --noEmit
```

For substantial features:
1. Boot game, exercise the feature (use `__game.ctx` / `__game.musicState()` / `__game.audioState()` console handles).
2. Save + reload roundtrip if persisted state changed.

## Begin block

Read CLAUDE.md (auto), session-end-report, AAO/AAP changelog. Pick focus — infinite chunks is the biggest remaining architectural lift; salvage overhaul or POI overhaul are the natural "deepen what's there" picks. TaskCreate sub-tasks. Start coding.
