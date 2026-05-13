// Render loop driver. Composes the per-frame tick callback in main.ts.

import type { GameContext } from '../GameContext.ts';

export type TickFn = (ctx: GameContext, dt: number) => void;

export function startLoop(ctx: GameContext, tick: TickFn): void {
  const frame = (): void => {
    requestAnimationFrame(frame);
    const dt = Math.min(ctx.three.clock.getDelta(), 0.1);
    tick(ctx, dt);
    ctx.three.renderer.render(ctx.three.scene, ctx.three.camera);
  };
  requestAnimationFrame(frame);
}
