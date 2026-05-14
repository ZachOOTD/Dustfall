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
import { seedOpeningStorm } from './weather.ts';

/** Nominal world position to search around for the wreck placement. We
 *  want it ~12-20m from spawn so it's visible through storm fog (fog.far
 *  at intensity 0.7 is ~30m with the more-aggressive storm) but not on
 *  top of the player. */
const WRECK_SEARCH_CENTER = new THREE.Vector3(0, 0, 14);

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
}

export function setupOpeningScene(
  scene: THREE.Scene,
  world: RAPIER.World,
  terrain: Terrain,
  shelter: ShelterRegistry,
  weather: Weather,
  camera: THREE.PerspectiveCamera,
  rand: Rng,
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

  // ── Orient the wreck so its entrance (local -Z) points back toward the
  // player at the origin. atan2(x, z) gives the angle such that the
  // rotated local -Z direction equals normalize(origin - wreck). ───────
  const yaw = Math.atan2(wreckOrigin.x, wreckOrigin.z);

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

  // ── Seed the opening sandstorm. ───────────────────────────────────────
  seedOpeningStorm(weather);

  // ── Point the camera at the wreck's entrance so the player sees the
  // opening on their first frame. The entrance is at wreck local
  // (0, halfY, -halfZ), rotated by yaw into world space. ───────────────
  const entranceLocal = new THREE.Vector3(0, E.halfY, -E.halfZ);
  const entranceWorld = entranceLocal.applyEuler(yawRot).add(wreckOrigin);
  camera.lookAt(entranceWorld.x, entranceWorld.y, entranceWorld.z);

  return { wreck, skeleton, journal };
}
