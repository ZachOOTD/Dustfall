// Ship-interior shot + Z-FIGHT PROBE harness (playtest-fix loop, 2026-07-07).
// ─────────────────────────────────────────────────────────────────────────────
// The escape-pod intro wedges the preview-MCP screenshotter (WebGL render loop →
// timeouts; see MEMORY dustfall_preview_gotchas). This boots its own headless
// Vite + chromium (swiftshader), force-starts the intro, jumps to a ship beat,
// parks the camera at a named interior VIEW, and:
//   • writes a PNG to verification/ship-<view>.png
//   • (--probe) casts a grid of rays and reports every pair of DIFFERENT meshes
//     sitting at near-equal depth — i.e. the coplanar overlap that z-fights /
//     "clips". Reports each culprit's nearest named ancestor + BoxGeometry
//     params + world position so it's greppable in shipScene.ts.
//
// Sets window.__stageNoMerge=1 pre-boot so the static-merge doesn't collapse the
// greebles into one BufferGeometry (the probe needs individual meshes — same hook
// the in-repo geometry-lint uses, shipScene.ts ~2833).
//
// Usage:
//   node scripts/ship-shot.mjs --view=console
//   node scripts/ship-shot.mjs --view=quarters-door --probe
//   node scripts/ship-shot.mjs --view=console --cam=0.2,1.6,0.6 --look=0,0.7,-1.8
//
//   --view    console | console-lo | quarters-door | quarters-in   (default console)
//   --beat    checkEngines | corridor | cockpit         (default checkEngines)
//   --cam     local x,y,z camera pos (overrides the view preset)
//   --look    local x,y,z look target (overrides the view preset)
//   --probe   run the z-fight raycast grid + print culprit pairs
//   --tag     filename suffix
//   --port    dev port (default 5192)

import { chromium } from 'playwright';
import { spawn, spawnSync } from 'node:child_process';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'verification');
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

const argv = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true];
}));
const PORT = Number(argv.port || 5192);
const VIEW = argv.view || 'console';           // comma-separated list → all captured in ONE boot
const VIEW_LIST = String(VIEW).split(',').map((s) => s.trim()).filter(Boolean);
const BEAT = argv.beat || 'checkEngines';
const PROBE = !!argv.probe;
const TAG = argv.tag ? `-${argv.tag}` : '';
const HIDE = argv.hide ? String(argv.hide).split(',').map((s) => s.trim()).filter(Boolean) : [];   // hide objects whose name contains any of these

// Camera VIEWS in LOCAL ship coords (SHIP_ORIGIN=(0,3000,0) added in-page). Each:
//   cam = eye local pos, look = local aim point. -Z is forward (the window/nose);
//   the crew-quarters door is on the -X corridor wall at local z=9.6.
const VIEWS = {
  'con-sillfloor': { cam: [1.4, 1.5, -0.2],  look: [-0.4, 0.05, -2.3], w: 1400, h: 1050 },   // stand at the right, look DOWN-forward-left at the front/left sill→floor junction (where the user saw a gap into space)
  'airlock-leaf':  { cam: [0.5, 1.5, 5.5],   look: [-0.95, 0.9, 3.4],  w: 1400, h: 1050 },   // from aft-right, look fore-left at the OPEN fore leaf (z≈3.62) against the −X wall (x=−1.0) — the z-fight spot
  'collar-rwall':  { cam: [-1.3, 1.4, 4.8],  look: [-1.05, 1.2, 5.9],  w: 1400, h: 1050 },   // in the collar, look +Z at the right side wall / aft airlock leaf junction (the moiré spot)
  'collar-lwall':  { cam: [-1.3, 1.4, 4.8],  look: [-1.05, 1.2, 3.7],  w: 1400, h: 1050 },   // in the collar, look −Z at the left side wall / fore airlock leaf junction
  'bay-appr':      { cam: [0.2, 1.6, 4.8],   look: [-1.92, 1.15, 4.8], w: 1400, h: 950 },   // from the corridor, looking −X INTO the airlock collar toward the pod door
  'bay-collar':    { cam: [-1.0, 1.55, 4.8], look: [-1.92, 1.2, 4.8],  w: 1400, h: 950 },   // inside the collar mouth, looking down the docking passage at the pod door
  'console':       { cam: [0.25, 1.62, 0.65], look: [0.0, 0.72, -1.7],  w: 1500, h: 950 },
  'console-lo':    { cam: [0.9, 1.35, -0.35], look: [-0.2, 0.6, -1.9],  w: 1400, h: 950 },
  'con-pilot':     { cam: [0.0, 1.33, -0.08], look: [0.0, 0.55, -1.95], w: 1500, h: 950 },   // seated forward-down at the U + dome
  'con-side':      { cam: [1.7, 1.45, 0.5],   look: [0.5, 0.45, -1.7],  w: 1400, h: 1000 },  // from the right — arm + m=+0.5 mullion clearance
  'con-mull':      { cam: [0.4, 1.5, -0.4],   look: [1.4, 0.5, -1.75],  w: 1400, h: 1000 },  // dead-on the right side mullion descent by the arm
  'con-top':       { cam: [0.0, 4.6, -0.9],   look: [0.0, 0.0, -1.0],   w: 1300, h: 1300 },  // TOP-DOWN — console footprint vs the sill ring
  'con-ext-r':     { cam: [3.9, 1.5, -1.5],   look: [0.2, 0.7, -1.6],   w: 1400, h: 1000 },  // EXTERIOR right, looking IN through the glass (catch poke-through)
  'con-ext-f':     { cam: [0.0, 1.3, -4.6],   look: [0.0, 0.7, -1.4],   w: 1400, h: 1000 },  // EXTERIOR front, looking aft through the nose glass
  'con-graze-r':   { cam: [2.6, 0.62, 0.6],   look: [0.2, 0.62, -1.9],  w: 1500, h: 900 },   // sill-level graze down the right glass — silhouette vs the pane
  'con-front-cu':  { cam: [0.0, 0.98, -0.5],  look: [0.0, 0.78, -1.45], w: 1500, h: 1000 },  // close-up on the front console instruments
  'con-rside-cu':  { cam: [0.35, 0.98, -0.45], look: [1.2, 0.75, -1.0], w: 1500, h: 1000 },  // close-up on the right side console
  'con-lside-cu':  { cam: [-0.35, 0.98, -0.45], look: [-1.2, 0.75, -1.0], w: 1500, h: 1000 },// close-up on the left side console
  'con-corner-r':  { cam: [0.15, 1.02, -0.5],  look: [1.0, 0.66, -1.3],  w: 1500, h: 1050 },  // close-up on the front↔right corner join
  'con-corner-l':  { cam: [-0.15, 1.02, -0.5], look: [-1.0, 0.66, -1.3], w: 1500, h: 1050 },  // close-up on the front↔left corner join
  'con-hi':        { cam: [0.0, 1.75, 0.5],    look: [0.0, 0.5, -1.5],   w: 1500, h: 1100 },  // high overview looking down at the whole console
  'con-deck-top':  { cam: [0.0, 1.55, -0.6],   look: [0.0, 0.55, -1.3],  w: 1400, h: 1200 },  // near-top-down on the deck surface
  'con-fold-r':    { cam: [0.9, 1.15, -0.2],   look: [1.5, 0.7, -1.0],   w: 1400, h: 1050 },  // the right fascia fold from the pilot's right
  'con-under-r':   { cam: [0.5, 0.5, 0.2],     look: [1.2, 0.4, -1.2],   w: 1400, h: 1000 },  // low angle — kneewell / under-deck / body corner
  'quarters-door': { cam: [0.55, 1.55, 7.7],  look: [-1.0, 1.15, 9.6],  w: 1200, h: 1300 },
  'quarters-in':   { cam: [0.2, 1.55, 8.4],   look: [-1.6, 1.1, 9.6],   w: 1300, h: 1200 },
  // crew-quarters per-wall framings (room x[-4.1,-1.0] z[8.2,12.0])
  'quarters-aft':  { cam: [-2.4, 1.55, 9.3],  look: [-2.6, 0.75, 12.0], w: 1400, h: 1050 },  // lockers + base cabinet
  'quarters-fore': { cam: [-2.4, 1.55, 10.7], look: [-2.2, 0.7, 8.2],   w: 1400, h: 1050 },  // desk + struts + crate
  'quarters-back': { cam: [-1.5, 1.55, 10.1], look: [-4.1, 1.05, 10.1], w: 1400, h: 1050 },  // bunk alcove back wall + corner box
  // corridor near the crew-quarters door / vent + bollard (on the -X wall)
  'corridor-vent': { cam: [0.4, 1.5, 6.7],    look: [-1.0, 0.7, 7.4],   w: 1300, h: 1100 },
  'corr-bottle':   { cam: [0.55, 1.55, 8.4],  look: [-0.9, 1.0, 11.0],  w: 1400, h: 1050 },  // fire bottle (-X wall z11) + engine bg
  'corr-breaker':  { cam: [-0.55, 1.55, 4.0], look: [0.94, 1.35, 6.4],  w: 1400, h: 1050 },  // breaker box (+X wall z6.4)
  'corr-grille':   { cam: [0.3, 0.95, 9.3],   look: [-0.95, 0.55, 10.7], w: 1300, h: 1000 },  // the small vent grille by the bottle
  'corr-bcvent':   { cam: [0.2, 0.9, 10.3],   look: [-0.83, 0.5, 11.85], w: 1200, h: 1000 },  // aim dead-on the suspected base-cab vent
};

function startDev() {
  const isWin = process.platform === 'win32';
  const proc = spawn(isWin ? 'npm.cmd' : 'npm',
    ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'],
    { cwd: ROOT, shell: isWin, env: { ...process.env, VITE_ESCAPE_POD_INTRO: '1' } });
  let exited = false; proc.on('exit', () => { exited = true; });
  proc.stdout.on('data', () => {}); proc.stderr.on('data', () => {});
  return new Promise((res, rej) => {
    const start = Date.now();
    const tick = async () => {
      if (exited) return rej(new Error('dev exited early'));
      if (Date.now() - start > 30000) { proc.kill(); return rej(new Error('dev not ready in 30s')); }
      try { const r = await fetch(`http://127.0.0.1:${PORT}/`); if (r.ok) return res(proc); } catch {}
      setTimeout(tick, 300);
    };
    tick();
  });
}

// In-page: cast a grid of rays from the camera, find DIFFERENT-mesh pairs whose
// FRONT hits are within EPS metres of each other (coplanar overlap = z-fight).
// Dependency-free: uses Vector3.unproject (on the camera's own vector class) for
// ray dirs + a plain ray/AABB slab test — no THREE.Raycaster needed.
function probeInPage(eps) {
  const t3 = window.__game.ctx.three;
  const scene = t3.scene, cam = t3.camera;
  scene.updateMatrixWorld(true);
  const V = cam.position.constructor;
  const named = (o) => { let p = o; while (p) { if (p.name) return p.name; p = p.parent; } return '(unnamed)'; };
  const sig = (o, box) => {
    const wp = new V(); o.getWorldPosition(wp);
    const g = o.geometry && o.geometry.parameters ? o.geometry.parameters : {};
    const gt = o.geometry ? o.geometry.type : '?';
    const dims = g.width != null ? `${g.width}x${g.height}x${g.depth}`
      : (g.radiusTop != null ? `r${g.radiusTop} h${g.height}` : '');
    return { name: named(o), geo: `${gt} ${dims}`.trim(), wp: [+wp.x.toFixed(3), +wp.y.toFixed(3), +wp.z.toFixed(3)] };
  };
  // Precompute a WORLD AABB per mesh once.
  const items = [];
  scene.traverse((o) => {
    if (!o.isMesh || !o.visible || !o.geometry) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    const bb = o.geometry.boundingBox; if (!bb) return;
    const b = bb.clone().applyMatrix4(o.matrixWorld);   // Box3 → world AABB
    items.push({ o, min: b.min, max: b.max });
  });
  const ro = cam.position;
  const rayBox = (rd, it) => {   // entry distance of the ray into the AABB, or null
    let tmin = -Infinity, tmax = Infinity;
    for (const a of ['x', 'y', 'z']) {
      const inv = 1 / rd[a];
      let t1 = (it.min[a] - ro[a]) * inv, t2 = (it.max[a] - ro[a]) * inv;
      if (t1 > t2) { const s = t1; t1 = t2; t2 = s; }
      if (t1 > tmin) tmin = t1; if (t2 < tmax) tmax = t2;
    }
    if (tmax < Math.max(tmin, 0)) return null;
    return tmin > 0 ? tmin : (tmax > 0 ? tmax : null);
  };
  const pairs = new Map();
  const GX = 60, GY = 44;
  for (let iy = 1; iy < GY; iy++) for (let ix = 1; ix < GX; ix++) {
    const p = new V((ix / GX) * 2 - 1, -((iy / GY) * 2 - 1), 0.5).unproject(cam);
    const rd = p.sub(ro).normalize();
    const hits = [];
    for (const it of items) { const d = rayBox(rd, it); if (d != null) hits.push({ d, it }); }
    hits.sort((a, b) => a.d - b.d);
    for (let k = 0; k < hits.length - 1; k++) {
      const a = hits[k], b = hits[k + 1];
      if (a.it.o === b.it.o) continue;
      if (Math.abs(a.d - b.d) > eps) continue;
      const A = sig(a.it.o), B = sig(b.it.o);
      const key = [`${A.name}|${A.geo}|${A.wp}`, `${B.name}|${B.geo}|${B.wp}`].sort().join('  ⟷  ');
      const at = [+(ro.x + rd.x * a.d).toFixed(2), +(ro.y + rd.y * a.d).toFixed(2), +(ro.z + rd.z * a.d).toFixed(2)];
      const rec = pairs.get(key) || { count: 0, A, B, at };
      rec.count++; pairs.set(key, rec);
    }
  }
  return [...pairs.values()].sort((x, y) => y.count - x.count).slice(0, 16);
}

// Resolve one view name (or the --cam/--look override) → {name, cam, look, W, H}.
function resolveView(name) {
  const v = VIEWS[name];
  if (!v && !(argv.cam && argv.look)) throw new Error(`unknown view "${name}" (${Object.keys(VIEWS).join('|')}) — or pass --cam/--look`);
  return {
    name,
    cam: argv.cam ? String(argv.cam).split(',').map(Number) : v.cam,
    look: argv.look ? String(argv.look).split(',').map(Number) : v.look,
    W: v ? v.w : 1400, H: v ? v.h : 950,
  };
}

async function main() {
  const views = VIEW_LIST.map(resolveView);

  console.log(`[ship-shot] dev on ${PORT}…`);
  const dev = await startDev();
  const browser = await chromium.launch({ args: (process.env.RIG_GL === 'swiftshader' ? ['--enable-webgl', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] : ['--enable-webgl', '--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist']) });
  try {
    const bctx = await browser.newContext({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 1 });
    const page = await bctx.newPage();
    page.on('pageerror', (e) => console.log(`  [page error] ${e.message}`));
    await page.addInitScript((probe) => {
      try { localStorage.setItem('dustfall.tutorial.v1', JSON.stringify({ seenIntro: true, usedItems: [] })); } catch {}
      // Keep greebles individual ONLY when probing (the z-fight probe needs to name
      // each mesh). For plain screenshots, let the static-merge batch them — 10k+
      // unmerged meshes make the swiftshader screenshot capture stall.
      if (probe) window.__stageNoMerge = 1;
      const NativeWS = window.WebSocket;
      window.WebSocket = function (url, protocols) {
        if ((protocols && String(protocols).includes('vite-hmr')) || /vite/.test(String(url)))
          return { addEventListener() {}, removeEventListener() {}, send() {}, close() {}, readyState: 3 };
        return new NativeWS(url, protocols);
      };
      window.WebSocket.prototype = NativeWS.prototype;
    }, PROBE);
    await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!(window.__game && window.__game.ctx?.three?.camera), undefined, { timeout: 45000 });
    console.log(`[ship-shot] starting intro (cockpit beat builds the ship)…`);
    await page.evaluate(() => {
      window.__game.startIntro();        // beat = 'cockpit' — its first tick builds the whole ship
      window.__game.enterGame(false);    // hand off: hide the title overlay, unpause so ticks run
    });
    // The ship (cockpit + corridor + quarters + engine room) is built once by
    // tickCockpit's buildShipScene. Poll for its root group instead of guessing timing.
    await page.waitForFunction(
      () => !!window.__game.ctx.three.scene.getObjectByName('escapePodShipCockpit'),
      undefined, { timeout: 15000 },
    ).catch(() => console.log('[ship-shot] WARN: ship group never appeared'));
    // Optionally advance to a later ship beat (e.g. checkEngines for the alert wash / HUD).
    if (BEAT && BEAT !== 'cockpit') await page.evaluate((b) => window.__game.jumpToBeat(b), BEAT);
    await page.waitForTimeout(500);   // let the beat settle
    // Hide requested objects (e.g. the seat, so it doesn't block console shots).
    if (HIDE.length) {
      const n = await page.evaluate((names) => {
        let c = 0; window.__game.ctx.three.scene.traverse((o) => { if (o.name && names.some((s) => o.name.includes(s))) { o.visible = false; c++; } });
        return c;
      }, HIDE);
      console.log(`[ship-shot] hid ${n} object(s) matching ${HIDE.join(',')}`);
    }
    if (argv.airlock === 'open') {   // slide the airlock leaves apart to the OPEN position (z 3.62 / 5.98)
      await page.evaluate(() => {
        const s = window.__game.ctx.three.scene;
        const L = s.getObjectByName('airlockDoorLeafL'), R = s.getObjectByName('airlockDoorLeafR');
        if (L) L.position.z = 3.62; if (R) R.position.z = 5.98;
      });
      console.log('[ship-shot] airlock slid OPEN');
    }
    // ── Capture each requested view in this ONE boot (park camera → diag → probe → grab canvas).
    for (const view of views) {
      // Park the camera and PAUSE so no tick re-drives it. The ship mesh group
      // ('escapePodShipCockpit') carries the real world transform — map LOCAL view
      // coords through it (localToWorld) so we're origin-agnostic.
      const posOk = await page.evaluate(({ cam, look, W, H }) => {
        const g = window.__game, ctx = g.ctx, c = ctx.three.camera;
        const V = c.position.constructor;
        const ship = ctx.three.scene.getObjectByName('escapePodShipCockpit');
        if (!ship) return false;
        ship.updateMatrixWorld(true);
        ctx.flags.paused = true;
        ctx.three.renderer.setSize(W, H, false);
        if (c.isPerspectiveCamera) { c.aspect = W / H; c.updateProjectionMatrix(); }
        c.position.copy(ship.localToWorld(new V(cam[0], cam[1], cam[2])));
        c.lookAt(ship.localToWorld(new V(look[0], look[1], look[2])));
        c.updateMatrixWorld(true);
        return true;
      }, { cam: view.cam, look: view.look, W: view.W, H: view.H });
      if (!posOk) { console.log(`[ship-shot] WARN: ship group not found — "${view.name}" skipped`); continue; }
      await page.waitForTimeout(200);

      // Center-ray diagnostic — report EVERY box the centre ray enters, sorted by depth (near-equal
      //   entry distances = a coplanar z-fight pair). Reports material colour + dims + world x/z to ID them.
      const diag = await page.evaluate(() => {
        const t3 = window.__game.ctx.three; const c = t3.camera; const V = c.position.constructor;
        const fwd = new V(); c.getWorldDirection(fwd); const ro = c.position;
        const hits = [];
        t3.scene.traverse((o) => {
          if (!o.isMesh || !o.visible || !o.geometry) return;
          if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
          const bb = o.geometry.boundingBox; if (!bb) return;
          const b = bb.clone().applyMatrix4(o.matrixWorld);
          let tmin = -Infinity, tmax = Infinity;
          for (const a of ['x', 'y', 'z']) { const inv = 1 / fwd[a]; let t1 = (b.min[a] - ro[a]) * inv, t2 = (b.max[a] - ro[a]) * inv; if (t1 > t2) { const s = t1; t1 = t2; t2 = s; } if (t1 > tmin) tmin = t1; if (t2 < tmax) tmax = t2; }
          if (tmax >= Math.max(tmin, 0) && tmin > 0) {
            let p = o, nm = ''; while (p) { if (p.name) { nm = p.name; break; } p = p.parent; }
            const wp = new V(); o.getWorldPosition(wp);
            const g = o.geometry.parameters || {}; const dims = g.width != null ? `${(+g.width).toFixed(2)}x${(+g.height).toFixed(2)}x${(+g.depth).toFixed(2)}` : (o.geometry.type);
            const col = (o.material && o.material.color) ? o.material.color.getHexString() : '?';
            hits.push({ d: +tmin.toFixed(3), nm: nm || '(unnamed)', dims, col, wx: +wp.x.toFixed(2), wz: +wp.z.toFixed(2) });
          }
        });
        hits.sort((a, b) => a.d - b.d);
        return { camPos: [+ro.x.toFixed(2), +ro.y.toFixed(2), +ro.z.toFixed(2)], hits: hits.slice(0, 10) };
      });
      console.log(`[diag:${view.name}] cam=${diag.camPos}`);
      for (const h of diag.hits) console.log(`  d=${h.d} #${h.col} ${h.nm} ${h.dims} wx=${h.wx} wz=${h.wz}`);

      if (PROBE) {
        const pairs = await page.evaluate(({ eps, body }) => (new Function('eps', `return (${body})(eps)`))(eps), { eps: 0.006, body: probeBody });
        console.log(`\n[probe:${view.name}] Z-FIGHT PAIRS (front hits within 6mm), most-hit first:`);
        for (const p of pairs) {
          console.log(`  ×${p.count}  @${p.at}`);
          console.log(`     A: ${p.A.name}  ${p.A.geo}  world${p.A.wp}`);
          console.log(`     B: ${p.B.name}  ${p.B.geo}  world${p.B.wp}`);
        }
        if (!pairs.length) console.log('  (none)');
        console.log('');
      }

      // Capture by rendering ONE frame + reading the canvas in the SAME synchronous
      // turn (toDataURL after render → valid drawing buffer even w/o
      // preserveDrawingBuffer). page.screenshot hangs: the rAF loop never signals
      // "stable" to Playwright under swiftshader on this heavy scene.
      const path = join(OUT, `ship-${view.name}${TAG}.png`);
      const dataUrl = await page.evaluate(() => {
        const t = window.__game.ctx.three;
        t.renderer.render(t.scene, t.camera);
        return document.querySelector('canvas').toDataURL('image/png');
      });
      writeFileSync(path, Buffer.from(dataUrl.split(',')[1], 'base64'));
      console.log(`[ship-shot] saved ${path}`);
    }
  } finally {
    await browser.close();
    try {
      if (process.platform === 'win32' && dev.pid) spawnSync('taskkill', ['/pid', String(dev.pid), '/T', '/F'], { stdio: 'ignore' });
      else dev.kill();
    } catch {}
  }
}

// Stringified probe body injected into the page (Function ctor) — keeps the ray
// logic in one place while running in the browser realm.
const probeBody = probeInPage.toString();

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
