# Session ACBB — Kickoff Brief

## Read these now (in order)
1. `CLAUDE.md` (auto-loaded) — "Where we are now" (the POI variety overhaul: a socket/component/grammar system + 3 non-ship archetypes).
2. `docs/session-end-report.md` — cumulative state (ACBA at top).
3. `docs/backlog.md` — §G (the ACBA deferred sev-2/3 + the husk/ship-migration) + the PENDING owed walk-tests.
4. `docs/decisions.md` tail — D226-D231 (socket/grammar architecture / phasing deviation / declared colliders / corner-terrain cull / adversarial-critique gate / window+scout removal).
5. `docs/roadmap.md` "Recently shipped" + the new POI files: `src/world/poiComponents.ts`, `poiArchetypes.ts`, `poiAssembler.ts`, and `src/physics/bodies.ts` `attachDeclaredColliders`.

## What's already built
Procedural POIs are no longer "all long tubes." A general **component/socket/grammar system** assembles them: `poiComponents.ts` defines components (a Socket = point + outward frame + radius; `mate()` glues a child socket opposing a parent socket in ANY topology; each component DECLARES its Rapier colliders; everything `phash`-derived so components never touch the shared `rand` stream). `poiArchetypes.ts` is the grammar (assemblers + biome-weighted `pickArchetype`), `poiAssembler.ts`'s `placeProcgenPOI` runs the lifted burial/align/declared-collider/re-skin/merge/salvage-panel/prune pipeline. `pickArchetype` rolls `ship` (delegates to the legacy linear `placeProcgenComposite` → zero regression) or one of **5 new archetypes** now live in `procgenPoi` (at `PROCGEN_COMPOSITE_SHARE`=0.85, ALL biomes) + `wreckYard`: **SATELLITE** (foil bus + crash-banked solar wings + dish + hatch), **TANK_CLUSTER** (3-4 upright tanks + a ~10m silo — stands vertical), **DEBRIS_FIELD** (scattered plates/struts/lootable chunk), **HOLLOW_HUSK** (a gutted open-top hull shell + ribs — enterable-ready), **DERELICT** (an intact ship socket-mated into linear / wide-body-outrigger / stacked-tower forms = the "wider/weirder ships", D232). Collision is now DECLARED (exact primitives + convex-hull, no AABB fallback). Phase-0 bug-fixes also landed: window + scout removed, decoration colliders skipped, greebles seat on the real flank, corner-aware terrain panel cull + a TERRAIN-AUDIT gate line. tsc clean; `verify:placement` 0 occlusion + 0 terrain fails ×5 seeds; field perf 839 draw calls / programs 67; no save bump. **All four user directions + weirder-ships shipped.**

## Session ACBB focus — pick a lane
The variety system is proven on 5 archetypes, pervasive across all biomes, headless-verified. The headline work is DONE; what remains is the owed eyes-on pass + optional refinement. **If a human is at the keyboard:** the owed walk-test is highest value — the only way to judge felt collision (the declared-collider fix), felt variety, and seating under sky/fog. **If running autonomous:** the ranked sev-2/3 polish + the optional legacy-ship retirement are shovel-ready.

## Priority items (in order)
1. **(ATTENDED) The owed in-world WALK-TEST — `npm run dev`** (headless can't judge feel/collision/seating):
   - Walk INTO a tank, satellite, husk, and derelict — does collision match the visible surface? (the D228 declared-collider fix + the critique's strut/dome bug fixes). Walk through where a wreck decoration used to wall you off (the #20 fix).
   - Stand among the field across biomes — does it READ varied (ships + tank farms + satellites + debris + ribbed husks + wide-body derelicts) and "feel like a real world" (the user's words)? Are POIs seated (no float/clip), panels not buried?
   - Tune: `SALVAGE_PANEL_TERRAIN_CORNER_MARGIN` if panels dip; the archetype `seatSink`/`list`/`sandMound`/`bury` params (`poiArchetypes.ts`) if seating reads off.
2. **(AUTONOMOUS, optional) RETIRE the legacy linear ship for the socket `derelict`** (D232) — only if the derelict is brought to the legacy ship's polish (more hull variety / weathering / a scale anchor); then `PROCGEN_COMPOSITE_SHARE`→1.0 + fold the legacy `placeWreck` small props into a `small_wreck` archetype. Else keep both (the additive derelict already delivers the weird-ship value with zero regression).
3. **(AUTONOMOUS) The ranked sev-2/3 polish** (backlog §G): tank terracotta→steel weathering gradient, fleet palette cohesion, wire `pipeStrut` into the tank cluster, sand-drift banking, husk + derelict-wide-body exterior detail, a formal COLLIDER-AUDIT harness, the yard cluster-merge (cut the ~3193 ground worst-case).

## Stretch goals
- Per-component seed namespacing (the sev-3 aliasing nit — sibling components sharing a base seed can collide).
- A `wreck-field` rig-shot scenario that frames the regular (non-yard) field so archetype MIX is verifiable headless (the yard aerial is too high, ground too dense).

## Autonomy contract
Item 1 needs a human throughout — never claim collision/feel/seating verified from a headless run. Items 2-4 are real builds → scope first. The system is `phash`-determinism-law-bound: components NEVER draw `rand`; assemblers draw a small FIXED budget; re-run `verify:placement` after ANY change (a buried panel at a fixed seed = STOP). Ambiguous → GDD pillars + the realism dial, append a D-entry, continue.

## Stop conditions
3 fix-walls on one element (log + move on / cut) · a buried-panel gate regression you can't clear in 2 tries (the determinism tripwire) · a `SAVE_VERSION` bump turning out necessary (surface it) · destructive-git attempt.

## Notable footguns (this arc)
- **Determinism (D226):** components are `phash`-only (ZERO `rand`); the assembler's `rand` budget is a pure function of (archetype, part-count, panel-count) → the salvage-panel stream stays stable. `pickArchetype` always spends exactly 1 `rand` regardless of outcome. A new component that calls `rand()` will desync the field — use `phash(seed, k)`.
- **Declared colliders (D228):** a component must declare ≥1 collider (decorations declare `{kind:'none'}`); the collider must MATCH its mesh (shape/size/axis — Rapier cylinders are Y-axis, use `FACE.*` quats; the critique found a strut capsule pointing the wrong way). `mate()` placements are rigid (scale 1); the group world matrix carries burial/tilt.
- **Panel placement on POIs (D229):** declared panel mounts must land on BARE hull (not a decoration — the finder rejects decorations); for a clustered POI, orient panels OUTWARD so a sibling doesn't occlude them (the gate caught a tank panel facing a neighbour); the per-POI prune is `root=group` (cross-POI burial is NOT audited — the audit walks up to the panel's own top-level group).
- **Windows rig-shot** pins `dustfall.pendingSeed`=1337; boots its own vite on `--port`; the post-scenario teardown can exit non-zero AFTER the audit line prints — read stdout, not the exit code. `--archetype=satellite|tank_cluster|debris_field` spawns a POI in the `procgen-wreck` scenario.
- **Rule 8** — visual work is NOT done when tsc passes: build → screenshot → critique → iterate; the ACBA archetypes took an adversarial 5-lens critique Workflow + a full critique-fix round to reach quality. Hold that bar for the husk.

## Verification protocol
`npm run verify` (= `tsc --noEmit`) clean. `npm run verify:placement` (panels bury-audit **0 occlusion + 0 terrain** fails ×5 seeds — re-run after ANY POI/panel change). Headless gates: `perf-probe` (field drawCalls <1000, programs ≤72), `procgen-wreck --archetype=<id>` (per-archetype framing), `wreck-yard --angle=ground` (field variety), `panel-studio`, `door-pop`, `drop-test`. **Collision/feel/seating-critical items → `npm run dev` (attended).**
