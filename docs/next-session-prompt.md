# Next Session — Kickoff Brief (post-AAC)

## Read these now (in order)

1. `CLAUDE.md` (auto-loaded)
2. `docs/session-end-report.md` — cumulative state through AAC
3. `docs/changelog.md` — read AAA / AAB / AAC entries
4. `docs/decisions.md` — D73-D81. Especially D71 (recipe id stability — next recipe is id 14), D75 (PLACEMENT_DISTANCE_M), D81 (save migration additive only — SAVE_VERSION is now v8).
5. `docs/roadmap.md`
6. `docs/backlog.md`

## What's already built

30 sessions. The overnight era + AAA polish + AAB world depth + AAC craftable home all shipped. Codebase is in excellent shape: tsc clean, 0 `as any`, SAVE_VERSION 8, 13 recipes, 4 placeable kits (fire/tent/large-tent/sled) plus 3 new home kits (bedroll/lantern/locker). The "craft your own home anywhere" loop closes.

## Suggested focus (pick one)

The post-AAC roadmap is open. A few directions in order of how meaty they are:

### Quick polish / completions (~30–90min)
- **Playtest the full home-building loop.** Walk through crafting bedroll + lantern + locker, place them somewhere scenic, sleep, save+reload. Surface anything that feels off and fix in a 30-60min polish pass.
- **First-recipe-discovery fanfare**. The recipe-book modal exists (AAA) but discovery itself is still just a toast. A small visual flourish on first craft (icon scale-up + screen flash?) would make the "you figured it out" moment land harder.
- **Inventory swap on pickup-full**. Already in the recommendations list — when bag is full and player tries E to take, hold-E for 1s to swap with the selected slot. Big UX win during exploration.

### Medium picks (1–3h)
- **Inventory swap-on-pickup-full** (full implementation as above).
- **Cook system: multiple parallel cooks per fire**. Currently one item cooks at a time via module-level `_cooking` var. Lift to per-fire cook slots.
- **Mirage shader on salt-flat biome** (continuous polish from roadmap). Heat-haze distortion.
- **Crafting menu — fanfare on discovery + slot-glow when ingredients match a known recipe**.

### Big-ticket bucket (4–7h)
- **Small red creature companion** (pocketable + re-deployable). Charm + character. New ItemId, AI shape similar to lizard. ~5h.
- **7-day storm countdown** — escalating-storm UI + endgame pressure. ~2-3h.
- **Trading / NPC economy** — design exploration.
- **Bounties** — design exploration.
- **Procedural world generation** (POI randomization per seed). Architectural.
- **Raider variants** (if reintroducing raiders per D13 reversal).

## Autonomy contract

- **D71 critical** — next recipe is id 14. Recipes 1-13 immutable.
- **D81 critical** — save schema v8. Any new field must be additive only.
- Codebase patterns are well-established. New placeable kits follow tent.ts/bedroll.ts shape; new AI follows lizard.ts/raider.ts shape; new items follow ItemDef pattern; new save fields follow the additive optional-field pattern.

## Stop conditions

- All planned items shipped + verify passes → `/session-end`.
- 3-strike wall → invoke `/scope-cut`.
- Catastrophic block → halt + write CAUTION here.

## Verification protocol

```
npm run verify  # = tsc --noEmit
```

Preview-eval verification of whatever shipped.

## Notable footguns (carry-over)

- **D71** — recipe ids 1-13 immutable; next is 14.
- **D75** — PLACEMENT_DISTANCE_M = 2.2 for all kits.
- **D80** — clone-not-parameterize for N=2-3 callers. Three home kits (bedroll/lantern/locker) follow this rather than a "Placeable" base class.
- **D81** — save migrations additive only.
- **D79** — perceivedIntensity for visual storm; intensity for world-truth (physics + AI + stats).
- **Recipe book panel** (AAA) — auto-shows discovered recipes; remember to TAB to verify new recipes appear.

## Begin block

Pick a direction → read relevant files → TaskCreate → begin.
