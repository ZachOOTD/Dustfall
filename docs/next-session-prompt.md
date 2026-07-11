# Cycle 3 — Kickoff brief: S3 scatter + ambient life streaming (campaign "Infinite Sands")

**⚙ A CAMPAIGN IS ACTIVE** — "Infinite Sands", overnight, branch `campaign/2026-07-10-procgen`.
Boot `/campaign-cycle` from `docs/campaign/campaign-state.json` + `campaign.md`. The paused
Skyfall campaign stays parked read-only.

## Read these now
1. `CLAUDE.md` (auto-loaded) — "Last shipped" = cycles 1-2 (S1 streaming core, S2 POI wrecks).
2. `docs/campaign/campaign.md` — charter + S-ladder + locked constraints + scope-cut order.
3. `docs/feature-infinite-procgen.md` — S3 = its sub-task 3.
4. `docs/decisions.md` D288–D293 — the streaming architecture + the save-transient model S3
   must follow (D290 descriptor purity; D292 transient/save rules).
5. `src/world/chunkManager.ts` — the lifecycle S3 hangs content on (see how S2's poi roll works).
6. `src/world/rockScatter.ts` + `src/world/wordlessScenes.ts` + the creature spawners
   (`src/enemies/lizard.ts` `spawnLizardsProcgen`, shrew.ts, vulture.ts).

## What's already built (S1+S2)
Terrain streams (anchor-margin tile ring, `heightAt` infinite); ChunkManager (112m chunks, pure
descriptors, full teardown); streamed POI wrecks beyond 1250m (save-transient, salvage works);
permanent `verify:chunks` gates (determinism + a streaming/leak walk that also saves at +1500m);
`chunk-vista` visual scenario incl. a streamed-POI shot.

## Cycle 3 focus — S3: scatter + ambient life
The far field has wrecks but is otherwise dead ground: no rocks, no wordless scenes, no creatures.
DoD: walking anywhere yields biome-appropriate rock/decoration scatter and living creatures at
roughly origin-field density, loading/unloading cleanly (no leaks, no save corruption), with the
origin field and all existing gates untouched.

## Priority sub-tasks (in order)
1. **RESEARCH FIRST (the slice's open ❓):** read how `spawnLizardsProcgen` / `spawnShrewsProcgen`
   / `spawnVulturesProcgen` actually work — module-owned lists (`ctx.shrews.list` IS the module
   array), Rapier bodies?, save schema v14 persists shrews/vultures (id + pos + state) — the SAME
   save-id trap as D292. Decide per-species: active-ring streaming vs leave-origin-only, and write
   the finding into the cycle log BEFORE building.
2. **Rock scatter per-chunk** — `spawnRockScatter` is boot-scoped (radius ≤1100m) and NO colliders
   (visual props). Descriptor: per-chunk rock roll (count/positions/kinds from the chunk stream,
   biome-gated like the boot path); render on load into the chunk group (instanced pools? check
   how boot rocks draw — if InstancedMesh pools exist, per-chunk instancing may need its own
   small pools or plain meshes; measure before choosing); dispose on unload. No colliders → no
   body-count risk; extend the streaming probe's snapshot/leak asserts to cover rock meshes.
3. **Wordless scenes per-chunk (scope-cuttable #1)** — `placeWordlessScenes` uses a dedicated
   seeded RNG + a ring around origin; decoration-only, no colliders. A rare per-chunk roll
   (~0.01-0.02) via the descriptor. Per the charter's scope-cut order this is the FIRST thing to
   cut if a wall hits — keep them origin-only in that case and log it.
4. **Creatures — active ring (scope-cuttable #2 to "simple radius despawn")** — spawn within
   ~150-250m of the player from per-region deterministic rolls, despawn beyond. DANGER ZONE
   (from step 1's findings): creature save arrays are id-keyed like salvage — streamed creatures
   must be save-transient (mirror D292: exclude from serialization, or scope-cut to
   origin-creatures-only and log). Creatures have AI ticks — keep the ring small and the
   per-frame cost flat (the diurnal-probe + survival-probe must stay green).
5. **Gates** — extend `chunk-streaming`: rock/scene content in snapshots (world-space), creature
   count returns to baseline after the round trip, save-safety assert extended to creature
   arrays if streamed. `verify:all` + all 5 smokes + `verify:chunks` green, per cycle.
6. **Visual pass (routine bar)** — `chunk-vista`: a far-field shot with rocks + a wreck together
   (the field should read INHABITED, not prop-spammed); wordless scene shot if built.

## Constraints (locked)
Determinism law (descriptor-pure, dedicated streams); rule 9 (no leaks — probe-gated); the intro +
near-origin spawn unchanged; NO save-schema changes (S5 pause; use the D292 transient pattern);
keep banked perf (rock scatter must not undo pickup instancing wins — watch draw calls);
master untouched.

## Footguns (from cycles 1-2)
- Save-id coupling: anything with an id-keyed save array (salvage, pickups, shrews, vultures,
  worms) must NOT serialize streamed instances — D292's transient pattern is the template.
- Probe discipline: 320×240 render target for walk probes; cell-CENTER comparisons; ground-truth
  rays dodge player/markers/POIs (D291). Wrapper child timeouts ≥900s for walk legs (D293).
- Vite boots take 60-120s under machine load — that's the flake signature, not a regression.
- `__game.resetWormCrossing()` before vista shots (the ambient ridge photobombs).
- The boot `scatterRand` stream is SACRED — never draw from it for streamed content (D208/D221);
  chunk streams only.

## Stop conditions
Per the charter: budget/cycle caps, 3-strike walls (→ scope-cut order above), `stuck`, steering
`pause`. S3's pre-authorized cuts: wordless scenes stay origin-only; creature ring simplifies to
radius-despawn-only (or origin-only if the save coupling is hairy — log a D-entry either way).

## On stop
`/session-end` (campaign auto-commit) + campaign bookkeeping (state.json, campaign-log.md, marker
removal) + verdict (CONTINUE → ScheduleWakeup /loop /campaign-cycle; the ladder continues S4 → S6
→ ⏸ S5).

## Begin
Read the files above → write `.gamedev-framework/campaign-cycle.inprogress` → research step 1 →
build → gates → visual pass → `/session-end` → log + verdict.
