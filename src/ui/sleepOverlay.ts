// Sleep overlay — opens when the player presses E on a tent.
// Choose 4h or 8h; advances dayTime + applies stat changes once at end.

import type { GameContext } from '../GameContext.ts';
import { playUiClick, playUiHover, playSleepThud } from '../audio/audio.ts';
import { resumeFromPause } from './menus.ts';
import { saveGameState } from '../persistence/save.ts';
import { Tuning } from '../config/tuning.ts';

let _root: HTMLDivElement | null = null;
let _ctx: GameContext | null = null;
let _open = false;
// M5 (C26) — the black sleep-fade layer + a re-entry guard while the fade plays.
let _fade: HTMLDivElement | null = null;
let _fading = false;

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

  // M5 (C26) — the full-screen black fade for the sleep transition. The CSS gives
  // it position/z/opacity; the transition DURATION comes from Tuning (single source).
  const fade = document.createElement('div');
  fade.id = 'sleep-fade';
  fade.style.transition = `opacity ${Tuning.SLEEP_FADE_MS}ms ease-in-out`;
  document.body.appendChild(fade);
  _fade = fade;
}

function sleep(hours: number): void {
  if (!_ctx || _fading) return;          // M5 (C26) — guard re-entry while a fade plays
  _fading = true;
  const ctx = _ctx;
  playSleepThud();

  // M5 (C26) — embodied rest: hide the menu, fade to black, advance time + recover
  // DURING the black, then fade back to the rested world (vs the old instant skip).
  // The world is frozen behind the overlay (paused), so the stat/time mutation is a
  // one-shot exactly as before — only its presentation changed.
  if (_root) _root.classList.add('hidden');
  if (_fade) {
    _fade.classList.add('black');
    // Capture clicks for the whole sequence so a blind-click on the black can't
    // hit the pause menu that unlock() reveals behind it (z=100, under the z=150 fade).
    _fade.style.pointerEvents = 'auto';
  }
  const FADE = Tuning.SLEEP_FADE_MS;

  window.setTimeout(() => {
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
    // Temperature drifts toward 0. AAL — only the strong (×0.3 at 8h) drift
    // applies if the player is sheltered; sleeping in the open desert gets
    // a much weaker recovery (×0.7 at 8h) because there's no warmth source.
    // ctx.player.inShelter still reflects the dialog-open location (the game is
    // paused through the fade, so updateShelter hasn't run).
    const tempRecoverFactor = ctx.player.inShelter ? 0.7 : 0.25;
    ctx.stats.temperature = ctx.stats.temperature * (1 - tempRecoverFactor * fraction);

    ctx.ui.showToast(`you sleep ${hours} hours — the world keeps turning`);
    // Sleep autosave — fired AFTER stat/time mutations complete so the save
    // reflects the rested player. (M.4: one of two save triggers; the other
    // is the pause menu's manual Save button.)
    saveGameState(ctx);

    // Hold the black a beat, then fade back to reveal the rested world + close.
    window.setTimeout(() => {
      if (_fade) _fade.classList.remove('black');
      window.setTimeout(() => {
        if (_fade) _fade.style.pointerEvents = 'none';
        _open = false;
        _fading = false;
        resumeFromPause();
      }, FADE);
    }, Tuning.SLEEP_FADE_HOLD_MS);
  }, FADE);
}

export function openSleepOverlay(ctx: GameContext): void {
  if (!_root || _open) return;
  _open = true;
  ctx.input.controls.unlock();
  _root.classList.remove('hidden');
}

export function closeSleepOverlay(): void {
  if (!_root || _fading) return;   // don't interrupt a fade in progress (symmetric with sleep()'s guard)
  _root.classList.add('hidden');
  _open = false;
  resumeFromPause();
}

export function isSleepOverlayOpen(): boolean {
  return _open;
}
