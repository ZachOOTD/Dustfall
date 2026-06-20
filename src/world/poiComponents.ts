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
// ACBB Tier 1 cohesion: the 0x44525c slate still rendered near-BLACK on the vertical wing
// blades (Lambert + low desert sun on a dark side-facing panel) → the lone value-outlier
// in an otherwise warm-desert fleet. Lifted ~2× in value to a dusty mid blue-grey: still
// reads "photovoltaic" (the only cool member) but sits in the family by LIGHTNESS, not as
// a black silhouette. Frame lifted to match so the cell grid stays legible.
const _solarMat = new THREE.MeshLambertMaterial({ color: 0x9e9b92, flatShading: true });     // sun-faded photovoltaic grey (ACBC §G: lifted again 0x8d8a84→here — the wing blades still read a touch dark at silhouette distance when the lit face turns away from the low sun; a higher base value keeps them in the family without washing white)
const _solarFrameMat = new THREE.MeshLambertMaterial({ color: 0x57575f, flatShading: true }); // dusty frame (lifted to match the brighter cells so the grid still reads)
const _foilMat = new THREE.MeshLambertMaterial({ color: 0xc79a52, flatShading: true });       // richer brass-gold thermal blanket (off the sand value)
const _dishMat = new THREE.MeshLambertMaterial({ color: 0xa6aab0, flatShading: true });       // pale dish face
const _emitMat = new THREE.MeshBasicMaterial({ color: 0x6b1d12 });                            // dead status-light red
// ACBB Tier 2 — warm desert sand for the drift TONGUES that spill in through a torn hull
// opening (the "living dune swallowing the wreck" read). Component-baked → sinks with burial.
const _sandTongueMat = new THREE.MeshLambertMaterial({ color: 0xc2aa7e, flatShading: true });
// C43 — an unlit near-black for a recessed shaft VOID (a well mouth / hole reads as a hole,
// not a lit grey lid, when the bottom is pure shadow).
const _shaftVoidMat = new THREE.MeshBasicMaterial({ color: 0x05060a });

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
  // ACBB Tier 1 — a dark bezel housing so the dead status light reads as a recessed
  // indicator (the bare 0.16 emit box was sub-pixel at distance, lost against the deck).
  const ledBezel = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.22, 0.30), _hullDarkMat);
  ledBezel.position.set(w * 0.22, h / 2 + 0.21, d * 0.22); ledBezel.userData.isWreckDecoration = true; g.add(ledBezel);
  const led = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.18), _emitMat);
  led.position.set(w * 0.22, h / 2 + 0.28, d * 0.22); led.userData.isWreckDecoration = true; g.add(led);
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
// WRECKED TANK — a single big storage tank RIPPED OPEN, toppled on its side, DEEPLY half-
// swallowed by sand. Whole-silhouette damage (so no random yaw hides all trauma): a torn-
// open +X end (ribs + jagged flaps + peel-back plates), a CRUSHED dented −X cap, TWO recessed
// flank breaches, a mid buckle + a snapped hoop, and a human-scale manway for scale.
// ════════════════════════════════════════════════════════════════════
export function wreckedTank(seed: number, _state = 'breached'): BuiltComponent {
  const g = new THREE.Group();
  const len = 6 + phash(seed, 1) * 3.5;     // 6-9.5m long
  const r = 1.9 + phash(seed, 2) * 0.9;     // 1.9-2.8m radius (a big tank)
  const QZ = { x: 0, y: 0, z: Math.SQRT1_2, w: Math.SQRT1_2 };   // qZ(π/2): a Y-axis cylinder → X
  // Full-length hull lying on its side along X, OPEN-ENDED + DoubleSide so the torn openings
  // show the interior; a dark BackSide inner liner makes every breach read into a black void.
  const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 18, 1, true), _hullMat);
  body.rotation.z = Math.PI / 2; body.position.set(0, r, 0);
  (body.material as THREE.Material).side = THREE.DoubleSide; g.add(body);
  const liner = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.88, r * 0.88, len * 0.96, 16, 1, true), _hullDarkMat);
  liner.rotation.z = Math.PI / 2; liner.position.set(0, r, 0);
  (liner.material as THREE.Material).side = THREE.BackSide; liner.userData.isWreckDecoration = true; g.add(liner);
  // CRUSHED −X end cap — a dented, caved hemisphere (not a clean showroom dome) so even the
  // "intact" end reads damaged from that yaw.
  const dome = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), _hullMat);
  dome.rotation.z = Math.PI / 2; dome.position.set(-len / 2, r, 0); g.add(dome);
  for (let i = 0; i < 3; i++) {   // dark caved-in dents / buckle creases on the cap
    const dent = new THREE.Mesh(new THREE.BoxGeometry(0.5 + phash(seed, 160 + i) * 0.5, 0.14, r * (0.4 + phash(seed, 170 + i) * 0.5)), _hullDarkMat);
    dent.position.set(-len / 2 - r * 0.32, r + (phash(seed, 180 + i) - 0.5) * r * 1.1, (phash(seed, 190 + i) - 0.5) * r);
    dent.rotation.set((phash(seed, 200 + i) - 0.5) * 1.2, (phash(seed, 210 + i) - 0.5), (phash(seed, 220 + i) - 0.5));
    dent.userData.isWreckDecoration = true; g.add(dent);
  }
  // TORN-OPEN +X end — exposed internal ribs + a JAGGED, irregular ring of torn flaps (some
  // dropped for asymmetric gaps) + two big peel-back plates of torn sheet metal.
  const formers = makeFormerRings(r * 0.9, 3, len * 0.1, { startX: len / 2 - len * 0.32, arc: Math.PI * 1.2, taper: 0.03 });
  formers.position.y = r; formers.traverse((o) => { o.userData.isWreckDecoration = true; }); g.add(formers);
  for (let i = 0; i < 11; i++) {
    if (phash(seed, 12 + i) < 0.2) continue;   // skip → asymmetric jagged gaps
    const ang = (i / 11) * Math.PI * 2 + (phash(seed, 14 + i) - 0.5) * 0.5;
    const flap = new THREE.Mesh(new THREE.ConeGeometry(r * (0.12 + phash(seed, 16 + i) * 0.14), r * (0.45 + phash(seed, 17 + i) * 0.7), 3), _rustMat);
    flap.position.set(len / 2 - 0.1, r + Math.cos(ang) * r * 0.92, Math.sin(ang) * r * 0.92);
    flap.rotation.z = ang - Math.PI / 2; flap.rotation.x = (phash(seed, 20 + i) - 0.5) * 2.2;
    flap.userData.isWreckDecoration = true; g.add(flap);
  }
  for (let i = 0; i < 2; i++) {   // peel-back plates (torn sheet metal, rule-7 0.12m)
    const a = i * Math.PI + phash(seed, 24 + i);
    const plate = new THREE.Mesh(new THREE.BoxGeometry(r * 0.7, 0.12, r * 0.5), _hullMat);
    plate.position.set(len / 2 + 0.15, r + Math.cos(a) * r * 0.7, Math.sin(a) * r * 0.7);
    plate.rotation.set(a, 0.4, 0.5); plate.userData.isWreckDecoration = true; g.add(plate);
  }
  // ACBB Tier 2 — a SAND TONGUE drifted in through the torn +X mouth, filling the lower bore
  // and spilling out past the lip (the living dune reaching into the wreck). Baked into the
  // component so it sinks WITH the tank's deep burial (a placement-time drift sits beside it).
  const tongue = new THREE.Mesh(new THREE.SphereGeometry(r * 0.78, 10, 7), _sandTongueMat);
  tongue.scale.set(1.5, 0.42, 1.05);
  tongue.position.set(len / 2 - r * 0.15, r * 0.5, 0);
  tongue.userData.isWreckDecoration = true; g.add(tongue);
  // TWO flank breaches (+Z and −Z, different X) so an unambiguous tear is visible from ANY
  // ground-level yaw: a dark RECESSED hole + a rib arc seen through it + a jagged flap ring.
  const addBreach = (bx: number, zs: number, sk: number) => {
    const hole = new THREE.Mesh(new THREE.CircleGeometry(r * 0.55, 14), _hullDarkMat);
    hole.position.set(bx, r + r * 0.15, zs * r * 0.78); hole.rotation.y = zs > 0 ? 0 : Math.PI; hole.rotation.x = -zs * 0.2;
    hole.userData.isWreckDecoration = true; g.add(hole);
    const rib = new THREE.Mesh(new THREE.TorusGeometry(r * 0.66, 0.06, 6, 12, Math.PI * 0.9), _rustMat);
    rib.rotation.set(0, Math.PI / 2, zs > 0 ? 0 : Math.PI); rib.position.set(bx, r, zs * r * 0.45);
    rib.userData.isWreckDecoration = true; g.add(rib);
    for (let i = 0; i < 7; i++) {
      if (phash(sk, i) < 0.15) continue;
      const a = (i / 7) * Math.PI * 2;
      const f = new THREE.Mesh(new THREE.ConeGeometry(r * (0.1 + phash(sk, 10 + i) * 0.1), r * (0.35 + phash(sk, 20 + i) * 0.45), 3), _rustMat);
      f.position.set(bx + Math.cos(a) * r * 0.5, r + r * 0.15 + Math.sin(a) * r * 0.5, zs * r * 0.9);
      f.rotation.set(zs * (0.4 + phash(sk, 30 + i) * 0.7), 0, a);
      f.userData.isWreckDecoration = true; g.add(f);
    }
  };
  addBreach(-len * 0.22, 1, seed + 300);
  addBreach(len * 0.14, -1, seed + 400);
  // A mid-span axial buckle (the barrel itself caved a little — a dark crease box).
  const buckle = new THREE.Mesh(new THREE.BoxGeometry(len * 0.22, 0.14, r * 0.55), _hullDarkMat);
  buckle.position.set(-len * 0.04, r + r * 0.72, r * 0.5); buckle.rotation.set(-0.5, 0.3, 0);
  buckle.userData.isWreckDecoration = true; g.add(buckle);
  // Hoop bands — one full, one SNAPPED (partial arc) → reads worn, not pristine manufacturing.
  for (let h = 0; h < 2; h++) {
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(r + 0.05, 0.07, 6, 18, h === 0 ? Math.PI * 2 : Math.PI * 1.25), _hullDarkMat);
    hoop.rotation.y = Math.PI / 2; hoop.position.set(len * (h === 0 ? -0.34 : 0.04), r, 0);
    hoop.userData.isWreckDecoration = true; g.add(hoop);
  }
  // Human-SCALE cue: a ~0.7m bolted manway hatch + 3 rungs on the exposed upper flank, so the
  // multi-metre tank scale reads against a known human-constant.
  const mwX = -len * 0.36;
  const manway = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.12, 12), _hullDarkMat);
  manway.rotation.x = Math.PI / 2; manway.position.set(mwX, r + r * 0.6, r * 0.8); manway.userData.isWreckDecoration = true; g.add(manway);
  for (let i = 0; i < 3; i++) {
    const rung = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.04, 0.06), _rustMat);
    rung.position.set(mwX, r + r * 0.6 - 0.5 - i * 0.32, r * 0.94); rung.userData.isWreckDecoration = true; g.add(rung);
  }
  const colliders: ColliderSpec[] = [
    { kind: 'cylinder', halfHeight: len / 2, radius: r, pos: { x: 0, y: r, z: 0 }, quat: QZ },
    { kind: 'ball', radius: r * 0.95, pos: { x: -len / 2, y: r, z: 0 } },   // dome cap
  ];
  const panelMounts: PanelMount[] = [
    // Salvage hatch on the exposed UPPER surface (faces +Y → never occluded).
    { pos: new THREE.Vector3(-len * 0.36, r * 2, 0), quat: FACE.posY(), kind: 'cargo_container' as PanelKind },
  ];
  const bbox = new THREE.Box3(new THREE.Vector3(-len / 2 - r, 0, -r * 1.2), new THREE.Vector3(len / 2 + r, r * 2, r * 1.2));
  return { mesh: g, sockets: [], colliders, panelMounts, bbox };
}

// ════════════════════════════════════════════════════════════════════
// DEBRIS — single scattered fragments. The grammar strews several over a disc
// (no hull) for a "blast-scatter / fallen-apart" field. One chunk is lootable.
// ════════════════════════════════════════════════════════════════════

/** One wreck fragment. kindIdx: 0 torn plate, 1 bent strut, 2 hull chunk. `lootable`
 *  (chunk only) adds a TOP salvage hatch — the assembler seats that piece upright. */
export function debrisPiece(seed: number, kindIdx: number, lootable = false, scale = 1): BuiltComponent {
  // `scale` (C43) lets a caller GROW pieces along a gradient (the debris-trail's small→big read).
  // It multiplies every dimension — geo, collider, bbox — so the collider stays matched. Default
  // 1 → the existing caller (assembleDebris) is byte-identical.
  const g = new THREE.Group();
  let collider: ColliderSpec;
  let panelMounts: PanelMount[] = [];
  let bbox: THREE.Box3;
  if (kindIdx === 0) {
    const w = (1.2 + phash(seed, 1) * 1.6) * scale;
    const h = (0.8 + phash(seed, 2) * 1.0) * scale;
    const plate = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.16 * scale), _rustMat);   // ACBC §G — rust-toned (was _hullMat) so the debris reads as TORN HULL METAL, not grey rock
    g.add(plate);
    const edge = new THREE.Mesh(new THREE.BoxGeometry(w, 0.16 * scale, 0.20 * scale), _rustMat);   // ragged torn lip
    edge.position.y = h / 2; edge.userData.isWreckDecoration = true; g.add(edge);
    collider = { kind: 'box', half: { x: w / 2, y: h / 2, z: 0.08 * scale }, pos: { x: 0, y: 0, z: 0 } };
    bbox = new THREE.Box3(new THREE.Vector3(-w / 2, -h / 2, -0.12 * scale), new THREE.Vector3(w / 2, h / 2 + 0.1 * scale, 0.12 * scale));
  } else if (kindIdx === 1) {
    const len = (1.6 + phash(seed, 1) * 2.4) * scale;
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.16 * scale, 0.16 * scale, len, 7), _rustMat);
    strut.rotation.x = Math.PI / 2; g.add(strut);   // lie along Z (matches the collider axis)
    for (const sz of [-1, 1]) {   // end flanges
      const fl = new THREE.Mesh(new THREE.BoxGeometry(0.5 * scale, 0.5 * scale, 0.10 * scale), _hullDarkMat);
      fl.position.z = sz * len / 2; fl.userData.isWreckDecoration = true; g.add(fl);
    }
    // Rapier cylinders are Y-axis; FACE.posY() rotates the collider onto Z to match the
    // visible horizontal bar (the prior FACE.posX() left an invisible VERTICAL capsule).
    collider = { kind: 'cylinder', halfHeight: len / 2, radius: 0.18 * scale, pos: { x: 0, y: 0, z: 0 }, quat: FACE.posY() };
    bbox = new THREE.Box3(new THREE.Vector3(-0.3 * scale, -0.3 * scale, -len / 2), new THREE.Vector3(0.3 * scale, 0.3 * scale, len / 2));
  } else {
    const w = (1.4 + phash(seed, 1) * 1.0) * scale;
    const h = (1.1 + phash(seed, 2) * 0.8) * scale;
    const d = (1.2 + phash(seed, 3) * 0.8) * scale;
    const chunk = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), _rustMat);   // ACBC §G — rust-toned torn hull chunk (was _hullMat) so it reads as wreck metal, not rock
    g.add(chunk);
    const rib = new THREE.Mesh(new THREE.BoxGeometry(w * 1.02, h * 0.16, 0.12 * scale), _hullDarkMat);
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
  // Gutted hull shell — a partial cylinder OPEN at the top + both ENDS, so the hollow
  // interior + ribs read from above, the side, and the torn ends. DoubleSide.
  // ACBB Tier 4 — WIDENED the top gap 126°→~153° (the critique read the husk as a flat
  // curved PLATE from 3q; a wider opening makes it unambiguously an open TROUGH so the
  // hollow + ribs read from any slightly-elevated or oblique angle, not just from directly above).
  const gap = Math.PI * 0.85;
  const shell = new THREE.Mesh(
    new THREE.CylinderGeometry(r, r, len, 16, 1, true, gap / 2, Math.PI * 2 - gap), _hullMat,
  );
  shell.rotation.z = Math.PI / 2;            // cylinder Y-axis → X (tube lies along X); gap → top (+Y)
  shell.position.y = r;
  (shell.material as THREE.Material).side = THREE.DoubleSide;
  // ACBB Tier 3 — the shell is a HOLLOW enterable trough: its collision is the two declared
  // side-wall boxes (you walk inside on the terrain floor), NOT the shell volume. Exempt it
  // from the COLLIDER-AUDIT so its mostly-empty AABB doesn't read as an un-collided mass.
  shell.userData.auditExempt = true;
  g.add(shell);
  // ACBC §G — longitudinal hull-plate SEAMS proud of the outer flanks so the convex shell
  // reads as riveted PLATING, not a smooth pipe. φ measured from the open +Y top; placed on
  // the lower/flank closed arc only. rotation.x=φ aligns the strip's thin face to the surface
  // normal; pushed proud by ~5cm (rule-7). Decoration (no collider, doesn't affect the audit).
  for (const phi of [Math.PI * 0.60, Math.PI * 0.92, Math.PI * 1.30, Math.PI * 1.62]) {
    const rho = r + 0.05;
    const seam = new THREE.Mesh(new THREE.BoxGeometry(len * 0.8, 0.12, 0.20), _hullDarkMat);
    seam.position.set((phash(seed, 90 + Math.round(phi * 10)) - 0.5) * len * 0.12, r + Math.cos(phi) * rho, Math.sin(phi) * rho);
    seam.rotation.x = phi;
    seam.userData.isWreckDecoration = true; g.add(seam);
    // a sparse rivet row riding the seam
    for (let i = 0; i < 4; i++) {
      const rx = (-0.3 + i * 0.2) * len * 0.8;
      const rivet = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.10, 0.12), _rustMat);
      rivet.position.set(seam.position.x + rx, r + Math.cos(phi) * (rho + 0.02), Math.sin(phi) * (rho + 0.02));
      rivet.rotation.x = phi; rivet.userData.isWreckDecoration = true; g.add(rivet);
    }
  }
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
  // C41 r3 — longer + thinner range (was 2.4-4.4 len / 0.9-1.4 r) so a short-fat roll can't
  // read as a buried BLOB end-on; min aspect len/diam ≈ 1.36 → always a hull, never a sphere.
  const len = (3.2 + phash(seed, 1) * 1.8) * scale;
  const r = (0.82 + phash(seed, 2) * 0.36) * scale;
  const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.96, len, 10), _hullMat);
  body.rotation.x = Math.PI / 2; g.add(body);   // axis along Z
  // ACBC §G — more hoop bands (plated sections) + a dorsal spine ridge + a sensor box so the
  // barrel reads as a detailed hull, not a smooth tube. Detail scales with r so the small
  // strut/sponson instances stay proportional. Top of the Z-axis barrel is +Y at (0, r, z).
  for (const tz of [-0.38, -0.13, 0.13, 0.38]) {
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(r + 0.02, 0.05, 6, 14), _hullDarkMat);
    hoop.position.z = len * tz; hoop.userData.isWreckDecoration = true; g.add(hoop);
  }
  const spine = new THREE.Mesh(new THREE.BoxGeometry(r * 0.20, r * 0.18, len * 0.62), _hullDarkMat);
  spine.position.set(0, r, 0); spine.userData.isWreckDecoration = true; g.add(spine);
  const sensor = new THREE.Mesh(new THREE.BoxGeometry(r * 0.42, r * 0.30, r * 0.42), _rustMat);
  sensor.position.set(0, r + r * 0.14, len * 0.16); sensor.userData.isWreckDecoration = true; g.add(sensor);
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

/** M7 ⑤ (C41) — Splayed multi-engine cluster: a hub + 3-4 bells FANNED around the axis,
 *  a wider/weirder stern than the single nozzle. Its 'mount' (axialIn at origin, −Z) mates
 *  onto a barrel's 'aft'; the cluster opens aft (+Z). One envelope cylinder collider covers
 *  the hub + the fanned bells (bells are decoration → exempt from the collider audit). */
export function splayedEngineCluster(seed: number): BuiltComponent {
  const g = new THREE.Group();
  const count = 3 + Math.floor(phash(seed, 0) * 2);          // 3-4 bells
  const hubR = 0.5 + phash(seed, 1) * 0.25;
  const hubDepth = hubR * 1.1;
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(hubR, hubR * 0.9, hubDepth, 9), _hullMat);
  hub.rotation.x = Math.PI / 2; hub.position.z = hubDepth / 2; g.add(hub);   // axis along Z
  const nozR = 0.30 + phash(seed, 2) * 0.12;
  const nozDepth = nozR * 1.5;
  const ringR = hubR + nozR * 0.7;
  for (let i = 0; i < count; i++) {
    const ang = (i / count) * Math.PI * 2 + phash(seed, 10 + i) * 0.3;
    const bell = makeEngineBellMesh(nozR, nozDepth, _hullMat, _hullDarkMat);
    bell.rotation.x = Math.PI / 2;                          // opens +Z (aft)
    bell.position.set(Math.cos(ang) * ringR, Math.sin(ang) * ringR, hubDepth + nozDepth * 0.35);
    bell.userData.isWreckDecoration = true;                 // detail; envelope collider covers it
    g.add(bell);
  }
  const envR = ringR + nozR;
  const envDepth = hubDepth + nozDepth;
  const sockets: Socket[] = [{ name: 'mount', pos: new THREE.Vector3(0, 0, 0), quat: FACE.negZ(), radius: hubR, tag: 'axialIn' }];
  const colliders: ColliderSpec[] = [
    { kind: 'cylinder', halfHeight: envDepth / 2, radius: envR, pos: { x: 0, y: 0, z: envDepth / 2 }, quat: FACE.posY() },
  ];
  const bbox = new THREE.Box3(new THREE.Vector3(-envR, -envR, 0), new THREE.Vector3(envR, envR, envDepth));
  return { mesh: g, sockets, colliders, panelMounts: [], bbox };
}

/** M7 ⑤ (C41) — Dorsal sensor mast: a tall thin comms spike with cross-arms + a tilted
 *  dish, for a distinctive VERTICAL silhouette (a different read from the fat stacked
 *  "tower"). Built along +Z; its 'base' mates onto a barrel's 'top' so mate() stands it
 *  upright. A thin cylinder collider covers the mast (arms + dish are decoration). */
export function dorsalMast(seed: number): BuiltComponent {
  const g = new THREE.Group();
  const h = 1.7 + phash(seed, 1) * 1.0;
  const r = 0.17 + phash(seed, 2) * 0.08;    // C41 r2 — THICKER (was 0.10-0.15, read as a pin antenna)
  // C41 r2 — a boxy sensor HOUSING at the base gives the mast visual mass + anchors it to the
  // hull (the critique: "a stick stabbed into sand"). Then a tapered mast above it.
  const baseH = 0.5 + phash(seed, 4) * 0.3;
  const housing = new THREE.Mesh(new THREE.BoxGeometry(r * 4.0, r * 4.0, baseH), _hullMat);
  housing.position.z = baseH / 2; g.add(housing);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.6, r, h, 8), _hullMat);
  mast.rotation.x = Math.PI / 2; mast.position.z = baseH + h / 2; g.add(mast);    // along +Z
  const arms = 2 + Math.floor(phash(seed, 3) * 2);
  for (let i = 0; i < arms; i++) {
    const az = baseH + h * (0.42 + 0.5 * (i / Math.max(1, arms - 1)));
    const armLen = 0.5 + phash(seed, 10 + i) * 0.6;
    const bar = new THREE.Mesh(new THREE.BoxGeometry(armLen, 0.07, 0.07), _hullDarkMat);
    bar.position.set(0, phash(seed, 20 + i) < 0.5 ? 0.08 : -0.08, az);
    bar.rotation.z = (phash(seed, 30 + i) - 0.5) * 0.5;
    bar.userData.isWreckDecoration = true; g.add(bar);
  }
  const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.07, 12), _rustMat);
  dish.rotation.x = Math.PI / 2.4; dish.position.set(0, 0.2, baseH + h * 0.9);
  dish.userData.isWreckDecoration = true; g.add(dish);
  const totalH = baseH + h;
  const sockets: Socket[] = [{ name: 'base', pos: new THREE.Vector3(0, 0, 0), quat: FACE.negZ(), radius: r * 1.5, tag: 'axialIn' }];
  const colliders: ColliderSpec[] = [
    { kind: 'box', half: { x: r * 2.0, y: r * 2.0, z: baseH / 2 }, pos: { x: 0, y: 0, z: baseH / 2 } },
    { kind: 'cylinder', halfHeight: h / 2, radius: r, pos: { x: 0, y: 0, z: baseH + h / 2 }, quat: FACE.posY() },
  ];
  const bbox = new THREE.Box3(new THREE.Vector3(-0.6, -0.6, 0), new THREE.Vector3(0.6, 0.6, totalH));
  return { mesh: g, sockets, colliders, panelMounts: [], bbox };
}

/** M7 ⑥ (C43; re-scoped C44 — the solitude pass, D252) — WELLHEAD: a long-DRY, RUINED well.
 *  A weathered metal CURB ring around a dark dry shaft, its winch COLLAPSED — one leaning broken
 *  post, one snapped stub, a fallen cross-beam, and rim plates slumped onto the sand. NO rope, NO
 *  bucket, NO working crank: it must read as abandoned-for-a-century, not a maintained water
 *  source (the world should show almost no signs of living human life). The curb + the 2 posts
 *  declare colliders; the rim/shaft/fallen-beam/rubble are decoration. */
export function wellHead(seed: number): BuiltComponent {
  const g = new THREE.Group();
  const curbR = 1.05 + phash(seed, 1) * 0.4;
  const curbH = 0.6 + phash(seed, 2) * 0.2;          // slumped/weathered (lower than the maintained C43 wellhead)
  const colliders: ColliderSpec[] = [];
  // ── weathered curb ring (a dry well-mouth: solid wall, recessed dark shaft) ──
  const curb = new THREE.Mesh(new THREE.CylinderGeometry(curbR, curbR * 1.1, curbH, 16), _hullMat);
  curb.position.y = curbH / 2; g.add(curb);
  colliders.push({ kind: 'cylinder', halfHeight: curbH / 2, radius: curbR * 1.1, pos: { x: 0, y: curbH / 2, z: 0 } });   // match the curb's WIDER base radius so the audit covers the full footprint
  // a BROKEN cap band — only a partial arc of the ring survives (the rest rotted away)
  const rim = new THREE.Mesh(new THREE.TorusGeometry(curbR, 0.08, 6, 14, Math.PI * (1.0 + phash(seed, 4) * 0.6)), _hullDarkMat);
  rim.rotation.x = Math.PI / 2; rim.rotation.z = phash(seed, 5) * Math.PI * 2;
  rim.position.y = curbH; rim.userData.isWreckDecoration = true; g.add(rim);
  // rim plates — irregular salvaged blocks; ~40% have SLUMPED off onto the sand (decay; ≥12cm deep, rule 7)
  const innerR = curbR * 0.74;
  for (let i = 0; i < 7; i++) {
    const ang = (i / 7) * Math.PI * 2 + phash(seed, 30 + i) * 0.3;
    const pw = 0.34 + phash(seed, 40 + i) * 0.2;
    const ph = 0.14 + phash(seed, 50 + i) * 0.12;
    const plate = new THREE.Mesh(new THREE.BoxGeometry(pw, ph, 0.16), i % 2 ? _rustMat : _hullDarkMat);
    if (phash(seed, 60 + i) > 0.6) {                  // slumped off the rim onto the sand, tilted
      plate.position.set(Math.cos(ang) * (curbR + 0.4), ph / 2 - 0.03, Math.sin(ang) * (curbR + 0.4));
      plate.rotation.set((phash(seed, 70 + i) - 0.5) * 0.7, -ang, Math.PI / 2 - phash(seed, 80 + i) * 0.6);
    } else {                                          // still ringing the curb, but settled askew
      plate.position.set(Math.cos(ang) * curbR, curbH + ph / 2 - 0.04, Math.sin(ang) * curbR);
      plate.rotation.set(0, -ang, (phash(seed, 90 + i) - 0.5) * 0.3);
    }
    plate.userData.isWreckDecoration = true; g.add(plate);
  }
  // recessed shaft: an inner wall dropping into shadow + a near-black void floor → reads as a HOLE
  const shaftWall = new THREE.Mesh(new THREE.CylinderGeometry(innerR, innerR, curbH * 0.9, 16, 1, true), _hullDarkMat);
  shaftWall.position.y = curbH * 0.55; shaftWall.userData.isWreckDecoration = true; g.add(shaftWall);
  const voidFloor = new THREE.Mesh(new THREE.CircleGeometry(innerR, 16), _shaftVoidMat);
  voidFloor.rotation.x = -Math.PI / 2; voidFloor.position.y = curbH * 0.18; voidFloor.userData.isWreckDecoration = true; g.add(voidFloor);
  // ── the COLLAPSED winch: a tall LEANING post (−X) + a SNAPPED stub (+X). The frame failed long
  //    ago; no drum, no rope, no bucket. Posts bed into the curb so the leaning foot stays planted. ──
  const postX = curbR * 0.92;
  const tallH = 1.5 + phash(seed, 3) * 0.5;
  const stubH = 0.4 + phash(seed, 6) * 0.3;
  const lean = 0.22 + phash(seed, 7) * 0.22;          // the surviving post leans (the frame gave way)
  const qLean = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), lean);
  const postA = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.12, tallH, 6), _rustMat);
  postA.position.set(-postX, curbH + tallH / 2 - 0.12, 0); postA.quaternion.copy(qLean); g.add(postA);
  colliders.push({ kind: 'cylinder', halfHeight: tallH / 2, radius: 0.12, pos: { x: -postX, y: curbH + tallH / 2 - 0.12, z: 0 }, quat: { x: qLean.x, y: qLean.y, z: qLean.z, w: qLean.w } });
  const postB = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, stubH, 6), _rustMat);   // snapped off near the base
  postB.position.set(postX, curbH + stubH / 2 - 0.08, 0); postB.rotation.z = -0.1; g.add(postB);
  colliders.push({ kind: 'cylinder', halfHeight: stubH / 2, radius: 0.13, pos: { x: postX, y: curbH + stubH / 2 - 0.08, z: 0 } });
  // a FALLEN cross-beam (the old windlass beam) dropped askew across the curb (decoration)
  const beam = new THREE.Mesh(new THREE.BoxGeometry(postX * 2 + 0.4, 0.13, 0.13), _hullDarkMat);
  beam.position.set(0, curbH + 0.07, 0.04);           // dropped onto the curb rim (fallen across the mouth, not propped)
  beam.rotation.set(phash(seed, 9) * 0.2, (phash(seed, 10) - 0.5) * 0.9, -0.14 - phash(seed, 11) * 0.16);
  beam.userData.isWreckDecoration = true; g.add(beam);
  // scattered rubble at the base — a couple of fallen chunks half-buried in the sand (decoration)
  for (let i = 0; i < 2; i++) {
    const rub = new THREE.Mesh(new THREE.BoxGeometry(0.28 + phash(seed, 120 + i) * 0.14, 0.16, 0.2 + phash(seed, 130 + i) * 0.12), _hullDarkMat);
    const ra = phash(seed, 140 + i) * Math.PI * 2;
    rub.position.set(Math.cos(ra) * (curbR + 0.5), 0.07, Math.sin(ra) * (curbR + 0.5));
    rub.rotation.set((phash(seed, 150 + i) - 0.5) * 0.6, ra, (phash(seed, 160 + i) - 0.5) * 0.6);
    rub.userData.isWreckDecoration = true; g.add(rub);
  }
  const sockets: Socket[] = [{ name: 'base', pos: new THREE.Vector3(0, 0, 0), quat: FACE.posY(), radius: curbR, tag: 'base' }];
  const panelMounts: PanelMount[] = [
    { pos: new THREE.Vector3(0, curbH * 0.5, curbR), quat: FACE.posZ(), kind: 'cargo_container' as PanelKind },
  ];
  const bbox = new THREE.Box3(
    new THREE.Vector3(-curbR - 0.7, 0, -curbR - 0.7),
    new THREE.Vector3(curbR + 0.7, curbH + tallH + 0.2, curbR + 0.7),
  );
  return { mesh: g, sockets, colliders, panelMounts, bbox };
}

export const _IDENT_MAT = new THREE.Matrix4();   // root placement
