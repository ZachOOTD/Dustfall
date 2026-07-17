# Campaign log — Dustfall · "Scavenger's Economy (setup)" (started 2026-07-17)

Newest cycle at top. Prior campaign ("Sharpen & Deepen", 24 cycles, COMPLETE + SHIPPED to master
2026-07-17) archived at `campaign-log-sharpen-deepen-DONE.md` /
`campaign-state-sharpen-deepen-DONE.json`.

## Cycle 0 — campaign started (2026-07-17)
- **Goal:** close Phase 1 (#28 Skyfall stern seam, #29 boneyard scatter) + 4 research digests +
  a decision-ready economy proposal, then PAUSE for morning approval. No balance decision baked
  overnight.
- **Budget:** max-cycles 16 (hard stop) · ~6M tokens (soft).
- **Checkpoint:** pause at the economy proposal. **Self-author:** none (fixed queue).
- **Verify gate:** `npm run verify:all` + `verify:solid` on any touched hero asset.
- **Branch:** `campaign/2026-07-17-economy` (held; not merged to master).
- **Baseline:** verify + verify:all + verify:solid all GREEN at launch (Phase 0 shipped to master
  earlier today; hab_dome unsealed → verify:solid clean on all 4 assets).
- **Plan of record:** `docs/campaign/plan-2026-07-17.md` (do NOT re-plan).
- **Next:** Cycle 1 builds #28 (Skyfall stern seam) — fix at the shared `solidInner` lip weld in
  `wreckForms.ts`, not a stern patch.
