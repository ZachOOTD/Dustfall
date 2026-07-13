// Descent light-streak repro (Z6 delta #2). Builds the ride cabin, drives setDescentProgress
// across the re-entry window, capturing a TIME-STRIP at a fixed progress (to catch fast per-frame
// motion) AND across progress values. Frames the porthole/forward arc (where re-entry plasma +
// shimmer render) so any fast-moving light texture bleeding inside is visible.
//
//   node scripts/pod-descent-strip.mjs [--port=5191] [--p=0.28] [--frames=8]

import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'shot-out', 'pod-parity');
mkdirSync(OUT, { recursive: true });
const argv = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const PORT = Number(argv.port || 5191);
const PFIX = Number(argv.p || 0.28);   // re-entry peak is ~0.24; hold here for the time-strip
const FRAMES = Number(argv.frames || 8);

const browser = await chromium.launch({ args: (process.env.RIG_GL === 'swiftshader' ? ['--enable-webgl', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] : ['--enable-webgl', '--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist']) });
const page = await (await browser.newContext({ viewport: { width: 900, height: 900 } })).newPage();
page.on('console', (m) => { const t = m.text(); if (t.startsWith('[strip]')) console.log(t); });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));

await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => !!(window.__game && window.__game.ctx?.player), { timeout: 45000 });
await page.evaluate(() => {
  const g = window.__game; g.enterGame(true); const c = g.ctx;
  c.input.controls.isLocked = true; c.three.renderer.setSize(900, 900, false);
  const cam = c.three.camera; if (cam.isPerspectiveCamera) { cam.aspect = 1; cam.updateProjectionMatrix(); }
  g.startIntro(); g.buildPodOrbit(); c.flags.paused = true;
});
await page.waitForTimeout(300);

// Render frame: set progress, advance the FX animation clock (performance.now drives uTime), seat
// the camera LEVEL at the porthole (so plasma/shimmer INSIDE the cabin would show), read + encode.
// Also report the plasma/shimmer mesh visibility + a porthole-region luminance so per-frame motion
// is measurable.
function FRAME_EVAL(progress) {
  return `() => {
   try {
    const c = window.__game.ctx;
    window.__game.setDescentProgress(${progress});
    const s = window.__game.getPodSpawn();
    const cam = c.three.camera;
    cam.position.set(s.x, s.y, s.z);
    cam.lookAt(s.x, s.y - 0.10, s.z - 2.0);   // LEVEL, straight at the porthole/forward arc
    cam.updateMatrixWorld(true);
    const r = c.three.renderer; r.render(c.three.scene, cam);
    const gl = r.getContext(); const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
    const px = new Uint8Array(w*h*4); gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,px);
    function reg(x0,y0,x1,y1){ let sl=0,n=0; const ix0=(x0*w)|0,ix1=(x1*w)|0,iyt=(y0*h)|0,iyb=(y1*h)|0;
      for(let y=iyt;y<iyb;y++){const yy=h-1-y;for(let x=ix0;x<ix1;x++){const i=(yy*w+x)*4;sl+=0.2126*px[i]+0.7152*px[i+1]+0.0722*px[i+2];n++;}} return +(sl/n).toFixed(1); }
    // porthole column + the DOOR-FACE ring immediately around it (where a plasma bleed would land)
    // + the far wall bands (a bleed there would be a big occlusion failure).
    const port = reg(0.40,0.28,0.60,0.60);
    const ringL = reg(0.30,0.28,0.38,0.55);   // door face just LEFT of the porthole
    const ringR = reg(0.62,0.28,0.70,0.55);   // door face just RIGHT of the porthole
    const ringT = reg(0.40,0.06,0.60,0.16);   // door face just ABOVE the porthole
    const wallBandL = reg(0.10,0.35,0.30,0.55);
    const png = r.domElement.toDataURL('image/png');
    return { port, ringL, ringR, ringT, wallBandL, png };
   } catch(e){ return { err:String(e&&e.message||e) }; }
  }`;
}

// TIME-STRIP at fixed progress (catches fast per-frame motion — the "moving super fast" complaint).
console.log('[strip] === TIME-STRIP at p=' + PFIX + ' (fixed altitude; watch for per-frame motion) ===');
for (let i = 0; i < FRAMES; i++) {
  const res = await page.evaluate(`(${FRAME_EVAL(PFIX)})()`);
  if (res.err) { console.log('[strip] ERR', res.err); break; }
  writeFileSync(join(OUT, `descent-time-f${String(i).padStart(2,'0')}.png`), Buffer.from(res.png.replace(/^data:image\/png;base64,/, ''), 'base64'));
  console.log(`[strip] time f${i}  port=${res.port} ringL=${res.ringL} ringR=${res.ringR} ringT=${res.ringT} wallL=${res.wallBandL}`);
  await page.waitForTimeout(120);   // real wall-clock so performance.now (uTime) advances between frames
}

// ALTITUDE-STRIP across the re-entry window.
console.log('[strip] === ALTITUDE-STRIP across the re-entry window ===');
for (const p of [0.10, 0.18, 0.24, 0.30, 0.40, 0.55]) {
  const res = await page.evaluate(`(${FRAME_EVAL(p)})()`);
  if (res.err) { console.log('[strip] ERR', res.err); break; }
  writeFileSync(join(OUT, `descent-alt-p${String(p).replace('.','')}.png`), Buffer.from(res.png.replace(/^data:image\/png;base64,/, ''), 'base64'));
  console.log(`[strip] alt p${p}  port=${res.port} ringL=${res.ringL} ringR=${res.ringR} ringT=${res.ringT} wallL=${res.wallBandL}`);
}
await browser.close();
