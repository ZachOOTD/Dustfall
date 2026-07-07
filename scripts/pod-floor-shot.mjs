// Look straight DOWN at the pod deck (descent beat) to see what the "streaks on the floor" are.
//   node scripts/pod-floor-shot.mjs [--port=5173] [--tag=x]
import { writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
const argv = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const PORT = Number(argv.port || 5173), TAG = argv.tag || 'floor';

const browser = await chromium.launch({ args: ['--enable-webgl', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
const page = await (await browser.newContext({ viewport: { width: 1100, height: 1100 } })).newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => !!(window.__game && window.__game.ctx?.player), { timeout: 45000 });
await page.evaluate(() => { const g = window.__game; g.enterGame(true); g.ctx.input.controls.isLocked = true; g.ctx.flags.paused = false; g.startIntro(); });
await page.evaluate(() => window.__game.jumpToBeat('descent'));
await page.waitForTimeout(500);
// pause the loop so the intro can't re-grab the camera, aim (floor=down, eject=left wall), render, capture.
const VIEW = argv.view || 'floor';
const dataUrl = await page.evaluate((view) => {
  const c = window.__game.ctx; const t = c.three; c.flags.paused = true;
  const cam = t.camera; const p = cam.position.clone();
  if (view === 'eject') {               // look LEFT + a touch down at the −X wall (the eject handle)
    cam.position.set(p.x + 0.2, p.y - 0.05, p.z + 0.1);
    cam.up.set(0, 1, 0);
    cam.lookAt(p.x - 2.0, p.y - 0.35, p.z - 0.4);
  } else {                              // floor: straight down
    cam.position.set(p.x, p.y + 0.35, p.z - 0.1);
    cam.up.set(0, 0, -1);
    cam.lookAt(p.x, p.y - 2.0, p.z - 0.1);
  }
  cam.updateMatrixWorld(true);
  t.renderer.render(t.scene, cam);
  return t.renderer.domElement.toDataURL('image/png');
}, VIEW);
writeFileSync(`verification/pod-${TAG}.png`, Buffer.from(dataUrl.split(',')[1], 'base64'));
console.log(`[floor-shot] saved verification/pod-${TAG}.png`);
await browser.close();
