// Journal panel (Session W) — modal lore overlay shown when the player
// presses E on the journal interactable inside the opening wreck.
//
// Follows the controls-panel pattern from tutorial.ts: a fullscreen
// overlay div with title + entries + close button. Built once at boot
// (createJournalPanel), shown/hidden via openJournalPanel /
// closeJournalPanel.
//
// While open, the game pauses (controls.unlock → pause overlay shows
// underneath); the panel sits above via the existing overlay z-index.
// Esc and the close button both close.

import type { GameContext } from '../GameContext.ts';
import { playUiHover, playUiClick } from '../audio/audio.ts';

// Placeholder lore — easy to rewrite. Lines are paired [date, entry].
const ENTRIES: ReadonlyArray<readonly [string, string]> = [
  ['DAY 1',  'wreck spotted across the dunes. dust in the eyes. I crawled inside.'],
  ['DAY 4',  'the salt-flats have wells. taste like rust. it is water.'],
  ['DAY 11', 'saw a man with a blade walking south. did not follow.'],
  ['DAY 16', 'ate a fruit from the blue cactus. should not have. fever for two days.'],
  ['DAY 17', 'the storm has not stopped. I am —'],
];

let _ctx: GameContext | null = null;
let _panel: HTMLDivElement | null = null;
let _open = false;

function buildPanel(): HTMLDivElement {
  const panel = document.createElement('div');
  panel.id = 'journal-panel';
  panel.className = 'overlay hidden';

  const title = document.createElement('div');
  title.className = 'title small';
  title.textContent = 'JOURNAL';
  panel.appendChild(title);

  const subtitle = document.createElement('div');
  subtitle.className = 'subtitle';
  subtitle.textContent = 'pages from the previous survivor';
  panel.appendChild(subtitle);

  const entries = document.createElement('div');
  entries.className = 'journal-entries';
  for (const [date, body] of ENTRIES) {
    const row = document.createElement('div');
    row.className = 'journal-entry';
    const d = document.createElement('div');
    d.className = 'journal-date';
    d.textContent = date;
    const b = document.createElement('div');
    b.className = 'journal-body';
    b.textContent = body;
    row.appendChild(d);
    row.appendChild(b);
    entries.appendChild(row);
  }
  panel.appendChild(entries);

  const closeBtn = document.createElement('button');
  closeBtn.className = 'menu-btn';
  closeBtn.textContent = 'close';
  closeBtn.addEventListener('mouseenter', playUiHover);
  closeBtn.addEventListener('click', () => {
    playUiClick();
    closeJournalPanel();
  });
  panel.appendChild(closeBtn);

  return panel;
}

export function createJournalPanel(ctx: GameContext): void {
  _ctx = ctx;
  _panel = buildPanel();
  document.body.appendChild(_panel);

  // Esc closes the journal panel from anywhere. Lives on window so it
  // fires whether the pointer is locked or not.
  window.addEventListener('keydown', (e) => {
    if (!_open) return;
    if (e.code !== 'Escape') return;
    e.preventDefault();
    closeJournalPanel();
  });
}

export function openJournalPanel(ctx: GameContext): void {
  if (!_panel || _open) return;
  _open = true;
  ctx.input.controls.unlock();
  _panel.classList.remove('hidden');
}

export function closeJournalPanel(): void {
  if (!_panel || !_open) return;
  _panel.classList.add('hidden');
  _open = false;
  if (_ctx && _ctx.flags.started && !_ctx.stats.dead) {
    void import('./menus.ts').then((m) => m.resumeFromPause());
  }
}

export function isJournalPanelOpen(): boolean {
  return _open;
}
