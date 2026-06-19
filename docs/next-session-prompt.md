# Campaign cycle-36 kickoff (overnight, ultracode) — `campaign/2026-06-18`

## Boot order (re-read every cycle from FILES)
1. `docs/campaign/campaign-state.json` · 2. `docs/campaign/steering.md` · 3. `docs/roadmap.md` "Up next" · 4. `docs/iteration-plan.md` · 5. `CLAUDE.md` + `docs/decisions.md` tail (D243).

## Where we are
- ✓ M1 · ✓ M2 · ✓ M3 · ✓ M4 · ✓ M5 · ✓ **M5a COMPLETE** · **M5b IN PROGRESS (C32-):** ✓ wordless-prop-scenes · ✓ wind-mood-soundscape · ✓ rare-sky-phenomena · ✓ diurnal-cycle.
- **→ M5b — `worm-far-horizon-crossing` (cycle 36) — the LAST M5b unit AND the LAST Phase-A unit.**
- **⚠⚠ WHEN THIS UNIT SHIPS → the Phase-A milestone PAUSE fires (see the protocol below). This is the END of the unattended Phase-A block.**

## Cycle 36 picks up: **M5b → `worm-far-horizon-crossing`** (M5b unit 5/5 — the LAST)
- **worm-far-horizon-crossing** — the sandworm seen FAR away crossing the horizon as an AWE moment (the dorsal ridge / a breach arc sweeping across distant dunes), distinct from the close-up THREAT encounter. Rewards looking out + sells the world's scale ("that thing is out there"). **ASSESS FIRST** (the recurring lesson — worm systems are extensively built): grep `sandWorm`/`SANDWORM_`/`updateWorm`/`worm.*state`/`patrol`/`breach`/`surface`/`disengage`/`farHorizon` in `src/enemies/sandWorm.ts` + tuning. The worm has a full AI (patrol/engage/breach, detection radius, disengage `ctx.player.inShelter`, multi-worm). **The likely build: a NEW "distant sighting" behavior** — occasionally a worm patrols/breaches at a FAR distance (well beyond engage range) in view, purely as a spectacle (no threat), maybe telegraphed by a far dust-plume + the low rumble (the worm-roar audio attenuates by distance already — `playWormRoarAttenuated`). Could reuse the worm mesh at distance + a scripted far traverse. **VISUAL/atmosphere** → render (the worm at distance on the dune horizon, via a rig-shot — there's a `worm-model` scenario) + adversarial gate (Rule 8) for the spectacle; the FEEL (timing/rarity) → walk-test. Watch determinism + the tick order + that it does NOT trip the close-encounter threat AI.
- Caps M5b's "living world" + the M3 worm: the worm is both a near threat and a distant, majestic presence.

## Rig-shot (reuse): **`worm-model`** (the worm mesh) · `fireball` · `vista [--dist=] [--fogmult=]` · `wordless` · `storm` · `smoke-plume`. Worm debug: `__game` worm hooks (grep `__game` in debugPanel for spawn/worm controls). `__game.setTime`, `__game.triggerFireball`, `__game.audioState`.

## Verify gotcha (C18-35)
`npm run verify:all` → `verify:placement` 5 seeds via spawnSync, buffers to END (~5-7 min; seed FLAKE → re-run once). **NEVER `taskkill node.exe` while verify runs** (C29). **Don't render (port 5173) concurrently with verify:placement** — sequence: renders → clean node → ONE verify. A code-auditor/Workflow agent (no node) CAN run concurrently with verify. Render/audio/AI-behavior changes that draw no scatter-rand + add no collider keep placement/colliders valid — re-run tsc.

## Autonomy contract
- **⚡ ULTRACODE**: adversarial Workflow gate on NEW VISUAL/spectacle (Rule 8); **code-auditor** on AI/logic/audio. **ASSESS-FIRST is the load-bearing habit** (C31-C35: systems are usually built or inert — check what RUNS; don't blind-tune multi-session feel). **Build the buildable/objective scope, defer feel to the walk-test. Reuse, don't rebuild.** **Save (D81)** additive.
- **⚠⚠ PHASE-A MILESTONE PAUSE PROTOCOL — fires when THIS unit (worm-far-horizon-crossing) ships:** after `/session-end` + the commit + the SHA-backfill + marker-removal, in `campaign-state.json` set `status:"paused"`, `awaiting_approval:true`, `stop_reasons:["milestone-review"]`; log the pause in `campaign-log.md` (which milestone, what to review); print the 3-line status with the human action ("review the Phase-A build + play it, then `/campaign-approve`"); and **STOP — do NOT call ScheduleWakeup.** The loop ends here for the user's walk-test + Phase-B (M6-M10) design review. Backstop **max-cycles=50** (now at 35).

## Stop conditions
**PHASE-A MILESTONE PAUSE (after this unit — the planned stop)** · max-cycles=50 · 3 fix-walls · placement/collider regression unclearable in 2 tries (a single-seed FLAKE re-run is NOT a regression) · SAVE_VERSION bump (do it, surface only) · destructive-git attempt.

## Hand to the human at the pause (surface this in the pause status)
The **walk-test batch is large** — flag it: **FEEL/walk-test owed:** worm-far-horizon timing (C36) · fireball in-motion (C34) · wind levels (C33) · sun-shade strength (C31) · vista-reveal (C30) · spyglass zoom + ADS (C29) · sleep-fade (C26) · 3P torch flicker (C27) · speeder handling + foot-lift (C23/C25). **Visual polish owed:** horizon-silhouette impostor (C28) · spyglass end-on lens (C29) · wordless far-legibility (C32) · fireball core/bloom (C34). **Silent systems:** day/night-life + music beds (C33). **Design-review for Phase B (M6-M10).** Full list: `docs/backlog.md`.
