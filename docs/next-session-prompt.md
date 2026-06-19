# Campaign cycle-20 kickoff (overnight, ultracode) — `campaign/2026-06-18`

## Boot order (re-read every cycle from FILES)
1. `docs/campaign/campaign-state.json` · 2. `docs/campaign/steering.md` · 3. `docs/roadmap.md` "Up next" · 4. `docs/iteration-plan.md` · 5. `CLAUDE.md` + `docs/decisions.md` tail (D240).

## Where we are
- ✓ M1 · ✓ M2 content (yard-merge deferred D240) · ✓ M3 COMPLETE (worm + lure) · **M4 IN PROGRESS (C19-):** ✓ vulture-motion-feel (infra pre-existing ACAI; fixed the dangling-leg soar tuck).
- **→ M4 next unit: `atmosphere-feeltunes`** (cycle 20).

## Cycle 20 picks up: **M4 → `atmosphere-feeltunes`** (take the top remaining M4 unit)
M4 remaining (in order): **atmosphere-feeltunes** · smoke-signal-plume · amban-rifle-balance.
- **atmosphere-feeltunes** = **TUNING of SHIPPED systems**, NOT new systems. Likely levers in `tuning.ts`: storm/wind in-storm sway, fog density/color, dust/haze, sky/exposure, ambient soundscape balance. **Find the shipped atmosphere systems first** — grep `storm`, `fog`, `wind`, `dust`, `sway`, `haze` across `src/world/` (sky.ts, weather, lighting) + `src/audio/`. The brief literally says "incl. in-storm sway" — check how the camera/viewmodel sway during a storm reads + tune it.
- This is a **FEEL/tuning** unit → mostly `tuning.ts` constant changes. **Verify current state before changing** (the recurring C8/C17/C19 lesson — several "units" were already substantially built; assess what the shipped values already do before re-tuning). A headless render can show fog/sky/storm STATE; the in-motion sway/wind FEEL is walk-test territory.
- Gate: if it changes visible atmosphere (fog/sky/storm look) → a render + a lean visual check; if it's purely motion/sway/audio feel → appearance-N/A + **feel-pending walk-test** (note it honestly, like C19's MOTION-feel-pending).

## Rig-shot (reuse): vulture `--scenario=vulture-pose --state=flying|circling|landing|swooping --angle=3q|side` (one state per run; filename is by-STATE so an angle re-render overwrites). Worm `--scenario=worm-model`. Held item `--scenario=item-studio --item=<id>`. Atmosphere: try `--scenario=perf-probe` for a quick boot/state read, or a weather/sky scenario if one exists (grep rig-shot.mjs for `storm`/`fog`/`weather`).

## Verify gotcha (C18-19 — important)
`npm run verify:all` → `verify:placement` runs **5 seeds sequentially via spawnSync** + **buffers ALL output to the very END** — an empty mid-run log means "still running the seeds," NOT "hung." It's slow (~5-7 min). **Do NOT kill it** — killing spawns zombie vite/node procs that contend for the port + hang the NEXT run. If it truly hangs: `taskkill //F //IM node.exe` → confirm `tasklist | grep -c node` is 0 → ONE clean run. Don't run a rig-shot render concurrently with verify (port contention). Clean lingering node procs BEFORE verify.

## Autonomy contract
- **⚡ ULTRACODE** (overnight, max-quality): adversarial Workflow gate on VISUAL; code-auditor on AUDIO/logic; **Rule 8** for any new visual. **Save (D81)** additive + surface-bump only if the schema grows. **Don't re-do already-done items** — verify current state first (the strong recurring pattern: assess before rebuilding).
- Pauses at the **Phase A milestone** (after M5b). Backstop **max-cycles=50** (now at 19).

## Stop conditions
Phase A milestone (pause) · max-cycles=50 · 3 fix-walls · placement/collider regression unclearable in 2 tries · SAVE_VERSION bump (do it, surface only) · destructive-git attempt.

## Open backlog of note
- vulture: tucked-leg mass is subtle at close-up (irrelevant at distance — nit); MOTION feel (cadence/banking/wheel) walk-test. SANDWORM_COUNT encounter balance · `worm_lure` craft recipe (dev-start only) + in-hand edge-on re-judge.
- yard-cross-poi-merge (D240). Full list: `docs/backlog.md`.
