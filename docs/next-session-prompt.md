# Campaign cycle-7 kickoff — `campaign/2026-06-18`

> `/session-end` (focused, per-cycle) rewrote this. The roadmap is authoritative (skill Step 4).

## Boot order (re-read every cycle from FILES)
1. `docs/campaign/campaign-state.json` · 2. `docs/campaign/steering.md` · 3. `docs/roadmap.md` "Up next" · 4. `docs/iteration-plan.md` "Campaign 2026-06-18 — milestone ladder" · 5. `CLAUDE.md` + `docs/decisions.md` tail.

## Where we are
- ✓ **M1 COMPLETE** (C1-C4). **M2 in progress (2/4):** C5 `feature-flags-infra` · C6 `security-review-repo` (clean; vite→8.0.16, 0 vulns).

## Cycle 7 picks up: **Phase A → M2 — `wreck-polish-bundle` (the §F/§G sev-2/3 set)** · VISUAL
This is the meaty visual M2 unit — **likely spans >1 cycle; ship `[partial]` and continue.** The §F/§G deltas
(all on the procgen wreck system — `procgenWreck.ts` / `poiComponents.ts` / `poiArchetypes.ts` / `hullMaterial.ts`):
1. **Non-axial mass per heavy class** — a dorsal superstructure / sponson / bridge tower on the heavy ship
   classes so the silhouette isn't a length-axis "sausage". (The §F #1 read issue.) Highest-value.
2. **Up-close weathering chroma** — push oxide more orange, lift seam-rust out of shadow, make gravity drips
   rust-coloured + seam-gated (`hullMaterial.ts` `HULL_WEATHERING_ACAY` / the `BUCKET_WEATHERING` levers).
3. **Engine droop** — sign-randomize + widen the nozzle droop; ~15% fully detach the nozzle off its mount.
4. **Scout/corvette guaranteed visible trauma** — ≥1 SHEARED/breach + a list, since they sit fully proud + are most-scrutinised.
5. **Scale-anchor exclusion pocket** — lee-flank greebles/seams don't punch through near the human-scale hatch/door.
**Approach:** pick 1-2 deltas per cycle (rule 8 — build → rig-shot → critique → iterate). **Re-run
`verify:placement` + `verify:colliders` after ANY geometry change** (D221/D235). **Visual gate REQUIRED**
per delta: rig-shot the affected archetype/class (front-light + length-frame; `procgen-wreck --archetype=`
or `--class=`), fan critics, PASS iff no sev≥2. **Determinism:** new geometry must use `phash`, not `rand`
draws that desync the stream (D221) — or a rand-preserving approach (C2 precedent).

## Remaining M2 unit (LAST)
- `yard-cross-poi-merge` (M · headless · **HIGH-RISK, own cycle**) — the D237/D239 re-attempt; fold the yard
  sub-groups WITHOUT perturbing `panelDoorExtents` bottom-edge (regressed the bury-audit twice). Run
  `pruneBuriedPanels`/`validatePanels` before the cross-merge. **Fails audit twice → revert+requeue;
  3-strike → scope-cut GDD §12 + D-entry.** The `wreck-yard` rig-shot reports drawCalls for measurement.

After M2 → M3. Phase A pauses ONLY at the `### Milestone: Phase A — Build-out complete` marker.

> **NOTE on the cap:** at `cycles_completed >= 12` the loop STOPS `completed (max-cycles)` — the planned
> first calibration review (mid-Phase-A). To continue: `/campaign-start --resume --max-cycles=<N>`.

## Autonomy contract
- **`phash`-determinism (D221)** — re-run `verify:placement` + `verify:colliders` after any POI/panel/geometry
  change; rand-preserving for non-last `rand` draws (C2). **Rule 8** — visual work iterates (front-light +
  length-frame first). **COLLIDER-AUDIT (D235)** — a new structural mesh needs a declared collider or an
  `auditExempt`/`isWreckDecoration` tag. **Save (D81)** — additive only; surface any bump.

## Stop conditions
3 fix-walls on one element (→ scope-cut GDD §12, D-entry) · a placement/collider regression you can't clear in
2 tries · a needed `SAVE_VERSION` bump (surface) · destructive-git attempt · per-cycle spend exhausted (ship `[partial]`).
