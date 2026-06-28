# Campaign log — Dustfall: Escape-Pod Intro (`campaign/escape-pod-intro`)

Append-only human chronicle, one entry per cycle. Your async review surface — read this (or
`/campaign-status`) anytime. Redirect via `steering.md`. The prior M11→M13 campaign's chronicle is
archived at `campaign-log-2026-06-18-m1-m13.md`.

---

## Cycle 0 — campaign started (2026-06-28)

**Goal:** build the first-person escape-pod intro to a world-class bar — the full sequence (Beats
0-11) per `docs/feature-escape-pod-intro.md`, behind `FEATURES.escapePodIntro`.

**How we got here (this session):** resumed the M11→M13 review-fix campaign → ran it to completion
(M11 wreck/panel · M12 sand-worm · M13 audio, all user-approved) → merged to `master` + pushed +
deployed to GitHub Pages. Then the user chose the escape-pod intro as the next feature: a guided
vision interview (full beat-by-beat + tone/pace/camera/look/audio) → 10 approved enrichments →
solo/clean decision → reference research (4 sweeps) → pod-identity research → **industrial modular
box** chosen → `/feature-slice` produced the phased BUILD PLAN → a critical pre-build review whose
fixes were folded in → user said "proceed."

**Policies:** checkpoint=**milestone** (markers at PHASE boundaries — pause per phase for the user's
walk-test) · self-author=**propose** · visual-gate=**auto** · verify=**`npm run verify:all`** +
the new sequence smoke check · branch=**`campaign/escape-pod-intro`** (off master; commit every
cycle) · **ENRICH-NOT-CUT** (scope-cut = a true-technical-wall safety net only, always surfaced).

**Budget:** max-cycles **150** (a high safety backstop, NOT a target) · `until: roadmap-empty`
(build the whole plan) · no soft token ceiling.

**Plan (pre-approved):** Phase 0 greybox spine → 1 pod → 2 descent → 3 ship → 4 crash/tutorial →
5 audio. The plan was authored + reviewed + approved IN-CONVERSATION, so there is **no plan-review
pause** — **cycle 1 (Phase 0, T0.0 the state-machine contract spike) is released.** The first pause
is the **Phase 0 milestone** (the greybox-spine walk-test).

**Preconditions:** GDD present (§12 scope-cut from the prior campaign) · `verify:all` baseline green
· destructive-action guard lock set · max-cycles set · clean tree · the M11→M13 campaign concluded
+ its log archived. All met.

**Status:** ▶ ACTIVE → launch with `/loop /campaign-cycle`. Cycle 1 = Phase 0 T0.0.

---

## Cycle 1 — Phase 0 T0.0: the intro sequence-framework scaffold (contract spike) (2026-06-28) — SHIPPED
- **Planned:** the foundational unit — design + stub the scripted-sequence/state-machine framework + lock the integration contract (don't build beats yet).
- **Recon (code-archaeologist):** mapped the boot/new-game/spawn flow (`handoffToGame`, `setupOpeningScene`, the title overlay), the per-frame tick + pause gate, the FP controller/camera/input (PointerLockControls), `FEATURES` + the `__game` dev-hook pattern, and world-gen timing. Two key answers: **R4** — the KCC (`bodies.ts`/`controller.ts computeColliderMovement`) is collision-general, NOT terrain-coupled → it walks on bespoke ship-floor box colliders unchanged; **R2** — the desert world generates synchronously at boot (before the title) → the intro's stepOut→desert handoff is a TELEPORT, not a stream.
- **Shipped (D269), INERT behind `FEATURES.escapePodIntro` (default off):** NEW `src/world/escapePodIntro/sequence.ts` — the beat state machine (`BeatId` [the 12 beats + done], `BEAT_ORDER`, `IntroState` [active·beat·beatStartedAt·`mode` walk/seated/scripted·scratch], `IntroControlMode`) + the manager (`startEscapePodIntro`/`advanceBeat`/`jumpToBeat`/`endEscapePodIntro`/`updateEscapePodIntro` dispatch skeleton/`introActive` gating helper) + the full contract doc-comment. Added `FEATURES.escapePodIntro`, `ctx.intro?: IntroState` (GameContext), and `updateEscapePodIntro` in the main tick before `updatePlayer` (no-op unless active).
- **Architecture contract (D269):** gate via `ctx.intro.active` (selective system suppression, NOT `flags.paused` — pause would freeze the intro's own tick); per-beat `mode` tells updatePlayer whether to allow locomotion + free-look or drive the camera; R4 (KCC on box floors ✓) + R2 (world boot-built ✓) confirmed; the intro is unsaved mid-sequence + an additive `introComplete` marker (legacy=true) prevents replay (no SAVE_VERSION bump; wired T0.1).
- **Verify:** `verify:all` PASS — tsc + placement 0/0 ×5 + colliders 0/40. **Visual iteration:** N/A (architecture scaffold, no visual output). The live game is byte-unchanged (the scaffold is inert; nothing starts the intro yet).
- **Spend:** ~280K (recon + the scaffold + D269 + verify:all + the doc suite); campaign total ~280K; cycle **1/150**.
- **Commit:** `PENDING`.
- **Next (cycle 2):** **Phase 0 T0.1** — wire the new-game branch + the `introComplete` save marker + the entry point + the `__game` start/skip/jumpToBeat dev hooks (still greybox). **Verdict: CONTINUE** — Phase 0 not complete (T0.1-T0.4 remain before the Phase 0 milestone). `consecutive_no_progress` stays 0 (SHIPPED).
