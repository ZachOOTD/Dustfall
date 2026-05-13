// HUD bars + clock + toast + death screen — owns its DOM refs.

import type { GameContext } from '../GameContext.ts';

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
}

let refs: HudRefs | null = null;
let toastTimeout: number | undefined;

export interface HudApi {
  showToast: (text: string) => void;
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
  toast.style.cssText = `
    position: fixed; bottom: 32px; left: 50%; transform: translateX(-50%);
    font-family: 'Cormorant Garamond', serif; font-style: italic;
    color: #e8dcc0; font-size: 18px; letter-spacing: 1px;
    opacity: 0; transition: opacity 0.6s; z-index: 20; pointer-events: none;
  `;
  document.body.appendChild(toast);

  const shelter = document.createElement('div');
  shelter.id = 'shelter-indicator';
  shelter.textContent = 'SHELTER';
  document.body.appendChild(shelter);

  refs = {
    thirst, hunger, tempCold, tempHeat, stamina, health,
    clock, dayCounter, deathScreen, deathCause, daysSummary,
    damageVignette, toast, shelter,
  };

  return {
    showToast(text: string): void {
      if (!refs) return;
      refs.toast.textContent = text;
      refs.toast.style.opacity = '1';
      if (toastTimeout !== undefined) clearTimeout(toastTimeout);
      toastTimeout = window.setTimeout(() => {
        if (refs) refs.toast.style.opacity = '0';
      }, 1600);
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

  if (ctx.player.inShelter !== _lastShelterShown) {
    refs.shelter.classList.toggle('show', ctx.player.inShelter);
    _lastShelterShown = ctx.player.inShelter;
  }

  // Damage vignette — opacity fades to 0 over ~0.33s after the flash trigger.
  const flashRemaining = Math.max(0, ctx.flags.damageFlashUntil - ctx.time.elapsed);
  refs.damageVignette.style.opacity = String(Math.min(1, flashRemaining * 3));
}
