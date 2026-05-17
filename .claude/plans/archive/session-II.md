# Session II — Lizard-on-a-stick cooking + branch color match

## Context

HH closed the world-rework arc with 28 procgen lizards across the world,
each dropping `raw_lizard_meat` on kill. The current cook path is "aim
at fire with raw meat in hand + E → 0.6s flip raw→cooked" — which works
for naked meat but doesn't sell "roast on a spit". This session adds a
two-step skewer item (branch + raw meat → wielded raw skewer → held
over fire → cooked skewer) and recovers the branch when the player
eats. Plus a small polish: branch color shifts from warm brown to the
grey of dead trees, since dead trees are where branches come from.

## Approach

### 1. Branch color polish
- `src/inventory/items.ts:437` — branch viewmodel `0x6a4a2a → 0x6e685f`
  (matches `_branchMat` in `src/world/deadTree.ts:23`)
- `src/pickups/pickups.ts:165` — world pickup branch mat `0x5a3a22 →
  0x6e685f`. This is the in-world branch the player sees scattered
  beneath dead trees; matching makes the dead-tree-to-pickup link
  visually obvious.
- Leave fire_kit kindling, torch shaft, lootContainer crates alone —
  those have their own design intent and aren't pure-branch visuals.

### 2. New items
Add to `src/inventory/types.ts` `ItemId` union + register defs in
`src/inventory/items.ts`:
- `lizard_on_a_stick_raw` — non-stackable wielded skewer. ViewModel:
  a horizontal branch (grey, `0x6e685f`) with a pink meat chunk
  (`0x9a4a3a`) on one end. `onUse` does nothing (raw is for cooking,
  not eating).
- `lizard_on_a_stick_cooked` — non-stackable. ViewModel: same branch
  with a charred meat chunk (`0x4a2a18`). `onUse` consumes the slot,
  restores hunger 0.35 (matches cooked_lizard_meat), and adds 1
  `branch` back via `addItem`.

### 3. Held-cooking mechanic
Add `cookProgress?: number` to `ItemMeta` in types.ts.

On `lizard_on_a_stick_raw`, implement `updateHeld(itemRoot, slot, ctx, dt)`:
- Find nearest alive fire in `ctx.fires.list` (within `COOK_DISTANCE = 2.5m`).
- If found, accumulate `slot.meta.cookProgress += dt / COOK_DURATION`
  where `COOK_DURATION = 4s`.
- Visual feedback: rotate the meat chunk on the viewmodel at a slow
  spin (`itemRoot.children[meatIdx].rotation.x += dt * 1.5`) while
  cooking.
- When `cookProgress >= 1`, flip `slot.item` to
  `lizard_on_a_stick_cooked`, reset progress, play `playCookSizzle()`,
  show toast "your lizard is cooked".

### 4. Crafting recipe
Add to `src/ui/craftingMenu.ts` `RECIPES` array:
```ts
{
  result: 'lizard_on_a_stick_raw',
  resultCount: 1,
  ingredients: [
    { id: 'branch', count: 1 },
    { id: 'raw_lizard_meat', count: 1 },
  ],
}
```
Player presses C, sees "raw lizard-on-a-stick" recipe, clicks → consume
1 branch + 1 raw_lizard_meat, get 1 raw skewer.

## Files to modify

- `src/inventory/types.ts` — extend `ItemId` union, add `cookProgress`
- `src/inventory/items.ts` — branch color + 2 new item defs + add to
  `ALL_ITEM_IDS`
- `src/pickups/pickups.ts` — branch pickup mesh color
- `src/ui/craftingMenu.ts` — new recipe
- (No interaction.ts changes — held-cooking is auto via updateHeld)

## Acceptance criteria

- `npx tsc --noEmit` clean.
- Branch pickups in world + branch viewmodel render grey-ish (visibly
  matching dead trees from a few meters away).
- Press C with 1 branch + 1 raw_lizard_meat → craft "raw skewer"
  succeeds, consumes both, adds 1 raw skewer.
- Select raw skewer, deploy a fire (fire kit), stand within 2.5m of
  the fire → skewer auto-cooks over 4s, meat visibly rotates, slot
  flips to cooked skewer, toast appears.
- Use cooked skewer (E or scroll) → hunger jumps, 1 branch returns to
  inventory, slot empties.
- Cancel mid-cook by walking away → cookProgress retained but doesn't
  advance (or resets — tunable; default: retains to encourage
  multi-fire trips, but that's a minor call).

## Verification

1. `npx tsc --noEmit`.
2. `npm run dev`, fresh game.
3. Eval: kill a lizard via `__game.ctx.lizards[0]` damage path or
   pick up a raw_lizard_meat from a corpse manually.
4. Open craft menu (C key in browser), craft skewer.
5. Deploy fire (fire_kit in slot, press use).
6. Move skewer to selected slot, stand within 2.5m of fire.
7. Watch the meat rotate / progress bar / toast.
8. Eat cooked skewer, confirm branch returns to inventory.

## Out of scope

- Cooking other meats on a skewer (worm meat, cactus pulp).
- New fire types or held-cooking-only fires.
- Player-built spits / racks (would be its own session).
- Save schema — no new persisted fields beyond ItemMeta.cookProgress
  which already lives in saved slot meta.
