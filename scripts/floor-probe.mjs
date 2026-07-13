// Floor-mesh probe — resolve "is the landed floor a different MESH or just warm-lit grey deck?".
// Drives the intro to each beat, raycasts straight DOWN through the pod floor from the seated
// eye, and prints EVERY mesh hit with its name + material color hex + world Y. Same ray in each
// beat → if the top floor hit is a different mesh/material at 'wake'/'stepOut' vs 'descent',
// there's a stray floor model; if identical, it's lighting.
//
//   node scripts/floor-probe.mjs [--port=5173]

import { chromium } from 'playwright';
const argv = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const PORT = Number(argv.port || 5173);

const browser = await chromium.launch({ args: (process.env.RIG_GL === 'swiftshader' ? ['--enable-webgl', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] : ['--enable-webgl', '--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist']) });
const page = await (await browser.newContext({ viewport: { width: 640, height: 640 } })).newPage();
page.on('console', (m) => { const t = m.text(); if (t.startsWith('[floor]')) console.log(t); });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));

await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => !!(window.__game && window.__game.ctx?.player), { timeout: 45000 });

await page.evaluate(() => {
  const g = window.__game; g.enterGame(true); const c = g.ctx;
  c.input.controls.isLocked = true; c.flags.paused = false;
  g.startIntro();
});

for (const beat of ['descent', 'wake', 'stepOut']) {
  await page.evaluate((b) => { window.__game.jumpToBeat(b); }, beat);
  await page.waitForTimeout(500);
  const report = await page.evaluate((beat) => {
    const THREE = window.THREE || window.__game.THREE;
    const c = window.__game.ctx;
    const cam = c.three.camera;
    // ray straight down from just below the seated eye, through the floor
    const origin = new THREE.Vector3(cam.position.x, cam.position.y, cam.position.z);
    const ray = new THREE.Raycaster(origin, new THREE.Vector3(0, -1, 0), 0.01, 6);
    const meshes = [];
    const walk = (o) => { if (!o) return; if (o.isMesh && o.visible) meshes.push(o); if (o.children) for (const ch of o.children) walk(ch); };
    for (const ch of c.three.scene.children) walk(ch);
    const hits = ray.intersectObjects(meshes, false)
      .filter((h) => h.object.isMesh)
      .slice(0, 6)
      .map((h) => {
        const m = h.object.material;
        const col = (m && m.color) ? m.color.getHexString() : '??';
        return `${h.object.name || '(unnamed)'} y=${h.point.y.toFixed(2)} col=#${col} mat=${m?.type || '?'}`;
      });
    return `[floor] === ${beat} === origin.y=${origin.y.toFixed(2)}\n` + hits.map((h) => '[floor]   ' + h).join('\n');
  }, beat);
  console.log(report);
}

await browser.close();
