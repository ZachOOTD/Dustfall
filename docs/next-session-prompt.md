# Campaign cycle-27 kickoff (overnight, ultracode) — `campaign/2026-06-18`

## Boot order (re-read every cycle from FILES)
1. `docs/campaign/campaign-state.json` · 2. `docs/campaign/steering.md` · 3. `docs/roadmap.md` "Up next" · 4. `docs/iteration-plan.md` · 5. `CLAUDE.md` + `docs/decisions.md` tail (D240).

## Where we are
- ✓ M1 · ✓ M2 content · ✓ M3 COMPLETE · ✓ M4 COMPLETE · **M5 IN PROGRESS (C23-):** ✓ speeder-riding-feel · ✓ rope-attach · ✓ 3p-camera-polish · ✓ lie-down-to-sleep (C26 — sleep fade transition).
- **→ M5 LAST unit: `viewmodel-nits` (cycle 27)**, then **M5 COMPLETE → M5a (Exploration & exposure).**

## Cycle 27 picks up: **M5 → `viewmodel-nits`** (the LAST M5 unit)
- **viewmodel-nits** = backlog §A "Small viewmodel nits" (line ~29): the **3P torch flame doesn't animate in the rig-hand copy** (FP-only, ACAA — the `tpMesh` torch flame is static in 3P while the FP one flickers); + FP held-item NIGHT lighting (fixed vm-scene lights → held items don't dim at night, D170). **ASSESS FIRST.**
  - The 3P-torch-flame is the most concrete: the FP viewmodel torch flickers (animated), but the 3P `tpMesh` copy (on `rightHandAttach`, see viewModel.ts C25 notes) is a static duplicate that doesn't get the flame animation. Fix = drive the 3P torch flame's animation too (find the FP flame anim, apply it to the tpMesh copy). VISUAL → render (rig3p --item=torch) + judge; the anim is motion → walk-test, but a lit-vs-unlit/flicker-pose render can confirm.
  - The FP night-lighting nit (held items don't dim at night) is a lighting fix (the vm-scene uses fixed lights) — assess if it's a clean fix.
- Likely a small, concrete fix (or two). Render+gate if visual; code-auditor if logic. **This COMPLETES M5.**

## After M5 → **M5a — Exploration & exposure** (cycle 28+): horizon-landmark-silhouettes · salvaged-spyglass · vista-crest-reveal · sun-shade-exposure. **These are more NET-NEW feature work** (per the C25 meta-flag — M5's riding/3P polish was heavily pre-built; M5a should have meatier builds). Then **M5b**, then the **Phase A milestone PAUSE** (walk-test + Phase B design review).

## Rig-shot (reuse): `rig3p --item=<id>` (3P rig + held item — good for the 3P torch) · `item-studio --item=torch` (the torch model) · `bike-truth` · `smoke-plume`(+`--storm`) · `storm` · `vulture-pose` · `worm-model`. Debug hooks: `__game.spawnFire`, `__game.warmSmoke`, `__game.spawnRaider`.

## Verify gotcha (C18-26 — keeps biting; C26 hit a FLAKE)
`npm run verify:all` → `verify:placement` runs **5 seeds sequentially via spawnSync** + **buffers ALL output to the very END** — empty mid-run ≠ hung. Slow (~5-7 min). **A seed can FLAKE** ("NO AUDIT LINE (boot/render failed)" = a headless boot/render timeout, NOT a real bury) — C26 hit this on seed 2 (the other 4 passed 0-fails); **re-run once to clear it** (per the skill — don't escalate a flake). **Do NOT kill a running verify** (zombies → port contention). If it hangs: `taskkill //F //IM node.exe` → confirm 0 → ONE clean run. A docs-only cycle can skip the suite (byte-identical + tsc; C11/C23/C25). Clean node BEFORE verify; render ONE scenario per command; don't render concurrently with verify.

## Autonomy contract
- **⚡ ULTRACODE** (overnight, max-quality): adversarial Workflow gate on VISUAL; code-auditor on AUDIO/logic/UI; **Rule 8** for any new visual. **Save (D81)** additive + surface-bump only if the schema grows. **Don't re-do already-done items — verify current state first** (THE M5 pattern). **Don't blind-tune multi-session-tuned FEEL or blind-build design/feel features; build the buildable/objective scope, defer feel to the walk-test** (C20/C22/C23/C25). **A conventional, low-risk feature via the standard pattern IS buildable** (C24 rope-attach, C26 sleep-fade — both shipped cleanly with a code-auditor gate).
- Pauses at the **Phase A milestone** (after M5b — viewmodel-nits finishes M5, then M5a + M5b remain). Backstop **max-cycles=50** (now at 26).

## Stop conditions
Phase A milestone (pause, after M5b) · max-cycles=50 · 3 fix-walls · placement/collider regression unclearable in 2 tries (a single-seed FLAKE re-run is NOT a regression) · SAVE_VERSION bump (do it, surface only) · destructive-git attempt.

## Open backlog of note
- **C26:** sleep-fade timing → walk-test (`SLEEP_FADE_MS`/`_HOLD_MS` tunable). **C25:** 3P camera-orbit/color-boost/foot-IK-snap (design/feel/cosmetic), speeder foot-lift (STRUCTURAL). **C24:** attach_rope LMB double-fires (pre-existing). **C22:** amban economy → milestone. SANDWORM_COUNT balance; `worm_lure` craft recipe. yard-cross-poi-merge (D240). Full list: `docs/backlog.md`.
