// HUD bars + clock + toast + death screen — owns its DOM refs.

import type { GameContext } from '../GameContext.ts';

interface HudRefs {
  thirst: HTMLDivElement;
  heat: HTMLDivElement;
  health: HTMLDivElement;
  clock: HTMLElement;
  deathScreen: HTMLElement;
  deathCause: HTMLElement;
  toast: HTMLDivElement;
  shelter: HTMLDivElement;
}

let refs: HudRefs | null = null;
let toastTimeout: number | undefined;

export interface HudApi {
  showToast: (text: string) => void;
  setDeathCause: (cause: string) => void;
}

export function createHud(): HudApi {
  const thirst = document.getElementById('thirst-bar') as HTMLDivElement;
  const heat = document.getElementById('heat-bar') as HTMLDivElement;
  const health = document.getElementById('health-bar') as HTMLDivElement;
  const clock = document.getElementById('clock');
  const deathScreen = document.getElementById('death-screen');
  const deathCause = document.getElementById('death-cause');
  if (!thirst || !heat || !health || !clock || !deathScreen || !deathCause) {
    throw new Error('HUD elements missing from index.html');
  }

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

  refs = { thirst, heat, health, clock, deathScreen, deathCause, toast, shelter };

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
    setDeathCause(cause: string): void {
      if (!refs) return;
      refs.deathCause.textContent = cause;
      refs.deathScreen.classList.remove('hidden');
    },
  };
}

let _lastShelterShown = false;

export function updateHud(ctx: GameContext, _dt: number): void {
  if (!refs) return;
  refs.thirst.style.width = `${ctx.stats.thirst * 100}%`;
  refs.heat.style.width = `${ctx.stats.heat * 100}%`;
  refs.health.style.width = `${ctx.stats.health * 100}%`;
  const totalMinutes = ctx.time.dayTime * 24 * 60;
  const h = Math.floor(totalMinutes / 60);
  const m = Math.floor(totalMinutes % 60);
  refs.clock.textContent =
    `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

  if (ctx.player.inShelter !== _lastShelterShown) {
    refs.shelter.classList.toggle('show', ctx.player.inShelter);
    _lastShelterShown = ctx.player.inShelter;
  }
}
