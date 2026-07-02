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
- **Commit:** `76a30c7`.
- **Next (cycle 3):** **Phase 0 T0.2** — the greybox SHIP (cockpit + corridor box-collider geometry the KCC walks, offset from the desert) + Beats 0-2 (cockpit → checkEngines → corridor) + locomotion gating via `ctx.intro.mode` + `introActive` system-suppression. Greybox = SPACE/FLOW correctness, NOT beauty (hero ship art is Phase 3). **Verdict: CONTINUE** — Phase 0 not complete. `consecutive_no_progress` stays 0 (SHIPPED).

## Cycle 3 — Phase 0 T0.2a: the greybox SHIP (walkable cockpit + corridor) + capsule placement + locomotion gating (2026-06-28) — SHIPPED
- **Planned:** T0.2 is large; **decomposed** into T0.2a (the greybox geometry + capsule placement + locomotion/mode gating + system-suppression foundation — a walkable space, iterated visually) and T0.2b (the beat flow). This cycle = **T0.2a**.
- **Recon (direct reads):** `controller.ts` updatePlayer (camera-yaw WASD → KCC; `syncCameraToBody`), `bodies.ts` `makeStaticBox`, the `debugPanel` `enterGame` hook (for the preview).
- **Shipped — the first VISUAL cycle (greybox blockout):** ① **NEW `src/world/escapePodIntro/shipScene.ts`** — a data-driven box layout (cockpit 6×3×5 with a framed front window + a 2×2.4×12 corridor to a dead-end), each box a mesh **+ a matched static box collider** (WYSIWYG), **unlit `MeshBasicMaterial`** (obviously-greybox, zero lighting/recompile dependency), at a **far offset `(0,3000,0)`** (R2 — desert is boot-built + sits ready), a planet disc beyond the window. `buildShipScene`/`disposeShipScene`/`getShipSpawn`. The KCC walks it unchanged (R4). ② `sequence.ts` `tickCockpit` builds the ship on the first cockpit frame + drops the capsule into the bridge facing the window (mode `walk`); `endEscapePodIntro` tears the ship down. ③ `controller.ts` locomotion **mode-gating** (`ctx.intro.mode` `walk`/`seated`/`scripted` gates WASD + jump; free-look untouched — D269). ④ `survival.ts` — no thirst/hunger/temperature drain (no death) during the intro.
- **Verify:** `verify:all` PASS (tsc + placement 0/0 ×5 + colliders 0/40 — the intro's lazy colliders aren't POI archetypes → POI gate unaffected). ⚠ a first run **masked a tsc error** because the command was piped through `tail` (tail's exit 0 hid tsc's failure) — re-ran capturing the real exit; fixed a `BoxSpec` arity typo (7→6). **Visual iteration:** appearance-verified at the **greybox/routine bar** — live-preview FP view from **3 player reads** (cockpit/window, corridor mouth, corridor interior): the space reads + is walkable, the capsule stands on the floor colliders (no fall-through), 0 console errors. feel-pending = the Phase 0 milestone walk-test.
- **Spend:** ~270K (recon + `shipScene.ts` + the sequence/controller/survival wiring + the live visual gate + the tsc fix + verify:all + docs); campaign total ~760K; cycle **3/150**.
- **Commit:** `eb38a1f`.
- **Next (cycle 4):** **Phase 0 T0.2b** — the Beat 0-2 FLOW (cockpit seated-open + "check engines" prompt → checkEngines walk-out → corridor-end disaster trigger → advance; `enterPod` stub → desert until T0.3) **+ HUD-during-intro suppression** (clock/hotbar still overlay — the T0.2a-noted gap) + diegetic prompts. **Verdict: CONTINUE** — Phase 0 not complete. `consecutive_no_progress` stays 0 (SHIPPED).

## Cycle 4 — Phase 0 T0.2b: the Beat 0-2 flow + HUD suppression (T0.2 ship section COMPLETE) (2026-06-28) — SHIPPED
- **Planned:** make the cockpit→corridor section PLAY as a sequence (the T0.2b half of T0.2) + suppress the game HUD during the intro (the T0.2a-noted gap).
- **Shipped:** ① **Beat controllers** (`sequence.ts`) — `cockpit` opens **seated** (look-only) at the window, dwells ~3s (dt-accumulated), → `checkEngines` (mode `walk` + diegetic prompt "check engines — head to the engine bay") → crossing into the corridor (capsule world-Z > `SHIP_CORRIDOR_ENTER_Z`) → `corridor` → reaching the dead-end (world-Z > `SHIP_DEAD_END_Z`) → `enterPod` (a **T0.3 stub** with a placeholder cue). The Z thresholds are exported from `shipScene.ts`. ② **NEW `src/world/escapePodIntro/introHud.ts`** — `setGameHudHidden` (suppresses the game HUD by id during the intro) + `showIntroPrompt`/`hideIntroPrompt` (a lazily-created centered diegetic prompt). HUD ids: `hud`/`hotbar`/`crosshair` + the **body-appended** `long-storm-indicator` + `dev-mode-badge`. ③ `tickCockpit` re-hides the HUD after `handoffToGame` un-hid it (no flash); `endEscapePodIntro` restores the HUD + hides the prompt + disposes the ship.
- **Verify:** `verify:all` PASS (tsc + placement 0/0 ×5 + colliders 0/40; real exit captured — not piped through `tail`). **Visual iteration:** full live-preview gate — the flow advances cockpit→checkEngines→corridor→enterPod via the dwell timer + the 2 corridor Z-thresholds (tested by teleporting the capsule across them); **HUD fully suppressed** — caught + fixed the `long-storm-indicator` leaking into the intro view; `skipIntro` restores the HUD + disposes the ship (scene-children **1551→1550** round-trip); 0 console errors. feel-pending = the Phase 0 walk-test.
- **Spend:** ~280K (HUD recon + `introHud.ts` + the beat controllers + the extensive live gate + verify:all + docs); campaign total ~1.04M; cycle **4/150**.
- **Commit:** `8905e68`.
- **Next (cycle 5):** **Phase 0 T0.3** — the greybox DESCENT + the pod (Beats 3-6: enterPod/eject → shipExplode → descent → the parachute GAG, 3 pulls → snap). **LARGE — decompose** like T0.2 (T0.3a pod+eject+ship-explode, T0.3b descent+parachute gag). Greybox blockout (hero pod = Phase 1, descentProgress FX = Phase 2). **Verdict: CONTINUE** — Phase 0 not complete. `consecutive_no_progress` stays 0 (SHIPPED).

## Cycle 5 — Phase 0 T0.3a: the greybox pod + eject + ship-explode (Beats 3-5) (2026-06-28) — SHIPPED
- **Planned:** T0.3 is large; decomposed (T0.3a pod+eject+ship-explode this cycle, T0.3b descent+parachute gag next). This cycle = **T0.3a**.
- **Shipped:** ① **NEW `src/world/escapePodIntro/podScene.ts`** — a tight greybox escape-pod interior (2.6×2.2×2.8 capsule + a framed viewport + a seat block), matched static colliders, unlit greybox, at its **own offset `(0,3200,0)`** above the ship (so you watch it blow up below); planet disc beyond the viewport. `buildPodScene`/`disposePodScene`/`getPodSpawn`. ② **Beat controllers** (`sequence.ts`): `enterPod` builds the pod + seats the player (mode `seated`) looking out + cues "pull the eject lever [click]" → `pulledLever` (E/left-click) or a fallback dwell → `shipExplode` (reuses `fx/screenFlash.flashScreen` for the warm blast + disposes the ship) → holds ~2.5s → `descent` (a T0.3b stub). Added `seatPlayerAt` + `pulledLever` helpers. ③ **HUD-suppression robustness fix** — moved `setGameHudHidden(true)` from `tickCockpit` to `startEscapePodIntro` (the single entry) + a re-assert in `handoffToGame`, so ANY entry path (new game, force-start, `jumpToBeat` past cockpit) gets a clean view. `endEscapePodIntro` disposes the pod too.
- **Verify:** `verify:all` PASS (tsc + placement 0/0 ×5 + colliders 0/40) — **re-ran on the final code** (the first run started before the HUD-decouple edits; both green). Fixed a `C_SEAT` color typo. **Visual iteration:** live-preview — the pod + viewport render; enterPod→shipExplode→descent advances; **HUD stays clean** — *caught a HUD leak* when jumping past the cockpit beat (the hide was cockpit-coupled) → decoupled it to `startEscapePodIntro`/`handoffToGame`; `skipIntro` disposes pod+ship (scene-children round-trip); 0 console errors. **Lesson:** scene/HUD setup tied to a single beat leaks when an entry path skips that beat — tie it to the lifecycle entry point.
- **Spend:** ~290K (podScene + the pod beats + the HUD-decouple fix + the live gate + 2 verify runs + docs); campaign total ~1.33M; cycle **5/150**.
- **Commit:** `1ee093b`.
- **Next (cycle 6):** **Phase 0 T0.3b** — the real DESCENT (descentProgress 0→1, growing planet + camera shake; hero FX stack = Phase 2) + the parachute GAG (3 **debounced** pulls → snap → impact) + an impact stub (T0.4 does the crash/wake/desert-handoff). **Verdict: CONTINUE** — Phase 0 not complete. `consecutive_no_progress` stays 0 (SHIPPED).

## Cycle 6 — Phase 0 T0.3b: the descent + the parachute gag (Beats 5-7) — T0.3 COMPLETE (2026-06-28) — SHIPPED
- **Planned:** the second half of T0.3 — the fall + the chute-fails gag (the emotional core).
- **Shipped:** ① `podScene.setDescentProgress` (+ a `planetMesh` ref) grows/sinks the viewport planet. ② **`descent` beat** — `descentProgress` 0→1 over ~8s drives the planet swell (1×→4.5×) + a continuous `fx/cameraShake.addTrauma` rumble → `parachute`. ③ **`parachute` beat — THE GAG** — cue "pull the parachute"; each pull (`pulledLever` = E/left-click, **edge-triggered** so each press counts once) jolts (`addTrauma`) + escalates the cue ("Pull harder!" → "COME ON — PULL!"); the **3rd pull snaps the lever off** (flash + "The lever snaps off") → a beat of free-fall → `impact`; an auto-pull fallback prevents softlock. ④ **`impact` beat** — a T0.4 stub (hard flash + max trauma + cue). ⑤ **`ensureInPod` helper** — pod beats build+seat the pod idempotently so each is independently jumpable (dev-jump robustness; reinforces the C5 HUD-decouple lesson).
- **Verify:** `verify:all` PASS (tsc + placement 0/0 ×5 + colliders 0/40; re-ran on the final code). **Visual iteration:** live-preview — the descent grew the pod planet to **4.5×**; the gag escalated + **snapped at 3 pulls → impact**; camera shake visibly tilts the view through descent/parachute/impact; HUD clean; `skipIntro` disposes the pod; 0 console errors. The 3-distinct-manual-pull comedic *timing* is feel-critical → the user judges it at the Phase 0 walk-test. **The greybox intro now plays cockpit → corridor → pod → eject → ship-explode → descent → chute-gag → impact-stub.**
- **Spend:** ~290K (setDescentProgress + the 3 beats + cameraShake recon + ensureInPod + the live gate + 2 verify runs + docs); campaign total ~1.62M; cycle **6/150**.
- **Commit:** `70b512a`.
- **Next (cycle 7):** **Phase 0 T0.4** (the LAST Phase 0 unit) — impact/blackout/wake → **the desert handoff** (teleport to the real new-game spawn + `endEscapePodIntro` restores play + mark `introComplete` + dispose geometry) + a fade-to-black; tutorial scaffold may be T0.4b (per the Phase 0 `### Milestone` marker). **COMPLETES Phase 0 → milestone PAUSE** (the user's first full greybox walk-test). **Verdict: CONTINUE** — Phase 0 not complete. `consecutive_no_progress` stays 0 (SHIPPED).

## Cycle 7 — Phase 0 T0.4a: impact → wake → THE DESERT HANDOFF (Beats 7-9) (2026-06-28) — SHIPPED
- **Planned:** T0.4 is large (DoD = handoff + pod-as-spawn-wreck + tutorial scaffold + smoke); **decomposed** — T0.4a (the handoff: the spine completes end-to-end into the desert) this cycle, T0.4b (pod-wreck + tutorial scaffold + smoke) next → then the Phase 0 milestone.
- **Shipped:** ① **`impact` beat** — the crash: hard flash + max trauma → **fade to black** (`introHud.setIntroBlack` 0→1) + hold → `wake`. ② **`wake` beat** — come to: fade FROM black + hold → `stepOut`. ③ **`stepOut` beat — THE DESERT HANDOFF (R3):** teleport the capsule to `intro.returnPos` (the real new-game spawn, snapshotted in `startEscapePodIntro` from the player body BEFORE the intro moves them — `setupOpeningScene` placed them there at boot) + `cameraSnapNextFrame` + `endEscapePodIntro` (restores HUD/locomotion/survival, disposes ship+pod, clears the black). ④ **NEW `introHud.setIntroBlack`** full-screen black overlay (cleared by `endEscapePodIntro` so it never lingers over the real game). Added `returnPos` to `IntroState`; `introComplete` derives true post-handoff.
- **Verify:** `verify:all` PASS (tsc + placement 0/0 ×5 + colliders 0/40; single run covers the final code — all edits preceded it). **Visual iteration:** live-preview — `startIntro` captured `returnPos` = the desert spawn (`-46.2,10.7,11.3`); `stepOut` teleported the player BACK there (y=10.7, **not** stuck at the pod's y=3200), intro inactive, HUD restored, black cleared, standing in the dawn dunes playing; 0 console errors. **THE GREYBOX SPINE PLAYS END-TO-END** (new game → cockpit → … → wake → desert). feel-pending = the Phase 0 walk-test.
- **Spend:** ~260K (Phase-0-DoD + spawn recon + setIntroBlack + the 3 handoff beats + the live gate + verify:all + docs); campaign total ~1.88M; cycle **7/150**.
- **Commit:** `bee75d2`.
- **Next (cycle 8):** **Phase 0 T0.4b** (LAST Phase 0 unit) — the pod-as-spawn-wreck seam (a greybox crashed pod at the desert spawn, persists into the real game) + the craft+salvage tutorial SCAFFOLD + the `feature-escape-pod-intro` smoke check → **COMPLETES Phase 0 → ⏸ milestone PAUSE** (the user's first full greybox walk-test → `/campaign-approve`). **Verdict: CONTINUE** — Phase 0 not complete (T0.4b remains). `consecutive_no_progress` stays 0 (SHIPPED).

## Cycle 8 — Phase 0 T0.4b: pod-as-spawn-wreck + tutorial scaffold + smoke → ⏸ PHASE 0 COMPLETE (2026-06-28) — SHIPPED → MILESTONE PAUSE
- **Planned:** the final Phase 0 unit — the pod-as-spawn-wreck seam + the tutorial scaffold + the smoke check (per the Phase 0 DoD).
- **Shipped:** ① **`podScene.placeCrashedPodWreck`** — a greybox crashed pod (tilted, half-buried box + a dark "blown hatch" salvage face + a rough AABB collider) at the desert spawn; a **persistent world object** (NOT disposed by `endEscapePodIntro`); idempotent + `removeCrashedPodWreck`. ② **`stepOut`** now places the wreck ~4m from `returnPos` + `camera.lookAt(wreck)` (wake beside your own pod) + a tutorial-scaffold hint toast ("Salvage your pod — craft a machete to pry it open"; the real craft→pry→chute-pop is Phase 4). ③ **`smokeTestIntro` + `__game.smokeIntro()`** — force every beat + tick it, confirming the sequence is wired.
- **Verify:** `verify:all` PASS (tsc + placement 0/0 ×5 + colliders 0/40). **Visual iteration:** live-preview — `__game.smokeIntro()` → **`{ok:true, beats:10}`**; the handoff places the crashed pod + the player wakes looking at it (greybox box in the dunes), HUD restored; 0 console errors. **THE GREYBOX SPINE IS COMPLETE end-to-end.**
- **Spend:** ~250K; campaign total ~2.13M; cycle **8/150**.
- **Commit:** `bfddd70`.

---

## ⏸ PHASE 0 MILESTONE — GREYBOX SPINE COMPLETE — AWAITING USER WALK-TEST (2026-06-28)
**The escape-pod intro's greybox spine plays END-TO-END** (C1-C8): new game → cockpit (seated, planet out the window) → "check engines" → corridor → pod → eject → ship explodes → descent (planet swells + rumble) → **the parachute gag** (3 pulls → snap) → impact → fade-to-black → wake → step into the dawn desert beside your crashed pod + a "craft a machete" hint. All behind `FEATURES.escapePodIntro` (default off → live game byte-unchanged); `verify:all` + a live/visual gate every cycle; no SAVE_VERSION bump.

**▶ USER ACTION:** walk-test the flow + pacing (it's GREYBOX — judge FLOW, not beauty). Play via `__game.startIntro()` (console; `jumpToBeat`/`skipIntro`/`smokeIntro` to navigate) or set `FEATURES.escapePodIntro = true` + new game. Feedback → `docs/campaign/steering.md` or inline. Then **`/campaign-approve`** to release **Phase 1 — the HERO pod** (procedural-modeler; industrial modular box; replaces the greybox wreck). **Verdict: STOP — `milestone-review`** (`status: paused`, `awaiting_approval: true`). The loop will NOT continue until approved.

### ✅ Phase 0 milestone APPROVED (2026-06-28) — `/campaign-approve`
The user approved the Phase 0 greybox spine as-is (no change requests in `steering.md`, no `--with-changes`). Gate cleared: `status: active`, `awaiting_approval: false`, `stop_reasons: []`. **Releasing Phase 1 — the HERO pod** (T1.1 exterior via the procedural-modeler [industrial modular box, real FP-view, half-buried gate] · T1.2 interior · T1.3 seated-FP camera). The loop resumes with `/loop /campaign-cycle`.

## Cycle 9 — Phase 1 T1.1: the HERO pod exterior (industrial modular box) (2026-06-28) — SHIPPED
- **Planned:** the first hero-art cycle — replace the greybox crashed-pod box with a hero exterior to a quality bar. Delegated to the **procedural-modeler** agent.
- **Shipped (procedural-modeler, 8 build→shoot→critique rounds):** `podScene.placeCrashedPodWreck` rebuilt from greybox into the **industrial modular box** identity (locked §B, NOT ODST): grey-beige core + dark-steel **exoskeleton** + **removable bolted panels** w/ steel seam-rims + a **blown-open hatch** (recessed torn cavity + bent struts + a door ajar in a channel-steel frame — the salvage face) + a **small off-center recessed viewport** + external conduit/cable/antenna/askew lift-eye/thruster nub + a scorched base. Built in the wrecks.ts weathered idiom (`createRustedHullMaterial`, ≥10cm panel depth per rule 7); half-buried ~42% + crash-tilted; compound collider. Plus `__game.placeCrashedPod` + a `crashed-pod` rig in `rig-shot.mjs`.
- **Verify:** `verify:all` PASS end-to-end (tsc + placement 0/0 ×5 + colliders 0/40; re-ran with a 600s budget — the agent's shorter Bash timeout falsely "timed out"). **Visual iteration:** HERO bar — confirmed via the `crashed-pod` rig (reproduces the REAL stepOut placement, not an isolated rig) at wake/hatch/oblique: a weathered, asymmetric, half-buried, strippable pod; the salvage face reads. **Limitation logged:** live `preview_screenshot` hangs on the full ~723K-tri desert scene → used the rig (mirrors the real placement); the user sees it live at the Phase 1 walk-test.
- **Spend:** ~380K (procedural-modeler ~209K + brief/verify/rig-gate/docs ~170K); campaign total ~2.51M; cycle **9/150**.
- **Commit:** `1c0de3d`.
- **Next (cycle 10):** **Phase 1 T1.2** — the hero pod INTERIOR (procedural-modeler): the worn industrial cabin matching the exterior — the chunky parachute lever (the gag), the door-blow/eject control, a seat+console, the viewport — replacing the greybox `buildPodScene` (keep its contracts so the eject/descent/gag beats keep playing). **Verdict: CONTINUE** — Phase 1 not complete. `consecutive_no_progress` stays 0 (SHIPPED).

## Cycle 10 — Phase 1 T1.2: the HERO pod INTERIOR (the cabin you ride) (2026-06-28) — SHIPPED
- **Planned:** replace the greybox `buildPodScene` interior with a hero cabin matching the T1.1 exterior. Delegated to the **procedural-modeler** agent.
- **Shipped (procedural-modeler, 4 build→shoot→critique rounds):** a worn industrial lifeboat **cabin** (`createRustedHullMaterial` idiom) — grey-beige panels + exposed dark-steel ribs + conduit + bolted seams; a channel-steel **viewport** dead-ahead (the `setDescentProgress` planet shows through + grows; vent grille + parcel shelf below); a chunky **red parachute lever** (rubber grip + hazard band + steel shaft on a pivot bracket) in seated reach; a guarded **hazard-yellow eject T-handle**; a humble **console** (dim amber screen, telltales, toggles, gauges) + seat. Added `setParachuteLeverPull(t,snapped)` (wired into `tickParachute` — each pull jabs the lever + springs back; the 3rd droops it dead). `getPodSpawn` z +0.45→+0.35. Dev hooks + a `pod-interior` rig. Contracts intact.
- **Verify:** `verify:all` PASS end-to-end (tsc + placement 0/0 ×5 + colliders 0/40; 600s, real exit). `smoke {ok:true, beats:10}`. **Visual iteration:** HERO bar — seated-FP preview screenshot at enterPod (the offset pod interior is a LIGHT scene → preview works, unlike the heavy desert): the cabin + viewport (planet) + red lever + yellow eject + console all read, matching the exterior. 0 console errors. The lever jab/snap MOTION + the seated-eye height are T1.3/walk-test items.
- **Spend:** ~320K (procedural-modeler ~170K + brief/verify/preview-gate/docs ~150K); campaign total ~2.83M; cycle **10/150**.
- **Commit:** `bcad8ea`.
- **Next (cycle 11):** **Phase 1 T1.3** (LAST Phase 1 unit) — the seated-FP camera + viewport framing (lower the seated eye into the chair; frame the viewport/planet at eye level; controls in seated reach). **COMPLETES Phase 1 → ⏸ milestone PAUSE** (the user's "pod in + out" walk-test → `/campaign-approve` releases Phase 2). **Verdict: CONTINUE** — Phase 1 not complete (T1.3 remains). `consecutive_no_progress` stays 0 (SHIPPED).

### 🔄 STEERING (2026-06-28, post-C10) — pod too boxy → REDESIGN CYLINDRICAL (D271)
The user walk-tested the hero pod (C9 box exterior + C10 box interior) and steered: *"make the escape pod exterior more cylindrical. I don't like the boxy model. Maybe look at some more references online... will likely need to update the interior to match."* **Action:** ran a research pass (`docs/research/escape-pod-cylindrical.md`, 5 cylindrical candidates) → user AskUserQuestion → **NEW IDENTITY (D271): a VERTICAL RIVETED ALUMINUM CAPSULE/TORPEDO** (a short fat upright cylinder + hemispherical nose + scorched heat-shield base, riveted weathered aluminium, small recessed viewport, strippable hatch, half-buried). The box `escape-pod-design-variety.md §B` is now historical; `escape-pod-cylindrical.md` is live. Confirmed the direction up-front (rather than blind-rebuilding) since it reverses the user's own earlier explicit pick + a hero rebuild is ~500K. Steering archived. **The plan: C11 = T1.1 REDO (cylindrical exterior), C12 = T1.2 REDO (cylindrical interior), C13 = T1.3 (seated camera) → Phase 1 milestone.** **Verdict: CONTINUE** (direction confirmed → the loop rebuilds; the C9/C10 box commits remain the audit trail). `consecutive_no_progress` stays 0.

## Cycle 11 — Phase 1: the CYLINDRICAL pod EXTERIOR REDO (box→capsule) (2026-06-29) — SHIPPED
- **Planned:** rebuild the pod exterior to the user's cylindrical direction (D271). Delegated to the **procedural-modeler**; gated with the **adversarial visual gate** (ultracode).
- **Shipped:** `podScene.placeCrashedPodWreck` rebuilt box→a **vertical riveted-aluminium capsule** — a lathe body (scorched heat-shield base → tall straight riveted cylinder [dominant] → small tucked **ogive nose**), 4 rivet latitude bands + battens + studs, asymmetric dents, a **blown hatch** (door flung off a torn rim + cavity + sprung rivets), a small off-center **recessed porthole** (bezel + glass), a shoulder antenna, **reentry scorch** fading up ~50% of the body (asymmetric soot licks), pried seam-rimmed panels; `createRustedHullMaterial` aluminium tuning; **lean-aware burial** (no float) + a downhill sand berm + a re-seated cylinder collider.
- **The adversarial gate earned its keep (the cycle's headline):** a 5-critic gate caught **what the builder's self-critique + my single review both MISSED** — gate-1 (4.6/10): the pod read as a **Boba-Fett/Mandalorian HELMET** (a near-hemisphere dome on a squat body) → revise re-proportioned it (cylinder dominates, tucked ogive, antenna off-apex, porthole off-dome) → gate-2 (5.4/10): capsule identity confirmed by all 5 critics, but the pod was **FLOATING** (the burial did a vertical drop *before* the ~22° lean, lifting the base out of the sand) → final revise fixed the lean-aware burial + the scorch + the blown hatch + the recessed porthole. My own-eyes confirm (wake/hatch/iso): an unmistakable half-buried vertical riveted capsule, float gone.
- **Verify:** `verify:all` PASS end-to-end (tsc + placement 0/0 ×5 + colliders 0/40) + smoke `{ok:true,beats:10}`. **Visual iteration:** build + 2 revise rounds + 2 adversarial 5-critic gates. **Residual sev-2/3** (hatch composition, berm micro-conform, felt scale) → the user's Phase 1 walk-test (the human is the final arbiter on this feel-critical hero asset).
- **Spend:** ~1.2M (the heaviest cycle — modeler build + 2 revises + 2 adversarial gates); campaign total ~4.03M; cycle **11/150**.
- **Commit:** `3f09626`.
- **Next (cycle 12):** **C12 — the cylindrical pod INTERIOR REDO** (rebuild `buildPodScene` as the round riveted-aluminium cabin matching the C11 exterior; re-home viewport/parachute-lever/eject/console; keep contracts) + **run the adversarial gate** (the C11 lesson). Then T1.3 seated camera → Phase 1 milestone. **Verdict: CONTINUE** — Phase 1 not complete. `consecutive_no_progress` stays 0 (SHIPPED).

## Cycle 12 — Phase 1: the CYLINDRICAL pod INTERIOR REDO (the round capsule cabin) (2026-06-29) — SHIPPED
- **Planned:** rebuild the box interior to match the C11 cylindrical exterior. Delegated to the **procedural-modeler**; gated with the **adversarial visual gate** (×2, per the C11 lesson).
- **Shipped:** `podScene.buildPodScene` rebuilt box→the inside of the capsule — a back-faced cylinder bore + ogive dome; **bent ring-frame hoops curving at EYE LEVEL**; a continuous-barrel round **porthole** (bezel ring, no face); a curved riveted **floor + footwell + bucket seat + harness**; the red **parachute lever** (`setParachuteLeverPull`, snap reads dead); a legible guarded **yellow eject** (toggle + EJECT placard); a **console** (amber/LEDs/toggles/gauges); the forward **viewport** (the `setDescentProgress` planet swells through). Cool aluminium materials + cramped warm-key/cool-ambient lighting; flush rivets. A `pod-interior` rig added.
- **2 adversarial gates (the value):** gate-1 (4.8) caught a **forward-FACE pareidolia** (viewport framed by 2 visor uprights) + an **unfinished VOID floor** → revise fixed both (round bezel + continuous bands; real deck + bucket seat). Gate-2 (4.4) confirmed those fixed but caught the revise had **flattened the eye-level curvature** (over-added panels/beams → boxy) + a **brown-not-aluminium** read → a finish round restored the eye-level CURVE (bent chest ring, thinned beams, raked light) + cool ALUMINIUM + flush rivets + a shared-material-bug fix. My own-eyes confirm: curved at eye level + aluminium + no face + finished floor.
- **Verify:** `verify:all` PASS end-to-end + smoke `{ok:true,beats:10}`. **Visual iteration:** build + 2 revise rounds + 2 gates. **Accepted at the structure bar** (the round-capsule identity is met); **deferred:** the hero planet/atmosphere VISTA = Phase 2 (greybox stand-in), the eject/parachute **beat-framing** = T1.3, slight console-warmth → walk-test. Did NOT run a 3rd gate (diminishing returns; structure sound; the user finalizes finish).
- **Spend:** ~1.27M (build + 2 gates + revise + finish); campaign total ~5.30M; cycle **12/150**.
- **Commit:** `f06592d`.
- **Next (cycle 13):** **T1.3** (LAST Phase 1 unit) — the seated-FP camera + viewport framing (lower the seated eye into the bucket seat; restore at handoff) + RESOLVE the eject/parachute beat-framing (enterPod cues the yellow eject; parachute the red lever). **COMPLETES Phase 1 → ⏸ milestone PAUSE** (the user's "pod in + out" walk-test → `/campaign-approve` releases Phase 2). **Verdict: CONTINUE** — Phase 1 not complete (T1.3 remains). `consecutive_no_progress` stays 0 (SHIPPED).

## Cycle 13 — Phase 1 T1.3: the seated-FP camera + beat-framing → ⏸ PHASE 1 COMPLETE (2026-06-29) — SHIPPED → MILESTONE PAUSE
- **Planned:** the final Phase 1 unit — sit the player into the chair + frame each beat at its control. Camera/feel + light sequence work (main loop).
- **Shipped:** ① **Seated eye** — `Tuning.POD_SEATED_EYE_OFFSET (0.50)` lowers the eye from standing (0.85) to the viewport line (`VP_CY 1.34`) while seated so the window reads at eye level. Set in `updateEscapePodIntro` (so it also applies in the !isPlaying preview/rig where `updatePlayer` early-returns) + maintained in `controller.ts` in-game; reverts at the handoff. ② **Beat-framing** — `faceControl(yaw,pitch)` (rotation.set, **YXZ** order — the default XYZ floor-stared after a 90° yaw) orients enterPod → the yellow eject, parachute → the red lever, resolving the C12-gate confusion.
- **Verify:** `verify:all` PASS end-to-end + smoke `{ok:true,beats:10}`. **Visual iteration:** live-preview (light gate) — seated eye at the viewport line; enterPod faces the eject (the YXZ fix corrected an initial floor-stare); parachute faces the lever; 0 console errors.
- **Spend:** ~360K; campaign total ~5.66M; cycle **13/150**.
- **Commit:** `f86438c`.

---

## ⏸ PHASE 1 MILESTONE — THE HERO POD COMPLETE — AWAITING USER WALK-TEST (2026-06-29)
**The escape pod is now hero art** — the **cylindrical riveted-aluminium capsule** (D271, redesigned from the rejected box): a half-buried weathered exterior you wake beside (scorched base, blown salvage hatch, recessed porthole, sand berm) + a round riveted cabin you ride (curved walls, the viewport with the planet swelling through, the chunky red parachute lever [3 pulls → snap], the guarded yellow eject, console, bucket seat) + the seated-FP camera (eye at the viewport line; each beat frames its control). Built across C9-C13 via the **procedural-modeler** + **adversarial 5-critic visual gates** that caught + fixed a helmet-read, a float, a forward-face, a void floor, boxy-walls + brown-material. All behind `FEATURES.escapePodIntro` (off → live game byte-unchanged); `verify:all` green every cycle; no SAVE_VERSION bump.

**▶ USER ACTION:** walk-test the pod **IN + OUT** — wake beside the half-buried capsule (exterior) + ride the cabin through eject/descent/parachute (interior). Play via `FEATURES.escapePodIntro = true` + new game, or `__game.startIntro()`/`jumpToBeat`/`smokeIntro`. Known deferred (NOT bugs): the planet/atmosphere VISTA through the viewport is a greybox disc — the real hero descent vista is **Phase 2** (which frames through this viewport); descent/explosion FX + audio are Phases 2/5. Feedback → `docs/campaign/steering.md` or inline. Then **`/campaign-approve`** releases **Phase 2 (the descent showpiece)**. **Verdict: STOP — `milestone-review`** (`status: paused`, `awaiting_approval: true`). The loop will NOT continue until approved.

## ✅ APPROVED — Phase 1 milestone released (2026-06-29) — `/campaign-approve`
The user approved the Phase 1 milestone (the cylindrical hero pod) and released **Phase 2 (the descent showpiece)**. No `--with-changes`; steering inbox empty. Gate cleared: `status: active`, `awaiting_approval: false`, `stop_reasons: []`, `consecutive_no_progress: 0`. **Next: C14 = Phase 2 T2.1 sub-task 1** (the `descentProgress` effect stack — beginning the hero planet/atmosphere vista that frames through the pod viewport). The loop resumes via `/loop /campaign-cycle`.

## Cycle 14 — Phase 2 T2.1: the HERO descent VISTA (2026-06-29) — SHIPPED
- **Planned:** the hero centerpiece of Phase 2 (the explicitly-deferred-from-Phase-1 item) — replace the greybox planet-disc with the real `descentProgress`-driven planet/atmosphere/horizon vista the player watches fall through the pod viewport.
- **Shipped:** in `podScene.ts`, a real orbit→atmosphere→desert fall. **Orbital:** a curved Dune-desert planet (fbm relief + soft object-space-light terminator), a soft **Fresnel atmosphere limb** (`toneMapped:false`) + halo, a 3-layer **starfield** + milky band. **Cross-fade (~0.4):** the orbital sphere retracts/fades and a **ground/horizon/sky** scene fades in — asymmetric **barchan dunes** (raking off-axis dawn sun, cool→ochre→pale sand palette, aerial haze) with **closing scale** (d09 nearer than d05, the surface rushing up). Single `setDescentProgress(0..1)` contract preserved; 4 ShaderMaterials disposed.
- **Verify:** `verify:all` PASS end-to-end + smoke `{ok:true,beats:10}`.
- **Visual iteration:** the **adversarial hero gate ran 4 rounds** across 5 procedural-modeler passes — and earned its keep: it caught what the builder's self-critique AND my own eyes missed every round → a flat-coin planet, a flat-orange/**lava** read, a **z-occluder bug** (the planet was z-occluded so the game sky-dome showed through as a flat fill), 2 cross-fade artifacts (star-bleed onto the ground, an asteroid/neon-limb), and a **porthole-band mapping bug** (the horizon/sun were mis-framed so the window showed sky+blown-sun while the desert rendered as far-haze). Each diagnosed + fixed, re-gated. **FINAL: PASSED** — both previously-failing critics flipped to hitsBar=true @ **beauty 8**; only sev-3 nits remain. (Trajectory across gates: 3/3/4/5 → 4/5/5 → 5/7/6 → 7/6/7 → confirm 8/8.)
- **Spend:** ~2.4M (5 modeler rounds + 4 gates — high, but it's THE showpiece + each gate found real defects); campaign total ~8.06M; cycle **14/150**.
- **Commit:** `c6f5e5c`.
- **Next (C15):** the **T2.1 remainder** — scene fog color-ramp + the cabin interior-lit-by-exterior lighting shift (integration polish, light gate) — then T2.2 re-entry FX, T2.3 tumbling reveal, → the Phase 2 milestone walk-test (the felt MOTION of the descent is a walk-test item). **Verdict: CONTINUE** (T2.1 vista shipped; Phase 2 not complete; not a milestone). `consecutive_no_progress` = 0 (SHIPPED).

## Cycle 15 — Phase 2 T2.1 remainder: the cabin interior-lit-by-exterior → T2.1 COMPLETE (2026-06-29) — SHIPPED
- **Planned:** finish T2.1 — make the cabin/scene react to the descent (the bits not in the through-window vista).
- **Shipped:** `setDescentProgress` now drives the cabin lights so the capsule is **washed by the shifting exterior light** — the porthole-spill `PointLight` (`vpGlowLight`, the literal light through the window) goes **cool+dim in space → warm+bright as the dawn desert swells in the viewport** (`0xa6c0d6→0xffb070`, intensity `0.95→2.0`), and the hemisphere ambient (`cabinFill`) picks up a hint of dawn — on a `dawn=clamp((p−0.25)/0.6)` driver (COOL through true orbit, warming through the atmosphere/desert leg). Idempotent off the single `setDescentProgress`; 2 light refs nulled in dispose. **Decision:** the T2.1 "scene fog-ramp" line item is **NOT-APPLICABLE** (the enclosed cabin is lit by its own lights → scene fog would just haze the interior; the cabin-light reaction is the meaningful realization) + detail pop-in already shipped in the C14 vista → **T2.1 COMPLETE**.
- **Verify:** `verify:all` PASS (tsc + placement + colliders) + smoke `{ok:true,beats:10}`.
- **Visual iteration:** own-loop before/after preview (proportionate light gate for a 2-light color ramp — not a hero asset): cool grey cabin at p=0 → warm dawn glow on the forward arc/bezel/dome at p=0.9, unmistakable + not overdone. 0 console errors. (Lean cycle — no adversarial gate; that's reserved for hero assets, per the C14 cost lesson.)
- **Spend:** ~150K; campaign total ~8.21M; cycle **15/150**.
- **Commit:** `f17273a`.
- **Next (C16):** **T2.2 — re-entry FX** (plasma past the glass + the white flash + viewport heat-shimmer + speed-coupled camera shake; hero-ish FX → procedural-modeler + ONE gate). Then T2.3 tumbling reveal → the Phase 2 milestone walk-test. **Verdict: CONTINUE** (T2.1 complete, but Phase 2 [T2.1+T2.2+T2.3] not done; T2.1 completion is not the milestone). `consecutive_no_progress` = 0 (SHIPPED).

## Cycle 16 — Phase 2 T2.2: re-entry FX (2026-06-29) — SHIPPED
- **Planned:** the violence of punching into the atmosphere (plasma + flash + heat-shimmer + shake), easing into the calm descent.
- **Shipped:** split into a **visual half** (procedural-modeler, `podScene.ts`: `PLASMA_FS` ionized-air streak-threads with a white-hot core + slipstream rake, clipped to the porthole; `SHIMMER_FS` heat-wobble) + a **felt half** (`sequence.ts` `tickDescent`: a `flashScreen` one-shot at the peak + `addTrauma(0.04+re×0.45)` buffet), both on ONE shared curve `re=max(0,1−((p−0.24)/0.16)²)` (peak p≈0.24, **gone by ~0.40** — re-entry is HIGH+EARLY, finishing before the desert cross-fade so the warm layers don't stack). `setDescentProgress(0..1)` contract preserved; materials disposed.
- **Verify:** `verify:all` PASS (tsc + placement + colliders) + smoke `{ok:true,beats:10}`.
- **Visual iteration:** a **2-round confirm gate** (light — FX over the already-gated vista). Round-1 FAILED: the gate caught an **inverted arc** (the plasma faded too slowly → it stacked on the warm desert cross-fade, so the *fade* frame read brighter than the *peak* + occluded the vista), campfire-orange (no white-hot core), a hard horizontal **decal-seam band**. Round-2 (tighter curve + a blown white-hot core + a turbulence-warped slipstream band) fixed all three → **RE-CONFIRM PASS** (both critics hitsBar=true, **beauty 8**, all booleans true; bookends clean, no cabin spill, vista glimpsed). Noted sev-3 polish (whiter/larger core, vista dim at peak) → walk-test.
- **Spend:** ~600K (2 modeler rounds + 2 light gate runs); campaign total ~8.81M; cycle **16/150**.
- **Commit:** `0309d81`.
- **Next (C17):** **T2.3 — the tumbling reveal + interior-lit-by-exterior** (the window drifts ship→space→planet→desert as the pod tumbles; the explosion staged through the frame; the cabin washed by the shifting light — the LAST Phase 2 unit). **COMPLETES Phase 2 → the Phase 2 milestone walk-test.** **Verdict: CONTINUE** (T2.2 shipped; Phase 2 not complete; not a milestone). `consecutive_no_progress` = 0 (SHIPPED).

## Cycle 17 — Phase 2 T2.3: the tumbling reveal → PHASE 2 COMPLETE (2026-06-29) — SHIPPED → MILESTONE PAUSE
- **Planned:** the tumbling reveal — eject → the pod tumbles into the descent; the cabin washed by the shifting exterior light. The LAST Phase 2 unit.
- **Shipped:** reworked the `shipExplode` beat into the cinematic, ALL main-loop (camera/light staging, no new geometry). On eject the ship dies in a blast + the pod is flung **tumbling**, settling into the descent: `mode='scripted'` + ease an intro `tumble` intensity (1→0); the controller's new **`applyIntroTumble`** rides it as a decaying tumbled camera pose (roll + pitch-up + yaw + jostle) post-multiplied onto the look (the storm-sway pattern, undo-last-frame); `faceControl(0,0)` base → settles seamlessly into the descent. New `podScene.setTumbleLight` floods the cabin hot blast-orange decaying to the orbital cool. `SHIP_EXPLODE_DWELL` 2.5→4.0s.
- **Verify:** `verify:all` PASS (tsc + placement + colliders) + smoke `{ok:true,beats:10}`.
- **Visual iteration:** own-loop live preview (proportionate for camera/light STAGING — a still can't gate a spin → no adversarial gate; the tumble MOTION is a walk-test item): the cabin rolls + blast-floods warm at the tumble peak, settling level + cool into the descent; the chain runs through to `wake` (the settle→descent handoff is seamless). 0 console errors.
- **Spend:** ~320K (own-loop, no gate); campaign total ~9.13M; cycle **17/150**.
- **Commit:** `36d9e49`.
- **Deferred to Phase 3:** the hero ship explosion staged through the C17 tumble frame (the staging + `setTumbleLight` blast-flood hook are built).
- **Steering received (during C17):** the user wants a pushed campaign branch + a playable preview link to walk-test each cycle. Archived to `steering-archive.md`; surfaced + planned at this milestone pause (it directly serves the walk-test). Pushing/deploy is outward-facing → confirmed with the user before executing (see the milestone-pause handoff).

---

## ⏸ PHASE 2 MILESTONE — THE DESCENT SHOWPIECE COMPLETE — AWAITING USER WALK-TEST (2026-06-29)
**The beautiful atmospheric descent is whole** (C14-C17): **T2.1** the descentProgress orbit→atmosphere→desert VISTA through the pod viewport (curved Dune-desert planet + Fresnel atmosphere limb + starfield → cross-fade → barchan dune surface with raking dawn light + closing scale; built via the procedural-modeler + 4 adversarial gates that caught a z-occluder bug + a porthole-band mapping bug + flat-coin/lava/cloud reads, passed @ beauty 8) **+ the cabin interior-lit-by-exterior** · **T2.2** re-entry FX (plasma w/ white-hot core + slipstream + heat-shimmer + white flash + speed-coupled shake; gate-passed @ beauty 8) · **T2.3** the tumbling reveal (eject → blast → the pod tumbles + blast-floods, settling into the descent). All behind `FEATURES.escapePodIntro` (off → live game byte-unchanged); `verify:all` green every cycle; no SAVE_VERSION bump.

**▶ USER ACTION:** walk-test the **beautiful descent** — eject → the tumble → re-entry → the calm fall → the parachute gag. Play via `FEATURES.escapePodIntro = true` + new game, or `__game.startIntro()`/`jumpToBeat('shipExplode'|'descent')`/`smokeIntro`. The key feedback is the **FEEL/MOTION** (the tumble spin, the re-entry violence, the descent pacing) — what stills couldn't judge. Known deferred (NOT bugs): the hero ship explosion through the tumble = Phase 3 (the ship is greybox); audio is Phase 5; sev-3 polish (whiter re-entry core, vista-dim-at-peak, subtle d05↔d09 scale). Feedback → `docs/campaign/steering.md` or inline. Then **`/campaign-approve`** releases **Phase 3 (the hauler + disaster)**. **Verdict: STOP — `milestone-review`** (`status: paused`, `awaiting_approval: true`). The loop will NOT continue until approved.

### Walk-test review fixes (2026-06-29, via the deployed preview link) — STILL PAUSED for re-test
The user walk-tested via the Netlify preview + gave 5 notes (full detail in `steering-archive.md`). **Fixed immediately (descent-feel) + pushed** so the link refreshes: (1) **screen shake** — removed the constant descent rumble + made it re-entry-only + gentle (`addTrauma(re*0.18)`), softened the eject kick (0.95→0.55) + tumble buffet (`settle*0.12`) → peaceful when far, gentle shake only through the atmosphere; (4) **purple dune lines** — the lee-shadow trough was a saturated blue-violet (`0.28,0.26,0.44`), desaturated to a cool dusty shadow (`0.33,0.27,0.31`). **Captured for later phases:** (2) the crashed-pod EXTERIOR must match the interior cabin size → **Phase 4** roadmap req; (3) wake INSIDE the pod + release/blow the door to walk out (not teleport outside) → **Phase 4 T4.1** roadmap req; (5) interior detail pass → backlog. `verify` clean. The user re-tests the shake/dunes on the refreshed link, then `/campaign-approve` → Phase 3.

---

## ✅ APPROVED + ▶ OVERNIGHT RUN-THROUGH released (2026-06-30)
The user approved **Phase 2 (the descent showpiece)** after an extended attended walk-test (5 rounds of feedback, all fixed + pushed live — upright/calm/slow/seamless descent: close orbit → atmosphere → realistic desert horizon → ground rushing up to impact; counted as **cycle 18**, the Phase-2 walk-test polish). The user is heading to bed and asked to **run the campaign loop OVERNIGHT for lots of progress**. **Config change:** `checkpoint: milestone → none` for this run — the loop builds **Phase 3 → 4 → 5 straight through, NO phase-milestone pauses**; the user reviews the whole remaining feature in the morning (async via this log + the live Netlify preview link, which each cycle refreshes). Gate cleared: `status: active`, `awaiting_approval: false`, `stop_reasons: []`, `consecutive_no_progress: 0`. **Next: C19 = Phase 3 T3.1** (the hauler exterior — a hero asset, procedural-modeler + the full adversarial gate). The loop resumes via `/loop /campaign-cycle`; each cycle commits **and pushes**. Per-cycle adversarial gates still enforce visual quality; the human walk-test gate is deferred to the morning. **Verdict: CONTINUE** (overnight).

---

## Cycle 19 — Phase 3 T3.1: the HERO hauler exterior (2026-06-30, overnight) — PARTIAL → ⚠ DEFERRED to user art-direction
- **Planned:** build the worn cargo HAULER the pilot flees (a hero asset), seen through the pod porthole at eject.
- **Built:** `src/world/escapePodIntro/haulerScene.ts` (`buildHaulerExterior`/`disposeHaulerExterior`/`haulerBuilt`) + a `--scenario=hauler` rig + `__game.buildHauler()`/`disposeHauler()` hooks — a ~22m worn freighter (cockpit/bridge front + cargo spine + rear engine block w/ rocket bells + ember glow), weathered aluminium/rust, a self-contained starfield + hero lights, placed in front of the pod (−Z) to frame through the porthole. **NOT wired into the `shipExplode` beat yet** (that staging = T3.2). Behind the flag; live game byte-unchanged.
- **Verify:** `verify:all` PASS (tsc + placement 0/0 ×5 + colliders 0/40) + smoke `{ok:true,beats:10}` + build→dispose leak-free.
- **Visual iteration:** ⚠ **adversarial 4-critic HERO gate FAILED TWICE** (beauty 4-5; `silhouetteLegible=false` + `enginesRead=false` from all critics). R1: no readable engines (bells pointed dead-aft → the camera saw the open box-end), "a floating pallet of cardboard boxes," porthole = junk debris. A full redesign (rear-3/4 to the porthole, bigger engine bay, three-part silhouette, hero lighting, metal material, greebles) → R2 **still failed** (porthole reads as a small dark anonymous cluster; cockpit doesn't read; engines = end-caps not bells; slab silhouette; muddy material). **After 8 modeler rounds the autonomous procedural-modeler PLATEAUED below the hero bar.**
- **Decision — DEFERRED to USER ART-DIRECTION:** the modeler does INTERIORS well (the pod) but plateaued on the hauler EXTERIOR silhouette (a multi-part ship that must read through a small porthole at distance). This hero ship needs the user's specific eye — like the descent did. Rather than spin more autonomous rounds (diminishing returns) or pause the whole overnight run, the hauler (T3.1) + the explosion (T3.2, which depends on it) are **flagged for the user's morning review**, and the loop **continues to T3.3 (the cockpit interior)** — tractable autonomously. The model exists as a wired placeholder: `__game.buildHauler()` / `rig-shot --scenario=hauler --angle=porthole|broadside|engines`.
- **Spend:** ~1.05M (2 modeler dispatches + 2 adversarial gates + orchestration/docs); campaign total ~12.18M; cycle **19/150**.
- **Commit:** `a188810`.
- **▶ USER (morning):** the **hauler exterior needs your art-direction** — view it via `__game.buildHauler()` (or the rig PNGs at `verification/scen-hauler-*.png`). The gate's blockers: the silhouette doesn't read as a directional cargo ship (cockpit-front/engine-rear), the engines don't read as engines, and it's small/muddy through the porthole. Tell me the direction (proportions, the look, the framing) and I'll finish T3.1 → T3.2 (the explosion).
- **Next:** C20 = Phase 3 **T3.3 — the cockpit interior** (the single-pilot cockpit you start in; escalating console readouts + a personal touch).

---

## Cycle 20 — Phase 3 T3.3: the cockpit interior + the STRATEGIC PIVOT (2026-06-30, overnight) — PARTIAL → ⚠ hero-visuals deferred; overnight pivots to the playable intro
- **Planned:** build the HERO cockpit interior (the game's opening shot — seated in the worn single-pilot bridge).
- **Built:** the procedural-modeler reworked the greybox cockpit (`shipScene.ts`) into a hero single-pilot bridge — worn riveted-aluminium shell, a big forward window framing a self-contained orbit view (planet + terminator + atmosphere limb + stars), a pilot seat + side-stick + armrest foreground, a console (green ORBIT ACHIEVED CRT + gauges + telltales), the personal touch (photo/mug/token), a bulkhead door, warm lighting. New `setCockpitAlert(0|1|2)` hook (the E2 escalation, for T3.4). Contracts preserved; `--scenario=cockpit` rig. **The opening shot is dramatically improved over greybox** — it now reads as "a lone pilot at the worn controls, looking out at the planet."
- **Verify:** `verify:all` PASS + smoke `{ok:true,beats:10}`. Behind the flag.
- **Visual iteration:** ⚠ **adversarial 4-critic gate FAILED twice** (beauty 4→5). The redesign found the real root causes (spawn 2.75m back from the dash = bare floor; the rig wasn't killing world weather = the "dirty-lens" smears). After the fix the CODE auditor passed (beauty 8) + the opening shot reads, but the 3 visual critics still fail on **surface-fidelity** (flat untextured walls, no rivets-as-geometry, blank CRT text, candy-button gauges, blank photo, flat lighting, planet cropped too big).
- **⚠ STRATEGIC PIVOT (this cycle):** two consecutive Phase-3 hero VISUALS (C19 hauler, C20 cockpit) plateaued below the released-game bar across multiple modeler rounds + gates — and both are assets the **user art-directs regardless** (the hero ship + the opening shot; the descent took 5 user rounds). So the overnight loop **stops grinding the modeler on hero visuals and builds the LOGIC/STAGING/AUDIO that makes the intro PLAY** (the main loop's strength, no user-eye needed). **Deferred to the user's morning art-direction:** the hauler exterior, the cockpit surface-fidelity, the hero corridor geometry, the explosion FX. **Overnight builds:** T3.4 disaster staging → Phase 4 (wake/tutorial) → Phase 5 (audio). The user wakes to a fully-playable intro + a hero-visual art-direction list.
- **Spend:** ~1.0M (2 modeler dispatches + 2 gates + orchestration/docs); campaign total ~13.18M; cycle **20/150**.
- **Commit:** `aaebc37`.
- **▶ USER (morning):** two hero visuals need your eye — the **cockpit opening shot** (`rig-shot --scenario=cockpit` / play the intro) and the **hauler** (`__game.buildHauler()`). Both read but need a surface-fidelity/art-direction pass. Tell me the direction and I'll finish them + the explosion.
- **Next:** C21 = Phase 3 **T3.4 — the disaster staging** (main-loop logic over the greybox corridor: the engine-fire disaster → red-alert → flee to the pod; wire the console escalation).

---

## Cycle 21 — Phase 3 T3.4: the disaster staging (2026-06-30, overnight) — SHIPPED
- **Planned:** the disaster STAGING (the ship's death drives you to the pod) — main-loop logic, the first pivot cycle that ships not defers.
- **Shipped:** the `corridor` beat (`sequence.ts`) restructured into the disaster — walk aft → the engine bay erupts in fire → red-alert floods the corridor + a one-time concussive jolt/flash → "🔥 ENGINE FIRE — GET TO THE ESCAPE POD!" → flee forward to the bridge → enterPod. New `shipScene.ts` hooks: `setEngineFire(intensity,t)` (additive emissive flame quads at the dead-end, hidden until the disaster, flickering) + `setShipAlert(0|2,strobe)` (tints the greybox corridor red-alert, pulsing). **E2 console escalation wired:** ORBIT ACHIEVED → CORE TEMP CRITICAL (`setCockpitAlert(1)` at check-engines) → HULL BREACH (`setCockpitAlert(2)` at the disaster). `__game.setShipAlert`/`setEngineFire` + a `--scenario=corridor` rig.
- **Verify:** verify:all PASS (tsc + placement + colliders) + smoke `{ok:true,beats:10}`.
- **Visual iteration:** own-loop (greybox STAGING, not a hero asset → no adversarial gate). The `--scenario=corridor` rig (fire/flee) confirms the engine-bay fire + red-alert flood + flee-toward-the-bridge read; tuned the red lerp down so the corridor keeps form (1 reshoot). The MOTION (fire flicker, red strobe, the flee, the jolt) is a walk-test item.
- **Deferred (per the pivot):** the hero CORRIDOR GEOMETRY + hero FIRE FX (smoke/particles/light) + the full E1 door-funnel + E3 spatial-audio (audio = Phase 5) → user art-direction. The disaster PLAYS (the defining value); its beauty is the deferred visual.
- **Spend:** ~300K (main-loop inline, no modeler/gate — the pivot's payoff: ~3× cheaper than the hero-visual cycles); campaign total ~13.48M; cycle **21/150**.
- **Commit:** `c05ade7`.
- **Next:** C22 = **Phase 4** (crash/wake/reveal + tutorial — main-loop logic; incl. the C18 reqs: crashed-pod exterior matches the interior size; WAKE INSIDE the pod + blow-the-door, not teleport-out).

---

## Cycle 22 — Phase 4 T4.1: impact + wake-inside-pod + blow-door (2026-06-30, overnight) — SHIPPED
- **Planned:** the C18 walk-test req — wake INSIDE the crashed pod (in the desert) and release the door to walk out, NOT teleport to standing in open desert.
- **Shipped:** reworked the `wake`/`stepOut` beats + a new minimal wake interior (`buildWakeInterior`/`blowWakeHatch` in `podScene.ts`). **Under the crash blackout** (invisible), the player leaves the offset descent pod and comes to INSIDE the crashed pod at the desert spawn. The flow: come-to (fade from black, dazed, looking out the ajar hatch at the dawn desert) → "Kick the hatch open [click]" → the door blows off (a one-time jolt/flash) → "Climb out" (mode→walk) → the player WALKS OUT the hatch into the dunes → leaving the pod radius ends the wake → `stepOut` leaves the crashed wreck where they climbed out + the salvage toast. **No magic teleport** — the teleport is hidden under the black; they physically walk out. The wake interior is visual-only (noCollider) so the player stands on the real terrain.
- **Verify:** verify:all PASS + smoke `{ok:true,beats:10}` + the `--scenario=wake` rig reads.
- **Visual iteration:** own-loop (greybox wake interior, not a hero asset → no adversarial gate). The wake rig confirms: inside the dark crashed pod, the worn hatch frame + ajar door, the dawn desert beyond — the C18 read. A touch dark; the MOTION (fade-in, door blow, climb-out) is a walk-test item.
- **Deferred (per the pivot):** the HERO crashed-cabin interior (detail + lighting — the wake interior is dark/greybox) + the crashed-pod EXTERIOR↔INTERIOR size-match (C18) → user art-direction. T4.1's defining value (wake → blow → walk out) is delivered.
- **Spend:** ~400K (main-loop inline); campaign total ~13.88M; cycle **22/150**.
- **Commit:** `a8b21a0`.
- **Next:** C23 = Phase 4 **T4.2 — the desert reveal** (dawn, half-buried pod, aftermath-silence pacing, the horizon hook).

---

## Cycle 23 — Phase 4 T4.2: the desert reveal (2026-06-30, overnight) — SHIPPED
- **Planned:** the desert reveal as the player climbs out — dawn, half-buried pod, aftermath-silence pacing (E7), the horizon hook (E8).
- **Shipped (main-loop logic, `sequence.ts` + `podScene.ts`):** (1) **DAWN** — `stepOut` sets `ctx.time.dayTime=0.26` so the player emerges into the dawn dunes (cohesive with the descent; the game otherwise starts mid-morning). (2) **Aftermath-silence pacing (E7)** — `stepOut` reworked into a held quiet reveal beat: stand in the dawn, pod beside you, **no HUD/objectives** for 4s, then hand off + the salvage toast. (3) **Horizon hook (E8)** — the emergence faces origin-ward (`hookYaw=atan2(returnPos.x,returnPos.z)`) toward the **M5a hero-landmark silhouette** ring (fog-resistant, placed at boot), so a distant silhouette on the dawn horizon pulls the player onward; `buildWakeInterior` gained a `yaw` + the door swung well aside so the desert reads past it.
- **Verify:** verify:all PASS + smoke `{ok:true,beats:12}` + the `--scenario=wake` rig (dawn desert + horizon glow through the hatch).
- **Visual iteration:** own-loop (greybox wake interior). The wake rig reads (dawn + horizon); dark + imperfect door framing at the fixed angle (in-game free-look). The MOTION/feel is a walk-test item.
- **Deferred (per the pivot):** the HERO crashed-cabin wake interior (lighting/detail/framing) + a bespoke hook landmark + the crashed-pod exterior↔interior size-match → user art-direction. T4.2's defining value (dawn reveal + silence + hook) is delivered.
- **Spend:** ~350K (main-loop inline); campaign total ~14.23M; cycle **23/150**.
- **Commit:** `692b2d5`.
- **Next:** C24 = Phase 4 **T4.3 — the craft+salvage tutorial + the chute-pop payoff** (the last Phase-4 tier).

---

## Cycle 24 — Phase 5 T5.1a: the intro SFX arc + T4.3 deferred (2026-06-30, overnight) — SHIPPED
- **Planned:** Phase 4 T4.3 (craft+salvage tutorial + chute-pop). **Reordered** → deferred T4.3 to the user (feel-critical + comic-hero + the salvage-pry can't be verified unattended — preview hangs on the desert) and did the verifiable **Phase 5 audio** instead.
- **Shipped (T5.1a):** the silent intro gets SOUND. 8 procedural Web-Audio one-shots in `audio.ts` (`playEjectThunk`, `playExplosionBoom`, `playKlaxon`, `playHullGroan`, `playReentryRumble`, `playLeverClick`, `playLeverSnap`, `playDoorBlow`) + `playCrashImpact` reused, wired to the intro beats: eject/shipExplode, the corridor disaster (boom + groan + klaxon), the re-entry peak (rumble), each parachute yank (click) + the snap, the crash, the wake hatch blow. `ensureAudioStarted()` on intro start.
- **Verify:** verify:all PASS + smoke `{ok:true,beats:12}` + self-audited the graph (pattern-matches the shipped `playCrashImpact` — finite start/stop, exp-ramp to 0.0001, no leak). Audio's real judgment is **listening** → the user.
- **Deferred:** T4.3 (tutorial + chute-pop → user, playtest/comic), T5.1b ambient loops (cockpit hum, wind) + mix balance, T5.2 music — all benefit from the user's ear; + the standing hero-visual list.
- **Spend:** ~400K; campaign total ~14.63M; cycle **24/150**.
- **Commit:** `64b3744`.
- **Next:** C25 = T5.1b (audio loops: cockpit hum + wind, with start/stop lifecycle) + mix balance.

---

## Cycle 25 — Phase 5 T5.1b: the ambient audio loops (2026-06-30, overnight) — SHIPPED
- **Planned:** the sustained ambient loops the C24 one-shots didn't cover (cockpit hum, the fall's air-rush), with start/stop lifecycle.
- **Shipped:** 2 procedural Web-Audio loops in `audio.ts` → the ambient bus. **`startCockpitHum`/`stopCockpitHum`** — the calm in-orbit bed (detuned drone + air-handling noise + a faint electronics tone), Beat 0 → eject. **`startDescentRush`/`stopDescentRush`** — the swelling air-rush of the fall, descent → impact (fills the 18s descent under the re-entry one-shot). **Lifecycle (C16):** a named `_introLoops` registry, idempotent start, fade-out stop, + `stopAllIntroLoops()` in `endEscapePodIntro` so nothing dangles on any exit. The reveal stays silent by design (E7); the game's soundscape resumes at handoff.
- **Verify:** verify:all PASS + smoke `{ok:true,beats:12}` + self-audited the lifecycle.
- **The whole intro now plays end-to-end WITH SOUND** (one-shots C24 + loops C25). The user LISTENS to judge + balance.
- **Spend:** ~250K; campaign total ~14.88M; cycle **25/150**.
- **Commit:** `c7265c4`.
- **Next:** C26 = T5.2 music (escape sting → descent swell → desert easing) — the final overnight-tractable piece; after it, everything remaining needs the user → the loop surfaces the morning summary + stops.

---

## Cycle 26 — Phase 5 T5.2: music cues + OVERNIGHT RUN COMPLETE (2026-06-30) — SHIPPED → ⏸ PAUSED for the user
- **Planned:** the music cues (the final overnight-tractable piece).
- **Shipped:** 3 procedural music PADS in `audio.ts` (no samples) → the ambient bus, wired to the beats: **escape sting** (tense minor cluster — the disaster→eject), **descent swell** (warm swelling open chord — the beautiful fall), **desert easing** (a soft resolving chord that fades itself out, bridging into gameplay — the dawn reveal). A `_startPad` helper + the `_introLoops` lifecycle. The intro's emotional arc is complete: silence → tension → beauty → calm.
- **Verify:** verify:all PASS + smoke `{ok:true,beats:12}` + self-audited the lifecycle.
- **⏸ OVERNIGHT RUN COMPLETE (C19-C26):** the whole intro PLAYS end-to-end with full SFX + music. Every remaining item needs the USER, so the loop **paused** (`status: paused`, `milestone-review`).

### ▶ FOR THE USER (the morning review) — what's done + what's next
**The autonomous overnight run built the entire PLAYABLE intro** (behind `FEATURES.escapePodIntro`): cockpit → check-engines → corridor disaster → eject + explosion → re-entry → the beautiful descent → the parachute gag → crash → **wake inside the pod → kick the hatch open → walk out** into the **dawn** desert — now with full SFX + music. Play it: `FEATURES.escapePodIntro=true` + new game, or `__game.startIntro()` / `smokeIntro()`.

**The PIVOT (C20):** the autonomous procedural-modeler **plateaued** on the Phase-3 hero VISUALS (the hauler, the cockpit) across multiple adversarial-gate rounds — and those are assets you'll want to art-direct anyway (as you did the descent over 5 rounds). So the loop **deferred all hero visuals + feel/playtest/comic work to you** and spent the night building the playable logic/staging/audio that it *can* verify. **Your morning list (prioritized):**
1. **Hero VISUALS (art-direction):** the **hauler exterior** (`__game.buildHauler()` / `rig-shot --scenario=hauler`), the **cockpit surface-fidelity** (`rig-shot --scenario=cockpit` — the opening shot reads but needs your eye), the **ship-explosion FX** (T3.2), the **hero corridor** geometry + fire FX, the **HERO crashed-cabin wake interior** + the **crashed-pod exterior↔interior size-match** (your C18 req), a **dedicated horizon-hook landmark**.
2. **Feel/playtest — T4.3:** the **craft+salvage tutorial** (the `scrap_machete`/D261 pry tool + the salvage system EXIST — wire the pod as a pryable `escape_pod` salvageable) + the comic **chute-pop** payoff. Couldn't be verified unattended (the pry interaction needs a playtest; preview hangs on the desert).
3. **Audio:** **LISTEN + balance** the SFX/loop/music mix.

Tell me which to tackle (I can drive the hero visuals with you, or wire T4.3) — or drop a note in `steering.md` + resume with `/campaign-approve`.
- **Spend:** ~250K; campaign total ~15.13M (~7M this overnight run, C19-C26); cycle **26/150**.
- **Commit:** `10c7e5d`.
- **Verdict: STOP — `milestone-review`** (`status: paused`, `awaiting_approval: true`). The overnight autonomous work is complete; the loop awaits the user.

---

## Cycle 27 — REBUILD v2 R1a + R1b (2026-06-30, attended) — SHIPPED
- **Context:** the user walk-tested the v1 overnight build + directed a re-architecture (re-ground in the REAL world; ONE physical pod; space = a wrapping skybox; descent = a physical fall into the real desert). Plan: `feature-escape-pod-intro.md` `## REBUILD v2`. Driving R1→R5 via the loop, checkpoint=milestone (the user art-directs each phase).
- **R1a — real sky "space mode":** `setSkyIntroMode` (`sky.ts`) drives the game's REAL camera-relative sky into space (wrapping stars + a real-scale planet; non-destructive). Removed the fake `buildOrbitView` planes. Wired into the beats. The cockpit window now reads as real orbit.
- **R1b — descent re-grounded:** the pod physically FALLS through the real desert above the spawn (`setDescentBase` + `setDescentProgress` drives the altitude; body+camera ride down). The viewport shows the REAL terrain + sky. Deleted ~430 lines of fake vista. *Concession:* `DESCENT_ALT`=600m (world + porthole-angle limits; a 3000m "from-orbit" read = R4).
- **Verify:** verify:all PASS + smoke `{ok:true,beats:12}` + rig (cockpit space; descent 0.3/0.6/0.9 = plasma / real dawn sky / real dunes rushing up).
- Both delegated to fresh procedural-modeler contexts (deep architectural+visual) while the main loop orchestrates/wires/verifies.
- **Commit:** `83bba35`.
- **Next:** R1c — remove the teleport seams (physical continuity pod→crash→wake→exit) → then the R1 milestone (user walk-test of the re-grounded orbit + descent).

---

## ⏸ REBUILD R1 MILESTONE — real-world re-grounding COMPLETE → AWAITING USER WALK-TEST (2026-06-30)
**R1 (the spatial re-grounding keystone) is done** — R1a (the real sky in "space mode": the cockpit window shows real wrapping stars + a real-scale planet, the fake plane gone) + R1b (the descent re-grounded: the pod physically FALLS through the real desert toward the spawn; the viewport shows the REAL terrain + sky; ~430 lines of fake vista deleted). R1c (removing the teleport seams) folded into **R3** — it's inseparable from unifying the 3 pod models into ONE. Behind `FEATURES.escapePodIntro`; verify:all + smoke green.

**▶ USER WALK-TEST:** play the re-grounded **orbit + descent** — `FEATURES.escapePodIntro=true` + new game, or `__game.startIntro()` (jump: `jumpToBeat('cockpit')` for orbit, `jumpToBeat('descent')` for the fall). Check the FEEL/MOTION (which stills can't gate): the orbit view through the cockpit window (real stars + planet), then the pod physically falling through the real desert (real terrain + sky, the ground rushing up at the window). **Known / coming:** the pod is still 3 separate models stitched at impact→wake (the consistency fix = **R3**, next); the fall starts at 600m not 3000m (a "from-orbit" read = R4 — tilt the capsule); the cockpit/ship is still the greybox box (R5). Feedback → `steering.md` or inline. Then **`/campaign-approve`** releases R2 (space hero-polish) → R3 (the one physical pod) → R4 → R5.

**Verdict: STOP — `milestone-review`** (`status: paused`, `awaiting_approval: true`).

---

## ✅ R1 APPROVED → continue R2-R5 (checkpoint→none) (2026-06-30)
The user walk-tested R1, approved it to continue, and reported 2 bugs (both fixed live + pushed): the orbit planet drew ON TOP of the ship (`depthTest:false` → set true, so the hull occludes it — visible only through the window); dust was visible in space (the one-time hide was overwritten each frame by updateWeather/Dust → re-suppress every frame in updateEscapePodIntro). **R1 polish TBD** — the user will give another feedback round later (planet/descent feel). The user asked to **keep building through R2-R5 without per-phase pauses** (checkpoint=milestone→none) and review the batch later. Gate cleared: status active, awaiting_approval false. **Next: R2** (space scene hero-polish). **Verdict: CONTINUE** (run-through).

---

## Cycle 28 — REBUILD v2 R2 (space hero-polish) + 2 R1 walk-test bug-fixes (2026-06-30) — SHIPPED
- **R1 bug-fixes (user walk-test):** planet drew on top of the ship → `depthTest:true` (occluded by the hull, seen through the window); dust in space (one-time hide overwritten each frame) → re-suppress every frame in `updateEscapePodIntro`.
- **R2 — space hero-polish** (modeler, 7 rounds, `sky.ts`, non-destructive): milky-way band + richer stars; a planet that reads as a real world (continents/seas/banding/caps/clouds/terminator); a thin atmosphere limb. Planet size/placement KEPT default (user's framing call).
- **Verify:** verify:all + smoke `{ok:true,beats:12}` + rig (orbit + clear-sky controls byte-clean).
- **Commit:** `391ae90` (+ docs).
- **Next (run-through):** R3 — the ONE physical pod (unify the 3 models; enter→eject→ride→exit, no teleport) → R4 → R5.

---

## Cycle 29 — REBUILD v2 R3a: the ONE consistent pod (2026-06-30) — SHIPPED
- **R3a — the user's #1 consistency req:** removed the 3-model swap. The player now wakes in + climbs out of the SAME `buildPodScene` hero cabin they rode down — `setCabinCrashPose` (crashed tilt + drop the collider + a dawn wake-light), a real hatch cut into the cabin (`buildCabinHatch`) onto the dawn desert, `blowCabinHatch`. The crashed exterior re-sized to MATCH the cabin (~2.9m capsule, C18 size-match). Deleted `buildWakeInterior`.
- **Verify:** verify:all PASS + smoke `{ok:true,beats:12}` + rigs (wake = the real hero cabin; matching exterior).
- **Concessions (user look-batch):** the fat exterior reads dome-heavy at low angles; the wake interior is dim; the hatch clock differs in vs out (size matches).
- **Commit:** `8493f49` (+ docs).
- **Next (run-through):** R3b — the docked-in-ship physical enter/eject → then R4 → R5.

---

## Cycle 30 — REBUILD v2 R4: parachute mid-fall + real blackouts (2026-06-30) — SHIPPED
- **R4 (user timing fixes, logic-only):** (1) parachute gag MID-FALL — descent hands off at ~384m, the 3 pulls + snap land 384m→112m, the pod keeps falling to impact at the ground (`tickParachute` continues the fall); was "on the ground." (2) real ~2s blackouts (`_phaseFade` hold-then-fade ~2.3s; impact ~2.07s; was 0.35s).
- **Verify:** tsc + smoke `{ok:true,beats:12}` (traced against the real tick code; the FEEL is a walk-test item — the preview is throttled).
- **Reordered:** R3b (docked enter/eject) → folded into R5 (the pod-bay is part of the ship).
- **Commit:** `73a09ac` (+ docs).
- **Next (run-through, LAST piece): R5** — ship interior + corridor redesign + the pod-bay + physical enter/eject. Then the rework is feature-complete → the user's big review.

---

## Cycle 31 — REBUILD v2 R5a: hero cockpit redesign (box → worn fuselage) → ⏸ USER-PAUSED (2026-06-30)
- **R5a — the cockpit:** redesigned the greybox-BOX cockpit into a worn industrial-hauler spaceship cockpit (lofted ribbed D-section fuselage + raked mullioned windscreen + asymmetric avionics console + a real crash-seat + a deep bulkhead doorway + cool neutral metal). Driven through a **4-round adversarial visual-gate loop** (beauty 4 → 5.2 → 6.5 → 6.75). The gate (5 critics + code-auditor, 3×) repeatedly caught real defects under confident builder self-grades (a 5.2 under a self-graded 8; a wine-barrel + grinning-face + floating-seat + placeholder-doorway — all since killed).
- **Steering (processed + archived):** user note — the hull metal reads "too pristine/shiny"; they preferred the OLDER rugged/matte texture. A rugged/matte material pass was launched + **interrupted by the user's pause** (partial edits committed, tsc/smoke green).
- **PAUSED** by the user ("pause where we are now, pick it back up later"). Commit `07fa124` (+ docs). status=paused, awaiting_approval=true.
- **Verify:** tsc + verify:all + smoke `{ok:true,beats:12}`.
- **Resume (see next-session-prompt):** finish the matte-material pass · the FP seat read (plateaued — may want the user's eye) · the planet-framing (R2) · then R5b (corridor) + R5c (pod-bay + enter/eject). Resume via `/campaign-approve` or steer.
- **Cost note:** ~1.8M tokens (4 modeler rounds + 3 gates) — the adversarial gate earns its keep on hero visuals but is expensive; scope gate width to stakes.

---

## Cycle 32 — REBUILD v2 R5 FINISH → REBUILD v2 COMPLETE (overnight 2026-07-01)
- **User:** "unpause + work through the night, lots of progress." Also flagged: Netlify usage limit reached (preview won't deploy — logged to backlog; the loop keeps committing+pushing, verifies via rig+gates).
- **R5a-finish** (`65af5eb`): rugged/matte hull (user steering) + the 4-round seat "tan wedge" ROOT-CAUSED — it was the harness straps (bright orange, foreshortened near the eye), not the bolsters → dark oxblood + slimmed. The buckle now reads.
- **R5b** (`49b4e08`): the corridor greybox tube → a fully-modelled freighter passage + real fire/red-alert disaster lighting. Colliders byte-identical.
- **R5c** (`fb7cb6f`): the pod-bay + PHYSICAL enter/eject (no teleport) — dock → walk-up → scripted climb-in → seal → eject via explosive-bolt release → the R1b descent.
- **→ REBUILD v2 (R1-R5) COMPLETE.** The whole real-world re-architecture the user directed (2026-06-30 morning) is built end-to-end.
- **Cost discipline:** after R5a's ~1.8M (4 modeler rounds + 3 gates), scoped R5b/R5c to own-eyes + verify:all (walked-through/flow pieces), reserving the full adversarial gate for the hero opening frame.
- **Verify:** verify:all PASS + smoke `{ok:true,beats:12}` each step.
- **Next (this overnight):** the planet-framing residual (the cockpit-beat windscreen), then wrap for the user's full walk-test/review.

---

## Cycle 33 — overnight continuation: orbit-vista fix + T4.3 tutorial + bug-hunt (2026-07-01)
- **Orbit-vista fix** (`3d271d3`): the cockpit "tan wall" was a BUG — the desert FogExp2 + scene.background were never thinned in space mode → they fogged the black dome tan. Root-fixed in sky.ts applySpaceMode (thin fog/bg in orbit, eased back at re-entry) + reframed the planet as a real disc + limb + stars. ALSO fixed the cockpit RIG (it paused before the sky updated at the ship-origin camera → every prior cockpit shot, incl. the gates, rendered stale/no planet + tan fog). Rig now faithful.
- **T4.3 the first tutorial** (`59795bf`): craft a machete → salvage your own crashed pod (wired into the existing pry/extract flow) → the failed parachute comically POPS OUT (procedural canopy + a "sproing"). New podTutorial.ts state machine. smokePodTutorial all stages pass. No SAVE bump; purely additive.
- **Bug-hunt** (`bf07847`): an adversarial 4-reviewer + verify + synth sweep of the night's heavily-changed intro code found the code essentially CLEAN — ONE sev-3 dev-only bug (podTutorial re-scatter guard keyed off the wrong predicate → re-scattered on same-page replay). Fixed.
- **→ The intro now flows end-to-end** (orbit → disaster → eject → descent → crash → wake → step out → craft → salvage → chute-pop) and is bug-clean. Loop wound down at ~05:15 — the remaining work (Phase-3 ship-explosion-through-the-frame [depends on the plateaued hauler exterior], look/feel polish) is best with the user's review + art-direction, not a saturated-context 5am autonomous attempt.
- **Verify:** verify:all + smokeIntro `{ok:true,beats:12}` throughout.

---

## Cycle 34 — polish batch + Phase-3 → INTRO FEATURE-COMPLETE (overnight 2026-07-01)
- The user restarted the loop post-REBUILD-v2 for more overnight progress. Polish + the last beat:
- **Pod-bay** greybox-plus → corridor bar (`3fb8daa`): de-cluttered hazard, detailed docked capsule + clamps/umbilicals/airlock, fixed lighting.
- **Beached Leviathan** horizon-hook (`90b8749`): a colossal wrecked ship ~360m out, dead-center in the step-out gaze — the dawn-reveal "go there" payoff. Gated behind the intro flag (doesn't touch live master); promotable to always-on.
- **Chute-pop** (`78359ba`): bigger comic billow (CANOPY_R 2.3→3.3 + squash + droop/flop) — the payoff lands.
- **Phase-3 SHIP EXPLOSION** (`44c7354`): the last missing beat. Wired the existing (T3.1, previously-unwired) hauler into the post-eject porthole view + built the explosion FX (fireball + 38-chunk debris + shockwave + cabin flash, pod level/no-tumble). Dwell 1.2s→~4.4s.
- **→ THE INTRO IS FEATURE-COMPLETE.** Every beat of the 2026-06-28 vision is built (orbit → disaster → eject → watch-the-ship-die → descent → parachute → crash → wake → step out → horizon reveal → craft → salvage → chute-pop).
- **Verify:** verify:all + smoke `{ok:true,beats:12}` throughout.
- **Loop wound down here:** remaining = FEEL walk-tests + minor art-direction polish (the user's domain, not autonomous-buildable). See next-session-prompt.

---

## Cycle 35 — hardening: coherence + audio (overnight 2026-07-01)
- User kept the loop running post-feature-complete → hardening passes on the whole intro.
- **Coherence** (`768890f`): re-shot all beats faithfully; fixed the ride-down cabin reading white-plastic (desert sun following the pod to orbit + too-light shell) → worn aluminium; whole intro now one tone. Flagged 2 items for walk-test.
- **Audio** (`5d8bc4c`): 6 new procedural synths filling the silent beats (engine fire, bolt shear, hatch seal, ship-death roar, desert wind, awe swell); every beat scored; leak-safe. Mix balance = user's LISTEN.
- **Verify:** verify:all + smoke `{ok:true,beats:12}`.
- **Tail note:** the substantive autonomous work (build + coherence + audio + bug-hunt) is now done; remaining = the user's feel walk-tests + audio balance + minor art-direction. Further cycles are marginal polish.

---

## Cycles 36-40 — post-feature-complete hardening + QA (overnight → morning 2026-07-01)
The user kept the loop running past feature-complete; each pass found + fixed real things:
- **Coherence fix** (`768890f`): the ride-down cabin read white-plastic (desert sun following the pod to orbit + too-light shell) → worn aluminium; whole intro one tone.
- **2 coherence-flag fixes** (`106a526`): the WAKE interior was near-BLACK (Reinhard tone-curve crushes the enclosed interior at the desert's 1.05 exposure — lift to 2.0 during the crashed pose, restore on teardown) + the explosion HUSK left a brown wash → clears to star-space (uFade).
- **Lifecycle fix** (`a144f03`): the wake exposure leaked 2.0 via dev jumpToBeat (washed-out orbit) → restoreCabinExposure. SAVE (introComplete/replay/mid-intro) + PAUSE (all timers freeze) confirmed CLEAN.
- **Fireball polish** (`605ce0a`): tighter hot core (was an additive-clip white blob) + smoke billow.
- **Docs** (`44e0aef`): docs/architecture-escape-pod-intro.md — the as-built map (beat machine, scenes, the STATE-RESTORE discipline, gating, dev hooks, audio).
- **Tooling** (`ecc15e6`): `npm run verify:intro` gate (smoke-intro now exits non-zero on failure) + removed a duplicate handler.
- **Perf check**: the intro's per-frame hot path (beat machine + scene updates) is allocation-CLEAN (no GC-hitch risk); per-beat mesh counts modest. No fix needed.
- **VERDICT: the autonomous work is genuinely exhausted** — feature-complete + hardened (bug-hunt/coherence/audio/lifecycle/perf) + documented + gated. Remaining = the user's feel walk-tests, audio balance, art-direction taste. Loop rested.

---

## Cycles 41-46 — usability vein + the USER'S CONSISTENCY RE-SCOPE + clear skies (2026-07-01)
- **Usability/readability vein** (each a real find): the cockpit seat BUCKLE faced AWAY from the pilot (the root cause of the whole 4-round seat saga — flipped + self-lit, `8651866`); the fireball's radial sunburst → a turbulent ball (same commit); the EJECT-lever prompt aimed at a wall (re-framed, `49b4027`); the checkEngines aft doorway was a black void (lit exit-glow, `a978b93`).
- **USER STEERING (walk-test) — POD+WORLD CONSISTENCY re-scope** (`e098ea6`→`8af6074`): ONE enterable pod (unifyEnterablePod — no dispose+swap; walk back in; persists into the real game) + consistent bright MIDDAY (dayTime 0.46, no time/light jump; the fall-through sky == the step-out sky).
- **Residuals** (`929e1c5`): wake-inside brightened (a rig fade-overlay footgun + directional rake lights); chute anchored to the unified crown; bezel neutralized; ONE-pod verified in real play (the "two pods" was a dev-scene artifact).
- **Downstream catches**: the Leviathan was dawn-tuned + washed out at midday → its own deeper hull value (`4878da2`); "clear skies" was a real INCONSISTENCY — the descent thinned fog but the step-out inherited the dense survival fog → INTRO_CLEAR_FOG_DENSITY pinned across the whole atmospheric leg + a 6s ease-back post-handoff (`1b17698`).
- **Verify:** verify:all + smoke `{ok:true,beats:12}` at every step. (A mid-cycle session restart was resumed cleanly — the sky-clarity work was verified + committed on resume.)
- **State:** all of the user's walk-test feedback is implemented + verified. Remaining = the user's next walk-test round (feel/motion + the new consistency in person) + audio balance.

---

## ⏸ Paused mid-cycle 47 (2026-07-01 evening) — resume note
- **In-flight when paused:** a full-chain visual REGRESSION sweep (checking interaction effects of the 3 stacked structural changes — unified/grounded pod + midday + pinned clear fog — across all beats; the descent is where all 3 meet). The sweep was stopped in its SHOOTING phase — **no code edits were made**; the tree is clean; nothing to reconcile.
- **On resume:** just re-run that sweep (`/loop /campaign-cycle` boots it from this note), or skip it if the user walk-tests first (their walk-test covers the same ground with better eyes).
- Everything through `ee70c94` is committed + pushed. All user walk-test feedback (one pod / midday / clear skies) is implemented + verified.

---

## Cycle 47 — full-chain regression sweep: CLEAN (2026-07-01 evening)
- Run INLINE by the main loop after two subagent interruptions (progress persists shot-by-shot). Checked the 3 stacked structural changes (unified/grounded pod + midday + pinned clear fog) for cross-beat interaction regressions.
- **The descent (where all 3 meet): coherent** — d0 orbit-top = clean space+planet (no midday/fog bleed into the space beats); d0.15 re-entry plasma reads at midday; d0.5 = a crisp clean high-altitude blue (no fog seam); d0.9 = the warm midday dunes (matches step-out, verified last cycle).
- **Space/ship beats unaffected** — the explosion porthole (t0.24) clean; pod-bay healthy; cockpit confirmed rendering.
- **Ground beats** (wake/stepout/leviathan/chute) verified at the current state within the last 2 cycles.
- **VERDICT: no regressions — no code changes this cycle.** verify gates unchanged (nothing edited).
- State: all user walk-test feedback implemented + the chain verified coherent end-to-end. Awaiting the user's next walk-test round.

---

## Cycle 48 — local playable intro build (the Netlify replacement) (2026-07-01 evening)
- **`npm run preview:intro`** — a one-command LOCAL replacement for the dead Netlify preview: `tsc && vite build --mode intro` (a real production build with the intro ON via `.env.intro`, base `/` from the non-production-mode fallback) + `vite preview --mode intro` at http://localhost:4173/. No new deps (no cross-env — Vite mode files are Windows-safe).
- **Verified:** the intro bundle inlines `escapePodIntro:!0` + root asset paths; serve → HTTP 200; **the master GitHub-Pages build is untouched** (`escapePodIntro:!1`, `/Dustfall/` base — the live site is safe).
- Backlog + review brief updated. Remaining (user-side, optional): a new remote host if a shareable link is wanted — netlify.toml ports as-is.
