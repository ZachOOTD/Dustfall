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
- **Commit:** `c86ab21`.
- **Next (cycle 2):** **Phase 0 T0.1** — wire the new-game branch + the `introComplete` save marker + the entry point + the `__game` start/skip/jumpToBeat dev hooks (still greybox). **Verdict: CONTINUE** — Phase 0 not complete (T0.1-T0.4 remain before the Phase 0 milestone). `consecutive_no_progress` stays 0 (SHIPPED).

## Cycle 2 — Phase 0 T0.1: new-game flow + introComplete save marker + dev hooks (2026-06-28) — SHIPPED
- **Planned:** wire the (T0.0) framework into boot/new-game/save so a NEW game enters the intro without breaking the live game; add the save marker + the dev hooks. Still greybox/logic.
- **Recon (direct reads, no agent):** `save.ts` (full schema + save/load — additive-no-bump pattern per D81), `main.ts` new-game/title/handoff flow (the 3-button funnel through `handoffToGame`; `onNewGame` path-3 = the fresh-boot "new game begins" seam), `menus.ts` Save action, the `debugPanel.ts` `__game` object, GameContext flags.
- **Shipped (D270):** ① `startEscapePodIntro(ctx)` in `main.ts`'s `onNewGame` **path-3** only, gated `FEATURES.escapePodIntro && !ctx.flags.devMode` — Continue + Dev Mode reach the shared `handoffToGame` from their own branches and never start the intro (the key footgun: starting it in the shared handoff would replay on every Continue). ② Additive `introComplete?: boolean` on `SaveV1` (written `ctx.intro ? beat==='done' : true`; legacy absent→true; defensive load guard) — **no SAVE_VERSION bump** (stays v15); the real no-replay guarantee is structural (Continue never starts the intro). ③ Save blocked while `introActive` (`menus.ts` — toasts "no saving during the intro"). ④ Dev hooks `__game.startIntro()` (force-start, ignores the build flag), `skipIntro()`, `jumpToBeat(beat)` (`debugPanel.ts`); `startEscapePodIntro` gained a `force` param. Added the `FEATURES` import to `main.ts`.
- **Verify:** `verify:all` PASS (tsc + placement 0/0 ×5 + colliders 0/40) **+ a live-preview smoke test**: flag-off boot → `ctx.intro` null (no intro; live game byte-unchanged); `__game.startIntro()` → active@cockpit; `jumpToBeat('descent')` → descent; `skipIntro()` → done/inactive; all 3 hooks are functions; **0 console errors**. **Visual iteration:** N/A (logic/wiring cycle — greybox geometry is T0.2).
- **Spend:** ~210K (targeted reads + 12 edits across main/save/menus/debugPanel/sequence + verify:all + the live smoke + the doc suite); campaign total ~490K; cycle **2/150**.
- **Commit:** `PENDING`.
- **Next (cycle 3):** **Phase 0 T0.2** — the greybox SHIP (cockpit + corridor box-collider geometry the KCC walks, offset from the desert) + Beats 0-2 (cockpit → checkEngines → corridor) + locomotion gating via `ctx.intro.mode` + `introActive` system-suppression. Greybox = SPACE/FLOW correctness, NOT beauty (hero ship art is Phase 3). **Verdict: CONTINUE** — Phase 0 not complete. `consecutive_no_progress` stays 0 (SHIPPED).
