// REAL descent repro (Z6 delta #2). Drives the actual descent beat LIVE (loop ticking), letting
// updateEscapePodIntro drive the camera + pod fall + FX exactly as the player sees it. Captures a
// strip while the pod FALLS (progress advancing), so any fast-moving in-cabin light texture that
// only manifests under real motion is caught. The intro owns the camera; we only read the buffer.
//
//   node scripts/pod-descent-live.mjs [--port=5191]

import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'shot-out', 'pod-parity');
mkdirSync(OUT, { recursive: true });
const argv = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const PORT = Number(argv.port || 5191);

const browser = await chromium.launch({ args: (process.env.RIG_GL === 'swiftshader' ? ['--enable-webgl', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] : ['--enable-webgl', '--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist']) });
const page = await (await browser.newContext({ viewport: { width: 900, height: 900 } })).newPage();
page.on('console', (m) => { const t = m.text(); if (t.startsWith('[live]')) console.log(t); });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));

await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => !!(window.__game && window.__game.ctx?.player), { timeout: 45000 });
await page.evaluate(() => {
  const g = window.__game; g.enterGame(true); const c = g.ctx;
  c.input.controls.isLocked = true; c.flags.paused = false;
  c.three.renderer.setSize(900, 900, false);
  const cam = c.three.camera; if (cam.isPerspectiveCamera) { cam.aspect = 1; cam.updateProjectionMatrix(); }
  g.startIntro();
  g.jumpToBeat('descent');   // sets the descent base + ensureInPod + seats the player
});
await page.waitForTimeout(600);

// Read a tight porthole-ring + wall sample so a fast per-frame in-cabin motion is measurable, then
// screenshot the LIVE buffer. We DON'T touch the camera (the intro drives it — faithful).
const READ = `() => {
  const c = window.__game.ctx;
  const gl = c.three.renderer.getContext();
  const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
  const px = new Uint8Array(w*h*4); gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,px);
  function reg(x0,y0,x1,y1){ let sl=0,n=0; const ix0=(x0*w)|0,ix1=(x1*w)|0,iyt=(y0*h)|0,iyb=(y1*h)|0;
    for(let y=iyt;y<iyb;y++){const yy=h-1-y;for(let x=ix0;x<ix1;x++){const i=(yy*w+x)*4;sl+=0.2126*px[i]+0.7152*px[i+1]+0.0722*px[i+2];n++;}} return +(sl/n).toFixed(1); }
  return { alt:+window.__game.ctx.intro?.beat, port:reg(0.40,0.28,0.60,0.60), ringL:reg(0.28,0.28,0.38,0.55), ringR:reg(0.62,0.28,0.72,0.55),
           wallL:reg(0.08,0.30,0.28,0.60), deck:reg(0.30,0.72,0.70,0.95) };
}`;

// Drive the descent progress forward across the fall, capturing a strip.
const N = 14;
for (let i = 0; i < N; i++) {
  const p = 0.06 + (0.62 * i) / (N - 1);   // 0.06 .. 0.68 (through the re-entry window)
  await page.evaluate((pp) => window.__game.setDescentProgress(pp), p);
  await page.waitForTimeout(90);
  const m = (await page.evaluate(`(${READ})()`)) || {port:-1,ringL:-1,ringR:-1,wallL:-1,deck:-1};
  await page.screenshot({ path: join(OUT, `descent-live-f${String(i).padStart(2,'0')}.png`), animations: 'disabled', timeout: 60000 });
  console.log(`[live] f${String(i).padStart(2,'0')} p=${p.toFixed(2)}  port=${m.port} ringL=${m.ringL} ringR=${m.ringR} wallL=${m.wallL} deck=${m.deck}`);
}
await browser.close();
