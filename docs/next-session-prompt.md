# Next session — REBUILD v2 COMPLETE + review (overnight 2026-07-01)

The campaign `campaign/escape-pod-intro` is ACTIVE (checkpoint=none, autonomous overnight per the
user's "work through the night"). Everything below is committed + pushed to the branch. **Netlify
is maxed → the preview link won't refresh** (backlog item; verify via `rig-shot.mjs` + gates, which
don't need a deploy). Resume/redirect anytime via `docs/campaign/steering.md`.

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

## ▶ In progress / next (overnight continues)
- **T4.3 — the craft + salvage tutorial** (the original vision's next beat): after you wake + climb out into the dawn desert (R3a stepOut), craft a machete (scrap_machete/D261 exists) + salvage your own crashed pod (the salvage system exists) → the failed parachute comically pops out (the payoff). Being wired now.
- Then the original pre-rework deferred items: Phase-3 hero ship-explosion-through-the-frame, a horizon-hook landmark.

## Cost note
The overnight ran ~5M tokens (R5 + the gates + the vista fix). The adversarial gate is worth it for
the hero opening frame but expensive — scoped tighter for walked-through/flow pieces.
