# ▶ CAMPAIGN cycle 38 — Kickoff Brief — `campaign/2026-06-18`

**Phase B is building unattended (M6→M10).** Boot from `docs/campaign/campaign-state.json` + `docs/roadmap.md` "Up next"
(the AUTHORITATIVE queue) — NOT from this file's hints. The loop commits every cycle and pauses only at
`### Milestone: Phase B — Build-out complete` (after M10). Charter: `docs/campaign/campaign.md`.

## Read these now (in order)
1. `CLAUDE.md` (auto-loaded) — esp. "Where we are now".
2. `docs/campaign/campaign-state.json` + `docs/campaign/steering.md` (your inbox) + `docs/campaign/campaign-log.md` (recent cycles).
3. `docs/roadmap.md` "Up next" → Phase B unit list.
4. `docs/decisions.md` tail (D245 — the C37 recipe-collision call) + `docs/backlog.md` §A.

## What's already built (one paragraph)
Phase A (M1–M5b) shipped: the wreck arc (procgen socket grammar + 5 archetypes + collider-audit gate), the worm + sarlacc + lure,
critters + atmosphere (vultures, storm, smoke plume), riding & rest, the M5a exploration pull (silhouettes/spyglass/vista/sun-shade),
and the M5b tone layer (wordless scenes, procedural wind, fireball, dawn/dusk beats, distant-worm crossing). C37 (Phase B start) lit
up the crafting **chooser** via a new `signal_kit` flare. The survival STATS exist (thirst/hunger/temperature/stamina/health in
`src/stats/survival.ts`, HUD bars in the UI) but the game currently runs with **`GOD_MODE: true`** — the player never actually dies.

## Cycle 38 focus — **M6 ② survival-rebalance-newgame (the KEYSTONE, M/med)**
Make survival REAL + forgiving (Long Dark tone). This is the hard-dep for M6 ④ (HUD removal) and M10's broken-speeder economy.

### Priority items (in order)
1. **Flip the testing flags off for the real new-game** — `src/config/tuning.ts`: `GOD_MODE: true → false` (line ~18; the
   floor path is `survival.ts:117`) and `DEBUG_UNLIMITED_STAMINA: true → false` (line ~20). These are reversible tuning flags; the
   charter authorizes the loop to flip them once gates pass — the USER vetoes FEEL at the Phase-B review. Keep a clear D-entry.
2. **Tune the forgiving Long-Dark curve in `tuning.ts`** — target: a PREPARED player (water + food + fire/shelter managed) survives
   **indefinitely**; a NEGLECTED player dies in **~8–12 in-game minutes**. Levers: `THIRST_DRAIN_PER_SEC` (1/300), `HUNGER_DRAIN_PER_SEC`
   (1/600), `HUNGER_STARVATION_DAMAGE`, `COLD_NIGHT_DRAIN` (1/120), the heat/shelter/shade path (sun-exposure C31 already scales heat),
   restore values (`CANTEEN_THIRST_RESTORE`, food). Make the death SPIRAL gentle (telegraphed, recoverable) not a cliff.
3. **Verify the death→continue loop actually works** with GOD_MODE off — `die()` / the death overlay / `handoffToGame` restore path
   (a real death must show the overlay + let Continue reload the autosave, not soft-lock). This is the highest-risk regression.
4. **Headless probe + walk-test framing** — there's no rig-shot for survival feel; add a deterministic survival probe (advance the
   stat clock N seconds under prepared vs neglected loadouts, assert the time-to-death band) so the curve is gate-checkable. The actual
   FELT pacing is **walk-test-pending** (record `feel-pending` in the cycle log — the user judges it at the Phase-B review).

### Stretch (only if the unit fits the cycle)
- Scope-first scouting of **M6 ③ flat-color-texture-audit** (name the ~6–8 weakest flat-shaded surfaces) so cycle 39 can start fast.

## Autonomy contract
Ambiguous call → pick the realism/forgiveness dial that fits "forgiving Long Dark", log a D-entry, continue — never ask the human.
Flipping `FEATURES.*`/kill-switches/testing-flags ON is AUTHORIZED once the headless + visual/adversarial gates pass (reversible; the
user vetoes FEEL at the Phase-B review). **The D81 SAVE-VERSION-BUMP rule still STOPs the loop — never bump autonomously; surface it.**

## Stop conditions
Terminal: max-cycles (75) · catastrophic verify-baseline break · 3 consecutive fix-walls on one gate · a needed save-version bump
(STOP + surface) · destructive-action attempt (blocked by the overnight guard). Pause: steering "pause" · the Phase-B milestone (after M10).

## Verification protocol
`npm run verify:all` (tsc + `verify:placement` ×5 seeds + `verify:colliders`). Visual/feel units → the adversarial appearance gate +
Rule-8 iteration. For this survival unit: the headless gate + the new survival probe; FELT pacing is the user's Phase-B walk-test.

## Notable footguns
- Survival rebalance is FEEL-critical and headless can't judge it — tune toward the time-to-death BAND, don't blind-chase a number.
- GOD_MODE off exposes the real death path for the first time in a long while — test the overlay + Continue reload carefully (regression risk).
- `verify:placement` buffers output to the END + is slow; don't kill it early or premature `taskkill node.exe` spawns port-contending zombies (C18).

## Begin
Read the order above → `TaskCreate` the priority items → flip the flags → tune the curve → add the survival probe → `verify:all` →
`/session-end`. Boot fresh from FILES; don't trust chat memory.
