# Next Session — Kickoff Brief (post-AAN)

## Read these now (in order)

1. `CLAUDE.md` (auto-loaded)
2. `docs/session-end-report.md` — cumulative state through AAN
3. `docs/changelog.md` — read AAM / AAN entries at the top
4. `docs/decisions.md` — D88 (hover wins crosshair channel), D89 (toast.kind variant pattern); also D86 (cook-list pattern), D87 (loader seed-check bug), D71 (recipe id stability — next id is 15), D81 (save migration additive — SAVE_VERSION currently v10).
5. `docs/roadmap.md`
6. `docs/backlog.md`

## What's already built

41 sessions. The overnight era + AAA-AAN all shipped. Per-seed worlds (AAI/AAK), opening wreck polished (AAJ), project-wide audit (AAL), fire grill multi-cook (AAM, SAVE_VERSION v10), and now systems-review + 4 quick wins (AAN). Codebase: tsc clean, 0 `as any`, 14 recipes (next id 15), 5 placeable kits + grill attachment + companion. Atmosphere stack rich. Procgen wrecks now respect CLAUDE.md rule 7 (no paper-thin decorations). Sandworm currently at world edge (900, 0) as a test-only fix — still needs procgen biome-seeded overhaul as a future session.

## Suggested focus (pick one)

The AAN audit identified several remaining quick wins and bigger lifts. Pick based on time budget.

### Big-ticket (recommended for a long block)

- **Infinite chunk streaming** (still queued from post-AAI). Generate 800m chunks lazily as player approaches boundary; free farthest chunks. Per-chunk seed derivation (hash from worldSeed). GPU memory budget. Save bump v10→v11 (chunk state + placed-flagships set). ~6-10h.
- **Sandworm overhaul** (deferred from AAL/AAM/AAN). Procgen biome-seeded spawn via dune-biome rejection sampler (like wells in salt). Possibly multiple worms per world; smarter detection (sound-based, not just radius); deeper encounter design. ~3-5h.
- **Atmospheric music tracks** (long-standing backlog). 3 procedural tracks (day / sandstorm / night) via Web Audio per D3 (no .ogg files). Slow drones + sparse motifs via oscillators+filters. ~4-6h. Big atmosphere win.
- **Trading / NPC economy** — design exploration first; warrants a planning pass.

### Medium picks (2-3h)

- **Paper-thin decoration audit — flagship POIs** (AAN-followup). AAN fixed wrecks.ts but megaShip.ts, megaWreck.ts, crashedHull.ts, engineBlock.ts, satelliteDish.ts may still have sub-10cm BoxGeometry decorations. Sweep + bump per CLAUDE.md rule 7.
- **Cook-progress-per-fire HUD** (AAN audit deferred). Each of 4 parallel cooks on a grill should show its own progress; currently the salvage-progress bar UI only shows one.
- **Tutorial coverage refresh** — grill_kit, companion_pod, RMB context actions, sled cargo don't have prominent first-discovery hints.
- **Companion storm-peak behavior** — huddle state at intensity > 0.8 + one-shot toast first time it triggers.
- **Satellite dish backing geometry / engine block back panel** — long-standing visual polish items.

### Quick polish (~30-90min)

- **Stamina tow factor playtest** (backlog from AAL). Current 2× drain discourages sled travel.
- **More CLAUDE.md rule-2 sweeps**. deadTree, fire-decor, megaWreck, poi.ts still have hardcoded constants per AAN audit.
- **Companion pathing polish** — re-playtest rolling→walking→idle transitions around obstacles.
- **scrap_gun reload feedback** — AAN added the empty crosshair; consider a reload action / sound + toast.

## Autonomy contract

When ambiguous, pick the option closest to the GDD pillars + decisions.md realism dial (D45+, D49, D67, **D86 cook-list, D87 seed-check, D88 hover-wins, D89 toast-kind**), append a new D-entry, keep going. The user has authorized "work without stopping for clarifying questions, make the reasonable call and continue; they'll redirect if needed."

Stop conditions: wall-clock limit, 3-strike fix wall, catastrophic block (tsc broken in main, dev server crashes), destructive-action attempt (push --force, reset --hard, etc.).

## Notable footguns (carried + new)

- **`_cooks` is module-level state in interaction.ts** — survives HMR badly. Hard-reload the preview tab if editing interaction.ts during preview testing.
- **Save schema is v10** — additive `hasGrill?: boolean` per fire. Pre-v10 saves load with hasGrill=false. v10 → v11 fine if needed per D81. Recipe id stability per D71 — next id is 15.
- **Sandworm at (900, 0)** is a test-fix only. Don't ship a "sandworm encounter" feature without first doing the procgen overhaul (backlog item).
- **Grill cook-start gate**: 1 cook per fire without grill, 4 with grill. Reject if same slot is already cooking (no double-stack). Slot-switch no longer cancels cooks (multi-cook UX requirement).
- **AAN crosshair states are mutually exclusive** (D88) — adding a new state means deciding precedence vs `.no_ammo`, `.kill`, `.dead`, `.interactable`. Hover always wins.
- **AAN `showToast` opts arg** is optional (D89) — existing single-arg call sites unchanged. New `kind` variants beyond 'discovery' just extend the union.

## Verification protocol

```
npm run verify     # = tsc --noEmit
```

For substantial features:
1. Boot game, exercise the feature (use `__game.ctx` console handle).
2. Save + reload roundtrip if persisted state changed.

## Begin block

Read CLAUDE.md (auto), session-end-report, AAM/AAN changelog. Pick focus from the suggestions (infinite chunks recommended for the big lift, sandworm overhaul as the natural follow-on to the AAL/AAN backlog, atmospheric music as the highest atmosphere ROI). TaskCreate sub-tasks. Start coding.
