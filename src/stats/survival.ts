// Thirst / temperature (two-way) / hunger / health ticking + death triggers.
// Stamina is ticked in player/controller.ts (it depends on sprint state).

import type { GameContext } from '../GameContext.ts';
import { isPlaying } from '../GameContext.ts';
import { Tuning } from '../config/tuning.ts';
import { playDeath } from '../audio/audio.ts';
import { updateDeathScreenButtons } from '../ui/menus.ts';
import { crashHeatAt } from '../world/meteorCrash.ts';   // Tier 4 (C) — crash-wreck interior heat hazard
import { introActive } from '../world/escapePodIntro/sequence.ts';   // escape-pod intro (T0.2) — no survival drain during the intro

export function updateStats(ctx: GameContext, dt: number): void {
  if (!isPlaying(ctx)) return;
  // Escape-pod intro (T0.2, D269) — survival is suspended during the scripted intro:
  // no thirst/hunger/temperature drain, no death, while the player is in the ship/pod.
  if (introActive(ctx)) return;

  const sprinting = isSprinting(ctx);
  const exposure = Math.max(0, ctx.time.sunHeight);
  const t = ctx.stats;

  // Tier 4 (C) — compute the crash HEAT bake UP FRONT. A crash fire registers a shelter zone
  // (fire.ts) and the first one sits dead-centre, so without this the inShelter branch below would
  // COOL the player at exactly the loot-rich wreck centre — canceling the hazard at the spot it's
  // meant to gate. While the bake is active (crashHeat>0) shelter relief is SUPPRESSED and the
  // ambient (sun/night) branch + the bake run instead.
  const crashHeat = crashHeatAt(ctx);

  // Temperature — two-way.
  //   Positive side: sun exposure heats you up (capped at +1 = heatstroke).
  //   Negative side: cold nights without shelter chill you (down to -1 = freeze).
  //   Shelter pulls you toward 0 from either side.
  if (ctx.player.inShelter && crashHeat <= 0) {
    if (t.temperature > 0) {
      t.temperature = Math.max(0, t.temperature - Tuning.HEAT_COOL_PER_SEC * 2 * dt);
    } else if (t.temperature < 0) {
      t.temperature = Math.min(0, t.temperature + Tuning.COLD_SHELTER_RECOVER * dt);
    }
  } else if (exposure > 0.2) {
    // Sun is up. Direct sun heats; SHADE (a dune's lee, a low-sun shadow) relieves it.
    // sunExposure01: 1 = full direct sun, 0 = fully terrain-occluded (C31).
    const sun01 = ctx.player.sunExposure01;
    // Heat gain scales with how much direct sun reaches you (floored — deep shade
    // still warms a little at midday, you're not in a fridge).
    const heatScale = Tuning.SHADE_HEAT_FLOOR + (1 - Tuning.SHADE_HEAT_FLOOR) * sun01;
    t.temperature = Math.min(
      1,
      t.temperature + Tuning.HEAT_GAIN_PER_SEC * dt * exposure * heatScale,
    );
    // Real shade (mostly occluded) is cooler air — gently pull a HOT player toward 0
    // (a weak shelter), so ducking into shade actively helps once you're overheating.
    // In DEEP shade the net of (small floored gain) + (this cool) is slightly cooling —
    // intended; both clamps keep temperature in [0, 1].
    if (sun01 < 0.5 && t.temperature > 0) {
      t.temperature = Math.max(
        0,
        t.temperature - Tuning.SHADE_COOL_PER_SEC * (1 - sun01) * dt,
      );
    }
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

  // Tier 4 (C) — crash-wreck HEAT HAZARD: lingering in/near a still-burning crash bakes you,
  // pushing temperature UP toward heatstroke (the risk that gates the rich interior loot). Applied
  // before the thirst calc so the bake also parches you; falls off with distance + as fires die.
  if (crashHeat > 0) {
    t.temperature = Math.min(1, t.temperature + Tuning.CRASH_HEAT_GAIN_PER_SEC * dt * crashHeat);
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

  // M6 ② (C38) — health REGEN when fully provisioned (the forgiving keystone). If thirst +
  // hunger are comfortably up AND temperature is near neutral, slowly heal back toward full.
  // The thresholds sit strictly inside the no-damage zone (thirst/hunger > 0, |temp| < 1), so
  // a player can never be taking damage and regenerating in the same tick. Lets a bad patch
  // heal off once you've re-secured water/food/shelter — Long Dark "condition recovers".
  if (
    t.health < 1 &&
    t.thirst > Tuning.HEALTH_REGEN_THIRST_MIN &&
    t.hunger > Tuning.HEALTH_REGEN_HUNGER_MIN &&
    Math.abs(t.temperature) < Tuning.HEALTH_REGEN_TEMP_MAX
  ) {
    t.health = Math.min(1, t.health + Tuning.HEALTH_REGEN_PER_SEC * dt);
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
  // Godmode floor. M6 ② (C38): GOD_MODE flipped OFF so the real NEW GAME is lethal, but
  // DEV-mode boots (rig-shots, feature walk-tests) still floor the stats so a long testing
  // session isn't interrupted by starvation. So: floor iff GOD_MODE OR we're in dev mode.
  if (Tuning.GOD_MODE || ctx.flags.devMode) {
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
