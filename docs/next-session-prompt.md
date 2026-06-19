# Campaign cycle-25 kickoff (overnight, ultracode) — `campaign/2026-06-18`

## Boot order (re-read every cycle from FILES)
1. `docs/campaign/campaign-state.json` · 2. `docs/campaign/steering.md` · 3. `docs/roadmap.md` "Up next" · 4. `docs/iteration-plan.md` · 5. `CLAUDE.md` + `docs/decisions.md` tail (D240).

## Where we are
- ✓ M1 · ✓ M2 content · ✓ M3 COMPLETE · ✓ M4 COMPLETE · **M5 IN PROGRESS (C23-):** ✓ speeder-riding-feel (verified) · ✓ rope-attach-speeder-rear-bar (C24 — explicit tow-bar tie/untie).
- **→ M5 next unit: `3p-camera-and-render-polish` (cycle 25).**

## Cycle 25 picks up: **M5 → `3p-camera-and-render-polish`** (take the top remaining M5 unit)
M5 remaining (in order): **3p-camera-and-render-polish** · lie-down-to-sleep · viewmodel-nits (3P torch flame).
- **3p-camera-and-render-polish** = backlog §A "3P pass (ABP/ABQ)" (line ~28) — a grab-bag of 3P render/camera polish. **Headless-BUILDABLE candidates** (pick the highest-value, assess each first): **held items in 3P** (canteen/machete/scrap_gun/bandage swap+render in the rig hand — render via `bike-truth`/a 3P rig render + adversarial gate); **foot-IK idle→walk-on-slope snap** (cosmetic reset snap); **walk-cycle ↔ footstep cadence sync** (gait vs footstep timer); **cameraSnapNextFrame** on mount/dismount/save-load (camera shouldn't lerp across teleports — a clean logic fix). Plus the C23 **speeder ride-pose foot-LIFT** (re-bake via the bike-truth IK loop) belongs to this 3P/IK polish unit.
- **ASSESS FIRST** (the strong recurring lesson). Several of these may be partly built. The held-items-in-3P + foot-IK are VISUAL (render + gate, Rule 8). cameraSnapNextFrame is a logic fix (code-auditor). Camera *feel* (orbit, mount-lerp) → walk-test.
- This is a multi-item unit — pick the highest-value BUILDABLE sub-item(s) for the cycle (e.g. held-items-in-3P render + the foot-lift), ship + gate, defer the feel/camera-orbit parts to the walk-test. It may take >1 cycle (ship `[partial]`).

## Rig-shot (reuse): `bike-truth` (rig-on-bike, 5 angles + numeric IK — good for the 3P rig + foot-IK) · `speeder-fx` · `smoke-plume`(+`--storm`) · `storm` · `item-studio --item=<id>` · `vulture-pose` · `worm-model`. Debug hooks: `__game.spawnFire`, `__game.warmSmoke`, `__game.spawnRaider`. (For a 3P held-item render: enter 3P, equip the item, frame the rig hand — see `rigStudio` in debugPanel.)

## Verify gotcha (C18-24 — keeps biting)
`npm run verify:all` → `verify:placement` runs **5 seeds sequentially via spawnSync** + **buffers ALL output to the very END** — empty mid-run ≠ hung. Slow (~5-7 min). **Do NOT kill it** (zombies contend for the port → next run hangs). If it hangs: `taskkill //F //IM node.exe` → confirm `tasklist | grep -c node` is 0 → ONE clean run. A docs-only/no-src cycle can skip the suite (cite byte-identical + tsc; C11/C23). Clean node BEFORE verify; render ONE scenario per command; don't render concurrently with verify. A logic feature → code-auditor gate (not visual); a visual change → adversarial gate.

## Autonomy contract
- **⚡ ULTRACODE** (overnight, max-quality): adversarial Workflow gate on VISUAL; code-auditor on AUDIO/logic; **Rule 8** for any new visual. **Save (D81)** additive + surface-bump only if the schema grows. **Don't re-do already-done items — verify current state first.** **Don't blind-tune multi-session-tuned FEEL** (C20/C22/C23 — tune objective levers, flag feel for the walk-test). **Build the buildable scope of a design-gated unit + defer the design part** (C24 — the tow-bar attach was buildable via the LMB metaphor; only the RMB-pick UX was design-gated).
- Pauses at the **Phase A milestone** (after M5b — M5 (3 units left), M5a, M5b remain). Backstop **max-cycles=50** (now at 24).

## Stop conditions
Phase A milestone (pause, after M5b) · max-cycles=50 · 3 fix-walls · placement/collider regression unclearable in 2 tries · SAVE_VERSION bump (do it, surface only) · destructive-git attempt.

## Open backlog of note
- **C24:** `attach_rope` LMB double-fires a weapon swing (pre-existing, all rope-attach paths — §A). **C23:** speeder ride-pose foot-LIFT (§A — belongs to this 3P/IK unit). **C22:** amban deeper economy fix + feel → milestone. smoke-plume storm-bend (motion); SANDWORM_COUNT balance; `worm_lure` craft recipe. yard-cross-poi-merge (D240). Full list: `docs/backlog.md`.
