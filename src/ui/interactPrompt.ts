// Crosshair-anchored "[E] <verb> <noun>" prompt that fades in when looking
// at any interactable entity. The verb is determined by hover.type, the
// noun by hover.promptNoun (set by the interaction system).

import type { GameContext } from '../GameContext.ts';
import type { InteractType } from '../inventory/types.ts';

const VERBS: Record<InteractType, string> = {
  // AAA — restored to 'take' (UU's LMB-take reverted). E is the
  // canonical take/pickup button; [E] chip shows again.
  take: 'take',
  refill: 'refill',
  search: 'open',       // UU.5 — tightened from "search" (loot containers OPEN, not search)
  harvest: 'harvest',
  kill: '',     // living lizard — no prompt action (LMB does it); we show just the noun
  cook: 'cook at',
  add_fuel: 'add fuel to',
  sleep: 'sleep in',
  relight: 'relight',
  salvage: 'salvage',
  read: 'read',
  mount: 'mount',
  open_sled: 'open',    // QQ — E opens the sled cargo (sled inventory menu)
  attach_rope: '',      // QQ — LMB-driven; verb is empty so the [E] chip is hidden. promptNoun carries the click-to-attach copy.
  open_locker: 'open',  // AAC — E opens the locker (chest inventory menu)
  pet_companion: '',    // AAE — passive hover; RMB packs up (no E action)
};

let _root: HTMLDivElement | null = null;
let _label: HTMLSpanElement | null = null;
let _keyEl: HTMLSpanElement | null = null;
let _progressBar: HTMLDivElement | null = null;
// AAO — per-cook progress mini-bars shown above the prompt when hovering
// a fire with active cooks. Up to 4 (matches FIRE_GRILL_MAX_PARALLEL_COOKS).
// Pre-built once at boot; only width updates per frame to avoid DOM churn.
let _cookBarsRoot: HTMLDivElement | null = null;
let _cookBarFills: HTMLDivElement[] = [];
let _lastShown = false;
let _lastLabel = '';
// VV — crosshair feedback. Cached DOM ref + last-applied class state so we
// only toggle when state changes (avoids per-frame classList churn).
// AAA — added 'dead' state for corpse loot (vs. 'interactable' for ground
// pickups and 'kill' for living enemies).
// AAN — added 'no_ammo' state. Fires when player has the scrap_gun equipped
// and slot.meta.ammoRemaining === 0 AND there's no hover overriding. Tells
// the player "you'll click and nothing happens" before they mash LMB.
let _crosshairEl: HTMLDivElement | null = null;
let _lastCrosshairState: '' | 'interactable' | 'kill' | 'dead' | 'no_ammo' = '';

// ItemIds that come from a corpse (dead lizard, sandworm corpse). Hovering
// these with hover.type='take' triggers the .dead crosshair state rather
// than the generic .interactable. Ground pickups (branches, dropped items)
// stay on .interactable.
const CORPSE_ITEM_IDS = new Set(['raw_lizard_meat', 'raw_worm_meat']);

export function createInteractPrompt(): void {
  const root = document.createElement('div');
  root.id = 'interact-prompt';

  const key = document.createElement('span');
  key.className = 'key';
  key.textContent = 'E';
  root.appendChild(key);

  const label = document.createElement('span');
  label.className = 'label';
  label.textContent = '';
  root.appendChild(label);

  // Salvage progress bar — sits under the verb text, hidden by default.
  const bar = document.createElement('div');
  bar.className = 'salvage-progress';
  bar.style.display = 'none';
  root.appendChild(bar);

  // AAO — per-cook progress mini-bars row, shown above the prompt when
  // hovering a fire with active cooks. Pre-build 4 bars (grill cap);
  // visibility + fill width drive the actual state per frame.
  const cooksRoot = document.createElement('div');
  cooksRoot.className = 'cook-bars';
  cooksRoot.style.display = 'none';
  const fills: HTMLDivElement[] = [];
  for (let i = 0; i < 4; i++) {
    const slot = document.createElement('div');
    slot.className = 'cook-bar';
    const fill = document.createElement('div');
    fill.className = 'cook-bar-fill';
    slot.appendChild(fill);
    cooksRoot.appendChild(slot);
    fills.push(fill);
  }
  root.appendChild(cooksRoot);

  document.body.appendChild(root);
  _root = root;
  _label = label;
  _keyEl = key;
  _progressBar = bar;
  _cookBarsRoot = cooksRoot;
  _cookBarFills = fills;
}

/** Show the salvage progress bar with a 0..1 fill. Driven per-frame from
 *  the interaction system while a salvage is in progress. */
export function showSalvageProgress(t01: number): void {
  if (!_progressBar) return;
  _progressBar.style.display = '';
  _progressBar.style.width = `${Math.max(0, Math.min(1, t01)) * 100}%`;
}

/** Hide the salvage progress bar. */
export function hideSalvageProgress(): void {
  if (!_progressBar) return;
  _progressBar.style.display = 'none';
  _progressBar.style.width = '0%';
}

/** AAO — show one mini-bar per active cook on the hovered fire. Each
 *  entry is a 0..1 progress value. Up to 4 bars (FIRE_GRILL_MAX_PARALLEL_COOKS).
 *  Called per-frame from updateInteraction when hovering a fire with cooks.
 *  Empty array → bars hidden. */
export function showCookProgresses(progresses: readonly number[]): void {
  if (!_cookBarsRoot) return;
  if (progresses.length === 0) {
    _cookBarsRoot.style.display = 'none';
    return;
  }
  _cookBarsRoot.style.display = '';
  const n = Math.min(progresses.length, _cookBarFills.length);
  for (let i = 0; i < _cookBarFills.length; i++) {
    const fill = _cookBarFills[i];
    const slot = fill.parentElement as HTMLDivElement;
    if (i < n) {
      slot.style.display = '';
      fill.style.width = `${Math.max(0, Math.min(1, progresses[i])) * 100}%`;
    } else {
      slot.style.display = 'none';
    }
  }
}

/** AAO — hide cook progress bars (called when hover leaves a fire or no
 *  cooks are running). */
export function hideCookProgresses(): void {
  if (!_cookBarsRoot) return;
  _cookBarsRoot.style.display = 'none';
}

export function updateInteractPrompt(ctx: GameContext, _dt: number): void {
  if (!_root || !_label || !_keyEl) return;
  const hover = ctx.inventory.hover;
  const show = hover !== null;

  if (show !== _lastShown) {
    _root.classList.toggle('show', show);
    _lastShown = show;
  }

  if (show && hover) {
    // AAZ — verb override: callers can set hover.verb to swap the static
    // VERBS[type] mapping out (e.g. tent doorway switches between "open"
    // and "close" depending on doorOpen state). Ignored when `passive`.
    const verb = hover.passive ? '' : (hover.verb ?? VERBS[hover.type]);
    const label = verb ? `${verb} ${hover.promptNoun}` : hover.promptNoun;
    // Hide the key chip for passive prompts (kill = no E action; stripped wrecks)
    _keyEl.style.display = verb ? '' : 'none';
    if (label !== _lastLabel) {
      _label.textContent = label;
      _lastLabel = label;
    }
  }

  // VV — crosshair feedback hook. Same per-frame cadence as the prompt;
  // state is derived from the same hover read so they stay coherent.
  // AAA — added 'dead' state for corpse loot (dead lizard / sandworm).
  // AAN — added 'no_ammo' state. Hover always wins (kill/dead/interactable
  // is the more actionable signal); no_ammo fires only when there's no
  // hover and the equipped weapon is a ranged gun with empty magazine.
  if (!_crosshairEl) {
    _crosshairEl = document.getElementById('crosshair') as HTMLDivElement | null;
  }
  let next: '' | 'interactable' | 'kill' | 'dead' | 'no_ammo';
  if (hover !== null) {
    next =
      hover.type === 'kill' ? 'kill' :
      (hover.type === 'take' && hover.itemId && CORPSE_ITEM_IDS.has(hover.itemId)) ? 'dead' :
      'interactable';
  } else {
    // No hover — check for empty-gun state. Only scrap_gun uses ammo
    // today (energy_pistol charges; machete/pipe_staff are melee).
    const sel = ctx.inventory.slots[ctx.inventory.selectedIdx];
    if (sel.item === 'scrap_gun' && (sel.meta?.ammoRemaining ?? 0) <= 0) {
      next = 'no_ammo';
    } else {
      next = '';
    }
  }
  if (_crosshairEl && next !== _lastCrosshairState) {
    _crosshairEl.classList.toggle('interactable', next === 'interactable');
    _crosshairEl.classList.toggle('kill', next === 'kill');
    _crosshairEl.classList.toggle('dead', next === 'dead');
    _crosshairEl.classList.toggle('no_ammo', next === 'no_ammo');
    _lastCrosshairState = next;
  }
}
