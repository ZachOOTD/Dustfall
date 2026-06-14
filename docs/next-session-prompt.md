# Session ACAP — Kickoff Brief

## Read these now (in order)
1. `CLAUDE.md` (auto-loaded) — "Where we are now" (ACAO: framer + T5 greebles/asymmetry shipped).
2. `docs/session-end-report.md` — cumulative state (ACAO at top).
3. `docs/backlog.md` + `docs/decisions.md` (D197 makeBreach-doesn't-read-at-scale; D195 name-for-verification; D196 panel-outward-normal).
4. `docs/roadmap.md` + `docs/architecture.md`.

## What's already built
The wreck story is deep: `mergeStaticByMaterial` covers every big wreck/flagship (procgen fleet + mega-wreck 491→79 +
megaShip/satelliteDish/crashedHull). Procgen hulls are faceted ship sections (D194), half-buried (T4), with a 7-type
greeble vocabulary + impact-flank asymmetry (ACAO). Panels are bury-audit-clean. **Procgen visual work is now
screenshot-verifiable** via the NEW `procgen-wreck` rig-shot (`--class=` + `--seeds=` sweep + `--zoom`, ground-aware,
orientation-pinned) — that was the ACAO unblock. tsc clean, no save bump (SAVE_VERSION 14).

## Session ACAP focus — finish the wreck arc: T7 perf (stretch) + the owed walk-test + flagship polish
The big visual + perf wins are banked. What remains is the perf stretch (T7), the one human-in-the-loop verification
(the mega-wreck interior walk-test), and spreading the greeble polish to the flagships.

## Priority items (in order)
1. **T7 — InstancedMesh / LOD (the stretch perf item).** Distance-LOD far wrecks (>300m from the player) to a merged
   low-detail shell, and/or `InstancedMesh` the repeated NON-interactive props (engine bells, common greebles) across
   the fleet. Keep salvage PANELS as regular meshes (no interaction-raycast `instanceId` rework — that's the risk).
   Measure with `perf-probe` (the biggest-objects breakdown + `render.calls`/`sceneMeshes`). Files: `procgenWreck.ts`
   (`placeProcgenComposite` ~L1219), `procgenPoi.ts` (placement), `scripts/rig-shot.mjs` (`perf-probe`). Acceptance:
   a measured draw-call / sceneMesh drop with triangles ≈ unchanged; record the before/after in the changelog.
2. **Mega-wreck interior WALK-TEST (owed since ACAL — needs YOU).** `npm run dev` → walk to the mega-wreck. Confirm:
   collision holds (no walk-through the hull), the fracture-ramp entrance is walkable, salvage panels are reachable +
   face outward (audit-clean since D196), interior brightness is adequate (natural-only light since D190). The one
   thing screenshots can't verify. If too dark → WIDER openings (fracture/breaches), NOT fake lights (D190).
3. **Richer greebles on the hand-modeled flagships + a brighter-lit procgen pass.** Extend the ACAO greeble vocabulary
   to megaShip/satelliteDish/crashedHull (they're NAMED → frame with the `flagship` rig-shot). The procgen hulls read
   fairly dark; a brighter-lit `procgen-wreck` shot (or a tuning lift) would surface the new detail more.
4. **(Opportunistic) procgen visual polish** now that it's verifiable — material depth / edge-wear on the faceted
   hulls, debris fans, biome-flavored greeble weighting. Screenshot-iterate via the framer (rule 8).

## Stretch goals
- A genuine procgen breach HOLE (D197): loft the hull WITH a gap rather than decaling over intact skin — bigger than a
  decal; only if T7 + walk-test land with budget to spare.

## Verification protocol
`npm run verify` (= `tsc --noEmit`) clean. **Perf (T7):** `perf-probe` before/after (record numbers). **Procgen
visual:** the `procgen-wreck` framer (`--class=<corvette|gunship|freighter|science_vessel|bulk_hauler|orbital_pod_cluster>
--angle=<3q|side|front> --seeds=1,2,3 --zoom=<f>`) + `panels` bury-audit PASS. **Flagship visual:** the `flagship`
rig-shot (`--name=<megaShip|satelliteDish|crashedHull|megaWreck>`). **Visual (rule 8):** screenshot-iterate every new
element; DON'T ship procgen/flagship visual work on tsc alone (that's why ACAN reverted the breach swap).

## Footguns (this arc)
- **Procgen wrecks are X-LONG; the hero is Z-long.** The `procgen-wreck` framer pins orientation (long-axis +X, detail
  flank +Z) so `side`=+Z broadside; `makeLoftedHull` lofts along Z → procgen rotates it `rotation.y = π/2` (D194).
- **`makeBreach` doesn't read on small intact hulls (D197).** No boolean cut → recessed void occluded / proud reads as
  a bump. Use the flat damage patch; a real hole needs a lofted-in gap.
- **Name + pin hero/procgen assets so the harness can find + frame them (D195, ACAO).** Unnamed/un-pinned = unverifiable
  = don't change its look (rule 8).
- **Merge order / subgroup (D192)** — colliders per-part BEFORE merge; merge the tilted subgroup if a camera frames it.
- **Windows rig-shot teardown:** the harness now `taskkill /T /F`s the vite tree + `process.exit(0)`s (ACAO) — if a run
  ever wedges again, check for an orphan vite holding port 5191.

## Save discipline (D81)
Geometry/material/collider/tooling only → no `SAVE_VERSION` bump. Surface if a save field turns out necessary (unlikely
for this arc).

## Autonomy contract
Ambiguous → GDD pillars + `decisions.md` realism dial; append a D-entry; continue (don't ask). Screenshot-iterate every
visual element (rule 8); NEVER mark a visual element done on tsc alone — and DON'T ship a visual change you can't frame.
Item 2 (walk-test) is the exception — it needs a human; set it up + hand over.

## Stop conditions
3 fix-walls on one element (log + move on) · a `SAVE_VERSION` bump turning out necessary (surface it) · destructive-git
attempt · wall-clock/budget ceiling.

## On stop
Run `/session-end` (verify → changelog [WITH T7 perf before/after numbers] → CLAUDE last-shipped → roadmap → D-entries →
backlog → report → next-prompt → post-mortem → commit + tag `session-ACAP` + push).
