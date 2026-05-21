# Session UU-2 — Kickoff Brief

## Read these now (in order)

1. `CLAUDE.md` (auto-loaded) — project manual, current state, architecture rules
2. `docs/session-end-report.md` — cumulative state through Session VV
3. `docs/decisions.md` — D1-D76. Critical for UU-2: D73 (wieldAction.ts dispatcher) + D74 (wieldLmb field) — UU-2 EXTENDS the wieldAction dispatcher to also handle RMB.
4. `docs/roadmap.md` — "Overnight queue" — UU-2 is up next
5. `docs/backlog.md` — open items
6. `docs/architecture.md` — only if you need a system you don't know

## What's already built

Dustfall is 22 sessions past start, post-MVP. UU just shipped the
LMB-leaning control scheme via `src/player/wieldAction.ts` (the SOLE
LMB-while-wielded dispatcher). VV shipped tuning lifts + crosshair
feedback + zero-`as any`. Codebase is clean: `Grep "as any" src` = 0.

## Session UU-2 focus

**RMB context actions + controls panel hint refresh** (~1.5h). Add
RMB as a third interaction verb for power users:
- **RMB on tent** → pack up (build `packUpTent(ctx, tent)` symmetric
  to `deployTent`)
- **RMB on sled (when rope is attached to speeder)** → release rope
  (reuse existing `detachRope(ctx, sled, 'rope released')`)
- Refresh `src/ui/tutorial.ts:44-59` CONTROLS table to reflect UU's
  LMB scheme + UU-2's RMB additions

This is a power-user verb layer. Old E-actions on tent (sleep) and
sled (cargo) still work — RMB is additive, not replacing.

## Priority items (in order)

1. **Extend `wieldAction.ts` to dispatch RMB** (~20 min).
   - Add a parallel `mousePressed.has(2)` read in `updateWieldAction`.
   - RMB needs hover-state context (which tent/sled is targeted), so
     dispatch through a new helper `handleContextAction(ctx)` that
     reads `ctx.inventory.hover` similarly to how `handlePickupTake`
     does for LMB.
   - All existing gates (overlay, mounted, isPlaying) apply to RMB
     the same way they do to LMB.

2. **`packUpTent(ctx, tent)` in src/world/tent.ts** (~45 min — bulk of session).
   - Symmetric to `deployTent`: remove shelter zone via
     `removeShelterZone(ctx.shelter, tent.shelterZone)`, remove mesh
     from scene via `ctx.three.scene.remove(tent.mesh)`, splice out
     of `ctx.tents.list`, and add `tent_kit` back to inventory via
     `addItem(ctx.inventory, 'tent_kit')`.
   - Handle inventory-full: if `addItem` returns -1, toast "no room
     in your bag" and DO NOT remove the tent (refuse the operation).
   - RMB-dispatch reads `ctx.inventory.hover?.type === 'sleep'` (the
     tent hover type from interaction.ts) and the registry to find
     the tent.

3. **`releaseSledRope(ctx, sled)` glue** (~15 min — reuses `detachRope`).
   - When `hover.type === 'open_sled'` or `'attach_rope'` AND
     `sled.tether.kind === 'speeder'`, RMB calls `detachRope(ctx,
     sled, 'rope released')`. If no rope attached or not to speeder,
     RMB on the sled is a no-op.

4. **Controls panel hint refresh** (~25 min — pure DOM/data edit).
   - Read `src/ui/tutorial.ts` CONTROLS table (~lines 44-59).
   - Update entries: the E line should now say "open / sleep /
     mount / read / refill / harvest" (not "interact / pick up /
     refill / search / harvest / cook / sleep").
   - Add LMB row(s): "attack / drink / place / take" depending on
     what the player is wielding.
   - Add RMB row: "pack up tent / release sled rope".
   - Keep the existing Q row ("use selected item").

## Stretch goals (if budget allows)

- Visual feedback when RMB packs up a tent — small dust puff, fade.
- Sled rope-release toast could include a 1-line flavor message
  ("untethered — the sled drifts").

## Autonomy contract

- When ambiguous: pick the option closest to GDD pillars + D73/D74
  patterns. New verb dispatch lives in `wieldAction.ts` — do not
  scatter RMB handling across modules.
- Footgun: do NOT touch `src/persistence/save.ts` (UU-2 ships no
  save schema change). UU-2 keeps `SAVE_VERSION = 6`.
- Footgun: `packUpTent` must NOT despawn the tent if `addItem`
  returns -1 — refuse the operation. Otherwise the player loses a
  tent forever.
- Never ask the human mid-session.

## Stop conditions (overnight mode)

- All 4 priority items shipped + verify passes → `/session-end`.
- 3-strike wall → invoke `/scope-cut` against pre-committed list in
  `.claude/plans/i-want-to-set-floating-dusk.md` Session UU-2 section.
- Catastrophic block → halt + write CAUTION in next-session-prompt.
- Destructive action attempt → halt unconditionally.

## Pre-committed scope cuts (cut top-first)

1. **RMB-on-sled (release rope)**. Cut means sled rope detach stays
   in the LMB-on-rope-stub path from QQ-2; RMB only works on tents.
2. **RMB-on-tent (pack up)**. Cut means tent stays one-way deployable.
   Highest blast-radius cut — `packUpTent` is the bulk of UU-2's
   work. If cut, UU-2 becomes just RMB dispatch wiring + sled-release
   + controls panel refresh (~30 min total).
3. **Controls panel hint refresh**. Cut means table stays stale.
   Documented in backlog as a follow-up. Cost: morning-review
   confusion when user presses H.

## Notable footguns

- **D73 (wieldAction.ts as sole LMB dispatcher)** — extend it for
  RMB; do NOT scatter mousePressed.has(2) reads across other modules.
- **D67 (sled inextensible rope)** — `detachRope` is the canonical
  release path; don't re-implement.
- **`packUpTent` inventory-full case** — refuse the operation; never
  silently destroy a tent.
- **`isPlaying(ctx)` gate** — RMB must respect overlay + mounted
  gates same as LMB. Inheriting via `wieldAction.ts`'s existing
  early-return gives this for free.

## Verification protocol

```
npm run verify  # = tsc --noEmit
```

Plus eval-driven preview verification:
1. tsc clean.
2. Wield nothing → look at tent → RMB → tent packs up, tent_kit
   returns to inventory, shelter zone removed, tent gone from scene.
3. Fill inventory + look at tent → RMB → toast "no room", tent
   stays in place.
4. Wield nothing → look at sled with rope attached to speeder → RMB
   → rope detaches, sled coasts per QQ-2 physics.
5. Old E-actions still work: E on tent opens sleep overlay; E on
   sled cargo opens loot menu. RMB is purely additive.
6. Mount speeder → RMB on tent → no pack-up (mount-gate).
7. Open crafting menu → RMB on tent (visible behind overlay) → no
   pack-up (overlay-gate).
8. Press H → controls panel reflects new LMB-leaning scheme + RMB
   additions.
9. Save + reload → save schema unchanged (still v6); tents persist
   correctly (deploy + pack-up workflow doesn't corrupt save).

## Begin block

Read CLAUDE.md (auto-loaded) → `docs/session-end-report.md` →
`docs/decisions.md` (especially D73-D76 just shipped). Create
TaskCreate top-level list with the 4 priority items. Mark item 1
(`wieldAction.ts RMB dispatch`) as `in_progress`. Read
`src/player/wieldAction.ts` to confirm structure, then begin extending
`updateWieldAction` to handle RMB.
