// Render loop driver. Composes the per-frame tick callback in main.ts.

import type * as THREE from 'three';
import type { GameContext } from '../GameContext.ts';

export type TickFn = (ctx: GameContext, dt: number) => void;
export type RenderTarget = { scene: THREE.Scene; camera: THREE.Camera };

export function startLoop(
  ctx: GameContext,
  tick: TickFn,
  getRenderTarget?: () => RenderTarget,
): void {
  const frame = (): void => {
    requestAnimationFrame(frame);
    const dt = Math.min(ctx.three.clock.getDelta(), 0.1);
    tick(ctx, dt);
    // Wrap render in a GPU timer query so the perf HUD can show GPU ms.
    ctx.three.gpuTimer.begin();
    const target = getRenderTarget?.();
    if (target) ctx.three.renderer.render(target.scene, target.camera);
    else ctx.three.renderer.render(ctx.three.scene, ctx.three.camera);
    ctx.three.gpuTimer.end();
  };
  requestAnimationFrame(frame);
}
