# Session TT — Kickoff Brief

## Read these now (in order)

1. `CLAUDE.md` (auto-loaded) — project manual, current state, architecture rules
2. `docs/session-end-report.md` — cumulative state through Session SS, the "what works end-to-end" reference
3. `docs/decisions.md` — D1-D69, with friction-scores. Pay attention to **friction ≥ 4** entries (architectural lock-ins worth respecting)
4. `docs/roadmap.md` — "Next — Big-ticket bucket" lists the remaining big-ticket items
5. `docs/backlog.md` — unprioritized ideas / bugs / polish / debt
6. `docs/architecture.md` — file map; consult only if you don't know where a system lives

## What's already built

Dustfall is 19 sessions past start, post-MVP. The lone-survivor sandbox loop
works end-to-end: spawn at the redesigned opening wreck → read the journal at
the dead survivor's hand → exit to the speeder → cross the 2400m world via
hover speeder + on-foot → harvest at the salt-flats well → salvage at procgen
wrecks → fight lizards / sand worm boss with one of 5 weapons → craft fire +
tent + sled + rope → save + reload. The hull material side-flag bug from RR
was fixed in SS so the cockpit interior renders correctly from inside. No
known critical bugs.

## Session TT focus

**Crafting rework — combine-to-discover** (replaces the current `RECIPES`
explicit-list system with a Minecraft-style "throw items in, see what comes
out" interface; no spatial grid; up to 4 input slots; chooser when multiple
recipes match the inputs). This is the top-priority bucket item per
session-end-report's suggested-next list. Most recent backlog add, scoped at
one session, no combat or physics surface area.

## Priority items (in order)

1. **Data model** (~30 min)
   - `src/inventory/recipeDiscovery.ts` (new) — define `Recipe { inputs:
     ItemId[]; output: { itemId: ItemId; count: number }; discoveredOn?:
     number }`. The `inputs` array is order-insensitive — match by sorted
     tuple. Migrate the existing `RECIPES` array from `craftingMenu.ts` to
     the new shape; include the existing 5 recipes as the seed set.
   - `src/inventory/types.ts` — add `discoveredRecipes: Set<RecipeId> |
     number[]` to `InventoryState` (the player's known-recipes ledger).
2. **Discovery UI** (~1.5h)
   - Rewrite `src/ui/craftingMenu.ts` from explicit recipe list to combine-
     mode. 4 input slots + 1 output preview slot. Click hotbar/backpack items
     to add to inputs; click an input slot to remove. Show "?" output preview
     until the input set matches a known recipe; show the actual output if
     the recipe is in `discoveredRecipes`, OR show "unknown" + a CRAFT button
     for undiscovered combinations.
   - Discovery flow: clicking CRAFT on an unknown valid combination consumes
     inputs, produces output, adds the recipe to `discoveredRecipes` with a
     toast ("you've figured out how to make X"). Clicking CRAFT on an
     invalid combination consumes nothing + shows "nothing happens" toast.
3. **Overlap chooser** (~30 min)
   - If `Recipe[]` has multiple entries with the same `inputs` (rare but
     possible), the UI shows a small selector: "this combination can make X
     or Y" with two click buttons. Pre-commit which output the player wants.
4. **Save schema migration** (~30 min)
   - `SAVE_VERSION 5 → 6`. Persist `discoveredRecipes` in the save. Pre-v6
     saves load with the seed set as discovered (the 5 original recipes
     stay known).
5. **Backlog cleanup** (~5 min)
   - Strike the "crafting rework" backlog entry on ship.

## Stretch goals (if budget allows)

- "Recipe book" panel showing all discovered recipes (separate hotkey, e.g.
  Tab). Skip if you're tight on time.
- Hover tooltips on discovered recipes showing the input glyphs in the
  combine UI before the player has all the inputs.
- Add 2-3 new recipes that the new discovery flow can showcase (e.g.,
  `bandage` from `cloth + cloth`, `branch_bundle` from `branch × 3`).

## Autonomy contract

- When ambiguous: pick the option closest to GDD pillars + decisions.md
  realism dial, append a new D-entry, keep going.
- D7 (barren-desert pivot) + D9 (salvageables are finite) + D13 (sandbox
  pivot) all reinforce: crafting is a survival pressure, not a min-maxing
  vector. Don't add 30 recipes; keep the seed set tight (5-8 total). The
  discovery feel matters more than the recipe count.
- Never ask the human mid-session. Surface uncertainty as a D-entry and a
  scope-cut candidate.

## Stop conditions (gated mode default)

- Tier boundary reached (= the 5 priority items above shipped + verify
  passes)
- 3-strike wall (same fix attempted 3x without success) — invoke
  `game-verifier`
- Catastrophic block (tsc broken, dev server won't start)
- Destructive action attempt (git push/force/amend without explicit user grant)

## On stop

Invoke `/gamedev-framework:session-end` to verify + append changelog + bump
"Last shipped" + rewrite session-end-report + write next-session-prompt +
print commit handoff.

## Notable footguns

- **HMR can show stale module state** for state held in module-level closures
  (lootMenu's `_current`, hotbar tooltip's `_latestCtx`). If the crafting UI
  uses module-level singletons, full reload is safer than HMR during dev.
- **Save format bumps**: pre-v6 saves MUST still load cleanly with the seed
  recipes as discovered, or existing playtesters lose their save. Test with a
  v5 save file deliberately.
- **Recipe input ordering**: a recipe input set `[scrap, cloth, branch]` and
  `[branch, cloth, scrap]` must match the same recipe. Sort the input ItemIds
  alphabetically before hash comparison.
- **Lathe-local vs world-Y axis** (D68) — not relevant to this session unless
  you're touching mesh code, but if a polish detour leads there, re-read D68.
- **`docs/GDD.md` design pillars** — Pillar 2 (procedural everything) means
  the crafting UI itself must be authored in code (DOM via `createElement`,
  no `innerHTML` per the architecture rules). Pillar 4 (tactile world)
  means each recipe should feel like the player figured something out, not
  unlocked it from a list.

## Verification protocol

```
npm run verify  # = tsc --noEmit; Dustfall opts out of tier-ladder verification
```

Plus eval-driven + HMR-aware playtest:
1. tsc clean
2. Open crafting menu (C). Confirm 4 input slots are visible.
3. Add 2 cloth + 1 branch → preview slot shows the rope outcome.
4. Click CRAFT → rope appears in inventory, ingredients consumed, recipe
   marks as discovered.
5. Add 2 cloth + 1 branch again → preview shows the rope (now known).
6. Add an undefined combination (e.g., 2 scrap + 1 alien_fruit) → preview
   shows "?" until CRAFT, then "nothing happens".
7. Save + reload → discoveredRecipes persists.

## Begin block

Read CLAUDE.md (already auto-loaded) → `docs/session-end-report.md` →
`docs/decisions.md` (friction ≥ 4 in particular) → this brief. Create a
TaskCreate top-level list with the 5 priority items. Mark item 1
`in_progress`. Begin work on `src/inventory/recipeDiscovery.ts`.
