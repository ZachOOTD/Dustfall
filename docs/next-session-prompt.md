# Session ACAL — Kickoff Brief

## Read these now (in order)
1. `CLAUDE.md` (auto-loaded) — "Where we are now" (ACAK shipped: dagger + interior; next = walk-test).
2. `docs/session-end-report.md` — cumulative state (ACAK at top).
3. `docs/backlog.md` + `docs/decisions.md` (D186-D188 — the dagger rebuild, the tilted-interior frame, the critique harness).
4. `docs/research/megawreck-interior-v2.md` + `megawreck-concept.md` + `megawreck-anatomy.md` — the build specs.
5. `docs/roadmap.md` + `docs/architecture.md`.

## What's already built
The mega-wreck is rebuilt from scratch (`src/world/megaWreck.ts`): a sleek ~5:1 crashed **dagger** exterior (faceted
`makeLoftedHull`, tilted ~17° into a list via the shared `shellQuat()`/`shellPos()`, `hullAt(z)` sampler, fracture notch,
command island, engines, plating, tilt-aware burial) and a new **aligned wreck interior** built in the SAME tilted frame
(canted floor `interiorDecks()`, the DoubleSide hull = walls/ceiling, wreckage + cargo/survivor set dressing + a dressed
bridge, fracture-as-hero-daylight, collision-correct decks/curbs/props + a stepped fracture crossing). It reads well in
the rig-shot from every angle. tsc clean, no save bump.

## Session ACAL focus — VERIFY THE INTERIOR IN-APP, then polish it to AAA
The one thing screenshots can't confirm: **does the interior actually WALK well?** Start there.

## Priority items (in order)
1. **WALK-TEST the interior in `npm run dev`** (the gating step). Enter via the bow breach / drop into the open fracture →
   cross to the bridge. Confirm: the ~17° canted floor is walkable (no uncontrolled slide); the **9-step fracture crossing**
   (`interiorDecks()` stepped slabs) is climbable both ways (autostep is 0.3m — `physics/bodies.ts:279`); every settled deck
   connects (no fall-through into the belly void — there are deck curbs but verify); the **shelter zone registers** (stat
   icon) in the lee nook; **both salvage panels** (engine-room +X bulkhead, bridge console) pry-salvage; the **journal**
   reads on the bridge console. **If traversal is bad, rework the `interiorDecks()` Y/step layout BEFORE any cosmetics** —
   the deck math is the foundation. (D187 — this is the known unverified risk.)
2. **Interior lighting/material depth pass** (the recurring AAA-critique gap). Re-run the `megawreck-interior-defects`
   workflow (script under `…/workflows/scripts/`) each round. Known items: debris + large planes read as flat single-value
   metal (want rust/grime/edge-wear — ties to the backlog "painted-metal rust" shader); add contact AO/grounding tints at
   object-to-floor seams; partial-arc ribs (`makeFormerRings` `thetaLength` upper-arc variant so rings don't dive through
   the floor); push the fracture cathedral daylight further; verify no light pools in empty space / no additive cone pokes
   the hull. Iterate 3-8 rounds per rule 8; the harness converges.
3. **Exterior polish loop** (optional, the dagger already reads well): re-run `megawreck-critique`; fatten the needle bow,
   richer mid-span greeble, debris fan — only if time after the interior.
4. **Deferred ACAJ T3-T7** (now ride on the bigger `wreckForms` toolkit): **T3** apply `makeLoftedHull`/`makeFormerRings`/
   real `makeBreach` to the procgen part vocabulary (`wrecks.ts` hull/cockpit + `procgenWreck.ts` `HULL_SEGMENT_VARIANTS`)
   → levels up all ~80 procgen wrecks; **T4** half-burial + `makeSandMound` on procgen wrecks; **T5** greeble + asymmetry;
   **T6 (NEVER-CUT)** WebGL wreck perf merge — `mergeGeometries` each wreck's static meshes by material, panels/colliders
   separate, measure via `perf-probe`; **T7** InstancedMesh/LOD. Keep `panelBuryAudit` PASS.

## Verification protocol
`npm run verify` (= `tsc --noEmit`) clean. **Visual/feel work is NOT done on tsc alone** (rule 8): `megawreck` rig-shot
(`side`/`hero`/`3q`/`front` exterior; `interior`/`int-bow`/`int-frac`/`int-aft`/`int-bridge`) + the adversarial defect-hunt
workflows. The interior gate is an in-app walk, not a screenshot. `panels` bury-audit PASS for any procgen-wreck work.

## Reusable harness (built ACAK — USE IT)
`megawreck-research` / `megawreck-interior-research` (web→spec) · `megawreck-critique` (4 critics score the renders) ·
`megawreck-interior-defects` (4 lenses hunt renders + code → ranked fixes). Re-run via `Workflow({scriptPath})`. Footgun
(D188): the critique is only as good as the render — keep the rig-shot front-lit + length-framed or critics misread.

## Save discipline (D81)
Geometry/material/collider only → no `SAVE_VERSION` bump (rebuilds from seed; transient state re-derives). Surface if a
save field turns out necessary (unlikely).

## Autonomy contract
Ambiguous → GDD pillars + `decisions.md` realism dial; append a D-entry; continue (don't ask). Research-back new modelling.
Screenshot-iterate every visual element (rule 8: 5-8 rounds new, 3-5 tuning); NEVER mark a visual tier done on tsc alone.
**The interior walkability is the exception** — it needs an actual in-app walk, which only the user (or a dev-mode session)
can do; flag it, don't fake-verify it.

## Stop conditions
3 fix-walls on one element (log + move on) · a `SAVE_VERSION` bump turning out necessary (surface it) · destructive-git
attempt · wall-clock/budget ceiling.

## On stop
Run `/session-end` (verify → changelog → CLAUDE last-shipped → roadmap → D-entries → backlog → report → next-prompt →
post-mortem → commit + tag `session-ACAL` + push).
