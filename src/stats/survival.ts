// Thirst / temperature (two-way) / hunger / health ticking + death triggers.
// Stamina is ticked in player/controller.ts (it depends on sprint state).

import type { GameContext } from '../GameContext.ts';
import { isPlaying } from '../GameContext.ts';
import { Tuning } from '../config/tuning.ts';
import { playDeath } from '../audio/audio.ts';
import { updateDeathScreenButtons } from '../ui/menus.ts';

export function updateStats(ctx: GameContext, dt: number): void {
  if (!isPlaying(ctx)) return;

  const sprinting = isSprinting(ctx);
  const exposure = Math.max(0, ctx.time.sunHeight);
  const t = ctx.stats;

  // Temperature — two-way.
  //   Positive side: sun exposure heats you up (capped at +1 = heatstroke).
  //   Negative side: cold nights without shelter chill you (down to -1 = freeze).
  //   Shelter pulls you toward 0 from either side.
  if (ctx.player.inShelter) {
    if (t.temperature > 0) {
      t.temperature = Math.max(0, t.temperature - Tuning.HEAT_COOL_PER_SEC * 2 * dt);
    } else if (t.temperature < 0) {
      t.temperature = Math.min(0, t.temperature + Tuning.COLD_SHELTER_RECOVER * dt);
    }
  } else if (exposure > 0.2) {
    // Sun is up — heating
    t.temperature = Math.min(
      1,
      t.temperature + Tuning.HEAT_GAIN_PER_SEC * dt * exposure,
    );
  } else if (exposure <= 0.0) {
    // Sun is down (night) — chilling
    t.temperature = Math.max(
      -1,
      t.temperature - Tuning.COLD_NIGHT_DRAIN * dt,
    );
  } else {
    // Twilight — drift toward 0
    if (t.temperature > 0) {
      t.temperature = Math.max(0, t.temperature - Tuning.HEAT_COOL_PER_SEC * dt);
    } else if (t.temperature < 0) {
      t.temperature = Math.min(0, t.temperature + Tuning.HEAT_COOL_PER_SEC * dt);
    }
  }

  // Thirst — sandstorms + sprint + heat all accelerate.
  const stormFactor = 1 + ctx.weather.intensity * 0.30;
  const heatBoost = Math.max(0, t.temperature); // only positive temp drives thirst
  const thirstMul =
    (sprinting ? Tuning.THIRST_SPRINT_FACTOR : 1) *
    (1 + heatBoost * (Tuning.THIRST_HEAT_FACTOR - 1)) *
    stormFactor;
  t.thirst = Math.max(0, t.thirst - Tuning.THIRST_DRAIN_PER_SEC * dt * thirstMul);

  // Hunger — steady drain regardless of activity.
  t.hunger = Math.max(0, t.hunger - Tuning.HUNGER_DRAIN_PER_SEC * dt);

  // Damage from each lethal stat
  if (t.thirst <= 0) {
    t.health = Math.max(0, t.health - Tuning.DEHYDRATION_DAMAGE * dt);
  }
  if (t.temperature >= 1) {
    t.health = Math.max(0, t.health - Tuning.HEATSTROKE_DAMAGE * dt);
  }
  if (t.temperature <= -1) {
    t.health = Math.max(0, t.health - Tuning.COLD_DAMAGE_PER_SEC * dt);
  }
  if (t.hunger <= 0) {
    t.health = Math.max(0, t.health - Tuning.HUNGER_STARVATION_DAMAGE * dt);
  }

  // Death — pick the most severe cause
  if (t.health <= 0) {
    let cause = 'the desert took you';
    if (t.temperature >= 1) cause = 'the sun took you';
    else if (t.temperature <= -1) cause = 'the cold took you';
    else if (t.thirst <= 0) cause = 'the thirst took you';
    else if (t.hunger <= 0) cause = 'the hunger took you';
    die(ctx, cause);
  }
}

export function die(ctx: GameContext, cause: string): void {
  if (ctx.stats.dead) return;
  // Testing godmode (Tuning.GOD_MODE). Floor the stats so the player can keep
  // playing, but otherwise behave like nothing happened.
  if (Tuning.GOD_MODE) {
    ctx.stats.health = Math.max(ctx.stats.health, 0.5);
    ctx.stats.thirst = Math.max(ctx.stats.thirst, 0.1);
    ctx.stats.hunger = Math.max(ctx.stats.hunger, 0.1);
    ctx.stats.temperature = Math.max(-0.99, Math.min(0.99, ctx.stats.temperature));
    return;
  }
  ctx.stats.dead = true;
  // Refresh the death overlay's Continue button visibility based on whether
  // a save currently exists. Death does NOT auto-save; the player can only
  // load whatever sleep autosave or manual save existed before they died.
  updateDeathScreenButtons();
  // daysSurvived starts at 0 (= day 1). On death we show "you survived N days"
  // where N is days fully + the current day, matching the in-game "day N" HUD.
  ctx.ui.setDeathCause(cause, ctx.time.daysSurvived + 1);
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
    ctx.stats.stamina > Tuning.STAMINA_SPRINT_THRESHOLD &&
    moving
  );
}
