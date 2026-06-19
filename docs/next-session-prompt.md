# Campaign cycle-14 kickoff (overnight, ultracode) — `campaign/2026-06-18`

## Boot order (re-read every cycle from FILES)
1. `docs/campaign/campaign-state.json` · 2. `docs/campaign/steering.md` · 3. `docs/roadmap.md` "Up next" · 4. `docs/iteration-plan.md` · 5. `CLAUDE.md` + `docs/decisions.md` tail (D240).

## Where we are
- ✓ M1 · ✓ M2 content (yard-merge deferred D240) · **M3 IN PROGRESS:** ✓ worm-model-overhaul (C12 rig-shot + maw fangs · C13 dorsal armor, gate-approved).
- **M3 order:** worm-model ✓ → **worm-tail-buried (cycle 14)** → worm-charge-dive → worm-audio-rumble → multi-worm-population → sarlacc-lure-ambush.

## Cycle 14 picks up: **M3 → `worm-tail-buried`**
The Dune read: only PART of the worm surfaces — the tail stays buried in the sand during surface states (lunge / stationaryBreach), so it reads as a creature emerging FROM the earth, not a free-floating tube hovering above it.
- Where: `src/enemies/sandWorm.ts` — the surface-state arc/pose code (lunge arc, stationaryBreach rise; grep `UNDERGROUND_DEPTH`, `surfaceGroundY`, the pitch/bend during lunge). The body is along local +X (head +X, tail −X). During a breach the HEAD/front arcs up but the TAIL end (−X) should stay anchored at/below the sand line.
- **Likely a tuning + pose change** (not new geometry): clamp/anchor the tail's world-Y to the ground during surface states, or bend the body so the tail dives back under near the breach point. Check `tuning.ts` SANDWORM_* (UNDERGROUND_DEPTH, arc height, bend).
- **VISUAL + FEEL:** rig-shot can't easily pose a live breach — this is partly a feel unit. Use the `worm-model` scenario for the static read if useful, but the breach POSE owes the walk-test. If you add a breach-pose rig-shot angle, gate the LOOK; mark the breach FEEL feel-pending.
- **Determinism:** worm is a hand-model + behavior (no procgen rand stream) → verify = tsc + unchanged placement/colliders. The worm's COLLIDER (cuboid, rotated to yaw/pitch) may need to follow the buried-tail pose — keep it consistent with the visible body.

## Autonomy contract
- **⚡ ULTRACODE** (overnight, user chose max-quality): adversarial Workflow gates on visual/hero work; the worm is hero content. **Rule 8** (hero = 5-8 rounds). **Hull-frame gotcha doesn't apply to the worm** (different model). **worm-model rig-shot:** `--scenario=worm-model --angle=head|side|3q`. **Save (D81)** additive.
- Pauses at the **Phase A milestone** (after M5b) for the design-gated Phase B review. Backstop **max-cycles=50**.

## Stop conditions
Phase A milestone (pause) · max-cycles=50 · 3 fix-walls on one element (→ scope-cut/D-entry) · placement/collider regression unclearable in 2 tries · SAVE_VERSION bump · destructive-git attempt.

## Open backlog of note
- worm dorsal-crest contrast (C13 sev3 nit — could be pushed prouder) · worm head-beef / per-segment chitin (optional) · yard-cross-poi-merge (D240, perf session) · owed walk-tests. Full list: `docs/backlog.md`.
