# Campaign cycle-18 kickoff (overnight, ultracode) — `campaign/2026-06-18`

## Boot order (re-read every cycle from FILES)
1. `docs/campaign/campaign-state.json` · 2. `docs/campaign/steering.md` · 3. `docs/roadmap.md` "Up next" · 4. `docs/iteration-plan.md` · 5. `CLAUDE.md` + `docs/decisions.md` tail (D240).

## Where we are
- ✓ M1 · ✓ M2 content (yard-merge deferred D240) · **M3 IN PROGRESS:** ✓ model (C12-13) · ✓ tail (C14) · ✓ charge (C15) · ✓ audio (C16) · ✓ multi-worm (C17).
- **M3 LAST unit → `sarlacc-lure-ambush` (cycle 18)**, then **M3 COMPLETE → M4.**

## Cycle 18 picks up: **M3 → `sarlacc-lure-ambush`** (USER-REQUESTED ADD — build it)
The user explicitly asked to add the **Sarlacc lure**: a deployable bait/lure the player places to draw the worm
(or trigger a sarlacc-pit ambush) — turning the worm from a pure threat into something the player can bait/exploit
(e.g. lure a worm onto/near the sarlacc pit, or bait it to a spot to escape/divert it). "awe-not-horror."
- **DESIGN FIRST (it's net-new):** decide the exact mechanic before building. Likely shape — a craftable/placeable
  LURE item that, when deployed, emits a worm-attracting signal (the worm's `feeding`/bait state already exists —
  see `sandWorm.ts` `tickFeeding` + the meat-bait `FEED_DETECT_RADIUS`/`feeding` state, ACAJ B12). The sarlacc PIT
  exists (`src/enemies/sarlaccPit.ts`). The lure could: (a) bait a worm to a location (reuse the feeding-surface
  loop), and/or (b) near the sarlacc pit, set up an ambush. Pick the SIMPLEST coherent version + ship it; note the
  rest. Consider a `/research-topic` or a short design fan-out if the mechanic is unclear.
- Where: NEW item (inventory/types.ts ItemId + items.ts), a placeable (model + deploy, mirror `stake.ts`/`bedroll.ts`
  deploy patterns), the worm-attract hook (`sandWorm.ts` feeding/bait path), maybe `sarlaccPit.ts` interaction.
- **Save (D81):** a new placeable + item = additive; **likely a SAVE_VERSION surface-bump** (the deployed-lure list).
- **Determinism:** if it scatters/seeds, re-run verify:placement. **VISUAL** (the lure item + deployed model) → rig-shot
  (item-studio for the held item; a world shot for the deployed) + adversarial gate. **FEEL** (does baiting feel good) → walk-test.

## Worm rig-shot (reuse): `--scenario=worm-model --angle=head|side|3q|arc|charge` · item-studio `--item=<id>`

## Autonomy contract
- **⚡ ULTRACODE** (overnight, max-quality): adversarial Workflow gate on VISUAL; code-auditor on AUDIO/logic.
  **Rule 8** for visual (the lure item/model). **Save (D81)** additive + surface-bump if the schema grows.
  **Don't re-do already-done items** (C17 found multi-worm infra was already built — verify current state first).
- Pauses at the **Phase A milestone** (after M5b). Backstop **max-cycles=50**.

## Stop conditions
Phase A milestone (pause) · max-cycles=50 · 3 fix-walls · placement/collider regression unclearable in 2 tries ·
SAVE_VERSION bump (do it, surface only) · destructive-git attempt.

## Open backlog of note
- worm: per-worm rumble was solved as nearest-charging (C17); SANDWORM_COUNT tunable (encounter balance) · dorsal-crest contrast · head-beef.
- yard-cross-poi-merge (D240). Full list: `docs/backlog.md`.
