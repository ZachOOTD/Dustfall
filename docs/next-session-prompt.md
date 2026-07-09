# Campaign cycle 2 — Kickoff Brief (Sharpen & Deepen · after cycle 1: M1 shipped, M2 verify-only-done)

**A campaign is ACTIVE** — boot from `docs/campaign/campaign-state.json` + `campaign.md` (the charter holds the ladder + locked constraints + sanctioned pauses). This brief is the cycle-2 hint; the roadmap/charter win on conflict.

## Read these first
1. `CLAUDE.md` (auto-loaded) — campaign status in "Where we are now".
2. `docs/campaign/campaign.md` (charter: ladder + constraints) + `campaign-state.json` + `steering.md` (inbox).
3. `docs/campaign/campaign-log.md` cycle-1 entry — incl. the M2/M3 already-shipped discovery.
4. `docs/backlog.md` — ⚠ verify every candidate against code first (cycle 1 found 3 stale entries; C31/C38 items were already built).

## Cycle 2 focus: M3 — Survival depth
Sun-shade-exposure + the survival curve ALREADY EXIST (C31 + C38 — verified green cycle 1). What M3 actually builds:

1. **Sun-occluder decouple + coverage (C31 follow-up, backlog §"Sun-shade-exposure")** — occluders are coupled to the C28 horizon-silhouette set (only wrecks ≥ `HORIZON_SILHOUETTE_MIN_HEIGHT` 8m), so sub-8m wrecks cast NO shade; only ~3 boxes registered at boot in the probe seed. Decouple the occluder height threshold (own tuning constant), register procgen POIs + large rocks as occluders. Files: `src/world/sunExposure.ts`, registration call sites in world build. Verify: `__game.sunInfo()` occluder count ≫ 3; survival-probe bands unchanged (shade paths still measured); a shade-time-to-death sim case (stand in a wreck's shadow → measurably longer than open sun).
2. **Water-scarcity/exposure (Arc C1 deferred half)** — make open-desert traverse a real WATER decision. Scope judiciously (no save bump without a pause — D81): e.g. thirst drain scales with sun exposure/activity (`survival.ts` reading `sunExposure01`), water-source scarcity tiers by distance from spawn, canteen-sip discipline. NO new items unless truly needed (no-new-pillars constraint). Verify: survival-probe new case(s) (watered vs unwatered traverse deltas); tsc; the existing bands stay within tolerance.

## Gates (every cycle)
`npm run verify:all` + `smoke-intro` + `smoke-pod-tutorial` + `pickup-take-sweep` (NEW, keep green) + `survival-probe`. Ports: rig-shot `--port=52xx` to avoid collisions.

## Constraints (from the charter — do not violate)
No endgame · no tone change · additive-save-only (SAVE_VERSION bump ⇒ PAUSE) · no new content pillars · wind stays muted. The Phase-A feel-pile is EXCLUDED.

## Footguns
- `enterGame(dev)` REBUILDS the player body — read `ctx.player.body` LIVE in harness code (cycle-1 diagnosis; see the `pickup-take-sweep` scenario's comments for the settle/aim idioms).
- rig-shot live scenarios boot THIRD-PERSON by default (`enterLive(page, true)`) — force `ctx.flags.thirdPerson=false` if your scenario needs the FP eye-ray.
- The `__interactionDebug` window flag taps the game ray's raw hits (interaction.ts) — use it before guessing at raycast failures.
- Instanced pickups: `Pickup.inst` set ⇒ `mesh` IS the shared imesh — never scene.remove it; despawn via `despawnPickup` only (D281).

## On stop
Session-end (changelog + CLAUDE.md + campaign log/state + this brief for cycle 3) → one cycle commit on `campaign/2026-07-09` → verdict → ScheduleWakeup if CONTINUE.
