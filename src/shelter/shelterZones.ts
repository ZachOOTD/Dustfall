// Shelter system: axis-aligned boxes (in world space) that grant the player
// shade. Each frame we test the player's XZ position + Y against every zone
// and set ctx.player.inShelter accordingly. Cheap for the handful of zones
// we register (typically ~15).

import type { GameContext } from '../GameContext.ts';
import type * as THREE from 'three';
import { Tuning } from '../config/tuning.ts';

export interface ShelterZone {
  cx: number;        // world-space center X
  cy: number;        // world-space center Y (usually mid-height of the prop)
  cz: number;        // world-space center Z
  hx: number;        // half-extent X
  hy: number;        // half-extent Y
  hz: number;        // half-extent Z
  /** Session YY — if true, this zone is a "partial enclosure" (large
   *  tent with open front) and the perceived storm intensity inside
   *  is dampened (not zeroed). Default false = fully shielded. */
  isLargeTent?: boolean;
}

export interface ShelterRegistry {
  zones: ShelterZone[];
}

export function createShelterRegistry(): ShelterRegistry {
  return { zones: [] };
}

/** Register a shelter zone at a world position with given half-extents.
 *  Returns the zone reference so callers can remove it later. */
export function addShelterZone(
  reg: ShelterRegistry,
  pos: THREE.Vector3 | { x: number; y: number; z: number },
  half: { x: number; y: number; z: number },
  opts?: { isLargeTent?: boolean },
): ShelterZone {
  const zone: ShelterZone = {
    cx: pos.x, cy: pos.y, cz: pos.z,
    hx: half.x, hy: half.y, hz: half.z,
    isLargeTent: opts?.isLargeTent,
  };
  reg.zones.push(zone);
  return zone;
}

/** Remove a previously-added zone (used when a fire burns out, tent breaks, etc). */
export function removeShelterZone(reg: ShelterRegistry, zone: ShelterZone): void {
  const idx = reg.zones.indexOf(zone);
  if (idx >= 0) reg.zones.splice(idx, 1);
}

interface ShelterStatus {
  inShelter: boolean;
  inLargeTent: boolean;
}

/** Walk every zone once; record both "any shelter?" and "any large
 *  tent?" so updateShelter can route perceivedIntensity correctly. */
function classifyShelter(reg: ShelterRegistry, x: number, y: number, z: number): ShelterStatus {
  let inShelter = false;
  let inLargeTent = false;
  for (const z0 of reg.zones) {
    if (
      Math.abs(x - z0.cx) <= z0.hx &&
      Math.abs(y - z0.cy) <= z0.hy &&
      Math.abs(z - z0.cz) <= z0.hz
    ) {
      inShelter = true;
      if (z0.isLargeTent) inLargeTent = true;
    }
  }
  return { inShelter, inLargeTent };
}

/** Per-frame shelter check. Writes ctx.player.inShelter AND (Session YY)
 *  ctx.weather.perceivedIntensity for downstream visual systems. */
export function updateShelter(ctx: GameContext, _dt: number): void {
  const tr = ctx.player.body.body.translation();
  const status = classifyShelter(ctx.shelter, tr.x, tr.y, tr.z);
  ctx.player.inShelter = status.inShelter;
  // YY — perceivedIntensity. Outside any shelter = world truth.
  // Inside large tent (open front) = dampened. Inside any other
  // shelter (small tent / fire — fully enclosed) = 0.
  if (status.inLargeTent) {
    ctx.weather.perceivedIntensity = ctx.weather.intensity * Tuning.LARGE_TENT_STORM_DAMPEN;
  } else if (status.inShelter) {
    ctx.weather.perceivedIntensity = 0;
  } else {
    ctx.weather.perceivedIntensity = ctx.weather.intensity;
  }
}
