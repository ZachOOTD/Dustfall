// Thirst / heat / health ticking + death triggers.

import type { GameContext } from '../GameContext.ts';
import { isPlaying } from '../GameContext.ts';
import { Tuning } from '../config/tuning.ts';
import { playDeath } from '../audio/audio.ts';

export function updateStats(ctx: GameContext, dt: number): void {
  if (!isPlaying(ctx)) return;

  const sprinting = isSprinting(ctx);
  const exposure = Math.max(0, ctx.time.sunHeight);

  // Heat — shelter halts sun-exposure heating and doubles passive cooling.
  if (ctx.player.inShelter) {
    ctx.stats.heat = Math.max(0, ctx.stats.heat - Tuning.HEAT_COOL_PER_SEC * 2 * dt);
  } else if (exposure > 0.2) {
    ctx.stats.heat = Math.min(
      1,
      ctx.stats.heat + Tuning.HEAT_GAIN_PER_SEC * dt * exposure,
    );
  } else {
    ctx.stats.heat = Math.max(0, ctx.stats.heat - Tuning.HEAT_COOL_PER_SEC * dt);
  }

  // Thirst — sandstorms accelerate dehydration too
  const stormFactor = 1 + ctx.weather.intensity * 0.30;
  const thirstMul =
    (sprinting ? Tuning.THIRST_SPRINT_FACTOR : 1) *
    (1 + ctx.stats.heat * (Tuning.THIRST_HEAT_FACTOR - 1)) *
    stormFactor;
  ctx.stats.thirst = Math.max(
    0,
    ctx.stats.thirst - Tuning.THIRST_DRAIN_PER_SEC * dt * thirstMul,
  );

  // Damage
  if (ctx.stats.thirst <= 0) {
    ctx.stats.health = Math.max(0, ctx.stats.health - Tuning.DEHYDRATION_DAMAGE * dt);
  }
  if (ctx.stats.heat >= 1) {
    ctx.stats.health = Math.max(0, ctx.stats.health - Tuning.HEATSTROKE_DAMAGE * dt);
  }

  // Death
  if (ctx.stats.health <= 0) {
    let cause = 'the desert took you';
    if (ctx.stats.heat >= 1) cause = 'the sun took you';
    else if (ctx.stats.thirst <= 0) cause = 'the thirst took you';
    die(ctx, cause);
  }
}

export function die(ctx: GameContext, cause: string): void {
  if (ctx.stats.dead) return;
  ctx.stats.dead = true;
  ctx.ui.setDeathCause(cause);
  ctx.input.controls.unlock();
  playDeath();
}

function isSprinting(ctx: GameContext): boolean {
  const moving =
    (ctx.input.keys['KeyW'] ? 1 : 0) - (ctx.input.keys['KeyS'] ? 1 : 0) !== 0 ||
    (ctx.input.keys['KeyD'] ? 1 : 0) - (ctx.input.keys['KeyA'] ? 1 : 0) !== 0;
  return (
    (ctx.input.keys['ShiftLeft'] || ctx.input.keys['ShiftRight']) &&
    ctx.stats.thirst > 0.02 &&
    moving
  );
}
