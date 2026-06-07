# Session ACAM — Kickoff Brief

## Read these now (in order)
1. `CLAUDE.md` (auto-loaded) — "Where we are now" (ACAL shipped: exact collision + natural light + de-floated interior).
2. `docs/session-end-report.md` — cumulative state (ACAL at top).
3. `docs/backlog.md` + `docs/decisions.md` (D189 trimesh collision, D190 natural-only light, D191 thickness/arc + the float bug class).
4. `docs/research/megawreck-interior-v2.md` / `megawreck-concept.md` — build specs.
5. `docs/roadmap.md` + `docs/architecture.md`.

## What's already built
The mega-wreck (`src/world/megaWreck.ts`) is a sleek crashed dagger half-buried + listing ~17°, with an aligned interior
built in the same tilted shell frame. As of ACAL it has **100% exact collision** (one Rapier trimesh baked from every mesh —
D189), is lit by **natural world light only** (D190), is entered through the **open mid-hull fracture** via a lee-flank sand
ramp, has its 2 salvage panels reseated on the real exposed lee-flank hull surface, a **thicker double-walled hull**
(`makeLoftedHull` `thickness`), and a de-floated interior (ribs are top-arcs via `makeFormerRings` `arc`; ~16 floaters fixed
via shared `ceilingY`/`hullHalfWAt` samplers). tsc clean, no save bump.

## Session ACAM focus — RE-WALK-TEST the wreck, then material depth, then start the procgen-fleet level-up
The ACAL fixes are screenshot-verified but not re-walked. Confirm them in-app first.

## Priority items (in order)
1. **WALK-TEST the wreck in `npm run dev`** (the gate). Confirm the ACAL fixes: (a) **collision** — push hard into the bow,
   flanks, command island, engine bells, interior ribs/beams/debris; you must NOT clip through anything (the trimesh is built
   from every mesh — D189). (b) **Entrance** — walk up the lee-flank sand ramp into the open fracture and onto the crossing
   deck. (c) **Panels** — both salvage panels (lee flank) flush + pry-able; journal + shelter register. (d) **Brightness** —
   judge whether the natural-only interior is too dark; if so the fix is WIDER openings (fracture/breaches), NOT re-adding
   fake lights (D190). Screenshot any residual floater (the hunt is down to sub-0.6m nits — the bridge area is the one to eye).
   If collision/entrance is broken, fix BEFORE cosmetics.
2. **Interior material depth.** Lighting is natural now, so surfaces carry the read: debris + big planes are flat single-value
   metal → want rust/grime/edge-wear (ties to the backlog "painted-metal rust" shader) + contact-AO/grounding tints at
   object-to-floor seams. Re-run the `megawreck-interior-defects` / `megawreck-floater-hunt` workflows per round.
3. **Deferred ACAJ T3-T7 — level up the procgen fleet on the bigger toolkit.** Apply `wreckForms` (incl. the NEW `thickness`
   + `arc` options) to `wrecks.ts` hull/cockpit + `procgenWreck.ts` `HULL_SEGMENT_VARIANTS`: lofted/thick hulls, partial-arc
   formers, real `makeBreach` holes → levels up all ~80 procgen wrecks. Then **T4** `makeSandMound` half-burial; **T5** greeble
   + asymmetry; **T6 (NEVER-CUT)** WebGL wreck perf merge (`mergeGeometries` static-by-material, panels/colliders separate,
   measure via `perf-probe`) — note the mega-wreck's full-model trimesh (D189) is a HERO-only choice; procgen wants the merge
   + simpler colliders, not a per-wreck trimesh. **T7** InstancedMesh/LOD. Keep `panelBuryAudit` PASS.

## Verification protocol
`npm run verify` (= `tsc --noEmit`) clean. Visual/feel is NOT done on tsc alone (rule 8): `megawreck` rig-shot
(exterior `side`/`hero`/`3q`/`front`; interior `int-bow`/`int-aft`/`int-bridge`/`int-frac`) + the adversarial workflows
(`megawreck-floater-hunt`, `megawreck-interior-defects`, `megawreck-critique`). The collision/entrance gate is an in-app walk.
`panels` bury-audit PASS for procgen-wreck work.

## Reusable harness (built ACAK-ACAL — USE IT)
`megawreck-floater-hunt` (4 agents read interior PNGs + code → ranked floaters), `megawreck-interior-defects`,
`megawreck-critique`, `megawreck-research`. Re-run via `Workflow({scriptPath})`. Footgun (D188): the critique is only as good
as the render — keep the rig-shot front-lit + length-framed.

## Save discipline (D81)
Geometry/material/collider only → no `SAVE_VERSION` bump (rebuilds from seed). Surface if a save field turns out necessary.

## Autonomy contract
Ambiguous → GDD pillars + `decisions.md` realism dial; append a D-entry; continue (don't ask). Research-back new modelling.
Screenshot-iterate every visual element (rule 8: 5-8 rounds new, 3-5 tuning); NEVER mark a visual element done on tsc alone.
**Collision/entrance walkability is the exception** — it needs an actual in-app walk; flag it, don't fake-verify.

## Notable footguns
- An UNLIT `MeshBasicMaterial` on a dark-scene prop GLOWS relative to its surroundings (D190 — the pink-streak bug). Use
  MeshBasic only for things meant to self-illuminate (screens, lights), never weathering/decals.
- A full-model trimesh (D189) is a HERO-asset choice (one static body); do NOT copy it onto all ~80 procgen wrecks — use T6's
  merge-by-material + simpler colliders there.
- Decoration placed at a cluster/section CENTER then spread across X/Z on the ~17° deck floats — sample `deckY(z)` /
  `ceilingY(x)` / `hullHalfWAt(y)` at the piece's OWN position (D191).

## Stop conditions
3 fix-walls on one element (log + move on) · a `SAVE_VERSION` bump turning out necessary (surface it) · destructive-git
attempt · wall-clock/budget ceiling.

## On stop
Run `/session-end` (verify → changelog → CLAUDE last-shipped → roadmap → D-entries → backlog → report → next-prompt →
post-mortem → commit + tag `session-ACAM` + push).
