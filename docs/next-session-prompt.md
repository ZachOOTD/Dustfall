# Session SS — Open direction (big-ticket bucket)

**No locked-in direction.** Session RR shipped the opening wreck redo
(the last queued big-ticket item from QQ-2). The roadmap "Next" is now
the open big-ticket bucket — user picks from the list at session start.

## Bucket candidates (in approximate order of recency / freshness)

1. **Crafting rework** — combine up to 4 items to discover recipes (no
   grid); chooser when multiple recipes match the same inputs.
   Replaces the current bloating `RECIPES` array. Most-recent backlog
   add, scoped at one session. Files: `src/ui/craftingMenu.ts`,
   probably new `src/inventory/recipeDiscovery.ts`.
2. **Control scheme overhaul** — modern survival parity. Lean on LMB
   more (hold to drink canteen, click to place kits/sled, etc.)
   instead of E for every interaction. Touches `combat.ts`,
   `interaction.ts`, plus all the per-item `onUse` handlers.
3. **Small red creature companion** — pocketable + re-deployable.
   Charm + character, no combat surface area. Mirrors lizard
   visual/AI shape; uses the speeder velocity-follow idiom for the
   "follow at offset" behavior. Was the recommended pick before the
   opening-wreck overhaul was promoted in QQ-2.
4. **Raider variants** (scout / ambusher / brute) — still hedged;
   user vetoed raiders at start of QQ. Revisit only with explicit
   go-ahead.
5. Other bucket items: Q2 rigged hands (GLB-dependent), base-building,
   trading/NPC economy, 7-day storm countdown, bounties, procgen
   world generation, remove HUD stat bars.

## Carry-overs from RR worth surfacing

1. **Opening wreck pointer-locked walk-in not yet playtested** —
   structural verification was eval-driven (positions, salvageable
   count, save/load roundtrip, side + top screenshots). The actual
   "walk in through the torn entrance" experience hasn't been
   exercised. Worth a quick boot + walk before starting unrelated
   work. Specifically check: (a) collider geometry doesn't leave any
   wall gaps the player can clip through, (b) the entrance is wide
   enough for the player capsule, (c) the cockpit interior reads as
   intimate not cramped, (d) the god-ray skylight visibly streams
   through during midday.
2. **Angular-slice lathe pattern** is documented in D68 — reach for
   it if a future module needs "lathe with holes" geometry (broken
   hulls, partial domes, ribbed sections with missing teeth).
3. **Lathe-local vs wreck-local axis confusion** also caught in D68 —
   detail meshes (windows, breach patches, antenna) must be authored
   in the same coordinate space the lathe slices use to avoid
   accidental world-up vs lathe-up swaps that bury features below
   the floor.
4. **Opening wreck is now salvageable** (2 `'fuselage'` panels). If
   the salvage UX feels at odds with the narrative weight of "this
   is where someone died alone", consider gating the wreck's panels
   behind reading the journal first.
5. **HMR may have been triggered during RR** — if anything looks off
   on the first boot of the next session, do a hard reload.

## Verification checklist for whatever ships next
- tsc clean
- HMR-aware playtest in the user's tab if changes are visible
- Save/load roundtrip if the change touches persisted state
- gl.readPixels sanity check if the change is visual-only and the
  preview_screenshot tool stalls
