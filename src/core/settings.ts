// Persistent player settings stored in localStorage.

export type RenderQuality = 'low' | 'medium' | 'high';

/** Window display mode. On the Tauri desktop app all three are real window
 *  states (see displayMode.ts); on the web build only `windowed` /
 *  `fullscreen` apply (the Fullscreen API) — `borderless` is desktop-only
 *  and hidden from the web settings UI. */
export type DisplayMode = 'windowed' | 'fullscreen' | 'borderless';

export interface Settings {
  sensitivity: number;     // 0.2 .. 3.0 — multiplier on PointerLockControls.pointerSpeed
  masterVolume: number;    // 0 .. 1
  fov: number;             // 60 .. 100 (degrees)
  renderQuality: RenderQuality;
  /** Window display mode — applied by displayMode.ts (web Fullscreen API /
   *  Tauri window API). Persisted here in localStorage, not the save schema. */
  displayMode: DisplayMode;
  shadowsEnabled: boolean; // Sun cast-shadow on/off (biggest GPU lever)
  /** M6 ④ (C40) — diegetic survival opt-in. Only honored when `FEATURES.diegeticSurvival`
   *  is ON. true (default) = hide the HUD stat bars + feel survival via vignettes/audio;
   *  false = show the classic bars (the always-available floor). Persisted in localStorage,
   *  NOT the save schema — so adding it is not a D81 save-version bump. */
  diegeticSurvival: boolean;
}

const DEFAULT: Settings = {
  sensitivity: 1.0,
  masterVolume: 0.55,
  fov: 78,
  renderQuality: 'medium',
  displayMode: 'windowed',
  shadowsEnabled: true,
  diegeticSurvival: true,
};

const STORAGE_KEY = 'dustfall.settings.v1';

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function coerceQuality(q: unknown): RenderQuality {
  return q === 'low' || q === 'medium' || q === 'high' ? q : DEFAULT.renderQuality;
}

function coerceDisplayMode(m: unknown): DisplayMode {
  return m === 'windowed' || m === 'fullscreen' || m === 'borderless' ? m : DEFAULT.displayMode;
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT };
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      sensitivity: clamp(parsed.sensitivity ?? DEFAULT.sensitivity, 0.2, 3.0),
      masterVolume: clamp(parsed.masterVolume ?? DEFAULT.masterVolume, 0, 1),
      fov: clamp(parsed.fov ?? DEFAULT.fov, 60, 100),
      renderQuality: coerceQuality(parsed.renderQuality),
      displayMode: coerceDisplayMode(parsed.displayMode),
      shadowsEnabled: typeof parsed.shadowsEnabled === 'boolean'
        ? parsed.shadowsEnabled
        : DEFAULT.shadowsEnabled,
      diegeticSurvival: typeof parsed.diegeticSurvival === 'boolean'
        ? parsed.diegeticSurvival
        : DEFAULT.diegeticSurvival,
    };
  } catch {
    return { ...DEFAULT };
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // ignore — quota or private mode
  }
}

/** Map a render-quality preset to concrete renderer values.
 *  `devicePR` is `window.devicePixelRatio` (Three.js uses it for "native" pixel-perfect rendering).
 *  ABL — perf: medium preset (default) shadow map 2048 → 1024 to hit
 *  144fps target on mid-tier hardware. 2048 is preserved on "high"
 *  for players who explicitly opt in. The shadow quality drop is
 *  imperceptible at our flat-shaded low-mid-fi art style. */
export function presetValues(q: RenderQuality, devicePR: number): {
  pixelRatio: number;
  shadowMapSize: number;
} {
  if (q === 'low')  return { pixelRatio: 0.75, shadowMapSize: 512 };
  if (q === 'high') return { pixelRatio: Math.min(devicePR, 2.0), shadowMapSize: 2048 };
  /* medium */      return { pixelRatio: 1.00, shadowMapSize: 1024 };
}
