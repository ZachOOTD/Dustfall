// DEEPER cycle 11 (G1) — THE SHARED PLACEMENT GROUND SAMPLER.
//
// THE BUG THIS EXISTS TO KILL. Every placeable in the game computed its landing Y with
// `ctx.terrain.heightAt(x, z)` — the SURFACE sampler, an analytic evaluation of the desert
// heightfield that knows nothing about caves. Nine call sites did it identically (lantern, fire,
// bedroll, tent, large tent, locker, stake, sled, and the ghost preview that is supposed to promise
// where the thing will land). Underground that sampler answers with the terrain sheet ABOVE the
// player's head, so deploying anything inside a cave teleported it tens of metres up into solid
// rock: invisible, unreachable, unretrievable — and persisted there by the save. The ghost ring lied
// about it in exactly the same way, because it did the same arithmetic.
//
// THE FIX. One sampler, used by all of them, that asks the LIVE COLLIDERS what is actually under the
// aim point instead of asking the terrain field what it would be if there were no cave. A Rapier ray
// straight down, and whatever it hits — cave floor, wreck deck, boulder, or the terrain sheet — is
// the ground. Because deploy and preview now call the same function, they agree BY CONSTRUCTION;
// there is no second place for them to drift apart.
//
// TWO DETAILS THAT ARE LOAD-BEARING, both learned the hard way elsewhere in this repo:
//
//   1. THE RAY STARTS AT THE EYE, NOT AT y=100. The obvious "cast from high above" fails the exact
//      case this module was written for: from up there the ray hits the terrain sheet first and
//      never reaches the cave floor underneath it. Starting just above the camera means the first
//      thing the ray meets is the first thing BELOW YOU, which is the definition of "the ground
//      here" for a player standing in a chamber with fifty metres of rock overhead.
//   2. IT EXCLUDES THE PLAYER BODY. A ray launched from inside the capsule otherwise reports a hit
//      at TOI 0 on the capsule itself — the S1 probe lesson, already encoded in debugPanel's
//      `castDown(…, excludePlayer)`.
//
// SURFACE PARITY. When the ray lands on the terrain sheet, this returns `terrain.heightAt` — the
// ANALYTIC value, not the collider hit. The heightfield collider is a discretised version of the
// same field and differs by centimetres, and there is no reason for a cave fix to move where a fire
// sits on open desert. So out in the dunes the answer is byte-identical to what shipped; the
// collider hit is only ever used when it is genuinely something ELSE.

import RAPIER from '@dimforge/rapier3d-compat';
import type { GameContext } from '../GameContext.ts';
import { Tuning } from '../config/tuning.ts';

const _ORIGIN = { x: 0, y: 0, z: 0 };
const _DOWN = { x: 0, y: -1, z: 0 };

/** Is the player themselves below the terrain sheet — i.e. inside a carved cave?
 *
 *  Cheap and self-contained (no dependency on caveAtmosphere or the streamer): the terrain is a
 *  heightfield, so the ONLY way to be under `pureHeightAt` is to be inside a hole cut for a cave. */
function playerIsUnderground(ctx: GameContext): boolean {
  const cam = ctx.three.camera;
  return cam.position.y < ctx.terrain.pureHeightAt(cam.position.x, cam.position.z);
}

/**
 * The Y a placeable should land at for the aim point (x, z), or `null` when there is no ground
 * there to place on.
 *
 * `null` is a real answer, not an error: underground it means the player aimed across a pit or out
 * over a drop, and refusing is correct. On the SURFACE a miss instead falls back to the terrain
 * height — a downward ray launched from eye level can legitimately start below the ground when the
 * player faces a steep dune face, and refusing placement there would be a regression against
 * shipped behaviour for no gain.
 */
export function placementGroundY(ctx: GameContext, x: number, z: number): number | null {
  const surfY = ctx.terrain.heightAt(x, z);
  const world = ctx.physics?.world;
  if (!world) return surfY;                       // physics unavailable (headless/boot) → old answer

  const fromY = ctx.three.camera.position.y + Tuning.PLACEMENT_RAY_UP_M;
  _ORIGIN.x = x; _ORIGIN.y = fromY; _ORIGIN.z = z;
  const ray = new RAPIER.Ray(_ORIGIN, _DOWN);
  const hit = world.castRay(
    ray, Tuning.PLACEMENT_RAY_DROP_M, true,
    undefined, undefined, undefined,
    ctx.player.body.body,                         // never hit our own capsule (the S1 probe lesson)
  );
  if (!hit) return playerIsUnderground(ctx) ? null : surfY;

  const hitY = fromY - hit.timeOfImpact;
  // Surface parity — the terrain sheet answers with the analytic sampler (see the header).
  if (Math.abs(hitY - surfY) <= Tuning.PLACEMENT_SURFACE_SNAP_M) return surfY;
  return hitY;
}

/** The same sampler for callers that cannot refuse — the eight `deployX` kits whose contract is
 *  `Y | reject-for-proximity` and which have no "no ground" message of their own yet. Underground a
 *  `null` still has to become SOMETHING, and the terrain sheet is the one answer guaranteed to be
 *  wrong there, so these fall back to the player's own feet: the placeable lands where the player is
 *  standing rather than inside the ceiling. Lantern (which DOES have a refusal path) uses the
 *  nullable form above instead. */
export function placementGroundYOrFeet(ctx: GameContext, x: number, z: number): number {
  const y = placementGroundY(ctx, x, z);
  if (y !== null) return y;
  const b = ctx.player.body;
  return b.body.translation().y - (b.halfHeight + b.radius);   // the player's own feet
}
