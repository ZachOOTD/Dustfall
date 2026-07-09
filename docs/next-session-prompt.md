# Campaign cycle 5 — Kickoff Brief (Sharpen & Deepen · after cycle 4: M5 shipped)

**A campaign is ACTIVE** — boot from `docs/campaign/campaign-state.json` + `campaign.md`. Charter wins on conflict.

## Read these first
1. `CLAUDE.md` + `docs/campaign/campaign.md` + `campaign-state.json` + `steering.md` (inbox).
2. `docs/campaign/campaign-log.md` cycles 1-4.

## Cycle 5 focus: M6 — POI breadth (2-3 new procgen archetypes)
Add 2-3 NEW wreck/POI archetypes via the socket-component grammar (`src/world/poiComponents.ts` Socket + `mate()`; `src/world/poiArchetypes.ts` grammar + `pickArchetype` biome weighting; assembled by `poiAssembler.placeProcgenPOI`). Existing archetypes: ship (legacy delegate), satellite, tank_cluster, debris_field, hollow husk — study 1-2 before designing (ACBA is the precedent: satellite = foil bus + crash-banked wings + dish + hatch).

Candidate directions (pick 2-3 that read DISTINCT at silhouette level, fit the tone, and reuse the component/material vocabulary): a crashed CARGO CRAWLER (tracked hauler wreck — treads + cab + spilled containers), an ANTENNA/RELAY MAST field (guyed lattice masts, one toppled), a BURIED PIPELINE run (surfacing/sinking pipe segments + a junction hub), a LANDING PAD ruin (cracked pad + skeletal gantry). Each: declared `ColliderSpec` colliders (exact primitives — D228, no AABB fallback), ZERO rand draws outside the phash discipline (D226), biome weights in the field mix, decorations rule-7 depth (≥10cm), salvage panel(s) where sensible via the standard registration.

**Verify:** `verify:placement` (0 occlusion/terrain fails ×5 seeds) + `verify:colliders` (coverage audits — new archetypes get audited automatically) + the standing 7-gate suite. Visual: this IS visual work — render each new archetype via the rig-shot procgen framer (`--scenario` used by ACBA/ACAZ — grep rig-shot for `procgen` / `--archetype`) and run a LIGHT appearance pass (1-2 critics, routine bar: no sev≥2) per the charter's visual_gate=auto. Iterate to the bar; sand-bedding (makeSandMound `proud`) + weathering bucket cohesion (D234 getBucketMats) are the known quality traps.

## Gates (every cycle)
`verify:all` + `smoke-intro` + `smoke-pod-tutorial` + `pickup-take-sweep` + `survival-probe` + `ambient-beds` + `diurnal-probe`. rig-shot `--port=52xx`.

## Constraints
No endgame · no tone change · additive-save-only (bump ⇒ PAUSE) · no new pillars (archetypes = breadth of an EXISTING pillar, sanctioned M6) · wind muted · feel-pile excluded.

## Footguns
- Archetype rand discipline: phash-only, zero stream draws (D226) — verify:placement across 5 seeds catches drift.
- Colliders: declared exact primitives per component (D228); the collider-audit gate fails <40% coverage.
- New POIs auto-register as sun occluders via the cycle-2 hook in procgenPoi.ts (no action needed — but don't double-register).
- `ctx.player.body` rebuilt by enterGame(dev); live boots default 3P (cycle-1 lessons).

## On stop
Session-end docs → cycle commit → verdict → ScheduleWakeup if CONTINUE.
