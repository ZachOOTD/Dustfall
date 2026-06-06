# Session ACAJ-continuation — Kickoff Brief

## Read these now (in order)
1. `CLAUDE.md` (auto-loaded) — "Where we are now" (ACAJ T1+T2 shipped; T3-T7 continuation).
2. `docs/session-end-report.md` — cumulative state (ACAJ partial at top).
3. `docs/backlog.md` — the "ACAJ continuation" item + the procgen-overhaul item.
4. `docs/decisions.md` — tail D185 (wrap-a-curved-hull-over-the-box-interior; never rebuild the playable interior).
5. `docs/roadmap.md` — "Recently shipped" (ACAJ partial).
6. `docs/architecture.md` — read before touching `procgenWreck.ts`/`wrecks.ts` assembly.
7. `.claude/plans/archive/ACAJ-wreck-rebuild-perf.md` — the full 7-tier plan (T1+T2 done).

## What's already built
ACAJ T1 shipped **`src/world/wreckForms.ts`** — the shared procedural-hull toolkit: `makeLatheHull(profile, opts)` +
`fuselageProfile()` (tapered hull via LatheGeometry, `axis:'x'|'y'|'z'`, partial-arc `phiLength` for torn ends),
`makeFormerRings()` (exposed rib skeleton), `makeBreach()` (torn hole = void + bent flaps, NO boolean) +
`tagWreckDecoration()`, `makeSandMound()` (windward half-burial drift). ACAJ T2 used it to rebuild the **mega-wreck**
exterior into a curved downed-ship silhouette (FrontSide + `noCollider` shell over the untouched box interior — D185).
Verify harness: `wreck-form` (--form=lathe|formers|breach|mound), `megawreck` (--angle=3q|side|front|interior),
`__game.wreckFormStudio`/`wreckFormStudio` dev hooks; existing `panels` (bury-audit) + `perf-probe` scenarios.

## Session focus — finish the wrecks + perf overnight (T3-T7)
The toolkit (T1) is built; apply it to the fleet, bed wrecks in sand, then the perf merge. **No `SAVE_VERSION` bump
expected** (geometry/material only). **Preserve the salvage loop** — panels stay interactive + `panelBuryAudit` PASS.

## Priority items in order
1. **T3 — procgen fleet vocabulary level-up.** Upgrade the shared part builders (`wrecks.ts` hull/cockpit variants +
   `procgenWreck.ts` `HULL_SEGMENT_VARIANTS`) to use the toolkit: tapered/ribbed hull variants → `makeLatheHull` Lathe
   profiles + `makeFormerRings` at torn ends; the flat `addBreachPatches` → real `makeBreach` holes; cockpits → a cleaner
   dominant nose. Keep `assembleWreck`/recipes/biome-weights + the `panelAnchor` fallbacks. **Accept**: `panels`
   bury-audit PASS across seeds; a `wreck-visual` strip of corvette/freighter/gunship reads as ships, not box-stacks.
   Fan-out candidate (independent variant rewrites → `/visual-triage`).
2. **T4 — half-burial + sand.** Apply terrain-height sink + `makeSandMound` to procgen wrecks (`placeProcgenComposite` /
   `heroLandmarks.placeHeroLandmarks`) + the mega-wreck. Tune the mound COLOR in-context (it read cool under studio
   lights — match the dune `0xcd9555`). **Accept**: wrecks bed in the dunes; `panelBuryAudit` PASS (panels not buried).
3. **T5 — greeble + functional-asymmetry pass.** Expand `addHullGreebles` (place-by-normal: vents/antenna/ports/fins;
   negative space — not every surface) + one-sided impact damage. Tag `isWreckDecoration`. **Accept**: bury-audit PASS.
4. **T6 — WebGL wreck perf merge (NEVER CUT — the frames win).** `mergeGeometries` each assembled wreck's STATIC,
   non-interactive meshes by material (the `deadTree.ts:136` pattern) in `assembleWreck` + `makeMegaWreck`; keep the
   salvage PANELS + colliders SEPARATE (panels are interactive — do NOT merge them). **Accept**: `perf-probe` before/after
   shows a real draw-call drop; `panels` bury-audit + panel interaction unchanged; visual unchanged. **CAREFUL** — this
   touches the panel subtree; verify panel raycast/extract still works before committing.

## Stretch goals if budget allows
- **T7 — InstancedMesh/LOD**: instance repeated NON-interactive props (engine bells, common greebles) and/or a distance-LOD
  for far wrecks. Keep panels as regular meshes (no interaction-raycast `instanceId` rework).
- Material-factory → uniforms (wood/skin first) — collapse compiled programs (backlog §208).

## Autonomy contract
Ambiguous → GDD pillars + decisions.md realism dial, append a D-entry, continue. Screenshot-iterate every visual element
(rule 8 — 5-8 rounds new, 3-5 tuning); NEVER mark a visual tier done on `tsc` alone. The toolkit is shared — a change to a
builder ripples to all wrecks, so re-verify the mega-wreck (`megawreck`) after T3-T5.

## Stop conditions
Wall-clock/budget ceiling · 3 fix-walls on one element (log + move on) · a `SAVE_VERSION` bump turning out necessary
(surface it) · destructive-git attempt · **the T6 merge breaking panel interaction** (revert + flag, don't ship a broken
salvage loop).

## On stop
Run gamedev-framework `/session-end` (verify → changelog → CLAUDE last-shipped → roadmap → D-entries → backlog → report →
next-prompt → post-mortem → commit + tag `session-ACAJ` (or `-ACAK`) + push).

## Notable footguns
- **D185** — wreck rebuilds WRAP a curved hull over the box interior; FrontSide + `noCollider`; never rebuild the playable
  interior or touch the hand-authored colliders. Size the hull to ENVELOP the box (ellipse contains the rectangle corners).
- **D177** — any NEW onBeforeCompile material factory needs `customProgramCacheKey` (or uniforms). The toolkit reuses
  shared materials — don't allocate per-wreck.
- **`findPanelMount` rejects `isWreckDecoration`** — tag every greeble/breach so panels don't land on them.
- **The T6 merge must NOT merge panels** — they're interactive (raycast + per-component extract). Merge static only.
- Headless harness: software-GL can't measure the real-GPU shader-compile freeze; `perf-probe` measures draw calls/tris.

## Verification protocol
`npm run verify` (tsc) clean. `npm run rig-shot -- --scenario=panels` (bury-audit PASS), `--scenario=perf-probe` (draw-call
delta), `--scenario=megawreck` / `wreck-visual` / `wreck-form` (visual). Rule-8 screenshot iteration on every visual tier.

## Begin
Read the order above → confirm tsc clean → **T3: level up the procgen part vocabulary with `wreckForms.ts`** (start with
the RIBBED_CYLINDER + PANELED_TAPERED hull variants → Lathe + formers + real breach). Screenshot-iterate (rule 8);
`panels` bury-audit must stay green. → TaskCreate the T3-T7 plan → start.
