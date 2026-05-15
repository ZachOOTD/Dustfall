// Opening scene orchestrator (Session W). Places the opening wreck +
// slumped skeleton + journal interactable at fixed positions, registers a
// shelter zone covering the wreck interior, seeds the opening sandstorm,
// and points the player's camera at the wreck so it's dead-center on the
// first frame.
//
// Called from main.ts only when `hasSave()` returns false — i.e., on a
// fresh world. Continue-from-save skips this entirely.

import * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';
import type { Rng } from '../core/rng.ts';
import type { Terrain } from './terrain.ts';
import type { Weather } from './weather.ts';
import type { ShelterRegistry } from '../shelter/shelterZones.ts';
import type { Journal } from './journal.ts';
import { placeOpeningWreck, OPENING_WRECK_EXTENTS } from './openingWreck.ts';
import { makeSkeleton } from './skeleton.ts';
import { placeJournal } from './journal.ts';
import { addShelterZone } from '../shelter/shelterZones.ts';
import type { PlayerBody } from '../physics/bodies.ts';
import { Tuning } from '../config/tuning.ts';
import { placeSpeeder, type SpeederState } from './speeder.ts';
// Session AA — opening storm seed removed; player now boots into calm weather
// so the wreck and surrounding terrain read clearly on first impression.
// `seedOpeningStorm` is still exported from weather.ts for future re-use.

/** Nominal world position to search around for the wreck placement.
 *  Session AA — picked empirically from a biome+POI scan: every position
 *  within findFlattestSpot's 16m drift radius samples as `dune` (40/40
 *  probes verified at runtime), and the minimum distance to any
 *  hand-placed POI is ~63m (closest is antenna_outpost at (-88, -50)).
 *  Sits west of origin on the -X axis. With yaw forced to π/2 below the
 *  wreck's back wall still faces world +X (sunrise direction). Player
 *  spawn is computed from the actual wreck position (after findFlattestSpot
 *  drift) so they always land in front of the entrance. */
const WRECK_SEARCH_CENTER = new THREE.Vector3(-50, 0, 0);

/** How far in front of the entrance the player spawns. The player faces
 *  the entrance via camera.lookAt at boot. */
const PLAYER_SPAWN_OFFSET_FROM_ENTRANCE = 6;

/** Compute terrain-height variance over a 5×5 patch centered on (cx, cz).
 *  Lower = flatter. Used to pick a flat landing spot for the wreck. */
function patchVariance(terrain: Terrain, cx: number, cz: number, half = 2.5): number {
  const samples: number[] = [];
  for (const dx of [-half, 0, half]) {
    for (const dz of [-half, 0, half]) {
      samples.push(terrain.heightAt(cx + dx, cz + dz));
    }
  }
  const mean = samples.reduce((s, v) => s + v, 0) / samples.length;
  return samples.reduce((s, v) => s + (v - mean) ** 2, 0) / samples.length;
}

/** Max terrain height across a 3×3 grid of samples within the wreck
 *  footprint. Used to position the wreck so its floor top sits above
 *  every terrain bump in its footprint (otherwise terrain pokes up
 *  through the floor and covers ground props). */
function maxTerrainInFootprint(
  terrain: Terrain, cx: number, cz: number, halfX: number, halfZ: number,
): number {
  let max = -Infinity;
  for (const dx of [-halfX, 0, halfX]) {
    for (const dz of [-halfZ, 0, halfZ]) {
      const h = terrain.heightAt(cx + dx, cz + dz);
      if (h > max) max = h;
    }
  }
  return max;
}

/** Search a spiral of candidate positions near `near` and return the
 *  one with the flattest local terrain. Falls back to `near` if nothing
 *  better is found. */
function findFlattestSpot(terrain: Terrain, near: THREE.Vector3): THREE.Vector3 {
  let bestX = near.x;
  let bestZ = near.z;
  let bestVar = patchVariance(terrain, near.x, near.z);
  // Sample 24 angles × 4 radii for ~96 candidates. Cheap.
  const radii = [4, 8, 12, 16];
  const angleCount = 24;
  for (let i = 0; i < angleCount; i++) {
    const a = (i / angleCount) * Math.PI * 2;
    for (const r of radii) {
      const x = near.x + Math.cos(a) * r;
      const z = near.z + Math.sin(a) * r;
      const v = patchVariance(terrain, x, z);
      if (v < bestVar) {
        bestVar = v;
        bestX = x;
        bestZ = z;
      }
    }
  }
  return new THREE.Vector3(bestX, terrain.heightAt(bestX, bestZ), bestZ);
}

export interface OpeningSceneResult {
  wreck: THREE.Group;
  skeleton: THREE.Group;
  journal: Journal;
  speeder: SpeederState;
}

export function setupOpeningScene(
  scene: THREE.Scene,
  world: RAPIER.World,
  terrain: Terrain,
  shelter: ShelterRegistry,
  weather: Weather,
  camera: THREE.PerspectiveCamera,
  rand: Rng,
  playerBody: PlayerBody,
): OpeningSceneResult {
  // ── Find the flattest landing spot near the nominal position so the
  // wreck doesn't clip into a dune slope, then RAISE the wreck so the
  // top of its floor sits above the max terrain height anywhere in its
  // footprint (otherwise terrain bumps poke up through the floor and
  // can cover the journal). 5cm clearance keeps the autostep tractable
  // when the player enters from outside. ──────────────────────────────
  const E = OPENING_WRECK_EXTENTS;
  const flat = findFlattestSpot(terrain, WRECK_SEARCH_CENTER);
  const maxFootprintY = maxTerrainInFootprint(
    terrain, flat.x, flat.z, E.halfX + 0.3, E.halfZ + 0.3,
  );
  const wreckOrigin = new THREE.Vector3(flat.x, maxFootprintY + 0.05, flat.z);

  // ── Fixed yaw: back wall faces world +X (where the sun rises).
  // Wreck-local +Z rotates to world +X under yaw=π/2, so the back-wall
  // window catches the morning sun directly. Entrance (local -Z) opens
  // toward world -X (west) — player is teleported there below. ─────────
  const yaw = Math.PI / 2;

  // ── Place the wreck (mesh + collider, with yaw rotation applied). ─────
  const wreck = placeOpeningWreck(scene, world, terrain, wreckOrigin, yaw, rand);

  // ── Register a shelter zone covering the rotated interior. We use a
  // slightly oversized AABB (radius = diagonal of the interior) so the
  // axis-aligned zone always covers the rotated wreck cavity. ─────────
  const shelterHalf = Math.sqrt(E.halfX * E.halfX + E.halfZ * E.halfZ);
  addShelterZone(
    shelter,
    { x: wreckOrigin.x, y: wreckOrigin.y + E.halfY, z: wreckOrigin.z },
    { x: shelterHalf, y: E.halfY, z: shelterHalf },
  );

  // ── Skeleton: positioned in LOCAL wreck space (against the back wall),
  // then that local offset rotated by `yaw` to get the world position.
  // Skeleton's own Y-rotation is also offset by yaw so it still faces the
  // entrance after the wreck is rotated. ───────────────────────────────
  const yawRot = new THREE.Euler(0, yaw, 0);
  const skeletonLocal = new THREE.Vector3(0, 0.02, E.backZ - 0.45);
  const skeletonWorld = skeletonLocal.clone().applyEuler(yawRot).add(wreckOrigin);
  const skeleton = makeSkeleton();
  skeleton.position.copy(skeletonWorld);
  // Skeleton's local "forward" is +Z; we want it facing -Z (entrance).
  // After wreck rotation, the world-space rotation is yaw + π.
  skeleton.rotation.y = yaw + Math.PI;
  scene.add(skeleton);

  // ── Journal: at the skeleton's outstretched right hand. Same rotation
  // treatment as the skeleton — local offset rotated by yaw. ───────────
  // In wreck-local space, the skeleton's right hand fingertip sits at
  // approximately (-0.08, 0.02, backZ - 0.45 - 0.48).
  const journalLocal = new THREE.Vector3(-0.08, 0.02, E.backZ - 0.45 - 0.48);
  const journalWorld = journalLocal.clone().applyEuler(yawRot).add(wreckOrigin);
  const journal = placeJournal(scene, journalWorld, yaw + Math.PI * 0.5);

  // ── (Session AA — no opening sandstorm. Calm weather at boot.) ────────
  // `weather` arg retained for future use (e.g. opening cinematic variants).
  void weather;

  // ── Compute entrance world position (used for both player placement
  // and camera lookAt). With yaw=π/2 the entrance opens toward world -X.
  const entranceLocal = new THREE.Vector3(0, E.halfY, -E.halfZ);
  const entranceWorld = entranceLocal.clone().applyEuler(yawRot).add(wreckOrigin);

  // ── Teleport the player to a spot in front of the entrance, on the same
  // Z line as the wreck so they face the entrance squarely. The Y is the
  // terrain height at that spot + capsule offset. Done after wreck
  // placement (which can drift ±16m via findFlattestSpot) so the player
  // always lands the right distance from the entrance regardless. ──────
  // "In front of the entrance" = on the side the entrance opens toward.
  // With yaw=π/2, the entrance's outward direction is world -X, so the
  // player goes further -X from the entrance.
  const entranceOutward = new THREE.Vector3(0, 0, -1).applyEuler(yawRot);
  const spawnX = entranceWorld.x + entranceOutward.x * PLAYER_SPAWN_OFFSET_FROM_ENTRANCE;
  const spawnZ = entranceWorld.z + entranceOutward.z * PLAYER_SPAWN_OFFSET_FROM_ENTRANCE;
  const spawnGroundY = terrain.heightAt(spawnX, spawnZ);
  const spawnY = spawnGroundY + Tuning.PLAYER_CAPSULE_HALF_HEIGHT + Tuning.PLAYER_CAPSULE_RADIUS;
  playerBody.body.setNextKinematicTranslation({ x: spawnX, y: spawnY, z: spawnZ });

  // ── Camera lookAt — orient first-frame view toward the entrance. The
  // camera follows the player body each frame; this just sets initial
  // rotation before PointerLockControls takes over. ────────────────────
  // Camera is at player position once syncCameraToBody runs, but for the
  // very first frame the camera still sits at the original spawn point.
  // Reposition it so lookAt anchors from the new player location.
  camera.position.set(spawnX, spawnY, spawnZ);
  camera.lookAt(entranceWorld.x, entranceWorld.y, entranceWorld.z);

  // ── Speeder (Session CC) — spawn 8m to the side of the wreck so it's
  // visible from the entrance but not in the player's spawn path.
  // Position perpendicular to the wreck-entrance axis. With yaw=π/2 the
  // entrance opens toward -X; perpendicular = ±Z. Pick +Z so the
  // speeder ends up south of the wreck (player sees it as they emerge).
  const speederLocal = new THREE.Vector3(0, 0, E.halfZ + 4.5);
  const speederWorld = speederLocal.clone().applyEuler(yawRot).add(wreckOrigin);
  // Heading: face roughly toward the mega-wreck SW so the player can hop
  // on and accelerate in the natural exploration direction.
  const speederYaw = Math.atan2(-180 - speederWorld.x, -130 - speederWorld.z);
  const speederGroundY = terrain.heightAt(speederWorld.x, speederWorld.z);
  speederWorld.y = speederGroundY + Tuning.SPEEDER_HOVER_HEIGHT;
  const speeder = placeSpeeder(scene, world, terrain, speederWorld, speederYaw, rand);

  return { wreck, skeleton, journal, speeder };
}
