# Campaign cycle-3 kickoff — `campaign/2026-06-18`

> `/session-end` (focused, per-cycle) rewrote this. The roadmap is authoritative (skill Step 4).

## Boot order (re-read every cycle from FILES)
1. `docs/campaign/campaign-state.json` · 2. `docs/campaign/steering.md` · 3. `docs/roadmap.md` "Up next" (Phase A queue, authoritative) · 4. `docs/iteration-plan.md` "Campaign 2026-06-18 — milestone ladder" · 5. `CLAUDE.md` + `docs/decisions.md` tail.

## Where C1-C2 left off
- **C1 SHIPPED:** `panel-deadcode-cleanup` + `perf-budget-reprofile` (baseline drawCalls 843 / programs 71).
- **C2 SHIPPED:** `remove-wreck-sand-mounds` — wrecks sit on bare terrain (rand-preserving no-op; verify:all 0/0; visual gate PASS 0 sev≥2). **M1 now 3 of 5 units.**

## Cycle 3 picks up: **Phase A → M1 — remaining 2 units**
1. `scrap-pickup-3q-thin` (S · visual-gate) — rework `src/world/scrapMesh.ts` `buildScrapMesh` so the rusted
   sheet has edge-on MASS at a 3-QUARTER angle without re-introducing the disliked "busy pile". Held + world
   pickups share the builder → one fix covers both. **Visual gate MUST shoot the 3q angle specifically**
   (front already reads fine — that was the prior verification gap). Use the `item-studio` rig-shot scenario.
2. `dish-collider-feel` (S · feel-pending) — refine the flagship `satelliteDish` reflector slab collider
   (thinner/rotated slab, a disc, or a tighter hull) so the round face doesn't snag the player at the
   diagonals. `verify:colliders` MUST stay 0-fail. Mark `feel-pending` — the snag is a walk-test judgment.

After these → **M1 COMPLETE** → cycle moves to **M2** (yard-cross-poi-merge — the high-risk D237/D239
re-attempt; wreck-polish-bundle; feature-flags-infra; security-review). Phase A pauses for review ONLY at
the `### Milestone: Phase A — Build-out complete` marker (after M5b).

## Autonomy contract
- **`phash`-determinism (D221)** — re-run BOTH `verify:placement` + `verify:colliders` after any POI/panel/
  geometry/seating change. A `rand`-consuming change mid-stream desyncs later placement → use a
  rand-preserving approach (see C2: kept the `makeSandMound` call, discarded the mesh) when removing/altering
  a `rand` draw that isn't the LAST in its assembler. **Rule 8** — visual work isn't done at tsc; build →
  screenshot → critique → iterate (front-light + length-frame first). **COLLIDER-AUDIT (D235)** — a new
  structural mesh needs a declared collider or an `auditExempt`/`isWreckDecoration` tag. **Save (D81)** —
  additive only; surface any `SAVE_VERSION` bump, don't auto-bump.
- **Net-new content (M5a/M5b later)** needs a rig-shot framing authored for the visual gate.

## Stop conditions
3 fix-walls on one element (game-verifier → scope-cut GDD §12, D-entry) · a placement/collider regression
you can't clear in 2 tries · a needed `SAVE_VERSION` bump (surface) · destructive-git attempt · per-cycle
spend exhausted (ship `[partial]`).
