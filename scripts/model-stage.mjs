// MODEL STAGE + GEOMETRY LINT (Y5) — standalone model-quality tooling.
//
// Rides the rig-shot harness pattern (own Vite dev server + Playwright chromium
// + page.evaluate driving window.__game) but stages a SINGLE BUILDER's output
// alone in a neutral studio (dark grid floor, 3-point white lighting, camera
// auto-framed from the model's bounding sphere), shoots a 12-angle turntable,
// and runs an automated GEOMETRY LINT (floaters / z-fight pairs / floor
// penetration / out-of-envelope orphans) over the mounted meshes.
//
// ZERO game-source changes: everything here is injected via page.evaluate.
//
// Usage:
//   node scripts/model-stage.mjs --module=src/world/escapePodIntro/podScene.ts --builder=buildCanonicalPodExterior
//   node scripts/model-stage.mjs --module=... --builder=... --args='{"door":"closed"}' --closeups=canonicalPodDoor
//   node scripts/model-stage.mjs --module=... --builder=... --lint-only
//   node scripts/model-stage.mjs --test-mode          # synthetic defect rig — proves the detectors catch
//
//   --module    path to the builder's module (src/... — normalized to a Vite URL)
//   --builder   named export to call. Handles: fn(): Group | fn(): {root: Group}
//               | fn(ctx): void that adds to the scene (scene-diff adoption).
//   --args      JSON for the builder's arg(s). Array = spread; object = single arg.
//               Without it: fn.length>=1 → called with window.__game.ctx.
//   --closeups  comma list of child-object NAMES to frame individually.
//   --lint-only skip the turntable, just mount + lint.
//   --test-mode mount a synthetic defect rig (floating sphere + coplanar decal
//               pair + sunk bar) and ASSERT the lint catches each class.
//   --floor     auto|origin|none (default auto): where the stage floor plane sits.
//               origin → y=0 is the authored ground (penetration check active);
//               auto → origin if bbox.min.y is near 0, else the grid drops to
//               bbox.min.y and the penetration check is n/a.
//   --port      dev server port (default 5195 — 5191/5192/5194 are owned by siblings)
//
// Output:  verification/stage/<builder>-<angle>.png   (+ a one-line manifest)
// Lint:    a `[model-lint] {...}` JSON line. Exit 1 if floaters or penetrations
//          exist (z-fights are WARN-ONLY: coplanar shared-material decals can
//          false-positive; abutting seam tris are damped but not impossible).

import { chromium } from 'playwright';
import { spawn, spawnSync } from 'node:child_process';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, mkdirSync } from 'node:fs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'verification', 'stage');
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

const argv = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  }),
);
const PORT = Number(argv.port || 5195);
const TEST_MODE = !!argv['test-mode'];
const LINT_ONLY = !!argv['lint-only'];
const MODULE = argv.module || '';
const BUILDER = argv.builder || '';
const ARGS_JSON = typeof argv.args === 'string' ? argv.args : null;
const CLOSEUPS = typeof argv.closeups === 'string' ? argv.closeups.split(',').map((s) => s.trim()).filter(Boolean) : [];
const FLOOR = argv.floor || 'auto';

if (!TEST_MODE && (!MODULE || !BUILDER)) {
  console.error('[model-stage] need --module=<path> --builder=<exportName> (or --test-mode). See the header comment.');
  process.exit(1);
}

/** Normalize any path spelling (windows backslashes, no leading slash, absolute) to a Vite URL. */
function toViteUrl(p) {
  let s = String(p).replace(/\\/g, '/');
  const i = s.indexOf('src/');
  if (i >= 0) s = '/' + s.slice(i);
  if (!s.startsWith('/')) s = '/' + s;
  return s;
}

// Lint thresholds — documented in docs/model-stage.md.
const LINT_PARAMS = {
  tol: 0.015,          // floater connectivity: AABB gap tolerance (1.5cm total)
  zfightDist: 0.0015,  // near-coplanar plane separation < 1.5mm
  zfightDot: 0.999,    // SIGNED normal-dot threshold (same-facing only; opposing = butted solids, culled faces)
  overlapMul: 0.5,     // in-plane centroid distance < mul*(rA+rB) → "overlapping" (0.5 damps abutting seams)
  minPairHits: 2,      // pairs with 1 grazing sample are counted but not reported
  penDepth: 0.0105,    // floor dip > 1.05cm (the 0.5mm guard absorbs FP epsilon on authored 1cm-flush parts)
  envelopeMul: 1.2,    // orphan: mesh AABB centre beyond 1.2× the MAIN component's bounding sphere
  triCapPerMesh: 160,  // z-fight triangle samples per mesh (stride-sampled)
  pairBudget: 400000,  // total tri-pair comparisons cap (honesty: reported as counts.capped)
};

// 12-shot turntable: 8 orbit @45° (el 12°) + 2 top-3/4 + 1 under-3/4 + 1 tight hero front.
const SHOTS = [];
for (let i = 0; i < 8; i++) SHOTS.push({ name: `orbit-${String(i * 45).padStart(3, '0')}`, az: i * 45, el: 12 });
SHOTS.push({ name: 'top34-045', az: 45, el: 42 });
SHOTS.push({ name: 'top34-225', az: 225, el: 42 });
SHOTS.push({ name: 'under34-135', az: 135, el: -28 });
SHOTS.push({ name: 'hero-front', az: 20, el: 8, distMul: 0.85 });

// ─────────────────────────────────────────────────────────────────────────────
// In-page library — installed once via page.evaluate. Everything below runs in
// the BROWSER. No game-source edits: it hides the world scene, mounts the model
// in a studio wrapper, frames the game camera, and lints the staged meshes.
// ─────────────────────────────────────────────────────────────────────────────
async function installStageLib() {
  if (window.__stageLib) return true;
  const lib = {};

  /** Dynamic import that survives evaluate contexts (direct import() first, script-tag fallback). */
  lib.dynImport = async (url) => {
    try {
      // eslint-disable-next-line no-eval
      return await (0, eval)(`import(${JSON.stringify(url)})`);
    } catch (e) {
      if (e && /module|import/i.test(String(e.message)) === false) throw e; // real module error → surface
      // fallback: a real <script type=module> shim
      return await new Promise((res, rej) => {
        const key = '__mi_' + Math.random().toString(36).slice(2);
        const s = document.createElement('script');
        s.type = 'module';
        s.textContent = `import * as m from ${JSON.stringify(url)}; window[${JSON.stringify(key)}] = m; window.dispatchEvent(new Event(${JSON.stringify(key)}));`;
        const t = setTimeout(() => { cleanup(); rej(new Error('module import timed out: ' + url)); }, 20000);
        const onEvt = () => { const m = window[key]; cleanup(); res(m); };
        function cleanup() { clearTimeout(t); window.removeEventListener(key, onEvt); s.remove(); delete window[key]; }
        window.addEventListener(key, onEvt);
        document.head.appendChild(s);
      });
    }
  };

  /** Get the game's OWN three instance (Vite pre-bundled dep URL sniffed from a
   *  transformed module — a second three copy would break module-identity paths;
   *  see MEMORY: dynamic-import module isolation). */
  lib.getTHREE = async (hintUrl) => {
    if (window.__stageTHREE) return window.__stageTHREE;
    const candidates = [hintUrl, '/src/main.ts', '/src/world/escapePodIntro/podScene.ts'].filter(Boolean);
    for (const c of candidates) {
      try {
        const txt = await (await fetch(c)).text();
        const m = txt.match(/["'](\/[^"']*\/deps\/three\.js\?v=[^"']+)["']/);
        if (m) { window.__stageTHREE = await lib.dynImport(m[1]); window.__stageTHREEUrl = m[1]; return window.__stageTHREE; }
      } catch { /* try next */ }
    }
    console.warn('[model-stage] falling back to a SECOND three instance (deps URL not found)');
    window.__stageTHREE = await lib.dynImport('/node_modules/three/build/three.module.js');
    return window.__stageTHREE;
  };

  /** Hide every DOM overlay that isn't an ancestor of the canvas (HUD, prompts, vignettes). */
  lib.hideDomOverlays = () => {
    const ctx = window.__game.ctx;
    let n = ctx.three.renderer.domElement;
    while (n && n !== document.body && n.parentElement) {
      const p = n.parentElement;
      for (const sib of p.children) if (sib !== n && sib.style) sib.style.visibility = 'hidden';
      n = p;
    }
  };

  /** Build the studio around an already-chosen model root: hide the world,
   *  neutral background, grid floor + shadow plane + 3-point light, camera prep. */
  lib.buildStudio = async (root, opts) => {
    const g = window.__game; const ctx = g.ctx;
    const THREE = await lib.getTHREE(opts.hintUrl);
    const scene = ctx.three.scene;

    // Freeze the sim + hide the whole world (render loop keeps drawing — loop.ts
    // renders unconditionally; pause only gates the tick systems).
    ctx.flags.paused = true;
    if (ctx.player && ctx.player.viewModel) ctx.player.viewModel.group.visible = false; // 2nd render pass
    for (const c of [...scene.children]) c.visible = false;
    scene.background = new THREE.Color(0x11141a);
    scene.fog = null;
    scene.environment = null;
    lib.hideDomOverlays();

    const stage = new THREE.Group();
    stage.name = '__modelStage';
    stage.add(root);
    root.updateMatrixWorld(true);

    // VISIBLE-only bounding box (matches the lint's walk) — builders often carry
    // hidden FX shells (e.g. a 70m explosion disc built inert) that would blow up
    // the framing + floor placement if measured.
    const box = new THREE.Box3();
    (function walk(o, vis) {
      const v = vis && o.visible !== false;
      if (o.isMesh && v && o.geometry && o.geometry.attributes && o.geometry.attributes.position) {
        if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
        const b = new THREE.Box3().copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld);
        if (isFinite(b.min.x) && isFinite(b.max.x)) box.union(b);
      }
      for (const cc of o.children) walk(cc, v);
    })(root, true);
    if (box.isEmpty() || !isFinite(box.min.x)) return { skip: 'model has no measurable VISIBLE geometry (empty bounding box)' };
    const size = box.getSize(new THREE.Vector3());
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    const r = Math.max(sphere.radius, 0.25);

    // Floor placement: origin mode (authored ground at y=0 → penetration check
    // active) vs bbox mode (free-floating model → grid drops to bbox.min.y).
    let floorMode;
    if (opts.floor === 'origin') floorMode = 'origin';
    else if (opts.floor === 'none') floorMode = 'none';
    else floorMode = Math.abs(box.min.y) <= Math.max(0.15 * size.y, 0.05) ? 'origin' : 'bbox';
    const floorY = floorMode === 'origin' ? 0 : box.min.y;

    // Grid + single-sided shadow plane (FrontSide up → invisible from the underside shot).
    const gsize = Math.max(4, Math.ceil(r * 4));
    const grid = new THREE.GridHelper(gsize, Math.min(40, gsize * 2), 0x3a4148, 0x23272c);
    grid.position.set(sphere.center.x, floorY + 0.002, sphere.center.z);
    stage.add(grid);
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(gsize * 1.4, gsize * 1.4),
      new THREE.MeshStandardMaterial({ color: 0x191d21, roughness: 0.95, metalness: 0 }),
    );
    plane.rotation.x = -Math.PI / 2;
    plane.position.set(sphere.center.x, floorY - 0.001, sphere.center.z);
    plane.receiveShadow = true;
    plane.name = '__stageFloor';
    stage.add(plane);

    // 3-point neutral studio light: KEY (shadowed) / FILL / RIM + low ambient.
    const c = sphere.center;
    const key = new THREE.DirectionalLight(0xffffff, 2.4);
    key.position.set(c.x + r * 2.2, c.y + r * 2.6, c.z + r * 2.2);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = key.shadow.camera.bottom = -r * 1.8;
    key.shadow.camera.right = key.shadow.camera.top = r * 1.8;
    key.shadow.camera.near = 0.1;
    key.shadow.camera.far = r * 12;
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.02;
    const fill = new THREE.DirectionalLight(0xffffff, 0.8);
    fill.position.set(c.x - r * 2.6, c.y + r * 0.8, c.z + r * 1.4);
    const rim = new THREE.DirectionalLight(0xffffff, 1.4);
    rim.position.set(c.x - r * 1.2, c.y + r * 2.2, c.z - r * 2.6);
    const amb = new THREE.AmbientLight(0xffffff, 0.4);
    for (const l of [key, fill, rim]) { stage.add(l); stage.add(l.target); l.target.position.copy(c); }
    stage.add(amb);

    // Studio material state: shadows on, neutral exposure.
    let meshCount = 0;
    root.traverse((o) => {
      if (o.isMesh) {
        meshCount++;
        o.castShadow = true;
        o.receiveShadow = true;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) if (m) m.needsUpdate = true;
      }
    });
    ctx.three.renderer.shadowMap.enabled = true;
    // CRITICAL: the game runs shadowMap.autoUpdate=false (shadows render on a
    // cadence inside updateLighting — which is PAUSED here). Without forcing an
    // update, the key light's shadow map never renders and the stale shadow
    // state blanks EVERY lit draw (found empirically: whole stage black).
    ctx.three.renderer.shadowMap.needsUpdate = true;
    ctx.three.renderer.toneMappingExposure = 1.0;
    ctx.three.renderer.setSize(1100, 1100, false);
    const cam = ctx.three.camera;
    cam.aspect = 1;
    cam.fov = 40;
    cam.near = 0.02;
    cam.far = Math.max(cam.far, r * 40);
    cam.updateProjectionMatrix();

    scene.add(stage);
    stage.updateMatrixWorld(true);
    window.__modelStage = {
      THREE, stage, root, floorMode, floorY,
      center: { x: c.x, y: c.y, z: c.z }, radius: r,
    };
    return {
      meshCount,
      radius: +r.toFixed(3),
      size: [+size.x.toFixed(3), +size.y.toFixed(3), +size.z.toFixed(3)],
      minY: +box.min.y.toFixed(4),
      floorMode,
    };
  };

  /** Import + call the named builder export; resolve the model root from any of
   *  the three shapes (returned Group / {root} / void + scene-diff adoption). */
  lib.mountBuilder = async ({ moduleUrl, builderName, argsJson, floor }) => {
    const g = window.__game; const ctx = g.ctx;
    const scene = ctx.three.scene;
    let mod;
    try { mod = await lib.dynImport(moduleUrl); }
    catch (e) { return { skip: `module import failed (${moduleUrl}): ${e.message}` }; }
    const fn = mod[builderName];
    if (typeof fn !== 'function') {
      return { skip: `export "${builderName}" is not a function in ${moduleUrl}; exports: ${Object.keys(mod).join(', ')}` };
    }

    const before = new Set(scene.children);
    // Call-shape attempts: explicit --args first (raw, then ctx-prefixed);
    // otherwise arity>=1 → (ctx) then (); arity 0 → () then (ctx).
    const attempts = [];
    if (argsJson != null) {
      let parsed;
      try { parsed = JSON.parse(argsJson); } catch (e) { return { skip: `--args is not valid JSON: ${e.message}` }; }
      attempts.push(Array.isArray(parsed) ? parsed : [parsed]);
      attempts.push(Array.isArray(parsed) ? [ctx, ...parsed] : [ctx, parsed]);
    } else if (fn.length >= 1) { attempts.push([ctx]); attempts.push([]); }
    else { attempts.push([]); attempts.push([ctx]); }

    let result; let called = false; const errs = [];
    for (const a of attempts) {
      try {
        result = fn(...a);
        if (result && typeof result.then === 'function') result = await result;
        called = true;
        break;
      } catch (e) { errs.push(`${a.length ? (a[0] === ctx ? '(ctx,…)' : '(args)') : '()'}: ${e.message}`); }
    }
    if (!called) return { skip: `builder threw on every call shape — it likely hard-requires live world state. ${errs.join(' | ')}` };

    // Resolve the model root.
    let root = null; let adoption = null; const ignored = [];
    if (result && result.isObject3D) root = result;
    else if (result && result.root && result.root.isObject3D) root = result.root;
    else {
      // void builder → adopt what it added to the scene (most-meshes root wins;
      // hero lights / starfield backdrops etc. are left hidden + reported).
      const news = scene.children.filter((cc) => !before.has(cc));
      const withMeshes = [];
      for (const o of news) {
        let m = 0; o.traverse((x) => { if (x.isMesh) m++; });
        if (m > 0) withMeshes.push({ o, m });
        o.visible = false; // everything new starts hidden; the winner is re-staged
      }
      if (!withMeshes.length) return { skip: 'builder returned no Object3D and added no meshes to the scene (nothing to stage)' };
      withMeshes.sort((a, b) => b.m - a.m);
      root = withMeshes[0].o;
      root.visible = true;
      for (const nn of news) if (nn !== root) ignored.push(`${nn.name || nn.type}${nn.isLight ? ' [light]' : ''}`);
      scene.remove(root);
      // Stage in the model's BUILT frame (scene placement transform stripped).
      root.position.set(0, 0, 0);
      root.rotation.set(0, 0, 0);
      adoption = 'scene-diff (void builder): staged the most-meshed new root at identity transform';
    }

    const studio = await lib.buildStudio(root, { floor, hintUrl: moduleUrl });
    if (studio.skip) return studio;
    return { ...studio, adoption, ignored, callErrsBeforeSuccess: errs };
  };

  /** Synthetic defect rig — proves the detectors aren't vacuously green.
   *  box (grounded) + sphere floating 10cm above it + two coplanar overlapping
   *  0.5mm-apart decal planes on the box face + a bar sunk 4cm into the floor. */
  lib.mountTestRig = async () => {
    const THREE = await lib.getTHREE(null);
    const root = new THREE.Group();
    root.name = 'lintTestRig';
    const mat = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, metalness: 0.15 });
    const box = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat(0x8a9099));
    box.position.y = 0.5; box.name = 'testBox'; root.add(box);
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.15, 24, 16), mat(0xc0392b));
    sphere.position.set(0, 1.25, 0); sphere.name = 'testFloatingSphere'; root.add(sphere); // min.y=1.10 vs box top 1.00 → 10cm gap
    const decalA = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), mat(0x2980b9));
    decalA.position.set(0, 0.5, 0.5005); decalA.name = 'testDecalA'; root.add(decalA);
    const decalB = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5), mat(0x27ae60));
    decalB.position.set(0, 0.5, 0.5010); decalB.name = 'testDecalB'; root.add(decalB);   // 0.5mm behind A → z-fight
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.3), mat(0xd4a017));
    bar.position.set(0.75, 0.06, 0); bar.name = 'testSunkBar'; root.add(bar);            // min.y=-0.04 → 4cm floor dip
    return await lib.buildStudio(root, { floor: 'auto', hintUrl: null });
  };

  /** Frame the camera on the staged model: spherical orbit around the bounding sphere. */
  lib.frame = ({ az, el, distMul }) => {
    const S = window.__modelStage;
    const cam = window.__game.ctx.three.camera;
    const a = (az * Math.PI) / 180, e = (el * Math.PI) / 180;
    const dist = (S.radius / Math.sin(((cam.fov / 2) * Math.PI) / 180)) * (distMul || 1.15);
    const c = S.center;
    const p = {
      x: c.x + Math.sin(a) * Math.cos(e) * dist,
      y: c.y + Math.sin(e) * dist,
      z: c.z + Math.cos(a) * Math.cos(e) * dist,
    };
    if (cam.parent) cam.parent.updateMatrixWorld(true);
    const THREE = S.THREE;
    const world = new THREE.Vector3(p.x, p.y, p.z);
    cam.position.copy(cam.parent ? cam.parent.worldToLocal(world.clone()) : world);
    cam.lookAt(c.x, c.y, c.z);
    cam.updateMatrixWorld(true);
    window.__game.ctx.three.renderer.shadowMap.needsUpdate = true; // paused game: keep the shadow pass fresh
    return { dist: +dist.toFixed(2) };
  };

  /** Frame a named child object (close-up). Returns candidate names on a miss. */
  lib.frameCloseup = ({ name }) => {
    const S = window.__modelStage; const THREE = S.THREE;
    const obj = S.root.getObjectByName(name);
    if (!obj) {
      const names = [];
      S.root.traverse((o) => { if (o.name && !names.includes(o.name) && names.length < 60) names.push(o.name); });
      return { ok: false, names };
    }
    obj.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(obj);
    if (box.isEmpty()) return { ok: false, names: [`(object "${name}" has no measurable geometry)`] };
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    const cam = window.__game.ctx.three.camera;
    const r = Math.max(sphere.radius, 0.05);
    const dist = Math.max(0.3, (r / Math.sin(((cam.fov / 2) * Math.PI) / 180)) * 1.25);
    const a = (30 * Math.PI) / 180, e = (18 * Math.PI) / 180;
    const c = sphere.center;
    cam.position.set(
      c.x + Math.sin(a) * Math.cos(e) * dist,
      c.y + Math.sin(e) * dist,
      c.z + Math.cos(a) * Math.cos(e) * dist,
    );
    cam.lookAt(c.x, c.y, c.z);
    cam.updateMatrixWorld(true);
    window.__game.ctx.three.renderer.shadowMap.needsUpdate = true;
    return { ok: true };
  };

  /** GEOMETRY LINT over the staged model's visible meshes. */
  lib.lint = (P) => {
    const S = window.__modelStage; const THREE = S.THREE;
    S.root.updateMatrixWorld(true);

    // Collect meshes with EFFECTIVE visibility (hidden FX shells at t=0 are intentional, not floaters).
    const meshes = [];
    (function walk(o, vis) {
      const v = vis && o.visible !== false;
      if (o.isMesh && v && o.geometry && o.geometry.attributes && o.geometry.attributes.position) meshes.push(o);
      for (const cc of o.children) walk(cc, v);
    })(S.root, true);

    const labels = meshes.map((o, i) => {
      const names = []; let n = o;
      while (n && n !== S.root && names.length < 2) { if (n.name) names.push(n.name); n = n.parent; }
      const base = names.reverse().join('/');
      return base ? `${base}[m${i}]` : `mesh#${i}(${o.geometry.type})`;
    });

    const boxes = [];
    const alive = [];
    for (let i = 0; i < meshes.length; i++) {
      const geo = meshes[i].geometry;
      if (!geo.boundingBox) geo.computeBoundingBox();
      const b = new THREE.Box3().copy(geo.boundingBox).applyMatrix4(meshes[i].matrixWorld);
      if (!isFinite(b.min.x) || !isFinite(b.max.x)) continue;
      boxes.push(b); alive.push(i);
    }
    const N = boxes.length;
    const lbl = (k) => labels[alive[k]];
    const floorY = S.floorMode === 'origin' ? 0 : S.floorY;

    // ── FLOATERS: union-find over tolerance-expanded AABBs.
    const parent = Array.from({ length: N }, (_, i) => i);
    const find = (a) => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; };
    const uni = (a, b) => { a = find(a); b = find(b); if (a !== b) parent[b] = a; };
    const exp = boxes.map((b) => b.clone().expandByScalar(P.tol / 2));
    for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) if (exp[i].intersectsBox(exp[j])) uni(i, j);
    const comps = new Map();
    for (let i = 0; i < N; i++) {
      const rt = find(i);
      if (!comps.has(rt)) comps.set(rt, { idx: [], vol: 0, grounded: false, box: new THREE.Box3() });
      const cmp = comps.get(rt);
      cmp.idx.push(i);
      const sz = boxes[i].getSize(new THREE.Vector3());
      cmp.vol += Math.max(sz.x, 1e-6) * Math.max(sz.y, 1e-6) * Math.max(sz.z, 1e-6);
      if (boxes[i].min.y <= floorY + P.tol) cmp.grounded = true;
      cmp.box.union(boxes[i]);
    }
    let main = null;
    for (const cmp of comps.values()) if (!main || cmp.vol > main.vol) main = cmp;
    const floaters = [];
    for (const cmp of comps.values()) {
      if (cmp === main || cmp.grounded) continue;
      const cc = cmp.box.getCenter(new THREE.Vector3());
      const sz = cmp.box.getSize(new THREE.Vector3());
      floaters.push({
        objects: cmp.idx.slice(0, 6).map(lbl).concat(cmp.idx.length > 6 ? [`+${cmp.idx.length - 6} more`] : []),
        meshes: cmp.idx.length,
        center: [+cc.x.toFixed(3), +cc.y.toFixed(3), +cc.z.toFixed(3)],
        size: [+sz.x.toFixed(3), +sz.y.toFixed(3), +sz.z.toFixed(3)],
      });
    }

    // ── Z-FIGHT PAIRS: sampled near-coplanar overlapping face pairs across DIFFERENT meshes.
    const triCache = new Array(N).fill(null);
    const sampleTris = (k) => {
      if (triCache[k]) return triCache[k];
      const mesh = meshes[alive[k]];
      const geo = mesh.geometry; const pos = geo.attributes.position; const idx = geo.index;
      const triCount = Math.floor((idx ? idx.count : pos.count) / 3);
      const out = [];
      if (triCount >= 1) {
        const stride = Math.max(1, Math.floor(triCount / P.triCapPerMesh));
        const m = mesh.matrixWorld;
        const vA = new THREE.Vector3(), vB = new THREE.Vector3(), vC = new THREE.Vector3();
        const cb = new THREE.Vector3(), ab = new THREE.Vector3(), n = new THREE.Vector3();
        for (let t = 0; t < triCount; t += stride) {
          const a = idx ? idx.getX(t * 3) : t * 3;
          const b = idx ? idx.getX(t * 3 + 1) : t * 3 + 1;
          const c2 = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
          vA.fromBufferAttribute(pos, a).applyMatrix4(m);
          vB.fromBufferAttribute(pos, b).applyMatrix4(m);
          vC.fromBufferAttribute(pos, c2).applyMatrix4(m);
          cb.subVectors(vC, vB); ab.subVectors(vA, vB); n.crossVectors(cb, ab);
          const len = n.length();
          if (len < 1e-10) continue;
          const nx = n.x / len, ny = n.y / len, nz = n.z / len;
          const cx = (vA.x + vB.x + vC.x) / 3, cy = (vA.y + vB.y + vC.y) / 3, cz = (vA.z + vB.z + vC.z) / 3;
          const r = Math.sqrt(Math.max(
            (vA.x - cx) ** 2 + (vA.y - cy) ** 2 + (vA.z - cz) ** 2,
            (vB.x - cx) ** 2 + (vB.y - cy) ** 2 + (vB.z - cz) ** 2,
            (vC.x - cx) ** 2 + (vC.y - cy) ** 2 + (vC.z - cz) ** 2));
          out.push({ nx, ny, nz, cx, cy, cz, r });
        }
      }
      triCache[k] = out;
      return out;
    };
    const zexp = boxes.map((b) => b.clone().expandByScalar(P.zfightDist * 2));
    const zfights = [];
    let grazingPairs = 0, checkedPairs = 0, comparisons = 0, capped = false;
    outer:
    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < N; j++) {
        if (!zexp[i].intersectsBox(zexp[j])) continue;
        const A = sampleTris(i), B = sampleTris(j);
        if (!A.length || !B.length) continue;
        let hits = 0; let sample = null;
        for (const ta of A) {
          for (const tb of B) {
            comparisons++;
            // SIGNED dot: only SAME-facing coplanar faces z-fight visibly under
            // default backface culling. Opposing normals at ~0 distance are
            // butted solid boxes (face-to-face contact) — noise, not z-fights.
            // (DoubleSide back-to-back panels evade this check — documented.)
            const dot = ta.nx * tb.nx + ta.ny * tb.ny + ta.nz * tb.nz;
            if (dot <= P.zfightDot) continue;
            const dx = tb.cx - ta.cx, dy = tb.cy - ta.cy, dz = tb.cz - ta.cz;
            const pd = dx * ta.nx + dy * ta.ny + dz * ta.nz;
            if (Math.abs(pd) >= P.zfightDist) continue;
            const ipx = dx - pd * ta.nx, ipy = dy - pd * ta.ny, ipz = dz - pd * ta.nz;
            const ip = Math.sqrt(ipx * ipx + ipy * ipy + ipz * ipz);
            if (ip >= (ta.r + tb.r) * P.overlapMul) continue;
            hits++;
            if (!sample) sample = [+((ta.cx + tb.cx) / 2).toFixed(3), +((ta.cy + tb.cy) / 2).toFixed(3), +((ta.cz + tb.cz) / 2).toFixed(3)];
            if (hits >= 40) break;
          }
          if (hits >= 40) break;
        }
        checkedPairs++;
        if (hits >= P.minPairHits) zfights.push({ a: lbl(i), b: lbl(j), at: sample, samples: hits });
        else if (hits > 0) grazingPairs++;
        if (comparisons > P.pairBudget) { capped = true; break outer; }
      }
    }

    // ── PENETRATION: below the authored floor plane (origin mode only — a
    //    free-floating model has no meaningful ground plane).
    const penetrations = [];
    if (S.floorMode === 'origin') {
      for (let k = 0; k < N; k++) {
        if (boxes[k].min.y < -P.penDepth) {
          const cc = boxes[k].getCenter(new THREE.Vector3());
          penetrations.push({ object: lbl(k), dipCm: +(-boxes[k].min.y * 100).toFixed(2), at: [+cc.x.toFixed(3), +cc.y.toFixed(3), +cc.z.toFixed(3)] });
        }
      }
    }

    // ── ENVELOPE: mesh AABB centre outside envelopeMul × the MAIN component's
    //    bounding sphere (the main comp so far-out orphans can't inflate it).
    const orphans = [];
    const mainSphere = main ? main.box.getBoundingSphere(new THREE.Sphere()) : null;
    if (mainSphere && mainSphere.radius > 0) {
      for (let k = 0; k < N; k++) {
        const cc = boxes[k].getCenter(new THREE.Vector3());
        const d = cc.distanceTo(mainSphere.center);
        if (d > mainSphere.radius * P.envelopeMul) {
          orphans.push({ object: lbl(k), at: [+cc.x.toFixed(3), +cc.y.toFixed(3), +cc.z.toFixed(3)], dist: +d.toFixed(3), envelope: +(mainSphere.radius * P.envelopeMul).toFixed(3) });
        }
      }
    }

    return {
      floaters, zfights, penetrations, orphans,
      counts: {
        meshes: N, components: comps.size, floaters: floaters.length, zfights: zfights.length,
        grazingPairs, penetrations: penetrations.length, orphans: orphans.length,
        checkedPairs, triComparisons: comparisons, capped, floorMode: S.floorMode,
      },
    };
  };

  window.__stageLib = lib;
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Node-side harness (the rig-shot pattern: own Vite dev server + chromium).
// ─────────────────────────────────────────────────────────────────────────────
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
      if (exited) return rej(new Error('dev server exited early (is port ' + PORT + ' free?)'));
      if (Date.now() - start > 30000) { proc.kill(); return rej(new Error('dev server not ready in 30s')); }
      try {
        const r = await fetch(`http://127.0.0.1:${PORT}/`);
        if (r.ok) return res(proc);
      } catch { /* not up yet */ }
      setTimeout(tick, 300);
    };
    tick();
  });
}

async function main() {
  console.log(`[model-stage] starting dev server on ${PORT}…`);
  const dev = await startDev();
  console.log(`[model-stage] dev up; launching chromium…`);
  const browser = await chromium.launch({
    args: ['--enable-webgl', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
  });
  let exitCode = 0;
  try {
    const bctx = await browser.newContext({ viewport: { width: 1100, height: 1100 }, deviceScaleFactor: 1 });
    const page = await bctx.newPage();
    // Snap the viewport to the canvas render-buffer dims before each capture so
    // CSS box == buffer == camera aspect (rig-shot's W2 aspect fix — without it
    // every non-viewport-sized shot is silently stretched).
    const _origScreenshot = page.screenshot.bind(page);
    page.screenshot = async (opts = {}) => {
      try {
        const dims = await page.evaluate(() => {
          const c = document.querySelector('canvas');
          return c && c.width > 50 ? { w: c.width, h: c.height } : null;
        });
        const vp = page.viewportSize();
        if (dims && vp && (dims.w !== vp.width || dims.h !== vp.height)) {
          await page.setViewportSize({ width: dims.w, height: dims.h });
          await page.waitForTimeout(120);
        }
      } catch { /* a wrong-aspect shot beats no shot */ }
      return _origScreenshot(opts);
    };
    page.on('pageerror', (e) => console.log(`  [page error] ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error') console.log(`  [browser error] ${m.text()}`); });
    await page.addInitScript((seed) => {
      try { localStorage.setItem('dustfall.tutorial.v1', JSON.stringify({ seenIntro: true, usedItems: [] })); } catch { /* ignore */ }
      try { localStorage.setItem('dustfall.pendingSeed', String(seed)); } catch { /* ignore */ }
      // Block the vite-hmr websocket: concurrent sessions editing src/ would
      // otherwise trigger a full-reload mid-run and wipe the staged model +
      // window.__stageLib (observed live — sibling agents own src/world files).
      const NativeWS = window.WebSocket;
      window.WebSocket = function (url, protocols) {
        const isHmr = (protocols && String(protocols).includes('vite-hmr')) || /vite/.test(String(url));
        if (isHmr) {
          return {
            addEventListener() {}, removeEventListener() {}, send() {}, close() {},
            readyState: 3, onopen: null, onmessage: null, onclose: null, onerror: null,
          };
        }
        return new NativeWS(url, protocols);
      };
      window.WebSocket.prototype = NativeWS.prototype;
    }, Number(argv.seed ?? 1337));
    // domcontentloaded, not load: the HMR-blocking WebSocket stub leaves the vite
    // client module pending forever, which stalls the window 'load' event. The
    // game entry is an independent module graph — the __game poll below is the gate.
    await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!(window.__game && window.__game.ctx?.player?.rig), undefined, { timeout: 45000 });

    // Enter gameplay (dev loadout, skipLock), let the world settle, install the lib.
    await page.evaluate(() => { window.__game.enterGame(true); });
    await page.waitForTimeout(1200);
    await page.evaluate(installStageLib);

    // ── MOUNT ────────────────────────────────────────────────────────────────
    let mount; let tag;
    if (TEST_MODE) {
      tag = 'lint-test-rig';
      mount = await page.evaluate(async () => await window.__stageLib.mountTestRig());
    } else {
      tag = BUILDER;
      mount = await page.evaluate(
        async (a) => await window.__stageLib.mountBuilder(a),
        { moduleUrl: toViteUrl(MODULE), builderName: BUILDER, argsJson: ARGS_JSON, floor: FLOOR },
      );
    }
    if (mount.skip) {
      console.log(`[model-stage] SKIP: ${mount.skip}`);
      return; // exit 0 — a clean, named skip is not a lint failure
    }
    console.log(`[model-stage] mounted ${tag}: ${mount.meshCount} meshes, radius ${mount.radius}m, size [${mount.size.join(', ')}], min.y ${mount.minY}, floor=${mount.floorMode}${mount.adoption ? ` — ${mount.adoption}` : ''}`);
    if (mount.ignored && mount.ignored.length) console.log(`[model-stage] not staged (left hidden): ${mount.ignored.join(', ')}`);
    if (mount.callErrsBeforeSuccess && mount.callErrsBeforeSuccess.length) console.log(`[model-stage] note: earlier call shapes threw: ${mount.callErrsBeforeSuccess.join(' | ')}`);
    await page.waitForTimeout(800); // let shadow maps + material recompiles settle

    // Loud guard: if the page reloaded (any missed HMR path), fail with a real message.
    const assertStageAlive = async (where) => {
      const ok = await page.evaluate(() => !!(window.__stageLib && window.__modelStage));
      if (!ok) throw new Error(`stage state lost before ${where} — the page reloaded mid-run (HMR from a concurrent src/ edit?)`);
    };

    // ── PROBE (debug aid): dump the render-state truth for the staged model.
    if (argv.probe) {
      const probe = await page.evaluate((shot) => {
        const S = window.__modelStage; const g = window.__game; const ctx = g.ctx;
        window.__stageLib.frame(shot);
        const cam = ctx.three.camera;
        const THREE = S.THREE;
        const camWorld = cam.getWorldPosition(new THREE.Vector3());
        const chain = []; let n = cam; while (n) { chain.push(n.name || n.type); n = n.parent; }
        const center = new THREE.Vector3(S.center.x, S.center.y, S.center.z);
        const ndc = center.clone().project(cam);
        const kids = ctx.three.scene.children.map((c) => `${c.name || c.type}:${c.visible ? 'v' : 'h'}`);
        const stageKids = S.stage.children.map((c) => `${c.name || c.type}:${c.visible ? 'v' : 'h'}`);
        let meshInfo = null;
        S.root.traverse((o) => { if (!meshInfo && o.isMesh) meshInfo = { name: o.name, layers: o.layers.mask, frustumCulled: o.frustumCulled, mat: o.material?.type, matVisible: o.material?.visible, wp: o.getWorldPosition(new THREE.Vector3()).toArray().map((v) => +v.toFixed(2)) }; });
        const info = ctx.three.renderer.info.render;
        return {
          threeUrl: window.__stageTHREEUrl || '(unrecorded)',
          camWorld: camWorld.toArray().map((v) => +v.toFixed(2)),
          camChain: chain, fov: cam.fov, aspect: +cam.aspect.toFixed(2), near: cam.near, far: cam.far,
          centerNdc: ndc.toArray().map((v) => +v.toFixed(2)),
          sceneKids: kids, stageKids, meshInfo,
          render: { calls: info.calls, triangles: info.triangles },
          titleActive: ctx.flags.titleActive, paused: ctx.flags.paused,
        };
      }, SHOTS[0]);
      console.log('[model-stage] PROBE ' + JSON.stringify(probe, null, 1));
    }

    // ── LINT ─────────────────────────────────────────────────────────────────
    await assertStageAlive('lint');
    const lint = await page.evaluate((P) => window.__stageLib.lint(P), LINT_PARAMS);
    console.log(`[model-lint] ${JSON.stringify(lint)}`);

    // ── TEST-MODE ASSERTIONS ────────────────────────────────────────────────
    if (TEST_MODE) {
      const checks = [
        ['floater: testFloatingSphere caught', lint.floaters.some((c) => c.objects.some((n) => /FloatingSphere/i.test(n)))],
        ['floater: exactly one floating component (no false positives)', lint.floaters.length === 1],
        ['zfight: testDecalA×testDecalB pair caught', lint.zfights.some((p) => /DecalA/.test(p.a + p.b) && /DecalB/.test(p.a + p.b))],
        ['penetration: testSunkBar caught (4cm dip)', lint.penetrations.some((p) => /SunkBar/.test(p.object))],
        ['penetration: grounded testBox NOT flagged', !lint.penetrations.some((p) => /testBox\b/.test(p.object))],
        ['envelope: no false orphans', lint.orphans.length === 0],
      ];
      let pass = true;
      for (const [name, ok] of checks) { console.log(`[model-stage]   ${ok ? 'PASS' : 'FAIL'} — ${name}`); if (!ok) pass = false; }
      console.log(`[model-stage] TEST ${pass ? 'PASS' : 'FAIL'}: ${checks.filter((c) => c[1]).length}/${checks.length} assertions`);
      exitCode = pass ? 0 : 1;
      // A few studio shots so the stage itself can be eyeballed.
      await assertStageAlive('test-mode shots');
      for (const shot of [SHOTS[0], SHOTS[8], SHOTS[10]]) {
        await page.evaluate((s) => window.__stageLib.frame(s), shot);
        await page.waitForTimeout(300);
        await page.screenshot({ path: join(OUT, `${tag}-${shot.name}.png`), fullPage: false });
      }
      console.log(`[model-stage] manifest: verification/stage/${tag}-{${[SHOTS[0], SHOTS[8], SHOTS[10]].map((s) => s.name).join(',')}}.png`);
      return exitCode;
    }

    // ── TURNTABLE + CLOSE-UPS ───────────────────────────────────────────────
    const saved = [];
    if (!LINT_ONLY) {
      await assertStageAlive('turntable');
      for (const shot of SHOTS) {
        await page.evaluate((s) => window.__stageLib.frame(s), shot);
        await page.waitForTimeout(saved.length === 0 ? 500 : 280);
        const file = `${tag}-${shot.name}.png`;
        await page.screenshot({ path: join(OUT, file), fullPage: false });
        saved.push(shot.name);
      }
      for (const cu of CLOSEUPS) {
        const res = await page.evaluate((n) => window.__stageLib.frameCloseup({ name: n }), cu);
        if (!res.ok) {
          console.log(`[model-stage] closeup "${cu}" NOT FOUND. Named children: ${res.names.join(', ') || '(none)'}`);
          continue;
        }
        await page.waitForTimeout(300);
        const file = `${tag}-closeup-${cu}.png`;
        await page.screenshot({ path: join(OUT, file), fullPage: false });
        saved.push(`closeup-${cu}`);
      }
      console.log(`[model-stage] manifest: verification/stage/${tag}-{${saved.join(',')}}.png (${saved.length} shots)`);
    }

    // ── EXIT CODE: floaters/penetrations gate; z-fights warn-only.
    if (lint.floaters.length || lint.penetrations.length) {
      console.log(`[model-stage] LINT FAIL: ${lint.floaters.length} floater(s), ${lint.penetrations.length} penetration(s)`);
      exitCode = 1;
    } else {
      console.log(`[model-stage] LINT OK (floaters/penetrations clean${lint.zfights.length ? `; ${lint.zfights.length} z-fight pair(s) — WARN-ONLY, may include shared-material decals` : ''})`);
    }
  } finally {
    await browser.close();
    // Windows: kill the whole npm→vite tree or the port stays bound + the node
    // process wedges on the orphaned child's stdio (see rig-shot's teardown note).
    try {
      if (process.platform === 'win32' && dev.pid) {
        spawnSync('taskkill', ['/pid', String(dev.pid), '/T', '/F'], { stdio: 'ignore' });
      } else {
        dev.kill();
      }
    } catch { /* best effort */ }
  }
  return exitCode;
}

main().then((code) => process.exit(code || 0)).catch((e) => { console.error(e); process.exit(1); });
