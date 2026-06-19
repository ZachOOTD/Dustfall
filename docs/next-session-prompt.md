# Campaign cycle-24 kickoff (overnight, ultracode) — `campaign/2026-06-18`

## Boot order (re-read every cycle from FILES)
1. `docs/campaign/campaign-state.json` · 2. `docs/campaign/steering.md` · 3. `docs/roadmap.md` "Up next" · 4. `docs/iteration-plan.md` · 5. `CLAUDE.md` + `docs/decisions.md` tail (D240).

## Where we are
- ✓ M1 · ✓ M2 content · ✓ M3 COMPLETE · ✓ M4 COMPLETE · **M5 IN PROGRESS (C23-):** ✓ speeder-riding-feel (C23 — ride system VERIFIED; handling feel-pending).
- **→ M5 next unit: `rope-attach-speeder-rear-bar` (cycle 24).**

## Cycle 24 picks up: **M5 → `rope-attach-speeder-rear-bar`** (take the top remaining M5 unit)
M5 remaining (in order): **rope-attach-speeder-rear-bar** · 3p-camera-and-render-polish (held-items-in-3P, footstep sync, foot-IK snap) · lie-down-to-sleep · viewmodel-nits (3P torch flame).
- **rope-attach-speeder-rear-bar** — backlog §B (line ~42): "Rope-attach to the speeder via its rear MOUNT BAR (replaces the mount-while-holding-rope tether-transfer flow)." The rope system exists (`src/world/rope.ts`) + a speeder tow/tether flow. This makes the rope attach to the speeder's rear bar (drag/tow things behind the bike). **ASSESS FIRST** — read `rope.ts` + the speeder tow path (grep `rope`/`tether`/`tow`/`attach` in `speeder.ts` + `rope.ts` + `interaction.ts`/`wieldAction.ts`) + how the rear-bar / rear mount is modeled on the speeder. Understand the CURRENT tether-transfer flow before replacing it.
- This may be a **net-new mechanic** (the rope→rear-bar attach point + the tow behind the bike) OR a partial refactor of the existing tether flow. If net-new/substantial: design the minimal coherent version (attach point on the rear bar + the rope follows the bike + a release). **Save (D81):** a persisted attach-state = additive; surface-bump only if a field is added.
- Visual: the rope + attach point is VISIBLE → render it (a rope/tow rig-shot scenario if one exists — grep rig-shot.mjs for `rope`/`tow`; else a static shot via `__game` hooks) + a gate if it's a new visual. The tow FEEL (does dragging behind the bike feel good) → walk-test.

## Rig-shot (reuse): `bike-truth` (rig-on-bike, 5 angles + numeric IK) · `speeder-fx` (dust/glow) · `smoke-plume`(+`--storm`) · `storm` · `item-studio --item=<id>` · `vulture-pose` · `worm-model`. Debug hooks: `__game.spawnFire`, `__game.warmSmoke`, `__game.spawnRaider`.

## Verify gotcha (C18-23 — keeps biting)
`npm run verify:all` → `verify:placement` runs **5 seeds sequentially via spawnSync** + **buffers ALL output to the very END** — empty mid-run ≠ hung. Slow (~5-7 min). **Do NOT kill it** (zombies contend for the port → next run hangs). If it hangs: `taskkill //F //IM node.exe` → confirm `tasklist | grep -c node` is 0 → ONE clean run. **A docs-only/no-src cycle can skip the full suite** (cite "src byte-identical to the last PASS" + a tsc re-confirm — C11/C23 precedent). Clean node BEFORE verify; render ONE scenario per command; don't render concurrently with verify.

## Autonomy contract
- **⚡ ULTRACODE** (overnight, max-quality): adversarial Workflow gate on VISUAL; code-auditor on AUDIO/logic; **Rule 8** for any new visual. **Save (D81)** additive + surface-bump only if the schema grows. **Don't re-do already-done items — verify current state first** (the dominant pattern). **Don't blind-tune multi-session-tuned FEEL** (C20/C22/C23 — tune objective/identifiable levers, flag feel for the walk-test).
- Pauses at the **Phase A milestone** (after M5b — M5 (4 units left), M5a, M5b remain). Backstop **max-cycles=50** (now at 23).

## Stop conditions
Phase A milestone (pause, after M5b) · max-cycles=50 · 3 fix-walls · placement/collider regression unclearable in 2 tries · SAVE_VERSION bump (do it, surface only) · destructive-git attempt.

## Open backlog of note
- **speeder (C23):** ride-pose foot-LIFT (feet ~22cm/14cm below pegs — re-bake via bike-truth's IK loop); riding HANDLING feel → walk-test (§A).
- **amban rifle (C22):** cd nudged 1.6→2.2; deeper economy fix + feel → milestone review. smoke-plume storm-bend (motion); storm dust specks (frozen). SANDWORM_COUNT balance; `worm_lure` craft recipe. yard-cross-poi-merge (D240). Full list: `docs/backlog.md`.
