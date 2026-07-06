// Phase-parity strip for the ONE-POD ask (Z6). Builds the RIDE cabin ONCE (buildPodOrbit)
// and drives the EXACT per-phase light states from a FIXED seated vantage, capturing +
// measuring luminance ATOMICALLY (drive+seat+render+read+encode in one eval so the paused
// RAF can't overwrite the buffer between steps). Same cabin build => geometry/material parity
// is inherent; only the legitimate light states differ.
//
//   node scripts/pod-parity.mjs [--port=5191] [--look=deck|level]
//
// Output: shot-out/pod-parity/parity-<phase>.png + a luminance table.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'shot-out', 'pod-parity');
mkdirSync(OUT, { recursive: true });

const argv = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true];
}));
const PORT = Number(argv.port || 5191);
const LOOK = argv.look || 'deck';
const W = 900, H = 900;

const browser = await chromium.launch({ args: ['--enable-webgl', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
const bctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const page = await bctx.newPage();
page.on('console', (m) => { const t = m.text(); if (t.startsWith('[parity]')) console.log(t); });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));

await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => !!(window.__game && window.__game.ctx?.player), { timeout: 45000 });

await page.evaluate(() => {
  const g = window.__game;
  g.enterGame(true);
  const ctx = g.ctx;
  ctx.input.controls.isLocked = true;
  ctx.three.renderer.setSize(900, 900, false);
  const cam = ctx.three.camera;
  if (cam.isPerspectiveCamera) { cam.aspect = 1; cam.updateProjectionMatrix(); }
  g.startIntro();
  g.buildPodOrbit();
  ctx.flags.paused = true;
});
await page.waitForTimeout(300);

// Atomic drive+seat+render+read+encode. `drive` is a JS snippet run first (sets the light state).
// Returns { deck, wall, vp, png } — png is a base64 dataURL of the frame we just rendered.
function SHOOT_EVAL(driveSnippet, look) {
  return `() => {
   try {
    const c = window.__game.ctx;
    (${driveSnippet})();
    const s = window.__game.getPodSpawn();
    const cam = c.three.camera;
    cam.position.set(s.x, s.y, s.z);
    ${look === 'level'
      ? `cam.lookAt(s.x, s.y - 0.25, s.z - 2.0);`
      : `cam.lookAt(s.x, s.y - 1.4, s.z - 0.35);`}
    cam.updateMatrixWorld(true);
    const r = c.three.renderer;
    r.render(c.three.scene, cam);
    const gl = r.getContext();
    const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
    const px = new Uint8Array(w*h*4);
    gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,px);
    function reg(x0,y0,x1,y1){ let sl=0,sr=0,sg=0,sb=0,n=0;
      const ix0=(x0*w)|0, ix1=(x1*w)|0, iyTop=(y0*h)|0, iyBot=(y1*h)|0;
      for(let y=iyTop;y<iyBot;y++){ const yy=h-1-y;
        for(let x=ix0;x<ix1;x++){ const i=(yy*w+x)*4; const rr=px[i],gg=px[i+1],bb=px[i+2];
          sl+=0.2126*rr+0.7152*gg+0.0722*bb; sr+=rr; sg+=gg; sb+=bb; n++; } }
      return { lum:+(sl/n).toFixed(1), r:+(sr/n).toFixed(0), g:+(sg/n).toFixed(0), b:+(sb/n).toFixed(0) };
    }
    const deck = reg(0.30,0.40,0.70,0.80);   // floor
    const wall = reg(0.15,0.06,0.85,0.30);   // lower wall / liner band
    const vp   = reg(0.42,0.30,0.58,0.55);   // centre column (porthole / forward arc)
    const png  = r.domElement.toDataURL('image/png');
    return { deck, wall, vp, png };
   } catch(e){ return { err:String(e&&e.message||e) }; }
  }`;
}

const rows = [];
async function shoot(tag, driveSnippet) {
  const res = (await page.evaluate(`(${SHOOT_EVAL(driveSnippet, LOOK)})()`)) || {};
  if (res.err) { console.log(`[parity] ${tag} ERR: ${res.err}`); return; }
  const b64 = res.png.replace(/^data:image\/png;base64,/, '');
  writeFileSync(join(OUT, `parity-${tag}.png`), Buffer.from(b64, 'base64'));
  rows.push({ tag, ...res });
  const c = (o) => `L${String(o.lum).padStart(6)}(${o.r},${o.g},${o.b})`;
  console.log(`[parity] ${tag.padEnd(22)} deck=${c(res.deck).padEnd(20)} wall=${c(res.wall).padEnd(20)} vp=${c(res.vp)}`);
}

// ── RECEDE light states (setTumbleLight, exactly as tickShipExplode drives them) ──
await shoot('R-recede-preblast',   `() => window.__game.setTumbleLight(0.08)`);
await shoot('R-recede-mid',        `() => window.__game.setTumbleLight(0.03)`);
await shoot('R-recede-settled',    `() => window.__game.setTumbleLight(0.0)`);
await shoot('R-recede-blastpeak',  `() => window.__game.setTumbleLight(1.0)`);
await shoot('R-recede-blastdecay', `() => window.__game.setTumbleLight(0.45)`);

// ── DESCENT light states (setDescentProgress) ──
for (const p of [0.0, 0.15, 0.5, 0.9]) {
  await shoot(`D-descent-p${String(p).replace('.','')}`, `() => window.__game.setDescentProgress(${p})`);
}

// ── LANDED / WAKE light state (setCabinCrashPose 1 → the warm-lamp wake lighting) ──
// First ground the descent (setDescentProgress(1)) so the crash pose settles the interior,
// then drive the wake pose. This is the SAME cabin, lit by the wake rig (warm lamp + door spill,
// global fill zeroed). Answers delta #3 (landed floor) directly.
await shoot('L-landed-wake', `() => { window.__game.setDescentProgress(1); window.__game.setCabinCrashPose(1); }`);

console.log('[parity] ===== TABLE (deck/wall/vp luminance + mean rgb, 0-255) =====');
for (const r of rows) {
  const c = (o) => `L${String(o.lum).padStart(6)}(${o.r},${o.g},${o.b})`;
  console.log(`[parity] ${r.tag.padEnd(22)} deck=${c(r.deck).padEnd(20)} wall=${c(r.wall).padEnd(20)} vp=${c(r.vp)}`);
}
await browser.close();
