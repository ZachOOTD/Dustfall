# Campaign cycle 7 — Kickoff Brief (Sharpen & Deepen · M6 A3 cargo_crawler, then M7 pauses)

**A campaign is ACTIVE** — boot from `docs/campaign/campaign-state.json` + `campaign.md`. Charter wins on conflict. **M6 DoD is already MET** (2 archetypes: relay_mast + buried_pipeline). This cycle = A3 cargo_crawler, an OPTIONAL STRETCH (the last autonomous content before M7 Skyfall pauses for human plan-review).

## Read these first
1. `CLAUDE.md` + `docs/campaign/campaign.md` + `campaign-state.json` + `steering.md` (inbox).
2. `docs/feature-poi-archetypes.md` — A1+A2 done; **this cycle = A3** (or skip to M7 if you judge the runway better spent).
3. `docs/campaign/campaign-log.md` cycles 5-6 (relay_mast + buried_pipeline — the precedents to mirror).

## Cycle 7 focus: M6 A3 — cargo_crawler archetype (optional stretch)
A tracked hauler wreck — the third distinct silhouette (a BULKY GROUND VEHICLE vs the vertical mast + horizontal pipeline). Follow the A1/A2 pattern exactly:
1. NEW component(s) in `poiComponents.ts` — e.g. `crawlerHull(seed)` (a boxy cab + cargo bed, half-buried/toppled) + `trackBogie(seed)` (a tread assembly: a rounded-end track loop via a lathe/box-chain + road wheels). Reuse box/cylinder vocab. `warm` or `dark` bucket. Declared colliders: box(es) for the hull + cylinder/box for the bogie.
2. `assembleCargoCrawler(rand)` — ONE `seedOf(rand)` draw; phash the tilt/bury/spill. A cab+bed hull, 1-2 tread bogies (one maybe thrown off), 1-2 spilled cargo containers nearby (reuse `debrisPiece` or a simple box container). Salvage panel on the cab.
3. Registry entry + `ARCH_WEIGHTS` all biomes (~0.04-0.05; shave an abundant sibling to keep sums ≈1.0 — favor rocky/wreck_yard).
4. Add `cargo_crawler` to the `verify:colliders` default list in `rig-shot.mjs` (~line 1023).

## Invariants (from the sub-plan)
- Determinism: one `seedOf` draw, phash rest (D226); verify:placement ×5 seeds is the tripwire.
- Colliders: exact primitives, ≥40% mesh coverage (D228); audit must pass ×4 seeds.
- Decorations ≥10cm depth (rule 7); tread detail reads at silhouette. Auto-registers as a sun occluder.
- **Visual gate**: render `--scenario=procgen-wreck --archetype=cargo_crawler --seeds=1,1337 --zoom=0.6`; routine bar (no sev≥2) ≤3 rounds. **Lesson from A2: a rigid POI group can't weave under the real heightfield — bed it at a fixed shallow depth, don't chase the terrain.** Watch the tread read + hull bedding.

## After A3 → M7 Skyfall [feel-critical] PAUSES
Once A3 ships (or if you skip it), M6 is fully closed. **M7 Skyfall is `[feel-critical]`**: per campaign-cycle 4a, STOP before building — `/feature-slice` it into a sub-plan (scale = the intro ship; enterable interior of similar-or-larger scale; build ON `shipScene.ts` tech), then set `awaiting_approval: true` + `stop_reasons: ["plan-review"]` and PAUSE for the human to approve the plan up front. Do NOT start building Skyfall autonomously.

## Gates (every cycle)
`verify:all` + `smoke-intro` + `smoke-pod-tutorial` + `pickup-take-sweep` + `survival-probe` + `ambient-beds` + `diurnal-probe`. rig-shot `--port=52xx`.

## Constraints
No endgame · no tone change · additive-save-only (bump ⇒ PAUSE) · no new pillars (M6 archetypes sanctioned) · wind muted · feel-pile excluded.

## On stop
Session-end docs → cycle commit → verdict → ScheduleWakeup if CONTINUE (or PAUSE at M7 plan-review).
