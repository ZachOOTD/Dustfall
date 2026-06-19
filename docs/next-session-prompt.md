# Campaign cycle-28 kickoff (overnight, ultracode) — `campaign/2026-06-18`

## Boot order (re-read every cycle from FILES)
1. `docs/campaign/campaign-state.json` · 2. `docs/campaign/steering.md` · 3. `docs/roadmap.md` "Up next" · 4. `docs/iteration-plan.md` · 5. `CLAUDE.md` + `docs/decisions.md` tail (D240).

## Where we are
- ✓ M1 · ✓ M2 content · ✓ M3 COMPLETE · ✓ M4 COMPLETE · ✓ **M5 COMPLETE (C23-27).**
- **→ M5a — Exploration & exposure** is the next tier (cycle 28 starts it). **M5a then M5b, then the Phase A milestone PAUSE.**

## Cycle 28 picks up: **M5a → `horizon-landmark-silhouettes`** (take the TOP M5a unit)
M5a units (in order): **horizon-landmark-silhouettes** · salvaged-spyglass · vista-crest-reveal · sun-shade-exposure.
- **horizon-landmark-silhouettes** — distant LANDMARK silhouettes on the horizon as navigation cues ("that flagship wreck on the skyline → camp is that way"). **ASSESS FIRST:** the hand-modeled flagships + hero landmarks exist (`src/world/heroLandmarks.ts`; the megaShip/satelliteDish/etc. flagships). Are they ALREADY visible from afar on the horizon (render distance / fog / LOD), or do they fade into the fog before they read as skyline silhouettes? grep `heroLandmark`/`horizon`/`landmark`/`LOD`/`renderDistance` + check the fog (`FOG_DENSITY_CLEAR=0.0018`, "1km+ visible" per tuning) vs the flagship spawn distances. The gap may be: (a) flagships too far / fogged to read as silhouettes, (b) no DEDICATED far-horizon silhouette layer (billboards/impostors on the skyline), (c) already-visible → verify + feel-pending.
- This is likely **net-new or a real gap** (M5a = exploration, more feature-y than M5's polish). If net-new: a far-horizon silhouette layer (distant dark landmark shapes on the skyline that don't fog out) OR ensure the hero flagships read from distance. VISUAL → render (a long-distance horizon shot — perf-probe/a vista scenario, or add one) + adversarial gate (Rule 8). Navigation FEEL → walk-test.
- **Save (D81):** likely none (silhouettes are render-only). **Determinism:** if it scatters, re-run verify:placement.

## Rig-shot (reuse): `perf-probe` (scene/boot) · `storm` · `smoke-plume`(+`--storm`) · `rig3p --item=<id> [--lit]` (C27 lit flag) · `bike-truth` · `item-studio --item=<id>` · `vulture-pose` · `worm-model`. For a HORIZON shot: position the camera high + look at the skyline (may need a new `vista`/`horizon` scenario — the C20/C21 add-a-scenario pattern). Debug hooks: `__game.spawnFire`, `__game.warmSmoke`, `__game.spawnRaider`.

## Verify gotcha (C18-27 — keeps biting; C26 hit a seed FLAKE)
`npm run verify:all` → `verify:placement` runs **5 seeds sequentially via spawnSync** + **buffers ALL output to the very END** — empty mid-run ≠ hung. Slow (~5-7 min). A seed can FLAKE ("NO AUDIT LINE" = a headless boot timeout, NOT a real bury — C26 seed-2); **re-run once to clear it.** **Do NOT kill a running verify** (zombies → port contention). If it hangs: `taskkill //F //IM node.exe` → confirm 0 → ONE clean run. Docs-only → skip (byte-identical + tsc; C11/C23/C25). Clean node BEFORE verify; render ONE scenario per command; don't render concurrently with verify.

## Autonomy contract
- **⚡ ULTRACODE** (overnight, max-quality): adversarial Workflow gate on VISUAL; code-auditor on AUDIO/logic/UI; **Rule 8** for any new visual. **Save (D81)** additive + surface-bump only if the schema grows. **Don't re-do already-done items — verify current state first.** **Don't blind-tune multi-session-tuned FEEL or blind-build design/feel features; build the buildable/objective scope, defer feel to the walk-test.** A conventional low-risk feature via the standard pattern IS buildable (C24/C26).
- Pauses at the **Phase A milestone** (after M5b — M5a (4 units) + M5b remain). Backstop **max-cycles=50** (now at 27).

## Stop conditions
Phase A milestone (pause, after M5b) · max-cycles=50 · 3 fix-walls · placement/collider regression unclearable in 2 tries (a single-seed FLAKE re-run is NOT a regression) · SAVE_VERSION bump (do it, surface only) · destructive-git attempt.

## Open backlog of note
- **C27:** 3P torch flicker → walk-test (mirror is exact). **C26:** sleep-fade timing → walk-test. **C25:** 3P camera-orbit/foot-IK-snap (design/feel), speeder foot-lift (STRUCTURAL). **C24:** attach_rope LMB double-fires (pre-existing). **C22:** amban economy → milestone. SANDWORM_COUNT balance; `worm_lure` craft recipe. yard-cross-poi-merge (D240). Full list: `docs/backlog.md`.
