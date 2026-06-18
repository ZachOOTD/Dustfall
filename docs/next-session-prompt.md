# Session ACBC — Kickoff Brief

## Read these now (in order)
1. `CLAUDE.md` (auto-loaded) — "Where we are now" (ACBB finished the wreck arc).
2. `docs/session-end-report.md` — cumulative state (ACBB at top).
3. `docs/backlog.md` §A (owed walk-tests) + §G (the ACBB shipped-note + remaining polish/deferrals).
4. `docs/decisions.md` tail — D234-D237 (per-bucket weathering / collider-audit scope / sand-drift `proud` / Tier-5 cut).
5. `docs/roadmap.md` "Recently shipped" (ACBB) + the touched files: `src/world/poiArchetypes.ts`, `poiAssembler.ts`, `poiComponents.ts`, `procgenWreck.ts` (`BUCKET_WEATHERING`/`getBucketMats`), `src/world/hullMaterial.ts`, `scripts/verify-colliders.mjs`.

## What's already built
The procedural-POI system (ACBA) is a component/socket/`mate()` grammar with 5 archetypes (satellite, wrecked_tank, debris_field, hollow_husk, derelict) + the legacy `ship`, pervasive at `PROCGEN_COMPOSITE_SHARE`=0.85. ACBB FINISHED its visual/collision pass: a **cohesive weathered fleet** (per-bucket weathering → 3 distinct lightness tiers, D234), **sand drifts that bank** against bedded/crash-posed wrecks (D236), a **`verify:colliders` gate** asserting structural-mesh collider coverage (D235, in `verify:all`), a **husk that reads hollow** + a **derelict wide-body trimaran**, and the §E polish (stars/antenna/dev-keybind/scrap-model). Baseline: tsc clean, `verify:placement` 0/0 ×5 seeds, `verify:colliders` 0/25, perf 842 draw calls / 69 programs, no save bump.

## Session ACBC focus — pick a lane
The wreck arc is headless-COMPLETE. The headline owed item is the **attended in-world WALK-TEST** (the ONLY thing headless can't judge). **If a human is at the keyboard:** do the walk-test first — it's the highest-value item and gates the "ship it" confidence. **If running autonomous:** the remaining §G polish + the deferred Tier 5 yard merge are shovel-ready. **NOTE (D238):** keep BOTH ship paths — the legacy-ship retirement is OFF the table (user call); the additive derelict already delivers the weird-ship value with zero regression.

## Priority items (in order)
1. **(ATTENDED) The OWED in-world WALK-TEST — `npm run dev`** (eyes-only; headless can't judge collision/feel/seating):
   - Walk INTO a tank / satellite / husk / derelict (the declared-collider feel) + the **flagship satellite DISH** (the NEW slab collider — D235/§E; a box approximation that may slightly over-block the round dish at the diagonals — confirm it doesn't feel like a clip-wall near the dish base).
   - Stand among the field across biomes: does the fleet read as ONE cohesive weather-system with distinct light/dark tiers (D234)? Do the **banking sand drifts + crash-poses** (satellite leaning into a drift, debris on its scorch-disc) read as "swallowed by a living dune"? Any float/clip?
   - Re-judge the **reworked scrap pickup** in-hand (its front reads as a rusted torn sheet; the 3q edge-on read is a touch thin — see if it bothers in motion).
2. **(AUTONOMOUS) Remaining §G polish** (backlog §G): satellite wings still a touch dark at silhouette distance; debris fragments want warmer ox so they read as torn hull metal (not grey rock); husk + derelict deeper exterior detail; the deferred **Tier 5 yard cross-POI merge** (D237 — the ~3215 yard ground worst-case; field perf is fine).

## Stretch goals
- A `wreck-field` rig-shot scenario framing the REGULAR (non-yard) field so archetype MIX + fleet cohesion are verifiable headless (the yard ground view times out at 30s; per-archetype shots can't show the mix).
- Pivot to a fresh lane entirely (the §E dump has sandworm overhaul, survival rebalance, machete-tool — see the planning options).

## Autonomy contract
- `phash`-determinism law (D221): components NEVER draw `rand`; assemblers draw a small FIXED budget. Re-run `npm run verify:placement` AND `npm run verify:colliders` after ANY POI/panel/geometry/seating change (a buried panel or an un-covered structural mesh at a fixed seed = STOP).
- Rule 8: visual work is NOT done when tsc passes — build → screenshot → critique → iterate. Hold the ACBB bar (a 3-critic cohesion pass + 5-round model iteration).
- New COLLIDER-AUDIT footgun (D235): a NEW structural mesh needs a declared collider OR an `auditExempt`/`isWreckDecoration` tag, else `verify:colliders` trips. The flagship dish collider is OUTSIDE this gate (hand POI).
- Ambiguous → GDD pillars + the realism dial; append a D-entry; continue.

## Stop conditions
3 fix-walls on one element (log + move on / cut) · a buried-panel or un-covered-collider gate regression you can't clear in 2 tries · a `SAVE_VERSION` bump turning out necessary (surface it) · destructive-git attempt.

## Notable footguns
- **rig-shot harness runs SEQUENTIALLY only** — 6-way parallel times out on `page.screenshot` ("waiting for fonts"); chain shots with `;` on one `--port`. The dense `wreck-yard --angle=ground` view also times out at 30s.
- **`--zoom < 1` is TIGHTER** (closer) in the `procgen-wreck` scenario; `--archetype=<id>` spawns one archetype; `--scenario=collider-audit` runs the new gate (no screenshot).
- **Per-bucket weathering** lives in `procgenWreck.ts` `BUCKET_WEATHERING` + `BUCKET_HEX`; the shared profile is `HULL_WEATHERING_ACAY` in `hullMaterial.ts`. Strengths-only overrides keep the shared `onBeforeCompile` → no new programs.

## Verification protocol
`npm run verify` (tsc) clean. `npm run verify:all` (= tsc + `verify:placement` 0/0 ×5 seeds + `verify:colliders` 0 fails). Headless framing: `rig-shot --scenario=procgen-wreck --archetype=<id>` (+ `--angle=side|front|3q`, `--seeds=`), `perf-probe` (field drawCalls <1000, programs ≤72). **Collision/feel/seating sign-off → the attended `npm run dev` walk-test.**
