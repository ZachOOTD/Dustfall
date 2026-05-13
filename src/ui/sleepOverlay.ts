// Sleep overlay — opens when the player presses E on a tent.
// Choose 4h or 8h; advances dayTime + applies stat changes once at end.

import type { GameContext } from '../GameContext.ts';
import { playUiClick, playUiHover, playSleepThud } from '../audio/audio.ts';
import { resumeFromPause } from './menus.ts';

let _root: HTMLDivElement | null = null;
let _ctx: GameContext | null = null;
let _open = false;

function makeBtn(label: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.className = 'menu-btn';
  b.textContent = label;
  b.addEventListener('mouseenter', playUiHover);
  b.addEventListener('click', () => { playUiClick(); onClick(); });
  return b;
}

export function createSleepOverlay(ctx: GameContext): void {
  _ctx = ctx;
  const root = document.createElement('div');
  root.id = 'sleep-overlay';
  root.className = 'overlay hidden';

  const title = document.createElement('div');
  title.className = 'title small';
  title.textContent = 'REST';
  root.appendChild(title);

  const sub = document.createElement('div');
  sub.className = 'subtitle';
  sub.textContent = 'how long?';
  root.appendChild(sub);

  const btns = document.createElement('div');
  btns.className = 'menu-buttons';
  btns.appendChild(makeBtn('4 hours', () => sleep(4)));
  btns.appendChild(makeBtn('8 hours', () => sleep(8)));
  btns.appendChild(makeBtn('cancel', closeSleepOverlay));
  root.appendChild(btns);

  document.body.appendChild(root);
  _root = root;
}

function sleep(hours: number): void {
  if (!_ctx) return;
  const ctx = _ctx;
  playSleepThud();

  // Advance day time
  const deltaDay = hours / 24;
  const prev = ctx.time.dayTime;
  ctx.time.dayTime = (ctx.time.dayTime + deltaDay) % 1;
  if (prev > ctx.time.dayTime) {
    // wrapped past midnight
    ctx.time.daysSurvived++;
  }

  // Stat changes — applied once (skipping per-tick simulation through the slept hours)
  const fraction = hours / 8;          // 8h = full effect; 4h = half
  const thirstScale = 1 - 0.7 * fraction; // 8h → ×0.3, 4h → ×0.65
  const hungerScale = 1 - 0.5 * fraction; // 8h → ×0.5, 4h → ×0.75
  ctx.stats.thirst = Math.max(0, ctx.stats.thirst * thirstScale);
  ctx.stats.hunger = Math.max(0, ctx.stats.hunger * hungerScale);
  ctx.stats.stamina = 1;
  // Temperature drifts toward 0
  ctx.stats.temperature = ctx.stats.temperature * (1 - 0.7 * fraction);

  ctx.ui.showToast(`you sleep ${hours} hours — the world keeps turning`);
  closeSleepOverlay();
}

export function openSleepOverlay(ctx: GameContext): void {
  if (!_root || _open) return;
  _open = true;
  ctx.input.controls.unlock();
  _root.classList.remove('hidden');
}

export function closeSleepOverlay(): void {
  if (!_root) return;
  _root.classList.add('hidden');
  _open = false;
  resumeFromPause();
}

export function isSleepOverlayOpen(): boolean {
  return _open;
}
