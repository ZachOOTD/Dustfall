# ▶ RESUME — M12 ⓖ sand-worm attack: charge → dive (no high jump) — `campaign/2026-06-18`

**Picking up where C65 left off.** The campaign is ACTIVE in the **Phase-B review-fix pass (M11→M13)**. **M11 COMPLETE** (user-validated). **M12 sand-worm IN PROGRESS:** ✅ ⓕ dorsal ridges removed (C65). Boot from `docs/campaign/campaign-state.json` + `docs/roadmap.md` (NOT chat memory).

## Read these now (in order)
1. `CLAUDE.md` (auto-loaded) — "Where we are now"
2. `docs/campaign/campaign-state.json` — cycle count (65/75), status, current_tier, the framework-upgrade directives in `resume_note`
3. `docs/campaign/campaign-log.md` (tail) — C65 + the full M12 worm-system recon (Cycle 65 entry has the file/line map)
4. `docs/roadmap.md` — the M12 block (line ~178)

## What's already built
The sand worm (`src/enemies/sandWorm.ts`) is a full creature with an attack FSM, audio, multi-worm population, and the `worm_lure` bait. C65 removed the dorsal armor scutes (smoother Dune silhouette). M12 is a FEEL/look REVISION per the user's 2026-06-20 review.

## Cycle 66 focus — M12 ⓖ: attack = charge-straight then DIVE from current position (NO airborne jump) — FEEL-CRITICAL, the DEFINING M12 unit
The user: the current attack reads as a silly "high jump." Replace the high parabolic arc with a charge-straight-then-plunge: the worm charges along the surface toward the player, then dives down from where it is (a downward plunge into the sand), no launch up-and-over.

**This is hero/feel work** → per the framework upgrade, render the worm attack in the PLAYER'S REAL view (the `worm-model` rig poses the REAL `ctx.sandWorms.list[0]` and has `--angle=arc` and `--angle=charge` poses — but those mirror the CURRENT arc; you'll need to update the rig's pose math to match the new dive, or add a `--angle=dive`). Iterate the dive pose build→render→critique to a quality bar (it's the defining motion). ANTI-PUNT: don't leave the high jump behind a flag — replace it.

### The exact code (from the C65 recon — verify line numbers, they shift):
- **`tickLunge()`** (`sandWorm.ts` ~lines 1195–1232) — the current HIGH ARC. The Y-curve is: `baseY = surfaceGroundY*(1-t) + (surfaceGroundY - UNDERGROUND_DEPTH)*t` then `basePos.y = baseY + sin(t·π) * SANDWORM_BREACH_ARC_PEAK`. **The `sin(t·π) * BREACH_ARC_PEAK` term is the high jump — remove/replace it.** For a dive: start at the charge Y (submerged back-ridge exposed, `ground − MAX_RADIUS*CHARGE_SUBMERGE`), then plunge monotonically DOWN to `ground − UNDERGROUND_DEPTH` over the lunge — no rise above ground. Keep the XZ linear interp toward the player (or shorten it — a dive-from-current-pos may not need much XZ travel). Keep the bite damage window.
- **`enterLunge()`** (~lines 1159–1193) — sets `lungeStart`/`lungeEnd`/timing. For dive-from-current-position, `lungeStart` = the current charge basePos; `lungeEnd` = at/just past the player (or the current pos if "dive straight down"). Decide how much forward lunge vs straight-down plunge reads best (realism dial → walk-test).
- **`applyBodyBend()`** (~lines 1560–1594) — the pose. The `bend` arch (`sin(t·π)*2.5`) currently arches the body through the air; for a dive, the front should pitch DOWN into the sand (head-first plunge), tail following. Tune `worm.pitch` (head pitches down on the dive) + the bend so it reads as a head-first dive, not an arch.
- **`SANDWORM_BREACH_ARC_PEAK`** (tuning.ts ~1311 = 20) — the jump height; remove its use or set the dive depth via `SANDWORM_UNDERGROUND_DEPTH`. Add a dive-specific constant if needed.
- Note the **`stationaryBreach`** state (a separate every-Nth vertical breach, `SANDWORM_STATIONARY_BREACH_*`) — the user's "no high jump" likely targets the `lunge` attack; confirm whether the stationary vertical breach should also change (probably keep it — it's a distinct telegraphed attack, not the "jump"). Note the call for the user at the M12 walk-test.

### Acceptance
- The worm no longer launches into a high airborne arc on attack; it charges then plunges head-first down from its position. Verified via the real worm render (the dive pose reads head-first-into-sand, not arching-over). Headless `verify:all` PASS.
- The ATTACK FEEL (timing, does it feel like a menacing ambush dive vs the silly hop) → the user's M12 walk-test. Don't self-certify feel.

## After ⓖ: cycle 67 = M12 ⓗ alert audio
ⓗ — alert audio → a quiet low rumble + screen-shake buildup (mysterious, "you don't know what it is"). The recon map (C65 campaign-log): `playWormRoar()` (audio.ts ~657, the loud one-shot on `enterAlert` ~1033 — make it quiet/subtle or replace with the sustained rumble starting on alert), `startWormRumble()`/`setWormRumbleLevel()` (audio.ts ~717 — the sustained sub-bass, currently starts on charge; start it quietly on ALERT and ramp), `applyTremorEffects()` (sandWorm.ts ~860 — the camera shake; ramp it smoothly during alert→charge as a buildup). AUDIO can't be self-verified → the user LISTENS at the M12 pause. **After ⓗ, the cycle PAUSES at the M12 milestone.**

## Stop / pause
M12 has a milestone pause marker after it (`### Milestone: M12 sand-worm — USER BATCH-VALIDATE`). The cycle that completes ⓗ (all 3 M12 units shipped) PAUSES for the user's worm-attack-FEEL walk-test + alert-rumble LISTEN. **Headroom: 65/75 (~10 left)** — M12 (ⓖ,ⓗ) + M13 (ⓘ,ⓙ) ≈ 4 more cycles, pause at M13 ~cycle 69. If it overruns, STOP at 75 and tell the user.

## Autonomy contract
Autonomous; ambiguous calls → realism-forward + a D-entry + continue, don't ask. Pause only at the M12/M13 milestone markers (feel/audio can't be self-verified). The dive LOOK self-verifies via the real worm render; the dive FEEL + the audio verify at the user pause.

## NOT in the loop (dedicated solo sessions)
The **Skyfall crashed-ship** (new hero wreck + fire-from-wreck) and the **CAVE rework** — `docs/backlog.md` §A. Do NOT start them in the loop.

## Footguns
- **Worm = creature, not a placement POI** → tsc + the real worm render + the FEEL walk-test are the gates; `verify:placement`/`colliders` won't exercise it.
- **Real worm render** = the `worm-model` rig poses the REAL `ctx.sandWorms.list[0]` (not a fake mesh) → valid for a creature; but its `arc`/`charge` pose math mirrors the OLD behavior — update it to match the new dive or the render won't reflect the change.
- **Determinism:** keep worm edits out of the seeded world-scatter path (the worm runtime is decoupled; model/pose/audio edits are safe). No save bump (D81).
- Heavy-scene live screenshots flake (`dustfall_preview_gotchas`) — the `worm-model` rig (its own headless boot) is reliable; serialize it AFTER `verify:all` to avoid port contention.

## Verify protocol
`npm run verify:all` (tsc + placement 0/0 ×5 + colliders 0/40). Worm LOOK: `npm run rig-shot -- --scenario=worm-model --angle=<side|3q|arc|charge|dive>`. The user confirms the dive FEEL + (cycle 67) the alert audio.
