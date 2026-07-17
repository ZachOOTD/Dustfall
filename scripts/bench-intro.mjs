// bench-intro.mjs — PROVE THE PRELOAD WIN.
// ─────────────────────────────────────────────────────────────────────────────
// Boots a headless Vite dev server + chromium (swiftshader WebGL), then drives the
// escape-pod intro beat chain via window.__game.benchIntro(), measuring:
//   • per-beat-ENTRY stall (the first tick of each beat runs its build/init — the freeze)
//   • the >50ms / >100ms hitch counts + the worst frame across the whole chain
// under two conditions:
//   COLD    — no preload: each beat cold-builds its geometry + compiles its shaders on entry.
//   PRELOAD — the up-front preload runs first: beats reuse prebuilt scenes → entries ~0.
//
// Playwright/swiftshader timings are NOISY, so each condition runs 3 times and the medians
// are reported. Between runs the page is reloaded to reset all module-level scene state.
//
// Usage:  VITE_ESCAPE_POD_INTRO=1 node scripts/bench-intro.mjs   (the flag isn't required —
//         benchIntro force-starts the intro — but a flagged build matches the shipped path).
//         --runs=N  overrides the 3-run median (default 3).
//         --port=P  dev server port (default 5194).
// ─────────────────────────────────────────────────────────────────────────────

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { chromium } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const argv = Object.fromEntries(process.argv.slice(2).map((a) => {
  const m = a.match(/^--([^=]+)=(.*)$/); return m ? [m[1], m[2]] : [a.replace(/^--/, ''), true];
}));
const PORT = Number(argv.port ?? 5194);
const RUNS = Number(argv.runs ?? 3);

function startDev() {
  const isWin = process.platform === 'win32';
  const cmd = isWin ? 'npm.cmd' : 'npm';
  const proc = spawn(cmd, ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'], {
    cwd: ROOT, shell: isWin,
    env: { ...process.env, VITE_ESCAPE_POD_INTRO: process.env.VITE_ESCAPE_POD_INTRO ?? '1' },
  });
  let exited = false;
  proc.on('exit', () => { exited = true; });
  proc.stdout.on('data', () => {}); proc.stderr.on('data', () => {});
  return new Promise((res, rej) => {
    const start = Date.now();
    const tick = async () => {
      if (exited) return rej(new Error('dev server exited early'));
      if (Date.now() - start > 30000) { proc.kill(); return rej(new Error('dev server not ready in 30s')); }
      try { const r = await fetch(`http://127.0.0.1:${PORT}/`); if (r.ok) return res(proc); } catch {}
      setTimeout(tick, 300);
    };
    tick();
  });
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

async function runOnce(page, preload) {
  // Fresh page each run so module-level scene state (podGroup/shipGroup/haulerGroup) resets.
  await page.goto(`http://127.0.0.1:${PORT}/`);
  await page.waitForLoadState('domcontentloaded').catch(() => {});
  await page.waitForFunction(() => !!(window.__game && window.__game.ctx?.player?.rig && window.__game.benchIntro), undefined, { timeout: 45000 });
  // Give WebGL a beat to finish first paint under swiftshader before we time compiles.
  await page.waitForTimeout(500);
  return await page.evaluate((pl) => window.__game.benchIntro({ preload: pl }), preload);
}

function summarize(label, results) {
  // results: array of IntroBenchResult
  const beatIds = results[0].beatEntries.map((b) => b.beat);
  const perBeat = beatIds.map((beat, i) => ({
    beat,
    ms: median(results.map((r) => r.beatEntries[i]?.ms ?? 0)),
  }));
  return {
    label,
    perBeat,
    maxFrameMs: median(results.map((r) => r.maxFrameMs)),
    framesOver50: median(results.map((r) => r.framesOver50)),
    framesOver100: median(results.map((r) => r.framesOver100)),
    totalMs: median(results.map((r) => r.totalMs)),
    preloadTotalMs: results[0].preload ? median(results.map((r) => r.preload?.totalMs ?? 0)) : null,
  };
}

function printSummary(s) {
  console.log(`\n══ ${s.label} (median of ${RUNS}) ══`);
  console.log('  beat-entry stalls (ms):');
  for (const b of s.perBeat) {
    const bar = '█'.repeat(Math.min(40, Math.round(b.ms / 5)));
    console.log(`    ${b.beat.padEnd(14)} ${b.ms.toFixed(1).padStart(8)}  ${bar}`);
  }
  console.log(`  max frame:      ${s.maxFrameMs.toFixed(1)} ms`);
  console.log(`  frames >50ms:   ${s.framesOver50}`);
  console.log(`  frames >100ms:  ${s.framesOver100}`);
  console.log(`  total (chain):  ${s.totalMs.toFixed(1)} ms`);
  if (s.preloadTotalMs != null) console.log(`  preload total:  ${s.preloadTotalMs.toFixed(1)} ms (paid up front, behind the loading screen)`);
}

async function main() {
  console.log(`[bench-intro] starting dev server on ${PORT}…`);
  const dev = await startDev();
  console.log('[bench-intro] dev up; launching chromium (swiftshader)…');
  const browser = await chromium.launch({ args: (process.env.RIG_GL === 'swiftshader' ? ['--enable-webgl', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] : ['--enable-webgl', '--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist']) });
  try {
    const bctx = await browser.newContext({ viewport: { width: 640, height: 480 }, deviceScaleFactor: 1 });
    const page = await bctx.newPage();
    page.on('pageerror', (e) => console.log(`  [page error] ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error') console.log(`  [browser error] ${m.text()}`); });
    await page.addInitScript(() => {
      try { localStorage.setItem('dustfall.tutorial.v1', JSON.stringify({ seenIntro: true, usedItems: [] })); } catch {}
      try { localStorage.setItem('dustfall.pendingSeed', '1337'); } catch {}
    });

    const cold = [], warm = [];
    for (let i = 0; i < RUNS; i++) {
      console.log(`[bench-intro] COLD run ${i + 1}/${RUNS}…`);
      const r = await runOnce(page, false);
      console.log(`    cockpit-entry=${(r.beatEntries.find((b) => b.beat === 'cockpit')?.ms ?? 0).toFixed(1)}ms max=${r.maxFrameMs.toFixed(1)}ms >50=${r.framesOver50} >100=${r.framesOver100} ok=${r.ok}`);
      cold.push(r);
    }
    for (let i = 0; i < RUNS; i++) {
      console.log(`[bench-intro] PRELOAD run ${i + 1}/${RUNS}…`);
      const r = await runOnce(page, true);
      console.log(`    cockpit-entry=${(r.beatEntries.find((b) => b.beat === 'cockpit')?.ms ?? 0).toFixed(1)}ms max=${r.maxFrameMs.toFixed(1)}ms >50=${r.framesOver50} >100=${r.framesOver100} preload=${(r.preload?.totalMs ?? 0).toFixed(0)}ms ok=${r.ok}`);
      warm.push(r);
    }

    const coldOk = cold.every((r) => r.ok), warmOk = warm.every((r) => r.ok);
    const sCold = summarize('COLD (build-on-entry — the freezes)', cold);
    const sWarm = summarize('PRELOAD (prebuilt + precompiled)', warm);
    printSummary(sCold);
    printSummary(sWarm);

    // The headline: the sum of beat-entry stalls, cold vs warm.
    const sumCold = sCold.perBeat.reduce((a, b) => a + b.ms, 0);
    const sumWarm = sWarm.perBeat.reduce((a, b) => a + b.ms, 0);
    console.log('\n══ HEADLINE ══');
    console.log(`  Σ beat-entry stall:  COLD ${sumCold.toFixed(1)}ms  →  PRELOAD ${sumWarm.toFixed(1)}ms  (${(100 * (1 - sumWarm / Math.max(1e-6, sumCold))).toFixed(0)}% less mid-play stall)`);
    console.log(`  hard freezes >100ms: COLD ${sCold.framesOver100}  →  PRELOAD ${sWarm.framesOver100}`);
    console.log(`  stutters >50ms:      COLD ${sCold.framesOver50}  →  PRELOAD ${sWarm.framesOver50}`);
    console.log(`  runs ok:             cold=${coldOk} preload=${warmOk}`);
    if (!coldOk || !warmOk) { console.log('  [bench-intro] a run reported ok:false — see errors above'); process.exitCode = 1; }
  } finally {
    await browser.close().catch(() => {});
    dev.kill();
  }
}

main().catch((e) => { console.error('[bench-intro] FAILED:', e); process.exit(1); });
