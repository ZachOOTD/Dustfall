# Campaign cycle-12 kickoff (THE CAP CYCLE) — `campaign/2026-06-18`

> `/session-end` (focused, per-cycle) rewrote this. The roadmap is authoritative (skill Step 4).

## ⛔ THIS IS THE LAST CYCLE BEFORE THE CAP
`cycles_completed` will hit **12 = ceiling.max_cycles** at the end of cycle 12 → the loop self-halts
**`completed (max-cycles)`** for the user's calibration review. So: pick ONE bounded unit, ship it (likely
`[partial]`), and do NOT start a sprawling build you can't close. After cycle 12, STOP — set `status:"completed"`,
`stop_reasons:["max-cycles"]`, do NOT ScheduleWakeup.

## Boot order (re-read every cycle from FILES)
1. `docs/campaign/campaign-state.json` · 2. `docs/campaign/steering.md` · 3. `docs/roadmap.md` "Up next" · 4. `docs/iteration-plan.md` · 5. `CLAUDE.md` + `docs/decisions.md` tail (D240 = yard-merge defer).

## Where we are
- ✓ **M1 COMPLETE** (C1-C4). ✓ **M2 CONTENT COMPLETE** (C5-C11: feature-flags · security · wreck-polish-bundle 5/5;
  yard-cross-poi-merge DEFERRED to a perf session — D240, recon-backed).
- **M3 — The worm + the pit** is next. Roadmap order: **worm-model-overhaul → worm-tail-buried → worm-charge-dive →
  worm-audio-rumble → multi-worm-population → sarlacc-lure-ambush** (worm model+tail BEFORE population).

## Cycle 12 picks up: **M3 → `worm-model-overhaul`** · VISUAL (the first worm unit)
Improve the worm's model/silhouette (the GDD's awe-not-horror hero creature). Scope it to fit ONE cap cycle —
likely ship `[partial]` (the model pass) and leave tail/dive/audio/population/lure for the resume.
- Where: grep for the worm — `src/world/` or `src/entities/` (worm mesh/model), `updateWorm`-style tick in `main.ts`,
  `src/config/tuning.ts` WORM_* constants. Find the current worm model first.
- **DETERMINISM:** if the worm is procgen/seeded, honor `phash`/`hash2` (D221) + re-run `verify:all`. If it's a
  hand-model (likely), verify is just tsc + the unchanged placement/collider audits.
- **Visual gate (ultracode → real Workflow):** rig-shot the worm (find/add a worm scenario; check `scripts/rig-shot.mjs`)
  → adversarial Workflow gate (the C10 gate found a root-cause bug a code change would've shipped). Front-light +
  length-frame first. Mark FEEL (the worm's motion/menace) feel-pending the walk-test.

## CAP REVIEW HAND-OFF (write this into the C12 close for the user)
- **11 cycles done, ~2.5M spend.** Cost arc: C1-C8 ran 50-290K; **C10 ~600K + C11 ~300K under ULTRACODE** (adversarial
  Workflow gates + a deep recon). Ultracode ~2-4×'d per-cycle cost — but C10's gate FOUND A ROOT-CAUSE BUG solo
  iteration missed, and C11's recon prevented a 3rd wasteful failed merge attempt. **The user should decide ultracode
  ON vs OFF for the resume** (`/campaign-start --resume --max-cycles=<N>` — and optionally `/effort` to drop ultracode).
- **Owed walk-tests** (headless can't judge feel) accumulate at the Phase-A milestone: wreck seating/banking, scrap
  in-hand, dish-collider snag, engine-droop, corvette/gunship breach, + the worm.
- Phase A (M3-M5b) is still ahead — the resume continues there.

## Autonomy contract
- **⚡ ULTRACODE** (if a system-reminder confirms it ON): real adversarial **Workflow** gates + recon over solo-triage;
  cost not a constraint, the cap bounds cycles. If OFF: scaled gates.
- **`phash`-determinism (D221/D208)** · **hull-frame gotcha (C10): body centre y≈r*0.55, crown ≈r*1.55, y=0 = underside**
  · **'scout' is NOT a `ProcgenWreckClass`** · **Rule 8** (visual iterates) · **COLLIDER-AUDIT (D235)** · **Save (D81)** additive.

## Stop conditions
The CAP (cycle 12 → completed). Plus: 3 fix-walls on one element (→ scope-cut/D-entry) · a placement/collider
regression you can't clear in 2 tries · a needed `SAVE_VERSION` bump (surface) · destructive-git attempt.
