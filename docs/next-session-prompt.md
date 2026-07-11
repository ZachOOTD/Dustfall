# Cycle 4 — Kickoff brief: S4 distributed rare landmarks + per-region biomes (campaign "Infinite Sands")

**⚙ A CAMPAIGN IS ACTIVE** — "Infinite Sands", overnight, branch `campaign/2026-07-10-procgen`.
Boot `/campaign-cycle` from `docs/campaign/campaign-state.json` + `campaign.md`.

## Read these now
1. `CLAUDE.md` (auto-loaded) — "Last shipped" = cycles 1-3.
2. `docs/campaign/campaign.md` — charter; design decision #3 (user): DISTRIBUTED rare landmarks.
3. `docs/feature-infinite-procgen.md` — S4 = its sub-task 4.
4. `docs/decisions.md` D288–D294 — descriptor purity (D290), transient/save rules (D292),
   chunk-keyed content (D294).
5. `src/world/biomes.ts` — the distance-override biomes (wreck_yard 620-1000m ring,
   sarlaccPitAnchor, caveAnchor) that need per-region re-anchoring.
6. `src/world/heroLandmarks.ts` + `src/world/leviathanLandmark.ts` — what a "hero destination"
   is today (authored ring near origin).

## What's already built (S1-S3)
Terrain + content stream on an anchor-margin chunk model with pure descriptors; POI wrecks,
rocks, wordless scenes, and prey clusters populate the infinite field (all save-transient per
D292); permanent `verify:chunks` gates assert determinism, teardown, save safety, and
descriptor↔render equality over the active ring.

## Cycle 4 focus — S4: landmarks + biomes for infinite
Two halves:
**(a) Distributed rare hero landmarks** — the infinite field needs DESTINATIONS, not just
scatter. A coarse landmark grid (e.g. 1792m regions = 16×16 chunks) rolls at most one hero
landmark per region at low probability from `hash(worldSeed, region)`; the landmark's CHUNK
renders it through the existing lifecycle. Origin heroes (Leviathan, mega-ship, opening scene)
stay authored. This is where Skyfall plugs in later — build the SLOT (a landmark-class registry
with one or two entries), not Skyfall itself.
**(b) Per-region biome re-anchoring** — `wreckYardAt` etc. are origin-distance functions; the
infinite field never gets a wreck-yard. Re-anchor: rare per-region biome-anchor rolls (a
wreck-yard region every N regions) feeding the SAME `wreckYardAt`-style falloffs at region-rolled
anchor points. CAUTION: terrain heights/colors sample these per-vertex — the origin ring must be
byte-identical after the change (placement gate + the determinism digest will catch drift; run
them EARLY after touching biomes.ts).

## Priority sub-tasks (in order)
1. **Research first**: read `biomes.ts` end-to-end (how wreckYardAt/sarlaccPitAt/caveAt compose
   into heightAt + terrain colors + ARCH_WEIGHTS biome picks) and `heroLandmarks.ts` (what
   assets/colliders a hero landmark carries). Decide the landmark-grid size + probability and
   log the numbers.
2. **Landmark grid roll** (descriptor-level): `describeRegion(rx, rz)` — pure, seeded per region;
   at most one landmark (kind + position). Wire into `describeChunk` (a chunk knows if it hosts
   its region's landmark) so the existing gates cover it. Landmark kinds for v1: reuse EXISTING
   hero builders (a ribcage carcass cluster + one big procgen wreck class at hero scale) — the
   value is the DESTINATION SYSTEM, not new art (Skyfall brings the new art later).
3. **Render + teardown** on the chunk lifecycle (bodies tracked, salvage transient, geometry
   disposal rules per D292/S3). Landmarks are BIG — verify the collider audit approach applies
   (declared colliders / compound) and extend the streaming probe: a landmark-site leg
   (descriptor-scan → walk → descriptor↔render + teardown asserts).
4. **Per-region wreck-yard anchors** (b): region-rolled anchor points feeding a
   `wreckYardAt`-equivalent that the terrain bake + POI weights consume. ONLY if the origin ring
   stays byte-identical (assert early); if the coupling is too hot, scope-cut per the charter
   ("S4 biome re-anchoring breadth — wreck_yard stays origin-anchored for v1") and log the
   D-entry.
5. **Gates + visual**: all 10 green; vista landmark shot (player-eye approach read — a landmark
   must read as a DESTINATION from ~400m: silhouette against the fog).
6. **Stretch**: a removable horizon-silhouette variant for streamed landmarks (the S2 skip).

## Constraints (locked)
Determinism law; rule 9; the intro + origin field byte-identical (the placement gate is the
tripwire for biome changes); NO save-schema changes (transient pattern); master untouched.
Scope-cut order (charter): biome re-anchoring breadth first — never cut determinism/teardown.

## Footguns
- biomes.ts feeds the TERRAIN BAKE — any change that shifts a single origin-ring vertex breaks
  placement/panel audits AND the byte-identity promise. Guard every biome change behind
  "origin-region unchanged" (e.g. only apply region anchors beyond the origin exclusion).
- Probe discipline: D291 (320×240, cell centers, ray clearance) + D293 (900s wrapper legs) +
  D294 (quiet ambient predators; `resetWormCrossing` for vistas).
- Landmark colliders: use declared colliders / `attachCompoundCollider` with the body stashed
  for teardown (the S2 composite lesson).

## Stop conditions
Charter caps; 3-strike walls → the scope-cut order; `stuck`; steering `pause`.

## On stop
`/session-end` (campaign auto-commit) + campaign bookkeeping + verdict (CONTINUE → S6 next,
then ⏸ S5).

## Begin
Read the files above → write `.gamedev-framework/campaign-cycle.inprogress` → research →
build (a) then (b) → gates → vista → `/session-end` → log + verdict.
