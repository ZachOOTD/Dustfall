// Escape-pod intro — the intro's own thin HUD layer.
// ─────────────────────────────────────────────────────────────────────────────
// Two jobs during the scripted intro: (1) SUPPRESS the normal game HUD (the clock,
// storm-warning, hotbar, crosshair) so the cinematic view is clean, and (2) show
// DIEGETIC beat prompts ("check engines", …). Owns its DOM (the prompt element is
// created lazily). The game HUD is toggled by id — the same ids main.ts hides behind
// the title (`hud`/`hotbar`/`crosshair`) — and restored at the desert handoff.
// Greybox styling now; the hero presentation pass is Phase 3+.
// ─────────────────────────────────────────────────────────────────────────────

// The clock + day-counter + stat bars live inside #hud; the long-storm countdown +
// the DEV badge are appended to <body> separately, so they must be listed explicitly.
const GAME_HUD_IDS = ['hud', 'hotbar', 'crosshair', 'long-storm-indicator', 'dev-mode-badge'];

/** Hide (true) or restore (false) the normal game HUD. Idempotent — safe to call
 *  every frame. Restore uses '' so the element's stylesheet rules take over again. */
export function setGameHudHidden(hidden: boolean): void {
  for (const id of GAME_HUD_IDS) {
    const el = document.getElementById(id);
    if (el) el.style.visibility = hidden ? 'hidden' : '';
  }
}

let promptEl: HTMLDivElement | null = null;

function ensurePrompt(): HTMLDivElement {
  if (promptEl) return promptEl;
  const el = document.createElement('div');
  el.id = 'intro-prompt';
  Object.assign(el.style, {
    position: 'fixed',
    left: '50%',
    bottom: '24%',
    transform: 'translateX(-50%)',
    color: '#e2b07a',
    font: '600 17px/1.4 system-ui, -apple-system, sans-serif',
    letterSpacing: '0.24em',
    textTransform: 'uppercase',
    textAlign: 'center',
    textShadow: '0 2px 10px rgba(0,0,0,0.85)',
    pointerEvents: 'none',
    zIndex: '60',
    opacity: '0',
    transition: 'opacity 0.5s ease',
    maxWidth: '70vw',
  } as Partial<CSSStyleDeclaration>);
  document.body.appendChild(el);
  promptEl = el;
  return el;
}

/** Fade in a diegetic beat prompt. Empty string just hides it. */
export function showIntroPrompt(text: string): void {
  if (!text) { hideIntroPrompt(); return; }
  const el = ensurePrompt();
  el.textContent = text;
  el.style.opacity = '1';
}

/** Fade out the beat prompt (kept in the DOM for reuse). */
export function hideIntroPrompt(): void {
  if (promptEl) promptEl.style.opacity = '0';
}
