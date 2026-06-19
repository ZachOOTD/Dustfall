# Campaign cycle-8 kickoff — `campaign/2026-06-18`

> `/session-end` (focused, per-cycle) rewrote this. The roadmap is authoritative (skill Step 4).

## Boot order (re-read every cycle from FILES)
1. `docs/campaign/campaign-state.json` · 2. `docs/campaign/steering.md` · 3. `docs/roadmap.md` "Up next" · 4. `docs/iteration-plan.md` "Campaign 2026-06-18 — milestone ladder" · 5. `CLAUDE.md` + `docs/decisions.md` tail.

## Where we are
- ✓ **M1 COMPLETE** (C1-C4). **M2 in progress:** C5 feature-flags · C6 security-review · **C7 wreck-polish delta 1 (non-axial dorsal mass) — `addDorsalMass` in procgenWreck.ts, 5-round visual gate PASS.**
- **`wreck-polish-bundle` is `[partial]`** — delta 1 of 5 done. 4 deltas remain (this is a multi-cycle unit; ship `[partial]` per delta).

## Cycle 8 picks up: **Phase A → M2 → wreck-polish-bundle delta 2 = up-close weathering CHROMA** · VISUAL
The §F note: up-close weathering reads flat/muddy. **Push the chroma:** oxide more ORANGE (not mud-brown),
lift seam-rust OUT of shadow (so seams read), make gravity drips rust-coloured + seam-gated. Levers:
`src/world/hullMaterial.ts` — the `HULL_WEATHERING_ACAY` shared profile + the per-bucket `BUCKET_WEATHERING`
strength overrides (D234). This is a MATERIAL-only change (no geometry) → should add ZERO new shader programs
(it rides the shared `onBeforeCompile`); confirm with perf-probe (programs ≤72).
- **Visual gate REQUIRED:** rig-shot a wreck up-CLOSE (`procgen-wreck --class=<heavy> --zoom=0.3` or a tank/derelict
  archetype; front-light + length-frame), critique the oxide/seam/drip chroma. The dorsal mass (C7) re-skins via
  the same buckets, so confirm it stays cohesive.
- **Determinism:** material-only → no rand/geometry change → verify:placement/colliders unaffected (still re-run them).

## Remaining wreck-polish deltas (after chroma)
- delta 3: engine-droop sign-randomize + ~15% nozzle-detach (`procgenWreck.ts` engineModule — the droop is
  applied at assembleWreck ~L1535 via hash2; widen + sometimes detach). delta 4: scout/corvette guaranteed
  visible trauma (≥1 SHEARED/breach + a list). delta 5: scale-anchor exclusion pocket (lee greebles don't punch
  through near the hatch). Each its own delta-cycle (rule 8, visual gate).

## Then: M2's LAST unit
`yard-cross-poi-merge` (HIGH-RISK, own cycle — the D237/D239 re-attempt; revert+requeue on 2× audit fail).
After M2 → M3. Phase A pauses ONLY at the `### Milestone: Phase A — Build-out complete` marker.

> **CAP:** at `cycles_completed >= 12` the loop STOPS `completed (max-cycles)` (calibration review, mid-Phase-A).
> Resume: `/campaign-start --resume --max-cycles=<N>`.

## Autonomy contract
- **`phash`-determinism (D221)** — re-run `verify:placement` + `verify:colliders` after any POI/panel/geometry
  change; material-only changes don't touch the rand stream. **Rule 8** — visual work iterates (front-light +
  length-frame first); a NEW visual element budgets 5-8 rounds (the dorsal mass took 5). **COLLIDER-AUDIT (D235)**
  · **Save (D81)** additive-only, surface bumps.

## Stop conditions
3 fix-walls on one element (→ scope-cut GDD §12, D-entry) · a placement/collider regression you can't clear in
2 tries · a needed `SAVE_VERSION` bump (surface) · destructive-git attempt · per-cycle spend exhausted (ship `[partial]`).
