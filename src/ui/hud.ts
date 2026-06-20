// HUD bars + clock + toast + death screen — owns its DOM refs.

import type { GameContext } from '../GameContext.ts';
import { Tuning } from '../config/tuning.ts';

interface HudRefs {
  thirst: HTMLDivElement;
  hunger: HTMLDivElement;
  tempCold: HTMLDivElement;
  tempHeat: HTMLDivElement;
  stamina: HTMLDivElement;
  health: HTMLDivElement;
  clock: HTMLElement;
  dayCounter: HTMLElement;
  deathScreen: HTMLElement;
  deathCause: HTMLElement;
  daysSummary: HTMLElement;
  damageVignette: HTMLDivElement;
  toast: HTMLDivElement;
  shelter: HTMLDivElement;
  /** AAF — long-storm countdown shown under the day counter.
   *  Pre-day-7 reads "the long storm in N days"; on/after day 7
   *  reads "THE LONG STORM" (warning state). */
  longStorm: HTMLDivElement;
}

let refs: HudRefs | null = null;
let toastTimeout: number | undefined;
// M6 ④ (C40) — the #stats container (all the stat bars). Hidden when diegetic-survival
// mode is active; toggled by menus.applySettings via setStatsBarsVisible().
let _statsEl: HTMLElement | null = null;

/** M6 ④ (C40) — show/hide the HUD stat-bar column. Called by menus.applySettings on boot
 *  + on every settings change so the diegetic-survival opt-in takes effect immediately. */
export function setStatsBarsVisible(visible: boolean): void {
  if (!_statsEl) _statsEl = document.getElementById('stats');
  if (_statsEl) _statsEl.style.display = visible ? '' : 'none';
}

export interface HudApi {
  /** Standard toast: muted text, 1.6s. Optional `opts.kind='discovery'`
   *  surfaces a larger, glowing variant held longer (AAN). */
  showToast: (text: string, opts?: { kind?: 'discovery' }) => void;
  setDeathCause: (cause: string, daysSurvived?: number) => void;
}

function need<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id) as T | null;
  if (!el) throw new Error(`HUD element missing from index.html: #${id}`);
  return el;
}

export function createHud(): HudApi {
  const thirst = need<HTMLDivElement>('thirst-bar');
  const hunger = need<HTMLDivElement>('hunger-bar');
  const tempCold = need<HTMLDivElement>('temp-cold-bar');
  const tempHeat = need<HTMLDivElement>('temp-heat-bar');
  const stamina = need<HTMLDivElement>('stamina-bar');
  const health = need<HTMLDivElement>('health-bar');
  const clock = need<HTMLElement>('clock');
  const dayCounter = need<HTMLElement>('day-counter');
  const deathScreen = need<HTMLElement>('death-screen');
  const deathCause = need<HTMLElement>('death-cause');
  const daysSummary = need<HTMLElement>('days-survived-summary');
  const damageVignette = need<HTMLDivElement>('damage-vignette');

  const toast = document.createElement('div');
  toast.id = 'toast';
  // JJ — bottom bumped 32 → 100 so the toast clears the hotbar (which
  // sits at bottom 28 with 52px-tall slots → top edge at ~80px). Old
  // value rendered toast text inside the hotbar's vertical band.
  toast.style.cssText = `
    position: fixed; bottom: 100px; left: 50%; transform: translateX(-50%);
    font-family: 'Cormorant Garamond', serif; font-style: italic;
    color: #e8dcc0; font-size: 18px; letter-spacing: 1px;
    opacity: 0; transition: opacity 0.6s; z-index: 20; pointer-events: none;
  `;
  document.body.appendChild(toast);

  const shelter = document.createElement('div');
  shelter.id = 'shelter-indicator';
  shelter.textContent = 'SHELTER';
  document.body.appendChild(shelter);

  // AAF — long-storm countdown indicator. Sits below #day-counter
  // (top-right of the screen). Color shifts warmer as days dwindle;
  // post-day-7 reads as a warning banner.
  const longStorm = document.createElement('div');
  longStorm.id = 'long-storm-indicator';
  document.body.appendChild(longStorm);

  refs = {
    thirst, hunger, tempCold, tempHeat, stamina, health,
    clock, dayCounter, deathScreen, deathCause, daysSummary,
    damageVignette, toast, shelter, longStorm,
  };

  return {
    showToast(text: string, opts?: { kind?: 'discovery' }): void {
      if (!refs) return;
      refs.toast.textContent = text;
      refs.toast.style.opacity = '1';
      // AAN — `discovery` variant uses a CSS class so styling is owned
      // declaratively (size + warm glow + slow fade) rather than via
      // per-call inline style. Held longer (3.2s vs 1.6s) so the
      // moment lands.
      const isDiscovery = opts?.kind === 'discovery';
      refs.toast.classList.toggle('discovery', isDiscovery);
      const heldMs = isDiscovery ? 3200 : 1600;
      if (toastTimeout !== undefined) clearTimeout(toastTimeout);
      toastTimeout = window.setTimeout(() => {
        if (refs) refs.toast.style.opacity = '0';
      }, heldMs);
    },
    setDeathCause(cause: string, daysSurvived?: number): void {
      if (!refs) return;
      refs.deathCause.textContent = cause;
      if (daysSurvived !== undefined) {
        refs.daysSummary.textContent =
          daysSurvived === 1
            ? 'you survived 1 day'
            : `you survived ${daysSurvived} days`;
      } else {
        refs.daysSummary.textContent = '';
      }
      refs.deathScreen.classList.remove('hidden');
    },
  };
}

let _lastShelterShown = false;

export function updateHud(ctx: GameContext, _dt: number): void {
  if (!refs) return;
  refs.thirst.style.width = `${ctx.stats.thirst * 100}%`;
  refs.hunger.style.width = `${ctx.stats.hunger * 100}%`;
  refs.stamina.style.width = `${ctx.stats.stamina * 100}%`;
  refs.health.style.width = `${ctx.stats.health * 100}%`;
  // Temperature: bipolar bar. Each half is 50% of track width; we fill from center.
  const t = ctx.stats.temperature;
  refs.tempHeat.style.width = `${Math.max(0, t) * 50}%`;
  refs.tempCold.style.width = `${Math.max(0, -t) * 50}%`;
  const totalMinutes = ctx.time.dayTime * 24 * 60;
  const h = Math.floor(totalMinutes / 60);
  const m = Math.floor(totalMinutes % 60);
  refs.clock.textContent =
    `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  refs.dayCounter.textContent = `day ${ctx.time.daysSurvived + 1}`;

  // AAF — long-storm countdown. Pre-doom: "the long storm in N days"
  // (text reddens as N decreases). On/after doom day: "THE LONG STORM"
  // as a warning banner.
  const daysUntil = Tuning.LONG_STORM_DAY - ctx.time.daysSurvived;
  if (daysUntil > 0) {
    refs.longStorm.textContent =
      daysUntil === 1 ? 'the long storm in 1 day' : `the long storm in ${daysUntil} days`;
    // Color ramps from muted brown (far away) toward warning orange-red
    // (imminent) as days dwindle.
    const t = Math.min(1, Math.max(0, 1 - (daysUntil - 1) / (Tuning.LONG_STORM_DAY - 1)));
    const r = Math.round(138 + (200 - 138) * t);
    const g = Math.round(120 + (90 - 120) * t);
    const b = Math.round(94 + (50 - 94) * t);
    refs.longStorm.style.color = `rgb(${r}, ${g}, ${b})`;
    refs.longStorm.classList.remove('imminent');
  } else {
    refs.longStorm.textContent = 'THE LONG STORM';
    refs.longStorm.style.color = 'rgb(200, 70, 50)';
    refs.longStorm.classList.add('imminent');
  }

  if (ctx.player.inShelter !== _lastShelterShown) {
    refs.shelter.classList.toggle('show', ctx.player.inShelter);
    _lastShelterShown = ctx.player.inShelter;
  }

  // Damage vignette — opacity fades to 0 over ~0.33s after the flash trigger.
  const flashRemaining = Math.max(0, ctx.flags.damageFlashUntil - ctx.time.elapsed);
  refs.damageVignette.style.opacity = String(Math.min(1, flashRemaining * 3));
}
