# Next session — the ESCAPE-POD INTRO is FEATURE-COMPLETE (overnight 2026-07-01)

The campaign `campaign/escape-pod-intro` is ACTIVE. Everything is committed + pushed. **Netlify
is maxed → the old preview link won't refresh — use **`npm run preview:intro`** instead (a local
production build with the intro ON, served at http://localhost:4173/ — shipped cycle 48). Or plain
`npm run dev` + `__game.startIntro()`. Resume/redirect anytime via `docs/campaign/steering.md`.

## ⚑ SINCE feature-complete: the USER'S CONSISTENCY RE-SCOPE (2026-07-01, all done + verified)
The user's walk-test steering re-shaped the crash→game handoff (see cycles 41-46 in the campaign
log + the ⚑ section of `docs/architecture-escape-pod-intro.md`):
- **ONE enterable pod** (`unifyEnterablePod`) — no dispose+swap; wake in it, step out beside it,
  walk BACK IN; it persists into the real game. The descent chain is grounded (no vertical jump).
- **Consistent bright MIDDAY** (`setIntroMiddayClear`, dayTime 0.46) — the fall-through sky == the
  step-out sky; wake cabin midday-lit; the crash lean gentled so the floor stays walkable.
- **Genuine CLEAR SKIES** (`INTRO_CLEAR_FOG_DENSITY` 0.00012 pinned across the atmospheric leg +
  a 6s ease-back to survival fog post-handoff) — crisp dunes/horizon; the Leviathan re-valued to
  read at midday (was dawn-tuned).
- Usability finds fixed en route: the seat buckle faced AWAY from the pilot (the 4-round seat-saga
  root cause), the eject-lever prompt aimed at a wall, the checkEngines aft doorway was a black void.
**Next user walk-test should verify:** the in↔out pod continuity in motion, the midday/clear feel,
and the earlier feel items (descent pacing, explosion rhythm, chute-pop spring, audio balance).

## 🎉 EVERY BEAT OF THE VISION IS BUILT
The whole intro flows end-to-end: **orbit** (the cockpit + the beautiful planet vista) → **disaster**
(the corridor, engine fire + red-alert) → **eject** (physically enter the pod-bay + release, no teleport)
→ **watch the SHIP EXPLODE** (Phase-3 — the hauler dies in a fireball through the porthole) → **the
beautiful descent** (the pod physically falls through the real sky) → **the parachute gag** (mid-fall,
3 pulls → snap) → **crash + blackout** → **wake** (in the SAME pod you rode down) → **step out** into
the dawn dunes → **the horizon reveal** (the Beached Leviathan wreck beckons "go there") → **craft a
machete** → **salvage your own pod** → **the failed chute comically pops out**. All behind
`FEATURES.escapePodIntro` (default off); no SAVE_VERSION bump; the live master world untouched.

## WHAT'S LEFT = the user's domain (FEEL + art-direction — not autonomous-buildable)
The overnight loop wound down here because the remaining work genuinely needs YOUR eyes/taste:
- **FEEL walk-tests** (a still/headless can't gate these): the beautiful-descent pacing + the parachute
  gag timing; the ship-explosion ~4.4s rhythm + the cabin flash pulse; the pod-bay climb-in curve + the
  eject shudder; the corridor strobe/fire cadence; the chute-pop FWOOMP→flop spring; whether the eye
  catches the Leviathan during the 4s reveal dwell.
- **Minor art-direction polish** (your call): the fireball white-hot core is a touch large at peak; the
  FP "strapped-in" seat read; whether to promote the Leviathan to always-on (a one-line un-guard in
  main.ts); the seat harness could recede another notch.
- **Deferred (bigger, needs you):** an audio balance/mix LISTEN pass; the CAVE rework + the Skyfall hero
  wreck (separate solo sessions, per CLAUDE.md).

Restarting `/loop /campaign-cycle` from here will do QA/polish passes, but the high-value building is
done — the feature is complete and best advanced by your walk-test + direction.

## ✅ REBUILD v2 (R1–R5) — the whole real-world physical intro — COMPLETE
The v1 intro (offset + faked shaders + 3 teleport-stitched pods) → re-architected into the real world:
- **R1** real orbit sky + the pod physically falling through the real desert.
- **R2** the space scene at hero quality.
- **R3a** ONE consistent pod (wake in + climb out of the same cabin you rode; matching exterior).
- **R4** parachute gag MID-fall + real ~2s blackouts.
- **R5a** cockpit box → worn fuselage (4-gate loop) + rugged/matte hull (your steering) + the seat "tan wedge" root-caused (it was the harness straps).
- **R5b** the corridor fully modelled (freighter passage + real fire/red-alert disaster lighting).
- **R5c** the pod-bay + PHYSICAL enter/eject (dock → walk-up → scripted climb-in → seal → explosive-bolt release → descent; NO teleport).
- **Orbit-vista fix** (`3d271d3`): the cockpit "tan wall" was a BUG — the desert FogExp2 + background were never thinned in space mode, fogging the black dome tan. Fixed at root; the planet reframed as a real Dune-world disc + limb + stars. **Also fixed: the cockpit RIG was lying** (paused before the sky updated at the ship-origin camera → every prior cockpit shot, incl. the adversarial gates, rendered stale/no planet + the tan fog). The rig is now faithful.

## To review (walk-test the whole reworked intro)
`FEATURES.escapePodIntro = true` + new game, OR console `__game.startIntro()` /
`__game.jumpToBeat('cockpit'|'checkEngines'|'corridor'|'enterPod'|'shipExplode'|'descent'|'parachute'|'impact'|'wake'|'stepOut')` / `__game.smokeIntro()`.

## Residuals for YOUR art-direction / feel (not blockers)
- **Look polish** (your domain): the pod-bay visual is greybox-plus; the cockpit could take another polish pass; the planet's left edge is clipped by the window mullion (realistic — held there).
- **FEEL walk-tests** (a still can't judge): the climb-in curve + eject shudder (R5c), the corridor strobe/fire cadence (R5b), the beautiful-descent + parachute gag timing (R4), the seat-read in motion.
- **NOTE on the gates:** the cockpit adversarial gates (R5a) were partly shot on the LYING rig (tan fog, no planet in the window) — the GEOMETRY judgments hold, but the window/sky reads in those gate shots were unreliable; the real opening now reads as a beautiful orbit vista (see `verification/scen-cockpit-forward-space.png`).

## ✅ Also shipped this overnight (beyond the R1–R5 rework)
- **T4.3 — the first tutorial** (`59795bf`): the intro now flows into gameplay — wake + climb out → gather scattered scrap+cloth → craft a machete → salvage your own crashed pod (wired into the existing pry/extract flow) → the failed parachute comically POPS OUT (a procedural canopy + a "sproing"). `__game.smokePodTutorial()` passes all stages; behind the flag, no save bump.
- **Bug-hunt** (`bf07847`): an adversarial 4-reviewer sweep of the night's heavily-changed intro code → essentially CLEAN (one sev-3 dev-only re-scatter bug, fixed). No fog-restore leak, no softlocks, no accumulating leaks in the shipping path.

## ▶ Next (queued — best done WITH your review/direction)
- **Phase-3 — the hero ship explosion through the pod window** (on eject, watch the hauler explode). Deferred because it depends on the **hauler exterior model, which plateaued** earlier (C19) — this is art-direction territory + a known-hard hero visual, so it wants your eye, not another 5am autonomous attempt.
- **Look/feel polish** (your domain): the pod-bay + cockpit visuals, the chute-pop size, and all the FEEL walk-tests (climb-in, eject, descent, corridor).
- A horizon-hook landmark for the desert reveal.
The overnight loop wound down after completing the whole rework + the tutorial + a clean bug-hunt — the remaining work needs your direction. Restart with `/loop /campaign-cycle` or steer via `steering.md` to continue autonomously.

## Cost note
The overnight ran ~5M tokens (R5 + the gates + the vista fix). The adversarial gate is worth it for
the hero opening frame but expensive — scoped tighter for walked-through/flow pieces.
