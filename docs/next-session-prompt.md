# Campaign cycle-35 kickoff (overnight, ultracode) — `campaign/2026-06-18`

## Boot order (re-read every cycle from FILES)
1. `docs/campaign/campaign-state.json` · 2. `docs/campaign/steering.md` · 3. `docs/roadmap.md` "Up next" · 4. `docs/iteration-plan.md` · 5. `CLAUDE.md` + `docs/decisions.md` tail (D243).

## Where we are
- ✓ M1 · ✓ M2 · ✓ M3 · ✓ M4 · ✓ M5 · ✓ **M5a COMPLETE** · **M5b IN PROGRESS (C32-):** ✓ wordless-prop-scenes (C32) · ✓ wind-mood-soundscape (C33) · ✓ rare-sky-phenomena (C34).
- **→ M5b — Living world & tone (cycle 35).** **2 units left:** diurnal-cycle, **worm-far-horizon-crossing** (the LAST). When worm-far-horizon-crossing ships → **the Phase-A milestone PAUSE**.

## Cycle 35 picks up: **M5b → `diurnal-cycle`** (M5b unit 4/5)
M5b remaining (in order): **diurnal-cycle** · worm-far-horizon-crossing.
- **diurnal-cycle** — the day/night cycle's PACING + FEEL as a tone layer: how a day passes, the dawn/dusk transitions, whether the length feels right + reads as a lived rhythm (not just a sun moving). **ASSESS FIRST — this is heavily ALREADY-BUILT** (C31/C33's recurring lesson): there's a full day/night system (`core/lighting.ts` sets `sunHeight`/`sunDir` from `dayTime`; `world/sky.ts` blends NIGHT→DUSK→DAY sky colors; `ctx.time.dayTime`/`daysSurvived`; `__game.setTime`). grep `dayTime`/`DAY_LENGTH`/`dayLengthSec`/`TIME_SCALE`/`daysSurvived` in `tuning.ts` + `player/controller.ts` (where dayTime advances). **So this may be (a) TUNING the day length / transition pacing (a feel call → likely defer to walk-test, run lean + verify the existing system like C23/C25), or (b) a small ADDITION** — e.g. a dawn/dusk tone beat (a brief birdsong/ambient shift — but the day/night LIFE beds are SILENT, C33 backlog), a "new day" subtle marker, or golden-hour light warmth. **Decide what's genuinely missing vs already-there before building.** If it's pure pacing/feel, this is a verify-and-defer cycle (cite the existing system).
- Watch: don't blind-tune a multi-session-tuned day/night feel (the autonomy contract). Build only an objective addition if one is clearly missing; else verify + defer to the walk-test.

## Rig-shot (reuse): **`fireball`** (C34 bolide) · `vista [--dist=] [--fogmult=]` · `wordless [--idx=] [--angle=]` · `spyglass-view` · `sun-probe` · `storm`. Sky/time: `__game.setTime(0..1)` (0=midnight, 0.25=dawn, 0.5=noon, 0.75=dusk) — but it doesn't propagate to `sunHeight` until a frame ticks (rAF; compute from dayTime if needed). Debug: `__game.triggerFireball()`, `__game.audioState()`, `__game.sunInfo()`.

## Verify gotcha (C18-34)
`npm run verify:all` → `verify:placement` 5 seeds via spawnSync, buffers to END (~5-7 min; seed FLAKE → re-run once). **NEVER `taskkill node.exe` while verify runs** (C29). **Don't render (port 5173) concurrently with verify:placement** — sequence: renders → clean node → ONE verify. A code-auditor/Workflow agent (no node) CAN run concurrently with verify. **Render-only / sky-visual / audio changes** after a passing verify keep placement/colliders valid — re-run tsc (C32/C33/C34). The sky uses `Math.random` for runtime visuals (shooters/fireball) — that's fine, NOT a placement-determinism concern.

## Autonomy contract
- **⚡ ULTRACODE** (overnight, max-quality): adversarial Workflow gate on a NEW VISUAL ASSET (C34 fireball: 2 rounds → PASS); **code-auditor** on AUDIO/logic; **verify-and-defer** for already-built feel (C23/C25/C33-assess). **Rule 8** for new visuals. **Save (D81)** additive. **Don't re-do already-done — ASSESS first** (the BIG recurring lesson C31/C32/C33/C34: systems are often already built or silently inert — check what RUNS). **Don't blind-tune multi-session-tuned feel; build the buildable/objective scope, defer feel to the walk-test. Reuse, don't rebuild.**
- **⚠ M5b is the LAST Phase-A tier. When worm-far-horizon-crossing (the LAST unit) ships, the cycle PAUSES at `### Milestone: Phase A — Build-out complete`** — set `status:paused`, `awaiting_approval:true`, `stop_reasons:["milestone-review"]`, STOP (no ScheduleWakeup). Backstop **max-cycles=50** (now at 34).

## Stop conditions
**Phase A milestone (PAUSE — after M5b's last unit)** · max-cycles=50 · 3 fix-walls · placement/collider regression unclearable in 2 tries (a single-seed FLAKE re-run is NOT a regression) · SAVE_VERSION bump (do it, surface only) · destructive-git attempt.

## Open backlog of note (the WALK-TEST batch is large — surface at the Phase-A pause, now 1-2 cycles away)
- **C34:** fireball polish (a tighter white-hot core + a crisper anisotropic bloom — sev1; the in-motion streak feel) → walk-test; more rare phenomena (aurora / blood moon / horizon heat-lightning) future. **C33:** day/night-life + music beds still SILENT (synthesize); wind FEEL. **C32:** wordless-scenes polish. **C31:** sun-shade FEEL + coverage. **C30:** vista FEEL. **C29:** spyglass model lens + FEEL. **C28:** horizon-silhouette impostor. **C26/C27:** sleep-fade + torch flicker. **C24:** attach_rope LMB. **C22:** amban economy. Full list: `docs/backlog.md`.
