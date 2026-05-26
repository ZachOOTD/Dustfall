# Session ACB — Kickoff Brief (post-ACA)

## Read these now (in order)

1. `CLAUDE.md` (auto-loaded; ACA Last-shipped — sled visual + static-pos)
2. `docs/session-end-report.md`
3. `docs/changelog.md` — ACA + ABZ + ABY at top
4. `docs/decisions.md` — D118 latest; D81 save migration
5. `docs/roadmap.md`
6. `docs/backlog.md` — ACA deferred items at top

## What's already built (post-ACA snapshot)

82 sessions. Procedural-character pipeline (ABP→ABY) + B1 Phase 1
(ABZ companion tether) + B1 Phase 2 lite (ACA static-pos endpoint) +
sled visual rework (ACA — scrap metal sheet). SAVE_VERSION v12.

## Session ACB focus

Deferred items from ACA + ABZ. User-requested tactile sled mechanics.

## Priority items (pick 2-3)

### P1 — Locker-on-sled (mobile storage, ~1-2h)
User direction: "place a locker on the sled and pull that around,
kinda making the mobile storage more tactile".
- Add `Sled.attachedLocker?: number | null` (locker id reference)
- New interaction: wielding locker_kit + LMB on sled → spawn locker
  at sled deck position, parent locker.mesh to sled.group
- Each frame, if sled has attached locker, ensure visual position
  syncs to sled top (could parent in Three.js OR per-frame copy)
- Locker.pos updates to sled.pos each frame (so interactions still hit)
- Save: `sled.attachedLockerId` field; on load, re-parent + skip
  independent locker placement at saved.pos
- Pack-up rule: refuse if sled is moving (deploy state)

### P2 — Throw items on sled deck (~2-3h)
User direction: "you could actually throw items on there and pull
them around".
- Sled needs a top-collider for items to rest on (currently the box
  collider might not have a friction-friendly top surface for
  items to settle)
- Dropped-item pickups from ABM already have Rapier dynamic bodies
- New interaction: when player drops/throws an item ABOVE the sled,
  the item physics-settles on the deck
- The pile travels with sled (Rapier kinematic-on-static or coupling)
- Save: items-resting-on-sled list (or just persist as dropped
  pickups with sled-relative position)
- Visual: items pile up on the warped sheet, slide off if sled tips

### P3 — LMB-on-empty-ground UX for static-pos tether (~30min)
ACA shipped the static-pos tether kind but no interaction creates one.
Add: while wielding rope + LMB on empty sand → if a sled is player-
tethered, transfer to static-pos at the click target. Sled stays in
place. UX hint: "stake the sled here".

### P4 — Full RopeEndpoint refactor (~3-4h)
Defer probably — wait until more endpoint kinds (corpse, carcass) are
actually needed. Current SledTether union approach is working +
scaling cleanly with each addition.

## Autonomy contract

Iteration discipline still applies for visual work. Save-schema work
verifies via tsc + round-trip smoke test.

## Notable footguns

- **D81 save migration**: schema is at v12. Any further changes go
  through additive-only pattern (don't remove fields).
- **ACA sled visual**: the new scrap-metal sheet has a deformed
  geometry. The Rapier collider stayed as the original box — should
  still work since the warped edges are above the box bounds. Verify
  in playtest.
- **Locker-on-sled rotation**: when sled rotates (yaw lerp toward
  anchor), the attached locker must rotate with it. Easiest: parent
  locker.mesh as a child of sled.group rather than sync per frame.

## Begin block

Read CLAUDE.md (auto) + recent changelog + decisions. Pick priority
items. TaskCreate sub-tasks. Start.
