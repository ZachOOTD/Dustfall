// Debug handles attached to window.__game so MCP preview tools can poke state.

import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import type { GameContext } from '../GameContext.ts';
import { spawnRaider as spawnRaiderEntity, damageRaider } from '../enemies/raider.ts';
import { spawnFireAt, warmFireSmoke } from '../world/fire.ts';   // M4 (C21) — __game.spawnFire / warmSmoke test hooks
import { spawnBedrollAt } from '../world/bedroll.ts';   // M6 ③ (C39) — camp-studio render
import { spawnTentAt } from '../world/tent.ts';
import { spawnLanternAt } from '../world/lantern.ts';
import { updateStatVignette } from '../ui/statVignette.ts';   // M6 ④ (C40) — diegetic-probe
import { setDiegeticActive } from '../ui/diegeticMode.ts';
import { setStatsBarsVisible } from '../ui/hud.ts';
import { getSunOccluders } from '../world/horizonSilhouettes.ts';   // M5a (C31) — __game.sunInfo
import { triggerCrash, crashState, advanceCrash, crashSites, crashHeatAt, resetMeteorCrash, applyPendingCrashRestore, type CrashRole } from '../world/meteorCrash.ts';   // ACBE (D1) — __game.triggerCrash
import { saveGameState, loadGameState } from '../persistence/save.ts';   // ACBE (D1) — crash save round-trip test hook
import { updateStats, die } from '../stats/survival.ts';   // ACBE (D1) — crash heat-hazard probe; C38 — triggerDeath
import { spawnWormCrossing, updateWormHorizonCrossing } from '../world/wormHorizonCrossing.ts';   // M5b (C36) — __game.triggerWormCrossing
import { fireSignalFlare, advanceSignalFlares, activeSignalFlareCount } from '../world/signalFlare.ts';   // M6 (C37) — __game.fireSignalFlare
import { damageVulture } from '../enemies/vulture.ts';
import { applyLungePose, applyMeshTransform } from '../enemies/sandWorm.ts';   // M12 ⓖ (C66) — __game.poseLunge (dive render)
import { startEscapePodIntro, endEscapePodIntro, jumpToBeat as jumpToIntroBeat, smokeTestIntro, benchIntro, type BeatId, type IntroBenchResult } from '../world/escapePodIntro/sequence.ts';   // escape-pod intro — __game.startIntro/skipIntro/jumpToBeat/smokeIntro/benchIntro
import { placeCrashedPodWreck, setDescentProgress as setPodDescent, setParachuteLeverPull as setPodChute, setCabinCrashPose as setPodCrashPose, blowCabinHatch as blowPodHatch, popChute as popPodChute, buildPodScene as buildPodSceneDbg, getPodSpawn as getPodSpawnDbg, disposePodScene, podIsEnterable, getCrashedPodSalvageableId as getPodSalvageId, chutePopReady, setPendingPodCrashRestore, applyPendingPodCrashRestore, smokeExposureEase } from '../world/escapePodIntro/podScene.ts';   // T1.1/T1.2 · R3a · T4.3 · T3.2 — __game.placeCrashedPod / … ; + smokePodPersistence deps; CLUSTER D — smokeExposureEase (the eye-adaptation ease proof)
import { smokePodTutorial } from '../world/escapePodIntro/podTutorial.ts';   // T4.3 — __game.smokePodTutorial (drive the craft→salvage→chute-pop loop headlessly)
import { buildHaulerExterior, disposeHaulerExterior, setHaulerExplosion, setHaulerDeparture } from '../world/escapePodIntro/haulerScene.ts';   // T3.1/T3.2 — __game.buildHauler / disposeHauler / setHaulerExplosion (hauler-exterior + explosion rig-shots); C1 — setHaulerDeparture (the eject-departure recession)
import { setCockpitAlert as setShipCockpitAlert, setShipAlert as setShipRedAlert, setEngineFire as setShipEngineFire } from '../world/escapePodIntro/shipScene.ts';   // T3.3/T3.4 — __game.setCockpitAlert / setShipAlert / setEngineFire (alert escalation + the disaster rig-shot)
import { setSkyIntroMode, setPlanetApproach } from '../world/sky.ts';   // REBUILD v2 R1a — __game.setSkyIntroMode (space mode for the orbit/cockpit beats); C3 — setPlanetApproach (the descent planet-approach arc)
import { makeLatheHull, fuselageProfile, makeFormerRings, makeBreach, makeSandMound } from '../world/wreckForms.ts';
import { createRustedHullMaterial, HULL_WEATHERING_ACAY } from '../world/hullMaterial.ts';
import { placeProcgenComposite, type ProcgenWreckClass } from '../world/procgenWreck.ts';
import { placeProcgenPOI, auditArchetypeColliders } from '../world/poiAssembler.ts';
import type { ArchetypeId } from '../world/poiArchetypes.ts';
import { validatePanels, type PanelEntry } from '../world/panelPlacement.ts';
import { addAccessPanel, type PanelKind, type PanelArchetype } from '../world/wrecks.ts';   // ACAV — panel-studio
import { popPanelDoor, panelDebrisInfo } from '../world/panelDebris.ts';   // ACAX — door pop-off smoke test
import { makeRng } from '../core/rng.ts';
import { Tuning } from '../config/tuning.ts';
import { resetTutorial, showControlsPanel } from '../ui/tutorial.ts';
import { getAudioStateSnapshot, type AudioStateSnapshot } from '../audio/soundscape.ts';
import { getMusicStateSnapshot, type MusicStateSnapshot } from '../audio/music.ts';
import { triggerStorm as triggerStormWeather } from '../world/weather.ts';
import { getItemDef } from '../inventory/items.ts';
import type { ItemId } from '../inventory/types.ts';
import { spawnDroppedPickup } from '../pickups/pickups.ts';   // ACAS B2 — dropTestItem dev hook
import { __craftChooserTest } from '../ui/craftingMenu.ts';   // ACAS B3 — chooser verification hook
import { __registerTestRecipe } from '../inventory/recipeDiscovery.ts';   // ACAS B3 — transient test-recipe injector

declare global {
  interface Window {
    __game?: DebugApi;
  }
}

interface DebugApi {
  /** The THREE namespace — exposed for dev/rig overlays (e.g. the A1 collider wireframe). */
  THREE: typeof THREE;
  setTime: (t: number) => void;
  /** Escape-pod intro (T0.1) — force-start the intro (works even with the build flag off). */
  startIntro: () => void;
  /** Escape-pod intro (T0.1) — end the intro + hand back to the normal game (desert spawn). */
  skipIntro: () => void;
  /** Escape-pod intro (T0.1) — jump straight to a named beat (cockpit, corridor, descent, …). */
  jumpToBeat: (beat: BeatId) => void;
  /** Escape-pod intro (T0.4b) — smoke the whole sequence (force every beat, confirm no throw). */
  smokeIntro: () => { ok: boolean; beats: number; error?: string };
  /** Escape-pod PERF — bench the intro chain with per-beat-entry + per-tick timing. Pass
   *  {preload:true} to run the up-front preload first (beats reuse prebuilt scenes → entries ~0),
   *  {preload:false} for the cold build-on-entry baseline. Returns the beat-entry stalls + hitch
   *  counts (>50ms/>100ms). Async (the preload is async). */
  benchIntro: (opts?: { preload?: boolean }) => Promise<IntroBenchResult>;
  /** Escape-pod T1.1 — place the HERO crashed pod at world (x,z), half-buried + tilted. For the
   *  crashed-pod rig-shot (reproduces the real stepOut wake-beside-the-pod placement). */
  placeCrashedPod: (x: number, z: number) => void;
  /** Escape-pod T1.2 — grow the descent planet in the cabin viewport (0..1). For the
   *  pod-interior rig-shot (frame the descent forward view). */
  setDescentProgress: (p: number) => void;
  /** Escape-pod T1.2 — pose the parachute lever (the gag): t in [0,1] (0=rest, 1=yanked);
   *  snapped=true droops it dead. For the pod-interior rig-shot + the parachute beat. */
  setParachuteLeverPull: (t: number, snapped?: boolean) => void;
  /** Escape-pod R3a — settle the crashed cabin pose (0=upright, 1=full crashed lean) + free
   *  the player (drops the seated cage). For the wake rig-shot. */
  setCabinCrashPose: (pose: number) => void;
  /** Escape-pod R3a — blow the cabin escape hatch open (0=ajar, 1=flung wide). For the wake rig-shot. */
  blowCabinHatch: (t: number) => void;
  /** Escape-pod T4.3 — fire the comic chute-pop on the crashed pod (the failed chute finally
   *  deploys). For the chute-pop rig-shot / manual payoff test (needs a crashed pod placed).
   *  Optional `advanceSeconds` synchronously drives the inflate that many seconds (rig-shots
   *  pause the loop, so pass ≥ the pop duration to freeze on the FULLY-inflated frame). */
  popChute: (advanceSeconds?: number) => void;
  /** Escape-pod T4.3 — smoke the whole craft→salvage→chute-pop tutorial loop headlessly. */
  smokePodTutorial: () => ReturnType<typeof smokePodTutorial>;
  /** Escape-pod CLUSTER D — prove the step-out exposure EASE is a gradual eye-adaptation, not a snap. */
  smokeExposureEase: () => ReturnType<typeof smokeExposureEase>;
  /** Write the game to the single save slot (dev/rig — the menu Save path without the UI).
   *  Used by the pod-persistence-reload rig scenario to save mid-game before a page reload. */
  saveGame: () => { ok: boolean; error?: string };
  /** Escape-pod SAVE/LOAD — smoke the enterable-pod persistence round-trip headlessly:
   *  run the intro to step-out (unify the ONE walk-in pod), mutate its salvage/chute state, SAVE,
   *  simulate a fresh-boot teardown (disposePodScene → the pod is gone, PROVING the bug), then run
   *  the restore path (setPending + applyPending) and assert the pod is back with matching state.
   *  Returns a per-stage pass report. Guards this fix against silent regression. */
  smokePodPersistence: () => {
    ok: boolean;
    builtBeforeSave: boolean;
    savedPodCrash: boolean;
    goneAfterTeardown: boolean;
    rebuiltAfterRestore: boolean;
    salvageMatches: boolean;
    chuteMatches: boolean;
    exposureRestored: boolean;
    lightsParked: boolean;
    error?: string;
  };
  /** Escape-pod T3.1 — build the HERO cargo-hauler exterior in front of the pod (the
   *  ship the player fled, seen through the porthole at shipExplode). For the hauler rig-shot. */
  buildHauler: () => void;
  /** Escape-pod T3.1 — tear down the hauler exterior. */
  disposeHauler: () => void;
  /** Escape-pod T3.2 — drive the ship EXPLOSION FX (0 = intact, ~0.05 = flash, 0.1–0.4 =
   *  fireball/breakup/shockwave, → 1 = receding husk). For the explosion rig-shot iteration. */
  setHaulerExplosion: (t: number) => void;
  /** Escape-pod T3.2 — build + seat the pod cabin at the ORBIT frame (for the explosion rig-shot). */
  buildPodOrbit: () => void;
  /** Escape-pod T3.3 — drive the cockpit alert state (0 = ORBIT ACHIEVED calm, 1 = caution,
   *  2 = red-alert). For the cockpit rig-shot + the disaster escalation. */
  setCockpitAlert: (level: 0 | 1 | 2) => void;
  setShipAlert: (level: 0 | 2, strobe?: number) => void;
  setEngineFire: (intensity: number, t?: number) => void;
  /** Escape-pod REBUILD v2 R1a — drive the real sky into "space mode" (0 = normal
   *  game sky, 1 = full in-orbit: black dome, no clouds, full stars, a real-scale
   *  planet + atmosphere limb). The orbit/cockpit beats turn it on; re-entry eases
   *  it back to 0. For the cockpit rig-shot (--space) + the space beats. */
  setSkyIntroMode: (space01: number) => void;
  /** Escape-pod C1 — drive the post-eject DEPARTURE recession (0 = the framed hero pose,
   *  1 = the ship receded/drifted away). For the eject-departure rig-shot iteration. */
  setHaulerDeparture: (t: number) => void;
  /** Escape-pod C3 — drive the descent PLANET-APPROACH (0 = the orbit-distant disc, 1 =
   *  the planet grown to fill the porthole + its atmosphere limb dominating). For the
   *  planet-approach rig-shots (the planet should visibly grow across d0→d0.2). */
  setPlanetApproach: (t: number) => void;
  setStats: (s: {
    thirst?: number;
    temperature?: number;
    hunger?: number;
    stamina?: number;
    health?: number;
  }) => void;
  state: () => {
    thirst: number;
    temperature: number;
    hunger: number;
    stamina: number;
    health: number;
    dayTime: number;
    playerDead: boolean;
  };
  ctx: GameContext;
  RAPIER: typeof RAPIER;
  castDown: (x: number, z: number, fromY?: number) => null | {
    hitY: number;
    timeOfImpact: number;
    colliderHandle: number;
    shape: number;
  };
  /** Trigger a sandstorm immediately for testing. */
  triggerStorm: () => void;
  /** ACAB (Cycle 6) — force the daytime cloud cover (0 clear … 1 overcast) for
   *  sky-shader iteration + the `sky` rig-shot scenario. Sets a hold that
   *  overrides the auto cloud-cover easing until cleared (pass < 0 to release). */
  setCloudiness: (v: number) => void;
  /** ACG (Cycle 1) — DEV-only: spawn a raider at world XZ (terrain Y
   *  auto-sampled) and register it in ctx.raiders. Raiders are dormant by
   *  design (D13 / Pillar 1) — this is a test affordance for exercising the
   *  ACF corpse-drag path, NOT a return of raiders as a world threat.
   *  Returns the new raider's id. */
  spawnRaider: (x: number, z: number) => number;
  /** M4 (C21) — DEV-only: deploy a lit fire (default: in front of the player) so
   *  the smoke-signal plume + fire visuals are renderable headless. Returns the id. */
  spawnFire: (x?: number, z?: number) => number;
  /** M4 (C21) — DEV-only: fast-forward all fires' smoke plumes by N seconds
   *  (deterministic) so the full column renders headless despite rAF throttling. */
  warmSmoke: (seconds: number) => void;
  /** M5a (C31) — DEV-only: the player's current sun exposure (1 = full sun, 0 =
   *  fully shaded) + the registered sun-occluder wreck boxes (their ground shadows
   *  relieve heat). For the sun-shade walk-test + headless verification. */
  sunInfo: () => { exposure: number; occluders: number; boxes: Array<{ cx: number; cy: number; cz: number; hx: number; hy: number; hz: number }> };
  /** ACBE (D1) — DEV-only: force a crashing-wreck event now (optionally at x,z); returns
   *  the impact point + the rolled ship role. */
  triggerCrash: (x?: number, z?: number) => { x: number; z: number; role: CrashRole } | null;
  crashState: () => { active: boolean; t: number; impacted: boolean; role: CrashRole | null; headPos: [number, number, number] | null };
  /** ACBE (D1) — DEV/headless: step the active crash by `seconds` (deterministic; pair with
   *  ctx.flags.paused so the live tick doesn't double-advance). Lets the rig-shot capture an
   *  exact moment without depending on the slow headless wall-clock. */
  advanceCrash: (seconds: number, substeps?: number) => void;
  /** ACBE (D1) — DEV/headless: full crash save round-trip (save → clear → load → restore) and
   *  report the site count at each stage (before === afterRestore + afterReset === 0 ⇒ OK). */
  crashRoundtrip: () => { before: number; afterReset: number; afterRestore: number; saveOk: boolean; loadOk: boolean; loadErr: string | null };
  /** ACBE (D1) Tier 4 (C) — DEV/headless: probe the crash interior HEAT hazard. Teleports the
   *  player to the first crash site, samples crashHeatAt at 4 distances, then bakes ~3s of stats
   *  at centre. PASS ⇒ center>near>half>edge==0 and dTemp>0 (temperature climbs). */
  crashHeatProbe: () => { center: number; near: number; half: number; edge: number; tempBefore: number; tempAfter: number; dTemp: number; shelterAfter: number; error?: string };
  /** M5b (C36) — DEV-only: force a distant worm horizon-crossing now (returns its
   *  centre point); + fast-forward it `seconds` for a deterministic rig-shot frame. */
  triggerWormCrossing: () => { cx: number; cz: number } | null;
  advanceWormCrossing: (seconds: number) => void;
  /** M12 ⓖ (C66) — DEV/rig-only: pose ctx.sandWorms.list[0] at the breach-and-dive lunge
   *  time `t` (0..1) using the REAL applyLungePose (no rig-vs-real drift). Returns the body
   *  center + head world Y + pitch so the no-airborne-hop claim is numerically checkable
   *  (basePos.y must stay ≤ the charge level; head rears up at the strike, drives down on the dive). */
  poseLunge: (t?: number) => { found: boolean; t?: number; groundY?: number; chargeY?: number; centerY?: number; headWorldY?: number; pitch?: number; bend?: number };
  /** M6 (C37) — DEV-only: fire a signal flare from the player's view + fast-forward
   *  its arc `seconds` for a deterministic rig-shot frame. Returns the live count. */
  fireSignalFlare: (seconds?: number) => number;
  /** M6 ② (C38) — DEV-only: deterministically simulate the survival curve under a
   *  controlled scenario (forces real death even in dev mode), measuring time-to-death.
   *  env: 'heat' (full noon sun) | 'cold' (night) | 'thirst' (sheltered, no water) |
   *  'hunger' (sheltered+hydrated, no food) | 'prepared' (sheltered+fed+watered, starts
   *  hurt → must HEAL + never die). Restores all state afterward. For the survival-probe gate. */
  survivalProbe: (env: 'heat' | 'cold' | 'thirst' | 'hunger' | 'prepared', maxSeconds?: number) =>
    { env: string; died: boolean; timeToDeathMin: number | null; finalHealth: number; minHealth: number };
  /** M6 ② (C38) — DEV-only: force the REAL death path (bypassing the dev-mode godmode floor)
   *  and report whether it fired + the death overlay un-hid. Verifies the death→Continue UI
   *  still works now that GOD_MODE is off. Leaves the game in the death state (call last). */
  triggerDeath: (cause?: string) => { dead: boolean; overlayShown: boolean };
  /** M6 ③ (C39) — DEV-only: deploy the camp objects (fire / bedroll / tent / lantern) in a
   *  row ahead of the player so the flat-color-texture-audit material swaps are renderable,
   *  and report the scene shader-program count (must NOT rise — the audit reuses existing
   *  factories). Returns the cluster centre + per-object positions for framing. */
  campStudio: () => { center: [number, number, number]; programs: number };
  /** M6 ④ (C40) — DEV-only: force diegetic-survival mode + drive each stat to its tell,
   *  tick the vignette system, and report each vignette's opacity per scenario (the
   *  intended one > 0, the rest ~0) + that the HUD stat bars hide/show on toggle. For the
   *  diegetic-survival wiring gate. Restores stats + mode afterward. */
  diegeticProbe: () => Record<string, unknown>;
  /** M6 ④ (C40) — DEV-only: force diegetic mode + set ONE stat to its tell level so the
   *  screen-edge vignette renders for a screenshot. stat: thirst|cold|heat|hunger|health. */
  showDiegeticVignette: (stat: 'thirst' | 'cold' | 'heat' | 'hunger' | 'health') => void;
  /** ACG (Cycle 1) — DEV-only: kill a raider by id (drives the real death
   *  path → dead pose + corpse interaction tag), so the corpse-drag flow is
   *  testable without melee aiming. Returns true if a live raider matched. */
  killRaider: (id: number) => boolean;
  /** ACAI (T5) — DEV-only: kill a vulture by id (drives the real death path →
   *  dynamic-body tumble + lootable tag), so the death physics is testable
   *  without aiming. Returns true if a live (non-dead) vulture matched. */
  killVulture: (id: number) => boolean;
  /** ACAS (B2) — DEV-only: drop a dynamic-body pickup of `itemId` in front of the
   *  player so the per-item collider SHAPE (capsule/sphere/box) can be smoke-tested.
   *  Returns the new pickup id. */
  dropTestItem: (itemId: string) => number;
  /** ACAS (B3) — DEV-only: force the crafting input slots to a multiset + report the
   *  multi-match chooser state (button labels, craft-enabled). Verifies the chooser. */
  craftChooserTest: (items: Array<{ id: string; count: number }>) => { buttons: string[]; craftDisabled: boolean; label: string } | null;
  /** ACAS (B3) — DEV/TEST-only: inject a transient recipe colliding with scrap_bar
   *  so the multi-match chooser path can be exercised end-to-end. */
  injectTestRecipe: () => void;
  /** ACH (Cycle 2) — DEV-only: enter gameplay HEADLESS, bypassing the title
   *  button + pointer-lock. The normal handoff only clears `flags.paused` via
   *  the pointer-lock 'lock' event (input.ts), which never fires for an
   *  agent/preview click → the game renders the title-gone scene but never
   *  ticks. This runs the handoff side-effects + sets paused=false directly so
   *  the rAF loop ticks + renders. Pass dev=true to apply the DEV loadout
   *  first. Enables autonomous build→screenshot→critique on visual work. */
  enterGame: (dev?: boolean) => void;
  /** ACI (PM-Cycle A) — visual-audit "studio" for the player model. One call
   *  ensures headless gameplay (enterGame) + a 900×1100 canvas + 3P + EVEN
   *  studio lighting (ambient/key boosted + exposure ~2 — the in-game dusk
   *  hides rig detail). With no `angle`: enters + lights, leaves UNPAUSED so
   *  the rig settles at the body (call again with an angle after a beat).
   *  With an `angle`: pauses + frames that canonical view for a screenshot.
   *  The MVP-check verification loop (docs/feature-player-model.md) drives this. */
  rigStudio: (angle?: 'front' | 'back' | 'left' | 'right' | '3q' | 'head') => unknown;
  /** ACY — visual-audit "studio" for ITEM viewmodels. Builds the item's
   *  makeViewModel() mesh in ISOLATION (no rig/world clutter), suspends it high
   *  against the clean sky gradient, lights it for form (key/fill/ambient), and
   *  frames the chosen angle close enough to fill the frame. The item-detail
   *  pass (Lane 1) drives this via the `item-studio` rig-shot scenario. Pass an
   *  ItemId + angle; re-call to swap items/angles (prior mesh is removed). */
  itemStudio: (id: ItemId, angle?: 'front' | 'back' | 'left' | 'right' | 'top' | '3q') => unknown;
  spawnPanelStudio: (opts?: { shape?: 'rect' | 'square' | 'circle'; archetype?: string; kind?: PanelKind; scale?: number; open?: boolean; angle?: 'front' | '3q' | 'side' | 'eye' | 'top'; occlude?: boolean }) => unknown;
  /** ACAJ — visual-audit "studio" for the shared wreck-form toolkit primitives
   *  (`wreckForms.ts`). Builds a single form (lathe hull / former rings / breach /
   *  sand mound) in ISOLATION, suspends it against the clean sky, and frames the
   *  angle. Drives the `wreck-form` rig-shot scenario. */
  wreckFormStudio: (form: 'lathe' | 'formers' | 'breach' | 'mound', angle?: 'front' | 'side' | '3q' | 'top') => unknown;
  /** ACAO — DEV: spawn a procgen wreck of a chosen CLASS at a fixed clear
   *  anchor with a DETERMINISTIC seeded rng, named 'procgenWreckRig' so the
   *  headless framer (the `procgen-wreck` rig-shot scenario) can find + frame
   *  it. THE unblock for screenshot-verifying procgen visual work — procgen
   *  wrecks are otherwise unnamed + random-positioned, so no rig-shot could
   *  frame one (rule 8 killed the ACAN T5 breach attempt). Re-callable: removes
   *  the prior subject first. Deterministic (cls, seed) → the same wreck every
   *  run, so a before/after A/B of a visual change is comparable. Returns the
   *  spawned descendant mesh count (built-in before/after merge metric). */
  spawnProcgenWreckRig: (cls?: ProcgenWreckClass, seed?: number) => {
    cls: ProcgenWreckClass; seed: number; ok: boolean; meshes: number; pos: number[];
  };
  /** ACBB Tier 3 — COLLIDER-AUDIT. Assembles one POI archetype (pre-merge) at a fixed
   *  seed and asserts every collidable-scale mesh is covered by a declared collider.
   *  Drives the `collider-audit` rig-shot scenario + `npm run verify:colliders` gate. */
  auditPOIColliders: (archetype: ArchetypeId, seed?: number) => { archetype: string; total: number; pass: number; fails: number; details: string[] };
  /** ACY — headless bury/occlusion audit for salvage panels. For each
   *  registered salvageable, raycasts inward along the panel's own outward
   *  axis against its wreck root; if the nearest hit is NOT the panel body
   *  (i.e. hull occludes it), the panel is buried inside the model → fail.
   *  Drives the `panels` rig-shot scenario's pass/fail assertion. */
  panelBuryAudit: () => { tested: number; pass: number; failCount: number; fails: Array<{ idx: number; kind: string; hit: string }>; terrain: { tested: number; pass: number; failCount: number; fails: Array<{ idx: number; kind: string; hit: string }> } };
  /** ACAX — door pop-off smoke test. Spawns a wreck on terrain, pops the first
   *  panel's door (physics), returns the door's spawn Y so the `door-pop` scenario
   *  can confirm it FELL + settled (read panelDebris() after letting the loop run). */
  popTestDoor: (seed?: number) => { ok: boolean; reason?: string; spawnY?: number; panel?: number[] };
  panelDebris: () => { count: number; doors: Array<{ y: number; sleeping: boolean }> };
  /** Clear the tutorial localStorage flags so the controls panel + all
   *  pickup hints fire again. Refresh to see the first-boot overlay. */
  resetTutorial: () => void;
  /** Open the controls panel from the console — handy for screenshotting. */
  showControls: () => void;
  /** Per-stem audio gains + signal derivations. Null until first click unlocks
   *  audio. Use to tune sample-pack mix levels without re-running. */
  audioState: () => AudioStateSnapshot | null;
  /** AAP — per-track procedural music gains (day / storm / night).
   *  Null until first click unlocks audio. */
  musicState: () => MusicStateSnapshot | null;
}

/** Hooks main.ts supplies for actions that need its boot-scope closures
 *  (handoffToGame, applyDevLoadout, the title scene) which aren't reachable
 *  from here. */
export interface DebugHooks {
  enterGame?: (dev?: boolean) => void;
}

export function installDebugPanel(ctx: GameContext, hooks: DebugHooks = {}): void {
  // ACY item-studio state (lazily built on first itemStudio call).
  let studioGroup: THREE.Group | null = null;
  let studioMesh: THREE.Object3D | null = null;
  // ACAO — the live procgen-wreck framer subject (re-spawned per call).
  let procgenRigGroup: THREE.Group | null = null;

  window.__game = {
    THREE,   // expose the THREE namespace for dev/rig overlays (e.g. the collider wireframe)
    setTime: (t) => { ctx.time.dayTime = t; },
    // Escape-pod intro (T0.1) — dev hooks for fast iteration (T0.2+ beats).
    startIntro: () => startEscapePodIntro(ctx, true),
    skipIntro: () => endEscapePodIntro(ctx),
    jumpToBeat: (beat) => jumpToIntroBeat(ctx, beat),
    smokeIntro: () => smokeTestIntro(ctx),
    benchIntro: (opts) => benchIntro(ctx, opts),
    placeCrashedPod: (x, z) => { placeCrashedPodWreck(ctx, x, z); },
    setDescentProgress: (p) => { setPodDescent(p); },
    setParachuteLeverPull: (t, snapped) => { setPodChute(t, snapped); },
    setCabinCrashPose: (pose) => { setPodCrashPose(pose); },
    blowCabinHatch: (t) => { blowPodHatch(t); },
    popChute: (advanceSeconds) => { popPodChute(advanceSeconds); },
    saveGame: () => saveGameState(ctx),
    smokePodTutorial: () => smokePodTutorial(ctx),
    smokeExposureEase: () => smokeExposureEase(ctx),
    smokePodPersistence: () => {
      const report = {
        ok: false, builtBeforeSave: false, savedPodCrash: false, goneAfterTeardown: false,
        rebuiltAfterRestore: false, salvageMatches: false, chuteMatches: false, exposureRestored: false,
        lightsParked: false,
      } as ReturnType<NonNullable<Window['__game']>['smokePodPersistence']>;
      try {
        // 1. Drive the REAL intro to step-out — smokeTestIntro runs the whole chain incl. tickStepOut's
        //    unifyEnterablePod, leaving the ONE walk-in pod built + persisting (podIsEnterable()).
        smokeTestIntro(ctx);
        report.builtBeforeSave = podIsEnterable() && !!ctx.three.scene.getObjectByName('escapePodCabin');
        // Mutate the salvage state so the round-trip proves state (not just presence) survives:
        //   knock salvageRemaining down + pry the panel + pop the chute.
        const podId = getPodSalvageId();
        const rec = podId >= 0 ? ctx.salvageables.list.find((s) => s.id === podId) : undefined;
        if (rec) {
          rec.salvageRemaining = 2;
          const comps = (rec.panel.userData.panelComponents as Array<{ visible: boolean }> | undefined) ?? [];
          if (comps[0]) comps[0].visible = false;   // one component extracted (WYSIWYG)
          rec.panel.userData.panelOpened = true;
        }
        if (chutePopReady()) popPodChute(2.5);   // burst the comic chute (its state must round-trip)
        const wantRemaining = rec ? rec.salvageRemaining : -1;
        const wantChutePopped = !chutePopReady();   // popped → chutePopReady() is now false

        // 2. SAVE → localStorage, then read the podCrash record back out of the written blob.
        saveGameState(ctx);
        const raw = localStorage.getItem('dustfall.save.v1');
        const parsed = raw ? JSON.parse(raw) : {};
        report.savedPodCrash = !!parsed.podCrash
          && Math.abs(parsed.podCrash.salvageRemaining - wantRemaining) < 0.5
          && parsed.podCrash.chutePopped === wantChutePopped
          && parsed.podCrash.panelOpened === true;

        // 3. Simulate the FRESH-BOOT teardown: the pod is NOT re-built at boot (only the intro builds
        //    it). disposePodScene tears down the runtime pod exactly as a fresh page would have none.
        //    THIS is the bug: without a restore, the pod is now GONE forever on Continue.
        disposePodScene(ctx);
        report.goneAfterTeardown = !podIsEnterable() && !ctx.three.scene.getObjectByName('escapePodCabin');

        // 4. RUN THE FIX: stash the saved podCrash + apply it (the exact main.ts onContinue path).
        setPendingPodCrashRestore(parsed.podCrash ?? null);
        const restored = applyPendingPodCrashRestore(ctx);
        report.rebuiltAfterRestore = podIsEnterable() && !!ctx.three.scene.getObjectByName('escapePodCabin');
        const newId = getPodSalvageId();
        const newRec = newId >= 0 ? ctx.salvageables.list.find((s) => s.id === newId) : undefined;
        report.salvageMatches = !!newRec
          && Math.abs(newRec.salvageRemaining - wantRemaining) < 0.5
          && newRec.panel.userData.panelOpened === true
          && (((newRec.panel.userData.panelComponents as Array<{ visible: boolean }> | undefined) ?? [])[0]?.visible === false);
        // the chute was popped pre-save → restore must leave it popped (chutePopReady() false), and
        //   applyPendingPodCrashRestore reports it so main.ts skips the tutorial resume.
        report.chuteMatches = !chutePopReady() && !!restored && restored.chutePopped === wantChutePopped;

        // STATE-RESTORE discipline (architecture doc): the restore must NOT leak the intro's lifted
        //   cabin exposure into the loaded game. unifyEnterablePod transiently sets the crash-pose
        //   lift while building, then restores the desert-base 1.05 — assert it landed at base.
        report.exposureRestored = Math.abs(ctx.three.renderer.toneMappingExposure - 1.05) < 0.001;

        // WASH-OUT FIX (user-reported): the restore must ALSO park the pod's interior lights (unify →
        //   parkPodLights). The wake beat floods them HARD (hemi ~7.3, hatch spill ~14@dist9, …) to
        //   punch the dazed enclosed cabin through the come-to fade at the lifted wake exposure; if
        //   they leaked into the LOADED game (at the desert-base 1.05, real sun already on the pod)
        //   the interior blows out white + the hatch pools a hot spot on the sand. Assert the restored
        //   pod's lights are PARKED (no light above a calm interior ceiling; the hatch spill's short).
        const restoredPod = ctx.three.scene.getObjectByName('escapePodCabin');
        let maxLightI = 0, maxSpillDist = 0;
        if (restoredPod) restoredPod.traverse((o) => {
          const l = o as THREE.Light & { distance?: number };
          if (l.isLight) {
            maxLightI = Math.max(maxLightI, l.intensity);
            // a wide-reaching point light (the hatch flood) is the terrain-pool culprit — track its reach.
            if ((o as THREE.PointLight).isPointLight) maxSpillDist = Math.max(maxSpillDist, (o as THREE.PointLight).distance);
          }
        });
        // parked ceiling: no interior light above ~2.5 (wake floods hit 7.3/14) and no point light
        //   reaching past ~5 m (the wake hatch flood was dist 9 — a bright terrain pool).
        report.lightsParked = !!restoredPod && maxLightI <= 2.5 && maxSpillDist <= 5.0;

        report.ok = report.builtBeforeSave && report.savedPodCrash && report.goneAfterTeardown
          && report.rebuiltAfterRestore && report.salvageMatches && report.chuteMatches
          && report.exposureRestored && report.lightsParked;
        return report;
      } catch (e) {
        report.error = e instanceof Error ? e.message : String(e);
        return report;
      }
    },
    buildHauler: () => { buildHaulerExterior(ctx); },
    disposeHauler: () => { disposeHaulerExterior(ctx); },
    setHaulerExplosion: (t) => { setHaulerExplosion(t); },
    // T3.2 — build + seat the pod cabin at the ORBIT frame (no descent base) so the
    //   explosion rig-shot can frame the real seated porthole eye against the star void.
    buildPodOrbit: () => {
      buildPodSceneDbg(ctx);
      const s = getPodSpawnDbg(ctx);
      ctx.player.body.body.setTranslation({ x: s.x, y: s.y, z: s.z }, true);
      ctx.player.cameraSnapNextFrame = true;
      if (ctx.intro) ctx.intro.mode = 'seated';
    },
    setCockpitAlert: (level) => { setShipCockpitAlert(level); },
    setSkyIntroMode: (space01) => { setSkyIntroMode(space01); },
    setHaulerDeparture: (t) => { setHaulerDeparture(t); },   // C1 — the eject-departure recession (rig-shot)
    setPlanetApproach: (t) => { setPlanetApproach(t); },     // C3 — the descent planet-approach (rig-shot)
    setShipAlert: (level, strobe) => { setShipRedAlert(level, strobe); },
    setEngineFire: (intensity, t) => { setShipEngineFire(intensity, t); },
    sunInfo: () => ({
      exposure: ctx.player.sunExposure01,
      occluders: getSunOccluders().length,
      boxes: getSunOccluders().map((o) => ({ cx: o.cx, cy: o.cy, cz: o.cz, hx: o.hx, hy: o.hy, hz: o.hz })),
    }),
    triggerCrash: (x, z) => triggerCrash(ctx, x, z),
    crashState: () => crashState(),
    advanceCrash: (seconds, substeps) => advanceCrash(ctx, seconds, substeps),
    crashRoundtrip: () => {
      const before = crashSites().length;
      const sv = saveGameState(ctx);              // → localStorage at v15, incl. crashes[]
      resetMeteorCrash(ctx);                       // simulate the world-clear that a load does
      const afterReset = crashSites().length;
      const ld = loadGameState(ctx);               // re-read v15 (gate must accept it) + stash crashes
      applyPendingCrashRestore(ctx);               // re-spawn the saved crash sites
      const afterRestore = crashSites().length;
      return { before, afterReset, afterRestore, saveOk: sv.ok, loadOk: ld.ok, loadErr: ld.error ?? null };
    },
    crashHeatProbe: () => {
      const sites = crashSites();
      const z0 = { center: 0, near: 0, half: 0, edge: 0, tempBefore: 0, tempAfter: 0, dTemp: 0, shelterAfter: 0 };
      if (!sites.length) return { ...z0, error: 'no crash site' };
      const s = sites[0];
      const body = ctx.player.body.body;
      const y = body.translation().y;
      const at = (dist: number): number => { body.setTranslation({ x: s.x + dist, y, z: s.z }, true); return crashHeatAt(ctx); };
      const center = at(0), near = at(2), half = at(Tuning.CRASH_HEAT_RADIUS * 0.5), edge = at(Tuning.CRASH_HEAT_RADIUS + 2);
      const wasPaused = ctx.flags.paused; ctx.flags.paused = false;
      const wasShelter = ctx.player.inShelter;
      // Bake test: sit at centre, zero the temperature, tick the real stats ~3s; expect a climb.
      body.setTranslation({ x: s.x, y, z: s.z }, true);
      ctx.player.inShelter = false;
      ctx.stats.temperature = 0;
      const tempBefore = ctx.stats.temperature;
      for (let i = 0; i < 180; i++) updateStats(ctx, 1 / 60);
      const tempAfter = +ctx.stats.temperature.toFixed(4);
      // Fix-3 regression guard: a crash fire registers a SHELTER zone at the centre — the bake must
      // STILL win (the heat suppresses shelter cooling). Pre-fix, inShelter would COOL → shelterAfter<0.
      ctx.player.inShelter = true;
      ctx.stats.temperature = 0;
      for (let i = 0; i < 180; i++) updateStats(ctx, 1 / 60);
      const shelterAfter = +ctx.stats.temperature.toFixed(4);
      ctx.player.inShelter = wasShelter; ctx.flags.paused = wasPaused;
      return { center: +center.toFixed(3), near: +near.toFixed(3), half: +half.toFixed(3), edge: +edge.toFixed(3), tempBefore, tempAfter, dTemp: +(tempAfter - tempBefore).toFixed(4), shelterAfter };
    },
    triggerWormCrossing: () => spawnWormCrossing(ctx),
    advanceWormCrossing: (seconds: number) => updateWormHorizonCrossing(ctx, ctx.terrain, seconds),
    poseLunge: (t = 0.5) => {
      const worm = ctx.sandWorms?.list?.[0];
      if (!worm) return { found: false };
      const groundY = ctx.terrain.heightAt(worm.basePos.x, worm.basePos.z);
      worm.surfaceGroundY = groundY;
      worm.state = 'lunge';
      applyLungePose(worm, t);
      worm.mesh.visible = true;
      applyMeshTransform(worm);
      worm.mesh.updateMatrixWorld(true);
      const halfLen = Tuning.SANDWORM_LENGTH / 2;
      const head = new THREE.Vector3(halfLen, 0, 0).applyMatrix4(worm.mesh.matrixWorld);
      const chargeY = groundY - Tuning.SANDWORM_MAX_RADIUS * Tuning.SANDWORM_CHARGE_SUBMERGE;
      return {
        found: true, t, groundY: +groundY.toFixed(2), chargeY: +chargeY.toFixed(2),
        centerY: +worm.basePos.y.toFixed(2), headWorldY: +head.y.toFixed(2),
        pitch: +worm.pitch.toFixed(3), bend: +worm.bend.toFixed(3),
      };
    },
    fireSignalFlare: (seconds = 0) => {
      fireSignalFlare(ctx);
      if (seconds > 0) advanceSignalFlares(ctx, seconds);
      return activeSignalFlareCount();
    },
    survivalProbe: (env, maxSeconds = 1500) => {
      const s = ctx.stats, p = ctx.player, tm = ctx.time, w = ctx.weather, f = ctx.flags;
      // Snapshot everything updateStats reads/writes.
      const snap = {
        thirst: s.thirst, hunger: s.hunger, temperature: s.temperature, health: s.health,
        stamina: s.stamina, dead: s.dead,
        inShelter: p.inShelter, sun01: p.sunExposure01, sunHeight: tm.sunHeight,
        wInt: w.intensity, devMode: f.devMode, paused: f.paused,
      };
      // Full stats + controlled environment. devMode=false forces the REAL death path
      // (the godmode floor is gated on GOD_MODE||devMode) so we can measure time-to-death.
      s.thirst = 1; s.hunger = 1; s.temperature = 0; s.health = 1; s.dead = false;
      w.intensity = 0; f.paused = false; f.devMode = false;
      if (env === 'heat') { tm.sunHeight = 1.0; p.sunExposure01 = 1; p.inShelter = false; }
      else if (env === 'cold') { tm.sunHeight = -0.5; p.sunExposure01 = 0; p.inShelter = false; }
      else { tm.sunHeight = 0.3; p.sunExposure01 = 0; p.inShelter = true; }   // thirst/hunger/prepared: shelter neutralizes temperature
      if (env === 'prepared') s.health = 0.3;   // start hurt → must heal back + never die
      const dt = 1 / 30;
      let elapsed = 0, died = false, minHealth = 1;
      for (; elapsed < maxSeconds; elapsed += dt) {
        // Isolate the path under test by topping the OTHER consumable needs each tick.
        if (env === 'thirst') s.hunger = 1;
        else if (env === 'hunger') s.thirst = 1;
        else if (env === 'prepared') { s.thirst = 1; s.hunger = 1; }
        updateStats(ctx, dt);
        minHealth = Math.min(minHealth, s.health);
        if (s.dead) { died = true; elapsed += dt; break; }
      }
      const result = {
        env, died,
        timeToDeathMin: died ? +(elapsed / 60).toFixed(2) : null,
        finalHealth: +s.health.toFixed(3), minHealth: +minHealth.toFixed(3),
      };
      // Restore.
      s.thirst = snap.thirst; s.hunger = snap.hunger; s.temperature = snap.temperature;
      s.health = snap.health; s.stamina = snap.stamina; s.dead = snap.dead;
      p.inShelter = snap.inShelter; p.sunExposure01 = snap.sun01; tm.sunHeight = snap.sunHeight;
      w.intensity = snap.wInt; f.devMode = snap.devMode; f.paused = snap.paused;
      return result;
    },
    triggerDeath: (cause = 'the desert took you') => {
      // Force the real death path: GOD_MODE is already off; clear the dev-mode floor so die() commits.
      ctx.flags.devMode = false;
      ctx.stats.dead = false;
      ctx.stats.health = 0;
      die(ctx, cause);
      const overlay = document.getElementById('death-screen');
      return { dead: ctx.stats.dead, overlayShown: !!overlay && !overlay.classList.contains('hidden') };
    },
    campStudio: () => {
      // Lay the camp objects in a row across the player's forward view so the C39
      // material swaps render. Spread perpendicular to the view direction.
      const cam = ctx.three.camera;
      const fwd = new THREE.Vector3(); cam.getWorldDirection(fwd); fwd.y = 0;
      if (fwd.lengthSq() < 1e-4) fwd.set(0, 0, -1);
      fwd.normalize();
      const right = new THREE.Vector3(fwd.z, 0, -fwd.x);   // horizontal right
      const base = new THREE.Vector3(cam.position.x, 0, cam.position.z).addScaledVector(fwd, 3.0);
      const yaw = Math.atan2(fwd.x, fwd.z);
      const at = (off: number) => {
        const p = base.clone().addScaledVector(right, off);
        p.y = ctx.terrain.heightAt(p.x, p.z);
        return p;
      };
      // The tent is intentionally OMITTED from the studio: its big fabric walls occlude the
      // smaller objects, and its wood poles share the same factory as the (visible) fire logs.
      const firePos = at(-1.1), bedPos = at(0.8), lanternPos = at(2.5);
      spawnFireAt(ctx, firePos, Tuning.FIRE_INITIAL_FUEL_S, true);
      spawnBedrollAt(ctx, bedPos, yaw);
      spawnLanternAt(ctx, lanternPos, yaw);
      void spawnTentAt;   // kept imported for parity; tent omitted from the studio framing
      const ren = ctx.three.renderer;
      ren.render(ctx.three.scene, cam);   // compile + populate program list for these materials
      return {
        center: [base.x, ctx.terrain.heightAt(base.x, base.z), base.z],
        programs: ren.info.programs ? ren.info.programs.length : -1,
      };
    },
    diegeticProbe: () => {
      const s = ctx.stats, w = ctx.weather;
      const snap = { thirst: s.thirst, hunger: s.hunger, temperature: s.temperature, health: s.health, wInt: w.intensity };
      setDiegeticActive(true);
      w.intensity = 0;   // peak storm suppresses the warning tints
      const op = (id: string) => +((document.getElementById(id) as HTMLElement | null)?.style.opacity ?? '0');
      const probe = (over: Partial<typeof snap>) => {
        s.thirst = 1; s.hunger = 1; s.temperature = 0; s.health = 1;
        Object.assign(s, over);
        updateStatVignette(ctx);
        return {
          cold: op('stat-vignette-cold'), thirst: op('stat-vignette-thirst'),
          heat: op('stat-vignette-heat'), hunger: op('stat-vignette-hunger'),
          health: op('stat-vignette-health'),
        };
      };
      const r = {
        thirsty: probe({ thirst: 0.04 }),
        cold: probe({ temperature: -0.9 }),
        hot: probe({ temperature: 0.9 }),
        starving: probe({ hunger: 0.04 }),
        wounded: probe({ health: 0.08 }),
        healthy: probe({}),
      };
      // Bar hide/show.
      setStatsBarsVisible(false);
      const barsHidden = ((document.getElementById('stats') as HTMLElement | null)?.style.display) === 'none';
      setStatsBarsVisible(true);
      const barsShown = ((document.getElementById('stats') as HTMLElement | null)?.style.display) !== 'none';
      // Restore.
      s.thirst = snap.thirst; s.hunger = snap.hunger; s.temperature = snap.temperature; s.health = snap.health;
      w.intensity = snap.wInt; setDiegeticActive(false); updateStatVignette(ctx);
      return { ...r, barsHidden, barsShown };
    },
    showDiegeticVignette: (stat) => {
      setDiegeticActive(true);
      ctx.weather.intensity = 0;
      const s = ctx.stats;
      s.thirst = 1; s.hunger = 1; s.temperature = 0; s.health = 1;
      if (stat === 'thirst') s.thirst = 0.04;
      else if (stat === 'cold') s.temperature = -0.92;
      else if (stat === 'heat') s.temperature = 0.92;
      else if (stat === 'hunger') s.hunger = 0.04;
      else if (stat === 'health') s.health = 0.06;
      // Kill the CSS opacity transition so the screenshot shows the exact target opacity
      // instantly (otherwise the 0.4s ease lags behind a single-frame render).
      for (const id of ['cold', 'thirst', 'heat', 'hunger', 'health']) {
        const el = document.getElementById('stat-vignette-' + id) as HTMLElement | null;
        if (el) el.style.transition = 'none';
      }
      updateStatVignette(ctx);
    },
    setStats: (s) => {
      if (s.thirst !== undefined) ctx.stats.thirst = s.thirst;
      if (s.temperature !== undefined) ctx.stats.temperature = s.temperature;
      if (s.hunger !== undefined) ctx.stats.hunger = s.hunger;
      if (s.stamina !== undefined) ctx.stats.stamina = s.stamina;
      if (s.health !== undefined) ctx.stats.health = s.health;
    },
    state: () => ({
      thirst: ctx.stats.thirst,
      temperature: ctx.stats.temperature,
      hunger: ctx.stats.hunger,
      stamina: ctx.stats.stamina,
      health: ctx.stats.health,
      dayTime: ctx.time.dayTime,
      playerDead: ctx.stats.dead,
    }),
    ctx,
    RAPIER,
    castDown(x, z, fromY = 100) {
      const ray = new RAPIER.Ray({ x, y: fromY, z }, { x: 0, y: -1, z: 0 });
      const hit = ctx.physics.world.castRay(ray, 500, true);
      if (!hit) return null;
      const hitY = fromY - hit.timeOfImpact;
      return {
        hitY,
        timeOfImpact: hit.timeOfImpact,
        colliderHandle: hit.collider.handle,
        shape: hit.collider.shape.type,
      };
    },
    setCloudiness(v) {
      if (v < 0) { ctx.weather.cloudinessHold = null; return; }
      ctx.weather.cloudinessHold = Math.max(0, Math.min(1, v));
      ctx.weather.cloudiness = ctx.weather.cloudinessHold;
    },
    triggerStorm() {
      // ACM fix: delegate to the real weather.triggerStorm, which ARMS the
      // sweeping wall (ACL D145 — intensity is wall-derived; the old inline
      // state-set left the wall dormant so a debug storm produced 0 intensity).
      triggerStormWeather(ctx);
    },
    spawnRaider(x, z) {
      const r = spawnRaiderEntity(
        ctx.three.scene, ctx.physics.world, ctx.terrain, ctx.assets,
        new THREE.Vector3(x, 0, z),
      );
      ctx.raiders.push(r);
      return r.id;
    },
    spawnFire(x, z) {
      // Default ~6m in front of the player so the rising plume frames cleanly.
      const tr = ctx.player.body.body.translation();
      let fx = x, fz = z;
      if (fx === undefined || fz === undefined) {
        const fwd = new THREE.Vector3();
        ctx.three.camera.getWorldDirection(fwd); fwd.y = 0;
        if (fwd.lengthSq() < 1e-4) fwd.set(0, 0, -1);
        fwd.normalize();
        fx = tr.x + fwd.x * 6; fz = tr.z + fwd.z * 6;
      }
      const pos = new THREE.Vector3(fx, ctx.terrain.heightAt(fx, fz), fz);
      const f = spawnFireAt(ctx, pos, Tuning.FIRE_INITIAL_FUEL_S, true);
      return f.id;
    },
    warmSmoke(seconds) {
      warmFireSmoke(ctx, seconds);
    },
    killRaider(id) {
      const r = ctx.raiders.find((rr) => rr.id === id);
      if (!r || r.bb.state === 'dead') return false;
      damageRaider(r, 9999, ctx);  // drives transitionTo('dead') + applyRaiderDeadPose
      return true;
    },
    killVulture(id) {
      const v = ctx.vultures.list.find((vv) => vv.id === id);
      if (!v || v.state === 'dead') return false;
      damageVulture(v, 9999, ctx);  // drives the dynamic-body tumble death (T5)
      return true;
    },
    dropTestItem(itemId) {
      // ACAS B2 — drop a dynamic-body pickup in front of the player to smoke-test
      // the per-item collider shape (capsule/sphere). Returns the new pickup id.
      const tr = ctx.player.body.body.translation();
      const p = spawnDroppedPickup(
        ctx.three.scene, ctx.terrain, { x: tr.x + 1.2, z: tr.z + 1.2 }, itemId as ItemId,
        undefined, { world: ctx.physics.world, initialVel: { x: 0, y: 1.0, z: 0 } },
      );
      ctx.pickups.list.push(p);
      return p.id;
    },
    craftChooserTest(items) {
      return __craftChooserTest(ctx, items as Array<{ id: ItemId; count: number }>);
    },
    injectTestRecipe() {
      // Register a transient recipe colliding with scrap_bar (scrap×2+branch×1) so
      // the multi-match chooser can be verified end-to-end.
      __registerTestRecipe({
        id: 9001, displayName: 'test alt', category: 'tool',
        inputs: [{ id: 'scrap', count: 2 }, { id: 'branch', count: 1 }],
        output: { id: 'scrap_bullet', count: 1 },
      });
    },
    enterGame(dev) {
      if (hooks.enterGame) hooks.enterGame(dev);
      else { ctx.flags.titleActive = false; ctx.flags.paused = false; }  // fallback
    },
    rigStudio(angle) {
      // enter + studio setup (idempotent)
      if (hooks.enterGame) hooks.enterGame(true);
      else { ctx.flags.titleActive = false; ctx.flags.paused = false; }
      const three = ctx.three;
      three.renderer.setSize(900, 1100, false);
      const cam = three.camera as THREE.PerspectiveCamera;
      if (cam.isPerspectiveCamera) { cam.aspect = 900 / 1100; cam.updateProjectionMatrix(); }
      ctx.flags.thirdPerson = true;
      three.scene.traverse((o) => {
        const l = o as THREE.Light;
        if (!l.isLight) return;
        if (l.type === 'AmbientLight') l.intensity = 2.2;
        else if (l.type === 'DirectionalLight' && l.intensity > 0) l.intensity = 2.4;
      });
      three.renderer.toneMappingExposure = 2.0;
      if (!angle) {
        return 'studio entered + lit (UNPAUSED to settle the rig — call rigStudio(angle) after a beat to frame)';
      }
      // frame a canonical angle (pause so the 3P sync stops overwriting the camera)
      ctx.flags.paused = true;
      const rig = ctx.player.rig;
      if (!rig) return { angle, framed: false, reason: 'no rig' };
      rig.group.updateMatrixWorld(true);
      const bp = ctx.player.body.body.translation();
      const fwd = new THREE.Vector3();
      rig.headGroup.getWorldDirection(fwd);
      fwd.y = 0;
      if (fwd.lengthSq() < 1e-4) fwd.set(1, 0, 0);
      fwd.normalize();
      // The head's +Z (getWorldDirection) now points TOWARD the face: PM-B.1
      // (ACI) rebuilt the hood with its opening + the bandana on +Z, flipping
      // the face from -Z to +Z. So we frame the +Z side directly (NO negate).
      // (D135 added a negate when the face was at -Z; PM-B.1 silently inverted
      // that, so every 'head'/'front' shot from ACI→ACJ showed the BACK until
      // PM-B.2 caught it empirically — the head is symmetric, so it didn't error.)
      const side = new THREE.Vector3(-fwd.z, 0, fwd.x);
      const body = new THREE.Vector3(bp.x, bp.y - 0.05, bp.z);
      const D = 2.6, UP = 0.35;
      let camPos = new THREE.Vector3();
      let tgt = body.clone();
      if (angle === 'head') {
        const hp = new THREE.Vector3();
        rig.headGroup.getWorldPosition(hp);
        camPos = hp.clone().addScaledVector(fwd, 0.55).addScaledVector(side, 0.22);
        camPos.y += 0.05;
        tgt = new THREE.Vector3(hp.x, hp.y - 0.05, hp.z);
      } else if (angle === 'back') {
        camPos = body.clone().addScaledVector(fwd, -D); camPos.y += UP;
      } else if (angle === 'left') {
        camPos = body.clone().addScaledVector(side, D); camPos.y += UP;
      } else if (angle === 'right') {
        camPos = body.clone().addScaledVector(side, -D); camPos.y += UP;
      } else if (angle === '3q') {
        camPos = body.clone().addScaledVector(fwd, D * 0.8).addScaledVector(side, D * 0.6); camPos.y += UP;
      } else { // 'front'
        camPos = body.clone().addScaledVector(fwd, D); camPos.y += UP;
      }
      cam.position.copy(camPos);
      cam.lookAt(tgt);
      return { angle, framed: true };
    },
    itemStudio(id, angle) {
      // enter + headless render (idempotent), then suspend the item alone.
      if (hooks.enterGame) hooks.enterGame(true);
      else { ctx.flags.titleActive = false; ctx.flags.paused = false; }
      const three = ctx.three;
      three.renderer.setSize(900, 900, false);
      const cam = three.camera as THREE.PerspectiveCamera;
      if (cam.isPerspectiveCamera) { cam.aspect = 1; cam.updateProjectionMatrix(); }
      three.renderer.toneMappingExposure = 1.45;
      ctx.flags.paused = true;
      // Hide the player rig so it never intrudes on the isolated item framing.
      if (ctx.player.rig) ctx.player.rig.group.visible = false;

      // Build the studio rig once (adding lights triggers one lightsHash
      // recompile — acceptable on this debug-only path).
      if (!studioGroup) {
        studioGroup = new THREE.Group();
        studioGroup.name = '__itemStudio';
        const key = new THREE.DirectionalLight(0xfff1dc, 2.6);
        key.position.set(2.5, 3.5, 2.0);       // raking top-right key for greebles
        const fill = new THREE.DirectionalLight(0xaec6ff, 0.85);
        fill.position.set(-2.2, 1.0, -1.4);    // cool back-fill
        const amb = new THREE.AmbientLight(0xffffff, 0.85);
        // ACAV — a CAVITY light: rays roughly -Z (DirectionalLight target = origin)
        // rake INTO the +Z-facing recessed panel cavity the key/fill leave shadowed.
        const cavity = new THREE.DirectionalLight(0xffe6c0, 1.5);
        cavity.position.set(0.5, 0.9, 4.0);
        studioGroup.add(key, fill, amb, cavity);
        three.scene.add(studioGroup);
      }
      if (studioMesh) { studioGroup.remove(studioMesh); studioMesh = null; }

      const def = getItemDef(id);
      if (!def.makeViewModel) return { id, ok: false, reason: 'no makeViewModel' };
      const mesh = def.makeViewModel();

      // Anchor high above the player so the backdrop is pure sky gradient — no
      // terrain/wrecks behind the item.
      const bp = ctx.player.body.body.translation();
      // Suspend high in the sky so terrain/wrecks fall far outside the narrow
      // (≈0.6m) framing → pure sky-gradient backdrop on every angle.
      const anchor = new THREE.Vector3(bp.x, bp.y + 40, bp.z);
      mesh.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(mesh);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const radius = Math.max(size.x, size.y, size.z, 0.04) * 0.5;
      mesh.position.sub(center).add(anchor);   // bbox center → anchor
      studioGroup.add(mesh);
      studioMesh = mesh;
      studioGroup.updateMatrixWorld(true);

      const dist = radius * 3.0 + 0.06;
      // Slightly-below-level eye on the side/3q angles → the framing cone behind
      // the item is sky, not distant ground. 'top' looks down by design.
      const dir = new THREE.Vector3(0, -0.06, 1);
      if (angle === 'back') dir.set(0, -0.06, -1);
      else if (angle === 'left') dir.set(-1, -0.06, 0);
      else if (angle === 'right') dir.set(1, -0.06, 0);
      else if (angle === 'top') dir.set(0.12, 1, 0.18);
      else if (angle === '3q') dir.set(0.8, 0.10, 0.8);
      dir.normalize();
      cam.position.copy(anchor).addScaledVector(dir, dist);
      cam.lookAt(anchor);
      cam.updateMatrixWorld(true);
      return { id, angle: angle ?? 'front', ok: true, radius: +radius.toFixed(3) };
    },
    spawnPanelStudio(opts) {
      // ACAV — isolated single-panel framer for the shape + interior visual loop
      // (clones itemStudio's lit-for-form rig + sky-suspend). Build → screenshot →
      // critique → iterate (rule 8). Tier 3+ threads o.shape/o.archetype through.
      const o = opts ?? {};
      const scale = o.scale ?? 1;
      const kind = (o.kind ?? 'fuselage') as PanelKind;
      const angle = o.angle ?? '3q';
      if (hooks.enterGame) hooks.enterGame(true);
      else { ctx.flags.titleActive = false; ctx.flags.paused = false; }
      const three = ctx.three;
      three.renderer.setSize(900, 900, false);
      const cam = three.camera as THREE.PerspectiveCamera;
      if (cam.isPerspectiveCamera) { cam.aspect = 1; cam.updateProjectionMatrix(); }
      three.renderer.toneMappingExposure = 1.45;
      ctx.flags.paused = true;
      if (ctx.player.rig) ctx.player.rig.group.visible = false;
      if (!studioGroup) {
        studioGroup = new THREE.Group();
        studioGroup.name = '__itemStudio';
        const key = new THREE.DirectionalLight(0xfff1dc, 2.6);
        key.position.set(2.5, 3.5, 2.0);
        const fill = new THREE.DirectionalLight(0xaec6ff, 0.85);
        fill.position.set(-2.2, 1.0, -1.4);
        const amb = new THREE.AmbientLight(0xffffff, 0.85);
        // ACAV — a CAVITY light: rays roughly -Z (DirectionalLight target = origin)
        // rake INTO the +Z-facing recessed panel cavity the key/fill leave shadowed.
        const cavity = new THREE.DirectionalLight(0xffe6c0, 1.5);
        cavity.position.set(0.5, 0.9, 4.0);
        studioGroup.add(key, fill, amb, cavity);
        three.scene.add(studioGroup);
      }
      if (studioMesh) { studioGroup.remove(studioMesh); studioMesh = null; }

      // Build ONE panel into a host group. faceYaw 0 → the panel front (door/rim)
      // faces +Z, so the camera frames the front.
      const host = new THREE.Group();
      const body = addAccessPanel(host, 0, 0, 0, scale, 0, kind, {
        shape: o.shape,
        archetype: o.archetype as PanelArchetype | undefined,
        rand: makeRng(1337),     // deterministic greeble → comparable A/B shots
      });
      // Force-open: paused → updatePanelDoors won't run, so apply the open transform
      // directly (shape-aware: rect hinge swing vs circle lift-off cover slide+tumble).
      if (o.open && body) {
        const open = Tuning.SALVAGE_PANEL_DOOR_OPEN_ANGLE;
        body.userData.panelOpened = true;
        body.userData.panelDoorAngle = open;
        const door = body.userData.panelDoor as THREE.Object3D | undefined;
        if (door) {
          if (body.userData.panelShape === 'circle') {
            const baseZ = (door.userData.panelCoverBaseZ as number | undefined) ?? 0;
            const slide = (door.userData.panelCoverSlide as number | undefined) ?? 0.3;
            door.position.z = baseZ + slide;
            door.rotation.x = 1.0;
          } else {
            door.rotation.y = -open;
          }
        }
        // ACAX — paused studio skips updatePanelDoors, so reveal the portal mask
        // + the (now default-hidden) interior group directly.
        const mask = body.userData.panelMask as THREE.Object3D | undefined;
        if (mask) mask.visible = true;
        const interior = body.userData.panelInterior as THREE.Object3D | undefined;
        if (interior) interior.visible = true;
      }
      // ACAX Tier A spike — drop a rust hull SLAB just in front of the open mouth
      // to simulate the wreck hull clipping IN FRONT of a recessed cavity. Without
      // the stencil portal the slab hides the interior; with it, the interior shows
      // THROUGH the slab but only inside the panel mouth. Sized to fully cover.
      if (o.occlude && body) {
        const slab = new THREE.Mesh(
          new THREE.BoxGeometry(0.9 * scale, 1.3 * scale, 0.1),
          createRustedHullMaterial({ baseColor: Tuning.WRECK_HULL_HEX }),
        );
        slab.position.set(0, 0, 0.14 * scale);   // between the mouth (~+0.10) and the camera
        slab.userData.noCollider = true;
        host.add(slab);
      }
      const bp = ctx.player.body.body.translation();
      const anchor = new THREE.Vector3(bp.x, bp.y + 40, bp.z);   // sky backdrop
      host.position.copy(anchor);
      studioGroup.add(host);
      studioMesh = host;
      host.updateMatrixWorld(true);

      // Frame on the panel CENTRE (anchor) — the bbox centre is skewed by the swung
      // door. dist from a nominal panel size, CLOSER for open so the cavity fills
      // the frame (the interior is the subject).
      const nominal = 0.7 * scale;
      const dist = nominal * (o.open ? 1.15 : 1.8);
      const dir = new THREE.Vector3(0, 0.05, 1);                 // 'front'
      if (angle === '3q') dir.set(0.6, 0.16, 0.85);
      else if (angle === 'side') dir.set(1, 0.05, 0.18);
      else if (angle === 'eye') dir.set(0.16, -0.30, 1);        // player looking at a hull panel
      else if (angle === 'top') dir.set(0.1, 1, 0.2);
      dir.normalize();
      cam.position.copy(anchor).addScaledVector(dir, dist);
      cam.lookAt(anchor);
      cam.updateMatrixWorld(true);
      let meshCount = 0;
      host.traverse((n) => { if ((n as THREE.Mesh).isMesh) meshCount++; });
      return { ok: true, shape: o.shape ?? 'rect', archetype: o.archetype ?? '-', kind, open: !!o.open, angle, meshCount };
    },
    wreckFormStudio(form, angle) {
      if (hooks.enterGame) hooks.enterGame(true);
      else { ctx.flags.titleActive = false; ctx.flags.paused = false; }
      const three = ctx.three;
      three.renderer.setSize(900, 900, false);
      const cam = three.camera as THREE.PerspectiveCamera;
      if (cam.isPerspectiveCamera) { cam.aspect = 1; cam.updateProjectionMatrix(); }
      three.renderer.toneMappingExposure = 1.4;
      ctx.flags.paused = true;
      if (ctx.player.rig) ctx.player.rig.group.visible = false;
      if (!studioGroup) {
        studioGroup = new THREE.Group();
        studioGroup.name = '__itemStudio';
        const key = new THREE.DirectionalLight(0xfff1dc, 2.6);
        key.position.set(2.5, 3.5, 2.0);
        const fill = new THREE.DirectionalLight(0xaec6ff, 0.85);
        fill.position.set(-2.2, 1.0, -1.4);
        const amb = new THREE.AmbientLight(0xffffff, 0.85);
        // ACAV — a CAVITY light: rays roughly -Z (DirectionalLight target = origin)
        // rake INTO the +Z-facing recessed panel cavity the key/fill leave shadowed.
        const cavity = new THREE.DirectionalLight(0xffe6c0, 1.5);
        cavity.position.set(0.5, 0.9, 4.0);
        studioGroup.add(key, fill, amb, cavity);
        three.scene.add(studioGroup);
      }
      if (studioMesh) { studioGroup.remove(studioMesh); studioMesh = null; }

      const rand = Math.random;
      const hullMat = createRustedHullMaterial({ baseColor: Tuning.WRECK_HULL_HEX, ...HULL_WEATHERING_ACAY });
      let node: THREE.Object3D;
      if (form === 'lathe') {
        node = makeLatheHull(fuselageProfile(6, 1.4, 0.3, 0.9, rand), { material: hullMat });
      } else if (form === 'formers') {
        const g = new THREE.Group();
        g.add(makeLatheHull(fuselageProfile(4, 1.3, 0.3, 1.1, rand), { material: hullMat, phiLength: Math.PI * 1.3 }));
        g.add(makeFormerRings(1.2, 4, 0.5, { startX: 0.3 }));
        node = g;
      } else if (form === 'breach') {
        const g = new THREE.Group();
        const hull = makeLatheHull(fuselageProfile(5, 1.3, 0.3, 1.0, rand), { material: hullMat });
        g.add(hull);
        const breach = makeBreach(0.7, rand);
        breach.position.set(2.6, 0, 1.25);   // on the +Z flank
        breach.rotation.y = 0;               // +Z outward
        g.add(breach);
        node = g;
      } else {
        node = makeSandMound(ctx.terrain, 0, 0, new THREE.Vector2(1, 0), 3, rand);
        node.position.set(0, 0, 0);          // reframed below
      }

      const bp = ctx.player.body.body.translation();
      const anchor = new THREE.Vector3(bp.x, bp.y + 60, bp.z);
      node.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(node);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const radius = Math.max(size.x, size.y, size.z, 0.1) * 0.5;
      node.position.sub(center).add(anchor);
      studioGroup.add(node);
      studioMesh = node;
      studioGroup.updateMatrixWorld(true);

      const dist = radius * 2.6 + 0.5;
      const dir = new THREE.Vector3(0.2, 0.12, 1);
      if (angle === 'side') dir.set(0, 0.08, 1);
      else if (angle === '3q') dir.set(0.85, 0.18, 0.85);
      else if (angle === 'top') dir.set(0.1, 1, 0.2);
      else if (angle === 'front') dir.set(1, 0.12, 0.15);   // down the +X nose
      dir.normalize();
      cam.position.copy(anchor).addScaledVector(dir, dist);
      cam.lookAt(anchor);
      cam.updateMatrixWorld(true);
      return { form, angle: angle ?? 'side', ok: true, radius: +radius.toFixed(2) };
    },
    spawnProcgenWreckRig(cls = 'corvette', seed = 1337, archetype?: ArchetypeId, pinYaw = false) {
      // Ensure the world is live (idempotent) — same enter path the studios use.
      if (hooks.enterGame) hooks.enterGame(true);
      else { ctx.flags.titleActive = false; ctx.flags.paused = false; }
      // Remove + dispose a prior subject so re-calls (swap class/seed) don't leak.
      if (procgenRigGroup) {
        ctx.three.scene.remove(procgenRigGroup);
        procgenRigGroup.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) m.geometry?.dispose(); });
        procgenRigGroup = null;
      }
      // Deterministic stream: same (cls, seed) reproduces the same wreck, so a
      // before/after A/B of a visual change is comparable (unlike the random
      // world-seed, which makes cross-boot snapshots incomparable).
      const rand = makeRng(seed);
      // Spawn inside the player-spawn exclusion ring (procgenPoi keeps other
      // procgen wrecks ≥80m from the anchor), offset from the anchor so the
      // subject isn't on top of the hidden player body → an isolated subject.
      const px = Tuning.OPENING_SCENE_ANCHOR_X + 30;
      const pz = Tuning.OPENING_SCENE_ANCHOR_Z + 30;
      const py = ctx.terrain.heightAt(px, pz);
      const pos = new THREE.Vector3(px, py, pz);
      // ACBA — when an archetype is given (satellite / tank_cluster / …) route through
      // the new socket/grammar pipeline; else the legacy linear ship assembler.
      const group = archetype && archetype !== 'ship'
        ? placeProcgenPOI(ctx.three.scene, ctx.physics.world, ctx.terrain, pos, rand, undefined, { archetype })
        : placeProcgenComposite(ctx.three.scene, ctx.physics.world, ctx.terrain, pos, rand, undefined, { cls });
      // placeProcgen* applies a RANDOM yaw (+ terrain tilt) so the detail flank faces an
      // arbitrary world direction. For SHIPS, PIN to a known crash pose so the framer's
      // broadside reliably sees the detail flank. POIs KEEP their real terrain-aligned
      // seating (so the inspection shows true in-world ground contact, not a forced level
      // that would float a wide slab on a slope).
      if (!(archetype && archetype !== 'ship')) {
        group.rotation.set(0, 0, -0.06);
      } else if (pinYaw) {
        // M7 ⑤ (C41) — LENGTH-FRAME pin for the visual gate: the socket-grammar ship spine
        // is built along local +Z; the rig framer assumes the subject is X-long, so a random
        // world-yaw can catch a derelict END-ON (reads as a blob, grades the camera not the
        // asset — the harness footgun). Pin the spine broadside (+Z → +X) + a slight list so
        // every seed is consistently length-framed. (Default off: normal inspection keeps the
        // real terrain-aligned yaw so ground contact reads true.)
        group.rotation.set(0.07, Math.PI / 2, 0);
      }
      group.updateMatrixWorld(true);
      group.name = 'procgenWreckRig';
      procgenRigGroup = group;
      let meshes = 0;
      group.traverse((o) => { if ((o as THREE.Mesh).isMesh) meshes++; });
      return { cls, seed, ok: true, meshes, pos: [px, +py.toFixed(1), pz] };
    },
    auditPOIColliders(archetype: ArchetypeId, seed = 1337) {
      // ACBB Tier 3 — pure assemble+measure (no scene/physics state touched), so it's safe
      // to call at the title screen; the audit lives in poiAssembler (group-local coverage).
      return auditArchetypeColliders(archetype, seed);
    },
    popTestDoor(seed = 1337) {
      // ACAX — smoke test for the door pop-off. Enter the game LIVE (NOT paused) so
      // physics.step + updatePanelDebris actually run and the door falls.
      if (hooks.enterGame) hooks.enterGame(true);
      else { ctx.flags.titleActive = false; ctx.flags.paused = false; }
      ctx.flags.paused = false;
      const rand = makeRng(seed);
      const px = Tuning.OPENING_SCENE_ANCHOR_X + 30;
      const pz = Tuning.OPENING_SCENE_ANCHOR_Z + 30;
      const py = ctx.terrain.heightAt(px, pz);
      const group = placeProcgenComposite(
        ctx.three.scene, ctx.physics.world, ctx.terrain, new THREE.Vector3(px, py, pz), rand, undefined, { cls: 'corvette' },
      );
      group.updateMatrixWorld(true);
      // Find a panel body that has a poppable door ref.
      let panel: THREE.Object3D | null = null;
      group.traverse((o) => { if (!panel && o.userData && o.userData.panelDoorVisual) panel = o; });
      if (!panel) return { ok: false, reason: 'no poppable panel found' };
      const p = panel as THREE.Object3D;
      p.userData.panelOpened = true;
      p.userData.panelGlowStartedAt = ctx.time.elapsed;
      const visual = p.userData.panelDoorVisual as THREE.Object3D;
      visual.updateWorldMatrix(true, false);
      const spawnY = new THREE.Vector3().setFromMatrixPosition(visual.matrixWorld).y;
      const popped = popPanelDoor(ctx, p);
      p.userData.panelDoorAngle = Tuning.SALVAGE_PANEL_DOOR_OPEN_ANGLE;
      p.userData.panelDoorTarget = Tuning.SALVAGE_PANEL_DOOR_OPEN_ANGLE;
      const wp = new THREE.Vector3(); p.getWorldPosition(wp);
      return { ok: popped, spawnY: +spawnY.toFixed(2), panel: [+wp.x.toFixed(1), +wp.y.toFixed(2), +wp.z.toFixed(1)] };
    },
    panelDebris() { return panelDebrisInfo(); },
    panelBuryAudit() {
      // ACAV — delegates to the unified validatePanels (world/panelPlacement.ts) in
      // read-only AUDIT mode (each panel walks up to its scene-root). OCCLUSION-only:
      // a global terrain check here false-flags legitimately-below-surface INTERIOR
      // panels (mega-wreck interior, rockyEntrance chamber, flagship recessed bells).
      // The terrain CULL runs on the surface-wreck gen paths instead (procgen
      // composite + legacy placeWreck + the wreck-yard cluster). A surface-scoped
      // terrain audit lands in Tier 5. Reshapes to the historical {idx,kind,hit}.
      const reg = (ctx as unknown as { salvageables?: { list: Array<{ panel: THREE.Object3D; kind?: string; wreckKind?: string }> } }).salvageables;
      const entries: PanelEntry[] = (reg?.list ?? []).map((s) => ({
        body: s.panel,
        kind: s.kind || s.wreckKind || '?',
      }));
      const report = validatePanels(entries, { scene: ctx.three.scene, audit: true });
      // ACBA — surface-scoped TERRAIN audit: re-check ONLY panels the GEN cull tagged
      // terrainCullEligible (interiors excluded), corner-aware. Surviving surface panels
      // should all clear sand; a fail here means the corner cull (or seating) regressed.
      const terr = validatePanels(entries, { scene: ctx.three.scene, audit: true, terrain: ctx.terrain, terrainOnly: true });
      return {
        tested: report.tested,
        pass: report.pass,
        failCount: report.failCount,
        fails: report.fails.slice(0, 12).map((f) => ({ idx: f.idx, kind: f.kind, hit: f.detail })),
        terrain: {
          tested: terr.tested,
          pass: terr.pass,
          failCount: terr.failCount,
          fails: terr.fails.slice(0, 12).map((f) => ({ idx: f.idx, kind: f.kind, hit: f.detail })),
        },
      };
    },
    resetTutorial,
    showControls() { showControlsPanel(ctx); },
    audioState: () => getAudioStateSnapshot(ctx),
    musicState: () => getMusicStateSnapshot(),
  };
}
