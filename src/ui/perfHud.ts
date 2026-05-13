// Dev-only perf overlay: FPS, draw calls, triangles, mesh count.
// Toggle with F1. Updates twice per second to avoid jitter.

import type { GameContext } from '../GameContext.ts';

const SAMPLE_WINDOW = 30;     // frames in rolling avg
const REFRESH_PERIOD = 0.5;   // seconds between DOM updates

interface Refs {
  root: HTMLDivElement;
  fps: HTMLSpanElement;
  draws: HTMLSpanElement;
  tris: HTMLSpanElement;
}

let _refs: Refs | null = null;
let _enabled = false;
let _dtHistory: number[] = [];
let _dtIndex = 0;
let _refreshAccum = 0;

export function createPerfHud(): void {
  // Production: skip the overlay entirely (no DOM, no listeners).
  if (!import.meta.env.DEV) return;

  const root = document.createElement('div');
  root.id = 'perf-hud';
  root.classList.add('hidden');
  document.body.appendChild(root);

  function makeLine(label: string): HTMLSpanElement {
    const row = document.createElement('div');
    row.className = 'perf-row';
    const k = document.createElement('span');
    k.className = 'perf-k';
    k.textContent = label;
    const v = document.createElement('span');
    v.className = 'perf-v';
    v.textContent = '—';
    row.appendChild(k);
    row.appendChild(v);
    root.appendChild(row);
    return v;
  }

  _refs = {
    root,
    fps: makeLine('FPS'),
    draws: makeLine('draws'),
    tris: makeLine('tris'),
  };

  window.addEventListener('keydown', (e) => {
    if (e.code === 'F1') {
      e.preventDefault();
      _enabled = !_enabled;
      root.classList.toggle('hidden', !_enabled);
    }
  });
}

export function updatePerfHud(ctx: GameContext, dt: number): void {
  if (!_refs) return;

  // Always track frame times (cheap), but only update DOM if enabled.
  if (_dtHistory.length < SAMPLE_WINDOW) {
    _dtHistory.push(dt);
  } else {
    _dtHistory[_dtIndex] = dt;
    _dtIndex = (_dtIndex + 1) % SAMPLE_WINDOW;
  }

  if (!_enabled) return;
  _refreshAccum += dt;
  if (_refreshAccum < REFRESH_PERIOD) return;
  _refreshAccum = 0;

  let total = 0;
  for (const v of _dtHistory) total += v;
  const avgDt = total / _dtHistory.length;
  const fps = avgDt > 0 ? Math.round(1 / avgDt) : 0;

  const info = ctx.three.renderer.info.render;
  _refs.fps.textContent = String(fps);
  _refs.draws.textContent = String(info.calls);
  _refs.tris.textContent = formatK(info.triangles);
}

function formatK(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}
