# Session RR — Opening wreck full redo

**Direction locked at end of QQ-2** by the user: "for [adding light shaft
holes to the wreck] think we need a full redo/overhaul of the opening
wreck now that we've improved our modelling capabilities, so that will
likely be another session."

## Scope

Replace the current `setupOpeningScene` wreck mesh with one built using
the techniques from the KK/LL/NN/MM wreck-rework arc:
- `LatheGeometry` for tapered fuselage / engine bell sections
- Per-piece tilted colliders so the collision shape matches the visible
  silhouette (no more "boxy" stand-in)
- Salvage panels embedded in the hull
- Light-shaft holes baked into the geometry (was a backlog [polish]
  entry; folding it into the redo since "added on top of boxy hull"
  doesn't fit the new modelling vocabulary)
- Procedural shader weathering already shipped (OO):
  `createRustedHullMaterial` for the hull + `createWeatheredConcreteMaterial`
  for any embedded ground/foundation pieces

## Critical to preserve
- Player spawn point in front of the wreck entrance
- Journal placement inside the wreck (Session W)
- Skeleton + opening narrative props
- Speeder spawn location (the opening wreck is what `setupOpeningScene`
  places EVERY boot — including loads — so position drift here will
  break save/load player-pose restoration)
- `findFlattestSpot` placement logic + `PLAYER_SPAWN_OFFSET_FROM_ENTRANCE`
  (JJ-2 D59)

## Files to touch
- `src/world/openingScene.ts` (or wherever `setupOpeningScene` lives —
  Grep to confirm)
- Maybe a new `src/world/openingWreck.ts` to mirror the
  `crashedHull.ts` / `engineBlock.ts` / `satelliteDish.ts` pattern of
  one module per flagship POI
- Probably small touches to `main.ts` if the spawn-offset constant
  needs adjusting

## Carry-overs from QQ-2 worth noting
1. **Inextensible rope constraint** (D67) is the new tow physics
   model. If raiders or other entities later need to "drag" something
   (e.g., a captive sled, a pulled door), reach for the same
   position-snap-plus-velocity-project pattern rather than springs.
   Locked rotations + manual visual yaw should travel with this
   constraint pattern.
2. **lootMenu now supports `allowDeposit: true`** — bidirectional
   storage UI is a one-liner away for any future container that wants
   it (raider corpses, mailbox shrines, etc.).
3. **Hotbar tooltip** is automatic for any item with `name` +
   `description` (every existing ItemDef has both). New items get
   tooltips for free.
4. **Sandworm halved** — if combat tuning feels too easy now (smaller
   target), bump HP rather than rescaling further. D49 still applies.
5. **The opening wreck overhaul should also reconsider** the wreck's
   collision shape relative to the current opening-cinematic camera
   sweep; the swept camera flies through interior space that may not
   exist in the new mesh.

## Out of scope
- Touch other flagship wrecks (crashed hull, satellite dish, engine
  block) — those were redone in NN/LL.
- New procgen wreck variants (the bucket is full at the existing 7
  types).
- Interior modelling of the wreck's deeper sections — keep the opening
  intimate, not a full ship to explore.

## Verification
- tsc clean
- Boot fresh game, confirm the wreck silhouette reads as more
  detailed (specifically: no boxy ends, visible god-ray holes in the
  new mesh, salvage panels accessible)
- Save mid-explore, reload — player + speeder + journal should land
  in the same spots (regression: `setNextKinematicTranslation` bug
  from JJ-2 should NOT come back; use `setTranslation(pos, true)`)
- `gl.readPixels` sanity check inside the wreck to confirm light
  shafts are visible from interior camera angles
