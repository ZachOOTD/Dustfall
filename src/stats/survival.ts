// Thirst / temperature (two-way) / hunger / health ticking + death triggers.
// Stamina is ticked in player/controller.ts (it depends on sprint state).

import type { GameContext } from '../GameContext.ts';
import { isPlaying } from '../GameContext.ts';
import { Tuning } from '../config/tuning.ts';
import { playDeath } from '../audio/audio.ts';
import { updateDeathScreenButtons } from '../ui/menus.ts';
import { crashHeatAt } from '../world/meteorCrash.ts';   // Tier 4 (C) — crash-wreck interior heat hazard
import { introActive } from '../world/escapePodIntro/sequence.ts';   // escape-pod intro (T0.2) — no survival drain during the intro
import { caveContainmentAt } from '../world/caveAtmosphere.ts';   // DEEPER cycle 11 — cave cold (pure, no tick-order constraint)
import { getPlayerPos } from '../util/playerPos.ts';              // D297 — speeder-aware effective player pos

// ── DEEPER cycle 11 — INV-COLD, THE BOOT ASSERT ────────────────────────────────────────────────
//   The whole "a cave can never damage you" guarantee reduces to one inequality between two numbers
//   in tuning.ts. Check it at module load so a future edit to either one cannot ship silently.
//   Deliberately NOT a throw: a bad floor must be loud, but bricking the boot would also stop the
//   CAVE-COLD gate's matrix from RUNNING — and that matrix is the thing that actually demonstrates
//   the damage. So this screams, the gate measures, and both go red together.
export const CAVE_COLD_FLOOR_OK =
  Tuning.CAVE_COLD_FLOOR >= -1 + Tuning.CAVE_COLD_SAFETY_MARGIN
  && Tuning.CAVE_COLD_FLOOR <= 0
  && Tuning.CAVE_COLD_TARGET_MAX >= Tuning.CAVE_COLD_FLOOR;
if (!CAVE_COLD_FLOOR_OK) {
  // eslint-disable-next-line no-console
  console.error(
    `[survival] INV-COLD VIOLATED: CAVE_COLD_FLOOR=${Tuning.CAVE_COLD_FLOOR} must sit in ` +
    `[${-1 + Tuning.CAVE_COLD_SAFETY_MARGIN}, 0] and at or below CAVE_COLD_TARGET_MAX ` +
    `(${Tuning.CAVE_COLD_TARGET_MAX}). The cave can now freeze the player to death.`,
  );
}

/** DEEPER cycle 11 — the temperature the cave equilibrates the player toward at this depth.
 *
 *  ALWAYS in [CAVE_COLD_FLOOR, 0], and that clamp is applied LAST — after the depth ramp and after
 *  every multiplier — so no combination of kind × wetness can stack past it. This is the single
 *  place INV-COLD is enforced; `updateStats` only ever walks temperature toward whatever this
 *  returns and never past it, so the whole "cave cold never damages" guarantee lives here.
 *
 *  Exported so the CAVE-COLD gate can sweep it directly as well as through the real tick. */
export function caveColdTarget(depthM: number, kind: string, wet: boolean): number {
  if (!(depthM > 0)) return 0;                    // surface parity — exactly a no-op
  const t = Math.min(1, depthM / Tuning.CAVE_COLD_DEPTH_FULL_M);
  const ramp = t * t * (3 - 2 * t);               // smoothstep — the throat is not instantly cold
  let target = Tuning.CAVE_COLD_TARGET_MAX * ramp;             // TARGET_MAX is negative
  target *= Tuning.CAVE_COLD_KIND_MUL[kind] ?? 1;
  if (wet) target *= Tuning.CAVE_COLD_WET_MUL;
  // THE CLAMP. It binds the TARGET, not the rate — which is what makes the guarantee total.
  return Math.max(Tuning.CAVE_COLD_FLOOR, Math.min(0, target));
}

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

  // DEEPER cycle 11 — HOW DEEP UNDERGROUND, and in what. Pure + side-effect-free, so calling it from
  // here (which runs BEFORE updateCaveAtmosphere in the tick) introduces no ordering constraint and
  // no frame of latency. `caveAtmosphere` is null with FEATURES.caveTest off → caveDepth stays 0 →
  // the branch below is never taken and the surface model is exactly what shipped.
  let caveDepth = 0;
  let caveKind = 'canonical';
  if (ctx.caveAtmosphere) {
    const c = caveContainmentAt(ctx.caveAtmosphere, getPlayerPos(ctx), ctx);
    caveDepth = c.depth;
    caveKind = c.kind;
  }

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
  } else if (caveDepth > 0) {
    // ── DEEPER cycle 11 — CAVE COLD. THIS BRANCH PRE-EMPTS SUN / NIGHT / TWILIGHT ────────────────
    //   Underground, `exposure` still comes from the SURFACE clock, so before this branch existed a
    //   cave was WARM BY DAY (the shade-heat floor gained on you at sun01≈0) and LETHAL BY NIGHT
    //   (COLD_NIGHT_DRAIN walked you to -1 through fifty metres of rock). Exactly backwards. So the
    //   cave is not an extra drain on top — it REPLACES the ambient term with an equilibrium.
    //
    //   Shelter still wins (the branch above): light a fire or pitch a tent down here and the cold
    //   is fully neutralised. That is the verb the cold is asking for, and G1 is what makes it
    //   possible to place a fire underground at all.
    const wet = standingInWater(ctx);
    const target = caveColdTarget(caveDepth, caveKind, wet);
    const step = Tuning.CAVE_COLD_RATE_PER_SEC * dt;
    // Monotone approach, NEVER past the target — in BOTH directions. Warming is not a courtesy: a
    // player who descends already frozen from a night trek is pulled UP toward the floor, which is
    // what makes "a cave can never damage you" total instead of conditional (and is physically
    // true — a cave sits near the local mean annual temperature).
    if (t.temperature > target) {
      t.temperature = Math.max(target, t.temperature - step);
    } else if (t.temperature < target) {
      t.temperature = Math.min(target, t.temperature + step);
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
  // M3 (campaign 2026-07-09, Arc C1 water/exposure) — open-air SHADE slows water loss:
  // daytime + NOT in a shelter zone (shelters already neutralize temperature; this models
  // the drier maths of standing in a wreck's shadow). Lerp ×THIRST_SHADE_RELIEF (full
  // shade) → ×1 (full sun). Gating keeps the C38 probe bands byte-identical: the probe's
  // thirst/hunger/prepared envs run inShelter=true, heat runs sun01=1, cold runs at night.
  const shadeRelief = (exposure > 0.2 && !ctx.player.inShelter)
    ? Tuning.THIRST_SHADE_RELIEF + (1 - Tuning.THIRST_SHADE_RELIEF) * ctx.player.sunExposure01
    : 1;
  const thirstMul =
    (sprinting ? Tuning.THIRST_SPRINT_FACTOR : 1) *
    (1 + heatBoost * (Tuning.THIRST_HEAT_FACTOR - 1)) *
    stormFactor *
    shadeRelief;
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

/** DEEPER cycle 11 — is the player standing at open water RIGHT HERE (feet, not just XZ)?
 *
 *  A deliberate twin of controller.ts's private `nearWaterSource` (the footstep-squelch test), kept
 *  local rather than exported because the two ask different questions of the same registry and the
 *  audio one is on the hot movement path. Both share the same APPROXIMATION, named here so nobody
 *  rediscovers it: the check is a RADIUS around the source centre, not the pool polygon. Good enough
 *  for a flavour multiplier on the cold target — and the target is re-clamped afterwards regardless,
 *  so being generous with "wet" can never cost the player anything. */
function standingInWater(ctx: GameContext): boolean {
  const p = getPlayerPos(ctx);
  const r2 = Tuning.FOOTSTEP_WET_RADIUS * Tuning.FOOTSTEP_WET_RADIUS;
  const dyMax = Tuning.FOOTSTEP_WET_DY_M;
  for (const w of ctx.waterSources.list) {
    if (Math.abs(w.pos.y - p.y) > dyMax) continue;
    const dx = w.pos.x - p.x;
    const dz = w.pos.z - p.z;
    if (dx * dx + dz * dz <= r2) return true;
  }
  return false;
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
