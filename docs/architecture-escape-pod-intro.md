# Escape-pod intro — architecture (as-built)

The first-person crash-landing OPENING (`FEATURES.escapePodIntro`, default OFF). A new
game plays it before handing off to the real desert. Vision: `docs/feature-escape-pod-intro.md`.
This doc is the maintainer's map of the built feature (post-REBUILD-v2, 2026-07-01).

## The beat arc (what the player experiences)
`orbit (cockpit)` → `check engines` → `corridor disaster (fire + red-alert)` → `enter the pod-bay
(physically climb in, no teleport)` → `eject → WATCH THE SHIP EXPLODE` → `the beautiful descent
(the pod physically falls through the real sky)` → `the parachute gag (mid-fall, 3 pulls → snap)`
→ `crash + blackout` → `wake (in the SAME pod you rode down)` → `step out into the dawn dunes`
→ `the horizon reveal (the Beached Leviathan beckons)` → `craft a machete → salvage your own pod
→ the failed parachute comically pops out`.

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
  `getPodSpawn`), the crashed-pose settle + wake lighting (`setCabinCrashPose`), the hatch
  (`buildCabinHatch`/`blowCabinHatch`), the crashed EXTERIOR wreck (`placeCrashedPodWreck`, size-
  matched — persists into the real game as the salvage target), and the comic chute-pop
  (`armChutePop`/`popChute`/`updateChutePop`). ONE consistent model: you wake in + climb out of the
  SAME cabin you rode down.
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
- **`renderer.toneMappingExposure`** (`setCabinCrashPose` lifts 1.05→2.0 so the enclosed crashed
  cabin reads on the Reinhard curve — the game's 1.05 desert exposure CRUSHES interiors; lumens don't
  fix it, the tone curve does). Restored by `disposePodScene` (teardown) AND `restoreCabinExposure`
  (called by `jumpToBeat` when leaving a crash beat — else a dev jump-back leaks 2.0 into the orbit).
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
