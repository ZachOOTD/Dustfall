# Feature slice — M6 POI breadth (new procgen archetypes)

**Campaign:** Sharpen & Deepen · milestone M6 (`[gate-verified]`).
**Definition of Done:** 2-3 NEW procgen POI archetypes, each DISTINCT at silhouette level, tone-appropriate, reusing the socket/component grammar + material buckets, wired into `ARCH_WEIGHTS` (all biomes), collider-audited + placement-clean + visual-gated (routine bar: no sev≥2). One archetype per cycle, built to depth — NOT 2-3 shallow ones in one cycle (anti-punt: CLAUDE.md rule 8 + campaign-cycle 4b).

## Sub-tasks (one per cycle)

- [x] **A1 — relay_mast** (cycle 5, D285) ✅ — a fallen guyed lattice comms tower. The silhouette the set lacked (TALL + THIN). `latticeMast` component (`poiComponents.ts`) + `assembleRelayMast` + registry + weights. Envelope-cylinder + base-box colliders (audit 5/5 ×4 seeds); placement PASS ×5 seeds; visual-gated (whip-antenna weathering polish). Reskins to the `cool` bucket.
- [x] **A2 — buried_pipeline** (cycle 6, D286) ✅ — a bedded PIPE RUN: 4-5 cylinder segments along a line (one surfacing hump, a far end diving under, a ruptured joint) tied into a manifold hub (drum + valve handwheel + flange stubs + access housing with the salvage panel). Distinct LOW HORIZONTAL silhouette. `pipeSegment` + `pipeJunction` components; envelope-cylinder colliders per segment + drum/box on the hub (audit 7-8/7-8 ×4 seeds); placement PASS; visual-gated (reworked from a floating sine-undulation to a robust bedded run — a rigid POI group can't weave under the real heightfield). `dark` bucket, favors salt/dune.
- [ ] **A3 — cargo_crawler** (cycle 7, OPTIONAL STRETCH) — **DoD is now MET at 2 archetypes (A1 relay_mast + A2 buried_pipeline)**. A3 is a value-add, not required: a tracked hauler wreck (cab block + tread/bogie assembly toppled/half-buried + 1-2 spilled cargo containers). Being built next because the campaign runway is healthy and M7 (Skyfall) pauses for human plan-review immediately — so an autonomous A3 is the higher-value use of the unattended time. Charter scope-cut #2 still allows dropping it under pressure.

## Invariants every archetype must hold
- Determinism: ONE `seedOf(rand)` draw in the assembler; everything else `phash` (D226). verify:placement ×5 seeds is the tripwire.
- Colliders: declared exact primitives; every collidable-scale mesh ≥40% covered (D228); add the archetype id to the `verify:colliders` default list in `rig-shot.mjs` (line ~1023) so the permanent gate audits it.
- Rebalance `ARCH_WEIGHTS` so each biome table still sums ≈1.0 (shave an abundant sibling by the added weight).
- Decorations ≥10cm depth where box-based on an outward surface (rule 7); auto-registers as a sun occluder via the cycle-2 procgenPoi hook (no action).
- Visual: render via the `procgen-wreck` rig framer at real placement; routine bar (no sev≥2) after ≤3 rounds.
