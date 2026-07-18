// Dustfall — orchestrator. Each system lives in its own module.

import './style.css';
import * as THREE from 'three';
import type { GameContext } from './GameContext.ts';
import { Tuning } from './config/tuning.ts';
import { makeRng } from './core/rng.ts';
import { createScene } from './core/scene.ts';
import { createLights, updateLighting } from './core/lighting.ts';
import { createLightPool } from './core/lightPool.ts';
import { createInput, wireOverlays, endInputFrame, pointerLockSuppressed } from './core/input.ts';
import { startLoop } from './core/loop.ts';
import { createPhysicsWorld } from './physics/world.ts';
import { makePlayer } from './physics/bodies.ts';
import { installPhysicsDebug, updatePhysicsDebug } from './physics/debug.ts';
import { preloadAssets } from './assets/loader.ts';
import { createTerrain } from './world/terrain.ts';
import { createChunkManager, updateChunks } from './world/chunkManager.ts';   // Infinite Sands S1
import { createBiomeSampler } from './world/biomes.ts';
import { placePOIs, getAnchorPOIPositions, getWreckYardCarcasses } from './world/poi.ts';
import { placeProcgenPOIs } from './world/procgenPoi.ts';
import { placeHeroLandmarks } from './world/heroLandmarks.ts';
import { placeLeviathanLandmark, updateLeviathanLandmark } from './world/leviathanLandmark.ts';   // horizon-hook: the beached-leviathan wreck ~360m out on the intro reveal gaze (+ its proximity-gated interior lights)
import { placeWordlessScenes } from './world/wordlessScenes.ts';   // M5b (C32) — environmental-storytelling tableaux
import { addHorizonSilhouettesByName } from './world/horizonSilhouettes.ts';   // M5a (C28) — registers tall wrecks as sun occluders (billboards removed ACBD)
import { initSpyglass, updateSpyglass } from './player/spyglass.ts';   // M5a (C29) — hold-RMB spyglass zoom
import { updateVistaReveal } from './world/vistaReveal.ts';   // M5a (C30) — crest-a-ridge fog-lift + swell
import { updateSunExposure } from './world/sunExposure.ts';   // M5a (C31) — direct-sun vs shade (heat relief)
import { updateDayBeats, resetDayBeats } from './world/dayBeats.ts';   // M5b (C35) — dawn/dusk tonal beats
import { initWormHorizonCrossing, updateWormHorizonCrossing, resetWormHorizonCrossing } from './world/wormHorizonCrossing.ts';   // M5b (C36) — distant worm sighting
import { initMeteorCrash, updateMeteorCrash, resetMeteorCrash, applyPendingCrashRestore } from './world/meteorCrash.ts';   // ACBE (D1) — the crashing-wreck hero event
import { updateCameraShake, resetCameraShake } from './fx/cameraShake.ts';   // ACBE (D1) — trauma camera shake
import { initScreenFlash, updateScreenFlash, resetScreenFlash } from './fx/screenFlash.ts';   // ACBE (D1) — impact screen flash
import { createSalvageableRegistry, setSalvageBiomesContext } from './world/salvage.ts';
import { createSky, updateSky } from './world/sky.ts';
import { updateStats } from './stats/survival.ts';
import { createHud, updateHud } from './ui/hud.ts';
import { createHotbar, updateHotbar } from './ui/hotbar.ts';
import { createInteractPrompt, updateInteractPrompt } from './ui/interactPrompt.ts';
import { spawnBranches, spawnScrapAt, spawnRelicAt, spawnMaterialAt, updatePickups } from './pickups/pickups.ts';
import { scatterForArchetype } from './config/lootRegistry.ts';   // walk-test fix — origin-world identity material scatter
import { updatePanelDebris } from './world/panelDebris.ts';   // ACAX — popped panel-door physics sync
import { spawnDeadTrees } from './world/deadTree.ts';
import { spawnRockScatter } from './world/rockScatter.ts';
import { setupOpeningScene } from './world/openingScene.ts';
import { updateOpeningWreckGodRay } from './world/openingWreck.ts';
import { updateLanterns } from './world/lantern.ts';
import { updateLargeTents } from './world/largeTent.ts';
import { updateCompanion, spawnCompanionAt, despawnCompanion } from './enemies/companion.ts';
import { createFootprintPuffs, updateFootprintPuffs } from './world/footprintPuffs.ts';
import { hasSave } from './persistence/save.ts';
import { createJournalPanel } from './ui/journalPanel.ts';
import type { Journal } from './world/journal.ts';
import { createInventory, updateInventoryInput } from './inventory/inventory.ts';
import { updateInteraction } from './player/interaction.ts';
import { updatePlayer } from './player/controller.ts';
import { updateEscapePodIntro, startEscapePodIntro, introActive } from './world/escapePodIntro/sequence.ts';   // escape-pod intro (FEATURES.escapePodIntro) — T0.1 wires the new-game branch
import { updatePodTutorial, resumePodTutorialAfterRestore } from './world/escapePodIntro/podTutorial.ts';   // T4.3 — the post-handoff craft→salvage→chute-pop tutorial (self-guarded no-op unless running); resumePodTutorialAfterRestore — re-arm the payoff after a Continue re-built the pod
import { updateChutePop, applyPendingPodCrashRestore } from './world/escapePodIntro/podScene.ts';   // T4.3 — the chute-pop inflate one-shot (no-op unless the chute is popping; driven always so dev/rig-shot also animates); applyPendingPodCrashRestore — re-build the ONE walk-in pod on Continue
import { setGameHudHidden, hideIntroLoading, introLoadingAwaitLaunchClick, showIntroLoading, setIntroLoadingBackdrop } from './world/escapePodIntro/introHud.ts';   // escape-pod intro — HUD-hide + the loading screen's click-to-launch recovery (the pointer-lock gesture-expiry freeze fix) + Y6 the frozen-menu backdrop (kills the desert flash)
import { preloadIntro } from './world/escapePodIntro/introPreload.ts';   // PERF — build every intro scene + compile every shader UP FRONT behind the loading screen (kills the beat-entry freezes)
import { FEATURES } from './config/features.ts';
import { createShelterRegistry, updateShelter } from './shelter/shelterZones.ts';
import { updateSoundscape } from './audio/soundscape.ts';
import { startMusic, updateMusic, setMusicSuppressed } from './audio/music.ts';
import { updateRaiders, type Raider } from './enemies/raider.ts';
import { spawnLizardsProcgen, updateLizards } from './enemies/lizard.ts';
import { spawnShrewsProcgen, updateShrews } from './enemies/shrew.ts'; // ACL DESERT SHREW
import { spawnVulturesProcgen, spawnCirclingVultures, updateVultures } from './enemies/vulture.ts'; // ACAH
import { spawnSandWorm, sampleSandwormHome, updateSandWorm } from './enemies/sandWorm.ts';
import { spawnSarlaccPit, updateSarlaccPit } from './enemies/sarlaccPit.ts';
import { spawnDeepCave, updateDeepCave } from './world/deepCave.ts';
import { updateWieldAction } from './player/wieldAction.ts';
import { updateReload } from './player/combat.ts';
import { createGhostPreview, updateGhostPreview } from './player/ghostPreview.ts';
import { createViewModel, updateViewModel } from './player/viewModel.ts';
import { buildPlayerRig, updatePlayerRig } from './player/playerRig.ts';
import { createWeather, updateWeather } from './world/weather.ts';
import { createAmbientDust, updateAmbientDust } from './world/ambientDust.ts';
import { createDustMotes, updateDustMotes } from './world/dustMotes.ts';
import { updateTerrainShaderUniforms } from './world/terrainMaterial.ts';
import { updateFabricShaderUniforms } from './world/fabricMaterial.ts';
import { createStormVignette, updateStormVignette } from './world/stormVignette.ts';
import { createStatVignette, updateStatVignette } from './ui/statVignette.ts';
import { updateStaminaWobble } from './player/staminaWobble.ts';
import { updateSpeeder } from './world/speeder.ts';
import { updateSleds, updateSledRiders } from './world/sled.ts';
import { updateKillDrag } from './world/killDrag.ts';
import { spawnWaterSources } from './world/waterSources.ts';
import { spawnCacti, updateCacti } from './world/cactus.ts';
import { updateFires } from './world/fire.ts';
import { updateSignalFlares } from './world/signalFlare.ts';   // M6 (C37) — transient signal-flare arcs
import { createFootprintRegistry, updateFootprints } from './world/footprints.ts';
import { addItem } from './inventory/inventory.ts';
import { createMenus } from './ui/menus.ts';
import { createLootMenu } from './ui/lootMenu.ts';
import { createCraftingMenu } from './ui/craftingMenu.ts';
import { createSleepOverlay } from './ui/sleepOverlay.ts';
import { createInventoryOverlay } from './ui/inventoryOverlay.ts';
import { createDevItemPanel, toggleDevItemPanel } from './ui/devPanel.ts';
import { createPerfHud, updatePerfHud } from './ui/perfHud.ts';
import { createTutorial } from './ui/tutorial.ts';
import { installDebugPanel } from './debug/debugPanel.ts';
import { createTitleScene } from './world/titleScene.ts';
import { createTitleOverlay } from './ui/titleOverlay.ts';
import { ensureAudioStarted, stopWormRumble } from './audio/audio.ts';
import { startSoundscape, setSoundscapeSuppressed } from './audio/soundscape.ts';
// AAP — startMusic imported above (alongside updateMusic).
import { clearSave, loadGameState, peekSavedSeed } from './persistence/save.ts';
import { ALL_RECIPE_IDS } from './inventory/recipeDiscovery.ts';

// --- Bootstrap (async — Rapier WASM + asset preload before world build) ---
const [physics, assets] = await Promise.all([
  createPhysicsWorld(),
  preloadAssets(),
]);

const three = createScene();
const lights = createLights(three.scene);
// AAY-fix — pre-allocated PointLight pool. MUST be created BEFORE any
// world entity that uses a light (salvage panels, fires, lanterns), so
// the pool lights are part of the initial scene state and don't bump
// the renderer's lightsHash at runtime (which would force a multi-
// hundred-ms shader recompile across every lit material). See
// src/core/lightPool.ts. Size 24 covers worst-case simultaneous use.
// ABL — perf: bumped 24 → 30 to absorb salvage-panel cavity glows
// (previously each of ~68 panels had its own per-panel PointLight,
// driving scene PointLight count to ~96 and inflating per-fragment
// shader cost for every lit material). Salvage glows now claim/
// release from the pool like fires + lanterns.
const lightPool = createLightPool(three.scene, 30);
const input = createInput(three.camera, three.renderer.domElement);
const hud = createHud();
createHotbar();
createInteractPrompt();

// AAI — resolve the world seed BEFORE building any procgen system. Three
// sources, in priority order:
//   1. localStorage['dustfall.pendingSeed'] — set by titleOverlay's
//      Advanced seed entry OR by the NEW GAME button auto-roll. Consumed
//      (removed) here so a refresh after gameplay re-uses the saved seed.
//   2. peekSavedSeed() — the seed of the existing save (Continue path).
//   3. Tuning.RNG_SEED — dev/test fallback (effectively only when both
//      localStorage and save are empty, i.e., first-ever boot).
function resolveSeed(): number {
  const PENDING_KEY = 'dustfall.pendingSeed';
  const pending = localStorage.getItem(PENDING_KEY);
  if (pending !== null) {
    localStorage.removeItem(PENDING_KEY);
    const n = parseInt(pending, 10);
    if (!Number.isNaN(n) && Number.isFinite(n) && n >= 0) {
      return n >>> 0;
    }
  }
  const saved = peekSavedSeed();
  if (saved !== null) return saved;
  // No pending seed + no save — fresh-first-boot. Inline-roll so the
  // first-ever NEW GAME plays a random world (not the dev-fallback 1337).
  // Tuning.RNG_SEED is retained for dev/test paths that explicitly set
  // pendingSeed to that value, but it's not the production default.
  return Math.floor(Math.random() * 0x100000000) >>> 0;
}
const worldSeed = resolveSeed();
// Reference Tuning.RNG_SEED to silence unused-import; it's the documented
// dev/test fallback (per D85) used when localStorage is pre-seeded to it.
void Tuning.RNG_SEED;

// Three RNG streams: terrain shape, prop scatter, biome noise. All
// derived from worldSeed so the same seed regenerates the same world.
const terrainRand = makeRng(worldSeed);
const scatterRand = makeRng(worldSeed + 1);

const shelter = createShelterRegistry();
// Biome sampler is independent of terrain heights but derived from the
// same root seed so the world is fully deterministic.
const biomes = createBiomeSampler(makeRng(worldSeed + 17));
// AAT — salvage condition picker needs biome lookups at registerSalvageable
// time. Wire it once here so the salvage module has access without a
// signature change to every registerSalvageable caller.
setSalvageBiomesContext(biomes);
// ACAH perf-diag — boot phase timing (temporary). Exposed on window.__bootT.
const _bootT: Array<[string, number]> = [['start', performance.now()]];
const _mark = (n: string): void => { _bootT.push([n, performance.now()]); };
(window as unknown as { __bootT: typeof _bootT }).__bootT = _bootT;
const terrain = createTerrain(three.scene, physics.world, terrainRand, biomes);
_mark('terrain');
// HH — the FF LOD ring was removed: its coarse 50m interpolation poked above
// the chunks' fine detail in dune valleys (D52 superseded). Fog at the
// chunk-band edge (1200m, density 0.0018 ≈ 99% opaque) is the visible
// horizon now.
// Session T — salvage registry. Built up-front so hero landmarks + POIs
// can register their wrecks as they're placed.
const salvageables = createSalvageableRegistry();
// Infinite Sands S1/S2 — content-chunk streaming manager. Constructed
// AFTER the salvage registry (streamed POIs register into it, marked
// transient) but stays inert until updateChunks ticks in normal play; the
// S1 marker layer defaults off. Boot placement below proceeds exactly as
// before — streamed POIs only exist beyond CHUNK_POI_ORIGIN_EXCLUSION_M.
const chunkManager = createChunkManager(three.scene, physics.world, terrain, biomes, salvageables, worldSeed);
// ACAI f/u — bone carcasses (ribcages) are ecology anchors: vultures circle them,
// lizards/shrews gather at them (a "something died here" cluster).
const carcasses = placeHeroLandmarks(three.scene, physics.world, terrain, scatterRand, salvageables);
// Scattered canteens were removed — the player starts with one (see below).
// Session W — branches no longer spawn as a random ground scatter. They're
// dropped in 2-4 clusters at the base of dead trees (see spawnDeadTrees
// below) so they have a visible source.
const pickupList = spawnBranches(three.scene, terrain, scatterRand, 0);
const treePerches = spawnDeadTrees(three.scene, terrain, scatterRand, pickupList, biomes, physics.world);
_mark('trees+branches');
const waterSources = spawnWaterSources(three.scene, terrain, scatterRand, biomes);
const cacti = spawnCacti(three.scene, physics.world, terrain, scatterRand, biomes);
// OO-4 — rocky biome rocks. Replaces the cracked-rock procedural
// shader with actual scatter geometry (read too similarly to salt
// flats as a shader pattern). No colliders — visual props only.
const scatterRocks = spawnRockScatter(three.scene, terrain, biomes, scatterRand);
// M5b (C32) — wordless prop scenes (a dedicated seeded RNG → does NOT perturb the
// scatter stream; decoration-only, no colliders; clears scatter rocks off each stage).
placeWordlessScenes(three.scene, terrain, worldSeed, scatterRocks);

// Hand-placed distant POIs (Session P). Adds a bandage pickup at the
// abandoned camp. Massive POI wrecks register as salvageables too.
// Session ABF — flagship modules also drop narrative-beat journals into
// `journalsList`. The registry is created here, threaded through
// placePOIs, then attached to ctx.journals below so the interaction
// system can resolve hits to it.
const journalsList: Journal[] = [];
placePOIs(three.scene, physics.world, terrain, scatterRand, pickupList, salvageables, shelter, { list: journalsList }, biomes);
// M5a (C28) — give the hand-modeled flagships fog-resistant skyline silhouettes so they
// read as navigation cues from across the map (FogExp2 blends the real models into the
// sky past ~0.5km). The hero-landmark wrecks get theirs inline in placeHeroLandmarks.
addHorizonSilhouettesByName(three.scene, ['megaShip', 'megaWreck', 'satelliteDish', 'crashedHull']);
// Horizon-hook landmark (2026-07-01) — the BEACHED LEVIATHAN: a colossal broken
// capital-ship wreck breaching the dunes ~360m out on the escape-pod-intro step-out
// gaze, a bigger echo of the player's own crashed pod ("go there"). Hand-placed at a
// fixed world position (deterministic), silhouette-only, additive.
// SCOPE: gated behind FEATURES.escapePodIntro so it ships with the intro arc and does
// NOT silently alter the live master desert world. It reads great as a permanent
// normal-play nav monument too — if the user wants that, promote it to always-on by
// dropping this guard (a one-line change).
if (FEATURES.escapePodIntro) placeLeviathanLandmark(three.scene, physics.world, terrain, { salvage: salvageables, journals: { list: journalsList } });
// ACAQ (Cycle 8) — the wreck-yard's ribcages join the ecology: vultures wheel over
// the graveyard ("something died here" approach telegraph) + prey gathers at them.
carcasses.push(...getWreckYardCarcasses());

// HH (world rework #3) — procgen POI layer scattered across the chunk band.
// ~15 wrecks via rejection sampling. Reject against anchor POI coords AND
// any already-registered salvageable position (hero landmarks placed
// earlier in the boot) so procgen POIs don't land on existing wrecks.
const anchorPois = getAnchorPOIPositions();
const existingObstacles: Array<{ x: number; z: number }> = [
  ...anchorPois,
  ...salvageables.list.map((s) => ({ x: s.pos.x, z: s.pos.z })),
];
const procgenPoiPositions = placeProcgenPOIs(
  three.scene, physics.world, terrain, scatterRand, salvageables, existingObstacles, biomes,
);
_mark('pois+wrecks');

// Session U — raiders deprioritized (world is sandbox / "only survivor").
// Code path stays so we can revisit later; just don't spawn one at boot.
const raiders: Raider[] = [];

// HH — procgen lizard scatter: clusters 1-2 per POI + sparse global density
// up to LIZARD_TARGET_COUNT. Salt biome rejected, 25m buffer from spawn.
const allPoiPositions: THREE.Vector3[] = [
  ...anchorPois.map((p) => new THREE.Vector3(p.x, terrain.heightAt(p.x, p.z), p.z)),
  ...procgenPoiPositions,
  ...carcasses,   // ACAI f/u — prey gathers at the bone carcasses (E2)
];

// ACAH — scatter scrap debris in a ring around every wreck (the no-tools loot
// source that breaks the scrap_bar bootstrap deadlock). Mirrors the branch-
// around-trees pattern; deterministic from scatterRand. salvageables.list is now
// complete (hero landmarks + placePOIs + procgen wrecks all registered above).
for (const s of salvageables.list) {
  const n = Tuning.SCRAP_PER_WRECK_MIN
    + Math.floor(scatterRand() * (Tuning.SCRAP_PER_WRECK_MAX - Tuning.SCRAP_PER_WRECK_MIN + 1));
  const massive = s.kind === 'massive';
  const rMin = massive ? Tuning.SCRAP_RING_RADIUS_MASSIVE_MIN : Tuning.SCRAP_RING_RADIUS_MIN;
  const rMax = massive ? Tuning.SCRAP_RING_RADIUS_MASSIVE_MAX : Tuning.SCRAP_RING_RADIUS_MAX;
  for (let i = 0; i < n; i++) {
    const ang = scatterRand() * Math.PI * 2;
    const r = rMin + scatterRand() * (rMax - rMin);
    const sx = s.pos.x + Math.cos(ang) * r;
    const sz = s.pos.z + Math.sin(ang) * r;
    spawnScrapAt(three.scene, terrain, sx, sz, scatterRand, pickupList);
  }
}
// ACAQ/ACAR (Cycle 8) — relic-core scatter: the wreck-yard's exclusive reward. A
// few glowing relics spread EVENLY across the graveyard floor (the pit moved out,
// so no center bias) — the player sweeps the field to find them.
{
  const wy = biomes.wreckYardAnchor, wyR = biomes.wreckYardRadius;
  const relicN = Tuning.WRECK_YARD_RELIC_COUNT_MIN
    + Math.floor(scatterRand() * (Tuning.WRECK_YARD_RELIC_COUNT_MAX - Tuning.WRECK_YARD_RELIC_COUNT_MIN + 1));
  for (let i = 0; i < relicN; i++) {
    const r = wyR * 0.82 * Math.sqrt(scatterRand());   // even area distribution
    const a = scatterRand() * Math.PI * 2;
    spawnRelicAt(three.scene, terrain, wy.x + Math.cos(a) * r, wy.z + Math.sin(a) * r, scatterRand, pickupList);
  }
}
// ── Scavenger's Economy walk-test fix (2026-07-17) — ORIGIN-WORLD parity for the
//    identity-material ground scatter the chunk streamer already spawns far-field
//    (chunkManager). Zach: "only seeing scrap at most POIs — need the other
//    materials to show up more often on the ground around wrecks and POIs." Every
//    boot wreck/POI drops its identity materials (specialty POIs → their RICH
//    table; every other hull → the mixed WRECK_GENERIC_SCATTER) so the drop matrix
//    is legible from the origin world, not just the streamed far field.
//
//    SAVE-SAFETY: appended AFTER every other boot pickup spawn (branches / dead-tree
//    clusters / placePOIs / the scrap ring / relics — all above), so NOT ONE
//    pre-existing pickup id shifts (ids are assigned in spawn order via the module
//    _nextId counter, and pickups persist by id via save.pickupSurvivors). An
//    EXISTING pre-fix save keeps its exact survivor mapping and simply never shows
//    these new tail-id materials (load despawns any pickup whose id ∉ survivors —
//    the new ids are absent from an old survivor set, so they're culled cleanly, no
//    corruption). A FRESH game spawns + persists them normally. INDEPENDENT rng
//    (worldSeed-derived, distinct from scatterRand) so this never perturbs the
//    scatter stream → creature / worm / POI positions stay byte-identical per seed;
//    only the added materials differ.
{
  const matRand = makeRng((worldSeed ^ 0x1d70f) >>> 0);   // matches the streamer's material-rng offset
  // Walk up an object's ancestry for the composite-POI archetype stamp
  // (poiAssembler sets group.userData.poiArchetype; a salvageable's mesh is a
  // child panel of that group). Legacy/anchor/hero kind-based wrecks have none →
  // undefined → scatterForArchetype falls them to WRECK_GENERIC_SCATTER.
  const archetypeOf = (obj: THREE.Object3D | null): string | undefined => {
    for (let o = obj; o; o = o.parent) {
      const a = o.userData?.poiArchetype;
      if (typeof a === 'string') return a;
    }
    return undefined;
  };
  for (const s of salvageables.list) {
    const table = scatterForArchetype(archetypeOf(s.mesh));
    const massive = s.kind === 'massive';
    const rMin = massive ? Tuning.SCRAP_RING_RADIUS_MASSIVE_MIN : Tuning.SCRAP_RING_RADIUS_MIN;
    const rMax = massive ? Tuning.SCRAP_RING_RADIUS_MASSIVE_MAX : Tuning.SCRAP_RING_RADIUS_MAX;
    for (const roll of table) {
      const copies = roll.count ?? 1;
      for (let c = 0; c < copies; c++) {
        if (matRand() < roll.chance) {
          const ang = matRand() * Math.PI * 2;
          const r = rMin + matRand() * (rMax - rMin);
          spawnMaterialAt(
            three.scene, terrain, s.pos.x + Math.cos(ang) * r, s.pos.z + Math.sin(ang) * r,
            roll.id as 'metal_pipe' | 'machine_part' | 'wiring' | 'battery',
            matRand, pickupList,
          );
        }
      }
    }
  }
}
_mark('scrap');
// ACAQ/ACAR (Cycle 8) — the Sarlacc pit: a SEPARATE dune-desert hazard at its own
// seed-derived anchor (a sand-maw belongs in open sand, not the ship graveyard).
const sarlaccPit = spawnSarlaccPit(three.scene, terrain, biomes.sarlaccPitAnchor, Tuning.SARLACC_PIT_RADIUS);
// M8 ⑨ (C48) — the deep-cave enclosed interior at the carved funnel floor (biomes.caveAnchor).
// A fixed feature (one per world); the funnel descent itself is carved in terrain.ts (C47).
const deepCave = spawnDeepCave(three.scene, physics.world, terrain, biomes.caveAnchor);
// Infinite Sands S3 — wire the live lizard array into the chunk streamer
// AFTER the boot population spawns (boot spawn order = boot creature ids,
// sacred). Streamed lizards push into / splice out of this same array.
const lizards = spawnLizardsProcgen(
  three.scene, physics.world, terrain, biomes, scatterRand, allPoiPositions,
);

// ACL DESERT SHREW — procgen scatter mirroring lizards (clusters near POIs +
// sparse global density). shrew.ts owns a module-level live list; the returned
// array IS that reference, so ctx.shrews.list and updateShrews stay in sync.
const shrews = spawnShrewsProcgen(
  three.scene, physics.world, terrain, biomes, scatterRand, allPoiPositions,
);

// ACAH — rare desert vultures perched on the salt-flat dead-tree crowns
// (treePerches from spawnDeadTrees). Module-owned list; returned ref IS
// ctx.vultures.list.
const vultures = spawnVulturesProcgen(three.scene, physics.world, treePerches, scatterRand);
// ACAI f/u — a few vultures WHEEL over the bone carcasses (the "something died
// here" signal) + hunt prey gathered there. Same module list as the perched ones.
spawnCirclingVultures(three.scene, physics.world, carcasses, scatterRand);
_mark('creatures+vultures');
// S3/D299 — wireCtx happens after ctx creation below (the streamer needs
// the live pickup/cactus/well/lizard lists + despawnPickup's ctx).

// AAP — sandworm home is now sampled per-seed from the dune biome via
// sampleSandwormHome (mirrors wells-in-salt). Falls back to
// Tuning.SANDWORM_HOME_POS if no dune centroid is reachable (rare —
// world is mostly dunes). Player-spawn exclusion = 350m so the worm
// isn't in the initial viewshed.
// ACB — debug override: Tuning.DEBUG_SANDWORM_NEAR_SPAWN forces a
// close spawn (~75m from opening anchor) for fast encounter testing.
// ACE Tier 2 — multi-worm population. Default Tuning.SANDWORM_COUNT = 2;
// debug-near-spawn forces a single close worm (legacy single-encounter
// testing mode). Per-worm rejection sampling uses SANDWORM_MIN_SEPARATION
// to keep multiple worms from bunching in the same dune region.
const sandWormHomes: Array<{ x: number; z: number }> = [];
if (Tuning.DEBUG_SANDWORM_NEAR_SPAWN) {
  sandWormHomes.push({
    x: Tuning.DEBUG_SANDWORM_NEAR_SPAWN_POS.x,
    z: Tuning.DEBUG_SANDWORM_NEAR_SPAWN_POS.z,
  });
} else {
  const count = Tuning.SANDWORM_COUNT;
  const sepRadius = Tuning.SANDWORM_MIN_SEPARATION;
  for (let i = 0; i < count; i++) {
    const home = sampleSandwormHome(scatterRand, biomes, terrain, {
      excludeOtherWorms: sandWormHomes.map((p) => ({
        x: p.x, z: p.z, radius: sepRadius,
      })),
    });
    sandWormHomes.push(home);
    const biome = biomes.biomeAt(home.x, home.z);
    if (biome !== 'dune') {
      console.warn(
        `[sandWorm ${i}] home pos (${home.x.toFixed(0)}, ${home.z.toFixed(0)}) is in biome '${biome}', not 'dune'. Encounter may feel wrong.`,
      );
    }
  }
}
const sandWorms = sandWormHomes.map((home) =>
  spawnSandWorm(three.scene, physics.world, terrain, home),
);

const weather = createWeather(three.scene, three.camera);
const ambientDust = createAmbientDust(three.scene, three.camera);
const dustMotes = createDustMotes(three.scene, three.camera);
const stormVignette = createStormVignette(three.scene);
const footprints = createFootprintRegistry(three.scene, terrain);

// Player capsule. For a fresh game, setupOpeningScene below will teleport
// the player to a spot in front of the wreck entrance once the wreck's
// final position is known (findFlattestSpot drifts up to 16m from the
// search center). The initial position is a placeholder near origin —
// it's also where the player lands on a save-load (save.ts restores the
// real position) and where they end up if the opening cinematic is
// skipped for any reason. Y is sampled from the terrain so the capsule
// doesn't spawn underground.
const spawnGround = terrain.heightAt(0, 0);
const spawnY =
  spawnGround + Tuning.PLAYER_CAPSULE_HALF_HEIGHT + Tuning.PLAYER_CAPSULE_RADIUS;
const playerBody = makePlayer(
  physics.world,
  Tuning.PLAYER_CAPSULE_HALF_HEIGHT,
  Tuning.PLAYER_CAPSULE_RADIUS,
  { x: 0, y: spawnY, z: 0 },
);

// Single shadow pass: every Mesh in the scene casts + receives, UNLESS the
// mesh (or any ancestor) is marked `userData.farFromOrigin` (distant landmarks
// fog-hidden anyway) OR `userData.noShadow` (Session K — pickups + branches,
// whose tiny shadows aren't visually meaningful but add a lot of casters).
function walkUserData(obj: THREE.Object3D, flag: string): boolean {
  let cur: THREE.Object3D | null = obj;
  while (cur) {
    if (cur.userData[flag]) return true;
    cur = cur.parent;
  }
  return false;
}
three.scene.traverse((obj) => {
  const m = obj as THREE.Mesh;
  if (m.isMesh) {
    const skip = walkUserData(m, 'farFromOrigin') || walkUserData(m, 'noShadow');
    m.castShadow = !skip;
    m.receiveShadow = true;
  }
});
for (const m of terrain.meshes) {
  m.castShadow = false;
  m.receiveShadow = true;
}

createSky(three.scene);

const ctx: GameContext = {
  seed: worldSeed,    // AAI — single source of truth for world seed
  three,
  lights,
  input,
  time: {
    dayTime: Tuning.START_DAY_TIME,
    sunHeight: 0,
    sunDir: new THREE.Vector3(0, 1, 0),
    elapsed: 0,
    daysSurvived: 0,
  },
  stats: { thirst: 1, temperature: 0, hunger: 1, stamina: 1, health: 1, dead: false },
  player: {
    eyeOffset: Tuning.PLAYER_EYE_OFFSET,
    body: playerBody,
    velocityY: 0,
    externalPullX: 0,
    externalPullZ: 0,
    onGround: false,
    crouching: false,
    inShelter: false,
    sunExposure01: 1,                // M5a (C31) — full sun until the first raymarch
    viewModel: null,
    rig: null,                       // ABO A3 — built post-context construction
    cameraSnapNextFrame: true,       // ABP Tier 3 — first frame is a "teleport"
    ridingSledId: null,              // Deep-Desert cycle 5 (D257) — rideable-sled ride state (behind FEATURES.rideableSled)
  },
  pickups: { list: pickupList },
  inventory: createInventory(),
  ui: hud,
  physics,
  terrain,
  chunks: chunkManager,   // Infinite Sands S1 — content-chunk streaming
  biomes,
  assets,
  shelter,
  raiders,
  lizards,
  shrews: { list: shrews },        // ACL DESERT SHREW
  vultures: { list: vultures },    // ACAH — rare perched vultures
  sandWorms: { list: sandWorms },
  waterSources: { list: waterSources },
  cacti: { list: cacti },
  lootContainers: { list: [], open: null },
  fires: { list: [] },
  tents: { list: [] },
  sleds: { list: [], open: null },   // Session QQ
  largeTents: { list: [] },          // Session XX
  bedrolls: { list: [] },            // Session AAC
  lanterns: { list: [] },            // Session AAC
  lockers: { list: [], open: null }, // Session AAC
  stakes: { list: [] },              // Session ACE
  companion: null,                   // Session AAE
  sarlaccPit,                        // ACAQ Cycle 8 — wreck-yard hero hazard
  deepCave,                          // M8 ⑨ (C48/C49) — the deep cave interior + dark-nav
  egg: deepCave.egg,                  // M8 ⑩ (C52) — the companion egg on the cave dais (reconciled in handoffToGame)

  salvageables,
  weather,
  ambientDust,
  dustMotes,
  stormVignette,
  speeder: null,                 // populated by setupOpeningScene on fresh worlds
  footprints,
  lightPool,
  journals: { list: journalsList },
  flags: {
    started: false,
    paused: false,
    damageFlashUntil: 0,
    titleActive: true,
    // AAX — devMode is set true by the title DEV MODE button OR by the
    // Tuning.DEBUG_STARTER_LOADOUT code-level flag. Drives the HUD badge.
    devMode: Tuning.DEBUG_STARTER_LOADOUT,
    // ABO A3 — third-person camera mode. Default false (FP at boot).
    // Toggled by F-key (pause-gated).
    thirdPerson: false,
    // M8 ⑩ (C52) — companion acquired? Default false (NEW game → the cave egg is the
    // acquisition path). loadGameState sets it from the save (legacy → true).
    companionAcquired: false,
    devPanelOpen: false,
  },
};

// First-person viewmodel — must come after scene is built; consumes ctx.
ctx.player.viewModel = createViewModel(ctx);
// ABO A3 — third-person rigged body. Built invisible (FP at boot);
// becomes visible when F-key toggles ctx.flags.thirdPerson.
ctx.player.rig = buildPlayerRig(ctx);

// Player starts with a scrap_bar (slot 0) and a full canteen (slot 1).
// ABL — swapped machete → scrap_bar because the only source of scrap
// in the world is behind salvage panels (AAR pry flow), and scrap_bar
// is the gating tool to pry. Without it as starter loot the player
// has no way to bootstrap any crafting (scrap is a near-universal
// recipe input). Machete is now found-only (could be added as wreck
// loot or quest reward in a future session).
// SHIP-FIX (2026-07-03, user): NO starter loadout on the escape-pod-intro path —
// the crash story starts you with empty pockets; the T4.3 tutorial's scattered
// scrap/cloth (→ craft the machete, the pry tool) + your own pod's salvage kit
// are the bootstrap. The non-intro path keeps the ABL loadout (its balance
// rationale above still holds there).
if (!FEATURES.escapePodIntro) {
  addItem(ctx.inventory, 'scrap_bar');
  addItem(ctx.inventory, 'canteen', { fillLevel: 1 });
}
ctx.inventory.selectedIdx = 0;

// AAX — dev loadout extracted into a helper so it can be invoked from
// both the code-level Tuning.DEBUG_STARTER_LOADOUT path (boot-time) AND
// the DEV MODE title button (inside the user-click gesture so audio +
// pointer-lock work). Pre-AAX this lived inline at boot and was gated on
// `localStorage['dustfall.devMode']`; that gate is removed in AAX in
// favor of an in-memory `ctx.flags.devMode` driven by the title click.
function applyDevLoadout(c: GameContext): void {
  // Crafting materials — enough for every recipe in craftingMenu.ts plus extra.
  for (let i = 0; i < 6; i++) addItem(c.inventory, 'branch');
  for (let i = 0; i < 6; i++) addItem(c.inventory, 'cloth');
  for (let i = 0; i < 6; i++) addItem(c.inventory, 'scrap');
  // Cookable food — drives the cook-over-fire + lizard-on-a-stick paths.
  for (let i = 0; i < 3; i++) addItem(c.inventory, 'raw_lizard_meat');
  for (let i = 0; i < 2; i++) addItem(c.inventory, 'raw_worm_meat');
  for (let i = 0; i < 2; i++) addItem(c.inventory, 'worm_lure');   // C18 — sand-worm lure (testability; craft recipe is a follow-up)
  addItem(c.inventory, 'spyglass');   // C29 — salvaged spyglass (testability; also a craft recipe below)
  // Scavenger's Economy (build 2) — new salvage materials in the dev loadout (icons/craft testability).
  for (let i = 0; i < 4; i++) addItem(c.inventory, 'metal_pipe');
  for (let i = 0; i < 4; i++) addItem(c.inventory, 'machine_part');
  for (let i = 0; i < 4; i++) addItem(c.inventory, 'wiring');
  for (let i = 0; i < 4; i++) addItem(c.inventory, 'battery');
  // Pre-made deployables — skip the craft step when iterating on fire
  // mechanics directly.
  for (let i = 0; i < 2; i++) addItem(c.inventory, 'fire_kit');
  for (let i = 0; i < 3; i++) addItem(c.inventory, 'signal_kit');   // C37 — signal flare (testability; also a craft recipe, collides with fire_kit)
  // Light sources for night testing.
  addItem(c.inventory, 'flashlight');
  // Combat testing — gun starts with a full magazine (ammo in meta).
  addItem(c.inventory, 'scrap_gun', { ammoRemaining: Tuning.WEAPON_SCRAP_GUN_MAX_AMMO });
  for (let i = 0; i < 6; i++) addItem(c.inventory, 'scrap_bullet');
  // Sled mechanic — kit deploys the world entity; rope ties it.
  addItem(c.inventory, 'sled_kit');
  addItem(c.inventory, 'rope');
  // Salvage tool (AAR pry flow) — without this the panels stay sealed.
  addItem(c.inventory, 'scrap_bar');
  // AAZ — pre-discover every recipe. The right-side crafting panel
  // (AAW) groups recipes into CRAFTABLE / MISSING — without this every
  // dev-mode boot would start with an empty list until the player ran
  // through each combination. Skip duplicates if a save load already
  // seeded them.
  const known = c.inventory.discoveredRecipes;
  for (const id of ALL_RECIPE_IDS) {
    if (!known.includes(id)) known.push(id);
  }
}

// Tuning-level dev override (code-level, on by default false). When true,
// every boot starts with the dev loadout AND the badge — useful for the
// developer's iteration loop without clicking through the title menu each
// reload. The runtime DEV MODE button on the title is the player-facing
// equivalent (set in the onDevMode callback below).
if (Tuning.DEBUG_STARTER_LOADOUT) {
  applyDevLoadout(ctx);
}

// Opening scene runs on EVERY boot — the wreck + skeleton + journal +
// speeder are deterministic-from-seed props and would be missing from a
// save-loaded world otherwise (the user would land in a Continue with no
// starter bike or wreck). On Continue, loadGameState() then patches the
// player position + speeder pose OVER this default placement, so the
// player resumes where they saved rather than at the opening cinematic.
const openingResult = setupOpeningScene(
  three.scene, physics.world, terrain, shelter, weather, three.camera, scatterRand,
  playerBody, salvageables,
);
ctx.journals.list.push(openingResult.journal);
ctx.speeder = openingResult.speeder;
// AAE — spawn the creature companion at the position computed by
// setupOpeningScene. Singleton; loadGameState may despawn this if the
// save says the player had the pod in inventory.
spawnCompanionAt(ctx, openingResult.companionSpawnPos, 'idle');

// IMPORTANT: createMenus must run BEFORE wireOverlays — the unlock handler
// in input.ts calls showPauseOverlay which needs the menu DOM in place.
createMenus(ctx);
initSpyglass();          // M5a (C29) — the scope vignette overlay (owns its div)
initWormHorizonCrossing(three.scene);   // M5b (C36) — the distant worm dorsal-ridge (hidden until a crossing)
initMeteorCrash(three.scene);   // ACBE (D1) — the crash event (flying burning wreck + impact FX), idle until armed
initScreenFlash(three.scene);   // ACBE (D1) — fullscreen impact-flash quad
createLootMenu(ctx);
createCraftingMenu(ctx);
createSleepOverlay(ctx);
createInventoryOverlay(ctx);
createJournalPanel(ctx);
createPerfHud(ctx);
createStatVignette();  // WW — must come after HUD creation so it overlays correctly
createGhostPreview(ctx); // AAA — kit-placement preview ring + marker
createFootprintPuffs(three.scene); // AAG — upward dust burst on each footstep
// Tutorial panel must exist before wireOverlays so the lock handler can call
// noteIntroSeen() — and before installDebugPanel so __game.showControls works.
// S3/D299 — hand the chunk streamer the live GameContext (its streamed
// content pushes into / splices out of ctx's live lists). Boot placement
// above is complete, so the sacred boot streams are untouched.
chunkManager.wireCtx(ctx);
createTutorial(ctx);
wireOverlays(ctx);
installDebugPanel(ctx, {
  // ACH (Cycle 2) — headless gameplay entry for agent/preview self-testing.
  // Bypasses the title button + pointer-lock: the normal 'lock' event that
  // clears flags.paused (input.ts) never fires for a synthetic click, so the
  // game would render the title-gone scene but never tick. handoffToGame()
  // already skips pointer-lock in preview-like contexts (isPreviewLike); we
  // just add the paused=false the 'lock' handler would have set. Idempotent.
  enterGame: (dev?: boolean) => {
    if (dev && !ctx.flags.devMode) { applyDevLoadout(ctx); ctx.flags.devMode = true; }
    if (dev) ctx.flags.companionAcquired = true;   // M8 ⑩ (C52) — headless dev entry keeps the companion (skips the egg hunt)
    // ACN — skipLock: automated entry must NEVER acquire PointerLock (it would
    // trap the OS cursor in the headless/offscreen window — the focus heuristic
    // doesn't catch headless Playwright). Verification drives input via evals.
    if (ctx.flags.titleActive) handoffToGame({ skipLock: true });
    ctx.flags.paused = false;
  },
});
installPhysicsDebug(ctx);

// --- Session CC-3: animated title screen ---
// Freeze the game world (paused=true) and stack a dedicated title scene on
// top. NEW GAME on the title is now the SOLE gesture into gameplay — it
// starts audio, locks the pointer, and unpauses the world. The legacy
// #start-overlay stays hidden permanently from boot.
ctx.flags.paused = true;
// ABL — defensive: if a prior preview-tool session left a stale
// pointer lock on this document (cursor stuck in 0×0 hidden canvas
// top-left), release it on boot. No-op when no lock is active.
if (typeof document !== 'undefined' && document.exitPointerLock) {
  try { document.exitPointerLock(); } catch { /* ignore */ }
}
const startOverlayEl = document.getElementById('start-overlay');
const controlsPanelEl = document.getElementById('controls-panel');
startOverlayEl?.classList.add('hidden');
controlsPanelEl?.classList.add('hidden');
// Hide in-game HUD elements (stats bars + clock + crosshair + hotbar) while
// the title is up — they read as game furniture and don't belong on the
// menu. Each becomes visible again on NEW GAME.
const inGameElIds = ['hud', 'hotbar', 'crosshair'];
const inGameEls = inGameElIds
  .map((id) => document.getElementById(id))
  .filter((el): el is HTMLElement => el !== null);
inGameEls.forEach((el) => { el.style.visibility = 'hidden'; });

// AAW — persistent DEV MODE badge. Built once at boot; only made visible
// on handoff if the devMode flag is set. The earlier dev-mode UX shipped
// in AAV had no in-game indicator, so the player couldn't tell which
// branch (vanilla vs dev) they were on after the reload + title cycle.
const devModeBadge = document.createElement('div');
devModeBadge.id = 'dev-mode-badge';
devModeBadge.textContent = '[ DEV MODE ]';
document.body.appendChild(devModeBadge);

// ACAD — dev item spawner: click the DEV MODE badge to open a panel that adds
// any item to the inventory (dev-mode only). Built once; gated here.
createDevItemPanel(ctx);
devModeBadge.title = 'click to spawn items (or press F8 / ` )';
devModeBadge.addEventListener('click', () => {
  if (ctx.flags.devMode) toggleDevItemPanel(ctx);
});

// ACAH — reliable DEV MODE entry via the Backquote (`) key. The badge can't be
// CLICKED during play because the pointer is locked to the canvas (DOM overlays
// don't receive clicks while locked), so there was no in-game way to turn dev
// mode on. Backquote works while pointer-locked (it's a keydown): it turns dev
// mode ON if it's off (+ reveals the badge), then toggles the item-spawner panel
// (which unlocks the pointer itself, so item clicks then work).
// F8 is the same path under a DEDICATED, conflict-free key: Backquote is ALSO
// the physics collider-wireframe toggle (physics/debug.ts), so a player who only
// wants the item spawner shouldn't have to flip the wireframe too. Both keys are
// window-level keydowns, so they fire while the pointer is locked to the canvas.
window.addEventListener('keydown', (e) => {
  if ((e.code !== 'Backquote' && e.code !== 'F8') || e.repeat) return;
  if (!ctx.flags.started || ctx.stats.dead) return;
  e.preventDefault();
  if (!ctx.flags.devMode) {
    ctx.flags.devMode = true;
    devModeBadge.classList.add('visible');
    ctx.ui.showToast?.('DEV MODE on');
  }
  toggleDevItemPanel(ctx);
});

// ABL — perf: pre-warm shader compilation against the game scene so the FIRST
// frame after NEW GAME doesn't stall while programs compile cold.
// ACAH — switched the SYNCHRONOUS `compile()` to `compileAsync()`. The program
// count grew from ~16 (ABL era) to ~120 (D175/D177 un-shared the per-material
// programs — correct, but more of them), so the blocking compile had become a
// multi-second STARTUP FREEZE before the title even appeared. compileAsync uses
// the browser's parallel-shader-compile path (off the main thread) and returns a
// promise we deliberately DON'T await — the title comes up immediately and the
// programs finish compiling in the background while the player reads it. (Worst
// case if they click NEW GAME mid-compile: a few cold lazy-compiles, same as
// pre-ABL — far better than a guaranteed multi-second boot freeze.)
_mark('pre-compile');
void three.renderer.compileAsync(three.scene, three.camera);
_mark('compile-call');

// ABL — perf: pre-warm the Rapier physics broadphase. The first
// physics.step() of a session is significantly more expensive than
// subsequent steps because Rapier builds collision acceleration
// structures (BVH, broadphase pair cache) on the first tick against
// the ~68 wreck colliders + terrain. Pre-walking one step here while
// the title is shown means the first GAME tick steps fast.
physics.world.step();
_mark('physics-prewarm');

// ABL — perf: also prime one shadow map render so the first GAME
// frame doesn't pay the shadow-pass cold cost on top of the regular
// game render. needsUpdate is set true so the throttled cadence in
// updateLighting doesn't matter for this warmup pass.
three.renderer.shadowMap.needsUpdate = true;

const title = createTitleScene();
// Expose the title scene for debug/preview tools (read-only handles).
(window as unknown as { __title?: { scene: unknown; camera: unknown; update: (dt: number) => void } }).__title = {
  scene: title.scene,
  camera: title.camera,
  update: title.update,
};

// Whether a save existed when this boot started. setupOpeningScene now
// runs on EVERY boot so the wreck + speeder always exist; this flag only
// drives the menu (show CONTINUE button + treat NEW GAME as "wipe + restart"
// so the player's previously-saved progress, inventory, etc. doesn't leak
// into a "new" run).
const hadSaveAtBoot = hasSave();

function handoffToGame(opts?: { skipLock?: boolean }): void {
  titleOverlay.hide();
  ctx.flags.titleActive = false;
  inGameEls.forEach((el) => { el.style.visibility = ''; });
  // Escape-pod intro — if a new game started the intro before this handoff, re-hide the
  // in-game HUD we just un-hid (the intro owns a clean view; endEscapePodIntro restores it).
  if (introActive(ctx)) setGameHudHidden(true);
  // M8 ⑩ (C52) — reconcile companion vs. cave egg. Boot always spawns the companion +
  // builds the egg; resolve the final state per flags.companionAcquired (false on a NEW
  // game, set from the save on Continue, true on DEV): acquired → remove the egg; NOT
  // acquired → despawn the boot companion so the cave egg is the only acquisition path.
  if (ctx.flags.companionAcquired) {
    if (ctx.egg) { ctx.egg.group.removeFromParent(); ctx.egg = null; }
  } else {
    despawnCompanion(ctx);
  }
  // AAX — surface the DEV MODE badge from the in-memory flag (set by the
  // DEV MODE button's onDevMode callback or by Tuning.DEBUG_STARTER_LOADOUT
  // at boot). Replaces the AAW localStorage-driven check, which got out of
  // sync with the actual loadout state (onNewGame clears the flag → badge
  // hides → but the boot loadout was already applied).
  if (ctx.flags.devMode) devModeBadge.classList.add('visible');
  else devModeBadge.classList.remove('visible');
  resetDayBeats();   // C35 — seed fresh so a new-game/load sun position can't fire a stray dawn/dusk beat
  resetWormHorizonCrossing();   // C36 — clear any in-flight distant crossing on new-game/load
  resetMeteorCrash(ctx);   // ACBE (D1) — tear down in-session crash sites (bodies + registries) + reset the cadence
  resetCameraShake();   // ACBE (D1)
  resetScreenFlash();   // ACBE (D1)
  ensureAudioStarted();
  startSoundscape();
  // AAP — atmospheric music tracks. Three procedural Web Audio tracks
  // (day/storm/night) crossfaded by sun height + perceivedIntensity.
  // Independent of soundscape's sample-stem music layer (which has been
  // silent since X-era — no .ogg pack ever shipped). Per D3.
  startMusic();
  // ABL/ABN — guard pointer-lock acquisition against agent-automated
  // clicks in preview/dev windows. When `preview_eval` (Claude Preview
  // MCP, Playwright, etc.) programmatically clicks NEW GAME in a
  // preview window that's visible-but-unfocused (user is working in
  // Claude Code chat, preview window sits to the side), acquiring
  // PointerLock there confines the OS cursor to the canvas region —
  // even though the user is interacting with a different app — until
  // they alt-tab to force release.
  //
  // Original ABL guard checked `document.hidden || canvas.width === 0`
  // but missed the visible-but-unfocused case (which is the COMMON
  // one — Claude Preview windows are usually visible). The right
  // signal is `document.hasFocus()`: true only when this window owns
  // OS focus. A real user clicking NEW GAME has focus by definition
  // (the click itself focuses the window first); an agent's
  // synthesized click in a side-window doesn't.
  //
  // ACN — the focus/visibility heuristic is NOT enough for HEADLESS
  // PLAYWRIGHT (`npm run rig-shot`): its page reports visible + sized +
  // hasFocus()===true, so `pointerLockSuppressed` returns false and the
  // lock fired anyway, trapping the user's OS cursor in the harness's
  // offscreen top-left window. The automated-entry path (`enterGame` DEV
  // hook) now passes `skipLock: true` so it NEVER locks regardless of the
  // heuristic — verification drives camera/input via evals, never the real
  // mouse, so it has no use for PointerLock. The heuristic stays for stray
  // preview CLICKS on the start overlay (hidden Claude-Preview tab path).
  const canvas = three.renderer.domElement;
  if (!opts?.skipLock && !pointerLockSuppressed(canvas)) {
    ctx.input.controls.lock();
  }
  setTimeout(() => {
    title.dispose();
    (window as unknown as { __title?: unknown }).__title = undefined;
  }, 0);
}

const titleOverlay = createTitleOverlay(ctx, {
  onNewGame: (seedOverride?: number) => {
    // AAI — per-game seed handling. Three paths:
    //   1. Advanced seed entered + different from current → store pending
    //      seed + wipe save + reload (boot will use the new seed).
    //   2. Save existed at boot → user wants a fresh world; roll a random
    //      seed (or use override) + wipe + reload.
    //   3. No save at boot, no seed override → world was auto-rolled this
    //      boot already; just hand off (no reload).
    //
    // AAX — devMode is an in-memory flag (ctx.flags.devMode) that does NOT
    // need clearing here. NEW GAME → fresh boot → ctx.flags.devMode = false
    // by default. Reload paths drop in-memory state automatically.
    const wantOverride = seedOverride !== undefined && (seedOverride >>> 0) !== ctx.seed;
    if (wantOverride) {
      localStorage.setItem('dustfall.pendingSeed', String(seedOverride! >>> 0));
      if (hadSaveAtBoot) clearSave();
      location.reload();
      return;
    }
    if (hadSaveAtBoot) {
      const rolled = Math.floor(Math.random() * 0x100000000) >>> 0;
      localStorage.setItem('dustfall.pendingSeed', String(rolled));
      clearSave();
      location.reload();
      return;
    }
    // Fresh-boot, no override: this world was auto-rolled; play it.
    // Escape-pod intro (FEATURES.escapePodIntro) — a NEW game plays the intro before
    // gameplay; DEV MODE + Continue use the normal spawn (they call handoffToGame from
    // their own branches, never reach here). No-op when the flag is off (today's
    // behaviour, byte-identical).
    if (FEATURES.escapePodIntro && !ctx.flags.devMode) {
      // PERF (the user's #1 intro complaint — freezes/stutters between beats): pay the
      //   whole intro's build + shader-compile cost UP FRONT behind an honest loading
      //   screen, so no beat cold-builds the ship (~1400 meshes) / hauler / pod / plasma
      //   mid-play. handoffToGame FIRST (hide the title, un-hide then re-hide the HUD as
      //   the intro owns a clean view) so the loading screen sits over the game canvas the
      //   warm-up renders into; THEN preload; THEN start the cockpit beat — by which point
      //   every scene is prebuilt + every shader compiled (the beats just reuse them).
      //
      // Y6 (kill the desert flash): handoffToGame flips titleActive, so the very next
      //   painted frame is the in-game DESERT SPAWN — which used to flash before the
      //   loading overlay's 0.35s fade-in covered it. Freeze the menu's last frame
      //   instead: render the title vista once explicitly (preserveDrawingBuffer is
      //   false, so toDataURL is only valid in the same task as a render) and mount it
      //   as the loading screen's opaque backdrop, shown INSTANTLY before the handoff.
      //   The menu visual then persists under the loading bar for the whole preload
      //   (the warm-up frames render behind it, invisible), stays up through the
      //   READY — CLICK TO LAUNCH recovery state if that triggers, and the overlay
      //   fades out (~350ms) directly onto the cockpit's first frame. A capture failure
      //   falls back to the overlay's own fully-opaque gradient — no desert either way.
      // AUDIO (user: "no audio until we start on the ship") — handoffToGame below starts the
      //   desert soundscape (wind) + music, but the intro's OWN suppression only lands after the
      //   multi-second preload (startEscapePodIntro → setSoundscapeSuppressed/setMusicSuppressed),
      //   so wind+music leaked audibly across the whole New-Game load. Suppress them HERE, before
      //   handoffToGame's startSoundscape()/startMusic() — the flag is honored at start, so they
      //   never fade in. The ship beats play their OWN audio; endEscapePodIntro restores wind+music
      //   at the desert handoff.
      setSoundscapeSuppressed(true);
      setMusicSuppressed(true);
      try {
        three.renderer.render(title.scene, title.camera);
        setIntroLoadingBackdrop(three.renderer.domElement.toDataURL('image/jpeg', 0.85));
      } catch (e) {
        console.warn('[introLoading] menu freeze-frame capture failed — plain backdrop:', e);
        setIntroLoadingBackdrop(null);
      }
      showIntroLoading({ instant: true });   // cover the canvas BEFORE titleActive flips
      handoffToGame({ skipLock: true });   // skipLock: we lock EXPLICITLY on the next line instead
      // BUGFIX (the "loading finishes, game never starts" freeze): acquire the pointer lock
      //   NOW, while the New-Game click's user gesture is still fresh. The old flow locked
      //   AFTER the multi-second preload — by then the gesture had EXPIRED, the browser
      //   silently refused the lock, flags.paused stayed true, and the intro sat frozen
      //   behind a finished loading bar (the documented pointer-lock freeze mode). Locking
      //   here is harmless: the loading overlay covers the canvas and swallows input.
      {
        const c0 = three.renderer.domElement;
        if (!pointerLockSuppressed(c0)) ctx.input.controls.lock();
      }
      void preloadIntro(ctx)
        .catch((e) => {
          // A preload failure must NEVER brick the New Game — the beats all keep their
          //   build-on-entry fallbacks, so we just cold-start (the old pre-preload behavior).
          console.error('[introPreload] failed — cold-starting the intro:', e);
        })
        .then(async () => {
          // If the lock didn't take (or the player Esc'd during loading), a post-preload
          //   lock() would be refused (stale gesture) → recover via a FRESH gesture: the
          //   loading screen flips to "READY — CLICK TO LAUNCH" and we lock inside that click.
          const c = three.renderer.domElement;
          if (!document.pointerLockElement && !pointerLockSuppressed(c)) {
            await introLoadingAwaitLaunchClick();
            ctx.input.controls.lock();
          }
          hideIntroLoading();
          startEscapePodIntro(ctx);            // start the cockpit beat — everything is warm now
          setGameHudHidden(true);              // re-hide (handoffToGame un-hid; the intro owns a clean view)
        });
      return;
    }
    handoffToGame();
  },
  onContinue: hadSaveAtBoot ? () => {
    // Patch the already-built world (wreck + speeder placed by
    // setupOpeningScene above) with saved player pos + speeder pose +
    // inventory + etc. If load fails we toast the error and leave the
    // title up so the player can fall back to NEW GAME.
    const result = loadGameState(ctx);
    if (!result.ok) {
      ctx.ui.showToast(result.error ?? 'load failed');
      return;
    }
    // AAX — Continue overwrites the boot inventory with the save's
    // contents. If Tuning.DEBUG_STARTER_LOADOUT pre-set flags.devMode at
    // boot, the dev items are gone now (replaced by save) — clear the
    // flag so the badge doesn't lie about the run's state. (The save
    // itself doesn't track dev-mode by design — a dev-saved session
    // becomes a regular saved game.)
    ctx.flags.devMode = false;
    handoffToGame();
    applyPendingCrashRestore(ctx);   // ACBE (D1) — re-spawn saved crash sites AFTER handoff's reset cleared in-session ones
    // escape-pod intro — re-build the ONE walk-in pod AFTER handoff (it's built only by the intro,
    //   never at boot; no-op with an empty stash → flag-off/pre-feature saves unaffected). If the
    //   comic chute hadn't yet popped, resume the tutorial driver so it still fires on the first
    //   post-reload pry (a fresh boot leaves the driver idle, which would silently kill the payoff).
    const podRestore = applyPendingPodCrashRestore(ctx);
    if (podRestore && !podRestore.chutePopped) resumePodTutorialAfterRestore(podRestore.x, podRestore.z);
  } : undefined,
  // AAX — DEV MODE button. Pre-AAX this set a localStorage flag + cleared
  // the save + reloaded; the boot-time loadout block then fired from the
  // flag. AAW tried to bypass the post-reload title (no user gesture →
  // pointer-lock fails silently → flags.paused stays true → frozen game).
  //
  // AAX: apply the loadout in-memory RIGHT HERE inside the click gesture
  // and hand off directly. No reload, no localStorage, no save wipe (the
  // existing save survives until the player saves again in dev mode). One
  // click → enter dev session. Seed override is intentionally not honored
  // by this button — for "DEV MODE with custom seed", use NEW GAME with
  // the seed first (reloads to that seed), then click DEV MODE on the new
  // title.
  onDevMode: () => {
    applyDevLoadout(ctx);
    ctx.flags.devMode = true;
    ctx.flags.companionAcquired = true;   // M8 ⑩ (C52) — dev sessions keep the companion (test affordance)
    handoffToGame();
  },
});

// --- Per-frame tick: order matters ---
startLoop(ctx, (c, dt) => {
  // Title screen owns the frame until NEW GAME is pressed. Game systems
  // stay frozen behind the title — `paused` is set true during title — and
  // the render-target getter below routes to the title scene + camera.
  if (c.flags.titleActive) {
    title.update(dt);
    endInputFrame(c.input);
    return;
  }
  // Skip ALL game logic while paused. Render still runs (after this callback).
  if (c.flags.paused) {
    stopWormRumble();   // C16 — don't leave the worm charge-rumble droning while the game is frozen (updateSandWorm won't run to stop it)
    endInputFrame(c.input);
    return;
  }
  c.time.elapsed += dt;
  c.physics.step(dt);            // physics first
  updateWeather(c, dt);          // sandstorm intensity (drives sky + audio + thirst)
  updateAmbientDust(c, dt);      // toned-down drift, suppressed by sandstorm
  updateDustMotes(c);            // AAG — bone-white motes layer, persists through light storms
  // AAG — salt-flat mirage shader uniforms.
  updateTerrainShaderUniforms(
    c.time.elapsed,
    c.three.camera.position.x,
    c.three.camera.position.z,
    c.time.sunHeight,
    c.weather.cloudiness ?? 0,   // ACAH — cloud-shadow coverage
  );
  // Session ABE — fabric wind shimmer. Calm baseline 0.10 keeps a
  // gentle breathing motion even on still days; weather.intensity
  // pushes amplitude up to the 0.04m shader cap at peak storm.
  updateFabricShaderUniforms(
    c.time.elapsed,
    0.10 + 0.90 * c.weather.intensity,
  );
  updateStormVignette(c);        // screen-edge tint at peak storm (BB-4)
  updateStatVignette(c);         // WW — cold/thirst tint when stats low
  updateLighting(c, dt);         // sun + lights + sunDir/sunHeight
  updateSky(c, dt);              // sky sphere + sun disc (reads weather)
  updateOpeningWreckGodRay(c);   // AAB — skylight beam opacity tracks sun height + storm intensity
  updateSpeeder(c, dt);          // hover speeder forces + mount/dismount (CC) — must run BEFORE updatePlayer so the player capsule is teleported to the rider seat before camera-sync
  updateSleds(c, dt);            // QQ — per-sled tow spring + rope visual. Moved BEFORE updatePlayer so this-frame's sled XZ delta is fresh when updatePlayer reads it for moving-platform-ride. Tether endpoint resolution reads ctx.player.body.body.translation() = position committed by this-frame's physics.step (one frame behind setNext, but negligible at tow speeds).
  updateEscapePodIntro(c, dt);   // escape-pod intro sequence (FEATURES.escapePodIntro) — no-op unless ctx.intro.active; runs BEFORE updatePlayer so it can set the capsule + drive the camera first
  // W6 item 5 — the post-handoff fog ease-back is GONE: the intro now normalizes the fog to the
  //   game's survival density DURING the fall (blendDescentFog), so the world is already at plain
  //   game fog at the crash/exit — nothing to ease. (updateIntroFogEase was removed with the pin.)
  updatePlayer(c, dt);           // movement + camera + advance dayTime
  updateChunks(c);               // Infinite Sands S1 — terrain tile ring + content chunks follow the player (AFTER updatePlayer so this-frame's position is committed; no-op during the intro)
  updateStaminaWobble(c);        // WW — sin-driven camera jitter when stamina low (must run AFTER updatePlayer's camera-anchor)
  updateCameraShake(c, dt);      // ACBE (D1) — trauma shake (stacks on the anchored camera, like stamina wobble)
  updateScreenFlash(c, dt);      // ACBE (D1) — decay the impact flash overlay
  updateSpyglass(c, dt);         // M5a (C29) — ease the camera FOV toward the spyglass zoom + drive the scope vignette
  updateVistaReveal(c, dt);      // M5a (C30) — crest detection: re-multiply the weather fog density to LIFT it on a vista reveal (after updateWeather set it)
  updateWormHorizonCrossing(c, c.terrain, dt);   // M5b (C36) — the distant worm dorsal-ridge sweeping the horizon (decoupled spectacle)
  updateMeteorCrash(c, dt);      // ACBE (D1) — the crashing-wreck event (flight → impact → fire/smoke); ambient-armed
  updateShelter(c, dt);          // before stats so heat path sees inShelter
  updateSunExposure(c, dt);      // M5a (C31) — before stats so the heat path sees sunExposure01 (direct sun vs dune shade)
  updateStats(c, dt);            // thirst/heat/health drain + death
  updateSoundscape(c, dt);       // wind volume tracks day/night
  updateMusic(c, dt);            // AAP — procedural music tracks crossfade by sun + storm
  updateDayBeats(c);             // M5b (C35) — a warm/cool tonal swell at the sunrise/sunset crossings
  // ABM (B7) — per-frame sync of dynamic-body pickups (dropped items
  // roll/fall/settle). Cheap walk; skips pickups without a body.
  // Runs AFTER physics.step (above) so the body transform reflects
  // this tick's integration result.
  updatePickups(c, dt);
  updatePanelDebris(c, dt);      // ACAX — synced popped-off salvage-panel doors (mesh ← physics body)
  updateRaiders(c, dt);          // AI state machine + raider movement
  updateLizards(c, dt);          // small flee-AI wildlife
  updateShrews(c, dt);           // ACL — skittery shrew prey (idle/wander/flee); pause-gated internally
  updateVultures(c, dt);         // ACAH — perched vultures (perch/flee/dead); pause-gated internally
  updateCompanion(c, dt);        // AAE — Rocky-inspired creature follows player
  updateSandWorm(c, dt);         // DD — buried boss; breaches when player enters territory
  updateSarlaccPit(c, dt);       // ACAQ Cycle 8 — wreck-yard maw; gapes + pulls + bites near the player
  updateDeepCave(c, deepCave);   // M8 ⑨ (C49) — dark-nav: darken ambient/sun + torch glow when the player is down in the cave (AFTER updateLighting set the surface values)
  updateKillDrag(c);             // ACF — drag a slain raider corpse (on foot/sled) or worm carcass (speeder) via the shared rope constraint. AFTER updateRaiders/updateSandWorm (they skip dead entities, leaving drag-movement to this) + BEFORE updateSledRiders.
  updateFootprints(c.footprints, c.time.elapsed); // age + fade pooled decals
  updateFootprintPuffs(c, dt);   // AAG — particle puffs from each footstep
  updateFires(c, dt);            // flicker + fuel decrement + burnout
  if (FEATURES.escapePodIntro) { const _lp = c.player.body.body.translation(); updateLeviathanLandmark(c.lightPool, _lp.x, _lp.z); }  // proximity-gate the enterable leviathan's interior lights (claim/free pool lights near/far)
  updateSignalFlares(c, dt);     // C37 — advance any in-flight signal-flare arcs
  updateLanterns(c);             // AAC — sin-driven flicker on placed lanterns
  updateLargeTents(c, dt);       // AAZ — doorway open/close lerp on placed shelter tents
  updateCacti(c);                // CC-4 — regrow harvested alien-cactus fruit after a day cycle
  updateSledRiders(c);           // ACC P2 — drive any pickup riding a sled + promote settled pickups (must run AFTER updateSleds so sled.group transforms reflect this-frame's tow correction)
  updateInteraction(c, dt);      // raycast hover + E to open/refill/harvest/cook/sleep/etc (UU — pickup-take moved to LMB)
  updatePodTutorial(c, dt);      // T4.3 — the escape-pod first-salvage tutorial + chute-pop (no-op unless running; after interaction so the pry is seen this frame)
  updateChutePop(c, dt);         // T4.3 — advance the chute-pop inflate one-shot (no-op unless popping); D5 — also fires the pry→pop gag robustly (tutorial-phase-independent), so it always ticks / sees the pry
  // W6 item 5 — the step-out exposure ease is GONE (the wake no longer lifts the exposure; it stays
  //   at the desert base 1.05 from the crash onward, so there's nothing to ease). The old
  //   updatePodExposureEase tick was removed with it.
  updateInventoryInput(c, dt);   // 1-4, wheel, Q to use (Q still drives def.onUse as backup)
  updateWieldAction(c, dt);      // UU — sole LMB dispatcher: attack/place/hold_use. Calls updateCombat internally for 'attack' items.
  updateReload(c);               // ABE — R-key scrap_gun reload (drains scrap_bullet → slot.meta.ammoRemaining)
  updateGhostPreview(c);         // AAA — preview ring + marker at kit deploy position
  updateViewModel(c, dt);        // first-person hands + held item (after camera + combat)
  updatePlayerRig(c, dt);        // ABO A3 — third-person rigged body (no-op in FP mode)
  updateHud(c, dt);              // HUD bars + clock
  updateHotbar(c, dt);           // hotbar slots
  updateInteractPrompt(c, dt);   // [E] prompt visibility
  updatePhysicsDebug(c, dt);     // wireframe overlay if toggled
  updatePerfHud(c, dt);          // F1 dev overlay
  endInputFrame(c.input);        // clear per-frame input state LAST
}, () =>
  ctx.flags.titleActive
    ? { scene: title.scene, camera: title.camera }
    : { scene: ctx.three.scene, camera: ctx.three.camera },
);
