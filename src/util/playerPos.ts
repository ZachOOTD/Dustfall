// Effective player world position — speeder-aware.
//
// When the player mounts the speeder, the capsule body is parked at
// (0, -2000, 0) and its X/Z freeze. Any system that wants to read
// the player's CURRENT world position (AI targeting, rope endpoint
// resolution, ambient effects keyed to player location) must read the
// speeder body instead during mounted state.
//
// Lifted to util/ in B1 Phase 2 when the rope endpoint resolver became
// the 3rd consumer (originally duplicated in companion.ts + sandWorm.ts).

import type { GameContext } from '../GameContext.ts';

export function getPlayerPos(
  ctx: GameContext,
): { x: number; y: number; z: number } {
  if (ctx.speeder?.mounted) {
    const tr = ctx.speeder.body.translation();
    return { x: tr.x, y: tr.y, z: tr.z };
  }
  const tr = ctx.player.body.body.translation();
  return { x: tr.x, y: tr.y, z: tr.z };
}
