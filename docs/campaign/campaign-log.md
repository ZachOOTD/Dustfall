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

**Status:** ⏸ PAUSED at `plan-review` — awaiting `/campaign-approve` of this plan before Cycle 1
(Milestone 1) starts. Build begins on approval + `/loop /campaign-cycle`.
