// verify:solid — the SOLID-MODEL VERIFICATION HARNESS (Phase-1 "SOLID", 2026-07-16).
//
// Machine-detects the geometry bug classes that keep recurring in Dustfall's
// procedurally-modelled hero assets (audit-and-roadmap-2026-07-15.md §A3 rec 1:
// "every failure that got a machine gate stopped recurring; every failure that
// got only a prose rule recurred"). It rides the rig-shot/model-stage harness
// pattern (own Vite dev server + Playwright chromium + page.evaluate driving
// window.__game) but stages a NAMED hero asset in the REAL world (real terrain +
// real colliders) and runs six per-asset checks, each returning a pass/fail with
// the offending mesh / angle / point.
//
//   node scripts/verify-solid.mjs --asset=skyfall
//   node scripts/verify-solid.mjs --asset=leviathan
//   node scripts/verify-solid.mjs --asset=ribcage
//   node scripts/verify-solid.mjs --asset=all           # all three, one boot
//   node scripts/verify-solid.mjs --asset=selftest      # synthetic-defect proof
//     (asserts each geometry detector FIRES on a known-bad rig + stays clean on a
//      known-good solid — the model-stage --test-mode discipline)
//   npm run verify:solid                                 # = --asset=all
//
//   --asset   skyfall | leviathan | ribcage | all | selftest   (default all)
//   --port    dev server port (default 5205)
//   --json    also dump the full result JSON per asset
//
// ZERO game-source changes: every check is injected via page.evaluate; the
// asset is built through the SAME code paths the game uses (spawnSkyfall / the
// boot-placed leviathan / makeGiantRibcage), so what the harness inspects is
// what ships.
//
// THE SIX CHECKS (detection method in one line each):
//   1. thin       — per-mesh geometry bbox: a mesh whose smallest dim is near-zero
//                   AND is a wall-scale feature (esp. DoubleSide faking solidity).
//   2. backface   — render the asset from N orbit angles + into-the-opening views
//                   with a front=white / back=magenta override; count back-face
//                   pixels visible from OUTSIDE (a front face missing → see-through).
//   3. openend    — topological: cluster boundary edges (used by exactly ONE tri)
//                   into loops; a LARGE open loop = an uncapped torn hull end / hole.
//                   EXCLUDES an asset's DECLARED entrance (see "intended openings").
//   4. floating   — connected-component analysis: a component whose lowest point
//                   floats above terrain.heightAt under its own footprint.
//   5. collision  — NEGATIVE walk-probe (enclosure assets only): compare the first
//                   VISIBLE-surface hit vs the first COLLIDER hit along rays fired
//                   at the hull from outside — a visible wall with no collision in
//                   front of it is walk-through-able. Plus solid-floor + open-door.
//   6. seam       — entrance/opening rays (enclosure+probe assets): exterior opening
//                   must lead to the interior (not a wall); the interior mouth must
//                   see daylight (not hull); an interior fan finds EXTRA daylight
//                   arcs = open ends / shell gaps beyond the intended mouth. PLUS the
//                   walk-in proof below, which is the gating half.
//   7. walkin     — POSITIVE proof you can get IN from genuinely OUTSIDE (2026-07-16).
//                   Pick start points that are VERIFIABLY outside (a ray straight up
//                   hits neither asset geometry nor a collider — so a point inside the
//                   hull, or inside a decorative bore, is rejected as a start), then
//                   MARCH a player-radius sphere from there through the entrance into
//                   the interior at real floor height, requiring zero collider overlap.
//
// Checks 5 & 6/7 are scoped to ENCLOSURE assets (hulls you enter). An open colonnade
// like the ribcage is walk-THROUGH by design, so firing the exterior-wall probe on
// it would be a false positive — those checks report N/A for it. See docs/verify-solid.md.
//
// ── INTENDED OPENINGS (2026-07-16 — why this file grew a check and lost a footgun) ──
// The leviathan shipped SEALED: the `openend` detector flagged the hull's walk-in
// bores as "uncapped cross-sections", the fix capped every one of them — including
// the player's way in — and `seam` still passed, because its "outside" waypoint was
// a builder-declared point that was itself INSIDE a decorative bore. A gate caused
// the bug and another gate missed it. Two structural fixes:
//   (a) an asset DECLARES its entrance (`userData.intendedOpening = {center,radius}`
//       in mesh-LOCAL space, or `entrance` here in ASSET_DEFS) and `openend` excludes
//       boundary loops there — a detector must never call the front door a defect.
//   (b) `walkin` derives its own OUTSIDE, never trusting a builder waypoint, and
//       proves passage with a swept player-radius sphere against REAL colliders.
//       It FAILS on the sealed build and PASSES on the fixed one — the gate is only
//       worth having if it can do both.

import { chromium } from 'playwright';
import { spawn, spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const argv = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  }),
);
const PORT = Number(argv.port || 5205);
const DUMP_JSON = !!argv.json;
const ASSET = String(argv.asset || 'all');

// Which assets to run + their nature (enclosure ⇒ the collision/seam/walkin probes
// apply). `entrance` (optional) is a per-asset OVERRIDE of the declared intended
// opening, in WORLD space, for assets whose builder does not stash a
// `userData.intendedOpening` — normally the builder declares it and this stays empty.
const ASSET_DEFS = {
  skyfall: { enclosure: true },
  leviathan: { enclosure: true },
  ribcage: { enclosure: false },
  hab_dome: { enclosure: true },
};
const RUN_LIST = ASSET === 'all' ? ['skyfall', 'leviathan', 'ribcage', 'hab_dome'] : [ASSET];

// Detector thresholds — documented + tunable in docs/verify-solid.md.
const PARAMS = {
  // 1. thin
  thinAbs: 0.045,        // a face-thin wall: smallest bbox dim < 4.5cm …
  thinFeature: 0.30,     // … AND a larger dim ≥ 30cm (it's a WALL/panel, not a pin/wire)
  thinDoubleSide: 0.12,  // a DoubleSide mesh faking solidity: smallest dim < 12cm flags
  // 2. backface
  rtSize: 340,           // offscreen render-target edge (px)
  bleedFrac: 0.01,       // > 1% of the EXTERIOR silhouette showing BACK faces ⇒ see-through
                         //   (a clean closed solid is ~0 from outside; real defects run 5-90%)
  minSilhouette: 400,    // ignore near-empty frames (asset off-screen / tiny)
  // 3. openend
  loopDiag: 1.2,         // a boundary loop whose world bbox-diagonal ≥ 1.2m = a real open cross-section
  loopEdges: 8,          // … and ≥ 8 boundary edges (ignores incidental primitive seams)
  // 4. floating
  floatTol: 0.5,         // a component floating > 0.5m above the terrain under its footprint
  minCompSize: 0.6,      // … and ≥ 0.6m across (ignore tiny greebles legitimately mid-air)
  // 5. collision
  penTol: 0.6,           // visible surface hit, but no collider within +0.6m ⇒ walk-through
  collFlagFrac: 0.25,    // > 25% of valid exterior rays walk-through ⇒ hull collision missing
  collFlagMin: 4,        // … or an absolute ≥ 4 flagged rays
  // 6. seam
  fanRays: 48,           // interior-fan ray count for the daylight-arc test
  // 7. walkin
  playerRadius: 0.35,    // Tuning.PLAYER_CAPSULE_RADIUS — the sphere we march
  walkStartRing: 26,     // candidate OUTSIDE starts on a ring this far from the entrance
  walkStarts: 16,        // … this many, evenly spaced in azimuth
  walkStep: 0.45,        // march step along the path (< playerRadius ⇒ no tunnelling)
  walkClearUp: 60,       // "verifiably outside" = this many metres of clear sky overhead
  walkFloorLift: 0.12,   // sphere sits this far above the floor it is standing on
  walkProbeUp: 0.9,      // floor search reaches this far above the PREVIOUS step (a step-up limit)
};

// ─────────────────────────────────────────────────────────────────────────────
// IN-PAGE LIBRARY — installed once via page.evaluate. Runs in the BROWSER against
// the game's own THREE (window.__game.THREE) + live ctx. No game-source edits.
// ─────────────────────────────────────────────────────────────────────────────
async function installSolidLib() {
  if (window.__solidLib) return true;
  const lib = {};

  /** Dynamic import that survives the evaluate context (direct eval-import first,
   *  <script type=module> shim fallback) — mirrors model-stage.mjs. Only the
   *  ribcage needs it (skyfall/leviathan spawn via existing hooks). */
  lib.dynImport = async (url) => {
    try {
      // eslint-disable-next-line no-eval
      return await (0, eval)(`import(${JSON.stringify(url)})`);
    } catch (e) {
      if (e && /module|import/i.test(String(e.message)) === false) throw e;
      return await new Promise((res, rej) => {
        const key = '__si_' + Math.random().toString(36).slice(2);
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

  /** Collect the asset's VISIBLE meshes (has position attr). */
  lib.meshesOf = (root) => {
    const out = [];
    root.updateMatrixWorld(true);
    (function walk(o, vis) {
      const v = vis && o.visible !== false;
      if (o.isMesh && v && o.geometry && o.geometry.attributes && o.geometry.attributes.position) out.push(o);
      for (const c of o.children) walk(c, v);
    })(root, true);
    return out;
  };

  /** A stable, human-readable label for a mesh (nearest named ancestors). */
  lib.labelOf = (mesh, root, i) => {
    const names = []; let n = mesh;
    while (n && n !== root && names.length < 2) { if (n.name) names.push(n.name); n = n.parent; }
    const base = names.reverse().join('/');
    return base ? `${base}[m${i}]` : `mesh#${i}(${mesh.geometry.type})`;
  };

  // ── SPAWN each named asset into the REAL world (real terrain + colliders). ──
  lib.spawnAsset = async (name, viteUrls) => {
    const g = window.__game; const ctx = g.ctx; const THREE = g.THREE;
    ctx.flags.paused = true;             // freeze the sim; the render loop still draws (harmless)
    if (name === 'skyfall') {
      const existing = ctx.three.scene.getObjectByName('skyfallWreck');
      if (!existing) g.spawnSkyfall();
      const root = ctx.three.scene.getObjectByName('skyfallWreck');
      if (!root) return { skip: 'skyfall root not in scene after spawnSkyfall' };
      return { rootName: 'skyfallWreck', center: lib.centerOf(root) };
    }
    if (name === 'leviathan') {
      const root = ctx.three.scene.getObjectByName('leviathanLandmark');
      if (!root) return { skip: 'leviathanLandmark not in scene (FEATURES.escapePodIntro off?)' };
      return { rootName: 'leviathanLandmark', center: lib.centerOf(root) };
    }
    if (name === 'hab_dome') {
      // Build through the REAL POI pipeline (placeProcgenPOI → assembleHabDome →
      // burial / terrain-align / declared colliders / bucket re-skin / static merge),
      // placed on real terrain ~70m off the player so it never overlaps boot content.
      const poi = await lib.dynImport(viteUrls.poiAssembler);
      const rng = await lib.dynImport(viteUrls.rng);
      const bp = ctx.player.body.body.translation();
      const x = bp.x + 70, z = bp.z + 8;
      const gy = ctx.terrain.heightAt(x, z);
      const pos = new THREE.Vector3(x, gy, z);
      const group = poi.placeProcgenPOI(ctx.three.scene, ctx.physics.world, ctx.terrain, pos, rng.makeRng(0x4ab2c9), undefined, { archetype: 'hab_dome' });
      group.name = 'habDome';
      group.updateMatrixWorld(true);
      // Build the world-space walk-probe from the component-local waypoints the
      // builder stashed (habDomeProbeLocal): the POI got a random yaw + terrain
      // tilt + bury, so the interior path must be transformed through the placed
      // group's matrix. floorHandles empty = the interior floor IS the sand (no
      // raised deck), so the floor check falls back to hitY-near-waypoint.
      let holder = null;
      group.traverse((o) => { if (o.userData && o.userData.habDomeProbeLocal) holder = o; });
      if (holder) {
        const L = holder.userData.habDomeProbeLocal;
        group.userData.habDomeProbe = {
          deckHandle: -1,
          floorHandles: L.floorHandles || [],
          waypoints: L.waypoints.map((w) => { const v = holder.localToWorld(new THREE.Vector3(w.x, w.y, w.z)); return { name: w.name, x: v.x, y: v.y, z: v.z }; }),
        };
      }
      return { rootName: 'habDome', center: lib.centerOf(group) };
    }
    if (name === 'ribcage') {
      // Build through the REAL code path (makeGiantRibcage + conform + applyColliders),
      // placed on real terrain ~70m off the player so it never overlaps boot content.
      const mod = await lib.dynImport(viteUrls.ribcage);
      const rng = await lib.dynImport(viteUrls.rng);
      const bp = ctx.player.body.body.translation();
      const x = bp.x + 70, z = bp.z + 8;
      const gy = ctx.terrain.heightAt(x, z);
      const rc = mod.makeGiantRibcage(rng.makeRng(0x8a17ce), {
        name: 'giantRibcage',
        conform: { groundAt: (a, b) => ctx.terrain.heightAt(a, b), originX: x, originZ: z, yaw: 0, baseY: gy },
      });
      rc.group.position.set(x, gy, z);
      rc.group.rotation.y = 0;
      ctx.three.scene.add(rc.group);
      rc.applyColliders(ctx.physics.world, new THREE.Vector3(x, gy, z), 0);
      rc.group.updateMatrixWorld(true);
      return { rootName: 'giantRibcage', center: lib.centerOf(rc.group) };
    }
    return { skip: `unknown asset "${name}"` };
  };

  lib.centerOf = (root) => {
    const THREE = window.__game.THREE;
    const box = new THREE.Box3().setFromObject(root);
    const c = box.getCenter(new THREE.Vector3());
    const s = box.getBoundingSphere(new THREE.Sphere());
    return { x: c.x, y: c.y, z: c.z, radius: Math.max(s.radius, 0.5), min: [box.min.x, box.min.y, box.min.z], max: [box.max.x, box.max.y, box.max.z] };
  };

  lib.probeOf = (root) => root.userData.skyfallProbe || root.userData.leviathanProbe || root.userData.habDomeProbe || null;

  /** The asset's DECLARED intended openings, in WORLD space.
   *  A builder that cuts a genuine walk-in hole through its hull stashes
   *  `userData.intendedOpening = { center: {x,y,z}, radius }` (mesh-LOCAL) on the
   *  mesh it cut; a static merge preserves userData on the surviving bucket, and the
   *  world transform is applied here. `cfg.entrance` (ASSET_DEFS) is a world-space
   *  escape hatch for assets whose builder cannot declare it.
   *
   *  WHY this exists: `openend` is a topology detector — it cannot tell a torn,
   *  unclosed hull end (a defect) from the front door (the whole point of the
   *  asset). Told to "fix every open loop", the previous pass capped the entrance
   *  and sealed the interior. A declared opening is excluded from `openend` and is
   *  what `walkin` aims at, so the two checks can never fight each other again. */
  lib.openingsOf = (root, cfg) => {
    const THREE = window.__game.THREE;
    const out = [];
    root.updateMatrixWorld(true);
    root.traverse((o) => {
      const io = o.userData && o.userData.intendedOpening;
      if (!io) return;
      const c = new THREE.Vector3(io.center.x, io.center.y, io.center.z).applyMatrix4(o.matrixWorld);
      // world radius: the local radius scaled by the node's largest world scale
      const s = new THREE.Vector3().setFromMatrixScale(o.matrixWorld);
      out.push({ center: c, radius: io.radius * Math.max(s.x, s.y, s.z), declaredBy: o.name || o.type });
    });
    if (cfg && cfg.entrance) out.push({ center: new THREE.Vector3(cfg.entrance.x, cfg.entrance.y, cfg.entrance.z), radius: cfg.entrance.radius, declaredBy: 'ASSET_DEFS.entrance' });
    return out;
  };

  /** An INTERACTIVE / non-static-hull subtree (a live salvage access panel, a
   *  journal, a loot trigger) — the SAME subtrees mergeStaticByMaterial skips
   *  (they are props, not the static hull). Fine hardware on a fuse-box door (a
   *  4cm frame bar, a dead-screen pane, a printed label decal) is NOT a hull
   *  wall "faking solidity", so the thin WALL-check must skip it, exactly as the
   *  merge does — otherwise a shared, well-tested prop false-flags on every
   *  wreck that mounts one. Real static paper (the cockpit panes) is NOT under
   *  such a node and still flags; the selftest's thin plane still flags. */
  lib.isInteractive = (mesh, root) => {
    let n = mesh;
    while (n && n !== root) { const u = n.userData; if (u && (u.accessPanel || u.noMerge || u.interactType)) return true; n = n.parent; }
    return false;
  };

  // ── CHECK 1 — PAPER-THIN / ZERO-THICKNESS. ──
  lib.checkThin = (root, P) => {
    const meshes = lib.meshesOf(root);
    const flags = [];
    meshes.forEach((m, i) => {
      if (lib.isInteractive(m, root)) return;   // live prop, not static hull (see isInteractive)
      const geo = m.geometry;
      if (!geo.boundingBox) geo.computeBoundingBox();
      const b = geo.boundingBox;
      const dx = b.max.x - b.min.x, dy = b.max.y - b.min.y, dz = b.max.z - b.min.z;
      const dims = [dx, dy, dz].sort((a, c) => a - c);
      const smallest = dims[0], largest = dims[2];
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      const doubleSide = mats.some((mt) => mt && mt.side === 2 /* THREE.DoubleSide */);
      // A wall/panel-scale feature that is face-thin, OR a DoubleSide mesh faking solidity.
      const wallThin = smallest < P.thinAbs && largest >= P.thinFeature;
      const dsThin = doubleSide && smallest < P.thinDoubleSide && largest >= P.thinFeature;
      if (wallThin || dsThin) {
        flags.push({
          mesh: lib.labelOf(m, root, i),
          dims: [+dx.toFixed(3), +dy.toFixed(3), +dz.toFixed(3)],
          thinnest: +smallest.toFixed(4),
          doubleSide,
          reason: dsThin ? 'DoubleSide thin shell (faking solidity)' : 'wall-scale near-zero thickness',
        });
      }
    });
    return { pass: flags.length === 0, flags, meshes: meshes.length };
  };

  // ── Shared CONNECTIVITY pass (feeds checks 3 + 4). Per mesh: weld coincident
  //    verts (merged geometry concatenates primitives un-welded), union-find into
  //    components, tally boundary edges (used by exactly one triangle), cluster
  //    boundary edges into loops. Returns per-component world data. ──
  lib.connectivity = (root) => {
    const THREE = window.__game.THREE;
    const meshes = lib.meshesOf(root);
    const Q = 0.003;                            // 3mm weld grid
    const comps = [];                           // {meshLabel, worldMin, worldMax, loops:[{diag,count,center}], triCount}
    meshes.forEach((mesh, mi) => {
      const geo = mesh.geometry;
      const pos = geo.attributes.position;
      const index = geo.index;
      const triCount = Math.floor((index ? index.count : pos.count) / 3);
      if (triCount < 1) return;
      // Weld: quantized position -> canonical id; keep a representative local pos.
      const keyToId = new Map();
      const localPos = [];                      // canonical id -> [x,y,z] (local)
      const cornerId = (vi) => {
        const x = pos.getX(vi), y = pos.getY(vi), z = pos.getZ(vi);
        const k = `${Math.round(x / Q)}_${Math.round(y / Q)}_${Math.round(z / Q)}`;
        let id = keyToId.get(k);
        if (id === undefined) { id = localPos.length; keyToId.set(k, id); localPos.push([x, y, z]); }
        return id;
      };
      const N = () => localPos.length;
      // Union-find over canonical verts.
      const parent = [];
      const find = (a) => { while (parent[a] !== undefined && parent[a] !== a) { parent[a] = parent[parent[a]] ?? parent[a]; a = parent[a]; } return a; };
      const ensure = (a) => { if (parent[a] === undefined) parent[a] = a; };
      const uni = (a, b) => { ensure(a); ensure(b); a = find(a); b = find(b); if (a !== b) parent[b] = a; };
      const edgeCount = new Map();              // "min_max" -> tri count
      const bump = (a, b) => { const k = a < b ? `${a}_${b}` : `${b}_${a}`; edgeCount.set(k, (edgeCount.get(k) || 0) + 1); };
      const triOf = new Array(triCount);        // tri -> [ida,idb,idc]
      for (let t = 0; t < triCount; t++) {
        const va = index ? index.getX(t * 3) : t * 3;
        const vb = index ? index.getX(t * 3 + 1) : t * 3 + 1;
        const vc = index ? index.getX(t * 3 + 2) : t * 3 + 2;
        const a = cornerId(va), b = cornerId(vb), c = cornerId(vc);
        triOf[t] = [a, b, c];
        uni(a, b); uni(b, c); uni(c, a);
        bump(a, b); bump(b, c); bump(c, a);
      }
      // Group canonical ids by component root.
      const byComp = new Map();
      for (let id = 0; id < N(); id++) {
        const r = find(id);
        if (!byComp.has(r)) byComp.set(r, []);
        byComp.get(r).push(id);
      }
      // Boundary edges (count === 1), grouped by component.
      const boundaryByComp = new Map();
      for (const [k, cnt] of edgeCount) {
        if (cnt !== 1) continue;
        const [a, b] = k.split('_').map(Number);
        const r = find(a);
        if (!boundaryByComp.has(r)) boundaryByComp.set(r, []);
        boundaryByComp.get(r).push([a, b]);
      }
      const toWorld = (id) => new THREE.Vector3(localPos[id][0], localPos[id][1], localPos[id][2]).applyMatrix4(mesh.matrixWorld);
      // tris per component (for size gating)
      const triCountByComp = new Map();
      for (let t = 0; t < triCount; t++) { const r = find(triOf[t][0]); triCountByComp.set(r, (triCountByComp.get(r) || 0) + 1); }
      for (const [r, ids] of byComp) {
        if (ids.length < 3) continue;
        const wmin = new THREE.Vector3(Infinity, Infinity, Infinity);
        const wmax = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
        for (const id of ids) { const w = toWorld(id); wmin.min(w); wmax.max(w); }
        // Boundary-edge loops of THIS component: union-find over boundary endpoints.
        const bedges = boundaryByComp.get(r) || [];
        const lp = new Map();
        const lfind = (a) => { while (lp.get(a) !== undefined && lp.get(a) !== a) { lp.set(a, lp.get(lp.get(a))); a = lp.get(a); } return a; };
        const lensure = (a) => { if (lp.get(a) === undefined) lp.set(a, a); };
        const luni = (a, b) => { lensure(a); lensure(b); a = lfind(a); b = lfind(b); if (a !== b) lp.set(b, a); };
        for (const [a, b] of bedges) luni(a, b);
        const loopGroups = new Map();
        for (const [a, b] of bedges) { const lr = lfind(a); if (!loopGroups.has(lr)) loopGroups.set(lr, { verts: new Set(), edges: 0 }); const gg = loopGroups.get(lr); gg.verts.add(a); gg.verts.add(b); gg.edges++; }
        const loops = [];
        for (const gg of loopGroups.values()) {
          const lmin = new THREE.Vector3(Infinity, Infinity, Infinity);
          const lmax = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
          for (const id of gg.verts) { const w = toWorld(id); lmin.min(w); lmax.max(w); }
          const diag = lmin.distanceTo(lmax);
          const ctr = lmin.clone().add(lmax).multiplyScalar(0.5);
          loops.push({ diag, edges: gg.edges, verts: gg.verts.size, center: [+ctr.x.toFixed(2), +ctr.y.toFixed(2), +ctr.z.toFixed(2)] });
        }
        loops.sort((a2, b2) => b2.diag - a2.diag);
        comps.push({
          meshLabel: lib.labelOf(mesh, root, mi),
          worldMin: [wmin.x, wmin.y, wmin.z],
          worldMax: [wmax.x, wmax.y, wmax.z],
          tris: triCountByComp.get(r) || 0,
          loops,
        });
      }
    });
    return comps;
  };

  // ── CHECK 3 — OPEN END / UNCLOSED SOLID (large boundary loop), MINUS the asset's
  //    DECLARED intended openings (see lib.openingsOf — a detector must not call the
  //    front door a defect; that mistake is what sealed the leviathan). ──
  lib.checkOpenEnd = (comps, P, openings) => {
    const flags = [];
    const excused = [];
    let totalLoops = 0, maxDiag = 0;
    const atOpening = (centerArr) => {
      for (const op of openings || []) {
        const dx = centerArr[0] - op.center.x, dy = centerArr[1] - op.center.y, dz = centerArr[2] - op.center.z;
        if (Math.hypot(dx, dy, dz) <= op.radius) return op;
      }
      return null;
    };
    for (const c of comps) {
      for (const lp of c.loops) {
        totalLoops++;
        maxDiag = Math.max(maxDiag, lp.diag);
        if (lp.diag >= P.loopDiag && lp.edges >= P.loopEdges) {
          const op = atOpening(lp.center);
          if (op) { excused.push({ mesh: c.meshLabel, openLoopDiag: +lp.diag.toFixed(2), center: lp.center, declaredBy: op.declaredBy }); continue; }
          flags.push({ mesh: c.meshLabel, openLoopDiag: +lp.diag.toFixed(2), edges: lp.edges, center: lp.center });
        }
      }
    }
    flags.sort((a, b) => b.openLoopDiag - a.openLoopDiag);
    return { pass: flags.length === 0, flags: flags.slice(0, 12), totalOpenLoops: flags.length, maxBoundaryLoopDiag: +maxDiag.toFixed(2), intendedOpeningsExcused: excused };
  };

  // ── CHECK 4 — FLOATING. Merge the per-mesh connected components into SUPER-
  //    components by expanded-AABB overlap FIRST (mergeStaticByMaterial splits one
  //    physical solid into a mesh per material → a mast/fin becomes its own
  //    component; without this, every legit elevated-but-attached part false-flags,
  //    the model-stage floater lesson). A super-component that touches the grounded
  //    body is anchored; only a genuinely DETACHED mid-air piece flags. ──
  lib.checkFloating = (comps, P) => {
    const ctx = window.__game.ctx;
    const big = comps.filter((c) => Math.max(c.worldMax[0] - c.worldMin[0], c.worldMax[1] - c.worldMin[1], c.worldMax[2] - c.worldMin[2]) >= P.minCompSize);
    const n = big.length;
    // Union-find over components whose AABBs (expanded 0.4m) overlap.
    const par = Array.from({ length: n }, (_, i) => i);
    const find = (a) => { while (par[a] !== a) { par[a] = par[par[a]]; a = par[a]; } return a; };
    const uni = (a, b) => { a = find(a); b = find(b); if (a !== b) par[b] = a; };
    const E = 0.4;
    const overlaps = (a, b) => a.worldMin[0] - E <= b.worldMax[0] + E && a.worldMax[0] + E >= b.worldMin[0] - E
      && a.worldMin[1] - E <= b.worldMax[1] + E && a.worldMax[1] + E >= b.worldMin[1] - E
      && a.worldMin[2] - E <= b.worldMax[2] + E && a.worldMax[2] + E >= b.worldMin[2] - E;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (overlaps(big[i], big[j])) uni(i, j);
    // Aggregate super-components.
    const supers = new Map();
    for (let i = 0; i < n; i++) {
      const r = find(i);
      if (!supers.has(r)) supers.set(r, { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity], labels: new Set(), vol: 0 });
      const s = supers.get(r);
      for (let k = 0; k < 3; k++) { s.min[k] = Math.min(s.min[k], big[i].worldMin[k]); s.max[k] = Math.max(s.max[k], big[i].worldMax[k]); }
      s.labels.add(big[i].meshLabel);
      s.vol += Math.max(0.01, (big[i].worldMax[0] - big[i].worldMin[0]) * (big[i].worldMax[1] - big[i].worldMin[1]) * (big[i].worldMax[2] - big[i].worldMin[2]));
    }
    const terrMaxUnder = (min, max) => {
      let t = -Infinity; const steps = 4;
      for (let ix = 0; ix <= steps; ix++) for (let iz = 0; iz <= steps; iz++) {
        t = Math.max(t, ctx.terrain.heightAt(min[0] + ((max[0] - min[0]) * ix) / steps, min[2] + ((max[2] - min[2]) * iz) / steps));
      }
      return t;
    };
    const flags = [];
    for (const s of supers.values()) {
      const terr = terrMaxUnder(s.min, s.max);
      const gap = s.min[1] - terr;
      if (gap > P.floatTol) {
        const dx = s.max[0] - s.min[0], dy = s.max[1] - s.min[1], dz = s.max[2] - s.min[2];
        flags.push({ mesh: [...s.labels].slice(0, 3).join('+') + (s.labels.size > 3 ? `+${s.labels.size - 3}` : ''), lowestY: +s.min[1].toFixed(2), terrainY: +terr.toFixed(2), gap: +gap.toFixed(2), sizeM: +Math.max(dx, dy, dz).toFixed(1) });
      }
    }
    flags.sort((a, b) => b.gap - a.gap);
    return { pass: flags.length === 0, flags: flags.slice(0, 12), floatingComponents: flags.length, superComponents: supers.size };
  };

  // ── CHECK 2 — BACKFACE / SEE-THROUGH (offscreen front/back render sweep). ──
  lib.checkBackface = (root, center, P, probe) => {
    const g = window.__game; const ctx = g.ctx; const THREE = g.THREE;
    const renderer = ctx.three.renderer; const scene = ctx.three.scene;
    // Front=white / back=magenta, DoubleSide so the NEAREST surface wins: if a back
    // face is the nearest thing along a pixel, no front face covers it ⇒ see-through.
    const mat = new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      vertexShader: 'void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'void main(){ gl_FragColor = gl_FrontFacing ? vec4(1.0,1.0,1.0,1.0) : vec4(1.0,0.0,1.0,1.0); }',
    });
    const S = P.rtSize;
    const rt = new THREE.WebGLRenderTarget(S, S);
    const cam = new THREE.PerspectiveCamera(45, 1, 0.05, Math.max(center.radius * 40, 200));
    const buf = new Uint8Array(S * S * 4);
    const c = new THREE.Vector3(center.x, center.y, center.z);
    const r = center.radius;
    const dist = (r / Math.sin((22.5 * Math.PI) / 180)) * 1.15;

    // Save + neutralize scene render state.
    const prevOverride = scene.overrideMaterial;
    const prevBg = scene.background, prevFog = scene.fog, prevEnv = scene.environment;
    const prevTarget = renderer.getRenderTarget();
    const prevClear = renderer.getClearColor(new THREE.Color()); const prevClearA = renderer.getClearAlpha();
    const prevVis = new Map();
    for (const ch of scene.children) { prevVis.set(ch, ch.visible); ch.visible = (ch === root); }
    scene.overrideMaterial = mat; scene.background = null; scene.fog = null; scene.environment = null;
    renderer.setClearColor(0x000000, 1);

    const shots = [];
    // EXTERIOR orbit sweep: grazing + slightly-below + above (below/graze reveal open
    // bellies + torn ends). From OUTSIDE, a closed correctly-wound solid shows ZERO
    // back-faces — so these are the GATING shots.
    for (const el of [8, -18, 30]) {
      for (let az = 0; az < 360; az += 30) {
        const a = (az * Math.PI) / 180, e = (el * Math.PI) / 180;
        shots.push({ name: `orbit-el${el}-az${az}`, interior: false, pos: [c.x + Math.sin(a) * Math.cos(e) * dist, c.y + Math.sin(e) * dist, c.z + Math.cos(a) * Math.cos(e) * dist], look: [c.x, c.y, c.z] });
      }
    }
    // INTERIOR / into-the-opening views (the player's-eye money shots per the
    // verify-visual-multi-angle memory). REPORTED but NOT gating: a single-shell
    // walkable hull legitimately shows its (back-facing) inner skin from inside, so
    // a high interior back-face % is expected, not a defect.
    if (probe) {
      const wp = Object.fromEntries(probe.waypoints.map((w) => [w.name, w]));
      const head = 1.4;
      if (wp.outside && wp.hold) {
        shots.push({ name: 'into-opening', interior: true, pos: [wp.outside.x, wp.outside.y + head, wp.outside.z], look: [wp.hold.x, wp.hold.y + head, wp.hold.z] });
        shots.push({ name: 'interior-out', interior: true, pos: [wp.hold.x, wp.hold.y + head, wp.hold.z], look: [wp.outside.x, wp.outside.y + head, wp.outside.z] });
      }
      const deepest = probe.waypoints[probe.waypoints.length - 1];
      if (deepest && wp.hold) shots.push({ name: 'interior-aft', interior: true, pos: [wp.hold.x, wp.hold.y + head, wp.hold.z], look: [deepest.x, deepest.y + head, deepest.z] });
    }

    const results = [];
    for (const shot of shots) {
      cam.position.set(shot.pos[0], shot.pos[1], shot.pos[2]);
      cam.lookAt(shot.look[0], shot.look[1], shot.look[2]);
      cam.updateMatrixWorld(true);
      renderer.setRenderTarget(rt);
      renderer.clear();
      renderer.render(scene, cam);
      renderer.readRenderTargetPixels(rt, 0, 0, S, S, buf);
      let sil = 0, back = 0;
      for (let i = 0; i < buf.length; i += 4) {
        const R = buf[i], G = buf[i + 1], B = buf[i + 2];
        if (R > 40 || G > 40 || B > 40) sil++;                 // any lit surface (bg is black)
        if (R > 150 && B > 150 && G < 80) back++;              // magenta = a visible BACK face
      }
      const frac = sil > 0 ? back / sil : 0;
      results.push({ name: shot.name, interior: !!shot.interior, silhouette: sil, back, frac: +frac.toFixed(4) });
    }

    // Restore.
    scene.overrideMaterial = prevOverride; scene.background = prevBg; scene.fog = prevFog; scene.environment = prevEnv;
    renderer.setRenderTarget(prevTarget);
    renderer.setClearColor(prevClear, prevClearA);
    for (const [ch, v] of prevVis) ch.visible = v;
    rt.dispose(); mat.dispose();

    // GATE on EXTERIOR shots only (interior back-faces are expected for a shell).
    const ext = results.filter((s) => !s.interior && s.silhouette >= P.minSilhouette);
    const bad = ext.filter((s) => s.frac > P.bleedFrac).sort((a, b) => b.frac - a.frac);
    const worst = ext.slice().sort((a, b) => b.frac - a.frac)[0];
    const interiorInfo = results.filter((s) => s.interior && s.silhouette >= P.minSilhouette)
      .map((s) => ({ angle: s.name, backfacePct: +(s.frac * 100).toFixed(2) }));
    return {
      pass: bad.length === 0,
      seeThroughAngles: bad.slice(0, 8).map((s) => ({ angle: s.name, backfacePct: +(s.frac * 100).toFixed(2) })),
      worstExteriorAngle: worst ? { angle: worst.name, backfacePct: +(worst.frac * 100).toFixed(2) } : null,
      interiorViews_informational: interiorInfo,
      shotsRendered: results.length,
    };
  };

  /** Temporarily force every asset material to DoubleSide so raycasts hit BOTH
   *  faces (a FrontSide inner wall is a back face → Raycaster would cull it and the
   *  ray would tunnel through). Returns a restore fn. */
  lib.forceDoubleSide = (root) => {
    const saved = [];
    lib.meshesOf(root).forEach((m) => {
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      mats.forEach((mt) => { if (mt) { saved.push([mt, mt.side]); mt.side = 2 /* DoubleSide */; } });
    });
    return () => { for (const [mt, s] of saved) mt.side = s; };
  };

  // ── CHECK 5 — COLLISION ≠ VISUAL (negative walk-probe; enclosure assets). ──
  lib.checkCollision = (root, center, probe, P) => {
    const g = window.__game; const ctx = g.ctx; const THREE = g.THREE; const RAPIER = g.RAPIER;
    const restore = lib.forceDoubleSide(root);
    const rc = new THREE.Raycaster(); rc.far = center.radius * 4;
    // Aim at the HORIZONTAL centre; fire at PLAYER heights above the ground under
    // the asset — NOT the bbox-centre y (a mast/floater inflates the sphere so a
    // centre-height ray would test mid-air fins, not the walls a player walks into).
    const c = new THREE.Vector3(center.x, 0, center.z);
    const groundY = ctx.terrain.heightAt(center.x, center.z);
    const halfX = (center.max[0] - center.min[0]) / 2, halfZ = (center.max[2] - center.min[2]) / 2;
    const R = Math.hypot(halfX, halfZ) * 1.4 + 3;
    const excludeBody = ctx.player.body.body;
    const walkThrough = [];
    let valid = 0;
    // Ring of exterior rays aimed at the hull at 3 chest-ish heights above ground.
    for (const dy of [0.6, 1.2, 1.8]) {
      for (let az = 0; az < 360; az += 20) {
        const a = (az * Math.PI) / 180;
        const origin = new THREE.Vector3(c.x + Math.cos(a) * R, groundY + dy, c.z + Math.sin(a) * R);
        const dir = new THREE.Vector3(c.x - origin.x, 0, c.z - origin.z).normalize();
        // First VISIBLE surface hit.
        rc.set(origin, dir);
        const hits = rc.intersectObject(root, true);
        if (!hits.length) continue;                             // ray missed the asset at this height
        const meshDist = hits[0].distance;
        const pt = hits[0].point;
        if (pt.y < ctx.terrain.heightAt(pt.x, pt.z) + 0.05) continue;  // grazing the sand — not a wall
        valid++;
        // First COLLIDER hit along the same ray (exclude the player capsule).
        const ray = new RAPIER.Ray({ x: origin.x, y: origin.y, z: origin.z }, { x: dir.x, y: dir.y, z: dir.z });
        const chit = ctx.physics.world.castRay(ray, R * 3, true, undefined, undefined, undefined, excludeBody);
        const colDist = chit ? chit.timeOfImpact : Infinity;
        // A collider BEFORE the visible surface = terrain/other in the way ⇒ skip (not a hull test).
        if (colDist < meshDist - 0.05) continue;
        // Visible surface with no collider within +penTol ⇒ you walk through the wall.
        if (colDist === Infinity || colDist > meshDist + P.penTol) {
          walkThrough.push({ at: [+pt.x.toFixed(1), +pt.y.toFixed(1), +pt.z.toFixed(1)], meshDist: +meshDist.toFixed(2), colliderDist: colDist === Infinity ? 'none' : +colDist.toFixed(2), gap: colDist === Infinity ? 'inf' : +(colDist - meshDist).toFixed(2) });
        }
      }
    }
    // Positive: floor is solid at interior waypoints; the mouth is a real opening.
    const floorFails = [];
    let openingOk = null;
    if (probe) {
      const floorSet = new Set(probe.floorHandles || [probe.deckHandle]);
      const interior = probe.waypoints.filter((w) => !/outside|mouth/.test(w.name));
      for (const w of interior) {
        // Cast a small CLUSTER from chest height (below the ~2.1m ceiling): a single
        // vertical point-cast can miss a TILTED thin deck collider at a waypoint's edge
        // (the walk gate rests a capsule ON it — robust; a point-ray is not). Pass if
        // ANY sample lands on a floor collider / near the deck line; only a genuine
        // metres-deep drop at every sample fails.
        let onFloor = false; let last = null;
        for (const [ox, oz] of [[0, 0], [0.2, 0], [-0.2, 0], [0, 0.2], [0, -0.2]]) {
          const hit = g.castDown(w.x + ox, w.z + oz, w.y + 1.2, true);
          if (!hit) continue;
          last = hit;
          if (floorSet.has(hit.colliderHandle) || (hit.hitY >= w.y - 0.25 && hit.hitY <= w.y + 0.5)) { onFloor = true; break; }
        }
        if (!onFloor) floorFails.push(last ? `${w.name}: no floor under it (nearest hitY=${last.hitY.toFixed(2)} deckY=${w.y.toFixed(2)})` : `${w.name}: castDown hit nothing`);
      }
      // The intended opening must NOT be collider-blocked at head height across the mouth.
      const wp = Object.fromEntries(probe.waypoints.map((w) => [w.name, w]));
      if (wp.outside && wp.hold) {
        const o = new THREE.Vector3(wp.outside.x, wp.outside.y + 1.2, wp.outside.z);
        const d = new THREE.Vector3(wp.hold.x - o.x, 0, wp.hold.z - o.z); const dist = d.length(); d.normalize();
        const ray = new RAPIER.Ray({ x: o.x, y: o.y, z: o.z }, { x: d.x, y: d.y, z: d.z });
        const chit = ctx.physics.world.castRay(ray, dist, true, undefined, undefined, undefined, excludeBody);
        openingOk = !chit;                                      // no collider blocking the doorway = intended opening passable
      }
    }
    restore();
    const flagFrac = valid > 0 ? walkThrough.length / valid : 0;
    const wallPass = !(walkThrough.length >= P.collFlagMin || flagFrac > P.collFlagFrac);
    walkThrough.sort((a, b) => (b.gap === 'inf' ? 1e9 : b.gap) - (a.gap === 'inf' ? 1e9 : a.gap));
    // GATE on the exterior-wall walk-through only — that is the NOVEL, reliable signal
    // (a visible solid with no collision in front of it). Fall-through + open-doorway
    // are WARN-only cross-checks here: the authoritative fall-through gates are the
    // settled-capsule skyfall-walk / leviathan-walk probes (a single vertical point-cast
    // fragilely misses a tilted thin deck collider, unlike a resting capsule).
    return {
      pass: wallPass,
      exteriorWalkThrough: { pass: wallPass, rays: valid, walkThroughRays: walkThrough.length, frac: +flagFrac.toFixed(2), samples: walkThrough.slice(0, 8) },
      solidFloor_warn: { pass: floorFails.length === 0, fails: floorFails, note: 'defer to skyfall-walk/leviathan-walk for authoritative fall-through' },
      openingPassable_warn: openingOk,
    };
  };

  // ── CHECK 6 — EXTERIOR/INTERIOR SEAM + ENTRANCE ALIGNMENT (enclosure+probe). ──
  lib.checkSeam = (root, center, probe, P) => {
    const g = window.__game; const ctx = g.ctx; const THREE = g.THREE;
    const restore = lib.forceDoubleSide(root);
    const rc = new THREE.Raycaster(); rc.far = center.radius * 4;
    const wp = Object.fromEntries(probe.waypoints.map((w) => [w.name, w]));
    const head = 1.4;
    const flags = [];
    const V = (w, up = head) => new THREE.Vector3(w.x, w.y + up, w.z);
    const hitDist = (from, to) => {
      const dir = to.clone().sub(from); const dist = dir.length(); dir.normalize();
      rc.set(from, dir); rc.far = dist + 0.01;
      const hits = rc.intersectObject(root, true);
      return hits.length ? hits[0].distance : Infinity;
    };
    // A. Exterior opening must LEAD to the interior (not a wall right at the mouth).
    if (wp.outside && wp.mouth && wp.hold) {
      const outToMouth = Math.hypot(wp.outside.x - wp.mouth.x, wp.outside.z - wp.mouth.z);
      const d = hitDist(V(wp.outside), V(wp.hold));
      if (d < outToMouth + 0.8) flags.push({ test: 'exterior-opening-faces-wall', hitAt: +d.toFixed(2), expectedClearTo: +(outToMouth + 0.8).toFixed(2) });
    }
    // B. Interior mouth must see DAYLIGHT out (not the exterior hull — opening elsewhere).
    if (wp.hold && wp.outside) {
      const holdToOut = Math.hypot(wp.hold.x - wp.outside.x, wp.hold.z - wp.outside.z);
      const d = hitDist(V(wp.hold), V(wp.outside));
      if (d < holdToOut - 0.3) flags.push({ test: 'interior-mouth-faces-hull', hitAt: +d.toFixed(2), expectedDaylightAt: +holdToOut.toFixed(2) });
    }
    // C. Interior daylight FAN — an enclosed hull with one intended mouth should
    //    escape to daylight in ~ONE arc. Extra arcs = open torn ends / shell gaps.
    const interior = probe.waypoints.filter((w) => !/outside/.test(w.name));
    const ctr = interior.reduce((acc, w) => { acc.x += w.x; acc.z += w.z; acc.y += w.y; return acc; }, { x: 0, y: 0, z: 0 });
    ctr.x /= interior.length; ctr.z /= interior.length; ctr.y /= interior.length;
    const from = new THREE.Vector3(ctr.x, ctr.y + head, ctr.z);
    const escapes = [];
    for (let k = 0; k < P.fanRays; k++) {
      const a = (k / P.fanRays) * Math.PI * 2;
      const dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
      rc.set(from, dir); rc.far = center.radius * 2.4;
      const hits = rc.intersectObject(root, true);
      escapes.push(hits.length ? 0 : 1);                        // 1 = ray escaped to daylight
    }
    // Cluster contiguous escape azimuths into arcs (circular).
    const arcs = [];
    let k0 = 0; while (k0 < P.fanRays && escapes[k0] === 1 && escapes[P.fanRays - 1] === 1) k0++;  // rotate off a wrap-boundary arc
    let run = 0;
    for (let s = 0; s < P.fanRays; s++) {
      const k = (k0 + s) % P.fanRays;
      if (escapes[k] === 1) run++;
      else { if (run > 0) arcs.push(run); run = 0; }
    }
    if (run > 0) arcs.push(run);
    const escArcs = arcs.length;
    const escRays = escapes.reduce((a2, b2) => a2 + b2, 0);
    if (escArcs >= 2) flags.push({ test: 'extra-daylight-arcs', arcs: escArcs, escapeRays: escRays, note: 'more than one open direction — torn end / shell gap beyond the intended mouth' });
    restore();
    return { pass: flags.length === 0, flags, daylightArcs: escArcs, escapeRays: escRays };
  };

  // ── CHECK 7 — WALK-IN PROOF (can a player actually GET IN from outside?). ──
  //
  //  This is the check that should have caught the sealed leviathan. It differs from
  //  `seam` in the two ways that matter:
  //
  //   1. It DERIVES its own "outside" instead of trusting the builder's `outside`
  //      waypoint. The leviathan's declared `outside` sat inside the reared bow's
  //      decorative bore — a pocket of air fully enclosed by hull — so every probe
  //      that started there was already indoors and every gate passed on a hermetic
  //      wreck. A start point qualifies only if a ray STRAIGHT UP from it escapes
  //      both the asset's geometry AND the collider world: you cannot be under a
  //      roof, in a bore, or inside the hull and still see 60m of open sky.
  //   2. It proves passage with a swept PLAYER-RADIUS SPHERE against the real
  //      colliders at real floor height (castDown per step), not a zero-radius ray.
  //      A ray threads a 10cm slot; a player does not.
  //
  //  Target = the declared intended opening if the builder stashed one, else the
  //  probe's `mouth`. Passing requires ≥1 verifiably-outside start to reach the
  //  interior with the sphere never overlapping a collider.
  lib.checkWalkIn = (root, center, probe, P, openings) => {
    const g = window.__game; const ctx = g.ctx; const THREE = g.THREE; const RAPIER = g.RAPIER;
    if (!probe) return { pass: true, na: 'no probe waypoints (builder declares no interior)' };
    const wps = Object.fromEntries(probe.waypoints.map((w) => [w.name, w]));
    const target = openings && openings.length
      ? { x: openings[0].center.x, y: openings[0].center.y, z: openings[0].center.z }
      : (wps.mouth || wps.entry);
    const inner = wps.hold || wps.interior || probe.waypoints[Math.min(2, probe.waypoints.length - 1)];
    if (!target || !inner) return { pass: false, flags: [{ test: 'no-entrance-declared', note: 'asset declares neither userData.intendedOpening nor a `mouth` waypoint — cannot prove walk-in' }] };

    const excludeBody = ctx.player.body.body;
    const restore = lib.forceDoubleSide(root);
    const rc = new THREE.Raycaster();
    const UP = new THREE.Vector3(0, 1, 0);
    const R = P.playerRadius;
    const ball = new RAPIER.Ball(R);
    const IDQ = { x: 0, y: 0, z: 0, w: 1 };

    /** Verifiably OUTSIDE: 60m of clear sky straight up — no asset geometry, no
     *  collider. Rejects "inside the hull", "inside a bore", "under the prow". */
    const isOutside = (p) => {
      rc.set(p, UP); rc.far = P.walkClearUp;
      if (rc.intersectObject(root, true).length) return false;
      const ray = new RAPIER.Ray({ x: p.x, y: p.y, z: p.z }, { x: 0, y: 1, z: 0 });
      return !ctx.physics.world.castRay(ray, P.walkClearUp, true, undefined, undefined, undefined, excludeBody);
    };

    // Candidate starts: a ring around the entrance, at chest height over the sand.
    const starts = [];
    for (let i = 0; i < P.walkStarts; i++) {
      const a = (i / P.walkStarts) * Math.PI * 2;
      const x = target.x + Math.cos(a) * P.walkStartRing, z = target.z + Math.sin(a) * P.walkStartRing;
      const p = new THREE.Vector3(x, ctx.terrain.heightAt(x, z) + R + 1.0, z);
      starts.push({ deg: Math.round((a * 180) / Math.PI), p, outside: isOutside(p) });
    }
    const outsideStarts = starts.filter((s) => s.outside);

    /** March the sphere along a polyline in PLAN, riding whatever floor is under each
     *  step. Returns null on success, else the first blocked sample.
     *
     *  The floor search deliberately starts only `walkProbeUp` above the PREVIOUS
     *  step's centre rather than from a fixed height above a straight chord. Two
     *  reasons, both learned the hard way here: a chord between an outside point and a
     *  doorway dives under a sand ramp (so a cast from the chord starts below the ramp,
     *  misses it, finds terrain, and reports the sphere buried in a ramp it should be
     *  standing on); and a cast from generously high inside a hull finds the ROOF and
     *  walks the sphere along the ceiling. Tracking the previous foot position does
     *  what a walking capsule does — and a floor more than `walkProbeUp` above the last
     *  one is a ledge no player could climb anyway, so failing there is correct. */
    const march = (pts) => {
      let y = pts[0].y;
      for (let seg = 0; seg < pts.length - 1; seg++) {
        const a = pts[seg], b = pts[seg + 1];
        const len = Math.hypot(b.x - a.x, b.z - a.z);
        const n = Math.max(1, Math.ceil(len / P.walkStep));
        for (let s = 1; s <= n; s++) {
          const t = s / n;
          const x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t;
          const hit = g.castDown(x, z, y + P.walkProbeUp, true);
          const floor = Math.max(hit ? hit.hitY : -Infinity, ctx.terrain.heightAt(x, z));
          y = floor + R + P.walkFloorLift;
          const c = ctx.physics.world.intersectionWithShape(
            { x, y, z }, IDQ, ball, undefined, undefined, undefined, excludeBody);
          if (c !== null && c !== undefined) return { at: [+x.toFixed(1), +y.toFixed(1), +z.toFixed(1)], seg };
        }
      }
      return null;
    };

    const tries = [];
    let reached = null;
    for (const s of outsideStarts) {
      const path = [s.p, new THREE.Vector3(target.x, target.y + 1.0, target.z), new THREE.Vector3(inner.x, inner.y + 1.0, inner.z)];
      const blocked = march(path);
      tries.push({ fromDeg: s.deg, ok: !blocked, blockedAt: blocked ? blocked.at : null, leg: blocked ? (blocked.seg === 0 ? 'outside→entrance' : 'entrance→interior') : null });
      if (!blocked && !reached) reached = s.deg;
    }
    restore();

    const flags = [];
    if (!outsideStarts.length) flags.push({ test: 'no-verifiably-outside-start', note: `all ${P.walkStarts} ring candidates at ${P.walkStartRing}m had asset geometry or a collider overhead — the asset engulfs its own surroundings` });
    else if (reached === null) flags.push({ test: 'no-walk-in-path', note: `a ${(R * 2).toFixed(2)}m player sphere could not reach the interior from ANY of the ${outsideStarts.length} verifiably-outside starts — the interior is SEALED`, blocked: tries.filter((t) => !t.ok).slice(0, 6) });
    return {
      pass: flags.length === 0,
      flags,
      entranceTarget: [+target.x.toFixed(1), +target.y.toFixed(1), +target.z.toFixed(1)],
      entranceSource: openings && openings.length ? `declared (${openings[0].declaredBy})` : 'probe mouth waypoint',
      verifiablyOutsideStarts: `${outsideStarts.length}/${P.walkStarts}`,
      walkInsReached: `${tries.filter((t) => t.ok).length}/${outsideStarts.length}`,
      reachedFromAzimuthDeg: reached,
      tries: tries.slice(0, 16),
    };
  };

  // ── SELF-TEST: synthetic defect + control rig; asserts each geometry detector. ──
  lib.selftest = (P) => {
    const THREE = window.__game.THREE;
    const ctx = window.__game.ctx;
    const bp = ctx.player.body.body.translation();
    const ox = bp.x + 40, oz = bp.z, gy = ctx.terrain.heightAt(ox, oz);
    const root = new THREE.Group(); root.name = 'solidSelfTest'; root.position.set(ox, gy, oz);
    const mk = (geo, name, mat) => { const m = new THREE.Mesh(geo, mat || new THREE.MeshBasicMaterial({ color: 0x888888 })); m.name = name; return m; };
    // 1. paper-thin DoubleSide plane (a fake wall).
    const thinPlane = mk(new THREE.PlaneGeometry(3, 2.5), 'thinDoubleSideWall', new THREE.MeshBasicMaterial({ color: 0x8899aa, side: THREE.DoubleSide }));
    thinPlane.position.set(0, 1.6, 0); root.add(thinPlane);
    // 2/3. an OPEN-ended tube (cylinder, no caps) — see-through + a big boundary loop.
    //   Force NON-INDEXED geometry: the real hero assets are static-merged to
    //   non-indexed buffers (mergeStaticByMaterial → toNonIndexed), so the boundary/
    //   connectivity path MUST be proven on the non-indexed representation too.
    const openTube = mk(new THREE.CylinderGeometry(1.1, 1.1, 3.0, 20, 1, true).toNonIndexed(), 'openEndTube');
    openTube.rotation.z = Math.PI / 2; openTube.position.set(6, 1.3, 0); root.add(openTube);
    // control: a CLOSED solid box (must NOT trip open/thin/backface).
    const solidBox = mk(new THREE.BoxGeometry(2, 2, 2), 'solidControlBox');
    solidBox.position.set(-6, 1.0, 0); root.add(solidBox);
    // 4. a floating cube well above ground (separate component, mid-air).
    const floater = mk(new THREE.BoxGeometry(1.2, 1.2, 1.2), 'floatingCube');
    floater.position.set(0, 8.0, 8); root.add(floater);
    ctx.three.scene.add(root);
    root.updateMatrixWorld(true);
    const center = lib.centerOf(root);
    const comps = lib.connectivity(root);
    const thin = lib.checkThin(root, P);
    const open = lib.checkOpenEnd(comps, P);
    const floating = lib.checkFloating(comps, P);
    const backface = lib.checkBackface(root, center, P, null);
    // A synthetic ENCLOSURE for the seam detector: a box room with the intended
    // mouth on -Z AND an unintended torn-open hole on +X. The interior daylight fan
    // must see TWO escape arcs (mouth + hole) ⇒ the seam check flags the extra hole.
    const room = new THREE.Group(); room.name = 'seamTestRoom'; room.position.set(ox, gy + 20, oz + 25);
    const wallMat = new THREE.MeshBasicMaterial({ color: 0x777777, side: THREE.FrontSide });
    const wall = (w, h, d, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat); m.position.set(x, y, z); room.add(m); };
    wall(4.4, 0.3, 4.4, 0, -1.4, 0); wall(4.4, 0.3, 4.4, 0, 1.4, 0);       // floor + roof
    wall(0.3, 3, 4.4, -2.2, 0, 0);                                          // -X wall (solid)
    wall(1.4, 3, 0.3, -1.5, 0, 2.2); wall(1.4, 3, 0.3, 1.5, 0, 2.2);       // +Z wall (solid)
    wall(1.4, 3, 0.3, -1.5, 0, -2.2); wall(1.4, 3, 0.3, 1.5, 0, -2.2);     // -Z wall w/ centre MOUTH gap
    wall(0.3, 3, 1.4, 2.2, 0, -1.5); wall(0.3, 3, 1.4, 2.2, 0, 1.5);       // +X wall w/ centre torn HOLE gap
    ctx.three.scene.add(room); room.updateMatrixWorld(true);
    const roomC = lib.centerOf(room);
    const roomProbe = { deckHandle: -1, floorHandles: [], waypoints: [
      { name: 'outside', x: roomC.x, y: roomC.y - 1.2, z: roomC.z - 4 },
      { name: 'mouth', x: roomC.x, y: roomC.y - 1.2, z: roomC.z - 2.6 },
      { name: 'hold', x: roomC.x, y: roomC.y - 1.2, z: roomC.z },
    ] };
    const seam = lib.checkSeam(room, roomC, roomProbe, P);
    ctx.three.scene.remove(room);
    // Assertions.
    const asserts = [];
    const A = (name, ok) => asserts.push({ name, ok });
    A('thin: flags the DoubleSide plane', thin.flags.some((f) => /thinDoubleSide/i.test(f.mesh)));
    A('thin: does NOT flag the solid box', !thin.flags.some((f) => /solidControlBox/i.test(f.mesh)));
    A('openend: flags the open tube', open.flags.some((f) => /openEndTube/i.test(f.mesh)));
    A('openend: does NOT flag the solid box', !open.flags.some((f) => /solidControlBox/i.test(f.mesh)));
    A('floating: flags the mid-air cube', floating.flags.some((f) => /floatingCube/i.test(f.mesh)));
    A('backface: sees through the open tube (>1%)', !backface.pass);
    A('seam: flags the extra torn-open hole (2 daylight arcs)', !seam.pass && seam.flags.some((f) => f.test === 'extra-daylight-arcs'));
    ctx.three.scene.remove(root);
    return { pass: asserts.every((a) => a.ok), asserts, detail: { thin, open, floating, backface, seam } };
  };

  // ── ORCHESTRATOR: spawn + run all applicable checks for one asset. ──
  lib.run = async (name, cfg) => {
    const spawn = await lib.spawnAsset(name, cfg.viteUrls);
    if (spawn.skip) return { name, skip: spawn.skip };
    const g = window.__game;
    // Refresh the QueryPipeline: Rapier `castRay`/`castDown` read the QueryPipeline,
    // which only rebuilds on `world.step()`. The asset is spawned while PAUSED (so
    // the sim can't perturb it), so its freshly-created colliders are NOT yet in the
    // query pipeline — without this step castRay would MISS every collider added at
    // spawn-time and the collision/floor checks would FALSE-FLAG a perfectly-collided
    // asset as walk-through (a stale-pipeline detector bug, not a geometry defect).
    // One step with the player idle doesn't move the static wreck. (leviathan is
    // boot-placed + already stepped, so it was unaffected; skyfall/ribcage build at
    // spawn-time and need this.)
    try { g.ctx.physics.world.step(); } catch { /* best effort */ }
    const root = g.ctx.three.scene.getObjectByName(spawn.rootName);
    const center = spawn.center;
    const probe = lib.probeOf(root);
    const P = cfg.params;
    const comps = lib.connectivity(root);
    const openings = lib.openingsOf(root, cfg);
    const out = { name, rootName: spawn.rootName, enclosure: cfg.enclosure, center: { x: +center.x.toFixed(1), y: +center.y.toFixed(1), z: +center.z.toFixed(1), radius: +center.radius.toFixed(1) }, hasProbe: !!probe, declaredOpenings: openings.map((o) => ({ at: [+o.center.x.toFixed(1), +o.center.y.toFixed(1), +o.center.z.toFixed(1)], radius: +o.radius.toFixed(1), by: o.declaredBy })), checks: {} };
    out.checks.thin = lib.checkThin(root, P);
    out.checks.backface = lib.checkBackface(root, center, P, probe);
    out.checks.openend = lib.checkOpenEnd(comps, P, openings);
    out.checks.floating = lib.checkFloating(comps, P);
    if (cfg.enclosure) {
      out.checks.collision = lib.checkCollision(root, center, probe, P);
      out.checks.seam = probe ? lib.checkSeam(root, center, probe, P) : { pass: true, na: 'no probe waypoints' };
      out.checks.walkin = lib.checkWalkIn(root, center, probe, P, openings);
    } else {
      out.checks.collision = { na: 'open structure (walk-through by design) — exterior-wall probe not applicable' };
      out.checks.seam = { na: 'open structure — no enclosed entrance to seam-check' };
      out.checks.walkin = { na: 'open structure — walk-THROUGH by design, no entrance to prove' };
    }
    return out;
  };

  window.__solidLib = lib;
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// NODE HARNESS (the rig-shot pattern: own Vite dev server + chromium).
// ─────────────────────────────────────────────────────────────────────────────
function startDev(port) {
  const isWin = process.platform === 'win32';
  const cmd = isWin ? 'npm.cmd' : 'npm';
  const proc = spawn(cmd, ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: ROOT, shell: isWin });
  let exited = false;
  proc.on('exit', () => { exited = true; });
  proc.stdout.on('data', () => {});
  proc.stderr.on('data', () => {});
  return new Promise((res, rej) => {
    const start = Date.now();
    const tick = async () => {
      if (exited) return rej(new Error(`dev server exited early (is port ${port} free?)`));
      if (Date.now() - start > 40000) { proc.kill(); return rej(new Error('dev server not ready in 40s')); }
      try { const r = await fetch(`http://127.0.0.1:${port}/`); if (r.ok) return res(proc); } catch { /* not up */ }
      setTimeout(tick, 300);
    };
    tick();
  });
}

const CHECK_ORDER = ['thin', 'backface', 'openend', 'floating', 'collision', 'seam', 'walkin'];
const CHECK_LABEL = {
  thin: '1 thin-shell', backface: '2 backface/see-through', openend: '3 open-end',
  floating: '4 floating', collision: '5 collision-vs-visual', seam: '6 seam/entrance',
  walkin: '7 walk-in from outside',
};

function reportAsset(a) {
  const lines = [];
  if (a.skip) { lines.push(`\n── ${a.name}: SKIPPED — ${a.skip}`); return { lines, failed: 0, flagged: 0 }; }
  lines.push(`\n── ${a.name} (${a.rootName}) — center [${a.center.x}, ${a.center.y}, ${a.center.z}] r${a.center.radius}m · ${a.enclosure ? 'enclosure' : 'open structure'} · probe=${a.hasProbe}`);
  if (a.declaredOpenings && a.declaredOpenings.length) for (const o of a.declaredOpenings) lines.push(`   declared entrance @ [${o.at}] r${o.radius}m (by ${o.by})`);
  else if (a.enclosure) lines.push('   declared entrance: NONE (walk-in aims at the probe `mouth` waypoint)');
  let failed = 0, flagged = 0;
  for (const key of CHECK_ORDER) {
    const c = a.checks[key];
    if (!c) continue;
    if (c.na) { lines.push(`   [ N/A ] ${CHECK_LABEL[key]} — ${c.na}`); continue; }
    const ok = c.pass;
    if (!ok) { failed++; flagged++; }
    lines.push(`   [${ok ? ' OK ' : 'FLAG'}] ${CHECK_LABEL[key]}`);
    if (ok) continue;
    // Per-check flag detail.
    if (key === 'thin') for (const f of c.flags.slice(0, 6)) lines.push(`          · ${f.mesh}  dims ${JSON.stringify(f.dims)} thinnest ${f.thinnest}m  (${f.reason})`);
    if (key === 'backface') { for (const s of c.seeThroughAngles) lines.push(`          · ${s.angle}: ${s.backfacePct}% back-faces visible`); }
    if (key === 'openend') for (const f of c.flags.slice(0, 6)) lines.push(`          · ${f.mesh}  open loop Ø${f.openLoopDiag}m (${f.edges} edges) @ ${JSON.stringify(f.center)}`);
    if (key === 'floating') for (const f of c.flags.slice(0, 6)) lines.push(`          · ${f.mesh}  lowest ${f.lowestY}m vs terrain ${f.terrainY}m → floats ${f.gap}m (${f.sizeM}m piece)`);
    if (key === 'collision') {
      const e = c.exteriorWalkThrough;
      if (e && !e.pass) { lines.push(`          · exterior walk-through: ${e.walkThroughRays}/${e.rays} rays (${(e.frac * 100).toFixed(0)}%) hit a visible wall with no collision`); for (const s of e.samples.slice(0, 5)) lines.push(`              - at ${JSON.stringify(s.at)} visibleSurface ${s.meshDist}m, collider ${s.colliderDist}m (gap ${s.gap})`); }
      if (c.solidFloor_warn && !c.solidFloor_warn.pass) for (const f of c.solidFloor_warn.fails) lines.push(`          · floor WARN (cross-check walk-gate): ${f}`);
      if (c.openingPassable_warn === false) lines.push('          · opening WARN: intended opening reads collider-BLOCKED (cross-check walk-gate)');
    }
    if (key === 'seam') for (const f of c.flags) lines.push(`          · ${f.test}: ${JSON.stringify(f)}`);
    if (key === 'walkin') {
      lines.push(`          · entrance target [${c.entranceTarget}] — ${c.entranceSource}`);
      lines.push(`          · verifiably-outside starts: ${c.verifiablyOutsideStarts} · walk-ins reached: ${c.walkInsReached}`);
      for (const f of c.flags) lines.push(`          · ${f.test}: ${f.note}`);
      if (c.flags.some((f) => f.blocked)) for (const b of (c.flags.find((f) => f.blocked).blocked || [])) lines.push(`              - from az${b.fromDeg}°: blocked on ${b.leg} at ${JSON.stringify(b.blockedAt)}`);
    }
  }
  return { lines, failed, flagged };
}

async function main() {
  const viteUrls = { ribcage: '/src/world/giantRibcage.ts', rng: '/src/core/rng.ts', poiAssembler: '/src/world/poiAssembler.ts' };

  if (ASSET !== 'selftest' && !ASSET_DEFS[RUN_LIST[0]] && ASSET !== 'all') {
    console.error(`[verify:solid] unknown --asset "${ASSET}" (skyfall|leviathan|ribcage|all|selftest)`);
    process.exit(2);
  }

  console.log(`[verify:solid] starting dev server on ${PORT}…`);
  const dev = await startDev(PORT);
  console.log('[verify:solid] dev up; launching chromium…');
  const browser = await chromium.launch({
    args: (process.env.RIG_GL === 'swiftshader'
      ? ['--enable-webgl', '--use-angle=swiftshader', '--ignore-gpu-blocklist']
      : ['--enable-webgl', '--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist']),
  });
  let exitCode = 0;
  try {
    const bctx = await browser.newContext({ viewport: { width: 900, height: 900 }, deviceScaleFactor: 1 });
    const page = await bctx.newPage();
    page.on('pageerror', (e) => console.log(`  [page error] ${e.message}`));
    page.on('console', (m) => { if (m.type() === 'error') console.log(`  [browser error] ${m.text()}`); });
    await page.addInitScript(() => {
      try { localStorage.setItem('dustfall.tutorial.v1', JSON.stringify({ seenIntro: true, usedItems: [] })); } catch { /* ignore */ }
      try { localStorage.setItem('dustfall.pendingSeed', '1337'); } catch { /* ignore */ }
      // Block the vite-hmr websocket (a sibling src/ edit would full-reload mid-run).
      const NativeWS = window.WebSocket;
      window.WebSocket = function (url, protocols) {
        const isHmr = (protocols && String(protocols).includes('vite-hmr')) || /vite/.test(String(url));
        if (isHmr) return { addEventListener() {}, removeEventListener() {}, send() {}, close() {}, readyState: 3, onopen: null, onmessage: null, onclose: null, onerror: null };
        return new NativeWS(url, protocols);
      };
      window.WebSocket.prototype = NativeWS.prototype;
    });
    // Boot (+ per-asset re-boot) helper: a fresh page load isolates each asset so
    // one asset's scene/GPU state can't bleed into or crash the next (the --all
    // context-loss lesson). addInitScript re-runs on every navigation.
    const boot = async () => {
      await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => !!(window.__game && window.__game.ctx?.player?.rig), undefined, { timeout: 45000 });
      await page.evaluate(() => { window.__game.enterGame(true); });
      await page.waitForTimeout(1200);
      await page.evaluate(installSolidLib);
    };
    await boot();

    if (ASSET === 'selftest') {
      const res = await page.evaluate((P) => window.__solidLib.selftest(P), PARAMS);
      console.log('\n=== verify:solid — SELF-TEST (synthetic defect + control rig) ===');
      for (const a of res.asserts) console.log(`   [${a.ok ? 'PASS' : 'FAIL'}] ${a.name}`);
      console.log(`\nSELF-TEST: ${res.pass ? 'PASS — every geometry detector fires on the known-bad rig + stays clean on the control' : 'FAIL — a detector is vacuous (see above)'}`);
      if (DUMP_JSON) console.log(JSON.stringify(res.detail, null, 1));
      exitCode = res.pass ? 0 : 1;
      return exitCode;
    }

    console.log('\n=== verify:solid — SOLID-MODEL VERIFICATION HARNESS ===');
    let totalFlagged = 0;
    const summary = [];
    for (let idx = 0; idx < RUN_LIST.length; idx++) {
      const name = RUN_LIST[idx];
      if (idx > 0) await boot();     // fresh page per asset — isolate scene + GPU state
      const cfg = { enclosure: ASSET_DEFS[name].enclosure, params: PARAMS, viteUrls };
      let a;
      try { a = await page.evaluate(async ({ n, c }) => await window.__solidLib.run(n, c), { n: name, c: cfg }); }
      catch (e) { a = { name, skip: `evaluate threw: ${e.message}` }; }
      const rep = reportAsset(a);
      for (const l of rep.lines) console.log(l);
      if (DUMP_JSON) console.log(JSON.stringify(a.checks || {}, null, 1));
      totalFlagged += rep.flagged;
      summary.push({ name, flagged: rep.flagged, skip: a.skip });
    }
    console.log('\n── summary ──');
    for (const s of summary) console.log(`   ${s.name}: ${s.skip ? `SKIPPED (${s.skip})` : (s.flagged ? `${s.flagged} check(s) FLAGGED` : 'all checks OK')}`);
    console.log(totalFlagged
      ? `\nVERIFY:SOLID — ${totalFlagged} check(s) flagged across ${RUN_LIST.length} asset(s). Fix the geometry/collision above, or re-tune thresholds in scripts/verify-solid.mjs (see docs/verify-solid.md).`
      : '\nVERIFY:SOLID — all checks clean.');
    // Non-zero exit when any check flagged (a modeler wants all-green before "done";
    // on the KNOWN-DEFECTIVE acceptance assets a non-zero exit is the CORRECT result).
    exitCode = totalFlagged ? 1 : 0;
  } finally {
    await browser.close();
    try {
      if (process.platform === 'win32' && dev.pid) spawnSync('taskkill', ['/pid', String(dev.pid), '/T', '/F'], { stdio: 'ignore' });
      else dev.kill();
    } catch { /* best effort */ }
  }
  return exitCode;
}

main().then((code) => process.exit(code || 0)).catch((e) => { console.error(e); process.exit(1); });
