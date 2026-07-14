# Next cycle (15) — M7-R part 2: Skyfall interior floating-audit + more detail

**State:** campaign "Sharpen & Deepen" `active` on `campaign/2026-07-12-skyfall` (14 cycles, ~5.05M/8.75M
spent; +4M overnight cap). Checkpoint none. Queue: **M7-R (in progress) → M8 → M9 → M10 → M11 → M12**.

## M7-R progress
- ✅ **part 1 (cycle 14, D304)**: real hull thickness (paper-thin fix) + 100% exterior collision (dorsal
  containers). CLAUDE.md rule 7 generalized (no paper-thin double-sided).
- **REMAINING M7-R** (priority order; spec = `docs/feature-skyfall.md` M7-R section):
  1. **Interior floating-model audit** — sweep the interior; every panel/prop/greeble sits EXACTLY flush
     on its wall/surface, nothing floating or gapped. (Wall panels especially.)
  2. **More interior detail** — another lived-in density pass on the S4-S5 dressing.
  3. **Broken cockpit glass** — a shattered canopy on the bridge (intro-ship `shipScene.ts` `_glass`/dome
     vocabulary), cracked/holed to fit the crash.
  4. **Captain's log story** — the crew EJECTED IN THE DROP PODS; bespoke journal content in `crashLog.ts`
     (a short melancholy log, not generic freighter lore).

**Cycle 15 = fixes 1+2 (floating audit + more interior detail)** — one procedural-modeler pass on the
interior. Then cycle 16 = broken glass, cycle 17 = captain's-log story.

Gates every cycle: verify:all + 5 smokes + skyfall-walk (must stay PASS) + verify-chunks (det stable per
seed) + the adversarial visual gate for hero interior work. GPU probes ~26s. Determinism digest may shift
on geometry but must stay 8/8 stable.

## After M7-R completes → the world-deepening queue
M8 far-field vultures → M9 new POI archetypes → M10 story vignettes → M11 retire legacy tube-wrecks
(ship→socket, D227/D249) → M12 new far-field biome. Each its own `/feature-slice` when reached.

## Standing constraints (steering.md)
- **models-need-thickness** (rule 7, no paper-thin double-sided) · **100% collision** (rule 9, swept).
- Determinism law (D290) + streamed-teardown (D292/rule 9) for far-field content. No save-schema change
  without the sanctioned pause (D81). GPU probe default (`RIG_GL=swiftshader` reverts); never reap live.
- Cleanup owed (guard-blocked): remove the stray untracked `scratch-baseline/` dir (2 pngs) in the morning.
