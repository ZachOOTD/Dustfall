// GPU-side render-time measurement via the EXT_disjoint_timer_query_webgl2
// extension. Wrap renderer.render() in begin()/end(); the previous frame's
// result is available via `lastMs` (results lag by 1+ frames).
//
// Falls back gracefully if WebGL2 isn't available or the extension is missing
// (some browsers redact it). In that case `lastMs` stays at -1.

import type * as THREE from 'three';

export interface GpuTimer {
  begin(): void;
  end(): void;
  /** Last sampled GPU time in ms; -1 if unsupported or no result available yet. */
  lastMs: number;
  /** True if the extension is available and we're collecting samples. */
  supported: boolean;
}

const RING_SIZE = 2;

type Ext = {
  TIME_ELAPSED_EXT: number;
  GPU_DISJOINT_EXT: number;
};

export function createGpuTimer(renderer: THREE.WebGLRenderer): GpuTimer {
  const gl = renderer.getContext();
  // EXT_disjoint_timer_query_webgl2 needs a WebGL2 context.
  const isGL2 = (gl as unknown as { drawArraysInstanced?: unknown }).drawArraysInstanced !== undefined;
  const rawExt = isGL2 ? gl.getExtension('EXT_disjoint_timer_query_webgl2') : null;
  const ext = rawExt as unknown as Ext | null;

  if (!ext || !isGL2) {
    return {
      begin() { /* no-op */ },
      end() { /* no-op */ },
      lastMs: -1,
      supported: false,
    };
  }

  // Cast gl to WebGL2 — we already validated it above.
  const gl2 = gl as WebGL2RenderingContext;
  const queries: Array<WebGLQuery | null> = [];
  for (let i = 0; i < RING_SIZE; i++) queries.push(gl2.createQuery());
  // `started[i]` tracks whether queries[i] has been begun/ended at least once.
  const started: boolean[] = new Array(RING_SIZE).fill(false);

  let writeIdx = 0;     // ring slot to start a query in next
  let active = false;   // true between begin() and end()

  const timer: GpuTimer = {
    lastMs: -1,
    supported: true,
    begin() {
      const q = queries[writeIdx];
      if (!q) return;
      gl2.beginQuery(ext.TIME_ELAPSED_EXT, q);
      active = true;
    },
    end() {
      if (!active) return;
      gl2.endQuery(ext.TIME_ELAPSED_EXT);
      started[writeIdx] = true;
      active = false;

      // Try to read the OTHER ring slot (the older query) — it's likely ready.
      const readIdx = (writeIdx + 1) % RING_SIZE;
      const rq = queries[readIdx];
      if (rq && started[readIdx]) {
        const available = gl2.getQueryParameter(rq, gl2.QUERY_RESULT_AVAILABLE);
        const disjoint = gl2.getParameter(ext.GPU_DISJOINT_EXT);
        if (available && !disjoint) {
          const ns = gl2.getQueryParameter(rq, gl2.QUERY_RESULT) as number;
          timer.lastMs = ns / 1e6;
        }
      }

      writeIdx = readIdx;
    },
  };

  return timer;
}
