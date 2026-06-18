// POI component / socket library (ACBA — POI variety overhaul).
//
// The previous wreck system assembled every POI as a LINEAR cockpit→hull→engine→tail
// chain placed at an advancing +X cursor — so every wreck read as a "long tube". This
// replaces that with a COMPONENT library: each component pre-authors its SOCKETS (a
// point + an outward mating frame + interface radius) and its COLLIDERS (declared, not
// inferred), so a grammar can mate() components onto sockets in ANY topology — radial
// (satellites), clustered/vertical (tank farms), scattered (debris) — not just linear.
//
// DETERMINISM LAW (D208/D221): one shared `rand` stream threads the whole field; the
// salvage-panel placement position depends on the rand-budget being a pure function of
// (archetype, part-count, panel-count). So components NEVER touch `rand` — every
// per-component proportion/greeble is derived from `phash()` (a deterministic Math.sin
// hash, ZERO draws). The grammar spends a small FIXED number of rand() (counts + yaw)
// and hashes them into per-component seeds. Tripwire: `npm run verify:placement`.

import * as THREE from 'three';
import type { ColliderSpec } from '../physics/bodies.ts';
import type { PanelKind } from './wrecks.ts';
import { _hullMat, _hullDarkMat, _rustMat } from './procgenWreck.ts';
import { makeFormerRings } from './wreckForms.ts';
import { makeEngineBellMesh } from './wrecks.ts';

// ── Determinism: rand-NEUTRAL hash (mirrors procgenWreck.hash2; kept local) ──
export function phash(a: number, b: number): number {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

// ── Sockets + built components ───────────────────────────────────────
//
// Convention: a socket's `quat` orients its LOCAL +Z to point TOWARD where the mate
// attaches (outward from this component's body). The component's body sits on the
// socket's −Z side. mate() then aligns a child socket so its +Z OPPOSES the parent
// socket's +Z (positions coincident) → the child's body extends AWAY from the parent.
export type SocketTag = 'axialIn' | 'axialOut' | 'radial' | 'top' | 'base' | 'cluster' | 'mount';

export interface Socket {
  name: string;
  pos: THREE.Vector3;       // component-local
  quat: THREE.Quaternion;   // component-local; +Z = outward mating normal
  radius: number;           // mating interface radius (size-match hint)
  tag: SocketTag;
}

export interface PanelMount {
  pos: THREE.Vector3;       // component-local
  quat: THREE.Quaternion;   // component-local; +Z = outward (the salvage door faces +Z)
  kind: PanelKind;
}

export interface BuiltComponent {
  mesh: THREE.Group;
  sockets: Socket[];
  colliders: ColliderSpec[];   // component-local; structural parts MUST declare ≥1 (decorations: {kind:'none'})
  panelMounts: PanelMount[];
  bbox: THREE.Box3;
}

// ── Socket-frame helpers (the quats that point +Z at a face) ─────────
const _ONE = new THREE.Vector3(1, 1, 1);
const qY = (a: number) => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), a);
const qX = (a: number) => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), a);
export const FACE = {
  posZ: () => new THREE.Quaternion(),                 // +Z outward
  negZ: () => qY(Math.PI),
  posX: () => qY(Math.PI / 2),
  negX: () => qY(-Math.PI / 2),
  posY: () => qX(-Math.PI / 2),                       // +Y outward (top)
  negY: () => qX(Math.PI / 2),                        // -Y outward (base)
};

// ── mate(): place a child component onto a parent socket ─────────────
//
// Returns the child's placement matrix in the assembly-root frame. `parentPlacement`
// is the parent's own root-frame matrix (identity for the root component).
const _FLIP = new THREE.Matrix4().makeRotationY(Math.PI);   // +Z → −Z (face-to-face)
const _pf = new THREE.Matrix4();
const _cf = new THREE.Matrix4();
function socketFrame(s: Socket): THREE.Matrix4 {
  return new THREE.Matrix4().compose(s.pos, s.quat, _ONE);
}
export function mate(
  parentPlacement: THREE.Matrix4,
  parentSocket: Socket,
  childSocket: Socket,
): THREE.Matrix4 {
  _pf.copy(parentPlacement).multiply(socketFrame(parentSocket)).multiply(_FLIP);
  _cf.copy(socketFrame(childSocket)).invert();
  return _pf.clone().multiply(_cf);   // childPlacement = parent·socket·flip·childSocket⁻¹
}

// ── Transform a component's declared collider / panel-mount into root frame ──
const _tcLocal = new THREE.Matrix4();
const _tcWorld = new THREE.Matrix4();
const _tcP = new THREE.Vector3();
const _tcQ = new THREE.Quaternion();
const _tcS = new THREE.Vector3();
const _IDENT = new THREE.Quaternion();
export function transformCollider(c: ColliderSpec, m: THREE.Matrix4): ColliderSpec {
  if (c.kind === 'none') return c;
  const q = 'quat' in c && c.quat ? new THREE.Quaternion(c.quat.x, c.quat.y, c.quat.z, c.quat.w) : _IDENT;
  _tcLocal.compose(_tcP.set(c.pos.x, c.pos.y, c.pos.z), q, _ONE);
  _tcWorld.copy(m).multiply(_tcLocal);
  _tcWorld.decompose(_tcP, _tcQ, _tcS);   // placements from mate() are rigid → scale stays 1
  const pos = { x: _tcP.x, y: _tcP.y, z: _tcP.z };
  const quat = { x: _tcQ.x, y: _tcQ.y, z: _tcQ.z, w: _tcQ.w };
  switch (c.kind) {
    case 'box':      return { kind: 'box', half: c.half, pos, quat };
    case 'cylinder': return { kind: 'cylinder', halfHeight: c.halfHeight, radius: c.radius, pos, quat };
    case 'ball':     return { kind: 'ball', radius: c.radius, pos };
    case 'convex':   return { kind: 'convex', geo: c.geo, pos, quat };
  }
}
export function transformPanelMount(p: PanelMount, m: THREE.Matrix4): PanelMount {
  _tcLocal.compose(_tcP.set(p.pos.x, p.pos.y, p.pos.z), p.quat, _ONE);
  _tcWorld.copy(m).multiply(_tcLocal);
  _tcWorld.decompose(_tcP, _tcQ, _tcS);
  return { pos: _tcP.clone(), quat: _tcQ.clone(), kind: p.kind };
}

// ── POI accent materials (flat-shaded, low-poly; do NOT re-skin — a solar cell
//    must stay blue, gold foil stays gold). Shared singletons → merge collapses
//    them across every POI in the field, so they add only a couple draw calls. ──
// ACBA critique pass: warm-shifted, lightened toward a dusty teal-slate so the wings
// read as a sun-bleached tech panel that sits IN the palette (not a cold near-black navy
// that collapses to a black blade against warm sand). Identity via lightness, per D224.
const _solarMat = new THREE.MeshLambertMaterial({ color: 0x44525c, flatShading: true });     // sun-bleached photovoltaic slate
const _solarFrameMat = new THREE.MeshLambertMaterial({ color: 0x2a2a30, flatShading: true }); // clean dark frame (no dust-speckle on cells)
const _foilMat = new THREE.MeshLambertMaterial({ color: 0xc79a52, flatShading: true });       // richer brass-gold thermal blanket (off the sand value)
const _dishMat = new THREE.MeshLambertMaterial({ color: 0xa6aab0, flatShading: true });       // pale dish face
const _emitMat = new THREE.MeshBasicMaterial({ color: 0x6b1d12 });                            // dead status-light red

// ════════════════════════════════════════════════════════════════════
// SATELLITE components — the canonical "not a ship": a central bus, mirrored
// solar wings, dish antennas. Sits where it fell (upright, barely buried).
// ════════════════════════════════════════════════════════════════════

/** Central satellite bus — a foil-wrapped instrument box. Sockets on ±X (wings),
 *  ±Z + top (dishes/antennas). Salvage panel on +Z. */
export function busBody(seed: number, _state = 'intact'): BuiltComponent {
  const g = new THREE.Group();
  const w = 1.5 + phash(seed, 1) * 0.9;     // ±X span (wings mount here)
  const h = 1.6 + phash(seed, 2) * 0.8;
  const d = 1.4 + phash(seed, 3) * 0.7;
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), _hullMat);
  g.add(body);
  // Gold thermal-blanket foil. The +Z face is left BARE (the salvage panel mounts there
  // — panelPlacement rejects a mount that lands on a decoration). One face is TORN to
  // dark hull (crash damage). Per-face phash shade so the four panels aren't identical.
  const foilFaces = [[0, -1, w], [1, 0, d], [-1, 0, d]] as const;   // -Z, +X, -X  (+Z bare for the panel)
  const tornFace = Math.floor(phash(seed, 5) * foilFaces.length);
  foilFaces.forEach(([sx, sz, fw], fi) => {
    if (fi === tornFace) return;   // torn off → exposed dark hull underneath
    const shade = 0.86 + phash(seed, 30 + fi) * 0.22;
    const fmat = _foilMat.clone(); fmat.color.multiplyScalar(shade);
    const foil = new THREE.Mesh(new THREE.BoxGeometry((sz ? fw : 0.12), h * 0.82, (sx ? fw : 0.12)), fmat);
    foil.position.set(sx * (w / 2 + 0.02), h * 0.04, sz * (d / 2 + 0.02));
    foil.userData.isWreckDecoration = true;
    g.add(foil);
  });
  // Top equipment deck — a darker raised box + a dead status light.
  const deck = new THREE.Mesh(new THREE.BoxGeometry(w * 0.7, 0.22, d * 0.7), _hullDarkMat);
  deck.position.y = h / 2 + 0.10; deck.userData.isWreckDecoration = true; g.add(deck);
  const led = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), _emitMat);
  led.position.set(w * 0.22, h / 2 + 0.26, d * 0.22); led.userData.isWreckDecoration = true; g.add(led);
  // Human-scale ANCHOR: a recessed access hatch (~0.7m) on the -Z face — a known
  // size constant so the bus+wings+dish read at real scale, not as a desktop model.
  const hatchFrame = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.78, 0.10), _hullDarkMat);
  hatchFrame.position.set(0, -h * 0.05, -d / 2 - 0.05); hatchFrame.userData.isWreckDecoration = true; g.add(hatchFrame);
  const hatchDoor = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.62, 0.12), _rustMat);
  hatchDoor.position.set(0, -h * 0.05, -d / 2 - 0.09); hatchDoor.userData.isWreckDecoration = true; g.add(hatchDoor);

  const sockets: Socket[] = [
    { name: 'wingL', pos: new THREE.Vector3(-w / 2, h * 0.05, 0), quat: FACE.negX(), radius: h * 0.4, tag: 'radial' },
    { name: 'wingR', pos: new THREE.Vector3(w / 2, h * 0.05, 0), quat: FACE.posX(), radius: h * 0.4, tag: 'radial' },
    // Dishes cluster on the TOP deck (clear of the +Z salvage panel + the -Z hatch).
    { name: 'dishT', pos: new THREE.Vector3(w * 0.05, h / 2 + 0.22, d * 0.16), quat: FACE.posY(), radius: 0.4, tag: 'top' },
    { name: 'dishT2', pos: new THREE.Vector3(-w * 0.10, h / 2 + 0.22, -d * 0.18), quat: FACE.posY(), radius: 0.4, tag: 'top' },
  ];
  const colliders: ColliderSpec[] = [
    { kind: 'box', half: { x: w / 2, y: h / 2, z: d / 2 }, pos: { x: 0, y: 0, z: 0 } },
  ];
  const panelMounts: PanelMount[] = [
    { pos: new THREE.Vector3(0, -h * 0.08, d / 2), quat: FACE.posZ(), kind: 'escape_pod' as PanelKind },
  ];
  const bbox = new THREE.Box3(new THREE.Vector3(-w / 2, -h / 2, -d / 2), new THREE.Vector3(w / 2, h / 2 + 0.3, d / 2));
  return { mesh: g, sockets, colliders, panelMounts, bbox };
}

/** Solar wing — a boom + framed photovoltaic array. Body extends along −Z (away
 *  from the mating socket). Built per-side by the grammar (mirrored pair). */
export function solarWing(seed: number, _state = 'intact'): BuiltComponent {
  const g = new THREE.Group();
  const boomLen = 0.5 + phash(seed, 1) * 0.4;
  const panelLen = 2.2 + phash(seed, 2) * 1.8;   // outward span
  const panelH = 1.0 + phash(seed, 3) * 0.5;
  // Boom (cylinder along −Z).
  const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, boomLen, 7), _rustMat);
  boom.rotation.x = Math.PI / 2; boom.position.z = -boomLen / 2; g.add(boom);
  // Panel frame + cells, centred beyond the boom.
  const cz = -(boomLen + panelLen / 2);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.12, panelH + 0.16, panelLen + 0.12), _solarFrameMat);
  frame.position.z = cz; frame.userData.isWreckDecoration = true; g.add(frame);
  const cells = new THREE.Mesh(new THREE.BoxGeometry(0.10, panelH, panelLen), _solarMat);
  cells.position.set(0, 0, cz); cells.userData.isWreckDecoration = true; g.add(cells);
  // Cell-grid mullions — vertical + horizontal so it reads as a GRID (not stripes) at
  // silhouette distance (a photovoltaic array, not a black blade).
  const nMull = 5 + Math.floor(phash(seed, 4) * 4);   // 5-8 verticals
  for (let i = 1; i < nMull; i++) {
    const mz = cz - panelLen / 2 + (panelLen * i) / nMull;
    const mull = new THREE.Mesh(new THREE.BoxGeometry(0.11, panelH, 0.05), _solarFrameMat);
    mull.position.set(0, 0, mz); mull.userData.isWreckDecoration = true; g.add(mull);
  }
  for (const my of [-1, 1]) {   // 2 horizontal cross-mullions
    const cross = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.05, panelLen), _solarFrameMat);
    cross.position.set(0, my * panelH * 0.28, cz); cross.userData.isWreckDecoration = true; g.add(cross);
  }
  const sockets: Socket[] = [
    { name: 'root', pos: new THREE.Vector3(0, 0, 0), quat: FACE.posZ(), radius: panelH * 0.4, tag: 'radial' },
  ];
  // The array is thin → a single thin box collider over boom+panel so the player can't
  // walk through the wing (but it's a low blade, mostly above head height when upright).
  const colliders: ColliderSpec[] = [
    { kind: 'box', half: { x: 0.08, y: panelH / 2, z: (boomLen + panelLen) / 2 }, pos: { x: 0, y: 0, z: -(boomLen + panelLen) / 2 } },
  ];
  const bbox = new THREE.Box3(
    new THREE.Vector3(-0.1, -panelH / 2, -(boomLen + panelLen)),
    new THREE.Vector3(0.1, panelH / 2, 0),
  );
  return { mesh: g, sockets, colliders, panelMounts: [], bbox };
}

/** Dish antenna — a parabolic dish on a short mast + feed horn. Body along −Z. */
export function dishAntenna(seed: number, _state = 'intact'): BuiltComponent {
  const g = new THREE.Group();
  const mastLen = 0.8 + phash(seed, 1) * 0.6;   // longer mast → the bus stays the dominant mass
  const dishR = 0.45 + phash(seed, 2) * 0.4;    // smaller dish (cap ~0.85m), not a novelty umbrella
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, mastLen, 7), _rustMat);
  mast.rotation.x = Math.PI / 2; mast.position.z = -mastLen / 2; g.add(mast);
  // Dish — a SHALLOW wide paraboloid (pale concave face). Mouth opens away from the mast.
  const dishDepth = dishR * 0.42;
  const dz = -(mastLen + dishDepth * 0.5);
  const dish = new THREE.Mesh(new THREE.CylinderGeometry(dishR, dishR * 0.3, dishDepth, 18, 1, true), _dishMat);
  dish.rotation.x = -Math.PI / 2;   // axis along Z, wide mouth toward −Z
  dish.position.z = dz; dish.userData.isWreckDecoration = true;
  (dish.material as THREE.Material).side = THREE.DoubleSide; g.add(dish);
  // Rim torus at the mouth so the dish edge never reads paper-thin from a grazing angle.
  const rim = new THREE.Mesh(new THREE.TorusGeometry(dishR, 0.045, 6, 20), _dishMat);
  rim.position.z = dz - dishDepth * 0.5; rim.userData.isWreckDecoration = true; g.add(rim);
  // Feed horn on a short mast at the dish focus.
  const horn = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.09, dishR * 0.5, 6), _hullDarkMat);
  horn.rotation.x = Math.PI / 2; horn.position.z = dz - dishR * 0.4; horn.userData.isWreckDecoration = true; g.add(horn);
  const sockets: Socket[] = [
    { name: 'root', pos: new THREE.Vector3(0, 0, 0), quat: FACE.posZ(), radius: 0.3, tag: 'mount' },
  ];
  // Dish + mast collide as a cylinder along Z (mast) + a thin disc footprint; one
  // cylinder over the mast is enough (the dish is high/thin).
  const colliders: ColliderSpec[] = [
    { kind: 'cylinder', halfHeight: mastLen / 2, radius: 0.12, pos: { x: 0, y: 0, z: -mastLen / 2 }, quat: FACE.posY() },
  ];
  const bbox = new THREE.Box3(
    new THREE.Vector3(-dishR, -dishR, -(mastLen + dishR)),
    new THREE.Vector3(dishR, dishR, 0),
  );
  return { mesh: g, sockets, colliders, panelMounts: [], bbox };
}

// ════════════════════════════════════════════════════════════════════
// TANK / SILO components — vertical industrial: a ground slab carrying upright
// storage tanks + a silo. The deliberate OPPOSITE of every horizontal wreck.
// ════════════════════════════════════════════════════════════════════

/** Foundation slab. Width/depth can be FIXED by the grammar (sized to the tank count) so
 *  the pad is never an oversized empty plinth; `base` sockets remain for socket-based use. */
export function groundSlab(seed: number, nMounts = 4, fixedW?: number, fixedD?: number): BuiltComponent {
  const g = new THREE.Group();
  const sw = fixedW ?? (4.0 + phash(seed, 1) * 2.0);
  const sd = fixedD ?? (4.0 + phash(seed, 2) * 2.0);
  const sh = 0.7;   // chunky concrete-pad read (was a 0.45 thin steel plate)
  const slab = new THREE.Mesh(new THREE.BoxGeometry(sw, sh, sd), _hullDarkMat);
  g.add(slab);
  // A few anchor bolts / curb greebles.
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.18, 6), _rustMat);
    bolt.position.set(Math.cos(a) * sw * 0.38, sh / 2 + 0.05, Math.sin(a) * sd * 0.38);
    bolt.userData.isWreckDecoration = true; g.add(bolt);
  }
  const sockets: Socket[] = [];
  // Distribute base sockets on a loose grid on the slab top.
  for (let i = 0; i < nMounts; i++) {
    const hx = (phash(seed, 10 + i) - 0.5) * sw * 0.6;
    const hz = (phash(seed, 20 + i) - 0.5) * sd * 0.6;
    sockets.push({ name: `mount${i}`, pos: new THREE.Vector3(hx, sh / 2, hz), quat: FACE.posY(), radius: 1.0, tag: 'base' });
  }
  const colliders: ColliderSpec[] = [
    { kind: 'box', half: { x: sw / 2, y: sh / 2, z: sd / 2 }, pos: { x: 0, y: 0, z: 0 } },
  ];
  const bbox = new THREE.Box3(new THREE.Vector3(-sw / 2, -sh / 2, -sd / 2), new THREE.Vector3(sw / 2, sh / 2, sd / 2));
  return { mesh: g, sockets, colliders, panelMounts: [], bbox };
}

/** Upright storage tank — a vertical cylinder + domed cap + ladder + side hatch.
 *  Body extends along +Y from its base socket (which mates DOWN onto a slab). */
export function tankCylinder(seed: number, state = 'intact', tall = false): BuiltComponent {
  const g = new THREE.Group();
  // tall = a slim SILO (4.5-6.8m); else a WIDER SQUAT storage tank — both read at multi-
  // metre industrial scale, away from 55-gallon-drum proportions.
  const r = tall ? 0.7 + phash(seed, 1) * 0.4 : 0.95 + phash(seed, 1) * 0.6;
  const bodyH = tall ? 4.5 + phash(seed, 2) * 2.3 : 2.4 + phash(seed, 2) * 1.5;
  const breached = state === 'breached';
  const shell = new THREE.Mesh(new THREE.CylinderGeometry(r, r, bodyH, 12, 1, false), _hullMat);
  shell.position.y = bodyH / 2; g.add(shell);
  // Domed top cap (half-sphere) unless breached (then a torn open rim).
  if (!breached) {
    const dome = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), _hullMat);
    dome.position.y = bodyH; g.add(dome);
  } else {
    const rim = new THREE.Mesh(new THREE.TorusGeometry(r * 0.96, 0.08, 6, 14), _rustMat);
    rim.rotation.x = Math.PI / 2; rim.position.y = bodyH; rim.userData.isWreckDecoration = true; g.add(rim);
  }
  // Two horizontal hoop bands (decoration).
  for (const ty of [0.32, 0.68]) {
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(r + 0.03, 0.05, 6, 14), _hullDarkMat);
    hoop.rotation.x = Math.PI / 2; hoop.position.y = bodyH * ty; hoop.userData.isWreckDecoration = true; g.add(hoop);
  }
  // Vertical inspection ladder on the +X side.
  const ladH = bodyH * 0.9;
  const rungs = Math.max(4, Math.round(ladH / 0.32));
  for (let i = 0; i < rungs; i++) {
    const rung = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.36, 6), _rustMat);
    rung.rotation.z = Math.PI / 2;
    rung.position.set(r + 0.06, bodyH * 0.06 + (i / (rungs - 1)) * ladH, 0);
    rung.userData.isWreckDecoration = true; g.add(rung);
  }
  for (const k of [-1, 1]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.07, ladH, 0.07), _hullDarkMat);
    rail.position.set(r + 0.06, bodyH * 0.06 + ladH / 2, k * 0.16); rail.userData.isWreckDecoration = true; g.add(rail);
  }
  const sockets: Socket[] = [
    { name: 'base', pos: new THREE.Vector3(0, 0, 0), quat: FACE.negY(), radius: r, tag: 'base' },
    { name: 'pipeZ', pos: new THREE.Vector3(0, bodyH * 0.5, r), quat: FACE.posZ(), radius: 0.18, tag: 'radial' },
  ];
  const colliders: ColliderSpec[] = [
    { kind: 'cylinder', halfHeight: bodyH / 2, radius: r, pos: { x: 0, y: bodyH / 2, z: 0 } },
    // Dome cap collider — the SphereGeometry cap reaches y=bodyH+r and is otherwise
    // un-collided (the player/projectiles would clip the tallest part of the tank).
    { kind: 'ball', radius: r, pos: { x: 0, y: bodyH, z: 0 } },
  ];
  const panelMounts: PanelMount[] = [
    // Salvage hatch at a HUMAN-reachable height (never up a 7m silo), on +Z.
    { pos: new THREE.Vector3(0, Math.min(bodyH * 0.42, 1.5), r), quat: FACE.posZ(), kind: 'cargo_container' as PanelKind },
  ];
  const bbox = new THREE.Box3(new THREE.Vector3(-r, 0, -r), new THREE.Vector3(r, bodyH + r, r));
  return { mesh: g, sockets, colliders, panelMounts, bbox };
}

/** Connecting pipe — a horizontal run between two tank radial sockets. Body −Z. */
export function pipeStrut(_seed: number, length = 2): BuiltComponent {
  const g = new THREE.Group();
  const len = length;
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, len, 8), _rustMat);
  pipe.rotation.x = Math.PI / 2; pipe.position.z = -len / 2; g.add(pipe);
  // Flange collars at both ends.
  for (const z of [-0.04, -len + 0.04]) {
    const fl = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.08, 8), _hullDarkMat);
    fl.rotation.x = Math.PI / 2; fl.position.z = z; fl.userData.isWreckDecoration = true; g.add(fl);
  }
  const sockets: Socket[] = [
    { name: 'root', pos: new THREE.Vector3(0, 0, 0), quat: FACE.posZ(), radius: 0.18, tag: 'radial' },
  ];
  const colliders: ColliderSpec[] = [
    { kind: 'cylinder', halfHeight: len / 2, radius: 0.16, pos: { x: 0, y: 0, z: -len / 2 }, quat: FACE.posY() },
  ];
  const bbox = new THREE.Box3(new THREE.Vector3(-0.2, -0.2, -len), new THREE.Vector3(0.2, 0.2, 0));
  return { mesh: g, sockets, colliders, panelMounts: [], bbox };
}

// ════════════════════════════════════════════════════════════════════
// DEBRIS — single scattered fragments. The grammar strews several over a disc
// (no hull) for a "blast-scatter / fallen-apart" field. One chunk is lootable.
// ════════════════════════════════════════════════════════════════════

/** One wreck fragment. kindIdx: 0 torn plate, 1 bent strut, 2 hull chunk. `lootable`
 *  (chunk only) adds a TOP salvage hatch — the assembler seats that piece upright. */
export function debrisPiece(seed: number, kindIdx: number, lootable = false): BuiltComponent {
  const g = new THREE.Group();
  let collider: ColliderSpec;
  let panelMounts: PanelMount[] = [];
  let bbox: THREE.Box3;
  if (kindIdx === 0) {
    const w = 1.2 + phash(seed, 1) * 1.6;
    const h = 0.8 + phash(seed, 2) * 1.0;
    const plate = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.16), _hullMat);
    g.add(plate);
    const edge = new THREE.Mesh(new THREE.BoxGeometry(w, 0.16, 0.20), _rustMat);   // ragged torn lip
    edge.position.y = h / 2; edge.userData.isWreckDecoration = true; g.add(edge);
    collider = { kind: 'box', half: { x: w / 2, y: h / 2, z: 0.08 }, pos: { x: 0, y: 0, z: 0 } };
    bbox = new THREE.Box3(new THREE.Vector3(-w / 2, -h / 2, -0.12), new THREE.Vector3(w / 2, h / 2 + 0.1, 0.12));
  } else if (kindIdx === 1) {
    const len = 1.6 + phash(seed, 1) * 2.4;
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, len, 7), _rustMat);
    strut.rotation.x = Math.PI / 2; g.add(strut);   // lie along Z (matches the collider axis)
    for (const sz of [-1, 1]) {   // end flanges
      const fl = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.10), _hullDarkMat);
      fl.position.z = sz * len / 2; fl.userData.isWreckDecoration = true; g.add(fl);
    }
    // Rapier cylinders are Y-axis; FACE.posY() rotates the collider onto Z to match the
    // visible horizontal bar (the prior FACE.posX() left an invisible VERTICAL capsule).
    collider = { kind: 'cylinder', halfHeight: len / 2, radius: 0.18, pos: { x: 0, y: 0, z: 0 }, quat: FACE.posY() };
    bbox = new THREE.Box3(new THREE.Vector3(-0.3, -0.3, -len / 2), new THREE.Vector3(0.3, 0.3, len / 2));
  } else {
    const w = 1.4 + phash(seed, 1) * 1.0;
    const h = 1.1 + phash(seed, 2) * 0.8;
    const d = 1.2 + phash(seed, 3) * 0.8;
    const chunk = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), _hullMat);
    g.add(chunk);
    const rib = new THREE.Mesh(new THREE.BoxGeometry(w * 1.02, h * 0.16, 0.12), _hullDarkMat);
    rib.position.set(0, h * 0.1, d / 2); rib.userData.isWreckDecoration = true; g.add(rib);
    collider = { kind: 'box', half: { x: w / 2, y: h / 2, z: d / 2 }, pos: { x: 0, y: 0, z: 0 } };
    // Lootable chunk → salvage hatch on TOP (+Y); the assembler seats this piece UPRIGHT
    // at the field centre so the hatch faces the sky and no sibling fragment occludes it.
    if (lootable) panelMounts = [{ pos: new THREE.Vector3(0, h / 2, 0), quat: FACE.posY(), kind: 'fuselage' as PanelKind }];
    bbox = new THREE.Box3(new THREE.Vector3(-w / 2, -h / 2, -d / 2), new THREE.Vector3(w / 2, h / 2, d / 2));
  }
  return { mesh: g, sockets: [], colliders: [collider], panelMounts, bbox };
}

// ════════════════════════════════════════════════════════════════════
// HOLLOW HUSK — a gutted hull SHELL: an open-top trough (see straight into the
// hollow) + open torn ends + exposed rib formers. Enterable-READY (open shell +
// side-wall colliders, no solid bore) — a later phase drops a floor/ceiling.
// ════════════════════════════════════════════════════════════════════
export function huskShell(seed: number, _state = 'breached'): BuiltComponent {
  const g = new THREE.Group();
  const len = 7 + phash(seed, 1) * 4.5;     // 7-11.5m long
  const r = 2.0 + phash(seed, 2) * 0.9;     // 2-2.9m bore (enterable scale)
  // Gutted hull shell — a partial cylinder OPEN at the top (~126° gap) + both ENDS, so the
  // hollow interior + ribs read from above, the side, and the torn ends. DoubleSide.
  const gap = Math.PI * 0.7;
  const shell = new THREE.Mesh(
    new THREE.CylinderGeometry(r, r, len, 16, 1, true, gap / 2, Math.PI * 2 - gap), _hullMat,
  );
  shell.rotation.z = Math.PI / 2;            // cylinder Y-axis → X (tube lies along X); gap → top (+Y)
  shell.position.y = r;
  (shell.material as THREE.Material).side = THREE.DoubleSide;
  g.add(shell);
  // Exposed rib formers inside (arc gap at bottom → ribs spring from the floor), shown
  // through the open top. Spaced along the length.
  const ribN = 3 + Math.floor(phash(seed, 3) * 3);
  const formers = makeFormerRings(r * 0.98, ribN, len / (ribN + 1), {
    startX: -len / 2 + len / (ribN + 1), arc: Math.PI * 1.25, taper: 0.02,
  });
  formers.position.y = r;
  formers.traverse((o) => { o.userData.isWreckDecoration = true; });
  g.add(formers);
  // Torn rim along the two open top edges (jagged dark flaps).
  for (const zside of [-1, 1] as const) {
    const nFlap = 4 + Math.floor(phash(seed, 10 + zside) * 3);
    for (let i = 0; i < nFlap; i++) {
      const fx = -len / 2 + (i + 0.5) * (len / nFlap);
      const flap = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.5 + phash(seed, 20 + i) * 0.4, 3), _rustMat);
      flap.position.set(fx, r + Math.cos(gap / 2) * r, zside * Math.sin(gap / 2) * r);
      flap.rotation.x = zside * (0.5 + phash(seed, 30 + i) * 0.5);
      flap.userData.isWreckDecoration = true; g.add(flap);
    }
  }
  // A little settled wreckage on the floor (reads as a husk you could shelter in).
  for (let i = 0; i < 3; i++) {
    const cz = (phash(seed, 40 + i) - 0.5) * r * 0.9;
    const cx = (phash(seed, 50 + i) - 0.5) * len * 0.7;
    const chunk = new THREE.Mesh(new THREE.BoxGeometry(0.5 + phash(seed, 60 + i) * 0.6, 0.4, 0.5), _hullDarkMat);
    chunk.position.set(cx, 0.2, cz); chunk.rotation.y = phash(seed, 70 + i) * Math.PI;
    chunk.userData.isWreckDecoration = true; g.add(chunk);
  }
  // A torn flank breach on -Z (a dark gash + bent torn-metal flaps) — a 2nd way to see in.
  const bx = (phash(seed, 80) - 0.5) * len * 0.4;
  const gash = new THREE.Mesh(new THREE.BoxGeometry(r * 0.85, r * 0.7, 0.14), _hullDarkMat);
  gash.position.set(bx, r * 0.75, -r * 0.9); gash.userData.isWreckDecoration = true; g.add(gash);
  for (let i = 0; i < 5; i++) {
    const ang = (i / 5) * Math.PI * 2;
    const flap = new THREE.Mesh(new THREE.ConeGeometry(r * 0.12, r * 0.4, 3), _rustMat);
    flap.position.set(bx + Math.cos(ang) * r * 0.38, r * 0.75 + Math.sin(ang) * r * 0.3, -r * 0.95);
    flap.rotation.z = ang; flap.rotation.x = -0.6;
    flap.userData.isWreckDecoration = true; g.add(flap);
  }
  // Collider: the two curved SIDE walls (ends + top open → walk in; enterable-ready). The
  // player stands on the terrain inside; the side boxes stop lateral walk-through.
  const colliders: ColliderSpec[] = [
    { kind: 'box', half: { x: len / 2, y: r * 0.85, z: 0.3 }, pos: { x: 0, y: r * 0.7, z: r * 0.82 } },
    { kind: 'box', half: { x: len / 2, y: r * 0.85, z: 0.3 }, pos: { x: 0, y: r * 0.7, z: -r * 0.82 } },
  ];
  const panelMounts: PanelMount[] = [
    // Rich 'massive' salvage hatch on the outer +Z flank at human height.
    { pos: new THREE.Vector3(len * 0.18, 1.4, r * 0.9), quat: FACE.posZ(), kind: 'massive' as PanelKind },
  ];
  const bbox = new THREE.Box3(new THREE.Vector3(-len / 2, 0, -r), new THREE.Vector3(len / 2, r * 1.9, r));
  return { mesh: g, sockets: [], colliders, panelMounts, bbox };
}

// ════════════════════════════════════════════════════════════════════
// SHIP HULL components — intact ship parts for the DERELICT archetype: linear /
// wide-body (sponsons) / stacked (tower) ship forms via the socket grammar (the
// "wider/weirder ships" direction). Axial sockets chain along Z; radial/top sockets
// graft sponsons + superstructure for NON-tube silhouettes.
// ════════════════════════════════════════════════════════════════════

/** Tapered nose — its axialIn (base) mates onto a barrel's fwd (axialOut). Tip → +Z. */
export function noseCone(seed: number): BuiltComponent {
  const g = new THREE.Group();
  const len = 1.6 + phash(seed, 1) * 1.0;
  const baseR = 0.85 + phash(seed, 2) * 0.4;
  const nose = new THREE.Mesh(new THREE.CylinderGeometry(baseR * 0.22, baseR, len, 12), _hullMat);
  nose.rotation.x = Math.PI / 2;             // axis Y→Z; wide base at -Z, tip at +Z
  nose.position.z = len / 2; g.add(nose);
  const spine = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, len * 0.55), _hullDarkMat);
  spine.position.set(0, baseR * 0.55, len * 0.5); spine.userData.isWreckDecoration = true; g.add(spine);
  const sockets: Socket[] = [{ name: 'base', pos: new THREE.Vector3(0, 0, 0), quat: FACE.negZ(), radius: baseR, tag: 'axialIn' }];
  const colliders: ColliderSpec[] = [
    { kind: 'cylinder', halfHeight: len / 2, radius: baseR, pos: { x: 0, y: 0, z: len / 2 }, quat: FACE.posY() },
  ];
  const bbox = new THREE.Box3(new THREE.Vector3(-baseR, -baseR, 0), new THREE.Vector3(baseR, baseR, len));
  return { mesh: g, sockets, colliders, panelMounts: [], bbox };
}

/** Hull barrel — the ship spine block. Axial sockets (aft/fwd) + radial sponson + top
 *  sockets for wide-body / stacked grafting. Salvage hatch on top (never occluded). */
export function hullBarrel(seed: number, scale = 1): BuiltComponent {
  const g = new THREE.Group();
  const len = (2.4 + phash(seed, 1) * 2.0) * scale;
  const r = (0.9 + phash(seed, 2) * 0.5) * scale;
  const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.96, len, 10), _hullMat);
  body.rotation.x = Math.PI / 2; g.add(body);   // axis along Z
  for (const tz of [-0.3, 0.3]) {
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(r + 0.02, 0.05, 6, 14), _hullDarkMat);
    hoop.position.z = len * tz; hoop.userData.isWreckDecoration = true; g.add(hoop);
  }
  const sockets: Socket[] = [
    { name: 'aft', pos: new THREE.Vector3(0, 0, -len / 2), quat: FACE.negZ(), radius: r, tag: 'axialIn' },
    { name: 'fwd', pos: new THREE.Vector3(0, 0, len / 2), quat: FACE.posZ(), radius: r, tag: 'axialOut' },
    { name: 'spoL', pos: new THREE.Vector3(r * 0.85, 0, 0), quat: FACE.posX(), radius: r * 0.6, tag: 'radial' },
    { name: 'spoR', pos: new THREE.Vector3(-r * 0.85, 0, 0), quat: FACE.negX(), radius: r * 0.6, tag: 'radial' },
    { name: 'top', pos: new THREE.Vector3(0, r * 0.85, 0), quat: FACE.posY(), radius: r * 0.6, tag: 'top' },
  ];
  const colliders: ColliderSpec[] = [
    { kind: 'cylinder', halfHeight: len / 2, radius: r, pos: { x: 0, y: 0, z: 0 }, quat: FACE.posY() },
  ];
  const panelMounts: PanelMount[] = [
    { pos: new THREE.Vector3(0, r, 0), quat: FACE.posY(), kind: 'fuselage' as PanelKind },
  ];
  const bbox = new THREE.Box3(new THREE.Vector3(-r, -r, -len / 2), new THREE.Vector3(r, r, len / 2));
  return { mesh: g, sockets, colliders, panelMounts, bbox };
}

/** Engine bell — its axialIn mates onto a barrel's aft; the bell opens further aft. */
export function engineNozzle(seed: number): BuiltComponent {
  const g = new THREE.Group();
  const r = 0.7 + phash(seed, 1) * 0.4;
  const depth = r * 1.4;
  const bell = makeEngineBellMesh(r, depth, _hullMat, _hullDarkMat);
  bell.rotation.x = Math.PI / 2;             // bell opens +Y by default → opens +Z after
  g.add(bell);
  const sockets: Socket[] = [{ name: 'mount', pos: new THREE.Vector3(0, 0, 0), quat: FACE.negZ(), radius: r, tag: 'axialIn' }];
  const colliders: ColliderSpec[] = [
    { kind: 'cylinder', halfHeight: depth / 2, radius: r, pos: { x: 0, y: 0, z: depth / 2 }, quat: FACE.posY() },
  ];
  const bbox = new THREE.Box3(new THREE.Vector3(-r, -r, 0), new THREE.Vector3(r, r, depth));
  return { mesh: g, sockets, colliders, panelMounts: [], bbox };
}

export const _IDENT_MAT = new THREE.Matrix4();   // root placement
