// First-boot controls overlay + contextual pickup hints. Session L.
//
// One module owns:
//   1. Persistent flags in localStorage (`dustfall.tutorial.v1`):
//        seenIntro  — has the first-boot controls panel been dismissed?
//        usedItems  — set of item IDs whose first-pickup hint has fired
//   2. The #controls-panel DOM (built once at boot, toggled on/off).
//   3. The pickup-hint table.
//
// Surfaces called from elsewhere:
//   createTutorial(ctx)       — boot
//   showControlsPanel(ctx)    — H key in input.ts (pauses)
//   hideControlsPanel(ctx)    — close button (resumes)
//   isControlsPanelOpen()     — interaction.ts overlay-guard
//   maybeShowItemHint(itemId) — inventory.addItem (one-time per id)
//   resetTutorial()           — debug only
//   noteIntroSeen()           — called from input.ts on first lock

import type { GameContext } from '../GameContext.ts';
import type { ItemId } from '../inventory/types.ts';
import { playUiHover, playUiClick } from '../audio/audio.ts';

const STORAGE_KEY = 'dustfall.tutorial.v1';

interface TutorialState {
  seenIntro: boolean;
  usedItems: string[];
}

const HINTS: Partial<Record<ItemId, string>> = {
  canteen: 'press Q to drink — refill at water sources',
  branch: 'branches fuel fires — craft 3 + scrap into a fire kit with C',
  cloth: 'press C to open the crafting menu',
  scrap: 'scrap is a crafting material — press C',
  bandage: 'press Q to bandage a wound',
  machete: 'left-click swings the machete',
  fire_kit: 'select it and press Q to light a fire here',
  tent_kit: 'select it and press Q to pitch a tent — E on it to sleep',
  cactus_pulp: 'raw food — cook at a fire for more hunger',
  raw_lizard_meat: 'raw meat — cook at a fire to make it safe to eat',
};

// Each row is [key label, description].
const CONTROLS: ReadonlyArray<readonly [string, string]> = [
  ['WASD', 'move'],
  ['SHIFT', 'sprint'],
  ['SPACE', 'jump'],
  ['MOUSE', 'look'],
  ['LMB', 'attack'],
  ['Q', 'use selected item'],
  ['E', 'interact / pick up / refill / search / harvest / cook / sleep'],
  ['G', 'drop selected item'],
  ['1 – 4 / WHEEL', 'select hotbar slot'],
  ['C', 'open crafting menu'],
  ['I', 'open backpack'],
  ['ESC', 'pause'],
  ['H', 'show controls'],
  ['F1', 'performance HUD (dev)'],
];

let _state: TutorialState = loadState();
let _ctx: GameContext | null = null;
let _panel: HTMLDivElement | null = null;
let _open = false;

function loadState(): TutorialState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { seenIntro: false, usedItems: [] };
    const parsed = JSON.parse(raw) as Partial<TutorialState>;
    return {
      seenIntro: !!parsed.seenIntro,
      usedItems: Array.isArray(parsed.usedItems) ? parsed.usedItems.slice() : [],
    };
  } catch {
    return { seenIntro: false, usedItems: [] };
  }
}

function saveState(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(_state));
  } catch {
    // localStorage may be disabled (private mode); silently skip.
  }
}

function buildPanel(): HTMLDivElement {
  const panel = document.createElement('div');
  panel.id = 'controls-panel';
  panel.className = 'overlay hidden';

  const title = document.createElement('div');
  title.className = 'title small';
  title.textContent = 'CONTROLS';
  panel.appendChild(title);

  const subtitle = document.createElement('div');
  subtitle.className = 'subtitle';
  subtitle.textContent = 'press H any time to see this again';
  panel.appendChild(subtitle);

  const rows = document.createElement('div');
  rows.className = 'controls-rows';
  for (const [key, desc] of CONTROLS) {
    const row = document.createElement('div');
    row.className = 'controls-row';
    const k = document.createElement('span');
    k.className = 'kbd';
    k.textContent = key;
    const d = document.createElement('span');
    d.className = 'controls-desc';
    d.textContent = desc;
    row.appendChild(k);
    row.appendChild(d);
    rows.appendChild(row);
  }
  panel.appendChild(rows);

  const closeBtn = document.createElement('button');
  closeBtn.className = 'menu-btn';
  closeBtn.textContent = 'close';
  closeBtn.addEventListener('mouseenter', playUiHover);
  closeBtn.addEventListener('click', () => {
    playUiClick();
    if (_ctx) hideControlsPanel(_ctx);
  });
  panel.appendChild(closeBtn);

  return panel;
}

export function createTutorial(ctx: GameContext): void {
  _ctx = ctx;
  _panel = buildPanel();
  document.body.appendChild(_panel);

  // First boot — show the panel above the start overlay so the keybinds are
  // visible before the player clicks to begin. The lock handler in input.ts
  // calls `noteIntroSeen()` which hides the panel + persists the flag.
  if (!_state.seenIntro) {
    _panel.classList.remove('hidden');
    _open = true;
  }
}

export function showControlsPanel(ctx: GameContext): void {
  if (!_panel) return;
  _panel.classList.remove('hidden');
  _open = true;
  // Mid-game (started + alive): unlocking the pointer triggers the pause
  // overlay; our panel sits above it (z-index 200). Don't do this during the
  // first-boot flow — the game isn't started yet, so we just stack on the
  // start overlay.
  if (ctx.flags.started && !ctx.stats.dead) {
    ctx.input.controls.unlock();
  }
}

export function hideControlsPanel(ctx: GameContext): void {
  if (!_panel) return;
  _panel.classList.add('hidden');
  _open = false;
  // Mid-game: resume + re-lock pointer. Lazy-import to avoid menus.ts ↔
  // tutorial.ts circular dep (menus.ts already imports nothing from here, but
  // future maintenance may add it).
  if (ctx.flags.started && !ctx.stats.dead) {
    void import('./menus.ts').then((m) => m.resumeFromPause());
  }
}

export function isControlsPanelOpen(): boolean {
  return _open;
}

/** Called by input.ts when the pointer first locks (game start). Hides the
 *  panel (if first-boot) and persists the seenIntro flag. */
export function noteIntroSeen(): void {
  if (_state.seenIntro) return;
  _state.seenIntro = true;
  saveState();
  if (_panel && _open) {
    _panel.classList.add('hidden');
    _open = false;
  }
}

/** Called from inventory.addItem after a successful pickup. Fires the
 *  one-time hint toast (after a short delay so it follows the "taken — …"
 *  toast, not overlaps it) and persists the seen state. */
export function maybeShowItemHint(ctx: GameContext, id: ItemId): void {
  if (_state.usedItems.includes(id)) return;
  const hint = HINTS[id];
  _state.usedItems.push(id);
  saveState();
  if (!hint) return;
  // Stagger so it doesn't overwrite the "taken — …" toast that was just shown.
  setTimeout(() => ctx.ui.showToast(hint), 900);
}

/** Debug helper: wipes the seen-intro + seen-items flags so all hints fire
 *  again. Exposed via `__game.resetTutorial()`. */
export function resetTutorial(): void {
  _state = { seenIntro: false, usedItems: [] };
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}
