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
