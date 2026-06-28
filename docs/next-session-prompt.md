# ▶ RESUME — Escape-pod intro · Phase 0 · T0.4b (pod-as-spawn-wreck + tutorial scaffold + smoke) — COMPLETES PHASE 0 — `campaign/escape-pod-intro`

**Cycle 8 of the escape-pod-intro campaign.** Phase 0 (the greybox spine). **T0.4a (impact → wake →
desert handoff) COMPLETE — the spine plays end-to-end into the desert.** T0.4b is the **LAST Phase 0
unit**: after it, the cycle **PAUSES at the Phase 0 milestone** for the user's walk-test. Boot from
`docs/campaign/campaign-state.json` + `docs/roadmap.md` (NOT chat memory).

## Read first
1. `CLAUDE.md` (auto-loaded) — "Where we are now"
2. `docs/campaign/campaign-state.json` — cycle 7/150, current_tier (T0.4b)
3. `docs/roadmap.md` Phase 0 DoD (line ~142): "T0.4 … the pod-as-spawn-wreck seam → tutorial scaffold · the `feature-escape-pod-intro` smoke check." + the `### Milestone: escape-pod Phase 0` marker (~line 143).
4. `docs/feature-escape-pod-intro.md` — the vision (Beat 10 craft+salvage tutorial, Beat 11 chute-pop payoff; D261 machete-as-pry-tool)
5. `src/world/escapePodIntro/sequence.ts` (`tickStepOut`, `endEscapePodIntro`, `returnPos`) + `podScene.ts` (the greybox pod pattern)

## What's built (T0.0 → T0.4a)
- The WHOLE greybox spine plays: new game → cockpit → corridor → pod → eject → ship-explode → descent → chute-gag → impact → blackout → wake → **stepOut teleports to the desert spawn, normal game resumes**.
- `stepOut` currently calls `endEscapePodIntro` directly (ends at the handoff). HUD/locomotion/survival restored; ship+pod disposed; black cleared; `introComplete` derives true.
- Dev hooks: `__game.startIntro()`/`skipIntro()`/`jumpToBeat(beat)`. `returnPos` = the captured desert spawn.

## Cycle 8 focus — T0.4b: pod-as-spawn-wreck + tutorial scaffold + smoke check
Finish Phase 0. **Greybox scaffold, NOT the hero tutorial** (the real craft→pry→chute-pop is Phase 4 enrichment).
- **Pod-as-spawn-wreck seam** — on `stepOut`/handoff, place a **greybox crashed pod** at the desert spawn (near `returnPos`, half-buried/tilted) so the player wakes beside their own pod (the vision: "salvage your own pod"). Reuse the `podScene` box pattern, but this one is a WORLD object that persists into the real game (added to the scene at the spawn, NOT disposed by `endEscapePodIntro`). Keep it minimal greybox — the hero pod exterior is Phase 1.
- **Tutorial scaffold (Beats 10-11)** — the stepOut → tutorial → payoff flow. Greybox: after the handoff, show a diegetic hint ("scavenge scrap → craft a machete → pry the pod panel") — wire it as a **scaffold** (the hint + a placeholder salvage point on the pod), NOT the full crafting integration (that's Phase 4 + the real D261 machete-as-pry-tool). The chute-pop payoff (the parachute comically deploys from the crashed pod) can be a greybox stub/cue. **Decide:** keep this light — the milestone validates FLOW, and the real tutorial is a hero pass later. If wiring real crafting is more than a scaffold, keep it a scaffold + note the enrichment.
- **`feature-escape-pod-intro` smoke check** — add a smoke verification that the whole sequence is wired: either a `verification/checks/feature-escape-pod-intro.ts` (if the harness supports it — check `scripts/`/`verification/`) OR a documented `__game`-driven smoke (startIntro → jumpToBeat through all beats → reaches `done` + lands in the desert, no throw). Wire it into `verify:all` if cheap; else document the manual smoke in the changelog.
- **stepOut wiring** — if you add a tutorial beat, change `tickStepOut` to advance to `tutorial` (place the wreck + restore play but keep `intro` active for the tutorial beat) rather than ending immediately; the intro ends after `payoff`. OR keep the handoff-ends-the-intro model and run the tutorial as normal gameplay with hints. **Pick the simpler model that matches the vision** (the tutorial IS the first real gameplay, so handoff-then-hints is likely cleaner than keeping `intro.active`).

### Acceptance (T0.4b → Phase 0 complete)
- Full play: new game → … → wake → desert, **and the crashed pod is there beside you** with a "craft a machete / pry the pod" hint. The whole sequence is smoke-verified (all beats reachable → done). `verify:all` green; flag OFF → live game byte-unchanged; no SAVE_VERSION bump. `skipIntro` still lands cleanly.

## ⏸ AFTER THIS CYCLE: PHASE 0 MILESTONE PAUSE
When `/session-end` moves the Phase 0 tiers to Shipped (all tiers before `### Milestone: escape-pod Phase 0`),
the cycle sets `status: paused`, `awaiting_approval: true`, `stop_reasons: ["milestone-review"]` and **STOPS the
loop**. Surface to the user: **play the whole greybox intro** (new game with the flag on, or `__game.startIntro()`)
— feel the FLOW + PACING (not beauty; it's greybox). Then `/campaign-approve` to release Phase 1 (the hero pod).
Do NOT schedule another wakeup on the milestone-pause verdict.

## Campaign rules
ENRICH-NOT-CUT · greybox now / hero art in Phases 1-5 (procedural-modeler) · anti-punt · behind the flag ·
no save bump · `verify:all` (capture the real exit) + a live check · commit each cycle · checkpoint = per phase.

## Footguns
- Keep the flag OFF by default — live game byte-identical when the intro isn't active.
- The pod-as-spawn-wreck PERSISTS into the real game (a world object) — do NOT dispose it in `endEscapePodIntro` (that disposes the intro's offset ship/pod). It's a separate spawn-side object.
- Don't over-build the tutorial — it's a SCAFFOLD for the Phase 0 flow walk-test; the hero craft+salvage is Phase 4.
- `verify:all`: capture the real exit (don't pipe through `tail`).

## Verify
`npm run verify:all` (real exit) + a live preview: full `startIntro` → play/jump to the desert → confirm the crashed pod is at the spawn + the tutorial hint shows + the sequence smoke-completes + `skipIntro` clean + 0 console errors. Then `/session-end` → the Phase 0 milestone pause.
