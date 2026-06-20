// ACBD — the player's EFFECTIVE world position.
//
// While mounted on the speeder, the player capsule is PARKED off-world at
// (0, -2000, 0) (speeder.ts — so it can't collide while the rider rides). That
// means `ctx.player.body.body.translation()` is meaningless during a ride. Any
// WORLD-SPATIAL system that reads the player position — weather (storm wall +
// intensity + wind), sun-shade, vista reveal, the distant-worm spectacle — must
// use THIS accessor instead, or it evaluates 2km underground at the origin while
// you ride (the bug behind: a storm vanishing on dismount + the dust blowing
// opposite to the bike).
//
// Movement/physics/mount code that legitimately reads the parked body (e.g. the
// speeder's own mount-distance check) must NOT use this — it wants the real body.

import type { GameContext } from '../GameContext.ts';

export function getPlayerWorldPos(ctx: GameContext): { x: number; y: number; z: number } {
  if (ctx.speeder && ctx.speeder.mounted) return ctx.speeder.body.translation();
  return ctx.player.body.body.translation();
}
