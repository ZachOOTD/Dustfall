# Session AAC — Craftable home (bedroll / lantern / locker)

## Read these now (in order)

1. `CLAUDE.md` (auto-loaded)
2. `docs/session-end-report.md` — cumulative state through AAB
3. `docs/decisions.md` — D71 (recipe id stability), D74 (wieldLmb on
   ItemDef), D75 (PLACEMENT_DISTANCE_M), D80 (clone-not-parameterize),
   D81 (save migration additive only)
4. `docs/roadmap.md`
5. `src/world/tent.ts` (structural template for placeable+packable kits)
6. `src/world/largeTent.ts` (the most recent kit; mirrors the pattern)

## What's already built

29 sessions. The overnight era (UU-ZZ) + AAA polish bundle + AAB world
depth all shipped. Codebase is excellent shape: tsc clean, 0 `as any`,
save schema v7, salvage tables differentiated, opening wreck has working
skylight god-rays. AAB also added `rope` as a salvage drop so players
can find it without crafting.

## Session AAC focus

**Craftable placeable home kits** — three new ItemDefs + world entity
modules following the tent_kit/sled_kit pattern. Player crafts them,
places them anywhere with LMB (ghost preview from AAA shows location),
RMB packs them back up (from UU-2 dispatch). Save schema v7→v8 additive
to persist them across reloads.

This is the largest scope-arc since XX (~4-6h). Pre-committed sub-task
split below: ship each kit independently for clean verification gates.

## Priority items (in order — ship each as a verified increment)

1. **`bedroll_kit`** (~1.5h) — portable sleep affordance.
   - New ItemId in types.ts; ItemDef in items.ts (wieldLmb='place').
   - Recipe id 11: cloth×3 + branch×1 → bedroll_kit. (D71 — never reuse
     ids 1-10.)
   - New `src/world/bedroll.ts` module: low-profile rectangular mesh
     (cloth pad + small pillow), placed flat on ground. Walks the
     ShelterZone pattern from tent.ts (small zone covering the pad).
     Interaction type: 'sleep' (reuses sleep overlay).
   - `deployBedroll(ctx)` + `spawnBedrollAt(ctx, pos, rotY)` +
     `packUpBedroll(ctx, bedroll)` exports.
   - `ctx.bedrolls: { list: Bedroll[] }` on GameContext.
   - interaction.ts: new case 'bedrolls' (reuse 'sleep' verb).
   - wieldAction.ts handleContextAction: RMB iterates bedrolls.list.
   - **Save schema v7→v8**: add `bedrolls?: Array<{id, pos, rotationY}>`.
     (D81 — additive only. Loader accepts v1-v8.)
   - Acceptance: craft, deploy via LMB, E to sleep, RMB to pack up.
     Save+reload preserves.

2. **`lantern_kit`** (~1.5h) — standing light source.
   - ItemId + ItemDef (wieldLmb='place'). Recipe id 12: cloth×2 + scrap×2
     + branch×1 → lantern_kit.
   - New `src/world/lantern.ts`: vertical wood post + cloth-wrapped
     glass globe. PointLight inside the globe with warm color +
     gentle flicker (mirror torch's flicker pattern from items.ts
     updateHeld). Unlike torch, NEVER burns out — it's a deployed
     world entity, not a hand-held consumable.
   - `deployLantern` / `spawnLanternAt` / `packUpLantern` exports.
   - `ctx.lanterns: { list: Lantern[] }` on GameContext.
   - Per-frame `updateLanterns(ctx)` for the flicker. NO shelter zone
     (lanterns illuminate but don't shelter).
   - Save schema v8 already bumped in AAC.1 — just add `lanterns?` field.
   - Acceptance: craft, deploy, lantern glows at night + survives storms,
     RMB pack-up. Save+reload preserves.

3. **`locker_kit`** (~1.5h — most complex) — additional storage chest.
   - ItemId + ItemDef. Recipe id 13: scrap×4 + branch×2 → locker_kit.
   - New `src/world/locker.ts`: wooden chest mesh with metal latch.
     Interaction type: 'open_locker' (E opens the existing loot menu
     with `allowDeposit: true` like sled cargo from QQ).
   - `Locker` has its own `contents: LootEntry[]` array (persisted in save).
   - `deployLocker` / `spawnLockerAt` / `packUpLocker` exports.
   - `ctx.lockers: { list: Locker[]; open: Locker | null }`.
   - Pack-up: refuses if locker still has contents (toast: "empty it
     first"). Player must transfer everything out before packing.
   - **interaction.ts case 'lockers'**: reuses lootMenu's openLootMenu
     with allowDeposit:true, similar to case 'sleds'.
   - Save schema v8 extension: `lockers?: Array<{id, pos, rotationY, contents}>`.
   - Acceptance: craft, deploy, deposit + take items via loot menu,
     RMB pack-up (refused if non-empty), save+reload preserves contents.

4. **Tutorial + recipe book auto-discover seeding** (~15-30 min).
   - On v8 load of a pre-v8 save: if `inventory.discoveredRecipes`
     doesn't yet include 11/12/13, leave undiscovered (they're new,
     player can find them organically).
   - Update tutorial.ts HINTS for bedroll_kit / lantern_kit / locker_kit
     so first-pickup toasts explain the gist.
   - Update CONTROLS table description if needed (probably not — LMB +
     RMB already documented in AAA).

## Stretch goals (if budget allows)

- Lantern brightness slider in settings menu (currently the speeder
  headlamp + flashlight are tuned in Tuning.ts; lantern joins them).
- Bedroll: optional faster-sleep tuning (sleep skips MORE dayTime than
  the tent does — bedroll is austere but quick).
- Locker: distinct mesh variants (one for "wood" using branches as the
  primary material, one for "metal" using scrap — visual variety).

## Autonomy contract

- **D71 IS CRITICAL** for AAC. Recipe ids 11/12/13 are forever-stable
  once shipped. Never renumber, never reuse if removed.
- **D81 IS CRITICAL** for AAC. SAVE_VERSION v8 must be additive only.
  New optional fields. Loader accepts v1-v8. Test pre-v8 load.
- Bedroll/lantern/locker share enough structure that you may be
  tempted to abstract. D80 says: clone-not-abstract for N=2-3. Three
  separate modules following the tent.ts/largeTent.ts/sled.ts pattern
  is the right call.
- Never ask the human mid-session.

## Stop conditions

- Each kit ships independently. After bedroll lands clean → verify + small
  intermediate commit (`session-AAC-bedroll`?) OR continue to lantern.
- 3-strike wall on any kit → invoke `/scope-cut` against the
  pre-committed list.
- Catastrophic block → halt + write CAUTION.

## Pre-committed scope cuts (cut top-first)

1. **`locker_kit`** (most complex — bidirectional cargo, refuses-on-nonempty
   pack-up, more save state). Cut means AAC ships bedroll + lantern only;
   locker goes to backlog for a future session.
2. **`lantern_kit` flicker animation**. Cut means lantern is a steady
   light, no flicker. Easier debug path if PointLight tuning fights.
3. **`bedroll_kit` distinct shelter zone**. Cut means bedroll has NO
   shelter zone (just a sleep affordance — no cold-drain protection).
   Tent gives shelter; bedroll is purely "rest faster."
4. **Save schema v8 entirely**. Nuclear option — kits work in-session
   but don't persist across reloads. Documented as "kits are transient
   per-session in this build." Massive playtest regression; only cut
   if save.ts becomes the 3-strike wall.

## Notable footguns

- **Recipe id collision**: `RECIPES` in recipeDiscovery.ts has ids 1-10.
  Bedroll=11, lantern=12, locker=13. Verify these are unused before
  adding (grep `id: 1` etc).
- **PLACEMENT_DISTANCE_M=2.2** (D75): all three kits deploy at this
  distance. Don't introduce local placement distances.
- **Tent's `packUpTent` is the canonical pattern** (UU-2). Mirror its
  atomic shape: addItem FIRST, refuse on -1, only THEN remove from
  scene/registry.
- **largeTent's `packUpLargeTent` adds the inside-tent-refuse rule**.
  Bedroll/lantern/locker should similarly refuse if pack-up would harm
  the player: locker refuses if non-empty (per priority item 3).
- **Save loader pattern** (D81): `if (save.bedrolls)` check;
  default-empty if undefined; replay spawnBedrollAt for each entry.

## Verification protocol

```
npm run verify  # = tsc --noEmit
```

Per kit:
1. tsc clean.
2. Craft the kit's recipe → verify recipe id added to discoveredRecipes.
3. Wield → LMB → kit deploys at 2.2m (ghost preview ring from AAA
   should appear when wielded).
4. E to interact (sleep for bedroll, nothing direct for lantern,
   open loot menu for locker).
5. RMB → kit packs up; kit item returned to inventory; world entity
   removed.
6. Save + reload → all kits persist.
7. Load pre-v8 save (manually edit version=7, remove new fields) →
   loads cleanly with empty kit arrays.

## Begin block

Read CLAUDE.md → `docs/session-end-report.md` (AAB deltas) →
`src/world/tent.ts` (structural template). Create TaskCreate with
4 items (bedroll + lantern + locker + tutorial/hints). Mark
AAC.1 (bedroll_kit) as `in_progress`. Begin with `Read src/world/tent.ts`
to internalize the deploy/pack/spawn/find/setNextId pattern; mirror.
