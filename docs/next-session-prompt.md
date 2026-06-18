# Campaign cycle-5 kickoff — `campaign/2026-06-18`

> `/session-end` (focused, per-cycle) rewrote this. The roadmap is authoritative (skill Step 4).

## Boot order (re-read every cycle from FILES)
1. `docs/campaign/campaign-state.json` · 2. `docs/campaign/steering.md` · 3. `docs/roadmap.md` "Up next" (Phase A queue, authoritative) · 4. `docs/iteration-plan.md` "Campaign 2026-06-18 — milestone ladder" · 5. `CLAUDE.md` + `docs/decisions.md` tail.

## ✓ Milestone M1 COMPLETE (cycles C1-C4)
panel-deadcode-cleanup + perf-baseline · remove-wreck-sand-mounds · scrap-pickup-3q-thin · dish-collider-disc.
All gates green; **feel-pending items queued for the Phase-A walk-test** (scrap in-hand 3q · bare-terrain
wreck seating · dish-collider snag-at-diagonals · the curl-fin-ward scrap nit).

## Cycle 5 picks up: **Phase A → M2 — Wreck breadth + polish + infra**
M2 has 4 units. **Recommended order — safe/headless first, the high-risk merge LAST (on its own cycle):**
1. `feature-flags-infra` (S · headless · low) — NEW `src/config/features.ts` (`FEATURES.realRope` et al), flag-OFF.
   Dependency-enabler for the M9 gate-and-wait rope/cloth cycles. Land it early + inert. Pure tsc-verified.
2. `security-review-repo` (M · headless · medium) — audit the public repo for vulns / leaked secrets
   (`/security-review` over the tree). Writes findings to backlog; headless hygiene, no game change.
3. `wreck-polish-bundle` (M · visual-gate · low-med) — the §F/§G sev-2/3 set: one non-axial mass per heavy
   class (dorsal/sponson — breaks the "sausage") · up-close weathering chroma (oxide→orange, seam-rust
   lifted, rust-coloured drips) · engine-droop sign-randomize + ~15% nozzle-detach · scout/corvette
   guaranteed visible trauma · scale-anchor exclusion pocket. **Visual gate REQUIRED** (rig-shot the
   affected archetypes, front-light + length-frame, critique). Likely spans >1 cycle — ship `[partial]`.
4. `yard-cross-poi-merge` (M · headless · **HIGH-RISK**) — **DO LAST, on its own cycle.** The D237/D239
   re-attempt: fold the ~36-38 already-merged yard sub-groups into a handful of draw calls WITHOUT
   perturbing the `panelDoorExtents` bottom-edge measure (that regressed the terrain bury-audit twice).
   Run `pruneBuriedPanels`/`validatePanels` (or snapshot bottom-edge world positions) BEFORE the cross-merge.
   **If it fails the placement/collider audit twice → revert to last-green + re-queue (don't half-ship);
   3-strike → scope-cut per GDD §12 + a D-entry.** The rig-shot `wreck-yard` reports drawCalls for measurement.

After all 4 → **M2 complete** → M3. Phase A pauses for review ONLY at the `### Milestone: Phase A —
Build-out complete` marker (after M5b).

## Autonomy contract
- **`phash`-determinism (D221)** — re-run `verify:placement` + `verify:colliders` after any POI/panel/geometry/
  seating change; rand-preserving approach when removing a non-last `rand` draw (C2 precedent). **Rule 8** —
  visual work iterates (build → screenshot → critique; front-light + length-frame first). **COLLIDER-AUDIT
  (D235)** — procgen structural meshes need a declared collider or an exempt tag; hand POIs are outside it.
  **Save (D81)** — additive only; surface any `SAVE_VERSION` bump, don't auto-bump.
- **Net-new content (M5a/M5b later)** needs a rig-shot framing authored for the visual gate.

## Stop conditions
3 fix-walls on one element (game-verifier → scope-cut GDD §12, D-entry) · a placement/collider regression
you can't clear in 2 tries · a needed `SAVE_VERSION` bump (surface) · destructive-git attempt · per-cycle
spend exhausted (ship `[partial]`).
