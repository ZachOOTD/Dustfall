// Player-rig screenshot harness (ACJ) — Playwright capture for the iteration
// loop, replacing the flaky preview MCP path (see MEMORY: hidden-tab throttling
// + dynamic-import isolation wedged the MCP screenshotter mid-session).
//
// Boots its own Vite dev server on a dedicated port, drives the in-page
// `window.__game.rigStudio()` studio (headless enter + even lighting + framed
// canonical angle — D134/D135), poses the rig, and writes PNGs to verification/.
//
// Usage:
//   node scripts/rig-shot.mjs                              # idle pose, default angles
//   node scripts/rig-shot.mjs --pose=apose --angles=front,3q,head
//   node scripts/rig-shot.mjs --pose=walk --angles=left --tag=knee
//
//   --pose    idle | apose | walk        (default idle)
//   --angles  comma list of front,back,left,right,3q,head  (default front,3q,left,head)
//   --tag     filename tag                (default "shot")
//   --port    dev server port            (default 5191)
//
// Output: verification/rig-<tag>-<pose>-<angle>.png  (one per angle)

import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, mkdirSync } from 'node:fs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'verification');
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

const argv = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  }),
);
const POSE = argv.pose || 'idle';
const ANGLES = String(argv.angles || 'front,3q,left,head').split(',').map((s) => s.trim());
const TAG = argv.tag || 'shot';
const PORT = Number(argv.port || 5191);
const CLOSEUP = argv.closeup || ''; // shoulder|hip|hand|knee|elbow|face — overrides angles
const LIT = argv.lit || '';         // "form" = dramatic key/fill/shadow lighting (rigStudio's flat even light hides all form)

// Close-up targets: frame a joint from the front-side at close range. Offsets
// are [side, up, fwd] in the HEAD's facing frame so framing is consistent
// regardless of the (heading-dependent) spawn orientation.
const CLOSEUPS = {
  shoulder: { joint: 'rig.shoulders[1]', off: [0.30, 0.20, 0.62], look: [0, -0.08, 0] },
  hip:      { joint: 'rig.hips[1]',      off: [0.34, 0.12, 0.66], look: [0, -0.15, 0] },
  hand:     { joint: 'rig.wrists[1]',    off: [0.10, 0.26, 0.55], look: [0, -0.06, 0] },
  knee:     { joint: 'rig.knees[1]',     off: [0.30, 0.08, 0.58], look: [0, -0.05, 0] },
  elbow:    { joint: 'rig.elbows[1]',    off: [0.28, 0.10, 0.50], look: [0, 0, 0] },
  face:     { joint: 'rig.headGroup',    off: [0.11, 0.04, 0.36], look: [0, -0.03, 0] },
  torso:    { joint: 'rig.headGroup',    off: [0.18, -0.45, 1.05], look: [0, -0.62, 0] },
  full:     { joint: 'rig.headGroup',    off: [0.55, -0.55, 2.15], look: [0, -0.92, 0] },     // whole figure, fills the portrait frame
  full3q:   { joint: 'rig.headGroup',    off: [1.25, -0.55, 1.75], look: [0, -0.92, 0] },     // whole figure, 3/4
};

// Pose presets — run inside page.evaluate against window.__game.ctx.player.rig.
// Bones are Object3D, so .rotation.set works identically to the old Groups.
const POSES = {
  idle: `for(const i of [0,1]){ rig.shoulders[i].rotation.set(0.06,0,(i===1?1:-1)*0.05); rig.elbows[i].rotation.x=0.08; rig.wrists[i].rotation.x=-0.12; rig.hips[i].rotation.set(0,0,0); rig.knees[i].rotation.x=0.03; rig.ankles[i].rotation.x=0; }`,
  apose: `for(const i of [0,1]){ rig.shoulders[i].rotation.set(0.20,0,(i===1?1:-1)*0.55); rig.elbows[i].rotation.x=0.22; rig.wrists[i].rotation.x=0; rig.hips[i].rotation.set(0,0,(i===1?1:-1)*0.06); rig.knees[i].rotation.x=0.03; rig.ankles[i].rotation.x=0; }`,
  walk: `rig.hips[1].rotation.x=0.6; rig.knees[1].rotation.x=1.0; rig.ankles[1].rotation.x=0.2; rig.hips[0].rotation.x=-0.25; rig.knees[0].rotation.x=0.10; rig.ankles[0].rotation.x=0; rig.shoulders[1].rotation.set(-0.4,0,0.05); rig.elbows[1].rotation.x=0.5; rig.wrists[1].rotation.x=-0.1; rig.shoulders[0].rotation.set(0.4,0,-0.05); rig.elbows[0].rotation.x=0.3; rig.wrists[0].rotation.x=-0.1;`,
  // Natural relaxed contrapposto — weight on the right leg, left leg eased, pelvis
  // + spine + head counter-tilt, arms hang with a slight elbow bend + small gap.
  relaxed: `rig.hips[1].rotation.set(-0.04,0,0.02); rig.knees[1].rotation.x=0.02; rig.ankles[1].rotation.x=0; rig.hips[0].rotation.set(0.10,0.05,0.03); rig.knees[0].rotation.x=0.20; rig.ankles[0].rotation.x=-0.05; rig.spineBend.rotation.set(0.05,0,-0.05); rig.shoulders[1].rotation.set(0.10,0,0.10); rig.elbows[1].rotation.x=0.22; rig.wrists[1].rotation.x=-0.12; rig.shoulders[0].rotation.set(0.06,0,-0.13); rig.elbows[0].rotation.x=0.30; rig.wrists[0].rotation.x=-0.12; rig.headGroup.rotation.set(0.03,0.12,-0.05);`,
};

function startDev() {
  const isWin = process.platform === 'win32';
  const cmd = isWin ? 'npm.cmd' : 'npm';
  const proc = spawn(cmd, ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'], {
    cwd: ROOT,
    shell: isWin,
  });
  let exited = false;
  proc.on('exit', () => { exited = true; });
  proc.stdout.on('data', () => {});
  proc.stderr.on('data', () => {});
  return new Promise((res, rej) => {
    const start = Date.now();
    const tick = async () => {
      if (exited) return rej(new Error('dev server exited early'));
      if (Date.now() - start > 30000) { proc.kill(); return rej(new Error('dev server not ready in 30s')); }
      try {
        const r = await fetch(`http://127.0.0.1:${PORT}/`);
        if (r.ok) return res(proc);
      } catch {}
      setTimeout(tick, 300);
    };
    tick();
  });
}

// Dramatic key/fill/shadow lighting — rigStudio cranks ambient to 2.2 + exposure
// 2.0 (flat, even, kills all form). For a fair realism read (and a better in-game
// presentation), drop ambient, keep a strong directional sun for shadow/form, and
// lower exposure so highlights don't blow out. Self-shadowing on the rig (chin,
// folds, under the tunic hem) is what makes a 3D form read as solid rather than flat.
async function maybeFormLight(page) {
  if (LIT !== 'form') return;
  await page.evaluate(() => {
    const ctx = window.__game.ctx;
    const scene = ctx.three.scene;
    const cam = ctx.three.camera;
    const V = cam.position.constructor;
    let sun = null;
    scene.traverse((o) => {
      if (!o.isLight) return;
      if (o.type === 'AmbientLight') o.intensity = 0.28;          // low fill → form reads
      else if (o.type === 'HemisphereLight') o.intensity = 0.35;
      else if (o.type === 'DirectionalLight' && o.intensity > 0 && !sun) {
        sun = o;                                                   // KEY
        o.intensity = 3.0;
        o.castShadow = true;
        if (o.shadow) { o.shadow.bias = -0.0004; o.shadow.normalBias = 0.02; }
      }
    });
    // RIM/back light — separates the silhouette from the ground = the single
    // biggest "solid 3D figure" read. Placed behind the figure relative to the
    // camera, up high, cool tint. Created once + repositioned per shot.
    const rig = ctx.player.rig;
    const head = rig.headGroup.getWorldPosition(new V());
    const behind = new V().subVectors(head, cam.position).normalize(); // away from camera
    let rim = scene.getObjectByName('__rimLight');
    if (!rim && sun) { rim = new sun.constructor(0xbfd4ff, 2.2); rim.name = '__rimLight'; scene.add(rim); }
    if (rim) {
      rim.position.set(head.x + behind.x * 4 + 1.5, head.y + 3.5, head.z + behind.z * 4);
      if (rim.target) { rim.target.position.copy(head); rim.target.updateMatrixWorld(true); }
    }
    ctx.three.renderer.shadowMap.enabled = true;
    ctx.three.renderer.toneMappingExposure = 1.05;
  });
  await page.waitForTimeout(250);
}

async function main() {
  if (!POSES[POSE]) throw new Error(`unknown pose "${POSE}" (idle|apose|walk)`);
  console.log(`[rig-shot] starting dev server on ${PORT}…`);
  const dev = await startDev();
  console.log(`[rig-shot] dev up; launching chromium…`);
  const browser = await chromium.launch({
    args: ['--enable-webgl', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
  });
  try {
    const ctx = await browser.newContext({ viewport: { width: 900, height: 1100 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => console.log(`  [page error] ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error') console.log(`  [browser error] ${m.text()}`); });
    await page.goto(`http://127.0.0.1:${PORT}/`);
    // Wait for the rig to exist (Rapier WASM + boot done).
    await page.waitForFunction(() => !!(window.__game && window.__game.ctx?.player?.rig), undefined, { timeout: 30000 });
    // Enter the studio (headless enter + lighting + unpause), let a frame settle
    // the rig at the player, then pause + pose.
    await page.evaluate(() => window.__game.rigStudio());
    await page.waitForTimeout(700);
    await page.evaluate((poseCode) => {
      const g = window.__game;
      const rig = g.ctx.player.rig;
      g.ctx.flags.paused = true;
      // eslint-disable-next-line no-eval
      eval(poseCode);
      rig.group.updateMatrixWorld(true);
    }, POSES[POSE]);
    if (CLOSEUP) {
      const spec = CLOSEUPS[CLOSEUP];
      if (!spec) throw new Error(`unknown closeup "${CLOSEUP}" (${Object.keys(CLOSEUPS).join('|')})`);
      await page.evaluate(({ jointExpr, off, look }) => {
        const g = window.__game;
        const rig = g.ctx.player.rig;
        const cam = g.ctx.three.camera;
        const V = cam.position.constructor;
        g.ctx.flags.paused = true;
        // eslint-disable-next-line no-eval
        const joint = eval(jointExpr);
        const jp = joint.getWorldPosition(new V());
        const fz = rig.headGroup.getWorldDirection(new V()); fz.y = 0; fz.normalize();
        const side = new V(-fz.z, 0, fz.x);
        cam.position.set(
          jp.x + side.x * off[0] + fz.x * off[2],
          jp.y + off[1],
          jp.z + side.z * off[0] + fz.z * off[2],
        );
        cam.lookAt(jp.x + look[0], jp.y + look[1], jp.z + look[2]);
        cam.updateMatrixWorld(true);
      }, { jointExpr: spec.joint, off: spec.off, look: spec.look });
      await page.waitForTimeout(350);
      await maybeFormLight(page);
      const path = join(OUT, `rig-${TAG}-${POSE}-closeup-${CLOSEUP}${LIT ? '-' + LIT : ''}.png`);
      await page.screenshot({ path, fullPage: false });
      console.log(`[rig-shot] saved ${path}`);
    } else {
      for (const angle of ANGLES) {
        await page.evaluate((a) => window.__game.rigStudio(a), angle);
        await page.waitForTimeout(350);
        await maybeFormLight(page);
        const path = join(OUT, `rig-${TAG}-${POSE}-${angle}${LIT ? '-' + LIT : ''}.png`);
        await page.screenshot({ path, fullPage: false });
        console.log(`[rig-shot] saved ${path}`);
      }
    }
  } finally {
    await browser.close();
    try { dev.kill(); } catch {}
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
