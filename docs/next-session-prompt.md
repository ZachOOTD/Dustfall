# Campaign cycle-15 kickoff (overnight, ultracode) — `campaign/2026-06-18`

## Boot order (re-read every cycle from FILES)
1. `docs/campaign/campaign-state.json` · 2. `docs/campaign/steering.md` · 3. `docs/roadmap.md` "Up next" · 4. `docs/iteration-plan.md` · 5. `CLAUDE.md` + `docs/decisions.md` tail (D240).

## Where we are
- ✓ M1 · ✓ M2 content (yard-merge deferred D240) · **M3 IN PROGRESS:** ✓ worm-model-overhaul (C12-C13) · ✓ worm-tail-buried (C14).
- **M3 order:** model ✓ · tail-buried ✓ → **worm-charge-dive (cycle 15)** → worm-audio-rumble → multi-worm-population → sarlacc-lure-ambush.

## Cycle 15 picks up: **M3 → `worm-charge-dive`**
The charge→dive read: when the worm commits to an attack it should CHARGE (a visible underground approach — a sand wake / tremor bulge racing toward the player) then DIVE/breach. Check what `charging` + the lunge transition currently do (`sandWorm.ts` updateSandWorm `case 'charging'`/`enterCharging`/`enterLunge`; the wake-puff/tremor particles; `nextWakePuffAt`, `SandPuff`). The unit is likely: strengthen the underground charge tell (a clearer sand wake bulge tracking the worm's submerged approach) + a committed dive into the breach.
- Where: `sandWorm.ts` — the charging state + the particle/wake system (grep `wake`, `puff`, `tremor`, `charging`, `SANDWORM_CHARGE`). Tuning in `tuning.ts` SANDWORM_*.
- **VISUAL + FEEL:** the wake/tremor is a particle effect (can rig-shot a static frame) + the charge timing is FEEL (walk-test). Gate the LOOK of the wake bulge; mark the charge timing/feel feel-pending.
- **Determinism:** worm is behavior + particles (uses its own RNG for puffs, not the procgen rand stream) → verify = tsc + unchanged placement/colliders. Don't break the worm's own RNG seeding if save/load depends on it (check `worm` save fields).

## Worm rig-shot (reuse): `--scenario=worm-model --angle=head|side|3q|arc`
`arc` = a faithful static lunge-peak pose (mirrors `applyBodyBend`). Add more angles/poses as needed for the unit under test.

## Autonomy contract
- **⚡ ULTRACODE** (overnight, max-quality): adversarial Workflow gates on visual/hero work; **Rule 8** (hero = 5-8 rounds). **Feel-heavy units:** gate the static LOOK, mark MOTION/timing feel-pending the walk-test (C14 worm-tail-buried did this). **Save (D81)** additive.
- Pauses at the **Phase A milestone** (after M5b). Backstop **max-cycles=50**.

## Stop conditions
Phase A milestone (pause) · max-cycles=50 · 3 fix-walls on one element (→ scope-cut/D-entry) · placement/collider regression unclearable in 2 tries · SAVE_VERSION bump · destructive-git attempt.

## Open backlog of note
- worm: dorsal-crest contrast · head-beef / per-segment chitin · breach FEEL walk-test (tail-buried + front-hump height) · tail-entry sand spray. · yard-cross-poi-merge (D240). Full list: `docs/backlog.md`.
