# Session ACA — Kickoff Brief (post-ABZ)

## Read these now (in order)

1. `CLAUDE.md` (auto-loaded; ABZ Last-shipped — B1 Phase 1 ship)
2. `docs/session-end-report.md` — cumulative through ABZ
3. `docs/changelog.md` — ABZ + ABY + ABX at top
4. `docs/decisions.md` — D118 latest; D107-D118 + D81 (save migration)
5. `docs/roadmap.md` — Up next options
6. `docs/backlog.md` — B1 Phase 2 deferred + other items

## What's already built (post-ABZ snapshot)

81 sessions. Procedural-character pipeline complete (ABP→ABX) +
polish wrap-ups (ABY) + B1 Phase 1 generalized rope (ABZ — companion
tether kind landed). SAVE_VERSION v12 (additive).

## Session ACA focus — pick a track

### Track A — B1 Phase 2: complete the generalized rope refactor (~3-4h)
Continue ABZ's B1 work:
- Full `RopeEndpoint` union (sled / player / speeder / companion /
  static-pos / corpse / sandworm-carcass) replacing the current
  `SledTether` kind
- Abstract `Tether { a, b }` shape — tether can be between ANY two
  endpoints, not just sled-as-thing-being-pulled
- RMB-on-wielded-rope raycast-pick UX — more discoverable than the
  current LMB-on-hovered-target pattern
- New endpoint kinds wired into interaction.ts
- Save v12 → v13 with new tether shape
- Rope physics tuning for creature-pullers (companion walks slower
  than player; may need looser constraint)

### Track B — A1 Infinite chunk streaming (~6-10h)
Last major architectural lift. Replace 3×3 chunk grid with N×N
streaming around player. LRU eviction. Per-chunk seed. Save bump.

### Track C — B5 Flagship NPC beats (~4-6h)
Hostile raider holdouts + friendly hermits at hand-modeled flagships.
Composes existing raider AI + new dialogue/journal hooks.

### Track D — Apply procedural-character pipeline to NPCs (~4-8h)
Use D115+D117+D118 stack to upgrade existing creatures: companion,
raider variants, lizards. Pipeline reusability test.

## Autonomy contract

When ambiguous, pick the option closest to the GDD pillars +
decisions.md realism dial (D45+, D49, D67, D86–D118, D81 save migration).

Iteration discipline still applies for any visual surface work.

## Notable footguns

- **D81 save migration**: SAVE_VERSION v12 just shipped (ABZ). Any
  further schema changes go through v13 with additive-only pattern.
- **D107 zero-asset** still load-bearing.
- **Sled tether union**: currently SledTether = none/player/speeder/
  companion. If refactoring to RopeEndpoint union, plan migration
  + ALL consumers (transferTetherOnMount, transferTetherOnDismount,
  attachRopeToSled, interaction.ts, save.ts).
- **ABZ Phase 1 has a known gap**: the LMB-on-companion-while-rope
  flow requires the sled to be already player-tethered. If the sled
  is unattached, LMB on companion does nothing. ACA could add: LMB
  on sled-rope-stub while companion is hovered → tether to companion
  directly.

## Verification protocol

```
npm run verify     # = tsc --noEmit
```

For visual/UX work: per-element iteration per discipline. For pure
architectural lifts: tsc + smoke test + save round-trip.

## Begin block

Read CLAUDE.md (auto) + session-end-report + changelog. Pick a
track. TaskCreate sub-tasks. Start.
