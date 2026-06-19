# Campaign cycle-22 kickoff (overnight, ultracode) — `campaign/2026-06-18`

## Boot order (re-read every cycle from FILES)
1. `docs/campaign/campaign-state.json` · 2. `docs/campaign/steering.md` · 3. `docs/roadmap.md` "Up next" · 4. `docs/iteration-plan.md` · 5. `CLAUDE.md` + `docs/decisions.md` tail (D240).

## Where we are
- ✓ M1 · ✓ M2 content · ✓ M3 COMPLETE · **M4 IN PROGRESS (C19-):** ✓ vulture-motion-feel · ✓ atmosphere-feeltunes · ✓ smoke-signal-plume (C21 — net-new fire beacon).
- **→ M4 LAST unit: `amban-rifle-balance` (cycle 22)**, then **M4 COMPLETE → M5 (Riding & rest feel).**

## Cycle 22 picks up: **M4 → `amban-rifle-balance`** (the LAST M4 unit)
- **amban-rifle-balance** = tuning the existing AMBAN RIFLE weapon (damage / handling / fire-rate / recoil / ammo balance). **ASSESS FIRST** (the strong recurring lesson — assess what's shipped before changing). grep `amban` + `rifle` across `src/player/combat.ts` + `src/inventory/items.ts` + `src/config/tuning.ts` (look for `AMBAN_*` / `RIFLE_*` tunables). Understand the current damage/handling + how it compares to other weapons (machete, etc.) + the threat it's balanced against (the worm? vultures? — note raiders are NOT a world threat per D13).
- This is a **tuning/balance** unit → mostly `tuning.ts` constants. **Balance is FEEL** (does it feel good to shoot / is it over/under-powered) → hard to judge fully headless. A render can show the rifle MODEL/viewmodel + a muzzle-flash; the damage/handling FEEL is walk-test. So: tune the identifiable balance levers (assess vs the design intent), gate any VISUAL change (viewmodel/flash) lightly, and mark the balance FEEL feel-pending walk-test. If the rifle is already well-balanced (likely, given the maturity), this is a verify-and-mark-mostly-done cycle (like C19) + maybe one targeted tweak.
- **This completes M4.** After it ships → M4 COMPLETE → **M5 — Riding & rest feel** (speeder-riding-feel · rope-attach · 3p-camera-polish · lie-down-to-sleep · viewmodel-nits). M5 is the next tier; cycle 23 starts it. Still NOT a Phase boundary (the Phase A milestone is after M5b).

## Rig-shot (reuse): **NEW `--scenario=smoke-plume` (+`--storm`)** (fire smoke beacon — C21) · `--scenario=storm` (peak sandstorm — C20) · `item-studio --item=<id>` (held items incl. the rifle viewmodel) · vulture-pose · worm-model. NEW debug hooks: `__game.spawnFire([x,z])`, `__game.warmSmoke(seconds)`.

## Verify gotcha (C18-21 — keeps biting)
`npm run verify:all` → `verify:placement` runs **5 seeds sequentially via spawnSync** + **buffers ALL output to the very END** — empty mid-run ≠ hung. Slow (~5-7 min). **Do NOT kill it** (zombies contend for the port). If it hangs: `taskkill //F //IM node.exe` → confirm `tasklist | grep -c node` is 0 → ONE clean run. Clean node BEFORE verify; don't render concurrently with verify. **Renders flake when run back-to-back (sequential) — render ONE scenario per command, not two chained.**

## Autonomy contract
- **⚡ ULTRACODE** (overnight, max-quality): adversarial Workflow gate on VISUAL; code-auditor on AUDIO/logic; **Rule 8** for any new visual. **Save (D81)** additive + surface-bump only if the schema grows. **Don't re-do already-done items — verify current state first.** **Don't blind-tune multi-session-tuned FEEL** (C20 lesson — tune the headless-judgeable parts, mark feel-pending).
- Pauses at the **Phase A milestone** (after M5b). Backstop **max-cycles=50** (now at 21).

## Stop conditions
Phase A milestone (pause) · max-cycles=50 · 3 fix-walls · placement/collider regression unclearable in 2 tries · SAVE_VERSION bump (do it, surface only) · destructive-git attempt.

## Open backlog of note
- smoke-plume: storm bend reads slightly clumpy/blobby frozen + clear upper-third thins (motion-dependent — walk-test); MOTION rise cadence walk-test. storm dust specks (frozen, motion-masked). vulture tucked-leg subtlety. SANDWORM_COUNT balance · `worm_lure` craft recipe (dev-start only). yard-cross-poi-merge (D240). Full list: `docs/backlog.md`.
