// Render loop driver. Composes the per-frame tick callback in main.ts.

import type * as THREE from 'three';
import type { GameContext } from '../GameContext.ts';

export type TickFn = (ctx: GameContext, dt: number) => void;
export type RenderTarget = { scene: THREE.Scene; camera: THREE.Camera };

/** Pick the right scheduler for "next frame". In dev mode, if the tab
 *  is hidden (preview iframes, headless verification, minimized) the
 *  browser throttles requestAnimationFrame to ~1Hz or stops it
 *  entirely, which blocks our updateCombat / updatePhysics / etc.
 *  setTimeout(16) keeps a steady ~60fps tick regardless of visibility,
 *  letting eval-driven verification actually exercise game logic.
 *  Production builds use real rAF unconditionally — when the user
 *  isn't looking we don't want to burn CPU. */
function scheduleFrame(cb: () => void): void {
  if (import.meta.env.DEV && typeof document !== 'undefined' && document.hidden) {
    setTimeout(cb, 16);
  } else {
    requestAnimationFrame(cb);
  }
}

export function startLoop(
  ctx: GameContext,
  tick: TickFn,
  getRenderTarget?: () => RenderTarget,
): void {
  const frame = (): void => {
    scheduleFrame(frame);
    const dt = Math.min(ctx.three.clock.getDelta(), 0.1);
    tick(ctx, dt);
    // Wrap render in a GPU timer query so the perf HUD can show GPU ms.
    ctx.three.gpuTimer.begin();
    const target = getRenderTarget?.();
    const renderer = ctx.three.renderer;
    // Main pass (getRenderTarget always returns a target — the title scene, or
    // the world scene during gameplay).
    if (target) renderer.render(target.scene, target.camera);
    else renderer.render(ctx.three.scene, ctx.three.camera);
    // ACAA — second pass: the FP viewmodel renders in its OWN scene over a
    // CLEARED depth buffer, so it draws on top of the world (no wall-clip)
    // while still depth-sorting WITHIN itself (no see-through rings). Gated on
    // vm.group.visible (false in 3P / on death / at the title), so it only runs
    // during FP gameplay. Uses the game camera the viewmodel tracks.
    const vm = ctx.player?.viewModel;
    if (vm && vm.group.visible) {
      renderer.autoClear = false;
      renderer.clearDepth();
      renderer.render(vm.scene, ctx.three.camera);
      renderer.autoClear = true;
    }
    ctx.three.gpuTimer.end();
  };
  scheduleFrame(frame);
}
