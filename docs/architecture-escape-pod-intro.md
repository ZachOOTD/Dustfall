# Escape-pod intro — architecture (as-built)

The first-person crash-landing OPENING (`FEATURES.escapePodIntro`, default OFF). A new
game plays it before handing off to the real desert. Vision: `docs/feature-escape-pod-intro.md`.
This doc is the maintainer's map of the built feature (post-REBUILD-v2, 2026-07-01).

## The beat arc (what the player experiences)
`orbit (cockpit)` → `check engines` → `corridor disaster (fire + red-alert)` → `enter the pod-bay
(physically climb in, no teleport)` → `eject → WATCH THE SHIP EXPLODE` → `the beautiful descent
(the pod physically falls through the real BRIGHT-MIDDAY sky)` → `the parachute gag (mid-fall, 3 pulls → snap)`
→ `crash + blackout` → `wake (in the SAME pod you rode down)` → `step out into the MIDDAY dunes BESIDE
the SAME pod` → `the horizon reveal (the Beached Leviathan beckons)` → `craft a machete → salvage your
own pod → the failed parachute comically pops out`.

## ⚑ ONE POD, ONE DOOR, NO SEAMS (CLUSTER D, 2026-07-03) — READ THIS FIRST
The user's "same pod inside↔out↔phase, one aperture" re-scope. Supersedes the split-aperture notes:
- **ONE MERGED FRONT DOOR (−Z).** The old −Z round VIEWPORT and the old side ESCAPE HATCH (−1.25) are
  UNIFIED into a SINGLE front-facing DOOR on the −Z arc (`FDOOR_AZ = π`, `FDOOR_W/H/CY`), with the
  DOMED CIRCULAR PORTHOLE integral to the door SLAB (`buildCabinHatch` builds the door + the porthole
  hole/glass/bezel; the door slab is a FRAME around the aperture so the descent reads THROUGH the
  porthole glass). The player faces this ONE door for everything: sits facing it, watches the whole
  descent through its porthole (the door SEALED closed at rest — `_cabinHatchAjarY = 0`), then
  `blowCabinHatch` kicks THE SAME door open at the wake + they walk out the −Z opening. `HATCH_*` now
  ALIAS `FDOOR_*` so the wall/hoop-gap + `buildExteriorSkin` gap + `_addWalkableColliders` gap all cut
  the ONE −Z aperture. `buildViewport` RETIRED (porthole moved into the door); the exterior −Z
  porthole-echo bezel + `_podPortholeBandMat` RETIRED (the −Z arc is now the walk-in opening). `VP_R`
  (0.44) + `VP_CY` (1.34) are kept as the porthole disc radius + the seated-eye height.
- **Camera anchor = the door, every beat.** Eject-release / descent / parachute / impact all
  `faceControl(0, …)` (−Z door, yaw 0); the wake now `faceControl(FRONT_DOOR_YAW=0, −0.05)` (was the
  −1.25 side-hatch yaw). The sole exception is the enterPod SEAL framing `faceControl(1.20, −0.20)`,
  which deliberately frames the EJECT control for the "pull eject" prompt (then the ride faces the door).
- **NO teleport at step-out + the exposure EASES (eye-adaptation).** `unifyEnterablePod` now ARMS an
  exposure ease (`armExposureEase`; `updatePodExposureEase` ticked every frame from main.ts, persisting
  past `endEscapePodIntro` like the fog-ease) — the wake lift (`CABIN_WAKE_EXPOSURE 1.62`) eases DOWN to
  the desert base (1.05) over `EXPO_EASE_S = 1.8s`, no snap "instance change". The Continue-load path
  (`restoreEnterablePod` → `unifyEnterablePod(…, easeExposure=false)`) SNAPS (no wake exposure ran).
  `disposePodScene`/`restoreCabinExposure` `cancelExposureEase` on hard-restore paths. The player walks
  out on their OWN legs (the wake-climb phase; `tickStepOut` does NOT `seatPlayerAt`).
- **The BAY pod stays the canonical +X door** (`buildCanonicalPodExterior`, `CPOD_DOOR_AZ = π/2`) — the
  user-approved reference; the B2 seal-swap (bay +X pod → ride −Z cabin) is the accepted concession.
  Both are the SAME riveted-aluminium capsule with a domed-porthole front door (shared materials/dims).
- **D5 — the chute-pop GAG is DECOUPLED from the tutorial state machine.** `updateChutePop(ctx, dt)`
  (always-running, main tick) now fires the pop on the PRY EVENT itself (`panelOpened` on the pod's
  salvageable) regardless of the tutorial phase — the old bug was the pop firing only inside
  `updatePodTutorial`'s 'salvage' phase (missed if the player pried in another phase). Once ever
  (idempotent; `chutePopReady` false after). Proven by `smokePodTutorial`'s `poppedViaAutoFireWrongPhase`.
- **Gates:** `pod-walkout` (kick the front door → real-KCC walk out, NO teleport, the exposure ease via
  `smokeExposureEase`), `pod-walkin`, `smoke-pod-persistence`, `smoke-pod-tutorial`, `pod-interior
  --angle=descent --descent=0.15/0.5/0.9` (the arc through the door porthole), `wake --blow`,
  `stepout-pod` (the `haz` framing = π now). `smokeIntro` = `{ok:true,beats:12}`.

## ⚑ ONE ENTERABLE POD + CONSISTENT MIDDAY (user re-scope, 2026-07-01) — READ THIS
Two linked user-walk-test fixes that supersede the older R3a "dispose+swap" + "dawn" notes below:
- **ONE ENTERABLE POD (no model swap).** The descent/wake pod and the step-out pod are the SAME
  object. At step-out `unifyEnterablePod` (podScene) wraps the EXTERIOR aluminium skin around the
  hero cabin, re-grounds it so the floor sits on the terrain, adds WALKABLE colliders (a floor slab +
  a wall-ring of box segments GAPPED at the hatch azimuth), opens the hatch, and registers the salvage
  panel + chute-pop. `tickStepOut` NO LONGER `disposePodScene` + `placeCrashedPodWreck` — it UNIFIES in
  place. `endEscapePodIntro` SKIPS the pod dispose when `podIsEnterable()` — the ONE pod PERSISTS into
  the real game as a walk-in landmark (the SAME pod you rode down, woke in, climbed out of, and can walk
  back into). `placeCrashedPodWreck` (the old separate wreck) is now used ONLY by the dev `smokePodTutorial`.
- **CONSISTENT BRIGHT MIDDAY (no time/light jump).** The descent re-grounding, the crash, the wake, and
  step-out all call `setIntroMiddayClear` (sequence.ts) → `dayTime=0.46` (bright midday; noon=0.5) +
  cloudiness/storm 0. `setSkyIntroMode`'s "real sky" leg is driven by `sunHeight` (from dayTime), so the
  sky the pod FALLS THROUGH == the sky you STEP OUT into, by construction. The cabin crash-pose/wake
  lighting was retuned dawn-orange → bright neutral midday (`_VP_WARM`/`_FILL_WARM` + hatch flood);
  `CABIN_WAKE_EXPOSURE` 2.0→1.5 (midday needs less lift than dawn). `_CRASH_PITCH/_ROLL` gentled
  (0.26/0.14 → 0.075/0.045) so the persisting pod's floor stays WALKABLE (no steep tilt-snap at step-out).
  The descent is grounded at the TERRAIN floor (`groundedDescentBase`) from the fall onward, so the wake
  cabin is walk-in-able at ground level with no vertical jump at the unify.
- **Rig:** `--scenario=stepout-pod --angle=beside|approach|interior|3q` drives the REAL chain through
  step-out (unify) + shoots the ONE pod from outside (the step-out-beside / walk-back-in / into-the-hatch
  reads); reports podCols (walkable-collider count), podSalvageable, dayTime.

## The spine — `sequence.ts` (the beat state machine)
`ctx.intro: IntroState | undefined` (undefined = not in the intro). Key fields: `active`, `beat`
(the `BEAT_ORDER` enum: cockpit · checkEngines · corridor · enterPod · shipExplode · descent ·
parachute · impact · wake · stepOut · tutorial · payoff · done), `mode` (`walk` | `seated` |
`scripted`), `scratch` (per-beat scratchpad — **beware key collisions between phases within one
beat**), `returnPos` (the real desert spawn the intro hands back to).

- **Tick**: `updateEscapePodIntro(ctx, dt)` runs in `main.ts` BEFORE `updatePlayer` (so it can set
  the capsule + drive the camera first). No-op unless `ctx.intro?.active`.
- **Gating**: while active, the intro OWNS the player + camera; normal systems are suppressed via
  `introActive(ctx)` guards (NOT `flags.paused` — that would freeze the intro tick too).
- **Per-beat controllers**: `tick<Beat>` functions drive content + call `advanceBeat`/`jumpToBeat`
  on their trigger. Each beat owns its own timer (`scratch.dwell`/`scratch.t`/`ctx.time.elapsed`).
- **Camera**: a beat either leaves FREE-LOOK (PointerLockControls) or DRIVES the look (`faceControl`
  writes the euler + syncs). Locomotion (WASD→KCC) is enabled on walk beats, disabled on seated.
- **The OFFSET architecture**: the ship + pod beats run in their own offset geometry while the real
  desert sits generated at boot. The eject→descent transition RELOCATES the pod to the real-world
  fall (the accepted R1b seam); `stepOut` teleports the player to `returnPos` for the real game.

## The scene modules
- **`podScene.ts`** — the ONE hero pod (riveted aluminium capsule). The cabin interior the player
  rides down (`buildPodScene`), the descent altitude drive (`setDescentProgress`/`setDescentBase`,
  `getPodSpawn`), the crashed-pose settle + wake lighting (`setCabinCrashPose`, retuned MIDDAY), the
  hatch (`buildCabinHatch`/`blowCabinHatch`), and the comic chute-pop (`armChutePop(target?)`/
  `popChute`/`updateChutePop`). At step-out `unifyEnterablePod` turns the crashed cabin into the ONE
  persistent WALK-IN pod: `buildExteriorSkin` (the matched outer aluminium skin, hatch-gapped) +
  `_addWalkableColliders` (floor + wall-ring gapped at the hatch) + `_registerEnterablePodSalvage`
  (the salvage panel + chute-pop). `podIsEnterable()` gates its persistence past `endEscapePodIntro`.
  ONE consistent model, in↔out↔real-game: you ride it down, wake in it, climb out of it, and can walk
  back INTO it. (`placeCrashedPodWreck` — the old separate size-matched wreck — is now DEV-ONLY, used
  by `smokePodTutorial`; the real flow uses `unifyEnterablePod`.)
- **`shipScene.ts`** — the hauler INTERIOR: the hero cockpit (a lofted vaulted ribbed D-section
  fuselage, NOT a box), the fully-modelled corridor (`buildCorridor`, `CORRIDOR_COLLIDERS`), the
  pod-BAY (the docked pod + `getPodBayThreshold`/`getPodBaySeatedEye`/`releasePodFromBay` — the
  physical enter/eject surface). Disaster hooks: `setCockpitAlert`/`setShipAlert`/`setEngineFire`
  (drive real fire + red-alert lighting). All materials are worn gunmetal + the `_installGrime`
  shader (one ship tone across cockpit/corridor/bay/pod).
- **`haulerScene.ts`** — the exterior HAULER freighter + the Phase-3 EXPLOSION FX
  (`setHaulerExplosion(t)`: fireball shader, flash, shockwave, 38 debris chunks, embers, blast
  light; `uFade` clears the husk to space). Staged in the post-eject porthole view.
- **`sky.ts`** (`setSkyIntroMode`/`applySpaceMode`) — SPACE MODE: drives the game's real
  camera-relative sky into orbit (dark dome, wrapping stars, the camera-relative planet + Fresnel
  atmosphere limb, milky-way band). Also thins the desert fog/background + dims the sun/ambient in
  vacuum (see State-restore).
- **`leviathanLandmark.ts`** — the Beached Leviathan horizon-hook (a colossal wrecked ship ~360m out
  on the step-out gaze). Gated behind `FEATURES.escapePodIntro` in `main.ts` (promotable to always-on).
- **`podTutorial.ts`** — the post-handoff craft→salvage→chute-pop tutorial state machine
  (`startPodTutorial` from `stepOut`; scatters scrap/cloth; cues via `maybeShowEventHint`).
- **`introHud.ts`** — HUD hide (`setGameHudHidden`), the intro prompt, the black overlay/fades.

## ⚠ STATE-RESTORE discipline (the recurring bug class — READ before editing)
The intro mutates GLOBAL renderer/scene state that MUST restore for the real game on EVERY exit path
(`stepOut`, `endEscapePodIntro`, `skipIntro`, dev `jumpToBeat` away, quit-mid-intro). Leaks caught +
fixed this build:
- **Fog / `scene.background` / sun+ambient** (`applySpaceMode`): the desert fog was fogging the black
  space dome tan (the "tan wall" bug); the desert noon sun followed the pod to orbit + flooded the
  cabin white. Both dimmed by the orbit blend; SAFE because mutations gate on `s>0.001` AND
  `updateWeather`/`updateLighting` re-derive fog/bg/sun/ambient every frame → a single frame at `s=0`
  self-heals.
- **`renderer.toneMappingExposure`** (`setCabinCrashPose` lifts 1.05→1.5 so the enclosed crashed
  MIDDAY cabin reads on the Reinhard curve — the game's 1.05 desert exposure CRUSHES interiors; the
  tone curve, not lumens, is the bottleneck. Midday needs less lift than the old dawn 2.0). Restored by
  `disposePodScene` (teardown), `restoreCabinExposure` (a dev jump-back off a crash beat — else 1.5
  leaks into the orbit), AND `unifyEnterablePod`/`endEscapePodIntro` (the pod becomes a real-world
  midday-sun-lit object at step-out → back to the desert base 1.05).
- **HUD / atmosphere-hide / pod+ship+hauler dispose**: all routed through `endEscapePodIntro`, which
  EVERY exit path reaches. New global mutations MUST add their restore here (or self-heal per-frame).

**Rule: if you add a global mutation, add its restore to every exit path (or make it re-derive each
frame). Verify headlessly (jumpToBeat away + read the value back).**

## Flags / gating (shippable-safe: flag-off = zero impact on the live game)
- `FEATURES.escapePodIntro` (default OFF). `startEscapePodIntro` gated at `main.ts` new-game branch
  (`if (FEATURES.escapePodIntro && !devMode)`) + double-guarded inside. `ctx.intro` stays undefined
  when off → all intro ticks no-op. The Leviathan is `if (FEATURES.escapePodIntro)`-gated. New audio
  synths are only called from the gated sequence.
- **Save**: `introComplete` (`ctx.intro?.beat==='done'`) prevents replay; save is blocked mid-intro;
  quit-mid-intro = reload = restart (per design). **Pause**: the `flags.paused` guard returns before
  the intro ticks + the time increment → all beat timers freeze.
- **The persistent pod SURVIVES save/reload** (cycle 49): the walk-in pod is built by the intro flow
  (never at boot), and `save.ts` only patches salvageables by id — so pre-fix, a post-intro Continue
  silently LOST the pod. Now: an additive optional `podCrash` save record (`serializeEnterablePod` —
  `{x,z,salvageRemaining,stripped,panelOpened,extractedIndices,chutePopped}`; null/absent for flag-off
  or pre-step-out saves, NO SAVE_VERSION bump) + a pending-stash restore on Continue (the meteorCrash
  idiom: `setPendingPodCrashRestore` in loadGameState → `applyPendingPodCrashRestore` in main.ts AFTER
  `handoffToGame`, since the load runs before the handoff's world reset). Saved salvage state is applied
  DIRECTLY to the fresh record (the registry id counter differs between sessions — never rely on the
  generic by-id patch for intro-built objects). A popped chute restores to its settled pose; an unpopped
  one re-homes the tutorial driver to `salvage` (`resumePodTutorialAfterRestore`) so the gag still fires
  post-reload. Scattered scrap/cloth persist generically (`droppedPickups`). Rig gates:
  `smoke-pod-persistence` / `pod-persistence-reload` / `pod-persistence-flagoff` (+ `__game.smokePodPersistence()`).

## Dev hooks + rig (verification — preview HANGS on the desert; use these)
- Console (`__game`): `startIntro()` (force), `jumpToBeat('<beat>')`, `skipIntro()`, `smokeIntro()`
  (→ `{ok:true,beats:12}`, drives the whole chain headless), `smokePodTutorial()`, `popChute()`,
  `setHaulerExplosion(t)`, `setCabinCrashPose(s)`, `resetTutorial()`.
- Rig: `node scripts/rig-shot.mjs --scenario=<cockpit|corridor|pod-bay|ship-explode|pod-interior|
  crashed-pod|wake|smoke-intro>` (each drives the REAL beat/camera; `--space=1` for orbit sky,
  `--descent=0..1`, `--t=0..1` / `--strip` for the explosion, `--popchute`, `--disaster`/`--fire`).
  NOTE: the rig mirrors space-mode fog/bg/sun/exposure by hand in its paused blocks — keep those in
  sync with `applySpaceMode` or the rig shows a false frame (a past bug: the cockpit rig rendered
  stale sky → the adversarial gates judged false frames).

## Audio (per beat; all procedural Web Audio, no samples — `audio.ts`)
cockpit `startCockpitHum` · corridor `playExplosionBoom`+`playHullGroan`+`playKlaxon`+`startEngineFire`
+`startMusicEscape` · enterPod `playDoorBlow`+`playHatchSeal` · shipExplode `playBoltShear`+
`playEjectThunk` → `playExplosionBoom`×2+`playShipDeathRoar` · descent `startDescentRush`+
`startMusicDescent`, re-entry `playReentryRumble` · parachute `playLeverClick`/`playLeverSnap` ·
impact `playCrashImpact` · wake `startDesertWind` · stepOut `playAweSwell`+`startMusicDesert` ·
payoff `playChutePop`. All loops register in `_introLoops` → stopped on every exit. Levels/mix = a
human LISTEN/balance pass (flagged).

## Residuals for the user (feel / art-direction — not autonomous-buildable)
Feel walk-tests (descent pacing, explosion rhythm, climb-in, chute-pop spring, parachute timing);
the audio mix balance; art-direction taste (the seat read, promote the Leviathan to always-on?).
