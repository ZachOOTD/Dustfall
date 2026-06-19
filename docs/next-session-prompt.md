# Campaign cycle-21 kickoff (overnight, ultracode) — `campaign/2026-06-18`

## Boot order (re-read every cycle from FILES)
1. `docs/campaign/campaign-state.json` · 2. `docs/campaign/steering.md` · 3. `docs/roadmap.md` "Up next" · 4. `docs/iteration-plan.md` · 5. `CLAUDE.md` + `docs/decisions.md` tail (D240).

## Where we are
- ✓ M1 · ✓ M2 content (yard-merge deferred D240) · ✓ M3 COMPLETE (worm + lure) · **M4 IN PROGRESS (C19-):** ✓ vulture-motion-feel (C19) · ✓ atmosphere-feeltunes (C20 — storm pre-built; fixed the dust "snow" read + a new `storm` render scenario).
- **→ M4 next unit: `smoke-signal-plume`** (cycle 21).

## Cycle 21 picks up: **M4 → `smoke-signal-plume`** (take the top remaining M4 unit)
M4 remaining (in order): **smoke-signal-plume** · amban-rifle-balance.
- **smoke-signal-plume** — likely **NET-NEW** (the M4 units before it were mostly pre-built). Probable shape: a placeable/lightable **smoke signal** (a fire that emits a tall rising smoke PLUME visible from afar — a navigation/signal beacon), OR a plume rising off existing fires/wrecks. **ASSESS FIRST** (the strong recurring lesson — C8/C17/C19/C20 were all substantially pre-built): grep `smoke`, `plume`, `signal`, `beacon` across `src/world/` + `src/audio/` + check `fire.ts`/deployables + the particle systems (`particleTrail.ts`, `footprintPuffs.ts`, the storm `dustMotes`/`ambientDust` pattern). If a smoke/plume system exists → tune/finish it; if not → build the minimal coherent version.
- If NET-NEW: a particle plume (reuse the `THREE.Points` + soft-radial-texture pattern from `weather.ts` dust / `particleTrail.ts`), likely tied to a fire/deployable. **Save (D81):** a new placeable = additive; surface-bump only if a deployed-list field is added.
- Gate: a rising plume is VISUAL → render it (a new rig-shot scenario like the C20 `storm` one, OR reuse an existing fire/world scenario) + adversarial gate (Rule 8 for a net-new visual). The plume's MOTION (rising/drift) → feel-pending walk-test.

## Rig-shot (reuse): **NEW `--scenario=storm`** (peak sandstorm look — C20). vulture `--scenario=vulture-pose --state=flying|circling|landing --angle=3q|side`. worm `--scenario=worm-model`. held item `--scenario=item-studio --item=<id>`. (Scenario filenames are by state/item — an angle re-render overwrites; render one at a time if the studio teardown flakes.)

## Verify gotcha (C18-20 — important, keeps biting)
`npm run verify:all` → `verify:placement` runs **5 seeds sequentially via spawnSync** + **buffers ALL output to the very END** — an empty mid-run log means "still running," NOT "hung." Slow (~5-7 min). **Do NOT kill it** (killing spawns zombie vite/node procs that contend for the port + hang the next run). If it truly hangs: `taskkill //F //IM node.exe` → confirm `tasklist | grep -c node` is 0 → ONE clean run. **Clean lingering node procs BEFORE verify; don't run a rig-shot render concurrently with verify (port contention).**

## Autonomy contract
- **⚡ ULTRACODE** (overnight, max-quality): adversarial Workflow gate on VISUAL; code-auditor on AUDIO/logic; **Rule 8** for any NEW visual (smoke-plume likely qualifies). **Save (D81)** additive + surface-bump only if the schema grows. **Don't re-do already-done items — verify current state first** (every M4 unit so far was substantially pre-built).
- **Don't blind-tune multi-session-tuned FEEL systems** (C20 lesson — left the storm sway alone; tuned only the headless-judgeable LOOK). Pauses at the **Phase A milestone** (after M5b). Backstop **max-cycles=50** (now at 20).

## Stop conditions
Phase A milestone (pause) · max-cycles=50 · 3 fix-walls · placement/collider regression unclearable in 2 tries · SAVE_VERSION bump (do it, surface only) · destructive-git attempt.

## Open backlog of note
- storm: residual dust specks over the darkest sky (frozen-frame, motion-masked — walk-test); horizon-seam sev1 (ground vs sky tonal split); vignette is gentle. Storm sway/wind/dust-in-motion → walk-test.
- vulture: tucked-leg subtlety (nit); MOTION feel walk-test. worm: SANDWORM_COUNT balance · `worm_lure` craft recipe (dev-start only). yard-cross-poi-merge (D240). Full list: `docs/backlog.md`.
