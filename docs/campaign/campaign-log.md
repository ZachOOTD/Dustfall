# Campaign log — Dustfall (`campaign/2026-06-18`)

Append-only human chronicle, one entry per cycle. Your async review surface — read this (or
`/campaign-status`) anytime to see what each cycle did. Redirect via `steering.md`.

---

## Cycle 0 — campaign started · 2026-06-18 · `plan-review` pause

**Goal:** build out the remaining roadmap + backlog toward the GDD vision (lone-survivor
procedural desert; depth + finish, not new vision) until `--until=roadmap-empty`.

**Policies:** checkpoint=**milestone** · self-author=**propose** · visual-gate=**auto** ·
verify gate=**`npm run verify:all`** · branch=**`campaign/2026-06-18`** (commit every cycle).

**Budget:** max-cycles **12** (hard stop, this first run) · no soft token ceiling
(calibrate per-cycle spend after Milestone 1, then `--resume` with a higher cap).

**Baseline verify (`npm run verify:all`):** ✅ GREEN — tsc clean · `verify:placement`
0 bury-audit fails ×5 seeds (81/79/79/84/79 panels) · `verify:colliders` 0 coverage fails / 25 audits.

**Preconditions:** GDD present (§12 scope-cut authored here via `--plan-first`) · baseline green ·
destructive-action guard installed (`pre-bash-destructive-guard.mjs`, lock set) · max-cycles set ·
working tree clean. All met.

**Plan (`--plan-first`):** authored via a 6-domain backlog analysis (51 work-units) + a
coverage/GDD-compliance audit. Laid out the full ordered, milestone-grouped queue:
- **Phase A (BUILD-NOW, traversed unattended):** M1 Wreck-arc finish (calibration) → M2 Wreck
  breadth + infra gate → M3 The worm made right → M4 Critters + atmosphere → M5 Riding & rest feel.
- **Phase B (DESIGN-GATE, surface a proposal + pause):** M6 Survival & UX → M7 Wreck depth & new
  POIs → M8 Deep cave & companion → M9 Architectural-risk physics → M10 Big features & tools.
- **Excluded (GDD §11/§14):** base-building, multiplayer + char-customization. Deferred: real-PBR,
  WebGPU, Electron, dynamic-POI-gen, PARKED design-call items.
- Milestone headings written to `roadmap.md`; full per-unit detail in
  `iteration-plan.md` "Campaign 2026-06-18 — milestone ladder"; scope-cut order in GDD §12.

**Audit caught (folded into the plan):** companion-egg hard-gated behind the deep cave (M8, not
M4) · real-cloth depends on real-rope, both behind feature-flags-infra · sled-feel-tune scoped to
the existing tow/slope, NOT riding (riding is the M9 spike) · sarlacc-lure must bake the §11
awe-not-horror guardrail.

**Plan-review amendments (user steering + an evidence audit, 2026-06-18):**
- **Dropped** `sled-mechanics-feel-tune` (M5) — the slope-slide tune already shipped ACU (GAIN 6→2.5).
- **Added** `remove-wreck-sand-mounds` (M1, build-now) — strip the `makeSandMound` drifts around wrecks;
  **supersedes/drops** the §G sand-integration items (wrecked_tank sand-swallow, satellite/debris drifts, D236 banking).
- **Promoted to build-now** `sarlacc-lure-ambush` (M3, user opted in — awe-not-horror baked in) and the full
  §F/§G `wreck-polish-bundle` (M2 — non-axial mass, weathering chroma, engine droop, scout trauma, scale-anchor pocket).
- **Deferred** the §D player-model optional work (PM-S.3 / PM-E / lighting-mood / sled-on-back).
- **Dropped (won't-do)** the 5 PARKED items (hermit NPCs, salvage-durability, key-card panels, weld-kit, machete-loot).
- **Reframed as tunes, not rebuilds** (audit ground-truth): storm-sway folded into `atmosphere-feeltunes`
  (built ACW #134); `3p-camera-and-render-polish` → open sub-items only (cameraSnap + walk-cycle already
  shipped); `viewmodel-nits` → just the 3P torch flame (FP night-lighting shipped D174).

**Status:** ⏸ PAUSED at `plan-review` — awaiting `/campaign-approve` of this (amended) plan before
Cycle 1 (Milestone 1) starts. Build begins on approval + `/loop /campaign-cycle`.

---

## Cycle 0 addendum — net-new direction ideation (2026-06-18)

User asked what else is worth developing beyond the backlog. A vetted ideation pass (5 GDD-grounded lenses
→ 23 proposals → anti-feature + value/vision vetting; both vetters converged on the same 4 core-levers)
surfaced 3 net-new arcs the GDD weights heavily but ships thin: **C1 water & exposure · C2 exploration pull ·
C3 the Long-Storm endgame arc** (+ a lower-priority tone/ecology layer). Captured as **Phase C (PROPOSED)**
in `iteration-plan.md`. **Promotion decision (user, 2026-06-18):** **C2 exploration + `sun-shade-exposure` →
new build-now Milestone M5a**; **tone/ecology layer → M5b**. **Deferred** the rest of C1 (wreck-water-tanks,
wind-chill, condensation-still — "not for now"). **C3 endgame NOT pursued** — the user does not want an
endgame; the game stays open-ended ("days survived"), and the `--self-author` phase must NOT resurface a
storm-finale. Active build-now queue is now **M1-M5 + M5a + M5b**; design-gate M6-M10 unchanged.

---

## Cycle 0 addendum — review cadence set to PHASE-level (2026-06-18)

User: don't pause at each milestone — run the full phase, review after. Restructured the roadmap
`### Milestone:` markers to **PHASE boundaries**: the loop now runs all of Phase A (M1→M5b) unattended,
**committing every cycle**, and PAUSES once at "Phase A — Build-out complete." Phase B (M6→M10) is
design-gated — its design calls are made at the Phase A review, then it runs as one block → "Phase B
complete" review. **Commit granularity is unchanged: one commit per CYCLE (≈ one session); a single
milestone spans several cycles/commits.** `checkpoint` stays `milestone` (markers now sit at phase
boundaries, not per-M-milestone).

---

## Cycle 0 — APPROVED ✅ (plan-review gate released · 2026-06-18)

Human `/campaign-approve` at plan-review. The plan was authored directly into `roadmap.md` /
`iteration-plan.md` / GDD §12 (no separate proposal file to fold). **Gate cleared:** `status: active`,
`awaiting_approval: false`, `stop_reasons: []`. Launch config (user kept as-is): cap **12** (hard stop —
first stop will be `max-cycles` ~mid-Phase-A; resume via `/campaign-start --resume --max-cycles=<N>`, NOT
`/campaign-approve`), gate `npm run verify:all`, visual-gate `auto`, **PHASE-level** review,
`until: roadmap-empty`, no budget ceiling. No post-mortem drafts pending (consolidate skipped).
**Cycle 1 is released → Phase A → M1 (Wreck-arc finish).** Begin with `/loop /campaign-cycle`.

---

## Cycle 1 — M1 panel dead-code cleanup + perf baseline (2026-06-18) — SHIPPED
- **Planned:** M1's two headless units — strip dead panel-greeble code + record the perf baseline (safe, verifiable first cycle).
- **Shipped:** removed the dead `buildGreeble` interior path (9 fns + 3 orphaned materials, −242 lines `panelGreeble.ts`) + dead `ARCHETYPE_EXTRACTABLES` + the inert `colliderHint` ItemDef field (4 files); recorded the campaign perf baseline.
- **Verify:** `verify:all` PASS — tsc clean · `verify:placement` 0/0 ×5 seeds (panel counts unchanged → live path intact) · `verify:colliders` 0/25. perf-probe **drawCalls 843** (≈842 baseline → inert) / programs 71 / sceneMeshes 8401 / boot 1225ms.
- **Visual iteration:** N/A — pure dead-code removal (no visual output; the adversarial appearance gate is not applicable).
- **Spend:** ~100K approx (no budget ceiling; cycle **1/12**).
- **Commit:** `7f06022`.
- **Next (cycle 2):** the remaining M1 units — `remove-wreck-sand-mounds` → `scrap-pickup-3q-thin` → `dish-collider-feel` (the visual/feel ones) → then M2. **Verdict: CONTINUE** (M1 in progress; no milestone crossed → no pause).

---

## Cycle 2 — M1 remove wreck sand-mounds (2026-06-18) — SHIPPED
- **Planned:** `remove-wreck-sand-mounds` (user directive) — wrecks sit on bare terrain, no sand-drift mounds.
- **Shipped:** removed the `makeSandMound` drifts from poiAssembler (composite POIs) / procgenWreck (legacy ships) / megaWreck (hero) via a **determinism-preserving no-op** (kept each call's rand draws, discarded the mesh) → seeded stream byte-identical. Supersedes the §G sand-integration items.
- **Verify:** `verify:all` PASS — tsc · `verify:placement` **0 fails ×5** (seed-42 79→80: a panel the drift used to occlude in the yard-prune is now exposed — intended, still 0-fail) · `verify:colliders` 0/25.
- **Visual iteration:** appearance-verified — **adversarial visual gate PASS** (3 harsh-lens critics + a code-auditor over satellite/tank/husk/derelict side renders; **0 sev≥2**; all read grounded on bare sand via seatSink/burySink). Seating FEEL → **feel-pending** Phase-A walk-test.
- **Spend:** ~170K approx (incl. the rig-shot renders + the visual-gate workflow); campaign total ~270K; cycle **2/12**.
- **Commit:** `e5ea971`.
- **Next (cycle 3):** M1's last 2 units — `scrap-pickup-3q-thin` → `dish-collider-feel` → then **M1 complete** → M2. **Verdict: CONTINUE** (M1 in progress; no milestone crossed).

---

## Cycle 3 — M1 scrap pickup edge-on mass (2026-06-18) — SHIPPED
- **Planned:** `scrap-pickup-3q-thin` (§G) — the torn-sheet scrap read paper-thin at a 3q/edge-on angle.
- **Shipped:** `scrapMesh.ts` (shared held + world) — plate thickness 6→14mm + a fuller rolled torn edge → edge-on MASS, no new pieces (no busy-pile regression). Round-1 fix held.
- **Verify:** `verify:all` PASS — tsc · placement 0/0 ×5 · colliders 0/25.
- **Visual iteration:** appearance-verified — **adversarial visual gate PASS** (3 harsh-lens critics on 3q/front/left renders; **0 sev≥2**; edge-on now reads with real plate mass, stays one clean torn sheet). 1 sev3 nit (curl slightly fin-ward) deferred. In-hand FEEL → **feel-pending** Phase-A walk-test.
- **Spend:** ~150K approx (rig-shots + visual-gate workflow); campaign total ~420K; cycle **3/12**.
- **Commit:** `5514fd6`.
- **Next (cycle 4):** M1's LAST unit — `dish-collider-feel` → then **M1 COMPLETE** → M2. **Verdict: CONTINUE** (M1 in progress; no milestone crossed).

---

## Cycle 4 — M1 dish collider disc — M1 COMPLETE (2026-06-18) — SHIPPED
- **Planned:** `dish-collider-feel` (§E/§G) — the flagship satelliteDish slab collider over-blocked the round dish at the diagonals.
- **Shipped:** `satelliteDish.ts` — replaced the square slab box with a `makeStaticCylinder` DISC (radius `DISH_R`, half-height `DISH_DEPTH*0.5+0.3`) at the dishPivot's exact world transform → the disc IS the round dish, no diagonal corners.
- **Verify:** `verify:all` PASS — tsc · placement 0/0 ×5 · colliders 0/25.
- **Visual iteration:** N/A — collider-only change (no appearance). Collision FEEL (does it still snag?) → **feel-pending** Phase-A walk-test.
- **Spend:** ~90K approx; campaign total ~510K; cycle **4/12**.
- **Commit:** `cbe861c`.
- **✓ MILESTONE M1 COMPLETE (C1-C4):** panel-deadcode + perf-baseline · sand-mounds · scrap-3q · dish-disc. **Verdict: CONTINUE** — M1 is NOT the last tier before the Phase-A `### Milestone:` marker (M2-M5b remain), so phase-level review does NOT pause here. Next: **M2** (cycle 5: feature-flags-infra → security-review → wreck-polish-bundle → yard-cross-poi-merge last/careful).

---

## Cycle 5 — M2 feature-flags infra (2026-06-18) — SHIPPED
- **Planned:** `feature-flags-infra` — the dependency-enabler the M9 gate-and-wait rope/cloth cycles need; land it early + inert.
- **Shipped:** NEW `src/config/features.ts` (sibling of tuning.ts) — `FEATURES` const (`realRope`/`realCloth`, default FALSE) + `FeatureFlag` type. Documents the gate-and-wait pattern. Inert (nothing reads it yet — intentional).
- **Verify:** `verify:all` PASS — tsc · placement 0/0 ×5 · colliders 0/25.
- **Visual iteration:** N/A — inert config scaffold (no appearance/feel).
- **Spend:** ~50K approx; campaign total ~560K; cycle **5/12**.
- **Commit:** `5d1c22e`.
- **Next (cycle 6):** M2 `security-review-repo` (a client-side-game security audit — secrets/DOM/npm-audit/hygiene; likely a documented all-clear). Then wreck-polish-bundle, then yard-merge (last/careful). **Verdict: CONTINUE** (M2 1/4; no milestone crossed).

---

## Cycle 6 — M2 security review (2026-06-18) — SHIPPED
- **Planned:** `security-review-repo` — audit the repo for vulns / leaked secrets.
- **Shipped:** an all-clear audit (client-side game, narrow surface) — 0 secrets, 0 unsafe DOM/injection sinks, clean repo hygiene — + **remediated the 1 HIGH npm-audit vuln** (vite 8.0.12 → 8.0.16 dev-server fix; 0 vulns after). Findings logged to backlog §E.
- **Verify:** `verify:all` PASS — tsc · placement 0/0 ×5 · colliders 0/25. `npm audit` 0 vulns (was 1 high). Vite-boot smoke-test PASS (perf-probe; drawCalls 841 / programs 71).
- **Visual iteration:** N/A — security audit + dependency patch (no appearance/feel).
- **Spend:** ~80K approx; campaign total ~640K; cycle **6/12**.
- **Commit:** `27d03b6`.
- **Next (cycle 7):** M2 `wreck-polish-bundle` (the §F/§G sev-2/3 visual set — likely multi-cycle, ship `[partial]`), then `yard-cross-poi-merge` (last/careful). **Verdict: CONTINUE** (M2 2/4; no milestone crossed). **Halfway to the 12-cap** — the calibration stop lands mid-Phase-A.

---

## Cycle 7 — M2 wreck-polish delta 1: non-axial dorsal mass `[partial]` (2026-06-18) — SHIPPED
- **Planned:** `wreck-polish-bundle` delta 1 of 5 — break the heavy-class "sausage" silhouette (§F/§G).
- **Shipped:** NEW `addDorsalMass` (procgenWreck.ts) — a dorsal bridge-tower superstructure (tower + cap + offset deckhouse + window strip + twin masts) rising mid-hull on mega_freighter/bulk_hauler/freighter. hash2-only (zero rand), decoration-tagged, shared mats, rule-7.
- **Verify:** `verify:all` PASS — tsc · placement 0/0 ×5 (determinism preserved) · colliders 0/25.
- **Visual iteration:** **iterated 5 ROUNDS** (rule-8, new visual element) — adversarial gate PASS (3 critics, 0 sev≥2; sausage broken on all 3 heavy classes). Convergence: R1 freighter end-cap → R2 mega+freighter sliver → R3 bulk squat → R4 freighter short → R5 PASS (mid-hull seat · height off wreck-bulk · vertical-capped base · tall masts). In-world feel → **feel-pending** Phase-A walk-test.
- **Spend:** ~290K approx (the costliest cycle — 5 visual-gate rounds); campaign total ~930K; cycle **7/12**.
- **Commit:** `9a49532`.
- **`wreck-polish-bundle` is `[partial]`** — 4 deltas remain (chroma, engine-droop, scout-trauma, scale-anchor pocket). **Next (cycle 8):** delta 2 = weathering chroma. **Verdict: CONTINUE** (M2 in progress; no milestone crossed). **Cap heads-up: 5 cycles left** to the calibration stop.

---

## Cycle 8 — M2 wreck-polish: chroma (already-done) + delta 3 engine-droop `[partial]` (2026-06-18) — SHIPPED
- **Planned:** wreck-polish delta 2 (weathering chroma).
- **Shipped:** **delta 2 chroma → assessed ALREADY-DONE** (the `HULL_WEATHERING_ACAY` profile already has saturated orange oxide + lifted seam-rust + rust drips; ACBB D234 finalized it post-§F; up-close render confirms) → no re-do; **pivoted to delta 3 engine-droop** — sign-randomized + widened (6-21°) + ~15% torn (dramatic hang), hash2-only (zero rand), pure rotation (no overlap).
- **Verify:** `verify:all` PASS — tsc · placement 0/0 ×5 (determinism preserved) · colliders 0/25.
- **Visual iteration:** delta-3 **solo-triage** (the skill's lighter pass for a routine geometry tuning) — 3-seed gunship inspection shows varied torn-loose engines, believable, no float/clip. Torn FEEL → **feel-pending** walk-test. delta-2 chroma not rebuilt (verified already-done — like the dish/scrap items).
- **Spend:** ~130K approx; campaign total ~1.06M; cycle **8/12**.
- **Commit:** `f4535c8`.
- **`wreck-polish-bundle` stays `[partial]`** — deltas 4 (scout/corvette trauma) + 5 (scale-anchor pocket) remain. **Next (cycle 9):** delta 4. **Verdict: CONTINUE** (M2 in progress; no milestone crossed). **Cap: 4 cycles left.**

---

## Cycle 9 — M2 wreck-polish delta 4: guaranteed corvette/gunship trauma `[partial]` (2026-06-18) — SHIPPED (read-polish flagged)
- **Planned:** wreck-polish delta 4 (scout/corvette guaranteed visible trauma).
- **Shipped:** new `addForcedTrauma` — ONE deterministic breach on every **corvette + gunship**: an unlit black-void **gash** (reads as a hole, not a lit dark greeble) + a peeled hull-plate **flap** + a jagged **lip** strut. **hash2-only → ZERO rand** (panel stream byte-identical); added before panels (no panel welds over the hole); `isWreckDecoration`-tagged. The §F "list" was already in-world (`poiAssembler` `arch.params.list` × phash). **Caught in tsc:** `'scout'` is NOT a `ProcgenWreckClass` (rig-shot fallback) → retargeted to corvette + gunship.
- **Verify:** `verify:all` PASS — tsc · placement 0/0 ×5 (determinism preserved) · colliders 0/25.
- **Visual iteration:** ⚠ **appearance-verified MODEST (4 rounds) — honest read-flag.** Trauma is guaranteed + determinism-safe + believable crash damage from the gash flank (player circles in-world → guaranteed-seen), but it's **flank-located** + on some seeds reads as **scattered debris near the wreck** rather than a clean attached **main-hull** breach (part-pick takes any ≥0.7 body part). The all-angle silhouette-break attempt (round 2) read as detached debris + was reverted. **Attachment + main-hull-targeting polish → backlog §F; read + feel → walk-test.** Not a clean dramatic PASS — flagged for the milestone polish review.
- **Spend:** ~230K approx (4 trauma-read rounds + a tsc class-name fix + extra gate runs); campaign total ~1.29M; cycle **9/12**.
- **Commit:** `4bca3b4`.
- **`wreck-polish-bundle` stays `[partial]`** — delta 5 (scale-anchor exclusion pocket) remains, then `yard-cross-poi-merge`. **Next (cycle 10):** delta 5. **Verdict: CONTINUE** (M2 in progress; no milestone crossed). **Cap: 3 cycles left — the cap will likely land at delta 5 + the start of yard-merge.**

---

## Cycle 10 — M2 wreck-polish delta 5 + C9 trauma read-polish → wreck-polish-bundle COMPLETE (2026-06-18) — SHIPPED ⚡ULTRACODE
- **Planned:** delta 5 (scale-anchor exclusion pocket) + (ultracode) a real fix for the flagged C9 trauma read.
- **Shipped:** **wreck-polish-bundle is now COMPLETE (5/5 deltas).**
  - **C9 trauma read-polish — the adversarial gate FOUND A ROOT-CAUSE BUG.** A 3-round Workflow gate's code-auditor (reading the geometry SOURCE, not just the renders) diagnosed that `addForcedTrauma` placed elements as if local `y=0` were the hull axis — but every hull variant seats the body centre at `y≈r*0.55` (crown `≈r*1.55`; `y=0` is the underside burial sinks), so the roof/flap floated ~0.5m off the hull = the "scattered debris" read. (Also disambiguated: that read was partly the INTENDED `addDebrisFan` — sand fragments are a feature, mis-attributed in C9.) Rewrote to the real frame + depth cues (scorch ring + 2 jagged sub-voids) + welded flap + tiny-wreck flap-skip + largest-mass part-pick. **Dropped the dorsal roof** (floated on the domed corvette across all 3 rounds — the `r*1.55` estimate overshoots it); the flank breach now reads as a strong ATTACHED hole, gate-confirmed.
  - **delta 5 scale-anchor exclusion pocket:** determinism-safe scene-graph filter removes greebles inside the anchor footprint on the lee flank (zero rand, collider-exempt).
- **Verify:** `verify:all` PASS — tsc · placement 0/0 ×5 · colliders 0/25 (determinism held across the rewrite + 3 gate rounds).
- **Visual iteration:** iterated **3 adversarial Workflow gate rounds** (multi-critic + code-auditor). R1 FAIL→found the bug; R2 FAIL→fix confirmed landed, 1 residual sev2 (roof float); R3 FAIL→roof still floating→DROPPED. Final: flank breach gate-confirmed attached on every angle; residual sev1 (gunship side-void contrast) → backlog. **The gate earned its keep — a code-only change would have shipped the coordinate bug.** FEEL → feel-pending walk-test.
- **Spend:** ~600K approx (BY FAR the costliest cycle — ultracode: 3 gate rounds ≈458K subagent tokens + a full rewrite); campaign total ~1.89M; cycle **10/12**.
- **Commit:** `89d63d4`.
- **M2 status:** wreck-polish-bundle ✓ COMPLETE; **`yard-cross-poi-merge` is the last M2 unit. Next (cycle 11):** yard-merge (HIGH-RISK, D237/D239). **Verdict: CONTINUE** (M2 in progress; no Phase boundary). **Cap: 2 cycles left.** ⚠ Per-cycle spend rose ~2-4× under ultracode — flag at the cap review.

---

## Cycle 11 — M2 yard-cross-poi-merge: 3rd attempt DEFERRED to a perf session after a recon (2026-06-18) — DEFERRED ⚡ULTRACODE
- **Planned:** the last M2 unit `yard-cross-poi-merge` (HIGH-RISK, twice-reverted — D237/D239).
- **Shipped:** an informed **DEFER decision (D240)**, not code. Per the D239 revert-on-2×-fail guardrail + ultracode, ran a **3-agent Workflow recon (~205K)** mapping the merge path, the bury-audit, and the D237/D239 history BEFORE a risky 3rd attempt. Findings: (1) **marginal value** — live `wreck-yard` probe = **1705** draw calls (field **842**), both playable, dense yard frustum-culled; (2) the panel **already self-merges** its static parts at gen — only the rim frame is foldable, and folding it is what regressed the audit; (3) D239's terrain-audit regression mechanism is **still un-pinned**. → DEFER to a dedicated perf session that can make the architectural change (cache `panelDoorExtents`-world + audit the cache, or instance the salvage components). D240 + backlog document the exact next-session order (instrument the perturbation FIRST).
- **Verify:** no source change (docs-only) → `src/` byte-identical to C10's `verify:all` PASS; tsc re-confirmed clean.
- **Visual iteration:** N/A — a recon + decision cycle (no player-facing content). Honest note: low game-value cycle, but justified — the recon de-risks a future clean attempt + prevented a 3rd wasteful failed try on a marginal-value perf item.
- **Spend:** ~300K (the recon); campaign total ~2.19M; cycle **11/12**.
- **Commit:** `725524c`.
- **M2 status:** ✓ **CONTENT COMPLETE** (feature-flags + security + wreck-polish-bundle, C5-C10); yard-merge deferred. **Next (cycle 12, THE CAP):** M3 `worm-model-overhaul`. **Verdict: CONTINUE** (no Phase boundary). **Cap: 1 cycle left → cycle 12 self-halts `completed (max-cycles)` for the calibration review.**

---

## Cycle 12 (THE CAP) — M3 START: worm-model rig-shot + maw fang overhaul (2026-06-18) — SHIPPED `[partial]` ⚡ULTRACODE → 🏁 COMPLETED (max-cycles)
- **Planned:** start M3 with `worm-model-overhaul` (one bounded unit before the cap).
- **Shipped (M3 STARTED `[partial]`):** (1) a **NEW `worm-model` rig-shot scenario** (`--angle=head|side|3q`) that surfaces + frames the sand worm — the M3 hero-creature enabler, so the resume can render+gate the worm (zero game-code touch); (2) a **maw FANG overhaul** — the teeth were 0.7m cones (invisible dots on the ~12m maw) → real ~2-2.4m interleaved fangs in two recessed rings.
- **Verify:** `verify:all` PASS — tsc · placement 0/0 ×5 · colliders 0/25 (the worm is a creature, not a placement/collider-audited POI; tsc is the relevant gate).
- **Visual iteration:** lean adversarial Workflow gate (2 critics) — "a massive improvement, awe not silly, proportion correct"; caught one sev2 (top-rim fangs crossing the lit rim band), **fixed in 1 round** (recess the ring inside the rim + radius pull-in + tip inward); re-render confirms a clean recessed toothed gullet. Residual sev1 (top-fang angle, near-side depth) + the FULL-BODY awe overhaul → resume (Rule 8: hero creature = 5-8 rounds). FEEL → feel-pending walk-test.
- **Spend:** ~400K (worm investigation + the rig-shot scenario + the gate); campaign total ~2.59M; cycle **12/12**.
- **Commit:** `96459a6`.
- **🏁 VERDICT: STOP — `completed (max-cycles)`.** `cycles_completed = 12 = max_cycles` → TERMINAL. The campaign self-halted at the calibration cap. **NOT a pause — do not `/campaign-approve`.** Review (see `next-session-prompt.md`: ultracode on/off, owed walk-tests, resume cap), then **`/campaign-start --resume --max-cycles=<N>`** to continue at M3.

---

## 🏁 CAMPAIGN SUMMARY — `campaign/2026-06-18` (12 cycles, ~2.59M, COMPLETED at the cap)
- **M1 ✓** (C1-C4) · **M2 content ✓** (C5-C11; yard-merge deferred D240) · **M3 ◐ started** (C12 `[partial]`).
- **Per-cycle commits** on `campaign/2026-06-18` (one revertible commit each). **Phase A (M3-M5b) + Phase B (M6-M10) remain** for the resume.
- **Cost calibration:** C1-C8 50-290K; **ultracode (C9-C12) ~300-600K** — bought a root-cause bug catch (C10) + a saved failed-attempt (C11), pricey on routine. **User decides ultracode posture for the resume.**
- **Notable engineering:** C10 adversarial code-auditor found a hull coordinate-frame bug solo iteration missed; C11 recon prevented a 3rd yard-merge failure; the determinism law (placement 0/0) held every cycle.
- **Owed:** an attended `npm run dev` walk-test pass (FEEL — wrecks/scrap/dish/engine/breach/worm); the deferred yard-merge perf session; the worm full-body overhaul.

---

# ▶️ RESUMED 2026-06-19 (overnight, ULTRACODE max-quality) — cap 12→50, status active

## Cycle 13 — M3 worm dorsal-armor overhaul → worm-model-overhaul COMPLETE (2026-06-19) — SHIPPED ⚡ULTRACODE
- **Planned:** finish `worm-model-overhaul` — the full-body awe pass (the side silhouette was a uniform ribbed tube).
- **Shipped:** **worm-model-overhaul is COMPLETE.** Added 13 overlapping keeled **dorsal armor scutes** along the spine (`sandWorm.ts` makeWormMesh) → an ancient ARMORED leviathan silhouette (awe-not-horror). Hand-model, no rand; color `0x46382a` (gate-praised).
- **Verify:** `verify:all` PASS — tsc · placement 0/0 ×5 · colliders 0/25 (the worm is a creature, not a placement/collider-audited POI).
- **Visual iteration:** **3 adversarial Workflow gate rounds** (hero element, Rule 8). R1 cohesion FAIL (gappy sawtooth pyramids → stegosaurus); R2 lower+broaden+overlap (broadside ok, 3q still sawtooth apex); R3 **flat-topped frustum** (`CylinderGeometry(0.42,1,1,4)`) + stronger overlap → 3q V-notches filled into one continuous rolled armored crest → **final gate PASS** (sawtooth resolved). Residual sev3 (crest contrast / head-beef) → backlog. FEEL → feel-pending walk-test.
- **Spend:** ~320K (3 gate rounds); campaign total ~2.91M; cycle **13/50**.
- **Commit:** `ee78dc9`.
- **M3:** worm-model-overhaul ✓ COMPLETE. **Next (cycle 14):** `worm-tail-buried`. **Verdict: CONTINUE** (M3 in progress; no Phase boundary).

## Cycle 14 — M3 worm-tail-buried (Dune emergence read) (2026-06-19) — SHIPPED ⚡ULTRACODE · feel-pending
- **Planned:** `worm-tail-buried` — the tail stays buried during surface arcs (emerging-from-earth read).
- **Shipped:** a **tail-sink** in `applyBodyBend` (`sandWorm.ts`) — when the body arcs above the sand, the REAR segments ramp DOWN to ~1.2 radii below the surface (quadratic rear ramp; head/front arch + the bite-arc untouched; auto-scales to arc height). The worm now ERUPTS from the earth instead of floating as a tube. Added a faithful `worm-model --angle=arc` static lunge-pose render for gating.
- **Verify:** `verify:all` PASS — tsc · placement 0/0 ×5 · colliders 0/25 (worm pose code, not a placement/collider POI).
- **Visual iteration:** lean adversarial gate (2 critics) on the arc-pose render — both verdict-PASS + `tail_buried=true` ("rear dives into the sand, armor follows the bend cohesively, no defects"); 1 sev2 (dive shallow) fixed in 1 round (bury margin 0.5→1.2 radii); re-render confirms a deep plunge. Residual sev1 (front-hump height, tail-entry sand spray) → **FEEL feel-pending walk-test** (the breach MOTION is the real test).
- **Spend:** ~210K (feel unit, lighter than the hero-model cycles); campaign total ~3.12M; cycle **14/50**.
- **Commit:** `588ee60`.
- **M3:** model ✓ · tail-buried ✓. **Next (cycle 15):** `worm-charge-dive`. **Verdict: CONTINUE** (M3 in progress; no Phase boundary).

## Cycle 15 — M3 worm-charge-dive (submerged armored back-ridge tell) (2026-06-19) — SHIPPED ⚡ULTRACODE · feel-pending
- **Planned:** `worm-charge-dive` — strengthen the underground charge tell.
- **Shipped:** the charge now rides LOWER (`basePos.y = groundY − MAX_RADIUS·SANDWORM_CHARGE_SUBMERGE`, new tuning 0.42) so only the **armored back-ridge** (the C13 crest) breaks the surface — a Dune submerged-tracking tell, the lunge being the full reveal. A charge `chargeDip` in `applyBodyBend` tapers the rear into the dune. Added `worm-model --angle=charge`.
- **Verify:** `verify:all` PASS — tsc · placement 0/0 ×5 · colliders 0/25 (worm behavior, not a placement/collider POI).
- **Visual iteration:** lean adversarial gate (2 critics) on the charge-pose render — both verdict-PASS + `submerged_read=true` ("a credible sandworm-back racing through the dune, not a worm on top; geometry sound"); 1 sev2 (rear flat cut-off face) fixed in 1 round (the chargeDip rear-taper). Residual sev1 (displaced sand-bank, crest tonal separation) → backlog. **SOUND/MOTION** (charge timing + wake puffs) → feel-pending walk-test.
- **Spend:** ~190K (feel unit); campaign total ~3.31M; cycle **15/50**.
- **Commit:** `760dd81`.
- **M3:** model ✓ · tail ✓ · charge ✓. **Next (cycle 16):** `worm-audio-rumble` (AUDIO — no visual gate). **Verdict: CONTINUE** (M3 in progress; no Phase boundary).

## Cycle 16 — M3 worm-audio-rumble (sustained sub-bass charge approach) (2026-06-19) — SHIPPED ⚡ULTRACODE · sound feel-pending
- **Planned:** `worm-audio-rumble` — a low approach rumble during the underground charge.
- **Shipped:** a NEW sustained **sub-bass rumble** (`audio.ts` start/setLevel/stopWormRumble — detuned low sines + lowpassed looping noise under a tremolo LFO, via `_sfx`) wired to the charge: starts on `enterCharging`, ramps with proximity, stops on abort/lunge/death; main.ts stops it on pause. Pairs with C15's back-ridge.
- **Verify:** `verify:all` PASS — tsc · placement 0/0 ×5 · colliders 0/25 (audio/behavior, not a placement/collider POI).
- **Visual iteration:** N/A — **AUDIO unit, no visual gate.** Gated by a **code-auditor** review of the Web Audio graph (ultracode): R1 FAIL — **3 real sev2 node-lifecycle bugs** (LFO not detached before the fade → tail clicks; `stop()` never `disconnect()`'d → stale graph branches across charges; paused-mid-charge orphaned the rumble). Fixed in 1 round → R2 **PASS** ("no leaks, no clicks, no negative-gain, all charge exits covered"). **SOUND** quality → feel-pending walk-test.
- **Spend:** ~190K (audio unit, 2 code-auditor rounds); campaign total ~3.50M; cycle **16/50**.
- **Commit:** `a248d9c`.
- **M3:** model ✓ · tail ✓ · charge ✓ · audio ✓. **Next (cycle 17):** `multi-worm-population`. **Verdict: CONTINUE** (M3 in progress; no Phase boundary). *(The code-auditor gate on an audio unit caught 3 sev2 node-lifecycle bugs a tsc-only check would have shipped.)*

## Cycle 17 — M3 multi-worm-population (infra pre-existing) + the multi-worm rumble fix (2026-06-19) — SHIPPED ⚡ULTRACODE
- **Planned:** `multi-worm-population` — several roaming worms.
- **Shipped:** **the population infra was ALREADY BUILT** (ACE Tier 2 — `SANDWORM_COUNT=2`, rejection-sampled with `SANDWORM_MIN_SEPARATION`, per-biome, multi-worm tremor selection, save/load) — verified, not rebuilt (like chroma/dish). **The genuine gap (the C16 audio-audit follow-up):** the C16 approach rumble was a single global handle wired PER-WORM → broke with 2 worms. **Fixed** with a global `applyWormRumble` pass (mirrors `applyClosestTremorEffect`) driving the one rumble from the NEAREST CHARGING worm; removed all the C16 per-worm calls.
- **Verify:** `verify:all` PASS — tsc · placement 0/0 ×5 · colliders 0/25.
- **Visual iteration:** N/A — logic/audio refactor. **Code-auditor gate PASS** (ultracode): "nearest-selection correct, stops on no-charge, pause-safe, idempotent, all per-worm calls correctly removed." Encounter balance (the worm count) → feel-pending walk-test; `SANDWORM_COUNT` is a documented tunable (bumping draws `scatterRand` → determinism re-check).
- **Spend:** ~150K (mostly-done unit + a focused refactor); campaign total ~3.65M; cycle **17/50**.
- **Commit:** `22822d2`.
- **M3:** model ✓ · tail ✓ · charge ✓ · audio ✓ · multi-worm ✓. **Next (cycle 18):** `sarlacc-lure-ambush` (the user-requested add — LAST M3 unit). **Verdict: CONTINUE** (M3 in progress; no Phase boundary).

## Cycle 18 — M3 sarlacc-lure-ambush (the user-requested worm LURE) → M3 COMPLETE (2026-06-19) — SHIPPED ⚡ULTRACODE · 4 model rounds · feel-pending
- **Planned:** `sarlacc-lure-ambush` — the user's explicit add: a deliberate bait/lure the player places to draw the worm. Design-first (net-new).
- **Shipped:** a NEW craftable consumable **`worm_lure`** the player **plants ~4m ahead** (`items.ts onUse` → `spawnDroppedPickup` at the camera-forward XZ; static, recoverable until consumed). The worm homes on it via the EXISTING `findNearbyMeat` (the lure joins `meatItems`) at a **long scent range** — new `Tuning.SANDWORM_LURE_DETECT_RADIUS_M=70` vs meat's 30 — then surfaces to feed (the 2×-damage strike window) + consumes it. **Minimal design** (a 3-agent recon picked it over a ~625-LOC deployable device): reuses pickups + feeding + the pickup save → **no save bump.** Hooks: `types.ts` ItemId · `tuning.ts` radius · `sandWorm.ts findNearbyMeat` (per-item detect radius) · `items.ts` def (+ a runtime-only circular import for `spawnDroppedPickup`, init-safe — confirmed by a clean perf-probe boot) · `main.ts` dev-start ×2 (a craft recipe is a follow-up).
- **Verify:** `verify:all` PASS — tsc · placement 0/0 ×5 · colliders 0/25 (the lure is a held item + pickup, not a placement/collider POI).
- **Visual iteration:** adversarial Workflow gate on the lure MODEL, **4 rounds** (held item). R1 FAIL (bright cherry-red gland reads cartoonish vs the muted palette) → R2 desaturated oxblood + lumpy/clotted + a bigger bone crown (1/2) → R3 rounded gland (was a faceted peak/roof) + a clean up-and-out THICK barb ring (rule 7) + collar (1/2) → R4 **removed the emissive** (the glow was the "hot orange-red" the palette critic kept flagging) → a muted dried-blood gland nestled in the pale bone crown. `reads_as_lure=true` **unanimous every round** (geometry sound, no defects). **FEEL** (the summon-and-ambush loop in play + the in-hand model edge-on) → feel-pending Phase-A walk-test.
- **Process note:** a `verify:placement` hang cost time — root cause was MY premature kills of a SLOW-but-fine verify (it runs 5 seeds via `spawnSync` + buffers ALL output to the end), which spawned port-contending zombie node processes. Lesson recorded in `next-session-prompt.md`: don't kill verify; if it hangs, `taskkill //F //IM node.exe` → confirm 0 → one clean run.
- **Spend:** ~300K (3-agent recon + net-new item + 4 model-gate rounds + the zombie recovery); campaign total ~3.95M; cycle **18/50**.
- **Commit:** `9d5576e`.
- **✓ MILESTONE M3 COMPLETE (C12-18):** model · tail-buried · charge-dive · audio-rumble · multi-worm · lure. **Next (cycle 19):** `M4 — Critters + atmosphere` (vulture-motion-feel first). **Verdict: CONTINUE** — M3 done but it is NOT the last tier before the Phase-A `### Milestone:` marker (M4-M5b remain), so the phase-level review does NOT pause here.

## Cycle 19 — M4 START vulture-motion-feel: infra pre-existing, fixed the dangling-leg soar (2026-06-19) — SHIPPED ⚡ULTRACODE · motion feel-pending
- **Planned:** `vulture-motion-feel` — flight/motion FEEL polish (the first M4 unit).
- **Shipped:** the vulture flight system was **ALREADY deeply built** (ACAH model + ACAI flight) — a full FSM (perched/flying/landing/dead + the carcass ecology circling/swooping/carrying/feeding/returning), per-state rig animation, **banking into turns** (`applyFlightOrientation` → roll), **flap↔glide envelopes**, dihedral, landing flare, terrain clearance, gaggle separation. **Verified, not rebuilt** (the recurring multi-worm/chroma/dish pattern). **The genuine gap, found by rendering the FLIGHT poses (only ever gated PERCHED):** in the soaring states the **legs DANGLED + splayed** — the leg-tuck used MIRRORED signs (`legL=-LEG_TUCK, legR=+LEG_TUCK`) so the hips swung the feet *opposite* front-back (a splay, not a tuck) and 1.2 rad only reached horizontal. **Fixed:** both hips rot.z `-VULTURE_LEG_TUCK` (same sign → tuck together) + 1.2→1.85 (back **and** up under the tail); `carrying`/`landing` legs-down untouched.
- **Verify:** `verify:all` PASS — tsc · placement 0/0 ×5 · colliders 0/25 (the vulture is a creature + the change is a render-time pose, not a placement/collider POI or a procgen draw).
- **Visual iteration:** lean adversarial gate (2 critics) on the soaring silhouette (flying+circling side; frozen-flap-phase explicitly disregarded). Both **verdict-PASS**, `legs_tucked=true,true` + `reads_as_soaring_bird=true,true`, no geometry defect introduced. Residual sev1 (the tucked-leg mass is subtle at close-up side-profile — irrelevant at in-game viewing distance where the bird is a distant dark silhouette) → backlog/nit. **MOTION feel** (the animation over time — flap cadence, banking in turns, the wheel over a carcass) → feel-pending Phase-A walk-test (a frozen frame can't judge it).
- **Spend:** ~120K (mostly-done unit: assess + flight-pose renders + one targeted fix + 1 lean gate); campaign total ~4.07M; cycle **19/50**.
- **Commit:** `a0d9f1d`.
- **M4:** ✓ vulture-motion-feel. **Next (cycle 20):** `atmosphere-feeltunes` (tuning of shipped storm/fog/wind systems). **Verdict: CONTINUE** (M4 1/4; no Phase boundary).
