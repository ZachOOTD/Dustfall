# Campaign cycle-9 kickoff — `campaign/2026-06-18`

> `/session-end` (focused, per-cycle) rewrote this. The roadmap is authoritative (skill Step 4).

## Boot order (re-read every cycle from FILES)
1. `docs/campaign/campaign-state.json` · 2. `docs/campaign/steering.md` · 3. `docs/roadmap.md` "Up next" · 4. `docs/iteration-plan.md` "Campaign 2026-06-18 — milestone ladder" · 5. `CLAUDE.md` + `docs/decisions.md` tail.

## Where we are
- ✓ **M1 COMPLETE** (C1-C4). **M2:** C5 feature-flags · C6 security-review · **wreck-polish-bundle `[partial]`** —
  C7 delta 1 (dorsal mass, 5-round gate) · C8 delta 2 chroma (assessed already-done, skipped) + delta 3 (engine-droop).
- **wreck-polish deltas done: 1 (dorsal mass), 2 (chroma, was already done), 3 (engine-droop). Remaining: 4 + 5.**

## Cycle 9 picks up: **wreck-polish delta 4 = scout/corvette guaranteed visible TRAUMA** · VISUAL
§F: scout + corvette sit fully PROUD (barely buried) + are the most-scrutinised, but can roll up clean/intact —
they need guaranteed visible damage. **Ensure ≥1 SHEARED hull / breach + a crash LIST on every scout + corvette.**
- Where: `procgenWreck.ts` — the SHEARED_HULL variant + `addBreachPatches` are gated by `rand()` per part
  (e.g. L723 `if (rand() < 0.7) addBreachPatches(...)`). For scout/corvette, FORCE at least one breach/shear +
  a list (the crash tilt). **DETERMINISM:** if you add a FORCED call, do it WITHOUT changing the `rand` draw
  count (a conditional that skips a rand desyncs the stream, D208) — gate on `cls`, and either keep the rand
  draw and override its effect, or add a rand-free forced breach. Re-run `verify:placement` + `verify:colliders`.
- **Visual gate:** rig-shot scout + corvette across a few seeds (`--class=scout --seeds=1,42,1337 --zoom=0.5`),
  confirm EVERY one shows visible trauma (breach/shear + list). Critique believability.

## Remaining after delta 4
- delta 5: scale-anchor exclusion pocket (lee greebles/seams don't punch through near the human hatch — a
  subtle placement fix). Then **M2's LAST unit `yard-cross-poi-merge`** (HIGH-RISK, own cycle — D237/D239
  re-attempt; revert+requeue on 2× audit fail). After M2 → M3.

> **CAP: 4 cycles left.** At `cycles_completed >= 12` the loop STOPS `completed (max-cycles)` — the calibration
> review (mid-Phase-A, mid wreck-polish). Resume: `/campaign-start --resume --max-cycles=<N>`. Per-cycle spend
> table is in `campaign-log.md` (visual cycles 150-290K, logic/material 50-170K).

## Autonomy contract
- **`phash`-determinism (D221)** — re-run `verify:placement` + `verify:colliders` after any geometry change; a
  rand-consuming conditional desyncs the stream (gate on `cls`, keep the draw count). **Rule 8** — visual work
  iterates; a NEW visual element = 5-8 rounds, a routine TUNING = solo-triage / 2-3 rounds. **Don't re-do
  already-done items** (verify the current state first — chroma + dish + scrap were largely done). **COLLIDER-AUDIT
  (D235)** · **Save (D81)** additive-only, surface bumps.

## Stop conditions
3 fix-walls on one element (→ scope-cut GDD §12, D-entry) · a placement/collider regression you can't clear in
2 tries · a needed `SAVE_VERSION` bump (surface) · destructive-git attempt · per-cycle spend exhausted (ship `[partial]`).
