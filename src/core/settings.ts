// Persistent player settings stored in localStorage.

export interface Settings {
  sensitivity: number;   // 0.2 .. 3.0 — multiplier on PointerLockControls.pointerSpeed
  masterVolume: number;  // 0 .. 1
  fov: number;           // 60 .. 100 (degrees)
}

const DEFAULT: Settings = {
  sensitivity: 1.0,
  masterVolume: 0.55,
  fov: 78,
};

const STORAGE_KEY = 'dustfall.settings.v1';

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
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
