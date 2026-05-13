// Shelter system: axis-aligned boxes (in world space) that grant the player
// shade. Each frame we test the player's XZ position + Y against every zone
// and set ctx.player.inShelter accordingly. Cheap for the handful of zones
// we register (typically ~15).

import type { GameContext } from '../GameContext.ts';
import type * as THREE from 'three';

export interface ShelterZone {
  cx: number;        // world-space center X
  cy: number;        // world-space center Y (usually mid-height of the prop)
  cz: number;        // world-space center Z
  hx: number;        // half-extent X
  hy: number;        // half-extent Y
  hz: number;        // half-extent Z
}

export interface ShelterRegistry {
  zones: ShelterZone[];
}

export function createShelterRegistry(): ShelterRegistry {
  return { zones: [] };
}

/** Register a shelter zone at a world position with given half-extents. */
export function addShelterZone(
  reg: ShelterRegistry,
  pos: THREE.Vector3 | { x: number; y: number; z: number },
  half: { x: number; y: number; z: number },
): void {
  reg.zones.push({
    cx: pos.x, cy: pos.y, cz: pos.z,
    hx: half.x, hy: half.y, hz: half.z,
  });
}

/** Returns true if the world point (x, y, z) is inside any zone. */
function pointInsideAny(reg: ShelterRegistry, x: number, y: number, z: number): boolean {
  for (const z0 of reg.zones) {
    if (
      Math.abs(x - z0.cx) <= z0.hx &&
      Math.abs(y - z0.cy) <= z0.hy &&
      Math.abs(z - z0.cz) <= z0.hz
    ) return true;
  }
  return false;
}

/** Per-frame shelter check. Writes ctx.player.inShelter. */
export function updateShelter(ctx: GameContext, _dt: number): void {
  const tr = ctx.player.body.body.translation();
  ctx.player.inShelter = pointInsideAny(ctx.shelter, tr.x, tr.y, tr.z);
}
