# Campaign log — Dustfall · "Scavenger's Economy (setup)" (started 2026-07-17)

Newest cycle at top. Prior campaign ("Sharpen & Deepen", 24 cycles, COMPLETE + SHIPPED to master
2026-07-17) archived at `campaign-log-sharpen-deepen-DONE.md` /
`campaign-state-sharpen-deepen-DONE.json`.

## Cycle 4 — economy proposal (2026-07-18) — PROPOSED → PAUSED (milestone-review)
- Planned: synthesize the research + current code into a decision-ready economy proposal, then
  pause. Written by the main loop (Fable) per the model-split steering.
- Shipped: `docs/campaign/economy-proposal.md` — 4 new materials (metal/wiring/fuel/casing;
  chemical deferred), a per-POI drop matrix, 8 NEW recipes (the existing 20 untouched — changing
  them would silently rebalance the released tutorial arc), the 3-loot-systems→1-registry
  unification plan (loot-preserving, 1000-roll digest gate), UX improvements, Q1-Q6 each with a
  default, and the 5-cycle build ladder. Plus `morning-summary-2026-07-18.md`.
- **NO ItemIds baked, NO loot tables changed** (the hard rule for this run — held).
- Verify: docs-only; tsc clean.
- Spend: ~0.1M (campaign total ~1.0M / 6M; cycle 4/16).
- **PAUSED**: status paused, awaiting_approval true, stop_reasons ["milestone-review"]. The loop
  is stopped. Zach: read the proposal → `/campaign-approve` (answers to Q1-Q6 optional; defaults
  apply) → restart `/loop /campaign-cycle` for the build ladder.

## Cycle 3 — research swarm (2026-07-17) — SHIPPED
- Planned: 4 read-only research digests (the sanctioned parallel exception).
- Shipped: `docs/research/crafting-improvements.md` (taxonomy survey + a recommended leaner 4-5
  material set mapped to POI archetypes + bench-free recipe patterns — feeds cycle 4),
  `multiplayer-architecture.md` (P2P host-auth + relay for a 2-4 co-op MVP; the deterministic
  world means only inputs/diffs/creatures sync), `character-pipeline.md` (procedural-push vs
  import vs animation-only retarget; current rig likely adequate for a co-op MVP silhouette),
  `cave-feasibility.md` (heightfield is one-sided/fragile; architecture ladder + the concrete
  D254 spike script).
- Verify: no source changes; tsc clean.
- Spend: ~0.15M (campaign total ~0.9M / 6M; cycle 3/16).
- Commit: 2c58916.
- Next: Cycle 4 — synthesize the economy proposal (Fable/main-loop per steering), then PAUSE
  awaiting Zach's morning approval.

## Cycle 2 — #29 boneyard scatter overhaul (2026-07-17) — SHIPPED
- Planned: bring the boneyard scatter to hero quality — darker hero material, real bones instead
  of rounded rings, more skeleton variety, night-correct lighting.
- Shipped: 5-type real-bone vocabulary (cracked longbones w/ jagged snap ends + epiphysis
  knuckles; rib-fans; vertebral chains w/ neural fins + decay; loose vertebra chunks; small
  partial CARCASS skeletons), all reusing the hero's sweptTube+jag fracture pipeline and the
  hero's material OBJECT (one shared material, one sun-driven emissive registration). Scatter
  bits stay deliberately noCollider (step-over decoration); walk-into silhouettes keep colliders.
- Verify: tsc clean; verify:all PASS (placement 5/5, colliders 70, chunks determinism 8/8 ×2
  seeds, streaming no-leak, both walk gates); verify:solid --asset=ribcage all OK (hero
  no-regression). Night probe: emissive live=0.000 night / 0.360 day; 273/273 streamed bone
  meshes on 1 registered material. **The scatter no longer glows at night.**
- Visual iteration: 2 agent rounds (round 2 reshaped the vertebra — read rock-like) + my own
  independent read of day-ground / night-flank / entry-vista screenshots. Appearance-verified;
  feel-pending (walk-under density is on Zach's walk-test list).
- Steering received (mid-cycle, processed at this boundary): "use fable for the thinking and
  planning and opus for the execution" → main loop stays Fable; execution subagents get
  `model: opus` from cycle 3 on; researchers stay on the cheap researcher model per the approved
  plan. Archived to steering-archive.md.
- Spend: ~0.35M (campaign total ~0.75M / 6M; cycle 2/16).
- Commit: e90344b.
- Next: Cycle 3 — the 4-digest research swarm (crafting / multiplayer / character / cave).

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
