# Campaign cycle-29 kickoff (overnight, ultracode) — `campaign/2026-06-18`

## Boot order (re-read every cycle from FILES)
1. `docs/campaign/campaign-state.json` · 2. `docs/campaign/steering.md` · 3. `docs/roadmap.md` "Up next" · 4. `docs/iteration-plan.md` · 5. `CLAUDE.md` + `docs/decisions.md` tail (D240).

## Where we are
- ✓ M1 · ✓ M2 content · ✓ M3 · ✓ M4 · ✓ M5 · **M5a IN PROGRESS (C28-):** ◑ horizon-landmark-silhouettes `[partial]` (C28 — system + nav cue ship; per-model impostor polish → backlog §A).
- **→ M5a next unit: `salvaged-spyglass` (cycle 29).**

## Cycle 29 picks up: **M5a → `salvaged-spyglass`** (take the top remaining M5a unit)
M5a remaining (in order): **salvaged-spyglass** · vista-crest-reveal · sun-shade-exposure.
- **salvaged-spyglass** — a SPYGLASS/scope item: hold it (RMB or use) to ZOOM the view, so the player can scan the horizon (read the C28 distant landmark silhouettes, spot wrecks/water/landmarks to navigate toward). Pairs with the horizon silhouettes (zoom in on a distant landmark to identify it). **ASSESS FIRST:** is there an existing zoom/scope/FOV mechanic? grep `zoom`/`fov`/`scope`/`spyglass`/`telescope` across `src/player/` + `src/inventory/items.ts` + `tuning.ts`. The amban rifle (marksman) — does it have a scope/zoom? If a zoom mechanic exists, the spyglass reuses it; if not, it's net-new (a held-item zoom: lower the camera FOV while held/aimed, a vignette/scope overlay, the spyglass viewmodel).
- Likely **net-new**: a `spyglass` item (ItemId + items.ts def + makeViewModel) + a zoom mechanic (camera FOV lerp on use/RMB) + maybe a scope vignette overlay. **Save (D81):** an inventory item = additive (the item registry handles it). **VISUAL** (the spyglass model + the scope overlay) → render + gate (Rule 8). Zoom FEEL → walk-test.
- Where to obtain: a craft recipe or a wreck-loot drop (or dev-start for testing, like the worm_lure C18).

## Rig-shot (reuse): **NEW `--scenario=vista [--dist=<m>]`** (horizon landmark silhouettes — C28) · `item-studio --item=<id>` (the spyglass model) · `rig3p --item=<id> [--lit]` · `bike-truth` · `smoke-plume`(+`--storm`) · `storm` · `vulture-pose` · `worm-model`. Debug hooks: `__game.spawnFire`, `__game.warmSmoke`, `__game.spawnRaider`.

## Verify gotcha (C18-28 — keeps biting; C26 hit a seed FLAKE)
`npm run verify:all` → `verify:placement` runs **5 seeds sequentially via spawnSync** + **buffers ALL output to the very END** — empty mid-run ≠ hung. Slow (~5-7 min). A seed can FLAKE ("NO AUDIT LINE" = a headless boot timeout, NOT a real bury — C26 seed-2); **re-run once to clear it.** **Do NOT kill a running verify** (zombies → port contention). If it hangs: `taskkill //F //IM node.exe` → confirm 0 → ONE clean run. Docs-only → skip (byte-identical + tsc). Clean node BEFORE verify; render ONE scenario per command; don't render concurrently with verify.

## Autonomy contract
- **⚡ ULTRACODE** (overnight, max-quality): adversarial Workflow gate on VISUAL; code-auditor on AUDIO/logic/UI; **Rule 8** for any new visual (5-8 rounds for a hero visual — a net-new item model qualifies; if a big visual can't converge, ship `[partial]` + queue the polish, like C28). **Save (D81)** additive + surface-bump only if the schema grows. **Don't re-do already-done items — verify current state first.** **Don't blind-tune multi-session-tuned FEEL or blind-build design/feel features; build the buildable/objective scope, defer feel to the walk-test.** A conventional feature via the standard pattern IS buildable (C24/C26).
- Pauses at the **Phase A milestone** (after M5b — M5a (3 units + the horizon polish) + M5b remain). Backstop **max-cycles=50** (now at 28).

## Stop conditions
Phase A milestone (pause, after M5b) · max-cycles=50 · 3 fix-walls · placement/collider regression unclearable in 2 tries (a single-seed FLAKE re-run is NOT a regression) · SAVE_VERSION bump (do it, surface only) · destructive-git attempt.

## Open backlog of note
- **C28:** horizon-silhouette POLISH (per-model impostor / ground-tuck / far-boldness — §A). **C27:** 3P torch flicker → walk-test. **C26:** sleep-fade timing → walk-test. **C24:** attach_rope LMB double-fires. **C22:** amban economy → milestone. SANDWORM_COUNT balance; `worm_lure` craft recipe. yard-cross-poi-merge (D240). Full list: `docs/backlog.md`.
