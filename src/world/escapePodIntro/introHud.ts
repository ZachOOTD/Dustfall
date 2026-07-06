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
  backdrop: HTMLImageElement;   // Y6 — the frozen main-menu frame (canvas capture) behind the panel
  scrim: HTMLDivElement;        // Y6 — a light vignette over the backdrop so the readouts stay legible
  bar: HTMLDivElement;      // the filled portion (width driven 0→100%)
  pct: HTMLDivElement;      // the "42%" numeral
  step: HTMLDivElement;     // the current-step line ("Compiling hull shaders…")
}
let loadingRefs: LoadingRefs | null = null;
// Y6 — the pending display:none timer from hideIntroLoading. Tracked so a re-show
// (showIntroLoading / introLoadingAwaitLaunchClick) can CANCEL it — otherwise the
// stale timer would display:none the re-shown overlay 360ms later (which would have
// killed the READY — CLICK TO LAUNCH recovery state and exposed the canvas).
let hideTimer: number | null = null;

function cancelPendingHide(): void {
  if (hideTimer !== null) {
    window.clearTimeout(hideTimer);
    hideTimer = null;
  }
}

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
    // Y6 — FULLY OPAQUE (was rgba .96/.99): this gradient is the fallback cover when no
    // menu freeze-frame was captured, and the canvas behind must NEVER show through it.
    background: 'radial-gradient(ellipse at center, rgb(14,10,7) 0%, rgb(6,4,3) 100%)',
    zIndex: '80',                 // above the black overlay (70) + the prompt (60)
    pointerEvents: 'auto',        // swallow clicks so nothing leaks into a half-built beat
    opacity: '0',
    transition: 'opacity 0.35s ease',
    cursor: 'wait',
  } as Partial<CSSStyleDeclaration>);

  // ── Y6 — the frozen-menu backdrop (killing the desert flash). main.ts captures the
  // title vista's last rendered frame at the New-Game click and mounts it here, so the
  // MENU visual persists seamlessly under the loading bar for the whole preload (the
  // game canvas — which flips to the desert spawn at handoff — is fully covered).
  // Hidden until setIntroLoadingBackdrop provides a capture; the opaque root gradient
  // is the no-capture fallback. Absolutely positioned → doesn't disturb the flex column.
  const backdrop = document.createElement('img');
  backdrop.alt = '';
  Object.assign(backdrop.style, {
    position: 'absolute',
    inset: '0',
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    zIndex: '0',
    display: 'none',
  } as Partial<CSSStyleDeclaration>);
  root.appendChild(backdrop);

  // A soft vignette over the frozen menu so the warm readouts keep contrast while the
  // desert-dawn vista stays clearly visible (the point of persisting it).
  const scrim = document.createElement('div');
  Object.assign(scrim.style, {
    position: 'absolute',
    inset: '0',
    background: 'radial-gradient(ellipse at center, rgba(6,4,3,0.38) 0%, rgba(6,4,3,0.62) 100%)',
    zIndex: '0',
    display: 'none',
  } as Partial<CSSStyleDeclaration>);
  root.appendChild(scrim);

  // ── Diegetic header (the ship's boot banner).
  const header = document.createElement('div');
  header.textContent = 'HAULER SYSTEMS';
  Object.assign(header.style, {
    font: '300 40px/1 "Cormorant Garamond", serif',
    letterSpacing: '10px',
    color: '#f0e2c4',
    textShadow: '0 0 24px rgba(200,110,50,0.18), 0 2px 18px rgba(0,0,0,0.55)',
    paddingLeft: '10px',          // compensate the right-edge letter-spacing pad
    position: 'relative',         // Y6 — paint above the abs-positioned backdrop/scrim
    zIndex: '1',
  } as Partial<CSSStyleDeclaration>);
  root.appendChild(header);

  const flavor = document.createElement('div');
  flavor.textContent = 'PRE-FLIGHT DIAGNOSTIC';
  Object.assign(flavor.style, {
    font: '400 12px/1 "JetBrains Mono", monospace',
    letterSpacing: '6px',
    color: 'rgba(226,176,122,0.72)',
    marginTop: '-6px',
    position: 'relative',         // Y6 — above the backdrop
    zIndex: '1',
  } as Partial<CSSStyleDeclaration>);
  root.appendChild(flavor);

  // ── The progress track + fill.
  const track = document.createElement('div');
  Object.assign(track.style, {
    position: 'relative',
    zIndex: '1',                  // Y6 — above the backdrop
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
    position: 'relative',         // Y6 — above the backdrop
    zIndex: '1',
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
    position: 'relative',         // Y6 — above the backdrop
    zIndex: '1',
  } as Partial<CSSStyleDeclaration>);
  root.appendChild(step);

  document.body.appendChild(root);
  loadingRefs = { root, backdrop, scrim, bar, pct, step };
  return loadingRefs;
}

/** Y6 — mount (or clear, with null) the frozen main-menu frame as the loading screen's
 *  backdrop. main.ts captures the title vista off the canvas at the New-Game click
 *  (explicit render + toDataURL in the same task — the drawing buffer isn't preserved)
 *  and hands it here, so the menu visual persists under the loading bar instead of the
 *  in-game desert flashing through. Null → the opaque root gradient covers instead. */
export function setIntroLoadingBackdrop(dataUrl: string | null): void {
  const r = ensureLoading();
  if (dataUrl) {
    r.backdrop.src = dataUrl;
    r.backdrop.style.display = '';
    r.scrim.style.display = '';
  } else {
    r.backdrop.removeAttribute('src');
    r.backdrop.style.display = 'none';
    r.scrim.style.display = 'none';
  }
}

/** LIVE-MENU mode (user: "make the main menu animation still run while loading"). Instead of a
 *  frozen menu capture, the loading panel goes TRANSPARENT so the still-rendering title scene
 *  (titleActive stays true through the preload) shows through, ANIMATED, behind the bar. The
 *  scrim (vignette) stays on so the readouts keep contrast over the moving menu. The New-Game
 *  path holds titleActive until the preload finishes, then hands off straight to the cockpit —
 *  so there's still no desert flash (the menu, not the desert, is what's under the overlay). */
export function setIntroLoadingLiveMenu(): void {
  const r = ensureLoading();
  r.root.style.background = 'transparent';   // reveal the live animated title behind the panel
  r.backdrop.removeAttribute('src');
  r.backdrop.style.display = 'none';         // no frozen capture — the real menu renders live
  r.scrim.style.display = '';                // keep the vignette for readout legibility
}

/** Show the loading screen. Default = fade in (the pre-Y6 behavior, used by the preload's
 *  re-assert). `instant` = cover the canvas at FULL opacity within the calling task — the
 *  New-Game path needs this because handoffToGame flips the very next painted frame to the
 *  in-game desert spawn, and a 0.35s fade-in would let that frame show through (the exact
 *  desert flash Y6 kills). Idempotent. */
export function showIntroLoading(opts?: { instant?: boolean }): void {
  const r = ensureLoading();
  cancelPendingHide();   // a re-show must survive any in-flight hide's display:none timer
  r.root.style.display = 'flex';
  r.bar.style.width = '0%';
  r.pct.textContent = '0%';
  if (opts?.instant) {
    // Jump straight to opaque: suspend the transition, commit the jump via a reflow,
    // then restore the transition so the eventual hideIntroLoading still fades out.
    r.root.style.transition = 'none';
    r.root.style.opacity = '1';
    void r.root.offsetWidth;
    r.root.style.transition = 'opacity 0.35s ease';
    return;
  }
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

/** Hide the loading screen (fade out, then display:none so it can't eat clicks).
 *  Y6 — the display:none timer is TRACKED (hideTimer) so a re-show can cancel it;
 *  the untracked timer used to kill a re-shown overlay 360ms later (fatal for the
 *  READY — CLICK TO LAUNCH recovery state, which re-shows right after a hide). */
export function hideIntroLoading(): void {
  if (!loadingRefs) return;
  const r = loadingRefs;
  r.root.style.opacity = '0';
  cancelPendingHide();
  hideTimer = window.setTimeout(() => {
    hideTimer = null;
    if (loadingRefs) loadingRefs.root.style.display = 'none';
  }, 360);
}

/** Is the loading screen currently visible? (Guards a re-entrant preload.) */
export function introLoadingVisible(): boolean {
  return loadingRefs != null && loadingRefs.root.style.display !== 'none' && loadingRefs.root.style.opacity !== '0';
}

/** BUGFIX (the "loading screen finishes, nothing happens" freeze): flip the loading screen
 *  into a "READY — CLICK TO LAUNCH" state and resolve on the player's click. Needed because
 *  the New-Game click's user-gesture EXPIRES during the multi-second preload, so a
 *  post-preload `controls.lock()` is silently refused by the browser → `flags.paused` stays
 *  true → the intro starts but every tick is frozen (the documented pointer-lock freeze
 *  mode). The promise resolves INSIDE a fresh click gesture, so the caller's lock() succeeds.
 *  (Re-shows the overlay if the preload already faded it.) */
export function introLoadingAwaitLaunchClick(): Promise<void> {
  const r = ensureLoading();
  cancelPendingHide();   // Y6 — the preload's finally just called hideIntroLoading; without
                         // this its 360ms timer would display:none the READY state mid-wait
  r.root.style.display = 'flex';
  r.root.style.opacity = '1';
  r.bar.style.width = '100%';
  r.pct.textContent = '100%';
  r.step.textContent = 'READY — CLICK TO LAUNCH';
  r.root.style.cursor = 'pointer';
  return new Promise((resolve) => {
    const done = (): void => {
      r.root.style.cursor = '';
      r.root.removeEventListener('click', go);
      document.removeEventListener('pointerlockchange', onLock);
      resolve();
    };
    const go = (): void => done();
    // Y6 — ALSO resolve when a pointer lock ARRIVES by any other gesture. The concrete
    // trap (hit by the Y6 headless probe): the player Esc's during loading → unlock →
    // the pause menu opens OVER this overlay; the preload ends lock-less so this READY
    // state arms; the player clicks the pause menu's RESUME — which re-LOCKS the pointer.
    // With the lock active, mouse events route to the locked canvas, so the click this
    // promise awaits can never land — a permanent soft-lock behind the loading screen.
    // A lock acquired by ANY route is this state's entire goal (the caller's follow-up
    // lock() becomes a no-op), so treat lock-acquired as the launch. The click path is
    // unchanged — it remains the normal resolution for the documented gesture-expiry fix.
    const onLock = (): void => { if (document.pointerLockElement) done(); };
    r.root.addEventListener('click', go);
    document.addEventListener('pointerlockchange', onLock);
  });
}
