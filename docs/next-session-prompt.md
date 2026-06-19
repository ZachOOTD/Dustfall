# Campaign cycle-19 kickoff (overnight, ultracode) — `campaign/2026-06-18`

## Boot order (re-read every cycle from FILES)
1. `docs/campaign/campaign-state.json` · 2. `docs/campaign/steering.md` · 3. `docs/roadmap.md` "Up next" · 4. `docs/iteration-plan.md` · 5. `CLAUDE.md` + `docs/decisions.md` tail (D240).

## Where we are
- ✓ M1 · ✓ M2 content (yard-merge deferred D240) · **✓ M3 COMPLETE (C12-18):** ✓ model · ✓ tail · ✓ charge · ✓ audio · ✓ multi-worm · ✓ **sarlacc-lure** (C18 — the `worm_lure` bait, no save bump).
- **→ M4 — Critters + atmosphere** is the next tier (cycle 19 starts it).

## Cycle 19 picks up: **M4 — Critters + atmosphere** (take the TOP unit from the roadmap)
M4 units (in order): **vulture-motion-feel** · atmosphere-feeltunes (incl. in-storm sway — *tunes of shipped systems*) · smoke-signal-plume · amban-rifle-balance.
- **vulture-motion-feel** (likely first): the vultures exist (circling scavengers) — this is a FEEL/motion polish of their flight (banking, soar/flap cadence, gaggle spacing, reaction to the player/corpses). Find them first — grep `vulture` (creatures/spawn + the update tick in `main.ts`). **Verify current state before rebuilding** (C17/C8 lesson: several "units" were already substantially built — assess, don't assume net-new).
- **atmosphere-feeltunes** = tuning shipped systems (storm sway, fog, wind) via `tuning.ts` — NOT new systems. **smoke-signal-plume** may be net-new (a placeable/sky plume). **amban-rifle-balance** = the amban rifle's damage/handling tunables.
- Most M4 work is **FEEL/tuning** (vulture motion, atmosphere) → the gate is mostly *appearance-verified + feel-pending walk-test*; only net-new visual (smoke plume) needs the full adversarial model gate.

## Rig-shot (reuse): worm `--scenario=worm-model --angle=head|side|3q|arc|charge` · held item `--scenario=item-studio --item=<id> --angles=front,3q` (renders the FIRST angle then the teardown can flake — render angles one-at-a-time if it times out; the PNG before the flake is valid).

## Verify gotcha (C18 — learned the hard way)
`npm run verify:all` → `verify:placement` runs **5 seeds sequentially via spawnSync** and **buffers ALL output to the very end** — an empty log mid-run means "still running the seeds," NOT "hung." It's slow (~5-7 min tonight). **Do NOT kill it** — killing it leaves zombie vite/node processes that contend for the port and make the NEXT run actually hang. If a run does hang, `taskkill //F //IM node.exe`, confirm `tasklist | grep -c node` is 0, then ONE clean run. Don't run a rig-shot render concurrently with verify (port contention).

## Autonomy contract
- **⚡ ULTRACODE** (overnight, max-quality): adversarial Workflow gate on VISUAL; code-auditor on AUDIO/logic; **Rule 8** for any new visual. **Save (D81)** additive + surface-bump only if the schema grows. **Don't re-do already-done items** — verify current state first.
- Pauses at the **Phase A milestone** (after M5b). Backstop **max-cycles=50** (now at 18).

## Stop conditions
Phase A milestone (pause) · max-cycles=50 · 3 fix-walls · placement/collider regression unclearable in 2 tries · SAVE_VERSION bump (do it, surface only) · destructive-git attempt.

## Open backlog of note
- worm: SANDWORM_COUNT tunable (encounter balance — walk-test) · dorsal-crest contrast · head-beef · the `worm_lure` craft recipe (currently dev-start-inventory only) + the in-hand model edge-on re-judge.
- yard-cross-poi-merge (D240). Full list: `docs/backlog.md`.
