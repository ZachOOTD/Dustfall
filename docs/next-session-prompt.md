# ⏸ PAUSED — M11→M13 review-fix pass COMPLETE — `campaign/2026-06-18`

**The campaign is paused at the M13 milestone** (`status: paused`, `awaiting_approval: true`, `stop_reasons: ["milestone-review"]`). The entire **M11→M13 review-fix pass is shipped + validated per tier** — there is no more in-loop review-fix work. The next block is the **user's call** (the remaining items are dedicated solo sessions + human-attended work, NOT loop cycles). Boot from `docs/campaign/campaign-state.json` + `docs/roadmap.md` if resuming.

## What the user validates at THIS pause (the final audio LISTEN)
Run `npm run dev` and listen:
- **Gunshots** (C68/D268): each gun has a distinct muzzle report — scrap_gun (ballistic crack+boom), amban_rifle (heavier + sub thump), pulse_rifle (rapid short zappy pew), energy_pistol (meatier charged zap). Reload SFX on scrap_gun + amban (R key). Levers: the synth params in `audio.ts` (`ballisticShot`/`energyShot`/`playReloadGun`).
- **Speeder hum** (C69): a lower, smoother thrum (was a harsh sawtooth whine). Levers: `startSpeederThrust`/`setSpeederThrustSpeed` in `audio.ts` (the triangle osc + lowpass + the 46-90 Hz range).
- (Already approved earlier this pass: M11 wreck/panel fixes; M12 sand-worm — the breach-dive attack + the smoothed dive + the quiet alert rumble/shake.)

## The M11→M13 review-fix pass — what shipped (all from the 2026-06-20 triage)
- **M11 — wreck/panel fixes** ✅ (C61-C64): not-openable panels hide (D264); floating panels seated; tank/husk rib/structure rework (the `makeFormerRings` 0.84× root cause); the 3 mega-wreck companion straggler panels hidden (D265). User-validated.
- **M12 — sand worm** ✅ (C65-C67 + the b7b6a52 dive-smoothing): dorsal ridges removed; attack = breach-and-dive not a high jump (D266) + the natural-bend dive (tail curls under, tip never seen); quiet alert rumble + screen-shake buildup, roar removed from alert (D267). User-approved.
- **M13 — weapon & vehicle audio** ✅ (C68-C69): per-weapon gunshot + reload SFX (D268); lower/smoother speeder hum. ← this pause.

## The next block — USER-SEQUENCED (NOT auto-loop)
`/campaign-approve` does NOT auto-continue here (the planned in-loop work is done). When the user is ready they pick the next thing; these are NOT loop cycles:
- **Skyfall crashed-ship** — a NEW researched extremely-high-quality enterable HERO wreck (its own `/feature-slice`: research → model → iterate WITH the user; no floating pieces / one-sided textures) + its fire-from-the-wreck fix. `docs/backlog.md` §A. **Dedicated solo session.**
- **CAVE rework** — the user is planning the direction. `docs/backlog.md` §A. **Dedicated solo session.**
- **⑯ drop-pod-intro-cutscene** — deferred XL feature; bring back via `/feature-slice` when ready.
- **⑰ pickup-instancing** — measured (75% of draw calls; D263) + planned; build is **human-attended** (a core item-collection-loop rewrite).
- **§A owed walk-tests / flag-flips** — the M9/M10 flag-gated systems (realRope/realCloth/rideableSled/repairableSpeeder), diegetic-HUD, survival curve.
- **Housekeeping:** 1 post-mortem draft pending (`hide-mesh-when-unregistering`, C64) → `/consolidate-shared-memory` whenever convenient.

## Campaign status
- **69/75 cycles** (~6 headroom remain, but the planned roadmap work is complete). If the user wants the loop to do MORE (e.g. self-author a new roadmap from the GDD), that needs an explicit steer — `self_author: propose` would draft a proposal at the next idle cycle, but the user said the next block is dedicated solo sessions, so the loop should stay paused until steered.
- Branch `campaign/2026-06-18`, working tree clean, `verify:all` green. SAVE_VERSION untouched across the whole pass (no D81 bumps).

## Verify protocol
`npm run verify:all` (tsc + placement 0/0 ×5 + colliders 0/40). Audio = the user's LISTEN; visuals = the real in-game view / the rig.
