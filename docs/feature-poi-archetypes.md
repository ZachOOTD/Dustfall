# Feature slice — M6 POI breadth (new procgen archetypes)

**Campaign:** Sharpen & Deepen · milestone M6 (`[gate-verified]`).
**Definition of Done:** 2-3 NEW procgen POI archetypes, each DISTINCT at silhouette level, tone-appropriate, reusing the socket/component grammar + material buckets, wired into `ARCH_WEIGHTS` (all biomes), collider-audited + placement-clean + visual-gated (routine bar: no sev≥2). One archetype per cycle, built to depth — NOT 2-3 shallow ones in one cycle (anti-punt: CLAUDE.md rule 8 + campaign-cycle 4b).

## Sub-tasks (one per cycle)

- [x] **A1 — relay_mast** (cycle 5, D285) ✅ — a fallen guyed lattice comms tower. The silhouette the set lacked (TALL + THIN). `latticeMast` component (`poiComponents.ts`) + `assembleRelayMast` + registry + weights. Envelope-cylinder + base-box colliders (audit 5/5 ×4 seeds); placement PASS ×5 seeds; visual-gated (whip-antenna weathering polish). Reskins to the `cool` bucket.
- [ ] **A2 — buried_pipeline** (cycle 6) — a surfacing/sinking PIPE RUN: 4-6 large cylinder segments that breach + dive under the sand along a line, with a junction/valve hub + a collapsed segment. Distinct LOW HORIZONTAL segmented silhouette (contrast to the vertical mast). Reuse `hullBarrel`-style cylinders; `dark`/`warm` bucket. Colliders: a cylinder per surfaced segment + a box hub. Salvage panel on the hub. Biome: favor salt/dune (old freight-line infrastructure).
- [ ] **A3 — cargo_crawler** (cycle 7, SCOPE-CUTTABLE per charter scope-cut #2) — a tracked hauler wreck: a cab block + a tread/bogie assembly (toppled or half-buried) + 1-2 spilled cargo containers nearby. Heavier build (new tread component). If budget/cycles tighten, DoD is met at 2 archetypes (A1+A2) and A3 drops.

## Invariants every archetype must hold
- Determinism: ONE `seedOf(rand)` draw in the assembler; everything else `phash` (D226). verify:placement ×5 seeds is the tripwire.
- Colliders: declared exact primitives; every collidable-scale mesh ≥40% covered (D228); add the archetype id to the `verify:colliders` default list in `rig-shot.mjs` (line ~1023) so the permanent gate audits it.
- Rebalance `ARCH_WEIGHTS` so each biome table still sums ≈1.0 (shave an abundant sibling by the added weight).
- Decorations ≥10cm depth where box-based on an outward surface (rule 7); auto-registers as a sun occluder via the cycle-2 procgenPoi hook (no action).
- Visual: render via the `procgen-wreck` rig framer at real placement; routine bar (no sev≥2) after ≤3 rounds.
