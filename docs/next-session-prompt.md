# Campaign cycle-11 kickoff — `campaign/2026-06-18`

> `/session-end` (focused, per-cycle) rewrote this. The roadmap is authoritative (skill Step 4).

## Boot order (re-read every cycle from FILES)
1. `docs/campaign/campaign-state.json` · 2. `docs/campaign/steering.md` · 3. `docs/roadmap.md` "Up next" · 4. `docs/iteration-plan.md` "Campaign 2026-06-18 — milestone ladder" · 5. `CLAUDE.md` + `docs/decisions.md` tail.

## Where we are
- ✓ **M1 COMPLETE** (C1-C4). **M2:** C5 feature-flags · C6 security-review · **wreck-polish-bundle ✓ COMPLETE** (C7-C10,
  all 5 deltas: dorsal mass · chroma[already-done] · engine-droop · corvette/gunship trauma[read-polished C10] · scale-anchor pocket).
- **M2's LAST unit = `yard-cross-poi-merge` (cycle 11).** After it → M2 done → M3.

## Cycle 11 picks up: **`yard-cross-poi-merge`** · HIGH-RISK (D237/D239 re-attempt — own cycle)
The wreck-yard renders ~1477-3215 draw calls from many per-POI hull/greeble meshes. A cross-POI static merge (fold
shared-material meshes across adjacent POIs into one buffer) cuts draw calls. **PRIOR ATTEMPTS REVERTED TWICE** (D237
scope-cut, D239 re-attempt): the rim-greeble merge cut ~18% (3215→2633) but **regressed the terrain bury-audit**.
- Where: the static-merge path (`mergeStaticByMaterial`) + the POI assembler. D239 lead: re-attempt WITHOUT perturbing
  the **`panelDoorExtents` bottom-edge measure** (that's what the bury-audit keys on — the prior merge moved/!flattened
  geometry the audit samples). The rig-shot **wreck-yard scenario now reports drawCalls** (use it to measure the cut).
- **GUARDRAIL (D239):** revert + requeue on **2× audit fail** — do NOT thrash. `verify:placement` (terrain bury-audit)
  is the gate that broke before; run it FIRST after any merge change, ×5 seeds. If it regresses twice, REVERT, log a
  D-entry, leave `yard-cross-poi-merge` in the backlog, and move to M3 (don't burn the cap on it).
- **Determinism:** a merge that folds/reorders meshes must not change the `rand` stream or the panel/anchor/collider
  geometry the audits sample. `verify:all` (placement + colliders) is the hard gate.

## CAP — cycle 11 then 12, then STOP
> **2 cycles left.** At `cycles_completed >= 12` the loop STOPS `completed (max-cycles)` — the calibration review
> (mid-Phase-A: M2 nearly done, M3-M5b ahead). Cycle 11 = yard-merge (or its revert); cycle 12 = M3 start (worm +
> sarlacc-lure) OR yard-merge cleanup. Resume after review: `/campaign-start --resume --max-cycles=<N>`.
> **Per-cycle spend ROSE under ultracode** — C10 was ~600K (3 adversarial gate rounds); the cost table is in
> `campaign-log.md`. Flag this in the cap review so the user can decide ultracode-on vs off for the resume.

## Autonomy contract
- **⚡ ULTRACODE** (if still on — a system-reminder will confirm each turn): use a real adversarial **Workflow** gate
  (parallel critics + a code-auditor reading geometry SOURCE — it found the C10 root-cause bug a code change alone
  would've shipped) over solo-triage; cost is not a constraint, the 12-cap still bounds cycles. If the reminder says
  ultracode is OFF, revert to scaled gates (solo-triage for routine tweaks).
- **`phash`-determinism (D221/D208)** — re-run `verify:placement` + `verify:colliders` after ANY geometry change; a
  rand-consuming conditional desyncs the stream (gate on `cls`/hash2, keep the draw count). Watch the **types** ('scout'
  is NOT a `ProcgenWreckClass`). **Hull-frame gotcha (C10):** part body centre is `y≈r*0.55`, crown `≈r*1.55`, `y=0`
  is the underside — anchor decorations to that, not y=0. **Rule 8** · **COLLIDER-AUDIT (D235)** · **Save (D81)** additive.

## Stop conditions
3 fix-walls on one element (→ scope-cut GDD §12, D-entry) · a placement/collider regression you can't clear in 2 tries
(yard-merge: REVERT on 2× fail per D239) · a needed `SAVE_VERSION` bump (surface) · destructive-git attempt.
