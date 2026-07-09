# Post-approval brief — M7 Skyfall S1 (research + exterior blockout)

**⏸ THE CAMPAIGN IS PAUSED at M7 plan-review.** This brief applies AFTER the human runs `/campaign-approve`. If you are booting a `/campaign-cycle` and `campaign-state.json` still shows `status: paused` / `awaiting_approval: true` with `stop_reasons: [plan-review]`, DO NOT build — restate that the plan awaits review and STOP.

## Before starting S1
1. Read `docs/feature-skyfall.md` (the approved plan) end-to-end.
2. Check `docs/campaign/steering.md` — the human may have answered the 4 open questions (placement distance, interior scale, ship archetype, FEATURES flag). Honor their answers; else use the plan's defaults (mid-distance ~200-350m fixed landmark; larger single grand interior 2-3 compartments; broken heavy freighter; behind `FEATURES.skyfall`).

## S1 — Research + exterior blockout (this is ONE cycle, to depth)
1. **Research first** (backlog mandate): `/research-topic crashed sci-fi ship hull silhouettes` or reuse the `megawreck-research` workflow. Goal: a DISTINCT crashed-ship silhouette that is NOT the intro ship and NOT the husk/tank.
2. **Author the exterior** (`src/world/skyfallLandmark.ts`, cloned from `leviathanLandmark.ts`): a new hull via `makeLoftedHull` + a bespoke station/profile generator (model on `shipScene.ts` `hullProfile(z)` 1037-1060; mega-wreck `megaWreck` is the hero-hull precedent). Intro-ship scale or larger (≥17m; the intro ship = cockpit 6×3×5m + a 12m corridor). Crashed pose: terrain height-sink + a crash-list/tilt.
3. **Place it** as a fixed landmark: fixed `LANDMARK_X/Z` (per the human's placement answer), own seeded RNG, static exterior collider(s), `addHorizonSilhouette()`, wire into `main.ts` ~232. Behind `FEATURES.skyfall` if flagged. Interior stays a greybox void this cycle (S2 builds it).
4. **Gate**: verify:all + the 6 rig gates + a NEW/adapted exterior framer rig-shot (multi-angle) + a LIGHT visual pass (does the silhouette read as a unique crashed ship at intro-ship scale?).

## Constraints (unchanged)
No endgame · no tone change · **additive-save-only — a bump is the OTHER sanctioned pause (D81)** · no new pillars beyond this sanctioned hero wreck · wind muted · rule-9 collision discipline (colliders match geometry; real-motion probe, not clearance numbers).

## The pauses ahead
- After S2 (interior + colliders green): ⏸ **post-blockout walk-test** — STOP for the human to walk it before hero-detail.
- Any genuine `SAVE_VERSION` need: ⏸ STOP + surface (not expected — confirmed additive).

## On stop (each S-cycle)
Session-end docs → cycle commit on `campaign/2026-07-09` → verdict → ScheduleWakeup if CONTINUE, or set the pause flags + STOP at a sanctioned pause.
