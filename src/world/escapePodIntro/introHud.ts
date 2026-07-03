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

let fadeEl: HTMLDivElement | null = null;

function ensureFade(): HTMLDivElement {
  if (fadeEl) return fadeEl;
  const el = document.createElement('div');
  el.id = 'intro-fade';
  Object.assign(el.style, {
    position: 'fixed',
    inset: '0',
    background: '#000',
    pointerEvents: 'none',
    zIndex: '70',          // above the beat prompt — the blackout covers everything
    opacity: '0',
  } as Partial<CSSStyleDeclaration>);
  document.body.appendChild(el);
  fadeEl = el;
  return el;
}

/** Set the full-screen black overlay opacity (0 = clear, 1 = blackout). Driven directly
 *  by the impact (fade to black) + wake (fade from black) beats; cleared (0) at the
 *  desert handoff so it never lingers over the real game. */
export function setIntroBlack(opacity: number): void {
  ensureFade().style.opacity = String(Math.max(0, Math.min(1, opacity)));
}

// ─────────────────────────────────────────────────────────────────────────────
// THE FIRST-NEW-GAME LOADING SCREEN (the user's #1 perf idea).
// A NEW GAME on the intro path shows this while introPreload.ts builds every intro
// scene + force-compiles every shader UP FRONT — so the mid-play beat-entry freezes
// (the ship interior at cockpit, the hauler at explode, the first-plasma draw, …) are
// paid once here, behind an honest bar, instead of stuttering the cinematic.
//
// Diegetic idiom (matched to the game's title/HUD): a dark parchment-warm panel, a
// Cormorant-Garamond header ("HAULER SYSTEMS"), JetBrains-Mono technical readouts, and
// a real progress bar that advances PER ACTUAL COMPLETED STEP (no fake ramp). Input is
// swallowed by the overlay (pointer-events:auto) so the player can't click through into
// a half-built beat; it's short + never soft-locks (a failing step still advances the bar).
// ─────────────────────────────────────────────────────────────────────────────

interface LoadingRefs {
  root: HTMLDivElement;
  bar: HTMLDivElement;      // the filled portion (width driven 0→100%)
  pct: HTMLDivElement;      // the "42%" numeral
  step: HTMLDivElement;     // the current-step line ("Compiling hull shaders…")
}
let loadingRefs: LoadingRefs | null = null;

function ensureLoading(): LoadingRefs {
  if (loadingRefs) return loadingRefs;
  const root = document.createElement('div');
  root.id = 'intro-loading';
  Object.assign(root.style, {
    position: 'fixed',
    inset: '0',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '18px',
    background: 'radial-gradient(ellipse at center, rgba(14,10,7,0.96) 0%, rgba(6,4,3,0.99) 100%)',
    zIndex: '80',                 // above the black overlay (70) + the prompt (60)
    pointerEvents: 'auto',        // swallow clicks so nothing leaks into a half-built beat
    opacity: '0',
    transition: 'opacity 0.35s ease',
    cursor: 'wait',
  } as Partial<CSSStyleDeclaration>);

  // ── Diegetic header (the ship's boot banner).
  const header = document.createElement('div');
  header.textContent = 'HAULER SYSTEMS';
  Object.assign(header.style, {
    font: '300 40px/1 "Cormorant Garamond", serif',
    letterSpacing: '10px',
    color: '#f0e2c4',
    textShadow: '0 0 24px rgba(200,110,50,0.18), 0 2px 18px rgba(0,0,0,0.55)',
    paddingLeft: '10px',          // compensate the right-edge letter-spacing pad
  } as Partial<CSSStyleDeclaration>);
  root.appendChild(header);

  const flavor = document.createElement('div');
  flavor.textContent = 'PRE-FLIGHT DIAGNOSTIC';
  Object.assign(flavor.style, {
    font: '400 12px/1 "JetBrains Mono", monospace',
    letterSpacing: '6px',
    color: 'rgba(226,176,122,0.72)',
    marginTop: '-6px',
  } as Partial<CSSStyleDeclaration>);
  root.appendChild(flavor);

  // ── The progress track + fill.
  const track = document.createElement('div');
  Object.assign(track.style, {
    position: 'relative',
    width: 'min(440px, 62vw)',
    height: '3px',
    marginTop: '14px',
    background: 'rgba(232,220,192,0.14)',
    border: '1px solid rgba(232,220,192,0.20)',
  } as Partial<CSSStyleDeclaration>);
  const bar = document.createElement('div');
  Object.assign(bar.style, {
    position: 'absolute',
    left: '0',
    top: '0',
    bottom: '0',
    width: '0%',
    background: 'linear-gradient(to right, rgba(200,110,50,0.55), #e2b07a)',
    boxShadow: '0 0 12px rgba(226,176,122,0.45)',
    transition: 'width 0.18s ease',
  } as Partial<CSSStyleDeclaration>);
  track.appendChild(bar);
  root.appendChild(track);

  // ── The percent numeral + the current-step line.
  const pct = document.createElement('div');
  pct.textContent = '0%';
  Object.assign(pct.style, {
    font: '500 13px/1 "JetBrains Mono", monospace',
    letterSpacing: '3px',
    color: '#f0e2c4',
    marginTop: '2px',
  } as Partial<CSSStyleDeclaration>);
  root.appendChild(pct);

  const step = document.createElement('div');
  step.textContent = 'Spinning up…';
  Object.assign(step.style, {
    font: '400 11px/1.4 "JetBrains Mono", monospace',
    letterSpacing: '2px',
    color: 'rgba(232,220,192,0.55)',
    textTransform: 'uppercase',
    minHeight: '15px',            // reserve a line so the layout doesn't jump per step
    textAlign: 'center',
    maxWidth: '70vw',
  } as Partial<CSSStyleDeclaration>);
  root.appendChild(step);

  document.body.appendChild(root);
  loadingRefs = { root, bar, pct, step };
  return loadingRefs;
}

/** Show the loading screen (fade in). Idempotent. */
export function showIntroLoading(): void {
  const r = ensureLoading();
  r.root.style.display = 'flex';
  r.bar.style.width = '0%';
  r.pct.textContent = '0%';
  // Force a reflow before the opacity transition so the fade-in actually plays.
  void r.root.offsetWidth;
  r.root.style.opacity = '1';
}

/** Update the bar + the current-step line. `frac` in [0,1]; `label` = the step name. */
export function setIntroLoadingProgress(frac: number, label: string): void {
  const r = ensureLoading();
  const clamped = Math.max(0, Math.min(1, frac));
  r.bar.style.width = (clamped * 100).toFixed(1) + '%';
  r.pct.textContent = Math.round(clamped * 100) + '%';
  if (label) r.step.textContent = label;
}

/** Hide the loading screen (fade out, then display:none so it can't eat clicks). */
export function hideIntroLoading(): void {
  if (!loadingRefs) return;
  const r = loadingRefs;
  r.root.style.opacity = '0';
  window.setTimeout(() => { if (loadingRefs) loadingRefs.root.style.display = 'none'; }, 360);
}

/** Is the loading screen currently visible? (Guards a re-entrant preload.) */
export function introLoadingVisible(): boolean {
  return loadingRefs != null && loadingRefs.root.style.display !== 'none' && loadingRefs.root.style.opacity !== '0';
}
