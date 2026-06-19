# Campaign cycle-34 kickoff (overnight, ultracode) — `campaign/2026-06-18`

## Boot order (re-read every cycle from FILES)
1. `docs/campaign/campaign-state.json` · 2. `docs/campaign/steering.md` · 3. `docs/roadmap.md` "Up next" · 4. `docs/iteration-plan.md` · 5. `CLAUDE.md` + `docs/decisions.md` tail (D243).

## Where we are
- ✓ M1 · ✓ M2 · ✓ M3 · ✓ M4 · ✓ M5 · ✓ **M5a COMPLETE** · **M5b IN PROGRESS (C32-):** ✓ wordless-prop-scenes (C32) · ✓ wind-mood-soundscape (C33).
- **→ M5b — Living world & tone (cycle 34).** M5b is the **LAST Phase-A tier**; **2 units remain** (rare-sky-phenomena, diurnal-cycle, worm-far-horizon-crossing — 3 actually). When the **last** unit ships → **the Phase-A milestone PAUSE**.

## Cycle 34 picks up: **M5b → `rare-sky-phenomena`** (M5b unit 3/5)
M5b remaining (in order): **rare-sky-phenomena** · diurnal-cycle · worm-far-horizon-crossing.
- **rare-sky-phenomena** — occasional, awe-inducing sky events that make the world feel alive + reward looking up: a shooting star / meteor streak, a rare green aurora shimmer, a blood moon, a sun-pillar / sundog, a distant lightning flicker on the horizon. Fire RARELY (most nights nothing) so they stay special. **ASSESS FIRST:** what sky systems exist — grep `sky`/`star`/`STAR_`/`moon`/`updateSky`/`updateSky`/`aurora` in `src/world/sky.ts` + `src/core/lighting.ts`. The sky is a **shader sphere** (`sky.ts`) + stars (C28/ACBB `STAR_BRIGHTNESS`). Likely scope: a `rareSkyPhenomena.ts` system (ticked in the per-frame order, pause-gated) that on a rare seeded/timed roll spawns a transient effect (a shooting-star streak mesh that arcs + fades; or modulates a sky-shader uniform for an aurora band). **VISUAL** → render + adversarial gate (Rule 8). Watch determinism (no scatter-rand perturbation — use a dedicated stream or time-based) + the tick order.
- Reuses the night sky (stars already brightened ACBB). A shooting-star (a glowing streak that arcs across the night sky + fades) is the most iconic + buildable first effect; an aurora (a shimmering shader band) the richest.

## Rig-shot (reuse): `wordless [--idx=] [--angle=]` · `vista [--dist=] [--fogmult=]` · `spyglass-view` · `sun-probe` · `storm` · `smoke-plume`. For a NIGHT sky effect: `__game.setTime(0.0)` (midnight) + position the camera looking up. Debug: `__game.setTime`, `__game.setCloudiness`, `__game.audioState()` (C33 wind), `__game.sunInfo()`.

## Verify gotcha (C18-33)
`npm run verify:all` → `verify:placement` 5 seeds via spawnSync, buffers to END (~5-7 min; seed FLAKE → re-run once). **NEVER `taskkill node.exe` while verify runs** (C29). **Don't render (port 5173) concurrently with verify:placement** — sequence: renders → clean node → ONE verify. A code-auditor/Workflow agent (no node) CAN run concurrently with verify. **Audio/render-only changes** after a passing verify keep placement/colliders valid — re-run tsc (C32/C33). **`setTime` in a headless probe doesn't propagate to `sunDir`/`sunHeight` until a frame ticks** (rAF-throttled — C31); compute the sun from dayTime if needed. **Audio can't be heard headlessly** (suspended AudioContext, no gesture) — verify audio by code-auditor + walk-test.

## Autonomy contract
- **⚡ ULTRACODE** (overnight, max-quality): adversarial Workflow gate on a NEW VISUAL ASSET (rare-sky = visual → render + critique, Rule 8); **code-auditor** on AUDIO/logic/systems (C33 wind: code-auditor CLEAN — the right gate for non-visual). **Save (D81)** additive. **Don't re-do already-done — ASSESS the current state first** (C33's lesson was huge: the soundscape was SILENT, so the unit was "synthesize the wind," not "tweak it" — always check what actually runs). **Build the buildable/objective scope, defer feel to the walk-test. Reuse, don't rebuild.**
- **⚠ M5b is the LAST Phase-A tier. When M5b's FINAL unit (worm-far-horizon-crossing) ships, the cycle PAUSES at `### Milestone: Phase A — Build-out complete`** — set `status:paused`, `awaiting_approval:true`, `stop_reasons:["milestone-review"]`, STOP (no ScheduleWakeup). Backstop **max-cycles=50** (now at 33).

## Stop conditions
**Phase A milestone (PAUSE — after M5b's last unit)** · max-cycles=50 · 3 fix-walls · placement/collider regression unclearable in 2 tries (a single-seed FLAKE re-run is NOT a regression) · SAVE_VERSION bump (do it, surface only) · destructive-git attempt.

## Open backlog of note (the WALK-TEST batch is large — surface at the Phase-A pause)
- **C33:** the day/night-LIFE beds + MUSIC are still SILENT (empty sample pack) — synthesize procedurally (a future unit); wind FEEL (levels/cutoffs/whistle) → walk-test. **C32:** wordless-scenes polish (far-distance legibility, backlit-skull-at-3q, edge rocks). **C31:** sun-shade FEEL + <8m-wreck coverage. **C30:** vista-reveal FEEL. **C29:** spyglass model end-on lens + FEEL. **C28:** horizon-silhouette impostor. **C26/C27:** sleep-fade + 3P torch flicker. **C24:** attach_rope LMB. **C22:** amban economy. Full list: `docs/backlog.md`.
