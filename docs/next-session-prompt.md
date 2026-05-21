# Next Session — Kickoff Brief (post-AAM)

## Read these now (in order)

1. `CLAUDE.md` (auto-loaded)
2. `docs/session-end-report.md` — cumulative state through AAM
3. `docs/changelog.md` — read AAL / AAM entries at the top
4. `docs/decisions.md` — D86 (cook-list pattern), D87 (loader seed-check bug); also D71 (recipe id stability — next id is 15), D81 (save migration additive only — SAVE_VERSION is now v10).
5. `docs/roadmap.md`
6. `docs/backlog.md`

## What's already built

40 sessions. The overnight era + AAA-AAM all shipped. Per-seed worlds (AAI/AAK), opening wreck polished (AAJ), project-wide audit (AAL), fire grill multi-cook (AAM, SAVE_VERSION v10). Codebase: tsc clean, 0 `as any`, 14 recipes (next id 15), 5 placeable kits + grill attachment + companion. Atmosphere stack rich. Sandworm currently at world edge (900, 0) as a test-only fix — needs procgen biome-seeded overhaul as a future session.

## Suggested focus (pick one)

Several substantial directions remain. The user has tackled feature-by-feature lately (companion, storm countdown, atmospheric polish, procgen, audit, grill). Good moment for a polish pass OR a new big-ticket lift.

### Big-ticket (recommended for a long block)

- **Infinite chunk streaming** (still queued from post-AAI). Generate 800m chunks lazily as player approaches boundary; free farthest chunks. Per-chunk seed derivation (hash from worldSeed). GPU memory budget. Save bump v10→v11 (chunk state + placed-flagships set). ~6-10h.
- **Sandworm overhaul** (deferred from AAL). Procgen biome-seeded spawn via dune-biome rejection sampler (like wells in salt). Possibly multiple worms per world; smarter detection (sound-based, not just radius); deeper encounter design. ~3-5h.
- **Trading / NPC economy** — design exploration first; warrants a planning pass.

### Medium picks (2-3h)

- **AAM grill playtest + cook UX polish**. Confirm 4-cook simultaneity feels right; possibly stagger cook progress visuals so the viewmodel doesn't loop one animation for all 4 cooks. Add cook-progress HUD indicator per active cook.
- **Audio: atmospheric music tracks** (procedural Web Audio). 3 modes (day / sandstorm / night). Slow drones + sparse motifs via oscillators+filters per D3 (no .ogg files). Big atmosphere win.
- **Satellite dish structural framework** (backlog from AAL). Add visible rib geometry on the convex back face so the dish panels read as having real structure when viewed from above.
- **Engine block heat shield back panel** (similar — small geometric thickness fix).
- **First-recipe-discovery fanfare** (backlog from AAA). Recipe-book modal exists, but discovery is just a toast. Add icon scale-up + screen flash on first craft.

### Quick polish (~30-90min)

- **Stamina tow factor playtest** (backlog from AAL). Current 2× drain discourages sled travel; needs in-play signal before tuning.
- **More CLAUDE.md rule-2 sweeps**. AAL only lifted lootContainers; deadTree/fire-decor/megaWreck/poi still have hardcoded constants.
- **Companion pathing polish** (AAE follow-on). Re-playtest the rolling→walking→idle transitions for smoothness around obstacles.
- **scrap_gun crosshair empty-state** (LOW audit item). Crosshair should hint "empty" before player mashes LMB on a dry gun.

## Autonomy contract

When ambiguous, pick the option closest to the GDD pillars + decisions.md realism dial (D45+, D49, D67, **D86 cook-list, D87 seed-check**), append a new D-entry, keep going. The user has authorized "work without stopping for clarifying questions, make the reasonable call and continue; they'll redirect if needed."

Stop conditions: wall-clock limit, 3-strike fix wall, catastrophic block (tsc broken in main, dev server crashes), destructive-action attempt (push --force, reset --hard, etc.).

## Notable footguns (from AAM + recent sessions)

- **`_cooks` is module-level state in interaction.ts** — survives HMR badly. If you edit interaction.ts during preview testing, the cooks list may be stale on reload. Hard-reload the preview tab.
- **Save schema is v10** — additive `hasGrill?: boolean` per fire. Pre-v10 saves load with hasGrill=false. v10 → v11 fine if needed per D81. Recipe id stability per D71 — next id is 15.
- **`save.seed !== ctx.seed` was a pre-AAM bug** (D87). When adding new ctx.X fields that supersede a Tuning constant, grep ALL Tuning.X references and audit each one — this kind of half-migration is easy to introduce.
- **Sandworm at (900, 0)** is a test-fix only. Don't ship a "sandworm encounter" feature without first doing the procgen overhaul (backlog item).
- **Grill cook-start gate**: 1 cook per fire without grill, 4 with grill. Reject if same slot is already cooking (no double-stack). Slot-switch no longer cancels cooks (multi-cook UX requirement).
- **Loader re-attaches grill** on saved fires that had it — uses `attachGrillToFire` which is idempotent (checks fire.hasGrill first).

## Verification protocol

```
npm run verify     # = tsc --noEmit
```

For substantial features:
1. Boot game, exercise the feature (use `__game.ctx` console handle).
2. Save + reload roundtrip if persisted state changed.
3. For grill-touching work: confirm 4 cooks can run simultaneously on a grilled fire, 1 on a non-grilled fire.

## Begin block

Read CLAUDE.md (auto), session-end-report, AAL/AAM changelog. Pick focus from the suggestions (infinite chunks recommended for the big lift, sandworm overhaul as the natural follow-on to the AAL backlog). TaskCreate sub-tasks. Start coding.
