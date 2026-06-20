# ▶ CAMPAIGN ACTIVE — Phase B released (cycle 37) — `campaign/2026-06-18`

**Phase B is APPROVED + RELEASED** (2026-06-20). `status:active`, `awaiting_approval:false`, `max_cycles:75`.
Boot each cycle from `docs/campaign/campaign-state.json` + `docs/roadmap.md` "Up next" (the AUTHORITATIVE queue) —
NOT from this file's hints. The loop runs M6→M10 unattended, commits every cycle, and pauses only at
`### Milestone: Phase B — Build-out complete`.

## How we got here
- Phase A (M1–M5b) shipped (cycles 1–36). The user **deferred** the Phase-A walk-test + the 2 `[partial]` looks
  (C28 horizon-landmarks, C36 distant-worm) + the silent day/night + music beds **to backlog** (chose to push
  straight to Phase B). Those remain owed for a later focused pass.
- **D1 "Skyfall"** (a crashing-wreck crash POI = the Phase-B **M7 `crashing-ship-event`**) shipped during the
  pause via `/loop`, OUTSIDE the cycle count — so `cycles_completed` stays 36 and that M7 unit is marked DONE.
  Reuse its patterns: `meteorCrash.ts` (the falling-from-sky FX vocabulary — particleTrail/cameraShake/
  screenFlash/playCrashImpact + the `advanceCrash` headless stepper), the enterable `crash_husk` archetype +
  the collider-audit gate, the additive save (`crashes[]` v15), and `crashHeatAt` (the heat-hazard pattern).

## Phase-B plan + the resolved design calls
Full proposal: **[docs/campaign/proposal-cycle-37.md](campaign/proposal-cycle-37.md)** (APPROVED). The ordered
17-unit ladder is folded into `docs/roadmap.md` "Up next" → Phase B. **User decisions baked in:**
- **M7 INCLUDED** (variety + new POIs + walkable-interiors).
- **Survival = forgiving Long Dark** — flip `GOD_MODE` off for the real new-game; tune the curve in `tuning.ts`
  (prepared player → indefinite; unmanaged → ~8–12 in-game min). This is the M6 KEYSTONE + a hard dep for the HUD work.
- **HUD removal** behind `FEATURES.diegeticSurvival` + a pause-menu opt-in (default-ON; bars stay the floor).
- **FLIP-AUTHORITY = AUTONOMOUS** — the loop MAY flip `FEATURES.*` / kill-switches ON once the headless +
  visual/adversarial gates pass (everything stays behind a reversible flag; the user vetoes FEEL at the Phase-B
  review). **The D81 SAVE-VERSION-BUMP rule still STOPs the loop — never bump autonomously; surface it.**
- Defaults: cave = ONE + walkable ramp + no-horror; hover-bike = repairable-speeder (one vehicle, two states);
  `scrap_machete` = a new item id; crafting collision = `fire_kit` vs a new `signal_kit` (both scrap×2+branch×1);
  drop-pod intro couples to the broken-speeder spawn.

## ▶ Cycle 37 picks up: **M6 unit ① crafting-chooser-colliding-recipe** (S/low)
Lead the block with the guaranteed win: the multi-match crafting chooser UI is already built + verified (dormant
since ACAS B3) — add ONE colliding recipe (`fire_kit` vs a new `signal_kit`, both `scrap×2 + branch×1`) so it
fires in real play. Then ② survival-rebalance (the keystone), ③ flat-color audit, ④ HUD removal, then M7→M10.

Verify gate: `npm run verify:all`. Visual/feel units: the adversarial appearance gate + rule-8 iteration.
Scope-cut order (if the cap tightens) is in the proposal. **Resume the loop with `/loop /campaign-cycle`.**

## Owed (deferred to backlog, for a later focused pass)
The Phase-A FEEL walk-test (`docs/backlog.md` §A lists the per-cycle items) · art-direct the C28 horizon-landmark
+ C36 distant-worm `[partial]` looks · the silent day/night-life + music audio beds.
