# Campaign log — Dustfall · "Scavenger's Economy (setup)" (started 2026-07-17)

Newest cycle at top. Prior campaign ("Sharpen & Deepen", 24 cycles, COMPLETE + SHIPPED to master
2026-07-17) archived at `campaign-log-sharpen-deepen-DONE.md` /
`campaign-state-sharpen-deepen-DONE.json`.

## Cycle 1 — #28 Skyfall stern seam (2026-07-17) — SHIPPED
- Planned: fix the hairline daylight crack at the Skyfall stern fracture rim.
- Shipped: root-caused to the SHARED `solidInner` bridge-band winding in `wreckForms.ts` — the
  outer+inner bridge bands used one winding, correct only for the +dz end; at the -dz (`endFlip`)
  end they were wound inside-out and culled under FrontSide → daylight through the 3cm lip. The
  stern's visible fracture is its endFlip end (fore's isn't) → "stern cracked, fore fine." Fixed by
  branching the bridge-band winding on `endFlip`. Winding-only; positions unchanged.
- Verify: verify (tsc) + verify:all (placement 5/5, colliders 70, chunks incl. skyfall/leviathan
  walk) + verify:solid --asset=skyfall AND --asset=leviathan → ALL GREEN. Determinism digests
  byte-identical (549b73d7 / f7d8ad9f) → no collider/save impact.
- Visual iteration: before/after grazing screenshots — daylight hairline → solid dark hull; fore
  mouth + leviathan seams unchanged (confirmed, shared-path no-regression).
- Spend: ~0.4M (campaign total 0.4M / 6M; cycle 1/16).
- Commit: 009ccca. Delegated the fix to one procedural-modeler agent (one-at-a-time rule).
- Follow-up logged (backlog): no gate catches sub-1% sliver hairlines — deferred, non-blocking.
- Next: Cycle 2 — #29 boneyard scatter overhaul (HERO visual; iterate + day/night check).

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
