// Dev-only perf overlay: FPS, draw calls, triangles, GPU, render scale.
// Toggle with F1. Updates twice per second to avoid jitter.
//
// GPU detection uses the WEBGL_debug_renderer_info extension. Some browsers
// redact this for fingerprinting prevention; in that case we show "unknown".

import type { GameContext } from '../GameContext.ts';
import type * as THREE from 'three';

const SAMPLE_WINDOW = 30;     // frames in rolling avg
const REFRESH_PERIOD = 0.5;   // seconds between DOM updates

interface Refs {
  root: HTMLDivElement;
  fps: HTMLSpanElement;
  draws: HTMLSpanElement;
  tris: HTMLSpanElement;
  gpu: HTMLSpanElement;
  gpuRow: HTMLDivElement;  // for SW-render warning styling
  res: HTMLSpanElement;
  fb: HTMLSpanElement;
  gpuMs: HTMLSpanElement;
  cpuMs: HTMLSpanElement;
  frameMs: HTMLSpanElement;
}

let _refs: Refs | null = null;
let _enabled = false;
let _dtHistory: number[] = [];
let _dtIndex = 0;
let _refreshAccum = 0;

function detectGPU(renderer: THREE.WebGLRenderer): string {
  const gl = renderer.getContext();
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  if (!ext) return 'unknown (blocked)';
  const name = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) as string | null;
  return name || 'unknown';
}

export function createPerfHud(ctx: GameContext): void {
  // Production: skip the overlay entirely (no DOM, no listeners).
  if (!import.meta.env.DEV) return;

  const root = document.createElement('div');
  root.id = 'perf-hud';
  root.classList.add('hidden');
  document.body.appendChild(root);

  function makeLine(label: string): { v: HTMLSpanElement; row: HTMLDivElement } {
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
    return { v, row };
  }

  const fpsLine = makeLine('FPS');
  const drawsLine = makeLine('draws');
  const trisLine = makeLine('tris');
  const gpuLine = makeLine('GPU');
  const resLine = makeLine('res');
  const fbLine = makeLine('FB');
  const gpuMsLine = makeLine('GPU ms');
  const cpuMsLine = makeLine('CPU ms');
  const frameMsLine = makeLine('frame');

  _refs = {
    root,
    fps: fpsLine.v,
    draws: drawsLine.v,
    tris: trisLine.v,
    gpu: gpuLine.v,
    gpuRow: gpuLine.row,
    res: resLine.v,
    fb: fbLine.v,
    gpuMs: gpuMsLine.v,
    cpuMs: cpuMsLine.v,
    frameMs: frameMsLine.v,
  };

  // GPU name is static — set once and forget. If the string looks like a
  // software-rendering fallback (Microsoft Basic Render, WARP, SwiftShader),
  // paint the row red with a tooltip pointing to the fix.
  const gpuName = detectGPU(ctx.three.renderer);
  _refs.gpu.textContent = gpuName;
  const isSoftware = /microsoft basic|warp|swiftshader|software/i.test(gpuName);
  if (isSoftware) {
    _refs.gpuRow.classList.add('warning');
    _refs.gpuRow.title = 'Software rendering — your GPU is NOT being used. See CLAUDE.md "Diagnosing low FPS".';
  }

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

  // Render scale + framebuffer. The framebuffer is the actual pixel count
  // the GPU is filling — the number that matters for fillrate-limited perf.
  const w = window.innerWidth;
  const h = window.innerHeight;
  const pr = ctx.three.renderer.getPixelRatio();
  _refs.res.textContent = `${w}×${h} @${pr.toFixed(2)}x`;
  _refs.fb.textContent = `${Math.round(w * pr)}×${Math.round(h * pr)}`;

  // GPU vs CPU vs frame time. Compare GPU ms to (1000/fps) to know where the
  // bottleneck lives:  GPU ≫ CPU → GPU-bound (shadows, fillrate);
  // GPU ≪ CPU → JS-bound. The frame total is the rolling average.
  const frameMs = avgDt * 1000;
  const gpuMs = ctx.three.gpuTimer.lastMs;
  if (gpuMs >= 0) {
    _refs.gpuMs.textContent = `${gpuMs.toFixed(1)} ms`;
    const cpuMs = Math.max(0, frameMs - gpuMs);
    _refs.cpuMs.textContent = `${cpuMs.toFixed(1)} ms`;
  } else {
    _refs.gpuMs.textContent = '—';
    _refs.cpuMs.textContent = '—';
  }
  _refs.frameMs.textContent = `${frameMs.toFixed(1)} ms`;
}

function formatK(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}
