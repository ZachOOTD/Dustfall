# Campaign cycle-23 kickoff (overnight, ultracode) — `campaign/2026-06-18`

## Boot order (re-read every cycle from FILES)
1. `docs/campaign/campaign-state.json` · 2. `docs/campaign/steering.md` · 3. `docs/roadmap.md` "Up next" · 4. `docs/iteration-plan.md` · 5. `CLAUDE.md` + `docs/decisions.md` tail (D240).

## Where we are
- ✓ M1 · ✓ M2 content · ✓ M3 COMPLETE · ✓ **M4 COMPLETE (C19-22):** vulture-motion · atmosphere · smoke-plume · rifle-balance.
- **→ M5 — Riding & rest feel** is the next tier (cycle 23 starts it).

## Cycle 23 picks up: **M5 → `speeder-riding-feel`** (take the TOP M5 unit)
M5 units (in order): **speeder-riding-feel** · rope-attach-speeder-rear-bar · 3p-camera-and-render-polish (held-items-in-3P, footstep sync, foot-IK snap) · lie-down-to-sleep · viewmodel-nits (3P torch flame).
- **speeder-riding-feel** — the speeder (`src/world/speeder.ts`) EXISTS (a rideable bike — dust trail, roll, etc.). This is FEEL polish of riding: accel/decel, lean/roll into turns, camera behavior while riding, boost, ground-follow, dust. **ASSESS FIRST** (the strong recurring lesson — EVERY M3/M4 unit was substantially pre-built; expect the same). grep `speeder` + `ride`/`riding`/`mount` across `src/world/speeder.ts` + `src/player/` + `tuning.ts` (`SPEEDER_*`). Understand what riding already does before tuning.
- **Riding is heavily MOTION/FEEL** (the in-play handling can't be fully judged headless). Headless-checkable: the speeder MODEL + a static ride-pose render (the player on the bike); the camera framing; any identifiable bug (like C19's dangling legs — e.g. the rider's pose/IK, the bike not following terrain, a roll that over/undershoots). Tune the identifiable levers + mark the handling FEEL feel-pending walk-test.
- Likely shape: a verify-and-targeted-tweak cycle (like C19/C20) OR a small fix if a concrete issue surfaces. Render via a speeder/ride rig-shot scenario if one exists (grep rig-shot.mjs for `speeder`/`ride`); if not + a static pose is worth gating, add one (the C20/C21 pattern).

## Rig-shot (reuse): `--scenario=smoke-plume`(+`--storm`) · `storm` · `item-studio --item=<id>` · `vulture-pose` · `worm-model`. Debug hooks: `__game.spawnFire`, `__game.warmSmoke`, `__game.spawnRaider` (corpse-drag test affordance — NOT a live threat).

## Verify gotcha (C18-22 — keeps biting)
`npm run verify:all` → `verify:placement` runs **5 seeds sequentially via spawnSync** + **buffers ALL output to the very END** — empty mid-run ≠ hung. Slow (~5-7 min). **Do NOT kill it** (zombies contend for the port → the next run hangs). If it hangs: `taskkill //F //IM node.exe` → confirm `tasklist | grep -c node` is 0 → ONE clean run. **Clean lingering node BEFORE verify. Render ONE scenario per command (back-to-back renders flake). Don't render concurrently with verify (port contention).**

## Autonomy contract
- **⚡ ULTRACODE** (overnight, max-quality): adversarial Workflow gate on VISUAL; code-auditor on AUDIO/logic; **Rule 8** for any new visual. **Save (D81)** additive + surface-bump only if the schema grows. **Don't re-do already-done items — verify current state first** (the dominant pattern all campaign-resume cycles). **Don't blind-tune multi-session-tuned FEEL** (C20/C22 lesson — tune the identifiable/objective levers, flag the feel for the walk-test).
- Pauses at the **Phase A milestone** (after M5b — getting close: M5, M5a, M5b remain). Backstop **max-cycles=50** (now at 22).

## Stop conditions
Phase A milestone (pause, after M5b) · max-cycles=50 · 3 fix-walls · placement/collider regression unclearable in 2 tries · SAVE_VERSION bump (do it, surface only) · destructive-git attempt.

## Open backlog of note
- **amban rifle (C22):** cd nudged 1.6→2.2; the deeper economy fix (2× ammo-efficient — DPS-parity cd, or 2-bullet rounds) + the balance FEEL → milestone review (backlog §A).
- smoke-plume storm-bend slightly clumpy frozen (motion); storm dust specks (frozen, motion-masked); vulture tucked-leg subtlety; SANDWORM_COUNT balance; `worm_lure` craft recipe (dev-start only). yard-cross-poi-merge (D240). Full list: `docs/backlog.md`.
