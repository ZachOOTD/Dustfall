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
  /** Always required. Fired when the player clicks NEW GAME. */
  onNewGame: () => void;
  /** Optional. When provided, a CONTINUE button is shown above NEW GAME. */
  onContinue?: () => void;
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
  subtitle.textContent = 'a desert is patient';
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

  const newGameBtn = document.createElement('button');
  newGameBtn.className = 'title-new-game';
  newGameBtn.textContent = 'NEW GAME';
  newGameBtn.addEventListener('mouseenter', playUiHover);
  newGameBtn.addEventListener('click', () => {
    playUiClick();
    options.onNewGame();
  });
  panel.appendChild(newGameBtn);

  void ctx;

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
