// Debug handles attached to window.__game so MCP preview tools can poke state.

import RAPIER from '@dimforge/rapier3d-compat';
import type { GameContext } from '../GameContext.ts';

declare global {
  interface Window {
    __game?: DebugApi;
  }
}

interface DebugApi {
  setTime: (t: number) => void;
  setStats: (s: { thirst?: number; heat?: number; health?: number }) => void;
  state: () => {
    thirst: number;
    heat: number;
    health: number;
    dayTime: number;
    playerDead: boolean;
  };
  ctx: GameContext;
  RAPIER: typeof RAPIER;
  castDown: (x: number, z: number, fromY?: number) => null | {
    hitY: number;
    timeOfImpact: number;
    colliderHandle: number;
    shape: number;
  };
  /** Trigger a sandstorm immediately for testing. */
  triggerStorm: () => void;
}

export function installDebugPanel(ctx: GameContext): void {
  window.__game = {
    setTime: (t) => { ctx.time.dayTime = t; },
    setStats: (s) => {
      if (s.thirst !== undefined) ctx.stats.thirst = s.thirst;
      if (s.heat !== undefined) ctx.stats.heat = s.heat;
      if (s.health !== undefined) ctx.stats.health = s.health;
    },
    state: () => ({
      thirst: ctx.stats.thirst,
      heat: ctx.stats.heat,
      health: ctx.stats.health,
      dayTime: ctx.time.dayTime,
      playerDead: ctx.stats.dead,
    }),
    ctx,
    RAPIER,
    castDown(x, z, fromY = 100) {
      const ray = new RAPIER.Ray({ x, y: fromY, z }, { x: 0, y: -1, z: 0 });
      const hit = ctx.physics.world.castRay(ray, 500, true);
      if (!hit) return null;
      const hitY = fromY - hit.timeOfImpact;
      return {
        hitY,
        timeOfImpact: hit.timeOfImpact,
        colliderHandle: hit.collider.handle,
        shape: hit.collider.shape.type,
      };
    },
    triggerStorm() {
      ctx.weather.state = 'building';
      ctx.weather.stateTimer = 0;
    },
  };
}
