# Campaign cycle-33 kickoff (overnight, ultracode) — `campaign/2026-06-18`

## Boot order (re-read every cycle from FILES)
1. `docs/campaign/campaign-state.json` · 2. `docs/campaign/steering.md` · 3. `docs/roadmap.md` "Up next" · 4. `docs/iteration-plan.md` · 5. `CLAUDE.md` + `docs/decisions.md` tail (D242).

## Where we are
- ✓ M1 · ✓ M2 · ✓ M3 · ✓ M4 · ✓ M5 · ✓ **M5a COMPLETE** · **M5b IN PROGRESS (C32-):** ✓ wordless-prop-scenes (C32).
- **→ M5b — Living world & tone (cycle 33).** M5b is the **LAST Phase-A tier**; when its **last** unit ships → **the Phase-A milestone PAUSE** (loop stops for the user's walk-test + Phase-B design review).

## Cycle 33 picks up: **M5b → `wind-mood-soundscape`** (M5b unit 2/5)
M5b remaining (in order): **wind-mood-soundscape** · rare-sky-phenomena · diurnal-cycle · worm-far-horizon-crossing.
- **wind-mood-soundscape** — make the wind/ambient bed carry MOOD: shift its timbre/intensity with the conditions (time of day, storm intensity, biome, near a wreck vs open dune) so the world feels alive + the soundscape tells you where/when you are. **ASSESS FIRST** (likely an EXTENSION, not net-new — C31's lesson): the game ALREADY has `updateSoundscape` (`src/audio/soundscape.ts`) + a storm low-pass muffle (`setStormMuffle`) + procedural music (`updateMusic`). grep `soundscape`/`wind`/`updateSoundscape`/`ambient`/`_ambient`/`windGain` to see what's there. Likely scope: layer/modulate the existing wind bed by mood factors (a low night drone, a hollow whistle near wreck openings, a warmer dusk tone), driven from `ctx.time`/`ctx.weather`/proximity. **This is AUDIO** → code-auditor review (NOT a visual gate — C30/C31 precedent: code-auditor is the right gate for non-visual systems). Audio FEEL → walk-test. Watch determinism + the tick order (`updateSoundscape` runs after `updatePlayer`).
- All Web Audio is synthesized (no sample files) — new tones = new oscillator/filter graphs in `audio.ts`/`soundscape.ts` (model on `playVistaReveal` C30 / the existing wind loop).

## Rig-shot (reuse): **`wordless [--idx=] [--angle=]`** (C32 tableaux) · `vista [--dist=] [--fogmult=]` · `spyglass-view [--raw]` · `sun-probe` · `storm` · `smoke-plume`. Debug: `__game.setTime`, `__game.setCloudiness`, `__game.triggerStorm`, `__game.sunInfo()`. Audio can't be screenshotted — verify by code-auditor + (walk-test) ear.

## Verify gotcha (C18-32)
`npm run verify:all` → `verify:placement` 5 seeds via spawnSync, buffers to END (~5-7 min; seed FLAKE → re-run once). **NEVER `taskkill node.exe` while verify runs** (C29). **Don't render (port 5173) concurrently with verify:placement** — sequence: renders → clean node → ONE verify. A code-auditor/Workflow agent (no node) CAN run concurrently with verify. **Render-only changes after a passing verify** (e.g. a material/mesh tweak that draws no scatter-rand + adds no collider) keep the placement/collider result valid — just re-run tsc (C11/C23/C32 precedent). Audio/AUDIO-only changes likewise don't touch placement.

## Autonomy contract
- **⚡ ULTRACODE** (overnight, max-quality): adversarial Workflow gate on a NEW VISUAL ASSET; **code-auditor** on AUDIO/logic/systems (wind-mood-soundscape = AUDIO → code-auditor). **Rule 8** for visuals (C32 wordless: a hero visual took 3 gate rounds — concept landed but the skull/composition needed work; converge by self-assessment after the top blockers are fixed rather than re-gating indefinitely). **Save (D81)** additive. **Don't re-do already-done — verify current state first** (C31/C32: both EXTENDED existing systems). **Build the buildable/objective scope, defer feel to the walk-test. Reuse, don't rebuild.**
- **⚠ M5b is the LAST Phase-A tier. When M5b's FINAL unit (worm-far-horizon-crossing) ships, the cycle PAUSES at `### Milestone: Phase A — Build-out complete`** — set `status:paused`, `awaiting_approval:true`, `stop_reasons:["milestone-review"]`, STOP (no ScheduleWakeup). Backstop **max-cycles=50** (now at 32).

## Stop conditions
**Phase A milestone (PAUSE — after M5b's last unit)** · max-cycles=50 · 3 fix-walls · placement/collider regression unclearable in 2 tries (a single-seed FLAKE re-run is NOT a regression) · SAVE_VERSION bump (do it, surface only) · destructive-git attempt.

## Open backlog of note (the WALK-TEST batch is large — surface at the Phase-A pause)
- **C32:** wordless-scenes polish (far-distance prop legibility, the backlit-skull-reads-dark at oblique 3q, occasional ambient rock at a stage edge; consider a closer player-encounter telegraph). **C31:** sun-shade FEEL + the <8m-wreck coverage gap. **C30:** vista-reveal FEEL. **C29:** spyglass model end-on lens + FEEL. **C28:** horizon-silhouette POLISH (impostor — §A). **C26/C27:** sleep-fade + 3P torch flicker. **C24:** attach_rope LMB double-fires. **C22:** amban economy. Full list: `docs/backlog.md`.
