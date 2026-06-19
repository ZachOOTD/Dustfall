# Campaign cycle-10 kickoff — `campaign/2026-06-18`

> `/session-end` (focused, per-cycle) rewrote this. The roadmap is authoritative (skill Step 4).

## Boot order (re-read every cycle from FILES)
1. `docs/campaign/campaign-state.json` · 2. `docs/campaign/steering.md` · 3. `docs/roadmap.md` "Up next" · 4. `docs/iteration-plan.md` "Campaign 2026-06-18 — milestone ladder" · 5. `CLAUDE.md` + `docs/decisions.md` tail.

## Where we are
- ✓ **M1 COMPLETE** (C1-C4). **M2:** C5 feature-flags · C6 security-review · **wreck-polish-bundle `[partial]`** —
  C7 delta 1 (dorsal mass) · C8 delta 2 chroma (already-done) + delta 3 (engine-droop) · C9 delta 4 (corvette/gunship trauma).
- **wreck-polish deltas: 1✓ 2✓(already-done) 3✓ 4✓(read-polish flagged → backlog §F). Remaining: delta 5.**

## Cycle 10 picks up: **wreck-polish delta 5 = scale-anchor exclusion pocket** · VISUAL (likely a quieter cycle)
§F: lee greebles / panel seams can punch THROUGH the hull near the human scale-anchor hatch, breaking the one
human-constant reference that sells wreck scale. Carve a small **exclusion pocket** around each scale-anchor so
greebles/seams/panels don't overlap it.
- Where: `procgenWreck.ts` — the scale-anchor block (`addScaleAnchor`, ~L1650-1700) sets `anchorLeeSide` +
  seats the hatch on the part's real +Z flank. `findSurfaceMounts` / `addHullGreebles` / panel placement need to
  treat a radius-R disc around the anchor's (x,y,z) as off-limits. Cleanest: tag the anchor's footprint (reuse the
  `isWreckDecoration` reject path the breach gash uses) OR add an explicit exclusion-radius check in the greeble/
  panel-mount loops keyed off the anchor position.
- **DETERMINISM:** if the exclusion changes how many greebles/panels are placed, that's fine ONLY if it doesn't
  change the **rand draw count** (skipping a rand-gated placement desyncs — D208). Prefer: keep the draw, reject
  the RESULT (place-then-discard if it lands in the pocket), or use a hash2/phash exclusion test (no rand). Re-run
  `verify:placement` ×5 + `verify:colliders`. If panel COUNT shifts but positions are otherwise identical + 0-fail,
  that's the intended un-collision (precedent: C2 sand-mound 79→80).
- **Visual gate:** rig-shot a wreck that has a scale-anchor (`procgen-wreck --class=freighter --zoom=0.4`), confirm
  the hatch sits in a clean pocket (no greeble/seam clipping it). Lighter pass — it's a subtle placement fix.

## After delta 5 → wreck-polish-bundle COMPLETE; then M2's last unit:
- **`yard-cross-poi-merge`** (HIGH-RISK, own cycle — D237/D239 re-attempt; revert+requeue on 2× audit fail). Then M3.

> **CAP: 3 cycles left (cycle 10 next).** At `cycles_completed >= 12` the loop STOPS `completed (max-cycles)` — the
> calibration review (mid-Phase-A, mid wreck-polish). Resume: `/campaign-start --resume --max-cycles=<N>`. The cap
> will likely land at delta-5 + the start of yard-merge — Phase A is NOT reached within 12.

## Autonomy contract
- **`phash`-determinism (D221)** — re-run `verify:placement` + `verify:colliders` after any geometry change; a
  rand-consuming conditional desyncs the stream (gate on `cls`/hash2, keep the draw count). Watch the **types**: not
  every conceptual name is a `ProcgenWreckClass` ('scout' is a rig-shot fallback, NOT a class — C9 caught this in tsc).
  **Rule 8** — visual work iterates (new element 5-8 rounds, tuning 3-5 / solo-triage); **flag honest read-conviction**
  when a visual ships modest (C9 trauma → backlog §F). **Don't re-do already-done items.** **COLLIDER-AUDIT (D235)** ·
  **Save (D81)** additive-only, surface bumps.

## Stop conditions
3 fix-walls on one element (→ scope-cut GDD §12, D-entry) · a placement/collider regression you can't clear in
2 tries · a needed `SAVE_VERSION` bump (surface) · destructive-git attempt · per-cycle spend exhausted (ship `[partial]`).
