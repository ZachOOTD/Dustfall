// Sun-occluder registration (was: horizon landmark silhouettes — M5a C28, billboards
// REMOVED ACBD).
//
// C28 added fog-resistant dark BILLBOARDS at each flagship/hero wreck so a distant
// landmark stood on the skyline as a nav cue. They read as glitchy floating dark
// blobs (the [partial] look never converged), so ACBD removed the visual billboards
// and kept only the by-product the rest of the game needs: each tall wreck's bounding
// box, registered as a SUN OCCLUDER (C31) — standing in a wreck's shadow relieves
// heat. Distant wrecks now just fog out naturally (the pre-C28 look the user liked).
//
// The function names are kept (callers in main.ts / heroLandmarks.ts are unchanged):
// they now register occluders only. Determinism: built from a landmark's position +
// bounding box (no rand draw), so the seeded scatter stream is untouched.

import * as THREE from 'three';
import { Tuning } from '../config/tuning.ts';

// C31 — tall wreck bounding boxes are SUN OCCLUDERS: a tall wreck casts a real ground
// shadow (unlike the gentle dunes / small shelter zones), so standing in it relieves
// heat (sun-shade-exposure). Read by world/sunExposure.ts.
export interface SunOccluder { cx: number; cy: number; cz: number; hx: number; hy: number; hz: number; }
const _occluders: SunOccluder[] = [];
export function getSunOccluders(): ReadonlyArray<SunOccluder> { return _occluders; }

/** Register a major landmark as a sun occluder. `box` is the landmark's world-space
 *  bounding box. Short structures (below SUN_OCCLUDER_MIN_HEIGHT) are skipped.
 *  M3 (campaign 2026-07-09): threshold DECOUPLED from HORIZON_SILHOUETTE_MIN_HEIGHT
 *  (8m — a C28 silhouette-era coupling): a 3m wreck casts real shade you can stand
 *  in even though it never earned a skyline silhouette. (`_scene` is unused now that
 *  the billboard mesh is gone; kept so callers don't change.) */
export function addHorizonSilhouette(_scene: THREE.Scene, box: THREE.Box3): void {
  const size = new THREE.Vector3();
  box.getSize(size);
  if (size.y < Tuning.SUN_OCCLUDER_MIN_HEIGHT) return;
  _occluders.push({
    cx: (box.min.x + box.max.x) * 0.5,
    cz: (box.min.z + box.max.z) * 0.5,
    cy: (box.min.y + box.max.y) * 0.5,
    hx: size.x * 0.5, hy: size.y * 0.5, hz: size.z * 0.5,
  });
}

/** Find each scene group whose name is in `names` (the hand-modeled flagships) and
 *  register it as a sun occluder. Call AFTER the POIs/flagships are placed. */
export function addHorizonSilhouettesByName(scene: THREE.Scene, names: ReadonlyArray<string>): void {
  const set = new Set(names);
  const hits: THREE.Object3D[] = [];
  scene.traverse((o) => { if (o.name && set.has(o.name)) hits.push(o); });
  for (const o of hits) addHorizonSilhouette(scene, new THREE.Box3().setFromObject(o));
}

/** Clear on world rebuild (Continue / new game) so occluders don't accumulate. */
export function clearHorizonSilhouettes(_scene: THREE.Scene): void {
  _occluders.length = 0;
}
