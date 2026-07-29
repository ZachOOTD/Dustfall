// Shelter system: axis-aligned boxes (in world space) that grant the player
// shade. Each frame we test the player's XZ position + Y against every zone
// and set ctx.player.inShelter accordingly. Cheap for the handful of zones
// we register (typically ~15).

import type { GameContext } from '../GameContext.ts';
import type * as THREE from 'three';
import { Tuning } from '../config/tuning.ts';
import { caveContainmentAt } from '../world/caveAtmosphere.ts';   // DEEPER walk-test — a cave shelters you from the storm

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

  // ── DEEPER walk-test 2026-07-29 — A CAVE SHELTERS YOU FROM THE STORM. ──────────────────────────
  // Zach: *"the cave should be shelter so the storm doesn't effect you in it."* It did not: shelter
  // is classified against REGISTERED ZONES (tents, fires, vehicles) and a cave is not one, so the
  // haboob's movement penalty, its audio and its perceived intensity all applied through thirty
  // metres of rock.
  //
  // ⚠ WHY THIS IS NOT `inShelter = true`, which is the obvious one-line version and is WRONG:
  // `updateStats` evaluates `if (inShelter …) … else if (caveDepth > 0)`. Setting `inShelter`
  // underground pre-empts the cave branch, so every cave would stop running cycle 11's INV-COLD
  // model and instead be pulled toward temperature-neutral — i.e. "caves are cosy", the exact
  // inverse of the behaviour he reviewed and approved last cycle. A cave stops the WIND. It does
  // not warm you. So this is its own flag, and `inShelter` is deliberately left alone.
  //
  // The containment signal is cycle 11's (`caveContainmentAt`) — pure, and the same one the cold
  // model reads, so shelter and temperature can never disagree about whether you are underground.
  // Computed ONCE here and published, rather than re-derived by each consumer: cycle 11's own report
  // flagged a duplicated `caveContainmentAt` as real per-frame cost.
  ctx.player.inCave = ctx.caveAtmosphere
    ? caveContainmentAt(ctx.caveAtmosphere, { x: tr.x, y: tr.y, z: tr.z }, ctx).depth > 0
    : false;

  // YY — perceivedIntensity. Outside any shelter = world truth.
  // Inside large tent (open front) = dampened. Inside any other
  // shelter (small tent / fire — fully enclosed) = 0.
  if (ctx.player.inCave) {
    ctx.weather.perceivedIntensity = 0;   // no wind, no dust, no storm audio under rock
  } else if (status.inLargeTent) {
    ctx.weather.perceivedIntensity = ctx.weather.intensity * Tuning.LARGE_TENT_STORM_DAMPEN;
  } else if (status.inShelter) {
    ctx.weather.perceivedIntensity = 0;
  } else {
    ctx.weather.perceivedIntensity = ctx.weather.intensity;
  }
}
