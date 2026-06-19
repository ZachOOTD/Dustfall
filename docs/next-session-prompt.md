# Campaign cycle-26 kickoff (overnight, ultracode) — `campaign/2026-06-18`

## Boot order (re-read every cycle from FILES)
1. `docs/campaign/campaign-state.json` · 2. `docs/campaign/steering.md` · 3. `docs/roadmap.md` "Up next" · 4. `docs/iteration-plan.md` · 5. `CLAUDE.md` + `docs/decisions.md` tail (D240).

## Where we are
- ✓ M1 · ✓ M2 content · ✓ M3 COMPLETE · ✓ M4 COMPLETE · **M5 IN PROGRESS (C23-):** ✓ speeder-riding-feel · ✓ rope-attach-speeder-rear-bar · ✓ 3p-camera-and-render-polish (all verified/built).
- **→ M5 next unit: `lie-down-to-sleep` (cycle 26).**

## Cycle 26 picks up: **M5 → `lie-down-to-sleep`** (take the top remaining M5 unit)
M5 remaining (in order): **lie-down-to-sleep** · viewmodel-nits (3P torch flame).
- **lie-down-to-sleep** — a REST mechanic. **ASSESS FIRST** (the strong recurring lesson — M5 units keep being heavily pre-built): the sleep system likely EXISTS (`src/ui/sleepOverlay.ts` is present; grep `sleep`/`rest`/`bedroll`/`sleepOverlay` across `src/ui/` + `src/player/` + `src/world/bedroll.ts`). Understand what sleep ALREADY does (time-skip? stat recovery? the overlay? bedroll-gated?) before adding "lie-down." The unit may be: (a) a lie-DOWN pose/animation before the sleep overlay (the player rig lies prone — net-new RIG pose, render+gate via rig3p), (b) a "lie down anywhere to rest" vs the bedroll-gated sleep (a mechanic gap), or (c) already built (→ verify + feel-pending).
- If a net-new lie-down POSE: render it (rig3p / a prone-pose render) + adversarial gate (Rule 8). If a mechanic/logic change: code-auditor gate. Rest FEEL → walk-test. **Save (D81):** additive if a rest-state field is added.
- **NOTE the M5-polish pattern (C23/C25):** the riding + 3P systems were heavily pre-built → verify cycles. The sleep system MAY be similar. If lie-down-to-sleep is also mostly-built, verify it lean + move to `viewmodel-nits` (the last M5 unit), then **M5 → M5a (exploration & exposure)**, which has more net-new feature work (horizon-landmark-silhouettes, salvaged-spyglass, vista-crest-reveal, sun-shade-exposure — likely meatier builds).

## Rig-shot (reuse): `rig3p --item=<id>` (3P rig + held item — good for a lie-down/prone pose) · `bike-truth` · `speeder-fx` · `smoke-plume`(+`--storm`) · `storm` · `item-studio --item=<id>` · `vulture-pose` · `worm-model`. Debug hooks: `__game.spawnFire`, `__game.warmSmoke`, `__game.spawnRaider`.

## Verify gotcha (C18-25 — keeps biting)
`npm run verify:all` → `verify:placement` runs **5 seeds sequentially via spawnSync** + **buffers ALL output to the very END** — empty mid-run ≠ hung. Slow (~5-7 min). **Do NOT kill it** (zombies contend for the port → next run hangs). If it hangs: `taskkill //F //IM node.exe` → confirm `tasklist | grep -c node` is 0 → ONE clean run. A docs-only/no-src cycle can skip the suite (cite "src byte-identical to the last PASS" + a tsc re-confirm — C11/C23/C25). Clean node BEFORE verify; render ONE scenario per command; don't render concurrently with verify.

## Autonomy contract
- **⚡ ULTRACODE** (overnight, max-quality): adversarial Workflow gate on VISUAL; code-auditor on AUDIO/logic; **Rule 8** for any new visual. **Save (D81)** additive + surface-bump only if the schema grows. **Don't re-do already-done items — verify current state first** (THE dominant M5 pattern). **Don't blind-tune multi-session-tuned FEEL or blind-build design/feel features** (C20/C22/C23/C25 — build the buildable/objective scope, defer design/feel to the walk-test). **Build the buildable scope of a design-gated unit** (C24).
- Pauses at the **Phase A milestone** (after M5b — M5 (2 units left), M5a, M5b remain). Backstop **max-cycles=50** (now at 25 — HALFWAY).

## Stop conditions
Phase A milestone (pause, after M5b) · max-cycles=50 · 3 fix-walls · placement/collider regression unclearable in 2 tries · SAVE_VERSION bump (do it, surface only) · destructive-git attempt.

## Open backlog of note
- **C25:** 3P camera-orbit mode (design/feel — walk-test), thirdPersonColorBoost (speculative), foot-IK idle→walk snap (cosmetic), speeder foot-lift (STRUCTURAL leg-reach limit — accept). **C24:** attach_rope LMB double-fires (pre-existing, all paths — §A). **C22:** amban economy fix + feel → milestone. SANDWORM_COUNT balance; `worm_lure` craft recipe. yard-cross-poi-merge (D240). Full list: `docs/backlog.md`.
