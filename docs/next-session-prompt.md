# Session ACAQ — Kickoff Brief

## Read these now (in order)
1. `CLAUDE.md` (auto-loaded) — "Where we are now" (ACAP: wreck arc finished — hand-POI merge + material depth + debris).
2. `docs/session-end-report.md` — cumulative state (ACAP at top).
3. `docs/backlog.md` + `docs/decisions.md` (D198 hand-POI-merge + interactType-skip; D199 shared-material-depth; D200 in-group-debris-at-buryY).
4. `docs/roadmap.md` + `docs/architecture.md`.

## What's already built
The wreck arc is essentially DONE: every wreck/flagship/hand-POI is static-merged (procgen fleet + mega-wreck 491→79 +
the 3 flagships + opening wreck 13 / rockyEntrance 37 / saltOutpost 28), procgen hulls are faceted with a 7-type greeble
vocabulary + impact asymmetry + crash-debris fans, half-buried, and the SHARED `createRustedHullMaterial` now reads
weathered-with-depth (form-AO + oxidation-zones + scuff-flecks) across every wreck. Procgen visual work is
screenshot-verifiable (`procgen-wreck` framer) + the hand assets are framable (`flagship --name=`). tsc clean, no save
bump (SAVE_VERSION 14).

## Session ACAQ focus — the human-owed walk-test + the attended perf follow-ups
This session is **ATTENDED** (not an overnight) — its top item needs a human in `npm run dev`. The autonomous wreck work
is done; what's left needs either your eyes (walk-test) or careful attended interaction-preserving refactors.

## Priority items (in order)
1. **Mega-wreck interior WALK-TEST (owed since ACAL — needs YOU).** `npm run dev` → walk to the mega-wreck. Confirm:
   collision holds (no walk-through the hull — D189 full trimesh), the lee-flank sand-ramp into the fracture is walkable,
   both salvage panels are reachable + pry-able + the journal/shelter register, and interior brightness is adequate
   (natural-only since D190). If too dark → WIDER openings (fracture/breaches), NOT fake lights. Flag residual floaters.
2. **Speeder static-merge (attended perf — the biggest remaining draw-call win, ~86 meshes always on-screen).** The
   speeder is unmerged. FIRST identify + tag its animated/interactive sub-parts `noMerge` (`headlamp`/`headlampDisc`/
   `speederSeat`/`speederTowBar`/any wheels or suspension that move), THEN `mergeStaticByMaterial(speederGroup)` on the
   static body. Verify in `npm run dev` that the speeder still drives, the headlamp lights, mount/dismount works, and the
   tow-bar animates. `src/**/speeder*` (find the builder). The `interactType`-skip (D198) already protects tagged
   interactables; the risk is ANIMATED parts (no interactType) — tag those `noMerge`.
3. **Pickup InstancedMesh (attended perf — 340 branch+scrap meshes ≈ 340 draw calls).** Instance the scatter pickups
   (branch ×~130, scrap ×~200) into per-geometry InstancedMeshes. The risk: each pickup is individually TAKEABLE via an
   interaction raycast — needs an `instanceId`→pickup map + raycast rework (or keep a small pool of real meshes for the
   nearest-N and instance the far field). Measure via `perf-probe`. Higher-risk; scope carefully.
4. **W2 flagship greebles + W5 brighter/dusk procgen pass (optional, deferred from ACAP).** W3 already lifted the
   flagships via the shared material, so W2 is marginal; W5 (a dusk-lighting or exposure tune so the new detail reads
   in-game, not just in the bright framer) is global-lighting work — verify in `npm run dev`, not just the framer.

## Stretch goals
- Biome-weighted greeble distribution (salt→corrosion, rocky→structural, dune→tanker) — thread biome → `addHullGreebles`.
- A genuine procgen breach HOLE via a lofted-in gap (D197) — bigger than a decal.

## Verification protocol
`npm run verify` (= `tsc --noEmit`) clean. **Perf:** `perf-probe` before/after (+ the `topGroupsDeep` dump) — record
numbers. **Procgen/flagship visual:** the `procgen-wreck` + `flagship --name=` rig-shots + `panels` bury-audit PASS.
**Items 1-3 are interaction/feel-critical** → verify in `npm run dev` (the framer can't confirm "still drives / still
takeable"). Rule 8: screenshot-iterate any visual change.

## Autonomy contract
Items 2-3 are attended (interaction-preserving) — if running unattended, do the SAFE half (measure + identify the parts)
and STOP before the merge/instancing that needs live-drive verification; surface it. Item 1 needs a human throughout.
Ambiguous → GDD pillars + `decisions.md` realism dial; append a D-entry; continue.

## Footguns (this arc)
- **The merge skips `accessPanel`/`noMerge`/`interactType`/transparent (D198).** ANIMATED parts with no `interactType`
  (wheels, the tow-bar) are NOT auto-skipped — tag them `noMerge` before merging the speeder, or they freeze.
- **In-group debris/decoration on a buried parent → pre-compensate by buryY (D200)** so it lands on terrain after the sink.
- **Shared hull material (D199)** — changes hit EVERY wreck; verify across small procgen + the hero + a flagship.
- **Procgen wrecks are X-long, the hero Z-long; the framer pins orientation** so `side`=+Z broadside (D194/ACAO).
- **Windows rig-shot teardown** now `taskkill /T /F`s the vite tree (ACAO) — if a run wedges, check for an orphan on 5191.

## Save discipline (D81)
Geometry/material/collider/tooling only → no `SAVE_VERSION` bump.

## Stop conditions
3 fix-walls on one element (log + move on) · a `SAVE_VERSION` bump turning out necessary (surface it) · destructive-git
attempt · an interaction-preserving merge/instancing that can't be live-verified unattended (do the safe half, surface).

## On stop
Run `/session-end` (verify → changelog → CLAUDE last-shipped → roadmap → D-entries → backlog → report → next-prompt →
post-mortem → commit + tag `session-ACAQ` + push).
