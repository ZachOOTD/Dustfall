# Campaign cycle-2 kickoff — `campaign/2026-06-18`

> `/session-end` (focused, per-cycle) rewrote this. The roadmap is authoritative (skill Step 4).

## Boot order (re-read every cycle from FILES)
1. `docs/campaign/campaign-state.json` (cycles done, ceilings, status) · 2. `docs/campaign/steering.md` (inbox) ·
3. `docs/roadmap.md` "Up next" (Phase A queue, authoritative) · 4. `docs/iteration-plan.md` "Campaign 2026-06-18 — milestone ladder" (per-unit scope/verify/risk) · 5. `CLAUDE.md` + `docs/decisions.md` tail.

## Where C1 left off
**Cycle 1 SHIPPED (M1, 2/5 units):** `panel-deadcode-cleanup` (removed the dead `buildGreeble` chain + `ARCHETYPE_EXTRACTABLES` + the inert `colliderHint` field) + `perf-budget-reprofile` (baseline: drawCalls 843 / programs 71 / sceneMeshes 8401 / boot 1225ms). All gates green; commit on the campaign branch.

## Cycle 2 picks up: **Phase A → M1 — remaining 3 units** (the visual/feel ones)
Take the top remaining M1 unit. Order suggestion (do ONE, ship; the cycle commits):
1. `remove-wreck-sand-mounds` (M · user directive) — strip the `makeSandMound` drifts banked around wreck
   bases. **Where they're called:** `poiAssembler.ts` (the ACBB `proud`-drift, D236) + any `placeWreck`/
   `wreckYard.ts` mound calls + `procgenWreck.ts`. Remove/gate the calls so wrecks sit on bare terrain.
   Re-run `verify:placement` + `verify:colliders` (mounds were additive sand → removing shouldn't bury
   panels; confirm 0 fails). **Supersedes/drops the §G sand-integration items.** Then the visual gate (the
   wreck silhouette changed) — front-light + length-frame a `procgen-wreck --archetype=` shot, confirm no
   floating/clipping where the drift used to bank.
2. `scrap-pickup-3q-thin` (S · visual-gate) — rework `scrapMesh.ts` `buildScrapMesh` so the rusted sheet has
   edge-on mass at a 3-QUARTER angle without re-introducing the "busy pile". **Critics MUST shoot the 3q
   angle** (front reads fine — that was the prior gap). Held + world share the builder → one fix covers both.
3. `dish-collider-feel` (S · feel-pending) — refine the flagship `satelliteDish` slab collider (thinner/
   rotated slab, disc, or tighter hull) so the round reflector doesn't snag at the diagonals. `verify:colliders`
   must stay 0-fail; mark `feel-pending` (the snag is a walk-test judgment for the Phase-A review).

After these, **M1 is complete** → cycle moves to **M2** (yard-cross-poi-merge — the high-risk D237/D239
re-attempt; wreck-polish-bundle; feature-flags-infra; security-review). Phase A pauses for review only at
the `### Milestone: Phase A — Build-out complete` marker (after M5b).

## Autonomy contract
- **`phash`-determinism (D221)** — re-run BOTH `verify:placement` + `verify:colliders` after any POI/panel/
  geometry/seating change. **Rule 8** — visual work isn't done at tsc; build → screenshot → critique → iterate
  (front-light + length-frame first). **COLLIDER-AUDIT (D235)** — a new structural mesh needs a declared
  collider or an `auditExempt`/`isWreckDecoration` tag. **Save (D81)** — additive only; surface any `SAVE_VERSION` bump, don't auto-bump.
- **Net-new content (M5a/M5b later)** needs a rig-shot framing authored for the visual gate.

## Stop conditions
3 fix-walls on one element (game-verifier → scope-cut GDD §12, D-entry) · a placement/collider regression
you can't clear in 2 tries · a needed `SAVE_VERSION` bump (surface) · destructive-git attempt · per-cycle
spend exhausted (ship `[partial]`).
