# Cycle 2 — Kickoff brief: S2 POI streaming (campaign "Infinite Sands")

**⚙ A CAMPAIGN IS ACTIVE** — "Infinite Sands", overnight, branch `campaign/2026-07-10-procgen`.
Boot `/campaign-cycle` from `docs/campaign/campaign-state.json` + `campaign.md` (charter, locked
constraints, scope-cut order). The paused Skyfall campaign stays parked read-only.

## Read these now
1. `CLAUDE.md` (auto-loaded) — "Last shipped" = cycle 1 / S1.
2. `docs/campaign/campaign.md` — charter + the S-ladder + locked constraints.
3. `docs/feature-infinite-procgen.md` — the authoritative slice (S2 = its sub-task 2).
4. `docs/decisions.md` D288–D291 — the S1 architecture calls S2 builds on (especially **D290**:
   content derives from PURE descriptors; loadChunk only renders them).
5. `src/world/chunkManager.ts` — the lifecycle S2 hangs POIs on.
6. `src/world/procgenPoi.ts` + `src/world/poiAssembler.ts` — what becomes per-chunk.

## What's already built (S1)
Terrain streams (anchor-margin 3×3×800m tile ring; `heightAt` answers anywhere); a content
ChunkManager (112m chunks, r3, `chunkSeed`, pure `describeChunk`, full teardown, marker spike
content off by default); permanent `verify:chunks` gates (determinism + streaming/leak walk);
`chunk-vista` visual scenario; `__game.chunkDescribe/chunkStats/setChunkMarkers`.

## Cycle 2 focus — S2: POI streaming
Make the procgen POI layer per-chunk on the ChunkManager lifecycle. DoD: walking in any direction
forever encounters biome-weighted POI wrecks that load ahead, fully unload behind (meshes, Rapier
bodies, salvage/journal registrations), and regenerate byte-identically on revisit — with the
origin region's boot-placed POIs and the released intro untouched.

## Priority sub-tasks (in order)
1. **Descriptor first (D290).** Extend `describeChunk` (or an S2 sibling) to roll per-chunk POI
   placement purely from the chunk seed: presence roll (calibrate density to today's ~15 wrecks
   per 2400m field), archetype pick via the biome weights at the rolled position (`biomes` is
   noise-based — queryable anywhere), position within the chunk, yaw seed. Rejection rules that
   need neighbors (spacing vs adjacent chunks' POIs) must stay descriptor-derivable — e.g. a
   coarse jittered-grid / per-chunk max-1 roll — NOT dependent on load order.
2. **Render + teardown.** On chunk load, `placeProcgenPOI` at the descriptor's spec (reuse the
   assembler; per-chunk static merge; declared colliders via `attachDeclaredColliders`); store
   every body + salvage/journal registration handle on the chunk; unload removes ALL of them
   (extend `chunk-streaming`'s leak assert to cover POI bodies + registry sizes).
3. **Origin exclusion.** Chunks overlapping the boot-placed origin field (the existing
   `placeProcgenPOIs` output + anchor POIs + the spawn exclusion) must NOT double-place — simplest:
   descriptor rolls empty inside the origin-field radius; boot placement stays as-is for v1.
4. **Gates.** Extend `chunk-determinism` to cover the POI descriptor fields; extend
   `chunk-streaming` to assert salvageable-registry count returns to baseline after the walk; keep
   `verify:placement`/`verify:colliders` green (they audit the origin field + archetype assembly —
   unchanged by streaming).
5. **Visual pass (routine bar).** `chunk-vista` at a far point with POIs enabled: wrecks seated on
   terrain (no float/bury), sand mounds present, spacing sane. Player-eye, multiple angles.
6. **Stretch (only if clean):** salvage panels on far POIs verified prying-functional via a quick
   probe (the registries are live, so it should Just Work — prove it).

## Constraints (locked — do not violate)
Determinism law (descriptors pure, phash-only components, fixed rand budgets); rule 9 (no orphaned
colliders/leaks — the streaming probe is the gate); the released intro + near-origin spawn
unchanged (smoke gates every cycle); NO save-schema changes (S5 pause, D81); keep banked perf
(pickup instancing D281, static merge); master untouched.

## Footguns (from cycle 1 — D291)
- Vite boots take >30s under machine load — rig-shot now waits 120s; the verify-chunks wrapper
  retries once on the no-line signature. Don't chase "dev server not ready" as a real failure
  until a calm-machine rerun fails too.
- Walk-length probes: renderer to 320×240, compare ring sets only at cell CENTERS, castDown
  ground-truth rays must dodge the player capsule + descriptor-known content.
- A probe teleport can land beside the ambient worm-crossing ridge — `__game.resetWormCrossing()`.
- The salvage-condition picker reads biomes via `setSalvageBiomesContext` at registration time —
  fine per-chunk, but registration/unregistration must be symmetric or the registry grows.

## Stop conditions
Per the charter: budget/cycle caps, 3-strike verify walls (→ scope-cut order in `campaign.md`),
`stuck` on a genuine failure, steering `pause`. Scope-cut order for S2 pressure: shrink archetype
breadth per-chunk (a subset of the 11) before touching determinism/teardown/gates.

## On stop
`/session-end` (campaign mode: auto-commit this cycle on the branch) + campaign bookkeeping
(state.json cycle record + spend, campaign-log.md entry, remove the inprogress marker) + verdict.

## Begin
Read the files above → write `.gamedev-framework/campaign-cycle.inprogress` → build S2 →
`verify:all` + the 5 smoke gates + the chunk gates → visual pass → `/session-end` → log + verdict.
