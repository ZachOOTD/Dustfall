# 🏁 CAMPAIGN PAUSED AT THE CAP — calibration review, then RESUME — `campaign/2026-06-18`

The loop hit `cycles_completed = 12 = max_cycles` and **self-halted `completed (max-cycles)`**. This is the
calibration stop the 12-cap exists for. **To continue:** review below, then `/campaign-start --resume
--max-cycles=<N>` (optionally toggle ultracode via `/effort` first — see the cost note).

## What shipped (12 cycles, ~2.5M spend, branch `campaign/2026-06-18`)
- ✓ **M1 — Wreck-arc finish** (C1-C4): panel-deadcode-cleanup · perf-reprofile · remove-sand-mounds · scrap-3q · dish-collider.
- ✓ **M2 — Wreck breadth + polish + infra CONTENT COMPLETE** (C5-C11): feature-flags · security-review (+vite vuln fix) ·
  **wreck-polish-bundle 5/5** (dorsal mass · chroma[already-done] · engine-droop · corvette/gunship trauma[C10 gate found
  a root-cause coordinate bug] · scale-anchor pocket) · yard-cross-poi-merge **DEFERRED to a perf session** (D240, C11 recon).
- ◐ **M3 — The worm STARTED** (C12): NEW `worm-model` rig-shot + maw FANG overhaul (gate-verified) `[partial]`.

## ⚖️ CALIBRATION DECISIONS FOR THE USER (the point of this stop)
1. **Ultracode ON vs OFF for the resume.** C1-C8 ran 50-290K/cycle; **C10 ~600K, C11 ~300K, C12 ~400K under ultracode**
   (~2-4×). What ultracode BOUGHT: C10's gate found a coordinate bug 4 rounds of solo eyeballing missed; C11's recon
   prevented a 3rd wasteful failed merge. For the content-heavy M3-M5b stretch (lots of new models), ultracode's
   adversarial gates are high-value on hero assets but pricey on routine work. **Suggest: ultracode ON for hero/visual
   cycles, OFF (`/effort` down) for logic/audio/data.** Your call.
2. **Owed attended WALK-TESTS** (headless can't judge FEEL) — do a `npm run dev` pass before/alongside the resume:
   wreck seating/banking · scrap in-hand 3q · dish-collider snag-at-diagonals · engine-droop feel · corvette/gunship
   breach in-world · **the worm's motion/menace + the new fang maw up close.**
3. **Resume cap.** 12 was the calibration backstop. For run-to-completion set it high (e.g. 60-120) + `--until=roadmap-empty`.

## RESUME picks up: **M3 → finish `worm-model-overhaul`** then the M3 chain
- The `worm-model` rig-shot exists now (`--scenario=worm-model --angle=head|side|3q`) — USE IT to gate the worm.
- **worm-model-overhaul remaining (5-8 rounds, hero creature):** full-body character/awe pass — the side silhouette is
  a fairly uniform ribbed tube; give it more ancient-leviathan presence (dorsal armor plates? a more massive defined
  head? per-segment chitin variation?). Maw fang sev1 polish: top-fang angle + near-side depth read (C12 gate notes).
- Then: worm-tail-buried · worm-charge-dive · worm-audio-rumble · multi-worm-population · **sarlacc-lure-ambush** (the
  user-requested ADD — build it). Then M4 → M5 → M5a → M5b → **Phase A milestone (full review + walk-test)**.

## Autonomy contract (for the resume)
- **`phash`-determinism (D221/D208)** · **hull-frame gotcha (C10): part body centre y≈r*0.55, crown ≈r*1.55, y=0 = underside**
  · **'scout' is NOT a `ProcgenWreckClass`** · **Rule 8** (hero visual = 5-8 rounds; flag honest read-conviction) ·
  **don't re-do already-done items** (verify current state — chroma/dish/scrap/D240 were all caught as done/deferred) ·
  **COLLIDER-AUDIT (D235)** · **Save (D81)** additive-only.
- **Adversarial Workflow gates** (when ultracode) read geometry SOURCE, not just renders — that's what found C10's bug.

## Open backlog of note
- yard-cross-poi-merge (D240 — perf session: instrument the audit perturbation FIRST) · §G fleet polish residuals ·
  the C12 worm fang sev1 nits. Full list: `docs/backlog.md`.
