// Session CC-3 — Animated main menu (DOM overlay).
// Renders the "DUSTFALL" wordmark + NEW GAME (always) + CONTINUE (when
// onContinue is supplied — i.e., a save exists). Sits at z-index 250 so it
// stacks above #start-overlay (z=100) and tutorial controls panel (z=200).

import type { GameContext } from '../GameContext.ts';
import { playUiHover, playUiClick } from '../audio/audio.ts';

export interface TitleOverlayApi {
  show(): void;
  hide(): void;
  isShown(): boolean;
}

export interface TitleOverlayOptions {
  /** Always required. Fired when the player clicks NEW GAME.
   *  AAI — optional `seedOverride` carries a uint32 the user entered
   *  via the Advanced panel. Undefined means "auto-roll a fresh seed". */
  onNewGame: (seedOverride?: number) => void;
  /** Optional. When provided, a CONTINUE button is shown above NEW GAME. */
  onContinue?: () => void;
  /** AAV — optional. When provided, a DEV MODE button is shown below
   *  NEW GAME. Spawns a new game with the debug starter loadout
   *  (scrap_bar + materials + weapons + kits) — for testing systems
   *  without grinding the early progression. Regular NEW GAME starts
   *  empty. */
  onDevMode?: (seedOverride?: number) => void;
}

export function createTitleOverlay(
  ctx: GameContext,
  options: TitleOverlayOptions,
): TitleOverlayApi {
  const panel = document.createElement('div');
  panel.id = 'title-overlay';
  panel.className = 'overlay';

  const wordmark = document.createElement('div');
  wordmark.className = 'title-wordmark';
  wordmark.textContent = 'DUSTFALL';
  panel.appendChild(wordmark);

  const subtitle = document.createElement('div');
  subtitle.className = 'title-subtitle';
  subtitle.textContent = 'the desert is patient';
  panel.appendChild(subtitle);

  // CONTINUE button — only when a save exists (caller decides by passing
  // onContinue). Positioned ABOVE NEW GAME because resuming an in-progress
  // run is usually the player's intent if they have a save.
  if (options.onContinue) {
    const contBtn = document.createElement('button');
    contBtn.className = 'title-new-game';   // reuse styling
    contBtn.textContent = 'CONTINUE';
    contBtn.addEventListener('mouseenter', playUiHover);
    contBtn.addEventListener('click', () => {
      playUiClick();
      options.onContinue!();
    });
    panel.appendChild(contBtn);
  }

  // AAI — read the parsed seed from the Advanced input (if shown +
  // populated). Returns undefined if empty/invalid → caller auto-rolls.
  let seedInput: HTMLInputElement | null = null;
  const readAdvancedSeed = (): number | undefined => {
    if (!seedInput) return undefined;
    const raw = seedInput.value.trim();
    if (raw === '') return undefined;
    const n = parseInt(raw, 10);
    if (Number.isNaN(n) || !Number.isFinite(n) || n < 0) return undefined;
    return n >>> 0;
  };

  const newGameBtn = document.createElement('button');
  newGameBtn.className = 'title-new-game';
  newGameBtn.textContent = 'NEW GAME';
  newGameBtn.addEventListener('mouseenter', playUiHover);
  newGameBtn.addEventListener('click', () => {
    playUiClick();
    options.onNewGame(readAdvancedSeed());
  });
  panel.appendChild(newGameBtn);

  // AAV — DEV MODE button. Same flow as NEW GAME but the boot path
  // applies the debug starter loadout (scrap_bar + materials +
  // weapons + kits + ammo). For testing systems without grinding the
  // early game. Visually styled lighter so it reads as a debug
  // affordance, not a primary action.
  if (options.onDevMode) {
    const devBtn = document.createElement('button');
    devBtn.className = 'title-new-game title-dev-mode';
    devBtn.textContent = 'DEV MODE';
    devBtn.addEventListener('mouseenter', playUiHover);
    devBtn.addEventListener('click', () => {
      playUiClick();
      options.onDevMode!(readAdvancedSeed());
    });
    panel.appendChild(devBtn);
  }

  // AAI — Advanced disclosure with seed entry. Default-collapsed; click
  // the disclosure to reveal a text input for a uint32 seed. Leaving the
  // input blank + clicking NEW GAME auto-rolls.
  const advWrap = document.createElement('div');
  advWrap.className = 'title-advanced';
  const advToggle = document.createElement('button');
  advToggle.type = 'button';
  advToggle.className = 'title-advanced-toggle';
  advToggle.textContent = 'advanced ▾';
  advWrap.appendChild(advToggle);

  const advPanel = document.createElement('div');
  advPanel.className = 'title-advanced-panel hidden';

  const seedLabel = document.createElement('label');
  seedLabel.className = 'title-advanced-label';
  seedLabel.textContent = 'seed (blank = random)';
  advPanel.appendChild(seedLabel);

  seedInput = document.createElement('input');
  seedInput.type = 'text';
  seedInput.inputMode = 'numeric';
  seedInput.maxLength = 10;
  seedInput.className = 'title-advanced-seed';
  seedInput.placeholder = String(ctx.seed);  // hint: current world's seed
  advPanel.appendChild(seedInput);

  advWrap.appendChild(advPanel);
  panel.appendChild(advWrap);

  advToggle.addEventListener('click', () => {
    const hidden = advPanel.classList.toggle('hidden');
    advToggle.textContent = hidden ? 'advanced ▾' : 'advanced ▴';
  });

  document.body.appendChild(panel);

  let shown = true;
  return {
    show(): void {
      panel.classList.remove('hidden');
      shown = true;
    },
    hide(): void {
      panel.classList.add('hidden');
      shown = false;
    },
    isShown(): boolean {
      return shown;
    },
  };
}
