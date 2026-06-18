# Campaign cycle-4 kickoff — `campaign/2026-06-18`

> `/session-end` (focused, per-cycle) rewrote this. The roadmap is authoritative (skill Step 4).

## Boot order (re-read every cycle from FILES)
1. `docs/campaign/campaign-state.json` · 2. `docs/campaign/steering.md` · 3. `docs/roadmap.md` "Up next" (Phase A queue, authoritative) · 4. `docs/iteration-plan.md` "Campaign 2026-06-18 — milestone ladder" · 5. `CLAUDE.md` + `docs/decisions.md` tail.

## Where C1-C3 left off
- **C1:** `panel-deadcode-cleanup` + `perf-budget-reprofile` (baseline drawCalls 843 / programs 71).
- **C2:** `remove-wreck-sand-mounds` — wrecks on bare terrain (rand-preserving no-op; visual gate PASS).
- **C3:** `scrap-pickup-3q-thin` — `scrapMesh.ts` SHEET_T 6→14mm + fuller rolled edge (visual gate PASS; sev3 fin-ward nit deferred). **M1 now 4 of 5 units.**

## Cycle 4 picks up: **Phase A → M1 — the LAST unit**
`dish-collider-feel` (S · feel-pending). The flagship `satelliteDish` reflector got a slab collider in ACBB
(was walkthrough), but a box approximation may over-block the round dish at the diagonals. **Refine** the
collider shape — a thinner/rotated slab, a flat disc (cylinder), or a tighter convex hull — so the round
face doesn't snag the player at the diagonals.
- File: `src/world/satelliteDish.ts` (the hand POI flagship — OUTSIDE the procgen `verify:colliders` gate per
  D235, so changing it won't trip that audit, but RE-RUN `verify:all` anyway to be safe).
- `verify:colliders` must stay 0-fail. The collider FEEL (does it snag at the diagonals?) is a **walk-test
  judgment** — mark `feel-pending`; the headless gate only confirms coverage, not over-blocking.
- This is feel-pending, so the visual gate is N/A (a collider has no appearance) — just confirm `verify:all`
  green + reason carefully about the shape. Log it `appearance-verified N/A; feel-pending`.

After this → **M1 COMPLETE** (all 5 units) → cycle moves to **M2** (yard-cross-poi-merge — the high-risk
D237/D239 re-attempt; wreck-polish-bundle; feature-flags-infra; security-review). Phase A pauses for review
ONLY at the `### Milestone: Phase A — Build-out complete` marker (after M5b).

## Autonomy contract
- **`phash`-determinism (D221)** — re-run `verify:placement` + `verify:colliders` after any POI/panel/geometry/
  seating change; use a rand-preserving approach when removing a non-last `rand` draw (see C2). **Rule 8** —
  visual work iterates (build → screenshot → critique); a collider change is FEEL not appearance → walk-test.
  **COLLIDER-AUDIT (D235)** — procgen structural meshes need a declared collider or an exempt tag; hand POIs
  (megaShip/satelliteDish/etc.) are outside that gate. **Save (D81)** — additive only; surface any bump.
- **Net-new content (M5a/M5b later)** needs a rig-shot framing authored for the visual gate.

## Stop conditions
3 fix-walls on one element (game-verifier → scope-cut GDD §12, D-entry) · a placement/collider regression
you can't clear in 2 tries · a needed `SAVE_VERSION` bump (surface) · destructive-git attempt · per-cycle
spend exhausted (ship `[partial]`).
