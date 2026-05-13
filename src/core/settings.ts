// Persistent player settings stored in localStorage.

export type RenderQuality = 'low' | 'medium' | 'high';

export interface Settings {
  sensitivity: number;     // 0.2 .. 3.0 — multiplier on PointerLockControls.pointerSpeed
  masterVolume: number;    // 0 .. 1
  fov: number;             // 60 .. 100 (degrees)
  renderQuality: RenderQuality;
  shadowsEnabled: boolean; // Sun cast-shadow on/off (biggest GPU lever)
}

const DEFAULT: Settings = {
  sensitivity: 1.0,
  masterVolume: 0.55,
  fov: 78,
  renderQuality: 'medium',
  shadowsEnabled: true,
};

const STORAGE_KEY = 'dustfall.settings.v1';

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function coerceQuality(q: unknown): RenderQuality {
  return q === 'low' || q === 'medium' || q === 'high' ? q : DEFAULT.renderQuality;
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
      shadowsEnabled: typeof parsed.shadowsEnabled === 'boolean'
        ? parsed.shadowsEnabled
        : DEFAULT.shadowsEnabled,
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
 *  `devicePR` is `window.devicePixelRatio` (Three.js uses it for "native" pixel-perfect rendering). */
export function presetValues(q: RenderQuality, devicePR: number): {
  pixelRatio: number;
  shadowMapSize: number;
} {
  if (q === 'low')  return { pixelRatio: 0.75, shadowMapSize: 1024 };
  if (q === 'high') return { pixelRatio: Math.min(devicePR, 2.0), shadowMapSize: 2048 };
  /* medium */      return { pixelRatio: 1.00, shadowMapSize: 2048 };
}
