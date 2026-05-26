# Session ACC — Kickoff Brief (post-ACB)

## Read these now (in order)

1. `CLAUDE.md` (auto-loaded; ACB Last-shipped — locker-on-sled + static-pos UX)
2. `docs/session-end-report.md` — cumulative through ACB
3. `docs/changelog.md` — ACB + ACA + ABZ at top
4. `docs/decisions.md` — D118 latest; D81 save migration
5. `docs/roadmap.md`
6. `docs/backlog.md` — ACB followup (throw items deferred) at top

## What's already built (post-ACB snapshot)

83 sessions. Tactile sled mechanics layered up across ACA-ACB:
- ACA: sled visual rework (warped scrap metal sheet)
- ACA: B1 static-pos tether kind
- ACB: locker-on-sled (parented mobile storage)
- ACB: static-pos UX (LMB-on-empty-ground stake)

SAVE_VERSION v12 (additive, no v13 yet — ACB schema bumps were
additive-only).

## Session ACC focus

**Throw items on sled deck** — the last user-requested tactile sled
mechanic. Pre-ACC, items can ride the sled only inside the cargo
container (open/take/deposit menu) or in the attached locker. Player
should be able to physically toss items onto the deck and have them
travel with the sled.

## Priority items

### P1 — Sled top-collider for items to rest on (~30-60min)
Current sled collider is a simple box for body-of-sled physics. The
warped lateral curls of the new scrap-metal sheet aren't friction-
friendly for items resting on top. Options:
- Add a flat invisible collider above the visual sheet (same width
  × depth as deck, thin Y) that items can rest on.
- OR keep the box collider but ensure top face is flat.
Items use ABM dropped-item physics (Rapier dynamic bodies). The sled
body is dynamic too — when sled moves, items resting on it should
move via static friction.

### P2 — Make dropped items rest on + travel with sled (~1-2h)
When a pickup's body is detected to be ON a sled (via raycast down
or collision), parent the visual mesh to sled.group + freeze the
Rapier body relative to sled. OR — simpler — just let physics handle
it (items rest on collider, friction keeps them in place as sled
moves). Sled max speed might need to drop to keep stacks stable.

### P3 — Save items-resting-on-sled (~30min)
- Option A: persist as dropped pickups (their Rapier bodies serialize
  via existing ABM save). Items round-trip independently of sled
  position; on load, they'll naturally fall back onto the sled deck
  if it spawns underneath.
- Option B: persist as `sled.items: ItemId[]` with sled-relative
  positions. On load, spawn pickups at the saved positions parented
  to sled.

### Stretch — Pickup throw arc (~30-60min)
Currently dropping items uses ABM's spawnDroppedPickup with low
initial velocity. Player could "throw" items by giving them a
forward arc with the camera direction.

## Autonomy contract

Iteration discipline applies if visual/feel work. Architectural save-
schema work verifies via tsc + round-trip smoke test.

## Notable footguns

- **D81 save migration**: schema at v12 (additive). ACC may want a
  v13 bump if adding sled.items field.
- **Sled velocity vs item physics**: Rapier kinematic-on-dynamic
  friction can be flaky at high speed. May need a max-tow-speed
  reduction (currently bumped to 2.2× sprint per JJ-2) when sled
  has items resting on it.
- **ACB locker-on-sled rotation**: locker.mesh is parented to
  sled.group, so when sled rotates (visual yaw lerp toward anchor),
  the locker rotates with it correctly. Verify this when sled is
  being towed + turning.

## Verification protocol

```
npm run verify     # = tsc --noEmit
```

For physics work, verify via boot test: place sled, drop item on it,
attach rope, walk → items follow sled.

## Begin block

Read CLAUDE.md (auto) + recent changelog + decisions. Pick priority
items. TaskCreate sub-tasks. Start.
