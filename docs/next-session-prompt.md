# Campaign cycle-30 kickoff (overnight, ultracode) — `campaign/2026-06-18`

## Boot order (re-read every cycle from FILES)
1. `docs/campaign/campaign-state.json` · 2. `docs/campaign/steering.md` · 3. `docs/roadmap.md` "Up next" · 4. `docs/iteration-plan.md` · 5. `CLAUDE.md` + `docs/decisions.md` tail (D241).

## Where we are
- ✓ M1 · ✓ M2 · ✓ M3 · ✓ M4 · ✓ M5 · **M5a IN PROGRESS (C28-):** ◑ horizon-landmark-silhouettes `[partial]` (C28) · ✓ salvaged-spyglass (C29).
- **→ M5a next unit: `vista-crest-reveal` (cycle 30).**

## Cycle 30 picks up: **M5a → `vista-crest-reveal`** (take the top remaining M5a unit)
M5a remaining (in order): **vista-crest-reveal** · sun-shade-exposure.
- **vista-crest-reveal** — the **moment you crest a dune ridge and a vista opens up** (a wreck-field / a landmark / the horizon laid out below). The pull of exploration: reward climbing. **ASSESS FIRST what "reveal" should mean here** — grep `crest`/`vista`/`ridge`/`overlook`/`reveal` + look at the terrain/camera/HUD. Candidate forms (pick one, build the buildable, defer feel): (a) a **subtle audio+visual beat** when the player crosses onto a high ridge with open sightlines (a soft swell + maybe a brief vignette-lift / exposure bump), gated so it fires rarely (not every dune); (b) a **landmark-ping**: cresting reveals which distant landmarks (the C28 silhouettes) are now in view (pairs with the spyglass); (c) a **draw-distance/fog lift** at altitude so the vista actually extends. **Most likely net-new** + partly FEEL (the trigger threshold, the swell timing) → build the objective scope (the detection + the effect), defer the threshold/feel tuning to the walk-test. Watch determinism (no new scatter-rand) + the `updateX` tick order.
- **The C28 `vista` + C29 `spyglass-view` rig-shot scenarios** are good for rendering any crest/vista visual.

## Rig-shot (reuse): `vista [--dist=]` (C28 horizon silhouettes) · **`spyglass-view [--raw]`** (C29 zoom + scope vignette) · `item-studio --item=<id>` · `rig3p --item=<id> [--lit]` · `bike-truth` · `smoke-plume`(+`--storm`) · `storm` · `vulture-pose`. Debug: `__game.spawnFire`, `__game.warmSmoke`, `__game.spawnRaider`, `__game.setTime`. Dev-start inventory has a `spyglass` (+ `worm_lure`) for walk-tests.

## Verify gotcha (C18-29 — keeps biting)
`npm run verify:all` → `verify:placement` runs **5 seeds sequentially via spawnSync** + **buffers ALL output to the END** (empty mid-run ≠ hung; ~5-7 min). A seed can FLAKE ("NO AUDIT LINE" = a headless boot timeout; re-run once). **NEVER `taskkill node.exe` while a verify is running** — C29 self-inflicted an EXIT=1 by killing verify's seed node procs mid-run for a concurrent render (the re-run was clean). **Don't run renders (port 5173) concurrently with verify:placement** — port contention. Sequence them: finish all renders → clean node → ONE verify. Docs-only → skip (tsc + byte-identical). `item-studio` flakes on teardown after a few angles (C18) — re-run; render mtimes tell you which angles are fresh.

## Autonomy contract
- **⚡ ULTRACODE** (overnight, max-quality): adversarial Workflow gate on VISUAL; code-auditor on logic/UI/audio; **Rule 8** for new visuals. **A net-new item MODEL can take 3+ gate rounds** (C29 spyglass: r1 thermos → r3 classic taper + recessed lenses; the SCOPE-view passed 1st time). **Converge, don't thrash:** when the gate's residuals are rare-view/lighting artifacts (a perfectly-end-on lens, matte brass under the FLAT item-studio light — the FP viewmodel is sun-lit in play), ship + note them, don't burn a 4th round. **Save (D81)** additive — a new inventory item + a `discoveredRecipes` id are both additive (no bump). **Don't re-do already-done items — verify current state first.** **Build the buildable/objective scope, defer feel to the walk-test.**
- Pauses at the **Phase A milestone** (after M5b — M5a (2 units: vista-crest-reveal, sun-shade-exposure) + M5b remain). Backstop **max-cycles=50** (now at 29).

## Stop conditions
Phase A milestone (pause, after M5b) · max-cycles=50 · 3 fix-walls · placement/collider regression unclearable in 2 tries (a single-seed FLAKE re-run is NOT a regression) · SAVE_VERSION bump (do it, surface only) · destructive-git attempt.

## Open backlog of note
- **C29:** spyglass model — the perfectly-end-on objective lens reads as a dark dot in the brass bell (a rare worst-case view; a flat objective face/washer would fix it) + the matte-brass studio-light read; spyglass FEEL (zoom speed/curve, vignette timing, no aim-down-sight pose) → walk-test. **C28:** horizon-silhouette POLISH (per-model impostor / ground-tuck / far-boldness — §A). **C27:** 3P torch flicker → walk-test. **C26:** sleep-fade → walk-test. **C24:** attach_rope LMB double-fires. **C22:** amban economy → milestone. yard-cross-poi-merge (D240). `worm_lure` craft recipe is now done-by-analogy (the spyglass got recipe 17; worm_lure could get one too). Full list: `docs/backlog.md`.
