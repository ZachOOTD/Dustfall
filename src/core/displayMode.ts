// Window display-mode control — fullscreen / windowed / borderless.
//
// Two backends, chosen at runtime:
//   - Tauri desktop app: the real window API (setFullscreen / setDecorations /
//     maximize / unmaximize), reached via the `withGlobalTauri` global. All
//     three modes are distinct window states.
//   - Web build: the Fullscreen API. Only `windowed` / `fullscreen` apply
//     (`borderless` is desktop-only + hidden from the web settings UI).
//     Programmatic fullscreen requires a user gesture, so on web we apply on
//     the settings change (a gesture) and sync back on `fullscreenchange`
//     (the user pressing Esc / F11).

import type { DisplayMode } from './settings.ts';

// Minimal shapes for the `withGlobalTauri` window API (avoids an
// @tauri-apps/api dependency + keeps the web bundle clean — the global is
// simply undefined in a browser, so the web Fullscreen path runs).
interface TauriWindow {
  setFullscreen(v: boolean): Promise<void>;
  setDecorations(v: boolean): Promise<void>;
  maximize(): Promise<void>;
  unmaximize(): Promise<void>;
}
interface TauriGlobal {
  window?: { getCurrentWindow(): TauriWindow };
}

function tauri(): Required<TauriGlobal> | null {
  const g = (globalThis as { __TAURI__?: TauriGlobal }).__TAURI__;
  return g && g.window ? (g as Required<TauriGlobal>) : null;
}

/** True when running inside the Tauri desktop app (the window API is available).
 *  Used by the settings UI to decide whether to offer `borderless`. */
export function isDesktopApp(): boolean {
  return tauri() !== null;
}

/** Apply a display mode. Async (both backends are async). Safe to call from a
 *  settings-change handler — that is a user gesture, which web fullscreen needs. */
export async function applyDisplayMode(mode: DisplayMode): Promise<void> {
  const t = tauri();
  if (t) {
    const win = t.window.getCurrentWindow();
    try {
      if (mode === 'fullscreen') {
        await win.setFullscreen(true);
      } else if (mode === 'borderless') {
        // Undecorated, maximized window filling the work area.
        await win.setFullscreen(false);
        await win.setDecorations(false);
        await win.maximize();
      } else {
        // windowed — decorated, restored.
        await win.setFullscreen(false);
        await win.setDecorations(true);
        await win.unmaximize();
      }
    } catch (e) {
      console.warn('[displayMode] tauri window call failed', e);
    }
    return;
  }
  // Web: the Fullscreen API. `borderless` never reaches here (hidden on web);
  // treat it as fullscreen defensively.
  try {
    if (mode === 'windowed') {
      if (document.fullscreenElement) await document.exitFullscreen();
    } else if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
    }
  } catch {
    // requestFullscreen rejects without a user gesture — ignore. A real
    // dropdown selection IS a gesture (so it succeeds); a boot-time apply is
    // deliberately skipped on web (see initDisplayMode).
  }
}

/** Boot-time init. On desktop, apply the saved mode immediately (no gesture
 *  needed). On web, DON'T force fullscreen at boot (the browser blocks it
 *  without a gesture) — instead watch `fullscreenchange` so the persisted
 *  setting + the settings dropdown stay in sync when the user Escs / F11s. */
export function initDisplayMode(
  saved: DisplayMode,
  onExternalChange: (m: DisplayMode) => void,
): void {
  if (isDesktopApp()) {
    if (saved !== 'windowed') void applyDisplayMode(saved);
    return;
  }
  document.addEventListener('fullscreenchange', () => {
    onExternalChange(document.fullscreenElement ? 'fullscreen' : 'windowed');
  });
}
