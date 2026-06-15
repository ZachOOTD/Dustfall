# Session ACAT — Kickoff Brief

## Read these now (in order)
1. `CLAUDE.md` (auto-loaded) — "Where we are now" (ACAS: wreck-yard perf+polish + item/collision breadth shipped).
2. `docs/session-end-report.md` — cumulative state (ACAS at top).
3. `docs/backlog.md` — the owed walk-tests + deferred items.
4. `docs/decisions.md` tail (D204 recessed-pit terrain-carve; D205 merge-an-interactive-object; D206 collider-shape-from-bbox).
5. `docs/roadmap.md` + `docs/architecture.md` (only if touching an unfamiliar system).

## What's already built
The wreck-yard biome (Cycle 8) + the recessed Sarlacc pit are shipped and polished. ACAS added: the wreck-yard yard-merge
now folds in the loose props (mounds/debris/bones), the speeder body is static-merged (D205), the graveyard floor is
oil/ash-mottled, the big hand-wrecks are lootable, the maw is denser, two item viewmodels were upgraded (cloth, skewer
spit), dropped items get per-item collider shapes (D206), and the crafting chooser's discovery-spoiler was fixed +
verified. tsc clean, SAVE_VERSION 14.

## Session ACAT focus — the owed human WALK-TESTS (this is an ATTENDED session)
Almost everything left needs a human in `npm run dev` — feel/interaction the headless harness can't judge. The autonomous
build work for this arc is essentially done; what remains is your eyes + a couple of attended refactors.

## Priority items (in order)
1. **Sarlacc-pit WALK-TEST (needs YOU) — the recessed crater (ACAR2/D204).** `__game.ctx.biomes.sarlaccPitAnchor` (its own
   dune spot, ~420-950m out). Walk in: judge the **PULL feel** (escapable but scary?) **combined with the funnel physically
   funneling you down** — the key question: can you **climb back out** of the bowl while the pull is active (walls ~39° < the
   KCC 50° limit, but confirm no softlock), is the crater depth/steepness right (`SARLACC_PIT_CRATER_DEPTH`/`_CLEARING`), and
   does descending read as a dread trap. Also: damage cadence, the gape/clench telegraph. Tune `tuning.ts` `SARLACC_PIT_*`.
2. **Dropped-item settle FEEL (ACAS B2).** Drop pipe_staff/amban_rifle/branch (capsule) + canteen/relic_core (sphere) on
   flat + slope + the crater — does the capsule/ball lie read more natural than the old box? `__game.dropTestItem('id')`
   spawns one in front of you. Tune the bbox-derived half-extents (`pickups.ts` `getItemColliderDesc` region) if a body
   jitters/slides. Add more `colliderHint`s to items if warranted.
3. **Wreck-yard graveyard + mega-wreck interior WALK-TESTS.** Graveyard (`wreckYardAnchor`, 620-1000m): relic findability +
   value, do the ashen/mottled ground + dense wreck silhouette + circling vultures read ominous, are the big wrecks'
   newly-registered panels reachable. Mega-wreck interior (owed since ACAL): collision holds / fracture-ramp entrance /
   panels reachable / interior brightness.
4. **(Deferred perf, attended) Pickup InstancedMesh.** 340 branch+scrap pickups ≈ 340 draw calls. Each is individually
   takeable → needs an interaction-raycast (`instanceId`) rework. Do it only with a human to confirm pickups still take.
5. **(Open design call) Activate the crafting chooser.** The multi-match chooser is built + verified + discovery-respecting
   but dormant (no recipes collide). Add ONE colliding recipe (same inputs → a different output) for a real player choice —
   mind D71 (ids ≥ 17) + the discovery/save balance. `__registerTestRecipe` shows the shape.

## Stretch goals
- W2 flagship greebles / W5 dusk-lit procgen pass (long-deferred).
- The next Phase-2 cycle: Cycle 5 raider proc-character, or Cycle 7 deep cave (both bigger, mostly DEFERRED).

## Autonomy contract
Items 1-3 need a human throughout — do NOT claim feel/interaction verified from a headless run. Item 4 is
interaction-preserving but unverifiable unattended (do the safe half + surface, don't claim pickups still take). Item 5 is
a design decision — surface options, don't unilaterally add a gameplay recipe unattended. Ambiguous → GDD pillars + the
realism dial, append a D-entry, continue.

## Stop conditions
3 fix-walls on one element (log + move on) · a `SAVE_VERSION` bump turning out necessary (surface it) · destructive-git
attempt · an interaction-preserving refactor that can't be live-verified unattended (do the safe half, surface).

## Notable footguns (this arc)
- **Recessed hazard = carve the shared heightfield (D204)** — mesh+collider+`heightAt` dip together; gate the wall slope vs
  the KCC 50° climb limit or the player softlocks.
- **Merging an interactive object (D205)** — tag every animated/interactive/light-bearing mesh `noMerge`; the merge removes
  a mesh's whole subtree, so a light under a merged mesh is lost. The collider must be mesh-independent (or built first).
- **Per-item dropped colliders (D206)** — `ItemDef.colliderHint` picks the shape; the SIZE comes from the bbox. Capsule axis
  = the bbox's longest dimension (rotated onto it). Default-off; raycast keys on userData so interaction is unaffected.
- **`placeWreck` can't import salvage.ts (circular)** — register big-wreck panels from the CALLER (`wreckYard`) after it returns.
- **Windows rig-shot** pins a fixed seed (`dustfall.pendingSeed`=1337) for deterministic shots; `--seed=<n>` overrides.

## Verification protocol
`npm run verify` (= `tsc --noEmit`) clean. Headless gates that exist: `wreck-yard --angle=aerial|approach|ground|pit|maw|pit-eye`
(draw calls + salvageable count), `speeder-fx` (merge-safety refs), `drop-test` (dropped-item settle), `craft-chooser`
(chooser path), `sarlacc-test` (pit open/pull/bite), `item-studio --items=`. **Items 1-3 are feel/interaction-critical →
verify in `npm run dev` (the harness can't judge feel).** Rule 8: screenshot-iterate any visual change.

## On stop
Run `/session-end` (verify → changelog → CLAUDE last-shipped → roadmap → D-entries → backlog → report → next-prompt →
post-mortem → commit + tag `session-ACAT` + push).
