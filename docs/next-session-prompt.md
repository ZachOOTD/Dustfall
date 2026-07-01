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
