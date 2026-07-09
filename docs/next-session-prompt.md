# Campaign cycle 6 — Kickoff Brief (Sharpen & Deepen · M6 POI breadth, A2)

**A campaign is ACTIVE** — boot from `docs/campaign/campaign-state.json` + `campaign.md`. Charter wins on conflict. **M6 is a multi-archetype slice IN PROGRESS** — sub-plan in `docs/feature-poi-archetypes.md` (A1 relay_mast shipped cycle 5).

## Read these first
1. `CLAUDE.md` + `docs/campaign/campaign.md` + `campaign-state.json` + `steering.md` (inbox).
2. `docs/feature-poi-archetypes.md` — the M6 sub-plan + invariants. A1 done; **this cycle = A2**.
3. `docs/campaign/campaign-log.md` cycle 5 (relay_mast — the precedent to mirror).

## Cycle 6 focus: M6 A2 — buried_pipeline archetype
A surfacing/sinking PIPE RUN: 4-6 large cylinder segments that breach + dive under the sand along a line, a junction/valve hub, one collapsed/ruptured segment. The distinct LOW HORIZONTAL segmented silhouette (deliberate contrast to A1's vertical mast). Follow the A1 pattern exactly:
1. NEW component(s) in `src/world/poiComponents.ts` — e.g. `pipeSegment(seed, len)` (a big cylinder, reuse `hullBarrel` idiom) + `pipeJunction(seed)` (a valve/manifold box+cylinders). Declared colliders: a cylinder per surfaced segment + a box/cylinder hub. `dark` or `warm` bucket.
2. `assembleBuriedPipeline(rand)` in `poiArchetypes.ts` — ONE `seedOf(rand)` draw; phash the segment count/offsets/tilts. Lay segments along a line with alternating breach/dive (use `rotatedMinY` + a per-segment sink so each surfaces then dives — like the debris-trail seating). Salvage panel on the hub.
3. Registry entry + `ARCH_WEIGHTS` all biomes (~0.05-0.06; shave an abundant sibling to keep sums ≈1.0 — favor salt/dune, old freight infrastructure).
4. Add `buried_pipeline` to the `verify:colliders` default list in `rig-shot.mjs` (~line 1023).

## Invariants (from the sub-plan — do not skip)
- Determinism: one `seedOf` draw, phash rest (D226); verify:placement ×5 seeds is the tripwire.
- Colliders: exact primitives, ≥40% mesh coverage (D228); the audit must pass 5/5 ×4 seeds for the new archetype.
- Decorations ≥10cm depth (rule 7). Auto-registers as a sun occluder (no action).
- **Visual gate** (this IS visual work): render via `--scenario=procgen-wreck --archetype=buried_pipeline --seeds=1,1337 --zoom=0.5`; routine bar (no sev≥2) after ≤3 rounds. Watch the seating (segments must bed INTO the sand where they dive, not float) + the hub read.

## Gates (every cycle)
`verify:all` + `smoke-intro` + `smoke-pod-tutorial` + `pickup-take-sweep` + `survival-probe` + `ambient-beds` + `diurnal-probe`. rig-shot `--port=52xx`.

## Constraints
No endgame · no tone change · additive-save-only (bump ⇒ PAUSE) · no new pillars (M6 archetypes = breadth of an existing pillar, sanctioned) · wind muted · feel-pile excluded.

## After A2
If cycles/budget are healthy, cycle 7 = A3 cargo_crawler (scope-cuttable — DoD met at 2 archetypes). Then M6 is DONE → M7 Skyfall `[feel-critical]` (the sanctioned PAUSE: build the blockout, then stop for the human walk-test).

## On stop
Session-end docs → cycle commit on `campaign/2026-07-09` → verdict → ScheduleWakeup if CONTINUE.
