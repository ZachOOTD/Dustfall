// Session WW + M6 ④ (C40) — low-stat screen-edge vignettes, the VISUAL half of the
// diegetic-survival tells. Always-on warnings: cold (blue) when temperature is low,
// thirst (sepia) when thirst is low — these show in BOTH modes (the established WW
// behavior). Diegetic-only (gated on `isDiegeticActive()`, i.e. the HUD bars are
// hidden): heat (amber) when overheating, hunger (a desaturating dark edge) when
// starving, and a red HEALTH pulse + a procedural HEARTBEAT when badly wounded, plus a
// stomach GROWL while starving — the "feel it without bars" layer. Intensity ramps
// linearly as each stat worsens past its threshold.
//
// Architecture note (D78): stat vignettes are HUD-tier CSS radial-gradient divs (cheap,
// no draw-call cost), distinct from the in-scene stormVignette ShaderMaterial.

import type { GameContext } from '../GameContext.ts';
import { Tuning } from '../config/tuning.ts';
import { isDiegeticActive } from './diegeticMode.ts';
import { playHeartbeat, playStomachGrowl } from '../audio/audio.ts';

let _coldEl: HTMLDivElement | null = null;
let _thirstEl: HTMLDivElement | null = null;
let _heatEl: HTMLDivElement | null = null;
let _hungerEl: HTMLDivElement | null = null;
let _healthEl: HTMLDivElement | null = null;

// Audio cadence state (diegetic-only).
let _lastHeartAt = 0;
let _nextGrowlAt = 0;

function makeVignette(id: string): HTMLDivElement {
  const el = document.createElement('div');
  el.id = id;
  el.style.opacity = '0';
  document.body.appendChild(el);
  return el;
}

export function createStatVignette(): void {
  _coldEl = makeVignette('stat-vignette-cold');
  _thirstEl = makeVignette('stat-vignette-thirst');
  _heatEl = makeVignette('stat-vignette-heat');
  _hungerEl = makeVignette('stat-vignette-hunger');
  _healthEl = makeVignette('stat-vignette-health');
}

/** Linear ramp: 0 at the threshold → max as the stat reaches its worst (0 or 1). */
function ramp(depth01: number, max: number): number {
  return Math.min(1, Math.max(0, depth01)) * max;
}

export function updateStatVignette(ctx: GameContext): void {
  if (!_coldEl || !_thirstEl || !_heatEl || !_hungerEl || !_healthEl) return;
  const t = ctx.stats.temperature;
  const thirst = ctx.stats.thirst;
  const hunger = ctx.stats.hunger;
  const health = ctx.stats.health;
  const elapsed = ctx.time.elapsed;
  const diegetic = isDiegeticActive();
  // In diegetic mode the tints are the PRIMARY readout (no bars), so boost them to read
  // over the bright noon desert; bar-mode keeps the subtle WW warning level.
  const maxOp = Tuning.STAT_VIGNETTE_MAX_OPACITY * (diegetic ? Tuning.DIEGETIC_VIGNETTE_BOOST : 1);

  // ── Always-on warnings (both modes): cold + thirst (the WW behavior, boosted in diegetic). ──
  const coldOpacity = t < -Tuning.COLD_VIGNETTE_THRESHOLD
    ? ramp((-t - Tuning.COLD_VIGNETTE_THRESHOLD) / (1 - Tuning.COLD_VIGNETTE_THRESHOLD), maxOp)
    : 0;
  const thirstOpacity = thirst < Tuning.THIRST_VIGNETTE_THRESHOLD
    ? ramp((Tuning.THIRST_VIGNETTE_THRESHOLD - thirst) / Tuning.THIRST_VIGNETTE_THRESHOLD, maxOp)
    : 0;

  // ── Diegetic-only tells (HUD bars hidden): heat / hunger / low-health + audio. ──
  let heatOpacity = 0, hungerOpacity = 0, healthOpacity = 0;
  if (diegetic) {
    heatOpacity = t > Tuning.HEAT_VIGNETTE_THRESHOLD
      ? ramp((t - Tuning.HEAT_VIGNETTE_THRESHOLD) / (1 - Tuning.HEAT_VIGNETTE_THRESHOLD), maxOp)
      : 0;
    hungerOpacity = hunger < Tuning.HUNGER_VIGNETTE_THRESHOLD
      ? ramp((Tuning.HUNGER_VIGNETTE_THRESHOLD - hunger) / Tuning.HUNGER_VIGNETTE_THRESHOLD, maxOp)
      : 0;

    // Low-health: a red pulse, stronger than the warnings (it's mortal). The pulse depth
    // grows with severity; a procedural heartbeat carries the tempo + quickens near death.
    if (health < Tuning.HEALTH_VIGNETTE_THRESHOLD) {
      const depth = Math.min(1, (Tuning.HEALTH_VIGNETTE_THRESHOLD - health) / Tuning.HEALTH_VIGNETTE_THRESHOLD);
      const pulse = 0.5 + 0.5 * Math.sin(elapsed * Tuning.HEALTH_PULSE_HZ * Math.PI * 2);
      healthOpacity = depth * Tuning.HEALTH_VIGNETTE_MAX_OPACITY * (0.55 + 0.45 * pulse);
      const interval = Tuning.HEARTBEAT_INTERVAL_FAR_S
        + (Tuning.HEARTBEAT_INTERVAL_NEAR_S - Tuning.HEARTBEAT_INTERVAL_FAR_S) * depth;
      if (elapsed - _lastHeartAt >= interval) { _lastHeartAt = elapsed; playHeartbeat(depth); }
    } else {
      _lastHeartAt = elapsed;   // so the first beat fires promptly when health next dips
    }

    // Stomach growl — periodic (jittered) while starving.
    if (hunger < Tuning.HUNGER_VIGNETTE_THRESHOLD) {
      if (elapsed >= _nextGrowlAt) {
        _nextGrowlAt = elapsed + Tuning.GROWL_INTERVAL_S * (0.7 + Math.random() * 0.6);
        playStomachGrowl();
      }
    } else {
      _nextGrowlAt = elapsed + Tuning.GROWL_INTERVAL_S;   // delay the first growl after eating
    }
  }

  // Suppress the warning tints during peak storm so the stormVignette dominates (no
  // triple-tinting). The mortal red health pulse still shows — near-death overrides weather.
  if (ctx.weather.intensity > 0.7) {
    _coldEl.style.opacity = '0';
    _thirstEl.style.opacity = '0';
    _heatEl.style.opacity = '0';
    _hungerEl.style.opacity = '0';
    _healthEl.style.opacity = healthOpacity.toFixed(3);
    return;
  }

  _coldEl.style.opacity = coldOpacity.toFixed(3);
  _thirstEl.style.opacity = thirstOpacity.toFixed(3);
  _heatEl.style.opacity = heatOpacity.toFixed(3);
  _hungerEl.style.opacity = hungerOpacity.toFixed(3);
  _healthEl.style.opacity = healthOpacity.toFixed(3);
}
